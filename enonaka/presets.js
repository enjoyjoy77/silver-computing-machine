// えのなか の用意した場面。絵ごとに地平線・目線・画角・床・前に出すもの・すわる場所を決めてある。
// 点は絵のピクセル（1536×1024）で書き、最後に 0〜1 へ割る。
(function (root) {
  'use strict';
  const C = root.EnonakaCore || require('./stage-core.js');
  const W = 1536, H = 1024;
  const n = pts => pts.map(([x, y]) => [x / W, y / H]);
  const walk = (pts, h) => ({ pts: n(pts), h: h || 0, kind: 'walk' });
  const block = (pts, h) => ({ pts: n(pts), h: h || 0, kind: 'block' });
  const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  // ---- ひまわりの道 ----
  // 地平線は校舎の左の壁の上下の線を伸ばした交点（y≈660）。右の壁の線はほぼ水平なので、画角は 64° くらい。
  // 目線 1.6m で、道幅 2.7m・柵 1.3m・1 階の高さ 2.9m になる。
  const himawari = {
    id: 'himawari', name: 'ひまわりの道', src: 'bg/himawari.jpg', thumb: 'bg/himawari-s.jpg',
    start: [700 / W, 900 / H],
    scene: {
      horizon: 660 / H, eye: 1.6, fov: 64, light: 1.1, warmth: 0.25,
      areas: [
        walk([[452, 1024], [462, 940], [474, 860], [486, 790], [496, 740], [506, 708], [520, 700],
          [536, 712], [600, 734], [680, 760], [745, 785], [820, 798], [950, 812],
          [976, 852], [1000, 924], [1022, 1024]])
      ],
      occluders: [], seats: []
    }
  };

  // ---- 杉並木の神社 ----
  // 絵なので、段の線と左右の端の線の遠近は厳密には合わない（全部を 1 つの立体に合わせると画角 130° 超になる）。
  // そこで「灯籠を 1.8m、段の幅をキャラの約 3.7 倍」とみなして、各段に立ったときの背丈を先に決め、段の高さを逆算した。
  // 地平線 y=560、目線は一番下の段から 2.43m、画角 65°。段差は 0.09〜0.13m、踊り場の先に社殿への 9 段（1 段 5.6cm）。
  const jinja = (() => {
    const cy = 560, eye = 2.431, fov = 65;
    const f = (W / 2) / Math.tan(fov * Math.PI / 360);
    const nos = [981, 923, 873, 829, 797, 769, 745, 725, 709, 695, 681, 669, 660];   // 段の縁（下から）
    const tall = v => 0.435 * (v - 364);                                             // その段に立ったときの背丈（px）
    const hOf = v => eye - 1.55 * (v - cy) / tall(v);
    const xL = v => 411 - 0.424 * (v - 681) + 22, xR = v => 921 + 0.903 * (v - 681) - 22;
    const strip = (vTop, vBot, h) => walk([[xL(vBot), vBot], [xR(vBot), vBot], [xR(vTop), vTop], [xL(vTop), vTop]], h);
    const areas = [];
    const hs = nos.map(hOf);
    areas.push(strip(nos[0], 1024, hs[0] - (hs[1] - hs[0])));
    for (let k = 0; k < nos.length - 1; k++) areas.push(strip(nos[k + 1], nos[k], hs[k]));
    // 踊り場（灯籠の立つ両脇まで広い）
    const hL = hs[hs.length - 1];
    areas.push(walk([[412, 661], [912, 661], [990, 641], [400, 641]], hL));
    // 社殿への 9 段。奥行き 15.1m から 0.3m ずつ、0.056m ずつ上がる
    const up = j => cy + f * (eye - (hL + 0.056 * (j + 1))) / (15.1 + 0.3 * j);
    const uxL = v => 536 + (554 - 536) * (656 - v) / 53, uxR = v => 755 - (755 - 734) * (656 - v) / 53;
    let vPrev = 657;
    for (let j = 0; j < 9; j++) {
      const v = up(j);
      areas.push(walk([[uxL(vPrev), vPrev], [uxR(vPrev), vPrev], [uxR(v), v], [uxL(v), v]], hL + 0.056 * (j + 1)));
      vPrev = v;
    }
    // 社殿の前（賽銭箱のまわり）
    const hTop = hL + 0.056 * 9;
    areas.push(walk([[uxL(vPrev), vPrev], [uxR(vPrev), vPrev], [736, 594], [552, 594]], hTop));
    areas.push(block(box(604, 585, 688, vPrev), hTop));
    // 灯籠の根元
    areas.push(block(box(470, 640, 508, 652), hL), block(box(800, 640, 840, 652), hL));
    return {
      id: 'jinja', name: '杉並木の神社', src: 'bg/jinja.jpg', thumb: 'bg/jinja-s.jpg',
      start: [700 / W, 1000 / H],
      scene: {
        horizon: cy / H, eye, fov, light: 0.85, warmth: -0.2, areas,
        occluders: [
          { pts: n([[466, 512], [510, 512], [510, 560], [496, 560], [496, 650], [482, 650], [482, 560], [466, 560]]) },
          { pts: n([[800, 512], [842, 512], [842, 560], [826, 560], [826, 650], [814, 650], [814, 560], [800, 560]]) },
          { pts: n([[606, 576], [686, 576], [686, 604], [606, 604]]) }
        ],
        seats: []
      }
    };
  })();

  // ---- 木造校舎の廊下 ----
  // 左右の壁の根元の線が (373, 411) で交わる。地平線 y=411。目線 1.5m で、廊下の幅 2.2m・奥の扉まで 19m・天井 3.4m。
  // 壁から 0.25m ほど内側を歩く。
  const rouka = {
    id: 'rouka', name: '木造校舎の廊下', src: 'bg/rouka.jpg', thumb: 'bg/rouka-s.jpg',
    start: [430 / W, 800 / H],
    scene: {
      horizon: 411 / H, eye: 1.5, fov: 65, light: 0.85, warmth: 0.6,
      areas: [walk([[71, 1024], [325, 508], [437, 508], [776, 1024]])],
      occluders: [], seats: []
    }
  };

  const list = [himawari, jinja, rouka].map(p => Object.assign(p, { scene: C.sanitizeScene(p.scene) }));
  const api = { list, get: id => list.find(p => p.id === id) || null };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EnonakaPresets = api;
})(typeof self !== 'undefined' ? self : this);
