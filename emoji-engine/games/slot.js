/* =====================================================
   絵文字スロット
   シンボルを絞り込み、6回の家賃を乗り越える
===================================================== */
(function(){
"use strict";

/* ---------- ゲーム設定 ---------- */

const SYMBOLS = [
  "🪙",
  "🍒",
  "🌸",
  "🐝",
  "🐱",
  "🥛",
  "⭐",
  "🌙",
];

const SYMBOL_NAMES = {
  "🪙": "コイン",
  "🍒": "サクランボ",
  "🌸": "花",
  "🐝": "ハチ",
  "🐱": "ネコ",
  "🥛": "ミルク",
  "⭐": "星",
  "🌙": "月",
};

const BASE_PAYOUT = {
  "🪙": 2,
  "🍒": 1,
  "🌸": 1,
  "🐝": 1,
  "🐱": 1,
  "🥛": 1,
  "⭐": 1,
  "🌙": 1,
};

const SYNERGY_PAYOUT = {
  cherry: 3,
  flowerBee: 4,
  catMilk: 5,
  starMoon: 4,
};

const RENT_VALUES = [
  35,
  55,
  80,
  110,
  145,
  185,
];

const START_POOL_SIZE = 10;
const START_CHERRY_COUNT = 2;
const POOL_LIMIT = 15;
const GRID_SIZE = 9;
const GRID_COLUMNS = 3;
const OFFER_COUNT = 3;
const TOTAL_SPINS = 18;
const RENT_INTERVAL = 3;
const CHOICE_TIME = 5;
const SPIN_TIME = 0.72;
const SPIN_CHANGE_TIME = 0.07;
const PAYOUT_TIME = 0.72;
const SYNERGY_LINE_TIME = 0.48;
const SYNERGY_DELAY = 0.07;
const RENT_RESULT_TIME = 0.75;
const RENT_FLASH_TIME = 0.5;
const FREEZE_NORMAL = 3 / 60;
const FREEZE_COMBO = 4 / 60;
const SHAKE_TIME = 0.28;
const FLASH_TIME = 0.22;
const RENT_WEIGHT = 1.55;

const BOARD_X = 308;
const BOARD_Y = 103;
const CELL_SIZE = 112;
const CELL_GAP = 8;

const SPIN_BUTTON_X = 708;
const SPIN_BUTTON_Y = 405;
const SPIN_BUTTON_W = 188;
const SPIN_BUTTON_H = 76;

const OFFER_Y = 246;
const OFFER_W = 184;
const OFFER_H = 176;
const OFFER_GAP = 18;
const OFFER_SKIP_W = 184;
const OFFER_SKIP_H = 58;

const POOL_CELL_W = 70;
const POOL_CELL_H = 58;
const POOL_CELL_GAP = 8;
const POOL_COLUMNS = 8;

const COLORS = {
  background: "#151326",
  panel: "#24203b",
  panelLight: "#342e50",
  board: "#0f1020",
  cell: "#fff8df",
  cellEdge: "#dabf72",
  gold: "#ffe06b",
  green: "#89efae",
  red: "#ff6969",
  blue: "#8de8ff",
  purple: "#ddb1ff",
  text: "#ffffff",
  dim: "#aaa7ba",
};

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
    size: size || 24,
    t: life === undefined ? 0.9 : life,
  });
}

