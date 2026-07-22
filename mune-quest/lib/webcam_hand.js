/*
 * PC Webカメラ手トラッキング層（mune v6 rev8）
 *
 * MediaPipe Hand Landmarkerの結果を、C0へ渡せる固定IDの8点と
 * 相対スケール由来の押し込み意図へ変換する。
 *
 * 既知の地雷:
 * - detectForVideo()は同期処理なので、映像フレームごとに呼ばず明示的に間引く。
 * - rVFC/rAFはstop()時に必ず解除し、再開始で二重ループを作らない。
 * - ランドマーク欠落時は点を詰めず、フレーム全体を不採用にする。
 * - ミラー反転はここでx座標へ一度だけ適用する。表示側で再反転しない。
 * - 単眼zは押し込み量に使わず、掌が極端に傾いたフレームの除外だけに使う。
 * - 古い結果の失効判断は利用側も行う。停止・エラー時はvalid=falseにする。
 */

const WC_LANDMARK_COUNT = 21;
const WC_POINT_IDS = [4, 8, 12, 16, 20];
const WC_EPS = 1e-8;

function wcClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function wcMedian(values) {
  if (!values.length) return 0;
  const a = values.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return (a.length & 1) ? a[m] : (a[m - 1] + a[m]) * 0.5;
}

function wcDist2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function wcDist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function wcMid(a, b) {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    z: (a.z + b.z) * 0.5,
  };
}

function wcCentroid3(a, b, c) {
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
    z: (a.z + b.z + c.z) / 3,
  };
}

function wcAlpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * Math.max(0.0001, cutoff));
  return 1 / (1 + tau / Math.max(0.0001, dt));
}

class WcOneEuroScalar {
  constructor(minCutoff, beta, dCutoff) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff || 1.0;
    this.ready = false;
    this.x = 0;
    this.dx = 0;
  }

  reset(v) {
    this.ready = true;
    this.x = v;
    this.dx = 0;
    return v;
  }

  filter(v, dt) {
    if (!this.ready || !Number.isFinite(this.x)) return this.reset(v);

    const rawDx = (v - this.x) / Math.max(0.0001, dt);
    const ad = wcAlpha(this.dCutoff, dt);
    this.dx += (rawDx - this.dx) * ad;

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    const ax = wcAlpha(cutoff, dt);
    this.x += (v - this.x) * ax;
    return this.x;
  }
}

function wcCreateLandmarkFilters(tune) {
  const out = [];
  for (let i = 0; i < WC_LANDMARK_COUNT; i++) {
    out.push({
      x: new WcOneEuroScalar(tune.wcMinCutoff, tune.wcBeta, 1.0),
      y: new WcOneEuroScalar(tune.wcMinCutoff, tune.wcBeta, 1.0),
      z: new WcOneEuroScalar(tune.wcMinCutoff, tune.wcBeta, 1.0),
    });
  }
  return out;
}

function wcResetFilters(filters, landmarks) {
  for (let i = 0; i < filters.length; i++) {
    filters[i].x.reset(landmarks[i].x);
    filters[i].y.reset(landmarks[i].y);
    filters[i].z.reset(landmarks[i].z);
  }
}

function wcFilterLandmarks(filters, landmarks, dt) {
  const out = new Array(WC_LANDMARK_COUNT);
  for (let i = 0; i < WC_LANDMARK_COUNT; i++) {
    const f = filters[i];
    const p = landmarks[i];
    out[i] = {
      x: f.x.filter(p.x, dt),
      y: f.y.filter(p.y, dt),
      z: f.z.filter(p.z, dt),
    };
  }
  return out;
}

/*
 * 単一の骨だけに依存すると手の開閉や傾きの影響が増えるため、
 * 掌の縦、掌の横、複数指の鎖長から代表スケールを作る。
 */
