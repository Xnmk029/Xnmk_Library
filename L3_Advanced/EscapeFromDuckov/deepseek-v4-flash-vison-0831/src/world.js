import { RNG, makeNoise2D, clamp, TAU } from './util.js';

// ============ 世界：网格 / 建筑 / 墙段 / 空间索引 ============
export const TILE = 1;
export const WORLD_SIZE = 200;
export const HALF = WORLD_SIZE / 2;
export const DIRS = [ // 4 向，bitmask: 1=N 2=E 4=S 8=W
  { bit: 1, dx: 0, dz: -1, name: 'n' }, { bit: 2, dx: 1, dz: 0, name: 'e' },
  { bit: 4, dx: 0, dz: 1, name: 's' }, { bit: 8, dx: -1, dz: 0, name: 'w' },
];

export class Wall {
  constructor(x, z, dirBit, type = 'wall') {
    this.x = x; this.z = z; this.dir = dirBit; this.type = type; // wall|door|window|fence|hole|nwall
    this.hp = type === 'door' ? 60 : type === 'window' ? 30 : 200;
    this.maxHp = this.hp;
    this.open = false; this.locked = false; this.barricade = 0;
    this.curtain = false; this.room = null; this.building = null;
    this.smashed = false;
    this.requires = null; // keycard id
    // 墙段几何：位于 (x,z) 与 (x+dx, z+dz) 之间
    if (dirBit === 1)      { this.sx0 = x; this.sz0 = z;   this.sx1 = x + 1; this.sz1 = z; }
    else if (dirBit === 2) { this.sx0 = x + 1; this.sz0 = z; this.sx1 = x + 1; this.sz1 = z + 1; }
    else if (dirBit === 4) { this.sx0 = x; this.sz0 = z + 1; this.sx1 = x + 1; this.sz1 = z + 1; }
    else                   { this.sx0 = x; this.sz0 = z;   this.sx1 = x; this.sz1 = z + 1; }
    this.cx = (this.sx0 + this.sx1) / 2;
    this.cz = (this.sz0 + this.sz1) / 2;
    // 法向（从 base 指向 neighbor）
    if (dirBit === 1)      { this.nx = 0; this.nz = -1; }
    else if (dirBit === 2) { this.nx = 1; this.nz = 0; }
    else if (dirBit === 4) { this.nx = 0; this.nz = 1; }
    else                   { this.nx = -1; this.nz = 0; }
  }
  blocksLos(now) {
    if (this.type === 'hole' || this.smashed && (this.type === 'window' || this.type === 'door')) return false;
    if (this.type === 'window') return this.curtain === true; // 玻璃透光，窗帘挡视线
    if (this.type === 'door') return !this.open;
    return this.type === 'wall' || this.type === 'fence';
  }
  blocksMove(now) { return this.blocksLos(now); }
  doorSwing() { return this.open ? 0.82 : 0; } // 0..1 遮挡比
}

