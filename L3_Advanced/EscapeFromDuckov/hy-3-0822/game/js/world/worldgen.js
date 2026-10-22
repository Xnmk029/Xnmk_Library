// ============================================================
//  worldgen.js — 地图生成入口 + 零号区/仓库区/农场镇
// ============================================================

import { Level } from './level.js';
import { RNG, dist } from '../core/util.js';
import { rollLoot } from '../data/loot.js';
import { mkItem } from '../data/items.js';
import { SPAWN_TABLE } from '../data/enemies.js';
import { putBuilding, fillRect, rectOutline, placeRacks, canPlace, clearRect } from './build.js';
import {
  F_ASPHALT, F_CONCRETE, F_DIRT, F_GRASS, F_WOOD, F_TILE, F_GRAVEL, F_WATER, F_DRYGRASS, F_FARM, F_METAL,
  W_BRICK, W_CONCRETE, W_WOOD, W_CONTAINER, W_ROCK, W_CRACK, W_FENCE, W_HEDGE, W_TREE, W_GLASS, W_RACK,
  O_CAR, O_BUSH, O_TRASH, O_CRATE, O_BARREL, O_MINECART, O_PALLET, O_SHELF, O_CORPSE, O_SAFE, O_AMMOBOX, O_GUNLOCKER, O_MEDBOX,
} from './tiles.js';
import { genLab, genStorm, genHideout } from './worldgen_special.js';

export function generateLevel(cfg, seed, meta = {}) {
  const rng = new RNG(seed);
  const l = new Level(cfg.w, cfg.h, cfg);
  l.spawnList = [];
  l.seed = seed;
  switch (cfg.gen) {
    case 'town': genTown(l, rng, cfg); break;
    case 'warehouse': genWarehouse(l, rng, cfg); break;
    case 'farm': genFarm(l, rng, cfg); break;
    case 'lab': genLab(l, rng, cfg); break;
    case 'storm': genStorm(l, rng, cfg); break;
    case 'hideout': genHideout(l, rng, cfg); break;
    default: genTown(l, rng, cfg); break;
  }
  if (cfg.gen !== 'hideout') finalize(l, cfg, rng, meta);
  else l.rebuildFlags();
  return l;
}

// ------------------------------------------------------------
//  收尾：战利品 / 撤离点 / 刷怪 / 保底道具
// ------------------------------------------------------------
function finalize(l, cfg, rng, meta) {
  l.rebuildFlags();
  const tier = cfg.tier || 1;
  for (const c of l.containers) {
    if (c.kind === 'stash') continue;
    c.items = rollLoot(c.kind, tier, rng, cfg.lootMul || 1);
  }
  placeExtractions(l, cfg, rng);
  spawnEnemies(l, cfg, rng);
  placeBosses(l, cfg, rng);
  injectQuestItems(l, cfg, rng, meta);
}

function walkableList(l, minDistFrom, minD) {
  const out = [];
  for (let y = 2; y < l.h - 2; y++) {
    for (let x = 2; x < l.w - 2; x++) {
      const idx = l.i(x, y);
      if (l.solid[idx] || !l.floor[idx]) continue;
      if (minDistFrom && dist(x, y, minDistFrom.x, minDistFrom.y) < minD) continue;
      out.push({ x, y });
    }
  }
  return out;
}

function placeExtractions(l, cfg, rng) {
  const n = cfg.extractions || 2;
  const cands = [];
  for (let y = 3; y < l.h - 3; y++) {
    for (let x = 3; x < l.w - 3; x++) {
      const edge = x < 7 || y < 7 || x > l.w - 8 || y > l.h - 8;
      if (!edge) continue;
      if (l.solid[l.i(x, y)] || !l.floor[l.i(x, y)]) continue;
      if (dist(x, y, l.spawn.x, l.spawn.y) < Math.min(l.w, l.h) * 0.35) continue;
      cands.push({ x, y });
    }
  }
  rng.shuffle(cands);
  const names = ['南侧公路撤离点', '东侧铁道撤离点', '北侧山道撤离点', '西侧渡口撤离点', '货运升降机'];
  const chosen = [];
  for (const c of cands) {
    if (chosen.length >= n) break;
    if (chosen.some((o) => dist(o.x, o.y, c.x, c.y) < 25)) continue;
    chosen.push(c);
  }
  if (!chosen.length && cands.length) chosen.push(cands[0]);
  chosen.forEach((c, i) => {
    l.extractions.push({ x: c.x, y: c.y, r: 2.2, name: names[i % names.length], hold: 0 });
    l.markers.push({ x: c.x, y: c.y, label: '撤离', kind: 'extract' });
    // 撤离点周围清理出空地
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (!l.inB(x, y)) continue;
      if (l.wall[l.i(x, y)] === W_TREE || l.obj[l.i(x, y)] === O_BUSH) { l.wall[l.i(x, y)] = 0; l.obj[l.i(x, y)] = 0; }
      if (!l.floor[l.i(x, y)]) l.floor[l.i(x, y)] = F_CONCRETE;
      l.refresh(x, y);
    }
  });
}

