import { Vec3, Camera, Stats, computeConvergence } from './utils.js';

const canvas = document.getElementById('glcanvas');
const backendEl = document.getElementById('backend');
const fpsEl = document.getElementById('fps');
const spsEl = document.getElementById('sps');
const samplesEl = document.getElementById('samples');
const convEl = document.getElementById('convergence');
const bouncesEl = document.getElementById('bounces-val');
const resolutionEl = document.getElementById('resolution');
const warningEl = document.getElementById('warning');
const resetBtn = document.getElementById('reset-btn');
const toggleBounceBtn = document.getElementById('toggle-bounce');
const bouncesSlider = document.getElementById('bounces');

let maxBounces = 4;
let totalSamples = 0;
let camera, stats;
let backend = null;

let mouseDown = false;
let lastMouse = { x: 0, y: 0 };

let gl, glProgram, glDisplayProgram, glVAO, glAccumFBO, glAccumTexture, glUniformLocs;
let wgDevice, wgContext, wgFormat, wgUniformBuffer;
let wgAccumTextures = [];
let wgAccumIndex = 0;
let wgComputePipeline, wgRenderPipeline, wgSampler;
let wgComputeBindGroup, wgDisplayBindGroup, wgDisplayUniformBuffer;

function initCamera() {
  camera = new Camera();
  camera.setPosition(0, 0, 4);
  camera.setTarget(0, 0, 0);
}

function setupMouseControls() {
  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    camera.rotate(-dx * 0.01, dy * 0.01);
    lastMouse = { x: e.clientX, y: e.clientY };
    totalSamples = 0;
  });
  canvas.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('mouseleave', () => { mouseDown = false; });
  canvas.addEventListener('wheel', (e) => {
    const diff = Vec3.sub(camera.pos, camera.target);
    const scale = 1 + e.deltaY * 0.001;
    camera.pos = Vec3.add(camera.target, Vec3.mul(diff, scale));
    camera.update();
    totalSamples = 0;
    e.preventDefault();
  });
}

function createUniformData() {
  const now = performance.now() * 0.001;
  const data = new Float32Array(24);
  data[0] = canvas.width; data[1] = canvas.height;
  data[2] = now % 1000;
  data[3] = maxBounces;
  data[4] = totalSamples;
  data[5] = 0;
  data[6] = camera.pos.x; data[7] = camera.pos.y; data[8] = camera.pos.z;
  data[9] = 0;
  data[10] = camera.dir.x; data[11] = camera.dir.y; data[12] = camera.dir.z;
  data[13] = 0;
  data[14] = camera.up.x; data[15] = camera.up.y; data[16] = camera.up.z;
  data[17] = 0;
  data[18] = camera.right.x; data[19] = camera.right.y; data[20] = camera.right.z;
  data[21] = 0;
  data[22] = camera.fov;
  data[23] = 0;
  return data;
}

async function initWebGPU() {
  if (!navigator.gpu) throw new Error('WebGPU not supported');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No GPU adapter found');
  wgDevice = await adapter.requestDevice();
  wgContext = canvas.getContext('webgpu');
  wgFormat = navigator.gpu.getPreferredCanvasFormat();
  wgContext.configure({ device: wgDevice, format: wgFormat, alphaMode: 'opaque' });

  const shaderCode = await fetch('shaders/pt.wgsl').then(r => r.text());
  const shaderModule = wgDevice.createShaderModule({ code: shaderCode });

  wgUniformBuffer = wgDevice.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const accumDesc = {
    size: [canvas.width, canvas.height, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.STORAGE | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  };
  wgAccumTextures = [
    wgDevice.createTexture(accumDesc),
    wgDevice.createTexture(accumDesc),
  ];

  wgComputePipeline = wgDevice.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModule, entryPoint: 'main' },
  });

  const displayShader = wgDevice.createShaderModule({
    code: `
      struct DisplayUniforms {
        resolution: vec2<f32>;
      };
      @group(0) @binding(0) var<uniform> uniforms: DisplayUniforms;
      @group(0) @binding(1) var tex: texture_2d<f32>;
      @group(0) @binding(2) var samp: sampler;
      @vertex fn vs(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 3>(
          vec2<f32>(-1, -1), vec2<f32>(3, -1), vec2<f32>(-1, 3));
        return vec4<f32>(pos[idx], 0, 1);
      }
      @fragment fn fs(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
        return textureSample(tex, samp, coord.xy / uniforms.resolution);
      }
    `,
  });

  wgRenderPipeline = wgDevice.createRenderPipeline({
    layout: 'auto',
    vertex: { module: displayShader, entryPoint: 'vs' },
    fragment: {
      module: displayShader,
      entryPoint: 'fs',
      targets: [{ format: wgFormat }],
    },
    primitive: { topology: 'triangle-list' },
  });

  wgSampler = wgDevice.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  wgDisplayUniformBuffer = wgDevice.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  wgDisplayBindGroup = wgDevice.createBindGroup({
    layout: wgRenderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: wgDisplayUniformBuffer } },
      { binding: 1, resource: wgAccumTextures[wgAccumIndex].createView() },
      { binding: 2, resource: wgSampler },
    ],
  });
}

