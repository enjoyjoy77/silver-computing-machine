/* =====================================================
   絵文字キーパー(旧: 掘って守る)
   採掘 → 警告 → 防衛を3サイクル繰り返す
   rev5: 掘削=穴が空くだけ(移動は歩き)、防衛バランス調整
===================================================== */
(function(){
"use strict";

const TOTAL_TIME = 90;
const MINE_WIDTH = 720;
const CELL = 48;
const COLS = 14;
const MAX_DEPTH = 1584;
const BASE_UP_SPEED = 90;
const MIN_UP_RATE = 0.4;

const CYCLES = [
  {
    mining: 19,
    warning: 3,
    defend: 8,
    enemies: [
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
    ],
  },
  {
    mining: 17,
    warning: 3,
    defend: 10,
    enemies: [
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "fast",
      "fast",
    ],
  },
  {
    mining: 15,
    warning: 3,
    defend: 12,
    enemies: [
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "fast",
      "fast",
      "fast",
      "large",
    ],
  },
];

const RESOURCES = [
  "💎",
  "🔋",
  "❤️",
  "🌟",
];

const UPGRADES = [
  {
    id: "power",
    emoji: "🔫",
    name: "火力",
    desc: "砲台の攻撃力 +30%",
  },
  {
    id: "armor",
    emoji: "🛡️",
    name: "装甲",
    desc: "基地の最大耐久 +20%",
  },
  {
    id: "lift",
    emoji: "🚀",
    name: "昇降機",
    desc: "基準上昇速度 +15%",
  },
  {
    id: "drill",
    emoji: "⛏️",
    name: "ドリル",
    desc: "掘削速度 +25%",
  },
  {
    id: "carry",
    emoji: "🎒",
    name: "運搬",
    desc: "重量ペナルティを軽減",
  },
];

let S;

function cellKey(col, row){
  return col + "," + row;
}

function depthLayer(y){
  if (y < 600){
    return 1;
  }

  if (y < 1200){
    return 2;
  }

  return 3;
}

function layerValue(layer){
  if (layer === 1){
    return 10;
  }

  if (layer === 2){
    return 25;
  }

  return 50;
}

function upgradeCost(id){
  return 30 + S.upgrades[id] * 25;
}

function addFloater(
  x,
  y,
  text,
  color,
  size,
  life,
  vx,
  vy
){
  if (S.floaters.length >= 50){
    S.floaters.shift();
  }

  S.floaters.push({
    x: x,
    y: y,
    text: text,
    color: color || "#fff",
    size: size || 22,
    t: life === undefined ? 0.75 : life,
    vx: vx || 0,
    vy: vy === undefined ? -34 : vy,
  });
}

function updateEffects(dt){
  for (const floater of S.floaters){
    floater.x += floater.vx * dt;
    floater.y += floater.vy * dt;
    floater.vy += 24 * dt;
    floater.t -= dt;
  }

  S.floaters = S.floaters.filter(
    floater => floater.t > 0
  );

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

  S.warningFlash = Math.max(
    0,
    S.warningFlash - dt
  );

  if (S.waveBanner){
    S.waveBanner.t -= dt;

    if (S.waveBanner.t <= 0){
      S.waveBanner = null;
    }
  }
}

function makeResources(g){
  const resources = [];
  const used = new Set();

  for (let row = 2; row <= 32; row++){
    const layer = depthLayer(row * CELL);
    const chance =
      layer === 1
        ? 0.22
        : layer === 2
          ? 0.31
          : 0.4;

    for (let col = 1; col < COLS - 1; col++){
      if (g.rand(0, 1) > chance){
        continue;
      }

      if (col === 7 && row < 4){
        continue;
      }

      const key = cellKey(col, row);

      if (used.has(key)){
        continue;
      }

      used.add(key);

      resources.push({
        col: col,
        row: row,
        emoji: g.pick(RESOURCES),
        collected: false,
      });
    }
  }

  return resources;
}

function reset(g){
  const startCol = 7;

  S = {
    scene: "title",
    elapsed: 0,
    won: false,

    cycle: 0,
    phase: "mining",
    phaseElapsed: 0,
    phaseDuration: CYCLES[0].mining,
    phaseSerial: 0,

    player: {
      col: startCol,
      row: 0,
      x: startCol * CELL + CELL / 2,
      y: 0,
      r: 18,
      facing: 1,
    },

    dug: new Set(),
    resources: [],
    carried: [],
    carriedValue: 0,
    bankedValue: 0,
    upgradePoints: 0,

    digTarget: null,
    digProgress: 0,

    upgrades: {
      power: 0,
      armor: 0,
      lift: 0,
      drill: 0,
      carry: 0,
    },

    upgradeCount: 0,
    returnCount: 0,

    baseHp: 100,
    baseMaxHp: 100,
    enemies: [],
    enemyId: 0,
    spawnQueue: [],
    spawnIndex: 0,
    spawnTimer: 0,
    autoTimer: 0,
    manualTimer: 0,
    aimX: 850,

    emergencyUsed: false,
    emergencyReadyShown: false,

    floaters: [],
    freeze: 0,
    shake: 0,
    redFlash: 0,
    whiteFlash: 0,
    warningFlash: 0,
    waveBanner: null,

    pointerX: g.W / 2,
    pointerY: g.H / 2,
  };

  for (let row = 0; row <= 3; row++){
    S.dug.add(cellKey(startCol, row));
  }

  S.resources = makeResources(g);
}

function startGame(g){
  reset(g);
  S.scene = "play";
  S.waveBanner = {
    text: "第1採掘フェーズ",
    t: 2,
  };
  g.bgm("battle");
  g.se("click");
}

function finishGame(g, won){
  if (S.scene === "over"){
    return;
  }

  S.scene = "over";
  S.won = won;
  S.freeze = 0;
  g.bgm(false);

  if (won){
    S.whiteFlash = 0.45;
    g.se("clear");
  } else {
    S.redFlash = 0.65;
    S.shake = 0.6;
    g.se("boom");
  }
}

function isAtSurface(){
  return S.player.y <= 0.01;
}

function cycleNumber(){
  return S.cycle + 1;
}

function phaseRemaining(){
  return Math.max(
    0,
    S.phaseDuration - S.phaseElapsed
  );
}

function phaseLabel(){
  if (S.phase === "mining"){
    return "採掘中";
  }

  if (S.phase === "warning"){
    return "帰還警告";
  }

  return "防衛中";
}

function showWave(g, text){
  S.waveBanner = {
    text: text,
    t: 2.1,
  };
  S.warningFlash = 0.4;
  g.se("ping");
}

function checkEmergencyReady(g, before, after){
  if (
    before < 45 &&
    after >= 45 &&
    !S.emergencyUsed
  ){
    S.emergencyReadyShown = true;

    addFloater(
      355,
      115,
      "🚨 緊急帰還が使用可能",
      "#ffcf6e",
      25,
      1.8
    );

    g.se("ping");
  }
}

function drillTime(){
  return 0.42 / (
    1 + S.upgrades.drill * 0.25
  );
}

function carryPenalty(){
  if (S.upgrades.carry > 0){
    return {
      layer2: 0.025,
      layer3: 0.04,
    };
  }

  return {
    layer2: 0.04,
    layer3: 0.06,
  };
}

function moveSpeed(){
  // 掘った通路をなめらかに進む速さ。上下左右とも共通で、重さがあるほど遅くなる
  const layer = depthLayer(S.player.y);
  const base =
    BASE_UP_SPEED *
    (
      1 +
      S.upgrades.lift * 0.15
    );

  if (layer === 1){
    return base;
  }

  const penalty = carryPenalty();
  const perItem =
    layer === 2
      ? penalty.layer2
      : penalty.layer3;

  const rate = Math.max(
    MIN_UP_RATE,
    1 - S.carried.length * perItem
  );

  return base * rate;
}

function resourceAt(col, row){
  for (const resource of S.resources){
    if (
      !resource.collected &&
      resource.col === col &&
      resource.row === row
    ){
      return resource;
    }
  }

  return null;
}

function collectResource(g, col, row){
  const resource = resourceAt(col, row);

  if (!resource){
    return;
  }

  resource.collected = true;

  const value = layerValue(
    depthLayer(row * CELL)
  );

  S.carried.push({
    emoji: resource.emoji,
    value: value,
  });

  S.carriedValue += value;
  S.freeze = Math.max(S.freeze, 2 / 60);

  addFloater(
    S.player.x,
    265,
    resource.emoji + " +" + value,
    "#ffe66d",
    27,
    0.8
  );

  for (let i = 0; i < 4; i++){
    addFloater(
      S.player.x,
      275,
      g.pick(["✨", "✦", "·"]),
      "#fff6a5",
      g.rand(14, 22),
      g.rand(0.35, 0.65),
      g.rand(-80, 80),
      g.rand(-100, -35)
    );
  }

  g.se("coin");
}

function completeDig(g, col, row){
  // 掘っても移動しない。穴が空くだけ(進むのは歩き)
  S.dug.add(cellKey(col, row));
  S.digTarget = null;
  S.digProgress = 0;
  g.se("click");
}

function tryDig(g, col, row, dt){
  if (
    col < 0 ||
    col >= COLS ||
    row < 0 ||
    row * CELL > MAX_DEPTH
  ){
    S.digTarget = null;
    S.digProgress = 0;
    return;
  }

  const key = cellKey(col, row);

  if (S.dug.has(key)){
    S.digTarget = null;
    S.digProgress = 0;
    return;
  }

  if (
    !S.digTarget ||
    S.digTarget.col !== col ||
    S.digTarget.row !== row
  ){
    S.digTarget = {
      col: col,
      row: row,
    };
    S.digProgress = 0;
  }

  S.digProgress += dt;

  if (S.digProgress >= drillTime()){
    completeDig(g, col, row);
  }
}

function openUpgradeShop(g){
  S.scene = "upgrade";
  g.se("ping");
}

function returnToBase(g){
  if (S.carried.length <= 0){
    addFloater(
      355,
      245,
      "空手で帰還",
      "#b8cada",
      27,
      1
    );
    g.se("click");
    return;
  }

  const returnedValue = S.carriedValue;

  S.returnCount++;
  S.bankedValue += returnedValue;
  S.upgradePoints += returnedValue;
  S.carried = [];
  S.carriedValue = 0;
  S.freeze = Math.max(S.freeze, 5 / 60);
  S.whiteFlash = Math.max(S.whiteFlash, 0.22);

  addFloater(
    355,
    245,
    "帰還成功!  強化ポイント +" +
      returnedValue,
    "#8fffc1",
    28,
    1.1
  );

  const confetti = [
    "✨",
    "🎉",
    "✦",
    "💫",
  ];

  for (let i = 0; i < 12; i++){
    addFloater(
      g.rand(170, 550),
      g.rand(160, 310),
      g.pick(confetti),
      "#fff",
      g.rand(15, 25),
      g.rand(0.55, 1.05),
      g.rand(-75, 75),
      g.rand(-150, -45)
    );
  }

  g.se("clear");
  openUpgradeShop(g);
}

function useEmergency(g){
  if (
    S.emergencyUsed ||
    S.elapsed < 45 ||
    isAtSurface() ||
    S.scene !== "play"
  ){
    return;
  }

  S.emergencyUsed = true;

  const keepCount = Math.floor(
    S.carried.length / 2
  );

  S.carried = S.carried.slice(
    0,
    keepCount
  );

  S.carriedValue = 0;

  for (const item of S.carried){
    S.carriedValue += item.value;
  }

  S.player.row = 0;
  S.player.y = 0;
  S.player.x =
    S.player.col * CELL +
    CELL / 2;

  S.digTarget = null;
  S.digProgress = 0;
  S.shake = Math.max(S.shake, 0.25);
  S.whiteFlash = Math.max(S.whiteFlash, 0.35);

  addFloater(
    355,
    230,
    "🚨 緊急帰還",
    "#ffcf6e",
    32,
    1
  );

  g.se("boom");
  returnToBase(g);
}

function buyUpgrade(g, index){
  if (
    S.scene !== "upgrade" ||
    index < 0 ||
    index >= UPGRADES.length
  ){
    return;
  }

  const upgrade = UPGRADES[index];
  const cost = upgradeCost(upgrade.id);

  if (S.upgradePoints < cost){
    addFloater(
      355,
      145,
      "ポイント不足: " + cost + "必要",
      "#ff8d93",
      22,
      0.8
    );
    g.se("click");
    return;
  }

  S.upgradePoints -= cost;

  if (upgrade.id === "armor"){
    const oldMax = S.baseMaxHp;
    const hpRatio =
      oldMax > 0
        ? S.baseHp / oldMax
        : 1;

    S.upgrades.armor++;
    S.baseMaxHp =
      100 *
      (
        1 +
        S.upgrades.armor * 0.2
      );

    S.baseHp =
      S.baseMaxHp * hpRatio;
  } else {
    S.upgrades[upgrade.id]++;
  }

  S.upgradeCount++;

  addFloater(
    355,
    145,
    upgrade.emoji + " " +
      upgrade.name +
      " Lv." +
      S.upgrades[upgrade.id],
    "#ffe66d",
    25,
    0.9
  );

  g.se("clear");
}

function closeUpgradeShop(g){
  if (S.scene !== "upgrade"){
    return;
  }

  S.scene = "play";
  g.se("click");
}

function updateUpgrade(g){
  const cardWidth = 126;
  const gap = 10;
  const left = 25;
  const top = 175;
  const height = 205;

  if (g.pointer.justDown){
    const backHit =
      S.pointerX >= 265 &&
      S.pointerX <= 455 &&
      S.pointerY >= 430 &&
      S.pointerY <= 485;

    if (backHit){
      closeUpgradeShop(g);
      return;
    }

    for (let i = 0; i < UPGRADES.length; i++){
      const x =
        left +
        i * (cardWidth + gap);

      if (
        S.pointerX >= x &&
        S.pointerX <= x + cardWidth &&
        S.pointerY >= top &&
        S.pointerY <= top + height
      ){
        buyUpgrade(g, i);
        return;
      }
    }
  }

  const numberKeys = [
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
  ];

  for (let i = 0; i < numberKeys.length; i++){
    if (g.pressed(numberKeys[i])){
      buyUpgrade(g, i);
      return;
    }
  }

  if (
    g.pressed("action") ||
    g.pressed("Enter")
  ){
    closeUpgradeShop(g);
  }
}

function updateMining(g, dt){
  const player = S.player;

  if (
    S.elapsed >= 45 &&
    !S.emergencyUsed &&
    !isAtSurface()
  ){
    const buttonHit =
      S.pointerX >= 500 &&
      S.pointerX <= 700 &&
      S.pointerY >= 475 &&
      S.pointerY <= 525;

    if (
      g.pointer.justDown &&
      buttonHit
    ){
      useEmergency(g);
      return;
    }
  }

  let dc = 0;
  let dr = 0;

  if (g.key("up")){
    dr = -1;
  } else if (g.key("left")){
    dc = -1;
    player.facing = -1;
  } else if (g.key("right")){
    dc = 1;
    player.facing = 1;
  } else if (g.key("down")){
    dr = 1;
  } else {
    S.digTarget = null;
    S.digProgress = 0;
    return;
  }

  const targetCol = player.col + dc;
  const targetRow = player.row + dr;

  if (
    targetCol < 0 ||
    targetCol >= COLS ||
    targetRow < 0 ||
    targetRow * CELL > MAX_DEPTH
  ){
    S.digTarget = null;
    S.digProgress = 0;
    return;
  }

  const targetKey = cellKey(
    targetCol,
    targetRow
  );

  if (!S.dug.has(targetKey)){
    // まだ掘っていない: 他の方向と同じ扱いで掘る
    tryDig(g, targetCol, targetRow, dt);
    return;
  }

  // 既に掘った通路をなめらかに進む。上下左右とも同じ速さの式(重いほど遅い)
  S.digTarget = null;
  S.digProgress = 0;

  const speed = moveSpeed() * dt;

  if (dc !== 0){
    const targetX =
      targetCol * CELL + CELL / 2;
    const dir = dc > 0 ? 1 : -1;

    player.x += dir * speed;

    if (
      (dir > 0 && player.x >= targetX) ||
      (dir < 0 && player.x <= targetX)
    ){
      player.x = targetX;
      player.col = targetCol;
      collectResource(g, player.col, player.row);
    }

    return;
  }

  const targetY = targetRow * CELL;
  const dir = dr > 0 ? 1 : -1;
  const oldY = player.y;

  player.y += dir * speed;

  if (
    (dir > 0 && player.y >= targetY) ||
    (dir < 0 && player.y <= targetY)
  ){
    player.y = targetY;
    player.row = targetRow;
    collectResource(g, player.col, player.row);
  }

  player.x =
    player.col * CELL + CELL / 2;

  if (
    dir < 0 &&
    oldY > 0 &&
    player.y <= 0
  ){
    player.row = 0;
    returnToBase(g);
  }
}

function enemyStats(type){
  if (type === "fast"){
    return {
      emoji: "🦂",
      hp: 14 + S.cycle * 3,
      damage: 10 + S.cycle * 2,
      duration: 4,
      size: 14,
    };
  }

  if (type === "large"){
    return {
      emoji: "👹",
      hp: 52,
      damage: 22,
      duration: 7,
      size: 22,
    };
  }

  return {
    emoji: "👾",
    hp: 16 + S.cycle * 5,
    damage: 9 + S.cycle * 3,
    duration: 5.5,
    size: 15,
  };
}

function prepareDefense(){
  S.enemies = [];
  S.spawnQueue =
    CYCLES[S.cycle].enemies.slice();
  S.spawnIndex = 0;
  S.spawnTimer = 0;
  S.autoTimer = 0;
  S.manualTimer = 0;
}

function spawnEnemy(g, type){
  const stats = enemyStats(type);

  S.enemies.push({
    id: ++S.enemyId,
    type: type,
    emoji: stats.emoji,
    x: 938,
    r: stats.size,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    duration: stats.duration,
    remaining: stats.duration,
    warned: false,
    criticalWarned: false,
  });

  S.warningFlash = Math.max(
    S.warningFlash,
    0.18
  );
}

function killEnemy(g, enemy){
  enemy.dead = true;
  S.freeze = Math.max(
    S.freeze,
    g.rand(3 / 60, 4 / 60)
  );
  S.shake = Math.max(S.shake, 0.16);

  addFloater(
    enemy.x,
    330,
    "💥 撃破",
    "#ffe66d",
    22,
    0.7
  );

  g.se("hit");
}

function turretDamage(){
  return 12 *
    (
      1 +
      S.upgrades.power * 0.3
    );
}

function updateDefense(g, dt){
  const queueLength =
    S.spawnQueue.length;

  if (S.spawnIndex < queueLength){
    S.spawnTimer -= dt;

    if (S.spawnTimer <= 0){
      spawnEnemy(
        g,
        S.spawnQueue[S.spawnIndex]
      );

      S.spawnIndex++;

      const remainingSpawns =
        queueLength - S.spawnIndex;

      // 全員がフェーズ内に基地へ届き得るよう、前半に寄せて出す
      const timeLeft = Math.max(
        0.1,
        phaseRemaining() - 6
      );

      S.spawnTimer =
        remainingSpawns > 0
          ? Math.max(
            0.4,
            timeLeft / remainingSpawns
          )
          : 999;
    }
  }

  S.manualTimer = Math.max(
    0,
    S.manualTimer - dt
  );

  S.autoTimer -= dt;

  if (
    S.enemies.length > 0 &&
    S.autoTimer <= 0
  ){
    let target = null;

    for (const enemy of S.enemies){
      if (
        !enemy.dead &&
        (
          !target ||
          enemy.remaining < target.remaining
        )
      ){
        target = enemy;
      }
    }

    if (target){
      const efficiency =
        isAtSurface()
          ? 0.6
          : 0.4;

      target.hp -=
        turretDamage() *
        efficiency;

      S.autoTimer =
        isAtSurface()
          ? 0.65
          : 0.9;

      if (target.hp <= 0){
        killEnemy(g, target);
      }
    }
  }

  if (isAtSurface()){
    S.aimX +=
      g.stickX() *
      145 *
      dt;

    S.aimX = g.clamp(
      S.aimX,
      780,
      930
    );

    if (
      g.pressed("action") &&
      S.manualTimer <= 0
    ){
      let target = null;
      let best = 9999;

      for (const enemy of S.enemies){
        if (enemy.dead){
          continue;
        }

        const distance =
          Math.abs(
            enemy.x - S.aimX
          );

        if (distance < best){
          best = distance;
          target = enemy;
        }
      }

      if (
        target &&
        best <= 45
      ){
        target.hp -=
          turretDamage();

        addFloater(
          target.x,
          322,
          "💥",
          "#fff",
          24,
          0.35
        );

        if (target.hp <= 0){
          killEnemy(g, target);
        } else {
          g.se("ping");
        }
      } else {
        g.se("click");
      }

      S.manualTimer = 0.35;
    }
  }

  for (const enemy of S.enemies){
    if (enemy.dead){
      continue;
    }

    enemy.remaining -= dt;

    const ratio = g.clamp(
      enemy.remaining /
        enemy.duration,
      0,
      1
    );

    enemy.x =
      770 +
      168 * ratio;

    if (
      !enemy.warned &&
      enemy.remaining <= 5
    ){
      enemy.warned = true;

      addFloater(
        850,
        278,
        "⚠️ 接近中!",
        "#ffb36a",
        22,
        1
      );

      g.se("ping");
    }

    if (
      !enemy.criticalWarned &&
      enemy.remaining <= 2.5
    ){
      enemy.criticalWarned = true;

      addFloater(
        850,
        278,
        "🚨 あと少しで到達!",
        "#ff5c63",
        24,
        1
      );
    }

    if (enemy.remaining <= 0){
      enemy.dead = true;
      S.baseHp -= enemy.damage;
      S.baseHp = Math.max(
        0,
        S.baseHp
      );

      S.freeze = Math.max(
        S.freeze,
        8 / 60
      );

      S.redFlash = Math.max(
        S.redFlash,
        0.75
      );

      S.shake = Math.max(
        S.shake,
        S.baseHp /
          S.baseMaxHp <= 0.2
          ? 0.75
          : 0.5
      );

      addFloater(
        g.W / 2,
        150,
        "🚨 基地被弾! -" + enemy.damage,
        "#ff4c58",
        36,
        1.1
      );

      addFloater(
        790,
        360,
        "-" + enemy.damage,
        "#ff6677",
        26,
        0.85
      );

      g.se("boom");

      if (S.baseHp <= 0){
        finishGame(g, false);
        return;
      }
    }
  }

  S.enemies = S.enemies.filter(
    enemy => !enemy.dead
  );
}

function enterPhase(g, phase){
  S.phase = phase;
  S.phaseElapsed = 0;
  S.phaseSerial++;

  if (phase === "mining"){
    S.phaseDuration =
      CYCLES[S.cycle].mining;
    S.enemies = [];
    S.spawnQueue = [];
    showWave(
      g,
      "第" + cycleNumber() +
        "採掘フェーズ"
    );
    return;
  }

  if (phase === "warning"){
    S.phaseDuration =
      CYCLES[S.cycle].warning;
    S.enemies = [];
    S.spawnQueue = [];
    S.shake = Math.max(S.shake, 0.18);
    S.warningFlash = 0.7;
    showWave(
      g,
      "⚠ 防衛準備・地上へ戻れ!"
    );
    return;
  }

  S.phaseDuration =
    CYCLES[S.cycle].defend;
  prepareDefense();
  S.shake = Math.max(S.shake, 0.25);
  S.redFlash = Math.max(S.redFlash, 0.18);
  showWave(
    g,
    "第" + cycleNumber() +
      "波 防衛開始!"
  );
}

function completePhase(g){
  if (S.phase === "mining"){
    enterPhase(g, "warning");
    return;
  }

  if (S.phase === "warning"){
    enterPhase(g, "defend");
    return;
  }

  S.enemies = [];
  S.spawnQueue = [];

  if (S.cycle >= CYCLES.length - 1){
    finishGame(
      g,
      S.baseHp > 0
    );
    return;
  }

  S.cycle++;
  enterPhase(g, "mining");
}

function updateTimeline(g, dt){
  const before = S.elapsed;

  S.elapsed = Math.min(
    TOTAL_TIME,
    S.elapsed + dt
  );

  checkEmergencyReady(
    g,
    before,
    S.elapsed
  );

  S.phaseElapsed += dt;

  if (
    S.phase === "warning"
  ){
    const oldSecond = Math.ceil(
      S.phaseDuration -
      (S.phaseElapsed - dt)
    );

    const newSecond = Math.ceil(
      phaseRemaining()
    );

    if (
      newSecond !== oldSecond &&
      newSecond > 0
    ){
      S.warningFlash = 0.35;
      g.se("ping");
    }
  }
}

function updatePlay(g, dt){
  updateTimeline(g, dt);

  if (S.phase === "defend"){
    updateDefense(g, dt);

    if (S.scene === "over"){
      return;
    }
  }

  updateMining(g, dt);

  if (
    S.scene === "play" &&
    S.phaseElapsed >= S.phaseDuration
  ){
    completePhase(g);
  }

  if (
    S.scene !== "over" &&
    S.elapsed >= TOTAL_TIME
  ){
    finishGame(
      g,
      S.baseHp > 0
    );
  }
}

function cameraY(){
  return Math.max(
    0,
    S.player.y - 245
  );
}

function drawMineBackground(g, ox, oy){
  g.rect(
    0,
    0,
    MINE_WIDTH,
    g.H,
    "#151219"
  );

  const cam = cameraY();
  const firstRow = Math.max(
    0,
    Math.floor(cam / CELL) - 1
  );
  const lastRow = Math.min(
    33,
    firstRow + 14
  );

  for (
    let row = firstRow;
    row <= lastRow;
    row++
  ){
    const worldY = row * CELL;
    const screenY =
      worldY - cam + oy;

    const layer =
      depthLayer(worldY);

    let solidColor = "#6d4930";
    let edgeColor = "#a67850";
    let openColor = "#251d1b";

    if (layer === 2){
      solidColor = "#533c3b";
      edgeColor = "#8c6866";
      openColor = "#1d1a21";
    } else if (layer === 3){
      solidColor = "#342f3d";
      edgeColor = "#706a7d";
      openColor = "#12131a";
    }

    for (
      let col = 0;
      col < COLS;
      col++
    ){
      const x =
        col * CELL +
        ox;

      const key =
        cellKey(col, row);

      if (S.dug.has(key)){
        g.rect(
          x,
          screenY,
          CELL - 1,
          CELL - 1,
          openColor
        );

        g.rect(
          x,
          screenY,
          CELL - 1,
          2,
          "#ffffff14"
        );
      } else {
        g.rect(
          x,
          screenY,
          CELL - 1,
          CELL - 1,
          solidColor
        );

        g.rect(
          x + 2,
          screenY + 2,
          CELL - 5,
          3,
          edgeColor
        );

        g.text(
          "·",
          x + CELL / 2,
          screenY + CELL / 2,
          16,
          "#ffffff26"
        );
      }
    }
  }

  for (const resource of S.resources){
    if (resource.collected){
      continue;
    }

    const worldY =
      resource.row * CELL;
    const y =
      worldY -
      cam +
      CELL / 2 +
      oy;

    if (
      y < -30 ||
      y > g.H + 30
    ){
      continue;
    }

    const x =
      resource.col *
      CELL +
      CELL / 2 +
      ox;

    const visible =
      !S.dug.has(
        cellKey(
          resource.col,
          resource.row
        )
      );

    g.emoji(
      resource.emoji,
      x,
      y,
      visible ? 25 : 34,
      {
        alpha:
          visible
            ? 0.42 +
              Math.sin(
                g.time * 5 +
                resource.row
              ) * 0.12
            : 1,
      }
    );
  }

  const line1 =
    600 - cam + oy;
  const line2 =
    1200 - cam + oy;

  if (
    line1 > 0 &&
    line1 < g.H
  ){
    g.rect(
      0,
      line1,
      MINE_WIDTH,
      3,
      "#ffe28a88"
    );

    g.text(
      "第2層",
      12,
      line1 - 15,
      15,
      "#ffe28a",
      "left"
    );
  }

  if (
    line2 > 0 &&
    line2 < g.H
  ){
    g.rect(
      0,
      line2,
      MINE_WIDTH,
      3,
      "#d69cff88"
    );

    g.text(
      "第3層",
      12,
      line2 - 15,
      15,
      "#d69cff",
      "left"
    );
  }
}

function drawPlayer(g, ox, oy){
  const cam = cameraY();
  const x =
    S.player.x + ox;
  const y =
    S.player.y -
    cam +
    25 +
    oy;

  if (S.digTarget){
    const ratio = g.clamp(
      S.digProgress /
        drillTime(),
      0,
      1
    );

    g.rect(
      x - 28,
      y - 40,
      56,
      6,
      "#171717"
    );

    g.rect(
      x - 28,
      y - 40,
      56 * ratio,
      6,
      "#ffe66d"
    );
  }

  g.emoji(
    "👷",
    x,
    y,
    42,
    {
      flipX:
        S.player.facing < 0,
    }
  );

  if (g.key("up") && !isAtSurface()){
    g.emoji(
      "⬆️",
      x + 25,
      y - 25,
      18,
      {
        alpha: 0.7,
      }
    );
  }
}

function baseEmoji(){
  if (
    S.upgrades.power >= 2 &&
    S.upgrades.armor >= 2
  ){
    return "🏰";
  }

  return "🏠";
}

function baseCondition(){
  const ratio =
    S.baseHp / S.baseMaxHp;

  if (ratio > 0.7){
    return "";
  }

  if (ratio > 0.4){
    return "💨";
  }

  if (ratio > 0.2){
    return "🔥";
  }

  return "🔥🔥";
}

function drawDefenseBand(g, ox, oy){
  g.rect(
    720,
    0,
    240,
    g.H,
    "#102234"
  );

  g.rect(
    720,
    0,
    4,
    g.H,
    "#87bde055"
  );

  g.text(
    "地上基地",
    840,
    28,
    22,
    "#fff"
  );

  g.text(
    "第" + cycleNumber() +
      "波 " + phaseLabel(),
    840,
    55,
    16,
    S.phase === "defend"
      ? "#ff867f"
      : S.phase === "warning"
        ? "#ffcf6e"
        : "#9edfff"
  );

  g.rect(
    747,
    78,
    186,
    16,
    "#07101a"
  );

  const hpRatio = g.clamp(
    S.baseHp /
      S.baseMaxHp,
    0,
    1
  );

  g.rect(
    747,
    78,
    186 * hpRatio,
    16,
    hpRatio <= 0.25
      ? "#ff4c58"
      : hpRatio <= 0.5
        ? "#ffac55"
        : "#68dc93"
  );

  g.text(
    "耐久 " +
      Math.ceil(S.baseHp) +
      " / " +
      Math.ceil(S.baseMaxHp),
    840,
    108,
    16,
    "#dcecf7"
  );

  g.emoji(
    baseEmoji(),
    775 + ox,
    188 + oy,
    62
  );

  if (S.upgrades.power > 0){
    g.emoji(
      "🔫",
      802 + ox,
      160 + oy,
      27
    );
  }

  if (S.upgrades.armor > 0){
    g.emoji(
      "🛡️",
      752 + ox,
      163 + oy,
      27
    );
  }

  const condition =
    baseCondition();

  if (condition){
    g.text(
      condition,
      775 + ox,
      232 + oy,
      24,
      "#fff"
    );
  }

  g.rect(
    750,
    275,
    188,
    3,
    "#53758d"
  );

  let minRemaining = 999;

  for (const enemy of S.enemies){
    const hpRatioEnemy =
      g.clamp(
        enemy.hp /
          enemy.maxHp,
        0,
        1
      );

    minRemaining = Math.min(
      minRemaining,
      enemy.remaining
    );

    const urgency = g.clamp(
      1 - enemy.remaining / 6,
      0,
      1
    );

    const size =
      enemy.type === "large"
        ? 48 + urgency * 16
        : 31 + urgency * 22;

    const pulse =
      enemy.remaining <= 3
        ? 1 +
          Math.sin(g.time * 14) * 0.12
        : 1;

    g.emoji(
      enemy.emoji,
      enemy.x + ox,
      255 + oy,
      size * pulse
    );

    if (enemy.remaining <= 5){
      g.text(
        "⚠",
        enemy.x + ox,
        218 + oy,
        20,
        enemy.remaining <= 3
          ? "#ff5c63"
          : "#ffb36a"
      );
    }

    g.rect(
      enemy.x - 17 + ox,
      230 + oy,
      34,
      5,
      "#30141a"
    );

    g.rect(
      enemy.x - 17 + ox,
      230 + oy,
      34 * hpRatioEnemy,
      5,
      "#ff7b82"
    );
  }

  if (
    S.enemies.length > 0 &&
    minRemaining <= 6
  ){
    const dangerAlpha =
      0.12 +
      (1 - minRemaining / 6) * 0.22;

    g.rect(
      720,
      0,
      240,
      g.H,
      "#ff2d2d" +
        Math.floor(
          dangerAlpha * 255
        )
          .toString(16)
          .padStart(2, "0")
    );
  }

  if (
    S.phase === "defend" &&
    isAtSurface()
  ){
    g.text(
      "左右:照準  action:発射",
      840,
      305,
      15,
      "#ffe39b"
    );

    g.text(
      "⌄",
      S.aimX,
      220,
      24,
      "#80eaff"
    );
  } else if (S.phase === "defend"){
    g.text(
      "地下: 自動砲台が弱めに応戦",
      840,
      305,
      15,
      "#8faabd"
    );
  } else if (S.phase === "warning"){
    g.text(
      "防衛前の帰還猶予",
      840,
      305,
      16,
      "#ffcf6e"
    );
  } else {
    g.text(
      "採掘中は基地安全",
      840,
      305,
      16,
      "#8fffc1"
    );
  }

  g.text(
    "強化ポイント " +
      S.upgradePoints,
    840,
    342,
    17,
    "#ffe66d"
  );

  g.text(
    "🔫" + S.upgrades.power +
      "  🛡️" + S.upgrades.armor,
    840,
    377,
    21,
    "#fff"
  );

  g.text(
    "🚀" + S.upgrades.lift +
      "  ⛏️" + S.upgrades.drill +
      "  🎒" + S.upgrades.carry,
    840,
    411,
    19,
    "#fff"
  );

  g.text(
    "帰還 " +
      S.returnCount +
      "回  購入 " +
      S.upgradeCount +
      "回",
    840,
    447,
    15,
    "#b8cada"
  );

  g.text(
    phaseLabel() +
      " あと " +
      phaseRemaining().toFixed(1) +
      "秒",
    840,
    482,
    19,
    S.phase === "defend"
      ? "#ff747e"
      : S.phase === "warning"
        ? "#ffcf6e"
        : "#9edfff"
  );

  g.text(
    "全体 " +
      Math.max(
        0,
        TOTAL_TIME - S.elapsed
      ).toFixed(1) +
      "秒",
    840,
    510,
    16,
    "#dcecf7"
  );
}

function drawMineHud(g){
  const layer =
    depthLayer(S.player.y);

  g.rect(
    12,
    12,
    390,
    112,
    "#090d14dd"
  );

  g.text(
    "深度 " +
      Math.floor(S.player.y) +
      "m  第" +
      layer +
      "層",
    28,
    34,
    20,
    "#fff",
    "left"
  );

  g.text(
    "荷物 " +
      S.carried.length +
      "個  価値 " +
      S.carriedValue,
    28,
    62,
    19,
    "#ffe66d",
    "left"
  );

  g.text(
    "第" + cycleNumber() +
      "波 " + phaseLabel() +
      "・あと " +
      phaseRemaining().toFixed(1) +
      "秒",
    28,
    88,
    17,
    S.phase === "defend"
      ? "#ff747e"
      : S.phase === "warning"
        ? "#ffcf6e"
        : "#8fffc1",
    "left"
  );

  g.text(
    S.phase === "mining"
      ? "時間終了で帰還警告"
      : S.phase === "warning"
        ? "まもなく敵が来る!"
        : "地上で手動射撃が有効",
    28,
    112,
    15,
    "#c7d5e4",
    "left"
  );

  if (
    S.elapsed >= 45 &&
    !S.emergencyUsed &&
    !isAtSurface()
  ){
    g.rect(
      500,
      475,
      200,
      50,
      "#7a302ddd"
    );

    g.text(
      "🚨 緊急帰還",
      600,
      500,
      21,
      "#fff"
    );
  } else if (S.emergencyUsed){
    g.text(
      "緊急帰還 使用済み",
      700,
      520,
      14,
      "#777",
      "right"
    );
  }

  if (isAtSurface()){
    g.text(
      S.phase === "defend"
        ? "左右で照準・actionで射撃"
        : "↓で採掘開始",
      355,
      148,
      19,
      S.phase === "defend"
        ? "#ffcf6e"
        : "#ffe6a1"
    );
  } else {
    g.text(
      "← ↑ ↓ → で掘る/進む",
      355,
      520,
      18,
      "#d6c7b5"
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

function drawWaveBanner(g){
  if (!S.waveBanner){
    return;
  }

  g.rect(
    125,
    145,
    470,
    66,
    "#08101eee"
  );

  g.text(
    S.waveBanner.text,
    360,
    178,
    29,
    S.phase === "defend"
      ? "#ff837d"
      : S.phase === "warning"
        ? "#ffcf6e"
        : "#8fffc1"
  );
}

function drawWarning(g){
  if (S.phase !== "warning"){
    return;
  }

  const count = Math.max(
    1,
    Math.ceil(phaseRemaining())
  );

  const pulse =
    1 +
    Math.sin(g.time * 12) * 0.06;

  if (
    Math.floor(g.time * 8) % 2 === 0
  ){
    g.rect(
      0,
      0,
      g.W,
      14,
      "#ff344d"
    );

    g.rect(
      0,
      g.H - 14,
      g.W,
      14,
      "#ff344d"
    );

    g.rect(
      0,
      0,
      14,
      g.H,
      "#ff344d"
    );

    g.rect(
      g.W - 14,
      0,
      14,
      g.H,
      "#ff344d"
    );
  }

  g.rect(
    105,
    205,
    510,
    145,
    "#26080dee"
  );

  g.text(
    "⚠ 防衛まで " + count,
    360,
    264,
    44 * pulse,
    "#ffdc6e"
  );

  g.text(
    "地上へ戻れ!",
    360,
    320,
    28,
    "#fff"
  );
}

function drawUpgrade(g){
  g.rect(
    0,
    0,
    MINE_WIDTH,
    g.H,
    "#08101bf2"
  );

  g.text(
    "強化ショップ",
    360,
    55,
    31,
    "#ffe66d"
  );

  g.text(
    "所持ポイント " +
      S.upgradePoints +
      "・何度でも購入可能",
    360,
    94,
    22,
    "#fff"
  );

  g.text(
    "数字キー1〜5 またはカードを選択",
    360,
    126,
    16,
    "#c7d5e4"
  );

  const cardWidth = 126;
  const gap = 10;
  const left = 25;
  const top = 175;
  const height = 205;

  for (let i = 0; i < UPGRADES.length; i++){
    const upgrade = UPGRADES[i];
    const cost =
      upgradeCost(upgrade.id);
    const affordable =
      S.upgradePoints >= cost;
    const x =
      left +
      i * (cardWidth + gap);

    g.rect(
      x,
      top,
      cardWidth,
      height,
      affordable
        ? "#3b5971"
        : "#30333b"
    );

    g.rect(
      x + 4,
      top + 4,
      cardWidth - 8,
      height - 8,
      affordable
        ? "#17283a"
        : "#1d2027"
    );

    g.text(
      String(i + 1),
      x + 12,
      top + 17,
      14,
      "#8fa1b7",
      "left"
    );

    g.emoji(
      upgrade.emoji,
      x + cardWidth / 2,
      top + 50,
      42,
      {
        alpha:
          affordable ? 1 : 0.55,
      }
    );

    g.text(
      upgrade.name,
      x + cardWidth / 2,
      top + 88,
      20,
      affordable
        ? "#fff"
        : "#8c929b"
    );

    g.text(
      "Lv." +
        S.upgrades[upgrade.id],
      x + cardWidth / 2,
      top + 113,
      16,
      "#9edfff"
    );

    g.text(
      upgrade.desc,
      x + cardWidth / 2,
      top + 144,
      12,
      "#c6d2df"
    );

    g.text(
      cost + " pt",
      x + cardWidth / 2,
      top + 178,
      20,
      affordable
        ? "#ffe66d"
        : "#ff858c"
    );

    g.text(
      affordable
        ? "購入可能"
        : "ポイント不足",
      x + cardWidth / 2,
      top + 197,
      12,
      affordable
        ? "#8fffc1"
        : "#a27b80"
    );
  }

  g.rect(
    265,
    430,
    190,
    55,
    "#42546c"
  );

  g.text(
    "戻る  action / Enter",
    360,
    457,
    19,
    "#fff"
  );

  g.text(
    phaseLabel() +
      " あと " +
      phaseRemaining().toFixed(1) +
      "秒",
    360,
    510,
    15,
    "#9eb4c8"
  );
}

function drawTitle(g){
  g.text(
    "⛏️",
    360,
    78,
    78
  );

  g.text(
    "絵文字キーパー",
    360,
    151,
    43,
    "#fff"
  );

  g.text(
    "3回の採掘 → 警告 → 防衛を生き残れ",
    360,
    204,
    23,
    "#ffe66d"
  );

  g.text(
    "採掘中は基地安全。警告が出たら地上へ戻ろう",
    360,
    254,
    19,
    "#8fffc1"
  );

  g.text(
    "地上防衛: 左右で照準・actionで発射",
    360,
    291,
    18,
    "#9cc9e6"
  );

  g.text(
    "資源を持ち帰ると強化ポイントに変換",
    360,
    328,
    18,
    "#ffe39b"
  );

  g.text(
    "強化ポイントは持ち越し・購入回数制限なし",
    360,
    361,
    17,
    "#d8b6ff"
  );

  g.text(
    "← ↑ ↓ → で掘る(穴が空く)・空いた道を歩く",
    360,
    402,
    18,
    "#d5e4ef"
  );

  g.text(
    "クリック または スペースで開始",
    360,
    472,
    23,
    "#fff"
  );

  drawDefenseBand(g, 0, 0);
}

function drawResult(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#050911ee"
  );

  g.text(
    S.won
      ? "🏰 最終防衛に成功!"
      : "🔥 基地が陥落した",
    g.W / 2,
    90,
    42,
    S.won
      ? "#ffe66d"
      : "#ff727d"
  );

  g.text(
    "持ち帰った資源価値  " +
      S.bankedValue,
    g.W / 2,
    165,
    27,
    "#fff"
  );

  g.text(
    "残り強化ポイント  " +
      S.upgradePoints,
    g.W / 2,
    210,
    24,
    "#ffe66d"
  );

  g.text(
    "帰還回数  " +
      S.returnCount,
    g.W / 2,
    250,
    23,
    "#c6d8e8"
  );

  g.text(
    "強化購入回数  " +
      S.upgradeCount,
    g.W / 2,
    288,
    23,
    "#c6d8e8"
  );

  g.text(
    "基地耐久  " +
      Math.ceil(S.baseHp) +
      " / " +
      Math.ceil(S.baseMaxHp),
    g.W / 2,
    326,
    23,
    "#c6d8e8"
  );

  g.text(
    "🔫" + S.upgrades.power +
      "  🛡️" + S.upgrades.armor +
      "  🚀" + S.upgrades.lift +
      "  ⛏️" + S.upgrades.drill +
      "  🎒" + S.upgrades.carry,
    g.W / 2,
    382,
    27,
    "#fff"
  );

  g.text(
    "クリック または スペースでもう一度",
    g.W / 2,
    468,
    22,
    "#fff"
  );
}

EmojiEngine.register({
  id: "horiban",
  name: "絵文字キーパー",
  icon: "⛏️",
  desc: "採掘と防衛を繰り返し、資源で基地を強化する",

  init(g){
    reset(g);
    this._state = S;
  },

  update(g, dt){
    S.pointerX = g.pointer.x;
    S.pointerY = g.pointer.y;

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

    if (S.scene === "upgrade"){
      updateTimeline(g, dt);

      if (S.phase === "defend"){
        updateDefense(g, dt);

        if (S.scene === "over"){
          return;
        }
      }

      if (
        S.phaseElapsed >= S.phaseDuration
      ){
        completePhase(g);

        if (S.scene === "over"){
          return;
        }
      }

      if (
        S.elapsed >= TOTAL_TIME
      ){
        finishGame(
          g,
          S.baseHp > 0
        );
        return;
      }

      updateUpgrade(g);
      return;
    }

    updatePlay(g, dt);
  },

  draw(g){
    g.bg("#0b1119");

    const dying =
      S.baseMaxHp > 0 &&
      S.baseHp /
        S.baseMaxHp <= 0.2;

    const shakePower =
      S.shake > 0
        ? 8 *
          S.shake /
          0.58
        : dying
          ? 1.5
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

    if (S.scene === "title"){
      drawTitle(g);
    } else if (S.scene === "over"){
      drawResult(g);
    } else {
      drawMineBackground(
        g,
        ox,
        oy
      );

      drawPlayer(
        g,
        ox,
        oy
      );

      drawDefenseBand(
        g,
        ox,
        oy
      );

      drawMineHud(g);
      drawFloaters(g, ox, oy);
      drawWaveBanner(g);
      drawWarning(g);

      if (S.scene === "upgrade"){
        drawUpgrade(g);
      }
    }

    if (S.warningFlash > 0){
      g.rect(
        720,
        0,
        240,
        g.H,
        "#ffb02022"
      );
    }

    if (S.redFlash > 0){
      const alpha =
        Math.floor(
          g.clamp(
            S.redFlash / 0.45,
            0,
            1
          ) * 90
        );

      const hex =
        alpha
          .toString(16)
          .padStart(2, "0");

      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#ff2438" + hex
      );
    }

    if (S.whiteFlash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#ffffff33"
      );
    }

    g.text(
      "rev5",
      g.W - 8,
      14,
      12,
      "#ffffff66",
      "right"
    );
  },
});
})();
