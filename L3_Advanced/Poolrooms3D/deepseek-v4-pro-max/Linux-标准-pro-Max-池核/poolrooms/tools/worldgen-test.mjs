// worldgen-test.mjs — verification + ASCII visualiser for WorldGen.js.
// Run: node tools/worldgen-test.mjs
//
// Checks: determinism, bounds, validity/budgets/timing, cross-chunk doorway
// agreement, walkability (flood fill over a 3x3 chunk area), and prints ASCII
// maps per archetype plus the archetype distribution over a 20x20 area.

import {
  generateChunk,
  CHUNK, DECK_Y, CEIL_Y,
  chunkKey, worldToChunk,
} from '../src/world/WorldGen.js';

const SEED = 1337;
const ALLOWED_MATS = new Set([
  'deckTile', 'wallTile', 'poolTile', 'poolTileDeep', 'concrete', 'plaster', 'coping', 'metal',
]);

let failures = 0;
let checks = 0;
function assert(cond, msg) {
  checks++;
  if (!cond) { console.error('  FAIL: ' + msg); failures++; }
}
function ok(msg) { console.log('  ok  ' + msg); }

// Fraction of a chunk's 32x32 ceiling that is open to the sky (skylight holes),
// measured by rasterising 0.25 m samples and checking for a ceiling slab above
// (a box with min[1] >= CEIL_Y-0.01 — beams and curbs are lower and excluded).
function skylightFraction(chunk) {
  const step = 0.25;
  const lo = chunk.cx * CHUNK, lz = chunk.cz * CHUNK;
  let open = 0, total = 0;
  for (let gx = lo; gx < lo + CHUNK; gx += step) {
    for (let gz = lz; gz < lz + CHUNK; gz += step) {
      total++;
      let covered = false;
      for (const b of chunk.boxes) {
        if (b.min[1] >= CEIL_Y - 0.01 && gx >= b.min[0] && gx < b.max[0] && gz >= b.min[2] && gz < b.max[2]) {
          covered = true; break;
        }
      }
      if (!covered) open++;
    }
  }
  return open / total;
}

// ---------------------------------------------------------------------------
// 1. Determinism
// ---------------------------------------------------------------------------
console.log('\n== 1. Determinism ==');
{
  const a = generateChunk(3, -2, SEED);
  const b = generateChunk(3, -2, SEED);
  assert(JSON.stringify(a) === JSON.stringify(b), 'generateChunk(3,-2) twice -> identical JSON');

  const fwd = [], rev = [];
  for (let cz = 0; cz < 5; cz++) for (let cx = 0; cx < 5; cx++) fwd.push(generateChunk(cx, cz, SEED));
  for (let cz = 4; cz >= 0; cz--) for (let cx = 4; cx >= 0; cx--) rev.push(generateChunk(cx, cz, SEED));
  let same = true;
  const revMap = new Map(rev.map((c) => [chunkKey(c.cx, c.cz), c]));
  for (const c of fwd) {
    if (JSON.stringify(c) !== JSON.stringify(revMap.get(chunkKey(c.cx, c.cz)))) { same = false; break; }
  }
  assert(same, '5x5 grid forward vs reverse -> identical results');
  ok('determinism');
}

