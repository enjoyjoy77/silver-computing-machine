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

// ---------- 名前付き棚 + フィギュアコレクション ----------
// IndexedDBのバージョンと figures のkeyPathは変更しない。
// shelf = { id:string, name:string }
// figure = {
//   id(IndexedDB自動採番), name, image:Blob, depth:Blob,
//   puffs:[{u,v,r,h,soft,keep}], shelfId:string, ts
// }

const SHELVES_KEY = "kobo-shelves";
const TARGET_SHELF_KEY = "kobo-target-shelf";

function storageGet(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function makeShelfId() {
  try {
    if (crypto?.randomUUID) return "shelf-" + crypto.randomUUID();
  } catch { /* fallbackへ */ }
  return "shelf-" + Date.now().toString(36) + "-" +
    Math.random().toString(36).slice(2, 10);
}

function normalizeShelfName(name, fallback = "マイ棚") {
  const normalized = String(name ?? "").trim().slice(0, 40);
  return normalized || fallback;
}

function readShelves() {
  try {
    const parsed = JSON.parse(storageGet(SHELVES_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    return parsed
      .map(shelf => ({
        id: String(shelf?.id || ""),
        name: normalizeShelfName(shelf?.name),
      }))
      .filter(shelf => {
        if (!shelf.id || seen.has(shelf.id)) return false;
        seen.add(shelf.id);
        return true;
      });
  } catch {
    return [];
  }
}

function writeShelves(shelves) {
  storageSet(SHELVES_KEY, JSON.stringify(shelves));
}

// 既定棚は配列の先頭。旧figureはここに見せる。
export function shelvesEnsureDefault() {
  let shelves = readShelves();
  if (!shelves.length) {
    shelves = [{
      id: "shelf-" + Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2, 8),
      name: "マイ棚",
    }];
    writeShelves(shelves);
  }

  const target = storageGet(TARGET_SHELF_KEY);
  if (!shelves.some(shelf => shelf.id === target)) {
    storageSet(TARGET_SHELF_KEY, shelves[0].id);
  }
  return shelves[0].id;
}

export function shelvesAll() {
  shelvesEnsureDefault();
  return readShelves().map(shelf => ({ ...shelf }));
}

export function shelvesAdd(name) {
  shelvesEnsureDefault();
  const shelves = readShelves();
  const shelf = {
    id: makeShelfId(),
    name: normalizeShelfName(name, "新しい棚"),
  };
  shelves.push(shelf);
  writeShelves(shelves);
  setTargetShelf(shelf.id);
  return shelf.id;
}

export function shelvesRename(id, name) {
  shelvesEnsureDefault();
  const shelves = readShelves();
  const shelf = shelves.find(item => item.id === String(id));
  if (!shelf) return false;

  shelf.name = normalizeShelfName(name, shelf.name);
  writeShelves(shelves);
  return true;
}

export function getTargetShelf() {
  shelvesEnsureDefault();
  const shelves = readShelves();
  const target = storageGet(TARGET_SHELF_KEY);
  return shelves.some(shelf => shelf.id === target)
    ? target
    : shelves[0].id;
}

export function setTargetShelf(id) {
  shelvesEnsureDefault();
  const shelfId = String(id || "");
  if (!readShelves().some(shelf => shelf.id === shelfId)) return false;
  storageSet(TARGET_SHELF_KEY, shelfId);
  return true;
}

export async function shelvesRemove(id) {
  shelvesEnsureDefault();
  const shelfId = String(id || "");
  const shelves = readShelves();

  if (shelves.length <= 1) return false;

  const index = shelves.findIndex(shelf => shelf.id === shelfId);
  if (index < 0) return false;

  // 既定棚自体を削除する場合は、次の棚を新しい既定棚にする。
  const destinationId = index === 0 ? shelves[1].id : shelves[0].id;
  const figures = await figuresAll(shelfId);
  for (const figure of figures) {
    await figuresMove(figure.id, destinationId);
  }

  const nextShelves = shelves.filter(shelf => shelf.id !== shelfId);
  writeShelves(nextShelves);

  if (getTargetShelf() === shelfId ||
      !nextShelves.some(shelf => shelf.id === storageGet(TARGET_SHELF_KEY))) {
    setTargetShelf(destinationId);
  }
  return true;
}

export async function figuresAdd({
  name, image, depth, puffs = [], shelfId
}) {
  const targetShelfId =
    shelvesAll().some(shelf => shelf.id === String(shelfId || ""))
      ? String(shelfId)
      : getTargetShelf();

  const db = await dbOpen();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(FIG_STORE, "readwrite");
      const rq = tx.objectStore(FIG_STORE).add({
        name,
        image,
        depth,
        puffs: sanitizePuffs(puffs),
        shelfId: targetShelfId,
        ts: Date.now(),
      });
      rq.onsuccess = () => res(rq.result);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () =>
        rej(tx.error || new Error("ブラウザの保存領域が足りません"));
    });
  } finally {
    db.close();
  }
}

