// check.js — 把 answer.svg（本生成器的输出子集：M/Q/Q/Z path + 基础 rect）
// 光栅化为 600x800 的 24 位 BMP，用于构图视觉自查（不依赖任何外部库）。
'use strict';
const fs = require('fs');
const svg = fs.readFileSync(__dirname + '/answer.svg', 'utf8');

// 用法: node check.js [x0 y0 x1 y1 scale outname]  缺省=全幅 0.5x preview
const A = process.argv.slice(2);
const CR = A.length >= 4 ? A.slice(0, 4).map(Number) : [0, 0, 1200, 1600];
const S = A.length >= 5 ? +A[4] : 0.5;
const OUT = A.length >= 6 ? A[5] : 'preview';
const CW = Math.round((CR[2] - CR[0]) * S), CH = Math.round((CR[3] - CR[1]) * S);
const buf = Buffer.alloc(CW * CH * 3); // 行优先，自顶向下
const TX = (x) => (x - CR[0]) * S, TY = (y) => (y - CR[1]) * S;

function fillRect(x0, y0, x1, y1, r, g, b) {
  x0 = Math.max(0, Math.floor(TX(x0))); y0 = Math.max(0, Math.floor(TY(y0)));
  x1 = Math.min(CW - 1, Math.ceil(TX(x1))); y1 = Math.min(CH - 1, Math.ceil(TY(y1)));
  for (let y = y0; y <= y1; y++) {
    const row = y * CW * 3;
    for (let x = x0; x <= x1; x++) { const i = row + x * 3; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; }
  }
}

function fillPoly(pts, r, g, b, a) {
  // pts: [x,y,...] 画布坐标；先变换到像素空间再扫描线填充
  const n = pts.length / 2;
  const q = new Float64Array(pts.length);
  let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
  for (let i = 0; i < n; i++) {
    const px = TX(pts[i * 2]), py = TY(pts[i * 2 + 1]);
    q[i * 2] = px; q[i * 2 + 1] = py;
    if (px < xmin) xmin = px; if (px > xmax) xmax = px;
    if (py < ymin) ymin = py; if (py > ymax) ymax = py;
  }
  if (xmax < 0 || xmin >= CW || ymax < 0 || ymin >= CH) return;
  const x0 = Math.max(0, Math.floor(xmin)), x1 = Math.min(CW - 1, Math.ceil(xmax));
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(CH - 1, Math.ceil(ymax));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5; const xs = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ya = q[i * 2 + 1], yb = q[j * 2 + 1];
      if ((ya <= yc && yb > yc) || (yb <= yc && ya > yc)) {
        const t = (yc - ya) / (yb - ya);
        xs.push(q[i * 2] + t * (q[j * 2] - q[i * 2]));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a2, b2) => a2 - b2);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(x0, Math.ceil(xs[k])), xb = Math.min(x1, Math.floor(xs[k + 1]));
      if (xa > xb) continue;
      const row = y * CW * 3;
      for (let x = xa; x <= xb; x++) {
        const i = row + x * 3;
        if (a >= 0.999) { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; }
        else { buf[i] = Math.round(buf[i] * (1 - a) + r * a); buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + g * a); buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + b * a); }
      }
    }
  }
}

// 基础 rect
const rectM = svg.match(/<rect x="0" y="0" width="1200" height="1600" fill="(#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2}))"/);
if (rectM) fillRect(0, 0, 1200, 1600, parseInt(rectM[2], 16), parseInt(rectM[3], 16), parseInt(rectM[4], 16));

// paths
const re = /<path d="M(-?\d+\.?\d*) (-?\d+\.?\d*)Q(-?\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*)Q(-?\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*)Z" fill="(rgb|rgba)\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)"/g;
let m, npath = 0;
while ((m = re.exec(svg)) !== null) {
  const x0 = +m[1], y0 = +m[2], c1x = +m[3], c1y = +m[4], x2 = +m[5], y2 = +m[6];
  const c2x = +m[7], c2y = +m[8], x3 = +m[9], y3 = +m[10];
  const r = +m[12], g = +m[13], b = +m[14], a = m[15] ? +m[15] : 1;
  const pts = [];
  const quad = (px, py, qx, qy, ex, ey) => { for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push(u * u * px + 2 * u * t * qx + t * t * ex, u * u * py + 2 * u * t * qy + t * t * ey); } };
  pts.push(x0, y0);
  quad(x0, y0, c1x, c1y, x2, y2);
  quad(x2, y2, c2x, c2y, x3, y3);
  fillPoly(pts, r, g, b, a);
  npath++;
}

// 写 24 位 BMP（自底向上，行 4 字节对齐）
const stride = (CW * 3 + 3) & ~3;
const img = Buffer.alloc(stride * CH);
for (let y = 0; y < CH; y++) {
  const src = y * CW * 3, dst = (CH - 1 - y) * stride;
  buf.copy(img, dst, src, src + CW * 3);
}
const hdr = Buffer.alloc(14 + 40);
hdr.write('BM', 0); hdr.writeUInt32LE(54 + img.length, 2); hdr.writeUInt32LE(54, 10);
hdr.writeUInt32LE(40, 14); hdr.writeInt32LE(CW, 18); hdr.writeInt32LE(CH, 22);
hdr.writeUInt16LE(1, 26); hdr.writeUInt16LE(24, 28);
const file = Buffer.concat([hdr, img]);
fs.writeFileSync(__dirname + '/' + OUT + '.bmp', file);

// 同时输出 PNG（供 read_image / 视觉工具查看）
function crc32(b) { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let crc = 0xFFFFFFFF; for (const v of b) crc = t[(crc ^ v) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, cr]); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(CW, 0); ihdr.writeUInt32BE(CH, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(CH * (1 + CW * 3));
for (let y = 0; y < CH; y++) { raw[y * (1 + CW * 3)] = 0; buf.copy(raw, y * (1 + CW * 3) + 1, y * CW * 3, (y + 1) * CW * 3); }
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', require('node:zlib').deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(__dirname + '/' + OUT + '.png', png);
console.log(`rendered paths=${npath} crop=[${CR}] scale=${S} -> ${OUT}.bmp (${file.length} B) + ${OUT}.png (${png.length} B)`);
