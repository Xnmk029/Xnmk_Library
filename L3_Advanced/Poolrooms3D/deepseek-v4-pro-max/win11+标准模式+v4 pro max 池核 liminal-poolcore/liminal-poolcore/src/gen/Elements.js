/**
 * Elements.js —— 「无限边缘空间池核 / Liminal Poolcore」元素几何库（纯程序化，零外部模型）
 *
 * ═══════════ 全局约定（所有几何体都由 THREE.InstancedMesh 以实例矩阵复用，且允许非等比
 *             缩放；一旦单位/原点错位，整座建筑就会错位，故必须严格遵守） ═══════════
 * · 单位：几何体一律建在「1 个结构单位」的标准盒内（多数 1×1×1），真实尺寸完全交给实例矩阵的
 *   非等比 scale 决定，几何体内部不预置任何真实尺寸。
 * · 原点：中心原点 = slab / 窗框 / vistaPanel / 天窗 / oddTorus / oddSphere；
 *         底面中心（y=0 贴地）= 所有柱子 / archUnderwater / railing / poolLadder / oddMonolith；
 *         顶面中心（y=0 为顶面、几何体向下长）= balconyPlate / divingBoard（板根上表面）。
 * · 朝向：竖直构件沿 +Y 生长；墙面构件（窗框 / vistaPanel）在 XY 平面、法线 +Z；
 *         水平构件（skylightFrame / skylightPane）在 XZ 平面、法线 +Y（旋转已 bake 进顶点）；
 *         悬挑构件（divingBoard / poolLadder）向 +Z 伸出。
 * · 属性：每个 BufferGeometry 必有 position / normal / uv，已 computeBoundingBox() 与
 *   computeBoundingSphere()，且 geometry.name = `${kind}_lod${i}`（index 0 = 最精细）。
 * · 组合体一律用 mergeGeometries 合并为**单个** BufferGeometry（子件先 translate/rotate bake），
 *   保证「一次实例化 = 一个 draw call」；合并前统一属性集合，返回 null 时抛出可诊断错误。
 *
 * ═══════════ 各 kind 用途 ═══════════
 * slab             1×1×1 中心原点立方体 —— 地板/天花/池壁/台阶，全靠 scale 变形（材质走世界空间三平面映射）
 * columnSquare     方柱（截面 1×1、高 1、底面中心）—— 大厅列柱；LOD0 带柱础柱头 + 四面浅凹槽
 * columnRound      圆柱（直径 1、高 1、底面中心）—— 主廊柱；LOD0 带柱础柱头圆环
 * columnCluster    束柱（4 根 φ0.3 细柱撑满 1×1 足迹）—— 装饰柱丛；LOD2 退化为单根粗柱
 * archUnderwater   半圆拱门（跨度 1、高 1、厚 0.3、底面中心）—— 水下互通拱洞 / 廊道券洞
 * railing          栏杆（长 1、高 1、底面中心）—— 池边/挑台护栏：上扶手 + 下横杆 + 端立柱
 * divingBoard      跳板（沿 +Z 伸出 1、板面顶在 y=0、末端上翘 0.03）—— 高台跳板，含根部支撑座
 * poolLadder       不锈钢池梯（宽 0.6、高 1、向 +Z 伸 0.4）—— 双弯管扶手 + 3 级踏板
 * balconyPlate     薄板（1×1、厚 0.12、顶面在 y=0）—— 挑台 / 阳台楼板
 * windowFrameRect  矩形窗框（1×1、XY 平面、法线 +Z、框宽 0.08、内部镂空）
 * windowFrameArch  拱窗框（上半为半圆拱券，其余同上）
 * windowFrameRound 圆窗框（外径 1 的环形框，其余同上）
 * vistaPanel       1×1 平面（法线 +Z、UV 0..1）—— 贴「窗外单调梦幻风景」的假景板
 * skylightFrame    天窗方框（1×1、XZ 平面、法线 +Y、框宽 0.1）
 * skylightPane     天窗发光面（1×1 平面、法线 +Y）—— 体积光遮挡图 / emissive 光源面
 * oddTorus         环（外径 1、管径 0.16、XY 平面）—— 反常装置：悬停的环
 * oddMonolith      1×1×1「略微不安」多面体（顶面绕 Y 扭 12° 并切掉一角、底面中心）
 * oddSphere        球（直径 1、中心原点）—— 反常装置：无理由悬停的球
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ELEMENT_KINDS = [
  'slab',            // 结构单位立方体
  'columnSquare', 'columnRound', 'columnCluster',
  'archUnderwater',
  'railing', 'divingBoard', 'poolLadder', 'balconyPlate',
  'windowFrameRect', 'windowFrameArch', 'windowFrameRound', 'vistaPanel',
  'skylightFrame', 'skylightPane',
  'oddTorus', 'oddMonolith', 'oddSphere'
];

/** 允许保留的属性：其余（tangent/color 等）在合并前删掉，避免属性集合不一致 */
const KEEP_ATTRIBUTES = ['position', 'normal', 'uv'];
/** 内部构造器只区分三档细节；更多 LOD 层级复用最粗档 */
const COARSEST_LEVEL = 2;

