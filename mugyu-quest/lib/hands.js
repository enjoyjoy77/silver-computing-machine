// hands.js — Quest素手(ハンドトラッキング)共通部品 v1 (2026-07-12)
// 「正」は ツールボックス\xr-hands\hands.js。各ツールの lib\ へは sync_hands.py で機械コピーする。
// 手で個別に直さない(直したら xr-hands 側を直して同期し直す)。
//
// 使い方(各ツールのHTML側):
//   import { setupHands, isHandInput } from "./lib/hands.js";
//   1) requestSession の optionalFeatures に "hand-tracking" を入れる
//   2) セッション開始時に setupHands(renderer, scene) を1回呼ぶ(素手のとき本物の手メッシュが出る)
//   3) controller の "connected" イベントで ctrlIsHand[i] = isHandInput(e) を記録し、
//      素手のときはコントローラ用の球・モデル表示を出さない(偽コントローラ球の防止)
// 注意: Quest純正の素手トラッキング中は振動(haptics)が出せない。ピンチ(つまみ)は select イベントとして届く。
import { XRHandModelFactory } from "./XRHandModelFactory.js";

const _factory = new XRHandModelFactory();
let _hands = null;

// renderer: THREE.WebGLRenderer(xr有効) / parent: 手を入れる親(通常 scene)
// path: 手GLBの場所。省略時はページ基準で "./lib/profiles/generic-hand/"
export function setupHands(renderer, parent, path) {
  if (_hands) return _hands;
  _factory.setPath(path || "./lib/profiles/generic-hand/");
  _hands = [];
  for (let i = 0; i < 2; i++) {
    const h = renderer.xr.getHand(i);
    h.add(_factory.createHandModel(h, "mesh"));
    parent.add(h);
    _hands.push(h);
  }
  return _hands;
}

// controllerの "connected" イベントから「この入力は素手か」を判定
export function isHandInput(e) {
  return !!(e && e.data && e.data.hand);
}

// ---- 骨格コライダー(2026-07-20追加) ----
// 従来の「25関節に球を置き、すき間対策で半径を太らせる」方式をやめ、
// 本物の手と同じ骨のつながり(骨リスト)に沿って細い球を切れ目なく並べる。
// 半径はWebXR純正の関節半径をそのまま使う(太らせない)。

// WebXR標準25関節の骨のつながり(親→先)。3列目=1なら「手のひら系」(指先ほどの細かさが不要→点間隔を広げて軽量化)
const HAND_BONES = [
  // 親指
  ["wrist", "thumb-metacarpal", 1], ["thumb-metacarpal", "thumb-phalanx-proximal", 0],
  ["thumb-phalanx-proximal", "thumb-phalanx-distal", 0], ["thumb-phalanx-distal", "thumb-tip", 0],
  // 人差し指〜小指(中手骨→基節→中節→末節→先)
  ["wrist", "index-finger-metacarpal", 1], ["index-finger-metacarpal", "index-finger-phalanx-proximal", 0],
  ["index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", 0],
  ["index-finger-phalanx-intermediate", "index-finger-phalanx-distal", 0], ["index-finger-phalanx-distal", "index-finger-tip", 0],
  ["wrist", "middle-finger-metacarpal", 1], ["middle-finger-metacarpal", "middle-finger-phalanx-proximal", 0],
  ["middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", 0],
  ["middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", 0], ["middle-finger-phalanx-distal", "middle-finger-tip", 0],
  ["wrist", "ring-finger-metacarpal", 1], ["ring-finger-metacarpal", "ring-finger-phalanx-proximal", 0],
  ["ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", 0],
  ["ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", 0], ["ring-finger-phalanx-distal", "ring-finger-tip", 0],
  ["wrist", "pinky-finger-metacarpal", 1], ["pinky-finger-metacarpal", "pinky-finger-phalanx-proximal", 0],
  ["pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", 0],
  ["pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", 0], ["pinky-finger-phalanx-distal", "pinky-finger-tip", 0],
  // 手のひらの横方向(付け根の列)=中手骨どうしのすき間ふさぎ
  ["index-finger-metacarpal", "middle-finger-metacarpal", 1], ["middle-finger-metacarpal", "ring-finger-metacarpal", 1],
  ["ring-finger-metacarpal", "pinky-finger-metacarpal", 1],
  ["index-finger-phalanx-proximal", "middle-finger-phalanx-proximal", 1],
  ["middle-finger-phalanx-proximal", "ring-finger-phalanx-proximal", 1],
  ["ring-finger-phalanx-proximal", "pinky-finger-phalanx-proximal", 1],
];

