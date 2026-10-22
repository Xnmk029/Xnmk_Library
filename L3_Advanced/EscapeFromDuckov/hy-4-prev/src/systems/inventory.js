// 背包（网格制）+ 装备栏 + 容器搜刮。
// 网格坐标是唯一的真源：物品按 w×h 占格，移动/取出/放入都做重叠校验。
import { ITEMS, itemDef } from '../data/items.js';
import { MEDICAL } from '../data/medical.js';
import { WEAPONS } from '../data/weapons.js';
import { rollLoot } from '../data/loot.js';
import { COMBAT } from '../data/balance.js';

export class Grid {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.cells = new Int32Array(w * h).fill(-1);
    this.items = new Map();          // uid → {uid, id, count, x, y, w, h}
    this._uid = 1;
  }
  at(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? -2 : this.cells[y * this.w + x]; }
  free(x, y, w, h, ignore = -1) {
    if (x < 0 || y < 0 || x + w > this.w || y + h > this.h) return false;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const v = this.at(x + i, y + j);
        if (v !== -1 && v !== ignore) return false;
      }
    }
    return true;
  }
  place(x, y, w, h, uid) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.cells[(y + j) * this.w + (x + i)] = uid;
  }
  clear(uid) {
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === uid) this.cells[i] = -1;
  }
  /** 找第一个能放下的位置，找不到返回 null */
  findSpot(w, h) {
    for (let y = 0; y <= this.h - h; y++) {
      for (let x = 0; x <= this.w - w; x++) if (this.free(x, y, w, h)) return { x, y };
    }
    return null;
  }
  add(id, count = 1) {
    const def = itemDef(id);
    if (!def) return null;
    const [w, h] = def.grid || [1, 1];
    // 可堆叠且已有同 id 的格子 → 直接累加
    const stack = def.stack || (def.cat === 'ammo' ? 999 : def.cat === 'valuable' && id === 'cash' ? 9999 : 0);
    if (stack) {
      for (const it of this.items.values()) {
        if (it.id === id && it.count < stack) {
          const take = Math.min(count, stack - it.count);
          it.count += take;
          count -= take;
          if (count <= 0) return it;
        }
      }
    }
    let first = null;
    while (count > 0) {
      const spot = this.findSpot(w, h);
      if (!spot) break;
      const uid = this._uid++;
      const take = stack ? Math.min(count, stack) : 1;
      const it = { uid, id, count: take, x: spot.x, y: spot.y, w, h };
      this.items.set(uid, it);
      this.place(spot.x, spot.y, w, h, uid);
      count -= take;
      if (!first) first = it;
      if (!stack) break;
    }
    return first;
  }
  remove(uid, count = Infinity) {
    const it = this.items.get(uid);
    if (!it) return 0;
    const take = Math.min(count, it.count);
    it.count -= take;
    if (it.count <= 0) { this.clear(uid); this.items.delete(uid); }
    return take;
  }
  move(uid, x, y) {
    const it = this.items.get(uid);
    if (!it) return false;
    if (!this.free(x, y, it.w, it.h, uid)) return false;
    this.clear(uid);
    this.place(x, y, it.w, it.h, uid);
    it.x = x; it.y = y;
    return true;
  }
  get totalWeight() {
    let s = 0;
    for (const it of this.items.values()) s += (itemDef(it.id)?.weight ?? 0.1) * (it.count || 1);
    return s;
  }
  countOf(id) {
    let n = 0;
    for (const it of this.items.values()) if (it.id === id) n += it.count;
    return n;
  }
}

/** 装备槽：主武器 / 副武器 / 近战（死亡不掉落）/ 头盔 / 护甲 / 背包 */
export const SLOTS = ['primary', 'secondary', 'melee', 'head', 'body', 'backpack'];

export class Loadout {
  constructor() {
    this.primary = null; this.secondary = null; this.melee = null;
    this.head = null; this.body = null; this.backpack = null;
  }
  set(slot, item) { if (SLOTS.includes(slot)) this[slot] = item; }
  get(slot) { return this[slot] ?? null; }
  get armorLevel() { return this.body?.armorLevel ?? 0; }
  get headLevel() { return this.head?.armorLevel ?? 0; }
  get capacity() { return this.backpack?.capacity ?? 8; }
}

