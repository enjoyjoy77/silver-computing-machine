import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {DOMParser} from '../tools/my-chat-documents/node_modules/@xmldom/xmldom/lib/index.js';
import {extractOffice,extractPdf,officeParts} from '../functions/_lib/my-chat-ui/documents.mjs';
function zip(parts,{declared,method=8}={}) {
  const locals=[],centrals=[];let offset=0;
  for(const [name,value] of Object.entries(parts)) {
    const n=Buffer.from(name),raw=Buffer.from(value),data=method===8?deflateRawSync(raw):raw;
    const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(method,8);l.writeUInt32LE(data.length,18);l.writeUInt32LE(declared??raw.length,22);l.writeUInt16LE(n.length,26);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(method,10);c.writeUInt32LE(data.length,20);c.writeUInt32LE(declared??raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
    locals.push(l,n,data);centrals.push(c,n);offset+=l.length+n.length+data.length;
  }
  const central=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(parts).length,8);end.writeUInt16LE(Object.keys(parts).length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  return new Uint8Array(Buffer.concat([...locals,central,end]));
}
const types={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'};
const doc=text=>({...types,'word/document.xml':'<w:document xmlns:w="urn:word"><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:document>'});
const run=(parts,ext='docx',opts)=>extractOffice(zip(parts,opts),ext,undefined,DOMParser);
test('DOCX local extraction preserves text, not XML markup or linked content',async()=>{
  assert.equal(await run({...doc('A &amp; B &lt;script&gt;'),'word/_rels/document.xml.rels':'<Relationships><Relationship Target="https://example.com/private" TargetMode="External"/></Relationships>'}),'A & B <script>');
});
test('PPTX slides sort numerically; XLSX uses cached values and never executes formulas',async()=>{
  const slide=t=>'<a:p xmlns:a="urn:slide"><a:t>'+t+'</a:t></a:p>';
  const s=await run({...types,'ppt/slides/slide10.xml':slide('ten'),'ppt/slides/slide2.xml':slide('two')},'pptx');assert.ok(s.indexOf('two')<s.indexOf('ten'));
  const x=await run({...types,'xl/sharedStrings.xml':'<sst><si><t>Hello</t></si></sst>','xl/worksheets/sheet1.xml':'<worksheet><c r="A1" t="s"><v>0</v></c><c r="B1"><f>WEBSERVICE("https://example.com")</f><v>42</v></c></worksheet>'},'xlsx');
  assert.match(x,/Hello/);assert.match(x,/42/);assert.doesNotMatch(x,/WEBSERVICE|https:/);
});
test('encrypted/active/oversized/DOCTYPE and key-bearing documents fail closed',async()=>{
  for(const parts of [{...doc('safe'),'word/vbaProject.bin':'x'},doc('x'.repeat(8001)),doc('sk-'+'syntheticOnly'.repeat(3)),{...doc('safe'),'word/document.xml':'<!DOCTYPE foo [<!ENTITY x SYSTEM "https://example.com">]><foo>&x;</foo>'}])await assert.rejects(run(parts));
  await assert.rejects(run(doc('a'), 'docx',{declared:1024*1024+1}));
  await assert.rejects(run(doc('a'.repeat(10000)),'docx',{declared:1}));
  const encrypted=zip(doc('safe'));new DataView(encrypted.buffer).setUint16(6,1,true);await assert.rejects(officeParts(encrypted));
  const slides={...types};for(let i=1;i<=21;i++)slides['ppt/slides/slide'+i+'.xml']='<p/>';await assert.rejects(run(slides,'pptx'));
});
test('Office cancellation interrupts before parsing',async()=>{const c=new AbortController();c.abort();await assert.rejects(extractOffice(zip(doc('safe')),'docx',c.signal,DOMParser),{name:'AbortError'});});
function pdfMock(pages=1,content='Sample') {
  let options,destroyed=0;
  const task={promise:Promise.resolve({numPages:pages,async getPage(){return {streamTextContent:()=>new ReadableStream({start(c){c.enqueue({items:[{str:content}]});c.close();}}),cleanup(){}};}}),async destroy(){destroyed++;}};
  return {library:{getDocument(o){options=o;return task;}},get options(){return options;},get destroyed(){return destroyed;}};
}
test('PDF extraction disables eval/XFA/font/remote fetch and bounds pages/text',async()=>{
  const bytes=()=>new TextEncoder().encode('%PDF-1.7 synthetic mock');const m=pdfMock();assert.equal(await extractPdf(bytes(),undefined,m.library),'Sample');assert.equal(m.options.isEvalSupported,false);assert.equal(m.options.enableXfa,false);assert.equal(m.options.useWorkerFetch,false);assert.equal(m.options.disableFontFace,true);assert.ok(m.destroyed);
  for(const m of [pdfMock(11),pdfMock(1,'x'.repeat(8001)),pdfMock(1,'')])await assert.rejects(extractPdf(bytes(),undefined,m.library));
});
test('PDF cancellation destroys a pending parser and returns promptly',async()=>{
  let destroyed=0;const c=new AbortController();const promise=extractPdf(new TextEncoder().encode('%PDF-1.7'),c.signal,{getDocument:()=>({promise:new Promise(()=>{}),async destroy(){destroyed++;}})});c.abort();await assert.rejects(promise,{name:'AbortError'});assert.ok(destroyed);
});

test('actual vendored PDF.js extracts a synthetic PDF without remote assets',async()=>{
  const pdf=await import('../functions/_lib/my-chat-ui/pdf.mjs');
  pdf.GlobalWorkerOptions.workerSrc=new URL('../functions/_lib/my-chat-ui/pdf.worker.mjs',import.meta.url).href;
  const content='BT /F1 12 Tf 20 100 Td (Hello local PDF) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'];
  let source='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(source.length);source+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
  const xref=source.length;source+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  assert.equal(await extractPdf(new TextEncoder().encode(source),undefined,pdf),'Hello local PDF');
});