// 掌分類(2026-07-22): 関節そのものにも骨中間点(bone[2])と同じ「掌/指」の区別を与える。
// proximalより先は指、wrist/metacarpalは掌として扱う。cbの第5引数isPalmで受け取れる(従来の4引数cbはそのまま動く)。
const PALM_JOINTS = new Set([
  "wrist",
  "thumb-metacarpal",
  "index-finger-metacarpal",
  "middle-finger-metacarpal",
  "ring-finger-metacarpal",
  "pinky-finger-metacarpal",
]);

const _joints = new Map();   // 使い回し(毎フレームnew禁止)

// 判定球[x,y,z,r]が対象リストnearのどれかに近いか(marginは骨の長さぶんの余裕)
function _isNear(x, y, z, r, near, margin) {
  for (let i = 0; i < near.length; i++) {
    const t = near[i];
    const dx = x - t[0], dy = y - t[1], dz = z - t[2];
    const reach = t[3] + r + margin;
    if (dx * dx + dy * dy + dz * dz <= reach * reach) return true;
  }
  return false;
}

// 素手の骨格に沿って当たり判定の点を列挙する。
//   src: XRInputSource(src.handがあること) / frame: XRFrame / ref: 参照空間
//   cb(x, y, z, r, isPalm): 点1つごとに呼ばれる(rはWebXR純正の関節半径ベース。太らせない)。
//                           isPalm=trueは掌側の点、falseは指。従来の4引数cbとも互換。
//   opts: {
//     minR=0.006     半径の下限(m)
//     spacing=1.4    指の点間隔=半径×この倍率(2未満なら切れ目なし)
//     palmSpacing    手のひら系の点間隔倍率(既定=spacing×1.35、上限1.9)。手のひらは粗くして軽量化
//     near           軽量化の本命: 触られる対象の球のリスト [[x,y,z,半径],...]。
//                    渡すと、どの関節も対象から遠い間は「手まるごと」スキップして点ゼロにする。
//                    ※骨単位では間引かない: 並び順が毎フレーム揺れると、ツール側の
//                      「前フレームと同じ番号のコライダー」前提の速度推定・パッチ追跡が壊れるため。
//                      手まるごとON/OFFなら、出ている間の並び順は完全に安定(消えるのはトラッキング切れと同じ扱い)
//   }
// 戻り値: 置いた点の数
export function forEachHandBonePoint(src, frame, ref, cb, opts) {
  if (!src || !src.hand || !frame || !ref) return 0;
  const minR = (opts && opts.minR) || 0.006;
  const spacing = (opts && opts.spacing) || 1.4;
  const palmSpacing = Math.min((opts && opts.palmSpacing) || spacing * 1.35, 1.9);
  const near = (opts && opts.near && opts.near.length) ? opts.near : null;
  const MARGIN = 0.06;   // 判定の余裕(手が触れる直前には確実に点が出ているように)
  _joints.clear();
  let anyNear = !near;
  for (const [name, joint] of src.hand.entries()) {
    const p = frame.getJointPose(joint, ref);
    if (!p) continue;
    const r = Math.max((p.radius && p.radius > 0) ? p.radius : 0.008, minR);
    const x = p.transform.position.x, y = p.transform.position.y, z = p.transform.position.z;
    _joints.set(name, [x, y, z, r, PALM_JOINTS.has(name)]);
    if (!anyNear && _isNear(x, y, z, r, near, MARGIN)) anyNear = true;
  }
  if (!_joints.size || !anyNear) return 0;   // 手が対象から遠い間は点ゼロ(待機コストゼロ)
  let n = 0;
  // まず全関節そのもの(骨の端点)
  for (const a of _joints.values()) { cb(a[0], a[1], a[2], a[3], a[4]); n++; }
  // 次に骨ごとに中間点を埋める(間隔=細い方の半径×spacing → 球がつながって切れ目ゼロ)
  for (const bone of HAND_BONES) {
    const a = _joints.get(bone[0]), b = _joints.get(bone[1]);
    if (!a || !b) continue;
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) continue;
    const step = Math.min(a[3], b[3]) * (bone[2] ? palmSpacing : spacing);
    const k = Math.ceil(len / step) - 1;          // 中間点の数(端点は置き済み)
    for (let i = 1; i <= k; i++) {
      const t = i / (k + 1);
      cb(a[0] + dx * t, a[1] + dy * t, a[2] + dz * t, a[3] + (b[3] - a[3]) * t, !!bone[2]);
      n++;
    }
  }
  return n;
}
