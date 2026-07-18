/* =====================================================
   絵文字サバイバー
   移動だけで戦い、90秒で最強のビルドを作る
===================================================== */
(function(){
"use strict";

const CARDS = [
  {
    id: "sword",
    emoji: "⚔️",
    name: "双剣",
    desc: "発射数が増える",
  },
  {
    id: "fire",
    emoji: "🔥",
    name: "火の玉",
    desc: "着弾時に範囲爆発",
  },
  {
    id: "boomerang",
    emoji: "🪃",
    name: "ブーメラン",
    desc: "往復して2回攻撃",
  },
  {
    id: "orbit",
    emoji: "🌀",
    name: "守護衛星",
    desc: "近くの敵を削り吹き飛ばす",
  },
  {
    id: "field",
    emoji: "🛡️",
    name: "エネルギーフィールド",
    desc: "至近距離を常時攻撃する結界",
  },
  {
    id: "chain",
    emoji: "⚡",
    name: "連鎖雷",
    desc: "近くの敵へ連鎖",
  },
  {
    id: "missile",
    emoji: "🚀",
    name: "ホーミングミサイル",
    desc: "敵を追尾して確実に命中",
  },
  {
    id: "cold",
    emoji: "❄️",
    name: "冷気",
    desc: "敵が多いほど強い冷気+進化で氷結",
  },
  {
    id: "rapid",
    emoji: "⏩",
    name: "早撃ち",
    desc: "攻撃間隔が短くなる",
  },
  {
    id: "magnet",
    emoji: "🧲",
    name: "磁石",
    desc: "XPを遠くから吸う",
  },
  {
    id: "life",
    emoji: "❤️",
    name: "生命力",
    desc: "最大HP増加と全回復",
  },
];

const ENEMY_TYPES = {
  slime: {
    emoji: "🟢",
    size: 34,
    r: 15,
    hp: 1,
    speed: 64,
    xp: 1,
  },
  bat: {
    emoji: "🦇",
    size: 38,
    r: 16,
    hp: 2,
    speed: 92,
    xp: 1.2,
  },
  zombie: {
    emoji: "🧟",
    size: 43,
    r: 19,
    hp: 4,
    speed: 54,
    xp: 1.8,
  },
  ghost: {
    emoji: "👻",
    size: 42,
    r: 18,
    hp: 6,
    speed: 76,
    xp: 2.2,
  },
  ogre: {
    emoji: "👹",
    size: 72,
    r: 30,
    hp: 55,
    speed: 40,
    xp: 7,
  },
};

const MIDBOSS_TYPE = {
  emoji: "🐲",
  size: 118,
  r: 48,
  hp: 260,
  speed: 46,
  xp: 30,
};

const STAGE1_BOSS_TYPE = {
  emoji: "🦖",
  size: 134,
  r: 53,
  hp: 470,
  speed: 43,
  xp: 42,
};

const STAGE2_BOSS_TYPE = {
  emoji: "🐙",
  size: 150,
  r: 59,
  hp: 730,
  speed: 41,
  xp: 60,
};

const STAGE3_BOSS_TYPE = {
  emoji: "👽",
  size: 164,
  r: 65,
  hp: 1150,
  speed: 47,
  xp: 90,
};

const STAGE4_BOSS_TYPE = {
  emoji: "🕳️",
  size: 176,
  r: 70,
  hp: 1650,
  speed: 50,
  xp: 120,
};

/* ステージ2以降の縄張り。同じ進行曲線に別の顔をあてがう */
const STAGE2_ENEMY_TYPES = {
  slime: {
    emoji: "🐛",
    size: 34,
    r: 15,
    hp: 1,
    speed: 64,
    xp: 1,
  },
  bat: {
    emoji: "🦟",
    size: 34,
    r: 15,
    hp: 2,
    speed: 92,
    xp: 1.2,
  },
  zombie: {
    emoji: "🦂",
    size: 43,
    r: 19,
    hp: 4,
    speed: 54,
    xp: 1.8,
  },
  ghost: {
    emoji: "🕷️",
    size: 42,
    r: 18,
    hp: 6,
    speed: 76,
    xp: 2.2,
  },
  ogre: {
    emoji: "🦑",
    size: 74,
    r: 31,
    hp: 65,
    speed: 40,
    xp: 8,
  },
};

/* ステージ3=機械遺跡の縄張り。ステージ2と同じ進行曲線に別の顔をあてがう */
const STAGE3_ENEMY_TYPES = {
  slime: {
    emoji: "⚙️",
    size: 34,
    r: 15,
    hp: 1,
    speed: 64,
    xp: 1,
  },
  bat: {
    emoji: "🛸",
    size: 34,
    r: 15,
    hp: 2,
    speed: 92,
    xp: 1.2,
  },
  zombie: {
    emoji: "🤖",
    size: 43,
    r: 19,
    hp: 4,
    speed: 54,
    xp: 1.8,
  },
  ghost: {
    emoji: "👁️",
    size: 42,
    r: 18,
    hp: 6,
    speed: 76,
    xp: 2.2,
  },
  ogre: {
    emoji: "🗿",
    size: 74,
    r: 31,
    hp: 65,
    speed: 40,
    xp: 8,
  },
};

/* ステージ4=深宇宙の縄張り。同じ進行曲線に別の顔をあてがう */
const STAGE4_ENEMY_TYPES = {
  slime: {
    emoji: "⭐",
    size: 34,
    r: 15,
    hp: 1,
    speed: 64,
    xp: 1,
  },
  bat: {
    emoji: "☄️",
    size: 34,
    r: 15,
    hp: 2,
    speed: 92,
    xp: 1.2,
  },
  zombie: {
    emoji: "🌑",
    size: 43,
    r: 19,
    hp: 4,
    speed: 54,
    xp: 1.8,
  },
  ghost: {
    emoji: "🌀",
    size: 42,
    r: 18,
    hp: 6,
    speed: 76,
    xp: 2.2,
  },
  ogre: {
    emoji: "🐋",
    size: 74,
    r: 31,
    hp: 65,
    speed: 40,
    xp: 8,
  },
};

/* EXの連続ボスは毎回この中からランダムに選ぶ(いろんな見た目のボスが出るように) */
const EX_BOSS_POOL = [
  MIDBOSS_TYPE,
  STAGE1_BOSS_TYPE,
  STAGE2_BOSS_TYPE,
  STAGE3_BOSS_TYPE,
  STAGE4_BOSS_TYPE,
];

const ENEMY_CAP = 45;
const SHOT_CAP = 60;

let S;

function getCard(id){
  return CARDS.find(
    card => card.id === id
  );
}

function cardLevel(id){
  return S.cards[id] || 0;
}

function isEvolved(id){
  return cardLevel(id) >= 3;
}

function evolutionPower(id){
  return isEvolved(id) ? 1.8 : 1;
}

function addEffect(effect){
  if (S.effects.length >= 40){
    S.effects.shift();
  }

  S.effects.push(effect);
}

function addFloater(x, y, text, color, size, life){
  addEffect({
    type: "text",
    x: x,
    y: y,
    text: text,
    color: color || "#fff",
    size: size || 22,
    t: life === undefined ? 0.65 : life,
    maxT: life === undefined ? 0.65 : life,
  });
}

function addSpark(x, y, emoji, size, life, color){
  addEffect({
    type: "spark",
    x: x,
    y: y,
    vx: Math.random() * 180 - 90,
    vy: Math.random() * 180 - 120,
    emoji: emoji || "✨",
    size: size || 22,
    color: color || "#fff",
    t: life === undefined ? 0.45 : life,
    maxT: life === undefined ? 0.45 : life,
  });
}

function addBurst(g, x, y, emoji, count, size){
  for (let i = 0; i < count; i++){
    addEffect({
      type: "spark",
      x: x,
      y: y,
      vx: g.rand(-180, 180),
      vy: g.rand(-200, 100),
      emoji: emoji,
      size: size || g.rand(16, 28),
      color: "#fff",
      t: g.rand(0.35, 0.7),
      maxT: 0.7,
    });
  }
}

function updateEffects(dt){
  for (const effect of S.effects){
    effect.t -= dt;

    if (effect.type === "text"){
      effect.y -= 34 * dt;
    } else {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vy += 180 * dt;
    }
  }

  S.effects = S.effects.filter(
    effect => effect.t > 0
  );

  S.shake = Math.max(
    0,
    S.shake - dt
  );

  S.flash = Math.max(
    0,
    S.flash - dt
  );

  S.hitFlash = Math.max(
    0,
    S.hitFlash - dt
  );

  S.goldFlash = Math.max(
    0,
    S.goldFlash - dt
  );

  if (S.killBanner){
    S.killBanner.t -= dt;

    if (S.killBanner.t <= 0){
      S.killBanner = null;
    }
  }
}

function makeBuild(){
  const result = {};

  for (const card of CARDS){
    result[card.id] = 0;
  }

  return result;
}

function makeWeights(){
  const result = {};

  for (const card of CARDS){
    result[card.id] = 1;
  }

  return result;
}

function reset(g){
  S = {
    scene: "title",

    player: {
      x: g.W / 2,
      y: g.H / 2,
      r: 18,
      hp: 4,
      maxHp: 4,
      invincible: 0,
      knockTimer: 0,
      knockX: 0,
      knockY: 0,
    },

    enemies: [],
    shots: [],
    enemyShots: [],
    xpOrbs: [],
    effects: [],

    cards: makeBuild(),
    cardWeights: makeWeights(),
    choices: [],

    elapsed: 0,
    level: 0,
    xp: 0,
    nextXp: 5,
    stage: 1,
    stage2StartElapsed: 0,
    stage3StartElapsed: 0,
    stage4StartElapsed: 0,

    spawnTimer: 0.3,
    attackTimer: 0.15,
    coldTimer: 2,
    coldLastSoundAt: -999,
    enemyId: 0,
    midbossSpawned: false,
    stage1BossSpawned: false,
    stage2BossSpawned: false,
    stage3BossSpawned: false,
    stage4BossSpawned: false,
    exBossTimer: 0,
    exBossCount: 0,
    chest: null,
    levelChoiceTimer: 0,

    kills: 0,
    killChain: 0,
    maxKillChain: 0,
    chainTimer: 0,
    killBanner: null,

    freeze: 0,
    shake: 0,
    flash: 0,
    hitFlash: 0,
    goldFlash: 0,

    endedByTime: false,
  };
}

function startGame(g){
  reset(g);
  S.scene = "play";
  g.bgm("battle");
  g.se("click");
}

function finishGame(g, endedByTime){
  if (S.scene === "over"){
    return;
  }

  S.endedByTime = endedByTime;
  S.scene = "over";
  S.freeze = 0;
  S.shake = 0.2;
  g.bgm(false);

  if (endedByTime){
    g.se("clear");
  } else {
    g.se("boom");
  }
}

function isDenseZone(g, x, y){
  return (
    x < 80 ||
    x > g.W - 80 ||
    y < 80 ||
    y > g.H - 80
  );
}

function enemyTemplate(g){
  const t = S.elapsed;
  const roll = g.rand(0, 1);
  const table =
    S.stage >= 4
      ? STAGE4_ENEMY_TYPES
      : S.stage === 3
        ? STAGE3_ENEMY_TYPES
        : S.stage === 2
          ? STAGE2_ENEMY_TYPES
          : ENEMY_TYPES;

  if (t < 15){
    return table.slime;
  }

  if (t < 35){
    if (roll < 0.67){
      return table.slime;
    }

    if (roll < 0.88){
      return table.bat;
    }

    return table.zombie;
  }

  if (t < 55){
    if (roll < 0.35){
      return table.slime;
    }

    if (roll < 0.6){
      return table.bat;
    }

    if (roll < 0.88){
      return table.zombie;
    }

    return table.ghost;
  }

  if (roll < 0.18){
    return table.slime;
  }

  if (roll < 0.4){
    return table.bat;
  }

  if (roll < 0.68){
    return table.zombie;
  }

  if (roll < 0.9){
    return table.ghost;
  }

  return table.ogre;
}

function spawnInterval(){
  const t = S.elapsed;

  if (t >= 50 && t < 55){
    return 2.4;
  }

  if (t < 15){
    return Math.max(
      0.42,
      0.72 - t * 0.012
    );
  }

  if (t < 50){
    return Math.max(
      0.25,
      0.48 - (t - 15) * 0.005
    );
  }

  if (t < 75){
    return 0.19;
  }

  return 0.16;
}

function removeFarEnemy(g){
  let index = -1;
  let bestScore = -1;

  for (let i = 0; i < S.enemies.length; i++){
    const enemy = S.enemies[i];

    if (enemy.boss){
      continue;
    }

    const outside =
      enemy.x < -10 ||
      enemy.x > g.W + 10 ||
      enemy.y < -10 ||
      enemy.y > g.H + 10;

    const score =
      g.dist(enemy, S.player) +
      (outside ? 10000 : 0);

    if (score > bestScore){
      bestScore = score;
      index = i;
    }
  }

  if (index >= 0){
    S.enemies.splice(index, 1);
  }
}

function spawnEnemy(g){
  if (S.enemies.length >= ENEMY_CAP){
    removeFarEnemy(g);
    return;
  }

  const template = enemyTemplate(g);
  const side = Math.floor(g.rand(0, 4));
  const inset = g.rand(18, 55);
  let x;
  let y;

  if (side === 0){
    x = g.rand(25, g.W - 25);
    y = inset;
  } else if (side === 1){
    x = g.W - inset;
    y = g.rand(25, g.H - 25);
  } else if (side === 2){
    x = g.rand(25, g.W - 25);
    y = g.H - inset;
  } else {
    x = inset;
    y = g.rand(25, g.H - 25);
  }

  const dx = x - S.player.x;
  const dy = y - S.player.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 150){
    const scale = 150 / Math.max(1, distance);
    x = S.player.x + dx * scale;
    y = S.player.y + dy * scale;
    x = g.clamp(x, 20, g.W - 20);
    y = g.clamp(y, 20, g.H - 20);
  }

  const hpScale =
    1 +
    Math.max(0, S.elapsed - 20) * 0.012;

  S.enemies.push({
    id: ++S.enemyId,
    x: x,
    y: y,
    r: template.r,
    emoji: template.emoji,
    size: template.size,
    hp: template.hp * hpScale,
    maxHp: template.hp * hpScale,
    speed: template.speed *
      (1 + S.elapsed * 0.0025),
    xp: template.xp,
    slow: 0,
    orbitCooldown: 0,
    fieldCooldown: 0,
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    frozen: 0,
  });
}

function spawnMidboss(g){
  S.midbossSpawned = true;

  S.enemies.push({
    id: ++S.enemyId,
    x: g.W / 2,
    y: 130,
    r: MIDBOSS_TYPE.r,
    emoji: MIDBOSS_TYPE.emoji,
    size: MIDBOSS_TYPE.size,
    hp: MIDBOSS_TYPE.hp,
    maxHp: MIDBOSS_TYPE.hp,
    speed: MIDBOSS_TYPE.speed,
    xp: MIDBOSS_TYPE.xp,
    slow: 0,
    orbitCooldown: 0,
    fieldCooldown: 0,
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    frozen: 0,
    boss: true,
    attackTimer: 2.0,
    bossKind: "mid",
  });

  addFloater(
    g.W / 2,
    200,
    "⚠ 中ボス出現 ⚠",
    "#ff9b6a",
    34,
    1.3
  );

  S.shake = Math.max(S.shake, 0.25);
  g.se("boom");
}

function spawnStage1Boss(g){
  S.stage1BossSpawned = true;

  S.enemies.push({
    id: ++S.enemyId,
    x: g.W / 2,
    y: 130,
    r: STAGE1_BOSS_TYPE.r,
    emoji: STAGE1_BOSS_TYPE.emoji,
    size: STAGE1_BOSS_TYPE.size,
    hp: STAGE1_BOSS_TYPE.hp,
    maxHp: STAGE1_BOSS_TYPE.hp,
    speed: STAGE1_BOSS_TYPE.speed,
    xp: STAGE1_BOSS_TYPE.xp,
    slow: 0,
    orbitCooldown: 0,
    fieldCooldown: 0,
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    frozen: 0,
    boss: true,
    attackTimer: 2.0,
    bossKind: "stage1",
  });

  addFloater(
    g.W / 2,
    200,
    "⚠ ステージ1ボス出現 ⚠",
    "#ff6a6a",
    34,
    1.3
  );

  S.shake = Math.max(S.shake, 0.32);
  S.flash = Math.max(S.flash, 0.18);
  g.se("boom");
}

function spawnStage2Boss(g){
  S.stage2BossSpawned = true;

  S.enemies.push({
    id: ++S.enemyId,
    x: g.W / 2,
    y: 130,
    r: STAGE2_BOSS_TYPE.r,
    emoji: STAGE2_BOSS_TYPE.emoji,
    size: STAGE2_BOSS_TYPE.size,
    hp: STAGE2_BOSS_TYPE.hp,
    maxHp: STAGE2_BOSS_TYPE.hp,
    speed: STAGE2_BOSS_TYPE.speed,
    xp: STAGE2_BOSS_TYPE.xp,
    slow: 0,
    orbitCooldown: 0,
    fieldCooldown: 0,
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    frozen: 0,
    boss: true,
    attackTimer: 2.0,
    bossKind: "stage2",
  });

  addFloater(
    g.W / 2,
    200,
    "⚠ ステージ2ボス出現 ⚠",
    "#c9a2ff",
    34,
    1.3
  );

  S.shake = Math.max(S.shake, 0.38);
  S.flash = Math.max(S.flash, 0.22);
  g.se("boom");
}

function enterStage2(g){
  S.stage = 2;
  S.stage2StartElapsed = S.elapsed;

  addFloater(
    g.W / 2,
    205,
    "ステージ1ボス撃破!",
    "#ffe66d",
    32,
    1.5
  );

  addFloater(
    g.W / 2,
    250,
    "STAGE 2 突入!",
    "#8deaff",
    36,
    1.5
  );

  S.shake = Math.max(S.shake, 0.3);
  S.flash = Math.max(S.flash, 0.3);
  g.se("clear");
}

function spawnStage3Boss(g){
  S.stage3BossSpawned = true;

  S.enemies.push({
    id: ++S.enemyId,
    x: g.W / 2,
    y: 130,
    r: STAGE3_BOSS_TYPE.r,
    emoji: STAGE3_BOSS_TYPE.emoji,
    size: STAGE3_BOSS_TYPE.size,
    hp: STAGE3_BOSS_TYPE.hp,
    maxHp: STAGE3_BOSS_TYPE.hp,
    speed: STAGE3_BOSS_TYPE.speed,
    xp: STAGE3_BOSS_TYPE.xp,
    slow: 0,
    orbitCooldown: 0,
    fieldCooldown: 0,
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    frozen: 0,
    boss: true,
    attackTimer: 2.0,
    bossKind: "stage3",
  });

  addFloater(
    g.W / 2,
    200,
    "⚠ ステージ3ボス出現 ⚠",
    "#8affc1",
    34,
    1.3
  );

  S.shake = Math.max(S.shake, 0.42);
  S.flash = Math.max(S.flash, 0.25);
  g.se("boom");
}

function enterStage3(g){
  S.stage = 3;
  S.stage3StartElapsed = S.elapsed;

  addFloater(
    g.W / 2,
    205,
    "ステージ2ボス撃破!",
    "#ffe66d",
    32,
    1.5
  );

  addFloater(
    g.W / 2,
    250,
    "STAGE 3 突入!",
    "#8affc1",
    36,
    1.5
  );

  S.shake = Math.max(S.shake, 0.32);
  S.flash = Math.max(S.flash, 0.32);
  g.se("clear");
}

function spawnStage4Boss(g){
  S.stage4BossSpawned = true;

  S.enemies.push({
    id: ++S.enemyId,
    x: g.W / 2,
    y: 130,
    r: STAGE4_BOSS_TYPE.r,
    emoji: STAGE4_BOSS_TYPE.emoji,
    size: STAGE4_BOSS_TYPE.size,
    hp: STAGE4_BOSS_TYPE.hp,
    maxHp: STAGE4_BOSS_TYPE.hp,
    speed: STAGE4_BOSS_TYPE.speed,
    xp: STAGE4_BOSS_TYPE.xp,
    slow: 0,
    orbitCooldown: 0,
    fieldCooldown: 0,
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    frozen: 0,
    boss: true,
    attackTimer: 2.0,
    bossKind: "stage4",
  });

  addFloater(
    g.W / 2,
    200,
    "⚠ ステージ4ボス出現 ⚠",
    "#8ab4ff",
    34,
    1.3
  );

  S.shake = Math.max(S.shake, 0.46);
  S.flash = Math.max(S.flash, 0.28);
  g.se("boom");
}

function enterStage4(g){
  S.stage = 4;
  S.stage4StartElapsed = S.elapsed;

  addFloater(
    g.W / 2,
    205,
    "ステージ3ボス撃破!",
    "#ffe66d",
    32,
    1.5
  );

  addFloater(
    g.W / 2,
    250,
    "STAGE 4 突入!",
    "#8ab4ff",
    36,
    1.5
  );

  S.shake = Math.max(S.shake, 0.34);
  S.flash = Math.max(S.flash, 0.34);
  g.se("clear");
}

function enterExStage(g){
  S.stage = 5;
  S.exBossTimer = 25;

  addFloater(
    g.W / 2,
    205,
    "ステージ4ボス撃破!",
    "#ffe66d",
    32,
    1.5
  );

  addFloater(
    g.W / 2,
    250,
    "全ステージ制覇! EX突入",
    "#c9a2ff",
    36,
    1.7
  );

  S.shake = Math.max(S.shake, 0.36);
  S.flash = Math.max(S.flash, 0.35);
  g.se("clear");
}

function spawnExBoss(g){
  S.exBossCount++;

  const scale =
    1 + S.exBossCount * 0.35;

  const base = g.pick(EX_BOSS_POOL);

  S.enemies.push({
    id: ++S.enemyId,
    x: g.W / 2,
    y: 130,
    r: base.r,
    emoji: base.emoji,
    size: base.size,
    hp: base.hp * scale,
    maxHp: base.hp * scale,
    speed: base.speed *
      (1 + S.exBossCount * 0.06),
    xp: base.xp * scale,
    slow: 0,
    orbitCooldown: 0,
    fieldCooldown: 0,
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    frozen: 0,
    boss: true,
    attackTimer: 2.0,
    bossKind: "ex",
  });

  addFloater(
    g.W / 2,
    200,
    "⚠ EXボス出現 ⚠",
    "#c9a2ff",
    34,
    1.3
  );

  S.shake = Math.max(S.shake, 0.4);
  S.flash = Math.max(S.flash, 0.25);
  g.se("boom");
}

function nearestEnemy(g, x, y, exceptIds, maxDistance){
  let target = null;
  let best = maxDistance === undefined
    ? Infinity
    : maxDistance;

  for (const enemy of S.enemies){
    if (
      enemy.dead ||
      (exceptIds &&
        exceptIds.indexOf(enemy.id) >= 0)
    ){
      continue;
    }

    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distance = Math.hypot(dx, dy);

    if (distance < best){
      best = distance;
      target = enemy;
    }
  }

  return target;
}

function addShot(shot){
  if (S.shots.length >= SHOT_CAP){
    return false;
  }

  S.shots.push(shot);
  return true;
}

function fireVolley(g){
  if (S.shots.length >= SHOT_CAP){
    return;
  }

  const target = nearestEnemy(
    g,
    S.player.x,
    S.player.y
  );

  if (!target){
    return;
  }

  const dx = target.x - S.player.x;
  const dy = target.y - S.player.y;
  const baseAngle = Math.atan2(dy, dx);
  const swordLevel = cardLevel("sword");
  const shotCount = Math.min(
    9,
    1 + swordLevel
  );

  const spreadStep =
    0.17 * Math.min(1, 5 / shotCount);

  const damage =
    isEvolved("sword") ? 1.8 : 1;

  for (let i = 0; i < shotCount; i++){
    const spread =
      shotCount <= 1
        ? 0
        : (i - (shotCount - 1) / 2) * spreadStep;

    const angle = baseAngle + spread;

    if (!addShot({
      type: "normal",
      x: S.player.x,
      y: S.player.y,
      r: 7,
      vx: Math.cos(angle) * 470,
      vy: Math.sin(angle) * 470,
      damage: damage,
      life: 1.8,
      dead: false,
    })){
      break;
    }
  }

  if (cardLevel("boomerang") > 0){
    const power =
      (0.7 + cardLevel("boomerang") * 0.35) *
      evolutionPower("boomerang");

    const boomerangCount =
      isEvolved("boomerang") ? 2 : 1;

    for (let i = 0; i < boomerangCount; i++){
      const spread =
        boomerangCount <= 1
          ? 0
          : (i - (boomerangCount - 1) / 2) * 0.6;

      const angle = baseAngle + spread;

      addShot({
        type: "boomerang",
        x: S.player.x,
        y: S.player.y,
        r: 13,
        vx: Math.cos(angle) * 330,
        vy: Math.sin(angle) * 330,
        damage: power,
        life: 1.25,
        age: 0,
        returning: false,
        hitOut: [],
        hitBack: [],
        dead: false,
      });
    }
  }

  if (cardLevel("missile") > 0){
    const missileLevel = cardLevel("missile");
    const missileCount = Math.min(
      3,
      1 + Math.floor(missileLevel / 3)
    );

    const missileDamage =
      (1.0 + missileLevel * 0.5) *
      evolutionPower("missile");

    for (let i = 0; i < missileCount; i++){
      const missileTarget = nearestEnemy(
        g,
        S.player.x,
        S.player.y
      );

      if (!missileTarget){
        break;
      }

      const angle0 = Math.atan2(
        missileTarget.y - S.player.y,
        missileTarget.x - S.player.x
      );

      addShot({
        type: "missile",
        x: S.player.x,
        y: S.player.y,
        r: 9,
        vx: Math.cos(angle0) * 340,
        vy: Math.sin(angle0) * 340,
        damage: missileDamage,
        life: 3,
        targetId: missileTarget.id,
        dead: false,
      });
    }
  }

  if (isEvolved("rapid")){
    S.goldFlash = Math.max(
      S.goldFlash,
      0.05
    );
  }

  g.se("jump");
}

function attackInterval(){
  let interval = 0.15;
  const rapidLevel = cardLevel("rapid");

  interval *= Math.pow(
    0.85,
    rapidLevel
  );

  if (isEvolved("rapid")){
    interval *= 0.82;
  }

  if (S.elapsed >= 75){
    interval /= 1.5;
  }

  return Math.max(
    0.045,
    interval
  );
}

function addXpOrb(g, enemy){
  const edgeBonus = isDenseZone(
    g,
    enemy.x,
    enemy.y
  ) ? 1.3 : 1;

  const value = enemy.xp * edgeBonus;

  if (S.xpOrbs.length >= 50){
    let nearest = null;
    let best = Infinity;

    for (const orb of S.xpOrbs){
      const distance = g.dist(orb, enemy);

      if (distance < best){
        best = distance;
        nearest = orb;
      }
    }

    if (nearest){
      nearest.value += value;
      nearest.size = Math.min(
        32,
        nearest.size + 1
      );
    }

    return;
  }

  S.xpOrbs.push({
    x: enemy.x,
    y: enemy.y,
    r: 10,
    value: value,
    size: edgeBonus > 1 ? 25 : 21,
    edgeBonus: edgeBonus > 1,
    dead: false,
  });
}

function showKillBanner(count){
  let text = null;
  let color = "#fff";

  if (count >= 30){
    text = "MASSACRE! x" + count;
    color = "#ffdf62";
  } else if (count >= 20){
    text = "x20 連続撃破!";
    color = "#ff9d5c";
  } else if (count >= 10){
    text = "x10 連続撃破!";
    color = "#8deaff";
  }

  if (text){
    S.killBanner = {
      text: text,
      color: color,
      t: 0.7,
      maxT: 0.7,
    };
  }
}

function damageEnemy(g, enemy, damage, source){
  if (
    !enemy ||
    enemy.dead ||
    damage <= 0
  ){
    return false;
  }

  enemy.hp -= damage;

  if (enemy.hp > 0){
    if (source !== "orbit"){
      addSpark(
        enemy.x,
        enemy.y,
        "💥",
        16,
        0.2
      );
    }

    return false;
  }

  enemy.dead = true;
  S.kills++;
  S.killChain++;
  S.chainTimer = 1.25;
  S.maxKillChain = Math.max(
    S.maxKillChain,
    S.killChain
  );

  addXpOrb(g, enemy);
  addFloater(
    enemy.x,
    enemy.y - 12,
    "+" + enemy.xp.toFixed(
      enemy.xp % 1 ? 1 : 0
    ) + " XP",
    "#ffe66d",
    18,
    0.55
  );

  addSpark(
    enemy.x,
    enemy.y,
    "✨",
    22,
    0.35
  );

  showKillBanner(S.killChain);

  S.freeze = Math.max(
    S.freeze,
    S.killChain >= 10 ? 0.08 : 0.05
  );

  g.se("coin");

  if (enemy.boss){
    S.freeze = 0.3;
    S.shake = 0.3;
    S.flash = 0.3;

    addBurst(
      g,
      enemy.x,
      enemy.y,
      "💥",
      16,
      32
    );

    if (enemy.bossKind === "mid"){
      addFloater(
        enemy.x,
        enemy.y - 60,
        "中ボス撃破!",
        "#ffe66d",
        36,
        1.2
      );
    } else if (enemy.bossKind === "stage1"){
      enterStage2(g);
    } else if (enemy.bossKind === "stage2"){
      enterStage3(g);
    } else if (enemy.bossKind === "stage3"){
      enterStage4(g);
    } else if (enemy.bossKind === "stage4"){
      enterExStage(g);
    } else if (enemy.bossKind === "ex"){
      addFloater(
        g.W / 2,
        210,
        "EXボス撃破!",
        "#c9a2ff",
        34,
        1.3
      );
    }

    g.se("clear");
    openChest(g);
  }

  return true;
}

function explode(g, x, y, damage, radius){
  addBurst(
    g,
    x,
    y,
    "🔥",
    5,
    24
  );

  S.shake = Math.max(
    S.shake,
    0.08
  );

  const center = {
    x: x,
    y: y,
    r: radius,
  };

  for (const enemy of S.enemies){
    if (
      !enemy.dead &&
      g.hit(center, enemy)
    ){
      damageEnemy(
        g,
        enemy,
        damage,
        "fire"
      );
    }
  }
}

function chainLightning(g, firstEnemy, damage){
  const count =
    1 + cardLevel("chain") +
    (isEvolved("chain") ? 2 : 0);

  const used = [firstEnemy.id];
  let from = firstEnemy;

  for (let i = 0; i < count; i++){
    const next = nearestEnemy(
      g,
      from.x,
      from.y,
      used,
      145 + cardLevel("chain") * 12
    );

    if (!next){
      break;
    }

    used.push(next.id);

    const steps = 4;

    for (let s = 1; s < steps; s++){
      const ratio = s / steps;
      const jitter = g.rand(-16, 16);
      const dx = next.x - from.x;
      const dy = next.y - from.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const px = -dy / len;
      const py = dx / len;

      addEffect({
        type: "text",
        x: from.x + dx * ratio + px * jitter,
        y: from.y + dy * ratio + py * jitter,
        text: "⚡",
        color: "#ffffff",
        size: 22,
        t: 0.3,
        maxT: 0.3,
      });
    }

    addEffect({
      type: "text",
      x: next.x,
      y: next.y - 18,
      text: "⚡",
      color: "#fff49a",
      size: 40,
      t: 0.32,
      maxT: 0.32,
    });

    damageEnemy(
      g,
      next,
      damage *
        Math.pow(0.78, i),
      "chain"
    );

    from = next;
  }
}

function projectileHit(g, shot, enemy){
  damageEnemy(
    g,
    enemy,
    shot.damage,
    shot.type
  );

  const fireLevel = cardLevel("fire");

  if (fireLevel > 0){
    const radius =
      (32 + fireLevel * 10) *
      evolutionPower("fire");

    const damage =
      (0.45 + fireLevel * 0.3) *
      evolutionPower("fire");

    explode(
      g,
      enemy.x,
      enemy.y,
      damage,
      radius
    );
  }

  const chainLevel = cardLevel("chain");

  if (chainLevel > 0){
    chainLightning(
      g,
      enemy,
      (0.35 + chainLevel * 0.24) *
        evolutionPower("chain")
    );
  }
}

function updateNormalShot(g, shot, dt){
  shot.x += shot.vx * dt;
  shot.y += shot.vy * dt;
  shot.life -= dt;

  for (const enemy of S.enemies){
    if (
      enemy.dead ||
      !g.hit(shot, enemy)
    ){
      continue;
    }

    projectileHit(g, shot, enemy);
    shot.dead = true;
    break;
  }
}

function updateBoomerang(g, shot, dt){
  shot.age += dt;
  shot.life -= dt;

  if (
    !shot.returning &&
    shot.age >= 0.45
  ){
    shot.returning = true;
  }

  if (shot.returning){
    const dx = S.player.x - shot.x;
    const dy = S.player.y - shot.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 24){
      shot.dead = true;
      return;
    }

    shot.vx = dx /
      Math.max(1, distance) * 390;
    shot.vy = dy /
      Math.max(1, distance) * 390;
  }

  shot.x += shot.vx * dt;
  shot.y += shot.vy * dt;

  if (!shot.returning){
    const perpAngle =
      Math.atan2(shot.vy, shot.vx) +
      Math.PI / 2;

    const curve =
      Math.sin(shot.age * 6) * 220;

    shot.x += Math.cos(perpAngle) *
      curve * dt;
    shot.y += Math.sin(perpAngle) *
      curve * dt;
  }

  const hitList = shot.returning
    ? shot.hitBack
    : shot.hitOut;

  for (const enemy of S.enemies){
    if (
      enemy.dead ||
      hitList.indexOf(enemy.id) >= 0 ||
      !g.hit(shot, enemy)
    ){
      continue;
    }

    hitList.push(enemy.id);
    projectileHit(g, shot, enemy);
  }
}

