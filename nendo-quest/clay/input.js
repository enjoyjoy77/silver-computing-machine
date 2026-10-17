import { sub, add, mul, len, mix, clamp, dot, cross, unit } from "./math.js";
const FINGERS = [
  [
    "thumb-metacarpal",
    "thumb-phalanx-proximal",
    "thumb-phalanx-distal",
    "thumb-tip",
  ],
  ...["index", "middle", "ring", "pinky"].map((f) => [
    `${f}-finger-metacarpal`,
    `${f}-finger-phalanx-proximal`,
    `${f}-finger-phalanx-intermediate`,
    `${f}-finger-phalanx-distal`,
    `${f}-finger-tip`,
  ]),
];
export function emptyHands() {
  return new Float32Array(40);
}
function record(a, b, oldA, oldB, r, side, pinch = false, grab = false) {
  return [
    ...a,
    r,
    ...b,
    0,
    ...oldA,
    r,
    ...oldB,
    0,
    grab ? 0 : 1,
    side,
    1,
    pinch ? 1 : 0,
  ];
}
export class HandInput {
  constructor() {
    this.previous = new Map();
    this.pinching = [false, false];
    this.toLocal = (p) => p;
    this.tips = [];
    this.lastTime = 0;
  }
  clear() {
    this.previous.clear();
    this.pinching = [false, false];
    this.lastTime = 0;
    this.tips = [];
  }
  update(frame, space, time) {
    const gap = (time - this.lastTime) / 1000,
      dt = clamp(gap, 0.001, 0.1);
    if (gap > 0.1) this.clear();
    this.lastTime = time;
    const out = Array(40).fill(0),
      capsules = [];
    this.tips = [];
    const seen = new Set();
    for (const source of frame.session.inputSources) {
      if (!source.hand) continue;
      const side = source.handedness === "left" ? 0 : 1,
        points = new Map();
      for (const [name, joint] of source.hand) {
        const pose = frame.getJointPose(joint, space);
        if (!pose) continue;
        const p = this.toLocal([
            pose.transform.position.x,
            pose.transform.position.y,
            pose.transform.position.z,
          ]),
          key = `${side}:${name}`,
          previous = this.previous.get(key),
          delta = previous ? sub(p, previous) : [0, 0, 0];
        const limited = previous
          ? add(
              previous,
              mul(delta, Math.min(1, (0.9 * dt) / Math.max(len(delta), 1e-9))),
            )
          : p;
        this.previous.set(key, limited);
        seen.add(key);
        points.set(name, {
          p: limited,
          old: previous ?? limited,
          r: clamp(pose.radius ?? 0.008, 0.005, 0.013),
        });
      }
      const thumb = points.get("thumb-tip"),
        index = points.get("index-finger-tip");
      if (thumb && index) {
        const span = len(sub(thumb.p, index.p));
        this.pinching[side] = span < (this.pinching[side] ? 0.034 : 0.026);
        const center = mix(thumb.p, index.p, 0.5),
          old = mix(thumb.old, index.old, 0.5);
        out.splice(
          side * 20,
          20,
          ...record(
            center,
            center,
            old,
            old,
            0.018,
            side,
            this.pinching[side],
            true,
          ),
        );
        this.tips.push(index.p);
      } else this.pinching[side] = false;
      for (const names of FINGERS) {
        for (let j = 0; j < names.length - 1; j++) {
          const a = points.get(names[j]),
            b = points.get(names[j + 1]);
          if (a && b)
            capsules.push(
              record(a.p, b.p, a.old, b.old, (a.r + b.r) * 0.5, side),
            );
        }
      }
      const wrist = points.get("wrist");
      for (const name of [
        "index-finger-metacarpal",
        "middle-finger-metacarpal",
        "pinky-finger-metacarpal",
      ]) {
        const p = points.get(name);
        if (wrist && p)
          capsules.push(record(wrist.p, p.p, wrist.old, p.old, 0.016, side));
      }
    }
    for (const key of this.previous.keys())
      if (!seen.has(key)) this.previous.delete(key);
    const result = new Float32Array([...out, ...capsules.flat()]);
    result.sampleDt = dt;
    return result;
  }
}
export class DesktopInput {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.tools = [null, null];
    this.previous = [null, null];
    this.active = 0;
    this.depth = 0.035;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      this.active = e.button === 2 ? 1 : 0;
      this.tools[this.active] = {
        p: this.point(e),
        pinch: e.shiftKey || e.button === 2,
      };
      this.previous[this.active] = null;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.tools[this.active]) this.tools[this.active].p = this.point(e);
    });
    const release = () => {
      this.tools[this.active] = null;
      this.previous[this.active] = null;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    window.addEventListener("blur", () => {
      this.tools = [null, null];
      this.previous = [null, null];
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.depth = clamp(this.depth + e.deltaY * 0.0001, -0.08, 0.08);
        if (this.tools[this.active]) this.tools[this.active].p = this.point(e);
      },
      { passive: false },
    );
  }
  point(e) {
    const rect = this.canvas.getBoundingClientRect(),
      sx =
        ((((e.clientX - rect.left) / rect.width) * 2 - 1) * rect.width) /
        rect.height,
      sy = 1 - ((e.clientY - rect.top) / rect.height) * 2;
    const c = this.camera,
      forward = unit(sub(c.target, c.eye)),
      right = unit(cross(forward, [0, 1, 0])),
      up = cross(right, forward),
      ray = unit(
        add(
          forward,
          add(
            mul(right, sx * Math.tan(c.fov / 2)),
            mul(up, sy * Math.tan(c.fov / 2)),
          ),
        ),
      );
    const t = (this.depth - c.eye[2]) / ray[2];
    return add(c.eye, mul(ray, t));
  }
  update(dt) {
    const out = Array(40).fill(0),
      capsules = [];
    for (let i = 0; i < 2; i++) {
      const tool = this.tools[i];
      if (!tool) continue;
      const previous = this.previous[i] ?? add(tool.p, [0, 0, 0.035]),
        delta = sub(tool.p, previous),
        p = add(
          previous,
          mul(delta, Math.min(1, (0.6 * dt) / Math.max(len(delta), 1e-8))),
        );
      this.previous[i] = p;
      out.splice(
        i * 20,
        20,
        ...record(p, p, previous, previous, 0.018, i, tool.pinch, true),
      );
      if (!tool.pinch)
        capsules.push(
          record(
            p,
            add(p, [0, 0.025, 0]),
            previous,
            add(previous, [0, 0.025, 0]),
            0.013,
            i,
          ),
        );
    }
    const result = new Float32Array([...out, ...capsules.flat()]);
    result.sampleDt = dt;
    return result;
  }
}
// The same collider format drives deterministic tests and tracked hands.
export function scriptedHands(tools) {
  const out = Array(40).fill(0),
    capsules = [];
  tools.forEach((t, i) => {
    const previous = t.old ?? t.p;
    out.splice(
      i * 20,
      20,
      ...record(
        t.p,
        t.p,
        previous,
        previous,
        t.radius ?? 0.018,
        i,
        !!t.pinch,
        true,
      ),
    );
    if (t.push)
      capsules.push(
        record(
          t.p,
          t.end ?? t.p,
          previous,
          t.oldEnd ?? t.end ?? previous,
          t.radius ?? 0.016,
          i,
        ),
      );
    if (t.fingers)
      for (const sign of [-1, 1]) {
        const p = add(t.p, [0, (sign * (t.span ?? 0.024)) / 2, 0]),
          old = add(previous, [
            0,
            (sign * (t.oldSpan ?? t.span ?? 0.024)) / 2,
            0,
          ]);
        capsules.push(record(p, p, old, old, 0.006, i));
      }
  });
  return new Float32Array([...out, ...capsules.flat()]);
}