// ぷるぷるスポットの設定だけ更新
export async function figuresUpdatePuffs(id, puffs) {
  const db = await dbOpen();
  try {
    await new Promise((res, rej) => {
      const tx = db.transaction(FIG_STORE, "readwrite");
      const store = tx.objectStore(FIG_STORE);
      const rq = store.get(id);
      rq.onsuccess = () => {
        const figure = rq.result;
        if (!figure) {
          tx.abort();
          return;
        }
        figure.puffs = sanitizePuffs(puffs);
        store.put(figure);
      };
      rq.onerror = () => rej(rq.error);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
      tx.onabort = () =>
        rej(tx.error || new Error("フィギュアを保存できませんでした"));
    });
  } finally {
    db.close();
  }
}

// 複数体を1トランザクションで追加。
// 第2引数省略時は現在の追加先棚へまとめて入れる。
export async function figuresAddMany(figures, shelfId) {
  if (!Array.isArray(figures) || !figures.length) return [];

  const targetShelfId =
    shelvesAll().some(shelf => shelf.id === String(shelfId || ""))
      ? String(shelfId)
      : getTargetShelf();

  const db = await dbOpen();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(FIG_STORE, "readwrite");
      const store = tx.objectStore(FIG_STORE);
      const ids = [];
      const baseTs = Date.now();

      for (let i = 0; i < figures.length; i++) {
        const figure = figures[i];
        const rq = store.add({
          name: String(figure.name || ""),
          image: figure.image,
          depth: figure.depth,
          puffs: sanitizePuffs(figure.puffs),
          shelfId: targetShelfId,
          ts: baseTs + i,
        });
        rq.onsuccess = () => ids.push(rq.result);
      }

      tx.oncomplete = () => res(ids);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () =>
        rej(tx.error || new Error("ブラウザの保存領域が足りません"));
    });
  } finally {
    db.close();
  }
}

