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
    "ここで戻るのは損だ",
    "この下に本命がある",
    "帰り道?　あとで考える"
  ],
  turn: [
    "よし、もう帰る",
    "命あっての宝だ",
    "先に上がらせてもらう",
    "ここらが潮時だ",
    "深追いはしない主義でね"
  ],
  pickup: [
    "これは当たりだ!",
    "重いが持ってく",
    "もらった",
    "手にした瞬間が一番うまい",
    "重さは覚悟のうちだ"
  ],
  pass: [
    "こんな石ころ要らん",
    "見送りだ",
    "荷物は増やさない",
    "足が遅くなるのはごめんだ",
    "拾わない勇気だ"
  ],
  lowOxygen: [
    "おい、誰か戻れよ",
    "息が…",
    "まだ潜ってる奴がいる",
    "空気を吸ってるのは誰だ",
    "ここからは早い者勝ちだぞ"
  ],
  drowned: [
    "うわああああ",
    "欲張った…",
    "来年また来る",
    "海は嘘をつかない…",
    "手が…宝が…"
  ],
  deepPlayer: [
    "あいつ正気か?",
    "巻き添えはごめんだ",
    "あの深さから戻れると思うなよ",
    "見ろ、沈む奴の顔だ"
  ],
  rival: [
    "先に上がりやがった",
    "抜け駆けか",
    "こっちはまだ海の中だぞ",
    "薄情な奴だ"
  ]
};


// ===== あなたが出せるセリフ(エモート) =====
// 画面右下の4つのボタン。押すと吹き出しが出て、CPUが返事をする。
// 増やしたいときはここに1つ足す(ボタンは自動で並ぶ)。
const EMOTES = [
  { icon: "😤", label: "まだ潜る", text: "まだ潜るぞ!", kind: "replyDive" },
  { icon: "🙏", label: "戻ってくれ", text: "頼む、そろそろ戻ってくれ", kind: "replyBack" },
  { icon: "👋", label: "先に上がる", text: "悪いな、先に上がらせてもらう", kind: "replyBye" },
  { icon: "😱", label: "あぶない!", text: "酸素が無い! みんな急げ!", kind: "replyDanger" }
];

// エモートへの返事(キャラ固有が無ければこの共通から出る)
const REPLY_LINES = {
  replyDive: [
    "その意気やよし",
    "ならこっちも降りるか",
    "無茶をするな…",
    "付き合いきれん"
  ],
  replyBack: [
    "断る",
    "あと1マスだけ待て",
    "分かった、戻る",
    "自分が先に戻れよ"
  ],
  replyBye: [
    "抜け駆けか!",
    "見送ってやる",
    "運が良かったな",
    "こっちはまだ拾うぞ"
  ],
  replyDanger: [
    "分かってる!",
    "騒ぐな、集中できん",
    "うわ、本当だ",
    "誰のせいだと思ってる"
  ]
};

