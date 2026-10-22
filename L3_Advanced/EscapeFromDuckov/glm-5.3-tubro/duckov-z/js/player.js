/* DUCKOV Z - 玩家：部位健康/Moodles/技能/物品/定时动作/互动 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U, IT = DZ.IT, W = DZ.W, T = W.T;
  const P = {};

  // ---------- 创建 ----------
  function makeParts() {
    const o = {};
    for (const p of C.BODY.parts) o[p.id] = { hp: p.hp, max: p.hp, bleed: 0, frac: false, bandagedT: 0 };
    return o;
  }
  function findBedInKind(S, kind) {
    for (const B of S.buildings) {
      if (B.kind !== kind) continue;
      const solid = W.solidFn(S);
      for (let y = B.y + 1; y < B.y + B.h - 1; y++) for (let x = B.x + 1; x < B.x + B.w - 1; x++)
        if (W.tget(S, x, y) === T.BED && !solid(x, y + 1)) return { x: (x + 0.5) * C.TILE, y: (y + 1.7) * C.TILE };
      // 兜底：室内中心附近找空地
      const cx = B.x + (B.w >> 1), cy = B.y + (B.h >> 1);
      for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (!solid(cx + dx, cy + dy)) return { x: (cx + dx + 0.5) * C.TILE, y: (cy + dy + 0.5) * C.TILE };
      }
      return { x: (B.x + B.w / 2) * C.TILE, y: (B.y + B.h / 2) * C.TILE };
    }
    return null;
  }
  P.create = function (S, profId) {
    const prof = IT.PROFS.find(p => p.id === profId) || IT.PROFS[5];
    let pos = findBedInKind(S, prof.spawn);
    if (!pos) for (const h of S.houses) { pos = findBedInKind(S, h.kind); if (pos) break; }
    if (!pos) pos = { x: C.MW / 2 * C.TILE, y: C.MH / 2 * C.TILE };
    S.home = { x: pos.x, y: pos.y };
    const pl = {
      x: pos.x, y: pos.y, a: 0, vx: 0, vy: 0, prof: prof.id,
      body: makeParts(), hunger: 92, thirst: 90, fatigue: 88, stamina: 100,
      painMaskH: 0, betaH: 0, vitH: 0, wet: 0, panic: 0,
      zv: -1, bact: -1, bactDoseLeft: 0,
      inv: [], slots: { head: null, vest: null, jacket: null, pack: null, primary: null, melee: null },
      sk: {}, flashlight: false, nv: false, crouch: false, aiming: false,
      rolling: 0, rollDir: null, stagger: 0, grabbedBy: null, struggle: 0,
      act: null, dead: false, deadCause: '', walkPhase: 0, stepT: 0,
      fireT: 0, reloadT: 0, swingT: 0, noiseMul: 1
    };
    for (const s of C.SKILLS) pl.sk[s] = { lv: 1, xp: 0 };
    for (const k in prof.sk || {}) pl.sk[k].lv += prof.sk[k];
    for (const [id, q] of prof.items) P.add(S, pl, IT.newInst(id, id === 'nails' ? 20 : q));
    if (prof.eq) {
      if (prof.eq.primary) pl.slots.primary = P.takeFromInv(pl, prof.eq.primary);
      if (prof.eq.melee) pl.slots.melee = P.takeFromInv(pl, prof.eq.melee);
      if (prof.eq.head) pl.slots.head = P.takeFromInv(pl, prof.eq.head);
      if (prof.eq.vest) pl.slots.vest = P.takeFromInv(pl, prof.eq.vest);
      if (prof.eq.jacket) pl.slots.jacket = P.takeFromInv(pl, prof.eq.jacket);
    }
    P.recalc(S, pl);
    return pl;
  };
  P.takeFromInv = function (pl, id) {
    const i = pl.inv.findIndex(it => it.id === id);
    return i >= 0 ? pl.inv.splice(i, 1)[0] : IT.newInst(id, 1);
  };

  // ---------- 物品 ----------
  function gearOf(pl, slot) { const it = pl.slots[slot]; return it ? IT.def(it.id).gear || {} : {}; }
  P.weight = pl => pl.inv.reduce((a, it) => a + IT.weight(it), 0);
  P.cap = function (S, pl) {
    const g = gearOf(pl, 'pack');
    return C.WEIGHT.baseCap + pl.sk.strength.lv * C.WEIGHT.perStr + (g.cap || 0);
  };
  P.count = (pl, id) => pl.inv.filter(i => i.id === id).reduce((a, i) => a + i.qty, 0);
  P.consume = function (pl, id, n) {
    let left = n;
    for (let i = pl.inv.length - 1; i >= 0 && left > 0; i--) {
      const it = pl.inv[i];
      if (it.id !== id) continue;
      const take = Math.min(left, it.qty);
      it.qty -= take; left -= take;
      if (it.qty <= 0) pl.inv.splice(i, 1);
    }
    return n - left;
  };
  P.add = function (S, pl, inst) {
    if (!inst) return true;
    const d = IT.def(inst.id);
    if (d.stack && d.stack > 1) {
      const ex = pl.inv.find(i => i.id === inst.id && i.qty < d.stack);
      if (ex) { const room = d.stack - ex.qty, take = Math.min(room, inst.qty); ex.qty += take; inst.qty -= take; if (inst.qty <= 0) return true; }
    }
    pl.inv.push(inst);
    return true;
  };
  P.equip = function (S, pl, idx) {
    const it = pl.inv[idx]; if (!it) return;
    const d = IT.def(it.id);
    if (d.gun) { pl.inv[idx] = pl.slots.primary || null; pl.slots.primary = it; if (!pl.inv[idx]) pl.inv.splice(idx, 1); }
    else if (d.mel) { pl.inv[idx] = pl.slots.melee || null; pl.slots.melee = it; if (!pl.inv[idx]) pl.inv.splice(idx, 1); }
    else if (d.gear) {
      const slot = d.gear.slot;
      pl.inv[idx] = pl.slots[slot] || null; pl.slots[slot] = it;
      if (!pl.inv[idx]) pl.inv.splice(idx, 1);
      if (slot === 'head') pl.flashlight = false;
    } else if (d.sh === 'flashlight' || d.sh === 'nv') { /* 工具在背包即生效 */ }
    P.recalc(S, pl);
    DZ.audio.play('pickup', pl.x, pl.y);
  };
  P.unequip = function (S, pl, slot) {
    const it = pl.slots[slot]; if (!it) return;
    if (P.weight(pl) + IT.weight(it) > P.cap(S, pl) + 2) { DZ.UI && DZ.UI.toast('太重了，拿不动'); return; }
    pl.slots[slot] = null; P.add(S, pl, it); P.recalc(S, pl);
  };
  P.recalc = function (S, pl) { pl.overCap = Math.max(0, P.weight(pl) - P.cap(S, pl)); };

  // ---------- 技能 ----------
  P.xp = function (S, pl, skill, amt) {
    const prof = IT.PROFS.find(p => p.id === pl.prof) || {};
    amt *= prof.xpMul || 1;
    const s = pl.sk[skill]; s.xp += amt;
    while (s.xp >= C.XP_PER_LV(s.lv)) { s.xp -= C.XP_PER_LV(s.lv); s.lv++; DZ.audio.playRaw('levelup'); DZ.UI && DZ.UI.toast('[' + C.SKILL_NAMES[skill] + '] 提升到 Lv.' + s.lv); }
  };

  // ---------- 伤害 ----------
  P.applyDamage = function (S, pl, part, dmg, kind) { // kind: hit/scratch/laceration/bite/explosion
    if (pl.dead) return;
    const bp = pl.body[part];
    let d = dmg;
    // 护甲吸收
    let biteSave = 0;
    if (part === 'torso') { d *= (1 - (gearOf(pl, 'vest').abs || 0)) * (1 - (gearOf(pl, 'jacket').abs || 0) * 0.5); biteSave = gearOf(pl, 'vest').biteSave || 0; }
    if (part === 'head') d *= (1 - (gearOf(pl, 'head').abs || 0));
    bp.hp -= d;
    // 伤口与感染
    if (kind === 'scratch' || kind === 'laceration' || kind === 'bite') {
      let k = kind;
      if (k === 'bite' && Math.random() < biteSave) k = 'laceration'; // 甲弹关系：护甲把啃咬降级
      bp.bleed = Math.max(bp.bleed, k === 'bite' ? 3 : k === 'laceration' ? 2 : 1);
      pl.panic = U.clamp(pl.panic + (k === 'bite' ? 40 : 18), 0, 100);
      if (Math.random() < (k === 'laceration' ? 0.22 : 0.08)) bp.frac = true;
      if (pl.zv < 0) {
        const zvChance = k === 'bite' ? 1 : k === 'laceration' ? 0.13 : 0.06;
        if (Math.random() < zvChance) { pl.zv = C.INFECTION.zvBiteH * 60; DZ.UIH && DZ.UIH.radioBanner('⚠ 你被咬了……', '有什么东西在血液里蔓延。抗生素只能延缓它。'); }
        else if (Math.random() < C.INFECTION.bactChance) { pl.bact = C.INFECTION.bactDays * 1440; }
      }
      DZ.audio.play('hurtDuck', pl.x, pl.y);
      DZ.FX.feathers(pl.x, pl.y, 8, true);
      DZ.FX.shake(6);
    } else if (kind === 'explosion') {
      pl.panic = U.clamp(pl.panic + 30, 0, 100);
    } else {
      if (Math.random() < 0.25) bp.bleed = Math.max(bp.bleed, 1);
    }
    if ((bp.hp <= 0) && (part === 'head' || part === 'torso')) P.die(S, pl, kind === 'bite' ? '被丧尸鸭撕咬致死' : '伤重不治');
    P.recalc(S, pl);
  };
  P.die = function (S, pl, cause) {
    if (pl.dead) return;
    pl.dead = true; pl.deadCause = cause || '死亡';
    DZ.audio.playRaw('quack', { pan: 0 });
  };
  P.healPart = function (pl, part, amt) {
    const bp = pl.body[part];
    bp.hp = Math.min(bp.max, bp.hp + amt);
  };

  // ---------- Moodle 计算 ----------
  P.moodles = function (pl) {
    const m = {};
    m.hungry = lv(pl.hunger, 55, 35, 18, 6);
    m.thirsty = lv(pl.thirst, 50, 30, 15, 5);
    m.tired = lv(100 - pl.fatigue, 45, 60, 75, 88);
    const pain = P.painLevel(pl);
    m.pain = lv(pain, 12, 28, 45, 65);
    m.panic = lv(pl.panic, 25, 45, 65, 85);
    const bl = Object.values(pl.body).reduce((a, b) => Math.max(a, b.bleed), 0);
    m.bleed = bl;
    m.fract = Object.values(pl.body).some(b => b.frac) ? 2 : 0;
    m.sick = pl.bact >= 0 ? lv(pl.bact, 99999, 2000, 1000, 400) : (pl.zv >= 0 ? 4 : 0);
    m.drunkZ = pl.zv >= 0 ? lv(pl.zv, 99999, 2600, 1400, 600) : 0;
    m.chilled = lv(pl.wet, 45, 62, 78, 90) * (U.isNight(pl._mins || 0) ? 1 : 0.6) | 0;
    m.heavy = lv(pl.overCap, 0.5, 2.5, 5, 8);
    m.exhausted = pl.stamina < 12 ? 2 : 0;
    return m;
  };
  function lv(v, t1, t2, t3, t4) { return v >= t4 ? 4 : v >= t3 ? 3 : v >= t2 ? 2 : v >= t1 ? 1 : 0; }
  P.painLevel = function (pl) {
    if (pl.painMaskH > 0) return 0;
    let p = 0;
    for (const b of Object.values(pl.body)) { const miss = 1 - U.clamp(b.hp / b.max, 0, 1); p += miss * (b.bleed ? 14 : 9) + (b.frac ? 18 : 0); }
    return p;
  };

  // ---------- 移动速度 ----------
  P.speed = function (pl) {
    let s = pl.crouch ? C.SPD.crouch : pl.aiming ? C.SPD.aim : C.SPD.walk;
    if (pl.wantRun && !pl.crouch && !pl.aiming) s = C.SPD.run;
    const legsOk = (pl.body.legL.hp > 0) + (pl.body.legR.hp > 0);
    if (legsOk === 1) s *= 0.62;
    if (legsOk === 0) s *= 0.32;
    if (pl.body.armL.hp <= 0 && pl.body.armR.hp <= 0) s *= 0.9;
    const tiers = C.OVERWEIGHT_TIERS;
    for (let i = 0; i < tiers.length; i++) if (pl.overCap > tiers[i] * 4) s *= (0.86 - i * 0.05);
    if (pl.stamina <= 0) s *= 0.72;
    const pain = P.painLevel(pl);
    if (pain > 45) s *= 0.85;
    if (pl.stagger > 0) s *= 0.3;
    return s;
  };

  // ---------- 定时动作 ----------
  P.startAct = function (pl, type, secs, data) {
    if (pl.act) return false;
    pl.act = { type, t: 0, total: secs, data: data || {} };
    return true;
  };
  const HEAL_MUL = pl => { const prof = IT.PROFS.find(p => p.id === pl.prof) || {}; return (prof.healMul || 1) * (1 + (pl.sk.firstaid.lv - 1) * 0.12); };
  const ACT_DONE = {
    eat: (S, pl, a) => { const it = a.item; if (!it || it.qty <= 0) return; const f = IT.def(it.id).food; it.qty--; if (it.qty <= 0) pl.inv.splice(pl.inv.indexOf(it), 1);
      pl.hunger = U.clamp(pl.hunger + f.nut, 0, 100); if (f.hyd) pl.thirst = U.clamp(pl.thirst + f.hyd, 0, 100); if (f.sta) pl.stamina = U.clamp(pl.stamina + f.sta, 0, 100);
      if (f.heal) P.healPart(pl, 'torso', f.heal);
      if ((f.sickP && Math.random() < f.sickP) || it.fresh <= 0) { pl.bact = Math.max(pl.bact, 400); DZ.UI && DZ.UI.toast('呃……这东西不太新鲜（轻微感染）'); }
      if (f.fresh && it.fresh !== undefined && it.fresh <= 0) P.applyDamage(S, pl, 'torso', 4, 'hit');
      DZ.audio.playRaw('eat'); },
    drink: (S, pl, a) => { const it = a.item; if (!it || it.qty <= 0) return; const dr = IT.def(it.id).drink; it.qty--; if (it.qty <= 0) pl.inv.splice(pl.inv.indexOf(it), 1);
      pl.thirst = U.clamp(pl.thirst + dr.hyd, 0, 100); if (dr.sta) pl.stamina = U.clamp(pl.stamina + dr.sta, 0, 100); if (dr.wake) pl.fatigue = U.clamp(pl.fatigue + dr.wake, 0, 100);
      if (IT.def(it.id).leaves) P.add(S, pl, IT.newInst(IT.def(it.id).leaves, 1));
      DZ.audio.playRaw('drink'); },
    pill: (S, pl, a) => { const it = a.item; const med = IT.def(it.id).med; it.qty--; if (it.qty <= 0) pl.inv.splice(pl.inv.indexOf(it), 1);
      if (med.pill === 'pain') pl.painMaskH = C.PAINKILLER_H;
      else if (med.pill === 'beta') pl.betaH = C.BETABLOCK_H;
      else if (med.pill === 'vit') pl.vitH = 24;
      else if (med.pill === 'anti') {
        if (pl.zv >= 0) { pl.zv += C.INFECTION.zvAntiH * 60; DZ.UIH && DZ.UIH.radioBanner('抗生素起效了', '病毒的蔓延被延缓——但不会停止。'); }
        if (pl.bact >= 0) { pl.bactDoseLeft++; if (pl.bactDoseLeft >= 3) { pl.bact = -1; pl.bactDoseLeft = 0; DZ.UI && DZ.UI.toast('细菌感染已治愈'); } }
      }
      DZ.audio.playRaw('pill'); },
    bandage: (S, pl, a) => { const bp = pl.body[a.part]; bp.bandagedT = 480; bp.bleed = 0; P.healPart(pl, a.part, (IT.def(a.item.id).med.heal || 6) * HEAL_MUL(pl));
      const it = a.item; it.qty--; if (it.qty <= 0) pl.inv.splice(pl.inv.indexOf(it), 1);
      P.xp(S, pl, 'firstaid', 8); DZ.audio.playRaw('bandage'); },
    splint: (S, pl, a) => { const bp = pl.body[a.part]; bp.frac = false; if (bp.hp < 4) bp.hp = 4;
      const it = a.item; it.qty--; if (it.qty <= 0) pl.inv.splice(pl.inv.indexOf(it), 1);
      P.xp(S, pl, 'firstaid', 14); DZ.audio.playRaw('healDone'); },
    surgery: (S, pl, a) => { const bp = pl.body[a.part]; bp.frac = false; bp.bleed = 0; bp.hp = bp.max; bp.bandagedT = 240;
      const it = a.item; it.qty--; if (it.qty <= 0) pl.inv.splice(pl.inv.indexOf(it), 1);
      P.xp(S, pl, 'firstaid', 30); DZ.audio.playRaw('healDone'); },
    forage: (S, pl, a) => {
      const bush = a.bush; bush.cd = 1200;
      const r = Math.random();
      if (r < 0.5) { P.add(S, pl, IT.newInst('berry', U.range(1, 3))); DZ.UI && DZ.UI.floatText('+野莓果', pl.x, pl.y); }
      else if (r < 0.75) { P.add(S, pl, IT.newInst('rag', 1)); DZ.UI && DZ.UI.floatText('+破布条', pl.x, pl.y); }
      else DZ.UI && DZ.UI.floatText('一无所获…', pl.x, pl.y);
    },
    chop: (S, pl, a) => {
      DZ.audio.play('chop', a.tx * C.TILE, a.ty * C.TILE);
      a.hits--; DZ.FX.woodChips(a.tx * C.TILE + 16, a.ty * C.TILE + 16);
      if (a.hits <= 0) {
        S.tiles[a.ty * C.MW + a.tx] = T.DIRT;
        P.add(S, pl, IT.newInst('log', 1)); P.xp(S, pl, 'carpentry', 12); P.xp(S, pl, 'strength', 6);
        DZ.UI && DZ.UI.floatText('+原木', pl.x, pl.y);
        pl.act = null; // 树没了
      } else pl.act.t = 0;
    },
    barricade: (S, pl, a) => {
      const m = a.meta; m.boards++;
      P.consume(pl, 'plank', 1); P.consume(pl, 'nails', 4);
      const prof = IT.PROFS.find(p => p.id === pl.prof) || {};
      m.boardHp = (m.boardHp || 0) + 150 * (prof.id === 'carpenter' ? 1.5 : 1) * (1 + (pl.sk.carpentry.lv - 1) * 0.1);
      P.xp(S, pl, 'carpentry', 10); DZ.audio.playRaw('hammer');
    },
    unboard: (S, pl, a) => { const m = a.meta; m.boards--; DZ.audio.playRaw('pry'); P.xp(S, pl, 'carpentry', 4); },
    prydoor: (S, pl, a) => { a.meta.locked = false; DZ.audio.playRaw('pry'); DZ.CB.noise(S, pl.x, pl.y, C.NOISE.pry); DZ.UI && DZ.UI.toast('门被撬开了'); P.xp(S, pl, 'strength', 8); },
    refill: (S, pl, a) => { P.consume(pl, 'bottleE', 1); P.add(S, pl, IT.newInst('water', 1)); DZ.audio.playRaw('splash'); DZ.UI && DZ.UI.floatText('+瓶装水', pl.x, pl.y); },
    refillRain: (S, pl, a) => { if (!a.rc || a.rc.water < 1) return; a.rc.water--; P.consume(pl, 'bottleE', 1); P.add(S, pl, IT.newInst('water', 1)); DZ.audio.playRaw('splash'); DZ.UI && DZ.UI.floatText('+瓶装水(雨水)', pl.x, pl.y); },
    warmup: (S, pl) => { pl.wet = Math.max(0, pl.wet - 40); DZ.audio.playRaw('crackle'); DZ.UI && DZ.UI.floatText('暖和多了', pl.x, pl.y); },
    drinkDirect: (S, pl) => { pl.thirst = U.clamp(pl.thirst + 30, 0, 100); DZ.audio.playRaw('drink'); },
    fillgas: (S, pl) => { P.consume(pl, 'gascanE', 1); P.add(S, pl, IT.newInst('gascanF', 1)); DZ.audio.playRaw('splash'); DZ.UI && DZ.UI.floatText('+满油桶 (' + P.count(pl, 'gascanF') + '/' + C.EVAC_FUEL_NEEDED + ')', pl.x, pl.y); },
    cook: (S, pl, a) => { const it = a.item; it.qty--; if (it.qty <= 0) pl.inv.splice(pl.inv.indexOf(it), 1);
      P.add(S, pl, IT.newInst('cookedMeat', 1)); DZ.audio.playRaw('eat'); DZ.UI && DZ.UI.floatText('+烤肉排', pl.x, pl.y); },
    readnote: (S, pl, a) => { DZ.UI && DZ.UI.noteModal(DZ.IT.NOTES[a.noteId] || '字迹已经模糊不清。'); },
    readbook: (S, pl, a) => { const it = a.item; P.xp(S, pl, 'firstaid', 120); it.qty--; if (it.qty <= 0) pl.inv.splice(pl.inv.indexOf(it), 1); DZ.UI && DZ.UI.toast('你仔细研读了急救手册'); },
    climbwin: (S, pl, a) => { pl.x = a.nx; pl.y = a.ny; if (Math.random() < 0.12) P.applyDamage(S, pl, U.pick(['armL', 'armR', 'legL', 'legR']), 5, 'scratch'); DZ.audio.playRaw('roll'); },
    craft: (S, pl, a) => { DZ.P.finishCraft(S, pl, a.recipe); }
  };
  P.finishCraft = function (S, pl, r) {
    for (const [id, q] of r.ins) if (!P.consume(pl, id, q)) { DZ.UI && DZ.UI.toast('材料不足'); return; }
    for (const o of r.out) {
      if (o.id === '__campfire') { S.fires.push({ x: pl.x + Math.cos(pl.a) * C.TILE * 1.2, y: pl.y + Math.sin(pl.a) * C.TILE * 1.2, fuel: 240 }); DZ.UI && DZ.UI.toast('篝火已点燃'); }
      else if (o.id === '__raincol') { S.raincols.push({ x: pl.x + Math.cos(pl.a) * C.TILE * 1.2, y: pl.y + Math.sin(pl.a) * C.TILE * 1.2, water: 0 }); DZ.UI && DZ.UI.toast('雨水收集器已放置'); }
      else P.add(S, pl, IT.newInst(o.id, o.q));
    }
    if (r.sk) P.xp(S, pl, r.sk, 10);
    DZ.audio.playRaw('healDone');
    DZ.UI && DZ.UI.refreshPanels();
  };

  // ---------- 互动候选 ----------
  P.getInteracts = function (S, pl) {
    const out = [];
    const fx = pl.x + Math.cos(pl.a) * C.TILE * 0.95, fy = pl.y + Math.sin(pl.a) * C.TILE * 0.95;
    const pts = [[pl.x, pl.y], [fx, fy]];
    for (const [px, py] of pts) {
      const tx = px / C.TILE | 0, ty = py / C.TILE | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx, y = ty + dy;
        const t = W.tget(S, x, y), cx = (x + .5) * C.TILE, cy = (y + .5) * C.TILE;
        if (U.dist(px, py, cx, cy) > C.TILE * 1.35) continue;
        const key = x + ',' + y;
        const m = S.meta.get(key);
        if (t === T.DOOR) {
          if (!m.open && m.locked) {
            const cb = pl.inv.find(i => IT.def(i.id).mel && IT.def(i.id).mel.pry) || (pl.slots.melee && IT.def(pl.slots.melee.id).mel.pry ? pl.slots.melee : null);
            out.push({ id: 'door_locked', label: cb ? '撬锁 (E)' : '门锁住了', prio: 8, meta: m, hasTool: !!cb });
          } else out.push({ id: 'door', label: m.open ? '关门 (E)' : '开门 (E)', prio: 8, meta: m, key });
          if (m.boards > 0) out.push({ id: 'unboard', label: '拆木板 (' + m.boards + ') (E)', prio: 9, meta: m });
        } else if (t === T.WIN) {
          const opts = [];
          if (m.boards > 0) out.push({ id: 'unboard_w', label: '拆除木板 (' + m.boards + ') (E)', prio: 9, meta: m, x, y });
          else if (!m.broken) {
            out.push({ id: 'climbwin', label: '翻窗 (E)', prio: 7, meta: m, x, y });
            out.push({ id: 'curtain', label: m.curtain ? '拉开窗帘 (E)' : '拉上窗帘 (E)', prio: 6, meta: m });
            const canBoard = P.count(pl, 'plank') >= 1 && P.count(pl, 'nails') >= 4 && (P.count(pl, 'hammer') >= 1 || (pl.slots.melee && pl.slots.melee.id === 'hammer'));
            if (canBoard) out.push({ id: 'barricade_w', label: '钉木板加固 (E)', prio: 8, meta: m, x, y });
          }
        } else if (t === T.BED) out.push({ id: 'sleep', label: '睡觉 (E)', prio: 7 });
        else if (S.containers.has(key)) {
          const cont = S.containers.get(key);
          out.push({ id: 'loot', label: '搜刮' + (W.CONT_NAMES[cont.tid] || (cont.tid === '__trunk' ? '后备箱' : '柜子')) + ' (E)', prio: 9, cont });
        } else if (t === T.SINK) out.push({ id: 'water', label: '用水 (E)', prio: 7, x, y });
        else if (t === T.STOVE) out.push({ id: 'stove', label: S.powerOn ? '炉灶烹饪 (E)' : '炉灶没有电…', prio: 7, ok: S.powerOn, x, y });
        else if (t === T.PUMP) out.push({ id: 'pump', label: S.powerOn ? '加油泵灌装 (E)' : '电泵失效了…', prio: 8, ok: S.powerOn });
        else if (t === T.BARREL) out.push({ id: 'none', label: '危险！爆炸桶', prio: 1 });
        else if (t === T.BUSH) { const bush = S.bushes.find(b => b.tx === x && b.ty === y); if (!bush || bush.cd <= 0) out.push({ id: 'forage', label: '采集灌木 (E)', prio: 6, bush }); }
        else if (t === T.TREE) {
          const mel = pl.slots.melee && IT.def(pl.slots.melee.id).mel;
          out.push({ id: 'chop', label: mel && mel.chop ? '砍树 (E)' : '需要斧头才能砍树', prio: 5, ok: !!(mel && mel.chop), x, y });
        } else if (t === T.HELI) out.push({ id: 'evac', label: '撤离点 (E)', prio: 10 });
      }
    }
    // 尸体
    for (const c of S.corpses) {
      if (!c.searched && U.dist(pl.x, pl.y, c.x, c.y) < C.TILE * 1.4) out.push({ id: 'corpse', label: '搜刮尸体 (E)', prio: 9, corpse: c });
    }
    // 篝火/雨收集器
    for (const f of S.fires) if (U.dist(pl.x, pl.y, f.x, f.y) < C.TILE * 1.6) out.push({ id: 'campfire', label: '篝火 (E)', prio: 8, fire: f });
    for (const r of S.raincols) if (U.dist(pl.x, pl.y, r.x, r.y) < C.TILE * 1.6) out.push({ id: 'raincol', label: '雨水收集器 (' + r.water.toFixed(0) + ') (E)', prio: 8, rc: r });
    out.sort((a, b) => b.prio - a.prio);
    return out;
  };
  P.doInteract = function (S, pl, act) {
    switch (act.id) {
      case 'door': act.meta.open = !act.meta.open; DZ.audio.play(act.meta.open ? 'doorCreak' : 'doorSlam', pl.x, pl.y); break;
      case 'door_locked': if (act.hasTool) P.startAct(pl, 'prydoor', 4, { meta: act.meta }); else DZ.UI && DZ.UI.toast('需要撬棍'); break;
      case 'unboard': case 'unboard_w': P.startAct(pl, 'unboard', 3, { meta: act.meta }); break;
      case 'barricade_w': P.startAct(pl, 'barricade', 4, { meta: act.meta }); break;
      case 'curtain': act.meta.curtain = !act.meta.curtain; break;
      case 'climbwin': {
        const wx = act.x, wy = act.y;
        const nx = wx * C.TILE + C.TILE / 2 + (pl.x / C.TILE | 0) < wx ? -C.TILE : C.TILE;
        const horiz = W.tget(S, wx, wy - 1) === T.WEXT || W.tget(S, wx, wy - 1) === T.WIN || S.meta.get(wx + ',' + (wy - 1));
        const dirx = (pl.x / C.TILE | 0) <= wx ? 1 : -1;
        let ox = wx + dirx, oy = wy;
        const solid = W.solidFn(S);
        if (solid(wx, wy - 1) && !solid(wx, wy + 1)) { oy = wy + 1; ox = wx; } else if (solid(wx, wy + 1) && !solid(wx, wy - 1)) { oy = wy - 1; ox = wx; } else { ox = wx + dirx; }
        P.startAct(pl, 'climbwin', 2.2, { nx: (ox + .5) * C.TILE, ny: (oy + .5) * C.TILE });
        break;
      }
      case 'sleep': DZ.UI && DZ.UI.sleepDialog(); break;
      case 'loot': DZ.UI && DZ.UI.openContainer(act.cont); break;
      case 'water': {
        const opts = [];
        if (S.waterOn) {
          if (P.count(pl, 'bottleE') > 0) opts.push({ id: 'refill', label: '灌满水瓶' });
          opts.push({ id: 'drinkDirect', label: '直接喝水' });
        } else opts.push({ id: '__dry', label: '水管里只有空气…' });
        DZ.UI && DZ.UI.choiceDialog('用水', opts, sel => {
          if (sel === 'refill') P.startAct(pl, 'refill', 3, {});
          else if (sel === 'drinkDirect') P.startAct(pl, 'drinkDirect', 2, {});
        });
        break;
      }
      case 'stove': {
        if (!act.ok) { DZ.UI && DZ.UI.toast('停电了，炉灶打不着火'); break; }
        const raw = pl.inv.find(i => IT.def(i.id).food && IT.def(i.id).food.cookTo);
        if (!raw) { DZ.UI && DZ.UI.toast('没有可烹饪的食材'); break; }
        P.startAct(pl, 'cook', 6, { item: raw });
        break;
      }
      case 'pump':
        if (!act.ok) { DZ.UI && DZ.UI.toast('断电后油泵就是一块废铁'); break; }
        if (P.count(pl, 'gascanE') <= 0) { DZ.UI && DZ.UI.toast('需要空油桶'); break; }
        P.startAct(pl, 'fillgas', 6, {}); break;
      case 'forage': P.startAct(pl, 'forage', 5, { bush: act.bush }); break;
      case 'chop':
        if (!act.ok) { DZ.UI && DZ.UI.toast('装备斧头再来吧'); break; }
        P.startAct(pl, 'chop', 1.2, { hits: 3, tx: act.x, ty: act.y }); break;
      case 'corpse': DZ.UI && DZ.UI.openContainer({ tid: '__corpse', items: act.corpse.loot, _corpse: act.corpse }); break;
      case 'campfire': {
        const raw = pl.inv.find(i => IT.def(i.id).food && IT.def(i.id).food.cookTo);
        const opts = [];
        if (raw) opts.push({ id: 'cook', label: '烹饪 ' + IT.name(raw.id) });
        opts.push({ id: 'warm', label: '烤火取暖（烘干衣物）' });
        DZ.UI && DZ.UI.choiceDialog('篝火', opts, sel => {
          if (sel === 'cook') P.startAct(pl, 'cook', 6, { item: raw });
          else if (sel === 'warm') P.startAct(pl, 'warmup', 4, {});
        });
        break;
      }
      case 'raincol': {
        if (act.rc.water < 1) { DZ.UI && DZ.UI.toast('收集器里还没攒够水'); break; }
        const opts = [];
        if (P.count(pl, 'bottleE') > 0) opts.push({ id: 'refill', label: '灌满水瓶' });
        opts.push({ id: 'drinkDirect', label: '直接喝' });
        DZ.UI && DZ.UI.choiceDialog('雨水收集器', opts, sel => {
          if (sel === 'refill') P.startAct(pl, 'refillRain', 3, { rc: act.rc });
          else if (sel === 'drinkDirect') { act.rc.water--; P.startAct(pl, 'drinkDirect', 2, {}); }
        });
        break;
      }
      case 'evac': DZ.main && DZ.main.tryEvac(); break;
    }
  };

  // ---------- 睡眠 ----------
  P.startSleep = function (S, pl, hours) {
    S.sleeping = { left: hours * 60, targetMins: pl._minsTotal + hours * 60 };
    DZ.UI && DZ.UI.toast('你躺下了…（噪音会惊醒你）');
  };

  // ---------- 主更新 ----------
  P.update = function (S, pl, dt, input) {
    if (pl.dead) return;
    const gameMin = dt / C.RSPM;
    pl._mins = S.mins; pl._minsTotal = S.totalMins;
    // 翻滚
    if (pl.rolling > 0) {
      pl.rolling -= dt;
      const spd = 8.2 * C.TILE;
      const solid = W.solidFn(S);
      const [nx, ny] = U.moveCircle(pl.x, pl.y, Math.cos(pl.rollA) * spd * dt, Math.sin(pl.rollA) * spd * dt, 0.3 * C.TILE, solid);
      pl.x = nx; pl.y = ny;
    } else if (!pl.grabbedBy && !S.sleeping) {
      let mx = input.mx, my = input.my;
      const ml = Math.hypot(mx, my);
      if (ml > 0.01 && (!pl.act || pl.act.type === 'chop')) {
        mx /= ml; my /= ml;
        const sp = P.speed(pl);
        const solid = W.solidFn(S);
        const [nx, ny] = U.moveCircle(pl.x, pl.y, mx * sp * C.TILE * dt, my * sp * C.TILE * dt, 0.3 * C.TILE, solid);
        pl.x = nx; pl.y = ny;
        pl.walkPhase += dt * sp * 1.6;
        pl.stepT -= dt * sp;
        if (pl.stepT <= 0) {
          pl.stepT = 1.1;
          const run = pl.wantRun && !pl.crouch;
          DZ.audio.play('step', pl.x, pl.y, { run });
          DZ.CB.noise(S, pl.x, pl.y, run ? C.NOISE.runStep : pl.crouch ? C.NOISE.crouchStep : C.NOISE.walkStep, 'player');
        }
        if (ml > 0.01 && pl.act && pl.act.type !== 'chop') pl.act = null; // 走动打断动作
      }
    }
    // 面向
    if (input.aimX != null) pl.a = Math.atan2(input.aimY - pl.y, input.aimX - pl.x);
    pl.crouch = !!input.crouch; pl.aiming = !!input.rmb && !(!pl.slots.primary);
    // 计时动作
    if (pl.act) {
      pl.act.t += dt;
      if (pl.act.type === 'chop') { /* chop 自循环 */ }
      if (pl.act.t >= pl.act.total) {
        const done = ACT_DONE[pl.act.type];
        const a = pl.act; pl.act = null;
        if (done) done(S, pl, a.data);
      }
    }
    // 枪械计时
    if (pl.fireT > 0) pl.fireT -= dt;
    if (pl.swingT > 0) pl.swingT -= dt;
    if (pl.reloadT > 0) {
      pl.reloadT -= dt;
      if (pl.reloadT <= 0) P.finishReload(pl);
    }
    // 挣脱
    if (pl.grabbedBy) {
      const z = pl.grabbedBy;
      if (z.dead || U.dist(pl.x, pl.y, z.x, z.y) > C.TILE * 1.5) pl.grabbedBy = null;
    }
    // 状态衰减 (gameMin)
    const prof = IT.PROFS.find(p => p.id === pl.prof) || {};
    pl.hunger = U.clamp(pl.hunger - gameMin * C.RATE.hunger * (prof.hungerMul || 1), 0, 100);
    pl.thirst = U.clamp(pl.thirst - gameMin * C.RATE.thirst, 0, 100);
    if (S.sleeping) pl.fatigue = U.clamp(pl.fatigue + gameMin * C.RATE.fatigueSleep, 0, 100);
    else pl.fatigue = U.clamp(pl.fatigue - gameMin * C.RATE.fatigueAwake, 0, 100);
    if (pl.painMaskH > 0) pl.painMaskH -= gameMin / 60;
    if (pl.betaH > 0) pl.betaH -= gameMin / 60;
    if (pl.vitH > 0) pl.vitH -= gameMin / 60;
    // 体力
    const moving = input.mx || input.my;
    if (pl.wantRun && moving && !pl.crouch) pl.stamina = U.clamp(pl.stamina - C.STAMINA.runDrain * dt * (1 - (pl.sk.fitness.lv - 1) * 0.07), 0, 100);
    else pl.stamina = U.clamp(pl.stamina + (moving ? C.STAMINA.regenWalk : C.STAMINA.regenIdle) * dt * (1 + (pl.sk.fitness.lv - 1) * C.STAMINA.regenFit), 0, 100);
    // 流血 & 恢复
    for (const pid in pl.body) {
      const bp = pl.body[pid];
      if (bp.bleed > 0) {
        bp.hp -= bp.bleed * C.WOUND.bleedScratch * 10 * gameMin;
        if (Math.random() < gameMin * 0.004) { bp.bleed--; DZ.UI && DZ.UI.toast('血止住了一些'); }
        if (bp.hp <= -10 && (pid === 'head' || pid === 'torso')) { P.die(S, pl, '失血过多'); }
        else if (bp.hp <= -10) { bp.hp = -10; bp.frac = true; }
      } else if (bp.bandagedT > 0) {
        bp.bandagedT -= gameMin;
        bp.hp = Math.min(bp.max, bp.hp + gameMin * 0.12);
      } else if (bp.hp > 0 && bp.hp < bp.max && pl.hunger > 25 && pl.thirst > 25) {
        bp.hp = Math.min(bp.max, bp.hp + gameMin * (0.05 + (pl.vitH > 0 ? 0.05 : 0)));
      }
    }
    // 感染
    if (pl.zv >= 0) {
      pl.zv -= gameMin;
      if (pl.zv <= 0) P.die(S, pl, '病毒转化——你成了它们的一员');
    }
    if (pl.bact >= 0) {
      pl.bact -= gameMin;
      if (pl.bact <= 0) { pl.bact = -1; DZ.UI && DZ.UI.toast('细菌感染自愈了'); }
    }
    // 湿度
    const outdoor = S.room[S.tiles ? (pl.y / C.TILE | 0) * C.MW + (pl.x / C.TILE | 0) : 0] == null || S.room[(pl.y / C.TILE | 0) * C.MW + (pl.x / C.TILE | 0)] < 0;
    const raining = S.weather.cur === 'rain' || S.weather.cur === 'storm';
    const jkt = gearOf(pl, 'jacket');
    if (outdoor && raining) pl.wet = U.clamp(pl.wet + gameMin * 1.6 * (1 - (jkt.wetRes || 0)), 0, 100);
    else pl.wet = U.clamp(pl.wet - gameMin * 0.5, 0, 100);
    for (const f of S.fires) if (U.dist(pl.x, pl.y, f.x, f.y) < C.TILE * 2.5) pl.wet = U.clamp(pl.wet - gameMin * 3, 0, 100);
    // 恐慌衰减
    if (pl.betaH > 0) pl.panic = Math.max(0, pl.panic - gameMin * 4);
    else pl.panic = Math.max(0, pl.panic - gameMin * 0.8);
    // 手电电量
    if (pl.flashlight) {
      const fl = pl.inv.find(i => i.id === 'flashlight');
      if (!fl || fl.batt <= 0) { pl.flashlight = false; DZ.UI && DZ.UI.toast('手电没电了'); }
      else fl.batt -= gameMin * 0.09;
    }
    if (pl.nv) {
      const nv = pl.inv.find(i => i.id === 'nv');
      if (!nv || nv.batt <= 0) { pl.nv = false; DZ.UI && DZ.UI.toast('夜视仪电量耗尽'); }
      else nv.batt -= gameMin * 0.14;
    }
    // 饥渴归零伤害
    if (pl.hunger <= 0) P.applyDamage(S, pl, 'torso', gameMin * 0.35, 'starve'), pl.deadCause = pl.deadCause || '';
    if (pl.thirst <= 0) P.applyDamage(S, pl, 'torso', gameMin * 0.5, 'thirst');
    if (pl.dead && !pl.deadCause) pl.deadCause = '饥渴交加而终';
    // 灌木冷却
    for (const b of S.bushes) if (b.cd > 0) b.cd -= gameMin;
  };
  P.beginReload = function (pl) {
    const gun = pl.slots.primary;
    if (!gun || pl.reloadT > 0) return false;
    const g = C.GUNS[IT.def(gun.id).gun];
    if (gun.loaded >= g.mag) return false;
    if (P.count(pl, g.ammo) <= 0) { DZ.audio.playRaw('dryfire'); DZ.UI && DZ.UI.toast('没有 ' + IT.name(g.ammo)); return false; }
    pl.reloadT = g.reload * Math.max(0.45, 1 - (pl.sk.reload.lv - 1) * 0.08);
    DZ.audio.playRaw('reload');
    return true;
  };
  P.finishReload = function (pl) {
    const gun = pl.slots.primary; if (!gun) return;
    const g = C.GUNS[IT.def(gun.id).gun];
    const need = g.mag - gun.loaded;
    const got = Math.min(need, P.consume(pl, g.ammo, need));
    gun.loaded += got;
    P.xp(null, pl, 'reload', 4);
  };
  // 睡眠推进（main 循环调用）
  P.updateSleep = function (S, pl, dt) {
    if (!S.sleeping) return;
    const gameMin = dt * C.SLEEP_SPEED / C.RSPM;
    S.totalMins += gameMin; S.mins = S.totalMins % 1440;
    P.update(S, pl, dt * C.SLEEP_SPEED, { mx: 0, my: 0, aimX: pl.x, aimY: pl.y });
    S.sleeping.left -= gameMin;
    // 噪音惊醒
    for (const n of S.noises) {
      if (n.loud && U.dist(n.x, n.y, pl.x, pl.y) < n.r * 0.6) { S.sleeping = null; DZ.UI && DZ.UI.toast('你被响动惊醒了！'); return; }
    }
    if (pl.body.torso.bleed > 1 || pl.panic > 70) { S.sleeping = null; DZ.UI && DZ.UI.toast('你睡不安稳，醒了。'); }
    if (S.sleeping && S.sleeping.left <= 0) {
      S.sleeping = null;
      for (const pid in pl.body) pl.body[pid].hp = Math.min(pl.body[pid].max, pl.body[pid].hp + 6);
      pl.fatigue = Math.min(100, pl.fatigue + 30);
      DZ.UI && DZ.UI.toast('你醒来了。新的一天。');
    }
  };
  DZ.P = P;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
