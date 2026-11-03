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
  for(const mode of ['chat','web']) {f.el('mode').value=mode;f.el('prompt').value='hello';f.el('send-consent').checked=true;f.el('composer').requestSubmit();await tick();assert.equal(JSON.parse(f.calls.at(-1).opts.body).model,'gpt-6-luna');}
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
function fixture(fetcher,mediaRequest,storage=new Map()) {
  let clock=Date.now();class TestDate extends Date {static now(){return clock;}}
  class Element {
    value='';textContent='';children=[];disabled=false;style={};events={};open=false;
    classList={remove(){},toggle(){},contains(){return false;}};
    append(...nodes){this.children.push(...nodes);} replaceChildren(){this.children=[];}
    setAttribute(){} focus(){} addEventListener(k,f){this.events[k]=f;}
    showModal(){this.open=true;} close(){this.open=false;this.events.close?.();}
    click(){if(!this.disabled)this.onclick?.();} requestSubmit(){this.onsubmit?.({preventDefault(){}});}
  }
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>['#'+m[1],new Element()]));
  elements.set('.brand',new Element());
  const windowEvents={},documentEvents={},timers=[],calls=[],spoken=[],audios=[],revoked=[],redirects=[],storageWrites=[];
  let sessionFetcher=()=>Response.json({expires:Math.floor(Date.now()/1000)+28800});
  class TestURL extends URL {static createObjectURL(){return "blob:synthetic-audio";}static revokeObjectURL(url){revoked.push(url);}}
  class TestAudio {constructor(src){this.src=src;audios.push(this);}async play(){this.played=true;}pause(){this.paused=true;}}
  const document={body:new Element(),hidden:false,querySelector(s){assert.ok(elements.has(s),'missing selector '+s);return elements.get(s);},querySelectorAll(){return [];},createElement(){return new Element();},createTextNode(text){const e=new Element();e.textContent=text;return e;},addEventListener(k,f){documentEvents[k]=f;}};
  let stoppedTracks=0;
  const stream={getTracks:()=>[{stop(){stoppedTracks++;}}]};
  const recorders=[];
  class Recorder {
    static isTypeSupported(t){return t==='audio/mp4';}
    constructor(s,o){this.state='inactive';this.mimeType=o.mimeType;recorders.push(this);}
    start(){this.state='recording';} stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['fake'],{type:'audio/mp4'})});this.onstop?.();});}
  }
  const window={localStorage:{getItem:k=>storage.get(k),setItem(k,v){storageWrites.push([k,v]);storage.set(k,v);},removeItem(k){storage.delete(k);}},MediaRecorder:Recorder,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{cancel(){},speak(u){spoken.push(u.text);}},addEventListener(k,f){windowEvents[k]=f;}};
  const context={Date:TestDate,window,document,URL:TestURL,Audio:TestAudio,navigator:{mediaDevices:{getUserMedia:mediaRequest||(()=>Promise.resolve(stream))}},MediaRecorder:Recorder,SpeechSynthesisUtterance:window.SpeechSynthesisUtterance,Blob,AbortController,queueMicrotask,location:{replace(path){redirects.push(path);}},setTimeout(f,ms){timers.push({f,ms});return timers.length;},clearTimeout(){},setInterval(){},fetch:async(url,opts)=>{if(url==='/my-chat/session')return sessionFetcher(url,opts);calls.push({url,opts});return fetcher?fetcher(url,opts):Response.json(url.endsWith('transcribe')?{text:'話した内容'}:{text:'返答'});}};
  vm.runInNewContext(src,context);
  const el=id=>elements.get('#'+id);
  const keys=async()=>{await windowEvents.pageshow();el('api-key').value=key;el('apply-keys').click();};
  return {advance(ms){clock+=ms;},el,keys,calls,window,storage,storageWrites,redirects,setSession(fn){sessionFetcher=fn;},windowEvents,documentEvents,recorders,spoken,timers,stream,audios,revoked,get stoppedTracks(){return stoppedTracks;}};
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
  const body=JSON.parse(f.calls[0].opts.body);assert.equal(body.web,true);assert.equal(body.consent,true);assert.equal(f.el('send-consent').checked,false);
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
