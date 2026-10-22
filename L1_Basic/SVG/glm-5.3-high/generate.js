// Mona Lisa - pure-SVG stroke painting generator (deterministic, seeded).
// Produces mona_lisa.svg : thousands of short arc / tapered strokes
// simulating oil glazing and sfumato. No bitmaps, no gradients-as-forms.
"use strict";
const fs = require("fs");
const path = require("path");

/* ---------------- deterministic RNG (mulberry32) ---------------- */
let seed = 1503;
function rng() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (a, b) => a + (b - a) * rng();
const rint = (a, b) => Math.floor(rr(a, b + 1));
const pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const f2 = (v) => (Math.round(v * 100) / 100).toString();

/* ---------------- color helpers ---------------- */
function hx(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function toHex(r, g, b) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}
function jitter(c, a) { const [r, g, b] = hx(c); return toHex(r + rr(-a, a), g + rr(-a, a), b + rr(-a, a)); }
function mix(c1, c2, t) { const a = hx(c1), b = hx(c2); return toHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }
function rampAt(arr, t, a = 5) {
  t = clamp(t, 0, 0.999);
  const i = Math.floor(t * arr.length);
  return a > 0 ? jitter(arr[i], a) : arr[i];
}

/* ---------------- palettes (near the original) ---------------- */
const SKIN = ["#4a2f1d", "#5e3d26", "#74492c", "#8a5834", "#9f6a3f", "#b57d4d", "#c89060", "#d7a574", "#e2b787", "#ecc794"];
const HAND = ["#58402a", "#6d4e30", "#835b38", "#98693e", "#ac7a4a", "#bd8b59", "#cc9d6d", "#d9ae80", "#e4bf92", "#eeca9e"];
const HAIR = ["#160f0a", "#1d140d", "#241812", "#2c1d14", "#352318", "#3f2b1d", "#4a3222", "#553a27", "#614330", "#6e4c38"];
const DRESS = ["#1c140c", "#241a10", "#2b2014", "#332618", "#3c2c1c", "#453321", "#4f3b27", "#5a442e", "#66503a", "#715b42"];
const GOLD = ["#6b5222", "#7d612a", "#8f6f2f", "#a3823a", "#b79348"];
const SKY = ["#6f7f63", "#79896a", "#839272", "#8d9a7a", "#97a281", "#a1aa85", "#abb28b"];
const SKY_LOW = ["#a3a67c", "#adaa80", "#b6ad85", "#c0b48a", "#c9bc90"];
const FAR_MT = ["#6d7a66", "#788570", "#838f7a", "#8e9a84", "#99a58e", "#a4b098"];
const ICE = ["#87977f", "#92a28b", "#9dad96", "#a8b8a1", "#b3c2ab", "#bfcbB5".toLowerCase()];
const MID_LT = ["#6f7350", "#7b7d56", "#87875c", "#939162", "#9f9c6a"];
const MID_RT = ["#7a7a52", "#86815a", "#928862", "#9e8f6a", "#aa9772"];
const NEAR = ["#54502f", "#5e5835", "#685f3a", "#726740", "#7c6f46"];
const RIVER = ["#96a37c", "#a2ad84", "#aeb78c", "#bac194"];
const PATH_C = ["#a99a70", "#b5a578", "#c0b083", "#cbbb8b"];
const STONE = ["#7c7a5c", "#878464", "#928e6c", "#9d9874"];
const GLAZE_COLD = "#7d8a72";
const GLAZE_WARM = "#a89a6d";

/* ---------------- stroke emitter ---------------- */
const S = [];
let nStrokes = 0;
function st(x1, y1, cx, cy, x2, y2, w, col, o) {
  S.push(`<path d="M${f1(x1)} ${f1(y1)}Q${f1(cx)} ${f1(cy)} ${f1(x2)} ${f1(y2)}" fill="none" stroke="${col}" stroke-width="${f1(w)}" stroke-linecap="round" opacity="${f2(o)}"/>`);
  nStrokes++;
}
// tapered stroke: two quadratics forming a lens (pointed ends, fat middle)
function taper(x1, y1, x2, y2, w, col, o) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const b = w / 2;
  const ax = mx + nx * b, ay = my + ny * b, bx = mx - nx * b, by = my - ny * b;
  S.push(`<path d="M${f1(x1)} ${f1(y1)}Q${f1(ax)} ${f1(ay)} ${f1(x2)} ${f1(y2)}Q${f1(bx)} ${f1(by)} ${f1(x1)} ${f1(y1)}z" fill="${col}" stroke="${col}" stroke-width="0.6" opacity="${f2(o)}"/>`);
  nStrokes++;
}

/* ---------------- geometry helpers ---------------- */
function bump(x, y, cx, cy, sx, sy) { const dx = (x - cx) / sx, dy = (y - cy) / sy; return Math.exp(-(dx * dx + dy * dy)); }
function inEll(x, y, cx, cy, rx, ry) { const dx = (x - cx) / rx, dy = (y - cy) / ry; return dx * dx + dy * dy <= 1; }
function pip(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// emit short strokes following a flow field inside a mask; strokes bow away from fcx,fcy (form center)
function field(n, m, dirFn, colFn, opts) {
  const o = Object.assign({ len: [9, 22], wid: [2, 5], op: [0.3, 0.65], bow: 0.28, fcx: 607, fcy: 430 }, opts || {});
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, ok = false;
    for (let t = 0; t < 50; t++) {
      x = rr(m.x0, m.x1); y = rr(m.y0, m.y1);
      if (m.test(x, y)) { ok = true; break; }
    }
    if (!ok) continue;
    const a = dirFn(x, y);
    const h = rr(o.len[0], o.len[1]) / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const x1 = x - dx * h, y1 = y - dy * h, x2 = x + dx * h, y2 = y + dy * h;
    const nx = -dy, ny = dx;
    const side = nx * (x - o.fcx) + ny * (y - o.fcy) >= 0 ? 1 : -1;
    const b = h * o.bow * side;
    st(x1, y1, x + nx * b, y + ny * b, x2, y2, rr(o.wid[0], o.wid[1]), colFn(x, y), rr(o.op[0], o.op[1]));
  }
}
// ridge-following strokes for mountain silhouettes
function ridgeStrokes(peaks, baseY, pal, mist, nPer) {
  for (let i = 0; i < peaks.length - 1; i++) {
    const [x1, y1] = peaks[i], [x2, y2] = peaks[i + 1];
    for (let k = 0; k < nPer; k++) {
      const t = rng();
      const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
      const depth = rr(0, baseY - py);
      const yy = py + depth;
      if (figTest(px, yy)) continue;
      const tt = clamp(0.15 + (yy - y1) / Math.max(40, baseY - y1) * 0.55 + rr(-0.08, 0.08), 0, 0.95);
      const a = Math.atan2(y2 - y1, x2 - x1) + rr(-0.25, 0.25);
      const h = rr(7, 18) / 2, dx = Math.cos(a), dy = Math.sin(a);
      const nx = -dy, ny = dx, b = h * rr(0.1, 0.5);
      const col = rng() < mist ? mix(rampAt(pal, tt, 0), "#cfd3b8", rr(0.25, 0.6)) : rampAt(pal, tt, 4);
      st(px - dx * h, yy - dy * h, px + nx * b, yy + ny * b, px + dx * h, yy + dy * h, rr(2, 5), col, rr(0.3, 0.6));
    }
  }
}

/* =============================================================
   COMPOSITION (canvas 1200 x 1600, matches Louvre panel ratio ~)
   head center (607,430); horizon at eye level ~y 400-470;
   winding path left, bridge + river right, icy crags both corners;
   right hand over left wrist bottom center-right.
   ============================================================= */