function updateMissile(g, shot, dt){
  const target = S.enemies.find(
    enemy =>
      enemy.id === shot.targetId &&
      !enemy.dead
  );

  const speed = 340;
  const turnRate = 6;

  const curAngle = Math.atan2(
    shot.vy,
    shot.vx
  );

  let desiredAngle = curAngle;

  if (target){
    desiredAngle = Math.atan2(
      target.y - shot.y,
      target.x - shot.x
    );
  }

  let diff = desiredAngle - curAngle;

  while (diff > Math.PI){
    diff -= Math.PI * 2;
  }

  while (diff < -Math.PI){
    diff += Math.PI * 2;
  }

  const maxTurn = turnRate * dt;

  const newAngle =
    curAngle +
    Math.max(
      -maxTurn,
      Math.min(maxTurn, diff)
    );

  shot.vx = Math.cos(newAngle) * speed;
  shot.vy = Math.sin(newAngle) * speed;
  shot.x += shot.vx * dt;
  shot.y += shot.vy * dt;
  shot.life -= dt;

  for (const enemy of S.enemies){
    if (
      enemy.dead ||
      !g.hit(shot, enemy)
    ){
      continue;
    }

    projectileHit(g, shot, enemy);
    shot.dead = true;
    break;
  }
}

function updateShots(g, dt){
  for (const shot of S.shots){
    if (shot.type === "boomerang"){
      updateBoomerang(g, shot, dt);
    } else if (shot.type === "missile"){
      updateMissile(g, shot, dt);
    } else {
      updateNormalShot(g, shot, dt);
    }

    if (
      shot.life <= 0 ||
      shot.x < -100 ||
      shot.x > g.W + 100 ||
      shot.y < -100 ||
      shot.y > g.H + 100
    ){
      shot.dead = true;
    }
  }

  S.shots = S.shots.filter(
    shot => !shot.dead
  );

  if (S.shots.length > SHOT_CAP){
    S.shots.length = SHOT_CAP;
  }
}

