// ============================================================
//  worldgen_special.js — J-Lab 实验室 / 风暴区 / 藏身处
// ============================================================

import { fillRect, rectOutline, canPlace, placeFurniture, ROOM_KINDS } from './build.js';
import {
  F_CONCRETE, F_DIRT, F_GRASS, F_WOOD, F_TILE, F_LAB, F_GRAVEL, F_WATER, F_DRYGRASS, F_METAL, F_ASPHALT, F_CARPET,
  W_CONCRETE, W_LAB, W_ROCK, W_FENCE, W_BRICK, W_GLASS, W_CONTAINER, W_TREE,
  O_LABCAB, O_LABDESK, O_SAFE, O_GUNLOCKER, O_AMMOBOX, O_MEDBOX, O_CRATE, O_BARREL, O_CAR, O_CORPSE,
  O_POWERBOX, O_GEN, O_BENCH, O_STOVE, O_GYM, O_TECH, O_MEDBAY, O_STASH, O_SHIP, O_DEPLOY, O_AA,
  O_BUNK, O_LOCKER, O_TABLE, O_CHAIR, O_TRASH, O_SHELF, O_BUSH, O_PALLET, O_MINECART,
} from './tiles.js';

// ============================================================
//  J-Lab：B1 电力控制区 + B2 彩色门卡房（全程黑暗）
// ============================================================
export function genLab(l, rng, cfg) {
  const W = l.w, H = l.h;
  // 整体实心，挖出走廊与房间
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { l.floor[l.i(x, y)] = 0; l.wall[l.i(x, y)] = W_LAB; }

  const corridor = (x, y, w, h) => {
    fillRect(l, x, y, w, h, F_LAB);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (l.inB(i, j)) l.wall[l.i(i, j)] = 0;
  };

  // 主干走廊（H 形）
  const cy1 = Math.round(H * 0.28), cy2 = Math.round(H * 0.72), cxm = Math.round(W * 0.5);
  corridor(6, cy1 - 1, W - 12, 3);
  corridor(6, cy2 - 1, W - 12, 3);
  corridor(cxm - 1, cy1, 3, cy2 - cy1 + 1);
  corridor(8, cy1, 3, cy2 - cy1);
  corridor(W - 11, cy1, 3, cy2 - cy1);

  // 房间簇
  const roomSpecs = [];
  const addRoom = (x, y, w, h, kind, card, name) => roomSpecs.push({ x, y, w, h, kind, card, name });
  // B1 上部：电力控制、储物、医疗
  addRoom(12, 6, 14, cy1 - 8, 'lab', null, 'B1 观察室');
  addRoom(30, 6, 13, cy1 - 8, 'med', null, 'B1 医疗区');
  addRoom(W - 30, 6, 16, cy1 - 8, 'armory', null, 'B1 安保室');
  // B1 中部两侧
  addRoom(12, cy1 + 4, 12, 10, 'storage', null, 'B1 储藏');
  addRoom(W - 26, cy1 + 4, 14, 11, 'lab', null, 'B1 实验区');
  // B1 电力控制区（关键）
  addRoom(cxm - 7, cy1 + 5, 14, 9, 'lab', null, 'B1 电力控制区');
  // B2 彩色门卡房
  const cards = ['blue', 'red', 'green', 'purple', 'yellow', 'black'];
  const cardNames = { blue: '蓝卡房', red: '红卡房', green: '绿卡房', purple: '紫卡房', yellow: '黄卡房', black: '黑卡房' };
  let cxp = 8;
  for (let i = 0; i < cards.length; i++) {
    const w = 11, h = 9;
    const x = 8 + (i % 3) * (W - 22) / 3 | 0;
    const y = cy2 + 4 + Math.floor(i / 3) * 11;
    if (y + h > H - 4) continue;
    addRoom(x, y, w, h, i % 2 === 0 ? 'armory' : 'lab', cards[i], cardNames[cards[i]]);
  }

  for (const rs of roomSpecs) {
    if (rs.x + rs.w > W - 3 || rs.y + rs.h > H - 3 || rs.x < 3 || rs.y < 3) continue;
    fillRect(l, rs.x, rs.y, rs.w, rs.h, F_LAB);
    for (let j = rs.y; j < rs.y + rs.h; j++) for (let i = rs.x; i < rs.x + rs.w; i++) l.wall[l.i(i, j)] = 0;
    rectOutline(l, rs.x, rs.y, rs.w, rs.h, W_LAB);
    const r = { x: rs.x + 1, y: rs.y + 1, w: rs.w - 2, h: rs.h - 2, kind: rs.kind, id: l.rooms.length, build: 0, lit: false, name: rs.name };
    l.rooms.push(r);
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { l.room[l.i(i, j)] = r.id; l.build[l.i(i, j)] = 0; }
    // 门：朝最近走廊
    const doorSpots = [];
    for (let i = rs.x + 1; i < rs.x + rs.w - 1; i++) {
      if (l.floor[l.i(i, rs.y - 1)] === F_LAB) doorSpots.push({ x: i, y: rs.y, vert: false });
      if (l.floor[l.i(i, rs.y + rs.h)] === F_LAB) doorSpots.push({ x: i, y: rs.y + rs.h - 1, vert: false });
    }
    for (let j = rs.y + 1; j < rs.y + rs.h - 1; j++) {
      if (l.floor[l.i(rs.x - 1, j)] === F_LAB) doorSpots.push({ x: rs.x, y: j, vert: true });
      if (l.floor[l.i(rs.x + rs.w, j)] === F_LAB) doorSpots.push({ x: rs.x + rs.w - 1, y: j, vert: true });
    }
    if (doorSpots.length) {
      const ds = rng.pick(doorSpots);
      l.wall[l.i(ds.x, ds.y)] = 0;
      l.floor[l.i(ds.x, ds.y)] = F_LAB;
      l.addDoor(ds.x, ds.y, { vert: ds.vert, locked: !!rs.card, card: rs.card, hp: 400 });
      if (rs.card) l.markers.push({ x: ds.x, y: ds.y, label: cardNames[rs.card], kind: 'card' });
    } else {
      // 无走廊相邻则强行打通到中央走廊
      const ty = Math.max(rs.y + 1, Math.min(rs.y + rs.h - 2, cy1 + 1));
      for (let i = Math.min(rs.x, cxm); i <= Math.max(rs.x, cxm); i++) { l.wall[l.i(i, ty)] = 0; l.floor[l.i(i, ty)] = F_LAB; }
    }
    placeFurniture(l, r, rng);
    if (rs.card) {
      // 高价值房间保底
      for (let k = 0; k < 2; k++) {
        const x = r.x + rng.int(0, r.w - 1), y = r.y + rng.int(0, r.h - 1);
        if (canPlace(l, x, y)) l.setObj(x, y, rng.pick([O_SAFE, O_LABCAB, O_GUNLOCKER, O_AMMOBOX]));
      }
    }
    if (rs.name === 'B1 电力控制区') {
      const px = r.x + (r.w >> 1), py = r.y + (r.h >> 1);
      if (l.inB(px, py)) l.setObj(px, py, O_POWERBOX);
      l.special.powerbox = { x: px, y: py };
      l.markers.push({ x: px, y: py, label: '配电箱', kind: 'power' });
    }
  }

  l.buildings.push({ id: 0, x: 0, y: 0, w: W, h: H, rooms: l.rooms.map((r) => r.id), name: 'J-Lab', indoorDark: true, noRoof: true });

  // Boss 大厅（B1 中央核心）
  const bx = cxm - 8, by = Math.round((cy1 + cy2) / 2) - 6;
  fillRect(l, bx, by, 17, 13, F_LAB);
  for (let j = by; j < by + 13; j++) for (let i = bx; i < bx + 17; i++) if (l.inB(i, j)) l.wall[l.i(i, j)] = 0;
  rectOutline(l, bx, by, 17, 13, W_LAB);
  for (let i = bx + 6; i < bx + 11; i++) { l.wall[l.i(i, by)] = 0; l.wall[l.i(i, by + 12)] = 0; }
  l.special.b1core = { x: bx + 8, y: by + 6 };
  for (let k = 0; k < 4; k++) {
    const x = bx + rng.int(1, 15), y = by + rng.int(1, 11);
    if (canPlace(l, x, y)) l.setObj(x, y, rng.pick([O_BARREL, O_CRATE, O_LABCAB]));
  }

  // 起始电梯（撤离点）
  const ex = cxm, ey = cy1 - 4;
  fillRect(l, ex - 2, ey - 2, 5, 5, F_METAL);
  for (let j = ey - 2; j <= ey + 2; j++) for (let i = ex - 2; i <= ex + 2; i++) if (l.inB(i, j)) l.wall[l.i(i, j)] = 0;
  rectOutline(l, ex - 2, ey - 2, 5, 5, W_LAB);
  l.wall[l.i(ex, ey + 2)] = 0;
  l.spawn = { x: ex + 0.5, y: ey + 0.5 };
  l.extractions.push({ x: ex, y: ey, r: 2.0, name: '货运升降机', hold: 0 });
  l.markers.push({ x: ex, y: ey, label: '撤离', kind: 'extract' });
  l.powered = false;
}

