// 《僵尸毁灭工程》数值总表 —— 全部可调平衡量集中于此，代码里禁止散落魔法数字。
// 数值来源：PZ Wiki（Build 42.x），为 Demo 节奏做了少量压缩（见 TIME）。
export const TIME = {
  minutesPerRealSecond: 1,      // 1 真实秒 = 1 游戏分钟 → 24 分钟/游戏日
  dayStartHour: 7,
  speeds: [1, 2, 5, 20],
  dawnAt: 300,                  // 05:00 天亮
  duskAt: 1140,                 // 19:00 天黑
};

/** 归一化日照相位 0..1（0=天亮瞬间，0.5=正午，1=天黑瞬间） */
export const daylightT = (minutes) => {
  const t = (minutes - TIME.dawnAt) / (TIME.duskAt - TIME.dawnAt);
  return t < 0 ? 0 : t > 1 ? 1 : t;
};
/** 日照强度 0..1：正弦的 0.8 次幂，让晨昏过渡平缓而不是"瞬间天黑" */
export const daylightK = (minutes, weatherMul = 1) =>
  Math.pow(Math.sin(daylightT(minutes) * Math.PI), 0.8) * weatherMul;

export const BODY = {
  // 9 部位简化模型（PZ 原版 17 部位，手脚并入四肢）
  parts: ['head', 'neck', 'torso_up', 'torso_low', 'arm_l', 'arm_r', 'leg_l', 'leg_r', 'groin'],
  partHp: { head: 22, neck: 18, torso_up: 30, torso_low: 26, arm_l: 20, arm_r: 20, leg_l: 20, leg_r: 20, groin: 18 },
  // 总生命 = Σ partHp × weight
  partWeight: { head: 1.4, neck: 1.2, torso_up: 1.5, torso_low: 1.2, arm_l: .7, arm_r: .7, leg_l: .8, leg_r: .8, groin: .8 },
  // 疼痛部位权重（PZ wiki）
  painWeight: { head: .8, neck: .8, torso_up: .8, torso_low: .78, arm_l: .65, arm_r: .65, leg_l: .7, leg_r: .7, groin: .7 },
  // 致命部位：归零即死
  lethal: { head: true, neck: true, torso_up: true, torso_low: true },
  // 该部位受伤对各能力的影响系数上限
  limbPenalty: { leg: { speed: .42, aim: 0 }, arm: { swing: .55, aim: .3 }, head: { aim: .55 } },
  healPerHour: {                 // 每游戏小时自然愈合（部位 HP）
    base: 0.9,
    wellFedMul: 8.5,             // 吃饱 moodle 愈合 +750%
    starvingMul: 0.45,           // 饥饿 45%：愈合 −55%
    starvingHardMul: 0.0,        // 饥饿 70%：完全停止
    hypothermiaMul: 0.0,         // 核心体温 <36.5 停止自然愈合
    sleepingMul: 1.6,
  },
};