function updateEffects(dt){
  for (const floater of S.floaters){
    floater.y -= 34 * dt;
    floater.t -= dt;
  }

  S.floaters = S.floaters.filter(
    floater => floater.t > 0
  );

  for (const particle of S.confetti){
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 160 * dt;
    particle.rot += particle.vr * dt;
    particle.t -= dt;
  }

  S.confetti = S.confetti.filter(
    particle => particle.t > 0
  );

  for (const line of S.lines){
    line.t -= dt;
  }

  S.lines = S.lines.filter(
    line => line.t > 0
  );

  S.shake = Math.max(0, S.shake - dt);
  S.flash = Math.max(0, S.flash - dt);
  S.redFlash = Math.max(0, S.redFlash - dt);
  S.rentFlash = Math.max(0, S.rentFlash - dt);
  S.comboPop = Math.max(0, S.comboPop - dt);
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

function countInPool(symbol){
  let count = 0;

  for (const item of S.pool){
    if (item === symbol){
      count++;
    }
  }

  return count;
}

function partnerOf(symbol){
  if (symbol === "🌸"){
    return "🐝";
  }

  if (symbol === "🐝"){
    return "🌸";
  }

  if (symbol === "🐱"){
    return "🥛";
  }

  if (symbol === "🥛"){
    return "🐱";
  }

  if (symbol === "⭐"){
    return "🌙";
  }

  if (symbol === "🌙"){
    return "⭐";
  }

  if (symbol === "🍒"){
    return "🍒";
  }

  return null;
}

function hasSynergyInPool(symbol){
  const partner = partnerOf(symbol);

  if (!partner){
    return false;
  }

  if (symbol === "🍒"){
    return countInPool("🍒") >= 1;
  }

  return countInPool(partner) > 0;
}

function isPair(a, b){
  if (a === "🍒" && b === "🍒"){
    return {
      type: "cherry",
      bonus: SYNERGY_PAYOUT.cherry,
    };
  }

  if (
    (a === "🌸" && b === "🐝") ||
    (a === "🐝" && b === "🌸")
  ){
    return {
      type: "flowerBee",
      bonus: SYNERGY_PAYOUT.flowerBee,
    };
  }

  if (
    (a === "🐱" && b === "🥛") ||
    (a === "🥛" && b === "🐱")
  ){
    return {
      type: "catMilk",
      bonus: SYNERGY_PAYOUT.catMilk,
    };
  }

  if (
    (a === "⭐" && b === "🌙") ||
    (a === "🌙" && b === "⭐")
  ){
    return {
      type: "starMoon",
      bonus: SYNERGY_PAYOUT.starMoon,
    };
  }

  return null;
}

function cellCenter(index){
  const column = index % GRID_COLUMNS;
  const row = Math.floor(index / GRID_COLUMNS);

  return {
    x:
      BOARD_X +
      column * (CELL_SIZE + CELL_GAP) +
      CELL_SIZE / 2,
    y:
      BOARD_Y +
      row * (CELL_SIZE + CELL_GAP) +
      CELL_SIZE / 2,
  };
}

function poolCellRect(index){
  const column = index % POOL_COLUMNS;
  const row = Math.floor(index / POOL_COLUMNS);
  const totalWidth =
    POOL_COLUMNS * POOL_CELL_W +
    (POOL_COLUMNS - 1) * POOL_CELL_GAP;
  const left = (960 - totalWidth) / 2;

  return {
    x:
      left +
      column * (POOL_CELL_W + POOL_CELL_GAP),
    y:
      252 +
      row * (POOL_CELL_H + POOL_CELL_GAP),
    w: POOL_CELL_W,
    h: POOL_CELL_H,
  };
}

function offerRect(index){
  const totalWidth =
    OFFER_COUNT * OFFER_W +
    (OFFER_COUNT - 1) * OFFER_GAP;
  const left = (960 - totalWidth) / 2;

  return {
    x: left + index * (OFFER_W + OFFER_GAP),
    y: OFFER_Y,
    w: OFFER_W,
    h: OFFER_H,
  };
}

function skipRect(){
  return {
    x: (960 - OFFER_SKIP_W) / 2,
    y: 446,
    w: OFFER_SKIP_W,
    h: OFFER_SKIP_H,
  };
}

function startConfetti(g){
  const colors = [
    "#ff6b6b",
    "#ffe66d",
    "#7ee7ff",
    "#81e8a2",
    "#d99cff",
  ];

  for (let i = 0; i < 48; i++){
    S.confetti.push({
      x: g.rand(170, 790),
      y: g.rand(70, 190),
      vx: g.rand(-105, 105),
      vy: g.rand(-230, -75),
      rot: g.rand(0, 6.28),
      vr: g.rand(-9, 9),
      color: g.pick(colors),
      t: g.rand(1.1, 1.9),
    });
  }
}

/* ---------- ゲームの準備 ---------- */

function makeStartPool(g){
  const pool = [];

  for (let i = 0; i < START_CHERRY_COUNT; i++){
    pool.push("🍒");
  }

  const starters = [
    "🪙",
    "🪙",
    "🌸",
    "🐝",
    "🐱",
    "🥛",
    "⭐",
    "🌙",
  ];

  while (pool.length < START_POOL_SIZE){
    pool.push(starters[pool.length - START_CHERRY_COUNT]);
  }

  return shuffle(g, pool);
}

function reset(g){
  S = {
    scene: "title",
    pool: makeStartPool(g),
    grid: new Array(GRID_SIZE).fill("🪙"),
    offers: [],

    coins: 0,
    spin: 0,
    rentIndex: 0,
    lastRent: 0,
    shortage: 0,
    lastBase: 0,
    lastBonus: 0,
    lastPayout: 0,

    spinTimer: 0,
    spinChangeTimer: 0,
    payoutTimer: 0,
    choiceTimer: CHOICE_TIME,
    rentTimer: 0,

    pendingSymbol: null,
    synergies: [],
    scheduledLines: [],
    activeTypes: [],

    floaters: [],
    confetti: [],
    lines: [],
    freeze: 0,
    shake: 0,
    flash: 0,
    redFlash: 0,
    rentFlash: 0,
    comboPop: 0,

    result: "",
  };
}

function startGame(g){
  S.scene = "ready";
  S.pool = makeStartPool(g);
  S.grid = new Array(GRID_SIZE).fill("🪙");
  S.offers = [];

  S.coins = 0;
  S.spin = 0;
  S.rentIndex = 0;
  S.lastRent = 0;
  S.shortage = 0;
  S.lastBase = 0;
  S.lastBonus = 0;
  S.lastPayout = 0;

  S.spinTimer = 0;
  S.spinChangeTimer = 0;
  S.payoutTimer = 0;
  S.choiceTimer = CHOICE_TIME;
  S.rentTimer = 0;

  S.pendingSymbol = null;
  S.synergies = [];
  S.scheduledLines = [];
  S.activeTypes = [];

  S.floaters = [];
  S.confetti = [];
  S.lines = [];
  S.freeze = 0;
  S.shake = 0;
  S.flash = 0;
  S.redFlash = 0;
  S.rentFlash = 0;
  S.comboPop = 0;

  S.result = "";
  g.se("click");
}

/* ---------- リール抽選 ---------- */

function rentSpinIsDue(){
  return (
    (S.spin + 1) % RENT_INTERVAL === 0
  );
}

function weightedSymbol(g){
  if (!rentSpinIsDue()){
    return g.pick(S.pool);
  }

  const weighted = [];

  for (const symbol of S.pool){
    weighted.push(symbol);

    if (hasSynergyInPool(symbol)){
      const extraChance = RENT_WEIGHT - 1;

      if (g.rand(0, 1) < extraChance){
        weighted.push(symbol);
      }
    }
  }

  return g.pick(weighted);
}

function randomGrid(g){
  const result = [];

  for (let i = 0; i < GRID_SIZE; i++){
    result.push(weightedSymbol(g));
  }

  return result;
}

function startSpin(g){
  if (S.scene !== "ready"){
    return;
  }

  S.scene = "spinning";
  S.spinTimer = SPIN_TIME;
  S.spinChangeTimer = 0;
  S.synergies = [];
  S.scheduledLines = [];
  S.lines = [];
  S.activeTypes = [];
  S.lastBase = 0;
  S.lastBonus = 0;
  S.lastPayout = 0;
  g.se("bounce");
}

function findSynergies(){
  const pairs = [];

  for (let index = 0; index < GRID_SIZE; index++){
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);

    if (column + 1 < GRID_COLUMNS){
      const right = index + 1;
      const pair = isPair(
        S.grid[index],
        S.grid[right]
      );

      if (pair){
        pairs.push({
          a: index,
          b: right,
          type: pair.type,
          bonus: pair.bonus,
        });
      }
    }

    if (row + 1 < GRID_COLUMNS){
      const below = index + GRID_COLUMNS;
      const pair = isPair(
        S.grid[index],
        S.grid[below]
      );

      if (pair){
        pairs.push({
          a: index,
          b: below,
          type: pair.type,
          bonus: pair.bonus,
        });
      }
    }
  }

  return pairs;
}

