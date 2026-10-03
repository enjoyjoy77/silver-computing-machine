// てのひらピアノ の中身（画面にも音にも触らない部分）
// 音名、鍵盤の並べ方と当たり判定、音源の割り当て、録音の整え方、MIDI ファイルの書き出し、設定の検査。
// ブラウザでは window.PianoCore、node では require('./piano-core.js') で読める。
(function (root) {
'use strict';

const LOWEST = 21;   // A0
const HIGHEST = 108; // C8

const BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];
const NAMES = {
  doremi: ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'],
  cde:    ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
};

function isBlack(midi) { return BLACK[((midi % 12) + 12) % 12]; }
function octaveOf(midi) { return Math.floor(midi / 12) - 1; }  // 国際式。中央のド(60) = 4
function noteName(midi, style) {
  const names = NAMES[style] || NAMES.doremi;
  return names[((midi % 12) + 12) % 12];
}
function noteLabel(midi, style) { return noteName(midi, style) + octaveOf(midi); }

// ---- 鍵盤の並び ----

// 白鍵だけを数える。start は白鍵の MIDI 番号
function whiteKeys(start, count) {
  const out = [];
  for (let m = start; out.length < count && m <= HIGHEST; m++) if (!isBlack(m)) out.push(m);
  return out;
}

// 白鍵 count 個が A0〜C8 に収まるよう start を寄せる
function clampStart(start, count) {
  let s = Math.round(start);
  if (s < LOWEST) s = LOWEST;
  if (s > HIGHEST) s = HIGHEST;
  if (isBlack(s)) s -= 1;
  // 上にはみ出すなら、はみ出さないところまで下げる
  while (s > LOWEST && whiteKeys(s, count).length < count) {
    s -= 1;
    while (isBlack(s)) s -= 1;
  }
  return s;
}

// 白鍵 steps 個ぶん動かす（負なら低い方へ）
function shiftStart(start, steps, count) {
  let s = start;
  const dir = steps < 0 ? -1 : 1;
  for (let i = 0; i < Math.abs(steps); i++) {
    let n = s + dir;
    while (n >= LOWEST && n <= HIGHEST && isBlack(n)) n += dir;
    if (n < LOWEST || n > HIGHEST) break;
    s = n;
  }
  return clampStart(s, count);
}

// 黒鍵の中心を、両隣の白鍵の境目からどれだけずらすか（白鍵の幅に対する割合）
// 本物の鍵盤に寄せて、ド♯・ファ♯は左、レ♯・ラ♯は右にずらす
const BLACK_OFFSET = { 1: -0.10, 3: 0.10, 6: -0.12, 8: 0, 10: 0.12 };

// 画面の大きさから、鍵の四角を計算する。座標は鍵盤の左上が原点
function layout(start, count, width, height, opt) {
  const o = Object.assign({ blackWidth: 0.6, blackHeight: 0.6 }, opt || {});
  const whites = whiteKeys(start, count);
  const w = width / whites.length;
  const keys = whites.map((midi, i) => ({ midi, x: i * w, y: 0, w, h: height, black: false }));
  const blacks = [];
  for (let i = 0; i < whites.length - 1; i++) {
    const m = whites[i] + 1;
    if (m !== whites[i + 1] - 1 || !isBlack(m)) continue; // ミとファ、シとドの間には黒鍵がない
    const bw = w * o.blackWidth;
    const cx = (i + 1) * w + (BLACK_OFFSET[m % 12] || 0) * w;
    blacks.push({ midi: m, x: cx - bw / 2, y: 0, w: bw, h: height * o.blackHeight, black: true });
  }
  return { start, count: whites.length, width, height, whiteWidth: w, whites: keys, blacks, lowest: whites[0], highest: whites[whites.length - 1] };
}

// 指の位置にある鍵。黒鍵が上に乗っているので先に調べる
function hitTest(lay, x, y) {
  if (!lay || x < 0 || y < 0 || x >= lay.width || y >= lay.height) return null;
  for (const k of lay.blacks) {
    if (x >= k.x && x < k.x + k.w && y < k.h) return k;
  }
  const i = Math.min(lay.whites.length - 1, Math.floor(x / lay.whiteWidth));
  return lay.whites[i] || null;
}

// 押した位置から強さ(0〜1)。鍵の奥(上)ほど弱く、手前(下)ほど強い
function velocityFromY(key, y) {
  const f = Math.max(0, Math.min(1, (y - key.y) / key.h));
  const t = Math.max(0, Math.min(1, (f - 0.12) / 0.8));
  return 0.35 + 0.65 * t;
}

// ---- 音源 ----

// Salamander Grand Piano を短三度おきに録った 30 本（A0, C1, D♯1, F♯1, A1, … C8）
const SAMPLE_NAMES = ['A0'];
for (let o = 1; o <= 7; o++) SAMPLE_NAMES.push('C' + o, 'Ds' + o, 'Fs' + o, 'A' + o);
SAMPLE_NAMES.push('C8');
const SAMPLE_BASE = { C: 0, Ds: 3, Fs: 6, A: 9 };
const SAMPLES = SAMPLE_NAMES.map(name => {
  const oct = +name.slice(-1);
  return { name, midi: 12 * (oct + 1) + SAMPLE_BASE[name.slice(0, -1)], file: 'samples/' + name + '.mp3' };
});

// 録音された音量が隣どうしで最大 7dB ほど違うので、ならすための倍率
// （最初の 0.3 秒の音量を音の高さで回帰した線に、四分の三だけ寄せたもの）
const SAMPLE_GAIN = {
  21: 0.90, 24: 0.89, 27: 0.84, 30: 0.77, 33: 0.92, 36: 0.89, 39: 0.76, 42: 0.73, 45: 0.84,
  48: 0.71, 51: 0.68, 54: 1.07, 57: 1.29, 60: 0.65, 63: 0.75, 66: 0.72, 69: 0.83, 72: 1.27,
  75: 1.01, 78: 0.74, 81: 0.95, 84: 1.17, 87: 0.85, 90: 1.12, 93: 1.47, 96: 1.24, 99: 1.99,
  102: 1.81, 105: 1.97, 108: 1.86,
};

// いちばん近い音源。loaded を渡すと、読み込めたものの中から選ぶ
function nearestSample(midi, loaded) {
  let best = null, bestD = Infinity;
  for (const s of SAMPLES) {
    if (loaded && !loaded.has(s.name)) continue;
    const d = Math.abs(s.midi - midi);
    if (d < bestD || (d === bestD && s.midi > midi)) { best = s; bestD = d; } // 同じ距離なら上の音を下げる方が自然
  }
  return best;
}

// 表示している音域に要る音源
function samplesFor(lo, hi) {
  const need = new Set();
  for (let m = lo; m <= hi; m++) need.add(nearestSample(m).name);
  return [...need];
}

// 読み込む順番。いま表示している音域の近くから
function loadOrder(lo, hi) {
  const dist = s => s.midi < lo ? lo - s.midi : s.midi > hi ? s.midi - hi : 0;
  return SAMPLES.slice().sort((a, b) => dist(a) - dist(b) || a.midi - b.midi).map(s => s.name);
}

// ---- 録音 ----
// 1 つの出来事は [時刻ms, 種類, 番号, 強さ]。種類 1=押した 0=離した 2=ペダル(番号は 1 か 0)

const EV_OFF = 0, EV_ON = 1, EV_PEDAL = 2;

// 押したまま終わった音を閉じ、時刻順に並べ、先頭の無音を詰める
function finishEvents(events, endMs) {
  const evs = events.map((e, i) => [e[0], e[1], e[2], e[3] || 0, i]);
  evs.sort((a, b) => a[0] - b[0] || a[4] - b[4]);
  const on = new Map();
  let pedal = false;
  const out = [];
  for (const e of evs) {
    const [t, k, n, v] = e;
    if (k === EV_ON) {
      if (on.has(n)) out.push([t, EV_OFF, n, 0]);
      on.set(n, true);
      out.push([t, EV_ON, n, v]);
    } else if (k === EV_OFF) {
      if (!on.has(n)) continue;
      on.delete(n);
      out.push([t, EV_OFF, n, 0]);
    } else if (k === EV_PEDAL) {
      const p = !!n;
      if (p === pedal) continue;
      pedal = p;
      out.push([t, EV_PEDAL, p ? 1 : 0, 0]);
    }
  }
  const last = out.length ? out[out.length - 1][0] : 0;
  const end = Math.max(endMs == null ? last : endMs, last);
  for (const n of on.keys()) out.push([end, EV_OFF, n, 0]);
  if (pedal) out.push([end, EV_PEDAL, 0, 0]);
  const firstOn = out.find(e => e[1] === EV_ON);
  if (!firstOn) return { events: [], duration: 0 };
  const shift = Math.max(0, firstOn[0] - 200); // 押す前の待ち時間は 0.2 秒だけ残す
  const evts = out.map(e => [Math.round((e[0] - shift) * 10) / 10, e[1], e[2], e[3]]);
  return { events: evts, duration: Math.round((end - shift) * 10) / 10 };
}

function countNotes(events) { return events.reduce((n, e) => n + (e[1] === EV_ON ? 1 : 0), 0); }

// round=true は保存した録音の長さ用（1 秒に満たなくても 0:01 と出す）。録音中の時計は切り捨て
function formatDuration(ms, round) {
  let s = Math.max(0, round ? Math.round(ms / 1000) : Math.floor(ms / 1000));
  if (round && ms > 0 && s === 0) s = 1;
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// ---- MIDI ファイル（SMF 形式0）----

function vlq(n) {
  n = Math.max(0, Math.round(n));
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

function toMidi(events, opt) {
  const o = Object.assign({ ppq: 480, bpm: 120, name: 'tenohira piano' }, opt || {});
  const usPerQuarter = Math.round(60000000 / o.bpm);
  const msToTick = ms => Math.round(ms * o.ppq * 1000 / usPerQuarter);
  const trk = [];
  const nameBytes = Array.from(new TextEncoder().encode(o.name));
  trk.push(0, 0xff, 0x03, ...vlq(nameBytes.length), ...nameBytes);
  trk.push(0, 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);
  trk.push(0, 0xff, 0x58, 0x04, 4, 2, 24, 8); // 4/4
  trk.push(0, 0xc0, 0);                       // 音色: アコースティックピアノ
  let prev = 0;
  for (const [t, k, n, v] of events) {
    const tick = msToTick(t);
    const delta = Math.max(0, tick - prev);
    prev = Math.max(prev, tick);
    if (k === EV_ON) trk.push(...vlq(delta), 0x90, n & 0x7f, Math.max(1, Math.min(127, v | 0)));
    else if (k === EV_OFF) trk.push(...vlq(delta), 0x80, n & 0x7f, 64);
    else if (k === EV_PEDAL) trk.push(...vlq(delta), 0xb0, 64, n ? 127 : 0);
  }
  trk.push(0, 0xff, 0x2f, 0x00);
  const len = trk.length;
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (o.ppq >> 8) & 0xff, o.ppq & 0xff];
  const th = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
  return new Uint8Array([...head, ...th, ...trk]);
}

// ---- 設定 ----

const DEFAULTS = {
  keysLandscape: 10,     // 横向きの白鍵の数
  keysPortrait: 7,       // 縦向きの白鍵の数
  labels: 'c',           // 'c'=ドだけ 'all'=すべて 'none'=なし
  labelStyle: 'doremi',  // 'doremi' | 'cde'
  dynamics: 'fixed',     // 'fixed'=一定 'position'=押す位置で変える
  slide: 'hold',         // 'hold'=最初の音のまま 'glide'=滑らせた先を鳴らす
  pedalMode: 'momentary',// 'momentary'=押している間 'latch'=押すたびに切替
  reverb: 'off',         // 'off' | 'light' | 'deep'
  volume: 0.8,
  edge: 'normal',        // 画面端の余白 'normal' | 'wide' | 'wider'
  mix: 'solo',           // ほかのアプリの音楽 'solo'=止める（消音モードでも鳴る） 'mix'=重ねる
  start: 60,             // 一番左の白鍵（前回の配置）
  slots: [48, 60, 72],   // 登録した音域（一番左の白鍵）
  mode: 'play',          // 画面 'play'=ふつうに弾く 'chord'=伴奏して弾く 'song'=曲を練習する
  keysChordLandscape: 7, // 伴奏の画面（横向き）の白鍵の数。左に和音ボタンが入るぶん少なめ
  chordPlay: 'hold',     // 和音ボタン 'hold'=押している間 'toggle'=押すたびに切り替え
  chordBass: 'on',       // ベースの音を足す
  chordRegister: 'mid',  // 和音の高さ 'low' | 'mid' | 'high'
  chordSet: 'ex-basic',  // 使っている和音のセット
  song: '',              // 練習している曲
};

const CHOICES = {
  labels: ['c', 'all', 'none'], labelStyle: ['doremi', 'cde'], dynamics: ['fixed', 'position'],
  slide: ['hold', 'glide'], pedalMode: ['momentary', 'latch'], reverb: ['off', 'light', 'deep'],
  edge: ['normal', 'wide', 'wider'], mix: ['solo', 'mix'],
  mode: ['play', 'chord', 'song'], chordPlay: ['hold', 'toggle'], chordBass: ['on', 'off'], chordRegister: ['low', 'mid', 'high'],
};

function int(v, lo, hi, d) { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; }

// 保存されていた設定を検査して、足りない所を初期値で埋める
function sanitizeSettings(raw) {
  const s = Object.assign({}, DEFAULTS);
  if (!raw || typeof raw !== 'object') return Object.assign(s, { slots: DEFAULTS.slots.slice() });
  for (const k of Object.keys(CHOICES)) if (CHOICES[k].includes(raw[k])) s[k] = raw[k];
  s.keysLandscape = int(raw.keysLandscape, 7, 21, DEFAULTS.keysLandscape);
  s.keysPortrait = int(raw.keysPortrait, 5, 12, DEFAULTS.keysPortrait);
  s.keysChordLandscape = int(raw.keysChordLandscape, 5, 14, DEFAULTS.keysChordLandscape);
  const id = (v, d) => (typeof v === 'string' && v.length <= 40 ? v : d);
  s.chordSet = id(raw.chordSet, DEFAULTS.chordSet);
  s.song = id(raw.song, DEFAULTS.song);
  const vol = Number(raw.volume);
  s.volume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : DEFAULTS.volume;
  const white = (v, d) => { const m = int(v, LOWEST, HIGHEST, d); return isBlack(m) ? m - 1 : m; };
  s.start = white(raw.start, DEFAULTS.start);
  s.slots = DEFAULTS.slots.map((d, i) => white(Array.isArray(raw.slots) ? raw.slots[i] : d, d));
  return s;
}

// 読み込んだ録音を検査する。壊れていたら null
function sanitizeRecording(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.events)) return null;
  const events = [];
  for (const e of r.events) {
    if (!Array.isArray(e) || e.length < 3) continue;
    const t = Number(e[0]), k = e[1] | 0, n = e[2] | 0, v = (e[3] | 0);
    if (!Number.isFinite(t) || t < 0 || ![0, 1, 2].includes(k)) continue;
    if (k !== EV_PEDAL && (n < 0 || n > 127)) continue;
    events.push([t, k, n, Math.max(0, Math.min(127, v))]);
  }
  if (!events.length) return null;
  const fin = finishEvents(events);
  if (!fin.events.length) return null;
  return {
    id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : '録音',
    created: Number.isFinite(Number(r.created)) ? Number(r.created) : Date.now(),
    duration: fin.duration,
    events: fin.events,
  };
}

const PianoCore = {
  LOWEST, HIGHEST, isBlack, octaveOf, noteName, noteLabel,
  whiteKeys, clampStart, shiftStart, layout, hitTest, velocityFromY,
  SAMPLES, SAMPLE_GAIN, nearestSample, samplesFor, loadOrder,
  EV_OFF, EV_ON, EV_PEDAL, finishEvents, countNotes, formatDuration, toMidi,
  DEFAULTS, sanitizeSettings, sanitizeRecording,
};

if (typeof module === 'object' && module.exports) module.exports = PianoCore;
else root.PianoCore = PianoCore;
})(typeof self !== 'undefined' ? self : this);
