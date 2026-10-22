// VOXY CRAFT — 射线拾取 + 物理 单元测试
// 运行：node test/player.test.mjs
import { raycastVoxel } from '../src/player/raycast.js';
import { stepPhysics } from '../src/player/physics.js';

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('  ✗ FAIL: ' + msg); } }

const isTarget = (id) => id !== 0;
const isSolid = (id) => id !== 0;

console.log('== raycast DDA ==');
{
  // 单个实心方块 (5,5,5)
  const getBlock = (x, y, z) => (x === 5 && y === 5 && z === 5) ? 1 : 0;

  let r = raycastVoxel(getBlock, isTarget, 5.5, 5.5, 0.5, 0, 0, 1, 20);
  ok(r.hit && r.x === 5 && r.y === 5 && r.z === 5, '沿 +Z 命中 (5,5,5)');
  ok(r.nz === -1 && r.nx === 0 && r.ny === 0, '命中面法线 -Z（放置位 z-1）');

  r = raycastVoxel(getBlock, isTarget, 0.5, 5.5, 5.5, 1, 0, 0, 20);
  ok(r.hit && r.x === 5, '沿 +X 命中');
  ok(r.nx === -1, '命中面法线 -X');

  r = raycastVoxel(getBlock, isTarget, 5.5, 10.5, 5.5, 0, -1, 0, 20);
  ok(r.hit && r.y === 5 && r.ny === 1, '从上方命中顶面，法线 +Y');

  r = raycastVoxel(getBlock, isTarget, 0.5, 0.5, 0.5, 1, 0, 0, 20);
  ok(!r.hit, '未命中返回 hit=false');

  r = raycastVoxel(getBlock, isTarget, 5.5, 5.5, 0.5, 0, 0, 1, 3);
  ok(!r.hit, '超出最大距离不命中');

  // 命中相邻最近方块
  const gb2 = (x, y, z) => (z === 3 || z === 7) && x === 5 && y === 5 ? 1 : 0;
  r = raycastVoxel(gb2, isTarget, 5.5, 5.5, 0.5, 0, 0, 1, 20);
  ok(r.hit && r.z === 3, '命中最近的方块 (z=3 先于 z=7)');
}

console.log('== physics 碰撞 ==');
const cfg = { gravity: 24, jumpVel: 8.4, walkSpeed: 5.6, flySpeed: 11, hw: 0.3, height: 1.8, maxFall: 55 };
{
  // 地板 y<=4 实心，玩家从 y=10 下落
  const floor = (x, y, z) => (y <= 4 ? 1 : 0);
  const s = { x: 8, y: 10, z: 8, vx: 0, vy: 0, vz: 0, onGround: false, flying: false };
  for (let i = 0; i < 300; i++) stepPhysics(floor, isSolid, s, { mx: 0, mz: 0, jump: false, descend: false }, 1 / 60, cfg);
  ok(Math.abs(s.y - 5) < 0.02, `下落停在地板顶 y≈5 (实测 ${s.y.toFixed(3)})`);
  ok(s.onGround, '落地 onGround=true');

  // 跳跃
  const yBefore = s.y;
  stepPhysics(floor, isSolid, s, { mx: 0, mz: 0, jump: true, descend: false }, 1 / 60, cfg);
  ok(s.vy > 0, '跳跃获得向上速度');
}
{
  // 墙 x>=10 实心，玩家向 +X 走
  const wall = (x, y, z) => (x >= 10 && y >= 0 && y <= 12) ? 1 : 0;
  const s = { x: 8, y: 5, z: 8, vx: 0, vy: 0, vz: 0, onGround: true, flying: true };
  for (let i = 0; i < 120; i++) stepPhysics(wall, isSolid, s, { mx: 1, mz: 0, jump: false, descend: false }, 1 / 60, cfg);
  ok(s.x < 9.71 && s.x > 9.5, `撞墙停在 x≈9.7 (实测 ${s.x.toFixed(3)})`);
}
{
  // 飞行模式：上升/下降
  const empty = () => 0;
  const s = { x: 0, y: 20, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, flying: true };
  stepPhysics(empty, isSolid, s, { mx: 0, mz: 0, jump: true, descend: false }, 1 / 60, cfg);
  ok(s.vy > 0, '飞行 jump 上升');
  stepPhysics(empty, isSolid, s, { mx: 0, mz: 0, jump: false, descend: true }, 1 / 60, cfg);
  ok(s.vy < 0, '飞行 descend 下降');
}

console.log('=================================');
console.log(`通过 ${pass} · 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('M6 raycast/physics 单测全绿 ✓');
