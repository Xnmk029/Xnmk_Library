/* ============================================================
 * engine.js — WebGPU 渲染引擎
 *  阴影深度 → G-Buffer → 光照(PBR+IBL+SSAO+软阴影) 累积 → 粒子 → 色调映射 → FXAA
 * ============================================================ */
"use strict";
(function () {
  const M = VT4.M;

  class Engine {
    async init(canvas) {
      this.canvas = canvas;
      if (!navigator.gpu) throw new Error("navigator.gpu 不存在 —— 需要支持 WebGPU 的浏览器");
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) throw new Error("无法获取 WebGPU 适配器");
      this.device = await adapter.requestDevice();
      this.ctx = canvas.getContext("webgpu");
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.ctx.configure({ device: this.device, format: this.format, alphaMode: "opaque" });

      this.sampleCount = 0;       // 累积样本数
      this.frameIdx = 0;
      this.mode = "preview";
      this.maxTex = this.device.limits.maxTextureDimension2D || 8192;

      // ---- uniform / storage ----
      this.frameUBO = this.device.createBuffer({ size: 576, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.matsUBO = this.device.createBuffer({ size: 32 * 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.partBuf = this.device.createBuffer({ size: 3 * 64 * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      this.dpUBO = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.dp2UBO = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.scUBO = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

      this.dustCap = 2600;
      this.dustBuf = this.device.createBuffer({ size: this.dustCap * 24, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });

      // samplers
      this.smpNearest = this.device.createSampler({ magFilter: "nearest", minFilter: "nearest" });
      this.smpLinear = this.device.createSampler({ magFilter: "linear", minFilter: "linear" });
      this.smpCmp = this.device.createSampler({ compare: "less" });

      // ---- pipelines ----
      const vbLayout = [{
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" },
          { shaderLocation: 2, offset: 24, format: "float32" },
          { shaderLocation: 3, offset: 28, format: "float32" }],
      }];
      const bgl0 = this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ]});
      const pl0 = this.device.createPipelineLayout({ bindGroupLayouts: [bgl0] });
      this.bgl0 = bgl0;

      const mkMod = src => this.device.createShaderModule({ code: src });

      this.pipeShadow = this.device.createRenderPipeline({
        layout: pl0,
        vertex: { module: mkMod(VT4.WGSL.shadow), entryPoint: "vs", buffers: vbLayout },
        depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" },
        primitive: { cullMode: "none" },
      });
      this.pipeGbuf = this.device.createRenderPipeline({
        layout: pl0,
        vertex: { module: mkMod(VT4.WGSL.gbuffer), entryPoint: "vs", buffers: vbLayout },
        fragment: {
          module: mkMod(VT4.WGSL.gbuffer), entryPoint: "fs",
          targets: [{ format: "rgba16float" }, { format: "rgba16float" }],
        },
        depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" },
        primitive: { cullMode: "none" },
      });

      const bglLight = this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "non-filtering" } },
      ]});
      this.pipeLight = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl0, bglLight] }),
        vertex: { module: mkMod(VT4.WGSL.light), entryPoint: "vs" },
        fragment: {
          module: mkMod(VT4.WGSL.light), entryPoint: "fs",
          targets: [{
            format: "rgba16float",
            blend: { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } },
          }],
        },
      });
      this.bglLight = bglLight;

      this.pipeDust = this.device.createRenderPipeline({
        layout: pl0,
        vertex: {
          module: mkMod(VT4.WGSL.dust), entryPoint: "vs",
          buffers: [{
            arrayStride: 24, stepMode: "instance",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x4" },
              { shaderLocation: 1, offset: 16, format: "float32x2" }],
          }],
        },
        fragment: {
          module: mkMod(VT4.WGSL.dust), entryPoint: "fs",
          targets: [{
            format: "rgba16float",
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one" },
              alpha: { srcFactor: "one", dstFactor: "one" } },
          }],
        },
        depthStencil: { format: "depth32float", depthWriteEnabled: false, depthCompare: "less" },
        primitive: { cullMode: "none" },
      });

      const bglDisp = this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "non-filtering" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ]});
      this.pipeDisplay = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [bglDisp] }),
        vertex: { module: mkMod(VT4.WGSL.display), entryPoint: "vs" },
        fragment: { module: mkMod(VT4.WGSL.display), entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
      });
      this.bglDisp = bglDisp;

      const bglFxaa = this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ]});
      this.pipeFxaa = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [bglFxaa] }),
        vertex: { module: mkMod(VT4.WGSL.fxaa), entryPoint: "vs" },
        fragment: { module: mkMod(VT4.WGSL.fxaa), entryPoint: "fs", targets: [{ format: this.format }] },
      });
      this.bglFxaa = bglFxaa;

      this.bg0 = this.device.createBindGroup({
        layout: bgl0,
        entries: [
          { binding: 0, resource: { buffer: this.frameUBO } },
          { binding: 1, resource: { buffer: this.partBuf } },
          { binding: 2, resource: { buffer: this.matsUBO } }],
      });

      // 材质表上传
      const md = new Float32Array(32 * 8);
      VT4.matList.forEach((m, i) => {
        md[i * 8] = m.c[0]; md[i * 8 + 1] = m.c[1]; md[i * 8 + 2] = m.c[2]; md[i * 8 + 3] = 1;
        md[i * 8 + 4] = m.metal; md[i * 8 + 5] = m.rough; md[i * 8 + 6] = m.emis || 0; md[i * 8 + 7] = 0;
      });
      this.device.queue.writeBuffer(this.matsUBO, 0, md);

      // 阴影贴图
      this.shadowTex = this.device.createTexture({
        size: [2048, 2048], format: "depth32float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.shadowView = this.shadowTex.createView();

      this.renderScale = 1;
      this.tank = null; this.terrain = null;
      this.resize();
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(64, Math.floor(this.canvas.clientWidth * dpr * this.renderScale));
      const h = Math.max(64, Math.floor(this.canvas.clientHeight * dpr * this.renderScale));
      if (this.w === w && this.h === h) return;
      this.w = w; this.h = h;
      this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
      this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
      if (this.gA) { this.gA.destroy(); this.gB.destroy(); this.gD.destroy(); this.acc.destroy(); this.ldr.destroy(); }
      this.gA = this.device.createTexture({ size: [w, h], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.gB = this.device.createTexture({ size: [w, h], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.gD = this.device.createTexture({ size: [w, h], format: "depth32float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.acc = this.device.createTexture({ size: [w, h], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.ldr = this.device.createTexture({ size: [w, h], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.gAView = this.gA.createView(); this.gBView = this.gB.createView();
      this.gDView = this.gD.createView(); this.accView = this.acc.createView(); this.ldrView = this.ldr.createView();
      this.bgLight = this.device.createBindGroup({ layout: this.bglLight, entries: [
        { binding: 0, resource: this.gA.createView() },
        { binding: 1, resource: this.gB.createView() },
        { binding: 2, resource: this.gD.createView() },
        { binding: 3, resource: this.shadowView },
        { binding: 4, resource: this.smpCmp },
        { binding: 5, resource: this.smpNearest },
      ]});
      this.bgDisp = this.device.createBindGroup({ layout: this.bglDisp, entries: [
        { binding: 0, resource: this.acc.createView() },
        { binding: 1, resource: this.smpNearest },
        { binding: 2, resource: { buffer: this.dpUBO } },
        { binding: 3, resource: { buffer: this.dp2UBO } },
      ]});
      this.bgFxaa = this.device.createBindGroup({ layout: this.bglFxaa, entries: [
        { binding: 0, resource: this.ldr.createView() },
        { binding: 1, resource: this.smpLinear },
        { binding: 2, resource: { buffer: this.scUBO } },
      ]});
      this.resetAccum();
    }

    _mkMesh(mesh) {
      const vbuf = this.device.createBuffer({ size: mesh.verts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      const ibuf = this.device.createBuffer({ size: mesh.idx.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
      this.device.queue.writeBuffer(vbuf, 0, mesh.verts);
      this.device.queue.writeBuffer(ibuf, 0, mesh.idx);
      return { vbuf, ibuf, ni: mesh.idx.length, aabb: mesh.aabb };
    }
    setTank(mesh) { if (this.tank) { this.tank.vbuf.destroy(); this.tank.ibuf.destroy(); } this.tank = this._mkMesh(mesh); this.resetAccum(); }
    setTerrain(mesh) { if (this.terrain) { this.terrain.vbuf.destroy(); this.terrain.ibuf.destroy(); } this.terrain = this._mkMesh(mesh); }

    resetAccum() { this.sampleCount = 0; }

    /* 零件表上传: vis[i]=0/1, hl[i]=0..1 */
    updateParts(vis, hl) {
      const d = new Float32Array(3 * 64 * 4);
      VT4.partList.forEach((p, i) => {
        d[i * 4] = p.dir[0]; d[i * 4 + 1] = p.dir[1]; d[i * 4 + 2] = p.dir[2];
        d[i * 4 + 3] = vis[i] ? 1 : 0;
        const j = 64 * 4 + i * 4;
        d[j] = hl[i] || 0;
        d[j + 1] = p.shell ? 1 : 0;
        d[j + 2] = VT4.GUN_PARTS.has(i) ? 1 : 0;
        d[j + 3] = 7;   // 常驻可见掩码
        d[128 * 4 + i * 4] = (p.sys === "interior" || p.sys === "crew") ? 1 : 0;  // 舱内填充光标志
      });
      this.device.queue.writeBuffer(this.partBuf, 0, d);
    }

    updateDust(dust) {
      this.device.queue.writeBuffer(this.dustBuf, 0, dust.data, 0, dust.n * 6);
      this.dustCount = dust.count();
    }

    /* 帧输入
     * in: {eye,fwd,right,up,fovY,near,far,focusDist,apR,explode,gunElev,xray,
     *      clip:[n,d]|null, env, ao, soft, vmVariant, time, ev, tonemap, fx}
     */
    render(inp, accum) {
      const dev = this.device;
      const f = new Float32Array(144);
      const W = this.w, H = this.h;

      // 相机抖动: AA 亚像素 + 光圈盘(DOF)
      const rnd = () => Math.random() - 0.5;
      let jx = 0, jy = 0, ex = 0, ey = 0;
      if (accum) {
        jx = rnd() * 2 / W; jy = rnd() * 2 / H;
        const a = Math.random() * M.TAU, r = Math.sqrt(Math.random()) * (inp.apR || 0);
        ex = Math.cos(a) * r; ey = Math.sin(a) * r;
      }
      const eye = M.add(inp.eye, M.add(M.scale(inp.right, ex), M.scale(inp.up, ey)));
      const focusPt = M.add(inp.eye, M.scale(inp.fwd, inp.focusDist));
      const view = M.lookAt(eye, focusPt, inp.up);
      const proj = M.persp(inp.fovY, W / H, inp.near, inp.far);
      proj[8] -= jx; proj[9] -= jy;
      const viewProj = M.mul(proj, view);

      const env = inp.env;
      const sd = M.norm(env.sunDir);
      // 灯光矩阵(阴影): 正交覆盖车体
      const lv = M.lookAt(M.scale(sd, 18), [0, 0.9, 0], [0, 1, 0]);
      const lp = M.ortho(-9.5, 9.5, -9.5, 9.5, 0.5, 38);
      const lightVP = M.mul(lp, lv);

      f.set(viewProj, 0); f.set(view, 16); f.set(M.invert(viewProj), 32); f.set(M.invert(proj), 48);
      f.set(proj, 64); f.set(lightVP, 80);
      f.set([eye[0], eye[1], eye[2], Math.pow(2, inp.ev)], 96);
      f.set([sd[0], sd[1], sd[2], env.sunI], 100);
      f.set([env.sunCol[0], env.sunCol[1], env.sunCol[2], env.sunR], 104);
      f.set([env.zenith[0], env.zenith[1], env.zenith[2], env.amb], 108);
      f.set([env.horizon[0], env.horizon[1], env.horizon[2], env.haze], 112);
      f.set([env.ground[0], env.ground[1], env.ground[2], 0], 116);
      if (inp.clip) f.set([inp.clip.n[0], inp.clip.n[1], inp.clip.n[2], inp.clip.d], 120);
      else f.set([0, 1, 0, -1e8], 120);
      f.set([this.frameIdx, inp.explode, inp.xray, inp.gunElev], 124);
      f.set([inp.ao ? 1 : 0, inp.soft ? 1 : 0, inp.vmVariant, inp.time], 128);
      f.set([VT4.DIMS.gunPivot[0], VT4.DIMS.gunPivot[1], VT4.DIMS.gunPivot[2], 0], 132);
      f.set([W, H, 1 / W, 1 / H], 136);
      dev.queue.writeBuffer(this.frameUBO, 0, f);

      const enc = dev.createCommandEncoder();

      // 1) 阴影
      {
        const p = enc.beginRenderPass({ colorAttachments: [],
          depthStencilAttachment: { view: this.shadowView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" } });
        p.setPipeline(this.pipeShadow); p.setBindGroup(0, this.bg0);
        if (this.tank) { p.setVertexBuffer(0, this.tank.vbuf); p.setIndexBuffer(this.tank.ibuf, "uint32"); p.drawIndexed(this.tank.ni); }
        if (this.terrain) { p.setVertexBuffer(0, this.terrain.vbuf); p.setIndexBuffer(this.terrain.ibuf, "uint32"); p.drawIndexed(this.terrain.ni); }
        p.end();
      }
      // 2) G-Buffer
      {
        const p = enc.beginRenderPass({
          colorAttachments: [
            { view: this.gAView, clearValue: [0, 0, 0, -1], loadOp: "clear", storeOp: "store" },
            { view: this.gBView, clearValue: [0, 0, 0, -1], loadOp: "clear", storeOp: "store" }],
          depthStencilAttachment: { view: this.gDView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" } });
        p.setPipeline(this.pipeGbuf); p.setBindGroup(0, this.bg0);
        if (this.terrain) { p.setVertexBuffer(0, this.terrain.vbuf); p.setIndexBuffer(this.terrain.ibuf, "uint32"); p.drawIndexed(this.terrain.ni); }
        if (this.tank) { p.setVertexBuffer(0, this.tank.vbuf); p.setIndexBuffer(this.tank.ibuf, "uint32"); p.drawIndexed(this.tank.ni); }
        p.end();
      }
      // 3) 光照 → 累积
      {
        const p = enc.beginRenderPass({ colorAttachments: [{
          view: this.accView, clearValue: [0, 0, 0, 0],
          loadOp: this.sampleCount === 0 ? "clear" : "load", storeOp: "store" }] });
        p.setPipeline(this.pipeLight); p.setBindGroup(0, this.bg0); p.setBindGroup(1, this.bgLight);
        p.draw(3); p.end();
      }
      // 4) 粒子 → 累积
      if (this.dustCount > 0) {
        const p = enc.beginRenderPass({
          colorAttachments: [{ view: this.accView, loadOp: "load", storeOp: "store" }],
          depthStencilAttachment: { view: this.gDView, depthLoadOp: "load", depthStoreOp: "store" } });
        p.setPipeline(this.pipeDust); p.setBindGroup(0, this.bg0);
        p.setVertexBuffer(0, this.dustBuf);
        p.draw(6, this.dustCount); p.end();
      }
      // 5) 色调映射 → LDR
      {
        dev.queue.writeBuffer(this.dpUBO, 0, new Float32Array([Math.max(this.sampleCount + 1, 1), Math.pow(2, inp.ev), inp.tonemap, inp.fx ? 1 : 0]));
        dev.queue.writeBuffer(this.dp2UBO, 0, new Float32Array([this.frameIdx, W, H, 0]));
        const p = enc.beginRenderPass({ colorAttachments: [{ view: this.ldrView, clearValue: [0,0,0,1], loadOp: "clear", storeOp: "store" }] });
        p.setPipeline(this.pipeDisplay); p.setBindGroup(0, this.bgDisp); p.draw(3); p.end();
      }
      // 6) FXAA → Canvas
      {
        dev.queue.writeBuffer(this.scUBO, 0, new Float32Array([1 / this.canvas.width, 1 / this.canvas.height, 0, 0]));
        const p = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), clearValue: [0,0,0,1], loadOp: "clear", storeOp: "store" }] });
        p.setPipeline(this.pipeFxaa); p.setBindGroup(0, this.bgFxaa); p.draw(3); p.end();
      }
      dev.queue.submit([enc.finish()]);
      this.sampleCount++;
      this.frameIdx++;
    }

    /* ================= 大画幅导出 ================= */
    async exportImage(W, H, samples, inp, onProgress) {
      const dev = this.device;
      W = Math.min(W, this.maxTex); H = Math.min(H, this.maxTex);
      const gA = dev.createTexture({ size: [W, H], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      const gB = dev.createTexture({ size: [W, H], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      const gD = dev.createTexture({ size: [W, H], format: "depth32float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      const acc = dev.createTexture({ size: [W, H], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      const ldr = dev.createTexture({ size: [W, H], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
      const bgL = dev.createBindGroup({ layout: this.bglLight, entries: [
        { binding: 0, resource: gA.createView() }, { binding: 1, resource: gB.createView() },
        { binding: 2, resource: gD.createView() }, { binding: 3, resource: this.shadowView },
        { binding: 4, resource: this.smpCmp }, { binding: 5, resource: this.smpNearest }] });
      const bgD = dev.createBindGroup({ layout: this.bglDisp, entries: [
        { binding: 0, resource: acc.createView() }, { binding: 1, resource: this.smpNearest },
        { binding: 2, resource: { buffer: this.dpUBO } }, { binding: 3, resource: { buffer: this.dp2UBO } }] });

      const env = inp.env, sd = M.norm(env.sunDir);
      const lv = M.lookAt(M.scale(sd, 18), [0, 0.9, 0], [0, 1, 0]);
      const lp = M.ortho(-9.5, 9.5, -9.5, 9.5, 0.5, 38);
      const lightVP = M.mul(lp, lv);

      for (let s = 0; s < samples; s++) {
        const f = new Float32Array(144);
        const rnd = () => Math.random() - 0.5;
        const a = Math.random() * M.TAU, r = Math.sqrt(Math.random()) * (inp.apR || 0);
        const ex = Math.cos(a) * r, ey = Math.sin(a) * r;
        const eye = M.add(inp.eye, M.add(M.scale(inp.right, ex), M.scale(inp.up, ey)));
        const focusPt = M.add(inp.eye, M.scale(inp.fwd, inp.focusDist));
        const view = M.lookAt(eye, focusPt, inp.up);
        const proj = M.persp(inp.fovY, W / H, inp.near, inp.far);
        proj[8] -= rnd() * 2 / W; proj[9] -= rnd() * 2 / H;
        const viewProj = M.mul(proj, view);
        f.set(viewProj, 0); f.set(view, 16); f.set(M.invert(viewProj), 32); f.set(M.invert(proj), 48);
        f.set(proj, 64); f.set(lightVP, 80);
        f.set([eye[0], eye[1], eye[2], Math.pow(2, inp.ev)], 96);
        f.set([sd[0], sd[1], sd[2], env.sunI], 100);
        f.set([env.sunCol[0], env.sunCol[1], env.sunCol[2], env.sunR], 104);
        f.set([env.zenith[0], env.zenith[1], env.zenith[2], env.amb], 108);
        f.set([env.horizon[0], env.horizon[1], env.horizon[2], env.haze], 112);
        f.set([env.ground[0], env.ground[1], env.ground[2], 0], 116);
        if (inp.clip) f.set([inp.clip.n[0], inp.clip.n[1], inp.clip.n[2], inp.clip.d], 120);
        else f.set([0, 1, 0, -1e8], 120);
        f.set([s, inp.explode, inp.xray, inp.gunElev], 124);
        f.set([inp.ao ? 1 : 0, inp.soft ? 1 : 0, inp.vmVariant, s], 128);
        f.set([VT4.DIMS.gunPivot[0], VT4.DIMS.gunPivot[1], VT4.DIMS.gunPivot[2], 0], 132);
        f.set([W, H, 1 / W, 1 / H], 136);
        dev.queue.writeBuffer(this.frameUBO, 0, f);

        const enc = dev.createCommandEncoder();
        { // 阴影(每帧重算, 供软阴影采样变化)
          const p = enc.beginRenderPass({ colorAttachments: [],
            depthStencilAttachment: { view: this.shadowView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" } });
          p.setPipeline(this.pipeShadow); p.setBindGroup(0, this.bg0);
          if (this.tank) { p.setVertexBuffer(0, this.tank.vbuf); p.setIndexBuffer(this.tank.ibuf, "uint32"); p.drawIndexed(this.tank.ni); }
          if (this.terrain) { p.setVertexBuffer(0, this.terrain.vbuf); p.setIndexBuffer(this.terrain.ibuf, "uint32"); p.drawIndexed(this.terrain.ni); }
          p.end();
        }
        {
          const p = enc.beginRenderPass({
            colorAttachments: [
              { view: gA.createView(), clearValue: [0,0,0,-1], loadOp: "clear", storeOp: "store" },
              { view: gB.createView(), clearValue: [0,0,0,-1], loadOp: "clear", storeOp: "store" }],
            depthStencilAttachment: { view: gD.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" } });
          p.setPipeline(this.pipeGbuf); p.setBindGroup(0, this.bg0);
          if (this.terrain) { p.setVertexBuffer(0, this.terrain.vbuf); p.setIndexBuffer(this.terrain.ibuf, "uint32"); p.drawIndexed(this.terrain.ni); }
          if (this.tank) { p.setVertexBuffer(0, this.tank.vbuf); p.setIndexBuffer(this.tank.ibuf, "uint32"); p.drawIndexed(this.tank.ni); }
          p.end();
        }
        {
          const p = enc.beginRenderPass({ colorAttachments: [{ view: acc.createView(),
            clearValue: [0,0,0,0], loadOp: s === 0 ? "clear" : "load", storeOp: "store" }] });
          p.setPipeline(this.pipeLight); p.setBindGroup(0, this.bg0); p.setBindGroup(1, bgL);
          p.draw(3); p.end();
        }
        if (this.dustCount > 0) {
          const p = enc.beginRenderPass({
            colorAttachments: [{ view: acc.createView(), loadOp: "load", storeOp: "store" }],
            depthStencilAttachment: { view: gD.createView(), depthLoadOp: "load", depthStoreOp: "store" } });
          p.setPipeline(this.pipeDust); p.setBindGroup(0, this.bg0);
          p.setVertexBuffer(0, this.dustBuf); p.draw(6, this.dustCount); p.end();
        }
        dev.queue.submit([enc.finish()]);
        if (onProgress && (s % 8 === 7 || s === samples - 1)) {
          onProgress(s + 1, samples);
          await new Promise(r => setTimeout(r, 0));
        }
      }
      // 色调映射 → ldr
      {
        dev.queue.writeBuffer(this.dpUBO, 0, new Float32Array([samples, Math.pow(2, inp.ev), inp.tonemap, inp.fx ? 1 : 0]));
        dev.queue.writeBuffer(this.dp2UBO, 0, new Float32Array([samples, W, H, 0]));
        const enc = dev.createCommandEncoder();
        const p = enc.beginRenderPass({ colorAttachments: [{ view: ldr.createView(), clearValue: [0,0,0,1], loadOp: "clear", storeOp: "store" }] });
        p.setPipeline(this.pipeDisplay); p.setBindGroup(0, bgD); p.draw(3); p.end();
        // readback
        const bpr = Math.ceil(W * 4 / 256) * 256;
        const rb = dev.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        enc.copyTextureToBuffer({ texture: ldr }, { buffer: rb, bytesPerRow: bpr, rowsPerImage: H }, [W, H, 1]);
        dev.queue.submit([enc.finish()]);
        await rb.mapAsync(GPUMapMode.READ);
        const src = new Uint8Array(rb.getMappedRange());
        const out = new Uint8ClampedArray(W * H * 4);
        for (let y = 0; y < H; y++) out.set(src.subarray(y * bpr, y * bpr + W * 4), y * W * 4);
        rb.unmap(); rb.destroy();
        gA.destroy(); gB.destroy(); gD.destroy(); acc.destroy(); ldr.destroy();
        return { data: out, w: W, h: H };
      }
    }
  }
  VT4.Engine = Engine;
})();
