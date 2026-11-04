// Browser-independent UI behavior tests. No real browser, microphone or API calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../functions/_lib/my-chat-ui/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../functions/_lib/my-chat-ui/index.html',import.meta.url),'utf8');
const key='sk-'+'notARealKeyForUnitTestsOnly'.repeat(2);
const tick=()=>new Promise(r=>setImmediate(r));

test('accessible selector sends selected models for text/web/attachments and voice follow-up',async()=>{
  assert.match(html,/id="model"[^>]*aria-label="会話モデルを選択"/);
  const models=[...html.matchAll(/<option value="(gpt-[^"]+)">/g)].map(m=>m[1]);assert.deepEqual(models,['gpt-5.4-mini','gpt-5.4','gpt-6-luna','gpt-6.1-sol']);
  const f=fixture();await f.keys();f.el('model').value='gpt-6-luna';f.el('model').onchange();
  for(const mode of ['chat','web']) {f.el('mode').value=mode;f.el('mode').onchange();f.el('prompt').value='hello';f.el('send-consent').checked=true;f.el('composer').requestSubmit();await tick();assert.equal(JSON.parse(f.calls.at(-1).opts.body).model,'gpt-6-luna');}
  f.el('mode').value='chat';f.el('file').files=[{name:'x.txt',size:4,text:async()=> 'text'}];await f.el('file').onchange();f.el('prompt').value='read';f.el('send-consent').checked=true;f.el('composer').requestSubmit();await tick();assert.equal(JSON.parse(f.calls.at(-1).opts.body).model,'gpt-6-luna');
  f.el('record').click();await tick();assert.equal(f.el('model').disabled,true);f.el('model').value='gpt-5.4';f.el('model').onchange();assert.equal(f.el('model').value,'gpt-6-luna');
  f.el('finish-record').click();await tick();await tick();assert.equal(JSON.parse(f.calls.at(-1).opts.body).model,'gpt-6-luna');
});
test('only a validated non-secret model preference is stored, restored and tolerant of blocked storage',async()=>{
  const storage=new Map([['my-chat.text-model.v1','unknown']]);const f=fixture(undefined,undefined,storage);await f.keys();assert.equal(f.el('model').value,'gpt-5.4-mini');
  f.el('model').value='gpt-6.1-sol';f.el('model').onchange();assert.deepEqual(f.storageWrites,[['my-chat.text-model.v1','gpt-6.1-sol']]);
  f.el('model').value='__proto__';f.el('model').onchange();assert.equal(f.el('model').value,'gpt-6.1-sol');assert.equal(f.storageWrites.length,1);
  const restored=fixture(undefined,undefined,storage);assert.equal(restored.el('model').value,'gpt-6.1-sol');assert.equal(restored.el('api-key').value,'');
  const blocked={get(){throw Error('blocked');},set(){throw Error('blocked');}};const b=fixture(undefined,undefined,blocked);await b.keys();b.el('model').value='gpt-5.4';b.el('model').onchange();b.el('prompt').value='hello';b.el('composer').requestSubmit();await tick();assert.equal(JSON.parse(b.calls[0].opts.body).model,'gpt-5.4');
});
test('transient session failures preserve an unexpired memory key but block every API action until retry',async()=>{
  for(const failure of [()=>{throw Error('offline');},()=>new Response('{}',{status:503}),()=>Response.json({expires:'bad'})]) {
    const f=fixture();await f.keys();f.setSession(failure);await f.windowEvents.pageshow();assert.equal(f.redirects.length,0);assert.equal(f.el('send').disabled,true);assert.equal(f.el('record').disabled,true);
    f.el('prompt').value='hello';f.el('composer').requestSubmit();f.el('api-read').onclick();await tick();assert.equal(f.calls.length,0);
    f.setSession(()=>Response.json({expires:Math.floor(Date.now()/1000)+28800}));await f.el('auth-retry').onclick();f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].opts.headers['X-My-Chat-Key'],key);assert.ok(f.storageWrites.every(([k,v])=>k==='my-chat.history.v1'&&!v.includes(key)));
  }
});
test('pending session verification deduplicates retries, blocks sends, and expires without network',async()=>{
  const f=fixture();await f.keys();const expiry=f.timers.find(t=>t.ms>28000000);let resolve,count=0;
  f.setSession(()=>{count++;return new Promise(r=>resolve=r);});const pending=f.windowEvents.pageshow();const again=f.windowEvents.pageshow();assert.equal(count,1);
  f.el('prompt').value='hello';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,0);
  f.advance(28800000);expiry.f();assert.deepEqual(f.redirects,['/my-chat/']);resolve(Response.json({expires:Math.floor(Date.now()/1000)+28800}));await pending;await again;assert.equal(f.calls.length,0);
});
test('initial verification, real expiry and page lifecycle never reuse a stale key',async()=>{
  const initial=fixture();initial.el('prompt').value='hello';initial.el('composer').requestSubmit();await tick();assert.equal(initial.calls.length,0);
  const f=fixture();await f.keys();let resolve;f.setSession(()=>new Promise(r=>resolve=r));const pending=f.windowEvents.pageshow();f.windowEvents.pagehide();resolve(Response.json({expires:Math.floor(Date.now()/1000)+28800}));await pending;
  f.el('prompt').value='hello';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,0);
  f.setSession(()=>Response.json({expires:Math.floor(Date.now()/1000)+100}));await f.windowEvents.pageshow();f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,0);assert.equal(f.el('settings-dialog').open,true);
  f.setSession(()=>Response.json({expires:Math.floor(Date.now()/1000)-1}));await f.windowEvents.pageshow();assert.deepEqual(f.redirects,['/my-chat/']);
});
test('session timeout is retryable; known deadline cannot extend on later checks',async()=>{
  const f=fixture();await f.keys();const before=f.timers.filter(t=>t.ms>28000000).at(-1).ms;
  f.setSession((_,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError')))));
  const check=f.windowEvents.pageshow();f.timers.filter(t=>t.ms===12000).at(-1).f();await check;assert.equal(f.redirects.length,0);assert.equal(f.el('send').disabled,true);
  f.setSession(()=>Response.json({expires:Math.floor(Date.now()/1000)+28800}));await f.windowEvents.pageshow();assert.ok(f.timers.filter(t=>t.ms>28000000).at(-1).ms<=before);
});

test('API speech requires separate consent, never auto-sends and stops on logout',async()=>{
  const f=fixture(url=>url.endsWith('/speech')?new Response('ID3synthetic',{headers:{'Content-Type':'audio/mpeg'}}):Response.json({text:'Short answer'}));await f.keys();f.el('prompt').value='hello';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,1);
  f.el('api-read').click();await tick();assert.equal(f.calls.length,1);
  f.el('speech-consent').checked=true;f.el('api-read').click();f.el('api-read').click();await tick();await tick();
  assert.equal(f.calls.length,2);assert.deepEqual(JSON.parse(f.calls[1].opts.body),{text:'Short answer',consent:true});assert.equal(f.el('speech-consent').checked,false);assert.equal(f.audios[0].played,true);
  f.el('logout').events.submit();assert.equal(f.audios[0].paused,true);assert.equal(f.audios[0].src,'');assert.deepEqual(f.revoked,['blob:synthetic-audio']);
});
test('Office/PDF selection sends extracted text only after consent, not binary file data',async()=>{
  const f=fixture();await f.keys();f.window.MyChatDocuments={extract:async(file,signal)=>{assert.equal(signal.aborted,false);return 'Extracted local text';}};
  f.el('file').files=[{name:'local.pdf',size:123,type:'application/pdf'}];await f.el('file').onchange();assert.equal(f.calls.length,0);
  f.el('prompt').value='summarize';f.el('send-consent').checked=true;f.el('composer').requestSubmit();await tick();
  const a=JSON.parse(f.calls[0].opts.body).attachment;assert.equal(a.kind,'text');assert.equal(a.text,'Extracted local text');assert.equal(a.data,undefined);
});

test('untrusted image URLs and citation schemes are never linked',async()=>{
  const f=fixture(()=>Response.json({text:'unsafe',image:'javascript:alert(1)',citations:[{start:0,end:6,url:'javascript:alert(1)'},{start:0,end:6,url:'https://user:password@example.com'}]}));await f.keys();
  f.el('prompt').value='test';f.el('composer').requestSubmit();await tick();
  assert.equal(f.el('messages').children[1].children.filter(e=>e.href||e.src).length,0);
});

test('stop and logout discard a late attachment read without network traffic',async()=>{
  for(const action of ['stop','logout']) {
    let resolve;const f=fixture();await f.keys();
    f.el('file').files=[{name:'sample.txt',size:10,type:'text/plain',text:()=>new Promise(r=>resolve=r)}];
    const pending=f.el('file').onchange();
    if(action==='stop') f.el('stop').click();else f.el('logout').events.submit();
    resolve('sample');await pending;
    assert.equal(f.el('attachment-preview').children.length,0);assert.equal(f.calls.length,0);
  }
});
function fixture(fetcher,mediaRequest,storage=new Map(),options={}) {
  let clock=Date.now();class TestDate extends Date {static now(){return clock;}}
  class Element {
    value='';textContent='';children=[];disabled=false;style={};events={};open=false;
    classList={remove(){},toggle(){},contains(){return false;}};
    append(...nodes){this.children.push(...nodes);} replaceChildren(){this.children=[];}
    setAttribute(){} focus(){this.focused=true;} addEventListener(k,f){this.events[k]=f;}
    showModal(){this.open=true;} close(){this.open=false;this.events.close?.();}
    click(){if(!this.disabled)this.onclick?.();} requestSubmit(){this.onsubmit?.({preventDefault(){}});}
  }
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>['#'+m[1],new Element()]));
  elements.set('.brand',new Element());
  const windowEvents={},documentEvents={},timers=[],calls=[],spoken=[],audios=[],revoked=[],redirects=[],storageWrites=[];
  let sessionFetcher=()=>Response.json({expires:Math.floor(Date.now()/1000)+28800});
  class TestURL extends URL {static createObjectURL(){return "blob:synthetic-audio";}static revokeObjectURL(url){revoked.push(url);}}
  class TestAudio {constructor(src){this.src=src;audios.push(this);}async play(){this.played=true;}pause(){this.paused=true;}}
  const document={body:new Element(),hidden:false,querySelector(s){assert.ok(elements.has(s),'missing selector '+s);return elements.get(s);},querySelectorAll(){return [];},createElement(tag){const el=new Element();if(tag==='canvas'){el.getContext=()=>({drawImage(){}});el.toDataURL=()=> options.png || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=';}return el;},createTextNode(text){const e=new Element();e.textContent=text;return e;},addEventListener(k,f){documentEvents[k]=f;}};
  let stoppedTracks=0;
  const stream={getTracks:()=>[{stop(){stoppedTracks++;}}]};
  const recorders=[];
  class Recorder {
    static isTypeSupported(t){return t==='audio/mp4';}
    constructor(s,o){this.state='inactive';this.mimeType=o.mimeType;recorders.push(this);}
    start(){this.state='recording';} stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['fake'],{type:'audio/mp4'})});this.onstop?.();});}
  }
  const window={confirm:()=>true,localStorage:{getItem:k=>storage.get(k),setItem(k,v){storageWrites.push([k,v]);storage.set(k,v);},removeItem(k){storage.delete(k);}},MediaRecorder:Recorder,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{cancel(){},speak(u){spoken.push(u.text);}},addEventListener(k,f){windowEvents[k]=f;}};
  const pendingImages=[];class MockImage {naturalWidth=1;naturalHeight=1;set src(v){pendingImages.push(this);if(!options.deferImages)queueMicrotask(()=>this.onload?.());}}
  const context={DOMException,atob,Image:MockImage,Date:TestDate,window,document,URL:TestURL,Audio:TestAudio,navigator:{mediaDevices:{getUserMedia:mediaRequest||(()=>Promise.resolve(stream))}},MediaRecorder:Recorder,SpeechSynthesisUtterance:window.SpeechSynthesisUtterance,Blob,AbortController,queueMicrotask,location:{replace(path){redirects.push(path);}},setTimeout(f,ms){timers.push({f,ms});return timers.length;},clearTimeout(){},setInterval(){},fetch:async(url,opts)=>{if(url==='/my-chat/session')return sessionFetcher(url,opts);calls.push({url,opts});return fetcher?fetcher(url,opts):Response.json(url.endsWith('transcribe')?{text:'話した内容'}:{text:'返答'});}};
  vm.runInNewContext(src,context);
  const el=id=>elements.get('#'+id);
  const keys=async()=>{await windowEvents.pageshow();el('api-key').value=key;el('apply-keys').click();};
  return {pendingImages,advance(ms){clock+=ms;},el,keys,calls,window,storage,storageWrites,redirects,setSession(fn){sessionFetcher=fn;},windowEvents,documentEvents,recorders,spoken,timers,stream,audios,revoked,get stoppedTracks(){return stoppedTracks;}};
}
test('key setup never sends or persists keys; submit is single-flight and renders text safely',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));await f.keys();
  assert.equal(f.calls.length,0);assert.equal(f.el('api-key').value,'');
  f.el('prompt').value='質問';f.el('composer').requestSubmit();f.el('composer').requestSubmit();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].opts.headers['X-My-Chat-Key'],key);
  resolve(Response.json({text:'<script>not HTML</script>'}));await tick();
  assert.equal(f.el('messages').children[1].textContent,'<script>not HTML</script>');assert.equal(f.el('prompt').value,'');
  f.windowEvents.pagehide();assert.equal(f.el('messages').children.length,0);
  await f.windowEvents.pageshow();f.el('prompt').value='次';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,1);assert.equal(f.el('settings-dialog').open,true);
  assert.doesNotMatch(src,/sessionStorage|indexedDB|innerHTML/);assert.ok(f.storageWrites.every(([k,v])=>k==='my-chat.history.v1'&&!v.includes(key)));
});
test('network errors retain draft, allow retry, and stop aborts in-flight requests',async()=>{
  const f=fixture(async(url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')))));
  await f.keys();f.el('prompt').value='残したい下書き';f.el('composer').requestSubmit();f.el('stop').click();await tick();
  assert.equal(f.calls[0].opts.signal.aborted,true);assert.equal(f.el('prompt').value,'残したい下書き');assert.equal(f.el('send').disabled,false);
});
test('late microphone permission after stop closes tracks without recording',async()=>{
  let allow;const f=fixture(undefined,()=>new Promise(r=>allow=r));await f.keys();f.el('record').click();f.el('voice-stop').click();allow(f.stream);await tick();
  assert.equal(f.recorders.length,0);assert.equal(f.stoppedTracks,1);assert.equal(f.calls.length,0);
});
test('voice uses supported MIME, transcribes then chats and reads; close/logout discard recording',async()=>{
  const f=fixture();await f.keys();f.el('record').click();await tick();assert.equal(f.recorders[0].mimeType,'audio/mp4');
  f.el('finish-record').click();await tick();await tick();assert.equal(f.calls.length,2);assert.match(f.calls[0].url,/transcribe$/);assert.match(f.calls[1].url,/chat$/);assert.equal(f.spoken[0],'返答');assert.equal(f.calls[0].opts.headers['X-My-Chat-Key'],key);assert.equal(f.calls[1].opts.headers['X-My-Chat-Key'],key);
  f.el('record').click();await tick();f.el('voice-dialog').close();await tick();assert.equal(f.calls.length,2);assert.equal(f.recorders[1].state,'inactive');
  f.el('record').click();await tick();f.el('logout').events.submit();await tick();assert.equal(f.calls.length,2);assert.equal(f.recorders[2].state,'inactive');
});
test('authentication expiry clears keys and stops microphone',async()=>{
  const f=fixture(()=>new Response('{}',{status:401}));await f.keys();f.el('record').click();await tick();f.setSession(()=>new Response('{}',{status:401}));await f.windowEvents.pageshow();await tick();
  assert.equal(f.recorders[0].state,'inactive');assert.equal(f.el('api-key').value,'');
});
test('Web search waits for explicit consent, renders linked citations and resets consent',async()=>{
  const f=fixture(()=>Response.json({text:'source result',citations:[{start:0,end:6,url:'https://example.com/page',title:'Source'}]}));await f.keys();
  f.el('mode').value='web';f.el('mode').onchange();f.el('prompt').value='最新情報';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,0);
  f.el('send-consent').checked=true;f.el('composer').requestSubmit();await tick();
  const body=JSON.parse(f.calls[0].opts.body);assert.equal(body.web,true);assert.equal(body.consent,true);assert.equal(f.el('consent-row').hidden,true);
  const links=f.el('messages').children[1].children.filter(e=>e.href);assert.equal(links[0].href,'https://example.com/page');assert.equal(links[0].textContent,'source');assert.equal(links[0].rel,'noopener noreferrer');
});
test('text file selection is local, gated by consent, included once and cleared after send',async()=>{
  const f=fixture();await f.keys();f.el('file').files=[{name:'sample.csv',type:'text/csv',size:11,text:async()=> 'a,b\n1,2'}];await f.el('file').onchange();
  assert.equal(f.calls.length,0);f.el('prompt').value='要約';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,0);
  f.el('send-consent').checked=true;f.el('composer').requestSubmit();await tick();assert.equal(JSON.parse(f.calls[0].opts.body).attachment.text,'a,b\n1,2');assert.equal(f.el('attachment-preview').children.length,0);
  f.el('prompt').value='ありがとう';f.el('composer').requestSubmit();await tick();assert.equal(JSON.parse(f.calls[1].opts.body).attachment,undefined);
});
test('image generation needs consent and uses dedicated endpoint; unsupported files never send',async()=>{
  const f=fixture();await f.keys();f.el('mode').value='image';f.el('mode').onchange();f.el('prompt').value='猫の絵';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,0);
  f.el('send-consent').checked=true;f.el('composer').requestSubmit();await tick();assert.equal(f.calls[0].url,'/api/my-chat/image');assert.equal(JSON.parse(f.calls[0].opts.body).prompt,'猫の絵');
  f.el('file').files=[{name:'document.doc',type:'application/msword',size:10}];await f.el('file').onchange();assert.equal(f.calls.length,1);assert.match(f.el('status').textContent,/PDF/);
});

