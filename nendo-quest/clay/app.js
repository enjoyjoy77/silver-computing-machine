import { Simulation } from "./simulation.js";
import { Renderer, BUTTONS } from "./renderer.js";
import { HandInput, DesktopInput, emptyHands } from "./input.js";
import { GpuTimer } from "./timer.js";
import { CompatibilityRenderer } from "./compat.js";
import {
  matmul,
  perspective,
  lookAt,
  identity,
  unit,
  sub,
  dot,
  cross,
  add,
  mul,
} from "./math.js";
const $ = (id) => document.getElementById(id),
  canvas = $("view");
const records = [],
  faultNames = {
    1: "材料の変形が不安定になりました",
    2: "作業範囲を超えました",
    4: "運動量の計算範囲を超えました",
    8: "材料の接続計算が収束しませんでした",
    16: "同じ場所に重なる断面が多すぎます",
    32: "材料の速度が不安定になりました",
    64: "表面の表示容量を超えました",
    128: "表面の探索容量を超えました",
  };
function log(message) {
  records.push({ time: new Date().toISOString(), message });
  if (records.length > 250) records.shift();
  $("log").textContent = records
    .slice(-10)
    .map((r) => r.message)
    .join("\n");
  console.info(message);
}
function notify(message) {
  $("message").textContent = message;
}
let sim,
  renderer,
  device,
  gpuTimer,
  compatRenderer,
  isCompat = false,
  platformFailed = false,
  session = null,
  binding,
  layer,
  space,
  placed = false,
  desktop = false,
  busy = false,
  lastFrame = 0,
  lastSimulation = 0,
  diagnosing = false,
  lastDiag = 0,
  failed = false;
let handInput = new HandInput(),
  desktopInput;
let mode = "待機";
let diag = {};
let frames = [],
  updates = [],
  cpuTimes = [];
let buttonDown = null,
  lastButton = 0;
