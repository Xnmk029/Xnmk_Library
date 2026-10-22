// ============================================================
//  body.js — 部位伤害系统 + 生理需求 + Moodles
//  （《僵尸毁灭工程》BodyDamage / Stats 架构的完整移植）
// ============================================================

import { clamp, clamp01, lerp } from '../core/util.js';

export const PARTS = [
  { id: 'head', name: '头部', mul: 2.4, crit: true, x: 0, y: -3.2 },
  { id: 'neck', name: '颈部', mul: 2.0, crit: true, x: 0, y: -2.1 },
  { id: 'torso_upper', name: '上躯干', mul: 1.45, crit: true, x: 0, y: -0.9 },
  { id: 'torso_lower', name: '下躯干', mul: 1.2, x: 0, y: 0.2 },
  { id: 'l_arm', name: '左上臂', mul: 0.85, arm: true, x: -1.5, y: -0.8 },
  { id: 'r_arm', name: '右上臂', mul: 0.85, arm: true, x: 1.5, y: -0.8 },
  { id: 'l_hand', name: '左手', mul: 0.65, arm: true, x: -1.9, y: 0.3 },
  { id: 'r_hand', name: '右手', mul: 0.65, arm: true, x: 1.9, y: 0.3 },
  { id: 'l_leg', name: '左腿', mul: 1.0, leg: true, x: -0.8, y: 1.6 },
  { id: 'r_leg', name: '右腿', mul: 1.0, leg: true, x: 0.8, y: 1.6 },
  { id: 'l_foot', name: '左脚', mul: 0.6, leg: true, x: -0.8, y: 2.6 },
  { id: 'r_foot', name: '右脚', mul: 0.6, leg: true, x: 0.8, y: 2.6 },
];
export const PART_IDS = PARTS.map((p) => p.id);
export const PART_MAP = {};
PARTS.forEach((p) => { PART_MAP[p.id] = p; });

/** 命中部位随机表（正面交战的概率分布） */
const HIT_WEIGHTS = [
  ['torso_upper', 26], ['torso_lower', 16], ['head', 9], ['neck', 3],
  ['l_arm', 9], ['r_arm', 9], ['l_hand', 4], ['r_hand', 4],
  ['l_leg', 8], ['r_leg', 8], ['l_foot', 2], ['r_foot', 2],
];

export function randomPart(rng, aimHigh = 0) {
  const w = HIT_WEIGHTS.map(([id, wt]) => {
    const p = PART_MAP[id];
    let m = wt;
    if (aimHigh > 0 && (id === 'head' || id === 'neck')) m *= 1 + aimHigh * 3;
    if (aimHigh < 0 && p.leg) m *= 1 + (-aimHigh) * 2;
    return [id, m];
  });
  return rng.weighted(w);
}

export class BodyState {
  constructor(mods = {}) {
    this.mods = Object.assign({
      hpMul: 1, healMul: 1, painMul: 1, sickMul: 1, infectMul: 1, panicMul: 1, dmgTakenMul: 1,
      staminaMul: 1, visionMul: 1, visionNight: 1, noiseMul: 1, carry: 0, spreadMul: 1, aimMoveMul: 1,
    }, mods);
    this.parts = {};
    for (const p of PARTS) {
      this.parts[p.id] = {
        hp: 100, max: 100 * this.mods.hpMul,
        bleed: 0,        // 每小时失血量
        deep: false,     // 深伤口（需缝合）
        frac: false,     // 骨折
        splint: false,
        bandage: 0,      // 0 无 / 1 无菌 / 2 脏
        bandageHp: 0,    // 绷带耐久
        infect: 0,       // 伤口感染 0..100
        stitched: false,
        burn: 0,
        bite: false,
      };
      this.parts[p.id].hp = this.parts[p.id].max;
    }
    // 生理需求（0 = 良好，100 = 极端）
    this.stats = {
      hunger: 8, thirst: 12, fatigue: 10, stress: 0, panic: 0, boredom: 0, unhappy: 0,
      sickness: 0, wetness: 0, temp: 37.0, drunk: 0, caffeine: 0,
    };
    this.stamina = 100;
    this.staminaMax = 100 * this.mods.staminaMul;
    this.pain = 0;
    this.painkiller = 0;      // 剩余分钟
    this.antibiotic = 0;
    this.regen = 0;           // 恢复针剩余分钟
    this.carryBuff = 0;
    this.zombieInfect = -1;   // -1 未感染；0..100 病程
    this.dead = false;
    this.deadCause = '';
    this.alertMsg = null;
    this.sleeping = false;
    this.bandagesDirtyTimer = 0;
  }

