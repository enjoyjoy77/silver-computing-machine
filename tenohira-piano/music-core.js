// てのひらピアノ の中身その2（和音と MIDI ファイル）
// 和音記号の読み書きと鳴らす音の並べ方、MIDI ファイルの読み取り、小節と時刻の換算、パートの音域と鍵盤への収まり方。
// ブラウザでは window.MusicCore、node では require('./music-core.js') で読める。
(function (root) {
'use strict';

const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
const mod12 = n => ((n % 12) + 12) % 12;

// ================= 和音 =================

const ROOT_POP = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const ROOT_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const ROOT_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

// [記号, 表示, 根音からの半音]
const QUALITIES = [
  ['', '', [0, 4, 7]],
  ['m', 'm', [0, 3, 7]],
  ['7', '7', [0, 4, 7, 10]],
  ['M7', 'M7', [0, 4, 7, 11]],
  ['m7', 'm7', [0, 3, 7, 10]],
  ['6', '6', [0, 4, 7, 9]],
  ['m6', 'm6', [0, 3, 7, 9]],
  ['add9', 'add9', [0, 4, 7, 14]],
  ['9', '9', [0, 4, 7, 10, 14]],
  ['sus4', 'sus4', [0, 5, 7]],
  ['7sus4', '7sus4', [0, 5, 7, 10]],
  ['sus2', 'sus2', [0, 2, 7]],
  ['dim', 'dim', [0, 3, 6]],
  ['dim7', 'dim7', [0, 3, 6, 9]],
  ['m7b5', 'm7(♭5)', [0, 3, 6, 10]],
  ['aug', 'aug', [0, 4, 8]],
  ['mM7', 'mM7', [0, 3, 7, 11]],
];
const Q = new Map(QUALITIES.map(q => [q[0], q]));

// コード譜でよく見る書き方の揺れ
const ALIASES = {
  '': '', 'M': '', 'maj': '', 'Maj': '',
  'm': 'm', 'min': 'm', '-': 'm',
  '7': '7', 'dom7': '7',
  'M7': 'M7', 'maj7': 'M7', 'Maj7': 'M7', 'MAJ7': 'M7', '△7': 'M7', '△': 'M7', 'Δ7': 'M7', 'Δ': 'M7',
  'm7': 'm7', 'min7': 'm7', '-7': 'm7',
  '6': '6', 'm6': 'm6', 'min6': 'm6',
  'add9': 'add9', 'add2': 'add9', '9': '9',
  'sus4': 'sus4', 'sus': 'sus4', '7sus4': '7sus4', '7sus': '7sus4', 'sus2': 'sus2',
  'dim': 'dim', '°': 'dim', 'o': 'dim', 'dim7': 'dim7', '°7': 'dim7', 'o7': 'dim7',
  'm7b5': 'm7b5', 'm7-5': 'm7b5', 'm7(b5)': 'm7b5', 'm7(-5)': 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5',
  'aug': 'aug', '+': 'aug', '+5': 'aug', '(#5)': 'aug',
  'mM7': 'mM7', 'm(maj7)': 'mM7', 'mmaj7': 'mM7', 'm△7': 'mM7', 'mMaj7': 'mM7',
};
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function normalizeChordText(s) {
  return String(s).normalize('NFKC').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\s+/g, '');
}

// "C#m7/G#" → { root: 1, q: 'm7', bass: 8, spell: 's' }。読めなければ null
function parseChord(text) {
  const s = normalizeChordText(text);
  const m = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/.exec(s);
  if (!m) return null;
  const q = ALIASES[m[3]];
  if (q === undefined) return null;
  const acc = a => (a === '#' ? 1 : a === 'b' ? -1 : 0);
  const root = mod12(LETTER[m[1]] + acc(m[2]));
  const ch = { root, q, bass: null };
  if (m[4]) {
    const b = mod12(LETTER[m[4]] + acc(m[5]));
    if (b !== root) ch.bass = b;
  }
  const sp = m[2] || m[5];
  if (sp) ch.spell = sp === '#' ? 's' : 'f';
  return ch;
}

function rootName(pc, spell) {
  const t = spell === 's' ? ROOT_SHARP : spell === 'f' ? ROOT_FLAT : ROOT_POP;
  return t[mod12(pc)];
}
function formatChord(ch) {
  if (!ch) return '';
  const q = Q.get(ch.q) || Q.get('');
  return rootName(ch.root, ch.spell) + q[1] + (ch.bass == null ? '' : '/' + rootName(ch.bass, ch.spell));
}

// 空白・カンマ・縦棒・矢印で区切った並びを読む。読めなかった語は bad に返す
function parseChordList(text) {
  const words = String(text).normalize('NFKC').split(/[\s,、|｜→>]+/).filter(Boolean);
  const chords = [], bad = [];
  for (const w of words) { const c = parseChord(w); if (c) chords.push(c); else bad.push(w); }
  return { chords, bad };
}

// 鳴らす音。和音は F3〜E4 の 1 オクターブに畳み、ベースは D2〜C♯3 に置く。
// 窓を固定するので、和音を替えても指（音）があまり動かない並びになる
const CHORD_LOW = 53, BASS_LOW = 38;
function chordNotes(ch, opt) {
  const o = Object.assign({ octave: 0, bass: true }, opt || {});
  const q = Q.get(ch.q) || Q.get('');
  const low = CHORD_LOW + 12 * o.octave;
  const notes = new Set();
  for (const iv of q[2]) notes.add(low + mod12(ch.root + iv - low));
  const out = [...notes].sort((a, b) => a - b);
  if (o.bass) {
    const bl = BASS_LOW + 12 * o.octave;
    out.unshift(bl + mod12((ch.bass == null ? ch.root : ch.bass) - bl));
  }
  return out;
}

const EXAMPLE_SETS = [
  { id: 'ex-basic', name: '例: 基本の4つ', text: 'C Am F G' },
  { id: 'ex-ohdo', name: '例: 王道進行', text: 'FM7 G7 Em7 Am' },
  { id: 'ex-canon', name: '例: カノン進行', text: 'C G/B Am Em/G F C/E F G' },
];
function exampleSets() {
  return EXAMPLE_SETS.map(e => ({ id: e.id, name: e.name, chords: parseChordList(e.text).chords }));
}

function sanitizeChord(c) {
  if (!c || typeof c !== 'object') return null;
  const root = Number(c.root);
  if (!Number.isInteger(root) || root < 0 || root > 11 || !Q.has(c.q)) return null;
  const out = { root, q: c.q, bass: null };
  const b = Number(c.bass);
  if (c.bass != null && Number.isInteger(b) && b >= 0 && b <= 11 && b !== root) out.bass = b;
  if (c.spell === 's' || c.spell === 'f') out.spell = c.spell;
  return out;
}
const MAX_CHORDS = 8;
function sanitizeChordSet(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.chords)) return null;
  const chords = s.chords.map(sanitizeChord).filter(Boolean).slice(0, MAX_CHORDS);
  if (!chords.length) return null;
  return {
    id: typeof s.id === 'string' && s.id ? s.id.slice(0, 40) : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 40) : '和音のセット',
    chords,
  };
}

