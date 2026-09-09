// やることリストの「AIで分割」窓口（Cloudflare Pages Function）
//
// POST /api/breakdown  { locker: "置き場番号6文字", text: "大きなやること" }
//   → { ok: true, steps: ["小さな手順", ...] }
//
// 鍵(ANTHROPIC_API_KEY)は Cloudflare の環境変数に置く。ページ側には渡さない。
// 誰でも叩けると鍵の利用料を他人に使われるので、「同期の置き場(todo/<番号>.txt)が
// 実在する番号」を持っている人だけ受け付ける(=合言葉で同期している本人だけ)。
//
// SDKを使わず fetch で直接呼んでいる理由: このサイトはビルド無しの静的配信で、
// npm の部品を同梱できないため(functions_src の他の窓口と同じ方針)。

import {
  HandoffError,
  jsonResponse,
  errorResponse,
  methodNotAllowed,
  assertSameOrigin,
} from "../_lib/handoff.js";

const CODE_RE = /^[0-9A-HJ-NP-Z]{6}$/;
const MAX_TEXT_CHARS = 200;
const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = [
  "あなたは、やることを小さな手順に分ける係です。",
  "利用者は先延ばしや着手の重さに困りやすい人です。次の方針で分けてください。",
  "- 3〜8個の手順にする。順番どおりに並べる",
  "- 最初の1つは『椅子に座る』『ファイルを開く』級の、30秒で終わる小さな一歩にする",
  "- 各手順は日本語で30文字以内。番号や記号は付けない",
  "- 動詞で終える(〜する)。曖昧な言葉(準備する・確認する)より、具体的な動き",
  "- 元のやることに書かれていない前提は勝手に増やさない",
].join("\n");

function requireBucket(env) {
  if (!env.HANDOFFS) {
    throw new HandoffError(500, "R2_NOT_CONFIGURED", "サーバーの保存先が設定されていません。");
  }
  return env.HANDOFFS;
}

async function readBody(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HandoffError(400, "INVALID_JSON", "送信データを読み取れませんでした。");
  }
  if (!body || typeof body !== "object") {
    throw new HandoffError(400, "INVALID_JSON", "送信データの形が正しくありません。");
  }
  const locker = String(body.locker || "").trim().toUpperCase();
  if (!CODE_RE.test(locker)) {
    throw new HandoffError(400, "INVALID_CODE", "同期を設定してから使ってください(置き場番号が不正)。");
  }
  const text = String(body.text || "").trim();
  if (!text) {
    throw new HandoffError(400, "EMPTY_TEXT", "分けたい『やること』が空です。");
  }
  if ([...text].length > MAX_TEXT_CHARS) {
    throw new HandoffError(400, "TOO_LONG", `やることは${MAX_TEXT_CHARS}文字以内にしてください。`);
  }
  return { locker, text };
}

async function callClaude(apiKey, text) {
  const payload = {
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            steps: { type: "array", items: { type: "string" } },
          },
          required: ["steps"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      { role: "user", content: "次のやることを小さな手順に分けてください。\n\nやること: " + text },
    ],
  };

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new HandoffError(502, "AI_UNREACHABLE", "AIのサーバーに届きませんでした。少し待ってからもう一度。");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data && data.error && data.error.message ? data.error.message : `HTTP ${response.status}`;
    if (response.status === 401) {
      throw new HandoffError(500, "AI_KEY_REJECTED", "AIの鍵が拒否されました。Cloudflareに登録した鍵を確かめてください。");
    }
    if (response.status === 429) {
      throw new HandoffError(429, "AI_BUSY", "AIが混み合っています。少し待ってからもう一度。");
    }
    throw new HandoffError(502, "AI_ERROR", "AIがエラーを返しました: " + detail);
  }

  if (!data || data.stop_reason === "refusal") {
    throw new HandoffError(502, "AI_REFUSED", "AIがこの内容の分割を断りました。言い方を変えてみてください。");
  }
  if (data.stop_reason === "max_tokens") {
    throw new HandoffError(502, "AI_TRUNCATED", "AIの返事が途中で切れました。もう一度試してください。");
  }

  const textBlock = Array.isArray(data.content) ? data.content.find((b) => b.type === "text") : null;
  let parsed = null;
  try {
    parsed = textBlock ? JSON.parse(textBlock.text) : null;
  } catch {
    parsed = null;
  }
  const steps = parsed && Array.isArray(parsed.steps)
    ? parsed.steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 12)
    : [];
  if (steps.length === 0) {
    throw new HandoffError(502, "AI_EMPTY", "AIから手順が返ってきませんでした。もう一度試してください。");
  }
  return steps;
}

async function handlePost(context) {
  const { request, env } = context;
  assertSameOrigin(request);

  if (!env.ANTHROPIC_API_KEY) {
    throw new HandoffError(
      500,
      "AI_KEY_MISSING",
      "AIの鍵がまだ登録されていません。つかいかた.txt の『AIの鍵の登録』を見てください。",
    );
  }

  const { locker, text } = await readBody(request);

  const bucket = requireBucket(env);
  const head = await bucket.head(`todo/${locker}.txt`);
  if (!head) {
    throw new HandoffError(403, "LOCKER_UNKNOWN", "同期を設定してから使ってください(この置き場はまだ空です)。");
  }

  const steps = await callClaude(env.ANTHROPIC_API_KEY, text);
  return jsonResponse(200, { ok: true, steps });
}

export async function onRequest(context) {
  try {
    if (context.request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }
    return await handlePost(context);
  } catch (error) {
    return errorResponse(error);
  }
}
