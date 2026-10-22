import {
  frustum,
  lookAt,
  mat4,
  mat4Mul,
  mat4Normal,
  mat4RotateX,
  mat4RotateY,
  mat4TransformPoint,
  mat4Translate,
  norm,
  ortho,
  perspective,
  sub,
  v3,
} from "./math.js";
import { packMaterials, PAINTS } from "./materials.js";
import { createVehicle, LABELS, LAYOUT } from "./tank.js";
import { buildGround, createDust, dustBuffer } from "./terrain.js";
import { effective } from "./state.js";
import {
  accumShader,
  instShader,
  particleShader,
  presentShader,
  shadowInstShader,
  shadowShader,
  skyShader,
  solidShader,
} from "./shaders.js";

const FRAME_FLOATS = 144;
const OBJECT_FLOATS = 64;
const INST_FLOATS = 36;
const MAX_OBJECTS = 96;

const ENVS = {
  inspect: {
    sun: [0.42, 0.86, 0.28],
    sunColor: [1, 0.97, 0.93],
    intensity: 3.6,
    angular: 0.018,
    soft: 0.0032,
    zenith: [0.52, 0.6, 0.7],
    horizon: [0.75, 0.78, 0.8],
    ground: [0.42, 0.4, 0.36],
    fog: 0.0015,
    fill: [ -0.6, 0.4, -0.3, 0.45 ],
    rim: [ -0.2, 0.35, -0.9, 0.28 ],
    fillColor: [0.85, 0.88, 0.95],
    interior: 0.15,
    bloom: 0.12,
  },
  overcast: {
    sun: [0.15, 0.95, 0.12],
    sunColor: [0.82, 0.86, 0.92],
    intensity: 2.3,
    angular: 0.08,
    soft: 0.009,
    zenith: [0.5, 0.55, 0.6],
    horizon: [0.68, 0.7, 0.72],
    ground: [0.34, 0.36, 0.32],
    fog: 0.0035,
    fill: [ -0.8, 0.5, 0.2, 0.55 ],
    rim: [ 0.4, 0.2, -0.8, 0.2 ],
    fillColor: [0.8, 0.84, 0.88],
    interior: 0.22,
    bloom: 0.1,
  },
  desert: {
    sun: [0.55, 0.78, 0.22],
    sunColor: [1, 0.9, 0.72],
    intensity: 5.4,
    angular: 0.008,
    soft: 0.0024,
    zenith: [0.28, 0.48, 0.78],
    horizon: [0.9, 0.72, 0.48],
    ground: [0.62, 0.48, 0.3],
    fog: 0.004,
    fill: [ -0.7, 0.25, -0.45, 0.28 ],
    rim: [ -0.15, 0.4, -0.85, 0.35 ],
    fillColor: [1, 0.86, 0.7],
    interior: 0.12,
    bloom: 0.22,
  },
  barracks: {
    sun: [0.2, 0.72, 0.45],
    sunColor: [0.78, 0.82, 0.88],
    intensity: 2.1,
    angular: 0.09,
    soft: 0.01,
    zenith: [0.42, 0.48, 0.52],
    horizon: [0.62, 0.64, 0.63],
    ground: [0.3, 0.33, 0.28],
    fog: 0.006,
    fill: [ -0.5, 0.55, -0.2, 0.5 ],
    rim: [ 0.2, 0.15, -0.7, 0.18 ],
    fillColor: [0.75, 0.8, 0.78],
    interior: 0.2,
    bloom: 0.12,
  },
  studio: {
    sun: [0.62, 0.7, 0.32],
    sunColor: [1, 0.98, 0.95],
    intensity: 6.2,
    angular: 0.02,
    soft: 0.0045,
    zenith: [0.035, 0.038, 0.045],
    horizon: [0.06, 0.062, 0.07],
    ground: [0.16, 0.16, 0.17],
    fog: 0.002,
    fill: [ -0.85, 0.35, 0.15, 1.15 ],
    rim: [ -0.25, 0.55, -0.85, 1.4 ],
    fillColor: [0.75, 0.82, 1],
    interior: 0.18,
    bloom: 0.28,
  },
};

function moveFree(state, dt) {
  const keys = state.keys;
  if (!keys || keys.size === 0) return;
  const f = state.free;
  const cp = Math.cos(f.pitch);
  const sp = Math.sin(f.pitch);
  const sy = Math.sin(f.yaw);
  const cy = Math.cos(f.yaw);
  const forward = [sy * cp, sp, cy * cp];
  const right = [cy, 0, -sy];
  const move = [0, 0, 0];
  if (keys.has("w")) { move[0] += forward[0]; move[1] += forward[1]; move[2] += forward[2]; }
  if (keys.has("s")) { move[0] -= forward[0]; move[1] -= forward[1]; move[2] -= forward[2]; }
  if (keys.has("d")) { move[0] += right[0]; move[2] += right[2]; }
  if (keys.has("a")) { move[0] -= right[0]; move[2] -= right[2]; }
  if (keys.has("e")) move[1] += 1;
  if (keys.has("q")) move[1] -= 1;
  const len = Math.hypot(move[0], move[1], move[2]);
  if (len < 1e-5) return;
  const s = (f.speed * (keys.has("shift") ? 3 : 1) * dt) / len;
  f.pos[0] += move[0] * s;
  f.pos[1] += move[1] * s;
  f.pos[2] += move[2] * s;
}

