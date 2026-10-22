// generator.mjs — 纯 SVG《蒙娜丽莎》笔触复刻生成器
// 用法:  node generator.mjs            → 生成 answer.svg
//        node generator.mjs --preview  → 同时渲染 qa/preview.png（自研光栅化，仅 QA 用）
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const W = 1200, H = 1600;
const OUT = path.dirname(fs.realpathSync(process.argv[1]));

/* ---------------- RNG & noise ---------------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rnd = mulberry32(20260827);
const rand = (a = 1, b) => (b === undefined ? rnd() * a : a + rnd() * (b - a));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
function hash2(x, y) { let h = x * 374761393 + y * 668265263 + 144665; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* ---------------- color helpers ---------------- */
const hx = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const jit = (c, amt = 12) => c.map(v => v + rand(-amt, amt));
function mix3(a, b, c, t) { return t < 0.5 ? mix(a, b, t * 2) : mix(b, c, (t - 0.5) * 2); }

/* ---------------- palette (赭褐/暗金/橄榄绿/深棕 + 蓝绿空气透视) ---------------- */
const P = {
  ground: hx('#2e2113'), groundWarm: hx('#40301a'),
  skyTop: hx('#7f959b'), skyMid: hx('#9dab9f'), skyHaze: hx('#c0b189'),
  mtnFar: hx('#8b9d97'), mtnMid: hx('#75897f'), mtnNear: hx('#63765f'),
  water: hx('#8fa2a8'), waterLt: hx('#a6b4ac'),
  rockL: hx('#7c6438'), rockRust: hx('#9a6a38'), rockDark: hx('#54401f'),
  cliff: hx('#8d6c3a'), cliffLt: hx('#a88246'),
  path: hx('#bb9c62'), pathLt: hx('#d2b478'),
  bridge: hx('#6d6249'), parapet: hx('#463421'),
  hair: hx('#4a2f1a'), hairRed: hx('#6e4224'), hairHi: hx('#82552c'),
  veil: hx('#93896f'), veilDim: hx('#6f6650'),
  skinLt: hx('#e4c28c'), skinMid: hx('#c3985f'), skinDeep: hx('#8f6a3f'), skinShadow: hx('#6e4d2c'),
  blush: hx('#b98a5e'),
  dress: hx('#453f27'), dressAlt: hx('#4e452c'), dressDark: hx('#332b18'), dressFold: hx('#5d5231'),
  mantle: hx('#5f5a45'),
  gold: hx('#8a6f3c'), goldLt: hx('#bb9a55'), sleeveGold: hx('#9d7530'), sleeveDeep: hx('#6a4c1e'),
  glaze: hx('#4a3418'), vign: hx('#180f07'),
  eyeDark: hx('#241509'), lip: hx('#96684a'), lipDim: hx('#7d5539'),
};

/* ---------------- geometry ---------------- */
const FC = { x: 565, y: 432, rx: 128, ry: 206 };            // face ellipse (hairline→chin)
const HC = { x: 568, y: 408, rx: 200, ry: 244 };            // head/hair mass
const FALL_L = { x: 412, y: 662, rx: 82, ry: 252 };         // left hair fall
const FALL_R = { x: 738, y: 646, rx: 88, ry: 258 };         // right hair fall
const PART = { x: 566, y: 172 };                            // veil crown / part line

const inEl = (x, y, e, k = 1) => ((x - e.x) ** 2 / (e.rx * e.rx * k * k) + (y - e.y) ** 2 / (e.ry * e.ry * k * k)) <= 1;
const edge = (x, y, e) => Math.sqrt((x - e.x) ** 2 / (e.rx * e.rx) + (y - e.y) ** 2 / (e.ry * e.ry)); // 1 = boundary

// 领口抛物线（胸肤上界）
const NL = (x) => { const p1 = [395, 828], p2 = [588, 918], p3 = [792, 798];
  const [x1, y1] = p1, [x2, y2] = p2, [x3, y3] = p3;
  const d = (x1 - x2) * (x1 - x3) * (x2 - x3);
  const A = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / d;
  const B = (x3 * (x1 - x2) * (y1 + y2) + (x2 * x2 - x1 * x1) * (y3 - y1) + (x1 * x1 - x2 * x2) * (y2 - y3)) / (2 * d) ;
  // 简化：数值插值
  const t = (x - x1) / (x3 - x1);
  const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * y2 + t * t * y3;
  return y; };

const bodyL = y => Math.max(40, 330 - (y - 760) * 0.38);
const bodyR = y => Math.min(1180, 1020 + (y - 760) * 0.21);
const inBody = (x, y) => y >= 760 && x >= bodyL(y) && x <= bodyR(y);

const polyDist = (x, y, pts) => {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
};
const polyAng = (x, y, pts) => {
  let best = 1e9, ang = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) { best = d; ang = Math.atan2(dy, dx); }
  }
  return ang;
};

const PATH_PTS = [[14, 892], [96, 862], [52, 826], [128, 792], [222, 806], [246, 762], [176, 732], [216, 700], [160, 668]];
const RIVER = [[838, 648], [920, 664], [1010, 690], [1120, 724], [1200, 758]];

/* ---------------- element buffers ---------------- */
const groups = []; // {id, lines[]}
let cur = null;
const beginG = id => { cur = { id, lines: [] }; groups.push(cur); };
const emit = s => cur.lines.push(s);

const f1 = n => (Math.round(n * 10) / 10);
let strokeCount = 0, fillCount = 0, circleCount = 0;
const qa = []; // {kind:'s'|'f', pts:[[x,y,w]...], color, alpha}

function arcStroke(g, x, y, ang, len, w, color, alpha, bend = 0) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const px = -dy, py = dx;
  const mx = x + dx * len / 2, my = y + dy * len / 2;
  const cx = mx + px * bend * len, cy = my + py * bend * len;
  const ex = x + dx * len, ey = y + dy * len;
  emit(`<path d="M${f1(x)} ${f1(y)}Q${f1(cx)} ${f1(cy)} ${f1(ex)} ${f1(ey)}" fill="none" stroke="${toHex(color)}" stroke-width="${f1(w)}" stroke-linecap="round" opacity="${f1(alpha)}"/>`);
  strokeCount++;
  qa.push({ kind: 's', x, y, cx, cy, ex, ey, w, color, alpha });
}

