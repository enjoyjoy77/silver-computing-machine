import { CONFIG, seed } from "./seed.js";
const U = () => GPUBufferUsage;
export class Simulation {
  static async create(device, options = {}) {
    const self = new Simulation();
    self.device = device;
    self.config = { ...CONFIG, ...options };
    self.two = false;
    self.table = false;
    self.resources = [];
    self.frame = 0;
    self.simulatedSeconds = 0;
    self.droppedSeconds = 0;
    self.accumulator = 0;
    const [common, physics, surface] = await Promise.all(
      ["common", "physics", "surface"].map(async (n) => {
        const r = await fetch(new URL(`${n}.wgsl`, import.meta.url));
        if (!r.ok) throw Error(`計算ファイルを読み込めません (${n})`);
        return r.text();
      }),
    );
    const modules = await Promise.all(
      [physics, surface].map(async (code, i) => {
        const module = device.createShaderModule({
          label: i ? "surface" : "MPM",
          code: common + "\n" + code,
        });
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter((m) => m.type === "error");
        if (errors.length)
          throw Error(
            errors
              .map((m) => `${i ? "surface" : "MPM"}:${m.lineNum}: ${m.message}`)
              .join("\n"),
          );
        return module;
      }),
    );
    self.physicsLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: 256,
          },
        },
        ...Array.from({ length: 6 }, (_, i) => ({
          binding: i + 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: i === 5 ? "read-only-storage" : "storage" },
        })),
      ],
    });
    self.surfaceLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: 256,
          },
        },
        ...Array.from({ length: 7 }, (_, i) => ({
          binding: i + 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        })),
      ],
    });
    const layouts = [self.physicsLayout, self.surfaceLayout].map((bind) =>
      device.createPipelineLayout({ bindGroupLayouts: [bind] }),
    );
    self.pipelines = {};
    const entries = [
      [
        "clearBins",
        "prepare",
        "binParticles",
        "validateLinks",
        "connect",
        "compress",
        "constitutive",
        "graspForces",
        "p2g",
        "gridVelocity",
        "fieldContact",
        "g2p",
        "scatterJacobian",
        "projectVolume",
        "topology",
        "weldCandidates",
        "placementBounds",
        "placeOnTable",
      ],
      [
        "clearSurface",
        "markSurface",
        "sampleSurface",
        "extractSurface",
        "finishSurface",
      ],
    ];
    await Promise.all(
      entries.flatMap((names, i) =>
        names.map(async (entryPoint) => {
          self.pipelines[entryPoint] = await device.createComputePipelineAsync({
            label: entryPoint,
            layout: layouts[i],
            compute: { module: modules[i], entryPoint },
          });
        }),
      ),
    );
    self.reset();
    return self;
  }
  buffer(label, size, usage = U().STORAGE | U().COPY_DST | U().COPY_SRC) {
    const b = this.device.createBuffer({
      label,
      size: Math.max(4, Math.ceil(size / 4) * 4),
      usage,
    });
    this.resources.push(b);
    return b;
  }
  reset(two = false) {
    this.generation = (this.generation ?? 0) + 1;
    for (const b of this.resources) b.destroy();
    this.resources = [];
    const data = seed({ two, radius: this.config.radius });
    this.count = data.count;
    this.volume = data.volume;
    this.two = two;
    this.frame = 0;
    this.simulatedSeconds = 0;
    this.droppedSeconds = 0;
    this.accumulator = 0;
    this.fault = 0;
    this.pendingPlacement = this.table;
    this.params = this.buffer(
      "substep uniforms",
      256 * 34,
      U().UNIFORM | U().COPY_DST,
    );
    this.particles = this.buffer("material state", data.particles.byteLength);
    this.edges = this.buffer("material continuity", data.edges.byteLength);
    this.parents = this.buffer("local transfer fields", this.count * 27 * 4);
    this.grid = this.buffer(
      "field momentum and velocity",
      this.count * 27 * 64,
    );
    this.bins = this.buffer(
      "spatial index and diagnostics",
      (16 + 2 * this.config.grid ** 3 + this.count * (1 + this.config.links)) *
        4,
    );
    this.hands = this.buffer("tracked hand capsules", 80 * 64);
    this.device.queue.writeBuffer(this.particles, 0, data.particles);
    this.device.queue.writeBuffer(this.edges, 0, data.edges);
    this.keys = this.buffer("sparse surface keys", CONFIG.hashSize * 4);
    this.values = this.buffer("surface samples", CONFIG.hashSize * 16);
    this.vertices = this.buffer(
      "surface triangles",
      CONFIG.maxVertices * 32,
      U().STORAGE | U().VERTEX | U().COPY_SRC,
    );
    this.draw = this.buffer(
      "surface draw command",
      32,
      U().STORAGE | U().INDIRECT | U().COPY_SRC | U().COPY_DST,
    );
    this.physicsGroup = this.device.createBindGroup({
      layout: this.physicsLayout,
      entries: [
        this.params,
        this.particles,
        this.edges,
        this.parents,
        this.grid,
        this.bins,
        this.hands,
      ].map((b, i) => ({
        binding: i,
        resource: { buffer: b, ...(i === 0 ? { size: 256 } : {}) },
      })),
    });
    this.surfaceGroup = this.device.createBindGroup({
      layout: this.surfaceLayout,
      entries: [
        this.params,
        this.particles,
        this.parents,
        this.bins,
        this.keys,
        this.values,
        this.vertices,
        this.draw,
      ].map((b, i) => ({
        binding: i,
        resource: { buffer: b, ...(i === 0 ? { size: 256 } : {}) },
      })),
    });
    this.cpuUniforms = new Float32Array(34 * 64);
  }
  writeUniform(slot, dt, alpha, inputDt, colliders) {
    const a = this.cpuUniforms,
      k = slot * 64,
      c = this.config;
    a.set(
      [
        dt,
        c.h,
        1 / c.h,
        this.count,
        c.bulk,
        c.shear,
        c.yield,
        c.density,
        (-c.grid * c.h) / 2,
        (-c.grid * c.h) / 2,
        (-c.grid * c.h) / 2,
        c.grid,
        c.tableY,
        this.table ? 9.81 : 0,
        colliders,
        this.table ? 1 : 0,
        alpha,
        inputDt,
        c.spacing,
        this.table ? 0.7 : 3.0,
      ],
      k,
    );
  }
  dispatch(pass, name, count, group, offset) {
    pass.setPipeline(this.pipelines[name]);
    pass.setBindGroup(0, group, [offset * 256]);
    pass.dispatchWorkgroups(
      Math.ceil(
        count /
          (name === "finishSurface"
            ? 1
            : [
                  "prepare",
                  "compress",
                  "clearBins",
                  "gridVelocity",
                  "clearSurface",
                ].includes(name)
              ? 128
              : 64),
      ),
    );
  }
  encode(
    encoder,
    elapsed,
    handData,
    { steps = null, surface = true, timestampWrites = undefined } = {},
  ) {
    if (this.fault) return;
    const c = this.config;
    const inputDt = Math.max(
      0.001,
      Math.min(handData.sampleDt ?? elapsed, 0.1),
    );
    const accepted = Math.min(elapsed, 0.04);
    this.droppedSeconds += Math.max(0, elapsed - accepted);
    this.accumulator += accepted;
    const count = steps ?? Math.min(30, Math.floor(this.accumulator / c.dt));
    if (steps === null) this.accumulator -= count * c.dt;
    else this.accumulator = 0;
    this.device.queue.writeBuffer(this.hands, 0, handData);
    const numHands = handData.length / 20;
    for (let i = 0; i < count; i++)
      this.writeUniform(
        i,
        c.dt,
        (i + 1) / Math.max(1, count),
        inputDt,
        numHands,
      );
    this.writeUniform(count, c.dt, 1, inputDt, numHands);
    this.device.queue.writeBuffer(
      this.params,
      0,
      this.cpuUniforms.buffer,
      0,
      (count + 1) * 256,
    );
    const pass = encoder.beginComputePass({
      label: "clay simulation",
      timestampWrites,
    });
    const n = this.count,
      corners = n * 27,
      grid = c.grid ** 3;
    const run = (name, total, offset, group = this.physicsGroup) =>
      this.dispatch(pass, name, total, group, offset);
    if (this.pendingPlacement) {
      this.device.queue.writeBuffer(
        this.bins,
        16,
        new Uint32Array([0xffffffff]),
      );
      run("placementBounds", n, 0);
      run("placeOnTable", n, 0);
      this.pendingPlacement = false;
    }
    for (let i = 0; i < count; i++) {
      run("clearBins", grid, i);
      run("prepare", corners, i);
      run("binParticles", n, i);
      run("validateLinks", n, i);
      run("connect", corners, i);
      run("compress", corners, i);
      run("constitutive", n, i);
      run("graspForces", n, i);
      run("p2g", n, i);
      run("gridVelocity", corners, i);
      run("fieldContact", corners, i);
      run("g2p", n, i);
      run("scatterJacobian", n, i);
      run("projectVolume", n, i);
      run("topology", n, i);
      run("weldCandidates", n, i);
    }
    if (surface) {
      run("clearBins", grid, count);
      run("prepare", corners, count);
      run("binParticles", n, count);
      run("validateLinks", n, count);
      run("connect", corners, count);
      run("compress", corners, count);
      run("clearSurface", CONFIG.hashSize, count, this.surfaceGroup);
      run("markSurface", n, count, this.surfaceGroup);
      run("sampleSurface", CONFIG.hashSize, count, this.surfaceGroup);
      run("extractSurface", CONFIG.hashSize, count, this.surfaceGroup);
      run("finishSurface", 1, count, this.surfaceGroup);
    }
    pass.end();
    this.frame++;
    this.simulatedSeconds += count * c.dt;
    return count;
  }
  async read(buffer, size = buffer.size) {
    const b = this.device.createBuffer({
      size,
      usage: U().COPY_DST | U().MAP_READ,
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(buffer, 0, b, 0, size);
    this.device.queue.submit([encoder.finish()]);
    await b.mapAsync(GPUMapMode.READ);
    const result = b.getMappedRange().slice(0);
    b.unmap();
    b.destroy();
    return result;
  }
  async diagnostics() {
    const generation = this.generation;
    const [raw, draw] = await Promise.all([
      this.read(this.bins, 64),
      this.read(this.draw, 32),
    ]);
    if (generation !== this.generation) return null;
    const a = new Uint32Array(raw);
    this.fault = a[0];
    return {
      fault: a[0],
      brokenDirectedLinks: a[1],
      weldedDirectedLinks: a[2],
      weldCapacityEvents: a[3],
      vertices: new Uint32Array(draw)[0],
      particles: this.count,
      materialVolume: this.volume,
      simulatedSeconds: this.simulatedSeconds,
      droppedSeconds: this.droppedSeconds,
    };
  }
  async snapshot() {
    const [p, e, d] = await Promise.all([
      this.read(this.particles),
      this.read(this.edges),
      this.diagnostics(),
    ]);
    return {
      particles: new Float32Array(p),
      edges: new Uint32Array(e),
      diagnostics: d,
    };
  }
}
