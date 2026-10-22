/* ============================================================
 * core.js — 数学库 / 程序化网格构建器 / 零件与材质注册表
 * 约定: 右手坐标系, +Y 上, -Z 为车头方向, +X 为车体右侧
 * 全局命名空间: window.VT4
 * ============================================================ */
"use strict";
window.VT4 = window.VT4 || {};

/* ---------------- 向量 / 矩阵 (列主序 mat4) ---------------- */
(function (M) {
  M.TAU = Math.PI * 2;
  M.rad = d => d * Math.PI / 180;

  M.v3 = (x = 0, y = 0, z = 0) => [x, y, z];
  M.add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  M.sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  M.scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  M.dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  M.cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  M.len = a => Math.hypot(a[0], a[1], a[2]);
  M.norm = a => { const l = M.len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  M.lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  M.m4 = () => new Float32Array(16);
  M.ident = () => { const m = M.m4(); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  M.mul = (a, b) => {          // out = a * b  (列主序)
    const o = M.m4();
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  };
  M.persp = (fovY, asp, n, f) => {
    const m = M.m4(), t = 1 / Math.tan(fovY / 2), nf = 1 / (n - f);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) * nf; m[11] = -1; m[14] = 2 * f * n * nf;
    return m;
  };
  M.ortho = (l, r, b, t, n, f) => {
    const m = M.ident();
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = 1 / (n - f);
    m[12] = (l + r) / (l - r); m[13] = (b + t) / (b - t); m[14] = n / (n - f);
    return m;
  };
  M.lookAt = (e, c, up) => {
    const z = M.norm(M.sub(e, c)), x = M.norm(M.cross(up, z)), y = M.cross(z, x);
    const m = M.ident();
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -M.dot(x, e); m[13] = -M.dot(y, e); m[14] = -M.dot(z, e);
    return m;
  };
  M.trans = (x, y, z) => { const m = M.ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
  M.rotX = a => { const m = M.ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
  M.rotY = a => { const m = M.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
  M.rotZ = a => { const m = M.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; };
  M.scl = (x, y, z) => { const m = M.m4(); m[0] = x; m[5] = y; m[10] = z; m[15] = 1; return m; };
  M.fromBasis = (bx, by, bz, p) => {
    const m = M.ident();
    m[0] = bx[0]; m[1] = bx[1]; m[2] = bx[2];
    m[4] = by[0]; m[5] = by[1]; m[6] = by[2];
    m[8] = bz[0]; m[9] = bz[1]; m[10] = bz[2];
    m[12] = p[0]; m[13] = p[1]; m[14] = p[2];
    return m;
  };
  M.applyP = (m, p) => {
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] || 1;
    return [
      (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w,
      (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w,
      (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w];
  };
  M.applyD = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2]];
  M.invert = m => {
    const inv = M.m4(), d = m;
    const a = [];
    for (let i = 0; i < 16; i++) a[i] = d[i];
    const inv2 = [];
    inv2[0] = a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10];
    inv2[4] = -a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10];
    inv2[8] = a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9];
    inv2[12]= -a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9];
    inv2[1] = -a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10];
    inv2[5] = a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10];
    inv2[9] = -a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9];
    inv2[13]= a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9];
    inv2[2] = a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[13]*a[2]*a[7]-a[13]*a[3]*a[6];
    inv2[6] = -a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[12]*a[2]*a[7]+a[12]*a[3]*a[6];
    inv2[10]= a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[12]*a[1]*a[7]-a[12]*a[3]*a[5];
    inv2[14]= -a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[12]*a[1]*a[6]+a[12]*a[2]*a[5];
    inv2[3] = -a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6];
    inv2[7] = a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6];
    inv2[11]= -a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5];
    inv2[15]= a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5];
    let det = a[0]*inv2[0]+a[1]*inv2[4]+a[2]*inv2[8]+a[3]*inv2[12];
    det = det ? 1 / det : 0;
    for (let i = 0; i < 16; i++) inv[i] = inv2[i] * det;
    return inv;
  };
  // TRS 组合: T * Ry * Rx * Rz * S
  M.trs = (tx, ty, tz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
    M.mul(M.trans(tx, ty, tz), M.mul(M.rotY(ry), M.mul(M.rotX(rx), M.mul(M.rotZ(rz), M.scl(sx, sy, sz)))));
  // 3x3 法线矩阵 (逆转置), 输出 mat3 -> Float32Array(9) 列主序
  M.nmat3 = m => {
    const a00=m[0],a01=m[1],a02=m[2],a10=m[4],a11=m[5],a12=m[6],a20=m[8],a21=m[9],a22=m[10];
    const b01=a22*a11-a12*a21, b11=-a22*a10+a12*a20, b21=a21*a10-a11*a20;
    let det=a00*b01+a01*b11+a02*b21; det=det?1/det:0;
    return new Float32Array([
      b01*det, (-a22*a01+a02*a21)*det, (a12*a01-a02*a11)*det,
      b11*det, (a22*a00-a02*a20)*det, (-a12*a00+a02*a10)*det,
      b21*det, (-a21*a00+a01*a20)*det, (a11*a00-a01*a10)*det]);
  };
  M.applyN3 = (n, p) => [
    n[0]*p[0]+n[3]*p[1]+n[6]*p[2],
    n[1]*p[0]+n[4]*p[1]+n[7]*p[2],
    n[2]*p[0]+n[5]*p[1]+n[8]*p[2]];

  // 简易可播种随机数 (mulberry32)
  M.rng = seed => { let a = seed >>> 0; return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  // 闭合 Catmull-Rom 采样 (2D 点列 -> 平滑采样点列)
  M.catmullClosed = (pts, per) => {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    return out;
  };
  // 按弧长重采样 -> [{p:[x,y], t:[tx,ty]}]
  M.resampleArc = (pts, count) => {
    const seg = [], total = [];
    let L = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); L += l; total.push(L);
    }
    const out = []; let acc = 0, i = 0;
    for (let k = 0; k < count; k++) {
      const d = k / count * L;
      while (i < total.length - 1 && total[i] < d) i++;
      const prevL = i === 0 ? 0 : total[i - 1];
      const a = pts[i % pts.length], b = pts[(i + 1) % pts.length];
      const t = seg[i] > 0 ? (d - prevL) / seg[i] : 0;
      const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      const tx = (b[0] - a[0]) / (seg[i] || 1), ty = (b[1] - a[1]) / (seg[i] || 1);
      out.push({ p: [px, py], t: [tx, ty] });
    }
    return { pts: out, total: L };
  };

  // 简单 2D 多边形耳切三角化 (顶点逆时针或顺时针皆可)
  M.triangulate = pts => {
    const n = pts.length;
    if (n < 3) return [];
    const idx = []; for (let i = 0; i < n; i++) idx.push(i);
    let area = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) idx.reverse();
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const inTri = (p, a, b, c) => {
      const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
      return !(d1 < 0 || d2 < 0 || d3 < 0);
    };
    const tris = []; let guard = 0;
    while (idx.length > 3 && guard++ < n * n) {
      let clipped = false;
      for (let i = 0; i < idx.length; i++) {
        const i0 = idx[(i - 1 + idx.length) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
        const a = pts[i0], b = pts[i1], c = pts[i2];
        if (cross(a, b, c) <= 1e-12) continue;
        let ok = true;
        for (const j of idx) {
          if (j === i0 || j === i1 || j === i2) continue;
          if (inTri(pts[j], a, b, c)) { ok = false; break; }
        }
        if (ok) { tris.push(i0, i1, i2); idx.splice(i, 1); clipped = true; break; }
      }
      if (!clipped) break;
    }
    if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
    return tris;
  };
})(window.VT4.M = {});

