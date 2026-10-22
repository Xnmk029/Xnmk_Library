import * as THREE from "three";
import { AIR, BLOCKS, CHUNK, HEIGHT, blockDef } from "./blocks";

export const idx = (x: number, y: number, z: number) => (x << 11) | (z << 7) | y;
const VOL = CHUNK * CHUNK * HEIGHT;

export class Chunk {
  blocks = new Uint8Array(VOL);
  light = new Uint8Array(VOL); // sky << 4 | block
  meta = new Uint8Array(VOL);
  height = new Uint8Array(CHUNK * CHUNK); // y of highest non-air + 1 per column
  generated = false;
  decorated = false;
  lit = false;
  dirty = true;
  mesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  constructor(public cx: number, public cz: number) {}

  get(x: number, y: number, z: number) {
    return this.blocks[idx(x, y, z)];
  }
  set(x: number, y: number, z: number, id: number) {
    this.blocks[idx(x, y, z)] = id;
  }
  recomputeHeight(x: number, z: number) {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (this.blocks[idx(x, y, z)] !== AIR) {
        this.height[x * CHUNK + z] = y + 1;
        return;
      }
    }
    this.height[x * CHUNK + z] = 0;
  }
  recomputeAllHeights() {
    for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) this.recomputeHeight(x, z);
  }
}

export const chunkKey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);

export type BlockChangeListener = (x: number, y: number, z: number, oldId: number, newId: number) => void;

