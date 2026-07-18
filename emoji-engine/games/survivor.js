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
    id: "chain",
    emoji: "⚡",
    name: "連鎖雷",
    desc: "近くの敵へ連鎖",
  },
  {
    id: "cold",
    emoji: "❄️",
    name: "冷気",
    desc: "周囲に冷気ダメージ+減速して反撃",
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

const BOSS_TYPE = {
  emoji: "🐲",
  size: 108,
  r: 44,
  hp: 90,
  speed: 38,
  xp: 18,
};

const STAGE3_BOSS_TYPE = {
  emoji: "🦖",
  size: 122,
  r: 48,
  hp: 160,
  speed: 36,
  xp: 25,
};

/* ステージ3=番外の新しい縄張り。同じ強さの型に別の顔をあてがう(進行曲線はいじらない) */
const STAGE3_ENEMY_TYPES = {
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

    spawnTimer: 0.3,
    attackTimer: 0.15,
    coldTimer: 2,
    enemyId: 0,
    bossSpawned: false,
    stage3BossSpawned: false,
    chest: null,

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
    S.stage === 3
      ? STAGE3_ENEMY_TYPES
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
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
  });
}

function spawnBoss(g){
  S.bossSpawned = true;

  const x = g.W / 2;
  const y = 130;

  S.enemies.push({
    id: ++S.enemyId,
    x: x,
    y: y,
    r: BOSS_TYPE.r,
    emoji: BOSS_TYPE.emoji,
    size: BOSS_TYPE.size,
    hp: BOSS_TYPE.hp,
    maxHp: BOSS_TYPE.hp,
    speed: BOSS_TYPE.speed,
    xp: BOSS_TYPE.xp,
    slow: 0,
    orbitCooldown: 0,
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    boss: true,
    bossKind: "stage1",
  });

  addFloater(
    g.W / 2,
    200,
    "⚠ ボス出現 ⚠",
    "#ff6a6a",
    34,
    1.3
  );

  S.shake = Math.max(S.shake, 0.25);
  g.se("boom");
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
    dead: false,
    knockTimer: 0,
    knockX: 0,
    knockY: 0,
    boss: true,
    bossKind: "stage3",
  });

  addFloater(
    g.W / 2,
    200,
    "⚠ ステージボス出現 ⚠",
    "#c9a2ff",
    34,
    1.3
  );

  S.shake = Math.max(S.shake, 0.25);
  g.se("boom");
}

