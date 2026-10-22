#!/usr/bin/env node
/**
 * Mona Lisa — 纯 SVG 研究性复刻 · 生成式笔触引擎
 * ------------------------------------------------
 * 固定种子伪随机数驱动：同一命令永远产出同一幅画（可复现）。
 * 全部形体由数千条短弧线笔触承载（流场定向 + 截面明暗模型 + 邻近色抖动），
 * 无 <image>、无 <gradient>、无大面积平涂替代形体 —— 仅一层中性 imprimatura 底色。
 */
import { writeFileSync } from 'fs';

/* ---------------- 基础工具 ---------------- */
const W = 1200, H = 1600;
let _s = 0x5EED1A5A >>> 0;
function rnd() { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const R = (a = 1, b) => b === undefined ? rnd() * a : a + rnd() * (b - a);
function gauss() { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const PI = Math.PI, TAU = Math.PI * 2;
function lerpAng(a, b, t) { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return a + d * t; }

const F = n => { const v = Math.round(n * 10) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); };
const C = (r, g, b) => 'rgb(' + clamp(r | 0, 0, 255) + ',' + clamp(g | 0, 0, 255) + ',' + clamp(b | 0, 0, 255) + ')';
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul = (c, m) => [c[0] * m, c[1] * m, c[2] * m];
const jit = (c, a) => [c[0] + gauss() * a, c[1] + gauss() * a, c[2] + gauss() * a];
function ramp(stops, t) {
  t = clamp(t, 0, 1);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) { const p0 = stops[i - 1][0], c0 = stops[i - 1][1], p1 = stops[i][0], c1 = stops[i][1]; return mix(c0, c1, (t - p0) / ((p1 - p0) || 1)); }
  }
  return stops[stops.length - 1][1];
}

/* ---------------- 图层与笔触发射器 ---------------- */
const layers = new Map();
const Lk = n => { if (!layers.has(n)) layers.set(n, []); return layers.get(n); };
let pathCount = 0;

/* 全局罩染堆积系数：低透明度短笔多层叠加后等效于更实的颜料层 */
const OPK = 2.7;
function opx(op) { return clamp(op * OPK, 0, 1); }
function Q(l, x0, y0, cx, cy, x1, y1, col, w, op) {
  Lk(l).push(`<path d="M${F(x0)} ${F(y0)}Q${F(cx)} ${F(cy)} ${F(x1)} ${F(y1)}" stroke="${col}" stroke-width="${w.toFixed(2)}" opacity="${opx(op).toFixed(3)}"/>`);
  pathCount++;
}
function dot(l, x, y, r, col, op) { Lk(l).push(`<circle cx="${F(x)}" cy="${F(y)}" r="${F(r)}" fill="${col}" opacity="${opx(op).toFixed(3)}"/>`); pathCount++; }
function seg(l, x0, y0, x1, y1, bow, col, w, op) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  Q(l, x0, y0, (x0 + x1) / 2 - dy / len * bow, (y0 + y1) / 2 + dx / len * bow, x1, y1, col, w, op);
}
function tang(l, x, y, ang, len, bow, col, w, op) {
  const hx = Math.cos(ang) * len / 2, hy = Math.sin(ang) * len / 2;
  seg(l, x - hx, y - hy, x + hx, y + hy, bow, col, w, op);
}

/* 折线采样器 */
function mkPoly(pts) {
  const segs = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy);
    segs.push({ x: pts[i - 1][0], y: pts[i - 1][1], dx, dy, l, a: Math.atan2(dy, dx) }); tot += l;
  }
  return {
    tot,
    at(d) {
      d = clamp(d, 0, this.tot);
      for (const s of segs) { if (d <= s.l) return { x: s.x + s.dx * d / s.l, y: s.y + s.dy * d / s.l, a: s.a }; d -= s.l; }
      const s = segs[segs.length - 1]; return { x: s.x + s.dx, y: s.y + s.dy, a: s.a };
    }
  };
}
/* 区域拒绝采样填充 */
function fillR(l, test, bb, n, fn) {
  let c = 0, tries = 0, cap = n * 50;
  while (c < n && tries < cap) {
    tries++;
    const x = R(bb[0], bb[2]), y = R(bb[1], bb[3]);
    if (!test(x, y)) continue;
    c++; fn(x, y);
  }
  return c;
}
/* 点到线段距离（带插值参数） */
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) || 1), 0, 1);
  return { d: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
}
function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/* ================= 调 色 板（贴近卢浮宫原作）================= */
const SKY_TOP = [96, 106, 92], SKY_MID = [126, 128, 98], SKY_LOW = [160, 152, 106], HAZE = [176, 168, 122];
const FAR_L = [90, 100, 90], FAR_R = [100, 110, 96];
const MID_OLIVE = [106, 104, 64], MID_DK = [82, 82, 52], MID_LT = [132, 126, 78];
const WATER = [110, 116, 88], WATER_D = [84, 92, 72], WATER_L = [156, 150, 104];
const ROAD = [146, 127, 86], ROAD_D = [112, 95, 62];
const ROCK = [99, 80, 54], ROCK_DK = [66, 52, 36], ROCK_LT = [136, 114, 78];
const STONE = [130, 124, 88];
const VALLEY = [120, 114, 74];
const WOOD = [94, 66, 38], WOOD_HI = [154, 116, 64], WOOD_DK = [54, 37, 24];
const SKIN_RAMP = [[0, [96, 62, 42]], [0.22, [136, 96, 64]], [0.45, [178, 138, 100]], [0.7, [206, 172, 132]], [0.9, [224, 194, 152]], [1, [236, 212, 172]]];
const HAIR_DARK = [40, 28, 19], HAIR_BLACK = [22, 15, 11], HAIR_WARM = [72, 51, 30], HAIR_HI = [114, 84, 48];
const BOD_BASE = [60, 51, 34], BOD_DK = [36, 31, 22], GOLD = [154, 116, 58];
const SKIRT_RAMP = [[0, [30, 26, 19]], [0.5, [48, 42, 29]], [0.8, [66, 58, 40]], [1, [88, 78, 54]]];
const SLEEVE_RAMP = [[0, [76, 54, 30]], [0.4, [120, 86, 46]], [0.75, [160, 122, 68]], [1, [186, 148, 88]]];
const VIG = [42, 38, 29];

/* ================= 几何定义 ================= */
/* 面部轮廓：上半椭圆(冠部) + 下半收窄至下巴(596) */
function faceHW(y) {
  if (y <= 418) { const t = (y - 418) / 150; return t <= -1 ? 0 : 116 * Math.sqrt(Math.max(0, 1 - t * t)); }
  const t = (y - 418) / 178;
  return 116 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - Math.max(0, y - 500) * 0.0006);
}
const faceCX = y => 618 - (y > 460 ? (y - 460) * 0.055 : 0);
function inFace(x, y) { const hw = faceHW(y); if (hw <= 2) return false; return Math.abs(x - faceCX(y)) <= hw; }
/* 发际线（中央略高、两侧圆弧下降） */
const hairlineY = x => 296 + 26 * Math.pow((x - 618) / 110, 2);
/* 领口曲线（方中带圆的 U 领） */
const neckLineY = x => 772 + 74 * Math.max(0, 1 - Math.pow((x - 620) / 137, 2));

/* 头发区域 */
const hairLobeL = (x, y) => { const dx = (x - 502) / 92, dy = (y - 565) / 185; return dx * dx + dy * dy <= 1; };
const hairLobeR = (x, y) => { const dx = (x - 738) / 96, dy = (y - 558) / 192; return dx * dx + dy * dy <= 1; };
function inCrown(x, y) {
  const dx = x - 618, dy = y - 408; const r = Math.hypot(dx, dy * 0.82);
  return r >= 92 && r <= 152 && y < hairlineY(x) + 4 && y < 430;
}
const inHairMass = (x, y) => hairLobeL(x, y) || hairLobeR(x, y) || inCrown(x, y);

