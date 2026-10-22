import { ITEMS } from './items.js';
import { RNG } from './util.js';

// ================= 搜刮：容器战利品表 =================
const LOOT_TABLES = {
  fridge: [
    ['can_beans', 8, 1, 3], ['can_tuna', 5, 1, 2], ['milk', 6, 1, 2], ['water_bottle', 7, 1, 3],
    ['apple', 6, 1, 3], ['banana', 4, 1, 2], ['cola', 6, 1, 2], ['juice', 5, 1, 2], ['dogfood', 2, 1, 1],
    ['canned_soup', 5, 1, 2], ['peanut_butter', 4, 1, 1], ['watermelon', 2, 1, 1], ['bread', 5, 1, 2],
  ],
  kitchen: [
    ['can_beans', 7, 1, 3], ['can_tuna', 5, 1, 2], ['ramen', 6, 1, 3], ['canned_soup', 5, 1, 2],
    ['kitchen_knife', 5, 1, 1], ['frying_pan', 4, 1, 1], ['pot', 4, 1, 1], ['can_opener', 3, 1, 1],
    ['candy', 4, 1, 3], ['chocolate', 4, 1, 2], ['matches', 4, 1, 1], ['whiskey', 3, 1, 1], ['chips', 4, 1, 2],
  ],
  shelf: [
    ['book_fishing1', 3, 1, 1], ['book_carp1', 4, 1, 1], ['book_cook1', 4, 1, 1], ['book_med1', 3, 1, 1],
    ['book_farm1', 3, 1, 1], ['book_elec1', 3, 1, 1], ['book_mech1', 3, 1, 1], ['magazine', 6, 1, 2],
    ['comic', 3, 1, 1], ['book_blade1', 2, 1, 1], ['book_aim1', 2, 1, 1],
    ['book_fishing2', 1, 1, 1], ['book_carp2', 2, 1, 1], ['book_cook2', 2, 1, 1], ['book_med2', 1, 1, 1],
    ['book_mech2', 2, 1, 1], ['book_elec2', 1, 1, 1],
  ],
  wardrobe: [
    ['tshirt', 8, 1, 2], ['hoddie', 6, 1, 1], ['sweater', 6, 1, 1], ['leather_jacket', 3, 1, 1],
    ['jeans', 7, 1, 1], ['boots', 4, 1, 1], ['sneakers', 6, 1, 1], ['ballcap', 4, 1, 1],
    ['scarf', 4, 1, 1], ['gloves', 4, 1, 1], ['sheet', 6, 1, 2], ['schoolbag', 4, 1, 1], ['duffelbag', 3, 1, 1],
  ],
  pharmacy: [
    ['bandage', 10, 1, 3], ['bandage_sterile', 6, 1, 2], ['painkillers', 8, 1, 2], ['antibiotics', 5, 1, 2],
    ['vitamins', 5, 1, 2], ['beta_blockers', 4, 1, 2], ['sleeping_pills', 4, 1, 2], ['firstaid_kit', 3, 1, 1],
    ['disinfectant', 6, 1, 2], ['suture', 4, 1, 1], ['tweezers', 3, 1, 1], ['splint', 3, 1, 1], ['sterile_rag', 5, 1, 3],
  ],
  hardware: [
    ['hammer', 7, 1, 1], ['saw', 6, 1, 1], ['screwdriver', 7, 1, 1], ['crowbar', 4, 1, 1],
    ['nails', 9, 5, 20], ['wood_plank', 8, 2, 5], ['duct_tape', 6, 1, 2], ['rope', 5, 1, 2],
    ['lighter', 5, 1, 1], ['matches', 6, 1, 2], ['flashlight', 5, 1, 1], ['wire', 5, 1, 3],
    ['electronics_scrap', 5, 1, 3], ['glue', 4, 1, 2], ['bucket', 4, 1, 1], ['watering_can', 3, 1, 1],
    ['trowel', 3, 1, 1], ['scrap_metal', 6, 1, 4], ['gas_can', 3, 1, 1], ['fire_axe', 2, 1, 1],
  ],
  restaurant: [
    ['can_beans', 6, 1, 2], ['can_tuna', 4, 1, 2], ['canned_soup', 6, 1, 2], ['bread', 5, 1, 2],
    ['kitchen_knife', 5, 1, 1], ['frying_pan', 4, 1, 1], ['pot', 4, 1, 1], ['cola', 5, 1, 3],
    ['whiskey', 4, 1, 1], ['coffee', 3, 1, 1], ['chips', 4, 1, 2], ['chocolate', 3, 1, 2], ['can_opener', 2, 1, 1],
  ],
  bookstore: [
    ['book_fishing1', 5, 1, 1], ['book_carp1', 5, 1, 1], ['book_cook1', 5, 1, 1], ['book_med1', 4, 1, 1],
    ['book_farm1', 4, 1, 1], ['book_elec1', 4, 1, 1], ['book_mech1', 4, 1, 1], ['magazine', 8, 1, 3],
    ['comic', 5, 1, 2], ['book_blade1', 3, 1, 1], ['book_aim1', 3, 1, 1], ['book_fishing2', 2, 1, 1],
    ['book_carp2', 3, 1, 1], ['book_cook2', 3, 1, 1], ['book_med2', 2, 1, 1], ['book_mech2', 2, 1, 1], ['book_elec2', 2, 1, 1],
  ],
  police: [
    ['glock17', 6, 1, 1], ['9mm', 8, 10, 40], ['m1911', 3, 1, 1], ['45acp', 5, 8, 30],
    ['police_vest', 4, 1, 1], ['tactical_helmet', 3, 1, 1], ['handcuffs', 0, 0, 0],
    ['flashlight', 4, 1, 1], ['bat', 4, 1, 1], ['bandage', 4, 1, 2], ['keycard_blue', 6, 1, 1],
    ['bat', 3, 1, 1], ['tshirt', 3, 1, 1], ['sneakers', 3, 1, 1],
  ],
  armory: [
    ['mp5', 5, 1, 1], ['9mm', 9, 20, 60], ['m16', 3, 1, 1], ['556', 6, 20, 60],
    ['akm', 2, 1, 1], ['762x39', 5, 15, 45], ['rem870', 4, 1, 1], ['12g', 5, 10, 30],
    ['reddot', 4, 1, 1], ['scope4x', 3, 1, 1], ['sup_9', 3, 1, 1], ['military_vest', 2, 1, 1],
    ['tactical_helmet', 2, 1, 1], ['firstaid_kit', 2, 1, 1], ['military_ruck', 2, 1, 1], ['laser', 3, 1, 1],
  ],
  military: [
    ['m16', 4, 1, 1], ['556', 8, 30, 90], ['akm', 3, 1, 1], ['762x39', 6, 20, 60],
    ['military_vest', 4, 1, 1], ['tactical_helmet', 4, 1, 1], ['military_ruck', 3, 1, 1],
    ['scope4x', 4, 1, 1], ['sup_762', 3, 1, 1], ['firstaid_kit', 4, 1, 2], ['gas_mask', 2, 1, 1],
    ['keycard_red', 5, 1, 1], ['car_battery', 4, 1, 1], ['gas_can', 5, 1, 1], ['fuel_tank_part', 4, 1, 1],
    ['hunting_rifle', 3, 1, 1], ['308', 4, 8, 24], ['sks', 3, 1, 1],
  ],
  gas: [
    ['cola', 7, 1, 3], ['water_bottle', 7, 1, 3], ['chips', 6, 1, 2], ['candy', 6, 1, 2],
    ['chocolate', 4, 1, 2], ['lighter', 4, 1, 1], ['matches', 4, 1, 2], ['gas_can', 5, 1, 1],
    ['beef_jerky', 4, 1, 2], ['car_battery', 3, 1, 1], ['fuel_tank_part', 3, 1, 1], ['magazine', 3, 1, 1],
  ],
  farm: [
    ['garden_hoe', 5, 1, 1], ['seed_pack', 8, 1, 3], ['watering_can', 4, 1, 1], ['trowel', 4, 1, 1],
    ['apple', 6, 1, 3], ['banana', 5, 1, 2], ['watermelon', 4, 1, 1], ['bread', 4, 1, 2],
    ['beef_jerky', 3, 1, 1], ['rope', 4, 1, 2], ['bucket', 4, 1, 1], ['matches', 3, 1, 1],
  ],
  house: [
    ['can_beans', 6, 1, 2], ['can_tuna', 4, 1, 2], ['water_bottle', 6, 1, 2], ['bread', 5, 1, 2],
    ['bandage', 4, 1, 2], ['painkillers', 3, 1, 1], ['hammer', 3, 1, 1], ['screwdriver', 3, 1, 1],
    ['nails', 4, 2, 10], ['sheet', 5, 1, 2], ['candle', 0, 0, 0], ['magazine', 4, 1, 1],
    ['kitchen_knife', 3, 1, 1], ['baseball_bat', 3, 1, 1], ['candy', 3, 1, 2], ['chocolate', 2, 1, 1],
  ],
  shop: [
    ['can_beans', 8, 1, 3], ['can_tuna', 6, 1, 2], ['chips', 7, 1, 3], ['candy', 7, 1, 3],
    ['chocolate', 6, 1, 2], ['cola', 7, 1, 3], ['water_bottle', 7, 1, 3], ['juice', 5, 1, 2],
    ['beef_jerky', 4, 1, 2], ['canned_soup', 5, 1, 2], ['bread', 5, 1, 2], ['magazine', 3, 1, 1],
    ['lighter', 3, 1, 1], ['matches', 3, 1, 2],
  ],
  zombie: [
    ['ripped_sheet', 6, 1, 2], ['water_bottle', 4, 1, 1], ['candy', 3, 1, 1], ['bandage', 2, 1, 1],
    ['glock17', 1, 1, 1], ['9mm', 2, 5, 15], ['kitchen_knife', 2, 1, 1], ['watch', 1, 1, 1],
    ['keycard_blue', 0.4, 1, 1], ['hammer', 1, 1, 1], ['painkillers', 1.5, 1, 1], ['whiskey', 2, 1, 1],
  ],
};