function resolveSpin(g){
  S.spin++;
  S.synergies = findSynergies();

  let base = 0;
  let bonus = 0;

  for (const symbol of S.grid){
    base += BASE_PAYOUT[symbol];
  }

  for (const pair of S.synergies){
    bonus += pair.bonus;
  }

  S.lastBase = base;
  S.lastBonus = bonus;
  S.lastPayout = base + bonus;
  S.coins += S.lastPayout;
  S.payoutTimer = PAYOUT_TIME;
  S.scene = "payout";

  S.scheduledLines = S.synergies.map(
    (pair, index) => ({
      pair: pair,
      delay: index * SYNERGY_DELAY,
      shown: false,
    })
  );

  const typeMap = {};

  for (const pair of S.synergies){
    typeMap[pair.type] = true;
  }

  S.activeTypes = Object.keys(typeMap);

  addFloater(
    754,
    143,
    "+" + S.lastPayout,
    COLORS.gold,
    34,
    1.05
  );

  if (S.lastPayout > base * 1.5){
    S.comboPop = 0.7;
    S.freeze = FREEZE_COMBO;
    S.shake = SHAKE_TIME;
    g.se("clear");
  } else if (S.synergies.length > 0){
    S.freeze = FREEZE_NORMAL;
    g.se("coin");
  } else {
    g.se("click");
  }

  if (S.activeTypes.length >= 3){
    S.flash = FLASH_TIME;
    S.shake = SHAKE_TIME;
    startConfetti(g);
    g.se("clear");
  }
}

function updateScheduledLines(g, dt){
  for (const item of S.scheduledLines){
    if (item.shown){
      continue;
    }

    item.delay -= dt;

    if (item.delay <= 0){
      item.shown = true;
      S.lines.push({
        a: item.pair.a,
        b: item.pair.b,
        bonus: item.pair.bonus,
        t: SYNERGY_LINE_TIME,
      });

      const first = cellCenter(item.pair.a);
      const second = cellCenter(item.pair.b);

      addFloater(
        (first.x + second.x) / 2,
        (first.y + second.y) / 2,
        "+" + item.pair.bonus,
        COLORS.gold,
        27,
        0.7
      );
    }
  }
}

/* ---------- 3択とプール整理 ---------- */

