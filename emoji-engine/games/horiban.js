/* =====================================================
   掘って守る
   深追いするほど、帰り道は長くなる
===================================================== */
(function(){
"use strict";

const TOTAL_TIME = 90;
const MINE_WIDTH = 720;
const CELL = 48;
const COLS = 14;
const MAX_DEPTH = 1584;
const BASE_UP_SPEED = 60;
const MIN_UP_RATE = 0.4;
const MAX_UPGRADES = 4;

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
    upgradeChoices: [],
    returnCount: 0,

    baseHp: 100,
    baseMaxHp: 100,
    enemies: [],
    enemyId: 0,
    spawnTimer: 4,
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
    text: "第1採掘 / 小規模襲撃",
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

function currentWave(){
  if (S.elapsed < 25){
    return 1;
  }

  if (S.elapsed < 50){
    return 2;
  }

  if (S.elapsed < 75){
    return 3;
  }

  return 4;
}

function waveName(){
  const wave = currentWave();

  if (wave === 1){
    return "第1採掘 / 小規模襲撃";
  }

  if (wave === 2){
    return "第2採掘 / 中規模襲撃";
  }

  if (wave === 3){
    return "第3採掘 / 大規模襲撃";
  }

  return "最終襲撃";
}

function showWave(g, text){
  S.waveBanner = {
    text: text,
    t: 2.1,
  };
  S.warningFlash = 0.4;
  g.se("ping");
}

function checkWaveChange(g, before, after){
  if (before < 25 && after >= 25){
    showWave(
      g,
      "第2採掘 / 中規模襲撃"
    );
  }

  if (before < 50 && after >= 50){
    showWave(
      g,
      "第3採掘 / 大規模襲撃"
    );
  }

  if (before < 75 && after >= 75){
    showWave(
      g,
      "⚠ 最終襲撃 ⚠"
    );
    S.shake = Math.max(S.shake, 0.25);
  }

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
  return 0.48 / (
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
  S.dug.add(cellKey(col, row));
  S.player.col = col;
  S.player.row = row;
  S.player.x = col * CELL + CELL / 2;
  S.player.y = row * CELL;
  S.digTarget = null;
  S.digProgress = 0;

  collectResource(g, col, row);
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
    S.player.col = col;
    S.player.row = row;
    S.player.x = col * CELL + CELL / 2;
    S.player.y = row * CELL;
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

function openUpgradeChoice(g){
  if (
    S.upgradeCount >= MAX_UPGRADES ||
    S.carried.length <= 0
  ){
    S.carried = [];
    S.carriedValue = 0;
    return;
  }

  S.scene = "upgrade";
  S.upgradeChoices = UPGRADES.slice();
  g.se("ping");
}

function returnToBase(g){
  if (S.carried.length <= 0){
    return;
  }

  S.returnCount++;
  S.bankedValue += S.carriedValue;
  S.freeze = Math.max(S.freeze, 5 / 60);
  S.whiteFlash = Math.max(S.whiteFlash, 0.22);

  addFloater(
    355,
    245,
    "帰還成功!  +" + S.carriedValue,
    "#8fffc1",
    30,
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
  openUpgradeChoice(g);
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

function chooseUpgrade(g, index){
  if (
    S.scene !== "upgrade" ||
    index < 0 ||
    index >= S.upgradeChoices.length
  ){
    return;
  }

  const upgrade = S.upgradeChoices[index];

  if (upgrade.id === "armor"){
    const oldMax = S.baseMaxHp;
    S.upgrades.armor++;
    S.baseMaxHp =
      100 *
      (
        1 +
        S.upgrades.armor * 0.2
      );

    S.baseHp +=
      S.baseMaxHp - oldMax;
  } else {
    S.upgrades[upgrade.id]++;
  }

  S.upgradeCount++;
  S.carried = [];
  S.carriedValue = 0;
  S.scene = "play";

  addFloater(
    355,
    190,
    upgrade.emoji + " " +
      upgrade.name +
      " 強化!",
    "#ffe66d",
    29,
    1.1
  );

  g.se("clear");
}

function updateUpgrade(g){
  const cardWidth = 126;
  const gap = 10;
  const left = 25;
  const top = 175;
  const height = 190;

  if (g.pointer.justDown){
    for (
      let i = 0;
      i < S.upgradeChoices.length;
      i++
    ){
      const x =
        left +
        i * (cardWidth + gap);

      if (
        S.pointerX >= x &&
        S.pointerX <= x + cardWidth &&
        S.pointerY >= top &&
        S.pointerY <= top + height
      ){
        chooseUpgrade(g, i);
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
      chooseUpgrade(g, i);
      return;
    }
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

function spawnInterval(){
  const wave = currentWave();

  if (wave === 1){
    return 7;
  }

  if (wave === 2){
    return 5;
  }

  if (wave === 3){
    return 3.4;
  }

  return 2.2;
}

function spawnEnemy(g){
  const wave = currentWave();
  const duration =
    g.rand(10, 15);

  let hp = 13;
  let damage = 9;

  if (wave === 2){
    hp = 20;
    damage = 12;
  } else if (wave === 3){
    hp = 28;
    damage = 15;
  } else if (wave === 4){
    hp = 34;
    damage = 18;
  }

  S.enemies.push({
    id: ++S.enemyId,
    emoji: g.pick([
      "👾",
      "🦂",
    ]),
    x: 938,
    r: 15,
    hp: hp,
    maxHp: hp,
    damage: damage,
    duration: duration,
    remaining: duration,
    warned: false,
  });

  S.warningFlash = Math.max(
    S.warningFlash,
    0.18
  );

  if (wave === 4){
    g.se("ping");
  }
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
  return 9 *
    (
      1 +
      S.upgrades.power * 0.3
    );
}

function updateDefense(g, dt){
  S.spawnTimer -= dt;

  if (S.spawnTimer <= 0){
    spawnEnemy(g);
    S.spawnTimer = spawnInterval();
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
          ? 0.65
          : 0.22;

      target.hp -=
        turretDamage() *
        efficiency;

      S.autoTimer =
        isAtSurface()
          ? 0.55
          : 1.05;

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
        best <= 62
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

      S.manualTimer = 0.28;
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
      enemy.remaining <= 8
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
      enemy.remaining <= 3
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

      // 被弾はしっかり体感できるよう、止め・揺れ・表示のすべてを強めに出す
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

function updatePlay(g, dt){
  const before = S.elapsed;

  S.elapsed = Math.min(
    TOTAL_TIME,
    S.elapsed + dt
  );

  checkWaveChange(
    g,
    before,
    S.elapsed
  );

  updateDefense(g, dt);

  if (S.scene === "over"){
    return;
  }

  updateMining(g, dt);

  if (
    S.elapsed >= TOTAL_TIME &&
    S.baseHp > 0
  ){
    finishGame(g, true);
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
    waveName(),
    840,
    55,
    15,
    currentWave() === 4
      ? "#ff867f"
      : "#a9c7df"
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

    // 近づくほど大きく・危険な色に見せる
    const urgency = g.clamp(
      1 - enemy.remaining / 8,
      0,
      1
    );

    const size =
      31 + urgency * 22;

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
      const blink =
        Math.floor(
          g.time * (enemy.remaining <= 3 ? 8 : 4)
        ) % 2 === 0;

      g.text(
        "⚠",
        enemy.x + ox,
        225 + oy,
        20,
        enemy.remaining <= 3
          ? "#ff5c63"
          : "#ffb36a",
        "center"
      );

      if (blink){
        g.rect(
          enemy.x - size / 2 + ox,
          255 - size / 2 + oy,
          size,
          size,
          enemy.remaining <= 3
            ? "#ff3a4222"
            : "#ffb36a18"
        );
      }
    }

    g.rect(
      enemy.x - 15 + ox,
      232 + oy,
      30,
      4,
      "#30141a"
    );

    g.rect(
      enemy.x - 15 + ox,
      232 + oy,
      30 * hpRatioEnemy,
      4,
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

  if (isAtSurface()){
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
      223,
      24,
      "#80eaff"
    );
  } else {
    g.text(
      "地下では弱い自動砲台",
      840,
      305,
      15,
      "#8faabd"
    );
  }

  g.text(
    "強化",
    840,
    350,
    18,
    "#fff"
  );

  g.text(
    "🔫" + S.upgrades.power +
      "  🛡️" + S.upgrades.armor,
    840,
    382,
    21,
    "#fff"
  );

  g.text(
    "🚀" + S.upgrades.lift +
      "  ⛏️" + S.upgrades.drill +
      "  🎒" + S.upgrades.carry,
    840,
    416,
    19,
    "#fff"
  );

  g.text(
    "帰還 " +
      S.returnCount +
      "回  強化 " +
      S.upgradeCount +
      "/" +
      MAX_UPGRADES,
    840,
    452,
    15,
    "#b8cada"
  );

  g.text(
    "⏱ " +
      Math.max(
        0,
        TOTAL_TIME - S.elapsed
      ).toFixed(1),
    840,
    495,
    26,
    TOTAL_TIME - S.elapsed < 15
      ? "#ff747e"
      : "#fff"
  );
}

function drawMineHud(g){
  const layer =
    depthLayer(S.player.y);

  g.rect(
    12,
    12,
    360,
    86,
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

  const speed =
    moveSpeed();

  g.text(
    "移動速度 " +
      speed.toFixed(1) +
      "px/秒",
    28,
    86,
    16,
    layer === 1
      ? "#8fffc1"
      : "#ffcf75",
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
      "↓で採掘開始",
      355,
      125,
      21,
      "#ffe6a1"
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
    115,
    470,
    66,
    "#08101eee"
  );

  g.text(
    S.waveBanner.text,
    360,
    148,
    29,
    currentWave() === 4
      ? "#ff837d"
      : "#ffe66d"
  );
}

function drawUpgrade(g){
  g.rect(
    0,
    0,
    MINE_WIDTH,
    g.H,
    "#08101bea"
  );

  g.text(
    "帰還資源をすべて使って強化",
    360,
    90,
    31,
    "#ffe66d"
  );

  g.text(
    "1つ選ぶとすぐ採掘へ戻る",
    360,
    127,
    18,
    "#c7d5e4"
  );

  const cardWidth = 126;
  const gap = 10;
  const left = 25;
  const top = 175;
  const height = 190;

  for (
    let i = 0;
    i < S.upgradeChoices.length;
    i++
  ){
    const upgrade =
      S.upgradeChoices[i];

    const x =
      left +
      i * (cardWidth + gap);

    g.rect(
      x,
      top,
      cardWidth,
      height,
      "#283449"
    );

    g.rect(
      x + 4,
      top + 4,
      cardWidth - 8,
      height - 8,
      "#172033"
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
      top + 52,
      45
    );

    g.text(
      upgrade.name,
      x + cardWidth / 2,
      top + 93,
      21,
      "#fff"
    );

    g.text(
      "Lv." +
        S.upgrades[upgrade.id],
      x + cardWidth / 2,
      top + 119,
      16,
      "#9edfff"
    );

    if (upgrade.id === "power"){
      g.text(
        "火力",
        x + cardWidth / 2,
        top + 149,
        15,
        "#c6d2df"
      );

      g.text(
        "+30%",
        x + cardWidth / 2,
        top + 170,
        15,
        "#ffe66d"
      );
    } else if (upgrade.id === "armor"){
      g.text(
        "最大耐久",
        x + cardWidth / 2,
        top + 149,
        15,
        "#c6d2df"
      );

      g.text(
        "+20%",
        x + cardWidth / 2,
        top + 170,
        15,
        "#ffe66d"
      );
    } else if (upgrade.id === "lift"){
      g.text(
        "上昇速度",
        x + cardWidth / 2,
        top + 149,
        15,
        "#c6d2df"
      );

      g.text(
        "+15%",
        x + cardWidth / 2,
        top + 170,
        15,
        "#ffe66d"
      );
    } else if (upgrade.id === "drill"){
      g.text(
        "掘削速度",
        x + cardWidth / 2,
        top + 149,
        15,
        "#c6d2df"
      );

      g.text(
        "+25%",
        x + cardWidth / 2,
        top + 170,
        15,
        "#ffe66d"
      );
    } else {
      g.text(
        "重量軽減",
        x + cardWidth / 2,
        top + 149,
        15,
        "#c6d2df"
      );

      g.text(
        "2.5% / 4%",
        x + cardWidth / 2,
        top + 170,
        14,
        "#ffe66d"
      );
    }
  }
}

function drawTitle(g){
  g.text(
    "⛏️",
    360,
    100,
    92
  );

  g.text(
    "掘って守る",
    360,
    186,
    46,
    "#fff"
  );

  g.text(
    "深追いするほど、帰り道は長くなる",
    360,
    238,
    24,
    "#ffe66d"
  );

  g.text(
    "← ↑ ↓ → で掘り進む。既に掘った道は通れる",
    360,
    303,
    22,
    "#d5e4ef"
  );

  g.text(
    "地上では ← → で照準、actionで発射",
    360,
    340,
    19,
    "#9cc9e6"
  );

  g.text(
    "資源を持つほど、深い層からの上昇が遅くなる",
    360,
    384,
    18,
    "#ffb58b"
  );

  g.text(
    "クリック または スペースで開始",
    360,
    462,
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
      ? "🏰 最終襲撃を防いだ!"
      : "🔥 基地が陥落した",
    g.W / 2,
    105,
    42,
    S.won
      ? "#ffe66d"
      : "#ff727d"
  );

  g.text(
    "採掘価値  " +
      S.bankedValue,
    g.W / 2,
    185,
    29,
    "#fff"
  );

  g.text(
    "帰還回数  " +
      S.returnCount,
    g.W / 2,
    230,
    24,
    "#c6d8e8"
  );

  g.text(
    "強化回数  " +
      S.upgradeCount +
      " / " +
      MAX_UPGRADES,
    g.W / 2,
    270,
    24,
    "#c6d8e8"
  );

  g.text(
    "基地耐久  " +
      Math.ceil(S.baseHp) +
      " / " +
      Math.ceil(S.baseMaxHp),
    g.W / 2,
    310,
    24,
    "#c6d8e8"
  );

  g.text(
    "🔫" + S.upgrades.power +
      "  🛡️" + S.upgrades.armor +
      "  🚀" + S.upgrades.lift +
      "  ⛏️" + S.upgrades.drill +
      "  🎒" + S.upgrades.carry,
    g.W / 2,
    367,
    27,
    "#fff"
  );

  g.text(
    "クリック または スペースでもう一度",
    g.W / 2,
    458,
    22,
    "#fff"
  );
}

EmojiEngine.register({
  id: "horiban",
  name: "掘って守る",
  icon: "⛏️",
  desc: "資源の重さを見きわめて地上へ戻り、基地を守る",

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
      const before = S.elapsed;

      S.elapsed = Math.min(
        TOTAL_TIME,
        S.elapsed + dt
      );

      checkWaveChange(
        g,
        before,
        S.elapsed
      );

      updateDefense(g, dt);

      if (
        S.scene !== "over" &&
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
      "rev3",
      g.W - 8,
      14,
      12,
      "#ffffff66",
      "right"
    );
  },
});
})();
