// xr-pen/pen.js — Quest系ツール共用の「空中に線を描く」簡易ペン部品(正) v2
// 使い方(組み込み側):
//   import { createPen } from "./lib/pen.js";
//   const pen = createPen(THREE, scene);            // 既定色: 黒・赤・青
//   毎フレーム: 描き始め pen.down(位置) → 描き中 pen.move(位置) → 離したら pen.up()
//   色替え pen.setColor(番号) / 1本消す pen.undo() / 全部消す pen.clear()
// 色を増やしたい時は createPen の opts.colors に {name,hex} を足すだけ
//
// ▼v2: 立体の表面に描く(面吸着)
//   pen.addSurface(mesh) で登録した立体(ボール等)の表面から snapDist(既定4cm)以内に
//   ペン先が来ると、線がその表面に吸着し、曲面に沿って描かれる。離れた所は今まで通り空中。
//   吸着中は移動を細かく刻んで面に沿わせるので、弦(直線)が球にめり込まない。
//   注意: 面メッシュは「表側の向き」(標準ジオメトリの巻き向き)が正しいこと・拡縮は等倍(uniform scale)想定。
//   pen.removeSurface(mesh) / pen.clearSurfaces() で解除。
// (このファイルを直すときは xr-pen の正を直して python sync_pen.py で全ツールへ同期する)

export const DEFAULT_COLORS = [
  { name: "くろ", hex: 0x151515 },
  { name: "あか", hex: 0xe03535 },
  { name: "あお", hex: 0x2f6bff },
  // 色を増やすならここに1行足す(例: { name: "みどり", hex: 0x2fae5f },)
];