export const INJURY = {
  // 伤情 → 出血(ml/游戏分钟)、基础愈合(游戏小时)、Knox 感染率
  types: {
    scratch:    { bleed: 0.9, heal: 11, knox: 0.07, pain: 0.35, name: '抓伤' },
    laceration: { bleed: 2.2, heal: 15, knox: 0.25, pain: 0.60, name: '撕裂伤' },
    bite:       { bleed: 2.6, heal: 65, knox: 1.00, pain: 0.75, name: '咬伤' },
    deep:       { bleed: 3.4, heal: 17, knox: 0.00, pain: 0.70, name: '深度伤口', needsStitch: true },
    bullet:     { bleed: 4.2, heal: 20, knox: 0.00, pain: 0.80, name: '枪伤（弹头滞留）', needsStitch: true },
    fracture:   { bleed: 0.0, heal: 336, knox: 0.00, pain: 0.90, name: '骨折', needsSplint: true }, // 2 游戏周
    burn:       { bleed: 0.4, heal: 75, knox: 0.00, pain: 0.85, name: '烧伤' },
    gunshot:    { bleed: 3.0, heal: 30, knox: 0.00, pain: 0.70, name: '贯穿枪伤' },
  },
  // 包扎相关
  bandage: {
    dirtyAfterHours: 36,         // 36 游戏小时后绷带变脏
    infectionAfterHours: 72,     // 3 天以上必感染
    dirtyInfectionPerHour: 0.006,// 脏绷带每小时累计感染概率
    disinfectMul: 0.25,          // 消毒后感染概率 ×0.25
    firstAidMul: 0.55,           // 急救等级减成（每级再 −5%）
  },
  woundInfection: {
    onsetHours: [12, 48],        // 感染 → 发作
    sepsisHours: 168,            // 约 1 周败血症
    antibioticDoseHours: 6,      // 每 6 游戏小时一次
    antibioticClearHours: [24, 48],
    healPenalty: 0.45,
  },
  knox: {                        // 无解。100% 咬伤 / 25% 撕裂 / 7% 抓伤
    stages: [
      { at: 0.00, moodles: ['queasy'], fever: 0 },
      { at: 0.15, moodles: ['queasy', 'anxious'], fever: 0 },
      { at: 0.35, moodles: ['nauseous', 'fever'], fever: 1, craftMul: 2.2 },
      { at: 0.62, moodles: ['sick', 'fever'], fever: 2, craftMul: 2.8 },
      { at: 0.85, moodles: ['verySick'], fever: 3, unconscious: true },
    ],
    incubationHours: [6, 72],    // 6 小时 ~ 3 天
    fullCourseHours: [48, 96],   // 2 ~ 4 天后死亡
    armorReduce: 0.55,           // 防刺/防护服降低感染概率
  },
  pain: {
    tiers: [0, 15, 35, 60, 85],
    tripChance: [0, .05, .10, .15, .20],
    sleepBlockedFrom: 2,
    vocalizeFrom: 3,             // 3 级起疼痛呻吟 → 发出噪音
    meleeDamageMul: [1, 1, .8, .7, .6],
  },
  blood: {
    total: 5000,                 // ml
    regenPerHour: 55,
    lightheadAt: .75, shockAt: .55, unconsciousAt: .35, deathAt: .12,
  },
};

export const MOODLE = {
  // 阈值 → 等级（0..4）；效果由 statPipeline 消费
  thresholds: {
    hungry:    { t: [0, 25, 45, 70, 90], good: false },
    thirsty:   { t: [0, 25, 45, 70, 90], good: false },
    tired:     { t: [0, 30, 55, 75, 90], good: false },
    bored:     { t: [0, 30, 55, 75, 90], good: false },
    stress:    { t: [0, 25, 45, 65, 85], good: false },
    panic:     { t: [0, 15, 35, 60, 85], good: false,
                 gainPerZombie: 3, gainPerMinute: 0.5, recoverPerSec: 1.75, desensitizeDays: 150 },
  },
  // Heavy Load：容量占比 → 效果
  heavyLoad: [
    { at: 1.00, speed: .81, crit: -.05, atkSpeed: .93, drain: 0 },
    { at: 1.25, speed: .63, crit: -.10, atkSpeed: .86, drain: 0, noSprint: true },
    { at: 1.50, speed: .44, crit: -.15, atkSpeed: .79, drain: .004, noRun: true, drainTo: .75 },
    { at: 1.75, speed: .25, crit: -.20, atkSpeed: .72, drain: .012, noRun: true, drainTo: .60 },
  ],
  // Endurance（已耗比例）→ 效果
  endurance: [
    { at: .25, melee: .50, atkSpeed: .93, speed: .81 },
    { at: .50, melee: .20, atkSpeed: .86, speed: .63, noSprint: true },
    { at: .75, melee: .10, atkSpeed: .79, speed: .44, noRun: true },
    { at: .90, melee: .05, atkSpeed: .72, speed: .25, noHeavy: true },
  ],
  // 恐慌对远程精度的惩罚：等级 × (4 + 0.5 × 格数)
  panicAccuracy: { base: 4, perTile: 0.5, immuneAimingLevel: 6, braveMul: .3, cowardlyMul: 2 },
  // 体温
  hypo: [ { at: 36.5, heal: 0, coldRisk: .02 }, { at: 35, combat: .67, speed: .67 },
          { at: 30, combat: .34, speed: .34 }, { at: 25, combat: .10, speed: .0 } ],
};

