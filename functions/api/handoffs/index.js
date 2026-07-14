import {
  EXPIRES_MS,
  MAX_BUNDLE_BYTES,
  HandoffError,
  assertSameOrigin,
  errorResponse,
  generateUnusedCode,
  jsonResponse,
  methodNotAllowed,
  objectKey,
  validateBundle,
} from "../../_lib/handoff.js";

async function handlePost(context) {
  const { request, env } = context;

  if (!env.HANDOFFS) {
    throw new HandoffError(
      500,
      "R2_NOT_CONFIGURED",
      "倉庫の設定がまだ完了していません。",
    );
  }

  assertSameOrigin(request);

  const contentType = (request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/vnd.kobo-handoff") {
    throw new HandoffError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "送信データの形式が正しくありません。",
    );
  }

  const declaredLength = Number(request.headers.get("Content-Length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_BUNDLE_BYTES
  ) {
    throw new HandoffError(
      413,
      "TOO_LARGE",
      "送れる大きさは合計30MBまでです。体の数を減らしてください。",
    );
  }

  const arrayBuffer = await request.arrayBuffer();
  const checked = validateBundle(arrayBuffer);

  const now = new Date();
  const expires = new Date(now.getTime() + EXPIRES_MS);
  const code = await generateUnusedCode(env.HANDOFFS);

  await env.HANDOFFS.put(objectKey(code), arrayBuffer, {
    httpMetadata: {
      contentType: "application/vnd.kobo-handoff",
      cacheControl: "no-store",
    },
    customMetadata: {
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      formatVersion: "1",
    },
  });

  return jsonResponse(201, {
    ok: true,
    code,
    displayCode: `${code.slice(0, 5)}-${code.slice(5)}`,
    expiresAt: expires.toISOString(),
    size: checked.size,
  });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    return await handlePost(context);
  } catch (error) {
    return errorResponse(error);
  }
}