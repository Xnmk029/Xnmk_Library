// ============================================================
//  loot.js — 容器战利品表（按地图 tier 分级解锁）
//  entry: [itemId, weight, min, max, minTier]
// ============================================================

import { mkItem, itemDef } from './items.js';

export const CONTAINERS = {
  trash: { name: '垃圾桶', cap: 12, n: [0, 2], col: '#4c5450', tbl: [
    ['cloth', 20, 1, 3], ['dirty_rag', 14, 1, 2], ['empty_bottle', 16, 1, 2], ['scrap', 12, 1, 2],
    ['cash', 10, 3, 18], ['tainted_water', 10, 1, 1], ['chips', 6, 1, 1], ['nails', 8, 2, 8],
  ] },
  crate: { name: '木箱', cap: 25, n: [1, 3], col: '#8a6b3d', tbl: [
    ['plank', 18, 1, 3], ['nails', 16, 5, 20], ['scrap', 14, 1, 3], ['cloth', 10, 1, 3],
    ['canned_beans', 10, 1, 2], ['canned_meat', 7, 1, 1], ['ammo_9', 8, 6, 16], ['ammo_12g', 6, 4, 10],
    ['duct_tape', 6, 1, 1], ['rope', 5, 1, 1], ['gunpowder', 6, 2, 6, 2], ['sheet_metal', 4, 1, 1, 2],
  ] },
  shelf: { name: '货架', cap: 30, n: [1, 3], col: '#6d747a', tbl: [
    ['mech_parts', 16, 1, 3], ['electronics', 14, 1, 3], ['duct_tape', 10, 1, 2], ['plank', 10, 1, 2],
    ['sheet_metal', 8, 1, 2], ['battery', 10, 1, 3], ['scrap', 12, 2, 5], ['chemicals', 7, 1, 2, 2],
    ['gpu', 4, 1, 1, 3], ['jerrycan', 3, 1, 1], ['book_carpentry', 2, 1, 1], ['book_electrical', 2, 1, 1],
  ] },
  locker: { name: '储物柜', cap: 20, n: [1, 2], col: '#5b6152', tbl: [
    ['cloth', 16, 1, 4], ['pack_small', 8, 1, 1], ['helm_1', 7, 1, 1], ['vest_1', 6, 1, 1],
    ['cash', 14, 20, 90], ['flashlight', 7, 1, 1], ['battery', 9, 1, 2], ['bandage', 8, 1, 2],
    ['pack_mid', 4, 1, 1, 2], ['helm_2', 3, 1, 1, 2], ['vest_2', 3, 1, 1, 2], ['keycard_green', 2, 1, 1, 4],
  ] },
  fridge: { name: '冰箱', cap: 25, n: [1, 3], col: '#8f969c', tbl: [
    ['milk', 12, 1, 1], ['egg', 14, 2, 5], ['raw_patty', 12, 1, 2], ['water_bottle', 16, 1, 2],
    ['cheese', 10, 1, 2], ['apple', 10, 1, 3], ['soda', 12, 1, 2], ['pickles', 8, 1, 1], ['beer', 8, 1, 2],
  ] },
  kitchen_cab: { name: '厨柜', cap: 20, n: [1, 3], col: '#6a5236', tbl: [
    ['canned_beans', 16, 1, 2], ['instant_noodle', 14, 1, 3], ['canned_meat', 10, 1, 2], ['pan', 6, 1, 1],
    ['lighter', 10, 1, 1], ['water_bottle', 12, 1, 2], ['honey', 5, 1, 1], ['chocolate', 8, 1, 2],
    ['empty_bottle', 10, 1, 2], ['knife', 5, 1, 1], ['coffee', 7, 1, 1],
  ] },
  medbox: { name: '医疗箱', cap: 15, n: [1, 3], col: '#c23b3b', tbl: [
    ['bandage', 22, 1, 3], ['painkiller', 16, 1, 2], ['disinfectant', 12, 1, 1], ['splint', 10, 1, 1],
    ['first_aid_kit', 8, 1, 1], ['antibiotics', 8, 1, 1], ['vitamins', 8, 1, 2],
    ['recovery_syringe', 5, 1, 1, 3], ['buff_syringe', 4, 1, 1, 3], ['surgery_kit', 3, 1, 1, 2],
    ['serum', 2, 1, 1, 4], ['book_firstaid', 2, 1, 1],
  ] },
  gunlocker: { name: '武器柜', cap: 30, n: [1, 2], col: '#3a3d44', tbl: [
    ['pistol_m9', 14, 1, 1], ['ammo_9', 18, 10, 30], ['sg_m870', 8, 1, 1], ['ammo_12g', 12, 6, 16],
    ['knife', 8, 1, 1], ['smg_mp5', 6, 1, 1, 2], ['ar_ak103', 5, 1, 1, 2], ['ammo_762', 8, 10, 25, 2],
    ['att_scope', 5, 1, 1, 2], ['att_grip', 5, 1, 1, 2], ['ar_m4', 4, 1, 1, 3], ['ammo_556', 8, 10, 25, 2],
    ['sr_sv98', 3, 1, 1, 3], ['ammo_338', 5, 5, 12, 3], ['att_suppressor', 3, 1, 1, 3],
    ['lmg_rpk', 2, 1, 1, 4], ['att_thermal', 2, 1, 1, 4], ['ammo_762ap', 4, 10, 20, 4], ['book_aiming', 2, 1, 1],
  ] },
  ammobox: { name: '弹药箱', cap: 25, n: [2, 3], col: '#4d5340', tbl: [
    ['ammo_9', 20, 12, 30], ['ammo_12g', 14, 6, 18], ['ammo_556', 16, 12, 30, 2], ['ammo_762', 14, 10, 26, 2],
    ['gunpowder', 12, 3, 10], ['ammo_9ap', 8, 8, 20, 3], ['ammo_556ap', 6, 8, 18, 3],
    ['ammo_338', 6, 4, 10, 3], ['ammo_762ap', 5, 8, 18, 4], ['ammo_energy', 3, 6, 14, 5],
  ] },
  safe: { name: '保险柜', cap: 12, n: [1, 3], col: '#43474f', tbl: [
    ['cash', 26, 150, 600], ['gpu', 12, 1, 2], ['ship_blueprint', 2, 1, 1, 3], ['credential_1', 4, 1, 1, 3],
    ['keycard_blue', 5, 1, 1, 4], ['keycard_red', 4, 1, 1, 4], ['keycard_black', 2, 1, 1, 4],
    ['att_thermal', 4, 1, 1, 4], ['serum', 4, 1, 1, 4], ['recovery_syringe', 8, 1, 2, 2],
  ] },
  toolbox: { name: '工具箱', cap: 18, n: [1, 3], col: '#a83b2a', tbl: [
    ['hammer', 14, 1, 1], ['saw', 12, 1, 1], ['screwdriver', 14, 1, 1], ['nails', 18, 10, 40],
    ['duct_tape', 12, 1, 2], ['wrench', 10, 1, 1], ['crowbar', 8, 1, 1], ['scrap', 12, 1, 4],
    ['mech_parts', 10, 1, 3], ['plank', 8, 1, 2],
  ] },
  desk: { name: '办公桌', cap: 15, n: [0, 2], col: '#6a5236', tbl: [
    ['cash', 18, 20, 120], ['electronics', 12, 1, 2], ['cloth', 8, 1, 2], ['painkiller', 8, 1, 1],
    ['book_cooking', 4, 1, 1], ['book_electrical', 4, 1, 1], ['keycard_green', 4, 1, 1, 3],
    ['keycard_yellow', 3, 1, 1, 4], ['gpu', 4, 1, 1, 3], ['radio', 5, 1, 1],
  ] },
  wardrobe: { name: '衣柜', cap: 22, n: [1, 3], col: '#7d6343', tbl: [
    ['cloth', 24, 2, 5], ['pack_small', 8, 1, 1], ['vest_1', 6, 1, 1], ['cash', 10, 10, 60],
    ['pack_mid', 4, 1, 1, 2], ['pouch', 3, 1, 1], ['dirty_rag', 10, 1, 3],
  ] },
  lab_cab: { name: '实验柜', cap: 20, n: [1, 3], col: '#3f6b62', tbl: [
    ['chemicals', 20, 1, 3], ['electronics', 16, 2, 4], ['serum', 8, 1, 1], ['gpu', 10, 1, 2],
    ['ammo_energy', 6, 5, 12, 5], ['keycard_purple', 5, 1, 1], ['keycard_red', 5, 1, 1],
    ['antibiotics', 10, 1, 2], ['ship_core', 1, 1, 1, 5], ['marker_dart', 8, 1, 3],
  ] },
  minecart: { name: '矿车', cap: 30, n: [1, 3], col: '#6b6a63', tbl: [
    ['scrap', 22, 2, 6], ['sheet_metal', 12, 1, 2], ['gunpowder', 14, 3, 10], ['chemicals', 10, 1, 2],
    ['gpu', 4, 1, 1, 3], ['cash', 14, 30, 120], ['mech_parts', 12, 1, 3], ['explosive_charge', 4, 1, 1, 2],
  ] },
  car: { name: '车辆残骸', cap: 25, n: [1, 2], col: '#5b6152', tbl: [
    ['mech_parts', 18, 1, 3], ['scrap', 18, 2, 5], ['jerrycan', 8, 1, 1], ['duct_tape', 10, 1, 1],
    ['battery', 12, 1, 2], ['first_aid_kit', 6, 1, 1], ['cash', 10, 10, 60], ['electronics', 10, 1, 2],
  ] },
  corpse: { name: '尸体', cap: 20, n: [1, 2], col: '#7d2b32', tbl: [
    ['cloth', 18, 1, 3], ['cash', 20, 10, 70], ['bandage', 10, 1, 2], ['ammo_9', 10, 4, 12],
    ['canned_beans', 8, 1, 1], ['dirty_rag', 12, 1, 2], ['painkiller', 8, 1, 1], ['keycard_blue', 2, 1, 1, 4],
  ] },
  stash: { name: '仓库箱', cap: 400, n: [0, 0], col: '#8a6b2a', tbl: [] },
};

