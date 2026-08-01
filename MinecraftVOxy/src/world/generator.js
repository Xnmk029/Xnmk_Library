// VOXY CRAFT — 地形 / 群系生成器（确定性，纯函数）
// 设计见 SPEC-设计 §4-5，技术见 SPEC-技术 §4。
// Terrain 类是世界真相源：heightAt / biomeAt / featureAt 被生成、LOD、远景共享，
// 保证各层级地形一致、远近景不冲突。
/*LOGIC_START*/
import { Perlin } from '../math/noise.js';
import { hash3 } from '../math/rng.js';
import { blockByName } from '../data/registry.js';
import { S } from './chunk.js';
import { decorateChunk } from './trees.js';

// ---- 群系枚举 ----
export const BIOME = {
  PLAINS: 0, FOREST: 1, DESERT: 2, PLATEAU: 3, BASIN: 4, LAKE: 5, SNOW: 6,
};
export const BIOME_NAMES = ['平原', '森林', '沙漠', '高原', '盆地', '湖泊', '雪山'];

// ---- 地形常量 ----
export const SEA = 40;          // 水面高度
const BASE = 48;         // 基准地表
const K = 3.0;           // 指数陡峭度（增大→高山更挺拔，远景更立体）
const SCALE = 42;        // 拔升幅度
const PLATEAU_STEP = 8;  // 台地台阶高度
const PLATEAU_H = 78;    // 高原阈值
const SNOW_H = 92;       // 雪山海拔阈值
const SNOWCAP_H = 85;    // 雪帽海拔
const RIVER_W = 0.035;   // 河流宽度阈值

// 方块 id 缓存
const B = {};
function bid(name) {
  if (B[name] === undefined) {
    const b = blockByName(name);
    B[name] = b ? b.id : 0;
  }
  return B[name];
}

export class Terrain {
  constructor(seed = 0) {
    this.seed = seed >>> 0;
    this.pH = new Perlin(this.seed ^ 0x1a2b3c);
    this.pT = new Perlin(this.seed ^ 0x4d5e6f);
    this.pHu = new Perlin(this.seed ^ 0x708192);
    this.pRiver = new Perlin(this.seed ^ 0xa3b4c5);
    this.pPlateau = new Perlin(this.seed ^ 0xd6e7f8);
  }

  // 温度场 [-1,1]（大尺度）
  tempAt(wx, wz) {
    return this.pT.fbm2(wx * 0.00098 + 1000, wz * 0.00098, 4);
  }
  // 湿度场 [-1,1]
  humAt(wx, wz) {
    return this.pHu.fbm2(wx * 0.00098 - 1000, wz * 0.00098 + 500, 4);
  }

  // 高度场：指数塑形 + 台地量化 + 河流下切
  heightAt(wx, wz) {
    const base = this.pH.fbm2(wx * 0.00195, wz * 0.00195, 6);       // 大势 /512
    const detail = this.pH.fbm2(wx * 0.0156 + 100, wz * 0.0156 + 100, 4) * 0.18; // 细节 /64
    let n = base + detail;
    n = Math.max(-1, Math.min(1, n));
    const sign = n >= 0 ? 1 : -1;
    let h = BASE + sign * (Math.pow(2, Math.abs(n) * K) - 1) * SCALE;

    // 台地量化：大尺度掩膜区 + 高海拔 → 阶梯平顶
    const pm = this.pPlateau.fbm2(wx * 0.0009, wz * 0.0009, 3);
    if (pm > 0.25 && h > 70) {
      h = Math.floor(h / PLATEAU_STEP) * PLATEAU_STEP;
    }

    // 河流下切：低噪声蜿蜒路径，河床低于两侧
    const rv = Math.abs(this.pRiver.fbm2(wx * 0.0033, wz * 0.0033, 3));
    if (rv < RIVER_W) {
      const strength = 1 - rv / RIVER_W;
      h -= strength * strength * 16;
    }
    return Math.floor(h);
  }

