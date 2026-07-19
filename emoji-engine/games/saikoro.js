/* =====================================================
   サイコロ島開拓
   2個のサイコロで資源を集め、島を育てる
===================================================== */
(function(){
"use strict";

const TOTAL_TIME = 90;
const RESOURCES = ["🌾", "🪵", "🧱", "🐑", "⛏️"];
const RARE_NUMBERS = [2, 3, 4, 10, 11, 12];
const VERY_RARE_NUMBERS = [2, 3, 11, 12];
const PROBABILITY = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

let S;

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
    color: color || "#fff",
    size: size || 24,
    t: life === undefined ? 0.9 : life,
  });
}

function updateEffects(dt){
  for (const floater of S.floaters){
    floater.y -= 36 * dt;
    floater.t -= dt;
  }

  S.floaters = S.floaters.filter(
    floater => floater.t > 0
  );

  for (const particle of S.confetti){
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 150 * dt;
    particle.rot += particle.vr * dt;
    particle.t -= dt;
  }

  S.confetti = S.confetti.filter(
    particle => particle.t > 0
  );

  S.shake = Math.max(0, S.shake - dt);
  S.flash = Math.max(0, S.flash - dt);
  S.rollVisual = Math.max(0, S.rollVisual - dt);
  S.landPop = Math.max(0, S.landPop - dt);

  // 土地ごとの「今もらった!」ハイライト(選択中の土地とは別に、当たった土地そのものを光らせる)
  for (const land of S.lands){
    land.hitFlash = Math.max(
      0,
      (land.hitFlash || 0) - dt
    );
  }
}

// 土地タイルの画面上の位置を計算(landHitの浮遊テキストや、当たった土地の光らせ表示で使う)
function landLayout(g, index){
  const count = S.lands.length;
  const width = 148;
  const gap = 14;
  const total =
    count * width +
    (count - 1) * gap;
  const left = (g.W - total) / 2;
  const x = left + index * (width + gap);

  return {
    x: x,
    centerX: x + width / 2,
    y: 390,
    width: width,
  };
}

function randomResource(g){
  return g.pick(RESOURCES);
}

function makeLand(
  g,
  number,
  resource
){
  return {
    number: number,
    resource: resource || randomResource(g),
    building: "house",
  };
}

function shuffle(g, items){
  const result = items.slice();

  for (let i = result.length - 1; i > 0; i--){
    const j = Math.floor(g.rand(0, i + 1));
    const old = result[i];
    result[i] = result[j];
    result[j] = old;
  }

  return result;
}

function initialOffer(g){
  const stable = g.pick([6, 8]);
  const holeCount =
    Math.floor(g.rand(0, 2)) + 1;

  let holes = shuffle(
    g,
    [2, 3, 11, 12]
  ).slice(0, holeCount);

  const used = [stable].concat(holes);
  const middlePool = shuffle(
    g,
    [4, 5, 7, 9, 10, 11, 3]
      .filter(number =>
        used.indexOf(number) < 0
      )
  );

  const numbers = [stable].concat(holes);

  while (numbers.length < 6){
    numbers.push(middlePool.shift());
  }

  return shuffle(
    g,
    numbers.map(number =>
      makeLand(g, number)
    )
  );
}

function newLandOffer(g){
  const used = S.lands.map(
    land => land.number
  );

  const pool = [];

  for (let number = 2; number <= 12; number++){
    if (used.indexOf(number) < 0){
      pool.push(number);
    }
  }

  const chosen = shuffle(g, pool).slice(0, 3);

  return chosen.map(number =>
    makeLand(g, number)
  );
}

function reset(g){
  const bestScore = S
    ? S.bestScore
    : 0;

  S = {
    scene: "title",
    elapsed: 0,
    rollTimer: 3,
    event25Done: false,
    event55Done: false,

    lands: [],
    offer: [],
    offerPicked: [],
    selectedLand: 0,

    resources: {
      "🌾": 0,
      "🪵": 0,
      "🧱": 0,
      "🐑": 0,
      "⛏️": 0,
    },
    everResources: {
      "🌾": false,
      "🪵": false,
      "🧱": false,
      "🐑": false,
      "⛏️": false,
    },

    port: false,
    exchangeStep: 0,
    exchangePay: null,

    dice: [1, 1],
    total: 2,
    displayedTotal: 2,
    modifier: 0,
    diceCards: 2,
    rollVisual: 0,

    robberTimer: 0,
    robberStep: "choice",
    robberSwapFirst: -1,
    robberGiftLeft: 0,

    floaters: [],
    confetti: [],
    freeze: 0,
    shake: 0,
    flash: 0,
    landPop: 0,

    score: 0,
    buildingScore: 0,
    challengeBonus: 0,
    varietyBonus: 0,
    resultType: "",
    bestScore: bestScore,
  };
}

function startGame(g){
  S.scene = "initial";
  S.elapsed = 0;
  S.rollTimer = 3;
  S.event25Done = false;
  S.event55Done = false;

  S.lands = [];
  S.offer = initialOffer(g);
  S.offerPicked = [];
  S.selectedLand = 0;

  for (const resource of RESOURCES){
    S.resources[resource] = 0;
    S.everResources[resource] = false;
  }

  S.port = false;
  S.exchangeStep = 0;
  S.exchangePay = null;

  S.dice = [1, 1];
  S.total = 2;
  S.displayedTotal = 2;
  S.modifier = 0;
  S.diceCards = 2;
  S.rollVisual = 0;

  S.robberTimer = 0;
  S.robberStep = "choice";
  S.robberSwapFirst = -1;
  S.robberGiftLeft = 0;

  S.floaters = [];
  S.confetti = [];
  S.freeze = 0;
  S.shake = 0;
  S.flash = 0;
  S.landPop = 0;

  S.score = 0;
  S.buildingScore = 0;
  S.challengeBonus = 0;
  S.varietyBonus = 0;
  S.resultType = "";

  g.se("click");
}

