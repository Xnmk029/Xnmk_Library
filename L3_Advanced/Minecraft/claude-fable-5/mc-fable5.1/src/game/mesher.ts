import * as THREE from "three";
import { AIR, BLOCKS, CHUNK, HEIGHT, LAVA, WATER, faceTexture, type BlockDef } from "./blocks";
import { tileLayer } from "./textures";
import { Chunk, World, idx } from "./world";

const FACE_SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];
const AO_CURVE = [0.5, 0.68, 0.84, 1.0];
const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// CCW corner order viewed from outside; each corner: [x,y,z] in {0,1}
const CORNERS: [number, number, number][][] = [
  [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
];
// tangent axes per face (indices into xyz)
const TANGENTS: [number, number][] = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]];

function faceUV(face: number, c: [number, number, number]): [number, number] {
  switch (face) {
    case 0: return [1 - c[2], c[1]];
    case 1: return [c[2], c[1]];
    case 2: return [c[0], 1 - c[2]];
    case 3: return [c[0], c[2]];
    case 4: return [c[0], c[1]];
    default: return [1 - c[0], c[1]];
  }
}

class GeoBuilder {
  data: number[] = [];
  indices: number[] = [];
  count = 0;
  vertex(x: number, y: number, z: number, u: number, v: number, layer: number, sky: number, block: number, shade: number) {
    this.data.push(x, y, z, u, v, layer, sky, block, shade);
    return this.count++;
  }
  quad(a: number, b: number, c: number, d: number, flip = false) {
    if (flip) this.indices.push(b, c, d, b, d, a);
    else this.indices.push(a, b, c, a, c, d);
  }
  build(): THREE.BufferGeometry | null {
    if (this.count === 0) return null;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(this.data);
    const buf = new THREE.InterleavedBuffer(arr, 9);
    g.setAttribute("position", new THREE.InterleavedBufferAttribute(buf, 3, 0));
    g.setAttribute("uv", new THREE.InterleavedBufferAttribute(buf, 2, 3));
    g.setAttribute("aLayer", new THREE.InterleavedBufferAttribute(buf, 1, 5));
    g.setAttribute("aLight", new THREE.InterleavedBufferAttribute(buf, 3, 6));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.indices, 1) : new THREE.Uint16BufferAttribute(this.indices, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

export interface ChunkGeometry {
  solid: THREE.BufferGeometry | null;
  liquid: THREE.BufferGeometry | null;
}

/** Access the 3x3 neighbourhood around a chunk fast. */
class Sampler {
  chunks: (Chunk | undefined)[] = [];
  constructor(world: World, cx: number, cz: number) {
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) this.chunks[(ox + 1) * 3 + (oz + 1)] = world.getChunk(cx + ox, cz + oz);
  }
  block(x: number, y: number, z: number): number {
    if (y < 0) return 6;
    if (y >= HEIGHT) return AIR;
    const c = this.chunks[((x + 16) >> 4) * 3 + ((z + 16) >> 4)];
    if (!c) return AIR;
    return c.blocks[idx(x & 15, y, z & 15)];
  }
  meta(x: number, y: number, z: number): number {
    if (y < 0 || y >= HEIGHT) return 0;
    const c = this.chunks[((x + 16) >> 4) * 3 + ((z + 16) >> 4)];
    if (!c) return 0;
    return c.meta[idx(x & 15, y, z & 15)];
  }
  light(x: number, y: number, z: number): number {
    if (y >= HEIGHT) return 0xf0;
    if (y < 0) return 0;
    const c = this.chunks[((x + 16) >> 4) * 3 + ((z + 16) >> 4)];
    if (!c) return 0xf0;
    return c.light[idx(x & 15, y, z & 15)];
  }
}

const layerCache = new Map<string, number>();
function layerOf(name: string) {
  let l = layerCache.get(name);
  if (l === undefined) {
    l = tileLayer(name);
    layerCache.set(name, l);
  }
  return l;
}

export function buildChunkGeometry(world: World, chunk: Chunk): ChunkGeometry {
  const s = new Sampler(world, chunk.cx, chunk.cz);
  const solid = new GeoBuilder();
  const liquid = new GeoBuilder();
  const blocks = chunk.blocks;

  const cornerLight = (face: number, x: number, y: number, z: number, c: [number, number, number], out: number[]) => {
    const d = DIRS[face];
    const bx = x + d[0], by = y + d[1], bz = z + d[2];
    const [ta, tb] = TANGENTS[face];
    const o1 = [0, 0, 0], o2 = [0, 0, 0];
    o1[ta] = c[ta] === 1 ? 1 : -1;
    o2[tb] = c[tb] === 1 ? 1 : -1;
    const s1 = s.block(bx + o1[0], by + o1[1], bz + o1[2]);
    const s2 = s.block(bx + o2[0], by + o2[1], bz + o2[2]);
    const cc = s.block(bx + o1[0] + o2[0], by + o1[1] + o2[1], bz + o1[2] + o2[2]);
    const op1 = BLOCKS[s1].opaque ? 1 : 0, op2 = BLOCKS[s2].opaque ? 1 : 0, opc = BLOCKS[cc].opaque ? 1 : 0;
    const ao = op1 && op2 ? 0 : 3 - (op1 + op2 + opc);
    let sky = 0, bl = 0, n = 0;
    const l0 = s.light(bx, by, bz);
    sky += l0 >> 4; bl += l0 & 15; n++;
    if (!op1) { const l = s.light(bx + o1[0], by + o1[1], bz + o1[2]); sky += l >> 4; bl += l & 15; n++; }
    if (!op2) { const l = s.light(bx + o2[0], by + o2[1], bz + o2[2]); sky += l >> 4; bl += l & 15; n++; }
    if (!opc && !(op1 && op2)) { const l = s.light(bx + o1[0] + o2[0], by + o1[1] + o2[1], bz + o1[2] + o2[2]); sky += l >> 4; bl += l & 15; n++; }
    out[0] = sky / n / 15;
    out[1] = bl / n / 15;
    out[2] = ao;
  };

  const tmp = [0, 0, 0];
  const emitCubeFace = (x: number, y: number, z: number, face: number, layer: number) => {
    const corners = CORNERS[face];
    const shade = FACE_SHADE[face];
    const ids: number[] = [];
    const aos: number[] = [];
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      cornerLight(face, x, y, z, c, tmp);
      const [u, v] = faceUV(face, c);
      aos.push(tmp[2]);
      ids.push(solid.vertex(x + c[0], y + c[1], z + c[2], u, v, layer, tmp[0], tmp[1], shade * AO_CURVE[tmp[2]]));
    }
    const flip = aos[0] + aos[2] < aos[1] + aos[3];
    solid.quad(ids[0], ids[1], ids[2], ids[3], flip);
  };

