// Local-only extraction. Never fetch document links, execute macros, or upload files.
const fail = () => { throw Error('この文書は読めません。PDFは10ページ、Officeは20スライド/シート、2MB・抽出8000文字以内です。暗号化・マクロ・旧形式は未対応です。'); };
const check = signal => { if (signal?.aborted) throw new DOMException('Cancelled','AbortError'); };
function finish(text) { text=text.trim(); if (!text || text.length>8000 || /\bsk-[A-Za-z0-9_-]{12,}/.test(text)) fail(); return text; }

export async function extractPdf(bytes, signal, library) {
  check(signal); if (bytes.length>2*1024*1024 || new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') fail();
  const pdf=library || await import('./pdf.mjs');check(signal);
  if (!library) pdf.GlobalWorkerOptions.workerSrc='/my-chat/pdf.worker.mjs';
  const worker=library?null:new Worker('/my-chat/pdf.worker.mjs',{type:'module'});
  const task=pdf.getDocument({data:bytes,worker:worker?new pdf.PDFWorker({port:worker}):undefined,isEvalSupported:false,enableXfa:false,disableFontFace:true,useSystemFonts:false,useWasm:false,useWorkerFetch:false,maxImageSize:0,verbosity:0,stopAtErrors:true});
  let timer,rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
  const destroy=()=>{void Promise.resolve(task.destroy()).catch(()=>{});worker?.terminate();};
  const cancel=()=>{destroy();rejectAbort(new DOMException('Cancelled','AbortError'));};signal?.addEventListener('abort',cancel,{once:true});
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{cancel();reject(Error('PDFの解析が時間切れになりました。'));},10000);});
  try {
    return await Promise.race([timeout,aborted,(async()=>{
      const doc=await task.promise;check(signal);if (doc.numPages>10) fail();let text='';
      for(let n=1;n<=doc.numPages;n++) {
        check(signal);const page=await doc.getPage(n);const reader=page.streamTextContent().getReader();
        try { for(;;) {check(signal);const {done,value}=await reader.read();if(done)break;for(const item of value.items)if(typeof item.str==='string')text+=item.str+(item.hasEOL?'\n':' ');if(text.length>8000)fail();} }
        finally {await reader.cancel();page.cleanup();}text+='\n';
      }
      return finish(text);
    })()]);
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);destroy();}
}

// Parse the ZIP directory before decompression. Declared AND actual sizes are bounded.
export async function officeParts(bytes, signal) {
  check(signal);if(bytes.length>2*1024*1024||bytes.length<22)fail();
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0||end+22+v.getUint16(end+20,true)!==bytes.length||v.getUint16(end+4,true)||v.getUint16(end+6,true))fail();
  const count=v.getUint16(end+10,true),start=v.getUint32(end+16,true),size=v.getUint32(end+12,true);
  if(count>300||count!==v.getUint16(end+8,true)||start+size!==end)fail();
  const entries=[];let pos=start,total=0;const names=new Set();
  for(let i=0;i<count;i++) {
    if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)fail();
    const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),expanded=v.getUint32(pos+24,true),nl=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),local=v.getUint32(pos+42,true);
    if(pos+46+nl+extra+comment>end)fail();
    const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(pos+46,pos+46+nl));
    if(flags&1||![0,8].includes(method)||expanded>1024*1024||(total+=expanded)>8*1024*1024||names.has(name)||name.includes('..')||name.includes('\\')||name.startsWith('/')||/vbaProject|activeX|embeddings\//i.test(name))fail();
    names.add(name);if(local+30>start||v.getUint32(local,true)!==0x04034b50||v.getUint16(local+8,true)!==method||v.getUint16(local+6,true)!==flags)fail();
    const offset=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
    if(offset+compressed>start||new TextDecoder().decode(bytes.slice(local+30,local+30+v.getUint16(local+26,true)))!==name)fail();
    entries.push({name,method,compressed,expanded,offset});pos+=46+nl+extra+comment;
  }
  if(pos!==end)fail();const result=new Map();
  for(const e of entries) {
    if(!/^(\[Content_Types\]\.xml|word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/(sharedStrings|workbook)\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(e.name))continue;
    check(signal);const data=bytes.slice(e.offset,e.offset+e.compressed);let out=data;
    if(e.method===8) {
      const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();const chunks=[];let length=0;
      const abort=()=>{void reader.cancel();};signal?.addEventListener('abort',abort,{once:true});
      try {for(;;){check(signal);const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>e.expanded||length>1024*1024)fail();chunks.push(value);}out=new Uint8Array(length);let p=0;for(const chunk of chunks){out.set(chunk,p);p+=chunk.length;}}
      finally {signal?.removeEventListener('abort',abort);await reader.cancel();}
    }
    if(out.length!==e.expanded)fail();result.set(e.name,new TextDecoder('utf-8',{fatal:true}).decode(out));
  }
  return result;
}

export async function extractOffice(bytes, extension, signal, Parser=DOMParser) {
  const parts=await officeParts(bytes,signal);
  const xml=name=>{const source=parts.get(name);if(!source||/<!DOCTYPE|<!ENTITY/i.test(source))fail();const d=new Parser().parseFromString(source,'application/xml');if(d.getElementsByTagName('parsererror').length)fail();return d;};
  const nodes=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
  if(/macroEnabled|vbaProject/i.test(parts.get('[Content_Types].xml')||''))fail();
  xml('[Content_Types].xml');let text='';const add=t=>{text+=t+'\n';if(text.length>8000)fail();};
  if(extension==='docx') {for(const p of nodes(xml('word/document.xml'),'p'))add(nodes(p,'t').map(n=>n.textContent).join(''));}
  else if(extension==='pptx') {
    const slides=[...parts.keys()].filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(!slides.length||slides.length>20)fail();
    for(const name of slides){add('[スライド '+name.match(/slide(\d+)/)[1]+']');for(const p of nodes(xml(name),'p'))add(nodes(p,'t').map(n=>n.textContent).join(''));}
  } else if(extension==='xlsx') {
    const sheets=[...parts.keys()].filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(!sheets.length||sheets.length>20)fail();
    const strings=parts.has('xl/sharedStrings.xml')?nodes(xml('xl/sharedStrings.xml'),'si').map(n=>nodes(n,'t').map(t=>t.textContent).join('')):[];
    let cells=0;for(const name of sheets){add('['+name+']');for(const c of nodes(xml(name),'c')){if(++cells>2000)fail();const type=c.getAttribute('t');let value=nodes(c,'v')[0]?.textContent||'';if(type==='s'){if(!/^\d+$/.test(value)||!Object.hasOwn(strings,Number(value)))fail();value=strings[Number(value)];}if(type==='inlineStr')value=nodes(c,'t').map(t=>t.textContent).join('');const formula=nodes(c,'f').length;add((c.getAttribute('r')||'')+': '+value+(formula?' [保存済み計算結果・再計算なし]':''));}}
  } else fail();
  check(signal);return finish(text);
}
export async function extract(file,signal) {
  if(file.size>2*1024*1024)fail();const bytes=new Uint8Array(await file.arrayBuffer());check(signal);
  const extension=file.name.split('.').pop().toLowerCase();
  return extension==='pdf'?extractPdf(bytes,signal):extractOffice(bytes,extension,signal);
}
