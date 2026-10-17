export const CONFIG = Object.freeze({
  h: 0.012,
  spacing: 0.006,
  radius: 0.052,
  grid: 64,
  links: 32,
  particleFloats: 40,
  hashSize: 65536,
  maxVertices: 240000,
  dt: 1 / 960,
  density: 1200,
  bulk: 14000,
  shear: 3000,
  yield: 650,
  tableY: -0.066,
});
// Equal material volumes; connectivity determines transfers, never spring forces.
export function seed({
  two = false,
  radius = CONFIG.radius,
  spacing = CONFIG.spacing,
} = {}) {
  const list = [],
    lookup = new Map(),
    centers = two
      ? [
          [-0.048, 0, 0],
          [0.048, 0, 0],
        ]
      : [[0, 0, 0]],
    r = two ? radius * Math.cbrt(0.5) : radius;
  centers.forEach((center, body) => {
    let n = Math.ceil(r / spacing);
    for (let z = -n; z <= n; z++)
      for (let y = -n; y <= n; y++)
        for (let x = -n; x <= n; x++) {
          if (Math.hypot(x, y, z) * spacing > r) continue;
          const p = [
            x * spacing + center[0],
            y * spacing + center[1],
            z * spacing + center[2],
          ];
          lookup.set(`${body}:${x},${y},${z}`, list.length);
          list.push({ p, x, y, z, body });
        }
  });
  const particles = new Float32Array(list.length * CONFIG.particleFloats),
    edges = new ArrayBuffer(list.length * CONFIG.links * 16),
    ei = new Uint32Array(edges),
    ef = new Float32Array(edges);
  ei.fill(0xffffffff);
  const dirs = [];
  for (let z = -1; z <= 1; z++)
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++)
        if (x * x + y * y + z * z > 0 && x * x + y * y + z * z <= 2)
          dirs.push([x, y, z]);
  list.forEach((p, i) => {
    const k = i * CONFIG.particleFloats;
    particles.set([...p.p, 1], k);
    particles[k + 8] = 1;
    particles[k + 13] = 1;
    particles[k + 18] = 1;
    particles[k + 33] = -1;
    dirs.forEach((d, j) => {
      const q = lookup.get(
          `${p.body}:${p.x + d[0]},${p.y + d[1]},${p.z + d[2]}`,
        ),
        e = (i * CONFIG.links + j) * 4;
      ei[e] = q ?? 0xffffffff;
      ef[e + 1] = spacing * Math.hypot(...d);
      ef[e + 2] = 0;
      ef[e + 3] = q === undefined ? 0 : 1;
    });
    for (let j = dirs.length; j < CONFIG.links; j++) {
      const e = (i * CONFIG.links + j) * 4;
      ef[e + 1] = spacing;
      ef[e + 2] = 0;
      ef[e + 3] = 0;
    }
  });
  return {
    particles,
    edges,
    count: list.length,
    volume: list.length * spacing ** 3,
  };
}