export class World {
  chunks = new Map<number, Chunk>();
  private skyQ: number[] = [];
  private blockQ: number[] = [];
  private skyRQ: number[] = [];
  private blockRQ: number[] = [];
  listeners: BlockChangeListener[] = [];

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }
  getOrCreateChunk(cx: number, cz: number): Chunk {
    const k = chunkKey(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(cx, cz);
      this.chunks.set(k, c);
    }
    return c;
  }
  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return 6;
    if (y >= HEIGHT) return AIR;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return AIR;
    return c.blocks[idx(x & 15, y, z & 15)];
  }
  getMeta(x: number, y: number, z: number): number {
    if (y < 0 || y >= HEIGHT) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return 0;
    return c.meta[idx(x & 15, y, z & 15)];
  }
  setMeta(x: number, y: number, z: number, m: number) {
    if (y < 0 || y >= HEIGHT) return;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return;
    c.meta[idx(x & 15, y, z & 15)] = m;
    this.markDirty(x, y, z);
  }
  hasChunkAt(x: number, z: number) {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    return !!c && c.generated;
  }
  getLightPacked(x: number, y: number, z: number): number {
    if (y >= HEIGHT) return 0xf0;
    if (y < 0) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return 0;
    return c.light[idx(x & 15, y, z & 15)];
  }
  getSky(x: number, y: number, z: number) {
    return this.getLightPacked(x, y, z) >> 4;
  }
  getBlockLight(x: number, y: number, z: number) {
    return this.getLightPacked(x, y, z) & 15;
  }
  // brightness 0..15 combining both channels with a day factor
  getBrightness(x: number, y: number, z: number, day: number) {
    const p = this.getLightPacked(x, y, z);
    return Math.max((p >> 4) * day, p & 15);
  }

  markDirty(x: number, y: number, z: number) {
    const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    const c = this.getChunk(cx, cz);
    if (c) c.dirty = true;
    if (lx === 0) this.mark(cx - 1, cz);
    if (lx === 15) this.mark(cx + 1, cz);
    if (lz === 0) this.mark(cx, cz - 1);
    if (lz === 15) this.mark(cx, cz + 1);
    if (lx === 0 && lz === 0) this.mark(cx - 1, cz - 1);
    if (lx === 0 && lz === 15) this.mark(cx - 1, cz + 1);
    if (lx === 15 && lz === 0) this.mark(cx + 1, cz - 1);
    if (lx === 15 && lz === 15) this.mark(cx + 1, cz + 1);
    void y;
  }
  private mark(cx: number, cz: number) {
    const c = this.getChunk(cx, cz);
    if (c) c.dirty = true;
  }

  /** Set a block with full lighting update. */
  setBlock(x: number, y: number, z: number, id: number, meta = 0, notify = true) {
    if (y < 0 || y >= HEIGHT) return;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return;
    const i = idx(x & 15, y, z & 15);
    const old = c.blocks[i];
    if (old === id && c.meta[i] === meta) return;
    const oldDef = blockDef(old), newDef = blockDef(id);
    c.blocks[i] = id;
    c.meta[i] = meta;
    // heights
    const hx = x & 15, hz = z & 15;
    if (id !== AIR && y + 1 > c.height[hx * CHUNK + hz]) c.height[hx * CHUNK + hz] = y + 1;
    else if (id === AIR && y + 1 === c.height[hx * CHUNK + hz]) c.recomputeHeight(hx, hz);

    // ---- lighting ----
    if (oldDef.light > 0) this.removeLightAt(1, x, y, z);
    const transparencyChanged = oldDef.opaque !== newDef.opaque || (oldDef.lightFilter ?? 0) !== (newDef.lightFilter ?? 0);
    if (transparencyChanged) {
      if (newDef.opaque || (newDef.lightFilter ?? 0) > (oldDef.lightFilter ?? 0)) {
        // darker: remove and let it refill
        this.removeLightAt(0, x, y, z);
        this.removeLightAt(1, x, y, z);
      } else {
        // more transparent: pull light from neighbours
        this.enqueueNeighbours(x, y, z);
      }
    }
    if (newDef.light > 0) {
      const cur = c.light[i] & 15;
      if (cur < newDef.light) {
        c.light[i] = (c.light[i] & 0xf0) | newDef.light;
        this.blockQ.push(x, y, z);
      }
    }
    this.propagateAll();
    this.markDirty(x, y, z);
    if (notify) for (const l of this.listeners) l(x, y, z, old, id);
  }

  enqueueNeighbours(x: number, y: number, z: number) {
    const n = [x + 1, y, z, x - 1, y, z, x, y + 1, z, x, y - 1, z, x, y, z + 1, x, y, z - 1];
    for (let k = 0; k < 18; k += 3) {
      this.skyQ.push(n[k], n[k + 1], n[k + 2]);
      this.blockQ.push(n[k], n[k + 1], n[k + 2]);
    }
  }

  private removeLightAt(channel: 0 | 1, x: number, y: number, z: number) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return;
    const i = idx(x & 15, y, z & 15);
    const old = channel === 0 ? c.light[i] >> 4 : c.light[i] & 15;
    if (old === 0) return;
    c.light[i] = channel === 0 ? c.light[i] & 0x0f : c.light[i] & 0xf0;
    (channel === 0 ? this.skyRQ : this.blockRQ).push(x, y, z, old);
  }

  pushSky(x: number, y: number, z: number) {
    this.skyQ.push(x, y, z);
  }
  pushBlockLight(x: number, y: number, z: number) {
    this.blockQ.push(x, y, z);
  }

  propagateAll() {
    this.processRemoval(0);
    this.processRemoval(1);
    this.propagate(0);
    this.propagate(1);
  }

  private processRemoval(channel: 0 | 1) {
    const q = channel === 0 ? this.skyRQ : this.blockRQ;
    const pq = channel === 0 ? this.skyQ : this.blockQ;
    let i = 0;
    let cc: Chunk | undefined;
    let ccx = 1e9, ccz = 1e9;
    while (i < q.length) {
      const x = q[i++], y = q[i++], z = q[i++], old = q[i++];
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < 0 || ny >= HEIGHT) continue;
        const cx = nx >> 4, cz = nz >> 4;
        if (cx !== ccx || cz !== ccz) {
          cc = this.getChunk(cx, cz);
          ccx = cx;
          ccz = cz;
        }
        if (!cc) continue;
        const ni = idx(nx & 15, ny, nz & 15);
        const packed = cc.light[ni];
        const nl = channel === 0 ? packed >> 4 : packed & 15;
        if (nl === 0) continue;
        if (nl < old || (channel === 0 && d === 3 && old === 15 && nl === 15)) {
          cc.light[ni] = channel === 0 ? packed & 0x0f : packed & 0xf0;
          cc.dirty = true;
          q.push(nx, ny, nz, nl);
        } else if (nl >= old) {
          pq.push(nx, ny, nz);
        }
      }
      this.markDirty(x, y, z);
    }
    q.length = 0;
  }

  private propagate(channel: 0 | 1) {
    const q = channel === 0 ? this.skyQ : this.blockQ;
    let i = 0;
    let cc: Chunk | undefined;
    let ccx = 1e9, ccz = 1e9;
    while (i < q.length) {
      const x = q[i++], y = q[i++], z = q[i++];
      if (y < 0 || y >= HEIGHT) continue;
      const scx = x >> 4, scz = z >> 4;
      if (scx !== ccx || scz !== ccz) {
        cc = this.getChunk(scx, scz);
        ccx = scx;
        ccz = scz;
      }
      if (!cc) continue;
      const packed = cc.light[idx(x & 15, y, z & 15)];
      const l = channel === 0 ? packed >> 4 : packed & 15;
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < 0 || ny >= HEIGHT) continue;
        const cx = nx >> 4, cz = nz >> 4;
        if (cx !== ccx || cz !== ccz) {
          cc = this.getChunk(cx, cz);
          ccx = cx;
          ccz = cz;
        }
        if (!cc) continue;
        const ni = idx(nx & 15, ny, nz & 15);
        const def = BLOCKS[cc.blocks[ni]];
        if (def.opaque) continue;
        const filter = def.lightFilter ?? 0;
        let nl: number;
        if (channel === 0 && d === 3 && l === 15 && filter === 0) nl = 15;
        else nl = l - Math.max(1, filter);
        if (nl <= 0) continue;
        const np = cc.light[ni];
        const cur = channel === 0 ? np >> 4 : np & 15;
        if (cur < nl) {
          cc.light[ni] = channel === 0 ? (np & 0x0f) | (nl << 4) : (np & 0xf0) | nl;
          cc.dirty = true;
          const lx = nx & 15, lz = nz & 15;
          if (lx === 0 || lx === 15 || lz === 0 || lz === 15) this.markDirty(nx, ny, nz);
          q.push(nx, ny, nz);
        }
      }
    }
    q.length = 0;
  }

  /** Initial lighting for a freshly generated chunk. */
  lightChunk(c: Chunk) {
    const bx = c.cx * CHUNK, bz = c.cz * CHUNK;
    // 1) sky columns
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        let l = 15;
        for (let y = HEIGHT - 1; y >= 0; y--) {
          const i = idx(x, y, z);
          const def = BLOCKS[c.blocks[i]];
          if (def.opaque) {
            l = 0;
          } else if (def.lightFilter) {
            l = Math.max(0, l - def.lightFilter);
          }
          c.light[i] = (l << 4) | (def.light > 0 ? def.light : 0);
          if (def.light > 0) this.blockQ.push(bx + x, y, bz + z);
          if (l === 0 && def.opaque) {
            // rest of column is dark (except emitters) – fill quickly
            for (let yy = y - 1; yy >= 0; yy--) {
              const ii = idx(x, yy, z);
              const dd = BLOCKS[c.blocks[ii]];
              c.light[ii] = dd.light > 0 ? dd.light : 0;
              if (dd.light > 0) this.blockQ.push(bx + x, yy, bz + z);
            }
            break;
          }
        }
      }
    // 2) enqueue sky-lit blocks that border darker transparent blocks
    let maxTop = 0;
    for (let i = 0; i < c.height.length; i++) if (c.height[i] > maxTop) maxTop = c.height[i];
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        for (let y = 0; y <= Math.min(HEIGHT - 1, maxTop + 1); y++) {
          const i = idx(x, y, z);
          const l = c.light[i] >> 4;
          if (l < 2) continue;
          let edge = false;
          for (let d = 0; d < 6 && !edge; d++) {
            const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
            if (ny < 0 || ny >= HEIGHT) continue;
            if (nx < 0 || nx > 15 || nz < 0 || nz > 15) {
              edge = true; // border: neighbour chunk may need it
              continue;
            }
            const ni = idx(nx, ny, nz);
            const def = BLOCKS[c.blocks[ni]];
            if (!def.opaque && (c.light[ni] >> 4) < l - 1) edge = true;
          }
          if (edge) this.skyQ.push(bx + x, y, bz + z);
        }
      }
    // 3) neighbours' border light flows into us
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = this.getChunk(c.cx + ox, c.cz + oz);
      if (!n || !n.lit) continue;
      const nbx = n.cx * CHUNK, nbz = n.cz * CHUNK;
      for (let k = 0; k < CHUNK; k++) {
        const lx = ox === 1 ? 0 : ox === -1 ? 15 : k;
        const lz = oz === 1 ? 0 : oz === -1 ? 15 : k;
        for (let y = 0; y < HEIGHT; y++) {
          const p = n.light[idx(lx, y, lz)];
          if (p >> 4 > 1) this.skyQ.push(nbx + lx, y, nbz + lz);
          if ((p & 15) > 1) this.blockQ.push(nbx + lx, y, nbz + lz);
        }
      }
    }
    c.lit = true;
    this.propagate(0);
    this.propagate(1);
  }
}

export const DX = [1, -1, 0, 0, 0, 0];
export const DY = [0, 0, 1, -1, 0, 0];
export const DZ = [0, 0, 0, 0, 1, -1];
