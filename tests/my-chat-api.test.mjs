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

test('allowlisted models propagate for ordinary, web, text and image attachments with fixed budgets',async()=>{
  for(const [model,effort] of [['gpt-5.4-mini','none'],['gpt-5.4','none'],['gpt-6-luna','none'],['gpt-6.1-sol','low']]) {
    const f=setup();
    for(const variant of [{},{web:true,consent:true},{attachment:{kind:'text',text:'document'},consent:true},{attachment:{kind:'image',data:image},consent:true}]) {
      const r=await f.run({body:JSON.stringify({model,messages:[{role:'user',content:'hello'}],reasoning:{effort:'max'},max_output_tokens:99999,...variant})});assert.equal(r.status,200);
      const p=JSON.parse(f.calls.at(-1).options.body);assert.equal(p.model,model);assert.equal(p.reasoning.effort,effort);assert.equal(p.max_output_tokens,1200);assert.equal(p.store,false);assert.equal(f.calls.at(-1).url,'https://api.openai.com/v1/responses');
    }
  }
});
test('unknown models and non-string model values fail before quota or provider calls',async()=>{
  const f=setup();for(const model of ['other','__proto__','constructor','https://evil.example','',null,123,['gpt-5.4'],{}]) {
    assert.equal((await f.run({body:JSON.stringify({model,messages:[{role:'user',content:'hello'}]})})).status,400);
  }
  assert.equal(f.calls.length,0);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM my_chat_api_control').get().n,0);
});

test('speech is opt-in, fixed upstream/model/voice, bounded binary and no-store',async()=>{
  const f=setup();const body=JSON.stringify({text:'hello',consent:true,model:'other',url:'https://evil.example'});
  const r=await f.run({path:'speech',body},async(url,o)=>{
    assert.equal(url,'https://api.openai.com/v1/audio/speech');assert.equal(o.redirect,'manual');assert.deepEqual(JSON.parse(o.body),{model:'gpt-4o-mini-tts',voice:'coral',input:'hello',response_format:'mp3'});
    return new Response(new Uint8Array([73,68,51,0]),{headers:{'Content-Type':'audio/mpeg'}});
  });assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store, private');assert.equal((await r.arrayBuffer()).byteLength,4);
  for(const b of [{text:'x'},{text:'x'.repeat(1001),consent:true},{text:key,consent:true}])assert.equal((await f.run({path:'speech',body:JSON.stringify(b)})).status,400);
  for(const upstream of [()=>Response.json({error:key}),()=>new Response('invalid',{headers:{'Content-Type':'audio/mpeg'}}),()=>new Response(new Uint8Array(4*1024*1024+1),{headers:{'Content-Type':'audio/mpeg'}})]) {
    const bad=await f.run({path:'speech',body},upstream);assert.equal(bad.status,502);assert.ok(!(await bad.text()).includes(key));
  }
});
test('speech has a daily sublimit and fails closed at the published retirement date',async()=>{
  const f=setup();f.sql.prepare('INSERT INTO my_chat_api_control VALUES (?,?,?)').run('feature:speech',Math.floor(Date.now()/86400000),30);
  const opts={path:'speech',body:JSON.stringify({text:'hello',consent:true})};assert.equal((await f.run(opts)).status,429);assert.equal(f.calls.length,0);
  const original=Date.now;try{Date.now=()=>Date.UTC(2027,0,6);assert.equal((await f.run(opts)).status,410);}finally{Date.now=original;}
});

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
  const mock = async (url, options) => { if (options.redirect === 'error') throw new TypeError('Unsupported Workers redirect mode'); calls.push({url,options}); return Response.json(url.includes('/images/')?{data:[{b64_json:png}]}:url.endsWith('transcriptions')?{text:'こんにちは'}:{output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'テストの返答'}]}]}); };
  function request({path='chat', body=JSON.stringify({messages:[{role:'user',content:'こんにちは'}]}), type='application/json', apiKey=key, method='POST', signal}={}) {
    return new Request(origin+'/api/my-chat/'+path,{method,headers:{'X-My-Chat-Key':apiKey,'Content-Type':type,Origin:origin},body:method==='GET'?undefined:body,signal});
  }
  const run = (opts={},fetcher=mock,serverKey,geminiKey) => handleMyChatApi(request(opts),db,{id:'session'},fetcher,serverKey,geminiKey);
  return {sql,db,calls,run};
}
test('text uses fixed Responses model, store:false and output cap; ignores arbitrary destination',async()=>{
  const f=setup(); const r=await f.run({body:JSON.stringify({url:'https://evil.example',messages:[{role:'user',content:'hello'}]})});
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
  for(const [opts,code] of [[{apiKey:''},400],[{method:'GET'},405],[{path:'proxy'},404],[{body:'broken'},400],[{type:'text/plain'},415],[{body:JSON.stringify({messages:[{role:'system',content:'x'}]})},400],[{body:JSON.stringify({messages:[{role:'user',content:'x'.repeat(4001)}]})},400],[{body:'x'.repeat(6*1024*1024+1)},413],[{path:'transcribe',type:'audio/ogg',body:'x'},415],[{path:'transcribe',type:'audio/webm',body:new Uint8Array(2*1024*1024+1)},413]]) assert.equal((await f.run(opts)).status,code);
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
  for (const [feature,count,opts] of [['image',30,{path:'image',body:JSON.stringify({prompt:'cat',consent:true})}],['web',30,{body:JSON.stringify({messages:[{role:'user',content:'search'}],web:true,consent:true})}]]) {
    f.sql.prepare('INSERT INTO my_chat_api_control VALUES (?,?,?)').run('feature:'+feature,bucket,count);
    assert.equal((await f.run(opts)).status,429);
  }
  assert.equal(f.calls.length,0);
});