// ================= MIDI ファイル =================

class MidiError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const MIDI_MESSAGES = {
  'not-midi': 'MIDI ファイルではないようです。拡張子が .mid か .midi のファイルを選んでください。',
  'smpte': 'このファイルは時間の数え方（SMPTE）に対応していません。',
  'broken': 'ファイルが途中で壊れているか、切れています。',
  'no-notes': 'このファイルには鳴らす音がありません。',
};

function parseMidi(input) {
  let d = input instanceof Uint8Array ? input : new Uint8Array(input);
  const str = (a, b) => String.fromCharCode(...d.subarray(a, b));
  const u32 = a => ((d[a] << 24) >>> 0) + (d[a + 1] << 16) + (d[a + 2] << 8) + d[a + 3];
  const u16 = a => (d[a] << 8) + d[a + 1];
  if (d.length >= 12 && str(0, 4) === 'RIFF' && str(8, 12) === 'RMID') {
    // RIFF に包まれた MIDI（.rmi）。中の data を取り出す
    let p = 12, found = null;
    while (p + 8 <= d.length) {
      const id = str(p, p + 4), len = (d[p + 4] | (d[p + 5] << 8) | (d[p + 6] << 16) | (d[p + 7] << 24)) >>> 0;
      if (id === 'data') { found = d.subarray(p + 8, p + 8 + len); break; }
      p += 8 + len + (len & 1);
    }
    if (!found) throw new MidiError('not-midi');
    d = found;
  }
  if (d.length < 14 || str(0, 4) !== 'MThd') throw new MidiError('not-midi');
  const hlen = u32(4), format = u16(8), division = u16(12);
  if (division & 0x8000) throw new MidiError('smpte');
  const ppq = division || 480;
  const tracks = [], tempos = [], timeSigs = [];
  let p = 8 + hlen, endTick = 0;
  while (p + 8 <= d.length) {
    const id = str(p, p + 4), len = u32(p + 4);
    p += 8;
    const end = Math.min(d.length, p + len);
    if (id === 'MTrk') {
      const t = parseTrack(d, p, end, tracks.length, tempos, timeSigs);
      tracks.push(t);
      endTick = Math.max(endTick, t.endTick);
    }
    p = end;
  }
  if (!tracks.length) throw new MidiError('broken');
  tempos.sort((a, b) => a.tick - b.tick);
  timeSigs.sort((a, b) => a.tick - b.tick);
  return { format, ppq, tracks, tempos, timeSigs, endTick };
}

