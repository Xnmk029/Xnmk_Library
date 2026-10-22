import { clamp, lerp } from './util.js';
import { SKILLS, XP_PER_LEVEL } from './chardata.js';

// ================= 角色状态：部位健康 / 体征 / 心情 / 技能 =================
export const PART_DEFS = [
  { id: 'head', name: '头部', crit: true, zone: 'head', icon: '🦆' },
  { id: 'torso', name: '躯干', crit: true, zone: 'torso', icon: '🫁' },
  { id: 'upperBack', name: '上背', zone: 'torso', icon: '🎒' },
  { id: 'groin', name: '腹股沟', crit: true, zone: 'torso', icon: '🦴' },
  { id: 'armL', name: '左臂', zone: 'arms', icon: '💪' },
  { id: 'armR', name: '右臂', zone: 'arms', icon: '💪' },
  { id: 'handL', name: '左手', zone: 'hands', icon: '🤚' },
  { id: 'handR', name: '右手', zone: 'hands', icon: '✋' },
  { id: 'legL', name: '左腿', zone: 'legs', icon: '🦵' },
  { id: 'legR', name: '右腿', zone: 'legs', icon: '🦵' },
  { id: 'footL', name: '左脚', zone: 'feet', icon: '🦶' },
  { id: 'footR', name: '右脚', zone: 'feet', icon: '🦶' },
];

