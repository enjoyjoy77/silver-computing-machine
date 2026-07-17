/* =====================================================
   サンプルゲーム3: うちゅうシューティング
   ロケットで宇宙人を撃つ。ボスは「オリジナル絵文字」
   被弾無敵と撃破コンボを追加した版。
===================================================== */
(function(){
"use strict";

// オリジナル絵文字の例
// 宇宙人、炎、王冠を重ねて「ボス」を作る
EmojiEngine.defineEmoji("ボス", [
  { e: "🔥", dy: 55, s: 0.7 },
  { e: "👾", s: 1.0 },
  { e: "👑", dy: -52, s: 0.55 },
]);

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

  S.floaters = S.floaters.filter(
    f => f.t > 0
  );

  S.shake = Math.max(
    0,
    S.shake - dt
  );

  S.player.invincible = Math.max(
    0,
    S.player.invincible - dt
  );
}

function endCombo(){
  if (S.combo > 0){
    addFloater(
      S.player.x,
      S.player.y - 45,
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

function spawnNormalEnemy(g){
  S.enemies.push({
    x: g.rand(40, g.W - 40),
    y: -30,
    r: 20,
    vy: g.rand(80, 140),
    vx: g.rand(-60, 60),
    e: g.pick(["👾", "👽", "🛸"]),
  });
}

function reset(g){
  S = {
    scene: "title",

    player: {
      x: g.W/2,
      y: g.H - 60,
      r: 22,
      cooldown: 0,
      invincible: 0,
    },

    shots: [],
    enemies: [],
    stars: [],

    spawnTimer: 1,
    score: 0,
    hp: 3,

    boss: null,
    bossComing: 15,   // 15点でボス登場
    best: S ? S.best : 0,

    combo: 0,
    comboTimer: 0,
    multiplier: 1,

    floaters: [],
    freeze: 0,
    shake: 0,
  };

  for (let i = 0; i < 40; i++){
    S.stars.push({
      x: g.rand(0, g.W),
      y: g.rand(0, g.H),
      v: g.rand(20, 80),
    });
  }
}

EmojiEngine.register({
  id: "shooting",
  name: "うちゅうシューティング",
  icon: "🚀",
  desc: "連続撃破でコンボ。ボスをたおせ",

  init(g){
    reset(g);
    this._state = S;
  },

  update(g, dt){
    updateEffects(dt);

    // 星はタイトル画面でも流す
    for (const st of S.stars){
      st.y += st.v * dt;

      if (st.y > g.H){
        st.y = -5;
        st.x = g.rand(0, g.W);
      }
    }

    if (S.scene === "title"){
      if (g.pressed("action") || g.pointer.justDown){
        S.scene = "play";
        g.se("click");
      }
      return;
    }

    if (S.scene === "over" || S.scene === "win"){
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

    if (S.combo > 0){
      S.comboTimer -= dt;

      if (S.comboTimer <= 0){
        endCombo();
      }
    }

    // ---- 自機 ----
    const speed = 420;

    S.player.x +=
      g.stickX() * speed * dt;

    if (g.pointer.down){
      S.player.x += g.clamp(
        g.pointer.x - S.player.x,
        -speed * dt,
        speed * dt
      );
    }

    S.player.x = g.clamp(
      S.player.x,
      30,
      g.W - 30
    );

    // 押しっぱなしで弾を連射する
    S.player.cooldown -= dt;

    if (
      (g.key("action") || g.pointer.down) &&
      S.player.cooldown <= 0
    ){
      S.player.cooldown = 0.18;

      S.shots.push({
        x: S.player.x,
        y: S.player.y - 30,
        r: 8,
      });

      g.se("jump");
    }

    for (const sh of S.shots){
      sh.y -= 600 * dt;
    }

    S.shots = S.shots.filter(
      sh => sh.y > -20
    );

    // ---- 敵の出現 ----
    S.spawnTimer -= dt;

    if (!S.boss){
      if (S.spawnTimer <= 0){
        S.spawnTimer = Math.max(
          0.4,
          1.1 - S.score * 0.03
        );

        spawnNormalEnemy(g);
      }

      if (S.score >= S.bossComing){
        S.boss = {
          x: g.W/2,
          y: -80,
          r: 55,
          hp: 10,
          maxHp: 10,
          t: 0,
        };
      }
    } else {
      // ボス戦中も通常敵は出すが、出現間隔は短縮しない
      if (S.spawnTimer <= 0){
        S.spawnTimer = Math.max(
          0.4,
          1.1 - S.bossComing * 0.03
        );

        spawnNormalEnemy(g);
      }

      // ボスは降りてきて左右にゆらゆら動く
      S.boss.t += dt;

      if (S.boss.y < 130){
        S.boss.y += 60 * dt;
      }

      S.boss.x =
        g.W/2 +
        Math.sin(S.boss.t * 1.2) * 300;

      if (
        S.boss.t > 1 &&
        Math.random() < dt * 1.5
      ){
        S.enemies.push({
          x: S.boss.x,
          y: S.boss.y + 40,
          r: 16,
          vy: 220,
          vx: g.rand(-80, 80),
          e: "🔻",
        });
      }
    }

    for (const en of S.enemies){
      en.y += en.vy * dt;
      en.x += en.vx * dt;

      if (
        en.x < 20 ||
        en.x > g.W - 20
      ){
        en.vx *= -1;
      }
    }

    // ---- 弾と敵の当たり判定 ----
    for (const sh of S.shots){
      for (const en of S.enemies){
        if (
          en.dead ||
          sh.dead ||
          !g.hit(sh, en)
        ){
          continue;
        }

        en.dead = true;
        sh.dead = true;

        const oldMultiplier = S.multiplier;

        S.combo =
          S.comboTimer > 0 ? S.combo + 1 : 1;
        S.comboTimer = 2;

        S.multiplier = Math.min(
          3,
          1 + Math.floor(S.combo / 5)
        );

        S.score += S.multiplier;

        addFloater(
          en.x,
          en.y,
          "+" + S.multiplier,
          "#fff",
          24
        );

        if (S.multiplier > oldMultiplier){
          addFloater(
            en.x,
            en.y - 30,
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

      if (
        S.boss &&
        S.boss.hp > 0 &&
        !sh.dead &&
        g.hit(sh, S.boss)
      ){
        sh.dead = true;
        S.boss.hp--;

        if (S.boss.hp <= 0){
          S.score += 20;
          S.best = Math.max(S.best, S.score);
          S.scene = "win";

          S.freeze = Math.min(
            0.2,
            S.freeze + 0.15
          );
          S.shake = 0.15;

          addFloater(
            S.boss.x,
            S.boss.y,
            "🎉 +20",
            "#fff",
            24
          );

          g.se("boom");
        } else {
          S.freeze = Math.min(
            0.2,
            S.freeze + 0.05
          );

          g.se("hit");
        }
      }
    }

    // ---- 敵と自機の当たり判定 ----
    if (S.player.invincible <= 0){
      for (const en of S.enemies){
        if (
          en.dead ||
          !g.hit(en, S.player)
        ){
          continue;
        }

        en.dead = true;
        S.hp--;
        S.player.invincible = 1;
        endCombo();
        g.se("boom");

        if (S.hp <= 0){
          S.scene = "over";
          S.best = Math.max(
            S.best,
            S.score
          );
          S.freeze = Math.min(
            0.2,
            S.freeze + 0.15
          );
          S.shake = 0.15;
        } else {
          S.freeze = Math.min(
            0.2,
            S.freeze + 0.05
          );
        }

        // 1フレームに残機が2つ以上減らないようにする
        break;
      }
    }

    // 🛸だけは画面下へ逃すとコンボが切れる
    for (const en of S.enemies){
      if (
        !en.dead &&
        en.y >= g.H + 40 &&
        en.e === "🛸"
      ){
        endCombo();
        en.dead = true;
      }
    }

    S.shots = S.shots.filter(
      sh => !sh.dead
    );

    S.enemies = S.enemies.filter(
      en => !en.dead && en.y < g.H + 40
    );
  },

  draw(g){
    g.bg("#0a0a1e");

    const shakePower =
      S.shake > 0 ? 4 * S.shake / 0.15 : 0;
    const ox =
      shakePower > 0 ? g.rand(-shakePower, shakePower) : 0;
    const oy =
      shakePower > 0 ? g.rand(-shakePower, shakePower) : 0;

    for (const st of S.stars){
      g.rect(
        st.x,
        st.y,
        2,
        2,
        "#ffffff88"
      );
    }

    if (S.scene === "title"){
      g.emoji(
        "🚀",
        g.W/2,
        175,
        90,
        { rot: -0.2 }
      );
      g.text(
        "うちゅうシューティング",
        g.W/2,
        285,
        42
      );
      g.text(
        "← → で移動、スペース か クリック押しっぱなしで発射",
        g.W/2,
        340,
        20,
        "#aaa"
      );
      g.text(
        "連続撃破で🔥コンボ。被弾後1秒は点滅して無敵",
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

    for (const sh of S.shots){
      g.emoji(
        "🔸",
        sh.x + ox,
        sh.y + oy,
        22
      );
    }

    for (const en of S.enemies){
      g.emoji(
        en.e,
        en.x + ox,
        en.y + oy,
        42
      );
    }

    if (S.boss){
      g.emoji(
        "ボス",
        S.boss.x + ox,
        S.boss.y + oy,
        110
      );

      // ボスの体力ゲージ
      g.rect(
        g.W/2 - 150,
        8,
        300,
        14,
        "#333"
      );
      g.rect(
        g.W/2 - 150,
        8,
        300 *
          Math.max(0, S.boss.hp) /
          S.boss.maxHp,
        14,
        "#e33"
      );
    }

    const playerAlpha =
      S.player.invincible > 0 &&
      Math.floor(S.player.invincible / 0.1) % 2 === 0
        ? 0.25
        : 1;

    g.emoji(
      "🚀",
      S.player.x + ox,
      S.player.y + oy,
      52,
      {
        rot: 0,
        alpha: playerAlpha,
      }
    );

    for (const f of S.floaters){
      g.text(
        f.text,
        f.x + ox,
        f.y + oy,
        f.size,
        f.color
      );
    }

    g.text(
      "スコア " + S.score,
      12,
      30,
      22,
      "#fff",
      "left"
    );

    if (S.combo > 0){
      g.text(
        "🔥 " + S.combo + " COMBO  ×" + S.multiplier,
        g.W/2,
        30,
        20,
        "#ffd700"
      );
    }

    let hearts = "";
    for (let i = 0; i < S.hp; i++){
      hearts += "❤️";
    }

    g.text(
      hearts,
      g.W - 12,
      30,
      22,
      "#fff",
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
        "💥 ゲームオーバー",
        g.W/2 + ox,
        230 + oy,
        40
      );
      g.text(
        "スコア " + S.score +
        " / ベスト " + S.best,
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

    if (S.scene === "win"){
      g.rect(
        0,
        0,
        g.W,
        g.H,
        "#00000099"
      );
      g.text(
        "🎉 ボスをたおした!",
        g.W/2 + ox,
        230 + oy,
        40
      );
      g.text(
        "スコア " + S.score +
        " / ベスト " + S.best,
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