  const emitCross = (x: number, y: number, z: number, layer: number, packed: number) => {
    const sky = (packed >> 4) / 15, bl = (packed & 15) / 15;
    const a = 0.146, b = 0.854;
    const quads: number[][][] = [
      [[a, 0, a], [b, 0, b], [b, 1, b], [a, 1, a]],
      [[a, 0, b], [b, 0, a], [b, 1, a], [a, 1, b]],
    ];
    for (const q of quads) {
      const ids = q.map((p, i) => solid.vertex(x + p[0], y + p[1], z + p[2], i === 0 || i === 3 ? 0 : 1, p[1], layer, sky, bl, 0.9));
      solid.quad(ids[0], ids[1], ids[2], ids[3]);
      solid.quad(ids[3], ids[2], ids[1], ids[0]);
    }
  };

  const emitTorch = (x: number, y: number, z: number, meta: number, layer: number, packed: number) => {
    const sky = (packed >> 4) / 15, bl = (packed & 15) / 15;
    const w = 1 / 16, h = 10 / 16;
    // wall torch: meta = face+1 of the wall block (1:+X 2:-X 5:+Z 6:-Z)
    let ax = 0, az = 0, baseY = 0;
    if (meta === 1) ax = -1; else if (meta === 2) ax = 1; else if (meta === 5) az = -1; else if (meta === 6) az = 1;
    const wall = meta !== 0;
    const cx = 0.5 - ax * 0.32, cz = 0.5 - az * 0.32;
    if (wall) baseY = 0.2;
    const ang = wall ? 0.4 : 0;
    const sinA = Math.sin(ang), cosA = Math.cos(ang);
    const P = (lx: number, ly: number, lz: number): [number, number, number] => [
      x + cx + lx + ax * ly * sinA,
      y + baseY + ly * cosA,
      z + cz + lz + az * ly * sinA,
    ];
    // side faces (u in [7/16, 9/16], v in [0, 10/16]) and top (v in [8/16,10/16])
    const u0 = 7 / 16, u1 = 9 / 16, v1 = h;
    const sides: { pts: [number, number, number][]; shade: number }[] = [
      { pts: [P(w, 0, -w), P(w, h, -w), P(w, h, w), P(w, 0, w)], shade: 0.6 },
      { pts: [P(-w, 0, -w), P(-w, 0, w), P(-w, h, w), P(-w, h, -w)], shade: 0.6 },
      { pts: [P(-w, 0, w), P(w, 0, w), P(w, h, w), P(-w, h, w)], shade: 0.8 },
      { pts: [P(-w, 0, -w), P(-w, h, -w), P(w, h, -w), P(w, 0, -w)], shade: 0.8 },
    ];
    const uvs: [number, number][][] = [
      [[u0, 0], [u0, v1], [u1, v1], [u1, 0]],
      [[u0, 0], [u1, 0], [u1, v1], [u0, v1]],
      [[u0, 0], [u1, 0], [u1, v1], [u0, v1]],
      [[u0, 0], [u0, v1], [u1, v1], [u1, 0]],
    ];
    sides.forEach((sd, k) => {
      const ids = sd.pts.map((p, i) => solid.vertex(p[0], p[1], p[2], uvs[k][i][0], uvs[k][i][1], layer, sky, bl, sd.shade));
      solid.quad(ids[0], ids[1], ids[2], ids[3]);
      solid.quad(ids[3], ids[2], ids[1], ids[0]);
    });
    const top = [P(-w, h, -w), P(-w, h, w), P(w, h, w), P(w, h, -w)];
    const tuv: [number, number][] = [[u0, 0.5], [u0, 0.625], [u1, 0.625], [u1, 0.5]];
    const ids = top.map((p, i) => solid.vertex(p[0], p[1], p[2], tuv[i][0], tuv[i][1], layer, sky, bl, 1));
    solid.quad(ids[0], ids[1], ids[2], ids[3]);
  };