// 锥形笔触：沿弧线宽度渐细的填充薄片
function taperStroke(g, x, y, ang, len, w, color, alpha, bend = 0) {
  const N = 6, left = [], right = [], mid = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const bx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x + (cx0(x, y, ang, len, bend) - x)) + t * t * ex0(x, y, ang, len, bend);
    void bx;
    const px = qpt(x, y, ang, len, bend, t);
    const pd = qder(x, y, ang, len, bend, t);
    const nrm = Math.atan2(pd[1], pd[0]) + Math.PI / 2;
    const ww = w * (1 - t) * 0.5 + 0.15;
    left.push([px[0] + Math.cos(nrm) * ww, px[1] + Math.sin(nrm) * ww]);
    right.push([px[0] - Math.cos(nrm) * ww, px[1] - Math.sin(nrm) * ww]);
    mid.push([px[0], px[1], ww * 2]);
  }
  const d = 'M' + left.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L') + 'L' + right.reverse().map(p => `${f1(p[0])} ${f1(p[1])}`).join('L') + 'Z';
  emit(`<path d="${d}" fill="${toHex(color)}" opacity="${f1(alpha)}"/>`);
  fillCount++;
  qa.push({ kind: 'f', mid, color, alpha });
}
function cx0(x, y, ang, len, bend) { return x + Math.cos(ang) * len / 2 - Math.sin(ang) * bend * len * 2; }
function ex0(x, y, ang, len, bend) { return x + Math.cos(ang) * len; }
function qpt(x, y, ang, len, bend, t) {
  const x0 = x, y0 = y, x1 = cx0(x, y, ang, len, bend), y1 = y + Math.sin(ang) * len / 2 + Math.cos(ang) * bend * len * 2, x2 = ex0(x, y, ang, len, bend), y2 = y + Math.sin(ang) * len;
  return [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y2];
}
function qder(x, y, ang, len, bend, t) {
  const x1 = cx0(x, y, ang, len, bend) - x, y1 = y + Math.sin(ang) * len / 2 + Math.cos(ang) * bend * len * 2 - y, x2 = ex0(x, y, ang, len, bend) - x, y2 = Math.sin(ang) * len;
  return [2 * (1 - t) * x1 + 2 * t * (x2 - x1), 2 * (1 - t) * y1 + 2 * t * (y2 - y1)];
}
function dot(g, x, y, r, color, alpha) {
  emit(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${toHex(color)}" opacity="${f1(alpha)}"/>`);
  circleCount++;
  qa.push({ kind: 'f', mid: [[x, y, r * 2]], color, alpha });
}

/* ---------------- layer framework ---------------- */
function paint(id, n, bbox, inside, make) {
  beginG(id);
  const [x0, y0, x1, y1] = bbox;
  for (let i = 0; i < n; i++) {
    const x = rand(x0, x1), y = rand(y0, y1);
    const r = inside(x, y);
    if (!r) continue;
    make(x, y, r);
  }
}

/* 面部明暗场：光自观者左上方，sfumato 平滑 */
function faceShade(x, y) {
  const u = (x - FC.x) / FC.rx, v = (y - FC.y) / FC.ry;
  let s = 0.5 + (0.95 * u + 0.3 * v - 0.14) * 1.0;
  if (v > 0.5) s += (v - 0.5) * 1.1;                 // 下颌/下巴阴影
  if (v < -0.62) s += (-0.62 - v) * 0.9;             // 额顶渐暗入发际
  s += (vnoise(x / 46, y / 46) - 0.5) * 0.16;        // 邻近色抖动
  return Math.max(0, Math.min(1, s));
}
const faceColor = (x, y) => jit(mix3(P.skinLt, P.skinMid, P.skinDeep, faceShade(x, y)), 10);
const faceFlow = (x, y) => {                          // 沿体积的切向（混入横向，避免同心环）
  const nx = (x - FC.x) / (FC.rx * FC.rx), ny = (y - FC.y) / (FC.ry * FC.ry);
  let a = Math.atan2(-nx, ny);
  if (Math.cos(a) < 0) a += Math.PI;                  // 统一向右包裹
  const h = Math.atan2(0.12, 1);                      // 横向基准
  let b = a + 0.35 * (h - a);                         // 混入横向
  return b + (vnoise(x / 26, y / 26) - 0.5) * 0.9 + 0.1; // 更大抖动打散环纹
};

/* ============================================================
   L0 底层：全幅暗底笔触（打底，无平涂）
============================================================ */
paint('ground', 3000, [0, 0, W, H], () => 1, (x, y) => {
  const t = y / H;
  const c = jit(mix(P.ground, P.groundWarm, vnoise(x / 90, y / 90) * 0.8), 9);
  arcStroke(cur, x, y, rand(-0.4, 0.4) + (t > 0.6 ? rand(-1.2, 1.2) : 0), rand(12, 28), rand(2.2, 4.5), c, rand(0.5, 0.7));
});

/* ============================================================
   L1 天空 + 雾霭（蓝灰空气透视）
============================================================ */
paint('sky', 2900, [0, 0, W, 540], (x, y) => (y < 520 ? 1 : 0), (x, y) => {
  const t = y / 520;
  const c = jit(mix3(P.skyTop, P.skyMid, P.skyHaze, t * t), 9);
  arcStroke(cur, x, y, (vnoise(x / 120, y / 60) - 0.5) * 0.5, rand(16, 34), rand(2.4, 4.4), c, rand(0.42, 0.58));
});
paint('haze', 520, [0, 430, W, 585], (x, y) => 1, (x, y) => {
  const c = jit(mix(P.skyHaze, hx('#d8c898'), vnoise(x / 60, y / 40)), 8);
  arcStroke(cur, x, y, (vnoise(x / 90, y / 30) - 0.5) * 0.35, rand(20, 40), rand(2, 4), c, rand(0.22, 0.38));
});

/* ============================================================
   L2 远山（左右不对称，右侧更高更远）
============================================================ */
paint('mtn-right', 1250, [760, 440, W, 600], (x, y) => {
  const ridge = 560 - 68 * Math.sin((x - 760) / 150) - 30 * vnoise(x / 60, 3);
  return y > ridge && y < 600 ? (y - ridge) : 0;
}, (x, y, d) => {
  const t = Math.min(1, d / 90);
  const c = jit(mix3(P.mtnFar, P.mtnMid, P.mtnNear, t), 10);
  const ang = 0.16 * Math.cos((x - 760) / 150) + (vnoise(x / 50, y / 50) - 0.5) * 0.4;
  arcStroke(cur, x, y, ang, rand(10, 22), rand(1.8, 3.4), c, rand(0.48, 0.68));
});
paint('mtn-left', 900, [0, 450, 420, 590], (x, y) => {
  const ridge = 545 - 46 * Math.sin(x / 110 + 1.2) - 26 * vnoise(x / 55, 7);
  return y > ridge && y < 590 ? (y - ridge) : 0;
}, (x, y, d) => {
  const t = Math.min(1, d / 80);
  const c = jit(mix3(P.mtnFar, P.mtnMid, P.mtnNear, t), 10);
  arcStroke(cur, x, y, -0.12 * Math.sin(x / 110 + 1.2) + (vnoise(x / 46, y / 46) - 0.5) * 0.4, rand(9, 20), rand(1.8, 3.4), c, rand(0.48, 0.68));
});

/* ============================================================
   L3 水体：左侧湖带 + 右侧河流（蜿蜒向远）
============================================================ */
paint('lake-left', 750, [0, 565, 340, 690], (x, y) => (y > 575 + 22 * vnoise(x / 40, 2) && y < 690) ? 1 : 0, (x, y) => {
  const c = jit(mix(P.water, P.waterLt, vnoise(x / 50, y / 20)), 8);
  arcStroke(cur, x, y, (vnoise(x / 60, y / 24) - 0.5) * 0.22, rand(12, 26), rand(1.6, 3), c, rand(0.48, 0.66));
});
paint('river-right', 800, [820, 620, W, 800], (x, y) => {
  const d = polyDist(x, y, RIVER);
  const widen = 12 + (x - 838) * 0.16;
  return d < widen ? 1 - d / widen : 0;
}, (x, y, w) => {
  const c = jit(mix(P.waterLt, P.mtnFar, vnoise(x / 40, y / 40)), 8);
  const ang = polyAng(x, y, RIVER) + (vnoise(x / 30, y / 30) - 0.5) * 0.3;
  arcStroke(cur, x, y, ang, rand(10, 22), rand(1.2, 2.4), c, rand(0.42, 0.66) * (0.5 + w * 0.5));
});

/* ============================================================
   L4 右侧拱桥（雾中淡赭灰）
============================================================ */
beginG('bridge');
for (let i = 0; i < 5; i++) {
  const bx = 985 + i * 30;
  taperStroke(cur, bx, 612 - i * 4, -0.14, 30, 5, jit(P.bridge, 8), 0.5, 0.16);
  arcStroke(cur, bx + 12, 616 - i * 4, 1.45, 14, 2.4, jit(P.bridge, 6), 0.45);
}
for (let i = 0; i < 26; i++) {
  const x = rand(975, 1130), y = rand(588, 626);
  arcStroke(cur, x, y, -0.12 + rand(-0.15, 0.15), rand(6, 14), rand(1, 2), jit(mix(P.bridge, P.mtnMid, 0.4), 8), rand(0.25, 0.45));
}

/* ============================================================
   L5 左岸岩体 + 蜿蜒小径 + 右侧赭色崖壁
============================================================ */
paint('rocks-left', 1900, [0, 600, 330, 1010], (x, y) => {
  const top = 640 + 120 * (1 - x / 330) + 40 * vnoise(x / 45, y / 45) - 60;
  if (polyDist(x, y, PATH_PTS) < 26) return 0;
  return y > top - 120 ? 1 : 0;
}, (x, y) => {
  const t = vnoise(x / 55, y / 55);
  const c = jit(mix3(P.rockDark, P.rockL, P.rockRust, t), 12);
  const ang = (t - 0.5) * 1.6 + Math.PI * (vnoise(x / 30, y / 70) > 0.5 ? 0 : 1);
  arcStroke(cur, x, y, ang, rand(8, 18), rand(1.8, 3.6), c, rand(0.48, 0.68));
});
paint('path-left', 500, [0, 640, 260, 920], (x, y) => {
  const d = polyDist(x, y, PATH_PTS);
  return d < 24 ? 1 - d / 24 : 0;
}, (x, y, w) => {
  const c = jit(mix(P.path, P.pathLt, vnoise(x / 20, y / 20)), 10);
  const ang = polyAng(x, y, PATH_PTS) + (vnoise(x / 18, y / 18) - 0.5) * 0.5;
  arcStroke(cur, x, y, ang, rand(7, 15), rand(1.2, 2.6), c, rand(0.45, 0.7) * (0.4 + w * 0.6));
});
paint('cliff-right', 1300, [960, 640, W, 940], (x, y) => {
  const top = 700 - 60 * vnoise(x / 60, 11) + (x - 960) * 0.1;
  return y > top ? 1 : 0;
}, (x, y) => {
  const t = vnoise(x / 50, y / 50);
  const c = jit(mix3(P.rockDark, P.cliff, P.cliffLt, t), 12);
  arcStroke(cur, x, y, 0.5 + (t - 0.5) * 1.2, rand(8, 17), rand(1.8, 3.4), c, rand(0.48, 0.68));
});

/* ============================================================
   L6 矮墙/地台（人物身后深色横带）+ 左缘立柱
============================================================ */
paint('parapet', 650, [0, 900, W, 1010], (x, y) => (y > 925 && y < 1000 && (x < 300 || x > 900)) ? 1 : 0, (x, y) => {
  const c = jit(mix(P.parapet, P.rockDark, vnoise(x / 40, y / 40)), 9);
  arcStroke(cur, x, y, (vnoise(x / 60, y / 20) - 0.5) * 0.2, rand(12, 24), rand(1.8, 3.4), c, rand(0.48, 0.68));
});
paint('column-left', 90, [24, 800, 92, 950], (x, y) => (x > 30 + 10 * vnoise(y / 30, 0) && x < 84) ? 1 : 0, (x, y) => {
  const c = jit(P.rockDark, 8);
  arcStroke(cur, x, y, 1.5 + (vnoise(x / 12, y / 40) - 0.5) * 0.4, rand(8, 16), rand(1.4, 2.6), c, rand(0.4, 0.6));
});

/* ============================================================
   L7 头发后层（深栗色长发，两侧垂落）
============================================================ */
const hairInside = (x, y) => {
  if (inEl(x, y, HC) && edge(x, y, FC) < 1.02 && y < 620) return 0;      // 让开脸部
  if (inEl(x, y, HC, 1.04)) return 1 + vnoise(x / 40, y / 40) * 0.4;
  if (inEl(x, y, FALL_L, 1.05)) return 1;
  if (inEl(x, y, FALL_R, 1.05)) return 1;
  return 0;
};
const hairFlow = (x, y) => {
  const dx = x - PART.x, dy = y - PART.y;
  let a = Math.atan2(dy, dx);
  const down = Math.PI / 2;
  a = a + (down - a) * 0.42;                                             // 向垂落方向偏转
  return a + (vnoise(x / 34, y / 34) - 0.5) * 0.55;
};
paint('hair-back', 3500, [300, 130, 850, 930], hairInside, (x, y) => {
  const t = vnoise(x / 26, y / 26);
  const c = jit(mix3(P.hair, P.hairRed, P.hairHi, t * t * 0.8), 11);
  const lit = (x < 470 && y > 300 && y < 620) || (x > 660 && y > 300 && y < 560) ? 1.15 : 1;
  arcStroke(cur, x, y, hairFlow(x, y), rand(12, 28) * lit, rand(1.6, 3.2), c, rand(0.48, 0.68));
});

/* ============================================================
   L8 身体：裙衣主体（橄榄褐深调，沿体积方向）
============================================================ */
paint('dress', 3600, [40, 760, 1180, 1600], (x, y) => {
  if (!inBody(x, y)) return 0;
  if (y < NL(x) + 6 && x > 380 && x < 800) return 0;                     // 让开胸口
  if (inEl(x, y, { x: 566, y: 1330, rx: 200, ry: 110 })) return 0;       // 让开手部
  return 1;
}, (x, y) => {
  const u = (x - 560) / 560, v = (y - 800) / 800;
  let s = 0.42 + u * 0.55 + v * 0.25;
  s += (vnoise(x / 60, y / 60) - 0.5) * 0.3;
  s = Math.max(0, Math.min(1, s));
  const c = jit(mix3(P.dressFold, P.dress, P.dressDark, s), 9);
  const ang = Math.atan2((y - 700), (x - 560) * 0.6) * 0.5 + 1.1 + (vnoise(x / 40, y / 40) - 0.5) * 0.6;
  arcStroke(cur, x, y, ang, rand(10, 24), rand(2, 4), c, rand(0.48, 0.66));
});
// 披挂薄纱从左肩斜下（灰绿褶皱）
paint('mantle-fold', 560, [560, 780, 1060, 1120], (x, y) => {
  const band = 880 + (x - 560) * 0.42;
  return Math.abs(y - band) < 46 + 22 * vnoise(x / 50, y / 50) ? 1 : 0;
}, (x, y) => {
  const c = jit(mix(P.mantle, P.dressAlt, vnoise(x / 30, y / 30)), 9);
  arcStroke(cur, x, y, 0.42 + (vnoise(x / 26, y / 26) - 0.5) * 0.35, rand(12, 26), rand(1.4, 2.8), c, rand(0.36, 0.55));
});
// 领口金线刺绣（连环小弧）
beginG('yoke-embroidery');
for (let x = 402; x < 786; x += 7) {
  const y = NL(x) - 8 + 4 * Math.sin(x / 12);
  arcStroke(cur, x, y, Math.atan2(NL(x + 4) - NL(x - 4), 8) + Math.PI / 2, 6, 1.3, jit(P.gold, 8), rand(0.4, 0.6), 0.4);
}
for (let x = 408; x < 780; x += 14) {
  const y = NL(x) - 20 + 5 * Math.sin(x / 18);
  arcStroke(cur, x, y, 0.2 + Math.sin(x / 30) * 0.3, 9, 1.2, jit(P.goldLt, 8), rand(0.28, 0.45), 0.5);
}

/* ============================================================
   L9 颈部与胸口皮肤（暖赭分层）
============================================================ */
paint('neck-chest', 2000, [380, 600, 800, 930], (x, y) => {
  const inNeck = y < 780 && Math.abs(x - 572) < 80 + (y - 600) * 0.12 && y > 600 && edge(x, y, FC) > 0.86;
  const inChest = y >= 700 && y < NL(x) && x > 390 && x < 800;
  if (inEl(x, y, FALL_L) || inEl(x, y, FALL_R)) return 0;
  return (inNeck || inChest) ? 1 : 0;
}, (x, y) => {
  const u = (x - 545) / 220, v = (y - 660) / 260;
  let s = 0.45 + u * 0.5 + Math.max(0, 0.75 - v) * 0.55;                  // 喉下阴影、右缘暗
  s += (vnoise(x / 40, y / 40) - 0.5) * 0.18;
  s = Math.max(0, Math.min(1, s));
  const c = jit(mix3(P.skinLt, P.skinMid, P.skinShadow, s), 9);
  const ang = 1.35 + (vnoise(x / 30, y / 30) - 0.5) * 0.5 + (x > 600 ? 0.3 : -0.15);
  arcStroke(cur, x, y, ang, rand(8, 18), rand(1.2, 2.6), c, rand(0.36, 0.55));
});

/* ============================================================
   L10 面部：基底 + 三层晕染（sfumato）
============================================================ */
paint('face-base', 3200, [425, 215, 705, 650], (x, y) => (edge(x, y, FC) < 1.08 ? 1 : 0), (x, y) => {
  const c = faceColor(x, y);
  const fade = Math.min(1, (1.08 - edge(x, y, FC)) * 5.5);                // 边界柔化（sfumato）
  arcStroke(cur, x, y, faceFlow(x, y), rand(6, 12), rand(1.2, 2.2), c, rand(0.34, 0.5) * fade);
});
paint('face-model1', 2100, [425, 215, 705, 650], (x, y) => (edge(x, y, FC) < 1.05 ? 1 : 0), (x, y) => {
  const s = faceShade(x, y);
  const c = jit(mix3(P.skinLt, P.blush, P.skinDeep, s), 8);
  const fade = Math.min(1, (1.05 - edge(x, y, FC)) * 5.5);
  arcStroke(cur, x, y, faceFlow(x, y) + rand(-0.2, 0.2), rand(5, 10), rand(1, 2), c, rand(0.24, 0.4) * fade);
});
paint('face-model2', 1900, [430, 220, 700, 645], (x, y) => {
  if (!inEl(x, y, FC)) return 0;
  const s = faceShade(x, y);
  return s > 0.55 ? (s - 0.55) : 0;                                       // 暗部加密
}, (x, y, w) => {
  const c = jit(mix(P.skinDeep, P.skinShadow, vnoise(x / 26, y / 26)), 8);
  arcStroke(cur, x, y, faceFlow(x, y) + rand(-0.2, 0.2), rand(5, 11), rand(0.9, 1.8), c, Math.min(0.5, rand(0.22, 0.36) * (0.5 + w * 2)));
});
paint('face-light', 700, [430, 240, 700, 640], (x, y) => {
  if (!inEl(x, y, FC)) return 0;
  const s = faceShade(x, y);
  return s < 0.38 ? (0.38 - s) : 0;                                       // 亮部提暖
}, (x, y, w) => {
  const c = jit(mix(P.skinLt, hx('#f0d8a8'), vnoise(x / 22, y / 22)), 7);
  arcStroke(cur, x, y, faceFlow(x, y) + rand(-0.2, 0.2), rand(5, 10), rand(0.9, 1.8), c, Math.min(0.4, rand(0.18, 0.32) * (0.5 + w * 2.4)));
});
// 颏下投影（头在颈上投下的柔和阴影）
paint('chin-shadow', 320, [450, 600, 690, 700], (x, y) => {
  const d = Math.hypot((x - 566) / 96, (y - 650) / 34);
  return d < 1 ? 1 - d : 0;
}, (x, y, w) => {
  const c = jit(mix(P.skinShadow, P.dressDark, 0.35 + vnoise(x / 20, y / 20) * 0.3), 7);
  arcStroke(cur, x, y, 0.12 + rand(-0.3, 0.3), rand(6, 12), rand(1.2, 2.2), c, rand(0.3, 0.48) * w);
});
// 颊部暖晕
paint('cheek-blush', 160, [440, 400, 700, 560], (x, y) => {
  const dL = Math.hypot((x - 492) / 52, (y - 478) / 44), dR = Math.hypot((x - 648) / 46, (y - 468) / 40);
  return (dL < 1 ? 1 - dL : 0) + (dR < 1 ? (1 - dR) * 0.5 : 0);
}, (x, y, w) => {
  const c = jit(mix(P.blush, P.skinMid, vnoise(x / 20, y / 20)), 7);
  arcStroke(cur, x, y, faceFlow(x, y) + 0.3, rand(5, 10), rand(0.9, 1.6), c, rand(0.1, 0.2) * w);
});

/* ============================================================
   L11 五官（眼/眉/鼻/口——神秘微笑的关键在嘴角晕影）
============================================================ */
beginG('features');
const EYE = [{ x: 507, y: 372, s: 1 }, { x: 629, y: 369, s: -1 }];
for (const e of EYE) {
  const uw = 30, lh = 9;
  for (let i = 0; i < 26; i++) {                                          // 上眼睑弧
    const t = rand(0, 1), x = e.x + (t - 0.5) * 2 * uw;
    const y = e.y - Math.cos((t - 0.5) * Math.PI) * 0 - lh * (1 - ((t - 0.5) * 2) ** 2) + 1;
    const ang = Math.atan2(lh * 2 * Math.sin((t - 0.5) * 2) * -1, uw);
    taperStroke(cur, x, y + rand(-1.5, 1.5), Math.sin((t - 0.5) * 2) * 0.5 - 0.06, rand(4, 9), rand(1.6, 2.6), jit(mix(P.skinShadow, P.eyeDark, 0.55 + e.s * (t - 0.5) * 0.2), 7), rand(0.45, 0.7), 0.18);
  }
  for (let i = 0; i < 16; i++) {                                          // 下眼睑
    const t = rand(0, 1), x = e.x + (t - 0.5) * 2 * (uw * 0.9);
    taperStroke(cur, x, e.y + lh * 0.75 + rand(-1, 1.6), 0.08 * e.s, rand(4, 8), rand(1.2, 2), jit(mix(P.skinDeep, P.blush, 0.5), 7), rand(0.25, 0.4), -0.16);
  }
  dot(cur, e.x - e.s * 1, e.y + 1, 8.5, jit(P.eyeDark, 5), 0.85);          // 瞳
  dot(cur, e.x - e.s * 1, e.y + 1, 11, jit(mix(P.eyeDark, P.hairRed, 0.5), 5), 0.6);
  arcStroke(cur, e.x - 15, e.y - 1, 0.1, 30, 2.2, jit(mix(P.eyeDark, P.hairRed, 0.3), 5), 0.72, 0.12); // 睑裂暗线
  for (let i = 0; i < 14; i++) {                                          // 眼窝晕影
    const a = rand(0, Math.PI * 2), r = rand(16, 30);
    arcStroke(cur, e.x + Math.cos(a) * r * 1.25, e.y + Math.sin(a) * r * 0.8 - 4, faceFlow(e.x, e.y) + rand(-0.3, 0.3), rand(5, 10), rand(1.2, 2), jit(mix(P.skinDeep, P.skinShadow, 0.6), 7), rand(0.2, 0.32));
  }
  for (let i = 0; i < 12; i++) {                                          // 淡眉（原作眉极淡）
    const t = rand(0, 1), x = e.x + (t - 0.5) * 2 * 30;
    arcStroke(cur, x, e.y - 26 - 4 * (1 - ((t - 0.5) * 2) ** 2) + rand(-2, 2), 0.06 * e.s, rand(5, 10), rand(0.9, 1.4), jit(mix(P.hairRed, P.skinDeep, 0.5), 6), rand(0.14, 0.24), 0.1);
  }
  for (let i = 0; i < 14; i++) {                                          // 眼睑褶（眼上方弧形暗线）
    const t = rand(0, 1), x = e.x + (t - 0.5) * 2 * 32;
    arcStroke(cur, x, e.y - 15 - 6 * (1 - ((t - 0.5) * 2) ** 2) + rand(-1.5, 1.5), 0.05 * e.s, rand(6, 11), rand(1.4, 2.2), jit(mix(P.skinShadow, P.eyeDark, 0.35), 6), rand(0.3, 0.46), 0.14);
  }
}
// 鼻：桥亮、右缘影、鼻翼与鼻孔暗示
for (let i = 0; i < 34; i++) {
  const y = rand(380, 470), x = 556 + rand(-4, 4);
  arcStroke(cur, x, y, 1.5 + rand(-0.12, 0.12), rand(7, 13), rand(1, 1.8), jit(mix(P.skinLt, P.skinMid, 0.3), 7), rand(0.16, 0.3));
}
for (let i = 0; i < 46; i++) {
  const y = rand(388, 486), x = 574 + rand(0, 12) + (y - 388) * 0.06;
  arcStroke(cur, x, y, 1.45 + rand(-0.15, 0.15), rand(6, 12), rand(1.2, 2.2), jit(P.skinShadow, 8), rand(0.26, 0.42));
}
taperStroke(cur, 534, 486, 0.5, 20, 4.5, jit(P.skinShadow, 6), 0.4, 0.3);
taperStroke(cur, 578, 484, -0.5, 20, 4.5, jit(P.skinShadow, 6), 0.42, -0.3);
dot(cur, 537, 489, 3.4, jit(P.eyeDark, 4), 0.5);
dot(cur, 581, 487, 3.4, jit(P.eyeDark, 4), 0.5);
arcStroke(cur, 545, 470, 0.9, 16, 2, jit(P.skinLt, 6), 0.3, 0.2);          // 鼻尖光
// 口：唇线微波、嘴角暗晕 = 微笑
const ML = (t) => [505 + t * 112, 556 - Math.sin(t * Math.PI) * 7 + Math.sin(t * Math.PI * 2) * 1.5];
taperStroke(cur, 505, 557, Math.atan2(ML(0.06)[1] - ML(0)[1], ML(0.06)[0] - ML(0)[0]), 114, 4.6, jit(mix(P.lipDim, P.eyeDark, 0.6), 5), 0.6, 0.055); // 主唇线
for (let i = 0; i < 30; i++) {
  const t = rand(0, 1), [x, y] = ML(t);
  const ang = Math.atan2(ML(0.51)[1] - ML(0.49)[1], ML(0.51)[0] - ML(0.49)[0]) + rand(-0.1, 0.1);
  taperStroke(cur, x, y + rand(-1.2, 1.2), ang, rand(5, 10), rand(1.6, 2.6), jit(mix(P.lipDim, P.eyeDark, 0.55), 6), rand(0.5, 0.72), 0.1);
}
for (let i = 0; i < 22; i++) {                                            // 下唇受光
  const t = rand(0.12, 0.88), [x, y] = ML(t);
  arcStroke(cur, x + rand(-3, 3), y + rand(6, 14), 0.06, rand(5, 10), rand(1.2, 2), jit(mix(P.lip, P.skinLt, 0.45), 7), rand(0.2, 0.34), -0.12);
}
for (let i = 0; i < 14; i++) {                                            // 上唇暗
  const t = rand(0.15, 0.85), [x, y] = ML(t);
  arcStroke(cur, x, y - rand(5, 11), 0.04, rand(4, 8), rand(1, 1.6), jit(P.lipDim, 6), rand(0.16, 0.3), 0.14);
}
for (const s of [[506, 556, 1], [617, 551, -1]]) {                        // 嘴角阴影（笑的关键）
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2), r = rand(3, 15);
    arcStroke(cur, s[0] + Math.cos(a) * r, s[1] + Math.sin(a) * r * 0.8 - 1, s[2] * 0.7 + rand(-0.4, 0.4), rand(3, 7), rand(1, 1.8), jit(mix(P.skinShadow, P.lipDim, 0.4), 6), rand(0.2, 0.34));
  }
}
// 下巴与颌侧晕影
for (let i = 0; i < 80; i++) {
  const t = rand(0, 1), x = 516 + t * 104;
  arcStroke(cur, x, 616 + 14 * Math.sin(t * Math.PI) + rand(-7, 7), 0.1 + rand(-0.2, 0.2), rand(5, 11), rand(1.2, 2.2), jit(mix(P.skinDeep, P.skinShadow, 0.55), 7), rand(0.22, 0.36));
}
for (let i = 0; i < 70; i++) {
  const y = rand(330, 600), x = 668 + rand(0, 22) - (y - 460) * 0.1;
  arcStroke(cur, x, y, faceFlow(x, y), rand(5, 10), rand(1, 1.8), jit(P.skinShadow, 7), rand(0.12, 0.24));
}