/* ---------- figure masks ---------- */
const faceTest = (x, y) => {
  const dy = y - 430;
  if (y < 268 || y > 592) return false;
  let rx = 112;
  if (y > 520) rx = 112 - (y - 520) * 0.42;           // chin taper
  if (y < 320) rx = 112 - (320 - y) * 0.18;           // forehead taper
  return inEll(x, y, 607, 430, rx, 168 - Math.max(0, (dy * dy)) / 900);
};
const neckTest = (x, y) => y > 596 && y < 745 && Math.abs(x - 609) < 46 - (y - 596) * 0.03;
const hairTest = (x, y) => {
  if (faceTest(x, y) || neckTest(x, y)) return false;
  if (inEll(x, y, 607, 385, 176, 240)) return true;   // crown mass
  if (inEll(x, y, 462, 645, 66, 205)) return true;    // left fall
  if (inEll(x, y, 754, 668, 70, 218)) return true;    // right fall
  return false;
};
const DRESS_POLY = [
  [556, 692], [658, 692], [760, 712], [836, 744], [905, 782], [985, 880],
  [1050, 1012], [1090, 1185], [1104, 1600], [248, 1600], [254, 1250],
  [268, 1050], [300, 900], [350, 800], [430, 756], [500, 718],
];
const dressTest = (x, y) => pip(DRESS_POLY, x, y);
// generous figure exclusion: landscape layers must not paint over the sitter
const figTest = (x, y) =>
  dressTest(x, y) ||
  inEll(x, y, 607, 400, 190, 275) ||                     // head + hair mass
  (Math.abs(x - 610) < 175 && y > 585 && y < 915) ||     // neck / chest
  inEll(x, y, 540, 1400, 400, 240) ||                    // hands / lap region
  (x > 740 && y > 1150);                                 // left forearm sleeve
const necklineY = (x) => 905 - Math.pow((x - 612) / 160, 2) * 63;
const chestTest = (x, y) => {
  if (y < 692 || y > 905) return false;
  if (neckTest(x, y)) return false;
  if (y <= 842) return Math.abs(x - 612) < 160 + (842 - y) * 0.55;
  return Math.abs(x - 612) < 160 * Math.sqrt(Math.max(0, (905 - y) / 63));
};

/* =============================================================
   1. UNDERPAINT (flat tone fields, later fully overpainted by strokes)
   ============================================================= */
function underpaint() {
  S.push(`<rect x="0" y="0" width="1200" height="480" fill="#97a074"/>`);
  S.push(`<rect x="0" y="430" width="1200" height="320" fill="#8b8258"/>`);
  S.push(`<rect x="0" y="700" width="1200" height="900" fill="#6e6540"/>`);
  // figure silhouette underpaint
  S.push(`<path fill="#241a10" d="M607 118 C 500 122 428 210 424 340 C 420 470 430 560 418 660 C 404 770 340 800 300 900 C 258 1005 240 1250 244 1600 L 1108 1600 C 1112 1230 1092 1030 1044 910 C 1000 800 900 742 800 716 C 742 700 700 660 700 560 C 700 470 690 210 607 118 Z"/>`);
  S.push(`<ellipse cx="607" cy="430" rx="110" ry="160" fill="#a97a4d"/>`);
  S.push(`<path fill="#b08050" d="M563 600 L655 600 C 660 660 664 700 676 730 C 700 780 760 800 820 840 L 400 840 C 470 800 540 780 558 730 C 566 700 560 660 563 600 Z"/>`);
  S.push(`<ellipse cx="660" cy="1362" rx="120" ry="58" fill="#b08050" transform="rotate(14 660 1362)"/>`);
  S.push(`<ellipse cx="836" cy="1388" rx="150" ry="52" fill="#a97a4d" transform="rotate(-8 836 1388)"/>`);
}

/* =============================================================
   2. SKY (hazy teal-green, warmer toward horizon) - long soft weaves
   ============================================================= */
function sky() {
  const bands = [
    { y0: 0, y1: 150, pal: SKY, t0: 0.0, t1: 0.25, n: 260 },
    { y0: 130, y1: 300, pal: SKY, t0: 0.3, t1: 0.55, n: 300 },
    { y0: 280, y1: 430, pal: SKY_LOW, t0: 0.2, t1: 0.6, n: 320 },
    { y0: 400, y1: 500, pal: SKY_LOW, t0: 0.6, t1: 0.95, n: 220 },
  ];
  for (const b of bands) {
    for (let i = 0; i < b.n; i++) {
      const x = rr(-40, 1240), y = rr(b.y0, b.y1);
      if (figTest(x, y)) continue;
      const t = b.t0 + ((y - b.y0) / (b.y1 - b.y0)) * (b.t1 - b.t0) + rr(-0.1, 0.1);
      const a = rr(-0.08, 0.08) + 0.05 * Math.sin(x / 210);
      const h = rr(28, 78) / 2, dx = Math.cos(a), dy = Math.sin(a);
      const b2 = h * rr(-0.12, 0.12);
      st(x - dx * h, y - dy * h, x - dy * b2, y + dx * b2, x + dx * h, y + dy * h,
        rr(6, 14), rampAt(b.pal, t, 4), rr(0.35, 0.6));
    }
  }
}

/* =============================================================
   3. DISTANT MOUNTAINS + ICY CRAGS (aerial perspective, misty)
   ============================================================= */
function mountains() {
  // far ridges (left & right of head, horizon ~ y 400-470)
  ridgeStrokes([[0, 352], [52, 306], [118, 336], [186, 276], [252, 320], [318, 288], [388, 330], [446, 372]], 480, FAR_MT, 0.55, 150);
  ridgeStrokes([[756, 360], [812, 300], [878, 334], [944, 282], [1010, 318], [1082, 292], [1150, 330], [1200, 306]], 480, FAR_MT, 0.55, 150);
  // second, nearer ridge (warmer, more contrast)
  ridgeStrokes([[0, 420], [70, 386], [140, 420], [216, 392], [290, 430], [370, 404], [440, 444]], 540, MID_LT, 0.3, 120);
  ridgeStrokes([[760, 448], [836, 400], [912, 436], [990, 396], [1064, 430], [1140, 402], [1200, 428]], 550, MID_RT, 0.3, 120);
  // icy crags, top corners, pale blue-green
  ridgeStrokes([[0, 150], [58, 84], [124, 148], [196, 96], [262, 168], [330, 128], [396, 200]], 330, ICE, 0.35, 110);
  ridgeStrokes([[806, 196], [872, 120], [940, 190], [1010, 128], [1078, 196], [1146, 140], [1200, 190]], 340, ICE, 0.35, 110);
  // snow / haze highlights on crags
  for (let i = 0; i < 90; i++) {
    const left = rng() < 0.5;
    const x = left ? rr(0, 360) : rr(830, 1200);
    const y = rr(80, 240);
    const a = rr(-0.3, 0.3);
    const h = rr(5, 14) / 2;
    st(x - Math.cos(a) * h, y - Math.sin(a) * h, x + Math.sin(a) * 2, y - Math.cos(a) * 2, x + Math.cos(a) * h, y + Math.sin(a) * h,
      rr(1.5, 3.5), jitter("#cdd6bd", 5), rr(0.35, 0.6));
  }
}

/* =============================================================
   4. MID-GROUND: rolling earth, winding path (left), river + bridge (right)
   ============================================================= */