  // ---- liquids ----
  const liquidLevel = (id: number, x: number, y: number, z: number): number => {
    // returns 0..7 (0 = source) or -1 if not this liquid; falling => 0
    if (s.block(x, y, z) !== id) return -1;
    const m = s.meta(x, y, z);
    return m & 8 ? 0 : m & 7;
  };
  const levelHeight = (lvl: number) => 1 - (lvl + 1) / 9;
  const cornerHeight = (id: number, x: number, y: number, z: number, cx: number, cz: number): number => {
    // corner between cells (x,z),(x+cx-?,..): cx,cz in {0,1}; consider 4 cells sharing the corner
    let sum = 0, n = 0;
    for (let ox = -1; ox <= 0; ox++)
      for (let oz = -1; oz <= 0; oz++) {
        const nx = x + cx + ox, nz = z + cz + oz;
        if (s.block(nx, y + 1, nz) === id) return 1;
        const lvl = liquidLevel(id, nx, y, nz);
        if (lvl >= 0) {
          const hgt = levelHeight(lvl);
          if (lvl === 0) { sum += hgt * 10; n += 10; } else { sum += hgt; n += 1; }
        } else if (BLOCKS[s.block(nx, y, nz)].opaque) {
          // walls don't pull water down
        }
      }
    return n > 0 ? sum / n : levelHeight(0);
  };