/* ---------------- 零件注册表 ----------------
 * shell: 外壳件 —— X-Ray 模式下被透视
 * sys:   所属分系统 (hull/turret/run/interior/crew) 用于隔离显示
 * dir:   爆炸图分离方向与权重
 */
(function () {
  const P = VT4.P = {}; const list = VT4.partList = [];
  function def(id, name, opt) {
    P[id] = list.length;
    list.push(Object.assign({ id, name, shell: false, sys: "hull", dir: [0, 0, 0], changed: false }, opt));
    return P[id];
  }
  // —— 车体结构 ——
  def("HULL_LOW",  "下车体 · 装甲壳体",        { shell: 1, sys: "hull", dir: [0, -0.5, 0] });
  def("HULL_DECK", "车体顶甲板 · 动力舱盖板",   { shell: 1, sys: "hull", dir: [0, 0.9, 0.3] });
  def("GLACIS",    "首上装甲板",               { shell: 1, sys: "hull", dir: [0, 0.5, -1] });
  def("FENDERS",   "翼子板 / 随车工具",         { shell: 1, sys: "hull", dir: [0, 0.7, 0] });
  def("SKIRT_L",   "左侧屏蔽裙板",              { shell: 1, sys: "hull", dir: [-1.6, 0, 0] });
  def("SKIRT_R",   "右侧屏蔽裙板",              { shell: 1, sys: "hull", dir: [1.6, 0, 0] });
  def("REAR_GRILLE","尾部散热格栅 / 排气口",     { shell: 1, sys: "hull", dir: [0, 0.3, 1.4] });
  def("MUDFLAP",   "前挡泥板组件",              { shell: 1, sys: "hull", dir: [0, 0.2, -1.6] });
  // —— 炮塔 ——
  def("TURRET",    "炮塔 · 焊接装甲壳体",       { shell: 1, sys: "turret", dir: [0, 1.5, 0] });
  def("TUR_ROOF",  "炮塔顶板 / 加厚装甲",        { shell: 1, sys: "turret", dir: [0, 2.1, 0] });
  def("MANTLET",   "火炮防盾",                  { shell: 1, sys: "turret", dir: [0, 0.4, -1.2] });
  def("GUN",       "125mm 滑膛炮身管",          { shell: 1, sys: "turret", dir: [0, 0.25, -2.6] });
  def("FUME",      "炮管抽烟装置",              { shell: 1, sys: "turret", dir: [0, 0.25, -2.9] });
  def("CUPOLA",    "车长指挥塔 / 舱盖",          { shell: 1, sys: "turret", dir: [0, 2.0, 0.2] });
  def("CMD_SIGHT", "车长独立周视瞄准镜",         { shell: 1, sys: "turret", dir: [0, 2.3, 0] });
  def("GUN_SIGHT", "炮长稳像式瞄准镜",           { shell: 1, sys: "turret", dir: [0, 2.2, -0.3] });
  def("RWS",       "遥控武器站 (12.7mm)",        { shell: 1, sys: "turret", dir: [0, 2.4, 0.4] });
  def("SMOKE",     "烟幕弹发射器组",             { shell: 1, sys: "turret", dir: [0, 1.6, 0.8] });
  def("STOWAGE",   "炮塔储物篮 / 附品",          { sys: "turret", dir: [0, 1.4, 1.2] });
  def("TOW",       "牵引钢缆 / 自救木",          { sys: "hull", dir: [0, 1.0, 0] });
  // —— 反应装甲 ——
  def("ERA_GLACIS","首上 FY-4 反应装甲",         { shell: 1, sys: "hull", dir: [0, 0.9, -1.4] });
  def("ERA_TUR_L", "炮塔左 FY-4 反应装甲",       { shell: 1, sys: "turret", dir: [-0.9, 1.1, -0.7] });
  def("ERA_TUR_R", "炮塔右 FY-4 反应装甲",       { shell: 1, sys: "turret", dir: [0.9, 1.1, -0.7] });
  def("ERA_SIDE_L","左侧 FY-2 裙板反应装甲",      { shell: 1, sys: "hull", dir: [-2.0, 0.3, 0] });
  def("ERA_SIDE_R","右侧 FY-2 裙板反应装甲",      { shell: 1, sys: "hull", dir: [2.0, 0.3, 0] });
  // —— 行动装置 ——
  def("WHEEL_L",   "左侧负重轮组 (6)",           { sys: "run", dir: [-1.3, 0, 0] });
  def("WHEEL_R",   "右侧负重轮组 (6)",           { sys: "run", dir: [1.3, 0, 0] });
  def("TRACK_L",   "左侧双销挂胶履带",           { sys: "run", dir: [-2.0, 0, 0] });
  def("TRACK_R",   "右侧双销挂胶履带",           { sys: "run", dir: [2.0, 0, 0] });
  def("DRIVE_L",   "左主动轮 / 诱导轮 / 托带轮",  { sys: "run", dir: [-1.5, 0, 0.4] });
  def("DRIVE_R",   "右主动轮 / 诱导轮 / 托带轮",  { sys: "run", dir: [1.5, 0, 0.4] });
  // —— 动力舱 ——
  def("ENGINE",    "1300hp 涡轮增压柴油机",      { sys: "interior", dir: [0, 0.6, 1.6] });
  def("TURBO",     "废气涡轮增压器",             { sys: "interior", dir: [0, 1.0, 1.8] });
  def("TRANS",     "综合液力传动箱",             { sys: "interior", dir: [0, 0.5, 2.2] });
  def("RADIATOR",  "冷却散热组件",               { sys: "interior", dir: [0, 0.9, 2.0] });
  def("FANS",      "冷却风扇组",                 { sys: "interior", dir: [0, 1.2, 2.2] });
  def("EXHAUST",   "排气歧管与管路",             { sys: "interior", dir: [0, 0.7, 2.4] });
  def("FUEL",      "车内燃油箱组",               { sys: "interior", dir: [1.2, 0.4, 0] });
  // —— 战斗舱 ——
  def("BASKET",    "吊篮式旋转底板",             { sys: "interior", dir: [0, 0.9, 0] });
  def("CAROUSEL",  "盘式自动装弹机弹盘",         { sys: "interior", dir: [0, 1.4, 0] });
  def("RAMMER",    "输弹机 / 推弹链条",          { sys: "interior", dir: [0, 1.7, 0.5] });
  def("BREECH",    "炮尾炮闩 / 驻退复进机",      { sys: "interior", dir: [0, 1.8, -0.6] });
  def("AMMO",      "125mm 弹药 (弹丸+药筒)",      { sys: "interior", dir: [0, 1.6, 0] });
  def("SEAT_CMD",  "车长座椅",                   { sys: "interior", dir: [0, 1.5, 0.6] });
  def("SEAT_GUN",  "炮长座椅",                   { sys: "interior", dir: [0, 1.5, -0.3] });
  // —— 驾驶舱 ——
  def("SEAT_DRV",  "驾驶员座椅",                 { sys: "interior", dir: [0, 1.3, -0.9] });
  def("DRV_PANEL", "驾驶台综合数字面板",          { sys: "interior", dir: [0, 1.4, -1.6] });
  def("STEERING",  "方向盘驾驶操纵机构",          { sys: "interior", dir: [0, 1.5, -1.9] });
  def("PERI_DRV",  "驾驶舱潜望镜组",             { sys: "interior", dir: [0, 1.7, -1.4] });
  // —— 乘员 ——
  def("CREW_CMD",  "乘员 · 车长",                { sys: "crew", dir: [0, 1.9, 0.4] });
  def("CREW_GUN",  "乘员 · 炮长",                { sys: "crew", dir: [0, 1.9, -0.2] });
  def("CREW_DRV",  "乘员 · 驾驶员",              { sys: "crew", dir: [0, 1.5, -1.2] });
  // —— A1 选配套件 ——
  def("APS_RADAR", "毫米波雷达阵列 (A1)",        { shell: 1, sys: "turret", dir: [0, 1.9, 0.4] });
  def("APS_TUBE",  "主动防御拦截弹发射器 (A1)",   { shell: 1, sys: "turret", dir: [0, 2.0, 0.2] });
  def("DRONE",     "车载无人机发射管 (A1)",       { shell: 1, sys: "turret", dir: [0, 2.4, 0.9] });
  def("LWR",       "激光告警接收器 (A1)",         { shell: 1, sys: "turret", dir: [0, 2.2, 0] });
  def("RWS_HVY",   "重型遥控武器站 (A1)",         { shell: 1, sys: "turret", dir: [0, 2.6, 0.4] });
  // —— 场景 ——
  def("GROUND",    "沙砾地面",                   { sys: "env", dir: [0, 0, 0] });
  def("ROCKS",     "碎石散布",                   { sys: "env", dir: [0, 0, 0] });
  VT4.NPARTS = list.length;
})();

