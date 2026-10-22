// Block & item registry — ids, physical properties, textures, drops, hardness.
export const CHUNK = 16;
export const HEIGHT = 128;
export const SEA_LEVEL = 50;

export type RenderKind = "cube" | "cross" | "torch" | "liquid" | "none";
export type ToolType = "pickaxe" | "axe" | "shovel" | "sword";

export interface BlockDef {
  id: number;
  name: string;
  display: string;
  tex: { top: string; bottom: string; side: string; front?: string };
  solid: boolean; // collision
  opaque: boolean; // blocks light & culls neighbour faces
  render: RenderKind;
  light: number; // emitted light 0..15
  hardness: number; // -1 unbreakable
  tool?: ToolType;
  minTier?: number; // tool tier required to get a drop (0 wood,1 stone,2 diamond)
  drop?: string | null; // item name; undefined = itself; null = nothing
  dropCount?: [number, number];
  gravity?: boolean;
  replaceable?: boolean;
  cullSame?: boolean;
  lightFilter?: number; // extra light attenuation (leaves/water)
  needsSupport?: boolean; // plants
}

export interface ItemDef {
  id: number;
  name: string;
  display: string;
  tile: string; // icon tile name (for non-block items)
  stack: number;
  tool?: { type: ToolType; tier: number; speed: number };
  food?: number;
  attack?: number;
}

const blockList: BlockDef[] = [];
export const BLOCKS: BlockDef[] = blockList;
export const BLOCK_BY_NAME = new Map<string, BlockDef>();

function B(
  id: number,
  name: string,
  display: string,
  tex: string | { top: string; bottom: string; side: string; front?: string },
  opts: Partial<BlockDef> = {}
) {
  const t = typeof tex === "string" ? { top: tex, bottom: tex, side: tex } : tex;
  const def: BlockDef = {
    id,
    name,
    display,
    tex: t,
    solid: true,
    opaque: true,
    render: "cube",
    light: 0,
    hardness: 1,
    ...opts,
  };
  blockList[id] = def;
  BLOCK_BY_NAME.set(name, def);
  return def;
}