function parseTrack(d, p, end, index, tempos, timeSigs) {
  let tick = 0, running = 0, name = '';
  const notes = [], pedals = [], programs = new Map(), open = new Map(), channels = new Set();
  const vlq = () => {
    let n = 0, b;
    do {
      if (p >= end) throw new MidiError('broken');
      b = d[p++]; n = (n << 7) | (b & 0x7f);
    } while (b & 0x80);
    return n;
  };
  const closeNote = (ch, note, t) => {
    const k = ch * 128 + note, q = open.get(k);
    if (!q || !q.length) return;
    const o = q.shift();
    if (t > o.tick) notes.push({ tick: o.tick, dur: t - o.tick, note, vel: o.vel, ch });
  };
  while (p < end) {
    tick += vlq();
    let status = d[p];
    if (status < 0x80) {
      if (!running) throw new MidiError('broken');
      status = running;
    } else {
      p++;
      if (status < 0xf0) running = status;
    }
    if (status >= 0x80 && status < 0xf0) {
      const type = status & 0xf0, ch = status & 0x0f;
      const a = d[p++], b = (type === 0xc0 || type === 0xd0) ? 0 : d[p++];
      if (p > end) throw new MidiError('broken');
      if (type === 0x90 && b > 0) {
        const k = ch * 128 + a;
        if (!open.has(k)) open.set(k, []);
        open.get(k).push({ tick, vel: b });
        channels.add(ch);
      } else if (type === 0x80 || type === 0x90) {
        closeNote(ch, a, tick);
      } else if (type === 0xb0 && a === 64) {
        pedals.push({ tick, ch, on: b >= 64 });
      } else if (type === 0xc0 && !programs.has(ch)) {
        programs.set(ch, a);
      }
    } else if (status === 0xff) {
      const type = d[p++], len = vlq(), data = d.subarray(p, p + len);
      p += len;
      if (p > end) throw new MidiError('broken');
      if (type === 0x03 && !name) name = decodeText(data);
      else if (type === 0x51 && len === 3) tempos.push({ tick, us: (data[0] << 16) | (data[1] << 8) | data[2] });
      else if (type === 0x58 && len >= 2) timeSigs.push({ tick, num: data[0] || 4, den: Math.pow(2, data[1]) || 4 });
      else if (type === 0x2f) break;
      running = 0;
    } else if (status === 0xf0 || status === 0xf7) {
      p += vlq();
      running = 0;
    } else {
      throw new MidiError('broken');
    }
  }
  // 閉じられないまま終わった音は、トラックの終わりで閉じる
  for (const [k, q] of open) for (const o of q) if (tick > o.tick) notes.push({ tick: o.tick, dur: tick - o.tick, note: k % 128, vel: o.vel, ch: Math.floor(k / 128) });
  notes.sort((x, y) => x.tick - y.tick || x.note - y.note);
  return { index, name, notes, pedals, programs, channels: [...channels].sort((a, b) => a - b), endTick: tick };
}

