// node enonaka/test/presets.test.js で走る。用意した場面が歩けるか
const assert = require('assert');
const C = require('../stage-core.js');
const P = require('../presets.js');
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('NG: ' + name); throw e; } };

const W = 1536, H = 1024;
const setup = p => {
  const cam = C.makeCamera(W, H, p.scene);
  const nav = C.buildNav(cam, p.scene.areas, { maxStep: 0.35 });
  return { cam, nav };
};
const at = (p, cam, u, v) => C.pickTarget(cam, p.scene.areas, u / W, v / H);
// 道筋を細かくたどって、歩けない所を通らず、段差が 0.35m を超えないこと
const walkable = (nav, path) => {
  let prev = C.heightAt(nav, path[0].x, path[0].z);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    for (let s = 1; s <= 100; s++) {
      const h = C.heightAt(nav, a.x + (b.x - a.x) * s / 100, a.z + (b.z - a.z) * s / 100);
      if (isNaN(h) || Math.abs(h - prev) > 0.35 + 1e-6) return false;
      prev = h;
    }
  }
  return true;
};

t('3 つの場面がそろっている', () => {
  assert.deepStrictEqual(P.list.map(p => p.id), ['himawari', 'jinja', 'rouka']);
  for (const p of P.list) {
    assert.ok(p.scene.areas.length >= 1);
    assert.ok(p.start && p.src && p.thumb);
    // 保存データの検査を通しても形が変わらない
    assert.deepStrictEqual(C.sanitizeScene(JSON.parse(JSON.stringify(p.scene))), p.scene);
  }
});

t('どの場面も、始めの位置が床の上', () => {
  for (const p of P.list) {
    const { cam, nav } = setup(p);
    const s = C.pickTarget(cam, p.scene.areas, p.start[0], p.start[1]);
    assert.ok(s, p.id);
    assert.ok(!isNaN(C.heightAt(nav, s.x, s.z)), p.id);
  }
});

t('ひまわりの道：手前から校舎の端まで、入口の前まで歩ける', () => {
  const p = P.get('himawari'), { cam, nav } = setup(p);
  const s = at(p, cam, 700, 900);
  for (const [u, v] of [[530, 718], [900, 820]]) {
    const path = C.findPath(nav, s, at(p, cam, u, v));
    assert.ok(path && walkable(nav, path));
  }
  // 柵の上（床の外）はタップしても行かない
  assert.strictEqual(at(p, cam, 1300, 900), null);
});

t('神社：石段の下から社殿の前まで、段を 1 つずつ上がる', () => {
  const p = P.get('jinja'), { cam, nav } = setup(p);
  const s = at(p, cam, 700, 1000), top = at(p, cam, 580, 600);
  assert.ok(top.y > 1.6 && top.y < 1.9, '社殿の前の高さ ' + top.y);
  const path = C.findPath(nav, s, top);
  assert.ok(path && walkable(nav, path));
  // 上るほど高く（下がらない）
  let prev = -1, steps = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    for (let k = 0; k <= 50; k++) {
      const h = C.heightAt(nav, a.x + (b.x - a.x) * k / 50, a.z + (b.z - a.z) * k / 50);
      if (h > prev + 1e-6) { if (prev >= 0) steps++; }
      assert.ok(h >= prev - 0.02, '下がった ' + prev + '→' + h);
      prev = Math.max(prev, h);
    }
  }
  assert.ok(steps >= 15, '段の数 ' + steps);
  // 段の高さは下ほど高くならない（踊り場と灯籠）
  const land = at(p, cam, 450, 650);
  assert.ok(Math.abs(land.y - 1.227) < 0.01);
});

t('神社：段の縁の絵の位置と、段の高さの順番が合っている', () => {
  const p = P.get('jinja'), { cam } = setup(p);
  // 下の段ほど低い
  const hs = [990, 950, 900, 850, 810, 780, 755, 735, 715, 700, 688, 675, 664].map(v => at(p, cam, 700, v).y);
  for (let i = 1; i < hs.length; i++) assert.ok(hs[i] > hs[i - 1], i + ': ' + hs[i - 1] + ' → ' + hs[i]);
});

t('廊下：手前から奥の扉の前まで歩ける。壁の外には行かない', () => {
  const p = P.get('rouka'), { cam, nav } = setup(p);
  const path = C.findPath(nav, at(p, cam, 430, 800), at(p, cam, 380, 515));
  assert.ok(path && walkable(nav, path));
  const far = C.pickTarget(cam, p.scene.areas, 380 / W, 515 / H);
  assert.ok(-far.z > 15, '奥の扉まで ' + (-far.z).toFixed(1) + 'm');
  assert.strictEqual(at(p, cam, 40, 900), null);
  assert.strictEqual(at(p, cam, 1000, 900), null);
});

console.log(`ok ${n}`);
