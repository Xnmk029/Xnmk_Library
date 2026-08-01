// VOXY CRAFT — 贪婪网格化单元测试（测试 THREE-free 纯核 buildMeshData）
// 运行：node test/mesher.test.mjs
import { Chunk, S } from '../src/world/chunk.js';
import { buildMeshData } from '../src/mesh/mesherCore.js';
import { blockByName } from '../src/data/registry.js';

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('  ✗ FAIL: ' + msg); } }

const STONE = blockByName('石头').id;

// 由 chunk 构造 vAt（外部视为空气）
function vAtOf(chunk) {
  const d = chunk.data;
  return (x, y, z) => (x >= 0 && x < S && y >= 0 && y < S && z >= 0 && z < S) ? d[x + z * S + y * S * S] : 0;
}
function mesh(chunk) { return buildMeshData(vAtOf(chunk)); }

console.log('== 贪婪合并：10×10 同色平面 → 2 三角形 ==');
{
  const c = new Chunk(0, 0, 0);
  for (let x = 3; x <= 12; x++) for (let z = 3; z <= 12; z++) c.set(x, 5, z, STONE);
  const md = mesh(c);
  const py = md.faces[2];
  ok(py && py.count === 6, `10×10 顶面贪婪合并为 1 矩形 = 6 顶点 (实测 ${py ? py.count : 0})`);
}

console.log('== 贪婪合并：4×4 均匀平面 → 2 三角形 ==');
{
  const c = new Chunk(0, 0, 0);
  for (let x = 6; x <= 9; x++) for (let z = 6; z <= 9; z++) c.set(x, 5, z, STONE);
  const py = mesh(c).faces[2];
  ok(py && py.count === 6, `4×4 均匀顶面 = 6 顶点 (实测 ${py ? py.count : 0})`);
}

console.log('== AO 边界打断贪婪合并 ==');
{
  const c = new Chunk(0, 0, 0);
  for (let x = 6; x <= 9; x++) for (let z = 6; z <= 9; z++) c.set(x, 5, z, STONE);
  for (let x = 5; x <= 10; x++) { c.set(x, 6, 5, STONE); c.set(x, 6, 10, STONE); }
  for (let z = 5; z <= 10; z++) { c.set(5, 6, z, STONE); c.set(10, 6, z, STONE); }
  const py = mesh(c).faces[2];
  ok(py && py.count > 6, `AO 差异使顶面分裂为多矩形 > 6 顶点 (实测 ${py ? py.count : 0})`);
}

console.log('== 不同 tile 不合并 ==');
{
  const c = new Chunk(0, 0, 0);
  const GRASS = blockByName('草方块').id;
  for (let x = 6; x <= 9; x++) for (let z = 6; z <= 9; z++) c.set(x, 5, z, STONE);
  c.set(7, 5, 7, GRASS);
  const py = mesh(c).faces[2];
  ok(py && py.count > 6, `不同 tile 打断合并 > 6 顶点 (实测 ${py ? py.count : 0})`);
}

console.log('== 面剔除：被遮挡面零顶点 ==');
{
  const c = new Chunk(0, 0, 0);
  for (let x = 6; x <= 8; x++) for (let y = 5; y <= 7; y++) for (let z = 6; z <= 8; z++) c.set(x, y, z, STONE);
  const md = mesh(c);
  ok(md.tris === 12, `3×3×3 实心立方体 = 12 三角形 (6 面各 1 矩形) (实测 ${md.tris})`);
}

console.log('== 顶点压缩属性 ==');
{
  const c = new Chunk(0, 0, 0);
  for (let x = 6; x <= 9; x++) for (let z = 6; z <= 9; z++) c.set(x, 5, z, STONE);
  const g = mesh(c).faces[2];
  ok(g.pos instanceof Uint8Array, 'position 为 Uint8（压缩）');
  ok(g.tile instanceof Uint16Array, 'aTile 为 Uint16');
  ok(g.dir instanceof Uint8Array, 'aDir 为 Uint8');
  ok(g.ao instanceof Uint8Array, 'aAO 为 Uint8');
  console.log('  [info] 每顶点字节 ≈ 9B (position3+dir1+ao1+tile2+uv2)');
}

console.log('=================================');
console.log(`通过 ${pass} · 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('M3 网格化单测全绿 ✓');