/* ---------------- 材质注册表 (PBR) ---------------- */
(function () {
  const A = VT4.MAT = {}; const list = VT4.matList = [];
  function def(id, c, metal, rough, emis = 0, opt) {
    A[id] = list.length;
    list.push(Object.assign({ c, metal, rough, emis }, opt));
    return A[id];
  }
  def("PAINT",    [0.335, 0.345, 0.240], 0.30, 0.62);   // 整车军绿面漆
  def("PAINT_D",  [0.235, 0.245, 0.180], 0.30, 0.66);   // 深一号涂装
  def("ERA",      [0.290, 0.310, 0.215], 0.35, 0.55);   // 反应装甲盒体
  def("ERA2",     [0.255, 0.265, 0.200], 0.35, 0.58);   // FY-2 改型盒体
  def("RUBBER",   [0.055, 0.055, 0.058], 0.05, 0.92);
  def("STEEL",    [0.400, 0.410, 0.430], 0.88, 0.38);
  def("GUNMET",   [0.175, 0.180, 0.175], 0.82, 0.42);   // 身管金属
  def("TRACK",    [0.195, 0.185, 0.165], 0.78, 0.52);   // 履带板
  def("GLASS",    [0.070, 0.150, 0.160], 0.40, 0.12);   // 潜望镜玻璃
  def("OPTIC",    [0.100, 0.280, 0.230], 0.55, 0.10, 0.15); // 瞄准镜镀膜
  def("INTERIOR", [0.430, 0.425, 0.385], 0.15, 0.82);   // 舱内壁面
  def("MACHINE",  [0.310, 0.320, 0.335], 0.78, 0.45);   // 机电设备
  def("ENGINE",   [0.270, 0.275, 0.290], 0.72, 0.48);
  def("PIPES",    [0.380, 0.300, 0.200], 0.75, 0.45);   // 排气/油管
  def("BRASS",    [0.560, 0.430, 0.170], 0.90, 0.32);   // 药筒
  def("PROJ",     [0.180, 0.200, 0.190], 0.85, 0.35);   // 弹丸
  def("SEAT",     [0.250, 0.265, 0.190], 0.05, 0.95);
  def("SCREEN",   [0.150, 0.750, 0.720], 0.10, 0.25, 2.6); // 数字面板屏
  def("SCREEN2",  [0.750, 0.520, 0.140], 0.10, 0.30, 2.0); // 告警灯
  def("SKIN",     [0.560, 0.430, 0.340], 0.02, 0.72);
  def("UNIFORM",  [0.255, 0.285, 0.210], 0.02, 0.92);
  def("HELMET",   [0.230, 0.240, 0.200], 0.10, 0.80);
  def("VEST",     [0.290, 0.295, 0.230], 0.05, 0.90);
  def("SAND",     [0.560, 0.490, 0.350], 0.00, 0.96);
  def("SAND_D",   [0.400, 0.345, 0.240], 0.00, 0.97);   // 压痕阴影土
  def("ROCK",     [0.430, 0.415, 0.380], 0.00, 0.90);
  def("CABLE",    [0.075, 0.075, 0.080], 0.60, 0.60);
  def("DARK",     [0.090, 0.090, 0.095], 0.30, 0.80);
  def("RADAR",    [0.400, 0.410, 0.395], 0.45, 0.50);   // 雷达天线罩
  def("MARK",     [0.820, 0.810, 0.740], 0.10, 0.70);   // 标识涂白
  def("RED",      [0.560, 0.140, 0.100], 0.30, 0.60);
  VT4.NMATS = list.length;
})();

