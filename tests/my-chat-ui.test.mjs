// Browser-independent UI behavior tests. No real browser, microphone or API calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../functions/_lib/my-chat-ui/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../functions/_lib/my-chat-ui/index.html',import.meta.url),'utf8');
const key='sk-'+'notARealKeyForUnitTestsOnly'.repeat(2);
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(fetcher,mediaRequest) {
  class Element {
    value='';textContent='';children=[];disabled=false;style={};events={};open=false;
    classList={remove(){},toggle(){},contains(){return false;}};
    append(e){this.children.push(e);} replaceChildren(){this.children=[];}
    setAttribute(){} focus(){} addEventListener(k,f){this.events[k]=f;}
    showModal(){this.open=true;} close(){this.open=false;this.events.close?.();}
    click(){if(!this.disabled)this.onclick?.();} requestSubmit(){this.onsubmit?.({preventDefault(){}});}
  }
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>['#'+m[1],new Element()]));
  elements.set('.brand',new Element());
  const windowEvents={},documentEvents={},timers=[],calls=[],spoken=[];
  const document={body:new Element(),hidden:false,querySelector(s){assert.ok(elements.has(s),'missing selector '+s);return elements.get(s);},querySelectorAll(){return [];},createElement(){return new Element();},addEventListener(k,f){documentEvents[k]=f;}};
  let stoppedTracks=0;
  const stream={getTracks:()=>[{stop(){stoppedTracks++;}}]};
  const recorders=[];
  class Recorder {
    static isTypeSupported(t){return t==='audio/mp4';}
    constructor(s,o){this.state='inactive';this.mimeType=o.mimeType;recorders.push(this);}
    start(){this.state='recording';} stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['fake'],{type:'audio/mp4'})});this.onstop?.();});}
  }
  const window={MediaRecorder:Recorder,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{cancel(){},speak(u){spoken.push(u.text);}},addEventListener(k,f){windowEvents[k]=f;}};
  const context={window,document,navigator:{mediaDevices:{getUserMedia:mediaRequest||(()=>Promise.resolve(stream))}},MediaRecorder:Recorder,SpeechSynthesisUtterance:window.SpeechSynthesisUtterance,Blob,AbortController,queueMicrotask,location:{replace(){}},setTimeout(f,ms){timers.push({f,ms});return timers.length;},clearTimeout(){},setInterval(){},fetch:async(url,opts)=>{calls.push({url,opts});return fetcher?fetcher(url,opts):Response.json(url.endsWith('transcribe')?{text:'話した内容'}:{text:'返答'});}};
  vm.runInNewContext(src,context);
  const el=id=>elements.get('#'+id);
  const keys=()=>{el('api-key').value=key;el('apply-keys').click();};
  return {el,keys,calls,windowEvents,documentEvents,recorders,spoken,timers,stream,get stoppedTracks(){return stoppedTracks;}};
}
test('key setup never sends or persists keys; submit is single-flight and renders text safely',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));f.keys();
  assert.equal(f.calls.length,0);assert.equal(f.el('api-key').value,'');
  f.el('prompt').value='質問';f.el('composer').requestSubmit();f.el('composer').requestSubmit();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].opts.headers['X-My-Chat-Key'],key);
  resolve(Response.json({text:'<script>not HTML</script>'}));await tick();
  assert.equal(f.el('messages').children[1].textContent,'<script>not HTML</script>');assert.equal(f.el('prompt').value,'');
  f.windowEvents.pagehide();assert.equal(f.el('messages').children.length,0);
  f.el('prompt').value='次';f.el('composer').requestSubmit();await tick();assert.equal(f.calls.length,1);assert.equal(f.el('settings-dialog').open,true);
  assert.doesNotMatch(src,/localStorage|sessionStorage|indexedDB|innerHTML/);
});
test('network errors retain draft, allow retry, and stop aborts in-flight requests',async()=>{
  const f=fixture(async(url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')))));
  f.keys();f.el('prompt').value='残したい下書き';f.el('composer').requestSubmit();f.el('stop').click();await tick();
  assert.equal(f.calls[0].opts.signal.aborted,true);assert.equal(f.el('prompt').value,'残したい下書き');assert.equal(f.el('send').disabled,false);
});
test('late microphone permission after stop closes tracks without recording',async()=>{
  let allow;const f=fixture(undefined,()=>new Promise(r=>allow=r));f.keys();f.el('record').click();f.el('voice-stop').click();allow(f.stream);await tick();
  assert.equal(f.recorders.length,0);assert.equal(f.stoppedTracks,1);assert.equal(f.calls.length,0);
});
test('voice uses supported MIME, transcribes then chats and reads; close/logout discard recording',async()=>{
  const f=fixture();f.keys();f.el('record').click();await tick();assert.equal(f.recorders[0].mimeType,'audio/mp4');
  f.el('finish-record').click();await tick();await tick();assert.equal(f.calls.length,2);assert.match(f.calls[0].url,/transcribe$/);assert.match(f.calls[1].url,/chat$/);assert.equal(f.spoken[0],'返答');assert.equal(f.calls[0].opts.headers['X-My-Chat-Key'],key);assert.equal(f.calls[1].opts.headers['X-My-Chat-Key'],key);
  f.el('record').click();await tick();f.el('voice-dialog').close();await tick();assert.equal(f.calls.length,2);assert.equal(f.recorders[1].state,'inactive');
  f.el('record').click();await tick();f.el('logout').events.submit();await tick();assert.equal(f.calls.length,2);assert.equal(f.recorders[2].state,'inactive');
});
test('authentication expiry clears keys and stops microphone',async()=>{
  const f=fixture(()=>new Response('{}',{status:401}));f.keys();f.el('record').click();await tick();await f.windowEvents.pageshow();await tick();
  assert.equal(f.recorders[0].state,'inactive');assert.equal(f.el('api-key').value,'');
});
