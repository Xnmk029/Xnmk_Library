/**
 * tools/check-field.mjs — PCG 场域体检（Node 端，无需浏览器）
 * ---------------------------------------------------------------------------
 * 直接在 Node 里跑程序化生成的规则层，验证"无限世界"的健康度与几何连贯性规则：
 *   R1 墙体不悬空   R2 柱子顶天立地   R3 池边/池深量化对齐
 *   R4 平台必配可行走楼梯            R5 深水墙自动开口（池体连通）
 * 用法：node tools/check-field.mjs [seed] [halfCells]
 */
import { Field, KIND, columnScale } from '../src/gen/Field.js';
import { WORLD } from '../src/config.js';

const seed = Number(process.argv[2] ?? 20240517);
const half = Number(process.argv[3] ?? 60);
const f = new Field(seed);

const s = f.survey(half);
const pct = (v) => (v * 100).toFixed(1) + '%';
console.log(`=== 场域体检  seed=${seed}  范围=${half * 2 + 1}² 格 (${((half * 2 + 1) * WORLD.cell).toFixed(0)}m 见方) ===`);
console.log('构成:', Object.fromEntries(Object.entries(s.counts).map(([k, v]) => [k, k.match(/columns|skylights|windows/) ? v : pct(v / s.total)])));
console.log(`水域 ${pct(s.waterRatio)} | 墙体 ${pct(s.wallRatio)} | 平均水深 ${s.avgDepth.toFixed(2)}m | 最深 ${s.maxDepth.toFixed(2)}m`);
console.log('出生点:', JSON.stringify(f.findSpawn()));

let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fail++;
};

// ── 纯函数一致性：任意顺序/任意次采样必须完全相同（chunk 无缝的根本） ──
const snapA = JSON.stringify(f.cell(37, -91));
for (let i = 0; i < 500; i++) f.cell(((i * 7919) % 400) - 200, ((i * 104729) % 400) - 200);
check('纯函数场一致性（乱序重采样）', snapA === JSON.stringify(f.cell(37, -91)));

// ── 规则扫描 ──
let wallFloating = 0, colBad = 0, stairIsolated = 0, stairCount = 0, tierUnaligned = 0, deepWallBlocked = 0;
for (let cz = -half; cz <= half; cz++) {
  for (let cx = -half; cx <= half; cx++) {
    const c = f.cell(cx, cz);
    if (c.wall && c.wallTop <= c.floorY) wallFloating++;
    if (c.water) {
      const q = (WORLD.waterY - c.floorY) / WORLD.tierStep;
      const isTier = Math.abs(q - Math.round(q)) < 1e-6;
      const isShallow = Math.abs(c.waterDepth - WORLD.shallowDepth) < 1e-6;
      if (!isTier && !isShallow) tierUnaligned++;
      if (c.waterDepth > 1.6 && c.wall) deepWallBlocked++;
    }
    const col = f.columnAt(cx, cz, c);
    if (col.present && (c.wall || c.waterDepth > 1.2)) colBad++;
    if (c.kind === KIND.STAIR) {
      stairCount++;
      const nb = [f.cell(cx + 1, cz).floorY, f.cell(cx - 1, cz).floorY, f.cell(cx, cz + 1).floorY, f.cell(cx, cz - 1).floorY];
      if (!nb.some((h) => Math.abs(h - c.floorY) <= WORLD.stairRise + 1e-6)) stairIsolated++;
    }
  }
}
check('R1 墙体扎在实体地板上', wallFloating === 0, `异常 ${wallFloating}`);
check('R2 柱子不在墙里/深水里', colBad === 0, `异常 ${colBad}`);
check('R3 池深量化对齐 tierStep', tierUnaligned === 0, `异常 ${tierUnaligned}`);
check('R4 楼梯与邻格高差 ≤ stairRise', stairIsolated === 0, `楼梯 ${stairCount} 格，孤立 ${stairIsolated}`);
check('R5 深水处墙体自动开口', deepWallBlocked === 0, `异常 ${deepWallBlocked}`);
check('世界不是空的（水域 3%~60%）', s.waterRatio > 0.03 && s.waterRatio < 0.6, pct(s.waterRatio));
check('墙体不过密（< 22%）', s.wallRatio < 0.22, pct(s.wallRatio));
check('柱子/天窗/窗户都有生成', s.counts.columns > 20 && s.counts.skylights > 5 && s.counts.windows > 5);

// ── 多 seed 稳健性 ──
let seedFail = 0;
for (const sd of [1, 7, 99, 4242, 987654]) {
  const g = new Field(sd);
  const r = g.survey(28);
  const ok = r.waterRatio > 0.02 && r.waterRatio < 0.7 && r.wallRatio < 0.3 && r.counts.columns > 3;
  if (!ok) { seedFail++; console.log(`   seed ${sd} 异常:`, JSON.stringify(r)); }
}
check('多 seed 稳健（1/7/99/4242/987654）', seedFail === 0);

// ── 柱子：渲染缩放与碰撞半宽必须一致（防"被空气挡住 / 穿进柱子"漂移）──
{
  let tested = 0, tooBig = 0, tooSmall = 0;
  for (let cz = -half; cz <= half && tested < 40; cz++) {
    for (let cx = -half; cx <= half && tested < 40; cx++) {
      const c = f.cell(cx, cz);
      const col = f.columnAt(cx, cz, c);
      if (!col.present) continue;
      tested++;
      const centerX = (cx + 0.5) * WORLD.cell, centerZ = (cz + 0.5) * WORLD.cell;
      const visualHalf = columnScale(col.footprint) * 0.5;   // 几何横截面 ±0.5 × 实例缩放
      const y = c.floorY + 1.0;
      // 柱心必须是实体
      if (!f.isSolid(centerX, y, centerZ)) tooSmall++;
      // 柱体外 15cm 处必须是空的（否则就是看不见的碰撞墙）
      if (f.isSolid(centerX + visualHalf + 0.15, y, centerZ)) tooBig++;
    }
  }
  check('柱子碰撞盒 = 视觉尺寸（抽查 40 根）', tooBig === 0 && tooSmall === 0,
    `抽查 ${tested} 根，偏大 ${tooBig}，偏小 ${tooSmall}`);
}

// ── 性能：单格解析成本（决定 chunk 生成预算） ──
const t0 = performance.now();
let acc = 0;
for (let i = 0; i < 200000; i++) acc += f.cell((i % 900) - 450, ((i * 31) % 900) - 450).floorY;
const t1 = performance.now();
const perCell = (t1 - t0) / 200000;
console.log(`cell() 成本 ${(perCell * 1000).toFixed(2)} µs/格  →  一个 ${WORLD.chunkCells}² chunk 的场域解析约 ${(perCell * WORLD.chunkCells ** 2).toFixed(2)} ms  (acc=${acc.toFixed(0)})`);
check('单 chunk 场域解析 < 3ms', perCell * WORLD.chunkCells ** 2 < 3);

console.log(fail === 0 ? '\n全部通过 ✅' : `\n${fail} 项失败 ❌`);
process.exit(fail === 0 ? 0 : 1);
