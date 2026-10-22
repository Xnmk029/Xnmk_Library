// ============================================================
// systems.js — 硬核生存模拟（僵毁底层架构的鸭科夫化实现）
// 部位伤病 / Moodle / 双重感染 / 技能XP / 噪音 / 天气时间
// ============================================================
'use strict';
const Sys = {};

// ==================== 健康：部位 × 伤病 ====================
Sys.Health = {
  PARTS: {
    head: { nm: '头部', w: 0.22 }, torso: { nm: '躯干', w: 0.32 },
    larm: { nm: '左臂', w: 0.09 }, rarm: { nm: '右臂', w: 0.09 },
    lleg: { nm: '左腿', w: 0.14 }, rleg: { nm: '右腿', w: 0.14 }
  },
  initParts(p) {
    p.parts = {};
    for (const k in this.PARTS) p.parts[k] = { hp: 100, max: 100, bleed: 0, bandaged: false, dirty: false, fracture: false, infection: 0, splint: false };
  },
  overall(p) {
    let s = 0;
    for (const k in this.PARTS) s += this.PARTS[k].w * U.clamp(p.parts[k].hp, 0, 100);
    return s;
  },
  injuredParts(p) { return Object.keys(this.PARTS).filter(k => p.parts[k].hp < 99.5 || p.parts[k].bleed > 0 || p.parts[k].fracture || p.parts[k].infection > 0); },
  painLevel(p) {
    let s = 0;
    for (const k in this.PARTS) {
      const pt = p.parts[k];
      s += Math.max(0, (60 - pt.hp) / 60) * 1.5 + pt.fracture * 1.2 + pt.infection * 1.5;
    }
    return U.clamp(Math.floor(s), 0, 4);
  },
  legFactor(p) {
    let f = 1;
    for (const k of ['lleg', 'rleg']) {
      const pt = p.parts[k];
      if (pt.fracture && !pt.splint) f = Math.min(f, 0.42);
      else if (pt.fracture) f = Math.min(f, 0.75);
      if (pt.hp < 30) f = Math.min(f, 0.7);
    }
    return f;
  },
  armFactor(p) {
    let f = 1;
    for (const k of ['larm', 'rarm']) {
      const pt = p.parts[k];
      if (pt.fracture && !pt.splint) f = Math.min(f, 0.55);
      if (pt.hp < 30) f = Math.min(f, 0.8);
    }
    return f;
  },
  // 鸭尸攻击 → 抓伤/撕裂/咬伤 + 出血 + 感染判定
  zombieHit(p, z) {
    if (p.dodgeT > 0) { FX.text(p.x, p.y - 20, '闪避!', '#7ce8d8'); return; }
    const armor = p.equip.body ? DB.it(p.equip.body.id).cls : 0;
    const headArmor = p.equip.head ? DB.it(p.equip.head.id).cls : 0;
    const part = U.wpick([['head', 8], ['torso', 34], ['larm', 13], ['rarm', 13], ['lleg', 16], ['rleg', 16]]);
    let dmg = z.d.dmg * (0.8 + Math.random() * 0.5);
    const cls = part === 'head' ? headArmor : armor;
    if (cls > 0) dmg *= Math.max(0.15, 2 / (cls + 2));
    if (U.chance(0.35 - cls * 0.05)) { FX.text(p.x, p.y - 22, '格挡', '#9ab8d8'); this.hit(p, part, dmg * 0.4, 'zombie'); return; }
    this.hit(p, part, dmg, 'zombie');
    // 伤情类型
    const roll = Math.random();
    let type = roll < 0.55 ? 'scratch' : roll < 0.87 ? 'laceration' : 'bite';
    this.addInjury(p, part, type, z.d.nm, z.d.infect);
    FX.shake(3 + dmg * 0.15);
  },
  addInjury(p, part, type, cause, infect = { scratch: 0.07, laceration: 0.25, bite: 1.0 }) {
    const pt = p.parts[part];
    const guard = p.mods.guard || 1;
    const labSuit = p.equip.body && DB.it(p.equip.body.id).inf ? DB.it(p.equip.body.id).inf : 1;
    if (type === 'scratch') { pt.bleed = Math.max(pt.bleed, 0.35); }
    if (type === 'laceration') { pt.bleed = Math.max(pt.bleed, 1.1); pt.hp -= 6; }
    if (type === 'bite') { pt.bleed = Math.max(pt.bleed, 1.8); pt.hp -= 14; UI.toast('你被咬了！', 'bad'); }
    if (type === 'fracture') { pt.fracture = true; }
    // 伤口感染（细菌）与克诺克斯（病毒）判定
    const risk = infect[type] * guard * labSuit;
    if (U.chance(risk)) {
      if (p.sick.knox < 0) {
        p.sick.knox = U.ri(900, 1500); // 潜伏期（游戏分钟）
        p.sick.knoxFrom = cause + '的' + (type === 'bite' ? '咬伤' : type === 'laceration' ? '撕裂伤' : '抓伤');
      }
    }
    if (U.chance(0.3 * guard)) pt.infection = Math.max(pt.infection, 0.05);
    void cause;
  },
  hit(p, part, dmg, src, pen = 0) {
    const cls = part === 'head' && p.equip.head ? DB.it(p.equip.head.id).cls : (p.equip.body ? DB.it(p.equip.body.id).cls : 0);
    if (src === 'bullet' && cls > 0) dmg = DB.dmgFormula(dmg, cls, pen);
    else if (src === 'zombie' && cls > 0) dmg *= Math.max(0.15, 2 / (cls + 2));
    p.parts[part].hp = Math.max(0, p.parts[part].hp - dmg);
    FX.text(p.x + U.rf(-8, 8), p.y - 26, '-' + Math.round(dmg), '#ff7a6a');
    if (this.overall(p) <= 0) Game.die(src === 'zombie' ? '被鸭尸撕碎了' : src === 'bullet' ? '中弹身亡' : src === 'boss' ? '死于 Boss 之手' : '伤重不治');
  },
  healPart(p, part, amt) {
    const pt = p.parts[part];
    pt.hp = Math.min(pt.max, pt.hp + amt);
  },
  // 每 game-minute tick
  tick(p, dt) {
    if (p.dead) return;
    const healMul = (p.mods.healMul || 1) * (1 + Sys.Skills.lvl(p, 'firstaid') * 0.03);
    for (const k in this.PARTS) {
      const pt = p.parts[k];
      // 出血
      if (pt.bleed > 0 && !pt.bandaged) {
        pt.hp -= pt.bleed * dt * 0.5;
        p.needs.stress = Math.min(100, p.needs.stress + dt * 0.02);
        if (U.chance(dt * pt.bleed * 0.05)) G.ground.push({ x: p.x + U.rf(-6, 6), y: p.y + U.rf(-6, 6), blood: true });
      }
      // 绷带时效 & 变脏
      if (pt.bandaged) {
        pt.bandT -= dt;
        if (pt.bandT <= 0) { pt.bandaged = false; pt.dirty = true; }
        else if (U.chance(dt * 0.002)) pt.dirty = true;
        pt.hp = Math.min(pt.max, pt.hp + dt * 0.06 * healMul);
      } else if (pt.bleed <= 0 && pt.hp < pt.max && pt.fracture === false) {
        pt.hp = Math.min(pt.max, pt.hp + dt * 0.02 * healMul); // 自然愈合
      }
      // 伤口感染恶化
      if (pt.infection > 0) {
        if (pt.dirty) pt.infection = Math.min(1, pt.infection + dt * 0.0012);
        pt.hp -= pt.infection * dt * 0.03;
        if (pt.infection > 0.5) p.needs.stress = Math.min(100, p.needs.stress + dt * 0.01);
      }
      if (pt.hp <= 0 && this.overall(p) <= 0) Game.die(pt.infection > 0.5 ? '死于伤口感染引发的败血症' : '流血过多而亡');
    }
    // 克诺克斯病毒（无解 · 僵毁 canon）
    if (p.sick.knox > 0) {
      p.sick.knox -= dt;
      if (p.sick.knox < 300) p.parts.torso.hp -= dt * 0.05;
      if (p.sick.knox <= 0) Game.die('克诺克斯病毒发作（感染源：' + (p.sick.knoxFrom || '不明') + '）');
    }
    // 极端饥渴伤害
    if (p.needs.hunger <= 0) p.parts.torso.hp -= dt * 0.02;
    if (p.needs.thirst <= 0) p.parts.torso.hp -= dt * 0.05;
    if (this.overall(p) <= 0 && !p.dead) Game.die(p.needs.thirst <= 0 ? '活活渴死' : p.needs.hunger <= 0 ? '活活饿死' : '身体耗尽而亡');
  },
  // 治疗（UI 调用）
  treat(p, part, item) {
    const pt = p.parts[part], d = DB.it(item.id), use = d.use;
    if (!use) return false;
    const fa = Sys.Skills.lvl(p, 'firstaid');
    if (use.type === 'bandage') {
      if (pt.bleed <= 0 && pt.hp > 95) { UI.toast('该部位不需要包扎', 'info'); return false; }
      Ent.removeItem(p, item.uid, 1);
      pt.bleed = 0; pt.bandaged = true; pt.bandT = 600 * (0.7 + use.power); pt.dirty = false;
      if (use.clean) pt.infection = Math.max(0, pt.infection - 0.4);
      Sys.Skills.xp(p, 'firstaid', 2);
      UI.toast(this.PARTS[part].nm + ' 已包扎', 'good');
      return true;
    }
    if (use.type === 'disinfect') {
      if (pt.infection <= 0) { UI.toast('该部位没有感染迹象', 'info'); return false; }
      Ent.removeItem(p, item.uid, 1);
      pt.infection = Math.max(0, pt.infection - 0.5 - fa * 0.05);
      Sys.Skills.xp(p, 'firstaid', 3);
      UI.toast(this.PARTS[part].nm + ' 已消毒', 'good');
      return true;
    }
    return false;
  }
};

