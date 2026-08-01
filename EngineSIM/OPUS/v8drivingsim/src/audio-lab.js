/**
 * Audio lab: the engine acoustic model on its own bench.
 *
 * The engine has to stand up as a piece of synthesis before it is worth
 * wiring to a car, so this page drives it directly -- no physics, no
 * rendering. Sweep rpm by hand, switch cranks, switch rooms, and watch the
 * order spectrum move.
 *
 * The spectrum display is the useful part: it is drawn in *engine orders*
 * rather than Hz, so the axis does not move when the rpm does. A V8's firing
 * rate is order 4 and its full cycle is order 0.5, so the cross-plane
 * signature -- energy on the odd half-orders -- sits still and can be read
 * directly.
 */

import {
  CROSSPLANE_V8,
  ENGINES,
  deriveFiringAngles,
  bankIntervals,
} from './audio/engine-config.js';
import { EngineAudio, REVERB_PRESETS } from './audio/engine-audio.js';

const $ = (id) => document.getElementById(id);

const state = {
  engineKey: CROSSPLANE_V8.id,
  rpm: 900,
  throttle: 0.15,
  cabin: 0.35,
  preset: 'open',
  running: true,
  sweep: false,
  sweepDir: 1,
  limiter: false,
};

let audio = null;
let analyser = null;
let freqData = null;
let started = false;

/* ------------------------------------------------------------------ *
 * Firing diagram
 * ------------------------------------------------------------------ */

function drawFiring() {
  const def = ENGINES[state.engineKey];
  const canvas = $('firing');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = 146;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const firing = deriveFiringAngles(def.firingOrder, def.bankOf);
  const pad = 56;
  const usable = w - pad - 26;
  const x = (deg) => pad + (deg / 720) * usable;

  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'middle';

  for (const bank of [0, 1]) {
    const y = 34 + bank * 52;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + usable, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.textAlign = 'right';
    ctx.fillText(bank === 0 ? 'bank A' : 'bank B', pad - 6, y);

    const events = firing.filter((f) => f.bank === bank);
    for (const f of events) {
      ctx.strokeStyle = bank === 0 ? '#ffb524' : '#39d0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x(f.angle), y - 15);
      ctx.lineTo(x(f.angle), y + 15);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(String(f.cyl), x(f.angle), y - 23);
    }

    // Interval labels between consecutive firings -- the actual point of the
    // whole diagram.
    const sorted = events.map((f) => f.angle).sort((a, b) => a - b);
    const iv = bankIntervals(firing, bank);
    sorted.forEach((a, i) => {
      const next = i === sorted.length - 1 ? 720 + sorted[0] : sorted[i + 1];
      const mid = (a + next) / 2;
      if (mid > 720) return;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(`${iv[i]}°`, x(mid), y + 30);
    });
  }

  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.textAlign = 'left';
  ctx.fillText('0°', pad, h - 5);
  ctx.textAlign = 'right';
  ctx.fillText('720° — one full cycle', pad + usable, h - 5);

  const even = new Set(bankIntervals(firing, 0)).size === 1;
  $('firing-note').textContent = even
    ? 'Even 180° intervals in each bank — the flat-plane howl.'
    : 'Uneven 90/180/270/180° intervals in each bank — this is the burble.';
}

/* ------------------------------------------------------------------ *
 * Order spectrum
 * ------------------------------------------------------------------ */

