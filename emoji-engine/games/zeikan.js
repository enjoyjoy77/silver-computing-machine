/* =====================================================
   絵文字税関
   許可証と荷物を見比べて客を通すか止める
===================================================== */
(function(){
"use strict";

const TOTAL_TIME = 75;
const TOTAL_CUSTOMERS = 12;
const INSPECTION_LIMIT = 3;

const JOBS = [
  { face: "👨‍⚕️", place: "🏥" },
  { face: "👨‍🍳", place: "🍴" },
  { face: "🐧", place: "❄️" },
  { face: "🐫", place: "🏜️" },
];

const SAFE_ITEMS = [
  "🍎",
  "🍞",
  "📕",
  "🧸",
  "☂️",
  "📷",
  "🎁",
  "🥕",
];

const BANNED_ITEMS = [
  "🔪",
  "💣",
];

let S;

function copyItems(items){
  return items.slice();
}

function sameItems(a, b){
  if (a.length !== b.length){
    return false;
  }

  const left = a.slice().sort();
  const right = b.slice().sort();

  for (let i = 0; i < left.length; i++){
    if (left[i] !== right[i]){
      return false;
    }
  }

  return true;
}

function hasBannedItem(items){
  for (const item of items){
    if (BANNED_ITEMS.indexOf(item) >= 0){
      return true;
    }
  }

  return false;
}

function multiplier(){
  if (S.streak >= 6){
    return 3;
  }

  if (S.streak >= 3){
    return 2;
  }

  return 1;
}

function addFloater(x, y, text, color, size, life){
  S.floaters.push({
    x: x,
    y: y,
    text: text,
    color: color || "#fff",
    size: size || 24,
    t: life === undefined ? 0.8 : life,
  });
}

function updateFloaters(dt){
  for (const floater of S.floaters){
    floater.y -= 34 * dt;
    floater.t -= dt;
  }

  S.floaters = S.floaters.filter(
    floater => floater.t > 0
  );
}

function updateEffects(dt){
  updateFloaters(dt);

  S.shake = Math.max(
    0,
    S.shake - dt
  );

  S.redFlash = Math.max(
    0,
    S.redFlash - dt
  );

  S.whiteFlash = Math.max(
    0,
    S.whiteFlash - dt
  );
}

function makeCustomer(g, number){
  const job = JOBS[(number - 1) % JOBS.length];
  const itemA = SAFE_ITEMS[(number * 2) % SAFE_ITEMS.length];
  const itemB = SAFE_ITEMS[(number * 2 + 3) % SAFE_ITEMS.length];

  const customer = {
    face: job.face,
    correctPlace: job.place,
    destination: job.place,
    declared: [itemA, itemB],
    actual: [itemA, itemB],

    hiddenIndex: -1,
    inspected: false,
    humanitarian: false,
    dangerous: false,
  };

  if (number === 1){
    customer.declared = ["🍎", "📕"];
    customer.actual = ["🍎", "📷"];
  } else if (number === 2){
    customer.declared = ["🧸", "☂️"];
    customer.actual = ["🧸", "☂️"];
  } else if (number === 3){
    customer.declared = ["🍞", "🎁"];
    customer.actual = ["🍞", "🎁"];
  } else if (number === 4){
    customer.declared = ["🍎"];
    customer.actual = ["🍎", "🔪"];
    customer.dangerous = true;
  } else if (number === 5){
    customer.declared = ["📷", "🥕"];
    customer.actual = ["📷", "🥕"];
  } else if (number === 6){
    customer.declared = ["📕"];
    customer.actual = ["📕", "🎁"];
    customer.hiddenIndex = 1;
  } else if (number === 7){
    customer.declared = ["☂️", "🔪"];
    customer.actual = ["☂️", "🔪"];
  } else if (number === 8){
    customer.declared = ["🧸", "🍎"];
    customer.actual = ["🧸", "🍎"];
    customer.destination =
      JOBS[(number + 1) % JOBS.length].place;
  } else if (number === 9){
    customer.face = "👨‍⚕️";
    customer.correctPlace = "🏥";
    customer.destination = "🍴";
    customer.declared = ["🍞"];
    customer.actual = ["🍞"];
    customer.humanitarian = true;
  } else if (number === 10){
    customer.declared = ["📷"];
    customer.actual = ["📷", "💣"];
    customer.dangerous = true;
  } else if (number === 11){
    customer.face = "🐧";
    customer.correctPlace = "❄️";
    customer.destination = "🏜️";
    customer.declared = ["🧸", "☂️"];
    customer.actual = ["🧸", "☂️"];
    customer.humanitarian = true;
  } else if (number === 12){
    customer.face = "👨‍🍳";
    customer.correctPlace = "🍴";
    customer.destination = "🏥";
    customer.declared = ["🍎", "🥕"];
    customer.actual = ["🍎", "🔪"];
  }

  return customer;
}

function activeRuleCount(){
  if (S.customerNumber >= 8){
    return 3;
  }

  if (S.customerNumber >= 4){
    return 2;
  }

  return 1;
}

function normalRuleViolation(customer){
  if (!sameItems(
    customer.declared,
    customer.actual
  )){
    return true;
  }

  if (
    S.customerNumber >= 4 &&
    hasBannedItem(customer.actual)
  ){
    return true;
  }

  if (
    S.customerNumber >= 8 &&
    customer.destination !== customer.correctPlace
  ){
    return true;
  }

  return false;
}

function correctDecision(customer){
  if (customer.humanitarian){
    return "allow";
  }

  return normalRuleViolation(customer)
    ? "deny"
    : "allow";
}

function customerLimit(){
  return gCustomerLimit(S.customerNumber);
}

function gCustomerLimit(number){
  const wave = (number - 1) % 3;

  if (wave === 0){
    return 8;
  }

  if (wave === 1){
    return 7;
  }

  return 6;
}

function startCustomer(g){
  if (
    S.customerNumber >= TOTAL_CUSTOMERS ||
    S.elapsed >= TOTAL_TIME
  ){
    tryFinish(g);
    return;
  }

  S.customerNumber++;
  S.customer = makeCustomer(
    g,
    S.customerNumber
  );

  S.customerTimer = customerLimit();
  S.scene = "judge";
  S.stampTimer = 0;
  S.stampDecision = null;
  S.lastCorrect = false;
  S.lastHumanitarian = false;
  S.inspectionTimer = 0;

  if (S.customerNumber === 4){
    S.ruleBanner = {
      text: "今日から禁止品も確認",
      icons: "🧳  🔪💣  🙅",
      t: 1.6,
    };
    g.se("ping");
  } else if (S.customerNumber === 8){
    S.ruleBanner = {
      text: "今日から行き先も確認",
      icons: "👨‍⚕️→🏥  👨‍🍳→🍴  🐧→❄️  🐫→🏜️",
      t: 1.8,
    };
    g.se("ping");
  }
}

function reset(g){
  S = {
    scene: "title",

    elapsed: 0,
    score: 0,
    customerNumber: 0,
    customer: null,
    customerTimer: 8,

    correctCount: 0,
    missCount: 0,
    streak: 0,
    bestStreak: 0,
    humanitarianCount: 0,

    inspections: INSPECTION_LIMIT,
    inspectionTimer: 0,

    stampTimer: 0,
    stampDecision: null,
    lastCorrect: false,
    lastHumanitarian: false,

    dangerEvents: [],
    waitingForDanger: false,

    ruleBanner: null,
    audit: null,

    floaters: [],
    freeze: 0,
    shake: 0,
    redFlash: 0,
    whiteFlash: 0,

    endedByTime: false,
  };
}

function startGame(g){
  reset(g);
  S.scene = "judge";
  startCustomer(g);
  g.se("click");
}

function pointInside(x, y, width, height){
  return (
    gPointerX() >= x &&
    gPointerX() <= x + width &&
    gPointerY() >= y &&
    gPointerY() <= y + height
  );
}

function gPointerX(){
  return S.pointerX;
}

function gPointerY(){
  return S.pointerY;
}

function denyButtonHit(){
  return pointInside(70, 420, 260, 90);
}

function allowButtonHit(){
  return pointInside(630, 420, 260, 90);
}

function inspectButtonHit(){
  return pointInside(390, 432, 180, 64);
}

function useInspection(g){
  if (
    S.scene !== "judge" ||
    S.inspections <= 0 ||
    S.inspectionTimer > 0
  ){
    return;
  }

  S.inspections--;
  S.inspectionTimer = 0.7;
  S.customer.inspected = true;

  // 検査を使ったぶんだけ全体時間も進む
  S.elapsed = Math.min(
    TOTAL_TIME,
    S.elapsed + 0.6
  );

  S.customerTimer = Math.max(
    0,
    S.customerTimer - 0.6
  );

  addFloater(
    480,
    344,
    "🔍 荷物を確認",
    "#8de7ff",
    25,
    0.8
  );

  g.se("ping");
}

function queueDanger(){
  S.dangerEvents.push({
    t: 2,
    done: false,
  });
}

function judgeCustomer(g, decision, timeout){
  if (S.scene !== "judge"){
    return;
  }

  const expected = correctDecision(S.customer);
  const correct =
    !timeout &&
    decision === expected;

  S.lastCorrect = correct;
  S.lastHumanitarian =
    correct &&
    S.customer.humanitarian &&
    decision === "allow";

  S.stampDecision = decision;
  S.stampTimer = 0.46;
  S.scene = "stamp";

  if (correct){
    const oldMultiplier = multiplier();

    S.streak++;
    S.bestStreak = Math.max(
      S.bestStreak,
      S.streak
    );

    const newMultiplier = multiplier();
    let points = newMultiplier;

    if (S.lastHumanitarian){
      points += 2;
      S.humanitarianCount++;
    }

    S.score += points;
    S.correctCount++;

    S.freeze = Math.max(
      S.freeze,
      3 / 60
    );

    S.shake = Math.max(
      S.shake,
      0.08
    );

    S.whiteFlash = 0.08;

    addFloater(
      480,
      275,
      S.lastHumanitarian
        ? "❤️ +" + points
        : "🎯 +" + points,
      S.lastHumanitarian
        ? "#ff9fba"
        : "#ffe66d",
      31,
      0.9
    );

    if (newMultiplier > oldMultiplier){
      addFloater(
        480,
        220,
        "🔥×" + newMultiplier,
        "#ff9d45",
        38,
        1.2
      );
      g.se("clear");
    } else {
      g.se("hit");
    }
  } else {
    S.missCount++;
    S.streak = 0;

    if (!timeout){
      S.score -= 1;
    }

    S.freeze = Math.max(
      S.freeze,
      5 / 60
    );

    S.redFlash = 0.16;

    addFloater(
      480,
      275,
      timeout ? "⌛ 見送り" : "❌ -1",
      "#ff7b88",
      30,
      0.9
    );

    g.se("boom");
  }

  if (
    decision === "allow" &&
    S.customer.dangerous
  ){
    queueDanger();
  }
}

function correctRateIcons(){
  const handled =
    S.correctCount + S.missCount;

  if (handled <= 0){
    return "➖➖➖➖➖";
  }

  const count = Math.round(
    5 * S.correctCount / handled
  );

  let icons = "";

  for (let i = 0; i < 5; i++){
    icons += i < count ? "✅" : "▫️";
  }

  return icons;
}

function beginAudit(g){
  S.audit = {
    t: 0.4,
    icons: correctRateIcons(),
  };

  S.scene = "audit";
  S.freeze = Math.max(
    S.freeze,
    0.4
  );

  g.se("ping");
}

function afterStamp(g){
  if (
    S.customerNumber % 4 === 0
  ){
    beginAudit(g);
    return;
  }

  startCustomer(g);
}

function afterAudit(g){
  S.audit = null;

  if (
    S.customerNumber >= TOTAL_CUSTOMERS ||
    S.elapsed >= TOTAL_TIME
  ){
    tryFinish(g);
  } else {
    startCustomer(g);
  }
}

function explodeDanger(g, event){
  event.done = true;

  S.score -= 3;
  S.freeze = Math.max(
    S.freeze,
    10 / 60
  );
  S.shake = Math.max(
    S.shake,
    0.55
  );
  S.redFlash = 0.3;

  addFloater(
    480,
    260,
    "💥 危険品見逃し -3",
    "#ff5c63",
    38,
    1.3
  );

  g.se("boom");
}

function updateDangerEvents(g, dt){
  for (const event of S.dangerEvents){
    if (event.done){
      continue;
    }

    event.t -= dt;

    if (event.t <= 0){
      explodeDanger(g, event);
    }
  }

  S.dangerEvents = S.dangerEvents.filter(
    event => !event.done
  );

  if (
    S.scene === "dangerWait" &&
    S.dangerEvents.length <= 0
  ){
    finishGame(g);
  }
}

function tryFinish(g){
  if (S.dangerEvents.length > 0){
    S.scene = "dangerWait";
    S.waitingForDanger = true;
    return;
  }

  finishGame(g);
}

function finishGame(g){
  if (S.scene === "over"){
    return;
  }

  S.scene = "over";
  S.waitingForDanger = false;
  g.se("clear");
}

function updateJudge(g, dt){
  S.customerTimer -= dt;

  if (S.inspectionTimer > 0){
    S.inspectionTimer = Math.max(
      0,
      S.inspectionTimer - dt
    );
  }

  if (
    S.ruleBanner &&
    S.ruleBanner.t > 0
  ){
    S.ruleBanner.t -= dt;
  }

  if (g.pressed("left")){
    judgeCustomer(g, "deny", false);
    return;
  }

  if (g.pressed("right")){
    judgeCustomer(g, "allow", false);
    return;
  }

  if (g.pressed("action")){
    useInspection(g);
    return;
  }

  if (g.pointer.justDown){
    if (denyButtonHit()){
      judgeCustomer(g, "deny", false);
      return;
    }

    if (allowButtonHit()){
      judgeCustomer(g, "allow", false);
      return;
    }

    if (inspectButtonHit()){
      useInspection(g);
      return;
    }
  }

  if (S.customerTimer <= 0){
    judgeCustomer(g, "none", true);
  }
}

function updateStamp(g, dt){
  S.stampTimer -= dt;

  if (S.stampTimer <= 0){
    afterStamp(g);
  }
}

function updateAudit(g, dt){
  if (!S.audit){
    afterAudit(g);
    return;
  }

  S.audit.t -= dt;

  if (S.audit.t <= 0){
    afterAudit(g);
  }
}

function drawPanel(g, x, y, width, height, color){
  g.rect(
    x,
    y,
    width,
    height,
    color
  );

  g.rect(
    x,
    y,
    width,
    3,
    "#ffffff33"
  );
}

function drawTopBar(g){
  g.rect(
    0,
    0,
    g.W,
    58,
    "#081322dd"
  );

  g.text(
    "🛂 絵文字税関",
    18,
    20,
    20,
    "#fff",
    "left"
  );

  g.text(
    "客 " +
      S.customerNumber +
      " / " +
      TOTAL_CUSTOMERS,
    18,
    44,
    16,
    "#aabbd1",
    "left"
  );

  g.text(
    "得点 " + S.score,
    g.W / 2,
    22,
    24,
    "#ffe66d"
  );

  g.text(
    "🔥 " +
      S.streak +
      "  ×" +
      multiplier(),
    g.W / 2,
    46,
    17,
    "#ffad5c"
  );

  const remaining = Math.max(
    0,
    TOTAL_TIME - S.elapsed
  );

  g.text(
    "⏱ " + remaining.toFixed(1),
    g.W - 18,
    34,
    22,
    remaining < 10
      ? "#ff727e"
      : "#d8e5f5",
    "right"
  );
}

function drawRules(g){
  drawPanel(
    g,
    18,
    72,
    205,
    326,
    "#10243ddd"
  );

  g.text(
    "今日の規則",
    120,
    94,
    20,
    "#ffe8a3"
  );

  g.text(
    "A",
    42,
    130,
    17,
    "#8de7ff"
  );

  g.text(
    "📄 ＝ 🧳",
    126,
    130,
    27,
    "#fff"
  );

  if (activeRuleCount() >= 2){
    g.text(
      "B",
      42,
      181,
      17,
      "#8de7ff"
    );

    g.text(
      "🔪💣 → 🙅",
      126,
      181,
      25,
      "#fff"
    );
  } else {
    g.text(
      "🔒",
      126,
      181,
      24,
      "#607086"
    );
  }

  if (activeRuleCount() >= 3){
    g.text(
      "C",
      42,
      228,
      17,
      "#8de7ff"
    );

    g.text(
      "👨‍⚕️→🏥",
      126,
      221,
      20,
      "#fff"
    );

    g.text(
      "👨‍🍳→🍴",
      126,
      249,
      20,
      "#fff"
    );

    g.text(
      "🐧→❄️",
      126,
      277,
      20,
      "#fff"
    );

    g.text(
      "🐫→🏜️",
      126,
      305,
      20,
      "#fff"
    );
  } else {
    g.text(
      "🔒",
      126,
      245,
      24,
      "#607086"
    );
  }

  g.text(
    "←止める",
    42,
    365,
    16,
    "#ff9ba5",
    "left"
  );

  g.text(
    "通す→",
    198,
    365,
    16,
    "#9ee7ad",
    "right"
  );
}

function drawItemRow(
  g,
  items,
  hiddenIndex,
  inspected,
  x,
  y
){
  const gap = 54;
  const left =
    x - (items.length - 1) * gap / 2;

  for (let i = 0; i < items.length; i++){
    const hidden =
      i === hiddenIndex &&
      !inspected;

    if (hidden){
      g.emoji(
        "❓",
        left + i * gap,
        y,
        35,
        { alpha: 0.75 }
      );
    } else {
      g.emoji(
        items[i],
        left + i * gap,
        y,
        inspected ? 46 : 38
      );
    }
  }
}

function drawCustomer(g, ox, oy){
  const customer = S.customer;

  if (!customer){
    return;
  }

  drawPanel(
    g,
    242 + ox,
    72 + oy,
    700,
    326,
    "#152238ee"
  );

  g.emoji(
    customer.face,
    355 + ox,
    164 + oy,
    92
  );

  if (customer.humanitarian){
    g.emoji(
      "❤️",
      402 + ox,
      118 + oy,
      27
    );

    g.emoji(
      "⌛",
      309 + ox,
      118 + oy,
      26
    );
  }

  g.text(
    "📄 許可証",
    535 + ox,
    102 + oy,
    20,
    "#bfd9f7"
  );

  drawPanel(
    g,
    446 + ox,
    119 + oy,
    180,
    93,
    "#e5ddc5"
  );

  drawItemRow(
    g,
    customer.declared,
    -1,
    true,
    536 + ox,
    155 + oy
  );

  g.text(
    "行き先",
    480 + ox,
    197 + oy,
    14,
    "#554f43",
    "left"
  );

  g.emoji(
    customer.destination,
    589 + ox,
    193 + oy,
    30
  );

  g.text(
    "🧳 実際の荷物",
    770 + ox,
    102 + oy,
    20,
    "#bfd9f7"
  );

  const inspecting =
    S.inspectionTimer > 0;

  drawPanel(
    g,
    662 + ox,
    119 + oy,
    220,
    93,
    inspecting
      ? "#294e61"
      : "#26334a"
  );

  drawItemRow(
    g,
    customer.actual,
    customer.hiddenIndex,
    customer.inspected,
    772 + ox,
    163 + oy
  );

  if (
    customer.hiddenIndex >= 0 &&
    !customer.inspected
  ){
    g.text(
      "形は見えるが中身が不明",
      772 + ox,
      199 + oy,
      13,
      "#ffdc8a"
    );
  }

  const ratio = g.clamp(
    S.customerTimer / customerLimit(),
    0,
    1
  );

  g.rect(
    280 + ox,
    250 + oy,
    624,
    16,
    "#09121f"
  );

  g.rect(
    280 + ox,
    250 + oy,
    624 * ratio,
    16,
    ratio < 0.3
      ? "#ff6572"
      : "#67d6b0"
  );

  g.text(
    "判定まで " +
      Math.max(0, S.customerTimer).toFixed(1),
    592 + ox,
    286 + oy,
    17,
    "#cbd8e8"
  );

  if (customer.humanitarian){
    g.text(
      "⌛ 軽い違反　❤️ 通せば思いやりボーナス",
      592 + ox,
      330 + oy,
      20,
      "#ffb6c8"
    );
  } else {
    g.text(
      "絵を見比べて判定",
      592 + ox,
      330 + oy,
      19,
      "#aabbd1"
    );
  }
}

function drawButtons(g){
  drawPanel(
    g,
    70,
    420,
    260,
    90,
    "#552833"
  );

  g.emoji(
    "🙅",
    132,
    465,
    52
  );

  g.text(
    "止める",
    245,
    465,
    25,
    "#fff"
  );

  const inspectColor =
    S.inspections > 0
      ? "#254b60"
      : "#242b35";

  drawPanel(
    g,
    390,
    432,
    180,
    64,
    inspectColor
  );

  g.text(
    "🔍 検査",
    480,
    454,
    21,
    S.inspections > 0
      ? "#d8f5ff"
      : "#71808e"
  );

  g.text(
    "残り " + S.inspections,
    480,
    480,
    15,
    S.inspections > 0
      ? "#9edbed"
      : "#71808e"
  );

  drawPanel(
    g,
    630,
    420,
    260,
    90,
    "#24543b"
  );

  g.text(
    "通す",
    715,
    465,
    25,
    "#fff"
  );

  g.emoji(
    "🙆",
    828,
    465,
    52
  );
}

function drawStamp(g, ox, oy){
  if (
    S.scene !== "stamp" ||
    !S.stampDecision
  ){
    return;
  }

  const progress = g.clamp(
    1 - S.stampTimer / 0.46,
    0,
    1
  );

  let scale = 1;
  let y = 278;

  // 構え、押す、めり込む、戻るの4段階
  if (progress < 0.25){
    y = 235 - progress * 80;
    scale = 0.9;
  } else if (progress < 0.5){
    y = 263;
    scale = 1.05;
  } else if (progress < 0.75){
    y = 270;
    scale = 0.88;
  } else {
    y = 270 - (progress - 0.75) * 30;
    scale = 1;
  }

  const allow =
    S.stampDecision === "allow";

  g.emoji(
    allow ? "🙆" : "🙅",
    592 + ox,
    y + oy,
    92 * scale
  );

  g.text(
    allow ? "通過" : "停止",
    592 + ox,
    354 + oy,
    40 * scale,
    allow ? "#81e8a2" : "#ff8290"
  );
}

function drawRuleBanner(g){
  if (
    !S.ruleBanner ||
    S.ruleBanner.t <= 0
  ){
    return;
  }

  g.rect(
    220,
    70,
    740,
    84,
    "#05101eee"
  );

  g.text(
    S.ruleBanner.text,
    590,
    94,
    21,
    "#ffe66d"
  );

  g.text(
    S.ruleBanner.icons,
    590,
    130,
    24,
    "#fff"
  );
}

function drawAudit(g){
  if (
    S.scene !== "audit" ||
    !S.audit
  ){
    return;
  }

  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#06101ddd"
  );

  drawPanel(
    g,
    215,
    158,
    530,
    210,
    "#19304bee"
  );

  g.text(
    "📋 監査",
    g.W / 2,
    205,
    36,
    "#ffe66d"
  );

  g.text(
    S.audit.icons,
    g.W / 2,
    270,
    45,
    "#fff"
  );

  g.text(
    "次の区画へ",
    g.W / 2,
    330,
    21,
    "#b9cce2"
  );
}

function drawFloaters(g, ox, oy){
  for (const floater of S.floaters){
    g.text(
      floater.text,
      floater.x + ox,
      floater.y + oy,
      floater.size,
      floater.color
    );
  }
}

function drawTitle(g){
  g.text(
    "🛂",
    g.W / 2,
    115,
    92
  );

  g.text(
    "絵文字税関",
    g.W / 2,
    200,
    46,
    "#fff"
  );

  g.text(
    "📄と🧳を見比べて、通すか止めるか",
    g.W / 2,
    255,
    23,
    "#c4d5e8"
  );

  g.text(
    "← 🙅　　🔍 スペース　　🙆 →",
    g.W / 2,
    315,
    25,
    "#ffe6a1"
  );

  g.text(
    "危険品は必ず荷物の中に見える",
    g.W / 2,
    356,
    19,
    "#ff9da6"
  );

  g.text(
    "クリック または スペースで開始",
    g.W / 2,
    440,
    23,
    "#fff"
  );
}

function drawDangerWait(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#07101dcc"
  );

  g.text(
    "処理を確認中…",
    g.W / 2,
    230,
    30,
    "#d4e2f1"
  );

  g.text(
    "🛂  ⋯  🧳",
    g.W / 2,
    300,
    52,
    "#fff"
  );
}

