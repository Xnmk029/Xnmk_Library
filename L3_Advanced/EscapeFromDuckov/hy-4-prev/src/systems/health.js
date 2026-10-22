// 角色状态总控：部位伤病 + 需求 + Moodle + 医疗处置。
// 这是"复杂的角色状态管理"的落地处 —— 所有惩罚最终都从这里流向属性管道。
import {
  createBody, addInjury, updateBody, totalPct, summarize, painTier,
  bandage, disinfect, stitch, splint, antibiotics, rollKnox,
} from './pure/injury.js';
import { computeMoodles, updatePanic, updateNeeds, updateWeight } from './pure/moodles.js';
import { BODY, INJURY, NEEDS, MOODLE, COMBAT } from '../data/balance.js';
import { MEDICAL } from '../data/medical.js';
import { bus } from '../core/events.js';
import { clamp, clamp01 } from '../core/math2d.js';

export class Health {
  constructor(game) {
    this.game = game;
    this.body = createBody();
    this.needs = { hunger: 12, thirst: 8, fatigue: 6, boredom: 4, stress: 0, drunk: 0, weight: NEEDS.weight.default, calories: 0 };
    this.panic = 0;
    this.exertion = 0;
    this.moodles = {};
    this.summary = { bleeding: false, bleedRate: 0, fractures: 0, infectedCount: 0, bloodPct: 1 };
    this.castT = 0;              // 处置读条
    this.castItem = null;
    this.castPart = null;
    this.firstAid = 0;           // 技能等级（M5 接技能系统）
    this.penalties = { moveMul: 1, aimPenalty: 0, swingMul: 1, spreadMul: 1 };
  }

  get totalPct() { return totalPct(this.body); }
  get alive() { return !this.body.dead && this.body.blood > INJURY.blood.total * INJURY.blood.deathAt; }

  // ---------------- 受伤 ----------------
  /**
   * 造成伤害：先把伤害记到部位，再按伤源掷伤情。
   * type: scratch / laceration / bite / deep / fracture / burn / gunshot
   */
  damage(amount, part, type = 'scratch', opts = {}) {
    if (!this.alive) return null;
    const p = this.body.parts[part] || this.body.parts.torso_up;
    p.hp = Math.max(0, p.hp - amount);
    const inj = addInjury(this.body, part, type, opts);
    if (inj) {
      const armorReduce = opts.armorReduce ?? 0;
      if (rollKnox(inj, armorReduce) && this.body.knox <= 0) {
        this.body.knox = 0.0001;
        this.body.knoxTimer = 0;
        this.body.knoxStart = opts.knoxCourse ?? 0.5;
        bus.emit('health:knox', { part });
      }
    }
    bus.emit('health:damaged', { part, amount, type });
    if (!this.alive) bus.emit('health:died', { cause: type });
    return inj;
  }

  // ---------------- 每帧 ----------------
  update(dt, gameHours) {
    const g = this.game;
    // 处置读条（大部分医疗动作要求静止）
    if (this.castT > 0) {
      const moving = g.player.moving;
      if (moving) { this.castT = 0; this.castItem = null; bus.emit('health:castCancel', { reason: '移动中断了处置' }); }
      else {
        this.castT -= dt;
        if (this.castT <= 0) this.finishCast();
      }
    }

    // 需求与体重
    updateNeeds(this.needs, gameHours, {
      sleeping: g.sleeping, indoors: g.playerIndoors, exerting: g.player.sprinting,
      hearty: g.traits?.heartyAppetite, lightEater: g.traits?.lightEater,
      stressGain: this.moodles.panic > 1 ? NEEDS.stressGainPerVisibleZombie * 0 : 0,
    });
    updateWeight(this.needs, gameHours, { calories: this.needs.calories });

    // 伤病推进
    const healMul = this.healMultiplier();
    const events = updateBody(this.body, gameHours, { healMul });
    for (const e of events) {
      if (e.type === 'died' || e.type === 'zombified') bus.emit('health:died', e);
      else bus.emit('health:event', e);
    }

    // 恐慌
    const zeds = g.visibleZombieCount || 0;
    this.panic = updatePanic(this.panic, zeds, dt, gameHours * 60, g.traits || {});
    this.exertion = clamp01(1 - g.player.stamina / COMBAT.stamina.max);

    // Moodle 快照
    this.summary = summarize(this.body);
    this.moodles = computeMoodles({
      needs: this.needs, body: this.body, summary: this.summary,
      endurance: g.player.endurance, exertion: this.exertion,
      loadRatio: this.loadRatio(), drunk: this.needs.drunk,
      visibleZombies: zeds, recovery: this.body.regen, loadBoost: this.body.loadBoost,
      temp: this.body.temp, wet: this.body.wet, totalPct: this.totalPct,
      panic: this.panic,
    });
    this.applyPenalties();
    g.moodleTiers = this.moodleTiers();
  }

  /** 愈合速率倍率：吃饱 +750%，饥饿 −55%，低温停愈，睡觉加成 */
  healMultiplier() {
    const h = this.needs;
    let m = 1;
    if (h.hunger >= 70) m *= BODY.healPerHour.starvingHardMul;
    else if (h.hunger >= 45) m *= BODY.healPerHour.starvingMul;
    else if (h.hunger < 15) m *= BODY.healPerHour.wellFedMul;
    if (this.body.temp < 36.5) m *= BODY.healPerHour.hypothermiaMul;
    if (this.game.sleeping) m *= BODY.healPerHour.sleepingMul;
    if (this.body.regen > 0) m *= 2.2;
    return m;
  }

