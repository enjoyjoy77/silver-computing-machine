import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleMyChatApi } from '../functions/_lib/my-chat-api.js';
const origin = 'https://silver-computing-machine-7ql.pages.dev';
// Synthetic placeholder, never a service credential.
const key = 'sk-' + 'testOnlyNotARealCredential'.repeat(2);
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=';
const image='data:image/png;base64,'+png;

test('credential-like text never reaches a model or image prompt',async()=>{
  const f=setup();
  for(const opts of [
    {body:JSON.stringify({messages:[{role:'user',content:key}]})},
    {body:JSON.stringify({messages:[{role:'user',content:'read'}],consent:true,attachment:{kind:'text',text:key}})},
    {path:'image',body:JSON.stringify({prompt:key,consent:true})}
  ]) assert.equal((await f.run(opts)).status,400);
  assert.equal(f.calls.length,0);
});

test('malformed generated PNG is rejected without reflecting provider data',async()=>{
  const f=setup();
  const r=await f.run({path:'image',body:JSON.stringify({prompt:'a tree',consent:true})},async()=>Response.json({data:[{b64_json:'iVBORw0KGgoAAAAA'}],error:key}));
  assert.equal(r.status,502);assert.ok(!(await r.text()).includes(key));
});
function setup() {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['my-chat-schema.sql', 'my-chat-api-schema.sql']) sql.exec(readFileSync(new URL(file, import.meta.url), 'utf8'));
  sql.prepare('INSERT INTO my_chat_sessions VALUES (?,?)').run('session', Math.floor(Date.now()/1000)+1000);
  const db = { prepare(query) {
    let args=[]; return { bind(...v) { args=v; return this; }, async first() { return sql.prepare(query).get(...args)||null; }, async run() { return sql.prepare(query).run(...args); }, execute() { const s=sql.prepare(query); return { results:s.columns().length?s.all(...args):(s.run(...args),[]) }; } };
  }, async batch(statements) { sql.exec('BEGIN'); try { const out=statements.map(s=>s.execute());sql.exec('COMMIT');return out; } catch(e) { sql.exec('ROLLBACK');throw e; } } };
  const calls=[];
  const mock = async (url, options) => { if (options.redirect === 'error') throw new TypeError('Unsupported Workers redirect mode'); calls.push({url,options}); return Response.json(url.endsWith('transcriptions')?{text:'こんにちは'}:{output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'テストの返答'}]}]}); };
  function request({path='chat', body=JSON.stringify({messages:[{role:'user',content:'こんにちは'}]}), type='application/json', apiKey=key, method='POST', signal}={}) {
    return new Request(origin+'/api/my-chat/'+path,{method,headers:{'X-My-Chat-Key':apiKey,'Content-Type':type,Origin:origin},body:method==='GET'?undefined:body,signal});
  }
  const run = (opts={},fetcher=mock) => handleMyChatApi(request(opts),db,{id:'session'},fetcher);
  return {sql,db,calls,run};
}
test('text uses fixed Responses model, store:false and output cap; ignores arbitrary destination',async()=>{
  const f=setup(); const r=await f.run({body:JSON.stringify({url:'https://evil.example',model:'other',messages:[{role:'user',content:'hello'}]})});
  assert.equal(r.status,200);assert.equal((await r.json()).text,'テストの返答');
  const call=f.calls[0];assert.equal(call.url,'https://api.openai.com/v1/responses');assert.equal(call.options.redirect,'manual');
  const body=JSON.parse(call.options.body);assert.equal(body.model,'gpt-5.4-mini');assert.equal(body.store,false);assert.equal(body.max_output_tokens,1200);
  assert.equal(body.input.length,1);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM my_chat_api_control WHERE id LIKE ?').get('lock:%').n,0);
});
test('audio uses fixed transcription multipart with bounded file',async()=>{
  const f=setup();assert.equal((await f.run({path:'transcribe',body:new Uint8Array([1,2,3]),type:'audio/mp4'})).status,200);
  const call=f.calls[0];assert.equal(call.url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(call.options.body.get('model'),'gpt-transcribe');assert.equal(call.options.body.get('file').name,'recording.mp4');assert.equal(call.options.body.get('file').size,3);
});
test('bad keys, methods, paths, roles, sizes and media never call upstream',async()=>{
  const f=setup();
  for(const [opts,code] of [[{apiKey:''},400],[{method:'GET'},405],[{path:'proxy'},404],[{body:'broken'},400],[{type:'text/plain'},415],[{body:JSON.stringify({messages:[{role:'system',content:'x'}]})},400],[{body:JSON.stringify({messages:[{role:'user',content:'x'.repeat(4001)}]})},400],[{body:'x'.repeat(3000001)},413],[{path:'transcribe',type:'audio/ogg',body:'x'},415],[{path:'transcribe',type:'audio/webm',body:new Uint8Array(2*1024*1024+1)},413]]) assert.equal((await f.run(opts)).status,code);
  assert.equal(f.calls.length,0);
});
test('atomic lock rejects parallel calls and releases after upstream completion',async()=>{
  const f=setup();let release,entered;const started=new Promise(r=>entered=r);
  const first=f.run({},async()=>{entered();return new Promise(r=>release=()=>r(Response.json({output:[{type:'message',content:[{type:'output_text',text:'ok'}]}]})));});
  await started;assert.equal((await f.run()).status,409);release();assert.equal((await first).status,200);assert.equal((await f.run()).status,200);
});
test('per-minute quota cannot be bypassed sequentially, resets next minute',async()=>{
  const f=setup(),old=Date.now;let now=old();Date.now=()=>now;
  try { for(let i=0;i<6;i++)assert.equal((await f.run()).status,200);assert.equal((await f.run()).status,429);now+=61000;assert.equal((await f.run()).status,200); } finally { Date.now=old; }
});
test('global daily quota persists across session IDs, midnight resets',async()=>{
  const f=setup(),old=Date.now;let now=old();Date.now=()=>now;
  f.sql.prepare('INSERT INTO my_chat_api_control VALUES (?,?,?)').run('day:global',Math.floor(now/86400000),100);
  try { assert.equal((await f.run()).status,429);now+=86400000;f.sql.prepare('UPDATE my_chat_sessions SET expires=?').run(Math.floor(now/1000)+1000);assert.equal((await f.run()).status,200); } finally { Date.now=old; }
});
test('missing schema and revoked sessions fail closed without upstream use',async()=>{
  let f=setup();f.sql.exec('DROP TABLE my_chat_api_control');assert.equal((await f.run()).status,503);assert.equal(f.calls.length,0);
  f=setup();f.sql.exec('DELETE FROM my_chat_sessions');assert.equal((await f.run()).status,401);assert.equal(f.calls.length,0);
});
test('upstream failures are sanitized and never retried; cancellation propagates',async()=>{
  const f=setup();let count=0;
  const r=await f.run({},async()=>{count++;return new Response('sensitive upstream error '+key,{status:401});});
  assert.equal(r.status,502);assert.ok(!(await r.text()).includes(key));assert.equal(count,1);
  const c=new AbortController();let entered;const started=new Promise(r=>entered=r);
  const pending=f.run({signal:c.signal},async(url,opts)=>{entered();return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('abort'))));});
  await started;c.abort();assert.equal((await pending).status,504);
  assert.equal((await f.run()).status,200);
});
test('redirects never forward credentials or follow Location, for text and audio',async()=>{
  for (const opts of [{}, {path:'transcribe',type:'audio/mp4',body:'fake-audio'}]) {
    const f=setup();let count=0;
    const r=await f.run(opts,async(url,init)=>{count++;assert.equal(init.redirect,'manual');assert.ok(url.startsWith('https://api.openai.com/v1/'));return new Response(null,{status:307,headers:{Location:'https://example.invalid/steal'}});});
    assert.equal(r.status,502);assert.equal((await r.json()).code,'UPSTREAM_REDIRECT');assert.equal(count,1);
  }
});
test('safe error codes distinguish DB, connection and response failures without exposing details',async()=>{
  let f=setup();f.sql.exec('DROP TABLE my_chat_api_control');assert.equal((await (await f.run()).json()).code,'DB_CONTROL');assert.equal(f.calls.length,0);
  f=setup();let r=await f.run({},async()=>{throw Error(key);});assert.equal((await r.json()).code,'UPSTREAM_CONNECT');
  r=await f.run({},async()=>new Response('not-json '+key));const body=await r.json();assert.equal(body.code,'UPSTREAM_RESPONSE');assert.ok(!JSON.stringify(body).includes(key));
});
test('attachments require consent, bound text/image content, and never accept remote image URLs',async()=>{
  const f=setup();const messages=[{role:'user',content:'説明して'}];
  for (const attachment of [{kind:'image',data:image},{kind:'text',text:'name,value\na,1'}]) {
    assert.equal((await f.run({body:JSON.stringify({messages,attachment})})).status,400);
    assert.equal((await f.run({body:JSON.stringify({messages,attachment,consent:true})})).status,200);
  }
  const a=JSON.parse(f.calls[0].options.body);assert.equal(a.input[0].content[1].type,'input_image');assert.equal(a.input[0].content[1].detail,'low');assert.equal(a.input[0].content[1].image_url,image);
  const b=JSON.parse(f.calls[1].options.body);assert.equal(b.input[0].content[1].type,'input_text');assert.match(b.input[0].content[1].text,/name,value/);
  for (const attachment of [{kind:'image',data:'https://example.invalid/a.png'},{kind:'image',data:'data:image/svg+xml;base64,PHN2Zz4='},{kind:'text',text:'x'.repeat(8001)},{kind:'pdf',data:'x'}]) assert.equal((await f.run({body:JSON.stringify({messages,attachment,consent:true})})).status,400);
  assert.equal(f.calls.length,2);
});
test('web opt-in has fixed tool limits and returns only safe inline citation ranges',async()=>{
  const f=setup();const messages=[{role:'user',content:'調べて'}];
  assert.equal((await f.run({body:JSON.stringify({messages,web:true})})).status,400);
  assert.equal((await f.run({body:JSON.stringify({messages,web:true,consent:true,attachment:{kind:'text',text:'private'}})})).status,400);
  let payload;
  const r=await f.run({body:JSON.stringify({messages,web:true,consent:true})},async(url,opts)=>{payload=JSON.parse(opts.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'source result',annotations:[{type:'url_citation',url:'https://example.com/page',title:'Example',start_index:0,end_index:6},{type:'url_citation',url:'javascript:alert(1)',start_index:7,end_index:13}]}]}]});});
  assert.equal(payload.tools[0].type,'web_search');assert.equal(payload.tools[0].search_context_size,'low');assert.equal(payload.max_tool_calls,1);assert.equal(payload.tool_choice,'required');assert.equal((await r.json()).citations.length,1);
});
test('image generation/edit requests fix cost controls and require explicit consent',async()=>{
  const f=setup();const calls=[];const mock=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return Response.json({data:[{b64_json:png}]});};
  assert.equal((await f.run({path:'image',body:JSON.stringify({prompt:'cat'})},mock)).status,400);
  for (const data of [{prompt:'cat',consent:true},{prompt:'make it blue',image,consent:true}]) {
    const r=await f.run({path:'image',body:JSON.stringify({...data,model:'arbitrary',n:10,quality:'max'})},mock);assert.equal(r.status,200);assert.equal((await r.json()).image,image);
  }
  assert.equal(calls[0].url,'https://api.openai.com/v1/images/generations');assert.equal(calls[1].url,'https://api.openai.com/v1/images/edits');
  for (const {body} of calls) {assert.equal(body.n,1);assert.equal(body.quality,'low');assert.equal(body.size,'1024x1024');assert.equal(body.model,'gpt-image-2.5-flare');assert.equal(body.moderation,'auto');}
  assert.equal(calls[1].body.images[0].image_url,image);
});
test('feature quotas enforce daily image/search sublimits without new schema',async()=>{
  const f=setup();const bucket=Math.floor(Date.now()/86400000);
  for (const [feature,count,opts] of [['image',10,{path:'image',body:JSON.stringify({prompt:'cat',consent:true})}],['web',30,{body:JSON.stringify({messages:[{role:'user',content:'search'}],web:true,consent:true})}]]) {
    f.sql.prepare('INSERT INTO my_chat_api_control VALUES (?,?,?)').run('feature:'+feature,bucket,count);
    assert.equal((await f.run(opts)).status,429);
  }
  assert.equal(f.calls.length,0);
});