test('server secret is preferred, fixed upstream only, missing/invalid configuration fails closed',async()=>{
 const f=setup(),secret='sk-'+'SyntheticServerOnlyForTests'.repeat(2);
 const r=await f.run({apiKey:''},undefined,secret);assert.equal(r.status,200);assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+secret);assert.ok(!f.calls[0].options.body.includes(secret));assert.ok(!(await r.text()).includes(secret));
 const before=f.calls.length;assert.equal((await f.run({},undefined,'bad-value')).status,503);assert.equal(f.calls.length,before);
 const req=new Request(origin+'/api/my-chat/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 const missing=await handleMyChatApi(req,f.db,{id:'session'},()=>{throw Error('must not send');});assert.equal((await missing.json()).code,'SERVER_KEY_MISSING');
 f.sql.exec('DELETE FROM my_chat_sessions');assert.equal((await f.run({},undefined,secret)).status,401);assert.equal(f.calls.length,before);
});

test('up to four reference images propagate in order to vision and JSON edits; output/cost limits stay fixed',async()=>{
 for(const n of [1,4]){const f=setup(),images=Array(n).fill(image);
  const vision=await f.run({body:JSON.stringify({messages:[{role:'user',content:'compare'}],model:'gpt-6-luna',attachment:{kind:'images',images},consent:true})});assert.equal(vision.status,200);
  let payload=JSON.parse(f.calls.at(-1).options.body);assert.equal(payload.input[0].content.length,n+1);assert.deepEqual(payload.input[0].content.slice(1),images.map(image_url=>({type:'input_image',image_url,detail:'low'})));assert.equal(payload.model,'gpt-6-luna');assert.equal(payload.max_output_tokens,1200);
  const edit=await f.run({path:'image',body:JSON.stringify({prompt:'combine',images,consent:true,n:4,size:'4096x4096'})});assert.equal(edit.status,200);assert.equal(f.calls.at(-1).url,'https://api.openai.com/v1/images/edits');payload=JSON.parse(f.calls.at(-1).options.body);assert.deepEqual(payload.images,images.map(image_url=>({image_url})));assert.equal(payload.n,1);assert.equal(payload.quality,'low');assert.equal(payload.size,'1024x1024');assert.equal(payload.model,'gpt-image-2.5-flare');
 }
});
function paddedPng(bytes){const original=Buffer.from(png,'base64'),chunk=Buffer.alloc(bytes-original.length);chunk.writeUInt32BE(chunk.length-12,0);chunk.write('tEXt',4);return 'data:image/png;base64,'+Buffer.concat([original.subarray(0,-12),chunk,original.subarray(-12)]).toString('base64');}
test('reference image count, per-image and aggregate bytes are checked before quota or upstream',async()=>{
 const f=setup();const tooBig=paddedPng(2*1024*1024+1),medium=paddedPng(1536*1024);
 for(const images of [[],Array(5).fill(image),'bad',[image,null],[image,'https://example.com/a.png'],[image,image.slice(0,-12)],[tooBig],[medium,medium,medium]]){
  for(const path of ['chat','image']){const body=path==='image'?{prompt:'edit',images,consent:true}:{messages:[{role:'user',content:'read'}],attachment:{kind:'images',images},consent:true};const r=await f.run({path,body:JSON.stringify(body)});assert.ok([400,413].includes(r.status));}
 }
 assert.equal(f.calls.length,0);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM my_chat_api_control').get().n,0);
 const exact=paddedPng(2*1024*1024);assert.equal((await f.run({path:'image',body:JSON.stringify({prompt:'edit',images:[exact,exact],consent:true})})).status,200);
});
test('multi-image consent, mixed image fields and search combinations fail closed',async()=>{
 const f=setup();for(const opts of [
 {path:'image',body:JSON.stringify({prompt:'x',images:[image]})},
 {path:'image',body:JSON.stringify({prompt:'x',images:[image],image,consent:true})},
 {body:JSON.stringify({messages:[{role:'user',content:'x'}],attachment:{kind:'images',images:[image]}})},
 {body:JSON.stringify({messages:[{role:'user',content:'x'}],attachment:{kind:'images',images:[image]},web:true,consent:true})}
 ])assert.equal((await f.run(opts)).status,400);assert.equal(f.calls.length,0);
});


