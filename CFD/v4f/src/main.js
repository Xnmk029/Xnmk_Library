import * as THREE from 'three';
import { createSolver, PRESETS } from './sph.js';
import { OrbitControls } from './orbit.js';
import { buildWindTunnelScene } from './scene1.js';
import { buildDamScene, updateDamScene } from './scene2.js';
import { StripChart } from './charts.js';

const $ = (id) => document.getElementById(id);

const state = {
  preset: 'medium',
  paused: false,
  timeScale: 1.0,
  autoSpeed: true,
  colorMode: 'velocity',
  showGrid: true,
  showRulers: true,
  showProbe: true,
  showAxes: true,
  activeTab: 'tab2'
};

/* ---------------- solver ---------------- */

let solver = createSolver('medium');
solver.time = -0.6; // gate-hold settle phase

function rebuildSolver(preset) {
  solver = createSolver(preset);
  solver.time = -0.6;
  iterDowngraded = false;
  state.paused = false;
  rebuildDam();
  charts.forEach((c) => c.clear());
  log('[INIT] 求解器重建: ' + preset.toUpperCase() + ' / N=' + solver.count, 'ok');
  syncSolverPanel();
  updatePauseBtn();
}

/* ---------------- scene 2 ---------------- */

const gl2 = $('gl2');
const renderer2 = makeRenderer(gl2);
let dam = buildDamScene(solver);
let controls2 = null;

function attachControls2() {
  if (controls2) controls2.dispose();
  controls2 = new OrbitControls(dam.camera, renderer2.domElement, { target: dam.controlsTarget });
  controls2.reset(dam.cameraHome, dam.controlsTarget);
}
attachControls2();

function rebuildDam() {
  disposeScene(dam.scene);
  dam = buildDamScene(solver);
  attachControls2();
  resizeRenderer(renderer2, gl2, dam.camera);
}

/* ---------------- scene 1 (placeholder, lazy) ---------------- */

const gl1 = $('gl1');
let tunnel = null;
let renderer1 = null;
let controls1 = null;

function ensureScene1() {
  if (tunnel) return;
  tunnel = buildWindTunnelScene();
  renderer1 = makeRenderer(gl1);
  controls1 = new OrbitControls(tunnel.camera, renderer1.domElement, { target: tunnel.controlsTarget });
  controls1.reset(tunnel.camera.position.clone(), tunnel.controlsTarget);
  resizeRenderer(renderer1, gl1, tunnel.camera);
  log('[INIT] F1 占位场景已加载 (几何预览, 无求解器)', 'info');
}

/* ---------------- charts ---------------- */

const charts = [
  new StripChart($('chWater'), { min: 0, max: 0.6, color: '#4db6d0' }),
  new StripChart($('chWave'), { min: 0, max: 1.2, color: '#59c88a' }),
  new StripChart($('chEk'), { color: '#e0b163' }),
  new StripChart($('chPhys'), { min: 0, color: '#b084cc' })
];

/* ---------------- helpers ---------------- */

function makeRenderer(container) {
  const r = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
    preserveDrawingBuffer: true
  });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  r.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(r.domElement);
  return r;
}