function updatePlayer(g, dt){
  const player = S.player;
  const speed = 245;
  let inputX = g.stickX();
  let inputY = g.stickY();

  if (g.pointer.down){
    const dx = g.pointer.x - player.x;
    const dy = g.pointer.y - player.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 8){
      inputX = dx / distance;
      inputY = dy / distance;
    } else {
      inputX = 0;
      inputY = 0;
    }
  }

  const inputLength = Math.hypot(
    inputX,
    inputY
  );

  if (inputLength > 1){
    inputX /= inputLength;
    inputY /= inputLength;
  }

  player.x += inputX * speed * dt;
  player.y += inputY * speed * dt;

  if (player.knockTimer > 0){
    player.knockTimer = Math.max(
      0,
      player.knockTimer - dt
    );

    player.x += player.knockX * dt;
    player.y += player.knockY * dt;

    player.knockX *= Math.pow(
      0.04,
      dt / 0.15
    );

    player.knockY *= Math.pow(
      0.04,
      dt / 0.15
    );
  }

  player.x = g.clamp(
    player.x,
    22,
    g.W - 22
  );

  player.y = g.clamp(
    player.y,
    22,
    g.H - 22
  );

  player.invincible = Math.max(
    0,
    player.invincible - dt
  );
}

function updateEnemies(g, dt){
  for (const enemy of S.enemies){
    if (enemy.dead){
      continue;
    }

    if (enemy.knockTimer > 0){
      enemy.knockTimer = Math.max(
        0,
        enemy.knockTimer - dt
      );

      enemy.x += enemy.knockX * dt;
      enemy.y += enemy.knockY * dt;

      enemy.knockX *= Math.pow(
        0.08,
        dt / 0.2
      );

      enemy.knockY *= Math.pow(
        0.08,
        dt / 0.2
      );
    } else {
      const dx = S.player.x - enemy.x;
      const dy = S.player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const speedRate =
        enemy.frozen > 0
          ? 0
          : enemy.slow > 0
            ? 0.48
            : 1;

      enemy.x += dx /
        Math.max(1, distance) *
        enemy.speed *
        speedRate *
        dt;

      enemy.y += dy /
        Math.max(1, distance) *
        enemy.speed *
        speedRate *
        dt;
    }

    enemy.slow = Math.max(
      0,
      enemy.slow - dt
    );

    enemy.frozen = Math.max(
      0,
      enemy.frozen - dt
    );

    enemy.orbitCooldown = Math.max(
      0,
      enemy.orbitCooldown - dt
    );

    enemy.fieldCooldown = Math.max(
      0,
      enemy.fieldCooldown - dt
    );
  }
}