function addResource(
  resource,
  amount,
  x,
  y
){
  S.resources[resource] += amount;
  S.everResources[resource] = true;

  addFloater(
    x,
    y,
    resource + "+" + amount,
    "#fff3a6",
    27,
    1.1
  );
}

function totalResources(){
  let total = 0;

  for (const resource of RESOURCES){
    total += S.resources[resource];
  }

  return total;
}

function spendAnyResource(){
  for (const resource of RESOURCES){
    if (S.resources[resource] > 0){
      S.resources[resource]--;
      return true;
    }
  }

  return false;
}

function loseHalfResources(){
  for (const resource of RESOURCES){
    S.resources[resource] =
      Math.floor(S.resources[resource] / 2);
  }
}

function hasCost(cost){
  for (const resource of RESOURCES){
    const amount = cost[resource] || 0;

    if (S.resources[resource] < amount){
      return false;
    }
  }

  return true;
}

function payCost(cost){
  if (!hasCost(cost)){
    return false;
  }

  for (const resource of RESOURCES){
    S.resources[resource] -=
      cost[resource] || 0;
  }

  return true;
}

function startConfetti(g){
  const colors = [
    "#ff6b6b",
    "#ffe66d",
    "#7ee7ff",
    "#81e8a2",
    "#d99cff",
  ];

  for (let i = 0; i < 44; i++){
    S.confetti.push({
      x: g.rand(190, 770),
      y: g.rand(90, 210),
      vx: g.rand(-90, 90),
      vy: g.rand(-210, -70),
      rot: g.rand(0, 6.28),
      vr: g.rand(-8, 8),
      color: g.pick(colors),
      t: g.rand(1.1, 1.8),
    });
  }
}

function landHit(g, land){
  const amount =
    land.building === "castle"
      ? 2
      : 1;

  // 浮遊テキストは「当たった土地の真上」に出す(固定位置だとどの土地が反応したか分からず、
  // 別の資源が出たように見えてしまう=ユーザー報告のバグ)
  const index = S.lands.indexOf(land);
  const layout = landLayout(g, index);

  addResource(
    land.resource,
    amount,
    layout.centerX,
    layout.y - 14
  );

  // 選択中かどうかに関わらず、当たった土地そのものを光らせる
  land.hitFlash = 0.45;

  if (
    VERY_RARE_NUMBERS.indexOf(
      land.number
    ) >= 0
  ){
    S.freeze = 8 / 60;
    S.shake = 0.42;
    S.flash = 0.18;
    startConfetti(g);
    addFloater(
      480,
      205,
      "🎉 大穴的中！",
      "#ffe66d",
      38,
      1.3
    );
    g.se("clear");
    return;
  }

  if (land.building === "castle"){
    S.freeze = 6 / 60;
    S.flash = 0.12;
    g.se("coin");
  } else {
    S.freeze = 3 / 60;
    g.se("coin");
  }
}

function startRobber(g){
  S.scene = "robber";
  S.robberTimer = 5;
  S.robberStep = "choice";
  S.robberSwapFirst = -1;
  S.robberGiftLeft = 0;
  S.exchangeStep = 0;
  S.exchangePay = null;
  S.shake = 0.28;
  g.se("boom");
}

function rollDice(g){
  const die1 = Math.floor(g.rand(1, 7));
  const die2 = Math.floor(g.rand(1, 7));

  S.dice = [die1, die2];
  S.total = die1 + die2;
  S.displayedTotal = g.clamp(
    S.total + S.modifier,
    2,
    12
  );
  S.modifier = 0;
  S.rollVisual = 0.75;

  if (S.displayedTotal === 7){
    startRobber(g);
    return;
  }

  const hits = S.lands.filter(
    land =>
      land.number === S.displayedTotal &&
      land.building !== "none"
  );

  if (hits.length <= 0){
    g.se("click");
    return;
  }

  for (const land of hits){
    landHit(g, land);
  }
}

function armModifier(g, value){
  if (
    S.scene !== "play" ||
    S.diceCards <= 0
  ){
    return;
  }

  S.modifier = value;
  S.diceCards--;
  addFloater(
    value < 0 ? 724 : 854,
    306,
    "次の出目 " +
      (value > 0 ? "+1" : "-1"),
    "#d9b8ff",
    20,
    1
  );
  g.se("ping");
}

function safeRobberChoice(g){
  if (totalResources() > 0){
    spendAnyResource();
    addFloater(
      480,
      220,
      "🛡️ 資源1個で守った",
      "#bfe8ff",
      28,
      1
    );
    g.se("click");
  } else {
    addFloater(
      480,
      220,
      "盗賊は何も取れなかった",
      "#bbb",
      24,
      1
    );
    g.se("click");
  }

  finishRobber();
}

function swappableLandIndices(){
  const indices = [];

  for (let i = 0; i < S.lands.length; i++){
    if (S.lands[i].building !== "castle"){
      indices.push(i);
    }
  }

  return indices;
}

function chooseRobber(g, choice){
  if (
    S.scene !== "robber" ||
    S.robberStep !== "choice"
  ){
    return;
  }

  if (choice === 0){
    if (totalResources() <= 0){
      g.se("hit");
      return;
    }

    safeRobberChoice(g);
    return;
  }

  if (choice === 1){
    const indices = swappableLandIndices();

    if (indices.length < 2){
      addFloater(
        480,
        220,
        "入れ替えられる土地が足りない",
        "#bbb",
        23,
        1
      );
      finishRobber();
      return;
    }

    S.robberStep = "swap";
    S.robberSwapFirst = -1;
    g.se("click");
    return;
  }

  if (choice === 2){
    loseHalfResources();
    S.robberStep = "gift";
    S.robberGiftLeft = 2;
    g.se("click");
  }
}