/* ============================================================
   L12 前发缕（覆肩垂发）+ 薄纱（头纱与额际纱边）
============================================================ */
paint('hair-front', 1050, [320, 300, 860, 940], (x, y) => {
  const inL = inEl(x, y, { x: 428, y: 640, rx: 46, ry: 300 }) && x < 470;
  const inR = inEl(x, y, { x: 722, y: 620, rx: 50, ry: 310 });
  return (inL || inR) ? 1 : 0;
}, (x, y) => {
  const c = jit(mix3(P.hair, P.hairRed, P.hairHi, vnoise(x / 24, y / 24) ** 2), 10);
  const a = hairFlow(x, y) * 0.5 + 1.5 + (vnoise(x / 26, y / 26) - 0.5) * 0.5;
  arcStroke(cur, x, y, a, rand(14, 30), rand(1.2, 2.6), c, rand(0.44, 0.66));
});
paint('veil-crown', 480, [370, 140, 770, 300], (x, y) => {
  const e = { x: 566, y: 300, rx: 196, ry: 160 };
  return inEl(x, y, e) && y < 300 ? 1 : 0;
}, (x, y) => {
  const c = jit(mix(P.veil, P.veilDim, vnoise(x / 30, y / 30)), 9);
  const nx = (x - 566) / 196, ny = (y - 300) / 160;
  const ang = Math.atan2(-nx, ny) + (vnoise(x / 24, y / 24) - 0.5) * 0.4;
  arcStroke(cur, x, y, ang, rand(8, 16), rand(1, 2), c, rand(0.16, 0.3));
});
// 额际纱边弧线 + 垂纱边缘（右肩外缘的半透明纱）
beginG('veil-edge');
for (let i = 0; i < 46; i++) {
  const t = rand(0, 1), x = 448 + t * 240, y = 252 - Math.sin(t * Math.PI) * 26 + rand(-3, 3);
  arcStroke(cur, x, y, -0.1 + Math.cos(t * Math.PI) * 0.25, rand(7, 13), rand(1.4, 2.4), jit(P.veil, 8), rand(0.45, 0.65), 0.1);
}
for (let i = 0; i < 60; i++) {
  const t = rand(0, 1), x = 700 + t * 130, y = 300 + t * 380 + rand(-14, 14);
  arcStroke(cur, x, y, 1.25 + (vnoise(x / 30, y / 30) - 0.5) * 0.4, rand(10, 20), rand(1.2, 2.4), jit(P.veilDim, 9), rand(0.16, 0.3));
}

