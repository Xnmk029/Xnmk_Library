/**
 * gen/Field.js — 程序化场域（PCG 规则引擎的"真相来源"）
 * ===========================================================================
 * 这是整个无限世界的**纯函数场**：任意格坐标 (cx, cz) → 该格的地形/墙体/道具决策。
 *
 * ▍为什么用纯函数场？
 *   分块（chunk）生成最难的部分是"接缝一致性"。本实现里 chunk 只是**渲染批次**，
 *   世界内容完全由 (cx, cz) 的纯函数决定，与 chunk 划分无关：
 *   → 任何 chunk 在任何时刻生成，边界都必然吻合（池边对齐、墙体连续、柱子不悬空）。
 *   → 玩家碰撞可以直接查询同一批函数，**不需要生成碰撞网格**。
 *
 * ▍层级（从大到小）
 *   1. 房间划分：抖动 Voronoi（房间格 roomCells），决定房间类型与"墙带"位置。
 *   2. 地形：按房间类型生成池（矩形/圆/L/不规则）、多层阶梯池壁、抬升平台与楼梯。
 *   3. 墙体：Voronoi 边界带上生成墙，按量化哈希开门洞；深水处让位于水下拱门。
 *   4. 道具：柱子/窗/天窗等"无需邻居信息"的决策放在这里（与 ChunkBuilder 共用同一函数，
 *      保证渲染与碰撞完全一致）；需要邻居信息的（栏杆/跳板/池梯）在 ChunkBuilder 里。
 *
 * ▍几何连贯性规则（rule engine）
 *   R1 墙体先算地形再叠加 → 墙永远扎在实体地板/池底上，不会悬空。
 *   R2 柱高 = 天花高 - 该格地板高 → 柱子必然顶天立地，不会浮空。
 *   R3 池深量化到 tierStep 的整数倍、池边界量化到整格 → 相邻 chunk 池壁严格对齐。
 *   R4 平台必配楼梯带（floorY 逐级递减且相邻高差 ≤ stairRise）→ 可行走。
 *   R5 深水中的墙自动开口 → 池体之间水下连通，不会出现"死水池"。
 *   R6 天窗只开在水面/池畔上方 → 体积光束必然落进水里（美学规则）。
 */

import { Noise2D, hash2, hashU32, mulberry32, clamp, smoothstep } from '../core/Noise.js';
import { WORLD } from '../config.js';

/** 格类型 */
export const KIND = Object.freeze({
  DECK: 0,      // 干燥池畔
  POOL: 1,      // 水池（floorY < waterY）
  PLATFORM: 2,  // 抬升平台
  STAIR: 3,     // 楼梯踏面（干或湿）
  WALL: 4,      // 墙体（叠加在地形之上）
});

/** 房间类型 */
export const ROOM = Object.freeze({
  POOL_HALL: 0,   // 主泳池大厅（多层阶梯池）
  SHALLOW: 1,     // 涉水浅池（脚踝深，镜面感最强）
  COLONNADE: 2,   // 柱厅（密集柱列 + 中央水渠）
  PLATFORM: 3,    // 平台房（抬升台 + 楼梯 + 栏杆 + 挑台）
  BASIN: 4,       // 深潭（单一深池 + 水下拱门）
});

/** 柱子类型 */
export const COLUMN = Object.freeze({ SQUARE: 0, ROUND: 1, CLUSTER: 2 });

/**
 * 柱子尺寸的**唯一来源**：渲染与碰撞必须共用同一套换算，
 * 否则会出现"被空气挡住 / 能穿进柱子"这类经典不一致 bug。
 * 元素库约定：柱子几何横截面 1×1（柱础/柱头外扩到 ±0.57），底面中心在原点。
 *   columnScale()      → ChunkBuilder 写进实例矩阵的水平缩放 sx/sz
 *   columnHalfExtent() → Field.isSolid 用的世界空间碰撞半宽（柱身 ±0.5 再留一点柱础余量）
 */
export function columnScale(footprint) { return footprint * WORLD.cell * 0.5; }
export function columnHalfExtent(footprint) { return columnScale(footprint) * 0.54; }

