import {
  HandoffError,
  jsonResponse,
  errorResponse,
  methodNotAllowed,
  assertSameOrigin,
} from "../../_lib/handoff.js";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_ITEMS = 30;
const EXPIRES_MS = 5 * 60 * 1000;
const CODE_RE = /^[0-9A-HJ-NP-Z]{6}$/;
const ID_RE = /^[0-9a-z]{6,24}$/;
const MAX_NAME_CHARS = 120;

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

function keyPrefix(code) {
  return `filesync/${code}/`;
}

function objectKey(code, id) {
  return keyPrefix(code) + id;
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

function generateId() {
  const random = new Uint8Array(6);
  crypto.getRandomValues(random);

  let suffix = "";
  for (let i = 0; i < random.length; i++) {
    suffix += (random[i] % 36).toString(36);
  }

  return Date.now().toString(36) + suffix;
}

// 置き場の中身を一覧し、期限切れはその場で削除して除外する。
async function listLiveItems(bucket, code) {
  const listed = await bucket.list({
    prefix: keyPrefix(code),
    include: ["customMetadata"],
    limit: 1000,
  });

  const live = [];
  const expiredKeys = [];

  for (const object of listed.objects || []) {
    if (isExpired(object.customMetadata)) {
      expiredKeys.push(object.key);
      continue;
    }

    const meta = object.customMetadata || {};
    live.push({
      id: object.key.slice(keyPrefix(code).length),
      name: decodeName(meta),
      size: object.size,
      type: meta.type || "application/octet-stream",
      updatedAt: meta.updatedAt || null,
    });
  }

  if (expiredKeys.length > 0) {
    await Promise.all(expiredKeys.map((key) => bucket.delete(key)));
  }

  live.sort(function (a, b) {
    return String(a.updatedAt).localeCompare(String(b.updatedAt));
  });

  return live;
}

async function handleGet(context) {
  const bucket = requireBucket(context.env);
  const code = requireCode(context);
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    const items = await listLiveItems(bucket, code);

    return jsonResponse(200, {
      ok: true,
      items,
    });
  }

  if (!ID_RE.test(id)) {
    throw new HandoffError(400, "INVALID_ID", "ファイルの指定が正しくありません。");
  }

  const object = await bucket.get(objectKey(code, id));

  if (!object || isExpired(object.customMetadata)) {
    if (object) {
      await bucket.delete(objectKey(code, id));
    }

    throw new HandoffError(
      404,
      "NOT_FOUND",
      "このファイルはもうありません。期限切れ（5分）の可能性があります。",
    );
  }

  const meta = object.customMetadata || {};

  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": meta.type || "application/octet-stream",
      "Cache-Control": "no-store",
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
      "送れるファイルは1件100MBまでです。",
    );
  }

  const existing = await listLiveItems(bucket, code);

  if (existing.length >= MAX_ITEMS) {
    throw new HandoffError(
      409,
      "TOO_MANY_ITEMS",
      `この合言葉には${MAX_ITEMS}件まで置けます。「内容を消す」で空けるか、5分待ってください。`,
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
  const id = generateId();

  await bucket.put(objectKey(code, id), request.body, {
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
    id,
    updatedAt,
  });
}

async function handleDelete(context) {
  const { request } = context;
  const bucket = requireBucket(context.env);
  const code = requireCode(context);

  assertSameOrigin(request);

  const listed = await bucket.list({
    prefix: keyPrefix(code),
    limit: 1000,
  });

  const keys = (listed.objects || []).map((object) => object.key);

  if (keys.length > 0) {
    await Promise.all(keys.map((key) => bucket.delete(key)));
  }

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