function renderWebGPU() {
  const data = createUniformData();
  wgDevice.queue.writeBuffer(wgUniformBuffer, 0, data.buffer);

  const displayData = new Float32Array([canvas.width, canvas.height]);
  wgDevice.queue.writeBuffer(wgDisplayUniformBuffer, 0, displayData.buffer);

  const commandEncoder = wgDevice.createCommandEncoder();

  wgComputeBindGroup = wgDevice.createBindGroup({
    layout: wgComputePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: wgUniformBuffer } },
      { binding: 1, resource: wgAccumTextures[1 - wgAccumIndex].createView() },
      { binding: 2, resource: wgAccumTextures[wgAccumIndex].createView() },
    ],
  });

  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(wgComputePipeline);
  computePass.setBindGroup(0, wgComputeBindGroup);
  computePass.dispatchWorkgroups(
    Math.ceil(canvas.width / 16),
    Math.ceil(canvas.height / 16)
  );
  computePass.end();

  wgDisplayBindGroup = wgDevice.createBindGroup({
    layout: wgRenderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: wgDisplayUniformBuffer } },
      { binding: 1, resource: wgAccumTextures[wgAccumIndex].createView() },
      { binding: 2, resource: wgSampler },
    ],
  });

  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: wgContext.getCurrentTexture().createView(),
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });
  renderPass.setPipeline(wgRenderPipeline);
  renderPass.setBindGroup(0, wgDisplayBindGroup);
  renderPass.draw(3);
  renderPass.end();

  wgDevice.queue.submit([commandEncoder.finish()]);
  wgAccumIndex = 1 - wgAccumIndex;
}

async function initWebGL2() {
  gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 not supported');

  const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0, 1);
    }
  `;

  const fsSource = await fetch('shaders/pt.glsl').then(r => r.text());

  glProgram = gl.createProgram();
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    throw new Error('Vertex shader error: ' + gl.getShaderInfoLog(vs));
  }
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    throw new Error('Fragment shader error: ' + gl.getShaderInfoLog(fs));
  }
  gl.bindAttribLocation(glProgram, 0, 'a_position');
  gl.attachShader(glProgram, vs);
  gl.attachShader(glProgram, fs);
  gl.linkProgram(glProgram);
  if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(glProgram));
  }

  gl.useProgram(glProgram);

  glUniformLocs = {
    resolution: gl.getUniformLocation(glProgram, 'u_resolution'),
    seed: gl.getUniformLocation(glProgram, 'u_seed'),
    maxBounces: gl.getUniformLocation(glProgram, 'u_maxBounces'),
    samples: gl.getUniformLocation(glProgram, 'u_samples'),
    cameraPos: gl.getUniformLocation(glProgram, 'u_cameraPos'),
    cameraDir: gl.getUniformLocation(glProgram, 'u_cameraDir'),
    cameraUp: gl.getUniformLocation(glProgram, 'u_cameraUp'),
    cameraRight: gl.getUniformLocation(glProgram, 'u_cameraRight'),
    fov: gl.getUniformLocation(glProgram, 'u_fov'),
  };

  const quadVertices = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]);
  glVAO = gl.createVertexArray();
  gl.bindVertexArray(glVAO);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  glAccumTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, glAccumTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  glAccumFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, glAccumFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glAccumTexture, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const displayVsSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0, 1);
    }
  `;
  const displayFsSource = `
    precision highp float;
    uniform sampler2D u_texture;
    varying vec2 v_uv;
    void main() {
      gl_FragColor = texture2D(u_texture, v_uv);
    }
  `;

  glDisplayProgram = gl.createProgram();
  const dvs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(dvs, displayVsSource);
  gl.compileShader(dvs);
  const dfs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(dfs, displayFsSource);
  gl.compileShader(dfs);
  gl.bindAttribLocation(glDisplayProgram, 0, 'a_position');
  gl.attachShader(glDisplayProgram, dvs);
  gl.attachShader(glDisplayProgram, dfs);
  gl.linkProgram(glDisplayProgram);
  if (!gl.getProgramParameter(glDisplayProgram, gl.LINK_STATUS)) {
    throw new Error('Display program link error: ' + gl.getProgramInfoLog(glDisplayProgram));
  }
}

