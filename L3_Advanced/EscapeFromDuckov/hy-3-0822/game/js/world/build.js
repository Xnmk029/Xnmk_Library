// ============================================================
//  build.js — 建筑构造工具（房间 BSP / 门窗 / 家具布置 / 连通性保证）
// ============================================================

import {
  F_ASPHALT, F_CONCRETE, F_DIRT, F_GRASS, F_WOOD, F_TILE, F_LAB, F_CARPET, F_GRAVEL, F_METAL,
  W_BRICK, W_CONCRETE, W_WOOD, W_LAB, W_COUNTER,
  O_TABLE, O_CHAIR, O_SHELF, O_LOCKER, O_FRIDGE, O_KITCHEN, O_BED, O_CRATE, O_MEDBOX,
  O_GUNLOCKER, O_DESK, O_WARDROBE, O_TRASH, O_TOOLBOX, O_SAFE, O_AMMOBOX, O_LABCAB,
  O_SOFA, O_PALLET, O_LABDESK, O_BARREL,
} from './tiles.js';

export const ROOM_KINDS = {
  bed: { floor: F_WOOD, furn: [[O_BED, 2, 0.9], [O_WARDROBE, 2, 0.7], [O_LOCKER, 1, 0.4], [O_DESK, 1, 0.35], [O_TRASH, 1, 0.3]] },
  living: { floor: F_CARPET, furn: [[O_SOFA, 2, 0.8], [O_TABLE, 1, 0.7], [O_CHAIR, 3, 0.6], [O_SHELF, 2, 0.5], [O_TRASH, 1, 0.4]] },
  kitchen: { floor: F_TILE, furn: [[O_KITCHEN, 5, 0.95], [O_FRIDGE, 1, 0.85], [O_TABLE, 1, 0.5], [O_TRASH, 1, 0.6], [O_CHAIR, 2, 0.4]] },
  bath: { floor: F_TILE, furn: [[O_MEDBOX, 1, 0.75], [O_TRASH, 1, 0.6], [O_LOCKER, 1, 0.3]] },
  storage: { floor: F_CONCRETE, furn: [[O_CRATE, 4, 0.9], [O_SHELF, 3, 0.7], [O_TOOLBOX, 2, 0.6], [O_BARREL, 2, 0.4]] },
  office: { floor: F_CARPET, furn: [[O_DESK, 3, 0.9], [O_CHAIR, 3, 0.7], [O_LOCKER, 2, 0.5], [O_SHELF, 2, 0.5], [O_SAFE, 1, 0.12]] },
  shop: { floor: F_TILE, furn: [[O_SHELF, 6, 0.9], [O_CRATE, 2, 0.5], [O_TRASH, 1, 0.4], [O_DESK, 1, 0.5]] },
  med: { floor: F_TILE, furn: [[O_MEDBOX, 3, 0.95], [O_LOCKER, 2, 0.6], [O_DESK, 1, 0.6], [O_SHELF, 2, 0.5]] },
  armory: { floor: F_CONCRETE, furn: [[O_GUNLOCKER, 2, 0.9], [O_AMMOBOX, 3, 0.85], [O_LOCKER, 2, 0.6], [O_SAFE, 1, 0.35]] },
  warehouse: { floor: F_CONCRETE, furn: [[O_PALLET, 8, 0.9], [O_SHELF, 6, 0.8], [O_CRATE, 6, 0.8], [O_BARREL, 3, 0.5], [O_TOOLBOX, 2, 0.4]] },
  lab: { floor: F_LAB, furn: [[O_LABCAB, 4, 0.9], [O_LABDESK, 3, 0.8], [O_LOCKER, 2, 0.4], [O_MEDBOX, 1, 0.35]] },
  garage: { floor: F_CONCRETE, furn: [[O_TOOLBOX, 3, 0.8], [O_CRATE, 3, 0.7], [O_BARREL, 2, 0.6], [O_SHELF, 2, 0.5]] },
  hall: { floor: F_WOOD, furn: [[O_CHAIR, 2, 0.3], [O_SHELF, 1, 0.3], [O_TRASH, 1, 0.3]] },
};