  // ---------------- 查询 ----------------
  health() {
    let s = 0, n = 0;
    for (const p of PARTS) { s += this.parts[p.id].hp / this.parts[p.id].max; n++; }
    return (s / n) * 100;
  }
  bleeding() {
    let b = 0;
    for (const p of PARTS) b += this.parts[p.id].bleed;
    return b;
  }
  hasFracture() { return PARTS.some((p) => this.parts[p.id].frac && !this.parts[p.id].splint); }
  woundInfection() {
    let m = 0;
    for (const p of PARTS) m = Math.max(m, this.parts[p.id].infect);
    return m;
  }
  legDamage() {
    const a = this.parts.l_leg, b = this.parts.r_leg, c = this.parts.l_foot, d = this.parts.r_foot;
    let f = 0;
    for (const p of [a, b, c, d]) {
      f += (1 - p.hp / p.max) * 0.5;
      if (p.frac) f += p.splint ? 0.25 : 0.85;
    }
    return clamp(f, 0, 2.4);
  }
  armDamage() {
    let f = 0;
    for (const id of ['l_arm', 'r_arm', 'l_hand', 'r_hand']) {
      const p = this.parts[id];
      f += (1 - p.hp / p.max) * 0.5;
      if (p.frac) f += p.splint ? 0.3 : 1.0;
    }
    return clamp(f, 0, 2.4);
  }
  effectivePain() { return clamp(this.pain * this.mods.painMul - this.painkiller * 0.28, 0, 100); }

  /** 移动速度倍率 */
  speedMul() {
    let m = 1;
    m -= this.legDamage() * 0.18;
    m -= clamp01((this.stats.hunger - 60) / 40) * 0.16;
    m -= clamp01((this.stats.thirst - 60) / 40) * 0.14;
    m -= clamp01((this.stats.fatigue - 55) / 45) * 0.2;
    m -= clamp01(this.effectivePain() / 100) * 0.16;
    m -= clamp01((this.stats.sickness - 30) / 70) * 0.15;
    if (this.stats.temp < 35.5) m -= 0.18;
    if (this.stats.temp > 39) m -= 0.1;
    m -= clamp01(this.stats.drunk / 100) * 0.1;
    m *= 1 - clamp01((1 - this.health() / 100) * 0.35);
    return clamp(m, 0.28, 1.15);
  }
  /** 附加射击散布（度） */
  aimPenalty() {
    let s = 0;
    s += this.armDamage() * 1.5;
    s += clamp01(this.effectivePain() / 100) * 2.2;
    s += clamp01(this.stats.panic / 100) * 3.4;
    s += clamp01((this.stats.fatigue - 50) / 50) * 1.6;
    s += clamp01(this.stats.drunk / 100) * 4.0;
    if (this.stamina < 25) s += 1.4;
    return s * this.mods.spreadMul;
  }
  /** 近战伤害倍率 */
  meleeMul() {
    let m = 1 - this.armDamage() * 0.16 - clamp01((this.stats.fatigue - 50) / 50) * 0.2;
    if (this.stamina < 20) m *= 0.6;
    return clamp(m, 0.3, 1.3);
  }
  visionMul() {
    let m = this.mods.visionMul;
    m -= clamp01((this.stats.fatigue - 60) / 40) * 0.2;
    m -= clamp01(this.effectivePain() / 100) * 0.08;
    if (this.stats.drunk > 40) m -= 0.12;
    return clamp(m, 0.5, 1.6);
  }