test('server-key UI sends no credential header and 30 day timers never overflow',async()=>{
 const f=fixture();f.setSession(()=>Response.json({expires:Math.floor(Date.now()/1000)+2592000,serverKeyConfigured:true}));await f.windowEvents.pageshow();
 assert.equal(f.el('api-key').disabled,true);assert.equal(f.el('apply-keys').disabled,true);assert.ok(f.timers.some(t=>t.ms===2147483647));assert.ok(f.timers.every(t=>t.ms<=2147483647));
 f.el('prompt').value='hello';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].opts.headers['X-My-Chat-Key'],undefined);
 f.advance(2147483647);f.timers.find(t=>t.ms===2147483647).f();assert.equal(f.redirects.length,0);f.advance(500000000);f.timers.at(-1).f();assert.deepEqual(f.redirects,['/my-chat/']);
});
test('history restores only after authentication, survives logout, deletes independently and excludes secrets/files',async()=>{
 const store=new Map(),f=fixture(()=>Response.json({text:'<b>safe text</b> '+key}),undefined,store);await f.keys();
 f.el('file').files=[{name:'local.txt',size:4,text:async()=> 'ORIGINAL_FILE_PRIVATE_BYTES'}];await f.el('file').onchange();f.el('send-consent').checked=true;f.el('prompt').value='remember';f.el('composer').requestSubmit();await tick();
 const saved=store.get('my-chat.history.v1');assert.ok(saved);assert.ok(!saved.includes(key));assert.ok(!saved.includes('ORIGINAL_FILE_PRIVATE_BYTES'));assert.ok(!saved.includes('expires'));assert.ok(!saved.includes('apiKey'));
 f.el('logout').events.submit();assert.equal(store.get('my-chat.history.v1'),saved);assert.equal(f.el('messages').children.length,0);
 const restored=fixture(undefined,undefined,store);assert.equal(restored.el('messages').children.length,0);await restored.windowEvents.pageshow();assert.equal(restored.el('messages').children.length,2);assert.match(restored.el('messages').children[1].textContent,/<b>safe text<\/b>/);
 restored.el('clear').click();assert.equal(store.has('my-chat.history.v1'),false);assert.equal(restored.el('messages').children.length,0);assert.equal(restored.redirects.length,0);
});
test('history corruption, unavailable storage and quota errors stay visible without deleting older records',async()=>{
 for(const raw of ['{bad',JSON.stringify({version:1,chats:[{id:1,title:'x',messages:[{role:'system',content:'bad'}]}]}),JSON.stringify({version:1,chats:[{id:1,title:'x',messages:[{role:'assistant',content:'x',image:'javascript:evil'}]}]})]){
  const store=new Map([['my-chat.history.v1',raw]]),f=fixture(undefined,undefined,store);await f.keys();assert.equal(f.el('messages').children.length,0);assert.ok(f.el('history-status').textContent);f.el('prompt').value='new';f.el('composer').requestSubmit();await tick();assert.equal(store.get('my-chat.history.v1'),raw);
 }
 const store=new Map(),f=fixture(undefined,undefined,store);await f.keys();f.el('prompt').value='old';f.el('composer').requestSubmit();await tick();const old=store.get('my-chat.history.v1');store.set=()=>{throw Error('quota');};f.el('prompt').value='new';f.el('composer').requestSubmit();await tick();assert.equal(store.get('my-chat.history.v1'),old);assert.ok(f.el('history-status').textContent);
});