function chooseRobberSwap(g, index){
  if (
    index < 0 ||
    index >= S.lands.length ||
    S.lands[index].building === "castle"
  ){
    g.se("hit");
    return;
  }

  if (S.robberSwapFirst < 0){
    S.robberSwapFirst = index;
    g.se("click");
    return;
  }

  if (index === S.robberSwapFirst){
    return;
  }

  const first = S.lands[S.robberSwapFirst];
  const second = S.lands[index];
  const oldNumber = first.number;

  first.number = second.number;
  second.number = oldNumber;

  addFloater(
    480,
    220,
    "🔄 数字を入れ替えた",
    "#bfe8ff",
    27,
    1
  );
  g.se("bounce");
  finishRobber();
}

function chooseRobberGift(g, index){
  if (
    index < 0 ||
    index >= RESOURCES.length
  ){
    return;
  }

  const resource = RESOURCES[index];

  addResource(
    resource,
    1,
    480,
    235
  );

  S.robberGiftLeft--;

  if (S.robberGiftLeft <= 0){
    finishRobber();
  } else {
    g.se("click");
  }
}

function finishRobber(){
  S.scene = "play";
  S.robberStep = "choice";
  S.robberSwapFirst = -1;
  S.robberGiftLeft = 0;
  S.rollTimer =
    TOTAL_TIME - S.elapsed <= 15
      ? 2
      : 3;
}

function selectInitialLand(g, index){
  if (
    index < 0 ||
    index >= S.offer.length ||
    S.offerPicked.indexOf(index) >= 0
  ){
    return;
  }

  S.offerPicked.push(index);
  g.se("click");

  if (S.offerPicked.length < 3){
    return;
  }

  S.lands = S.offerPicked.map(
    picked => {
      const land = S.offer[picked];

      return {
        number: land.number,
        resource: land.resource,
        building: "house",
        hitFlash: 0,
      };
    }
  );

  S.offer = [];
  S.offerPicked = [];
  S.selectedLand = 0;
  S.scene = "play";
  S.rollTimer = 3;
  S.landPop = 0.4;
  g.se("clear");
}

function selectNewLand(g, index){
  if (
    index < 0 ||
    index >= S.offer.length
  ){
    return;
  }

  const offered = S.offer[index];
  const duplicate = S.lands.some(
    land => land.number === offered.number
  );

  if (
    duplicate ||
    S.lands.length >= 5
  ){
    return;
  }

  S.lands.push({
    number: offered.number,
    resource: offered.resource,
    building: "none",
    hitFlash: 0,
  });

  S.offer = [];
  S.selectedLand = S.lands.length - 1;
  S.scene = "play";
  S.landPop = 0.4;
  g.se("clear");
}

function startLandEvent(g){
  if (S.lands.length >= 5){
    return;
  }

  S.offer = newLandOffer(g);
  S.scene = "newLand";
  S.exchangeStep = 0;
  S.exchangePay = null;
  g.se("ping");
}

function buildHouse(g){
  const land = S.lands[S.selectedLand];

  if (
    !land ||
    land.building !== "none"
  ){
    g.se("hit");
    return;
  }

  const cost = {
    "🌾": 1,
    "🪵": 1,
    "🧱": 1,
  };

  if (!payCost(cost)){
    g.se("hit");
    return;
  }

  land.building = "house";
  S.freeze = 4 / 60;
  S.landPop = 0.42;
  addFloater(
    480,
    340,
    "🏠 開拓地完成！",
    "#ffe9a8",
    28,
    1
  );
  g.se("coin");
}

function buildCastle(g){
  const land = S.lands[S.selectedLand];

  if (
    !land ||
    land.building !== "house"
  ){
    g.se("hit");
    return;
  }

  const cost = {
    "🌾": 2,
    "⛏️": 2,
  };

  if (!payCost(cost)){
    g.se("hit");
    return;
  }

  land.building = "castle";
  S.freeze = 4 / 60;
  S.landPop = 0.42;
  S.flash = 0.12;
  addFloater(
    480,
    340,
    "🏰 街へ発展！",
    "#ffe66d",
    29,
    1
  );
  g.se("clear");
}

function buildPort(g){
  if (S.port){
    g.se("hit");
    return;
  }

  const cost = {
    "🐑": 1,
    "🪵": 1,
  };

  if (!payCost(cost)){
    g.se("hit");
    return;
  }

  S.port = true;
  S.freeze = 4 / 60;
  S.landPop = 0.42;
  addFloater(
    480,
    340,
    "🚢 港が完成！",
    "#9eeeff",
    29,
    1
  );
  g.se("clear");
}

function startExchange(g){
  if (!S.port){
    g.se("hit");
    return;
  }

  S.exchangeStep = 1;
  S.exchangePay = null;
  g.se("click");
}

function chooseExchangeResource(g, index){
  if (
    index < 0 ||
    index >= RESOURCES.length
  ){
    return;
  }

  const resource = RESOURCES[index];

  if (S.exchangeStep === 1){
    if (S.resources[resource] < 2){
      g.se("hit");
      return;
    }

    S.exchangePay = resource;
    S.exchangeStep = 2;
    g.se("click");
    return;
  }

  if (S.exchangeStep === 2){
    S.resources[S.exchangePay] -= 2;
    addResource(
      resource,
      1,
      480,
      330
    );

    S.exchangeStep = 0;
    S.exchangePay = null;
    g.se("coin");
  }
}

