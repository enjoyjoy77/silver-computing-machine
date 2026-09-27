/* kaidan-core.js — 「上から下」階段読みの中身。ブラウザと node の両方で使う。
 *
 * 入力: kuromoji.js(IPADIC) の形態素列 + アクセント辞書(accent.tsv, UniDic 由来)
 * 出力: アクセント句(ひと山)の列。各句は モーラ列・核の位置(0=平板)・高低の型 を持つ。
 *
 * アクセント辞書の行:  表層 \t 読み|アクセント型|結合型|品詞;...
 *   アクセント型: 0=平板, n=n拍目に核。「3,4」のように候補が複数あることもある
 *   結合型(名詞など): C1=後ろの語の核を保つ C2=後ろの語の1拍目 C3=前の語の最後の拍 C4=平板 C5=前の語の核を保つ
 *   結合型(助詞・助動詞): n:F1 v:F2@0 a:F2@-1 のように、前の語の品詞ごとの付き方
 *     F1=前に従う  F2@p=前が平板なら p に核  F3@p=前が起伏なら p に核  F4@p=いつも p に核
 *     p>=1 は自分の p 拍目、p<=0 は前の語の末尾から (0=末尾, -1=その前)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KaidanCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- かな・モーラ
  const SMALL = 'ァィゥェォャュョヮ';
  const SPECIAL = 'ーンッ';
  const ROWS = {
    a: 'アカサタナハマヤラワガザダバパァャヮ',
    i: 'イキシチニヒミリギジヂビピィ',
    u: 'ウクスツヌフムユルグズヅブプゥュヴ',
    e: 'エケセテネヘメレゲゼデベペェ',
    o: 'オコソトノホモヨロヲゴゾドボポォョ',
  };
  const VOWEL = {};
  for (const v in ROWS) for (const ch of ROWS[v]) VOWEL[ch] = v;

  function hiraToKata(s) {
    return String(s || '').replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  }
  function kataToHira(s) {
    return String(s || '').replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }
  function isKana(s) {
    return /^[ぁ-ゖァ-ヺー]+$/.test(s);
  }
  // カタカナ(or ひらがな)の文字列をモーラに切る。小書き(ャュョ…)は前の字につく
  function toMorae(kana) {
    const s = hiraToKata(kana).replace(/[^ァ-ヺー]/g, (ch) => ch);
    const out = [];
    for (const ch of s) {
      if (SMALL.includes(ch) && out.length) out[out.length - 1] += ch;
      else out.push(ch);
    }
    return out;
  }
  function vowelOf(mora) {
    return VOWEL[mora[mora.length - 1]] || null;
  }
  function isSpecial(mora) {
    return SPECIAL.includes(mora);
  }
  // 読み(カタカナ)→発音。オウ→オー、エイ→エー、同じ母音の連続→ー。手入力の読み用
  function kanaToPron(kana) {
    const m = toMorae(kana);
    for (let i = 1; i < m.length; i++) {
      const v = vowelOf(m[i - 1]);
      if (!v || isSpecial(m[i - 1])) continue;
      if (m[i] === 'ウ' && (v === 'o' || v === 'u')) m[i] = 'ー';
      else if (m[i] === 'イ' && (v === 'e' || v === 'i')) m[i] = 'ー';
      else if (m[i] === 'ア' && v === 'a') m[i] = 'ー';
      else if (m[i] === 'エ' && v === 'e') m[i] = 'ー';
      else if (m[i] === 'オ' && v === 'o') m[i] = 'ー';
    }
    return m.join('');
  }
  // 核が特殊拍(ー・ン・ッ)に乗ったら、ひとつ前にずらす
  function fixNucleus(morae, k) {
    while (k > 1 && isSpecial(morae[k - 1])) k--;
    if (k > morae.length) k = morae.length;
    return k < 0 ? 0 : k;
  }
  // 高低の型: k=0 平板(低高高…)、k=1 頭高(高低低…)、k>=2 (低 高…高 低…)
  function pattern(len, k) {
    const p = [];
    if (len === 1) return [k === 0 ? 'H' : 'H'];
    for (let i = 1; i <= len; i++) {
      if (k === 1) p.push(i === 1 ? 'H' : 'L');
      else if (k === 0) p.push(i === 1 ? 'L' : 'H');
      else p.push(i === 1 ? 'L' : i <= k ? 'H' : 'L');
    }
    return p;
  }
  // 山の頂点(最初に高くなる拍)。1始まり
  function peakIndex(len, k) {
    if (len <= 1) return 1;
    return k === 1 ? 1 : 2;
  }

  // ---------------------------------------------------------------- 辞書
  class AccentDict {
    constructor(text) {
      this.map = new Map();
      if (text) this.load(text);
    }
    load(text) {
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line || line[0] === '#') continue;
        const tab = line.indexOf('\t');
        if (tab < 0) continue;
        this.map.set(line.slice(0, tab), line.slice(tab + 1));
      }
    }
    get size() {
      return this.map.size;
    }
    // → [{kana, types:[..]|null, acon:'C1'|'n:F1 v:F2@0'|'', pos:'n'}]
    lookup(surface) {
      const raw = this.map.get(surface);
      if (!raw) return [];
      return raw.split(';').map((e) => {
        const [kana, at, acon, pos] = e.split('|');
        let types = null;
        if (at && at !== '*') types = at.split(',').map((x) => parseInt(x, 10)).filter((x) => !isNaN(x));
        return { kana, types, acon: acon || '', pos: pos || 'n' };
      });
    }
  }
  // 'n:F1 v:F2@0 a:F2@-1' → {n:'F1', v:'F2@0', a:'F2@-1'}
  function parseFRules(acon) {
    const out = {};
    if (!acon || acon[0] === 'C' || acon[0] === 'P') return out;
    for (const seg of acon.split(' ')) {
      const i = seg.indexOf(':');
      if (i > 0) out[seg.slice(0, i)] = seg.slice(i + 1);
    }
    return out;
  }

  // ---------------------------------------------------------------- IPADIC の素性
  function normToken(t) {
    // kuromoji の token → 扱いやすい形
    const surface = t.surface_form;
    const pos = t.pos || '';
    const pos1 = t.pos_detail_1 || '*';
    const pos2 = t.pos_detail_2 || '*';
    let reading = t.reading;
    let pron = t.pronunciation;
    let unknown = false;
    if (!reading || reading === '*') {
      unknown = true;
      if (isKana(surface)) {
        reading = hiraToKata(surface);
        pron = kanaToPron(reading);
      } else {
        reading = null;
        pron = null;
      }
    }
    if (!pron || pron === '*') pron = reading;
    return {
      __norm: true,
      surface,
      pos,
      pos1,
      pos2,
      ctype: t.conjugated_type || '*',
      cform: t.conjugated_form || '*',
      base: t.basic_form && t.basic_form !== '*' ? t.basic_form : surface,
      reading,
      pron,
      unknown,
      user: t.user || null,
    };
  }

  // 「ましょ」+「う」→「ましょう」のように、IPADIC が切りすぎる助動詞をつなぐ
  function mergeAux(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const n = tokens[i + 1];
      if (
        n &&
        t.pos === '助動詞' &&
        n.pos === '助動詞' &&
        n.surface === 'う' &&
        /[ょろ]$/.test(t.surface)
      ) {
        out.push(
          Object.assign({}, t, {
            surface: t.surface + 'う',
            reading: t.reading + 'ウ',
            pron: t.pron + 'ー',
            base: t.surface + 'う',
          })
        );
        i++;
        continue;
      }
      out.push(t);
    }
    return out;
  }

  // 助詞・助動詞の付き方の上書き(UniDic の値より標準的な読みを優先するもの)
  const OVERRIDE = {
    ましょう: { n: 'F4@2', v: 'F4@2', a: 'F4@2' },
    でしょう: { n: 'F2@2', v: 'F2@2', a: 'F2@-1' },
    だろう: { n: 'F2@2', v: 'F2@2', a: 'F2@-1' },
    う: { n: 'F4@0', v: 'F4@0', a: 'F4@0' }, // 書こ+う、食べよ+う
    よう: { v: 'F4@0' },
    た: { v: 'F1', a: 'F1' },
    たら: { v: 'F1', a: 'F1' },
    たり: { v: 'F1', a: 'F1' },
    ちゃ: { v: 'F1' },
    ちゃう: { v: 'F1' },
    ない: { a: 'F2@-1' },
    なかっ: { a: 'F2@-1' },
    なく: { a: 'F2@-1' },
    なけれ: { a: 'F2@-1' },
    なり: { a: 'F2@-1' },
  };
  // 複合語の後ろに来たときの結合型の上書き(UniDic は単独名詞としての値なので)
  const TAIL_C = { 語: 'C4', 線: 'C4', 県: 'C4', 川: 'C4', 島: 'C4', 屋: 'C4', 中: 'C4', 前: 'C4', 側: 'C4', 型: 'C4', 用: 'C4', 制: 'C4', 費: 'C4', 力: 'C4', 感: 'C4' };

  // ---------------------------------------------------------------- 句(ひと山)の組み立て
  class Phrase {
    constructor() {
      this.parts = []; // {surface, morae, kind, ownK, src}
      this.morae = [];
      this.k = 0; // 句全体の核(1始まり, 0=平板)
      this.lockedK = 0; // 前の語で既に核が決まっていればその位置
      this.wordK = 0; // いま組み立て中の語の核
      this.cat = 'n'; // n=名詞系 v=動詞 a=形容詞
      this.src = 'dict'; // dict / guess / user / rule
      this.alt = null; // 頭の語のアクセント候補 [3,4] など
      this.compoundable = false; // 名詞が続いたら複合語にできるか
      this.pendingPrefix = []; // 接頭詞のモーラ(頭の語が来るまで保留)
      this.pendingPrefixSurface = '';
      this.lastKind = '';
      this.pauseAfter = false;
      this.end = false;
      this.resetBefore = false;
      this.needsReading = false;
    }
    get len() {
      return this.morae.length;
    }
    get surface() {
      return this.parts.map((p) => p.surface).join('');
    }
    get empty() {
      return this.parts.length === 0 && this.pendingPrefix.length === 0;
    }
    push(surface, morae, kind, extra) {
      this.parts.push(Object.assign({ surface, morae: morae.slice(), kind }, extra || {}));
      // 長音: 助動詞「う」が o/u の拍の後に来たら ー (書こ+う → カコー)
      if (kind === 'attach' && surface === 'う' && morae.length === 1 && this.morae.length) {
        const v = vowelOf(this.morae[this.morae.length - 1]);
        if (v === 'o' || v === 'u') morae = ['ー'].concat(morae.slice(1));
      }
      this.morae.push(...morae);
      this.lastKind = kind;
    }
    commit() {
      this.k = this.lockedK > 0 ? this.lockedK : this.wordK;
      this.k = fixNucleus(this.morae, this.k);
    }
    // 位置指定 p を句のモーラ番号に。p>=1 は自分の p 拍目、p<=0 は前の末尾から
    posOf(p, before) {
      const n = p >= 1 ? before + p : before + p;
      return n < 1 ? 1 : n;
    }
    // F 規則で助詞・助動詞をつける
    applyF(rule, morae) {
      const before = this.len;
      const m = /^F(\d)(?:@(-?\d+))?/.exec(rule || 'F1');
      const kind = m ? m[1] : '1';
      const p = m && m[2] !== undefined ? parseInt(m[2], 10) : 0;
      let k = this.wordK;
      if (kind === '2') {
        if (k === 0) k = this.posOf(p, before);
      } else if (kind === '3') {
        if (k > 0) k = this.posOf(p, before);
      } else if (kind === '4') {
        k = this.posOf(p, before);
      } else if (kind === '6') {
        if (k === 0) k = this.posOf(p, before);
      }
      if (k > before + morae.length) k = before + morae.length;
      this.wordK = k;
    }
    // C 規則で後ろの語(複合語の後部・接尾)をつける。partK は後部単独の核
    applyC(code, morae, partK) {
      const before = this.len;
      let k = this.wordK;
      const total = before + morae.length;
      switch (code) {
        case 'C1':
          k = partK > 0 ? before + partK : before + 1;
          break;
        case 'C2':
          k = before + 1;
          break;
        case 'C3':
          k = before;
          break;
        case 'C4':
          k = 0;
          break;
        case 'C5':
          break;
        default:
          // 規則不明: 後部が3拍以上なら後部の核(なければ1拍目)、短ければ前部末尾
          if (morae.length >= 3) k = partK > 0 ? before + partK : before + 1;
          else k = before;
      }
      if (k > total) k = total;
      this.wordK = k;
    }
    // 新しい語を始める(補助動詞など)。前の語に核があればそれが勝つ
    newWord() {
      if (this.lockedK === 0 && this.wordK > 0) this.lockedK = fixNucleus(this.morae, this.wordK);
      this.wordK = 0;
    }
  }

  const NO_COMPOUND_POS1 = new Set(['代名詞', '副詞可能', '引用文字列', '特殊']);

  class Analyzer {
    constructor(dict, opts) {
      this.dict = dict;
      this.opts = Object.assign({ resetAtPause: false }, opts || {});
    }

    // ---- 辞書引き
    dictEntry(surface, reading, posSet) {
      const ents = this.dict.lookup(surface);
      if (!ents.length) return null;
      const cand = posSet ? ents.filter((e) => posSet.includes(e.pos)) : ents;
      const pool = cand.length ? cand : ents;
      if (reading) {
        const hit = pool.find((e) => e.kana === reading);
        if (hit) return hit;
        const head = reading[0];
        const hit2 = pool.find((e) => e.kana[0] === head);
        if (hit2) return hit2;
      }
      return pool[0];
    }
    // 名詞などの頭の語のアクセント
    nounAccent(tok) {
      if (tok.user) return tok.user.k == null ? { k: this.guessK(tok, 'n'), src: 'guess', alt: null, acon: '', pos: tok.user.cat || 'n', found: false } : { k: tok.user.k, src: 'user', alt: null, acon: '', pos: tok.user.cat || 'n', found: true };
      const e = this.dictEntry(tok.surface, tok.reading, ['n', 'g', 'u', 'r', 'j', 'd', 'k', 't', 'c', 's']);
      if (e && e.types && e.types.length) {
        return { k: e.types[0], src: e.kana === tok.reading ? 'dict' : 'dict?', alt: e.types, acon: e.acon, pos: e.pos, found: true };
      }
      const c = this.compoundGuess(tok);
      if (c) return c;
      return { k: this.guessK(tok, 'n'), src: 'guess', alt: null, acon: '', pos: 'n', found: false };
    }
    // 辞書に無い語を前+後の2語に分けて引く。読みがぴったり合う分け方だけ採る
    compoundGuess(tok) {
      const s = tok.surface;
      const reading = tok.reading;
      if (!reading || s.length < 2 || !/[\u4e00-\u9fff]/.test(s)) return null;
      for (let i = s.length - 1; i >= 1; i--) {
        const a = s.slice(0, i), b = s.slice(i);
        const ea = this.dict.lookup(a), eb = this.dict.lookup(b);
        if (!ea.length || !eb.length) continue;
        for (const x of ea) {
          if (!reading.startsWith(x.kana)) continue;
          const rest = reading.slice(x.kana.length);
          const y = eb.find((z) => z.kana === rest && z.pos !== 'p' && z.pos !== 'x');
          if (!y) continue;
          const ma = toMorae(x.kana), mb = toMorae(y.kana);
          const kb = y.types && y.types.length ? y.types[0] : 0;
          let k;
          if (x.pos === 'f') {
            // 接頭辞(お・ご): 後ろが平板なら平板、起伏なら核をそのまま後ろへ
            k = kb > 0 ? ma.length + kb : 0;
          } else {
            const ka = x.types && x.types.length ? x.types[0] : 0;
            const code = TAIL_C[b] || (/^C\d/.test(y.acon) ? y.acon : '');
            const ph = new Phrase();
            ph.push(a, ma, 'head', {});
            ph.wordK = ka;
            ph.applyC(code, mb, kb);
            k = ph.wordK;
          }
          k = fixNucleus(ma.concat(mb), k);
          return { k, src: 'dict', alt: null, acon: y.acon, pos: 'n', found: true, split: [a, b] };
        }
      }
      return null;
    }
    guessK(tok, cat) {
      const morae = tok.pron ? toMorae(tok.pron) : [];
      const n = morae.length;
      if (cat === 'v') return n >= 2 ? n - 1 : 1;
      if (cat === 'a') return n >= 2 ? n - 1 : 1;
      if (!n) return 0;
      // カタカナ語: 後ろから3拍目
      if (/^[ァ-ヺー]+$/.test(tok.surface)) return fixNucleus(morae, Math.max(1, n - 2));
      if (n <= 2) return 1;
      return 0;
    }
    // 動詞・形容詞: 辞書形の核 → 活用形での核
    verbAccent(tok, cat) {
      const posSet = cat === 'v' ? ['v'] : ['a'];
      const e = this.dictEntry(tok.base, tok.reading, posSet);
      let k0, src, alt = null;
      if (e && e.types && e.types.length) {
        k0 = e.types[0];
        alt = e.types;
        src = 'dict';
      } else {
        k0 = this.guessK(tok, cat);
        src = 'guess';
      }
      const morae = toMorae(tok.pron || '');
      const n = morae.length;
      let k = k0;
      const f = tok.cform;
      if (cat === 'v') {
        if (k0 > 0) {
          const godan = /^(五段|四段)/.test(tok.ctype);
          if (f === '連用形' && !godan) k = Math.max(1, k0 - 1);
          else if (/^(連用タ接続|連用テ接続|連用デ接続)/.test(f) && !godan) k = Math.max(1, k0 - 1);
          else k = k0;
          if (k > n) k = n;
        } else {
          // 平板の動詞: 命令形は 後ろから2拍目に核
          if (/^命令/.test(f) && n >= 2) k = n - 1;
          else k = 0;
        }
      } else {
        if (k0 > 0) {
          if (f === '基本形' || f === '体言接続' || f === '文語基本形') k = k0;
          else k = Math.max(1, k0 - 1);
          if (k > n) k = n;
        } else {
          if (/^(連用タ接続|仮定形|未然ヌ接続|仮定縮約)/.test(f) && n >= 3) k = n - 2;
          else k = 0;
        }
      }
      return { k: fixNucleus(morae, k), k0, src, alt };
    }
    // 助詞・助動詞の付き方
    attachRule(tok, cat) {
      const ov = OVERRIDE[tok.surface] || (tok.base !== tok.surface ? OVERRIDE[tok.base] : null);
      if (ov && ov[cat]) return { rule: ov[cat], src: 'rule' };
      if (tok.base === 'た' && tok.pos === '助動詞') return { rule: 'F1', src: 'rule' };
      const ents = this.dict.lookup(tok.surface).filter((e) => e.pos === 'p' || e.pos === 'x');
      let pick = null;
      if (ents.length) {
        const want = tok.pos === '助詞' ? 'p' : 'x';
        pick = ents.find((e) => e.pos === want && e.kana === tok.reading) || ents.find((e) => e.pos === want) || ents[0];
      }
      if (pick) {
        const rules = parseFRules(pick.acon);
        const r = rules[cat] || rules.n || rules.v || rules.a;
        if (r) return { rule: r, src: 'dict' };
      }
      return { rule: 'F1', src: 'default' };
    }

    // ---- 本体
    analyze(tokens) {
      const toks = mergeAux(tokens.map((t) => (t.__norm ? t : normToken(t))));
      const phrases = [];
      let cur = null;
      const close = () => {
        if (cur && !cur.empty) {
          cur.commit();
          phrases.push(cur);
        }
        cur = null;
      };
      const ensure = () => {
        if (!cur) cur = new Phrase();
        return cur;
      };
      const moraeOf = (tok) => {
        if (tok.pron) return toMorae(tok.pron);
        return Array.from(tok.surface); // 読み不明: 1文字を1拍扱いにして印を付ける
      };

      for (let i = 0; i < toks.length; i++) {
        const tok = toks[i];
        const prev = toks[i - 1];
        const cls = classify(tok);

        if (cls === 'pause') {
          close();
          if (phrases.length) phrases[phrases.length - 1].pauseAfter = true;
          continue;
        }
        if (cls === 'end') {
          close();
          if (phrases.length) phrases[phrases.length - 1].end = true;
          continue;
        }
        if (cls === 'break') {
          close();
          continue;
        }
        if (cls === 'skip') continue;

        if (cls === 'prefix') {
          if (cur && !cur.empty) close();
          const p = ensure();
          const m = moraeOf(tok);
          p.pendingPrefix.push(...m);
          p.pendingPrefixSurface += tok.surface;
          continue;
        }

        // ---- 助詞・助動詞・接尾・補助動詞: 直前の句にくっつく
        if (cls === 'attach' || cls === 'suffix' || cls === 'formal' || cls === 'auxverb' || cls === 'auxadj') {
          if (!cur || cur.empty) {
            // 句の頭が付属語(「ではない」など)。単独の語として立てる
            const p = ensure();
            const m = moraeOf(tok);
            const acc = this.nounAccent(tok);
            p.push(tok.surface, m, 'head', { ownK: acc.k, src: acc.src });
            p.wordK = acc.k;
            p.src = acc.src;
            p.cat = 'n';
            if (!tok.pron) p.needsReading = true;
            continue;
          }
          const p = cur;
          const m = moraeOf(tok);
          if (!tok.pron) p.needsReading = true;
          if (cls === 'attach') {
            const r = this.attachRule(tok, p.cat);
            p.applyF(r.rule, m);
            p.push(tok.surface, m, 'attach', { rule: r.rule, src: r.src });
            p.compoundable = false;
          } else if (cls === 'suffix') {
            const e = this.dictEntry(tok.surface, tok.reading, ['s', 'n']);
            const code = e && /^C\d/.test(e.acon) ? e.acon : '';
            const partK = e && e.types && e.types.length ? e.types[0] : 0;
            p.applyC(code, m, partK);
            p.push(tok.surface, m, 'suffix', { rule: code || 'C?', src: e ? 'dict' : 'guess' });
          } else if (cls === 'formal') {
            p.applyF('F1', m);
            p.push(tok.surface, m, 'formal', { rule: 'F1', src: 'rule' });
            p.compoundable = false;
          } else if (cls === 'auxverb' || cls === 'auxadj') {
            const cat = cls === 'auxverb' ? 'v' : 'a';
            const directAfterRenyo = prev && prev.pos === '動詞' && prev.cform === '連用形' && p.lastKind === 'head';
            if (directAfterRenyo && (cls === 'auxadj' || /^(始める|出す|続ける|終わる|込む|合う|直す|切る|過ぎる|かける|忘れる|上げる|下ろす|回る|尽くす|得る|うる|かねる|そびれる|損なう|損ねる|尽くす)$/.test(tok.base))) {
              // 複合動詞・複合形容詞(読みやすい・走り出す): 全体の後ろから2拍目
              p.push(tok.surface, m, 'compound', { rule: 'V+V', src: 'rule' });
              p.lockedK = 0;
              p.wordK = fixNucleus(p.morae, Math.max(1, p.len - 1));
              p.cat = cat;
            } else {
              // 補助動詞(〜ている・〜てくる): 前に核があればそれが勝つ。なければ自分の核
              p.newWord();
              const acc = this.verbAccent(tok, cat);
              p.push(tok.surface, m, 'auxverb', { ownK: acc.k, src: acc.src });
              p.wordK = acc.k > 0 ? p.len - m.length + acc.k : 0;
              p.cat = cat;
            }
            p.compoundable = false;
          }
          continue;
        }

        // ---- 自立語
        const m = moraeOf(tok);
        const isNoun = tok.pos === '名詞';
        const isVerb = tok.pos === '動詞';
        const isAdj = tok.pos === '形容詞';

        // 名詞 + する(勉強する・メモする)
        if (isVerb && cur && !cur.empty && cur.compoundable && cur.cat === 'n' && tok.base === 'する' && prev && prev.pos === '名詞') {
          const p = cur;
          const headLen = p.len;
          p.push(tok.surface, m, 'compound', { rule: 'N+する', src: 'rule' });
          if (p.wordK === 0 && headLen <= 2) p.wordK = headLen + 1; // 愛する → アイス↓ル
          p.cat = 'v';
          p.compoundable = false;
          continue;
        }
        // 動詞連用形 + 動詞(読み始める) → 複合動詞
        if (isVerb && cur && !cur.empty && prev && prev.pos === '動詞' && prev.pos1 === '自立' && prev.cform === '連用形' && cur.lastKind === 'head') {
          const p = cur;
          p.push(tok.surface, m, 'compound', { rule: 'V+V', src: 'rule' });
          p.lockedK = 0;
          p.wordK = fixNucleus(p.morae, Math.max(1, p.len - 1));
          p.cat = 'v';
          p.compoundable = false;
          continue;
        }
        // 数 + 数(二 十) → ひとつの数
        if (isNoun && tok.pos1 === '数' && cur && !cur.empty && cur.lastKind === 'head' && prev && prev.pos === '名詞' && prev.pos1 === '数') {
          const p = cur;
          const merged = p.parts[p.parts.length - 1];
          const surface = merged.surface + tok.surface;
          const reading = (merged.reading || '') + (tok.reading || '');
          const e = this.dictEntry(surface, reading, ['u', 'n']);
          p.parts.pop();
          p.morae.splice(p.morae.length - merged.morae.length, merged.morae.length);
          const mm = e ? toMorae(kanaToPron(e.kana)) : merged.morae.concat(m);
          const acc = e && e.types ? { k: e.types[0], src: 'dict', alt: e.types } : { k: 1, src: 'guess', alt: null };
          p.push(surface, mm, 'head', { ownK: acc.k, src: acc.src, reading });
          p.wordK = p.pendingPrefix.length && acc.k > 0 ? acc.k + p.pendingPrefix.length : acc.k;
          p.src = acc.src;
          p.alt = acc.alt;
          continue;
        }
        // 名詞 + 名詞 → 複合語(後ろの語の結合型で決める)
        if (isNoun && cur && !cur.empty && cur.compoundable && cur.cat === 'n' && !NO_COMPOUND_POS1.has(tok.pos1) && cur.lastKind === 'head') {
          const p = cur;
          const acc = this.nounAccent(tok);
          const code = /^C\d/.test(acc.acon) ? acc.acon : '';
          p.applyC(code, m, acc.k);
          p.push(tok.surface, m, 'compound', { rule: code || 'C?', src: acc.src, ownK: acc.k });
          if (!tok.pron) p.needsReading = true;
          if (acc.pos === 'r') p.compoundable = false;
          continue;
        }
        // 連体詞(この・その) + 名詞 → ひと山にして、先に核がある方が勝つ
        if (isNoun && cur && !cur.empty && prev && prev.pos === '連体詞' && cur.lastKind === 'head') {
          const p = cur;
          p.newWord();
          const acc = this.nounAccent(tok);
          p.push(tok.surface, m, 'head', { ownK: acc.k, src: acc.src });
          p.wordK = acc.k > 0 ? p.len - m.length + acc.k : 0;
          p.alt = acc.alt;
          p.compoundable = !NO_COMPOUND_POS1.has(tok.pos1) && acc.pos !== 'r';
          if (!tok.pron) p.needsReading = true;
          continue;
        }

        // 新しい句(ただし接頭詞が保留されていればそれに続ける)
        if (cur && !cur.empty && !(cur.parts.length === 0 && cur.pendingPrefix.length)) close();
        const p = ensure();
        let acc;
        if (isVerb || isAdj) {
          acc = this.verbAccent(tok, isVerb ? 'v' : 'a');
          p.cat = isVerb ? 'v' : 'a';
        } else {
          acc = this.nounAccent(tok);
          p.cat = 'n';
        }
        if (p.pendingPrefix.length) {
          p.push(p.pendingPrefixSurface, p.pendingPrefix, 'prefix', { rule: 'P', src: 'rule' });
          p.pendingPrefix = [];
          p.pendingPrefixSurface = '';
          const plen = p.len;
          p.push(tok.surface, m, 'head', { ownK: acc.k, src: acc.src });
          p.wordK = acc.k > 0 ? acc.k + plen : 0;
        } else {
          p.push(tok.surface, m, 'head', { ownK: acc.k, src: acc.src });
          p.wordK = acc.k;
        }
        p.src = acc.src;
        p.alt = acc.alt;
        p.compoundable = isNoun && !NO_COMPOUND_POS1.has(tok.pos1) && acc.pos !== 'r' && !tok.user;
        if (tok.user && tok.user.cat) p.cat = tok.user.cat;
        if (!tok.pron) p.needsReading = true;
      }
      close();
      if (phrases.length) phrases[phrases.length - 1].end = true;
      return phrases.map(finalize);
    }
  }

  // 形態素の役割分け
  function classify(tok) {
    const s = tok.surface;
    if (tok.pos === '記号' || tok.pos === '補助記号' || /^[\s、。，．,.!?！？…‥「」『』（）()［］\[\]【】〈〉《》・―—－\-〜~"'“”‘’:;：；]+$/.test(s)) {
      if (/^[、，,]$/.test(s) || tok.pos1 === '読点') return 'pause';
      if (/^[。．.!?！？]+$/.test(s) || tok.pos1 === '句点' || tok.pos1 === '改行') return 'end';
      if (/^[…‥―—]+$/.test(s)) return 'pause';
      if (tok.pos1 === 'アルファベット') return 'content';
      return 'break';
    }
    if (tok.pos === '接頭詞') return 'prefix';
    if (tok.pos === '助詞' || tok.pos === '助動詞') return 'attach';
    if (tok.pos === '動詞') {
      if (tok.pos1 === '非自立') return 'auxverb';
      if (tok.pos1 === '接尾') return 'attach';
      return 'content';
    }
    if (tok.pos === '形容詞') {
      if (tok.pos1 === '非自立') return 'auxadj';
      if (tok.pos1 === '接尾') return 'attach';
      return 'content';
    }
    if (tok.pos === '名詞') {
      if (tok.pos1 === '接尾') return 'suffix';
      if (tok.pos1 === '非自立') return 'formal';
      if (tok.pos1 === '動詞非自立的') return 'auxverb';
      if (tok.pos1 === '特殊') return 'attach'; // そう(だ)
      return 'content';
    }
    if (tok.pos === 'その他') return 'attach';
    return 'content'; // 副詞・連体詞・接続詞・感動詞・フィラー
  }

  // 出力用に整える
  function finalize(p) {
    const len = p.morae.length;
    const k = fixNucleus(p.morae, Math.min(p.k, len));
    return {
      surface: p.surface,
      morae: p.morae.slice(),
      k,
      alt: p.alt && p.alt.length > 1 ? p.alt.slice() : null,
      src: p.src,
      cat: p.cat,
      parts: p.parts.map((x) => ({ surface: x.surface, morae: x.morae.slice(), kind: x.kind, rule: x.rule || '', src: x.src || '', ownK: x.ownK == null ? null : x.ownK })),
      pauseAfter: p.pauseAfter,
      end: p.end,
      resetBefore: p.resetBefore,
      needsReading: p.needsReading,
      pattern: pattern(len, k),
      peak: peakIndex(len, k),
    };
  }
  // 読みや核を書き換えた後に型を作り直す
  function refresh(ph) {
    const len = ph.morae.length;
    if (ph.k > len) ph.k = len;
    ph.k = fixNucleus(ph.morae, ph.k);
    ph.pattern = pattern(len, ph.k);
    ph.peak = peakIndex(len, ph.k);
    return ph;
  }
  // 2つの句をひとつに(先に核がある方が勝つ)
  function mergePhrases(a, b) {
    const morae = a.morae.concat(b.morae);
    let k = a.k > 0 ? a.k : b.k > 0 ? a.morae.length + b.k : 0;
    const out = {
      surface: a.surface + b.surface,
      morae,
      k,
      alt: null,
      src: 'edit',
      cat: b.cat,
      parts: a.parts.concat(b.parts),
      pauseAfter: b.pauseAfter,
      end: b.end,
      resetBefore: a.resetBefore,
      needsReading: a.needsReading || b.needsReading,
    };
    return refresh(out);
  }
  // 句を part の境目で2つに割る。後ろ側の核は、その先頭の語の単独アクセントから
  function splitPhrase(ph, partIndex) {
    if (partIndex <= 0 || partIndex >= ph.parts.length) return [ph];
    const p1 = ph.parts.slice(0, partIndex);
    const p2 = ph.parts.slice(partIndex);
    const m1 = [].concat(...p1.map((x) => x.morae));
    const m2 = [].concat(...p2.map((x) => x.morae));
    const a = {
      surface: p1.map((x) => x.surface).join(''),
      morae: m1,
      k: ph.k <= m1.length ? ph.k : 0,
      alt: null,
      src: 'edit',
      cat: ph.cat,
      parts: p1,
      pauseAfter: false,
      end: false,
      resetBefore: ph.resetBefore,
      needsReading: ph.needsReading,
    };
    const headK = p2[0].ownK == null ? (ph.k > m1.length ? ph.k - m1.length : 0) : p2[0].ownK;
    const b = {
      surface: p2.map((x) => x.surface).join(''),
      morae: m2,
      k: headK,
      alt: null,
      src: 'edit',
      cat: ph.cat,
      parts: p2,
      pauseAfter: ph.pauseAfter,
      end: ph.end,
      resetBefore: false,
      needsReading: ph.needsReading,
    };
    return [refresh(a), refresh(b)];
  }

  // 階段の段: 仕切り(文末・手動リセット・任意で読点)ごとに、上から順に一段ずつ下げる
  function assignLevels(phrases, opts) {
    const o = Object.assign({ resetAtPause: false }, opts || {});
    let group = [];
    const flush = () => {
      const n = group.length;
      group.forEach((ph, i) => {
        ph.level = n - 1 - i;
        ph.groupSize = n;
        ph.groupIndex = i;
      });
      group = [];
    };
    for (let i = 0; i < phrases.length; i++) {
      const ph = phrases[i];
      const prev = phrases[i - 1];
      if (i > 0 && (ph.resetBefore || prev.end || (o.resetAtPause && prev.pauseAfter))) flush();
      group.push(ph);
    }
    flush();
    return phrases;
  }

  // ---- ことば帳(自作の単語)で先に切っておく: 最長一致
  function segmentWithWords(text, words) {
    if (!words || !words.length) return [{ text }];
    const list = words.filter((w) => w && w.surface).sort((a, b) => b.surface.length - a.surface.length);
    const out = [];
    let buf = '';
    let i = 0;
    while (i < text.length) {
      let hit = null;
      for (const w of list) {
        if (text.startsWith(w.surface, i)) {
          hit = w;
          break;
        }
      }
      if (hit) {
        if (buf) out.push({ text: buf });
        buf = '';
        out.push({ text: hit.surface, word: hit });
        i += hit.surface.length;
      } else {
        buf += text[i];
        i++;
      }
    }
    if (buf) out.push({ text: buf });
    return out;
  }
  // 自作単語 → 形態素っぽいもの
  function wordToken(w) {
    const kana = hiraToKata(w.kana || w.surface);
    const pron = w.pron ? hiraToKata(w.pron) : kanaToPron(kana);
    return {
      __norm: true,
      surface: w.surface,
      pos: '名詞',
      pos1: '一般',
      pos2: '*',
      ctype: '*',
      cform: '*',
      base: w.surface,
      reading: kana,
      pron,
      unknown: false,
      user: { k: w.k == null || w.k === '' ? null : Number(w.k), cat: w.cat || 'n' },
    };
  }
  // 文章全体: 行で切り、ことば帳で先に切り、残りを形態素解析
  function tokenizeText(text, tokenizer, words) {
    const tokens = [];
    const lines = String(text).replace(/\r/g, '').split('\n');
    lines.forEach((line, li) => {
      if (li > 0) tokens.push({ __norm: true, surface: '\n', pos: '記号', pos1: '改行', pos2: '*', ctype: '*', cform: '*', base: '\n', reading: null, pron: null });
      for (const seg of segmentWithWords(line, words)) {
        if (seg.word) tokens.push(wordToken(seg.word));
        else if (seg.text.trim()) for (const t of tokenizer.tokenize(seg.text)) tokens.push(normToken(t));
        else if (seg.text) tokens.push({ __norm: true, surface: ' ', pos: '記号', pos1: '空白', pos2: '*', ctype: '*', cform: '*', base: ' ', reading: null, pron: null });
      }
    });
    return tokens;
  }

  return {
    hiraToKata,
    kataToHira,
    toMorae,
    kanaToPron,
    isSpecial,
    fixNucleus,
    pattern,
    peakIndex,
    AccentDict,
    Analyzer,
    normToken,
    classify,
    refresh,
    mergePhrases,
    splitPhrase,
    assignLevels,
    segmentWithWords,
    tokenizeText,
    wordToken,
  };
});
