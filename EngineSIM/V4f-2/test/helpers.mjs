// test/helpers.mjs — 测试共享工具：FFT、阶次分析、WAV 写出

import fs from 'node:fs';

// 基2 FFT（原地，复数交错数组 re0 im0 re1 im1 ...）
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const u1 = re[i + k], u2 = im[i + k];
        const v1 = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const v2 = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = u1 + v1; im[i + k] = u2 + v2;
        re[i + k + len / 2] = u1 - v1; im[i + k + len / 2] = u2 - v2;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// 幅度谱（Hann 窗，内部截断到 2 次幂长度；返回 { freq, amp }，amp 已归一化）
export function spectrum(signal, sampleRate) {
  let n = 1;
  while (n * 2 <= signal.length) n *= 2;
  let re = new Float64Array(n), im = new Float64Array(n);
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
    re[i] = signal[i] * w; im[i] = 0; wsum += w;
  }
  fft(re, im);
  const out = [];
  const bin = sampleRate / n;
  for (let i = 0; i < n / 2; i++) {
    const a = 2 * Math.hypot(re[i], im[i]) / wsum;
    out.push({ freq: i * bin, amp: a });
  }
  return out;
}

// 在目标频率 ±tolHz 内取峰值幅度
export function peakAt(spec, freqHz, tolHz = 8) {
  let best = 0;
  for (const s of spec) {
    if (Math.abs(s.freq - freqHz) <= tolHz && s.amp > best) best = s.amp;
  }
  return best;
}

// Goertzel 相干线幅测量：在精确频率上累积 N 个样本，
// 真实谱线信噪比提升 √N，噪声底被压制 → 适合阶次结构断言
export function goertzel(signal, freqHz, sampleRate) {
  const N = signal.length;
  const coef = 2 * Math.cos(2 * Math.PI * freqHz / sampleRate);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    const s = signal[i] + coef * s1 - s2;
    s2 = s1; s1 = s;
  }
  return 2 * Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coef * s1 * s2)) / N;
}

// 写入 16bit WAV（单声道/立体声）
export function writeWav(path, left, right, sampleRate) {
  const n = left.length;
  const ch = right ? 2 : 1;
  const dataLen = n * ch * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(dataLen, 40);
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(clamp(left[i]) * 32767, 44 + i * ch * 2);
    if (ch === 2) buf.writeInt16LE(clamp(right[i]) * 32767, 44 + i * ch * 2 + 2);
  }
  fs.writeFileSync(path, buf);
  return path;
}

// 信号统计
export function stats(sig) {
  let mx = 0, rms = 0, nn = 0;
  for (let i = 0; i < sig.length; i++) {
    const a = Math.abs(sig[i]);
    if (a > mx) mx = a;
    rms += sig[i] * sig[i];
    if (!Number.isFinite(sig[i])) nn++;
  }
  return { peak: mx, rms: Math.sqrt(rms / sig.length), nonfinite: nn };
}
