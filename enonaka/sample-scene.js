// えのなか のお試しの絵。stage-core と同じカメラで夏の広場を描き、
// 床・通れない所・前に出すもの・すわる場所の設定も、描いた形からそのまま作って返す。
(function (root) {
  'use strict';
  const C = root.EnonakaCore;
  const W = 1600, H = 900;
  const VIEW = { horizon: 0.42, eye: 1.5, fov: 60 };
  // 影は奥・右へ落ちる（高さ 1m あたりのずれ）
  const SUN = { x: 0.55, z: -0.45 };
  const LINE = 'rgba(58,40,36,0.55)';

  function make() {
    const cam = C.makeCamera(W, H, VIEW);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const rnd = mulberry(20261005);
    const P = (x, y, z) => C.worldToImage(cam, x, y, z);
    const N = (x, y, z) => { const p = P(x, y, z); return [p.u / W, p.v / H]; };

    const path = pts => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.u, p.v) : g.moveTo(p.u, p.v)); g.closePath(); };
    const face = (pts3, fill, stroke) => {
      path(pts3.map(q => P(q[0], q[1], q[2])));
      g.fillStyle = fill; g.fill();
      if (stroke !== false) { g.strokeStyle = stroke || LINE; g.lineWidth = 1.4; g.stroke(); }
    };
    // 箱：見えている面だけ描く。zn が手前（大きい方）、zf が奥
    const box = (x0, x1, y0, y1, zn, zf, col, stroke) => {
      if (0 < x0) face([[x0, y0, zn], [x0, y0, zf], [x0, y1, zf], [x0, y1, zn]], col.side, stroke);
      if (0 > x1) face([[x1, y0, zn], [x1, y0, zf], [x1, y1, zf], [x1, y1, zn]], col.side, stroke);
      if (VIEW.eye > y1) face([[x0, y1, zn], [x1, y1, zn], [x1, y1, zf], [x0, y1, zf]], col.top, stroke);
      face([[x0, y0, zn], [x1, y0, zn], [x1, y1, zn], [x0, y1, zn]], col.front, stroke);
    };
    const boxCorners = (x0, x1, y0, y1, zn, zf) => {
      const out = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [zn, zf]) out.push([x, y, z]);
      return out;
    };
    // 影：角を地面へ落として、外側をなぞる
    const shadow = (corners, alpha) => {
      const pts = corners.map(([x, y, z]) => P(x + y * SUN.x, 0, z + y * SUN.z)).map(p => [p.u, p.v]);
      const hull = convexHull(pts);
      g.beginPath(); hull.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.fillStyle = `rgba(64,58,120,${alpha || 0.2})`; g.fill();
    };
    const hullN = corners => convexHull(corners.map(([x, y, z]) => N(x, y, z)));
    const ring = (cx, cz, r, y, n) => {
      const out = [];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]); }
      return out;
    };
    const blob = (u, v, r, fill) => { g.beginPath(); g.arc(u, v, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };

    // 空
    const sky = g.createLinearGradient(0, 0, 0, cam.cy);
    sky.addColorStop(0, '#3f8fd8'); sky.addColorStop(0.65, '#8cc4ec'); sky.addColorStop(1, '#d4ecf6');
    g.fillStyle = sky; g.fillRect(0, 0, W, cam.cy + 2);

    // 入道雲
    const cloud = (cx, cy, s) => {
      const puffs = [];
      for (let i = 0; i < 16; i++) {
        const a = rnd() * Math.PI, d = rnd();
        puffs.push([cx + Math.cos(a) * d * 150 * s, cy - Math.sin(a) * d * 90 * s, (34 + rnd() * 40) * s]);
      }
      for (let i = 0; i < 7; i++) puffs.push([cx + (i - 3) * 42 * s, cy + 6 * s, (30 + rnd() * 10) * s]);
      for (const [x, y, r] of puffs) blob(x + 6 * s, y + 9 * s, r, '#b9cfe2');
      for (const [x, y, r] of puffs) blob(x, y, r, '#eef5fb');
      for (const [x, y, r] of puffs) blob(x - r * 0.22, y - r * 0.25, r * 0.7, '#ffffff');
    };
    cloud(330, 210, 1.15); cloud(1180, 150, 0.9); cloud(1500, 260, 0.6); cloud(760, 285, 0.5);

    // 遠くの山
    const ridge = (base, amp, col, seed) => {
      const r2 = mulberry(seed);
      g.beginPath(); g.moveTo(0, cam.cy + 4);
      for (let u = 0; u <= W; u += 40) g.lineTo(u, base - amp * (0.5 + 0.5 * Math.sin(u / 260 + r2() * 0.6) * Math.sin(u / 610 + 1.3)) - r2() * amp * 0.15);
      g.lineTo(W, cam.cy + 4); g.closePath(); g.fillStyle = col; g.fill();
    };
    ridge(cam.cy - 8, 70, '#9cc0c6', 3);
    ridge(cam.cy + 2, 34, '#78a596', 9);

    // 草地
    const grass = g.createLinearGradient(0, cam.cy, 0, H);
    grass.addColorStop(0, '#7fae5a'); grass.addColorStop(1, '#93c164');
    g.fillStyle = grass; g.fillRect(0, cam.cy, W, H - cam.cy);

    // 奥の林
    const tree = (x, z, h, r, dark) => {
      const b = P(x, 0, z), top = P(x, h, z), rp = r * cam.f / -z;
      g.fillStyle = '#5b4636'; g.fillRect(b.u - rp * 0.12, top.v, rp * 0.24, b.v - top.v);
      const cols = dark ? ['#2f5f3a', '#3c7445', '#4f8a50'] : ['#3c7445', '#4f8a50', '#68a35c'];
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i < 7; i++) {
          const a = rnd() * Math.PI * 2, d = rnd() * rp * 0.55;
          blob(top.u + Math.cos(a) * d - k * rp * 0.08, top.v + Math.sin(a) * d * 0.8 - k * rp * 0.1, rp * (0.55 - k * 0.12), cols[k]);
        }
      }
    };
    for (let x = -46; x <= 46; x += 3.2 + rnd() * 1.6) tree(x, -36 - rnd() * 6, 4 + rnd() * 2.5, 2 + rnd(), true);

    // 生け垣と花壇（広場の奥の端）
    box(-30, 30, 0, 0.8, -25.2, -26, { top: '#5f9a4c', front: '#4a8240', side: '#437a3a' }, false);
    for (let x = -8.6; x < 8.6; x += 2.4) {
      box(x, x + 1.9, 0, 0.42, -24.3, -24.9, { top: '#6b5a48', front: '#c9c3b6', side: '#b3ac9e' });
      for (let i = 0; i < 26; i++) {
        const p = P(x + 0.1 + rnd() * 1.7, 0.45 + rnd() * 0.1, -24.4 - rnd() * 0.4);
        blob(p.u, p.v, 3 + rnd() * 3, ['#f2c94c', '#f08aa0', '#ffffff', '#e8604c', '#b48be0'][i % 5]);
      }
    }

    // 広場の石畳（1m 角）
    const PX = 9, PZ0 = -2.5, PZ1 = -24;
    for (let z = PZ0; z > PZ1; z -= 1) {
      for (let x = -PX; x < PX; x += 1) {
        const k = rnd();
        const c = k < 0.12 ? '#cfc2a6' : k < 0.2 ? '#e3d8c0' : '#dacfb6';
        face([[x, 0, z], [x + 1, 0, z], [x + 1, 0, Math.max(z - 1, PZ1)], [x, 0, Math.max(z - 1, PZ1)]], c, 'rgba(150,132,104,0.55)');
      }
    }
    // 縁石
    box(-PX - 0.25, -PX, 0, 0.12, PZ0, PZ1, { top: '#ece6d8', front: '#c7bfae', side: '#d6cfbf' }, false);
    box(PX, PX + 0.25, 0, 0.12, PZ0, PZ1, { top: '#ece6d8', front: '#c7bfae', side: '#d6cfbf' }, false);

    // ---- ここから広場の上の物。影を先に、物は奥から ----
    // 木（丸い石の植え込み）
    const TX = -6, TZ = -17;
    const planterLow = ring(TX, TZ, 1.0, 0, 16), planterTop = ring(TX, TZ, 1.0, 0.42, 16);
    shadow(planterLow.concat(planterTop));
    shadow(ring(TX, TZ, 0.22, 0, 8).concat(ring(TX, TZ, 0.22, 3, 8)), 0.16);
    shadow(ring(TX, TZ, 2.0, 3.8, 12), 0.14);
    // 台（木の舞台）
    const DX0 = 2.4, DX1 = 6.0, DZN = -11, DZF = -16, DH = 0.6;
    shadow(boxCorners(DX0, DX1, 0, DH, DZN, DZF));
    shadow(boxCorners(DX0, DX1, DH, 1.5, DZF + 0.1, DZF), 0.12);
    // 街灯・ベンチ
    const LX = 1.0, LZ = -7.5, LH = 2.75;
    shadow(boxCorners(LX - 0.06, LX + 0.06, 0, LH, LZ + 0.06, LZ - 0.06), 0.18);
    const BX0 = -3.0, BX1 = -1.5, BZN = -6.0, BZF = -6.47;
    shadow(boxCorners(BX0, BX1, 0, 0.85, BZN, BZF));

    // 植え込みと木
    {
      const lowP = planterLow.map(q => P(q[0], q[1], q[2])), topP = planterTop.map(q => P(q[0], q[1], q[2]));
      const sil = convexHull(lowP.concat(topP).map(p => [p.u, p.v]));
      g.beginPath(); sil.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.fillStyle = '#bdb6a6'; g.fill(); g.strokeStyle = LINE; g.lineWidth = 1.4; g.stroke();
      path(topP); g.fillStyle = '#6b5440'; g.fill(); g.stroke();
      const b = P(TX, 0.42, TZ), t = P(TX, 3.0, TZ), w = 0.22 * cam.f / -TZ;
      g.fillStyle = '#6a4c38'; g.fillRect(b.u - w, t.v, w * 2, b.v - t.v);
      g.fillStyle = '#7d5c45'; g.fillRect(b.u - w, t.v, w * 0.8, b.v - t.v);
      const c = P(TX, 3.9, TZ), rp = 2.1 * cam.f / -TZ;
      const cols = ['#356b3e', '#46864a', '#5f9f55', '#82bb68'];
      for (let k = 0; k < 4; k++) {
        for (let i = 0; i < 12; i++) {
          const a = rnd() * Math.PI * 2, d = rnd() * rp * (0.62 - k * 0.1);
          blob(c.u + Math.cos(a) * d - k * rp * 0.1, c.v + Math.sin(a) * d * 0.75 - k * rp * 0.1, rp * (0.42 - k * 0.07), cols[k]);
        }
      }
    }

    // 舞台：奥の手すり → 本体 → 階段
    const wood = { top: '#c99a62', front: '#9a6a3f', side: '#b07c4b' };
    box(DX0 + 0.05, DX0 + 0.15, DH, 1.45, DZF + 0.1, DZF, wood);
    box(DX1 - 0.15, DX1 - 0.05, DH, 1.45, DZF + 0.1, DZF, wood);
    box(DX0 + 0.05, DX1 - 0.05, 1.3, 1.42, DZF + 0.08, DZF + 0.02, wood);
    box(DX0 + 0.05, DX1 - 0.05, 0.95, 1.03, DZF + 0.08, DZF + 0.02, wood);
    box(DX0, DX1, 0, DH, DZN, DZF, wood);
    g.strokeStyle = 'rgba(110,72,40,0.45)'; g.lineWidth = 1.2;
    for (let x = DX0 + 0.3; x < DX1; x += 0.3) {
      const a = P(x, DH, DZN), b = P(x, DH, DZF);
      g.beginPath(); g.moveTo(a.u, a.v); g.lineTo(b.u, b.v); g.stroke();
    }
    for (const y of [0.2, 0.4]) {
      const a = P(DX0, y, DZN), b = P(DX1, y, DZN), c = P(DX0, y, DZF);
      g.beginPath(); g.moveTo(a.u, a.v); g.lineTo(b.u, b.v); g.moveTo(a.u, a.v); g.lineTo(c.u, c.v); g.stroke();
    }
    const SX0 = 3.2, SX1 = 4.6;
    box(SX0, SX1, 0, 0.4, -10.7, DZN, wood);
    box(SX0, SX1, 0, 0.2, -10.4, -10.7, wood);
    // 植木鉢
    for (const [x, z] of [[DX1 - 0.45, DZF + 0.5], [DX0 + 0.45, DZF + 0.5]]) {
      box(x - 0.2, x + 0.2, DH, DH + 0.4, z + 0.2, z - 0.2, { top: '#5a4232', front: '#c46a46', side: '#a9583a' });
      const c = P(x, DH + 0.75, z), rp = 0.42 * cam.f / -z;
      blob(c.u, c.v, rp, '#3f7d45'); blob(c.u - rp * 0.25, c.v - rp * 0.25, rp * 0.6, '#5e9c55');
    }

    // 街灯
    box(LX - 0.13, LX + 0.13, 0, 0.3, LZ + 0.13, LZ - 0.13, { top: '#4c5560', front: '#39414b', side: '#444d57' });
    box(LX - 0.06, LX + 0.06, 0.3, LH, LZ + 0.06, LZ - 0.06, { top: '#4c5560', front: '#3a424c', side: '#4a535e' });
    box(LX - 0.2, LX + 0.2, LH, LH + 0.42, LZ + 0.2, LZ - 0.2, { top: '#39414b', front: '#fff3c4', side: '#f1dc98' });
    box(LX - 0.26, LX + 0.26, LH + 0.42, LH + 0.5, LZ + 0.26, LZ - 0.26, { top: '#2f363f', front: '#39414b', side: '#2f363f' });

    // ベンチ（脚 → 座面 → 背もたれ）
    const metal = { top: '#4a4f5c', front: '#3a3e49', side: '#454a56' };
    const slat = { top: '#d29b5c', front: '#a86f3c', side: '#bf8549' };
    for (const x of [BX0 + 0.08, BX1 - 0.12]) {
      box(x, x + 0.06, 0, 0.36, BZN - 0.04, BZF + 0.02, metal);
      box(x, x + 0.06, 0.36, 0.85, BZF + 0.06, BZF, metal);
    }
    for (let i = 0; i < 3; i++) box(BX0, BX1, 0.36, 0.42, BZN - i * 0.15, BZN - i * 0.15 - 0.13, slat);
    for (const y of [0.52, 0.66, 0.78]) box(BX0, BX1, y, y + 0.09, BZF + 0.05, BZF + 0.01, slat);

    // ほんのりした光（左上から）
    const glow = g.createRadialGradient(W * 0.15, -H * 0.1, 0, W * 0.15, -H * 0.1, W * 1.1);
    glow.addColorStop(0, 'rgba(255,248,220,0.18)'); glow.addColorStop(1, 'rgba(255,248,220,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);

    // ---- 設定 ----
    const rectN = (x0, x1, zn, zf, h) => [N(x0, h, zn), N(x1, h, zn), N(x1, h, zf), N(x0, h, zf)];
    const areas = [
      { pts: clipToUnit(rectN(-PX, PX, PZ0, -23.9, 0)), h: 0, kind: 'walk' },
      { pts: rectN(DX0, DX1, DZN, DZF + 0.25, DH), h: DH, kind: 'walk' },
      { pts: rectN(SX0, SX1, -10.7, DZN, 0.4), h: 0.4, kind: 'walk' },
      { pts: rectN(SX0, SX1, -10.4, -10.7, 0.2), h: 0.2, kind: 'walk' },
      { pts: rectN(BX0 - 0.05, BX1 + 0.05, BZN + 0.02, BZF - 0.05, 0), h: 0, kind: 'block' },
      { pts: rectN(LX - 0.25, LX + 0.25, LZ + 0.25, LZ - 0.25, 0), h: 0, kind: 'block' },
      { pts: ring(TX, TZ, 1.1, 0, 10).map(q => N(q[0], 0, q[2])), h: 0, kind: 'block' },
      { pts: rectN(DX0, DX0 + 0.75, DZF + 0.85, DZF, DH), h: DH, kind: 'block' },
      { pts: rectN(DX1 - 0.75, DX1, DZF + 0.85, DZF, DH), h: DH, kind: 'block' }
    ];
    const occluders = [
      { pts: hullN(boxCorners(BX0, BX1, 0, 0.85, BZN, BZF)) },
      // 街灯：根元の台は太く、柱は細く
      { pts: [N(LX - 0.14, 0, LZ + 0.13), N(LX + 0.14, 0, LZ + 0.13), N(LX + 0.14, 0.3, LZ + 0.13), N(LX + 0.07, 0.3, LZ + 0.06),
              N(LX + 0.07, LH, LZ + 0.06), N(LX + 0.27, LH, LZ + 0.06), N(LX + 0.27, LH + 0.5, LZ + 0.06), N(LX - 0.27, LH + 0.5, LZ + 0.06),
              N(LX - 0.27, LH, LZ + 0.06), N(LX - 0.07, LH, LZ + 0.06), N(LX - 0.07, 0.3, LZ + 0.06), N(LX - 0.14, 0.3, LZ + 0.13)] },
      { pts: hullN(planterLow.concat(planterTop)) },
      // 幹は床に接する所（植え込みの中の根元）まで下ろしておく。いちばん下の点で奥行きが決まるため
      { pts: hullN(ring(TX, TZ, 0.24, 0, 8).concat(ring(TX, TZ, 0.24, 3.0, 8))) },
      // 舞台は、縦の面（左の側面と正面）だけ。上の面に立ったキャラを隠さない
      { pts: [N(DX0, DH, DZF), N(DX0, DH, DZN), N(DX1, DH, DZN), N(DX1, 0, DZN), N(DX0, 0, DZN), N(DX0, 0, DZF)] }
    ];
    const seats = [{ p: N((BX0 + BX1) / 2, 0, BZN + 0.32), dir: 0 }];
    const scene = C.sanitizeScene({ horizon: VIEW.horizon, eye: VIEW.eye, fov: VIEW.fov, light: 1, areas, occluders, seats });
    scene.start = { x: 0, z: -9 };
    return { canvas: cv, scene };
  }

  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  }

  // 0〜1 の四角に収まるように切る（Sutherland–Hodgman）
  function clipToUnit(poly) {
    const edges = [[0, 0, 1], [0, 1, -1], [1, 0, 1], [1, 1, -1]]; // [軸, 境界, 向き]
    let out = poly;
    for (const [ax, b, s] of edges) {
      const inp = out; out = [];
      for (let i = 0; i < inp.length; i++) {
        const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
        const ci = (cur[ax] - b) * s >= 0, pi = (prev[ax] - b) * s >= 0;
        const cut = () => { const t = (b - prev[ax]) / (cur[ax] - prev[ax]); return [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]; };
        if (ci) { if (!pi) out.push(cut()); out.push(cur); } else if (pi) out.push(cut());
      }
    }
    return out;
  }

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  root.EnonakaSample = { make, W, H };
})(typeof self !== 'undefined' ? self : this);
