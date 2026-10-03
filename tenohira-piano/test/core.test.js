// node tenohira-piano/test/core.test.js で走る。外部の道具は使わない
const assert = require('assert');
const C = require('../piano-core.js');
let n = 0;
const t = (name, fn) => { fn(); n++; };

t('音名', () => {
  assert.strictEqual(C.noteLabel(60, 'doremi'), 'ド4');
  assert.strictEqual(C.noteLabel(61, 'cde'), 'C♯4');
  assert.strictEqual(C.noteLabel(21, 'cde'), 'A0');
  assert.strictEqual(C.noteLabel(108, 'doremi'), 'ド8');
});

t('白鍵10個はド4からミ5まで', () => {
  const w = C.whiteKeys(60, 10);
  assert.deepStrictEqual(w, [60, 62, 64, 65, 67, 69, 71, 72, 74, 76]);
});

t('上端からはみ出さない', () => {
  const s = C.clampStart(105, 10);
  assert.strictEqual(C.whiteKeys(s, 10).length, 10);
  assert.strictEqual(C.whiteKeys(s, 10)[9], 108);
  assert.strictEqual(C.clampStart(10, 10), 21);
  assert.strictEqual(C.clampStart(61, 10), 60); // 黒鍵から始めない
});

t('音域を動かす', () => {
  assert.strictEqual(C.shiftStart(60, 1, 10), 62);
  assert.strictEqual(C.shiftStart(60, -1, 10), 59);
  assert.strictEqual(C.shiftStart(60, 7, 10), 72);
  assert.strictEqual(C.shiftStart(23, -7, 10), 21);
  const top = C.shiftStart(60, 100, 10);
  assert.strictEqual(C.whiteKeys(top, 10)[9], 108);
});

t('黒鍵の並び', () => {
  const L = C.layout(60, 10, 700, 300);
  assert.deepStrictEqual(L.blacks.map(k => k.midi), [61, 63, 66, 68, 70, 73, 75]);
  // 端の半分だけの黒鍵は出さない（レから始めるとド♯は出ない）
  const L2 = C.layout(62, 3, 300, 300);
  assert.deepStrictEqual(L2.blacks.map(k => k.midi), [63]);
});

t('当たり判定', () => {
  const L = C.layout(60, 10, 700, 300); // 白鍵 70px
  assert.strictEqual(C.hitTest(L, 10, 290).midi, 60);   // ドの手前
  assert.strictEqual(C.hitTest(L, 69, 10).midi, 61);    // ド♯（境目より少し左）
  assert.strictEqual(C.hitTest(L, 69, 250).midi, 60);   // 黒鍵より手前ならド
  assert.strictEqual(C.hitTest(L, 699, 299).midi, 76);
  assert.strictEqual(C.hitTest(L, 210, 10).midi, 65);   // ミとファの間に黒鍵はない
  assert.strictEqual(C.hitTest(L, 700, 10), null);
  assert.strictEqual(C.hitTest(L, -1, 10), null);
});

t('強さは手前ほど強い', () => {
  const L = C.layout(60, 10, 700, 300);
  const k = L.whites[0];
  assert.ok(C.velocityFromY(k, 10) < C.velocityFromY(k, 290));
  assert.ok(C.velocityFromY(k, 0) >= 0.35 && C.velocityFromY(k, 300) <= 1);
});

t('音源の割り当て', () => {
  assert.strictEqual(C.SAMPLES.length, 30);
  assert.strictEqual(C.SAMPLES[0].midi, 21);
  assert.strictEqual(C.SAMPLES[29].midi, 108);
  for (const s of C.SAMPLES) assert.ok(C.SAMPLE_GAIN[s.midi] > 0, s.name);
  assert.strictEqual(C.nearestSample(60).name, 'C4');
  assert.strictEqual(C.nearestSample(61).name, 'C4');
  assert.strictEqual(C.nearestSample(62).name, 'Ds4');
  // どの鍵も 1 半音以内の音源がある
  for (let m = C.LOWEST; m <= C.HIGHEST; m++) assert.ok(Math.abs(C.nearestSample(m).midi - m) <= 1, m);
  // 読み込めたものだけから選ぶ
  assert.strictEqual(C.nearestSample(60, new Set(['A4'])).name, 'A4');
  const order = C.loadOrder(60, 76);
  assert.deepStrictEqual(new Set(order.slice(0, C.samplesFor(60, 76).length)), new Set(C.samplesFor(60, 76)));
});

