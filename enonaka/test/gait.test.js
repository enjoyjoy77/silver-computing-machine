// node enonaka/test/gait.test.js で走る。歩き方の足の動き
const assert = require('assert');
const Gt = require('../gait.js');
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('NG: ' + name); throw e; } };

// お試しのキャラ（VRM1_Constraint_Twist_Sample）を立たせて測った位置
const REST = {
  L: { hip: [0.0772, 0.8683, -0.0001], knee: [0.0772, 0.5154, -0.0075], ankle: [0.0772, 0.1007, -0.0324], ball: [0.0772, 0.0376, 0.0783] },
  R: { hip: [-0.0772, 0.8683, -0.0001], knee: [-0.0772, 0.5154, -0.0075], ankle: [-0.0772, 0.1007, -0.0324], ball: [-0.0772, 0.0376, 0.0783] }
};
const G = Gt.setup(REST);
const hipOf = (side, P) => [G[side].hip[0] + P.hipX, G[side].hip[1] + P.hipY, G[side].hip[2]];

t('寸法', () => {
  assert.ok(Math.abs(G.len - 0.768) < 0.005, String(G.len));
  assert.ok(G.stride > 0.85 && G.stride < 1.05);
});

t('立ち止まり（s = 0）では立った姿勢のまま', () => {
  for (const u of [0, 0.3, 0.7]) {
    const P = Gt.pose(G, u, 0);
    assert.ok(Math.abs(P.hipY) < 1e-9 && Math.abs(P.hipX) < 1e-9, P.hipY + ' ' + P.hipX);
    for (const side of ['L', 'R']) {
      const f = P[side];
      assert.ok(Math.abs(f.z - G[side].ankle[2]) < 0.04 && Math.abs(f.y - G[side].ankle[1]) < 1e-9);
      const a = Gt.legAngles(G, side, P, 0);
      assert.ok(Math.abs(a.thigh) < 1e-9 && Math.abs(a.knee) < 1e-9 && Math.abs(a.foot) < 1e-9, JSON.stringify(a));
    }
  }
});

t('IK：返した角度で脚を組むと、足首が目標に届く', () => {
  for (const u of [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85]) {
    const P = Gt.pose(G, u, 1);
    for (const side of ['L', 'R']) {
      const g = G[side], h = hipOf(side, P), f = P[side], ik = Gt.legIK(g, h, f);
      // 横の傾きは小さいので、前後の面で組み立てて確かめる
      const tf = g.alpha0 - ik.thigh, sf = tf - ik.knee + (g.beta0 - g.alpha0);
      const kz = h[2] + g.thigh * Math.sin(tf), ky = h[1] - g.thigh * Math.cos(tf);
      const az = kz + g.shin * Math.sin(sf), ay = ky - g.shin * Math.cos(sf);
      const down = Math.hypot(f.x - h[0], f.y - h[1]);
      if (ik.reach < 0.999) {
        assert.ok(Math.abs(az - f.z) < 0.004, side + u + ' z ' + az + ' ' + f.z);
        assert.ok(Math.abs((h[1] - ay) - down) < 0.004, side + u + ' y');
      }
      assert.ok(ik.knee > -0.02, 'ひざが逆に曲がった');
    }
  }
});

t('地面についている足は、体が進んでも世界で止まっている', () => {
  // 体を v で進め、位相は v ÷ 歩幅 の速さで進める
  const v = 1.0, dt = 1 / 120, rate = v / G.stride;
  let u = 0, rootZ = 0, worst = 0, checked = 0;
  const prev = {};
  for (let i = 0; i < 600; i++) {
    const P = Gt.pose(G, u, 1);
    for (const side of ['L', 'R']) {
      const f = P[side];
      // かかとを上げている間は、つま先の付け根が止まっている。足を平らに戻したときの足首の位置で比べる
      const g = G[side], h = g.ankle[1] - g.ballY;
      const flatZ = f.pitch > 0 ? f.z + g.toe * Math.cos(f.pitch) - h * Math.sin(f.pitch) - g.toe : f.z;
      const anchor = f.contact ? rootZ + flatZ : null;
      if (anchor !== null && prev[side] !== undefined && prev[side] !== null) { worst = Math.max(worst, Math.abs(anchor - prev[side])); checked++; }
      prev[side] = anchor;
    }
    rootZ += v * dt; u = (u + rate * dt) % 1;
  }
  assert.ok(checked > 500);
  assert.ok(worst < 0.0005, '滑り ' + worst);
});