function midground() {
  // rolling mid slopes left of figure
  field(430, { x0: 0, y1: 1000, x1: 440, y0: 430, test: (x, y) => y > 430 && y < 1000 && x < 440 && !figTest(x, y) },
    (x, y) => rr(-0.15, 0.15) + Math.sin(y / 90) * 0.06,
    (x, y) => rampAt(MID_LT, clamp((y - 430) / 420, 0, 1) * 0.8 + rr(-0.08, 0.08), 5),
    { len: [14, 34], wid: [3, 7], op: [0.3, 0.55] });
  // right mid-ground (warmer)
  field(430, { x0: 760, y1: 1000, x1: 1200, y0: 430, test: (x, y) => y > 430 && y < 1000 && x > 760 && !figTest(x, y) },
    (x, y) => rr(-0.15, 0.15) + Math.sin(y / 110) * 0.06,
    (x, y) => rampAt(MID_RT, clamp((y - 430) / 420, 0, 1) * 0.8 + rr(-0.08, 0.08), 5),
    { len: [14, 34], wid: [3, 7], op: [0.3, 0.55] });
  // near foreground flanks (darkest warm browns)
  field(240, { x0: 0, y1: 1230, x1: 330, y0: 900, test: (x, y) => x < 330 - (y - 900) * 0.05 && y > 900 && !figTest(x, y) },
    (x, y) => Math.PI / 2 + rr(-0.5, 0.5),
    (x, y) => rampAt(NEAR, clamp((y - 900) / 330, 0, 1) + rr(-0.1, 0.1), 5),
    { len: [16, 38], wid: [4, 9], op: [0.35, 0.6] });
  field(240, { x0: 880, y1: 1230, x1: 1200, y0: 900, test: (x, y) => x > 880 + (y - 900) * 0.1 && y > 900 && !figTest(x, y) },
    (x, y) => Math.PI / 2 + rr(-0.5, 0.5),
    (x, y) => rampAt(NEAR, clamp((y - 900) / 330, 0, 1) + rr(-0.1, 0.1), 5),
    { len: [16, 38], wid: [4, 9], op: [0.35, 0.6] });

  // winding path (left): zigzag from lower-left up to the pass
  const road = [[92, 906], [152, 828], [118, 742], [196, 652], [158, 566], [232, 478]];
  for (let i = 0; i < road.length - 1; i++) {
    const [x1, y1] = road[i], [x2, y2] = road[i + 1];
    const a = Math.atan2(y2 - y1, x2 - x1);
    const n = 46;
    for (let k = 0; k < n; k++) {
      const t = rng();
      const px = x1 + (x2 - x1) * t + rr(-8, 8), py = y1 + (y2 - y1) * t + rr(-8, 8);
      const w = rr(6, 16) * (0.55 + t * 0.45);
      const na = a + Math.PI / 2;
      const h = w / 2;
      const edge = rng() < 0.3;
      const col = edge ? rampAt(MID_LT, 0.5, 5) : rampAt(PATH_C, rr(0.2, 0.9), 6);
      st(px - Math.cos(na) * h, py - Math.sin(na) * h, px + Math.cos(na) * h * 0.2, py + Math.sin(na) * h * 0.2,
        px + Math.cos(na) * h, py + Math.sin(na) * h, rr(2.5, 5), col, edge ? rr(0.3, 0.5) : rr(0.45, 0.7));
    }
  }
  // river (right): winding ribbon from bridge downward
  const riv = [[980, 592], [952, 654], [906, 716], [866, 792], [812, 872], [776, 960]];
  for (let i = 0; i < riv.length - 1; i++) {
    const [x1, y1] = riv[i], [x2, y2] = riv[i + 1];
    const a = Math.atan2(y2 - y1, x2 - x1);
    for (let k = 0; k < 42; k++) {
      const t = rng();
      const px = x1 + (x2 - x1) * t + rr(-6, 6), py = y1 + (y2 - y1) * t + rr(-6, 6);
      if (figTest(px, py)) continue;
      const w = rr(8, 20) * (1 - t * 0.35);
      const na = a + Math.PI / 2, h = w / 2;
      const bank = rng() < 0.28;
      const col = bank ? rampAt(MID_RT, 0.35, 5) : rampAt(RIVER, rr(0.15, 0.85), 5);
      st(px - Math.cos(na) * h, py - Math.sin(na) * h, px + Math.cos(a) * h * 0.4, py + Math.sin(a) * h * 0.4,
        px + Math.cos(na) * h, py + Math.sin(na) * h, rr(2.5, 6), col, rr(0.4, 0.65));
    }
  }
  // the arched bridge (right, ~y 570): deck + 4 arches
  const bx0 = 862, bx1 = 1006, by = 578;
  for (let k = 0; k < 70; k++) {
    const x = rr(bx0, bx1), y = by + rr(-8, 2);
    st(x - 6, y + rr(-2, 2), x, y - rr(1, 3), x + 6, y + rr(-2, 2), rr(2, 4), rampAt(STONE, rr(0.3, 0.9), 5), rr(0.45, 0.7));
  }
  const archXs = [884, 920, 956, 992];
  for (const axc of archXs) {
    for (let k = 0; k < 26; k++) {
      const a = Math.PI + rng() * Math.PI; // lower half circle
      const r = 15;
      const x = axc + Math.cos(a) * r, y = by + 3 + Math.sin(a) * r * 0.85;
      const a2 = a + Math.PI / 2;
      const h = rr(3, 7);
      st(x - Math.cos(a2) * h, y - Math.sin(a2) * h, x + Math.sin(a2), y - Math.cos(a2), x + Math.cos(a2) * h, y + Math.sin(a2) * h,
        rr(1.8, 3.5), jitter("#5c5a42", 4), rr(0.4, 0.65));
    }
  }
  // bridge reflection
  for (let k = 0; k < 40; k++) {
    const x = rr(bx0, bx1), y = by + rr(14, 40);
    st(x - 5, y, x + rr(-2, 2), y + 3, x + 5, y, rr(2, 4), jitter("#6b755c", 5), rr(0.2, 0.4));
  }
}

/* =============================================================
   5. LANDSCAPE SFUMATO GLAZE (aerial haze near horizon)
   ============================================================= */
function landscapeGlaze() {
  field(240, { x0: 0, y1: 520, x1: 460, y0: 300, test: (x, y) => y > 300 && y < 520 && x < 460 && !figTest(x, y) },
    () => rr(-0.1, 0.1),
    () => jitter(GLAZE_COLD, 6), { len: [30, 70], wid: [10, 20], op: [0.08, 0.18], bow: 0.05 });
  field(240, { x0: 740, y1: 520, x1: 1200, y0: 300, test: (x, y) => y > 300 && y < 520 && x > 740 && !figTest(x, y) },
    () => rr(-0.1, 0.1),
    () => jitter(GLAZE_WARM, 6), { len: [30, 70], wid: [10, 20], op: [0.08, 0.18], bow: 0.05 });
}

/* =============================================================
   6. LOGGIA PILLAR BASES (barely visible, both edges)
   ============================================================= */
function pillars() {
  for (const side of [0, 1]) {
    const x0 = side ? 1162 : 0, x1 = side ? 1200 : 38;
    for (let i = 0; i < 110; i++) {
      const x = rr(x0, x1), y = rr(600, 1560);
      st(x, y - rr(8, 20), x + rr(-3, 3), y, x, y + rr(8, 20), rr(3, 8), jitter("#3a3222", 5), rr(0.25, 0.5));
    }
    // capital shadow line
    for (let i = 0; i < 26; i++) {
      const x = rr(x0, x1);
      st(x - 4, 610 + rr(-2, 2), x + rr(-2, 2), 614, x + 4, 610 + rr(-2, 2), rr(2, 4), jitter("#2c2618", 4), rr(0.4, 0.6));
    }
  }
}

/* =============================================================
   7. DRESS (dark olive-brown, gathered folds), bodice lacing, gold neckline
   ============================================================= */
