// gen.js — 纯 SVG《蒙娜丽莎》笔触复刻生成器
// 构图坐标基于对 Wikimedia Commons (C2RMF) 原作参考图的比例测量：
// 头顶 y≈10%  眼线 y≈30%  鼻尖 y≈40%  嘴 y≈45%  下巴 y≈55%
// 肩 y≈63%    双手 y≈80-92%(略偏观者左)  扶手横跨底部 y≈94-96%  地平线 y≈65%
// 背景：观者左=暖褐(蜿蜒小径+小拱桥+岩坡)，观者右=冷蓝绿(河流+拱桥)，左右不对称
'use strict';
const fs = require('fs');
const W = 1200, H = 1600;

// ---------- 基础工具 ----------
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const expG = (x, y, cx, cy, rx, ry) => Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(0xC0FFEE);
function hash2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) | 0; h = Math.imul(h, 1274126177); h = (h ^ (h >>> 16)) >>> 0; return h / 4294967295; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o) { o = o || 3; let s = 0, amp = .5, f = 1; for (let i = 0; i < o; i++) { s += amp * vnoise(x * f, y * f); amp *= .5; f *= 2; } return s; }
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const n1 = v => { const r = Math.round(v * 10) / 10; return (r === 0 ? 0 : r).toString(); };

// ---------- 色板（贴近原作：赭褐/暗金/橄榄绿/深棕，背景蓝绿空气透视） ----------
const P = {
  haze: [158, 156, 130], hazeFar: [146, 148, 124],
  mtnL: [118, 102, 76], mtnL2: [104, 90, 66],
  mtnR: [116, 132, 116], mtnR2: [98, 116, 98],
  rock: [108, 92, 66], rockD: [80, 66, 47],
  pathC: [154, 136, 102], pathD: [120, 104, 76],
  bridge: [140, 128, 102], bridgeD: [102, 90, 68],
  river: [96, 128, 120], riverHi: [136, 164, 154], riverD: [76, 104, 98],
  skinHi: [216, 176, 130], skin: [182, 138, 98], skinSh: [142, 100, 66], skinDp: [112, 74, 48],
  lipU: [156, 100, 78], lipL: [192, 130, 106], lipLine: [74, 40, 30],
  hairD: [28, 21, 14], hair: [62, 47, 32], hairHi: [96, 72, 46],
  veil: [210, 196, 160],
  gown: [66, 52, 34], gownHi: [96, 78, 50], gownDp: [40, 31, 21],
  armR: [52, 56, 40], armRd: [36, 40, 28],
  sclera: [228, 216, 190], iris: [48, 32, 20], eyeD: [32, 23, 16], browC: [66, 48, 32],
};

// ---------- 几何辅助 ----------
function pline(pts) {
  const seg = []; let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy);
    seg.push({ x: pts[i][0], y: pts[i][1], dx: dx / L, dy: dy / L, L, start: tot }); tot += L;
  }
  return {
    tot,
    at(x, y) {
      let best = { d: 1e9, t: 0, tx: 0, ty: 1, s: 1 };
      for (const s of seg) {
        let tt = ((x - s.x) * s.dx + (y - s.y) * s.dy) / s.L; tt = clamp(tt, 0, 1);
        const px = s.x + s.dx * s.L * tt, py = s.y + s.dy * s.L * tt;
        const d = Math.hypot(x - px, y - py);
        if (d < best.d) best = { d, t: (s.start + s.L * tt) / this.tot, tx: s.dx, ty: s.dy, s: 1 };
      }
      return best;
    }
  };
}
function capsule(x1, y1, x2, y2, w) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy, L = Math.sqrt(L2), ux = dx / L, uy = dy / L;
  return {
    at(x, y) {
      const t = clamp(((x - x1) * dx + (y - y1) * dy) / L2, 0, 1);
      const px = x1 + dx * t, py = y1 + dy * t, d = Math.hypot(x - px, y - py);
      const wl = w * (1 - 0.30 * t);
      if (d > wl) return null;
      return { t, e: d / wl, tx: ux, ty: uy };
    }
  };
}
function qcurve(p0, c, p1, n) {
  n = n || 26; const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); }
  const Y = (x) => { // 曲线 y(x) 查找
    for (let i = 0; i < pts.length - 1; i++) if (x >= pts[i][0] && x <= pts[i + 1][0]) { const f = (x - pts[i][0]) / ((pts[i + 1][0] - pts[i][0]) || 1e-6); return pts[i][1] + f * (pts[i + 1][1] - pts[i][1]); }
    return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
  };
  return {
    pts, Y,
    dist(x, y) {
      let d = 1e9;
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const t = L2 ? clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1) : 0;
        d = Math.min(d, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
      }
      return d;
    }
  };
}

