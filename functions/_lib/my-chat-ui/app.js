'use strict';
(() => {
  const $ = s => document.querySelector(s);
  let chats = [], active = null, sequence = 0, busy = false, controller = null;
  let apiKey = '', recorder = null, stream = null, recordingTimer, authTimer;
  let generation = 0, pending = false, lastAnswer = '', stopped = false, locked = false;
  let attachment = null, attachmentGeneration = 0, attachmentLoading = false;
  const mode = () => $('#mode').value || 'chat';
  const synth = window.speechSynthesis;
  const validKey = key => /^sk-[A-Za-z0-9_-]{20,240}$/.test(key);
  function status(text) { if (locked) return; $('#status').textContent = text; $('#voice-status').textContent = text; }
  function toast(text) { $('#toast').textContent = text; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 5000); }
  function closeMenu() { document.body.classList.remove('menu-open'); $('#menu').setAttribute('aria-expanded', 'false'); }
  function update() {
    if (locked) return;
    $('#send').disabled = busy || pending || !!recorder || attachmentLoading || !$('#prompt').value.trim();
    $('#new').disabled = busy || pending || !!recorder;
    $('#record').disabled = busy || pending || !!recorder;
    $('#finish-record').disabled = !recorder;
    $('#key-status').textContent = apiKey ? '共通キー入力済み・対応する全機能に使用（未検証）' : 'キー未入力';
    $('#connection').textContent = apiKey ? 'キー入力済み' : 'キー未入力';
    $('#mode').disabled = busy || pending || !!recorder;
    $('#attach').disabled = busy || pending || !!recorder;
    const special = mode() !== 'chat' || !!attachment;
    $('#consent-row').hidden = !special;
    $('#send-details').textContent = mode() === 'image' || mode() === 'edit'
      ? '画像APIに指示' + (attachment ? 'と添付画像' : '') + 'を送信します。別途画像料金。1024px・下書き品質・1枚。全体で1日10回まで。'
      : mode() === 'web' ? 'この会話をOpenAIへ送り、公開Webを検索します。検索1回あたり$0.01＋文章料金。全体で1日30回まで。'
      : attachment ? '添付「' + attachment.name + '」を今回だけOpenAIへ送信します。内容に応じた入力料金が追加されます。アプリには保存しません。' : '';
  }
  function appendAnswer(el, m) {
    const citations=[...(m.citations||[])].sort((a,b)=>a.start-b.start);let offset=0;
    for (const c of citations) {
      if (!Number.isInteger(c.start)||!Number.isInteger(c.end)||c.start<offset||c.end>m.content.length||c.end<=c.start) continue;
      let url;try {url=new URL(c.url);}catch {continue;}
      if (!['https:','http:'].includes(url.protocol)||url.username||url.password) continue;
      el.append(document.createTextNode(m.content.slice(offset,c.start)));
      const link=document.createElement('a');link.href=url.href;link.textContent=m.content.slice(c.start,c.end);link.title=c.title;link.target='_blank';link.rel='noopener noreferrer';el.append(link);offset=c.end;
    }
    el.append(document.createTextNode(m.content.slice(offset)));
    if (typeof m.image === 'string' && m.image.length <= 15000022 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(m.image)) {
      const img=document.createElement('img');img.src=m.image;img.alt='生成した画像';el.append(img);
      const link=document.createElement('a');link.href=m.image;link.download='my-chat-image.png';link.textContent='画像をダウンロード';el.append(link);
    }
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
      if (m.citations?.length || m.image) appendAnswer(el,m); else el.textContent = m.content;
      $('#messages').append(el);
    }
    $('#conversation').scrollTop = $('#conversation').scrollHeight; update();
  }
  function clearKeys() { apiKey = ''; $('#api-key').value = ''; update(); }
  function stopRecording(discard = true) {
    if (discard) generation++;
    pending = false; clearTimeout(recordingTimer);
    const r = recorder; recorder = null;
    if (r?.state !== 'inactive') { try { r?.stop(); } catch {} }
    stream?.getTracks().forEach(t => t.stop()); stream = null; update();
  }
  function stop() {
    stopped = true; controller?.abort(); stopRecording(); synth?.cancel();
    if (attachmentLoading) clearAttachment();
    status('停止しました。送信済みの処理には料金が発生する場合があります。');
  }
  function clearAttachment() { attachment=null;attachmentLoading=false;attachmentGeneration++;$('#file').value='';$('#attachment-preview').replaceChildren();$('#send-consent').checked=false;update(); }
  function cleanup() { stop(); clearKeys(); clearAttachment(); chats = []; lastAnswer = ''; $('#prompt').value = ''; render(); }
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
    const budget=16000-(attachment?.kind === 'text' ? attachment.text.length : 0);
    for (const m of [...chat.messages].reverse()) {
      if (messages.length >= 20 || length + m.content.length > budget || m.content.length > 4000) break;
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
    if (attachmentLoading) throw Error('添付の読み込みが終わるまで待ってください。');
    if (!apiKey) { $('#settings-dialog').showModal(); throw Error('設定で共通APIキーを入力してください。'); }
    if (!text.trim() || text.length > 4000) throw Error('文章は1〜4000文字にしてください。');
    if (/\bsk-[A-Za-z0-9_-]{12,}/.test(text)) throw Error('APIキーは会話に送らず、設定欄に入力してください。');
    const selected=mode();
    if ((selected !== 'chat' || attachment) && !$('#send-consent').checked) throw Error('送信内容と料金を確認し、チェックを入れてください。');
    if (selected === 'web' && attachment) throw Error('添付ファイルを外してからWeb検索してください。');
    if (selected === 'image' && attachment) throw Error('新しく画像を作る場合は添付を外してください。編集する場合は「画像編集」を選んでください。');
    if (selected === 'edit' && attachment?.kind !== 'image') throw Error('編集する画像を1枚添付してください。');
    if ((selected === 'image'||selected === 'edit') && text.length > 2000) throw Error('画像の指示は2000文字以内にしてください。');
    let chat = chats.find(c => c.id === active);
    if (!chat) { chat = { id: ++sequence, title: text.slice(0, 25), messages: [] }; chats.unshift(chat); active = chat.id; }
    const messages = conversationInput(chat, text); status(selected === 'image'||selected === 'edit' ? '画像を作っています（最大3分）…' : '回答を待っています…');
    const imageRequest=selected === 'image'||selected === 'edit';
    const payload=imageRequest ? {prompt:text,consent:true,...(selected === 'edit' ? {image:attachment.data} : {})} : {messages,...(selected === 'web' ? {web:true,consent:true} : {}),...(attachment ? {attachment,consent:true} : {})};
    const data = await api(imageRequest?'image':'chat', JSON.stringify(payload), apiKey, 'application/json', controller.signal);
    if (stopped) return;
    chat.messages.push({ role: 'user', content: text+(attachment?'\n[添付: '+attachment.name+']':'') }, { role: 'assistant', content: data.text, citations:data.citations, image:data.image });
    clearAttachment();$('#send-consent').checked=false;$('#prompt').value = ''; lastAnswer = data.text; render();
    status(data.truncated ? '回答が長いため上限で終了しました。' : '回答しました。'); if (readAloud) speak();
  }
  async function operation(run) {
    if (busy) return; busy = true; stopped = false; controller = new AbortController(); render();
    const timeout = setTimeout(() => controller?.abort(), 200000);
    try { await run(); }
    catch (e) { if (!stopped) status(e.name === 'AbortError' ? '時間切れになりました。自動再送はしていません。' : e.message); }
    finally { clearTimeout(timeout); busy = false; controller = null; render(); }
  }
  async function record() {
    if (busy || recorder || pending) return;
    if (mode() !== 'chat' || attachment || attachmentLoading) { status('音声は「文字会話」で、添付を外してから利用してください。');return; }
    if (!apiKey) { $('#voice-dialog').close(); $('#settings-dialog').showModal(); status('設定で共通APIキーを1回入力すると、文字と音声に使えます。'); return; }
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
          const data = await api('transcribe', blob, apiKey, blob.type, controller.signal);
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
  $('#new').onclick = () => { if (busy || recorder || pending) return; synth?.cancel(); active = null; clearAttachment();$('#prompt').value = ''; render(); closeMenu(); };
  $('.brand').onclick = e => { e.preventDefault(); $('#new').click(); };
  $('#menu').onclick = () => { document.body.classList.toggle('menu-open'); $('#menu').setAttribute('aria-expanded', document.body.classList.contains('menu-open')); };
  $('#veil').onclick = closeMenu;
  document.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => { if (!busy) { $('#prompt').value = b.dataset.prompt; update(); $('#prompt').focus(); } });
  $('#settings').onclick = () => { closeMenu(); $('#settings-dialog').showModal(); };
  $('#apply-keys').onclick = () => {
    if (busy || recorder || pending) { toast('先に送信・録音を停止してください。'); return; }
    const key = $('#api-key').value.trim();
    if (!validKey(key)) { toast('キーの形式を確認してください。'); return; }
    apiKey = key;
    $('#api-key').value = ''; update(); toast('このタブで使用します。まだAPIには送信していません。');
  };
  $('#forget-keys').onclick = () => { stop(); clearKeys(); toast('キーを消去しました。'); };
  $('#clear').onclick = () => { stop(); clearAttachment();chats = []; active = null; lastAnswer = ''; $('#prompt').value = ''; render(); };
  $('#mode').onchange = () => {$('#send-consent').checked=false;update();};
  $('#attach').onclick = () => $('#file').click();
  $('#file').onchange = async () => {
    const file=$('#file').files[0]; if (!file || busy) return;
    clearAttachment();const ticket=attachmentGeneration;attachmentLoading=true;update();
    try {
      let next;
      if (['image/png','image/jpeg','image/webp'].includes(file.type)) {
        if (file.size>5*1024*1024) throw Error('元画像は5MB以内にしてください。');
        const data=await new Promise((resolve,reject)=>{
          const url=URL.createObjectURL(file),image=new Image();
          image.onload=()=>{try {const scale=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/png'));}catch {reject(Error('画像を変換できません。'));}finally {URL.revokeObjectURL(url);}};
          image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('画像を開けません。'));};image.src=url;
        });
        if (data.length>2800000) throw Error('変換後の画像が2MBを超えます。小さな画像を選んでください。');
        next={kind:'image',name:file.name.slice(0,100),data};
      } else {
        if (!/\.(txt|md|csv|json)$/i.test(file.name)||file.size>24000) throw Error('添付は画像、または24KB以内のTXT・MD・CSV・JSONです。PDFはまだ未対応です。');
        const text=await file.text();if (!text.trim()||text.length>8000||text.includes('\0')) throw Error('テキストはUTF-8・8000文字以内にしてください。');
        if (/\bsk-[A-Za-z0-9_-]{12,}/.test(text)) throw Error('APIキーを含むファイルは送信しないでください。');
        next={kind:'text',name:file.name.slice(0,100),text};
      }
      if (ticket!==attachmentGeneration||locked) return;
      attachment=next;$('#send-consent').checked=false;const label=document.createElement('span');label.textContent=next.name+(next.kind==='image'?'（最大1024pxに変換）':'（'+next.text.length+'文字）');
      const remove=document.createElement('button');remove.type='button';remove.textContent='添付を外す';remove.onclick=()=>{if(!busy)clearAttachment();};$('#attachment-preview').append(label,remove);update();
    } catch(e) {if(ticket===attachmentGeneration)status(e.message);}
    finally {if(ticket===attachmentGeneration){attachmentLoading=false;update();}}
  };
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
