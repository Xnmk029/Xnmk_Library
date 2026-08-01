// 离线渲染工具：把 DSP 渲染成 WAV（16-bit PCM 立体声）并打印 CPU 占比。
// 用法：node tools/render-offline.mjs [seconds] [quality] [out.wav]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const DSP = require('../src/engine-dsp.js');

const seconds = Number(process.argv[2] || 20);
const quality = process.argv[3] === 'lite' ? 'lite' : 'high';
const outFile = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.resolve('render-out.wav');

function writeWav(file, sampleRate, left, right) {
  const n = left.length;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    data.writeInt16LE((l * 32767) | 0, i * 4);
    data.writeInt16LE((r * 32767) | 0, i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

const script = (t) => {
  // 模拟一段驾驶：暖机 → 拉转速 → 巡航 → 断油回火
  const rpm =
    t < 3 ? 900 + t * 300 :
    t < 7 ? 1800 + (t - 3) * 1100 :
    t < 11 ? 6200 - (t - 7) * 300 :
    t < 14 ? 4400 + (t - 11) * 500 :
    t < 16 ? 6500 :
    t < 17 ? 2400 :
    3000;
  const throttle =
    t < 1 ? 0.25 :
    t < 7 ? 0.85 :
    t < 11 ? 0.55 :
    t < 14 ? 0.9 :
    t < 16 ? 0.95 :
    t < 17 ? 0.05 :
    0.6;
  return {
    rpm: Math.max(800, Math.min(6800, rpm)),
    throttle,
    ignition: true,
    cutoff: t >= 15.2 && t < 15.8,
    preset: t < 5 ? 'garage' : (t < 12 ? 'tunnel' : 'hall'),
    noiseGain: 0.8
  };
};

console.log(`渲染 ${seconds}s @48kHz，质量档：${quality}`);
const t0 = Date.now();
const result = DSP.renderOffline({
  sampleRate: 48000,
  duration: seconds,
  quality,
  seed: 20260731,
  script
});
const elapsed = (Date.now() - t0) / 1000;
writeWav(outFile, result.sampleRate, result.left, result.right);

let peak = 0;
for (let i = 0; i < result.left.length; i++) {
  peak = Math.max(peak, Math.abs(result.left[i]), Math.abs(result.right[i]));
}
const cpuPct = (elapsed / seconds * 100).toFixed(1);
console.log(`输出：${outFile}`);
console.log(`耗时 ${elapsed.toFixed(2)}s，单核 CPU 占比 ≈ ${cpuPct}%`);
console.log(`峰值 ${peak.toFixed(3)}（软限幅后应 ≤ 1.0）`);
console.log(`burble 指标（十字曲轴 0.5 阶/4 阶）≈ ` +
  DSP.internal.analyzeBurble('crossplane', { rpm: 6000, sampleRate: 48000, seconds: 4 }).ratio.toFixed(4));
