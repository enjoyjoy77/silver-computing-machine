'use strict';
(() => {
  const $ = s => document.querySelector(s);
  let chats = [], active = null, sequence = 0, busy = false, controller = null;
  let textKey = '', voiceKey = '', recorder = null, stream = null, recordingTimer, authTimer;
  let generation = 0, pending = false, lastAnswer = '', stopped = false, locked = false;
  const synth = window.speechSynthesis;
  const validKey = key => /^sk-[A-Za-z0-9_-]{20,240}$/.test(key);
  function status(text) { if (locked) return; $('#status').textContent = text; $('#voice-status').textContent = text; }
  function toast(text) { $('#toast').textContent = text; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 5000); }
  function closeMenu() { document.body.classList.remove('menu-open'); $('#menu').setAttribute('aria-expanded', 'false'); }
  function update() {
    if (locked) return;
    $('#send').disabled = busy || pending || !!recorder || !$('#prompt').value.trim();
    $('#new').disabled = busy || pending || !!recorder;
    $('#record').disabled = busy || pending || !!recorder;
    $('#finish-record').disabled = !recorder;
    $('#key-status').textContent = textKey ? '文字キー入力済み（未検証）' + (voiceKey ? '・音声キー入力済み' : '') : 'キー未入力';
    $('#connection').textContent = textKey ? 'キー入力済み' : 'キー未入力';
  }
  function render() {
    if (locked) return;
    $('#history').replaceChildren();
    for (const c of chats) {
      const b = document.createElement('button'); b.className = 'history-item' + (active === c.id ? ' active' : '');
      b.textContent = c.title; b.disabled = busy || !!recorder || pending;
      b.onclick = () => { active = c.id; render(); closeMenu(); }; $('#history').append(b);
    }
    const chat = chats.find(c => c.id === active); $('#welcome').hidden = !!chat; $('#messages').replaceChildren();
    for (const m of chat?.messages || []) {
      const el = document.createElement('div'); el.className = 'message ' + m.role;
      el.textContent = m.content; $('#messages').append(el);
    }
    $('#conversation').scrollTop = $('#conversation').scrollHeight; update();
  }
  function clearKeys() { textKey = ''; voiceKey = ''; $('#text-key').value = ''; $('#voice-key').value = ''; update(); }
  function stopRecording(discard = true) {
    if (discard) generation++;
    pending = false; clearTimeout(recordingTimer);
    const r = recorder; recorder = null;
    if (r?.state !== 'inactive') { try { r?.stop(); } catch {} }
    stream?.getTracks().forEach(t => t.stop()); stream = null; update();
  }
  function stop() {
    stopped = true; controller?.abort(); stopRecording(); synth?.cancel();
    status('停止しました。送信済みの処理には料金が発生する場合があります。');
  }
  function cleanup() { stop(); clearKeys(); chats = []; lastAnswer = ''; $('#prompt').value = ''; render(); }
  async function api(path, body, key, type, signal) {
    const response = await fetch('/api/my-chat/' + path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'Content-Type': type, 'X-My-Chat-Key': key }, body });
    if (response.status === 401) { lockScreen(); throw Error('ログインし直してください。'); }
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '送信できませんでした。');
    return data;
  }
  function conversationInput(chat, text) {
    const messages = [{ role: 'user', content: text }]; let length = text.length;
    for (const m of [...chat.messages].reverse()) {
      if (messages.length >= 20 || length + m.content.length > 16000 || m.content.length > 4000) break;
      messages.unshift({ role: m.role, content: m.content }); length += m.content.length;
    }
    return messages;
  }
  function speak() {
    if (!lastAnswer) return;
    if (!synth || !window.SpeechSynthesisUtterance) { toast('このブラウザーは読み上げに対応していません。回答は画面で読めます。'); return; }
    synth.cancel(); const utterance = new SpeechSynthesisUtterance(lastAnswer); utterance.lang = 'ja-JP';
    utterance.onerror = () => status('読み上げを開始できませんでした。「もう一度読む」を押してください。'); synth.speak(utterance);
  }
  async function send(text, readAloud = false) {
    if (!textKey) { $('#settings-dialog').showModal(); throw Error('設定で文字チャットのキーを入力してください。'); }
    if (!text.trim() || text.length > 4000) throw Error('文章は1〜4000文字にしてください。');
    if (/\bsk-[A-Za-z0-9_-]{12,}/.test(text)) throw Error('APIキーは会話に送らず、設定欄に入力してください。');
    let chat = chats.find(c => c.id === active);
    if (!chat) { chat = { id: ++sequence, title: text.slice(0, 25), messages: [] }; chats.unshift(chat); active = chat.id; }
    const messages = conversationInput(chat, text); status('回答を待っています…');
    const data = await api('chat', JSON.stringify({ messages }), textKey, 'application/json', controller.signal);
    if (stopped) return;
    chat.messages.push({ role: 'user', content: text }, { role: 'assistant', content: data.text });
    $('#prompt').value = ''; lastAnswer = data.text; render();
    status(data.truncated ? '回答が長いため上限で終了しました。' : '回答しました。'); if (readAloud) speak();
  }
  async function operation(run) {
    if (busy) return; busy = true; stopped = false; controller = new AbortController(); render();
    const timeout = setTimeout(() => controller?.abort(), 130000);
    try { await run(); }
    catch (e) { if (!stopped) status(e.name === 'AbortError' ? '時間切れになりました。自動再送はしていません。' : e.message); }
    finally { clearTimeout(timeout); busy = false; controller = null; render(); }
  }
  async function record() {
    if (busy || recorder || pending) return;
    if (!textKey || !voiceKey) { $('#voice-dialog').close(); $('#settings-dialog').showModal(); status('文字と音声入力のキーを設定してください。同じキーも使えます。'); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { status('このブラウザーでは録音できません。HTTPSのChrome・Edge・Safariで開いてください。'); return; }
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
    if (!mime) { status('対応する録音形式がありません。文字入力をご利用ください。'); return; }
    synth?.cancel(); const current = ++generation; pending = true; update(); status('マイクの許可を待っています…');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (current !== generation) { media.getTracks().forEach(t => t.stop()); return; }
      stream = media; const r = new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 64000 }); recorder = r;
      const chunks = []; let size = 0;
      r.ondataavailable = e => {
        size += e.data.size;
        if (size > 2 * 1024 * 1024) { stopRecording(); status('録音が大きすぎます。短く録り直してください。'); }
        else chunks.push(e.data);
      };
      r.onerror = () => { stopRecording(); status('録音に失敗しました。マイクの許可を確認してください。'); };
      r.onstop = () => {
        media.getTracks().forEach(t => t.stop()); if (current !== generation) return;
        recorder = null; stream = null; clearTimeout(recordingTimer); update();
        const blob = new Blob(chunks, { type: mime.split(';')[0] });
        if (!blob.size) { status('音声がありません。もう一度録音してください。'); return; }
        operation(async () => {
          status('音声を文字にしています…');
          const data = await api('transcribe', blob, voiceKey, blob.type, controller.signal);
          if (stopped) return; $('#prompt').value = data.text; await send(data.text, true);
        });
      };
      r.start(1000); pending = false; update(); recordingTimer = setTimeout(() => stopRecording(false), 60000);
      status('録音中（最大60秒）。「録音を終えて送信」でOpenAIへ送ります。');
    } catch { if (current === generation) { stopRecording(); status('マイクを開けませんでした。許可を確認して録音し直してください。'); } }
  }
  $('#composer').onsubmit = e => { e.preventDefault(); if (!recorder && !pending) operation(() => send($('#prompt').value.trim())); };
  $('#prompt').oninput = update;
  $('#prompt').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!$('#send').disabled) $('#composer').requestSubmit(); } };
  $('#new').onclick = () => { if (busy || recorder || pending) return; synth?.cancel(); active = null; $('#prompt').value = ''; render(); closeMenu(); };
  $('.brand').onclick = e => { e.preventDefault(); $('#new').click(); };
  $('#menu').onclick = () => { document.body.classList.toggle('menu-open'); $('#menu').setAttribute('aria-expanded', document.body.classList.contains('menu-open')); };
  $('#veil').onclick = closeMenu;
  document.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => { if (!busy) { $('#prompt').value = b.dataset.prompt; update(); $('#prompt').focus(); } });
  $('#settings').onclick = () => { closeMenu(); $('#settings-dialog').showModal(); };
  $('#apply-keys').onclick = () => {
    if (busy || recorder || pending) { toast('先に送信・録音を停止してください。'); return; }
    const t = $('#text-key').value.trim(), v = $('#voice-key').value.trim();
    if ((t && !validKey(t)) || (v && !validKey(v))) { toast('キーの形式を確認してください。'); return; }
    if (t) textKey = t; if (v) voiceKey = v;
    $('#text-key').value = ''; $('#voice-key').value = ''; update(); toast('このタブで使用します。まだAPIには送信していません。');
  };
  $('#forget-keys').onclick = () => { stop(); clearKeys(); toast('キーを消去しました。'); };
  $('#clear').onclick = () => { stop(); chats = []; active = null; lastAnswer = ''; $('#prompt').value = ''; render(); };
  $('#theme').onchange = e => document.body.classList.toggle('dark', e.target.value === 'dark');
  $('#voice').onclick = () => $('#voice-dialog').showModal();
  $('#record').onclick = record; $('#finish-record').onclick = () => stopRecording(false);
  $('#stop').onclick = stop; $('#voice-stop').onclick = stop; $('#read-again').onclick = speak;
  document.querySelectorAll('.close').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('#voice-dialog').addEventListener('close', () => { if (recorder || pending || busy) stop(); synth?.cancel(); });
  $('#logout').addEventListener('submit', cleanup);
  window.addEventListener('pagehide', cleanup);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopRecording(); synth?.cancel(); } else checkSession(); });
  function lockScreen() { if (locked) return; cleanup(); locked = true; document.body.replaceChildren(); location.replace('/my-chat/'); }
  async function checkSession() {
    try {
      const r = await fetch('/my-chat/session', { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) throw Error(); const { expires } = await r.json(); clearTimeout(authTimer);
      authTimer = setTimeout(lockScreen, Math.max(0, expires * 1000 - Date.now()));
    } catch { lockScreen(); }
  }
  window.addEventListener('pageshow', checkSession); setInterval(checkSession, 60000); render();
})();
