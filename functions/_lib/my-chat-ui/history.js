/* Browser-local history only. Never receives credentials, uploads or audio. */
'use strict';
(() => {
  const LEGACY='my-chat.history.v1', NAME='my-chat-history', CAP=100*1024*1024;
  const fail=code=>Object.assign(new Error(code),{code});
  const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const fingerprint=raw=>raw===null?Promise.resolve('none'):digest(new TextEncoder().encode(raw));
  function validate(raw){
    if(!raw||raw.version!==1||!Array.isArray(raw.chats))throw fail('FORMAT');if(raw.chats.length>100)throw fail('LIMIT');
    let count=0;const ids=new Set();
    const text=(value,max)=>{if(typeof value!=='string'||value.length>max)throw fail('FORMAT');return value.replace(/\bsk-[A-Za-z0-9_-]{12,}/g,'[API key removed]');};
    return {version:1,chats:raw.chats.map(c=>{
      if(!Number.isSafeInteger(c.id)||c.id<1||ids.has(c.id)||!Array.isArray(c.messages))throw fail('FORMAT');ids.add(c.id);
      return {id:c.id,title:text(c.title,100),messages:c.messages.map(m=>{
        if(++count>2000)throw fail('LIMIT');if(!['user','assistant'].includes(m.role))throw fail('FORMAT');const out={role:m.role,content:text(m.content,100000)};
        if(m.image!==undefined){if(typeof m.image!=='string'||m.image.length>15000022||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(m.image))throw fail('FORMAT');out.image=m.image;}
        if(m.citations!==undefined){if(!Array.isArray(m.citations)||m.citations.length>100)throw fail('FORMAT');out.citations=m.citations.map(c=>{
          const url=new URL(c.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>2000||/sk-[A-Za-z0-9_-]{12,}/.test(url.href)||!Number.isInteger(c.start)||!Number.isInteger(c.end)||c.start<0||c.end>out.content.length||c.start>=c.end)throw fail('FORMAT');
          return {start:c.start,end:c.end,url:url.href,title:text(c.title||'',500)};
        });}return out;
      })};
    })};
  }
  function bytesFromImage(data){const binary=atob(data.slice(22));if(binary.length>11*1024*1024)throw fail('LIMIT');return Uint8Array.from(binary,c=>c.charCodeAt(0));}
  function imageFromBytes(bytes){let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return 'data:image/png;base64,'+btoa(binary);}
  async function pack(chats,guard){
    const clean=validate({version:1,chats}).chats,images=new Map();let size=0;
    for(const chat of clean)for(const message of chat.messages){
      if(!guard())throw fail('STALE');
      if(message.image){const bytes=bytesFromImage(message.image),id=await digest(bytes);if(!images.has(id)){images.set(id,{id,blob:new Blob([bytes],{type:'image/png'}),size:bytes.length});size+=bytes.length;if(size>CAP)throw fail('LIMIT');}message.imageRef=id;delete message.image;}
    }
    size+=JSON.stringify(clean).length*2;if(size>CAP)throw fail('LIMIT');return {chats:clean,images:[...images.values()],size};
  }
  async function unpack(state,records,guard){
    if(!state||state.schema!==1||!Number.isSafeInteger(state.revision)||state.revision<1||!['pending','ready','deleted'].includes(state.phase)||!Array.isArray(state.chats))throw fail('FORMAT');
    const images=new Map();let size=JSON.stringify(state.chats).length*2;if(size>CAP)throw fail('LIMIT');
    for(const record of records){if(!guard())throw fail('STALE');if(!(record.blob instanceof Blob)||record.blob.type!=='image/png'||record.size!==record.blob.size||record.size>11*1024*1024)throw fail('FORMAT');size+=record.size;if(size>CAP)throw fail('LIMIT');const bytes=new Uint8Array(await record.blob.arrayBuffer());if(await digest(bytes)!==record.id)throw fail('VERIFY');images.set(record.id,imageFromBytes(bytes));}
    const chats=state.chats.map(c=>({...c,messages:c.messages.map(m=>{const out={...m};if(out.imageRef!==undefined){if(!images.has(out.imageRef))throw fail('VERIFY');out.image=images.get(out.imageRef);delete out.imageRef;}return out;})}));
    if(state.phase==='deleted'&&(chats.length||records.length))throw fail('FORMAT');return validate({version:1,chats}).chats;
  }
  function createStore({indexedDB=window.indexedDB,storage=window.localStorage,dbName=NAME}={}){
    let database;
    const raw=()=>storage.getItem(LEGACY)??null;
    async function open(){
      if(database)return database;if(!indexedDB?.open)throw fail('UNAVAILABLE');
      return new Promise((resolve,reject)=>{let done=false;const req=indexedDB.open(dbName,1),timer=setTimeout(()=>{done=true;reject(fail('OPEN_TIMEOUT'));},5000);
        req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('state'))db.createObjectStore('state');if(!db.objectStoreNames.contains('images'))db.createObjectStore('images',{keyPath:'id'});};
        req.onerror=()=>{clearTimeout(timer);if(!done){done=true;reject(req.error);}};req.onblocked=()=>{clearTimeout(timer);done=true;reject(fail('BLOCKED'));};
        req.onsuccess=()=>{clearTimeout(timer);if(done){req.result.close();return;}database=req.result;database.onversionchange=()=>{database.close();database=null;};done=true;resolve(database);};
      });
    }
    async function read(){const db=await open();const tx=db.transaction(['state','images'],'readonly');const completed=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||fail('ABORT'));});const [state,images]=await Promise.all([request(tx.objectStore('state').get('current')),request(tx.objectStore('images').getAll()),completed]);return {state,images};}
    // All canonical history writes use the same readwrite transaction scope.
    // Revision comparison and clear/save occur atomically; no unsafe lock fallback.
    async function transact(change,{guard=()=>true,signal}={}){
      const db=await open();if(!guard()||signal?.aborted)throw fail('STALE');
      return new Promise((resolve,reject)=>{
        const tx=db.transaction(['state','images'],'readwrite'),states=tx.objectStore('state'),images=tx.objectStore('images');let error,result;
        const abort=()=>{error=fail('STALE');try{tx.abort();}catch{}};
        signal?.addEventListener('abort',abort,{once:true});
        tx.oncomplete=()=>{signal?.removeEventListener('abort',abort);resolve(result);};tx.onabort=()=>{signal?.removeEventListener('abort',abort);reject(error||tx.error||fail('ABORT'));};
        const first=states.get('current');first.onsuccess=()=>{try{if(!guard()||signal?.aborted){abort();return;}result=change(first.result,states,images);const final=states.get('current');final.onsuccess=()=>{if(!guard()||signal?.aborted)abort();};}catch(e){error=e;tx.abort();}};
      });
    }
    async function load({guard=()=>true,signal}={}){
      const legacyRaw=raw(),legacyFingerprint=await fingerprint(legacyRaw);let found=await read();
      if(!guard())throw fail('STALE');
      if(!found.state){
        const snapshot=legacyRaw===null?{version:1,chats:[]}:JSON.parse(legacyRaw);const packed=await pack(validate(snapshot).chats,guard);
        await transact((state,states,images)=>{
          if(state)return;if(raw()!==legacyRaw)throw fail('LEGACY_CHANGED');for(const record of packed.images)images.put(record);
          states.put({schema:1,phase:'pending',revision:1,legacyFingerprint,chats:packed.chats},'current');
        },{guard,signal});found=await read();
      }
      let chats=await unpack(found.state,found.images,guard);
      if(found.state.phase==='pending'){
        if(found.state.legacyFingerprint!==legacyFingerprint)throw fail('LEGACY_CHANGED');
        const expected=validate(legacyRaw===null?{version:1,chats:[]}:JSON.parse(legacyRaw)).chats;
        if(JSON.stringify(chats)!==JSON.stringify(expected))throw fail('VERIFY');
        // Read-back verification above must finish before migration is marked ready.
        const revision=found.state.revision;
        await transact((state,states)=>{
          if(state.revision!==revision||state.phase!=='pending')return;
          if(raw()!==legacyRaw||state.legacyFingerprint!==legacyFingerprint)throw fail('LEGACY_CHANGED');
          states.put({...state,phase:'ready',revision:revision+1},'current');
        },{guard,signal});found=await read();chats=await unpack(found.state,found.images,guard);
      }
      if(!guard())throw fail('STALE');
      const latestRaw=raw(),latestFingerprint=await fingerprint(latestRaw);
      return {chats,revision:found.state.revision,legacyFingerprint:latestFingerprint,conflict:latestFingerprint!==found.state.legacyFingerprint,deleted:found.state.phase==='deleted'};
    }
    async function save(chats,baseline,{guard=()=>true,signal}={}){
      const legacyRaw=raw(),legacyFingerprint=await fingerprint(legacyRaw);if(legacyFingerprint!==baseline.legacyFingerprint)throw fail('LEGACY_CHANGED');const packed=await pack(chats,guard);
      return transact((state,states,images)=>{
        if(!state||state.phase==='pending'||state.revision!==baseline.revision)throw fail('CONFLICT');
        if(state.legacyFingerprint!==legacyFingerprint||raw()!==legacyRaw)throw fail('LEGACY_CHANGED');
        images.clear();for(const record of packed.images)images.put(record);
        const revision=state.revision+1;states.put({schema:1,phase:'ready',revision,legacyFingerprint,chats:packed.chats},'current');return {revision,legacyFingerprint};
      },{guard,signal});
    }
    async function clear(baseline,{guard=()=>true,signal}={}){
      const legacyRaw=raw(),legacyFingerprint=await fingerprint(legacyRaw);if(legacyFingerprint!==baseline.legacyFingerprint)throw fail('LEGACY_CHANGED');
      const result=await transact((state,states,images)=>{
        if(!state||state.phase==='pending'||state.revision!==baseline.revision)throw fail('CONFLICT');if(raw()!==legacyRaw)throw fail('LEGACY_CHANGED');
        images.clear();const revision=state.revision+1;
        // Commit the tombstone first. A failure to remove the backup must never re-import it.
        states.put({schema:1,phase:'deleted',revision,legacyFingerprint:'none',chats:[]},'current');return {revision,legacyFingerprint:'none'};
      },{guard,signal});
      let legacyRemoved=false;try{if(guard()&&!signal?.aborted&&raw()===legacyRaw){storage.removeItem(LEGACY);legacyRemoved=true;}}catch{}
      return {...result,legacyRemoved};
    }
    return {load,save,clear,readLegacy:()=>validate(raw()===null?{version:1,chats:[]}:JSON.parse(raw())).chats,close(){database?.close();database=null;}};
  }
  window.MyChatHistory={createStore,validate,limits:{bytes:CAP,chats:100,messages:2000},legacyKey:LEGACY};
})();
