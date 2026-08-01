/**
 * audio-lab.mjs -- minimal listening lab for the V4f engine sound driver.
 * No 3D, no physics: sliders drive the audio module directly, plus a live
 * spectrum canvas for verification.
 */

import { EngineSoundDriver, REVERB_PRESETS } from './engine-driver.mjs';
import { CROSSPLANE_V8, FLATPLANE_V8 } from './engine-config.mjs';
import { magnitudeSpectrum } from './fft.mjs';

const $ = (id) => document.getElementById(id);

const driver = new EngineSoundDriver(CROSSPLANE_V8, {
  quality: 'lite',
  preset: 'garage',
  masterGain: 0.85,
});

const state = { rpm: 1200, throttle: 0, load: 0.1, cabin: 1 };
let engineKey = 'cross';
let sweepTimer = null;
let limiterTimer = null;
let sweepDir = 1;
const udpMode = new URLSearchParams(location.search).has('udp');
let bridgeOk = false;

// --- preset select -------------------------------------------------------
const sel = $('preset');
for (const [key, p] of Object.entries(REVERB_PRESETS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = `${p.name} (${key})`;
  sel.append(opt);
}
sel.value = 'garage';

function bindRange(id, outId, fmt, onChange) {
  const el = $(id);
  const out = $(outId);
  const apply = () => {
    const v = Number(el.value);
    out.textContent = fmt(v);
    onChange(v);
  };
  el.addEventListener('input', apply);
  apply();
}

bindRange('rpm', 'rpmOut', (v) => v.toFixed(0), (v) => (state.rpm = v));
bindRange('throttle', 'throttleOut', (v) => `${v}%`, (v) => (state.throttle = v / 100));
bindRange('load', 'loadOut', (v) => (v / 100).toFixed(2), (v) => (state.load = v / 100));
bindRange('cabin', 'cabinOut', (v) => (v >= 50 ? '内' : '外'), (v) => (state.cabin = v / 100));
bindRange('wet', 'wetOut', (v) => (v / 100).toFixed(2), (v) => driver.setReverb({ mix: v / 100 }));
bindRange('decay', 'decayOut', (v) => (v / 100).toFixed(2), (v) => driver.setReverb({ decay: v / 100 }));
bindRange('gain', 'gainOut', (v) => (v / 100).toFixed(2), (v) => driver.setMasterGain(v / 100));

$('preset').addEventListener('change', (e) => {
  driver.setPreset(e.target.value);
  const p = REVERB_PRESETS[e.target.value];
  $('wet').value = Math.round(p.mix * 100);
  $('decay').value = Math.round(p.decay * 100);
  $('wetOut').textContent = p.mix.toFixed(2);
  $('decayOut').textContent = p.decay.toFixed(2);
});

$('quality').addEventListener('click', (e) => {
  const high = driver.quality !== 'high';
  driver.swap(engineKey === 'flat' ? FLATPLANE_V8 : CROSSPLANE_V8, high ? 'high' : 'lite');
  e.target.textContent = high ? '切换 lite（精简）' : '切换 high（完整管道）';
  $('qualityOut').textContent = high ? 'high（完整管道）' : 'lite（精简）';
});

$('crank').addEventListener('click', (e) => {
  engineKey = engineKey === 'flat' ? 'cross' : 'flat';
  driver.swap(engineKey === 'flat' ? FLATPLANE_V8 : CROSSPLANE_V8, driver.quality);
  e.target.textContent = engineKey === 'flat' ? '十字曲轴（恢复）' : '平轴曲轴（A/B）';
});

$('start').addEventListener('click', async () => {
  const ok = await driver.start();
  $('start').textContent = ok ? '引擎运行中' : `失败: ${driver.failed?.message || '未知'}`;
});

$('ignition').addEventListener('click', () => {
  driver.update({ ...state, running: false, cut: false, pop: 0 });
  $('ignition').classList.toggle('active');
  $('ignition').textContent = $('ignition').classList.contains('active') ? '点火恢复' : '熄火';
});

function stopSweep() {
  clearInterval(sweepTimer);
  sweepTimer = null;
  $('sweep').classList.remove('active');
}

$('sweep').addEventListener('click', () => {
  if (sweepTimer) return stopSweep();
  $('sweep').classList.add('active');
  state.throttle = 1;
  state.rpm = 800;
  $('throttle').value = 100;
  $('throttleOut').textContent = '100%';
  $('rpm').value = 800;
  $('rpmOut').textContent = '800';
  sweepDir = 1;
  sweepTimer = setInterval(() => {
    state.rpm += 45 * sweepDir;
    $('rpm').value = Math.round(state.rpm);
    $('rpmOut').textContent = Math.round(state.rpm).toFixed(0);
    if (state.rpm >= 6500) {
      // Hit the limiter, then lift off: throttle cut + overrun crackle.
      state.rpm = 6500;
      driver.update({ ...state, cut: true, pop: 0.8 });
      setTimeout(() => {
        if (!sweepTimer) return;
        sweepDir = -1;
        state.throttle = 0;
        $('throttle').value = 0;
        $('throttleOut').textContent = '0%';
        driver.update({ ...state, cut: false, pop: 0.7 });
      }, 1400);
    } else if (sweepDir < 0 && state.rpm <= 900) {
      driver.update({ ...state, cut: false, pop: 0 });
      stopSweep();
    }
  }, 30);
});

let limiterOn = false;
$('limiter').addEventListener('click', () => {
  limiterOn = !limiterOn;
  $('limiter').classList.toggle('active', limiterOn);
  if (limiterOn) {
    state.throttle = 1;
    state.rpm = 6550;
    $('throttle').value = 100;
    $('rpm').value = 6550;
    limiterTimer = setInterval(() => {
      $('rpm').value = 6550 + Math.round(Math.sin(Date.now() / 55) * 60);
      state.rpm = Number($('rpm').value);
    }, 50);
  } else {
    clearInterval(limiterTimer);
    state.rpm = 4000;
    $('rpm').value = 4000;
  }
});

$('pop').addEventListener('click', () => {
  state.throttle = 0;
  $('throttle').value = 0;
  $('throttleOut').textContent = '0%';
  driver.update({ ...state, cut: false, pop: 0.9 });
  setTimeout(() => driver.update({ ...state, pop: 0 }), 3500);
});

// --- frame loop ----------------------------------------------------------
setInterval(() => {
  if (!driver.ready) return;
  driver.update({ ...state, running: !$('ignition').classList.contains('active') });
}, 16);

// --- UDP bridge following mode -------------------------------------------
// Simulator -> UDP -> node tools/udp-bridge.mjs -> HTTP /state -> this page.
if (udpMode) {
  document.querySelectorAll('.ctl, .btns').forEach((el) => (el.style.opacity = 0.45));
  setInterval(async () => {
    try {
      const r = await fetch('http://localhost:8081/state');
      if (!r.ok) throw new Error();
      const s = await r.json();
      bridgeOk = true;
      driver.update({
        rpm: s.rpm,
        throttle: s.throttle,
        load: s.load,
        cut: s.cut,
        pop: s.pop,
        running: s.running,
        cabin: s.cabin,
      });
      $('rpm').value = Math.round(s.rpm);
      $('rpmOut').textContent = Math.round(s.rpm).toFixed(0);
      $('throttle').value = Math.round(s.throttle * 100);
      $('throttleOut').textContent = `${Math.round(s.throttle * 100)}%`;
    } catch {
      bridgeOk = false;
    }
  }, 50);
  setInterval(() => {
    document.title = bridgeOk ? 'V4f · UDP 跟随中' : 'V4f · UDP 未连接';
  }, 500);
}

// --- live spectrum -------------------------------------------------------
const canvas = $('spectrum');
const ctx2d = canvas.getContext('2d');
const N = 2048;
const buf = new Float32Array(N);
const im = new Float32Array(N);
let analyser = null;

function drawSpectrum() {
  const ac = driver.ctx;
  const node = driver.node;
  const w = canvas.width;
  const h = canvas.height;
  ctx2d.fillStyle = '#14181e';
  ctx2d.fillRect(0, 0, w, h);
  if (!ac || !node) {
    requestAnimationFrame(drawSpectrum);
    return;
  }
  // Analyse the dry path by copying the graph: node -> analyser -> (no out)
  if (!analyser) {
    analyser = ac.createAnalyser();
    analyser.fftSize = N;
    node.connect(analyser);
    analyser.connected = true;
  }
  analyser.getFloatTimeDomainData(buf);
  const mag = magnitudeSpectrum(buf);
  const bins = Math.min(w, mag.length);
  ctx2d.strokeStyle = '#e0582e';
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  for (let x = 0; x < bins; x++) {
    const v = Math.max(0, 1 + Math.log10(Math.max(mag[x], 1e-9)) / 4.5);
    const y = h - v * (h - 4) - 2;
    if (x === 0) ctx2d.moveTo(x, y);
    else ctx2d.lineTo(x, y);
  }
  ctx2d.stroke();
  const stats = driver.getStats();
  $('statCpu').textContent = stats.cpu === null ? 'n/a' : `${stats.cpu.toFixed(2)}%`;
  $('statPeak').textContent = stats.peak.toFixed(3);
  $('statSr').textContent = `${driver.sampleRate} Hz`;
  requestAnimationFrame(drawSpectrum);
}
drawSpectrum();

window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') driver.resetReverb();
});
