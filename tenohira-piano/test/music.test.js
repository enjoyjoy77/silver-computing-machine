// node tenohira-piano/test/music.test.js で走る。和音と MIDI ファイルの読み取り
const assert = require('assert');
const M = require('../music-core.js');
const P = require('../piano-core.js');
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('NG: ' + name); throw e; } };

t('和音記号を読む', () => {
  assert.deepStrictEqual(M.parseChord('C'), { root: 0, q: '', bass: null });
  assert.deepStrictEqual(M.parseChord('Am'), { root: 9, q: 'm', bass: null });
  assert.deepStrictEqual(M.parseChord('F#m7/C#'), { root: 6, q: 'm7', bass: 1, spell: 's' });
  assert.deepStrictEqual(M.parseChord('B♭M7'), { root: 10, q: 'M7', bass: null, spell: 'f' });
  assert.strictEqual(M.parseChord('Cmaj7').q, 'M7');
  assert.strictEqual(M.parseChord('C△7').q, 'M7');
  assert.strictEqual(M.parseChord('Bm7-5').q, 'm7b5');
  assert.strictEqual(M.parseChord('Bø').q, 'm7b5');
  assert.strictEqual(M.parseChord('Gsus').q, 'sus4');
  assert.strictEqual(M.parseChord('C+').q, 'aug');
  assert.strictEqual(M.parseChord('Ｄｍ').q, 'm');           // 全角
  assert.strictEqual(M.parseChord('C/C').bass, null);       // 根音と同じベースは書かない
  assert.strictEqual(M.parseChord('H'), null);
  assert.strictEqual(M.parseChord('Cxyz'), null);
});

t('和音記号を書く', () => {
  assert.strictEqual(M.formatChord(M.parseChord('C#m7/G#')), 'C♯m7/G♯');
  assert.strictEqual(M.formatChord(M.parseChord('Dbadd9')), 'D♭add9');
  assert.strictEqual(M.formatChord({ root: 10, q: 'm7b5', bass: null }), 'B♭m7(♭5)');
  assert.strictEqual(M.formatChord({ root: 6, q: '', bass: null }), 'F♯');
});

t('まとめて読む', () => {
  const r = M.parseChordList('C  Am, F | G → Xm  E7');
  assert.deepStrictEqual(r.chords.map(M.formatChord), ['C', 'Am', 'F', 'G', 'E7']);
  assert.deepStrictEqual(r.bad, ['Xm']);
});

t('鳴らす音の並び', () => {
  // 和音は F3(53)〜E4(64)、ベースは D2(38)〜C#3(49)
  assert.deepStrictEqual(M.chordNotes(M.parseChord('C')), [48, 55, 60, 64]);
  assert.deepStrictEqual(M.chordNotes(M.parseChord('Am')), [45, 57, 60, 64]);
  assert.deepStrictEqual(M.chordNotes(M.parseChord('F')), [41, 53, 57, 60]);
  assert.deepStrictEqual(M.chordNotes(M.parseChord('G')), [43, 55, 59, 62]);
  assert.deepStrictEqual(M.chordNotes(M.parseChord('C/E')), [40, 55, 60, 64]);
  assert.deepStrictEqual(M.chordNotes(M.parseChord('C'), { bass: false }), [55, 60, 64]);
  assert.deepStrictEqual(M.chordNotes(M.parseChord('C'), { octave: 1 }), [60, 67, 72, 76]);
  assert.deepStrictEqual(M.chordNotes(M.parseChord('Cadd9'), { bass: false }), [55, 60, 62, 64]);
  for (const q of M.QUALITIES) {
    const ns = M.chordNotes({ root: 7, q: q[0], bass: null });
    assert.ok(ns.every(x => x >= 38 && x <= 64), q[0]);
  }
});

