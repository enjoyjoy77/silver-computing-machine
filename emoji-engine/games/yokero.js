/* =====================================================
   サンプルゲーム1: よけろ!
   空から落ちてくる岩をよけて、できるだけ長く生き残る。
   岩の予告とニアミスボーナスを追加した版。
===================================================== */
(function(){
"use strict";

let S;  // ゲームの状態をぜんぶ入れる箱

function addFloater(x, y, text, color, size){
  S.floaters.push({
    x: x,
    y: y,
    text: text,
    color: color || "#fff",
    size: size || 24,
    t: 0.6,
  });
}

function updateEffects(dt){
  for (const f of S.floaters){
    f.y -= 40 * dt;
    f.t -= dt;
  }
  S.floaters = S.floaters.filter(f => f.t > 0);
  S.shake = Math.max(0, S.shake - dt);
}

function reset(g){
  S = {
    scene: "title",          // title / play / over
    player: { x: g.W/2, y: g.H - 60, r: 22 },
    rocks: [],               // 落ちてくるもの
    spawnTimer: 0,
    score: 0,
    best: S ? S.best : 0,

    floaters: [],
    freeze: 0,
    shake: 0,

    nearCount: 0,
    nearTimer: 0,
  };
}

EmojiEngine.register({
  id: "yokero",
  name: "よけろ!",
  icon: "🏃",
  desc: "予告を見て岩をよけ、ニアミスをねらえ",

  init(g){
    reset(g);
    this._state = S;
  },

  update(g, dt){
    updateEffects(dt);

    if (S.scene === "title"){
      if (g.pressed("action") || g.pointer.justDown){
        S.scene = "play";
        g.se("click");
      }
      return;
    }

    if (S.scene === "over"){
      if (g.pressed("action") || g.pointer.justDown){
        reset(g);
        this._state = S;
        S.scene = "play";
      }
      return;
    }

    // ヒットストップ中はゲーム内の動きを止める
    if (S.freeze > 0){
      S.freeze = Math.max(0, S.freeze - dt);
      return;
    }

    // ---- プレイ中 ----
    S.score += dt;

    S.nearTimer -= dt;
    if (S.nearTimer <= 0){
      S.nearTimer = 0;
      S.nearCount = 0;
    }

    const speed = 380;

    // キーでもマウス/指でも動かせる
    S.player.x += g.stickX() * speed * dt;
    if (g.pointer.down){
      S.player.x += g.clamp(
        g.pointer.x - S.player.x,
        -speed * dt,
        speed * dt
      );
    }
    S.player.x = g.clamp(S.player.x, 30, g.W - 30);

    // スコア50以降は難易度を上げない
    const difficulty = Math.min(S.score, 50);

    // 岩を予告つきで出す
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0){
      S.spawnTimer = Math.max(0.15, 0.7 - difficulty * 0.02);

      S.rocks.push({
        x: g.rand(20, g.W - 20),
        y: -30,
        r: 18,
        vy: g.rand(180, 280) + difficulty * 8,
        e: g.pick(["🪨", "☄️", "🧊"]),
        rot: 0,
        vr: g.rand(-3, 3),
        warn: 0.6,
        nearGiven: false,
      });
    }

    for (const rock of S.rocks){
      // 予告中は岩を動かさず、当たり判定もしない
      if (rock.warn > 0){
        rock.warn -= dt;
        continue;
      }

      const oldY = rock.y;
      rock.y += rock.vy * dt;
      rock.rot += rock.vr * dt;

      if (g.hit(rock, S.player)){
        S.scene = "over";
        S.best = Math.max(S.best, S.score);
        S.freeze = Math.min(0.2, S.freeze + 0.15);
        S.shake = 0.15;
        g.se("boom");
        continue;
      }

      // プレイヤーの高さを通過した瞬間にニアミスを判定する
      const passedPlayer =
        oldY < S.player.y &&
        rock.y >= S.player.y;

      const nearDistance =
        rock.r + S.player.r + 16;

      const horizontalDistance =
        Math.abs(rock.x - S.player.x);

      if (
        !rock.nearGiven &&
        passedPlayer &&
        horizontalDistance < nearDistance
      ){
        rock.nearGiven = true;

        S.nearCount =
          S.nearTimer > 0 ? S.nearCount + 1 : 1;
        S.nearTimer = 2;

        const multiplier =
          S.nearCount >= 6 ? 2 :
          S.nearCount >= 3 ? 1.5 : 1;

        const bonus = 2 * multiplier;
        S.score += bonus;

        addFloater(
          rock.x,
          S.player.y - 35,
          "⚡NEAR! +" + bonus,
          "#fff",
          24
        );

        if (S.nearCount === 3 || S.nearCount === 6){
          addFloater(
            S.player.x,
            S.player.y - 75,
            "⚡×" + multiplier,
            "#ffd700",
            36
          );
          S.freeze = Math.min(0.2, S.freeze + 0.08);
        } else {
          S.freeze = Math.min(0.2, S.freeze + 0.05);
        }

        g.se("coin");
      }
    }

    S.rocks = S.rocks.filter(
      rock => rock.y < g.H + 40
    );
  },

  draw(g){
    g.bg("#1a2238");

    const shakePower =
      S.shake > 0 ? 4 * S.shake / 0.15 : 0;
    const ox =
      shakePower > 0 ? g.rand(-shakePower, shakePower) : 0;
    const oy =
      shakePower > 0 ? g.rand(-shakePower, shakePower) : 0;

    // 地面
    for (let x = 30; x < g.W; x += 60){
      g.emoji("🌱", x + ox, g.H - 14 + oy, 28);
    }

    if (S.scene === "title"){
      g.emoji("🏃", g.W/2, 190, 100);
      g.text("よけろ!", g.W/2, 290, 44);
      g.text(
        "← → か マウス/指 で移動。岩に当たったら終わり",
        g.W/2,
        345,
        20,
        "#aaa"
      );
      g.text(
        "⚠️の下から岩。近くでよけると⚡ニアミスボーナス",
        g.W/2,
        380,
        18,
        "#aaa"
      );
      g.text(
        "クリック か スペース でスタート",
        g.W/2,
        425,
        24,
        "#ffd"
      );
      g.text(
        "rev2",
        g.W-8,
        g.H-10,
        12,
        "#ffffff44",
        "right"
      );
      return;
    }

    for (const rock of S.rocks){
      if (rock.warn > 0){
        const blink =
          Math.floor(rock.warn * 10) % 2 === 0;
        g.emoji(
          "⚠️",
          rock.x + ox,
          20 + oy,
          24,
          { alpha: blink ? 0.6 : 0.2 }
        );
      } else {
        g.emoji(
          rock.e,
          rock.x + ox,
          rock.y + oy,
          rock.r * 2.2,
          { rot: rock.rot }
        );
      }
    }

    g.emoji(
      "🏃",
      S.player.x + ox,
      S.player.y + oy,
      50,
      { flipX: g.stickX() < 0 }
    );

    g.text(
      "スコア " + S.score.toFixed(1),
      12,
      24,
      22,
      "#fff",
      "left"
    );

    if (S.nearCount > 0){
      const multiplier =
        S.nearCount >= 6 ? 2 :
        S.nearCount >= 3 ? 1.5 : 1;

      g.text(
        "⚡ ニアミス " + S.nearCount + "  ×" + multiplier,
        g.W/2,
        24,
        20,
        "#ffd700"
      );
    }

    for (const f of S.floaters){
      g.text(
        f.text,
        f.x + ox,
        f.y + oy,
        f.size,
        f.color
      );
    }

    if (S.scene === "over"){
      g.text(
        "💥 ゲームオーバー",
        g.W/2 + ox,
        230 + oy,
        40
      );
      g.text(
        "記録 " + S.score.toFixed(1) +
        " / ベスト " + S.best.toFixed(1),
        g.W/2 + ox,
        290 + oy,
        24,
        "#ffd"
      );
      g.text(
        "クリック か スペース でもう一回",
        g.W/2 + ox,
        350 + oy,
        20,
        "#aaa"
      );
    }

    g.text(
      "rev2",
      g.W-8,
      g.H-10,
      12,
      "#ffffff44",
      "right"
    );
  },
});
})();
