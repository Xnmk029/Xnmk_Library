// ============================================================
//  level.js — 关卡数据容器（多层瓦片 + 房间 + 门窗 + 容器 + 地面掉落）
// ============================================================

import { FLOORS, WALLS, OBJS, floorDef, wallDef, objDef } from './tiles.js';
import { CONTAINERS } from '../data/loot.js';
import { clamp } from '../core/util.js';

export class Level {
  constructor(w, h, cfg = {}) {
    this.w = w; this.h = h;
    this.cfg = cfg;
    this.id = cfg.id || 'level';
    this.name = cfg.name || '未知区域';
    this.tier = cfg.tier || 1;
    const n = w * h;
    this.floor = new Uint8Array(n);
    this.wall = new Uint8Array(n);
    this.obj = new Uint8Array(n);
    this.room = new Int16Array(n).fill(-1);
    this.build = new Int16Array(n).fill(-1);
    this.solid = new Uint8Array(n);
    this.opaque = new Uint8Array(n);
    this.cover = new Float32Array(n);
    this.vis = new Float32Array(n);        // 当前可见度 0..1
    this.seen = new Uint8Array(n);          // 记忆（探索过的区域）
    this.light = new Float32Array(n);       // 光照
    this.blood = new Uint8Array(n);         // 装饰：羽毛/污渍
    this.objHp = new Map();                 // idx -> 剩余耐久
    this.doors = []; this.doorMap = new Map();
    this.windows = []; this.winMap = new Map();
    this.containers = []; this.contMap = new Map();
    this.ground = new Map();                // idx -> {x,y,items:[]}
    this.rooms = [];                        // {id, build, x,y,w,h, kind, lit}
    this.buildings = [];
    this.lamps = [];                        // {x,y,r,col,needPower}
    this.fires = [];                        // {x,y,r,life,heat}
    this.smokes = [];
    this.extractions = [];
    this.markers = [];                      // 小地图/情报标记
    this.enemies = [];
    this.spawn = { x: (w / 2) | 0, y: (h / 2) | 0 };
    this.powered = false;                   // 是否通电（实验室谜题/基地发电机）
    this.special = {};
  }