/* 服装区域多边形 */
const SKIRT_POLY = [[438, 1128], [806, 1128], [872, 1330], [898, 1600], [318, 1600], [352, 1320]];
const BOD_POLY = [[468, 768], [792, 768], [826, 986], [798, 1150], [442, 1150], [418, 980]];
const CHEST_POLY = [[536, 636], [704, 636], [758, 752], [742, 800], [620, 850], [506, 796], [486, 748]];
const ROCK_POLY = [[0, 1010], [60, 930], [140, 878], [230, 858], [302, 930], [338, 1012], [300, 1092], [180, 1122], [60, 1112], [0, 1058]];
/* 人物剪影（用于背后投影晕圈） */
const FIG_OUT = [[618, 252], [744, 300], [766, 420], [792, 556], [900, 720], [982, 860], [1002, 1000], [932, 1150], [882, 1300], [902, 1600], [338, 1600], [368, 1300], [318, 1150], [298, 1000], [338, 760], [448, 600], [498, 440], [520, 300]];

/* 山脊折线（左右不对称：左高右低） */
const RIDGE_FL = [[0, 272], [88, 218], [168, 292], [238, 208], [318, 298], [396, 246], [468, 330], [540, 302]];
const RIDGE_FR = [[700, 386], [770, 356], [848, 420], [922, 372], [996, 336], [1072, 408], [1140, 368], [1200, 424]];
const HILL_L = [[0, 472], [118, 432], [256, 480], [396, 452], [516, 500]];
const HILL_R = [[700, 540], [820, 512], [938, 560], [1076, 522], [1200, 568]];
const RIVER_PTS = [[700, 640], [790, 655], [870, 648], [950, 668], [1030, 660], [1120, 682], [1200, 676]];
const ROAD_PTS = [[470, 845], [436, 782], [458, 733], [418, 692], [444, 652], [404, 616], [426, 586], [388, 556]];

/* ================= 面部光照模型 ================= */
/* 阴影盘 [x,y,r,强度] */
const SHade = [
  [556, 424, 44, 0.66], [676, 418, 46, 0.66],
  [614, 466, 11, 0.80], [642, 466, 11, 0.80],
  [626, 506, 14, 0.78],
  [573, 524, 13, 0.62], [669, 517, 13, 0.62],
  [620, 551, 22, 0.82], [619, 592, 42, 0.55],
  [514, 378, 26, 0.80], [724, 374, 24, 0.80],
  [618, 306, 76, 0.87], [540, 478, 30, 0.90], [700, 470, 28, 0.92]
];
const SLite = [
  [620, 336, 58, 1.14], [566, 398, 24, 1.10], [676, 394, 22, 1.08],
  [621, 452, 9, 1.22], [627, 487, 10, 1.20],
  [560, 444, 26, 1.10], [694, 438, 24, 1.06],
  [621, 567, 14, 1.16], [608, 534, 11, 1.08], [540, 424, 18, 1.05]
];
function faceLum(x, y) {
  const nx = (x - 618) / 118, ny = (y - 428) / 162, d2 = nx * nx + ny * ny;
  const nz = d2 < 1 ? Math.sqrt(1 - d2) : 0;
  let lum = nz * 0.75 + (-nx * 0.5 - ny * 0.65) * 0.25 + 0.25;
  lum = lerp(0.55, lum, 0.75);
  for (const s of SHade) { const dd = Math.hypot(x - s[0], y - s[1]); if (dd < s[2]) lum *= lerp(s[3], 1, dd / s[2]); }
  for (const s of SLite) { const dd = Math.hypot(x - s[0], y - s[1]); if (dd < s[2]) lum *= lerp(s[3], 1, dd / s[2]); }
  if (y < hairlineY(x) + 16) lum *= 0.8;                       /* 发际线投影 */
  const hw = faceHW(y);
  if (hw > 0) { const e = Math.abs(x - faceCX(y)) / hw; lum *= 1 - 0.22 * Math.max(0, e - 0.75) * 4; } /* 轮廓内收 */
  return clamp(lum, 0.04, 1.12);
}
const skinCol = (lum, j = 8) => C(...jit(ramp(SKIN_RAMP, lum), j));

/* ================================================================
 *  一 · 天空与远景（空气透视，重雾化）
 * ================================================================ */
(function sky() {
  const l = 'bgFar';
  const ridgeTop = x => {
    let m = 1600;
    for (const p of [...RIDGE_FL, ...RIDGE_FR]) if (Math.abs(p[0] - x) < 70) m = Math.min(m, p[1] - 26);
    return m === 1600 ? 9999 : m;
  };
  fillR(l, (x, y) => y >= 0 && y <= ridgeTop(x) + 30 && y < 620, [0, 0, W, 620], 640, (x, y) => {
    const t = y / 620;
    let col = t < 0.45 ? mix(SKY_TOP, SKY_MID, t / 0.45) : mix(SKY_MID, SKY_LOW, (t - 0.45) / 0.55);
    col = mix(col, HAZE, 0.15 + 0.35 * (1 - Math.abs(0.5 - x / W) )); /* 中央更雾 */
    col = jit(col, 7);
    tang(l, x, y, R(-0.06, 0.06) + (rnd() < 0.06 ? PI / 2 + R(-0.2, 0.2) : 0),
      R(50, 130), R(-6, 6), C(col[0], col[1], col[2]), R(2.5, 5), R(0.05, 0.13));
  });
})();

function paintRidge(pts, depth, base, n, crestLight) {
  const l = 'bgFar', poly = mkPoly(pts);
  for (let i = 0; i < n; i++) {
    const d = R(0, poly.tot), p = poly.at(d);
    const off = Math.pow(R(0, 1), 0.85) * depth;
    const x = p.x + gauss() * 7, y = p.y + off + Math.abs(gauss() * 3);
    const hz = clamp(off / depth, 0, 1);
    let col = mix(base, HAZE, hz * 0.65 + R(0, 0.2));
    if (off < depth * 0.12 && crestLight && rnd() < 0.5) col = mix(col, HAZE, 0.45);
    col = jit(col, 7);
    tang(l, x, y, p.a + R(-0.16, 0.16) + (hz > 0.6 ? R(-0.35, 0.35) : 0),
      R(22, 58) * (1 - hz * 0.35), R(-4, 4), C(col[0], col[1], col[2]), R(1.6, 3.4), R(0.09, 0.2));
  }
  /* 山脊亮线 */
  for (let i = 0; i < n * 0.22; i++) {
    const p = poly.at(R(0, poly.tot));
    const col = jit(mix(base, HAZE, 0.55), 6);
    tang(l, p.x + gauss() * 4, p.y + R(-3, 4), p.a + R(-0.1, 0.1), R(14, 34), R(-2, 2), C(col[0], col[1], col[2]), R(1.2, 2.2), R(0.12, 0.24));
  }
}
paintRidge(RIDGE_FL, 190, FAR_L, 320, true);
paintRidge(RIDGE_FR, 150, FAR_R, 260, true);

/* ================================================================
 *  二 · 中景：丘陵 · 河谷平原 · 河流 · 拱桥 · 左侧蜿蜒小径
 * ================================================================ */
