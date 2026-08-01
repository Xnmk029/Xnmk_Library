// tools/render-wav.mjs — 离线渲染引擎声音到 out/*.wav
// 用法：node tools/render-wav.mjs [idle|cruise|launch|limiter|presets|all]
// 产出：out/idle.wav（怠速）、out/cruise.wav（巡航）、out/launch.wav（0-红线）、
//       out/limiter.wav（限速器断油）、out/preset-*.wav（8 组混响预设）
// 同时把信号统计打印到控制台（峰值/RMS/非有限数）。

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EngineDSP } from '../src/engine-dsp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'out');
mkdirSync(outDir, { recursive: true });

const SR = 48000;

function writeWav(path, left, right) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const cl = Math.max(-1, Math.min(1, left[i]));
    const cr = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE(cl * 32767, 44 + i * 4);
    buf.writeInt16LE(cr * 32767, 44 + i * 4 + 2);
  }
  writeFileSync(path, buf);
  console.log('✔', path, `(${(n / SR).toFixed(1)}s)`);
}

function stats(buf) {
  let peak = 0, rms = 0, nn = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a > peak) peak = a;
    rms += buf[i] * buf[i];
    if (!Number.isFinite(buf[i])) nn++;
  }
  return { peak: peak.toFixed(3), rms: Math.sqrt(rms / buf.length).toFixed(4), nonfinite: nn };
}

const SCENES = {
  idle: (dsp) => { dsp.setRpm(750); dsp.setThrottle(0); },
  cruise: (dsp, t) => { dsp.setRpm(2600); dsp.setThrottle(0.35); dsp.setLoad(0.4); },
  launch: (dsp, t) => {
    const p = Math.min(1, t / 6);
    dsp.setRpm(700 + p * 5900);
    dsp.setThrottle(1); dsp.setLoad(0.8);
    if (t > 4.5 && t < 4.8) dsp.triggerBackfire();
  },
  limiter: (dsp, t) => {
    dsp.setRpm(6600); dsp.setThrottle(0.9);
    dsp.setFuelCut(Math.sin(t * 3) > 0.5);
  },
  sweep: (dsp, t) => { dsp.setRpm(700 + (t / 10) * 5900); dsp.setThrottle(0.9); },
};

async function renderScene(name, seconds = 8, fn, preset = 'garage') {
  const dsp = new EngineDSP(SR, null, 'high');
  dsp.setPreset(preset);
  const buf = dsp.render(seconds, (d, t) => fn(d, t));
  const p = join(outDir, `${name}.wav`);
  writeWav(p, buf.left, buf.right);
  console.log(`   stats: peak=${stats(buf.left).peak} rms=${stats(buf.left).rms} nonfinite=${stats(buf.left).nonfinite}`);
}

const what = process.argv[2] || 'all';
const jobs = [];
if (what === 'idle' || what === 'all') jobs.push(renderScene('idle', 6, SCENES.idle));
if (what === 'cruise' || what === 'all') jobs.push(renderScene('cruise', 6, SCENES.cruise));
if (what === 'launch' || what === 'all') jobs.push(renderScene('launch', 8, SCENES.launch));
if (what === 'limiter' || what === 'all') jobs.push(renderScene('limiter', 6, SCENES.limiter));
if (what === 'sweep' || what === 'all') jobs.push(renderScene('sweep', 10, SCENES.sweep));
if (what === 'presets' || what === 'all') {
  const presets = ['studio', 'open', 'garage', 'tunnel', 'hall', 'canyon', 'pitlane', 'cabin'];
  for (const p of presets) jobs.push(renderScene(`preset-${p}`, 6, SCENES.cruise, p));
}
await Promise.all(jobs);
console.log('done.');