// 曲名・トラック名は Shift_JIS のことがある（日本の MIDI）。UTF-8 として正しくなければ Shift_JIS で読む
function decodeText(bytes) {
  if (typeof TextDecoder === 'undefined') return String.fromCharCode(...bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim(); } catch (e) { /* 次へ */ }
  try { return new TextDecoder('shift_jis').decode(bytes).trim(); } catch (e) { return String.fromCharCode(...bytes).trim(); }
}

// tick → ミリ秒。テンポの変わり目ごとに区切って足していく
function tempoMap(midi) {
  const segs = [{ tick: 0, ms: 0, us: 500000 }];
  for (const t of midi.tempos) {
    const last = segs[segs.length - 1];
    const ms = last.ms + (t.tick - last.tick) * last.us / midi.ppq / 1000;
    if (t.tick === last.tick) { last.us = t.us; continue; }
    segs.push({ tick: t.tick, ms, us: t.us });
  }
  return tick => {
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].tick <= tick) lo = mid; else hi = mid - 1; }
    const s = segs[lo];
    return s.ms + (tick - s.tick) * s.us / midi.ppq / 1000;
  };
}

// 小節の頭の tick。拍子が途中で変わったら、そこから数え直す
function barTicks(midi) {
  const sigs = midi.timeSigs.length && midi.timeSigs[0].tick === 0 ? midi.timeSigs : [{ tick: 0, num: 4, den: 4 }].concat(midi.timeSigs);
  const bars = [];
  for (let i = 0; i < sigs.length; i++) {
    const s = sigs[i], until = i + 1 < sigs.length ? sigs[i + 1].tick : midi.endTick;
    const len = midi.ppq * 4 * s.num / s.den;
    for (let t = s.tick; t < until; t += len) bars.push(Math.round(t));
  }
  if (!bars.length) bars.push(0);
  return bars;
}

const RIGHT_NAMES = /^(right|rh\b|r\.h|右手|treble|upper|melody|メロディ)/i;