// ==================== 需求 / Moodle ====================
Sys.Needs = {
  tick(p, dt) {
    const n = p.needs;
    const rate = 1; // 每 game-min
    n.hunger = U.clamp(n.hunger - dt * 0.045, 0, 100);
    n.thirst = U.clamp(n.thirst - dt * 0.07, 0, 100);
    n.fatigue = U.clamp(n.fatigue + dt * 0.028 + (p.sprinting ? dt * 0.05 : 0), 0, 100);
    n.boredom = U.clamp(n.boredom + dt * 0.02 * (p.moving ? 0.5 : 1.4), 0, 100);
    if (n.boredom > 70) n.happy = U.clamp(n.happy - dt * 0.01, 0, 100);
    // 压力：黑暗 / 伤病 / 老烟枪
    let stressUp = 0;
    if (G.ambient < 0.4) stressUp += 0.012;
    if (Sys.Health.injuredParts(p).length) stressUp += 0.008;
    if (p.mods.smoker) stressUp += 0.014;
    if (p.sick.knox > 0 && p.sick.knox < 500) stressUp += 0.05;
    n.stress = U.clamp(n.stress + dt * stressUp - dt * 0.004, 0, 100);
    if (n.stress > 75) n.happy = U.clamp(n.happy - dt * 0.012, 0, 100);
    // 淋湿 & 寒冷（雨/风暴，室内与雨衣免疫）
    const raining = G.raid && G.raid.weather && (G.raid.weather.type === 'rain' || G.raid.weather.type === 'storm');
    const indoor = G.world.indoor[G.world.idx(Math.floor(p.x / 32), Math.floor(p.y / 32))] === 1;
    const raincoat = p.equip.body && DB.it(p.equip.body.id).rain;
    if (raining && !indoor && !raincoat) n.wet = U.clamp(n.wet + dt * 0.5, 0, 100);
    else n.wet = U.clamp(n.wet - dt * 0.2, 0, 100);
    // 流感
    const cold = n.wet > 55 && G.ambient < 0.5;
    if (cold && U.chance(dt * 0.0008) && p.sick.flu <= 0) { p.sick.flu = 400; UI.toast('你着凉了……', 'bad'); }
    if (p.sick.flu > 0) {
      p.sick.flu -= dt * (Ent.countItem(p, 'm_antibio') > 0 && U.chance(0) ? 2 : 1);
      n.fatigue = U.clamp(n.fatigue + dt * 0.02, 0, 100);
      if (U.chance(dt * 0.02)) { UI.toast('阿嚏！！', 'bad'); Sys.Noise.emit(p.x, p.y, 9 * 32, 'sneeze'); }
      if (p.sick.flu <= 0) UI.toast('感冒痊愈了', 'good');
    }
    // 食物中毒
    if (p.sick.food > 0) {
      p.sick.food -= dt * 0.004;
      p.needs.happy = U.clamp(p.needs.happy - dt * 0.02, 0, 100);
      if (U.chance(dt * 0.05)) p.needs.hunger = Math.max(0, p.needs.hunger - 0.5);
    }
    Sys.Health.tick(p, dt);
  },
  updatePanic(p, dt) {
    let near = 0;
    for (const z of G.zombies) {
      if (z.hp <= 0 || z.state !== 'chase') continue;
      const d = U.dist(z.x, z.y, p.x, p.y);
      if (d < 12 * 32) near += (12 * 32 - d) / (12 * 32);
    }
    const up = near * dt * 2.4 * (p.mods.panicMul ?? 1);
    p.panic = U.clamp(p.panic + up - dt * 3.2, 0, 100);
  },
  onKill(p) {
    p.needs.boredom = Math.max(0, p.needs.boredom - 6);
    p.needs.stress = Math.max(0, p.needs.stress - 1.5);
  },
  // Moodle 列表（HUD）：lv 1-4 恶化方向
  moodles(p) {
    const m = [];
    const add = (id, lv, nm, desc) => { if (lv > 0) m.push({ id, lv, nm, desc }); };
    const n = p.needs;
    add('hunger', n.hunger < 12 ? 4 : n.hunger < 28 ? 3 : n.hunger < 50 ? 2 : n.hunger < 72 ? 1 : 0, '饥饿', '吃点东西。生肉风险大，烤熟更佳。');
    add('thirst', n.thirst < 12 ? 4 : n.thirst < 28 ? 3 : n.thirst < 50 ? 2 : n.thirst < 72 ? 1 : 0, '口渴', '饮水。浑水需净水药片处理。');
    add('fatigue', n.fatigue > 88 ? 4 : n.fatigue > 70 ? 3 : n.fatigue > 50 ? 2 : n.fatigue > 32 ? 1 : 0, '疲惫', '撤离后回藏身处休息。咖啡可应急。');
    add('panic', p.panic > 75 ? 4 : p.panic > 50 ? 3 : p.panic > 28 ? 2 : p.panic > 10 ? 1 : 0, '恐慌', '太多鸭尸！射击散布扩大、操作变形。');
    add('stress', n.stress > 75 ? 4 : n.stress > 50 ? 3 : n.stress > 30 ? 2 : n.stress > 15 ? 1 : 0, '压力', '抽烟/啤酒/巧克力可缓解。影响准度与体力。');
    add('pain', p.painT > 0 ? 0 : Sys.Health.painLevel(p), '疼痛', '止痛药可压制 5 小时。影响移速与挥击。');
    add('bored', n.boredom > 75 ? 3 : n.boredom > 50 ? 2 : n.boredom > 30 ? 1 : 0, '无聊', '杀鸭/阅读可打发时间。');
    add('unhappy', n.happy < 25 ? 3 : n.happy < 45 ? 2 : n.happy < 65 ? 1 : 0, '不开心', '吃顿好的（熟食/巧克力/汽水）。');
    let sick = 0;
    if (p.sick.knox > 0) sick = p.sick.knox < 400 ? 4 : p.sick.knox < 700 ? 3 : 2;
    else if (p.sick.food > 0.3) sick = 2; else if (p.sick.food > 0) sick = 1;
    else if (p.sick.flu > 0) sick = 2;
    add('sick', sick, p.sick.knox > 0 && p.sick.knox < 500 ? '发热·?？' : '恶心', '你感觉不太对劲……');
    let bleed = 0;
    for (const k in Sys.Health.PARTS) if (p.parts[k].bleed > 0 && !p.parts[k].bandaged) bleed = Math.max(bleed, p.parts[k].bleed > 1.4 ? 3 : p.parts[k].bleed > 0.7 ? 2 : 1);
    add('bleed', bleed, '流血', '绷带止血！持续掉血。');
    let frac = 0;
    for (const k in Sys.Health.PARTS) if (p.parts[k].fracture) frac = Math.max(frac, p.parts[k].splint ? 1 : 3);
    add('fracture', frac, '骨折', '夹板固定，手术包复位。');
    let bandd = 0;
    for (const k in Sys.Health.PARTS) if (p.parts[k].bandaged) bandd = 1;
    add('bandaged', bandd, '已包扎', '绷带生效中（会逐渐变脏）。');
    let inf = 0;
    for (const k in Sys.Health.PARTS) inf = Math.max(inf, p.parts[k].infection > 0.5 ? 3 : p.parts[k].infection > 0.15 ? 2 : p.parts[k].infection > 0 ? 1 : 0);
    add('infected', inf, '伤口感染', '酒精消毒 + 抗生素。');
    add('wet', n.wet > 70 ? 3 : n.wet > 40 ? 2 : n.wet > 15 ? 1 : 0, '淋湿', '雨天室外会淋湿，可能着凉。');
    add('cold', p.sick.flu > 0 ? 2 : 0, '感冒', '阿嚏！喷嚏会引来鸭尸。');
    add('drunk', p.drunkT > 60 ? 2 : p.drunkT > 0 ? 1 : 0, '醉酒', '走路画圈，准度下降。');
    add('buff_wt', p.syrWtT > 0 ? 1 : 0, '负重针', '负重上限 +12kg。');
    add('buff_pk', p.painT > 0 ? 1 : 0, '止痛生效', '疼痛已被压制。');
    add('buff_syr', p.syrHotT > 0 ? 1 : 0, '恢复针', '持续回血中。');
    add('overweight', Ent.weight(p) > Ent.capacity(p) ? 2 : 0, '超重', '移速大幅下降！丢点东西吧。');
    return m;
  }
};

