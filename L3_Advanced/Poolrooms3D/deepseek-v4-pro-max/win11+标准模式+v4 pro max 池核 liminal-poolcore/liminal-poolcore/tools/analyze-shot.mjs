/**
 * tools/analyze-shot.mjs — 截图客观分析（零依赖，自带 PNG 解码）
 * ===========================================================================
 * 用途：CI / 无图像输入的环境下，验证渲染结果"确实是一张有内容的图"，而不是黑屏/纯色。
 * 检查项：
 *   · 非纯色（亮度标准差）        · 亮度均值在合理区间（不是全黑/全白过曝）
 *   · 色调偏青蓝（池核调色板）    · 颜色数量（真实渲染必然色阶丰富）
 *   · 上下半区亮度差（有天花/地板结构，而不是一片平涂）
 * 并输出一张 ASCII 亮度图，便于在纯文本环境里"看"构图。
 *
 * 用法：node tools/analyze-shot.mjs [smoke-shot.png]
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'smoke-shot.png');

/** 最小 PNG 解码器：8-bit、非隔行、colorType 0/2/6 */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let pos = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('只支持 8-bit PNG，实际 ' + bitDepth);
  if (interlace) throw new Error('不支持隔行 PNG');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error('不支持的 colorType ' + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride); rp += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = v;
    }
  }
  return { w, h, channels, data: out };
}

const img = decodePNG(fs.readFileSync(file));
const { w, h, channels, data } = img;
const px = (x, y) => {
  const i = (y * w + x) * channels;
  return [data[i], data[i + 1], data[i + 2]];
};
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

let sumR = 0, sumG = 0, sumB = 0, sumL = 0, sumL2 = 0, n = 0;
const colors = new Set();
let topL = 0, topN = 0, botL = 0, botN = 0;
for (let y = 0; y < h; y += 2) {
  for (let x = 0; x < w; x += 2) {
    const [r, g, b] = px(x, y);
    const l = lum(r, g, b);
    sumR += r; sumG += g; sumB += b; sumL += l; sumL2 += l * l; n++;
    if (colors.size < 200000) colors.add((r >> 2 << 12) | (g >> 2 << 6) | (b >> 2));
    if (y < h * 0.35) { topL += l; topN++; } else if (y > h * 0.6) { botL += l; botN++; }
  }
}
const meanL = sumL / n;
const std = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));
const meanR = sumR / n, meanG = sumG / n, meanB = sumB / n;

console.log(`=== 截图分析 ${path.basename(file)} (${w}×${h}, ${channels}ch) ===`);
console.log(`平均色 rgb(${meanR.toFixed(1)}, ${meanG.toFixed(1)}, ${meanB.toFixed(1)})  亮度均值 ${meanL.toFixed(1)}  标准差 ${std.toFixed(1)}`);
console.log(`量化颜色数 ${colors.size}  上区亮度 ${(topL / topN).toFixed(1)}  下区亮度 ${(botL / botN).toFixed(1)}`);

// ── ASCII 亮度图（在纯文本环境里"看"构图）──
const CW = 56, CH = 20;
const ramp = ' .:-=+*#%@';
console.log('\nASCII 亮度图（越亮的字符越靠 @）:');
for (let cy = 0; cy < CH; cy++) {
  let row = '';
  for (let cx = 0; cx < CW; cx++) {
    let acc = 0, cnt = 0;
    const x0 = Math.floor((cx / CW) * w), x1 = Math.max(x0 + 1, Math.floor(((cx + 1) / CW) * w));
    const y0 = Math.floor((cy / CH) * h), y1 = Math.max(y0 + 1, Math.floor(((cy + 1) / CH) * h));
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const [r, g, b] = px(x, y); acc += lum(r, g, b); cnt++; }
    const l = cnt ? acc / cnt : 0;
    row += ramp[Math.min(ramp.length - 1, Math.floor((l / 255) * ramp.length))];
  }
  console.log('  |' + row + '|');
}

const fails = [];
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
  if (!cond) fails.push(name);
};
console.log('');
ok('不是黑屏', meanL > 18, `亮度均值 ${meanL.toFixed(1)}`);
ok('不是纯色平涂', std > 6, `标准差 ${std.toFixed(1)}`);
ok('未整体过曝', meanL < 244, `亮度均值 ${meanL.toFixed(1)}`);
ok('色调偏青/蓝（池核调色板）', meanB >= meanR - 1, `B=${meanB.toFixed(1)} R=${meanR.toFixed(1)}`);
ok('色阶丰富（真实渲染）', colors.size > 400, `${colors.size} 个量化色`);
ok('画面有纵向结构', Math.abs(topL / topN - botL / botN) > 3, `上下亮度差 ${(topL / topN - botL / botN).toFixed(1)}`);

console.log(fails.length ? `\n${fails.length} 项失败 ❌` : '\n全部通过 ✅');
process.exit(fails.length ? 1 : 0);
