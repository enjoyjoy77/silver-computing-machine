/*! robo.js — klattsch を「1行で喋らせる」ための包み紙
 *
 * 使い方（HTMLに2行足すだけ・ネット不要・file://でも動く）:
 *
 *   <script src="../libs/klattsch/klattsch.js"></script>
 *   <script src="../libs/klattsch/robo.js"></script>
 *
 *   robo.say("GAME OVER");        // 定型メッセージ（名前で呼ぶ）
 *   robo.speak("K AH M P L IY T") // 発音記号を直接
 *   robo.jp("やられた");           // 日本語（ひらがな・カタカナ）
 *
 * 音を出すにはブラウザの決まりで「一度ユーザーが画面を触っている」必要がある。
 * クリックやキー操作のあとに呼べば鳴る。ページを開いた瞬間には鳴らせない。
 *
 * klattsch本体は MIT / Copyright (c) 2026 Tony Gies
 * https://github.com/tgies/klattsch
 */
(function (global) {
  'use strict';

  if (!global.klattsch) {
    console.error('[robo] klattsch.js を先に読み込んでください');
    return;
  }
  var K = global.klattsch;

  // ---- 用途別の声 ----------------------------------------------------------
  var VOICE = {
    sys:  'b95 s0.95 v0 h0.02 g0.62 t-0.12 r105',   // 冷たい機械
    warn: 'b105 s0.95 v0 h0.00 g0.80 t0.10 r95',    // 警告（硬く速い）
    deep: 'b70 s0.90 v0 h0.05 g0.70 t-0.35 r120',   // 低く重い
    fail: 'b85 s0.95 v0 h0.10 g0.45 t-0.25 r125',   // 力なく落ちる
    win:  'b115 s1.00 v2 h0.02 g0.60 t0.15 r100',   // 明るい
    talk: 'b120 s1.00 v0 h0.00 g0.50 t0.00 r110'    // ふつうに喋る
  };

  // ---- 定型メッセージ ------------------------------------------------------
  var MSG = {
    'SYSTEM ONLINE':       [VOICE.sys,  'S IH S T AH M , AA N L AY N-15'],
    'INITIALIZING':        [VOICE.sys,  'IH N IH SH AH L AY Z IH NG'],
    'ALL SYSTEMS NOMINAL': [VOICE.sys,  'AO L , S IH S T AH M Z , N AA M AH N AH L-12'],
    'TASK COMPLETE':       [VOICE.sys,  'T AE S K , K AH M P L IY T'],
    'CONFIRMED':           [VOICE.sys,  'K AH N F ER M D'],
    'STAGE CLEAR':         [VOICE.win,  'S T EY JH , K L IH R+15'],
    'NEW RECORD':          [VOICE.win,  'N UW , R EH K ER D+15'],
    'ACCESS DENIED':       [VOICE.warn, 'AE K S EH S , D IH N AY D-20'],
    'ERROR':               [VOICE.warn, 'EH R ER-18'],
    'INVALID INPUT':       [VOICE.warn, 'IH N V AE L IH D , IH N P UH T'],
    'WARNING':             [VOICE.warn, 'W AO R+12 N IH NG'],
    'CRITICAL':            [VOICE.warn, 'K R IH T IH K AH L'],
    'DANGER':              [VOICE.deep, 'D EY+10 N JH ER-20'],
    'SELF DESTRUCT':       [VOICE.deep, 'S EH L F , D IH S T R AH K T , IH N , T EH N , S EH K AH N D Z-15'],
    'READY':               [VOICE.win,  'R EH D IY+15'],
    'GO':                  [VOICE.win,  'G OW+20'],
    'THREE TWO ONE':       [VOICE.sys,  'TH R IY , T UW , W AH N'],
    'PLAYER ONE':          [VOICE.sys,  'P L EY ER , W AH N'],
    'GAME OVER':           [VOICE.fail, 'G EY M , OW-10 V ER-20'],
    'SHUTTING DOWN':       [VOICE.fail, 'SH AH T IH NG , D AW N-25']
  };

  var ctx = null;
  var current = null;          // いま鳴っている音（重ねずに止められるように持つ）

  function audio() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 発音記号の文字列を鳴らす。戻り値は鳴る長さ(ミリ秒)。鳴らせなければ0。
  function speak(seq, opts) {
    opts = opts || {};
    var ac = audio();
    if (!ac) { console.warn('[robo] この環境では音を出せません'); return 0; }
    var r;
    try {
      r = K.compileString(seq);
    } catch (e) {
      console.error('[robo] 発音記号を読めませんでした: ' + e.message);
      return 0;                                  // 無言で消さずログに出す
    }
    if (!r.schedule || !r.schedule.length) return 0;
    var sr = ac.sampleRate;
    var data = K.renderToBuffer({ sampleRate: sr, schedule: r.schedule, totalMs: r.totalMs });
    var buffer = ac.createBuffer(1, data.length, sr);
    buffer.getChannelData(0).set(data);
    var src = ac.createBufferSource();
    src.buffer = buffer;
    var gain = ac.createGain();
    gain.gain.value = (opts.volume == null) ? 1 : opts.volume;
    src.connect(gain); gain.connect(ac.destination);
    if (opts.overlap !== true) stop();
    src.start();
    current = src;
    src.onended = function () { if (current === src) current = null; };
    return r.totalMs;
  }

  function stop() {
    if (current) { try { current.stop(); } catch (e) { /* もう止まっていただけ */ } current = null; }
  }

  // 定型メッセージを名前で鳴らす
  function say(name, opts) {
    var m = MSG[String(name).toUpperCase()];
    if (!m) { console.warn('[robo] そんな定型メッセージはありません: ' + name); return 0; }
    return speak(m[0] + ' ' + m[1], opts);
  }

  // 日本語（ひらがな・カタカナ）を喋らせる
  function jp(text, opts) {
    opts = opts || {};
    var voice = VOICE[opts.voice] || VOICE.talk;
    var codes;
    try {
      codes = K.kanaToPhonemes(text);
    } catch (e) {
      console.error('[robo] かなを読めませんでした: ' + e.message);
      return 0;
    }
    if (!codes || !codes.length) { console.warn('[robo] 読める文字がありません: ' + text); return 0; }
    var body = codes.map(function (c) { return c.code; }).join(' ');
    return speak('[bank=ja-hecko-2026] ' + voice + ' ' + body, opts);
  }

  // wavとして書き出す（効果音ファイルを作りたいとき）
  function wav(seq) {
    var r = K.compileString(seq);
    var sr = 44100;
    var data = K.renderToBuffer({ sampleRate: sr, schedule: r.schedule, totalMs: r.totalMs });
    return K.encodeWav(data, sr);
  }

  global.robo = {
    say: say, speak: speak, jp: jp, stop: stop, wav: wav,
    VOICE: VOICE, MSG: MSG,
    list: function () { return Object.keys(MSG); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