// ---------------------------------------------------------------------------
// 2/3. Bounds + validity + budgets + timing over a 20x20 area
// ---------------------------------------------------------------------------
console.log('\n== 2/3. Bounds, validity, budgets, timing ==');
{
  const N = 20;
  // Warm up the JIT so cold-start compilation isn't charged to generation time.
  for (let i = 0; i < 400; i++) generateChunk(i % 17, (i * 5) % 17, SEED);
  // Dedicated timing pass (no other work interleaved, so GC/measurement noise
  // from the rasterisation below can't spike a generation time).
  const genTimes = [];
  for (let cz = 0; cz < N; cz++) {
    for (let cx = 0; cx < N; cx++) {
      const t0 = performance.now();
      generateChunk(cx, cz, SEED);
      genTimes.push(performance.now() - t0);
    }
  }

  let boxCounts = [];
  let archCounts = {};
  let skyFracs = [];
  let totalClerestory = 0, chunksWithClerestory = 0;
  const all = [];
  for (let cz = 0; cz < N; cz++) {
    for (let cx = 0; cx < N; cx++) {
      const c = generateChunk(cx, cz, SEED);
      boxCounts.push(c.boxes.length);
      archCounts[c.archetype] = (archCounts[c.archetype] || 0) + 1;
      all.push(c);

      // bounds
      const lo = c.cx * CHUNK, hi = c.cx * CHUNK + CHUNK;
      const lz = c.cz * CHUNK, hz = c.cz * CHUNK + CHUNK;
      for (const b of c.boxes) {
        const tol = 0.02;
        if (b.min[0] < lo - tol || b.max[0] > hi + tol ||
            b.min[2] < lz - tol || b.max[2] > hz + tol) {
          assert(false, `box out of bounds in chunk (${c.cx},${c.cz})`);
          break;
        }
      }
      for (const w of c.waters) {
        const tol = 0.02;
        if (w.x0 < lo - tol || w.x1 > hi + tol || w.z0 < lz - tol || w.z1 > hz + tol) {
          assert(false, `water out of bounds in chunk (${c.cx},${c.cz})`);
        }
        assert(w.x1 > w.x0 && w.z1 > w.z0, 'water rect has positive area');
      }

      // validity
      for (const b of c.boxes) {
        for (const k of [0, 1, 2]) {
          if (!Number.isFinite(b.min[k]) || !Number.isFinite(b.max[k])) {
            assert(false, `non-finite coord in chunk (${c.cx},${c.cz})`);
          }
          if (!(b.max[k] > b.min[k])) assert(false, `max > min violated in chunk (${c.cx},${c.cz})`);
        }
        assert(ALLOWED_MATS.has(b.mat), `bad mat '${b.mat}'`);
        if (b.skip) {
          assert(Array.isArray(b.skip) && b.skip.every((s) => ['+x','-x','+y','-y','+z','-z'].includes(s)), 'bad skip face');
        }
      }
      assert(c.boxes.length <= 420, '<= 420 boxes');
      assert(c.waters.length <= 6, '<= 6 waters');
      assert(c.lights.length <= 4, '<= 4 lights');
      assert(c.props.length <= 30, '<= 30 props');
      for (const L of c.lights) {
        assert(Number.isFinite(L.intensity) && Number.isFinite(L.distance), 'light numeric fields');
        assert(L.color.length === 3 && L.color.every((v) => v >= 0 && v <= 1), 'light color 0..1');
      }
      for (const w of c.waters) {
        assert(['deep', 'shallow', 'trough'].includes(w.kind), `bad water kind '${w.kind}'`);
        assert(w.surface > w.bottom, 'water surface > bottom');
      }
    }
  }

  // Clerestory + daylight checks in a separate pass (rasterisation is heavy).
  for (const c of all) {
    let cler = 0;
    for (const b of c.boxes) {
      if (b.mat !== 'wallTile') continue;
      if (b.min[1] > 0.01 && b.min[1] < 2.5 - 0.01) {
        assert(false, `wall segment gap dips below 2.5 m in chunk (${c.cx},${c.cz})`);
      }
      if (b.min[1] >= 2.5 - 0.01) cler++;
    }
    totalClerestory += cler;
    if (cler > 0) chunksWithClerestory++;

    const skyFrac = skylightFraction(c);
    skyFracs.push(skyFrac);
    assert(skyFrac >= 0.15 - 0.02 && skyFrac <= 0.25 + 0.02,
      `skylight area ${(100 * skyFrac).toFixed(1)}% out of 15-25% in chunk (${c.cx},${c.cz})`);
  }
  boxCounts.sort((a, b) => a - b);
  genTimes.sort((a, b) => a - b);
  skyFracs.sort((a, b) => a - b);
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const min = arr => arr[0], max = arr => arr[arr.length - 1], avg = arr => sum(arr) / arr.length;
  console.log(`  boxes: min=${min(boxCounts)} avg=${avg(boxCounts).toFixed(1)} max=${max(boxCounts)}`);
  console.log(`  gen time: min=${min(genTimes).toFixed(3)}ms avg=${avg(genTimes).toFixed(3)}ms max=${max(genTimes).toFixed(3)}ms`);
  const skyAvg = skyFracs.reduce((a, b) => a + b, 0) / skyFracs.length;
  console.log(`  skylight area: min=${(min(skyFracs) * 100).toFixed(1)}% avg=${(skyAvg * 100).toFixed(1)}% max=${(max(skyFracs) * 100).toFixed(1)}%`);
  console.log(`  clerestory: ${chunksWithClerestory}/${N * N} chunks, ${totalClerestory} slots`);
  assert(max(genTimes) < 4.0, 'per-chunk generation < 4 ms (max observed)');
  assert(avg(boxCounts) >= 180, 'average box count >= 180 (architectural detail target 200-320)');
  assert(avg(genTimes) < 1.0, 'average generation < 1 ms');
  assert(chunksWithClerestory > 0, 'clerestory slots present somewhere in the distribution');
  ok('bounds + validity + budgets');
}