/* ============================================================
   L13 袖子（金赭褶皱）与交叠的双手
============================================================ */
paint('sleeve-left', 980, [120, 1040, 540, 1360], (x, y) => {
  const d = polyDist(x, y, [[168, 1082], [252, 1226], [420, 1308], [516, 1330]]);
  return d < 88 ? 1 - d / 88 : 0;
}, (x, y, w) => {
  const t = vnoise(x / 34, y / 34);
  const c = jit(mix3(P.sleeveDeep, P.sleeveGold, P.goldLt, t), 11);
  const ang = polyAng(x, y, [[168, 1082], [252, 1226], [420, 1308], [516, 1330]]) + Math.PI / 2 * (t > 0.5 ? 1 : -1) * 0.6 + 0.5;
  arcStroke(cur, x, y, ang, rand(9, 20), rand(1.4, 3), c, rand(0.38, 0.58) * (0.5 + w * 0.5));
});
paint('sleeve-right', 1000, [600, 1240, 1010, 1540], (x, y) => {
  const d = polyDist(x, y, [[986, 1246], [830, 1362], [652, 1442]]);
  return d < 100 ? 1 - d / 100 : 0;
}, (x, y, w) => {
  const t = vnoise(x / 36, y / 36);
  const c = jit(mix3(P.sleeveDeep, P.sleeveGold, P.goldLt, t * t), 11);
  const ang = polyAng(x, y, [[986, 1246], [830, 1362], [652, 1442]]) + 1.2 + (t - 0.5) * 0.8;
  arcStroke(cur, x, y, ang, rand(9, 22), rand(1.4, 3), c, rand(0.38, 0.58) * (0.5 + w * 0.5));
});