function finishGame(g){
  let buildingScore = 0;
  let challengeBonus = 0;
  let rareCount = 0;
  let stableCount = 0;

  for (const land of S.lands){
    if (land.building === "house"){
      buildingScore += 1;
    }

    if (land.building === "castle"){
      buildingScore += 3;
    }

    if (
      RARE_NUMBERS.indexOf(land.number) >= 0 &&
      land.building === "house"
    ){
      challengeBonus += 1;
    }

    if (
      RARE_NUMBERS.indexOf(land.number) >= 0 &&
      land.building === "castle"
    ){
      challengeBonus += 2;
    }

    if (
      RARE_NUMBERS.indexOf(land.number) >= 0 &&
      land.building !== "none"
    ){
      rareCount++;
    }

    if (
      (land.number === 6 ||
        land.number === 8) &&
      land.building !== "none"
    ){
      stableCount++;
    }
  }

  if (S.port){
    buildingScore += 1;
  }

  const allKinds = RESOURCES.every(
    resource => S.everResources[resource]
  );

  const varietyBonus = allKinds ? 2 : 0;

  S.buildingScore = buildingScore;
  S.challengeBonus = challengeBonus;
  S.varietyBonus = varietyBonus;
  S.score =
    buildingScore +
    challengeBonus +
    varietyBonus;

  if (allKinds){
    S.resultType = "五穀豊穣🌈";
  } else if (
    stableCount >= 2 &&
    stableCount > rareCount
  ){
    S.resultType = "安定王👑";
  } else if (rareCount >= 2){
    S.resultType = "大穴王🎯";
  } else {
    S.resultType = "バランス型🏝️";
  }

  S.bestScore = Math.max(
    S.bestScore,
    S.score
  );
  S.elapsed = TOTAL_TIME;
  S.scene = "over";
  S.exchangeStep = 0;
  S.exchangePay = null;
  g.se("clear");
}

function digitPressed(g, count){
  for (let i = 0; i < count; i++){
    if (
      g.pressed("Digit" + (i + 1)) ||
      g.pressed("Numpad" + (i + 1))
    ){
      return i;
    }
  }

  return -1;
}

function offerIndexAtPointer(g){
  const count = S.offer.length;
  const width =
    S.scene === "initial"
      ? 126
      : 174;
  const gap =
    S.scene === "initial"
      ? 14
      : 24;
  const total =
    count * width +
    (count - 1) * gap;
  const left = (g.W - total) / 2;
  const y =
    S.scene === "initial"
      ? 220
      : 225;
  const height = 180;

  for (let i = 0; i < count; i++){
    const x = left + i * (width + gap);

    if (pointInRect(
      g,
      x,
      y,
      width,
      height
    )){
      return i;
    }
  }

  return -1;
}

function landIndexAtPointer(g){
  const count = S.lands.length;

  if (count <= 0){
    return -1;
  }

  const width = 148;
  const gap = 14;
  const total =
    count * width +
    (count - 1) * gap;
  const left = (g.W - total) / 2;
  const y = 390;
  const height = 132;

  for (let i = 0; i < count; i++){
    const x = left + i * (width + gap);

    if (pointInRect(
      g,
      x,
      y,
      width,
      height
    )){
      return i;
    }
  }

  return -1;
}

function robberOptionAtPointer(g){
  const width = 250;
  const gap = 24;
  const left = 81;
  const y = 235;

  for (let i = 0; i < 3; i++){
    const x = left + i * (width + gap);

    if (pointInRect(
      g,
      x,
      y,
      width,
      150
    )){
      return i;
    }
  }

  return -1;
}

function resourceIndexAtPointer(g){
  const width = 112;
  const gap = 14;
  const total =
    RESOURCES.length * width +
    (RESOURCES.length - 1) * gap;
  const left = (g.W - total) / 2;
  const y = 245;

  for (let i = 0; i < RESOURCES.length; i++){
    const x = left + i * (width + gap);

    if (pointInRect(
      g,
      x,
      y,
      width,
      105
    )){
      return i;
    }
  }

  return -1;
}

function updateInitial(g){
  let index = digitPressed(
    g,
    S.offer.length
  );

  if (g.pointer.justDown){
    index = offerIndexAtPointer(g);
  }

  if (index >= 0){
    selectInitialLand(g, index);
  }
}

function updateNewLand(g){
  let index = digitPressed(
    g,
    S.offer.length
  );

  if (g.pointer.justDown){
    index = offerIndexAtPointer(g);
  }

  if (index >= 0){
    selectNewLand(g, index);
  }
}

function updateRobber(g, dt){
  if (S.robberStep === "choice"){
    S.robberTimer -= dt;

    let choice = digitPressed(g, 3);

    if (g.pointer.justDown){
      choice = robberOptionAtPointer(g);
    }

    if (choice >= 0){
      chooseRobber(g, choice);
      return;
    }

    if (S.robberTimer <= 0){
      safeRobberChoice(g);
    }

    return;
  }

  if (S.robberStep === "swap"){
    let index = digitPressed(
      g,
      S.lands.length
    );

    if (g.pointer.justDown){
      index = landIndexAtPointer(g);
    }

    if (index >= 0){
      chooseRobberSwap(g, index);
    }

    return;
  }

  if (S.robberStep === "gift"){
    let index = digitPressed(
      g,
      RESOURCES.length
    );

    if (g.pointer.justDown){
      index = resourceIndexAtPointer(g);
    }

    if (index >= 0){
      chooseRobberGift(g, index);
    }
  }
}

