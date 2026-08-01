// VOXY CRAFT — 玩家物理（AABB 对体素扫掠碰撞）
// 纯逻辑，可单测。pos 为脚底中心；逐轴解析碰撞。
/*LOGIC_START*/

const EPS = 1e-3;

function overlapsSolid(getBlock, isSolid, x, y, z, hw, h) {
  const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw);
  const y0 = Math.floor(y), y1 = Math.floor(y + h);
  const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
  for (let bx = x0; bx <= x1; bx++)
    for (let by = y0; by <= y1; by++)
      for (let bz = z0; bz <= z1; bz++)
        if (isSolid(getBlock(bx, by, bz))) return true;
  return false;
}

function moveAxis(getBlock, isSolid, s, hw, h, axis, amount) {
  if (amount === 0) return false;
  s[axis] += amount;
  if (!overlapsSolid(getBlock, isSolid, s.x, s.y, s.z, hw, h)) return false;
  if (axis === 'x') {
    s.x = amount > 0 ? Math.floor(s.x + hw) - hw - EPS : Math.floor(s.x - hw) + 1 + hw + EPS;
  } else if (axis === 'z') {
    s.z = amount > 0 ? Math.floor(s.z + hw) - hw - EPS : Math.floor(s.z - hw) + 1 + hw + EPS;
  } else {
    s.y = amount > 0 ? Math.floor(s.y + h) - h - EPS : Math.floor(s.y) + 1 + EPS;
  }
  return true;
}

// s: {x,y,z, vx,vy,vz, onGround, flying}
// input: {mx, mz (世界 XZ 期望方向), jump, descend}
export function stepPhysics(getBlock, isSolid, s, input, dt, cfg) {
  const hw = cfg.hw || 0.3, h = cfg.height || 1.8;
  const speed = s.flying ? cfg.flySpeed : cfg.walkSpeed;

  s.vx = (input.mx || 0) * speed;
  s.vz = (input.mz || 0) * speed;

  if (s.flying) {
    s.vy = ((input.jump ? 1 : 0) - (input.descend ? 1 : 0)) * speed;
  } else {
    s.vy -= cfg.gravity * dt;
    if (s.vy < -(cfg.maxFall || 55)) s.vy = -(cfg.maxFall || 55);
    if (input.jump && s.onGround) { s.vy = cfg.jumpVel; s.onGround = false; }
  }

  const wasGround = s.onGround;
  s.onGround = false;
  moveAxis(getBlock, isSolid, s, hw, h, 'x', s.vx * dt);
  moveAxis(getBlock, isSolid, s, hw, h, 'z', s.vz * dt);
  const hitY = moveAxis(getBlock, isSolid, s, hw, h, 'y', s.vy * dt);
  if (hitY) { if (s.vy < 0) s.onGround = true; s.vy = 0; }
  else if (s.flying) s.onGround = wasGround;

  return s;
}
/*LOGIC_END*/
