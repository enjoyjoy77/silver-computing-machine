// node enonaka/test/core.test.js で走る。外部の道具は使わない
const assert = require('assert');
const C = require('../stage-core.js');
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('NG: ' + name); throw e; } };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= (eps || 1e-6), (msg || '') + ` ${a} ≠ ${b}`);

const cam = C.makeCamera(1600, 900, { horizon: 0.4, eye: 1.5, fov: 60 });
// 世界の点 → 0〜1 の絵の座標
const img = (x, y, z) => { const p = C.worldToImage(cam, x, y, z); return [p.u / cam.W, p.v / cam.H]; };
const rect = (x0, x1, z0, z1, h) => [img(x0, h, z0), img(x1, h, z0), img(x1, h, z1), img(x0, h, z1)];

t('絵 → 床 → 絵 で元に戻る', () => {
  for (const [u, v, h] of [[800, 700, 0], [100, 880, 0], [1500, 500, 0.6], [300, 400, 1.2]]) {
    const w = C.imageToWorld(cam, u, v, h);
    const p = C.worldToImage(cam, w.x, w.y, w.z);
    near(p.u, u, 1e-6); near(p.v, v, 1e-6);
    near(w.y, h);
  }
});

t('地平線より上の点は床に落ちない', () => {
  assert.strictEqual(C.imageToWorld(cam, 800, 300, 0), null);
  assert.strictEqual(C.imageToWorld(cam, 800, 360, 0), null);
  assert.strictEqual(C.worldToImage(cam, 0, 0, 1), null);
});

t('目線と同じ背丈の人は、どこに立っても頭が地平線に来る', () => {
  for (const [x, z] of [[0, -4], [3, -10], [-6, -30]]) {
    near(C.worldToImage(cam, x, 1.5, z).v, cam.cy, 1e-6);
  }
  // 背丈は足元と地平線の距離に比例する（画角によらない）
  const cam2 = C.makeCamera(1600, 900, { horizon: 0.4, eye: 1.5, fov: 90 });
  for (const c of [cam, cam2]) {
    const foot = C.imageToWorld(c, 900, 800, 0);
    const head = C.worldToImage(c, foot.x, 0.75, foot.z);
    near(800 - head.v, (800 - c.cy) / 2, 1e-6);
  }
});

t('地平線すれすれの点は maxDepth で止まる', () => {
  const v = C.clampV(cam, cam.cy + 0.001, 0, 60);
  near(-C.imageToWorld(cam, 800, v, 0).z, 60, 1e-6);
  assert.strictEqual(C.clampV(cam, 800, 0, 60), 800);
});

// 広場（10m × 16m）、右に高さ 0.6m の台、その手前に 2 段の階段
const ground = { pts: rect(-5, 5, -4, -20, 0), h: 0, kind: 'walk' };
const deck = { pts: rect(1, 4, -10, -14, 0.6), h: 0.6, kind: 'walk' };
const step1 = { pts: rect(1.5, 3, -9.4, -9.7, 0.2), h: 0.2, kind: 'walk' };
const step2 = { pts: rect(1.5, 3, -9.7, -10, 0.4), h: 0.4, kind: 'walk' };

t('格子：重なった床は高い方、外は歩けない', () => {
  const nav = C.buildNav(cam, [ground, deck], { maxStep: 0.35 });
  near(C.heightAt(nav, 0, -6), 0);
  near(C.heightAt(nav, 2.5, -12), 0.6, 1e-6);
  assert.ok(isNaN(C.heightAt(nav, 0, -2)));
  assert.ok(isNaN(C.heightAt(nav, 8, -8)));
  // 歩けるマスの一覧
  assert.ok(nav.cells.length > 1000);
  for (const k of nav.cells.slice(0, 50)) assert.ok(!isNaN(nav.h[k]));
});

t('台へは階段を通って上がる。階段がなければ上がれない', () => {
  const nav = C.buildNav(cam, [ground, deck, step1, step2], { maxStep: 0.35 });
  const path = C.findPath(nav, { x: -2, z: -6 }, { x: 2.5, z: -12.5 });
  assert.ok(path && path.length >= 2);
  near(path[path.length - 1].y, 0.6, 1e-6);
  near(path[path.length - 1].x, 2.5); near(path[path.length - 1].z, -12.5);
  // 道筋を細かくたどって、段差が 0.35m を超えないこと、階段の段を踏むこと
  let prev = C.heightAt(nav, path[0].x, path[0].z), sawStep = false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    for (let s = 1; s <= 200; s++) {
      const h = C.heightAt(nav, a.x + (b.x - a.x) * s / 200, a.z + (b.z - a.z) * s / 200);
      assert.ok(!isNaN(h), '歩けない所を通った');
      assert.ok(Math.abs(h - prev) <= 0.35 + 1e-6, '段差が高すぎる');
      if (Math.abs(h - 0.2) < 1e-6 || Math.abs(h - 0.4) < 1e-6) sawStep = true;
      prev = h;
    }
  }
  assert.ok(sawStep, '階段を通っていない');
  const nav2 = C.buildNav(cam, [ground, deck], { maxStep: 0.35 });
  assert.strictEqual(C.findPath(nav2, { x: -2, z: -6 }, { x: 2.5, z: -12.5 }), null);
});

