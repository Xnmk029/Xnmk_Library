// ============================================================
//  inventory.js — 背包与物品工具（堆叠 / 计数 / 取用 / 负重）
// ============================================================
import { itemDef, itemWeight } from '../data/items.js';

export function invWeight(inv) {
  let w = 0;
  for (const it of inv) w += itemWeight(it) * (it.n || 1);
  return w;
}
export function countOf(inv, id) {
  let n = 0;
  for (const it of inv) if (it.id === id) n += it.n || 1;
  return n;
}
export function firstOf(inv, id) { return inv.find(it => it.id === id) || null; }

/** 匹配：同 id 且 extra 关键字段相同才堆叠 */
function sameStack(a, b) {
  if (a.id !== b.id) return false;
  const ea = a.extra || {}, eb = b.extra || {};
  const keys = new Set([...Object.keys(ea), ...Object.keys(eb)]);
  for (const k of keys) if (JSON.stringify(ea[k]) !== JSON.stringify(eb[k])) return false;
  return true;
}

/** 添加物品，尽量堆叠。返回是否成功放入（超重返回 false 仍会放入但标记） */
export function addItem(inv, item, cap = Infinity) {
  const def = itemDef(item.id);
  if (def.stack) {
    for (const it of inv) if (sameStack(it, item)) { it.n = (it.n || 1) + (item.n || 1); return true; }
  }
  inv.push(item);
  return true;
}

/** 取用 n 个指定 id 物品，不足返回实际可取数（并修改 inv） */
export function takeItems(inv, id, n) {
  let need = n, got = 0;
  for (let i = inv.length - 1; i >= 0 && need > 0; i--) {
    const it = inv[i];
    if (it.id !== id) continue;
    const take = Math.min(need, it.n || 1);
    it.n -= take; need -= take; got += take;
    if (it.n <= 0) inv.splice(i, 1);
  }
  return got;
}

/** 移除指定物品实例 */
export function removeItem(inv, item) {
  const i = inv.indexOf(item);
  if (i >= 0) inv.splice(i, 1);
}

/** 按谓词查找 */
export function findItem(inv, pred) { return inv.find(pred) || null; }

export function sortInv(inv) {
  const rank = { gun: 0, melee: 1, armor: 2, helm: 3, pack: 4, ammo: 5, med: 6, food: 7, drink: 8, att: 9, tool: 10, mat: 11, book: 12, key: 13, throw: 14, misc: 15 };
  inv.sort((a, b) => {
    const da = itemDef(a.id), db = itemDef(b.id);
    return (rank[da.cls] ?? 20) - (rank[db.cls] ?? 20) || (a.id < b.id ? -1 : 1);
  });
  return inv;
}
