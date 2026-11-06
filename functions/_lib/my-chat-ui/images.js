// Read only a bounded header before allowing the browser to decode a local image.
(() => {
  const HEADER_BYTES=1024*1024, PIXELS=40000000;
  function dimensions(bytes,type){
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=bytes.length;
    const text=(i,k)=>String.fromCharCode(...bytes.subarray(i,i+k));
    let w,h;
    if(type==='image/png'&&n>=24&&text(1,3)==='PNG'&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a&&text(12,4)==='IHDR'){w=v.getUint32(16);h=v.getUint32(20);}
    else if(type==='image/webp'&&n>=30&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
      const u24=i=>bytes[i]+bytes[i+1]*256+bytes[i+2]*65536;
      if(text(12,4)==='VP8X'){w=1+u24(24);h=1+u24(27);}
      else if(text(12,4)==='VP8L'&&bytes[20]===0x2f){const b=v.getUint32(21,true);w=(b&16383)+1;h=((b>>>14)&16383)+1;}
      else if(text(12,4)==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a){w=v.getUint16(26,true)&16383;h=v.getUint16(28,true)&16383;}
    }else if(type==='image/jpeg'&&n>=4&&v.getUint16(0)===0xffd8){
      let i=2;while(i+3<n){if(bytes[i++]!==255)break;while(i<n&&bytes[i]===255)i++;const m=bytes[i++];if(m===0xd9||m===0xda)break;if(m===0x01||(m>=0xd0&&m<=0xd7))continue;if(i+2>n)break;const len=v.getUint16(i);if(len<2||i+len>n)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(m)&&len>=8){h=v.getUint16(i+3);w=v.getUint16(i+5);break;}i+=len;}
    }
    if(!w||!h)throw Error('画像のヘッダーを確認できません。破損・形式の不一致、または先頭1MiBを超えるメタデータがあります。PNG・JPEG・WebPとして書き出し直してください。');
    if(w*h>PIXELS)throw Error('端末のメモリー保護のため4000万画素以内に縮小してください（ファイル容量の制限ではありません）。');
    return {width:w,height:h};
  }
  async function inspect(file,signal){
    if(signal.aborted)throw new DOMException('stopped','AbortError');
    const bytes=new Uint8Array(await file.slice(0,HEADER_BYTES).arrayBuffer());
    if(signal.aborted)throw new DOMException('stopped','AbortError');
    return dimensions(bytes,file.type);
  }
  window.MyChatImages={inspect,dimensions,HEADER_BYTES,PIXELS};
})();