function updatePlayPointer(g){
  if (!g.pointer.justDown){
    return;
  }

  const landIndex = landIndexAtPointer(g);

  if (landIndex >= 0){
    S.selectedLand = landIndex;
    S.exchangeStep = 0;
    S.exchangePay = null;
    g.se("click");
    return;
  }

  if (pointInRect(g, 681, 268, 108, 54)){
    armModifier(g, -1);
    return;
  }

  if (pointInRect(g, 803, 268, 108, 54)){
    armModifier(g, 1);
    return;
  }

  if (pointInRect(g, 28, 278, 180, 54)){
    buildHouse(g);
    return;
  }

  if (pointInRect(g, 220, 278, 180, 54)){
    buildCastle(g);
    return;
  }

  if (pointInRect(g, 412, 278, 180, 54)){
    buildPort(g);
    return;
  }

  if (pointInRect(g, 604, 334, 307, 42)){
    startExchange(g);
    return;
  }

  if (S.exchangeStep > 0){
    const resourceIndex =
      resourceIndexAtPointer(g);

    if (resourceIndex >= 0){
      chooseExchangeResource(
        g,
        resourceIndex
      );
    }
  }
}

function updatePlay(g, dt){
  S.elapsed += dt;

  if (S.elapsed >= TOTAL_TIME){
    finishGame(g);
    return;
  }

  if (
    !S.event25Done &&
    S.elapsed >= 25
  ){
    S.event25Done = true;
    startLandEvent(g);
    return;
  }

  if (
    !S.event55Done &&
    S.elapsed >= 55
  ){
    S.event55Done = true;
    startLandEvent(g);
    return;
  }

  const digit = digitPressed(
    g,
    S.lands.length
  );

  if (digit >= 0){
    S.selectedLand = digit;
    S.exchangeStep = 0;
    S.exchangePay = null;
    g.se("click");
  }

  updatePlayPointer(g);

  S.rollTimer -= dt;

  if (S.rollTimer <= 0){
    rollDice(g);

    if (S.scene === "play"){
      S.rollTimer =
        TOTAL_TIME - S.elapsed <= 15
          ? 2
          : 3;
    }
  }
}

function drawPanel(
  g,
  x,
  y,
  width,
  height,
  color,
  border
){
  g.rect(
    x,
    y,
    width,
    height,
    color || "#17243b"
  );

  const line = border || "#ffffff33";

  g.rect(x, y, width, 3, line);
  g.rect(
    x,
    y + height - 3,
    width,
    3,
    line
  );
  g.rect(x, y, 3, height, line);
  g.rect(
    x + width - 3,
    y,
    3,
    height,
    line
  );
}

function drawProbabilityMountain(
  g,
  y,
  small
){
  const left = 84;
  const step = 79;
  const diceSize = small ? 10 : 12;
  const rowGap = small ? 9 : 11;
  const baseY = y + (small ? 63 : 72);

  for (let number = 2; number <= 12; number++){
    const index = number - 2;
    const x = left + index * step;
    const count = PROBABILITY[number];
    const active =
      S.scene !== "title" &&
      number === S.displayedTotal;

    if (active){
      g.rect(
        x - 30,
        y - 8,
        60,
        small ? 92 : 104,
        "#ffe66d22"
      );
    }

    for (let i = 0; i < count; i++){
      g.emoji(
        "🎲",
        x,
        baseY - i * rowGap,
        diceSize,
        {
          alpha: active ? 1 : 0.52,
        }
      );
    }

    g.text(
      String(number),
      x,
      baseY + 18,
      small ? 13 : 15,
      active ? "#ffe66d" : "#d8e3f0"
    );

    if (S.scene !== "title"){
      const land = S.lands.find(
        item => item.number === number
      );

      if (land){
        let mark = "";

        if (land.building === "house"){
          mark = "🏠";
        } else if (
          land.building === "castle"
        ){
          mark = "🏰";
        } else {
          mark = "🏝️";
        }

        g.emoji(
          mark,
          x,
          baseY + 39,
          18
        );
      }
    }
  }
}

function drawTopBar(g){
  g.rect(
    0,
    0,
    g.W,
    54,
    "#07101dcc"
  );

  const remaining = Math.max(
    0,
    TOTAL_TIME - S.elapsed
  );

  g.text(
    "⏱️ " + remaining.toFixed(1),
    22,
    27,
    21,
    remaining <= 15
      ? "#ff8b8b"
      : "#fff",
    "left"
  );

  let resourceText = "";

  for (const resource of RESOURCES){
    resourceText +=
      resource +
      S.resources[resource] +
      "  ";
  }

  g.text(
    resourceText,
    g.W / 2,
    27,
    20,
    "#fff"
  );

  g.text(
    "🔮×" + S.diceCards,
    g.W - 25,
    27,
    21,
    S.diceCards > 0
      ? "#e7c4ff"
      : "#777",
    "right"
  );
}

function drawDiceArea(g){
  const jumping = S.rollVisual > 0;
  const jump =
    jumping
      ? Math.sin(
        (0.75 - S.rollVisual) * 18
      ) * 12
      : 0;

  drawPanel(
    g,
    604,
    166,
    307,
    96,
    "#17243bdd",
    "#7ee7ff55"
  );

  g.emoji(
    ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][
      S.dice[0] - 1
    ],
    672,
    205 - Math.abs(jump),
    52,
    {
      rot: jumping
        ? S.rollVisual * 5
        : 0,
    }
  );

  g.emoji(
    ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][
      S.dice[1] - 1
    ],
    742,
    205 - Math.abs(jump * 0.7),
    52,
    {
      rot: jumping
        ? -S.rollVisual * 5
        : 0,
    }
  );

  g.text(
    "= " + S.displayedTotal,
    856,
    205,
    34,
    S.displayedTotal === 7
      ? "#ff8b8b"
      : "#ffe66d"
  );

  const cardColor =
    S.diceCards > 0
      ? "#503768"
      : "#2d2d38";

  drawPanel(
    g,
    681,
    268,
    108,
    54,
    cardColor,
    S.modifier === -1
      ? "#ffe66d"
      : "#ffffff33"
  );

  drawPanel(
    g,
    803,
    268,
    108,
    54,
    cardColor,
    S.modifier === 1
      ? "#ffe66d"
      : "#ffffff33"
  );

  g.text(
    "🔮 -1",
    735,
    295,
    21,
    S.diceCards > 0
      ? "#fff"
      : "#777"
  );

  g.text(
    "🔮 +1",
    857,
    295,
    21,
    S.diceCards > 0
      ? "#fff"
      : "#777"
  );
}