// —— 手：底层（她的左手，垫在下方）
const HAND_B = { x: 372, y: 1424, rx: 118, ry: 62 };
paint('hand-bottom', 700, [240, 1340, 520, 1520], (x, y) => (inEl(x, y, HAND_B) ? 1 : 0), (x, y) => {
  const u = (x - HAND_B.x) / HAND_B.rx, v = (y - HAND_B.y) / HAND_B.ry;
  let s = 0.45 + u * 0.4 + v * 0.55 + (vnoise(x / 26, y / 26) - 0.5) * 0.2;
  s = Math.max(0, Math.min(1, s));
  const c = jit(mix3(P.skinLt, P.skinMid, P.skinShadow, s), 9);
  arcStroke(cur, x, y, 0.35 + (v - 0.5) * 0.4 + rand(-0.2, 0.2), rand(6, 13), rand(1, 2.2), c, rand(0.36, 0.54));
});
// 下手的指节（向左侧卷曲的手指）
const FB = [[452, 1392, 336, 1436], [444, 1414, 322, 1462], [438, 1436, 330, 1490], [446, 1458, 352, 1512]];
for (const [ax, ay, bx, by] of FB) {
  for (let i = 0; i < 36; i++) {
    const t = rand(0, 1);
    const x = ax + (bx - ax) * t + rand(-7, 7), y = ay + (by - ay) * t + Math.sin(t * Math.PI) * 10 + rand(-5, 5);
    const ang = Math.atan2(by - ay, bx - ax) + rand(-0.25, 0.25);
    arcStroke(cur, x, y, ang, rand(5, 11), rand(1, 2), jit(mix(P.skinMid, P.skinLt, 1 - t * 0.6), 8), rand(0.26, 0.44));
  }
  taperStroke(cur, ax - 6, ay + 2, Math.atan2(by - ay, bx - ax), Math.hypot(bx - ax, by - ay), 16, jit(mix(P.skinMid, P.skinDeep, 0.4), 6), 0.2, 0.05);
}
// —— 手：上层（她的右手，搭在左腕上）
const HAND_T = { x: 560, y: 1316, rx: 152, ry: 74 };
paint('hand-top', 830, [400, 1230, 740, 1420], (x, y) => {
  if (!inEl(x, y, HAND_T)) return 0;
  const u = (x - 545) / 200;
  return 1;
}, (x, y) => {
  const u = (x - HAND_T.x) / HAND_T.rx, v = (y - HAND_T.y) / HAND_T.ry;
  let s = 0.42 - u * 0.28 + v * 0.5 + (vnoise(x / 26, y / 26) - 0.5) * 0.18;
  s = Math.max(0, Math.min(1, s));
  const c = jit(mix3(P.skinLt, hx('#dcb87f'), P.skinDeep, s), 9);
  arcStroke(cur, x, y, 0.5 + (vnoise(x / 30, y / 30) - 0.5) * 0.5, rand(6, 14), rand(1, 2.2), c, rand(0.36, 0.54));
});
// 上手的四指：沿指轴排布 + 锥形指形
const FT = [
  [596, 1330, 700, 1396], [574, 1348, 668, 1424], [548, 1360, 632, 1442], [520, 1368, 590, 1448],
];
for (const [ax, ay, bx, by] of FT) {
  const L = Math.hypot(bx - ax, by - ay), baseAng = Math.atan2(by - ay, bx - ax);
  for (let i = 0; i < 46; i++) {
    const t = rand(0, 1);
    const x = ax + (bx - ax) * t + rand(-4, 4);
    const y = ay + (by - ay) * t + Math.sin(t * Math.PI) * 4 + rand(-9, 9);
    const s = 0.35 + t * 0.3 + (vnoise(x / 18, y / 18) - 0.5) * 0.3;
    arcStroke(cur, x, y, baseAng + rand(-0.3, 0.3), rand(5, 11), rand(1, 1.9), jit(mix3(P.skinLt, P.skinMid, P.skinDeep, Math.max(0, Math.min(1, s))), 8), rand(0.26, 0.46));
  }
  taperStroke(cur, ax, ay - 8, baseAng, L * 1.02, 20, jit(mix(P.skinMid, P.skinLt, 0.4), 5), 0.16, 0.06);
  taperStroke(cur, bx - 14, by - 8, baseAng, 26, 10, jit(P.skinShadow, 5), 0.3, 0.1);          // 指尖阴影
}
taperStroke(cur, 470, 1272, 0.9, 60, 24, jit(mix(P.skinLt, P.skinMid, 0.5), 5), 0.18, 0.2);     // 拇指/腕
// 手底投影（与袖、扶手的交界）
for (let i = 0; i < 130; i++) {
  const a = rand(0, Math.PI * 2), r = rand(60, 190);
  const x = 520 + Math.cos(a) * r * 1.3, y = 1400 + Math.sin(a) * r * 0.45;
  if (x < 180 || x > 800) continue;
  arcStroke(cur, x, y, 0.2 + rand(-0.3, 0.3), rand(8, 16), rand(1.4, 2.8), jit(mix(P.skinShadow, P.dressDark, 0.6), 7), rand(0.14, 0.26));
}
// 扶手（左下角深色斜杆）
paint('armrest', 240, [40, 1430, 620, 1600], (x, y) => {
  const band = 1478 + (x - 40) * 0.14;
  return Math.abs(y - band) < 34 ? 1 : 0;
}, (x, y) => {
  const c = jit(mix(P.parapet, P.dressDark, vnoise(x / 30, y / 30)), 8);
  arcStroke(cur, x, y, 0.14 + (vnoise(x / 26, y / 26) - 0.5) * 0.25, rand(12, 24), rand(1.8, 3.4), c, rand(0.4, 0.6));
});

