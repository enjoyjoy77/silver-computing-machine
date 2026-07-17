/* =====================================================
   サンプルゲーム2: コインあつめ
   30秒でコインを集める。爆弾に触ると減点。
   上下左右の移動 / 制限時間 / アイテム出現 のお手本。
===================================================== */
(function(){
"use strict";

let S;

function spawnItem(g){
  const isBomb = Math.random() < 0.25;
  S.items.push({
    x: g.rand(40, g.W - 40), y: g.rand(70, g.H - 40),
    r: 18, e: isBomb ? "💣" : "🪙", bomb: isBomb,
    life: 6,  // 6秒で消える
  });
}

function reset(g){
  S = {
    scene: "title",
    player: { x: g.W/2, y: g.H/2, r: 22, face: 1 },
    items: [],
    timeLeft: 30,
    spawnTimer: 0,
    score: 0,
    best: S ? S.best : 0,
  };
}

EmojiEngine.register({
  id: "coin",
  name: "コインあつめ",
  icon: "😺",
  desc: "30秒でコインを集めろ。💣は減点",

  init(g){ reset(g); this._state = S; },

  update(g, dt){
    if (S.scene === "title"){
      if (g.pressed("action") || g.pointer.justDown){ S.scene = "play"; g.se("click"); }
      return;
    }
    if (S.scene === "over"){
      if (g.pressed("action") || g.pointer.justDown){ reset(g); this._state = S; S.scene = "play"; }
      return;
    }

    // ---- プレイ中 ----
    S.timeLeft -= dt;
    if (S.timeLeft <= 0){
      S.timeLeft = 0;
      S.scene = "over";
      S.best = Math.max(S.best, S.score);
      g.se("clear");
      return;
    }

    const speed = 320;
    let dx = g.stickX(), dy = g.stickY();
    // マウス/指でも: 押している場所へ向かう
    if (g.pointer.down && g.dist(g.pointer, S.player) > 10){
      dx = (g.pointer.x - S.player.x) > 0 ? 1 : -1;
      dy = 0;
      S.player.x += (g.pointer.x - S.player.x) * 4 * dt;
      S.player.y += (g.pointer.y - S.player.y) * 4 * dt;
    } else {
      S.player.x += dx * speed * dt;
      S.player.y += dy * speed * dt;
    }
    if (dx !== 0) S.player.face = dx;
    S.player.x = g.clamp(S.player.x, 30, g.W - 30);
    S.player.y = g.clamp(S.player.y, 70, g.H - 30);

    // アイテム出現
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0){ S.spawnTimer = 0.6; spawnItem(g); }

    // 取得判定
    for (const it of S.items){
      it.life -= dt;
      if (g.hit(it, S.player)){
        it.life = -1;
        if (it.bomb){ S.score = Math.max(0, S.score - 3); g.se("hit"); }
        else        { S.score += 1; g.se("coin"); }
      }
    }
    S.items = S.items.filter(it => it.life > 0);
  },

  draw(g){
    g.bg("#173325");

    if (S.scene === "title"){
      g.emoji("😺", g.W/2 - 50, 200, 90);
      g.emoji("🪙", g.W/2 + 60, 200, 70);
      g.text("コインあつめ", g.W/2, 300, 44);
      g.text("← → ↑ ↓ か マウス/指 で移動。💣にさわると -3点", g.W/2, 360, 20, "#aaa");
      g.text("クリック か スペース でスタート", g.W/2, 420, 24, "#ffd");
      return;
    }

    for (const it of S.items){
      // 消える直前は点滅して知らせる
      const blink = it.life < 1.5 && Math.floor(it.life * 8) % 2 === 0;
      g.emoji(it.e, it.x, it.y, 38, { alpha: blink ? 0.3 : 1 });
    }
    g.emoji("😺", S.player.x, S.player.y, 50, { flipX: S.player.face < 0 });

    // 上のバー(スコアと残り時間)
    g.rect(0, 0, g.W, 44, "#00000066");
    g.text("🪙 " + S.score, 14, 22, 24, "#ffd700", "left");
    g.text("のこり " + Math.ceil(S.timeLeft) + " 秒", g.W - 14, 22, 24, S.timeLeft < 6 ? "#f88" : "#fff", "right");

    if (S.scene === "over"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      g.text("⏰ しゅうりょう!", g.W/2, 220, 40);
      g.text("コイン " + S.score + " 枚 / ベスト " + S.best + " 枚", g.W/2, 285, 26, "#ffd700");
      g.text("クリック か スペース でもう一回", g.W/2, 350, 20, "#aaa");
    }
  },
});
})();