/** cell() 输出结构（复用同一对象以免每格分配） */
export function createCellData() {
  return {
    cx: 0, cz: 0,
    kind: KIND.DECK,
    floorY: WORLD.deckY,   // 该格可站立表面的世界高度
    tier: 0,               // 池深层级（0 = 无水）
    water: false,
    waterDepth: 0,
    wall: false,
    wallTop: 0,            // 墙顶高度（wall=false 时无意义）
    roomType: ROOM.POOL_HALL,
    roomSeed: 0,
    wet: 0,                // 0..1 湿滑度（由 ChunkBuilder 依邻居填充）
    tint: 0,               // 0..1 瓷砖色差
  };
}

export class Field {
  constructor(seed = 1337) {
    this.seed = seed | 0;
    /** 池边不规则扰动 */
    this.nEdge = new Noise2D(this.seed ^ 0x1a2b3c);
    /** 大尺度"区域性格"（影响房间类型分布，让世界有大片风格区） */
    this.nRegion = new Noise2D(this.seed ^ 0x51ff77);
    /** 脏化/湿滑细节 */
    this.nGrime = new Noise2D(this.seed ^ 0x2f9e11);

    /** 房间描述缓存（房间是纯函数，缓存永远安全） */
    this._rooms = new Map();
    this._lookup = { room: null, d1: 0, d2: 0, edge: 0 };
    this._scratch = createCellData();
    this._colScratch = { present: false, kind: COLUMN.SQUARE, footprint: 1.0, tall: false };
  }

  // ══════════════════════════════════════════════════════════════════
  // 房间层
  // ══════════════════════════════════════════════════════════════════

  /** 房间描述（rx, rz 为房间格坐标） */
  room(rx, rz) {
    const key = (rx & 0xffff) * 65536 + (rz & 0xffff);
    let r = this._rooms.get(key);
    if (r) return r;

    const R = WORLD.roomCells;
    const rs = hashU32(rx, rz, this.seed ^ 0x9e3779b9);
    const rand = mulberry32(rs);

    // 房间中心：格心 + 抖动（量化到整格 → 池/平台边界永远落在格线上）
    const jx = (hash2(rx, rz, this.seed ^ 0x51ed) - 0.5) * R * 0.40;
    const jz = (hash2(rx, rz, this.seed ^ 0x77ab) - 0.5) * R * 0.40;
    const centerCx = Math.round(rx * R + R * 0.5 + jx);
    const centerCz = Math.round(rz * R + R * 0.5 + jz);

    // 大尺度区域倾向：某些区域偏"深潭"，某些偏"浅水厅"
    const region = this.nRegion.fbm(centerCx * 0.012, centerCz * 0.012, 3);
    const roll = rand();
    let type;
    if (region > 0.35) type = roll < 0.62 ? ROOM.BASIN : ROOM.POOL_HALL;
    else if (region < -0.35) type = roll < 0.55 ? ROOM.SHALLOW : ROOM.COLONNADE;
    else if (roll < 0.34) type = ROOM.POOL_HALL;
    else if (roll < 0.55) type = ROOM.SHALLOW;
    else if (roll < 0.76) type = ROOM.COLONNADE;
    else type = ROOM.PLATFORM;

    const maxHalf = Math.floor(R * 0.5) + 1; // 允许略微溢出房间格 → 被邻房规则裁切成不规则形状
    const shapeRoll = rand();
    const poolShape = shapeRoll < 0.44 ? 'rect' : shapeRoll < 0.66 ? 'round' : shapeRoll < 0.85 ? 'L' : 'irregular';

    r = {
      rx, rz, seed: rs, centerCx, centerCz, type,

      // ── 池 ──
      poolShape,
      poolHalfW: 3 + Math.floor(rand() * (maxHalf - 2)),
      poolHalfD: 3 + Math.floor(rand() * (maxHalf - 2)),
      tierWidth: 1 + Math.floor(rand() * 2),                 // 每层台阶宽（格）
      maxTier: 2 + Math.floor(rand() * (WORLD.maxTiers - 2)), // 该池最深层级
      cutSignX: rand() < 0.5 ? 1 : -1,                       // L 型缺口方向
      cutSignZ: rand() < 0.5 ? 1 : -1,
      edgeWobble: 0.6 + rand() * 1.6,

      // ── 平台 / 楼梯 ──
      platHalfW: 2 + Math.floor(rand() * 3),
      platHalfD: 2 + Math.floor(rand() * 3),
      platLevels: 1 + Math.floor(rand() * 3),
      stairEdge: Math.floor(rand() * 4),
      stairOffset: Math.round((rand() - 0.5) * 3),

      // ── 柱列 ──
      colSpacing: 3 + Math.floor(rand() * 3),
      colKind: rand() < 0.4 ? COLUMN.ROUND : rand() < 0.75 ? COLUMN.SQUARE : COLUMN.CLUSTER,
      colProb: 0.45 + rand() * 0.5,
      colPhaseX: Math.floor(rand() * 4),
      colPhaseZ: Math.floor(rand() * 4),

      // ── 开窗 / 天窗 ──
      windowProb: 0.28 + rand() * 0.45,
      windowShape: rand() < 0.45 ? 'arch' : rand() < 0.8 ? 'rect' : 'round',
      skylightProb: 0.35 + rand() * 0.4,

      // ── 水渠（柱厅）──
      channelHalf: rand() < 0.6 ? 1 : 2,

      // ── 外观 ──
      tint: 0.35 + rand() * 0.65,
      oddChance: rand() < 0.28 ? 0.05 : 0.012,
    };
    // 缓存上限：房间对象极小，但仍然限制条目数避免长时间漫游后无界增长
    if (this._rooms.size > 4096) this._rooms.clear();
    this._rooms.set(key, r);
    return r;
  }