// ---------- 笔触发射（锥形叶状 path：两头尖、中间宽 = 锥形描边） ----------
const out = []; let count = 0;
function emit(x, y, ang, L, hw, col, al) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const x2 = x + L * c, y2 = y + L * s;
  const mx = x + L * 0.5 * c, my = y + L * 0.5 * s;
  const k1 = hw * (0.65 + 0.7 * rng()), k2 = hw * (0.65 + 0.7 * rng());
  const nx = -s, ny = c;
  const qx1 = mx + nx * k1, qy1 = my + ny * k1, qx2 = mx - nx * k2, qy2 = my - ny * k2;
  if (Math.max(x, x2, qx1, qx2) > W + 25 || Math.min(x, x2, qx1, qx2) < -25) return;
  if (Math.max(y, y2, qy1, qy2) > H + 25 || Math.min(y, y2, qy1, qy2) < -25) return;
  const r = clamp(Math.round(col[0]), 0, 255), g = clamp(Math.round(col[1]), 0, 255), b = clamp(Math.round(col[2]), 0, 255);
  const fill = al < 0.999 ? `rgba(${r},${g},${b},${al.toFixed(2)})` : `rgb(${r},${g},${b})`;
  out.push(`<path d="M${n1(x)} ${n1(y)}Q${n1(qx1)} ${n1(qy1)} ${n1(x2)} ${n1(y2)}Q${n1(qx2)} ${n1(qy2)} ${n1(x)} ${n1(y)}Z" fill="${fill}"/>`);
  count++;
}
function sample(surf) {
  const [x0, y0, x1, y1] = surf.box, step = surf.step;
  for (let gy = y0; gy < y1; gy += step) {
    for (let gx = x0; gx < x1; gx += step) {
      const x = gx + rng() * step * 0.85 - step * 0.1;
      const y = gy + rng() * step * 0.85 - step * 0.1;
      if (x < x0 - 6 || x > x1 + 6 || y < y0 - 6 || y > y1 + 6) continue;
      const m = surf.mask(x, y); if (!m) continue;
      const col = surf.color(x, y, m); if (!col) continue;
      let al = 1; if (typeof surf.alpha === 'function') al = surf.alpha(x, y, m); else if (surf.alpha) al = surf.alpha;
      if (al <= 0.02) continue;
      const ang = surf.flow(x, y, m) + (rng() - 0.5) * 0.42;
      const L = surf.len[0] + rng() * (surf.len[1] - surf.len[0]);
      const hw = (surf.wid[0] + rng() * (surf.wid[1] - surf.wid[0])) / 2;
      emit(x, y, ang, L, hw, col, al);
    }
  }
}

// ---------- 肤色与面部塑形（sfumato：多层柔和明暗，无硬边） ----------
function faceShade(x, y) {
  const fx = (x - 540) / 192, fy = (y - 600) / 280, rr = fx * fx + fy * fy;
  let v = 0.72;
  v += 0.15 * (1 - sstep(0.42, 1.12, rr));            // 中心体积亮部
  v -= 0.16 * sstep(0.78, 1.18, rr);                  // 边缘柔和暗化（晕涂）
  v += 0.07 * sstep(0.6, -0.6, fx);                   // 光自观者左来
  v += 0.11 * expG(x, y, 540, 405, 95, 72);           // 额头
  v -= 0.09 * Math.exp(-(((y - 448) / 15) ** 2)) * (0.35 + 0.65 * Math.exp(-(((x - 540) / 120) ** 2))); // 眉弓阴影带
  v -= 0.10 * expG(x, y, 465, 480, 52, 24);           // 左眼窝
  v -= 0.10 * expG(x, y, 615, 480, 52, 24);           // 右眼窝
  v += 0.11 * expG(x, y, 552, 552, 16, 75);           // 鼻梁亮线
  v -= 0.08 * expG(x, y, 527, 592, 13, 52);           // 鼻侧(左)
  v -= 0.09 * expG(x, y, 581, 590, 14, 52);           // 鼻侧(右)
  v += 0.10 * expG(x, y, 555, 636, 16, 14);           // 鼻尖
  v -= 0.09 * expG(x, y, 555, 662, 26, 12);           // 鼻下
  v -= 0.06 * expG(x, y, 551, 716, 48, 26);           // 口周
  v -= 0.08 * expG(x, y, 551, 750, 34, 13);           // 唇下阴影
  v += 0.09 * expG(x, y, 548, 848, 32, 26);           // 下巴
  v -= 0.10 * expG(x, y, 688, 762, 55, 62);           // 观者右侧颌线阴影
  v -= 0.06 * expG(x, y, 398, 470, 48, 62);           // 观者左太阳穴
  v += (fbm(x * 0.02, y * 0.02, 3) - 0.5) * 0.03;     // 大尺度肌理噪声
  return v;
}
function skinCol(v, warm) {
  let c = mixc(P.skinSh, P.skinHi, clamp(sstep(0.40, 0.93, v), 0, 1));
  if (warm) c = [c[0] + warm * 24, c[1] + warm * 8, c[2] - warm * 8];
  return c;
}
// 角度向量混合（避免 wrap 问题）
function angMix(a1, a2, t) {
  const x = Math.cos(a1) * (1 - t) + Math.cos(a2) * t;
  const y = Math.sin(a1) * (1 - t) + Math.sin(a2) * t;
  return Math.atan2(y, x);
}

// ---------- 背景几何 ----------
const yTL = x => 800 + 70 * Math.sin(x * 0.006 + 0.7) + (fbm(x * 0.012, 3.7, 2) - 0.5) * 70;   // 左远山上缘(暖)
const yTR = x => 790 + 72 * Math.sin(x * 0.005 + 2.0) + (fbm(x * 0.011, 8.2, 2) - 0.5) * 72;  // 右远山上缘(冷)
const rockEdge = y => 238 + 85 * vnoise(11.3, y * 0.004);                                       // 左岩坡右缘
const pathL = pline([[40, 1472], [150, 1300], [255, 1165], [335, 1082], [382, 1050]]);           // 左侧蜿蜒小径
const riverR = pline([[935, 1062], [992, 1180], [1062, 1300], [1132, 1440]]);                    // 右侧河流
const archL = (x, y) => Math.hypot(x - 338, y - 1082) < 26;  // 左小拱桥桥洞
const archR = (x, y) => Math.hypot(x - 957, y - 1100) < 22;  // 右拱桥桥洞
const yTopHead = x => 470 - 320 * Math.sqrt(Math.max(0, 1 - ((x - 540) / 215) ** 2));            // 头顶弧
const yGownTop = x => { const d = Math.abs(x - 545); return d < 115 ? 1015 : d < 250 ? 1015 + 60 * sstep(115, 250, d) : 1075 + 45 * sstep(250, 330, d); };
const hwGown = y => 252 + 188 * sstep(1075, 1505, y);
const yArmTop = x => 1502 - 14 * Math.exp(-((x - 540) ** 2) / (2 * 300 * 300)) + 6 * Math.sin(x * 0.004 + 0.8);
const hairBack = (x, y) => Math.hypot((x - 540) / 222, (y - 470) / 318) * (1 + 0.03 * vnoise(x * 0.01 + 40, y * 0.01)) < 1 || Math.hypot((x - 540) / 185, (y - 905) / 195) < 1;
const faceE = (x, y) => Math.hypot((x - 540) / 192, (y - 600) / 280);
const yHairline = x => 322 + 44 * sstep(0, 1, (Math.abs(x - 540) / 196) ** 0.85);

