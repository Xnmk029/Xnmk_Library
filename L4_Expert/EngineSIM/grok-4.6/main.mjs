import * as THREE from 'three';
import { EngineDsp, V8, attachScriptProcessor, fftRadix2 } from './engine-dsp.mjs';
import { Vehicle } from './vehicle.mjs';
import { createInputState, bindKeyboard, toVehicleInput } from './input.mjs';
import { formatHud } from './hud.mjs';
import { createWorld, placeCar } from './scene.mjs';

const canvas = document.getElementById('view');
const overlay = document.getElementById('start-overlay');
const hud = {
  rpm: document.getElementById('hud-rpm'),
  speed: document.getElementById('hud-speed'),
  gear: document.getElementById('hud-gear'),
  throttle: document.getElementById('hud-throttle'),
  status: document.getElementById('hud-status'),
  load: document.getElementById('hud-load'),
  spec: document.getElementById('hud-spec'),
};
const specCanvas = document.getElementById('spec');
const specCtx = specCanvas.getContext('2d');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
const { scene, car, path } = createWorld(THREE);

const vehicle = new Vehicle();
if (path && path.length) {
  vehicle.x = path[0].x;
  vehicle.y = path[0].y;
  vehicle.yaw = path[0].heading;
}

const input = createInputState();
bindKeyboard(window, input);

const dsp = new EngineDsp({ sampleRate: 44100 });
const audioParams = {
  rpm: V8.idleRpm,
  throttle: 0,
  load: 0,
  fuelCut: false,
  speedMs: 0,
};

let audioCtx = null;
let audioNode = null;
let acc = 0;
let last = performance.now();
const specReal = new Float32Array(1024);
const specImag = new Float32Array(1024);
const specCap = new Float32Array(1024);
let specWrite = 0;

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

function chaseCamera(st) {
  const back = 7.4;
  const height = 2.6;
  const cx = st.x - Math.cos(st.yaw) * back;
  const cz = st.y - Math.sin(st.yaw) * back;
  camera.position.set(cx, height, cz);
  camera.lookAt(st.x, 1.05, st.y);
}

function paintHud(st) {
  const h = formatHud(st);
  hud.rpm.textContent = h.rpmText;
  hud.speed.textContent = h.speedText;
  hud.gear.textContent = h.gear;
  hud.throttle.textContent = h.throttleText;
  hud.status.textContent = h.status;
  hud.load.textContent = h.loadPct + '%';
  hud.spec.textContent =
    'FRONT-MID  ·  CROSS-PLANE V8  ·  EQUAL-LENGTH HEADERS  ·  ' + h.layout.toUpperCase();
  hud.status.dataset.mode = h.status;
}

function drawSpectrum() {
  specReal.set(specCap);
  specImag.fill(0);
  fftRadix2(specReal, specImag);
  const w = specCanvas.width;
  const h = specCanvas.height;
  specCtx.fillStyle = '#0b0d12';
  specCtx.fillRect(0, 0, w, h);
  specCtx.fillStyle = '#e07030';
  const bins = 256;
  for (let i = 1; i < bins; i++) {
    const mag = Math.hypot(specReal[i], specImag[i]);
    const db = Math.min(1, Math.log10(1 + mag * 8) / 3);
    const bh = db * (h - 4);
    const x = (i / bins) * w;
    specCtx.fillRect(x, h - bh, Math.max(1, w / bins - 0.4), bh);
  }
}

function startAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC({ sampleRate: 44100 });
  dsp.sampleRate = audioCtx.sampleRate;
  audioNode = attachScriptProcessor(audioCtx, dsp, () => audioParams);
  const cap = specCap;
  const orig = audioNode.onaudioprocess;
  audioNode.onaudioprocess = (ev) => {
    orig(ev);
    const ch = ev.outputBuffer.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      cap[specWrite] = ch[i];
      specWrite = (specWrite + 1) & 1023;
    }
  };
  return audioCtx.resume();
}

overlay.addEventListener('click', () => {
  overlay.classList.add('hidden');
  startAudio();
});
overlay.addEventListener('keydown', (ev) => {
  if (ev.code === 'Enter' || ev.code === 'Space') overlay.click();
});

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (input.reset) {
    vehicle.reset();
    if (path && path.length) {
      vehicle.x = path[0].x;
      vehicle.y = path[0].y;
      vehicle.yaw = path[0].heading;
    }
    input.reset = false;
  }
  vehicle.setInput(toVehicleInput(input));
  acc += dt;
  const step = 1 / 120;
  while (acc >= step) {
    vehicle.step(step);
    acc -= step;
  }
  const st = vehicle.getState();
  audioParams.rpm = st.rpm;
  audioParams.throttle = st.throttle;
  audioParams.load = st.load;
  audioParams.fuelCut = st.fuelCut;
  audioParams.speedMs = st.speedMs;
  placeCar(car, st);
  chaseCamera(st);
  paintHud(st);
  if ((now | 0) % 2 === 0) drawSpectrum();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

paintHud(vehicle.getState());
renderer.render(scene, camera);
requestAnimationFrame(tick);

export const __demo = { vehicle, dsp, input, scene, camera, renderer };