function wcHandScale(lm) {
  const palmLong = wcDist2(lm[0], lm[9]);
  const palmWide = wcDist2(lm[5], lm[17]);

  const indexChain =
    wcDist2(lm[5], lm[6]) +
    wcDist2(lm[6], lm[7]) +
    wcDist2(lm[7], lm[8]);

  const middleChain =
    wcDist2(lm[9], lm[10]) +
    wcDist2(lm[10], lm[11]) +
    wcDist2(lm[11], lm[12]);

  const ringChain =
    wcDist2(lm[13], lm[14]) +
    wcDist2(lm[14], lm[15]) +
    wcDist2(lm[15], lm[16]);

  /*
   * 指鎖は掌骨長より長いため、基準フレーム内で同程度の桁になるよう
   * 係数を掛ける。絶対長ではなくフレーム間比だけを利用する。
   */
  return wcMedian([
    palmLong,
    palmWide,
    indexChain * 0.72,
    middleChain * 0.68,
    ringChain * 0.72,
  ]);
}

function wcLandmarkMotion(prev, next) {
  if (!prev || !next) return 0;
  let sum = 0;
  const ids = [0, 5, 9, 13, 17, 4, 8, 12, 16, 20];
  for (const i of ids) sum += wcDist2(prev[i], next[i]);
  return sum / ids.length;
}

function wcAtScreenEdge(lm, margin) {
  const ids = [0, 4, 8, 12, 16, 20];
  for (const i of ids) {
    const p = lm[i];
    if (
      p.x < margin || p.x > 1 - margin ||
      p.y < margin || p.y > 1 - margin
    ) return true;
  }
  return false;
}

/*
 * zの絶対値や前後移動量は使わない。
 * 掌内のzレンジが画像上の掌サイズに対して極端な場合だけ、
 * 掌が横を向いている可能性が高いとしてpress更新を保留する。
 */
function wcPalmTooTilted(lm) {
  const ids = [0, 5, 9, 13, 17];
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const i of ids) {
    zMin = Math.min(zMin, lm[i].z);
    zMax = Math.max(zMax, lm[i].z);
  }
  const span = Math.max(
    wcDist2(lm[0], lm[9]),
    wcDist2(lm[5], lm[17]),
    WC_EPS
  );
  return (zMax - zMin) / span > 0.72;
}

function wcMakePoints(lm) {
  const raw = [
    lm[WC_POINT_IDS[0]],
    lm[WC_POINT_IDS[1]],
    lm[WC_POINT_IDS[2]],
    lm[WC_POINT_IDS[3]],
    lm[WC_POINT_IDS[4]],
    wcMid(lm[0], lm[9]),
    wcMid(lm[5], lm[17]),
    wcCentroid3(lm[0], lm[5], lm[17]),
  ];

  /*
   * MediaPipeの映像座標はカメラ画像基準。
   * ユーザーが鏡を見る感覚に合わせ、ここでxだけ一度反転する。
   */
  return raw.map((p, id) => ({
    id,
    x: wcClamp(1 - p.x, 0, 1),
    y: wcClamp(p.y, 0, 1),
  }));
}

function wcEmptySample(state, score, inferHz) {
  return {
    valid: false,
    timestamp: 0,
    points: [],
    press: 0,
    state,
    score: score || 0,
    inferHz,
  };
}