(function midHills() {
  const l = 'bgMid';
  const paintHill = (pts, n) => {
    const poly = mkPoly(pts);
    for (let i = 0; i < n; i++) {
      const d = R(0, poly.tot), p = poly.at(d);
      const off = Math.pow(R(0, 1), 0.9) * 95;
      const x = p.x + gauss() * 6, y = p.y + off;
      let col = mix(MID_OLIVE, MID_DK, R(0, 1) * (0.3 + 0.5 * off / 95));
      col = jit(col, 8);
      tang(l, x, y, p.a + R(-0.2, 0.2), R(16, 44), R(-3, 3), C(col[0], col[1], col[2]), R(1.6, 3.2), R(0.1, 0.22));
      if (rnd() < 0.3) { /* 树木点戳 */
        tang(l, x + R(-8, 8), y + R(-6, 6), PI / 2 + R(-0.5, 0.5), R(5, 11), R(-1, 1),
          C(...jit(MID_DK, 6)), R(1.2, 2), R(0.16, 0.3));
      }
    }
  };
  paintHill(HILL_L, 340); paintHill(HILL_R, 280);
  /* 河谷平原过渡带 */
  fillR(l, (x, y) => ((x > 250 && x < 560) || x > 690) && y > 520 && y < 980 &&
    !inHairMass(x, y) && !inPoly(x, y, FIG_OUT), [240, 520, W, 990], 300, (x, y) => {
    const t = clamp((y - 520) / 400, 0, 1);
    let col = mix(MID_LT, VALLEY, t);
    col = mix(col, ROAD_D, 0.12 * t);
    col = jit(col, 9);
    tang(l, x, y, R(-0.1, 0.1) + (rnd() < 0.15 ? R(0.6, 0.9) * (x < 620 ? 1 : -1) : 0),
      R(20, 55), R(-4, 4), C(col[0], col[1], col[2]), R(1.6, 3.4), R(0.07, 0.17));
  });
})();

(function river() {
  const l = 'bgMid', poly = mkPoly(RIVER_PTS);
  for (let i = 0; i < 300; i++) {
    const t = Math.pow(R(0, 1), 0.7), p = poly.at(t * poly.tot), wd = lerp(16, 66, t);
    const u = R(-1, 1), nx = -Math.sin(p.a), ny = Math.cos(p.a);
    const x = p.x + nx * u * wd / 2, y = p.y + ny * u * wd / 2;
    const edge = Math.abs(u);
    let col = edge > 0.85 ? mix(WATER_D, MID_DK, 0.5) : mix(WATER, WATER_L, R(0, 1) * Math.max(0, 1 - edge * 1.15));
    col = jit(col, 6);
    tang(l, x, y, p.a + R(-0.07, 0.07), R(10, 30), R(-2, 2), C(col[0], col[1], col[2]), R(1.2, 2.6), R(0.1, 0.26));
  }
})();

(function bridge() {  /* 瓦里亚诺式多拱石桥（原作右侧 Ponte Buriano）*/
  const l = 'bgMid';
  const deckY = 634, deckH = 9, springY = 658, waterY = 674, x0 = 872, x1 = 1038;
  for (let i = 0; i < 26; i++) { const x = R(x0, x1);
    tang(l, x, deckY - 4 + R(-1.5, 1.5), 0.05 + R(-0.05, 0.05), R(8, 16), R(-1, 1), C(...jit(STONE, 8)), R(1.4, 2.4), R(0.3, 0.55)); }
  for (let i = 0; i < 30; i++) { const x = R(x0, x1);
    tang(l, x, R(deckY + 2, deckY + deckH), 0.04 + R(-0.03, 0.03), R(9, 18), R(-1, 1), C(...jit(mul(STONE, 0.88), 8)), R(1.6, 2.8), R(0.25, 0.5)); }
  const n = 4, span = (x1 - x0) / n;
  for (let k = 0; k < n; k++) {
    const cx = x0 + span * (k + 0.5), r = span * 0.42;
    for (let i = 0; i < 16; i++) { const th = R(0.1, PI - 0.1);
      tang(l, cx + Math.cos(th) * r, springY - Math.sin(th) * r * 0.9, th + PI / 2 + R(-0.1, 0.1),
        R(5, 10), R(-1, 1), C(...jit(STONE, 7)), R(1.3, 2.2), R(0.3, 0.55)); }
    for (let i = 0; i < 6; i++) { const th = R(0.35, PI - 0.35);
      tang(l, cx + Math.cos(th) * r * 0.66, springY - Math.sin(th) * r * 0.6, th + PI / 2, 7, 1,
        C(...jit([42, 42, 34], 6)), 1.8, R(0.2, 0.35)); }
  }
  for (let k = 0; k <= n; k++) { const px = x0 + span * k;
    for (let i = 0; i < 5; i++) tang(l, px + R(-2, 2), R(springY, waterY), PI / 2 + R(-0.06, 0.06), R(6, 12), 0,
      C(...jit(mul(STONE, 0.72), 6)), R(1.6, 2.4), R(0.3, 0.5)); }
  for (let i = 0; i < 26; i++) tang(l, R(x0 - 12, x1 + 12), R(waterY + 2, waterY + 18), R(-0.05, 0.05), R(10, 26), R(-2, 2),
    C(...jit(mix(WATER_D, STONE, 0.35), 6)), R(1.4, 2.6), R(0.1, 0.22));
})();

(function road() {   /* 左侧伊尔索状蜿蜒小径 */
  const l = 'bgMid', poly = mkPoly(ROAD_PTS);
  for (let i = 0; i < 130; i++) {
    const t = R(0.02, 0.98), p = poly.at(t * poly.tot), wd = lerp(18, 7, t);
    const u = R(-1, 1), nx = -Math.sin(p.a), ny = Math.cos(p.a);
    const x = p.x + nx * u * wd / 2, y = p.y + ny * u * wd / 2;
    const edge = Math.abs(u);
    const col = edge > 0.8 ? mix(ROAD_D, MID_OLIVE, 0.4) : mix(ROAD, ROAD_D, R(0, 0.5) * edge);
    tang(l, x, y, p.a + R(-0.1, 0.1), R(7, 16), R(-1.5, 1.5), C(...jit(col, 6)), R(1.2, 2.4), R(0.18, 0.38));
  }
})();

/* ================================================================
 *  三 · 近景：左侧岩壁 · 地面暗部 · 角落晕影
 * ================================================================ */
(function nearGround() {
  const l = 'bgNear';
  fillR(l, (x, y) => inPoly(x, y, ROCK_POLY), [-10, 850, 350, 1130], 300, (x, y) => {
    const topLit = clamp((y - 858) / 120, 0, 1);
    let col = topLit < 0.35 ? mix(ROCK_LT, ROCK, topLit / 0.35) : mix(ROCK, ROCK_DK, (topLit - 0.35) / 0.65);
    col = jit(col, 9);
    const ang = Math.atan2(y - 930, x - 170) + PI / 2 + R(-0.5, 0.5);
    tang(l, x, y, ang, R(16, 38), R(-4, 4), C(col[0], col[1], col[2]), R(2.4, 5), R(0.16, 0.34));
  });
  for (let i = 0; i < 40; i++) { /* 岩顶灌木 */
    const x = R(20, 290), y = 870 + R(-14, 10);
    tang(l, x, y, PI / 2 + R(-0.6, 0.6), R(5, 12), R(-1, 1), C(...jit(MID_DK, 8)), R(1.4, 2.4), R(0.2, 0.36));
  }
  fillR(l, (x, y) => y > 1385 || (x < 345 && y > 1115) || (x > 945 && y > 1355), [0, 1100, W, H], 300, (x, y) => {
    const col = jit(mix(WOOD_DK, VIG, R(0, 0.6)), 6);
    tang(l, x, y, R(-0.12, 0.12) + PI * 0, R(30, 80), R(-5, 5), C(col[0], col[1], col[2]), R(3, 6), R(0.2, 0.4));
  });
  /* 四角晕影（以笔触完成暗角） */
  const corners = [[0, 0], [W, 0], [0, H], [W, H]];
  for (let i = 0; i < 110; i++) {
    const c = corners[(rnd() * 4) | 0];
    const x = clamp(c[0] + (c[0] === 0 ? R(0, 380) : -R(0, 380)), 0, W);
    const y = clamp(c[1] + (c[1] === 0 ? R(0, 420) : -R(0, 420)), 0, H);
    const ang = Math.atan2(c[1] - y, c[0] - x) + PI / 2;
    tang(l, x, y, ang, R(50, 120), R(-8, 8), C(...jit(VIG, 5)), R(4, 8), R(0.05, 0.11));
  }
})();