// ==================== 技能 XP ====================
Sys.Skills = {
  LIST: ['fitness', 'strength', 'sprint', 'blade', 'blunt', 'spear', 'aiming', 'reloading', 'carpentry', 'firstaid', 'sneaking', 'foraging', 'cooking'],
  NM: { fitness: '体质', strength: '力量', sprint: '短跑', blade: '刀刃', blunt: '钝器', spear: '长柄', aiming: '枪法', reloading: '装填', carpentry: '木工', firstaid: '急救', sneaking: '潜行', foraging: '搜集', cooking: '烹饪' },
  xpForLevel(lv) { let x = 0; for (let i = 0; i < lv; i++) x += 60 + i * 30; return x; },
  lvl(p, skill) {
    const xp = p.xp[skill] || 0;
    let lv = 0, acc = 0, need = 0;
    while (lv < 10) { need = 60 + lv * 30; if (xp < acc + need) break; acc += need; lv++; }
    return lv;
  },
  xpProgress(p, skill) {
    const xp = p.xp[skill] || 0, lv = this.lvl(p, skill);
    const acc = this.xpForLevel(lv), need = 60 + lv * 30;
    return { lv, pct: U.clamp((xp - acc) / need, 0, 1) };
  },
  xp(p, skill, amt) {
    const old = this.lvl(p, skill);
    p.xp[skill] = (p.xp[skill] || 0) + amt;
    const nw = this.lvl(p, skill);
    if (nw > old && nw >= 2) UI.toast('▲ ' + this.NM[skill] + ' 达到 Lv.' + nw, 'good');
  }
};