function updateOrbit(g, dt){
  const level = cardLevel("orbit");

  if (level <= 0){
    return;
  }

  const radius =
    52 + level * 7;
  const satelliteCount = Math.min(
    4,
    1 + Math.floor(level / 3)
  );
  const power =
    evolutionPower("orbit");
  const damage =
    (0.7 + level * 0.38) *
    power;
  const knockForce =
    (240 + level * 55) *
    power;

  for (let i = 0; i < satelliteCount; i++){
    const angle =
      S.elapsed * 4.4 +
      i * Math.PI * 2 /
        satelliteCount;

    const satellite = {
      x: S.player.x +
        Math.cos(angle) * radius,
      y: S.player.y +
        Math.sin(angle) * radius,
      r: 15,
    };

    for (const enemy of S.enemies){
      if (
        enemy.dead ||
        enemy.orbitCooldown > 0 ||
        !g.hit(satellite, enemy)
      ){
        continue;
      }

      enemy.orbitCooldown = 0.22;
      damageEnemy(
        g,
        enemy,
        damage,
        "orbit"
      );

      if (!enemy.dead){
        const kdx = enemy.x - S.player.x;
        const kdy = enemy.y - S.player.y;
        const kdist = Math.max(
          1,
          Math.hypot(kdx, kdy)
        );

        enemy.knockTimer = 0.2;
        enemy.knockX =
          kdx / kdist * knockForce;
        enemy.knockY =
          kdy / kdist * knockForce;
      }
    }
  }
}

function updateField(g, dt){
  const level = cardLevel("field");

  if (level <= 0){
    return;
  }

  const power = evolutionPower("field");
  const radius =
    (16 + level * 2) * power;
  const damage =
    (1.5 + level * 0.9) * power;

  for (const enemy of S.enemies){
    if (
      enemy.dead ||
      enemy.fieldCooldown > 0
    ){
      continue;
    }

    if (
      g.dist(enemy, S.player) <= radius
    ){
      enemy.fieldCooldown = 0.25;
      damageEnemy(
        g,
        enemy,
        damage,
        "field"
      );
    }
  }
}

