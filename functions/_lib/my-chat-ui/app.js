'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const modelIds=['gpt-5.4-mini','gpt-5.4','gpt-6-luna','gpt-6.1-sol'];
  const modelPreference='my-chat.text-model.v1';
  let selectedModel='gpt-5.4-mini', provider='openai',geminiKeyReady=false;
  const isGemini=()=>provider==='gemini';
  const geminiModels=['gemini-3.5-flash-lite','gemini-3.8-flash'],geminiPreference='my-chat.gemini-model.v1';let selectedGemini=geminiModels[0];
  try{const saved=window.localStorage.getItem(geminiPreference);if(geminiModels.includes(saved))selectedGemini=saved;}catch{}
  $('#gemini-text-model').value=selectedGemini;
  try { const saved=window.localStorage.getItem(modelPreference);if(modelIds.includes(saved))selectedModel=saved; } catch { /* storage may be unavailable */ }
  $('#model').value=selectedModel;
  let chats = [], active = null, sequence = 0, busy = false, controller = null;
  let serverKeyReady=false, retryPending=false;
  const retryAdvice=" 入力・添付・このタブのキーは保持しています。再読み込みせず「再試行」を押せます。前の処理や料金が発生済みの可能性があります。";
  const keyAvailable=()=>isGemini()?geminiKeyReady:serverKeyReady || !!apiKey;
  let apiKey = '', recorder = null, stream = null, recordingTimer, authTimer;
  let generation = 0, pending = false, lastAnswer = '', stopped = false, locked = false;
  let attachment = null, attachmentGeneration = 0, attachmentLoading = false;
  let attachmentController=null, speechAudio=null, speechURL=null;
  let authState='unknown', knownExpires=0, sessionEpoch=0, sessionRequest=null, sessionController=null;
  const sessionReady=()=>!locked && authState==='verified' && knownExpires>Date.now();
  function requireSession(){
    if(knownExpires && knownExpires<=Date.now())lockScreen();
    if(historyLoading)throw Error('履歴を読み込んでいます。完了してから送信してください。');
    if(historyClearing)throw Error('履歴を削除しています。完了してから送信してください。');
    if(!sessionReady())throw Error('ログイン状態を確認できるまで送信を停止しています。「接続を再確認」を押してください。');
  }
  const acknowledgements=new Set();let disclosedScope='',detailsOpen=false,noticeDismissed=false;
  const imageItems=()=>attachment?.kind==='images'?attachment.items:[];
  const consentScope=()=>isGemini()?'gemini:'+selectedGemini+':'+mode()+':'+(attachment?.kind||'text')+':'+imageItems().length:mode()==='chat'?(attachment?'attachment:'+attachment.kind+':'+imageItems().length+':'+selectedModel:''):mode()==='web'?'web:'+selectedModel:mode()==='edit'?'edit:'+imageItems().length:mode();
  const mode = () => $('#mode').value || 'chat';
  const synth = window.speechSynthesis;
  const validKey = key => /^sk-[A-Za-z0-9_-]{20,240}$/.test(key);
  function status(text) { if (locked) return; $('#status').textContent = text; $('#voice-status').textContent = text; }
  function toast(text) { $('#toast').textContent = text; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 5000); }
  function closeMenu() { document.body.classList.remove('menu-open'); $('#menu').setAttribute('aria-expanded', 'false'); }
  function update() {
    if (locked) return;
    $('#provider-cost').textContent='送信すると'+(isGemini()?'Google Gemini':'OpenAI')+' APIの料金が発生します。';
    $('#provider').value=provider;$('#provider').disabled=busy||pending||!!recorder||historyLoading||historyClearing;
    $('#openai-model').hidden=isGemini();$('#gemini-model').hidden=!isGemini();
    $('#send').textContent=retryPending?'再試行':'送信';
    $('#send').disabled = (historyClearing||historyLoading) || !sessionReady() || busy || pending || !!recorder || attachmentLoading || !$('#prompt').value.trim();
    $('#new').disabled = historyClearing || historyLoading || busy || pending || !!recorder;
    $('#voice').disabled=isGemini();
    $('#record').disabled = isGemini() || (historyClearing||historyLoading) || !sessionReady() || busy || pending || !!recorder;
    $('#api-read').disabled = isGemini() || !sessionReady() || busy || pending || !!recorder;
    $('#api-key').disabled=isGemini()||serverKeyReady;
    $('#apply-keys').disabled = isGemini() || serverKeyReady || !sessionReady() || busy || pending || !!recorder;
    $('#auth-retry').disabled = authState==='checking';
    $('#history-retry').disabled=historyClearing||historyLoading||!sessionReady()||!historyDirty||historyBlocked;
    $('#clear').disabled=historyClearing;
    $('#history-retry').hidden=!historyDirty;
    $('#auth-status').textContent = authState==='verified' ? '' : authState==='checking' ? 'ログイン状態を確認中です。送信は一時停止しています。' : '接続を確認できません。送信を停止しています。接続を再確認してください。';
    $('#auth-retry').hidden = authState==='verified';
    $('#finish-record').disabled = !recorder;
    $('#key-status').textContent = isGemini()?(geminiKeyReady?'Geminiサーバーキー設定済み':'Geminiサーバーキー設定待ち（MY_CHAT_GEMINI_API_KEY）'):serverKeyReady ? 'サーバーキー設定済み・入力不要' : apiKey ? '共通キー入力済み・対応する全機能に使用（未検証）' : 'キー未入力';
    $('#connection').textContent = isGemini()?(geminiKeyReady?'Gemini設定済み':'Gemini設定待ち'):serverKeyReady ? 'サーバーキー設定済み' : apiKey ? 'キー入力済み' : 'キー未入力';
    for(const option of $('#mode').options||[])option.disabled=isGemini()&&option.value==='web';
    $('#mode').disabled = busy || pending || !!recorder;
    $('#gemini-text-model').disabled=busy||pending||!!recorder;
    $('#model').disabled = busy || pending || !!recorder;
    $('#attach').disabled = busy || pending || !!recorder;
    const scope=consentScope(),special=!!scope;
    if(scope!==disclosedScope){disclosedScope=scope;detailsOpen=false;$('#send-consent').checked=false;}
    if(acknowledgements.has(scope))$('#send-consent').checked=true;
    $('#consent-details').hidden=!special||noticeDismissed;
    $('#consent-details').textContent=acknowledgements.has(scope)?'確認済み・送信内容／料金':'送信内容・料金';
    $('#consent-row').hidden=!special||noticeDismissed||(acknowledgements.has(scope)&&!detailsOpen);
    $('#consent-details').setAttribute('aria-expanded',String(!$('#consent-row').hidden));
    $('#send-details').textContent = isGemini()?((mode()==='image'||mode()==='edit')?'Google Gemini画像APIへ指示と選択した参照画像を送信します。画像料金が発生します。1K・正方形・出力1枚。OpenAIと合計でUTCの1日30回まで。':'このGemini会話と今回選んだ添付をGoogle Gemini APIへ送信します。API料金とGoogleのデータ取扱条件が適用されます。添付の原本は履歴に保存しません。'):mode() === 'image' || mode() === 'edit'
      ? 'OpenAIの画像APIに指示' + (mode()==='edit' ? 'と選択した参照画像（最大4枚）' : '') + 'を送信します。別途画像料金。1024px・下書き品質・1枚。全体でUTCの1日30回まで。'
      : mode() === 'web' ? 'この会話をOpenAIへ送り、公開Webを検索します。検索1回あたり$0.01＋文章料金。全体で1日30回まで。'
      : attachment ? '添付「' + attachment.name + '」を今回だけOpenAIへ送信します。内容に応じた入力料金が追加されます。アプリには保存しません。' : '';
  }
  const historyKey='my-chat.history.v1';
  let historyLoaded=false,historyBlocked=false,historyDirty=false,historyClearing=false,historyLoading=false,historyBlockReason='';
  let historyBaseline,historyStore,historyGeneration=0,historyVersion=0,historyQueue=Promise.resolve();
  const historyRequests=new Set();
  const historyStatus=text=>{$('#history-status').textContent=text;$('#history-status').className=historyDirty||historyBlocked?'save-warning':'save-ok';};
  const getHistoryStore=()=>historyStore||(historyStore=window.MyChatHistory.createStore());
  const historyCurrent=(epoch,revision)=>epoch===sessionEpoch&&revision===historyGeneration&&sessionReady();
  function historyError(error){
    if(error.code==='LEGACY_CHANGED'){historyBlocked=true;historyBlockReason='LEGACY_CHANGED';return '旧版の履歴に別の変更があります。両方のデータを保持し、自動統合・上書きはしていません。旧版タブを閉じ、未保存の内容をコピー／画像をダウンロードしてください。再読み込みだけでは旧版との差分は解消しません。';}
    if(error.code==='CONFLICT'){historyBlocked=true;historyBlockReason='CONFLICT';return '別タブで履歴が変更されました。上書きせず、このタブの未保存の会話を保持しています。必要な内容をコピー／画像をダウンロードしてから再読み込みしてください。';}
    if(error.code==='LIMIT')return '履歴がアプリ上限100MiB・100会話・2000メッセージを超えました。以前の保存分は残っています。未保存の内容はコピー／画像をダウンロードしてください。';
    return '履歴を保存・変更できませんでした（IndexedDBの利用可否・空き容量・保存設定を確認）。以前の保存分と移行前データは残っています。未保存の内容は閉じると失われます。画像はダウンロードできます。';
  }
  function cancelHistoryRequests(){historyGeneration++;for(const request of historyRequests)request.abort();historyRequests.clear();}
  async function restoreHistory(){
    if(historyLoaded||historyLoading||!sessionReady())return;const epoch=sessionEpoch,revision=historyGeneration,aborter=new AbortController();historyRequests.add(aborter);historyLoading=true;update();
    try{
      const data=await getHistoryStore().load({guard:()=>historyCurrent(epoch,revision),signal:aborter.signal});
      if(!historyCurrent(epoch,revision))return;chats=data.chats;sequence=Math.max(sequence,...chats.map(c=>c.id));active=chats[0]?.id||null;historyBaseline={revision:data.revision,legacyFingerprint:data.legacyFingerprint};historyLoaded=true;historyBlocked=data.conflict;
      render();historyStatus(data.conflict?historyError({code:'LEGACY_CHANGED'}):chats.length?'保存済み':'');
    }catch(error){
      if(!historyCurrent(epoch,revision))return;historyBlocked=true;historyBlockReason=error.code||'UNAVAILABLE';historyLoaded=true;
      try{chats=getHistoryStore().readLegacy();sequence=Math.max(sequence,...chats.map(c=>c.id));active=chats[0]?.id||null;render();}catch{}
      historyStatus(historyError(error)+' 移行前の履歴を読み取れた場合は表示のみ行います。');
    }finally{historyRequests.delete(aborter);if(epoch===sessionEpoch&&revision===historyGeneration){historyLoading=false;update();}}
  }
  function saveHistory(){
    if(!historyDirty||historyClearing)return;
    if(!sessionReady()){historyStatus('未保存の変更があります。認証の再確認後に保存を再試行します。閉じる前に保存済み表示を確認してください。');update();return;}
    if(!historyLoaded||historyBlocked||!historyBaseline){historyStatus(historyError({code:historyBlockReason||'UNAVAILABLE'}));update();return;}
    const epoch=sessionEpoch,revision=historyGeneration;historyStatus('未保存の変更を保存待ちです。閉じる前に保存済み表示を確認してください。');
    const run=async()=>{
      if(!historyCurrent(epoch,revision)||!historyDirty||historyBlocked)return;
      const aborter=new AbortController(),version=historyVersion;historyRequests.add(aborter);
      try{
        const next=await getHistoryStore().save(chats,historyBaseline,{guard:()=>historyCurrent(epoch,revision),signal:aborter.signal});
        if(!historyCurrent(epoch,revision))return;historyBaseline=next;if(version===historyVersion)historyDirty=false;historyStatus(historyDirty?'未保存の変更を保存待ちです。':'保存済み');
      }catch(error){if(historyCurrent(epoch,revision))historyStatus(historyError(error));}
      finally{historyRequests.delete(aborter);if(epoch===sessionEpoch&&revision===historyGeneration)update();}
    };
    historyQueue=historyQueue.then(run,run);return historyQueue;
  }
  $('#history-retry').onclick=saveHistory;
  window.addEventListener('storage',e=>{if(e.key===historyKey||e.key===null){historyBlocked=true;historyStatus(historyError({code:'LEGACY_CHANGED'}));update();}});
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
    const selectedChat=chats.find(c=>c.id===active);if(selectedChat)provider=selectedChat.provider||'openai';
    $('#history').replaceChildren();
    for (const c of chats) {
      const b = document.createElement('button'); b.className = 'history-item' + (active === c.id ? ' active' : '');
      b.textContent = (c.provider==='gemini'?'Gemini · ':'OpenAI · ')+c.title; b.disabled = busy || !!recorder || pending;
      b.onclick = () => { active = c.id;provider=c.provider||'openai';$('#mode').value='chat';retryPending=false;clearAttachment();$('#prompt').value='';lastAnswer='';render(); closeMenu(); }; $('#history').append(b);
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
    resetDrop();
    stopped = true; controller?.abort(); stopRecording(); synth?.cancel();
    clearSpeech();
    if (attachmentLoading) clearAttachment();
    status('停止しました。送信済みの処理には料金が発生する場合があります。'+(retryPending?retryAdvice:''));
  }
  function clearAttachment() { resetDrop();attachmentController?.abort();attachmentController=null;attachment=null;attachmentLoading=false;attachmentGeneration++;$('#file').value='';$('#attachment-preview').replaceChildren();$('#send-consent').checked=false;update(); }
  function clearSpeech(){speechAudio?.pause();if(speechAudio)speechAudio.src='';speechAudio=null;if(speechURL)URL.revokeObjectURL(speechURL);speechURL=null;}
  function cleanup() { retryPending=false;acknowledgements.clear();disclosedScope='';detailsOpen=false;noticeDismissed=false;sessionEpoch++;sessionController?.abort();sessionController=null;sessionRequest=null;authState='unknown';knownExpires=0;serverKeyReady=false;geminiKeyReady=false;cancelHistoryRequests();historyBaseline=undefined;historyLoaded=false;historyBlocked=false;historyDirty=false;historyClearing=false;historyLoading=false;historyBlockReason='';historyQueue=Promise.resolve();historyStatus('');clearTimeout(authTimer);stop(); clearKeys(); clearAttachment(); chats = []; lastAnswer = ''; $('#prompt').value = ''; render(); }
  async function api(path, body, key, type, signal) {
    requireSession();
    if(isGemini() && !['chat','image'].includes(path))throw Error('Geminiではこの機能は未対応です。OpenAIには送信していません。');
    let response;try { response = await fetch('/api/my-chat/' + (isGemini()?'gemini/':'') + path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'Content-Type': type, ...(!isGemini()&&!serverKeyReady ? {'X-My-Chat-Key':key} : {}) }, body }); } catch(e) {if(e.name==='AbortError')throw e;throw Error('通信を確認できませんでした。自動再送はしていません。（NETWORK）');}
    if (response.status === 401) { lockScreen(); throw Error('ログインし直してください。'); }
    if(path==='speech' && response.ok) {if(!response.headers.get('content-type')?.startsWith('audio/mpeg'))throw Error('音声を読み取れませんでした。');return response.blob();}
    let data;try{data=await response.json();}catch{throw Error('応答を読み取れませんでした。自動再送はしていません。（RESPONSE_FORMAT）');}
    if (!response.ok) {if((path==='chat'||path==='image') && ([400,413,409].includes(response.status)||data.code==='DB_CONTROL'))retryPending=false;throw Error(data.error || '送信できませんでした。');}
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
    if(isGemini()&&!geminiKeyReady)throw Error('Geminiのサーバーキー設定待ちです。OpenAIキーは使用しません。');
    if (!keyAvailable()) { $('#settings-dialog').showModal(); throw Error('設定で共通APIキーを入力してください。'); }
    if (!text.trim() || text.length > 4000) throw Error('文章は1〜4000文字にしてください。');
    if (/\bsk-[A-Za-z0-9_-]{12,}/.test(text)) throw Error('APIキーは会話に送らず、設定欄に入力してください。');
    noticeDismissed=false;update();
    const selected=mode();
    if(isGemini()&&!['chat','image','edit'].includes(selected))throw Error('Geminiではこの機能は未対応です。');
    if (consentScope() && !acknowledgements.has(consentScope()) && !$('#send-consent').checked) throw Error('送信内容と料金を確認し、チェックを入れてください。');
    if (selected === 'web' && attachment) throw Error('添付ファイルを外してからWeb検索してください。');
    if (selected === 'image' && attachment) throw Error('新しく画像を作る場合は添付を外してください。編集する場合は「画像編集」を選んでください。');
    if (selected === 'edit' && !imageItems().length) throw Error('参照する画像を1〜4枚添付してください。');
    if ((selected === 'image'||selected === 'edit') && text.length > 2000) throw Error('画像の指示は2000文字以内にしてください。');
    if(consentScope()&&$('#send-consent').checked)acknowledgements.add(consentScope());
    if(retryPending && !window.confirm('前の送信結果は確認できていません。処理済みの場合、再送で料金が重複する可能性があります。現在の入力・添付を送信しますか？')){status('再試行を取り消しました。入力・添付・キーは保持しています。');return;}
    let chat = chats.find(c => c.id === active);
    if (!chat) { chat = { id: ++sequence, provider, title: text.slice(0, 25), messages: [] }; chats.unshift(chat); active = chat.id; }
    if((chat.provider||'openai')!==provider)throw Error('別の提供元の会話は送信できません。新しい会話を開始してください。');
    const messages = conversationInput(chat, text); status(selected === 'image'||selected === 'edit' ? '画像を作っています（最大3分）…' : '回答を待っています…');
    const imageRequest=selected === 'image'||selected === 'edit';
    const payload=imageRequest ? {prompt:text,consent:true,...(selected === 'edit' ? {images:imageItems().map(i=>i.data)} : {})} : {model:isGemini()?selectedGemini:selectedModel,messages,...(selected === 'web' ? {web:true,consent:true} : {}),...(attachment ? {attachment:attachment.kind==='images'?{kind:'images',images:imageItems().map(i=>i.data)}:{kind:'text',text:attachment.text},consent:true} : {})};
    $('#prompt').value=text;retryPending=true;update();
    const data = await api(imageRequest?'image':'chat', JSON.stringify(payload), apiKey, 'application/json', controller.signal);
    if (stopped || controller.signal.aborted) return;
    retryPending=false;
    chat.messages.push({ role: 'user', content: text }, { role: 'assistant', content: data.text, citations:data.citations, image:data.image });
    detailsOpen=false;noticeDismissed=true;clearAttachment();$('#send-consent').checked=false;$('#prompt').value = ''; lastAnswer = data.text;$('#speech-consent').checked=false; historyVersion++;historyDirty=true;render();saveHistory();update();
    status(data.truncated ? '回答が長いため上限で終了しました。' : '回答しました。'); if (readAloud) speak();
  }
  async function operation(run) {
    if (busy) return; clearSpeech(); busy = true; stopped = false; controller = new AbortController(); render();
    const timeout = setTimeout(() => controller?.abort(), 200000);
    try { await run(); }
    catch (e) { if (!stopped) status((e.name === 'AbortError' ? '時間切れになりました。自動再送はしていません。' : e.message)+(retryPending?retryAdvice:'')); }
    finally { clearTimeout(timeout); busy = false; controller = null; render(); }
  }
  async function record() {
    if (busy || recorder || pending) return;
    if(isGemini()){status('Geminiの録音送信は未対応です。');return;}
    try {requireSession();}catch(e){status(e.message);return;}
    if (mode() !== 'chat' || attachment || attachmentLoading) { status('音声は「文字会話」で、添付を外してから利用してください。');return; }
    if(isGemini()&&!geminiKeyReady)throw Error('Geminiのサーバーキー設定待ちです。OpenAIキーは使用しません。');
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
  $('#prompt').oninput = ()=>{noticeDismissed=false;update();};
  $('#prompt').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!$('#send').disabled) $('#composer').requestSubmit(); } };
  $('#new').onclick = () => { if (busy || recorder || pending) return; synth?.cancel(); active = null; clearAttachment();$('#prompt').value = ''; render(); closeMenu(); };
  $('.brand').onclick = e => { e.preventDefault(); $('#new').click(); };
  $('#menu').onclick = () => { document.body.classList.toggle('menu-open'); $('#menu').setAttribute('aria-expanded', document.body.classList.contains('menu-open')); };
  $('#veil').onclick = closeMenu;
  document.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => { if (!busy) { $('#prompt').value = b.dataset.prompt; update(); $('#prompt').focus(); } });
  $('#settings').onclick = () => { closeMenu(); $('#settings-dialog').showModal(); };
  $('#apply-keys').onclick = () => {
    if(isGemini()||serverKeyReady||!sessionReady()){status('接続を再確認してからキーを入力してください。');return;}
    if (busy || recorder || pending) { toast('先に送信・録音を停止してください。'); return; }
    const key = $('#api-key').value.trim();
    if (!validKey(key)) { toast('キーの形式を確認してください。'); return; }
    apiKey = key;
    $('#api-key').value = ''; update(); $('#settings-dialog').close(); $('#prompt').focus(); status('このタブにAPIキーを設定しました。'); toast('このタブにAPIキーを設定しました（API側は未検証）。');
  };
  $('#forget-keys').onclick = () => { if(!window.confirm('このタブの一時APIキーを消去しますか？CloudflareのサーバーSecretと保存済み履歴は変更しません。'))return;stop(); clearKeys(); toast('このタブの一時キーを消去しました。サーバーSecretは変更していません。'); };
  $('#clear').onclick = async () => {
    if(!sessionReady()||historyClearing||historyLoading)return;
    if(!historyBaseline){historyStatus('IndexedDBの履歴を確認できないため削除していません。保存設定を確認し、再読み込みしてください。');return;}
    stop();cancelHistoryRequests();const epoch=sessionEpoch,revision=historyGeneration,aborter=new AbortController();historyRequests.add(aborter);historyClearing=true;update();
    try{
      const next=await getHistoryStore().clear(historyBaseline,{guard:()=>historyCurrent(epoch,revision),signal:aborter.signal});
      if(!historyCurrent(epoch,revision))return;historyBaseline={revision:next.revision,legacyFingerprint:next.legacyFingerprint};clearAttachment();chats=[];active=null;lastAnswer='';historyVersion++;historyDirty=false;historyLoaded=true;historyBlocked=!next.legacyRemoved;$('#prompt').value='';render();
      historyStatus(next.legacyRemoved?'このブラウザーの履歴を削除しました。':'新しい保存先の履歴は削除しましたが、移行前バックアップを消去できませんでした。再読み込みしても自動復元しません。ブラウザーの保存設定を確認してください。');
    }catch(error){if(historyCurrent(epoch,revision))historyStatus(historyError(error));}
    finally{historyRequests.delete(aborter);if(epoch===sessionEpoch&&revision===historyGeneration){historyClearing=false;update();}}
  };
  $('#consent-details').onclick=()=>{detailsOpen=!detailsOpen;update();};
  $('#send-consent').onchange=()=>{const scope=consentScope();if(!scope)return;if($('#send-consent').checked){acknowledgements.add(scope);detailsOpen=false;}else acknowledgements.delete(scope);update();};
  $('#provider').onchange=()=>{const next=$('#provider').value;if(busy||pending||recorder||historyLoading||historyClearing||!['openai','gemini'].includes(next)){$('#provider').value=provider;return;}if(next===provider)return;if(($('#prompt').value.trim()||attachment)&&!window.confirm('提供元を変更すると新しい会話になります。未送信の入力・添付を消して切り替えますか？')){$('#provider').value=provider;return;}provider=next;active=null;lastAnswer='';retryPending=false;$('#mode').value='chat';$('#prompt').value='';clearAttachment();render();status(next==='gemini'?'Geminiの新しい会話です。Googleへ送信します。':'OpenAIの新しい会話です。');};
  $('#mode').onchange = () => {if(isGemini()&&mode()==='web'){$('#mode').value='chat';status('GeminiのWeb検索は未対応です。OpenAIには送信しません。');}noticeDismissed=false;$('#send-consent').checked=false;update();};
  $('#gemini-text-model').onchange=()=>{const next=$('#gemini-text-model').value;if(busy||pending||recorder||!geminiModels.includes(next)){$('#gemini-text-model').value=selectedGemini;return;}selectedGemini=next;try{window.localStorage.setItem(geminiPreference,next);}catch{}update();status('Geminiモデルを変更しました。モデルごとに料金・利用資格が異なります。');};
  $('#model').onchange=()=>{
    const next=$('#model').value;
    if(busy||pending||recorder||!modelIds.includes(next)){$('#model').value=selectedModel;return;}
    selectedModel=next;update();
    try {window.localStorage.setItem(modelPreference,next);} catch { /* keep tab preference when storage is blocked */ }
    status('会話モデルを変更しました。次の回答から使用します。モデルごとに料金・利用権限が異なります。');
  };
  const IMAGE_LIMITS={count:4,each:2*1024*1024,total:4*1024*1024,source:5*1024*1024,sourceTotal:20*1024*1024};
  function checkedPng(data){
    if(typeof data!=='string'||data.length>Math.ceil(IMAGE_LIMITS.each/3)*4+22||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('変換後の画像はPNG・各2MiB以内にしてください。');
    const bin=atob(data.slice(22)),word=n=>bin.charCodeAt(n)*16777216+(bin.charCodeAt(n+1)<<16)+(bin.charCodeAt(n+2)<<8)+bin.charCodeAt(n+3);
    if(bin.length<33||bin.length>IMAGE_LIMITS.each||bin.slice(0,8)!=='\x89PNG\r\n\x1a\n'||bin.slice(12,16)!=='IHDR'||!word(16)||!word(20)||word(16)>1024||word(20)>1024)throw Error('画像形式を確認してください。');
    let pos=8,dataChunk=false,end=false;while(pos<bin.length){if(pos+12>bin.length)throw Error('画像形式を確認してください。');const size=word(pos),type=bin.slice(pos+4,pos+8);if(size>bin.length-pos-12||(pos===8&&size!==13))throw Error('画像形式を確認してください。');pos+=size+12;if(type==='IDAT')dataChunk=true;if(type==='IEND'){if(size!==0||pos!==bin.length)throw Error('画像形式を確認してください。');end=true;break;}}if(!dataChunk||!end)throw Error('画像形式を確認してください。');return bin.length;
  }
  function convertImage(file,signal){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),image=new Image();let settled=false;
      const finish=(error,data)=>{if(settled)return;settled=true;image.onload=null;image.onerror=null;signal.removeEventListener('abort',abort);URL.revokeObjectURL(url);error?reject(error):resolve(data);};
      const abort=()=>finish(new DOMException('stopped','AbortError'));signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted){abort();return;}
      image.onload=()=>{try{if(signal.aborted){abort();return;}if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw Error('元画像は4000万画素以内にしてください。');const scale=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/png');finish(null,{name:file.name.slice(0,100),data,bytes:checkedPng(data)});}catch(e){finish(e);}};
      image.onerror=()=>finish(Error('画像を開けません。'));image.src=url;
    });
  }
  function renderAttachment(){
    const preview=$('#attachment-preview');preview.replaceChildren();if(!attachment)return;
    if(attachment.kind==='images'){
      const count=document.createElement('span');count.textContent=imageItems().length+'枚';preview.append(count);
      imageItems().forEach((item,index)=>{const thumb=document.createElement('img');thumb.src=item.data;thumb.alt='参照画像'+(index+1);thumb.title=item.name;
        const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','参照画像'+(index+1)+'を外す: '+item.name);remove.onclick=()=>{if(busy||attachmentLoading)return;attachment.items.splice(index,1);if(!attachment.items.length)attachment=null;noticeDismissed=false;renderAttachment();update();};preview.append(thumb,remove);
      });
    }else{const label=document.createElement('span');label.textContent='資料・'+attachment.text.length+'文字';label.title=attachment.name;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','添付資料を外す: '+attachment.name);remove.onclick=()=>{if(!busy&&!attachmentLoading)clearAttachment();};preview.append(label,remove);}
  }
  $('#attach').onclick = () => $('#file').click();
  async function attachFiles(files,imagesOnly=false) {
    if(!files.length)return;
    if(!sessionReady()||historyLoading||historyClearing){status('ログイン状態の確認後に画像を添付してください。');return;}
    if(busy||pending||recorder||attachmentLoading){status('処理中です。完了または停止してから添付してください。');return;}
    const isImage=file=>['image/png','image/jpeg','image/webp'].includes(file.type);
    if(imagesOnly&&!files.every(isImage)){status('ドロップできるのはPNG・JPEG・WebP画像だけです。文書は添付ボタンから選んでください。');return;}
    const attachmentProvider=provider,attachmentEpoch=sessionEpoch;
    attachmentController?.abort();const ticket=++attachmentGeneration;attachmentController=new AbortController();const fileSignal=attachmentController.signal;attachmentLoading=true;noticeDismissed=false;update();
    try{
      let next;
      if(files.some(isImage)){
        if(!files.every(isImage))throw Error('画像と文書は別々に選んでください。');
        const prior=imageItems();if(files.length+prior.length>IMAGE_LIMITS.count)throw Error('参照画像は合計4枚までです。不要な画像を外してください。');
        if(files.some(f=>f.size>IMAGE_LIMITS.source)||files.reduce((n,f)=>n+f.size,0)>IMAGE_LIMITS.sourceTotal)throw Error('元画像は各5MiB・合計20MiB以内にしてください。');
        const items=[...prior];let total=items.reduce((n,i)=>n+i.bytes,0);
        for(const file of files){if(fileSignal.aborted)throw new DOMException('stopped','AbortError');const item=await convertImage(file,fileSignal);total+=item.bytes;if(total>IMAGE_LIMITS.total)throw Error('変換後の参照画像は合計4MiB以内にしてください。');items.push(item);}
        next={kind:'images',items};
      }else{
        if(files.length!==1)throw Error('文書は1ファイルずつ選んでください。');const file=files[0];let text;
        if(/\.(pdf|docx|xlsx|pptx)$/i.test(file.name)){const docs=window.MyChatDocuments||await import('./documents.mjs');text=await docs.extract(file,fileSignal);}
        else{if(!/\.(txt|md|csv|json)$/i.test(file.name)||file.size>24000)throw Error('添付は画像、24KB以内のTXT・MD・CSV・JSON、2MB以内のPDF/DOCX/XLSX/PPTXです。旧Office形式は未対応です。');text=await file.text();}
        if(!text.trim()||text.length>8000||text.includes('\0'))throw Error('テキストはUTF-8・8000文字以内にしてください。');if(/\bsk-[A-Za-z0-9_-]{12,}/.test(text))throw Error('APIキーを含むファイルは送信しないでください。');next={kind:'text',name:file.name.slice(0,100),text};
      }
      if(ticket!==attachmentGeneration||locked||fileSignal.aborted||attachmentProvider!==provider||attachmentEpoch!==sessionEpoch)return;
       if(!sessionReady()){status('接続を再確認してから、もう一度画像を添付してください。');return;}
      attachment=next;$('#send-consent').checked=false;renderAttachment();update();
    }catch(e){if(ticket===attachmentGeneration&&e.name!=='AbortError')status(e.message);}
    finally{if(ticket===attachmentGeneration){attachmentLoading=false;$('#file').value='';update();}}
  };
  $('#file').onchange=()=>attachFiles(Array.from($('#file').files||[]));
  let dragDepth=0;
  function resetDrop(){dragDepth=0;$('#drop-hint').hidden=true;}
  const hasFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files')||Array.from(e.dataTransfer?.items||[]).some(i=>i.kind==='file');
  const canDrop=()=>sessionReady()&&!historyLoading&&!historyClearing&&!busy&&!pending&&!recorder&&!attachmentLoading&&!$('#settings-dialog').open&&!$('#voice-dialog').open;
  document.addEventListener('dragenter',e=>{e.preventDefault();if(!hasFiles(e))return;dragDepth++;if(canDrop())$('#drop-hint').hidden=false;});
  document.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect=hasFiles(e)&&canDrop()?'copy':'none';});
  document.addEventListener('dragleave',e=>{e.preventDefault();dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)resetDrop();});
  document.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();resetDrop();if(!canDrop()){status('今はドロップできません。ログイン状態や処理中の操作を確認してください。');return;}
    const dt=e.dataTransfer,items=Array.from(dt?.items||[]),types=Array.from(dt?.types||[]);
    if(items.some(i=>i.kind!=='file')||types.some(t=>['text/html','text/uri-list','text/plain'].includes(t))){status('リンクやWebページではなく、端末内の画像ファイルをドロップしてください。');return;}
    const files=Array.from(dt?.files||[]);if(!files.length){status('端末内の画像ファイルをドロップしてください。');return;}await attachFiles(files,true);
  });
  document.addEventListener('dragend',resetDrop);window.addEventListener('blur',resetDrop);
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
  $('#logout').addEventListener('submit', e=>{
    const message='ログアウトしますか？保存済み履歴は残り、一時キーは消えます。サーバーキーは削除しません。'+(historyDirty?' 未保存の変更は失われます。':'');
    if(!window.confirm(message)){e.preventDefault();return;}cleanup();
  });
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
        const {expires,serverKeyConfigured,geminiKeyConfigured}=await r.json();if(epoch!==sessionEpoch||locked)return;
        if(!Number.isSafeInteger(expires)||expires<=0||expires*1000>Date.now()+30*24*60*60*1000)throw Error('invalid session');
        const deadline=expires*1000;
        if(deadline<=Date.now()){lockScreen();return;}
        knownExpires=knownExpires?Math.min(knownExpires,deadline):deadline;
        if(knownExpires<=Date.now()){lockScreen();return;}
        geminiKeyReady=geminiKeyConfigured===true;serverKeyReady=serverKeyConfigured===true;authState='verified';armExpiry();update();await restoreHistory();saveHistory();update();
      } catch {
        if(epoch!==sessionEpoch||locked)return;
        if(knownExpires && knownExpires<=Date.now()){lockScreen();return;}
        authState='unknown';stop();if(!knownExpires)clearKeys();saveHistory();update();
      } finally {clearTimeout(timeout);if(epoch===sessionEpoch){sessionRequest=null;sessionController=null;}}
    })();
    return sessionRequest;
  }
  $('#auth-retry').onclick=checkSession;
  function fitViewport(){const v=window.visualViewport;if(v&&v.scale===1)$('#app-main').style.height=Math.round(v.height)+'px';}
  window.visualViewport?.addEventListener('resize',fitViewport);fitViewport();
  window.addEventListener('pageshow', checkSession); setInterval(checkSession, 60000); render();
})();
