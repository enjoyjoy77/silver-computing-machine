/* =====================================================
   絵文字カードバトル
   見えている相手の手を信じるか、疑って外すかを楽しむ
===================================================== */
(function(){
"use strict";

const CARD_TYPES = ["🔥", "🌿", "💧", "💀"];

const PERSONALITIES = [
  { id: "honest", name: "素直型", face: "🙂" },
  { id: "repeat", name: "繰り返し型", face: "😐" },
  { id: "bluff", name: "逆張り型", face: "😏" },
  { id: "counter", name: "対策型", face: "😤" },
];

let S;

function makeDeck(){
  const deck = [];

  for (const card of CARD_TYPES){
    deck.push(card);
    deck.push(card);
  }

  return deck;
}

function shuffle(g, cards){
  const result = cards.slice();

  for (let i = result.length - 1; i > 0; i--){
    const j = Math.floor(g.rand(0, i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}

function makeSide(g){
  const side = {
    hp: 5,
    hand: [],
    deck: shuffle(g, makeDeck()),
    discard: [],

    lastCard: null,
    repeatCount: 0,
    boost: 1,

    extraHand: false,
    extraPeek: false,
  };

  fillHand(g, side, 3);
  return side;
}

function drawCard(g, side){
  if (side.deck.length <= 0){
    if (side.discard.length <= 0){
      return;
    }

    side.deck = shuffle(g, side.discard);
    side.discard = [];
  }

  side.hand.push(side.deck.pop());
}

function fillHand(g, side, count){
  while (side.hand.length < count){
    const oldLength = side.hand.length;
    drawCard(g, side);

    if (side.hand.length === oldLength){
      break;
    }
  }
}

function removeCard(side, index){
  const card = side.hand.splice(index, 1)[0];

  if (card !== undefined){
    side.discard.push(card);
  }

  return card;
}

function cardBeats(a, b){
  return (
    (a === "🔥" && b === "🌿") ||
    (a === "🌿" && b === "💧") ||
    (a === "💧" && b === "🔥")
  );
}

function counterCard(card){
  if (card === "🔥"){
    return "💧";
  }

  if (card === "🌿"){
    return "🔥";
  }

  if (card === "💧"){
    return "🌿";
  }

  return null;
}

function winningCardsInHand(hand, target){
  const wanted = counterCard(target);

  if (!wanted){
    return [];
  }

  return hand.filter(card => card === wanted);
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
    floater.y -= 35 * dt;
    floater.t -= dt;
  }

  S.floaters = S.floaters.filter(
    floater => floater.t > 0
  );
}

function choosePersonality(g, firstMatch){
  if (firstMatch){
    return PERSONALITIES[0];
  }

  return g.pick(PERSONALITIES);
}

function chooseVisibleCards(g){
  const count = S.firstMatch
    ? S.enemy.hand.length
    : Math.min(
      S.enemy.hand.length,
      S.player.extraPeek ? 2 : 1
    );

  const indices = [];

  while (
    indices.length < count &&
    indices.length < S.enemy.hand.length
  ){
    const index = Math.floor(
      g.rand(0, S.enemy.hand.length)
    );

    if (indices.indexOf(index) < 0){
      indices.push(index);
    }
  }

  S.visibleEnemyIndices = indices;
}

function pickFromCandidates(g, candidates){
  if (candidates.length <= 0){
    return null;
  }

  return g.pick(candidates);
}

function personalityChoice(g){
  const hand = S.enemy.hand;
  const visibleCards = S.visibleEnemyIndices.map(
    index => hand[index]
  );

  if (S.personality.id === "honest"){
    const target =
      S.player.lastCard ||
      g.pick(["🔥", "🌿", "💧"]);

    return pickFromCandidates(
      g,
      winningCardsInHand(hand, target)
    );
  }

  if (S.personality.id === "repeat"){
    if (
      S.enemyLastWinningCard &&
      hand.indexOf(S.enemyLastWinningCard) >= 0
    ){
      return S.enemyLastWinningCard;
    }

    if (
      S.enemy.lastCard &&
      hand.indexOf(S.enemy.lastCard) >= 0
    ){
      return S.enemy.lastCard;
    }

    return null;
  }

  if (S.personality.id === "bluff"){
    const hiddenCards = [];

    for (let i = 0; i < hand.length; i++){
      if (S.visibleEnemyIndices.indexOf(i) < 0){
        hiddenCards.push(hand[i]);
      }
    }

    return pickFromCandidates(g, hiddenCards);
  }

  if (S.personality.id === "counter"){
    return pickFromCandidates(
      g,
      winningCardsInHand(
        hand,
        S.player.lastCard
      )
    );
  }

  return null;
}

function counterChoice(g){
  if (!S.player.lastCard){
    return null;
  }

  return pickFromCandidates(
    g,
    winningCardsInHand(
      S.enemy.hand,
      S.player.lastCard
    )
  );
}

function allowedEnemyIndices(){
  const indices = [];

  for (let i = 0; i < S.enemy.hand.length; i++){
    if (
      S.enemy.repeatCount >= 2 &&
      S.enemy.hand[i] === S.enemy.lastCard
    ){
      continue;
    }

    indices.push(i);
  }

  if (indices.length > 0){
    return indices;
  }

  for (let i = 0; i < S.enemy.hand.length; i++){
    indices.push(i);
  }

  return indices;
}

function chooseEnemyCard(g){
  const allowed = allowedEnemyIndices();
  const roll = g.rand(0, 1);
  let wanted = null;

  if (roll < 0.5){
    wanted = personalityChoice(g);
  } else if (roll < 0.75){
    wanted = counterChoice(g);
  }

  let candidates = allowed.filter(
    index =>
      wanted !== null &&
      S.enemy.hand[index] === wanted
  );

  if (candidates.length <= 0){
    candidates = allowed;
  }

  return g.pick(candidates);
}

function updateRepeat(side, card){
  if (side.lastCard === card){
    side.repeatCount++;
  } else {
    side.lastCard = card;
    side.repeatCount = 1;
  }
}

function attackDamage(side, card){
  let damage = card === "🔥" ? 3 : 2;

  if (side.repeatCount >= 3){
    damage = Math.ceil(damage / 2);
  }

  damage *= side.boost;
  side.boost = 1;

  return damage;
}

function consumeUnusedBoost(side, card){
  if (card !== "💀"){
    side.boost = 1;
  }
}

function judgeRead(playerWon){
  if (!playerWon){
    return;
  }

  const shownCards = S.visibleEnemyIndices.map(
    index => S.enemy.hand[index]
  );

  if (shownCards.indexOf(S.enemyCard) >= 0){
    S.readSuccess++;
    addFloater(
      480,
      185,
      "⚡見抜いた!",
      "#ffe66d",
      30,
      1.1
    );
  } else {
    S.readMiss++;
    addFloater(
      480,
      185,
      "⚡ブラフを見破った!",
      "#7ee7ff",
      28,
      1.1
    );
  }
}

function resolveRound(g){
  if (S.resolved){
    return;
  }

  S.resolved = true;

  const playerCard = S.playerCard;
  const enemyCard = S.enemyCard;

  updateRepeat(S.player, playerCard);
  updateRepeat(S.enemy, enemyCard);

  let playerDamage = 0;
  let enemyDamage = 0;
  let playerWon = false;
  let enemyWon = false;
  let waterDraw = false;
  let skullUsed = false;

  if (playerCard === "💀" && enemyCard === "💀"){
    playerDamage = 1;
    enemyDamage = 1;
    S.player.boost = 2;
    S.enemy.boost = 2;
    skullUsed = true;
    S.roundMessage = "💀 同士! 次の一撃が2倍";
  } else if (playerCard === "💀"){
    playerDamage = 1;
    S.player.boost = 2;
    consumeUnusedBoost(S.enemy, enemyCard);
    enemyWon = true;
    skullUsed = true;
    S.roundMessage = "覚悟のブラフ! 次の一撃が2倍";
  } else if (enemyCard === "💀"){
    enemyDamage = 1;
    S.enemy.boost = 2;
    consumeUnusedBoost(S.player, playerCard);
    playerWon = true;
    skullUsed = true;
    S.roundMessage = "相手はブラフ! 次の一撃に注意";
  } else if (playerCard === enemyCard){
    playerDamage = 1;
    enemyDamage = 1;

    consumeUnusedBoost(S.player, playerCard);
    consumeUnusedBoost(S.enemy, enemyCard);

    if (playerCard === "💧"){
      S.player.extraPeek = true;
      S.enemy.extraPeek = true;
      waterDraw = true;
      S.roundMessage = "💧 相打ち! 次は伏せ札を多く見られる";
    } else {
      S.roundMessage = "引き分け! 双方に1ダメージ";
    }
  } else if (cardBeats(playerCard, enemyCard)){
    enemyDamage = attackDamage(
      S.player,
      playerCard
    );
    consumeUnusedBoost(S.enemy, enemyCard);
    playerWon = true;

    if (playerCard === "🌿"){
      S.player.extraHand = true;
    }

    S.enemyLastWinningCard = null;
    S.roundMessage =
      "あなたの勝ち! " +
      enemyDamage +
      "ダメージ";
  } else {
    playerDamage = attackDamage(
      S.enemy,
      enemyCard
    );
    consumeUnusedBoost(S.player, playerCard);
    enemyWon = true;

    if (enemyCard === "🌿"){
      S.enemy.extraHand = true;
    }

    S.enemyLastWinningCard = enemyCard;
    S.roundMessage =
      "相手の勝ち! " +
      playerDamage +
      "ダメージ";
  }

  if (!waterDraw){
    S.player.extraPeek = false;
    S.enemy.extraPeek = false;
  }

  S.player.hp = Math.max(
    0,
    S.player.hp - playerDamage
  );
  S.enemy.hp = Math.max(
    0,
    S.enemy.hp - enemyDamage
  );

  if (playerDamage > 0){
    addFloater(
      220,
      120,
      "-" + playerDamage,
      "#ff8b8b",
      32
    );
  }

  if (enemyDamage > 0){
    addFloater(
      740,
      120,
      "-" + enemyDamage,
      "#ff8b8b",
      32
    );
  }

  judgeRead(playerWon);

  if (skullUsed){
    S.freeze = 0.2;
    g.se("boom");
  } else if (
    S.player.hp <= 0 ||
    S.enemy.hp <= 0
  ){
    S.freeze = 0.25;
    S.shake = 0.25;
    g.se("boom");
  } else {
    S.freeze = 0.1;
    g.se(
      playerDamage > 0 || enemyDamage > 0
        ? "hit"
        : "click"
    );
  }

  S.lastPlayerDamage = playerDamage;
  S.lastEnemyDamage = enemyDamage;
  S.lastPlayerWon = playerWon;
  S.lastEnemyWon = enemyWon;
}

function finishMatch(g){
  if (S.finished){
    return;
  }

  S.finished = true;
  S.plays++;

  if (S.player.hp > S.enemy.hp){
    S.wins++;
    S.result = "win";
    g.se("clear");
  } else if (S.player.hp < S.enemy.hp){
    S.result = "lose";
    g.se("boom");
  } else {
    S.result = "draw";
    g.se("click");
  }

  S.scene = "over";
}

function startRound(g){
  S.round++;

  if (S.round > 8){
    finishMatch(g);
    return;
  }

  const playerHandSize =
    S.player.extraHand ? 4 : 3;
  const enemyHandSize =
    S.enemy.extraHand ? 4 : 3;

  fillHand(g, S.player, playerHandSize);
  fillHand(g, S.enemy, enemyHandSize);

  S.player.extraHand = false;
  S.enemy.extraHand = false;

  chooseVisibleCards(g);

  S.scene = "select";
  S.selectTimer = 6;
  S.selectedIndex = Math.min(
    S.selectedIndex,
    S.player.hand.length - 1
  );
  S.enemySelectedIndex = -1;
  S.playerCard = null;
  S.enemyCard = null;
  S.phaseTimer = 0;
  S.resolved = false;
  S.roundMessage = "カードを1枚選ぼう";
  S.lastPlayerDamage = 0;
  S.lastEnemyDamage = 0;
  S.lastPlayerWon = false;
  S.lastEnemyWon = false;
}

function selectPlayerCard(g, index){
  if (
    S.scene !== "select" ||
    index < 0 ||
    index >= S.player.hand.length
  ){
    return;
  }

  S.selectedIndex = index;
  S.enemySelectedIndex = chooseEnemyCard(g);

  S.playerCard = S.player.hand[index];
  S.enemyCard =
    S.enemy.hand[S.enemySelectedIndex];

  S.scene = "countdown";
  S.phaseTimer = 2;
  S.resolved = false;
  g.se("click");
}

function prepareNextRound(g){
  removeCard(S.player, S.selectedIndex);
  removeCard(S.enemy, S.enemySelectedIndex);

  fillHand(g, S.player, 3);
  fillHand(g, S.enemy, 3);

  if (
    S.player.hp <= 0 ||
    S.enemy.hp <= 0 ||
    S.round >= 8
  ){
    finishMatch(g);
    return;
  }

  startRound(g);
}

function startMatch(g){
  S.firstMatch = S.plays === 0;
  S.personality = choosePersonality(
    g,
    S.firstMatch
  );

  S.player = makeSide(g);
  S.enemy = makeSide(g);

  S.round = 0;
  S.selectedIndex = 0;
  S.enemySelectedIndex = -1;
  S.playerCard = null;
  S.enemyCard = null;
  S.visibleEnemyIndices = [];

  S.readSuccess = 0;
  S.readMiss = 0;
  S.enemyLastWinningCard = null;

  S.floaters = [];
  S.freeze = 0;
  S.shake = 0;
  S.finished = false;
  S.result = null;

  startRound(g);
}

function reset(g){
  const wins = S ? S.wins : 0;
  const plays = S ? S.plays : 0;

  S = {
    scene: "title",
    wins: wins,
    plays: plays,

    firstMatch: plays === 0,
    personality: PERSONALITIES[0],

    player: null,
    enemy: null,

    round: 0,
    selectTimer: 6,
    phaseTimer: 0,
    selectedIndex: 0,
    enemySelectedIndex: -1,

    playerCard: null,
    enemyCard: null,
    visibleEnemyIndices: [],

    readSuccess: 0,
    readMiss: 0,
    enemyLastWinningCard: null,

    roundMessage: "",
    result: null,
    finished: false,

    lastPlayerDamage: 0,
    lastEnemyDamage: 0,
    lastPlayerWon: false,
    lastEnemyWon: false,

    floaters: [],
    freeze: 0,
    shake: 0,
  };
}

function cardLayout(g, count){
  const width = 126;
  const gap = 18;
  const total = count * width + (count - 1) * gap;
  const left = (g.W - total) / 2;

  return {
    width: width,
    gap: gap,
    left: left,
    y: 385,
    height: 126,
  };
}

function cardIndexAtPointer(g){
  const layout = cardLayout(
    g,
    S.player.hand.length
  );

  if (
    g.pointer.y < layout.y ||
    g.pointer.y > layout.y + layout.height
  ){
    return -1;
  }

  for (let i = 0; i < S.player.hand.length; i++){
    const x =
      layout.left +
      i * (layout.width + layout.gap);

    if (
      g.pointer.x >= x &&
      g.pointer.x <= x + layout.width
    ){
      return i;
    }
  }

  return -1;
}

function updateSelection(g, dt){
  S.selectTimer -= dt;

  if (g.pressed("left")){
    S.selectedIndex =
      (S.selectedIndex - 1 +
        S.player.hand.length) %
      S.player.hand.length;
    g.se("click");
  }

  if (g.pressed("right")){
    S.selectedIndex =
      (S.selectedIndex + 1) %
      S.player.hand.length;
    g.se("click");
  }

  if (g.pointer.justDown){
    const index = cardIndexAtPointer(g);

    if (index >= 0){
      selectPlayerCard(g, index);
      return;
    }
  }

  if (g.pressed("action")){
    selectPlayerCard(
      g,
      S.selectedIndex
    );
    return;
  }

  if (S.selectTimer <= 0){
    selectPlayerCard(
      g,
      Math.floor(
        g.rand(0, S.player.hand.length)
      )
    );
  }
}

function updateCountdown(g, dt){
  S.phaseTimer -= dt;

  if (
    S.phaseTimer <= 0.5 &&
    !S.resolved
  ){
    resolveRound(g);
  }

  if (
    S.phaseTimer <= 0 &&
    S.resolved
  ){
    prepareNextRound(g);
  }
}

function drawCardFace(
  g,
  card,
  x,
  y,
  width,
  height,
  selected,
  hidden,
  alpha
){
  const border = selected
    ? "#ffe66d"
    : "#ffffff44";

  g.rect(
    x,
    y,
    width,
    height,
    selected ? "#453c28" : "#24243b"
  );

  g.rect(
    x,
    y,
    width,
    4,
    border
  );
  g.rect(
    x,
    y + height - 4,
    width,
    4,
    border
  );
  g.rect(
    x,
    y,
    4,
    height,
    border
  );
  g.rect(
    x + width - 4,
    y,
    4,
    height,
    border
  );

  if (hidden){
    g.emoji(
      "❓",
      x + width / 2,
      y + height / 2,
      48,
      { alpha: alpha === undefined ? 1 : alpha }
    );
  } else {
    g.emoji(
      card,
      x + width / 2,
      y + height / 2 - 6,
      58,
      { alpha: alpha === undefined ? 1 : alpha }
    );

    if (card === "💀"){
      g.text(
        "⚔️×2",
        x + width - 8,
        y + height - 14,
        15,
        "#ffe66d",
        "right"
      );
    }
  }
}

function drawHp(g, side, x, y, align){
  let hearts = "";

  for (let i = 0; i < 5; i++){
    hearts += i < side.hp ? "♥" : "♡";
  }

  g.text(
    hearts,
    x,
    y,
    26,
    "#ff7070",
    align
  );
}

function drawTopBar(g){
  g.rect(
    0,
    0,
    g.W,
    62,
    "#00000066"
  );

  g.text(
    "あなた",
    18,
    22,
    17,
    "#bbb",
    "left"
  );
  drawHp(
    g,
    S.player,
    18,
    47,
    "left"
  );

  g.text(
    "ROUND " + S.round + " / 8",
    g.W / 2,
    31,
    23,
    "#fff"
  );

  g.text(
    S.personality.face + " 相手",
    g.W - 18,
    22,
    17,
    "#bbb",
    "right"
  );
  drawHp(
    g,
    S.enemy,
    g.W - 18,
    47,
    "right"
  );
}

function drawEnemyHand(g){
  const count = S.enemy.hand.length;
  const width = 76;
  const height = 82;
  const gap = 12;
  const total =
    count * width + (count - 1) * gap;
  const left = (g.W - total) / 2;
  const wave = Math.sin(g.time * 4) * 3;

  for (let i = 0; i < count; i++){
    const visible =
      S.firstMatch ||
      S.visibleEnemyIndices.indexOf(i) >= 0;

    const selected =
      S.scene !== "select" &&
      i === S.enemySelectedIndex;

    drawCardFace(
      g,
      S.enemy.hand[i],
      left + i * (width + gap),
      92 + wave,
      width,
      height,
      selected,
      !visible,
      visible ? 1 : 0.7
    );
  }

  if (S.firstMatch){
    g.text(
      "初戦は相手の手札をすべて公開",
      g.W / 2,
      191,
      16,
      "#8de0ff"
    );
  } else if (S.player.extraPeek){
    g.text(
      "💧の効果で2枚見える",
      g.W / 2,
      191,
      16,
      "#8de0ff"
    );
  }
}

function drawPlayerHand(g){
  const layout = cardLayout(
    g,
    S.player.hand.length
  );

  for (let i = 0; i < S.player.hand.length; i++){
    const selected =
      S.scene === "select" &&
      i === S.selectedIndex;

    const y = selected
      ? layout.y - 10
      : layout.y;

    drawCardFace(
      g,
      S.player.hand[i],
      layout.left +
        i * (layout.width + layout.gap),
      y,
      layout.width,
      layout.height,
      selected,
      false,
      1
    );
  }

  if (S.player.hand.length === 4){
    g.text(
      "🌿の効果で今だけ4枚",
      g.W / 2,
      365,
      16,
      "#9cff9c"
    );
  }
}

function drawBattleCenter(g){
  if (S.scene === "select"){
    g.text(
      "どの手を出す?",
      g.W / 2,
      245,
      30,
      "#fff"
    );

    g.text(
      "残り " +
        Math.max(0, S.selectTimer).toFixed(1) +
        " 秒",
      g.W / 2,
      280,
      20,
      S.selectTimer < 2
        ? "#ff8b8b"
        : "#bbb"
    );

    g.text(
      "← → で選択 / スペース・クリックで決定",
      g.W / 2,
      318,
      17,
      "#999"
    );
    return;
  }

  if (S.scene === "countdown"){
    if (!S.resolved){
      const count = Math.max(
        1,
        Math.ceil(
          (S.phaseTimer - 0.5) / 0.5
        )
      );

      g.emoji(
        "❓",
        390,
        270,
        64
      );
      g.text(
        "vs",
        g.W / 2,
        272,
        27,
        "#aaa"
      );
      g.emoji(
        S.playerCard,
        570,
        270,
        64
      );

      g.text(
        String(count),
        g.W / 2,
        335,
        42,
        "#ffe66d"
      );
    } else {
      g.emoji(
        S.enemyCard,
        390,
        265,
        72
      );
      g.text(
        "vs",
        g.W / 2,
        268,
        28,
        "#aaa"
      );
      g.emoji(
        S.playerCard,
        570,
        265,
        72
      );

      g.text(
        S.roundMessage,
        g.W / 2,
        334,
        25,
        "#ffe9a8"
      );
    }
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

function drawTitle(g){
  g.emoji(
    "🎴",
    g.W / 2,
    145,
    100,
    { rot: -0.08 }
  );

  g.text(
    "絵文字カードバトル",
    g.W / 2,
    245,
    43
  );

  g.text(
    "🔥 > 🌿 > 💧 > 🔥",
    g.W / 2,
    294,
    30,
    "#ffe9a8"
  );

  g.text(
    "相手の手は1枚だけ見える。信じるか、外すか",
    g.W / 2,
    340,
    21,
    "#ccc"
  );

  g.text(
    "💀は1ダメージを受ける代わりに、次の一撃が2倍",
    g.W / 2,
    375,
    17,
    "#aaa"
  );

  const rate = S.plays > 0
    ? Math.round(S.wins * 100 / S.plays)
    : 0;

  g.text(
    "通算 " +
      S.wins +
      "勝 / " +
      S.plays +
      "戦　勝率 " +
      rate +
      "%",
    g.W / 2,
    415,
    20,
    "#8de0ff"
  );

  g.text(
    "クリック または スペース でスタート",
    g.W / 2,
    465,
    24,
    "#fff4a8"
  );
}

function drawResult(g){
  g.rect(
    0,
    0,
    g.W,
    g.H,
    "#000000bb"
  );

  let title = "引き分け";
  let color = "#ddd";

  if (S.result === "win"){
    title = "🏆 あなたの勝ち!";
    color = "#ffe66d";
  } else if (S.result === "lose"){
    title = "💥 あなたの負け";
    color = "#ff8b8b";
  }

  g.text(
    title,
    g.W / 2,
    170,
    43,
    color
  );

  g.text(
    "残りHP　あなた " +
      S.player.hp +
      " / 相手 " +
      S.enemy.hp,
    g.W / 2,
    230,
    25,
    "#fff"
  );

  g.text(
    "ブラフを見破った回数 " +
      S.readMiss,
    g.W / 2,
    280,
    22,
    "#7ee7ff"
  );

  g.text(
    "公開札を信じて当てた回数 " +
      S.readSuccess,
    g.W / 2,
    318,
    22,
    "#ffe66d"
  );

  g.text(
    "外した回数 " +
      Math.max(
        0,
        S.round -
          S.readSuccess -
          S.readMiss
      ),
    g.W / 2,
    356,
    20,
    "#bbb"
  );

  const rate = Math.round(
    S.wins * 100 / S.plays
  );

  g.text(
    "通算 " +
      S.wins +
      "勝 / " +
      S.plays +
      "戦　勝率 " +
      rate +
      "%",
    g.W / 2,
    407,
    22,
    "#fff"
  );

  g.text(
    "クリック または スペース でもう一戦",
    g.W / 2,
    464,
    21,
    "#fff4a8"
  );
}

EmojiEngine.register({
  id: "cardbattle",
  name: "絵文字カードバトル",
  icon: "🎴",
  desc: "見えている相手の手を信じるか、ブラフを見破れ",

  init(g){
    reset(g);
    this._state = S;
  },

  update(g, dt){
    updateFloaters(dt);

    S.shake = Math.max(
      0,
      S.shake - dt
    );

    if (S.scene === "title"){
      if (
        g.pressed("action") ||
        g.pointer.justDown
      ){
        startMatch(g);
        this._state = S;
        g.se("click");
      }
      return;
    }

    if (S.scene === "over"){
      if (
        g.pressed("action") ||
        g.pointer.justDown
      ){
        startMatch(g);
        this._state = S;
        g.se("click");
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

    if (S.scene === "select"){
      updateSelection(g, dt);
      return;
    }

    if (S.scene === "countdown"){
      updateCountdown(g, dt);
    }
  },

  draw(g){
    g.bg("#17152b");

    const shakePower =
      S.shake > 0
        ? 4 * S.shake / 0.25
        : 0;

    const ox =
      shakePower > 0
        ? g.rand(-shakePower, shakePower)
        : 0;

    const oy =
      shakePower > 0
        ? g.rand(-shakePower, shakePower)
        : 0;

    for (let x = 35; x < g.W; x += 70){
      g.emoji(
        "✦",
        x,
        75 + Math.sin(x + g.time) * 4,
        14,
        { alpha: 0.18 }
      );
    }

    if (S.scene === "title"){
      drawTitle(g);
    } else {
      drawTopBar(g);
      drawEnemyHand(g);
      drawBattleCenter(g);
      drawPlayerHand(g);
      drawFloaters(g, ox, oy);

      if (S.scene === "over"){
        drawResult(g);
      }
    }

    g.text(
      "rev1",
      g.W - 8,
      14,
      12,
      "#ffffff55",
      "right"
    );
  },
});
})();
