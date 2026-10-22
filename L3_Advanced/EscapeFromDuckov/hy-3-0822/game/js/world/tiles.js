// ============================================================
//  tiles.js — 瓦片 / 墙体 / 家具定义
//  地面：影响移速与脚步噪音（僵毁式声学）
//  墙体：solid 阻挡移动，opaque 阻挡视线（鸭科夫式视线迷雾）
//  家具：可搜刮容器 / 可拆解取材 / 可交互设施
// ============================================================

import { ENV } from '../core/palette.js';

// ------------------------------------------------------------
//  地面
// ------------------------------------------------------------
export const FLOORS = [
  { name: 'void', col: '#0a0c10', col2: '#0a0c10', spd: 1, noise: 1, void: true },
  { name: '沥青路', col: ENV.asphalt, col2: ENV.asphalt2, spd: 1.0, noise: 1.0 },
  { name: '水泥地', col: ENV.concrete, col2: ENV.concrete2, spd: 1.0, noise: 1.0 },
  { name: '泥地', col: ENV.dirt, col2: ENV.dirt2, spd: 0.94, noise: 0.75 },
  { name: '草地', col: ENV.grass, col2: ENV.grass2, spd: 0.92, noise: 0.6 },
  { name: '木地板', col: ENV.woodFloor, col2: ENV.woodFloor2, spd: 1.0, noise: 1.15 },
  { name: '瓷砖', col: ENV.tileFloor, col2: ENV.tileFloor2, spd: 1.0, noise: 1.2 },
  { name: '实验室地面', col: ENV.labFloor, col2: ENV.labFloor2, spd: 1.0, noise: 1.25 },
  { name: '地毯', col: ENV.carpet, col2: '#54404a', spd: 0.97, noise: 0.5 },
  { name: '碎石', col: ENV.gravel, col2: '#63645f', spd: 0.9, noise: 1.4 },
  { name: '积水', col: ENV.water, col2: '#365260', spd: 0.62, noise: 1.5, wet: true },
  { name: '枯草', col: ENV.grassDry, col2: '#756f4d', spd: 0.9, noise: 0.75 },
  { name: '铁板', col: ENV.metal, col2: ENV.metalDark, spd: 1.0, noise: 1.7 },
  { name: '农田', col: '#5f5638', col2: '#6b6140', spd: 0.85, noise: 0.8 },
];
export const F = {};
FLOORS.forEach((f, i) => { F[f.name] = i; });
export const F_VOID = 0, F_ASPHALT = 1, F_CONCRETE = 2, F_DIRT = 3, F_GRASS = 4, F_WOOD = 5,
  F_TILE = 6, F_LAB = 7, F_CARPET = 8, F_GRAVEL = 9, F_WATER = 10, F_DRYGRASS = 11, F_METAL = 12, F_FARM = 13;

// ------------------------------------------------------------
//  墙体（0 = 空）
// ------------------------------------------------------------
export const WALLS = [
  null,
  { name: '砖墙', col: ENV.wallBrick, dark: ENV.wallBrickDark, hp: 300, solid: 1, opaque: 1, mat: 'brick' },
  { name: '水泥墙', col: ENV.wallConcrete, dark: ENV.wallConcreteDark, hp: 460, solid: 1, opaque: 1, mat: 'concrete' },
  { name: '木墙', col: ENV.wallWood, dark: ENV.wallWoodDark, hp: 160, solid: 1, opaque: 1, mat: 'wood', drop: ['plank', 2] },
  { name: '实验室隔墙', col: ENV.wallLab, dark: ENV.wallLabDark, hp: 400, solid: 1, opaque: 1, mat: 'metal' },
  { name: '集装箱', col: ENV.container, dark: '#2f544d', hp: 600, solid: 1, opaque: 1, mat: 'metal' },
  { name: '岩壁', col: '#4f5358', dark: '#3d4145', hp: 900, solid: 1, opaque: 1, mat: 'rock' },
  { name: '裂缝墙体', col: '#6b5a4a', dark: '#54463a', hp: 999999, solid: 1, opaque: 1, mat: 'crack', breach: true },
  { name: '铁丝网', col: '#7d858c', dark: '#5b6167', hp: 120, solid: 1, opaque: 0, mat: 'metal', drop: ['scrap', 2] },
  { name: '灌木墙', col: '#3f5236', dark: '#33452c', hp: 80, solid: 1, opaque: 1, mat: 'wood' },
  { name: '柜台', col: '#7d6343', dark: '#5f4a31', hp: 140, solid: 1, opaque: 0, mat: 'wood', low: 1, drop: ['plank', 2] },
  { name: '树', col: '#3d5230', dark: '#2f4126', hp: 500, solid: 1, opaque: 1, mat: 'wood', tree: 1, drop: ['wood_stick', 3] },
  { name: '玻璃幕墙', col: ENV.glass, dark: '#6f929c', hp: 40, solid: 1, opaque: 0, mat: 'glass', glass: 1 },
  { name: '货架墙', col: '#6d747a', dark: '#525a60', hp: 200, solid: 1, opaque: 1, mat: 'metal', drop: ['scrap', 3] },
];
export const W = {};
WALLS.forEach((w, i) => { if (w) W[w.name] = i; });
export const W_BRICK = 1, W_CONCRETE = 2, W_WOOD = 3, W_LAB = 4, W_CONTAINER = 5, W_ROCK = 6,
  W_CRACK = 7, W_FENCE = 8, W_HEDGE = 9, W_COUNTER = 10, W_TREE = 11, W_GLASS = 12, W_RACK = 13;