  /** 汇总成属性管道能直接吃的惩罚 */
  applyPenalties() {
    const b = this.body;
    const legDmg = 1 - (partAvg(b, 'leg_l', 'leg_r'));
    const armDmg = 1 - (partAvg(b, 'arm_l', 'arm_r'));
    const headDmg = 1 - (b.parts.head.hp / b.parts.head.max);
    const frac = this.summary.fractures > 0 ? 0.55 : 1;
    const blood = this.summary.bloodPct;

    this.penalties.moveMul = clamp(
      (1 - legDmg * 0.58) * frac * (0.55 + 0.45 * blood) * (this.moodles.endurance >= 3 ? 0.55 : 1),
      0.18, 1
    );
    this.penalties.swingMul = clamp((1 - armDmg * 0.45) * (1 - this.moodles.pain * 0.08), 0.25, 1);
    this.penalties.aimPenalty = (armDmg * 8 + headDmg * 12) + (this.moodles.panic > 0 ? this.moodles.panic * 6 : 0);
    this.penalties.spreadMul = 1 + armDmg * 0.8 + headDmg * 1.1;
  }

  moodleTiers() {
    return {
      panicTier: this.moodles.panic ?? 0,
      painTier: this.moodles.pain ?? 0,
      enduranceTier: this.moodles.endurance ?? 0,
      enduranceSpent: this.game.player.endurance,
      heavyTier: this.moodles.heavy ?? 0,
      sickTier: this.moodles.sick ?? 0,
    };
  }

  loadRatio() {
    const cap = this.game.carryCapacity ?? 20;
    const carried = this.game.carriedWeight ?? 0;
    return cap > 0 ? carried / cap : 0;
  }

  // ---------------- 医疗处置 ----------------
  /** 开始处置：返回 {ok, reason} */
  use(itemId, part = null) {
    const def = MEDICAL[itemId];
    if (!def) return { ok: false, reason: '这不是医疗物品' };
    if (this.castT > 0) return { ok: false, reason: '正在处置中' };
    if (def.firstAid > this.firstAid) return { ok: false, reason: `需要急救 ${def.firstAid} 级` };

    const target = part || this.worstPartFor(def.use);
    if ((def.use === 'bandage' || def.use === 'splint' || def.use === 'stitch' || def.use === 'disinfect') && !target) {
      return { ok: false, reason: '没有需要处置的伤口' };
    }
    this.castItem = itemId;
    this.castPart = target;
    this.castT = def.time;
    this.castTotal = def.time;
    bus.emit('health:castStart', { item: def, part: target, time: def.time });
    return { ok: true, time: def.time };
  }

  worstPartFor(use) {
    let worst = null, worstScore = -1;
    for (const k of BODY.parts) {
      for (const i of this.body.parts[k].injuries) {
        let score = 0;
        if (use === 'bandage') score = (i.bandaged ? 0 : 2) + (i.dirty ? 1.5 : 0) + i.bleed * 0.2;
        else if (use === 'disinfect') score = i.disinfected ? 0 : 1 + i.bleed * 0.1;
        else if (use === 'stitch') score = INJURY.types[i.type].needsStitch && !i.stitches ? 3 : 0;
        else if (use === 'splint') score = INJURY.types[i.type].needsSplint && !i.splinted ? 3 : 0;
        if (score > worstScore) { worstScore = score; worst = k; }
      }
    }
    return worstScore > 0 ? worst : null;
  }

  finishCast() {
    const def = MEDICAL[this.castItem];
    const part = this.castPart;
    this.castItem = null; this.castPart = null;
    if (!def) return;
    let ok = true, msg = '';
    switch (def.use) {
      case 'bandage': ok = bandage(this.body, part, !!def.sterile, false); msg = '已包扎'; break;
      case 'disinfect': ok = disinfect(this.body, part); msg = '已消毒'; break;
      case 'stitch': { const r = stitch(this.body, part, this.firstAid); ok = r.ok; msg = r.reason || '已缝合'; break; }
      case 'splint': { const r = splint(this.body, part, this.firstAid); ok = r.ok; msg = r.reason || '已固定'; break; }
      case 'antibiotic': antibiotics(this.body); msg = '服用抗生素'; break;
      case 'painkiller': this.body.painkiller = 3.5; msg = '疼痛缓解'; break;
      case 'beta': this.body.beta = 4; this.panic = 0; msg = '恐慌压制'; break;
      case 'heal': {
        const p = this.body.parts[part] || this.body.parts.torso_up;
        p.hp = Math.min(p.max, p.hp + (def.heal ?? 20));
        msg = `恢复 ${def.heal} 点`;
        break;
      }
      case 'recovery': this.body.regen = def.duration; msg = '恢复针生效'; break;
      case 'load': this.body.loadBoost = def.duration; msg = '负重上限提升'; break;
      case 'drink': this.needs.fatigue = Math.max(0, this.needs.fatigue + (def.fatigue ?? -20)); msg = '提神'; break;
      default: ok = false;
    }
    bus.emit('health:castDone', { item: def, part, ok, msg });
  }
}

function partAvg(body, a, b) {
  const pa = body.parts[a].hp / body.parts[a].max;
  const pb = body.parts[b].hp / body.parts[b].max;
  return (pa + pb) / 2;
}

export const PART_LABEL = {
  head: '头', neck: '颈', torso_up: '胸', torso_low: '腹', groin: '裆',
  arm_l: '左臂', arm_r: '右臂', leg_l: '左腿', leg_r: '右腿',
};
