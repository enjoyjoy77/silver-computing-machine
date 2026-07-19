/* =====================================================
   学園絵文字マスター
   8ターンでカードを選び、3つの力を育てる
===================================================== */
(function(){
"use strict";

/* ---------- ゲームの決まり ---------- */

const TOTAL_TURNS = 8;
const PRACTICE_TURNS = 4;
const START_HP = 42;
const START_ENERGY = 8;
const TARGET_TOTAL = 90;
const TARGET_MIN = 15;
const HAND_SIZE = 3;

const COLORS = {
  background: "#11162b",
  panel: "#202943",
  panelLight: "#2b3858",
  card: "#fff8e7",
  cardSense: "#fff0b8",
  cardLogic: "#ffe4ef",
  cardCommon: "#e5f4ff",
  text: "#ffffff",
  darkText: "#283047",
  dim: "#aeb7ca",
  gold: "#ffe36e",
  blue: "#67c8ff",
  pink: "#ff8fc2",
  red: "#ff6e67",
  green: "#7fe0a3",
  purple: "#c69cff",
};

const PARAMS = [
  {
    key: "vocal",
    icon: "🎤",
    name: "うた",
    color: "#ff8d9d",
  },
  {
    key: "rhythm",
    icon: "🕺",
    name: "リズム",
    color: "#71cfff",
  },
  {
    key: "expression",
    icon: "🎨",
    name: "ひょうげん",
    color: "#d59aff",
  },
];

/*
  初期デッキは9枚必要なので、共通3枚と型カード5種に加え、
  選んだ型の代表カードをもう1枚入れる。
*/
const CARDS = {
  voice: {
    id: "voice",
    type: "common",
    icon: "🎤🎵",
    name: "発声練習",
    cost: 3,
    text: "🎤うた +8",
  },
  dance: {
    id: "dance",
    type: "common",
    icon: "🕺💨",
    name: "振り付け確認",
    cost: 3,
    text: "🕺リズム +8",
  },
  face: {
    id: "face",
    type: "common",
    icon: "🎨✨",
    name: "表情練習",
    cost: 3,
    text: "🎨ひょうげん +8",
  },

  rideWave: {
    id: "rideWave",
    type: "sense",
    icon: "😊🌟",
    name: "波に乗る",
    cost: 4,
    text: "最高の力+5 / 好調2",
  },
  focus: {
    id: "focus",
    type: "sense",
    icon: "🎯🧘",
    name: "集中する",
    cost: 3,
    text: "集中+4",
  },
  fullAppeal: {
    id: "fullAppeal",
    type: "sense",
    icon: "🚀",
    name: "全力アピール",
    cost: 7,
    text: "🎤+7・🕺+7 / 集中加算",
  },
  climax: {
    id: "climax",
    type: "sense",
    icon: "🌈💥",
    name: "クライマックス",
    cost: 8,
    text: "最高+15 / 好調と集中を消費",
  },
  keepMomentum: {
    id: "keepMomentum",
    type: "sense",
    icon: "😊🎯",
    name: "勢いに乗る",
    cost: 5,
    text: "好調中なら集中+3",
  },

  friendlyTalk: {
    id: "friendlyTalk",
    type: "logic",
    icon: "💕👋",
    name: "親しみトーク",
    cost: 3,
    text: "🎨+4 / 好印象+3",
  },
  spirit: {
    id: "spirit",
    type: "logic",
    icon: "🔥📣",
    name: "気合い注入",
    cost: 2,
    text: "やる気+3 / 元気回復",
  },
  circle: {
    id: "circle",
    type: "logic",
    icon: "🛡️🤝",
    name: "仲間と円陣",
    cost: 2,
    text: "元気+5+やる気 / 好印象+1",
  },
  fanService: {
    id: "fanService",
    type: "logic",
    icon: "💌🎁",
    name: "ファンサービス",
    cost: 5,
    text: "最低+6+好印象",
  },
  smile: {
    id: "smile",
    type: "logic",
    icon: "💕✨",
    name: "みんなに笑顔を",
    cost: 4,
    text: "3つの力+2 / 好印象+2",
  },
};

const COMMON_IDS = [
  "voice",
  "dance",
  "face",
];

const SENSE_IDS = [
  "rideWave",
  "focus",
  "fullAppeal",
  "climax",
  "keepMomentum",
];

const LOGIC_IDS = [
  "friendlyTalk",
  "spirit",
  "circle",
  "fanService",
  "smile",
];

let S;

/* ---------- 小さな共通処理 ---------- */

function pointInRect(g, x, y, w, h){
  return (
    g.pointer.x >= x &&
    g.pointer.x <= x + w &&
    g.pointer.y >= y &&
    g.pointer.y <= y + h
  );
}

function shuffle(g, source){
  const result = source.slice();

  for (let i = result.length - 1; i > 0; i--){
    const j = Math.floor(g.rand(0, i + 1));
    const old = result[i];
    result[i] = result[j];
    result[j] = old;
  }

  return result;
}

function addFloater(
  x,
  y,
  text,
  color,
  size,
  life
){
  S.floaters.push({
    x: x,
    y: y,
    text: text,
    color: color || COLORS.text,
    size: size || 25,
    t: life === undefined ? 0.9 : life,
    maxT: life === undefined ? 0.9 : life,
  });
}

function startConfetti(g, amount){
  const colors = [
    "#ff6f91",
    "#ffe36e",
    "#67c8ff",
    "#7fe0a3",
    "#c69cff",
  ];

  for (let i = 0; i < (amount || 42); i++){
    S.confetti.push({
      x: g.rand(180, 780),
      y: g.rand(75, 185),
      vx: g.rand(-105, 105),
      vy: g.rand(-225, -70),
      vyStart: 0,
      rot: g.rand(0, 6.28),
      vr: g.rand(-9, 9),
      color: g.pick(colors),
      t: g.rand(1.1, 1.9),
    });
  }
}

function startStars(g){
  for (let i = 0; i < 18; i++){
    S.stars.push({
      x: 480,
      y: 190,
      vx: g.rand(-180, 180),
      vy: g.rand(-180, 70),
      t: g.rand(0.7, 1.25),
      size: g.rand(16, 30),
    });
  }
}

function updateEffects(dt){
  for (const floater of S.floaters){
    floater.y -= 35 * dt;
    floater.t -= dt;
  }

  S.floaters = S.floaters.filter(
    floater => floater.t > 0
  );

  for (const particle of S.confetti){
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 155 * dt;
    particle.rot += particle.vr * dt;
    particle.t -= dt;
  }

  S.confetti = S.confetti.filter(
    particle => particle.t > 0
  );

  for (const star of S.stars){
    star.x += star.vx * dt;
    star.y += star.vy * dt;
    star.vy += 145 * dt;
    star.t -= dt;
  }

  S.stars = S.stars.filter(
    star => star.t > 0
  );

  for (const heart of S.hearts){
    heart.t -= dt;
  }

  S.hearts = S.hearts.filter(
    heart => heart.t > 0
  );

  S.shake = Math.max(0, S.shake - dt);
  S.flash = Math.max(0, S.flash - dt);
  S.paramPop = Math.max(0, S.paramPop - dt);
  S.messageTimer = Math.max(
    0,
    S.messageTimer - dt
  );
}

function totalParameter(){
  return (
    S.params.vocal +
    S.params.rhythm +
    S.params.expression
  );
}

function lowestParamKey(){
  let result = PARAMS[0].key;

  for (const param of PARAMS){
    if (
      S.params[param.key] <
      S.params[result]
    ){
      result = param.key;
    }
  }

  return result;
}

function highestParamKey(){
  let result = PARAMS[0].key;

  for (const param of PARAMS){
    if (
      S.params[param.key] >
      S.params[result]
    ){
      result = param.key;
    }
  }

  return result;
}

function paramInfo(key){
  return PARAMS.find(
    param => param.key === key
  );
}

function cardColor(card){
  if (card.type === "sense"){
    return COLORS.cardSense;
  }

  if (card.type === "logic"){
    return COLORS.cardLogic;
  }

  return COLORS.cardCommon;
}

/* ---------- ゲームの準備 ---------- */

function reset(){
  S = {
    scene: "title",
    style: null,

    turn: 0,
    hp: START_HP,
    energy: START_ENERGY,
    params: {
      vocal: 0,
      rhythm: 0,
      expression: 0,
    },

    good: 0,
    focus: 0,
    impression: 0,
    motivation: 0,

    deck: [],
    drawPile: [],
    discard: [],
    hand: [],
    offers: [],

    redrawUsed: false,
    firstHand: true,
    pendingMilestone: 0,

    floaters: [],
    confetti: [],
    stars: [],
    hearts: [],
    freeze: 0,
    shake: 0,
    flash: 0,
    paramPop: 0,

    crossed70: false,
    crossed90: false,
    result: "",
    message: "",
    messageTimer: 0,
  };
}

function initialDeck(style){
  const typeCards =
    style === "sense"
      ? SENSE_IDS
      : LOGIC_IDS;

  const representative =
    style === "sense"
      ? "rideWave"
      : "friendlyTalk";

  return COMMON_IDS
    .concat(typeCards)
    .concat([representative]);
}

function chooseStyle(g, style){
  S.style = style;
  S.turn = 0;
  S.hp = START_HP;
  S.energy = START_ENERGY;

  S.params.vocal = 0;
  S.params.rhythm = 0;
  S.params.expression = 0;

  S.good = 0;
  S.focus = 0;
  S.impression = 0;
  S.motivation = 0;

  S.deck = initialDeck(style);
  S.drawPile = shuffle(g, S.deck);
  S.discard = [];
  S.hand = [];
  S.offers = [];

  S.redrawUsed = false;
  S.firstHand = true;
  S.crossed70 = false;
  S.crossed90 = false;
  S.result = "";

  beginTurn(g);
  g.se("clear");
}

function refillDrawPile(g){
  if (S.drawPile.length > 0){
    return;
  }

  S.drawPile = shuffle(g, S.discard);
  S.discard = [];
}

function drawOne(g){
  refillDrawPile(g);

  if (S.drawPile.length <= 0){
    return null;
  }

  return S.drawPile.pop();
}

function drawHand(g){
  const hand = [];

  while (hand.length < HAND_SIZE){
    const cardId = drawOne(g);

    if (!cardId){
      break;
    }

    hand.push(cardId);
  }

  if (S.firstHand){
    const representative =
      S.style === "sense"
        ? "rideWave"
        : "friendlyTalk";

    if (hand.indexOf(representative) < 0){
      const deckIndex =
        S.drawPile.indexOf(representative);

      if (deckIndex >= 0){
        const removed = hand.pop();

        if (removed){
          S.drawPile.push(removed);
        }

        hand.push(
          S.drawPile.splice(deckIndex, 1)[0]
        );
      } else {
        const discardIndex =
          S.discard.indexOf(representative);

        if (discardIndex >= 0){
          const removed = hand.pop();

          if (removed){
            S.discard.push(removed);
          }

          hand.push(
            S.discard.splice(
              discardIndex,
              1
            )[0]
          );
        }
      }
    }

    S.firstHand = false;
  }

  S.hand = shuffle(g, hand);
}

function beginTurn(g){
  S.turn++;
  S.redrawUsed = false;
  S.scene = "play";
  S.message =
    S.turn <= PRACTICE_TURNS
      ? "練習ターン"
      : "本番ターン";
  S.messageTimer = 0.9;

  drawHand(g);
  g.se("ping");
}

/* ---------- カードの効果 ---------- */

function spendCost(cost){
  let remaining = cost;
  const energyPaid = Math.min(
    S.energy,
    remaining
  );

  S.energy -= energyPaid;
  remaining -= energyPaid;

  const hpPaid = Math.min(
    S.hp,
    remaining
  );

  S.hp -= hpPaid;
  remaining -= hpPaid;

  return remaining <= 0;
}

function canPay(cost){
  return S.energy + S.hp >= cost;
}

function addParameter(
  g,
  key,
  baseAmount,
  useFocus
){
  let amount = baseAmount;

  if (S.good > 0){
    amount = Math.round(amount * 1.5);
  }

  if (useFocus && S.focus > 0){
    amount += S.focus;
  }

  S.params[key] += amount;

  const info = paramInfo(key);

  addFloater(
    info.key === "vocal"
      ? 188
      : info.key === "rhythm"
        ? 480
        : 772,
    145,
    info.icon + "+" + amount,
    info.color,
    31,
    1.05
  );

  S.paramPop = 0.28;
}

function addRawParameter(
  key,
  amount,
  x,
  y
){
  S.params[key] += amount;

  const info = paramInfo(key);

  addFloater(
    x,
    y,
    info.icon + "+" + amount,
    info.color,
    29,
    1
  );

  S.paramPop = 0.28;
}

function useCardEffect(g, cardId){
  if (cardId === "voice"){
    addParameter(g, "vocal", 8, false);
  } else if (cardId === "dance"){
    addParameter(g, "rhythm", 8, false);
  } else if (cardId === "face"){
    addParameter(
      g,
      "expression",
      8,
      false
    );
  } else if (cardId === "rideWave"){
    addParameter(
      g,
      highestParamKey(),
      5,
      false
    );
    S.good = Math.max(S.good, 2);
  } else if (cardId === "focus"){
    S.focus += 4;
    addFloater(
      480,
      172,
      "🎯 集中+4",
      COLORS.blue,
      29,
      1
    );
  } else if (cardId === "fullAppeal"){
    addParameter(g, "vocal", 7, true);
    addParameter(g, "rhythm", 7, true);
  } else if (cardId === "climax"){
    const hadGood = S.good > 0;
    let amount = hadGood ? 15 : 8;

    if (hadGood){
      amount = Math.round(amount * 1.5);
    }

    amount += S.focus;

    addRawParameter(
      highestParamKey(),
      amount,
      480,
      150
    );

    S.good = 0;
    S.focus = 0;

    addFloater(
      480,
      205,
      hadGood
        ? "🌈 クライマックス!"
        : "好調切れ・効果半減",
      hadGood ? COLORS.gold : COLORS.dim,
      hadGood ? 34 : 25,
      1.2
    );

    S.shake = 0.33;
    S.flash = 0.16;
  } else if (cardId === "keepMomentum"){
    if (S.good > 0){
      S.focus += 3;
      addFloater(
        480,
        172,
        "🎯 集中+3",
        COLORS.blue,
        28,
        1
      );
    } else {
      addFloater(
        480,
        172,
        "好調が必要",
        COLORS.dim,
        22,
        0.8
      );
    }
  } else if (cardId === "friendlyTalk"){
    addParameter(
      g,
      "expression",
      4,
      false
    );
    S.impression += 3;
  } else if (cardId === "spirit"){
    S.motivation += 3;

    const gained =
      3 + S.motivation;

    S.energy += gained;

    addFloater(
      480,
      176,
      "🔥元気+" + gained,
      COLORS.red,
      29,
      1
    );
  } else if (cardId === "circle"){
    const gained =
      5 + S.motivation;

    S.energy += gained;
    S.impression += 1;

    addFloater(
      480,
      176,
      "🛡️元気+" + gained,
      COLORS.green,
      29,
      1
    );
  } else if (cardId === "fanService"){
    addParameter(
      g,
      lowestParamKey(),
      6 + S.impression,
      false
    );
  } else if (cardId === "smile"){
    addParameter(g, "vocal", 2, false);
    addParameter(g, "rhythm", 2, false);
    addParameter(
      g,
      "expression",
      2,
      false
    );
    S.impression += 2;
  }
}

function checkScoreEvents(g, before){
  const after = totalParameter();

  if (
    S.turn > PRACTICE_TURNS &&
    !S.crossed70 &&
    before < 70 &&
    after >= 70
  ){
    S.crossed70 = true;
    startStars(g);
    addFloater(
      480,
      205,
      "⭐ いいぞ!",
      COLORS.gold,
      37,
      1.25
    );
    S.freeze = 4 / 60;
    S.flash = 0.13;
    g.se("clear");
  }

  if (
    !S.crossed90 &&
    before < TARGET_TOTAL &&
    after >= TARGET_TOTAL
  ){
    S.crossed90 = true;
    startConfetti(g, 52);
    S.freeze = 7 / 60;
    S.shake = 0.38;
    S.flash = 0.22;
    addFloater(
      480,
      245,
      "🎉 ノルマ到達!",
      COLORS.gold,
      39,
      1.35
    );
    g.se("clear");
  }
}

function useCard(g, index){
  if (
    S.scene !== "play" ||
    index < 0 ||
    index >= S.hand.length
  ){
    return;
  }

  const cardId = S.hand[index];
  const card = CARDS[cardId];

  if (!canPay(card.cost)){
    addFloater(
      480,
      238,
      "体力と元気が足りない",
      COLORS.red,
      25,
      0.9
    );
    S.shake = 0.2;
    g.se("hit");
    return;
  }

  const before = totalParameter();

  spendCost(card.cost);
  useCardEffect(g, cardId);

  for (const handCard of S.hand){
    S.discard.push(handCard);
  }

  S.hand = [];
  S.freeze = Math.max(S.freeze, 3 / 60);
  S.shake = Math.max(S.shake, 0.12);
  g.se("bounce");

  checkScoreEvents(g, before);
  finishTurn(g);
}

function redrawHand(g){
  if (
    S.scene !== "play" ||
    S.turn <= PRACTICE_TURNS ||
    S.redrawUsed
  ){
    return;
  }

  for (const cardId of S.hand){
    S.discard.push(cardId);
  }

  S.hand = [];
  S.redrawUsed = true;
  drawHand(g);

  addFloater(
    480,
    215,
    "🔄 無料で引き直した",
    COLORS.blue,
    27,
    1
  );

  g.se("ping");
}

function finishTurn(g){
  if (S.impression > 0){
    const key = lowestParamKey();
    const info = paramInfo(key);
    const amount = S.impression;

    S.params[key] += amount;
    S.hearts.push({
      key: key,
      t: 0.75,
      maxT: 0.75,
    });

    addFloater(
      key === "vocal"
        ? 188
        : key === "rhythm"
          ? 480
          : 772,
      178,
      "💕+" + amount,
      COLORS.pink,
      28,
      1
    );

    S.impression = Math.max(
      0,
      S.impression - 1
    );
  }

  if (S.focus > 0){
    S.focus--;
  }

  if (S.good > 0){
    S.good--;
  }

  if (
    S.turn === 2 ||
    S.turn === 4
  ){
    beginMilestone(g);
    return;
  }

  if (S.turn >= TOTAL_TURNS){
    finishGame(g);
    return;
  }

  beginTurn(g);
}

/* ---------- 節目のカード追加 ---------- */

function randomTypeCard(g){
  const selectedPool =
    S.style === "sense"
      ? SENSE_IDS
      : LOGIC_IDS;

  const oppositePool =
    S.style === "sense"
      ? LOGIC_IDS
      : SENSE_IDS;

  const useSelected =
    g.rand(0, 1) < 0.7;

  let pool =
    useSelected
      ? selectedPool
      : oppositePool;

  if (
    S.turn === 4 &&
    g.rand(0, 1) < 0.45
  ){
    const finishers =
      S.style === "sense"
        ? ["climax", "fullAppeal"]
        : ["fanService", "smile"];

    if (useSelected){
      pool = finishers;
    }
  }

  return g.pick(pool);
}

function makeOffers(g){
  const offers = [];
  let guard = 0;

  while (
    offers.length < 3 &&
    guard < 30
  ){
    guard++;

    const cardId = randomTypeCard(g);

    if (offers.indexOf(cardId) < 0){
      offers.push(cardId);
    }
  }

  while (offers.length < 3){
    offers.push(randomTypeCard(g));
  }

  return offers;
}

function beginMilestone(g){
  S.pendingMilestone = S.turn;
  S.offers = makeOffers(g);
  S.scene = "milestone";
  S.message =
    S.turn === 4
      ? "本番直前のデッキ追加"
      : "練習の節目";
  S.messageTimer = 1.2;
  g.se("clear");
}

function chooseOffer(g, index){
  if (
    S.scene !== "milestone" ||
    index < 0 ||
    index >= S.offers.length
  ){
    return;
  }

  const cardId = S.offers[index];

  S.deck.push(cardId);
  S.discard.push(cardId);
  S.offers = [];

  addFloater(
    480,
    210,
    CARDS[cardId].icon + "を追加",
    COLORS.gold,
    29,
    1.1
  );

  g.se("coin");

  if (S.pendingMilestone >= TOTAL_TURNS){
    finishGame(g);
  } else {
    beginTurn(g);
  }
}

function finishGame(g){
  const total = totalParameter();
  const minClear = PARAMS.every(
    param => S.params[param.key] >= TARGET_MIN
  );

  S.result =
    total >= TARGET_TOTAL && minClear
      ? "合格"
      : "不合格";

  S.scene = "over";

  if (S.result === "合格"){
    startConfetti(g, 62);
    S.flash = 0.24;
    g.se("clear");
  } else {
    g.se("hit");
  }
}

/* ---------- 入力 ---------- */

function cardRect(index){
  return {
    x: 101 + index * 263,
    y: 275,
    w: 232,
    h: 206,
  };
}

function styleRect(index){
  return {
    x: index === 0 ? 165 : 505,
    y: 214,
    w: 290,
    h: 205,
  };
}

function redrawRect(){
  return {
    x: 757,
    y: 213,
    w: 166,
    h: 47,
  };
}

function updateStyleSelect(g){
  if (g.pressed("left")){
    chooseStyle(g, "sense");
    return;
  }

  if (g.pressed("right")){
    chooseStyle(g, "logic");
    return;
  }

  if (!g.pointer.justDown){
    return;
  }

  for (let i = 0; i < 2; i++){
    const rect = styleRect(i);

    if (pointInRect(
      g,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    )){
      chooseStyle(
        g,
        i === 0 ? "sense" : "logic"
      );
      return;
    }
  }
}

function updateCardChoice(g, milestone){
  for (let i = 0; i < 3; i++){
    if (
      g.pressed(String(i + 1)) ||
      g.pressed("Digit" + (i + 1))
    ){
      if (milestone){
        chooseOffer(g, i);
      } else {
        useCard(g, i);
      }

      return;
    }
  }

  if (!g.pointer.justDown){
    return;
  }

  for (let i = 0; i < 3; i++){
    const rect = cardRect(i);

    if (pointInRect(
      g,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    )){
      if (milestone){
        chooseOffer(g, i);
      } else {
        useCard(g, i);
      }

      return;
    }
  }

  if (!milestone){
    const rect = redrawRect();

    if (pointInRect(
      g,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    )){
      redrawHand(g);
    }
  }
}

/* ---------- 描画の部品 ---------- */

function drawPanel(
  g,
  x,
  y,
  w,
  h,
  color,
  border
){
  g.rect(
    x + 5,
    y + 6,
    w,
    h,
    "rgba(0,0,0,0.24)"
  );

  g.rect(
    x,
    y,
    w,
    h,
    color || COLORS.panel
  );

  const edge = border || "#ffffff33";

  g.rect(x, y, w, 3, edge);
  g.rect(x, y + h - 3, w, 3, edge);
  g.rect(x, y, 3, h, edge);
  g.rect(x + w - 3, y, 3, h, edge);
}

function drawTopBar(g){
  g.rect(
    0,
    0,
    g.W,
    66,
    "#090e20dd"
  );

  g.text(
    "🎓 学園絵文字マスター",
    20,
    23,
    22,
    COLORS.text,
    "left"
  );

  const phase =
    S.turn <= PRACTICE_TURNS
      ? "練習"
      : "本番";

  g.text(
    phase + " " + S.turn + " / " + TOTAL_TURNS,
    260,
    24,
    20,
    S.turn <= PRACTICE_TURNS
      ? COLORS.green
      : COLORS.gold
  );

  g.text(
    "❤️体力 " + S.hp,
    510,
    23,
    20,
    S.hp <= 15 ? COLORS.red : COLORS.text
  );

  g.text(
    "🛡️元気 " + S.energy,
    655,
    23,
    20,
    COLORS.blue
  );

  g.text(
    S.style === "sense"
      ? "😊センス型"
      : "💕ロジック型",
    824,
    23,
    19,
    S.style === "sense"
      ? COLORS.gold
      : COLORS.pink
  );

  g.text(
    "合計 " + totalParameter() + " / " + TARGET_TOTAL,
    20,
    50,
    16,
    totalParameter() >= TARGET_TOTAL
      ? COLORS.gold
      : COLORS.dim,
    "left"
  );
}

function drawParameters(g){
  const pop =
    S.paramPop > 0
      ? 1 + S.paramPop * 0.2
      : 1;

  for (let i = 0; i < PARAMS.length; i++){
    const param = PARAMS[i];
    const x = 76 + i * 292;
    const value = S.params[param.key];

    drawPanel(
      g,
      x,
      80,
      224,
      81,
      "#1b2540dd",
      param.color
    );

    g.emoji(
      param.icon,
      x + 36,
      116,
      35
    );

    g.text(
      param.name,
      x + 62,
      102,
      16,
      COLORS.dim,
      "left"
    );

    g.text(
      String(value),
      x + 65,
      132,
      31 * pop,
      param.color,
      "left"
    );

    g.text(
      value >= TARGET_MIN
        ? "足切りOK"
        : "最低 " + TARGET_MIN,
      x + 206,
      132,
      14,
      value >= TARGET_MIN
        ? COLORS.green
        : COLORS.red,
      "right"
    );
  }
}

function drawGoodStatus(g, x, y){
  const active = S.good > 0;

  drawPanel(
    g,
    x,
    y,
    178,
    55,
    active ? "#5c501f" : "#252a38",
    active ? COLORS.gold : "#555"
  );

  if (active){
    g.emoji("⭕", x + 28, y + 27, 37);
    g.emoji("⭐", x + 28, y + 27, 18);
  } else {
    g.emoji(
      "⭕",
      x + 28,
      y + 27,
      31,
      { alpha: 0.25 }
    );
  }

  g.text(
    "好調",
    x + 55,
    y + 17,
    16,
    active ? COLORS.gold : COLORS.dim,
    "left"
  );

  g.text(
    active
      ? "⭐".repeat(Math.min(S.good, 5))
      : "なし",
    x + 55,
    y + 38,
    15,
    active ? COLORS.gold : "#777",
    "left"
  );
}

function drawFocusStatus(g, x, y){
  const active = S.focus > 0;

  drawPanel(
    g,
    x,
    y,
    178,
    55,
    active ? "#173d5b" : "#252a38",
    active ? COLORS.blue : "#555"
  );

  const particles = Math.min(
    8,
    Math.max(1, S.focus)
  );

  for (let i = 0; i < particles; i++){
    const angle =
      g.time * 2.5 +
      i / particles * Math.PI * 2;

    g.emoji(
      "🔹",
      x + 28 + Math.cos(angle) * 15,
      y + 27 + Math.sin(angle) * 15,
      active ? 10 : 8,
      { alpha: active ? 1 : 0.18 }
    );
  }

  g.text(
    "集中",
    x + 55,
    y + 17,
    16,
    active ? COLORS.blue : COLORS.dim,
    "left"
  );

  g.text(
    active ? "蓄積 " + S.focus : "なし",
    x + 55,
    y + 38,
    15,
    active ? COLORS.blue : "#777",
    "left"
  );
}

function drawImpressionStatus(g, x, y){
  const active = S.impression > 0;

  drawPanel(
    g,
    x,
    y,
    178,
    55,
    active ? "#5d2947" : "#252a38",
    active ? COLORS.pink : "#555"
  );

  g.emoji(
    "💕",
    x + 28,
    y + 27,
    active ? 32 : 27,
    { alpha: active ? 1 : 0.2 }
  );

  g.text(
    "好印象",
    x + 55,
    y + 17,
    16,
    active ? COLORS.pink : COLORS.dim,
    "left"
  );

  g.text(
    active ? "蓄積 " + S.impression : "なし",
    x + 55,
    y + 38,
    15,
    active ? COLORS.pink : "#777",
    "left"
  );
}

function drawMotivationStatus(g, x, y){
  const active = S.motivation > 0;
  const flameSize =
    active
      ? 28 + Math.min(14, S.motivation)
      : 27;

  drawPanel(
    g,
    x,
    y,
    178,
    55,
    active ? "#5a2925" : "#252a38",
    active ? COLORS.red : "#555"
  );

  g.emoji(
    "🔥",
    x + 28,
    y + 29 + Math.sin(g.time * 7) * 2,
    flameSize,
    { alpha: active ? 1 : 0.2 }
  );

  g.text(
    "やる気",
    x + 55,
    y + 17,
    16,
    active ? COLORS.red : COLORS.dim,
    "left"
  );

  g.text(
    active ? "強さ " + S.motivation : "なし",
    x + 55,
    y + 38,
    15,
    active ? COLORS.red : "#777",
    "left"
  );
}

function drawStatuses(g){
  drawGoodStatus(g, 76, 174);
  drawFocusStatus(g, 262, 174);
  drawImpressionStatus(g, 448, 174);
  drawMotivationStatus(g, 634, 174);

  drawPanel(
    g,
    820,
    174,
    104,
    55,
    "#252a38",
    "#ffffff44"
  );

  g.text(
    "山札 " + S.drawPile.length,
    872,
    191,
    14,
    COLORS.text
  );

  g.text(
    "捨札 " + S.discard.length,
    872,
    214,
    14,
    COLORS.dim
  );
}

function drawCard(
  g,
  cardId,
  index,
  selectable
){
  const card = CARDS[cardId];
  const rect = cardRect(index);
  const affordable =
    selectable && canPay(card.cost);
  const y =
    selectable &&
    pointInRect(
      g,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    )
      ? rect.y - 8
      : rect.y;

  drawPanel(
    g,
    rect.x,
    y,
    rect.w,
    rect.h,
    cardColor(card),
    affordable || !selectable
      ? card.type === "sense"
        ? "#e4bd36"
        : card.type === "logic"
          ? "#ef85b2"
          : "#6fb8e5"
      : "#888"
  );

  g.text(
    String(index + 1),
    rect.x + 15,
    y + 16,
    14,
    "#777"
  );

  g.emoji(
    card.icon,
    rect.x + rect.w / 2,
    y + 46,
    43,
    {
      alpha:
        selectable && !affordable
          ? 0.45
          : 1,
    }
  );

  g.text(
    card.name,
    rect.x + rect.w / 2,
    y + 89,
    21,
    COLORS.darkText
  );

  g.text(
    "消費 " + card.cost,
    rect.x + rect.w / 2,
    y + 121,
    18,
    "#b14e55"
  );

  g.text(
    card.text,
    rect.x + rect.w / 2,
    y + 156,
    15,
    COLORS.darkText
  );

  g.text(
    card.type === "sense"
      ? "😊 センス"
      : card.type === "logic"
        ? "💕 ロジック"
        : "📘 共通",
    rect.x + rect.w / 2,
    y + 184,
    14,
    "#596174"
  );

  if (selectable && !affordable){
    g.text(
      "使用できない",
      rect.x + rect.w / 2,
      y + 101,
      19,
      COLORS.red
    );
  }
}

function drawPlay(g){
  drawTopBar(g);
  drawParameters(g);
  drawStatuses(g);

  for (let i = 0; i < S.hand.length; i++){
    drawCard(g, S.hand[i], i, true);
  }

  g.text(
    "使うカードを1枚選ぶ",
    480,
    252,
    19,
    COLORS.text
  );

  if (S.turn > PRACTICE_TURNS){
    const rect = redrawRect();
    const enabled = !S.redrawUsed;

    drawPanel(
      g,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      enabled ? "#285a77" : "#292d38",
      enabled ? COLORS.blue : "#555"
    );

    g.text(
      enabled
        ? "🔄 無料で引き直す"
        : "引き直し使用済み",
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
      15,
      enabled ? COLORS.text : "#777"
    );
  }

  g.text(
    "元気から先に消費し、足りない分を体力で払います",
    480,
    510,
    15,
    COLORS.dim
  );
}

function drawMilestone(g){
  drawTopBar(g);
  drawParameters(g);

  g.text(
    S.pendingMilestone === 4
      ? "🎪 本番直前のカード追加"
      : "📚 練習の節目",
    480,
    205,
    32,
    COLORS.gold
  );

  g.text(
    "デッキに加えるカードを1枚選ぶ",
    480,
    244,
    19,
    COLORS.text
  );

  for (let i = 0; i < S.offers.length; i++){
    drawCard(g, S.offers[i], i, false);
  }

  g.text(
    "選んだカードは次のターンから登場します",
    480,
    510,
    15,
    COLORS.dim
  );
}

function drawTitle(g){
  g.emoji(
    "🎓",
    480,
    87,
    78
  );

  g.text(
    "学園絵文字マスター",
    480,
    151,
    42,
    COLORS.text
  );

  g.text(
    "先に溜めるか、着実に積むか",
    480,
    190,
    21,
    COLORS.gold
  );

  g.text(
    "クリック / タップ またはスペースで開始",
    480,
    432,
    22,
    COLORS.text
  );

  g.text(
    "8ターンで合計90・3つすべて15以上を目指そう",
    480,
    474,
    18,
    COLORS.dim
  );
}

function drawStyleSelect(g){
  g.text(
    "育て方を選ぼう",
    480,
    86,
    38,
    COLORS.text
  );

  g.text(
    "選んだ型を中心にしたデッキで8ターン挑戦",
    480,
    132,
    20,
    COLORS.dim
  );

  const sense = styleRect(0);
  const logic = styleRect(1);

  drawPanel(
    g,
    sense.x,
    sense.y,
    sense.w,
    sense.h,
    "#514820",
    COLORS.gold
  );

  g.emoji(
    "😊🌟",
    sense.x + sense.w / 2,
    sense.y + 51,
    51
  );

  g.text(
    "センス型",
    sense.x + sense.w / 2,
    sense.y + 101,
    28,
    COLORS.gold
  );

  g.text(
    "好調と集中を溜める",
    sense.x + sense.w / 2,
    sense.y + 139,
    18,
    COLORS.text
  );

  g.text(
    "決め時を選んで一気に伸ばす",
    sense.x + sense.w / 2,
    sense.y + 170,
    16,
    COLORS.dim
  );

  drawPanel(
    g,
    logic.x,
    logic.y,
    logic.w,
    logic.h,
    "#512b42",
    COLORS.pink
  );

  g.emoji(
    "💕🔥",
    logic.x + logic.w / 2,
    logic.y + 51,
    51
  );

  g.text(
    "ロジック型",
    logic.x + logic.w / 2,
    logic.y + 101,
    28,
    COLORS.pink
  );

  g.text(
    "好印象とやる気を育てる",
    logic.x + logic.w / 2,
    logic.y + 139,
    18,
    COLORS.text
  );

  g.text(
    "低い力を補いながら着実に伸ばす",
    logic.x + logic.w / 2,
    logic.y + 170,
    16,
    COLORS.dim
  );

  g.text(
    "← センス型　　クリック / タップ　　ロジック型 →",
    480,
    463,
    19,
    COLORS.text
  );
}

function drawResult(g){
  const clear = S.result === "合格";

  g.emoji(
    clear ? "🎓" : "📝",
    480,
    65,
    64
  );

  g.text(
    clear ? "合格!" : "もう一歩",
    480,
    119,
    42,
    clear ? COLORS.gold : COLORS.text
  );

  drawPanel(
    g,
    184,
    154,
    592,
    263,
    "#202943dd",
    clear ? COLORS.gold : "#ffffff44"
  );

  g.text(
    "合計 " + totalParameter() + " / " + TARGET_TOTAL,
    480,
    195,
    34,
    totalParameter() >= TARGET_TOTAL
      ? COLORS.gold
      : COLORS.text
  );

  for (let i = 0; i < PARAMS.length; i++){
    const param = PARAMS[i];
    const value = S.params[param.key];
    const y = 249 + i * 49;

    g.text(
      param.icon + " " + param.name,
      275,
      y,
      22,
      param.color,
      "left"
    );

    g.text(
      value + " / 最低" + TARGET_MIN,
      673,
      y,
      22,
      value >= TARGET_MIN
        ? COLORS.green
        : COLORS.red,
      "right"
    );
  }

  g.text(
    clear
      ? "3つの力をそろえてノルマ達成!"
      : totalParameter() < TARGET_TOTAL
        ? "合計90を目指そう"
        : "3つすべてを15以上にしよう",
    480,
    392,
    19,
    clear ? COLORS.gold : COLORS.dim
  );

  g.text(
    "クリック / タップ またはスペースでもう一度",
    480,
    474,
    21,
    COLORS.text
  );
}

function drawHearts(g){
  for (const heart of S.hearts){
    const progress =
      1 - heart.t / heart.maxT;
    const targetX =
      heart.key === "vocal"
        ? 188
        : heart.key === "rhythm"
          ? 480
          : 772;

    const x =
      480 + (targetX - 480) * progress;
    const y =
      510 + (130 - 510) * progress;

    g.emoji(
      "💕",
      x,
      y,
      27 + Math.sin(progress * Math.PI) * 12,
      { alpha: g.clamp(heart.t * 2, 0, 1) }
    );
  }
}

function drawFloaters(g, ox, oy){
  for (const floater of S.floaters){
    const progress =
      1 - floater.t / floater.maxT;
    const pop =
      progress < 0.25
        ? 1 + Math.sin(
          progress / 0.25 * Math.PI
        ) * 0.3
        : 1;

    g.text(
      floater.text,
      floater.x + ox,
      floater.y + oy,
      floater.size * pop,
      floater.color
    );
  }
}

function drawConfetti(g){
  for (const particle of S.confetti){
    g.rect(
      particle.x,
      particle.y,
      8,
      5,
      particle.color
    );
  }

  for (const star of S.stars){
    g.emoji(
      "⭐",
      star.x,
      star.y,
      star.size,
      {
        rot: star.t * 5,
        alpha: g.clamp(star.t * 2, 0, 1),
      }
    );
  }
}

/* ---------- エンジンへの登録 ---------- */

EmojiEngine.register({
  id: "gakuen",
  name: "学園絵文字マスター",
  icon: "🎓",
  desc: "8ターンで選び切る、二択の育成デッキビルド",

  init(){
    reset();
    this._state = S;
  },

  update(g, dt){
    updateEffects(dt);

    if (S.freeze > 0){
      S.freeze = Math.max(
        0,
        S.freeze - dt
      );
      return;
    }

    if (S.scene === "title"){
      if (
        g.pressed("action") ||
        g.pointer.justDown
      ){
        S.scene = "style";
        g.se("click");
      }

      return;
    }

    if (S.scene === "style"){
      updateStyleSelect(g);
      this._state = S;
      return;
    }

    if (S.scene === "play"){
      updateCardChoice(g, false);
      this._state = S;
      return;
    }

    if (S.scene === "milestone"){
      updateCardChoice(g, true);
      this._state = S;
      return;
    }

    if (S.scene === "over"){
      if (
        g.pressed("action") ||
        g.pointer.justDown
      ){
        reset();
        S.scene = "style";
        this._state = S;
        g.se("click");
      }
    }
  },

  draw(g){
    g.bg(COLORS.background);

    const shakePower =
      S.shake > 0
        ? 8 * S.shake / 0.38
        : 0;

    const ox =
      shakePower > 0
        ? g.rand(-shakePower, shakePower)
        : 0;

    const oy =
      shakePower > 0
        ? g.rand(-shakePower, shakePower)
        : 0;

    for (let x = 20; x < g.W; x += 70){
      g.emoji(
        S.scene === "play" &&
        S.turn > PRACTICE_TURNS
          ? "✨"
          : "📚",
        x,
        520 + Math.sin(
          g.time * 1.8 + x * 0.03
        ) * 3,
        22,
        { alpha: 0.1 }
      );
    }

    if (S.scene === "title"){
      drawTitle(g);
    } else if (S.scene === "style"){
      drawStyleSelect(g);
    } else if (S.scene === "play"){
      drawPlay(g);
    } else if (S.scene === "milestone"){
      drawMilestone(g);
    } else if (S.scene === "over"){
      drawResult(g);
    }

    drawHearts(g);
    drawFloaters(g, ox, oy);
    drawConfetti(g);

    if (S.hp <= 15 && S.scene === "play"){
      g.rect(0, 0, g.W, 10, "#ff454577");
      g.rect(
        0,
        g.H - 10,
        g.W,
        10,
        "#ff454577"
      );
      g.rect(0, 0, 10, g.H, "#ff454544");
      g.rect(
        g.W - 10,
        0,
        10,
        g.H,
        "#ff454544"
      );
    }

    if (S.flash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#ffffff44"
      );
    }

    g.text(
      "rev1",
      g.W - 8,
      14,
      12,
      "#ffffff77",
      "right"
    );
  },
});
})();