/* ============================================================
   L14 全局罩染 + 暗角（统一色调，sfumato 收尾）
============================================================ */
paint('glaze', 700, [0, 0, W, H], (x, y) => (vnoise(x / 70, y / 70) > 0.42 ? 1 : 0), (x, y) => {
  const c = jit(mix(P.glaze, P.gold, vnoise(x / 40, y / 40) * 0.5), 8);
  arcStroke(cur, x, y, rand(-0.5, 0.5) + 0.2, rand(14, 30), rand(2, 4), c, rand(0.05, 0.12));
});
paint('vignette', 620, [0, 0, W, H], (x, y) => {
  const d = Math.max(Math.abs(x - 600) / 620, Math.abs(y - 800) / 840);
  return d > 0.82 ? (d - 0.82) * 4 : 0;
}, (x, y, w) => {
  const c = jit(P.vign, 7);
  const ang = Math.atan2(y - 800, x - 600) + Math.PI / 2;
  arcStroke(cur, x, y, ang + rand(-0.3, 0.3), rand(12, 26), rand(2, 4.5), c, Math.min(0.4, rand(0.08, 0.2) * w));
});

/* ============================================================
   组装 SVG
============================================================ */
const parts = [];
parts.push(`<?xml version="1.0" encoding="UTF-8"?>
<!-- Mona Lisa — pure-SVG stroke study (sfumato replica), generated by generator.mjs
     Composition reference: Leonardo da Vinci, "Mona Lisa", Louvre (public domain),
     via Wikimedia Commons C2RMF retouched scan. -->
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
<title>Mona Lisa — SVG 笔触复刻</title>
<desc>数千条短弧与锥形描边模拟罩染与晕涂：赭褐/暗金/橄榄绿/深棕色板，蓝绿空气透视背景，左右不对称山水。</desc>
<!-- imprimatura: 古典油画有色底（仅画布底色，全部形体均由笔触层绘制，无平涂造型） -->
<rect x="0" y="0" width="1200" height="1600" fill="#1e150c"/>`);
for (const g of groups) {
  parts.push(`<g id="${g.id}">\n${g.lines.join('\n')}\n</g>`);
}
parts.push('</svg>\n');
const svg = parts.join('\n');
fs.writeFileSync(path.join(OUT, 'answer.svg'), svg);
console.log(`answer.svg written: ${(svg.length / 1048576).toFixed(2)} MB, strokes=${strokeCount}, tapers=${fillCount}, circles=${circleCount}, total=${strokeCount + fillCount + circleCount}, groups=${groups.length}`);