function makeOffers(g){
  const synergyCandidates = SYMBOLS.filter(
    symbol => hasSynergyInPool(symbol)
  );

  const first =
    synergyCandidates.length > 0
      ? g.pick(synergyCandidates)
      : g.pick(SYMBOLS);

  const offers = [first];
  const remaining = shuffle(
    g,
    SYMBOLS.filter(symbol =>
      symbol !== first
    )
  );

  while (
    offers.length < OFFER_COUNT &&
    remaining.length > 0
  ){
    offers.push(remaining.shift());
  }

  return shuffle(g, offers);
}

function beginChoice(g){
  S.offers = makeOffers(g);
  S.choiceTimer = CHOICE_TIME;
  S.scene = "choice";
  g.se("ping");
}

function finishChoice(g){
  S.offers = [];
  S.pendingSymbol = null;
  S.scene = "ready";
  g.se("click");
}

function chooseOffer(g, index){
  if (
    index < 0 ||
    index >= S.offers.length
  ){
    return;
  }

  const symbol = S.offers[index];

  if (S.pool.length < POOL_LIMIT){
    S.pool.push(symbol);
    addFloater(
      480,
      205,
      symbol + " を追加",
      COLORS.green,
      27,
      0.9
    );
    finishChoice(g);
    g.se("coin");
    return;
  }

  S.pendingSymbol = symbol;
  S.offers = [];
  S.scene = "replace";
  g.se("click");
}

function skipOffer(g){
  addFloater(
    480,
    205,
    "何も取らない",
    COLORS.dim,
    24,
    0.8
  );
  finishChoice(g);
}

function replacePoolSymbol(g, index){
  if (
    index < 0 ||
    index >= S.pool.length ||
    !S.pendingSymbol
  ){
    return;
  }

  const removed = S.pool[index];
  S.pool[index] = S.pendingSymbol;

  addFloater(
    480,
    205,
    removed + " → " + S.pendingSymbol,
    COLORS.blue,
    27,
    1
  );

  finishChoice(g);
  g.se("coin");
}

function deletePoolSymbol(g, index){
  if (
    index < 0 ||
    index >= S.pool.length
  ){
    return;
  }

  const removed = S.pool[index];
  S.pool.splice(index, 1);

  addFloater(
    480,
    205,
    removed + " を削除",
    COLORS.purple,
    27,
    0.9
  );

  S.scene = "ready";
  g.se("bounce");
}

/* ---------- 家賃 ---------- */

function rentIsDue(){
  return (
    S.spin > 0 &&
    S.spin % RENT_INTERVAL === 0
  );
}

function startRent(g){
  const rent = RENT_VALUES[S.rentIndex];

  S.lastRent = rent;
  S.rentTimer = RENT_RESULT_TIME;

  if (S.coins < rent){
    S.shortage = rent - S.coins;
    S.result = "lose";
    S.scene = "rentFail";
    S.redFlash = RENT_FLASH_TIME;
    S.shake = SHAKE_TIME;
    g.se("boom");
    return;
  }

  S.coins -= rent;
  S.rentIndex++;
  S.scene = "rentPaid";
  S.rentFlash = RENT_FLASH_TIME;
  S.freeze = FREEZE_COMBO;
  startConfetti(g);

  addFloater(
    480,
    205,
    "家賃 " + rent + " 支払い！",
    COLORS.gold,
    34,
    1.1
  );

  g.se("clear");
}

function finishRentSuccess(g){
  if (S.spin >= TOTAL_SPINS){
    S.result = "win";
    S.scene = "over";
    startConfetti(g);
    g.se("clear");
    return;
  }

  S.scene = "delete";
  g.se("ping");
}

/* ---------- 更新 ---------- */

function updateSpinning(g, dt){
  S.spinTimer -= dt;
  S.spinChangeTimer -= dt;

  if (S.spinChangeTimer <= 0){
    S.grid = randomGrid(g);
    S.spinChangeTimer = SPIN_CHANGE_TIME;
    g.se("click");
  }

  if (S.spinTimer <= 0){
    S.grid = randomGrid(g);
    resolveSpin(g);
  }
}

function updatePayout(g, dt){
  updateScheduledLines(g, dt);
  S.payoutTimer -= dt;

  if (S.payoutTimer > 0){
    return;
  }

  if (rentIsDue()){
    startRent(g);
    return;
  }

  beginChoice(g);
}

function updateChoice(g, dt){
  S.choiceTimer -= dt;

  if (g.pointer.justDown){
    for (let i = 0; i < S.offers.length; i++){
      const rect = offerRect(i);

      if (pointInRect(
        g,
        rect.x,
        rect.y,
        rect.w,
        rect.h
      )){
        chooseOffer(g, i);
        return;
      }
    }

    const skip = skipRect();

    if (pointInRect(
      g,
      skip.x,
      skip.y,
      skip.w,
      skip.h
    )){
      skipOffer(g);
      return;
    }
  }

  if (S.choiceTimer <= 0){
    skipOffer(g);
  }
}