function updateWebGL2Uniforms() {
  const now = performance.now() * 0.001;
  gl.useProgram(glProgram);
  gl.uniform2f(glUniformLocs.resolution, canvas.width, canvas.height);
  gl.uniform1f(glUniformLocs.seed, now % 1000);
  gl.uniform1i(glUniformLocs.maxBounces, maxBounces);
  gl.uniform1i(glUniformLocs.samples, totalSamples);
  gl.uniform3f(glUniformLocs.cameraPos, camera.pos.x, camera.pos.y, camera.pos.z);
  gl.uniform3f(glUniformLocs.cameraDir, camera.dir.x, camera.dir.y, camera.dir.z);
  gl.uniform3f(glUniformLocs.cameraUp, camera.up.x, camera.up.y, camera.up.z);
  gl.uniform3f(glUniformLocs.cameraRight, camera.right.x, camera.right.y, camera.right.z);
  gl.uniform1f(glUniformLocs.fov, camera.fov);
}

function renderWebGL2() {
  updateWebGL2Uniforms();

  gl.bindFramebuffer(gl.FRAMEBUFFER, glAccumFBO);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const blendFactor = totalSamples > 0 ? 1.0 / (totalSamples + 1) : 1.0;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.CONSTANT_COLOR, gl.ONE_MINUS_CONSTANT_COLOR);
  gl.blendColor(blendFactor, blendFactor, blendFactor, 1.0);

  gl.useProgram(glProgram);
  gl.bindVertexArray(glVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.BLEND);

  gl.useProgram(glDisplayProgram);
  gl.bindVertexArray(glVAO);
  gl.bindTexture(gl.TEXTURE_2D, glAccumTexture);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function render() {
  if (totalSamples === 0) {
    totalSamples = 1;
  } else {
    totalSamples++;
  }

  if (backend === 'webgpu') {
    renderWebGPU();
  } else {
    renderWebGL2();
  }

  stats.update();

  fpsEl.textContent = stats.fps.toFixed(1);
  spsEl.textContent = stats.getSamplesPerSecond(1).toLocaleString();
  samplesEl.textContent = totalSamples.toLocaleString();

  const conv = Math.min(1.0, totalSamples / 100);
  convEl.textContent = `${(conv * 100).toFixed(1)}%`;

  requestAnimationFrame(render);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  resolutionEl.textContent = `${canvas.width}x${canvas.height}`;
  totalSamples = 0;

  if (backend === 'webgl2' && gl) {
    gl.bindTexture(gl.TEXTURE_2D, glAccumTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  if (backend === 'webgpu' && wgDevice) {
    const accumDesc = {
      size: [canvas.width, canvas.height, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    };
    wgAccumTextures = [
      wgDevice.createTexture(accumDesc),
      wgDevice.createTexture(accumDesc),
    ];
    wgAccumIndex = 0;
  }
}

async function init() {
  initCamera();
  setupMouseControls();
  stats = new Stats();

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  bouncesSlider.addEventListener('input', (e) => {
    maxBounces = parseInt(e.target.value);
    bouncesEl.textContent = maxBounces;
    totalSamples = 0;
  });

  resetBtn.addEventListener('click', () => { totalSamples = 0; });
  toggleBounceBtn.addEventListener('click', () => {
    maxBounces = maxBounces === 4 ? 8 : 4;
    bouncesSlider.value = maxBounces;
    bouncesEl.textContent = maxBounces;
    totalSamples = 0;
  });

  try {
    await initWebGPU();
    backend = 'webgpu';
    backendEl.textContent = 'WebGPU';
    warningEl.textContent = '';
  } catch (e) {
    console.warn('WebGPU failed, falling back to WebGL2:', e.message);
    try {
      await initWebGL2();
      backend = 'webgl2';
      backendEl.textContent = 'WebGL2';
      warningEl.textContent = 'Using WebGL2 fallback (WebGPU not available)';
    } catch (e2) {
      backendEl.textContent = 'None';
      warningEl.textContent = 'No GPU backend available. Enable WebGPU in your browser.';
      console.error('No GPU backend available:', e2);
    }
  }

  if (backend) {
    requestAnimationFrame(render);
  }
}

init();