// ---------- 手部几何 ----------
const handApalm = (x, y) => Math.hypot((x - 545) / 58, (y - 1395) / 47) < 1;
const handA = {
  f1: capsule(500, 1368, 404, 1348, 15),
  f2: capsule(504, 1394, 396, 1380, 16),
  f3: capsule(510, 1420, 410, 1410, 15),
  f4: capsule(518, 1444, 455, 1440, 12),
};
const handBpalm = (x, y) => Math.hypot((x - 612) / 50, (y - 1418) / 40) < 1;
const handB = {
  g1: capsule(648, 1432, 708, 1450, 13),
  g2: capsule(640, 1454, 694, 1470, 12),
};
const sleeveL = capsule(335, 1235, 468, 1378, 52);
const sleeveR = capsule(755, 1332, 895, 1248, 55);
const cuffR = capsule(770, 1330, 905, 1250, 60);

// ---------- 五官曲线 ----------
const browL = qcurve([424, 458], [462, 441], [506, 444]);
const browR = qcurve([574, 442], [614, 436], [659, 446]);
const mouthLine = qcurve([499, 706], [551, 722], [603, 704]);   // 神秘微笑：嘴角略高

// ---------- 表面定义（按绘制顺序） ----------
const SURF = [
  // ===== 背景 =====
  { // 天空/雾霭（含谷地）
    box: [0, 0, W, 1120], step: 14,
    mask: (x, y) => (y < 1120) ? 1 : null,
    color: (x, y) => {
      let c = mixc([162, 156, 126], [174, 164, 130], sstep(0, 1, y / 1090));
      c = mixc(c, [184, 156, 110], sstep(760, 0, x) * 0.16);            // 观者左偏暖
      c = mixc(c, [150, 162, 136], sstep(440, 1200, x) * 0.10);         // 观者右偏冷
      const n = (fbm(x * 0.008, y * 0.008, 3) - 0.5) * 14;
      return [c[0] + n, c[1] + n * 0.9, c[2] + n * 0.7];
    },
    flow: (x, y) => 0.02 * Math.sin(x * 0.01), len: [13, 22], wid: [2.4, 4.4],
  },
  { // 左远山（暖褐，雾状）
    box: [0, 700, 475, 1060], step: 8,
    mask: (x, y) => (x < 475 && y > yTL(x) && y < 1058) ? 1 : null,
    color: (x, y) => {
      let c = mixc([92, 74, 48], [66, 54, 38], 0.5 + 0.5 * Math.sin(x * 0.02 + fbm(x * 0.01, y * 0.01, 2) * 3));
      return mixc(c, P.haze, 0.15 * sstep(1058, yTL(x), y));
    },
    flow: (x, y) => 0.25 + 0.3 * fbm(x * 0.02, y * 0.02, 2), len: [8, 14], wid: [3, 4.6],
  },
  { // 右远山（冷蓝绿，更雾）
    box: [655, 700, W, 1062], step: 8,
    mask: (x, y) => (x > 655 && y > yTR(x) && y < 1060) ? 1 : null,
    color: (x, y) => {
      let c = mixc([86, 108, 90], [64, 86, 72], 0.5 + 0.5 * Math.sin(x * 0.018 + fbm(x * 0.01, y * 0.01, 2) * 3));
      return mixc(c, P.haze, 0.2 * sstep(1060, yTR(x), y));
    },
    flow: (x, y) => 0.2 + 0.3 * fbm(x * 0.02, y * 0.02, 2), len: [8, 14], wid: [3, 4.6],
  },
  { // 左前景岩坡
    box: [0, 1108, 340, 1505], step: 8,
    mask: (x, y) => (x < rockEdge(y) && y > 1112 && y < 1505) ? 1 : null,
    color: (x, y) => {
      let c = mixc([82, 66, 44], [54, 42, 28], fbm(x * 0.02, y * 0.02, 3));
      c = c.map(v => v * (1 - 0.24 * sstep(0.45, 0.8, Math.sin(x * 0.03 + y * 0.02) * 0.5 + 0.5)));
      return mixc(c, [150, 132, 98], 0.10 * expG(x, y, rockEdge(y), y, 40, 60));
    },
    flow: (x, y) => 1.35 + 0.35 * fbm(x * 0.02, y * 0.02, 2), len: [8, 14], wid: [3, 4.6],
  },
  { // 左蜿蜒小径
    box: [0, 1025, 400, 1495], step: 6,
    mask: (x, y) => {
      const a = pathL.at(x, y); if (!a || a.d > 1e8) return null;
      const hw = 75 - 66 * a.t; if (a.d > hw / 2) return null;
      return { t: a.t, e: a.d / (hw / 2), tx: a.tx, ty: a.ty };
    },
    color: (x, y, m) => {
      let c = mixc([186, 166, 124], [142, 122, 90], 0.25 + 0.5 * m.t);
      c = mixc(c, P.haze, 0.3 * m.t);
      c = c.map(v => v * (1 - 0.24 * sstep(0.55, 1, m.e)));
      const n = (fbm(x * 0.05, y * 0.05, 2) - 0.5) * 16;
      return [c[0] + n, c[1] + n * 0.9, c[2] + n * 0.75];
    },
    flow: (x, y, m) => Math.atan2(m.ty, m.tx), len: [7, 12], wid: [2.4, 3.8],
  },
  { // 左小拱桥
    box: [295, 1025, 380, 1085], step: 5.5,
    mask: (x, y) => (x > 300 && x < 376 && y > 1030 && y < 1082 && !archL(x, y)) ? 1 : null,
    color: (x, y) => {
      let c = mixc([126, 114, 88], [172, 160, 128], 0.3 + 0.55 * sstep(1082, 1030, y));
      const n = (fbm(x * 0.08, y * 0.08, 2) - 0.5) * 12;
      return [c[0] + n, c[1] + n * 0.9, c[2] + n * 0.8];
    },
    flow: (x, y) => 0.12 * Math.sin(x * 0.1), len: [6, 10], wid: [1.5, 2.6],
  },
  { // 右河流
    box: [915, 1050, 1185, 1458], step: 6.5,
    mask: (x, y) => {
      const a = riverR.at(x, y);
      const hw = 26 + 80 * a.t; if (a.d > hw / 2) return null;
      return { t: a.t, tx: a.tx, ty: a.ty };
    },
    color: (x, y, m) => {
      const rp = vnoise(x * 0.05, y * 0.014, 2);
      const st = 0.5 + 0.5 * Math.sin(rp * 10 + m.t * 30);
      let c = mixc([64, 94, 88], [148, 178, 164], 0.25 + 0.6 * st);
      return mixc(c, P.haze, 0.4 - 0.35 * m.t);
    },
    flow: (x, y, m) => Math.atan2(m.ty, m.tx), len: [8, 13], wid: [2.2, 3.6],
  },
  { // 右拱桥
    box: [918, 1048, 995, 1105], step: 5.5,
    mask: (x, y) => (x > 926 && x < 988 && y > 1056 && y < 1100 && !archR(x, y)) ? 1 : null,
    color: (x, y) => {
      let c = mixc([126, 114, 88], [172, 160, 128], 0.3 + 0.55 * sstep(1100, 1056, y));
      const n = (fbm(x * 0.08, y * 0.08, 2) - 0.5) * 12;
      return [c[0] + n, c[1] + n * 0.9, c[2] + n * 0.8];
    },
    flow: (x, y) => 0.12 * Math.sin(x * 0.1), len: [6, 10], wid: [1.5, 2.6],
  },
  { // 地平线雾带（空气透视统合）
    box: [0, 980, W, 1090], step: 11,
    mask: (x, y) => (y > 985 && y < 1085) ? 1 : null,
    color: (x, y) => { const n = (fbm(x * 0.01, y * 0.01, 2) - 0.5) * 10; return [P.haze[0] + n, P.haze[1] + n * 0.9, P.haze[2] + n * 0.7]; },
    flow: (x, y) => 0.03 * Math.sin(x * 0.02), len: [14, 22], wid: [2, 4],
    alpha: (x, y) => 0.34 * sstep(1085, 1015, y) * (1 - sstep(985, 1030, y)),
  },
  // ===== 人物 =====
  { // 头发（后层：整片发块）
    box: [308, 140, 778, 1110], step: 7.5,
    mask: (x, y) => (hairBack(x, y) && y < 1105) ? 1 : null,
    color: (x, y) => {
      const ph = (x - 540) * 0.11 + y * 0.006 + fbm(x * 0.05, y * 0.05, 2) * 2.2;
      const st = 0.5 + 0.5 * Math.sin(ph);
      let c = mixc(P.hairD, P.hair, 0.3 + 0.7 * st);
      const hl = expG(x, y, 430, 300, 110, 160) + expG(x, y, 655, 300, 100, 150) + expG(x, y, 470, 850, 90, 130) + expG(x, y, 615, 850, 90, 130);
      c = mixc(c, P.hairHi, 0.5 * clamp(hl, 0, 1) * (0.4 + 0.6 * vnoise(x * 0.03, y * 0.03)));
      if (vnoise(x * 0.02 + 7, y * 0.02) > 0.62) c = mixc(c, P.hairHi, 0.35);   // 亮发丝
      if (y < 345 && Math.abs(x - 540) < 9) c = mixc(c, [146, 110, 68], 0.85);  // 中分缝
      if (y < 345 && Math.abs(x - 540) < 2.5) c = [30, 22, 14];                  // 分缝沟
      return c;
    },
    flow: (x, y) => Math.PI / 2 + (x - 540) * 0.0016 + 0.12 * Math.sin(y * 0.01), len: [15, 26], wid: [2.6, 4.6],
  },
  { // 颈
    box: [455, 842, 640, 1045], step: 6,
    mask: (x, y) => { const hw = 72 + 14 * sstep(900, 1040, y); return (Math.abs(x - 545) < hw && y > 848 && y < 1040) ? { hw } : null; },
    color: (x, y, m) => {
      const v = 0.66 - 0.16 * sstep(905, 848, y);          // 颌下阴影
      let c = mixc(P.skinSh, P.skin, sstep(0.35, 0.75, v));
      c = c.map(vv => vv * (1 - 0.10 * (Math.abs(x - 545) / m.hw)));
      return c;
    },
    flow: (x, y) => Math.PI / 2 + 0.1 * Math.sin(y * 0.05), len: [8, 13], wid: [2.6, 4],
  },
  { // 面部（暖赭多层晕涂）
    box: [340, 312, 740, 890], step: 4.8,
    mask: (x, y) => (faceE(x, y) < 0.999 && y > yHairline(x)) ? 1 : null,
    color: (x, y) => {
      const v = faceShade(x, y);
      const warm = 0.5 * expG(x, y, 455, 640, 52, 38) + 0.45 * expG(x, y, 632, 632, 50, 36);
      return skinCol(v, warm);
    },
    flow: (x, y) => {
      const tang = Math.atan2(y - 600, x - 540) + Math.PI / 2;
      const fy = (y - 600) / 280;
      let a = angMix(tang, Math.PI / 2, sstep(0.15, 0.8, fy));          // 下半脸沿体积走向
      a = angMix(a, 0, 0.35 * sstep(0.55, 0.1, fy));                     // 额头偏水平
      return a + 0.1 * Math.sin(x * 0.02);
    }, len: [4, 7], wid: [3, 4.8],
  },
  { // 左眼白
    box: [432, 462, 500, 500], step: 3.2,
    mask: (x, y) => (((x - 465) / 27) ** 2 + ((y - 480) / 9.5) ** 2 < 1) ? 1 : null,
    color: (x, y) => { const c = P.sclera.map(v => v * (1 - 0.10 * clamp((x - 438) / 27, 0, 1))); const n = (rng() - 0.5) * 10; return [c[0] + n, c[1] + n * 0.9, c[2] + n * 0.7]; },
    flow: (x, y) => 0.1, len: [5, 8], wid: [1.8, 2.8],
  },
  { // 右眼白
    box: [580, 460, 652, 500], step: 3.2,
    mask: (x, y) => (((x - 615) / 30) ** 2 + ((y - 480) / 10) ** 2 < 1) ? 1 : null,
    color: (x, y) => { const c = P.sclera.map(v => v * (1 - 0.10 * clamp((648 - x) / 30, 0, 1))); const n = (rng() - 0.5) * 10; return [c[0] + n, c[1] + n * 0.9, c[2] + n * 0.7]; },
    flow: (x, y) => 0.1, len: [5, 8], wid: [1.8, 2.8],
  },
  { // 左虹膜
    box: [453, 469, 478, 494], step: 2.8,
    mask: (x, y) => (Math.hypot((x - 465) / 9, (y - 481) / 9) < 1) ? { r: Math.hypot((x - 465) / 9, (y - 481) / 9) } : null,
    color: (x, y, m) => mixc(P.iris, P.eyeD, 0.55 * m.r),
    flow: (x, y) => 0.2, len: [4, 6], wid: [1.4, 2.2],
  },
  { // 右虹膜
    box: [604, 469, 627, 494], step: 2.8,
    mask: (x, y) => (Math.hypot((x - 615) / 9.5, (y - 481) / 9.5) < 1) ? { r: Math.hypot((x - 615) / 9.5, (y - 481) / 9.5) } : null,
    color: (x, y, m) => mixc(P.iris, P.eyeD, 0.55 * m.r),
    flow: (x, y) => 0.2, len: [4, 6], wid: [1.4, 2.2],
  },
  { // 左虹膜高光
    box: [458, 471, 468, 481], step: 2.4,
    mask: (x, y) => (Math.hypot(x - 462, y - 476) < 2.8) ? 1 : null,
    color: () => [204, 184, 150], flow: () => 0, len: [3, 4], wid: [1, 1.6],
  },
  { // 右虹膜高光
    box: [606, 471, 616, 481], step: 2.4,
    mask: (x, y) => (Math.hypot(x - 611, y - 476) < 2.8) ? 1 : null,
    color: () => [204, 184, 150], flow: () => 0, len: [3, 4], wid: [1, 1.6],
  },
  { // 左上睑线(沿上睑缘的深色细线)
    box: [436, 462, 496, 474], step: 2.6,
    mask: (x, y) => (Math.abs(y - (480 - 9.5 * Math.sqrt(Math.max(0, 1 - ((x - 465) / 27.5) ** 2)))) < 2 && Math.abs(x - 465) < 26) ? 1 : null,
    color: (x, y) => P.eyeD.map(v => v * (0.8 + 0.4 * rng())), flow: (x, y) => 0.1, len: [4, 7], wid: [1.4, 2.2],
  },
  { // 右上睑线
    box: [584, 462, 648, 474], step: 2.6,
    mask: (x, y) => (Math.abs(y - (480 - 10 * Math.sqrt(Math.max(0, 1 - ((x - 615) / 30.5) ** 2)))) < 2 && Math.abs(x - 615) < 29) ? 1 : null,
    color: (x, y) => P.eyeD.map(v => v * (0.8 + 0.4 * rng())), flow: (x, y) => 0.1, len: [4, 7], wid: [1.4, 2.2],
  },
  { // 左上眼睑(深色睑线+睑上阴影)
    box: [434, 458, 498, 480], step: 3,
    mask: (x, y) => (((x - 465) / 27.5) ** 2 + ((y - 480) / 10.5) ** 2 < 1 && y < 479) ? 1 : null,
    color: (x, y) => P.eyeD.map(v => v * (0.85 + 0.3 * rng())),
    flow: (x, y) => 0.12, len: [4, 7], wid: [1.4, 2.4], alpha: 0.85,
  },
  { // 右上眼睑
    box: [582, 458, 650, 480], step: 3,
    mask: (x, y) => (((x - 615) / 30.5) ** 2 + ((y - 480) / 11) ** 2 < 1 && y < 479) ? 1 : null,
    color: (x, y) => P.eyeD.map(v => v * (0.85 + 0.3 * rng())),
    flow: (x, y) => 0.12, len: [4, 7], wid: [1.4, 2.4], alpha: 0.85,
  },
  { // 左眼睑褶
    box: [436, 458, 496, 472], step: 3.4,
    mask: (x, y) => (Math.abs(y - (470 - 6 * (1 - ((x - 465) / 27) ** 2))) < 2.2 && Math.abs(x - 465) < 25) ? 1 : null,
    color: () => P.eyeD, flow: () => 0.05, len: [5, 8], wid: [1, 1.8], alpha: 0.85,
  },
  { // 右眼睑褶
    box: [585, 456, 648, 472], step: 3.4,
    mask: (x, y) => (Math.abs(y - (470 - 6 * (1 - ((x - 615) / 30) ** 2))) < 2.2 && Math.abs(x - 615) < 28) ? 1 : null,
    color: () => P.eyeD, flow: () => 0.05, len: [5, 8], wid: [1, 1.8], alpha: 0.85,
  },
  { // 左眉
    box: [418, 434, 512, 466], step: 3.6,
    mask: (x, y) => (browL.dist(x, y) < 5.2) ? 1 : null,
    color: (x, y) => { const c = P.browC.map(v => v * (0.8 + 0.35 * rng())); return c; },
    flow: (x, y) => -0.18, len: [5, 9], wid: [1.8, 3],
  },
  { // 右眉
    box: [568, 430, 665, 458], step: 3.6,
    mask: (x, y) => (browR.dist(x, y) < 5.2) ? 1 : null,
    color: (x, y) => { const c = P.browC.map(v => v * (0.8 + 0.35 * rng())); return c; },
    flow: (x, y) => 0.16, len: [5, 9], wid: [1.8, 3],
  },
  { // 鼻梁亮部
    box: [540, 470, 568, 632], step: 3.8,
    mask: (x, y) => (Math.abs(x - (553 + (y - 500) * 0.02)) < 7 && y > 472 && y < 630) ? 1 : null,
    color: (x, y) => skinCol(0.92 + (fbm(x * 0.03, y * 0.03, 2) - 0.5) * 0.06, 0.1),
    flow: (x, y) => Math.PI / 2, len: [6, 10], wid: [1.6, 2.6],
  },
  { // 鼻侧阴影(左)
    box: [512, 535, 543, 648], step: 4,
    mask: (x, y) => (Math.hypot((x - 528) / 15, (y - 590) / 55) < 1) ? 1 : null,
    color: () => skinCol(0.52, 0), flow: (x, y) => Math.PI / 2, len: [6, 10], wid: [1.6, 2.6], alpha: 0.85,
  },
  { // 鼻侧阴影(右)
    box: [566, 533, 598, 648], step: 4,
    mask: (x, y) => (Math.hypot((x - 581) / 16, (y - 588) / 55) < 1) ? 1 : null,
    color: () => skinCol(0.50, 0), flow: (x, y) => Math.PI / 2, len: [6, 10], wid: [1.6, 2.6], alpha: 0.85,
  },
  { // 鼻尖
    box: [542, 622, 570, 650], step: 3.4,
    mask: (x, y) => (Math.hypot((x - 555) / 11, (y - 636) / 10) < 1) ? 1 : null,
    color: () => skinCol(0.84, 0.12), flow: (x, y) => 0.4, len: [4, 7], wid: [1.4, 2.2],
  },
  { // 左鼻孔
    box: [526, 641, 541, 657], step: 2.8,
    mask: (x, y) => (Math.hypot(x - 533, y - 649) < 5.5) ? 1 : null,
    color: (x, y) => [96, 56, 36].map(v => v * (0.85 + 0.3 * rng())), flow: () => 0.5, len: [3, 5], wid: [1.2, 2],
  },
  { // 右鼻孔
    box: [569, 639, 585, 655], step: 2.8,
    mask: (x, y) => (Math.hypot(x - 577, y - 647) < 5) ? 1 : null,
    color: (x, y) => [96, 56, 36].map(v => v * (0.85 + 0.3 * rng())), flow: () => 0.5, len: [3, 5], wid: [1.2, 2],
  },
  { // 鼻下阴影
    box: [530, 652, 582, 674], step: 3.8,
    mask: (x, y) => (Math.abs(y - 663) < 8 && Math.abs(x - 555) < 24) ? 1 : null,
    color: () => skinCol(0.55, 0), flow: () => 0, len: [5, 8], wid: [1.4, 2.2], alpha: 0.75,
  },
  { // 嘴线（神秘微笑）
    box: [492, 698, 612, 730], step: 2.8,
    mask: (x, y) => (mouthLine.dist(x, y) < 3.4) ? 1 : null,
    color: (x, y) => P.lipLine.map(v => v * (0.85 + 0.3 * rng())), flow: (x, y) => 0.06, len: [4, 7], wid: [1.4, 2.2],
  },
  { // 上唇
    box: [496, 694, 608, 716], step: 3.2,
    mask: (x, y) => (x > 500 && x < 602 && mouthLine.dist(x, y) < 7 && y < mouthLine.Y(x)) ? 1 : null,
    color: (x, y) => P.lipU.map(v => v * (0.88 + 0.24 * rng())),
    flow: (x, y) => 0.05, len: [4, 7], wid: [1.3, 2.2],
  },
  { // 下唇
    box: [496, 704, 608, 742], step: 3.2,
    mask: (x, y) => (x > 500 && x < 602 && mouthLine.dist(x, y) < 8 && y > mouthLine.Y(x)) ? 1 : null,
    color: (x, y) => {
      let c = P.lipL.map(v => v * (0.88 + 0.24 * rng()));
      if (Math.abs(x - 551) < 26) c = c.map(v => v * 1.1);
      return c;
    },
    flow: (x, y) => 0.05, len: [4, 7], wid: [1.3, 2.4],
  },
  { // 唇下阴影
    box: [514, 740, 590, 762], step: 3.8,
    mask: (x, y) => (Math.abs(y - 750) < 9 && Math.abs(x - 551) < 34) ? 1 : null,
    color: () => skinCol(0.56, 0), flow: () => 0, len: [5, 8], wid: [1.4, 2.2], alpha: 0.75,
  },
  { // 嘴角暗点(神秘微笑的两端)
    box: [494, 698, 610, 716], step: 3,
    mask: (x, y) => (Math.hypot(x - 500, y - 707) < 4.5 || Math.hypot(x - 602, y - 705) < 4.5) ? 1 : null,
    color: (x, y) => [76, 42, 32].map(v => v * (0.85 + 0.3 * rng())), flow: () => 0.2, len: [3, 5], wid: [1.2, 1.8],
  },
  { // 头发(前层：覆盖两鬓，形成发际)
    box: [308, 140, 778, 720], step: 7.5,
    mask: (x, y) => (hairBack(x, y) && y < 700 && faceE(x, y) >= 0.999) ? 1 : null,
    color: (x, y) => {
      const ph = (x - 540) * 0.11 + y * 0.006 + fbm(x * 0.05, y * 0.05, 2) * 2.2;
      const st = 0.5 + 0.5 * Math.sin(ph);
      let c = mixc(P.hairD, P.hair, 0.3 + 0.7 * st);
      return mixc(c, P.hairHi, 0.35 * vnoise(x * 0.03, y * 0.03));
    },
    flow: (x, y) => Math.PI / 2 + (x - 540) * 0.0016 + 0.12 * Math.sin(y * 0.01), len: [15, 26], wid: [2.6, 4.6],
  },
  { // 头顶薄纱
    box: [340, 148, 745, 400], step: 3.6,
    mask: (x, y) => {
      const yt = yTopHead(x);
      return (x > 348 && x < 732 && y > yt + 6 && y < yt + 46) ? { d: (y - yt) } : null;
    },
    color: (x, y, m) => { const n = (fbm(x * 0.02, y * 0.02, 2) - 0.5) * 10; return [P.veil[0] + n, P.veil[1] + n * 0.9, P.veil[2] + n * 0.7]; },
    flow: (x, y) => 0.05 * Math.sin(x * 0.05), len: [16, 26], wid: [2, 3.4],
    alpha: (x, y, m) => 0.7 * (1 - 0.4 * clamp(m.d / 40, 0, 1)),
  },
  { // 长袍(深棕橄榄，暗金高光)
    box: [95, 1005, 995, 1512], step: 8,
    mask: (x, y) => (y > yGownTop(x) && Math.abs(x - 545) < hwGown(y)) ? 1 : null,
    color: (x, y) => {
      const f = 0.5 + 0.5 * Math.sin(x * 0.03 + 1.5 * fbm(x * 0.012, y * 0.01, 2) + y * 0.004);
      let c = mixc([34, 26, 18], [58, 46, 30], 0.45 + 0.45 * f);
      c = mixc(c, P.gownHi, 0.42 * expG(x, y, 390, 1090, 100, 75));         // 观者左肩高光
      c = mixc(c, P.gownHi, 0.30 * expG(x, y, 760, 1290, 90, 90));          // 右前臂微亮
      c = mixc(c, [96, 62, 44], 0.25 * sstep(1130, 1015, y));               // 上部暖调
      c = mixc(c, [30, 24, 17], 0.45 * sstep(1300, 1500, y));               // 下部沉暗
      c = c.map(v => v * (1 - 0.10 * sstep(0, 1, (x - 545) / 430)));        // 观者右侧体积暗
      return c;
    },
    flow: (x, y) => 1.9 + 0.35 * Math.sin(x * 0.012) + 0.25 * (fbm(x * 0.01, y * 0.01, 2) - 0.5), len: [9, 15], wid: [2.2, 3.8],
  },
  { // 肩线柔光(沿肩部轮廓的暗金高光带)
    box: [280, 1000, 810, 1130], step: 6,
    mask: (x, y) => { const yt = yGownTop(x); return (y > yt && y < yt + 20) ? 1 : null; },
    color: (x, y) => { const c = [112, 92, 60]; const n = (fbm(x * 0.02, y * 0.02, 2) - 0.5) * 10; return [c[0] + n, c[1] + n * 0.9, c[2] + n * 0.7]; },
    flow: (x, y) => 0.06 * Math.sin(x * 0.02), len: [8, 13], wid: [1.8, 3],
    alpha: (x, y) => 0.5 * (1 - sstep(0, 1, (y - yGownTop(x)) / 20)),
  },
  { // 左袖(弯曲前臂)
    box: [270, 1175, 530, 1440], step: 7,
    mask: (x, y) => { const m = sleeveL.at(x, y); return m ? m : null; },
    color: (x, y, m) => {
      let c = mixc(P.gown, P.gownHi, 0.35 + 0.2 * Math.sin(m.t * 9));
      return mixc(c, [96, 62, 44], 0.3);
    },
    flow: (x, y, m) => Math.atan2(m.ty, m.tx), len: [9, 14], wid: [2.2, 3.6],
  },
  { // 右袖
    box: [695, 1185, 955, 1395], step: 7,
    mask: (x, y) => { const m = sleeveR.at(x, y); return m ? m : null; },
    color: (x, y, m) => {
      let c = mixc(P.gown, P.gownHi, 0.35 + 0.2 * Math.sin(m.t * 9));
      return mixc(c, [96, 62, 44], 0.3);
    },
    flow: (x, y, m) => Math.atan2(m.ty, m.tx), len: [9, 14], wid: [2.2, 3.6],
  },
  { // 椅子扶手(底部横带)
    box: [0, 1472, W, H], step: 8,
    mask: (x, y) => (y > yArmTop(x)) ? 1 : null,
    color: (x, y) => {
      let c = P.armR.map(v => v + (fbm(x * 0.02, y * 0.02, 2) - 0.5) * 14);
      const t = Math.exp(-(((y - yArmTop(x)) / 7) ** 2));
      c = mixc(c, [84, 90, 62], 0.55 * t);
      c = mixc(c, P.armRd, 0.5 * sstep(1530, 1575, y));
      return c;
    },
    flow: (x, y) => 0.04 * Math.sin(x * 0.01), len: [10, 16], wid: [2.4, 4],
  },
  { // 手下投影
    box: [390, 1440, 730, 1512], step: 7,
    mask: (x, y) => (expG(x, y, 560, 1498, 170, 20) > 0.25 && y > 1440) ? 1 : null,
    color: () => [46, 38, 28], flow: (x, y) => 0, len: [12, 18], wid: [3, 5],
    alpha: (x, y) => 0.42 * clamp(expG(x, y, 560, 1498, 170, 20), 0, 1),
  },
  { // 下层的左手(观者右，指尖露出)
    box: [560, 1370, 730, 1485], step: 4.6,
    mask: (x, y) => {
      if (handBpalm(x, y)) return { t: 0.2, e: 0.5, tx: 1, ty: 0.2 };
      const g1 = handB.g1.at(x, y); if (g1) return g1;
      const g2 = handB.g2.at(x, y); if (g2) return g2;
      return null;
    },
    color: (x, y, m) => {
      let v = 0.54 + (fbm(x * 0.03, y * 0.03, 2) - 0.5) * 0.08;
      if (m.t > 0.35 && m.t < 0.75) v -= 0.10;               // 指节
      let c = skinCol(v, 0.08);
      c = c.map(vv => vv * (1 - 0.18 * m.e));                // 侧面暗
      return c;
    },
    flow: (x, y, m) => Math.atan2(m.ty, m.tx), len: [6, 10], wid: [2, 3.4],
  },
  { // 上层的右手(观者左，四指微曲)
    box: [388, 1322, 660, 1470], step: 4.4,
    mask: (x, y) => {
      if (handApalm(x, y)) return { t: 0.15, e: 0.5, tx: -1, ty: 0.1 };
      for (const k of ['f1', 'f2', 'f3', 'f4']) { const f = handA[k].at(x, y); if (f) return f; }
      return null;
    },
    color: (x, y, m) => {
      let v = 0.56 + (fbm(x * 0.03, y * 0.03, 2) - 0.5) * 0.08;
      if (m.t > 0.4 && m.t < 0.8) v -= 0.10;                 // 指节
      if (m.t > 0.85) v += 0.05;                             // 指尖亮
      let c = skinCol(v, 0.08);
      c = c.map(vv => vv * (1 - 0.20 * m.e));
      return c;
    },
    flow: (x, y, m) => Math.atan2(m.ty, m.tx), len: [6, 11], wid: [2, 3.6],
  },
  { // 指缝阴影(上层手四指之间的暗缝)
    box: [398, 1338, 522, 1452], step: 3,
    mask: (x, y) => {
      const gaps = [
        capsule(502, 1381, 405, 1364, 7),
        capsule(507, 1407, 408, 1395, 7),
        capsule(514, 1431, 430, 1425, 7),
      ];
      for (const g of gaps) if (g.at(x, y)) return 1;
      return null;
    },
    color: (x, y) => [96, 62, 40].map(v => v * (0.85 + 0.3 * rng())), flow: (x, y) => -0.15, len: [5, 9], wid: [2.4, 3.6], alpha: 0.8,
  },
  { // 手下缘阴影(手与扶手之间的暗带)
    box: [390, 1440, 700, 1500], step: 4,
    mask: (x, y) => (expG(x, y, 545, 1468, 150, 16) > 0.35) ? 1 : null,
    color: (x, y) => [88, 60, 40].map(v => v * (0.85 + 0.3 * rng())), flow: (x, y) => 0, len: [6, 10], wid: [2, 3.4],
    alpha: (x, y) => 0.5 * clamp(expG(x, y, 545, 1468, 150, 16) * 1.4, 0, 1),
  },
  { // 右手袖口(最后覆盖手腕)
    box: [705, 1185, 970, 1395], step: 6,
    mask: (x, y) => { const m = cuffR.at(x, y); return m ? m : null; },
    color: (x, y, m) => {
      let c = mixc(P.gown, P.gownHi, 0.30);
      if (m.t < 0.18) c = mixc(c, [116, 96, 64], 0.5);       // 袖口亮边
      return c;
    },
    flow: (x, y, m) => Math.atan2(m.ty, m.tx), len: [8, 13], wid: [2.2, 3.6],
  },
];