export function fillRect(l, x, y, w, h, floor) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (l.inB(i, j)) l.floor[l.i(i, j)] = floor;
}
export function rectOutline(l, x, y, w, h, wall) {
  for (let i = x; i < x + w; i++) { setW(l, i, y, wall); setW(l, i, y + h - 1, wall); }
  for (let j = y; j < y + h; j++) { setW(l, x, j, wall); setW(l, x + w - 1, j, wall); }
}
function setW(l, x, y, t) { if (l.inB(x, y)) l.wall[l.i(x, y)] = t; }
export function clearRect(l, x, y, w, h) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (l.inB(i, j)) { l.wall[l.i(i, j)] = 0; l.obj[l.i(i, j)] = 0; }
}

/** BSP 切分房间 */
function splitRooms(x, y, w, h, depth, rng, out, minS = 5) {
  const canH = h >= minS * 2 + 1, canV = w >= minS * 2 + 1;
  if (depth <= 0 || (!canH && !canV) || (w * h < 60 && rng.chance(0.5))) { out.push({ x, y, w, h }); return; }
  const vert = canV && (!canH || (w > h ? rng.chance(0.75) : rng.chance(0.25)));
  if (vert) {
    const cut = rng.int(minS, w - minS - 1);
    splitRooms(x, y, cut, h, depth - 1, rng, out, minS);
    splitRooms(x + cut, y, w - cut, h, depth - 1, rng, out, minS);
  } else {
    const cut = rng.int(minS, h - minS - 1);
    splitRooms(x, y, w, cut, depth - 1, rng, out, minS);
    splitRooms(x, y + cut, w, h - cut, depth - 1, rng, out, minS);
  }
}

/**
 * 建造一栋建筑
 * opts: { wall, floor, kinds:[], rooms:depth, windows:0..1, doors:n, lit:bool, name }
 */
export function putBuilding(l, bx, by, bw, bh, opts, rng) {
  const wallT = opts.wall !== undefined ? opts.wall : W_BRICK;
  const baseFloor = opts.floor !== undefined ? opts.floor : F_WOOD;
  const bId = l.buildings.length;
  fillRect(l, bx, by, bw, bh, baseFloor);
  clearRect(l, bx, by, bw, bh);
  rectOutline(l, bx, by, bw, bh, wallT);

  // 内部房间
  const raw = [];
  splitRooms(bx + 1, by + 1, bw - 2, bh - 2, opts.rooms !== undefined ? opts.rooms : 2, rng, raw, opts.minRoom || 5);
  const rooms = [];
  for (const r of raw) {
    // 房间内墙（右/下边界）
    for (let i = r.x - 1; i <= r.x + r.w; i++) { setW(l, i, r.y - 1, wallT); setW(l, i, r.y + r.h, wallT); }
    for (let j = r.y - 1; j <= r.y + r.h; j++) { setW(l, r.x - 1, j, wallT); setW(l, r.x + r.w, j, wallT); }
    rooms.push(r);
  }
  // 重新铺地板（内墙覆盖后）
  for (const r of rooms) {
    const kind = opts.kinds && opts.kinds.length ? rng.pick(opts.kinds) : 'living';
    r.kind = kind;
    const kd = ROOM_KINDS[kind] || ROOM_KINDS.living;
    fillRect(l, r.x, r.y, r.w, r.h, opts.forceFloor !== undefined ? opts.forceFloor : kd.floor);
    clearRect(l, r.x, r.y, r.w, r.h);
    r.id = l.rooms.length;
    r.build = bId;
    r.lit = opts.lit !== false;
    l.rooms.push(r);
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
      if (l.inB(i, j)) { l.room[l.i(i, j)] = r.id; l.build[l.i(i, j)] = bId; }
    }
  }
  const building = { id: bId, x: bx, y: by, w: bw, h: bh, rooms: rooms.map((r) => r.id), name: opts.name || '建筑', indoorDark: !!opts.dark };
  l.buildings.push(building);

  // 外门
  const nDoors = opts.doors || 1;
  const sides = rng.shuffle(['n', 's', 'e', 'w']);
  const entrances = [];
  for (let d = 0; d < nDoors; d++) {
    const s = sides[d % 4];
    let dx, dy, vert = false;
    if (s === 'n') { dx = bx + rng.int(2, bw - 3); dy = by; }
    else if (s === 's') { dx = bx + rng.int(2, bw - 3); dy = by + bh - 1; }
    else if (s === 'w') { dx = bx; dy = by + rng.int(2, bh - 3); vert = true; }
    else { dx = bx + bw - 1; dy = by + rng.int(2, bh - 3); vert = true; }
    if (!l.inB(dx, dy)) continue;
    l.wall[l.i(dx, dy)] = 0;
    l.floor[l.i(dx, dy)] = baseFloor;
    const door = l.addDoor(dx, dy, { vert, locked: rng.chance(opts.lockChance !== undefined ? opts.lockChance : 0.25), hp: 170 });
    entrances.push(door);
    // 门外留通路
    const ox = s === 'w' ? dx - 1 : (s === 'e' ? dx + 1 : dx);
    const oy = s === 'n' ? dy - 1 : (s === 's' ? dy + 1 : dy);
    if (l.inB(ox, oy)) { l.wall[l.i(ox, oy)] = 0; l.obj[l.i(ox, oy)] = 0; if (!l.floor[l.i(ox, oy)]) l.floor[l.i(ox, oy)] = F_CONCRETE; }
  }

  // 窗户
  const wc = opts.windows !== undefined ? opts.windows : 0.5;
  if (wc > 0) {
    for (let i = bx + 2; i < bx + bw - 2; i += 2) {
      if (rng.chance(wc)) mkWindow(l, i, by, false, baseFloor, rng);
      if (rng.chance(wc)) mkWindow(l, i, by + bh - 1, false, baseFloor, rng);
    }
    for (let j = by + 2; j < by + bh - 2; j += 2) {
      if (rng.chance(wc)) mkWindow(l, bx, j, true, baseFloor, rng);
      if (rng.chance(wc)) mkWindow(l, bx + bw - 1, j, true, baseFloor, rng);
    }
  }

  // 内门（房间互联）
  connectRooms(l, rooms, wallT, baseFloor, rng);
  ensureConnected(l, rooms, entrances, wallT, rng);

  // 家具
  for (const r of rooms) placeFurniture(l, r, rng);
  return building;
}

