import { createNoise2D, createNoise3D, type NoiseFunction2D, type NoiseFunction3D } from "simplex-noise";
import {
  AIR, ANDESITE, BEDROCK, BIRCH_LEAVES, BIRCH_LOG, BLUE_ORCHID, CACTUS, CHUNK, CLAY, COAL_ORE, DANDELION, DEAD_BUSH,
  DIAMOND_ORE, DIORITE, DIRT, GOLD_ORE, GRANITE, GRASS, GRAVEL, HEIGHT, IRON_ORE, LAVA, OAK_LEAVES, OAK_LOG, POPPY,
  REDSTONE_ORE, SAND, SANDSTONE, SEA_LEVEL, SHORT_GRASS, SNOWY_GRASS, SNOW_BLOCK, SPRUCE_LEAVES, SPRUCE_LOG, STONE, WATER,
} from "./blocks";
import { Chunk, World, idx } from "./world";

/** Grows an oak tree at a sapling position using live world edits. Returns false if blocked. */
export function growTree(world: World, x: number, y: number, z: number): boolean {
  const h = 4 + Math.floor(Math.random() * 3);
  for (let i = 1; i < h + 2; i++) if (world.getBlock(x, y + i, z) !== AIR) return false;
  const top = y + h - 1;
  const put = (px: number, py: number, pz: number, id: number, force = false) => {
    const cur = world.getBlock(px, py, pz);
    if (force || cur === AIR || cur === SHORT_GRASS) world.setBlock(px, py, pz, id, 0);
  };
  for (let dy = -3; dy <= 0; dy++) {
    const yy = top + dy;
    const r = dy <= -2 ? 2 : 1;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy < 0) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 1 ? dy === 0 : Math.random() < 0.5)) continue;
        put(x + dx, yy, z + dz, OAK_LEAVES);
      }
  }
  put(x, top + 1, z, OAK_LEAVES);
  for (let i = 0; i < h; i++) put(x, y + i, z, OAK_LOG, true);
  const below = world.getBlock(x, y - 1, z);
  if (below === GRASS) world.setBlock(x, y - 1, z, DIRT, 0);
  return true;
}

