/* =====================================================
   サンプルゲーム4: スラもりはこび(スラもり2の簡易版)
   VRゲーム企画メモ 第6節「スラもり型・運搬設計の原理」を2Dに落としたもの。
   芯: ①玉は記号でなく"担ぐモノ"(重さ・持てる数の上限3)
       ②やることは「集める→運ぶ→トロッコに納品」の運搬ループひとつ
       ③重い玉ほど高得点=何を優先して運ぶかの判断
   ※rev3で「投げ戦闘」追加: 担いだ玉を1つ投げて敵退治かトロッコ直撃に使える
   ※rev34で「納品の手応え」追加: 納品でヒットストップ＋紙吹雪、目的地トロッコを光る土台で強調
   ※rev35で「わかりやすさ」追加: タイトルの文字階層・担ぎ玉を大きく・結果画面に成績表示
   ※rev36で結果画面(clear/win/over)ではゲーム中UI(上バー・なげるボタン)を隠して締める
   ※rev52で4・5ステージ追加(全5ステージ): 水の国=下向きの流れWATER_CURRENTで上のトロッコへ逆らって運ぶ / 火の国=点いたり消える火柱(FIRE_CYCLE周期・触れると玉を落とす・点火直前に予告)
===================================================== */
(function(){
"use strict";

// オリジナル絵文字: スラもりの主人公スライム(緑丸+目)
EmojiEngine.defineEmoji("スライム", [
  { e: "🟢", s: 1.0 },
  { e: "👀", dy: -14, s: 0.42 },
]);

// 運ぶ玉の種類。得点/重さ(=運ぶ速さ)/投げの威力 で役割を分ける
// throwDmg=投げて敵に当てたときのダメージ、fastThrow=投げると速く飛ぶ(当てやすい)
const BALL_TYPES = [
  { e: "🪙", value: 1, weight: 0.2, throwDmg: 1 },                  // コイン: 軽くて速い・数稼ぎ
  { e: "🍎", value: 2, weight: 0.5, throwDmg: 1, fastThrow: true }, // りんご: 投げると速く飛ぶ=当てやすい
  { e: "🐟", value: 3, weight: 1.0, throwDmg: 1 },                  // さかな: 中くらいの得点
  { e: "💎", value: 5, weight: 2.2, throwDmg: 2 },                  // 宝石: 重い・高得点・投げれば一撃
];

// ステージ。進むほど敵が速く・硬く・多く、復活も速く、ノルマ増。gimmick=そのステージ固有のおじゃま(段階3)
// rev21: 手ごたえ調整。旧設定は「敵を無視して集めるだけなら5/11/13秒でクリア=制限60〜70秒は45秒以上余る」で
//        時間が全く効かず、上手い人にプレッシャーが無かった(テストプレイ計測で判明)。
//        → 制限時間を大幅短縮(60/60/70→30/34/40)＋ノルマ増(20/35/50→26/42/60)で「急いで往復する」圧を作る。
//          往復が増える=敵に触れる機会が増える=既存の敵の脅威(重い荷物だと振り切れない)が初めて効いてくる。
const STAGES = [
  { name: "草原", bg: "#274b2e", deco: "🌿",  quota: 26, time: 30, enemyCount: 2, enemySpeed: 120, enemyHp: 1, respawn: 7, gimmick: null },
  { name: "砂漠", bg: "#6b5a2f", deco: "🏜️", quota: 42, time: 34, enemyCount: 3, enemySpeed: 150, enemyHp: 2, respawn: 6, gimmick: "cactus" },
  { name: "雪国", bg: "#3b4a5c", deco: "❄️",  quota: 60, time: 40, enemyCount: 3, enemySpeed: 165, enemyHp: 2, respawn: 5, gimmick: "ice" },
  { name: "水の国", bg: "#1f4a55", deco: "🌊", quota: 74, time: 44, enemyCount: 3, enemySpeed: 175, enemyHp: 2, respawn: 5, gimmick: "water" },  // 下向きの流れ=上のトロッコへ逆らって運ぶ
  { name: "火の国", bg: "#4a2420", deco: "🌋", quota: 88, time: 48, enemyCount: 4, enemySpeed: 185, enemyHp: 3, respawn: 5, gimmick: "fire" },   // 火柱が点いたり消えたり=タイミングで抜ける
];

// 段階4-5のギミック定数
const WATER_CURRENT = 55;                 // 水の国: 下向きの流れの強さ(px/秒)。上のトロッコへ逆らって運ぶ
const FIRE_CYCLE = 2.4, FIRE_ON = 1.0;    // 火の国: 火柱の周期(秒)と点いている時間(秒)

let S;

const THROW_BTN = { x: 884, y: 468, r: 44 };  // 画面右下の『なげる』ボタン(論理960x540基準)
function inThrowBtn(pt){ return Math.hypot(pt.x - THROW_BTN.x, pt.y - THROW_BTN.y) < THROW_BTN.r; }

function spawnBall(g){
  const t = g.pick(BALL_TYPES);
  return { x: g.rand(60, g.W - 60), y: g.rand(130, g.H - 50), r: 20,
           e: t.e, value: t.value, weight: t.weight, throwDmg: t.throwDmg, fastThrow: t.fastThrow };
}

function totalWeight(p){ let w = 0; for (const b of p.carry) w += b.weight; return w; }

function makeEnemy(g){
  // hp=体力(ステージで硬さが変わる)、hurtFlash=ダメージ点滅、ang=進行方向(ホーミングをにぶく)
  // spawning=出現予告中(透明点滅・動かない・当たらない)。spawnTが0で実体化して襲ってくる
  const st = STAGES[S.stage];
  return { x: g.rand(60, g.W - 60), y: g.rand(150, g.H - 60), r: 22,
           hp: st.enemyHp, maxHp: st.enemyHp, hurtFlash: 0, ang: g.rand(-Math.PI, Math.PI),
           vx: 0, vy: 0, stun: 0,             // vx/vy=移動速度(氷の慣性・ノックバック用)、stun=怯み残り時間
           spawning: true, spawnT: 2.0 };     // 出現予告を少し長めに(2秒)
}

function throwBall(g){
  const p = S.player;
  if (p.carry.length === 0) return;   // 手ぶらなら何も起きない(発射体は作らない)
  // 投げると手持ちが減る=運んで納品するか敵退治に使うかの配分判断になる(スラもり③やりくりの柱)
  const ball = p.carry.pop();
  // 自動照準: 400px以内の最寄りの敵。いなければトロッコ(S.cart)へ
  let target = S.cart, best = 400;
  for (const en of S.enemies){
    if (en.spawning && en.spawnT > 0.5) continue;   // まだ当たらない敵(予告序盤)は狙わない=素通り防止
    const d = g.dist(p, en);
    if (d < best){ best = d; target = en; }
  }
  const ax = target.x - p.x, ay = target.y - p.y, d = Math.hypot(ax, ay) || 1;
  const speed = ball.fastThrow ? 900 : 600;   // りんごは速く飛ぶ=当てやすい
  S.shots.push({ x: p.x, y: p.y, vx: ax / d * speed, vy: ay / d * speed,
                 r: 16, e: ball.e, value: ball.value, throwDmg: ball.throwDmg || 1, rot: 0 });
  g.se("jump");
}

// 納品の紙吹雪: トロッコから上向きに散る短命の粒(手応え演出)
function spawnConfetti(g, x, y){
  const kinds = ["🎉","✨","💫","⭐","🎊"];
  for (let i = 0; i < 12; i++){
    const a = g.rand(-Math.PI * 0.9, -Math.PI * 0.1);   // 上向きに扇状
    const sp = g.rand(140, 340);
    S.confetti.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                      e: g.pick(kinds), rot: g.rand(0, 6.28), vr: g.rand(-10, 10), life: g.rand(0.5, 0.9) });
  }
}