const camera = {
  eye: [0.19, 0.18, 0.46],
  target: [0, -0.035, 0],
  fov: Math.PI / 4,
};
const capabilities = {
  secure: isSecureContext,
  webgpu: !!navigator.gpu,
  webxr: !!navigator.xr,
  xrGpuBinding: typeof XRGPUBinding !== "undefined",
};
function action(name) {
  if (!sim) return;
  if (name === "reset" || name === "two") {
    sim.reset(name === "two");
    failed = false;
    notify("");
    lastSimulation = 0;
    log(
      name === "two" ? "同じ素材の2つの塊に戻しました。" : "丸め直しました。",
    );
  }
  if (name === "mode") {
    sim.table = !sim.table;
    sim.pendingPlacement = true;
    $("mode").textContent = sim.table ? "空中に浮かべる" : "台に置く";
    log(sim.table ? "台モード" : "空中モード");
  }
}
$("reset").onclick = () => action("reset");
$("two").onclick = () => action("two");
$("mode").onclick = () => action("mode");
$("exit").onclick = async () => {
  if (session) await session.end();
  else {
    desktop = false;
    showWelcome();
  }
};
$("download").onclick = () => {
  const data = {
    version: "0.1.0",
    exportedAt: new Date().toISOString(),
    environment: capabilities,
    mode,
    diagnostics: diag,
    frameIntervals: frames,
    cpuTimes,
    gpuTimes: gpuTimer?.samples,
    compatibilityLatencyMs: compatRenderer?.latencyMs,
    records,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "nendo-quest-record.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function showWelcome() {
  $("welcome").hidden = false;
  $("toolbar").hidden = true;
  $("guide").hidden = true;
  renderer.model = identity();
  handInput.clear();
  lastFrame = 0;
  lastSimulation = 0;
  mode = "待機";
}
function showPlay() {
  $("welcome").hidden = true;
  $("toolbar").hidden = false;
  $("guide").hidden = false;
  notify("");
}
function setupStage(pose) {
  const m = pose.transform.matrix,
    z = unit([m[8], 0, m[10]]),
    x = cross([0, 1, 0], z),
    origin = add([m[12], m[13] - 0.28, m[14]], mul(z, -0.43));
  const model = identity();
  model.set([...x, 0], 0);
  model.set([0, 1, 0, 0], 4);
  model.set([...z, 0], 8);
  model.set([...origin, 1], 12);
  renderer.model = model;
  handInput.toLocal = (p) => {
    const d = sub(p, origin);
    return [dot(d, x), d[1], dot(d, z)];
  };
  placed = true;
}
function checkButtons(time) {
  let touched = null;
  for (const tip of handInput.tips)
    for (const b of BUTTONS) {
      if (
        Math.abs(tip[0] - b.x) < 0.052 &&
        Math.abs(tip[1] - b.y) < 0.018 &&
        Math.abs(tip[2] - b.z) < 0.019
      )
        touched = b.action;
    }
  if (touched && touched !== buttonDown && time - lastButton > 800) {
    action(touched);
    lastButton = time;
  }
  buttonDown = touched;
}
function percentile(a, p) {
  if (!a.length) return 0;
  const sorted = [...a].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}
function recordFrame(time, cpu, updated) {
  if (lastFrame && time - lastFrame < 200) {
    frames.push(time - lastFrame);
    if (frames.length > 720) frames.shift();
  }
  lastFrame = time;
  cpuTimes.push(cpu);
  if (cpuTimes.length > 720) cpuTimes.shift();
  if (updated) {
    updates.push(time);
    updates = updates.filter((t) => time - t < 1000);
  }
}
async function diagnostics(time) {
  if (diagnosing || time - lastDiag < 750) return;
  lastDiag = time;
  diagnosing = true;
  try {
    const next = await sim.diagnostics();
    if (!next) return;
    diag = next;
    if (diag.fault) {
      const messages = Object.entries(faultNames)
        .filter(([bit]) => diag.fault & Number(bit))
        .map(([, message]) => message);
      if (!messages.length) messages.push(`計算異常 ${diag.fault}`);
      notify(messages.join("\n") + "。丸め直して再開できます。");
      log(`停止: ${messages.join(" / ")}`);
      failed = true;
    }
    const mean = frames.length
      ? frames.reduce((a, b) => a + b, 0) / frames.length
      : 0;
    $("stats").textContent =
      `${mode}\n表示 ${mean ? (1000 / mean).toFixed(1) : "—"} fps / 更新 ${updates.length} 回/秒\nフレーム p95 ${percentile(frames, 0.95).toFixed(1)} ms\nCPU準備 p95 ${percentile(cpuTimes, 0.95).toFixed(1)} ms\nGPU p95 ${
        gpuTimer.samples.length
          ? percentile(
              gpuTimer.samples.map((s) => s.totalMs),
              0.95,
            ).toFixed(1) + " ms"
          : "未測定"
      }${isCompat ? "\n形状の転送 " + compatRenderer.latencyMs.toFixed(1) + " ms" : ""}\n材料点 ${diag.particles} / 表面 ${Math.round(diag.vertices / 3)} 三角形\n切れた接続 ${diag.brokenDirectedLinks} / 接合 ${diag.weldedDirectedLinks}\n計算時刻 ${diag.simulatedSeconds.toFixed(2)} 秒 / 未計算 ${diag.droppedSeconds.toFixed(2)} 秒\n容量待ち ${diag.weldCapacityEvents} / 異常 ${diag.fault}\n※PCの数値をQuestの性能とは扱いません。`;
  } catch (e) {
    log(`記録取得: ${e.message}`);
  } finally {
    diagnosing = false;
  }
}
function encodeSimulation(encoder, time, hands) {
  if (busy || failed) return false;
  const dt = lastSimulation
    ? Math.max(0.001, (time - lastSimulation) / 1000)
    : 1 / 72;
  lastSimulation = time;
  sim.encode(encoder, dt, hands, {
    timestampWrites: isCompat ? undefined : gpuTimer.begin(time),
  });
  return true;
}
function submitted(updated) {
  if (!updated) return;
  busy = true;
  device.queue
    .onSubmittedWorkDone()
    .then(() => {
      busy = false;
    })
    .catch(fatal);
  if (!isCompat) void gpuTimer.submitted().catch(fatal);
}
function desktopFrame(time) {
  requestAnimationFrame(desktopFrame);
  if (!renderer || session || platformFailed) return;
  const start = performance.now(),
    encoder = device.createCommandEncoder();
  const hands = desktop
    ? desktopInput.update(
        Math.min(0.05, lastFrame ? (time - lastFrame) / 1000 : 1 / 60),
      )
    : emptyHands();
  let updated = false;
  if (desktop || !sim.frame) updated = encodeSimulation(encoder, time, hands);
  renderer.updateScene(hands, sim.table);
  renderer.drawView(
    encoder,
    {
      ...renderer.desktopTarget(),
      vp: matmul(
        perspective(camera.fov, canvas.width / canvas.height),
        lookAt(camera.eye, camera.target),
      ),
      eye: camera.eye,
      timestampWrites: gpuTimer.renderWrites(),
    },
    sim,
  );
  gpuTimer.finish(encoder);
  device.queue.submit([encoder.finish()]);
  submitted(updated);
  if (desktop) {
    recordFrame(time, performance.now() - start, updated);
    void diagnostics(time);
  }
}
function xrFrame(time, frame) {
  if (!session || platformFailed) return;
  session.requestAnimationFrame(xrFrame);
  const start = performance.now();
  try {
    const pose = frame.getViewerPose(space);
    if (!pose || session.visibilityState === "hidden") {
      handInput.clear();
      lastSimulation = 0;
      return;
    }
    if (!placed) setupStage(pose);
    const hands = handInput.update(frame, space, time);
    checkButtons(time);
    const encoder = device.createCommandEncoder();
    const updated = encodeSimulation(encoder, time, hands);
    if (isCompat) {
      const captured = compatRenderer.capture(encoder, sim, time);
      device.queue.submit([encoder.finish()]);
      submitted(updated);
      if (captured) void compatRenderer.receive().catch(fatal);
      compatRenderer.update(hands, sim.table);
      compatRenderer.render(pose, layer, renderer.model);
      recordFrame(time, performance.now() - start, updated);
      void diagnostics(time);
      return;
    }
    renderer.updateScene(hands, sim.table);
    for (let i = 0; i < pose.views.length; i++) {
      const view = pose.views[i],
        subImage = binding.getViewSubImage(layer, view);
      const desc =
        typeof subImage.getViewDescriptor === "function"
          ? subImage.getViewDescriptor()
          : {
              dimension: "2d",
              baseArrayLayer: subImage.imageIndex ?? i,
              arrayLayerCount: 1,
            };
      const p = view.transform.position;
      renderer.drawView(
        encoder,
        {
          color: subImage.colorTexture.createView(desc),
          depth: subImage.depthStencilTexture.createView(desc),
          viewport: subImage.viewport,
          format: layerFormat,
          vp: matmul(view.projectionMatrix, view.transform.inverse.matrix),
          eye: [p.x, p.y, p.z],
          slot: i,
          clear: [0, 0, 0, 0],
          timestampWrites:
            i === pose.views.length - 1 ? gpuTimer.renderWrites() : undefined,
        },
        sim,
      );
    }
    gpuTimer.finish(encoder);
    device.queue.submit([encoder.finish()]);
    submitted(updated);
    recordFrame(time, performance.now() - start, updated);
    void diagnostics(time);
  } catch (e) {
    fatal(e);
    void session?.end();
  }
}
let layerFormat;
async function beginMR(compatibility = false) {
  if (!device || session) return;
  let started;
  try {
    // Request the session directly in the click handler, before unrelated async work.
    started = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: compatibility
        ? ["hand-tracking"]
        : ["webgpu", "hand-tracking"],
      optionalFeatures: ["local-floor"],
    });
    if (compatibility) {
      compatRenderer ??= await CompatibilityRenderer.create(
        device,
        sim.vertices.size,
      );
      layer = new XRWebGLLayer(started, compatRenderer.gl, {
        alpha: true,
        depth: true,
        framebufferScaleFactor: 0.75,
      });
      started.updateRenderState({
        baseLayer: layer,
        depthNear: 0.01,
        depthFar: 10,
      });
    } else {
      binding = new XRGPUBinding(started, device);
      layerFormat = binding.getPreferredColorFormat();
      layer = binding.createProjectionLayer({
        colorFormat: layerFormat,
        depthStencilFormat: "depth24plus",
        scaleFactor: 0.75,
      });
      started.updateRenderState({
        layers: [layer],
        depthNear: 0.01,
        depthFar: 10,
      });
    }
    try {
      space = await started.requestReferenceSpace("local-floor");
    } catch {
      space = await started.requestReferenceSpace("local");
    }
    session = started;
    isCompat = compatibility;
    placed = false;
    lastFrame = 0;
    lastSimulation = 0;
    handInput.clear();
    sim.reset();
    failed = false;
    frames = [];
    cpuTimes = [];
    updates = [];
    gpuTimer.samples = [];
    mode = compatibility
      ? "Quest / 互換表示（試験用）"
      : "Quest / WebGPU直接描画";
    showPlay();
    log("MR開始。両手をブラウザに見せてください。");
    if (compatibility)
      log(
        "互換表示は形状の転送による遅れがあります。速度・操作感の合格判定は実機で行います。",
      );
    session.addEventListener("end", () => {
      session = null;
      binding = null;
      layer = null;
      isCompat = false;
      desktop = false;
      showWelcome();
      log("MRを終了しました。");
    });
    session.addEventListener("visibilitychange", () => {
      handInput.clear();
      lastSimulation = 0;
      lastFrame = 0;
    });
    session.requestAnimationFrame(xrFrame);
  } catch (e) {
    await started?.end().catch(() => {});
    log(`MR開始失敗: ${e.name} ${e.message}`);
    notify(
      "MRを開始できませんでした。ブラウザの更新と手の追跡の許可を確認してください。\n詳細は「動作の記録」にあります。",
    );
  }
}
$("enter").onclick = () => beginMR(false);
$("compat").onclick = () => beginMR(true);
$("desktop").onclick = () => {
  desktop = true;
  renderer.model = identity();
  lastSimulation = 0;
  lastFrame = 0;
  mode = "PC確認 / WebGPU";
  showPlay();
  log("画面での確認を開始しました。Questでの操作感は別途確認が必要です。");
};
function fatal(e) {
  failed = true;
  platformFailed = true;
  const message = e?.message ?? String(e);
  log(message);
  notify(`動作を停止しました。${message}`);
  $("availability").textContent = message;
  $("enter").disabled = true;
  $("compat").disabled = true;
  $("desktop").disabled = true;
}
window.addEventListener("error", (e) => fatal(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => fatal(e.reason));
async function start() {
  try {
    if (!isSecureContext) throw Error("HTTPSで開いてください。");
    if (!navigator.gpu)
      throw Error(
        "このブラウザではGPU計算を利用できません。Questのブラウザを更新してください。",
      );
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
      xrCompatible: true,
    });
    if (!adapter) throw Error("GPUを開始できません。");
    device = await adapter.requestDevice({
      requiredFeatures: adapter.features.has("timestamp-query")
        ? ["timestamp-query"]
        : [],
    });
    gpuTimer = new GpuTimer(device);
    device.addEventListener("uncapturederror", (e) => fatal(e.error));
    device.lost.then((info) =>
      fatal(
        Error(
          `GPUとの接続が切れました。ページを開き直してください。${info.message}`,
        ),
      ),
    );
    capabilities.adapter = {
      vendor: adapter.info?.vendor,
      architecture: adapter.info?.architecture,
    };
    [sim, renderer] = await Promise.all([
      Simulation.create(device),
      Renderer.create(device, canvas),
    ]);
    desktopInput = new DesktopInput(canvas, camera);
    $("desktop").disabled = false;
    const ar =
      !!navigator.xr &&
      (await navigator.xr
        .isSessionSupported("immersive-ar")
        .catch(() => false));
    capabilities.immersiveAR = ar;
    $("enter").disabled = !(ar && capabilities.xrGpuBinding);
    $("compat").hidden = !ar;
    $("enter").textContent = "Questで手を使って始める";
    $("availability").textContent = ar
      ? capabilities.xrGpuBinding
        ? "準備できました。"
        : "通常の表示を利用できません。「別の表示方法」で試せます。形の更新に遅れが出る場合があります。"
      : "PCでは「画面で試す」から動きを確認できます。";
    log(
      `試作 0.1 / ${sim.count}材料点 / WebGPU ${capabilities.webgpu} / XRGPUBinding ${capabilities.xrGpuBinding}`,
    );
    requestAnimationFrame(desktopFrame);
    // Explicit test hook: no camera/microphone/network recording; only this simulation.
    if (new URLSearchParams(location.search).has("test"))
      window.clayTest = {
        sim,
        renderer,
        device,
        action,
        pause: () => {
          desktop = false;
          failed = true;
        },
        get mode() {
          return mode;
        },
      };
  } catch (e) {
    fatal(e);
  }
}
void start();
