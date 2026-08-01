'use strict';
const fs = require('fs');
const path = require('path');
const { decodeDDS, decodeDDSMip } = require('./dds_png.js');
const f = path.join(__dirname, '..', 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles', 'ccf', 'textures', 'ccf_main_b.color.dds');
const buf = fs.readFileSync(f);
const dds = decodeDDS(buf);
const mip = dds.mips[0];
const rgba = decodeDDSMip(dds, mip);
let sum = [0, 0, 0], sum2 = [0, 0, 0];
const n = mip.w * mip.h;
let black = 0, white = 0, transparent = 0;
const hist = new Uint32Array(64);
for (let i = 0; i < n; i++) {
  const o = i * 4;
  for (let c = 0; c < 3; c++) {
    sum[c] += rgba[o + c];
    sum2[c] += rgba[o + c] * rgba[o + c];
  }
  if (rgba[o] < 24 && rgba[o + 1] < 24 && rgba[o + 2] < 24) black++;
  if (rgba[o] > 231 && rgba[o + 1] > 231 && rgba[o + 2] > 231) white++;
  if (rgba[o + 3] < 250) transparent++;
  const lum = (rgba[o] + rgba[o + 1] + rgba[o + 2]) / 3;
  hist[Math.min(63, lum >> 2)]++;
}
const mean = sum.map(s => s / n);
const std = sum2.map((s2, c) => Math.sqrt(s2 / n - mean[c] * mean[c]));
console.log('mean RGB:', mean.map(v => +v.toFixed(1)), 'std:', std.map(v => +v.toFixed(1)));
console.log('black%', (100 * black / n).toFixed(2), 'white%', (100 * white / n).toFixed(2), 'transparent%', (100 * transparent / n).toFixed(2));
const peaks = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log('luminance peaks (bin,count):', peaks.map(([b, c]) => [b * 4, c]).map(([b, c]) => b + ':' + (100 * c / n).toFixed(1) + '%').join(' '));