function reset(g){
  S = {
    scene: "title",              // title / play / stageclear / win / over
    stage: 0,
    player: { x: g.W/2, y: g.H - 90, r: 24, carry: [], hurt: 0, power: 0, vx: 0, vy: 0, hp: 3 },
    balls: [], enemies: [], shots: [], cactus: [], fires: [],
    cart: { x: g.W/2, y: 95, r: 42 },
    overReason: "time",          // over画面の理由: "time"(時間切れ) / "hp"(体力ゼロ)
    score: 0, quota: STAGES[0].quota, timeLeft: STAGES[0].time,
    popup: [],
    powerItem: null, powerTimer: 6,   // ⭐(触れると数秒パワー状態=敵を担げる)
    enemyTimer: STAGES[0].respawn,
    freeze: 0, confetti: [],          // freeze=ヒットストップ残り秒 / confetti=納品の紙吹雪
    best: S ? S.best : 0,             // 到達した最高ステージ番号
  };
}

// ステージを(再)開始: フィールドを作り直し、ノルマ・時間・敵の強さをそのステージのものにする
function startStage(g, idx){
  S.stage = idx;
  const st = STAGES[idx];
  S.quota = st.quota;
  S.timeLeft = st.time;
  S.score = 0;
  S.balls = []; for (let i = 0; i < 7; i++) S.balls.push(spawnBall(g));
  S.enemies = []; for (let i = 0; i < st.enemyCount; i++) S.enemies.push(makeEnemy(g));
  S.shots = [];
  S.powerItem = null; S.powerTimer = 6;
  S.enemyTimer = st.respawn;
  S.popup = [];
  S.freeze = 0; S.confetti = [];   // ステージ開始で演出状態をクリア
  const p = S.player;
  p.carry = []; p.hurt = 0; p.power = 0; p.vx = 0; p.vy = 0; p.hp = 3; p.x = g.W/2; p.y = g.H - 90;   // 体力は各ステージ開始で全回復
  // おじゃまギミック: 砂漠は🌵サボテン(固定・触ると玉を落とす)を数個置く
  S.cactus = [];
  if (st.gimmick === "cactus"){
    for (let i = 0; i < 4; i++){
      let cx, cy, tries = 0;
      do { cx = g.rand(120, g.W - 120); cy = g.rand(170, g.H - 90); tries++; }
      while (Math.hypot(cx - g.W/2, cy - (g.H - 90)) < 130 && tries < 12);   // 開始位置には置かない
      S.cactus.push({ x: cx, y: cy, r: 24 });
    }
  }
  // 火の国の火柱: 固定位置で点いたり消えたり(phaseをずらして一斉には点かない)。点いている間だけ危険
  S.fires = [];
  if (st.gimmick === "fire"){
    for (let i = 0; i < 5; i++){
      let fx, fy, tries = 0;
      do { fx = g.rand(120, g.W - 120); fy = g.rand(170, g.H - 90); tries++; }
      while (Math.hypot(fx - g.W/2, fy - (g.H - 90)) < 130 && tries < 12);   // 開始位置には置かない
      S.fires.push({ x: fx, y: fy, r: 26, phase: i * 0.62 });
    }
  }
  S.best = Math.max(S.best || 0, idx + 1);   // 到達した最高ステージ番号
}

