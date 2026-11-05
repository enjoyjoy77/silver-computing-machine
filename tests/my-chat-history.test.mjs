// Actual IndexedDB API semantics via fake-indexeddb; no browser profiles, credentials or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto,randomBytes} from 'node:crypto';
import {deflateSync} from 'node:zlib';
const require=createRequire(new URL('./my-chat-storage-deps/package.json',import.meta.url));
const {IDBFactory,IDBObjectStore}=require('fake-indexeddb');
const source=readFileSync(new URL('../functions/_lib/my-chat-ui/history.js',import.meta.url),'utf8');
const window={};vm.runInNewContext(source,{window,crypto:webcrypto,TextEncoder,Blob,Uint8Array,atob,btoa,setTimeout,clearTimeout,DOMException});
const H=window.MyChatHistory,LEGACY=H.legacyKey,NAME='my-chat-history';
const plain=x=>JSON.parse(JSON.stringify(x));
const small='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4xkAAAAASUVORK5CYII=';
const chat=(id,title,image)=>({id,title,messages:[{role:'user',content:title},{role:'assistant',content:'answer',...(image?{image}:{})}]});
function fixture(legacy){const map=new Map(legacy===undefined?[]:[[LEGACY,legacy]]);const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};const indexedDB=new IDBFactory();const create=()=>H.createStore({indexedDB,storage});return {map,storage,indexedDB,create};}
const dbOpen=f=>new Promise((resolve,reject)=>{const r=f.indexedDB.open(NAME,2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function state(f){const db=await dbOpen(f);try{return await req(db.transaction('state').objectStore('state').get('current'));}finally{db.close();}}
const tick=()=>new Promise(r=>setImmediate(r));
function pngNoise(){
 const width=512,height=512;const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const pixels=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)randomBytes(width*4).copy(pixels,y*(width*4+1)+1);
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const chunk=(type,data)=>{const name=Buffer.from(type),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([head,name,data,tail]);};
 return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
test('migration preserves legacy unchanged, verifies multiple chats/images and separates Blob records',async()=>{
 const chats=[chat(1,'A',small),chat(2,'B',small)],raw=JSON.stringify({version:1,chats}),f=fixture(raw),store=f.create();const loaded=await store.load();assert.deepEqual(plain(loaded.chats),chats);assert.equal(f.map.get(LEGACY),raw);assert.equal((await state(f)).phase,'ready');
 const db=await dbOpen(f);const images=await req(db.transaction('images').objectStore('images').getAll());db.close();assert.equal(images.length,1);assert.ok(images[0].blob instanceof Blob);assert.ok(!(JSON.stringify(await state(f))).includes('base64'));store.close();const reloaded=await f.create().load();assert.deepEqual(plain(reloaded.chats),chats);assert.equal(f.map.get(LEGACY),raw);
});
test('two realistic PNG outputs above old 4MiB snapshot cap and multiple new chats persist after reload',async()=>{
 const a=pngNoise(),b=pngNoise(),chats=[chat(1,'A',a),chat(2,'B',b)];assert.ok(JSON.stringify({version:1,chats}).length*2>4*1024*1024);
 const f=fixture(),store=f.create();let base=await store.load();base=await store.save([chats[0]],base);base=await store.save(chats,base);base=await store.save([...chats,chat(3,'C')],base);store.close();const restored=await f.create().load();assert.equal(restored.chats.length,3);assert.equal(restored.chats[0].messages[1].image,a);assert.equal(restored.chats[1].messages[1].image,b);assert.equal(f.map.has(LEGACY),false);
});
test('migration write failure is atomic and retry recovers without touching legacy',async()=>{
 const raw=JSON.stringify({version:1,chats:[chat(1,'legacy',small)]}),f=fixture(raw),store=f.create(),put=IDBObjectStore.prototype.put;
 try{IDBObjectStore.prototype.put=function(...args){if(this.name==='images')throw new DOMException('full','QuotaExceededError');return put.apply(this,args);};await assert.rejects(store.load(),/full/);}finally{IDBObjectStore.prototype.put=put;}
 assert.equal(f.map.get(LEGACY),raw);assert.equal(await state(f),undefined);assert.equal((await store.load()).chats.length,1);
});
test('interrupted migration remains pending until read-back verification completes on next load',async()=>{
 const raw=JSON.stringify({version:1,chats:[chat(1,'legacy',small)]}),f=fixture(raw),store=f.create(),put=IDBObjectStore.prototype.put;
 try{IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='state'&&value?.phase==='ready')throw new DOMException('interrupted','QuotaExceededError');return put.call(this,value,...rest);};await assert.rejects(store.load(),/interrupted/);}finally{IDBObjectStore.prototype.put=put;}
 assert.equal(f.map.get(LEGACY),raw);assert.equal((await state(f)).phase,'pending');store.close();assert.equal((await f.create().load()).chats.length,1);assert.equal((await state(f)).phase,'ready');
});
test('corrupt pending Blob fails verification without marking migration complete or replacing legacy',async()=>{
 const raw=JSON.stringify({version:1,chats:[chat(1,'legacy',small)]}),f=fixture(raw),store=f.create(),put=IDBObjectStore.prototype.put;
 try{IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='images')value={...value,blob:new Blob(['bad'],{type:'image/png'}),size:3};return put.call(this,value,...rest);};await assert.rejects(store.load(),/VERIFY/);}finally{IDBObjectStore.prototype.put=put;}
 assert.equal((await state(f)).phase,'pending');assert.equal(f.map.get(LEGACY),raw);assert.equal(store.readLegacy().length,1);
});
test('unavailable IndexedDB, blocked legacy access and malformed legacy never change previous data',async()=>{
 const raw=JSON.stringify({version:1,chats:[chat(1,'old')]}),f=fixture(raw);await assert.rejects(H.createStore({indexedDB:null,storage:f.storage}).load(),/UNAVAILABLE/);assert.equal(f.map.get(LEGACY),raw);
 const blocked={getItem(){throw Error('blocked');}};await assert.rejects(H.createStore({indexedDB:f.indexedDB,storage:blocked}).load(),/blocked/);assert.equal(f.map.get(LEGACY),raw);
 for(const legacy of ['{bad',JSON.stringify({version:1,chats:[chat(1,'bad','javascript:alert(1)')]})]){const bad=fixture(legacy);await assert.rejects(bad.create().load());assert.equal(bad.map.get(LEGACY),legacy);assert.equal(await state(bad),undefined);}
});
test('both tabs saving before storage-event delivery cannot overwrite a newer revision',async()=>{
 const f=fixture(),a=f.create(),b=f.create();const aa=await a.load(),bb=await b.load();const out=await Promise.allSettled([a.save([chat(1,'A')],aa),b.save([chat(1,'B')],bb)]);assert.equal(out.filter(x=>x.status==='fulfilled').length,1);assert.equal(out.find(x=>x.status==='rejected').reason.code,'CONFLICT');assert.equal((await a.load()).chats.length,1);
});
test('clear versus save is atomic; a stale queued save never resurrects deleted history',async()=>{
 const f=fixture(),a=f.create();let base=await a.load();base=await a.save([chat(1,'old')],base);const b=f.create(),old=await b.load();
 const outcomes=await Promise.allSettled([a.clear(base),b.save([chat(1,'old'),chat(2,'new')],old)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 const current=await a.load();if(outcomes[0].status==='fulfilled'){assert.equal(current.chats.length,0);assert.equal(current.deleted,true);await assert.rejects(b.save([chat(1,'stale')],old),/CONFLICT/);}else{assert.equal(current.chats.length,2);await a.clear(current);assert.equal((await b.load()).chats.length,0);}
});
test('logout/expiry while transaction is queued aborts late history writes',async()=>{
 const f=fixture(),store=f.create(),base=await store.load(),db=await dbOpen(f);let hold=true;const blocking=db.transaction(['state','images'],'readwrite'),os=blocking.objectStore('state');const spin=()=>{const r=os.get('current');r.onsuccess=()=>{if(hold)spin();};};spin();
 let authenticated=true;const controller=new AbortController();const save=store.save([chat(1,'late')],base,{guard:()=>authenticated,signal:controller.signal});const rejected=assert.rejects(save,/STALE/);await tick();authenticated=false;controller.abort();hold=false;await rejected;db.close();assert.equal((await store.load()).chats.length,0);
});
test('quota failure during ordinary save rolls back all metadata/images and retains previous history',async()=>{
 const f=fixture(),store=f.create();let base=await store.load();base=await store.save([chat(1,'old',small)],base);const put=IDBObjectStore.prototype.put;
 try{IDBObjectStore.prototype.put=function(...args){if(this.name==='images')throw new DOMException('quota','QuotaExceededError');return put.apply(this,args);};await assert.rejects(store.save([chat(1,'old',small),chat(2,'new',small)],base),/quota/);}finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual(plain((await store.load()).chats),[chat(1,'old',small)]);
});
test('old-version legacy writes are preserved and reported, never silently reimported over canonical data',async()=>{
 const raw=JSON.stringify({version:1,chats:[chat(1,'old')]}),f=fixture(raw),store=f.create();let base=await store.load();base=await store.save([chat(1,'old'),chat(2,'new')],base);const changed=JSON.stringify({version:1,chats:[chat(3,'old-tab-write')]});f.map.set(LEGACY,changed);
 const loaded=await store.load();assert.equal(loaded.conflict,true);assert.equal(loaded.chats.length,2);assert.equal(f.map.get(LEGACY),changed);await assert.rejects(store.save([chat(4,'attempt')],loaded),/LEGACY_CHANGED/);assert.equal(store.readLegacy()[0].title,'old-tab-write');
});
test('explicit clear removes legacy, and a tombstone prevents resurrection if removal fails or an old tab rewrites',async()=>{
 for(const failRemoval of [false,true]){const raw=JSON.stringify({version:1,chats:[chat(1,'old',small)]}),f=fixture(raw),store=f.create(),base=await store.load();if(failRemoval)f.storage.removeItem=()=>{throw Error('blocked');};const cleared=await store.clear(base);assert.equal(cleared.legacyRemoved,!failRemoval);const again=await store.load();assert.equal(again.chats.length,0);assert.equal(again.deleted,true);assert.equal(again.conflict,failRemoval);
 f.map.set(LEGACY,raw);const oldTab=await store.load();assert.equal(oldTab.chats.length,0);assert.equal(oldTab.conflict,true);}
});
test('secret fields and credential-like text are excluded, limits reject whole snapshots without trimming',async()=>{
 const f=fixture(),store=f.create(),base=await store.load();const c={...chat(1,'safe'),apiKey:'synthetic-secret',passphrase:'synthetic-pass',messages:[{role:'user',content:'sk-'+ 'syntheticNotReal'.repeat(3),audio:'private-audio',file:'original-file'}]};let next=await store.save([c],base);const loaded=await store.load();assert.deepEqual(Object.keys(loaded.chats[0]).sort(),['id','messages','title']);assert.equal(loaded.chats[0].messages[0].content,'[API key removed]');assert.deepEqual(Object.keys(loaded.chats[0].messages[0]).sort(),['content','role']);
 await assert.rejects(store.save(Array.from({length:101},(_,i)=>chat(i+1,'too many')),next),/LIMIT/);assert.equal((await store.load()).chats.length,1);
});

test('migration read-back rejects dropped conversation metadata before committing the completion marker',async()=>{
 const raw=JSON.stringify({version:1,chats:[chat(1,'A'),chat(2,'B')]}),f=fixture(raw),store=f.create(),put=IDBObjectStore.prototype.put;
 try{IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='state'&&value?.phase==='pending')value={...value,chats:value.chats.slice(0,1)};return put.call(this,value,...rest);};await assert.rejects(store.load(),/VERIFY/);}finally{IDBObjectStore.prototype.put=put;}
 assert.equal((await state(f)).phase,'pending');assert.equal(f.map.get(LEGACY),raw);assert.equal(store.readLegacy().length,2);
});


