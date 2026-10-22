// PNG frame analyzer: gives numeric feedback about a rendered frame without needing eyes.
//
// Usage: node tools/analyze.mjs /tmp/shot.png [--grid 4] [--json]
//
// Reports: luminance stats + percentiles, clipping, colour balance, saturation, structure (edge
// energy), a coarse region grid of mean colours, and a heuristic verdict (black frame / washed out /
// flat / plausible).
import fs from 'node:fs';
import zlib from 'node:zlib';

export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let pos = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('only 8-bit png supported, got ' + bitDepth);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('unsupported colour type ' + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride);
    rp += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v = v + a; break;
        case 2: v = v + b; break;
        case 3: v = v + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error('bad filter ' + filter);
      }
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width: w, height: h, channels, data: out };
}

export function analyze(img, gridN = 4) {
  const { width: w, height: h, channels, data } = img;
  const n = w * h;
  const lum = new Float32Array(n);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let black = 0;
  let white = 0;
  let satSum = 0;

  for (let i = 0; i < n; i++) {
    const o = i * channels;
    const r = data[o] / 255;
    const g = data[o + 1] / 255;
    const b = data[o + 2] / 255;
    sumR += r;
    sumG += g;
    sumB += b;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum[i] = l;
    if (l < 0.012) black++;
    if (l > 0.988) white++;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    satSum += mx > 0 ? (mx - mn) / mx : 0;
  }

  const sorted = Float32Array.from(lum).sort();
  const pct = (p) => sorted[Math.min(n - 1, Math.max(0, Math.floor(p * n)))];

  // Structure: mean |gradient| on luminance (Sobel-lite).
  let edge = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      edge += Math.hypot(gx, gy);
    }
  }
  edge /= ((h - 2) / 2) * ((w - 2) / 2);

  // Region grid of mean colours.
  const grid = [];
  const cw = Math.floor(w / gridN);
  const ch = Math.floor(h / gridN);
  for (let gy = 0; gy < gridN; gy++) {
    const row = [];
    for (let gx = 0; gx < gridN; gx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let c = 0;
      for (let y = gy * ch; y < (gy + 1) * ch; y += 2) {
        for (let x = gx * cw; x < (gx + 1) * cw; x += 2) {
          const o = (y * w + x) * channels;
          r += data[o];
          g += data[o + 1];
          b += data[o + 2];
          c++;
        }
      }
      row.push([Math.round(r / c), Math.round(g / c), Math.round(b / c)]);
    }
    grid.push(row);
  }

  const mean = (sumR + sumG + sumB) / (3 * n);
  const meanL = sorted.reduce((a, b) => a + b, 0) / n;
  const stats = {
    size: [w, h],
    meanLuma: +meanL.toFixed(4),
    medianLuma: +pct(0.5).toFixed(4),
    p01: +pct(0.01).toFixed(4),
    p05: +pct(0.05).toFixed(4),
    p95: +pct(0.95).toFixed(4),
    p99: +pct(0.99).toFixed(4),
    blackPct: +((black / n) * 100).toFixed(2),
    whitePct: +((white / n) * 100).toFixed(2),
    meanRGB: [+(sumR / n).toFixed(3), +(sumG / n).toFixed(3), +(sumB / n).toFixed(3)],
    saturation: +(satSum / n).toFixed(3),
    edgeEnergy: +edge.toFixed(4),
    dynamicRange: +(pct(0.99) - pct(0.01)).toFixed(4),
    grid,
  };

  const verdict = [];
  if (stats.blackPct > 92) verdict.push('BLACK FRAME — nothing is being drawn');
  else if (stats.meanLuma < 0.03) verdict.push('NEAR BLACK — exposure or lighting broken');
  if (stats.whitePct > 25) verdict.push('BLOWN OUT — too much clipping');
  if (stats.edgeEnergy < 0.004 && stats.blackPct < 92) verdict.push('FLAT — almost no structure (fog too thick? camera inside geometry?)');
  if (stats.dynamicRange < 0.12 && stats.blackPct < 92) verdict.push('LOW CONTRAST');
  if (stats.saturation < 0.02) verdict.push('DESATURATED — greyscale-looking frame');
  if (!verdict.length) verdict.push('plausible image: has structure, contrast and colour');
  stats.verdict = verdict;
  void mean;
  return stats;
}

/** Mean absolute difference between two decoded images, plus where the change is concentrated. */
export function diff(a, b, gridN = 3) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('size mismatch');
  const n = a.width * a.height;
  let sum = 0;
  let mx = 0;
  let changed = 0;
  const grid = Array.from({ length: gridN }, () => new Array(gridN).fill(0));
  const cw = Math.floor(a.width / gridN);
  const ch = Math.floor(a.height / gridN);
  const counts = Array.from({ length: gridN }, () => new Array(gridN).fill(0));
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x);
      const oa = i * a.channels;
      const ob = i * b.channels;
      const d = (Math.abs(a.data[oa] - b.data[ob]) + Math.abs(a.data[oa + 1] - b.data[ob + 1]) + Math.abs(a.data[oa + 2] - b.data[ob + 2])) / 3;
      sum += d;
      if (d > mx) mx = d;
      if (d > 3) changed++;
      const gx = Math.min(gridN - 1, Math.floor(x / cw));
      const gy = Math.min(gridN - 1, Math.floor(y / ch));
      grid[gy][gx] += d;
      counts[gy][gx]++;
    }
  }
  return {
    meanAbs: +(sum / n).toFixed(3),
    maxAbs: mx,
    changedPct: +((changed / n) * 100).toFixed(2),
    grid: grid.map((row, gy) => row.map((v, gx) => +(v / counts[gy][gx]).toFixed(2))),
  };
}

if (process.argv[1] && process.argv[1].endsWith('analyze.mjs')) {
  const file = process.argv[2];
  const gridArg = process.argv.indexOf('--grid');
  const gridN = gridArg > 0 ? Number(process.argv[gridArg + 1]) : 4;
  const img = decodePNG(fs.readFileSync(file));
  const st = analyze(img, gridN);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(st));
  } else {
    console.log(`\n${file}  ${st.size[0]}x${st.size[1]}`);
    console.log(`  luma   mean ${st.meanLuma}  median ${st.medianLuma}  p01 ${st.p01}  p05 ${st.p05}  p95 ${st.p95}  p99 ${st.p99}`);
    console.log(`  clip   black ${st.blackPct}%  white ${st.whitePct}%   range ${st.dynamicRange}`);
    console.log(`  colour meanRGB ${st.meanRGB.join(', ')}  saturation ${st.saturation}`);
    console.log(`  detail edgeEnergy ${st.edgeEnergy}`);
    console.log('  grid (mean RGB per cell):');
    for (const row of st.grid) console.log('    ' + row.map((c) => c.map((v) => String(v).padStart(3)).join(',')).join('  |  '));
    console.log('  verdict: ' + st.verdict.join(' / ') + '\n');
  }
}