t('例のセットと検査', () => {
  const ex = M.exampleSets();
  assert.strictEqual(ex[0].chords.map(M.formatChord).join(' '), 'C Am F G');
  assert.strictEqual(ex[2].chords.length, 8);
  assert.strictEqual(M.sanitizeChordSet({ chords: [{ root: 99, q: '' }] }), null);
  const s = M.sanitizeChordSet({ name: ' 曲A ', chords: [{ root: 0, q: 'm', bass: 0 }, { root: 2, q: 'nope' }] });
  assert.strictEqual(s.name, '曲A');
  assert.deepStrictEqual(s.chords, [{ root: 0, q: 'm', bass: null }]);
});

// ---- MIDI を組み立てる小道具 ----
const vlq = v => { const b = [v & 0x7f]; while ((v >>= 7)) b.unshift((v & 0x7f) | 0x80); return b; };
const chunk = (id, body) => [...Buffer.from(id), (body.length >>> 24) & 255, (body.length >>> 16) & 255, (body.length >>> 8) & 255, body.length & 255, ...body];
const header = (fmt, ntr, ppq) => chunk('MThd', [0, fmt, 0, ntr, ppq >> 8, ppq & 255]);
const meta = (type, data) => [0xff, type, ...vlq(data.length), ...data];

t('形式0（このアプリの書き出し）を読み戻す', () => {
  const bytes = P.toMidi([[0, 1, 60, 100], [500, 0, 60, 0], [500, 1, 64, 90], [1500, 0, 64, 0]]);
  const midi = M.parseMidi(bytes);
  assert.strictEqual(midi.format, 0);
  const tl = M.songTimeline(midi);
  assert.strictEqual(tl.parts.length, 1);
  assert.strictEqual(tl.parts[0].name, 'tenohira piano');
  const ns = tl.parts[0].notes;
  assert.deepStrictEqual(ns.map(x => [x.note, Math.round(x.ms), Math.round(x.end)]), [[60, 0, 500], [64, 500, 1500]]);
  assert.strictEqual(tl.bpm, 120);
});

