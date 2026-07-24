import {
  HandoffError,
  jsonResponse,
  errorResponse,
  methodNotAllowed,
  assertSameOrigin,
} from "../../_lib/handoff.js";

const MAX_TEXT_BYTES = 64 * 1024;
const EXPIRES_MS = 24 * 60 * 60 * 1000;
const CODE_RE = /^[0-9A-HJ-NP-Z]{6}$/;

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

function objectKey(code) {
  return `memo/${code}.txt`;
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

async function handleGet(context) {
  const bucket = requireBucket(context.env);
  const code = requireCode(context);
  const key = objectKey(code);
  const object = await bucket.get(key);

  if (!object) {
    return jsonResponse(200, {
      ok: true,
      text: "",
      updatedAt: null,
    });
  }

  if (isExpired(object.customMetadata)) {
    await bucket.delete(key);

    return jsonResponse(200, {
      ok: true,
      text: "",
      updatedAt: null,
    });
  }

  const text = await object.text();
  const updatedAt =
    object.customMetadata && object.customMetadata.updatedAt
      ? object.customMetadata.updatedAt
      : null;

  return jsonResponse(200, {
    ok: true,
    text,
    updatedAt,
  });
}

async function handlePut(context) {
  const { request } = context;
  const bucket = requireBucket(context.env);
  const code = requireCode(context);

  assertSameOrigin(request);

  const contentType = (request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "text/plain") {
    throw new HandoffError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "本文はプレーンテキストとして送信してください。",
    );
  }

  const lengthHeader = request.headers.get("Content-Length");
  if (lengthHeader !== null) {
    const declaredLength = Number(lengthHeader);

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_TEXT_BYTES
    ) {
      throw new HandoffError(
        413,
        "TOO_LARGE",
        "本文は64KB以内にしてください。",
      );
    }
  }

  const arrayBuffer = await request.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_TEXT_BYTES) {
    throw new HandoffError(
      413,
      "TOO_LARGE",
      "本文は64KB以内にしてください。",
    );
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(arrayBuffer);
  } catch {
    throw new HandoffError(
      400,
      "INVALID_TEXT",
      "本文をUTF-8のテキストとして読み取れませんでした。",
    );
  }

  const now = new Date();
  const updatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + EXPIRES_MS).toISOString();

  await bucket.put(objectKey(code), text, {
    httpMetadata: {
      contentType: "text/plain; charset=utf-8",
      cacheControl: "no-store",
    },
    customMetadata: {
      updatedAt,
      expiresAt,
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
