// ============================================================
// game.js — 全局状态机 / 主循环 / 战局生命周期 / 存档
// 局内循环：藏身处整备 → 搜打撤 → 撤离/阵亡 → 回藏身处（鸭科夫骨架）
// ============================================================
'use strict';
const G = {
  state: 'boot', cv: null, ctx: null, hudCv: null, hudCtx: null, vw: 0, vh: 0,
  world: null, player: null, zombies: [], projectiles: [], particles: [], ground: [], strikes: [],
  raid: null, ambient: 1, fov: null, explored: null, save: null,
  uiOpen: false, lightning: 0, hitMark: 0, extractT: 0, _uid: 1,
  fovLit(x, y) {
    if (!this.fov || !this.world) return false;
    const f = this.fov;
    return FOV.litPoint(this.world, this.player.x, this.player.y, f.dir, f.coneRad, f.range, x, y);
  }
};
window.G = G;

const Game = {
  last: 0, acc: 0, expT: 0, hordeT: 0, trickleT: 0,

  init() {
    G.cv = document.getElementById('cv');
    G.ctx = G.cv.getContext('2d');
    G.hudCv = document.getElementById('hud');
    G.hudCtx = G.hudCv.getContext('2d');
    Input.init(G.hudCv.ownerDocument.body);
    Render.resize();
    window.addEventListener('resize', () => Render.resize());
    UI.init();
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if (G.state !== 'raid') return;
        if (UI.anyWin()) { UI.closeAllWins(); }
        else UI.openWin('winPause');
      }
      if (G.state !== 'raid' || G.uiOpen || e.repeat) return;
      switch (e.code) {
        case 'Tab': case 'KeyI': e.preventDefault(); UI.toggleWin('winInv'); break;
        case 'KeyK': UI.toggleWin('winCraft'); break;
        case 'KeyH': UI.toggleWin('winHealth'); break;
        case 'KeyM': UI.toggleWin('winMap'); break;
        case 'KeyP': UI.toggleWin('winSkills'); break;
        case 'KeyF': Ent.doInteract(G.player); break;
        case 'KeyB': Ent.barricade(G.player); break;
        case 'KeyG': Sys.Forage.search(G.player); break;
      }
    });
    G.state = 'menu';
    UI.showMenu();
    requestAnimationFrame(t => this.loop(t));
  },

  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
    this.last = t;
    // 单帧异常隔离：保证 flush() 永远执行，避免输入卡死导致假死循环
    try {
      if (G.state === 'raid' && G.player && !G.player.dead && !G.uiOpen) {
        this.update(dt);
      }
      if (G.state === 'raid') {
        // 鼠标世界坐标
        Input.mouse.wx = Render.cam.ox + Input.mouse.x;
        Input.mouse.wy = Render.cam.oy + Input.mouse.y;
        Render.draw(G.uiOpen ? 0 : dt);
        HUD.draw(dt);
      } else {
        G.ctx && G.ctx.clearRect(0, 0, G.vw, G.vh);
        G.hudCtx && G.hudCtx.clearRect(0, 0, G.vw, G.vh);
      }
    } catch (e) {
      if (!this._loopErrs) this._loopErrs = 0;
      if (++this._loopErrs < 4) console.error('loop error:', e);
    }
    Input.flush();
  },

  update(dt) {
    const p = G.player;
    // 时间推进：1 现实秒 = 1 游戏分钟
    G.raid.time += dt;
    Sys.Time.tickWeather(dt);
    G.ambient = Sys.Time.ambient();
    // 视野计算（拟真视锥：昼夜/特质/手电影响）
    const visMul = (p.mods.visMul || 1);
    const nightK = G.ambient < 0.6 ? U.lerp(0.42, 1, G.ambient / 0.6) : 1;
    const owl = p.mods.nightMul != null ? (1 - (1 - nightK) * (1 - p.mods.nightMul)) : nightK;
    let range = 13.5 * 32 * visMul * owl;
    if (p.flashlightOn && p.equip.light && p.equip.light.cond > 0) range = Math.max(range, 11.5 * 32);
    G.fov = FOV.compute(G.world, p.x, p.y, p.dir, 1.9, range);
    // 探索图
    this.expT -= dt;
    if (this.expT <= 0) {
      this.expT = 0.22;
      const W = G.world, R = Math.ceil(range / 32) + 1;
      const px = Math.floor(p.x / 32), py = Math.floor(p.y / 32);
      for (let ty = Math.max(0, py - R); ty <= Math.min(W.h - 1, py + R); ty++)
        for (let tx = Math.max(0, px - R); tx <= Math.min(W.w - 1, px + R); tx++) {
          if (!G.explored[ty * W.w + tx] && G.fovLit(tx * 32 + 16, ty * 32 + 16)) G.explored[ty * W.w + tx] = 1;
        }
    }
    // 模拟
    Sys.Needs.tick(p, dt);
    Ent.updatePlayer(p, dt, G.world);
    Ent.updateZombies(dt);
    Ent.updateProjectiles(dt);
    // 撤离判定
    let inZone = false;
    if (!G.raid.closed) {
      for (const e of G.world.extracts) if (U.dist(p.x, p.y, e.x, e.y) < 40) { inZone = true; break; }
    }
    if (inZone && !p.action) {
      G.extractT += dt;
      if (G.extractT >= 6) { this.endRaid(true); return; }
    } else G.extractT = 0;
    // 时限：撤离关闭 + 尸潮
    if (!G.raid.closed && G.raid.time > G.raid.limit) {
      G.raid.closed = true;
      UI.toast('⚠ 撤离通道已关闭！鸭尸潮正在涌入——无处可逃，除非……', 'bad');
    }
    if (G.raid.closed) {
      this.hordeT -= dt;
      if (this.hordeT <= 0) {
        this.hordeT = 120;
        for (let i = 0; i < 5; i++) {
          const a = U.rf(0, U.TAU);
          const zx = U.clamp(p.x + Math.cos(a) * 480, 64, G.world.w * 32 - 64);
          const zy = U.clamp(p.y + Math.sin(a) * 480, 64, G.world.h * 32 - 64);
          const z = Ent.mkZombie(U.pick(['shambler', 'sprinter', 'sprinter']), zx, zy);
          z.state = 'investigate'; z.target = { x: p.x, y: p.y };
          G.zombies.push(z);
        }
      }
    }
    // 离屏增援（维持压力）
    this.trickleT -= dt;
    if (this.trickleT <= 0) {
      this.trickleT = 300;
      if (G.zombies.length < G.raid.popCap) {
        const spots = Gen.populate(G.world, G.world.cfg, (Math.random() * 1e9) | 0).slice(0, 2);
        for (const s of spots) G.zombies.push(Ent.mkZombie(s.type, s.x, s.y));
      }
    }
    // 死局检查（死亡由 Health/Game.die 触发）
  },

  // ================= 新游戏 / 战局 =================
  newGame(char) {
    const p = Ent.makePlayer(char);
    // 初始装备近战
    const stick = p.inv.find(x => x.id === 'wpn_stick');
    if (stick) Ent.equipItem(p, stick);
    G.save = {
      ver: 1, name: char.name, cash: 300, day: 1, totalKills: 0, extractCount: 0,
      facilities: { wb: 0, kitchen: 0, gym: 0, med: 0, intel: 0 },
      stash: [DB.mk('bag_school'), DB.mk('w_bottle', 2), DB.mk('f_canBeans', 2), DB.mk('m_bandage', 2)],
      mstock: {}, ending: false, player: null
    };
    G.player = p;
    this.saveGame();
    UI.toast('欢迎来到鸭科夫。老村长杰夫托梦说：活下去，攒物资，修飞船。', 'info');
    UI.showHideout();
  },

  mapLock(mid) {
    const m = DB.maps[mid], s = G.save;
    if (!m.require) return null;
    if (m.require.type === 'extractCount' && s.extractCount < m.require.val) return m.require.hint;
    if (m.require.type === 'item' && this.countRes(m.require.val) < 1) return m.require.hint;
    return null;
  },

  startRaid(mapId) {
    const m = DB.maps[mapId];
    const lock = this.mapLock(mapId);
    if (lock) { UI.toast('🔒 ' + lock, 'bad'); return; }
    // 消耗凭证
    if (m.require && m.require.type === 'item') this.consumeRes(m.require.val, 1);
    const p = G.player, s = G.save;
    // 藏身处增益
    p.gym = s.facilities.gym * 8;
    p.stamMax = 100 * (p.mods.stamMul || 1) * (1 + s.facilities.gym * 0.08);
    p.stam = p.stamMax;
    const medSup = ['m_bandS', 'm_alcohol', 'm_pain', 'm_antibio', 'm_medkit', 'm_surgery'];
    for (let i = 0; i < s.facilities.med && i < medSup.length; i++) Ent.addItem(p, DB.mk(medSup[i], 1));
    const k = s.facilities.kitchen;
    if (k >= 1) Ent.addItem(p, DB.mk('f_meatCook', 1));
    if (k >= 2) { Ent.addItem(p, DB.mk('f_meatCook', 1)); Ent.addItem(p, DB.mk('w_bottle', 2)); }
    if (k >= 3) { Ent.addItem(p, DB.mk('f_meatCook', 1)); Ent.addItem(p, DB.mk('w_bottle', 2)); Ent.addItem(p, DB.mk('w_coffee', 2)); }
    // 休整：恢复部分状态（僵毁式持久，但藏身处能喘口气）
    p.needs.hunger = Math.max(p.needs.hunger, 60);
    p.needs.thirst = Math.max(p.needs.thirst, 60);
    p.needs.fatigue = Math.min(p.needs.fatigue, 15);
    p.needs.stress = Math.max(0, p.needs.stress - 35);
    p.needs.boredom = Math.max(0, p.needs.boredom - 40);
    p.needs.wet = 0; p.needs.happy = Math.max(p.needs.happy, 60);
    p.sick.flu = 0; p.sick.food = 0;
    for (const kk in Sys.Health.PARTS) { const pt = p.parts[kk]; pt.hp = Math.min(pt.max, pt.hp + 14); }
    // 生成战局
    const seed = (Math.random() * 1e9) | 0;
    G.world = Gen.generate(mapId, seed);
    G.explored = new Uint8Array(G.world.w * G.world.h);
    Ent.startRaid(p, G.world);
    G.zombies = [];
    const pop = Gen.populate(G.world, m, seed);
    for (const z of pop) G.zombies.push(Ent.mkZombie(z.type, z.x, z.y));
    G.projectiles = []; G.particles = []; G.ground = []; G.strikes = [];
    G.extractT = 0; this.hordeT = 0; this.trickleT = 300;
    G.raid = {
      mapId, time: 8 * 60, limit: m.limit, popCap: pop.length + 8,
      weather: { type: m.storm ? 'storm' : (m.weather.length ? 'clear' : 'clear'), t: 60 },
      closed: false, kills0: p.kills, dmg0: p.dmg, shots0: p.shots
    };
    G.ambient = Sys.Time.ambient();
    Render.cam.x = p.x; Render.cam.y = p.y;
    G.state = 'raid';
    UI.show(null); UI.closeAllWins();
    UI.toast('进入了 ' + m.nm + ' — 搜刮·求生·撤离', 'info');
    UI.toast(m.storm ? '暴风雨永不停歇。注意雷击与失温。' : '提示：Ctrl 潜行接近，紫弹留给装甲鸭。', 'info');
    if (mapId === 'lab') UI.toast('断电设施：先找 B1 发电机恢复电力，才能打开 B2 闸门。', 'info');
  },

  endRaid(success) {
    const p = G.player, s = G.save;
    s.totalKills += p.kills - (G.raid.kills0 || 0);
    s.day += 1;
    let gains = { items: [], cash: 0 };
    if (success) {
      s.extractCount += 1;
      // 现金结算
      for (let i = p.inv.length - 1; i >= 0; i--) {
        if (p.inv[i].id === 'v_cash') { gains.cash += p.inv[i].qty * 20; p.inv.splice(i, 1); }
      }
      s.cash += gains.cash;
      gains.items = p.inv.slice();
      this.saveGame();
      G.state = 'extract';
      UI.showExtract(gains);
    }
  },

  die(cause) {
    const p = G.player;
    if (p.dead) return;
    p.dead = true; p.deadCause = cause;
    const s = G.save;
    s.totalKills += p.kills - (G.raid.kills0 || 0);
    s.day += 1;
    // 鸭科夫死亡规则：近战槽 + 保险箱 保留，其余全丢
    let lost = 0;
    lost += p.inv.length; p.inv = [];
    for (const slot of ['primary', 'secondary', 'body', 'head', 'bag', 'light', 'goggles']) {
      if (p.equip[slot]) { lost++; p.equip[slot] = null; }
    }
    for (const it of p.safe) if (it) s.stash.push(it);
    p.safe = [null, null, null, null];
    this.saveGame();
    setTimeout(() => { G.state = 'dead'; UI.showDeath(cause, lost); }, 900);
  },

  // ================= 设施 / 商人 =================
  countRes(id) {
    let n = Ent.countItem(G.player, id);
    for (const it of G.save.stash) if (it.id === id) n += it.qty;
    return n;
  },
  consumeRes(id, qty) {
    // 先扣身上，再扣仓库
    const invHave = Ent.countItem(G.player, id);
    const fromInv = Math.min(invHave, qty);
    if (fromInv > 0) Ent.consume(G.player, id, fromInv);
    let left = qty - fromInv;
    for (let i = G.save.stash.length - 1; i >= 0 && left > 0; i--) {
      const it = G.save.stash[i];
      if (it.id !== id) continue;
      const take = Math.min(it.qty, left);
      it.qty -= take; left -= take;
      if (it.qty <= 0) G.save.stash.splice(i, 1);
    }
  },
  countResStash(id) { return G.save.stash.reduce((a, b) => a + (b.id === id ? b.qty : 0), 0); },
  canPay(cost) { for (const id in cost) if (this.countRes(id) < cost[id]) return false; return true; },
  pay(cost) { for (const id in cost) this.consumeRes(id, cost[id]); },
  upgradeFacility(fid) {
    const f = DB.facilities.find(x => x.id === fid);
    const lv = G.save.facilities[fid] || 0;
    if (lv >= f.max) return;
    const cost = f.cost(lv + 1);
    if (!this.canPay(cost)) { UI.toast('材料不足', 'bad'); return; }
    this.pay(cost);
    G.save.facilities[fid] = lv + 1;
    if (fid === 'gym') {
      G.player.gym = (lv + 1) * 8;
      G.player.stamMax = 100 * (G.player.mods.stamMul || 1) * (1 + (lv + 1) * 0.08);
    }
    UI.toast(f.nm + ' 升级至 Lv.' + (lv + 1), 'good');
    this.saveGame();
  },
  buy(id) {
    const m = DB.merchant.concat(G.save.facilities.intel >= 3 ? DB.merchantRare : []).find(x => x.id === id);
    if (!m) return;
    const left = G.save.mstock[id] != null ? G.save.mstock[id] : m.stock;
    if (left <= 0) { UI.toast('缺货', 'bad'); return; }
    if (G.save.cash < m.price) { UI.toast('现金不足', 'bad'); return; }
    G.save.cash -= m.price;
    G.save.mstock[id] = left - 1;
    G.save.stash.push(DB.mk(id, m.per || 1));
    UI.toast('购入 ' + DB.it(id).nm, 'good');
    this.saveGame();
  },
  sell(where, uid) {
    const arr = where === 'inv' ? G.player.inv : G.save.stash;
    const i = arr.findIndex(x => x.uid === uid);
    if (i < 0) return;
    const it = arr[i], d = DB.it(it.id);
    const price = Math.max(1, Math.round(d.val * it.qty * 0.45));
    arr.splice(i, 1);
    G.save.cash += price;
    UI.toast(`出售 ${d.nm} +${price}`, 'good');
    this.saveGame();
  },
  showEnding() {
    G.save.ending = true;
    this.saveGame();
    UI.showEnding();
  },

  // ================= 存档 =================
  saveGame() {
    if (!G.save || !G.player) return;
    G.save.player = G.player;
    try {
      localStorage.setItem('duckboid_save', JSON.stringify(G.save));
    } catch (e) { console.warn('存档失败', e); }
  },
  loadGame() {
    try {
      const raw = localStorage.getItem('duckboid_save');
      if (!raw) return false;
      const s = JSON.parse(raw);
      G.save = s;
      G.player = s.player;
      let mx = 1;
      const scan = items => { for (const it of items) { mx = Math.max(mx, it.uid || 0); if (it.attach) for (const k in it.attach) if (it.attach[k]) mx = Math.max(mx, it.attach[k].uid || 0); } };
      scan(G.player.inv); scan(s.stash);
      for (const k in G.player.equip) if (G.player.equip[k]) mx = Math.max(mx, G.player.equip[k].uid);
      U._uid = mx + 100;
      G.state = 'hideout';
      return true;
    } catch (e) { console.warn('读档失败', e); return false; }
  }
};
window.Game = Game;