/* 人物背后柔和投影，增强分离度 */
(function halo() {
  const l = 'halo';
  for (let i = 0; i < 170; i++) {
    const k = RI2(1, FIG_OUT.length - 1);
    const a = FIG_OUT[k - 1], b = FIG_OUT[k];
    const t = R(0, 1), ex = lerp(a[0], b[0], t), ey = lerp(a[1], b[1], t);
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const mx = ex + nx * 24, my = ey + ny * 24;
    if (inPoly(mx, my, FIG_OUT)) { nx = -nx; ny = -ny; }
    const off = R(8, 42);
    const x = ex + nx * off, y = ey + ny * off;
    if (x < 0 || x > W || y < 0 || y > H) continue;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + R(-0.2, 0.2);
    tang(l, x, y, ang, R(24, 60), R(-4, 4), C(...jit([56, 48, 34], 5)), R(3, 6), R(0.022, 0.05));
  }
  function RI2(a, b) { return Math.floor(R(a, b + 1)); }
})();
function RI2(a, b) { return Math.floor(R(a, b + 1)); }

/* ================================================================
 *  四 · 人体与服装
 * ================================================================ */
(function skirt() {
  const l = 'skirt';
  fillR(l, (x, y) => inPoly(x, y, SKIRT_POLY), [310, 1120, 910, H], 560, (x, y) => {
    const fm = 0.7 + 0.5 * (0.5 + 0.5 * Math.sin(x * 0.045 + y * 0.004 + R(-0.4, 0.4)));
    const knee = 1 + 0.28 * Math.max(0, 1 - Math.hypot((x - 520) / 110, (y - 1330) / 130));
    const col = jit(mul(ramp(SKIRT_RAMP, fm * 0.75), knee), 5);
    tang(l, x, y, PI / 2 + R(-0.2, 0.2) + 0.12 * Math.sin(x * 0.012), R(60, 150), R(-8, 8),
      C(col[0], col[1], col[2]), R(2.6, 5.5), R(0.12, 0.26));
  });
  /* 覆膝衣褶斜纹 */
  for (let i = 0; i < 170; i++) {
    const t = R(0, 1), bx = lerp(445, 775, t) + gauss() * 26, by = lerp(1215, 1435, t) + gauss() * 26;
    if (!inPoly(bx, by, SKIRT_POLY)) continue;
    const col = jit(mul(ramp(SKIRT_RAMP, R(0.3, 0.85)), 1.05), 5);
    tang(l, bx, by, 0.42 + R(-0.16, 0.16), R(50, 110), R(-6, 6), C(col[0], col[1], col[2]), R(2.2, 4.4), R(0.1, 0.22));
  }
})();

(function bodice() {
  const l = 'bodice';
  fillR(l, (x, y) => inPoly(x, y, BOD_POLY) && y > neckLineY(x) - 6, [412, 762, 832, 1156], 520, (x, y) => {
    const fm = 0.66 + 0.44 * (0.5 + 0.5 * Math.sin(x * 0.16 + y * 0.008));
    const col = jit(mix(BOD_DK, BOD_BASE, fm * 0.8), 5);
    const ang = PI / 2 + R(-0.12, 0.12) + (x - 620) * 0.0004;
    tang(l, x, y, ang, R(30, 80), R(-5, 5), C(col[0], col[1], col[2]), R(2, 4.2), R(0.14, 0.3));
    if (rnd() < 0.045) tang(l, x, y - 4, ang, R(20, 46), R(-3, 3), C(...jit(GOLD, 10)), 1.6, R(0.1, 0.2));
  });
  /* 领口刺绣织带（标志性的连环结饰） */
  for (let x = 512; x <= 740; x += 13) {
    const y = neckLineY(x);
    const slope = -0.0079 * (x - 620);
    const ang = Math.atan2(neckLineY(x + 4) - neckLineY(x - 4), 8);
    const gold = rnd() < 0.5;
    const cA = gold ? GOLD : mul(BOD_BASE, 0.7), cB = gold ? mul(BOD_BASE, 0.7) : GOLD;
    tang('trim', x, y - 3, ang + 0.7, 9, 2, C(...jit(cA, 8)), 1.7, R(0.4, 0.6));
    tang('trim', x + 4, y - 1, ang - 0.7, 9, 2, C(...jit(cB, 8)), 1.7, R(0.4, 0.6));
    dot('trim', x + 2, y + 4 + slope * 2, 1.6, C(...jit(gold ? GOLD : BOD_DK, 8)), 0.5);
    tang('trim', x, y + 8, ang, R(8, 13), 1.5, C(...jit(BOD_DK, 5)), 1.8, R(0.35, 0.55));
  }
})();

/* 袖管（沿臂部折线的筒状着色 + 打褶条纹 + 袖口碎褶） */
function paintTube(l, pts, n, opt) {
  const poly = mkPoly(pts.map(p => [p[0], p[1]]));
  for (let i = 0; i < n; i++) {
    const t = R(0.01, 0.99), p = poly.at(t * poly.tot);
    const idxF = t * (pts.length - 1), i0 = Math.floor(idxF), i1 = Math.min(pts.length - 1, i0 + 1);
    const rr = lerp(pts[i0][2], pts[i1][2], idxF - i0);
    const u = R(-0.94, 0.94), nx = -Math.sin(p.a), ny = Math.cos(p.a);
    const x = p.x + nx * u * rr, y = p.y + ny * u * rr;
    let m = 1 - 0.38 * Math.abs(u);
    if (opt.pleat) m *= 0.78 + 0.34 * Math.sin(u * 9 + t * 20 + i * 0.7);
    const col = jit(ramp(SLEEVE_RAMP, clamp(m, 0, 1)), 7);
    tang(l, x, y, p.a + u * 0.16 + gauss() * 0.06, R(16, 40), R(-3, 3), C(col[0], col[1], col[2]),
      R(opt.wMin, opt.wMax), R(opt.opMin, opt.opMax));
  }
  if (opt.cuff) { /* 袖口聚褶 */
    const pEnd = poly.at(poly.tot * 0.985), pPre = poly.at(poly.tot * 0.9);
    const a = Math.atan2(pEnd.y - pPre.y, pEnd.x - pPre.x);
    const rr = pts[pts.length - 1][2];
    for (let i = 0; i < 34; i++) {
      const u = R(-0.9, 0.9);
      const x = pEnd.x - Math.sin(a) * u * rr, y = pEnd.y + Math.cos(a) * u * rr;
      tang(l, x, y, a + PI / 2 + R(-0.15, 0.15), rr * 1.15, rr * 0.4, C(...jit(mul(SLEEVE_RAMP[1][1], 0.8), 6)), R(1.4, 2.4), R(0.22, 0.4));
    }
  }
}
paintTube('sleeves',
  [[400, 780, 62], [345, 900, 58], [330, 1010, 60], [420, 1120, 46], [560, 1190, 36], [655, 1232, 30]],
  380, { pleat: true, cuff: true, wMin: 1.6, wMax: 3.4, opMin: 0.12, opMax: 0.3 });
