// やることリストの「Googleカレンダー取得」窓口（Cloudflare Pages Function）
//
// POST /api/ical  { url: "https://calendar.google.com/calendar/ical/.../basic.ics" }
//   → { ok: true, ics: "BEGIN:VCALENDAR..." }
//
// ブラウザから直接 calendar.google.com を読むと CORS で止まるので、ここが代わりに取りに行く。
// 非公開URL(秘密)は本文で受け取り、保存も記録もしない。中身の解釈(予定の切り出し)は画面側でやる。
// 取りに行く先は Googleカレンダーの iCal URL だけに限定する(他所のURLを取らされないため)。

import {
  HandoffError,
  jsonResponse,
  errorResponse,
  methodNotAllowed,
  assertSameOrigin,
} from "../_lib/handoff.js";

const MAX_ICS_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;

function requireCalendarUrl(value) {
  const raw = String(value || "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HandoffError(400, "INVALID_URL", "カレンダーのURLの形が正しくありません。");
  }
  const okHost = url.protocol === "https:" && url.hostname === "calendar.google.com";
  const okPath = url.pathname.startsWith("/calendar/ical/") && url.pathname.endsWith(".ics");
  if (!okHost || !okPath) {
    throw new HandoffError(
      400,
      "NOT_GOOGLE_ICAL",
      "Googleカレンダーの『iCal形式の非公開URL』(calendar.google.com/calendar/ical/…/basic.ics)を貼ってください。",
    );
  }
  return url.toString();
}

async function handlePost(context) {
  const { request } = context;
  assertSameOrigin(request);

  let body;
  try {
    body = await request.json();
  } catch {
    throw new HandoffError(400, "INVALID_JSON", "送信データを読み取れませんでした。");
  }
  const url = requireCalendarUrl(body && body.url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "yarukoto-list/1.0" },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (error) {
    clearTimeout(timer);
    throw new HandoffError(502, "CALENDAR_UNREACHABLE", "Googleカレンダーに届きませんでした。少し待ってからもう一度。");
  }
  clearTimeout(timer);

  if (upstream.status === 404) {
    throw new HandoffError(404, "CALENDAR_NOT_FOUND", "そのURLのカレンダーが見つかりません。非公開URLを作り直していないか確かめてください。");
  }
  if (!upstream.ok) {
    throw new HandoffError(502, "CALENDAR_ERROR", `Googleカレンダーがエラーを返しました(HTTP ${upstream.status})。`);
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > MAX_ICS_BYTES) {
    throw new HandoffError(413, "CALENDAR_TOO_LARGE", "カレンダーが大きすぎます(5MBまで)。予定の少ないカレンダーを別に作って、そのURLを使ってください。");
  }
  const ics = new TextDecoder("utf-8").decode(buffer);
  if (ics.indexOf("BEGIN:VCALENDAR") < 0) {
    throw new HandoffError(502, "NOT_ICS", "返ってきた内容がカレンダー(iCal)ではありませんでした。URLを確かめてください。");
  }

  return jsonResponse(200, { ok: true, ics, fetchedAt: new Date().toISOString() });
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
