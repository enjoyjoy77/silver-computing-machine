import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleMyChatApi } from '../functions/_lib/my-chat-api.js';
const origin = 'https://silver-computing-machine-7ql.pages.dev';
// Synthetic placeholder, never a service credential.
const key = 'sk-' + 'testOnlyNotARealCredential'.repeat(2);
function setup() {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['my-chat-schema.sql', 'my-chat-api-schema.sql']) sql.exec(readFileSync(new URL(file, import.meta.url), 'utf8'));
  sql.prepare('INSERT INTO my_chat_sessions VALUES (?,?)').run('session', Math.floor(Date.now()/1000)+1000);
  const db = { prepare(query) {
    let args=[]; return { bind(...v) { args=v; return this; }, async first() { return sql.prepare(query).get(...args)||null; }, async run() { return sql.prepare(query).run(...args); }, execute() { const s=sql.prepare(query); return { results:s.columns().length?s.all(...args):(s.run(...args),[]) }; } };
  }, async batch(statements) { sql.exec('BEGIN'); try { const out=statements.map(s=>s.execute());sql.exec('COMMIT');return out; } catch(e) { sql.exec('ROLLBACK');throw e; } } };
  const calls=[];
  const mock = async (url, options) => { calls.push({url,options}); return Response.json(url.endsWith('transcriptions')?{text:'こんにちは'}:{output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'テストの返答'}]}]}); };
  function request({path='chat', body=JSON.stringify({messages:[{role:'user',content:'こんにちは'}]}), type='application/json', apiKey=key, method='POST', signal}={}) {
    return new Request(origin+'/api/my-chat/'+path,{method,headers:{'X-My-Chat-Key':apiKey,'Content-Type':type,Origin:origin},body:method==='GET'?undefined:body,signal});
  }
  const run = (opts={},fetcher=mock) => handleMyChatApi(request(opts),db,{id:'session'},fetcher);
  return {sql,db,calls,run};
}
test('text uses fixed Responses model, store:false and output cap; ignores arbitrary destination',async()=>{
  const f=setup(); const r=await f.run({body:JSON.stringify({url:'https://evil.example',model:'other',messages:[{role:'user',content:'hello'}]})});
  assert.equal(r.status,200);assert.equal((await r.json()).text,'テストの返答');
  const call=f.calls[0];assert.equal(call.url,'https://api.openai.com/v1/responses');assert.equal(call.options.redirect,'error');
  const body=JSON.parse(call.options.body);assert.equal(body.model,'gpt-5.4-mini');assert.equal(body.store,false);assert.equal(body.max_output_tokens,1200);
  assert.equal(body.input.length,1);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM my_chat_api_control WHERE id LIKE ?').get('lock:%').n,0);
});
test('audio uses fixed transcription multipart with bounded file',async()=>{
  const f=setup();assert.equal((await f.run({path:'transcribe',body:new Uint8Array([1,2,3]),type:'audio/mp4'})).status,200);
  const call=f.calls[0];assert.equal(call.url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(call.options.body.get('model'),'gpt-transcribe');assert.equal(call.options.body.get('file').name,'recording.mp4');assert.equal(call.options.body.get('file').size,3);
});
test('bad keys, methods, paths, roles, sizes and media never call upstream',async()=>{
  const f=setup();
  for(const [opts,code] of [[{apiKey:''},400],[{method:'GET'},405],[{path:'proxy'},404],[{body:'broken'},400],[{type:'text/plain'},415],[{body:JSON.stringify({messages:[{role:'system',content:'x'}]})},400],[{body:JSON.stringify({messages:[{role:'user',content:'x'.repeat(4001)}]})},400],[{body:'x'.repeat(80001)},413],[{path:'transcribe',type:'audio/ogg',body:'x'},415],[{path:'transcribe',type:'audio/webm',body:new Uint8Array(2*1024*1024+1)},413]]) assert.equal((await f.run(opts)).status,code);
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