function dress() {
  const foldsL = [318, 402, 494], foldsC = [568, 612, 656], foldsR = [742, 836, 930, 1010];
  field(1050, { x0: 248, y1: 1600, x1: 1104, y0: 692, test: dressTest },
    (x, y) => {
      const edge = Math.abs(x - 607) > 330;
      const tilt = (x - 607) / 607 * (edge ? 0.55 : 0.18);
      return Math.PI / 2 + tilt + Math.sin(x / 46 + y / 300) * 0.1 + rr(-0.05, 0.05);
    },
    (x, y) => {
      let l = 0.34;
      for (const fx of foldsL.concat(foldsC, foldsR)) {
        const d = Math.abs(x - fx);
        if (d < 26) l -= (1 - d / 26) * 0.3;                 // valley dark
        else if (d < 55) l += (1 - (d - 26) / 29) * 0.12;    // ridge light
      }
      l += bump(x, y, 607, 950, 260, 130) * 0.18;            // chest catch light
      l -= clamp((y - 1150) / 450, 0, 1) * 0.15;             // darker low
      l -= clamp((Math.abs(x - 607) - 300) / 260, 0, 1) * 0.2;
      return rampAt(DRESS, clamp(l, 0, 1) + rr(-0.05, 0.05), 4);
    },
    { len: [18, 46], wid: [3, 8], op: [0.35, 0.65], bow: 0.18 });

  // neckline gold embroidery band
  for (let i = 0; i < 200; i++) {
    const t = rng();
    const bx = 452 + (772 - 452) * t;
    const y = necklineY(bx) + rr(-7, 7);
    const a = rr(-0.2, 0.2);
    const h = rr(5, 12) / 2;
    st(bx - Math.cos(a) * h, y - Math.sin(a) * h, bx + rr(-1, 1), y - 2, bx + Math.cos(a) * h, y + Math.sin(a) * h,
      rr(1.6, 3.2), rampAt(GOLD, rr(0.15, 0.95), 4), rr(0.45, 0.75));
  }
  // gold band shadow under neckline
  for (let i = 0; i < 90; i++) {
    const t = rng();
    const bx = 452 + (772 - 452) * t;
    const y = necklineY(bx) + rr(8, 18);
    st(bx - 6, y, bx + rr(-2, 2), y + 3, bx + 6, y, rr(2, 4), jitter("#4a3617", 4), rr(0.35, 0.6));
  }
  // laced bodice: criss-cross over center panel + knots (the "groppo")
  for (let y = 908; y < 1140; y += 26) {
    const wHalf = 24 + (y - 908) * 0.04;
    const xL = 612 - wHalf, xR = 612 + wHalf;
    // the X
    st(xL, y, 612, y + 13, xR, y + 20, 3.2, jitter("#3c2c12", 3), 0.8);
    st(xR, y, 612, y + 13, xL, y + 20, 3.2, jitter("#3c2c12", 3), 0.8);
    // knot
    taper(612, y + 12, 612 + rr(-2, 2), y + 18, rr(7, 9), jitter("#171008", 2), 0.85);
    // gold hint on the cords
    st(xL, y - 1, 612, y + 12, xR, y + 19, 1.4, jitter("#8f6f2f", 3), 0.5);
    // placket edges
    st(xL - 4, y - 12, xL - 5, y + 4, xL - 4, y + 20, 2.6, jitter("#14100a", 2), 0.7);
    st(xR + 4, y - 12, xR + 5, y + 4, xR + 4, y + 20, 2.6, jitter("#14100a", 2), 0.7);
  }
  // gathered pleats radiating from under the bodice
  field(150, { x0: 540, y1: 1500, x1: 690, y0: 1130, test: (x, y) => dressTest(x, y) && Math.abs(x - 612) < 78 },
    (x) => Math.PI / 2 + (x - 612) * 0.02 + rr(-0.04, 0.04),
    () => rampAt(DRESS, rr(0.1, 0.5), 4), { len: [26, 60], wid: [3, 7], op: [0.4, 0.65] });
}

/* =============================================================
   8. CHEST + NECK skin
   ============================================================= */
function chestNeck() {
  // chest above neckline
  field(420, { x0: 400, y1: 905, x1: 830, y0: 692, test: chestTest },
    (x, y) => Math.PI / 2 + (x - 612) * 0.004 + rr(-0.05, 0.05),
    (x, y) => {
      let l = 0.62 + bump(x, y, 566, 790, 120, 70) * 0.2;   // lit from left
      l -= bump(x, y, 612, 860, 40, 60) * 0.22;             // sternum hollow
      l -= clamp((Math.abs(x - 612) - 90) / 110, 0, 1) * 0.3;
      l -= bump(x, y, 612, 700, 90, 30) * 0.28;             // jaw shadow band
      return rampAt(SKIN, clamp(l, 0, 1) + rr(-0.05, 0.05), 4);
    },
    { len: [12, 26], wid: [2.5, 5], op: [0.35, 0.6], fcx: 612, fcy: 800 });
  // neck column
  field(360, { x0: 560, y1: 740, x1: 662, y0: 560, test: (x, y) => neckTest(x, y) || (y > 560 && y < 640 && faceTest(x, y + 150)) },
    (x) => Math.PI / 2 + (x - 609) * 0.012 + rr(-0.05, 0.05),
    (x, y) => {
      let l = 0.66 - bump(x, y, 609, 618, 60, 26) * 0.38;   // under-jaw core shadow
      l += bump(x, y, 580, 660, 26, 60) * 0.16;             // lit edge left
      l -= clamp((x - 620) / 50, 0, 1) * 0.2;
      return rampAt(SKIN, clamp(l, 0, 1) + rr(-0.05, 0.05), 4);
    },
    { len: [10, 20], wid: [2.5, 5], op: [0.4, 0.65] });
  // sfumato jaw-to-neck transition
  field(120, { x0: 560, y1: 700, x1: 664, y0: 590, test: (x, y) => Math.abs(x - 609) < 55 && y > 590 && y < 700 },
    (x, y) => Math.atan2(660 - y, x - 609) + Math.PI / 2,
    () => jitter("#5e3d26", 5), { len: [14, 30], wid: [6, 12], op: [0.1, 0.22], fcx: 609, fcy: 640 });
}

/* =============================================================
   9. HAIR (dark, center parting, wavy falls over shoulders) + veil
   ============================================================= */
function hair() {
  // back mass (behind face, painted first)
  field(520, { x0: 400, y1: 900, x1: 820, y0: 110, test: hairTest },
    (x, y) => {
      if (y < 440) {
        let a = Math.atan2(y - 238, x - 601);       // radial from crown parting
        a += 0.3 * Math.sin((y + x * 0.6) / 36);
        return a;
      }
      return Math.PI / 2 + (x - 607) * 0.0022 + 0.22 * Math.sin((y * 0.9 + x * 0.4) / 34) + rr(-0.05, 0.05);
    },
    (x, y) => {
      let t = 0.3;
      t += bump(x, y, 520, 300, 130, 110) * 0.32;   // light from upper-left
      t += bump(x, y, 470, 700, 60, 160) * 0.12;
      t -= bump(x, y, 760, 500, 90, 200) * 0.12;
      return rampAt(HAIR, clamp(t, 0, 1) + rr(-0.07, 0.07), 3);
    },
    { len: [30, 78], wid: [2.4, 6.5], op: [0.5, 0.85], bow: 0.22, fcx: 601, fcy: 238 });
  // parting line strokes
  for (let i = 0; i < 60; i++) {
    const y = rr(228, 300);
    const x = 601 + rr(-3, 3) - (y - 228) * 0.02;
    const side = rng() < 0.5 ? -1 : 1;
    st(x, y, x + side * 14, y + 10 + rr(0, 6), x + side * 26, y + 26 + rr(0, 10), rr(1.6, 3.4), jitter("#100b07", 2), rr(0.5, 0.8));
  }
  // fine lighter strands (sfumato sheen)
  for (let i = 0; i < 170; i++) {
    let x, y, ok = false;
    for (let t = 0; t < 40; t++) { x = rr(400, 820); y = rr(110, 880); if (hairTest(x, y)) { ok = true; break; } }
    if (!ok) continue;
    const h = rr(24, 60) / 2;
    const a = y < 440 ? Math.atan2(y - 238, x - 601) : Math.PI / 2 + (x - 607) * 0.002 + 0.2 * Math.sin(y / 34);
    st(x - Math.cos(a) * h, y - Math.sin(a) * h, x + rr(-3, 3), y + rr(-4, 4), x + Math.cos(a) * h, y + Math.sin(a) * h,
      rr(1, 2), jitter("#6a4a2c", 5), rr(0.2, 0.45));
  }
  // front locks framing the face (over forehead edges)
  for (let i = 0; i < 150; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const y = rr(250, 620);
    const x = 607 + side * (rr(96, 128) - (y > 480 ? (y - 480) * 0.1 : 0));
    const h = rr(18, 44) / 2;
    st(x - side * 3, y - h, x - side * 7, y, x - side * 3, y + h, rr(2, 4.5), rampAt(HAIR, rr(0.15, 0.6), 3), rr(0.5, 0.8));
  }
  // hairline sfumato blend into forehead
  for (let i = 0; i < 130; i++) {
    const x = rr(498, 716);
    const y = 258 + Math.pow(Math.abs(x - 607) / 110, 2) * 34 + rr(-6, 6);
    st(x - 8, y + rr(-2, 2), x, y + rr(-3, 3), x + 8, y + rr(-2, 2), rr(3, 6), jitter("#4a3122", 4), rr(0.2, 0.42));
  }
  // sheer veil over the crown (translucent gray-brown glaze)
  for (let i = 0; i < 120; i++) {
    const x = rr(438, 776);
    const y = rr(150, 320);
    if (!inEll(x, y, 607, 380, 172, 236)) continue;
    const a = Math.atan2(y - 330, x - 607) + Math.PI / 2;
    const h = rr(16, 40) / 2;
    const nx = -Math.sin(a), ny = Math.cos(a);
    st(x - Math.cos(a) * h, y - Math.sin(a) * h, x + nx * h * 0.3, y + ny * h * 0.3, x + Math.cos(a) * h, y + Math.sin(a) * h,
      rr(3, 8), jitter("#9a8f7a", 5), rr(0.07, 0.16));
  }
  // veil edge crossing the forehead
  for (let i = 0; i < 60; i++) {
    const x = rr(482, 736);
    const y = 262 + Math.pow(Math.abs(x - 607) / 125, 2) * 30 + rr(-3, 3);
    st(x - 10, y, x + rr(-2, 2), y - 2, x + 10, y, rr(2.5, 5), jitter("#8a7c66", 4), rr(0.12, 0.25));
  }
}

