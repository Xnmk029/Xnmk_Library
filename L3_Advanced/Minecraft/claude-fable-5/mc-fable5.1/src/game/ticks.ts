import { AIR, BLOCKS, COBBLE, GRAVEL, LAVA, LEAVES_IDS, LOG_IDS, OBSIDIAN, SAND, TORCH, WATER, canSupport, isPlant } from "./blocks";
import { growTree } from "./terrain";
import { World } from "./world";
const SAPLING = 38;

const key = (x: number, y: number, z: number) => ((x + 1048576) * 128 + y) * 2097152 + (z + 1048576);
const dekey = (k: number): [number, number, number] => {
  const z = (k % 2097152) - 1048576;
  const rest = Math.floor(k / 2097152);
  const y = rest % 128;
  const x = Math.floor(rest / 128) - 1048576;
  return [x, y, z];
};
const HDIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class TickSystem {
  private water = new Set<number>();
  private waterNext = new Set<number>();
  private gravity = new Set<number>();
  private leaves = new Map<number, number>(); // key -> time remaining
  private saplings = new Map<number, number>();
  private waterTimer = 0;
  private gravityTimer = 0;
  constructor(private world: World, private dropBlock: (x: number, y: number, z: number, id: number, meta: number) => void) {}

  onBlockChanged(x: number, y: number, z: number, oldId: number, newId: number) {
    // neighbours
    for (let d = 0; d < 6; d++) {
      const nx = x + [1, -1, 0, 0, 0, 0][d], ny = y + [0, 0, 1, -1, 0, 0][d], nz = z + [0, 0, 0, 0, 1, -1][d];
      const nb = this.world.getBlock(nx, ny, nz);
      if (nb === WATER) this.scheduleWater(nx, ny, nz);
      if (nb === SAND || nb === GRAVEL) this.gravity.add(key(nx, ny, nz));
      if (newId === AIR || !BLOCKS[newId].solid) {
        // support checks
        if (isPlant(nb) && ny === y + 1) this.breakBlock(nx, ny, nz);
        if (nb === TORCH) {
          const m = this.world.getMeta(nx, ny, nz);
          const supportDir = m === 0 ? 3 : m - 1; // face index toward supporting block
          const sx = nx + [1, -1, 0, 0, 0, 0][supportDir], sy = ny + [0, 0, 1, -1, 0, 0][supportDir], sz = nz + [0, 0, 0, 0, 1, -1][supportDir];
          if (sx === x && sy === y && sz === z) this.breakBlock(nx, ny, nz);
        }
      }
    }
    if (newId === WATER) this.scheduleWater(x, y, z);
    if (newId === SAND || newId === GRAVEL) this.gravity.add(key(x, y, z));
    if (newId === SAPLING) this.saplings.set(key(x, y, z), 25 + Math.random() * 50);
    if (LOG_IDS.includes(oldId) && !LOG_IDS.includes(newId)) this.scheduleLeafChecks(x, y, z);
    if (LEAVES_IDS.includes(oldId)) this.scheduleLeafChecks(x, y, z, 2);
  }

  breakBlock(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    if (id === AIR) return;
    const meta = this.world.getMeta(x, y, z);
    this.world.setBlock(x, y, z, AIR, 0);
    this.dropBlock(x, y, z, id, meta);
  }

  scheduleWater(x: number, y: number, z: number) {
    this.waterNext.add(key(x, y, z));
  }
  private scheduleLeafChecks(x: number, y: number, z: number, r = 4) {
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > r + 2) continue;
          const id = this.world.getBlock(x + dx, y + dy, z + dz);
          if (LEAVES_IDS.includes(id)) {
            const k = key(x + dx, y + dy, z + dz);
            if (!this.leaves.has(k)) this.leaves.set(k, 1 + Math.random() * 6);
          }
        }
  }

  update(dt: number) {
    this.waterTimer += dt;
    if (this.waterTimer >= 0.25) {
      this.waterTimer = 0;
      this.tickWater();
    }
    this.gravityTimer += dt;
    if (this.gravityTimer >= 0.08) {
      this.gravityTimer = 0;
      this.tickGravity();
    }
    if (this.saplings.size) {
      for (const [k, t] of this.saplings) {
        const nt = t - dt;
        if (nt > 0) { this.saplings.set(k, nt); continue; }
        const [x, y, z] = dekey(k);
        if (this.world.getBlock(x, y, z) !== SAPLING) { this.saplings.delete(k); continue; }
        this.world.setBlock(x, y, z, AIR, 0);
        if (growTree(this.world, x, y, z)) this.saplings.delete(k);
        else { this.world.setBlock(x, y, z, SAPLING, 0); this.saplings.set(k, 20); }
        break;
      }
    }
    if (this.leaves.size) {
      let n = 0;
      for (const [k, t] of this.leaves) {
        const nt = t - dt;
        if (nt <= 0) {
          this.leaves.delete(k);
          const [x, y, z] = dekey(k);
          this.checkLeaf(x, y, z);
          if (++n > 20) break;
        } else this.leaves.set(k, nt);
      }
    }
  }

  private checkLeaf(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    if (!LEAVES_IDS.includes(id)) return;
    // BFS through leaves up to 6 for a log
    const seen = new Set<number>([key(x, y, z)]);
    let frontier: [number, number, number][] = [[x, y, z]];
    for (let step = 0; step < 6; step++) {
      const next: [number, number, number][] = [];
      for (const [px, py, pz] of frontier) {
        for (let d = 0; d < 6; d++) {
          const nx = px + [1, -1, 0, 0, 0, 0][d], ny = py + [0, 0, 1, -1, 0, 0][d], nz = pz + [0, 0, 0, 0, 1, -1][d];
          const k = key(nx, ny, nz);
          if (seen.has(k)) continue;
          seen.add(k);
          const nb = this.world.getBlock(nx, ny, nz);
          if (LOG_IDS.includes(nb)) return;
          if (LEAVES_IDS.includes(nb)) next.push([nx, ny, nz]);
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
    // decay
    this.world.setBlock(x, y, z, AIR, 0);
    const r = Math.random();
    if (r < 0.05) this.dropBlock(x, y, z, 38, 0);
    else if (r < 0.07 && id === 15) this.dropBlock(x, y, z, 120, 0);
    else if (r < 0.09) this.dropBlock(x, y, z, 100, 0);
  }

  private tickGravity() {
    if (!this.gravity.size) return;
    const list = [...this.gravity];
    this.gravity.clear();
    for (const k of list) {
      const [x, y, z] = dekey(k);
      const id = this.world.getBlock(x, y, z);
      if (id !== SAND && id !== GRAVEL) continue;
      const below = this.world.getBlock(x, y - 1, z);
      const bdef = BLOCKS[below];
      if (y > 0 && (below === AIR || below === WATER || below === LAVA || (bdef.replaceable && !bdef.solid) || isPlant(below))) {
        if (isPlant(below)) this.breakBlock(x, y - 1, z);
        this.world.setBlock(x, y, z, AIR, 0);
        this.world.setBlock(x, y - 1, z, id, 0);
        this.gravity.add(key(x, y - 1, z));
        const above = this.world.getBlock(x, y + 1, z);
        if (above === SAND || above === GRAVEL) this.gravity.add(key(x, y + 1, z));
      }
    }
  }

  // ---------------- water ----------------
  private tickWater() {
    if (!this.waterNext.size) return;
    const cur = this.waterNext;
    this.waterNext = new Set();
    this.water = cur;
    let n = 0;
    for (const k of this.water) {
      if (++n > 3000) { this.waterNext.add(k); continue; }
      const [x, y, z] = dekey(k);
      this.updateWater(x, y, z);
    }
    this.water.clear();
  }

  private effLevel(x: number, y: number, z: number): number {
    // 0 = source/falling, 1..7 flowing, -1 not water
    if (this.world.getBlock(x, y, z) !== WATER) return -1;
    const m = this.world.getMeta(x, y, z);
    return m & 8 ? 0 : m & 7;
  }
  private canReplace(id: number) {
    if (id === AIR) return true;
    const d = BLOCKS[id];
    return (d.replaceable && id !== WATER && id !== LAVA) || isPlant(d.id);
  }
  private isHole(x: number, y: number, z: number) {
    const b = this.world.getBlock(x, y, z);
    return b === WATER || this.canReplace(b) || b === LAVA;
  }
  private slopeDistance(x: number, y: number, z: number, depth: number, fromDx: number, fromDz: number): number {
    let best = 1000;
    for (const [dx, dz] of HDIRS) {
      if (dx === -fromDx && dz === -fromDz) continue;
      const nx = x + dx, nz = z + dz;
      const nb = this.world.getBlock(nx, y, nz);
      if (!(this.canReplace(nb) || (nb === WATER && (this.world.getMeta(nx, y, nz) & 7) > 0))) continue;
      if (this.isHole(nx, y - 1, nz)) return depth;
      if (depth < 4) best = Math.min(best, this.slopeDistance(nx, y, nz, depth + 1, dx, dz));
    }
    return best;
  }

  private updateWater(x: number, y: number, z: number) {
    const w = this.world;
    if (w.getBlock(x, y, z) !== WATER) return;
    const meta = w.getMeta(x, y, z);
    const isSource = meta === 0;
    let level = meta & 8 ? 0 : meta & 7;
    if (!isSource) {
      // recompute from neighbours
      let newMeta = -1;
      if (w.getBlock(x, y + 1, z) === WATER) newMeta = 8;
      else {
        let minL = 99, sources = 0;
        for (const [dx, dz] of HDIRS) {
          const l = this.effLevel(x + dx, y, z + dz);
          if (l < 0) continue;
          if (w.getMeta(x + dx, y, z + dz) === 0) sources++;
          minL = Math.min(minL, l + 1);
        }
        const belowB = w.getBlock(x, y - 1, z);
        if (sources >= 2 && (BLOCKS[belowB].solid || (belowB === WATER && w.getMeta(x, y - 1, z) === 0))) newMeta = 0;
        else if (minL <= 7) newMeta = minL;
      }
      if (newMeta < 0) {
        w.setBlock(x, y, z, AIR, 0);
        this.scheduleAround(x, y, z);
        return;
      }
      if (newMeta !== meta) {
        w.setMeta(x, y, z, newMeta);
        this.scheduleAround(x, y, z);
      }
      level = newMeta & 8 ? 0 : newMeta & 7;
    }
    // flow down
    const below = w.getBlock(x, y - 1, z);
    if (y > 0) {
      if (below === LAVA) {
        w.setBlock(x, y - 1, z, w.getMeta(x, y - 1, z) === 0 ? OBSIDIAN : COBBLE, 0);
      } else if (this.canReplace(below) || (below === WATER && w.getMeta(x, y - 1, z) !== 0 && w.getMeta(x, y - 1, z) !== 8)) {
        if (isPlant(below)) this.dropBlock(x, y - 1, z, below, 0);
        w.setBlock(x, y - 1, z, WATER, 8);
        this.scheduleWater(x, y - 1, z);
        this.scheduleAround(x, y - 1, z);
      }
    }
    // sideways
    if (level >= 7) return;
    if (!isSource && this.isHole(x, y - 1, z)) return;
    const dirs: { dx: number; dz: number; dist: number }[] = [];
    for (const [dx, dz] of HDIRS) {
      const nx = x + dx, nz = z + dz;
      const nb = w.getBlock(nx, y, nz);
      if (nb === LAVA) { w.setBlock(nx, y, nz, w.getMeta(nx, y, nz) === 0 ? OBSIDIAN : COBBLE, 0); continue; }
      const ok = this.canReplace(nb) || (nb === WATER && this.effLevel(nx, y, nz) > level + 1 && w.getMeta(nx, y, nz) !== 0 && !(w.getMeta(nx, y, nz) & 8));
      if (!ok) continue;
      const dist = this.isHole(nx, y - 1, nz) ? 0 : this.slopeDistance(nx, y, nz, 1, dx, dz);
      dirs.push({ dx, dz, dist });
    }
    if (!dirs.length) return;
    const minDist = Math.min(...dirs.map((d) => d.dist));
    for (const d of dirs) {
      if (d.dist !== minDist) continue;
      const nx = x + d.dx, nz = z + d.dz;
      const nb = w.getBlock(nx, y, nz);
      if (isPlant(nb)) this.dropBlock(nx, y, nz, nb, 0);
      w.setBlock(nx, y, nz, WATER, level + 1);
      this.scheduleWater(nx, y, nz);
    }
  }
  private scheduleAround(x: number, y: number, z: number) {
    for (let d = 0; d < 6; d++) {
      const nx = x + [1, -1, 0, 0, 0, 0][d], ny = y + [0, 0, 1, -1, 0, 0][d], nz = z + [0, 0, 0, 0, 1, -1][d];
      if (this.world.getBlock(nx, ny, nz) === WATER) this.scheduleWater(nx, ny, nz);
    }
  }
}

export { canSupport };
