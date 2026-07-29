(function(){
"use strict";

const THEMES = [
  {
    icon: "🍎",
    name: "くだもの",
    words: [
      "りんご", "ばなな", "みかん", "いちご",
      "ぶどう", "さくらんぼ", "めろん", "すいか",
      "ようなし", "あんず", "れもん", "きうい"
    ]
  },
  {
    icon: "🐶",
    name: "どうぶつ",
    words: [
      "はむすたー", "かめれおん", "うさぎ", "きりん",
      "ぱんだ", "らくだ", "くじら", "ごりら",
      "きつね", "たぬき", "あらいぐま", "にほんざる"
    ]
  },
  {
    icon: "🍙",
    name: "たべもの",
    words: [
      "おすし", "かれー", "うどん", "ぱすた",
      "はんばーぐ", "おでん", "ぎょうざ", "さらだ",
      "ぷりん", "けーき", "みそしる", "どーなつ"
    ]
  },
  {
    icon: "🚗",
    name: "のりもの",
    words: [
      "でんしゃ", "ぱとかー", "ふぇりー", "ひこうき",
      "じてんしゃ", "たくしー", "ばいく", "とらっく",
      "きしゃ", "ろけっと", "よっと", "たんかー"
    ]
  }
];

const LETTERS = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "し", "す", "せ", "そ",
  "た", "ち", "つ", "て", "と",
  "な", "に", "ぬ", "ね", "の",
  "は", "ひ", "ふ", "へ", "ほ",
  "ま", "み", "む", "め", "も",
  "や", "ゆ", "よ",
  "ら", "り", "る", "れ", "ろ",
  "わ", "を", "ん",
  "が", "ぎ", "ぐ", "げ", "ご",
  "ざ", "じ", "ず", "ぜ", "ぞ",
  "だ", "ぢ", "づ", "で", "ど",
  "ば", "び", "ぶ", "べ", "ぼ",
  "ぱ", "ぴ", "ぷ", "ぺ", "ぽ",
  "ゃ", "ゅ", "ょ", "っ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ",
  "ー"
];

/* 小文字は「や」等と見分けにくいので、マスの色を変えて区別する */
const SMALL_LETTERS = ["ゃ", "ゅ", "ょ", "っ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ"];

const LEVELS = [
  { id: "easy",   name: "やさしい", how: "ランダム",   note: "言葉当てなし" },
  { id: "normal", name: "ふつう",   how: "絞り込み",   note: "最頻出の文字" },
  { id: "hard",   name: "つよい",   how: "完全思考",   note: "半分割＋賭け" }
];

let S;

function pointInRect(g, x, y, w, h){
  return g.pointer.x >= x &&
    g.pointer.x <= x + w &&
    g.pointer.y >= y &&
    g.pointer.y <= y + h;
}

function wordChars(word){
  return Array.from(word);
}

function randomWords(g, words, count){
  let pool = words.slice();
  const result = [];

  while (pool.length > 0 && result.length < count){
    const picked = g.pick(pool);
    result.push(picked);
    pool = pool.filter(function(word){
      return word !== picked;
    });
  }

  return result;
}

function makeMask(word){
  return wordChars(word).map(function(){
    return false;
  });
}

function revealedCount(mask){
  return mask.filter(function(open){
    return open;
  }).length;
}

function allRevealed(mask){
  return mask.length > 0 && revealedCount(mask) === mask.length;
}

function addLog(message){
  S.logs.push(message);
  if (S.logs.length > 3){
    S.logs = S.logs.filter(function(_, index){
      return index >= S.logs.length - 3;
    });
  }
}

function emptySide(){
  return {
    word: "",
    revealed: [],
    declared: [],
    hits: [],
    misses: [],
    candidates: []
  };
}

function reset(g){
  S = {
    scene: "title",
    themeIndex: -1,
    theme: null,
    wordChoices: [],
    player: emptySide(),
    cpu: emptySide(),
    level: "",
    levelName: "",
    turn: "player",
    cpuWait: 0,
    guessing: false,
    logs: [],
    moves: 0,
    winner: "",
    resultReason: ""
  };
}

function returnToTheme(){
  S.scene = "theme";
  S.themeIndex = -1;
  S.theme = null;
  S.wordChoices = [];
  S.player = emptySide();
  S.cpu = emptySide();
  S.level = "";
  S.levelName = "";
  S.turn = "player";
  S.cpuWait = 0;
  S.guessing = false;
  S.logs = [];
  S.moves = 0;
  S.winner = "";
  S.resultReason = "";
}

function chooseTheme(g, index){
  S.themeIndex = index;
  S.theme = THEMES[index];
  S.wordChoices = randomWords(g, S.theme.words, 6);
  S.scene = "word";
}

function choosePlayerWord(word){
  S.player.word = word;
  S.player.revealed = makeMask(word);
  S.scene = "level";
}

function startBattle(g, level){
  const cpuWords = S.theme.words.filter(function(word){
    return word !== S.player.word;
  });

  S.level = level.id;
  S.levelName = level.name;
  S.cpu.word = g.pick(cpuWords);
  S.cpu.revealed = makeMask(S.cpu.word);
  S.cpu.candidates = S.theme.words.filter(function(word){
    return word !== S.cpu.word;
  });
  S.player.declared = [];
  S.player.hits = [];
  S.player.misses = [];
  S.cpu.declared = [];
  S.cpu.hits = [];
  S.cpu.misses = [];
  S.turn = "player";
  S.cpuWait = 0;
  S.guessing = false;
  S.logs = [];
  S.moves = 0;
  S.winner = "";
  S.resultReason = "";
  S.scene = "play";
  addLog("あなたの先攻です");
}

function revealLetter(word, mask, letter){
  const chars = wordChars(word);
  let hit = false;

  chars.forEach(function(char, index){
    if (char === letter){
      mask[index] = true;
      hit = true;
    }
  });

  return hit;
}

function revealRandom(g, mask){
  const closed = [];

  mask.forEach(function(open, index){
    if (!open){
      closed.push(index);
    }
  });

  if (closed.length === 0){
    return false;
  }

  mask[g.pick(closed)] = true;
  return true;
}

function finishGame(winner, reason){
  S.winner = winner;
  S.resultReason = reason;
  S.guessing = false;
  S.scene = "result";
}

function checkWordRevealWinner(target){
  if (target === "cpu" && allRevealed(S.cpu.revealed)){
    finishGame("player", "CPUのことばをすべて公開した");
    return true;
  }

  if (target === "player" && allRevealed(S.player.revealed)){
    finishGame("cpu", "あなたのことばをすべて公開した");
    return true;
  }

  return false;
}

function endPlayerTurn(){
  S.turn = "cpu";
  S.cpuWait = 0;
}

function endCpuTurn(){
  S.turn = "player";
  S.cpuWait = 0;
  addLog("あなたの番です");
}

function playerDeclare(g, letter){
  if (S.player.declared.indexOf(letter) >= 0){
    return;
  }

  S.player.declared.push(letter);
  S.moves += 1;

  if (revealLetter(S.cpu.word, S.cpu.revealed, letter)){
    S.player.hits.push(letter);
    addLog("「" + letter + "」は 当たり!");
    g.se("hit");

    if (checkWordRevealWinner("cpu")){
      return;
    }
  } else {
    S.player.misses.push(letter);
    addLog("「" + letter + "」は はずれ!");
    g.se("click");
  }

  endPlayerTurn();
}

function guessDisabled(word){
  if (word === S.player.word){
    return true;
  }

  return S.player.misses.some(function(letter){
    return word.indexOf(letter) >= 0;
  });
}

function playerGuess(g, word){
  if (guessDisabled(word)){
    return;
  }

  S.guessing = false;
  S.moves += 1;

  if (word === S.cpu.word){
    g.se("clear");
    finishGame("player", "言葉を当てた");
    return;
  }

  revealRandom(g, S.player.revealed);
  addLog("「" + word + "」ではなかった!");
  addLog("自分のことばが1文字公開された");
  g.se("boom");

  if (checkWordRevealWinner("player")){
    return;
  }

  endPlayerTurn();
}

function filterCpuCandidates(){
  const answer = wordChars(S.player.word);

  S.cpu.candidates = S.cpu.candidates.filter(function(word){
    return S.cpu.hits.every(function(letter){
      return word.indexOf(letter) >= 0;
    });
  });

  S.cpu.candidates = S.cpu.candidates.filter(function(word){
    return S.cpu.misses.every(function(letter){
      return word.indexOf(letter) < 0;
    });
  });

  S.cpu.candidates = S.cpu.candidates.filter(function(word){
    const chars = wordChars(word);

    if (chars.length !== S.player.revealed.length){
      return false;
    }

    return S.player.revealed.every(function(open, index){
      return !open || chars[index] === answer[index];
    });
  });
}

function availableCpuLetters(){
  return LETTERS.filter(function(letter){
    return S.cpu.declared.indexOf(letter) < 0;
  });
}

function countCandidatesWith(candidates, letter){
  let count = 0;

  candidates.forEach(function(word){
    if (word.indexOf(letter) >= 0){
      count += 1;
    }
  });

  return count;
}

function mostFrequentLetter(candidates, available){
  let best = available[0];
  let bestCount = -1;

  available.forEach(function(letter){
    const count = countCandidatesWith(candidates, letter);

    if (count > bestCount){
      best = letter;
      bestCount = count;
    }
  });

  return best;
}

function bestSplitLetter(candidates, available){
  let best = available[0];
  let bestDistance = Infinity;
  let bestCount = -1;
  const half = candidates.length / 2;

  available.forEach(function(letter){
    const count = countCandidatesWith(candidates, letter);
    const distance = Math.abs(count - half);

    if (
      distance < bestDistance ||
      (distance === bestDistance && count > bestCount)
    ){
      best = letter;
      bestDistance = distance;
      bestCount = count;
    }
  });

  return best;
}

function cpuShouldGuess(){
  if (S.level === "easy"){
    return false;
  }

  if (S.cpu.candidates.length === 1){
    return true;
  }

  if (
    S.level === "hard" &&
    S.cpu.candidates.length <= 2 &&
    S.cpu.revealed.length - revealedCount(S.cpu.revealed) === 1
  ){
    return true;
  }

  return false;
}

function cpuGuess(g){
  const guess = g.pick(S.cpu.candidates);
  S.moves += 1;

  if (guess === S.player.word){
    addLog("CPUが「" + guess + "」を当てた!");
    g.se("clear");
    finishGame("cpu", "CPUが言葉を当てた");
    return;
  }

  revealRandom(g, S.cpu.revealed);
  addLog("CPUの「" + guess + "」は はずれ!");
  addLog("CPUのことばが1文字公開された");
  g.se("boom");

  S.cpu.candidates = S.cpu.candidates.filter(function(word){
    return word !== guess;
  });

  if (checkWordRevealWinner("cpu")){
    return;
  }

  endCpuTurn();
}

function cpuDeclare(g, letter){
  S.cpu.declared.push(letter);
  S.moves += 1;

  if (revealLetter(S.player.word, S.player.revealed, letter)){
    S.cpu.hits.push(letter);
    addLog("CPUが「" + letter + "」を当てた!");
    g.se("hit");

    if (checkWordRevealWinner("player")){
      return;
    }
  } else {
    S.cpu.misses.push(letter);
    addLog("CPUの「" + letter + "」は はずれ!");
    g.se("click");
  }

  endCpuTurn();
}

function cpuAct(g){
  const available = availableCpuLetters();

  if (S.level !== "easy"){
    filterCpuCandidates();
  }

  if (S.cpu.candidates.length > 0 && cpuShouldGuess()){
    cpuGuess(g);
    return;
  }

  if (available.length === 0){
    if (S.level !== "easy" && S.cpu.candidates.length > 0){
      cpuGuess(g);
    } else {
      endCpuTurn();
    }
    return;
  }

  let letter;

  if (S.level === "easy"){
    letter = g.pick(available);
  } else if (S.cpu.candidates.length === 0){
    letter = g.pick(available);
  } else if (S.level === "normal"){
    letter = mostFrequentLetter(S.cpu.candidates, available);
  } else {
    letter = bestSplitLetter(S.cpu.candidates, available);
  }

  cpuDeclare(g, letter);
}

function updateTitle(g){
  if (g.pointer.justDown || g.pressed("action")){
    S.scene = "theme";
    g.se("click");
  }
}

function updateTheme(g){
  if (!g.pointer.justDown){
    return;
  }

  THEMES.forEach(function(_, index){
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 150 + col * 350;
    const y = 145 + row * 150;

    if (pointInRect(g, x, y, 310, 115)){
      chooseTheme(g, index);
      g.se("click");
    }
  });
}

function updateWord(g){
  if (!g.pointer.justDown){
    return;
  }

  S.wordChoices.forEach(function(word, index){
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 165 + col * 330;
    const y = 165 + row * 105;

    if (pointInRect(g, x, y, 300, 75)){
      choosePlayerWord(word);
      g.se("click");
    }
  });
}

function updateLevel(g){
  if (!g.pointer.justDown){
    return;
  }

  LEVELS.forEach(function(level, index){
    const x = 160 + index * 230;
    const y = 180;

    if (pointInRect(g, x, y, 200, 180)){
      startBattle(g, level);
      g.se("click");
    }
  });
}

function updateGuessing(g){
  if (!g.pointer.justDown){
    return;
  }

  if (pointInRect(g, 360, 440, 240, 42)){
    S.guessing = false;
    g.se("click");
    return;
  }

  S.theme.words.forEach(function(word, index){
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 90 + col * 270;
    const y = 150 + row * 68;

    if (!guessDisabled(word) && pointInRect(g, x, y, 240, 52)){
      playerGuess(g, word);
    }
  });
}

function updatePlay(g, dt){
  if (S.guessing){
    updateGuessing(g);
    return;
  }

  if (S.turn === "cpu"){
    S.cpuWait += 1 * dt;

    if (S.cpuWait >= 0.8){
      S.cpuWait = 0;
      cpuAct(g);
    }
    return;
  }

  if (!g.pointer.justDown){
    return;
  }

  if (pointInRect(g, 85, 394, 300, 52)){
    S.guessing = true;
    g.se("click");
    return;
  }

  LETTERS.forEach(function(letter, index){
    const col = index % 10;
    const row = Math.floor(index / 10);
    const x = 476 + col * 47;
    const y = 66 + row * 43;

    if (
      S.player.declared.indexOf(letter) < 0 &&
      pointInRect(g, x, y, 42, 37)
    ){
      playerDeclare(g, letter);
    }
  });
}

function updateResult(g){
  if (g.pointer.justDown || g.pressed("action")){
    returnToTheme();
    g.se("click");
  }
}

function drawHeader(g){
  g.rect(0, 0, 960, 46, "#172033");
  g.text("あいうえバトル", 18, 24, 24, "#ffffff", "left");

  if (S.theme){
    g.text(
      "お題:" + S.theme.icon + S.theme.name,
      250,
      24,
      20,
      "#ffe9a8",
      "left"
    );
  }

  if (S.levelName){
    g.text(S.levelName, 660, 24, 20, "#9de7ff", "left");
  }

  g.text("rev1", 942, 24, 16, "#aeb9cc", "right");
}

function drawButton(g, x, y, w, h, color, label, size, textColor){
  g.rect(x, y, w, h, color);
  g.text(label, x + w / 2, y + h / 2, size, textColor);
}

function drawTitle(g){
  g.emoji("🔤", 480, 150, 100);
  g.text("あいうえバトル", 480, 265, 52, "#ffffff");
  g.text(
    "1文字ずつ攻撃して相手の言葉を暴く読み合い",
    480,
    325,
    23,
    "#dce9ff"
  );
  drawButton(
    g,
    300,
    385,
    360,
    72,
    "#e28a28",
    "クリックでスタート",
    27,
    "#ffffff"
  );
}

function drawTheme(g){
  g.text("お題を選んでください", 480, 96, 31, "#ffffff");

  THEMES.forEach(function(theme, index){
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 150 + col * 350;
    const y = 145 + row * 150;

    g.rect(x, y, 310, 115, "#2c4567");
    g.emoji(theme.icon, x + 65, y + 57, 58);
    g.text(theme.name, x + 185, y + 57, 28, "#ffffff");
  });
}

function drawWord(g){
  g.text("自分のことばを選んでください", 480, 110, 29, "#ffffff");
  g.text(
    "この言葉をCPUから守ります",
    480,
    145,
    19,
    "#ffe9a8"
  );

  S.wordChoices.forEach(function(word, index){
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 165 + col * 330;
    const y = 165 + row * 105;

    drawButton(g, x, y, 300, 75, "#315b82", word, 28, "#ffffff");
  });
}

function drawLevel(g){
  g.text("CPUの強さを選んでください", 480, 115, 31, "#ffffff");

  LEVELS.forEach(function(level, index){
    const x = 160 + index * 230;
    const y = 180;
    const colors = ["#4c8a62", "#426f9d", "#9a4c4c"];

    g.rect(x, y, 200, 180, colors[index]);
    g.text(level.name, x + 100, y + 55, 30, "#ffffff");
    g.text(level.how, x + 100, y + 110, 20, "#fff4c4");
    g.text(level.note, x + 100, y + 145, 17, "#ffffff");
  });
}

function drawWordMask(g, word, mask, x, y, hidden){
  const chars = wordChars(word);
  const cellW = 52;
  const gap = 8;
  const total = chars.length * cellW + (chars.length - 1) * gap;
  const startX = x - total / 2;

  chars.forEach(function(char, index){
    const cellX = startX + index * (cellW + gap);

    g.rect(cellX, y, cellW, 52, mask[index] ? "#e28a28" : "#31445e");
    g.text(
      mask[index] || !hidden ? char : "？",
      cellX + cellW / 2,
      y + 26,
      29,
      "#ffffff"
    );
  });
}

function drawLetterPanel(g){
  LETTERS.forEach(function(letter, index){
    const col = index % 10;
    const row = Math.floor(index / 10);
    const x = 476 + col * 47;
    const y = 66 + row * 43;
    const hit = S.player.hits.indexOf(letter) >= 0;
    const miss = S.player.misses.indexOf(letter) >= 0;
    let color = SMALL_LETTERS.indexOf(letter) >= 0 ? "#3f7157" : "#315b82";
    let textColor = "#ffffff";

    if (hit){
      color = "#e28a28";
    } else if (miss){
      color = "#5d626b";
      textColor = "#c5c8ce";
    } else if (S.turn !== "player"){
      color = "#263647";
      textColor = "#7e8996";
    }

    g.rect(x, y, 42, 37, color);
    g.text(letter, x + 21, y + 19, 21, textColor);
  });

  if (S.turn === "cpu"){
    g.rect(500, 200, 410, 70, "#172033");
    g.text("CPUが考えています…", 705, 235, 26, "#fff2b6");
  }
}

function drawLogs(g){
  g.rect(0, 470, 960, 70, "#172033");
  g.text("ログ:", 18, 492, 17, "#9de7ff", "left");

  S.logs.forEach(function(log, index){
    g.text(log, 82, 490 + index * 18, 16, "#ffffff", "left");
  });
}

function drawBattle(g){
  g.rect(0, 46, 470, 424, "#202d43");
  g.rect(470, 46, 490, 424, "#1b2639");

  g.emoji("🤖", 42, 91, 38);
  g.text("CPUのことば", 70, 91, 22, "#ffffff", "left");
  drawWordMask(g, S.cpu.word, S.cpu.revealed, 235, 120, true);

  g.emoji("😀", 42, 251, 38);
  g.text("じぶんのことば", 70, 251, 22, "#ffffff", "left");
  drawWordMask(g, S.player.word, S.player.revealed, 235, 280, false);

  g.text(
    S.turn === "player" ? "あなたの番です" : "CPUの番です",
    235,
    365,
    23,
    S.turn === "player" ? "#9dffb7" : "#ffe79d"
  );

  drawButton(
    g,
    85,
    394,
    300,
    52,
    S.turn === "player" ? "#b65353" : "#4b5360",
    "言葉を当てる!",
    24,
    "#ffffff"
  );

  drawLetterPanel(g);
  drawLogs(g);
}

function drawGuessing(g){
  g.rect(45, 65, 870, 425, "#172033");
  g.text("言葉を当てる", 480, 95, 31, "#ffffff");
  g.text(
    "CPUのことばだと思う候補を選んでください",
    480,
    128,
    18,
    "#dce9ff"
  );

  S.theme.words.forEach(function(word, index){
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 90 + col * 270;
    const y = 150 + row * 68;
    const disabled = guessDisabled(word);

    g.rect(x, y, 240, 52, disabled ? "#3c4149" : "#315b82");
    g.text(
      word,
      x + 120,
      y + 26,
      23,
      disabled ? "#777d86" : "#ffffff"
    );
  });

  drawButton(
    g,
    360,
    440,
    240,
    42,
    "#5d626b",
    "もどる",
    21,
    "#ffffff"
  );
}

function drawResult(g){
  const playerWon = S.winner === "player";

  g.emoji(playerWon ? "🏆" : "😢", 480, 135, 95);
  g.text(
    playerWon ? "勝ち!" : "負け…",
    480,
    235,
    48,
    playerWon ? "#ffe071" : "#b9c7db"
  );

  g.text(
    "CPUのことばは『" + S.cpu.word + "』でした",
    480,
    300,
    27,
    "#ffffff"
  );
  g.text(S.resultReason, 480, 342, 20, "#dce9ff");
  g.text(S.moves + "手で決着", 480, 380, 22, "#ffe9a8");

  drawButton(
    g,
    300,
    420,
    360,
    60,
    "#315b82",
    "クリックでお題選びへ",
    24,
    "#ffffff"
  );
}

EmojiEngine.register({
  id: "aiue",
  name: "あいうえバトル",
  icon: "🔤",
  desc: "1文字ずつ攻撃して相手の言葉を暴く読み合い",

  init(g){
    reset(g);
    this._state = S;
  },

  update(g, dt){
    if (S.scene === "title"){
      updateTitle(g);
      return;
    }

    if (S.scene === "theme"){
      updateTheme(g);
      return;
    }

    if (S.scene === "word"){
      updateWord(g);
      return;
    }

    if (S.scene === "level"){
      updateLevel(g);
      return;
    }

    if (S.scene === "play"){
      updatePlay(g, dt);
      return;
    }

    if (S.scene === "result"){
      updateResult(g);
    }
  },

  draw(g){
    g.bg("#111827");
    drawHeader(g);

    if (S.scene === "title"){
      drawTitle(g);
      return;
    }

    if (S.scene === "theme"){
      drawTheme(g);
      return;
    }

    if (S.scene === "word"){
      drawWord(g);
      return;
    }

    if (S.scene === "level"){
      drawLevel(g);
      return;
    }

    if (S.scene === "play"){
      drawBattle(g);

      if (S.guessing){
        drawGuessing(g);
      }
      return;
    }

    if (S.scene === "result"){
      drawResult(g);
    }
  }
});
})();
