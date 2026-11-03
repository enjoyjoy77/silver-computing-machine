'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const modelIds=['gpt-5.4-mini','gpt-5.4','gpt-6-luna','gpt-6.1-sol'];
  const modelPreference='my-chat.text-model.v1';
  let selectedModel='gpt-5.4-mini';
  try { const saved=window.localStorage.getItem(modelPreference);if(modelIds.includes(saved))selectedModel=saved; } catch { /* storage may be unavailable */ }
  $('#model').value=selectedModel;
  let chats = [], active = null, sequence = 0, busy = false, controller = null;
  let serverKeyReady=false;
  const keyAvailable=()=>serverKeyReady || !!apiKey;
  let apiKey = '', recorder = null, stream = null, recordingTimer, authTimer;
  let generation = 0, pending = false, lastAnswer = '', stopped = false, locked = false;
  let attachment = null, attachmentGeneration = 0, attachmentLoading = false;
  let attachmentController=null, speechAudio=null, speechURL=null;
  let authState='unknown', knownExpires=0, sessionEpoch=0, sessionRequest=null, sessionController=null;
  const sessionReady=()=>!locked && authState==='verified' && knownExpires>Date.now();
  function requireSession(){
    if(knownExpires && knownExpires<=Date.now())lockScreen();
    if(!sessionReady())throw Error('ログイン状態を確認できるまで送信を停止しています。「接続を再確認」を押してください。');
  }
  const mode = () => $('#mode').value || 'chat';
  const synth = window.speechSynthesis;
  const validKey = key => /^sk-[A-Za-z0-9_-]{20,240}$/.test(key);
  function status(text) { if (locked) return; $('#status').textContent = text; $('#voice-status').textContent = text; }
  function toast(text) { $('#toast').textContent = text; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 5000); }
  function closeMenu() { document.body.classList.remove('menu-open'); $('#menu').setAttribute('aria-expanded', 'false'); }
  function update() {
    if (locked) return;
    $('#send').disabled = !sessionReady() || busy || pending || !!recorder || attachmentLoading || !$('#prompt').value.trim();
    $('#new').disabled = busy || pending || !!recorder;
    $('#record').disabled = !sessionReady() || busy || pending || !!recorder;
    $('#api-read').disabled = !sessionReady() || busy || pending || !!recorder;
    $('#api-key').disabled=serverKeyReady;
    $('#apply-keys').disabled = serverKeyReady || !sessionReady() || busy || pending || !!recorder;
    $('#auth-retry').disabled = authState==='checking';
    $('#auth-status').textContent = authState==='verified' ? '' : authState==='checking' ? 'ログイン状態を確認中です。送信は一時停止しています。' : '接続を確認できません。送信を停止しています。接続を再確認してください。';
    $('#auth-retry').hidden = authState==='verified';
    $('#finish-record').disabled = !recorder;
    $('#key-status').textContent = serverKeyReady ? 'サーバーキー設定済み・入力不要' : apiKey ? '共通キー入力済み・対応する全機能に使用（未検証）' : 'キー未入力';
    $('#connection').textContent = serverKeyReady ? 'サーバーキー設定済み' : apiKey ? 'キー入力済み' : 'キー未入力';
    $('#mode').disabled = busy || pending || !!recorder;
    $('#model').disabled = busy || pending || !!recorder;
    $('#attach').disabled = busy || pending || !!recorder;
    const special = mode() !== 'chat' || !!attachment;
    $('#consent-row').hidden = !special;
    $('#send-details').textContent = mode() === 'image' || mode() === 'edit'
      ? '画像APIに指示' + (attachment ? 'と添付画像' : '') + 'を送信します。別途画像料金。1024px・下書き品質・1枚。全体で1日10回まで。'
      : mode() === 'web' ? 'この会話をOpenAIへ送り、公開Webを検索します。検索1回あたり$0.01＋文章料金。全体で1日30回まで。'
      : attachment ? '添付「' + attachment.name + '」を今回だけOpenAIへ送信します。内容に応じた入力料金が追加されます。アプリには保存しません。' : '';
  }
  const historyKey='my-chat.history.v1', historyLimit=4*1024*1024;
  let historyLoaded=false, historyBlocked=false;
  const historyStatus=text=>{$('#history-status').textContent=text;};
  function historySnapshot(raw){
    if(!raw || raw.version!==1 || !Array.isArray(raw.chats) || raw.chats.length>100)throw Error('history');
    let count=0;const ids=new Set();
    const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw Error('history');return v.replace(/\bsk-[A-Za-z0-9_-]{12,}/g,'[API key removed]');};
    return {version:1,chats:raw.chats.map(c=>{
      if(!Number.isSafeInteger(c.id)||c.id<1||ids.has(c.id)||!Array.isArray(c.messages))throw Error('history');ids.add(c.id);
      return {id:c.id,title:text(c.title,100),messages:c.messages.map(m=>{
        if(++count>2000||!['user','assistant'].includes(m.role))throw Error('history');
        const out={role:m.role,content:text(m.content,100000)};
        if(m.image!==undefined){if(typeof m.image!=='string'||m.image.length>15000022||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(m.image))throw Error('history');out.image=m.image;}
        if(m.citations!==undefined){if(!Array.isArray(m.citations)||m.citations.length>100)throw Error('history');out.citations=m.citations.map(c=>{
          const url=new URL(c.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>2000||/sk-[A-Za-z0-9_-]{12,}/.test(url.href))throw Error('history');
          if(!Number.isInteger(c.start)||!Number.isInteger(c.end)||c.start<0||c.end>out.content.length||c.start>=c.end)throw Error('history');
          return {start:c.start,end:c.end,url:url.href,title:text(c.title||'',500)};
        });}return out;
      })};
    })};
  }
  function restoreHistory(){
    if(historyLoaded||!sessionReady())return;historyLoaded=true;
    try{const raw=window.localStorage.getItem(historyKey);if(raw){if(raw.length*2>historyLimit)throw Error('size');chats=historySnapshot(JSON.parse(raw)).chats;sequence=Math.max(sequence,...chats.map(c=>c.id));active=chats[0]?.id||null;}
      historyStatus('履歴はこのブラウザー内に保存します。');render();
    }catch{historyBlocked=true;historyStatus('履歴を読み込めません。保存済みデータは変更していません。ブラウザー設定を確認するか、履歴を削除してください。');}
  }
  function saveHistory(){
    if(!sessionReady()||!historyLoaded||historyBlocked)return;
    try{const data=JSON.stringify(historySnapshot({version:1,chats}));if(data.length*2>historyLimit)throw Error('size');window.localStorage.setItem(historyKey,data);historyStatus('このブラウザーに保存済み');}
    catch{historyStatus('履歴を保存できませんでした（容量・保存設定・内容を確認）。以前の保存分は残っています。この会話はタブを閉じると失われる場合があります。');}
  }
  window.addEventListener('storage',e=>{if(e.key===historyKey||e.key===null){historyBlocked=true;historyStatus('別のタブで履歴が変更されました。上書きを防ぐため保存を停止しました。再読み込みしてください。');}});
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
    clearSpeech();
    if (attachmentLoading) clearAttachment();
    status('停止しました。送信済みの処理には料金が発生する場合があります。');
  }
  function clearAttachment() { attachmentController?.abort();attachmentController=null;attachment=null;attachmentLoading=false;attachmentGeneration++;$('#file').value='';$('#attachment-preview').replaceChildren();$('#send-consent').checked=false;update(); }
  function clearSpeech(){speechAudio?.pause();if(speechAudio)speechAudio.src='';speechAudio=null;if(speechURL)URL.revokeObjectURL(speechURL);speechURL=null;}
  function cleanup() { sessionEpoch++;sessionController?.abort();sessionController=null;sessionRequest=null;authState='unknown';knownExpires=0;serverKeyReady=false;historyLoaded=false;historyBlocked=false;clearTimeout(authTimer);stop(); clearKeys(); clearAttachment(); chats = []; lastAnswer = ''; $('#prompt').value = ''; render(); }
  async function api(path, body, key, type, signal) {
    requireSession();
    const response = await fetch('/api/my-chat/' + path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'Content-Type': type, ...(!serverKeyReady ? {'X-My-Chat-Key':key} : {}) }, body });
    if (response.status === 401) { lockScreen(); throw Error('ログインし直してください。'); }
    if(path==='speech' && response.ok) {if(!response.headers.get('content-type')?.startsWith('audio/mpeg'))throw Error('音声を読み取れませんでした。');return response.blob();}
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
    clearSpeech();
    if (!lastAnswer) return;
    if (!synth || !window.SpeechSynthesisUtterance) { toast('このブラウザーは読み上げに対応していません。回答は画面で読めます。'); return; }
    synth.cancel(); const utterance = new SpeechSynthesisUtterance(lastAnswer); utterance.lang = 'ja-JP';
    utterance.onerror = () => status('読み上げを開始できませんでした。「もう一度読む」を押してください。'); synth.speak(utterance);
  }
  async function send(text, readAloud = false) {
    requireSession();
    if (attachmentLoading) throw Error('添付の読み込みが終わるまで待ってください。');
    if (!keyAvailable()) { $('#settings-dialog').showModal(); throw Error('設定で共通APIキーを入力してください。'); }
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
    const payload=imageRequest ? {prompt:text,consent:true,...(selected === 'edit' ? {image:attachment.data} : {})} : {model:selectedModel,messages,...(selected === 'web' ? {web:true,consent:true} : {}),...(attachment ? {attachment,consent:true} : {})};
    const data = await api(imageRequest?'image':'chat', JSON.stringify(payload), apiKey, 'application/json', controller.signal);
    if (stopped) return;
    chat.messages.push({ role: 'user', content: text+(attachment?'\n[添付: '+attachment.name+']':'') }, { role: 'assistant', content: data.text, citations:data.citations, image:data.image });
    clearAttachment();$('#send-consent').checked=false;$('#prompt').value = ''; lastAnswer = data.text;$('#speech-consent').checked=false; render();saveHistory();
    status(data.truncated ? '回答が長いため上限で終了しました。' : '回答しました。'); if (readAloud) speak();
  }
  async function operation(run) {
    if (busy) return; clearSpeech(); busy = true; stopped = false; controller = new AbortController(); render();
    const timeout = setTimeout(() => controller?.abort(), 200000);
    try { await run(); }
    catch (e) { if (!stopped) status(e.name === 'AbortError' ? '時間切れになりました。自動再送はしていません。' : e.message); }
    finally { clearTimeout(timeout); busy = false; controller = null; render(); }
  }
  async function record() {
    if (busy || recorder || pending) return;
    try {requireSession();}catch(e){status(e.message);return;}
    if (mode() !== 'chat' || attachment || attachmentLoading) { status('音声は「文字会話」で、添付を外してから利用してください。');return; }
    if (!keyAvailable()) { $('#voice-dialog').close(); $('#settings-dialog').showModal(); status('設定で共通APIキーを1回入力すると、文字と音声に使えます。'); return; }
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
    if(serverKeyReady||!sessionReady()){status('接続を再確認してからキーを入力してください。');return;}
    if (busy || recorder || pending) { toast('先に送信・録音を停止してください。'); return; }
    const key = $('#api-key').value.trim();
    if (!validKey(key)) { toast('キーの形式を確認してください。'); return; }
    apiKey = key;
    $('#api-key').value = ''; update(); toast('このタブで使用します。まだAPIには送信していません。');
  };
  $('#forget-keys').onclick = () => { stop(); clearKeys(); toast('キーを消去しました。'); };
  $('#clear').onclick = () => { if(!sessionReady())return;stop();try{window.localStorage.removeItem(historyKey);}catch{historyStatus('履歴を削除できませんでした。ブラウザーの保存設定を確認してください。');return;}clearAttachment();chats=[];active=null;lastAnswer='';historyLoaded=true;historyBlocked=false;$('#prompt').value='';render();historyStatus('このブラウザーの履歴を削除しました。'); };
  $('#mode').onchange = () => {$('#send-consent').checked=false;update();};
  $('#model').onchange=()=>{
    const next=$('#model').value;
    if(busy||pending||recorder||!modelIds.includes(next)){$('#model').value=selectedModel;return;}
    selectedModel=next;
    try {window.localStorage.setItem(modelPreference,next);} catch { /* keep tab preference when storage is blocked */ }
    status('会話モデルを変更しました。次の回答から使用します。モデルごとに料金・利用権限が異なります。');
  };
  $('#attach').onclick = () => $('#file').click();
  $('#file').onchange = async () => {
    const file=$('#file').files[0]; if (!file || busy) return;
    clearAttachment();const ticket=attachmentGeneration;attachmentController=new AbortController();const fileSignal=attachmentController.signal;attachmentLoading=true;update();
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
      } else if (/\.(pdf|docx|xlsx|pptx)$/i.test(file.name)) {
        const docs=window.MyChatDocuments || await import('./documents.mjs');
        const text=await docs.extract(file,fileSignal);
        next={kind:'text',name:file.name.slice(0,100)+'（文字抽出のみ）',text};
      } else {
        if (!/\.(txt|md|csv|json)$/i.test(file.name)||file.size>24000) throw Error('添付は画像、または24KB以内のTXT・MD・CSV・JSONです。PDF/DOCX/XLSX/PPTXは2MB以内です。旧Office形式は未対応です。');
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
  $('#api-read').onclick=()=>{
    if(busy||recorder||pending)return;
    operation(async()=>{
      if(!keyAvailable())throw Error('設定に共通APIキーを入力してください。');
      if(!lastAnswer||lastAnswer.length>1000)throw Error('API読み上げは1000文字以内の直前の回答が対象です。');
      if(!$('#speech-consent').checked)throw Error('回答の送信と音声合成の追加料金を確認してください。');
      clearSpeech();synth?.cancel();status('AI音声を作っています…');
      const blob=await api('speech',JSON.stringify({text:lastAnswer,consent:true}),apiKey,'application/json',controller.signal);
      if(stopped)return;$('#speech-consent').checked=false;
      speechURL=URL.createObjectURL(blob);speechAudio=new Audio(speechURL);speechAudio.onended=clearSpeech;speechAudio.onerror=()=>{clearSpeech();status('音声を再生できませんでした。自動で再送していません。');};
      try {await speechAudio.play();status('AIが生成した音声を再生しています。');}catch {clearSpeech();throw Error('ブラウザーで音声を再生できませんでした。端末の「もう一度読む」を利用できます。');}
    });
  };
  $('#stop').onclick = stop; $('#voice-stop').onclick = stop; $('#read-again').onclick = speak;
  document.querySelectorAll('.close').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('#voice-dialog').addEventListener('close', () => { if (recorder || pending || busy) stop(); synth?.cancel();clearSpeech(); });
  $('#logout').addEventListener('submit', cleanup);
  window.addEventListener('pagehide', cleanup);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopRecording(); synth?.cancel(); clearSpeech(); } else checkSession(); });
  function lockScreen() { if (locked) return; cleanup(); locked = true; document.body.replaceChildren(); location.replace('/my-chat/'); }
  function armExpiry(){
    clearTimeout(authTimer);
    const left=knownExpires-Date.now();
    if(left<=0){lockScreen();return;}
    authTimer=setTimeout(()=>{if(knownExpires<=Date.now())lockScreen();else armExpiry();},Math.min(left,2147483647));
  }
  function checkSession() {
    if(locked)return Promise.resolve();
    if(knownExpires && knownExpires<=Date.now()){lockScreen();return Promise.resolve();}
    if(sessionRequest)return sessionRequest;
    const epoch=sessionEpoch, aborter=new AbortController();sessionController=aborter;authState='checking';update();
    const timeout=setTimeout(()=>aborter.abort(),12000);
    sessionRequest=(async()=>{
      try {
        const r=await fetch('/my-chat/session',{cache:'no-store',credentials:'same-origin',signal:aborter.signal});
        if(epoch!==sessionEpoch||locked)return;
        if(r.status===401){lockScreen();return;}
        if(!r.ok)throw Error('connection');
        const {expires,serverKeyConfigured}=await r.json();if(epoch!==sessionEpoch||locked)return;
        if(!Number.isSafeInteger(expires)||expires<=0||expires*1000>Date.now()+30*24*60*60*1000)throw Error('invalid session');
        const deadline=expires*1000;
        if(deadline<=Date.now()){lockScreen();return;}
        knownExpires=knownExpires?Math.min(knownExpires,deadline):deadline;
        if(knownExpires<=Date.now()){lockScreen();return;}
        serverKeyReady=serverKeyConfigured===true;authState='verified';armExpiry();update();restoreHistory();
      } catch {
        if(epoch!==sessionEpoch||locked)return;
        if(knownExpires && knownExpires<=Date.now()){lockScreen();return;}
        authState='unknown';stop();if(!knownExpires)clearKeys();update();
      } finally {clearTimeout(timeout);if(epoch===sessionEpoch){sessionRequest=null;sessionController=null;}}
    })();
    return sessionRequest;
  }
  $('#auth-retry').onclick=checkSession;
  window.addEventListener('pageshow', checkSession); setInterval(checkSession, 60000); render();
})();