function poolIndexAtPointer(g){
  for (let i = 0; i < S.pool.length; i++){
    const rect = poolCellRect(i);

    if (pointInRect(
      g,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    )){
      return i;
    }
  }

  return -1;
}

function updatePoolSelection(g){
  if (!g.pointer.justDown){
    return;
  }

  const index = poolIndexAtPointer(g);

  if (index < 0){
    return;
  }

  if (S.scene === "replace"){
    replacePoolSymbol(g, index);
    return;
  }

  if (S.scene === "delete"){
    deletePoolSymbol(g, index);
  }
}

function updateRent(g, dt){
  S.rentTimer -= dt;

  if (S.rentTimer > 0){
    return;
  }

  if (S.scene === "rentFail"){
    S.scene = "over";
    return;
  }

  finishRentSuccess(g);
}

/* ---------- 描画の部品 ---------- */

function drawPanel(g, x, y, w, h, color){
  g.rect(
    x + 5,
    y + 6,
    w,
    h,
    "rgba(0,0,0,0.25)"
  );
  g.rect(
    x,
    y,
    w,
    h,
    color || COLORS.panel
  );
}

function drawTopBar(g){
  g.text(
    "絵文字スロット",
    28,
    28,
    25,
    COLORS.text,
    "left"
  );

  g.text(
    "rev1",
    g.W - 18,
    20,
    14,
    COLORS.dim,
    "right"
  );

  g.text(
    "所持 " + S.coins,
    742,
    49,
    25,
    COLORS.gold
  );

  const nextRent =
    S.rentIndex < RENT_VALUES.length
      ? RENT_VALUES[S.rentIndex]
      : "-";

  g.text(
    "次の家賃 " + nextRent,
    855,
    49,
    19,
    COLORS.text
  );

  g.text(
    "スピン " + S.spin + " / " + TOTAL_SPINS,
    143,
    62,
    18,
    COLORS.blue
  );

  g.text(
    "プール " + S.pool.length + " / " + POOL_LIMIT,
    143,
    88,
    17,
    COLORS.dim
  );
}

function synergyScaleForCell(index){
  let active = false;

  for (const line of S.lines){
    if (
      line.a === index ||
      line.b === index
    ){
      active = true;
      break;
    }
  }

  if (!active){
    return 1;
  }

  return 1.08 + Math.sin(gTimeSafe() * 25) * 0.04;
}

function gTimeSafe(){
  return typeof S.drawTime === "number"
    ? S.drawTime
    : 0;
}

function drawBoard(g, ox, oy){
  drawPanel(
    g,
    BOARD_X - 16 + ox,
    BOARD_Y - 16 + oy,
    CELL_SIZE * GRID_COLUMNS +
      CELL_GAP * (GRID_COLUMNS - 1) +
      32,
    CELL_SIZE * GRID_COLUMNS +
      CELL_GAP * (GRID_COLUMNS - 1) +
      32,
    COLORS.board
  );

  for (let i = 0; i < GRID_SIZE; i++){
    const center = cellCenter(i);
    const x = center.x - CELL_SIZE / 2 + ox;
    const y = center.y - CELL_SIZE / 2 + oy;

    g.rect(
      x,
      y,
      CELL_SIZE,
      CELL_SIZE,
      COLORS.cellEdge
    );

    g.rect(
      x + 4,
      y + 4,
      CELL_SIZE - 8,
      CELL_SIZE - 8,
      COLORS.cell
    );

    const scale = synergyScaleForCell(i);

    g.emoji(
      S.grid[i],
      center.x + ox,
      center.y + oy,
      64 * scale
    );

    g.text(
      "+" + BASE_PAYOUT[S.grid[i]],
      x + CELL_SIZE - 10,
      y + CELL_SIZE - 13,
      15,
      "#735f2b",
      "right"
    );
  }
}

function drawSynergyLines(g, ox, oy){
  for (const line of S.lines){
    const first = cellCenter(line.a);
    const second = cellCenter(line.b);
    const alpha = g.clamp(
      line.t / SYNERGY_LINE_TIME,
      0,
      1
    );
    const color =
      alpha > 0.5
        ? "#fff7a5"
        : "#ffd349";

    if (first.y === second.y){
      const left = Math.min(first.x, second.x);
      const width = Math.abs(first.x - second.x);

      g.rect(
        left + ox,
        first.y - 5 + oy,
        width,
        10,
        color
      );
      g.rect(
        left + ox,
        first.y - 2 + oy,
        width,
        4,
        "#ffffff"
      );
    } else {
      const top = Math.min(first.y, second.y);
      const height = Math.abs(first.y - second.y);

      g.rect(
        first.x - 5 + ox,
        top + oy,
        10,
        height,
        color
      );
      g.rect(
        first.x - 2 + ox,
        top + oy,
        4,
        height,
        "#ffffff"
      );
    }
  }
}