// ==================== 噪音传播 ====================
Sys.Noise = {
  emit(x, y, r, kind) {
    if (kind === 'walk' || kind === 'sneak' || kind === 'run') {
      // 移动噪音不需要每帧广播全图 —— 概率采样
      if (!U.chance(0.06)) return;
    }
    for (const z of G.zombies) {
      if (z.hp <= 0 || z.state === 'chase') continue;
      const d = U.dist(z.x, z.y, x, y);
      if (d > r) continue;
      const p = 1 - d / r;
      if (U.chance(p * (kind === 'scream' ? 1 : 0.75))) {
        z.state = 'investigate'; z.target = { x: x + U.rf(-20, 20), y: y + U.rf(-20, 20) }; z.stateT = 0;
      }
    }
    if (r > 40 * 32 * 0.5) { /* 大动静 */ }
  }
};

// ==================== 物品使用 ====================
Sys.useItem = function (p, it, hbIdx) {
  const d = DB.it(it.id);
  if (!d) return;
  const n = p.needs;
  if (d.cat === 'food' && d.eat) {
    const e = d.eat;
    n.hunger = U.clamp(n.hunger + e.hunger, 0, 100);
    if (e.thirst) n.thirst = U.clamp(n.thirst + e.thirst, 0, 100);
    if (e.happy) n.happy = U.clamp(n.happy + e.happy, 0, 100);
    if (e.fatigue) n.fatigue = U.clamp(n.fatigue + e.fatigue, 0, 100);
    if (e.fit) { Sys.Skills.xp(p, 'fitness', 30); UI.toast('蛋白粉下肚，充血！', 'good'); }
    if (e.raw || e.poison) {
      const risk = (e.poison || 0.3) * (p.mods.gut ?? 1) * (Sys.Skills.lvl(p, 'cooking') > 3 && !e.raw ? 0.5 : 1);
      if (U.chance(risk)) { p.sick.food = Math.min(1, (p.sick.food || 0) + 0.5); UI.toast('肚子一阵绞痛……食物中毒！', 'bad'); }
    }
    Ent.removeItem(p, it.uid, 1);
    UI.toast('吃掉了 ' + d.nm, 'info');
  } else if (d.cat === 'drink' && d.drink) {
    const e = d.drink;
    n.thirst = U.clamp(n.thirst + e.thirst, 0, 100);
    if (e.happy) n.happy = U.clamp(n.happy + e.happy, 0, 100);
    if (e.stress != null) n.stress = U.clamp(n.stress + e.stress, 0, 100);
    if (e.fatigue) n.fatigue = U.clamp(n.fatigue + e.fatigue, 0, 100);
    if (e.sick && U.chance(e.sick * (p.mods.gut ?? 1))) { p.sick.food = 0.4; UI.toast('这水有问题……', 'bad'); }
    if (e.drunk) p.drunkT = 90;
    Ent.removeItem(p, it.uid, 1);
    UI.toast('喝掉了 ' + d.nm, 'info');
  } else if (d.cat === 'med' && d.use) {
    const u = d.use;
    if (u.type === 'bandage' || u.type === 'disinfect') {
      // 自动选最差部位
      let worst = null, ws = -1;
      for (const k in Sys.Health.PARTS) {
        const pt = p.parts[k];
        const s = pt.bleed * 10 + pt.infection * 5 + (100 - pt.hp) * 0.1 + (u.type === 'disinfect' ? pt.infection * 20 : 0);
        if (s > ws) { ws = s; worst = k; }
      }
      Sys.Health.treat(p, worst, it);
      return;
    }
    if (u.type === 'painkiller') { Ent.removeItem(p, it.uid, 1); p.painT = u.t; UI.toast('止痛药生效（5小时）', 'good'); return; }
    if (u.type === 'antibio') {
      Ent.removeItem(p, it.uid, 1);
      let any = false;
      for (const k in Sys.Health.PARTS) if (p.parts[k].infection > 0) { p.parts[k].infection = Math.max(0, p.parts[k].infection - 0.4); any = true; }
      if (p.sick.flu > 0) p.sick.flu -= 120;
      UI.toast(any ? '感染有所缓解' : '服下抗生素（预防性）', 'good'); return;
    }
    if (u.type === 'splint') {
      let worst = null;
      for (const k of ['lleg', 'rleg', 'larm', 'rarm']) if (p.parts[k].fracture && !p.parts[k].splint) { worst = k; break; }
      if (!worst) { UI.toast('没有需要固定的骨折', 'info'); return; }
      Ent.removeItem(p, it.uid, 1);
      p.parts[worst].splint = true;
      Sys.Skills.xp(p, 'firstaid', 4);
      UI.toast(Sys.Health.PARTS[worst].nm + ' 已用夹板固定（移速部分恢复）', 'good'); return;
    }
    if (u.type === 'medkit' || u.type === 'surgery') {
      p.action = { t: 0, dur: u.t, label: d.nm + ' 治疗（保持静止）', moveOK: false, done: () => {
        Ent.removeItem(p, it.uid, 1);
        if (u.type === 'medkit') { for (const k in Sys.Health.PARTS) Sys.Health.healPart(p, k, u.power); UI.toast('生命大幅恢复', 'good'); }
        else {
          for (const k in Sys.Health.PARTS) { const pt = p.parts[k]; pt.fracture = false; pt.splint = false; pt.max = Math.min(100, pt.max + 15); Sys.Health.healPart(p, k, 25); }
          UI.toast('手术成功：骨折复位，部位上限修复', 'good');
        }
        Sys.Skills.xp(p, 'firstaid', 6);
      } };
      return;
    }
    if (u.type === 'syringe') { Ent.removeItem(p, it.uid, 1); p.syrHotT = 20; UI.toast('恢复针：移动中持续回血 20 秒', 'good'); return; }
    if (u.type === 'syringeWt') { Ent.removeItem(p, it.uid, 1); p.syrWtT = 60; UI.toast('负重针：+12kg 上限（10 分钟）', 'good'); return; }
    if (u.type === 'smoke') {
      if (Ent.countItem(p, 't_lighter') < 1) { UI.toast('没有打火机', 'bad'); return; }
      Ent.removeItem(p, it.uid, 1);
      n.stress = Math.max(0, n.stress - 25); n.boredom = Math.max(0, n.boredom - 5);
      UI.toast('深吸一口…… 压力大幅缓解', 'good'); return;
    }
    if (u.type === 'purify') {
      const dirty = p.inv.find(x => x.id === 'w_dirty');
      if (!dirty) { UI.toast('没有浑水可净化', 'info'); return; }
      Ent.removeItem(p, dirty.uid, 1);
      Ent.removeItem(p, it.uid, 1);
      Ent.addItem(p, DB.mk('w_bottle', 1));
      UI.toast('浑水已净化', 'good'); return;
    }
  } else if (d.cat === 'book' && d.read) {
    p.action = { t: 0, dur: 4, label: '阅读 ' + d.nm, moveOK: true, done: () => {
      Ent.removeItem(p, it.uid, 1);
      n.boredom = Math.max(0, n.boredom + (d.read.boredom || -40));
      if (d.read.xp) for (const k in d.read.xp) Sys.Skills.xp(p, k, 60 * d.read.xp[k]);
      UI.toast('读完了 ' + d.nm, 'good');
    } };
  } else if (it.id === 'it_batt') {
    if (!p.equip.light) { UI.toast('没有手电可换电池', 'info'); return; }
    Ent.removeItem(p, it.uid, 1);
    p.equip.light.cond = 1;
    UI.toast('电池已更换', 'good');
  } else if (d.cat === 'attach') {
    UI.toast('请在背包中对枪械使用配件', 'info');
  } else UI.toast('现在用不了', 'info');
  void hbIdx;
};

