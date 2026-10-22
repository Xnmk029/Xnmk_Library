// VOXY CRAFT — 树木 / 地物（确定性，跨区块无缝）
// 4 种轮廓截然不同的树：锥形针叶杉、弯干伞冠棕榈、圆冠樱花、2×2 巨型高树（地标）。
// 每棵树由 (trunkX, trunkZ, seed) 纯函数推导；每个 chunk 独立 stamp 落入自身的体素 → 无缝。
/*LOGIC_START*/
import { hash2 } from '../math/rng.js';
import { blockByName, BLOCKS } from '../data/registry.js';
import { BIOME, SEA } from './generator.js';
import { S } from './chunk.js';

const ID = {};
function id(name) {
  if (ID[name] === undefined) { const b = blockByName(name); ID[name] = b ? b.id : 0; }
  return ID[name];
}
function isLeafId(i) { const b = BLOCKS[i]; return !!b && b.category === 'leaf'; }

// ---- 树形生成（返回相对树干基点的体素 [dx,dy,dz,id]）----
function genFir(H) {
  const v = [], LOG = id('杉原木'), LEAF = id('杉树叶');
  for (let dy = 0; dy < H - 1; dy++) v.push([0, dy, 0, LOG]);
  for (let dy = 2; dy <= H; dy++) {
    const t = (dy - 2) / (H - 2);
    const r = Math.round((1 - t) * (H > 11 ? 3 : 2));
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz <= r * r) {
        if (dx === 0 && dz === 0 && dy < H - 1) continue;
        v.push([dx, dy, dz, LEAF]);
      }
    }
  }
  v.push([0, H, 0, LEAF]);
  return v;
}

function genPalm(H, tx, tz, seed) {
  const v = [], LOG = id('棕榈原木'), LEAF = id('棕榈叶');
  const leanX = (hash2(tx, tz, seed ^ 0x77) - 0.5) * 2;
  const leanZ = (hash2(tx, tz, seed ^ 0x88) - 0.5) * 2;
  let topX = 0, topZ = 0;
  for (let dy = 0; dy < H; dy++) {
    const f = dy / H;
    const sx = Math.round(leanX * f * f * 3);
    const sz = Math.round(leanZ * f * f * 3);
    v.push([sx, dy, sz, LOG]); topX = sx; topZ = sz;
  }
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [dx, dz] of dirs) for (let r = 1; r <= 4; r++) {
    const droop = r <= 1 ? 1 : r === 2 ? 0 : r === 3 ? -1 : -2;   // 先扬后垂的伞面
    v.push([topX + dx * r, H + droop, topZ + dz * r, LEAF]);
  }
  // 顶部叶团
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) v.push([topX + dx, H + 1, topZ + dz, LEAF]);
  v.push([topX, H + 2, topZ, LEAF]);
  return v;
}

function genSakura() {
  const v = [], LOG = id('樱花原木'), LEAF = id('樱花叶');
  for (let dy = 0; dy < 3; dy++) v.push([0, dy, 0, LOG]);
  const cy = 5, R = 3;
  for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
    if (dx * dx + dy * dy + dz * dz <= R * R + 1) v.push([dx, cy + dy, dz, LEAF]);
  }
  return v;
}

function genGiant(H) {
  const v = [], LOG = id('巨树原木'), LEAF = id('巨树叶');
  for (let dy = 0; dy < H - 3; dy++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) v.push([dx, dy, dz, LOG]);
  const cy = H - 2, R = 5;
  for (let dx = -R; dx <= R + 1; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -R; dz <= R + 1; dz++) {
    if (dx * dx + dy * dy * 2 + dz * dz <= R * R + 2) v.push([dx, cy + dy, dz, LEAF]);
  }
  return v;
}

const TREE = { fir: genFir, palm: genPalm, sakura: genSakura, giant: genGiant };

// 由群系 + 随机决定树种与是否生成
function chooseTree(biome, r, r2, seed) {
  switch (biome) {
    case BIOME.FOREST:
      if (r > 0.20) return null;
      if (r2 < 0.045) return 'giant';
      return r2 < 0.55 ? 'fir' : 'sakura';
    case BIOME.PLAINS:
      if (r > 0.015) return null;
      return r2 < 0.5 ? 'sakura' : 'fir';
    case BIOME.DESERT:
      return r > 0.02 ? null : 'palm';
    case BIOME.SNOW:
      return r > 0.045 ? null : 'fir';
    case BIOME.PLATEAU:
      return r > 0.03 ? null : 'fir';
    case BIOME.BASIN:
      return r > 0.02 ? null : (r2 < 0.5 ? 'fir' : 'sakura');
    default:
      return null; // 湖泊不生树
  }
}

function treeHeight(type, tx, tz, seed) {
  const rr = hash2(tx, tz, seed ^ 0x3131);
  if (type === 'fir') return 9 + Math.floor(rr * 5);      // 9-13
  if (type === 'palm') return 7 + Math.floor(rr * 4);     // 7-10
  if (type === 'giant') return 20 + Math.floor(rr * 7);   // 20-26
  return 5;                                                // sakura 固定
}

// 查询某柱会生成的树种（供测试 / 远景地标定位）
export function treeTypeAt(tx, tz, terrain, seed) {
  const r = hash2(tx, tz, seed ^ 0x51ab);
  if (r > 0.22) return null;
  const h = terrain.heightAt(tx, tz);
  if (h < SEA + 1) return null;
  const biome = terrain.biomeAt(tx, tz, h);
  const r2 = hash2(tx, tz, seed ^ 0x99cd);
  return chooseTree(biome, r, r2, seed);
}

// 在 chunk 内 stamp 所有落入本区块的树体素
export function decorateChunk(chunk, terrain, seed) {
  const bx = chunk.cx * S, by = chunk.cy * S, bz = chunk.cz * S;
  const data = chunk.data;
  const R = 7; // 扫描半径（覆盖最大树冠）
  for (let tx = bx - R; tx < bx + S + R; tx++) {
    for (let tz = bz - R; tz < bz + S + R; tz++) {
      const r = hash2(tx, tz, seed ^ 0x51ab);
      if (r > 0.22) continue;                    // 候选门（廉价，先于 heightAt）
      const h = terrain.heightAt(tx, tz);
      if (h < SEA + 1) continue;                 // 水中不生树
      const biome = terrain.biomeAt(tx, tz, h);
      const r2 = hash2(tx, tz, seed ^ 0x99cd);
      const type = chooseTree(biome, r, r2, seed);
      if (!type) continue;
      const H = treeHeight(type, tx, tz, seed);
      const vox = TREE[type](H, tx, tz, seed);
      for (let k = 0; k < vox.length; k++) {
        const wx = tx + vox[k][0], wy = h + 1 + vox[k][1], wz = tz + vox[k][2];
        const lx = wx - bx, ly = wy - by, lz = wz - bz;
        if (lx < 0 || lx >= S || ly < 0 || ly >= S || lz < 0 || lz >= S) continue;
        const li = lx + lz * S + ly * S * S;
        const cur = data[li];
        const nid = vox[k][3];
        if (cur === 0) data[li] = nid;
        else if (!isLeafId(nid) && isLeafId(cur)) data[li] = nid; // 树干穿过树叶
      }
    }
  }
}
/*LOGIC_END*/
