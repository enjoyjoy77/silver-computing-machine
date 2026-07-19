const MAGIC_TEXT = "KOBOHF01";
const MAGIC = new TextEncoder().encode(MAGIC_TEXT);

export const MAX_BUNDLE_BYTES = 30 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 256 * 1024;
export const MAX_FIGURES = 20;
export const MAX_PUFFS = 32;
export const MAX_IMAGE_SIDE = 4096;
export const EXPIRES_MS = 24 * 60 * 60 * 1000;

const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export class HandoffError extends Error {
  constructor(status, error, message) {
    super(message);
    this.name = "HandoffError";
    this.status = status;
    this.error = error;
  }
}

export function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function errorResponse(error) {
  if (error instanceof HandoffError) {
    return jsonResponse(error.status, {
      ok: false,
      error: error.error,
      message: error.message,
    });
  }

  console.error("handoff error", error);
  return jsonResponse(500, {
    ok: false,
    error: "INTERNAL_ERROR",
    message: "倉庫でエラーが起きました。少し待ってから、もう一度お試しください。",
  });
}

export function methodNotAllowed(allowed) {
  return jsonResponse(
    405,
    {
      ok: false,
      error: "METHOD_NOT_ALLOWED",
      message: "この操作には対応していません。",
    },
    { Allow: allowed.join(", ") },
  );
}

export function assertSameOrigin(request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");

  if (!origin || origin !== requestUrl.origin) {
    throw new HandoffError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "このページ以外からは送信できません。",
    );
  }
}

export function normalizeCode(value) {
  const code = String(value || "")
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();

  return CODE_RE.test(code) ? code : null;
}

export function objectKey(code) {
  return `handoffs/${code}.khf`;
}

export function generateCode() {
  const random = new Uint8Array(10);
  crypto.getRandomValues(random);

  let code = "";
  for (let i = 0; i < random.length; i++) {
    code += CODE_ALPHABET[random[i] & 31];
  }
  return code;
}

export async function generateUnusedCode(bucket, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const code = generateCode();
    const exists = await bucket.head(objectKey(code));
    if (!exists) return code;
  }

  throw new HandoffError(
    503,
    "CODE_GENERATION_FAILED",
    "受け取りコードを発行できませんでした。もう一度お試しください。",
  );
}

function sameBytes(bytes, offset, expected) {
  if (offset + expected.length > bytes.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (bytes[offset + i] !== expected[i]) return false;
  }
  return true;
}

function assertObject(value, message = "送信データの形式が正しくありません。") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HandoffError(400, "INVALID_BUNDLE", message);
  }
}

function assertFiniteInRange(value, min, max) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function validatePuffs(puffs) {
  if (!Array.isArray(puffs) || puffs.length > MAX_PUFFS) {
    throw new HandoffError(
      400,
      "INVALID_PUFFS",
      `ぷるぷるスポットは1体につき${MAX_PUFFS}個までです。`,
    );
  }

  for (const puff of puffs) {
    assertObject(puff, "ぷるぷるスポットの形式が正しくありません。");

    if (
      !assertFiniteInRange(puff.u, 0, 1) ||
      !assertFiniteInRange(puff.v, 0, 1) ||
      !assertFiniteInRange(puff.r, 0.001, 4) ||
      !assertFiniteInRange(puff.h, 0.001, 4) ||
      !assertFiniteInRange(puff.soft, 0, 1) ||
      !assertFiniteInRange(puff.keep, 0, 1)
    ) {
      throw new HandoffError(
        400,
        "INVALID_PUFFS",
        "ぷるぷるスポットの設定値が正しくありません。",
      );
    }
  }
}