paintTube('sleeves',
  [[858, 786, 60], [950, 900, 58], [985, 1010, 60], [920, 1120, 44], [838, 1206, 32]],
  360, { pleat: true, cuff: true, wMin: 1.6, wMax: 3.4, opMin: 0.12, opMax: 0.3 });
/* 右肩后侧椅背立柱（在袖后） */
(function chairPost() {
  const l = 'chair';
  fillR(l, (x, y) => x > 1086 && x < 1128 && y > 900 && y < 1330, [1080, 895, 1135, 1335], 90, (x, y) => {
    const lit = x < 1102;
    const col = jit(lit ? mix(WOOD, WOOD_HI, 0.5) : mix(WOOD, WOOD_DK, 0.6), 6);
    tang(l, x, y, PI / 2 + R(-0.04, 0.04), R(30, 70), R(-2, 2), C(col[0], col[1], col[2]), R(2.4, 4.4), R(0.25, 0.45));
  });
})();

/* ---- 颈胸肤色 ---- */
(function chestNeck() {
  const l = 'chest';
  fillR(l, (x, y) => x > 550 && x < 696 && y > 584 && y < 665 && Math.abs(x - 622) < 34 + (y - 584) * 0.55, [548, 582, 698, 668], 240, (x, y) => {
    let lum = 0.62;
    if (y < 642) lum *= 0.52 + 0.48 * (y - 584) / 58;          /* 下颌投影 */
    lum *= 1 - 0.16 * Math.abs(x - 622) / 70;
    if (x > 602 && x < 642) lum *= 1.07;                        /* 喉结光柱 */
    const col = skinCol(clamp(lum, 0.1, 1), 7);
    tang(l, x, y, PI / 2 + R(-0.28, 0.28), R(14, 34), R(-4, 4), col, R(1.5, 3), R(0.1, 0.22));
  });
  const chestTest = (x, y) => inPoly(x, y, CHEST_POLY) && y < neckLineY(x);
  fillR(l, chestTest, [482, 634, 762, 852], 330, (x, y) => {
    const nx = (x - 620) / 140, ny = (y - 720) / 118, d2 = nx * nx + ny * ny;
    const nz = d2 < 1 ? Math.sqrt(1 - d2) : 0;
    let lum = 0.55 + nz * 0.4;
    lum *= 0.68 + 0.32 * Math.min(1, (neckLineY(x) - y) / 30);   /* 领口投影 */
    lum *= 1 - 0.2 * clamp((Math.abs(x - 620) - 90) / 50, 0, 1); /* 边缘收暗 */
    if ((x > 536 && x < 616 && Math.abs((y - 692) - (x - 536) * 0.14) < 7) ||
        (x > 628 && x < 708 && Math.abs((y - 690) + (x - 628) * 0.16) < 7)) lum *= 0.82; /* 锁骨影 */
    if ((x > 536 && x < 616 && Math.abs((y - 684) - (x - 536) * 0.14) < 5) ||
        (x > 628 && x < 708 && Math.abs((y - 682) + (x - 628) * 0.16) < 5)) lum *= 1.1;
    const col = skinCol(clamp(lum, 0.1, 1), 8);
    tang(l, x, y, Math.atan2(y - 700, x - 620) + PI / 2 + gauss() * 0.25, R(16, 38), R(-5, 5),
      col, R(1.6, 3.2), R(0.1, 0.22));
  });
})();

/* ================================================================
 *  五 · 面部 —— 三遍罩染（基底 / 阴影 / 高光）
 * ================================================================ */
(function faceBase() {
  const l = 'faceBase';
  fillR(l, inFace, [494, 264, 748, 600], 1150, (x, y) => {
    const lum = faceLum(x, y);
    const ang = Math.atan2(y - 430, x - 618) + PI / 2 + gauss() * 0.3;
    tang(l, x, y, ang, R(15, 38), R(-7, 7), skinCol(lum), R(1.4, 2.8), R(0.09, 0.2));
  });
})();
(function faceShade() {  /* 定向阴影笔触：贴着形体截面走 */
  const l = 'faceShad';
  for (let i = 0; i < 430; i++) {
    const s = SHade[(rnd() * SHade.length) | 0];
    const a = R(0, TAU), rr = Math.abs(gauss()) * s[2] * 0.55;
    const x = s[0] + Math.cos(a) * rr, y = s[1] + Math.sin(a) * rr;
    if (!inFace(x, y)) continue;
    const lum = faceLum(x, y) * 0.92;
    const ang = Math.atan2(y - s[1], x - s[0]) + PI / 2 + R(-0.3, 0.3);
    tang(l, x, y, ang, R(9, 24), R(-4, 4), skinCol(Math.min(lum, 0.5), 6), R(1.6, 3), R(0.12, 0.26));
  }
})();
(function faceLight() {
  const l = 'faceHi';
  for (let i = 0; i < 250; i++) {
    const s = SLite[(rnd() * SLite.length) | 0];
    const a = R(0, TAU), rr = Math.abs(gauss()) * s[2] * 0.5;
    const x = s[0] + Math.cos(a) * rr, y = s[1] + Math.sin(a) * rr;
    if (!inFace(x, y)) continue;
    const ang = Math.atan2(y - s[1], x - s[0]) + PI / 2 + R(-0.35, 0.35);
    tang(l, x, y, ang, R(8, 22), R(-3, 3), skinCol(clamp(faceLum(x, y) * 1.18, 0.4, 1.12), 6), R(1.3, 2.6), R(0.09, 0.19));
  }
  /* 额头横向宽笔 */
  for (let i = 0; i < 40; i++) {
    const x = R(540, 700), y = R(305, 365);
    tang(l, x, y, R(-0.08, 0.08), R(24, 52), R(-5, 5), skinCol(1.02, 6), R(2.5, 4.2), R(0.06, 0.11));
  }
})();

