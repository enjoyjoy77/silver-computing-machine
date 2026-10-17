// Explicit experimental transport for browsers without XRGPUBinding.
// Physics stays on WebGPU. Mesh snapshots are copied asynchronously; XR never
// waits for mapAsync. The measured snapshot age is exposed in diagnostics.
import { makeAtlas, textGeometry, makeScene } from "./renderer.js";
import { matmul } from "./math.js";
export class CompatibilityRenderer {
  static async create(device, capacity) {
    const r = new CompatibilityRenderer();
    r.device = device;
    r.capacity = capacity;
    r.canvas = document.createElement("canvas");
    const gl = r.canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      xrCompatible: true,
    });
    if (!gl) throw Error("互換表示を開始できません。");
    r.gl = gl;
    await gl.makeXRCompatible();
    const vs = `#version 300 es
  precision highp float;layout(location=0)in vec4 a;layout(location=1)in vec4 n;uniform mat4 vp;uniform mat4 model;out vec3 normal;out vec3 world;out float material;out vec2 uv;void main(){vec4 p=model*vec4(a.xyz,1.);gl_Position=vp*p;world=p.xyz;normal=(model*vec4(n.xyz,0.)).xyz;material=n.w;uv=n.xy;}`;
    const fs = `#version 300 es
  precision highp float;in vec3 normal;in vec3 world;in float material;in vec2 uv;uniform vec3 eye;uniform bool textPass;uniform sampler2D atlas;out vec4 color;void main(){if(textPass){color=texture(atlas,uv);if(color.a<.05)discard;return;}vec3 n=normalize(normal),light=normalize(vec3(-.4,1.,.65));vec3 base=vec3(.65,.34,.20);if(material>.5)base=vec3(.48,.69,.65);if(material>1.5)base=vec3(.27,.25,.23);if(material>2.5)base=vec3(.66,.45,.27);float spec=pow(max(0.,dot(n,normalize(light+normalize(eye-world)))),30.)*.06;color=vec4(pow(base*(.52+.48*max(0.,dot(n,light)))+vec3(spec),vec3(1./2.2)),1.);}`;
    const shader = (type, code) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(s));
      return s;
    };
    r.program = gl.createProgram();
    gl.attachShader(r.program, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(r.program, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(r.program);
    if (!gl.getProgramParameter(r.program, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(r.program));
    r.locations = Object.fromEntries(
      ["vp", "model", "eye", "textPass", "atlas"].map((n) => [
        n,
        gl.getUniformLocation(r.program, n),
      ]),
    );
    r.mesh = gl.createBuffer();
    r.scene = gl.createBuffer();
    r.text = gl.createBuffer();
    const text = textGeometry();
    r.textCount = text.length / 8;
    gl.bindBuffer(gl.ARRAY_BUFFER, r.text);
    gl.bufferData(gl.ARRAY_BUFFER, text, gl.STATIC_DRAW);
    r.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, r.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      makeAtlas(),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    r.staging = device.createBuffer({
      size: capacity,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    r.command = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    r.pending = false;
    r.count = 0;
    r.capturedAt = 0;
    r.latencyMs = 0;
    r.lastCapture = -1000;
    return r;
  }
  capture(encoder, simulation, time) {
    if (this.pending || time - this.lastCapture < 40) return false;
    this.pending = true;
    this.lastCapture = time;
    this.captureStart = performance.now();
    encoder.copyBufferToBuffer(
      simulation.vertices,
      0,
      this.staging,
      0,
      this.capacity,
    );
    encoder.copyBufferToBuffer(simulation.draw, 0, this.command, 0, 32);
    return true;
  }
  async receive() {
    try {
      await this.command.mapAsync(GPUMapMode.READ);
      const count = new Uint32Array(this.command.getMappedRange())[0];
      this.command.unmap();
      if (count * 32 > this.capacity || count % 3)
        throw Error("互換表示の形状サイズが不正です");
      if (count) {
        await this.staging.mapAsync(GPUMapMode.READ, 0, count * 32);
        const data = new Float32Array(
          this.staging.getMappedRange(0, count * 32),
        );
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.mesh);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);
        this.staging.unmap();
      }
      this.count = count;
      this.latencyMs = performance.now() - this.captureStart;
      this.capturedAt = performance.now();
    } finally {
      this.pending = false;
    }
  }
  update(hands, table) {
    const data = makeScene(hands, table);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.scene);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);
    this.sceneCount = data.length / 8;
  }
  draw(buffer, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }
  render(pose, layer, model) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.locations.model, false, model);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.locations.atlas, 0);
    for (const view of pose.views) {
      const viewport = layer.getViewport(view),
        p = view.transform.position;
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      gl.uniformMatrix4fv(
        this.locations.vp,
        false,
        matmul(view.projectionMatrix, view.transform.inverse.matrix),
      );
      gl.uniform3f(this.locations.eye, p.x, p.y, p.z);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.uniform1i(this.locations.textPass, 0);
      if (this.count) this.draw(this.mesh, this.count);
      this.draw(this.scene, this.sceneCount);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(this.locations.textPass, 1);
      this.draw(this.text, this.textCount);
      gl.depthMask(true);
    }
  }
}
