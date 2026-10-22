/**
 * gen/ChunkBuilder.js — 分块装配器（纯数据，零 three 依赖）
 * ===========================================================================
 * 输入：Field（纯函数场）+ chunk 坐标 + chunk LOD 档
 * 输出：可直接喂给 InstancedMesh 的 Float32Array（矩阵 + 每实例元数据）
 *
 * ▍为什么"纯数据"很重要
 *   本文件不 import three，也不碰 GPU：因此 build() 可以整体搬到 Web Worker 里，
 *   主线程只负责 `new THREE.InstancedMesh` + 上传缓冲。当前实现用生成器
 *   （function*）在阶段之间 yield，让 ChunkManager 按帧预算切片执行，避免长卡顿。
 *
 * ▍关键优化：贪心矩形合并（greedy meshing）
 *   一个 20×20 格的 chunk 有 400 个地板格。逐格一个实例 = 400 实例。
 *   把"高度+湿滑度相同"的相邻格合并成矩形后，通常只剩 30~80 个实例，
 *   而且**顶点数不变**（都是同一个单位立方体几何）→ 一次 draw call 画完整块地形。
 *
 * ▍高度差自动成墙
 *   每个地板矩形都是从 solidBase 长到 floorY 的**实心盒子**。相邻矩形高度不同时，
 *   高的那个盒子的侧面天然成为瓷砖池壁 → 不需要生成任何侧墙几何，
 *   多层阶梯式池壁（tiered pool steps）也就免费获得了。
 */

import { WORLD } from '../config.js';
import { Field, KIND, ROOM, COLUMN, createCellData, columnScale } from './Field.js';
import { hash2 } from '../core/Noise.js';

/** chunk LOD 档：0 = 全细节，1 = 中，2 = 远景（只留结构） */
export const CHUNK_LOD = Object.freeze({ FULL: 0, MID: 1, FAR: 2 });

/** 结构材质类别（写进实例 meta.z，供 shader 做细微区分） */
const SURF = { FLOOR: 0, POOL: 1, WALL: 2, CEILING: 3, STAIR: 4 };

const BORDER = 2; // 采样时向外多取 2 格，用于邻居判定（湿滑扩散、栏杆、窗洞朝向）

/** 把 4×4 矩阵（平移 + 绕 Y 旋转 + 缩放）按 three 的列主序压进数组 */
function pushMatrix(arr, tx, ty, tz, sx, sy, sz, rotY = 0) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  arr.push(
    sx * c, 0, -sx * s, 0,
    0, sy, 0, 0,
    sz * s, 0, sz * c, 0,
    tx, ty, tz, 1,
  );
}

/**
 * 贪心矩形合并：把二维网格里 key 相同的相邻格并成矩形。
 * keys[i] === NaN 表示该格跳过。emit(x, z, w, d, key)
 */
function greedyRects(nx, nz, keys, emit) {
  const used = new Uint8Array(nx * nz);
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      const i = z * nx + x;
      if (used[i]) continue;
      const k = keys[i];
      if (Number.isNaN(k)) { used[i] = 1; continue; }
      // 先向 +X 扩
      let w = 1;
      while (x + w < nx && !used[i + w] && keys[i + w] === k) w++;
      // 再整行向 +Z 扩
      let d = 1;
      grow: while (z + d < nz) {
        const base = (z + d) * nx + x;
        for (let t = 0; t < w; t++) {
          if (used[base + t] || keys[base + t] !== k) break grow;
        }
        d++;
      }
      for (let dz = 0; dz < d; dz++) {
        const b = (z + dz) * nx + x;
        for (let dx = 0; dx < w; dx++) used[b + dx] = 1;
      }
      emit(x, z, w, d, k);
    }
  }
}

/** 量化两个浮点为一个可比较的数值 key */
const key2 = (a, b) => Math.round(a * 64) * 100000 + Math.round(b * 8);

export class ChunkBuilder {
  /** @param {Field} field */
  constructor(field) {
    this.field = field;
    this._cell = createCellData();
  }