  // ---------------- 伤害 ----------------
  /**
   * @param part 部位 id
   * @param amount 伤害
   * @param o { bleed, deep, frac, burn, bite, scratch, infectChance, cause }
   */
  damage(part, amount, o = {}) {
    const p = this.parts[part];
    if (!p) return;
    amount *= this.mods.dmgTakenMul;
    p.hp = clamp(p.hp - amount, 0, p.max);
    this.pain = clamp(this.pain + amount * (PART_MAP[part].mul * 0.55), 0, 100);
    if (o.bleed) {
      p.bleed += o.bleed;
      if (p.bandage) { p.bandageHp -= o.bleed * 8; if (p.bandageHp <= 0) p.bandage = 0; }
    }
    if (o.deep) { p.deep = true; p.bleed += 1.2; }
    if (o.frac) { p.frac = true; p.splint = false; this.pain = clamp(this.pain + 22, 0, 100); }
    if (o.burn) p.burn = clamp(p.burn + o.burn, 0, 100);
    if (o.scratch || o.bite) {
      p.infect = Math.max(p.infect, o.bite ? 12 : 4);
      if (o.bite) p.bite = true;
    }
    // 鸭瘟感染判定
    if (o.infectChance && this.zombieInfect < 0) {
      const c = o.infectChance * this.mods.infectMul;
      if (Math.random() < c) {
        this.zombieInfect = 0;
        this.alertMsg = '你被咬伤了……伤口开始发黑。（鸭瘟感染）';
      }
    }
    this.stats.panic = clamp(this.stats.panic + amount * 0.8 * this.mods.panicMul, 0, 100);
    this.stats.stress = clamp(this.stats.stress + amount * 0.4, 0, 100);
    if (PART_MAP[part].crit && p.hp <= 0) this.kill(part === 'head' ? '头部致命伤' : '躯干致命伤');
    if (this.health() <= 0) this.kill('伤势过重');
  }

  kill(cause) {
    if (this.dead) return;
    this.dead = true;
    this.deadCause = cause;
  }

  // ---------------- 治疗动作 ----------------
  applyMed(part, med, skillLvl = 0) {
    const p = this.parts[part];
    if (!p) return '无效部位';
    const msgs = [];
    if (med.stopBleed && p.bleed > 0) { p.bleed = Math.max(0, p.bleed - med.stopBleed * (2.5 + skillLvl * 0.6)); msgs.push('止血'); }
    if (med.bandage) {
      p.bandage = med.bandage;
      p.bandageHp = 60 + skillLvl * 12;
      p.bleed *= med.bandage === 1 ? 0.1 : 0.28;
      if (med.infect) p.infect = Math.max(p.infect, med.infect * 40);
      msgs.push(med.bandage === 1 ? '已包扎' : '用脏布条包扎');
    }
    if (med.disinfect) { p.infect = Math.max(0, p.infect - (55 + skillLvl * 8)); msgs.push('消毒'); }
    if (med.splint) {
      if (!p.frac) return '该部位没有骨折';
      p.splint = true; this.pain = Math.max(0, this.pain - 15); msgs.push('已固定骨折');
    }
    if (med.stitch) {
      if (p.deep) { p.deep = false; p.bleed = 0; p.stitched = true; msgs.push('缝合深伤口'); }
      if (med.fixMax) { for (const q of PARTS) { const t = this.parts[q.id]; t.max = Math.min(100 * this.mods.hpMul, t.max + 12); } msgs.push('修复生命上限'); }
    }
    if (med.heal) {
      let left = med.heal * (1 + skillLvl * 0.06);
      // 优先治疗最重的部位
      const order = PARTS.slice().sort((a, b) => (this.parts[a.id].hp / this.parts[a.id].max) - (this.parts[b.id].hp / this.parts[b.id].max));
      for (const q of order) {
        const t = this.parts[q.id];
        const room = t.max - t.hp;
        if (room <= 0) continue;
        const give = Math.min(room, left);
        t.hp += give; left -= give;
        if (left <= 0) break;
      }
      msgs.push('恢复生命');
    }
    if (med.pain) { this.painkiller = Math.max(this.painkiller, med.dur || 180); msgs.push('止痛'); }
    if (med.woundInfect) { for (const q of PARTS) this.parts[q.id].infect = Math.max(0, this.parts[q.id].infect + med.woundInfect); }
    if (med.sick) this.stats.sickness = clamp(this.stats.sickness + med.sick, 0, 100);
    if (med.dur && med.woundInfect) this.antibiotic = Math.max(this.antibiotic, med.dur);
    if (med.regen) { this.regen = Math.max(this.regen, med.dur || 60); msgs.push('缓回血生效'); }
    if (med.carry) { this.carryBuff = med.carry; this.carryTimer = med.dur || 180; msgs.push('负重提升'); }
    if (med.cureInfect) {
      if (this.zombieInfect >= 0) { this.zombieInfect = -1; msgs.push('血清清除了鸭瘟病毒！'); }
      else msgs.push('你没有被感染，血清被浪费了');
    }
    return msgs.join('，') || '没有效果';
  }

