/**
 * spectrogram.mjs -- zero-dependency spectrogram PNG renderer.
 *
 *   node tools/spectrogram.mjs out/sweep.wav out/spectrogram-sweep.png
 *
 * Log-frequency (30 Hz - 12 kHz) STFT waterfall, used to verify the engine
 * order structure (firing-rate lines that sweep up with rpm) and the reverb
 * tail without any external imaging library.
 */

import { readFileSync, writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { magnitudeSpectrum } from '../src/fft.mjs';

const W = 1100;
const H = 520;
const WIN = 2048;
const HOP = 512;
const F_MIN = 30;
const F_MAX = 12000;

function readWav(path) {
  const b = readFileSync(path);
  const channels = b.readUInt16LE(22);
  const sr = b.readUInt32LE(24);
  const bits = b.readUInt16LE(34);
  const dataOff = 44;
  const n = Math.floor((b.length - dataOff) / (channels * (bits / 8)));
  const mono = new Float32Array(n);
  const step = bits / 8;
  for (let i = 0; i < n; i++) {
    const o = dataOff + i * channels * step;
    let v = 0;
    for (let c = 0; c < channels; c++) {
      if (bits === 16) v += b.readInt16LE(o + c * step) / 32767;
      else v += b.readFloatLE(o + c * step);
    }
    mono[i] = v / channels;
  }
  return { sr, mono };
}

function hann(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function writePng(path, rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

function render(srcPath, dstPath) {
  const { sr, mono } = readWav(srcPath);
  const win = hann(WIN);
  const frames = Math.max(1, Math.floor((mono.length - WIN) / HOP) + 1);
  const fLog = (f) => Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN);
  const rgba = Buffer.alloc(W * H * 4);
  const bin = (f) => Math.round((f / sr) * 2 * (WIN / 2 - 1));
  const row = new Float64Array(W);

  for (let x = 0; x < W; x++) {
    const fi = Math.min(frames - 1, Math.floor((x / W) * frames));
    const off = fi * HOP;
    const seg = new Float64Array(WIN);
    for (let i = 0; i < WIN; i++) seg[i] = mono[off + i] * win[i];
    const mag = magnitudeSpectrum(seg);
    for (let y = 0; y < H; y++) {
      const f = F_MIN * Math.pow(F_MAX / F_MIN, y / (H - 1));
      const i = Math.min(bin(f), mag.length - 1);
      // Small local max over the two neighbour bins for a crisp line.
      row[y] = Math.max(mag[i - 1] || 0, mag[i], mag[i + 1] || 0);
    }
    let maxRow = 1e-9;
    for (let y = 0; y < H; y++) maxRow = Math.max(maxRow, row[y]);
    for (let y = 0; y < H; y++) {
      const v = Math.max(0, Math.min(1, row[y] / maxRow));
      const db = Math.max(0, Math.min(1, 1 + Math.log10(Math.max(v, 1e-5)) / 5));
      const o = (y * W + x) * 4;
      // Dark blue-black background -> orange-hot signal.
      rgba[o] = Math.round(16 + 214 * db);
      rgba[o + 1] = Math.round(18 + 92 * db);
      rgba[o + 2] = Math.round(22 + 46 * db);
      rgba[o + 3] = 255;
    }
  }
  writePng(dstPath, rgba, W, H);
  console.log(`wrote ${dstPath} (${frames} frames @ ${sr} Hz)`);
}

const [src, dst] = process.argv.slice(2);
if (!src || !dst) {
  console.error('usage: node tools/spectrogram.mjs <in.wav> <out.png>');
  process.exit(1);
}
render(src, dst);