function drawSpectrum() {
  const canvas = $('spectrum');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = 230;
  if (canvas.width !== w * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = `${h}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pad = { l: 34, r: 10, t: 18, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(pad.l, pad.t, iw, ih);

  if (!analyser || !started) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('start the engine to see the spectrum', w / 2, h / 2);
    return;
  }

  analyser.getFloatFrequencyData(freqData);
  const sr = audio.ctx.sampleRate;
  const binHz = sr / analyser.fftSize;
  const f0 = state.rpm / 60; // order 1, Hz
  const maxOrder = 16;

  // dB scale
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'right';
  for (let db = -20; db >= -100; db -= 20) {
    const y = pad.t + ((-db - 20) / 80) * ih;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + iw, y);
    ctx.stroke();
    ctx.fillText(`${db}`, pad.l - 5, y + 3);
  }

  // Order gridlines: whole orders solid, half-orders dashed.
  for (let k = 0.5; k <= maxOrder; k += 0.5) {
    const x = pad.l + (k / maxOrder) * iw;
    const whole = k % 1 === 0;
    ctx.strokeStyle = whole ? 'rgba(255,255,255,0.13)' : 'rgba(255,181,36,0.16)';
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + ih);
    ctx.stroke();
    if (whole && k % 2 === 0) {
      ctx.fillStyle = k === 4 ? '#ffb524' : 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(String(k), x, h - 8);
    }
  }

  // The spectrum itself, resampled onto the order axis.
  ctx.beginPath();
  let first = true;
  for (let px = 0; px <= iw; px++) {
    const order = (px / iw) * maxOrder;
    const hz = order * f0;
    const bin = hz / binHz;
    const i0 = Math.floor(bin);
    const frac = bin - i0;
    if (i0 < 0 || i0 + 1 >= freqData.length) continue;
    const db = freqData[i0] + (freqData[i0 + 1] - freqData[i0]) * frac;
    const y = pad.t + Math.min(1, Math.max(0, (-db - 20) / 80)) * ih;
    if (first) {
      ctx.moveTo(pad.l + px, y);
      first = false;
    } else ctx.lineTo(pad.l + px, y);
  }
  const grad = ctx.createLinearGradient(pad.l, 0, pad.l + iw, 0);
  grad.addColorStop(0, '#39d0ff');
  grad.addColorStop(0.3, '#ffb524');
  grad.addColorStop(1, '#ff5a3a');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.textAlign = 'right';
  ctx.fillText(
    `order 1 = ${f0.toFixed(1)} Hz    order 4 = ${(f0 * 4).toFixed(0)} Hz`,
    pad.l + iw - 4,
    pad.t + 10
  );
  ctx.textAlign = 'left';
  ctx.fillText('engine order', pad.l + 2, h - 8);
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

function pushParams() {
  if (!audio || !audio.ready) return;
  const def = ENGINES[state.engineKey];
  const load = state.throttle;
  audio.update({
    rpm: state.rpm,
    throttle: state.throttle,
    load,
    ignitionCut: state.limiter || state.rpm >= def.limiterRpm,
    // Closed throttle at speed means overrun, which means crackle.
    popIntensity: state.throttle < 0.08 && state.rpm > 2400 ? 0.8 : state.limiter ? 0.9 : 0,
    running: state.running,
    cabin: state.cabin,
  });
}

function syncUi() {
  const def = ENGINES[state.engineKey];
  $('rpm-val').textContent = `${Math.round(state.rpm)} rpm`;
  $('thr-val').textContent = `${Math.round(state.throttle * 100)}%`;
  $('cabin-val').textContent = state.cabin < 0.35 ? 'exterior' : state.cabin > 0.7 ? 'interior' : 'mixed';
  $('rpm').max = String(def.limiterRpm + 200);
  $('redline').textContent = `${def.redlineRpm} / ${def.limiterRpm}`;
  $('cpu').textContent = !audio || !audio.ready
    ? '—'
    : audio.cpu === null
      ? 'not measurable in this browser'
      : `${audio.cpu.toFixed(1)}% of one core (${audio.cpuSource})`;
  $('sr').textContent = audio && audio.ready ? `${(audio.sampleRate / 1000).toFixed(1)} kHz` : '—';
  $('latency').textContent =
    audio && audio.ready ? `${(audio.baseLatency * 1000).toFixed(1)} ms` : '—';
}

async function start() {
  if (started) return;
  const ok = await audio.start();
  if (!ok) {
    $('start-note').textContent = `Audio unavailable: ${audio.failed?.message || 'unknown'}`;
    return;
  }
  analyser = audio.ctx.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0.55;
  analyser.minDecibels = -110;
  audio.master.connect(analyser);
  freqData = new Float32Array(analyser.frequencyBinCount);
  started = true;
  $('start').textContent = 'Running';
  $('start').classList.add('on');
  $('start-note').textContent = '';
}

function swapEngine(key) {
  state.engineKey = key;
  const def = ENGINES[key];
  if (state.rpm > def.limiterRpm) state.rpm = def.limiterRpm;
  $('rpm').value = String(state.rpm);
  if (audio) audio.swapEngine(def);
  drawFiring();
  syncUi();
}

function build() {
  audio = new EngineAudio(CROSSPLANE_V8, { preset: state.preset, quality: 'high' });

  $('start').addEventListener('click', start);

  $('rpm').addEventListener('input', (e) => {
    state.rpm = Number(e.target.value);
    state.sweep = false;
    $('sweep').classList.remove('on');
  });
  $('thr').addEventListener('input', (e) => {
    state.throttle = Number(e.target.value) / 100;
  });
  $('cabin').addEventListener('input', (e) => {
    state.cabin = Number(e.target.value) / 100;
  });

  const engineSel = $('engine');
  for (const [key, def] of Object.entries(ENGINES)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = def.name;
    engineSel.appendChild(o);
  }
  engineSel.value = state.engineKey;
  engineSel.addEventListener('change', (e) => swapEngine(e.target.value));

  const roomSel = $('room');
  for (const [key, p] of Object.entries(REVERB_PRESETS)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = p.name;
    roomSel.appendChild(o);
  }
  roomSel.value = state.preset;
  roomSel.addEventListener('change', (e) => {
    state.preset = e.target.value;
    audio.setPreset(state.preset);
  });

  $('sweep').addEventListener('click', () => {
    state.sweep = !state.sweep;
    $('sweep').classList.toggle('on', state.sweep);
  });
  $('limiter').addEventListener('click', () => {
    state.limiter = !state.limiter;
    $('limiter').classList.toggle('on', state.limiter);
  });
  $('kill').addEventListener('click', () => {
    state.running = !state.running;
    $('kill').textContent = state.running ? 'Cut ignition' : 'Restore ignition';
    $('kill').classList.toggle('on', !state.running);
  });

  drawFiring();
  window.addEventListener('resize', () => drawFiring());

  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (state.sweep) {
      const def = ENGINES[state.engineKey];
      state.rpm += state.sweepDir * dt * 2200;
      if (state.rpm > def.limiterRpm) {
        state.rpm = def.limiterRpm;
        state.sweepDir = -1;
      } else if (state.rpm < def.idleRpm) {
        state.rpm = def.idleRpm;
        state.sweepDir = 1;
      }
      state.throttle = state.sweepDir > 0 ? 1 : 0.02;
      $('rpm').value = String(Math.round(state.rpm));
      $('thr').value = String(Math.round(state.throttle * 100));
    }

    pushParams();
    drawSpectrum();
    syncUi();
  };
  requestAnimationFrame(frame);
}

build();
window.lab = { state, get audio() { return audio; } };
