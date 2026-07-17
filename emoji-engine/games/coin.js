/* =====================================================
   サンプルゲーム2: コインあつめ
   30秒でコインを集める。爆弾に触ると減点。
   連続取得コンボとコンボ猶予ゲージを追加した版。
===================================================== */
(function(){
"use strict";

let S;

function addFloater(x, y, text, color, size, life){
  S.floaters.push({
    x: x,
    y: y,
    text: text,
    color: color || "#fff",
    size: size || 24,
    t: life === undefined ? 0.6 : life,
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

function endCombo(){
  if (S.combo > 0){
    addFloater(
      S.player.x,
      S.player.y - 35,
      "COMBO END",
      "#999",
      18,
      0.3
    );
  }

  S.combo = 0;
  S.comboTimer = 0;
  S.multiplier = 1;
}

function spawnItem(g){
  const isBomb = Math.random() < 0.25;

  S.items.push({
    x: g.rand(40, g.W - 40),
    y: g.rand(70, g.H - 40),
    r: 18,
    e: isBomb ? "💣" : "🪙",
    bomb: isBomb,
    life: 6,  // 6秒で消える
  });
}

function reset(g){
  S = {
    scene: "title",
    player: {
      x: g.W/2,
      y: g.H/2,
      r: 22,
      face: 1,
    },
    items: [],
    timeLeft: 30,
    spawnTimer: 0,
    score: 0,
    best: S ? S.best : 0,

    combo: 0,
    comboTimer: 0,
    multiplier: 1,

    floaters: [],
    freeze: 0,
    shake: 0,
  };
}

EmojiEngine.register({
  id: "coin",
  name: "コインあつめ",
  icon: "😺",
  desc: "30秒でコインを集め、コンボをつなげよう",

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
    S.timeLeft -= dt;

    if (S.combo > 0){
      S.comboTimer -= dt;

      if (S.comboTimer <= 0){
        endCombo();
      }
    }

    if (S.timeLeft <= 0){
      S.timeLeft = 0;
      S.scene = "over";
      S.best = Math.max(S.best, S.score);
      g.se("clear");
      return;
    }

    const speed = 320;
    let dx = g.stickX();
    let dy = g.stickY();

    // マウス/指でも押している場所へ向かう
    if (
      g.pointer.down &&
      g.dist(g.pointer, S.player) > 10
    ){
      const moveX = g.clamp(
        (g.pointer.x - S.player.x) * 9 * dt,
        -speed * dt,
        speed * dt
      );
      const moveY = g.clamp(
        (g.pointer.y - S.player.y) * 9 * dt,
        -speed * dt,
        speed * dt
      );

      S.player.x += moveX;
      S.player.y += moveY;

      if (moveX !== 0){
        dx = moveX > 0 ? 1 : -1;
      }
    } else {
      S.player.x += dx * speed * dt;
      S.player.y += dy * speed * dt;
    }

    if (dx !== 0){
      S.player.face = dx;
    }

    S.player.x = g.clamp(
      S.player.x,
      30,
      g.W - 30
    );
    S.player.y = g.clamp(
      S.player.y,
      70,
      g.H - 30
    );

    // アイテム出現
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0){
      S.spawnTimer = 0.6;
      spawnItem(g);
    }

    // 取得判定
    for (const it of S.items){
      it.life -= dt;

      if (!g.hit(it, S.player)){
        continue;
      }

      it.life = -1;

      if (it.bomb){
        S.score = Math.max(0, S.score - 3);
        endCombo();

        addFloater(
          it.x,
          it.y,
          "-3",
          "#fff",
          24
        );

        S.freeze = Math.min(
          0.2,
          S.freeze + 0.08
        );

        g.se("hit");
        continue;
      }

      const oldMultiplier = S.multiplier;

      S.combo =
        S.comboTimer > 0 ? S.combo + 1 : 1;
      S.comboTimer = 1.2;
      S.multiplier = Math.min(
        3,
        1 + Math.floor(S.combo / 5)
      );

      S.score += S.multiplier;

      addFloater(
        it.x,
        it.y,
        "+" + S.multiplier,
        "#fff",
        24
      );

      if (S.multiplier > oldMultiplier){
        addFloater(
          S.player.x,
          S.player.y - 45,
          "🔥×" + S.multiplier,
          "#ffd700",
          36
        );

        S.freeze = Math.min(
          0.2,
          S.freeze + 0.08
        );
      } else {
        S.freeze = Math.min(
          0.2,
          S.freeze + 0.05
        );
      }

      g.se("coin");
    }

    S.items = S.items.filter(
      it => it.life > 0
    );
  },

  draw(g){
    g.bg("#173325");

    if (S.scene === "title"){
      g.emoji("😺", g.W/2 - 50, 185, 90);
      g.emoji("🪙", g.W/2 + 60, 185, 70);
      g.text(
        "コインあつめ",
        g.W/2,
        285,
        44
      );
      g.text(
        "← → ↑ ↓ か マウス/指 で移動。💣にさわると -3点",
        g.W/2,
        340,
        20,
        "#aaa"
      );
      g.text(
        "1.2秒以内に続けて取ると🔥コンボで得点アップ",
        g.W/2,
        375,
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

    for (const it of S.items){
      // 消える直前は点滅して知らせる
      const blink =
        it.life < 1.5 &&
        Math.floor(it.life * 8) % 2 === 0;

      g.emoji(
        it.e,
        it.x,
        it.y,
        38,
        { alpha: blink ? 0.3 : 1 }
      );
    }

    g.emoji(
      "😺",
      S.player.x,
      S.player.y,
      50,
      { flipX: S.player.face < 0 }
    );

    // コンボ中は足元に残り猶予を表示する
    if (S.combo > 0){
      g.rect(
        S.player.x - 15,
        S.player.y + 30,
        30 * S.comboTimer / 1.2,
        4,
        "#fff"
      );
    }

    for (const f of S.floaters){
      g.text(
        f.text,
        f.x,
        f.y,
        f.size,
        f.color
      );
    }

    // 上のバー
    g.rect(
      0,
      0,
      g.W,
      44,
      "#00000066"
    );

    g.text(
      "🪙 " + S.score,
      14,
      22,
      24,
      "#ffd700",
      "left"
    );

    if (S.combo > 0){
      g.text(
        "🔥 " + S.combo + " COMBO  ×" + S.multiplier,
        g.W/2,
        22,
        20,
        "#ffd700"
      );
    }

    g.text(
      "のこり " + Math.ceil(S.timeLeft) + " 秒",
      g.W - 14,
      22,
      24,
      S.timeLeft < 6 ? "#f88" : "#fff",
      "right"
    );

    if (S.scene === "over"){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#00000099"
      );
      g.text(
        "⏰ しゅうりょう!",
        g.W/2,
        220,
        40
      );
      g.text(
        "コイン " + S.score +
        " 枚 / ベスト " + S.best + " 枚",
        g.W/2,
        285,
        26,
        "#ffd700"
      );
      g.text(
        "クリック か スペース でもう一回",
        g.W/2,
        350,
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