function canBuildHouse(){
  const land = S.lands[S.selectedLand];

  return (
    land &&
    land.building === "none" &&
    hasCost({
      "🌾": 1,
      "🪵": 1,
      "🧱": 1,
    })
  );
}

function canBuildCastle(){
  const land = S.lands[S.selectedLand];

  return (
    land &&
    land.building === "house" &&
    hasCost({
      "🌾": 2,
      "⛏️": 2,
    })
  );
}

function canBuildPort(){
  return (
    !S.port &&
    hasCost({
      "🐑": 1,
      "🪵": 1,
    })
  );
}

function drawBuildButton(
  g,
  x,
  icon,
  name,
  recipe,
  enabled
){
  const pulse =
    enabled
      ? 0.5 + Math.sin(g.time * 7) * 0.12
      : 0;

  const color = enabled
    ? "rgba(48,126,82," +
      (0.72 + pulse * 0.2) +
      ")"
    : "#292d36";

  drawPanel(
    g,
    x,
    278,
    180,
    54,
    color,
    enabled
      ? "#9cff9c"
      : "#555"
  );

  g.text(
    icon + " " + name,
    x + 90,
    294,
    19,
    enabled ? "#fff" : "#777"
  );

  g.text(
    recipe,
    x + 90,
    317,
    14,
    enabled ? "#e6ffe9" : "#666"
  );
}

function drawBuildArea(g){
  drawBuildButton(
    g,
    28,
    "🏠",
    "開拓地",
    "🌾+🪵+🧱",
    canBuildHouse()
  );

  drawBuildButton(
    g,
    220,
    "🏰",
    "街",
    "🌾×2+⛏️×2",
    canBuildCastle()
  );

  drawBuildButton(
    g,
    412,
    "🚢",
    "港",
    "🐑+🪵",
    canBuildPort()
  );

  drawPanel(
    g,
    604,
    334,
    307,
    42,
    S.port
      ? "#24546a"
      : "#292d36",
    S.port
      ? "#8de0ff"
      : "#555"
  );

  g.text(
    S.port
      ? "港の交換　同種2個 → 好きな1個"
      : "🚢 港を建てると交換できる",
    757,
    355,
    17,
    S.port ? "#fff" : "#777"
  );
}

function drawLands(g){
  const count = S.lands.length;
  const width = 148;
  const gap = 14;
  const total =
    count * width +
    (count - 1) * gap;
  const left = (g.W - total) / 2;

  if (S.scene === "play" && S.elapsed < 14){
    g.text(
      "↓ 数字の下の絵文字が「その土地でもらえる資源」。数字が出ると光ります",
      g.W / 2,
      373,
      15,
      "#ffe6a1"
    );
  }
  const y = 390;

  for (let i = 0; i < count; i++){
    const land = S.lands[i];
    const selected =
      i === S.selectedLand;
    const justHit = (land.hitFlash || 0) > 0;
    const pop =
      (selected && S.landPop > 0) || justHit
        ? Math.sin(
          (0.42 - Math.max(
            S.landPop,
            land.hitFlash || 0
          )) * 16
        ) * 6
        : 0;
    const x = left + i * (width + gap);

    drawPanel(
      g,
      x,
      y - pop,
      width,
      132,
      justHit
        ? "#3f5a2c"
        : selected
          ? "#314c55"
          : "#243841",
      justHit
        ? "#ffe66d"
        : selected
          ? "#ffe66d"
          : "#ffffff33"
    );

    if (justHit){
      g.rect(
        x - 4,
        y - pop - 4,
        width + 8,
        140,
        "#ffe66d22"
      );
    }

    g.text(
      String(i + 1),
      x + 13,
      y + 13 - pop,
      13,
      "#aaa"
    );

    g.emoji(
      "🏝️",
      x + 41,
      y + 53 - pop,
      55
    );

    g.text(
      String(land.number),
      x + 102,
      y + 42 - pop,
      38,
      RARE_NUMBERS.indexOf(
        land.number
      ) >= 0
        ? "#ffb57a"
        : "#fff"
    );

    g.emoji(
      land.resource,
      x + 101,
      y + 79 - pop,
      29
    );

    let building = "空き地";

    if (land.building === "house"){
      building = "🏠";
    } else if (
      land.building === "castle"
    ){
      building = "🏰";
    }

    g.text(
      building,
      x + width / 2,
      y + 111 - pop,
      land.building === "none"
        ? 15
        : 25,
      land.building === "none"
        ? "#9aa8aa"
        : "#fff"
    );
  }

  if (S.port){
    g.emoji(
      "🚢",
      left + total + 28,
      y + 91,
      42
    );
  }
}

function drawOfferCard(
  g,
  land,
  x,
  y,
  width,
  selected,
  number
){
  drawPanel(
    g,
    x,
    y,
    width,
    180,
    selected
      ? "#4a4730"
      : "#213844",
    selected
      ? "#ffe66d"
      : "#ffffff44"
  );

  g.text(
    String(number),
    x + 15,
    y + 15,
    14,
    "#bbb"
  );

  g.emoji(
    "🏝️",
    x + width / 2,
    y + 55,
    55
  );

  g.text(
    String(land.number),
    x + width / 2,
    y + 107,
    42,
    RARE_NUMBERS.indexOf(
      land.number
    ) >= 0
      ? "#ffb168"
      : "#fff"
  );

  g.emoji(
    land.resource,
    x + width / 2,
    y + 148,
    31
  );
}

