export class GpuTimer {
  constructor(device) {
    this.device = device;
    this.available = device.features.has("timestamp-query");
    this.pending = false;
    this.last = -10000;
    this.samples = [];
    if (!this.available) return;
    this.queries = device.createQuerySet({ type: "timestamp", count: 4 });
    this.resolve = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    this.read = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }
  begin(time) {
    this.active = this.available && !this.pending && time - this.last > 1000;
    if (!this.active) return undefined;
    this.last = time;
    return {
      querySet: this.queries,
      beginningOfPassWriteIndex: 0,
      endOfPassWriteIndex: 1,
    };
  }
  renderWrites() {
    return this.active
      ? {
          querySet: this.queries,
          beginningOfPassWriteIndex: 2,
          endOfPassWriteIndex: 3,
        }
      : undefined;
  }
  finish(encoder) {
    if (!this.active) return;
    encoder.resolveQuerySet(this.queries, 0, 4, this.resolve, 0);
    encoder.copyBufferToBuffer(this.resolve, 0, this.read, 0, 32);
    this.pending = true;
  }
  async submitted() {
    if (!this.active) return;
    this.active = false;
    try {
      await this.read.mapAsync(GPUMapMode.READ);
      const a = new BigUint64Array(this.read.getMappedRange());
      this.samples.push({
        computeMs: Number(a[1] - a[0]) / 1e6,
        totalMs: Number(a[3] - a[0]) / 1e6,
      });
      if (this.samples.length > 600) this.samples.shift();
      this.read.unmap();
    } finally {
      this.pending = false;
    }
  }
}