// ---------------------------------------------------------------------------
// 4. Border agreement over a 6x6 grid
// ---------------------------------------------------------------------------
console.log('\n== 4. Border agreement ==');
{
  const N = 6;
  const grid = new Map();
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) grid.set(chunkKey(cx, cz), generateChunk(cx, cz, SEED));

  const blockedByWall = (chunk, x, y, z) => {
    for (const b of chunk.boxes) {
      if (b.mat !== 'wallTile') continue;
      if (x >= b.min[0] && x <= b.max[0] && y >= b.min[1] && y <= b.max[1] && z >= b.min[2] && z <= b.max[2]) return true;
    }
    return false;
  };

  const YS = [0.3, 1.2, 2.0, 2.3];
  let minOpen = Infinity;
  let pairs = 0;
  for (let cz = 0; cz < N; cz++) {
    for (let cx = 0; cx < N; cx++) {
      // +x neighbour
      if (cx + 1 < N) {
        const A = grid.get(chunkKey(cx, cz)), B = grid.get(chunkKey(cx + 1, cz));
        const xb = (cx + 1) * CHUNK;
        for (let z = cz * CHUNK; z <= cz * CHUNK + CHUNK; z += 0.1) {
          for (const y of YS) {
            const bA = blockedByWall(A, xb - 0.01, y, z);
            const bB = blockedByWall(B, xb + 0.01, y, z);
            assert(bA === bB, `+x doorway mismatch at (${cx},${cz}) z=${z.toFixed(1)} y=${y}`);
          }
        }
        // contiguous open run along the border
        let run = 0, best = 0;
        for (let z = cz * CHUNK; z <= cz * CHUNK + CHUNK; z += 0.1) {
          const open = YS.every((y) => !blockedByWall(A, xb - 0.01, y, z));
          if (open) { run += 0.1; best = Math.max(best, run); } else run = 0;
        }
        minOpen = Math.min(minOpen, best);
        pairs++;
      }
      // +z neighbour
      if (cz + 1 < N) {
        const A = grid.get(chunkKey(cx, cz)), B = grid.get(chunkKey(cx, cz + 1));
        const zb = (cz + 1) * CHUNK;
        for (let x = cx * CHUNK; x <= cx * CHUNK + CHUNK; x += 0.1) {
          for (const y of YS) {
            const bA = blockedByWall(A, x, y, zb - 0.01);
            const bB = blockedByWall(B, x, y, zb + 0.01);
            assert(bA === bB, `+z doorway mismatch at (${cx},${cz}) x=${x.toFixed(1)} y=${y}`);
          }
        }
        let run = 0, best = 0;
        for (let x = cx * CHUNK; x <= cx * CHUNK + CHUNK; x += 0.1) {
          const open = YS.every((y) => !blockedByWall(A, x, y, zb - 0.01));
          if (open) { run += 0.1; best = Math.max(best, run); } else run = 0;
        }
        minOpen = Math.min(minOpen, best);
        pairs++;
      }
    }
  }
  console.log(`  checked ${pairs} adjacent pairs, min contiguous doorway opening = ${minOpen.toFixed(1)} m`);
  assert(minOpen >= 2.0, 'every shared border has a >= 2.0 m contiguous doorway opening');
  ok('border agreement');
}