// ---------- 铺底洗子(wash)：粗长软笔触的底层罩染 ----------
function washPass() {
  const step = 16;
  for (let gy = 0; gy < H; gy += step) {
    for (let gx = 0; gx < W; gx += step) {
      const x = gx + rng() * step * 0.9 - step * 0.2;
      const y = gy + rng() * step * 0.9 - step * 0.2;
      let col = null;
      for (const s of SURF) { const m = s.mask(x, y); if (m) { col = s.color(x, y, m); break; } }
      if (!col) col = P.haze;
      col = mixc(col, P.haze, 0.2);
      const ang = 0.05 * Math.sin(x * 0.01) + (rng() - 0.5) * 0.3;
      const L = 14 + rng() * 10, hw = 2.5 + rng() * 2;
      emit(x, y, ang, L, hw, col, 0.3);
    }
  }
}

// ---------- 输出 ----------
washPass();
for (const s of SURF) sample(s);

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<title>Mona Lisa — a pure-SVG vector brushstroke study after Leonardo da Vinci (c. 1503–1519, Louvre, public domain)</title>` +
  `<rect x="0" y="0" width="${W}" height="${H}" fill="#70644c"/>` +
  `<g>` + out.join('\n') + `</g>` + `</svg>`;

fs.writeFileSync(__dirname + '/answer.svg', svg);
const bytes = Buffer.byteLength(svg);
console.log(`strokes=${count}  size=${(bytes / 1048576).toFixed(2)} MB  answer.svg written`);