export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashInt(a: number, b: number, c: number) {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
function spline(v: number, pts: [number, number][]) {
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const t = (v - x0) / (x1 - x0);
      const s = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return pts[pts.length - 1][1];
}
function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export enum Biome { Ocean, Beach, Plains, Forest, BirchForest, Desert, Taiga, SnowyPeaks, River, Mountains }

export interface ColumnInfo {
  height: number;
  biome: Biome;
}

export class TerrainGen {
  private cont: NoiseFunction2D;
  private eros: NoiseFunction2D;
  private peaks: NoiseFunction2D;
  private detail: NoiseFunction2D;
  private hills: NoiseFunction2D;
  private temp: NoiseFunction2D;
  private humid: NoiseFunction2D;
  private river: NoiseFunction2D;
  private ravine: NoiseFunction2D;
  private ravineMask: NoiseFunction2D;
  private cheese: NoiseFunction3D;
  private spag1: NoiseFunction3D;
  private spag2: NoiseFunction3D;
  private modn: NoiseFunction3D;
  private stoneVar: NoiseFunction3D;
  private colCache = new Map<number, ColumnInfo>();

  constructor(public seed: number) {
    const mk2 = (k: number) => createNoise2D(mulberry32(seed + k * 7919));
    const mk3 = (k: number) => createNoise3D(mulberry32(seed + k * 104729));
    this.cont = mk2(1); this.eros = mk2(2); this.peaks = mk2(3); this.detail = mk2(4); this.hills = mk2(5);
    this.temp = mk2(6); this.humid = mk2(7); this.river = mk2(8); this.ravine = mk2(9); this.ravineMask = mk2(10);
    this.cheese = mk3(1); this.spag1 = mk3(2); this.spag2 = mk3(3); this.modn = mk3(4); this.stoneVar = mk3(5);
  }

  private fbm(n: NoiseFunction2D, x: number, z: number, oct: number, lac = 2, gain = 0.5) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += n(x * f, z * f) * a;
      norm += a;
      a *= gain;
      f *= lac;
    }
    return sum / norm;
  }

  column(x: number, z: number): ColumnInfo {
    const key = (x + 1048576) * 2097152 + (z + 1048576);
    const cached = this.colCache.get(key);
    if (cached) return cached;
    const c = this.fbm(this.cont, x * 0.0011, z * 0.0011, 5);
    const e = this.fbm(this.eros, x * 0.0021, z * 0.0021, 4);
    const pvRaw = this.fbm(this.peaks, x * 0.0045, z * 0.0045, 4);
    const pv = Math.pow(1 - Math.abs(pvRaw), 1.7);
    const hills = this.fbm(this.hills, x * 0.009, z * 0.009, 3) * 0.5 + 0.5;
    const d = this.fbm(this.detail, x * 0.025, z * 0.025, 3);
    const base = spline(c, [[-1, 20], [-0.55, 28], [-0.3, 40], [-0.13, 49], [0, 55], [0.25, 60], [0.6, 66], [1, 72]]);
    const land = smoothstep(-0.13, 0.12, c);
    const amp = spline(e, [[-1, 62], [-0.6, 46], [-0.25, 24], [0.15, 13], [0.55, 6], [1, 3]]);
    let h = base + land * (pv * amp + hills * amp * 0.4) + d * 3 * (0.5 + land);
    // rivers
    const rv = Math.abs(this.fbm(this.river, x * 0.0026, z * 0.0026, 3));
    let riverF = smoothstep(0.07, 0.02, rv) * land * smoothstep(82, 64, h);
    h = h + (SEA_LEVEL - 4.5 - h) * riverF;
    if (h < 1) h = 1;
    if (h > HEIGHT - 4) h = HEIGHT - 4;

    const t = this.fbm(this.temp, x * 0.0016 + 100, z * 0.0016, 3) - (h - 64) * 0.006;
    const hu = this.fbm(this.humid, x * 0.0019 - 100, z * 0.0019, 3);
    let biome: Biome;
    if (riverF > 0.45 && h < SEA_LEVEL) biome = Biome.River;
    else if (h < SEA_LEVEL - 1) biome = Biome.Ocean;
    else if (h < SEA_LEVEL + 2) biome = Biome.Beach;
    else if (h > 92) biome = Biome.SnowyPeaks;
    else if (t < -0.3) biome = Biome.Taiga;
    else if (t > 0.35 && hu < -0.05) biome = Biome.Desert;
    else if (h > 80 && e < -0.3) biome = Biome.Mountains;
    else if (hu > 0.45 && t > -0.1) biome = Biome.BirchForest;
    else if (hu > 0.12) biome = Biome.Forest;
    else biome = Biome.Plains;
    const info = { height: h, biome };
    if (this.colCache.size > 60000) this.colCache.clear();
    this.colCache.set(key, info);
    return info;
  }

  heightAt(x: number, z: number) {
    return Math.floor(this.column(x, z).height);
  }

  /** exact cave test at one point (used for feature placement) */
  private caveAtPoint(x: number, y: number, z: number, surface: number) {
    return this.isCave(
      this.cheese(x * 0.02, y * 0.024, z * 0.02),
      this.spag1(x * 0.034, y * 0.04, z * 0.034),
      this.spag2(x * 0.034 + 50, y * 0.04, z * 0.034 - 50),
      this.modn(x * 0.01, y * 0.01, z * 0.01),
      y, surface
    );
  }
  private isCave(a: number, s1: number, s2: number, m: number, y: number, surface: number) {
    const depth = surface - y;
    if (y <= 3) return false;
    const cheeseT = -0.78 + 0.3 * smoothstep(64, 14, y);
    if (a < cheeseT && depth > 6) return true;
    let w = 0.055 + 0.065 * (m * 0.5 + 0.5);
    w *= 0.45 + 0.55 * smoothstep(-1, 12, depth);
    if (Math.max(Math.abs(s1), Math.abs(s2)) < w) return true;
    return false;
  }

  generate(chunk: Chunk) {
    const bx = chunk.cx * CHUNK, bz = chunk.cz * CHUNK;
    const blocks = chunk.blocks;
    const heights = new Int32Array(CHUNK * CHUNK);
    const biomes = new Uint8Array(CHUNK * CHUNK);
    const rng = mulberry32(hashInt(chunk.cx, chunk.cz, this.seed));

    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        const info = this.column(bx + x, bz + z);
        heights[x * CHUNK + z] = Math.floor(info.height);
        biomes[x * CHUNK + z] = info.biome;
      }

    // --- low-res 3D noise grids (4x4x4 cells) ---
    const GX = CHUNK / 4 + 1, GY = HEIGHT / 4 + 1;
    const nCheese = new Float32Array(GX * GY * GX), nS1 = new Float32Array(GX * GY * GX), nS2 = new Float32Array(GX * GY * GX);
    const nMod = new Float32Array(GX * GY * GX), nStone = new Float32Array(GX * GY * GX);
    let maxH = 0;
    for (let i = 0; i < heights.length; i++) if (heights[i] > maxH) maxH = heights[i];
    const gyMax = Math.min(GY - 1, (maxH >> 2) + 2);
    for (let gx = 0; gx < GX; gx++)
      for (let gz = 0; gz < GX; gz++)
        for (let gy = 0; gy <= gyMax; gy++) {
          const wx = bx + gx * 4, wy = gy * 4, wz = bz + gz * 4;
          const gi = (gx * GX + gz) * GY + gy;
          nCheese[gi] = this.cheese(wx * 0.02, wy * 0.024, wz * 0.02);
          nS1[gi] = this.spag1(wx * 0.034, wy * 0.04, wz * 0.034);
          nS2[gi] = this.spag2(wx * 0.034 + 50, wy * 0.04, wz * 0.034 - 50);
          nMod[gi] = this.modn(wx * 0.01, wy * 0.01, wz * 0.01);
          nStone[gi] = this.stoneVar(wx * 0.03, wy * 0.03, wz * 0.03);
        }
    const tri = (arr: Float32Array, gx: number, gy: number, gz: number, fx: number, fy: number, fz: number) => {
      const i000 = (gx * GX + gz) * GY + gy;
      const i100 = i000 + GX * GY, i010 = i000 + 1, i001 = i000 + GY;
      const i110 = i100 + 1, i101 = i100 + GY, i011 = i001 + 1, i111 = i101 + 1;
      const c00 = arr[i000] + (arr[i100] - arr[i000]) * fx;
      const c10 = arr[i010] + (arr[i110] - arr[i010]) * fx;
      const c01 = arr[i001] + (arr[i101] - arr[i001]) * fx;
      const c11 = arr[i011] + (arr[i111] - arr[i011]) * fx;
      const c0 = c00 + (c10 - c00) * fy;
      const c1 = c01 + (c11 - c01) * fy;
      return c0 + (c1 - c0) * fz;
    };

    // --- base column fill ---
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        const H = heights[x * CHUNK + z];
        const biome = biomes[x * CHUNK + z] as Biome;
        const col = idx(x, 0, z);
        const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
        for (let y = 0; y < HEIGHT; y++) {
          let id = AIR;
          if (y === 0 || (y < 5 && hashInt(bx + x, y, bz + z) % 5 < 5 - y)) id = BEDROCK;
          else if (y < H - 4) {
            id = STONE;
            if (y > 6) {
              const sv = tri(nStone, gx, y >> 2, gz, fx, (y & 3) / 4, fz);
              if (sv > 0.62) id = ANDESITE;
              else if (sv < -0.66) id = GRANITE;
              else if (sv > 0.4 && sv < 0.46) id = DIORITE;
            }
          } else if (y < H - 1) {
            id = biome === Biome.Desert ? SANDSTONE : biome === Biome.Beach || biome === Biome.Ocean ? SAND : biome === Biome.SnowyPeaks ? STONE : DIRT;
            if (biome === Biome.Beach && y < H - 3) id = SANDSTONE;
            if (biome === Biome.Ocean && y < H - 2) id = STONE;
            if (biome === Biome.River && y < H - 2) id = STONE;
          } else if (y === H - 1) {
            switch (biome) {
              case Biome.Desert: id = SAND; break;
              case Biome.Beach: id = SAND; break;
              case Biome.Ocean: id = hashInt(bx + x, 77, bz + z) % 7 === 0 ? CLAY : H < SEA_LEVEL - 12 ? GRAVEL : SAND; break;
              case Biome.River: id = hashInt(bx + x, 78, bz + z) % 3 === 0 ? GRAVEL : SAND; break;
              case Biome.Taiga: id = SNOWY_GRASS; break;
              case Biome.SnowyPeaks: id = SNOW_BLOCK; break;
              case Biome.Mountains: id = H > 84 ? STONE : GRASS; break;
              default: id = GRASS;
            }
          } else if (y < SEA_LEVEL) id = WATER;
          blocks[col + y] = id;
        }
        if (biome === Biome.SnowyPeaks) blocks[col + H - 2] = SNOW_BLOCK;
      }

    // --- ores & blobs ---
    const vein = (id: number, count: number, minY: number, maxY: number, size: number, hostOnly = true) => {
      for (let k = 0; k < count; k++) {
        let x = Math.floor(rng() * CHUNK), z = Math.floor(rng() * CHUNK);
        let y = minY + Math.floor(rng() * (maxY - minY));
        const n = size + Math.floor(rng() * size * 0.6);
        for (let i = 0; i < n; i++) {
          if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK && y > 0 && y < HEIGHT) {
            const bi = idx(x, y, z);
            const cur = blocks[bi];
            if (!hostOnly || cur === STONE || cur === ANDESITE || cur === GRANITE || cur === DIORITE) blocks[bi] = id;
          }
          const d = Math.floor(rng() * 6);
          x += [1, -1, 0, 0, 0, 0][d]; y += [0, 0, 1, -1, 0, 0][d]; z += [0, 0, 0, 0, 1, -1][d];
        }
      }
    };
    vein(DIRT, 3, 10, 90, 18);
    vein(GRAVEL, 2, 10, 90, 18);
    vein(COAL_ORE, 14, 4, 110, 9);
    vein(IRON_ORE, 10, 2, 58, 5);
    vein(GOLD_ORE, 3, 2, 28, 5);
    vein(REDSTONE_ORE, 6, 2, 15, 6);
    vein(DIAMOND_ORE, 2, 2, 14, 4);

    // --- caves ---
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        const H = heights[x * CHUNK + z];
        const col = idx(x, 0, z);
        const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
        const nearWater = H <= SEA_LEVEL + 2;
        const yTop = nearWater ? Math.min(H - 3, SEA_LEVEL - 4) : H + 1;
        for (let y = 4; y <= yTop && y < HEIGHT; y++) {
          const cur = blocks[col + y];
          if (cur === AIR || cur === WATER || cur === BEDROCK) continue;
          const gy = y >> 2, fy = (y & 3) / 4;
          const a = tri(nCheese, gx, gy, gz, fx, fy, fz);
          const s1 = tri(nS1, gx, gy, gz, fx, fy, fz);
          const s2 = tri(nS2, gx, gy, gz, fx, fy, fz);
          const m = tri(nMod, gx, gy, gz, fx, fy, fz);
          if (this.isCave(a, s1, s2, m, y, H)) blocks[col + y] = y <= 10 ? LAVA : AIR;
        }
        // ravines
        const rm = this.fbm(this.ravineMask, (bx + x) * 0.0013, (bz + z) * 0.0013, 2);
        if (rm > 0.3 && H > SEA_LEVEL + 3) {
          const rv = this.fbm(this.ravine, (bx + x) * 0.004, (bz + z) * 0.004, 3);
          const width = 0.03 * (rm - 0.3) * 6;
          if (Math.abs(rv) < width) {
            const floor = 18 + Math.floor(Math.abs(rv) / width * 14);
            for (let y = floor; y <= H; y++) {
              const wy = width * (0.35 + 0.65 * smoothstep(floor, H - 8, y));
              if (Math.abs(rv) < wy && blocks[col + y] !== BEDROCK && blocks[col + y] !== WATER) blocks[col + y] = y <= 10 ? LAVA : AIR;
            }
          }
        }
      }

    // --- surface features ---
    this.decorate(chunk, heights, biomes, rng);
    chunk.recomputeAllHeights();
    chunk.generated = true;
  }

  private treesFor(cx: number, cz: number): { x: number; z: number; y: number; kind: number; h: number }[] {
    const rng = mulberry32(hashInt(cx, cz, this.seed ^ 0x5bd1e995));
    const out: { x: number; z: number; y: number; kind: number; h: number }[] = [];
    const bx = cx * CHUNK, bz = cz * CHUNK;
    // biome sampled at chunk centre decides tree density
    const centre = this.column(bx + 8, bz + 8);
    let count = 0, kinds: number[] = [0];
    switch (centre.biome) {
      case Biome.Forest: count = 5 + Math.floor(rng() * 4); kinds = [0, 0, 0, 1]; break;
      case Biome.BirchForest: count = 5 + Math.floor(rng() * 3); kinds = [1, 1, 1, 0]; break;
      case Biome.Plains: count = rng() < 0.35 ? 1 : 0; kinds = [0]; break;
      case Biome.Taiga: count = 4 + Math.floor(rng() * 4); kinds = [2]; break;
      case Biome.Mountains: count = rng() < 0.5 ? 1 : 0; kinds = [2, 0]; break;
      case Biome.Desert: count = 2 + Math.floor(rng() * 3); kinds = [3]; break; // cactus
      default: count = 0;
    }
    for (let i = 0; i < count; i++) {
      const x = 2 + Math.floor(rng() * 12), z = 2 + Math.floor(rng() * 12);
      const kind = kinds[Math.floor(rng() * kinds.length)];
      const h = kind === 3 ? 1 + Math.floor(rng() * 3) : kind === 2 ? 7 + Math.floor(rng() * 4) : kind === 1 ? 5 + Math.floor(rng() * 3) : 4 + Math.floor(rng() * 3);
      const info = this.column(bx + x, bz + z);
      const y = Math.floor(info.height);
      if (info.biome === Biome.Ocean || info.biome === Biome.Beach || info.biome === Biome.River || info.biome === Biome.SnowyPeaks) continue;
      if (kind === 3 && info.biome !== Biome.Desert) continue;
      if (kind !== 3 && info.biome === Biome.Desert) continue;
      if (this.caveAtPoint(bx + x, y - 1, bz + z, y)) continue;
      out.push({ x: bx + x, z: bz + z, y, kind, h });
    }
    return out;
  }

  private decorate(chunk: Chunk, heights: Int32Array, biomes: Uint8Array, rng: () => number) {
    const bx = chunk.cx * CHUNK, bz = chunk.cz * CHUNK;
    const blocks = chunk.blocks;
    const inChunk = (x: number, z: number) => x >= bx && x < bx + CHUNK && z >= bz && z < bz + CHUNK;
    const put = (x: number, y: number, z: number, id: number, replaceOnly = true) => {
      if (!inChunk(x, z) || y < 0 || y >= HEIGHT) return;
      const i = idx(x - bx, y, z - bz);
      if (replaceOnly && blocks[i] !== AIR) return;
      blocks[i] = id;
    };
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) {
        for (const t of this.treesFor(chunk.cx + ox, chunk.cz + oz)) {
          const { x, z, y, kind, h } = t;
          if (kind === 3) {
            for (let i = 0; i < h; i++) put(x, y + i, z, CACTUS);
            continue;
          }
          const log = kind === 2 ? SPRUCE_LOG : kind === 1 ? BIRCH_LOG : OAK_LOG;
          const leaf = kind === 2 ? SPRUCE_LEAVES : kind === 1 ? BIRCH_LEAVES : OAK_LEAVES;
          const top = y + h - 1;
          if (kind === 2) {
            // spruce: conical
            const pattern = [0, 1, 1, 2, 1, 2, 2, 3, 2, 3];
            put(x, top + 1, z, leaf);
            for (let k = 0; k < h - 2; k++) {
              const r = pattern[Math.min(k, pattern.length - 1)];
              const yy = top - k;
              for (let dx = -r; dx <= r; dx++)
                for (let dz = -r; dz <= r; dz++) {
                  if (dx === 0 && dz === 0) continue;
                  if (r >= 2 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
                  put(x + dx, yy, z + dz, leaf);
                }
            }
          } else {
            for (let dy = -3; dy <= 0; dy++) {
              const yy = top + dy;
              const r = dy <= -2 ? 2 : 1;
              for (let dx = -r; dx <= r; dx++)
                for (let dz = -r; dz <= r; dz++) {
                  if (dx === 0 && dz === 0 && dy < 0) continue;
                  if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 1 ? dy === 0 : hashInt(x + dx, yy, z + dz) % 2 === 0)) continue;
                  put(x + dx, yy, z + dz, leaf);
                }
            }
            put(x, top + 1, z, leaf);
          }
          for (let i = 0; i < h; i++) put(x, y + i, z, log, false);
          // ensure dirt under the trunk
          if (inChunk(x, z)) {
            const i = idx(x - bx, y - 1, z - bz);
            if (blocks[i] === GRASS || blocks[i] === SNOWY_GRASS) blocks[i] = DIRT;
          }
        }
      }
    // grass, flowers, bushes
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        const H = heights[x * CHUNK + z];
        const biome = biomes[x * CHUNK + z] as Biome;
        const ground = blocks[idx(x, H - 1, z)];
        if (blocks[idx(x, H, z)] !== AIR) continue;
        const r = rng();
        if (ground === GRASS) {
          const dens = biome === Biome.Forest || biome === Biome.BirchForest ? 0.28 : biome === Biome.Plains ? 0.2 : 0.06;
          if (r < dens) blocks[idx(x, H, z)] = SHORT_GRASS;
          else if (r < dens + 0.02) blocks[idx(x, H, z)] = rng() < 0.5 ? DANDELION : POPPY;
          else if (r < dens + 0.025 && biome === Biome.Forest) blocks[idx(x, H, z)] = BLUE_ORCHID;
        } else if (ground === SAND && biome === Biome.Desert) {
          if (r < 0.025) blocks[idx(x, H, z)] = DEAD_BUSH;
        }
      }
  }
}