// ---------------------------------------------------------------------------
// 5. Walkability / no traps (flood fill over a 3x3 chunk area)
// ---------------------------------------------------------------------------
console.log('\n== 5. Walkability / no traps ==');
{
  const COORDS = [-1, 0, 1];
  const chunks = new Map();
  let boxes = [], waters = [];
  for (const cz of COORDS) for (const cx of COORDS) {
    const c = generateChunk(cx, cz, SEED);
    chunks.set(chunkKey(cx, cz), c);
    for (const b of c.boxes) if (b.collide) boxes.push(b);
    for (const w of c.waters) waters.push(w);
  }
  const worldMinX = -CHUNK, worldMinZ = -CHUNK;
  const worldMaxX = 2 * CHUNK, worldMaxZ = 2 * CHUNK;

  // Stand height for a point: highest collide surface with body clearance and
  // submergence <= 1.2 m (wadeable). Returns null when not standable.
  // MAX_STAND caps the candidate height: the tallest legitimate walkable surface
  // in this generator is the 2.8 m atrium mezzanine, while ceilings/lintels sit
  // at >= 5.0 m — so 3.2 m cleanly separates floors from roofs.
  const MAX_STAND = 3.2;
  const standHeight = (gx, gz) => {
    let surface = null;
    for (const w of waters) {
      if (gx >= w.x0 && gx <= w.x1 && gz >= w.z0 && gz <= w.z1) { surface = w.surface; break; }
    }
    let best = null;
    for (const b of boxes) {
      if (gx < b.min[0] || gx > b.max[0] || gz < b.min[2] || gz > b.max[2]) continue;
      const top = b.max[1];
      if (top > MAX_STAND) continue;
      const sub = surface != null && surface > top ? surface - top : 0;
      if (sub > 1.2 + 1e-6) continue;
      if (best === null || top > best) best = top;
    }
    if (best === null) return null;
    for (const b of boxes) {
      if (gx < b.min[0] || gx > b.max[0] || gz < b.min[2] || gz > b.max[2]) continue;
      if (b.min[1] < best + 1.8 && b.max[1] > best + 1e-6) return null; // body blocked
    }
    return best;
  };

  const CELL = 0.4;
  const W = Math.round((worldMaxX - worldMinX) / CELL);
  const H = Math.round((worldMaxZ - worldMinZ) / CELL);
  const h = new Float64Array(W * H);
  for (let j = 0; j < H; j++) {
    const gz = worldMinZ + j * CELL + CELL / 2;
    for (let i = 0; i < W; i++) {
      const gx = worldMinX + i * CELL + CELL / 2;
      const v = standHeight(gx, gz);
      h[j * W + i] = v === null ? NaN : v;
    }
  }
  const walkableCount = h.reduce((a, v) => a + (Number.isNaN(v) ? 0 : 1), 0);

  const cellIdx = (x, z) => {
    const i = Math.floor((x - worldMinX) / CELL);
    const j = Math.floor((z - worldMinZ) / CELL);
    return j * W + i;
  };

  const STEP = 0.45 + 1e-6;
  const flood = (startIdx) => {
    const reached = new Uint8Array(W * H);
    const stack = [startIdx];
    reached[startIdx] = 1;
    let count = 0;
    while (stack.length) {
      const idx = stack.pop();
      count++;
      const i = idx % W, j = (idx / W) | 0;
      const h0 = h[idx];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || ni >= W || nj < 0 || nj >= H) continue;
        const nidx = nj * W + ni;
        if (reached[nidx]) continue;
        if (Number.isNaN(h[nidx])) continue;
        if (Math.abs(h[nidx] - h0) <= STEP) { reached[nidx] = 1; stack.push(nidx); }
      }
    }
    return { reached, count };
  };

  // Spawns of all 9 chunks.
  const spawnCells = [];
  for (const cz of COORDS) for (const cx of COORDS) {
    const c = chunks.get(chunkKey(cx, cz));
    assert(c.spawn !== null, `spawn present in (${cx},${cz})`);
    if (c.spawn) spawnCells.push({ cx, cz, idx: cellIdx(c.spawn[0], c.spawn[2]) });
  }
  const f0 = flood(spawnCells[0].idx);
  let allReachable = true;
  for (const s of spawnCells) {
    if (!f0.reached[s.idx]) { allReachable = false; assert(false, `spawn (${s.cx},${s.cz}) not reachable`); }
  }
  assert(allReachable, 'all 9 spawns mutually reachable');

  // Doorway interior points of the centre chunk.
  const centre = chunks.get(chunkKey(0, 0));
  const blockedByWallC = (x, y, z) => {
    for (const b of centre.boxes) {
      if (b.mat !== 'wallTile') continue;
      if (x >= b.min[0] && x <= b.max[0] && y >= b.min[1] && y <= b.max[1] && z >= b.min[2] && z <= b.max[2]) return true;
    }
    return false;
  };
  const doorwayPts = [];
  const edges = [['x', -1], ['x', +1], ['z', -1], ['z', +1]];
  for (const [axis, side] of edges) {
    let run = null, best = null, bestLen = 0;
    for (let t = 0; t <= CHUNK; t += 0.1) {
      let blocked;
      if (axis === 'x') blocked = blockedByWallC(side === 1 ? CHUNK - 0.01 : 0.01, 1.2, t);
      else blocked = blockedByWallC(t, 1.2, side === 1 ? CHUNK - 0.01 : 0.01);
      const end = t >= CHUNK - 0.05;
      if (!blocked && run === null) run = t;
      if ((blocked || end) && run !== null) {
        const len = t - run;
        if (len > bestLen) { bestLen = len; best = (run + t) / 2; }
        run = null;
      }
    }
    if (best !== null) {
      if (axis === 'x') doorwayPts.push({ x: side === 1 ? CHUNK - 1.0 : 1.0, z: best });
      else doorwayPts.push({ x: best, z: side === 1 ? CHUNK - 1.0 : 1.0 });
    }
  }
  assert(doorwayPts.length === 4, 'centre chunk has 4 doorways');
  const fc = flood(spawnCells[4].idx); // centre spawn
  let doorsReachable = true;
  for (const d of doorwayPts) {
    const idx = cellIdx(d.x, d.z);
    if (!fc.reached[idx]) { doorsReachable = false; assert(false, `doorway at (${d.x.toFixed(1)},${d.z.toFixed(1)}) unreachable`); }
  }
  assert(doorsReachable, 'all 4 centre doorways reachable');

  console.log(`  walkable cells: ${walkableCount}/${W * H} = ${(100 * walkableCount / (W * H)).toFixed(1)}%`);
  console.log(`  reachable cells from spawn(-1,-1): ${f0.count} (${(100 * f0.count / walkableCount).toFixed(1)}% of walkable)`);
  ok('walkability');
}