export function createWebcamHand(opts) {
  if (!opts || !opts.tune) {
    throw new Error("webcamHand: tuneが指定されていません");
  }

  const wcTune = opts.tune;
  const wcMediaPipeDir = opts.mediapipeDir || "./lib/mediapipe";
  const wcOnStatus = typeof opts.onStatus === "function" ? opts.onStatus : () => {};
  const wcOnError = typeof opts.onError === "function" ? opts.onError : () => {};

  let wcVideo = null;
  let wcStream = null;
  let wcLandmarker = null;
  let wcInitPromise = null;
  let wcStartPromise = null;

  let wcRunning = false;
  let wcGeneration = 0;
  let wcRvfcId = 0;
  let wcRafId = 0;
  let wcFrameReady = false;
  let wcLastVideoTime = -1;
  let wcLastInferAt = -Infinity;
  let wcCurrentInferHz = Number(wcTune.wcInferHz) || 24;
  let wcSlowInferCount = 0;
  let wcLastInferMs = 0;

  let wcState = "NO_HAND";
  let wcStateSince = performance.now();
  let wcLastSeenAt = 0;
  let wcLastAcceptedAt = 0;
  let wcLastFilterAt = 0;
  let wcLastRawLandmarks = null;
  let wcLastScale = 0;
  let wcL0 = 0;
  let wcCalibrationScales = [];
  let wcPressActive = false;
  let wcPress = 0;
  let wcScore = 0;
  let wcLastError = "";
  let wcLastRejectReason = "未開始";
  let wcSample = wcEmptySample(wcState, 0, wcCurrentInferHz);

  const wcFilters = wcCreateLandmarkFilters(wcTune);

  function wcSetState(next, now, message) {
    if (wcState === next) return;
    wcState = next;
    wcStateSince = now;
    if (message) wcOnStatus(message);
  }

  function wcInvalidate(reason) {
    wcLastRejectReason = reason || "無効";
    wcSample = wcEmptySample(wcState, wcScore, wcCurrentInferHz);
  }

  function wcVideoUsable() {
    const track = wcStream && wcStream.getVideoTracks
      ? wcStream.getVideoTracks()[0]
      : null;

    return !!(
      wcRunning &&
      wcVideo &&
      wcVideo.readyState >= 2 &&
      wcVideo.videoWidth > 0 &&
      wcVideo.videoHeight > 0 &&
      track &&
      track.readyState === "live" &&
      !track.muted
    );
  }

  function wcWaitForVideoSize(video, generation) {
    return new Promise((resolve, reject) => {
      const started = performance.now();

      function check() {
        if (!wcRunning || generation !== wcGeneration) {
          reject(new Error("カメラ開始が中断されました"));
          return;
        }
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
          resolve();
          return;
        }
        if (performance.now() - started > 10000) {
          reject(new Error("カメラ映像の準備が時間内に完了しませんでした"));
          return;
        }
        requestAnimationFrame(check);
      }

      check();
    });
  }

  async function wcEnsureLandmarker(generation) {
    if (wcLandmarker) return wcLandmarker;
    if (wcInitPromise) return wcInitPromise;

    wcInitPromise = (async () => {
      /*
       * static importにするとMediaPipe資産の問題でページ全体が即死するため、
       * カメラ利用時だけローカルESモジュールを読み込む。
       */
      const wcVision = await import("./mediapipe/vision_bundle.mjs");
      if (!wcRunning || generation !== wcGeneration) {
        throw new Error("MediaPipe初期化が中断されました");
      }

      const wcFiles = await wcVision.FilesetResolver.forVisionTasks(wcMediaPipeDir);
      if (!wcRunning || generation !== wcGeneration) {
        throw new Error("MediaPipe初期化が中断されました");
      }

      const created = await wcVision.HandLandmarker.createFromOptions(wcFiles, {
        baseOptions: {
          modelAssetPath: `${wcMediaPipeDir}/hand_landmarker.task`,
        },
        runningMode: "VIDEO",
        numHands: 1,
        // v7 rev3: 0.55は厳しすぎて「一瞬しか認識しない」の一因だった。既定(0.5)より緩めに。
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });

      if (!wcRunning || generation !== wcGeneration) {
        try { created.close(); } catch (_) {}
        throw new Error("MediaPipe初期化が中断されました");
      }

      wcLandmarker = created;
      return wcLandmarker;
    })();

    try {
      return await wcInitPromise;
    } catch (e) {
      wcInitPromise = null;
      throw e;
    }
  }

  function wcScheduleVideoFrames(generation) {
    if (!wcVideo || !wcRunning || generation !== wcGeneration) return;

    if (typeof wcVideo.requestVideoFrameCallback === "function") {
      const onFrame = () => {
        if (!wcRunning || generation !== wcGeneration) return;
        wcFrameReady = true;
        wcRvfcId = wcVideo.requestVideoFrameCallback(onFrame);
      };
      wcRvfcId = wcVideo.requestVideoFrameCallback(onFrame);
    }
  }

  function wcHandleNoHand(now) {
    wcScore = 0;

    if (wcState === "READY" || wcState === "ACQUIRING" || wcState === "CALIBRATING") {
      wcSetState("LOST", now, "手を見失いました");
    }

    if (wcState === "LOST") {
      const holdMs = Math.max(0, Number(wcTune.wcHold) || 0) * 1000;
      if (now - wcLastSeenAt <= holdMs && wcSample.points.length === 8) {
        /*
         * LOST猶予中は最後の8点を固定保持する。
         * 新しい推論結果ではないためtimestampは更新しない。
         */
        wcSample = {
          ...wcSample,
          valid: true,
          state: "LOST",
          score: 0,
          inferHz: wcCurrentInferHz,
        };
        return;
      }

      wcSetState("NO_HAND", now, "手が画面外です");
    }

    if (wcState === "NO_HAND") wcInvalidate("手が画面外");
  }

  function wcHandleAcceptedLandmarks(rawLandmarks, score, now) {
    const scale = wcHandScale(rawLandmarks);
    const edge = wcAtScreenEdge(rawLandmarks, 0.012);
    const motion = wcLandmarkMotion(wcLastRawLandmarks, rawLandmarks);
    const scaleJump = wcLastScale > WC_EPS
      ? Math.abs(scale / wcLastScale - 1)
      : 0;

    wcScore = score;
    wcLastSeenAt = now;

    /*
     * v7 rev3: 合格ラインを大幅に緩和。厳しすぎるゲートが正常フレームまで捨てて
     * 「一瞬しか反応しない」を作っていた。異常はSchmitt+One Euro側が吸収する。
     */
    const basicValid =
      score >= 0.30 &&
      Number.isFinite(scale) &&
      scale > 0.010 &&
      scale < 1.8 &&
      !edge &&
      scaleJump < 0.45;

    if (!basicValid) {
      if (edge) wcLastRejectReason = "手が画面端です";
      else if (score < 0.30) wcLastRejectReason = "認識スコア不足";
      else if (scaleJump >= 0.45) wcLastRejectReason = "骨長が急変しました";
      else wcLastRejectReason = "手の大きさを取得できません";

      wcLastRawLandmarks = rawLandmarks;
      wcLastScale = scale;

      /*
       * 欠落・異常フレームでは固定IDを保つため結果全体を採用しない。
       * READY中の短い異常はLOST猶予へ移し、前回サンプルを保持する。
       */
      if (wcState === "READY") wcSetState("LOST", now, "手を安定して映してください");
      if (wcState === "LOST") {
        const holdMs = Math.max(0, Number(wcTune.wcHold) || 0) * 1000;
        if (now - wcLastAcceptedAt <= holdMs && wcSample.points.length === 8) {
          wcSample = { ...wcSample, valid: true, state: "LOST", score };
          return;
        }
      }

      if (wcState !== "READY") wcInvalidate(wcLastRejectReason);
      return;
    }

    if (wcState === "NO_HAND" || wcState === "LOST") {
      wcCalibrationScales = [];
      wcPressActive = false;
      wcPress = 0;

      /*
       * v7 rev3: 一度キャリブレーション済み(wcL0あり)なら即READYへ復帰する。
       * 旧実装は見失うたびに毎回1秒の再キャリブが走り、
       * 「一瞬しか反応しない」体感の主犯だった。基準の取り直しは再調整ボタンで。
       */
      if (wcL0 > WC_EPS) {
        wcSetState("READY", now, null);
        wcResetFilters(wcFilters, rawLandmarks);
        wcLastFilterAt = now;
      } else {
        wcSetState("ACQUIRING", now, "手を画面中央で構えてください");
      }
    }

    if (wcState === "ACQUIRING") {
      if (now - wcStateSince >= 250) {
        wcCalibrationScales = [];
        wcSetState("CALIBRATING", now, "その位置で手を静かに構えてください");
      }
    }

    if (wcState === "CALIBRATING") {
      /*
       * キャリブレーション中だけは静止条件を厳しくする。
       * 動いているフレームを基準値へ混ぜると、押し始め位置がずれる。
       */
      const stable = motion < 0.022 && scaleJump < 0.10;   // v7 rev3: 静止条件も緩和(厳しすぎて永遠に終わらない環境があった)
      if (stable) wcCalibrationScales.push(scale);

      if (now - wcStateSince >= 600) {
        if (wcCalibrationScales.length >= 4) {
          wcL0 = wcMedian(wcCalibrationScales);
          wcPressActive = false;
          wcPress = 0;
          wcSetState("READY", now, "準備OK。手をカメラへ近づけると押せます");
          wcResetFilters(wcFilters, rawLandmarks);
          wcLastFilterAt = now;
        } else {
          wcCalibrationScales = [];
          wcStateSince = now;
          wcOnStatus("手を少し静かに構えてください");
        }
      }
    }

    if (wcState !== "READY") {
      wcLastRawLandmarks = rawLandmarks;
      wcLastScale = scale;
      wcInvalidate(wcLastRejectReason || "準備中");
      return;
    }

    const dt = wcLastFilterAt > 0 ? (now - wcLastFilterAt) / 1000 : 1 / 30;
    const filtered = wcFilterLandmarks(
      wcFilters,
      rawLandmarks,
      wcClamp(dt, 1 / 120, 0.1)
    );
    wcLastFilterAt = now;

    const filteredScale = wcHandScale(filtered);
    const rawRatio = 1 - wcL0 / Math.max(filteredScale, WC_EPS);
    const onRatio = Number(wcTune.wcPressOnRatio) || 0.08;
    const offRatio = Number(wcTune.wcPressOffRatio) || 0.03;
    const fullRatio = Math.max(onRatio + 0.001, Number(wcTune.wcPressFullRatio) || 0.35);
    const tilted = wcPalmTooTilted(filtered);

    if (!tilted) {
      if (wcPressActive) {
        if (rawRatio < offRatio) wcPressActive = false;
      } else if (rawRatio > onRatio) {
        wcPressActive = true;
      }

      wcPress = wcPressActive
        ? wcClamp(rawRatio / fullRatio, 0, 1)
        : 0;
    } else {
      wcLastRejectReason = "掌の傾きが大きいため押し込み量を保持";
    }

    const points = wcMakePoints(filtered);
    if (points.length !== 8 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      wcLastRejectReason = "固定8点を生成できません";
      wcLastRawLandmarks = rawLandmarks;
      wcLastScale = scale;
      return;
    }

    wcLastAcceptedAt = now;
    wcLastRejectReason = "";
    wcSample = {
      valid: true,
      timestamp: now,
      points,
      press: wcPress,
      state: wcState,
      score,
      inferHz: wcCurrentInferHz,
    };

    wcLastRawLandmarks = rawLandmarks;
    wcLastScale = scale;
  }

  function wcProcessResult(result, now) {
    const hands = result && result.landmarks;
    if (!hands || hands.length < 1) {
      wcHandleNoHand(now);
      return;
    }

    const lm = hands[0];
    if (!lm || lm.length !== WC_LANDMARK_COUNT) {
      /*
       * 21点の一部だけを採用すると固定IDが別の指へ移るため、
       * フレーム全体を不採用にする。
       */
      wcLastRejectReason = "ランドマークが21点揃っていません";
      wcHandleNoHand(now);
      return;
    }

    for (let i = 0; i < WC_LANDMARK_COUNT; i++) {
      const p = lm[i];
      if (
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        !Number.isFinite(p.z)
      ) {
        wcLastRejectReason = "ランドマークに不正値があります";
        wcHandleNoHand(now);
        return;
      }
    }

    const handedness = result.handedness && result.handedness[0];
    const score = handedness && handedness[0] && Number.isFinite(handedness[0].score)
      ? handedness[0].score
      : 1;

    wcHandleAcceptedLandmarks(lm, score, now);
  }

  function wcInferPump(generation) {
    if (!wcRunning || generation !== wcGeneration) return;

    wcRafId = requestAnimationFrame(() => wcInferPump(generation));

    if (!wcVideoUsable() || !wcLandmarker) return;

    /*
     * rVFC対応時は新しい映像フレームが来た印がある時だけ推論する。
     * 非対応時はcurrentTimeの変化を新フレーム判定に使う。
     */
    if (typeof wcVideo.requestVideoFrameCallback === "function") {
      if (!wcFrameReady) return;
    } else if (wcVideo.currentTime === wcLastVideoTime) {
      return;
    }

    const now = performance.now();
    const interval = 1000 / Math.max(1, wcCurrentInferHz);
    if (now - wcLastInferAt < interval) return;
    if (wcVideo.currentTime === wcLastVideoTime) return;

    wcFrameReady = false;
    wcLastVideoTime = wcVideo.currentTime;
    wcLastInferAt = now;

    try {
      const started = performance.now();
      const result = wcLandmarker.detectForVideo(wcVideo, now);
      wcLastInferMs = performance.now() - started;

      if (wcLastInferMs > 25) wcSlowInferCount++;
      else wcSlowInferCount = Math.max(0, wcSlowInferCount - 1);

      if (wcSlowInferCount >= 5 && wcCurrentInferHz > 15) {
        wcCurrentInferHz = 15;
        wcSlowInferCount = 0;
        wcOnStatus("処理を安定させるため手認識を15fpsに調整しました");
      }

      wcProcessResult(result, performance.now());
    } catch (e) {
      wcLastError = e && e.message ? e.message : String(e);
      wcInvalidate("推論エラー");
      wcOnError(`手認識に失敗しました：${wcLastError}`);
      stop();
    }
  }

  async function start() {
    if (wcRunning && wcVideoUsable()) return;
    if (wcStartPromise) return wcStartPromise;

    wcStartPromise = (async () => {
      if (!window.isSecureContext) {
        throw new Error("カメラはHTTPSまたはlocalhostで開いた時だけ利用できます");
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("このブラウザはWebカメラに対応していません");
      }

      const generation = ++wcGeneration;
      wcRunning = true;
      wcLastError = "";
      wcLastRejectReason = "準備中";
      wcCurrentInferHz = Number(wcTune.wcInferHz) || 24;
      wcSlowInferCount = 0;
      wcLastVideoTime = -1;
      wcLastInferAt = -Infinity;
      wcFrameReady = false;
      wcState = "NO_HAND";
      wcStateSince = performance.now();
      wcSample = wcEmptySample(wcState, 0, wcCurrentInferHz);

      try {
        wcOnStatus("カメラを準備しています");

        wcStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },   // v7 rev3: 960→1280。離れた手の認識率は解像度が効く
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        });

        if (!wcRunning || generation !== wcGeneration) {
          for (const track of wcStream.getTracks()) track.stop();
          throw new Error("カメラ開始が中断されました");
        }

        wcVideo = document.createElement("video");
        wcVideo.playsInline = true;
        wcVideo.muted = true;
        wcVideo.autoplay = true;
        wcVideo.srcObject = wcStream;

        const track = wcStream.getVideoTracks()[0];
        if (track) {
          track.addEventListener("ended", () => {
            if (!wcRunning || generation !== wcGeneration) return;
            wcLastError = "カメラが停止しました";
            wcInvalidate("カメラ停止");
            wcOnError("カメラが停止しました");
            stop();
          }, { once: true });
        }

        await wcVideo.play();
        await wcWaitForVideoSize(wcVideo, generation);
        await wcEnsureLandmarker(generation);

        if (!wcRunning || generation !== wcGeneration) {
          throw new Error("カメラ開始が中断されました");
        }

        wcScheduleVideoFrames(generation);
        wcInferPump(generation);
        wcOnStatus("カメラ準備OK。手を画面中央で構えてください");
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        wcLastError = msg;
        await stop();
        wcOnError(`カメラを開始できませんでした：${msg}`);
        throw e;
      }
    })();

    try {
      return await wcStartPromise;
    } finally {
      wcStartPromise = null;
    }
  }

  async function stop() {
    wcRunning = false;
    wcGeneration++;

    if (wcVideo && wcRvfcId && typeof wcVideo.cancelVideoFrameCallback === "function") {
      try { wcVideo.cancelVideoFrameCallback(wcRvfcId); } catch (_) {}
    }
    wcRvfcId = 0;

    if (wcRafId) cancelAnimationFrame(wcRafId);
    wcRafId = 0;

    if (wcStream) {
      for (const track of wcStream.getTracks()) {
        try { track.stop(); } catch (_) {}
      }
    }

    if (wcVideo) {
      try { wcVideo.pause(); } catch (_) {}
      wcVideo.srcObject = null;
      wcVideo.removeAttribute("src");
      try { wcVideo.load(); } catch (_) {}
    }

    if (wcLandmarker) {
      try { wcLandmarker.close(); } catch (_) {}
    }

    wcLandmarker = null;
    wcInitPromise = null;
    wcStream = null;
    wcVideo = null;
    wcFrameReady = false;
    wcLastVideoTime = -1;
    wcState = "NO_HAND";
    wcStateSince = performance.now();
    wcLastSeenAt = 0;
    wcLastAcceptedAt = 0;
    wcLastFilterAt = 0;
    wcLastRawLandmarks = null;
    wcLastScale = 0;
    wcL0 = 0;
    wcCalibrationScales = [];
    wcPressActive = false;
    wcPress = 0;
    wcScore = 0;
    wcSample = wcEmptySample(wcState, 0, wcCurrentInferHz);
  }

  function recalibrate() {
    const now = performance.now();
    wcL0 = 0;
    wcCalibrationScales = [];
    wcPressActive = false;
    wcPress = 0;
    wcLastRawLandmarks = null;
    wcLastScale = 0;
    wcLastFilterAt = 0;
    wcSetState("NO_HAND", now, "再調整します。手を画面中央で構えてください");
    wcInvalidate("再キャリブレーション中");
  }

  function getSample() {
    /*
     * 呼び出し側が状態表示を更新できるよう、現在状態だけは常に最新化する。
     * timestampは新しい正常推論を採用した時だけ更新する。
     */
    return {
      valid: !!wcSample.valid,
      timestamp: wcSample.timestamp,
      points: wcSample.points.map(p => ({ id: p.id, x: p.x, y: p.y })),
      press: wcSample.press,
      state: wcState,
      score: wcScore,
      inferHz: wcCurrentInferHz,
    };
  }

  function getVideo() {
    return wcVideo;
  }

  function getState() {
    return {
      running: wcRunning,
      state: wcState,
      score: wcScore,
      press: wcPress,
      pressActive: wcPressActive,
      inferHz: wcCurrentInferHz,
      inferMs: wcLastInferMs,
      baseline: wcL0,
      timestamp: wcSample.timestamp,
      lastAcceptedAt: wcLastAcceptedAt,
      rejectReason: wcLastRejectReason,
      error: wcLastError,
      videoReady: wcVideoUsable(),
      videoW: wcVideo ? wcVideo.videoWidth : 0,   // カメラ性能の切り分け用(解像度が低いと遠い手が写らない)
      videoH: wcVideo ? wcVideo.videoHeight : 0,
    };
  }

  return {
    start,
    stop,
    recalibrate,
    getSample,
    getVideo,
    getState,
  };
}