// ---- Blocks ----
B(0, "air", "Air", "stone", { solid: false, opaque: false, render: "none", hardness: 0, replaceable: true });
B(1, "stone", "Stone", "stone", { hardness: 1.5, tool: "pickaxe", minTier: 0, drop: "cobblestone" });
B(2, "grass_block", "Grass Block", { top: "grass_top", bottom: "dirt", side: "grass_side" }, { hardness: 0.6, tool: "shovel", drop: "dirt" });
B(3, "dirt", "Dirt", "dirt", { hardness: 0.5, tool: "shovel" });
B(4, "cobblestone", "Cobblestone", "cobblestone", { hardness: 2, tool: "pickaxe", minTier: 0 });
B(5, "oak_planks", "Oak Planks", "oak_planks", { hardness: 2, tool: "axe" });
B(6, "bedrock", "Bedrock", "bedrock", { hardness: -1 });
B(7, "water", "Water", "water", { solid: false, opaque: false, render: "liquid", hardness: 100, replaceable: true, cullSame: true, lightFilter: 1, drop: null });
B(8, "lava", "Lava", "lava", { solid: false, opaque: false, render: "liquid", light: 15, hardness: 100, cullSame: true, lightFilter: 15, drop: null });
B(9, "sand", "Sand", "sand", { hardness: 0.5, tool: "shovel", gravity: true });
B(10, "gravel", "Gravel", "gravel", { hardness: 0.6, tool: "shovel", gravity: true });
B(11, "gold_ore", "Gold Ore", "gold_ore", { hardness: 3, tool: "pickaxe", minTier: 1, drop: "raw_gold" });
B(12, "iron_ore", "Iron Ore", "iron_ore", { hardness: 3, tool: "pickaxe", minTier: 1, drop: "raw_iron" });
B(13, "coal_ore", "Coal Ore", "coal_ore", { hardness: 3, tool: "pickaxe", minTier: 0, drop: "coal" });
B(14, "oak_log", "Oak Log", { top: "oak_log_top", bottom: "oak_log_top", side: "oak_log" }, { hardness: 2, tool: "axe" });
B(15, "oak_leaves", "Oak Leaves", "oak_leaves", { opaque: false, hardness: 0.2, drop: null, lightFilter: 1 });
B(16, "birch_log", "Birch Log", { top: "birch_log_top", bottom: "birch_log_top", side: "birch_log" }, { hardness: 2, tool: "axe" });
B(17, "birch_leaves", "Birch Leaves", "birch_leaves", { opaque: false, hardness: 0.2, drop: null, lightFilter: 1 });
B(18, "spruce_log", "Spruce Log", { top: "spruce_log_top", bottom: "spruce_log_top", side: "spruce_log" }, { hardness: 2, tool: "axe" });
B(19, "spruce_leaves", "Spruce Leaves", "spruce_leaves", { opaque: false, hardness: 0.2, drop: null, lightFilter: 1 });
B(20, "birch_planks", "Birch Planks", "birch_planks", { hardness: 2, tool: "axe" });
B(21, "spruce_planks", "Spruce Planks", "spruce_planks", { hardness: 2, tool: "axe" });
B(22, "sandstone", "Sandstone", { top: "sandstone_top", bottom: "sandstone_bottom", side: "sandstone" }, { hardness: 0.8, tool: "pickaxe", minTier: 0 });
B(23, "diamond_ore", "Diamond Ore", "diamond_ore", { hardness: 3, tool: "pickaxe", minTier: 1, drop: "diamond" });
B(24, "redstone_ore", "Redstone Ore", "redstone_ore", { hardness: 3, tool: "pickaxe", minTier: 1, drop: "redstone", dropCount: [4, 5] });
B(25, "crafting_table", "Crafting Table", { top: "crafting_table_top", bottom: "oak_planks", side: "crafting_table_side", front: "crafting_table_front" }, { hardness: 2.5, tool: "axe" });
B(26, "torch", "Torch", "torch", { solid: false, opaque: false, render: "torch", light: 14, hardness: 0, needsSupport: true });
B(27, "short_grass", "Grass", "short_grass", { solid: false, opaque: false, render: "cross", hardness: 0, drop: null, replaceable: true, needsSupport: true });
B(28, "dandelion", "Dandelion", "dandelion", { solid: false, opaque: false, render: "cross", hardness: 0, needsSupport: true });
B(29, "poppy", "Poppy", "poppy", { solid: false, opaque: false, render: "cross", hardness: 0, needsSupport: true });
B(30, "snowy_grass", "Snowy Grass Block", { top: "snow", bottom: "dirt", side: "grass_side_snow" }, { hardness: 0.6, tool: "shovel", drop: "dirt" });
B(31, "snow_block", "Snow Block", "snow", { hardness: 0.2, tool: "shovel" });
B(32, "cactus", "Cactus", { top: "cactus_top", bottom: "cactus_bottom", side: "cactus_side" }, { hardness: 0.4, opaque: false });
B(33, "white_wool", "White Wool", "white_wool", { hardness: 0.8 });
B(34, "diamond_block", "Block of Diamond", "diamond_block", { hardness: 5, tool: "pickaxe", minTier: 1 });
B(35, "dead_bush", "Dead Bush", "dead_bush", { solid: false, opaque: false, render: "cross", hardness: 0, drop: "stick", dropCount: [0, 2], replaceable: true, needsSupport: true });
B(36, "mossy_cobblestone", "Mossy Cobblestone", "mossy_cobblestone", { hardness: 2, tool: "pickaxe", minTier: 0 });
B(37, "glowstone", "Glowstone", "glowstone", { hardness: 0.3, light: 15 });
B(38, "sapling", "Oak Sapling", "sapling", { solid: false, opaque: false, render: "cross", hardness: 0, needsSupport: true });
B(39, "andesite", "Andesite", "andesite", { hardness: 1.5, tool: "pickaxe", minTier: 0 });
B(40, "granite", "Granite", "granite", { hardness: 1.5, tool: "pickaxe", minTier: 0 });
B(41, "diorite", "Diorite", "diorite", { hardness: 1.5, tool: "pickaxe", minTier: 0 });
B(42, "clay", "Clay", "clay", { hardness: 0.6, tool: "shovel" });
B(43, "obsidian", "Obsidian", "obsidian", { hardness: 50, tool: "pickaxe", minTier: 2 });
B(44, "coal_block", "Block of Coal", "coal_block", { hardness: 5, tool: "pickaxe", minTier: 0 });
B(45, "gold_block", "Block of Gold", "gold_block", { hardness: 3, tool: "pickaxe", minTier: 1 });
B(46, "blue_orchid", "Blue Orchid", "blue_orchid", { solid: false, opaque: false, render: "cross", hardness: 0, needsSupport: true });

export const AIR = 0, STONE = 1, GRASS = 2, DIRT = 3, COBBLE = 4, OAK_PLANKS = 5, BEDROCK = 6, WATER = 7, LAVA = 8,
  SAND = 9, GRAVEL = 10, GOLD_ORE = 11, IRON_ORE = 12, COAL_ORE = 13, OAK_LOG = 14, OAK_LEAVES = 15,
  BIRCH_LOG = 16, BIRCH_LEAVES = 17, SPRUCE_LOG = 18, SPRUCE_LEAVES = 19, SANDSTONE = 22,
  DIAMOND_ORE = 23, REDSTONE_ORE = 24, CRAFTING_TABLE = 25, TORCH = 26, SHORT_GRASS = 27, DANDELION = 28,
  POPPY = 29, SNOWY_GRASS = 30, SNOW_BLOCK = 31, CACTUS = 32, WOOL = 33, DEAD_BUSH = 35,
  MOSSY_COBBLE = 36, GLOWSTONE = 37, ANDESITE = 39, GRANITE = 40, DIORITE = 41, CLAY = 42, OBSIDIAN = 43, BLUE_ORCHID = 46;

