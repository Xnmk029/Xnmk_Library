import * as THREE from "three";
import { BLOCKS, LAVA, WATER, isSolid } from "./blocks";
import { World } from "./world";

const EPS = 1e-4;

export interface MoveResult {
  onGround: boolean;
  hitWall: boolean;
  inWater: boolean;
  inLava: boolean;
  headInWater: boolean;
}

/** Moves an entity (pos = bottom-centre) by vel*dt with axis-separated collision. Mutates pos & vel. */
export function moveEntity(world: World, pos: THREE.Vector3, halfW: number, height: number, vel: THREE.Vector3, dt: number, res: MoveResult) {
  let dx = vel.x * dt, dy = vel.y * dt, dz = vel.z * dt;
  const min = [pos.x - halfW, pos.y, pos.z - halfW];
  const max = [pos.x + halfW, pos.y + height, pos.z + halfW];
  res.onGround = false;
  res.hitWall = false;
  // Y first
  const ady = sweep(world, min, max, 1, dy);
  if (ady !== dy) {
    if (dy < 0) res.onGround = true;
    vel.y = 0;
  }
  min[1] += ady; max[1] += ady;
  const adx = sweep(world, min, max, 0, dx);
  if (adx !== dx) { vel.x = 0; res.hitWall = true; }
  min[0] += adx; max[0] += adx;
  const adz = sweep(world, min, max, 2, dz);
  if (adz !== dz) { vel.z = 0; res.hitWall = true; }
  min[2] += adz; max[2] += adz;
  pos.set(min[0] + halfW, min[1], min[2] + halfW);
  // fluids
  res.inWater = false; res.inLava = false; res.headInWater = false;
  const x0 = Math.floor(min[0]), x1 = Math.floor(max[0] - EPS), z0 = Math.floor(min[2]), z1 = Math.floor(max[2] - EPS);
  const y0 = Math.floor(min[1]), y1 = Math.floor(max[1] - EPS);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const b = world.getBlock(x, y, z);
    if (b === WATER) {
      // consider fluid height
      const m = world.getMeta(x, y, z);
      const lvl = m & 8 ? 0 : m & 7;
      const h = world.getBlock(x, y + 1, z) === WATER ? 1 : 1 - (lvl + 1) / 9;
      if (min[1] < y + h) res.inWater = true;
    } else if (b === LAVA) res.inLava = true;
  }
  const hx = Math.floor(pos.x), hy = Math.floor(pos.y + height * 0.9), hz = Math.floor(pos.z);
  if (world.getBlock(hx, hy, hz) === WATER) {
    const m = world.getMeta(hx, hy, hz);
    const lvl = m & 8 ? 0 : m & 7;
    const h = world.getBlock(hx, hy + 1, hz) === WATER ? 1 : 1 - (lvl + 1) / 9;
    if (pos.y + height * 0.9 < hy + h) res.headInWater = true;
  }
}

function sweep(world: World, min: number[], max: number[], axis: number, delta: number): number {
  if (delta === 0) return 0;
  const nmin = [min[0], min[1], min[2]], nmax = [max[0], max[1], max[2]];
  if (delta > 0) nmax[axis] += delta; else nmin[axis] += delta;
  const x0 = Math.floor(nmin[0] + EPS), x1 = Math.floor(nmax[0] - EPS);
  const y0 = Math.floor(nmin[1] + EPS), y1 = Math.floor(nmax[1] - EPS);
  const z0 = Math.floor(nmin[2] + EPS), z1 = Math.floor(nmax[2] - EPS);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        if (!isSolid(world.getBlock(x, y, z))) continue;
        const bmin = [x, y, z][axis], bmax = bmin + 1;
        if (delta > 0) {
          const d = bmin - max[axis] - EPS;
          if (d < delta) delta = Math.max(0, d);
        } else {
          const d = bmax - min[axis] + EPS;
          if (d > delta) delta = Math.min(0, d);
        }
      }
  return delta;
}

