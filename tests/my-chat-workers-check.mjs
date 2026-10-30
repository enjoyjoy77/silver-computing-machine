// Run with: node tests/my-chat-workers-check.mjs <installed miniflare package directory>
// Local workerd + D1 only. Upstream is mocked; no service credentials or API calls.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { Miniflare } = require(process.argv[2] || 'miniflare');
const source = readFileSync(new URL('../functions/_lib/my-chat-api.js', import.meta.url), 'utf8');
const script = source + `
export default { async fetch(request, env) {
  if (new URL(request.url).pathname === '/legacy-redirect') {
    try { new Request('https://api.openai.com/v1/responses', {redirect:'error'}); return Response.json({threw:false}); }
    catch (e) { return Response.json({threw:true, type:e.name}); }
  }
  const db = env.DB.withSession('first-primary');
  return handleMyChatApi(request, db, {id:'synthetic-session'}, async (url, options) => {
    // Exercise workerd's actual Request validation, not Node's fetch implementation.
    const upstream = new Request(url, options);
    if (upstream.redirect !== 'manual') throw new Error('redirect policy');
    if (url.endsWith('/speech')) return new Response(new Uint8Array([73,68,51,0]),{headers:{'Content-Type':'audio/mpeg'}});
    if (url.includes('/images/')) return Response.json({data:[{b64_json:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII='}]});
    return Response.json(url.endsWith('/transcriptions') ? {text:'音声テスト'} : {output:[{type:'message',content:[{type:'output_text',text:'文字テスト'}]}]});
  });
}};`;
const mf = new Miniflare({ workers:[{ config:{name:'my-chat-local-test', compatibilityDate:'2026-10-30',
  manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:script}}},
  env:{DB:{type:'d1',id:'local-my-chat-test',dev:{remote:false}}} } }], host:'127.0.0.1' });
try {
  const db = await mf.getD1Database('DB');
  for (const file of ['my-chat-schema.sql','my-chat-api-schema.sql']) {
    const sql=readFileSync(new URL(file,import.meta.url),'utf8').replace(/^--.*$/gm,'');
    for (const statement of sql.split(';').filter(x=>x.trim())) await db.prepare(statement).run();
  }
  await db.prepare('INSERT INTO my_chat_sessions VALUES (?,?)').bind('synthetic-session',Math.floor(Date.now()/1000)+3600).run();
  const legacy = await (await mf.dispatchFetch('https://silver-computing-machine-7ql.pages.dev/legacy-redirect')).json();
  assert.equal(legacy.threw,true); assert.equal(legacy.type,'TypeError');
  const key='sk-'+ 'syntheticRuntimeTestOnly'.repeat(2);
  const call=(path,body,type='application/json')=>mf.dispatchFetch('https://silver-computing-machine-7ql.pages.dev/api/my-chat/'+path,{method:'POST',headers:{'X-My-Chat-Key':key,'Content-Type':type},body});
  const text=await call('chat',JSON.stringify({messages:[{role:'user',content:'hello'}]}));
  assert.equal(text.status,200);assert.equal((await text.json()).text,'文字テスト');
  const audio=await call('transcribe','fake-audio','audio/mp4');assert.equal(audio.status,200);assert.equal((await audio.json()).text,'音声テスト');
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=';
  assert.equal((await call('image',JSON.stringify({prompt:'cat',consent:true}))).status,200);
  assert.equal((await call('image',JSON.stringify({prompt:'blue cat',image,consent:true}))).status,200);
  assert.equal((await call('chat',JSON.stringify({messages:[{role:'user',content:'describe'}],attachment:{kind:'image',data:image},consent:true}))).status,200);
  assert.equal((await call('chat',JSON.stringify({messages:[{role:'user',content:'search'}],web:true,consent:true}))).status,200);
  assert.equal((await call('chat',JSON.stringify({messages:[{role:'user',content:'limited'}]}))).status,429);
  await db.prepare("DELETE FROM my_chat_api_control WHERE id LIKE 'minute:%'").run();
  const speech=await call('speech',JSON.stringify({text:'hello',consent:true}));assert.equal(speech.status,200);assert.equal(speech.headers.get('Content-Type'),'audio/mpeg');assert.equal((await speech.arrayBuffer()).byteLength,4);
  console.log('Local workerd: speech binary response, redirect regression, text/audio, images/edits, vision/search, D1 session SQL and quota passed. No upstream API used.');
} finally { await mf.dispose(); }