/* =============================================================
   10. FACE - layered sfumato strokes following the forms
   ============================================================= */
function faceLum(x, y) {
  let l = 0.56;
  const nx = (x - 607) / 115, ny = (y - 430) / 165;
  l += 0.14 * (1 - Math.min(1, Math.hypot(nx, ny)));
  l += 0.24 * bump(x, y, 566, 322, 100, 78);   // forehead highlight (light upper-left)
  l += 0.15 * bump(x, y, 543, 462, 58, 55);    // left cheek light
  l += 0.10 * bump(x, y, 606, 596, 40, 28);    // chin light
  l += 0.07 * bump(x, y, 582, 548, 24, 18);    // nasolabial soft light left
  l -= 0.22 * bump(x, y, 668, 458, 56, 62);    // right cheek shadow side
  l -= 0.18 * bump(x, y, 562, 402, 30, 20);    // left eye socket
  l -= 0.18 * bump(x, y, 654, 400, 30, 20);    // right eye socket
  l -= 0.13 * bump(x, y, 628, 448, 18, 60);    // nose side shadow (right of bridge)
  l -= 0.16 * bump(x, y, 607, 588, 36, 16);    // under-lip shadow
  l -= 0.12 * bump(x, y, 607, 648, 62, 22);    // under-chin
  l -= 0.1 * clamp((y - 500) / 100, 0, 1);     // lower face slightly darker
  l -= 0.12 * clamp((Math.abs(nx) - 0.62) / 0.5, 0, 1); // edge falloff
  return clamp(l, 0, 1);
}
function faceDir(x, y) {
  if (y < 372) return Math.atan2(y - 660, x - 607) + Math.PI / 2 + rr(-0.06, 0.06); // forehead arcs
  if (y < 438) { const c = x < 607 ? [560, 402] : [653, 400]; return Math.atan2(y - c[1], x - c[0]) + Math.PI / 2; } // eye sockets
  if (Math.abs(x - 607) < 25 && y < 548) return Math.PI / 2 + rr(-0.05, 0.05);      // nose bridge vertical
  if (y < 548) { const c = x < 607 ? [537, 484] : [676, 486]; return Math.atan2(y - c[1], x - c[0]) + Math.PI / 2; } // cheeks
  if (y < 606) return Math.atan2(y - 590, x - 607) + Math.PI / 2;                   // mouth/chin arcs
  return Math.atan2(y - 528, x - 607) + Math.PI / 2;                                // jaw
}
function face() {
  // base flesh layers: dense overlapping strokes
  field(2600, { x0: 480, y1: 620, x1: 736, y0: 240, test: faceTest },
    faceDir,
    (x, y) => rampAt(SKIN, faceLum(x, y) + rr(-0.06, 0.06), 4),
    { len: [9, 24], wid: [2, 5.5], op: [0.28, 0.6], bow: 0.3, fcx: 607, fcy: 470 });
  // second finer pass (high-frequency dithering, neighbor-color vibration)
  field(1300, { x0: 480, y1: 620, x1: 736, y0: 240, test: faceTest },
    faceDir,
    (x, y) => rampAt(SKIN, faceLum(x, y) + rr(-0.16, 0.16), 7),
    { len: [6, 14], wid: [1.4, 3.2], op: [0.22, 0.5], bow: 0.3, fcx: 607, fcy: 470 });

  /* ---- eyes (no lashes/brows, sfumato lids) ---- */
  function eye(cx, cy, flip) {
    // socket shadow band across the eye
    for (let i = 0; i < 46; i++) {
      const x = rr(cx - 26, cx + 26), y = cy + rr(-8, 12);
      st(x - 6, y, x + rr(-2, 2), y - 2, x + 6, y, rr(3, 6), jitter("#6a4426", 4), rr(0.15, 0.32));
    }
    // upper lid
    for (let i = 0; i < 34; i++) {
      const t = rng();
      const x = cx - 19 + 38 * t;
      const y = cy - 1 - Math.sin(t * Math.PI) * 7;
      st(x - 4, y + 1, x, y - 1.5, x + 4, y + 1, rr(1.8, 3.4), jitter(flip ? "#3a2716" : "#3a2716", 3), rr(0.55, 0.85));
    }
    // lid crease above
    for (let i = 0; i < 22; i++) {
      const t = rng();
      const x = cx - 17 + 34 * t;
      const y = cy - 7 - Math.sin(t * Math.PI) * 4;
      st(x - 4, y + 1, x, y - 1, x + 4, y + 1, rr(1.4, 2.6), jitter("#5a3a20", 3), rr(0.25, 0.45));
    }
    // iris (partly veiled by lid)
    const ix = cx + flip * 2, iy = cy + 3;
    for (let k = 0; k < 26; k++) {
      const a = rng() * Math.PI * 2, r = rng() * 6.4;
      const x = ix + Math.cos(a) * r, y = iy + Math.sin(a) * r * 0.8;
      st(x - 3, y, x, y - 1, x + 3, y, rr(2, 4), jitter("#33241a", 3), rr(0.5, 0.8));
    }
    // pupil
    for (let k = 0; k < 8; k++) {
      const x = ix + rr(-2.5, 2.5), y = iy + rr(-2, 2);
      st(x - 2, y, x, y - 0.5, x + 2, y, rr(2, 3.4), "#150e08", rr(0.6, 0.9));
    }
    // tiny cornea light
    taper(ix - 3, iy + 2.5, ix - 0.5, iy + 4, 2.4, jitter("#d7a574", 2), 0.75);
    // lower lid light
    for (let i = 0; i < 18; i++) {
      const t = rng();
      const x = cx - 16 + 32 * t;
      const y = cy + 9 + Math.sin(t * Math.PI) * 1.5;
      st(x - 4, y, x, y - 1, x + 4, y, rr(1.4, 2.8), jitter("#c89060", 3), rr(0.3, 0.55));
    }
    // inner canthus warm dot / outer canthus shade
    taper(cx - (flip ? -19 : 19), cy + 1, cx - (flip ? -15.5 : 15.5), cy + 2, 3.6, jitter("#7a4a28", 3), 0.6);
    for (let k = 0; k < 6; k++) {
      const x = cx + (flip ? -1 : 1) * rr(15, 19);
      st(x, cy - 4 + rr(0, 3), x + rr(-1, 1), cy, x, cy + 3 + rr(0, 2), rr(1.6, 3), jitter("#503318", 3), rr(0.3, 0.5));
    }
    // brow ridge soft shadow (no drawn eyebrow)
    for (let i = 0; i < 30; i++) {
      const t = rng();
      const x = cx - 21 + 42 * t;
      const y = cy - 15 - Math.sin(t * Math.PI) * 5 + rr(-3, 3);
      st(x - 6, y + 1.5, x, y - 1.5, x + 6, y + 1.5, rr(2.5, 5), jitter("#6e4a2f", 4), rr(0.14, 0.3));
    }
  }
  eye(560, 401, 0);
  eye(653, 399, 1);

  /* ---- nose (long soft side shadow, lit bridge, nostrils) ---- */
  for (let i = 0; i < 130; i++) {
    const y = rr(405, 495);
    const x = 622 + Math.pow((y - 405) / 90, 1.4) * 12 + rr(-5, 5);
    const a = Math.PI / 2 + rr(-0.06, 0.06);
    const h = rr(7, 16) / 2;
    st(x - Math.cos(a) * h, y - Math.sin(a) * h, x + 2, y, x + Math.cos(a) * h, y + Math.sin(a) * h, rr(2, 4.5), rampAt(SKIN, rr(0.12, 0.34), 4), rr(0.2, 0.42));
  }
  // bridge light
  for (let i = 0; i < 80; i++) {
    const y = rr(390, 480);
    const x = 596 + rr(-4, 4);
    const h = rr(6, 13) / 2;
    st(x, y - h, x + rr(-1, 1), y, x, y + h, rr(1.8, 3.6), rampAt(SKIN, rr(0.62, 0.85), 3), rr(0.25, 0.5));
  }
  // nose tip + alae
  for (let i = 0; i < 60; i++) {
    const x = 606 + rr(-14, 14), y = 483 + rr(-8, 8);
    const a = Math.atan2(y - 486, x - 606) + Math.PI / 2;
    const h = rr(4, 9) / 2;
    st(x - Math.cos(a) * h, y - Math.sin(a) * h, x - Math.sin(a) * h, y + Math.cos(a) * h, x + Math.cos(a) * h, y + Math.sin(a) * h,
      rr(1.8, 3.6), rampAt(SKIN, rr(0.5, 0.8), 3), rr(0.3, 0.55));
  }
  // nostrils
  function nostril(nx, ny, s) {
    for (let i = 0; i < 16; i++) {
      const a = Math.PI * 0.7 + rng() * Math.PI * 0.8;
      const x = nx + Math.cos(a) * s * rr(0.4, 1), y = ny + Math.sin(a) * s * rr(0.3, 0.8);
      const h = rr(2, 5) / 2;
      st(x - Math.cos(a) * h, y - Math.sin(a) * h, x + rr(-1, 1), y + rr(-1, 1), x + Math.cos(a) * h, y + Math.sin(a) * h,
        rr(1.6, 3), jitter("#3c2412", 3), rr(0.4, 0.7));
    }
  }
  nostril(585, 495, 6.5);
  nostril(629, 492, 6);
  // under-nose shadow
  for (let i = 0; i < 40; i++) {
    const x = rr(586, 630), y = rr(500, 514);
    st(x - 5, y, x + rr(-2, 2), y + 1, x + 5, y, rr(2.5, 5), jitter("#6a4426", 4), rr(0.18, 0.38));
  }

  /* ---- the mouth: soft upturned corners, the subtle smile ---- */
  const mouthL = [576, 566], mouthR = [641, 558];
  // lip seam
  for (let i = 0; i < 56; i++) {
    const t = rng();
    const x = mouthL[0] + (mouthR[0] - mouthL[0]) * t;
    const y = mouthL[1] + (mouthR[1] - mouthL[1]) * t - Math.sin(t * Math.PI) * 2;
    st(x - 5, y + 0.8, x, y - 0.8, x + 5, y + 0.8, rr(1.6, 3.2), jitter("#4e2f18", 3), rr(0.4, 0.7));
  }
  // upper lip (darker)
  for (let i = 0; i < 110; i++) {
    const t = rng();
    const x = mouthL[0] + 8 + (mouthR[0] - mouthL[0] - 16) * t;
    const y = mouthL[1] - 3 + (mouthR[1] - mouthL[1]) * t - Math.sin(t * Math.PI) * 9 + rr(0, 6);
    st(x - 5, y + 1, x, y - 1, x + 5, y + 1, rr(2, 4), rampAt(SKIN, rr(0.2, 0.42), 4), rr(0.3, 0.55));
  }
  // lower lip (lighter, full)
  for (let i = 0; i < 130; i++) {
    const t = rng();
    const x = mouthL[0] + 6 + (mouthR[0] - mouthL[0] - 12) * t;
    const y = mouthL[1] + 4 + (mouthR[1] - mouthL[1]) * t + Math.sin(t * Math.PI) * 8 + rr(-2, 5);
    st(x - 5, y - 1, x, y + 1, x + 5, y - 1, rr(2, 4), rampAt(SKIN, rr(0.55, 0.85), 4), rr(0.3, 0.55));
  }
  // lower lip center light
  for (let i = 0; i < 26; i++) {
    const x = 596 + rr(-12, 12), y = 573 + rr(-3, 3);
    st(x - 3.5, y, x, y - 1, x + 3.5, y, rr(1.6, 3), jitter("#e2b787", 3), rr(0.35, 0.6));
  }
  // smile corner shadows (slightly upturned, sfumato)
  function corner(cx, cy, dirx) {
    for (let i = 0; i < 34; i++) {
      const r = rr(2, 12);
      const a = -0.5 + rng() * 1.4; // upward-outward fan
      const x = cx + Math.cos(a * dirx) * 0, y = 0;
      const px = cx + dirx * r * 0.5, py = cy - r * 0.45 + rr(-3, 3);
      st(px - 4, py + 1, px + dirx * 2, py - 2, px + 4, py + 1, rr(2, 4), jitter("#6a4426", 4), rr(0.18, 0.4));
    }
    // cheek dimple hint
    for (let i = 0; i < 14; i++) {
      const px = cx + dirx * rr(6, 16), py = cy - rr(2, 12);
      st(px - 4, py, px + rr(-1, 1), py - 1, px + 4, py, rr(2, 4), jitter("#7a4e2c", 4), rr(0.1, 0.25));
    }
  }
  corner(576, 568, -1);
  corner(642, 559, 1);
  // philtrum shadow + under-lip shadow band
  for (let i = 0; i < 36; i++) {
    const x = 596 + rr(-8, 8), y = 544 + rr(-6, 6);
    st(x - 3, y, x, y - 1, x + 3, y, rr(2, 4), jitter("#8a5834", 3), rr(0.15, 0.3));
  }
  for (let i = 0; i < 70; i++) {
    const x = 580 + rr(0, 54), y = 584 + rr(0, 12);
    st(x - 6, y + 1, x, y - 1, x + 6, y + 1, rr(2.5, 5), jitter("#6a4426", 4), rr(0.18, 0.4));
  }
  // chin ball light + crease
  for (let i = 0; i < 90; i++) {
    const x = 607 + rr(-26, 26), y = 600 + rr(-14, 14);
    const a = Math.atan2(y - 602, x - 607) + Math.PI / 2;
    const h = rr(5, 11) / 2;
    st(x - Math.cos(a) * h, y - Math.sin(a) * h, x - Math.sin(a) * h, y + Math.cos(a) * h, x + Math.cos(a) * h, y + Math.sin(a) * h,
      rr(1.8, 3.6), rampAt(SKIN, rr(0.5, 0.8), 3), rr(0.25, 0.5));
  }
  for (let i = 0; i < 40; i++) {
    const x = 592 + rr(0, 32), y = 588 + rr(-3, 3);
    st(x - 5, y + 1, x, y - 1, x + 5, y + 1, rr(2, 4), jitter("#7a4e2c", 3), rr(0.2, 0.38));
  }

  /* ---- jaw / hairline sfumato edges (no hard borders) ---- */
  field(260, { x0: 500, y1: 600, x1: 720, y0: 560, test: (x, y) => faceTest(x, y) && y > 560 },
    (x, y) => Math.atan2(y - 528, x - 607) + Math.PI / 2,
    () => jitter("#74492c", 4), { len: [12, 26], wid: [5, 10], op: [0.1, 0.24], fcx: 607, fcy: 520 });
  field(160, { x0: 492, y1: 330, x1: 724, y0: 250, test: (x, y) => faceTest(x, y) && y < 310 },
    () => rr(-0.1, 0.1),
    () => jitter("#5e3d26", 4), { len: [12, 26], wid: [5, 10], op: [0.08, 0.2], fcx: 607, fcy: 380 });

  /* ---- final transparent sfumato glaze over the whole face ---- */
  field(340, { x0: 480, y1: 620, x1: 736, y0: 240, test: faceTest },
    faceDir,
    (x, y) => (faceLum(x, y) > 0.55 ? jitter("#e8c493", 5) : jitter("#6a4426", 5)),
    { len: [16, 34], wid: [8, 16], op: [0.05, 0.13], bow: 0.25, fcx: 607, fcy: 470 });
}

