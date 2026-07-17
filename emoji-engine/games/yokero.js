/* =====================================================
   サンプルゲーム1: よけろ!
   空から落ちてくる岩をよけて、できるだけ長く生き残る。
   「タイトル→プレイ→ゲームオーバー」の基本の型のお手本。
===================================================== */
(function(){
"use strict";

let S;  // ゲームの状態をぜんぶ入れる箱

function reset(g){
  S = {
    scene: "title",          // title / play / over
    player: { x: g.W/2, y: g.H - 60, r: 22 },
    rocks: [],               // 落ちてくるもの
    spawnTimer: 0,
    score: 0,
    best: S ? S.best : 0,
  };
}

EmojiEngine.register({
  id: "yokero",
  name: "よけろ!",
  icon: "🏃",
  desc: "落ちてくる岩をよけて生き残れ",

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
    S.score += dt;
    const speed = 380;
    // キーでもマウス/指でも動かせる
    S.player.x += g.stickX() * speed * dt;
    if (g.pointer.down) S.player.x += g.clamp(g.pointer.x - S.player.x, -speed*dt, speed*dt);
    S.player.x = g.clamp(S.player.x, 30, g.W - 30);

    // 岩を降らせる(だんだん早く・多く)
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0){
      S.spawnTimer = Math.max(0.15, 0.7 - S.score * 0.02);
      S.rocks.push({
        x: g.rand(20, g.W - 20), y: -30, r: 18,
        vy: g.rand(180, 280) + S.score * 8,
        e: g.pick(["🪨", "☄️", "🧊"]),
        rot: 0, vr: g.rand(-3, 3),
      });
    }
    for (const rock of S.rocks){
      rock.y += rock.vy * dt;
      rock.rot += rock.vr * dt;
      if (g.hit(rock, S.player)){
        S.scene = "over";
        S.best = Math.max(S.best, S.score);
        g.se("boom");
      }
    }
    S.rocks = S.rocks.filter(rock => rock.y < g.H + 40);
  },

  draw(g){
    g.bg("#1a2238");
    // 地面
    for (let x = 30; x < g.W; x += 60) g.emoji("🌱", x, g.H - 14, 28);

    if (S.scene === "title"){
      g.emoji("🏃", g.W/2, 200, 100);
      g.text("よけろ!", g.W/2, 300, 44);
      g.text("← → か マウス/指 で移動。岩に当たったら終わり", g.W/2, 360, 20, "#aaa");
      g.text("クリック か スペース でスタート", g.W/2, 420, 24, "#ffd");
      return;
    }

    for (const rock of S.rocks) g.emoji(rock.e, rock.x, rock.y, rock.r*2.2, { rot: rock.rot });
    g.emoji("🏃", S.player.x, S.player.y, 50, { flipX: g.stickX() < 0 });
    g.text("スコア " + S.score.toFixed(1), 12, 24, 22, "#fff", "left");

    if (S.scene === "over"){
      g.text("💥 ゲームオーバー", g.W/2, 230, 40);
      g.text("記録 " + S.score.toFixed(1) + " / ベスト " + S.best.toFixed(1), g.W/2, 290, 24, "#ffd");
      g.text("クリック か スペース でもう一回", g.W/2, 350, 20, "#aaa");
    }
  },
});
})();
