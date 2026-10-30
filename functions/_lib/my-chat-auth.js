// Dedicated My Chat authentication. Provider calls run only after this session guard.
import { assets } from './my-chat-assets.js';
import { handleMyChatApi } from './my-chat-api.js';

const ORIGIN = 'https://silver-computing-machine-7ql.pages.dev';
const COOKIE = '__Host-my_chat';
const TTL = 8 * 60 * 60;
const WINDOW = 15 * 60;
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
const validHex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function response(body, status = 200, type = 'text/html; charset=utf-8', extra = {}) {
  return new Response(body, { status, headers: {
    'Content-Type': type, 'Cache-Control': 'no-store, private',
    // no-referrer makes HTML form POSTs send Origin: null, failing our CSRF guard.
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex, noarchive, nofollow',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
    ...extra,
  }});
}
const json = (status, error) => response(JSON.stringify({ error }), status, 'application/json; charset=utf-8');
const cookie = (value, age) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
function loginPage(message = '') {
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>マイチャットに入る</title><style>body{font-family:system-ui,sans-serif;background:#f6f5f1;color:#292929;margin:0;padding:24px}main{max-width:420px;margin:12vh auto;background:white;padding:32px;border-radius:20px}h1{font-size:24px}label,input,button{display:block;box-sizing:border-box;width:100%}input,button{font:inherit;padding:14px;margin:16px 0;border:1px solid #ccc;border-radius:10px}button{background:#245c49;color:white;cursor:pointer}p{line-height:1.7}a{color:#245c49}</style><main><h1>マイチャット</h1><p>専用の合言葉で入ってください。<br>ログインは8時間で切れます。</p><p role="status">${message}</p><form method="post" action="/my-chat/login"><label for="passphrase">合言葉</label><input id="passphrase" name="passphrase" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">入る</button></form><p>個人用チャット・APIキーはログイン後の設定から入力</p><a href="/">ツールボックスに戻る</a></main></html>`;
}
async function keyFor(env) {
  return crypto.subtle.importKey('raw', encoder.encode(env.MY_CHAT_SESSION_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function mac(key, value) {
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function unhex(value) { return Uint8Array.from(value.match(/../g), x => parseInt(x, 16)); }
async function session(request, db, key, now) {
  const values = (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).filter(x => x.startsWith(COOKIE + '='));
  if (values.length !== 1) return null;
  const token = values[0].slice(COOKIE.length + 1);
  const parts = token.split('.');
  if (parts.length !== 3 || !validHex(parts[0]) || !/^\d{10}$/.test(parts[1]) || !validHex(parts[2])) return null;
  const [id, exp, sig] = parts;
  if (Number(exp) <= now || Number(exp) > now + TTL) return null;
  if (!await crypto.subtle.verify('HMAC', key, unhex(sig), encoder.encode(`${ORIGIN}|${id}.${exp}`))) return null;
  return await db.prepare('SELECT id, expires FROM my_chat_sessions WHERE id = ? AND expires = ? AND expires > ?').bind(id, Number(exp), now).first();
}
async function boundedBody(request) {
  if (Number(request.headers.get('content-length')) > 1024) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  let size = 0; const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1024) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size); let pos = 0;
  for (const chunk of chunks) { all.set(chunk, pos); pos += chunk.length; }
  return new TextDecoder().decode(all);
}
async function allowAttempt(request, db, key, now) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) throw new Error('Missing trusted edge IP');
  const bucket = Math.floor(now / WINDOW);
  const ipKey = await mac(key, `login-ip|${ip}`);
  const sql = 'INSERT INTO my_chat_attempts (id, bucket, count) VALUES (?, ?, 1) ON CONFLICT(id, bucket) DO UPDATE SET count = MIN(count + 1, 1000000) RETURNING count';
  const results = await db.batch([
    db.prepare(sql).bind(ipKey, bucket), db.prepare(sql).bind('global', bucket),
    db.prepare('DELETE FROM my_chat_attempts WHERE bucket < ?').bind(bucket - 1),
    db.prepare('DELETE FROM my_chat_sessions WHERE expires <= ?').bind(now),
  ]);
  return results[0].results[0].count <= 5 && results[1].results[0].count <= 60;
}

export async function handleMyChat({ request, env }) {
  const url = new URL(request.url);
  const api = url.pathname.startsWith('/api/my-chat');
  try {
    if (url.origin !== ORIGIN) return json(403, 'この公開URLでは利用できません');
    if (!validHex(env.MY_CHAT_AUTH_VERIFIER) || !validHex(env.MY_CHAT_SESSION_KEY) || !env.MY_CHAT_AUTH_DB) {
      return response('<!doctype html><html lang="ja"><meta charset="utf-8"><title>マイチャット 設定待ち</title><h1>マイチャットは設定待ちです</h1><p>認証の準備ができるまで入れません。APIは未接続です。</p><a href="/">ツールボックスに戻る</a></html>', 503);
    }
    // Read the primary so revocations are visible even if D1 read replication is enabled.
    const binding = env.MY_CHAT_AUTH_DB;
    const db = binding.withSession ? binding.withSession('first-primary') : binding;
    const key = await keyFor(env);
    const now = Math.floor(Date.now() / 1000);
    const method = request.method;
    const path = url.pathname.replace(/\/+$/, '');
    if (!['GET', 'HEAD', 'POST'].includes(method)) return json(405, 'Method not allowed');
    if (method === 'POST' && (request.headers.get('Origin') !== ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site')) return json(403, '送信元が一致しません');
    if (!api && path === '/my-chat/login' && method === 'POST') {
      if (!await allowAttempt(request, db, key, now)) return response(loginPage('試行回数が多いため、15分待ってから再試行してください。'), 429, undefined, { 'Retry-After': String(WINDOW) });
      if (!(request.headers.get('Content-Type') || '').startsWith('application/x-www-form-urlencoded')) return json(415, 'Unsupported content type');
      const body = await boundedBody(request);
      if (body === null) return json(413, '入力が長すぎます');
      const fields = new URLSearchParams(body);
      const pass = fields.get('passphrase') || '';
      // Generated passphrases have 384 bits of entropy; SHA-256 verifier never stores the passphrase.
      const candidate = await digest(pass);
      // Compare through HMAC verification (constant-time implementation).
      const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(env.MY_CHAT_AUTH_VERIFIER));
      const matched = await crypto.subtle.verify('HMAC', key, expected, encoder.encode(candidate));
      if (fields.getAll('passphrase').length !== 1 || pass.length < 32 || pass.length > 256 || !matched) return response(loginPage('合言葉を確認してください。'), 401);
      const id = random(); const expires = now + TTL;
      await db.prepare('INSERT INTO my_chat_sessions (id, expires) VALUES (?, ?)').bind(id, expires).run();
      const token = `${id}.${expires}.${await mac(key, `${ORIGIN}|${id}.${expires}`)}`;
      return response(null, 303, undefined, { Location: '/my-chat/', 'Set-Cookie': cookie(token, TTL) });
    }
    const current = await session(request, db, key, now);
    if (!api && path === '/my-chat/logout' && method === 'POST') {
      if (current) await db.prepare('DELETE FROM my_chat_sessions WHERE id = ?').bind(current.id).run();
      return response(null, 303, undefined, { Location: '/my-chat/', 'Set-Cookie': cookie('', 0), 'Clear-Site-Data': '"cache"' });
    }
    if (!current) {
      if (!api && (path === '/my-chat' || path === '/my-chat/login') && (method === 'GET' || method === 'HEAD')) return response(method === 'HEAD' ? null : loginPage(), 401);
      return json(401, 'ログインしてください');
    }
    if (api) return handleMyChatApi(request, db, current);
    if (method !== 'GET' && method !== 'HEAD') return json(405, 'Method not allowed');
    if (path === '/my-chat/session') return response(JSON.stringify({ expires: current.expires }), 200, 'application/json');
    if (path === '/my-chat' && url.pathname !== '/my-chat/') return response(null, 308, undefined, { Location: '/my-chat/' });
    const name = path === '/my-chat' ? 'index.html' : path.slice('/my-chat/'.length);
    const asset = assets[name];
    if (!Object.hasOwn(assets, name) || !asset) return json(404, 'Not found');
    return response(method === 'HEAD' ? null : asset.body, 200, asset.type);
  } catch {
    // Never log credentials, cookies, request bodies, or database errors.
    return json(503, '認証を確認できないため、現在は入れません');
  }
}