export const NEEDS = {
  hungerPerHour: 4.32,           // %/游戏小时
  thirstPerHour: 6.10,
  fatiguePerHourAwake: 5.60,
  fatigueRecoverPerHourSleep: 12.5,
  boredomPerHourIndoors: 4.20,
  stressGainPerVisibleZombie: 0.35,   // %/游戏分钟
  stressDecayPerHour: 3.2,
  weight: { default: 80, min: 35, max: 100, gainThreshold: 1000, loseThresholdBase: 30 },
  nutrition: { min: -500, max: 1000, calMin: -2200, calMax: 3700 },
  starvationDrainPerHour: 4.4,   // 饥饿 70% 时 %HP/小时
  dehydrationDrainPerHour: 6.8,
  foodPoisoning: { hours: [6, 24], drainPerHour: 1.6 },
  corpseSickness: { radius: 8, moodleAt: 3, hours: [2, 6] },
  cold: { hours: [48, 72], wetThreshold: .35, tempThreshold: 18 },
};

export const NOISE = {
  whisper: 6, sneak: 3.5, walk: 7, run: 14, shout: 30, fire: 20,
  gun: { pistol: 60, smg: 90, rifle: 140, shotgun: 200, sniper: 170, suppressedMul: 0.25 },
  carHorn: 150, alarm: 600, sneeze: 40, cough: 35, generator: 22, sledge: 25,
  chopper: 500, breakingGlass: 55, door: 18,
};

export const WORLD_EVENT = {
  helicopter: { dayRange: [6, 9], hourRange: [9, 18], lingerMinutes: 60, broadcastLead: 20 },
  powerShutoff: { dayRange: [14, 30], broadcastLeadDays: 2 },
  waterShutoff: { dayRange: [0, 30] },
  zombiePeakDay: 30,
  metaEventPerDay: 1,
};

export const SKILL = {
  maxLevel: 10,
  xpCurve: (lv) => 75 * Math.pow(1.28, lv),     // 升级所需 XP
  // 起始等级 → XP 倍率（PZ：0级25% / 1级100% / 2级133% / 3+级166%）
  startXpMul: [0.25, 1.0, 1.33, 1.66],
  aiming: { recoilPerLevel: -2, panicImmuneLevel: 6, xpFalloffFromLevel: 5 },
  nimble: { combatWalkFrom: 1.0, combatWalkTo: 1.5, footstepFrom: 1.0, footstepTo: 0.5 },
  sneaking: { noiseFrom: .24, noiseTo: .08, detectFrom: 1.14, detectTo: .48 },
  bookVolumes: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
};

export const COMBAT = {
  armorFormula: (base, armorLvl, penLvl) => base * (2 / (armorLvl - penLvl + 2)),
  critBase: 0.05,
  critHeadMul: 3.2,
  jamChanceBase: 0.012,         // 每发卡壳基础概率（被维护技能与耐久修正）
  durabilityLossPerShot: 1,
  melee: { pushArc: 1.1, pushRange: 1.5, stompDamage: 6, shoveStamina: 4 },
  stamina: { max: 100, sprintDrain: 8.5, runDrain: 4.2, walkRegen: 6.0, restRegen: 12.0,
             swingCost: 2.5, dodgeCost: 12, pushCost: 4 },
  move: { walk: 2.9, run: 4.3, sprint: 5.6, sneak: 1.35, crouchMul: .55, rollSpeed: 9.5, rollTime: .3, iFrame: .26 },
  carry: { base: 12, perStrength: 1.6, backpack: 0 },       // kg
};

export const VISION = {
  playerFovDeg: 110,
  rays: 180,
  baseSightRange: 22,
  nightMul: 0.42,               // 夜晚视距 −58%
  rainMul: 0.82, fogMul: 0.60, stormMul: 0.48,
  flashlightRange: 15,
  flashlightFovDeg: 46,
  enemyFovDeg: 100,
  enemySightRange: 15,
  enemyHearingMul: 1.0,
  memorySec: 6,                 // 失去目标后仍追多久
};

export const LOOT = {
  luckyMulPerLevel: 0.12,       // 幸运特质：稀有度权重 +12%/级
  containerCapacity: [4, 14],
  respawnHours: [12, 36],
};

export const EXTRACT = {
  channelSeconds: 6,
  raidMinutes: 45,
  overtimeHordePerMinute: 6,
};

export const RENDER = {
  orthoSize: 7,
  pitchDeg: 56,
  yawDeg: 0,
  fowCanvasSize: 256,
  fowExploredSize: 128,
  fowUploadHz: 15,
  fowAlpha: 0.86,
  outlineWidth: 0.035,
  outlineMaxDist: 28,
  shadowMapSize: 1024,
  shadowUpdateEvery: 3,
  maxParticles: 900,
};