// ------------------------------------------------------------
//  家具 / 交互物（0 = 空）
//  solid: 阻挡移动 · opaque: 阻挡视线 · cont: 容器类型 · dis: 拆解产物
//  act: 交互类型（设施）
// ------------------------------------------------------------
export const OBJS = [
  null,
  { name: '桌子', solid: 1, opaque: 0, low: 1, hp: 100, col: '#7d6343', dis: [['plank', 2], ['nails', 4]], tool: 'saw' },
  { name: '椅子', solid: 0, opaque: 0, low: 1, hp: 60, col: '#6a5236', dis: [['plank', 1], ['nails', 2]], tool: 'saw' },
  { name: '货架', solid: 1, opaque: 1, hp: 120, col: '#6d747a', cont: 'shelf', dis: [['scrap', 2]], tool: 'screwdriver' },
  { name: '储物柜', solid: 1, opaque: 1, hp: 140, col: '#5b6152', cont: 'locker', dis: [['scrap', 3]], tool: 'screwdriver' },
  { name: '冰箱', solid: 1, opaque: 1, hp: 180, col: '#8f969c', cont: 'fridge', dis: [['scrap', 3], ['electronics', 1]], tool: 'screwdriver' },
  { name: '厨柜', solid: 1, opaque: 0, low: 1, hp: 110, col: '#6a5236', cont: 'kitchen_cab', dis: [['plank', 2]], tool: 'saw' },
  { name: '床', solid: 0, opaque: 0, low: 1, hp: 90, col: '#6b5560', act: 'sleep', dis: [['plank', 3], ['cloth', 4]], tool: 'saw' },
  { name: '木箱', solid: 1, opaque: 0, low: 1, hp: 90, col: '#8a6b3d', cont: 'crate', dis: [['plank', 2]], tool: 'saw' },
  { name: '医疗箱', solid: 1, opaque: 0, low: 1, hp: 80, col: '#c23b3b', cont: 'medbox' },
  { name: '武器柜', solid: 1, opaque: 1, hp: 200, col: '#3a3d44', cont: 'gunlocker', dis: [['scrap', 4]], tool: 'screwdriver' },
  { name: '办公桌', solid: 1, opaque: 0, low: 1, hp: 100, col: '#6a5236', cont: 'desk', dis: [['plank', 2], ['nails', 3]], tool: 'saw' },
  { name: '衣柜', solid: 1, opaque: 1, hp: 130, col: '#7d6343', cont: 'wardrobe', dis: [['plank', 3], ['nails', 4]], tool: 'saw' },
  { name: '垃圾桶', solid: 1, opaque: 0, low: 1, hp: 50, col: '#4c5450', cont: 'trash' },
  { name: '工具箱', solid: 0, opaque: 0, low: 1, hp: 50, col: '#a83b2a', cont: 'toolbox' },
  { name: '保险柜', solid: 1, opaque: 1, hp: 500, col: '#43474f', cont: 'safe', locked: 1 },
  { name: '弹药箱', solid: 1, opaque: 0, low: 1, hp: 90, col: '#4d5340', cont: 'ammobox' },
  { name: '实验柜', solid: 1, opaque: 1, hp: 160, col: '#3f6b62', cont: 'lab_cab', dis: [['electronics', 2], ['scrap', 2]], tool: 'screwdriver' },
  { name: '矿车', solid: 1, opaque: 0, low: 1, hp: 200, col: '#6b6a63', cont: 'minecart' },
  { name: '车辆残骸', solid: 1, opaque: 1, hp: 400, col: '#5b6152', cont: 'car', big: 1 },
  { name: '灌木', solid: 0, opaque: 0, cover: 0.55, hp: 40, col: '#3f5236', dis: [['wood_stick', 1]] },
  { name: '油桶', solid: 1, opaque: 0, low: 1, hp: 70, col: '#a83b2a', explode: 1 },
  { name: '沙发', solid: 1, opaque: 0, low: 1, hp: 100, col: '#5d4750', dis: [['cloth', 5], ['plank', 1]], tool: 'saw' },
  { name: '尸体', solid: 0, opaque: 0, hp: 1, col: '#7d2b32', cont: 'corpse' },
  { name: '篝火', solid: 0, opaque: 0, hp: 20, col: '#d4632a', act: 'fire', fire: 1, light: 7 },
  // ---- 基地设施 ----
  { name: '发电机', solid: 1, opaque: 0, low: 1, hp: 300, col: '#4d5340', act: 'facility', fac: 'generator' },
  { name: '工作台', solid: 1, opaque: 0, low: 1, hp: 300, col: '#7d6343', act: 'facility', fac: 'workbench' },
  { name: '厨房灶台', solid: 1, opaque: 0, low: 1, hp: 300, col: '#8f969c', act: 'facility', fac: 'kitchen', fire: 1 },
  { name: '健身器材', solid: 1, opaque: 0, low: 1, hp: 300, col: '#3a3d44', act: 'facility', fac: 'gym' },
  { name: '技术中心', solid: 1, opaque: 0, low: 1, hp: 300, col: '#3f6b62', act: 'facility', fac: 'tech' },
  { name: '医疗站', solid: 1, opaque: 0, low: 1, hp: 300, col: '#c23b3b', act: 'facility', fac: 'medbay' },
  { name: '仓库箱', solid: 1, opaque: 0, low: 1, hp: 999, col: '#8a6b2a', cont: 'stash', stash: 1 },
  { name: '星际飞船', solid: 1, opaque: 0, hp: 9999, col: '#8a9299', act: 'ship', big: 2 },
  { name: '部署终端', solid: 1, opaque: 0, low: 1, hp: 999, col: '#3f6b62', act: 'deploy' },
  { name: '防空导弹', solid: 1, opaque: 0, hp: 9999, col: '#4a5560', act: 'aa', big: 1 },
  { name: '配电箱', solid: 1, opaque: 0, low: 1, hp: 200, col: '#c8c04a', act: 'power' },
  { name: '床铺', solid: 0, opaque: 0, low: 1, hp: 90, col: '#4d5340', act: 'sleep' },
  { name: '实验台', solid: 1, opaque: 0, low: 1, hp: 150, col: '#4a5560', cont: 'lab_cab' },
  { name: '货物托盘', solid: 1, opaque: 0, low: 1, hp: 80, col: '#8a6b3d', cont: 'crate' },
];
export const O = {};
OBJS.forEach((o, i) => { if (o) O[o.name] = i; });

export const O_TABLE = 1, O_CHAIR = 2, O_SHELF = 3, O_LOCKER = 4, O_FRIDGE = 5, O_KITCHEN = 6,
  O_BED = 7, O_CRATE = 8, O_MEDBOX = 9, O_GUNLOCKER = 10, O_DESK = 11, O_WARDROBE = 12,
  O_TRASH = 13, O_TOOLBOX = 14, O_SAFE = 15, O_AMMOBOX = 16, O_LABCAB = 17, O_MINECART = 18,
  O_CAR = 19, O_BUSH = 20, O_BARREL = 21, O_SOFA = 22, O_CORPSE = 23, O_CAMPFIRE = 24,
  O_GEN = 25, O_BENCH = 26, O_STOVE = 27, O_GYM = 28, O_TECH = 29, O_MEDBAY = 30, O_STASH = 31,
  O_SHIP = 32, O_DEPLOY = 33, O_AA = 34, O_POWERBOX = 35, O_BUNK = 36, O_LABDESK = 37, O_PALLET = 38;

export function floorDef(i) { return FLOORS[i] || FLOORS[0]; }
export function wallDef(i) { return i ? WALLS[i] : null; }
export function objDef(i) { return i ? OBJS[i] : null; }
