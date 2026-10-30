import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { handleMyChat } from '../functions/_lib/my-chat-auth.js';

const origin = 'https://silver-computing-machine-7ql.pages.dev';
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('./my-chat-schema.sql', import.meta.url), 'utf8'));
  function prepare(query) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) || null; },
      async run() { return sql.prepare(query).run(...args); },
      execute() { const stmt = sql.prepare(query); return { results: stmt.columns().length ? stmt.all(...args) : (stmt.run(...args), []) }; },
    };
  }
  const db = { prepare, async batch(statements) {
    sql.exec('BEGIN');
    try { const results=statements.map(s=>s.execute()); sql.exec('COMMIT'); return results; }
    catch(e) { sql.exec('ROLLBACK'); throw e; }
  }};
  const pass = randomBytes(48).toString('base64url');
  const env={MY_CHAT_AUTH_DB:db,MY_CHAT_AUTH_VERIFIER:createHash('sha256').update(pass).digest('hex'),MY_CHAT_SESSION_KEY:randomBytes(32).toString('hex')};
  function request(path='/my-chat/',opts={}) {
    return handleMyChat({request:new Request(origin+path,opts),env});
  }
  function login(value=pass,ip='192.0.2.1',extra={}) {
    return request('/my-chat/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded','CF-Connecting-IP':ip,...extra},body:new URLSearchParams({passphrase:value})});
  }
  return {sql,env,pass,request,login};
}
const cookieFrom = r => r.headers.get('set-cookie').split(';')[0];

test('direct HTML, assets and API require authentication',async()=>{
  const f=fixture();
  for(const path of ['/my-chat/','/my-chat/index.html','/my-chat/app.js','/my-chat/style.css','/my-chat/session','/api/my-chat/','/api/my-chat/chat']) {
    const r=await f.request(path); assert.equal(r.status,401,path);
    assert.match(r.headers.get('cache-control'),/no-store/);
    assert.doesNotMatch(await r.text(),/今日は、何を話そう|const \$=|chats=/);
  }
});
test('login, cookie attributes, protected assets, API disabled, logout revocation',async()=>{
  const f=fixture(), r=await f.login(); assert.equal(r.status,303);
  const cookie=r.headers.get('set-cookie');
  for(const attr of ['__Host-my_chat=','Path=/','HttpOnly','Secure','SameSite=Strict','Max-Age=28800']) assert.ok(cookie.includes(attr));
  assert.ok(!cookie.includes('Domain='));
  const headers={Cookie:cookieFrom(r)};
  const page=await f.request('/my-chat/',{headers});assert.equal(page.status,200);assert.match(await page.text(),/ログアウト/);
  for(const asset of ['app.js','style.css']) assert.equal((await f.request('/my-chat/'+asset,{headers})).status,200);
  assert.equal((await f.request('/api/my-chat/chat',{headers})).status,404);
  const state=await (await f.request('/my-chat/session',{headers})).json();
  assert.ok(state.expires> Date.now()/1000+28795 && state.expires<=Date.now()/1000+28800);
  const logout=await f.request('/my-chat/logout',{method:'POST',headers:{...headers,Origin:origin}});
  assert.equal(logout.status,303);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await f.request('/my-chat/',{headers})).status,401);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM my_chat_sessions').get().n,0);
});
test('wrong passphrases are rate limited atomically across concurrent requests',async()=>{
  const f=fixture();
  const results=await Promise.all(Array.from({length:12},()=>f.login('incorrect')));
  assert.equal(results.filter(r=>r.status===401).length,5);assert.equal(results.filter(r=>r.status===429).length,7);
  assert.equal((await f.login()).status,429);
  assert.equal((await f.login(f.pass,'192.0.2.2')).status,303);
});
test('global attempt limit also applies when IPs change',async()=>{
  const f=fixture();
  for(let n=0;n<60;n++) assert.equal((await f.login('incorrect',`192.0.2.${n}`)).status,401);
  const r=await f.login(f.pass,'198.51.100.1');assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'900');
});
test('rate window expires; expired sessions and tampered signatures rejected',async()=>{
  const f=fixture();const oldNow=Date.now;let clock=oldNow();Date.now=()=>clock;
  try {
    for(let n=0;n<5;n++) await f.login('incorrect');
    assert.equal((await f.login()).status,429);clock+=901000;
    const r=await f.login();assert.equal(r.status,303);const original=cookieFrom(r);
    const tampered=original.slice(0,-1)+(original.endsWith('0')?'1':'0');
    assert.equal((await f.request('/my-chat/',{headers:{Cookie:tampered}})).status,401);
    clock+=28801000;assert.equal((await f.request('/my-chat/',{headers:{Cookie:original}})).status,401);
  } finally { Date.now=oldNow; }
});
test('CSRF, alternate host, missing settings, missing database and oversized body fail closed',async()=>{
  const f=fixture();
  assert.equal((await f.login(f.pass,'192.0.2.1',{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.login(f.pass,'192.0.2.1',{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await f.login('x'.repeat(1500))).status,413);
  assert.equal((await handleMyChat({request:new Request('https://preview.pages.dev/my-chat/'),env:f.env})).status,403);
  for(const k of Object.keys(f.env)) {
    const env={...f.env};delete env[k];
    assert.equal((await handleMyChat({request:new Request(origin+'/my-chat/'),env})).status,503);
  }
  f.sql.exec('DROP TABLE my_chat_sessions');
  assert.equal((await f.login()).status,503);
});
test('session rows alone cannot be forged and duplicate cookies rejected',async()=>{
  const f=fixture();const r=await f.login();const cookie=cookieFrom(r);
  assert.equal((await f.request('/my-chat/',{headers:{Cookie:cookie+'; '+cookie}})).status,401);
  f.env.MY_CHAT_SESSION_KEY=randomBytes(32).toString('hex');
  assert.equal((await f.request('/my-chat/',{headers:{Cookie:cookie}})).status,401);
});