t('録音を閉じる', () => {
  const r = C.finishEvents([
    [1000, 1, 60, 100], [1100, 1, 64, 100], [1200, 0, 60, 0],
    [1300, 2, 1, 0], [1300, 2, 1, 0], [1400, 1, 64, 90],
  ], 2000);
  // 先頭の待ち時間は 0.2 秒に詰まる
  assert.strictEqual(r.events[0][0], 200);
  // 押しっぱなしのミは、二度目を押す前に一度離れ、最後にも離れる。ペダルも最後に上がる
  const kinds = r.events.map(e => e.slice(1, 3).join(':'));
  assert.deepStrictEqual(kinds, ['1:60', '1:64', '0:60', '2:1', '0:64', '1:64', '0:64', '2:0']);
  assert.strictEqual(r.duration, 1200);
  assert.strictEqual(C.countNotes(r.events), 3);
  assert.deepStrictEqual(C.finishEvents([[5, 2, 1, 0]]).events, []);
});

t('MIDI ファイル', () => {
  const bytes = C.toMidi([[0, 1, 60, 100], [500, 0, 60, 0], [500, 2, 1, 0], [1000, 2, 0, 0]]);
  const s = Buffer.from(bytes);
  assert.strictEqual(s.slice(0, 4).toString(), 'MThd');
  assert.strictEqual(s.slice(14, 18).toString(), 'MTrk');
  assert.strictEqual(s.readUInt32BE(18), s.length - 22);
  // 0.5 秒 = 120BPM の 1 拍 = 480 tick = 0x83 0x60
  const i = s.indexOf(Buffer.from([0x90, 60, 100]));
  assert.ok(i > 0);
  assert.deepStrictEqual([...s.slice(i + 3, i + 6)], [0x83, 0x60, 0x80]);
  assert.deepStrictEqual([...s.slice(-4)], [0x00, 0xff, 0x2f, 0x00]);
  // 可変長の数
  assert.deepStrictEqual(C.toMidi([]).slice(-4).length, 4);
});

t('設定の検査', () => {
  const d = C.sanitizeSettings(null);
  assert.strictEqual(d.keysLandscape, 10);
  const s = C.sanitizeSettings({ keysLandscape: 99, labels: 'x', start: 61, slots: [1, 'a'], volume: 3, reverb: 'deep' });
  assert.strictEqual(s.keysLandscape, 21);
  assert.strictEqual(s.labels, 'c');
  assert.strictEqual(s.start, 60);
  assert.deepStrictEqual(s.slots, [21, 60, 72]);
  assert.strictEqual(s.volume, 1);
  assert.strictEqual(s.reverb, 'deep');
  assert.strictEqual(s.mode, 'play');
  const s2 = C.sanitizeSettings({ mode: 'chord', keysChordLandscape: 2, chordSet: 'x'.repeat(99), song: 's1', chordRegister: 'high' });
  assert.deepStrictEqual([s2.mode, s2.keysChordLandscape, s2.chordSet, s2.song, s2.chordRegister], ['chord', 5, 'ex-basic', 's1', 'high']);
});

t('録音の検査', () => {
  assert.strictEqual(C.sanitizeRecording({ events: 'x' }), null);
  assert.strictEqual(C.sanitizeRecording({ events: [[0, 2, 1, 0]] }), null);
  const r = C.sanitizeRecording({ name: '  テスト ', events: [[300, 1, 60, 100], ['x'], [800, 0, 60, 0], [900, 7, 1, 1]] });
  assert.strictEqual(r.name, 'テスト');
  assert.strictEqual(r.events.length, 2);
  assert.strictEqual(r.duration, 700);
});

t('長さの表示', () => {
  assert.strictEqual(C.formatDuration(983), '0:00');
  assert.strictEqual(C.formatDuration(983, true), '0:01');
  assert.strictEqual(C.formatDuration(61500, true), '1:02');
  assert.strictEqual(C.formatDuration(0, true), '0:00');
});

console.log(`ok ${n} 件`);