/** 掷一个容器的战利品 */
export function rollLoot(kind, tier, rng, mul = 1) {
  const c = CONTAINERS[kind] || CONTAINERS.crate;
  const out = [];
  let n = rng.int(c.n[0], c.n[1]);
  if (mul > 1.3 && rng.chance(0.35)) n++;
  if (rng.chance(0.08 * mul)) n++;
  const pool = c.tbl.filter((e) => !e[4] || tier >= e[4]);
  if (!pool.length) return out;
  for (let i = 0; i < n; i++) {
    const entries = pool.map((e) => [e, e[1] * (e[4] ? 1 + (tier - e[4]) * 0.5 : 1)]);
    const e = rng.weighted(entries);
    if (!e) continue;
    const id = e[0];
    const def = itemDef(id);
    let count = rng.int(e[2], e[3]);
    if (def.money) count = Math.round(count * (1 + tier * 0.35));
    const it = mkItem(id, Math.max(1, count));
    // 枪械/工具随机耐久
    if (it.cond !== undefined) it.cond = rng.float(0.35, 0.95);
    if (def.t === 'gun') it.loaded = rng.chance(0.6) ? rng.int(0, def.mag) : 0;
    if (it.fresh !== undefined) it.fresh = rng.float(0.25, 1);
    if (it.charge !== undefined) it.charge = rng.float(0.2, 1);
    out.push(it);
  }
  return out;
}

/** 掷敌人掉落 */
export function rollEnemyLoot(def, rng, tier = 1) {
  const out = [];
  for (const [id, ch, mn, mx] of (def.loot || [])) {
    if (!rng.chance(ch)) continue;
    const d = itemDef(id);
    let n = rng.int(mn, mx);
    if (d.money) n = Math.round(n * (1 + tier * 0.2));
    const it = mkItem(id, Math.max(1, n));
    if (it.cond !== undefined) it.cond = rng.float(0.3, 0.85);
    if (d.t === 'gun') it.loaded = rng.int(0, Math.floor(d.mag * 0.5));
    out.push(it);
  }
  return out;
}
