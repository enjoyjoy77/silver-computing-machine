// えのなか の中身。絵の見え方（地平線・目線の高さ・画角）から、絵に描かれた床を 3D の床に起こし、歩く道を探す。
// ブラウザでも node でも読める（画面には触らない）。
//
// 座標の決まり
//   絵: u は右へ、v は下へ（ピクセル）。保存するときは 0〜1 に割った値（nu, nv）で持つ。
//   世界: メートル。y が上。カメラは (0, eye, 0) にいて、水平に -z の方を向いている（傾けない）。
//   地平線はカメラの真正面の高さなので、絵の中の水平な線になる。縦の線は縦のまま（アニメの背景の描き方と同じ）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EnonakaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEG = Math.PI / 180;

  // view = { horizon: 地平線の高さ（絵の上から 0〜1）, eye: 目線の高さ m, fov: 横の画角（度） }
  function makeCamera(W, H, view) {
    const fov = clamp(view.fov || 60, 10, 140);
    const f = (W / 2) / Math.tan(fov * DEG / 2);
    return { W, H, cx: W / 2, cy: view.horizon * H, f, eye: view.eye };
  }

  // 絵の点 (u, v) を高さ h の水平な床に落とす。床に当たらなければ null
  function imageToWorld(cam, u, v, h) {
    const t = (cam.eye - (h || 0)) / (v - cam.cy);
    if (!isFinite(t) || t <= 0) return null;
    return { x: (u - cam.cx) * t, y: h || 0, z: -cam.f * t };
  }

  // 世界の点を絵に映す。カメラより後ろなら null
  function worldToImage(cam, x, y, z) {
    const d = -z;
    if (!(d > 1e-6)) return null;
    return { u: cam.cx + cam.f * x / d, v: cam.cy + cam.f * (cam.eye - y) / d };
  }

  // 床に落とすとき、地平線すれすれの点は遠くへ飛びすぎるので maxDepth（m）で止める
  function clampV(cam, v, h, maxDepth) {
    const dh = cam.eye - (h || 0);
    if (dh <= 0) return v;
    const vMin = cam.cy + dh * cam.f / maxDepth;
    return v < vMin ? vMin : v;
  }

  // 床（絵の上の多角形）を世界の xz の多角形にする
  function areaWorldPoly(cam, area, maxDepth) {
    const md = maxDepth || 60, h = area.h || 0, out = [];
    if (!area.pts || area.pts.length < 3) return null;
    for (const p of area.pts) {
      const u = p[0] * cam.W, v = clampV(cam, p[1] * cam.H, h, md);
      const w = imageToWorld(cam, u, v, h);
      if (!w) return null;
      out.push({ x: w.x, z: w.z });
    }
    return out;
  }

  function pointInPoly(x, y, poly, kx, ky) {
    // poly は [[x, y], ...] でも [{x, z}, ...] でもよい（kx, ky で読むキーを選ぶ）
    kx = kx === undefined ? 0 : kx; ky = ky === undefined ? 1 : ky;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][kx], yi = poly[i][ky], xj = poly[j][kx], yj = poly[j][ky];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function bboxOf(poly) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of poly) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    return { x0, z0, x1, z1 };
  }

  // 歩ける所を格子にする。h[i] は床の高さ（歩けない所は NaN）
  //   床が重なったら高い方を取る（台の上面は、手前の地面の絵とも重なるため）
  //   「通れない」所は高さに関係なく塞ぐ
  function buildNav(cam, areas, opt) {
    const o = Object.assign({ maxStep: 0.35, maxDepth: 60, maxCells: 120000, minCell: 0.15 }, opt || {});
    const walk = [], block = [];
    for (const a of areas || []) {
      const poly = areaWorldPoly(cam, a, o.maxDepth);
      if (!poly) continue;
      (a.kind === 'block' ? block : walk).push({ poly, h: a.h || 0, bb: bboxOf(poly) });
    }
    if (!walk.length) return null;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const w of walk) { x0 = Math.min(x0, w.bb.x0); z0 = Math.min(z0, w.bb.z0); x1 = Math.max(x1, w.bb.x1); z1 = Math.max(z1, w.bb.z1); }
    const wid = Math.max(x1 - x0, 0.01), dep = Math.max(z1 - z0, 0.01);
    const cell = Math.max(o.minCell, Math.sqrt(wid * dep / o.maxCells));
    const nx = Math.max(1, Math.ceil(wid / cell)), nz = Math.max(1, Math.ceil(dep / cell));
    const h = new Float32Array(nx * nz).fill(NaN);
    for (let j = 0; j < nz; j++) {
      const z = z0 + (j + 0.5) * cell;
      for (let i = 0; i < nx; i++) {
        const x = x0 + (i + 0.5) * cell;
        let best = -Infinity;
        for (const w of walk) {
          if (w.h <= best || x < w.bb.x0 || x > w.bb.x1 || z < w.bb.z0 || z > w.bb.z1) continue;
          if (pointInPoly(x, z, w.poly, 'x', 'z')) best = w.h;
        }
        if (best === -Infinity) continue;
        let blocked = false;
        for (const b of block) {
          if (x < b.bb.x0 || x > b.bb.x1 || z < b.bb.z0 || z > b.bb.z1) continue;
          if (pointInPoly(x, z, b.poly, 'x', 'z')) { blocked = true; break; }
        }
        if (!blocked) h[j * nx + i] = best;
      }
    }
    let n = 0;
    for (let k = 0; k < h.length; k++) if (!isNaN(h[k])) n++;
    const cells = new Int32Array(n);
    for (let k = 0, m = 0; k < h.length; k++) if (!isNaN(h[k])) cells[m++] = k;
    return { x0, z0, cell, nx, nz, h, cells, maxStep: o.maxStep };
  }

  function cellIndex(nav, x, z) {
    const i = Math.floor((x - nav.x0) / nav.cell), j = Math.floor((z - nav.z0) / nav.cell);
    if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) return -1;
    return j * nav.nx + i;
  }
  function cellCenter(nav, k) {
    const i = k % nav.nx, j = (k - i) / nav.nx;
    return { x: nav.x0 + (i + 0.5) * nav.cell, z: nav.z0 + (j + 0.5) * nav.cell };
  }
  function heightAt(nav, x, z) {
    const k = cellIndex(nav, x, z);
    return k < 0 ? NaN : nav.h[k];
  }

  // いちばん近い歩けるマス（maxR m まで探す）
  function nearestWalkable(nav, x, z, maxR) {
    const k0 = cellIndex(nav, x, z);
    if (k0 >= 0 && !isNaN(nav.h[k0])) return k0;
    const ci = Math.floor((x - nav.x0) / nav.cell), cj = Math.floor((z - nav.z0) / nav.cell);
    const R = Math.ceil((maxR || 3) / nav.cell);
    let best = -1, bestD = Infinity;
    for (let r = 1; r <= R; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) continue;
          const k = j * nav.nx + i;
          if (isNaN(nav.h[k])) continue;
          const d = di * di + dj * dj;
          if (d < bestD) { bestD = d; best = k; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // 一直線に歩けるか（段差 maxStep を超えず、途中に歩けない所がない）
  function lineWalkable(nav, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(len / (nav.cell * 0.5)));
    let prev = heightAt(nav, a.x, a.z);
    if (isNaN(prev)) return false;
    for (let s = 1; s <= n; s++) {
      const hh = heightAt(nav, a.x + dx * s / n, a.z + dz * s / n);
      if (isNaN(hh) || Math.abs(hh - prev) > nav.maxStep + 1e-6) return false;
      prev = hh;
    }
    return true;
  }

  // A*（8 方向、角は切らない）。道筋は世界の点 [{x, y, z}]。行けなければ null
  function findPath(nav, from, to) {
    const s = nearestWalkable(nav, from.x, from.z, 2), g = nearestWalkable(nav, to.x, to.z, 3);
    if (s < 0 || g < 0) return null;
    const nx = nav.nx, N = nav.h.length, H = nav.h, step = nav.maxStep + 1e-6;
    const gScore = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const gi = g % nx, gj = (g - gi) / nx;
    const heur = k => { const i = k % nx, j = (k - i) / nx, a = Math.abs(i - gi), b = Math.abs(j - gj); return Math.max(a, b) + 0.4142 * Math.min(a, b); };
    const heap = new Heap();
    gScore[s] = 0; heap.push(s, heur(s));
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    let found = false;
    while (heap.size) {
      const k = heap.pop();
      if (closed[k]) continue;
      if (k === g) { found = true; break; }
      closed[k] = 1;
      const i = k % nx, j = (k - i) / nx, hk = H[k];
      for (const [di, dj, c] of D) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nav.nz) continue;
        const kk = jj * nx + ii, hh = H[kk];
        if (isNaN(hh) || closed[kk] || Math.abs(hh - hk) > step) continue;
        if (di && dj) {
          const a = H[j * nx + ii], b = H[jj * nx + i];
          if (isNaN(a) || isNaN(b) || Math.abs(a - hk) > step || Math.abs(b - hk) > step) continue;
        }
        const ng = gScore[k] + c;
        if (ng < gScore[kk]) { gScore[kk] = ng; came[kk] = k; heap.push(kk, ng + heur(kk)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = g; k !== -1; k = came[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map(k => cellCenter(nav, k));
    pts[0] = { x: from.x, z: from.z };
    if (isNaN(heightAt(nav, pts[0].x, pts[0].z))) pts[0] = cellCenter(nav, s);
    const goalOk = cellIndex(nav, to.x, to.z) === g;
    if (goalOk) pts[pts.length - 1] = { x: to.x, z: to.z };
    // 見通せる所まで飛ばして、曲がり角だけ残す
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !lineWalkable(nav, pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out.map(p => ({ x: p.x, y: heightAt(nav, p.x, p.z), z: p.z }));
  }

  // タップした絵の点 → 世界の行き先。歩ける床の絵に入っていなければ null
  //   重なっていたら高い床を選ぶ（台の上面をタップしたら台の上へ）
  function pickTarget(cam, areas, nu, nv, maxDepth) {
    let best = null;
    for (const a of areas || []) {
      if (a.kind === 'block' || !a.pts || a.pts.length < 3) continue;
      if (!pointInPoly(nu, nv, a.pts)) continue;
      if (!best || (a.h || 0) > (best.h || 0)) best = a;
    }
    if (!best) return null;
    const h = best.h || 0;
    const w = imageToWorld(cam, nu * cam.W, clampV(cam, nv * cam.H, h, maxDepth || 60), h);
    return w ? { x: w.x, y: h, z: w.z } : null;
  }

  // 絵の点の下にある床の高さ（歩ける床のうち高いもの、なければ 0）
  function floorHeightAtImage(areas, nu, nv) {
    let h = 0, hit = false;
    for (const a of areas || []) {
      if (a.kind === 'block' || !a.pts || a.pts.length < 3) continue;
      if (pointInPoly(nu, nv, a.pts) && (!hit || (a.h || 0) > h)) { h = a.h || 0; hit = true; }
    }
    return h;
  }

  // 前に出すもの：いちばん下の点（床に接している所）の奥行きに、絵と平行な板を立てる
  // キャラのうち、その板より奥にある所が隠れる
  function occluderDepth(cam, occ, areas, maxDepth) {
    if (!occ.pts || occ.pts.length < 3) return null;
    let base = occ.pts[0];
    for (const p of occ.pts) if (p[1] > base[1]) base = p;
    const h = floorHeightAtImage(areas, base[0], base[1]);
    const w = imageToWorld(cam, base[0] * cam.W, clampV(cam, base[1] * cam.H, h, maxDepth || 60), h);
    return w ? -w.z : null;
  }

  // すわる場所：p は座ったときに足を置く床の点、dir はキャラの向き（度、0 でこちらを向く）
  function seatWorld(cam, seat, areas, maxDepth) {
    const h = floorHeightAtImage(areas, seat.p[0], seat.p[1]);
    const w = imageToWorld(cam, seat.p[0] * cam.W, clampV(cam, seat.p[1] * cam.H, h, maxDepth || 60), h);
    return w ? { x: w.x, y: h, z: w.z, dir: seat.dir || 0 } : null;
  }

  // 2 本の線（道の両端など、実際には平行な線）が交わる高さ = 地平線。0〜1 で返す
  function horizonFromLines(a, b) {
    const [p1, p2] = a, [p3, p4] = b;
    const d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    if (Math.abs(d) < 1e-9) return null;
    const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d;
    const y = p1[1] + t * (p2[1] - p1[1]);
    return y > -0.5 && y < 1.5 ? y : null;
  }

  // 保存していた場面を読むときの検査。壊れた所は捨てて、使える形にそろえる
  function sanitizeScene(s) {
    const out = { horizon: 0.45, eye: 1.5, fov: 60, light: 1, warmth: 0, areas: [], occluders: [], seats: [] };
    if (!s || typeof s !== 'object') return out;
    const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? clamp(v, lo, hi) : d);
    const pt = p => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]) ? [clamp(+p[0], -0.5, 1.5), clamp(+p[1], -0.5, 1.5)] : null;
    const poly = a => Array.isArray(a) ? a.map(pt).filter(Boolean) : [];
    out.horizon = num(s.horizon, -0.5, 1.5, out.horizon);
    out.eye = num(s.eye, 0.2, 50, out.eye);
    out.fov = num(s.fov, 10, 140, out.fov);
    out.light = num(s.light, 0.2, 2.5, out.light);
    out.warmth = num(s.warmth, -1, 1, out.warmth);
    for (const a of Array.isArray(s.areas) ? s.areas : []) {
      const pts = poly(a && a.pts);
      if (pts.length >= 3) out.areas.push({ pts, h: num(a.h, -5, 20, 0), kind: a.kind === 'block' ? 'block' : 'walk' });
    }
    for (const o of Array.isArray(s.occluders) ? s.occluders : []) {
      const pts = poly(o && o.pts);
      if (pts.length >= 3) out.occluders.push({ pts });
    }
    for (const t of Array.isArray(s.seats) ? s.seats : []) {
      const p = pt(t && t.p);
      if (p) out.seats.push({ p, dir: num(t.dir, -360, 360, 0) });
    }
    return out;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // 小さな二分ヒープ（値の小さい順に取り出す）
  function Heap() { this.k = []; this.p = []; this.size = 0; }
  Heap.prototype.push = function (key, pri) {
    const K = this.k, P = this.p;
    let i = this.size++;
    K[i] = key; P[i] = pri;
    while (i > 0) {
      const q = (i - 1) >> 1;
      if (P[q] <= P[i]) break;
      [K[q], K[i]] = [K[i], K[q]]; [P[q], P[i]] = [P[i], P[q]];
      i = q;
    }
  };
  Heap.prototype.pop = function () {
    const K = this.k, P = this.p, top = K[0];
    const n = --this.size;
    K[0] = K[n]; P[0] = P[n];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < n && P[l] < P[m]) m = l;
      if (r < n && P[r] < P[m]) m = r;
      if (m === i) break;
      [K[m], K[i]] = [K[i], K[m]]; [P[m], P[i]] = [P[i], P[m]];
      i = m;
    }
    return top;
  };

  return {
    makeCamera, imageToWorld, worldToImage, clampV, areaWorldPoly, pointInPoly,
    buildNav, heightAt, cellIndex, cellCenter, nearestWalkable, lineWalkable, findPath,
    pickTarget, floorHeightAtImage, occluderDepth, seatWorld, horizonFromLines, sanitizeScene, clamp
  };
});
