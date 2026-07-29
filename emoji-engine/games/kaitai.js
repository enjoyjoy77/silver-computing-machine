(function(){
"use strict";
// 絵文字ボム解体 rev2 — 協力推理(ボムバスターズ型)
// あなた + AI3人。同じ数字の線を2本ずつ切って全部外す。ミス3回で爆発。

var REV = "rev2";
var VMAX = 8;            // 数字は 1〜8
var COPIES = 4;          // 各数字は4本(=2ペア)
var SLOTS = 9;           // 1人9本
var NAMES = ["あなた", "ネコ", "クマ", "ウサギ"];
var ICONS = ["🙂", "🐱", "🐻", "🐰"];
var ROW_Y = [352, 118, 188, 258];   // 0=自分, 1..3=AI
var SLOT_X0 = 150, SLOT_W = 62, SLOT_GAP = 70;
var HINT_BTN = { x: 786, y: 336, w: 152, h: 46 };

var S;

function reset(g){
  var deck = [];
  for (var v = 1; v <= VMAX; v++){
    for (var c = 0; c < COPIES; c++) deck.push({ v: v, bomb: false, cut: false, revealed: false });
  }
  for (var b = 0; b < 4; b++){
    deck.push({ v: Math.floor(g.rand(1, VMAX + 1)), bomb: true, cut: false, revealed: false });
  }
  // シャッフル
  for (var i = deck.length - 1; i > 0; i--){
    var j = Math.floor(g.rand(0, i + 1));
    var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }
  var players = [];
  for (var p = 0; p < 4; p++){
    var hand = deck.slice(p * SLOTS, (p + 1) * SLOTS);
    hand.sort(function(a, b2){ return a.v - b2.v; });
    var ann = [];
    for (var k = 0; k <= VMAX; k++) ann.push(-1);   // -1 = 未申告
    players.push({ name: NAMES[p], icon: ICONS[p], hand: hand, ann: ann, tells: 2 });
  }
  S = {
    scene: "title",
    page: 0,
    players: players,
    turn: 0,
    mistakes: 0,
    maxMistakes: 3,
    hints: 3,
    noAction: 0,
    sel: null,          // {p, i}
    mode: "normal",     // "normal" | "hint"
    log: ["数字が同じ2本を切って、全部外そう。"],
    aiTimer: 0,
    overTimer: 0,
    won: false,
    flash: 0,
  };
  // 開始時のサービス: AI3人がそれぞれ1つ、持ち数を正直に教えてくれる
  for (var q = 1; q <= 3; q++){
    var v2 = q + 1;   // 🐱=2, 🐻=3, 🐰=4
    var hh = S.players[q].hand, cnt = 0;
    for (var t = 0; t < hh.length; t++) if (!hh[t].bomb && hh[t].v === v2) cnt++;
    S.players[q].ann[v2] = cnt;
  }
  S.log.push("🐱🐻🐰 が最初に1つずつ持ち数を教えてくれた。");
  while (S.log.length > 3) S.log.shift();
}

/* ---------- 便利 ---------- */
function hand(p){ return S.players[p].hand; }
function isKnown(w){ return !w.bomb && (w.cut || w.revealed); }
function remainingGlobal(v){
  var n = COPIES;
  for (var p = 0; p < 4; p++){
    var h = hand(p);
    for (var i = 0; i < h.length; i++) if (!h[i].bomb && h[i].cut && h[i].v === v) n--;
  }
  return n;
}
function knownCountIn(p, v){
  var h = hand(p), n = 0;
  for (var i = 0; i < h.length; i++) if (isKnown(h[i]) && h[i].v === v) n++;
  return n;
}
// 並び順(小さい順)と公開情報から、そのマスに入りうる数字を出す
function cands(p, i){
  var h = hand(p);
  if (h[i].bomb || h[i].cut) return [];
  if (h[i].revealed) return [h[i].v];   // 一度ばれた線は数字が分かっている
  var lo = 1, hi = VMAX, j;
  for (j = i - 1; j >= 0; j--) if (isKnown(h[j])){ lo = Math.max(lo, h[j].v); break; }
  for (j = i + 1; j < h.length; j++) if (isKnown(h[j])){ hi = Math.min(hi, h[j].v); break; }
  var out = [];
  for (var v = lo; v <= hi; v++){
    if (remainingGlobal(v) <= 0) continue;
    var a = S.players[p].ann[v];
    if (a >= 0 && knownCountIn(p, v) >= a) continue;
    out.push(v);
  }
  return out;
}
function pushLog(msg){
  S.log.push(msg);
  while (S.log.length > 3) S.log.shift();
}
function allCut(){
  for (var p = 0; p < 4; p++){
    var h = hand(p);
    for (var i = 0; i < h.length; i++) if (!h[i].bomb && !h[i].cut) return false;
  }
  return true;
}
function hasWire(p){
  var h = hand(p);
  for (var i = 0; i < h.length; i++) if (!h[i].bomb && !h[i].cut) return true;
  return false;
}
// 手札が無い人は自動で飛ばす
function nextTurn(){
  for (var n = 0; n < 4; n++){
    S.turn = (S.turn + 1) % 4;
    if (hasWire(S.turn)) return;
  }
}

/* ---------- 宣言(切る) ---------- */
function declare(g, aP, aI, bP, bI){
  var A = hand(aP)[aI], B = hand(bP)[bI];
  var who = S.players[aP].icon;
  if (A.v === B.v){
    A.cut = true; A.revealed = true;
    B.cut = true; B.revealed = true;
    g.se("coin");
    pushLog(who + " 「" + S.players[bP].name + "の" + (bI + 1) + "番目も " + A.v + "」→ 成功! 2本切れた");
    if (allCut()){ S.scene = "over"; S.won = true; S.overTimer = 1.0; g.se("clear"); }
    return true;
  }
  A.revealed = true; B.revealed = true;
  S.mistakes++;
  S.flash = 0.5;
  g.se("hit");
  pushLog(who + " 「" + (bI + 1) + "番目も " + A.v + "」→ 外れ(" + B.v + ")。ミス " + S.mistakes + "/" + S.maxMistakes);
  if (S.mistakes >= S.maxMistakes){
    S.scene = "over"; S.won = false; S.overTimer = 1.0; g.se("boom");
  }
  return false;
}

/* ---------- AIの手番 ---------- */
function aiTurn(g, p){
  var h = hand(p), i, j;
  // 1) 自分の手札に同じ数字が2本あれば必ず切れる
  for (i = 0; i < h.length; i++){
    if (h[i].bomb || h[i].cut) continue;
    for (j = i + 1; j < h.length; j++){
      if (h[j].bomb || h[j].cut) continue;
      if (h[i].v === h[j].v){ return declare(g, p, i, p, j); }
    }
  }
  // 2) 他人のマスで数字が1つに確定しているところを狙う
  for (var q = 0; q < 4; q++){
    if (q === p) continue;
    var hq = hand(q);
    for (var k = 0; k < hq.length; k++){
      if (hq[k].bomb || hq[k].cut) continue;
      var c = cands(q, k);
      if (c.length !== 1) continue;
      for (i = 0; i < h.length; i++){
        if (!h[i].bomb && !h[i].cut && h[i].v === c[0]) return declare(g, p, i, q, k);
      }
    }
  }
  // 3) 確実な手がなければ、自分の持ち数を正直に申告する(1人2回まで)
  var best = -1;
  if (S.players[p].tells <= 0) best = -99;
  if (best !== -99)
  for (var v = 1; v <= VMAX; v++){
    if (S.players[p].ann[v] >= 0) continue;
    if (remainingGlobal(v) <= 0) continue;
    var n = 0;
    for (i = 0; i < h.length; i++) if (!h[i].bomb && h[i].v === v) n++;
    if (n > 0){ best = v; break; }
    if (best < 0) best = v;
  }
  if (best > 0){
    S.players[p].tells--;
    var cnt = 0;
    for (i = 0; i < h.length; i++) if (!h[i].bomb && h[i].v === best) cnt++;
    S.players[p].ann[best] = cnt;
    g.se("click");
    pushLog(S.players[p].icon + " 「" + best + " は " + cnt + "本 持ってる」");
    return false;
  }
  // 4) 教えられる情報も尽きたら、いちばん当たりそうな組に賭ける
  var bestMove = null, bestP = -1;
  for (i = 0; i < h.length; i++){
    if (h[i].bomb || h[i].cut) continue;
    for (var q2 = 0; q2 < 4; q2++){
      if (q2 === p) continue;
      var hq2 = hand(q2);
      for (var k2 = 0; k2 < hq2.length; k2++){
        if (hq2[k2].bomb || hq2[k2].cut) continue;
        var c2 = cands(q2, k2);
        if (c2.indexOf(h[i].v) < 0) continue;
        var pr = 1 / c2.length;
        if (pr > bestP){ bestP = pr; bestMove = { i: i, q: q2, k: k2 }; }
      }
    }
  }
  // 半々より分が良いときだけ賭ける。ただし全員が動けない状態が続いたら賭ける
  if (bestMove && (bestP >= 0.5 || S.noAction >= 3)){ S.noAction = 0; return declare(g, p, bestMove.i, bestMove.q, bestMove.k); }
  if (bestMove){ S.noAction++; pushLog(S.players[p].icon + " 「自信がない…まかせた」"); return false; }
  // 5) それでも手が無いなら、行き止まりを避けるため適当な組に賭ける
  for (i = 0; i < h.length; i++){
    if (h[i].bomb || h[i].cut) continue;
    for (var q3 = 0; q3 < 4; q3++){
      if (q3 === p) continue;
      var hq3 = hand(q3);
      for (var k3 = 0; k3 < hq3.length; k3++){
        if (hq3[k3].bomb || hq3[k3].cut) continue;
        return declare(g, p, i, q3, k3);
      }
    }
  }
  pushLog(S.players[p].icon + " 「…わからない、まかせた」");
  return false;
}

/* ---------- 説明画面用のカード枠 ---------- */
function card(g, x, y, w, h, col){ g.rect(x, y, w, h, col || "#2a3350"); }

/* ---------- クリック位置 ---------- */
function slotRect(p, i){
  return { x: SLOT_X0 + i * SLOT_GAP, y: ROW_Y[p], w: SLOT_W, h: p === 0 ? 58 : 48 };
}
function inRect(px, py, r){ return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
function hitSlot(px, py){
  for (var p = 0; p < 4; p++){
    for (var i = 0; i < SLOTS; i++){
      if (inRect(px, py, slotRect(p, i))) return { p: p, i: i };
    }
  }
  return null;
}
function hitRow(px, py){
  for (var p = 1; p < 4; p++){
    if (py >= ROW_Y[p] - 6 && py <= ROW_Y[p] + 54) return p;
  }
  return -1;
}

/* ---------- 本体 ---------- */
EmojiEngine.register({
  id: "kaitai",
  name: "絵文字ボム解体",
  icon: "💣",
  desc: "AI3人と協力。同じ数字の線を2本ずつ切って爆弾を止める推理ゲーム",

  init: function(g){ reset(g); this._state = S; },

  update: function(g, dt){
    if (S.flash > 0) S.flash -= dt;

    if (S.scene === "title"){
      if (g.pressed("action") || g.pointer.justDown){
        g.se("click");
        S.page++;
        if (S.page > 2) S.scene = "play";
      }
      return;
    }
    if (S.scene === "over"){
      if (S.overTimer > 0){ S.overTimer -= dt; return; }
      if (g.pressed("action") || g.pointer.justDown){
        reset(g); this._state = S; S.scene = "play"; g.se("click");
      }
      return;
    }

    // AIの手番
    if (S.turn !== 0){
      S.aiTimer -= dt;
      if (S.aiTimer <= 0){
        var again = aiTurn(g, S.turn);
        if (S.scene !== "play") return;
        S.aiTimer = 1.0;
        if (!again || !hasWire(S.turn)) nextTurn();
      }
      return;
    }

    // あなたの手番
    if (!g.pointer.justDown) return;
    var px = g.pointer.x, py = g.pointer.y;

    // ヒントボタン
    if (inRect(px, py, HINT_BTN)){
      if (S.hints <= 0){ pushLog("ヒントはもう残っていない。"); return; }
      if (!S.sel){ pushLog("先に自分の線を1本えらんでから ヒント を押す。"); return; }
      S.mode = (S.mode === "hint") ? "normal" : "hint";
      g.se("click");
      if (S.mode === "hint") pushLog("だれに聞く? 相手の列をクリック。");
      return;
    }

    // ヒントの相手えらび
    if (S.mode === "hint"){
      var rp = hitRow(px, py);
      if (rp > 0){
        var v = hand(0)[S.sel.i].v;
        var n = 0, hh = hand(rp);
        for (var t = 0; t < hh.length; t++) if (!hh[t].bomb && hh[t].v === v) n++;
        S.players[rp].ann[v] = n;
        S.hints--;
        S.mode = "normal";
        g.se("ping");
        pushLog(S.players[rp].icon + " 「" + v + " は " + n + "本 持ってる」(残りヒント " + S.hints + ")");
      }
      return;
    }

    var hitv = hitSlot(px, py);
    if (!hitv) return;
    var w = hand(hitv.p)[hitv.i];
    if (w.cut) return;
    if (w.bomb){ pushLog("💣 は切れない(でも並び順のヒントにはなる)。"); return; }

    if (!S.sel){
      if (hitv.p !== 0){ pushLog("まず自分の線を1本えらぶ。"); return; }
      S.sel = hitv; g.se("click"); return;
    }
    if (S.sel.p === hitv.p && S.sel.i === hitv.i){ S.sel = null; return; }

    var ok = declare(g, 0, S.sel.i, hitv.p, hitv.i);
    S.sel = null;
    if (S.scene !== "play") return;
    if (!ok || !hasWire(0)){ nextTurn(); S.aiTimer = 1.0; }
  },

  draw: function(g){
    g.bg(S.flash > 0 ? "#4a1420" : "#141b2e");

    if (S.scene === "title"){
      g.text(REV, g.W - 12, 24, 16, "#889", "right");

      if (S.page === 0){
        g.emoji("💣", g.W / 2, 148, 88);
        g.text("絵文字ボム解体", g.W / 2, 248, 46);
        g.text("AI3人と協力して、爆弾の線を全部切る推理ゲーム", g.W / 2, 300, 22, "#ffd");
        g.text("ルールを2枚で説明します", g.W / 2, 350, 20, "#9fd");
        g.text("クリックで次へ", g.W / 2, 452, 24, "#fff");
        return;
      }

      if (S.page === 1){
        g.text("① なにをするの?", g.W / 2, 56, 30, "#ffd76a");
        g.text("同じ数字の線を「2本セット」で切る", g.W / 2, 108, 28, "#fff");

        // 図: あなたの3 と 相手の?
        card(g, 200, 150, 90, 74, "#2a3350"); g.text("3", 245, 194, 40);
        g.text("あなた", 245, 246, 18, "#bbb");
        g.text("＋", 330, 190, 30, "#ffd");
        card(g, 380, 150, 90, 74, "#2a3350"); g.text("🎴", 425, 188, 30); g.text("3〜5", 425, 218, 16, "#8f9ac0");
        g.text("ネコ", 425, 246, 18, "#bbb");
        g.text("→", 500, 190, 30, "#ffd");
        card(g, 550, 150, 90, 74, "#1b2233"); g.text("✂", 595, 196, 34, "#7dfba0");
        card(g, 650, 150, 90, 74, "#1b2233"); g.text("✂", 695, 196, 34, "#7dfba0");
        g.text("同じ数字なら2本とも切れる", 645, 246, 18, "#7dfba0");

        g.text("切れるのは「自分の1本」＋「だれかの1本」。数字がちがったらミス。", g.W / 2, 300, 21, "#fff");
        g.text("ミス3回で爆発。💣は切れない(でも並び順のヒントになる)", g.W / 2, 336, 21, "#f9a");
        g.text("数字が見えているのは自分の手札だけ。相手の札は裏向き", g.W / 2, 372, 21, "#9fd");
        g.text("クリックで次へ", g.W / 2, 452, 24, "#fff");
        return;
      }

      g.text("② どうやって当てるの?", g.W / 2, 56, 30, "#ffd76a");
      g.text("手札は必ず「小さい順」に並んでいる", g.W / 2, 104, 28, "#fff");

      // 図: 3番目が4と分かっているとき、その左右が絞れる
      var bx = 250;
      for (var d = 0; d < 5; d++){
        var known = (d === 2);
        card(g, bx + d * 96, 140, 84, 70, known ? "#2a3350" : "#2a3350");
        if (known){
          g.text("4", bx + d * 96 + 42, 178, 34, "#ffd76a");
        } else {
          g.text("🎴", bx + d * 96 + 42, 172, 26);
          g.text(d < 2 ? "1〜4" : "4〜8", bx + d * 96 + 42, 198, 15, "#8f9ac0");
        }
      }
      g.text("← ここが 4 とわかると、左は4以下・右は4以上に絞れる →", g.W / 2, 234, 20, "#9fd");

      g.text("画面上の「残り本数」で、まだ切れていない数字も分かる", g.W / 2, 288, 21, "#fff");
      g.text("📢ヒントを使うと「その数字を何本持ってる?」と相手に聞ける(3回)", g.W / 2, 324, 21, "#fff");
      g.text("札の下の小さい数字は、その札にありうる数字の範囲です", g.W / 2, 360, 21, "#8ad");
      g.text("クリックではじめる", g.W / 2, 452, 26, "#7dfba0");
      return;
    }

    // 上のバー
    g.text("💣 絵文字ボム解体", 14, 26, 22, "#fff", "left");
    g.text(REV, g.W - 12, 22, 16, "#889", "right");
    var mtxt = "";
    for (var m = 0; m < S.maxMistakes; m++) mtxt += (m < S.mistakes ? "❌" : "・");
    g.text("ミス " + mtxt, 250, 26, 22, "#f99", "left");
    g.text("📢ヒント 残り " + S.hints, 430, 26, 22, "#9df", "left");
    g.text("残り本数", 30, 71, 16, "#8ad", "left");

    // 残り本数の表
    for (var v = 1; v <= VMAX; v++){
      var x = SLOT_X0 + (v - 1) * SLOT_GAP;
      var r = remainingGlobal(v);
      g.rect(x, 54, SLOT_W, 32, r > 0 ? "#26304a" : "#1a1f2c");
      g.text(String(v), x + 16, 71, 20, r > 0 ? "#fff" : "#555");
      g.text("残" + r, x + 42, 70, 14, r > 0 ? "#9fd" : "#555");
    }

    // 各プレイヤーの列
    for (var p = 0; p < 4; p++){
      var yy = ROW_Y[p];
      var mine = (p === 0);
      g.emoji(S.players[p].icon, 46, yy + (mine ? 28 : 22), mine ? 40 : 34);
      g.text(S.players[p].name, 70, yy + (mine ? 34 : 28), 17, S.turn === p ? "#ffd76a" : "#bbb", "left");
      if (S.turn === p) g.text("▶", 12, yy + (mine ? 30 : 24), 18, "#ffd76a");

      // 申告メモ(2段に分けて右側に置く)
      var memo = [];
      for (var v2 = 1; v2 <= VMAX; v2++){
        if (S.players[p].ann[v2] >= 0) memo.push(v2 + ":" + S.players[p].ann[v2] + "本");
      }
      if (memo.length && !mine){
        g.text(memo.slice(0, 4).join(" "), 782, yy + 12, 13, "#8ad", "left");
        if (memo.length > 4) g.text(memo.slice(4).join(" "), 782, yy + 30, 13, "#8ad", "left");
      }

      for (var i = 0; i < SLOTS; i++){
        var rc = slotRect(p, i), w = hand(p)[i];
        var sel = S.sel && S.sel.p === p && S.sel.i === i;
        var col = w.cut ? "#1b2233" : (sel ? "#6a5a20" : "#2a3350");
        g.rect(rc.x, rc.y, rc.w, rc.h, col);
        var cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
        if (w.cut){
          g.text("✂", cx, cy + 8, 22, "#556");
        } else if (w.bomb){
          g.emoji("💣", cx, cy, mine ? 34 : 28);
        } else if (mine || w.revealed){
          g.text(String(w.v), cx, cy + (mine ? 12 : 9), mine ? 34 : 28, w.revealed && !mine ? "#ffd76a" : "#fff");
        } else {
          var c = cands(p, i);
          var s = c.length === 1 ? String(c[0]) + "!" : (c.length ? c[0] + "〜" + c[c.length - 1] : "?");
          g.text("🎴", cx, cy + 2, 22);
          g.text(s, cx, cy + 20, 15, c.length === 1 ? "#7dfba0" : "#8f9ac0");
        }
        g.text(String(i + 1), rc.x + 6, rc.y + 14, 13, "#6a7492", "left");
      }
    }

    // ヒントボタン
    var hcol = S.mode === "hint" ? "#4a6a2a" : (S.hints > 0 ? "#26406a" : "#232838");
    g.rect(HINT_BTN.x, HINT_BTN.y, HINT_BTN.w, HINT_BTN.h, hcol);
    g.text("📢 ヒント×" + S.hints, HINT_BTN.x + HINT_BTN.w / 2, HINT_BTN.y + 30, 20, "#fff");

    // 凡例と、いま何をすればいいかの案内
    g.text("札の下の数字＝ありうる範囲", 782, 100, 14, "#8ad", "left");
    var guide;
    if (S.turn !== 0){
      guide = "🤖 " + S.players[S.turn].name + " が考えています…";
    } else if (S.mode === "hint"){
      guide = "📢 だれに聞く? 🐱🐻🐰 の列をクリック";
    } else if (!S.sel){
      guide = "① あなたの線を1本クリック(数字が見えているのがあなたの手札)";
    } else {
      guide = "② 「" + hand(0)[S.sel.i].v + "」と同じだと思う線をクリック(自分の別の線でもOK / もう一度押すと取消)";
    }
    g.rect(20, 416, 920, 30, "#1d2740");
    g.text(guide, 32, 431, 19, "#ffd76a", "left");

    // ログ
    for (var L = 0; L < S.log.length; L++){
      g.text(S.log[L], 24, 466 + L * 24, 18, L === S.log.length - 1 ? "#fff" : "#98a2c0", "left");
    }

    if (S.scene === "over"){
      g.rect(140, 130, 680, 280, "#0b1020");
      if (S.won){
        g.emoji("🎉", g.W / 2, 200, 62);
        g.text("解体成功!", g.W / 2, 268, 42, "#9f9");
        var rank = S.mistakes === 0 ? "🌟 完璧な解体班" : (S.mistakes === 1 ? "😄 上出来" : "😅 ぎりぎり");
        g.text(rank + "(ミス " + S.mistakes + " / 使ったヒント " + (3 - S.hints) + ")", g.W / 2, 316, 24, "#ffd");
      } else {
        g.emoji("💥", g.W / 2, 200, 62);
        g.text("爆発…", g.W / 2, 268, 42, "#f99");
        g.text("ミス3回。並び順と残り本数をもっと使おう", g.W / 2, 316, 22, "#ffd");
      }
      if (S.overTimer <= 0) g.text("クリックでもう一回", g.W / 2, 372, 22, "#fff");
    }
  },
});
})();