// 引数なしは後方互換で全件。
// shelfId指定時はその棚だけ。
// 旧レコードは読み取り時だけ既定棚のshelfIdを補完する。
export async function figuresAll(shelfId) {
  try {
    const defaultShelfId = shelvesEnsureDefault();
    const filterShelfId =
      shelfId === undefined || shelfId === null ? null : String(shelfId);

    const db = await dbOpen();
    try {
      return await new Promise((res, rej) => {
        const tx = db.transaction(FIG_STORE, "readonly");
        const rq = tx.objectStore(FIG_STORE).getAll();

        rq.onsuccess = () => {
          const figures = (rq.result || [])
            .map(figure => ({
              ...figure,
              shelfId: figure.shelfId || defaultShelfId,
              puffs: sanitizePuffs(figure.puffs),
            }))
            .filter(figure =>
              filterShelfId === null || figure.shelfId === filterShelfId)
            .sort((a, b) => a.ts - b.ts);

          res(figures);
        };
        rq.onerror = () => rej(rq.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function figuresMove(id, shelfId) {
  const targetShelfId = String(shelfId || "");
  if (!shelvesAll().some(shelf => shelf.id === targetShelfId)) return false;

  const db = await dbOpen();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(FIG_STORE, "readwrite");
      const store = tx.objectStore(FIG_STORE);
      const rq = store.get(id);

      rq.onsuccess = () => {
        const figure = rq.result;
        if (!figure) {
          res(false);
          return;
        }
        figure.shelfId = targetShelfId;
        store.put(figure);
      };
      rq.onerror = () => rej(rq.error);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () =>
        rej(tx.error || new Error("フィギュアを移動できませんでした"));
    });
  } finally {
    db.close();
  }
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

// ---------- Quest受け渡しバンドル(Kobo Handoff v1) ----------
// 形式: magic"KOBOHF01"(8B) + manifest長uint32BE(4B) + manifest JSON + PNG Blob連結
const HANDOFF_MAGIC_TEXT = "KOBOHF01";
const HANDOFF_TYPE = "application/vnd.kobo-handoff";
const HANDOFF_MAX_BYTES = 30 * 1024 * 1024;
const HANDOFF_MAX_MANIFEST_BYTES = 256 * 1024;
const HANDOFF_MAX_FIGURES = 20;
const HANDOFF_MAX_PUFFS = 32;
const HANDOFF_MAX_IMAGE_SIDE = 4096;
const HANDOFF_PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const HANDOFF_JPEG_SIGNATURE = [0xFF, 0xD8, 0xFF];
const HANDOFF_ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function clampNumber(value, min, max, fallback) {
  return Math.max(min, Math.min(max, finiteNumber(value, fallback)));
}
export function sanitizePuffs(puffs) {
  if (!Array.isArray(puffs)) return [];
  return puffs.slice(0, HANDOFF_MAX_PUFFS).map(puff => ({
    u: clampNumber(puff?.u, 0, 1, 0.5),
    v: clampNumber(puff?.v, 0, 1, 0.52),
    r: clampNumber(puff?.r, 0.001, 4, 0.18),
    h: clampNumber(puff?.h, 0.001, 4, 0.095),
    soft: clampNumber(puff?.soft, 0, 1, 0.5),
    keep: clampNumber(puff?.keep, 0, 1, 0.55),
  }));
}
function handoffError(message, code = "INVALID_BUNDLE") {
  const error = new Error(message);
  error.code = code;
  return error;
}
function hasBytes(bytes, offset, expected) {
  if (offset + expected.length > bytes.length) return false;
  return expected.every((value, index) => bytes[offset + index] === value);
}
function detectImageTypeAt(bytes, offset, length) {
  if (length >= 24 && hasBytes(bytes, offset, HANDOFF_PNG_SIGNATURE)) return "image/png";
  if (length >= 3 && hasBytes(bytes, offset, HANDOFF_JPEG_SIGNATURE)) return "image/jpeg";
  if (length >= 12 &&
      bytes[offset] === 0x52 && bytes[offset + 1] === 0x49 && bytes[offset + 2] === 0x46 && bytes[offset + 3] === 0x46 &&
      bytes[offset + 8] === 0x57 && bytes[offset + 9] === 0x45 && bytes[offset + 10] === 0x42 && bytes[offset + 11] === 0x50) {
    return "image/webp";
  }
  return null;
}
// PNG/JPEG/WebPを受け付ける。寸法チェックはPNGのみ(JPEG/WebPは30MBのバイト上限で担保)。検出した実タイプを返す
function validateImageAt(bytes, offset, length) {
  const type = detectImageTypeAt(bytes, offset, length);
  if (!type) {
    throw handoffError("対応していない画像形式です（PNG / JPEG / WebP のみ送れます）。", "INVALID_IMAGE");
  }
  if (type === "image/png") {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, Math.min(length, 33));
    const ihdrLength = view.getUint32(8, false);
    const ihdrType = String.fromCharCode(bytes[offset + 12], bytes[offset + 13], bytes[offset + 14], bytes[offset + 15]);
    if (ihdrLength !== 13 || ihdrType !== "IHDR") {
      throw handoffError("PNG画像のヘッダーが正しくありません。", "INVALID_PNG");
    }
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width < 1 || height < 1 || width > HANDOFF_MAX_IMAGE_SIDE || height > HANDOFF_MAX_IMAGE_SIDE) {
      throw handoffError(`画像の縦横は${HANDOFF_MAX_IMAGE_SIDE}px以内にしてください。`, "IMAGE_DIMENSIONS");
    }
  }
  return type;
}
async function assertImageBlob(blob) {
  if (!(blob instanceof Blob) || blob.size < 24) {
    throw handoffError("画像データを読み込めません。", "INVALID_IMAGE");
  }
  const header = new Uint8Array(await blob.slice(0, 33).arrayBuffer());
  return validateImageAt(header, 0, header.length);
}
export async function buildHandoffBundle(figures) {
  if (!Array.isArray(figures) || figures.length < 1 || figures.length > HANDOFF_MAX_FIGURES) {
    throw handoffError(`一度に送れるのは1体から${HANDOFF_MAX_FIGURES}体までです。`, "FIGURE_COUNT");
  }
  const manifest = { format: "kobo-handoff", version: 1, createdAt: new Date().toISOString(), figures: [] };
  const blobParts = [];
  let offset = 0;
  for (const figure of figures) {
    // 名前は写真ファイル名由来で長くなりがち。エラーで弾かず自動で100字以内に詰める(送れないより短く送る)
    const name = [...String(figure?.name || "")].slice(0, 100).join("");
    const imageType = await assertImageBlob(figure.image);
    const depthType = await assertImageBlob(figure.depth);
    const image = { offset, length: figure.image.size, type: imageType };
    offset += figure.image.size;
    const depth = { offset, length: figure.depth.size, type: depthType };
    offset += figure.depth.size;
    manifest.figures.push({ name, image, depth, puffs: sanitizePuffs(figure.puffs) });
    blobParts.push(figure.image, figure.depth);
  }
  const encoder = new TextEncoder();
  const magic = encoder.encode(HANDOFF_MAGIC_TEXT);
  const manifestBytes = encoder.encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > HANDOFF_MAX_MANIFEST_BYTES) {
    throw handoffError("送信データの目次が大きすぎます。", "INVALID_MANIFEST");
  }
  const manifestLength = new ArrayBuffer(4);
  new DataView(manifestLength).setUint32(0, manifestBytes.byteLength, false);
  const size = magic.byteLength + manifestLength.byteLength + manifestBytes.byteLength + offset;
  if (size > HANDOFF_MAX_BYTES) {
    throw handoffError("送れる大きさは合計30MBまでです。選ぶ体を減らしてください。", "TOO_LARGE");
  }
  return new Blob([magic, manifestLength, manifestBytes, ...blobParts], { type: HANDOFF_TYPE });
}
export function parseHandoffBundle(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw handoffError("受け取ったデータを読み込めませんでした。");
  }
  if (arrayBuffer.byteLength > HANDOFF_MAX_BYTES) {
    throw handoffError("受け取ったデータが30MBを超えています。", "TOO_LARGE");
  }
  if (arrayBuffer.byteLength < 12) {
    throw handoffError("受け取ったデータを読み込めませんでした。");
  }
  const bytes = new Uint8Array(arrayBuffer);
  const magic = new TextEncoder().encode(HANDOFF_MAGIC_TEXT);
  if (!hasBytes(bytes, 0, [...magic])) {
    throw handoffError("受け取ったデータを読み込めませんでした。");
  }
  const manifestLength = new DataView(arrayBuffer).getUint32(8, false);
  if (manifestLength < 2 || manifestLength > HANDOFF_MAX_MANIFEST_BYTES || 12 + manifestLength > bytes.length) {
    throw handoffError("受け取ったデータの目次が壊れています。", "INVALID_MANIFEST");
  }
  const payloadStart = 12 + manifestLength;
  let manifest;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(12, payloadStart));
    manifest = JSON.parse(text);
  } catch {
    throw handoffError("受け取ったデータの目次を読み込めませんでした。", "INVALID_MANIFEST");
  }
  if (
    !manifest ||
    manifest.format !== "kobo-handoff" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.figures) ||
    manifest.figures.length < 1 ||
    manifest.figures.length > HANDOFF_MAX_FIGURES
  ) {
    throw handoffError("この送信データの形式には対応していません。", "UNSUPPORTED_FORMAT");
  }
  const payloadLength = bytes.length - payloadStart;
  let expectedOffset = 0;
  const figures = [];
  for (const figure of manifest.figures) {
    const name = String(figure?.name ?? "");
    if ([...name].length > 100) {
      throw handoffError("フィギュアの名前が長すぎます。", "INVALID_NAME");
    }
    const descriptors = [figure?.image, figure?.depth];
    const blobs = [];
    for (const descriptor of descriptors) {
      if (
        !descriptor ||
        !HANDOFF_ALLOWED_IMAGE_TYPES.includes(descriptor.type) ||
        !Number.isSafeInteger(descriptor.offset) ||
        !Number.isSafeInteger(descriptor.length) ||
        descriptor.offset !== expectedOffset ||
        descriptor.length < 1 ||
        descriptor.offset + descriptor.length > payloadLength
      ) {
        throw handoffError("受け取った画像データが壊れています。", "INVALID_OFFSETS");
      }
      const absoluteOffset = payloadStart + descriptor.offset;
      const detectedType = validateImageAt(bytes, absoluteOffset, descriptor.length);
      blobs.push(new Blob([arrayBuffer.slice(absoluteOffset, absoluteOffset + descriptor.length)], { type: detectedType }));
      expectedOffset += descriptor.length;
    }
    const rawPuffs = figure.puffs;
    if (!Array.isArray(rawPuffs) || rawPuffs.length > HANDOFF_MAX_PUFFS) {
      throw handoffError("ぷるぷるスポットの設定が壊れています。", "INVALID_PUFFS");
    }
    for (const puff of rawPuffs) {
      const values = [puff?.u, puff?.v, puff?.r, puff?.h, puff?.soft, puff?.keep];
      if (!values.every(value => (typeof value === "number" && Number.isFinite(value)))) {
        throw handoffError("ぷるぷるスポットの設定が壊れています。", "INVALID_PUFFS");
      }
    }
    figures.push({ name, image: blobs[0], depth: blobs[1], puffs: sanitizePuffs(rawPuffs) });
  }
  if (expectedOffset !== payloadLength) {
    throw handoffError("受け取った画像データの長さが一致しません。", "INVALID_OFFSETS");
  }
  return { figures };
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
