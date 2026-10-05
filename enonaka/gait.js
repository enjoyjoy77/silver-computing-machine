// えのなか の歩き方。足をどこに置くかを先に決めて、脚の角度はそこから逆算する（2 関節の IK）。
// 地面についている足は、体が進んだぶんだけ後ろへ下げる。だから世界で見ると止まっている（滑らない）。
// ブラウザでも node でも読める（three.js には触らない）。
//
// 座標はキャラの足元が原点、前が +z、上が +y、キャラの左が +x（VRM 1.0 の向き）。
// 角度は骨の x 回り（正で脚が後ろへ、つま先が下へ）と z 回り（正で足が +x へ）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EnonakaGait = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const DUTY = 0.6;          // 1 歩きのうち、足が地面についている割合

  // 立った姿勢で測った位置から、歩き方の寸法を決める
  //   rest = { L: { hip, knee, ankle, ball }, R: { ... } }  各 [x, y, z]（ball はつま先の付け根、なければ null）
  function setup(rest) {
    const leg = side => {
      const r = rest[side], h = r.hip, k = r.knee, a = r.ankle;
      const thigh = Math.hypot(k[0] - h[0], k[1] - h[1], k[2] - h[2]);
      const shin = Math.hypot(a[0] - k[0], a[1] - k[1], a[2] - k[2]);
      const ball = r.ball || [a[0], Math.max(0.01, a[1] * 0.25), a[2] + Math.max(0.06, a[1] * 1.1)];
      return {
        hip: h.slice(), ankle: a.slice(), thigh, shin,
        // 立った姿勢での、ももとすねの前への傾き
        alpha0: Math.atan2(k[2] - h[2], h[1] - k[1]), beta0: Math.atan2(a[2] - k[2], k[1] - a[1]),
        toe: Math.max(0.04, ball[2] - a[2]), ballY: Math.min(ball[1], a[1] - 0.01)
      };
    };
    const L = leg('L'), R = leg('R');
    const len = (L.thigh + L.shin + R.thigh + R.shin) / 2;
    return {
      L, R, len,
      stride: 1.15 * len,          // 2 歩でこれだけ進む
      lift: 0.085 * len,           // 振り出す足を上げる高さ
      back: -0.06 * len,           // 足を置く範囲の中心。着地よりけり出しのほうが腰から遠い
      speed: 1.1 * len             // ふつうに歩く速さ（m/秒）。脚の長さに合わせる
    };
  }

  // 足をつま先の付け根まわりに傾けたときの、足首の位置（かかとが上がる）
  function pivotOnBall(ballZ, g, p) {
    const l = g.toe, h = g.ankle[1] - g.ballY;
    return { z: ballZ - l * Math.cos(p) + h * Math.sin(p), y: g.ballY + l * Math.sin(p) + h * Math.cos(p) };
  }

  // u: 歩きの位相（0〜1）。s: 歩きの強さ（0 で立ち止まり、1 で歩く）
  // ground: 足ごとの床の高さ（キャラの足元からの差、m）。段差の上り下りに使う。なくてもよい
  // k: 歩幅の割合（0 でその場の足踏み。向きを変えるとき）。なければ 1
  // 返す値：腰の動き（hipX, hipY）と、左右の足首の目標（x, y, z）・足の傾き・接地しているか。
  //   振り出し中の足は、振り出しの進み r と、着く予定の位置 landZ（いまの足元からの前後）も返す
  function pose(G, u, s, ground, k) {
    s = clamp(s, 0, 1);
    k = k === undefined ? 1 : clamp(k, 0, 1);
    const A = G.stride * DUTY / 2 * s * k, c = G.back * s * k, len = G.len;
    const feet = {};
    for (const side of ['L', 'R']) {
      const g = G[side];
      const q = ((u + (side === 'L' ? 0 : 0.5)) % 1 + 1) % 1;
      const fx = g.ankle[0] * (1 - 0.3 * s);
      let z, y, pitch, contact, r = 0, landZ = null;
      if (q < DUTY) {
        // 接地：前 (c + A) から後ろ (c − A) へ、一定の速さで
        const k = q / DUTY;
        const zf = c + A - 2 * A * k;
        contact = true;
        if (k < 0.12) { pitch = -0.2 * s * (1 - k / 0.12); z = zf; y = g.ankle[1]; }
        else if (k > 0.62) {
          // かかとを上げる（つま先の付け根で踏んだまま）
          pitch = 0.5 * s * smooth((k - 0.62) / 0.38);
          const pv = pivotOnBall(zf + g.toe, g, pitch);
          z = pv.z; y = pv.y;
        } else { pitch = 0; z = zf; y = g.ankle[1]; }
      } else {
        // 振り出し：けり出したところから、次に着く所へ。低く前へ運ぶ
        r = (q - DUTY) / (1 - DUTY);
        // 着くころには体がさらに進んでいるので、そのぶん先
        landZ = c + A + (1 - r) * (1 - DUTY) * G.stride * s * k;
        const start = pivotOnBall(c - A + g.toe, g, 0.5 * s), endZ = c + A;
        const e = 0.5 - 0.5 * Math.cos(Math.PI * r);
        z = start.z + (endZ - start.z) * e;
        y = start.y + (g.ankle[1] - start.y) * e + G.lift * s * Math.sin(Math.PI * Math.pow(r, 0.85));
        pitch = 0.5 * s * (1 - smooth(r / 0.45)) - 0.2 * s * smooth((r - 0.55) / 0.45);
        contact = false;
      }
      if (ground && ground[side]) y += ground[side];
      feet[side] = { x: fx, y, z, pitch, contact, r, landZ };
    }
    // 腰：片足で立つ間がいちばん高く、着地の直後がいちばん低い。立っている足の側へ少し寄る
    // 低い所は、着地した前の足に脚がほぼ伸びて届く高さ。高い所は、ひざがほんの少し曲がる高さ
    const yLow = Math.sqrt(Math.max(0, ((1 - 0.006 * s) * len) ** 2 - (A + c) ** 2)) - len;
    const yHigh = -0.004 * len * s;
    let hipY = (yHigh + yLow) / 2 + (yHigh - yLow) / 2 * Math.cos(TAU * (2 * u - 0.52));
    const hipX = 0.03 * len * s * Math.cos(TAU * (u - 0.3)) * (Math.sign(G.L.hip[0]) || 1);
    // 接地している足に脚が届かないなら、腰を下げる（足が浮かないように）
    for (const side of ['L', 'R']) {
      const f = feet[side], g = G[side];
      if (!f.contact) continue;
      const dz = f.z - g.hip[2], dx = f.x - (g.hip[0] + hipX);
      const top = f.y + Math.sqrt(Math.max(0, ((1 - 0.003 * s) * (g.thigh + g.shin)) ** 2 - dz * dz - dx * dx));
      hipY = Math.min(hipY, top - g.hip[1]);
    }
    return { hipX, hipY, L: feet.L, R: feet.R };
  }

  // 腰の関節 h（[x, y, z]）から足首の目標 f（{x, y, z}）へ脚を伸ばす。ひざは前へ曲げる
  function legIK(g, h, f) {
    const dx = f.x - h[0], dy = f.y - h[1], dz = f.z - h[2];
    const down = Math.sqrt(dx * dx + dy * dy);
    const roll = Math.atan2(dx, -dy);                       // 横への傾き
    const a = g.thigh, b = g.shin;
    const d = clamp(Math.hypot(dz, down), Math.abs(a - b) + 1e-4, 0.9995 * (a + b));
    const phi = Math.atan2(dz, down);                       // 腰→足首の線の前への傾き
    const gam = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const del = Math.acos(clamp((b * b + d * d - a * a) / (2 * b * d), -1, 1));
    const thighFwd = phi + gam, shinFwd = phi - del;
    const thigh = -(thighFwd - g.alpha0);
    const knee = (thighFwd - shinFwd) + (g.beta0 - g.alpha0);
    return { thigh, knee, roll, reach: Math.hypot(dz, down) / (a + b) };
  }

  // 骨に入れる角度。歩きが弱いうちは立った姿勢へ寄せる（立った脚が少し反っているモデルでも、止まると元の形に戻る）
  function legAngles(G, side, P, s) {
    const g = G[side], f = P[side];
    const ik = legIK(g, [g.hip[0] + P.hipX, g.hip[1] + P.hipY, g.hip[2]], f);
    const w = smooth(s / 0.3);
    const thigh = ik.thigh * w, knee = ik.knee * w, roll = ik.roll * w;
    return { thigh, knee, roll, foot: f.pitch - thigh - knee, footRoll: -roll, reach: ik.reach };
  }

  return { DUTY, setup, pose, legIK, legAngles, pivotOnBall };
});
