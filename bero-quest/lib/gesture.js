// Quest 3 WebXR 手ジェスチャー操作モジュール(Codex実装)。
// THREE は呼び出し側から注入する。このモジュール自体は import を持たない。

export function createHandGestureController(THREE, options = {}) {
  if (!THREE) throw new TypeError("THREE is required");

  const onCommand =
    typeof options.onCommand === "function" ? options.onCommand : () => {};
  const onSize =
    typeof options.onSize === "function" ? options.onSize : () => {};
  const onReset =
    typeof options.onReset === "function" ? options.onReset : () => {};
  const onStatus =
    typeof options.onStatus === "function" ? options.onStatus : () => {};

  const clamp = THREE.MathUtils.clamp;
  const lerp = THREE.MathUtils.lerp;

  const JOINTS = [
    "wrist",
    "thumb-tip",
    "index-finger-metacarpal",
    "index-finger-phalanx-proximal",
    "index-finger-tip",
    "middle-finger-phalanx-proximal",
    "middle-finger-tip",
    "ring-finger-phalanx-proximal",
    "ring-finger-tip",
    "pinky-finger-metacarpal",
    "pinky-finger-phalanx-proximal",
    "pinky-finger-tip"
  ];

  const FINGERS = [
    ["index-finger-phalanx-proximal", "index-finger-tip"],
    ["middle-finger-phalanx-proximal", "middle-finger-tip"],
    ["ring-finger-phalanx-proximal", "ring-finger-tip"],
    ["pinky-finger-phalanx-proximal", "pinky-finger-tip"]
  ];

  const poses = [new Map(), new Map()];
  const hands = [
    {
      valid: false,
      handedness: "none",
      wrist: new THREE.Vector3(),
      indexBase: new THREE.Vector3(),
      pinkyBase: new THREE.Vector3(),
      palmWidth: 0.08,
      pinch: 0,
      openness: 0
    },
    {
      valid: false,
      handedness: "none",
      wrist: new THREE.Vector3(),
      indexBase: new THREE.Vector3(),
      pinkyBase: new THREE.Vector3(),
      palmWidth: 0.08,
      pinch: 0,
      openness: 0
    }
  ];

  const anchor = new THREE.Vector3();
  const filteredPosition = new THREE.Vector3();
  const palmAcross = new THREE.Vector3();
  const temp = new THREE.Vector3();

  const command = { ext: 0, ud: 0, lr: 0, tw: 0, cl: 0 };
  const target = { ext: 0, ud: 0, lr: 0, tw: 0, cl: 0 };

  let enabled = true;
  let controlling = false;
  let anchorValid = false;
  let lastTime = 0;
  let openSince = 0;
  let fistSince = 0;
  let resetLatched = false;
  let spanBase = 0;
  let sizeCandidate = 0;
  let sizeCandidateSince = 0;
  let lastSize = 0;
  let missingFrames = 0;

  function smoothstep(edge0, edge1, value) {
    const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return x * x * (3 - 2 * x);
  }

  function readHand(source, frame, referenceSpace, slot) {
    const hand = hands[slot];
    const map = poses[slot];

    hand.valid = false;
    map.clear();

    if (!source || !source.hand || !frame || !referenceSpace) return hand;

    for (const name of JOINTS) {
      const joint = source.hand.get(name);
      if (!joint) continue;

      const pose = frame.getJointPose(joint, referenceSpace);
      if (!pose) continue;

      const p = pose.transform.position;
      map.set(name, new THREE.Vector3(p.x, p.y, p.z));
    }

    const wrist = map.get("wrist");
    const thumbTip = map.get("thumb-tip");
    const indexTip = map.get("index-finger-tip");
    const indexBase =
      map.get("index-finger-metacarpal") ||
      map.get("index-finger-phalanx-proximal");
    const pinkyBase =
      map.get("pinky-finger-metacarpal") ||
      map.get("pinky-finger-phalanx-proximal");

    if (!wrist || !thumbTip || !indexTip || !indexBase || !pinkyBase) {
      return hand;
    }

    hand.valid = true;
    hand.handedness = source.handedness || "none";
    hand.wrist.copy(wrist);
    hand.indexBase.copy(indexBase);
    hand.pinkyBase.copy(pinkyBase);
    hand.palmWidth = Math.max(0.035, indexBase.distanceTo(pinkyBase));

    const pinchRatio = thumbTip.distanceTo(indexTip) / hand.palmWidth;
    hand.pinch = 1 - smoothstep(0.28, 0.82, pinchRatio);

    let extensionSum = 0;
    let extensionCount = 0;

    for (const [baseName, tipName] of FINGERS) {
      const base = map.get(baseName);
      const tip = map.get(tipName);
      if (!base || !tip) continue;

      const baseDistance = Math.max(0.015, wrist.distanceTo(base));
      extensionSum += wrist.distanceTo(tip) / baseDistance;
      extensionCount++;
    }

    const extension =
      extensionCount > 0 ? extensionSum / extensionCount : 1;
    hand.openness = smoothstep(1.18, 1.82, extension);
    return hand;
  }

  function chooseControlHand() {
    const valid = hands.filter(hand => hand.valid);
    if (!valid.length) return null;

    return (
      valid.find(hand => hand.handedness === "right") ||
      valid.find(hand => hand.handedness === "left") ||
      valid[0]
    );
  }

  function emitNeutral() {
    target.ext = 0;
    target.ud = 0;
    target.lr = 0;
    target.tw = 0;
    target.cl = 0;

    command.ext = 0;
    command.ud = 0;
    command.lr = 0;
    command.tw = 0;
    command.cl = 0;

    onCommand({ ...command });
  }

  function updateSizeGesture(now) {
    if (!hands[0].valid || !hands[1].valid) {
      spanBase = 0;
      sizeCandidate = 0;
      return;
    }

    const span = hands[0].wrist.distanceTo(hands[1].wrist);
    const bothOpen =
      hands[0].openness > 0.68 && hands[1].openness > 0.68;

    if (!bothOpen) {
      spanBase = 0;
      sizeCandidate = 0;
      return;
    }

    if (!spanBase) spanBase = clamp(span, 0.16, 0.46);

    const normalized = clamp((span - 0.14) / 0.34, 0, 1);
    const candidate = 1 + Math.round(normalized * 19); // ながさ20段階

    if (candidate !== sizeCandidate) {
      sizeCandidate = candidate;
      sizeCandidateSince = now;
      return;
    }

    if (
      candidate !== lastSize &&
      now - sizeCandidateSince >= 280
    ) {
      lastSize = candidate;
      onSize(candidate);
      onStatus(`両手の間隔でサイズを ${candidate} に変更しました。`);
    }
  }

  function updateResetGesture(controlHand, now) {
    const fist =
      controlHand &&
      controlHand.openness < 0.18 &&
      controlHand.pinch > 0.42;

    if (!fist) {
      fistSince = 0;
      resetLatched = false;
      return;
    }

    if (!fistSince) fistSince = now;

    if (!resetLatched && now - fistSince >= 700) {
      resetLatched = true;
      anchorValid = false;
      onReset();
      onStatus("握りこぶしを検出して操作値をリセットしました。");
    }
  }

  function update(frame, referenceSpace, inputSources, time) {
    if (!enabled) return false;

    const now = Number.isFinite(time) ? time : performance.now();
    const dt = lastTime
      ? clamp((now - lastTime) / 1000, 1 / 120, 1 / 20)
      : 1 / 72;
    lastTime = now;

    readHand(inputSources && inputSources[0], frame, referenceSpace, 0);
    readHand(inputSources && inputSources[1], frame, referenceSpace, 1);

    const controlHand = chooseControlHand();
    updateSizeGesture(now);
    updateResetGesture(controlHand, now);

    if (!controlHand) {
      missingFrames++;

      if (controlling && missingFrames >= 4) {
        controlling = false;
        anchorValid = false;
        openSince = 0;
        emitNeutral();
        onStatus("手ジェスチャー操作を終了しました。");
      }

      return false;
    }

    missingFrames = 0;

    if (!controlling) {
      controlling = true;
      anchorValid = false;
      onStatus("手ジェスチャー操作を開始しました。");
    }

    if (!anchorValid) {
      anchor.copy(controlHand.wrist);
      filteredPosition.copy(controlHand.wrist);
      anchorValid = true;
    }

    filteredPosition.lerp(
      controlHand.wrist,
      1 - Math.exp(-dt / 0.055)
    );

    if (controlHand.openness > 0.82 && controlHand.pinch < 0.16) {
      if (!openSince) openSince = now;

      if (now - openSince >= 450) {
        anchor.lerp(filteredPosition, 0.18);
      }
    } else {
      openSince = 0;
    }

    temp.copy(filteredPosition).sub(anchor);

    // 可動範囲(実機FBで2回拡大。この距離だけ手を動かすと指令が最大になる)
    target.lr = clamp(temp.x / 0.38, -1, 1);
    target.ud = clamp(temp.y / 0.38, -1, 1);
    target.ext = clamp(-temp.z / 0.45, -1, 1);
    target.cl = clamp(controlHand.pinch, 0, 1);

    palmAcross
      .copy(controlHand.indexBase)
      .sub(controlHand.pinkyBase)
      .normalize();

    const roll = Math.atan2(palmAcross.y, palmAcross.x);
    const handednessSign =
      controlHand.handedness === "left" ? -1 : 1;
    target.tw = clamp(roll / 0.9 * handednessSign, -1, 1);

    const gain = 1 - Math.exp(-dt / 0.05); // 反応を速く(ヨッシー感)

    for (const name of Object.keys(command)) {
      command[name] = lerp(command[name], target[name], gain);
      if (Math.abs(command[name]) < 0.004) command[name] = 0;
    }

    onCommand({ ...command });
    return true;
  }

  function reset() {
    controlling = false;
    anchorValid = false;
    openSince = 0;
    fistSince = 0;
    resetLatched = false;
    spanBase = 0;
    sizeCandidate = 0;
    missingFrames = 0;
    lastTime = 0;
    emitNeutral();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) reset();
  }

  return {
    update,
    reset,
    setEnabled,
    get enabled() {
      return enabled;
    },
    get active() {
      return controlling;
    },
    get command() {
      return { ...command };
    }
  };
}
