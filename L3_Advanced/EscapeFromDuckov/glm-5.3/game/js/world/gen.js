// ============================================================
// world/gen.js — 程序化地图生成（微缩模型风：无屋顶剖面建筑）
// ============================================================
'use strict';
const T = { GRASS: 0, ROAD: 1, SIDE: 2, WOOD: 3, TILEF: 4, DIRT: 5, FOREST: 6, WALL: 7, DOOR: 8, WINDOW: 9, RUBBLE: 10, CONC: 11, LAB: 12, PARK: 13 };
const Gen = {
  TL: 32,

  generate(mapId, seed) {
    const cfg = DB.maps[mapId];
    const R = U.Rng(seed);
    const w = cfg.w, h = cfg.h;
    const W = {
      mapId, cfg, w, h, TL: 32, R,
      tiles: new Uint8Array(w * h), solid: new Uint8Array(w * h), opaque: new Uint8Array(w * h), indoor: new Uint8Array(w * h),
      doors: new Map(), furn: [], rooms: [], buildings: [], extracts: [], lights: [], spawn: { x: 0, y: 0 },
      bossSpots: [], generator: null, power: false, destroyed: []
    };
    const idx = (x, y) => y * w + x;
    W.idx = idx;
    const setT = (x, y, t) => { if (x >= 0 && y >= 0 && x < w && y < h) W.tiles[idx(x, y)] = t; };
    const getT = (x, y) => (x >= 0 && y >= 0 && x < w && y < h) ? W.tiles[idx(x, y)] : T.WALL;
    const fill = (t) => { W.tiles.fill(t); };
    const rect = (x, y, rw, rh, t) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) setT(i, j, t); };

    // ---- 通用：建筑 ----
    // 造一栋建筑：外墙 + 内部房间模板 + 外门 + 窗 + 家具
    function building(bx, by, bw, bh, kind, opt = {}) {
      rect(bx, by, bw, bh, opt.floor || T.WOOD);
      for (let i = bx; i < bx + bw; i++) { setT(i, by, T.WALL); setT(i, by + bh - 1, T.WALL); }
      for (let j = by; j < by + bh; j++) { setT(bx, j, T.WALL); setT(bx + bw - 1, j, T.WALL); }
      for (let j = by + 1; j < by + bh - 1; j++) for (let i = bx + 1; i < bx + bw - 1; i++) W.indoor[idx(i, j)] = 1;
      const B = { x: bx, y: by, w: bw, h: bh, kind, nm: opt.nm || '建筑' };
      W.buildings.push(B);
      // 外门：随机一面墙中点（保证连通室外）
      const sides = U.Rng(seed + bx * 7 + by * 13).shuffle(['n', 's', 'e', 'w']);
      let doorCount = 0;
      for (const s of sides) {
        if (doorCount >= (opt.doors || 1)) break;
        let dx, dy;
        if (s === 'n') { dx = bx + 1 + R.ri(0, bw - 3); dy = by; }
        else if (s === 's') { dx = bx + 1 + R.ri(0, bw - 3); dy = by + bh - 1; }
        else if (s === 'w') { dx = bx; dy = by + 1 + R.ri(0, bh - 3); }
        else { dx = bx + bw - 1; dy = by + 1 + R.ri(0, bh - 3); }
        setT(dx, dy, T.DOOR);
        W.doors.set(idx(dx, dy), { type: 'door', open: false, locked: !!opt.locked, hp: 100, barricade: 0, card: opt.card || null });
        doorCount++;
      }
      // 窗：外墙每隔 2-3 格
      for (let i = bx + 2; i < bx + bw - 2; i += R.ri(2, 3)) {
        if (getT(i, by) === T.WALL && R.chance(0.7)) { setT(i, by, T.WINDOW); W.doors.set(idx(i, by), { type: 'window', open: false, locked: false, hp: 60, barricade: 0 }); }
        if (getT(i, by + bh - 1) === T.WALL && R.chance(0.7)) { setT(i, by + bh - 1, T.WINDOW); W.doors.set(idx(i, by + bh - 1), { type: 'window', open: false, locked: false, hp: 60, barricade: 0 }); }
      }
      for (let j = by + 2; j < by + bh - 2; j += R.ri(2, 3)) {
        if (getT(bx, j) === T.WALL && R.chance(0.7)) { setT(bx, j, T.WINDOW); W.doors.set(idx(bx, j), { type: 'window', open: false, locked: false, hp: 60, barricade: 0 }); }
        if (getT(bx + bw - 1, j) === T.WALL && R.chance(0.7)) { setT(bx + bw - 1, j, T.WINDOW); W.doors.set(idx(bx + bw - 1, j), { type: 'window', open: false, locked: false, hp: 60, barricade: 0 }); }
      }
      // 室内分隔（水平一分为二 + 门）
      const rooms = [];
      if (bh >= 7 && R.chance(0.75)) {
        const my = by + Math.floor(bh / 2);
        for (let i = bx + 1; i < bx + bw - 1; i++) setT(i, my, T.WALL);
        const dx = bx + 2 + R.ri(0, bw - 5);
        setT(dx, my, T.DOOR);
        W.doors.set(idx(dx, my), { type: 'door', open: false, locked: false, hp: 80, barricade: 0 });
        rooms.push({ x: bx + 1, y: by + 1, w: bw - 2, h: my - by - 1, kind: kind === 'house' ? R.pick(['kitchen', 'living']) : kind });
        rooms.push({ x: bx + 1, y: my + 1, w: bw - 2, h: by + bh - my - 2, kind: kind === 'house' ? R.pick(['bed', 'bath']) : kind });
        // 垂直再分上排
        if (bw >= 9 && R.chance(0.6)) {
          const mx = bx + Math.floor(bw / 2);
          for (let j = by + 1; j < my; j++) setT(mx, j, T.WALL);
          const dy = by + 1 + R.ri(0, my - by - 3);
          setT(mx, dy, T.DOOR);
          W.doors.set(idx(mx, dy), { type: 'door', open: false, locked: false, hp: 80, barricade: 0 });
          rooms[0] = { x: bx + 1, y: by + 1, w: mx - bx - 1, h: my - by - 1, kind: R.pick(['kitchen', 'bed']) };
          rooms.push({ x: mx + 1, y: by + 1, w: bx + bw - mx - 2, h: my - by - 1, kind: R.pick(['living', 'bath']) });
        }
      } else {
        rooms.push({ x: bx + 1, y: by + 1, w: bw - 2, h: bh - 2, kind });
      }
      // 家具布置
      for (const rm of rooms) {
        W.rooms.push(Object.assign(rm, { building: B }));
        furnish(rm, R);
      }
      return B;
    }

    // 房间家具（沿上/下墙内侧布置）
    function furnish(rm, R) {
      const spots = [];
      for (let i = rm.x; i < rm.x + rm.w; i++) { spots.push([i, rm.y]); spots.push([i, rm.y + rm.h - 1]); }
      R.shuffle(spots);
      let si = 0;
      const take = () => spots[si++];
      const put = (kind, cont, nm) => {
        if (si >= spots.length) return;
        const [fx, fy] = take();
        if (getT(fx, fy) !== T.WOOD && getT(fx, fy) !== T.TILEF && getT(fx, fy) !== T.LAB) return;
        W.furn.push({ tx: fx, ty: fy, kind, cont: cont ? { table: cont, items: [], searched: false, nm } : null, hp: 100 });
      };
      switch (rm.kind) {
        case 'kitchen': put('fridge', 'fridge', '冰箱'); put('counter', 'kitchen', '橱柜'); if (R.chance(0.7)) put('counter', 'kitchen', '橱柜'); put('stove', 'kitchen', '灶台'); break;
        case 'bed': put('wardrobe', 'wardrobe', '衣柜'); put('bed', null); put('bed', null); if (R.chance(0.5)) put('nightstand', 'living', '床头柜'); break;
        case 'living': put('sofa', null); put('tv', 'living', '电视柜'); put('shelf', 'living', '书架'); break;
        case 'bath': put('medcab', 'medcab', '药柜'); put('sink', null); put('toilet', null); break;
        case 'store': put('register', 'register', '收银机'); put('shelf', 'shelf', '货架'); put('shelf', 'shelf', '货架'); put('shelf', 'shelf', '货架'); put('fridge', 'fridge', '冰柜'); break;
        case 'medstore': put('shelf', 'medstore', '药品架'); put('shelf', 'medstore', '药品架'); put('shelf', 'medstore', '药品架'); put('counter', 'medstore', '柜台'); put('register', 'register', '收银机'); break;
        case 'hardware': put('toolbox', 'toolbox', '工具架'); put('toolbox', 'toolbox', '工具架'); put('shelf', 'shelf', '货架'); put('shelf', 'shelf', '货架'); break;
        case 'gunstore': put('shelf', 'gunshelf', '枪械架'); put('shelf', 'gunshelf', '枪械架'); put('counter', 'gunshelf', '柜台'); put('register', 'register', '收银机'); break;
        case 'office': put('desk', 'desk', '办公桌'); put('desk', 'desk', '办公桌'); put('shelf', 'shelf', '文件架'); put('medcab', 'medcab', '药柜'); break;
        case 'warehouseH': for (let k = 0; k < 6; k++) put('shelf', 'shelf', '重型货架'); for (let k = 0; k < 4; k++) put('crate', 'crate', '板条箱'); put('toolbox', 'toolbox', '工具角'); break;
        case 'checkpoint': put('milcrate', 'milcrate', '军需箱'); put('milcrate', 'milcrate', '军需箱'); put('desk', 'desk', '值班桌'); put('medcab', 'medstore', '急救柜'); break;
        case 'labroom': put('labbox', 'labbox', '实验柜'); put('labbox', 'labbox', '实验柜'); put('desk', 'desk', '实验台'); if (R.chance(0.6)) put('medcab', 'medcab', '洗消柜'); break;
        case 'cardroom': put('labbox', 'labbox', '保密实验柜'); put('labbox', 'labbox', '保密实验柜'); put('labbox', 'labbox', '保密实验柜'); put('shelf', 'labbox', '样品架'); break;
        case 'basement': put('crate', 'crate', '木箱'); put('crate', 'crate', '木箱'); put('shelf', 'shelf', '积灰货架'); put('toolbox', 'toolbox', '工具架'); break;
        default: put('sofa', null); if (R.chance(0.5)) put('shelf', 'living', '柜子');
      }
    }

    // ---- 森林 ----
    function forest(cx, cy, r, n) {
      for (let k = 0; k < n; k++) {
        const a = R.f(0, U.TAU), d = R.f(0, r);
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.8);
        if (getT(x, y) === T.GRASS || getT(x, y) === T.PARK) setT(x, y, T.FOREST);
      }
    }

    // ---- 撤离点 ----
    function extract(tx, ty, nm) { W.extracts.push({ x: tx * 32 + 16, y: ty * 32 + 16, tx, ty, nm }); }

    // ---- 路灯 ----
    function lamp(tx, ty) { W.lights.push({ x: tx * 32 + 16, y: ty * 32 + 16, r: 5.2 * 32, color: 'rgba(255,214,140,0.20)' }); }

    // ================================================================
    // 各地图
    // ================================================================
    if (mapId === 'suburb') {
      fill(T.GRASS);
      // 道路网
      const roadsH = [16, 36, 56], roadsV = [22, 48, 74];
      for (const ry of roadsH) { rect(2, ry, w - 4, 3, T.ROAD); rect(2, ry - 1, w - 4, 1, T.SIDE); rect(2, ry + 3, w - 4, 1, T.SIDE); }
      for (const rx of roadsV) { rect(rx, 2, 3, h - 4, T.ROAD); rect(rx - 1, 2, 1, h - 4, T.SIDE); rect(rx + 3, 2, 1, h - 4, T.SIDE); }
      for (const ry of roadsH) for (const rx of roadsV) lamp(rx + 1, ry - 1);
      // 公园与森林
      rect(8, 60, 14, 8, T.PARK); forest(15, 64, 6, 40);
      forest(6, 6, 7, 34); forest(88, 8, 8, 40); forest(88, 62, 6, 30);
      // 街区住宅
      const plots = [[4, 4, 15, 10], [27, 4, 18, 10], [53, 4, 17, 10], [79, 4, 13, 10], [4, 21, 15, 12], [27, 21, 18, 12], [53, 21, 17, 12], [79, 21, 13, 12], [4, 41, 15, 12], [53, 41, 17, 12], [79, 41, 13, 12], [27, 41, 18, 10]];
      for (const [px, py, pw, ph] of plots) {
        const bw = Math.min(pw - 2, R.ri(7, 10)), bh = Math.min(ph - 2, R.ri(6, 8));
        const bx = px + R.ri(0, Math.max(0, pw - bw - 1)), by = py + R.ri(0, Math.max(0, ph - bh - 1));
        if (R.chance(0.88)) building(bx, by, bw, bh, 'house', { doors: R.chance(0.3) ? 2 : 1 });
      }
      // 商业街（中部下侧街区改为店铺）
      building(28, 42, 9, 8, 'store', { nm: '便利店', floor: T.TILEF });
      building(38, 42, 8, 8, 'medstore', { nm: '药妆店', floor: T.TILEF });
      building(28, 52, 8, 7, 'hardware', { nm: '五金店', floor: T.CONC });
      building(38, 52, 8, 7, 'gunstore', { nm: '枪店', floor: T.WOOD, locked: true });
      // 加油站
      building(66, 42, 8, 6, 'store', { nm: '加油站便利店', floor: T.TILEF });
      W.furn.push({ tx: 63, ty: 44, kind: 'pump', cont: null, hp: 200 }); W.furn.push({ tx: 63, ty: 46, kind: 'pump', cont: null, hp: 200 });
      // 撤离点 × 4
      extract(49, 2, '北·大桥'); extract(49, h - 3, '南·码头'); extract(w - 3, 37, '东·隧道'); extract(2, 37, '西·公路');
      W.spawn = { x: 49 * 32 + 16, y: 37 * 32 + 16 };
    }

    if (mapId === 'warehouse') {
      fill(T.CONC);
      // 土地区
      rect(2, 2, 30, 20, T.DIRT); rect(60, 40, 32, 30, T.DIRT);
      // 主干道
      rect(2, 33, w - 4, 3, T.ROAD); rect(46, 2, 3, h - 4, T.ROAD);
      // 三座仓库大厅
      building(8, 6, 20, 12, 'warehouseH', { nm: 'A 仓库', floor: T.CONC, doors: 2 });
      building(12, 40, 20, 12, 'warehouseH', { nm: 'B 仓库', floor: T.CONC, doors: 2 });
      building(56, 6, 18, 12, 'office', { nm: '办公楼', floor: T.TILEF, doors: 2 });
      building(66, 46, 16, 10, 'office', { nm: '调度室', floor: T.TILEF });
      building(56, 24, 12, 6, 'hardware', { nm: '维修间', floor: T.CONC });
      // 集装箱堆场
      for (let cy = 44; cy < 70; cy += 5) for (let cx = 50; cx < 66; cx += 4) {
        if (R.chance(0.75)) W.furn.push({ tx: cx, ty: cy, kind: 'container', cont: { table: R.chance(0.4) ? 'shelf' : 'crate', items: [], searched: false, nm: '集装箱' }, hp: 400 });
      }
      // 军用检查站（东南）
      building(76, 10, 12, 8, 'checkpoint', { nm: '国民警卫哨站', floor: T.CONC });
      // 地库（典狱长）——西北角加固地堡
      const B = building(4, 58, 12, 11, 'basement', { nm: '地库', floor: T.CONC, doors: 1, locked: true });
      W.bossSpots.push({ type: 'boss_jailer', x: 10 * 32, y: 64 * 32 });
      W.furn.push({ tx: 6, ty: 60, kind: 'crate', cont: { table: 'milcrate', items: [], searched: false, nm: '封存箱' }, hp: 200 });
      // 破车
      for (let k = 0; k < 8; k++) { const cx = R.ri(6, w - 8), cy = R.ri(6, h - 8); if (getT(cx, cy) === T.CONC || getT(cx, cy) === T.DIRT) W.furn.push({ tx: cx, ty: cy, kind: 'car', cont: null, hp: 300 }); }
      extract(48, 2, '北·铁路专线'); extract(2, 34, '西门·卡车通道'); extract(48, h - 3, '南·排水渠');
      W.spawn = { x: 48 * 32 + 16, y: 34 * 32 + 16 };
      lamp(47, 31); lamp(51, 31); lamp(47, 37); lamp(51, 37);
    }

    if (mapId === 'lab') {
      fill(T.LAB);
      // 外墙封闭
      for (let i = 0; i < w; i++) { setT(i, 0, T.WALL); setT(i, h - 1, T.WALL); }
      for (let j = 0; j < h; j++) { setT(0, j, T.WALL); setT(w - 1, j, T.WALL); }
      for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) W.indoor[idx(i, j)] = 1;
      // B1 区（上 55%）房间矩阵
      const b1Rooms = [[6, 5, 12, 9, 'labroom'], [24, 5, 12, 9, 'labroom'], [42, 5, 12, 9, 'labroom'], [60, 5, 16, 9, 'office'],
        [6, 18, 12, 8, 'labroom'], [24, 18, 12, 8, 'medstore'], [42, 18, 12, 8, 'labroom'], [60, 18, 10, 8, 'power'],
        [6, 30, 14, 8, 'hardware'], [26, 30, 16, 8, 'labroom'], [48, 30, 12, 8, 'office']];
      for (const [x, y, rw, rh, k] of b1Rooms) {
        building(x, y, rw, rh, k, { nm: 'B1 实验区', floor: T.LAB, doors: 2 });
      }
      // 主走廊
      rect(2, 28, w - 4, 2, T.LAB);
      // 发电机房特殊家具
      W.furn.push({ tx: 64, ty: 21, kind: 'generator', cont: null, hp: 999 });
      W.generator = { tx: 64, ty: 21, x: 64 * 32 + 16, y: 21 * 32 + 16, on: false };
      // B2 隔断墙 + 电磁门（需通电）
      rect(2, 40, w - 4, 1, T.WALL);
      const gateX = Math.floor(w / 2);
      setT(gateX, 40, T.DOOR);
      W.doors.set(idx(gateX, 40), { type: 'door', open: false, locked: true, hp: 999, barricade: 0, powered: true, nm: 'B2 电磁闸门' });
      // B2：彩卡房 + Boss 区
      const b2Rooms = [[8, 44, 14, 10, 'cardroom', 'k_blue'], [28, 44, 14, 10, 'cardroom', 'k_purple'], [48, 44, 14, 10, 'cardroom', 'k_red'], [68, 44, 12, 16, 'labroom']];
      for (const [x, y, rw, rh, k, card] of b2Rooms) {
        const B = building(x, y, rw, rh, k, { nm: 'B2 保密区', floor: T.TILEF, doors: 1, locked: true, card });
        const bd = [...W.doors.entries()].filter(([i, d]) => d.card === card);
        for (const [i, d] of bd) d.cardKey = card;
      }
      W.bossSpots.push({ type: 'boss_roadblock', x: 74 * 32, y: 55 * 32 });
      extract(3, 28, '升降梯·回到地面');
      W.spawn = { x: 4 * 32 + 16, y: 28 * 32 + 16 };
    }

    if (mapId === 'storm') {
      fill(T.DIRT);
      rect(2, 2, 40, 30, T.RUBBLE); rect(50, 38, 44, 32, T.RUBBLE); rect(50, 2, 44, 30, T.DIRT);
      // 断壁残垣建筑（缺墙）
      const ruins = [[10, 8, 10, 8], [30, 12, 12, 9], [58, 8, 12, 10], [78, 14, 12, 8], [12, 44, 12, 9], [34, 50, 12, 8], [60, 46, 12, 9], [80, 56, 11, 8]];
      for (const [x, y, rw, rh] of ruins) {
        const k = R.pick(['warehouseH', 'office', 'store', 'checkpoint']);
        const B = building(x, y, rw, rh, k, { nm: '废墟', floor: R.chance(0.5) ? T.CONC : T.WOOD, doors: 2 });
        // 打掉几段墙制造残垣
        for (let n = 0; n < 3; n++) {
          const wx = x + R.ri(1, rw - 2), wy = y + (R.chance(0.5) ? 0 : rh - 1);
          if (getT(wx, wy) === T.WALL) { setT(wx, wy, T.RUBBLE); W.doors.delete(idx(wx, wy)); }
        }
      }
      // 中央决战广场
      rect(42, 30, 12, 10, T.CONC);
      W.bossSpots.push({ type: 'boss_storm', x: 48 * 32, y: 35 * 32 });
      W.furn.push({ tx: 44, ty: 32, kind: 'milcrate', cont: { table: 'milcrate', items: [], searched: false, nm: '军用箱' }, hp: 200 });
      W.furn.push({ tx: 52, ty: 38, kind: 'milcrate', cont: { table: 'milcrate', items: [], searched: false, nm: '军用箱' }, hp: 200 });
      // 沼洼地
      for (let k = 0; k < 14; k++) { const px = R.ri(6, w - 8), py = R.ri(6, h - 8); if (getT(px, py) === T.DIRT) rect(px, py, R.ri(1, 2), R.ri(1, 2), T.PARK); }
      extract(w - 4, 36, '东·避难所闸门'); extract(2, 36, '西·断裂高架');
      W.spawn = { x: 20 * 32, y: 36 * 32 + 16 };
    }

    // ================================================================
    // 通用收尾：战利品填充 / 碰撞 / 连通性
    // ================================================================
    this._fillContainers(W, cfg, R);
    this._rebuildSolid(W);
    this._ensureReach(W);
    return W;
  },

  // 容器战利品：表条目 [id, 权重, 数量min, 数量max, 稀有标记]
  _fillContainers(W, cfg, R) {
    const lucky = (window.G && G.save && G.save.mods) ? (G.save.mods.lootMul || 1) : 1;
    for (const f of W.furn) {
      if (!f.cont) continue;
      const table = DB.loot[f.cont.table];
      if (!table) continue;
      const rolls = (f.kind === 'milcrate' || f.kind === 'labbox') ? R.ri(2, 3) : R.ri(1, 2);
      for (let i = 0; i < rolls; i++) {
        const pairs = table.map(e => [e, e[1] * (e[4] ? cfg.rareLoot * lucky : 1)]);
        const entry = R.wpick(pairs); // entry = [id, 权重, 数量min, 数量max, 稀有?]
        if (!entry || !entry[0]) continue;
        const it = DB.mk(entry[0], R.ri(entry[2], entry[3]));
        if (it) f.cont.items.push(it);
      }
    }
  },

  // 碰撞/遮蔽重建
  _rebuildSolid(W) {
    const { w, h } = W;
    W.solid.fill(0); W.opaque.fill(0);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const t = W.tiles[j * w + i];
      if (t === T.WALL || t === T.WINDOW) W.solid[j * w + i] = 1;
      if (t === T.WALL) W.opaque[j * w + i] = 1;
      if (t === T.DOOR) { const d = W.doors.get(j * w + i); if (d && !d.open) { W.solid[j * w + i] = 1; W.opaque[j * w + i] = 1; } }
    }
    for (const f of W.furn) { if (f.hp > 0 && f.kind !== 'pump') W.solid[f.ty * w + f.tx] = 1; }
  },

  setDoorOpen(W, i, open) {
    const d = W.doors.get(i); if (!d) return;
    d.open = open;
    W.solid[i] = open ? 0 : 1;
    W.opaque[i] = (open || d.type === 'window') ? 0 : 1;
  },

  // 连通性：从出生点洪泛，打不通的容器房就拆墙（保证可达）
  _ensureReach(W) {
    const { w, h } = W;
    const seen = new Uint8Array(w * h);
    const q = [Math.floor(W.spawn.y / 32) * w + Math.floor(W.spawn.x / 32)];
    // 门视作可通行（可打开/ banging）
    const pass = i => {
      const t = W.tiles[i];
      if (t === T.WALL) return false;
      if (t === T.DOOR || t === T.WINDOW) return true;
      return !W.solid[i];
    };
    seen[q[0]] = 1;
    while (q.length) {
      const c = q.pop();
      const x = c % w, y = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!seen[ni] && pass(ni)) { seen[ni] = 1; q.push(ni); }
      }
    }
    let fixes = 0;
    for (const f of W.furn) {
      if (!f.cont || f.hp <= 0) continue;
      if (!seen[f.ty * w + f.tx]) {
        // 在旁边开个洞
        let fixed = false;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2], [-2, 0], [2, 0]]) {
          const nx = f.tx + dx, ny = f.ty + dy;
          if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
          const ni = ny * w + nx;
          if (seen[ni]) { fixed = true; break; }
        }
        if (!fixed && fixes < 40) {
          // 拆通往房间外的一面墙
          for (let r = 2; r < 6 && !fixed; r++) {
            for (const [dx, dy] of [[0, -r], [0, r], [-r, 0], [r, 0]]) {
              const nx = f.tx + dx, ny = f.ty + dy;
              if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
              if (seen[ny * w + nx]) {
                const stepX = Math.sign(dx), stepY = Math.sign(dy);
                for (let s = 1; s < r; s++) {
                  const wi = (f.ty + stepY * s) * w + (f.tx + stepX * s);
                  W.tiles[wi] = T.DOOR; W.doors.set(wi, { type: 'door', open: true, locked: false, hp: 80, barricade: 0 });
                }
                fixed = true; fixes++;
              }
            }
          }
          this._rebuildSolid(W);
        }
      }
    }
  },

  // 生成鸭尸群
  populate(W, cfg, seed) {
    const R = U.Rng(seed + 777);
    const total = Math.floor(W.w * W.h / 100 * cfg.density);
    const list = [];
    const spawnPairs = Object.entries(cfg.spawns).filter(([k, v]) => v > 0).map(([k, v]) => [k, v]);
    let guard = 0;
    while (list.length < total && guard++ < total * 30) {
      const type = R.wpick(spawnPairs);
      const tx = R.ri(2, W.w - 3), ty = R.ri(2, W.h - 3);
      const i = ty * W.w + tx;
      if (W.solid[i] || W.tiles[i] === T.FOREST && R.chance(0.5)) continue;
      const d = U.dist(tx * 32, ty * 32, W.spawn.x, W.spawn.y);
      if (d < 15 * 32) continue;
      if (type.startsWith('boss')) continue;
      list.push({ type, x: tx * 32 + 16, y: ty * 32 + 16 });
    }
    for (const b of W.bossSpots) list.push({ type: b.type, x: b.x, y: b.y, boss: true });
    return list;
  }
};
window.Gen = Gen; window.T = T;
