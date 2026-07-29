(function(){
"use strict";
// 絵文字ものさし rev1  設計書: 設計書_価値観カード_2026-07-29.md
var REV = "rev1";
var S;

// ── キャラ(根は1本。枝は全部そこから生える) ────────────────
// type: "flip"=逆転型 / "phys"=物理型。卓は逆転型1体+物理型2体で組む
var CHARS = [
  { id:"goblin", name:"商人ゴブリン", emoji:"🧌", type:"flip", color:"#8bd18b",
    word:"「儲け話は、まず疑うところからだ」",
    reveals:[
      "借りを作ることを極端に嫌う。返済期限が読めないから",
      "命の危険は保険で計算できるので、たいして怖くない",
      "親切には定価がない。だから対処のしようがない",
      "兄弟9人の末子。6歳から自分の食い扶持を自分で値付けして稼いだ。一度だけ値段を付けずに物をくれた人間がいて、その日から夜が眠れない",
    ] },
  { id:"undead", name:"不死者セルヴァ", emoji:"🧟", type:"flip", color:"#9db8e0",
    word:"「急ぐ理由が、そちらにはあるんだったな」",
    reveals:[
      "痛みも死も「通り過ぎるもの」なので、恐怖とは呼ばない",
      "こわいのは蓄積するほう。覚えた顔の数、続いてしまった年月",
      "壊れやすいもの、一度きりのものを美しいと感じる",
      "最初の百年は死のうとして過ごした。次の百年は数えるのをやめた。一度だけ「来年また」と約束して、相手が来なかったことがある",
    ] },
  { id:"fairy", name:"妖精ヒュム", emoji:"🧚", type:"phys", color:"#f3b6d8",
    word:"「ちょっと、そこ通るから止まってて」",
    reveals:[
      "体長10cm。世界のすべてを体積と質量で測っている",
      "大きすぎるものは「遠くの天気」で、こわくもなんともない",
      "液体と風が最大の敵。表面張力と気流に体が負ける",
      "生まれた場所は人間の物置の裏。金貨を1枚拾ったが動かせず、3日粘って諦めた。その隣に落ちていた縫い針は今も持っている",
    ] },
  { id:"golem", name:"ゴーレム", emoji:"🗿", type:"phys", color:"#c9c2ae",
    word:"「命令を。短く、はっきりと」",
    reveals:[
      "石の体。削れても割れても、磨けば直る",
      "こわいのは元に戻せない変化。芯まで入ったひび、しみこんだ水",
      "矛盾した命令を受けると動けなくなる。従えない、という状態が一番つらい",
      "主人はもう四人目。最初に彫られた文字は自分では読めないが、それが名前だと知っている",
    ] },
];

var TOPICS = [
  { id:"kowai", label:"こわいもの", emoji:"😱" },
  { id:"ureshii", label:"うれしいもの", emoji:"😊" },
  { id:"daiji",  label:"大事なもの", emoji:"💎" },
];

// ── カード(4キャラ × 3お題 × 8枚)。n=数字, e=例え, s=セリフ ──
var DECK = {
goblin:{
 kowai:[
  {n:5, e:"押し込み強盗", s:"損害額は出せる。なら怖くはない"},
  {n:14,e:"店の大火事", s:"保険が下りる。帳簿は焼けておらん"},
  {n:26,e:"借金取りの行列", s:"利息まで暗算できる客だ"},
  {n:38,e:"値切ってくる常連", s:"儲けは出る。だが腹は立つぞ"},
  {n:50,e:"恩人からの儲け話", s:"うまい話だ……返す日が決まっていればな"},
  {n:62,e:"前金だけ受け取った仕事", s:"金は入った。逃げ道は消えた"},
  {n:81,e:"名も言わずに置かれた薬", s:"誰の勘定だ。請求書を出せ"},
  {n:95,e:"毎朝そっと置かれる焼きたてパン", s:"値が付けられん。夜も眠れん"},
 ],
 ureshii:[
  {n:8, e:"世辞", s:"タダの言葉に用はない"},
  {n:17,e:"道で拾った小銭", s:"額が小さい。喜びも小さい"},
  {n:30,e:"値切って買えた仕入れ", s:"まあ、悪くない"},
  {n:43,e:"高く売れたが客は渋い顔", s:"儲かった。……儲かったんだよな?"},
  {n:55,e:"得だが恩を売られる取引", s:"得だ。得なんだが、気分が重い"},
  {n:68,e:"相場より高く通った値付け", s:"俺の目が正しかったということだ"},
  {n:83,e:"貸した金が利息付きで返る日", s:"これだ。これが一番きれいな形だ"},
  {n:96,e:"誰にも借りのない朝", s:"帳簿がまっさら。……ようやく眠れる"},
 ],
 daiji:[
  {n:6, e:"自分の命", s:"保険が掛かってる。額まで言えるぞ"},
  {n:16,e:"店の看板", s:"作り直せば済む話だ"},
  {n:29,e:"常連の名簿", s:"一冊ぶんの売上が書いてある"},
  {n:40,e:"帳簿", s:"これが無いと商売が止まる"},
  {n:52,e:"期限の決まっていない貸し", s:"価値は高い。だが、いつ終わる?"},
  {n:64,e:"兄弟9人ぶんの取り分の記録", s:"俺がいくらで生きてきたかが書いてある"},
  {n:79,e:"まだ返せていない恩", s:"返すまで、これは俺のものじゃない"},
  {n:94,e:"値札の付いていない贈り物", s:"捨てられん。売れもせん。……どうしろと"},
 ]},
undead:{
 kowai:[
  {n:4, e:"斬首", s:"通り過ぎるだけだ"},
  {n:12,e:"毒の杯", s:"味は覚えているよ。何度もね"},
  {n:25,e:"戦場のまんなか", s:"みんな帰る。私だけ残る"},
  {n:36,e:"よく笑う若い弟子", s:"教えるのは楽しい。……楽しいうちは"},
  {n:48,e:"まだ生きている旧友", s:"会いたい。会えば、看取る日が近づく"},
  {n:59,e:"十年続いた文通", s:"美しかったものが、束になってきた"},
  {n:72,e:"覚えてしまった顔の数", s:"もう数えていない。数えられない"},
  {n:93,e:"まだ半分も来ていないと気づく夜", s:"朝が、来るんだ。必ず"},
 ],
 ureshii:[
  {n:7, e:"不老の祝い", s:"めでたいのかね、それは"},
  {n:15,e:"何百年でも壊れぬ鎧", s:"壊れないものに用はない"},
  {n:28,e:"知らない町に着くこと", s:"また一から覚えるのか。……悪くない"},
  {n:41,e:"季節が巡ること", s:"一度きりのようで、永遠でもある"},
  {n:53,e:"消えかけの古い歌", s:"誰も歌わなくなる。だから聴いておく"},
  {n:66,e:"一晩で溶ける雪像", s:"明日には無い。それがいい"},
  {n:80,e:"期限のある約束", s:"来年、と言ってくれたな。いい言葉だ"},
  {n:94,e:"いつか必ず終わる友情", s:"君は先に行く。だから、今が眩しい"},
 ],
 daiji:[
  {n:5, e:"自分の体", s:"勝手に治る。ありがたくもない"},
  {n:13,e:"腰の剣", s:"錆びたら替える。それだけだ"},
  {n:27,e:"住んでいる家", s:"三十年で建て替える。四回目だ"},
  {n:39,e:"他人の名前", s:"呼ぶ相手が、そのうち居なくなる"},
  {n:50,e:"書きかけで止まった手紙", s:"出せば続く。出さなければ終わる"},
  {n:63,e:"弟子が置いていった湯呑み", s:"欠けている。直さないでおく"},
  {n:78,e:"最後に交わした挨拶", s:"あれが最後だと、後から知る"},
  {n:92,e:"日記", s:"これが無いと、私は誰も覚えていないことになる"},
 ]},
fairy:{
 kowai:[
  {n:6, e:"山向こうの石の巨人", s:"ぼくの巣箱には入ってこないもん"},
  {n:13,e:"人間たちの戦", s:"遠くの天気だよ。関係ないね"},
  {n:24,e:"落雷", s:"音はすごいけど、当たる面積がないもん"},
  {n:35,e:"猫のしっぽ", s:"ぶんぶんしてる。近づかなきゃ平気"},
  {n:47,e:"開いた窓", s:"出入り口だけど、風の通り道でもあるんだよねぇ"},
  {n:58,e:"転がりだした蜜壺のふた", s:"お城にできる大きさなのに、ぺちゃんこにもされる!"},
  {n:74,e:"人間のくしゃみ", s:"木の葉みたいに飛ばされるんだぞ!"},
  {n:91,e:"雨", s:"水のかたまりが空から降ってくるんだぞ!"},
 ],
 ureshii:[
  {n:9, e:"金貨", s:"動かせないなら、床の模様だよ"},
  {n:18,e:"大きな宝石", s:"きれいだけどさ、持てないでしょ"},
  {n:31,e:"見わたすかぎりの花畑", s:"広すぎて、どこにいるか分かんなくなる"},
  {n:43,e:"人間の手のひら", s:"乗せてもらえば速い。……握られなければね"},
  {n:55,e:"糸巻きのしん", s:"家にもなるし、転がったら止まらない"},
  {n:69,e:"縫い針", s:"これ一本で、ぼくは強いんだから"},
  {n:82,e:"落ちてたパンくず", s:"一週間ぶんだよ! 一週間!"},
  {n:95,e:"どんぐりのからっぽの帽子", s:"ぴったり。それだけで最高なんだよ"},
 ],
 daiji:[
  {n:7, e:"人間の宝箱", s:"開かないし動かない。ないのと同じ"},
  {n:16,e:"銀の燭台", s:"ぴかぴかでも、運べないなら景色だね"},
  {n:28,e:"大きな葉っぱ", s:"毛布になるけど、風で持ってかれる"},
  {n:40,e:"蜜蝋のかけら", s:"削れる、灯せる、便利だよ"},
  {n:51,e:"人間の指ぬき", s:"お風呂にも鍋にもなる。重いけど"},
  {n:64,e:"蜘蛛の糸ひとすじ", s:"命づな。切れたら終わりだから"},
  {n:79,e:"自分の羽根", s:"濡らしたら、それでおしまい"},
  {n:93,e:"息のできる場所", s:"風のこない、乾いた、ぼくの大きさの穴"},
 ]},
golem:{
 kowai:[
  {n:5, e:"剣で斬られること", s:"削れた。磨けば済む"},
  {n:14,e:"崖から落ちること", s:"割れた部分を拾えばよい"},
  {n:26,e:"火", s:"熱い。だが石は燃えぬ"},
  {n:37,e:"体に生える苔", s:"増える。落とすのが手間だ"},
  {n:49,e:"主人がふたりいること", s:"どちらの声にも従う。……従えぬ"},
  {n:60,e:"命令の途中で主が黙ること", s:"続きは。続きは、どこだ"},
  {n:75,e:"芯まで入ったひび", s:"磨いても、消えぬ"},
  {n:92,e:"水", s:"石の中に入り、凍り、割る。直せぬ"},
 ],
 ureshii:[
  {n:8, e:"褒め言葉", s:"命令ではない。処理できぬ"},
  {n:17,e:"新しい鎧", s:"重い。だが重さは苦にならぬ"},
  {n:29,e:"体を磨かれること", s:"表面が滑らかになる。……悪くない"},
  {n:41,e:"一日中の力仕事", s:"動いている間は、迷わぬ"},
  {n:52,e:"主が迷っている時間", s:"待てるのは嬉しい。だが続きが来ない"},
  {n:65,e:"短くはっきりした命令", s:"「運べ」。よい言葉だ"},
  {n:78,e:"欠けた腕を直された日", s:"元の形に戻った。元の、形だ"},
  {n:94,e:"主が三年おなじ言葉を使うこと", s:"変わらぬ。変わらぬのが、いちばんよい"},
 ],
 daiji:[
  {n:6, e:"自分の腕", s:"替えがある"},
  {n:15,e:"運んでいる荷物", s:"落とさねばよい"},
  {n:27,e:"立っている場所", s:"動かねば、そこが私だ"},
  {n:38,e:"体に最初に彫られた文字", s:"名だ。読めぬが、名だ"},
  {n:50,e:"古い命令の記録", s:"もう誰も出さぬ命令だ。だが消せぬ"},
  {n:62,e:"主の声", s:"聞き分けられねば、私は石だ"},
  {n:77,e:"継ぎ目の粘土", s:"ここが弱い。ここで私は繋がっている"},
  {n:93,e:"まだ終わっていない仕事", s:"終われば、私は止まる"},
 ]},
};

var TOTAL_ROUNDS = 5;

// ── 便利 ──────────────────────────────────────────────
function charById(id){ for(var i=0;i<CHARS.length;i++) if(CHARS[i].id===id) return CHARS[i]; return null; }

function wrap(text, perLine){
  var out=[], cur="";
  for(var i=0;i<text.length;i++){
    cur += text.charAt(i);
    if(cur.length>=perLine){ out.push(cur); cur=""; }
  }
  if(cur.length) out.push(cur);
  return out;
}

function shuffle(g, arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){
    var j = Math.floor(g.rand(0, i+1)); if(j>i) j=i;
    var t=a[i]; a[i]=a[j]; a[j]=t;
  }
  return a;
}

function reset(g){
  S = {
    scene:"title", page:0, round:0, cleared:0,
    topicOrder: shuffle(g, [0,1,2,0,1,2]).slice(0,TOTAL_ROUNDS),
    topic:null, cards:[], slots:[null,null,null,null],
    used:{}, history:{},      // history[charId] = 直前に出した札
    revealed:{},              // revealed[charId] = めくれた枚数
    judge:null, overTimer:0, msg:"",
  };
  for(var i=0;i<CHARS.length;i++){ S.used[CHARS[i].id]={}; S.revealed[CHARS[i].id]=0; }
}

// 卓の編成: 逆転型1体 + 物理型2体
function pickCast(g){
  var flips=[], phys=[];
  for(var i=0;i<CHARS.length;i++){ (CHARS[i].type==="flip"?flips:phys).push(CHARS[i]); }
  var f = flips[Math.min(flips.length-1, Math.floor(g.rand(0,flips.length)))];
  return shuffle(g, [f].concat(phys));
}

function startRound(g){
  var t = TOPICS[ S.topicOrder[S.round] ];
  S.topic = t;
  var cast = pickCast(g);
  var cards = [];
  var taken = [];
  for(var i=0;i<cast.length;i++){
    var c = cast[i];
    var pool = DECK[c.id][t.id];
    var avail = [];
    for(var k=0;k<pool.length;k++){
      var key = t.id+"_"+pool[k].n;
      if(!S.used[c.id][key]) avail.push(pool[k]);
    }
    if(!avail.length) avail = pool.slice();
    var pick = avail[Math.min(avail.length-1, Math.floor(g.rand(0,avail.length)))];
    S.used[c.id][t.id+"_"+pick.n] = true;
    cards.push({ kind:"ai", ch:c, n:pick.n, e:pick.e, s:pick.s, prev:S.history[c.id]||null });
    S.history[c.id] = pick;
    taken.push(pick.n);
  }
  // あなたの数字。他の札と4以上離す(紛らわしい接戦を避ける)
  var mine = 50, ok = false;
  for(var tryn=0; tryn<400 && !ok; tryn++){
    mine = Math.floor(g.rand(1,101)); if(mine>100) mine=100; if(mine<1) mine=1;
    ok = true;
    for(var q=0;q<taken.length;q++) if(Math.abs(taken[q]-mine)<4) ok=false;
  }
  cards.push({ kind:"me", ch:null, n:mine, e:"", s:"", prev:null });

  S.cards = shuffle(g, cards);
  S.slots = [null,null,null,null];
  S.judge = null;
  S.msg = "小さいと思う順に、カードをクリックして並べよう";
  S.scene = "play";
}

function trueOrder(){
  var idx = [0,1,2,3];
  idx.sort(function(a,b){ return S.cards[a].n - S.cards[b].n; });
  return idx;
}

function doJudge(g){
  var truth = trueOrder();
  var ok = true;
  for(var i=0;i<4;i++) if(S.slots[i]!==truth[i]) ok=false;
  var rv = null;
  if(ok){
    S.cleared++;
    g.se("clear");
  } else {
    g.se("hit");
    // 位置がずれたAIのうち、最初の1体が言い訳する
    for(var j=0;j<4;j++){
      var ci = S.slots[j];
      if(ci===null) continue;
      if(S.cards[ci].kind!=="ai") continue;
      if(truth[j]===ci) continue;
      var ch = S.cards[ci].ch;
      var cnt = S.revealed[ch.id];
      if(cnt < ch.reveals.length){ S.revealed[ch.id] = cnt+1; rv = { ch:ch, text:ch.reveals[cnt] }; }
      else rv = { ch:ch, text:"(この相手の裏設定は全部めくれている)" };
      break;
    }
  }
  S.judge = { ok:ok, truth:truth, reveal:rv };
  S.scene = "result";
  S.overTimer = 0;
}

// ── 当たり判定の枠 ────────────────────────────────────
function cardRect(i){ return { x:24+i*230, y:64, w:212, h:206 }; }
function slotRect(i){ return { x:24+i*230, y:284, w:212, h:78 }; }
var BTN = { x:360, y:386, w:240, h:52 };

function inRect(p, r){ return p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h; }

function placedAt(ci){ for(var i=0;i<4;i++) if(S.slots[i]===ci) return i; return -1; }

EmojiEngine.register({
  id:"kachikan",
  name:"絵文字ものさし",
  icon:"🧭",
  desc:"へんな種族の値打ちを読んで、小さい順に並べる",

  init(g){ reset(g); this._state = S; },

  update(g, dt){
    if(S.scene==="title"){
      if(g.pressed("action") || g.pointer.justDown){ S.scene="howto"; S.page=0; g.se("click"); }
      return;
    }
    if(S.scene==="howto"){
      if(g.pressed("action") || g.pointer.justDown){
        S.page++; g.se("click");
        if(S.page>=2){ S.round=0; S.cleared=0; startRound(g); }
      }
      return;
    }
    if(S.scene==="play"){
      if(!g.pointer.justDown) return;
      var p = g.pointer;
      // 枠をクリック → 取消
      for(var i=0;i<4;i++){
        if(S.slots[i]!==null && inRect(p, slotRect(i))){ S.slots[i]=null; g.se("click"); return; }
      }
      // カードをクリック → 空いている枠へ
      for(var c=0;c<4;c++){
        if(!inRect(p, cardRect(c))) continue;
        if(placedAt(c)>=0) return;
        for(var k=0;k<4;k++){ if(S.slots[k]===null){ S.slots[k]=c; g.se("click"); break; } }
        return;
      }
      // 決定
      if(inRect(p, BTN)){
        var full = true; for(var m=0;m<4;m++) if(S.slots[m]===null) full=false;
        if(full) doJudge(g);
        else S.msg = "4枚ぜんぶ並べてから決定してね";
      }
      return;
    }
    if(S.scene==="result"){
      S.overTimer += dt;
      if(S.overTimer<1.0) return;                 // 連打で読み飛ばす事故を防ぐ
      if(g.pressed("action") || g.pointer.justDown){
        S.round++;
        if(S.round>=TOTAL_ROUNDS){ S.scene="over"; S.overTimer=0; }
        else startRound(g);
      }
      return;
    }
    if(S.scene==="over"){
      S.overTimer += dt;
      if(S.overTimer<1.0) return;
      if(g.pressed("action") || g.pointer.justDown){ reset(g); this._state=S; S.scene="howto"; S.page=1; }
      return;
    }
  },

  draw(g){
    g.bg("#1b1f2e");
    g.text(REV, g.W-8, 14, 14, "#6a7391", "right");

    if(S.scene==="title"){
      g.text("🧭 絵文字ものさし", g.W/2, 130, 46);
      g.text("へんな種族の「値打ち」を読んで、小さい順に並べる", g.W/2, 210, 24, "#ffd");
      g.text("まちがえるほど、相手のことが分かってくる", g.W/2, 252, 22, "#9db8e0");
      g.emoji("🧌", 330, 340, 62); g.emoji("🧟", 420, 340, 62);
      g.emoji("🧚", 510, 340, 62); g.emoji("🗿", 600, 340, 62);
      g.text("クリック か スペース ではじめる", g.W/2, 440, 22, "#ffd");
      return;
    }

    if(S.scene==="howto"){
      if(S.page===0){
        g.text("あそびかた ①", g.W/2, 60, 34);
        g.text("お題が出る。みんな 1〜100 の数字を1枚ずつ持っている", g.W/2, 120, 22, "#ffd");
        g.text("相手は数字を言わず、お題にそって「たとえ」で言う", g.W/2, 158, 22, "#ffd");
        g.emoji("😱", 210, 250, 44); g.text("こわいもの", 210, 300, 20);
        g.emoji("🧚", 430, 232, 40);
        g.text("「雨」", 430, 282, 24, "#f3b6d8");
        g.text("←10cmの妖精には", 430, 314, 17, "#aab");
        g.text("大事件", 430, 338, 17, "#aab");
        g.emoji("🧌", 660, 232, 40);
        g.text("「押し込み強盗」", 660, 282, 20, "#8bd18b");
        g.text("←損害額が出せるので", 660, 314, 17, "#aab");
        g.text("たいして怖くない", 660, 338, 17, "#aab");
        g.text("クリックでつぎへ", g.W/2, 470, 22, "#ffd");
      } else {
        g.text("あそびかた ②", g.W/2, 60, 34);
        g.text("自分の数字だけは見える。4枚を「小さい順」に並べて決定", g.W/2, 118, 22, "#ffd");
        g.text("ぜんぶ合っていればクリア。1つでも違えば失敗", g.W/2, 156, 22, "#ffd");
        g.rect(180, 200, 600, 96, "#2a3149");
        g.text("失敗すると、まちがえた相手が言いわけをして", g.W/2, 232, 22, "#ffe08a");
        g.text("その相手の「裏設定」が1つめくれる", g.W/2, 268, 22, "#ffe08a");
        g.text("負けるほど読めるようになる。全5ラウンド", g.W/2, 330, 22, "#9db8e0");
        g.text("おなじ相手が前に出した札とくらべた一言も出るので、", g.W/2, 372, 19, "#aab");
        g.text("それも手がかりにしよう", g.W/2, 398, 19, "#aab");
        g.text("クリックではじめる", g.W/2, 470, 22, "#ffd");
      }
      return;
    }

    // 上部バー
    g.text("お題 " + S.topic.emoji + " " + S.topic.label, 16, 26, 26, "#fff", "left");
    g.text("ラウンド " + (S.round+1) + " / " + TOTAL_ROUNDS + "   クリア " + S.cleared, g.W/2+130, 26, 20, "#9db8e0", "left");

    // カード4枚と並べる枠は、遊んでいる間だけ描く
    // (結果画面のパネルの外に端がはみ出して見えるため)
    if(S.scene==="play"){
    for(var i=0;i<4;i++){
      var r = cardRect(i), c = S.cards[i], cx = r.x + r.w/2;
      var used = placedAt(i)>=0;
      g.rect(r.x, r.y, r.w, r.h, used ? "#232839" : "#2f3650");
      g.rect(r.x, r.y, r.w, 4, c.kind==="me" ? "#ffd166" : c.ch.color);
      if(used){
        g.text("(並べた)", cx, r.y+100, 20, "#666f8c");
      } else if(c.kind==="me"){
        g.emoji("🧑", cx, r.y+46, 40);
        g.text("あなた", cx, r.y+80, 17, "#ffd166");
        g.text(String(c.n), cx, r.y+130, 52, "#ffd166");
        g.text("これがあなたの数字", cx, r.y+176, 15, "#aab");
      } else {
        g.emoji(c.ch.emoji, cx, r.y+40, 38);
        g.text(c.ch.name, cx, r.y+72, 15, c.ch.color);
        var el = wrap(c.e, 11);
        for(var a=0;a<el.length && a<2;a++) g.text(el[a], cx, r.y+98+a*23, 18);
        var sl = wrap("「"+c.s+"」", 15);
        for(var b=0;b<sl.length && b<3;b++) g.text(sl[b], cx, r.y+150+b*19, 13, "#cdd6ee");
        if(c.prev){
          var updown = (c.n > c.prev.n) ? "より 上" : "より 下";
          var pl = wrap("まえの「"+c.prev.e+"」"+updown, 17);
          g.text(pl[0], cx, r.y+192, 12, "#8ad1c4");
        }
      }
    }

    // 並べる枠
    for(var j=0;j<4;j++){
      var sr = slotRect(j), sc = sr.x + sr.w/2;
      g.rect(sr.x, sr.y, sr.w, sr.h, "#242a3d");
      g.text(["いちばん小さい","2ばんめ","3ばんめ","いちばん大きい"][j], sc, sr.y+16, 15, "#7d87a8");
      var ci = S.slots[j];
      if(ci===null){ g.text("ここに置く", sc, sr.y+50, 18, "#4d5674"); }
      else {
        var cc = S.cards[ci];
        if(cc.kind==="me"){ g.emoji("🧑", sr.x+26, sr.y+50, 26); g.text("あなた "+cc.n, sc+12, sr.y+50, 20, "#ffd166"); }
        else {
          g.emoji(cc.ch.emoji, sr.x+26, sr.y+50, 26);
          var w2 = wrap(cc.e, 10);
          g.text(w2[0], sc+12, sr.y+42, 16, cc.ch.color);
          if(w2[1]) g.text(w2[1], sc+12, sr.y+62, 16, cc.ch.color);
        }
      }
    }

    g.rect(BTN.x, BTN.y, BTN.w, BTN.h, "#3d6bb3");
    g.text("これで決定", BTN.x+BTN.w/2, BTN.y+26, 26);
    g.text(S.msg, g.W/2, 462, 20, "#aab");
    return;
    }

    if(S.scene==="result"){
      g.rect(60, 96, 840, 360, "#141826");
      g.rect(60, 96, 840, 6, S.judge.ok ? "#7bd88f" : "#e07a7a");
      g.text(S.judge.ok ? "✅ せいかい!" : "❌ ざんねん", g.W/2, 134, 34, S.judge.ok ? "#7bd88f" : "#e07a7a");
      g.text("ほんとうの順番", g.W/2, 176, 19, "#aab");
      for(var t=0;t<4;t++){
        var tc = S.cards[S.judge.truth[t]];
        var y = 210 + t*30;
        var label = (tc.kind==="me") ? "あなた" : tc.ch.name;
        var body  = (tc.kind==="me") ? "" : "「"+tc.e+"」";
        g.text(String(tc.n), 200, y, 22, "#ffd166", "right");
        g.text(label, 230, y, 18, tc.kind==="me" ? "#ffd166" : tc.ch.color, "left");
        g.text(body, 400, y, 18, "#dfe5f5", "left");
      }
      if(S.judge.reveal){
        g.rect(90, 336, 780, 96, "#242a3d");
        g.emoji(S.judge.reveal.ch.emoji, 128, 362, 30);
        g.text(S.judge.reveal.ch.name + " の裏設定が1つめくれた", 160, 356, 18, "#ffe08a", "left");
        var rl = wrap(S.judge.reveal.text, 42);
        for(var u=0;u<rl.length && u<3;u++) g.text(rl[u], 160, 384+u*22, 16, "#dfe5f5", "left");
      }
      if(S.overTimer>=1.0) g.text("クリックでつぎへ", g.W/2, 476, 20, "#ffd");
      return;
    }

    if(S.scene==="over"){
      g.rect(120, 90, 720, 360, "#141826");
      g.text("けっか", g.W/2, 136, 36);
      g.text(S.cleared + " / " + TOTAL_ROUNDS + " ラウンド せいかい", g.W/2, 196, 30, "#ffd166");
      var rank = S.cleared>=5 ? "🏆 ものさしの達人" : S.cleared>=4 ? "🌟 よく読めている"
               : S.cleared>=2 ? "🙂 まだまだ読める" : "🌱 これからだ";
      g.text(rank, g.W/2, 246, 30);
      var total=0, got=0;
      for(var v=0;v<CHARS.length;v++){ total+=CHARS[v].reveals.length; got+=S.revealed[CHARS[v].id]; }
      g.text("めくれた裏設定 " + got + " / " + total, g.W/2, 300, 24, "#8ad1c4");
      g.text("まちがえた相手のことほど、よく分かる", g.W/2, 342, 20, "#aab");
      for(var w=0;w<CHARS.length;w++){
        g.emoji(CHARS[w].emoji, 300+w*90, 392, 34);
        g.text(S.revealed[CHARS[w].id]+"/"+CHARS[w].reveals.length, 300+w*90, 424, 16, "#aab");
      }
      if(S.overTimer>=1.0) g.text("クリックでもう一回", g.W/2, 476, 22, "#ffd");
      return;
    }
  },
});
})();
