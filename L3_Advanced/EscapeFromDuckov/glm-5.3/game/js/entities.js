// ============================================================
// entities.js — 玩家 / 鸭尸 AI / 弹道
// 僵毁：潜行·噪音·恐慌·部位受击 × 鸭科夫：双摇杆·翻滚无敌帧·甲弹关系
// ============================================================
'use strict';
const Ent = {
  grid: new Map(), // 空间哈希

  // ================= 玩家 =================
  makePlayer(char) {
    const prof = DB.professions.find(p => p.id === char.profession);
    const mods = Object.assign({}, prof.mods);
    for (const t of char.traits) {
      const td = DB.traits.find(x => x.id === t);
      if (td) for (const k in td.mods) {
        if (typeof td.mods[k] === 'number' && typeof mods[k] === 'number' && k !== 'guard' && k !== 'gut') mods[k] = (mods[k] ?? 1) * td.mods[k];
        else if (k === 'guard' || k === 'gut') mods.guard = (mods.guard || 1) * td.mods[k];
        else mods[k] = (mods[k] ?? 1) * td.mods[k];
      }
    }
    const p = {
      name: char.name || '鸭行者', prof: prof.id, profNm: prof.nm, traits: char.traits.slice(), mods,
      x: 0, y: 0, r: 10, dir: 0, face: 0, moving: 0,
      stam: 100 * (mods.stamMul || 1), stamMax: 100 * (mods.stamMul || 1),
      sneaking: false, sprinting: false,
      dodgeT: 0, dodgeCd: 0, dodgeVx: 0, dodgeVy: 0,
      swing: null, swingCd: 0, fireCd: 0, reloadT: 0, bloom: 0,
      action: null, // {t,dur,label,moveOK,done}
      panic: 0, painT: 0, drunkT: 0, syrHotT: 0, syrWtT: 0,
      needs: { hunger: 80, thirst: 80, fatigue: 15, boredom: 0, stress: 10, happy: 85, wet: 0 },
      sick: { food: 0, flu: 0, knox: -1, knoxT: 0 },
      parts: null, dead: false, deadCause: '',
      inv: [], equip: { melee: null, primary: null, secondary: null, body: null, head: null, bag: null, light: null, goggles: null },
      safe: [null, null, null, null], hotbar: [null, null, null, null], active: 'melee',
      xp: {}, kills: 0, shots: 0, hits: 0, dmg: 0, cashFound: 0,
      flashlightOn: false, thermalOn: false,
      gym: 0
    };
    Sys.Health.initParts(p);
    // 职业技能与初始包
    if (prof.skills) for (const k in prof.skills) p.xp[k] = Sys.Skills.xpForLevel(prof.skills[k]);
    for (const [id, q] of prof.kit) Ent.addItem(p, DB.mk(id, q));
    if (!p.equip.melee && !char.noStick) Ent.addItem(p, DB.mk('wpn_stick'));
    return p;
  },

  startRaid(p, W) {
    p.x = W.spawn.x; p.y = W.spawn.y;
    p.dead = false; p.dodgeT = 0; p.swing = null; p.action = null; p.reloadT = 0;
    p.needs.hunger = Math.max(p.needs.hunger, 55); p.needs.thirst = Math.max(p.needs.thirst, 55);
    p.flashlightOn = false; p.thermalOn = false;
    // 保险箱 & 近战槽位恒久保留；装备穿在身上
  },

  // ---------- 物品管理 ----------
  capacity(p) { const bag = p.equip.bag ? DB.it(p.equip.bag.id).cap : 0; return 10 + bag + (p.mods.capAdd || 0) + (p.syrWtT > 0 ? 12 : 0) + p.gym; },
  weight(p) { let w = 0; for (const it of p.inv) { const d = DB.it(it.id); if (d) w += d.wt * it.qty; } return w; },
  addItem(p, it) {
    if (!it) return false;
    const d = DB.it(it.id);
    if (d.stack) {
      const ex = p.inv.find(x => x.id === it.id);
      if (ex) { const room = d.stack - ex.qty; const mv = Math.min(room, it.qty); ex.qty += mv; it.qty -= mv; if (it.qty <= 0) return true; }
    }
    if (this.weight(p) + d.wt * it.qty > this.capacity(p) + 6) { UI.toast('背包超重！无法携带更多', 'bad'); return it.qty === 0; }
    p.inv.push(it); return true;
  },
  removeItem(p, uid, qty = 1) {
    const i = p.inv.findIndex(x => x.uid === uid);
    if (i < 0) return false;
    const it = p.inv[i];
    it.qty -= qty;
    if (it.qty <= 0) {
      for (const k in p.hotbar) if (p.hotbar[k] === it.uid) p.hotbar[k] = null;
      p.inv.splice(i, 1);
    }
    return true;
  },
  countItem(p, id) { let n = 0; for (const it of p.inv) if (it.id === id) n += it.qty; return n; },
  consume(p, id, qty = 1) {
    for (const it of p.inv) if (it.id === id) {
      const take = Math.min(it.qty, qty); it.qty -= take; qty -= take;
      if (it.qty <= 0) this.removeItem(p, it.uid, 0);
      if (qty <= 0) return true;
    }
    return qty <= 0;
  },
  findItems(p, id) { return p.inv.filter(x => x.id === id); },
  equipItem(p, it) {
    const d = DB.it(it.id);
    let slot = null;
    if (d.cat === 'melee') slot = 'melee';
    else if (d.cat === 'gun') slot = p.equip.primary ? (p.equip.secondary ? (p.active === 'primary' ? 'primary' : 'secondary') : 'secondary') : 'primary';
    else if (d.cat === 'armor') slot = 'body';
    else if (d.cat === 'helmet') slot = 'head';
    else if (d.cat === 'bag') slot = 'bag';
    else if (d.cat === 'light') slot = 'light';
    else if (d.cat === 'goggle') slot = 'goggles';
    if (!slot) return false;
    const old = p.equip[slot];
    this.removeItem(p, it.uid, 0);
    p.inv = p.inv.filter(x => x.uid !== it.uid);
    if (old) { old.qty = 1; p.inv.push(old); }
    p.equip[slot] = it;
    if (slot === 'melee' && !p.equip.primary && !p.equip.secondary) p.active = 'melee';
    if (slot === 'primary' || slot === 'secondary') p.active = slot;
    return true;
  },
  unequip(p, slot) {
    const it = p.equip[slot];
    if (!it) return;
    p.equip[slot] = null;
    if (p.active === slot) p.active = p.equip.primary ? 'primary' : (p.equip.secondary ? 'secondary' : 'melee');
    p.inv.push(it);
  },
  activeWeapon(p) {
    if (p.active === 'primary' && p.equip.primary) return { it: p.equip.primary, d: DB.it(p.equip.primary.id) };
    if (p.active === 'secondary' && p.equip.secondary) return { it: p.equip.secondary, d: DB.it(p.equip.secondary.id) };
    if (p.equip.melee) return { it: p.equip.melee, d: DB.it(p.equip.melee.id) };
    return { it: null, d: null };
  },
  gunStats(p, it) {
    const d = DB.it(it.id);
    const s = { dmg: d.dmg, rof: d.rof, mag: d.mag, spread: d.spread, noise: d.noise, recoil: d.recoil, rng: d.rng, pellets: d.pellets || 1 };
    for (const slot in it.attach) {
      const a = it.attach[slot]; if (!a) continue;
      const ad = DB.it(a.id); if (!ad || !ad.mods) continue;
      for (const k in ad.mods) s[k] *= (1 + ad.mods[k]);
    }
    s.mag = Math.round(s.mag);
    if (Sys.Skills.lvl(p, 'aiming') >= 5) s.spread *= 0.85;
    return s;
  },

  // ---------- 玩家更新 ----------
  updatePlayer(p, dt, W) {
    if (p.dead) return;
    const I = Input;
    // 频道动作（站桩急救等）
    if (p.action) {
      if (!p.action.moveOK && (I.hold('KeyW') || I.hold('KeyA') || I.hold('KeyS') || I.hold('KeyD'))) {
        UI.toast('动作被打断', 'bad'); p.action = null;
      } else {
        p.action.t += dt;
        if (p.action.t >= p.action.dur) { const a = p.action; p.action = null; a.done && a.done(); }
      }
    }
    // 朝向 = 鼠标
    p.dir = U.ang(p.x, p.y, I.mouse.wx, I.mouse.wy);
    // 翻滚
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    if (I.hit('Space') && p.dodgeCd <= 0 && p.stam > 14 && !p.action) {
      let mv = this._moveVec();
      let a = (mv.x || mv.y) ? Math.atan2(mv.y, mv.x) : p.dir;
      p.dodgeT = 0.3; p.dodgeCd = 1.05; p.stam -= 14;
      p.dodgeVx = Math.cos(a) * 350; p.dodgeVy = Math.sin(a) * 350;
      Sys.Noise.emit(p.x, p.y, 4 * 32 * (p.mods.noiseMul || 1), 'roll');
    }
    // 移动
    let spd = 108;
    p.sneaking = I.hold('ControlLeft') || I.hold('KeyC');
    p.sprinting = (I.hold('ShiftLeft') || I.hold('ShiftRight')) && p.stam > 1 && !p.sneaking;
    if (p.sprinting) { spd = 168; p.stam -= dt * 10 * (p.mods.stamUse || 1); p.needs.fatigue = Math.min(100, p.needs.fatigue + dt * 0.24); Sys.Noise.emit(p.x, p.y, 9 * 32 * (p.mods.noiseMul || 1), 'run'); }
    else if (p.sneaking) { spd = 58; p.stam = Math.min(p.stamMax, p.stam + dt * 7); Sys.Noise.emit(p.x, p.y, 2.2 * 32 * (p.mods.noiseMul || 1), 'sneak'); }
    else { p.stam = Math.min(p.stamMax, p.stam + dt * 5); Sys.Noise.emit(p.x, p.y, 4.5 * 32 * (p.mods.noiseMul || 1), 'walk'); }
    const legs = Sys.Health.legFactor(p);
    spd *= legs;
    if (this.weight(p) > this.capacity(p)) spd *= 0.62;
    if (p.needs.fatigue > 80) spd *= 0.8;
    if (p.painT <= 0 && Sys.Health.painLevel(p) >= 2) spd *= 0.86;
    spd *= (p.mods.spdMul || 1);
    let vx = 0, vy = 0;
    if (p.dodgeT > 0) {
      p.dodgeT -= dt; vx = p.dodgeVx; vy = p.dodgeVy;
    } else if (!p.action || p.action.moveOK) {
      const mv = this._moveVec();
      vx = mv.x * spd; vy = mv.y * spd;
      p.face = (mv.x || mv.y) ? Math.atan2(mv.y, mv.x) : p.face;
    }
    p.moving = (vx || vy) ? 1 : 0;
    this._moveCollide(p, vx * dt, vy * dt, W);
    // 灯光 / 热成像
    if (I.hit('KeyQ') && p.equip.light) { p.flashlightOn = !p.flashlightOn; UI.toast(p.flashlightOn ? '手电开启' : '手电关闭', 'info'); }
    if (I.hit('KeyT')) {
      const hasTh = (p.equip.goggles && DB.it(p.equip.goggles.id).thermal) || this._gunThermal(p);
      if (hasTh) { p.thermalOn = !p.thermalOn; UI.toast(p.thermalOn ? '热成像已开启' : '热成像关闭', 'info'); }
      else UI.toast('需要热成像瞄具或护目镜', 'bad');
    }
    if (p.equip.light && p.flashlightOn) {
      const ld = DB.it(p.equip.light.id);
      if (p.equip.light.cond > 0) p.equip.light.cond -= dt * ld.drain / 600;
      else { p.flashlightOn = false; UI.toast('电池耗尽', 'bad'); }
    }
    // 武器切换
    if (I.hit('Digit1') && p.equip.primary) p.active = 'primary';
    if (I.hit('Digit2') && p.equip.secondary) p.active = 'secondary';
    if (I.hit('Digit3')) p.active = 'melee';
    const hb = I.hitNum();
    if (hb >= 4 && p.hotbar[hb - 4]) this.hotbarUse(p, hb - 4);
    // 攻击
    p.fireCd = Math.max(0, p.fireCd - dt); p.swingCd = Math.max(0, p.swingCd - dt); p.bloom = Math.max(0, p.bloom - dt * 3);
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) { p.reloadT = 0; this._finishReload(p); }
    }
    const w = this.activeWeapon(p);
    if (!p.action && !p.reloadT) {
      if (w.d && w.d.cat === 'gun') { if (I.mouse.down) this._tryShoot(p, w, dt); }
      else if (I.mouse.down || I.mouse.hitL) this._tryMelee(p, w);
    }
    if (I.hit('KeyR')) this._startReload(p);
    // 恐慌
    Sys.Needs.updatePanic(p, dt);
    // 计时器
    p.painT = Math.max(0, p.painT - dt);
    p.drunkT = Math.max(0, p.drunkT - dt);
    p.syrHotT = Math.max(0, p.syrHotT - dt);
    p.syrWtT = Math.max(0, p.syrWtT - dt);
    if (p.syrHotT > 0) Sys.Health.healPart(p, 'torso', dt * 1.6);
  },

  _gunThermal(p) {
    for (const slot of ['primary', 'secondary']) {
      const g = p.equip[slot]; if (!g) continue;
      if (g.attach && g.attach.scope && DB.it(g.attach.scope.id).thermal) return true;
    }
    return false;
  },
  _moveVec() {
    let x = 0, y = 0;
    if (Input.hold('KeyW')) y -= 1; if (Input.hold('KeyS')) y += 1;
    if (Input.hold('KeyA')) x -= 1; if (Input.hold('KeyD')) x += 1;
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  },
  _moveCollide(p, dx, dy, W) {
    const R = p.r;
    const free = (x, y) => {
      for (const [ox, oy] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
        const tx = Math.floor((x + ox) / 32), ty = Math.floor((y + oy) / 32);
        if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) return false;
        if (W.solid[ty * W.w + tx]) return false;
      }
      return true;
    };
    if (free(p.x + dx, p.y)) p.x += dx;
    if (free(p.x, p.y + dy)) p.y += dy;
  },

  // ---------- 射击 ----------
  _tryShoot(p, w, dt) {
    const it = w.it, d = w.d, gs = this.gunStats(p, it);
    if (p.fireCd > 0) return;
    if (it.loaded <= 0) { UI.toast('弹匣已空 — 按 R 装填', 'bad'); p.fireCd = 0.3; return; }
    p.fireCd = 60 / gs.rof;
    const ammo = DB.it(it.ammoId || this._bestAmmo(p, d.cal));
    const pen = ammo ? ammo.pen : 1;
    const tracer = ammo ? ammo.ic.c : '#f2a13c';
    it.loaded--;
    p.shots++;
    // 散布：技能/移动/恐慌/稳定瞄准
    let spread = gs.spread;
    const aimLv = Sys.Skills.lvl(p, 'aiming');
    spread *= (1 - aimLv * 0.045);
    if (p.moving) spread *= 1.5;
    if (p.panic > 40) spread *= 1 + p.panic / 160;
    if (Input.mouse.rdown) spread *= 0.55;
    if (p.needs.fatigue > 75) spread *= 1.3;
    spread += p.bloom;
    p.bloom = Math.min(9, p.bloom + gs.recoil * 0.55);
    const origin = { x: p.x + Math.cos(p.dir) * 16, y: p.y + Math.sin(p.dir) * 16 };
    for (let i = 0; i < gs.pellets; i++) {
      const a = p.dir + (U.rf(-1, 1) * spread * Math.PI / 180) + (gs.pellets > 1 ? U.rf(-0.09, 0.09) : 0);
      G.projectiles.push({ x: origin.x, y: origin.y, dx: Math.cos(a), dy: Math.sin(a), spd: 950, dmg: gs.dmg, pen, range: gs.rng * 32, traveled: 0, tracer, hostile: false });
    }
    FX.flash(origin.x, origin.y, p.dir, ammo && ammo.pen >= 5 ? '#c07ce8' : (ammo && ammo.pen >= 3 ? '#7ab8ff' : '#ffd98a'));
    FX.shell(p.x, p.y, p.dir);
    FX.shake(Math.min(4, gs.recoil * 0.8));
    Sys.Noise.emit(p.x, p.y, gs.noise * 32 * (p.mods.noiseMul || 1), 'gun');
    Sys.Skills.xp(p, 'aiming', 1.2);
    p.stam = Math.max(0, p.stam - gs.recoil * 0.8);
  },
  _bestAmmo(p, cal) {
    const opts = DB.ammoOfCal(cal).map(id => ({ id, pen: DB.it(id).pen, n: Ent.countItem(p, id) })).filter(a => a.n > 0);
    if (!opts.length) return null;
    opts.sort((a, b) => b.pen - a.pen);
    return opts[0].id;
  },
  _startReload(p) {
    const w = this.activeWeapon(p);
    if (!w.d || w.d.cat !== 'gun') return;
    const it = w.it;
    if (it.loaded >= this.gunStats(p, it).mag) { UI.toast('弹匣已满', 'info'); return; }
    const ammoId = it.ammoId && this.countItem(p, it.ammoId) > 0 ? it.ammoId : this._bestAmmo(p, w.d.cal);
    if (!ammoId) { UI.toast('没有 ' + DB.calibers[w.d.cal] + ' 弹药', 'bad'); return; }
    it.ammoId = ammoId;
    const rl = w.d.reload * (1 - Sys.Skills.lvl(p, 'reloading') * 0.05);
    p.reloadT = Math.max(0.6, rl);
    Sys.Skills.xp(p, 'reloading', 1);
  },
  _finishReload(p) {
    const w = this.activeWeapon(p);
    if (!w.d || w.d.cat !== 'gun') return;
    const it = w.it, gs = this.gunStats(p, it);
    const need = gs.mag - it.loaded;
    const have = this.countItem(p, it.ammoId);
    const take = Math.min(need, have);
    if (take > 0) { this.consume(p, it.ammoId, take); it.loaded += take; UI.toast('装填完成 +' + take + '（' + DB.it(it.ammoId).nm + '）', 'info'); }
  },

  // ---------- 近战 ----------
  _tryMelee(p, w) {
    if (p.swingCd > 0 || p.stam < 3) return;
    const d = w.d || { dmg: 7, rng: 0.95, arc: 1.5, swing: 0.5, knock: 80, noise: 4, skill: 'blunt', dur: 999 };
    p.swingCd = d.swing * (Sys.Health.armFactor(p));
    p.swing = { t: 0, dur: Math.min(0.24, d.swing * 0.45), d };
    p.stam = Math.max(0, p.stam - (d.wt > 3 ? 8 : 4) * (p.mods.stamUse || 1));
    Sys.Noise.emit(p.x, p.y, d.noise * 32 * (p.mods.noiseMul || 1), 'melee');
    const strBonus = 1 + Sys.Skills.lvl(p, 'strength') * 0.04;
    const dmg = d.dmg * strBonus * (p.mods.meleeMul || 1) * (0.75 + Math.random() * 0.5);
    const range = d.rng * 32 + 14, arc = d.arc;
    let hits = 0;
    for (const z of G.zombies) {
      if (z.hp <= 0) continue;
      const dd = U.dist(p.x, p.y, z.x, z.y);
      if (dd > range + z.size) continue;
      const a = U.ang(p.x, p.y, z.x, z.y);
      if (Math.abs(U.angDiff(p.dir, a)) > arc / 2 + 0.25) continue;
      // 僵毁式多目标命中
      const multihit = Sys.Skills.lvl(p, d.skill) >= 2 || Sys.Skills.lvl(p, 'strength') >= 4;
      if (!multihit && hits >= 1) continue;
      if (hits >= 2 + Math.floor(Sys.Skills.lvl(p, d.skill) / 3)) continue;
      hits++;
      this.damageZombie(z, dmg, 99, false);
      const kb = d.knock * (p.mods.knockMul || 1) * (1 + Sys.Skills.lvl(p, 'strength') * 0.05);
      z.vx += Math.cos(a) * kb; z.vy += Math.sin(a) * kb;
      z.stagger = Math.max(z.stagger, kb > 250 ? 0.65 : 0.3);
      FX.debris(z.x, z.y, '#5f6650');
      Sys.Skills.xp(p, d.skill, 2 + d.dmg * 0.05);
    }
    if (w.it && w.it.id !== 'wpn_stick') { w.it.cond -= 1 / (DB.it(w.it.id).dur || 100); if (w.it.cond <= 0) { UI.toast(DB.it(w.it.id).nm + ' 损坏了！', 'bad'); const slot = p.active === 'melee' ? 'melee' : p.active; this.unequip(p, 'melee'); } }
    if (hits > 0) { Sys.Skills.xp(p, 'strength', 0.8); FX.shake(1.5); }
  },

  // ---------- 翻越窗户 / 交互 ----------
  interactTarget(p) {
    const W = G.world;
    let best = null, bd = 46;
    for (const [i, d] of W.doors.entries()) {
      const tx = i % W.w, ty = (i / W.w) | 0;
      const dd = U.dist(p.x, p.y, tx * 32 + 16, ty * 32 + 16);
      if (dd < bd) { bd = dd; best = { kind: d.type, door: d, i, tx, ty, x: tx * 32 + 16, y: ty * 32 + 16 }; }
    }
    for (const f of W.furn) {
      if (f.hp <= 0 || !f.cont) continue;
      const dd = U.dist(p.x, p.y, f.tx * 32 + 16, f.ty * 32 + 16);
      if (dd < bd) { bd = dd; best = { kind: 'container', f, x: f.tx * 32 + 16, y: f.ty * 32 + 16 }; };
    }
    if (W.generator) {
      const dd = U.dist(p.x, p.y, W.generator.x, W.generator.y);
      if (dd < 60 && !W.power) best = { kind: 'generator', x: W.generator.x, y: W.generator.y };
    }
    for (const g of G.ground) {
      if (!g.it) continue;
      const dd = U.dist(p.x, p.y, g.x, g.y);
      if (dd < Math.min(bd, 40)) { bd = dd; best = { kind: 'ground', g, x: g.x, y: g.y }; }
    }
    return best;
  },
  doInteract(p) {
    if (p.action) return;
    const t = this.interactTarget(p);
    if (!t) return;
    const W = G.world;
    if (t.kind === 'door') {
      const d = t.door;
      if (d.barricade > 0) { UI.toast('被木板封死（朝它按 B 可拆除）', 'info'); return; }
      if (d.card) {
        if (this.countItem(p, d.card) > 0) { this.consume(p, d.card, 1); d.card = null; d.locked = false; UI.toast('门禁卡验证通过', 'good'); }
        else { UI.toast('需要 ' + DB.it(d.card).nm, 'bad'); return; }
      }
      if (d.powered && !W.power) { UI.toast('电磁闸门：需要先启动 B1 发电机', 'bad'); return; }
      if (d.locked) {
        p.action = { t: 0, dur: 1.2, label: '踹门…', moveOK: false, done: () => { d.locked = false; d.open = true; Gen.setDoorOpen(W, t.i, true); Sys.Noise.emit(p.x, p.y, 20 * 32, 'bang'); UI.toast('门被踹开了', 'info'); } };
        return;
      }
      Gen.setDoorOpen(W, t.i, !d.open);
      Sys.Noise.emit(p.x, p.y, 6 * 32 * (p.mods.noiseMul || 1), 'door');
      if (d.type === 'window' && !d.open) {
        // 翻窗：受伤风险（僵毁玻璃刮伤）
        p.action = { t: 0, dur: 0.8, label: '翻越窗户…', moveOK: false, done: () => { this._vault(p, t); } };
      }
    } else if (t.kind === 'container') {
      UI.openLoot(t.f);
    } else if (t.kind === 'ground') {
      const ok = this.addItem(p, t.g.it);
      if (ok) { G.ground.splice(G.ground.indexOf(t.g), 1); UI.toast('拾取 ' + DB.it(t.g.it.id).nm, 'good'); }
    } else if (t.kind === 'generator') {
      p.action = { t: 0, dur: 3, label: '启动发电机…', moveOK: false, done: () => { W.power = true; UI.toast('电力恢复！B1 灯光与 B2 电磁闸门已激活', 'good'); Sys.Noise.emit(p.x, p.y, 30 * 32, 'machine'); for (const [i, d] of W.doors.entries()) if (d.powered) { d.locked = false; } } };
    }
  },
  _vault(p, t) {
    const W = G.world;
    const dirA = U.ang(p.x, p.y, t.x, t.y);
    const nx = t.x + Math.cos(dirA) * 34, ny = t.y + Math.sin(dirA) * 34;
    p.x = nx; p.y = ny;
    Sys.Noise.emit(p.x, p.y, 8 * 32, 'vault');
    if (U.chance(0.07)) { Sys.Health.addInjury(p, U.pick(['larm', 'rarm']), 'scratch', '碎玻璃'); UI.toast('翻窗时被碎玻璃刮伤！', 'bad'); }
  },
  barricade(p) {
    const W = G.world;
    let best = null, bd = 52;
    for (const [i, d] of W.doors.entries()) {
      const tx = i % W.w, ty = (i / W.w) | 0;
      const dd = U.dist(p.x, p.y, tx * 32 + 16, ty * 32 + 16);
      if (dd < bd) { bd = dd; best = { i, d }; }
    }
    if (!best) { UI.toast('附近没有门窗', 'bad'); return; }
    if (!this.countItem(p, 't_hammer')) { UI.toast('需要锤子', 'bad'); return; }
    if (best.d.barricade >= 3 && best.d.hp < 200) { UI.toast('已经封到第三层了', 'info'); return; }
    if (this.countItem(p, 'mat_plank') < 1 || this.countItem(p, 'mat_nails') < 1) { UI.toast('需要 木板×1 + 钉子×1', 'bad'); return; }
    p.action = { t: 0, dur: 1.6, label: '钉木板…', moveOK: false, done: () => {
      this.consume(p, 'mat_plank', 1); this.consume(p, 'mat_nails', 1);
      best.d.barricade = Math.min(3, best.d.barricade + 1);
      best.d.hp += 90;
      Gen.setDoorOpen(W, best.i, false);
      Sys.Skills.xp(p, 'carpentry', 4);
      Sys.Noise.emit(p.x, p.y, 8 * 32, 'hammer');
      UI.toast('加固完成 Lv.' + best.d.barricade + '（木工经验+）', 'good');
    } };
  },

  hotbarUse(p, idx) {
    const uid = p.hotbar[idx];
    const it = p.inv.find(x => x.uid === uid);
    if (!it) { UI.toast('快捷栏空位：在背包中右键物品设为快捷', 'info'); return; }
    Sys.useItem(p, it, idx);
  },

  // ================= 鸭尸 =================
  mkZombie(type, x, y) {
    const d = DB.zombies[type];
    return {
      type, d, x, y, vx: 0, vy: 0, hp: d.hp, maxHp: d.hp, size: d.size,
      dir: U.rf(0, U.TAU), state: 'idle', stateT: 0, target: null, lastSeen: null,
      wanderT: U.rf(1, 4), wanderA: U.rf(0, U.TAU),
      atkT: 0, windup: 0, stagger: 0, path: null, pathT: 0,
      screamDone: false, alpha: d.camo ? 0.05 : 1, revealed: 0,
      chargeT: 0, dashT: 0, summonT: 10, boss: !!d.boss, telegraph: 0,
      spd: d.spd * (1 + U.rf(-d.spdVar, d.spdVar) / 100)
    };
  },

  updateZombies(dt) {
    const W = G.world, p = G.player;
    // 空间哈希
    this.grid.clear();
    for (const z of G.zombies) {
      if (z.hp <= 0) continue;
      const k = ((z.x / 64) | 0) + ',' + ((z.y / 64) | 0);
      let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); }
      a.push(z);
    }
    const nightBoost = G.ambient < 0.5 ? (W.cfg.nightBoost || 1) : 1;
    for (const z of G.zombies) {
      if (z.hp <= 0) continue;
      z.stateT += dt; z.atkT -= dt; z.stagger = Math.max(0, z.stagger - dt); z.revealed = Math.max(0, z.revealed - dt);
      // 惯性衰减
      z.x += z.vx * dt; z.y += z.vy * dt; z.vx *= Math.pow(0.02, dt); z.vy *= Math.pow(0.02, dt);
      if (z.stagger > 0) { this._zsep(z, dt); continue; }
      const dp = U.dist(z.x, z.y, p.x, p.y);
      // 感知（每 0.15s 一次）
      z.senseT = (z.senseT || 0) - dt;
      if (z.senseT <= 0 && !p.dead) {
        z.senseT = 0.15;
        let sightR = z.d.sight * 32 * nightBoost;
        if (p.sneaking) sightR *= 0.62;
        sightR /= (p.mods.visMul || 1);
        if (p.flashlightOn && p.equip.light && p.equip.light.cond > 0) sightR *= 1.3;
        if (dp < sightR && FOV.clearLine(W, z.x, z.y, p.x, p.y)) {
          if (z.state !== 'chase') { this._alert(z); }
          z.lastSeen = { x: p.x, y: p.y };
          z.state = 'chase'; z.stateT = 0;
        } else if (z.state === 'chase' && z.stateT > 4.5) { z.state = 'investigate'; z.target = z.lastSeen; z.stateT = 0; }
      }
      // Boss 特殊技能
      if (z.boss && z.state === 'chase' && !p.dead) this._bossAI(z, dt, dp);
      switch (z.state) {
        case 'idle': this._zIdle(z, dt); break;
        case 'investigate': this._zInvest(z, dt); break;
        case 'chase': this._zChase(z, dt, dp); break;
      }
      this._zsep(z, dt);
      // 碰撞（防穿墙）
      this._zcWall(z, W);
    }
    // 清尸
    for (let i = G.zombies.length - 1; i >= 0; i--) if (G.zombies[i].hp <= 0 && G.zombies[i].fadeT === undefined) { this._killZombie(G.zombies[i]); G.zombies.splice(i, 1); }
  },

  _zIdle(z, dt) {
    z.wanderT -= dt;
    if (z.wanderT <= 0) { z.wanderT = U.rf(2, 6); z.wanderA = U.rf(0, U.TAU); }
    const spd = z.spd * 0.32;
    z.x += Math.cos(z.wanderA) * spd * dt; z.y += Math.sin(z.wanderA) * spd * dt;
    z.dir = U.rotTowards(z.dir, z.wanderA, dt * 1.5);
  },
  _zInvest(z, dt) {
    if (!z.target) { z.state = 'idle'; return; }
    const d = U.dist(z.x, z.y, z.target.x, z.target.y);
    if (d < 30 || z.stateT > 12) { z.state = 'idle'; z.wanderT = 2; return; }
    this._zstep(z, z.target.x, z.target.y, z.spd * 0.72, dt);
    z.dir = U.rotTowards(z.dir, U.ang(z.x, z.y, z.target.x, z.target.y), dt * 3);
  },
  _zChase(z, dt, dp) {
    const p = G.player;
    if (dp < z.d.atkRange + p.r && z.atkT <= 0 && z.windup <= 0) { z.windup = z.boss ? 0.55 : 0.34; z.atkT = z.d.atkCd; return; }
    if (z.windup > 0) {
      z.windup -= dt;
      z.dir = U.rotTowards(z.dir, U.ang(z.x, z.y, p.x, p.y), dt * 4);
      if (z.windup <= 0) {
        if (U.dist(z.x, z.y, p.x, p.y) < z.d.atkRange + 18 + p.r) Sys.Health.zombieHit(G.player, z);
        FX.debris(p.x + U.rf(-8, 8), p.y + U.rf(-8, 8), '#8a8a7a');
      }
      return;
    }
    this._zstep(z, p.x, p.y, z.spd * (G.ambient < 0.5 ? 1.12 : 1), dt);
    z.dir = U.rotTowards(z.dir, U.ang(z.x, z.y, p.x, p.y), dt * 4);
  },
  // 带破门判定的移动
  _zstep(z, tx, ty, spd, dt) {
    const W = G.world;
    const a = U.ang(z.x, z.y, tx, ty);
    const nx = z.x + Math.cos(a) * spd * dt, ny = z.y + Math.sin(a) * spd * dt;
    const gx = Math.floor(nx / 32), gy = Math.floor(ny / 32);
    if (gx < 0 || gy < 0 || gx >= W.w || gy >= W.h) { z.x = z.x; return; }
    const i = gy * W.w + gx;
    if (W.solid[i]) {
      const d = W.doors.get(i);
      if (d && (W.tiles[i] === T.DOOR || W.tiles[i] === T.WINDOW)) {
        // 破门/砸窗
        z.bangT = (z.bangT || 0) + dt;
        if (z.bangT > 0.7) {
          z.bangT = 0;
          const dmg = z.boss ? 55 : 14;
          d.hp -= dmg;
          Sys.Noise.emit(z.x, z.y, 16 * 32, 'bang');
          FX.debris(gx * 32 + 16, gy * 32 + 16, '#8a6b45');
          if (d.hp <= 0) {
            d.open = true; d.barricade = 0; d.locked = false; d.broken = true;
            Gen.setDoorOpen(W, i, true);
            if (d.type === 'window') UI.toast('窗户被砸碎了！', 'bad');
          }
        }
      }
      // 绕墙滑行
      z.x += Math.cos(a + Math.PI / 2) * spd * dt * 0.7 * (z.slDir || (z.slDir = U.chance(0.5) ? 1 : -1));
      z.y += Math.sin(a + Math.PI / 2) * spd * dt * 0.7 * (z.slDir || 1);
      return;
    }
    z.x = nx; z.y = ny;
  },
  _zsep(z, dt) {
    // 同类排斥（避免堆叠）
    const cx = (z.x / 64) | 0, cy = (z.y / 64) | 0;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const arr = this.grid.get((cx + ox) + ',' + (cy + oy));
      if (!arr) continue;
      for (const o of arr) {
        if (o === z || o.hp <= 0) continue;
        const dd = U.dist(z.x, z.y, o.x, o.y), min = z.size + o.size - 2;
        if (dd < min && dd > 0.01) {
          const push = (min - dd) * 0.5, a = U.ang(o.x, o.y, z.x, z.y);
          z.x += Math.cos(a) * push; z.y += Math.sin(a) * push;
        }
      }
    }
  },
  _zcWall(z, W) {
    const gx = Math.floor(z.x / 32), gy = Math.floor(z.y / 32);
    if (gx < 1 || gy < 1 || gx >= W.w - 1 || gy >= W.h - 1) return;
    if (W.solid[gy * W.w + gx]) {
      const a = U.ang(gx * 32 + 16, gy * 32 + 16, z.x, z.y);
      z.x = gx * 32 + 16 + Math.cos(a) * 18; z.y = gy * 32 + 16 + Math.sin(a) * 18;
    }
  },
  _alert(z) {
    // 尖啸 & 邻居警觉
    if (z.d.scream && !z.screamDone) {
      z.screamDone = true;
      FX.ring(z.x, z.y, 9 * 32, '#e5484d', 0.8);
      Sys.Noise.emit(z.x, z.y, 30 * 32, 'scream');
      UI.toast('尖啸鸭发出了刺耳的尖叫！附近鸭尸正在涌来', 'bad');
    }
    for (const o of G.zombies) {
      if (o === z || o.hp <= 0 || o.state === 'chase') continue;
      if (U.dist(z.x, z.y, o.x, o.y) < 5 * 32 && U.chance(0.6)) { o.state = 'investigate'; o.target = { x: z.x, y: z.y }; o.stateT = 0; }
    }
  },

  // ---------- Boss AI ----------
  _bossAI(z, dt, dp) {
    const p = G.player;
    // 路障：蓄力冲锋（红光预警 · 鸭科夫狂暴搜刮者）
    if (z.d.charge) {
      if (z.chargeT > 0) {
        z.chargeT -= dt;
        if (z.chargeT <= 0) { z.dashT = 0.55; z.dashA = U.ang(z.x, z.y, p.x, p.y); }
      } else if (dp > 3 * 32 && dp < 9 * 32 && z.atkT < -2 && U.chance(dt * 0.5)) {
        z.chargeT = 0.8; z.atkT = 4;
        FX.ring(z.x, z.y, 40, '#ff5a3a', 0.8);
      }
      if (z.dashT > 0) {
        z.dashT -= dt;
        z.x += Math.cos(z.dashA) * 380 * dt; z.y += Math.sin(z.dashA) * 380 * dt;
        if (U.dist(z.x, z.y, p.x, p.y) < 30 && p.dodgeT <= 0) { Sys.Health.hit(p, 'torso', 26, 'boss'); z.dashT = 0; FX.shake(6); }
      }
    }
    // 路障：霰弹齐射
    if (z.d.shotgun && dp < 9 * 32 && z.atkT <= 0 && z.windup <= 0 && U.chance(dt * 0.8)) {
      z.atkT = 3.2;
      const base = U.ang(z.x, z.y, p.x, p.y);
      for (let i = -2; i <= 2; i++) {
        const a = base + i * 0.11;
        G.projectiles.push({ x: z.x + Math.cos(a) * 20, y: z.y + Math.sin(a) * 20, dx: Math.cos(a), dy: Math.sin(a), spd: 640, dmg: 12, pen: 2, range: 9 * 32, traveled: 0, tracer: '#ff9a4a', hostile: true });
      }
      FX.flash(z.x + Math.cos(base) * 20, z.y + Math.sin(base) * 20, base, '#ffd98a');
      Sys.Noise.emit(z.x, z.y, 40 * 32, 'gun');
    }
    // 典狱长：震地
    if (z.type === 'boss_jailer' && dp < 4.2 * 32 && z.atkT <= 0 && U.chance(dt * 0.9)) {
      z.atkT = 4; z.slamT = 1.0;
      FX.ring(z.x, z.y, 3.2 * 32, '#f0b429', 1.0);
    }
    if (z.slamT > 0) {
      z.slamT -= dt;
      if (z.slamT <= 0) {
        FX.shake(8); Sys.Noise.emit(z.x, z.y, 26 * 32, 'slam');
        if (U.dist(z.x, z.y, p.x, p.y) < 3.2 * 32 && p.dodgeT <= 0) Sys.Health.hit(p, U.pick(['lleg', 'rleg']), 30, 'boss');
      }
    }
    // 雷暴骑士：落雷 + 召唤
    if (z.d.lightning && z.atkT <= 0 && U.chance(dt * 0.55)) {
      z.atkT = 3.5;
      G.strikes.push({ x: p.x, y: p.y, t: 1.2, r: 2.6 * 32 });
      Sys.Noise.emit(p.x, p.y, 20 * 32, 'thunder');
    }
    if (z.d.summon && dp < 14 * 32) {
      z.summonT -= dt;
      if (z.summonT <= 0) {
        z.summonT = 12;
        for (let i = 0; i < 2; i++) {
          const a = U.rf(0, U.TAU);
          G.zombies.push(this.mkZombie(z.d.summon, z.x + Math.cos(a) * 60, z.y + Math.sin(a) * 60));
        }
        UI.toast('雷暴骑士召唤了疾走鸭尸！', 'bad');
      }
    }
  },

  // ---------- 伤害（甲弹公式 §4.2） ----------
  damageZombie(z, base, pen, isGun) {
    let dmg = base;
    const armor = z.d.armor;
    if (armor > 0 && pen < 90) dmg = DB.dmgFormula(base, armor, pen);
    // 路障正面盾
    if (z.d.shield && pen < 90) {
      const facing = Math.abs(U.angDiff(z.dir, U.ang(z.x, z.y, G.player.x, G.player.y))) < 1.1;
      if (facing && !z.chargeT) dmg *= 0.2;
    }
    // 爆头判定（枪械命中头部区域 12% 概率 ×3）
    if (isGun && U.chance(0.12 + Sys.Skills.lvl(G.player, 'aiming') * 0.012)) { dmg *= 2.8; FX.text(z.x, z.y - 18, '爆头!', '#ffd24a'); }
    z.hp -= dmg;
    z.hitT = 0.12;
    G.player.hits++; G.player.dmg += dmg;
    if (z.d.camo) { z.alpha = 0.55; z.revealed = 4; }
    FX.text(z.x + U.rf(-6, 6), z.y - 14, Math.round(dmg), pen >= 5 ? '#c07ce8' : pen >= 3 ? '#7ab8ff' : '#f2d49a');
    if (z.hp <= 0) { z.deadFlag = true; }
    return dmg;
  },

  _killZombie(z) {
    const p = G.player;
    p.kills++;
    Sys.Skills.xp(p, 'blade', 0); // 占位：经验在武器命中时给
    Sys.Needs.onKill(p);
    FX.feather(z.x, z.y, z.boss ? 26 : 9);
    // 尸体容器
    const items = [];
    for (const [id, ch, qr] of z.d.loot) if (U.chance(ch)) items.push(DB.mk(id, U.ri(qr[0], qr[1])));
    G.world.furn.push({ tx: Math.floor(z.x / 32), ty: Math.floor(z.y / 32), kind: 'corpse', cont: { table: 'corpse', items, searched: false, nm: z.d.nm + ' 的尸体' }, hp: 1, zombie: true, fade: 40 });
    if (z.boss) {
      UI.toast('⚔ ' + z.d.nm + ' 已被击杀！检查掉落', 'good');
      FX.shake(10);
      for (const [id, ch, qr] of z.d.loot) if (U.chance(ch)) G.ground.push({ x: z.x + U.rf(-30, 30), y: z.y + U.rf(-30, 30), it: DB.mk(id, U.ri(qr[0], qr[1])) });
      G.raid.bossKilled = (G.raid.bossKilled || 0) + 1;
    }
  },

  // ---------- 弹道 ----------
  updateProjectiles(dt) {
    const W = G.world, p = G.player;
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const b = G.projectiles[i];
      const step = b.spd * dt;
      let steps = Math.ceil(step / 12), hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        b.x += b.dx * step / steps; b.y += b.dy * step / steps;
        b.traveled += step / steps;
        const gx = Math.floor(b.x / 32), gy = Math.floor(b.y / 32);
        if (gx < 0 || gy < 0 || gx >= W.w || gy >= W.h || W.solid[gy * W.w + gx]) {
          FX.debris(b.x, b.y, '#8d99a6'); hit = true; break;
        }
        if (b.hostile) {
          if (U.dist(b.x, b.y, p.x, p.y) < p.r + 4 && p.dodgeT <= 0) {
            Sys.Health.hit(p, U.pick(['head', 'torso', 'torso', 'larm', 'rarm', 'lleg', 'rleg']), b.dmg, 'bullet', b.pen);
            FX.feather(p.x, p.y, 4); hit = true;
          }
        } else {
          for (const z of G.zombies) {
            if (z.hp <= 0) continue;
            if (U.dist(b.x, b.y, z.x, z.y) < z.size + 4) {
              const armorBlock = z.d.armor >= 3 && b.pen < z.d.armor;
              this.damageZombie(z, b.dmg, b.pen, true);
              if (!armorBlock) { z.vx += b.dx * 40; z.vy += b.dy * 40; }
              Sys.Skills.xp(p, 'aiming', 0.6);
              hit = true; break;
            }
          }
        }
        if (b.traveled > b.range) { hit = true; }
      }
      if (hit || b.traveled > b.range) {
        FX.tracer(b.x - b.dx * Math.min(60, b.traveled), b.y - b.dy * Math.min(60, b.traveled), b.x, b.y, b.tracer);
        G.projectiles.splice(i, 1);
      }
    }
  }
};
window.Ent = Ent;