// ============================================================
//  风暴区：终局战场（废城 + 中央竞技场）
// ============================================================
export function genStorm(l, rng, cfg) {
  const W = l.w, H = l.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = rng.next();
    l.floor[l.i(x, y)] = r < 0.12 ? F_WATER : r < 0.4 ? F_GRAVEL : r < 0.72 ? F_CONCRETE : F_ASPHALT;
  }
  rectOutline(l, 0, 0, W, H, W_CONCRETE);
  rectOutline(l, 1, 1, W - 2, H - 2, W_CONCRETE);

  // 废墟街区
  for (let k = 0; k < 22; k++) {
    const bw = rng.int(7, 14), bh = rng.int(6, 12);
    const bx = rng.int(4, W - bw - 4), by = rng.int(4, H - bh - 4);
    if (Math.abs(bx + bw / 2 - W / 2) < 16 && Math.abs(by + bh / 2 - H / 2) < 16) continue;
    let overlap = false;
    for (const eb of l.buildings) if (bx < eb.x + eb.w + 2 && bx + bw + 2 > eb.x && by < eb.y + eb.h + 2 && by + bh + 2 > eb.y) overlap = true;
    if (overlap) continue;
    fillRect(l, bx, by, bw, bh, F_CONCRETE);
    rectOutline(l, bx, by, bw, bh, rng.chance(0.5) ? W_CONCRETE : W_BRICK);
    // 残破：随机打掉部分墙
    for (let i = bx; i < bx + bw; i++) for (let j = by; j < by + bh; j++) {
      if (l.wall[l.i(i, j)] && rng.chance(0.28)) l.wall[l.i(i, j)] = 0;
    }
    const r = { x: bx + 1, y: by + 1, w: bw - 2, h: bh - 2, kind: rng.pick(['storage', 'office', 'armory', 'living']), id: l.rooms.length, build: l.buildings.length, lit: false };
    l.rooms.push(r);
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { l.room[l.i(i, j)] = r.id; l.build[l.i(i, j)] = r.build; }
    l.buildings.push({ id: r.build, x: bx, y: by, w: bw, h: bh, rooms: [r.id], name: '废墟', ruined: true, noRoof: rng.chance(0.6) });
    placeFurniture(l, r, rng);
  }

  // 中央竞技场
  const cx = (W / 2) | 0, cy = (H / 2) | 0;
  for (let j = -13; j <= 13; j++) for (let i = -13; i <= 13; i++) {
    if (i * i + j * j > 190) continue;
    const x = cx + i, y = cy + j;
    if (!l.inB(x, y)) continue;
    l.wall[l.i(x, y)] = 0; l.obj[l.i(x, y)] = 0;
    l.floor[l.i(x, y)] = (i * i + j * j > 150) ? F_GRAVEL : F_CONCRETE;
  }
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const x = Math.round(cx + Math.cos(a) * 14.2), y = Math.round(cy + Math.sin(a) * 14.2);
    if (l.inB(x, y) && rng.chance(0.8)) l.wall[l.i(x, y)] = W_CONCRETE;
  }
  // 入口
  for (let i = -2; i <= 2; i++) { l.wall[l.i(cx + i, cy - 14)] = 0; l.wall[l.i(cx + i, cy + 14)] = 0; }
  l.special.center = { x: cx, y: cy };
  l.markers.push({ x: cx, y: cy, label: '四骑士竞技场', kind: 'boss' });

  // 防空导弹 + 空间核心
  const ax = cx + 7, ay = cy - 5;
  if (l.inB(ax, ay)) l.setObj(ax, ay, O_AA);
  l.special.aa = { x: ax, y: ay };
  l.markers.push({ x: ax, y: ay, label: '防空导弹', kind: 'poi' });
  const kx = cx - 6, ky = cy + 5;
  if (canPlace(l, kx, ky)) l.setObj(kx, ky, O_LABCAB);
  l.special.coreCache = { x: kx, y: ky };
  for (let k = 0; k < 12; k++) {
    const x = cx + rng.int(-11, 11), y = cy + rng.int(-11, 11);
    if (canPlace(l, x, y)) l.setObj(x, y, rng.pick([O_BARREL, O_CRATE, O_CAR, O_CORPSE]));
  }

  // 散布掩体
  for (let k = 0; k < 60; k++) {
    const x = rng.int(3, W - 4), y = rng.int(3, H - 4);
    if (canPlace(l, x, y) && l.room[l.i(x, y)] < 0) l.setObj(x, y, rng.pick([O_CAR, O_BARREL, O_CRATE, O_CORPSE, O_PALLET]));
  }
  for (let k = 0; k < 40; k++) {
    const x = rng.int(3, W - 4), y = rng.int(3, H - 4);
    if (!l.wall[l.i(x, y)] && !l.obj[l.i(x, y)] && l.room[l.i(x, y)] < 0 && rng.chance(0.5)) l.wall[l.i(x, y)] = W_CONCRETE;
  }

  const sp = l.findOpen(6, H - 6, 16, rng);
  l.spawn = { x: sp.x + 0.5, y: sp.y + 0.5 };
}