function updateCold(g, dt){
  const level = cardLevel("cold");

  if (level <= 0){
    return;
  }

  S.coldTimer -= dt;

  if (S.coldTimer > 0){
    return;
  }

  S.coldTimer = Math.max(
    0.4,
    1.2 - level * 0.12
  );

  const evolved = isEvolved("cold");

  const radius =
    (105 + level * 22) *
    evolutionPower("cold");

  const caught = S.enemies.filter(
    enemy =>
      !enemy.dead &&
      g.dist(enemy, S.player) <= radius
  );

  const baseDamage =
    (0.35 + level * 0.2) *
    evolutionPower("cold");

  const damage =
    baseDamage *
    (
      1 +
      Math.min(caught.length, 8) * 0.08
    );

  const ringCount = 8;

  for (let i = 0; i < ringCount; i++){
    const angle =
      (i / ringCount) * Math.PI * 2;

    addEffect({
      type: "text",
      x: S.player.x +
        Math.cos(angle) * radius,
      y: S.player.y +
        Math.sin(angle) * radius,
      text: "❄️",
      color: "#bdefff",
      size: evolved ? 26 : 20,
      t: 0.3,
      maxT: 0.3,
    });
  }

  for (const enemy of caught){
    if (evolved){
      enemy.frozen = Math.max(
        enemy.frozen,
        1.2
      );
    } else {
      enemy.slow = Math.max(
        enemy.slow,
        1.5
      );
    }

    damageEnemy(
      g,
      enemy,
      damage,
      "cold"
    );
  }

  if (S.elapsed - S.coldLastSoundAt >= 1.0){
    S.coldLastSoundAt = S.elapsed;
    g.se("ping");
  }
}

function hitPlayer(g, enemy){
  const player = S.player;

  if (
    player.invincible > 0 ||
    enemy.dead
  ){
    return;
  }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);

  player.hp--;
  player.invincible = 0.9;
  player.knockTimer = 0.15;
  player.knockX = dx /
    Math.max(1, distance) * 460;
  player.knockY = dy /
    Math.max(1, distance) * 460;

  S.hitFlash = 0.18;
  S.shake = 0.15;
  S.killChain = 0;
  S.chainTimer = 0;

  addFloater(
    player.x,
    player.y - 32,
    "-1 HP",
    "#ff6767",
    28,
    0.7
  );

  if (
    cardLevel("cold") > 0 &&
    (
      enemy.slow > 0 ||
      enemy.frozen > 0
    )
  ){
    const counterDamage =
      (1.5 + cardLevel("cold") * 0.5) *
      evolutionPower("cold") *
      1.5;

    damageEnemy(
      g,
      enemy,
      counterDamage,
      "counter"
    );

    addFloater(
      enemy.x,
      enemy.y - 25,
      "❄️反撃!",
      "#9de8ff",
      22,
      0.6
    );
  }

  g.se("boom");

  if (player.hp <= 0){
    player.hp = 0;
    finishGame(g, false);
  }
}

function updateBossAttacks(g, dt){
  for (const enemy of S.enemies){
    if (
      enemy.dead ||
      !enemy.boss
    ){
      continue;
    }

    enemy.attackTimer -= dt;

    if (enemy.attackTimer > 0){
      continue;
    }

    enemy.attackTimer = 2.0;

    const baseAngle = Math.atan2(
      S.player.y - enemy.y,
      S.player.x - enemy.x
    );

    const pattern = g.rand(0, 1);

    if (pattern < 0.4){
      const shotCount = 5;

      for (let i = 0; i < shotCount; i++){
        if (S.enemyShots.length >= 40){
          break;
        }

        const spread =
          (i - (shotCount - 1) / 2) * 0.22;
        const angle = baseAngle + spread;

        S.enemyShots.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * 210,
          vy: Math.sin(angle) * 210,
          r: 11,
          heavy: false,
          life: 3,
          dead: false,
        });
      }

      addFloater(
        enemy.x,
        enemy.y - enemy.r - 40,
        "⚠",
        "#ff6a6a",
        26,
        0.5
      );
    } else if (pattern < 0.75){
      const ringCount = 10;

      for (let i = 0; i < ringCount; i++){
        if (S.enemyShots.length >= 40){
          break;
        }

        const angle =
          (i / ringCount) * Math.PI * 2;

        S.enemyShots.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * 175,
          vy: Math.sin(angle) * 175,
          r: 11,
          heavy: false,
          life: 3.5,
          dead: false,
        });
      }

      addFloater(
        enemy.x,
        enemy.y - enemy.r - 40,
        "💢",
        "#ff9d5c",
        28,
        0.5
      );
    } else {
      if (S.enemyShots.length < 40){
        S.enemyShots.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(baseAngle) * 430,
          vy: Math.sin(baseAngle) * 430,
          r: 15,
          heavy: true,
          life: 2.5,
          dead: false,
        });
      }

      S.flash = Math.max(S.flash, 0.15);

      addFloater(
        enemy.x,
        enemy.y - enemy.r - 40,
        "⚡撃!",
        "#ffe66d",
        30,
        0.5
      );
    }

    g.se("hit");
  }
}

function updateEnemyShots(g, dt){
  for (const shot of S.enemyShots){
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;

    if (
      shot.life <= 0 ||
      shot.x < -60 ||
      shot.x > g.W + 60 ||
      shot.y < -60 ||
      shot.y > g.H + 60
    ){
      shot.dead = true;
      continue;
    }

    if (
      S.player.invincible <= 0 &&
      g.hit(shot, S.player)
    ){
      shot.dead = true;
      hitPlayerByShot(g, shot);
    }
  }

  S.enemyShots = S.enemyShots.filter(
    shot => !shot.dead
  );
}

function hitPlayerByShot(g, shot){
  const player = S.player;
  const damage = shot.heavy ? 2 : 1;

  player.hp -= damage;
  player.invincible = 0.9;
  player.knockTimer = 0.15;
  player.knockX = shot.vx * 0.7;
  player.knockY = shot.vy * 0.7;

  S.hitFlash = shot.heavy ? 0.28 : 0.18;
  S.shake = shot.heavy ? 0.28 : 0.15;
  S.killChain = 0;
  S.chainTimer = 0;

  addFloater(
    player.x,
    player.y - 32,
    "-" + damage + " HP",
    "#ff6767",
    shot.heavy ? 34 : 28,
    0.7
  );

  g.se("boom");

  if (player.hp <= 0){
    player.hp = 0;
    finishGame(g, false);
  }
}

function updateEnemyHits(g){
  for (const enemy of S.enemies){
    if (
      enemy.dead ||
      !g.hit(enemy, S.player)
    ){
      continue;
    }

    hitPlayer(g, enemy);
    break;
  }
}

function enemyNearOrb(g, orb){
  let best = Infinity;

  for (const enemy of S.enemies){
    if (enemy.dead){
      continue;
    }

    const dx = enemy.x - orb.x;
    const dy = enemy.y - orb.y;
    const distance = Math.hypot(dx, dy);

    if (distance < best){
      best = distance;
    }
  }

  return best;
}

function gainXp(g, value){
  S.xp += value;

  while (
    S.xp >= S.nextXp &&
    S.scene === "play"
  ){
    S.xp -= S.nextXp;
    S.level++;
    S.nextXp =
      5 + S.level * 3;
    beginLevelUp(g);
  }
}

function updateXpOrbs(g, dt){
  const magnetLevel =
    cardLevel("magnet");

  const range =
    62 +
    magnetLevel * 48 *
      evolutionPower("magnet");

  for (const orb of S.xpOrbs){
    const dx = S.player.x - orb.x;
    const dy = S.player.y - orb.y;
    const distance = Math.hypot(dx, dy);

    if (distance < range){
      let dangerBonus = 1;

      if (magnetLevel > 0){
        const enemyDistance =
          enemyNearOrb(g, orb);

        dangerBonus += g.clamp(
          (180 - enemyDistance) / 180,
          0,
          1
        ) * (
          0.7 +
          magnetLevel * 0.18
        );
      }

      const speed =
        (150 +
          magnetLevel * 70) *
        dangerBonus *
        evolutionPower("magnet");

      orb.x += dx /
        Math.max(1, distance) *
        speed *
        dt;

      orb.y += dy /
        Math.max(1, distance) *
        speed *
        dt;
    }

    if (g.hit(orb, S.player)){
      orb.dead = true;
      gainXp(g, orb.value);
      g.se("coin");

      if (S.scene !== "play"){
        break;
      }
    }
  }

  S.xpOrbs = S.xpOrbs.filter(
    orb => !orb.dead
  );

  if (S.xpOrbs.length > 50){
    S.xpOrbs.length = 50;
  }
}

function weightedPick(g, cards){
  let total = 0;

  for (const card of cards){
    total += S.cardWeights[card.id];
  }

  let roll = g.rand(0, total);

  for (const card of cards){
    roll -= S.cardWeights[card.id];

    if (roll <= 0){
      return card;
    }
  }

  return cards[cards.length - 1];
}

function makeChoices(g){
  const choices = [];
  const unused = CARDS.filter(
    card => cardLevel(card.id) <= 0
  );

  if (unused.length > 0){
    choices.push(
      weightedPick(g, unused)
    );
  }

  while (choices.length < 3){
    const candidates = CARDS.filter(
      card => choices.indexOf(card) < 0
    );

    if (candidates.length <= 0){
      break;
    }

    choices.push(
      weightedPick(g, candidates)
    );
  }

  for (let i = choices.length - 1; i > 0; i--){
    const j = Math.floor(
      g.rand(0, i + 1)
    );

    const temp = choices[i];
    choices[i] = choices[j];
    choices[j] = temp;
  }

  return choices;
}

function beginLevelUp(g){
  S.choices = makeChoices(g);
  S.scene = "levelup";
  S.freeze = 0;
  S.flash = 0.15;
  S.levelChoiceTimer = 10;

  addFloater(
    S.player.x,
    S.player.y - 48,
    "LEVEL UP!",
    "#fff49a",
    32,
    0.8
  );

  g.se("clear");
}