// ---- Items (non-block) ----
export const ITEMS = new Map<number, ItemDef>();
export const ITEM_BY_NAME = new Map<string, ItemDef>();
function I(id: number, name: string, display: string, opts: Partial<ItemDef> = {}) {
  const def: ItemDef = { id, name, display, tile: name, stack: 64, ...opts };
  ITEMS.set(id, def);
  ITEM_BY_NAME.set(name, def);
}
I(100, "stick", "Stick");
I(101, "coal", "Coal");
I(102, "diamond", "Diamond");
I(103, "wooden_pickaxe", "Wooden Pickaxe", { stack: 1, tool: { type: "pickaxe", tier: 0, speed: 2 }, attack: 2 });
I(104, "stone_pickaxe", "Stone Pickaxe", { stack: 1, tool: { type: "pickaxe", tier: 1, speed: 4 }, attack: 3 });
I(105, "diamond_pickaxe", "Diamond Pickaxe", { stack: 1, tool: { type: "pickaxe", tier: 2, speed: 8 }, attack: 5 });
I(106, "wooden_axe", "Wooden Axe", { stack: 1, tool: { type: "axe", tier: 0, speed: 2 }, attack: 7 });
I(107, "stone_axe", "Stone Axe", { stack: 1, tool: { type: "axe", tier: 1, speed: 4 }, attack: 9 });
I(108, "diamond_axe", "Diamond Axe", { stack: 1, tool: { type: "axe", tier: 2, speed: 8 }, attack: 9 });
I(109, "wooden_sword", "Wooden Sword", { stack: 1, tool: { type: "sword", tier: 0, speed: 1.5 }, attack: 4 });
I(110, "stone_sword", "Stone Sword", { stack: 1, tool: { type: "sword", tier: 1, speed: 1.5 }, attack: 5 });
I(111, "diamond_sword", "Diamond Sword", { stack: 1, tool: { type: "sword", tier: 2, speed: 1.5 }, attack: 7 });
I(112, "wooden_shovel", "Wooden Shovel", { stack: 1, tool: { type: "shovel", tier: 0, speed: 2 }, attack: 2.5 });
I(113, "stone_shovel", "Stone Shovel", { stack: 1, tool: { type: "shovel", tier: 1, speed: 4 }, attack: 3.5 });
I(114, "diamond_shovel", "Diamond Shovel", { stack: 1, tool: { type: "shovel", tier: 2, speed: 8 }, attack: 5.5 });
I(115, "porkchop", "Raw Porkchop", { food: 3 });
I(116, "beef", "Raw Beef", { food: 3 });
I(117, "feather", "Feather");
I(118, "rotten_flesh", "Rotten Flesh", { food: 4 });
I(119, "gunpowder", "Gunpowder");
I(120, "apple", "Apple", { food: 4 });
I(121, "raw_iron", "Raw Iron");
I(122, "raw_gold", "Raw Gold");
I(123, "redstone", "Redstone Dust");
I(124, "mutton", "Raw Mutton", { food: 2 });
I(125, "chicken", "Raw Chicken", { food: 2 });
I(126, "egg", "Egg", { stack: 16 });
I(127, "leather", "Leather");

export function isBlockItem(id: number) {
  return id < 100;
}
export function itemDisplay(id: number): string {
  if (isBlockItem(id)) return BLOCKS[id]?.display ?? "?";
  return ITEMS.get(id)?.display ?? "?";
}
export function itemMaxStack(id: number): number {
  if (isBlockItem(id)) return 64;
  return ITEMS.get(id)?.stack ?? 64;
}
export function itemIdByName(name: string): number {
  const b = BLOCK_BY_NAME.get(name);
  if (b) return b.id;
  const it = ITEM_BY_NAME.get(name);
  if (it) return it.id;
  throw new Error("Unknown item " + name);
}
export const PLANKS_IDS = [5, 20, 21];
export const LOG_IDS = [14, 16, 18];
export const LEAVES_IDS = [15, 17, 19];

export function blockDef(id: number): BlockDef {
  return blockList[id] ?? blockList[0];
}
export function isSolid(id: number) {
  return blockList[id]?.solid ?? false;
}
export function isOpaque(id: number) {
  return blockList[id]?.opaque ?? false;
}
export function isLiquid(id: number) {
  return id === WATER || id === LAVA;
}
export function isPlant(id: number) {
  return blockList[id]?.render === "cross";
}
// Blocks a plant / torch may rest on
export function canSupport(id: number) {
  const d = blockList[id];
  return !!d && d.solid && d.render === "cube" && d.opaque;
}

// Face ordering used throughout: 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z
export const FACE_DIRS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function faceTexture(def: BlockDef, face: number, meta = 0): string {
  if (face === 2) return def.tex.top;
  if (face === 3) return def.tex.bottom;
  if (def.tex.front) {
    // meta stores facing for blocks with a front (0:+Z 1:-X 2:-Z 3:+X)
    const facing = [4, 1, 5, 0][meta & 3];
    if (face === facing) return def.tex.front;
  }
  return def.tex.side;
}