// ノルマ達成: 最終ステージなら完全勝利、そうでなければステージクリア(次へ)
function reachQuota(g){
  if (S.stage >= STAGES.length - 1){ S.scene = "win"; S.best = Math.max(S.best, STAGES.length); }
  else { S.scene = "stageclear"; }
  g.se("clear");
}

// プレイヤーが敵に当たった: 体力を1減らす。0になったらゲームオーバー(体力ゼロ)
function damagePlayer(g){
  const p = S.player;
  p.hp -= 1;
  if (p.hp <= 0){ p.hp = 0; S.overReason = "hp"; S.scene = "over"; g.se("boom"); }
  else { g.se("hit"); }
}

EmojiEngine.register({
  id: "suramori",
  name: "スラもりはこび",
  icon: "🟢",
  desc: "玉を担いでトロッコへ運ぶ。重いほど高得点",

  init(g){ reset(g); this._state = S; },

  update(g, dt){
    if (S.scene === "title"){
      if (g.pressed("action") || g.pointer.justDown){ startStage(g, 0); S.scene = "play"; g.se("click"); }
      return;
    }
    if (S.scene === "stageclear"){
      if (g.pressed("action") || g.pointer.justDown){ startStage(g, S.stage + 1); S.scene = "play"; g.se("click"); }
      return;
    }
    if (S.scene === "win" || S.scene === "over"){
      if (g.pressed("action") || g.pointer.justDown){ reset(g); startStage(g, 0); this._state = S; S.scene = "play"; }
      return;
    }

    // ---- プレイ中 ----
    if (S.freeze > 0){ S.freeze -= dt; return; }   // ヒットストップ中は更新を止める(描画だけ続く=手応え)
    const p = S.player;
    S.timeLeft -= dt;
    if (p.hurt > 0) p.hurt -= dt;
    if (p.power > 0) p.power -= dt;

    // 移動(矢印/WASD、または マウス/指で追いかけ)。持つ玉が重いほど遅い
    // 『なげる』ボタンの円内を押している間は移動追従の対象から外す(誤操作防止)
    const pointerOnBtn = g.pointer.down && inThrowBtn(g.pointer);
    const speed = 300 / (1 + totalWeight(p) * 0.22);
    let dx = g.stickX(), dy = g.stickY();
    if (g.pointer.down && !pointerOnBtn){
      const ax = g.pointer.x - p.x, ay = g.pointer.y - p.y, d = Math.hypot(ax, ay);
      if (d > 8){ dx = ax / d; dy = ay / d; }
    }
    const len = Math.hypot(dx, dy);
    let tvx = 0, tvy = 0;
    if (len > 0){ tvx = dx/len * speed; tvy = dy/len * speed; }
    const gim = STAGES[S.stage].gimmick;
    if (gim === "ice"){
      // 雪国: 氷ですべる。目標速度へゆっくり寄る=急に止まれない・曲がれない(慣性)
      p.vx += (tvx - p.vx) * 3 * dt;
      p.vy += (tvy - p.vy) * 3 * dt;
    } else {
      p.vx = tvx; p.vy = tvy;   // 通常ステージは即時
    }
    const curY = (gim === "water") ? WATER_CURRENT : 0;   // 水の国は下へ流される=上のトロッコへ逆らって運ぶ
    p.x = g.clamp(p.x + p.vx * dt, 30, g.W - 30);
    p.y = g.clamp(p.y + (p.vy + curY) * dt, 55, g.H - 30);

    // 投げる: スペース等(action) か 👊ボタンのタップ(円内で押した瞬間)
    if (g.pressed("action") || (g.pointer.justDown && inThrowBtn(g.pointer))) throwBall(g);

    // 玉に触れたら担ぐ(3つまで。ダメージ直後は拾わない=落とした玉の即回収を防ぐ)
    if (p.hurt <= 0){
      for (const b of S.balls){
        if (p.carry.length >= 3) break;
        if (!b.taken && g.hit(p, b)){
          b.taken = true; p.carry.push({ e: b.e, value: b.value, weight: b.weight, throwDmg: b.throwDmg, fastThrow: b.fastThrow });
          g.se("coin");
          S.balls.push(spawnBall(g));   // 拾ったぶん新しい玉を湧かせる(場を保つ)
        }
      }
      S.balls = S.balls.filter(b => !b.taken);
    }

    // 🌵サボテン(砂漠のおじゃま): 触ると玉を1つ落とす(短い無敵つき)。避けて運ぶ
    if (p.hurt <= 0){
      for (const c of S.cactus){
        if (g.hit(p, c)){
          if (p.carry.length > 0){
            const lost = p.carry.pop();
            S.balls.push({ x: p.x + g.rand(-30, 30), y: p.y + g.rand(20, 50), r: 20,
                           e: lost.e, value: lost.value, weight: lost.weight, throwDmg: lost.throwDmg, fastThrow: lost.fastThrow });
          }
          p.hurt = 1.0; g.se("hit");
          break;
        }
      }
    }

    // 🔥火柱(火の国のおじゃま): 点いている柱に触れると玉を1つ落とす(短い無敵)。消えている間に通り抜ける
    if (p.hurt <= 0 && gim === "fire"){
      for (const f of S.fires){
        const on = ((g.time + f.phase) % FIRE_CYCLE) < FIRE_ON;   // 点いている間だけ危険(描画と同じ式)
        if (on && g.hit(p, f)){
          if (p.carry.length > 0){
            const lost = p.carry.pop();
            S.balls.push({ x: p.x + g.rand(-30, 30), y: p.y + g.rand(20, 50), r: 20,
                           e: lost.e, value: lost.value, weight: lost.weight, throwDmg: lost.throwDmg, fastThrow: lost.fastThrow });
          }
          p.hurt = 1.0; g.se("hit");
          break;
        }
      }
    }

    // パワーアイテム(⭐): 一定間隔で1個わく。担がずに、触れたら即消費してパワー状態に
    S.powerTimer -= dt;
    if (!S.powerItem && S.powerTimer <= 0){
      S.powerItem = { x: g.rand(80, g.W - 80), y: g.rand(150, g.H - 60), r: 24 };
      S.powerTimer = 12;   // 次にわくまで
    }
    if (S.powerItem && g.hit(p, S.powerItem)){
      S.powerItem = null;
      p.power = 8;         // 8秒間パワー状態
      g.se("clear");
    }

    // トロッコに触れたら納品(担いだ玉ぜんぶをスコアに)
    if (p.carry.length > 0 && g.hit(p, S.cart)){
      let gain = 0; for (const b of p.carry) gain += b.value;
      gain *= 2;   // 歩いて運んで納品するとボーナス2倍。投げ込み(等倍)より高得点=運搬こそ主役
      S.score += gain;
      S.popup.push({ x: S.cart.x, y: S.cart.y + 30, text: "+" + gain, life: 1 });
      p.carry = [];
      g.se("clear");
      S.freeze = 0.09;                        // 納品の瞬間に画面を一瞬止める(ヒットストップ=手応え)
      spawnConfetti(g, S.cart.x, S.cart.y);   // 紙吹雪でナイス運搬を褒める
      if (S.score >= S.quota) reachQuota(g);
    }

    // 敵: プレイヤーを追うが「急には曲がれない+ゆらぎ」でホーミングを甘くする(かわせる)。パワー中は逃げる
    const iceStage = STAGES[S.stage].gimmick === "ice";
    for (const en of S.enemies){
      if (en.hurtFlash > 0) en.hurtFlash -= dt;
      if (en.spawning){                 // 出現予告中: 動かない・当たらない(その場で透明点滅)。タメが終わると実体化
        en.spawnT -= dt;
        if (en.spawnT <= 0) en.spawning = false;
        continue;
      }
      if (en.stun > 0){                 // 怯み中: 追わず、ノックバックで後ろへ下がって止まる(投げ命中の反動)
        en.stun -= dt;
        en.vx *= 0.86; en.vy *= 0.86;
        en.x = g.clamp(en.x + en.vx * dt, 30, g.W - 30);
        en.y = g.clamp(en.y + en.vy * dt, 120, g.H - 30);
        continue;                       // 怯み中は接触ダメージも起こさない(無害)
      }
      let desired = Math.atan2(p.y - en.y, p.x - en.x);
      if (p.power > 0) desired += Math.PI;         // パワー中は逃げ出す(パックマン的)
      desired += g.rand(-0.15, 0.15);              // 進む向きに軽いゆらぎ=まっすぐ最短で来ない
      let diff = desired - en.ang;                 // 今の向きを目標へ少しずつ寄せる(急旋回できない)
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = 2.2;                        // 旋回の速さ(rad/秒)。低いほど曲がれずかわしやすい
      en.ang += g.clamp(diff, -turnRate * dt, turnRate * dt);
      const espd = STAGES[S.stage].enemySpeed;     // ステージで速くなる(草原120→雪165)。手ぶら300より遅い=振り切れる
      const tvx = Math.cos(en.ang) * espd, tvy = Math.sin(en.ang) * espd;
      if (iceStage){ en.vx += (tvx - en.vx) * 3 * dt; en.vy += (tvy - en.vy) * 3 * dt; }  // 雪国は敵も滑る(プレイヤーと公平)
      else { en.vx = tvx; en.vy = tvy; }
      en.x = g.clamp(en.x + en.vx * dt, 30, g.W - 30);
      en.y = g.clamp(en.y + (en.vy + curY) * dt, 120, g.H - 30);   // 水の国は敵も下へ流される(公平)
      if (!g.hit(p, en)) continue;
      if (p.power > 0){
        // パワー中: 敵を担いで稼ぐ(手が空いていれば)。ダメージは受けない
        if (p.carry.length < 3 && !en.caught){
          en.caught = true;
          p.carry.push({ e: "👾", value: 3, weight: 1.2, throwDmg: 1 });
          g.se("coin");
        }
      } else if (p.hurt <= 0){
        // 通常: 触れたら体力を1減らしてひるむ。玉を持っていれば1つ落とす
        if (p.carry.length > 0){
          const lost = p.carry.pop();
          S.balls.push({ x: p.x + g.rand(-30, 30), y: p.y + g.rand(20, 50), r: 20,
                         e: lost.e, value: lost.value, weight: lost.weight, throwDmg: lost.throwDmg, fastThrow: lost.fastThrow });
        }
        p.hurt = 1.2;
        damagePlayer(g);
      }
    }
    // 投げた玉(発射体): まっすぐ飛んで 敵 or トロッコ に当たる。画面外に出たら消える
    for (const sh of S.shots){
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.rot += 14 * dt;
      if (sh.x < -40 || sh.x > g.W + 40 || sh.y < -40 || sh.y > g.H + 40){ sh.dead = true; continue; }
      for (const en of S.enemies){
        if (en.caught || sh.dead) continue;
        if (en.spawning && en.spawnT > 0.5) continue;   // 出たて(予告序盤)は当たらないが、実体化直前(残り0.5秒)は当たる
        if (g.hit(sh, en)){
          en.spawning = false;               // 予告中に当てたら即実体化させる
          en.hp -= (sh.throwDmg || 1);
          sh.dead = true;
          if (en.hp <= 0){ en.caught = true; S.score += 4; S.popup.push({ x: en.x, y: en.y, text: "+4", life: 1 }); g.se("boom"); }   // 倒した(rev30: +10→+4。撃破は自衛のごほうびに下げ、点の主役を運搬へ戻す)
          else {
            // まだ生きてる=怯む: 赤フラッシュ+その場で少し止まり、投げの向きへノックバック(後ろに下がる)
            en.hurtFlash = 0.3; en.stun = 0.4;
            const sm = Math.hypot(sh.vx, sh.vy) || 1;
            en.vx = sh.vx / sm * 220; en.vy = sh.vy / sm * 220;
            g.se("hit");
          }
        }
      }
      if (!sh.dead && g.hit(sh, S.cart)){
        const gain = Math.max(1, Math.floor(sh.value / 2));   // 投げ込み納品は0.5倍(歩き運びは2倍=点は運んでこそ。投げは戦闘と非常用の安い手)
        S.score += gain;
        S.popup.push({ x: S.cart.x, y: S.cart.y + 30, text: "+" + gain, life: 1 });
        g.se("coin");
        sh.dead = true;
        if (S.score >= S.quota) reachQuota(g);
      }
    }
    S.shots = S.shots.filter(sh => !sh.dead);

    // 倒した/担いだ敵を消す。補充は時間差(倒した隙を作る)。数・間隔はステージ依存
    const est = STAGES[S.stage];
    const beforeCount = S.enemies.length;
    S.enemies = S.enemies.filter(en => !en.caught);
    if (S.enemies.length < beforeCount) S.enemyTimer = est.respawn;   // 減った瞬間からそのステージの復活秒
    if (S.enemies.length < est.enemyCount){
      S.enemyTimer -= dt;
      if (S.enemyTimer <= 0){ S.enemies.push(makeEnemy(g)); S.enemyTimer = est.respawn; }
    }

    // 納品ポップアップ
    for (const pu of S.popup){ pu.y -= 40 * dt; pu.life -= dt; }
    S.popup = S.popup.filter(pu => pu.life > 0);

    // 紙吹雪の粒を飛ばす(重力で落ちながら消える)
    for (const c of S.confetti){ c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 700 * dt; c.rot += c.vr * dt; c.life -= dt; }
    S.confetti = S.confetti.filter(c => c.life > 0);

    if (S.timeLeft <= 0 && S.scene === "play"){
      S.timeLeft = 0;
      S.overReason = "time"; S.scene = "over";
      g.se("boom");
    }
  },

  draw(g){
    const p = S.player;
    const st = STAGES[S.stage];
    g.bg(st.bg);
    // 地面の装飾(ステージで変わる: 草原🌿 / 砂漠🏜️ / 雪国❄️ / 水🌊 / 火🌋)
    for (let y = 150; y < g.H; y += 90)
      for (let x = 40; x < g.W; x += 90) g.emoji(st.deco, x + (y/90%2?45:0), y, 20, { alpha: 0.3 });
    // 水の国: 下向きの流れを見せる(💧が下へ流れる=どっちへ流されるか一目で分かる)
    if (st.gimmick === "water"){
      for (let i = 0; i < 7; i++){
        const fx = 70 + i * 130;
        const fy = 130 + ((g.time * 55 + i * 90) % (g.H - 130));
        g.emoji("💧", fx, fy, 22, { alpha: 0.4 });
      }
    }

    if (S.scene === "title"){
      g.emoji("スライム", g.W/2 - 60, 150, 88);
      g.emoji("🛒", g.W/2 + 60, 155, 66);
      g.text("スラもりはこび", g.W/2, 230, 46);
      // 目的を大きく1行(一番大事)
      g.text("玉を拾って 🛒トロッコまで運ぼう!", g.W/2, 286, 27, "#ffe08a");
      // 細かい説明は小さく・1色で(飾り)
      g.text("💎ほど高得点だが重い ／ 👾が追ってくる ／ ⭐でパワー(担いで稼げる)", g.W/2, 328, 16, "#9fb4c9");
      g.text("スペース か 👊 で玉を投げる(敵退治・非常用) ／ 全5ステージ", g.W/2, 352, 16, "#9fb4c9");
      // 始め方を一番目立たせる(点滅の👆で誘導)
      g.text("▶ クリック か スペース でスタート", g.W/2, 416, 26, "#fff");
      g.emoji("👆", g.W/2 + 172, 420, 30, { alpha: 0.5 + 0.5 * Math.sin(g.time * 5) });
      g.text("← → ↑ ↓ か マウス／指 で移動", g.W/2, 456, 16, "#8a98a8");
      return;
    }

    // トロッコ(納品先): 光る土台で画面で一番目立たせる。荷物を持つと強く光る
    const cartPulse = 1 + 0.10 * Math.sin(g.time * 4);
    const carrying = p.carry.length > 0;
    g.emoji("🟡", S.cart.x, S.cart.y + 4, 104 * cartPulse, { alpha: carrying ? 0.34 : 0.20 });
    g.emoji("🟡", S.cart.x, S.cart.y + 4, 66, { alpha: carrying ? 0.30 : 0.16 });
    g.text("ここに運ぶ", S.cart.x, S.cart.y - 44, 18, "#ffe08a");
    g.emoji("🛒", S.cart.x, S.cart.y, 68);

    // 🌵サボテン(砂漠のおじゃま。固定障害物)
    for (const c of S.cactus) g.emoji("🌵", c.x, c.y, 46);

    // 🔥火柱(火の国): 点くと大きく揺らめく／消えると噴出口♨️だけ／点く直前は小さく予告(理不尽回避)
    for (const f of S.fires){
      const k = (g.time + f.phase) % FIRE_CYCLE;
      if (k < FIRE_ON){
        g.emoji("🔥", f.x, f.y, 46 + 8 * Math.sin(g.time * 22));                 // 点火中: 大きく揺らぐ=危険
      } else {
        g.emoji("♨️", f.x, f.y, 22, { alpha: 0.55 });                            // 消火中: 噴出口だけ(位置を覚えられる)
        if (k > FIRE_CYCLE - 0.5) g.emoji("🔥", f.x, f.y, 22, { alpha: 0.35 + 0.35 * Math.sin(g.time * 22) });   // まもなく点く予告
      }
    }

    // パワーアイテム(点滅で目立たせる)
    if (S.powerItem){
      const on = Math.floor(g.time * 6) % 2 === 0;
      g.emoji("⭐", S.powerItem.x, S.powerItem.y, on ? 42 : 34);
    }

    // フィールドの玉
    for (const b of S.balls) g.emoji(b.e, b.x, b.y, 36);

    // 敵(パワー中は怯えて😱。ダメージを受けると赤くフラッシュ、体力ゲージを表示)
    const pw = p.power > 0;
    for (const en of S.enemies){
      if (en.spawning){                                  // 出現予告: 透明で点滅+❗マーク(ここに出るぞ、と知らせる)
        const bl = Math.floor(en.spawnT * 10) % 2 === 0;
        g.emoji("👾", en.x, en.y, 42, { alpha: bl ? 0.12 : 0.4 });
        g.emoji("❗", en.x, en.y - 36, 26, { alpha: 0.9 });
        continue;
      }
      if (en.hurtFlash > 0 && Math.floor(en.hurtFlash * 20) % 2 === 0)
        g.emoji("🔴", en.x, en.y, 52, { alpha: 0.6 });   // ダメージの赤フラッシュ
      g.emoji(pw ? "😱" : "👾", en.x, en.y, 42);
      if (en.hp < en.maxHp){                              // 体力が減っていたらゲージ
        g.rect(en.x - 20, en.y - 32, 40, 5, "#333");
        g.rect(en.x - 20, en.y - 32, 40 * g.clamp(en.hp / en.maxHp, 0, 1), 5, "#f55");
      }
    }

    // 投げた玉(発射体): 回転させながら描く
    for (const sh of S.shots) g.emoji(sh.e, sh.x, sh.y, 30, { rot: sh.rot });

    // プレイヤー(パワー中は✨をまとう、ダメージ直後は点滅)
    const blink = p.hurt > 0 && Math.floor(p.hurt * 12) % 2 === 0;
    if (pw) g.emoji("✨", p.x, p.y, 74, { alpha: 0.4 + 0.3 * Math.sin(g.time * 14) });
    g.emoji("スライム", p.x, p.y, 52, { alpha: blink ? 0.3 : 1 });
    // 担いでいる玉を頭の上に横並び(大きめ・重ならない間隔で「何を運んでいるか」を読めるように)
    p.carry.forEach((b, i) => {
      const n = p.carry.length, gx = p.x + (i - (n-1)/2) * 30;
      g.emoji(b.e, gx, p.y - 48, 28);
    });

    // ポップアップ(+N)
    for (const pu of S.popup) g.text(pu.text, pu.x, pu.y, 26, "#ffe08a");

    // 紙吹雪(納品の演出)
    for (const c of S.confetti) g.emoji(c.e, c.x, c.y, 22, { rot: c.rot, alpha: Math.min(1, c.life * 2.5) });

    // 上バー・なげるボタン(ゲーム中のUI)は「プレイ中」だけ描く=結果画面では隠して締める
    if (S.scene === "play"){
      // 上バー(スコア/ノルマ・時間)
      g.rect(0, 0, g.W, 44, "#00000066");
      g.text("素材 " + S.score + " / " + S.quota, 14, 22, 24, "#ffe08a", "left");
      // ノルマ達成ゲージ
      g.rect(230, 14, 200, 16, "#333");
      g.rect(230, 14, 200 * g.clamp(S.score / S.quota, 0, 1), 16, "#5c5");
      g.text("のこり " + Math.ceil(S.timeLeft) + " 秒", g.W - 14, 22, 24, S.timeLeft < 10 ? "#f88" : "#fff", "right");
      g.text("持ち " + p.carry.length + "/3", g.W/2 + 110, 22, 20, "#cfe", "left");
      if (pw) g.text("⚡ パワー " + Math.ceil(p.power) + "秒", g.W/2, 66, 22, "#ffdd33", "center");
      g.text("ステージ" + (S.stage + 1) + "/" + STAGES.length + "  " + st.name, 14, 62, 18, "#fff", "left");
      // 体力(ハート): 残りは❤️、失ったぶんは🤍
      let hearts = ""; for (let i = 0; i < 3; i++) hearts += i < p.hp ? "❤️" : "🤍";
      g.text(hearts, g.W - 14, 62, 22, "#fff", "right");

      // 『なげる』ボタン(画面右下・半透明の円+👊+ラベル)
      g.emoji("⚪", THROW_BTN.x, THROW_BTN.y, THROW_BTN.r * 2, { alpha: 0.35 });
      g.emoji("👊", THROW_BTN.x, THROW_BTN.y - 10, 38);
      g.text("なげる", THROW_BTN.x, THROW_BTN.y + 28, 14, "#fff");
    }

    if (S.scene === "stageclear"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      g.text("🎉 ステージクリア!", g.W/2, 195, 42);
      g.text(st.name + " 突破! つぎは " + STAGES[S.stage + 1].name, g.W/2, 253, 24, "#ffe08a");
      g.text("運んだ素材 " + S.score + " / " + S.quota + "   最高到達 ステージ" + S.best + "/" + STAGES.length, g.W/2, 298, 20, "#cfe");
      g.text("クリック か スペース で次のステージへ", g.W/2, 348, 20, "#aaa");
    }
    if (S.scene === "win"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      g.text("🏆 全ステージ制覇!", g.W/2, 200, 44);
      g.text("5つの国ぜんぶ運びきった!", g.W/2, 260, 24, "#ffe08a");
      g.text("最後のステージで 素材 " + S.score + " / " + S.quota + " 達成", g.W/2, 304, 20, "#cfe");
      g.text("クリック か スペース でもう一回", g.W/2, 352, 20, "#aaa");
    }
    if (S.scene === "over"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      if (S.overReason === "hp"){
        g.text("💀 たおれた…", g.W/2, 190, 42);
        g.text("ステージ" + (S.stage + 1) + " " + st.name + " で体力ゼロ", g.W/2, 247, 22, "#fbb");
      } else {
        g.text("⏰ 時間切れ", g.W/2, 190, 42);
        g.text("ステージ" + (S.stage + 1) + " " + st.name + " でタイムアップ", g.W/2, 247, 22, "#ffd");
      }
      g.text("運んだ素材 " + S.score + " / " + S.quota + "   あと " + Math.max(0, S.quota - S.score) + " 足りなかった", g.W/2, 292, 20, "#cfe");
      g.text("最高到達 ステージ" + S.best + "/" + STAGES.length, g.W/2, 320, 18, "#9fb4c9");
      g.text("クリック か スペース で最初から", g.W/2, 358, 20, "#aaa");
    }
  },
});
})();