/* ============================================================
   QA 光栅化（自研，仅用于自查构图，不依赖外部模型）
============================================================ */
if (process.argv.includes('--preview') || process.argv.includes('--face')) {
  const face = process.argv.includes('--face');
  const S = face ? 1 : 2;
  const CX0 = face ? 380 : 0, CY0 = face ? 120 : 0, CW = face ? 400 : W, CH = face ? 620 : H;
  const RW = CW / S, RH = CH / S;
  const buf = new Float32Array(RW * RH * 3);
  for (let i = 0; i < RW * RH; i++) { const g = hx('#1e150c'); buf[i * 3] = g[0]; buf[i * 3 + 1] = g[1]; buf[i * 3 + 2] = g[2]; }
  const stamp = (x, y, r, c, a) => {
    x -= CX0; y -= CY0;
    const x0 = Math.max(0, Math.floor((x - r) / S)), x1 = Math.min(RW - 1, Math.ceil((x + r) / S));
    const y0 = Math.max(0, Math.floor((y - r) / S)), y1 = Math.min(RH - 1, Math.ceil((y + r) / S));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const dx = px * S + S / 2 - x, dy = py * S + S / 2 - y;
      const cov = Math.max(0, Math.min(1, r - Math.hypot(dx, dy) + 0.6)) / Math.max(r, 0.6);
      if (cov <= 0) continue;
      const aa = a * cov, idx = (py * RW + px) * 3;
      buf[idx] = c[0] * aa + buf[idx] * (1 - aa);
      buf[idx + 1] = c[1] * aa + buf[idx + 1] * (1 - aa);
      buf[idx + 2] = c[2] * aa + buf[idx + 2] * (1 - aa);
    }
  };
  const qpt2 = (p0, p1, p2, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  for (const s of qa) {
    if (s.kind === 's') {
      const steps = Math.max(3, Math.round(Math.hypot(s.ex - s.x, s.ey - s.y)));
      for (let i = 0; i <= steps; i++) {
        const [x, y] = qpt2([s.x, s.y], [s.cx, s.cy], [s.ex, s.ey], i / steps);
        stamp(x, y, s.w / 2 + 0.3, s.color, s.alpha);
      }
    } else {
      const m = s.mid;
      for (let i = 0; i < m.length; i++) stamp(m[i][0], m[i][1], m[i][2] / 2 + 0.3, s.color, s.alpha);
      for (let i = 0; i < m.length - 1; i++) {
        const L = Math.hypot(m[i + 1][0] - m[i][0], m[i + 1][1] - m[i][1]);
        for (let j = 0; j < L; j += 2) {
          const t = j / L;
          stamp(m[i][0] + (m[i + 1][0] - m[i][0]) * t, m[i][1] + (m[i + 1][1] - m[i][1]) * t, (m[i][2] + (m[i + 1][2] - m[i][2]) * t) / 2 + 0.3, s.color, s.alpha);
        }
      }
    }
  }
  // PNG encode
  const raw = Buffer.alloc((RW * 3 + 1) * RH);
  let o = 0;
  for (let y = 0; y < RH; y++) { raw[o++] = 0; for (let x = 0; x < RW; x++) { const i = (y * RW + x) * 3; raw[o++] = Math.round(Math.max(0, Math.min(255, buf[i]))); raw[o++] = Math.round(Math.max(0, Math.min(255, buf[i + 1]))); raw[o++] = Math.round(Math.max(0, Math.min(255, buf[i + 2]))); } }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(RW, 0); ihdr.writeUInt32BE(RH, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
  fs.mkdirSync(path.join(OUT, 'qa'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'qa', face ? 'face.png' : 'preview.png'), png);
  console.log((face ? 'qa/face.png' : 'qa/preview.png') + ' written', RW + 'x' + RH);
}
