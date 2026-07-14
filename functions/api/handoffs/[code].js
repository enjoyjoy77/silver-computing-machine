import {
  HandoffError,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  normalizeCode,
  objectKey,
} from "../../_lib/handoff.js";

const NOT_FOUND_BODY = {
  ok: false,
  error: "NOT_FOUND",
  message: "コードが違うか、24時間の期限が切れています。",
};

function notFound() {
  return jsonResponse(404, NOT_FOUND_BODY);
}

async function handleGet(context) {
  const { env, params, waitUntil } = context;

  if (!env.HANDOFFS) {
    throw new HandoffError(
      500,
      "R2_NOT_CONFIGURED",
      "倉庫の設定がまだ完了していません。",
    );
  }

  const code = normalizeCode(params.code);
  if (!code) return notFound();

  const key = objectKey(code);
  const object = await env.HANDOFFS.get(key);

  if (!object) return notFound();

  const expiresAt = object.customMetadata?.expiresAt;
  const expiresMs = Date.parse(expiresAt || "");

  if (!Number.isFinite(expiresMs) || Date.now() >= expiresMs) {
    if (typeof waitUntil === "function") {
      waitUntil(
        env.HANDOFFS.delete(key).catch(error => {
          console.error("expired handoff delete failed", key, error);
        }),
      );
    }
    return notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/vnd.kobo-handoff");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Handoff-Expires-At", new Date(expiresMs).toISOString());
  headers.set("Content-Length", String(object.size));

  if (object.httpEtag) headers.set("ETag", object.httpEtag);

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    return await handleGet(context);
  } catch (error) {
    return errorResponse(error);
  }
}