function spawnEnemies(l, cfg, rng) {
  const table = SPAWN_TABLE[cfg.tier] || SPAWN_TABLE[1];
  const spots = walkableList(l, l.spawn, 16);
  if (!spots.length) return;
  const area = l.w * l.h;
  let n = Math.round((area / 300) * (cfg.density || 1));
  rng.shuffle(spots);
  let si = 0;
  for (let i = 0; i < n && si < spots.length; i++) {
    const s = spots[si++];
    l.spawnList.push({ type: rng.weighted(table), x: s.x + 0.5, y: s.y + 0.5 });
  }
  // 尸群（成堆刷新，僵毁式）
  const hordes = 2 + Math.round((cfg.density || 1) * 2);
  for (let hh = 0; hh < hordes && si < spots.length; hh++) {
    const c = spots[si++];
    const cnt = rng.int(4, 8);
    for (let k = 0; k < cnt; k++) {
      const a = rng.float(0, Math.PI * 2), r = rng.float(0.5, 3.5);
      const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
      if (l.isSolid(x, y) || !l.floorAt(x | 0, y | 0)) continue;
      l.spawnList.push({ type: rng.weighted(table), x: x + 0.5, y: y + 0.5, horde: hh });
    }
  }
}

function placeBosses(l, cfg, rng) {
  for (const b of (cfg.boss || [])) {
    if (b.chance !== undefined && !rng.chance(b.chance)) continue;
    let pos = null;
    if (b.place && l.special[b.place]) pos = l.special[b.place];
    if (!pos) {
      const spots = walkableList(l, l.spawn, Math.min(l.w, l.h) * 0.45);
      if (!spots.length) continue;
      pos = rng.pick(spots);
    }
    const count = b.count || 1;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = pos.x + Math.cos(a) * (count > 1 ? 2.5 : 0);
      const y = pos.y + Math.sin(a) * (count > 1 ? 2.5 : 0);
      const p = l.findOpen(x | 0, y | 0, 8, rng);
      l.spawnList.push({ type: b.type, x: p.x + 0.5, y: p.y + 0.5, boss: true });
    }
    l.markers.push({ x: pos.x, y: pos.y, label: 'BOSS', kind: 'boss' });
  }
  if (cfg.merchant) {
    const pos = l.special.merchant || l.findOpen((l.w * 0.5) | 0, (l.h * 0.5) | 0, 20, rng);
    l.spawnList.push({ type: 'merchant', x: pos.x + 0.5, y: pos.y + 0.5 });
    l.markers.push({ x: pos.x, y: pos.y, label: '商人', kind: 'merchant' });
  }
}

/** 保底任务道具（飞船部件 / 凭证材料） */
function injectQuestItems(l, cfg, rng, meta) {
  const want = [];
  const owned = meta.shipOwned || {};
  if (cfg.tier === 1 && !owned.ship_engine) want.push('ship_engine');
  if (cfg.tier === 2 && !owned.ship_hull) want.push('ship_hull');
  if (cfg.tier === 3 && !owned.ship_nav && rng.chance(0.5)) want.push('ship_nav');
  if (cfg.tier === 4 && !owned.ship_fuel && rng.chance(0.4)) want.push('ship_fuel');
  if (cfg.tier === 5 && !owned.ship_core) want.push('ship_core');
  if (cfg.tier >= 2 && rng.chance(0.5)) want.push('explosive_charge');
  if (cfg.tier === 3 && rng.chance(0.35)) want.push('credential_1');
  if (cfg.tier >= 3 && rng.chance(0.3)) want.push('protein_powder');
  const pref = ['safe', 'gunlocker', 'lab_cab', 'minecart', 'crate', 'shelf', 'locker'];
  for (const id of want) {
    let target = null;
    for (const k of pref) {
      const pool = l.containers.filter((c) => c.kind === k);
      if (pool.length) { target = rng.pick(pool); break; }
    }
    if (target) target.items.push(mkItem(id, 1));
  }
}