/* =============================================================
   11. HANDS - right hand relaxed over left wrist
   ============================================================= */
function finger(x1, y1, x2, y2, w0, w1, lum, bend) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const steps = Math.max(8, Math.round(len / 4.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bow = Math.sin(t * Math.PI) * bend;
    const cx = x1 + (x2 - x1) * t + nx * bow, cy = y1 + (y2 - y1) * t + ny * bow;
    const w = w0 + (w1 - w0) * t;
    // transverse flesh strokes (cylinder shading: center lit)
    for (let k = -1; k <= 1; k++) {
      const off = k * w * 0.3;
      const l = lum + 0.16 * (1 - Math.abs(k)) - 0.08 * t + rr(-0.05, 0.05);
      const h = w * 0.5 * rr(0.75, 1);
      st(cx - nx * h + Math.cos(ang) * 1.2, cy - ny * h + Math.sin(ang) * 1.2,
        cx + nx * off * 1.4, cy + ny * off * 1.4,
        cx + nx * h - Math.cos(ang) * 1.2, cy + ny * h - Math.sin(ang) * 1.2,
        rr(2, 3.6), rampAt(HAND, clamp(l, 0, 1), 4), rr(0.4, 0.65));
    }
    // knuckle shadows
    if (Math.abs(t - 0.32) < 0.03 || Math.abs(t - 0.62) < 0.03) {
      for (let k = 0; k < 3; k++) {
        const h = w * 0.5 * rr(0.7, 1);
        st(cx - nx * h, cy - ny * h, cx + nx * 1.5, cy + ny * 1.5, cx + nx * h, cy + ny * h,
          rr(1.6, 3), jitter("#6d4e30", 3), rr(0.3, 0.5));
      }
    }
  }
  // fingertip
  taper(x2 + Math.cos(ang) * w1 * 0.8, y2 + Math.sin(ang) * w1 * 0.8, x2 + Math.cos(ang) * w1 * 1.1, y2 + Math.sin(ang) * w1 * 1.1, w1 * 1.2, rampAt(HAND, lum + 0.14, 3), 0.75);
  // top-of-finger highlight along the lit edge
  for (let i = 0; i < 8; i++) {
    const t = 0.15 + rng() * 0.7;
    const bow = Math.sin(t * Math.PI) * bend;
    const cx = x1 + (x2 - x1) * t + nx * bow, cy = y1 + (y2 - y1) * t + ny * bow;
    const w = w0 + (w1 - w0) * t;
    const h = rr(4, 9);
    st(cx - Math.cos(ang) * h - nx * w * 0.22, cy - Math.sin(ang) * h - ny * w * 0.22,
      cx - nx * w * 0.4, cy - ny * w * 0.4,
      cx + Math.cos(ang) * h - nx * w * 0.22, cy + Math.sin(ang) * h - ny * w * 0.22,
      rr(1.6, 3), rampAt(HAND, lum + 0.22, 3), rr(0.4, 0.65));
  }
  // nail hint on index-like fingers
  if (w0 > 15) {
    taper(x2 - Math.cos(ang) * 2, y2 - Math.sin(ang) * 2, x2 + Math.cos(ang) * 6, y2 + Math.sin(ang) * 6, w1 * 0.9, jitter("#d9ae80", 3), 0.5);
  }
  // edge shadow along one side
  for (let i = 0; i < 10; i++) {
    const t = rng();
    const bow = Math.sin(t * Math.PI) * bend;
    const cx = x1 + (x2 - x1) * t + nx * bow, cy = y1 + (y2 - y1) * t + ny * bow;
    const w = w0 + (w1 - w0) * t;
    const side = 1;
    st(cx + nx * w * 0.48 - Math.cos(ang) * 4, cy + ny * w * 0.48 - Math.sin(ang) * 4,
      cx + nx * w * 0.52, cy + ny * w * 0.52,
      cx + nx * w * 0.48 + Math.cos(ang) * 4, cy + ny * w * 0.48 + Math.sin(ang) * 4,
      rr(1.4, 2.6), jitter("#58402a", 3), rr(0.25, 0.45));
  }
}
function hands() {
  // warm skin underpaint for the hands (so dark dress strokes cannot dim them)
  const HAND_BASE = "#b3814f";
  S.push(`<ellipse cx="700" cy="1300" rx="76" ry="60" fill="${HAND_BASE}"/>`); nStrokes++;
  S.push(`<ellipse cx="790" cy="1352" rx="66" ry="34" fill="${HAND_BASE}" transform="rotate(16 790 1352)"/>`); nStrokes++;
  // wedge under the draping right-hand fingers (covers gaps between fingers)
  S.push(`<path fill="${HAND_BASE}" d="M716 1308 L736 1330 C 700 1380 640 1420 560 1442 L 548 1418 C 630 1392 680 1352 700 1316 Z"/>`); nStrokes++;
  function fingerBase(x1, y1, x2, y2, w, bend) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const a = Math.atan2(y2 - y1, x2 - x1);
    const nx = -Math.sin(a), ny = Math.cos(a);
    st(x1, y1, mx + nx * bend * 0.6, my + ny * bend * 0.6, x2, y2, w, HAND_BASE, 0.95);
  }

  // left forearm / drapery entering from the right (under the right hand)
  field(380, { x0: 740, y1: 1560, x1: 1200, y0: 1150, test: (x, y) => x > 740 && y > 1150 && !inEll(x, y, 850, 1400, 150, 46) },
    (x, y) => Math.atan2(y - 1330, x - 1240) + Math.PI / 2 + rr(-0.08, 0.08),
    (x, y) => {
      let l = 0.3;
      l += 0.16 * bump(x, y, 960, 1300, 160, 90);
      l -= 0.2 * bump(x, y, 1060, 1470, 120, 90);
      return rampAt(DRESS, clamp(l, 0, 1) + rr(-0.05, 0.05), 4);
    },
    { len: [18, 40], wid: [3, 8], op: [0.4, 0.65], bow: 0.2, fcx: 1240, fcy: 1330 });
  // sleeve fold highlights (her left sleeve, warm ridges)
  for (let i = 0; i < 130; i++) {
    const x = rr(780, 1120), y = rr(1180, 1440);
    if (inEll(x, y, 850, 1400, 150, 46)) continue;
    const a = Math.atan2(y - 1330, x - 1240) + Math.PI / 2;
    const h = rr(10, 26) / 2;
    st(x - Math.cos(a) * h, y - Math.sin(a) * h, x + rr(-3, 3), y + rr(-3, 3), x + Math.cos(a) * h, y + Math.sin(a) * h,
      rr(1.6, 3.2), jitter("#6b5a35", 4), rr(0.3, 0.55));
  }

  // LEFT hand fingers (curling to lower-right, under the right wrist)
  fingerBase(766, 1336, 852, 1388, 13, 6);
  fingerBase(760, 1348, 886, 1396, 14, 7);
  fingerBase(752, 1358, 910, 1404, 13, 8);
  fingerBase(744, 1368, 918, 1418, 12, 9);
  finger(766, 1336, 852, 1388, 15, 11, 0.7, 6);
  finger(760, 1348, 886, 1396, 16, 12, 0.68, 7);
  finger(752, 1358, 910, 1404, 15, 11, 0.66, 8);
  finger(744, 1368, 918, 1418, 14, 10, 0.62, 9);

  // RIGHT hand back (the relaxed hand, top)
  field(300, { x0: 640, y1: 1400, x1: 790, y0: 1230, test: (x, y) => inEll(x, y, 700, 1300, 78, 62) },
    (x, y) => Math.atan2(y - 1330, x - 740) + Math.PI / 2 + rr(-0.1, 0.1),
    (x, y) => {
      let l = 0.72;
      l += 0.18 * bump(x, y, 668, 1272, 40, 34);
      l -= 0.22 * bump(x, y, 748, 1332, 34, 30);  // wrist shadow
      l -= 0.18 * bump(x, y, 742, 1268, 26, 30);
      return rampAt(HAND, clamp(l, 0, 1) + rr(-0.06, 0.06), 4);
    },
    { len: [10, 20], wid: [2, 4], op: [0.5, 0.75], bow: 0.3, fcx: 740, fcy: 1330 });
  // RIGHT hand fingers, relaxed, gently spread, draping down-left
  fingerBase(700, 1328, 600, 1386, 15, 10);
  fingerBase(686, 1336, 570, 1402, 16, 12);
  fingerBase(672, 1344, 556, 1420, 15, 14);
  fingerBase(660, 1352, 566, 1446, 13, 15);
  fingerBase(722, 1318, 652, 1366, 18, 8);
  finger(700, 1328, 600, 1386, 17, 13, 0.74, 10);  // index
  finger(686, 1336, 570, 1402, 18, 13, 0.72, 12);   // middle
  finger(672, 1344, 556, 1420, 17, 12, 0.68, 14);   // ring
  finger(660, 1352, 566, 1446, 15, 11, 0.62, 15);   // little
  finger(722, 1318, 652, 1366, 20, 15, 0.7, 8);     // thumb
  // tendons on the back of the hand
  for (let i = 0; i < 60; i++) {
    const t = rng();
    const x = 700 - t * 40, y = 1330 - t * 10 + rr(-16, 16);
    st(x - 5, y + rr(-1, 1), x - 8, y + rr(-2, 2), x - 11, y + rr(-1, 1), rr(1.2, 2.4), jitter("#98693e", 3), rr(0.25, 0.45));
  }
  // wrist crease + cuff shadow where sleeve meets hand
  for (let i = 0; i < 50; i++) {
    const x = rr(726, 792), y = 1300 + rr(-8, 8) + (x - 760) * 0.25;
    st(x - 7, y, x + rr(-2, 2), y - 2, x + 7, y, rr(2.5, 5), jitter("#6d4e30", 3), rr(0.3, 0.55));
  }
  // contact shadow where right hand crosses the left wrist
  for (let i = 0; i < 90; i++) {
    const x = rr(660, 790), y = 1352 + rr(0, 34);
    st(x - 8, y, x + rr(-3, 3), y + 2, x + 8, y, rr(3, 6), jitter("#4a3320", 4), rr(0.12, 0.3));
  }
  // sheer cuff over the left wrist
  field(80, { x0: 760, y1: 1400, x1: 880, y0: 1300, test: (x, y) => inEll(x, y, 816, 1345, 74, 40) },
    () => Math.PI / 2 + rr(-0.3, 0.3),
    () => jitter("#9a8f7a", 5), { len: [10, 22], wid: [4, 8], op: [0.08, 0.18] });
}