// ---------------------------------------------------------------------------
// 6. ASCII maps + archetype distribution
// ---------------------------------------------------------------------------
console.log('\n== 6. ASCII maps ==');

function sampleChar(chunk, lx, lz) {
  // Footprint-based sampling: each 1x1 m cell is checked for overlap with boxes
  // and water, so thin walls / coping / columns still show up clearly.
  const x0 = chunk.cx * CHUNK + lx, x1 = x0 + 1;
  const z0 = chunk.cz * CHUNK + lz, z1 = z0 + 1;
  const overlap = (b) => b.min[0] < x1 && b.max[0] > x0 && b.min[2] < z1 && b.max[2] > z0;

  let water = null;
  for (const w of chunk.waters) {
    if (w.x0 < x1 && w.x1 > x0 && w.z0 < z1 && w.z1 > z0) { water = w; break; }
  }

  // Wall/column checks are height-aware: they must span player height (min<=1.0,
  // max>=2.0), so a soffit (2.4..2.6) or cornice (4.78..5.0) above head does not
  // read as a ground-level wall.
  for (const b of chunk.boxes) {
    if (b.mat === 'wallTile' && b.max[1] >= 2.0 && b.min[1] <= 1.0 && overlap(b)) return 'W';
  }
  // Wall articulation (pilasters, jambs): concrete, tall, thin, spans player height.
  for (const b of chunk.boxes) {
    const dx = b.max[0] - b.min[0], dz = b.max[2] - b.min[2];
    if (b.mat === 'concrete' && b.max[1] >= 2.0 && b.min[1] <= 1.0 && Math.min(dx, dz) < 0.4 && overlap(b)) return 'W';
  }
  // True freestanding columns: concrete, tall, roughly square, spans player height.
  for (const b of chunk.boxes) {
    const dx = b.max[0] - b.min[0], dz = b.max[2] - b.min[2];
    if (b.mat === 'concrete' && b.max[1] >= 2.0 && b.min[1] <= 1.0 && Math.min(dx, dz) >= 0.4 && overlap(b)) return 'O';
  }
  for (const b of chunk.boxes) if (b.mat === 'coping' && overlap(b)) return '+';
  for (const b of chunk.boxes) {
    // Terrain stairs are thin deckTile boxes; thin concrete/coping/metal trim
    // (gutters, nosings, scum gutters) is NOT stairs.
    if (b.mat === 'deckTile' && b.max[1] - b.min[1] <= 0.2 && b.max[1] > 0.001 && overlap(b)) return 'S';
  }
  for (const b of chunk.boxes) {
    if (b.max[1] > 0.5 && b.min[1] <= 0.5 && overlap(b)) return '=';
  }
  for (const b of chunk.boxes) if (b.mat === 'deckTile' && overlap(b)) return '.';
  if (water) return water.kind === 'deep' ? '#' : '~';
  return ' ';
}