function drawOffer(g){
  const initial =
    S.scene === "initial";
  const count = S.offer.length;
  const width = initial ? 126 : 174;
  const gap = initial ? 14 : 24;
  const total =
    count * width +
    (count - 1) * gap;
  const left = (g.W - total) / 2;
  const y = initial ? 220 : 225;

  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#07101df2"
  );

  g.text(
    initial
      ? "最初の土地を3枚選ぼう"
      : "新しい土地を1枚選ぼう",
    g.W / 2,
    75,
    35,
    "#ffe66d"
  );

  g.text(
    initial
      ? "安定した数字か、大穴の数字か　選ぶたびに決定"
      : "同じ数字は島に1枚まで　選ぶと時間が動き出す",
    g.W / 2,
    116,
    19,
    "#c8d7e8"
  );

  if (initial){
    g.text(
      "選択 " +
        S.offerPicked.length +
        " / 3",
      g.W / 2,
      158,
      23,
      "#fff"
    );
  } else {
    g.text(
      S.elapsed < 40
        ? "25秒の土地追加"
        : "55秒の土地追加",
      g.W / 2,
      158,
      22,
      "#8de0ff"
    );
  }

  for (let i = 0; i < count; i++){
    drawOfferCard(
      g,
      S.offer[i],
      left + i * (width + gap),
      y,
      width,
      S.offerPicked.indexOf(i) >= 0,
      i + 1
    );
  }

  g.text(
    "クリック / タップ　または番号キー",
    g.W / 2,
    444,
    20,
    "#fff"
  );
}

function drawResourceChoices(
  g,
  title,
  subtitle
){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#07101dee"
  );

  g.text(
    title,
    g.W / 2,
    120,
    34,
    "#ffe66d"
  );

  g.text(
    subtitle,
    g.W / 2,
    166,
    20,
    "#c8d7e8"
  );

  const width = 112;
  const gap = 14;
  const total =
    RESOURCES.length * width +
    (RESOURCES.length - 1) * gap;
  const left = (g.W - total) / 2;

  for (let i = 0; i < RESOURCES.length; i++){
    const resource = RESOURCES[i];
    const disabled =
      S.exchangeStep === 1 &&
      S.resources[resource] < 2;

    drawPanel(
      g,
      left + i * (width + gap),
      245,
      width,
      105,
      disabled
        ? "#292d36"
        : "#28485a",
      disabled
        ? "#555"
        : "#8de0ff"
    );

    g.emoji(
      resource,
      left + i * (width + gap) +
        width / 2,
      278,
      38,
      { alpha: disabled ? 0.35 : 1 }
    );

    g.text(
      String(i + 1),
      left + i * (width + gap) +
        width / 2,
      326,
      17,
      disabled ? "#666" : "#fff"
    );
  }

  g.text(
    "クリック / タップ　または1〜5キー",
    g.W / 2,
    400,
    18,
    "#fff"
  );
}

function drawRobber(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#120b13ee"
  );

  if (S.robberStep === "swap"){
    g.text(
      "🔄 入れ替える土地を2枚選ぶ",
      g.W / 2,
      88,
      33,
      "#ffe66d"
    );

    g.text(
      S.robberSwapFirst < 0
        ? "1枚目を選んでください"
        : "2枚目を選んでください",
      g.W / 2,
      132,
      21,
      "#fff"
    );

    g.text(
      "🏰の土地は盗賊の影響を受けません",
      g.W / 2,
      166,
      18,
      "#9edbed"
    );

    drawLands(g);
    return;
  }

  if (S.robberStep === "gift"){
    drawResourceChoices(
      g,
      "🎁 好きな資源をもらう",
      "あと" +
        S.robberGiftLeft +
        "個選べます"
    );
    return;
  }

  g.text(
    "🦹 盗賊が来た！",
    g.W / 2,
    82,
    40,
    "#ff8b8b"
  );

  g.text(
    "残り " +
      Math.max(0, S.robberTimer).toFixed(1) +
      " 秒",
    g.W / 2,
    128,
    23,
    S.robberTimer < 2
      ? "#ff8b8b"
      : "#fff"
  );

  const options = [
    {
      icon: "🛡️",
      title: "守る",
      text: "資源1個を払う",
      enabled: totalResources() > 0,
    },
    {
      icon: "🔄",
      title: "数字交換",
      text: "土地2枚を入れ替え",
      enabled:
        swappableLandIndices().length >= 2,
    },
    {
      icon: "🎁",
      title: "贈り物",
      text: "半分失い資源2個",
      enabled: true,
    },
  ];

  for (let i = 0; i < options.length; i++){
    const option = options[i];
    const x = 81 + i * 274;

    drawPanel(
      g,
      x,
      235,
      250,
      150,
      option.enabled
        ? "#3c293d"
        : "#29292f",
      option.enabled
        ? "#ff9da6"
        : "#555"
    );

    g.text(
      String(i + 1),
      x + 18,
      253,
      15,
      "#aaa"
    );

    g.emoji(
      option.icon,
      x + 125,
      275,
      51,
      {
        alpha: option.enabled
          ? 1
          : 0.3,
      }
    );

    g.text(
      option.title,
      x + 125,
      329,
      23,
      option.enabled
        ? "#fff"
        : "#666"
    );

    g.text(
      option.text,
      x + 125,
      360,
      16,
      option.enabled
        ? "#d9c8dd"
        : "#666"
    );
  }

  g.text(
    "5秒後は自動で🛡️　クリック / タップ または1〜3キー",
    g.W / 2,
    433,
    18,
    "#ddd"
  );

  g.text(
    "🏰は盗賊の影響を受けません",
    g.W / 2,
    470,
    18,
    "#9edbed"
  );
}

