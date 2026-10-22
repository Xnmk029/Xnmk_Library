/* ============================================================
 * tank.js — VT-4 (MBT-3000) 主战坦克程序化建模
 * 坐标: +Y 上 / -Z 车头 / +X 右侧(从车后看)   单位: 米
 * 所有几何体均由代码构建, 无外部资产
 * ============================================================ */
"use strict";
(function () {
  const M = VT4.M, P = VT4.P, A = VT4.MAT;
  const rad = M.rad;

  /* —— 主要尺寸基准 —— */
  const D = {
    hullW: 2.72, hullBot: 0.42, hullTop: 1.45,
    turCZ: -0.45,           // 炮塔座圈中心 z
    turH: 0.74,             // 炮塔净高
    gunPivot: [0, 1.97, -1.72],
    wheelX: 1.30, wheelR: 0.38, trackT: 0.09,
    wheelZ: [-2.55, -1.62, -0.62, 0.45, 1.45, 2.42],
    sprocketZ: 3.02, sprocketY: 0.60, sprocketR: 0.27,
    idlerZ: -3.02, idlerY: 0.55, idlerR: 0.30,
    rollZ: [-1.55, 0.10, 1.75], rollY: 1.00, rollR: 0.11,
  };
  VT4.DIMS = D;
  // 需要随火炮俯仰的零件组
  VT4.GUN_PARTS = new Set([P.GUN, P.FUME, P.MANTLET, P.BREECH]);

  /* ---------- 工具 ---------- */
  // 两点间圆柱(连杆/管件/肢体)
  function seg(mb, a, b, r, segN = 8, mat, part, r2) {
    const d = M.sub(b, a), l = M.len(d) || 1e-4;
    const by = M.scale(d, 1 / l);
    let bx = M.cross(by, [0, 0, 1]);
    if (M.len(bx) < 0.05) bx = M.cross(by, [1, 0, 0]);
    bx = M.norm(bx);
    const bz = M.norm(M.cross(bx, by));
    const mid = M.scale(M.add(a, b), 0.5);
    mb.set(mat, part).cyl(r, r2 === undefined ? r : r2, l, segN, M.fromBasis(bx, by, bz, mid));
  }
  // 沿 +Z 的圆柱(前后向)
  const xfZ = (x, y, z, extra) => M.mul(M.trans(x, y, z), M.mul(extra || M.ident(), M.rotX(-Math.PI / 2)));
  // 沿 X 的圆柱(横向轮轴)
  const xfX = (x, y, z, extra) => M.mul(M.trans(x, y, z), M.mul(extra || M.ident(), M.rotZ(-Math.PI / 2)));

  /* ============================================================
   * 车体
   * ============================================================ */
  function buildHull(mb, v) {
    const A_ = A;
    // —— 下车体: 侧视截面挤出 ——
    const prof = [
      [-3.20, 0.42], [3.45, 0.42], [3.45, 1.30], [3.10, 1.42],
      [-2.45, 1.42], [-3.28, 0.86], [-3.45, 0.78], [-3.45, 0.50]];
    mb.set(A_.PAINT, P.HULL_LOW).extrude(prof, D.hullW, M.rotY(-Math.PI / 2));

    // 侧壁下部内收(行动舱遮蔽)
    mb.set(A_.PAINT_D, P.HULL_LOW).box(2.30, 0.30, 5.6, M.trans(0, 0.50, 0.1));

    // —— 首上附加装甲板 ——
    if (v === "p") {
      // VT-4 P: 首上附加装甲外形为整块斜置加强板
      const nrm = [0, 0.83, -0.56], tan = [0, 0.56, 0.83];
      mb.set(A_.PAINT_D, P.GLACIS).geom(
        plateVerts(2.55, 0.10, 0.95), plateNorms(), plateIdx(),
        M.fromBasis([1, 0, 0], nrm, tan, [0, 1.13, -2.86]));
    } else {
      const nrm = [0, 0.83, -0.56], tan = [0, 0.56, 0.83];
      mb.set(A_.PAINT_D, P.GLACIS).geom(
        plateVerts(2.45, 0.08, 0.80), plateNorms(), plateIdx(),
        M.fromBasis([1, 0, 0], nrm, tan, [0, 1.10, -2.88]));
    }

    // —— 首上 FY-4 ERA 阵列 ——
    const nrm = [0, 0.83, -0.56], tan = [0, 0.56, 0.83];
    const eraRows = v === "p"
      ? [{ y: 1.20, z: -2.80, n: 9, w: 0.27 }, { y: 0.98, z: -3.06, n: 9, w: 0.27 }]
      : [{ y: 1.26, z: -2.74, n: 8, w: 0.30 }, { y: 1.06, z: -2.94, n: 9, w: 0.27 }, { y: 0.88, z: -3.13, n: 9, w: 0.26 }];
    for (const row of eraRows) {
      for (let i = 0; i < row.n; i++) {
        const x = (i - (row.n - 1) / 2) * (row.w + 0.015);
        mb.set(A_.ERA, P.ERA_GLACIS).box(row.w, 0.075, 0.20,
          M.fromBasis([1, 0, 0], nrm, tan, [x, row.y + 0.05, row.z - 0.02]));
      }
    }

    // —— 翼子板与随车件 ——
    for (const s of [-1, 1]) {
      mb.set(A_.PAINT, P.FENDERS).box(0.34, 0.035, 6.6,
        M.mul(M.trans(s * 1.53, 1.44, 0.0), M.rotZ(s * rad(4))));
      // 前挡泥板
      const mf = v === "p"
        ? M.mul(M.trans(s * 1.53, 1.30, -3.30), M.mul(M.rotZ(s * rad(4)), M.rotX(rad(-38))))
        : M.mul(M.trans(s * 1.53, 1.36, -3.32), M.mul(M.rotZ(s * rad(4)), M.rotX(rad(-25))));
      mb.set(A_.PAINT_D, P.MUDFLAP).box(0.34, 0.03, 0.42, mf);
      // 翼子板储物箱
      mb.set(A_.PAINT_D, P.FENDERS).box(0.28, 0.16, 0.9, M.trans(s * 1.52, 1.55, -2.2));
      mb.set(A_.PAINT_D, P.FENDERS).box(0.28, 0.14, 0.7, M.trans(s * 1.52, 1.54, 1.9));
    }
    // 大灯(左侧护网)
    mb.set(A_.DARK, P.FENDERS).cyl(0.09, 0.09, 0.07, 10, xfZ(-0.95, 1.40, -3.36, M.rotX(rad(70))));
    mb.set(A_.GLASS, P.FENDERS).cyl(0.07, 0.07, 0.02, 10, xfZ(-0.95, 1.44, -3.38, M.rotX(rad(70))));
    mb.set(A_.DARK, P.FENDERS).cyl(0.09, 0.09, 0.07, 10, xfZ(-1.20, 1.40, -3.36, M.rotX(rad(70))));
    // 牵引钩
    mb.set(A_.GUNMET, P.HULL_LOW).box(0.10, 0.16, 0.10, M.trans(-0.9, 0.55, -3.44));
    mb.set(A_.GUNMET, P.HULL_LOW).box(0.10, 0.16, 0.10, M.trans(0.9, 0.55, -3.44));

    // —— 侧裙板 ——
    if (v === "p") {
      // VT-4 P: 分段式平裙板 + 前段 FY-2 ERA
      for (const s of [-1, 1]) {
        const part = s < 0 ? P.SKIRT_L : P.SKIRT_R;
        for (let i = 0; i < 7; i++) {
          const z = -2.85 + i * 0.95;
          mb.set(A_.PAINT_D, part).box(0.035, 0.78, 0.88,
            M.mul(M.trans(s * 1.60, 1.02, z), M.rotZ(s * rad(3))));
        }
        const ep = s < 0 ? P.ERA_SIDE_L : P.ERA_SIDE_R;
        for (let i = 0; i < 3; i++) {  // 前段 FY-2 ERA 块, 带特征倾角与缝隙
          const z = -2.75 + i * 0.62;
          mb.set(A_.ERA2, ep).box(0.09, 0.62, 0.55,
            M.mul(M.trans(s * 1.63, 1.06, z), M.rotZ(s * rad(6))));
        }
      }
    } else {
      for (const s of [-1, 1]) {
        const part = s < 0 ? P.SKIRT_L : P.SKIRT_R;
        mb.set(A_.PAINT_D, part).box(0.035, 0.80, 6.55,
          M.mul(M.trans(s * 1.60, 1.02, 0), M.rotZ(s * rad(3))));
        // 前段附加橡胶裙板
        mb.set(A_.RUBBER, part).box(0.03, 0.5, 0.8,
          M.mul(M.trans(s * 1.61, 0.82, -3.1), M.rotZ(s * rad(3))));
      }
    }

    // —— 尾部: 动力舱甲板 / 格栅 / 排气 ——
    if (v === "p") {
      // P 型尾部散热格栅: 更宽条带 + 中置加强筋
      for (let i = 0; i < 7; i++)
        mb.set(A_.DARK, P.REAR_GRILLE).box(0.09, 0.025, 0.78, M.trans(-0.72 + i * 0.24, 1.435, 2.95));
      mb.set(A_.PAINT_D, P.REAR_GRILLE).box(0.06, 0.05, 0.82, M.trans(0, 1.45, 2.95));
    } else {
      for (let i = 0; i < 6; i++)
        mb.set(A_.DARK, P.REAR_GRILLE).box(0.07, 0.025, 0.72, M.trans(-0.60 + i * 0.24, 1.435, 2.95));
    }
    // 发动机检修盖板
    mb.set(A_.PAINT_D, P.HULL_DECK).box(1.9, 0.03, 1.55, M.trans(0, 1.43, 2.35));
    // 尾板排气管口
    for (const s of [-1, 1])
      mb.set(A_.DARK, P.REAR_GRILLE).cyl(0.10, 0.10, 0.10, 10, xfZ(s * 0.55, 0.95, 3.44));
    // 自救木
    mb.set(A_.PAINT_D, P.TOW).cyl(0.07, 0.07, 1.6, 8, xfX(-0.35, 1.50, -0.4));
    // 牵引钢缆
    for (const s of [-1, 1]) {
      seg(mb, [s * 1.15, 1.47, -2.9], [s * 1.42, 1.47, 1.2], 0.022, 6, A_.CABLE, P.TOW);
      seg(mb, [s * 1.42, 1.47, 1.2], [s * 1.15, 1.47, 3.0], 0.022, 6, A_.CABLE, P.TOW);
    }
  }

  // 通用平板网格助手(斜置装甲板用)
  function plateVerts(w, t, l) {
    const x = w / 2, y = t / 2, z = l / 2, v = [];
    const q = (a, b, c, d) => v.push(...a, ...b, ...c, ...d);
    q([-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]); q([x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]);
    q([x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]); q([-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]);
    q([-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]); q([-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]);
    return v;
  }
  function plateNorms() {
    const n = [];
    for (const f of [[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]])
      for (let i = 0; i < 4; i++) n.push(...f);
    return n;
  }
  function plateIdx() { const i = []; for (let f = 0; f < 6; f++) i.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3); return i; }

  /* ============================================================
   * 行动装置: 负重轮 / 履带
   * ============================================================ */
  function buildRunning(mb) {
    for (const s of [-1, 1]) {
      const wp = s < 0 ? P.WHEEL_L : P.WHEEL_R;
      const dp = s < 0 ? P.DRIVE_L : P.DRIVE_R;
      // 六对负重轮: 胶缘 + 轮毂
      for (const z of D.wheelZ) {
        const x = s * D.wheelX;
        mb.set(A.RUBBER, wp).cyl(D.wheelR - 0.015, D.wheelR - 0.015, 0.10, 18, xfX(x, 0.47, z));
        mb.set(A.PAINT_D, wp).cyl(D.wheelR - 0.075, D.wheelR - 0.075, 0.115, 14, xfX(x + s * 0.01, 0.47, z));
        mb.set(A.PAINT, wp).cyl(0.10, 0.12, 0.13, 10, xfX(x + s * 0.02, 0.47, z));
        for (let b = 0; b < 6; b++) {  // 轮毂螺栓
          const a = b / 6 * M.TAU;
          mb.set(A.GUNMET, wp).cyl(0.022, 0.022, 0.13, 6,
            xfX(x + s * 0.02, 0.47 + Math.sin(a) * 0.16, z + Math.cos(a) * 0.16));
        }
      }
      // 主动轮(后) —— 齿圈
      {
        const x = s * D.wheelX;
        mb.set(A.GUNMET, dp).cyl(D.sprocketR, D.sprocketR, 0.10, 14, xfX(x, D.sprocketY, D.sprocketZ));
        mb.set(A.PAINT_D, dp).cyl(D.sprocketR - 0.08, D.sprocketR - 0.08, 0.12, 10, xfX(x + s * 0.02, D.sprocketY, D.sprocketZ));
        for (let b = 0; b < 10; b++) {
          const a = b / 10 * M.TAU;
          mb.set(A.GUNMET, dp).box(0.11, 0.05, 0.07,
            M.mul(M.trans(x, D.sprocketY + Math.sin(a) * D.sprocketR, D.sprocketZ + Math.cos(a) * D.sprocketR), M.rotX(-a)));
        }
      }
      // 诱导轮(前)
      mb.set(A.GUNMET, dp).cyl(D.idlerR, D.idlerR, 0.09, 14, xfX(s * D.wheelX, D.idlerY, D.idlerZ));
      mb.set(A.PAINT_D, dp).cyl(D.idlerR - 0.09, D.idlerR - 0.09, 0.11, 10, xfX(s * (D.wheelX + 0.02), D.idlerY, D.idlerZ));
      // 托带轮 ×3
      for (const z of D.rollZ)
        mb.set(A.RUBBER, dp).cyl(D.rollR, D.rollR, 0.08, 10, xfX(s * D.wheelX, D.rollY, z));
      // 侧减速器/悬挂臂特征
      for (const z of D.wheelZ)
        mb.set(A.PAINT_D, wp).box(0.08, 0.10, 0.42,
          M.mul(M.trans(s * 1.18, 0.55, z + 0.12), M.rotX(rad(12))));
    }
    buildTracks(mb, -1); buildTracks(mb, 1);
  }

  function buildTracks(mb, s) {
    // 履带环控制点 (z,y) 侧视
    const ctrl = [
      [-3.30, 0.90], [-2.0, 0.98], [0.0, 0.99], [2.3, 0.96],
      [3.28, 0.82], [3.44, 0.45], [3.22, 0.12], [2.6, 0.055],
      [-2.6, 0.055], [-3.22, 0.13], [-3.44, 0.50], [-3.38, 0.78]];
    const smooth = M.catmullClosed(ctrl, 8);
    const N = 86;
    const { pts } = M.resampleArc(smooth, N);
    const part = s < 0 ? P.TRACK_L : P.TRACK_R;
    const x = s * D.wheelX;
    const pitchGuess = 0.19;
    for (const q of pts) {
      const [pz, py] = q.p, [tz, ty] = q.t;
      // 外法线: (z,y) 平面内顺时针多边形 → outward = (ty, -tz) 的左侧? 用切线旋 -90°
      const nx = ty, ny = -tz;   // (z,y) 坐标系下
      const bz = [0, ty, tz];    // 局部 +Z = 切线
      const by = [0, nx, ny];    // 局部 +Y = 外法线
      const bx = [1, 0, 0];
      const pos = [x, py, pz];
      const xf = M.fromBasis(bx, by, bz, pos);
      // 履带板主体
      mb.set(A.TRACK, part).box(0.56, 0.075, pitchGuess * 0.92, xf);
      // 外侧挂胶垫
      mb.set(A.RUBBER, part).box(0.50, 0.02, pitchGuess * 0.7,
        M.mul(xf, M.trans(0, 0.05, 0)));
      // 内侧诱导齿
      mb.set(A.GUNMET, part).box(0.08, 0.10, pitchGuess * 0.45,
        M.mul(xf, M.trans(0, -0.085, 0)));
    }
  }

  /* ============================================================
   * 炮塔
   * ============================================================ */
  const TUR_PROF = [   // (x,z) CCW, 前 = -z
    [-0.62, -1.55], [0.62, -1.55], [1.30, -0.95], [1.42, -0.10],
    [1.30, 0.75], [0.95, 1.35], [-0.95, 1.35], [-1.30, 0.75],
    [-1.42, -0.10], [-1.30, -0.95]];
  const TUR_TOP = TUR_PROF.map(p => [p[0] * 0.94, p[1] * 0.95 + 0.02]);

  function turretEdge(i) {  // 第 i 条边的外法线/中点(局部)
    const a = TUR_PROF[i], b = TUR_PROF[(i + 1) % TUR_PROF.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    return { n: [dz / l, -dx / l], mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dir: [dx / l, dz / l] };
  }

  function buildTurret(mb, v) {
    const ty = D.hullTop, cz = D.turCZ;
    const tXf = M.trans(0, ty, cz);
    // 座圈
    mb.set(A.PAINT_D, P.TURRET).cyl(1.06, 1.10, 0.12, 28, M.trans(0, ty + 0.02, cz));
    // 主壳体(变截面棱柱)
    mb.set(A.PAINT, P.TURRET).prism(TUR_PROF, TUR_TOP, 0, D.turH, tXf);
    // 顶板
    mb.set(A.PAINT_D, P.TUR_ROOF).prism(TUR_TOP, TUR_TOP.map(p => [p[0] * 0.97, p[1] * 0.97]),
      D.turH - 0.02, D.turH + 0.06, tXf);
    // 炮塔尾部吊篮/尾舱(储物篮)
    mb.set(A.PAINT_D, P.STOWAGE).box(1.65, 0.42, 0.55, M.trans(0, ty + 0.42, cz + 1.55));
    for (const s of [-1, 1])
      mb.set(A.DARK, P.STOWAGE).box(0.05, 0.36, 0.5, M.trans(s * 0.8, ty + 0.42, cz + 1.55));

    // —— 炮塔正面 FY-4 楔形 ERA ——
    // 左颊 edge 8? profile: 边索引 9 -> 0 为左前斜面, 边 0->1 正前, 1->2 右前斜面
    for (const s of [-1, 1]) {
      const e = s < 0 ? turretEdge(9) : turretEdge(1);
      const part = s < 0 ? P.ERA_TUR_L : P.ERA_TUR_R;
      const n3 = [e.n[0], 0.12, e.n[1]];
      const nn = M.norm(n3);
      const tanv = M.norm([e.dir[0], 0, e.dir[1]]);
      const upv = M.norm(M.cross(tanv, nn));
      // 楔形两块: 外大内小, 台阶式排布
      const base = [e.mid[0] * 1.02, ty + 0.30, e.mid[1] * 1.02 + cz];
      const b0 = M.fromBasis(tanv, nn, upv, base);
      mb.set(A.ERA, part).box(0.66, 0.17, 0.42, M.mul(b0, M.trans(s * 0.10, 0, -0.02)));
      mb.set(A.ERA, part).box(0.50, 0.15, 0.34, M.mul(b0, M.trans(-s * 0.30, 0.10, 0.10)));
      mb.set(A.ERA2, part).box(0.34, 0.13, 0.26, M.mul(b0, M.trans(-s * 0.52, 0.20, 0.20)));
      // 斜面下缘辅助 ERA
      mb.set(A.ERA, part).box(0.55, 0.14, 0.30,
        M.mul(b0, M.trans(s * 0.05, -0.16, 0.28)));
    }
    // 正前鼻部 ERA 横排
    for (let i = -1; i <= 1; i++)
      mb.set(A.ERA, i <= 0 ? P.ERA_TUR_L : P.ERA_TUR_R).box(0.36, 0.15, 0.20,
        M.mul(M.trans(i * 0.40, ty + 0.24, cz - 1.56), M.rotX(rad(-18))));

    // —— 炮塔侧 ERA(P 型: FY-4/FY-2 混合排布) ——
    if (v === "p") {
      for (const s of [-1, 1]) {
        const part = s < 0 ? P.ERA_TUR_L : P.ERA_TUR_R;
        // 侧甲 FY-2 斜置小块(带明显缝隙) + FY-4 大盒
        for (let i = 0; i < 4; i++) {
          const zl = -0.55 + i * 0.44;
          mb.set(i % 2 ? A.ERA : A.ERA2, part).box(0.13, 0.30, 0.36,
            M.mul(M.trans(s * 1.44, ty + 0.34, cz + zl), M.mul(M.rotZ(s * rad(14)), M.rotY(-s * rad(8)))));
        }
      }
    } else {
      for (const s of [-1, 1]) {
        const part = s < 0 ? P.ERA_TUR_L : P.ERA_TUR_R;
        mb.set(A.ERA, part).box(0.13, 0.34, 1.15,
          M.mul(M.trans(s * 1.40, ty + 0.32, cz + 0.05), M.rotZ(s * rad(12))));
      }
    }

    // —— 防盾与火炮根部 ——
    const gp = D.gunPivot;
    mb.set(A.PAINT_D, P.MANTLET).box(0.80, 0.60, 0.30, M.trans(0, gp[1], gp[2] - 0.06));
    for (const s of [-1, 1])  // 防盾两侧斜切颊板
      mb.set(A.PAINT_D, P.MANTLET).box(0.30, 0.56, 0.26,
        M.mul(M.trans(s * 0.46, gp[1], gp[2] - 0.02), M.rotY(-s * rad(28))));
    mb.set(A.PAINT, P.MANTLET).box(0.42, 0.32, 0.20, M.mul(M.trans(0, gp[1], gp[2] - 0.26), M.rotX(rad(-8))));

    // —— 车长指挥塔(右) ——
    const cup = [0.62, ty + D.turH + 0.06, cz + 0.30];
    mb.set(A.PAINT, P.CUPOLA).cyl(0.36, 0.38, 0.14, 18, M.trans(cup[0], cup[1], cup[2]));
    mb.set(A.PAINT_D, P.CUPOLA).cyl(0.30, 0.30, 0.05, 18, M.trans(cup[0], cup[1] + 0.10, cup[2]));
    for (let i = 0; i < 8; i++) {   // 周视潜望镜环
      const a = i / 8 * M.TAU + 0.39;
      mb.set(A.GLASS, P.CUPOLA).box(0.09, 0.09, 0.05,
        M.mul(M.trans(cup[0] + Math.cos(a) * 0.30, cup[1] + 0.02, cup[2] + Math.sin(a) * 0.30), M.rotY(-a + Math.PI / 2)));
    }
    // 车长独立周视镜(右后)
    mb.set(A.PAINT_D, P.CMD_SIGHT).box(0.26, 0.24, 0.30, M.trans(0.62, ty + D.turH + 0.24, cz + 0.72));
    mb.set(A.OPTIC, P.CMD_SIGHT).box(0.20, 0.10, 0.03, M.trans(0.62, ty + D.turH + 0.26, cz + 0.57));
    // 炮长稳像瞄准镜(左前) + 炮长舱盖
    mb.set(A.PAINT_D, P.GUN_SIGHT).box(0.32, 0.24, 0.44, M.trans(-0.55, ty + D.turH + 0.10, cz - 0.72));
    mb.set(A.OPTIC, P.GUN_SIGHT).box(0.24, 0.12, 0.03, M.trans(-0.55, ty + D.turH + 0.10, cz - 0.94));
    mb.set(A.PAINT_D, P.TUR_ROOF).cyl(0.26, 0.26, 0.04, 16, M.trans(-0.60, ty + D.turH + 0.07, cz + 0.30));

    // —— 烟幕弹发射器(两侧各 4 联) ——
    for (const s of [-1, 1]) {
      const bx = s * 1.30, bz = cz + 0.85;
      for (let i = 0; i < 4; i++) {
        const yy = ty + 0.52 + (i % 2) * 0.14;
        const zz = bz + Math.floor(i / 2) * 0.16;
        mb.set(A.GUNMET, P.SMOKE).cyl(0.05, 0.05, 0.28, 8,
          M.mul(M.trans(bx + s * 0.05, yy, zz), M.mul(M.rotZ(s * rad(35)), M.rotX(rad(-15)))));
      }
    }
    // 天线座 / 横风传感桅杆
    mb.set(A.DARK, P.TUR_ROOF).cyl(0.015, 0.010, 1.1, 6, M.trans(-0.85, ty + D.turH + 0.62, cz + 0.95));
    mb.set(A.DARK, P.TUR_ROOF).box(0.10, 0.16, 0.08, M.trans(-0.85, ty + D.turH + 0.12, cz + 0.95));
    // 侧储物箱
    mb.set(A.PAINT_D, P.STOWAGE).box(0.30, 0.34, 1.2, M.trans(-1.30, ty + 0.20, cz + 0.55));
    mb.set(A.PAINT_D, P.STOWAGE).box(0.30, 0.34, 0.8, M.trans(1.32, ty + 0.20, cz + 0.35));

    // —— 遥控武器站 ——
    if (v !== "a1") buildRWS(mb, 0.30, ty + D.turH + 0.06, cz + 0.95, false);
  }

  function buildRWS(mb, x, y, z, heavy) {
    const part = heavy ? P.RWS_HVY : P.RWS;
    mb.set(A.PAINT_D, part).cyl(0.22, 0.24, 0.10, 14, M.trans(x, y + 0.05, z));
    mb.set(A.PAINT_D, part).box(0.36, 0.26, 0.62, M.trans(x, y + 0.26, z));
    // 12.7mm 机枪
    mb.set(A.GUNMET, part).cyl(0.025, 0.025, heavy ? 1.0 : 0.8, 8, xfZ(x - 0.06, y + 0.34, z - 0.55));
    mb.set(A.GUNMET, part).box(0.10, 0.14, 0.30, M.trans(x - 0.06, y + 0.30, z - 0.15));
    // 弹药箱 + 光电球
    mb.set(A.PAINT_D, part).box(0.16, 0.20, 0.34, M.trans(x + 0.14, y + 0.22, z - 0.05));
    mb.set(A.OPTIC, part).sphere(0.07, 10, 8, M.trans(x - 0.02, y + 0.20, z - 0.30));
    if (heavy) {
      mb.set(A.PAINT_D, part).box(0.46, 0.10, 0.75, M.trans(x, y + 0.45, z));
      mb.set(A.DARK, part).box(0.40, 0.06, 0.5, M.trans(x, y + 0.51, z + 0.05));
    }
  }

  /* ============================================================
   * 125mm 滑膛炮
   * ============================================================ */
  function buildGun(mb) {
    const gp = D.gunPivot;
    // 车削身管剖面 (r, 距炮耳轴向长度)
    const prof = [
      [0.20, 0.00], [0.20, 0.14], [0.155, 0.30], [0.125, 0.55],
      [0.128, 0.90], [0.128, 3.15], [0.160, 3.28], [0.168, 3.42],
      [0.168, 4.10], [0.158, 4.22], [0.128, 4.34], [0.118, 4.55],
      [0.112, 5.30], [0.105, 5.45], [0.0, 5.48]];
    // lathe 沿 +Y → 旋转到 -Z (车头)
    const xf = M.mul(M.trans(gp[0], gp[1], gp[2]), M.rotX(-Math.PI / 2));
    mb.set(A.GUNMET, P.GUN).lathe(prof, 18, xf, true);
    // 热护套分段包覆(独立分节细节)
    mb.set(A.GUNMET, P.FUME).lathe([[0.168, 3.30], [0.185, 3.45], [0.185, 4.05], [0.170, 4.18]], 16, xf, true);
    // 身管中段热护套环缝
    for (const d of [1.1, 1.9, 2.7])
      mb.set(A.DARK, P.GUN).lathe([[0.130, d], [0.133, d + 0.05]], 14, xf, false);
    // 炮口(平滑收口无制退器 —— 滑膛炮特征)
    // 驻退/复进机(外露于防盾下)
    mb.set(A.GUNMET, P.BREECH).cyl(0.05, 0.05, 0.5, 8, xfZ(-0.14, gp[1] - 0.22, gp[2] + 0.35));
    mb.set(A.GUNMET, P.BREECH).cyl(0.05, 0.05, 0.5, 8, xfZ(0.14, gp[1] - 0.22, gp[2] + 0.35));
    // 炮闩体(战斗舱内)
    mb.set(A.MACHINE, P.BREECH).box(0.42, 0.44, 0.62, M.trans(0, gp[1], gp[2] + 0.55));
    mb.set(A.MACHINE, P.BREECH).cyl(0.09, 0.09, 0.3, 8, xfZ(0, gp[1], gp[2] + 0.3));
  }

  /* ============================================================
   * A1 选配套件
   * ============================================================ */
  function buildA1(mb) {
    const ty = D.hullTop, cz = D.turCZ, roof = ty + D.turH;
    // —— 炮塔四角毫米波雷达阵列 ——
    const radarPos = [
      [-1.15, -0.85, rad(-38)], [1.15, -0.85, rad(38)],
      [-1.20, 0.85, rad(38)], [1.20, 0.85, rad(-38)]];
    for (const [x, z, ry] of radarPos) {
      mb.set(A.RADAR, P.APS_RADAR).box(0.34, 0.42, 0.05,
        M.mul(M.trans(x, roof + 0.22, cz + z), M.mul(M.rotY(ry), M.rotX(rad(-8)))));
      mb.set(A.DARK, P.APS_RADAR).box(0.30, 0.05, 0.05,
        M.mul(M.trans(x, roof + 0.02, cz + z), M.rotY(ry)));
    }
    // —— APS 拦截弹发射器(炮塔前两侧斜置双管) ——
    for (const s of [-1, 1]) {
      const base = [s * 1.30, roof + 0.10, cz - 0.55];
      mb.set(A.PAINT_D, P.APS_TUBE).box(0.22, 0.18, 0.30,
        M.mul(M.trans(base[0], base[1] - 0.08, base[2]), M.rotY(-s * rad(30))));
      for (let i = 0; i < 2; i++)
        mb.set(A.GUNMET, P.APS_TUBE).cyl(0.045, 0.045, 0.34, 8,
          M.mul(M.trans(base[0] + s * 0.02, base[1] + 0.10 + i * 0.10, base[2]),
            M.mul(M.rotY(-s * rad(35)), M.rotX(rad(-40)))));
    }
    // —— 重型遥控武器站 ——
    buildRWS(mb, 0.30, roof + 0.06, cz + 0.95, true);
    // —— 车载无人机发射管(顶后双管) ——
    for (const s of [-1, 1])
      mb.set(A.PAINT_D, P.DRONE).cyl(0.09, 0.09, 0.55, 10,
        M.mul(M.trans(s * 0.42, roof + 0.22, cz + 1.15), M.rotX(rad(-18))));
    // —— 激光告警接收器(四角小柱) ——
    const lwrPos = [[-1.05, -1.30], [1.05, -1.30], [-1.15, 1.10], [1.15, 1.10]];
    for (const [x, z] of lwrPos) {
      mb.set(A.DARK, P.LWR).cyl(0.035, 0.040, 0.14, 8, M.trans(x, roof + 0.14, cz + z));
      mb.set(A.OPTIC, P.LWR).cyl(0.028, 0.028, 0.02, 8, M.trans(x, roof + 0.22, cz + z));
    }
    // —— 顶部附加装甲(防攻顶) ——
    mb.set(A.PAINT_D, P.TUR_ROOF).prism(
      TUR_TOP.map(p => [p[0] * 0.88, p[1] * 0.88]),
      TUR_TOP.map(p => [p[0] * 0.86, p[1] * 0.86]),
      D.turH + 0.07, D.turH + 0.16, M.trans(0, ty, cz));
  }

  /* ============================================================
   * 内构: 动力舱 / 战斗舱 / 驾驶舱
   * ============================================================ */
  function buildInterior(mb) {
    // —— 动力舱(后) ——
    // 1300hp V12 水冷涡轮增压柴油机
    mb.set(A.ENGINE, P.ENGINE).box(1.30, 0.55, 1.75, M.trans(0, 0.82, 2.30));
    for (const s of [-1, 1])  // V 型气缸排
      mb.set(A.ENGINE, P.ENGINE).box(0.52, 0.24, 1.55,
        M.mul(M.trans(s * 0.33, 1.18, 2.30), M.rotZ(s * rad(30))));
    mb.set(A.MACHINE, P.ENGINE).box(0.30, 0.16, 1.4, M.trans(0, 1.26, 2.30)); // 进气歧管
    // 涡轮增压器 + 中冷
    mb.set(A.MACHINE, P.TURBO).torus(0.16, 0.07, 12, 8, M.mul(M.trans(0.42, 1.30, 3.05), M.rotX(Math.PI / 2)));
    mb.set(A.MACHINE, P.TURBO).cyl(0.10, 0.10, 0.16, 10, xfX(0.42, 1.30, 3.05));
    mb.set(A.PIPES, P.TURBO).cyl(0.05, 0.05, 0.5, 8, xfZ(0.42, 1.15, 3.0));
    mb.set(A.MACHINE, P.TURBO).box(0.5, 0.14, 0.4, M.trans(-0.4, 1.30, 3.0));
    // 综合液力传动箱
    mb.set(A.MACHINE, P.TRANS).box(1.45, 0.55, 0.62, M.trans(0, 0.80, 3.05));
    for (const s of [-1, 1])   // 侧传动 → 主动轮
      mb.set(A.MACHINE, P.TRANS).cyl(0.16, 0.16, 0.5, 10, xfX(s * 1.0, 0.75, 3.02));
    // 散热器(后部斜置双联)
    for (const s of [-1, 1])
      mb.set(A.MACHINE, P.RADIATOR).box(0.58, 0.10, 0.85,
        M.mul(M.trans(s * 0.62, 1.30, 3.05), M.rotX(rad(18))));
    // 冷却风扇组
    for (const s of [-1, 1]) {
      mb.set(A.MACHINE, P.FANS).cyl(0.30, 0.30, 0.08, 14, M.trans(s * 0.62, 1.38, 2.85));
      for (let b = 0; b < 6; b++)
        mb.set(A.DARK, P.FANS).box(0.05, 0.015, 0.52,
          M.mul(M.trans(s * 0.62, 1.38, 2.85), M.rotY(b / 6 * Math.PI)));
    }
    // 排气歧管 → 尾板出口
    for (const s of [-1, 1]) {
      seg(mb, [s * 0.55, 1.05, 2.6], [s * 0.62, 1.0, 3.3], 0.07, 8, A.PIPES, P.EXHAUST);
      seg(mb, [s * 0.62, 1.0, 3.3], [s * 0.58, 0.95, 3.44], 0.07, 8, A.PIPES, P.EXHAUST);
    }
    // 燃油箱(前部两侧)
    for (const s of [-1, 1])
      mb.set(A.PIPES, P.FUEL).box(0.42, 0.55, 0.9, M.trans(s * 1.05, 0.78, -1.35));

    // —— 战斗舱(中) ——
    const cz = D.turCZ;
    // 吊篮转台
    mb.set(A.MACHINE, P.BASKET).cyl(1.02, 1.02, 0.06, 24, M.trans(0, 0.98, cz));
    mb.set(A.MACHINE, P.BASKET).cyl(0.30, 0.34, 0.42, 12, M.trans(0, 0.72, cz));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * M.TAU;
      seg(mb, [Math.cos(a) * 1.0, 0.98, cz + Math.sin(a) * 1.0],
        [Math.cos(a) * 0.92, 1.42, cz + Math.sin(a) * 0.92], 0.03, 6, A.MACHINE, P.BASKET);
    }
    // 盘式自动装弹机: 弹盘 + 22 组弹丸/药筒(水平放射排布)
    mb.set(A.MACHINE, P.CAROUSEL).cyl(0.95, 0.95, 0.10, 26, M.trans(0, 0.60, cz));
    mb.set(A.MACHINE, P.CAROUSEL).cyl(0.30, 0.30, 0.16, 14, M.trans(0, 0.63, cz));
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * M.TAU;
      const r0 = 0.44, r1 = 0.90;
      const pA = [Math.cos(a) * r0, 0.68, cz + Math.sin(a) * r0];
      const pB = [Math.cos(a) * r1, 0.68, cz + Math.sin(a) * r1];
      // 弹丸(头朝中心) + 发射药筒(外侧)
      seg(mb, pB, [Math.cos(a) * 0.52, 0.68, cz + Math.sin(a) * 0.52], 0.068, 8, A.BRASS, P.AMMO);
      seg(mb, [Math.cos(a) * 0.50, 0.68, cz + Math.sin(a) * 0.50], pA, 0.048, 8, A.PROJ, P.AMMO);
      // 弹巢格板
      mb.set(A.DARK, P.CAROUSEL).box(0.05, 0.10, 0.42,
        M.mul(M.trans(Math.cos(a) * 0.68, 0.62, cz + Math.sin(a) * 0.68), M.rotY(-a + Math.PI / 2)));
    }
    // 输弹机(提升臂 + 推弹链条, 位于炮尾后方)
    mb.set(A.MACHINE, P.RAMMER).box(0.10, 0.55, 0.10, M.trans(0, 1.15, cz + 0.72));
    seg(mb, [0, 1.40, cz + 0.72], [0, 1.55, cz + 0.15], 0.045, 8, A.MACHINE, P.RAMMER);
    mb.set(A.DARK, P.RAMMER).box(0.08, 0.08, 0.7, M.trans(0, 1.50, cz + 0.35));
    // 驻退复进导轨
    for (const s of [-1, 1])
      mb.set(A.MACHINE, P.BREECH).box(0.08, 0.08, 0.9, M.trans(s * 0.20, D.gunPivot[1] - 0.30, cz - 0.85));

    // 车长/炮长座椅
    mb.set(A.SEAT, P.SEAT_CMD).box(0.42, 0.10, 0.42, M.trans(0.58, 1.02, cz + 0.35));
    mb.set(A.SEAT, P.SEAT_CMD).box(0.42, 0.55, 0.10, M.mul(M.trans(0.58, 1.25, cz + 0.52), M.rotX(rad(10))));
    mb.set(A.SEAT, P.SEAT_GUN).box(0.40, 0.10, 0.40, M.trans(-0.52, 1.02, cz - 0.20));
    mb.set(A.SEAT, P.SEAT_GUN).box(0.40, 0.50, 0.10, M.mul(M.trans(-0.52, 1.22, cz - 0.03), M.rotX(rad(10))));
    // 炮长操控台 + 车长操控台(数字面板)
    mb.set(A.MACHINE, P.BASKET).box(0.30, 0.18, 0.22, M.trans(-0.52, 1.30, cz - 0.62));
    mb.set(A.SCREEN, P.BASKET).box(0.22, 0.10, 0.02, M.mul(M.trans(-0.52, 1.33, cz - 0.72), M.rotX(rad(-20))));
    mb.set(A.SCREEN, P.BASKET).box(0.20, 0.09, 0.02, M.mul(M.trans(0.58, 1.45, cz + 0.05), M.rotX(rad(-20))));

    // —— 驾驶舱(前) ——
    // 半躺式座椅
    mb.set(A.SEAT, P.SEAT_DRV).box(0.44, 0.10, 0.50, M.mul(M.trans(0, 0.62, -1.85), M.rotX(rad(-12))));
    mb.set(A.SEAT, P.SEAT_DRV).box(0.44, 0.62, 0.10, M.mul(M.trans(0, 0.90, -1.60), M.rotX(rad(-28))));
    // 方向盘 + 转向柱
    seg(mb, [0, 0.85, -2.15], [0, 1.08, -2.42], 0.035, 8, A.MACHINE, P.STEERING);
    mb.set(A.DARK, P.STEERING).torus(0.17, 0.025, 14, 8,
      M.mul(M.trans(0, 1.12, -2.46), M.rotX(rad(55))));
    mb.set(A.DARK, P.STEERING).cyl(0.04, 0.04, 0.05, 8, M.mul(M.trans(0, 1.12, -2.46), M.rotX(rad(55))));
    // 综合数字显示面板
    mb.set(A.MACHINE, P.DRV_PANEL).box(0.95, 0.26, 0.16, M.mul(M.trans(0, 1.18, -2.72), M.rotX(rad(-24))));
    for (let i = -1; i <= 1; i++)
      mb.set(A.SCREEN, P.DRV_PANEL).box(0.24, 0.14, 0.02,
        M.mul(M.trans(i * 0.30, 1.20, -2.64), M.rotX(rad(-24))));
    mb.set(A.SCREEN2, P.DRV_PANEL).box(0.05, 0.05, 0.02, M.mul(M.trans(0.42, 1.10, -2.66), M.rotX(rad(-24))));
    // 舱口潜望镜组(3 具)
    for (let i = -1; i <= 1; i++)
      mb.set(A.GLASS, P.PERI_DRV).box(0.16, 0.10, 0.09,
        M.mul(M.trans(i * 0.24, 1.38, -2.60), M.rotX(rad(-30))));
    // 驾驶员舱口盖(向前翻启, 贴于首上)
    mb.set(A.PAINT_D, P.HULL_DECK).cyl(0.27, 0.27, 0.05, 16,
      M.mul(M.trans(0, 1.50, -2.72), M.rotX(rad(62))));
    mb.set(A.DARK, P.PERI_DRV).box(0.05, 0.24, 0.06, M.trans(-0.30, 1.52, -2.42));
    // 舱内壁面衬板
    mb.set(A.INTERIOR, P.HULL_LOW).box(2.30, 0.04, 6.0, M.trans(0, 0.48, -0.1));
  }

  /* ============================================================
   * 乘员组(基础骨架比例, 坐姿战位)
   * ============================================================ */
  function crewFigure(mb, cfg, part) {
    const S = cfg.scale || 1;
    const U = A.UNIFORM, SK = A.SKIN, HM = A.HELMET, VS = A.VEST;
    const j = cfg.j;  // {hip, chest, head, kneeL/R, footL/R, elbowL/R, handL/R}
    const mid = (a, b) => M.scale(M.add(a, b), 0.5);
    // 骨盆 + 躯干(略前倾)
    seg(mb, j.hip, j.chest, 0.16 * S, 10, U, part);
    mb.set(VS, part).box(0.30 * S, 0.34 * S, 0.20 * S, M.mul(M.trans(...mid(j.hip, j.chest)), M.rotX(cfg.lean || 0)));
    // 颈 + 头
    const neck = M.lerp(j.chest, j.head, 0.78);
    seg(mb, M.lerp(j.chest, j.head, 0.62), j.head, 0.045 * S, 8, SK, part);
    mb.set(SK, part).sphere(0.105 * S, 12, 10, M.trans(...j.head));
    // 坦克头盔(半球壳 + 耳罩 + 喉部送话器)
    mb.set(HM, part).sphere(0.125 * S, 12, 8,
      M.mul(M.trans(j.head[0], j.head[1] + 0.015 * S, j.head[2] + 0.01), M.scl(1, 0.9, 1.05)));
    for (const s of [-1, 1])
      mb.set(HM, part).sphere(0.05 * S, 8, 6, M.trans(j.head[0] + s * 0.115 * S, j.head[1], j.head[2]));
    seg(mb, [j.head[0] + 0.10 * S, j.head[1] - 0.02, j.head[2]],
      [j.head[0] + 0.12 * S, j.head[1] - 0.10 * S, j.head[2] - 0.10 * S], 0.012, 6, HM, part);
    // 四肢
    const sho = [j.chest[0] - 0.19 * S, j.chest[1] + 0.10 * S, j.chest[2]];
    const sho2 = [j.chest[0] + 0.19 * S, j.chest[1] + 0.10 * S, j.chest[2]];
    for (const [sh, el, ha] of [[sho, j.elbowL, j.handL], [sho2, j.elbowR, j.handR]]) {
      seg(mb, sh, el, 0.052 * S, 8, U, part);
      seg(mb, el, ha, 0.042 * S, 8, U, part);
      mb.set(SK, part).sphere(0.05 * S, 8, 6, M.trans(...ha));
    }
    const hipL = [j.hip[0] - 0.11 * S, j.hip[1], j.hip[2]];
    const hipR = [j.hip[0] + 0.11 * S, j.hip[1], j.hip[2]];
    for (const [hp, kn, ft] of [[hipL, j.kneeL, j.footL], [hipR, j.kneeR, j.footR]]) {
      seg(mb, hp, kn, 0.065 * S, 8, U, part);
      seg(mb, kn, ft, 0.055 * S, 8, U, part);
      mb.set(A.DARK, part).box(0.09 * S, 0.07 * S, 0.22 * S, M.trans(ft[0], ft[1] - 0.02, ft[2] - 0.03));
    }
  }

  function buildCrew(mb) {
    // 驾驶员: 半躺姿态, 双手扶方向盘
    crewFigure(mb, {
      lean: rad(-30),
      j: {
        hip: [0, 0.78, -1.95], chest: [0, 1.05, -2.12], head: [0, 1.28, -2.22],
        kneeL: [-0.16, 0.68, -2.45], footL: [-0.17, 0.48, -2.62],
        kneeR: [0.16, 0.68, -2.45], footR: [0.17, 0.48, -2.62],
        elbowL: [-0.22, 1.00, -2.30], handL: [-0.13, 1.12, -2.44],
        elbowR: [0.22, 1.00, -2.30], handR: [0.13, 1.12, -2.44],
      }
    }, P.CREW_DRV);
    // 炮长(左): 坐姿前倾操作瞄准具
    crewFigure(mb, {
      lean: rad(-8),
      j: {
        hip: [-0.52, 1.08, -0.70], chest: [-0.52, 1.42, -0.78], head: [-0.52, 1.62, -0.86],
        kneeL: [-0.62, 0.95, -1.05], footL: [-0.62, 0.60, -1.02],
        kneeR: [-0.42, 0.95, -1.05], footR: [-0.42, 0.60, -1.02],
        elbowL: [-0.66, 1.30, -0.95], handL: [-0.56, 1.32, -1.12],
        elbowR: [-0.38, 1.30, -0.95], handR: [-0.48, 1.32, -1.12],
      }
    }, P.CREW_GUN);
    // 车长(右): 坐姿, 头部接近指挥塔
    crewFigure(mb, {
      lean: rad(4),
      j: {
        hip: [0.58, 1.10, -0.15], chest: [0.58, 1.48, -0.12], head: [0.58, 1.70, -0.10],
        kneeL: [0.48, 1.00, -0.48], footL: [0.48, 0.62, -0.44],
        kneeR: [0.68, 1.00, -0.48], footR: [0.68, 0.62, -0.44],
        elbowL: [0.44, 1.42, -0.32], handL: [0.50, 1.44, -0.52],
        elbowR: [0.72, 1.42, -0.32], handR: [0.62, 1.46, -0.50],
      }
    }, P.CREW_CMD);
  }

  /* ============================================================
   * 改型差异清单(考证文本 + 相机聚焦点)
   * ============================================================ */
  const DIFFS = {
    base: [
      { part: -1, label: "基准型: FY-4 炮塔楔形 ERA + 首上三层 ERA 阵列", focus: [6, 3.4, -6, 0, 1.4, -1] },
      { part: -1, label: "标准车长周视镜 + 基础型 12.7mm 遥控武器站", focus: [3, 3.4, 2, 0.4, 2.2, -0.2] },
      { part: -1, label: "整体式橡胶/钢混合侧裙板", focus: [-7, 1.8, 0.5, 0, 1.0, 0] },
    ],
    a1: [
      { part: P.APS_RADAR, label: "+ 炮塔四角毫米波雷达阵列(APS 探测)", focus: [4.5, 3.2, -4.5, 0.8, 2.2, -0.6] },
      { part: P.APS_TUBE, label: "+ 拦截弹发射器 ×2 (GL 系列 APS)", focus: [4, 3.0, -3.5, 0.8, 2.1, -0.8] },
      { part: P.RWS_HVY, label: "↑ 升级重型遥控武器站(加厚防护/双通道光电)", focus: [3, 3.8, 2.5, 0.3, 2.4, 0.4] },
      { part: P.DRONE, label: "+ 炮塔顶部车载无人机发射管 ×2", focus: [2.5, 3.5, 3.5, 0.2, 2.4, 0.9] },
      { part: P.LWR, label: "+ 激光告警接收器 ×4", focus: [-3.5, 3.2, -3.0, -0.8, 2.2, -0.9] },
      { part: P.TUR_ROOF, label: "↑ 顶部装甲加厚(防攻顶弹药)", focus: [0, 4.5, -0.5, 0, 2.3, -0.4] },
    ],
    p: [
      { part: P.ERA_TUR_L, label: "△ 炮塔侧 FY-4/FY-2 ERA 混合排布(特征倾角与缝隙)", focus: [-5.5, 2.6, -1.5, -1.2, 1.9, -0.3] },
      { part: P.GLACIS, label: "△ 首上附加装甲外形重构 + ERA 双横排", focus: [3.5, 2.6, -5.5, 0, 1.2, -2.9] },
      { part: P.SKIRT_L, label: "△ 分段式平裙板 + 前段 FY-2 ERA", focus: [-6.5, 1.6, -1, -1.4, 1.0, -1] },
      { part: P.MUDFLAP, label: "△ 前挡泥板加大倾角", focus: [-3.5, 2.0, -4.5, -1.5, 1.3, -3.2] },
      { part: P.REAR_GRILLE, label: "△ 尾部散热格栅重构(宽条带+中置加强筋)", focus: [3, 2.6, 5.5, 0, 1.5, 3.0] },
    ],
  };

  /* ============================================================
   * 主构建入口
   * ============================================================ */
  VT4.buildTank = function (variant) {
    const mb = new VT4.MB();
    buildHull(mb, variant);
    buildRunning(mb);
    buildTurret(mb, variant);
    buildGun(mb);
    if (variant === "a1") buildA1(mb);
    buildInterior(mb);
    buildCrew(mb);
    const mesh = mb.finalize();
    return { mesh, diffs: DIFFS[variant] || DIFFS.base };
  };
})();