// ============================================================
//  零号区：村落废墟（僵毁式小镇路网 + 独立庭院）
// ============================================================
function genTown(l, rng, cfg) {
  const W = l.w, H = l.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    l.floor[l.i(x, y)] = rng.chance(0.16) ? F_DRYGRASS : F_GRASS;
  }
  // 边界岩壁
  rectOutline(l, 0, 0, W, H, W_ROCK);
  rectOutline(l, 1, 1, W - 2, H - 2, W_ROCK);

  // 路网
  const roadsY = [Math.round(H * 0.3), Math.round(H * 0.68)];
  const roadsX = [Math.round(W * 0.28), Math.round(W * 0.72)];
  for (const ry of roadsY) { fillRect(l, 2, ry - 1, W - 4, 3, F_ASPHALT); fillRect(l, 2, ry - 2, W - 4, 1, F_CONCRETE); fillRect(l, 2, ry + 2, W - 4, 1, F_CONCRETE); }
  for (const rx of roadsX) { fillRect(l, rx - 1, 2, 3, H - 4, F_ASPHALT); fillRect(l, rx - 2, 2, 1, H - 4, F_CONCRETE); fillRect(l, rx + 2, 2, 1, H - 4, F_CONCRETE); }

  // 街区建筑
  const blocks = [];
  const xs = [3, roadsX[0] + 4, roadsX[1] + 4, W - 3];
  const ys = [3, roadsY[0] + 4, roadsY[1] + 4, H - 3];
  for (let bi = 0; bi < 3; bi++) {
    for (let bj = 0; bj < 3; bj++) {
      const x0 = xs[bi], x1 = (bi === 2 ? xs[3] : roadsX[bi] - 3);
      const y0 = ys[bj], y1 = (bj === 2 ? ys[3] : roadsY[bj] - 3);
      if (x1 - x0 > 12 && y1 - y0 > 12) blocks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  const houseKinds = [['bed', 'living', 'kitchen', 'bath'], ['living', 'kitchen', 'bed'], ['storage', 'garage', 'living']];
  let specialLeft = ['med', 'armory', 'shop'];
  for (const b of blocks) {
    const nB = rng.int(1, 2);
    for (let k = 0; k < nB; k++) {
      const bw = rng.int(9, Math.min(16, b.w - 2));
      const bh = rng.int(8, Math.min(14, b.h - 2));
      const bx = b.x + rng.int(1, Math.max(1, b.w - bw - 1));
      const by = b.y + rng.int(1, Math.max(1, b.h - bh - 1));
      // 避免重叠
      let overlap = false;
      for (const eb of l.buildings) {
        if (bx < eb.x + eb.w + 2 && bx + bw + 2 > eb.x && by < eb.y + eb.h + 2 && by + bh + 2 > eb.y) { overlap = true; break; }
      }
      if (overlap) continue;
      let kinds = rng.pick(houseKinds);
      let name = '民宅';
      if (specialLeft.length && rng.chance(0.35)) {
        const sp = specialLeft.pop();
        kinds = sp === 'med' ? ['med', 'office', 'bath'] : sp === 'armory' ? ['armory', 'office', 'storage'] : ['shop', 'storage', 'office'];
        name = sp === 'med' ? '村诊所' : sp === 'armory' ? '警务点' : '杂货铺';
      }
      putBuilding(l, bx, by, bw, bh, {
        wall: rng.chance(0.6) ? W_BRICK : W_WOOD, floor: F_WOOD, kinds, rooms: bw * bh > 110 ? 3 : 2,
        windows: 0.55, doors: rng.int(1, 2), name, lockChance: 0.22,
      }, rng);
      // 庭院栅栏
      if (rng.chance(0.45)) {
        const fx = Math.max(2, bx - 2), fy = Math.max(2, by - 2);
        const fw = Math.min(W - fx - 2, bw + 4), fh = Math.min(H - fy - 2, bh + 4);
        for (let i = fx; i < fx + fw; i++) { fenceIf(l, i, fy, rng); fenceIf(l, i, fy + fh - 1, rng); }
        for (let j = fy; j < fy + fh; j++) { fenceIf(l, fx, j, rng); fenceIf(l, fx + fw - 1, j, rng); }
      }
    }
  }

  scatterOutdoor(l, rng, { trees: 0.02, bushes: 0.016, cars: 26, trash: 22, corpses: 14 });

  // 北山裂缝（通往仓库区）
  const crackY = 3;
  fillRect(l, 2, 2, W - 4, 3, F_GRAVEL);
  for (let x = 4; x < W - 4; x++) { l.wall[l.i(x, crackY)] = W_ROCK; }
  const cx = Math.round(W * 0.5);
  for (let x = cx - 1; x <= cx + 1; x++) l.wall[l.i(x, crackY)] = W_CRACK;
  l.special.breach = { x: cx, y: crackY };
  l.markers.push({ x: cx, y: crackY, label: '裂缝墙体', kind: 'breach' });

  // 出生点：南侧公路
  const sp = l.findOpen(Math.round(W * 0.5), H - 6, 12, rng);
  l.spawn = { x: sp.x + 0.5, y: sp.y + 0.5 };
}

function fenceIf(l, x, y, rng) {
  if (!l.inB(x, y)) return;
  const idx = l.i(x, y);
  if (l.wall[idx] || l.obj[idx] || l.doorMap.get(idx)) return;
  if (l.floor[idx] === F_ASPHALT || l.floor[idx] === F_CONCRETE) return;
  if (rng.chance(0.16)) return; // 缺口
  l.wall[idx] = rng.chance(0.75) ? W_FENCE : W_HEDGE;
}

/** 户外装饰散布 */
export function scatterOutdoor(l, rng, o) {
  const W = l.w, H = l.h;
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const idx = l.i(x, y);
      if (l.wall[idx] || l.obj[idx] || !l.floor[idx]) continue;
      if (l.room[idx] >= 0) continue;
      const f = l.floor[idx];
      const soft = f === F_GRASS || f === F_DRYGRASS || f === F_DIRT || f === F_FARM;
      if (soft && rng.chance(o.trees || 0)) { l.wall[idx] = W_TREE; continue; }
      if (soft && rng.chance(o.bushes || 0)) { l.obj[idx] = O_BUSH; continue; }
      if (f === F_WATER) continue;
    }
  }
  const place = (n, fn) => {
    for (let k = 0; k < n; k++) {
      const x = rng.int(3, W - 4), y = rng.int(3, H - 4);
      if (!canPlace(l, x, y) || l.room[l.i(x, y)] >= 0) continue;
      fn(x, y);
    }
  };
  place(o.cars || 0, (x, y) => { if (l.floor[l.i(x, y)] === F_ASPHALT) l.setObj(x, y, O_CAR); });
  place(o.trash || 0, (x, y) => l.setObj(x, y, O_TRASH));
  place(o.corpses || 0, (x, y) => l.setObj(x, y, O_CORPSE));
  place(o.crates || 0, (x, y) => l.setObj(x, y, O_CRATE));
  place(o.barrels || 0, (x, y) => l.setObj(x, y, O_BARREL));
}