/* ---- 五官（全部以柔化短笔簇构成，无硬轮廓线）---- */
(function features() {
  const l = 'feat';
  function bez(p0, p1, p2, s) {
    const u = 1 - s;
    return [u * u * p0[0] + 2 * s * u * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * s * u * p1[1] + s * s * p2[1]];
  }
  function eye(ex, ey, hw, tilt) {
    const cs = Math.cos(tilt), sn = Math.sin(tilt);
    const pt = (sx, o) => [ex + sx * hw * cs - o * sn, ey + sx * hw * sn + o * cs];
    const A = pt(-1, -1), M = pt(0, -hw * 0.72), B = pt(1, -1);
    const A2 = pt(-0.9, 2.5), M2 = pt(0, hw * 0.34), B2 = pt(0.9, 2.5);
    /* 上睑缘 */
    for (let i = 0; i < 9; i++) { const s = lerp(0.06, 0.94, i / 8) + R(-0.03, 0.03);
      const p = bez(A, M, B, s), q = bez(A, M, B, s + 0.05);
      seg(l, p[0], p[1], q[0], q[1], R(-1, 1), C(...jit([70, 50, 36], 6)), R(1.3, 2), R(0.3, 0.48)); }
    /* 睑褶 */
    const Mc = pt(0, -hw * 1.04);
    for (let i = 0; i < 6; i++) { const s = lerp(0.1, 0.9, i / 5) + R(-0.04, 0.04);
      const p = bez(pt(-0.95, -4), Mc, pt(0.95, -4), s);
      tang(l, p[0], p[1], tilt + PI / 2 + R(-0.4, 0.4), R(5, 10), R(-1, 1), C(...jit([120, 88, 58], 8)), R(1.4, 2.2), R(0.12, 0.22)); }
    /* 下睑 */
    for (let i = 0; i < 6; i++) { const s = lerp(0.1, 0.9, i / 5);
      const p = bez(A2, M2, B2, s), q = bez(A2, M2, B2, s + 0.07);
      seg(l, p[0], p[1], q[0], q[1], R(-0.6, 0.6), C(...jit([210, 182, 146], 8)), 1.4, R(0.16, 0.28)); }
    /* 巩膜 */
    for (let i = 0; i < 5; i++) { const s = lerp(-0.6, 0.6, i / 4) + R(-0.05, 0.05);
      const p = pt(s, -hw * 0.06);
      tang(l, p[0], p[1], tilt + PI / 2 + R(-0.3, 0.3), R(4, 8), R(-0.5, 0.5), C(...jit([214, 198, 172], 8)), R(1.2, 2), R(0.18, 0.3)); }
    /* 虹膜 / 瞳孔 / 捕光 */
    const ic = pt(R(-0.06, 0.06), -hw * 0.02);
    for (let i = 0; i < 12; i++) { const a = R(0, TAU);
      tang(l, ic[0] + Math.cos(a) * 5.5, ic[1] + Math.sin(a) * 5.5, a + PI / 2, R(3, 5), 0,
        C(...jit([56, 40, 26], 5)), 1.4, R(0.35, 0.55)); }
    for (let i = 0; i < 5; i++) tang(l, ic[0] + R(-3, 3), ic[1] + R(-3, 3), R(0, PI), 4, 0, C(96, 72, 46), 2, 0.25);
    dot(l, ic[0], ic[1], 3.1, C(30, 22, 16), 0.9);
    dot(l, ic[0] - 2, ic[1] - 2, 1.2, C(240, 236, 220), 0.8);
    /* 睫毛（外半，短促） */
    for (let i = 0; i < 6; i++) { const s = R(0.35, 0.95);
      const p = bez(A, M, B, s);
      tang(l, p[0], p[1], tilt + (s > 0.5 ? -0.5 : 0.2) + R(-0.2, 0.2), R(4, 7), R(-1, 1), C(52, 38, 28), 1.3, R(0.35, 0.5)); }
    dot(l, pt(-0.96, -0.5)[0], pt(-0.96, -0.5)[1], 1.6, C(196, 148, 118), 0.35);
    /* 几乎不存在的眉弓影（达·芬奇原作无眉） */
    for (let i = 0; i < 10; i++) { const s = lerp(-0.9, 0.9, rnd());
      const p = pt(s, -hw * 1.5 + R(-2, 2));
      tang(l, p[0], p[1], tilt + PI / 2 + s * 0.5, R(6, 13), R(-1.5, 1.5), C(...jit([112, 82, 52], 8)), R(1.8, 3), R(0.07, 0.13)); }
  }
  eye(556, 417, 27, 0.10);
  eye(675, 412, 28, -0.06);

  /* 鼻 */
  for (const side of [-1, 1]) for (let i = 0; i < 55; i++) {
    const x = 628 + side * R(16, 27), y = R(430, 494);
    tang(l, x, y, PI / 2 + R(-0.2, 0.2), R(8, 20), R(-2, 2), skinCol(faceLum(x, y) * 0.86, 6), R(1.5, 2.8), R(0.1, 0.2));
  }
  for (let i = 0; i < 28; i++) { const x = R(614, 628), y = R(426, 486);
    tang(l, x, y, PI / 2 + R(-0.15, 0.15), R(8, 18), R(-1.5, 1.5), skinCol(1.05, 6), R(1.3, 2.4), R(0.12, 0.24)); }
  for (let i = 0; i < 12; i++) { const a = R(0, TAU);
    tang(l, 627 + Math.cos(a) * 8, 488 + Math.sin(a) * 7, a + PI / 2, 6, 1, skinCol(1.12, 5), 1.8, 0.22); } /* 鼻头高光 */
  for (let i = 0; i < 8; i++) tang(l, 627 + R(-7, 7), 500 + R(-1, 2), 0.1 + R(-0.1, 0.1), R(5, 9), 1, C(96, 64, 44), 1.8, 0.26); /* 鼻底影 */
  for (const sx of [607, 648]) { /* 鼻翼与鼻孔 */
    for (let i = 0; i < 6; i++) { const a = R(PI * 0.15, PI * 0.85);
      tang(l, sx + Math.cos(a) * 5, 501 + Math.sin(a) * 3.4, a + PI / 2, 5, 1, C(64, 42, 28), 1.5, R(0.3, 0.5)); }
    for (let i = 0; i < 8; i++) { const a = R(0, TAU);
      tang(l, sx + Math.cos(a) * 8, 499 + Math.sin(a) * 5, a + PI / 2, 6, 1, skinCol(0.6, 5), 1.6, R(0.12, 0.22)); }
  }

  /* 嘴 —— 似有若无的微笑全靠嘴角融入面颊 */
  const cl = [573, 524], cr = [669, 517], cm = [621, 530];
  for (let i = 0; i < 16; i++) { if (rnd() < 0.3) continue;
    const s = lerp(0.04, 0.96, i / 15) + R(-0.03, 0.03);
    const p = bez(cl, cm, cr, s), q = bez(cl, cm, cr, Math.min(1, s + 0.05));
    seg(l, p[0], p[1], q[0], q[1], R(-0.8, 0.8), C(...jit([88, 56, 40], 7)), R(1.4, 2), R(0.22, 0.36)); }
  for (const c of [cl, cr]) { /* 嘴角深晕 + 漫入脸颊的软影 */
    for (let i = 0; i < 8; i++) { const a = R(0, TAU);
      tang(l, c[0] + Math.cos(a) * 4, c[1] + Math.sin(a) * 3.4, a + PI / 2, R(4, 8), 1, C(78, 50, 36), 1.7, R(0.25, 0.42)); }
    for (let i = 0; i < 6; i++) tang(l, c[0] + R(-6, 6), c[1] + R(-3, 5), R(-0.4, 0.4), R(12, 20), R(-3, 3),
      C(...jit([134, 96, 66], 7)), 2.6, R(0.08, 0.14)); }
  for (let i = 0; i < 26; i++) { /* 上唇 */
    const s = R(0.08, 0.92), p = bez(cl, cm, cr, s);
    const up = [p[0] + R(-2, 2), p[1] - R(2.5, 7)];
    tang(l, up[0], up[1], Math.atan2(cr[1] - cl[1], cr[0] - cl[0]) + R(-0.15, 0.15), R(6, 12), R(-1.5, 1.5),
      C(...jit([128, 78, 58], 8)), R(1.4, 2.4), R(0.16, 0.3)); }
  for (let i = 0; i < 26; i++) { /* 下唇 */
    const s = R(0.1, 0.9), p = bez(cl, cm, cr, s);
    const dn = [p[0] + R(-2, 2), p[1] + R(4.5, 10)];
    tang(l, dn[0], dn[1], Math.atan2(cr[1] - cl[1], cr[0] - cl[0]) + R(-0.12, 0.12), R(6, 12), R(-1.5, 1.5),
      C(...jit([192, 128, 98], 9)), R(1.5, 2.6), R(0.18, 0.32)); }
  for (let i = 0; i < 7; i++) tang(l, 612 + R(-4, 8), 538 + R(-2, 2), 0.05, R(6, 11), 1, C(228, 174, 138), 1.8, R(0.2, 0.36));
  for (let i = 0; i < 10; i++) tang(l, 620 + R(-9, 9), 551 + R(-1, 3), 0.08 + R(-0.08, 0.08), R(6, 12), 1.5, skinCol(0.55, 5), 2, R(0.1, 0.2));
  for (const px of [617, 624]) tang(l, px, R(506, 514), PI / 2, 8, 0.5, skinCol(0.8, 4), 1.4, 0.1);

  /* 下巴光斑与颏唇沟已由光影盘承担；补充颧骨弧光 */
  for (let i = 0; i < 16; i++) { const a = R(PI * 0.15, PI * 0.85);
    const cx0 = 560, cy0 = 448;
    tang(l, cx0 + Math.cos(a + PI) * 22, cy0 + Math.sin(a) * 14, a + PI / 2, R(6, 12), 2, skinCol(1.06, 5), 1.6, R(0.08, 0.16)); }
})();

