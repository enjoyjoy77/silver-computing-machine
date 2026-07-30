// 対戦部屋の受け渡し窓口（絵文字ゲームエンジン「海底探検」オンライン対戦 段階1）
//
// api/memo/[code].js と同じ作り（合言葉6文字・R2のHANDOFFSバケット・同一オリジン制限）。
// 違いは「1つの合言葉に対して箱が2つある」ところ。
//
//   ?box=state … 親（部屋を立てた人）だけが書き、子が読む。盤面の状況ぜんぶ
//   ?box=act   … 子だけが書き、親が読む。「もぐる/引き返す」の意思だけ
//
// ★なぜ箱を分けるか
//   1つの箱を両者が書き換えると、読んで→直して→書く の間に相手が書いた分が消える。
//   書く人を箱ごとに1人へ固定すれば、この事故が構造的に起きない。
//   R2には「読んで直して書く」を安全に行う仕組みが無いので、設計側で避ける。

import {
  HandoffError,
  jsonResponse,
  errorResponse,
  methodNotAllowed,
  assertSameOrigin,
} from "../../_lib/handoff.js";

const MAX_BYTES = 64 * 1024;              // 盤面のJSONは数KBなので十分
const EXPIRES_MS = 30 * 60 * 1000;        // 最後の通信から30分で部屋が消える
const CODE_RE = /^[0-9A-HJ-NP-Z]{6}$/;    // IとOは読み上げで間違えるので除く
const BOXES = ["state", "act"];

function requireCode(context) {
  const code = String((context.params && context.params.code) || "")
    .trim()
    .toUpperCase();

  if (!CODE_RE.test(code)) {
    throw new HandoffError(
      400,
      "INVALID_CODE",
      "合言葉は、IとOを除く半角英数字6文字で入力してください。",
    );
  }

  return code;
}

function requireBox(request) {
  const box = new URL(request.url).searchParams.get("box") || "state";

  if (!BOXES.includes(box)) {
    throw new HandoffError(
      400,
      "INVALID_BOX",
      "受け取り口の指定が正しくありません。",
    );
  }

  return box;
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

function objectKey(code, box) {
  return `room/${code}/${box}.json`;
}

function isExpired(metadata) {
  if (!metadata || !metadata.expiresAt) return false;
  const expiresAt = Date.parse(metadata.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

async function handleGet(context) {
  const bucket = requireBucket(context.env);
  const code = requireCode(context);
  const box = requireBox(context.request);
  const key = objectKey(code, box);
  const object = await bucket.get(key);

  // 部屋が無い/期限切れは「空」を返す。エラーにはしない
  // （子が入る前に親が見に行く、が普通に起きるため）
  if (!object || isExpired(object.customMetadata)) {
    if (object) await bucket.delete(key);
    return jsonResponse(200, { ok: true, found: false, data: null, updatedAt: null });
  }

  const text = await object.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // 壊れたJSONが残っていても、部屋ごと死なせない。空として扱う
    return jsonResponse(200, { ok: true, found: false, data: null, updatedAt: null });
  }

  return jsonResponse(200, {
    ok: true,
    found: true,
    data,
    updatedAt:
      object.customMetadata && object.customMetadata.updatedAt
        ? object.customMetadata.updatedAt
        : null,
  });
}

async function handlePut(context) {
  const { request } = context;
  const bucket = requireBucket(context.env);
  const code = requireCode(context);
  const box = requireBox(request);

  assertSameOrigin(request);

  const arrayBuffer = await request.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new HandoffError(413, "TOO_LARGE", "送れる大きさは64KBまでです。");
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(arrayBuffer);
  } catch {
    throw new HandoffError(400, "INVALID_TEXT", "送信データを読み取れませんでした。");
  }

  // JSONとして読めることをサーバー側でも確かめる。
  // 壊れたものを置くと、相手が読んだときに黙って固まる原因になる
  try {
    JSON.parse(text);
  } catch {
    throw new HandoffError(400, "INVALID_JSON", "送信データの形式が正しくありません。");
  }

  const now = new Date();
  const updatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + EXPIRES_MS).toISOString();

  await bucket.put(objectKey(code, box), text, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "no-store",
    },
    customMetadata: { updatedAt, expiresAt },
  });

  return jsonResponse(200, { ok: true, updatedAt });
}

async function handleDelete(context) {
  const { request } = context;
  const bucket = requireBucket(context.env);
  const code = requireCode(context);

  assertSameOrigin(request);

  // 部屋じまいは両方の箱をまとめて消す
  await Promise.all(BOXES.map((box) => bucket.delete(objectKey(code, box))));

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