// 鳴らせる形にする。パートはトラック×チャンネル。打楽器（チャンネル10）は鳴らせないので除く
// opt.split = { part: 'キー', at: 60 } なら、そのパートを at 以上（右手）と未満（左手）に分ける
function songTimeline(midi, opt) {
  const o = opt || {};
  const ms = tempoMap(midi);
  const bars = barTicks(midi).map(ms);
  const parts = [];
  let drums = 0, outside = 0;
  for (const t of midi.tracks) {
    const chs = [...new Set(t.notes.map(n => n.ch))].sort((a, b) => a - b);
    for (const ch of chs) {
      if (ch === 9) { drums += t.notes.filter(n => n.ch === 9).length; continue; }
      // ピアノの 88 鍵（A0〜C8）の外の音は鍵盤に出せないので除く
      const all = t.notes.filter(n => n.ch === ch);
      const notes = all.filter(n => n.note >= 21 && n.note <= 108).map(n => ({ ms: ms(n.tick), end: ms(n.tick + n.dur), note: n.note, vel: n.vel }));
      outside += all.length - notes.length;
      const pedals = t.pedals.filter(x => x.ch === ch).map(x => ({ ms: ms(x.tick), on: x.on }));
      let name = t.name || '';
      if (chs.filter(c => c !== 9).length > 1) name = (name ? name + ' ' : '') + 'チャンネル' + (ch + 1);
      parts.push({ key: t.index + ':' + ch, name, notes, pedals });
    }
  }
  if (o.split && parts.length) {
    const i = parts.findIndex(x => x.key === o.split.part);
    if (i >= 0) {
      const src = parts[i], at = o.split.at;
      const hi = { key: src.key + ':R', name: '右手（' + nameOf(at) + '以上）', notes: src.notes.filter(n => n.note >= at), pedals: src.pedals, split: true };
      const lo = { key: src.key + ':L', name: '左手（' + nameOf(at) + 'より下）', notes: src.notes.filter(n => n.note < at), pedals: src.pedals, split: true };
      parts.splice(i, 1, hi, lo);
    }
  }
  const seen = new Map();
  parts.forEach((x, i) => {
    if (!x.name) x.name = 'パート' + (i + 1);
    // 同じ名前のトラックが並ぶファイルもあるので、2 つ目からは番号を足す
    const k = seen.get(x.name) || 0;
    seen.set(x.name, k + 1);
    if (k) x.name += '（' + (k + 1) + '）';
    const ns = x.notes;
    x.count = ns.length;
    x.lo = ns.length ? Math.min(...ns.map(n => n.note)) : null;
    x.hi = ns.length ? Math.max(...ns.map(n => n.note)) : null;
    x.avg = ns.length ? ns.reduce((s, n) => s + n.note, 0) / ns.length : 0;
  });
  const usable = parts.filter(x => x.count);
  if (!usable.length) throw new MidiError('no-notes');
  const duration = Math.max(...usable.map(x => Math.max(...x.notes.map(n => n.end))));
  // 曲の終わりより後ろの小節は捨てる
  const lastBar = bars.findIndex(b => b >= duration - 1);
  const barsUsed = lastBar > 0 ? bars.slice(0, lastBar) : bars;
  const bpm = Math.round(60000000 / ((midi.tempos[0] && midi.tempos[0].tick === 0) ? midi.tempos[0].us : 500000));
  return { parts: usable, bars: barsUsed, duration, drums, outside, bpm };
}

function nameOf(midi) {
  const n = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];
  return n[mod12(midi)] + (Math.floor(midi / 12) - 1);
}

// 最初の役割。右手・左手の名前があればそれに従い、なければ平均の高いパートを自分で弾く
function defaultRoles(parts) {
  const roles = {};
  if (!parts.length) return roles;
  const self = parts.find(p => RIGHT_NAMES.test(p.name)) || parts.slice().sort((a, b) => b.avg - a.avg)[0];
  for (const p of parts) roles[p.key] = p === self ? 'self' : 'play';
  return roles;
}

// ---- 練習する範囲 ----
// 小節 from〜to（1 から数える、両端を含む）をミリ秒に
function barRange(tl, from, to) {
  const n = tl.bars.length;
  const f = Math.max(1, Math.min(n, from | 0 || 1));
  const t = Math.max(f, Math.min(n, to | 0 || n));
  return { from: f, to: t, startMs: tl.bars[f - 1], endMs: t < n ? tl.bars[t] : tl.duration };
}

