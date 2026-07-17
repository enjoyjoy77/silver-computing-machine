/* =====================================================
   サンプルゲーム5: かめはめ波バトル
   ドラゴンボール風「ビームの押し合い」を連打で再現。
   芯: ①きをためる(チャージ)→②連打で押し合う(綱引き)のシンプルな2フェーズ
       ②ためるほど1連打の威力が上がる(ただし上限あり)=溜め時間にも意味を持たせる
       ③3人抜き。倒すごとに相手が強くなる緊張感
===================================================== */
(function(){
"use strict";

// オリジナル絵文字: プレイヤーの戦士(炎オーラ+道着)。エンジンの重ね合わせ機能のデモも兼ねる
EmojiEngine.defineEmoji("せんし", [
  { e: "🔥", dy: 40, s: 0.6 },
  { e: "🥋", s: 1.0 },
]);

// 敵は3人。強くなるほど cpuPower(押す強さ)が上がり、絵文字も禍々しく・少し大きく
// cpuPower=CPUが押し返す強さ(/秒)。人間の連打(毎秒7〜8回×1連打0.022)で
// 「1人目はラク→ボスはためて全力連打でギリ勝てる」ように調整
const ENEMIES = [
  { name: "わるもの", e: "👹", cpuPower: 0.10, size: 92  },  // rev19: 1人目がラクすぎ→0.08から上げて歯ごたえを
  { name: "エリート", e: "😈", cpuPower: 0.12, size: 102 },
  { name: "まおう",   e: "👾", cpuPower: 0.15, size: 114 },
];

// rev19: 膠着(中途半端な速さで延々決着しない)を解消する仕掛け。
// GRACE秒までは元のバランスのまま(短い勝負に影響しない)。それを超えて長引いた分だけ
// CPUの押しが強くなり、必ず決着に向かう。通常の勝負(数秒)は素通り、膠着だけに効く。
const ESC_GRACE = 6;     // この秒数まではエスカレートしない
const ESC_RATE = 0.18;   // 超過1秒ごとに CPU push が +18%
// rev19: 連打を"続ける"と1連打の威力が上がるコンボ。ためない速攻ビルドの勝ち筋を作る。
// ためボーナスとコンボボーナスは「たし算せず大きい方を採る」=どちらかのルートで上限に届く二択にする。
const COMBO_STEP = 0.0006, COMBO_MAX = 0.012, COMBO_WINDOW = 0.2;

const CHARGE_TIME  = 3;     // ためフェーズの長さ(秒)
const RESULT_DELAY = 1.4;   // 決着演出の表示時間(秒)
const CHANT = "か…め…は…め…";
const PLAYER_X = 120, ENEMY_X = 840, BEAM_Y = 300;

let S;

// ためフェーズを(再)スタート。綱引きまわりの値をリセットする
function startCharge(){
  S.scene = "charge";
  S.pos = 0.5;
  S.chargeCount = 0;
  S.chargeTimer = 0;
  S.chargeBonus = 0;
  S.shakeT = 0;
  S.clashElapsed = 0;   // rev19: clashの経過秒(エスカレート用)
  S.combo = 0;          // rev19: 連打コンボ数
  S.lastTapT = -1;      // rev19: 最後に連打した時刻(clashElapsed基準)
}

function reset(g){
  S = {
    scene: "title",        // title / charge / clash / result / win / over
    round: 0,               // 0〜2 (今の相手 = ENEMIES[round])
    pos: 0.5,               // 光球の位置。0=負け 1=勝ち
    chargeCount: 0,
    chargeTimer: 0,
    chargeBonus: 0,
    resultWin: false,
    resultTimer: 0,
    shakeT: 0,               // 画面揺れの残り時間
    clashElapsed: 0,         // rev19
    combo: 0,                // rev19
    lastTapT: -1,            // rev19
  };
}

// win/over からの完全リトライ(round0のためフェーズへ直行)
function restart(g){
  reset(g);
  startCharge();
}

EmojiEngine.register({
  id: "kameha",
  name: "かめはめ波バトル",
  icon: "🔵",
  desc: "連打でビームを押し合う打ち合い",

  init(g){ reset(g); this._state = S; },

  update(g, dt){
    if (S.scene === "title"){
      if (g.pressed("action") || g.pointer.justDown){
        g.se("click");
        startCharge();
      }
      return;
    }

    if (S.scene === "charge"){
      S.chargeTimer += dt;
      if (g.pressed("action") || g.pointer.justDown){
        S.chargeCount++;
        g.se("coin");
      }
      if (S.chargeTimer >= CHARGE_TIME){
        S.chargeBonus = Math.min(S.chargeCount * 0.0004, 0.012);
        S.pos = 0.5;
        S.scene = "clash";
        g.se("jump");
      }
      return;
    }

    if (S.scene === "clash"){
      const enemy = ENEMIES[S.round];
      S.clashElapsed += dt;
      const wave = 1 + 0.5 * Math.sin(g.time * 2);
      const esc = 1 + Math.max(0, S.clashElapsed - ESC_GRACE) * ESC_RATE;   // rev19: 膠着(6秒超)だけ押しが強くなる
      S.pos -= enemy.cpuPower * wave * esc * dt;
      if (S.shakeT > 0) S.shakeT = Math.max(0, S.shakeT - dt);
      if (g.pressed("action") || g.pointer.justDown){
        // rev19: 連打を続けるとコンボが伸びて威力上限へ。ためた人は最初から上限、
        //        ためない人は速く叩き続けて上限に届く=たし算せず大きい方を採用する二択。
        if (S.clashElapsed - S.lastTapT <= COMBO_WINDOW) S.combo++; else S.combo = 0;
        S.lastTapT = S.clashElapsed;
        const comboBonus = Math.min(S.combo * COMBO_STEP, COMBO_MAX);
        S.pos += 0.022 + Math.max(S.chargeBonus, comboBonus);
        S.shakeT = 0.08;
        if (Math.random() < 0.35) g.se("click");
      }
      if (S.pos >= 1){
        S.resultWin = true;
        S.resultTimer = 0;
        S.scene = "result";
        g.se("clear");
      } else if (S.pos <= 0){
        S.resultWin = false;
        S.resultTimer = 0;
        S.scene = "result";
        g.se("boom");
      }
      S.pos = g.clamp(S.pos, 0, 1);
      return;
    }

    if (S.scene === "result"){
      S.resultTimer += dt;
      if (S.resultTimer >= RESULT_DELAY){
        if (S.resultWin){
          S.round++;
          if (S.round >= ENEMIES.length) S.scene = "win";
          else startCharge();
        } else {
          S.scene = "over";
        }
      }
      return;
    }

    if (S.scene === "win" || S.scene === "over"){
      if (g.pressed("action") || g.pointer.justDown){
        restart(g);
        this._state = S;
      }
      return;
    }
  },

  draw(g){
    g.bg("#101226");
    // 星空風の装飾(軽い点を並べるだけ)
    for (let i = 0; i < 24; i++){
      g.rect((i * 83) % g.W, (i * 47) % 220, 2, 2, "#2a2f55");
    }

    if (S.scene === "title"){
      g.text("かめはめ波バトル", g.W/2, 170, 46);
      g.text("連打でビームを押し合え!3人抜き勝負", g.W/2, 220, 22, "#9cf");
      g.emoji("せんし", g.W/2 - 150, 320, 100);
      g.emoji(ENEMIES[0].e, g.W/2 + 150, 320, 88);
      g.text("スペース連打 か 画面タップ連打 で押し返す", g.W/2, 415, 22, "#ffd");
      g.text("ためて一気に or ためず速い連打を続ける、どちらでも強くなれる", g.W/2, 445, 18, "#9cf");
      g.text("クリック か スペースでスタート", g.W/2, 478, 20, "#aaa");
      return;
    }

    const enemy = ENEMIES[Math.min(S.round, ENEMIES.length - 1)];

    if (S.scene === "charge"){
      const t = g.clamp(S.chargeTimer / CHARGE_TIME, 0, 1);
      const n = Math.floor(t * CHANT.length);
      g.text("きをためろ!れんだ!", g.W/2, 80, 30, "#ffd");
      g.text(CHANT.slice(0, n), g.W/2, 130, 36, "#7ff");

      const auraSize = 128 + 12 * Math.sin(g.time * 10);
      g.emoji("🔥", PLAYER_X, 330, auraSize, { alpha: 0.5 });
      g.emoji("せんし", PLAYER_X, 310, 110);
      g.emoji(enemy.e, ENEMY_X, 310, enemy.size);
      g.text(enemy.name, ENEMY_X, 310 + enemy.size/2 + 30, 20, "#f99");

      g.rect(g.W/2 - 150, 440, 300, 18, "#333");
      g.rect(g.W/2 - 150, 440, 300 * t, 18, "#5cf");
      g.text("れんだ " + S.chargeCount + "回", g.W/2, 480, 18, "#ccc");
      g.text((S.round + 1) + "人目 / " + ENEMIES.length + "人", 14, 24, 20, "#fff", "left");
      return;
    }

    if (S.scene === "clash"){
      g.text((S.round + 1) + "人目 / " + ENEMIES.length + "人", 14, 24, 20, "#fff", "left");
      g.text(enemy.name, g.W - 14, 24, 20, "#f99", "right");

      g.text("押し合いゲージ", g.W/2, 40, 16, "#ccc");
      g.rect(g.W/2 - 200, 50, 400, 20, "#333");
      g.rect(g.W/2 - 200, 50, 400 * S.pos, 20, "#6cf");

      const orbX = 140 + S.pos * (820 - 140);
      const shakeX = S.shakeT > 0 ? g.rand(-5, 5) : 0;
      const shakeY = S.shakeT > 0 ? g.rand(-5, 5) : 0;

      // 撃ち手(先に描いて、ビームが手前に重なるように)
      g.emoji("せんし", PLAYER_X, 340, 104);
      g.emoji(enemy.e, ENEMY_X, 340, enemy.size);

      // 2本のかめはめ波: 外側グロー+明るい芯の二重描きでエネルギーらしく
      // プレイヤー側=水色(左→光球)、敵側=紫(右→光球)。境目=せめぎ合いの位置
      g.rect(PLAYER_X, BEAM_Y - 24, orbX - PLAYER_X, 48, "#2f6fb0");    // 水色グロー
      g.rect(PLAYER_X, BEAM_Y - 11, orbX - PLAYER_X, 22, "#d6f6ff");    // 水色の芯
      g.rect(orbX, BEAM_Y - 24, ENEMY_X - orbX, 48, "#7a1fa8");         // 紫グロー
      g.rect(orbX, BEAM_Y - 11, ENEMY_X - orbX, 22, "#f4bcff");         // 紫の芯

      // 衝突点の「せめぎ合い光球」: 大きく脈動し、拮抗(pos≒0.5)ほど巨大化
      const clashFactor = 1 - Math.min(1, Math.abs(S.pos - 0.5) * 2);   // 0.5付近で1
      const orbSize = 96 + 16 * Math.sin(g.time * 22) + clashFactor * 64;
      g.emoji("⚪", orbX + shakeX, BEAM_Y + shakeY, orbSize * 1.3, { alpha: 0.45 });  // 外側の白い膨らみ
      g.emoji("🔆", orbX + shakeX, BEAM_Y + shakeY, orbSize);                          // 芯
      // 火花(光球のまわりに散る)
      for (let i = 0; i < 6; i++){
        const a = g.time * 7 + i * 1.05;
        const rr = orbSize * 0.5 + 8;
        g.emoji(i % 2 ? "⚡" : "✨",
          orbX + Math.cos(a) * rr + g.rand(-5, 5),
          BEAM_Y + Math.sin(a) * rr + g.rand(-5, 5), 28);
      }

      g.text("連打しろ!", g.W/2, 505, 22, "#ffd");
      if (S.combo >= 5) g.text("コンボ " + S.combo + "!", g.W/2, 90, 24, "#ffd07a");   // rev19: 速攻ビルドの手応え表示
      return;
    }

    if (S.scene === "result"){
      g.emoji("せんし", PLAYER_X, 330, 100);
      g.emoji(enemy.e, ENEMY_X, 330, enemy.size, { alpha: S.resultWin ? 0.55 : 1 });
      if (S.resultWin){
        g.text("かめはめ波ー!!", g.W/2, 220, 46, "#7ff");
        g.emoji("💥", ENEMY_X, 330, 150);
        if (S.round + 1 >= ENEMIES.length){
          g.text("とどめだ!", g.W/2, 290, 26, "#ffd");
        } else {
          g.text("つぎの相手: " + ENEMIES[S.round + 1].name, g.W/2, 290, 22, "#ffd");
        }
      } else {
        g.text("おしきられた…", g.W/2, 220, 42, "#f88");
      }
      return;
    }

    if (S.scene === "win"){
      g.emoji("せんし", g.W/2, 300, 130);
      g.text("完全勝利!", g.W/2, 170, 48, "#ffe08a");
      g.text("3人抜き達成!", g.W/2, 230, 24, "#9cf");
      g.text("クリック か スペースでもう一回", g.W/2, 420, 22, "#aaa");
      return;
    }

    if (S.scene === "over"){
      g.emoji("せんし", g.W/2, 300, 110, { alpha: 0.6 });
      g.text("やられた…", g.W/2, 170, 46, "#f88");
      g.text((S.round + 1) + "人目で敗北", g.W/2, 230, 22, "#fcc");
      g.text("クリック か スペースでもう一回", g.W/2, 420, 22, "#aaa");
      return;
    }
  },
});
})();