  /**
   * 生成一个 chunk。这是**生成器**：在阶段之间 yield，供帧预算调度器切片。
   * @returns {Generator<void, ChunkData>}
   */
  *build(ci, cj, lodTier = CHUNK_LOD.FULL) {
    const F = this.field;
    const N = WORLD.chunkCells;
    const S = N + BORDER * 2;
    const cell = WORLD.cell;
    const originCx = ci * N, originCz = cj * N;

    // ── 阶段 1：解析场域（含 2 格外扩边界） ─────────────────────────
    const floorY = new Float32Array(S * S);
    const wallTop = new Float32Array(S * S);
    const depth = new Float32Array(S * S);
    const tint = new Float32Array(S * S);
    const kind = new Uint8Array(S * S);
    const isWall = new Uint8Array(S * S);
    const roomType = new Uint8Array(S * S);
    const wet = new Float32Array(S * S);
    const c = this._cell;

    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const i = z * S + x;
        F.cell(originCx + x - BORDER, originCz + z - BORDER, c);
        floorY[i] = c.floorY;
        wallTop[i] = c.wallTop;
        depth[i] = c.waterDepth;
        tint[i] = c.tint;
        kind[i] = c.kind;
        isWall[i] = c.wall ? 1 : 0;
        roomType[i] = c.roomType;
      }
    }
    yield;

    // ── 阶段 2：湿滑度扩散（水边 2 格内的瓷砖变暗、变光滑） ──────────
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const i = z * S + x;
        if (depth[i] > 0) { wet[i] = 1; continue; }
        let best = 0;
        for (let dz = -2; dz <= 2; dz++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
            if (depth[nz * S + nx] <= 0) continue;
            const dist = Math.max(Math.abs(dx), Math.abs(dz));
            const w = dist === 1 ? 0.75 : 0.34;
            if (w > best) best = w;
          }
        }
        wet[i] = best;
      }
    }
    yield;

    // ── 阶段 3：结构盒（地板/池底/平台/楼梯）贪心合并 ────────────────
    const structM = [], structMeta = [];
    let minY = WORLD.ceilingY, maxY = WORLD.solidBase;
    const solidKeys = new Float64Array(N * N);
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const si = (z + BORDER) * S + (x + BORDER);
        // 墙格的地板照常生成（墙是叠加物，R1 保证墙扎在地板上）
        solidKeys[z * N + x] = key2(floorY[si], Math.round(wet[si] * 3));
      }
    }
    greedyRects(N, N, solidKeys, (x, z, w, d) => {
      const si = (z + BORDER) * S + (x + BORDER);
      const top = floorY[si];
      const h = top - WORLD.solidBase;
      const cxw = (originCx + x + w * 0.5) * cell;
      const czw = (originCz + z + d * 0.5) * cell;
      pushMatrix(structM, cxw, top - h * 0.5, czw, w * cell, h, d * cell);
      const surf = depth[si] > 0 ? SURF.POOL : kind[si] === KIND.STAIR ? SURF.STAIR : SURF.FLOOR;
      structMeta.push(tint[si], wet[si], surf, depth[si]);
      minY = Math.min(minY, top - h); maxY = Math.max(maxY, top);
    });
    yield;

    // ── 阶段 4：墙体（含窗洞开凿）────────────────────────────────────
    const props = new Map(); // kind -> { m: number[], meta: number[] }
    const addProp = (kindName, tx, ty, tz, sx, sy, sz, rotY, m0, m1, m2, m3) => {
      let g = props.get(kindName);
      if (!g) { g = { m: [], meta: [] }; props.set(kindName, g); }
      pushMatrix(g.m, tx, ty, tz, sx, sy, sz, rotY);
      g.meta.push(m0, m1, m2, m3);
    };

    const wallKeys = new Float64Array(N * N);
    const windowCells = [];
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const gi = z * N + x;
        const si = (z + BORDER) * S + (x + BORDER);
        if (!isWall[si]) { wallKeys[gi] = NaN; continue; }
        const cx = originCx + x, cz = originCz + z;
        // R7：窗户只开在"单格厚"的墙上（两侧对穿都是开阔空间），保证窗洞里能看到风景板
        let axis = 0; // 1 = X 向对穿，2 = Z 向对穿
        const openXm = !isWall[si - 1], openXp = !isWall[si + 1];
        const openZm = !isWall[si - S], openZp = !isWall[si + S];
        if (openXm && openXp) axis = 1;
        else if (openZm && openZp) axis = 2;
        const win = axis && lodTier <= CHUNK_LOD.MID ? F.windowAt(cx, cz, F.cell(cx, cz, c)) : null;
        if (win) {
          windowCells.push({ x, z, si, axis, win });
          wallKeys[gi] = NaN; // 该格不参与整墙合并，改为四段拼砌
        } else {
          wallKeys[gi] = key2(floorY[si], wallTop[si]);
        }
      }
    }
    greedyRects(N, N, wallKeys, (x, z, w, d) => {
      const si = (z + BORDER) * S + (x + BORDER);
      const base = floorY[si], top = wallTop[si];
      const h = Math.max(0.05, top - base);
      pushMatrix(structM, (originCx + x + w * 0.5) * cell, base + h * 0.5, (originCz + z + d * 0.5) * cell,
        w * cell, h, d * cell);
      structMeta.push(tint[si], wet[si] * 0.4, SURF.WALL, 0);
      maxY = Math.max(maxY, top);
    });

    // 窗洞：把该格墙拆成 窗台 / 窗楣 / 左右窗垛 四块，再放窗框 + 磨砂风景板
    for (const wc of windowCells) {
      const { x, z, si, axis, win } = wc;
      const base = floorY[si], top = wallTop[si];
      const cxw = (originCx + x + 0.5) * cell, czw = (originCz + z + 0.5) * cell;
      const sill = win.sill, head = Math.min(top - 0.4, sill + WORLD.windowHeight);
      const openW = 1.55;                       // 洞口宽度（米）
      const jamb = (cell - openW) * 0.5;        // 两侧窗垛宽度
      const along = axis === 1 ? 'z' : 'x';     // 墙的延伸方向
      const pushWall = (px, py, pz, sx, sy, sz) => {
        pushMatrix(structM, px, py, pz, sx, sy, sz, 0);
        structMeta.push(tint[si], 0, SURF.WALL, 0);
      };
      // 窗台以下 / 窗楣以上
      pushWall(cxw, base + (sill - base) * 0.5, czw, cell, Math.max(0.05, sill - base), cell);
      pushWall(cxw, head + (top - head) * 0.5, czw, cell, Math.max(0.05, top - head), cell);
      // 左右窗垛
      if (along === 'z') {
        pushWall(cxw, (sill + head) * 0.5, czw - (openW + jamb) * 0.5, cell, head - sill, jamb);
        pushWall(cxw, (sill + head) * 0.5, czw + (openW + jamb) * 0.5, cell, head - sill, jamb);
      } else {
        pushWall(cxw - (openW + jamb) * 0.5, (sill + head) * 0.5, czw, jamb, head - sill, cell);
        pushWall(cxw + (openW + jamb) * 0.5, (sill + head) * 0.5, czw, jamb, head - sill, cell);
      }
      // 窗框（两侧墙面各一个）+ 中间的磨砂风景板（双面可见，物理上是背光毛玻璃）
      const frameKind = win.shape === 'arch' ? 'windowFrameArch' : win.shape === 'round' ? 'windowFrameRound' : 'windowFrameRect';
      const hgt = head - sill, midY = (sill + head) * 0.5;
      const rot = axis === 1 ? Math.PI * 0.5 : 0; // 窗框默认朝 +Z
      if (lodTier === CHUNK_LOD.FULL) {
        const off = cell * 0.5 - 0.05;
        if (axis === 1) {
          addProp(frameKind, cxw - off, midY, czw, openW + 0.3, hgt, 1, rot, tint[si], 0, 0, 0);
          addProp(frameKind, cxw + off, midY, czw, openW + 0.3, hgt, 1, rot, tint[si], 0, 0, 0);
        } else {
          addProp(frameKind, cxw, midY, czw - off, openW + 0.3, hgt, 1, rot, tint[si], 0, 0, 0);
          addProp(frameKind, cxw, midY, czw + off, openW + 0.3, hgt, 1, rot, tint[si], 0, 0, 0);
        }
      }
      addProp('vistaPanel', cxw, midY, czw, openW, hgt * 0.98, 1, rot, hash2(x, z, 7), 0, 0, 0);
    }
    yield;

    // ── 阶段 5：天花（跳过天窗格）+ 天窗框/发光板 ────────────────────
    const ceilKeys = new Float64Array(N * N);
    const skylights = [];
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const gi = z * N + x;
        const si = (z + BORDER) * S + (x + BORDER);
        const cx = originCx + x, cz = originCz + z;
        if (F.skylightAt(cx, cz, F.cell(cx, cz, c))) {
          ceilKeys[gi] = NaN;
          skylights.push({ x, z, si });
        } else {
          ceilKeys[gi] = 1;
        }
      }
    }
    greedyRects(N, N, ceilKeys, (x, z, w, d) => {
      pushMatrix(structM,
        (originCx + x + w * 0.5) * cell, WORLD.ceilingY + WORLD.ceilingThickness * 0.5, (originCz + z + d * 0.5) * cell,
        w * cell, WORLD.ceilingThickness, d * cell);
      structMeta.push(0.85, 0, SURF.CEILING, 0);
    });
    const lights = [];
    for (const sk of skylights) {
      const cxw = (originCx + sk.x + 0.5) * cell, czw = (originCz + sk.z + 0.5) * cell;
      // 发光板略低于天花，作为体积光遮挡图的光源；框只在近处画
      addProp('skylightPane', cxw, WORLD.ceilingY + 0.02, czw, cell * 0.92, 1, cell * 0.92, 0, 1, 0, 0, 0);
      if (lodTier === CHUNK_LOD.FULL) {
        addProp('skylightFrame', cxw, WORLD.ceilingY + 0.05, czw, cell, 1, cell, 0, 0.9, 0, 0, 0);
      }
      lights.push([cxw, WORLD.ceilingY, czw]);
    }
    maxY = Math.max(maxY, WORLD.ceilingY + WORLD.ceilingThickness);
    yield;

    // ── 阶段 6：水面（贪心合并成矩形，全部落在同一 y = waterY 平面） ──
    const waterM = [];
    const waterKeys = new Float64Array(N * N);
    let waterCells = 0, deepest = 0;
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const si = (z + BORDER) * S + (x + BORDER);
        const d = depth[si];
        if (d <= 0 || isWall[si]) { waterKeys[z * N + x] = NaN; continue; }
        waterKeys[z * N + x] = 1;
        waterCells++;
        deepest = Math.max(deepest, d);
      }
    }
    greedyRects(N, N, waterKeys, (x, z, w, d) => {
      pushMatrix(waterM,
        (originCx + x + w * 0.5) * cell, WORLD.waterY, (originCz + z + d * 0.5) * cell,
        w * cell, 1, d * cell);
    });
    yield;

    // ── 阶段 7：道具（元素库放置 + 连贯性规则）───────────────────────
    const at = (x, z) => (z + BORDER) * S + (x + BORDER);
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const si = at(x, z);
        const cx = originCx + x, cz = originCz + z;
        const cxw = (cx + 0.5) * cell, czw = (cz + 0.5) * cell;
        const fy = floorY[si], dep = depth[si];
        F.cell(cx, cz, c);

        // 柱子（R2：高度 = 天花 - 地板，必然顶天立地）
        const col = F.columnAt(cx, cz, c);
        if (col.present) {
          const kindName = col.kind === COLUMN.ROUND ? 'columnRound' : col.kind === COLUMN.CLUSTER ? 'columnCluster' : 'columnSquare';
          const w = columnScale(col.footprint);   // 与 Field.columnHalfExtent 同源，避免视觉/碰撞漂移
          addProp(kindName, cxw, fy, czw, w, WORLD.ceilingY - fy, w, 0, tint[si], wet[si], 0, 0);
        }

        if (isWall[si]) {
          // 微湿滑的阳台（挑台）：贴墙悬出，外缘配栏杆
          if (lodTier === CHUNK_LOD.FULL && hash2(cx, cz, 0x8a1c0) < 0.05) {
            const openXp = !isWall[si + 1], openXm = !isWall[si - 1], openZp = !isWall[si + S];
            const dir = openXp ? 0 : openXm ? Math.PI : openZp ? Math.PI * 0.5 : -Math.PI * 0.5;
            const by = WORLD.deckY + 3.4;
            const ox = Math.sin(dir + Math.PI * 0.5) * 0, oz = 0;
            const px = cxw + Math.cos(dir) * cell, pz = czw + Math.sin(dir) * cell;
            addProp('balconyPlate', px + ox, by, pz + oz, cell * 1.5, 1, cell * 1.5, dir, 0.8, 0.9, 0, 0);
            addProp('railing', px + Math.cos(dir) * cell * 0.7, by, pz + Math.sin(dir) * cell * 0.7,
              cell * 1.5, 1.05, 1, dir + Math.PI * 0.5, 0.6, 0.9, 0, 0);
          }
          continue;
        }

        // 水下拱门（深水区，跨 2 格，网格对齐）
        if (dep > 1.6 && lodTier <= CHUNK_LOD.MID) {
          const mod = ((cx % 6) + 6) % 6, modz = ((cz % 6) + 6) % 6;
          if (mod === 0 && modz === 0 && hash2(cx, cz, 0xa2c11) < 0.55) {
            const spanZ = hash2(cx, cz, 0x1f2e) < 0.5;
            const h = Math.min(dep + 1.1, 3.8);
            addProp('archUnderwater', cxw, fy, czw, cell * 2, h, 0.55, spanZ ? Math.PI * 0.5 : 0, tint[si], 1, 0, 0);
          }
        }

        // 栏杆：站立面临 ≥1m 落差且不是楼梯口 → 沿该边生成
        if (lodTier === CHUNK_LOD.FULL && dep <= 0.01 && kind[si] !== KIND.STAIR) {
          const dirs = [[1, 0, 0], [-1, 0, Math.PI], [0, 1, Math.PI * 0.5], [0, -1, -Math.PI * 0.5]];
          for (const [dx, dz, rot] of dirs) {
            const ni = at(x + dx, z + dz);
            if (isWall[ni]) continue;
            const drop = fy - floorY[ni];
            if (drop < 1.0 || kind[ni] === KIND.STAIR) continue;
            if (hash2(cx * 3 + dx, cz * 3 + dz, 0x9a11c) > 0.55) continue;
            addProp('railing',
              cxw + dx * cell * 0.5, fy, czw + dz * cell * 0.5,
              cell, 1.02, 1, dz !== 0 ? 0 : Math.PI * 0.5, 0.5, wet[si], 0, 0);
          }
        }

        // 跳板 & 池梯：池畔朝向深水
        if (lodTier === CHUNK_LOD.FULL && dep <= 0.01) {
          const dirs = [[1, 0, 0], [-1, 0, Math.PI], [0, 1, Math.PI * 0.5], [0, -1, -Math.PI * 0.5]];
          for (const [dx, dz, rot] of dirs) {
            const ni = at(x + dx, z + dz);
            if (depth[ni] < 1.0) continue;
            const h = hash2(cx * 5 + dx, cz * 5 + dz, 0xd1e3);
            if (depth[ni] > 2.0 && h < 0.10) {
              // divingBoard 的原点是"板根上表面中心"，支撑座向下伸到 local y = -0.31，
              // 因此必须抬高 0.31 才能让支撑座正好落在池畔上（否则整块跳板悬空）
              addProp('divingBoard', cxw + dx * cell * 0.35, fy + 0.31, czw + dz * cell * 0.35,
                1.0, 1, 2.6, rot, 0.55, 0.6, 0, 0);
            } else if (h > 0.93) {
              addProp('poolLadder', cxw + dx * cell * 0.5, fy, czw + dz * cell * 0.5,
                1.0, 1.05, 1.0, rot, 0.4, 1, 0, 0);
            }
            break;
          }
        }

        // 不寻常的几何体（罕见）：半沉的环、扭曲方碑、悬浮球
        if (lodTier === CHUNK_LOD.FULL) {
          const oddRoll = hash2(cx, cz, 0x0dd0);
          const lk = F.roomLookup(cx, cz);
          if (oddRoll < (lk.room?.oddChance ?? 0.012)) {
            const pick = hash2(cx, cz, 0x0dd1);
            if (pick < 0.4) addProp('oddTorus', cxw, WORLD.waterY + 0.1, czw, 3.2, 3.2, 3.2, hash2(cx, cz, 3) * Math.PI, 0.5, 1, 0, 0);
            else if (pick < 0.75) addProp('oddMonolith', cxw, fy, czw, 1.2, 4.5 + hash2(cx, cz, 5) * 2.5, 1.2, hash2(cx, cz, 6) * Math.PI, 0.3, wet[si], 0, 0);
            else addProp('oddSphere', cxw, fy + 2.2, czw, 1.6, 1.6, 1.6, 0, 0.9, 0, 0, 0);
          }
        }
      }
    }
    yield;

    // ── 阶段 8：打包 ────────────────────────────────────────────────
    const propOut = {};
    let propInstances = 0;
    for (const [k, g] of props) {
      const count = g.meta.length / 4;
      if (!count) continue;
      propOut[k] = { matrices: new Float32Array(g.m), meta: new Float32Array(g.meta), count };
      propInstances += count;
    }
    const structCount = structMeta.length / 4;
    const waterCount = waterM.length / 16;

    /** @typedef {object} ChunkData */
    return {
      key: `${ci},${cj}`, ci, cj, lodTier,
      bounds: [
        originCx * cell, minY, originCz * cell,
        (originCx + N) * cell, maxY, (originCz + N) * cell,
      ],
      structure: { matrices: new Float32Array(structM), meta: new Float32Array(structMeta), count: structCount },
      water: { matrices: new Float32Array(waterM), count: waterCount },
      props: propOut,
      lights,
      stats: {
        instances: structCount + waterCount + propInstances,
        structure: structCount, water: waterCount, props: propInstances,
        waterCells, deepest,
        /** 压缩率：格数 → 结构实例数 */
        compression: structCount ? (N * N * 2) / structCount : 0,
      },
    };
  }
}

export default ChunkBuilder;