function drawPoolStrip(g){
  drawPanel(g, 24, 445, 646, 76, COLORS.panel);

  g.text(
    "所持プール",
    42,
    460,
    15,
    COLORS.dim,
    "left"
  );

  const width = 39;
  const gap = 2;
  const left = 42;

  for (let i = 0; i < S.pool.length; i++){
    const x = left + i * (width + gap);

    g.rect(
      x,
      476,
      width,
      35,
      "#413a5d"
    );

    g.emoji(
      S.pool[i],
      x + width / 2,
      493,
      27
    );
  }
}

function drawSideInfo(g){
  drawPanel(g, 688, 102, 248, 278, COLORS.panel);

  g.text(
    "今回の配当",
    812,
    130,
    18,
    COLORS.dim
  );

  g.text(
    "+" + S.lastPayout,
    812,
    169,
    42,
    COLORS.gold
  );

  g.text(
    "基礎 " + S.lastBase,
    733,
    207,
    18,
    COLORS.text,
    "left"
  );

  g.text(
    "隣接 +" + S.lastBonus,
    733,
    235,
    18,
    COLORS.green,
    "left"
  );

  g.text(
    "上下左右だけが隣接",
    812,
    280,
    17,
    COLORS.blue
  );

  g.text(
    "斜めはつながらない",
    812,
    307,
    16,
    COLORS.dim
  );

  if (S.spin > 0){
    const nextRentSpin =
      Math.min(
        TOTAL_SPINS,
        (S.rentIndex + 1) * RENT_INTERVAL
      );

    g.text(
      "家賃まで " +
        Math.max(0, nextRentSpin - S.spin) +
        " スピン",
      812,
      347,
      18,
      COLORS.text
    );
  }
}

function drawSpinButton(g){
  const enabled = S.scene === "ready";
  const color = enabled
    ? "#d84b86"
    : "#5c526a";

  g.rect(
    SPIN_BUTTON_X,
    SPIN_BUTTON_Y,
    SPIN_BUTTON_W,
    SPIN_BUTTON_H,
    "#351c38"
  );

  g.rect(
    SPIN_BUTTON_X + 5,
    SPIN_BUTTON_Y + 5,
    SPIN_BUTTON_W - 10,
    SPIN_BUTTON_H - 10,
    color
  );

  g.text(
    S.scene === "spinning"
      ? "回転中…"
      : "🎰 回す",
    SPIN_BUTTON_X + SPIN_BUTTON_W / 2,
    SPIN_BUTTON_Y + SPIN_BUTTON_H / 2,
    27,
    COLORS.text
  );

  g.text(
    "クリック / スペース",
    SPIN_BUTTON_X + SPIN_BUTTON_W / 2,
    507,
    15,
    COLORS.dim
  );
}

function drawMiniAdjacency(g, symbol, x, y){
  g.emoji(symbol, x, y, 30);

  g.rect(x - 4, y - 40, 8, 17, COLORS.gold);
  g.rect(x - 4, y + 23, 8, 17, COLORS.gold);
  g.rect(x - 40, y - 4, 17, 8, COLORS.gold);
  g.rect(x + 23, y - 4, 17, 8, COLORS.gold);
}

function drawOfferCard(g, symbol, index){
  const rect = offerRect(index);
  const partner = partnerOf(symbol);

  drawPanel(
    g,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    COLORS.panelLight
  );

  drawMiniAdjacency(
    g,
    symbol,
    rect.x + rect.w / 2,
    rect.y + 60
  );

  g.text(
    SYMBOL_NAMES[symbol],
    rect.x + rect.w / 2,
    rect.y + 111,
    20,
    COLORS.text
  );

  if (partner){
    g.text(
      symbol === "🍒"
        ? "🍒と隣接で +" +
          SYNERGY_PAYOUT.cherry
        : partner +
          "と隣接で +" +
          synergyForSymbol(symbol),
      rect.x + rect.w / 2,
      rect.y + 142,
      16,
      COLORS.gold
    );
  } else {
    g.text(
      "基礎配当 " + BASE_PAYOUT[symbol],
      rect.x + rect.w / 2,
      rect.y + 142,
      16,
      COLORS.blue
    );
  }
}

function synergyForSymbol(symbol){
  if (
    symbol === "🌸" ||
    symbol === "🐝"
  ){
    return SYNERGY_PAYOUT.flowerBee;
  }

  if (
    symbol === "🐱" ||
    symbol === "🥛"
  ){
    return SYNERGY_PAYOUT.catMilk;
  }

  if (
    symbol === "⭐" ||
    symbol === "🌙"
  ){
    return SYNERGY_PAYOUT.starMoon;
  }

  return SYNERGY_PAYOUT.cherry;
}