// ===== 参加キャラ(この6人から毎回3人が抽選で参加。増やすときはここに足す) =====
const CHARACTERS = [
  {
    type: "greedy", name: "よくばり", icon: "😎",
    lines: {
      replyDive: ["いいねえ、道連れだ"],
      replyBack: ["断る。まだ足りない"],
      replyBye: ["その程度で満足か?"],
      replyDanger: ["まだ2、3マスいけるだろ"],
      dive: ["まだイケる…!", "宝は下にあるんだよ", "引き返す奴は二流だ", "1枚多く持つのが勝ちだ", "空気なら余ってるだろ"],
      turn: ["ちっ、ここまでか", "今回は預けておいてやる", "潮の流れが悪い"],
      pickup: ["これは当たりだ!", "全部おれのだ", "もっとよこせ", "重い=高いってことだ"],
      drowned: ["うわああああ", "あと1マスだったのに…", "宝と一緒に沈むなら本望だ"],
      pass: ["拾わない選択肢なんて無い"],
      lowOxygen: ["まだ2、3手はいけるだろ"],
      rival: ["逃げ足だけは速いな", "小者の帰り方だ"]
    }
  },
  {
    type: "smart", name: "かしこい", icon: "🧐",
    lines: {
      replyDive: ["君の残り酸素では厳しい"],
      replyBack: ["言われる前に戻っている"],
      replyBye: ["賢明だ。真似させてもらう"],
      replyDanger: ["把握済みだ。落ち着け"],
      dive: ["計算上まだ余裕がある", "酸素の配分は把握済みだ", "あと2手は安全圏だ", "期待値はまだプラスだ"],
      turn: ["ここが損益分岐点だ", "確率が悪くなった。撤退する", "欲は数字で切る"],
      pickup: ["価値のあるものだけ頂く", "これは持ち帰る価値がある", "重さの元は取れる"],
      pass: ["割に合わない", "重さに見合わないな"],
      lowOxygen: ["残り酸素、明らかに足りていない", "誰か1人は捨て駒になるぞ"],
      drowned: ["計算が甘かった…", "誤差の範囲を超えたか"],
      deepPlayer: ["あの深さは統計的に死ぬ"],
      rival: ["賢明な判断だ。悔しいが"]
    }
  },
  {
    type: "scared", name: "びびり", icon: "😰",
    lines: {
      replyDive: ["ぼ、僕は無理です…"],
      replyBack: ["それ僕が言いたかった!"],
      replyBye: ["待って、置いてかないで"],
      replyDanger: ["ひぃぃ! 帰る!"],
      dive: ["こ、怖くないもん", "もうちょっとだけ…", "み、みんな行くなら…"],
      turn: ["やっぱ帰る! 帰る!", "無理無理無理", "命だけは持って帰ります"],
      pickup: ["ふ、震えが止まらない", "これで十分です…", "え、拾っていいんですか"],
      pass: ["触ったら呪われそう", "持てません…"],
      lowOxygen: ["息が…!", "誰か助けて"],
      drowned: ["だから言ったのに…", "こんな終わり方いやだ"],
      deepPlayer: ["あの人こわい…"],
      rival: ["ずるい! 待ってよ!"]
    }
  },
  {
    type: "gambler", name: "ばくち", icon: "🤠",
    lines: {
      replyDive: ["おっ、勝負するねえ"],
      replyBack: ["博打に降りろとは言うなよ"],
      replyBye: ["逃げ足で勝つのも勝ちだ"],
      replyDanger: ["こういう場面が一番燃える"],
      dive: ["いくぜ、一発勝負!", "運は俺の味方だ", "ここで降りたら男が廃る", "ツキが来てる、乗るぜ"],
      turn: ["熱いうちに引くのが博打だ", "勝ち逃げさせてもらうぜ", "引き際で人生が決まる"],
      pickup: ["きたきたきた!", "この手ごたえ、大物だ", "当たりを引く男でね"],
      lowOxygen: ["残り少ないほど燃えるな"],
      drowned: ["ハハッ、大負けだ!", "こういう日もあるさ"],
      pass: ["こいつはハズレの手触りだ"],
      rival: ["逃げるが勝ちってやつか"],
      deepPlayer: ["おっ、いい度胸じゃねえか"]
    }
  },
  {
    type: "copycat", name: "しのび", icon: "🥷",
    lines: {
      replyDive: ["…ならば追う"],
      replyBack: ["…考えておく"],
      replyBye: ["…ならば我も"],
      replyDanger: ["…承知"],
      dive: ["…追う", "まだだ", "…影は離れぬ"],
      turn: ["…潮時", "…引く"],
      pickup: ["…いただく", "…この一枚で足りる"],
      pass: ["…不要"],
      lowOxygen: ["…息が続かぬ"],
      drowned: ["…無念", "…深追いした"],
      deepPlayer: ["…あの者、正気ではない"],
      rival: ["…先を越された"]
    }
  },
  {
    type: "veteran", name: "せんぱい", icon: "👴",
    lines: {
      replyDive: ["若いのは無茶をする"],
      replyBack: ["言われんでも戻る頃合いだ"],
      replyBye: ["それが正しい引き際だ"],
      replyDanger: ["騒ぐな。手が乱れる"],
      dive: ["浅い所の石など宝ではない", "本物は下にしかない", "若いのは焦りすぎだ", "40年潜れば分かる"],
      turn: ["いい物は取った。帰るぞ", "引き際こそ腕の見せ所だ", "欲をかいた奴から沈む"],
      pickup: ["これが本物の遺跡だ", "40年探してきた甲斐がある", "ようやく巡り会えた"],
      pass: ["こんなものは土産にもならん"],
      lowOxygen: ["昔はもっと粘れたがな", "そろそろ全員上がる頃合いだ"],
      drowned: ["…海はいつもこうだ", "わしの代で終わりか"],
      rival: ["若いのは逃げ足が速い"],
      deepPlayer: ["死ぬぞ、そこは"]
    }
  },
  {
    type: "robot", name: "きかいじん", icon: "🤖",
    lines: {
      replyDive: ["潜行継続を確認"],
      replyBack: ["要求を受理。浮上を検討する"],
      replyBye: ["離脱を記録した"],
      replyDanger: ["警告は既に出している"],
      dive: ["規定深度まで潜行を継続", "許容範囲内。続行", "目標まであと少し"],
      turn: ["目標数を確保。浮上する", "任務完了。帰投"],
      pickup: ["回収完了", "積載量、あと少し", "サンプル確保"],
      pass: ["対象外", "積載上限。回収せず"],
      lowOxygen: ["酸素残量、危険域", "全員に警告。浮上を推奨"],
      drowned: ["機能停止…", "回収失敗"],
      deepPlayer: ["あの深度からの帰還確率、低"],
      rival: ["先行者を確認"]
    }
  },
  {
    type: "rookie", name: "しんじん", icon: "👶",
    lines: {
      replyDive: ["オレも行きます!"],
      replyBack: ["え、もうダメなんすか"],
      replyBye: ["ずるいっすよ!"],
      replyDanger: ["どうすればいいんすか!"],
      dive: ["まだ行けます!", "先輩、ここ宝だらけっす", "オレ、才能あるかも"],
      turn: ["あ、これヤバいやつだ", "戻ります戻ります"],
      pickup: ["やった、初の宝!", "全部持って帰りたい", "これ高いやつでしょ?"],
      pass: ["え、拾わない方がいいんすか"],
      lowOxygen: ["酸素ってこんな減るんすね", "先輩どうすれば"],
      drowned: ["聞いてないっすよ…", "next time…"],
      deepPlayer: ["あの人すげえ…"],
      rival: ["え、もう帰るんすか?"]
    }
  },
  {
    type: "moody", name: "きまぐれ", icon: "😇",
    lines: {
      replyDive: ["ふーん"],
      replyBack: ["やだ"],
      replyBye: ["ばいばい"],
      replyDanger: ["さわがしい"],
      dive: ["なんとなく、もぐる", "そんな気分", "呼ばれた気がする"],
      turn: ["飽きた", "そろそろ帰ろっと", "なんとなく、いや"],
      pickup: ["きれいだから拾う", "これ好き"],
      pass: ["これはいらない", "ぴんとこない"],
      lowOxygen: ["息って、しなきゃだめ?"],
      drowned: ["あらら", "まあいっか"],
      deepPlayer: ["たのしそう"],
      rival: ["ばいばーい"]
    }
  },
  {
    type: "tycoon", name: "しゃちょう", icon: "🤑",
    lines: {
      replyDive: ["度胸は評価する"],
      replyBack: ["指図を受ける立場ではない"],
      replyBye: ["利益確定か。悪くない"],
      replyDanger: ["損失は最小化する"],
      dive: ["安い物には興味が無くてね", "投資は深い所にする主義だ", "下だ。下まで行きたまえ"],
      turn: ["利益は確定させるものだ", "十分だ。撤収する"],
      pickup: ["これは値が付く", "資産として持ち帰る"],
      pass: ["二束三文だ", "価値が無い。置いていけ"],
      lowOxygen: ["酸素も有限の資源だぞ", "誰かが損をかぶる番だ"],
      drowned: ["全額、損失だ…", "こんな損切りは初めてだ"],
      deepPlayer: ["無謀と度胸は違うぞ"],
      rival: ["逃げ切ったか。やるな"]
    }
  }
];