/* ================================================================
 *  六 · 头发（底层体块 + 波浪长丝）与头纱
 * ================================================================ */
function strand(l, sx, sy, steps, phase, stopFace) {
  let x = sx, y = sy;
  let a = Math.atan2(y - 298, x - 604) + R(-0.5, 0.5);
  for (let i = 0; i < steps; i++) {
    a = lerpAng(a, PI / 2, 0.1);
    a += Math.sin(i * 0.85 + phase) * 0.24 + gauss() * 0.16;
    const st = R(9, 13);
    const nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
    let col = mix(HAIR_BLACK, HAIR_DARK, R(0, 1));
    if (rnd() < 0.06) col = HAIR_WARM;
    seg(l, x, y, nx, ny, R(-2.5, 2.5), C(col[0], col[1], col[2]), R(1.2, 2.4), R(0.45, 0.8));
    x = nx; y = ny;
    if (stopFace && inFace(x, y)) break;
    if (x < 320 || x > 940 || y > 1010) break;
  }
}
(function hairUnder() {  /* 体块底层：宽深笔铺满发区 */
  const l = 'hairBack';
  fillR(l, inHairMass, [398, 250, 846, 1010], 230, (x, y) => {
    const col = jit(mix(HAIR_BLACK, HAIR_DARK, R(0, 0.7)), 4);
    tang(l, x, y, PI / 2 + R(-0.3, 0.3), R(24, 60), R(-4, 4), C(col[0], col[1], col[2]), R(3.5, 6.5), R(0.4, 0.65));
  });
})();
(function hairMain() {
  const l = 'hairFront';
  /* 冠部：自分发缝向后掠 */
  for (let i = 0; i < 300; i++) {
    const a = R(-PI * 0.93, -PI * 0.07);
    const sx = 618 + Math.cos(a) * R(96, 118), sy = 408 + Math.sin(a) * R(96, 112);
    if (sy > hairlineY(sx) - 2) continue;
    strand(l, sx, sy, RI2(5, 10), R(0, 6.28), true);
  }
  /* 两侧垂波 */
  for (let i = 0; i < 200; i++) { /* 左叶 */
    const a = R(0, TAU), rr = Math.sqrt(rnd());
    const sx = 502 + Math.cos(a) * 92 * rr, sy = 448 + Math.sin(a) * 175 * rr;
    if (!hairLobeL(sx, sy)) continue;
    strand(l, sx, sy, RI2(10, 20), R(0, 6.28), true);
  }
  for (let i = 0; i < 210; i++) { /* 右叶 */
    const a = R(0, TAU), rr = Math.sqrt(rnd());
    const sx = 738 + Math.cos(a) * 96 * rr, sy = 442 + Math.sin(a) * 182 * rr;
    if (!hairLobeR(sx, sy)) continue;
    strand(l, sx, sy, RI2(10, 20), R(0, 6.28), true);
  }
  /* 少量高光丝与散落颊边碎发 */
  for (let i = 0; i < 70; i++) {
    const left = rnd() < 0.5;
    const sx = left ? R(448, 540) : R(700, 795), sy = R(360, 620);
    let col = HAIR_HI;
    seg(l, sx, sy, sx + R(-8, 8), sy + R(24, 60), R(-6, 6), C(...col.map(v => v + R(-12, 12))), R(1, 1.8), R(0.16, 0.3));
  }
})();
(function veil() {  /* 覆冠薄纱 + 垂落纱幔 */
  const l = 'veil';
  for (let i = 0; i < 120; i++) {
    const a = R(-PI * 0.95, -PI * 0.05);
    const r = R(120, 148);
    const x = 618 + Math.cos(a) * r, y = 408 + Math.sin(a) * r * 0.85;
    if (y > 330 && Math.abs(x - 618) < 90) continue;
    tang(l, x, y, a + PI / 2 + R(-0.2, 0.2), R(18, 44), R(-4, 4), C(...jit([188, 186, 166], 8)), R(1.8, 3.2), R(0.016, 0.034));
  }
  for (let i = 0; i < 70; i++) { const left = rnd() < 0.5;
    const x = left ? R(430, 490) : R(750, 815), y = R(320, 880);
    tang(l, x, y, PI / 2 + R(-0.25, 0.25), R(30, 70), R(-5, 5), C(...jit([182, 180, 162], 8)), R(2, 3.6), R(0.014, 0.03));
  }
})();

/* ================================================================
 *  七 · 扶手与交叠的双手
 * ================================================================ */
(function armrest() {
  const l = 'armrest';
  const yAt = x => 1318 + (x - 640) * 0.045;
  fillR(l, (x, y) => x > 640 && x < 1146 && y > yAt(x) && y < yAt(x) + 50, [635, 1312, 1150, 1390], 110, (x, y) => {
    const nearTop = y - yAt(x);
    const col = nearTop < 8 ? mix(WOOD, WOOD_HI, 0.55) : nearTop > 38 ? mix(WOOD, WOOD_DK, 0.7) : mix(WOOD, WOOD_DK, 0.25);
    tang(l, x, y, 0.045 + R(-0.05, 0.05), R(18, 46), R(-2, 2), C(...jit(col, 6)), R(2.4, 4.4), R(0.3, 0.55));
  });
  /* 旋木端头 */
  for (let i = 0; i < 40; i++) { const a = R(0, TAU), rr = 24 * Math.sqrt(rnd());
    const x = 1128 + Math.cos(a) * rr, y = 1348 + Math.sin(a) * rr;
    const col = rr < 9 ? mix(WOOD_HI, WOOD, 0.4) : mix(WOOD, WOOD_DK, rr / 24 * 0.8);
    tang(l, x, y, a + PI / 2, R(5, 11), 1, C(...jit(col, 6)), R(1.6, 2.8), R(0.3, 0.5)); }
  for (let i = 0; i < 16; i++) tang(l, R(660, 1100), yAt(R(660, 1100)) + 52 + R(0, 16), 0.04, R(24, 50), R(-3, 3),
    C(...jit(WOOD_DK, 5)), R(3, 5.5), R(0.2, 0.35));
})();