// ==================== 制作 / 搜集 ====================
Sys.Craft = {
  canCraft(p, r, facs) {
    if (r.fac) { const lv = (facs && facs[r.fac[0]]) || 0; if (lv < r.fac[1]) return { ok: false, why: '需要' + DB.facilities.find(f => f.id === r.fac[0]).nm + ' Lv.' + r.fac[1] }; }
    for (const [id, q] of r.ing) if (Ent.countItem(p, id) < q) return { ok: false, why: '缺少 ' + DB.it(id).nm + '×' + (q - Ent.countItem(p, id)) };
    if (r.tool) {
      const toolItem = Object.keys(DB.items).find(k => DB.items[k].tool === r.tool);
      if (toolItem && Ent.countItem(p, toolItem) < 1) return { ok: false, why: '需要工具：' + DB.it(toolItem).nm };
    }
    return { ok: true };
  },
  craft(p, r, facs, pool) {
    const c = this.canCraft(p, r, facs);
    if (!c.ok) { UI.toast('无法制作：' + c.why, 'bad'); return false; }
    for (const [id, q] of r.ing) Ent.consume(p, id, q);
    const out = DB.mk(r.out[0], r.out[1]);
    (pool || p.inv).push(out);
    if (r.id === 'r_cook') Sys.Skills.xp(p, 'cooking', 3);
    if (r.id === 'r_splint' || r.id === 'r_band') Sys.Skills.xp(p, 'firstaid', 2);
    if (r.id === 'r_nbat' || r.id === 'r_spear') Sys.Skills.xp(p, 'carpentry', 3);
    UI.toast('制作完成：' + r.nm, 'good');
    return true;
  }
};