/* ───────────────── 基础子件工具（变换全部 bake 进顶点，纯函数） ───────────────── */

/** 轴对齐立方体，中心平移到 (x,y,z) */
function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** 圆柱/圆管：axis 指定轴向（'x' 横杆 / 'y' 立柱 / 'z' 悬挑杆），中心平移到 (x,y,z) */
function cyl(radius, length, segments, axis = 'y', x = 0, y = 0, z = 0) {
  const g = new THREE.CylinderGeometry(radius, radius, length, segments, 1);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/**
 * 环带：XY 平面内的扇形/整圆「厚圆环」，由外壁 + 内壁 + 前后端面共 4 组条带组成。
 * 拱券与圆窗框都用它：内部天然镂空，顶点数只随段数线性增长，绕序已按外向校准。
 */
function makeRingBand(rOuter, rInner, depth, segments, thetaStart, thetaLength) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const hz = depth / 2;
  for (let face = 0; face < 4; face++) {
    const base = positions.length / 3;
    const flip = (face === 1 || face === 2); // 内壁与 +Z 端面需反绕序
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = thetaStart + t * thetaLength;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      if (face < 2) {
        // face 0 = 外壁（法线 +径向）、face 1 = 内壁（法线 -径向）
        const r = face === 0 ? rOuter : rInner;
        const s = face === 0 ? 1 : -1;
        positions.push(r * ca, r * sa, hz, r * ca, r * sa, -hz);
        normals.push(s * ca, s * sa, 0, s * ca, s * sa, 0);
      } else {
        // face 2 = +Z 端面、face 3 = -Z 端面
        const nz = face === 2 ? 1 : -1;
        positions.push(rOuter * ca, rOuter * sa, nz * hz, rInner * ca, rInner * sa, nz * hz);
        normals.push(0, 0, nz, 0, 0, nz);
      }
      uvs.push(t, 1, t, 0);
    }
    for (let i = 0; i < segments; i++) {
      const a0 = base + i * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      if (flip) indices.push(a0, b1, b0, a0, a1, b1);
      else indices.push(a0, b0, b1, a0, b1, a1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}

/** 统一属性集合后合并；mergeGeometries 返回 null 时给出可诊断的错误 */
function mergeParts(parts, kind) {
  if (!Array.isArray(parts) || parts.length === 0) throw new Error(`[Elements] ${kind}: 没有可合并的子几何体`);
  const signatures = [];
  for (const part of parts) {
    for (const key of Object.keys(part.attributes)) {
      if (!KEEP_ATTRIBUTES.includes(key)) part.deleteAttribute(key);
    }
    part.morphAttributes = {};
    for (const key of KEEP_ATTRIBUTES) {
      if (!part.getAttribute(key)) {
        throw new Error(`[Elements] ${kind}: 子几何体缺少 ${key}，无法合并（mergeGeometries 要求属性集合一致）`);
      }
    }
    signatures.push(`${part.index ? 'indexed' : 'non-indexed'}:${Object.keys(part.attributes).sort().join(',')}`);
  }
  const unique = [...new Set(signatures)];
  if (unique.length > 1) throw new Error(`[Elements] ${kind}: 子几何体属性/索引形态不一致 → ${unique.join(' | ')}`);
  if (parts.length === 1) return parts[0];
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error(`[Elements] ${kind}: mergeGeometries 返回 null（${parts.length} 个子件，形态 ${unique[0]}）`);
  for (const part of parts) part.dispose();
  return merged;
}

/* ───────────────── 各 kind 构造器（level：0 最精细 … 2 最粗） ───────────────── */

/** 结构单位立方体：一切板状体的母体 */
function buildSlab() {
  return box(1, 1, 1);
}

/** 方柱：截面 1×1、y∈[0,1]、底面中心；柱础柱头外扩到 1.14（高 0.05） */
function buildColumnSquare(level) {
  if (level === COARSEST_LEVEL) return box(1, 1, 1, 0, 0.5, 0);
  const parts = [box(1.14, 0.05, 1.14, 0, 0.025, 0), box(1.14, 0.05, 1.14, 0, 0.975, 0)]; // 柱础 + 柱头
  if (level === 0) {
    // 内核内缩 0.07 + 四角凸块 → 四个面各现出一条浅凹槽（无 CSG，用体块拼出「凹」）
    parts.push(box(0.86, 0.9, 0.86, 0, 0.5, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.32, 0.9, 0.32, sx * 0.34, 0.5, sz * 0.34));
  } else {
    parts.push(box(1, 0.9, 1, 0, 0.5, 0)); // LOD1 去凹槽
  }
  return mergeParts(parts, 'columnSquare');
}

/** 圆柱：直径 1、y∈[0,1]、底面中心；LOD0 附柱础柱头圆环（外径 1.14） */
function buildColumnRound(level) {
  const seg = [24, 12, 8][level];
  const shaft = cyl(0.5, 1, seg, 'y', 0, 0.5, 0);
  if (level > 0) return shaft;
  const socle = cyl(0.57, 0.05, seg, 'y', 0, 0.025, 0);   // 柱础圆环
  const capital = cyl(0.57, 0.05, seg, 'y', 0, 0.975, 0); // 柱头圆环
  return mergeParts([shaft, socle, capital], 'columnRound');
}

/** 束柱：4 根 φ0.3 细柱排在 1×1 足迹四角；LOD2 用单根粗柱保持轮廓 */
function buildColumnCluster(level) {
  if (level === COARSEST_LEVEL) return cyl(0.5, 1, 8, 'y', 0, 0.5, 0);
  const seg = level === 0 ? 12 : 8;
  const parts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(cyl(0.15, 1, seg, 'y', sx * 0.35, 0.5, sz * 0.35));
  return mergeParts(parts, 'columnCluster');
}

/** 水下拱门：X∈[-0.5,0.5]、Y∈[0,1]、Z∈[-0.15,0.15]，拱腿宽 0.18，起拱点 y=0.5 */
function buildArchUnderwater(level) {
  const seg = [24, 12, 6][level];
  const ring = makeRingBand(0.5, 0.32, 0.3, seg, 0, Math.PI);
  ring.translate(0, 0.5, 0);
  return mergeParts([
    ring,
    box(0.18, 0.5, 0.3, -0.41, 0.25, 0), // 左拱腿竖直段
    box(0.18, 0.5, 0.3, 0.41, 0.25, 0)   // 右拱腿竖直段
  ], 'archUnderwater');
}

/** 栏杆：X∈[-0.5,0.5]、Y∈[0,1]；上扶手 φ0.06 顶到 y=1，下横杆 y≈0.45，两端立柱 φ0.05 */
function buildRailing(level) {
  const seg = [10, 8, 6][level];
  const parts = [cyl(0.03, 1, seg, 'x', 0, 0.97, 0)];
  if (level === COARSEST_LEVEL) {
    parts.push(cyl(0.025, 1, seg, 'y', 0, 0.5, 0)); // LOD2：扶手 + 1 根立柱
  } else {
    parts.push(cyl(0.025, 1, seg, 'x', 0, 0.45, 0));
    parts.push(cyl(0.025, 1, seg, 'y', -0.475, 0.5, 0));
    parts.push(cyl(0.025, 1, seg, 'y', 0.475, 0.5, 0));
  }
  return mergeParts(parts, 'railing');
}

/** 跳板板面：沿 +Z 分段按二次曲线抬升，近端上表面在 y=0，末端上翘 tipRise */
function makeDeckSegments(segments, halfWidth, thickness, tipRise) {
  const parts = [];
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const y0 = tipRise * t0 * t0;
    const y1 = tipRise * t1 * t1;
    const dz = t1 - t0;
    const len = Math.hypot(dz, y1 - y0);
    const g = new THREE.BoxGeometry(halfWidth * 2, thickness, len);
    g.translate(0, -thickness / 2, len / 2);      // 近端在 z=0、上表面在 y=0
    g.rotateX(-Math.atan2(y1 - y0, dz));          // 抬头
    g.translate(0, y0, t0);                       // 接到上一段末端
    parts.push(g);
  }
  return parts;
}

/** 跳板：Z∈[0,1]、X∈[-0.25,0.25]、板厚 0.06，原点 = 板根上表面中心，支撑座向下 0.25 */
function buildDivingBoard(level) {
  const parts = makeDeckSegments([4, 2, 1][level], 0.25, 0.06, 0.03);
  if (level === COARSEST_LEVEL) {
    parts.push(box(0.4, 0.25, 0.21, 0, -0.185, 0.125));      // 两座并作一块
  } else {
    parts.push(box(0.09, 0.25, 0.21, -0.16, -0.185, 0.125)); // 左支撑座
    parts.push(box(0.09, 0.25, 0.21, 0.16, -0.185, 0.125));  // 右支撑座
  }
  return mergeParts(parts, 'divingBoard');
}

/** 池梯：X∈[-0.3,0.3]、Y∈[0,1]、Z∈[0,0.4]；双弯管扶手（弯头 R=0.22）+ 3 级踏板 */
function buildPoolLadder(level) {
  const tube = 0.03;
  const bendR = 0.22;
  const railZ = 0.37;              // 立管轴线 z（+ 管半径 = 0.40 悬挑上限）
  const bendY = 1 - bendR - tube;  // 弯头圆心高度 0.75
  const bendZ = railZ - bendR;     // 弯头圆心 z = 0.15
  const seg = [8, 6, 5][level];
  const parts = [];
  for (const sx of [-1, 1]) {
    const x = sx * 0.27;
    if (level === COARSEST_LEVEL) {
      parts.push(cyl(tube, 1, seg, 'y', x, 0.5, railZ));                   // 直立管到顶
      parts.push(box(0.06, 0.06, railZ, x, bendY + bendR, railZ / 2));     // 方杆代替弯头 + 握把
    } else {
      parts.push(cyl(tube, bendY, seg, 'y', x, bendY / 2, railZ));         // 竖直段
      const bend = new THREE.TorusGeometry(bendR, tube, level === 0 ? 6 : 4, level === 0 ? 8 : 5, Math.PI / 2);
      bend.rotateY(-Math.PI / 2);                                          // 弯面转到 YZ 平面：由 +Z 弯向 +Y
      bend.translate(x, bendY, bendZ);
      parts.push(bend);
      parts.push(cyl(tube, bendZ, seg, 'z', x, bendY + bendR, bendZ / 2)); // 顶部握把伸向池壁
    }
  }
  for (const y of (level === COARSEST_LEVEL ? [0.42] : [0.18, 0.42, 0.66])) {
    parts.push(box(0.54, 0.025, 0.14, 0, y, 0.30));                        // 踏板
  }
  return mergeParts(parts, 'poolLadder');
}

/** 挑台板：1×1、Y 厚 0.12、顶面在 y=0（原点 = 顶面中心） */
function buildBalconyPlate() {
  return box(1, 0.12, 1, 0, -0.06, 0);
}

/** 矩形窗框：1×1、XY 平面、Z∈[-0.06,0.06]、框宽 0.08，内部镂空 */
function buildWindowFrameRect() {
  const w = 0.08;
  const d = 0.12;
  return mergeParts([
    box(1, w, d, 0, 0.5 - w / 2, 0),          // 上框
    box(1, w, d, 0, -0.5 + w / 2, 0),         // 下框
    box(w, 1 - 2 * w, d, -0.5 + w / 2, 0, 0), // 左框
    box(w, 1 - 2 * w, d, 0.5 - w / 2, 0, 0)   // 右框
  ], 'windowFrameRect');
}

/** 拱窗框：下半竖直边框 + 上半半圆拱券（起拱点 y=0），内部镂空 */
function buildWindowFrameArch(level) {
  const seg = [16, 10, 6][level];
  const w = 0.08;
  const d = 0.12;
  return mergeParts([
    makeRingBand(0.5, 0.5 - w, d, seg, 0, Math.PI),      // 拱券（圆心即原点）
    box(w, 0.5 - w, d, -0.5 + w / 2, -0.25 + w / 2, 0),
    box(w, 0.5 - w, d, 0.5 - w / 2, -0.25 + w / 2, 0),
    box(1, w, d, 0, -0.5 + w / 2, 0)                     // 窗台
  ], 'windowFrameArch');
}

/** 圆窗框：外径 1 的环形框，内部镂空 */
function buildWindowFrameRound(level) {
  return makeRingBand(0.5, 0.42, 0.12, [24, 16, 12][level], 0, Math.PI * 2);
}

/** 假景板：1×1 平面、法线 +Z、UV 0..1（贴窗外单调梦幻风景） */
function buildVistaPanel() {
  return new THREE.PlaneGeometry(1, 1);
}

/** 天窗框：XZ 平面 1×1 方框、框宽 0.1、Y∈[-0.075,0.075] */
function buildSkylightFrame() {
  const w = 0.1;
  const h = 0.15;
  return mergeParts([
    box(1, h, w, 0, 0, -0.5 + w / 2),
    box(1, h, w, 0, 0, 0.5 - w / 2),
    box(w, h, 1 - 2 * w, -0.5 + w / 2, 0, 0),
    box(w, h, 1 - 2 * w, 0.5 - w / 2, 0, 0)
  ], 'skylightFrame');
}

/** 天窗发光面：1×1 平面、法线 +Y（旋转已 bake 进顶点） */
function buildSkylightPane() {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** 反常环：外径 1、管径 0.16（管半径 0.08 → 环半径 0.42），XY 平面 */
function buildOddTorus(level) {
  return new THREE.TorusGeometry(0.42, 0.08, [8, 6, 4][level], [24, 12, 8][level]);
}

/** 「略微不安」的方碑：顶面绕 Y 扭转 12° 并切掉一角，1×1×1、底面中心 */
function buildOddMonolith(level) {
  if (level === COARSEST_LEVEL) return box(1, 1, 1, 0, 0.5, 0);
  const TWIST = 12 * Math.PI / 180;
  // 单层 4 角：半径随扭转角补偿，使包围盒恒为 1×1（|x|max = |z|max = 0.5）
  const ring = (t) => {
    const twist = TWIST * t;
    const r = 0.5 / Math.cos(Math.PI / 4 - twist);
    const out = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2 + twist;
      out.push([r * Math.cos(a), t, r * Math.sin(a)]);
    }
    return out;
  };
  const rings = level === 0 ? [ring(0), ring(0.78), ring(1)] : [ring(0), ring(1)];
  if (level === 0) {
    const cut = rings[2][0]; // 顶层 0 号角向内收 → 切出一个斜角
    cut[0] *= 0.42;
    cut[2] *= 0.42;
  }
  const positions = [];
  const uvs = [];
  const push = (p, u, v) => { positions.push(p[0], p[1], p[2]); uvs.push(u, v); };
  for (let l = 0; l < rings.length - 1; l++) {
    const lo = rings[l];
    const hi = rings[l + 1];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4; // 绕序：外向（配合 computeVertexNormals 得到平直面法线）
      push(lo[i], 0, 0); push(hi[i], 0, 1); push(hi[j], 1, 1);
      push(lo[i], 0, 0); push(hi[j], 1, 1); push(lo[j], 1, 0);
    }
  }
  const bot = rings[0];
  const top = rings[rings.length - 1];
  push(bot[0], 0, 0); push(bot[1], 1, 0); push(bot[2], 1, 1); // 底面（法线 -Y）
  push(bot[0], 0, 0); push(bot[2], 1, 1); push(bot[3], 0, 1);
  push(top[0], 0, 0); push(top[2], 1, 1); push(top[1], 1, 0); // 顶面（法线 +Y）
  push(top[0], 0, 0); push(top[3], 0, 1); push(top[2], 1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();                                                  // 面法线（顶点不共享 → 平直硬边）
  g.setIndex([...Array(positions.length / 3).keys()]);                       // 补顺序索引：与其余 kind 同为 indexed，便于下游再合并
  return g;
}

/** 反常球：直径 1、中心原点 */
function buildOddSphere(level) {
  const seg = [[20, 14], [12, 8], [8, 6]][level];
  return new THREE.SphereGeometry(0.5, seg[0], seg[1]);
}

/** kind → 构造器（每个构造器接受 level 0..2） */
const BUILDERS = {
  slab: buildSlab, columnSquare: buildColumnSquare, columnRound: buildColumnRound,
  columnCluster: buildColumnCluster, archUnderwater: buildArchUnderwater, railing: buildRailing,
  divingBoard: buildDivingBoard, poolLadder: buildPoolLadder, balconyPlate: buildBalconyPlate,
  windowFrameRect: buildWindowFrameRect, windowFrameArch: buildWindowFrameArch,
  windowFrameRound: buildWindowFrameRound, vistaPanel: buildVistaPanel,
  skylightFrame: buildSkylightFrame, skylightPane: buildSkylightPane,
  oddTorus: buildOddTorus, oddMonolith: buildOddMonolith, oddSphere: buildOddSphere
};

/** 收尾：裁剪多余属性、补法线、算包围体、命名 */
function finalize(geometry, name) {
  if (!geometry || geometry.isBufferGeometry !== true) throw new Error(`[Elements] ${name}: 构造器未返回 BufferGeometry`);
  for (const key of Object.keys(geometry.attributes)) {
    if (!KEEP_ATTRIBUTES.includes(key)) geometry.deleteAttribute(key);
  }
  if (!geometry.getAttribute('position')) throw new Error(`[Elements] ${name}: 缺少 position 属性`);
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  if (!geometry.getAttribute('uv')) throw new Error(`[Elements] ${name}: 缺少 uv 属性`);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = name;
  return geometry;
}

/**
 * 构建全部元素几何体（纯函数，可重复调用，不依赖全局状态）。
 * @param {{ lodLevels?: number }} options lodLevels 默认 3；超过 3 档时复用最粗档
 * @returns {Map<string, THREE.BufferGeometry[]>} kind → 长度恒为 lodLevels 的数组（index 0 = 最精细）
 */
export function createElementGeometries(options = {}) {
  const { lodLevels = 3 } = options;
  if (!Number.isInteger(lodLevels) || lodLevels < 1) {
    throw new Error(`[Elements] lodLevels 必须是 >=1 的整数，收到 ${lodLevels}`);
  }
  const map = new Map();
  for (const kind of ELEMENT_KINDS) {
    const build = BUILDERS[kind];
    if (typeof build !== 'function') throw new Error(`[Elements] 缺少 kind "${kind}" 的构造器`);
    const levels = [];
    for (let i = 0; i < lodLevels; i++) {
      levels.push(finalize(build(Math.min(i, COARSEST_LEVEL)), `${kind}_lod${i}`));
    }
    map.set(kind, levels);
  }
  return map;
}

/**
 * 释放全部 geometry（GPU 资源）并清空 Map。
 * @param {Map<string, THREE.BufferGeometry[]>} map
 * @returns {number} 实际释放的 geometry 数量
 */
export function disposeElementGeometries(map) {
  if (!map || typeof map.forEach !== 'function') return 0;
  let count = 0;
  map.forEach((levels) => {
    if (!Array.isArray(levels)) return;
    for (const geometry of levels) {
      if (geometry && typeof geometry.dispose === 'function') {
        geometry.dispose();
        count++;
      }
    }
  });
  if (typeof map.clear === 'function') map.clear();
  return count;
}

/**
 * 统计信息，供 HUD / 冒烟测试打印。
 * @param {Map<string, THREE.BufferGeometry[]>} map
 * @returns {{kind: string, lod: number, vertices: number, triangles: number}[]}
 */
export function describeElementGeometries(map) {
  const rows = [];
  if (!map || typeof map.forEach !== 'function') return rows;
  map.forEach((levels, kind) => {
    if (!Array.isArray(levels)) return;
    levels.forEach((geometry, lod) => {
      const position = geometry ? geometry.getAttribute('position') : null;
      const vertices = position ? position.count : 0;
      const triangles = geometry && geometry.index ? geometry.index.count / 3 : Math.floor(vertices / 3);
      rows.push({ kind, lod, vertices, triangles });
    });
  });
  return rows;
}