let S;
let ROUNDS = 3;   // タイトルで選ぶラウンド数(3〜6)。次の対戦にも引き継ぐ

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
  S.lastTurn = false;
  S.replies = [];
  S.emoteCd = 0;
  S.bubbles = [];
  S.roundSummary = [];
  S.lostThisRound = [];
  S.roundReason = "";
  S.viewFirst = 1;
  S.viewFollow = true;
  S.dragX = null;
  S.fx = [];
  S.flash = 0;
  S.shake = 0;
  S.resultTime = 0;
  S.revealed = 0;

  for (i = 0; i < S.players.length; i += 1) {
    S.players[i].pos = 0;
    S.players[i].returning = false;
    S.players[i].returned = false;
    S.players[i].held = [];
  }
}

// ===== 演出(粒子とフラッシュ) =====
function spawnFx(g, emoji, x, y, count, opt) {
  const o = opt || {};
  let i;

  for (i = 0; i < count; i += 1) {
    S.fx.push({
      e: emoji,
      x: x + g.rand(-(o.spread || 30), o.spread || 30),
      y: y + g.rand(-14, 14),
      vx: g.rand(o.vx0 === undefined ? -60 : o.vx0, o.vx1 === undefined ? 60 : o.vx1),
      vy: g.rand(o.vy0 === undefined ? -140 : o.vy0, o.vy1 === undefined ? -40 : o.vy1),
      grav: o.grav === undefined ? 60 : o.grav,
      life: g.rand(o.life0 || 1.0, o.life1 || 2.0),
      age: 0,
      size: g.rand(o.size0 || 20, o.size1 || 36),
      spin: g.rand(-3, 3)
    });
  }

  if (S.fx.length > 160) {
    S.fx = S.fx.slice(S.fx.length - 160);
  }
}

function updateFx(dt) {
  let i;
  let f;

  for (i = 0; i < S.fx.length; i += 1) {
    f = S.fx[i];
    f.age += dt;
    f.vy += f.grav * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }

  S.fx = S.fx.filter(function(p) {
    return p.age < p.life;
  });

  if (S.flash > 0) {
    S.flash -= dt;
  }
  if (S.shake > 0) {
    S.shake -= dt;
  }
}