function renderMap(chunk) {
  const lines = [];
  for (let lz = 0; lz < CHUNK; lz++) {
    let line = '';
    for (let lx = 0; lx < CHUNK; lx++) line += sampleChar(chunk, lx, lz);
    lines.push(line);
  }
  return lines;
}

{
  // Find one chunk per archetype (scan a 20x20 area).
  const N = 20;
  const byArch = new Map();
  const archCounts = {};
  const order = [];
  for (let cz = 0; cz < N; cz++) {
    for (let cx = 0; cx < N; cx++) {
      const c = generateChunk(cx, cz, SEED);
      archCounts[c.archetype] = (archCounts[c.archetype] || 0) + 1;
      if (!byArch.has(c.archetype)) { byArch.set(c.archetype, c); order.push(c.archetype); }
    }
  }
  console.log('  archetype distribution over 20x20:');
  for (const [a, n] of Object.entries(archCounts).sort((x, y) => y[1] - x[1])) {
    console.log(`    ${a.padEnd(15)} ${n}`);
  }
  console.log('');
  const legend = '  legend: . deck  ~ shallow  # deep  W wall  S stairs  = platform  O column  + coping';
  console.log(legend);
  console.log('');
  for (const a of order) {
    const c = byArch.get(a);
    console.log(`  [${a}] @ chunk (${c.cx},${c.cz})`);
    for (const line of renderMap(c)) console.log('  ' + line);
    console.log('');
  }
}

// ---------------------------------------------------------------------------
console.log('\n==============================================');
console.log(`checks run: ${checks}, failures: ${failures}`);
if (failures === 0) console.log('ALL ASSERTIONS PASSED');
else console.log(`${failures} ASSERTION(S) FAILED`);
console.log('==============================================');
process.exit(failures === 0 ? 0 : 1);