function grantCardLevel(g, card){
  S.cardWeights[card.id] = 1;
  S.cards[card.id]++;

  if (card.id === "life"){
    S.player.maxHp++;
    S.player.hp = S.player.maxHp;
    g.se("heal");
  } else {
    g.se("click");
  }

  const evolved =
    S.cards[card.id] === 3;

  if (evolved){
    S.freeze = 0.25;
    S.flash = 0.3;
    S.goldFlash = 0.35;
    S.shake = 0.22;

    addBurst(
      g,
      S.player.x,
      S.player.y,
      "✨",
      12,
      30
    );

    addFloater(
      S.player.x,
      S.player.y - 58,
      card.emoji + " 進化!",
      "#ffe66d",
      38,
      1.2
    );

    g.se("clear");
  } else {
    S.freeze = 0.17;
    S.flash = 0.15;

    addFloater(
      S.player.x,
      S.player.y - 50,
      card.emoji + " Lv." +
        S.cards[card.id],
      "#dfffa8",
      27,
      0.85
    );
  }
}

function chooseCard(g, index){
  const card = S.choices[index];

  if (!card){
    return;
  }

  for (const choice of S.choices){
    if (choice.id !== card.id){
      S.cardWeights[choice.id] *= 1.15;
    }
  }

  grantCardLevel(g, card);

  S.scene = "play";
  S.choices = [];
}

function rollChestRarity(g){
  const roll = g.rand(0, 1);

  if (roll < 0.03){
    return {
      label: "LEGENDARY!!",
      color: "#ffe66d",
      scale: 1.7,
    };
  }

  if (roll < 0.15){
    return {
      label: "EPIC!",
      color: "#c9a2ff",
      scale: 1.4,
    };
  }

  if (roll < 0.4){
    return {
      label: "RARE",
      color: "#8deaff",
      scale: 1.18,
    };
  }

  return {
    label: "",
    color: "#fff",
    scale: 1,
  };
}

function openChest(g){
  const count = Math.floor(
    g.rand(1, 6)
  );

  const items = [];

  for (let i = 0; i < count; i++){
    items.push(
      weightedPick(g, CARDS)
    );
  }

  S.chest = {
    items: items,
    rarities: [],
    revealed: 0,
    timer: 0.7,
    closing: false,
    spinTimer: 0,
    spinIcon: null,
  };

  S.scene = "chest";
  S.shake = Math.max(S.shake, 0.2);
  S.goldFlash = Math.max(S.goldFlash, 0.25);

  addBurst(
    g,
    g.W / 2,
    220,
    "✨",
    10,
    26
  );

  g.se("ping");
}

function updateChest(g, dt){
  const chest = S.chest;

  if (!chest){
    S.scene = "play";
    return;
  }

  if (chest.spinTimer > 0){
    chest.spinTimer -= dt;
    chest.spinIconTimer -= dt;

    if (chest.spinIconTimer <= 0){
      chest.spinIconTimer = 0.05;
      chest.spinIcon = g.pick(CARDS).emoji;
    }

    return;
  }

  chest.timer -= dt;

  if (chest.timer > 0){
    return;
  }

  if (chest.revealed < chest.items.length){
    if (chest.spinIcon === null){
      chest.spinTimer = 0.5;
      chest.spinIconTimer = 0;
      chest.spinIcon = "";
      return;
    }

    const card = chest.items[chest.revealed];
    const rarity = rollChestRarity(g);
    chest.rarities.push(rarity);
    chest.spinIcon = null;

    grantCardLevel(g, card);
    chest.revealed++;
    chest.timer = Math.max(
      0.24,
      0.48 - chest.revealed * 0.045
    );

    const combo = chest.revealed;
    const centerX = g.W / 2;
    const centerY = g.H / 2 - 20;
    const sounds = [
      "coin",
      "jump",
      "ping",
    ];

    S.shake = Math.max(
      S.shake,
      (0.16 + combo * 0.055) * rarity.scale
    );

    S.goldFlash = Math.max(
      S.goldFlash,
      (0.22 + combo * 0.07) * rarity.scale
    );

    S.flash = Math.max(
      S.flash,
      (0.05 + combo * 0.025) * rarity.scale
    );

    addBurst(
      g,
      centerX,
      centerY,
      "🎉",
      Math.round((7 + combo * 3) * rarity.scale),
      22 + combo * 2
    );

    addBurst(
      g,
      centerX,
      centerY,
      "✨",
      Math.round((5 + combo * 3) * rarity.scale),
      18 + combo * 2
    );

    addBurst(
      g,
      centerX,
      centerY,
      "💰",
      Math.round((2 + combo * 2) * rarity.scale),
      20 + combo * 2
    );

    if (rarity.label){
      addFloater(
        centerX,
        centerY - 90,
        rarity.label,
        rarity.color,
        26 + rarity.scale * 10,
        1.0
      );
    }

    g.se(
      sounds[(combo - 1) % sounds.length]
    );
    return;
  }

  if (!chest.closing){
    chest.closing = true;
    chest.timer = 1.0;

    S.shake = Math.max(S.shake, 0.65);
    S.flash = Math.max(S.flash, 0.55);
    S.goldFlash = Math.max(S.goldFlash, 0.75);

    addBurst(
      g,
      g.W / 2,
      g.H / 2 - 10,
      "🎉",
      22 + chest.items.length * 5,
      38
    );

    addBurst(
      g,
      g.W / 2,
      g.H / 2 - 10,
      "✨",
      26 + chest.items.length * 5,
      34
    );

    addBurst(
      g,
      g.W / 2,
      g.H / 2 - 10,
      "💰",
      14 + chest.items.length * 4,
      36
    );

    addFloater(
      g.W / 2,
      g.H / 2 + 150,
      "GET! ×" + chest.items.length,
      "#ffe66d",
      32,
      1.0
    );

    g.se("boom");
    g.se("clear");
    return;
  }

  S.scene = "play";
  S.chest = null;
}

function updateLevelChoice(g, dt){
  S.levelChoiceTimer -= dt;

  if (S.levelChoiceTimer <= 0){
    chooseCard(g, 1);
    return;
  }

  if (
    g.pressed("Digit1") ||
    g.pressed("Numpad1")
  ){
    chooseCard(g, 0);
    return;
  }

  if (
    g.pressed("Digit2") ||
    g.pressed("Numpad2")
  ){
    chooseCard(g, 1);
    return;
  }

  if (
    g.pressed("Digit3") ||
    g.pressed("Numpad3")
  ){
    chooseCard(g, 2);
    return;
  }

  if (!g.pointer.justDown){
    return;
  }

  const width = 250;
  const gap = 22;
  const total =
    width * 3 + gap * 2;
  const left =
    (g.W - total) / 2;
  const top = 155;
  const height = 245;

  for (let i = 0; i < 3; i++){
    const x =
      left + i * (width + gap);

    if (
      g.pointer.x >= x &&
      g.pointer.x <= x + width &&
      g.pointer.y >= top &&
      g.pointer.y <= top + height
    ){
      chooseCard(g, i);
      return;
    }
  }
}

function updatePlay(g, dt){
  S.elapsed += dt;

  S.chainTimer -= dt;

  if (
    S.killChain > 0 &&
    S.chainTimer <= 0
  ){
    S.killChain = 0;
  }

  updatePlayer(g, dt);

  if (
    !S.midbossSpawned &&
    S.elapsed >= 40
  ){
    spawnMidboss(g);
  }

  if (
    S.stage === 1 &&
    !S.stage1BossSpawned &&
    S.elapsed >= 90
  ){
    spawnStage1Boss(g);
  }

  if (
    S.stage === 2 &&
    !S.stage2BossSpawned &&
    S.elapsed - S.stage2StartElapsed >= 75
  ){
    spawnStage2Boss(g);
  }

  if (
    S.stage === 3 &&
    !S.stage3BossSpawned &&
    S.elapsed - S.stage3StartElapsed >= 75
  ){
    spawnStage3Boss(g);
  }

  if (
    S.stage === 4 &&
    !S.stage4BossSpawned &&
    S.elapsed - S.stage4StartElapsed >= 75
  ){
    spawnStage4Boss(g);
  }

  if (S.stage === 5){
    S.exBossTimer -= dt;

    if (S.exBossTimer <= 0){
      spawnExBoss(g);
      S.exBossTimer = 32;
    }
  }

  S.spawnTimer -= dt;

  if (S.spawnTimer <= 0){
    S.spawnTimer += spawnInterval();
    spawnEnemy(g);
  }

  S.attackTimer -= dt;

  if (S.attackTimer <= 0){
    S.attackTimer += attackInterval();
    fireVolley(g);
  }

  updateEnemies(g, dt);
  updateOrbit(g, dt);
  updateField(g, dt);
  updateCold(g, dt);
  updateShots(g, dt);
  updateBossAttacks(g, dt);
  updateEnemyShots(g, dt);
  updateEnemyHits(g);

  if (S.scene !== "play"){
    return;
  }

  updateXpOrbs(g, dt);

  S.enemies = S.enemies.filter(
    enemy => !enemy.dead
  );

  if (S.enemies.length > ENEMY_CAP){
    const bosses = S.enemies.filter(
      enemy => enemy.boss
    );

    const nonBosses = S.enemies.filter(
      enemy => !enemy.boss
    );

    const keepCount = Math.max(
      0,
      ENEMY_CAP - bosses.length
    );

    S.enemies = bosses.concat(
      nonBosses.slice(0, keepCount)
    );
  }
}

function drawDenseZone(g){
  g.rect(
    0,
    0,
    g.W,
    80,
    "#48175266"
  );

  g.rect(
    0,
    g.H - 80,
    g.W,
    80,
    "#48175266"
  );

  g.rect(
    0,
    80,
    80,
    g.H - 160,
    "#48175266"
  );

  g.rect(
    g.W - 80,
    80,
    80,
    g.H - 160,
    "#48175266"
  );

  g.text(
    "XP ×1.3",
    12,
    102,
    14,
    "#ffb2ff99",
    "left"
  );

  g.text(
    "XP ×1.3",
    g.W - 12,
    g.H - 102,
    14,
    "#ffb2ff99",
    "right"
  );
}