  // 群系划分（高度 + 温度 + 湿度）
  biomeAt(wx, wz, h) {
    if (h === undefined) h = this.heightAt(wx, wz);
    const t = this.tempAt(wx, wz);
    const hu = this.humAt(wx, wz);
    if (h < SEA) return BIOME.LAKE;
    if (h < SEA + 3 && hu > 0.05) return BIOME.BASIN;
    if (h > SNOW_H && t < -0.05) return BIOME.SNOW;
    if (h > PLATEAU_H) return BIOME.PLATEAU;
    if (t > 0.28 && hu < -0.05) return BIOME.DESERT;
    if (hu > 0.12) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  // 是否雪帽（高海拔 + 低温，跨群系）
  snowCap(wx, wz, h) {
    return h > SNOWCAP_H && this.tempAt(wx, wz) < -0.15;
  }

  // 矿物散布（仅替换石头/深板岩）
  _ore(wx, wy, wz, baseId) {
    const s = this.seed;
    if (wy < 24 && hash3(wx, wy, wz, s + 1) < 0.0035) return bid('钻石矿石');
    if (wy < 24 && hash3(wx, wy, wz, s + 2) < 0.0030) return bid('翡翠矿石');
    if (wy < 40 && hash3(wx, wy, wz, s + 8) < 0.0060) return bid('青金石矿石');
    if (wy < 48 && hash3(wx, wy, wz, s + 3) < 0.0060) return bid('金矿石');
    if (wy < 48 && hash3(wx, wy, wz, s + 4) < 0.0070) return bid('红石矿石');
    if (wy < 64 && hash3(wx, wy, wz, s + 5) < 0.0110) return bid('铁矿石');
    if (wy < 64 && hash3(wx, wy, wz, s + 6) < 0.0110) return bid('铜矿石');
    if (wy < 80 && hash3(wx, wy, wz, s + 7) < 0.0150) return bid('煤矿石');
    return baseId;
  }

  // 单列在某高度的方块
  columnBlock(wx, wy, wz, h, biome) {
    if (wy === 0) return bid('基岩');
    if (wy > h) return wy <= SEA ? bid('水') : 0; // 空气

    const depth = h - wy;
    const deep = this._ore(wx, wy, wz, wy < 20 ? bid('深板岩') : bid('石头'));

    // 雪帽覆盖（高寒山峰）
    if (this.snowCap(wx, wz, h)) {
      if (depth === 0) return bid('雪块');
      if (depth < 3) return bid('泥土');
      return deep;
    }

    switch (biome) {
      case BIOME.DESERT:
        if (depth < 4) return bid('沙子');
        if (depth < 6) return bid('砂岩');
        return deep;
      case BIOME.SNOW:
        if (depth === 0) return bid('雪块');
        if (depth < 3) return bid('泥土');
        return deep;
      case BIOME.BASIN:
        if (depth === 0) return bid('灰化土');
        if (depth < 3) return bid('泥土');
        return deep;
      case BIOME.LAKE:
        if (depth === 0) return h < SEA - 4 ? bid('泥土') : bid('沙子');
        if (depth < 3) return bid('泥土');
        return deep;
      case BIOME.PLATEAU:
      case BIOME.FOREST:
      case BIOME.PLAINS:
      default:
        if (depth === 0) return bid('草方块');
        if (depth < 3) return bid('泥土');
        return deep;
    }
  }

  // 填充一个立方体 chunk
  fillChunk(chunk) {
    const bx = chunk.cx * S, by = chunk.cy * S, bz = chunk.cz * S;
    const data = chunk.data;
    // 预计算每列高度/群系（16×16）
    const heights = new Int16Array(S * S);
    const biomes = new Uint8Array(S * S);
    for (let lz = 0; lz < S; lz++) {
      for (let lx = 0; lx < S; lx++) {
        const wx = bx + lx, wz = bz + lz;
        const h = this.heightAt(wx, wz);
        heights[lx + lz * S] = h;
        biomes[lx + lz * S] = this.biomeAt(wx, wz, h);
      }
    }
    for (let ly = 0; ly < S; ly++) {
      const wy = by + ly;
      for (let lz = 0; lz < S; lz++) {
        for (let lx = 0; lx < S; lx++) {
          const ci = lx + lz * S;
          const wx = bx + lx, wz = bz + lz;
          const id = this.columnBlock(wx, wy, wz, heights[ci], biomes[ci]);
          data[lx + lz * S + ly * S * S] = id;
        }
      }
    }
    // 地物：树木（确定性，跨区块无缝）
    decorateChunk(chunk, this, this.seed);
    chunk.generated = true;
  }

  // 远景特征采样（LOD 用，M8）：返回某降采样单元的代表特征
  featureAt(wx, wz) {
    const h = this.heightAt(wx, wz);
    const biome = this.biomeAt(wx, wz, h);
    return { h, biome, temp: this.tempAt(wx, wz), hum: this.humAt(wx, wz) };
  }
}

// 出生点选择：优先在高山附近的平坦草地出生（出生即见高耸山峦）
export function findSpawn(terrain) {
  // 1) 找高山（≥108），在其周围 300-900 格找平坦草地
  for (let ring = 500; ring <= 5000; ring += 250) {
    for (let a = 0; a < 24; a++) {
      const ang = a * Math.PI / 12;
      const px = Math.round(Math.sin(ang) * ring), pz = Math.round(Math.cos(ang) * ring);
      if (terrain.heightAt(px, pz) >= 108) {
        for (let d = 300; d <= 900; d += 150) {
          for (let b = 0; b < 12; b++) {
            const bang = b * Math.PI / 6;
            const sx = px + Math.round(Math.sin(bang) * d), sz = pz + Math.round(Math.cos(bang) * d);
            const sh = terrain.heightAt(sx, sz);
            const sb = terrain.biomeAt(sx, sz, sh);
            if ((sb === BIOME.PLAINS || sb === BIOME.FOREST) && sh > SEA + 2 && sh < 68)
              return { x: sx, z: sz, peakX: px, peakZ: pz };
          }
        }
      }
    }
  }
  // 2) 兜底：平坦草地 + 附近最高峰
  const bestPeak = (cx, cz) => {
    let best = null, bestScore = -1e9;
    for (let a = 0; a < 16; a++) {
      const ang = a * Math.PI / 8;
      for (const d of [200, 450, 700, 1000]) {
        const x = cx + Math.round(Math.sin(ang) * d), z = cz + Math.round(Math.cos(ang) * d);
        const h = terrain.heightAt(x, z);
        const score = h - d * 0.055;
        if (score > bestScore) { bestScore = score; best = { x, z, h }; }
      }
    }
    return best;
  };
  let fallback = null;
  for (let ring = 0; ring <= 4000; ring += 50) {
    for (let x = -ring; x <= ring; x += 50)
      for (let z = -ring; z <= ring; z += 50) {
        if (Math.abs(x) !== ring && Math.abs(z) !== ring) continue;
        const h = terrain.heightAt(x, z);
        const b = terrain.biomeAt(x, z, h);
        if ((b === BIOME.PLAINS || b === BIOME.FOREST) && h > SEA + 2 && h < 68) {
          if (!fallback) fallback = { x, z };
          const p = bestPeak(x, z);
          if (p && p.h >= 90) return { x, z, peakX: p.x, peakZ: p.z };
        }
      }
  }
  return fallback ? { x: fallback.x, z: fallback.z, peakX: fallback.x, peakZ: fallback.z } : { x: 0, z: 0, peakX: 0, peakZ: 0 };
}

// 生成 World.generator 兼容的函数
export function createGenerator(seed) {
  const t = new Terrain(seed);
  const fn = (chunk) => t.fillChunk(chunk);
  fn.terrain = t;
  return fn;
}
/*LOGIC_END*/
