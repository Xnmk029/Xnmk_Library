// 部位伤病模拟（PZ 数值，纯逻辑可单测）。
// 两条感染路径必须分开：细菌感染可治，克诺克斯病毒无解。
import { BODY, INJURY } from '../../data/balance.js';

export function createBody() {
  const parts = {};
  for (const p of BODY.parts) parts[p] = { hp: BODY.partHp[p], max: BODY.partHp[p], injuries: [] };
  return {
    parts,
    blood: INJURY.blood.total,
    knox: 0,                  // 0..1 病程进度；>0 即已感染，无药可医
    knoxTimer: 0,             // 感染后的游戏小时数
    infected: false,          // 伤口细菌感染
    infectionTimer: 0,
    antibioticTimer: 0,
    pain: 0,
    painkiller: 0,            // 剩余游戏小时
    beta: 0,
    regen: 0,                 // 恢复针剩余秒数
    loadBoost: 0,             // 负重针剩余秒数
    temp: 37,                 // 核心体温
    wet: 0,
    dead: false,
    dizzy: 0,
  };
}

export function partPct(body, part) {
  const p = body.parts[part];
  return p ? p.hp / p.max : 1;
}

/** 总生命：按部位权重合成（PZ 的总血条语义） */
export function totalPct(body) {
  let sum = 0, w = 0;
  for (const k of BODY.parts) {
    const p = body.parts[k];
    if (!p) continue;
    const weight = BODY.partWeight[k] ?? 1;
    sum += (p.hp / p.max) * weight;
    w += weight;
  }
  return w ? sum / w : 0;
}

/** 添加一处伤情 */
export function addInjury(body, part, type, opts = {}) {
  const def = INJURY.types[type];
  if (!def || !body.parts[part]) return null;
  const inj = {
    type, part,
    bleed: def.bleed * (opts.bleedMul ?? 1),
    heal: def.heal * (opts.healMul ?? 1),
    healed: 0,
    bandaged: false, dirty: false, disinfected: false,
    stitches: false, splinted: false,
    infected: false, knoxRolled: false, knox: false,
    ageHours: 0,
    name: def.name,
  };
  body.parts[part].injuries.push(inj);
  // 部位血量立刻掉一截（伤情本身就是伤害的载体）
  body.parts[part].hp = Math.max(0, body.parts[part].hp - (opts.hpLoss ?? def.heal * 0.18));
  return inj;
}

/**
 * 推进一个游戏小时（或小时的一部分）。
 * ctx: { healMul, hours }，返回本步发生的事件，供上层做提示与音效。
 */
export function updateBody(body, hours, ctx = {}) {
  const events = [];
  const healMul = ctx.healMul ?? 1;
  let bleedRate = 0;                       // ml / 游戏小时
  let pain = 0;

  for (const k of BODY.parts) {
    const part = body.parts[k];
    if (!part) continue;
    for (const inj of part.injuries) {
      inj.ageHours += hours;
      const def = INJURY.types[inj.type];

      // ---- 出血 ----
      if (inj.bleed > 0) {
        const stopped = inj.bandaged || inj.stitches;
        if (!stopped) bleedRate += inj.bleed;
        else if (inj.dirty) bleedRate += inj.bleed * 0.15;
      }

      // ---- 愈合 ----
      let heal = inj.heal > 0 ? (hours / inj.heal) : 1;
      if (inj.type === 'deep' && !inj.stitches) heal *= 0.05;        // 不缝合几乎不长
      if (inj.type === 'fracture' && !inj.splinted) heal *= 0.35;
      if (inj.bandaged && inj.dirty) heal *= 0.55;
      if (inj.infected) heal *= 1 - INJURY.woundInfection.healPenalty;
      inj.healed = Math.min(1, inj.healed + heal * healMul);
      if (inj.healed >= 1) {
        part.injuries.splice(part.injuries.indexOf(inj), 1);
        events.push({ type: 'healed', part, injury: inj.type });
        continue;
      }

      // ---- 绷带变脏 ----
      if (inj.bandaged && !inj.dirty && inj.ageHours > INJURY.bandage.dirtyAfterHours) {
        inj.dirty = true;
        events.push({ type: 'bandageDirty', part });
      }
      // ---- 细菌感染：脏绷带超时"必感染"（wiki：3 天以上必感染），敞口伤口有小概率 ----
      if (!inj.infected && def.knox === 0) {
        if (inj.dirty) {
          inj.dirtyHours = (inj.dirtyHours || 0) + hours;
          const limit = INJURY.bandage.infectionAfterHours * (inj.disinfected ? 2.5 : 1);
          if (inj.dirtyHours > limit) {
            inj.infected = true;
            body.infected = true;
            events.push({ type: 'woundInfected', part });
          }
        } else if (!inj.bandaged && Math.random() < INJURY.bandage.dirtyInfectionPerHour * hours * 0.25) {
          inj.infected = true;
          body.infected = true;
          events.push({ type: 'woundInfected', part });
        }
      }
      // ---- 疼痛 ----
      pain += (def.pain ?? 0.4) * (BODY.painWeight[k] ?? 0.7) * (1 - inj.healed * 0.6);
    }
    // 致命部位归零 = 死亡。必须先判定再恢复 ——
    // 否则自然愈合会在同一帧把 0 抬回正数，致命伤永远打不死人。
    if (part.hp <= 0 && BODY.lethal[k]) {
      body.dead = true;
      events.push({ type: 'died', part: k });
    }
    // 部位血量随时间恢复（需无未处理伤情，且该部位还没被打空）
    if (part.hp > 0 && !part.injuries.length && part.hp < part.max) {
      part.hp = Math.min(part.max, part.hp + BODY.healPerHour.base * hours * healMul);
    }
  }

  // ---- 血量 ----
  body.blood = Math.max(0, body.blood - bleedRate * hours);
  if (bleedRate <= 0 && body.blood < INJURY.blood.total) {
    body.blood = Math.min(INJURY.blood.total, body.blood + INJURY.blood.regenPerHour * hours * (healMul > 0 ? 1 : 0));
  }
  const bloodPct = body.blood / INJURY.blood.total;
  if (bloodPct <= INJURY.blood.deathAt) { body.dead = true; events.push({ type: 'died', part: 'blood' }); }

  // ---- 克诺克斯病毒：无解，走完病程即死 ----
  if (body.knox > 0) {
    body.knoxTimer += hours;
    const [a, b] = INJURY.knox.fullCourseHours;
    const course = a + (b - a) * (body.knoxStart ?? 1);
    body.knox = Math.min(1, body.knoxTimer / course);
    if (body.knox >= 1) { body.dead = true; events.push({ type: 'zombified' }); }
  }
  // ---- 细菌感染：抗生素可治 ----
  if (body.infected) {
    body.infectionTimer += hours;
    if (body.antibioticTimer > 0) {
      body.antibioticTimer -= hours;
      body.infectionTimer -= hours * 3.5;                 // 抗生素加速清除
      if (body.infectionTimer <= 0) {
        body.infected = false; body.infectionTimer = 0;
        for (const k of BODY.parts) for (const i of body.parts[k].injuries) i.infected = false;
        events.push({ type: 'infectionCleared' });
      }
    } else if (body.infectionTimer > INJURY.woundInfection.sepsisHours) {
      body.dead = true;
      events.push({ type: 'died', part: 'sepsis' });
    }
  }

  // ---- 疼痛与药效 ----
  if (body.painkiller > 0) { body.painkiller = Math.max(0, body.painkiller - hours); pain *= 0.25; }
  if (body.beta > 0) body.beta = Math.max(0, body.beta - hours);
  if (body.knox > 0) pain += 0.25 * body.knox;
  body.pain = Math.min(1, pain);
  return events;
}