function drawBackground(g){
  const danger =
    S.elapsed >= 55 &&
    S.elapsed < 75;

  const bonus =
    S.elapsed >= 75;

  if (S.stage >= 4){
    g.bg("#050818");
  } else if (S.stage === 3){
    g.bg("#101c1c");
  } else if (S.stage === 2){
    g.bg("#1a0f2e");
  } else if (bonus){
    g.bg("#29210c");
  } else if (danger){
    g.bg("#211126");
  } else {
    g.bg("#121528");
  }

  for (let x = 40; x < g.W; x += 80){
    for (let y = 40; y < g.H; y += 80){
      g.emoji(
        "·",
        x,
        y,
        18,
        { alpha: 0.18 }
      );
    }
  }

  drawDenseZone(g);

  if (bonus){
    g.rect(
      0,
      0,
      g.W,
      7,
      "#ffd84f"
    );
    g.rect(
      0,
      g.H - 7,
      g.W,
      7,
      "#ffd84f"
    );
    g.rect(
      0,
      0,
      7,
      g.H,
      "#ffd84f"
    );
    g.rect(
      g.W - 7,
      0,
      7,
      g.H,
      "#ffd84f"
    );
  }
}

function drawXpOrbs(g, ox, oy){
  for (const orb of S.xpOrbs){
    const pulse =
      1 +
      Math.sin(
        g.time * 8 + orb.x
      ) * 0.08;

    g.emoji(
      "✨",
      orb.x + ox,
      orb.y + oy,
      orb.size * pulse,
      {
        alpha:
          orb.edgeBonus ? 1 : 0.82,
      }
    );
  }
}

function drawEnemies(g, ox, oy){
  for (const enemy of S.enemies){
    const alpha =
      enemy.frozen > 0
        ? 0.5
        : enemy.slow > 0
          ? 0.68
          : 1;

    g.emoji(
      enemy.emoji,
      enemy.x + ox,
      enemy.y + oy,
      enemy.size,
      { alpha: alpha }
    );

    if (enemy.boss){
      const width = 110;

      g.text(
        enemy.bossKind === "mid"
          ? "中ボス"
          : "ステージボス",
        enemy.x + ox,
        enemy.y - enemy.r - 34 + oy,
        18,
        enemy.bossKind === "mid"
          ? "#ffcf8a"
          : "#ffb0b0"
      );

      g.rect(
        enemy.x - width / 2 + ox,
        enemy.y - enemy.r - 20 + oy,
        width,
        8,
        "#35111b"
      );

      g.rect(
        enemy.x - width / 2 + ox,
        enemy.y - enemy.r - 20 + oy,
        width *
          Math.max(0, enemy.hp) /
          enemy.maxHp,
        8,
        "#ff6278"
      );
    } else if (
      enemy.maxHp >= 6 &&
      enemy.hp < enemy.maxHp
    ){
      g.rect(
        enemy.x - 20 + ox,
        enemy.y - enemy.r - 14 + oy,
        40,
        5,
        "#35111b"
      );

      g.rect(
        enemy.x - 20 + ox,
        enemy.y - enemy.r - 14 + oy,
        40 *
          Math.max(0, enemy.hp) /
          enemy.maxHp,
        5,
        "#ff6278"
      );
    }
  }
}

function drawShots(g, ox, oy){
  for (const shot of S.shots){
    if (shot.type === "boomerang"){
      g.emoji(
        "🪃",
        shot.x + ox,
        shot.y + oy,
        31,
        { rot: g.time * 10 }
      );
    } else if (shot.type === "missile"){
      g.emoji(
        "🚀",
        shot.x + ox,
        shot.y + oy,
        24,
        {
          rot:
            Math.atan2(
              shot.vy,
              shot.vx
            ) + Math.PI / 2,
        }
      );
    } else {
      g.emoji(
        cardLevel("fire") > 0
          ? "🔥"
          : "⚔️",
        shot.x + ox,
        shot.y + oy,
        cardLevel("fire") > 0
          ? 25
          : 21,
        {
          rot:
            Math.atan2(
              shot.vy,
              shot.vx
            ) + Math.PI / 2,
        }
      );
    }
  }
}

function drawEnemyShots(g, ox, oy){
  for (const shot of S.enemyShots){
    g.emoji(
      shot.heavy ? "🔥" : "☄️",
      shot.x + ox,
      shot.y + oy,
      shot.heavy ? 40 : 26,
      {
        rot: Math.atan2(
          shot.vy,
          shot.vx
        ),
      }
    );
  }
}

function drawOrbit(g, ox, oy){
  const level = cardLevel("orbit");

  if (level <= 0){
    return;
  }

  const radius =
    52 + level * 7;
  const count = Math.min(
    4,
    1 + Math.floor(level / 3)
  );

  for (let i = 0; i < count; i++){
    const angle =
      S.elapsed * 4.4 +
      i * Math.PI * 2 / count;

    g.emoji(
      "🌀",
      S.player.x +
        Math.cos(angle) * radius +
        ox,
      S.player.y +
        Math.sin(angle) * radius +
        oy,
      isEvolved("orbit") ? 35 : 29,
      { rot: -g.time * 5 }
    );
  }
}

function drawField(g, ox, oy){
  const level = cardLevel("field");

  if (level <= 0){
    return;
  }

  const power = evolutionPower("field");
  const radius =
    (16 + level * 2) * power;

  for (let i = 0; i < 8; i++){
    const angle =
      (i / 8) * Math.PI * 2 +
      g.time * 3;

    g.emoji(
      "⚡",
      S.player.x +
        Math.cos(angle) * radius +
        ox,
      S.player.y +
        Math.sin(angle) * radius +
        oy,
      12,
      { alpha: 0.7 }
    );
  }
}

function drawPlayer(g, ox, oy){
  const blink =
    S.player.invincible > 0 &&
    Math.floor(
      S.player.invincible / 0.08
    ) % 2 === 0;

  if (
    isEvolved("rapid") &&
    S.goldFlash > 0
  ){
    g.emoji(
      "✨",
      S.player.x + ox,
      S.player.y + oy,
      65,
      { alpha: 0.6 }
    );
  }

  g.emoji(
    "🧑",
    S.player.x + ox,
    S.player.y + oy,
    48,
    { alpha: blink ? 0.25 : 1 }
  );
}

function drawEffects(g, ox, oy){
  for (const effect of S.effects){
    const alpha = g.clamp(
      effect.t /
        Math.max(0.01, effect.maxT),
      0,
      1
    );

    if (effect.type === "text"){
      g.text(
        effect.text,
        effect.x + ox,
        effect.y + oy,
        effect.size,
        effect.color
      );
    } else {
      g.emoji(
        effect.emoji,
        effect.x + ox,
        effect.y + oy,
        effect.size,
        { alpha: alpha }
      );
    }
  }
}

function drawHud(g){
  g.rect(
    0,
    0,
    g.W,
    62,
    "#00000088"
  );

  let hearts = "";

  for (let i = 0; i < S.player.maxHp; i++){
    hearts +=
      i < S.player.hp ? "♥" : "♡";
  }

  g.text(
    hearts,
    14,
    20,
    21,
    "#ff6f7f",
    "left"
  );

  g.text(
    "LV " + S.level,
    14,
    46,
    18,
    "#fff",
    "left"
  );

  if (S.stage >= 2){
    const stageLabel =
      S.stage === 2 ? "STAGE 2" :
      S.stage === 3 ? "STAGE 3" :
      S.stage === 4 ? "STAGE 4" :
      "EX";

    const stageColor =
      S.stage === 2 ? "#8deaff" :
      S.stage === 3 ? "#8affc1" :
      S.stage === 4 ? "#8ab4ff" :
      "#c9a2ff";

    g.text(
      stageLabel,
      g.W / 2,
      22,
      26,
      stageColor
    );
  } else {
    const remaining = Math.max(
      0,
      90 - S.elapsed
    );

    g.text(
      remaining.toFixed(1),
      g.W / 2,
      22,
      28,
      S.elapsed >= 75
        ? "#ffe66d"
        : "#fff"
    );
  }

  g.text(
    "撃破 " + S.kills,
    g.W - 14,
    42,
    18,
    "#fff",
    "right"
  );

  const xpWidth = 260;

  g.rect(
    g.W / 2 - xpWidth / 2,
    46,
    xpWidth,
    8,
    "#31364e"
  );

  g.rect(
    g.W / 2 - xpWidth / 2,
    46,
    xpWidth *
      g.clamp(
        S.xp / S.nextXp,
        0,
        1
      ),
    8,
    "#7dff9a"
  );

  if (S.killChain > 1){
    g.text(
      "x" + S.killChain,
      g.W - 14,
      19,
      20,
      "#ffe66d",
      "right"
    );
  }

  if (S.stage === 5){
    g.text(
      "全ステージ制覇。ここからは力尽きるまでの延長戦",
      g.W / 2,
      84,
      18,
      "#c9a2ff"
    );
  } else if (S.stage === 4){
    g.text(
      "深宇宙の縄張り。敵の顔ぶれがまた変わった",
      g.W / 2,
      84,
      18,
      "#8ab4ff"
    );
  } else if (S.stage === 3){
    g.text(
      "機械遺跡の縄張り。敵の顔ぶれがまた変わった",
      g.W / 2,
      84,
      18,
      "#8affc1"
    );
  } else if (S.stage === 2){
    g.text(
      "見知らぬ縄張り。敵の顔ぶれが変わった",
      g.W / 2,
      84,
      18,
      "#8deaff"
    );
  } else if (
    S.elapsed >= 50 &&
    S.elapsed < 55
  ){
    g.text(
      "……嵐の前……",
      g.W / 2,
      84,
      24,
      "#cfc8e8"
    );
  } else if (S.elapsed >= 75){
    g.text(
      "BONUS TIME  連射×1.5",
      g.W / 2,
      84,
      23,
      "#ffe66d"
    );
  }
}

function drawKillBanner(g){
  if (!S.killBanner){
    return;
  }

  const age =
    S.killBanner.maxT -
    S.killBanner.t;

  let alpha = 1;

  if (age < 0.2){
    alpha = age / 0.2;
  } else if (S.killBanner.t < 0.2){
    alpha = S.killBanner.t / 0.2;
  }

  g.text(
    S.killBanner.text,
    g.W / 2,
    125,
    S.killBanner.text.indexOf(
      "MASSACRE"
    ) >= 0 ? 39 : 32,
    S.killBanner.color
  );

  if (alpha > 0.6){
    g.emoji(
      "💥",
      g.W / 2 - 155,
      125,
      35,
      { alpha: alpha }
    );

    g.emoji(
      "💥",
      g.W / 2 + 155,
      125,
      35,
      {
        alpha: alpha,
        flipX: true,
      }
    );
  }
}