Sys.Forage = {
  search(p) {
    const W = G.world;
    const tx = Math.floor(p.x / 32), ty = Math.floor(p.y / 32);
    const t = W.tiles[W.idx(tx, ty)];
    const good = t === T.FOREST || t === T.PARK;
    if (t !== T.GRASS && t !== T.FOREST && t !== T.PARK && t !== T.DIRT) { UI.toast('这里没法搜集（找草地/树林）', 'bad'); return; }
    if (G.ambient < 0.4 && !p.flashlightOn) UI.toast('黑灯瞎火，收获堪忧……', 'info');
    p.action = { t: 0, dur: 3, label: '搜集周边…', moveOK: false, done: () => {
      Sys.Skills.xp(p, 'foraging', 3);
      const lv = Sys.Skills.lvl(p, 'foraging');
      const night = G.ambient < 0.4 ? 0.5 : 1;
      const roll = U.rf(0, 1) * night;
      if (roll < 0.18) { Ent.addItem(p, DB.mk('f_berry', U.ri(1, 2 + lv))); UI.toast('找到了浆果', 'good'); }
      else if (roll < 0.30) {
        Ent.addItem(p, DB.mk('f_mush', 1));
        UI.toast('找到了蘑菇（红伞伞白杆杆……）', 'info');
      }
      else if (roll < 0.44 && good) { Ent.addItem(p, DB.mk('wpn_stick', 1)); UI.toast('捡到一根结实的木棍', 'good'); }
      else if (roll < 0.52 && good && lv >= 2) { Ent.addItem(p, DB.mk('mat_plank', 1)); UI.toast('找到可用木料', 'good'); }
      else if (roll < 0.58 + lv * 0.01 && good) { Ent.addItem(p, DB.mk('f_protein', 1)); UI.toast('野外蛋白补给？捡到一罐蛋白粉', 'good'); }
      else UI.toast('翻了半天，什么也没有', 'info');
    } };
  }
};