  /**
   * 抖动 Voronoi 房间查询：返回最近房间、最近/次近距离与边界强度。
   * edge = d2 - d1（单位：格）。edge 越小越接近两房间的分界 → 墙带。
   */
  roomLookup(cx, cz, out = this._lookup) {
    const R = WORLD.roomCells;
    const brx = Math.floor(cx / R);
    const brz = Math.floor(cz / R);
    let d1 = Infinity, d2 = Infinity, best = null;
    for (let oz = -1; oz <= 1; oz++) {
      for (let ox = -1; ox <= 1; ox++) {
        const rm = this.room(brx + ox, brz + oz);
        const dx = cx - rm.centerCx, dz = cz - rm.centerCz;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < d1) { d2 = d1; d1 = d; best = rm; }
        else if (d < d2) { d2 = d; }
      }
    }
    out.room = best; out.d1 = d1; out.d2 = d2; out.edge = d2 - d1;
    return out;
  }

  // ══════════════════════════════════════════════════════════════════
  // 地形层
  // ══════════════════════════════════════════════════════════════════

  /**
   * 核心：解析一格。结果写入 out（createCellData() 产生的对象）。
   * 纯函数、无副作用、可任意顺序调用。
   */
  cell(cx, cz, out = this._scratch) {
    const lk = this.roomLookup(cx, cz, this._lookup);
    const room = lk.room;
    const ix = cx - room.centerCx;
    const iz = cz - room.centerCz;

    out.cx = cx; out.cz = cz;
    out.roomType = room.type;
    out.roomSeed = room.seed;
    out.kind = KIND.DECK;
    out.floorY = WORLD.deckY;
    out.tier = 0;
    out.wall = false;
    out.wallTop = 0;
    out.wet = 0;
    out.tint = room.tint * 0.55 + hash2(cx, cz, this.seed ^ 0x7f4a) * 0.45;

    // ── 1) 地形 ─────────────────────────────────────────────
    switch (room.type) {
      case ROOM.POOL_HALL:
      case ROOM.BASIN: {
        const tier = this._poolTier(room, cx, cz, ix, iz);
        if (tier > 0) {
          out.kind = KIND.POOL;
          out.tier = tier;
          out.floorY = WORLD.waterY - tier * WORLD.tierStep;
        }
        break;
      }
      case ROOM.SHALLOW: {
        // 涉水浅池：房间主体是脚踝深的水，中央偶有一个更深的坑
        const inside = this._insideRect(ix, iz, room.poolHalfW, room.poolHalfD);
        if (inside) {
          const deepCore = Math.abs(ix) <= 1 && Math.abs(iz) <= 1 && (room.seed & 3) === 0;
          out.kind = KIND.POOL;
          out.tier = deepCore ? 3 : 1;
          out.floorY = deepCore ? WORLD.waterY - 3 * WORLD.tierStep : WORLD.waterY - WORLD.shallowDepth;
        }
        break;
      }
      case ROOM.COLONNADE: {
        // 柱厅：中央一条水渠（严格网格对齐，跨房间也能接上）
        if (Math.abs(iz) <= room.channelHalf) {
          out.kind = KIND.POOL;
          out.tier = 1;
          out.floorY = WORLD.waterY - WORLD.tierStep;
        }
        break;
      }
      case ROOM.PLATFORM: {
        const platY = WORLD.deckY + room.platLevels * WORLD.platformStep;
        if (this._insideRect(ix, iz, room.platHalfW, room.platHalfD)) {
          out.kind = KIND.PLATFORM;
          out.floorY = platY;
        } else {
          const st = this._stairStep(room, ix, iz);
          if (st > 0) {
            out.kind = KIND.STAIR;
            out.floorY = Math.max(WORLD.deckY, platY - (st - 1) * WORLD.stairRise);
          } else {
            // 平台房外围：低一圈的浅水环，形成"孤岛平台"的池核感
            const ringOuter = Math.max(room.platHalfW, room.platHalfD) + 4;
            if (Math.abs(ix) <= ringOuter && Math.abs(iz) <= ringOuter && ((room.seed >>> 5) & 1)) {
              out.kind = KIND.POOL;
              out.tier = 1;
              out.floorY = WORLD.waterY - WORLD.shallowDepth;
            }
          }
        }
        break;
      }
    }

    out.water = out.floorY < WORLD.waterY - 0.01;
    out.waterDepth = out.water ? WORLD.waterY - out.floorY : 0;

    // ── 2) 墙体（R1：叠加在已算好的地形上 → 永不悬空） ──────────
    if (lk.edge < WORLD.wallBand) {
      const open = this._doorway(cx, cz);
      // R5：深水中的墙让位于水下拱门 → 池体互相连通
      const deepWater = out.waterDepth > 1.6;
      if (!open && !deepWater) {
        out.wall = true;
        const parapet = hash2(Math.floor(cx / 5), Math.floor(cz / 5), this.seed ^ 0x2b1d) < 0.34;
        out.wallTop = parapet ? out.floorY + WORLD.parapetHeight : WORLD.wallTopY;
        out.kind = KIND.WALL;
      }
    }
    return out;
  }

  /** 池深层级（0 = 无水）；所有边界量化到整格 → R3 */
  _poolTier(room, cx, cz, ix, iz) {
    let hw = room.poolHalfW, hd = room.poolHalfD;
    let inside;
    let margin; // 距池边的格数（越大越靠中心）

    if (room.poolShape === 'round') {
      const rr = Math.sqrt((ix / hw) * (ix / hw) + (iz / hd) * (iz / hd));
      inside = rr <= 1.0;
      margin = (1.0 - rr) * Math.min(hw, hd);
    } else if (room.poolShape === 'irregular') {
      const wob = this.nEdge.fbm(cx * 0.11, cz * 0.11, 3) * room.edgeWobble;
      const mx = hw + Math.round(wob) - Math.abs(ix);
      const mz = hd + Math.round(wob) - Math.abs(iz);
      margin = Math.min(mx, mz);
      inside = margin >= 0;
    } else {
      const mx = hw - Math.abs(ix);
      const mz = hd - Math.abs(iz);
      margin = Math.min(mx, mz);
      inside = margin >= 0;
      if (inside && room.poolShape === 'L') {
        // L 型：切掉一个象限（缺口尺寸也量化到整格）
        const cutW = Math.max(1, Math.floor(hw * 0.55));
        const cutD = Math.max(1, Math.floor(hd * 0.55));
        if (ix * room.cutSignX > hw - cutW && iz * room.cutSignZ > hd - cutD) inside = false;
      }
    }
    if (!inside) return 0;
    const tier = 1 + Math.floor(margin / room.tierWidth);
    return Math.min(tier, room.maxTier);
  }

  _insideRect(ix, iz, hw, hd) { return Math.abs(ix) <= hw && Math.abs(iz) <= hd; }

  /**
   * 楼梯带（R4）：返回第几级（1 起，0 = 不是楼梯）。
   * 楼梯紧贴平台某一边向外延伸，宽 3 格，级数刚好覆盖平台高差。
   */
  _stairStep(room, ix, iz) {
    const platY = WORLD.deckY + room.platLevels * WORLD.platformStep;
    const steps = Math.max(1, Math.ceil((platY - WORLD.deckY) / WORLD.stairRise));
    const e = room.stairEdge;
    let along, out_;
    if (e === 0) { out_ = ix - room.platHalfW; along = iz - room.stairOffset; }
    else if (e === 1) { out_ = -ix - room.platHalfW; along = iz - room.stairOffset; }
    else if (e === 2) { out_ = iz - room.platHalfD; along = ix - room.stairOffset; }
    else { out_ = -iz - room.platHalfD; along = ix - room.stairOffset; }
    if (out_ >= 1 && out_ <= steps && Math.abs(along) <= 1) return out_;
    return 0;
  }

  /** 门洞：以 3×3 格（6×6m）为粒度的量化哈希 → 洞口能穿透任意朝向的墙带 */
  _doorway(cx, cz) {
    const bx = Math.floor(cx / 3), bz = Math.floor(cz / 3);
    return hash2(bx, bz, this.seed ^ 0x00d00d0) < 0.42;
  }

  // ══════════════════════════════════════════════════════════════════
  // 道具层（无需邻居信息的决策 → 渲染与碰撞共用，保证一致）
  // ══════════════════════════════════════════════════════════════════

  /**
   * 柱子（R2：柱高 = 天花 - 地板，必然顶天立地）。
   * 只在"可站立且水不深"的格上生成；柱列按房间的格相位对齐成柱廊。
   */
  columnAt(cx, cz, cellData = null, out = this._colScratch) {
    out.present = false;
    const c = cellData && cellData.cx === cx && cellData.cz === cz ? cellData : this.cell(cx, cz, this._scratch);
    if (c.wall) return out;
    if (c.waterDepth > 1.2) return out;                 // 深水里不立柱（改为水下拱门）
    const room = this.room(Math.floor(cx / WORLD.roomCells), Math.floor(cz / WORLD.roomCells));
    const lk = this.roomLookup(cx, cz, this._lookup);
    const rm = lk.room || room;
    const sp = rm.colSpacing;
    if (((cx - rm.colPhaseX) % sp + sp) % sp !== 0) return out;
    if (((cz - rm.colPhaseZ) % sp + sp) % sp !== 0) return out;
    const h = hash2(cx, cz, this.seed ^ 0xc0111d);
    const prob = rm.type === ROOM.COLONNADE ? Math.min(0.95, rm.colProb + 0.35) : rm.colProb;
    if (h > prob) return out;
    out.present = true;
    out.kind = rm.colKind;
    out.footprint = rm.colKind === COLUMN.CLUSTER ? 1.15 : 0.9 + hash2(cx, cz, this.seed ^ 0x5511) * 0.5;
    out.tall = true;
    return out;
  }

  /** 天窗（R6：只开在水面或池畔上方，保证光柱落进水里） */
  skylightAt(cx, cz, cellData = null) {
    const c = cellData && cellData.cx === cx && cellData.cz === cz ? cellData : this.cell(cx, cz, this._scratch);
    if (c.wall) return false;
    const lk = this.roomLookup(cx, cz, this._lookup);
    const rm = lk.room;
    const sp = 5;
    if (((cx % sp) + sp) % sp !== 2) return false;
    if (((cz % sp) + sp) % sp !== 2) return false;
    if (hash2(cx, cz, this.seed ^ 0x5c1117) > rm.skylightProb) return false;
    return true;
  }

  /** 窗户：只开在到顶的墙上，返回 null 或 { shape, sill } */
  windowAt(cx, cz, cellData = null) {
    const c = cellData && cellData.cx === cx && cellData.cz === cz ? cellData : this.cell(cx, cz, this._scratch);
    if (!c.wall || c.wallTop < WORLD.wallTopY - 0.01) return null;
    const lk = this.roomLookup(cx, cz, this._lookup);
    const rm = lk.room;
    if (hash2(cx, cz, this.seed ^ 0x1d0aa) > rm.windowProb) return null;
    const shapeRoll = hash2(cx, cz, this.seed ^ 0x9a11);
    const shape = rm.windowShape === 'arch'
      ? (shapeRoll < 0.75 ? 'arch' : 'rect')
      : rm.windowShape === 'round' ? (shapeRoll < 0.6 ? 'round' : 'arch') : (shapeRoll < 0.7 ? 'rect' : 'arch');
    return { shape, sill: Math.max(c.floorY + WORLD.windowSill, WORLD.waterY + 1.6) };
  }

  // ══════════════════════════════════════════════════════════════════
  // 世界坐标查询（玩家碰撞 / 相机 / 水面判定共用）
  // ══════════════════════════════════════════════════════════════════

  worldToCellX(wx) { return Math.floor(wx / WORLD.cell); }
  worldToCellZ(wz) { return Math.floor(wz / WORLD.cell); }

  cellAtWorld(wx, wz, out = this._scratch) {
    return this.cell(Math.floor(wx / WORLD.cell), Math.floor(wz / WORLD.cell), out);
  }

  /** 该位置可站立表面高度（墙体格返回墙顶，用于站在矮墙上） */
  floorYAt(wx, wz) {
    const c = this.cellAtWorld(wx, wz, this._scratch);
    if (c.wall) return c.wallTop;
    return c.floorY;
  }

  waterDepthAt(wx, wz) {
    const c = this.cellAtWorld(wx, wz, this._scratch);
    return c.wall ? 0 : c.waterDepth;
  }

  /**
   * 实体查询（用于胶囊体碰撞）：给定世界点是否在实体内部。
   * 包含：地板/池底以下、墙体、柱子。
   */
  isSolid(wx, y, wz) {
    const cx = Math.floor(wx / WORLD.cell), cz = Math.floor(wz / WORLD.cell);
    const c = this.cell(cx, cz, this._scratch);
    if (c.wall) { if (y < c.wallTop && y > c.floorY - 0.001) return true; }
    if (y < c.floorY - 0.001) return true;
    if (y > WORLD.ceilingY) return true;
    // 柱子：按足迹半径做圆柱/方柱近似
    const col = this.columnAt(cx, cz, c, this._colScratch);
    if (col.present) {
      const centerX = (cx + 0.5) * WORLD.cell, centerZ = (cz + 0.5) * WORLD.cell;
      const half = columnHalfExtent(col.footprint);   // ← 与渲染缩放同源，见文件头的换算说明
      if (Math.abs(wx - centerX) < half && Math.abs(wz - centerZ) < half) return true;
    }
    return false;
  }

  /** 找一个适合出生的位置（池畔、无墙无柱、附近有水） */
  findSpawn(searchRadiusCells = 40) {
    const out = createCellData();
    for (let r = 0; r < searchRadiusCells; r++) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const cx = Math.round(Math.cos(a) * r);
        const cz = Math.round(Math.sin(a) * r);
        const c = this.cell(cx, cz, out);
        if (c.wall || c.water) continue;
        if (this.columnAt(cx, cz, c).present) continue;
        // 附近 6 格内要有水，出生就能看到泳池
        let sawWater = false;
        for (let k = 1; k <= 6 && !sawWater; k++) {
          if (this.cell(cx + k, cz, this._scratch).water) sawWater = true;
          if (this.cell(cx - k, cz, this._scratch).water) sawWater = true;
          if (this.cell(cx, cz + k, this._scratch).water) sawWater = true;
          if (this.cell(cx, cz - k, this._scratch).water) sawWater = true;
        }
        if (!sawWater) continue;
        return { x: (cx + 0.5) * WORLD.cell, y: c.floorY, z: (cz + 0.5) * WORLD.cell };
      }
    }
    return { x: 1, y: WORLD.deckY, z: 1 };
  }

  /** 统计一个区域的构成（供 README/调试/冒烟测试验证生成器健康度） */
  survey(halfCells = 60) {
    const counts = { deck: 0, pool: 0, platform: 0, stair: 0, wall: 0, columns: 0, skylights: 0, windows: 0 };
    const out = createCellData();
    let depthSum = 0, depthMax = 0;
    for (let cz = -halfCells; cz <= halfCells; cz++) {
      for (let cx = -halfCells; cx <= halfCells; cx++) {
        const c = this.cell(cx, cz, out);
        if (c.wall) counts.wall++;
        else if (c.kind === KIND.POOL) counts.pool++;
        else if (c.kind === KIND.PLATFORM) counts.platform++;
        else if (c.kind === KIND.STAIR) counts.stair++;
        else counts.deck++;
        if (c.water) { depthSum += c.waterDepth; depthMax = Math.max(depthMax, c.waterDepth); }
        if (this.columnAt(cx, cz, c).present) counts.columns++;
        if (this.skylightAt(cx, cz, c)) counts.skylights++;
        if (this.windowAt(cx, cz, c)) counts.windows++;
      }
    }
    const total = (halfCells * 2 + 1) ** 2;
    return {
      total, counts,
      waterRatio: counts.pool / total,
      wallRatio: counts.wall / total,
      avgDepth: counts.pool ? depthSum / counts.pool : 0,
      maxDepth: depthMax,
    };
  }
}

export default Field;