function detectImageType(bytes, absoluteOffset, length) {
  if (length >= 24 && sameBytes(bytes, absoluteOffset, PNG_SIGNATURE)) return "image/png";
  if (length >= 3 && sameBytes(bytes, absoluteOffset, JPEG_SIGNATURE)) return "image/jpeg";
  if (
    length >= 12 &&
    bytes[absoluteOffset] === 0x52 && bytes[absoluteOffset + 1] === 0x49 &&
    bytes[absoluteOffset + 2] === 0x46 && bytes[absoluteOffset + 3] === 0x46 &&
    bytes[absoluteOffset + 8] === 0x57 && bytes[absoluteOffset + 9] === 0x45 &&
    bytes[absoluteOffset + 10] === 0x42 && bytes[absoluteOffset + 11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

// PNG/JPEG/WebPを受け付ける。寸法チェックはPNGのみ(JPEG/WebPは30MBのバイト上限で担保)。
function readImageInfo(bytes, absoluteOffset, length) {
  const type = detectImageType(bytes, absoluteOffset, length);
  if (!type) {
    throw new HandoffError(
      400,
      "INVALID_IMAGE",
      "対応していない画像形式です（PNG / JPEG / WebP のみ）。",
    );
  }
  if (type !== "image/png") {
    return { type };
  }

  // PNG signature直後は13-byte IHDRでなければならない。
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset + absoluteOffset,
    Math.min(length, 33),
  );

  const ihdrLength = view.getUint32(8, false);
  const ihdrType =
    String.fromCharCode(bytes[absoluteOffset + 12]) +
    String.fromCharCode(bytes[absoluteOffset + 13]) +
    String.fromCharCode(bytes[absoluteOffset + 14]) +
    String.fromCharCode(bytes[absoluteOffset + 15]);

  if (ihdrLength !== 13 || ihdrType !== "IHDR") {
    throw new HandoffError(
      400,
      "INVALID_PNG",
      "PNG画像のヘッダーが正しくありません。",
    );
  }

  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);

  if (
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_SIDE ||
    height > MAX_IMAGE_SIDE
  ) {
    throw new HandoffError(
      400,
      "IMAGE_DIMENSIONS",
      `画像の縦横は${MAX_IMAGE_SIDE}px以内にしてください。`,
    );
  }

  return { type, width, height };
}

function validateBlobDescriptor(
  descriptor,
  expectedOffset,
  payloadLength,
  payloadAbsoluteOffset,
  bytes,
) {
  assertObject(descriptor);

  const { offset, length, type } = descriptor;

  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset !== expectedOffset ||
    length < 1 ||
    offset < 0 ||
    offset + length > payloadLength
  ) {
    throw new HandoffError(
      400,
      "INVALID_OFFSETS",
      "画像データの位置情報が正しくありません。",
    );
  }

  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    throw new HandoffError(
      400,
      "INVALID_IMAGE_TYPE",
      "送れる画像形式は PNG / JPEG / WebP のみです。",
    );
  }

  readImageInfo(bytes, payloadAbsoluteOffset + offset, length);
  return offset + length;
}

export function validateBundle(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new HandoffError(
      400,
      "INVALID_BUNDLE",
      "送信データを読み込めませんでした。",
    );
  }

  if (arrayBuffer.byteLength > MAX_BUNDLE_BYTES) {
    throw new HandoffError(
      413,
      "TOO_LARGE",
      "送れる大きさは合計30MBまでです。体の数を減らしてください。",
    );
  }

  if (arrayBuffer.byteLength < 12) {
    throw new HandoffError(
      400,
      "INVALID_BUNDLE",
      "送信データの形式が正しくありません。",
    );
  }

  const bytes = new Uint8Array(arrayBuffer);
  if (!sameBytes(bytes, 0, MAGIC)) {
    throw new HandoffError(
      400,
      "INVALID_BUNDLE",
      "送信データの形式が正しくありません。",
    );
  }

  const view = new DataView(arrayBuffer);
  const manifestLength = view.getUint32(8, false);

  if (manifestLength < 2 || manifestLength > MAX_MANIFEST_BYTES) {
    throw new HandoffError(
      400,
      "INVALID_MANIFEST",
      "送信データの目次が大きすぎるか、壊れています。",
    );
  }

  const payloadAbsoluteOffset = 12 + manifestLength;
  if (payloadAbsoluteOffset > bytes.length) {
    throw new HandoffError(
      400,
      "INVALID_MANIFEST",
      "送信データの目次が壊れています。",
    );
  }

  let manifest;
  try {
    const manifestBytes = bytes.subarray(12, payloadAbsoluteOffset);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes);
    manifest = JSON.parse(text);
  } catch {
    throw new HandoffError(
      400,
      "INVALID_MANIFEST",
      "送信データの目次を読み込めませんでした。",
    );
  }

  assertObject(manifest);

  if (
    manifest.format !== "kobo-handoff" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.figures)
  ) {
    throw new HandoffError(
      400,
      "UNSUPPORTED_FORMAT",
      "この送信データの形式には対応していません。",
    );
  }

  if (
    manifest.figures.length < 1 ||
    manifest.figures.length > MAX_FIGURES
  ) {
    throw new HandoffError(
      400,
      "FIGURE_COUNT",
      `一度に送れるのは1体から${MAX_FIGURES}体までです。`,
    );
  }

  const payloadLength = bytes.length - payloadAbsoluteOffset;
  let expectedOffset = 0;

  for (const figure of manifest.figures) {
    assertObject(figure);

    if (
      typeof figure.name !== "string" ||
      [...figure.name].length > 100
    ) {
      throw new HandoffError(
        400,
        "INVALID_NAME",
        "フィギュアの名前は100文字以内にしてください。",
      );
    }

    validatePuffs(figure.puffs);

    expectedOffset = validateBlobDescriptor(
      figure.image,
      expectedOffset,
      payloadLength,
      payloadAbsoluteOffset,
      bytes,
    );

    expectedOffset = validateBlobDescriptor(
      figure.depth,
      expectedOffset,
      payloadLength,
      payloadAbsoluteOffset,
      bytes,
    );
  }

  if (expectedOffset !== payloadLength) {
    throw new HandoffError(
      400,
      "INVALID_OFFSETS",
      "画像データの長さが目次と一致しません。",
    );
  }

  return {
    manifest,
    manifestLength,
    payloadAbsoluteOffset,
    size: arrayBuffer.byteLength,
  };
}