t('形式1: テンポの変化・3拍子・ランニングステータス・強さ0の押す・Shift_JIS の名前・打楽器', () => {
  const ppq = 96;
  // 0 番: 指揮者トラック。120BPM で 3/4、3 小節目の頭（tick 576）から 60BPM
  const t0 = [
    0, ...meta(0x58, [3, 2, 24, 8]),
    0, ...meta(0x51, [0x07, 0xa1, 0x20]),
    ...vlq(576), ...meta(0x51, [0x0f, 0x42, 0x40]),
    0, ...meta(0x2f, []),
  ];
  // 1 番: 右手。名前は Shift_JIS の「右手」= 89 45 8E E8
  const t1 = [
    0, ...meta(0x03, [0x89, 0x45, 0x8e, 0xe8]),
    0, 0x90, 72, 100,      // ド5 を押す
    ...vlq(96), 72, 0,     // ランニングステータス・強さ 0 で離す
    0, 76, 80,             // ミ5
    ...vlq(576 - 96), 0x80, 76, 0,
    0, 0xb0, 64, 127,      // ペダル
    0, 0x90, 79, 90,       // ソ5（3 小節目の頭）
    ...vlq(96), 0x80, 79, 0,
    0, 0xb0, 64, 0,
    0, ...meta(0x2f, []),
  ];
  // 2 番: 左手と打楽器（チャンネル 10）
  const t2 = [
    0, ...meta(0x03, [...Buffer.from('Left Hand')]),
    0, 0x91, 48, 70, 0, 0x99, 36, 100,
    ...vlq(192), 0x81, 48, 0, 0, 0x89, 36, 0,
    0, 0x91, 10, 70, ...vlq(10), 0x81, 10, 0,   // 88 鍵の外（除かれる）
    0, ...meta(0x2f, []),
  ];
  const bytes = Uint8Array.from([...header(1, 3, ppq), ...chunk('MTrk', t0), ...chunk('MTrk', t1), ...chunk('MTrk', t2)]);
  const midi = M.parseMidi(bytes);
  assert.strictEqual(midi.tracks.length, 3);
  const tl = M.songTimeline(midi);
  assert.strictEqual(tl.drums, 1);
  assert.strictEqual(tl.outside, 1);
  assert.deepStrictEqual(tl.parts.map(p => p.name), ['右手', 'Left Hand']);
  const rh = tl.parts[0];
  // 120BPM: 1 拍 = 500ms。tick 576（6 拍）= 3000ms。そこから 60BPM: 1 拍 = 1000ms
  assert.deepStrictEqual(rh.notes.map(x => [x.note, Math.round(x.ms), Math.round(x.end)]), [[72, 0, 500], [76, 500, 3000], [79, 3000, 4000]]);
  assert.deepStrictEqual(rh.pedals.map(x => [Math.round(x.ms), x.on]), [[3000, true], [4000, false]]);
  // 3 拍子: 小節は 0, 1500, 3000(以降 60BPM なので 3000 ずつ)
  assert.deepStrictEqual(tl.bars.map(Math.round), [0, 1500, 3000]);
  assert.strictEqual(Math.round(tl.duration), 4000);
  assert.deepStrictEqual(M.defaultRoles(tl.parts), { '1:0': 'self', '2:1': 'play' });
  assert.strictEqual(tl.bpm, 120);

  // 練習する範囲: 2〜3 小節
  const r = M.barRange(tl, 2, 3);
  assert.deepStrictEqual([r.from, r.to, Math.round(r.startMs), Math.round(r.endMs)], [2, 3, 1500, 4000]);
  const ev = M.rangeEvents(tl, r.startMs, r.endMs);
  // 範囲より前に押されたミ5 は鳴らさない。ソ5 は 1500ms 後
  assert.deepStrictEqual(ev.filter(e => e[1] === 1).map(e => [Math.round(e[0]), e[2]]), [[1500, 79]]);
  // 1 小節だけ（ペダルの前で切れる）
  const r1 = M.barRange(tl, 1, 1);
  const ev1 = M.rangeEvents(tl, r1.startMs, r1.endMs);
  const mi = ev1.filter(e => e[2] === 76 && e[1] !== 2);
  assert.deepStrictEqual(mi.map(e => [Math.round(e[0]), e[1]]), [[500, 1], [1500, 0]]); // 範囲の終わりで切る
  // パートを選ぶ
  const onlyLeft = M.rangeEvents(tl, 0, tl.duration, p => p.name === 'Left Hand');
  assert.ok(onlyLeft.every(e => e[4] === 1));

  // 1 パートを高さで分ける
  const sp = M.songTimeline(midi, { split: { part: '1:0', at: 76 } });
  assert.deepStrictEqual(sp.parts.map(p => [p.key, p.count]), [['1:0:R', 2], ['1:0:L', 1], ['2:1', 1]]);
});

t('同じ時刻の離す・押すの順', () => {
  const bytes = P.toMidi([[0, 1, 60, 100], [500, 0, 60, 0], [500, 1, 60, 100], [1000, 0, 60, 0]]);
  const tl = M.songTimeline(M.parseMidi(bytes));
  const ev = M.rangeEvents(tl, 0, tl.duration);
  assert.deepStrictEqual(ev.map(e => [Math.round(e[0]), e[1]]), [[0, 1], [500, 0], [500, 1], [1000, 0]]);
});

t('壊れたファイル', () => {
  const code = f => { try { f(); return 'ok'; } catch (e) { return e.code; } };
  assert.strictEqual(code(() => M.parseMidi(Buffer.from('hello world, not midi'))), 'not-midi');
  assert.strictEqual(code(() => M.parseMidi(Uint8Array.from(header(0, 1, 0x80 << 8 | 0)))), 'smpte');
  const cut = Uint8Array.from([...header(0, 1, 96), ...chunk('MTrk', [0, 0x90, 60, 100, 0x83])]);
  assert.strictEqual(code(() => M.parseMidi(cut)), 'broken');
  const empty = Uint8Array.from([...header(0, 1, 96), ...chunk('MTrk', [0, ...meta(0x2f, [])])]);
  assert.strictEqual(code(() => M.songTimeline(M.parseMidi(empty))), 'no-notes');
  for (const k of ['not-midi', 'smpte', 'broken', 'no-notes']) assert.ok(M.MIDI_MESSAGES[k]);
});

