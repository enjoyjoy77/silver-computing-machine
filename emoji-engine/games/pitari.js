(function(){
"use strict";
// 絵文字ぴたり rev1  設計書: 設計書_絵文字ぴたり_2026-07-29.md
var REV = "rev1";
var S;

var SLOTS = 6;                 // 並ぶ札の数(いちばん右が「?」)
var TOTAL_ROUNDS = 5;

var ANIMALS = ["🐸", "🐵", "🐷"];
var COLORS  = [
  { name:"あか",   hex:"#c0504d", light:"#e08b88" },
  { name:"きいろ", hex:"#b08a1e", light:"#e0c05a" },
  { name:"あお",   hex:"#3d6bb3", light:"#7fa5e0" },
];

// AI3体。axis は 0=動物 / 1=色 / 2=数字
var AIS = [
  { id:"fox",  name:"きつね",   emoji:"🦊", axis:2, color:"#e8a06a", word:"数字だけ見てる" },
  { id:"pen",  name:"ペンギン", emoji:"🐧", axis:1, color:"#8fb8e8", word:"服の色だけ見てる" },
  { id:"tur",  name:"かめ",     emoji:"🐢", axis:0, color:"#8fd0a0", word:"動物だけ見てる" },
];

var AXIS_LABEL = ["動物", "服の色", "数字"];
var PAT_LABEL = {
  same:   "ずっと おなじ",
  cycle:  "じゅんばんに ずれる",
  double: "2つずつ",
  bounce: "いったり きたり",
};

// ── 法則の総当たり生成 ────────────────────────────────
// M個の値(0〜M-1)で、6マスぶんの並びを作れる法則を全部列挙する。
// 出題の一意性チェック(下の pickSeq)に使うので、必ず全部そろえること。
function allPatterns(M){
  var out = [], s, d, i, vals;
  for(s=0; s<M; s++){
    vals = []; for(i=0;i<SLOTS;i++) vals.push(s);
    out.push({ name:"same", vals:vals });
  }
  for(s=0; s<M; s++) for(d=1; d<M; d++){
    vals = []; for(i=0;i<SLOTS;i++) vals.push((s + d*i) % M);
    out.push({ name:"cycle", vals:vals });
    vals = []; for(i=0;i<SLOTS;i++) vals.push((s + d*Math.floor(i/2)) % M);
    out.push({ name:"double", vals:vals });
  }
  var period = 2*M - 2;                       // いったりきたり(折り返し)
  if(period > 0){
    for(s=0; s<period; s++) for(d=1; d>=-1; d-=2){
      vals = [];
      for(i=0;i<SLOTS;i++){
        var k = ((s + d*i) % period + period) % period;
        vals.push(k < M ? k : period - k);
      }
      out.push({ name:"bounce", vals:vals });
    }
  }
  return out;
}
var PAT3 = allPatterns(3);
var PAT5 = allPatterns(5);

function shuffle(g, arr){
  var a = arr.slice(), i, j, t;
  for(i=a.length-1; i>0; i--){
    j = Math.floor(g.rand(0, i+1)); if(j>i) j=i; if(j<0) j=0;
    t=a[i]; a[i]=a[j]; a[j]=t;
  }
  return a;
}
function randInt(g, n){ var v = Math.floor(g.rand(0, n)); if(v>=n) v=n-1; if(v<0) v=0; return v; }

// 見えている5マスから別の答えが読めてしまう出題は捨てる。
// (ここが嘘をつくと「正解が2つある問題」になり、推理ゲームとして成立しない)
function pickSeq(g, list){
  for(var t=0; t<200; t++){
    var c = list[randInt(g, list.length)];
    var ok = true;
    for(var i=0;i<list.length;i++){
      var o = list[i], same = true;
      for(var k=0;k<SLOTS-1;k++) if(o.vals[k]!==c.vals[k]){ same=false; break; }
      if(same && o.vals[SLOTS-1]!==c.vals[SLOTS-1]){ ok=false; break; }
    }
    if(ok) return c;
  }
  return list[0];
}

function cardEq(a,b){ return a.a===b.a && a.c===b.c && a.n===b.n; }

function makeRound(g){
  var seqA = pickSeq(g, PAT3);     // 動物
  var seqC = pickSeq(g, PAT3);     // 色
  var seqN = pickSeq(g, PAT5);     // 数字(0〜4 で持ち、表示は+1)
  var row = [];
  for(var i=0;i<SLOTS;i++) row.push({ a:seqA.vals[i], c:seqC.vals[i], n:seqN.vals[i] });

  var truth = row[SLOTS-1];
  var pats  = [seqA.name, seqC.name, seqN.name];

  // 3本の軸を3枚の候補に割り振る(重なってよい=1枚に2本3本まとまる)
  var assign = [randInt(g,3), randInt(g,3), randInt(g,3)];
  var cands = null;
  for(var t=0; t<300 && !cands; t++){
    var list = [];
    for(var j=0;j<3;j++){
      var card = { a:0, c:0, n:0, axes:[] };
      var vals = [truth.a, truth.c, truth.n];
      var mods = [3, 3, 5];
      for(var ax=0; ax<3; ax++){
        var v;
        if(assign[ax]===j){ v = vals[ax]; card.axes.push(ax); }
        else { v = (vals[ax] + 1 + randInt(g, mods[ax]-1)) % mods[ax]; }   // わざと外す
        if(ax===0) card.a=v; else if(ax===1) card.c=v; else card.n=v;
      }
      list.push(card);
    }
    var dup = false;
    for(var x=0;x<3;x++) for(var y=x+1;y<3;y++) if(cardEq(list[x], list[y])) dup = true;
    if(!dup) cands = list;
  }
  if(!cands){                                        // 念のための保険(通常ここには来ない)
    cands = [
      { a:truth.a, c:truth.c, n:truth.n, axes:[0,1,2] },
      { a:(truth.a+1)%3, c:truth.c, n:(truth.n+1)%5, axes:[1] },
      { a:(truth.a+2)%3, c:(truth.c+1)%3, n:(truth.n+2)%5, axes:[] },
    ];
  }

  S.row = row;
  S.pats = pats;
  S.cands = shuffle(g, cands);
  S.picked = -1;
  S.judge = null;
  S.msg = "法則をいちばん多く通している札はどれ?";
  S.scene = "play";
}

function aiPick(ai){                                  // そのAIが選ぶ候補の番号
  for(var j=0;j<S.cands.length;j++){
    for(var k=0;k<S.cands[j].axes.length;k++) if(S.cands[j].axes[k]===ai.axis) return j;
  }
  return -1;
}

function doJudge(g){
  var mine = S.cands[S.picked];
  var agree = [], dis = [];
  for(var i=0;i<AIS.length;i++){
    if(aiPick(AIS[i])===S.picked) agree.push(AIS[i]); else dis.push(AIS[i]);
  }
  S.score += agree.length;
  var reveal = null;
  for(var d=0; d<dis.length; d++){                    // 外した相手の「見ている軸」が1つ明かされる
    if(!S.revealed[dis[d].id]){ S.revealed[dis[d].id] = true; reveal = dis[d]; break; }
  }
  // 3本ぜんぶが1枚にまとまった回だけ、本物が候補に出ている。それ以外の回は本物を見せて教える
  S.judge = { got:agree.length, agree:agree, mine:mine, truth:S.row[SLOTS-1], reveal:reveal };
  g.se(agree.length>=3 ? "clear" : agree.length>=1 ? "coin" : "hit");
  S.scene = "result";
  S.overTimer = 0;
}

function reset(g){
  S = {
    scene:"title", page:0, round:0, score:0,
    row:[], pats:["same","same","same"], cands:[], picked:-1,
    revealed:{}, judge:null, overTimer:0, msg:"",
  };
  for(var i=0;i<AIS.length;i++) S.revealed[AIS[i].id] = false;
}

// ── 当たり判定の枠 ────────────────────────────────────
function slotRect(i){ return { x:40 + i*146, y:120, w:132, h:150 }; }
function candRect(j){ return { x:140 + j*210, y:312, w:180, h:126 }; }
var BTN = { x:370, y:454, w:220, h:44 };
function inRect(p, r){ return p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h; }

// ── 描画の部品 ────────────────────────────────────────
function drawCard(g, x, y, w, h, card, big){
  var col = COLORS[card.c];
  var pad = big ? 16 : 12;                      // 色は「服」なので、面積を広く取らないと法則が読めない
  g.rect(x, y, w, h, col.hex);
  g.rect(x+pad, y+pad, w-pad*2, h*0.58 - pad, "#f4f1ea");
  g.emoji(ANIMALS[card.a], x+w/2, y+h*0.36, big ? 50 : 42);
  g.text(String(card.n+1), x+w/2, y+h*0.79, big ? 40 : 34, "#fff");
}

EmojiEngine.register({
  id:"pitari",
  name:"絵文字ぴたり",
  icon:"🎩",
  desc:"3本の法則を読んで「?」を当てる。通した本数がそのまま得点",

  init(g){ reset(g); this._state = S; },

  update(g, dt){
    if(S.scene==="title"){
      if(g.pressed("action") || g.pointer.justDown){ S.scene="howto"; S.page=0; g.se("click"); }
      return;
    }
    if(S.scene==="howto"){
      if(g.pressed("action") || g.pointer.justDown){
        S.page++; g.se("click");
        if(S.page>=2){ S.round=0; S.score=0; makeRound(g); }
      }
      return;
    }
    if(S.scene==="play"){
      if(!g.pointer.justDown) return;
      var p = g.pointer;
      for(var j=0;j<S.cands.length;j++){
        if(inRect(p, candRect(j))){
          S.picked = (S.picked===j) ? -1 : j;
          S.msg = (S.picked<0) ? "法則をいちばん多く通している札はどれ?" : "これでよければ決定を押す";
          g.se("click");
          return;
        }
      }
      if(inRect(p, BTN)){
        if(S.picked>=0) doJudge(g);
        else S.msg = "先に札を1枚えらんでね";
      }
      return;
    }
    if(S.scene==="result"){
      S.overTimer += dt;
      if(S.overTimer<1.0) return;                      // 連打で読み飛ばす事故を防ぐ
      if(g.pressed("action") || g.pointer.justDown){
        S.round++;
        if(S.round>=TOTAL_ROUNDS){ S.scene="over"; S.overTimer=0; }
        else makeRound(g);
      }
      return;
    }
    if(S.scene==="over"){
      S.overTimer += dt;
      if(S.overTimer<1.0) return;
      if(g.pressed("action") || g.pointer.justDown){ reset(g); this._state = S; S.scene="howto"; S.page=1; }
      return;
    }
  },

  draw(g){
    g.bg("#1d2233");
    g.text(REV, g.W-8, 14, 14, "#6a7391", "right");

    if(S.scene==="title"){
      g.text("🎩 絵文字ぴたり", g.W/2, 118, 46);
      g.text("ならんだ札から法則を見つけて、「?」に入る札を当てる", g.W/2, 190, 24, "#ffd");
      g.text("法則は3本。通した本数が、そのまま得点になる", g.W/2, 230, 22, "#8fb8e8");
      var demo = [{a:0,c:0,n:0},{a:1,c:1,n:1},{a:2,c:2,n:2}];
      for(var i=0;i<3;i++) drawCard(g, 330+i*100, 280, 84, 104, demo[i], false);
      g.text("?", 660, 332, 54, "#ffd166");
      g.text("クリック か スペース ではじめる", g.W/2, 450, 22, "#ffd");
      return;
    }

    if(S.scene==="howto"){
      if(S.page===0){
        g.text("あそびかた ①", g.W/2, 54, 34);
        g.text("札には【動物】【服の色】【数字】の3つが入っている", g.W/2, 104, 22, "#ffd");
        g.text("この3つには、それぞれ別の法則がかかっている", g.W/2, 140, 22, "#ffd");
        var r0 = [{a:0,c:0,n:0},{a:1,c:1,n:1},{a:2,c:2,n:2},{a:0,c:0,n:3}];
        for(var k=0;k<4;k++) drawCard(g, 210+k*110, 180, 96, 118, r0[k], false);
        g.text("?", 700, 240, 46, "#ffd166");
        g.text("法則は4しゅるい", g.W/2, 332, 20, "#8fd0a0");
        g.text("ずっとおなじ / じゅんばんにずれる / 2つずつ / いったりきたり", g.W/2, 366, 21, "#dfe5f5");
        g.text("クリックでつぎへ", g.W/2, 468, 22, "#ffd");
      } else {
        g.text("あそびかた ②", g.W/2, 54, 34);
        g.text("候補が3枚出る。【通した法則の本数】がそのまま得点", g.W/2, 100, 22, "#ffd");
        g.text("3本ぜんぶ通す当たり札が出る回もあれば、出ない回もある", g.W/2, 136, 22, "#ffd");
        g.rect(140, 172, 680, 118, "#2a3149");
        for(var m=0;m<AIS.length;m++){
          var ai = AIS[m];
          g.emoji(ai.emoji, 230+m*230, 214, 40);
          g.text(ai.name, 230+m*230, 254, 20, ai.color);
          g.text("なにを見てる?", 230+m*230, 278, 16, "#8a93b0");
        }
        g.text("3人はそれぞれ1本の法則しか見ていない。あなたの札と", g.W/2, 320, 21, "#dfe5f5");
        g.text("答えが合った人数 = 得点。だれが何を見ているかは伏せてある", g.W/2, 352, 21, "#dfe5f5");
        g.text("取りこぼしたラウンドで、1人ぶんずつ正体が明かされる", g.W/2, 392, 21, "#ffe08a");
        g.text("1回で0〜3点。全5ラウンドの合計で競う", g.W/2, 428, 21, "#8fd0a0");
        g.text("クリックではじめる", g.W/2, 468, 22, "#ffd");
      }
      return;
    }

    // 上部バー(終了画面では出さない。ラウンド数が「6 / 5」になってしまうため)
    if(S.scene!=="over"){
    g.text("ラウンド " + (S.round+1) + " / " + TOTAL_ROUNDS, 16, 26, 24, "#fff", "left");
    g.text("とくてん " + S.score, 250, 26, 24, "#ffd166", "left");
    for(var a=0;a<AIS.length;a++){
      var ax = AIS[a], bx = 520 + a*150;
      g.emoji(ax.emoji, bx, 24, 26);
      g.text(S.revealed[ax.id] ? AXIS_LABEL[ax.axis] : "?", bx+26, 26, 18,
             S.revealed[ax.id] ? ax.color : "#5c6484", "left");
    }
    }

    if(S.scene==="play"){
      for(var i=0;i<SLOTS;i++){
        var r = slotRect(i);
        if(i===SLOTS-1){
          g.rect(r.x, r.y, r.w, r.h, "#39415e");
          g.text("?", r.x+r.w/2, r.y+r.h/2, 62, "#ffd166");
        } else {
          drawCard(g, r.x, r.y, r.w, r.h, S.row[i], true);
        }
      }
      g.text("↓ どれが入る?", g.W/2, 292, 20, "#8a93b0");
      for(var j=0;j<S.cands.length;j++){
        var cr = candRect(j);
        if(S.picked===j) g.rect(cr.x-6, cr.y-6, cr.w+12, cr.h+12, "#ffd166");
        drawCard(g, cr.x, cr.y, cr.w, cr.h, S.cands[j], false);
      }
      g.rect(BTN.x, BTN.y, BTN.w, BTN.h, S.picked>=0 ? "#3d6bb3" : "#333a52");
      g.text("これで決定", BTN.x+BTN.w/2, BTN.y+22, 24);
      g.text(S.msg, 24, BTN.y+22, 19, "#aab", "left");
      return;
    }

    if(S.scene==="result"){
      var jd = S.judge;
      g.rect(60, 70, 840, 396, "#141826");
      g.rect(60, 70, 840, 6, jd.got>=3 ? "#7bd88f" : jd.got>=1 ? "#ffd166" : "#e07a7a");
      g.text(jd.got>=3 ? "🎉 3本ぜんぶ通した!" : jd.got>=1 ? "🙂 " + jd.got + "本 通った" : "😢 1本も通らなかった",
             g.W/2, 110, 32, jd.got>=3 ? "#7bd88f" : jd.got>=1 ? "#ffd166" : "#e07a7a");
      g.text("+" + jd.got + " てん", g.W/2, 148, 22, "#dfe5f5");

      g.text("えらんだ札", 148, 196, 19, "#8a93b0");
      drawCard(g, 94, 212, 108, 132, jd.mine, false);
      g.text("ほんとうの答え", 300, 196, 19, "#8a93b0");
      drawCard(g, 246, 212, 108, 132, jd.truth, false);

      g.text("この回の法則", 420, 196, 20, "#8a93b0", "left");
      for(var t=0;t<3;t++){
        var y = 228 + t*34;
        g.text(AXIS_LABEL[t], 420, y, 20, "#dfe5f5", "left");
        g.text(PAT_LABEL[S.pats[t]], 540, y, 20, "#8fd0a0", "left");
        var got = false;
        for(var q=0;q<jd.mine.axes.length;q++) if(jd.mine.axes[q]===t) got = true;
        g.text(got ? "✅ 通した" : "❌ はずした", 780, y, 20, got ? "#7bd88f" : "#e07a7a", "left");
      }

      g.text("同じ答えだった人", 420, 344, 20, "#8a93b0", "left");
      if(jd.agree.length===0) g.text("いなかった", 600, 344, 20, "#e07a7a", "left");
      for(var v=0;v<jd.agree.length;v++) g.emoji(jd.agree[v].emoji, 600+v*44, 344, 32);

      if(jd.reveal){
        g.rect(96, 376, 768, 62, "#2a3149");
        g.emoji(jd.reveal.emoji, 132, 407, 30);
        g.text(jd.reveal.name + " の正体がわかった: 【" + AXIS_LABEL[jd.reveal.axis] + "】しか見ていない",
               168, 407, 21, "#ffe08a", "left");
      }
      if(S.overTimer>=1.0) g.text("クリックでつぎへ", g.W/2, 486, 20, "#ffd");
      return;
    }

    if(S.scene==="over"){
      g.rect(120, 80, 720, 380, "#141826");
      g.text("けっか", g.W/2, 128, 36);
      g.text(S.score + " てん", g.W/2, 188, 32, "#ffd166");
      // 3本まとまる出題はまれなので、全部読み切っても平均9点台。実測に合わせた目安
      var rank = S.score>=12 ? "🏆 法則の目"
               : S.score>=9  ? "🌟 よく見えている"
               : S.score>=6  ? "🙂 半分は読めた"
               : "🌱 これからだ";
      g.text(rank, g.W/2, 238, 30);
      g.text("わかった正体", g.W/2, 296, 20, "#8a93b0");
      for(var w=0;w<AIS.length;w++){
        var ai2 = AIS[w], px = 320 + w*160;
        g.emoji(ai2.emoji, px, 344, 38);
        g.text(S.revealed[ai2.id] ? AXIS_LABEL[ai2.axis] : "?", px, 386, 20,
               S.revealed[ai2.id] ? ai2.color : "#5c6484");
      }
      g.text("3人の見ている軸は、毎回おなじ。覚えるほど強くなる", g.W/2, 424, 20, "#aab");
      if(S.overTimer>=1.0) g.text("クリックでもう一回", g.W/2, 486, 22, "#ffd");
      return;
    }
  },
});
})();