/** 玩家的全部携带物 */
export class Inventory {
  constructor(gridW = 8, gridH = 6) {
    this.grid = new Grid(gridW, gridH);
    this.loadout = new Loadout();
    this.safe = new Grid(2, 2);            // 保险箱：死亡不掉落
    this.weight = 0;
    this.capacity = 8;
  }

  addItem(id, count = 1) { return this.grid.add(id, count); }
  removeItem(uid, count) { return this.grid.remove(uid, count); }

  /** 装备：把背包里的物品装到槽位（原槽位的退回背包） */
  equip(uid) {
    const it = this.grid.items.get(uid);
    if (!it) return false;
    const def = itemDef(it.id);
    if (!def) return false;
    let slot = null;
    if (WEAPONS[it.id]) slot = WEAPONS[it.id].kind === 'melee' ? 'melee'
      : WEAPONS[it.id].kind === 'pistol' ? 'secondary' : 'primary';
    else if (def.cat === 'armor') slot = def.slot === 'head' ? 'head' : 'body';
    else if (def.cat === 'backpack') slot = 'backpack';
    if (!slot) return false;
    const old = this.loadout.get(slot);
    this.loadout.set(slot, it);
    this.grid.remove(uid, Infinity);
    if (old) this.grid.add(old.id, old.count || 1);
    this.recalc();
    return true;
  }

  unequip(slot) {
    const it = this.loadout.get(slot);
    if (!it) return false;
    if (!this.grid.add(it.id, it.count || 1)) return false;
    this.loadout.set(slot, null);
    this.recalc();
    return true;
  }

  recalc() {
    this.capacity = this.loadout.capacity;
    this.weight = this.grid.totalWeight + this.safe.totalWeight
      + SLOTS.reduce((s, k) => s + (this.loadout.get(k) ? (itemDef(this.loadout.get(k).id)?.weight ?? 0) : 0), 0);
    return this.weight;
  }

  get loadRatio() { return this.capacity > 0 ? this.weight / this.capacity : 2; }

  /** 超重时按 Heavy Load 档位持续掉血（PZ 行为） */
  overloadDrain(dtSeconds) {
    const r = this.loadRatio;
    if (r <= 1.5) return 0;
    return (r - 1.5) * 0.9 * dtSeconds;
  }
}

/** 容器搜刮：生成战利品并标记已搜 */
export function searchContainer(container, tableId, rng, lucky = 0) {
  if (container.searched) return [];
  container.searched = true;
  return rollLoot(rng, tableId, container.kind, lucky);
}

/** 使用物品：吃东西 / 喝水 / 医疗 / 弹药装填 */
export function useItem(uid, game) {
  const inv = game.inventory;
  const it = inv.grid.items.get(uid);
  if (!it) return { ok: false, reason: '物品不存在' };
  const def = itemDef(it.id);
  const med = MEDICAL[it.id];
  if (med) {
    const r = game.health.use(it.id);
    if (r.ok) inv.grid.remove(uid, 1);
    return r;
  }
  const n = game.health.needs;
  if (def?.hunger) n.hunger = Math.max(0, n.hunger + def.hunger);
  if (def?.thirst) n.thirst = Math.max(0, n.thirst + def.thirst);
  if (def?.calories) n.calories = (n.calories || 0) + def.calories;
  if (def?.poison && Math.random() < def.poison) {
    n.foodPoisoning = true;
    game.toast?.('这东西吃下去感觉不太对', 'bad');
  }
  if (def?.cat === 'ammo') {
    const key = `${def.caliber}_${def.tier ?? 1}`;
    game.reserveAmmo = game.reserveAmmo || {};
    game.reserveAmmo[key] = (game.reserveAmmo[key] || 0) + (def.count || 30) * it.count;
  }
  inv.grid.remove(uid, 1);
  return { ok: true, msg: `使用了 ${def?.name ?? it.id}` };
}

export const CARRY_BASE = COMBAT.carry.base;
