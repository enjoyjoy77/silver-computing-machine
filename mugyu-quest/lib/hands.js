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