// ============================================================
//  仓库区：工业厂区（大跨度室内 + 集装箱迷宫）
// ============================================================
function genWarehouse(l, rng, cfg) {
  const W = l.w, H = l.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) l.floor[l.i(x, y)] = rng.chance(0.35) ? F_GRAVEL : F_CONCRETE;
  rectOutline(l, 0, 0, W, H, W_CONCRETE);
  rectOutline(l, 1, 1, W - 2, H - 2, W_CONCRETE);

  // 主干道
  fillRect(l, 2, Math.round(H / 2) - 2, W - 4, 5, F_ASPHALT);
  fillRect(l, Math.round(W / 2) - 2, 2, 5, H - 4, F_ASPHALT);

  // 4 座大仓库
  const specs = [
    { x: 6, y: 6, w: 30, h: 20 },
    { x: W - 38, y: 6, w: 32, h: 18 },
    { x: 6, y: H - 28, w: 28, h: 22 },
    { x: W - 34, y: H - 26, w: 28, h: 20 },
  ];
  specs.forEach((s, i) => {
    if (s.x < 3 || s.y < 3 || s.x + s.w > W - 3 || s.y + s.h > H - 3) return;
    const b = putBuilding(l, s.x, s.y, s.w, s.h, {
      wall: W_CONCRETE, floor: F_CONCRETE, kinds: i === 1 ? ['warehouse', 'office', 'armory'] : ['warehouse', 'storage', 'office'],
      rooms: 2, minRoom: 8, windows: 0.18, doors: 2, name: `${i + 1}号仓库`, dark: true, lockChance: 0.35,
    }, rng);
    for (const rid of b.rooms) {
      const r = l.rooms[rid];
      if (r.kind === 'warehouse') placeRacks(l, r.x, r.y, r.w, r.h, rng);
    }
  });

  // 集装箱迷宫
  for (let k = 0; k < 26; k++) {
    const cw = rng.chance(0.5) ? 6 : 2, ch = cw === 6 ? 2 : 6;
    const x = rng.int(3, W - cw - 3), y = rng.int(3, H - ch - 3);
    let ok = true;
    for (let j = y - 1; j < y + ch + 1 && ok; j++) for (let i = x - 1; i < x + cw + 1 && ok; i++) {
      if (!l.inB(i, j) || l.wall[l.i(i, j)] || l.room[l.i(i, j)] >= 0 || l.floor[l.i(i, j)] === F_ASPHALT) ok = false;
    }
    if (!ok) continue;
    for (let j = y; j < y + ch; j++) for (let i = x; i < x + cw; i++) l.wall[l.i(i, j)] = W_CONTAINER;
    // 部分集装箱可进入
    if (rng.chance(0.4)) {
      const ix = cw === 6 ? x + rng.int(1, 4) : x, iy = ch === 6 ? y + rng.int(1, 4) : y;
      l.wall[l.i(ix, iy)] = 0; l.floor[l.i(ix, iy)] = F_METAL;
      if (cw === 6) { for (let i = x + 1; i < x + cw - 1; i++) { l.wall[l.i(i, y + (ch > 2 ? 1 : 0))] = 0; l.floor[l.i(i, y)] = F_METAL; } }
      if (canPlace(l, ix, iy)) l.setObj(ix, iy, rng.pick([O_CRATE, O_AMMOBOX, O_PALLET]));
    }
  }

  scatterOutdoor(l, rng, { cars: 16, trash: 18, corpses: 16, crates: 24, barrels: 18 });

  // 西厂区裂缝（通往农场镇）
  const by = Math.round(H * 0.5);
  for (let y = by - 6; y <= by + 6; y++) l.wall[l.i(2, y)] = W_CONCRETE;
  for (let y = by - 1; y <= by + 1; y++) l.wall[l.i(2, y)] = W_CRACK;
  fillRect(l, 3, by - 3, 4, 7, F_GRAVEL);
  l.special.breach = { x: 2, y: by };
  l.markers.push({ x: 2, y: by, label: '裂缝墙体', kind: 'breach' });

  const sp = l.findOpen(Math.round(W * 0.5), H - 5, 14, rng);
  l.spawn = { x: sp.x + 0.5, y: sp.y + 0.5 };
}