/* =============================================================
   12. CHAIR ARM (pozzetto) + drapery at the bottom
   ============================================================= */
function chair() {
  const noHand = (x, y) => !inEll(x, y, 618, 1382, 200, 86);
  field(200, { x0: 360, y1: 1600, x1: 1180, y0: 1420, test: (x, y) => y > 1420 && x > 340 && x < 1180 && noHand(x, y) },
    (x) => rr(-0.06, 0.06),
    (x, y) => rampAt(DRESS, clamp(0.18 + (y - 1420) / 500, 0, 1) * 0.5 + rr(-0.06, 0.06), 4),
    { len: [20, 44], wid: [4, 9], op: [0.4, 0.65] });
  // armrest top edge highlight
  for (let i = 0; i < 120; i++) {
    const x = rr(360, 1160), y = 1428 + rr(-4, 4);
    if (noHand(x, y)) st(x - 9, y + 1, x + rr(-2, 2), y - 2, x + 9, y + 1, rr(2, 4), jitter("#66503a", 4), rr(0.3, 0.55));
  }
  // drapery folds hanging from the arm
  field(240, { x0: 360, y1: 1600, x1: 1180, y0: 1450, test: (x, y) => y > 1450 && noHand(x, y) },
    (x) => Math.PI / 2 + Math.sin(x / 60) * 0.12 + rr(-0.06, 0.06),
    (x, y) => {
      let l = 0.3 + 0.14 * Math.sin(x / 60 + 1.2);
      l -= clamp((y - 1500) / 300, 0, 1) * 0.12;
      return rampAt(DRESS, clamp(l, 0, 1) + rr(-0.05, 0.05), 4);
    },
    { len: [24, 54], wid: [3, 8], op: [0.4, 0.65] });
}