function enterStage3(g){
  S.stage = 3;

  addFloater(
    g.W / 2,
    210,
    "STAGE 3 突入!",
    "#c9a2ff",
    34,
    1.5
  );

  addFloater(
    g.W / 2,
    250,
    "見知らぬ縄張り……",
    "#c9a2ff",
    20,
    1.5
  );

  S.shake = Math.max(S.shake, 0.2);
  S.flash = 0.2;
  g.se("clear");

  spawnStage3Boss(g);
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

    addFloater(
      enemy.x,
      enemy.y - 60,
      "ボス撃破!",
      "#ffe66d",
      36,
      1.2
    );

    if (enemy.bossKind === "stage3"){
      addFloater(
        g.W / 2,
        210,
        "ステージボス撃破!",
        "#c9a2ff",
        34,
        1.5
      );
    } else {
      S.stage = 2;

      addFloater(
        g.W / 2,
        210,
        "STAGE 2 突入!",
        "#8deaff",
        34,
        1.5
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

function updateShots(g, dt){
  for (const shot of S.shots){
    if (shot.type === "boomerang"){
      updateBoomerang(g, shot, dt);
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
      const slowRate =
        enemy.slow > 0 ? 0.48 : 1;

      enemy.x += dx /
        Math.max(1, distance) *
        enemy.speed *
        slowRate *
        dt;

      enemy.y += dy /
        Math.max(1, distance) *
        enemy.speed *
        slowRate *
        dt;
    }

    enemy.slow = Math.max(
      0,
      enemy.slow - dt
    );

    enemy.orbitCooldown = Math.max(
      0,
      enemy.orbitCooldown - dt
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
  const satelliteCount =
    isEvolved("orbit") ? 2 : 1;
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
    0.75,
    2.25 - level * 0.25
  );

  const radius =
    (105 + level * 22) *
    evolutionPower("cold");

  const damage =
    (0.5 + level * 0.3) *
    evolutionPower("cold");

  addEffect({
    type: "text",
    x: S.player.x,
    y: S.player.y,
    text: "❄️",
    color: "#bdefff",
    size: isEvolved("cold") ? 55 : 40,
    t: 0.35,
    maxT: 0.35,
  });

  for (const enemy of S.enemies){
    if (
      !enemy.dead &&
      g.dist(enemy, S.player) <= radius
    ){
      enemy.slow = Math.max(
        enemy.slow,
        isEvolved("cold") ? 2.3 : 1.5
      );

      damageEnemy(
        g,
        enemy,
        damage,
        "cold"
      );
    }
  }

  g.se("ping");
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
    enemy.slow > 0
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
    revealed: 0,
    timer: 0.7,
    closing: false,
  };

  S.scene = "chest";
}

function updateChest(g, dt){
  const chest = S.chest;

  if (!chest){
    S.scene = "play";
    return;
  }

  chest.timer -= dt;

  if (chest.timer > 0){
    return;
  }

  if (chest.revealed < chest.items.length){
    const card = chest.items[chest.revealed];

    grantCardLevel(g, card);
    chest.revealed++;
    chest.timer = 0.45;

    S.shake = Math.max(
      S.shake,
      0.12 + chest.revealed * 0.03
    );

    S.goldFlash = 0.25;

    addBurst(
      g,
      g.W / 2,
      g.H / 2 - 20,
      "🎉",
      6 + chest.revealed * 2,
      g.rand(20, 34)
    );

    g.se("coin");
    return;
  }

  if (!chest.closing){
    chest.closing = true;
    chest.timer = 1.0;

    addFloater(
      g.W / 2,
      g.H / 2 + 150,
      "GET! ×" + chest.items.length,
      "#ffe66d",
      26,
      1.0
    );

    return;
  }

  S.scene = "play";
  S.chest = null;
}

function updateLevelChoice(g){
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

  if (
    S.stage === 1 &&
    S.elapsed >= 90
  ){
    S.elapsed = 90;
    finishGame(g, true);
    return;
  }

  S.chainTimer -= dt;

  if (
    S.killChain > 0 &&
    S.chainTimer <= 0
  ){
    S.killChain = 0;
  }

  updatePlayer(g, dt);

  if (
    !S.bossSpawned &&
    S.elapsed >= 40
  ){
    spawnBoss(g);
  }

  if (
    S.stage === 2 &&
    S.elapsed >= 100
  ){
    enterStage3(g);
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
  updateCold(g, dt);
  updateShots(g, dt);
  updateEnemyHits(g);

  if (S.scene !== "play"){
    return;
  }

  updateXpOrbs(g, dt);

  S.enemies = S.enemies.filter(
    enemy => !enemy.dead
  );

  if (S.enemies.length > ENEMY_CAP){
    const boss = S.enemies.find(
      enemy => enemy.boss
    );

    S.enemies.length = ENEMY_CAP;

    if (
      boss &&
      S.enemies.indexOf(boss) < 0
    ){
      S.enemies[ENEMY_CAP - 1] = boss;
    }
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

  if (S.stage === 3){
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
      enemy.slow > 0 ? 0.68 : 1;

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
        "ボス",
        enemy.x + ox,
        enemy.y - enemy.r - 34 + oy,
        18,
        "#ffb0b0"
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

function drawOrbit(g, ox, oy){
  const level = cardLevel("orbit");

  if (level <= 0){
    return;
  }

  const radius =
    52 + level * 7;
  const count =
    isEvolved("orbit") ? 2 : 1;

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
    g.text(
      S.stage === 3 ? "STAGE 3" : "STAGE 2",
      g.W / 2,
      22,
      26,
      S.stage === 3 ? "#c9a2ff" : "#8deaff"
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

  if (S.stage === 3){
    g.text(
      "見知らぬ縄張り。敵の顔ぶれが変わった",
      g.W / 2,
      84,
      18,
      "#c9a2ff"
    );
  } else if (S.stage === 2){
    g.text(
      "ボス撃破後の延長戦。倒されるまで続く",
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
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#000000cc"
  );

  g.text(
    "ボス撃破!",
    g.W / 2,
    90,
    34,
    "#ffe66d"
  );

  const chest = S.chest;

  if (!chest){
    return;
  }

  const chestBounce =
    chest.closing || chest.revealed > 0
      ? 100
      : 100 +
        Math.sin(g.time * 14) * 6;

  g.emoji(
    chest.revealed >= chest.items.length
      ? "📦"
      : "🎁",
    g.W / 2,
    220,
    chestBounce,
    {}
  );

  const count = chest.items.length;
  const gap = 150;
  const left =
    g.W / 2 - (count - 1) * gap / 2;

  for (let i = 0; i < chest.revealed; i++){
    const card = chest.items[i];
    const x = left + i * gap;

    g.emoji(
      card.emoji,
      x,
      370,
      58
    );

    g.text(
      card.name,
      x,
      412,
      16,
      "#fff"
    );
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

  if (S.stage === 3){
    g.text(
      "🏆 ステージ3 到達(見知らぬ縄張りまで)",
      g.W / 2,
      140,
      20,
      "#c9a2ff"
    );
  } else if (S.stage === 2){
    g.text(
      "🏆 ステージ2 到達(ボス撃破)",
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
      updateLevelChoice(g);
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
      drawEnemies(g, ox, oy);
      drawOrbit(g, ox, oy);
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
      "rev8",
      g.W - 8,
      14,
      12,
      "#ffffff55",
      "right"
    );
  },
});
})();