t('足の動きに切れ目がない（着地・けり出し）', () => {
  let prev = null, worst = 0, worstP = 0;
  for (let i = 0; i <= 2000; i++) {
    const P = Gt.pose(G, i / 2000, 1);
    if (prev) for (const side of ['L', 'R']) {
      worst = Math.max(worst, Math.hypot(P[side].z - prev[side].z, P[side].y - prev[side].y));
      worstP = Math.max(worstP, Math.abs(P[side].pitch - prev[side].pitch));
    }
    prev = P;
  }
  assert.ok(worst < 0.004, '足首が跳んだ ' + worst);
  assert.ok(worstP < 0.02, '足の傾きが跳んだ ' + worstP);
});

t('接地している足には脚が届く（浮かない）。振り出す足は地面より上', () => {
  for (let i = 0; i < 200; i++) {
    const u = i / 200, P = Gt.pose(G, u, 1);
    for (const side of ['L', 'R']) {
      const f = P[side], ik = Gt.legIK(G[side], hipOf(side, P), f);
      if (f.contact) assert.ok(ik.reach <= 0.9975, side + u + ' reach ' + ik.reach);
      else assert.ok(f.y >= G[side].ankle[1] - 1e-9 || f.pitch > 0, side + u + ' 地面にめりこむ');
    }
  }
});

t('腰の上下は 1.5〜5cm、ひざは振り出しで 45〜80° 曲がり、立っている脚ではあまり曲がらない', () => {
  let lo = 9, hi = -9, kneeMax = 0;
  for (let i = 0; i < 200; i++) {
    const u = i / 200, P = Gt.pose(G, u, 1);
    lo = Math.min(lo, P.hipY); hi = Math.max(hi, P.hipY);
    const k = Gt.legIK(G.L, hipOf('L', P), P.L).knee;
    kneeMax = Math.max(kneeMax, k);
    if (P.L.contact && P.L.pitch <= 0.05) assert.ok(k < 0.4, u + ' 立ち脚のひざ ' + (k * 57.3).toFixed(0) + '°');
  }
  assert.ok(hi - lo > 0.015 && hi - lo < 0.05, '上下 ' + (hi - lo));
  assert.ok(kneeMax > 0.78 && kneeMax < 1.4, 'ひざ ' + kneeMax);
});

t('左右は半周ずれていて、両足が同時に浮くことはない', () => {
  for (let i = 0; i < 400; i++) {
    const P = Gt.pose(G, i / 400, 1);
    assert.ok(P.L.contact || P.R.contact);
  }
  const a = Gt.pose(G, 0.1, 1), b = Gt.pose(G, 0.6, 1);
  assert.ok(Math.abs(a.L.z - b.R.z) < 1e-9 && Math.abs(a.L.y - b.R.y) < 1e-9);
});

t('段差：床の高さを足ごとに足すと、低い段の足にも脚が届くよう腰が下がる', () => {
  const flat = Gt.pose(G, 0.3, 1), down = Gt.pose(G, 0.3, 1, { L: -0.15, R: 0 });
  assert.ok(Math.abs(down.L.y - (flat.L.y - 0.15)) < 1e-9);
  assert.ok(down.hipY < flat.hipY - 0.1, '腰 ' + flat.hipY + ' → ' + down.hipY);
  const ik = Gt.legIK(G.L, hipOf('L', down), down.L);
  assert.ok(ik.reach <= 0.9975);
  // 振り出し中の足は、着く予定の位置を返す（着く瞬間の前後の位置へ近づいていく）
  const a = Gt.pose(G, 0.7, 1), b = Gt.pose(G, 0.99, 1);
  assert.strictEqual(a.L.contact, false);
  assert.ok(a.L.landZ > b.L.landZ && Math.abs(b.L.landZ - b.L.z) < 0.02, a.L.landZ + ' ' + b.L.landZ + ' ' + b.L.z);
});

t('その場の足踏み（k = 0）：足は前後に動かず、上がって下りる', () => {
  let zMin = 9, zMax = -9, lift = 0;
  for (let i = 0; i < 100; i++) {
    const P = Gt.pose(G, i / 100, 0.6, null, 0);
    zMin = Math.min(zMin, P.L.z); zMax = Math.max(zMax, P.L.z);
    lift = Math.max(lift, P.L.y - G.L.ankle[1]);
  }
  assert.ok(zMax - zMin < 0.06, '前後 ' + (zMax - zMin));
  assert.ok(lift > 0.03);
});

console.log(`ok ${n}`);