/* ---------------- 网格构建器 ---------------- */
(function () {
  const M = VT4.M;

  /* MeshBuilder: 逐零件累加顶点 [pos3, nrm3, mat, part] */
  class MB {
    constructor() {
      this.pos = []; this.nrm = []; this.aux = []; this.idx = [];
      this.aabb = {};   // partId -> {min,max}
      this.mat = VT4.MAT.PAINT; this.part = 0;
      this._n = M.ident();
    }
    set(mat, part) { if (mat !== undefined) this.mat = mat; if (part !== undefined) this.part = part; return this; }
    _push(p, n) {
      const i = this.pos.length / 3;
      this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]);
      this.aux.push(this.mat, this.part);
      const a = this.aabb[this.part] || (this.aabb[this.part] = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
      for (let k = 0; k < 3; k++) { if (p[k] < a.min[k]) a.min[k] = p[k]; if (p[k] > a.max[k]) a.max[k] = p[k]; }
      return i;
    }
    tri(a, b, c) { this.idx.push(a, b, c); }
    /* 通用: 提交一组局部顶点+法线+索引, 经 xf(mat4) 变换 */
    geom(verts, norms, inds, xf) {
      const nm = xf ? M.nmat3(xf) : null;
      const base = this.pos.length / 3;
      for (let i = 0; i < verts.length; i += 3) {
        const p = [verts[i], verts[i + 1], verts[i + 2]];
        const n = [norms[i], norms[i + 1], norms[i + 2]];
        const wp = xf ? M.applyP(xf, p) : p;
        let wn = nm ? M.applyN3(nm, n) : n;
        wn = M.norm(wn);
        this._push(wp, wn);
      }
      for (const t of inds) this.idx.push(base + t);
      return this;
    }

    /* 盒体 (中心原点) */
    box(sx, sy, sz, xf) {
      const x = sx / 2, y = sy / 2, z = sz / 2;
      const f = (p, n) => { // 每个面 4 点
        const b = this.pos.length / 3;
        const nm = xf ? M.nmat3(xf) : null;
        const wn = xf ? M.norm(M.applyN3(nm, n)) : n;
        for (const q of p) this._push(xf ? M.applyP(xf, q) : q, wn);
        this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
      f([[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]], [0,0,1]);
      f([[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]], [0,0,-1]);
      f([[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]], [1,0,0]);
      f([[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]], [-1,0,0]);
      f([[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]], [0,1,0]);
      f([[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]], [0,-1,0]);
      return this;
    }
    /* 任意四边形/三角形面片 (平面法线) */
    quad(p0, p1, p2, p3, xf) {
      const pts = p3 ? [p0, p1, p2, p3] : [p0, p1, p2];
      let n = M.norm(M.cross(M.sub(pts[1], pts[0]), M.sub(pts[2], pts[0])));
      const b = this.pos.length / 3;
      const nm = xf ? M.nmat3(xf) : null;
      const wn = xf ? M.norm(M.applyN3(nm, n)) : n;
      for (const q of pts) this._push(xf ? M.applyP(xf, q) : q, wn);
      if (p3) this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); else this.idx.push(b, b + 1, b + 2);
      return this;
    }
    /* 沿 Z 挤出 XY 轮廓 (depth 居中) */
    extrude(pts, depth, xf, cap = true) {
      const n = pts.length, h = depth / 2;
      const verts = [], norms = [], inds = [];
      for (let i = 0; i < n; i++) {  // 侧壁
        const a = pts[i], b = pts[(i + 1) % n];
        const e = [b[0] - a[0], b[1] - a[1]];
        const nn = M.norm([e[1], -e[0], 0]);
        const bIdx = verts.length / 3;
        verts.push(a[0], a[1], -h, b[0], b[1], -h, b[0], b[1], h, a[0], a[1], h);
        for (let k = 0; k < 4; k++) norms.push(nn[0], nn[1], nn[2]);
        inds.push(bIdx, bIdx + 1, bIdx + 2, bIdx, bIdx + 2, bIdx + 3);
      }
      if (cap) {
        const tris = M.triangulate(pts);  // 始终输出 CCW(XY) 序 -> +Z 法线
        for (const s of [1, -1]) {
          const bIdx = verts.length / 3;
          for (const p of pts) { verts.push(p[0], p[1], s * h); norms.push(0, 0, s); }
          if (s > 0) for (const t of tris) inds.push(bIdx + t);
          else for (let i = 0; i < tris.length; i += 3) inds.push(bIdx + tris[i], bIdx + tris[i + 2], bIdx + tris[i + 1]);
        }
      }
      return this.geom(verts, norms, inds, xf);
    }
    /* 上下两层轮廓的变截面棱柱 (turret 等) —— 轮廓为 XZ 平面点列, 逆时针(俯视) */
    prism(bot, top, y0, y1, xf) {
      const n = bot.length;
      const verts = [], norms = [], inds = [];
      for (let i = 0; i < n; i++) {
        const a = bot[i], b = bot[(i + 1) % n], c = top[(i + 1) % n], d = top[i];
        const e1 = [b[0] - a[0], 0, b[1] - a[1]];
        const e2 = [d[0] - a[0], y1 - y0, d[1] - a[1]];
        const nn = M.norm(M.cross(e2, e1));
        const bIdx = verts.length / 3;
        verts.push(a[0], y0, a[1], d[0], y1, d[1], c[0], y1, c[1], b[0], y0, b[1]);
        for (let k = 0; k < 4; k++) norms.push(nn[0], nn[1], nn[2]);
        inds.push(bIdx, bIdx + 1, bIdx + 2, bIdx, bIdx + 2, bIdx + 3);
      }
      // XZ 平面 CCW 序 -> 几何法线为 -Y, 故顶盖(+Y)需反序
      for (const [poly, y, s] of [[top, y1, 1], [bot, y0, -1]]) {
        const tris = M.triangulate(poly);
        const bIdx = verts.length / 3;
        for (const p of poly) { verts.push(p[0], y, p[1]); norms.push(0, s, 0); }
        if (s < 0) for (const t of tris) inds.push(bIdx + t);
        else for (let i = 0; i < tris.length; i += 3) inds.push(bIdx + tris[i], bIdx + tris[i + 2], bIdx + tris[i + 1]);
      }
      return this.geom(verts, norms, inds, xf);
    }
    /* 圆柱/锥台 (沿 +Y, 中心原点), cap 控制封口 */
    cyl(r0, r1, h, seg = 16, xf, cap = true) {
      const verts = [], norms = [], inds = [], hh = h / 2;
      const slope = (r0 - r1) / h;
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * M.TAU, c = Math.cos(a), s = Math.sin(a);
        const ny = slope / Math.hypot(1, slope * slope), nr = 1 / Math.hypot(1, slope * slope);
        verts.push(c * r0, -hh, s * r0); norms.push(c * nr, ny, s * nr);
        verts.push(c * r1, hh, s * r1);  norms.push(c * nr, ny, s * nr);
      }
      for (let i = 0; i < seg; i++) {
        const b = i * 2;
        inds.push(b, b + 1, b + 3, b, b + 3, b + 2);
      }
      if (cap) {
        for (const [y, r, s] of [[hh, r1, 1], [-hh, r0, -1]]) {
          if (r <= 1e-5) continue;
          const cIdx = verts.length / 3;
          verts.push(0, y, 0); norms.push(0, s, 0);
          const ring = verts.length / 3;
          for (let i = 0; i <= seg; i++) {
            const a = i / seg * M.TAU;
            verts.push(Math.cos(a) * r, y, Math.sin(a) * r); norms.push(0, s, 0);
          }
          // 环序在 XZ 平面为 CCW -> -Y; 顶盖(+Y)需反序
          for (let i = 0; i < seg; i++)
            if (s > 0) inds.push(cIdx, ring + i + 1, ring + i);
            else inds.push(cIdx, ring + i, ring + i + 1);
        }
      }
      return this.geom(verts, norms, inds, xf);
    }
    /* 圆管 (不封口) */
    tube(r, h, seg, xf) { return this.cyl(r, r, h, seg, xf, false); }
    /* 车削: profile=[[r,y],...] 绕 Y 轴 */
    lathe(profile, seg, xf, capEnds = true) {
      const verts = [], norms = [], inds = [], np = profile.length;
      for (let i = 0; i < np; i++) {
        const p = profile[i];
        const q = profile[Math.min(i + 1, np - 1)], o = profile[Math.max(i - 1, 0)];
        const tr = q[0] - o[0], ty = q[1] - o[1];
        const nl = Math.hypot(ty, tr) || 1;
        const nr = ty / nl, ny = -tr / nl;
        for (let j = 0; j <= seg; j++) {
          const a = j / seg * M.TAU, c = Math.cos(a), s = Math.sin(a);
          verts.push(c * p[0], p[1], s * p[0]);
          norms.push(c * nr, ny, s * nr);
        }
      }
      const ring = seg + 1;
      for (let i = 0; i < np - 1; i++) for (let j = 0; j < seg; j++) {
        const b = i * ring + j;
        inds.push(b, b + ring, b + ring + 1, b, b + ring + 1, b + 1);
      }
      if (capEnds) {
        const ends = [[0, -1], [np - 1, 1]];
        for (const [pi, s] of ends) {
          const r = profile[pi][0], y = profile[pi][1];
          if (r <= 1e-5) continue;
          const cIdx = verts.length / 3;
          verts.push(0, y, 0); norms.push(0, s, 0);
          const ringBase = verts.length / 3;
          for (let j = 0; j <= seg; j++) {
            const a = j / seg * M.TAU;
            verts.push(Math.cos(a) * r, y, Math.sin(a) * r); norms.push(0, s, 0);
          }
          for (let j = 0; j < seg; j++)
            if (s > 0) inds.push(cIdx, ringBase + j + 1, ringBase + j);
            else inds.push(cIdx, ringBase + j, ringBase + j + 1);
        }
      }
      return this.geom(verts, norms, inds, xf);
    }
    /* 球 (可经 xf 缩放为椭球) */
    sphere(r, ws, hs, xf) {
      const verts = [], norms = [], inds = [];
      for (let iy = 0; iy <= hs; iy++) {
        const v = iy / hs, ph = v * Math.PI;
        for (let ix = 0; ix <= ws; ix++) {
          const u = ix / ws, th = u * M.TAU;
          const x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th);
          verts.push(x * r, y * r, z * r); norms.push(x, y, z);
        }
      }
      const ring = ws + 1;
      for (let iy = 0; iy < hs; iy++) for (let ix = 0; ix < ws; ix++) {
        const b = iy * ring + ix;
        inds.push(b, b + 1, b + ring + 1, b, b + ring + 1, b + ring);
      }
      return this.geom(verts, norms, inds, xf);
    }
    /* 圆环 */
    torus(R, r, ws, hs, xf) {
      const verts = [], norms = [], inds = [];
      for (let i = 0; i <= ws; i++) {
        const u = i / ws * M.TAU, cu = Math.cos(u), su = Math.sin(u);
        for (let j = 0; j <= hs; j++) {
          const v = j / hs * M.TAU, cv = Math.cos(v), sv = Math.sin(v);
          verts.push((R + r * cv) * cu, r * sv, (R + r * cv) * su);
          norms.push(cv * cu, sv, cv * su);
        }
      }
      const ring = hs + 1;
      for (let i = 0; i < ws; i++) for (let j = 0; j < hs; j++) {
        const b = i * ring + j;
        inds.push(b, b + 1, b + ring + 1, b, b + ring + 1, b + ring);
      }
      return this.geom(verts, norms, inds, xf);
    }
    merge(o) {
      const base = this.pos.length / 3;
      this.pos.push(...o.pos); this.nrm.push(...o.nrm); this.aux.push(...o.aux);
      for (const t of o.idx) this.idx.push(base + t);
      for (const k in o.aabb) {
        const s = o.aabb[k], d = this.aabb[k] || (this.aabb[k] = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
        for (let i = 0; i < 3; i++) { d.min[i] = Math.min(d.min[i], s.min[i]); d.max[i] = Math.max(d.max[i], s.max[i]); }
      }
      return this;
    }
    finalize() {
      const nv = this.pos.length / 3;
      const data = new Float32Array(nv * 8);
      for (let i = 0; i < nv; i++) {
        data[i * 8] = this.pos[i * 3]; data[i * 8 + 1] = this.pos[i * 3 + 1]; data[i * 8 + 2] = this.pos[i * 3 + 2];
        data[i * 8 + 3] = this.nrm[i * 3]; data[i * 8 + 4] = this.nrm[i * 3 + 1]; data[i * 8 + 5] = this.nrm[i * 3 + 2];
        data[i * 8 + 6] = this.aux[i * 2]; data[i * 8 + 7] = this.aux[i * 2 + 1];
      }
      return { verts: data, idx: new Uint32Array(this.idx), aabb: this.aabb, nv, ni: this.idx.length };
    }
  }
  VT4.MB = MB;
})();