/* =============================================================
   13. FINAL UNIFYING VARNISH (transparent sfumato + vignette)
   ============================================================= */
function varnish() {
  field(150, { x0: 380, y1: 1240, x1: 1020, y0: 690, test: (x, y) => dressTest(x, y) || chestTest(x, y) },
    (x) => Math.PI / 2 + rr(-0.1, 0.1),
    () => jitter("#4f3b27", 5), { len: [40, 80], wid: [14, 24], op: [0.04, 0.09], bow: 0.1 });
  // old-varnish golden bloom over center
  field(120, { x0: 400, y1: 800, x1: 820, y0: 200, test: () => true },
    () => rr(-0.2, 0.2),
    () => jitter("#8a7a4a", 6), { len: [50, 100], wid: [16, 28], op: [0.03, 0.07], bow: 0.06 });
  // vignette corners
  for (const [cx, cy] of [[0, 0], [1200, 0], [0, 1600], [1200, 1600]]) {
    for (let i = 0; i < 60; i++) {
      const a = Math.atan2(1600 / 2 - cy, 1200 / 2 - cx) + rr(-0.9, 0.9);
      const r = rr(30, 300);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (x < 0 || x > 1200 || y < 0 || y > 1600) continue;
      const h = rr(30, 70) / 2;
      st(x - Math.cos(a) * h, y - Math.sin(a) * h, x + rr(-4, 4), y + rr(-4, 4), x + Math.cos(a) * h, y + Math.sin(a) * h,
        rr(10, 22), jitter("#3a3222", 5), rr(0.04, 0.1));
    }
  }
}

/* =============================================================
   BUILD
   ============================================================= */
underpaint();
sky();
mountains();
midground();
landscapeGlaze();
pillars();
dress();
chestNeck();
hair();
face();
hands();
chair();
varnish();

const svg =
`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600" width="1200" height="1600">
<title>Mona Lisa - sfumato study in pure vector strokes</title>
<desc>Research copy after Leonardo da Vinci, Mona Lisa (c.1503-1506, Musee du Louvre).
Rendered entirely from hand-organized short arc strokes and tapered strokes
simulating oil glazing and sfumato. No bitmaps, no photo fills, no smooth
color transitions as substitutes for form:
every form is built from layered vector brush strokes. Reference: Wikimedia
Commons, public domain (PD-Art / PD-old-100-expired / CC-PD-Mark-1.0).</desc>
${S.join("\n")}
</svg>
`;

const out = path.join(__dirname, "mona_lisa.svg");
fs.writeFileSync(out, svg, "utf8");
console.log("strokes:", nStrokes, "| total elements:", S.length, "| bytes:", Buffer.byteLength(svg, "utf8"));