test('generated images and citations restore safely, storage caps preserve previous history',async()=>{
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=';
 const store=new Map(),f=fixture(()=>Response.json({text:'source',image,citations:[{start:0,end:6,url:'https://example.com/',title:'Source'}]}),undefined,store);await f.keys();f.el('prompt').value='image';f.el('composer').requestSubmit();await tick();
 const r=fixture(undefined,undefined,store);await r.windowEvents.pageshow();assert.ok(r.el('messages').children[1].children.some(e=>e.src===image));assert.ok(r.el('messages').children[1].children.some(e=>e.href==='https://example.com/'));
 const old=store.get('my-chat.history.v1');const big=fixture(()=>Response.json({text:'large image',image:'data:image/png;base64,iVBORw0KGgo'+'A'.repeat(2200000)}),undefined,store);await big.keys();big.el('prompt').value='large';big.el('composer').requestSubmit();await tick();assert.equal(store.get('my-chat.history.v1'),old);
 const unavailable=fixture(undefined,undefined,{get(){throw Error('blocked');},set(){throw Error('blocked');},delete(){throw Error('blocked');}});await unavailable.windowEvents.pageshow();assert.ok(unavailable.el('history-status').textContent);unavailable.el('clear').click();assert.ok(unavailable.el('history-status').textContent);
});