function drawFx(g) {
  let i;
  let f;
  let alpha;

  for (i = 0; i < S.fx.length; i += 1) {
    f = S.fx[i];
    alpha = g.clamp(1 - f.age / f.life, 0, 1);
    g.emoji(f.e, f.x, f.y, f.size, { alpha: alpha, rot: f.spin * f.age });
  }
}

// 画面全体を一瞬染める(赤=事故 / 金=祝い)
function drawFlash(g, color) {
  const a = g.clamp(S.flash, 0, 1);
  let hex;

  if (a <= 0) {
    return;
  }

  hex = Math.round(a * 105).toString(16);
  if (hex.length < 2) {
    hex = "0" + hex;
  }
  g.rect(0, 0, g.W, g.H, color + hex);
}

function insidePointer(g, x, y, w, h) {
  return g.pointer.x >= x &&
    g.pointer.x <= x + w &&
    g.pointer.y >= y &&
    g.pointer.y <= y + h;
}

function pushBubble(g, player, text) {
  S.bubbles = S.bubbles.filter(function(bubble) {
    return bubble.playerId !== player.id;
  });

  S.bubbles.push({ playerId: player.id, text: text, time: 1.6 });
}

function addBubble(g, player, kind) {
  let pool;

  if (!player || !player.cpu) {
    return;
  }

  // キャラ固有のセリフがあればそれを、無ければ共通のセリフを使う
  pool = (player.lines && player.lines[kind]) ? player.lines[kind] : (LINES[kind] || REPLY_LINES[kind]);

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

// あなたがエモートを出す。数人のCPUが少し遅れて返事をする
function sayEmote(g, index) {
  const emote = EMOTES[index];
  const me = S.players[0];
  const others = [];
  let i;
  let delay = 0.45;

  if (!emote || S.emoteCd > 0) {
    return;
  }

  S.emoteCd = 1.1;
  pushBubble(g, me, emote.text);
  g.se("click");

  for (i = 1; i < S.players.length; i += 1) {
    if (!S.players[i].returned) {
      others.push(S.players[i]);
    }
  }

  shuffle(g, others);

  // 全員が一斉に喋るとうるさいので、最大2人が返す
  for (i = 0; i < others.length && i < 2; i += 1) {
    if (i === 0 || g.rand(0, 1) < 0.6) {
      S.replies.push({ playerId: others[i].id, kind: emote.kind, delay: delay });
      delay += 0.55;
    }
  }
}

function updateReplies(g, dt) {
  let i;
  let r;
  const ready = [];

  if (S.emoteCd > 0) {
    S.emoteCd -= dt;
  }

  for (i = 0; i < S.replies.length; i += 1) {
    r = S.replies[i];
    r.delay -= dt;
    if (r.delay <= 0) {
      ready.push(r);
    }
  }

  S.replies = S.replies.filter(function(x) {
    return x.delay > 0;
  });

  for (i = 0; i < ready.length; i += 1) {
    addBubble(g, S.players[ready[i].playerId], ready[i].kind);
  }
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

function nextTurn(g) {
  let tries = 0;

  // 酸素が尽きた人の手番が終わった瞬間にラウンド終了(その人の行動は済んでいる)
  if (S.lastTurn) {
    triggerOxygenEnd(g);
    return;
  }

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
  S.resultTime = 0;
  S.revealed = 0;
  S.fx = [];
  S.flash = drowned ? 0.7 : 0;
  S.scene = "round";
  S.phase = "";
  S.timer = 0;
  S.dice = null;
}

function triggerOxygenEnd(g) {
  let i;
  let point;

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
  S.timer = 2.8;

  // 派手にする: 画面が赤く光り、沈んだ人から泡と髑髏が噴き出す
  S.flash = 1.0;
  S.shake = 0.6;
  spawnFx(g, "🫧", 480, 300, 26, { spread: 300, vy0: -220, vy1: -90, grav: 20, size0: 14, size1: 30, life0: 1.4, life1: 2.6 });

  for (i = 0; i < S.players.length; i += 1) {
    if (!S.players[i].returned) {
      point = playerScreenPosition(S.players[i], 0);
      spawnFx(g, "💀", point.x, point.y, 3, { spread: 18, vy0: -160, vy1: -70, size0: 26, size1: 40 });
      spawnFx(g, "💦", point.x, point.y, 6, { spread: 22, vy0: -200, vy1: -80, size0: 16, size1: 28 });
    }
  }

  g.se("boom");
  g.se("hit");
}

function beginTurn(g) {
  const player = S.players[S.turn];
  let i;

  if (player.returned) {
    nextTurn(g);
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

  // 酸素が尽きても、この人の手番だけは最後まで行える(帰り着ければ助かる)
  if (S.oxygen <= 0 && !S.lastTurn) {
    S.lastTurn = true;
    S.message = "酸素が尽きた! " + player.name + "の手番が最後だ";
    S.messageTimer = 2.4;
    S.flash = 0.8;
    spawnFx(g, "🫧", 480, 300, 14, { spread: 260, vy0: -200, vy1: -80, grav: 20, size0: 12, size1: 26 });
    g.se("hit");
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
  veteran: 1.3,
  robot: 1.5,
  rookie: 0.7,
  moody: 1.1,
  tycoon: 1.1
};

function shouldCpuReturn(g, player) {
  let i;

  if (player.returning) {
    return true;
  }

  // 潜水艦にいるうちは引き返せない
  if (player.pos <= 0) {
    return false;
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

  // きかいじん: 決めた枚数(3枚)を回収したら機械的に帰投
  if (player.type === "robot") {
    return player.held.length >= 3;
  }

  // しんじん: 恐れを知らない。上の共通判断だけが歯止め
  if (player.type === "rookie") {
    return false;
  }

  // きまぐれ: 毎回サイコロを振るように気分で決める
  if (player.type === "moody") {
    return g.rand(0, 1) < 0.22;
  }

  // しゃちょう: 高いものを2枚確保したら利益確定
  if (player.type === "tycoon") {
    return player.held.length >= 2;
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
  if (shouldCpuReturn(g, player)) {
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
    spawnFx(g, "💦", 260, TILE_Y - 30, 10, { spread: 26, vy0: -230, vy1: -110, grav: 30, size0: 14, size1: 26 });
    if (player.held.length > 0) {
      spawnFx(g, "💰", 260, TILE_Y - 40, player.held.length * 2, { spread: 24, vy0: -190, vy1: -90, size0: 20, size1: 32 });
    }
    g.se("clear");

    // 先に上がられた奴のくやしがり(海に残っている1人だけが反応する)
    for (i = 0; i < S.players.length; i += 1) {
      if (S.players[i].cpu && !S.players[i].returned) {
        addBubble(g, S.players[i], "rival");
        break;
      }
    }

    nextTurn(g);
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
  veteran: 3,
  robot: 3,
  rookie: 4,
  moody: 3,
  tycoon: 2
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

  if (player.type === "robot") {
    return chip.tier >= 2;
  }

  if (player.type === "rookie") {
    return true;
  }

  if (player.type === "moody") {
    return chip.tier !== 2;
  }

  if (player.type === "tycoon") {
    return chip.tier >= 3;
  }

  return false;
}

function pickupChip(g, player) {
  const tile = S.path[player.pos - 1];
  let point;
  let chip;

  if (!tile || !tile.chip) {
    return;
  }

  chip = tile.chip;
  player.held.push(chip);
  tile.chip = null;
  addBubble(g, player, "pickup");
  point = playerScreenPosition(player, 0);
  spawnFx(g, chip.tier >= 3 ? "✨" : "💠", point.x, point.y, chip.tier + 2,
    { spread: 16, vy0: -150, vy1: -60, size0: 16, size1: 28, life0: 0.6, life1: 1.1 });
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

// タイトルから対戦を始める(Sは作り直さず中身を入れ替える)
function startGame(g) {
  S.round = 1;
  S.maxRounds = ROUNDS;
  S.players = makePlayers(g);
  S.path = [];
  S.startTurn = Math.floor(g.rand(0, 4));
  resetRound(g);
  S.scene = "play";
  g.se("click");
}

function drawTitle(g) {
  let i;
  let x;
  let y;
  let on;

  g.bg("#061d35");
  drawFx(g);

  g.text("海底探検", g.W / 2, 74, 46, "#dffaff", "center");
  g.emoji("🚢", g.W / 2, 128, 62);
  g.text("酸素はみんなの共有。欲張ると全員沈む", g.W / 2, 186, 21, "#b9eaff", "center");

  for (i = 0; i < CHARACTERS.length; i += 1) {
    x = g.W / 2 - (CHARACTERS.length - 1) * 66 / 2 + i * 66;
    g.emoji(CHARACTERS[i].icon, x, 234, 34);
    g.text(CHARACTERS[i].name, x, 262, 10, "#9fd0e8", "center");
  }

  g.text("この" + CHARACTERS.length + "人から3人が参加(毎回かわる)", g.W / 2, 288, 16, "#7fb8d4", "center");
  g.text("進む数 = サイコロ1〜3が2個 − 荷物の数。他の人がいるマスは数えずに飛び越える", g.W / 2, 312, 13, "#6f9bb5", "center");

  // ラウンド数えらび
  g.text("何ラウンド遊ぶ?", g.W / 2, 352, 17, "#dffaff", "center");
  for (i = 3; i <= 6; i += 1) {
    x = g.W / 2 - 2 * 76 + (i - 3) * 76 + 38;
    y = 366;
    on = (ROUNDS === i);
    g.rect(x - 32, y, 64, 40, on ? "#ffcc4d" : "#14496b");
    g.text(String(i), x, y + 29, 24, on ? "#20304a" : "#cfe9f7", "center");

    if (insidePointer(g, x - 32, y, 64, 40) && g.pointer.justDown) {
      ROUNDS = i;
      g.se("click");
    }
  }
  g.text("ラウンドを重ねるほど道が短くなり底の高得点まで届く", g.W / 2, 428, 13, "#6f9bb5", "center");

  // スタート
  g.rect(300, 452, 360, 52, "#19a6b3");
  g.text("クリックして潜る", g.W / 2, 486, 25, "#ffffff", "center");
  if (insidePointer(g, 300, 452, 360, 52) && g.pointer.justDown) {
    startGame(g);
  }
}

function drawOxygen(g) {
  const ratio = g.clamp(S.oxygen / 25, 0, 1);
  const color = S.oxygen < 10 ? "#ef4141" : "#35d39a";

  g.text("共有酸素", 480, 24, 18, "#d9f5ff", "center");
  g.rect(330, 34, 300, 24, "#16364d");
  g.rect(334, 38, 292 * ratio, 16, color);
  g.text(
    S.oxygen <= 0 ? "0 / 25  酸素切れ!" : String(S.oxygen) + " / 25",
    480,
    53,
    17,
    S.oxygen <= 0 && Math.sin(g.time * 12) > 0 ? "#ff6b6b" : "#ffffff",
    "center"
  );
  g.text("ROUND " + S.round + " / " + S.maxRounds, 835, 36, 19, "#d9f5ff", "center");
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
  g.emoji("🚢", 262, TILE_Y + 8, 38);
  g.text("潜水艦", 262, TILE_Y + 38, 11, "#dffaff", "center");
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
      if (tile.chip.parts > 1) {
        // 沈んだ人が落として、まとめられた宝(1マス=荷物1個ぶんの重さ)
        g.rect(x - 19, TILE_Y - 20, 38, 12, "#ffcc4d");
        g.text("×" + tile.chip.parts + " まとめ", x, TILE_Y - 11, 9, "#3a2a00", "center");
      }
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
    return { x: 248 + stack * 22, y: TILE_Y - 28, off: false };
  }

  x = screenXForPosition(player.pos, first);

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
      if (tile.chip.parts > 1) {
        g.rect(x, 408, Math.max(2, step - 1), 4, "#ffcc4d");
      }
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

// 吹き出しを横に並べて、はみ出したら上の段へ送る(誰の発言かは引き出し線で示す)
function layoutBubbles(g) {
  const items = [];
  const rows = [268, 224, 180];
  const left = 246;
  const right = 950;
  let i;
  let bubble;
  let player;
  let point;
  let row = 0;
  let cursor = left;
  let width;

  for (i = 0; i < S.bubbles.length; i += 1) {
    bubble = S.bubbles[i];
    player = S.players[bubble.playerId];

    if (!player) {
      continue;
    }

    point = bubblePlayerScreenPosition(player);
    width = Math.max(120, bubble.text.length * 16 + 24);

    if (cursor + width > right && row < rows.length - 1) {
      row += 1;
      cursor = left;
    }

    items.push({
      text: bubble.text,
      cpu: player.cpu,
      w: width,
      x: cursor + width / 2,
      y: rows[row],
      px: point.off ? cursor + width / 2 : point.x,
      py: point.off ? rows[row] + 20 : point.y + 22,
      off: point.off
    });

    cursor += width + 10;
  }

  return items;
}

function drawBubbles(g) {
  const items = layoutBubbles(g);
  let i;
  let b;

  for (i = 0; i < items.length; i += 1) {
    b = items[i];

    // 誰が言ったかの引き出し線
    if (!b.off) {
      g.rect(b.px - 1, b.y + 12, 2, Math.max(2, b.py - b.y - 14), b.cpu ? "#ffffff88" : "#ffeaa088");
      g.rect(Math.min(b.x, b.px), b.y + 12, Math.abs(b.x - b.px) + 2, 2, b.cpu ? "#ffffff88" : "#ffeaa088");
    }

    g.rect(b.x - b.w / 2, b.y - 26, b.w, 38, b.cpu ? "#ffffff" : "#ffeaa0");
    g.text(b.text, b.x, b.y - 1, 16, "#173047", "center");
  }
}

function drawDice(g) {
  if (!S.dice || S.phase === "drownedPause") {
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

    // 潜水艦にいるうちは引き返せない(まだ潜っていないため)
    if (!player.returning && player.pos > 0) {
      if (button(g, 500, 476, 190, 52, "ひきかえす", "#da7a39")) {
        player.returning = true;
        g.se("click");
        rollDice(g, player);
      }
    } else if (!player.returning) {
      g.text("潜水艦からは引き返せない", 595, 508, 15, "#5f829a", "center");
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

function drawEmoteButtons(g) {
  const w = 56;
  const h = 50;
  const top = 474;
  let i;
  let x;
  let hover;

  g.text("ひとこと(いつでも押せる)", 821, 466, 12, "#7fb8d4", "center");

  for (i = 0; i < EMOTES.length; i += 1) {
    x = 700 + i * (w + 6);
    hover = insidePointer(g, x, top, w, h);

    g.rect(x, top, w, h, S.emoteCd > 0 ? "#1b3247" : (hover ? "#2f6e94" : "#14496b"));
    g.emoji(EMOTES[i].icon, x + w / 2, top + 19, 24, { alpha: S.emoteCd > 0 ? 0.45 : 1 });
    g.text(EMOTES[i].label, x + w / 2, top + 44, 10, "#cfe9f7", "center");

    if (hover && g.pointer.justDown) {
      sayEmote(g, i);
    }
  }
}

function drawPlay(g) {
  g.bg("#061d35");
  handleView(g);
  drawOxygen(g);
  drawScoreboard(g);
  drawPath(g);
  drawPlayers(g);
  drawMinimap(g);
  drawViewControls(g);
  drawDice(g);
  drawTurnInfo(g);
  drawBubbles(g);
  drawPlayerControls(g);
  drawEmoteButtons(g);
  drawFx(g);
  drawFlash(g, "#ff2b2b");

  // 酸素が尽きた後の「最後の手番」を知らせる
  if (S.lastTurn && S.phase !== "drownedPause") {
    g.rect(300, 196, 360, 44, "#7a1420dd");
    g.text("酸素ゼロ! これが最後の手番", 480, 214, 19, "#ffd7d7", "center");
    g.text(
      S.players[S.turn].id === 0 ? "帰り着ければ助かる" : S.players[S.turn].name + "の行動が終わると全員沈む",
      480,
      234,
      14,
      "#ffb0b0",
      "center"
    );
  }

  // 酸素切れの瞬間だけ、大きく出す
  if (S.phase === "drownedPause") {
    g.rect(240, 84, 480, 92, "#5a0f1acc");
    g.text(
      "酸素が尽きた!!",
      480,
      132,
      Math.round(44 + Math.sin(S.timer * 12) * 5),
      "#ffdddd",
      "center"
    );
    g.text("海に残っていた人は遺跡を全部失った", 480, 164, 18, "#ffb0b0", "center");
  }
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
  const drowned = S.roundReason === "酸素が尽きた!";
  let i;
  let row;
  let y;
  let t;
  let shown;
  let pulse;

  g.bg(drowned ? "#2a0d14" : "#071f38");
  drawFx(g);

  pulse = 1 + Math.sin(S.resultTime * 7) * (S.resultTime < 1.2 ? 0.09 : 0.02);
  g.text("第" + S.round + "ラウンド結果", 480, 60, 38, "#e2f8ff", "center");
  g.text(
    drowned ? "💀 酸素が尽きた!" : "🎉 全員が潜水艦に帰還",
    480,
    102,
    Math.round(24 * pulse),
    drowned ? "#ff6b6b" : "#78efb8",
    "center"
  );

  g.rect(205, 126, 550, 272, "#0d304d");

  for (i = 0; i < S.roundSummary.length; i += 1) {
    if (i >= S.revealed) {
      break;
    }

    row = S.roundSummary[i];
    y = 172 + i * 54;
    t = g.clamp((S.resultTime - i * 0.4) / 0.5, 0, 1);
    shown = Math.round(row.gained * t);

    g.emoji(row.icon, 245, y - 7, row.success ? 34 : 30, { alpha: row.success ? 1 : 0.55 });
    g.text(row.name, 280, y, 20, row.success ? "#ffffff" : "#9fb4c4", "left");
    g.text(
      row.success ? "持ち帰り +" + shown : "💀 海中でロスト",
      500,
      y,
      18,
      row.success ? "#8fffc9" : "#ff8e8e",
      "center"
    );
    g.text("合計 " + (row.total - row.gained + shown) + "点", 720, y, 18, "#ffe28a", "right");
  }

  if (S.revealed >= S.roundSummary.length) {
    if (S.round < S.maxRounds) {
      if (S.removedTiles > 0) {
        g.text(
          "空になった" + S.removedTiles + "マスを取り除いて道が縮んだ(残り" + S.path.length + "マス)",
          480,
          428,
          18,
          "#8fd8ff",
          "center"
        );
        g.text("次のラウンドはもっと深くまで届く", 480, 452, 16, "#7fb8d4", "center");
      }
      g.text("クリックで次のラウンド", 480, 492, 23, "#ffffff", "center");
    } else {
      g.text("クリックで最終結果", 480, 492, 23, "#ffffff", "center");
    }
  }
}

// 結果画面の進行(1人ずつ出す・紙吹雪・沈んだ人の泡)
function updateResult(g, dt) {
  const drowned = S.roundReason === "酸素が尽きた!";
  const total = S.roundSummary.length;

  S.resultTime += dt;
  updateFx(dt);

  if (S.revealed < total && S.resultTime > S.revealed * 0.4) {
    S.revealed += 1;
    g.se(S.roundSummary[S.revealed - 1].success ? "coin" : "hit");

    if (S.roundSummary[S.revealed - 1].success) {
      spawnFx(g, "✨", 500, 172 + (S.revealed - 1) * 54 - 8, 5,
        { spread: 90, vy0: -120, vy1: -40, size0: 14, size1: 24, life0: 0.6, life1: 1.1 });
    } else {
      spawnFx(g, "🫧", 500, 172 + (S.revealed - 1) * 54 - 8, 5,
        { spread: 90, vy0: -100, vy1: -30, grav: 10, size0: 12, size1: 20, life0: 0.8, life1: 1.4 });
    }
  }

  if (S.revealed >= total && S.resultTime < total * 0.4 + 1.6) {
    if (drowned) {
      spawnFx(g, "🫧", g.rand(240, 720), 420, 1,
        { spread: 40, vy0: -150, vy1: -60, grav: 8, size0: 12, size1: 22, life0: 1.4, life1: 2.2 });
    } else {
      spawnFx(g, g.pick(["🎉", "✨", "🎊"]), g.rand(200, 760), -20, 1,
        { spread: 40, vy0: 40, vy1: 120, grav: 90, size0: 18, size1: 32, life0: 1.6, life1: 2.4 });
    }
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
  const playerWon = ranking[0].id === 0;
  let i;
  let player;
  let y;
  let pulse;

  g.bg("#06182d");
  drawFx(g);

  pulse = 1 + Math.sin(S.resultTime * 6) * 0.06;
  g.emoji("🏆", 480, 56, Math.round(52 * pulse));
  g.text(
    playerWon ? "あなたの勝ち!" : ranking[0].name + " の勝ち",
    480,
    112,
    Math.round(38 * pulse),
    playerWon ? "#ffe36e" : "#d8f3ff",
    "center"
  );

  g.rect(260, 138, 440, 262, "#0e304d");

  for (i = 0; i < ranking.length; i += 1) {
    if (i >= S.revealed) {
      break;
    }

    player = ranking[i];
    y = 186 + i * 55;

    if (i === 0) {
      g.rect(268, y - 30, 424, 44, "#3a3418");
      g.emoji("👑", 300, y - 26, 22);
    }

    g.text((i + 1) + "位", 302, y, 21, i === 0 ? "#ffe36e" : "#ffffff", "left");
    g.emoji(player.icon, 375, y - 8, 38);
    g.text(player.name, 410, y, 21, "#ffffff", "left");
    g.text(player.score + "点", 650, y, 22, "#8fffc9", "right");
  }

  if (S.revealed >= ranking.length) {
    g.rect(330, 450, 300, 52, "#168fa8");
    g.text("クリックでもう一度", 480, 483, 23, "#ffffff", "center");
  }
}

// 最終結果の進行(下位から1人ずつ出す・優勝者に紙吹雪)
function updateOver(g, dt) {
  const total = S.players.length;

  S.resultTime += dt;
  updateFx(dt);

  if (S.revealed < total && S.resultTime > S.revealed * 0.5) {
    S.revealed += 1;
    g.se(S.revealed === 1 ? "clear" : "coin");

    if (S.revealed === 1) {
      spawnFx(g, "🎉", 480, 200, 14, { spread: 220, vy0: -260, vy1: -120, grav: 140, size0: 20, size1: 40 });
      S.flash = 0.8;
    }
  }

  if (S.resultTime < 6) {
    spawnFx(g, g.pick(["🎉", "✨", "🎊", "💫"]), g.rand(180, 780), -20, 1,
      { spread: 40, vy0: 50, vy1: 130, grav: 90, size0: 16, size1: 30, life0: 1.6, life1: 2.6 });
  }
}

function updatePlay(g, dt) {
  const player = S.players[S.turn];

  updateBubbles(dt);
  updateFx(dt);
  updateReplies(g, dt);

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
      nextTurn(g);
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
    maxRounds: ROUNDS,
    lastTurn: false,
    replies: [],
    emoteCd: 0,
    fx: [],
    flash: 0,
    shake: 0,
    resultTime: 0,
    revealed: 0,
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
      updateFx(dt);
      if (g.pressed("action")) {
        startGame(g);
      }
      return;
    }

    if (S.scene === "play") {
      updatePlay(g, dt);
      return;
    }

    if (S.scene === "round") {
      updateBubbles(dt);
      updateResult(g, dt);

      if ((g.pointer.justDown || g.pressed("action")) && S.revealed >= S.roundSummary.length) {
        if (S.round >= S.maxRounds) {
          S.scene = "over";
          S.resultTime = 0;
          S.revealed = 0;
          S.fx = [];
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
      updateOver(g, dt);

      if ((g.pointer.justDown || g.pressed("action")) && S.revealed >= S.players.length) {
        S.scene = "title";
        S.fx = [];
        S.flash = 0;
        S.path = [];
        S.round = 1;
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