  for (let x = 0; x < CHUNK; x++)
    for (let z = 0; z < CHUNK; z++) {
      const top = chunk.height[x * CHUNK + z];
      for (let y = 0; y < top; y++) {
        const id = blocks[idx(x, y, z)];
        if (id === AIR) continue;
        const def: BlockDef = BLOCKS[id];
        if (def.render === "none") continue;
        const meta = chunk.meta[idx(x, y, z)];
        if (def.render === "cross") {
          emitCross(x, y, z, layerOf(def.tex.side), s.light(x, y, z));
          continue;
        }
        if (def.render === "torch") {
          emitTorch(x, y, z, meta, layerOf(def.tex.side), s.light(x, y, z));
          continue;
        }
        if (def.render === "liquid") {
          const above = s.block(x, y + 1, z);
          const packed = s.light(x, y, z);
          const packedUp = s.light(x, y + 1, z);
          const sky = Math.max(packed >> 4, packedUp >> 4) / 15, bl = Math.max(packed & 15, packedUp & 15) / 15;
          const layer = layerOf(def.tex.side);
          const h00 = above === id ? 1 : cornerHeight(id, x, y, z, 0, 0);
          const h10 = above === id ? 1 : cornerHeight(id, x, y, z, 1, 0);
          const h01 = above === id ? 1 : cornerHeight(id, x, y, z, 0, 1);
          const h11 = above === id ? 1 : cornerHeight(id, x, y, z, 1, 1);
          const isLava = id === LAVA;
          const shadeTop = 1.0;
          if (above !== id && !BLOCKS[above].opaque) {
            const a = liquid.vertex(x, y + h00, z, 0, 1, layer, sky, bl, shadeTop);
            const b = liquid.vertex(x, y + h01, z + 1, 0, 0, layer, sky, bl, shadeTop);
            const c = liquid.vertex(x + 1, y + h11, z + 1, 1, 0, layer, sky, bl, shadeTop);
            const d = liquid.vertex(x + 1, y + h10, z, 1, 1, layer, sky, bl, shadeTop);
            liquid.quad(a, b, c, d);
            liquid.quad(d, c, b, a); // visible from below (swimming)
          }
          // sides
          const sideDefs: { face: number; pts: [number, number, number, number][] }[] = [
            { face: 0, pts: [[1, 0, 0, 0], [1, h10, 0, h10], [1, h11, 1, h11], [1, 0, 1, 0]] },
            { face: 1, pts: [[0, 0, 0, 0], [0, 0, 1, 0], [0, h01, 1, h01], [0, h00, 0, h00]] },
            { face: 4, pts: [[0, 0, 1, 0], [1, 0, 1, 0], [1, h11, 1, h11], [0, h01, 1, h01]] },
            { face: 5, pts: [[0, 0, 0, 0], [0, h00, 0, h00], [1, h10, 0, h10], [1, 0, 0, 0]] },
          ];
          for (const sd of sideDefs) {
            const d = DIRS[sd.face];
            const nb = s.block(x + d[0], y + d[1], z + d[2]);
            if (nb === id || BLOCKS[nb].opaque) continue;
            const shade = FACE_SHADE[sd.face];
            const nl = s.light(x + d[0], y, z + d[2]);
            const ssky = Math.max(nl >> 4, packed >> 4) / 15, sbl = Math.max(nl & 15, packed & 15) / 15;
            const ids = sd.pts.map((p) => {
              const [u] = faceUV(sd.face, [p[0], p[1], p[2]]);
              return liquid.vertex(x + p[0], y + p[1], z + p[2], u, p[3], layer, ssky, sbl, shade);
            });
            liquid.quad(ids[0], ids[1], ids[2], ids[3]);
            liquid.quad(ids[3], ids[2], ids[1], ids[0]);
          }
          const below = s.block(x, y - 1, z);
          if (below !== id && !BLOCKS[below].opaque) {
            const nl = s.light(x, y - 1, z);
            const bsky = (nl >> 4) / 15, bbl = (nl & 15) / 15;
            const c = CORNERS[3];
            const ids = c.map((p) => liquid.vertex(x + p[0], y, z + p[2], p[0], p[2], layer, bsky, bbl, 0.5));
            liquid.quad(ids[0], ids[1], ids[2], ids[3]);
            liquid.quad(ids[3], ids[2], ids[1], ids[0]);
          }
          void isLava;
          continue;
        }
        // cube
        for (let face = 0; face < 6; face++) {
          const d = DIRS[face];
          const nx = x + d[0], ny = y + d[1], nz = z + d[2];
          const nb = s.block(nx, ny, nz);
          const ndef = BLOCKS[nb];
          if (ndef.opaque) continue;
          if (nb === id && def.cullSame) continue;
          if (!def.opaque && nb === id && def.render === "cube" && def.solid && id === 32) continue; // cactus stack
          emitCubeFace(x, y, z, face, layerOf(faceTexture(def, face, meta)));
        }
      }
    }
  return { solid: solid.build(), liquid: liquid.build() };
}

export { WATER };
