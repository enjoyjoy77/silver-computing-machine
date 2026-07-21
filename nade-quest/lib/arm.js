// arm.js — 前腕(ひじの手前まで)を「それらしく」推測描画するための共通部品 v1 (2026-07-20)
// 前提: WebXRのハンドトラッキングは手首(wrist)までしか座標を持たない(ひじ・前腕は規格にもセンサーにも存在しない)。
// ここでの「腕」は実測ではなく、頭の位置から肩を仮定し、肩と手首の距離から二節IK(肩→ひじ→手首)で
// ひじの位置を逆算する近似表示。詳しくは references/xr-quest.md 追記欄(2026-07-20)を参照。
//
// 使い方の型:
//   import { estimateArm } from "./lib/arm.js";
//   const {shoulder, elbow} = estimateArm(headPos, headQuat, wristPos, "left", {});
//   // 前腕メッシュは elbow→wrist を結ぶ向きに置く(手首の位置そのものは実測なのでそのまま使う)。
//   // 手首の"ひねり"だけは見た目のリアルさのために手首クォータニオンから別途ブレンドしてよいが、
//   // 曲げ・向き(スイング)は必ずこの関数の elbow を使う(手首クォータニオンをそのまま前腕の向きにしない)。
// なぜ: 手首の姿勢(向き)をそのまま前腕の向きに使うと、手首をひねる/曲げるだけで前腕全体が
//       振り回されたように見える(実際のひじの動きと無関係に暴れる)。これが「手探りで作ったら酷い」の正体。

// クォータニオンでベクトルを回す(three.js不使用・依存ゼロにするため自前実装)
function rotateVec(v, q) {
  const [vx, vy, vz] = v, [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.sqrt(dot(a, a)); }
function norm(a) { const l = len(a); return l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0]; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// 頭の位置・向きから肩の位置を仮定する。
//   headPos:[x,y,z] headQuat:[x,y,z,w](WebXRのviewer pose、またはthree.jsのcamera.getWorldPosition/Quaternion)
//   side: "left" | "right"
//   opt: {down=0.18, forward=0.05, out=0.19}(頭を基準にした肩のオフセット、単位m)
export function estimateShoulder(headPos, headQuat, side, opt) {
  const down = (opt && opt.down != null) ? opt.down : 0.18;
  const forward = (opt && opt.forward != null) ? opt.forward : 0.05;
  const out = (opt && opt.out != null) ? opt.out : 0.19;
  // three.js/WebXR規約: ローカル+Xが右、+Yが上、-Zが前方
  const local = [side === "right" ? out : -out, -down, -forward];
  return add(headPos, rotateVec(local, headQuat));
}

// 肩・手首の位置と上腕/前腕の長さから、ひじの位置を二節IKで逆算する。
//   shoulder, wrist:[x,y,z]  upperLen=肩→ひじ, forearmLen=ひじ→手首(単位m)
//   poleHint:[x,y,z] 「ひじが曲がる向き」のヒント(単位ベクトルでなくてよい)。
//     省略時は重力方向(下)を使う=腕を体の前に上げたときの自然な曲がり方に近い既定値
export function estimateElbow(shoulder, wrist, upperLen, forearmLen, poleHint) {
  const d = sub(wrist, shoulder);
  const dist = clamp(len(d), Math.abs(upperLen - forearmLen) + 1e-4, upperLen + forearmLen - 1e-4);
  const axis = len(d) > 1e-6 ? norm(d) : [0, 0, -1];
  const cosA = clamp((upperLen * upperLen + dist * dist - forearmLen * forearmLen) / (2 * upperLen * dist), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  let hint = poleHint || [0, -1, 0];
  let perp = sub(hint, scale(axis, dot(hint, axis)));
  if (len(perp) < 1e-6) perp = cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  perp = norm(perp);
  return add(shoulder, add(scale(axis, upperLen * cosA), scale(perp, upperLen * sinA)));
}

// まとめて呼ぶ便利版。既定の腕の長さ(上腕28cm・前腕25cm、日本の成人おおよその平均)を内蔵。
//   opt: { shoulder:{down,forward,out}, upperLen=0.28, forearmLen=0.25, poleHint }
// 戻り値: { shoulder:[x,y,z], elbow:[x,y,z] }(wristは呼び出し側が実測値をそのまま使う)
export function estimateArm(headPos, headQuat, wristPos, side, opt) {
  const shoulder = estimateShoulder(headPos, headQuat, side, opt && opt.shoulder);
  const upperLen = (opt && opt.upperLen) || 0.28;
  const forearmLen = (opt && opt.forearmLen) || 0.25;
  const elbow = estimateElbow(shoulder, wristPos, upperLen, forearmLen, opt && opt.poleHint);
  return { shoulder, elbow };
}