// 範囲の中で鳴らす出来事。範囲の終わりをまたぐ音は終わりで切る。範囲より前に押された音は鳴らさない
// 返すのは [範囲の頭からのミリ秒, 種類(1=押す 0=離す 2=ペダル), 番号, 強さ0〜1, パートの番号] の並び
function rangeEvents(tl, startMs, endMs, use) {
  const evs = [];
  tl.parts.forEach((p, pi) => {
    if (use && !use(p, pi)) return;
    for (const n of p.notes) {
      if (n.ms < startMs - 0.5 || n.ms >= endMs) continue;
      const a = n.ms - startMs, b = Math.min(n.end, endMs) - startMs;
      evs.push([a, 1, n.note, n.vel / 127, pi]);
      evs.push([Math.max(a + 1, b), 0, n.note, 0, pi]);
    }
    if (!p.pedals.length) return;
    // 範囲の頭でペダルが踏まれていたら、踏んだ状態から始める
    let atStart = false;
    for (const x of p.pedals) if (x.ms < startMs) atStart = x.on;
    if (atStart) evs.push([0, 2, 1, 0, pi]);
    for (const x of p.pedals) if (x.ms >= startMs && x.ms < endMs) evs.push([x.ms - startMs, 2, x.on ? 1 : 0, 0, pi]);
    evs.push([endMs - startMs, 2, 0, 0, pi]);
  });
  // 同じ時刻なら 離す → ペダル → 押す の順（打ち直しを正しく鳴らすため）
  const order = k => (k === 0 ? 0 : k === 2 ? 1 : 2);
  evs.sort((x, y) => x[0] - y[0] || order(x[1]) - order(y[1]));
  return evs;
}

// ---- 鍵盤への収まり ----
// lo〜hi を鳴らすのに要る白鍵の数
function whiteSpan(lo, hi) {
  let a = lo, b = hi;
  if (isBlack(a)) a -= 1;
  if (isBlack(b)) b += 1;
  let n = 0;
  for (let m = a; m <= b; m++) if (!isBlack(m)) n++;
  return n;
}
// count 個の白鍵で lo〜hi が収まる左端。収まらなければ null。なるべく真ん中に置く
function fitStart(lo, hi, count) {
  const span = whiteSpan(lo, hi);
  if (span > count) return null;
  let s = isBlack(lo) ? lo - 1 : lo;
  for (let i = 0; i < Math.floor((count - span) / 2); i++) { s -= 1; while (isBlack(s)) s -= 1; }
  return Math.max(21, s);
}
// count 個ずつの窓で lo〜hi を覆う左端の並び（低い方から）。max を超えるなら null
function coverStarts(lo, hi, count, max) {
  const starts = [];
  let s = isBlack(lo) ? lo - 1 : lo;
  while (s <= hi) {
    starts.push(s);
    if (starts.length > (max || 3)) return null;
    let n = 0, m = s;
    while (n < count) { if (!isBlack(m)) n++; m++; }
    s = m; // 窓の次の白鍵から
    while (isBlack(s)) s++;
  }
  return starts;
}

// ---- 保存の検査 ----
const VERSION_LABELS = ['入門', '初級', '中級', '上級', '原曲', 'そのほか'];
function guessLabel(fileName) {
  const f = String(fileName || '');
  for (const l of ['入門', '初級', '中級', '上級']) if (f.includes(l)) return l;
  if (/beginner|easy/i.test(f)) return '入門';
  if (/elementary/i.test(f)) return '初級';
  if (/intermediate/i.test(f)) return '中級';
  if (/advanced|expert/i.test(f)) return '上級';
  return 'そのほか';
}

const MusicCore = {
  ROOT_POP, QUALITIES, parseChord, formatChord, parseChordList, chordNotes, rootName,
  exampleSets, sanitizeChord, sanitizeChordSet, MAX_CHORDS,
  MidiError, MIDI_MESSAGES, parseMidi, tempoMap, barTicks, songTimeline, defaultRoles,
  barRange, rangeEvents, whiteSpan, fitStart, coverStarts, VERSION_LABELS, guessLabel, nameOf,
};

if (typeof module === 'object' && module.exports) module.exports = MusicCore;
else root.MusicCore = MusicCore;
})(typeof self !== 'undefined' ? self : this);