test('answer during background verification stays visibly unsaved then persists on recovery',async()=>{
 let answer,verify;const store=new Map(),f=fixture(()=>new Promise(r=>answer=r),undefined,store);await f.keys();
 f.el('prompt').value='race';f.el('composer').requestSubmit();f.setSession(()=>new Promise(r=>verify=r));const check=f.windowEvents.pageshow();
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=';
 answer(Response.json({text:'new answer',image}));await tick();assert.equal(store.has('my-chat.history.v1'),false);assert.match(f.el('history-status').textContent,/未保存/);assert.equal(f.el('history-retry').disabled,true);
 verify(new Response('{}',{status:503}));await check;assert.match(f.el('history-status').textContent,/未保存/);assert.equal(store.has('my-chat.history.v1'),false);
 f.setSession(()=>Response.json({expires:Math.floor(Date.now()/1000)+28800}));await f.el('auth-retry').onclick();assert.ok(store.get('my-chat.history.v1').includes('new answer'));assert.equal(f.el('history-retry').disabled,true);assert.match(f.el('history-status').textContent,/保存済み/);
 f.windowEvents.pagehide();const restored=fixture(undefined,undefined,store);await restored.windowEvents.pageshow();assert.equal(restored.el('messages').children.length,2);assert.ok(restored.el('messages').children[1].children.some(e=>e.src===image));
 assert.ok(html.indexOf('id="history-status"')<html.indexOf('<dialog'));assert.doesNotMatch(html,/このタブのみ/);
});
test('pending unsaved answer is discarded on expiry or logout, never committed by a late session result',async()=>{
 for(const action of ['expiry','logout']){
  let answer,verify;const store=new Map(),f=fixture(()=>new Promise(r=>answer=r),undefined,store);await f.keys();f.el('prompt').value='private pending';f.el('composer').requestSubmit();f.setSession(()=>new Promise(r=>verify=r));const check=f.windowEvents.pageshow();answer(Response.json({text:'pending'}));await tick();
  if(action==='logout')f.el('logout').events.submit();else{f.advance(28800000);f.timers.find(t=>t.ms>28000000).f();}
  verify(Response.json({expires:Math.floor(Date.now()/1000)+28800}));await check;assert.equal(store.has('my-chat.history.v1'),false);assert.equal(f.el('messages').children.length,0);
 }
});
test('quota failure preserves saved history and image download; explicit retry saves dirty changes',async()=>{
 const store=new Map();let fail=false;const originalSet=store.set.bind(store);store.set=(k,v)=>{if(fail&&k==='my-chat.history.v1')throw Error('quota');return originalSet(k,v);};
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=';
 const f=fixture(()=>Response.json({text:'answer',image}),undefined,store);await f.keys();f.el('prompt').value='old';f.el('composer').requestSubmit();await tick();const old=store.get('my-chat.history.v1');fail=true;f.el('prompt').value='new';f.el('composer').requestSubmit();await tick();
 assert.equal(store.get('my-chat.history.v1'),old);assert.match(f.el('history-status').textContent,/未保存/);assert.equal(f.el('history-retry').disabled,false);assert.ok(f.el('messages').children.at(-1).children.some(e=>e.href===image&&e.download));
 fail=false;f.el('history-retry').click();assert.notEqual(store.get('my-chat.history.v1'),old);assert.match(f.el('history-status').textContent,/保存済み/);assert.equal(f.el('history-retry').disabled,true);
});