function drawExchange(g){
  if (S.exchangeStep === 1){
    drawResourceChoices(
      g,
      "🚢 渡す資源を選ぶ",
      "同じ資源を2個払います"
    );
  } else if (S.exchangeStep === 2){
    drawResourceChoices(
      g,
      "🚢 もらう資源を選ぶ",
      S.exchangePay +
        "×2 → 好きな資源1個"
    );
  }
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

function drawConfetti(g){
  for (const particle of S.confetti){
    g.rect(
      particle.x,
      particle.y,
      7,
      4,
      particle.color
    );
  }
}

function drawTitle(g){
  g.text(
    "🎲",
    g.W / 2,
    75,
    72
  );

  g.text(
    "サイコロ島開拓",
    g.W / 2,
    137,
    43,
    "#fff"
  );

  g.text(
    "山の高い数字か、大穴の数字か",
    g.W / 2,
    178,
    22,
    "#ffe6a1"
  );

  drawProbabilityMountain(
    g,
    180,
    true
  );

  g.text(
    "①最初に土地を3枚えらぶ(下の絵文字がもらえる資源)",
    g.W / 2,
    338,
    18,
    "#dbe8f5",
    "center"
  );

  g.text(
    "②サイコロが自動で振られ、自分の土地の数字が出たら資源GET",
    g.W / 2,
    366,
    18,
    "#dbe8f5",
    "center"
  );

  g.text(
    "③資源で🏠→🏰や🚢を建てて得点を稼ぐ(90秒)",
    g.W / 2,
    394,
    18,
    "#dbe8f5",
    "center"
  );

  g.text(
    "🔮出目補正　🦹盗賊(7)　⚠数字が多く出る土地ほど安定",
    g.W / 2,
    425,
    17,
    "#ffe6a1"
  );

  g.text(
    "クリック / タップ またはスペースで開始",
    g.W / 2,
    478,
    22,
    "#ffe66d"
  );
}

function drawResult(g){
  g.text(
    "🏝️ 開拓終了",
    g.W / 2,
    64,
    38,
    "#ffe66d"
  );

  g.text(
    S.resultType,
    g.W / 2,
    111,
    31,
    "#fff"
  );

  drawPanel(
    g,
    225,
    145,
    510,
    270,
    "#17243bdd",
    "#8de0ff66"
  );

  g.text(
    "合計 " + S.score + "点",
    g.W / 2,
    188,
    41,
    "#fff"
  );

  g.text(
    "🏠🏰🚢 建物　" +
      S.buildingScore +
      "点",
    g.W / 2,
    245,
    24,
    "#d9edff"
  );

  g.text(
    "🎯 挑戦ボーナス　+" +
      S.challengeBonus,
    g.W / 2,
    292,
    24,
    "#ffbc7a"
  );

  g.text(
    "🌈 五種ボーナス　+" +
      S.varietyBonus,
    g.W / 2,
    339,
    24,
    "#a8f3ce"
  );

  g.text(
    "ベストスコア　" +
      S.bestScore,
    g.W / 2,
    382,
    20,
    "#c4d5e8"
  );

  g.text(
    "クリック / タップ またはスペースでもう一度",
    g.W / 2,
    475,
    21,
    "#fff"
  );
}

EmojiEngine.register({
  id: "saikoro",
  name: "サイコロ島開拓",
  icon: "🎲",
  desc: "2個のサイコロで資源を集め、90秒で島を育てる",

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

    if (S.scene === "initial"){
      updateInitial(g);
      return;
    }

    if (S.scene === "newLand"){
      updateNewLand(g);
      return;
    }

    if (S.scene === "robber"){
      updateRobber(g, dt);
      return;
    }

    if (S.scene === "play"){
      if (S.exchangeStep > 0){
        let index = digitPressed(
          g,
          RESOURCES.length
        );

        if (g.pointer.justDown){
          index = resourceIndexAtPointer(g);
        }

        if (index >= 0){
          chooseExchangeResource(
            g,
            index
          );
        }

        return;
      }

      updatePlay(g, dt);
    }
  },

  draw(g){
    g.bg("#0a1a28");

    const shakePower =
      S.shake > 0
        ? 9 * S.shake / 0.42
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

    for (let x = 25; x < g.W; x += 58){
      g.emoji(
        "🌊",
        x,
        520 + Math.sin(
          g.time * 2 + x * 0.04
        ) * 3,
        25,
        { alpha: 0.16 }
      );
    }

    if (S.scene === "title"){
      drawTitle(g);
    } else if (S.scene === "over"){
      drawResult(g);
    } else {
      drawTopBar(g);
      drawProbabilityMountain(
        g,
        66,
        true
      );

      if (
        S.scene === "play" ||
        S.scene === "robber"
      ){
        drawDiceArea(g);
        drawBuildArea(g);
        drawLands(g);
      }

      drawFloaters(g, ox, oy);
      drawConfetti(g);

      if (S.scene === "initial"){
        drawOffer(g);
      } else if (S.scene === "newLand"){
        drawOffer(g);
      } else if (S.scene === "robber"){
        drawRobber(g);
      } else if (
        S.scene === "play" &&
        S.exchangeStep > 0
      ){
        drawExchange(g);
      }
    }

    if (S.flash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#ffffff33"
      );
    }

    g.text(
      "rev2",
      g.W - 8,
      14,
      12,
      "#ffffff66",
      "right"
    );
  },
});
})();
