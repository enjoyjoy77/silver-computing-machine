import { add, sub, mul, cross, unit, identity } from "./math.js";
export const BUTTONS = [
  { x: -0.125, y: -0.11, z: 0.24, label: "丸め直す", action: "reset" },
  { x: 0, y: -0.11, z: 0.24, label: "台 / 空中", action: "mode" },
  { x: 0.125, y: -0.11, z: 0.24, label: "2つの塊", action: "two" },
];
function vertex(a, p, n, m) {
  a.push(...p, 0, ...n, m);
}
function triangle(a, p, q, r, n, m) {
  vertex(a, p, n, m);
  vertex(a, q, n, m);
  vertex(a, r, n, m);
}
function box(a, center, scale, material) {
  const [x, y, z] = center,
    [sx, sy, sz] = scale.map((v) => v / 2);
  const faces = [
    [
      [1, 0, 0],
      [
        [sx, -sy, -sz],
        [sx, sy, -sz],
        [sx, sy, sz],
        [sx, -sy, sz],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [-sx, -sy, sz],
        [-sx, sy, sz],
        [-sx, sy, -sz],
        [-sx, -sy, -sz],
      ],
    ],
    [
      [0, 1, 0],
      [
        [-sx, sy, -sz],
        [-sx, sy, sz],
        [sx, sy, sz],
        [sx, sy, -sz],
      ],
    ],
    [
      [0, -1, 0],
      [
        [-sx, -sy, sz],
        [-sx, -sy, -sz],
        [sx, -sy, -sz],
        [sx, -sy, sz],
      ],
    ],
    [
      [0, 0, 1],
      [
        [-sx, -sy, sz],
        [sx, -sy, sz],
        [sx, sy, sz],
        [-sx, sy, sz],
      ],
    ],
    [
      [0, 0, -1],
      [
        [sx, -sy, -sz],
        [-sx, -sy, -sz],
        [-sx, sy, -sz],
        [sx, sy, -sz],
      ],
    ],
  ];
  for (const [n, pts] of faces) {
    const p = pts.map((v) => add(v, [x, y, z]));
    triangle(a, p[0], p[1], p[2], n, material);
    triangle(a, p[0], p[2], p[3], n, material);
  }
}
function capsule(a, p, q, r, material) {
  const axis = unit(sub(q, p));
  if (Math.hypot(...axis) < 0.1) return;
  const ref = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0],
    u = unit(cross(axis, ref)),
    v = cross(axis, u);
  for (let j = 0; j < 8; j++) {
    const angle = (j * Math.PI) / 4,
      next = ((j + 1) * Math.PI) / 4,
      n = add(mul(u, Math.cos(angle)), mul(v, Math.sin(angle))),
      nn = add(mul(u, Math.cos(next)), mul(v, Math.sin(next)));
    const a0 = add(p, mul(n, r)),
      a1 = add(p, mul(nn, r)),
      b0 = add(q, mul(n, r)),
      b1 = add(q, mul(nn, r));
    vertex(a, a0, n, material);
    vertex(a, a1, nn, material);
    vertex(a, b0, n, material);
    vertex(a, a1, nn, material);
    vertex(a, b1, nn, material);
    vertex(a, b0, n, material);
  }
}
function sphere(a, center, r, material) {
  const at = (i, j) => [
    Math.sin((i * Math.PI) / 4) * Math.cos((j * Math.PI) / 4),
    Math.cos((i * Math.PI) / 4),
    Math.sin((i * Math.PI) / 4) * Math.sin((j * Math.PI) / 4),
  ];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 8; j++) {
      const ns = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      for (const k of [0, 1, 2, 0, 2, 3])
        vertex(a, add(center, mul(ns[k], r)), ns[k], material);
    }
}
export function makeScene(handData, table) {
  const data = [];
  if (table) box(data, [0, -0.071, 0], [0.5, 0.01, 0.38], 2);
  else {
    for (const x of [-0.25, 0.25])
      box(data, [x, -0.081, 0], [0.002, 0.002, 0.38], 2);
    for (const z of [-0.19, 0.19])
      box(data, [0, -0.081, z], [0.5, 0.002, 0.002], 2);
  }
  for (const b of BUTTONS) box(data, [b.x, b.y, b.z], [0.105, 0.036, 0.012], 3);
  for (let j = 2; j < handData.length / 20; j++) {
    const k = j * 20;
    if (handData[k + 18] < 0.5) continue;
    const a = Array.from(handData.slice(k, k + 3)),
      b = Array.from(handData.slice(k + 4, k + 7)),
      r = handData[k + 3];
    capsule(data, a, b, r, 1);
    sphere(data, b, r, 1);
  }
  return new Float32Array(data);
}
export function makeAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 768, 128);
  ctx.font = '600 30px "Yu Gothic UI", sans-serif';
  ctx.fillStyle = "#fff5e9";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  BUTTONS.forEach((b, i) => ctx.fillText(b.label, 128 + i * 256, 64));
  return canvas;
}
function textGeometry() {
  const a = [];
  BUTTONS.forEach((b, i) => {
    const p = [
        [b.x - 0.047, b.y - 0.014, b.z + 0.0062],
        [b.x + 0.047, b.y - 0.014, b.z + 0.0062],
        [b.x + 0.047, b.y + 0.014, b.z + 0.0062],
        [b.x - 0.047, b.y + 0.014, b.z + 0.0062],
      ],
      uv = [
        [i / 3, 1],
        [(i + 1) / 3, 1],
        [(i + 1) / 3, 0],
        [i / 3, 0],
      ];
    for (const k of [0, 1, 2, 0, 2, 3]) a.push(...p[k], 0, ...uv[k], 0, 0);
  });
  return new Float32Array(a);
}
export class Renderer {
  static async create(device, canvas) {
    const r = new Renderer();
    r.device = device;
    r.canvas = canvas;
    r.context = canvas.getContext("webgpu");
    r.format = navigator.gpu.getPreferredCanvasFormat();
    r.context.configure({
      device,
      format: r.format,
      alphaMode: "premultiplied",
    });
    r.resources = [];
    r.uniform = device.createBuffer({
      size: 256 * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    r.geometry = device.createBuffer({
      size: 2 * 1024 * 1024,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const text = textGeometry();
    r.textCount = text.length / 8;
    r.text = device.createBuffer({
      size: text.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(r.text, 0, text);
    r.atlasCanvas = makeAtlas();
    r.atlas = device.createTexture({
      size: [768, 128],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: r.atlasCanvas },
      { texture: r.atlas },
      [768, 128],
    );
    r.layout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: 160,
          },
        },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });
    r.group = device.createBindGroup({
      layout: r.layout,
      entries: [
        { binding: 0, resource: { buffer: r.uniform, size: 160 } },
        { binding: 1, resource: r.atlas.createView() },
        {
          binding: 2,
          resource: device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
          }),
        },
      ],
    });
    const response = await fetch(new URL("render.wgsl", import.meta.url));
    r.module = device.createShaderModule({ code: await response.text() });
    const info = await r.module.getCompilationInfo();
    if (info.messages.some((m) => m.type === "error"))
      throw Error(info.messages.map((m) => m.message).join("\n"));
    r.cache = new Map();
    r.model = identity();
    return r;
  }
  pipelines(format) {
    if (this.cache.has(format)) return this.cache.get(format);
    const device = this.device,
      layout = device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      buffers = [
        {
          arrayStride: 32,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x4" },
            { shaderLocation: 1, offset: 16, format: "float32x4" },
          ],
        },
      ];
    const main = device.createRenderPipeline({
      layout,
      vertex: { module: this.module, entryPoint: "vertex", buffers },
      fragment: {
        module: this.module,
        entryPoint: "fragment",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    const text = device.createRenderPipeline({
      layout,
      vertex: { module: this.module, entryPoint: "textVertex", buffers },
      fragment: {
        module: this.module,
        entryPoint: "textFragment",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "less-equal",
      },
    });
    const result = { main, text };
    this.cache.set(format, result);
    return result;
  }
  updateScene(handData, table) {
    this.sceneData = makeScene(handData, table);
    if (this.sceneData.byteLength > this.geometry.size)
      throw Error("手の表示容量を超えました");
    this.device.queue.writeBuffer(this.geometry, 0, this.sceneData);
    this.geometryCount = this.sceneData.length / 8;
  }
  drawView(
    encoder,
    {
      color,
      depth,
      viewport,
      format = this.format,
      vp,
      eye,
      slot = 0,
      clear = [0.022, 0.02, 0.018, 1],
      timestampWrites = undefined,
    },
    simulation,
  ) {
    const uni = new Float32Array(40);
    uni.set(vp);
    uni.set(this.model, 16);
    uni.set([...eye, 1], 32);
    this.device.queue.writeBuffer(this.uniform, slot * 256, uni);
    const pipelines = this.pipelines(format);
    const pass = encoder.beginRenderPass({
      timestampWrites,
      colorAttachments: [
        { view: color, clearValue: clear, loadOp: "clear", storeOp: "store" },
      ],
      depthStencilAttachment: {
        view: depth,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    if (viewport)
      pass.setViewport(
        viewport.x,
        viewport.y,
        viewport.width,
        viewport.height,
        0,
        1,
      );
    pass.setBindGroup(0, this.group, [slot * 256]);
    pass.setPipeline(pipelines.main);
    pass.setVertexBuffer(0, simulation.vertices);
    pass.drawIndirect(simulation.draw, 0);
    pass.setVertexBuffer(0, this.geometry);
    pass.draw(this.geometryCount ?? 0);
    pass.setPipeline(pipelines.text);
    pass.setVertexBuffer(0, this.text);
    pass.draw(this.textCount);
    pass.end();
  }
  desktopTarget() {
    const ratio = Math.min(devicePixelRatio, 1.5),
      width = Math.max(1, Math.round(this.canvas.clientWidth * ratio)),
      height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (
      width !== this.canvas.width ||
      height !== this.canvas.height ||
      !this.depth
    ) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.depth?.destroy();
      this.depth = this.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    return {
      color: this.context.getCurrentTexture().createView(),
      depth: this.depth.createView(),
      format: this.format,
    };
  }
}
export { textGeometry };