/** Is the box (bottom-centre pos) intersecting any solid block? */
export function boxIntersectsSolid(world: World, pos: THREE.Vector3, halfW: number, height: number) {
  const x0 = Math.floor(pos.x - halfW + EPS), x1 = Math.floor(pos.x + halfW - EPS);
  const y0 = Math.floor(pos.y + EPS), y1 = Math.floor(pos.y + height - EPS);
  const z0 = Math.floor(pos.z - halfW + EPS), z1 = Math.floor(pos.z + halfW - EPS);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (isSolid(world.getBlock(x, y, z))) return true;
  return false;
}
export function boxIntersectsBlock(pos: THREE.Vector3, halfW: number, height: number, bx: number, by: number, bz: number) {
  return pos.x + halfW > bx && pos.x - halfW < bx + 1 && pos.y + height > by && pos.y < by + 1 && pos.z + halfW > bz && pos.z - halfW < bz + 1;
}

export interface RayHit {
  x: number;
  y: number;
  z: number;
  face: number; // 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z (normal of hit face)
  dist: number;
  id: number;
}

export function raycast(world: World, origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, includeFluids = false): RayHit | null {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / (dir.x || 1e-9)), tDeltaY = Math.abs(1 / (dir.y || 1e-9)), tDeltaZ = Math.abs(1 / (dir.z || 1e-9));
  let tMaxX = dir.x > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
  let tMaxY = dir.y > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
  let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;
  let face = -1;
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== 0) {
      const def = BLOCKS[id];
      const hittable = def.render !== "none" && (def.render !== "liquid" || includeFluids);
      if (hittable && face >= 0) {
        // plants/torches: smaller hit box test
        if (def.render === "cross" || def.render === "torch") {
          const p = origin.clone().addScaledVector(dir, t + 1e-4);
          const lx = p.x - x, lz = p.z - z, ly = p.y - y;
          const inset = def.render === "torch" ? 0.35 : 0.2;
          // walk through the cell in small steps to see if we cross the inner box
          let hit = false;
          for (let k = 0; k < 12 && !hit; k++) {
            const q = origin.clone().addScaledVector(dir, t + k * 0.09);
            const qx = q.x - x, qy = q.y - y, qz = q.z - z;
            if (qx > inset && qx < 1 - inset && qz > inset && qz < 1 - inset && qy >= 0 && qy <= (def.render === "torch" ? 0.65 : 0.9)) hit = true;
          }
          void lx; void lz; void ly;
          if (hit) return { x, y, z, face, dist: t, id };
        } else return { x, y, z, face, dist: t, id };
      } else if (hittable && face < 0) {
        return { x, y, z, face: 2, dist: 0, id };
      }
    }
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) { if (tMaxX > maxDist) return null; x += stepX; t = tMaxX; tMaxX += tDeltaX; face = stepX > 0 ? 1 : 0; }
      else { if (tMaxZ > maxDist) return null; z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = stepZ > 0 ? 5 : 4; }
    } else {
      if (tMaxY < tMaxZ) { if (tMaxY > maxDist) return null; y += stepY; t = tMaxY; tMaxY += tDeltaY; face = stepY > 0 ? 3 : 2; }
      else { if (tMaxZ > maxDist) return null; z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = stepZ > 0 ? 5 : 4; }
    }
  }
  return null;
}

/** Ray vs axis aligned box (min/max). Returns distance or -1 */
export function rayBox(origin: THREE.Vector3, dir: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3): number {
  let tmin = -Infinity, tmax = Infinity;
  for (const a of ["x", "y", "z"] as const) {
    const inv = 1 / (dir[a] || 1e-9);
    let t1 = (min[a] - origin[a]) * inv, t2 = (max[a] - origin[a]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax < 0 || tmin > tmax) return -1;
  return Math.max(0, tmin);
}