function drawChoice(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "rgba(10,8,20,0.82)"
  );

  g.text(
    "1つ追加する？",
    g.W / 2,
    72,
    35,
    COLORS.text
  );

  g.text(
    "拾うほど狙いは薄くなる",
    g.W / 2,
    110,
    19,
    COLORS.dim
  );

  const ratio = g.clamp(
    S.choiceTimer / CHOICE_TIME,
    0,
    1
  );

  g.rect(270, 146, 420, 14, "#453c5c");
  g.rect(
    270,
    146,
    420 * ratio,
    14,
    ratio < 0.3 ? COLORS.red : COLORS.green
  );

  g.text(
    Math.max(0, S.choiceTimer).toFixed(1) +
      "秒",
    g.W / 2,
    183,
    20,
    COLORS.text
  );

  for (let i = 0; i < S.offers.length; i++){
    drawOfferCard(g, S.offers[i], i);
  }

  const skip = skipRect();

  g.rect(
    skip.x,
    skip.y,
    skip.w,
    skip.h,
    "#4a435a"
  );

  g.text(
    "何も取らない",
    skip.x + skip.w / 2,
    skip.y + skip.h / 2,
    20,
    COLORS.text
  );
}

function drawPoolPicker(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "rgba(10,8,20,0.86)"
  );

  const replacing = S.scene === "replace";

  g.text(
    replacing
      ? "プールがいっぱい"
      : "無料で1個削除",
    g.W / 2,
    72,
    35,
    COLORS.text
  );

  g.text(
    replacing
      ? "捨てるシンボルを選ぶ"
      : "消すシンボルを選んでプールを絞る",
    g.W / 2,
    112,
    20,
    COLORS.dim
  );

  if (replacing){
    g.text(
      "追加するもの　" + S.pendingSymbol,
      g.W / 2,
      168,
      27,
      COLORS.gold
    );
  } else {
    g.text(
      "家賃の支払いに成功！",
      g.W / 2,
      168,
      25,
      COLORS.green
    );
  }

  for (let i = 0; i < S.pool.length; i++){
    const rect = poolCellRect(i);

    g.rect(
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      "#514868"
    );

    g.rect(
      rect.x + 3,
      rect.y + 3,
      rect.w - 6,
      rect.h - 6,
      "#2e2945"
    );

    g.emoji(
      S.pool[i],
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
      38
    );
  }

  g.text(
    "同じ絵文字も1個ずつ選べます",
    g.W / 2,
    458,
    17,
    COLORS.dim
  );
}

function drawRentMessage(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "rgba(8,7,16,0.78)"
  );

  const failed = S.scene === "rentFail";

  g.text(
    failed ? "家賃不足" : "家賃クリア！",
    g.W / 2,
    174,
    45,
    failed ? COLORS.red : COLORS.gold
  );

  g.text(
    "家賃 " + S.lastRent,
    g.W / 2,
    238,
    31,
    COLORS.text
  );

  if (failed){
    g.text(
      "あと " + S.shortage + " 足りない",
      g.W / 2,
      296,
      28,
      COLORS.red
    );
  } else {
    const progress = g.clamp(
      1 - S.rentTimer / RENT_RESULT_TIME,
      0,
      1
    );
    const counted = Math.floor(
      S.lastRent * progress
    );

    g.text(
      counted + " / " + S.lastRent,
      g.W / 2,
      296,
      28,
      COLORS.green
    );

    g.text(
      "次にプールを1個削除できます",
      g.W / 2,
      347,
      20,
      COLORS.blue
    );
  }
}

function drawFloaters(g, ox, oy){
  for (const floater of S.floaters){
    const alpha = g.clamp(
      floater.t / 0.25,
      0,
      1
    );

    g.text(
      floater.text,
      floater.x + ox,
      floater.y + oy,
      floater.size,
      floater.color
    );

    if (alpha < 0){
      break;
    }
  }
}

function drawConfetti(g){
  for (const particle of S.confetti){
    const size = 7;

    g.rect(
      particle.x,
      particle.y,
      size,
      size,
      particle.color
    );
  }
}

function drawTitle(g){
  g.bg(COLORS.background);

  for (let i = 0; i < 8; i++){
    const symbol = SYMBOLS[i];

    g.emoji(
      symbol,
      90 + i * 112,
      88 + Math.sin(g.time * 2 + i) * 8,
      43,
      { alpha: 0.5 }
    );
  }

  g.text(
    "🎰 絵文字スロット",
    g.W / 2,
    169,
    51,
    COLORS.text
  );

  g.text(
    "拾うほど選べなくなる、絞り込みスロット",
    g.W / 2,
    225,
    23,
    COLORS.gold
  );

  drawPanel(
    g,
    240,
    270,
    480,
    112,
    COLORS.panel
  );

  g.text(
    "9マスの上下左右でペアを作ろう",
    g.W / 2,
    303,
    22,
    COLORS.blue
  );

  g.text(
    "3スピンごとの家賃を払い、18スピン生き残れ",
    g.W / 2,
    340,
    20,
    COLORS.text
  );

  g.text(
    "クリック / タップ またはスペースで開始",
    g.W / 2,
    447,
    22,
    COLORS.green
  );

  g.text(
    "rev1",
    g.W - 18,
    20,
    14,
    COLORS.dim,
    "right"
  );
}