// ============================================================
//  农场镇：开放农田 + 锯木厂 + 矿场 + 通往 J-Lab 的办公楼
// ============================================================
function genFarm(l, rng, cfg) {
  const W = l.w, H = l.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    l.floor[l.i(x, y)] = rng.chance(0.25) ? F_DRYGRASS : F_GRASS;
  }
  rectOutline(l, 0, 0, W, H, W_ROCK);
  rectOutline(l, 1, 1, W - 2, H - 2, W_ROCK);
  // 土路
  fillRect(l, 2, Math.round(H * 0.55) - 1, W - 4, 3, F_DIRT);
  fillRect(l, Math.round(W * 0.45) - 1, 2, 3, H - 4, F_DIRT);

  // 农田
  for (let k = 0; k < 4; k++) {
    const fw = rng.int(12, 20), fh = rng.int(10, 16);
    const fx = rng.int(4, W - fw - 4), fy = rng.int(4, H - fh - 4);
    for (let j = fy; j < fy + fh; j++) {
      for (let i = fx; i < fx + fw; i++) {
        if (l.room[l.i(i, j)] >= 0) continue;
        l.floor[l.i(i, j)] = (j % 2 === 0) ? F_FARM : F_DIRT;
      }
    }
  }
  // 池塘
  const px = rng.int(10, W - 14), py = rng.int(10, H - 14);
  for (let j = -4; j <= 4; j++) for (let i = -5; i <= 5; i++) {
    if (i * i * 0.6 + j * j < 14 && l.inB(px + i, py + j)) l.floor[l.i(px + i, py + j)] = F_WATER;
  }

  // 农舍 + 谷仓
  putBuilding(l, 8, 8, 14, 11, { wall: W_WOOD, floor: F_WOOD, kinds: ['bed', 'kitchen', 'living', 'bath'], rooms: 3, windows: 0.6, doors: 2, name: '农舍' }, rng);
  const barn = putBuilding(l, W - 26, 7, 20, 15, { wall: W_WOOD, floor: F_DIRT, kinds: ['storage', 'warehouse'], rooms: 1, minRoom: 8, windows: 0.25, doors: 2, name: '谷仓', dark: true }, rng);
  for (const rid of barn.rooms) { const r = l.rooms[rid]; placeRacks(l, r.x, r.y, r.w, r.h, rng); }

  // 锯木厂
  const sx = 8, sy = H - 26;
  fillRect(l, sx - 2, sy - 2, 24, 22, F_GRAVEL);
  putBuilding(l, sx, sy, 16, 12, { wall: W_WOOD, floor: F_CONCRETE, kinds: ['warehouse', 'garage', 'office'], rooms: 2, minRoom: 6, windows: 0.3, doors: 2, name: '锯木厂', dark: true }, rng);
  for (let k = 0; k < 22; k++) {
    const x = sx + rng.int(-1, 20), y = sy + rng.int(12, 19);
    if (canPlace(l, x, y)) l.setObj(x, y, rng.chance(0.5) ? O_CRATE : O_PALLET);
  }
  l.special.sawmill = { x: sx + 8, y: sy + 16 };
  l.markers.push({ x: sx + 8, y: sy + 16, label: '锯木厂', kind: 'poi' });

  // 矿场（岩体 + 隧道）
  const mx = W - 30, my = H - 30;
  for (let j = my; j < my + 26; j++) for (let i = mx; i < mx + 26; i++) {
    if (l.inB(i, j)) { l.wall[l.i(i, j)] = W_ROCK; l.floor[l.i(i, j)] = F_GRAVEL; }
  }
  // 挖隧道
  let tx = mx + 2, ty = my + 13;
  for (let step = 0; step < 40; step++) {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (l.inB(tx + i, ty + j) && tx + i > mx && ty + j > my) l.wall[l.i(tx + i, ty + j)] = 0;
    }
    tx += rng.chance(0.72) ? 1 : 0;
    ty += rng.int(-1, 1);
    ty = Math.max(my + 3, Math.min(my + 22, ty));
    if (tx > mx + 22) break;
  }
  // 矿洞大厅
  const hx = mx + 16, hy = my + 12;
  for (let j = -5; j <= 5; j++) for (let i = -6; i <= 6; i++) {
    if (i * i * 0.5 + j * j < 22 && l.inB(hx + i, hy + j)) { l.wall[l.i(hx + i, hy + j)] = 0; l.floor[l.i(hx + i, hy + j)] = F_GRAVEL; }
  }
  for (let k = 0; k < 8; k++) {
    const x = hx + rng.int(-5, 5), y = hy + rng.int(-4, 4);
    if (canPlace(l, x, y)) l.setObj(x, y, O_MINECART);
  }
  l.special.mine = { x: hx, y: hy };
  l.markers.push({ x: mx + 2, y: my + 13, label: '矿场入口', kind: 'poi' });

  // 办公楼（地下通往 J-Lab）
  const ox = Math.round(W * 0.5) + 4, oy = Math.round(H * 0.3);
  const off = putBuilding(l, ox, oy, 16, 13, { wall: W_CONCRETE, floor: F_TILE, kinds: ['office', 'med', 'storage'], rooms: 3, windows: 0.4, doors: 2, name: '办公楼', lockChance: 0.4 }, rng);
  const r0 = l.rooms[off.rooms[0]];
  const stx = r0.x + 1, sty = r0.y + 1;
  l.floor[l.i(stx, sty)] = F_METAL;
  l.special.labEntry = { x: stx, y: sty };
  l.markers.push({ x: stx, y: sty, label: 'J-Lab 入口', kind: 'poi' });

  // 神秘商人小屋
  const hx2 = 6, hy2 = Math.round(H * 0.42);
  putBuilding(l, hx2, hy2, 8, 7, { wall: W_WOOD, floor: F_WOOD, kinds: ['shop'], rooms: 1, minRoom: 4, windows: 0.5, doors: 1, name: '商人小屋', lockChance: 0 }, rng);
  l.special.merchant = { x: hx2 + 4, y: hy2 + 3 };

  scatterOutdoor(l, rng, { trees: 0.035, bushes: 0.03, cars: 10, trash: 12, corpses: 18, crates: 12, barrels: 10 });

  const sp = l.findOpen(4, Math.round(H * 0.55), 14, rng);
  l.spawn = { x: sp.x + 0.5, y: sp.y + 0.5 };
}