test('generation and edits share 30 daily attempts; 31st is blocked and UTC midnight resets',async()=>{
 const original=Date.now;let now=Date.UTC(2026,10,4,23,0);Date.now=()=>now;
 try {
  const f=setup();f.sql.prepare('UPDATE my_chat_sessions SET expires=?').run(Math.floor(now/1000)+172800);
  const opts=i=>({path:'image',body:JSON.stringify({prompt:'synthetic image',consent:true,...(i%2?{images:[image]}:{})})});
  for(let i=0;i<30;i++) {
   assert.equal((await f.run(opts(i))).status,200,`attempt ${i+1}`);now+=61000;
  }
  assert.equal(f.calls.length,30);
  assert.equal(f.calls.filter(c=>c.url.endsWith('/edits')).length,15);
  assert.equal((await f.run(opts(30))).status,429);assert.equal(f.calls.length,30);
  now=Date.UTC(2026,10,5);
  assert.equal((await f.run(opts(31))).status,200);assert.equal(f.calls.length,31);
  assert.equal(f.sql.prepare("SELECT count FROM my_chat_api_control WHERE id='feature:image'").get().count,1);
 } finally {Date.now=original;}
});


test('upstream HTTP diagnostics expose only status and a fixed code, never upstream body',async()=>{
 for(const status of [400,401,403,429,500,503]){
  const f=setup();let calls=0;const r=await f.run({},async()=>{calls++;return Response.json({error:'private upstream body '+key},{status});});const data=await r.json();assert.equal(data.code,'UPSTREAM_HTTP');assert.equal(data.upstreamStatus,status);assert.ok(data.error.includes('UPSTREAM_HTTP_'+status));assert.ok(!JSON.stringify(data).includes(key));assert.ok(!JSON.stringify(data).includes('private upstream body'));assert.equal(calls,1);
 }
});


