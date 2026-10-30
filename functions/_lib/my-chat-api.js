// Keys live only in the incoming request and the fixed upstream request.
// Never log request bodies, Authorization headers, or upstream error bodies.
const ROOT = 'https://api.openai.com/v1/';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
const result = (status, body) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
export const LIMITS = { text: 4000, context: 16000, messages: 20, audio: 2 * 1024 * 1024, output: 1200 };

async function readBounded(request, max) {
  if (Number(request.headers.get('content-length')) > max) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new Error('size'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function acquire(db, sid, now) {
  const token = crypto.getRandomValues(new Uint32Array(1))[0];
  const lock = await db.prepare(`INSERT INTO my_chat_api_control (id, bucket, count) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET bucket=excluded.bucket, count=excluded.count
    WHERE my_chat_api_control.bucket <= ? RETURNING count`).bind('lock:' + sid, now + 75, token, now).first();
  return lock ? token : null;
}
async function allowance(db, sid, now) {
  const bump = `INSERT INTO my_chat_api_control (id, bucket, count) VALUES (?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET bucket=excluded.bucket,
    count=CASE WHEN my_chat_api_control.bucket=excluded.bucket THEN MIN(my_chat_api_control.count+1,1000000) ELSE 1 END RETURNING count`;
  const rows = await db.batch([
    db.prepare(bump).bind('minute:' + sid, Math.floor(now / 60)),
    db.prepare(bump).bind('day:global', Math.floor(now / 86400)),
    db.prepare('DELETE FROM my_chat_api_control WHERE (id LIKE ? AND bucket < ?) OR (id LIKE ? AND bucket < ?)').bind('lock:%', now - 86400, 'minute:%', Math.floor(now / 60) - 1440),
  ]);
  return rows[0].results[0].count <= 6 && rows[1].results[0].count <= 100;
}

export async function handleMyChatApi(request, db, current, upstreamFetch = fetch) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (!['/api/my-chat/chat', '/api/my-chat/transcribe'].includes(path)) return result(404, { error: 'このAPIはありません。' });
  if (request.method !== 'POST') return result(405, { error: 'POSTで送信してください。' });
  const key = request.headers.get('X-My-Chat-Key') || '';
  if (!/^sk-[A-Za-z0-9_-]{20,240}$/.test(key)) return result(400, { error: '設定でOpenAIのAPIキーを入力してください。' });
  let body, endpoint, headers = { Authorization: 'Bearer ' + key };
  try {
    if (path.endsWith('/chat')) {
      if (!request.headers.get('content-type')?.startsWith('application/json')) return result(415, { error: 'JSONで送信してください。' });
      const data = JSON.parse(new TextDecoder().decode(await readBounded(request, 80000)));
      const messages = data.messages;
      if (!Array.isArray(messages) || !messages.length || messages.length > LIMITS.messages || messages.at(-1)?.role !== 'user' ||
          messages.some(m => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > LIMITS.text) ||
          messages.reduce((n, m) => n + m.content.length, 0) > LIMITS.context) return result(400, { error: '文章は1件4000文字、会話は合計16000文字以内で送信してください。' });
      body = JSON.stringify({ model: 'gpt-5.4-mini', input: messages.map(m => ({ role: m.role, content: m.content })), store: false,
        reasoning: { effort: 'none' }, max_output_tokens: LIMITS.output,
        instructions: 'ユーザーの言語で、役立つ回答を簡潔に返してください。' });
      headers['Content-Type'] = 'application/json'; endpoint = 'responses';
    } else {
      const mime = (request.headers.get('content-type') || '').split(';')[0];
      const extensions = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/wav': 'wav' };
      if (!extensions[mime]) return result(415, { error: 'この録音形式は利用できません。' });
      const bytes = await readBounded(request, LIMITS.audio);
      if (!bytes.length) return result(400, { error: '録音が空です。' });
      body = new FormData(); body.set('model', 'gpt-transcribe');
      body.set('file', new Blob([bytes], { type: mime }), 'recording.' + extensions[mime]); endpoint = 'audio/transcriptions';
    }
  } catch (e) { return result(e.message === 'size' ? 413 : 400, { error: '送信内容が大きすぎるか、形式が正しくありません。' }); }

  let token = null;
  let stage = 'database';
  const now = Math.floor(Date.now() / 1000);
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 60000);
  try {
    if (request.signal.aborted) return result(499, { error: '送信を停止しました。' });
    token = await acquire(db, current.id, now);
    if (token === null) return result(409, { error: '前の送信を処理中です。少し待ってから送信してください。' });
    if (!await allowance(db, current.id, now)) return result(429, { error: '利用上限です。1分6回・サイト全体で1日100回までです（音声入力も1回）。' });
    // Recheck revocation immediately before spending any API credits.
    const live = await db.prepare('SELECT id FROM my_chat_sessions WHERE id = ? AND expires > ?').bind(current.id, Math.floor(Date.now() / 1000)).first();
    if (!live || controller.signal.aborted) return result(401, { error: 'ログインし直してください。' });
    stage = 'upstream';
    // Workers supports manual/follow, not error. Never forward keys to redirects.
    const response = await upstreamFetch(ROOT + endpoint, { method: 'POST', headers, body, redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return result(502, { error: '接続先から転送を要求されたため停止しました。自動再送はしていません。', code: 'UPSTREAM_REDIRECT' });
    }
    if (!response.ok) {
      await response.body?.cancel();
      const error = response.status === 401 || response.status === 403 ? 'APIキー・利用権限を確認してください。' : response.status === 429 ? 'OpenAIの利用枠または混雑による制限です。残高や上限を確認してください。' : 'OpenAIへの接続に失敗しました。自動再送はしていません。';
      return result(response.status === 429 ? 429 : 502, { error });
    }
    stage = 'response';
    const data = await response.json();
    const text = endpoint === 'responses' ? (data.output || []).flatMap(x => x.type === 'message' ? x.content || [] : []).filter(x => x.type === 'output_text').map(x => x.text).join('\n') : data.text;
    if (typeof text !== 'string' || !text.trim()) return result(502, { error: '回答を取得できませんでした。自動再送はしていません。' });
    return result(200, { text: text.slice(0, endpoint === 'responses' ? 8000 : LIMITS.text), truncated: data.status === 'incomplete' });
  } catch {
    if (controller.signal.aborted) return result(504, { error: '送信を停止したか、応答が時間切れになりました。処理済み分の料金が発生する場合があります。', code: 'REQUEST_ABORTED' });
    const errors = {
      database: ['利用制限データベースを確認できません。送信していません。（DB_CONTROL）', 'DB_CONTROL'],
      upstream: ['OpenAIへの接続処理に失敗しました。自動再送はしていません。（UPSTREAM_CONNECT）', 'UPSTREAM_CONNECT'],
      response: ['OpenAIからの応答を読み取れませんでした。自動再送はしていません。（UPSTREAM_RESPONSE）', 'UPSTREAM_RESPONSE'],
    };
    const [error, code] = errors[stage];
    return result(stage === 'response' ? 502 : 503, { error, code });
  } finally {
    clearTimeout(timer); request.signal.removeEventListener('abort', abort);
    if (token !== null) { try { await db.prepare('DELETE FROM my_chat_api_control WHERE id = ? AND count = ?').bind('lock:' + current.id, token).run(); } catch { /* expires automatically */ } }
  }
}
