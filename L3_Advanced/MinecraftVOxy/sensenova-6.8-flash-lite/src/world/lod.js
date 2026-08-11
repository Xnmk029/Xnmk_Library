// VOXY CRAFT — 远景 LOD（特征记录 + 立体柱网格，非高度图平板）
// 每个降采样单元携带 topHeight/topColor/canopy/snow/water/cliff，挤出立体柱：
// 森林树冠凸起(绒感)、巨树地标剪影、雪山白帽、台地崖壁、水色走向。SPEC-技术 §6。
/*LOGIC_START*/
import { BIOME, SEA } from './generator.js';
import { treeTypeAt } from './trees.js';
import { hash2 } from '../math/rng.js';

const SNOWCAP_H = 85;
const C = {
  grass: [0.36, 0.55, 0.24],
  forest: [0.27, 0.44, 0.20],
  sand: [0.83, 0.77, 0.55],
  snow: [0.93, 0.95, 0.98],
  stone: [0.50, 0.50, 0.53],
  water: [0.20, 0.40, 0.74],
  leaf: [0.24, 0.46, 0.20],
  dirt: [0.45, 0.33, 0.23],
  rock: [0.40, 0.40, 0.44],
};

function biomeTop(biome) {
  switch (biome) {
    case BIOME.DESERT: return C.sand;
    case BIOME.SNOW: return C.snow;
    case BIOME.FOREST: return C.forest;
    case BIOME.PLATEAU: return C.grass;
    case BIOME.BASIN: return C.grass;
    default: return C.grass;
  }
}

// 单元树冠：绒感密度由噪声驱动，巨树地标稀疏采样（低成本）
function sampleCanopy(terrain, seed, wx, wz, cell, biome) {
  if (biome !== BIOME.FOREST && biome !== BIOME.PLAINS) return { density: 0, giant: false };
  const cx = Math.floor(wx), cz = Math.floor(wz);
  const density = biome === BIOME.FOREST
    ? 0.4 + hash2(cx, cz, seed ^ 0x55) * 0.55
    : hash2(cx, cz, seed ^ 0x55) * 0.18;
  let giant = false;
  if (biome === BIOME.FOREST) {
    for (let k = 0; k < 2; k++) {
      const sx = wx + (hash2(k, 1, seed ^ 0x66) - 0.5) * cell;
      const sz = wz + (hash2(k, 2, seed ^ 0x77) - 0.5) * cell;
      if (treeTypeAt(Math.floor(sx), Math.floor(sz), terrain, seed) === 'giant') { giant = true; break; }
    }
  }
  return { density, giant };
}

function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// 发射一个立体柱（顶面 + 4 侧面，含方向明暗）
function emitColumn(pos, col, wx, wz, cell, baseY, topY, topC, sideC) {
  const x0 = wx - cell / 2, x1 = wx + cell / 2;
  const z0 = wz - cell / 2, z1 = wz + cell / 2;
  const push = (x, y, z, c, s) => { pos.push(x, y, z); col.push(c[0] * s, c[1] * s, c[2] * s); };
  const quad = (a, b, c2, d, cc, s) => { push(...a, cc, s); push(...b, cc, s); push(...c2, cc, s); push(...a, cc, s); push(...c2, cc, s); push(...d, cc, s); };
  // 顶面
  quad([x0, topY, z0], [x1, topY, z0], [x1, topY, z1], [x0, topY, z1], topC, 1.0);
  if (topY - baseY < 0.5) return;
  // 侧面
  quad([x0, baseY, z1], [x1, baseY, z1], [x1, topY, z1], [x0, topY, z1], sideC, 0.86); // +Z
  quad([x1, baseY, z0], [x0, baseY, z0], [x0, topY, z0], [x1, topY, z0], sideC, 0.86); // -Z
  quad([x1, baseY, z1], [x1, baseY, z0], [x1, topY, z0], [x1, topY, z1], sideC, 0.72); // +X
  quad([x0, baseY, z0], [x0, baseY, z1], [x0, topY, z1], [x0, topY, z0], sideC, 0.72); // -X
}

