// やることリストの同期窓口（Cloudflare Pages Function）
//
// api/memo/[code].js と同じ作り（置き場番号6文字・R2のHANDOFFSバケット・同一オリジン制限）。
// 違いは2つ:
//   (1) 期限切れで消えない（やることリストは残り続けるものなので）
//   (2) 上書き事故よけ: PUT のとき X-Todo-Base ヘッダに「自分が最後に見た updatedAt」を
//       付けてもらい、サーバー側がそれより新しければ 409 を返す。
//       受け取った側はサーバーの内容を取り直して混ぜてから、もう一度送る。
//
// 中身は画面側で暗号化された文字列（"TDENC1"+base64）。サーバーは平文を持たない。

import {
  HandoffError,
  jsonResponse,
  errorResponse,
  methodNotAllowed,
  assertSameOrigin,
} from "../../_lib/handoff.js";

const MAX_TEXT_BYTES = 256 * 1024;
const CODE_RE = /^[0-9A-HJ-NP-Z]{6}$/;

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

function objectKey(code) {
  return `todo/${code}.txt`;
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
      "置き場番号は、IとOを除く半角英数字6文字です。",
    );
  }
  return code;
}

async function handleGet(context) {
  const bucket = requireBucket(context.env);
  const code = requireCode(context);
  const object = await bucket.get(objectKey(code));

  if (!object) {
    return jsonResponse(200, { ok: true, text: "", updatedAt: null });
  }

  const text = await object.text();
  const updatedAt =
    object.customMetadata && object.customMetadata.updatedAt
      ? object.customMetadata.updatedAt
      : null;

  return jsonResponse(200, { ok: true, text, updatedAt });
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

  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_TEXT_BYTES) {
    throw new HandoffError(
      413,
      "TOO_LARGE",
      "やることリストが大きすぎます（256KBまで）。完了したものを消してください。",
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

  // 上書き事故よけ。X-Todo-Base が無い場合は無条件で上書き（初回・強制用）。
  const key = objectKey(code);
  const baseHeader = request.headers.get("X-Todo-Base");
  if (baseHeader !== null) {
    const head = await bucket.head(key);
    const current =
      head && head.customMetadata && head.customMetadata.updatedAt
        ? head.customMetadata.updatedAt
        : "";
    if (current !== baseHeader) {
      return jsonResponse(409, {
        ok: false,
        error: "CONFLICT",
        message: "別の端末が先に変更していました。",
        updatedAt: current || null,
      });
    }
  }

  const updatedAt = new Date().toISOString();

  await bucket.put(key, text, {
    httpMetadata: {
      contentType: "text/plain; charset=utf-8",
      cacheControl: "no-store",
    },
    customMetadata: { updatedAt },
  });

  return jsonResponse(200, { ok: true, updatedAt });
}

async function handleDelete(context) {
  const { request } = context;
  const bucket = requireBucket(context.env);
  const code = requireCode(context);

  assertSameOrigin(request);
  await bucket.delete(objectKey(code));

  return jsonResponse(200, { ok: true });
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