/** 疼痛等级 0..4 */
export function painTier(body) {
  const t = INJURY.pain.tiers;
  for (let i = t.length - 1; i >= 0; i--) if (body.pain * 100 >= t[i]) return i;
  return 0;
}

// ---------------- 处置动作 ----------------

export function bandage(body, part, sterile = false, disinfected = false) {
  const inj = body.parts[part]?.injuries.find((i) => !i.bandaged);
  if (!inj) return false;
  inj.bandaged = true;
  inj.dirty = false;
  inj.sterile = sterile;
  if (disinfected) inj.disinfected = true;
  inj.bandageAt = inj.ageHours;
  return true;
}

export function disinfect(body, part) {
  const list = body.parts[part]?.injuries || [];
  let any = false;
  for (const i of list) { i.disinfected = true; any = true; }
  return any;
}

export function stitch(body, part, firstAid = 0) {
  if (firstAid < 2) return { ok: false, reason: '急救等级不足 2 级，无法缝合' };
  const inj = body.parts[part]?.injuries.find((i) => INJURY.types[i.type].needsStitch && !i.stitches);
  if (!inj) return { ok: false, reason: '该部位没有需要缝合的伤口' };
  inj.stitches = true;
  inj.bandaged = true;
  return { ok: true };
}

export function splint(body, part, firstAid = 0) {
  if (firstAid < 1) return { ok: false, reason: '急救等级不足 1 级，无法上夹板' };
  const inj = body.parts[part]?.injuries.find((i) => INJURY.types[i.type].needsSplint && !i.splinted);
  if (!inj) return { ok: false, reason: '该部位没有需要固定的骨折' };
  inj.splinted = true;
  return { ok: true };
}

export function antibiotics(body) {
  body.antibioticTimer = INJURY.woundInfection.antibioticDoseHours;
  return true;
}

/** 受伤瞬间掷克诺克斯病毒（抓 7% / 撕裂 25% / 咬 100%） */
export function rollKnox(inj, armorReduce = 0) {
  if (inj.knoxRolled) return inj.knox;
  inj.knoxRolled = true;
  const def = INJURY.types[inj.type];
  const p = (def?.knox ?? 0) * (1 - armorReduce);
  inj.knox = Math.random() < p;
  return inj.knox;
}

/** 汇总：出血速率、是否骨折、最重伤情等，供 UI 与属性管道消费 */
export function summarize(body) {
  let bleed = 0, fractures = 0, worst = null, infectedCount = 0;
  for (const k of BODY.parts) {
    for (const i of body.parts[k].injuries) {
      if (i.bleed > 0 && !i.bandaged && !i.stitches) bleed += i.bleed;
      // 已上夹板的骨折不再计入惩罚（但依然需要数周才能长好）
      if (i.type === 'fracture' && !i.splinted) fractures++;
      if (i.infected) infectedCount++;
      if (!worst || INJURY.types[i.type].pain > INJURY.types[worst.type].pain) worst = i;
    }
  }
  return {
    bleeding: bleed > 0.05, bleedRate: bleed, fractures, infectedCount,
    worst, bloodPct: body.blood / INJURY.blood.total,
  };
}