const googleKey='AIza'+'syntheticOnlyNeverARealKey'.padEnd(35,'x');
const geminiAnswer=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private reasoning'},{text:'Gemini answer'}]}}]});
test('Gemini fixed endpoint and key isolation with bounded text, images and documents',async()=>{
 const f=setup();let calls=0;
 for(const attachment of [undefined,{kind:'text',text:'local extracted text'},{kind:'images',images:[image,image]}]){
  const r=await f.run({path:'gemini/chat',body:JSON.stringify({model:'gemini-3.5-flash-lite',messages:[{role:'user',content:'one'},{role:'assistant',content:'two'},{role:'user',content:'read'}],attachment,consent:true,url:'https://evil.example',generationConfig:{maxOutputTokens:999999}})},async(url,o)=>{
   calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');assert.equal(o.headers['x-goog-api-key'],googleKey);assert.equal(o.headers.Authorization,undefined);assert.equal(o.redirect,'manual');assert.ok(!o.body.includes(key));const p=JSON.parse(o.body);assert.deepEqual(p.contents.map(c=>c.role),['user','model','user']);assert.equal(p.generationConfig.maxOutputTokens,1200);assert.equal(p.generationConfig.thinkingConfig.thinkingLevel,'MINIMAL');assert.equal(p.previous_interaction_id,undefined);if(attachment?.kind==='images')assert.equal(p.contents[2].parts[1].inlineData.data,png);return geminiAnswer();
  },key,googleKey);assert.equal(r.status,200);assert.equal((await r.json()).text,'Gemini answer');
 }
 assert.equal(calls,3);
 const r=await f.run({},async(url,o)=>{assert.ok(url.startsWith('https://api.openai.com/'));assert.equal(o.headers['x-goog-api-key'],undefined);assert.equal(o.headers.Authorization,'Bearer '+key);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'OpenAI'}]}]});},key,googleKey);assert.equal(r.status,200);
});
test('Gemini missing secret, wrong model, unsupported features and secret-like content fail before provider',async()=>{
 const f=setup(),run=(body={},secret=googleKey)=>f.run({path:'gemini/chat',body:JSON.stringify({messages:[{role:'user',content:'hello'}],...body})},()=>{throw Error('must not send');},key,secret);
 assert.equal((await run({},'')).status,503);assert.equal((await run({},key)).status,503);
 for(const body of [{model:'gpt-5.4-mini'},{model:'__proto__'},{web:true,consent:true},{messages:[{role:'user',content:googleKey}]},{attachment:{kind:'text',text:key},consent:true}])assert.equal((await run(body)).status,400);
 assert.equal((await f.run({path:'gemini/speech'},()=>{throw Error('no send');},key,googleKey)).status,404);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM my_chat_api_control').get().n,0);
});
test('Gemini image generation/editing fixed output and shared image quota',async()=>{
 const f=setup();for(const images of [undefined,[image,image,image,image]]){
 const r=await f.run({path:'gemini/image',body:JSON.stringify({prompt:'synthetic image',consent:true,images})},async(url,o)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1:generateContent');const p=JSON.parse(o.body);assert.equal(p.contents[0].parts.length,images?5:1);assert.deepEqual(p.generationConfig.imageConfig,{aspectRatio:'1:1',imageSize:'1K'});assert.equal(p.generationConfig.candidateCount,1);assert.equal(p.generationConfig.thinkingConfig.thinkingLevel,'MINIMAL');assert.equal(p.generationConfig.maxOutputTokens,4096);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'image/png',data:png}}]}}]});},key,googleKey);assert.equal(r.status,200);assert.equal((await r.json()).image,image);}
 f.sql.prepare("UPDATE my_chat_api_control SET count=30 WHERE id='feature:image'").run();assert.equal((await f.run({path:'gemini/image',body:JSON.stringify({prompt:'x',consent:true})},()=>{throw Error('quota must block');},key,googleKey)).status,429);
});
test('Gemini failure, redirect, blocked response, stop and revocation never fallback or repeat',async()=>{
 for(const provider of [()=>new Response(null,{status:302,headers:{Location:'https://evil.example'}}),()=>Response.json({error:key},{status:500}),()=>Promise.reject(Error(googleKey)),()=>Response.json({promptFeedback:{blockReason:'SAFETY'}})]){
  const f=setup();let n=0;const r=await f.run({path:'gemini/chat'},(...args)=>{n++;return provider(...args);},key,googleKey);assert.ok(r.status>=500);const body=await r.text();assert.ok(!body.includes(key));assert.ok(!body.includes(googleKey));assert.equal(n,1);
 }
 const f=setup(),controller=new AbortController();let n=0;const pending=f.run({path:'gemini/chat',signal:controller.signal},async(url,o)=>{n++;controller.abort();throw new DOMException('stop','AbortError');},key,googleKey);assert.equal((await pending).status,504);assert.equal(n,1);
 f.sql.exec('DELETE FROM my_chat_sessions');assert.equal((await f.run({path:'gemini/chat'},()=>{throw Error('revoked');},key,googleKey)).status,401);
});

test('Gemini higher capability model uses explicit supported LOW thinking and fixed endpoint',async()=>{
 const f=setup();const r=await f.run({path:'gemini/chat',body:JSON.stringify({model:'gemini-3.8-flash',messages:[{role:'user',content:'hello'}]})},async(url,o)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');const p=JSON.parse(o.body);assert.equal(p.generationConfig.thinkingConfig.thinkingLevel,'LOW');assert.equal(p.generationConfig.maxOutputTokens,1200);return geminiAnswer();},key,googleKey);assert.equal(r.status,200);
});
