(function(){
"use strict";

// ===== CPUのセリフ =====
// 場面(kind)は8種類:
//   dive=もぐり続ける / turn=引き返す / pickup=遺跡を拾った / pass=拾わなかった
//   lowOxygen=酸素10未満 / drowned=酸素切れで全ロスト / deepPlayer=あなたが深追い
//   rival=誰かが先に帰還した
// LINES は全員の共通セリフ。キャラ固有のセリフは下の CHARACTERS の lines に書く。
// どちらも「1行足すだけ」で増える(固有があればそちらが優先。無い場面は共通から出る)。
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
  pass: [
    "こんな石ころ要らん",
    "見送りだ",
    "荷物は増やさない"
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
    "巻き添えはごめんだ",
    "あの深さから戻れると思うなよ"
  ],
  rival: [
    "先に上がりやがった",
    "抜け駆けか",
    "こっちはまだ海の中だぞ"
  ]
};

// ===== 参加キャラ(この6人から毎回3人が抽選で参加。増やすときはここに足す) =====
const CHARACTERS = [
  {
    type: "greedy", name: "よくばり", icon: "😎",
    lines: {
      dive: ["まだイケる…!", "宝は下にあるんだよ", "引き返す奴は二流だ"],
      turn: ["ちっ、ここまでか", "今回は預けておいてやる"],
      pickup: ["これは当たりだ!", "全部おれのだ", "もっとよこせ"],
      drowned: ["うわああああ", "あと1マスだったのに…"],
      rival: ["逃げ足だけは速いな"]
    }
  },
  {
    type: "smart", name: "かしこい", icon: "🧐",
    lines: {
      dive: ["計算上まだ余裕がある", "酸素の配分は把握済みだ", "あと2手は安全圏だ"],
      turn: ["ここが損益分岐点だ", "確率が悪くなった。撤退する"],
      pickup: ["価値のあるものだけ頂く", "これは持ち帰る価値がある"],
      pass: ["割に合わない", "重さに見合わないな"],
      lowOxygen: ["残り酸素、明らかに足りていない", "誰か1人は捨て駒になるぞ"],
      drowned: ["計算が甘かった…"]
    }
  },
  {
    type: "scared", name: "びびり", icon: "😰",
    lines: {
      dive: ["こ、怖くないもん", "もうちょっとだけ…"],
      turn: ["やっぱ帰る! 帰る!", "無理無理無理"],
      pickup: ["ふ、震えが止まらない", "これで十分です…"],
      pass: ["触ったら呪われそう", "持てません…"],
      lowOxygen: ["息が…!", "誰か助けて"],
      drowned: ["だから言ったのに…"],
      rival: ["ずるい! 待ってよ!"]
    }
  },
  {
    type: "gambler", name: "ばくち", icon: "🤠",
    lines: {
      dive: ["いくぜ、一発勝負!", "運は俺の味方だ", "ここで降りたら男が廃る"],
      turn: ["熱いうちに引くのが博打だ", "勝ち逃げさせてもらうぜ"],
      pickup: ["きたきたきた!", "この手ごたえ、大物だ"],
      lowOxygen: ["残り少ないほど燃えるな"],
      drowned: ["ハハッ、大負けだ!"],
      deepPlayer: ["おっ、いい度胸じゃねえか"]
    }
  },
  {
    type: "copycat", name: "しのび", icon: "🥷",
    lines: {
      dive: ["…追う", "まだだ"],
      turn: ["…潮時"],
      pickup: ["…いただく"],
      pass: ["…不要"],
      lowOxygen: ["…息が続かぬ"],
      drowned: ["…無念"],
      deepPlayer: ["…あの者、正気ではない"],
      rival: ["…先を越された"]
    }
  },
  {
    type: "veteran", name: "せんぱい", icon: "👴",
    lines: {
      dive: ["浅い所の石など宝ではない", "本物は下にしかない", "若いのは焦りすぎだ"],
      turn: ["いい物は取った。帰るぞ", "引き際こそ腕の見せ所だ"],
      pickup: ["これが本物の遺跡だ", "40年探してきた甲斐がある"],
      pass: ["こんなものは土産にもならん"],
      lowOxygen: ["昔はもっと粘れたがな", "そろそろ全員上がる頃合いだ"],
      drowned: ["…海はいつもこうだ"],
      deepPlayer: ["死ぬぞ、そこは"]
    }
  }
];

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

// 6人のキャラから3人を抽選して、あなた＋CPU3人の並びを作る
function makePlayers(g) {
  const pool = shuffle(g, CHARACTERS.slice());
  const players = [
    { id: 0, name: "あなた", icon: "🤿", cpu: false, type: "player", lines: null, pos: 0, returning: false, returned: false, held: [], score: 0 }
  ];
  let i;

  for (i = 0; i < 3; i += 1) {
    players.push({
      id: i + 1,
      name: pool[i].name,
      icon: pool[i].icon,
      cpu: true,
      type: pool[i].type,
      lines: pool[i].lines,
      pos: 0,
      returning: false,
      returned: false,
      held: [],
      score: 0
    });
  }

  return players;
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
  S.turn = S.startTurn;
  S.phase = "turnStart";
  S.timer = 0.55;
  S.dice = null;
  S.moveSteps = 0;
  S.pendingPlayerChoice = "";
  S.message = "第" + S.round + "ラウンド開始 / 先攻は " +
    S.players[S.startTurn].icon + " " + S.players[S.startTurn].name;
  S.messageTimer = 2.4;
  S.lowOxygenReacted = false;
  S.deepReacted = false;
  S.bubbles = [];
  S.roundSummary = [];
  S.lostThisRound = [];
  S.roundReason = "";
  S.viewFirst = 1;
  S.viewFollow = true;
  S.dragX = null;

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
  let pool;

  if (!player || !player.cpu) {
    return;
  }

  // キャラ固有のセリフがあればそれを、無ければ共通のセリフを使う
  pool = (player.lines && player.lines[kind]) ? player.lines[kind] : LINES[kind];

  if (!pool || pool.length === 0) {
    return;
  }

  S.bubbles = S.bubbles.filter(function(bubble) {
    return bubble.playerId !== player.id;
  });

  S.bubbles.push({
    playerId: player.id,
    text: g.pick(pool),
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
// 飛ばしたマスの数を返す(出目より多く進んで見えるのはこれが理由)
function movePlayer(player, steps) {
  let position = player.pos;
  let counted = 0;
  let skipped = 0;
  let candidate;
  let guard = 0;
  const direction = player.returning ? -1 : 1;

  if (steps <= 0) {
    return 0;
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
      skipped += 1;
      continue;
    }

    counted += 1;
  }

  player.pos = gSafeClamp(position, 0, S.path.length);

  return skipped;
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

// ラウンド終わりに、空になったマスを取り除いて道を詰める(原作どおり)。
// これで次のラウンドは同じ酸素でもっと深くまで届く。
function compactPath() {
  const before = S.path.length;
  let i;

  S.path = S.path.filter(function(tile) {
    return !!tile.chip;
  });

  for (i = 0; i < S.path.length; i += 1) {
    S.path[i].index = i + 1;
  }

  return before - S.path.length;
}

function finishRound(drowned) {
  let i;
  let gained;

  S.removedTiles = compactPath();
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

  // 次のラウンドの先攻は左どなりへ(毎回あなたが先攻だと不公平なため)
  S.startTurn = (S.startTurn + 1) % S.players.length;

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

  if (!S.deepReacted && S.players[0].pos >= 15 && !S.players[0].returning) {
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

// 今から引き返した場合、潜水艦に着くまでに消える酸素の見積もり。
// 帰りは「4 − 持ち枚数」マスずつしか進めず、その間ずっと海にいる全員が酸素を吸う。
function returnCost(player) {
  const speed = Math.max(1, 4 - player.held.length);
  const turns = Math.ceil(player.pos / speed);
  let load = 0;
  let i;

  for (i = 0; i < S.players.length; i += 1) {
    if (!S.players[i].returned) {
      load += S.players[i].held.length;
    }
  }

  return turns * Math.max(1, load);
}

// 性格ごとの「粘り具合」。小さいほど無謀に粘る
const NERVE = {
  greedy: 0.8,
  smart: 1.4,
  scared: 1.8,
  gambler: 0.9,
  copycat: 1.2,
  veteran: 1.3
};

function shouldCpuReturn(player) {
  let i;

  if (player.returning) {
    return true;
  }

  // 共通の生き残り判断: 帰り道に必要な酸素が残っていなければ引き返す
  if (S.oxygen <= returnCost(player) * (NERVE[player.type] || 1)) {
    return true;
  }

  // ここから性格ごとの上乗せ(まだ酸素に余裕があっても戻りたがる理由)
  if (player.type === "scared") {
    return player.held.length >= 2;
  }

  // ばくち: 2枚持ったら勝ち逃げ
  if (player.type === "gambler") {
    return player.held.length >= 2;
  }

  // しのび: あなたの真似をする。あなたが引き返したら追って戻る
  if (player.type === "copycat") {
    return S.players[0].returning || S.players[0].returned;
  }

  // せんぱい: 段階3以上の本物を1枚確保したら即帰還
  if (player.type === "veteran") {
    for (i = 0; i < player.held.length; i += 1) {
      if (player.held[i].tier >= 3) {
        return true;
      }
    }
    return false;
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
  let i;
  let skipped;

  skipped = movePlayer(player, S.moveSteps);
  g.se("jump");

  // 出目より多く進んで見えるときの説明を出す
  if (skipped > 0) {
    S.message = "他の人がいる" + skipped + "マスを飛び越えた(数えない)";
    S.messageTimer = 1.6;
  }

  if (player.returning && player.pos <= 0) {
    player.pos = 0;
    player.returned = true;
    S.message = player.name + "が帰還!";
    S.messageTimer = 1.1;
    g.se("clear");

    // 先に上がられた奴のくやしがり(海に残っている1人だけが反応する)
    for (i = 0; i < S.players.length; i += 1) {
      if (S.players[i].cpu && !S.players[i].returned) {
        addBubble(g, S.players[i], "rival");
        break;
      }
    }

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

// 性格ごとの「持ちすぎない上限」。持つほど足が遅くなり帰れなくなる
const MAX_HOLD = {
  greedy: 4,
  smart: 3,
  scared: 2,
  gambler: 2,
  copycat: 3,
  veteran: 3
};

function shouldCpuPickup(player, chip) {
  if (!chip) {
    return false;
  }

  if (player.held.length >= (MAX_HOLD[player.type] || 3)) {
    return false;
  }

  // 帰り道が苦しくなるなら、もう拾わない
  if (S.oxygen <= returnCost(player) * 1.2) {
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

  if (player.type === "gambler") {
    return true;
  }

  if (player.type === "copycat") {
    return chip.tier >= 2;
  }

  if (player.type === "veteran") {
    return chip.tier >= 2;
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

  if (tile && tile.chip) {
    if (shouldCpuPickup(player, tile.chip)) {
      pickupChip(g, player);
    } else {
      addBubble(g, player, "pass");
    }
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
  let i;
  let x;

  g.bg("#061d35");
  g.text("海底探検", g.W / 2, 105, 54, "#dffaff", "center");
  g.emoji("🚢", g.W / 2, 190, 84);
  g.emoji("🤿", g.W / 2, 268, 60, {rot:-0.12});

  for (i = 0; i < CHARACTERS.length; i += 1) {
    x = g.W / 2 - (CHARACTERS.length - 1) * 42 / 2 + i * 42;
    g.emoji(CHARACTERS[i].icon, x, 340, 40);
    g.text(CHARACTERS[i].name, x, 372, 11, "#9fd0e8", "center");
  }

  g.text("この6人から3人が参加(毎回かわる)", g.W / 2, 404, 17, "#7fb8d4", "center");
  g.text("進む数 = サイコロ1〜3が2個 − 荷物の数。他の人がいるマスは数えずに飛び越える", g.W / 2, 424, 14, "#6f9bb5", "center");
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
  let x;

  g.rect(12, 72, 205, 225, "#0c2a43");
  g.text("順位 / 探検隊", 24, 99, 18, "#aeeaff", "left");

  for (i = 0; i < ranked.length; i += 1) {
    player = ranked[i];
    y = 131 + i * 39;
    g.text((i + 1) + ".", 25, y, 17, "#ffffff", "left");
    g.emoji(player.icon, 55, y - 6, 25);
    g.text(player.name, 75, y, 16, "#ffffff", "left");
    if (player.returned) {
      g.text("帰還", 155, y, 13, "#8fffc9", "right");
    } else {
      g.text("持" + player.held.length, 155, y, 14, "#ffd966", "right");
    }
    g.text(player.score + "点", 205, y, 15, "#8fffc9", "right");
  }

  // このラウンドの手番の順(先攻はラウンドごとに1人ずつずれる)
  g.text("手番の順", 24, 283, 12, "#7fb8d4", "left");
  for (i = 0; i < S.players.length; i += 1) {
    player = S.players[(S.startTurn + i) % S.players.length];
    x = 96 + i * 30;
    if (i === 0) {
      g.rect(x - 14, 265, 28, 28, "#6b5a1c");   // 先攻に印
    }
    g.emoji(player.icon, x, 279, 22);
  }
}

// ===== 海の道の表示(見える範囲・スクロール) =====
const SEA_LEFT = 228;       // 海の帯の左端(ここより左は情報パネル)
const VIEW_LEFT = 348;      // 一番左のマスの中心x
const VIEW_STEP = 42;       // マスの間隔
const VIEW_COUNT = 14;      // 一度に見えるマスの数
const TILE_Y = 336;         // マスの帯の中心y

function viewMaxFirst() {
  return Math.max(1, S.path.length - VIEW_COUNT + 1);
}

// あなたを追いかける表示位置(左から5マス目にあなたが来るように)
function followFirst() {
  const player = S.players[0];
  const base = player.returned ? 1 : player.pos - 4;

  return gSafeClamp(base, 1, viewMaxFirst());
}

function viewFirst() {
  if (S.viewFollow) {
    return followFirst();
  }

  return gSafeClamp(S.viewFirst, 1, viewMaxFirst());
}

function screenXForPosition(position, first) {
  return VIEW_LEFT + (position - first) * VIEW_STEP;
}

function scrollView(amount) {
  S.viewFollow = false;
  S.viewFirst = gSafeClamp(viewFirst() + amount, 1, viewMaxFirst());
}

// スクロール操作(ドラッグ・◀▶ボタン・矢印キー)。drawより先に呼ぶ
function handleView(g) {
  const dragging = g.pointer.down && g.pointer.y > 300 && g.pointer.y < 400;
  let delta;

  if (dragging) {
    if (S.dragX === null) {
      S.dragX = g.pointer.x;
    } else {
      delta = g.pointer.x - S.dragX;
      if (Math.abs(delta) >= VIEW_STEP) {
        scrollView(-Math.round(delta / VIEW_STEP));
        S.dragX = g.pointer.x;
      }
    }
  } else {
    S.dragX = null;
  }

  if (g.pressed("left")) {
    scrollView(-3);
  }
  if (g.pressed("right")) {
    scrollView(3);
  }
}

function drawPath(g) {
  const first = viewFirst();
  const last = Math.min(S.path.length, first + VIEW_COUNT - 1);
  let i;
  let x;
  let tile;
  let diamonds;
  let j;

  // 海の帯と潜水艦(左端)
  g.rect(SEA_LEFT, TILE_Y - 52, g.W - SEA_LEFT, 118, "#082a48");
  g.emoji("🚢", 260, TILE_Y - 18, 42);
  g.text("潜水艦", 260, TILE_Y + 14, 12, "#dffaff", "center");
  g.rect(292, TILE_Y - 22, 2, 44, "#2f6e94");

  for (i = first; i <= last; i += 1) {
    x = screenXForPosition(i, first);
    tile = S.path[i - 1];

    if (tile && tile.chip) {
      g.rect(x - 19, TILE_Y - 20, 38, 40, tierColor(tile.chip.tier));
      diamonds = "";
      for (j = 0; j < tile.chip.tier; j += 1) {
        diamonds += "◆";
      }
      g.text(diamonds, x, TILE_Y + 5, tile.chip.tier >= 4 ? 9 : 11, "#ffffff", "center");
    } else {
      g.rect(x - 17, TILE_Y - 4, 34, 8, "#123a58");
      g.rect(x - 3, TILE_Y - 2, 6, 4, "#4d7d99");
    }

    g.text(String(i), x, TILE_Y + 34, 11, "#7ba3ba", "center");
  }

  // ◀▶ スクロールボタン
  g.rect(298, TILE_Y - 18, 24, 36, "#14496b");
  g.text("◀", 310, TILE_Y + 6, 17, "#cfe9f7", "center");
  g.rect(926, TILE_Y - 18, 24, 36, "#14496b");
  g.text("▶", 938, TILE_Y + 6, 17, "#cfe9f7", "center");
}

// コマを置く座標(同じマスに重なったら上に積む。マスとは重ならない高さに出す)
function playerScreenPosition(player, stack) {
  const first = viewFirst();
  let x;

  if (player.returned) {
    // 帰還した人はコマを出さない(順位表に「帰還」と出る)
    return { x: 0, y: 0, off: true };
  }

  if (player.pos === 0) {
    x = 260;
  } else {
    x = screenXForPosition(player.pos, first);
  }

  return {
    x: x,
    y: TILE_Y - 44 - stack * 30,
    off: x < 250 || x > VIEW_LEFT + (VIEW_COUNT - 1) * VIEW_STEP + 10
  };
}

function playerStackIndex(player) {
  let count = 0;
  let i;

  for (i = 0; i < S.players.length; i += 1) {
    if (S.players[i].id === player.id) {
      break;
    }
    if (!S.players[i].returned && S.players[i].pos === player.pos) {
      count += 1;
    }
  }

  return count;
}

function drawPlayers(g) {
  let i;
  let player;
  let point;

  for (i = 0; i < S.players.length; i += 1) {
    player = S.players[i];
    point = playerScreenPosition(player, playerStackIndex(player));

    if (point.off) {
      continue;   // 画面の外(スクロール中)は描かない
    }

    if (player.id === S.turn && S.scene === "play") {
      g.rect(point.x - 21, point.y - 20, 42, 42, "#2a5f86");
    }

    g.emoji(player.icon, point.x, point.y, 30, { flipX: player.returning });

    if (player.held.length > 0) {
      g.text("◆" + player.held.length, point.x, point.y + 24, 12, "#ffd966", "center");
    }
  }
}

function bubblePlayerScreenPosition(player) {
  const stack = playerStackIndex(player);
  const point = playerScreenPosition(player, stack);

  return {
    x: gSafeClamp(point.x + stack * 30, 350, 790),
    y: point.y - 46,
    off: point.off
  };
}

// 全体マップ: 道の全部を1本のバーに縮めて、誰がどこにいるかと今見ている範囲を出す
function drawMinimap(g) {
  const left = 240;
  const width = 660;
  const len = Math.max(1, S.path.length);
  const step = width / len;
  const first = viewFirst();
  let i;
  let x;
  let tile;
  let player;

  g.rect(left, 404, width, 22, "#0b2c47");

  for (i = 1; i <= len; i += 1) {
    tile = S.path[i - 1];
    x = left + (i - 1) * step;
    if (tile && tile.chip) {
      g.rect(x, 408, Math.max(2, step - 1), 14, tierColor(tile.chip.tier));
    } else {
      g.rect(x, 413, Math.max(2, step - 1), 4, "#1d4a6a");
    }
  }

  // 今見えている範囲の枠
  g.rect(left + (first - 1) * step, 402, step * VIEW_COUNT, 2, "#ffe36e");
  g.rect(left + (first - 1) * step, 426, step * VIEW_COUNT, 2, "#ffe36e");

  for (i = 0; i < S.players.length; i += 1) {
    player = S.players[i];
    if (player.returned) {
      continue;
    }
    x = left + Math.max(0, player.pos - 1) * step;
    g.emoji(player.icon, x + step / 2, 397, 15);
  }

  g.text("全体マップ", 232, 419, 12, "#8bb6ca", "right");
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

    if (point.off) {
      continue;
    }

    width = Math.max(145, bubble.text.length * 17 + 26);
    g.rect(point.x - width / 2, point.y - 30, width, 38, "#ffffff");
    g.text(bubble.text, point.x, point.y - 5, 16, "#173047", "center");
  }
}

function drawDice(g) {
  if (!S.dice) {
    return;
  }

  g.rect(360, 78, 240, 96, "#f3f7fa");
  g.text("🎲 " + S.dice.a + "  🎲 " + S.dice.b, 480, 112, 25, "#173047", "center");
  g.text("他の人がいるマスは数えず飛び越える", 480, 165, 12, "#5b7a90", "center");
  g.text(
    "移動 " + S.dice.raw + " − 荷物 " +
      S.players[S.dice.playerId].held.length +
      " = " + S.dice.steps,
    480,
    142,
    14,
    "#35526a",
    "center"
  );
}

function drawTurnInfo(g) {
  const player = S.players[S.turn];

  g.rect(12, 302, 205, 30, "#14496b");
  g.emoji(player.icon, 32, 316, 22);
  g.text(player.name + " の手番", 50, 323, 16, "#ffffff", "left");

  if (S.messageTimer > 0) {
    g.text(S.message, 480, 452, 18, "#fff0a8", "center");
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
  handleView(g);
  drawOxygen(g);
  drawScoreboard(g);
  drawPath(g);
  drawBubbles(g);
  drawPlayers(g);
  drawMinimap(g);
  drawViewControls(g);
  drawDice(g);
  drawTurnInfo(g);
  drawPlayerControls(g);
}

// ◀▶ボタンと「現在地へ」ボタンの当たり判定
function drawViewControls(g) {
  if (insidePointer(g, 298, TILE_Y - 18, 24, 36) && g.pointer.justDown) {
    scrollView(-3);
  }

  if (insidePointer(g, 926, TILE_Y - 18, 24, 36) && g.pointer.justDown) {
    scrollView(3);
  }

  if (!S.viewFollow) {
    g.rect(760, 434, 140, 26, "#1c6f8c");
    g.text("現在地へもどる", 830, 452, 14, "#ffffff", "center");
    if (insidePointer(g, 760, 434, 140, 26) && g.pointer.justDown) {
      S.viewFollow = true;
      g.se("click");
    }
  } else if (S.messageTimer <= 0) {
    g.text("◀▶ か 左右キー か 道をドラッグで先まで見られる", 480, 452, 13, "#6f9bb5", "center");
  }
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
    if (S.removedTiles > 0) {
      g.text(
        "空になった" + S.removedTiles + "マスを取り除いて道が縮んだ(残り" + S.path.length + "マス)",
        480,
        432,
        18,
        "#8fd8ff",
        "center"
      );
      g.text("次のラウンドはもっと深くまで届く", 480, 456, 16, "#7fb8d4", "center");
    }
    g.text("クリックで次のラウンド", 480, 490, 23, "#ffffff", "center");
  } else {
    g.text("クリックで最終結果", 480, 490, 23, "#ffffff", "center");
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

function freshState(g) {
  return {
    scene: "title",
    round: 1,
    oxygen: 25,
    path: [],
    players: makePlayers(g),
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
    removedTiles: 0,
    roundEndPending: false,
    viewFirst: 1,
    viewFollow: true,
    dragX: null,
    startTurn: Math.floor(g.rand(0, 4))
  };
}

EmojiEngine.register({
  id: "kaitei",
  name: "海底探検",
  icon: "🤿",
  desc: "酸素はみんなの共有。欲張ると全員沈む",

  init: function(g) {
    S = freshState(g);
    this._state = S;
  },

  update: function(g, dt) {
    dt = g.clamp(dt, 0, 0.1);

    if (S.scene === "title") {
      if (g.pointer.justDown || g.pressed("action")) {
        S = freshState(g);
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
        S = freshState(g);
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