function drawTitle(g){
  g.emoji(
    "🧑",
    g.W / 2 - 45,
    142,
    84
  );

  g.emoji(
    "🧟",
    g.W / 2 + 55,
    142,
    88
  );

  g.text(
    "絵文字サバイバー",
    g.W / 2,
    245,
    45,
    "#fff"
  );

  g.text(
    "移動だけで90秒を生き残れ",
    g.W / 2,
    298,
    24,
    "#d5dcff"
  );

  g.text(
    "矢印 / WASD / マウス・タッチで移動",
    g.W / 2,
    344,
    19,
    "#aaa"
  );

  g.text(
    "画面端は危険、でもXPが1.3倍",
    g.W / 2,
    378,
    19,
    "#ffb7ea"
  );

  g.text(
    "攻撃は自動。レベルアップで3択強化",
    g.W / 2,
    412,
    19,
    "#ffeaa0"
  );

  g.text(
    "クリック または スペースでスタート",
    g.W / 2,
    468,
    24,
    "#fff4a8"
  );
}

function drawLevelUp(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#14213dcc"
  );

  g.text(
    "LEVEL UP!",
    g.W / 2,
    92,
    42,
    "#fff49a"
  );

  g.text(
    "1 / 2 / 3 またはタップで即決定",
    g.W / 2,
    128,
    18,
    "#d2d8ee"
  );

  g.text(
    "残り" +
      Math.max(0, S.levelChoiceTimer)
        .toFixed(1) +
      "秒で自動選択",
    g.W / 2,
    150,
    15,
    S.levelChoiceTimer < 3
      ? "#ff9d5c"
      : "#9fa9d8"
  );

  const width = 250;
  const height = 245;
  const gap = 22;
  const total =
    width * 3 + gap * 2;
  const left =
    (g.W - total) / 2;
  const top = 155;

  for (let i = 0; i < S.choices.length; i++){
    const card = S.choices[i];
    const level = cardLevel(card.id);
    const willEvolve = level === 2;
    const x =
      left + i * (width + gap);

    g.rect(
      x,
      top,
      width,
      height,
      willEvolve
        ? "#6d5428"
        : "#272b4d"
    );

    g.rect(
      x + 5,
      top + 5,
      width - 10,
      height - 10,
      willEvolve
        ? "#3d3020"
        : "#171a34"
    );

    g.text(
      String(i + 1),
      x + 18,
      top + 22,
      20,
      "#9fa9d8",
      "left"
    );

    g.emoji(
      card.emoji,
      x + width / 2,
      top + 67,
      67
    );

    g.text(
      card.name,
      x + width / 2,
      top + 120,
      27,
      "#fff"
    );

    g.text(
      card.desc,
      x + width / 2,
      top + 158,
      17,
      "#bbc2df"
    );

    g.text(
      level > 0
        ? "Lv." + level +
          " → Lv." + (level + 1)
        : "NEW!",
      x + width / 2,
      top + 194,
      20,
      level > 0
        ? "#9de8ff"
        : "#aaff9d"
    );

    if (willEvolve){
      g.text(
        "✨ 進化する!",
        x + width / 2,
        top + 224,
        20,
        "#ffe66d"
      );
    }
  }
}

function drawChest(g){
  const chest = S.chest;

  const partyColors = [
    "#12091fcc",
    "#091a2acc",
    "#241008cc",
    "#1e0925cc",
    "#08231dcc",
  ];

  const colorIndex = chest
    ? chest.revealed % partyColors.length
    : 0;

  g.rect(
    0,
    0,
    g.W,
    g.H,
    partyColors[colorIndex]
  );

  g.text(
    "ボス撃破!",
    g.W / 2,
    90,
    34,
    "#ffe66d"
  );

  if (!chest){
    return;
  }

  const pulse =
    1 +
    Math.sin(
      g.time * (12 + chest.revealed * 2)
    ) * (
      0.05 + chest.revealed * 0.012
    );

  const chestBounce =
    chest.closing
      ? 118 * pulse
      : (
        100 +
        Math.sin(g.time * 14) * 6
      ) * pulse;

  g.emoji(
    chest.revealed >= chest.items.length
      ? "📦"
      : "🎁",
    g.W / 2,
    220,
    chestBounce,
    {}
  );

  if (chest.spinTimer > 0 && chest.spinIcon){
    g.text(
      "?",
      g.W / 2,
      300,
      22,
      "#d4d8eb"
    );

    g.emoji(
      chest.spinIcon,
      g.W / 2,
      340,
      50,
      { rot: g.time * 20 }
    );
  }

  const count = chest.items.length;
  const gap = 150;
  const left =
    g.W / 2 - (count - 1) * gap / 2;

  for (let i = 0; i < chest.revealed; i++){
    const card = chest.items[i];
    const rarity = chest.rarities[i] || {
      label: "",
      color: "#fff",
      scale: 1,
    };
    const x = left + i * gap;
    const newest = i === chest.revealed - 1;
    const iconPulse =
      newest && !chest.closing
        ? 1 + Math.sin(g.time * 18) * 0.12
        : 1;

    g.emoji(
      card.emoji,
      x,
      370,
      58 * iconPulse * rarity.scale
    );

    g.text(
      card.name,
      x,
      412,
      16,
      rarity.label ? rarity.color : "#fff"
    );

    if (rarity.label){
      g.text(
        rarity.label,
        x,
        432,
        13,
        rarity.color
      );
    }
  }

  g.text(
    chest.revealed + " / " + count,
    g.W / 2,
    470,
    20,
    "#d4d8eb"
  );
}

function buildText(){
  const owned = [];

  for (const card of CARDS){
    const level = cardLevel(card.id);

    if (level <= 0){
      continue;
    }

    owned.push(
      card.emoji +
      (isEvolved(card.id)
        ? "★"
        : "×" + level)
    );
  }

  return owned.length > 0
    ? owned.join("  ")
    : "なし";
}

function drawResult(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#000000cc"
  );

  g.text(
    S.endedByTime
      ? "🎉 90秒 生存!"
      : "💀 力尽きた",
    g.W / 2,
    105,
    43,
    S.endedByTime
      ? "#ffe66d"
      : "#ff7c89"
  );

  if (S.stage === 5){
    g.text(
      "🏆 全ステージ制覇(EX到達)",
      g.W / 2,
      140,
      20,
      "#c9a2ff"
    );
  } else if (S.stage === 4){
    g.text(
      "🏆 ステージ4 到達",
      g.W / 2,
      140,
      20,
      "#8ab4ff"
    );
  } else if (S.stage === 3){
    g.text(
      "🏆 ステージ3 到達",
      g.W / 2,
      140,
      20,
      "#8affc1"
    );
  } else if (S.stage === 2){
    g.text(
      "🏆 ステージ2 到達",
      g.W / 2,
      140,
      20,
      "#8deaff"
    );
  }

  g.text(
    "撃破数  " + S.kills,
    g.W / 2,
    175,
    27,
    "#fff"
  );

  g.text(
    "最大連続撃破  x" +
      S.maxKillChain,
    g.W / 2,
    218,
    24,
    "#fff"
  );

  g.text(
    "生存時間  " +
      S.elapsed.toFixed(1) +
      "秒",
    g.W / 2,
    258,
    24,
    "#fff"
  );

  g.text(
    "到達レベル  " + S.level,
    g.W / 2,
    298,
    24,
    "#fff"
  );

  g.text(
    "完成したビルド",
    g.W / 2,
    352,
    20,
    "#aaa"
  );

  g.text(
    buildText(),
    g.W / 2,
    395,
    29,
    "#fff4a8"
  );

  g.text(
    "クリック または スペースでもう一度",
    g.W / 2,
    470,
    21,
    "#d4d8eb"
  );
}

EmojiEngine.register({
  id: "survivor",
  name: "絵文字サバイバー",
  icon: "🧟",
  desc: "移動だけで90秒を生き残り、最強ビルドを作る",

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

    if (S.scene === "levelup"){
      updateLevelChoice(g, dt);
      return;
    }

    if (S.scene === "chest"){
      updateChest(g, dt);
      return;
    }

    if (S.freeze > 0){
      S.freeze = Math.max(
        0,
        S.freeze - dt
      );
      return;
    }

    updatePlay(g, dt);
  },

  draw(g){
    drawBackground(g);

    const shakePower =
      S.shake > 0
        ? 5 * S.shake / 0.22
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
    } else {
      drawXpOrbs(g, ox, oy);
      drawShots(g, ox, oy);
      drawEnemyShots(g, ox, oy);
      drawEnemies(g, ox, oy);
      drawOrbit(g, ox, oy);
      drawField(g, ox, oy);
      drawPlayer(g, ox, oy);
      drawEffects(g, ox, oy);
      drawHud(g);
      drawKillBanner(g);

      if (S.scene === "levelup"){
        drawLevelUp(g);
      }

      if (S.scene === "chest"){
        drawChest(g);
      }

      if (S.scene === "over"){
        drawResult(g);
      }
    }

    if (S.hitFlash > 0){
      const thickness = 18;

      g.rect(
        0,
        0,
        g.W,
        thickness,
        "#ff3344aa"
      );
      g.rect(
        0,
        g.H - thickness,
        g.W,
        thickness,
        "#ff3344aa"
      );
      g.rect(
        0,
        0,
        thickness,
        g.H,
        "#ff3344aa"
      );
      g.rect(
        g.W - thickness,
        0,
        thickness,
        g.H,
        "#ff3344aa"
      );
    }

    if (S.flash > 0){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#ffffff55"
      );
    }

    if (S.goldFlash > 0){
      g.rect(
        0,
        0,
        g.W,
        8,
        "#ffe66daa"
      );
      g.rect(
        0,
        g.H - 8,
        g.W,
        8,
        "#ffe66daa"
      );
      g.rect(
        0,
        0,
        8,
        g.H,
        "#ffe66daa"
      );
      g.rect(
        g.W - 8,
        0,
        8,
        g.H,
        "#ffe66daa"
      );
    }

    g.text(
      "rev16",
      g.W - 8,
      14,
      12,
      "#ffffff55",
      "right"
    );
  },
});
})();