function resizeRenderer(renderer, container, camera) {
  const w = container.clientWidth || 1;
  const h = container.clientHeight || 1;
  renderer.setSize(w, h, false);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

function log(msg, cls = '') {
  const box = $('logBox');
  const d = new Date();
  const ts = d.toTimeString().slice(0, 8);
  const div = document.createElement('div');
  div.className = 'log-line' + (cls ? ' ' + cls : '');
  div.textContent = '[' + ts + '] ' + msg;
  box.appendChild(div);
  while (box.childNodes.length > 80) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

function updatePauseBtn() {
  $('btnPause').textContent = state.paused ? '继续' : '暂停';
}

function updateTimeScaleUI() {
  $('timeScale').value = state.timeScale;
  $('timeScaleVal').textContent = state.timeScale.toFixed(2) + 'x';
  $('hudSim').textContent = state.timeScale.toFixed(2) + 'x';
  $('btnAuto').classList.toggle('active', state.autoSpeed);
}

function syncSolverPanel() {
  $('vN').textContent = solver.count.toLocaleString('en-US');
  $('vH').textContent = solver.h.toFixed(4);
  $('vC').textContent = solver.kernel;
  $('vRho').textContent = solver.rho0.toFixed(0);
  $('vDt').textContent = solver.dt.toFixed(4);
  $('vNu').textContent = solver.visc.toFixed(3);
  $('vIter').textContent = String(solver.iterations);
  $('hudN').textContent = solver.count.toLocaleString('en-US');
  const p = PRESETS[state.preset];
  document.querySelectorAll('#presetSeg .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.preset === state.preset);
  });
}

/* ---------------- physics loop ---------------- */

const MAX_PHYS_MS = 12;
const MAX_STEPS = 60;
let physMs = 0;
let stepsLastFrame = 0;
let iterDowngraded = false;

function runPhysics(dtReal) {
  const t0 = performance.now();
  const dt = solver.dt;
  const target = solver.time + dtReal * state.timeScale;
  let steps = 0;
  while (solver.time + dt <= target + 1e-9 && steps < MAX_STEPS) {
    const before = solver.time;
    solver.step(dt);
    steps++;
    if (before < 0 && solver.time >= 0 && state.activeTab === 'tab2') {
      log('[EVENT] 闸门开启 GATE OPEN / T=0.000s', 'ok');
    }
    if (performance.now() - t0 > MAX_PHYS_MS && solver.time + dt < target - 1e-9) break;
  }
  physMs = performance.now() - t0;
  stepsLastFrame = steps;

  if (state.autoSpeed) {
    const fpsOk = fpsEma >= 52;
    if ((physMs > 11.0 || !fpsOk) && state.timeScale > 0.35) {
      state.timeScale = Math.max(0.35, state.timeScale * (fpsOk ? 0.94 : 0.97));
      updateTimeScaleUI();
    } else if (physMs < 6.0 && fpsEma > 55 && steps >= 2 && state.timeScale < 1.5) {
      state.timeScale = Math.min(1.5, state.timeScale + 0.03);
      updateTimeScaleUI();
    }
    // quality scaling: drop a constraint iteration before dropping sim speed
    if (solver.iterations > 1 && physMs > 10.5) {
      solver.iterations = 1;
      if (!iterDowngraded) {
        iterDowngraded = true;
        log('[PERF] 约束迭代 2 -> 1 (保持 60FPS)', 'warn');
        syncSolverPanel();
      }
    } else if (solver.iterations < 2 && physMs < 5.0 && fpsEma > 55) {
      solver.iterations = 2;
      iterDowngraded = false;
      syncSolverPanel();
    }
  }
}

/* ---------------- telemetry ---------------- */

let frame = 0;

function updateTelemetry() {
  solver.computeTelemetry();
  if (state.colorMode === 'pressure' && frame % 2 === 0) {
    solver.computePressures();
  }
  if (!state.paused && frame % 3 === 0) {
    charts[0].push(solver.waterLevel);
    charts[1].push(solver.wavefront);
    charts[2].push(solver.kinetic);
    charts[3].push(physMs);
    for (const c of charts) c.draw();
  }
  frame++;
}

/* ---------------- main loop ---------------- */

let last = performance.now();
let fpsEma = 60;
let lastStatus = 0;
let lastClock = 0;
let gateLogDone = false;

function tick(now) {
  requestAnimationFrame(tick);
  const dtReal = Math.min((now - last) / 1000, 0.12);
  last = now;
  if (dtReal > 1e-6) fpsEma += (1 / dtReal - fpsEma) * 0.07;

  if (state.activeTab === 'tab2') {
    if (!state.paused) runPhysics(dtReal);
    if (!gateLogDone && solver.time >= 0) {
      gateLogDone = true;
    }
    updateDamScene(dam, solver, state);
    controls2.update();
    renderer2.render(dam.scene, dam.camera);
    updateTelemetry();
  } else if (tunnel) {
    controls1.update();
    renderer1.render(tunnel.scene, tunnel.camera);
  }

  if (now - lastStatus > 200) {
    lastStatus = now;
    $('stFps').textContent = 'FPS ' + Math.round(fpsEma);
    $('hudFps').textContent = Math.round(fpsEma);
    $('stPhys').textContent = 'PHYS ' + physMs.toFixed(1) + ' ms';
    $('stSim').textContent = 'SIM ' + state.timeScale.toFixed(2) + 'x';
    $('stIter').textContent = 'ITER ' + solver.iterations;
    $('hudT').textContent = solver.time.toFixed(2) + ' s';
    $('vWater').textContent = solver.waterLevel.toFixed(3) + ' m';
    $('vWave').textContent = solver.wavefront.toFixed(3) + ' m';
    $('vEk').textContent = solver.kinetic.toFixed(1) + ' J';
    $('vPhys').textContent = physMs.toFixed(1) + ' ms';
    const hold = solver.time < 0;
    $('topSolver').textContent = hold ? 'SPH-PBF SOLVER / GATE HOLD' : 'SPH-PBF SOLVER ACTIVE';
    $('topLed').className = 'led ' + (hold ? 'led-hold' : 'led-ok');
    $('stMode').textContent = hold ? 'MODE: SPH-DAMBREAK / HOLD' : 'MODE: SPH-DAMBREAK';
  }
  if (now - lastClock > 1000) {
    lastClock = now;
    $('topClock').textContent = new Date().toTimeString().slice(0, 8);
  }
}

/* ---------------- tabs ---------------- */

function setTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.toggle('active', v.id === tab);
  });
  document.querySelectorAll('.side-panel').forEach((s) => {
    s.classList.toggle('active', s.id === 'side' + tab.slice(3));
  });
  if (tab === 'tab1') {
    ensureScene1();
    log('[INFO] 窗口切换: F1 虚拟风洞 (占位)', 'info');
  } else {
    log('[INFO] 窗口切换: 大坝决堤 SPH', 'info');
    resizeRenderer(renderer2, gl2, dam.camera);
  }
}