t('鍵盤への収まり', () => {
  assert.strictEqual(M.whiteSpan(60, 72), 8);   // ド4〜ド5
  assert.strictEqual(M.whiteSpan(61, 63), 3);   // ド♯〜レ♯ は ド〜ミ の 3 つ
  assert.strictEqual(M.fitStart(60, 72, 10), 59); // 2 つ余るので 1 つ左へ
  assert.strictEqual(M.fitStart(60, 72, 7), null);
  assert.deepStrictEqual(M.coverStarts(48, 79, 10), [48, 65]);
  assert.deepStrictEqual(M.coverStarts(60, 71, 7), [60]);
  assert.strictEqual(M.coverStarts(21, 108, 10), null);
});

t('版の名前を推す', () => {
  assert.strictEqual(M.guessLabel('夜に駆ける_初級.mid'), '初級');
  assert.strictEqual(M.guessLabel('song-beginner.mid'), '入門');
  assert.strictEqual(M.guessLabel('song.mid'), 'そのほか');
});

t('鍵の横の位置', () => {
  assert.strictEqual(M.keyPos(60) + 1, M.keyPos(62));       // ドとレは白鍵 1 つ
  assert.strictEqual(M.keyPos(64) + 1, M.keyPos(65));       // ミとファも白鍵 1 つ
  assert.strictEqual(M.keyPos(72) - M.keyPos(60), 7);       // 1 オクターブで白鍵 7 つ
  assert.ok(M.keyPos(61) > M.keyPos(60) && M.keyPos(61) < M.keyPos(62));
  // piano-core の鍵盤と同じ位置になる（ド4 から 10 鍵の幅 700px）
  const L = P.layout(60, 10, 700, 300), x0 = M.keyPos(60) - 0.5;
  for (const k of L.whites.concat(L.blacks)) assert.ok(Math.abs((M.keyPos(k.midi) - x0) * 70 - (k.x + k.w / 2)) < 0.01, k.midi);
});

t('右手か左手か', () => {
  assert.strictEqual(M.guessHand({ key: '1:0', name: 'Right Hand', avg: 50 }), 'R');
  assert.strictEqual(M.guessHand({ key: '2:1', name: 'Left Hand', avg: 70 }), 'L');
  assert.strictEqual(M.guessHand({ key: '0:0:L', name: '左手（ド4より下）', avg: 50 }), 'L');
  assert.strictEqual(M.guessHand({ key: '3:0', name: 'Piano', avg: 48 }), 'L');
  assert.strictEqual(M.guessHand({ key: '3:0', name: 'Piano', avg: 70 }), 'R');
});

t('指使いを付ける', () => {
  const mk = arr => arr.map((m, i) => ({ a: i * 300, b: i * 300 + 280, note: m }));
  const f = (arr, h) => M.assignFingering(mk(arr), h || 'R').join('');
  assert.strictEqual(f([60, 62, 64, 65, 67, 69, 71, 72]), '12312345');           // ハ長調・右手・上り
  assert.strictEqual(f([72, 71, 69, 67, 65, 64, 62, 60]), '54321321');           // 下り
  assert.strictEqual(f([48, 50, 52, 53, 55, 57, 59, 60], 'L'), '54321321');      // 左手・上り
  assert.strictEqual(f([65, 67, 69, 70, 72, 74, 76, 77]), '12341234');           // ヘ長調（親指は B♭ の次）
  assert.strictEqual(f([62, 64, 66, 67, 69, 71, 73, 74]), '12312345');           // ニ長調
  assert.strictEqual(f([60, 62, 64, 65, 67, 65, 64, 62, 60]), '123454321');      // 5 本の指の位置
  const chords = [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]].flatMap((c, i) => c.map(m => ({ a: i * 500, b: i * 500 + 480, note: m })));
  assert.strictEqual(M.assignFingering(chords, 'R').join(''), '135135125135');
  // ファイルに入っている指は変えない
  const given = mk([60, 62, 64]); given[1].finger = 3;
  assert.strictEqual(M.assignFingering(given, 'R')[1], 3);
});