test('same-scope acknowledgment collapses without autosend, feature change prompts and page lifecycle resets',async()=>{
 const f=fixture();await f.keys();f.el('mode').value='image';f.el('mode').onchange();assert.equal(f.el('consent-row').hidden,false);assert.equal(f.calls.length,0);
 f.el('prompt').value='cat';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,0);
 f.el('send-consent').checked=true;f.el('send-consent').onchange();assert.equal(f.el('consent-row').hidden,true);assert.equal(f.calls.length,0);
 for(let i=0;i<2;i++){f.el('prompt').value='cat';f.el('composer').requestSubmit();await tick();assert.equal(f.el('consent-row').hidden,true);assert.equal(JSON.parse(f.calls.at(-1).opts.body).consent,true);}
 f.el('prompt').oninput();f.el('consent-details').click();assert.equal(f.el('consent-row').hidden,false);f.el('consent-details').click();assert.equal(f.el('consent-row').hidden,true);
 f.el('mode').value='edit';f.el('mode').onchange();assert.equal(f.el('consent-row').hidden,false);assert.equal(f.el('send-consent').checked,false);
 f.el('mode').value='image';f.el('mode').onchange();assert.equal(f.el('consent-row').hidden,true);f.windowEvents.pagehide();await f.windowEvents.pageshow();assert.equal(f.el('consent-row').hidden,false);
 assert.ok(f.storageWrites.every(([k])=>!k.includes('consent')));
});
test('different attachment data scope requires notice; same text scope keeps visible removable identity',async()=>{
 const f=fixture();await f.keys();f.el('file').files=[{name:'first.txt',size:3,text:async()=> 'abc'}];await f.el('file').onchange();assert.equal(f.el('consent-row').hidden,false);f.el('send-consent').checked=true;f.el('send-consent').onchange();
 f.el('attachment-preview').children.at(-1).click();f.el('file').files=[{name:'second.txt',size:3,text:async()=> 'def'}];await f.el('file').onchange();assert.equal(f.el('consent-row').hidden,true);assert.match(f.el('attachment-preview').children[0].title,/second.txt/);
 f.el('attachment-preview').children.at(-1).click();f.el('file').files=[{name:'image.png',type:'image/png',size:100}];await f.el('file').onchange();assert.equal(f.el('consent-row').hidden,false);assert.equal(f.el('send-consent').checked,false);assert.equal(f.el('attachment-preview').children[1].alt,'参照画像1');f.el('mode').value='web';f.el('mode').onchange();assert.equal(f.el('consent-row').hidden,false);assert.equal(f.calls.length,0);
});
test('logout is only in settings; cancel preserves state, confirmation clears temporary key but retains saved history',async()=>{
 const f=fixture();await f.keys();f.el('prompt').value='keep';f.el('composer').requestSubmit();await tick();const saved=f.storage.get('my-chat.history.v1');let canceled=false;
 f.window.confirm=()=>false;f.el('logout').events.submit({preventDefault(){canceled=true;}});assert.equal(canceled,true);assert.equal(f.el('messages').children.length,2);
 f.el('prompt').value='still authenticated';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,2);
 f.window.confirm=message=>{assert.match(message,/一時キー/);return true;};f.el('logout').events.submit({preventDefault(){throw Error('should submit');}});assert.equal(f.el('messages').children.length,0);assert.ok(f.storage.get('my-chat.history.v1'));assert.equal(f.redirects.length,0);
 assert.ok(html.indexOf('id="logout"')>html.indexOf('id="settings-dialog"'));assert.ok(html.indexOf('id="logout"')<html.indexOf('id="clear"'));assert.match(html,/<form id="logout" method="post" action="\/my-chat\/logout">/);
});
test('compact composer keeps controls inside form with responsive touch targets and help outside conversation',()=>{
 const css=readFileSync(new URL('../functions/_lib/my-chat-ui/style.css',import.meta.url),'utf8');const form=html.slice(html.indexOf('<form id="composer"'),html.indexOf('</form>',html.indexOf('<form id="composer"')));
 for(const id of ['mode','attach','voice','stop','send'])assert.ok(form.includes('id="'+id+'"'));
 assert.doesNotMatch(form,/文字・画像・検索・音声/);assert.ok(html.indexOf('id="model-help"')>html.indexOf('id="settings-dialog"'));assert.match(css,/min-height:44px/);assert.match(css,/@media\(max-width:360px\)/);assert.match(css,/safe-area-inset-bottom/);assert.match(src,/visualViewport/);
});

