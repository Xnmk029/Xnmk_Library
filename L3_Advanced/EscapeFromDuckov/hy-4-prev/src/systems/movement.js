// 移动与碰撞：圆 vs tile AABB。分轴推进 + 迭代推出，保证贴墙滑行且不穿角。
import { TILE } from './world.js';

const SOLID = (t) => t === TILE.SOLID || t === TILE.LOW;

/** 逐格推出重叠（半径 r 的圆 vs 实心格） */
export function resolveOverlap(world, x, z, r) {
  const t = world.toTile(x, z);
  let px = x, pz = z, hit = false;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = t.tx + dx, tz = t.tz + dz;
        if (!SOLID(world.tileAt(tx, tz))) continue;
        const minX = world.minX + tx, minZ = world.minZ + tz;
        const maxX = minX + 1, maxZ = minZ + 1;
        const nx = Math.max(minX, Math.min(px, maxX));
        const nz = Math.max(minZ, Math.min(pz, maxZ));
        let ox = px - nx, oz = pz - nz;
        let d2 = ox * ox + oz * oz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), push = r - d + 0.0005;
          px += (ox / d) * push; pz += (oz / d) * push;
        } else {
          // 圆心陷入格内：沿最浅方向弹出
          const l = px - minX, rr = maxX - px, u = pz - minZ, dn = maxZ - pz;
          const m = Math.min(l, rr, u, dn);
          if (m === l) px = minX - r; else if (m === rr) px = maxX + r;
          else if (m === u) pz = minZ - r; else pz = maxZ + r;
        }
        moved = true; hit = true;
      }
    }
    if (!moved) break;
  }
  return { x: px, z: pz, hit };
}

/** 分轴推进：先 X 后 Z，被挡的轴归零 → 天然贴墙滑行 */
export function moveWithCollision(world, ent, dx, dz, r) {
  let nx = ent.x + dx;
  let nz = ent.z;
  let res = resolveOverlap(world, nx, nz, r);
  if (res.hit) { nx = res.x; nz = res.z; }
  let hitX = false;
  if (Math.abs(nx - (ent.x + dx)) > 1e-4) hitX = true;

  let nz2 = nz + dz;
  let res2 = resolveOverlap(world, nx, nz2, r);
  let hitZ = false;
  if (res2.hit) { nz2 = res2.z; nx = res2.x; }
  if (Math.abs(nz2 - (nz + dz)) > 1e-4) hitZ = true;

  const movedX = nx - ent.x, movedZ = nz2 - ent.z;
  ent.x = nx; ent.z = nz2;
  return { movedX, movedZ, hitX, hitZ };
}

/** 是否可直达（A* 与 AI 视线用）：DDA 网格步进，遇挡即否 */
export function hasLineOfSight(world, ax, az, bx, bz, blockLow = false) {
  let x = ax, z = az;
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return true;
  const step = 0.25;
  const n = Math.ceil(len / step);
  const sx = dx / n, sz = dz / n;
  for (let i = 1; i <= n; i++) {
    x += sx; z += sz;
    const t = world.toTile(x, z);
    const v = world.tileAt(t.tx, t.tz);
    if (v === TILE.SOLID || v === TILE.SIGHT || (blockLow && v === TILE.LOW)) return false;
  }
  return true;
}

/** 贴地小台阶/矮掩体的翻越判定（矮窗、沙袋） */
export function canVault(world, x, z) {
  const t = world.toTile(x, z);
  return world.tileAt(t.tx, t.tz) === TILE.LOW;
}