  i(x, y) { return y * this.w + x; }
  inB(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  idxOf(x, y) { return ((y | 0) * this.w + (x | 0)); }

  floorAt(x, y) { return this.inB(x, y) ? this.floor[this.i(x, y)] : 0; }
  wallAt(x, y) { return this.inB(x, y) ? this.wall[this.i(x, y)] : 2; }
  objAt(x, y) { return this.inB(x, y) ? this.obj[this.i(x, y)] : 0; }
  roomAt(x, y) { return this.inB(x, y) ? this.room[this.i(x, y)] : -1; }
  isIndoor(x, y) { return this.roomAt(x | 0, y | 0) >= 0; }

  setFloor(x, y, f) { if (this.inB(x, y)) this.floor[this.i(x, y)] = f; }
  setWall(x, y, t) { if (this.inB(x, y)) { this.wall[this.i(x, y)] = t; this.refresh(x, y); } }
  setObj(x, y, t) {
    if (!this.inB(x, y)) return;
    const idx = this.i(x, y);
    this.obj[idx] = t;
    const d = objDef(t);
    if (d) this.objHp.set(idx, d.hp);
    if (d && d.cont) this.addContainer(x, y, d.cont);
    this.refresh(x, y);
  }
  clearObj(x, y) {
    const idx = this.i(x, y);
    this.obj[idx] = 0;
    this.objHp.delete(idx);
    const c = this.contMap.get(idx);
    if (c) { this.contMap.delete(idx); const k = this.containers.indexOf(c); if (k >= 0) this.containers.splice(k, 1); }
    this.refresh(x, y);
  }

  // ---------------- 门 / 窗 ----------------
  addDoor(x, y, o = {}) {
    const d = {
      x, y, open: !!o.open, locked: !!o.locked, card: o.card || null, vert: !!o.vert,
      hp: o.hp || 150, maxhp: o.hp || 150, barricade: 0, barHp: 0, isDoor: true, keyId: o.keyId || null,
    };
    this.doors.push(d); this.doorMap.set(this.i(x, y), d);
    this.refresh(x, y);
    return d;
  }
  addWindow(x, y, o = {}) {
    const wd = {
      x, y, open: false, broken: false, curtain: !!o.curtain, curtainOpen: true,
      vert: !!o.vert, barricade: 0, barHp: 0, hp: 40, isWindow: true,
    };
    this.windows.push(wd); this.winMap.set(this.i(x, y), wd);
    this.refresh(x, y);
    return wd;
  }
  doorAt(x, y) { return this.doorMap.get(this.i(x | 0, y | 0)); }
  winAt(x, y) { return this.winMap.get(this.i(x | 0, y | 0)); }

  // ---------------- 容器 ----------------
  addContainer(x, y, kind) {
    const def = CONTAINERS[kind] || CONTAINERS.crate;
    const c = { x, y, kind, name: def.name, cap: def.cap, items: [], searched: false };
    this.containers.push(c);
    this.contMap.set(this.i(x, y), c);
    return c;
  }
  contAt(x, y) { return this.contMap.get(this.i(x | 0, y | 0)); }

  // ---------------- 地面掉落 ----------------
  groundAt(x, y) { return this.ground.get(this.i(x | 0, y | 0)); }
  dropItem(x, y, item) {
    x = clamp(x | 0, 0, this.w - 1); y = clamp(y | 0, 0, this.h - 1);
    // 若目标格不可通行，找附近可通行格
    if (this.solid[this.i(x, y)]) {
      let found = false;
      for (let r = 1; r <= 3 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            const nx = x + dx, ny = y + dy;
            if (this.inB(nx, ny) && !this.solid[this.i(nx, ny)] && this.floor[this.i(nx, ny)]) { x = nx; y = ny; found = true; }
          }
        }
      }
    }
    const idx = this.i(x, y);
    let g = this.ground.get(idx);
    if (!g) { g = { x, y, items: [] }; this.ground.set(idx, g); }
    // 合并堆叠
    const st = item;
    for (const o of g.items) {
      if (o.id === st.id && o.cond === undefined && o.fresh === undefined && o.water === undefined) {
        o.n += st.n; return g;
      }
    }
    g.items.push(st);
    return g;
  }
  cleanGround(x, y) {
    const idx = this.i(x | 0, y | 0);
    const g = this.ground.get(idx);
    if (g && g.items.length === 0) this.ground.delete(idx);
  }

  // ---------------- 通行 / 视线 ----------------
  refresh(x, y) {
    if (!this.inB(x, y)) return;
    const idx = this.i(x, y);
    const w = wallDef(this.wall[idx]);
    const o = objDef(this.obj[idx]);
    const dr = this.doorMap.get(idx);
    const wn = this.winMap.get(idx);
    let solid = 0, opaque = 0, cov = 0;
    if (this.floor[idx] === 0) { solid = 1; opaque = 1; }
    if (w) { if (w.solid) solid = 1; if (w.opaque) opaque = 1; }
    if (o) {
      if (o.solid) solid = 1;
      if (o.opaque) opaque = 1;
      if (o.cover) cov = Math.max(cov, o.cover);
    }
    if (dr) {
      solid = dr.open ? 0 : 1;
      opaque = dr.open ? 0 : 1;
      if (dr.barricade > 0) { solid = 1; opaque = 1; }
    }
    if (wn) {
      solid = (wn.open || wn.broken) ? 0 : 1;   // 可翻越
      opaque = wn.curtain && !wn.curtainOpen ? 1 : 0;
      if (wn.barricade > 0) { solid = 1; opaque = wn.barricade >= 2 ? 1 : 0; }
      if (!wn.open && !wn.broken) cov = Math.max(cov, 0.15);
    }
    this.solid[idx] = solid;
    this.opaque[idx] = opaque;
    this.cover[idx] = cov;
  }
  rebuildFlags() {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.refresh(x, y);
  }
  isSolid(x, y) { return !this.inB(x | 0, y | 0) ? true : !!this.solid[this.i(x | 0, y | 0)]; }
  isOpaque(x, y) { return !this.inB(x | 0, y | 0) ? true : !!this.opaque[this.i(x | 0, y | 0)]; }
  /** 可翻越（窗/矮墙）：阻挡移动但可交互穿过 */
  climbable(x, y) {
    const wn = this.winAt(x, y);
    if (wn && wn.barricade === 0) return wn;
    return null;
  }
  speedAt(x, y) {
    const f = floorDef(this.floorAt(x | 0, y | 0));
    const o = objDef(this.objAt(x | 0, y | 0));
    let s = f.spd;
    if (o && o.cover) s *= 0.8;
    return s;
  }
  noiseAt(x, y) { return floorDef(this.floorAt(x | 0, y | 0)).noise; }
  wetAt(x, y) { return !!floorDef(this.floorAt(x | 0, y | 0)).wet; }

  /** 对家具/墙体造成伤害 */
  damageStruct(x, y, dmg, opts = {}) {
    if (!this.inB(x, y)) return null;
    const idx = this.i(x, y);
    const dr = this.doorMap.get(idx);
    const wn = this.winMap.get(idx);
    if (dr && dr.barricade > 0) {
      dr.barHp -= dmg;
      if (dr.barHp <= 0) { dr.barricade--; dr.barHp = dr.barricade > 0 ? 80 : 0; }
      this.refresh(x, y); return { kind: 'barricade' };
    }
    if (wn && wn.barricade > 0) {
      wn.barHp -= dmg;
      if (wn.barHp <= 0) { wn.barricade--; wn.barHp = wn.barricade > 0 ? 80 : 0; }
      this.refresh(x, y); return { kind: 'barricade' };
    }
    if (dr && !dr.open) {
      dr.hp -= dmg;
      if (dr.hp <= 0) { dr.open = true; dr.broken = true; dr.locked = false; this.refresh(x, y); return { kind: 'door', destroyed: true }; }
      return { kind: 'door' };
    }
    if (wn && !wn.broken) {
      wn.hp -= dmg;
      if (wn.hp <= 0) { wn.broken = true; this.refresh(x, y); return { kind: 'window', destroyed: true, glass: true }; }
      return { kind: 'window' };
    }
    const ot = this.obj[idx];
    if (ot) {
      const d = objDef(ot);
      let hp = this.objHp.get(idx);
      if (hp === undefined) hp = d.hp;
      hp -= dmg;
      this.objHp.set(idx, hp);
      if (hp <= 0 && !d.act && !d.stash) {
        // 容器内物品掉地
        const c = this.contMap.get(idx);
        if (c) for (const it of c.items) this.dropItem(x, y, it);
        this.clearObj(x, y);
        return { kind: 'obj', destroyed: true, def: d };
      }
      return { kind: 'obj', def: d };
    }
    const wt = this.wall[idx];
    if (wt) {
      const d = wallDef(wt);
      if (d.breach && !opts.breach) return { kind: 'wall', immune: true, def: d };
      let hp = this.objHp.get(idx + 1000000);
      if (hp === undefined) hp = d.hp;
      hp -= dmg;
      this.objHp.set(idx + 1000000, hp);
      if (hp <= 0) {
        this.wall[idx] = 0;
        if (d.drop) this.dropItem(x, y, { id: d.drop[0], n: d.drop[1] });
        this.refresh(x, y);
        return { kind: 'wall', destroyed: true, def: d };
      }
      return { kind: 'wall', def: d };
    }
    return null;
  }

  /** 结构完整度（用于绘制裂纹） */
  structFrac(x, y) {
    const idx = this.i(x, y);
    const ot = this.obj[idx];
    if (ot) { const hp = this.objHp.get(idx); const d = objDef(ot); return hp === undefined ? 1 : clamp(hp / d.hp, 0, 1); }
    const wt = this.wall[idx];
    if (wt) { const hp = this.objHp.get(idx + 1000000); const d = wallDef(wt); return hp === undefined ? 1 : clamp(hp / d.hp, 0, 1); }
    return 1;
  }

  /** 寻找一个空地（用于放置/出生） */
  findOpen(cx, cy, maxR = 12, rng = null) {
    if (!this.isSolid(cx, cy) && this.floorAt(cx, cy)) return { x: cx, y: cy };
    for (let r = 1; r < maxR; r++) {
      const cand = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (this.inB(x, y) && !this.isSolid(x, y) && this.floorAt(x, y)) cand.push({ x, y });
      }
      if (cand.length) return rng ? rng.pick(cand) : cand[0];
    }
    return { x: cx, y: cy };
  }
}