  // ---------------- 每帧更新 ----------------
  /**
   * @param dtH 经过的游戏内小时数
   * @param ctx { indoor, cold, wet, moving, sprinting, weightRatio, hasFood, rested, radio, temp }
   */
  update(dtH, ctx = {}) {
    if (this.dead) return;
    const s = this.stats;
    const sleepMul = this.sleeping ? 0.45 : 1;

    // --- 需求 ---
    s.hunger = clamp(s.hunger + 2.3 * dtH * sleepMul * (ctx.sprinting ? 1.4 : 1), 0, 100);
    s.thirst = clamp(s.thirst + 3.4 * dtH * sleepMul * (ctx.sprinting ? 1.6 : 1), 0, 100);
    if (this.sleeping) {
      s.fatigue = clamp(s.fatigue - 13 * dtH, 0, 100);
      s.stress = clamp(s.stress - 6 * dtH, 0, 100);
      s.panic = clamp(s.panic - 30 * dtH, 0, 100);
    } else {
      s.fatigue = clamp(s.fatigue + (2.8 - this.caffeineEffect() * 1.8) * dtH, 0, 100);
    }
    s.boredom = clamp(s.boredom + (ctx.radio ? -3 : 0.9) * dtH, 0, 100);
    s.caffeine = clamp(s.caffeine - 22 * dtH, 0, 100);
    s.drunk = clamp(s.drunk - 14 * dtH, 0, 100);
    this.painkiller = Math.max(0, this.painkiller - dtH * 60);
    this.antibiotic = Math.max(0, this.antibiotic - dtH * 60);
    if (this.carryTimer) { this.carryTimer = Math.max(0, this.carryTimer - dtH * 60); if (!this.carryTimer) this.carryBuff = 0; }

    // 饥渴带来的健康损耗
    if (s.hunger > 88) this.damageAll(1.6 * dtH);
    if (s.thirst > 90) this.damageAll(2.6 * dtH);

    // --- 体温 / 潮湿 ---
    const envT = ctx.temp !== undefined ? ctx.temp : 18;
    if (ctx.wet) s.wetness = clamp(s.wetness + 34 * dtH, 0, 100);
    else s.wetness = clamp(s.wetness - (ctx.indoor ? 26 : 14) * dtH, 0, 100);
    let target = 37 + (envT - 18) * 0.035 - s.wetness * 0.012 + (ctx.fire ? 0.6 : 0) + (ctx.indoor ? 0.25 : 0);
    if (ctx.moving) target += 0.25;
    s.temp = lerp(s.temp, target, clamp01(dtH * 1.6));
    if (s.temp < 35.2) this.damageAll(2.0 * dtH);
    if (s.temp > 39.5) this.damageAll(1.4 * dtH);

    // --- 出血 ---
    let totalBleed = 0;
    for (const q of PARTS) {
      const p = this.parts[q.id];
      if (p.bleed > 0) {
        const stop = p.bandage ? (p.bandage === 1 ? 0.85 : 0.55) : 0.12;
        p.bleed = Math.max(0, p.bleed - stop * dtH * 1.2);
        const loss = p.bleed * dtH * 7.5;
        p.hp = clamp(p.hp - loss, 0, p.max);
        totalBleed += p.bleed;
        if (p.deep) p.bleed = Math.max(p.bleed, 0.35);
      }
      // 绷带脏化 → 感染
      if (p.bandage === 2 || (p.bandage === 1 && p.bandageHp < 20)) {
        p.infect = clamp(p.infect + 2.4 * dtH * this.mods.sickMul, 0, 100);
      }
      if (p.bandage) { p.bandageHp -= dtH * 3; if (p.bandageHp <= 0) p.bandage = 0; }
      // 伤口感染发展
      if (p.infect > 0) {
        const cure = this.antibiotic > 0 ? -9 : (p.bandage === 1 ? -0.4 : 0.9);
        p.infect = clamp(p.infect + cure * dtH * this.mods.sickMul, 0, 100);
        if (p.infect > 55) { s.sickness = clamp(s.sickness + 3.2 * dtH, 0, 100); p.hp = clamp(p.hp - 1.6 * dtH, 0, p.max); }
      }
      if (p.burn > 0) { p.burn = Math.max(0, p.burn - 3 * dtH); p.hp = clamp(p.hp - p.burn * 0.05 * dtH, 0, p.max); }
    }
    if (totalBleed > 0) s.panic = clamp(s.panic + totalBleed * 4 * dtH * this.mods.panicMul, 0, 100);

    // --- 鸭瘟病毒 ---
    if (this.zombieInfect >= 0) {
      this.zombieInfect = clamp(this.zombieInfect + 1.5 * dtH * (this.antibiotic > 0 ? 0.6 : 1), 0, 100);
      if (this.zombieInfect > 25) s.sickness = clamp(s.sickness + 4.5 * dtH, 0, 100);
      if (this.zombieInfect > 55) { this.damageAll(2.2 * dtH); s.temp = Math.max(s.temp, 38.6); }
      if (this.zombieInfect >= 100) this.kill('鸭瘟病毒发作');
    }

    // --- 患病 ---
    if (s.sickness > 0) {
      const cure = this.antibiotic > 0 ? -14 : (this.zombieInfect >= 0 || this.woundInfection() > 40 ? 0 : -3.5);
      s.sickness = clamp(s.sickness + cure * dtH, 0, 100);
      if (s.sickness > 70) this.damageAll(1.3 * dtH);
    }

    // --- 自然恢复（吃饱 + 不重伤） ---
    const wellFed = s.hunger < 45 && s.thirst < 55;
    const healRate = (this.sleeping ? 3.4 : 1.0) * (wellFed ? 1 : 0.35) * this.mods.healMul + (this.regen > 0 ? 6 : 0);
    if (healRate > 0) {
      for (const q of PARTS) {
        const p = this.parts[q.id];
        if (p.hp >= p.max) continue;
        if (p.bleed > 0.2) continue;
        if (p.deep && !p.stitched) continue;
        p.hp = clamp(p.hp + healRate * dtH, 0, p.max);
      }
      // 骨折愈合（需夹板）
      for (const q of PARTS) {
        const p = this.parts[q.id];
        if (p.frac && p.splint) {
          p.fracT = (p.fracT || 0) + dtH * (this.sleeping ? 2 : 1);
          if (p.fracT > 24) { p.frac = false; p.splint = false; p.fracT = 0; }
        }
      }
    }
    this.regen = Math.max(0, this.regen - dtH * 60);

    // --- 疼痛自然衰减 ---
    let painTarget = 0;
    for (const q of PARTS) {
      const p = this.parts[q.id];
      painTarget += (1 - p.hp / p.max) * PART_MAP[q.id].mul * 7;
      if (p.frac && !p.splint) painTarget += 22;
      if (p.deep && !p.stitched) painTarget += 10;
      painTarget += p.burn * 0.3;
    }
    this.pain = lerp(this.pain, clamp(painTarget, 0, 100), clamp01(dtH * 3));

    // --- 恐慌 / 压力 / 不快 ---
    s.panic = clamp(s.panic - 26 * dtH, 0, 100);
    s.stress = clamp(s.stress - 5 * dtH + (this.zombieInfect >= 0 ? 8 * dtH : 0), 0, 100);
    let unhappyT = clamp01(s.hunger / 100) * 30 + clamp01(s.boredom / 100) * 25 + clamp01(this.effectivePain() / 100) * 25 + (this.zombieInfect >= 0 ? 25 : 0);
    s.unhappy = lerp(s.unhappy, unhappyT, clamp01(dtH * 2));

    // --- 体力 ---
    this.staminaMax = 100 * this.mods.staminaMul * (1 - clamp01((s.fatigue - 40) / 60) * 0.4);
    const wr = ctx.weightRatio || 0;
    const regenRate = (this.sleeping ? 200 : 26) * (1 - clamp01(wr - 0.75) * 0.6) * (s.hunger > 75 ? 0.5 : 1);
    if (!ctx.sprinting) this.stamina = clamp(this.stamina + regenRate * dtH * 60 * 0.017, 0, this.staminaMax);
    if (this.health() <= 0) this.kill('伤势过重');
  }

