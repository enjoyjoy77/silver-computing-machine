(function(){
"use strict";

// ===== CPUのセリフ(1行足すだけで増やせる) =====
const LINES = {
  dive: [
    "まだイケる…!",
    "もう1マスだけ",
    "ここで戻るのは損だ"
  ],
  turn: [
    "よし、もう帰る",
    "命あっての宝だ",
    "先に上がらせてもらう"
  ],
  pickup: [
    "これは当たりだ!",
    "重いが持ってく",
    "もらった"
  ],
  lowOxygen: [
    "おい、誰か戻れよ",
    "息が…",
    "まだ潜ってる奴がいる"
  ],
  drowned: [
    "うわああああ",
    "欲張った…",
    "来年また来る"
  ],
  deepPlayer: [
    "あいつ正気か?",
    "巻き添えはごめんだ"
  ]
};

let S;

function shuffle(g, array) {
  let i;
  let j;
  let temp;
  for (i = array.length - 1; i > 0; i -= 1) {
    j = Math.floor(g.rand(0, i + 1));
    temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

function makePlayers() {
  return [
    { id: 0, name: "あなた", icon: "🤿", cpu: false, type: "player", pos: 0, returning: false, returned: false, held: [], score: 0 },
    { id: 1, name: "よくばり", icon: "😎", cpu: true, type: "greedy", pos: 0, returning: false, returned: false, held: [], score: 0 },
    { id: 2, name: "かしこい", icon: "🧐", cpu: true, type: "smart", pos: 0, returning: false, returned: false, held: [], score: 0 },
    { id: 3, name: "びびり", icon: "😰", cpu: true, type: "scared", pos: 0, returning: false, returned: false, held: [], score: 0 }
  ];
}

function makePath(g) {
  const path = [];
  let tier;
  let value;
  let copy;
  let i;

  for (tier = 1; tier <= 4; tier += 1) {
    copy = [];
    for (value = (tier - 1) * 4; value <= (tier - 1) * 4 + 3; value += 1) {
      copy.push({ value: value, tier: tier });
      copy.push({ value: value, tier: tier });
    }
    shuffle(g, copy);

    for (i = 0; i < copy.length; i += 1) {
      path.push({
        index: path.length + 1,
        chip: { value: copy[i].value, tier: copy[i].tier, parts: 1 }
      });
    }
  }

  return path;
}

// ラウンドの初期化。道(path)は3ラウンド通して引き継ぐ(原作どおり)
function resetRound(g) {
  let i;

  S.oxygen = 25;
  if (!S.path || S.path.length === 0) {
    S.path = makePath(g);
  }
  S.turn = 0;
  S.phase = "turnStart";
  S.timer = 0.55;
  S.dice = null;
  S.moveSteps = 0;
  S.pendingPlayerChoice = "";
  S.message = "第" + S.round + "ラウンド開始";
  S.messageTimer = 1.5;
  S.lowOxygenReacted = false;
  S.deepReacted = false;
  S.bubbles = [];
  S.roundSummary = [];
  S.lostThisRound = [];
  S.roundReason = "";

  for (i = 0; i < S.players.length; i += 1) {
    S.players[i].pos = 0;
    S.players[i].returning = false;
    S.players[i].returned = false;
    S.players[i].held = [];
  }
}

function insidePointer(g, x, y, w, h) {
  return g.pointer.x >= x &&
    g.pointer.x <= x + w &&
    g.pointer.y >= y &&
    g.pointer.y <= y + h;
}

function addBubble(g, player, kind) {
  if (!player || !player.cpu || !LINES[kind] || LINES[kind].length === 0) {
    return;
  }

  S.bubbles = S.bubbles.filter(function(bubble) {
    return bubble.playerId !== player.id;
  });

  S.bubbles.push({
    playerId: player.id,
    text: g.pick(LINES[kind]),
    time: 1.6
  });
}

function updateBubbles(dt) {
  let i;

  for (i = 0; i < S.bubbles.length; i += 1) {
    S.bubbles[i].time -= dt;
  }

  S.bubbles = S.bubbles.filter(function(bubble) {
    return bubble.time > 0;
  });
}

function livingCount() {
  let count = 0;
  let i;

  for (i = 0; i < S.players.length; i += 1) {
    if (!S.players[i].returned) {
      count += 1;
    }
  }

  return count;
}

function occupiedByOther(position, playerId) {
  let i;

  if (position === 0) {
    return false;
  }

  for (i = 0; i < S.players.length; i += 1) {
    if (
      S.players[i].id !== playerId &&
      !S.players[i].returned &&
      S.players[i].pos === position
    ) {
      return true;
    }
  }

  return false;
}

function tileHasChip(position) {
  return position >= 1 &&
    position <= S.path.length &&
    !!S.path[position - 1].chip;
}

function farthestAvailablePosition() {
  let i;

  for (i = S.path.length; i >= 1; i -= 1) {
    if (S.path[i - 1].chip) {
      return i;
    }
  }

  return 0;
}

function gSafeClamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// 他人のいるマスだけ飛ばして数える(空白マスは1マスとして数え、止まれる)
function movePlayer(player, steps) {
  let position = player.pos;
  let counted = 0;
  let candidate;
  let guard = 0;
  const direction = player.returning ? -1 : 1;

  if (steps <= 0) {
    return;
  }

  while (counted < steps && guard < 256) {
    guard += 1;
    candidate = position + direction;

    if (player.returning && candidate <= 0) {
      position = 0;
      break;
    }

    if (!player.returning && candidate > S.path.length) {
      break;
    }

    position = candidate;

    if (occupiedByOther(position, player.id)) {
      continue;
    }

    counted += 1;
  }

  player.pos = gSafeClamp(position, 0, S.path.length);
}

function heldValue(player) {
  let total = 0;
  let i;

  for (i = 0; i < player.held.length; i += 1) {
    total += player.held[i].value;
  }

  return total;
}

function allReturned() {
  let i;

  for (i = 0; i < S.players.length; i += 1) {
    if (!S.players[i].returned) {
      return false;
    }
  }

  return true;
}

function nextTurn() {
  let tries = 0;

  if (allReturned()) {
    finishRound(false);
    return;
  }

  do {
    S.turn = (S.turn + 1) % S.players.length;
    tries += 1;
  } while (S.players[S.turn].returned && tries <= S.players.length);

  S.phase = "turnStart";
  S.timer = S.players[S.turn].cpu ? 0.9 : 0.15;
  S.pendingPlayerChoice = "";
}

function loseTreasuresAndRestack(g) {
  const divers = [];
  const lost = [];
  let i;
  let j;
  let group;
  let sum;
  let tier;
  let deepest;
  let target;

  for (i = 0; i < S.players.length; i += 1) {
    if (!S.players[i].returned && S.players[i].held.length > 0) {
      divers.push(S.players[i]);
    }
  }

  divers.sort(function(a, b) {
    return b.pos - a.pos;
  });

  for (i = 0; i < divers.length; i += 1) {
    for (j = 0; j < divers[i].held.length; j += 1) {
      lost.push(divers[i].held[j]);
    }
    divers[i].held = [];
  }

  S.lostThisRound = lost.slice();
  deepest = farthestAvailablePosition();

  for (i = 0; i < lost.length; i += 3) {
    group = lost.slice(i, i + 3);
    sum = 0;
    tier = 1;

    for (j = 0; j < group.length; j += 1) {
      sum += group[j].value;
      tier = Math.max(tier, group[j].tier);
    }

    target = deepest + 1;
    if (target > S.path.length) {
      S.path.push({ index: target, chip: null });
    }

    S.path[target - 1].chip = {
      value: sum,
      tier: tier,
      parts: group.length
    };
    deepest = target;
  }

  for (i = 0; i < divers.length; i += 1) {
    addBubble(g, divers[i], "drowned");
  }
}

function finishRound(drowned) {
  let i;
  let gained;

  S.roundSummary = [];

  for (i = 0; i < S.players.length; i += 1) {
    gained = 0;

    if (S.players[i].returned) {
      gained = heldValue(S.players[i]);
      S.players[i].score += gained;
      S.players[i].held = [];
    }

    S.roundSummary.push({
      id: S.players[i].id,
      name: S.players[i].name,
      icon: S.players[i].icon,
      gained: gained,
      total: S.players[i].score,
      success: S.players[i].returned
    });
  }

  S.roundReason = drowned ? "酸素が尽きた!" : "全員が潜水艦に帰還";
  S.scene = "round";
  S.phase = "";
  S.timer = 0;
  S.dice = null;
}

function triggerOxygenEnd(g) {
  let i;

  if (S.scene !== "play") {
    return;
  }

  S.oxygen = 0;

  for (i = 0; i < S.players.length; i += 1) {
    if (!S.players[i].returned) {
      addBubble(g, S.players[i], "drowned");
    }
  }

  loseTreasuresAndRestack(g);
  S.roundEndPending = true;
  S.phase = "drownedPause";
  S.timer = 1.65;
  g.se("boom");
}

function beginTurn(g) {
  const player = S.players[S.turn];
  let i;

  if (player.returned) {
    nextTurn();
    return;
  }

  S.oxygen -= player.held.length;
  S.oxygen = Math.max(0, S.oxygen);
  if (player.held.length > 0) {
    g.se("ping");
  }

  if (S.oxygen < 10 && S.oxygen > 0 && !S.lowOxygenReacted) {
    S.lowOxygenReacted = true;
    for (i = 0; i < S.players.length; i += 1) {
      if (S.players[i].cpu && !S.players[i].returned) {
        addBubble(g, S.players[i], "lowOxygen");
      }
    }
  }

  if (S.oxygen <= 0) {
    triggerOxygenEnd(g);
    return;
  }

  if (!S.deepReacted && S.players[0].pos >= 20 && !S.players[0].returning) {
    S.deepReacted = true;
    for (i = 1; i < S.players.length; i += 1) {
      if (!S.players[i].returned) {
        addBubble(g, S.players[i], "deepPlayer");
      }
    }
  }

  if (player.cpu) {
    S.phase = "cpuDecision";
    S.timer = 0.9;
  } else {
    S.phase = "playerDirection";
    S.timer = 0;
  }
}

function shouldCpuReturn(player) {
  let share;
  let risk;
  let returnDistance;

  if (player.returning) {
    return true;
  }

  returnDistance = player.pos;

  if (player.type === "greedy") {
    return S.oxygen < returnDistance + 2;
  }

  if (player.type === "smart") {
    share = S.oxygen / Math.max(1, livingCount());
    risk = returnDistance * (player.held.length + 1) / 2;
    return risk >= share;
  }

  if (player.type === "scared") {
    return player.held.length >= 2;
  }

  return false;
}

function decideCpuDirection(g, player) {
  if (shouldCpuReturn(player)) {
    if (!player.returning) {
      player.returning = true;
      addBubble(g, player, "turn");
      g.se("click");
    }
  } else {
    addBubble(g, player, "dive");
  }

  rollDice(g, player);
}

function rollDice(g, player) {
  const die1 = Math.floor(g.rand(1, 4));
  const die2 = Math.floor(g.rand(1, 4));
  const raw = die1 + die2;

  S.dice = {
    a: die1,
    b: die2,
    raw: raw,
    steps: Math.max(0, raw - player.held.length),
    playerId: player.id
  };
  S.moveSteps = S.dice.steps;
  S.phase = "showDice";
  S.timer = 1.0;
  g.se("bounce");
}

function resolveMovement(g) {
  const player = S.players[S.turn];

  movePlayer(player, S.moveSteps);
  g.se("jump");

  if (player.returning && player.pos <= 0) {
    player.pos = 0;
    player.returned = true;
    S.message = player.name + "が帰還!";
    S.messageTimer = 1.1;
    g.se("clear");
    nextTurn();
    return;
  }

  if (player.pos > 0 && tileHasChip(player.pos)) {
    if (player.cpu) {
      S.phase = "cpuPickup";
      S.timer = 0.9;
    } else {
      S.phase = "playerPickup";
      S.timer = 0;
    }
    return;
  }

  if (player.pos > 0 && !tileHasChip(player.pos) && player.held.length > 0) {
    if (player.cpu) {
      S.phase = "cpuDrop";
      S.timer = 0.9;
    } else {
      S.phase = "playerDrop";
      S.timer = 0;
    }
    return;
  }

  S.phase = "afterMove";
  S.timer = player.cpu ? 0.55 : 0.25;
}

function shouldCpuPickup(player, chip) {
  if (!chip) {
    return false;
  }

  if (player.type === "greedy") {
    return true;
  }

  if (player.type === "smart") {
    return chip.tier >= 2;
  }

  if (player.type === "scared") {
    return player.held.length < 2;
  }

  return false;
}

function pickupChip(g, player) {
  const tile = S.path[player.pos - 1];

  if (!tile || !tile.chip) {
    return;
  }

  player.held.push(tile.chip);
  tile.chip = null;
  addBubble(g, player, "pickup");
  S.message = player.name + "が遺跡を拾った";
  S.messageTimer = 1.0;
  g.se("coin");
}

function dropChip(player) {
  const tile = S.path[player.pos - 1];
  const last = player.held.length - 1;
  let chip;

  if (!tile || tile.chip || player.held.length === 0) {
    return;
  }

  chip = player.held[last];
  player.held = player.held.filter(function(item, index) {
    return index !== last;
  });
  tile.chip = chip;
  S.message = player.name + "が遺跡を置いた";
  S.messageTimer = 1.0;
}

function handleCpuPickup(g, player) {
  const tile = S.path[player.pos - 1];

  if (tile && shouldCpuPickup(player, tile.chip)) {
    pickupChip(g, player);
  }

  S.phase = "afterMove";
  S.timer = 0.55;
}

function handleCpuDrop(player) {
  if (player.returning && player.held.length > 0 && player.type === "scared") {
    dropChip(player);
  }

  S.phase = "afterMove";
  S.timer = 0.55;
}

function button(g, x, y, w, h, label, color) {
  const hover = insidePointer(g, x, y, w, h);

  g.rect(x, y, w, h, hover ? "#ffffff" : color);
  g.rect(x + 4, y + 4, w - 8, h - 8, hover ? color : "#102b46");
  g.text(label, x + w / 2, y + h / 2 + 8, 24, "#ffffff", "center");

  return hover && g.pointer.justDown;
}

function tierColor(tier) {
  if (tier === 1) {
    return "#48b8b1";
  }
  if (tier === 2) {
    return "#3e8fd1";
  }
  if (tier === 3) {
    return "#7157bd";
  }
  return "#b44f91";
}

function drawTitle(g) {
  g.bg("#061d35");
  g.text("海底探検", g.W / 2, 105, 54, "#dffaff", "center");
  g.emoji("🚢", g.W / 2, 190, 84);
  g.emoji("🤿", g.W / 2 - 115, 275, 55, {rot:-0.12});
  g.emoji("😎", g.W / 2 - 38, 315, 48);
  g.emoji("🧐", g.W / 2 + 40, 350, 46);
  g.emoji("😰", g.W / 2 + 118, 390, 44);
  g.text("酸素はみんなの共有。欲張ると全員沈む", g.W / 2, 442, 22, "#b9eaff", "center");
  g.rect(300, 474, 360, 48, "#19a6b3");
  g.text("クリックして潜る", g.W / 2, 506, 25, "#ffffff", "center");
}

function drawOxygen(g) {
  const ratio = g.clamp(S.oxygen / 25, 0, 1);
  const color = S.oxygen < 10 ? "#ef4141" : "#35d39a";

  g.text("共有酸素", 480, 24, 18, "#d9f5ff", "center");
  g.rect(330, 34, 300, 24, "#16364d");
  g.rect(334, 38, 292 * ratio, 16, color);
  g.text(String(S.oxygen) + " / 25", 480, 53, 17, "#ffffff", "center");
  g.text("ROUND " + S.round + " / 3", 835, 36, 19, "#d9f5ff", "center");
}

function sortedScorePlayers() {
  const copy = S.players.slice();

  copy.sort(function(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.id - b.id;
  });

  return copy;
}

function drawScoreboard(g) {
  const ranked = sortedScorePlayers();
  let i;
  let player;
  let y;

  g.rect(12, 72, 205, 225, "#0c2a43");
  g.text("順位 / 探検隊", 24, 99, 18, "#aeeaff", "left");

  for (i = 0; i < ranked.length; i += 1) {
    player = ranked[i];
    y = 131 + i * 39;
    g.text((i + 1) + ".", 25, y, 17, "#ffffff", "left");
    g.emoji(player.icon, 55, y - 6, 25);
    g.text(player.name, 75, y, 16, "#ffffff", "left");
    g.text("持" + player.held.length, 151, y, 14, "#ffd966", "right");
    g.text(player.score + "点", 205, y, 15, "#8fffc9", "right");
  }
}

function cameraCenter() {
  const player = S.players[0];

  if (player.returned) {
    return 1;
  }

  return gSafeClamp(player.pos, 1, Math.max(1, S.path.length));
}

function screenXForPosition(position, center) {
  return 535 + (position - center) * 54;
}

function drawPath(g) {
  const center = cameraCenter();
  const start = Math.max(1, center - 5);
  const end = Math.min(S.path.length, center + 7);
  let i;
  let x;
  let tile;
  let diamonds;
  let j;

  g.text("🚢 潜水艦", 245, 335, 21, "#dffaff", "left");
  g.rect(230, 354, 710, 5, "#3b7699");

  for (i = start; i <= end; i += 1) {
    x = screenXForPosition(i, center);
    tile = S.path[i - 1];

    if (tile && tile.chip) {
      g.rect(x - 21, 334, 42, 42, tierColor(tile.chip.tier));
      diamonds = "";
      for (j = 0; j < tile.chip.tier; j += 1) {
        diamonds += "◆";
      }
      g.text(diamonds, x, 362, 11, "#ffffff", "center");
    } else {
      g.rect(x - 4, 351, 8, 8, "#7094aa");
    }

    g.text(String(i), x, 393, 12, "#8bb6ca", "center");
  }

  g.text("浅い", 240, 420, 14, "#71d6e3", "left");
  g.text("深い →", 925, 420, 14, "#d990cf", "right");
}

function drawPlayers(g) {
  const center = cameraCenter();
  const grouped = {};
  let i;
  let player;
  let key;
  let offset;
  let x;
  let y;

  for (i = 0; i < S.players.length; i += 1) {
    player = S.players[i];

    if (player.returned) {
      x = 247 + player.id * 34;
      y = 317;
      g.emoji(player.icon, x, y, 27);
      continue;
    }

    key = String(player.pos);
    if (!grouped[key]) {
      grouped[key] = 0;
    }
    offset = grouped[key];
    grouped[key] += 1;

    if (player.pos === 0) {
      x = 270;
    } else {
      x = screenXForPosition(player.pos, center);
    }

    y = 315 - offset * 28;
    g.emoji(player.icon, x, y, 31, {
      flipX: player.returning
    });

    if (player.id === S.turn) {
      g.text("▼", x, y - 25, 14, "#fff46a", "center");
    }
  }
}

function bubblePlayerScreenPosition(player) {
  const center = cameraCenter();
  let x;
  let y;

  if (player.returned || player.pos === 0) {
    x = 270 + player.id * 34;
    y = 270;
  } else {
    x = screenXForPosition(player.pos, center);
    y = 245;
  }

  return {
    x: gSafeClamp(x, 310, 810),
    y: y
  };
}

function drawBubbles(g) {
  let i;
  let bubble;
  let player;
  let point;
  let width;

  for (i = 0; i < S.bubbles.length; i += 1) {
    bubble = S.bubbles[i];
    player = S.players[bubble.playerId];

    if (!player) {
      continue;
    }

    point = bubblePlayerScreenPosition(player);
    width = Math.max(145, bubble.text.length * 18 + 28);
    g.rect(point.x - width / 2, point.y - 30, width, 38, "#ffffff");
    g.text(bubble.text, point.x, point.y - 5, 16, "#173047", "center");
  }
}

function drawDice(g) {
  if (!S.dice) {
    return;
  }

  g.rect(392, 82, 176, 76, "#f3f7fa");
  g.text("🎲 " + S.dice.a + "  🎲 " + S.dice.b, 480, 116, 25, "#173047", "center");
  g.text(
    "移動 " + S.dice.raw + " − 荷物 " +
      S.players[S.dice.playerId].held.length +
      " = " + S.dice.steps,
    480,
    145,
    14,
    "#35526a",
    "center"
  );
}

function drawTurnInfo(g) {
  const player = S.players[S.turn];

  g.text(
    player.icon + " " + player.name + " の手番",
    480,
    458,
    20,
    "#ffffff",
    "center"
  );

  if (S.messageTimer > 0) {
    g.text(S.message, 480, 188, 20, "#fff0a8", "center");
  }
}

function drawPlayerControls(g) {
  const player = S.players[0];

  if (S.turn !== 0 || player.returned) {
    return;
  }

  if (S.phase === "playerDirection") {
    if (button(g, 270, 476, 190, 52, player.returning ? "すすむ" : "もぐる", "#168fb0")) {
      rollDice(g, player);
    }

    if (!player.returning) {
      if (button(g, 500, 476, 190, 52, "ひきかえす", "#da7a39")) {
        player.returning = true;
        g.se("click");
        rollDice(g, player);
      }
    }
  } else if (S.phase === "playerPickup") {
    if (button(g, 270, 476, 190, 52, "ひろう", "#b55ca7")) {
      pickupChip(g, player);
      S.phase = "afterMove";
      S.timer = 0.25;
    }

    if (button(g, 500, 476, 190, 52, "ひろわない", "#59768b")) {
      S.phase = "afterMove";
      S.timer = 0.25;
      g.se("click");
    }
  } else if (S.phase === "playerDrop") {
    if (button(g, 270, 476, 190, 52, "1枚おく", "#b55ca7")) {
      dropChip(player);
      S.phase = "afterMove";
      S.timer = 0.25;
      g.se("click");
    }

    if (button(g, 500, 476, 190, 52, "おかない", "#59768b")) {
      S.phase = "afterMove";
      S.timer = 0.25;
      g.se("click");
    }
  }
}

function drawPlay(g) {
  g.bg("#061d35");
  drawOxygen(g);
  drawScoreboard(g);
  drawPath(g);
  drawPlayers(g);
  drawBubbles(g);
  drawDice(g);
  drawTurnInfo(g);
  drawPlayerControls(g);
}

function drawRound(g) {
  let i;
  let row;
  let y;

  g.bg("#071f38");
  g.text("第" + S.round + "ラウンド結果", 480, 62, 39, "#e2f8ff", "center");
  g.text(S.roundReason, 480, 101, 21, S.roundReason === "酸素が尽きた!" ? "#ff7474" : "#78efb8", "center");

  g.rect(205, 130, 550, 278, "#0d304d");

  for (i = 0; i < S.roundSummary.length; i += 1) {
    row = S.roundSummary[i];
    y = 178 + i * 54;
    g.emoji(row.icon, 245, y - 7, 34);
    g.text(row.name, 280, y, 20, "#ffffff", "left");
    g.text(
      row.success ? "持ち帰り +" + row.gained : "海中でロスト",
      500,
      y,
      18,
      row.success ? "#8fffc9" : "#ff8e8e",
      "center"
    );
    g.text("合計 " + row.total + "点", 720, y, 18, "#ffe28a", "right");
  }

  if (S.round < 3) {
    g.text("クリックで次のラウンド", 480, 470, 23, "#ffffff", "center");
  } else {
    g.text("クリックで最終結果", 480, 470, 23, "#ffffff", "center");
  }
}

function finalRanking() {
  const ranking = S.players.slice();

  ranking.sort(function(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.id - b.id;
  });

  return ranking;
}

function drawOver(g) {
  const ranking = finalRanking();
  let i;
  let player;
  let y;
  const playerWon = ranking[0].id === 0;

  g.bg("#06182d");
  g.text(playerWon ? "🏆 あなたの勝ち!" : "海底探検 終了", 480, 68, 42, playerWon ? "#ffe36e" : "#d8f3ff", "center");
  g.text(
    playerWon ? "無事に一番多くの遺跡を持ち帰った" : ranking[0].icon + " " + ranking[0].name + "の勝利",
    480,
    108,
    20,
    "#bceaff",
    "center"
  );

  g.rect(260, 142, 440, 264, "#0e304d");

  for (i = 0; i < ranking.length; i += 1) {
    player = ranking[i];
    y = 191 + i * 55;
    g.text((i + 1) + "位", 300, y, 21, i === 0 ? "#ffe36e" : "#ffffff", "left");
    g.emoji(player.icon, 375, y - 8, 38);
    g.text(player.name, 410, y, 21, "#ffffff", "left");
    g.text(player.score + "点", 650, y, 22, "#8fffc9", "right");
  }

  g.rect(330, 454, 300, 52, "#168fa8");
  g.text("クリックでもう一度", 480, 487, 23, "#ffffff", "center");
}

function updatePlay(g, dt) {
  const player = S.players[S.turn];

  updateBubbles(dt);

  if (S.messageTimer > 0) {
    S.messageTimer -= dt;
  }

  if (S.phase === "turnStart") {
    S.timer -= dt;
    if (S.timer <= 0) {
      beginTurn(g);
    }
    return;
  }

  if (S.phase === "cpuDecision") {
    S.timer -= dt;
    if (S.timer <= 0) {
      decideCpuDirection(g, player);
    }
    return;
  }

  if (S.phase === "showDice") {
    S.timer -= dt;
    if (S.timer <= 0) {
      resolveMovement(g);
    }
    return;
  }

  if (S.phase === "cpuPickup") {
    S.timer -= dt;
    if (S.timer <= 0) {
      handleCpuPickup(g, player);
    }
    return;
  }

  if (S.phase === "cpuDrop") {
    S.timer -= dt;
    if (S.timer <= 0) {
      handleCpuDrop(player);
    }
    return;
  }

  if (S.phase === "afterMove") {
    S.timer -= dt;
    if (S.timer <= 0) {
      nextTurn();
    }
    return;
  }

  if (S.phase === "drownedPause") {
    S.timer -= dt;
    if (S.timer <= 0) {
      S.roundEndPending = false;
      finishRound(true);
    }
  }
}

function freshState() {
  return {
    scene: "title",
    round: 1,
    oxygen: 25,
    path: [],
    players: makePlayers(),
    turn: 0,
    phase: "",
    timer: 0,
    dice: null,
    moveSteps: 0,
    pendingPlayerChoice: "",
    message: "",
    messageTimer: 0,
    lowOxygenReacted: false,
    deepReacted: false,
    bubbles: [],
    roundSummary: [],
    lostThisRound: [],
    roundReason: "",
    roundEndPending: false
  };
}

EmojiEngine.register({
  id: "kaitei",
  name: "海底探検",
  icon: "🤿",
  desc: "酸素はみんなの共有。欲張ると全員沈む",

  init: function(g) {
    S = freshState();
    this._state = S;
  },

  update: function(g, dt) {
    dt = g.clamp(dt, 0, 0.1);

    if (S.scene === "title") {
      if (g.pointer.justDown || g.pressed("action")) {
        S = freshState();
        this._state = S;
        resetRound(g);
        S.scene = "play";
        g.se("click");
      }
      return;
    }

    if (S.scene === "play") {
      updatePlay(g, dt);
      return;
    }

    if (S.scene === "round") {
      updateBubbles(dt);

      if (g.pointer.justDown || g.pressed("action")) {
        if (S.round >= 3) {
          S.scene = "over";
          g.se("clear");
        } else {
          S.round += 1;
          resetRound(g);
          this._state = S;
          S.scene = "play";
          g.se("click");
        }
      }
      return;
    }

    if (S.scene === "over") {
      if (g.pointer.justDown || g.pressed("action")) {
        S = freshState();
        this._state = S;
        g.se("click");
      }
    }
  },

  draw: function(g) {
    if (S.scene === "title") {
      drawTitle(g);
      return;
    }

    if (S.scene === "play") {
      drawPlay(g);
      return;
    }

    if (S.scene === "round") {
      drawRound(g);
      return;
    }

    drawOver(g);
  }
});
})();
