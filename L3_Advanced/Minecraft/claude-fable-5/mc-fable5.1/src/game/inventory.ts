import { itemIdByName, itemMaxStack, PLANKS_IDS } from "./blocks";

export interface ItemStack {
  id: number;
  count: number;
}

export class Inventory {
  slots: (ItemStack | null)[] = new Array(36).fill(null);
  selected = 0;
  version = 0;

  get hotbar() {
    return this.slots.slice(0, 9);
  }
  selectedStack(): ItemStack | null {
    return this.slots[this.selected];
  }
  /** Adds items; returns leftover count that didn't fit. */
  add(id: number, count: number): number {
    const max = itemMaxStack(id);
    // merge into existing stacks first (hotbar first)
    for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) {
        const n = Math.min(max - s.count, count);
        s.count += n;
        count -= n;
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(max, count);
        this.slots[i] = { id, count: n };
        count -= n;
      }
    }
    this.version++;
    return count;
  }
  consumeSelected(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.version++;
  }
  count(id: number) {
    let c = 0;
    for (const s of this.slots) if (s && s.id === id) c += s.count;
    return c;
  }
  touch() {
    this.version++;
  }
}

// ---------------- Crafting ----------------
export interface Recipe {
  shape?: string[];
  key?: Record<string, number[]>;
  shapeless?: number[];
  result: ItemStack;
}

const id = itemIdByName;
const M = (names: string[]) => names.map(id);
export const RECIPES: Recipe[] = [];

function shaped(shape: string[], key: Record<string, string[] | number[]>, result: string, count = 1) {
  const k: Record<string, number[]> = {};
  for (const c of Object.keys(key)) {
    const v = key[c];
    k[c] = typeof v[0] === "string" ? M(v as string[]) : (v as number[]);
  }
  RECIPES.push({ shape, key: k, result: { id: id(result), count } });
}
function shapeless(items: string[], result: string, count = 1) {
  RECIPES.push({ shapeless: M(items), result: { id: id(result), count } });
}

shapeless(["oak_log"], "oak_planks", 4);
shapeless(["birch_log"], "birch_planks", 4);
shapeless(["spruce_log"], "spruce_planks", 4);
shaped(["P", "P"], { P: PLANKS_IDS }, "stick", 4);
shaped(["PP", "PP"], { P: PLANKS_IDS }, "crafting_table");
shaped(["C", "S"], { C: ["coal"], S: ["stick"] }, "torch", 4);
shaped(["SS", "SS"], { S: ["sand"] }, "sandstone");
shaped(["SS", "SS"], { S: ["snow_block"] }, "snow_block", 4);
shaped(["CCC", "CCC", "CCC"], { C: ["coal"] }, "coal_block");
shapeless(["coal_block"], "coal", 9);
shaped(["DDD", "DDD", "DDD"], { D: ["diamond"] }, "diamond_block");
shapeless(["diamond_block"], "diamond", 9);
shaped(["GGG", "GGG", "GGG"], { G: ["raw_gold"] }, "gold_block");
shaped(["RRR", "RRR", "RRR"], { R: ["redstone"] }, "glowstone");
shapeless(["cobblestone", "short_grass"], "mossy_cobblestone");
shaped(["WWW", "WWW", "WWW"], { W: ["feather"] }, "white_wool");
const tiers: [string, string[] | number[]][] = [["wooden", PLANKS_IDS], ["stone", ["cobblestone"]], ["diamond", ["diamond"]]];
for (const [name, mat] of tiers) {
  shaped(["MMM", " S ", " S "], { M: mat, S: ["stick"] }, `${name}_pickaxe`);
  shaped(["MM", "MS", " S"], { M: mat, S: ["stick"] }, `${name}_axe`);
  shaped(["M", "M", "S"], { M: mat, S: ["stick"] }, `${name}_sword`);
  shaped(["M", "S", "S"], { M: mat, S: ["stick"] }, `${name}_shovel`);
}

/** grid: size*size slots, row-major. Returns recipe or null */
export function matchRecipe(grid: (ItemStack | null)[], size: number): Recipe | null {
  const items = grid.map((s) => (s && s.count > 0 ? s.id : 0));
  const nonEmpty = items.filter((i) => i !== 0);
  if (nonEmpty.length === 0) return null;
  // bounds
  let minR = size, maxR = -1, minC = size, maxC = -1;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (items[r * size + c]) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
  const w = maxC - minC + 1, h = maxR - minR + 1;
  for (const rec of RECIPES) {
    if (rec.shapeless) {
      if (rec.shapeless.length !== nonEmpty.length) continue;
      const pool = [...nonEmpty];
      let ok = true;
      for (const need of rec.shapeless) {
        const i = pool.indexOf(need);
        if (i < 0) { ok = false; break; }
        pool.splice(i, 1);
      }
      if (ok) return rec;
      continue;
    }
    const shape = rec.shape!;
    const rw = shape[0].length, rh = shape.length;
    if (rw !== w || rh !== h) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let r = 0; r < h && ok; r++)
        for (let c = 0; c < w && ok; c++) {
          const ch = shape[r][mirror ? w - 1 - c : c];
          const have = items[(minR + r) * size + (minC + c)];
          if (ch === " ") { if (have) ok = false; }
          else {
            const allowed = rec.key![ch];
            if (!have || !allowed.includes(have)) ok = false;
          }
        }
      if (ok) return rec;
    }
  }
  return null;
}
