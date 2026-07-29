(function(){
"use strict";
// 絵文字ボム解体 rev1 — 協力推理(ボムバスターズ型)
// あなた + AI3人。同じ数字の線を2本ずつ切って全部外す。ミス3回で爆発。

var REV = "rev1";
var VMAX = 6;            // 数字は 1〜6
var COPIES = 4;          // 各数字は4本(=2ペア)
var SLOTS = 7;           // 1人7本
var NAMES = ["あなた", "ネコ", "クマ", "ウサギ"];
var ICONS = ["🙂", "🐱", "🐻", "🐰"];
var ROW_Y = [352, 118, 188, 258];   // 0=自分, 1..3=AI
var SLOT_X0 = 178, SLOT_W = 76, SLOT_GAP = 86;
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
    players.push({ name: NAMES[p], icon: ICONS[p], hand: hand, ann: ann });
  }
  S = {
    scene: "title",
    players: players,
    turn: 0,
    mistakes: 0,
    maxMistakes: 3,
    hints: 4,
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
  // 3) 確実な手がなければ、自分の持ち数を正直に申告する(情報提供)
  var best = -1;
  for (var v = 1; v <= VMAX; v++){
    if (S.players[p].ann[v] >= 0) continue;
    if (remainingGlobal(v) <= 0) continue;
    var n = 0;
    for (i = 0; i < h.length; i++) if (!h[i].bomb && h[i].v === v) n++;
    if (n > 0){ best = v; break; }
    if (best < 0) best = v;
  }
  if (best > 0){
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
  if (bestMove) return declare(g, p, bestMove.i, bestMove.q, bestMove.k);
  pushLog(S.players[p].icon + " 「…わからない、まかせた」");
  return false;
}

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
      if (g.pressed("action") || g.pointer.justDown){ S.scene = "play"; g.se("click"); }
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
      g.emoji("💣", g.W / 2, 150, 88);
      g.text("絵文字ボム解体", g.W / 2, 250, 46);
      g.text("AI3人と協力。同じ数字の線を2本ずつ切っていく", g.W / 2, 300, 22, "#ffd");
      g.text("自分の線をえらぶ → 同じ数字だと思う相手の線をクリック", g.W / 2, 336, 20, "#9fd");
      g.text("外れたらミス。3回で爆発。💣は切れない", g.W / 2, 368, 20, "#f9a");
      g.text("クリック か スペース でスタート", g.W / 2, 440, 24, "#fff");
      g.text(REV, g.W - 12, 24, 16, "#889", "right");
      return;
    }

    // 上のバー
    g.text("💣 絵文字ボム解体", 14, 26, 22, "#fff", "left");
    g.text(REV, g.W - 12, 22, 16, "#889", "right");
    var mtxt = "";
    for (var m = 0; m < S.maxMistakes; m++) mtxt += (m < S.mistakes ? "❌" : "・");
    g.text("ミス " + mtxt, 250, 26, 22, "#f99", "left");
    g.text("📢ヒント 残り " + S.hints, 420, 26, 22, "#9df", "left");

    // 残り本数の表
    for (var v = 1; v <= VMAX; v++){
      var x = 588 + (v - 1) * 60;
      var r = remainingGlobal(v);
      g.rect(x, 8, 54, 36, r > 0 ? "#26304a" : "#1a1f2c");
      g.text(String(v), x + 16, 34, 22, r > 0 ? "#fff" : "#555");
      g.text("残" + r, x + 40, 32, 15, r > 0 ? "#9fd" : "#555");
    }

    // 各プレイヤーの列
    for (var p = 0; p < 4; p++){
      var yy = ROW_Y[p];
      var mine = (p === 0);
      g.emoji(S.players[p].icon, 60, yy + (mine ? 28 : 22), mine ? 46 : 38);
      g.text(S.players[p].name, 120, yy + (mine ? 34 : 28), 20, S.turn === p ? "#ffd76a" : "#bbb", "left");
      if (S.turn === p) g.text("▶", 24, yy + (mine ? 30 : 24), 22, "#ffd76a");

      // 申告メモ
      var memo = "";
      for (var v2 = 1; v2 <= VMAX; v2++){
        if (S.players[p].ann[v2] >= 0) memo += v2 + ":" + S.players[p].ann[v2] + "本 ";
      }
      if (memo) g.text(memo, 790, yy + (mine ? 18 : 16), 15, "#8ad", "left");

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

    // ログ
    for (var L = 0; L < S.log.length; L++){
      g.text(S.log[L], 24, 452 + L * 26, 18, L === S.log.length - 1 ? "#fff" : "#98a2c0", "left");
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