test('temporary-key apply closes settings and focuses composer without a validation call',async()=>{
 const f=fixture();await f.windowEvents.pageshow();f.el('settings').click();assert.equal(f.el('settings-dialog').open,true);f.el('api-key').value=key;f.el('apply-keys').click();
 assert.equal(f.el('settings-dialog').open,false);assert.equal(f.el('prompt').focused,true);assert.equal(f.el('api-key').value,'');assert.match(f.el('status').textContent,/このタブにAPIキーを設定/);assert.match(f.el('connection').textContent,/入力済み/);assert.equal(f.calls.length,0);
 f.el('settings').click();assert.equal(f.el('settings-dialog').open,true);f.el('api-key').value='invalid';f.el('apply-keys').click();assert.equal(f.el('settings-dialog').open,true);assert.match(f.el('toast').textContent,/形式/);assert.equal(f.calls.length,0);
 f.setSession(()=>new Response('{}',{status:503}));await f.windowEvents.pageshow();f.el('api-key').value=key;f.el('apply-keys').onclick();assert.equal(f.el('settings-dialog').open,true);assert.match(f.el('status').textContent,/接続/);assert.equal(f.calls.length,0);
});

test('temporary-key deletion is separate, cancelable and never changes server configuration',async()=>{
 const f=fixture();await f.keys();f.window.confirm=()=>false;f.el('forget-keys').click();f.el('prompt').value='retained';f.el('composer').requestSubmit();await tick();assert.equal(f.calls[0].opts.headers['X-My-Chat-Key'],key);
 const old=f.storage.get('my-chat.history.v1');f.window.confirm=message=>{assert.match(message,/Cloudflare/);return true;};f.el('forget-keys').click();f.el('prompt').value='no key';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,1);assert.equal(f.storage.get('my-chat.history.v1'),old);assert.equal(f.el('settings-dialog').open,true);
 f.setSession(()=>Response.json({expires:Math.floor(Date.now()/1000)+28800,serverKeyConfigured:true}));await f.windowEvents.pageshow();f.el('forget-keys').click();f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].opts.headers['X-My-Chat-Key'],undefined);
 const manager=html.slice(html.indexOf('<details class="key-management"'),html.indexOf('</details>',html.indexOf('<details class="key-management"')));assert.ok(manager.includes('id="forget-keys"'));assert.ok(!manager.includes('id="apply-keys"'));
 assert.match(html,/id="stop"[^>]*aria-label="停止"[^>]*>⏹️<\/button>/);assert.match(html,/id="voice-stop"[^>]*aria-label="停止・録音を破棄"[^>]*>⏹️<\/button>/);
});

