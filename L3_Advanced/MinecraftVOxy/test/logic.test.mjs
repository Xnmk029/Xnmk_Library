// VOXY CRAFT — 纯逻辑单元测试（node 直接跑 src ESM）
// 运行：node test/logic.test.mjs
import { mulberry32, hash1, hash2, hash3, randInt } from '../src/math/rng.js';
import { Perlin } from '../src/math/noise.js';
import { Chunk, idx, S, CHUNK_VOL } from '../src/world/chunk.js';
import { World, chunkKey } from '../src/world/world.js';
import { BLOCKS, ITEMS, AIR, isSolid, isOpaque, countKinds, blockByName } from '../src/data/registry.js';

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; /* console.log('  ✓ ' + msg); */ }
  else { fail++; console.error('  ✗ FAIL: ' + msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (got ${a}, want ${b})`); }

console.log('== rng 确定性 ==');
{
  const r1 = mulberry32(12345), r2 = mulberry32(12345), r3 = mulberry32(999);
  let same = true;
  for (let i = 0; i < 1000; i++) if (r1() !== r2()) same = false;
  ok(same, '同 seed 序列逐位一致');
  const a = mulberry32(1)(), b = mulberry32(2)();
  ok(a !== b, '不同 seed 输出不同');
  let inRange = true;
  const rr = mulberry32(7);
  for (let i = 0; i < 10000; i++) { const v = rr(); if (v < 0 || v >= 1) inRange = false; }
  ok(inRange, 'mulberry32 ∈ [0,1)');
  ok(hash2(3, 5, 42) === hash2(3, 5, 42), 'hash2 确定性');
  ok(hash3(1, 2, 3, 42) === hash3(1, 2, 3, 42), 'hash3 确定性');
  ok(hash2(3, 5, 42) !== hash2(5, 3, 42), 'hash2 坐标有序');
  let hRange = true;
  for (let i = 0; i < 5000; i++) { const v = hash3(i, i * 2, i * 3, 1); if (v < 0 || v >= 1) hRange = false; }
  ok(hRange, 'hash3 ∈ [0,1)');
  const ri = randInt(mulberry32(1), 5, 10);
  ok(ri >= 5 && ri <= 10, 'randInt 范围内');
}

console.log('== noise 确定性 ==');
{
  const p1 = new Perlin(2024), p2 = new Perlin(2024), p3 = new Perlin(7);
  ok(p1.noise2(1.5, 2.5) === p2.noise2(1.5, 2.5), 'Perlin2 同 seed 一致');
  ok(p1.noise3(1.5, 2.5, 3.5) === p2.noise3(1.5, 2.5, 3.5), 'Perlin3 同 seed 一致');
  ok(p1.noise2(1.5, 2.5) !== p3.noise2(1.5, 2.5), 'Perlin2 异 seed 不同');
  let n2range = true, n3range = true;
  for (let i = 0; i < 20000; i++) {
    const x = (i * 0.137) % 100, z = (i * 0.291) % 100;
    const v2 = p1.noise2(x, z), v3 = p1.noise3(x, z, x * 0.5);
    if (v2 < -1.01 || v2 > 1.01) n2range = false;
    if (v3 < -1.01 || v3 > 1.01) n3range = false;
  }
  ok(n2range, 'noise2 ∈ [-1,1]');
  ok(n3range, 'noise3 ∈ [-1,1]');
  const f = p1.fbm2(10, 10, 6);
  ok(f >= -1.01 && f <= 1.01, 'fbm2 ∈ [-1,1]');
  // 整数格点处 Perlin 应为 0（梯度点）
  ok(Math.abs(p1.noise2(3, 4)) < 1e-9, 'noise2 格点为 0');
}

console.log('== chunk 数据 ==');
{
  const c = new Chunk(0, 0, 0);
  eq(c.data.length, CHUNK_VOL, 'chunk 体积 4096');
  eq(idx(0, 0, 0), 0, 'idx(0,0,0)=0');
  eq(idx(S - 1, S - 1, S - 1), CHUNK_VOL - 1, 'idx 末端');
  c.set(3, 7, 5, 42);
  eq(c.get(3, 7, 5), 42, 'set/get 一致');
  ok(c.dirty, 'set 后 dirty');
}

console.log('== world get/set + 跨 chunk + 覆盖层 ==');
{
  const w = new World(1337);
  // 无生成器时 ensureChunk 得到空 chunk
  const c = w.ensureChunk(0, 0, 0);
  eq(w.getBlock(0, 0, 0), 0, '空世界 getBlock=0(air)');
  w.setBlock(2, 3, 4, 9);
  eq(w.getBlock(2, 3, 4), 9, 'set/get 一致');
  eq(w.overrides.size, 1, '覆盖层记录 1 条');
  // 跨 chunk 边界：x=16 属于 chunk(1,0,0)
  w.ensureChunk(1, 0, 0);
  w.setBlock(16, 3, 4, 11);
  eq(w.getBlock(16, 3, 4), 11, '跨 chunk set/get');
  eq(w.getChunk(1, 0, 0).get(0, 3, 4), 11, '本地坐标换算正确');
  // 负坐标
  w.ensureChunk(-1, 0, 0);
  w.setBlock(-1, 3, 4, 13);
  eq(w.getBlock(-1, 3, 4), 13, '负坐标 set/get');
  eq(w.getChunk(-1, 0, 0).get(S - 1, 3, 4), 13, '负坐标本地换算');
  // 边界改动标记相邻 dirty
  w.getChunk(0, 0, 0).dirty = false;
  w.getChunk(1, 0, 0).dirty = false;
  w.setBlock(15, 3, 4, 20); // x=15 是 chunk0 的 +X 边界
  ok(w.getChunk(1, 0, 0).dirty, '边界改动标记相邻 chunk dirty');
  // 覆盖层在新建 chunk 时重放
  const w2 = new World(1337);
  w2.overrides.set('5,5,5', 77);
  const cc = w2.ensureChunk(0, 0, 0);
  eq(cc.get(5, 5, 5), 77, '覆盖层在生成时重放');
}

console.log('== registry ==');
{
  eq(AIR, 0, 'AIR=0');
  ok(BLOCKS.length > 100, `方块数 >100 (实际 ${BLOCKS.length})`);
  ok(BLOCKS.length < 256, `方块数 <256 可用 Uint8 (实际 ${BLOCKS.length})`);
  ok(ITEMS.length > 80, `物品条目 >80 (实际 ${ITEMS.length})`);
  const kinds = countKinds();
  ok(kinds >= 80, `物品种类(染色算一种) ≥80 (实际 ${kinds})`);
  ok(isSolid(blockByName('石头').id), '石头实心');
  ok(!isSolid(blockByName('水').id), '水非实心');
  ok(!isOpaque(blockByName('玻璃').id), '玻璃非不透明');
  ok(isOpaque(blockByName('泥土').id), '泥土不透明');
  // 草方块多面材质
  const grass = blockByName('草方块');
  ok(grass.tile.top === 'grass_top' && grass.tile.side === 'grass_side', '草方块多面 tile');
  console.log(`  [info] 方块 ${BLOCKS.length} 种 / 物品条目 ${ITEMS.length} / 种类(染色算一种) ${kinds}`);
}

console.log('=================================');
console.log(`通过 ${pass} · 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('M1 单测全绿 ✓');
