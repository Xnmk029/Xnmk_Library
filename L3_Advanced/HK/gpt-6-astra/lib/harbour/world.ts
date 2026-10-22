import { BOUNDS, CHUNK, LANDMARKS, hash, project, type CityData, type Point } from './geo';
import { VoxelStore } from './grid';

export const CELL = 4;
export const NX = (BOUNDS.maxX - BOUNDS.minX) / CELL;
export const NZ = (BOUNDS.maxZ - BOUNDS.minZ) / CELL;
export const MAT = { stone: 0, road: 1, park: 2, concrete: 3, glass: 4, pale: 5, gold: 6, roof: 7, wood: 8, leaf: 9, light: 10, dark: 11 };
export interface ChunkSurface { key: string; positions: number[]; normals: number[]; colors: number[]; kinds: number[]; indices: number[]; center: Point; }
const COLORS = ['#b3b1a0', '#626c6d', '#526b4d', '#b5b7ad', '#7499a1', '#d7d2bf', '#b6a086', '#c6c5b5', '#765f45', '#59754e', '#ffda95', '#3d5158'];
function rgb(hex: string) { return [1, 3, 5].map(n => { const s = parseInt(hex.slice(n, n + 2), 16) / 255; return s < .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }); }
const PALETTE = COLORS.map(rgb);

