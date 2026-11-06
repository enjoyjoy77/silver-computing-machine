import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../functions/_lib/my-chat-ui/images.js',import.meta.url),'utf8'),{window,DOMException});
const {dimensions,inspect}=window.MyChatImages;
function png(w,h){const b=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a0000000d49484452','hex').copy(b);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return b;}
test('predecode PNG pixel boundary and malformed/huge dimensions reject without decoding',()=>{
 assert.equal(dimensions(png(8000,5000),'image/png').width,8000);
 for(const b of [png(8001,5000),png(0xffffffff,0xffffffff)])assert.throws(()=>dimensions(b,'image/png'),/4000万画素/);
 for(const b of [Buffer.alloc(0),png(0,1),png(1,0),png(1,1).subarray(0,20)])assert.throws(()=>dimensions(b,'image/png'),/ヘッダー/);
 assert.throws(()=>dimensions(png(1,1),'image/jpeg'),/ヘッダー/);
});
test('JPEG baseline/progressive and WebP lossy/lossless/extended dimensions are bounded',()=>{
 for(const marker of [0xc0,0xc2]){const b=Buffer.from([255,216,255,marker,0,8,8,0,20,0,30,1]);assert.equal(dimensions(b,'image/jpeg').width,30);}
 for(const kind of ['VP8X','VP8L','VP8 ']){const b=Buffer.alloc(30);b.write('RIFF',0);b.write('WEBP',8);b.write(kind,12);
 if(kind==='VP8X'){b.writeUIntLE(29,24,3);b.writeUIntLE(19,27,3);}else if(kind==='VP8L'){b[20]=47;b.writeUInt32LE(29|(19<<14),21);}else{b.set([0x9d,1,0x2a],23);b.writeUInt16LE(30,26);b.writeUInt16LE(20,28);}
 assert.equal(dimensions(b,'image/webp').width,30);assert.equal(dimensions(b,'image/webp').height,20);}
});
test('inspection reads only first MiB regardless of encoded file size, cancellation and excessive metadata fail clearly',async()=>{
 let reads=0;const controller=new AbortController();const file={type:'image/png',size:10**12,slice(a,b){reads++;assert.equal(a,0);assert.equal(b,1024*1024);return new Blob([png(1,1)]);}};
 assert.equal((await inspect(file,controller.signal)).width,1);assert.equal(reads,1);controller.abort();await assert.rejects(inspect(file,controller.signal),{name:'AbortError'});assert.equal(reads,1);
 const jpeg=Buffer.alloc(1024*1024);jpeg[0]=255;jpeg[1]=216;await assert.rejects(inspect(new File([jpeg],'metadata.jpg',{type:'image/jpeg'}),new AbortController().signal),/先頭1MiB/);
});
