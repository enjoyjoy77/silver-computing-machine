// 録体(指令の記録・保存・再生)モジュール(Codex実装)。import無し。
const clamp=value=>Math.max(-1,Math.min(1,Number(value)||0));

export function createRokutai(options={}){
  const names=Array.isArray(options.names)&&options.names.length
    ? [...options.names]
    : ["ext","ud","lr","tw","cl"];

  const storageKey=String(
    options.storageKey||"bero-q2-rokutai-v1"
  );
  const sampleIntervalMs=Math.max(
    10,
    Number(options.sampleIntervalMs)||33
  );
  const onApply=typeof options.onApply==="function"
    ? options.onApply
    : ()=>{};
  const onStatus=typeof options.onStatus==="function"
    ? options.onStatus
    : ()=>{};

  let mode="idle";
  let take=null;
  let recordStartedAt=0;
  let lastSampleAt=-Infinity;
  let playbackStartedAt=0;
  let playbackIndex=0;

  function normalizeFrame(frame){
    if(!frame||typeof frame!=="object")return null;

    const t=Math.max(0,Number(frame.t)||0);
    const values={};

    for(const name of names){
      values[name]=clamp(frame[name]);
    }

    return {t,...values};
  }

  function normalizeTake(value){
    if(!value||typeof value!=="object")return null;
    if(!Array.isArray(value.frames)||value.frames.length===0)return null;

    const frames=value.frames
      .map(normalizeFrame)
      .filter(Boolean)
      .sort((a,b)=>a.t-b.t);

    if(frames.length===0)return null;

    const firstTime=frames[0].t;
    let previous=0;

    for(const frame of frames){
      frame.t=Math.max(previous,frame.t-firstTime);
      previous=frame.t;
    }

    return {
      version:1,
      createdAt:String(value.createdAt||new Date().toISOString()),
      names:[...names],
      duration:frames[frames.length-1].t,
      frames
    };
  }

  function readStored(){
    try{
      const text=localStorage.getItem(storageKey);
      if(!text)return null;
      return normalizeTake(JSON.parse(text));
    }catch(error){
      return null;
    }
  }

  function capture(elapsed,values){
    const frame={t:Math.max(0,elapsed)};

    for(const name of names){
      frame[name]=clamp(values&&values[name]);
    }

    take.frames.push(frame);
    take.duration=frame.t;
    lastSampleAt=elapsed;
  }

  function applyFrame(frame){
    const values={};

    for(const name of names){
      values[name]=clamp(frame[name]);
    }

    onApply(values);
  }

  function interpolate(a,b,elapsed){
    const span=Math.max(1e-6,b.t-a.t);
    const alpha=Math.max(0,Math.min(1,(elapsed-a.t)/span));
    const values={};

    for(const name of names){
      values[name]=a[name]+(b[name]-a[name])*alpha;
    }

    onApply(values);
  }

  function startRecord(timeMs=performance.now(),values={}){
    mode="recording";
    recordStartedAt=Number(timeMs)||0;
    lastSampleAt=-Infinity;
    playbackIndex=0;
    take={
      version:1,
      createdAt:new Date().toISOString(),
      names:[...names],
      duration:0,
      frames:[]
    };
    capture(0,values);
    onStatus("録体: 指令の記録を開始しました。");
    return true;
  }

  function stopRecord(timeMs=performance.now(),values={}){
    if(mode!=="recording")return false;

    const elapsed=Math.max(0,(Number(timeMs)||0)-recordStartedAt);

    if(
      !take.frames.length||
      elapsed-take.frames[take.frames.length-1].t>1
    ){
      capture(elapsed,values);
    }

    mode="idle";
    onStatus(
      `録体: 記録を停止しました（${take.frames.length}点・${(
        take.duration/1000
      ).toFixed(1)}秒）。`
    );
    return true;
  }

  function toggleRecord(timeMs=performance.now(),values={}){
    if(mode==="recording"){
      return stopRecord(timeMs,values);
    }

    if(mode==="playing")stopPlayback(false);
    return startRecord(timeMs,values);
  }

  function save(){
    if(mode==="recording"){
      stopRecord(performance.now(),take&&take.frames.at(-1));
    }

    if(!take||!take.frames.length){
      onStatus("録体: 保存できる記録がありません。");
      return false;
    }

    try{
      localStorage.setItem(storageKey,JSON.stringify(take));
      onStatus(
        `録体: 記録を保存しました（${take.frames.length}点）。`
      );
      return true;
    }catch(error){
      onStatus("録体: 保存に失敗しました。");
      return false;
    }
  }

  function load(){
    const stored=readStored();

    if(!stored){
      onStatus("録体: 保存済みの記録がありません。");
      return false;
    }

    take=stored;
    onStatus(
      `録体: 保存記録を読み込みました（${take.frames.length}点）。`
    );
    return true;
  }

  function startPlayback(timeMs=performance.now()){
    if(mode==="recording")stopRecord(timeMs,{});

    if((!take||!take.frames.length)&&!load()){
      return false;
    }

    mode="playing";
    playbackStartedAt=Number(timeMs)||0;
    playbackIndex=0;
    applyFrame(take.frames[0]);
    onStatus(
      `録体: 再生を開始しました（${(take.duration/1000).toFixed(1)}秒）。`
    );
    return true;
  }

  function stopPlayback(notify=true){
    if(mode!=="playing")return false;

    mode="idle";
    playbackIndex=0;

    if(notify)onStatus("録体: 再生を停止しました。");
    return true;
  }

  function togglePlayback(timeMs=performance.now()){
    if(mode==="playing")return stopPlayback();
    return startPlayback(timeMs);
  }

  function update(timeMs,values){
    const now=Number(timeMs)||0;

    if(mode==="recording"){
      const elapsed=Math.max(0,now-recordStartedAt);

      if(elapsed-lastSampleAt>=sampleIntervalMs){
        capture(elapsed,values);
      }
      return;
    }

    if(mode!=="playing"||!take||!take.frames.length)return;

    const elapsed=Math.max(0,now-playbackStartedAt);
    const frames=take.frames;
    const last=frames[frames.length-1];

    if(elapsed>=last.t){
      applyFrame(last);
      mode="idle";
      playbackIndex=0;
      onStatus("録体: 再生が完了しました。");
      return;
    }

    while(
      playbackIndex<frames.length-2&&
      frames[playbackIndex+1].t<=elapsed
    ){
      playbackIndex++;
    }

    interpolate(
      frames[playbackIndex],
      frames[playbackIndex+1],
      elapsed
    );
  }

  take=readStored();

  return {
    update,
    save,
    load,
    startRecord,
    stopRecord,
    toggleRecord,
    startPlayback,
    stopPlayback,
    togglePlayback,

    get mode(){
      return mode;
    },

    get recording(){
      return mode==="recording";
    },

    get playing(){
      return mode==="playing";
    },

    get hasTake(){
      return Boolean(take&&take.frames.length);
    },

    get duration(){
      return take?take.duration:0;
    },

    get frameCount(){
      return take?take.frames.length:0;
    },

    export(){
      return take?JSON.parse(JSON.stringify(take)):null;
    }
  };
}