// ============================================================
//  藏身处：局外基地（设施升级 / 仓库 / 部署终端 / 飞船）
// ============================================================
export function genHideout(l, rng, cfg) {
  const W = l.w, H = l.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) l.floor[l.i(x, y)] = rng.chance(0.2) ? F_DRYGRASS : F_DIRT;
  rectOutline(l, 0, 0, W, H, W_CONCRETE);
  rectOutline(l, 1, 1, W - 2, H - 2, W_FENCE);

  // 主建筑
  const bx = 4, by = 4, bw = 26, bh = 18;
  fillRect(l, bx, by, bw, bh, F_WOOD);
  rectOutline(l, bx, by, bw, bh, W_BRICK);
  const rooms = [
    { x: bx + 1, y: by + 1, w: 11, h: 8, kind: 'living', name: '起居室' },
    { x: bx + 13, y: by + 1, w: 12, h: 8, kind: 'kitchen', name: '厨房' },
    { x: bx + 1, y: by + 10, w: 11, h: 7, kind: 'storage', name: '工作间' },
    { x: bx + 13, y: by + 10, w: 12, h: 7, kind: 'med', name: '医疗室' },
  ];
  // 内墙
  for (let j = by + 1; j < by + bh - 1; j++) l.wall[l.i(bx + 12, j)] = W_WOOD;
  for (let i = bx + 1; i < bx + bw - 1; i++) l.wall[l.i(i, by + 9)] = W_WOOD;
  // 内门
  l.wall[l.i(bx + 12, by + 4)] = 0; l.addDoor(bx + 12, by + 4, { vert: true, open: true });
  l.wall[l.i(bx + 6, by + 9)] = 0; l.addDoor(bx + 6, by + 9, { vert: false, open: true });
  l.wall[l.i(bx + 18, by + 9)] = 0; l.addDoor(bx + 18, by + 9, { vert: false, open: true });
  // 外门
  l.wall[l.i(bx + 6, by + bh - 1)] = 0;
  l.addDoor(bx + 6, by + bh - 1, { vert: false, open: true });
  // 窗
  for (let i = bx + 2; i < bx + bw - 2; i += 4) { l.wall[l.i(i, by)] = 0; l.addWindow(i, by, { vert: false }); }

  rooms.forEach((rs) => {
    const r = { x: rs.x, y: rs.y, w: rs.w, h: rs.h, kind: rs.kind, id: l.rooms.length, build: 0, lit: true, name: rs.name };
    l.rooms.push(r);
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
      if (l.inB(i, j)) { l.room[l.i(i, j)] = r.id; l.build[l.i(i, j)] = 0; }
    }
    if (rs.kind === 'living') l.floor[l.i(r.x, r.y)] = F_CARPET;
  });
  l.buildings.push({ id: 0, x: bx, y: by, w: bw, h: bh, rooms: l.rooms.map((r) => r.id), name: '藏身处', noRoof: true });

  // 设施摆位
  const put = (x, y, t) => { if (l.inB(x, y)) { l.wall[l.i(x, y)] = 0; l.setObj(x, y, t); } };
  put(bx + 2, by + 2, O_STASH);
  put(bx + 4, by + 2, O_BUNK);
  put(bx + 8, by + 2, O_TABLE);
  put(bx + 9, by + 3, O_CHAIR);
  put(bx + 2, by + 6, O_LOCKER);
  put(bx + 15, by + 2, O_STOVE);
  put(bx + 18, by + 2, O_SHELF);
  put(bx + 21, by + 2, O_TRASH);
  put(bx + 3, by + 12, O_BENCH);
  put(bx + 6, by + 12, O_GEN);
  put(bx + 9, by + 12, O_TECH);
  put(bx + 15, by + 12, O_MEDBAY);
  put(bx + 19, by + 12, O_GYM);

  // 院子：飞船 + 部署终端
  const sx = W - 14, sy = 8;
  fillRect(l, sx - 3, sy - 3, 12, 14, F_CONCRETE);
  put(sx, sy, O_SHIP);
  l.special.ship = { x: sx, y: sy };
  put(W - 8, H - 8, O_DEPLOY);
  l.special.deploy = { x: W - 8, y: H - 8 };
  fillRect(l, W - 11, H - 11, 8, 8, F_CONCRETE);
  // 装饰
  for (let k = 0; k < 12; k++) {
    const x = rng.int(3, W - 4), y = rng.int(3, H - 4);
    if (canPlace(l, x, y) && l.room[l.i(x, y)] < 0) l.setObj(x, y, rng.pick([O_CRATE, O_BARREL, O_BUSH, O_PALLET]));
  }
  for (let k = 0; k < 6; k++) {
    const x = rng.int(3, W - 4), y = rng.int(3, H - 4);
    if (!l.wall[l.i(x, y)] && !l.obj[l.i(x, y)] && l.room[l.i(x, y)] < 0) l.wall[l.i(x, y)] = W_TREE;
  }
  l.lamps.push({ x: bx + 12, y: by + 5, r: 9, needPower: true });
  l.lamps.push({ x: bx + 6, y: by + 13, r: 8, needPower: true });
  l.lamps.push({ x: sx, y: sy + 2, r: 8, needPower: true });
  l.lamps.push({ x: W - 8, y: H - 9, r: 7, needPower: true });
  l.spawn = { x: bx + 6.5, y: by + bh + 1.5 };
  l.powered = true;
  l.safe = true;
}