test('provider metadata survives upgrade from database v1 and stale old clients cannot overwrite v2',async()=>{
 const f=fixture(JSON.stringify({version:1,chats:[chat(1,'legacy',small)]})),oldWindow={};vm.runInNewContext(source.replace('indexedDB.open(dbName,2)','indexedDB.open(dbName,1)'),{window:oldWindow,crypto:webcrypto,TextEncoder,Blob,Uint8Array,atob,btoa,setTimeout,clearTimeout,DOMException});
 const old=oldWindow.MyChatHistory.createStore({indexedDB:f.indexedDB,storage:f.storage});const a=await old.load({guard:()=>true});assert.equal(a.chats[0].provider,undefined);const legacy=f.map.get(LEGACY);
 const current=f.create(),b=await current.load({guard:()=>true});const google={...chat(2,'Google',small),provider:'gemini'};await current.save([...b.chats,google],b,{guard:()=>true});
 const read=await f.create().load({guard:()=>true});assert.equal(read.chats.length,2);assert.equal(read.chats[0].provider,undefined);assert.equal(read.chats[1].provider,'gemini');assert.equal(read.chats[1].messages[1].image,small);assert.equal(f.map.get(LEGACY),legacy);
 await assert.rejects(old.load({guard:()=>true}));assert.equal((await current.load({guard:()=>true})).chats.length,2);
 assert.throws(()=>H.validate({version:1,chats:[{...chat(3,'bad'),provider:'unknown'}]}));
});