export class VoxelWorld {
  data: CityData;
  land = new Uint8Array(NX * NZ);
  ground = new Int16Array(NX * NZ);
  top = new Int16Array(NX * NZ);
  owner = new Uint16Array(NX * NZ);
  surface = new Uint8Array(NX * NZ);
  store = new VoxelStore();
  chunks: ChunkSurface[] = [];
  trees: [number, number, number][] = [];
  lamps: [number, number, number][] = [];
  walkable: Point[] = [];
  landmarkIds = new Map<number, string>();
  constructor(data: CityData) { this.data = data; }
  index(x: number, z: number) {
    const ix = Math.floor((x - BOUNDS.minX) / CELL), iz = Math.floor((z - BOUNDS.minZ) / CELL);
    return ix < 0 || iz < 0 || ix >= NX || iz >= NZ ? -1 : iz * NX + ix;
  }
  height(x: number, z: number) { const i = this.index(x, z); return i < 0 || !this.land[i] ? -100 : this.top[i] * .5; }
  isWalkable(x: number, z: number) { const i = this.index(x, z); return i >= 0 && this.land[i] > 0 && !this.owner[i]; }
  polygon(p: Point[], visit: (i: number, x: number, z: number) => void) {
    if (p.length < 3) return;
    const z0 = Math.max(0, Math.floor((Math.min(...p.map(v => v[1])) - BOUNDS.minZ) / CELL));
    const z1 = Math.min(NZ - 1, Math.ceil((Math.max(...p.map(v => v[1])) - BOUNDS.minZ) / CELL));
    for (let iz = z0; iz <= z1; iz++) {
      const z = BOUNDS.minZ + iz * CELL + CELL / 2, cuts: number[] = [];
      for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
        const v = p[a], w = p[b];
        if ((v[1] > z) !== (w[1] > z)) cuts.push(v[0] + (w[0] - v[0]) * (z - v[1]) / (w[1] - v[1]));
      }
      cuts.sort((a, b) => a - b);
      for (let c = 0; c + 1 < cuts.length; c += 2) {
        const x0 = Math.max(0, Math.ceil((cuts[c] - BOUNDS.minX - CELL / 2) / CELL));
        const x1 = Math.min(NX - 1, Math.floor((cuts[c + 1] - BOUNDS.minX - CELL / 2) / CELL));
        for (let ix = x0; ix <= x1; ix++) visit(iz * NX + ix, BOUNDS.minX + ix * CELL, BOUNDS.minZ + iz * CELL);
      }
    }
  }
  build() {
    for (const p of this.data.land) this.polygon(p, i => { this.land[i] = 1; });
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const i = iz * NX + ix; if (!this.land[i]) continue;
      const x = BOUNDS.minX + ix * CELL, z = BOUNDS.minZ + iz * CELL;
      // Background relief is an explicitly documented artistic approximation.
      const south = Math.max(0, Math.min(1, (z - 1300) / 650));
      const hill = south * (420 * Math.exp(-(((x + 2050) / 700) ** 2) - ((z - 1920) / 900) ** 2) + 220 * Math.exp(-(((x - 1250) / 1700) ** 2) - ((z - 3000) / 800) ** 2));
      this.ground[i] = Math.round((4 + Math.floor(hill / 4) * 4) * 2);
      this.top[i] = this.ground[i];
      this.surface[i] = hill > 30 ? MAT.park : MAT.stone;
      if (((x + 200) / 190) ** 2 + ((z + 1190) / 240) ** 2 < 1 || ((x + 1750) / 300) ** 2 + ((z + 780) / 220) ** 2 < 1 || ((x + 420) / 180) ** 2 + ((z - 760) / 130) ** 2 < 1) this.surface[i] = MAT.park;
    }
    for (const park of this.data.parks) this.polygon(park.p,i=>{if(this.land[i])this.surface[i]=MAT.park;});
    for (const road of this.data.roads) {
      if (/Tunnel/i.test(road.kind || '')) continue;
      const r = /Main|Express/i.test(road.kind || '') ? 9 : 5;
      for (let k = 1; k < road.p.length; k++) {
        const a = road.p[k - 1], b = road.p[k], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const steps = Math.ceil(len / 3);
        for (let t = 0; t <= steps; t++) {
          const u = steps ? t / steps : 0, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
          for (let dx = -r; dx <= r; dx += CELL) for (let dz = -r; dz <= r; dz += CELL) {
            const i = this.index(x + dx, z + dz);
            if (i < 0 || !this.land[i]) continue;
            this.surface[i] = MAT.road;
          }
        }
      }
    }
    // The highest occupied column wins. Overlapping cadastral podium/tower
    // polygons are unioned before geometry is created, so no cell is duplicated.
    this.data.buildings.forEach((b, n) => {
      const name=(b.en||'').toLowerCase();
      if((name==='two international finance centre'&&(b.h||0)>200)||(name==='international commerce centre'&&(b.h||0)>200)||(name==='bank of china tower'&&(b.h||0)>200)||name==='hong kong convention and exhibition centre')return;
      this.polygon(b.p, (i) => {
        if (!this.land[i]) return;
        const top = this.ground[i] + Math.round((b.h || 20) * 2);
        if (top > this.top[i]) { this.top[i] = top; this.owner[i] = n + 1; }
      });
    });
    LANDMARKS.forEach((l, n) => {
      const [cx, cz] = project(l.lon, l.lat), radius = l.id === 'hkcec' ? 170 : 60;
      const owner = this.data.buildings.length + n + 1;
      this.landmarkIds.set(owner, l.id);
      const c = Math.cos(.15), s = Math.sin(.15);
      for (let x = Math.floor((cx - radius) / CELL) * CELL; x < cx + radius; x += CELL) for (let z = Math.floor((cz - radius) / CELL) * CELL; z < cz + radius; z += CELL) {
        const i = this.index(x, z); if (i < 0) continue;
        const dx = x + 2 - cx, dz = z + 2 - cz, u = dx * c - dz * s, v = dx * s + dz * c;
        const a = Math.abs(u), b = Math.abs(v); let h = 0;
        if (l.id === 'ifc') {
          const r = Math.max(a, b, (a + b) * .71);
          if (r < 34) h = r < 25 ? 400 : r < 27 ? 390 : r < 29 ? 354 : r < 31 ? 275 : 100;
          if (r < 29 && r > 24 && (a < 6 || b < 6)) h = 412;
        } else if (l.id === 'icc') {
          if (a < 34 && b < 34 && a + b < 59) h = a < 29 && b < 29 ? 484 : a < 31 && b < 31 ? 467 : 444;
        } else if (l.id === 'boc') {
          if (a < 27 && b < 27) h = 315 - Math.max(0, u + v + 8) * 1.6 - Math.max(0, u - v - 3) * .8;
        } else {
          const ell = (u / 115) ** 2 + (v / 145) ** 2;
          if (ell < 1) h = Math.floor((26 + 38 * Math.pow(1 - ell, .55)) * 2) / 2;
        }
        if (h > 0 && this.land[i]) { this.top[i] = this.ground[i] + Math.round(h * 2); this.owner[i] = owner; }
      }
    });
    for (let iz = 1; iz < NZ - 1; iz++) for (let ix = 1; ix < NX - 1; ix++) {
      const i = iz * NX + ix;
      if (!this.land[i] || this.owner[i]) continue;
      const x = BOUNDS.minX + ix * CELL, z = BOUNDS.minZ + iz * CELL;
      let edge = false;
      for (const d of [-NX * 3, NX * 3, -3, 3]) if (i + d >= 0 && i + d < this.land.length && !this.land[i + d]) edge = true;
      if (edge) { this.surface[i] = MAT.pale; if (ix % 8 === 0 && iz % 3 === 0) this.walkable.push([x + 2, z + 2]); }
      if (this.surface[i] === MAT.park && ix % 5 === 0 && iz % 5 === 0 && hash(i) > .4 && this.clear(x, z, 6)) this.trees.push([x, this.ground[i] * .5, z]);
      if (edge && ix % 12 === 0 && iz % 4 === 0 && this.clear(x, z, 3)) this.lamps.push([x, this.ground[i] * .5, z]);
    }
    this.mesh();
    return this;
  }
  clear(x: number, z: number, radius: number) {
    for (let dx = -radius; dx <= radius; dx += CELL) for (let dz = -radius; dz <= radius; dz += CELL) if (!this.isWalkable(x + dx, z + dz)) return false;
    return true;
  }
  nearestWalk(x: number, z: number): Point {
    if (this.clear(x, z, 2)) return [Math.floor(x / 4) * 4 + 2, Math.floor(z / 4) * 4 + 2];
    for (let r = 4; r < 600; r += 4) for (let a = 0; a < 24; a++) {
      const px = Math.floor((x + Math.cos(a * Math.PI / 12) * r) / 4) * 4 + 2;
      const pz = Math.floor((z + Math.sin(a * Math.PI / 12) * r) / 4) * 4 + 2;
      if (this.clear(px, pz, 2)) return [px, pz];
    }
    return this.walkable[0] || [0, 0];
  }
  mesh() {
    const bins = new Map<string, ChunkSurface>();
    const get = (x: number, z: number) => {
      const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
      if (!bins.has(key)) bins.set(key, { key, positions: [], normals: [], colors: [], kinds: [], indices: [], center: [Math.floor(x / CHUNK) * CHUNK + CHUNK / 2, Math.floor(z / CHUNK) * CHUNK + CHUNK / 2] });
      return bins.get(key)!;
    };
    const quad = (chunk: ChunkSurface, p: number[], normal: number[], color: number[], shade = 1, kind = 0) => {
      const start = chunk.positions.length / 3;
      chunk.positions.push(...p);
      for (let k = 0; k < 4; k++) { chunk.normals.push(...normal); chunk.colors.push(color[0] * shade, color[1] * shade, color[2] * shade); chunk.kinds.push(kind); }
      chunk.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const i = iz * NX + ix; if (!this.land[i]) continue;
      const x = BOUNDS.minX + ix * CELL, z = BOUNDS.minZ + iz * CELL, y = this.top[i] * .5;
      const g = this.ground[i] * .5, id = this.owner[i], landmark = this.landmarkIds.get(id);
      const material = id ? landmark === 'hkcec' ? MAT.pale : landmark ? MAT.glass : [MAT.concrete, MAT.glass, MAT.pale, MAT.gold][Math.floor(hash(id) * 4)] : this.surface[i];
      const color = PALETTE[material], chunk = get(x, z);
      const tint = id ? .84 + hash(id + 100) * .25 : .96 + hash(Math.floor(ix / 8) + Math.floor(iz / 8) * 100) * .06;
      // Greedy, exact run length compression, bounded by shared chunk lines.
      let span = 1;
      while (ix + span < NX && Math.floor((x + span * CELL) / CHUNK) === Math.floor(x / CHUNK) && this.land[i + span] && this.top[i + span] === this.top[i] && this.ground[i + span] === this.ground[i] && this.owner[i + span] === id && this.surface[i + span] === this.surface[i] && span < 64) span++;
      this.store.add(x, -16, z, span * CELL, g + 16, CELL, this.surface[i]);
      if (id && y > g) this.store.add(x, g, z, span * CELL, y - g, CELL, material, id);
      quad(chunk, [x,y,z, x,y,z+CELL, x+span*CELL,y,z+CELL, x+span*CELL,y,z], [0,1,0], color, tint, id);
      for (let j = 0; j < span; j++) {
        const px = x + j * CELL, cell = i + j;
        for (const side of [0,1,2,3]) {
          const ni = side === 0 ? cell - 1 : side === 1 ? cell + 1 : side === 2 ? cell - NX : cell + NX;
          const ny = ni >= 0 && ni < this.top.length && this.land[ni] ? this.top[ni] * .5 : -16;
          if (ny >= y) continue;
          const bottom = Math.max(-16, ny), normal = side === 0 ? [-1,0,0] : side === 1 ? [1,0,0] : side === 2 ? [0,0,-1] : [0,0,1];
          const a = side === 0 ? [px,z+CELL] : side === 1 ? [px+CELL,z] : side === 2 ? [px,z] : [px+CELL,z+CELL];
          const b = side === 0 ? [px,z] : side === 1 ? [px+CELL,z+CELL] : side === 2 ? [px+CELL,z] : [px,z+CELL];
          quad(chunk, [a[0],bottom,a[1], a[0],y,a[1], b[0],y,b[1], b[0],bottom,b[1]], normal, color, tint * (id ? .92 : .77), id);
        }
      }
      ix += span - 1;
    }
    this.chunks = [...bins.values()];
  }
}