export class Loot {
  constructor(game) { this.game = game; }
  pick(table, rng) {
    const entries = LOOT_TABLES[table];
    if (!entries) return [];
    let total = 0;
    for (const e of entries) total += e[1];
    let r = rng.range(0, total);
    for (const e of entries) {
      r -= e[1];
      if (r <= 0) return [e[0], rng.int(e[2], e[3])];
    }
    return null;
  }
  fillContainer(c) {
    const g = this.game;
    const rng = new RNG((c.id * 7919 + g.seed) >>> 0);
    const table = c.loot || 'shelf';
    const lucky = g.player ? g.player.stats.luck : 0;
    const rolls = c.type === 'corpse' ? 1 : 2 + Math.floor(rng.range(0, 2 + lucky));
    for (let i = 0; i < rolls; i++) {
      const pick = this.pick(table, rng);
      if (!pick) continue;
      const [id, n] = pick;
      const def = ITEMS[id];
      if (!def || def.worldOnly) continue;
      if (def.stack) c.items.push({ item: { ...def, id }, n });
      else c.items.push({ item: { ...def, id, ...(def.type === 'gun' ? { mag: 0, cond: def.maxCond } : def.maxCond ? { cond: def.maxCond } : {}) }, n: 1 });
    }
    c.rolled = true;
    // 特殊高价值：检查站/军械库保底
    if (table === 'military' && Math.random() < 0.5) c.items.push({ item: { ...ITEMS.keycard_red, id: 'keycard_red' }, n: 1 });
  }
}