function mkWindow(l, x, y, vert, floorT, rng) {
  if (!l.inB(x, y) || l.doorMap.get(l.i(x, y)) || l.winMap.get(l.i(x, y))) return;
  if (!l.wall[l.i(x, y)]) return;
  l.wall[l.i(x, y)] = 0;
  l.floor[l.i(x, y)] = floorT;
  const w = l.addWindow(x, y, { vert, curtain: rng.chance(0.35) });
  if (rng.chance(0.12)) w.broken = true;
  l.refresh(x, y);
}

/** 在相邻房间之间开门 */
function connectRooms(l, rooms, wallT, floorT, rng) {
  for (let a = 0; a < rooms.length; a++) {
    for (let b = a + 1; b < rooms.length; b++) {
      const ra = rooms[a], rb = rooms[b];
      const cands = [];
      // 垂直相邻（共享 x 边界）
      if (ra.x + ra.w + 1 === rb.x || rb.x + rb.w + 1 === ra.x) {
        const wx = ra.x + ra.w + 1 === rb.x ? ra.x + ra.w : rb.x + rb.w;
        const y0 = Math.max(ra.y, rb.y), y1 = Math.min(ra.y + ra.h, rb.y + rb.h);
        for (let y = y0; y < y1; y++) cands.push({ x: wx, y, vert: true });
      }
      if (ra.y + ra.h + 1 === rb.y || rb.y + rb.h + 1 === ra.y) {
        const wy = ra.y + ra.h + 1 === rb.y ? ra.y + ra.h : rb.y + rb.h;
        const x0 = Math.max(ra.x, rb.x), x1 = Math.min(ra.x + ra.w, rb.x + rb.w);
        for (let x = x0; x < x1; x++) cands.push({ x, y: wy, vert: false });
      }
      if (!cands.length) continue;
      const c = rng.pick(cands);
      if (l.doorMap.get(l.i(c.x, c.y))) continue;
      l.wall[l.i(c.x, c.y)] = 0;
      l.floor[l.i(c.x, c.y)] = floorT;
      if (rng.chance(0.55)) {
        l.addDoor(c.x, c.y, { vert: c.vert, open: rng.chance(0.5), locked: false, hp: 120 });
      } else {
        l.refresh(c.x, c.y); // 门洞
      }
      ra._link = true; rb._link = true;
    }
  }
}

