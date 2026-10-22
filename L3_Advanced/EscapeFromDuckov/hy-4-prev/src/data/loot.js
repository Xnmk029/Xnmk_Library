// 战利品表：按容器类型与地图主题分配。权重 w 越大越常见。
import { LOOT } from './balance.js';

const E = (id, w, n = [1, 1]) => ({ id, w, n });

export const LOOT_TABLES = {
  town: {
    cabinet: [E('canned_food', 26), E('water_bottle', 20), E('ammo_9mm', 14), E('scrap', 12),
      E('nail', 10), E('bandage', 14), E('painkillers', 8), E('cash', 18, [10, 60]), E('keycardGreen', 1.2)],
    fridge: [E('canned_food', 30), E('water_bottle', 26), E('raw_meat', 10), E('cooked_meat', 6)],
    shelf: [E('scrap', 20), E('wire', 14), E('nail', 16), E('electronic', 6), E('battery', 10), E('plank', 8)],
    crate: [E('scrap', 18), E('plank', 14), E('ammo_9mm', 10), E('nail', 12), E('fuel', 4)],
    toolbox: [E('scrap', 18), E('wire', 14), E('electronic', 8), E('gunpowder', 6), E('sledgehammer', 3)],
    cardboard: [E('scrap', 14), E('canned_food', 12), E('cash', 10, [5, 40])],
    default: [E('scrap', 20), E('canned_food', 16), E('water_bottle', 12), E('cash', 14, [5, 50])],
  },
  industrial: {
    crate: [E('scrap', 24), E('plank', 16), E('ammo_762', 12), E('gunpowder', 8), E('fuel', 8), E('electronic', 5)],
    shelf: [E('scrap', 20), E('wire', 16), E('electronic', 10), E('medparts', 6), E('ammo_762_ap', 4)],
    toolbox: [E('scrap', 18), E('wire', 14), E('gunpowder', 12), E('sledgehammer', 5), E('armor1', 3)],
    locker: [E('armor1', 8), E('backpack_s', 6), E('helmet2', 5), E('ammo_9mm', 14), E('medkit', 6)],
    cardboard: [E('scrap', 16), E('gunpowder', 8), E('cash', 12, [10, 80])],
    default: [E('scrap', 22), E('wire', 12), E('ammo_762', 8), E('cash', 12, [10, 70])],
  },
  farm: {
    cabinet: [E('canned_food', 24), E('water_bottle', 16), E('raw_meat', 12), E('protein_powder', 3)],
    fridge: [E('raw_meat', 24), E('canned_food', 18), E('water_bottle', 18), E('cooked_meat', 8)],
    shelf: [E('scrap', 16), E('plank', 18), E('nail', 14), E('fuel', 6)],
    crate: [E('plank', 22), E('nail', 16), E('scrap', 14), E('ammo_556', 8)],
    toolbox: [E('scrap', 16), E('wire', 12), E('nail', 14), E('sledgehammer', 4)],
    cardboard: [E('canned_food', 14), E('scrap', 12), E('cash', 10, [5, 45])],
    default: [E('scrap', 16), E('plank', 14), E('canned_food', 14)],
  },
  lab: {
    labcabinet: [E('electronic', 22), E('gpu', 8), E('blueprint', 5), E('medparts', 16),
      E('medkit', 12), E('recovery_syringe', 5), E('ammo_556_purple', 4), E('keycardBlue', 2)],
    locker: [E('armor3', 7), E('electronic', 16), E('bandage_sterile', 12), E('antibiotics', 10), E('ammo_556', 10)],
    crate: [E('electronic', 16), E('scrap', 12), E('ammo_556', 10), E('gunpowder', 6)],
    cardboard: [E('medparts', 12), E('electronic', 10), E('blueprint', 2)],
    default: [E('electronic', 18), E('medparts', 12), E('scrap', 10)],
  },
  military: {
    crate: [E('ammo_762', 20), E('ammo_762_ap', 12), E('armor3', 8), E('armor5', 3),
      E('ammo_storm', 4), E('backpack_m', 5), E('recovery_syringe', 6)],
    locker: [E('armor5', 6), E('helmet2', 10), E('ammo_556_purple', 10), E('medkit', 10), E('load_syringe', 5)],
    cardboard: [E('ammo_762', 16), E('gunpowder', 10), E('cash', 14, [50, 200])],
    default: [E('ammo_762', 18), E('armor3', 6), E('cash', 12, [30, 150])],
  },
  boss: [E('gpu', 10), E('blueprint', 8), E('armor5', 10), E('ammo_556_purple', 14),
    E('ammo_762_ap', 14), E('recovery_syringe', 8), E('backpack_l', 5), E('totem', 4),
    E('credential3', 3), E('stormGunBp', 1.5), E('spacecraftBp', 0.8), E('cash', 20, [200, 900])],
  scav: [E('cash', 26, [10, 70]), E('scrap', 16), E('ammo_9mm', 14), E('canned_food', 12), E('nail', 8)],
  scavArmed: [E('ammo_9mm', 20), E('cash', 18, [30, 120]), E('scrap', 12), E('bandage', 10), E('armor1', 4)],
  rampager: [E('ammo_762', 16), E('cash', 16, [80, 260]), E('armor3', 8), E('medkit', 8), E('electronic', 6)],
};

/** 按容器类型取战利品：返回 [{id, count}] */
export function rollLoot(rng, tableId, containerKind, lucky = 0) {
  const table = Array.isArray(LOOT_TABLES[tableId]) ? LOOT_TABLES[tableId] : (LOOT_TABLES[tableId] || {});
  const rows = Array.isArray(table) ? table : (table[containerKind] || table.default || []);
  if (!rows.length) return [];
  // 幸运特质：稀有项权重加成
  const weightOf = (o) => o.w * (1 + lucky * LOOT.luckyMulPerLevel * (o.w < 6 ? 2.2 : 1));
  const [a, b] = LOOT.containerCapacity;
  const rolls = rng.int(a, b);
  const out = [];
  for (let i = 0; i < rolls; i++) {
    if (!rng.chance(0.58)) continue;                  // 容器里本来就该有空位
    const pick = rng.weighted(rows, weightOf);
    if (!pick) continue;
    const n = Array.isArray(pick.n) ? rng.int(pick.n[0], pick.n[1]) : (pick.n ?? 1);
    out.push({ id: pick.id, count: n });
  }
  return mergeSame(out);
}

function mergeSame(list) {
  const map = new Map();
  for (const it of list) map.set(it.id, (map.get(it.id) || 0) + it.count);
  return [...map].map(([id, count]) => ({ id, count }));
}