(function hands() {
  const l = 'hands';
  const finger = (pts, nailT) => {
    const poly = mkPoly(pts.map(p => [p[0], p[1]]));
    for (let i = 0; i < 46; i++) {
      const t = R(0.02, 0.98), p = poly.at(t * poly.tot);
      const idxF = t * (pts.length - 1), i0 = Math.floor(idxF), i1 = Math.min(pts.length - 1, i0 + 1);
      const rr = lerp(pts[i0][2], pts[i1][2], idxF - i0);
      const u = R(-0.85, 0.85), nx = -Math.sin(p.a), ny = Math.cos(p.a);
      const x = p.x + nx * u * rr, y = p.y + ny * u * rr;
      const m = 1 - 0.4 * Math.abs(u) + (t > 0.55 && t < 0.8 ? 0.12 : 0);
      const col = skinCol(clamp(m * 0.78, 0.15, 0.95), 6);
      tang(l, x, y, p.a + u * 0.2 + gauss() * 0.08, R(6, 14), R(-1.5, 1.5), col, R(1.2, 2.2), R(0.14, 0.3));
      if (nailT && Math.abs(t - nailT) < 0.04 && Math.abs(u) < 0.4)
        tang(l, x, y, p.a, 4.5, 0.5, skinCol(1.05, 4), 1.3, 0.28);
    }
  };
  /* 下手（她的左手，搭扶手，指向右下） */
  finger([[818, 1250, 9], [874, 1266, 6]], null);
  finger([[812, 1261, 9.5], [870, 1281, 6]], null);
  finger([[803, 1271, 9], [852, 1296, 5.5]], null);
  finger([[792, 1278, 7.5], [830, 1305, 5]], null);
  finger([[762, 1240, 8], [782, 1288, 6]], null);   /* 拇指 */
  /* 上手（她的右手，覆于左腕，指向左下） */
  finger([[676, 1256, 9.5], [622, 1276, 5.5]], 0.62);
  finger([[682, 1266, 9], [630, 1290, 5.5]], 0.62);
  finger([[690, 1273, 8.5], [646, 1300, 5]], 0.62);
  finger([[699, 1278, 7], [664, 1306, 4.5]], 0.6);
  /* 两手背 */
  const back = (cx, cy, rx, ry, rot) => {
    fillR(l, (x, y) => { const cs = Math.cos(rot), sn = Math.sin(rot);
      const dx = x - cx, dy = y - cy;
      const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
      return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1; },
      [cx - rx - 4, cy - ry - 4, cx + rx + 4, cy + ry + 4], 90, (x, y) => {
        const lum = 0.62 + 0.25 * (1 - Math.hypot((x - cx) / rx, (y - cy) / ry)) - (y > cy ? 0.12 : 0);
        tang(l, x, y, rot + PI / 2 + gauss() * 0.3, R(8, 18), R(-2, 2), skinCol(clamp(lum, 0.2, 1), 6), R(1.3, 2.4), R(0.12, 0.26));
      });
    for (let i = 0; i < 5; i++) { const a = R(0, TAU);
      tang(l, cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.55, a + PI / 2, 5, 1, skinCol(0.95, 4), 1.4, 0.2); } /* 指节 */
  };
  back(795, 1243, 46, 25, -0.32);
  back(694, 1247, 44, 23, 0.15);
  /* 指间分隔影 */
  const gaps = [[[816, 1254], [868, 1270]], [[810, 1265], [864, 1285]], [[800, 1275], [848, 1300]],
                [[674, 1260], [626, 1282]], [[680, 1270], [634, 1294]], [[688, 1277], [650, 1304]]];
  for (const g of gaps) { const poly = mkPoly(g);
    for (let i = 0; i < 8; i++) { const p = poly.at(R(0.15, 0.9) * poly.tot);
      tang(l, p.x, p.y, p.a + PI / 2 + R(-0.2, 0.2), R(4, 8), 0.5, C(74, 48, 34), 1.2, R(0.25, 0.4)); } }
  /* 腕皱与袖口衔接影 */
  for (let i = 0; i < 8; i++) tang(l, 812 + R(-8, 8), 1218 + R(-3, 3), 0.5 + R(-0.2, 0.2), R(8, 16), 2, skinCol(0.5, 4), 1.6, R(0.15, 0.28));
  for (let i = 0; i < 8; i++) tang(l, 668 + R(-8, 8), 1236 + R(-3, 3), -0.3 + R(-0.2, 0.2), R(8, 16), 2, skinCol(0.5, 4), 1.6, R(0.15, 0.28));
})();

/* ================================================================
 *  八 · 全局罩染层 与 画布颗粒
 * ================================================================ */
(function glaze() {
  const l = 'glaze';
  for (let i = 0; i < 260; i++) {
    const x = R(0, W), y = R(0, H);
    const warm = rnd() < 0.6;
    const col = jit(warm ? [122, 92, 56] : [92, 98, 76], 8);
    tang(l, x, y, R(-0.25, 0.25) + (rnd() < 0.5 ? PI / 2 : 0), R(80, 170), R(-12, 12),
      C(col[0], col[1], col[2]), R(6, 13), R(0.008, 0.018));
  }
})();
(function specks() {
  const l = 'specks';
  const pal = [SKIN_RAMP[3][1], MID_OLIVE, GOLD, WATER, ROCK, HAIR_WARM];
  for (let i = 0; i < 480; i++) {
    const c = pal[(rnd() * pal.length) | 0];
    tang(l, R(0, W), R(0, H), R(0, PI), R(1.5, 4), 0, C(...jit(c, 12)), R(0.8, 1.6), R(0.03, 0.07));
  }
})();

/* ================= 组装输出 ================= */
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`);
out.push(`<title>蒙娜丽莎 · 纯 SVG 笔触复刻研究</title>`);
out.push(`<desc>以约一万条矢量短弧笔触研究性复刻达·芬奇《蒙娜丽莎》（卢浮宫藏）：晕涂法分层罩染、不对称山水背景、暖赭肤色。无位图、无渐变，全部形体由笔触承载。</desc>`);
out.push(`<defs>`);
out.push(`<filter id="f1" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.3"/></filter>`);
out.push(`<filter id="f2" x="-8%" y="-8%" width="116%" height="116%"><feGaussianBlur stdDeviation="3"/></filter>`);
out.push(`</defs>`);
out.push(`<rect width="${W}" height="${H}" fill="#5e5138"/>`);
out.push(`<g fill="none" stroke-linecap="round" stroke-linejoin="round">`);

function emit(name, filterId) {
  const arr = layers.get(name) || [];
  out.push(`<g id="${name}"${filterId ? ` filter="url(#${filterId})"` : ``}>`);
  out.push(...arr);
  out.push(`</g>`);
}
emit('bgFar', 'f2');
emit('bgMid', 'f1');
emit('bgNear', 'f1');
emit('halo', 'f1');
emit('chair', null);
emit('skirt', null);
emit('bodice', null);
emit('trim', null);
emit('sleeves', null);
emit('chest', null);
emit('armrest', null);
emit('hairBack', 'f1');
emit('faceBase', null);
emit('faceShad', null);
emit('faceHi', null);
emit('feat', null);
emit('hairFront', null);
emit('veil', null);
emit('hands', null);
emit('glaze', 'f2');
emit('specks', null);

out.push(`</g></svg>`);

const svg = out.join('\n');
if (/NaN|undefined/.test(svg)) {
  const m = svg.match(/.{0,120}(NaN|undefined).{0,60}/);
  console.error('!! 输出含 NaN/undefined:\n' + (m ? m[0] : '?'));
  for (const [k, v] of layers) if (v.some(s => /NaN|undefined/.test(s))) console.error('layer=' + k);
  process.exit(1);
}
writeFileSync(new URL('./mona_lisa.svg', import.meta.url), svg);

const statLines = [];
let total = 0;
for (const [k, v] of layers) { total += v.length; statLines.push(`  ${k.padEnd(10)} ${String(v.length).padStart(5)}`); }
console.log(statLines.join('\n'));
console.log(`paths=${pathCount} bytes=${Buffer.byteLength(svg)} KB=${(Buffer.byteLength(svg) / 1024).toFixed(0)}`);