function drawResult(g){
  g.text(
    "業務終了",
    g.W / 2,
    82,
    42,
    "#ffe66d"
  );

  g.text(
    S.endedByTime
      ? "⏱ 制限時間終了"
      : "✅ 12人の判定完了",
    g.W / 2,
    127,
    21,
    "#c4d5e8"
  );

  drawPanel(
    g,
    230,
    160,
    500,
    250,
    "#14263ddd"
  );

  g.text(
    "得点  " + S.score,
    g.W / 2,
    205,
    36,
    "#fff"
  );

  g.text(
    "正解  " +
      S.correctCount +
      " / " +
      (S.correctCount + S.missCount),
    g.W / 2,
    258,
    24,
    "#bde8cf"
  );

  g.text(
    "最大ストリーク  🔥" +
      S.bestStreak,
    g.W / 2,
    306,
    23,
    "#ffb168"
  );

  g.text(
    "思いやりで通した人数  ❤️" +
      S.humanitarianCount,
    g.W / 2,
    354,
    22,
    "#ffb2c7"
  );

  g.text(
    "クリック または スペースでもう一度",
    g.W / 2,
    463,
    21,
    "#fff"
  );
}

EmojiEngine.register({
  id: "zeikan",
  name: "絵文字税関",
  icon: "🛂",
  desc: "許可証と荷物の矛盾を見つけて通すか止めるか判断する",

  init(g){
    reset(g);
    this._state = S;
  },

  update(g, dt){
    S.pointerX = g.pointer.x;
    S.pointerY = g.pointer.y;

    updateEffects(dt);

    if (
      S.scene !== "title" &&
      S.scene !== "over"
    ){
      S.elapsed += dt;

      if (
        S.elapsed >= TOTAL_TIME &&
        S.scene !== "dangerWait"
      ){
        S.elapsed = TOTAL_TIME;
        S.endedByTime = true;
        tryFinish(g);
      }
    }

    updateDangerEvents(g, dt);

    if (S.scene === "title"){
      if (
        g.pressed("action") ||
        g.pointer.justDown
      ){
        startGame(g);
        this._state = S;
      }

      return;
    }

    if (S.scene === "over"){
      if (
        g.pressed("action") ||
        g.pointer.justDown
      ){
        startGame(g);
        this._state = S;
      }

      return;
    }

    if (S.scene === "dangerWait"){
      return;
    }

    if (S.freeze > 0){
      S.freeze = Math.max(
        0,
        S.freeze - dt
      );
      return;
    }

    if (S.scene === "judge"){
      updateJudge(g, dt);
      return;
    }

    if (S.scene === "stamp"){
      updateStamp(g, dt);
      return;
    }

    if (S.scene === "audit"){
      updateAudit(g, dt);
    }
  },

  draw(g){
    g.bg("#091525");

    const shakePower =
      S.shake > 0
        ? 9 * S.shake / 0.55
        : 0;

    const ox =
      shakePower > 0
        ? g.rand(
          -shakePower,
          shakePower
        )
        : 0;

    const oy =
      shakePower > 0
        ? g.rand(
          -shakePower,
          shakePower
        )
        : 0;

    for (let x = 30; x < g.W; x += 62){
      g.emoji(
        "✦",
        x,
        65 + Math.sin(g.time * 2 + x) * 3,
        12,
        { alpha: 0.12 }
      );
    }

    if (S.scene === "title"){
      drawTitle(g);
    } else if (S.scene === "over"){
      drawResult(g);
    } else {
      drawTopBar(g);
      drawRules(g);

      if (S.customer){
        drawCustomer(g, ox, oy);
      }

      if (
        S.scene === "judge" ||
        S.scene === "stamp"
      ){
        drawButtons(g);
      }

      drawStamp(g, ox, oy);
      drawFloaters(g, ox, oy);
      drawRuleBanner(g);

      if (S.scene === "audit"){
        drawAudit(g);
      }

      if (S.scene === "dangerWait"){
        drawDangerWait(g);
      }
    }

    if (S.redFlash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#ff293c55"
      );
    }

    if (S.whiteFlash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#ffffff22"
      );
    }

    g.text(
      "rev1",
      g.W - 8,
      14,
      12,
      "#ffffff66",
      "right"
    );
  },
});
})();