test('multiple image edit keeps draft on failure, clears successful draft/notice, retains generated download without filenames',async()=>{
 let fail=true;const output='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=';
 const f=fixture(()=>fail?Response.json({error:'try again'},{status:502}):Response.json({text:'done',image:output}));await f.keys();f.el('mode').value='edit';f.el('mode').onchange();f.el('file').files=Array.from({length:4},(_,i)=>({name:'PRIVATE_FILE_'+i+'.png',size:100,type:'image/png'}));await f.el('file').onchange();assert.equal(f.el('attachment-preview').children[0].textContent,'4枚');assert.ok(f.el('attachment-preview').children.every(e=>!e.textContent.includes('PRIVATE_FILE')));
 f.el('send-consent').checked=true;f.el('send-consent').onchange();f.el('prompt').value='combine';f.el('composer').requestSubmit();await tick();assert.equal(f.el('attachment-preview').children.length,9);assert.equal(f.el('prompt').value,'combine');let body=JSON.parse(f.calls[0].opts.body);assert.equal(body.images.length,4);assert.ok(!f.calls[0].opts.body.includes('PRIVATE_FILE'));
 fail=false;f.el('consent-details').click();assert.equal(f.el('consent-row').hidden,false);f.el('composer').requestSubmit();await tick();assert.equal(f.el('attachment-preview').children.length,0);assert.equal(f.el('consent-row').hidden,true);assert.equal(f.el('consent-details').hidden,true);assert.equal(f.el('messages').children[0].textContent,'combine');assert.ok(f.el('messages').children[1].children.some(e=>e.href===output&&e.download));assert.ok(!f.storage.get('my-chat.history.v1').includes('PRIVATE_FILE'));
});
test('multiple-image vision sends image array, individual removal updates consent scope and document selection stays single',async()=>{
 const f=fixture();await f.keys();f.el('file').files=[{name:'a.png',size:100,type:'image/png'},{name:'b.png',size:100,type:'image/png'}];await f.el('file').onchange();assert.equal(f.el('attachment-preview').children[0].textContent,'2枚');f.el('send-consent').checked=true;f.el('send-consent').onchange();f.el('attachment-preview').children.at(-1).click();assert.equal(f.el('attachment-preview').children[0].textContent,'1枚');assert.equal(f.el('consent-row').hidden,false);
 f.el('file').files=Array.from({length:4},()=>({name:'more.png',size:100,type:'image/png'}));await f.el('file').onchange();assert.match(f.el('status').textContent,/4枚/);assert.equal(f.el('attachment-preview').children[0].textContent,'1枚');
 f.el('file').files=[{name:'a.txt',size:1,text:async()=> 'a'},{name:'b.txt',size:1,text:async()=> 'b'}];await f.el('file').onchange();assert.match(f.el('status').textContent,/1ファイル/);assert.equal(f.el('attachment-preview').children[0].textContent,'1枚');
 f.el('file').files=[{name:'big.png',size:5*1024*1024+1,type:'image/png'}];await f.el('file').onchange();assert.equal(f.el('attachment-preview').children[0].textContent,'1枚');
 f.el('send-consent').checked=true;f.el('prompt').value='describe';f.el('composer').requestSubmit();await tick();assert.equal(JSON.parse(f.calls[0].opts.body).attachment.images.length,1);assert.equal(f.el('attachment-preview').children.length,0);
});