  damageAll(amount) {
    for (const q of PARTS) {
      const p = this.parts[q.id];
      p.hp = clamp(p.hp - amount, 0, p.max);
    }
    if (this.health() <= 0) this.kill('身体机能衰竭');
  }
  caffeineEffect() { return clamp01(this.stats.caffeine / 100); }

  /** 消耗体力（跑动/近战） */
  useStamina(v) {
    this.stamina = clamp(this.stamina - v, 0, this.staminaMax);
    return this.stamina > 0;
  }

  // ---------------- Moodles ----------------
  moodles() {
    const out = [];
    const s = this.stats;
    const add = (id, name, lv, desc, good) => { if (lv > 0) out.push({ id, name, lv: Math.min(4, lv), desc, good: !!good }); };
    add('hungry', '饥饿', s.hunger > 88 ? 4 : s.hunger > 70 ? 3 : s.hunger > 50 ? 2 : s.hunger > 30 ? 1 : 0, '需要进食，否则体力与生命持续流失');
    add('thirsty', '口渴', s.thirst > 90 ? 4 : s.thirst > 72 ? 3 : s.thirst > 52 ? 2 : s.thirst > 32 ? 1 : 0, '需要饮水');
    add('tired', '疲倦', s.fatigue > 90 ? 4 : s.fatigue > 72 ? 3 : s.fatigue > 52 ? 2 : s.fatigue > 34 ? 1 : 0, '需要睡眠，视野与体力受限');
    add('endurance', '力竭', this.stamina < 8 ? 4 : this.stamina < 20 ? 3 : this.stamina < 35 ? 2 : this.stamina < 55 ? 1 : 0, '无法奔跑与挥砍');
    add('pain', '疼痛', this.effectivePain() > 70 ? 4 : this.effectivePain() > 45 ? 3 : this.effectivePain() > 25 ? 2 : this.effectivePain() > 8 ? 1 : 0, '影响移动与瞄准（止痛药）');
    const bl = this.bleeding();
    add('bleeding', '流血', bl > 3 ? 4 : bl > 1.6 ? 3 : bl > 0.7 ? 2 : bl > 0 ? 1 : 0, '生命持续流失（绷带）');
    let inj = 0;
    for (const q of PARTS) { const p = this.parts[q.id]; if (p.hp < p.max * 0.5) inj++; }
    add('injured', '受伤', inj > 5 ? 4 : inj > 3 ? 3 : inj > 1 ? 2 : inj > 0 ? 1 : 0, '多处部位受损');
    add('frac', '骨折', this.hasFracture() ? 3 : 0, '移动与瞄准严重受限（夹板）');
    const wi = this.woundInfection();
    add('winfect', '伤口感染', wi > 70 ? 4 : wi > 45 ? 3 : wi > 20 ? 2 : wi > 0 ? 1 : 0, '需要消毒/抗生素');
    if (this.zombieInfect >= 0) add('zinfect', '鸭瘟感染', this.zombieInfect > 70 ? 4 : this.zombieInfect > 40 ? 3 : this.zombieInfect > 15 ? 2 : 1, '致命！唯有 J-Lab 血清可解');
    add('sick', '患病', s.sickness > 70 ? 4 : s.sickness > 45 ? 3 : s.sickness > 22 ? 2 : s.sickness > 5 ? 1 : 0, '恶心虚弱（抗生素）');
    add('panic', '恐慌', s.panic > 70 ? 4 : s.panic > 45 ? 3 : s.panic > 22 ? 2 : s.panic > 8 ? 1 : 0, '手抖、散布增大');
    add('stress', '压力', s.stress > 70 ? 4 : s.stress > 45 ? 3 : s.stress > 22 ? 2 : 0, '长期压力影响状态');
    add('bored', '无聊', s.boredom > 80 ? 3 : s.boredom > 55 ? 2 : s.boredom > 30 ? 1 : 0, '收音机/书籍可缓解');
    add('unhappy', '沮丧', s.unhappy > 70 ? 4 : s.unhappy > 45 ? 3 : s.unhappy > 22 ? 2 : 0, '愈合速度下降');
    add('wet', '潮湿', s.wetness > 80 ? 3 : s.wetness > 50 ? 2 : s.wetness > 25 ? 1 : 0, '加速体温流失');
    add('cold', '寒冷', s.temp < 35.2 ? 4 : s.temp < 36 ? 3 : s.temp < 36.6 ? 2 : 0, '低温症：持续掉血');
    add('hot', '过热', s.temp > 39.4 ? 3 : s.temp > 38.6 ? 2 : 0, '发热：脱水加速');
    add('drunk', '醉酒', s.drunk > 60 ? 3 : s.drunk > 30 ? 2 : s.drunk > 8 ? 1 : 0, '散布大增但疼痛降低');
    if (this.painkiller > 0) add('pk', '止痛药效', 1, `剩余 ${Math.round(this.painkiller)} 分钟`, true);
    if (this.antibiotic > 0) add('ab', '抗生素', 1, `剩余 ${Math.round(this.antibiotic)} 分钟`, true);
    if (this.regen > 0) add('rg', '恢复中', 1, '持续回血', true);
    if (this.carryBuff > 0) add('cb', '负重强化', 1, `+${this.carryBuff}kg`, true);
    if (s.caffeine > 20) add('caf', '咖啡因', 1, '疲倦累积减缓', true);
    return out;
  }

  toJSON() {
    return {
      parts: this.parts, stats: this.stats, stamina: this.stamina, pain: this.pain,
      painkiller: this.painkiller, antibiotic: this.antibiotic, regen: this.regen,
      zombieInfect: this.zombieInfect, dead: this.dead,
    };
  }
  load(d) {
    if (!d) return;
    if (d.parts) for (const k in d.parts) if (this.parts[k]) Object.assign(this.parts[k], d.parts[k]);
    if (d.stats) Object.assign(this.stats, d.stats);
    this.stamina = d.stamina !== undefined ? d.stamina : this.stamina;
    this.pain = d.pain || 0;
    this.painkiller = d.painkiller || 0;
    this.antibiotic = d.antibiotic || 0;
    this.regen = d.regen || 0;
    this.zombieInfect = d.zombieInfect !== undefined ? d.zombieInfect : -1;
    this.dead = !!d.dead;
  }
}