export function createPen(THREE, scene, opts) {
  const o = opts || {};
  const colors = (o.colors && o.colors.length ? o.colors : DEFAULT_COLORS).map(c => ({ name: c.name, hex: c.hex }));
  const RADIUS = o.radius || 0.004;        // 線の太さ(半径・m)
  const MIN_DIST = o.minDist || 0.008;     // これ以上動いたら点を足す(m)
  const MAX_PTS = o.maxPointsPerStroke || 240;  // 1メッシュの点数上限(超えたら自動で継ぎ足す)
  const MAX_STROKES = o.maxStrokes || 400; // メッシュ本数の上限(描画負荷の安全弁)
  const RADIAL = 8;                        // 断面の頂点数
  const SNAP = (o.snapDist !== undefined) ? o.snapDist : 0.04;   // 面吸着の距離(m)
  const LIFT = (o.surfaceLift !== undefined) ? o.surfaceLift : RADIUS + 0.0005; // 面から浮かす量
  const MAX_TRIS = o.maxSurfaceTris || 60000; // 面1つあたりの三角形上限(重さの安全弁)
  const MAX_SUBSTEPS = 12;                 // 1フレームの移動を刻む最大数(面沿い用)

  const group = new THREE.Group();
  group.name = "xr-pen-ink";
  scene.add(group);

  const materials = colors.map(c => new THREE.MeshBasicMaterial({ color: c.hex }));

  let colorIndex = 0;
  let strokes = [];        // {mesh, geo, pts:[Vector3...], colorIndex, logicalId, normal:Vector3}
  let current = null;
  let logicalSeq = 0;

  const _tan = new THREE.Vector3(), _nrm = new THREE.Vector3(), _bin = new THREE.Vector3(), _tmp = new THREE.Vector3();

  function newStrokeMesh(ci, logicalId) {
    const posArr = new Float32Array(MAX_PTS * RADIAL * 3);
    const idxArr = new Uint16Array((MAX_PTS - 1) * RADIAL * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, materials[ci]);
    mesh.frustumCulled = false; // 描き途中のbounding未更新でも消えないように
    group.add(mesh);
    const s = { mesh, geo, pts: [], colorIndex: ci, logicalId, normal: new THREE.Vector3(0, 1, 0) };
    strokes.push(s);
    return s;
  }

  // 点pの断面リングを書き込む(平行移動フレームでねじれ防止)
  function writeRing(s, i, p, tangent) {
    _nrm.copy(s.normal);
    _nrm.addScaledVector(tangent, -_nrm.dot(tangent)); // 接線に直交化
    if (_nrm.lengthSq() < 1e-10) {
      // 接線と最も直交しやすい軸(成分が最小の軸)から作り直す(Z決め打ちだと接線がZ軸のとき潰れる)
      const ax = Math.abs(tangent.x), ay = Math.abs(tangent.y), az = Math.abs(tangent.z);
      if (ax <= ay && ax <= az) _nrm.set(1, 0, 0);
      else if (ay <= az) _nrm.set(0, 1, 0);
      else _nrm.set(0, 0, 1);
      _nrm.addScaledVector(tangent, -_nrm.dot(tangent));
    }
    _nrm.normalize();
    s.normal.copy(_nrm);
    _bin.crossVectors(tangent, _nrm).normalize();
    const arr = s.geo.attributes.position.array;
    for (let k = 0; k < RADIAL; k++) {
      const a = (k / RADIAL) * Math.PI * 2;
      const c = Math.cos(a) * RADIUS, sn = Math.sin(a) * RADIUS;
      const base = (i * RADIAL + k) * 3;
      arr[base] = p.x + _nrm.x * c + _bin.x * sn;
      arr[base + 1] = p.y + _nrm.y * c + _bin.y * sn;
      arr[base + 2] = p.z + _nrm.z * c + _bin.z * sn;
    }
  }

  function connectRings(s, i) { // リング(i-1)とリング(i)を三角形でつなぐ
    const idx = s.geo.index.array;
    let w = (i - 1) * RADIAL * 6;
    for (let k = 0; k < RADIAL; k++) {
      const k2 = (k + 1) % RADIAL;
      const a = (i - 1) * RADIAL + k, b = (i - 1) * RADIAL + k2;
      const c = i * RADIAL + k, d = i * RADIAL + k2;
      idx[w++] = a; idx[w++] = c; idx[w++] = b;
      idx[w++] = b; idx[w++] = c; idx[w++] = d;
    }
  }

  function pushPoint(s, p) {
    const i = s.pts.length;
    s.pts.push(p.clone());
    if (i === 0) return; // 2点目が来たら初リングを書く
    _tan.subVectors(s.pts[i], s.pts[i - 1]).normalize();
    if (i === 1) writeRing(s, 0, s.pts[0], _tan);
    writeRing(s, i, s.pts[i], _tan);
    connectRings(s, i);
    s.geo.setDrawRange(0, i * RADIAL * 6);
    s.geo.attributes.position.needsUpdate = true;
    s.geo.index.needsUpdate = true;
  }

  /* ============ 面吸着(v2) ============ */
  let surfaces = [];   // {mesh, tris:Float32Array(9*n), count, maxEdge}
  const _inv = new THREE.Matrix4(), _lp = new THREE.Vector3(), _sc = new THREE.Vector3();
  const _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tc = new THREE.Vector3();
  const _triO = new THREE.Triangle(), _cp = new THREE.Vector3(), _bestLP = new THREE.Vector3();
  const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _sn = new THREE.Vector3(), _sp = new THREE.Vector3();
  const _raw = new THREE.Vector3(), _lastRaw = new THREE.Vector3();

  function cacheSurface(mesh) {
    const g = mesh.geometry;
    const pos = g && g.attributes && g.attributes.position;
    if (!pos) return null;
    const idx = g.index;
    const count = Math.floor((idx ? idx.count : pos.count) / 3);
    if (count === 0 || count > MAX_TRIS) return null;
    const tris = new Float32Array(count * 9);
    let maxEdge = 0;
    for (let t = 0; t < count; t++) {
      for (let v = 0; v < 3; v++) {
        const vi = idx ? idx.getX(t * 3 + v) : t * 3 + v;
        tris[t * 9 + v * 3] = pos.getX(vi);
        tris[t * 9 + v * 3 + 1] = pos.getY(vi);
        tris[t * 9 + v * 3 + 2] = pos.getZ(vi);
      }
      const b = t * 9;
      _ta.set(tris[b], tris[b + 1], tris[b + 2]);
      _tb.set(tris[b + 3], tris[b + 4], tris[b + 5]);
      _tc.set(tris[b + 6], tris[b + 7], tris[b + 8]);
      maxEdge = Math.max(maxEdge, _ta.distanceTo(_tb), _tb.distanceTo(_tc), _tc.distanceTo(_ta));
    }
    const g2 = mesh.geometry;
    if (!g2.boundingSphere) g2.computeBoundingSphere(); // 遠いときの丸ごと足切り用
    const bs = g2.boundingSphere;
    return { mesh, tris, count, maxEdge, bsCenter: bs.center.clone(), bsRadius: bs.radius };
  }

  // pw(ワールド座標)から一番近い登録面上の点を探す。SNAP以内なら outP/outN に入れて true
  function snapPoint(pw, outP, outN) {
    let bestD2w = SNAP * SNAP, found = false;
    for (const s of surfaces) {
      const mesh = s.mesh;
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldScale(_sc);
      const sf = Math.max(Math.abs(_sc.x), 1e-9); // 等倍scale想定
      const sf2 = sf * sf;
      // 遠いときはこの面を丸ごと飛ばす(毎点の行列invert+三角形スキャンを節約)
      _cp.copy(s.bsCenter).applyMatrix4(mesh.matrixWorld);
      const reach = s.bsRadius * sf + Math.sqrt(bestD2w);
      if (_cp.distanceToSquared(pw) > reach * reach) continue;
      _inv.copy(mesh.matrixWorld).invert();
      _lp.copy(pw).applyMatrix4(_inv);
      let bD2 = bestD2w / sf2;      // ローカルでの探索半径^2
      let rLimit = Math.sqrt(bD2) + s.maxEdge;   // 荒ふるい用(頂点1つで足切り)
      let rLimit2 = rLimit * rLimit;
      let bi = -1;
      const tris = s.tris;
      for (let t = 0; t < s.count; t++) {
        const b = t * 9;
        _ta.set(tris[b], tris[b + 1], tris[b + 2]);
        if (_ta.distanceToSquared(_lp) > rLimit2) continue; // 遠い三角形は飛ばす
        _tb.set(tris[b + 3], tris[b + 4], tris[b + 5]);
        _tc.set(tris[b + 6], tris[b + 7], tris[b + 8]);
        _triO.set(_ta, _tb, _tc);
        _triO.closestPointToPoint(_lp, _cp);
        const d2 = _cp.distanceToSquared(_lp);
        if (d2 < bD2) {
          bD2 = d2; bi = t; _bestLP.copy(_cp);
          rLimit = Math.sqrt(bD2) + s.maxEdge; rLimit2 = rLimit * rLimit;
        }
      }
      if (bi >= 0) {
        found = true;
        bestD2w = bD2 * sf2;
        const b = bi * 9;
        _ta.set(tris[b], tris[b + 1], tris[b + 2]);
        _tb.set(tris[b + 3], tris[b + 4], tris[b + 5]);
        _tc.set(tris[b + 6], tris[b + 7], tris[b + 8]);
        _e1.subVectors(_tb, _ta); _e2.subVectors(_tc, _ta);
        _sn.crossVectors(_e1, _e2); // 三角形の巻き向き=表側(標準ジオメトリは外向き)
        outP.copy(_bestLP).applyMatrix4(mesh.matrixWorld);
        outN.copy(_sn).transformDirection(mesh.matrixWorld); // 正規化込み
      }
    }
    return found;
  }

  // 生の入力点→(面が近ければ)吸着済みの点にして返す
  let lastWasSnapped = false;
  function resolvePoint(v) { // vはVector3(書き換える)
    if (surfaces.length && snapPoint(v, _sp, _sn)) {
      v.copy(_sp).addScaledVector(_sn, LIFT);
      lastWasSnapped = true;
    } else {
      lastWasSnapped = false;
    }
    return v;
  }

  // 点を1つ足す(MIN_DIST間引き+自動継ぎ足しの本体)
  function corePush(v) {
    if (!current) return;
    const last = current.pts[current.pts.length - 1];
    if (last && last.distanceTo(v) < MIN_DIST) return;
    if (current.pts.length >= MAX_PTS) { // 長い線は同じ1本扱いのまま継ぎ足す
      const id = current.logicalId;
      const tail = last.clone();
      current = (strokes.length < MAX_STROKES) ? newStrokeMesh(colorIndex, id) : null;
      if (!current) return;
      pushPoint(current, tail);
    }
    pushPoint(current, v);
  }

  const pen = {
    colors,
    get colorIndex() { return colorIndex; },
    get isDrawing() { return !!current; },
    get isSnapping() { return lastWasSnapped; }, // 直近の点が面に吸着したか(見せ方用)
    setColor(i) { if (i >= 0 && i < colors.length) colorIndex = i; return colorIndex; },
    down(p) {
      if (current) pen.up();
      if (strokes.length >= MAX_STROKES) return false; // 上限。呼び出し側で案内を出す
      logicalSeq++;
      current = newStrokeMesh(colorIndex, logicalSeq);
      _raw.set(p.x, p.y, p.z);
      _lastRaw.copy(_raw);
      pushPoint(current, resolvePoint(_tmp.copy(_raw)));
      return true;
    },
    move(p) {
      if (!current) return;
      _raw.set(p.x, p.y, p.z);
      if (!surfaces.length) {
        lastWasSnapped = false; // 面を全部外した後に古い値が残らないように
        corePush(_tmp.copy(_raw));
      } else {
        // 面モード: 移動を細かく刻んで各点を吸着(まっすぐな弦が球にめり込まないように)
        const dist = _lastRaw.distanceTo(_raw);
        const steps = Math.min(Math.max(Math.ceil(dist / MIN_DIST), 1), MAX_SUBSTEPS);
        for (let i = 1; i <= steps; i++) {
          _tmp.lerpVectors(_lastRaw, _raw, i / steps);
          corePush(resolvePoint(_tmp));
        }
      }
      _lastRaw.copy(_raw);
    },
    up() {
      if (!current) return;
      if (current.pts.length < 2) { // その場でトリガーだけ=点を打つ(米粒サイズ)
        const p = current.pts[0] || _tmp.set(0, 0, 0);
        // MIN_DIST未満だと弾かれて点が出ない。面吸着中は2点目も面に乗せる(素通しだと球の裏側で内部に潜る)
        corePush(resolvePoint(_tmp.set(p.x + MIN_DIST * 1.2, p.y, p.z)));
      }
      current = null;
    },
    undo() { // 直近に完成した1本(継ぎ足し含む)を消す。描き途中の線には触れない
      const curId = current ? current.logicalId : -1;
      let i = strokes.length - 1;
      while (i >= 0 && strokes[i].logicalId === curId) i--; // 描画中の分は飛ばす
      let id;
      if (i >= 0) id = strokes[i].logicalId;
      else if (current) { id = curId; current = null; } // 完成線が無ければ描き途中を取り消す
      else return false;
      strokes = strokes.filter(s => {
        if (s.logicalId !== id) return true;
        group.remove(s.mesh); s.geo.dispose(); return false;
      });
      return true;
    },
    clear() {
      pen.up();
      for (const s of strokes) { group.remove(s.mesh); s.geo.dispose(); }
      strokes = [];
    },
    strokeCount() { // 見た目上の本数(継ぎ足しは1本と数える)
      const ids = new Set(); for (const s of strokes) ids.add(s.logicalId); return ids.size;
    },
    pointCount() { let n = 0; for (const s of strokes) n += s.pts.length; return n; },
    lastStrokePoints() { // 検証用: 直近1本(継ぎ足し込み)の点列を[[x,y,z],...]で返す
      if (!strokes.length) return [];
      const id = strokes[strokes.length - 1].logicalId;
      const out = [];
      for (const s of strokes) if (s.logicalId === id) for (const q of s.pts) out.push([q.x, q.y, q.z]);
      return out;
    },
    /* 面吸着の登録。成功=true(三角形が多すぎ等は false→呼び出し側で案内) */
    addSurface(mesh) {
      if (surfaces.some(s => s.mesh === mesh)) return true;
      const c = cacheSurface(mesh);
      if (!c) return false;
      surfaces.push(c);
      return true;
    },
    removeSurface(mesh) { surfaces = surfaces.filter(s => s.mesh !== mesh); },
    clearSurfaces() { surfaces = []; },
    get surfaceCount() { return surfaces.length; },
    group,
    dispose() { pen.clear(); pen.clearSurfaces(); scene.remove(group); for (const m of materials) m.dispose(); },
  };
  return pen;
}