function drawResult(g){
  g.bg(
    S.result === "win"
      ? "#142b26"
      : "#241218"
  );

  if (S.result === "win"){
    drawConfetti(g);

    g.text(
      "🎉 全家賃クリア！",
      g.W / 2,
      130,
      48,
      COLORS.gold
    );

    g.text(
      "18スピンを生き残った",
      g.W / 2,
      193,
      27,
      COLORS.text
    );

    g.text(
      "残金 " + S.coins,
      g.W / 2,
      274,
      38,
      COLORS.green
    );
  } else {
    g.text(
      "詰み",
      g.W / 2,
      139,
      58,
      COLORS.red
    );

    g.text(
      "家賃 " +
        S.lastRent +
        " に届かなかった",
      g.W / 2,
      207,
      27,
      COLORS.text
    );

    g.text(
      "不足額 " + S.shortage,
      g.W / 2,
      276,
      39,
      COLORS.red
    );

    g.text(
      "到達 " +
        S.spin +
        " / " +
        TOTAL_SPINS +
        " スピン",
      g.W / 2,
      333,
      23,
      COLORS.dim
    );
  }

  g.text(
    "最終プール " + S.pool.length + "個",
    g.W / 2,
    386,
    20,
    COLORS.blue
  );

  g.text(
    "クリック / タップ またはスペースでもう一度",
    g.W / 2,
    468,
    21,
    COLORS.text
  );

  g.text(
    "rev1",
    g.W - 18,
    20,
    14,
    COLORS.dim,
    "right"
  );
}

/* ---------- エンジンへの登録 ---------- */

EmojiEngine.register({
  id: "slot",
  name: "絵文字スロット",
  icon: "🎰",
  desc: "シンボルを絞り込み、3スピンごとの家賃を乗り越える",

  init(g){
    reset(g);
    this._state = S;
  },

  update(g, dt){
    updateEffects(dt);

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

    if (S.freeze > 0){
      S.freeze = Math.max(
        0,
        S.freeze - dt
      );
      return;
    }

    if (S.scene === "ready"){
      if (
        g.pressed("action") ||
        (
          g.pointer.justDown &&
          pointInRect(
            g,
            SPIN_BUTTON_X,
            SPIN_BUTTON_Y,
            SPIN_BUTTON_W,
            SPIN_BUTTON_H
          )
        )
      ){
        startSpin(g);
      }

      return;
    }

    if (S.scene === "spinning"){
      updateSpinning(g, dt);
      return;
    }

    if (S.scene === "payout"){
      updatePayout(g, dt);
      return;
    }

    if (S.scene === "choice"){
      updateChoice(g, dt);
      return;
    }

    if (
      S.scene === "replace" ||
      S.scene === "delete"
    ){
      updatePoolSelection(g);
      return;
    }

    if (
      S.scene === "rentPaid" ||
      S.scene === "rentFail"
    ){
      updateRent(g, dt);
    }
  },

  draw(g){
    S.drawTime = g.time;

    if (S.scene === "title"){
      drawTitle(g);
      return;
    }

    if (S.scene === "over"){
      drawResult(g);
      return;
    }

    g.bg(COLORS.background);

    const shakePower =
      S.shake > 0
        ? 6 * S.shake / SHAKE_TIME
        : 0;

    const ox =
      shakePower > 0
        ? g.rand(-shakePower, shakePower)
        : 0;

    const oy =
      shakePower > 0
        ? g.rand(-shakePower, shakePower)
        : 0;

    drawTopBar(g);
    drawBoard(g, ox, oy);
    drawSynergyLines(g, ox, oy);
    drawSideInfo(g);
    drawPoolStrip(g);
    drawSpinButton(g);
    drawFloaters(g, ox, oy);
    drawConfetti(g);

    if (S.comboPop > 0){
      const size =
        42 +
        Math.sin(g.time * 20) * 5;

      g.text(
        "COMBO!",
        812,
        342,
        size,
        COLORS.gold
      );
    }

    if (S.scene === "choice"){
      drawChoice(g);
    }

    if (
      S.scene === "replace" ||
      S.scene === "delete"
    ){
      drawPoolPicker(g);
    }

    if (
      S.scene === "rentPaid" ||
      S.scene === "rentFail"
    ){
      drawRentMessage(g);
    }

    if (S.flash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "rgba(255,255,210,0.34)"
      );
    }

    if (S.rentFlash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "rgba(255,224,107,0.28)"
      );
    }

    if (S.redFlash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "rgba(255,40,55,0.42)"
      );
    }

    g.text(
      "rev1",
      g.W - 18,
      20,
      14,
      COLORS.dim,
      "right"
    );
  },
});

})();
