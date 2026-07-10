// 画像工房 共通部品 v1
// 全ツールで共有: iOS判定 / 保存 / ZIP生成(無圧縮) / ツール間の画像受け渡し(IndexedDB)

export const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

// ---------- 保存 ----------
// iOS: 共有シート(写真アプリに保存できる) / それ以外: ダウンロード
export async function saveBlob(blob, filename) {
  if (isIOS && navigator.share) {
    const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // ユーザーがキャンセル
        // 共有に失敗したら通常ダウンロードへ
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function canvasToBlob(canvas, type = "image/png") {
  return new Promise((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error("画像の書き出しに失敗しました"))), type));
}

// ---------- ZIP生成(無圧縮・依存なし) ----------
// PNGは既に圧縮済みなので無圧縮格納で十分。UTF-8ファイル名フラグ付き。
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// files: [{name: string, blob: Blob}]
export async function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer());
    const name = enc.encode(f.name);
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);   // local file header
    lh.setUint16(4, 20, true);           // version needed
    lh.setUint16(6, 0x0800, true);       // UTF-8 filename
    lh.setUint16(8, 0, true);            // 無圧縮
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    parts.push(lh.buffer, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);   // central directory header
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + data.length;
  }
  let centralSize = 0;
  for (const b of central) centralSize += b.byteLength;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);   // end of central directory
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  return new Blob([...parts, ...central, eocd.buffer], { type: "application/zip" });
}

// ---------- ツール間の画像受け渡し(IndexedDB) ----------
// 同じサイト(同じドメイン)上に置かれたツール同士なら、ダウンロード/アップロードなしで
// 画像を次のツールへ渡せる。slot: "source"(元画像) / "depth"(深度マップ)
const DB_NAME = "kobo-handoff";
const STORE = "slots";
const FIG_STORE = "figures";   // 棚(複数フィギュアを貯める)
function dbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(FIG_STORE)) db.createObjectStore(FIG_STORE, { keyPath: "id", autoIncrement: true });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function handoffSend(slot, blob, meta = {}) {
  const db = await dbOpen();
  try {
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ blob, ts: Date.now(), ...meta }, slot);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error("ブラウザの保存領域が足りません"));  // Quota超過等
    });
  } finally { db.close(); }
}
export async function handoffTake(slot) {
  try {
    const db = await dbOpen();
    try {
      return await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readonly");
        const rq = tx.objectStore(STORE).get(slot);
        rq.onsuccess = () => res(rq.result || null);
        rq.onerror = () => rej(rq.error);
      });
    } finally { db.close(); }
  } catch { return null; }  // file:// 直開き等でIndexedDBが使えない環境では受け渡しなし扱い
}
export async function handoffClear(slot) {
  try {
    const db = await dbOpen();
    try {
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(slot);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } finally { db.close(); }
  } catch { /* 無視 */ }
}

// ---------- 棚(コレクション): 複数フィギュアを貯める ----------
// figure = { id(自動採番), name, image:Blob(元画像/切り抜き), depth:Blob(深度PNG), ts }
export async function figuresAdd({ name, image, depth }) {
  const db = await dbOpen();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(FIG_STORE, "readwrite");
      const rq = tx.objectStore(FIG_STORE).add({ name, image, depth, ts: Date.now() });
      rq.onsuccess = () => res(rq.result);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error("ブラウザの保存領域が足りません"));
    });
  } finally { db.close(); }
}
export async function figuresAll() {
  try {
    const db = await dbOpen();
    try {
      return await new Promise((res, rej) => {
        const tx = db.transaction(FIG_STORE, "readonly");
        const rq = tx.objectStore(FIG_STORE).getAll();
        rq.onsuccess = () => res((rq.result || []).sort((a, b) => a.ts - b.ts));  // 古い順
        rq.onerror = () => rej(rq.error);
      });
    } finally { db.close(); }
  } catch { return []; }
}
export async function figuresRemove(id) {
  try {
    const db = await dbOpen();
    try {
      await new Promise((res, rej) => {
        const tx = db.transaction(FIG_STORE, "readwrite");
        tx.objectStore(FIG_STORE).delete(id);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } finally { db.close(); }
  } catch { /* 無視 */ }
}
export async function figuresClear() {
  try {
    const db = await dbOpen();
    try {
      await new Promise((res, rej) => {
        const tx = db.transaction(FIG_STORE, "readwrite");
        tx.objectStore(FIG_STORE).clear();
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } finally { db.close(); }
  } catch { /* 無視 */ }
}

// 「◯分前」表示
export function agoText(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return m + "分前";
  const h = Math.round(m / 60);
  if (h < 24) return h + "時間前";
  return Math.round(h / 24) + "日前";
}

// ---------- WebGPU判定(全ツール共通) ----------
export async function detectBackend() {
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return "webgpu";
    } catch { /* 続行 */ }
  }
  return "wasm";
}
