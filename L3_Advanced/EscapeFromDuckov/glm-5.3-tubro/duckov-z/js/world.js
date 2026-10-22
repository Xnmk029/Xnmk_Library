/* DUCKOV Z - 世界生成：鸭鸣镇 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U;
  const T = { GRASS: 0, ROAD: 1, SIDE: 2, LOT: 3, FWOOD: 4, FTILE: 5, TURF: 6, DIRT: 7, HELI: 8,
    WEXT: 9, WINT: 10, DOOR: 11, WIN: 12, FENCE: 13, COUNTER: 14, TREE: 15, BUSH: 16, CAR: 17,
    LAMP: 18, CRATE: 19, FRIDGE: 20, SHELF: 21, BED: 22, STOVE: 23, SINK: 24, TOILET: 25,
    TABLE: 26, CHAIR: 27, PUMP: 28, DUMPSTER: 29, LOCKER: 30, BSHELF: 31, MEDCAB: 32, WARDROBE: 33,
    RUBBLE: 34, SANDBAG: 35, BARREL: 36, WBENCH: 37, RUG: 38, LINEH: 39, LINEV: 40, CROSS: 41 };
  const SOLID = new Set([T.WEXT, T.WINT, T.FENCE, T.COUNTER, T.TREE, T.CAR, T.LAMP, T.CRATE, T.FRIDGE,
    T.SHELF, T.STOVE, T.SINK, T.TOILET, T.TABLE, T.PUMP, T.DUMPSTER, T.LOCKER, T.BSHELF, T.MEDCAB,
    T.WARDROBE, T.SANDBAG, T.BARREL, T.WBENCH]);
  const LOSEV = new Set([T.WEXT, T.WINT]); // 静态视线阻挡
  const CONT_NAMES = { 19: '木箱', 20: '冰箱', 21: '货架', 29: '垃圾桶', 30: '储物柜', 31: '书架', 32: '医药柜', 33: '衣柜' };
  const W = {};

  const idx = (x, y) => y * C.MW + x;
  function tget(S, x, y) { return (x < 0 || y < 0 || x >= C.MW || y >= C.MH) ? T.WEXT : S.tiles[idx(x, y)]; }
  function tset(S, x, y, v) { if (x >= 0 && y >= 0 && x < C.MW && y < C.MH) S.tiles[idx(x, y)] = v; }
  W.tget = tget;

  // ---------- 地形 ----------
  function terrain(S, rng) {
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      S.tiles[idx(x, y)] = rng() < 0.5 ? T.GRASS : T.GRASS;
      if (rng() < 0.06) tset(S, x, y, T.DIRT);
    }
    // 边界密林
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      if (x < 2 || y < 2 || x >= C.MW - 2 || y >= C.MH - 2) tset(S, x, y, T.TREE);
      else if ((x < 4 || y < 4 || x >= C.MW - 4 || y >= C.MH - 4) && rng() < 0.5) tset(S, x, y, T.TREE);
    }
    const road = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) tset(S, x, y, T.ROAD); };
    const side = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (tget(S, x, y) === T.GRASS || tget(S, x, y) === T.DIRT) tset(S, x, y, T.SIDE); };
    // 主干道
    road(0, 46, C.MW, 4); road(62, 0, 4, C.MH); road(0, 78, 62, 3); road(100, 0, 3, 46);
    side(0, 45, C.MW, 1); side(0, 50, C.MW, 1); side(61, 0, 1, C.MH); side(66, 0, 1, C.MH);
    side(0, 77, 62, 1); side(0, 82, 62, 1); side(99, 0, 1, 46); side(103, 0, 1, 46);
    // 车道线
    for (let x = 2; x < C.MW - 2; x += 4) { tset(S, x, 47, T.LINEH); tset(S, x, 48, T.LINEH); }
    for (let y = 2; y < C.MH - 2; y += 4) { tset(S, 63, y, T.LINEV); tset(S, 64, y, T.LINEV); }
    // 十字路口斑马线
    for (let i = 0; i < 4; i++) { tset(S, 57 + i, 45, T.CROSS); tset(S, 67 + i, 50 - 1, T.CROSS); }
    // 停车场
    const lot = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (!SOLID.has(tget(S, i, j))) tset(S, i, j, T.LOT); };
    lot(6, 42, 22, 3); lot(30, 42, 16, 3); lot(52, 74, 18, 3); lot(70, 42, 24, 3); lot(106, 30, 26, 3); lot(8, 74, 18, 2);
    S.lots = [[6, 42, 22, 3], [30, 42, 16, 3], [52, 74, 18, 3], [70, 42, 24, 3]];
  }

  // ---------- 建筑 ----------
  let _bid = 0;
  function bld(S, x, y, w, h, opt) {
    opt = opt || {};
    const B = { id: ++_bid, name: opt.name || '建筑', x, y, w, h, color: opt.color || U.pick(['#6d5147', '#5d6470', '#706252', '#68707a'], S.rng), lit: true, kind: opt.kind || 'house', fade: 1 };
    S.buildings.push(B);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const edge = i === x || i === x + w - 1 || j === y || j === y + h - 1;
      if (edge) tset(S, i, j, T.WEXT);
      else { tset(S, i, j, opt.floor || T.FWOOD); S.room[idx(i, j)] = B.id; }
    }
    // 外墙窗户
    for (let i = x + 2; i < x + w - 2; i += 3) {
      if (i !== x && i !== x + w - 1) { mkWin(S, i, y); mkWin(S, i, y + h - 1); }
    }
    for (let j = y + 2; j < y + h - 2; j += 3) { mkWin(S, x, j); mkWin(S, x + w - 1, j); }
    return B;
  }
  function mkWin(S, x, y) {
    if (tget(S, x, y) !== T.WEXT) return;
    tset(S, x, y, T.WIN);
    S.meta.set(x + ',' + y, { t: 'win', curtain: false, broken: false, boards: 0, hp: 90 });
  }
  function doorAt(S, x, y, locked) {
    tset(S, x, y, T.DOOR);
    S.meta.set(x + ',' + y, { t: 'door', open: false, locked: !!locked, hp: 140, anim: 0 });
  }
  // 内墙段（留门口）
  function innerWallH(S, B, x0, x1, yy, gaps) {
    for (let x = x0; x <= x1; x++) {
      if (gaps && gaps.some(g => x >= g[0] && x <= g[0] + g[1])) continue;
      tset(S, x, yy, T.WINT);
    }
  }
  function innerWallV(S, B, yy0, yy1, xx, gaps) {
    for (let y = yy0; y <= yy1; y++) {
      if (gaps && gaps.some(g => y >= g[0] && y <= g[0] + g[1])) continue;
      tset(S, xx, y, T.WINT);
    }
  }
  // 家具放置器
  const F = {
    cont(S, x, y, tid, lootKey) {
      tset(S, x, y, tid);
      S.containers.set(x + ',' + y, { tx: x, ty: y, tid, items: DZ.IT.rollTable(lootKey || contLoot(tid), S.rng) });
    },
    bed(S, x, y) { tset(S, x, y, T.BED); S.beds.push({ tx: x, ty: y }); },
    table(S, x, y) { tset(S, x, y, T.TABLE); },
    chair(S, x, y) { tset(S, x, y, T.CHAIR); },
    counter(S, x, y) { tset(S, x, y, T.COUNTER); },
    stove(S, x, y) { tset(S, x, y, T.STOVE); S.stoves.push({ tx: x, ty: y }); },
    sink(S, x, y) { tset(S, x, y, T.SINK); S.sinks.push({ tx: x, ty: y }); },
    wbench(S, x, y) { tset(S, x, y, T.WBENCH); },
    rug(S, B, x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (S.room[idx(i, j)] === B.id && !SOLID.has(tget(S, i, j))) tset(S, i, j, T.RUG); },
    toilet(S, x, y) { tset(S, x, y, T.TOILET); S.sinks.push({ tx: x, ty: y, toilet: 1 }); },
    lampIndoor(S, x, y) { S.indoorLights.push({ x: (x + 0.5) * C.TILE, y: (y + 0.5) * C.TILE }); }
  };
  function contLoot(tid) {
    switch (tid) {
      case T.CRATE: return 'crate'; case T.FRIDGE: return 'fridge'; case T.SHELF: return 'shopshelf';
      case T.DUMPSTER: return 'dumpster'; case T.LOCKER: return 'policeLocker'; case T.BSHELF: return 'bookshelf';
      case T.MEDCAB: return 'medcab'; case T.WARDROBE: return 'wardrobe'; default: return 'kitchcab';
    }
  }
  // 厨房角落
  function kitchen(S, B, rx, ry, rw) {
    F.counter(S, rx, ry); F.sink(S, rx + 1, ry); F.counter(S, rx + 2, ry); F.stove(S, rx + 3, ry);
    tset(S, rx + rw - 1, ry, T.FRIDGE);
    S.containers.set((rx + rw - 1) + ',' + ry, { tx: rx + rw - 1, ty: ry, tid: 20, items: DZ.IT.rollTable('fridge', S.rng) });
    if (rw >= 7) {
      tset(S, rx + rw - 3, ry, T.COUNTER);
      S.containers.set((rx + rw - 3) + ',' + ry, { tx: rx + rw - 3, ty: ry, tid: 19, items: DZ.IT.rollTable('kitchcab', S.rng), lowCont: 1 });
    }
  }
  function wardrobeRow(S, x, y, n) { for (let i = 0; i < n; i++) F.cont(S, x + i * 2, y, T.WARDROBE, 'wardrobe'); }
  function bedroom(S, B, x, y, n) {
    for (let i = 0; i < n; i++) F.bed(S, x + i * 2, y);
    wardrobeRow(S, x, y + 2, Math.min(2, n));
  }
  function office(S, x, y, w) {
    F.table(S, x, y); F.chair(S, x, y + 1);
    if (w > 2) { F.table(S, x + w - 1, y); F.chair(S, x + w - 1, y + 1); }
    F.cont(S, x + 1, y, T.BSHELF, 'desk');
  }

  function buildAll(S, rng) {
    S.buildings = []; S.room = new Int16Array(C.MW * C.MH).fill(-1);
    S.buildings.length = 0; _bid = 0;
    const mk = bld.bind(null, S);
    // 消防局
    let B = mk(6, 8, 20, 12, { name: '鸣鸭消防局', kind: 'firestation', color: '#a03b2e', floor: T.FTILE });
    innerWallV(S, B, 9, 18, 14, []); innerWallH(S, B, 7, 13, 14, [[9, 2]]); doorAt(S, 14, 13);
    doorAt(S, 15, 19, false); // 正门朝南
    F.cont(S, 7, 9, T.LOCKER, 'fireLocker'); F.cont(S, 9, 9, T.LOCKER, 'fireLocker');
    F.bed(S, 17, 9); F.bed(S, 19, 9); F.bed(S, 17, 11); F.bed(S, 19, 11);
    F.table(S, 8, 16); F.chair(S, 8, 17); F.sink(S, 12, 16); F.counter(S, 11, 16);
    F.cont(S, 10, 16, 19, 'kitchcab');
    S.poi.firestation = { x: 15.5, y: 20 };
    // 警察局
    B = mk(30, 8, 16, 12, { name: '鸭鸣警署', kind: 'police', color: '#3d5a80', floor: T.FTILE });
    doorAt(S, 37, 19);
    innerWallV(S, B, 9, 18, 38, [[14, 2]]);
    F.cont(S, 32, 9, T.LOCKER, 'policeLocker'); F.cont(S, 33, 9, T.LOCKER, 'policeLocker');
    F.cont(S, 43, 9, 19, 'gunsafe');
    F.cont(S, 43, 10, 19, 'milcrate');
    office(S, 32, 13, 3); office(S, 40, 13, 3);
    F.bed(S, 41, 17); F.bed(S, 43, 17);
    F.rug(S, B, 33, 12, 5, 4);
    S.poi.police = { x: 38, y: 20 };
    // 诊所
    B = mk(50, 8, 18, 12, { name: '社区诊所', kind: 'clinic', color: '#e8e4d8', floor: T.FTILE });
    doorAt(S, 58, 19);
    innerWallV(S, B, 9, 18, 58, [[13, 2]]);
    for (let i = 0; i < 3; i++) F.cont(S, 52 + i * 2, 9, T.MEDCAB, 'hospshelf');
    F.bed(S, 51, 13); F.bed(S, 53, 13); F.bed(S, 55, 13); F.bed(S, 57, 13);
    F.bed(S, 51, 16); F.bed(S, 53, 16);
    F.cont(S, 65, 9, T.MEDCAB, 'hospshelf');
    office(S, 60, 14, 3);
    S.poi.clinic = { x: 59, y: 20 };
    // 学校 + 操场
    B = mk(108, 6, 20, 26, { name: '鸭鸣中学', kind: 'school', color: '#b08d5f', floor: T.FTILE });
    doorAt(S, 112, 31);
    for (let k = 0; k < 3; k++) { innerWallH(S, B, 109, 126, 12 + k * 7, k === 2 ? [[111, 2], [122, 2]] : [[116, 2]]); }
    innerWallV(S, B, 7, 30, 118, [[15, 2], [24, 3]]);
    for (let cx = 110; cx <= 124; cx += 4) { F.table(S, cx, 9); F.chair(S, cx, 10); F.chair(S, cx + 1, 10); F.table(S, cx, 16); F.chair(S, cx, 17); }
    F.cont(S, 125, 9, T.BSHELF, 'bookshelf'); F.cont(S, 125, 16, T.BSHELF, 'bookshelf');
    for (let cx = 110; cx <= 122; cx += 4) { F.table(S, cx, 23); F.chair(S, cx, 24); }
    F.cont(S, 110, 28, T.LOCKER, 'desk'); F.cont(S, 112, 28, T.LOCKER, 'policeLocker');
    F.bed(S, 124, 28); F.bed(S, 126, 28);
    S.poi.school = { x: 117, y: 31 };
    // 操场与停机坪
    for (let j = 34; j < 44; j++) for (let i = 106; i < 130; i++) tset(S, i, j, T.TURF);
    for (let j = 36; j < 42; j++) for (let i = 114; i < 122; i++) tset(S, i, j, T.HELI);
    S.evac = { tx: 117.5, ty: 38.5, x: 117.5 * C.TILE, y: 38.5 * C.TILE };
    // 东侧民居
    const hE = mk(70, 8, 14, 11, { name: '林荫民居', kind: 'house', color: '#706252' });
    furnishHouse(S, hE); doorAt(S, 76, 18);
    const hF = mk(70, 23, 14, 11, { name: '坡顶民居', kind: 'house', color: '#5d6470' });
    furnishHouse(S, hF); doorAt(S, 76, 33);
    const hG = mk(88, 8, 13, 11, { name: '白栅小屋', kind: 'house', color: '#8a7a63' });
    furnishHouse(S, hG); doorAt(S, 94, 18);
    S.houses.push(hE, hF, hG);
    // 中央公园
    for (let k = 0; k < 26; k++) {
      const px = 88 + U.range(1, 14, rng), py = 24 + U.range(1, 18, rng);
      if (tget(S, px, py) === T.GRASS && S.room[idx(px, py)] < 0) tset(S, px, py, rng() < 0.55 ? T.TREE : T.BUSH);
    }
    // 主路北三栋民居
    [['6,26', '枫叶小屋'], ['22,26', '信箱小屋'], ['38,26', '老杰夫家']].forEach(([pos, nm]) => {
      const [hx, hy] = pos.split(',').map(Number);
      const hb = mk(hx, hy, 12, 10, { name: nm, kind: 'house', color: U.pick(['#706252', '#5d6470', '#8a7a63'], rng) });
      furnishHouse(S, hb); doorAt(S, hx + 5, hy + 9);
      S.houses.push(hb);
    });
    // 超市
    B = mk(6, 54, 22, 13, { name: '鸭鸭超市', kind: 'store', color: '#c9871f', floor: T.FTILE });
    doorAt(S, 16, 66);
    for (let row = 0; row < 3; row++) for (let sx = 10; sx <= 24; sx += 3) {
      if (sx === 16) continue;
      F.cont(S, sx, 56 + row * 3, T.SHELF, row === 0 ? 'grocery' : 'shopshelf');
    }
    F.counter(S, 8, 63); F.counter(S, 9, 63); F.counter(S, 10, 63); F.counter(S, 11, 63);
    S.poi.grocery = { x: 17, y: 67 };
    // 餐馆
    B = mk(32, 54, 15, 11, { name: '嘎嘎餐馆', kind: 'diner', color: '#a03b2e', floor: T.FTILE });
    doorAt(S, 39, 64);
    kitchen(S, B, 33, 55, 6);
    for (let i = 0; i < 3; i++) { F.table(S, 35 + i * 3, 60); F.chair(S, 35 + i * 3, 61); F.chair(S, 35 + i * 3 + 1, 61); }
    S.poi.diner = { x: 39.5, y: 65 };
    // 车库
    B = mk(52, 56, 16, 11, { name: '老雷汽修', kind: 'garage', color: '#68707a', floor: T.LOT });
    doorAt(S, 59, 66);
    F.wbench(S, 53, 57); F.cont(S, 54, 57, 19, 'toolbox'); F.cont(S, 56, 57, 19, 'toolbox');
    F.cont(S, 66, 57, T.LOCKER, 'toolbox');
    tset(S, 65, 57, T.BARREL); S.barrels.push({ tx: 65, ty: 57 });
    tset(S, 65, 59, T.BARREL); S.barrels.push({ tx: 65, ty: 59 });
    S.poi.garage = { x: 60, y: 67 };
    // 加油站
    B = mk(8, 64, 14, 9, { name: '加油鸭油站', kind: 'gas', color: '#c0392b', floor: T.FTILE });
    doorAt(S, 14, 72);
    F.cont(S, 9, 65, T.SHELF, 'shopshelf'); F.counter(S, 12, 65); F.counter(S, 13, 65);
    for (const px of [11, 15]) { tset(S, px, 76, T.PUMP); S.pumps.push({ tx: px, ty: 76 }); }
    tset(S, 20, 75, T.BARREL); S.barrels.push({ tx: 20, ty: 75 });
    S.poi.gas = { x: 15, y: 69 };
    // 仓库
    B = mk(70, 52, 24, 15, { name: '第七仓库', kind: 'warehouse', color: '#68707a', floor: T.LOT });
    doorAt(S, 81, 66);
    for (let i = 0; i < 5; i++) F.cont(S, 73 + i * 3, 55, T.CRATE, 'crate');
    for (let i = 0; i < 4; i++) F.cont(S, 73 + i * 3, 60, T.CRATE, i === 3 ? 'milcrate' : 'crate');
    innerWallV(S, B, 53, 65, 88, []); doorAt(S, 88, 59, true); // 上锁军械角
    F.cont(S, 91, 55, 19, 'milcrate'); F.cont(S, 92, 55, 19, 'gunsafe'); F.cont(S, 91, 58, T.LOCKER, 'milcrate');
    tset(S, 93, 64, T.BARREL); S.barrels.push({ tx: 93, ty: 64 });
    tset(S, 71, 64, T.SANDBAG); tset(S, 72, 64, T.SANDBAG);
    S.poi.warehouse = { x: 82, y: 67 };
    // 南路民居
    [['8,85', '南巷一号'], ['24,85', '南巷三号'], ['40,85', '尽端小屋']].forEach(([pos, nm]) => {
      const [hx, hy] = pos.split(',').map(Number);
      const hb = mk(hx, hy, 11, 9, { name: nm, kind: 'house', color: U.pick(['#706252', '#8a7a63', '#5d6470'], rng) });
      furnishHouse(S, hb); doorAt(S, hx + 5, hy + 8);
      S.houses.push(hb);
    });
  }

  function furnishHouse(S, B) {
    const x = B.x + 1, y = B.y + 1, w = B.w - 2, h = B.h - 2;
    innerWallH(S, B, x, x + w - 1, y + Math.floor(h * 0.55), [[Math.floor(w / 2) - 1, 2]]);
    kitchen(S, B, x, y, Math.min(5, w));
    bedroom(S, B, x + w - 3, y + Math.floor(h * 0.55) + 1, 1);
    F.toilet(S, x + w - 1, y + 1);
    F.sink(S, x + w - 2, y + 1);
    F.table(S, x + 1, y + Math.floor(h * 0.55) - 1); F.chair(S, x + 2, y + Math.floor(h * 0.55) - 1);
    if (B.w >= 12) F.cont(S, x + 1, y + h - 1, T.BSHELF, 'desk');
    F.rug(S, B, x + Math.floor(w / 2) - 1, y + 3, 3, 2);
    F.lampIndoor(S, B.x + B.w / 2, B.y + B.h / 2);
  }

  // ---------- 街道道具 ----------
  function props(S, rng) {
    // 路灯
    for (let x = 8; x < C.MW - 8; x += 9) { if (tget(S, x, 45) === T.SIDE) { tset(S, x, 45, T.LAMP); S.lamps.push({ x: (x + .5) * C.TILE, y: 45.5 * C.TILE }); } }
    for (let y = 8; y < C.MH - 8; y += 9) { if (tget(S, 61, y) === T.SIDE) { tset(S, 61, y, T.LAMP); S.lamps.push({ x: 61.5 * C.TILE, y: (y + .5) * C.TILE }); } }
    // 停车
    const carSpots = [[10, 43.2], [18, 43.2], [34, 50.8], [46, 43.2], [72, 43.2], [84, 50.8], [20, 76.2], [40, 76.2], [107, 31.2], [120, 31.2], [56, 75.2], [88, 43.2]];
    for (const [cx, cy] of carSpots) {
      if (rng() < 0.75) {
        const horiz = cy % 1 !== 0 ? false : true;
        placeCar(S, cx | 0, cy | 0, rng);
      }
    }
    // 垃圾桶散布
    for (let k = 0; k < 8; k++) {
      const bx = 5 + U.range(2, C.MW - 8, rng), by = 5 + U.range(2, C.MH - 8, rng);
      if (tget(S, bx, by) === T.GRASS && S.room[idx(bx, by)] < 0) F.cont(S, bx, by, T.DUMPSTER, 'dumpster');
    }
    // 灌木丛散布
    for (let k = 0; k < 30; k++) {
      const bx = U.range(4, C.MW - 5, rng), by = U.range(4, C.MH - 5, rng);
      const tt = tget(S, bx, by);
      if ((tt === T.GRASS || tt === T.DIRT) && S.room[idx(bx, by)] < 0) { tset(S, bx, by, T.BUSH); S.bushes.push({ tx: bx, ty: by, cd: 0 }); }
    }
  }
  function placeCar(S, x, y, rng) {
    const horiz = rng() < 0.6;
    const w = horiz ? 4 : 2, h = horiz ? 2 : 4;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i, ty = y + j;
      const tt = tget(S, tx, ty);
      if (tt === T.ROAD || tt === T.LOT || tt === T.SIDE) tset(S, tx, ty, T.CAR);
      else return;
    }
    S.cars.push({ tx: x, ty: y, w, h, col: U.pick(C.PAL.carCols, rng), burnt: rng() < 0.18 });
    S.containers.set(x + ',' + y, { tx: x, ty: y, tid: '__trunk', items: DZ.IT.rollTable('trunk', rng) });
  }

  // ---------- 僵尸布点 ----------
  function seedZombies(S) {
    const entries = Object.entries(C.ZOMBIE.types);
    let tries = 0;
    while (S.zombies.length < C.Z_COUNT && tries++ < 4000) {
      const tx = U.range(3, C.MW - 4, S.rng), ty = U.range(3, C.MH - 4, S.rng);
      const tile = tget(S, tx, ty);
      const indoor = S.room[idx(tx, ty)] >= 0;
      if (SOLID.has(tile) || tile === T.DOOR || tile === T.WIN) continue;
      const px = (tx + 0.5) * C.TILE, py = (ty + 0.5) * C.TILE;
      const dHome = U.dist(px, py, S.home.x, S.home.y);
      if (dHome < 260 && !indoor) continue; // 出生点安全圈
      if (!indoor && tile !== T.ROAD && tile !== T.SIDE && tile !== T.LOT && tile !== T.GRASS && tile !== T.DIRT && tile !== T.RUG && tile !== T.HELI && tile !== T.TURF) continue;
      const type = U.wpick(entries.map(e => [e[0], e[1].w]), S.rng);
      DZ.Z.spawn(S, px, py, type, indoor);
    }
  }

  // ---------- LOS 线段 ----------
  function buildSegs(S) {
    S.segs = [];
    S.segGrid = new Map(); // cell -> array
    const CELL = 8;
    const addSeg = (x1, y1, x2, y2) => {
      const seg = [x1 * C.TILE, y1 * C.TILE, x2 * C.TILE, y2 * C.TILE];
      const id = S.segs.length; S.segs.push(seg);
      const x0 = Math.min(x1, x2) / CELL | 0, xM = Math.max(x1, x2) / CELL | 0;
      const y0 = Math.min(y1, y2) / CELL | 0, yM = Math.max(y1, y2) / CELL | 0;
      for (let cy = y0; cy <= yM; cy++) for (let cx = x0; cx <= xM; cx++) {
        const k = cx + ',' + cy;
        if (!S.segGrid.has(k)) S.segGrid.set(k, []);
        S.segGrid.get(k).push(id);
      }
    };
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      if (LOSEV.has(tget(S, x, y))) {
        addSeg(x, y, x + 1, y); addSeg(x + 1, y, x + 1, y + 1);
        addSeg(x + 1, y + 1, x, y + 1); addSeg(x, y + 1, x, y);
      }
    }
    S.segCell = CELL;
  }
  // 动态遮挡(门窗状态)的临时线段收集
  function dynSegsNear(S, tx, ty, r) {
    const out = [];
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      const m = S.meta.get(x + ',' + y);
      if (!m) continue;
      if (m.t === 'door' && !m.open) out.push([x * C.TILE, y * C.TILE, (x + 1) * C.TILE, (y + 1) * C.TILE]);
      else if (m.t === 'win' && m.curtain && !m.broken) out.push([x * C.TILE, y * C.TILE, (x + 1) * C.TILE, (y + 1) * C.TILE]);
    }
    return out;
  }
  W.dynSegsNear = dynSegsNear;

  // ---------- 碰撞 ----------
  W.solidFn = S => (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= C.MW || ty >= C.MH) return true;
    const t = S.tiles[idx(tx, ty)];
    if (SOLID.has(t)) return true;
    if (t === T.DOOR) { const m = S.meta.get(tx + ',' + ty); return m && !m.open; }
    if (t === T.WIN) { const m = S.meta.get(tx + ',' + ty); return !(m && m.broken); }
    return false;
  };

  // ---------- 总装 ----------
  W.gen = function (seed) {
    const S = {
      seed, rng: U.mulberry32(seed),
      tiles: new Uint8Array(C.MW * C.MH), room: null, meta: new Map(), containers: new Map(),
      buildings: [], houses: [], beds: [], sinks: [], stoves: [], lamps: [], pumps: [], barrels: [],
      bushes: [], cars: [], indoorLights: [], corpses: [], fires: [], raincols: [],
      zombies: [], noises: [], poi: {}, explored: new Uint8Array(C.MW * C.MH),
      day: 1, mins: 9 * 60, totalMins: 9 * 60,
      weather: { cur: 'cloudy', timer: 200, wetNow: 0, lightning: 0 },
      powerOn: true, waterOn: true, flags: {}, stats: { kills: 0, headshots: 0, looted: 0, daysSurvived: 1 },
      heat: [], radioQueue: [], hordeActive: 0, evacOpen: false
    };
    terrain(S, S.rng);
    buildAll(S, S.rng);
    props(S, S.rng);
    buildSegs(S);
    return S;
  };
  W.idx = idx; W.T = T; W.SOLID = SOLID; W.CONT_NAMES = CONT_NAMES;
  DZ.W = W;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
