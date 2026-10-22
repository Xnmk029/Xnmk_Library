// 世界生成：tile 网格（1 单位 = 1 格）+ 建筑 + 道具 + 容器 + 出生点。
// tile 语义：0 空 / 1 实心（挡人挡视线）/ 2 挡视线不挡人（栅栏、高草）/ 3 挡人不挡视线（矮掩体）
// FoV、寻路、AI 视线全部基于这张网格 → 三者永远一致（唯一真源）。
import { Rng } from '../core/rng.js';
import { BUILDING_KINDS } from '../data/maps.js';

export const TILE = { OPEN: 0, SOLID: 1, SIGHT: 2, LOW: 3 };

export class World {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.w = def.w; this.h = def.h;
    this.minX = -def.w / 2; this.minZ = -def.h / 2;
    this.tiles = new Uint8Array(def.w * def.h);
    this.ground = new Uint8Array(def.w * def.h);      // 地表材质索引
    this.buildings = [];
    this.props = [];
    this.containers = [];
    this.doors = [];
    this.spawnPoints = [];
    this.exitPoints = def.exits.map((e) => ({ ...e }));
    this.lightPoints = [];
    this.rng = new Rng(def.seed);
    this.bounds = {
      minX: this.minX + 1, maxX: this.minX + this.w - 1,
      minZ: this.minZ + 1, maxZ: this.minZ + this.h - 1,
    };
    this.generate();
  }

  idx(tx, tz) { return tz * this.w + tx; }
  inBounds(tx, tz) { return tx >= 0 && tz >= 0 && tx < this.w && tz < this.h; }
  tileAt(tx, tz) { return this.inBounds(tx, tz) ? this.tiles[tz * this.w + tx] : TILE.SOLID; }
  setTile(tx, tz, v) { if (this.inBounds(tx, tz)) this.tiles[tz * this.w + tx] = v; }

  /** 世界坐标 → tile */
  toTile(x, z) { return { tx: Math.floor(x - this.minX), tz: Math.floor(z - this.minZ) }; }
  /** tile 中心 → 世界坐标 */
  toWorld(tx, tz) { return { x: this.minX + tx + 0.5, z: this.minZ + tz + 0.5 }; }

  blocksMove(tx, tz) { const t = this.tileAt(tx, tz); return t === TILE.SOLID || t === TILE.LOW; }
  blocksSight(tx, tz) { const t = this.tileAt(tx, tz); return t === TILE.SOLID || t === TILE.SIGHT; }

  // ---------------- 生成 ----------------
  generate() {
    const d = this.def, r = this.rng;
    // 1. 地表底色
    for (let i = 0; i < this.ground.length; i++) this.ground[i] = 0;
    // 2. 外围围墙（防止走出地图）
    for (let x = 0; x < this.w; x++) { this.setTile(x, 0, TILE.SOLID); this.setTile(x, this.h - 1, TILE.SOLID); }
    for (let z = 0; z < this.h; z++) { this.setTile(0, z, TILE.SOLID); this.setTile(this.w - 1, z, TILE.SOLID); }
    // 3. 道路：两条主街成十字，便于定位与撤离
    this.roadZ = Math.floor(this.h / 2) + r.int(-4, 4);
    this.roadX = Math.floor(this.w / 2) + r.int(-4, 4);
    for (let x = 1; x < this.w - 1; x++) for (let k = -1; k <= 1; k++) this.setGround(x, this.roadZ + k, 1);
    for (let z = 1; z < this.h - 1; z++) for (let k = -1; k <= 1; k++) this.setGround(this.roadX + k, z, 1);

    if (d.theme === 'lab') this.genLab();
    else this.genOutdoor();

    this.genProps();
    this.genExits();
    this.pickSpawn();
  }

  setGround(tx, tz, v) { if (this.inBounds(tx, tz)) this.ground[tz * this.w + tx] = v; }

  /** 室外：把地图切成街区，街区内放建筑 */
  genOutdoor() {
    const d = this.def, r = this.rng;
    const kinds = d.theme === 'industrial' ? ['warehouse', 'factory', 'warehouse']
      : d.theme === 'farm' ? ['barn', 'house', 'barn', 'shop']
        : d.theme === 'storm' ? ['warehouse', 'factory', 'shop']
          : ['house', 'house', 'shop'];
    let tries = 0;
    while (this.buildings.length < d.buildings.count && tries++ < 400) {
      const bw = r.int(d.buildings.minW, d.buildings.maxW);
      const bd = r.int(d.buildings.minD, d.buildings.maxD);
      const tx = r.int(2, this.w - bw - 3);
      const tz = r.int(2, this.h - bd - 3);
      const rect = { tx, tz, w: bw, d: bd };
      if (this.rectOverlaps(rect, 3)) continue;
      if (this.crossesRoad(rect)) continue;
      const kind = r.pick(kinds);
      this.addBuilding(rect, kind);
    }
  }

  /** 室内：J-Lab 单栋大建筑 + 内部隔墙（B1/B2 层用 teleport 切换，此处只生成 B1） */
  genLab() {
    const r = this.rng;
    const m = 4;
    const rect = { tx: m, tz: m, w: this.w - m * 2, d: this.h - m * 2 };
    this.addBuilding(rect, 'lab');
    // 内部房间网：随机切几道隔墙，留出通道
    const b = this.buildings[0];
    for (let i = 0; i < 10; i++) {
      const horiz = r.chance(0.5);
      const len = r.int(6, 16);
      const start = horiz ? r.int(b.tx + 2, b.tx + b.w - len - 2) : r.int(b.tz + 2, b.tz + b.d - len - 2);
      const fixed = horiz ? r.int(b.tz + 3, b.tz + b.d - 4) : r.int(b.tx + 3, b.tx + b.w - 4);
      for (let k = 0; k < len; k++) {
        // 留一个门洞
        if (k === Math.floor(len / 2)) continue;
        const tx = horiz ? start + k : fixed;
        const tz = horiz ? fixed : start + k;
        this.setTile(tx, tz, TILE.SOLID);
      }
    }
  }

  crossesRoad(rect) {
    const { tx, tz, w, d } = rect;
    if (tz - 1 <= this.roadZ + 1 && tz + d + 1 >= this.roadZ - 1) return true;
    if (tx - 1 <= this.roadX + 1 && tx + w + 1 >= this.roadX - 1) return true;
    return false;
  }

  rectOverlaps(rect, pad = 2) {
    for (const b of this.buildings) {
      if (rect.tx - pad < b.tx + b.w && rect.tx + rect.w + pad > b.tx &&
          rect.tz - pad < b.tz + b.d && rect.tz + rect.d + pad > b.tz) return true;
    }
    return false;
  }

  addBuilding(rect, kind) {
    const K = BUILDING_KINDS[kind] || BUILDING_KINDS.house;
    const r = this.rng;
    const b = { ...rect, kind, def: K, containers: [] };
    // 墙体：周长一圈
    for (let x = rect.tx; x < rect.tx + rect.w; x++) {
      this.setTile(x, rect.tz, TILE.SOLID);
      this.setTile(x, rect.tz + rect.d - 1, TILE.SOLID);
    }
    for (let z = rect.tz; z < rect.tz + rect.d; z++) {
      this.setTile(rect.tx, z, TILE.SOLID);
      this.setTile(rect.tx + rect.w - 1, z, TILE.SOLID);
    }
    // 室内地板
    for (let x = rect.tx + 1; x < rect.tx + rect.w - 1; x++)
      for (let z = rect.tz + 1; z < rect.tz + rect.d - 1; z++)
        this.setGround(x, z, kind === 'lab' ? 2 : 1);

    // 门：每面墙随机开 1~2 个洞（贴边开，避免被室内隔墙堵死）
    const openings = [];
    const sides = r.shuffle(['n', 's', 'w', 'e']).slice(0, r.int(1, 2) + 1);
    for (const s of sides) {
      let tx, tz;
      if (s === 'n') { tx = r.int(rect.tx + 2, rect.tx + rect.w - 3); tz = rect.tz; }
      else if (s === 's') { tx = r.int(rect.tx + 2, rect.tx + rect.w - 3); tz = rect.tz + rect.d - 1; }
      else if (s === 'w') { tx = rect.tx; tz = r.int(rect.tz + 2, rect.tz + rect.d - 3); }
      else { tx = rect.tx + rect.w - 1; tz = r.int(rect.tz + 2, rect.tz + rect.d - 3); }
      this.setTile(tx, tz, TILE.OPEN);
      this.setTile(tx + (s === 'w' ? 1 : s === 'e' ? -1 : 0), tz + (s === 'n' ? 1 : s === 's' ? -1 : 0), TILE.OPEN);
      const p = this.toWorld(tx, tz);
      const door = { x: p.x, z: p.z, side: s, hp: 100, barricaded: 0, open: false, kind: 'door' };
      this.doors.push(door);
      openings.push(door);
    }
    b.doors = openings;

    // 窗户：墙上的矮洞（挡人不挡视线 → 可翻越、可射击）
    b.windows = [];
    const winCount = Math.max(2, Math.floor((rect.w + rect.d) / 5));
    for (let i = 0; i < winCount; i++) {
      const s = r.pick(['n', 's', 'w', 'e']);
      let tx, tz;
      if (s === 'n') { tx = r.int(rect.tx + 1, rect.tx + rect.w - 2); tz = rect.tz; }
      else if (s === 's') { tx = r.int(rect.tx + 1, rect.tx + rect.w - 2); tz = rect.tz + rect.d - 1; }
      else if (s === 'w') { tx = rect.tx; tz = r.int(rect.tz + 1, rect.tz + rect.d - 2); }
      else { tx = rect.tx + rect.w - 1; tz = r.int(rect.tz + 1, rect.tz + rect.d - 2); }
      if (this.tileAt(tx, tz) !== TILE.SOLID) continue;
      this.setTile(tx, tz, TILE.LOW);          // 矮窗：可越过视线，不可直接走
      const p = this.toWorld(tx, tz);
      b.windows.push({ x: p.x, z: p.z, tx, tz, side: s, hp: 60, barricaded: 0, glass: r.chance(0.35) });
    }

    // 室内容器
    const pool = this.def.containers;
    for (let i = 0; i < K.containers; i++) {
      const tx = r.int(rect.tx + 1, rect.tx + rect.w - 2);
      const tz = r.int(rect.tz + 1, rect.tz + rect.d - 2);
      if (this.tileAt(tx, tz) !== TILE.OPEN) continue;
      const p = this.toWorld(tx, tz);
      this.containers.push({
        id: `c${this.containers.length}`, kind: r.pick(pool), x: p.x, z: p.z,
        ry: r.float(0, Math.PI * 2), searched: false, indoor: true, building: b,
      });
      this.setTile(tx, tz, TILE.LOW);
    }

    // 室内照明点（夜间的光源可读性）
    this.lightPoints.push({ x: this.minX + rect.tx + rect.w / 2, z: this.minZ + rect.tz + rect.d / 2, r: Math.max(rect.w, rect.d) * 0.5, kind });
    this.buildings.push(b);
  }

  /** 户外道具：按权重撒点，同时写入碰撞网格 */
  genProps() {
    const d = this.def, r = this.rng;
    const order = ['tree', 'rock', 'container', 'car', 'fence', 'barrel', 'sandbag', 'crate'];
    for (const kind of order) {
      const n = d.props[kind] || 0;
      for (let i = 0; i < n; i++) {
        const x = r.float(this.minX + 2, this.minX + this.w - 2);
        const z = r.float(this.minZ + 2, this.minZ + this.h - 2);
        const t = this.toTile(x, z);
        if (this.tileAt(t.tx, t.tz) !== TILE.OPEN) continue;
        if (this.distToBuildings(x, z) < 1.2 && kind !== 'crate') continue;
        const ry = r.float(0, Math.PI * 2);
        this.props.push({ kind, x, z, ry, s: r.float(0.85, 1.2) });
        // 碰撞/遮挡语义
        if (kind === 'tree' || kind === 'container' || kind === 'car') this.setTile(t.tx, t.tz, TILE.SOLID);
        else if (kind === 'fence') this.setTile(t.tx, t.tz, TILE.SIGHT);
        else if (kind === 'sandbag' || kind === 'barrel' || kind === 'crate') this.setTile(t.tx, t.tz, TILE.LOW);
      }
    }
    // 户外散落容器（可搜刮）
    const outdoor = Math.floor((d.buildings?.count || 8) * 0.8);
    for (let i = 0; i < outdoor; i++) {
      const x = r.float(this.minX + 3, this.minX + this.w - 3);
      const z = r.float(this.minZ + 3, this.minZ + this.h - 3);
      const t = this.toTile(x, z);
      if (this.tileAt(t.tx, t.tz) !== TILE.OPEN) continue;
      this.containers.push({
        id: `c${this.containers.length}`, kind: r.pick(d.containers), x, z,
        ry: r.float(0, Math.PI * 2), searched: false, indoor: false,
      });
    }
  }

  distToBuildings(x, z) {
    let best = Infinity;
    for (const b of this.buildings) {
      const cx = this.minX + b.tx + b.w / 2, cz = this.minZ + b.tz + b.d / 2;
      const dx = Math.max(Math.abs(x - cx) - b.w / 2, 0), dz = Math.max(Math.abs(z - cz) - b.d / 2, 0);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  }

  /** 撤离点必须站得住：清掉周围的实心格 */
  genExits() {
    for (const e of this.exitPoints) {
      const t = this.toTile(e.x, e.z);
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++)
          if (this.tileAt(t.tx + dx, t.tz + dz) !== TILE.OPEN) this.setTile(t.tx + dx, t.tz + dz, TILE.OPEN);
      e.r = 3.0;
    }
  }

  pickSpawn() {
    // 优先选一条主街上的开阔点
    const t = this.toTile(0, 0);
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 240; i++) {
      const tx = this.rng.int(3, this.w - 4), tz = this.rng.int(3, this.h - 4);
      if (this.tileAt(tx, tz) !== TILE.OPEN) continue;
      let score = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
        if (this.tileAt(tx + dx, tz + dz) === TILE.OPEN) score++;
      score -= Math.abs(tx - this.roadX) * 0.12 + Math.abs(tz - this.roadZ) * 0.12;
      if (score > bestScore) { bestScore = score; best = { tx, tz }; }
    }
    const p = best ? this.toWorld(best.tx, best.tz) : this.toWorld(t.tx, t.tz);
    this.playerSpawn = { x: p.x, z: p.z };
  }

  /** 随机取一个可站立的点（尸群/拾荒者重生用） */
  randomOpenPoint(rng, awayFrom = null, minDist = 0) {
    for (let i = 0; i < 200; i++) {
      const tx = rng.int(2, this.w - 3), tz = rng.int(2, this.h - 3);
      if (this.tileAt(tx, tz) !== TILE.OPEN) continue;
      const p = this.toWorld(tx, tz);
      if (awayFrom && Math.hypot(p.x - awayFrom.x, p.z - awayFrom.z) < minDist) continue;
      return p;
    }
    return { ...this.playerSpawn };
  }
}
