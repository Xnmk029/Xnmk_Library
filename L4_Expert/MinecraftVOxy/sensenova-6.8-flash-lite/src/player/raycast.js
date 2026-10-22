// VOXY CRAFT — 体素射线拾取（Amanatides & Woo DDA）
// 纯逻辑，可单测。返回命中方块坐标 + 命中面法线（放置用相邻格）。
/*LOGIC_START*/

// getBlock(x,y,z)->id；isTarget(id)->bool（该方块是否可被射线命中）
export function raycastVoxel(getBlock, isTarget, ox, oy, oz, dx, dy, dz, maxDist) {
  // 方向归一化
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;

  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX = dx !== 0 ? (stepX > 0 ? (x + 1 - ox) : (ox - x)) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (stepY > 0 ? (y + 1 - oy) : (oy - y)) * tDeltaY : Infinity;
  let tMaxZ = dz !== 0 ? (stepZ > 0 ? (z + 1 - oz) : (oz - z)) * tDeltaZ : Infinity;

  let nx = 0, ny = 0, nz = 0;
  let t = 0;

  while (t <= maxDist) {
    const id = getBlock(x, y, z);
    if (id !== 0 && isTarget(id)) {
      return { hit: true, x, y, z, nx, ny, nz, block: id, dist: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return { hit: false };
}
/*LOGIC_END*/
