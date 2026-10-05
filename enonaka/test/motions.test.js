// node enonaka/test/motions.test.js で走る。内蔵のうごき（motions/*.vrma）が VRMA として正しいか
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('NG: ' + name); throw e; } };

const dir = path.join(__dirname, '..', 'motions');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));

function readGlb(file) {
  const b = fs.readFileSync(file);
  assert.strictEqual(b.toString('latin1', 0, 4), 'glTF');
  assert.strictEqual(b.readUInt32LE(4), 2);
  assert.strictEqual(b.readUInt32LE(8), b.length);
  const jl = b.readUInt32LE(12);
  assert.strictEqual(b.readUInt32LE(16), 0x4e4f534a);
  const json = JSON.parse(b.toString('utf8', 20, 20 + jl));
  const bl = b.readUInt32LE(20 + jl);
  assert.strictEqual(b.readUInt32LE(24 + jl), 0x004e4942);
  const bin = b.subarray(28 + jl, 28 + jl + bl);
  const read = ai => {
    const a = json.accessors[ai], bv = json.bufferViews[a.bufferView];
    const k = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    return new Float32Array(bin.buffer.slice(bin.byteOffset + bv.byteOffset, bin.byteOffset + bv.byteOffset + a.count * k * 4));
  };
  return { json, read };
}

t('一覧とファイルがそろっている', () => {
  assert.ok(index.length >= 12);
  const ids = new Set();
  for (const m of index) {
    assert.ok(m.id && m.name && m.emoji && m.file, JSON.stringify(m));
    assert.ok(!ids.has(m.id)); ids.add(m.id);
    assert.ok(fs.existsSync(path.join(dir, m.file)), m.file);
    assert.ok(fs.existsSync(path.join(dir, 'specs', m.id + '.json')), m.id + ' の spec');
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.vrma'));
  assert.strictEqual(files.length, index.length, '一覧にない .vrma がある');
});

t('どれも VRMC_vrm_animation で、ヒューマノイドの骨と時間が合っている', () => {
  for (const m of index) {
    const { json, read } = readGlb(path.join(dir, m.file));
    const ext = json.extensions && json.extensions.VRMC_vrm_animation;
    assert.ok(ext && ext.specVersion === '1.0', m.id);
    for (const b of ['hips', 'spine', 'head', 'leftUpperArm', 'rightUpperArm', 'leftUpperLeg', 'rightUpperLeg']) assert.ok(ext.humanoid.humanBones[b], m.id + ' ' + b);
    const anim = json.animations[0];
    let tmax = 0;
    for (const s of anim.samplers) {
      const times = read(s.input), vals = read(s.output);
      for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1], m.id + ' の時刻が並んでいない');
      tmax = Math.max(tmax, times[times.length - 1]);
      for (const v of vals) assert.ok(Number.isFinite(v), m.id + ' に数でない値');
    }
    assert.ok(Math.abs(tmax - m.duration) < 1e-3, m.id + ' の長さ ' + tmax + ' ≠ ' + m.duration);
    // 回転は単位四元数
    for (const ch of anim.channels.filter(c => c.target.path === 'rotation')) {
      const q = read(anim.samplers[ch.sampler].output);
      for (let i = 0; i < q.length; i += 4) assert.ok(Math.abs(Math.hypot(q[i], q[i + 1], q[i + 2], q[i + 3]) - 1) < 1e-3);
    }
  }
});

t('始まりと終わりは腕を下ろして立った姿勢（立ち姿からなめらかにつながる）', () => {
  for (const m of index) {
    const { json, read } = readGlb(path.join(dir, m.file));
    const anim = json.animations[0];
    const node = name => json.nodes.findIndex(x => x.name === 'J_' + name);
    for (const [bone, z] of [['leftUpperArm', -1], ['rightUpperArm', 1]]) {
      const ch = anim.channels.find(c => c.target.node === node(bone) && c.target.path === 'rotation');
      const q = read(anim.samplers[ch.sampler].output);
      for (const i of [0, q.length - 4]) {
        // Z 回りに 50〜80 度（腕が下りている）
        const ang = 2 * Math.atan2(q[i + 2], q[i + 3]) * 180 / Math.PI * z;
        assert.ok(ang > 45 && ang < 80 && Math.abs(q[i]) < 0.3 && Math.abs(q[i + 1]) < 0.3, `${m.id} ${bone} ${i ? '終わり' : '始まり'} ${ang.toFixed(0)}`);
      }
    }
  }
});

t('くり返すうごきは、始まりと終わりの姿勢が同じ', () => {
  for (const m of index.filter(x => x.loop)) {
    const { json, read } = readGlb(path.join(dir, m.file));
    const anim = json.animations[0];
    for (const ch of anim.channels) {
      const s = anim.samplers[ch.sampler], v = read(s.output), k = ch.target.path === 'rotation' ? 4 : 3;
      for (let j = 0; j < k; j++) assert.ok(Math.abs(v[j] - v[v.length - k + j]) < 0.02, `${m.id} の ${json.nodes[ch.target.node].name}`);
    }
  }
});

console.log(`ok ${n}`);
