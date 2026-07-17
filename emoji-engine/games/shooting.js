/* =====================================================
   サンプルゲーム3: うちゅうシューティング
   ロケットで宇宙人を撃つ。ボスは「オリジナル絵文字」
   (絵文字の重ね合わせ)で作ってある → 作り方の見本。
===================================================== */
(function(){
"use strict";

// ★オリジナル絵文字の例: 宇宙人+炎+王冠を重ねて「ボス」を作る
//   dx,dy はサイズ100あたりのズレ量、s は大きさの倍率
EmojiEngine.defineEmoji("ボス", [
  { e: "🔥", dy: 55, s: 0.7 },
  { e: "👾", s: 1.0 },
  { e: "👑", dy: -52, s: 0.55 },
]);

let S;

function reset(g){
  S = {
    scene: "title",
    player: { x: g.W/2, y: g.H - 60, r: 22, cooldown: 0 },
    shots: [], enemies: [], stars: [],
    spawnTimer: 1,
    score: 0, hp: 3,
    boss: null, bossComing: 15,   // 15点でボス登場
    best: S ? S.best : 0,
  };
  for (let i = 0; i < 40; i++) S.stars.push({ x: g.rand(0, g.W), y: g.rand(0, g.H), v: g.rand(20, 80) });
}

EmojiEngine.register({
  id: "shooting",
  name: "うちゅうシューティング",
  icon: "🚀",
  desc: "宇宙人を撃て。ボスはオリジナル絵文字",

  init(g){ reset(g); this._state = S; },

  update(g, dt){
    // 星は常に流す(タイトルでも)
    for (const st of S.stars){ st.y += st.v * dt; if (st.y > g.H) { st.y = -5; st.x = g.rand(0, g.W); } }

    if (S.scene === "title"){
      if (g.pressed("action") || g.pointer.justDown){ S.scene = "play"; g.se("click"); }
      return;
    }
    if (S.scene === "over" || S.scene === "win"){
      if (g.pressed("action") || g.pointer.justDown){ reset(g); this._state = S; S.scene = "play"; }
      return;
    }

    // ---- 自機 ----
    const speed = 420;
    S.player.x += g.stickX() * speed * dt;
    if (g.pointer.down) S.player.x += g.clamp(g.pointer.x - S.player.x, -speed*dt, speed*dt);
    S.player.x = g.clamp(S.player.x, 30, g.W - 30);

    // 弾(押しっぱなしで連射。マウス押しっぱなしでも)
    S.player.cooldown -= dt;
    if ((g.key("action") || g.pointer.down) && S.player.cooldown <= 0){
      S.player.cooldown = 0.18;
      S.shots.push({ x: S.player.x, y: S.player.y - 30, r: 8 });
      g.se("jump");
    }
    for (const sh of S.shots) sh.y -= 600 * dt;
    S.shots = S.shots.filter(sh => sh.y > -20);

    // ---- 敵 ----
    if (!S.boss){
      S.spawnTimer -= dt;
      if (S.spawnTimer <= 0){
        S.spawnTimer = Math.max(0.4, 1.1 - S.score * 0.03);
        S.enemies.push({ x: g.rand(40, g.W-40), y: -30, r: 20,
          vy: g.rand(80, 140), vx: g.rand(-60, 60), e: g.pick(["👾","👽","🛸"]) });
      }
      if (S.score >= S.bossComing){
        S.boss = { x: g.W/2, y: -80, r: 55, hp: 10, maxHp: 10, t: 0 };
      }
    } else {
      // ボスの動き: 降りてきて左右にゆらゆら
      S.boss.t += dt;
      if (S.boss.y < 130) S.boss.y += 60 * dt;
      S.boss.x = g.W/2 + Math.sin(S.boss.t * 1.2) * 300;
      if (S.boss.t > 1 && Math.random() < dt * 1.5){
        S.enemies.push({ x: S.boss.x, y: S.boss.y + 40, r: 16, vy: 220, vx: g.rand(-80, 80), e: "🔻" });
      }
    }
    for (const en of S.enemies){
      en.y += en.vy * dt; en.x += en.vx * dt;
      if (en.x < 20 || en.x > g.W - 20) en.vx *= -1;
    }

    // ---- 当たり判定 ----
    for (const sh of S.shots){
      for (const en of S.enemies){
        if (g.hit(sh, en)){ en.dead = true; sh.dead = true; S.score++; g.se("coin"); }
      }
      if (S.boss && g.hit(sh, S.boss)){
        sh.dead = true; S.boss.hp--;
        g.se(S.boss.hp <= 0 ? "boom" : "hit");
        if (S.boss.hp <= 0){
          S.scene = "win"; S.best = Math.max(S.best, S.score + 20);
          S.score += 20;
        }
      }
    }
    for (const en of S.enemies){
      if (!en.dead && g.hit(en, S.player)){
        en.dead = true; S.hp--; g.se("boom");
        if (S.hp <= 0){ S.scene = "over"; S.best = Math.max(S.best, S.score); }
      }
    }
    S.shots = S.shots.filter(sh => !sh.dead);
    S.enemies = S.enemies.filter(en => !en.dead && en.y < g.H + 40);
  },

  draw(g){
    g.bg("#0a0a1e");
    for (const st of S.stars) g.rect(st.x, st.y, 2, 2, "#ffffff88");

    if (S.scene === "title"){
      g.emoji("🚀", g.W/2, 190, 90, { rot: -0.2 });
      g.text("うちゅうシューティング", g.W/2, 300, 42);
      g.text("← → で移動、スペース か クリック押しっぱなしで発射", g.W/2, 360, 20, "#aaa");
      g.text("クリック か スペース でスタート", g.W/2, 420, 24, "#ffd");
      return;
    }

    for (const sh of S.shots) g.emoji("🔸", sh.x, sh.y, 22);
    for (const en of S.enemies) g.emoji(en.e, en.x, en.y, 42);
    if (S.boss){
      g.emoji("ボス", S.boss.x, S.boss.y, 110);   // ← オリジナル絵文字を普通の絵文字と同じ書き方で使える
      // ボスの体力ゲージ
      g.rect(g.W/2 - 150, 8, 300, 14, "#333");
      g.rect(g.W/2 - 150, 8, 300 * Math.max(0, S.boss.hp) / S.boss.maxHp, 14, "#e33");
    }
    g.emoji("🚀", S.player.x, S.player.y, 52, { rot: -0.0 });

    g.text("スコア " + S.score, 12, 30, 22, "#fff", "left");
    let hearts = ""; for (let i = 0; i < S.hp; i++) hearts += "❤️";
    g.text(hearts, g.W - 12, 30, 22, "#fff", "right");

    if (S.scene === "over"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      g.text("💥 ゲームオーバー", g.W/2, 230, 40);
      g.text("スコア " + S.score + " / ベスト " + S.best, g.W/2, 290, 24, "#ffd");
      g.text("クリック か スペース でもう一回", g.W/2, 350, 20, "#aaa");
    }
    if (S.scene === "win"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      g.text("🎉 ボスをたおした!", g.W/2, 230, 40);
      g.text("スコア " + S.score + " / ベスト " + S.best, g.W/2, 290, 24, "#ffd");
      g.text("クリック か スペース でもう一回", g.W/2, 350, 20, "#aaa");
    }
  },
});
})();