// 构建某 LOD 级环形的立体网格
export function buildLodRing(terrain, seed, cell, innerR, outerR, centerX, centerZ) {
  const pos = [], col = [];
  const c0x = Math.floor((centerX - outerR) / cell), c1x = Math.floor((centerX + outerR) / cell);
  const c0z = Math.floor((centerZ - outerR) / cell), c1z = Math.floor((centerZ + outerR) / cell);
  const inner2 = innerR * innerR, outer2 = outerR * outerR;

  for (let ccx = c0x; ccx <= c1x; ccx++) {
    for (let ccz = c0z; ccz <= c1z; ccz++) {
      const wx = ccx * cell + cell / 2;
      const wz = ccz * cell + cell / 2;
      const dx = wx - centerX, dz = wz - centerZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < inner2 || d2 > outer2) continue;

      const h = terrain.heightAt(wx, wz);
      const biome = terrain.biomeAt(wx, wz, h);
      const temp = terrain.tempAt(wx, wz);
      const isWater = h < SEA;

      // 邻居高度 → 崖壁基底（台地阶梯）
      const hN = terrain.heightAt(wx, wz - cell);
      const hS = terrain.heightAt(wx, wz + cell);
      const hE = terrain.heightAt(wx + cell, wz);
      const hW = terrain.heightAt(wx - cell, wz);
      const minN = Math.min(h, hN, hS, hE, hW);

      let topY = h, topC = biomeTop(biome), sideC = C.dirt;
      if (biome === BIOME.PLATEAU || biome === BIOME.SNOW) sideC = C.rock;

      if (isWater) {
        topY = SEA; topC = C.water; sideC = C.dirt;
      } else {
        // 雪帽
        if (temp < -0.15 && h > SNOWCAP_H) { topC = C.snow; sideC = mix(C.rock, C.snow, 0.4); }
        // 树冠绒感
        const { density, giant } = sampleCanopy(terrain, seed, wx, wz, cell, biome);
        if (giant) {
          topY = h + 20; topC = C.leaf;            // 巨树地标剪影
        } else if (density > 0.05) {
          const bump = 2 + density * 8 + hash2(ccx, ccz, seed ^ 0xabc) * 2;
          topY = h + bump;
          topC = mix(topC, C.leaf, Math.min(0.85, density * 2.2));  // 森林绒感色块
        }
      }

      const baseY = isWater ? Math.min(h, SEA) - 2 : minN - 1;
      emitColumn(pos, col, wx, wz, cell, baseY, topY, topC, sideC);
    }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), tris: pos.length / 9 };
}

// LOD 分级定义（cell 尺寸 + 环形半径，2 的幂递增）
export function lodLevels(viewDist) {
  const near = 64; // LOD 起始半径：小于满精度流式范围(~80-86)，始终重叠避免缝隙
  const levels = [];
  let cell = 8, inner = near;
  while (inner < viewDist) {
    const outer = Math.min(inner * 2, viewDist);
    levels.push({ cell, innerR: inner, outerR: outer });
    inner = outer;
    cell *= 2;
  }
  // 相邻级重叠 2 个粗单元格：圆形环带与方形网格错位会在对角线方向产生两级都未覆盖的
  // 空洞（露出天空），重叠后任意区域至少被一级覆盖，消除缝隙。
  for (let i = 1; i < levels.length; i++) {
    levels[i].innerR = Math.max(near, levels[i - 1].outerR - 2 * levels[i].cell);
  }
  // 最外级外扩一个单元：消除 viewDist 边界对角线方向的缝隙（多渲染部分被雾遮盖）
  if (levels.length > 0) {
    const last = levels[levels.length - 1];
    last.outerR = last.outerR + last.cell;
  }
  return levels;
}
/*LOGIC_END*/