t('通れない所はよけて歩く', () => {
  const wall = { pts: rect(-3, 3, -9, -9.6, 0), h: 0, kind: 'block' };
  const nav = C.buildNav(cam, [ground, wall], { maxStep: 0.35 });
  assert.ok(isNaN(C.heightAt(nav, 0, -9.3)));
  const path = C.findPath(nav, { x: 0, z: -6 }, { x: 0, z: -13 });
  assert.ok(path.length >= 3, '曲がらずに突き抜けた');
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  assert.ok(len > 7.5, '遠回りしていない');
  for (const p of path) assert.ok(!isNaN(C.heightAt(nav, p.x, p.z)));
});

t('見通せる所は一直線（曲がり角を残さない）', () => {
  const nav = C.buildNav(cam, [ground], { maxStep: 0.35 });
  const path = C.findPath(nav, { x: -3, z: -5 }, { x: 4, z: -18 });
  assert.strictEqual(path.length, 2);
});

t('タップ先：台の上面なら台へ、床の外なら null', () => {
  const areas = [ground, deck, step1, step2];
  const onDeck = img(2.5, 0.6, -12);
  const tgt = C.pickTarget(cam, areas, onDeck[0], onDeck[1]);
  near(tgt.y, 0.6); near(tgt.x, 2.5, 1e-6); near(tgt.z, -12, 1e-6);
  const onGround = img(-2, 0, -8);
  near(C.pickTarget(cam, areas, onGround[0], onGround[1]).y, 0);
  assert.strictEqual(C.pickTarget(cam, areas, 0.5, 0.1), null);
});

t('前に出すもの：いちばん下の点の奥行き', () => {
  // 床から立つ柱（x=1, z=-7）の輪郭
  const occ = { pts: [img(0.9, 3, -7), img(1.1, 3, -7), img(1.1, 0, -7), img(0.9, 0, -7)] };
  near(C.occluderDepth(cam, occ, [ground]), 7, 1e-6);
  // 台の上に置いた物は台の高さで測る
  const box = { pts: [img(2, 1.2, -12), img(3, 1.2, -12), img(3, 0.6, -12), img(2, 0.6, -12)] };
  near(C.occluderDepth(cam, box, [ground, deck]), 12, 1e-6);
});

t('すわる場所は足元の床の高さを使う', () => {
  const p = img(2.5, 0.6, -13);
  const s = C.seatWorld(cam, { p, dir: 30 }, [ground, deck]);
  near(s.y, 0.6); near(s.z, -13, 1e-6); assert.strictEqual(s.dir, 30);
});

t('2 本の線から地平線', () => {
  const a = [img(-3, 0, -4), img(-3, 0, -20)], b = [img(3, 0, -4), img(3, 0, -30)];
  near(C.horizonFromLines(a, b), 0.4, 1e-9);
  assert.strictEqual(C.horizonFromLines([[0, 0.5], [1, 0.5]], [[0, 0.7], [1, 0.7]]), null);
});

t('保存データの検査', () => {
  const s = C.sanitizeScene({
    horizon: 0.3, eye: 'x', fov: 500,
    areas: [{ pts: [[0, 0], [1, 0], [1, 1]], h: 0.4 }, { pts: [[0, 0], [1, 0]] }, { pts: [[0, 0], [1, NaN], [1, 1], [0, 1]], kind: 'block' }],
    occluders: [null, { pts: [[0, 0], [0.1, 0], [0.1, 0.1]] }],
    seats: [{ p: [0.5, 0.8], dir: 20 }, { p: ['a'] }]
  });
  assert.strictEqual(s.horizon, 0.3); assert.strictEqual(s.eye, 1.5); assert.strictEqual(s.fov, 140);
  assert.strictEqual(s.areas.length, 2);
  assert.strictEqual(s.areas[0].kind, 'walk'); assert.strictEqual(s.areas[0].h, 0.4);
  assert.strictEqual(s.areas[1].kind, 'block'); assert.strictEqual(s.areas[1].pts.length, 3);
  assert.strictEqual(s.occluders.length, 1); assert.strictEqual(s.seats.length, 1);
  assert.deepStrictEqual(C.sanitizeScene(null).areas, []);
});

console.log(`ok ${n}`);