// ==================== 时间 / 天气 ====================
Sys.Time = {
  ambient() {
    const t = G.raid.time % 1440;
    const h = t / 60;
    let a;
    if (h < 5) a = 0.26;
    else if (h < 7) a = U.lerp(0.26, 0.95, (h - 5) / 2);
    else if (h < 17) a = 1.0;
    else if (h < 19.5) a = U.lerp(1.0, 0.45, (h - 17) / 2.5);
    else if (h < 21) a = U.lerp(0.45, 0.26, (h - 19.5) / 1.5);
    else a = 0.26;
    if (G.world.cfg.dark) a = 0.16;
    const wt = G.raid.weather.type;
    if (wt === 'storm') a *= 0.5;
    else if (wt === 'rain') a *= 0.78;
    else if (wt === 'overcast') a *= 0.9;
    return a;
  },
  tickWeather(dt) {
    const r = G.raid;
    r.weather.t -= dt;
    if (r.weather.t <= 0) {
      const pool = G.world.cfg.weather.length ? G.world.cfg.weather : ['clear'];
      r.weather.type = U.pick(pool);
      r.weather.t = U.ri(90, 240);
      if (r.weather.type !== 'clear') UI.toast('天气变化：' + { rain: '下起了雨', storm: '暴风雨来袭！！', overcast: '转阴了' }[r.weather.type], 'info');
    }
    // 风暴区随机落雷
    if (r.weather.type === 'storm' && U.chance(dt * 0.05)) {
      const px = G.player.x + U.rf(-260, 260), py = G.player.y + U.rf(-260, 260);
      G.strikes.push({ x: px, y: py, t: 1.4, r: 2.4 * 32 });
    }
    // 落雷结算
    for (let i = G.strikes.length - 1; i >= 0; i--) {
      const s = G.strikes[i];
      s.t -= dt;
      if (s.t <= 0) {
        FX.shake(5);
        FX.ring(s.x, s.y, s.r, '#bfe8ff', 0.3);
        G.lightning = 0.9;
        const p = G.player;
        if (U.dist(s.x, s.y, p.x, p.y) < s.r && p.dodgeT <= 0) Sys.Health.hit(p, 'torso', 34, 'boss');
        for (const z of G.zombies) if (z.hp > 0 && U.dist(s.x, s.y, z.x, z.y) < s.r) Ent.damageZombie(z, 60, 99, false);
        G.strikes.splice(i, 1);
      }
    }
  }
};
window.Sys = Sys;