export class Stats {
  constructor(game, p, def) {
    this.game = game;
    this.p = p;
    this.d = def;
    this.parts = {};
    for (const pd of PART_DEFS) this.parts[pd.id] = { hp: 100, maxHp: 100, bleed: 0, fracture: false, deep: false, bandaged: false, infected: false, splinted: false, glass: false, burn: false };
    // 体征
    this.hunger = 78; this.thirst = 80; this.fatigue = 6; this.stamina = 100; this.endurance = 100;
    this.panic = 0; this.stress = 0; this.boredom = 0; this.pain = 0; this.drunk = 0;
    this.drowsy = 0; this.sick = 0; this.foodSick = 0; this.fever = 0;
    this.blood = 100;
    this.damageFx = 0;
    // 丧尸感染
    this.knox = 0; this.knoxProg = 0; this.knoxTimer = 0;
    // 技能
    this.skills = {};
    for (const s of SKILLS) this.skills[s.id] = { lvl: 0, xp: 0, mult: 1 };
    // buffs
    this.buffs = [];
    this.applyDef();
    this.kills = 0; this.daysSurvived = 0;
    this._acc = 0;
  }
  applyDef() {
    const d = this.d;
    // 派生系数（先取默认值，再由特质修改）
    this.carryMult = 1; this.endurRegenMult = 1; this.panicGainMult = 1; this.infectMult = 1;
    this.xpMult = 1; this.visionMult = 1; this.luck = 0; this.foodSickMult = 1;
    this.coldMult = 1; this.noiseMult = 1; this.hungerRate = 1; this.fatigueRate = 1;
    this.stressGainMult = 1; this.nightVisionMult = 1; this.sneakNoiseMult = 1;
    this.kbMult = 1; this.rollMult = 1; this.rollStamMult = 1; this.bagCapMult = 1;
    this.strength = 5; this.fitness = 5;
    for (const t of d.traits) t.fn(this);
    for (const [sid, lvl] of Object.entries(d.profSkills)) this.setSkill(sid, lvl);
    this.maxCarry = 6 + this.strength * 1.5 + this.fitness * 0.4;
  }
  setSkill(id, lvl) {
    const s = this.skills[id];
    if (!s) return;
    s.lvl = Math.max(s.lvl, lvl);
    s.xp = Math.max(s.xp, XP_PER_LEVEL(s.lvl));
  }
  addXp(id, amt) {
    const s = this.skills[id];
    if (!s || s.lvl >= 10) return;
    const book = this.bookBoost(id);
    s.xp += amt * this.xpMult * (book ? 3 : 1);
    while (s.lvl < 10 && s.xp >= XP_PER_LEVEL(s.lvl)) {
      s.xp -= XP_PER_LEVEL(s.lvl);
      s.lvl++;
      this.game.toast('⬆ ' + SKILLS.find(k => k.id === id).name + ' 提升到 ' + s.lvl + ' 级', 'good');
      this.game.events.emit('skillup', { id, lvl: s.lvl });
    }
  }
  bookBoost(id) {
    // 检查装备槽 book
    const b = this.p.equip.book;
    return b && b.item.bookSkill === id && this.skills[id].lvl <= b.item.bookLvl;
  }
  get totalPain() {
    let pain = this.pain;
    for (const pd of PART_DEFS) {
      const pt = this.parts[pd.id];
      if (pt.bleed > 0) pain += 3 + pt.bleed * 4;
      if (pt.fracture) pain += 18;
      if (pt.deep) pain += 8;
      if (pt.burn) pain += 10;
    }
    return clamp(pain, 0, 100);
  }
  get bodyHealth() {
    let s = 0, n = 0;
    for (const pd of PART_DEFS) { s += this.parts[pd.id].hp; n += 1; }
    return s / n;
  }
  get moveSpeedMult() {
    let m = 1;
    for (const pd of PART_DEFS) {
      const pt = this.parts[pd.id];
      if (pt.fracture && pd.zone === 'legs') m *= 0.62;
      if (pt.hp < 30 && pd.zone === 'legs') m *= 0.82;
    }
    if (this.stamina < 20) m *= 0.8;
    if (this.totalPain > 60) m *= 0.9;
    if (this.drowsy > 85) m *= 0.9;
    return clamp(m, 0.3, 1);
  }
  get combatMult() {
    return clamp(this.stamina / 100, 0.4, 1) * (this.totalPain > 70 ? 0.8 : 1);
  }
  damagePart(id, amount, type = 'hit') {
    const pt = this.parts[id];
    if (!pt) return 0;
    // 护甲减免（鸭科夫甲弹公式，type 决定护甲类型）
    const gear = this.p.equip;
    let blocked = 0;
    if (type === 'bite' || type === 'scratch') {
      const zone = PART_DEFS.find(d => d.id === id).zone;
      const item = gear[zone];
      if (item && item.prot) {
        const pr = type === 'bite' ? item.prot.bite : item.prot.scratch;
        blocked = pr * 0.75;
        if (Math.random() < pr) {
          // 护甲吸收了攻击：耐久下降
          item.cond = (item.cond || 100) - (type === 'bite' ? 9 : 5);
          this.game.toast('🛡 护甲挡住了 ' + (type === 'bite' ? '撕咬' : '抓挠'), 'info');
          return 0;
        }
      }
    } else if (type === 'bullet') {
      const zone = PART_DEFS.find(d => d.id === id).zone;
      const item = gear[zone];
      if (item && item.armor) {
        const dmg = amount * (2 / (item.armor - 2 + 2));
        pt.hp -= dmg;
        return dmg;
      }
    }
    pt.hp = clamp(pt.hp - amount, 0, pt.maxHp);
    if (pt.hp <= 0 && !pt.crit0) { pt.crit0 = true; }
    return amount;
  }
  applyZombieHit(zombie, rng) {
    // 选择部位
    const zoneRoll = rng();
    let partId;
    if (zoneRoll < 0.12) partId = 'head';
    else if (zoneRoll < 0.32) partId = 'torso';
    else if (zoneRoll < 0.47) partId = rng() < 0.5 ? 'armL' : 'armR';
    else if (zoneRoll < 0.6) partId = rng() < 0.5 ? 'handL' : 'handR';
    else if (zoneRoll < 0.85) partId = rng() < 0.5 ? 'legL' : 'legR';
    else partId = rng() < 0.5 ? 'footL' : 'footR';
    const pd = this.parts[partId];
    // 判定类型：抓/咬/裂伤
    const roll = rng();
    const gear = this.p.equip[PART_DEFS.find(d => d.id === partId).zone];
    let prot = gear && gear.prot ? (gear.prot.bite + gear.prot.scratch) / 2 : 0;
    let type = roll < 0.62 - prot * 0.3 ? 'scratch' : roll < 0.88 ? 'laceration' : 'bite';
    let dmg = type === 'bite' ? 28 : type === 'laceration' ? 18 : 8;
    if (this.damagePart(partId, dmg, type) === 0) return { hit: false, type: 'blocked' };
    const def = PART_DEFS.find(d => d.id === partId);
    this.game.audio.hurt();
    this.game.ui.damageFlash();
    if (type === 'laceration') pd.deep = true;
    if (type === 'bite' || type === 'laceration') pd.bleed += type === 'bite' ? 3 : 2;
    else pd.bleed += 1;
    // 撕咬必传染，裂伤/抓伤有概率
    let infectP = type === 'bite' ? 1.0 : type === 'laceration' ? 0.25 : 0.07;
    infectP *= this.infectMult * (gear && gear.prot ? 1 - gear.prot.bite * 0.6 : 1);
    if (Math.random() < infectP && !this.knox) {
      this.knox = 1;
      this.knoxTimer = 32 + Math.random() * 20; // 游戏小时内发作死亡
      this.game.toast('☠ 你被感染了…… 这不是普通的伤口。', 'warn');
      this.game.events.emit('infected');
    }
    this.game.toast((type === 'bite' ? '🦷 被咬伤：' : type === 'laceration' ? '🩸 裂伤：' : '🐾 被抓伤：') + def.name, 'warn');
    return { hit: true, type, partId };
  }
  bandage(partId, item) {
    const pt = this.parts[partId];
    if (!pt || pt.bleed <= 0) return '没有流血伤口';
    const h = item.heal || {};
    pt.bleed = clamp(pt.bleed - (h.stopBleed || 1), 0, 2);
    pt.bandaged = true;
    pt.healRate = (h.healRate || 1) + this.skills.firstaid.lvl * 0.3;
    if (h.infectRed) pt.infected = false;
    this.game.audio.bandage();
    this.addXp('firstaid', 5);
    if (pt.bleed > 0) return '伤口过大，仍需更多绷带';
    return null;
  }
  disinfect(partId) {
    const pt = this.parts[partId];
    if (!pt || !pt.deep) return '没有需要消毒的伤口';
    pt.infected = false;
    this.addXp('firstaid', 3);
    return null;
  }
  splint(partId) {
    const pt = this.parts[partId];
    if (!pt || !pt.fracture) return '没有骨折';
    pt.fracture = false; pt.splinted = true;
    this.game.audio.bandage();
    this.addXp('firstaid', 8);
    return null;
  }
  useItem(item) {
    const st = this;
    if (item.pain) { st.pain = clamp(st.pain + item.pain, 0, 100); if (item.painDur) st.buff('painkill', item.painDur, { painMask: -item.pain / item.painDur }); }
    if (item.sick) { st.sick = clamp(st.sick + item.sick, 0, 100); }
    if (item.fatigue) st.fatigue = clamp(st.fatigue + item.fatigue, 0, 100);
    if (item.sleepiness) st.drowsy = clamp(st.drowsy + item.sleepiness, 0, 100);
    if (item.panic) st.panic = clamp(st.panic + item.panic, 0, 100);
    if (item.drunk) st.drunk = clamp(st.drunk + item.drunk, 0, 100);
    if (item.happy) st.boredom = clamp(st.boredom - item.happy, 0, 100);
    if (item.unhappy) st.boredom = clamp(st.boredom + item.unhappy, 0, 100);
  }
  buff(name, hours, effect) {
    this.buffs.push({ name, until: this.game.env.hour + hours, effect });
  }
  tickBuffs() {
    const now = this.game.env.hour;
    this.buffs = this.buffs.filter(b => {
      if (now < b.until) { if (b.effect.painMask) this.pain = clamp(this.pain + b.effect.painMask, 0, 100); return true; }
      return false;
    });
  }
  eat(item, raw = false) {
    if (!item) return;
    const st = this;
    let hunger = raw ? (item.rawHunger || item.hunger * 0.5) : item.hunger;
    st.hunger = clamp(st.hunger - hunger, 0, 100);
    if (item.thirst > 0) st.thirst = clamp(st.thirst + item.thirst, 0, 100);
    else if (item.thirst < 0) st.thirst = clamp(st.thirst - item.thirst, 0, 100);
    if (item.happy) st.boredom = clamp(st.boredom - item.happy, 0, 100);
    if (item.unhappy) st.boredom = clamp(st.boredom + item.unhappy, 0, 100);
    if (item.pain) st.pain = clamp(st.pain + item.pain, 0, 100);
    if (item.drunk) st.drunk = clamp(st.drunk + item.drunk, 0, 100);
    if (item.fatigue) st.fatigue = clamp(st.fatigue + item.fatigue, 0, 100);
    if (item.spoil !== undefined && item.spoil >= 0 && item.spoil < 0.5 && item.spoilPercent !== undefined) {
      const rot = item.spoilPercent > 0.7 ? 25 : item.spoilPercent > 0.35 ? 8 : 2;
      st.foodSick += rot * st.foodSickMult;
      if (st.foodSick > 30) st.sick = clamp(st.sick + 6, 0, 100);
    }
    this.game.audio.eat();
    if (item.keepsContainer) this.p.giveItem('bottle', 1, { silent: true });
  }
  drink(item) {
    if (!item) return;
    this.thirst = clamp(this.thirst - item.thirst, 0, 100);
    if (item.hunger) this.hunger = clamp(this.hunger + (item.hunger < 0 ? item.hunger : item.hunger), 0, 100);
    this.game.audio.drink();
  }
  // 低频状态推进（每 0.25 秒真实时间调用一次，按游戏时间折算）
  tick(dt) {
    const g = this.game;
    const gameHours = dt / 3600 * 60 / g.cfg.dayLenHours;
    // 基础代谢（每游戏小时）
    const baseHunger = 2.2 * this.hungerRate, baseThirst = 3.2;
    this.hunger = clamp(this.hunger - baseHunger * gameHours, 0, 100);
    this.thirst = clamp(this.thirst - baseThirst * gameHours, 0, 100);
    const fRate = 2.6 * this.fatigueRate;
    this.fatigue = clamp(this.fatigue + fRate * gameHours * (this.p.moving ? 1.6 : 0.75), 0, 100);
    if (this.fatigue > 70) this.drowsy = clamp(this.drowsy + 4 * gameHours, 0, 100);
    else this.drowsy = clamp(this.drowsy - 6 * gameHours, 0, 100);
    this.boredom = clamp(this.boredom + 0.8 * gameHours, 0, 100);
    this.drunk = clamp(this.drunk - 4 * gameHours, 0, 100);
    // 疼痛
    this.pain = clamp(this.pain - 1.2 * gameHours, 0, 100);
    // 恐慌：附近丧尸驱动
    const zs = g.zombies ? g.zombies.nearbyThreat() : 0;
    const targetPanic = clamp(zs * 12 * this.panicGainMult - this.skills.sneaking.lvl * 2, 0, 100);
    this.panic = lerp(this.panic, targetPanic, 0.08);
    if (g.env.isNight && zs === 0) this.panic = clamp(this.panic - 2 * gameHours, 0, 100);
    // 压力
    let stressGain = 0;
    if (this.panic > 60) stressGain += 3;
    for (const pd of PART_DEFS) if (this.parts[pd.id].bleed > 0) stressGain += 2;
    if (this.boredom > 85) stressGain += 1.5;
    this.stress = clamp(this.stress + stressGain * gameHours * this.stressGainMult, 0, 100);
    if (this.boredom > 90) { /* 抑郁 */ }
    // 疾病
    if (this.foodSick > 0) { this.foodSick = clamp(this.foodSick - 1.5 * gameHours, 0, 100); this.sick = clamp(this.sick + this.foodSick * 0.2 * gameHours, 0, 100); }
    this.sick = clamp(this.sick - 0.5 * gameHours, 0, 100);
    // 饥饿/口渴伤害
    if (this.hunger <= 0) this.damagePart('torso', 0.6 * gameHours * 60, 'starve');
    if (this.thirst <= 0) this.damagePart('torso', 1.1 * gameHours * 60, 'starve');
    if (this.blood < 100) this.blood = clamp(this.blood + 0.4 * gameHours, 0, 100);
    // 耐力
    const movingCost = this.p.moving ? (this.p.running ? 8.5 : this.p.crouching ? 1.8 : 2.6) : 0;
    const regen = 12 * this.endurRegenMult * (this.fatigue < 60 ? 1 : 0.55) * (this.hunger > 20 ? 1 : 0.5);
    this.stamina = clamp(this.stamina + (regen - movingCost) * dt, 0, 100);
    // 伤口
    let bleeding = 0;
    for (const pd of PART_DEFS) {
      const pt = this.parts[pd.id];
      if (pt.bleed > 0) bleeding += pt.bleed;
      if (pt.healRate && pt.bandaged && pt.hp < pt.maxHp) {
        pt.hp = clamp(pt.hp + pt.healRate * gameHours * 1.4, 0, pt.maxHp);
        if (pt.hp >= pt.maxHp) { pt.bandaged = false; pt.healRate = 0; }
      }
      if (pt.fracture && pt.splinted && gameHours > 0) { /* 夹板后逐步恢复，简化：一天后自愈 */ }
    }
    if (bleeding > 0) {
      this.blood = clamp(this.blood - bleeding * 1.6 * gameHours, 0, 100);
      if (this.blood < 55) this.damagePart('torso', 1.4 * gameHours * 60, 'bleed');
    }
    // 丧尸感染进程
    if (this.knox) {
      this.knoxProg += gameHours / this.knoxTimer;
      this.fever = clamp(this.knoxProg * 90, 0, 100);
      this.sick = clamp(this.sick + 1.2 * gameHours, 0, 100);
      if (this.fever > 60) this.pain = clamp(this.pain + 2 * gameHours, 0, 100);
      if (this.knoxProg >= 1) {
        g.events.emit('zombified');
      }
    }
    // 特效
    this.damageFx = lerp(this.damageFx, clamp((100 - this.bodyHealth) / 100 * 1.4 + bleeding * 0.15, 0, 1), 0.06);
    this.tickBuffs();
  }
  moodles() {
    const m = [];
    const add = (icon, name, lvl, desc) => m.push({ icon, name, lvl, desc });
    if (this.knox) add('☠️', '被感染', 4, '病毒的寒意正在体内扩散');
    else if (this.sick > 70) add('🤮', '重病', 3, '高烧不退');
    else if (this.sick > 35) add('🤢', '恶心', 2, '身体不适');
    if (this.hunger < 15) add('🦴', '濒死饥饿', 4, '再不吃东西就会死');
    else if (this.hunger < 40) add('🍽', '极度饥饿', 3, '饥饿难耐');
    else if (this.hunger < 65) add('🍗', '饥饿', 2, '肚子咕咕叫');
    else if (this.hunger < 82) add('🍎', '有点饿', 1, '想吃点东西');
    if (this.thirst < 15) add('🏜', '濒死脱水', 4, '喉咙像砂纸');
    else if (this.thirst < 40) add('🥵', '极度口渴', 3, '口干舌燥');
    else if (this.thirst < 65) add('💧', '口渴', 2, '想喝水');
    if (this.fatigue > 88) add('💤', '极度疲惫', 4, '随时会倒下');
    else if (this.fatigue > 70) add('😴', '疲惫', 3, '需要睡觉');
    else if (this.fatigue > 50) add('🥱', '困倦', 2, '开始犯困');
    if (this.drowsy > 75) add('😪', '昏昏欲睡', 3, '眼皮千斤重');
    if (this.panic > 75) add('😱', '极度恐慌', 4, '心脏狂跳');
    else if (this.panic > 50) add('😨', '恐慌', 3, '手心冒汗');
    else if (this.panic > 25) add('😟', '紧张', 2, '有点不安');
    if (this.stress > 80) add('😖', '精神崩溃', 4, '压力爆表');
    else if (this.stress > 55) add('😫', '压力山大', 3, '喘不过气');
    else if (this.stress > 30) add('😩', '压力', 2, '心烦意乱');
    if (this.boredom > 85) add('🥱', '无聊透顶', 3, '人生失去了意义');
    else if (this.boredom > 60) add('😑', '无聊', 2, '找点乐子吧');
    if (this.totalPain > 70) add('🤕', '剧痛', 4, '痛到视线模糊');
    else if (this.totalPain > 40) add('😣', '疼痛', 3, '伤口作痛');
    else if (this.totalPain > 20) add('🩹', '轻微疼痛', 2, '隐隐作痛');
    if (this.drunk > 40) add('🍺', '酩酊大醉', 3, '世界在旋转');
    else if (this.drunk > 15) add('🥂', '微醺', 1, '飘飘然');
    for (const pd of PART_DEFS) {
      const pt = this.parts[pd.id];
      if (pt.bleed > 0) add('🩸', '流血·' + pd.name, 3, '必须立刻止血');
      if (pt.fracture) add('🦴', '骨折·' + pd.name, 3, '需要夹板');
    }
    if (this.fever > 50) add('🌡', '发烧', 3, '体温异常升高');
    return m;
  }
  allParts() { return PART_DEFS.map(d => ({ def: d, pt: this.parts[d.id] })); }
  serialize() {
    return {
      parts: this.parts, skills: this.skills, buffs: this.buffs,
      hunger: this.hunger, thirst: this.thirst, fatigue: this.fatigue, stamina: this.stamina,
      endurance: this.endurance, panic: this.panic, stress: this.stress, boredom: this.boredom,
      pain: this.pain, drunk: this.drunk, drowsy: this.drowsy, sick: this.sick, foodSick: this.foodSick,
      fever: this.fever, blood: this.blood, damageFx: this.damageFx,
      knox: this.knox, knoxProg: this.knoxProg, knoxTimer: this.knoxTimer, kills: this.kills,
    };
  }
  deserialize(d) {
    for (const pid in d.parts) if (this.parts[pid]) Object.assign(this.parts[pid], d.parts[pid]);
    Object.assign(this.skills, d.skills);
    this.buffs = d.buffs || [];
    for (const k of ['hunger','thirst','fatigue','stamina','endurance','panic','stress','boredom','pain','drunk','drowsy','sick','foodSick','fever','blood','damageFx','knox','knoxProg','knoxTimer','kills']) {
      if (d[k] !== undefined) this[k] = d[k];
    }
  }
}