export class World {
  constructor(game) {
    this.game = game;
    this.seed = game.cfg.seed;
    this.rng = new RNG(this.seed);
    this.noise = makeNoise2D(this.seed ^ 0x5eed);
    this.noise2 = makeNoise2D((this.seed ^ 0xfeed) >>> 0);
    this.grid = new Uint8Array(WORLD_SIZE * WORLD_SIZE); // floor type
    this.buildingOf = new Int16Array(WORLD_SIZE * WORLD_SIZE).fill(-1);
    this.roomOf = new Int16Array(WORLD_SIZE * WORLD_SIZE).fill(-1);
    this.walls = new Array(WORLD_SIZE * WORLD_SIZE).fill(0); // bitmask
    this.wallObjs = new Map(); // "x,z,bit" -> Wall
    this.buildings = []; this.rooms = [];
    this.containers = []; this.doors = []; this.windows = [];
    this.trees = []; this.lake = { x: 0, z: 0, r: 0 };
    this.buckets = new Map(); // "bx,bz" -> Set<entity>
    this._lastId = 1;
    this.farmPlots = new Map(); // "x,z" -> {water, growth, planted}
    this.fires = new Map(); // "x,z" -> {fuel, lit, big}
  }
  idx(x, z) { return z * WORLD_SIZE + x; }
  inBounds(x, z) { return x >= 0 && z >= 0 && x < WORLD_SIZE && z < WORLD_SIZE; }
  cell(x, z) { const i = this.idx(x, z); return { t: this.grid[i], b: this.buildingOf[i], r: this.roomOf[i] }; }
  bucketKey(x, z) { return Math.floor(x / 8) + ',' + Math.floor(z / 8); }
  addToBucket(e) {
    e.bucket = this.bucketKey(e.x, e.z);
    if (!this.buckets.has(e.bucket)) this.buckets.set(e.bucket, new Set());
    this.buckets.get(e.bucket).add(e);
  }
  moveBucket(e, nx, nz) {
    const k = this.bucketKey(nx, nz);
    if (k === e.bucket) return;
    this.buckets.get(e.bucket)?.delete(e);
    e.bucket = k;
    if (!this.buckets.has(k)) this.buckets.set(k, new Set());
    this.buckets.get(k).add(e);
  }
  removeFromBucket(e) { this.buckets.get(e.bucket)?.delete(e); e.bucket = null; }
  entitiesNear(x, z, r, out = []) {
    const bx0 = Math.floor((x - r) / 8), bx1 = Math.floor((x + r) / 8);
    const bz0 = Math.floor((z - r) / 8), bz1 = Math.floor((z + r) / 8);
    for (let bz = bz0; bz <= bz1; bz++) for (let bx = bx0; bx <= bx1; bx++) {
      const set = this.buckets.get(bx + ',' + bz);
      if (set) for (const e of set) if (Math.abs(e.x - x) <= r && Math.abs(e.z - z) <= r) out.push(e);
    }
    return out;
  }
  wallAt(x, z, bit) { return this.wallObjs.get(x + ',' + z + ',' + bit) || null; }
  setWall(x, z, bit, wall) {
    if (wall) { this.walls[this.idx(x, z)] |= bit; this.wallObjs.set(x + ',' + z + ',' + bit, wall); }
    else { this.walls[this.idx(x, z)] &= ~bit; this.wallObjs.delete(x + ',' + z + ',' + bit); }
  }
  // 相邻墙：查找当前格与其邻居格中登记的该方向墙段
  neighborWall(x, z, d) {
    let w = this.wallAt(x, z, d.bit);
    if (w) return w;
    const nx = x + d.dx, nz = z + d.dz;
    if (!this.inBounds(nx, nz)) return null;
    const opp = d.bit === 1 ? 4 : d.bit === 4 ? 1 : d.bit === 2 ? 8 : 2;
    return this.wallAt(nx, nz, opp);
  }
  // 包围盒内可站立（无墙且非界外）
  circleFree(cx, cz, r, me) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = Math.floor(cx + dx * r), z = Math.floor(cz + dz * r);
      if (!this.inBounds(x, z)) return false;
      for (const d of DIRS) { const w = this.neighborWall(x, z, d); if (w && w.blocksMove()) return false; }
    }
    return true;
  }
  // 视线：DDA 网格射线，返回第一个阻挡的墙
  losBlocked(ax, az, bx, bz) {
    let x = Math.floor(ax), z = Math.floor(az);
    const tx = Math.floor(bx), tz = Math.floor(bz);
    const dx = bx - ax, dz = bz - az;
    const stepX = Math.sign(dx) || 1, stepZ = Math.sign(dz) || 1;
    const tdx = dx === 0 ? 1e9 : 1 / Math.abs(dx), tdz = dz === 0 ? 1e9 : 1 / Math.abs(dz);
    let tmx = tdx * (stepX > 0 ? (x + 1 - ax) : (ax - x)), tmz = tdz * (stepZ > 0 ? (z + 1 - az) : (az - z));
    let guard = 0;
    while (x !== tx || z !== tz) {
      if (++guard > 600) return true;
      if (tmx < tmz) {
        // 穿越垂直边（E/W）：由当前格向外检查
        const d = stepX > 0 ? DIRS[1] : DIRS[3];
        const w = this.neighborWall(x, z, d);
        if (w && w.blocksLos()) return true;
        tmx += tdx; x += stepX;
      } else {
        const d = stepZ > 0 ? DIRS[2] : DIRS[0];
        const w = this.neighborWall(x, z, d);
        if (w && w.blocksLos()) return true;
        tmz += tdz; z += stepZ;
      }
    }
    return false;
  }
  // 视锥：玩家 -> 目标，含"半遮挡"（门窗开启状态）
  losFactor(ax, az, bx, bz) {
    if (this.losBlocked(ax, az, bx, bz)) return 0;
    return 1;
  }

  // ---------- 移动碰撞（圆形 vs 墙段） ----------
  moveCircle(cx, cz, r, dx, dz) {
    let nx = cx + dx, nz = cz + dz;
    if (!this.inBounds(Math.floor(nx), Math.floor(nz))) { nx = cx; nz = cz; }
    for (let oo = 0; oo < 2; oo++) {
      const gx = Math.floor(nx), gz = Math.floor(nz);
      let hitAny = false;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const x = gx + ox, z = gz + oy;
        if (!this.inBounds(x, z)) continue;
        const mask = this.walls[this.idx(x, z)];
        for (const d of DIRS) {
          if (!(mask & d.bit)) continue;
          const w = this.wallAt(x, z, d.bit);
          if (!w || !w.blocksMove()) continue;
          const ax = w.sx0, az = w.sz0, bx = w.sx1, bz = w.sz1;
          const ex = bx - ax, ez = bz - az;
          const l2 = ex * ex + ez * ez || 1;
          let t = ((nx - ax) * ex + (nz - az) * ez) / l2;
          t = clamp(t, 0, 1);
          const px = ax + ex * t, pz = az + ez * t;
          let rx = nx - px, rz = nz - pz;
          const d2 = rx * rx + rz * rz;
          if (d2 < r * r) {
            const dist = Math.sqrt(d2) || 1e-6;
            rx /= dist; rz /= dist;
            nx = px + rx * r; nz = pz + rz * r;
            hitAny = true;
          }
        }
      }
      if (!hitAny) break;
    }
    return { x: nx, z: nz, hit: false };
  }

  // ---------- 搜索：容器/门/窗 ----------
  findContainer(x, z, r) {
    let best = null, bd = r;
    for (const c of this.containers) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  findWallInteract(x, z, r) {
    let best = null, bd = r;
    for (const w of this.wallObjs.values()) {
      if (w.type !== 'door' && w.type !== 'window') continue;
      const d = Math.hypot(w.cx - x, w.cz - z);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }
  findDoorNear(x, z, r) { return this.findWallInteract(x, z, r); }

  // ---------- 世界生成 ----------
  generate() {
    this.genTerrain();
    this.genTown();
    this.genForest();
    this.genLoot();
    this.game.log('世界已生成：鸭科夫郡 · 穆德劳镇');
  }
  floorAt(x, z) {
    if (!this.inBounds(x, z)) return 1;
    const t = this.grid[this.idx(x, z)];
    return t;
  }
  genTerrain() {
    const g = this.grid;
    for (let z = 0; z < WORLD_SIZE; z++) for (let x = 0; x < WORLD_SIZE; x++) {
      const n = this.noise(x * 0.035, z * 0.035);
      g[this.idx(x, z)] = n > 0.12 ? 3 : 2; // 草 / 泥土
    }
  }
  carveRoad(x0, z0, x1, z1) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        if (this.inBounds(x, z)) this.grid[this.idx(x, z)] = 0;
  }
  addBuilding(b) {
    b.id = this.buildings.length;
    this.buildings.push(b);
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) this.buildingOf[this.idx(x, z)] = b.id;
  }
  addRoom(r, b) {
    r.id = this.rooms.length;
    r.building = b;
    this.rooms.push(r);
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) { this.roomOf[this.idx(x, z)] = r.id; this.grid[this.idx(x, z)] = b.floorType; }
    return r;
  }
  mkWall(x, z, bit, type, b = null, room = null) {
    const existing = this.wallAt(x, z, bit);
    if (existing) {
      if (type !== 'wall' && existing.type === 'wall') {
        existing.type = type; existing.hp = type === 'door' ? 60 : 30; existing.maxHp = existing.hp;
        existing.building = b; existing.room = room;
        if (type === 'door') this.doors.push(existing);
        if (type === 'window') this.windows.push(existing);
      }
      return existing;
    }
    const w = new Wall(x, z, bit, type);
    w.building = b; w.room = room;
    this.setWall(x, z, bit, w);
    if (type === 'door') this.doors.push(w);
    if (type === 'window') this.windows.push(w);
    return w;
  }
  addDoor(x, z, bit, b, room) { return this.mkWall(x, z, bit, 'door', b, room); }
  addWindow(x, z, bit, b, room) { return this.mkWall(x, z, bit, 'window', b, room); }
  addContainer(c) {
    c.id = this._lastId++;
    this.containers.push(c);
    this.addToBucket(c);
    return c;
  }
  addTree(x, z, s = 1) { const t = { x, z, s, bucket: null }; this.trees.push(t); this.addToBucket(t); return t; }
  addFire(f) { this.fires.set(f.x + ',' + f.z, f); return f; }

  genTown() {
    // 区域：downtown 中心，residential 周围，farm 南侧
    const c = HALF;
    this.carveRoad(c - 2, 0, c - 2, WORLD_SIZE - 1);
    this.carveRoad(c + 2, 0, c + 2, WORLD_SIZE - 1);
    this.carveRoad(0, c + 44, WORLD_SIZE - 1, c + 44);
    this.carveRoad(0, c + 10, WORLD_SIZE - 1, c + 10);
    this.carveRoad(c - 14, 0, c - 14, WORLD_SIZE - 1);

    const B = (x0, z0, x1, z1, floor, opts = {}) => {
      const b = { x0, z0, x1, z1, floorType: floor, rooms: [], roof: null, type: opts.type || 'house', name: opts.name || '建筑' };
      this.addBuilding(b);
      // 外墙
      for (let x = x0; x <= x1; x++) { this.mkWall(x, z0, 1, 'wall', b); this.mkWall(x, z1 + 1, 1, 'wall', b); }
      for (let z = z0; z <= z1; z++) { this.mkWall(x0, z, 2, 'wall', b); this.mkWall(x1 + 1, z, 2, 'wall', b); }
      return b;
    };
    const room = (b, x0, z0, x1, z1, opts = {}) => {
      const r = { x0, z0, x1, z1, type: opts.type || 'room', name: opts.name || '房间', loot: opts.loot || 'shelf', containers: [], plants: [] };
      this.addRoom(r, b);
      b.rooms.push(r);
      // 内墙与开口
      if (x0 > b.x0) for (let z = z0; z <= z1; z++) this.mkWall(x0, z, 2, 'wall', b, r);
      if (z0 > b.z0) for (let x = x0; x <= x1; x++) this.mkWall(x, z0, 1, 'wall', b, r);
      return r;
    };
    const doorIn = (r, d) => { // d: DIRS 索引
      const dd = DIRS[d];
      const x = dd.dx === 1 ? r.x1 : dd.dx === -1 ? r.x0 : this.rng.int(r.x0 + 1, r.x1 - 1);
      const z = dd.dz === 1 ? r.z1 : dd.dz === -1 ? r.z0 : this.rng.int(r.z0 + 1, r.z1 - 1);
      return this.addDoor(x, z, dd.bit, r.building, r);
    };
    const windowIn = (r, d, x = null) => {
      const dd = DIRS[d];
      const wx = dd.dx !== 0 ? (dd.dx === 1 ? r.x1 + 1 : r.x0) : x;
      const wz = dd.dz !== 0 ? (dd.dz === 1 ? r.z1 + 1 : r.z0) : x;
      return this.addWindow(wx, wz, dd.bit, r.building, r);
    };
    const box = (r, x, z, t, opts = {}) => {
      const ctr = { x: x + 0.5, z: z + 0.5, type: t, room: r, items: [], searched: false, open: false, cap: opts.cap || 20, loot: opts.loot || 'shelf', name: opts.name || '容器', bucket: null };
      r.containers.push(ctr);
      return this.addContainer(ctr);
    };
    const houseShell = (x0, z0, w, h, opts) => {
      const b = B(x0, z0, x0 + w - 1, z0 + h - 1, opts.floor === 'concrete' ? 1 : 1, opts);
      const r = room(b, b.x0, b.z0, b.x1, b.z1, { type: 'living', name: opts.name + '·室内', loot: opts.loot || 'house' });
      doorIn(r, this.rng.pick([1, 3, 0, 2]));
      windowIn(r, 1); windowIn(r, 3); if (this.rng.chance(0.7)) windowIn(r, 0); if (this.rng.chance(0.7)) windowIn(r, 2);
      return { b, r };
    };
    const findDoorCell = (r) => {
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++)
        for (const d of DIRS) { const w = this.neighborWall(x, z, d); if (w && w.type === 'door' && !w.locked) return { x: x + 0.5, z: z + 0.5 }; }
      return { x: (r.x0 + r.x1) / 2 + 0.5, z: (r.z0 + r.z1) / 2 + 0.5 };
    };

    this.spawnPoint = null;
    const c0 = HALF;

    // ===== 住宅区 =====
    for (let i = 0; i < 10; i++) {
      const x = c0 - 60 + this.rng.int(-2, 44), z = c0 - 46 + this.rng.int(0, 80);
      if (this.rng.chance(0.6) && i > 0) continue;
      const w = this.rng.int(6, 10), h = this.rng.int(6, 9);
      const { b, r } = houseShell(x, z, w, h, { type: 'house', name: '民宅 #' + i, loot: 'house' });
      box(r, r.x0 + 1, r.z0 + 1, 'fridge', { loot: 'fridge', name: '冰箱' });
      box(r, r.x1 - 1, r.z0 + 1, 'counter', { loot: 'kitchen', name: '橱柜' });
      box(r, r.x0 + 1, r.z1 - 1, 'wardrobe', { loot: 'wardrobe', name: '衣柜' });
      box(r, r.x1 - 1, r.z1 - 1, 'shelf', { loot: 'shelf', name: '书架' });
      if (this.rng.chance(0.5)) box(r, r.x0 + 2, r.z0 + 2, 'shelf', { loot: 'shelf', name: '壁柜' });
      if (!this.spawnPoint && i === 0) {
        this.spawnPoint = findDoorCell(r);
        const spawnDoor = r.building && this.doors.find(d => d.building === r.building);
        if (spawnDoor) spawnDoor.open = true;
      }
      if (this.rng.chance(0.6)) {
        const wl = windowIn(r, this.rng.pick([1, 3]));
        wl.smashed = true;
      }
    }

    // ===== 商业区 =====
    const shops = [
      { name: '便利店', loot: 'shop', w: 10, h: 8, floor: 'concrete', containers: [['fridge', '冰箱'], ['shelf', '货架'], ['counter', '收银台']] },
      { name: '药店', loot: 'pharmacy', w: 8, h: 7, floor: 'concrete', containers: [['counter', '药柜'], ['counter', '处方台']] },
      { name: '五金店', loot: 'hardware', w: 9, h: 8, floor: 'concrete', containers: [['shelf', '工具架'], ['counter', '柜台']] },
      { name: '餐厅', loot: 'restaurant', w: 11, h: 8, floor: 'concrete', containers: [['fridge', '冰柜'], ['counter', '后厨'], ['shelf', '储藏架']] },
      { name: '书店', loot: 'bookstore', w: 8, h: 7, floor: 'concrete', containers: [['shelf', '书架'], ['shelf', '畅销区']] },
    ];
    let sx = c0 - 5;
    shops.forEach((s, i) => {
      const x0 = sx, z0 = c0 - 4;
      sx += s.w + 2;
      const b = B(x0, z0, x0 + s.w - 1, z0 + s.h - 1, 1, { type: 'shop', name: s.name, loot: s.loot });
      const r = room(b, b.x0, b.z0, b.x1, b.z1, { type: 'shop', name: s.name, loot: s.loot });
      doorIn(r, 1);
      windowIn(r, 0); windowIn(r, 2); windowIn(r, 1);
      s.containers.forEach(([t, n], ci) => {
        const x = r.x0 + 1 + ci * 2.4, z = r.z0 + 2 + (ci % 2) * 3;
        if (x < r.x1 - 1) box(r, Math.floor(x), z, t, { loot: s.loot, name: n });
      });
      b.type = 'shop';
    });

    // ===== 警局（含军械库） =====
    {
      const x0 = c0 - 5, z0 = c0 - 22;
      const b = B(x0, z0, x0 + 13, z0 + 12, 1, { type: 'police', name: '穆德劳警局' });
      const hall = room(b, b.x0, b.z0, b.x1, b.z0 + 7, { type: 'police', name: '警局大厅', loot: 'police' });
      const armory = room(b, b.x0, b.z0 + 8, b.x1, b.z1, { type: 'armory', name: '军械库', loot: 'armory' });
      doorIn(hall, 1);
      const armDoor = doorIn(armory, 1); armDoor.locked = true; armDoor.requires = 'keycard_blue';
      windowIn(hall, 1); windowIn(hall, 3);
      box(hall, hall.x0 + 2, hall.z0 + 2, 'counter', { loot: 'police', name: '档案柜' });
      box(hall, hall.x1 - 3, hall.z0 + 2, 'shelf', { loot: 'police', name: '证物架' });
      box(hall, hall.x0 + 3, hall.z1 - 1, 'wardrobe', { loot: 'wardrobe', name: '更衣柜' });
      box(armory, armory.x0 + 2, armory.z0 + 1, 'gunrack', { loot: 'armory', name: '枪架' });
      box(armory, armory.x1 - 2, armory.z0 + 1, 'gunrack', { loot: 'armory', name: '弹药柜' });
      box(armory, armory.x0 + 3, armory.z1 - 1, 'counter', { loot: 'armory', name: '装备箱' });
      b.armory = armory;
    }

    // ===== 加油站 =====
    {
      const x0 = c0 + 16, z0 = c0 + 26;
      const b = B(x0, z0, x0 + 7, z0 + 6, 1, { type: 'gas', name: '鸭科夫加油站' });
      const r = room(b, b.x0, b.z0, b.x1, b.z1, { type: 'gas', name: '加油站便利店', loot: 'gas' });
      doorIn(r, 1); windowIn(r, 0); windowIn(r, 2);
      box(r, r.x0 + 1, r.z0 + 1, 'fridge', { loot: 'gas', name: '饮料柜' });
      box(r, r.x1 - 2, r.z0 + 1, 'counter', { loot: 'gas', name: '收银台' });
      box(r, r.x0 + 2, r.z1 - 1, 'shelf', { loot: 'hardware', name: '杂物架' });
      this.gasStation = { x: x0 + 4, z: z0 - 2, r };
    }

    // ===== 农舍 + 农田 =====
    {
      const x0 = c0 - 40, z0 = c0 + 40;
      const { b, r } = houseShell(x0, z0, 9, 7, { type: 'farm', name: '老鸭农舍', loot: 'farm' });
      box(r, r.x0 + 1, r.z0 + 1, 'fridge', { loot: 'farm', name: '地窖' });
      box(r, r.x1 - 1, r.z0 + 1, 'shelf', { loot: 'farm', name: '农具架' });
      for (let i = 0; i < 6; i++) {
        const px = x0 - 14 + (i % 3) * 7, pz = z0 - 2 + Math.floor(i / 3) * 6;
        for (let j = 0; j < 5; j++) this.farmPlots.set((px + j) + ',' + pz, { water: 0.5, growth: this.rng.range(0, 0.9), planted: this.rng.chance(0.7) });
      }
      this.well = { x: x0 - 8, z: z0 + 2 };
      this.farm = { x: x0, z: z0, r };
    }

    // ===== 东侧撤离公路 =====
    {
      const x = WORLD_SIZE - 24;
      this.carveRoad(x - 4, 0, x + 4, WORLD_SIZE - 1);
      this.extract = { x: x + 0.5, z: c0 + 6, r: 2.2 };
      this.car = { x: x - 1, z: c0 - 6, fixed: 0, parts: { battery: false, fuel: false, engine: false } };
      this.checkpoint = { x: x + 6, z: c0 - 2 };
      // 撤离点西侧的检查站军械库
      const b = B(x + 2, c0 - 8, x + 9, c0 + 2, 1, { type: 'military', name: '撤离检查站' });
      const r = room(b, b.x0, b.z0, b.x1, b.z1, { type: 'military', name: '检查站军械库', loot: 'military' });
      const d = doorIn(r, 3); d.locked = true; d.requires = 'keycard_red';
      box(r, r.x0 + 2, r.z0 + 1, 'gunrack', { loot: 'military', name: '制式枪架' });
      box(r, r.x1 - 2, r.z0 + 1, 'gunrack', { loot: 'military', name: '弹药箱' });
      box(r, r.x0 + 2, r.z1 - 1, 'counter', { loot: 'military', name: '装备柜' });
    }

    // ===== 湖泊 =====
    this.lake = { x: c0 - 46, z: c0 + 70, r: 9 };
    for (let dz = -10; dz <= 10; dz++) for (let dx = -10; dx <= 10; dx++) {
      const d = Math.hypot(dx, dz);
      if (d < this.lake.r && this.inBounds(this.lake.x + dx, this.lake.z + dz)) {
        this.grid[this.idx(this.lake.x + dx, this.lake.z + dz)] = 4; // 水
      }
    }
    // 主干道洒点僵尸热点（随后在 zombie manager 生成）
  }

  genForest() {
    const avoid = (x, z) => {
      const b = this.buildingOf[this.idx(x, z)];
      return b >= 0 || Math.hypot(x - HALF, z - HALF) < 26;
    };
    for (let i = 0; i < 900; i++) {
      const x = this.rng.int(2, WORLD_SIZE - 3), z = this.rng.int(2, WORLD_SIZE - 3);
      if (avoid(x, z)) continue;
      const n = this.noise2(x * 0.05, z * 0.05);
      if (n > 0.25) { this.addTree(x + 0.5, z + 0.5, this.rng.range(0.8, 1.5)); }
      else if (n > 0.12 && this.rng.chance(0.6)) { this.addTree(x + 0.5, z + 0.5, this.rng.range(0.5, 0.9)); }
    }
  }

  genLoot() {
    // 占位：具体搜刮逻辑在 loot.js
  }

  nearestContainer(x, z, maxR = 2) {
    let best = null, bd = maxR;
    for (const c of this.containers) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}
