import {
  HandoffError,
  jsonResponse,
  errorResponse,
  methodNotAllowed,
  assertSameOrigin,
} from "../../_lib/handoff.js";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const EXPIRES_MS = 5 * 60 * 1000;
const CODE_RE = /^[0-9A-HJ-NP-Z]{6}$/;
const MAX_NAME_CHARS = 120;

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

function objectKey(code) {
  return `filesync/${code}.bin`;
}

function requireBucket(env) {
  if (!env.HANDOFFS) {
    throw new HandoffError(
      500,
      "R2_NOT_CONFIGURED",
      "サーバーの保存先が設定されていません。",
    );
  }

  return env.HANDOFFS;
}

function requireCode(context) {
  const code = normalizeCode(context.params && context.params.code);

  if (!code) {
    throw new HandoffError(
      400,
      "INVALID_CODE",
      "合言葉は、IとOを除く半角英数字6文字で入力してください。",
    );
  }

  return code;
}

function isExpired(metadata) {
  if (!metadata || !metadata.expiresAt) {
    return false;
  }

  const expiresAt = Date.parse(metadata.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function decodeName(metadata) {
  if (!metadata || !metadata.name) {
    return "";
  }

  try {
    return decodeURIComponent(metadata.name);
  } catch {
    return "";
  }
}

async function getLiveObject(bucket, key, withBody) {
  const object = withBody ? await bucket.get(key) : await bucket.head(key);

  if (!object) {
    return null;
  }

  if (isExpired(object.customMetadata)) {
    await bucket.delete(key);
    return null;
  }

  return object;
}

async function handleGet(context) {
  const bucket = requireBucket(context.env);
  const code = requireCode(context);
  const key = objectKey(code);
  const url = new URL(context.request.url);
  const wantsBody = url.searchParams.get("body") === "1";

  const object = await getLiveObject(bucket, key, wantsBody);

  if (!object) {
    if (wantsBody) {
      throw new HandoffError(
        404,
        "NOT_FOUND",
        "ファイルがありません。期限切れ（5分）の可能性があります。",
      );
    }

    return jsonResponse(200, {
      ok: true,
      updatedAt: null,
      name: "",
      size: 0,
      type: "",
    });
  }

  const meta = object.customMetadata || {};

  if (!wantsBody) {
    return jsonResponse(200, {
      ok: true,
      updatedAt: meta.updatedAt || null,
      name: decodeName(meta),
      size: object.size,
      type: meta.type || "application/octet-stream",
    });
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": meta.type || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Updated-At": meta.updatedAt || "",
    },
  });
}

async function handlePut(context) {
  const { request } = context;
  const bucket = requireBucket(context.env);
  const code = requireCode(context);

  assertSameOrigin(request);

  // 大きいファイルをメモリに全部載せると落ちる(Workersのメモリは128MB)ので、
  // Content-Lengthで大きさを確かめてから、本文は流しながらそのままR2へ保存する。
  const declaredLength = Number(request.headers.get("Content-Length"));

  if (!Number.isFinite(declaredLength) || declaredLength < 1) {
    throw new HandoffError(
      400,
      "LENGTH_REQUIRED",
      "ファイルの大きさが分からない送信は受け取れません。もう一度お試しください。",
    );
  }

  if (declaredLength > MAX_FILE_BYTES) {
    throw new HandoffError(
      413,
      "TOO_LARGE",
      "送れるファイルは100MBまでです。",
    );
  }

  const encodedName = request.headers.get("X-File-Name") || "";
  let name = "";
  try {
    name = decodeURIComponent(encodedName);
  } catch {
    name = "";
  }

  if ([...name].length > MAX_NAME_CHARS) {
    throw new HandoffError(
      400,
      "NAME_TOO_LONG",
      `ファイル名は${MAX_NAME_CHARS}文字以内にしてください。`,
    );
  }

  const rawType = (request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const type = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(rawType)
    ? rawType
    : "application/octet-stream";

  const now = new Date();
  const updatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + EXPIRES_MS).toISOString();

  await bucket.put(objectKey(code), request.body, {
    httpMetadata: {
      contentType: type,
      cacheControl: "no-store",
    },
    customMetadata: {
      updatedAt,
      expiresAt,
      name: encodeURIComponent(name),
      type,
    },
  });

  return jsonResponse(200, {
    ok: true,
    updatedAt,
  });
}

async function handleDelete(context) {
  const { request } = context;
  const bucket = requireBucket(context.env);
  const code = requireCode(context);

  assertSameOrigin(request);
  await bucket.delete(objectKey(code));

  return jsonResponse(200, {
    ok: true,
  });
}

export async function onRequest(context) {
  try {
    switch (context.request.method) {
      case "GET":
        return await handleGet(context);

      case "PUT":
        return await handlePut(context);

      case "DELETE":
        return await handleDelete(context);

      default:
        return methodNotAllowed(["GET", "PUT", "DELETE"]);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