function halton(index, base) {
  let f = 1;
  let r = 0;
  let i = Math.max(1, index);
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

function n3(v) {
  const o = norm(v3(v[0], v[1], v[2]));
  return [o[0], o[1], o[2]];
}

async function compile(device, code, label) {
  const module = device.createShaderModule({ label, code });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === "error");
  if (errors.length) {
    throw new Error(
      `${label}\n` + errors.map((e) => `${e.lineNum}:${e.message}`).join("\n")
    );
  }
  return module;
}

function bootMark(text) {
  const el = document.getElementById("boot-text");
  if (el) el.textContent = text;
}

export async function createRenderer(canvas, state) {
  bootMark("请求 WebGPU 适配器…");
  if (!navigator.gpu) throw new Error("当前浏览器没有 WebGPU。请使用最新版 Chrome 或 Edge，并通过 http://localhost 打开。");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("没有可用的 WebGPU 适配器。");
  bootMark("创建设备…");
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  bootMark("构建车体几何…");
  const vehicle = createVehicle();
  bootMark("生成沙地…");
  const ground = buildGround();
  const dust = createDust(2400);
  bootMark("编译着色器…");
  const paintPack = packMaterials();

  const solidModule = await compile(device, solidShader, "solid");
  const instModule = await compile(device, instShader, "inst");
  const shadowModule = await compile(device, shadowShader, "shadow");
  const shadowInstModule = await compile(device, shadowInstShader, "shadow-inst");
  const skyModule = await compile(device, skyShader, "sky");
  const particleModule = await compile(device, particleShader, "particle");
  const accumModule = await compile(device, accumShader, "accum");
  const presentModule = await compile(device, presentShader, "present");
  bootMark("创建渲染管线…");

  const frameBuffer = device.createBuffer({
    size: FRAME_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const matsBuffer = device.createBuffer({
    size: paintPack.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(matsBuffer, 0, paintPack);
  const objectBuffer = device.createBuffer({
    size: MAX_OBJECTS * OBJECT_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const accUniform = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const presentUniform = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shadowMap = device.createTexture({
    size: [2048, 2048],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const shadowView = shadowMap.createView();
  const shadowSampler = device.createSampler({
    compare: "less",
    magFilter: "linear",
    minFilter: "linear",
  });
  const linear = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });

  const colorGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } },
    ],
  });
  const frameOnlyLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
  });
  const objectLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 144 },
    }],
  });
  const instLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: "read-only-storage" },
    }],
  });

  const colorBind = device.createBindGroup({
    layout: colorGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameBuffer } },
      { binding: 1, resource: { buffer: matsBuffer } },
      { binding: 2, resource: shadowView },
      { binding: 3, resource: shadowSampler },
    ],
  });
  const frameBind = device.createBindGroup({
    layout: frameOnlyLayout,
    entries: [{ binding: 0, resource: { buffer: frameBuffer } }],
  });
  const objectBind = device.createBindGroup({
    layout: objectLayout,
    entries: [{ binding: 0, resource: { buffer: objectBuffer, size: 256 } }],
  });

  const meshLayout = {
    arrayStride: 48,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x3" },
      { shaderLocation: 1, offset: 12, format: "float32x3" },
      { shaderLocation: 2, offset: 24, format: "float32x2" },
      { shaderLocation: 3, offset: 32, format: "float32x4" },
    ],
  };
  const shadowMeshLayout = {
    arrayStride: 48,
    attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
  };

  function pipeline({ module, layout, buffers, targets, depthWrite, blend, cull, pass, topology }) {
    return device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: layout }),
      vertex: { module, entryPoint: "vs", buffers: buffers || [] },
      fragment: { module, entryPoint: "fs", targets, constants: pass === undefined ? undefined : { PASS: pass } },
      primitive: { topology: topology || "triangle-list", cullMode: cull || "back", frontFace: "ccw" },
      depthStencil: depthWrite === null ? undefined : {
        format: "depth24plus",
        depthWriteEnabled: depthWrite,
        depthCompare: depthWrite ? "less" : "less",
      },
    });
  }

  const colorTarget = { format: "rgba16float" };
  const blendTarget = {
    format: "rgba16float",
    blend: {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    },
  };
  const solidLayouts = [colorGroupLayout, objectLayout];
  const instLayouts = [colorGroupLayout, instLayout];
  const pipelines = {
    solid: [0, 1, 2].map((pass) => pipeline({
      module: solidModule,
      layout: solidLayouts,
      buffers: [meshLayout],
      targets: [pass === 2 ? blendTarget : colorTarget],
      depthWrite: pass !== 2,
      cull: pass === 2 ? "none" : "back",
      pass,
    })),
    inst: [0, 1, 2].map((pass) => pipeline({
      module: instModule,
      layout: instLayouts,
      buffers: [meshLayout],
      targets: [pass === 2 ? blendTarget : colorTarget],
      depthWrite: pass !== 2,
      cull: pass === 2 ? "none" : "back",
      pass,
    })),
    shadow: device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [frameOnlyLayout, objectLayout] }),
      vertex: { module: shadowModule, entryPoint: "vs", buffers: [shadowMeshLayout] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less", depthBias: 2, depthBiasSlopeScale: 1.75 },
    }),
    shadowInst: device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [frameOnlyLayout, instLayout] }),
      vertex: { module: shadowInstModule, entryPoint: "vs", buffers: [shadowMeshLayout] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less", depthBias: 2, depthBiasSlopeScale: 1.75 },
    }),
    sky: device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [frameOnlyLayout] }),
      vertex: { module: skyModule, entryPoint: "vs" },
      fragment: { module: skyModule, entryPoint: "fs", targets: [colorTarget] },
      primitive: { topology: "triangle-list" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" },
    }),
    particle: device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [frameOnlyLayout] }),
      vertex: {
        module: particleModule,
        entryPoint: "vs",
        buffers: [
          { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] },
          {
            arrayStride: 24,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 1, offset: 0, format: "float32x3" },
              { shaderLocation: 2, offset: 12, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: particleModule,
        entryPoint: "fs",
        targets: [blendTarget],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
    }),
  };

  const accumLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ],
  });
  const accumPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [accumLayout] }),
    vertex: { module: accumModule, entryPoint: "vs" },
    fragment: { module: accumModule, entryPoint: "fs", targets: [{ format: "rgba16float" }] },
    primitive: { topology: "triangle-list" },
  });
  const presentLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ],
  });
  const presentPipes = new Map();
  function presentPipe(fmt) {
    if (!presentPipes.has(fmt)) {
      presentPipes.set(fmt, device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [presentLayout] }),
        vertex: { module: presentModule, entryPoint: "vs" },
        fragment: { module: presentModule, entryPoint: "fs", targets: [{ format: fmt }] },
        primitive: { topology: "triangle-list" },
      }));
    }
    return presentPipes.get(fmt);
  }

  const quad = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(quad.getMappedRange()).set([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
  quad.unmap();

  function uploadMesh(src) {
    const buffer = device.createBuffer({
      size: Math.max(src.data.byteLength, 16),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    if (src.data.byteLength) device.queue.writeBuffer(buffer, 0, src.data);
    return { ...src, buffer };
  }
  const meshes = new Map();
  for (const src of vehicle.buffers) meshes.set(src.id, uploadMesh(src));
  const groundMesh = uploadMesh({ id: "ground", data: ground.data, ranges: ground.ranges, vertexCount: ground.vertexCount });

  function makeInst(capacity) {
    const buffer = device.createBuffer({
      size: capacity * INST_FLOATS * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const color = device.createBindGroup({
      layout: instLayout,
      entries: [{ binding: 0, resource: { buffer } }],
    });
    const shadow = device.createBindGroup({
      layout: instLayout,
      entries: [{ binding: 0, resource: { buffer } }],
    });
    return { buffer, color, shadow, capacity, cpu: new Float32Array(capacity * INST_FLOATS) };
  }
  const inst = {
    wheel: makeInst(16),
    sprocket: makeInst(4),
    idler: makeInst(4),
    roller: makeInst(8),
    link: makeInst(vehicle.gear.linkCount * 2 + 4),
    fan: makeInst(4),
  };

  const particleBuffer = device.createBuffer({
    size: dust.parts.length * 24,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  let screen = null;
  let spp = 0;
  let accumRead = 0;
  let visualKey = "";
  let paused = false;
  let travel = 0;
  let fanSpin = 0;
  let last = performance.now();
  let fps = 60;
  let raf = 0;
  const objectCPU = new Float32Array(MAX_OBJECTS * OBJECT_FLOATS);
  const frameCPU = new Float32Array(FRAME_FLOATS);

  function ensureScreen(w, h) {
    if (screen && screen.w === w && screen.h === h) return;
    screen?.color?.destroy();
    screen?.depth?.destroy();
    screen?.hist?.[0]?.destroy();
    screen?.hist?.[1]?.destroy();
    const make = (fmt, usage) => device.createTexture({ size: [w, h], format: fmt, usage });
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    screen = {
      w, h,
      color: make("rgba16float", usage),
      depth: device.createTexture({ size: [w, h], format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT }),
      hist: [make("rgba16float", usage), make("rgba16float", usage)],
    };
    spp = 0;
  }

  function writeInstance(slot, index, model, highlight = 0, interior = 0) {
    const o = index * INST_FLOATS;
    slot.cpu.set(model, o);
    slot.cpu.set(mat4Normal(model), o + 16);
    slot.cpu[o + 32] = highlight;
    slot.cpu[o + 33] = interior;
  }

  function orbitEye(cam) {
    const cy = Math.cos(cam.pitch);
    return [
      cam.target[0] + Math.sin(cam.yaw) * cy * cam.dist,
      cam.target[1] + Math.sin(cam.pitch) * cam.dist,
      cam.target[2] + Math.cos(cam.yaw) * cy * cam.dist,
    ];
  }

  function cameraEye(eff) {
    if (eff.camMode === "free") {
      const f = state.free;
      const cp = Math.cos(f.pitch);
      const sp = Math.sin(f.pitch);
      const sy = Math.sin(f.yaw);
      const cy = Math.cos(f.yaw);
      const forward = v3(sy * cp, sp, cy * cp);
      const target = [f.pos[0] + forward[0], f.pos[1] + forward[1], f.pos[2] + forward[2]];
      return { eye: f.pos, target, focus: eff.focus };
    }
    const eye = orbitEye(eff.camera);
    return { eye, target: eff.camera.target, focus: eff.autoFocus ? eff.camera.dist : eff.focus };
  }

  function lensCamera(eye, target, focusDist, radius, sampleIndex) {
    const e = v3(eye[0], eye[1], eye[2]);
    const t = v3(target[0], target[1], target[2]);
    const forward = norm(sub(t, e));
    const up = v3(0, 1, 0);
    let right = norm(v3(
      up[1] * forward[2] - up[2] * forward[1],
      up[2] * forward[0] - up[0] * forward[2],
      up[0] * forward[1] - up[1] * forward[0]
    ));
    const cup = norm(v3(
      forward[1] * right[2] - forward[2] * right[1],
      forward[2] * right[0] - forward[0] * right[2],
      forward[0] * right[1] - forward[1] * right[0]
    ));
    const focal = [
      e[0] + forward[0] * focusDist,
      e[1] + forward[1] * focusDist,
      e[2] + forward[2] * focusDist,
    ];
    if (radius < 1e-5) return { eye, target: focal };
    const r = radius * Math.sqrt(halton(sampleIndex + 1, 2));
    const a = halton(sampleIndex + 1, 3) * Math.PI * 2;
    const ox = Math.cos(a) * r;
    const oy = Math.sin(a) * r;
    return {
      eye: [
        eye[0] + right[0] * ox + cup[0] * oy,
        eye[1] + right[1] * ox + cup[1] * oy,
        eye[2] + right[2] * ox + cup[2] * oy,
      ],
      target: focal,
    };
  }

  function packFrame(viewProj, view, proj, shadowVP, eye, eff, env, sampleIndex, jitter, w, h) {
    frameCPU.set(viewProj, 0);
    frameCPU.set(view, 16);
    frameCPU.set(proj, 32);
    frameCPU.set(shadowVP, 48);
    let o = 64;
    const v4 = (a, b, c, d) => {
      frameCPU[o++] = a;
      frameCPU[o++] = b;
      frameCPU[o++] = c;
      frameCPU[o++] = d;
    };
    const paint = PAINTS[eff.paint] || PAINTS.olive;
    const sun = n3(env.sun);
    v4(eye[0], eye[1], eye[2], performance.now() * 0.001);
    v4(sun[0], sun[1], sun[2], env.intensity);
    v4(env.sunColor[0], env.sunColor[1], env.sunColor[2], env.angular);
    v4(env.zenith[0], env.zenith[1], env.zenith[2], 0);
    v4(env.horizon[0], env.horizon[1], env.horizon[2], 0);
    v4(env.ground[0], env.ground[1], env.ground[2], 0);
    v4(eff.exposure, eff.highlight ? 1 : 0, eff.xray ? 1 : 0, eff.tech ? 1 : 0);
    v4(eff.clip ? 1 : 0, sampleIndex, env === ENVS.studio ? 1 : 0, eff.paint === "tri" ? 2 : eff.paint === "sand" ? 1 : 0);
    const axis = eff.clipAxis || "x";
    const n = axis === "y" ? [0, 1, 0] : axis === "z" ? [0, 0, 1] : [1, 0, 0];
    v4(n[0], n[1], n[2], -eff.clipPos);
    v4(jitter[0], jitter[1], w, h);
    v4(env.fill[0], env.fill[1], env.fill[2], env.fill[3]);
    v4(env.rim[0], env.rim[1], env.rim[2], env.rim[3]);
    v4(env.fillColor[0], env.fillColor[1], env.fillColor[2], env.fog);
    v4(eff.tonemap, env.soft, eff.xray || eff.clip ? 1.15 : env.interior, 0);
    v4(paint.base[0], paint.base[1], paint.base[2], 0);
    v4(paint.dark[0], paint.dark[1], paint.dark[2], 0);
    v4(paint.era[0], paint.era[1], paint.era[2], 0);
    v4(paint.era2[0], paint.era2[1], paint.era2[2], 0);
    v4(paint.cloth[0], paint.cloth[1], paint.cloth[2], 0);
    v4(paint.helmet[0], paint.helmet[1], paint.helmet[2], 0);
    device.queue.writeBuffer(frameBuffer, 0, frameCPU);
  }

  function spacesOf(eff) {
    const turret = mat4Mul(mat4Translate(0, LAYOUT.deckY, LAYOUT.turretZ), mat4RotateY(eff.turretYaw));
    const gun = mat4Mul(
      turret,
      mat4Mul(mat4Translate(LAYOUT.trunnion[0], LAYOUT.trunnion[1], LAYOUT.trunnion[2]), mat4RotateX(-eff.gunElev))
    );
    return { hull: mat4(), turret, gun, world: mat4() };
  }

  function pushObject(draws, mesh, range, model) {
    if (range.count <= 0 || draws.length >= MAX_OBJECTS) return;
    const index = draws.length;
    const o = index * OBJECT_FLOATS;
    objectCPU.set(model, o);
    objectCPU.set(mat4Normal(model), o + 16);
    draws.push({ mesh, first: range.first, count: range.count, index, interior: !!range.interior, shadow: range.shadow !== false });
  }

  function buildDraws(eff) {
    const spaces = spacesOf(eff);
    const draws = [];
    const k = eff.explode;
    const consider = (range) => {
      if ((range.variants & eff.variantBit) === 0) return false;
      if (range.system !== "ground" && eff.show[range.system] === false) return false;
      return true;
    };
    const addMesh = (mesh) => {
      for (const range of mesh.ranges) {
        if (!consider(range)) continue;
        let model = spaces[range.space] || spaces.hull;
        if (k > 0 && range.explode) {
          model = mat4Mul(mat4Translate(range.explode[0] * k, range.explode[1] * k, range.explode[2] * k), model);
        }
        pushObject(draws, mesh, range, model);
      }
    };
    for (const mesh of meshes.values()) {
      if (mesh.ranges?.length) addMesh(mesh);
    }
    addMesh(groundMesh);
    device.queue.writeBuffer(objectBuffer, 0, objectCPU.subarray(0, Math.max(1, draws.length) * OBJECT_FLOATS));
    return { draws, spaces };
  }

  function updateGear(eff, dt) {
    if (eff.running) travel += dt * 1.35;
    if (eff.xray || eff.clip || eff.running) fanSpin += dt * (eff.running ? 8 : 0.6);
    const sideShift = eff.explode * 0.9;
    let n = 0;
    for (const side of [-1, 1]) {
      for (const z of LAYOUT.wheelZ) {
        const model = mat4Mul(
          mat4Translate(side * LAYOUT.trackX + side * sideShift, LAYOUT.wheelY, z),
          mat4RotateX(travel / LAYOUT.wheelR)
        );
        writeInstance(inst.wheel, n++, model);
      }
    }
    device.queue.writeBuffer(inst.wheel.buffer, 0, inst.wheel.cpu.subarray(0, n * INST_FLOATS));
    inst.wheel.count = n;
    n = 0;
    for (const side of [-1, 1]) {
      const model = mat4Mul(
        mat4Translate(side * LAYOUT.trackX + side * sideShift, LAYOUT.sprocket.y, LAYOUT.sprocket.z),
        mat4RotateX(travel / LAYOUT.sprocket.r)
      );
      writeInstance(inst.sprocket, n++, model);
    }
    device.queue.writeBuffer(inst.sprocket.buffer, 0, inst.sprocket.cpu.subarray(0, n * INST_FLOATS));
    inst.sprocket.count = n;
    n = 0;
    for (const side of [-1, 1]) {
      writeInstance(inst.idler, n++, mat4Mul(
        mat4Translate(side * LAYOUT.trackX + side * sideShift, LAYOUT.idler.y, LAYOUT.idler.z),
        mat4RotateX(travel / LAYOUT.idler.r)
      ));
    }
    device.queue.writeBuffer(inst.idler.buffer, 0, inst.idler.cpu.subarray(0, n * INST_FLOATS));
    inst.idler.count = n;
    n = 0;
    for (const side of [-1, 1]) {
      for (const z of [-1.2, 0.15, 1.55]) {
        writeInstance(inst.roller, n++, mat4Mul(
          mat4Translate(side * LAYOUT.trackX + side * sideShift, 0.6, z),
          mat4RotateX(travel / 0.065)
        ));
      }
    }
    device.queue.writeBuffer(inst.roller.buffer, 0, inst.roller.cpu.subarray(0, n * INST_FLOATS));
    inst.roller.count = n;
    const gear = vehicle.gear;
    n = 0;
    if (eff.show.running !== false) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < gear.linkCount; i++) {
          const base = gear.linkMatrix(side, travel + i * gear.spacing);
          const model = mat4Mul(mat4Translate(side * sideShift, 0, 0), base);
          writeInstance(inst.link, n++, model);
        }
      }
    }
    inst.link.count = n;
    if (n) device.queue.writeBuffer(inst.link.buffer, 0, inst.link.cpu.subarray(0, n * INST_FLOATS));
    n = 0;
    for (const p of gear.fans) {
      const model = mat4Mul(
        mat4Translate(0, eff.explode * 0.45, -eff.explode * 1.25),
        mat4Mul(mat4Translate(p[0], p[1], p[2]), mat4RotateY(fanSpin))
      );
      writeInstance(inst.fan, n++, model, 0, 1);
    }
    inst.fan.count = n;
    device.queue.writeBuffer(inst.fan.buffer, 0, inst.fan.cpu.subarray(0, n * INST_FLOATS));
  }

  function gearJobs(eff) {
    if (eff.show.running === false) {
      return [{ slot: inst.fan, mesh: "fan", interior: true, shadow: false, system: "power" }];
    }
    return [
      { slot: inst.wheel, mesh: "wheel", interior: false, shadow: true, system: "running" },
      { slot: inst.sprocket, mesh: "sprocket", interior: false, shadow: true, system: "running" },
      { slot: inst.idler, mesh: "idler", interior: false, shadow: true, system: "running" },
      { slot: inst.roller, mesh: "roller", interior: false, shadow: true, system: "running" },
      { slot: inst.link, mesh: "link", interior: false, shadow: true, system: "running" },
      { slot: inst.fan, mesh: "fan", interior: true, shadow: false, system: "power" },
    ];
  }

  function drawObjects(pass, draws, pipe, bind, indexed) {
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bind);
    let current = null;
    for (const d of draws) {
      if (d.interior !== indexed.interior) continue;
      if (indexed.shadow && !d.shadow) continue;
      if (current !== d.mesh.buffer) {
        pass.setVertexBuffer(0, d.mesh.buffer);
        current = d.mesh.buffer;
      }
      pass.setBindGroup(1, objectBind, [d.index * 256]);
      pass.draw(d.count, 1, d.first, 0);
    }
  }

  function drawInst(pass, jobs, pipe, groupKey, wantInterior) {
    pass.setPipeline(pipe);
    pass.setBindGroup(0, groupKey === "shadow" ? frameBind : colorBind);
    for (const job of jobs) {
      if (!!job.interior !== wantInterior) continue;
      if (groupKey === "shadow" && !job.shadow) continue;
      if (!job.slot.count) continue;
      if (job.system !== "ground" && effShow && effShow[job.system] === false) continue;
      const mesh = meshes.get(job.mesh);
      pass.setBindGroup(1, groupKey === "shadow" ? job.slot.shadow : job.slot.color);
      pass.setVertexBuffer(0, mesh.buffer);
      pass.draw(mesh.vertexCount, job.slot.count);
    }
  }

  let effShow = null;

  function encodeScene(encoder, colorTex, depthTex, jobs, draws, eff) {
    const shadowPass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: shadowView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    drawObjects(shadowPass, draws, pipelines.shadow, frameBind, { interior: false, shadow: true });
    drawInst(shadowPass, jobs, pipelines.shadowInst, "shadow", false);
    shadowPass.end();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: colorTex.createView(),
        clearValue: { r: 0.2, g: 0.22, b: 0.24, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: depthTex.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    pass.setPipeline(pipelines.sky);
    pass.setBindGroup(0, frameBind);
    pass.draw(3);
    if (!eff.xray) {
      drawObjects(pass, draws, pipelines.solid[0], colorBind, { interior: false, shadow: false });
      drawInst(pass, jobs, pipelines.inst[0], "color", false);
    }
    if (eff.xray || eff.clip) {
      drawObjects(pass, draws, pipelines.solid[1], colorBind, { interior: true, shadow: false });
      drawInst(pass, jobs, pipelines.inst[1], "color", true);
    }
    if (eff.xray) {
      drawObjects(pass, draws, pipelines.solid[2], colorBind, { interior: false, shadow: false });
      drawInst(pass, jobs, pipelines.inst[2], "color", false);
    }
    pass.setPipeline(pipelines.particle);
    pass.setBindGroup(0, frameBind);
    pass.setVertexBuffer(0, quad);
    pass.setVertexBuffer(1, particleBuffer);
    pass.draw(6, dust.parts.length);
    pass.end();
  }

  function presentTo(encoder, source, targetView, targetFormat) {
    const bind = device.createBindGroup({
      layout: presentLayout,
      entries: [
        { binding: 0, resource: source.createView() },
        { binding: 1, resource: linear },
        { binding: 2, resource: { buffer: presentUniform } },
      ],
    });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: targetView, loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    });
    pass.setPipeline(presentPipe(targetFormat));
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
  }

  function blendAccum(encoder, sampleTex, count) {
    const dst = count < 0.5 ? 0 : 1 - accumRead;
    const src = count < 0.5 ? 1 : accumRead;
    device.queue.writeBuffer(accUniform, 0, new Float32Array([count, 0, 0, 0]));
    const bind = device.createBindGroup({
      layout: accumLayout,
      entries: [
        { binding: 0, resource: sampleTex.createView() },
        { binding: 1, resource: screen.hist[src].createView() },
        { binding: 2, resource: linear },
        { binding: 3, resource: { buffer: accUniform } },
      ],
    });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: screen.hist[dst].createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    });
    pass.setPipeline(accumPipe);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    accumRead = dst;
    return screen.hist[dst];
  }

  function projectLabels(spaces, viewProj, cssW, cssH, eff) {
    if (!eff.labels) return [];
    const out = [];
    for (const label of LABELS) {
      if (eff.show[label.system] === false) continue;
      const m = spaces[label.space] || mat4();
      const p = mat4TransformPoint(m, label.local[0], label.local[1], label.local[2]);
      if (label.space === "turret" || label.space === "gun") p[1] += eff.explode * 1.05;
      if (label.space === "gun") p[2] += eff.explode * 0.6;
      const x = p[0];
      const y = p[1];
      const z = p[2];
      const cw = viewProj[3] * x + viewProj[7] * y + viewProj[11] * z + viewProj[15];
      if (cw < 0.05) continue;
      const nx = (viewProj[0] * x + viewProj[4] * y + viewProj[8] * z + viewProj[12]) / cw;
      const ny = (viewProj[1] * x + viewProj[5] * y + viewProj[9] * z + viewProj[13]) / cw;
      out.push({
        text: label.text,
        x: (nx * 0.5 + 0.5) * cssW,
        y: (1 - (ny * 0.5 + 0.5)) * cssH,
      });
    }
    return out;
  }

  function visualSignature(eff, eye) {
    return JSON.stringify({
      v: eff.variant,
      p: eff.paint,
      e: Math.round(eff.explode * 100),
      y: Math.round(eff.turretYaw * 1000),
      g: Math.round(eff.gunElev * 1000),
      x: eff.xray,
      c: eff.clip ? [eff.clipAxis, Math.round(eff.clipPos * 50)] : 0,
      h: eff.highlight,
      env: eff.env,
      ex: eff.exposure,
      tm: eff.tonemap,
      f: Math.round(eff.focal),
      a: Math.round(eff.aperture * 10),
      fo: Math.round((eff.focus || 0) * 10),
      d: Math.round(eff.dust * 10),
      eye: eye.map((n) => Math.round(n * 40)),
      tgt: (eff.camMode === "free" ? state.free.pos : eff.camera.target).map((n) => Math.round(n * 40)),
      show: eff.show,
    });
  }

  function frameSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
    return { w, h, dpr };
  }

  function applyCanvasSize(w, h) {
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    context.configure({ device, format, alphaMode: "opaque" });
  }

  function renderFrame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fps = fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
    if (paused || canvas.clientWidth < 2) return;
    const eff = effective(state);
    effShow = eff.show;
    if (eff.autoRotate) state.cameras.assembly.yaw += dt * 0.22;
    if (eff.camMode === "free") moveFree(state, dt);
    const { w, h } = frameSize();
    applyCanvasSize(w, h);
    ensureScreen(w, h);
    const env = ENVS[eff.env] || ENVS.desert;
    const cam = cameraEye(eff);
    const key = visualSignature(eff, cam.eye);
    const moving = key !== visualKey;
    if (moving) {
      visualKey = key;
      spp = 0;
    }
    const settle = eff.accum && !moving;
    if (settle && spp >= eff.sppMax) {
      api.onHud?.({ fps, spp, max: eff.sppMax, mode: "已收敛", tris: api.tris, labels: [] });
      return;
    }
    if (!settle || spp === 0) dust.update(dt, eff.dust, eff.running);
    device.queue.writeBuffer(particleBuffer, 0, dustBuffer(dust));
    updateGear(eff, settle ? 0 : dt);
    const { draws, spaces } = buildDraws(eff);
    const aspect = w / h;
    const fov = 2 * Math.atan(12 / eff.focal);
    const focusDist = Math.max(0.4, cam.focus || 8);
    const useDof = eff.dof && settle;
    const radius = useDof ? (eff.focal / Math.max(eff.aperture, 0.8)) / 2000 : 0;
    const lens = lensCamera(cam.eye, cam.target, focusDist, radius, spp + 1);
    const jitter = settle
      ? [(halton(spp + 1, 2) - 0.5) * 2 / w, (halton(spp + 1, 3) - 0.5) * 2 / h]
      : [0, 0];
    const proj = perspective(fov, aspect, 0.08, 220);
    const view = lookAt(v3(...lens.eye), v3(...lens.target), v3(0, 1, 0));
    const viewProj = mat4Mul(proj, view);
    const shadowVP = mat4Mul(ortho(-14, 14, -10, 10, 1, 48), lookAt(
      v3(0.2 + n3(env.sun)[0] * 24, 1.2 + n3(env.sun)[1] * 24, 0.2 + n3(env.sun)[2] * 24),
      v3(0.1, 1.1, 0.2),
      v3(0, 1, 0)
    ));
    packFrame(viewProj, view, proj, shadowVP, lens.eye, eff, env, spp, jitter, w, h);
    device.queue.writeBuffer(presentUniform, 0, new Float32Array([eff.exposure, eff.tonemap, env.bloom, 0]));
    const jobs = gearJobs(eff).filter((job) => eff.show[job.system] !== false);
    const encoder = device.createCommandEncoder();
    encodeScene(encoder, screen.color, screen.depth, jobs, draws, eff);
    let source = screen.color;
    if (settle) {
      source = blendAccum(encoder, screen.color, spp);
      spp += 1;
    }
    presentTo(encoder, source, context.getCurrentTexture().createView(), format);
    device.queue.submit([encoder.finish()]);
    const labels = projectLabels(spaces, viewProj, canvas.clientWidth, canvas.clientHeight, eff);
    api.onHud?.({
      fps,
      spp: settle ? spp : 0,
      max: eff.sppMax,
      mode: settle ? "累积" : "实时预览",
      tris: api.tris,
      labels,
      dof: useDof,
    });
  }

  let apiTris = 0;
  for (const mesh of meshes.values()) apiTris += mesh.vertexCount / 3;
  apiTris += groundMesh.vertexCount / 3;

  const api = {
    tris: Math.round(apiTris),
    adapter: adapter.info?.description || adapter.info?.vendor || "WebGPU",
    onHud: null,
    start() {
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        try { renderFrame(now); } catch (err) { console.error(err); cancelAnimationFrame(raf); api.onError?.(err); }
      };
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); },
    invalidate() { spp = 0; visualKey = ""; },
    async exportImage(width, height, samples, onProgress) {
      paused = true;
      spp = 0;
      visualKey = "";
      try {
        const blob = await exportStill(width, height, samples, onProgress);
        return blob;
      } finally {
        paused = false;
        spp = 0;
        visualKey = "";
      }
    },
  };

  async function exportStill(width, height, samples, onProgress) {
    const limit = device.limits.maxTextureDimension2D || 4096;
    const tile = Math.min(1920, limit);
    const tilesX = Math.ceil(width / tile);
    const tilesY = Math.ceil(height / tile);
    const image = new Uint8ClampedArray(width * height * 4);
    const eff = effective(state);
    effShow = eff.show;
    const env = ENVS[eff.env] || ENVS.desert;
    const cam = cameraEye(eff);
    const fov = 2 * Math.atan(12 / eff.focal);
    const focusDist = Math.max(0.4, cam.focus || eff.camera?.dist || 12);
    const radius = eff.dof ? (eff.focal / Math.max(eff.aperture, 0.8)) / 2000 : 0;
    const total = tilesX * tilesY * samples;
    let done = 0;
    updateGear(eff, 0);
    dust.update(0.016, eff.dust, false);
    device.queue.writeBuffer(particleBuffer, 0, dustBuffer(dust));
    const { draws } = buildDraws(eff);
    const jobs = gearJobs(eff).filter((job) => eff.show[job.system] !== false);
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tw = Math.min(tile, width - tx * tile);
        const th = Math.min(tile, height - ty * tile);
        const color = device.createTexture({ size: [tw, th], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
        const depth = device.createTexture({ size: [tw, th], format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
        const hist = [0, 1].map(() => device.createTexture({ size: [tw, th], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }));
        const out = device.createTexture({ size: [tw, th], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
        let read = 0;
        for (let s = 0; s < samples; s++) {
          const lens = lensCamera(cam.eye, cam.target, focusDist, radius, s + 1);
          const jitter = [(halton(s + 1, 2) - 0.5) * 2 / tw, (halton(s + 1, 3) - 0.5) * 2 / th];
          const near = 0.08;
          const top = near * Math.tan(fov / 2);
          const planeH = top * 2;
          const planeW = planeH * (width / height);
          const left = -planeW / 2;
          const offX = tx * tile;
          const offY = ty * tile;
          const proj = frustum(
            left + (offX / width) * planeW,
            left + ((offX + tw) / width) * planeW,
            top - ((offY + th) / height) * planeH,
            top - (offY / height) * planeH,
            near,
            220
          );
          const view = lookAt(v3(...lens.eye), v3(...lens.target), v3(0, 1, 0));
          const viewProj = mat4Mul(proj, view);
          const shadowVP = mat4Mul(ortho(-14, 14, -10, 10, 1, 48), lookAt(
            v3(0.2 + n3(env.sun)[0] * 24, 1.2 + n3(env.sun)[1] * 24, 0.2 + n3(env.sun)[2] * 24),
            v3(0.1, 1.1, 0.2),
            v3(0, 1, 0)
          ));
          packFrame(viewProj, view, proj, shadowVP, lens.eye, eff, env, s, jitter, tw, th);
          const encoder = device.createCommandEncoder();
          encodeScene(encoder, color, depth, jobs, draws, eff);
          const dst = s === 0 ? 0 : 1 - read;
          const src = s === 0 ? 1 : read;
          device.queue.writeBuffer(accUniform, 0, new Float32Array([s, 0, 0, 0]));
          const bind = device.createBindGroup({
            layout: accumLayout,
            entries: [
              { binding: 0, resource: color.createView() },
              { binding: 1, resource: hist[src].createView() },
              { binding: 2, resource: linear },
              { binding: 3, resource: { buffer: accUniform } },
            ],
          });
          const ap = encoder.beginRenderPass({
            colorAttachments: [{ view: hist[dst].createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
          });
          ap.setPipeline(accumPipe);
          ap.setBindGroup(0, bind);
          ap.draw(3);
          ap.end();
          read = dst;
          if (s === samples - 1) {
            device.queue.writeBuffer(presentUniform, 0, new Float32Array([eff.exposure, eff.tonemap, env.bloom, 0]));
            presentTo(encoder, hist[read], out.createView(), "rgba8unorm");
          }
          device.queue.submit([encoder.finish()]);
          await device.queue.onSubmittedWorkDone();
          done += 1;
          onProgress?.(done / total);
          await new Promise((r) => setTimeout(r, 0));
        }
        const bpr = Math.ceil((tw * 4) / 256) * 256;
        const readback = device.createBuffer({ size: bpr * th, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const encoder = device.createCommandEncoder();
        encoder.copyTextureToBuffer({ texture: out }, { buffer: readback, bytesPerRow: bpr, rowsPerImage: th }, { width: tw, height: th });
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const mapped = new Uint8Array(readback.getMappedRange());
        const ox = tx * tile;
        const oy = ty * tile;
        for (let y = 0; y < th; y++) {
          const row = mapped.subarray(y * bpr, y * bpr + tw * 4);
          image.set(row, ((oy + y) * width + ox) * 4);
        }
        readback.unmap();
        readback.destroy();
        color.destroy();
        depth.destroy();
        hist.forEach((t) => t.destroy());
        out.destroy();
      }
    }
    const blobCanvas = new OffscreenCanvas(width, height);
    const ctx = blobCanvas.getContext("2d");
    ctx.putImageData(new ImageData(image, width, height), 0, 0);
    return blobCanvas.convertToBlob({ type: "image/png" });
  }

  let adapterName = "WebGPU";
  try {
    const info = adapter.info || (await adapter.requestAdapterInfo?.());
    adapterName = info?.description || info?.device || info?.vendor || adapterName;
  } catch { /* optional */ }
  api.adapter = adapterName;
  return api;
}