/** BFS 确认所有房间可达，否则强行开洞 */
function ensureConnected(l, rooms, entrances, wallT, rng) {
  if (!rooms.length) return;
  const start = entrances.length ? entrances[0] : { x: rooms[0].x, y: rooms[0].y };
  const seen = new Set();
  const q = [[start.x, start.y]];
  const key = (x, y) => y * l.w + x;
  seen.add(key(start.x, start.y));
  const passable = (x, y) => {
    if (!l.inB(x, y)) return false;
    const idx = l.i(x, y);
    if (!l.floor[idx]) return false;
    if (l.wall[idx]) return false;
    return true;
  };
  while (q.length) {
    const [x, y] = q.pop();
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (!passable(nx, ny) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny)); q.push([nx, ny]);
    }
  }
  for (const r of rooms) {
    let ok = false;
    for (let j = r.y; j < r.y + r.h && !ok; j++) for (let i = r.x; i < r.x + r.w && !ok; i++) if (seen.has(key(i, j))) ok = true;
    if (ok) continue;
    // 找一面墙打通到已连通区域
    const cands = [];
    for (let j = r.y - 1; j <= r.y + r.h; j++) {
      for (let i = r.x - 1; i <= r.x + r.w; i++) {
        if (!l.inB(i, j) || !l.wall[l.i(i, j)]) continue;
        const inside = i >= r.x && i < r.x + r.w && j >= r.y && j < r.y + r.h;
        if (inside) continue;
        const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
        for (const [nx, ny] of nb) if (seen.has(key(nx, ny))) { cands.push({ x: i, y: j }); break; }
      }
    }
    if (cands.length) {
      const c = rng.pick(cands);
      l.wall[l.i(c.x, c.y)] = 0;
      if (!l.floor[l.i(c.x, c.y)]) l.floor[l.i(c.x, c.y)] = F_CONCRETE;
      l.refresh(c.x, c.y);
      // 递归再检查一次
      ensureConnected(l, [r], entrances, wallT, rng);
    }
  }
}

export function canPlace(l, x, y) {
  if (!l.inB(x, y)) return false;
  const idx = l.i(x, y);
  if (!l.floor[idx] || l.wall[idx] || l.obj[idx]) return false;
  if (l.doorMap.get(idx) || l.winMap.get(idx)) return false;
  // 不堵门
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const d = l.doorMap.get(l.i(x + dx, y + dy));
    if (d) return false;
  }
  return true;
}

/** 沿墙布置家具 */
export function placeFurniture(l, room, rng) {
  const kd = ROOM_KINDS[room.kind] || ROOM_KINDS.living;
  const spots = [];
  for (let j = room.y; j < room.y + room.h; j++) {
    for (let i = room.x; i < room.x + room.w; i++) {
      const edge = i === room.x || j === room.y || i === room.x + room.w - 1 || j === room.y + room.h - 1;
      if (canPlace(l, i, j)) spots.push({ x: i, y: j, edge });
    }
  }
  rng.shuffle(spots);
  spots.sort((a, b) => (b.edge ? 1 : 0) - (a.edge ? 1 : 0));
  let si = 0;
  for (const [type, maxN, chance] of kd.furn) {
    const n = rng.int(0, maxN);
    for (let k = 0; k < n; k++) {
      if (si >= spots.length) break;
      if (!rng.chance(chance)) { continue; }
      const s = spots[si++];
      if (!canPlace(l, s.x, s.y)) continue;
      l.setObj(s.x, s.y, type);
    }
  }
  // 中央留空：随机再撒 1-2 件
  if (rng.chance(0.4) && si < spots.length) {
    const s = spots[si++];
    if (canPlace(l, s.x, s.y)) l.setObj(s.x, s.y, rng.pick([O_CRATE, O_TRASH, O_CHAIR, O_TABLE]));
  }
}

/** 成排的仓库货架 */
export function placeRacks(l, x, y, w, h, rng) {
  for (let j = y + 1; j < y + h - 1; j += 3) {
    for (let i = x + 1; i < x + w - 1; i++) {
      if (rng.chance(0.82) && canPlace(l, i, j)) l.setObj(i, j, rng.chance(0.5) ? O_SHELF : O_PALLET);
    }
  }
}