t('MIDI の歌詞から指番号を読む', () => {
  const ppq = 96;
  const tr = [
    0, ...meta(0x05, [...Buffer.from('2')]), 0, 0x90, 67, 90, 96, 0x80, 67, 0,
    0, ...meta(0x05, [...Buffer.from('1-3-5')]), 0, 0x90, 60, 90, 0, 0x90, 64, 90, 0, 0x90, 67, 90,
    96, 0x80, 60, 0, 0, 0x80, 64, 0, 0, 0x80, 67, 0,
    0, ...meta(0x05, [...Buffer.from('ら')]), 0, 0x90, 69, 90, 96, 0x80, 69, 0,
    0, ...meta(0x2f, []),
  ];
  const tl = M.songTimeline(M.parseMidi(Uint8Array.from([...header(0, 1, ppq), ...chunk('MTrk', tr)])));
  assert.deepStrictEqual(tl.parts[0].notes.map(n => [n.note, n.finger || 0]), [[67, 2], [60, 1], [64, 3], [67, 5], [69, 0]]);
});

t('手の構えと動き', () => {
  // ソ(2) ラ(3) ファ♯(1) の右手
  const notes = [{ a: 0, b: 400, note: 79, finger: 2 }, { a: 500, b: 900, note: 81, finger: 3 }, { a: 1000, b: 1400, note: 78, finger: 1 }];
  const track = M.handTrack(notes, 'R');
  assert.strictEqual(track.length, 3);
  const g = M.keyPos(79);
  // 押さえている指は鍵の上、残りは 1 鍵ずつ外側
  assert.deepStrictEqual(track[0].x.map(v => +(v - g).toFixed(2)), [-1, 0, 1, 2, 3]);
  // 始まる前は最初の構え、押している間はその鍵から動かない
  const p0 = M.handPoseAt(track, notes, -100, 0);
  assert.strictEqual(+p0.x[1].toFixed(2), +g.toFixed(2));
  const p1 = M.handPoseAt(track, notes, 200, 600);
  assert.deepStrictEqual(p1.pressed, [false, true, false, false, false]);
  assert.strictEqual(p1.x[1], g);
  assert.deepStrictEqual(p1.next, [false, false, true, false, false]);   // 次はラを 3 で
  // ソ(2)→ラ(3) は同じ構えのまま。ラを離した後、ファ♯(1) の少し前から親指が寄っていく
  assert.deepStrictEqual(track[1].x, track[0].x);
  const p2 = M.handPoseAt(track, notes, 980, 0);
  assert.ok(p2.x[0] > track[1].x[0] && p2.x[0] < track[2].x[0]);
  assert.strictEqual(M.handPoseAt(track, notes, 700, 0).x[0], track[1].x[0]);   // まだ動かない
  // 押さえたまま跳ぶときは、離すまで手を動かさない（ド6 を 1 で押さえている間は、次のド7(5) へ寄らない）
  const jump = [{ a: 0, b: 1400, note: 84, finger: 1 }, { a: 1430, b: 1700, note: 96, finger: 5 }];
  const jt = M.handTrack(jump, 'R');
  assert.strictEqual(M.handPoseAt(jt, jump, 1380, 0).x[4], jt[0].x[4]);
  assert.ok(M.handPoseAt(jt, jump, 1420, 0).x[4] > jt[0].x[4]);
  // 左手は指の並びが逆
  const lt = M.handTrack([{ a: 0, b: 400, note: 48, finger: 5 }], 'L');
  assert.ok(lt[0].x[0] > lt[0].x[4]);
});

console.log(`ok ${n} 件`);