/* ---------------- UI events ---------------- */

$('tabBtn1').addEventListener('click', () => setTab('tab1'));
$('tabBtn2').addEventListener('click', () => setTab('tab2'));

$('btnReset').addEventListener('click', () => {
  solver.reset();
  solver.time = -0.6;
  solver.iterations = PRESETS[state.preset].iterations;
  iterDowngraded = false;
  gateLogDone = false;
  charts.forEach((c) => c.clear());
  log('[CMD] 求解器重置 / 闸门重新锁定', 'warn');
  syncSolverPanel();
});

$('btnPause').addEventListener('click', () => {
  state.paused = !state.paused;
  updatePauseBtn();
  log(state.paused ? '[CMD] 求解暂停' : '[CMD] 求解继续', 'info');
});

$('btnStep').addEventListener('click', () => {
  if (!state.paused) {
    state.paused = true;
    updatePauseBtn();
  }
  solver.step(solver.dt);
  solver.computeTelemetry();
  updateTelemetry();
  log('[CMD] 单步推进 dt=' + solver.dt.toFixed(4) + 's', 'info');
});

$('btnCam').addEventListener('click', () => {
  controls2.reset(dam.cameraHome, dam.controlsTarget);
  log('[CMD] 相机视角复位', 'info');
});

document.querySelectorAll('#presetSeg .seg-btn').forEach((b) => {
  b.addEventListener('click', () => {
    if (b.dataset.preset !== state.preset) {
      state.preset = b.dataset.preset;
      rebuildSolver(state.preset);
      gateLogDone = false;
    }
  });
});

document.querySelectorAll('#colorSeg .seg-btn').forEach((b) => {
  b.addEventListener('click', () => {
    state.colorMode = b.dataset.color;
    document.querySelectorAll('#colorSeg .seg-btn').forEach((x) => {
      x.classList.toggle('active', x === b);
    });
    log('[CMD] 着色模式: ' + (state.colorMode === 'pressure' ? '压力场' : '速度场'), 'info');
  });
});

$('chkGrid').addEventListener('change', (e) => { state.showGrid = e.target.checked; });
$('chkRuler').addEventListener('change', (e) => { state.showRulers = e.target.checked; });
$('chkProbe').addEventListener('change', (e) => { state.showProbe = e.target.checked; });
$('chkAxes').addEventListener('change', (e) => { state.showAxes = e.target.checked; });

$('timeScale').addEventListener('input', (e) => {
  state.autoSpeed = false;
  state.timeScale = parseFloat(e.target.value);
  updateTimeScaleUI();
});

$('btnAuto').addEventListener('click', () => {
  state.autoSpeed = true;
  updateTimeScaleUI();
  log('[CMD] 时间倍率自动同步已启用 (目标 60FPS)', 'ok');
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && state.activeTab === 'tab2') {
    e.preventDefault();
    $('btnPause').click();
  } else if (e.key === 'r' || e.key === 'R') {
    $('btnReset').click();
  } else if (e.key === 'c' || e.key === 'C') {
    $('btnCam').click();
  }
});

const stageObserver = new ResizeObserver(() => {
  resizeRenderer(renderer2, gl2, dam.camera);
  if (renderer1) resizeRenderer(renderer1, gl1, tunnel.camera);
});
stageObserver.observe($('stage'));

/* ---------------- boot ---------------- */

syncSolverPanel();
updateTimeScaleUI();
updatePauseBtn();
setTab('tab2');
log('[INIT] CFD & SPH BENCHMARK V2.0.1 启动', 'ok');
log('[INIT] 求解器: SPH-PBF (位置基流体) / 大坝决堤 3D', 'info');
log('[INIT] 工况: 1.20m x 0.75m x 0.60m 水箱 / 0.40m 水柱', 'info');
log('[INIT] 闸门锁定, 预置 0.60s 静置阶段', 'warn');
log('[HELP] 左键旋转 / 右键平移 / 滚轮缩放', '');
log('[HELP] SPACE 暂停 / R 重置 / C 视角复位', '');

window.__bench = {
  get state() { return state; },
  get solver() { return solver; },
  get fps() { return fpsEma; },
  get physMs() { return physMs; },
  get dam() { return dam; },
  get renderer() { return renderer2; },
  setTab,
  countLitPixels() {
    const r = renderer2;
    const gl = r.getContext();
    const w = r.domElement.width;
    const h = r.domElement.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let lit = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 26 || px[i + 1] > 26 || px[i + 2] > 26) lit++;
    }
    return { w, h, lit, ratio: lit / (w * h) };
  }
};

requestAnimationFrame(tick);