test('reference conversion is sequential and logout aborts remaining work without publishing late previews',async()=>{
 const f=fixture(undefined,undefined,new Map(),{deferImages:true});await f.keys();f.el('file').files=Array.from({length:4},()=>({name:'reference.png',size:100,type:'image/png'}));const read=f.el('file').onchange();assert.equal(f.pendingImages.length,1);assert.equal(f.el('send').disabled,true);
 f.pendingImages[0].onload();await tick();assert.equal(f.pendingImages.length,2);f.el('logout').events.submit();await read;f.pendingImages[1].onload?.();await tick();assert.equal(f.pendingImages.length,2);assert.equal(f.el('attachment-preview').children.length,0);assert.equal(f.calls.length,0);
});
test('browser validates every converted PNG and enforces decoded per-image and aggregate limits',async()=>{
 const base=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=','base64');
 const large=bytes=>{const chunk=Buffer.alloc(bytes-base.length);chunk.writeUInt32BE(chunk.length-12,0);chunk.write('tEXt',4);return 'data:image/png;base64,'+Buffer.concat([base.subarray(0,-12),chunk,base.subarray(-12)]).toString('base64');};
 for(const [png,count] of [['data:image/png;base64,aW52YWxpZA==',1],[large(2*1024*1024+1),1],[large(1536*1024),3]]){
  const f=fixture(undefined,undefined,new Map(),{png});await f.keys();f.el('file').files=Array.from({length:count},()=>({name:'reference.png',size:100,type:'image/png'}));await f.el('file').onchange();assert.equal(f.el('attachment-preview').children.length,0);assert.equal(f.calls.length,0);assert.ok(f.el('status').textContent);
 }
});
