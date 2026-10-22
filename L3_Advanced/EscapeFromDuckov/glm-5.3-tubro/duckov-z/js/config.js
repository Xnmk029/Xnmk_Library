/* DUCKOV Z - 全局配置与平衡数值 */
(function (DZ) {
  'use strict';
  const C = {
    TILE: 32, MW: 132, MH: 96,
    SCALE_MIN: 1.0, SCALE_MAX: 2.0, SCALE_DEF: 1.35,
    RSPM: 0.5,                 // 真实秒 / 游戏分钟 (1天=12现实分钟)
    SLEEP_SPEED: 24,           // 睡觉时间加速倍率
    POWER_OFF_MIN: 2 * 1440 + 12 * 60,   // Day2 12:00 断电(自Day1 00:00起的总分钟)
    WATER_OFF_MIN: 4 * 1440 + 6 * 60,    // Day4 06:00 断水
    EVAC_DAY: 7, EVAC_HOUR: 12, EVAC_WINDOW_H: 3, // D7正午直升机，窗口3小时
    NIGHT_START: 20 * 60, NIGHT_END: 6 * 60,
    Z_COUNT: 88,
    AUTOSAVE_SEC: 60,
    // 移动速度 tiles/s
    SPD: { walk: 3.3, run: 5.5, crouch: 1.7, aim: 2.1 },
    STAMINA: { max: 100, runDrain: 7.5, swingCost: 8, rollCost: 20, regenWalk: 5, regenIdle: 11, regenFit: 0.9 },
    // 消耗速率 per 游戏分钟
    RATE: { hunger: 100 / (36 * 60), thirst: 100 / (24 * 60), fatigueAwake: 100 / (17 * 60), fatigueSleep: 100 / (8 * 60) },
    WOUND: { scratchDmg: [4, 9], lacDmg: [10, 16], biteDmg: [16, 26], bleedScratch: 0.06, bleedLac: 0.16, bleedBite: 0.28 }, // bleed = hp/min
    INFECTION: { zvBiteH: 40, zvAntiH: 10, bactChance: 0.14, bactDays: 2.2 }, // zv=僵尸病毒(小时), anti=每剂抗生素延长
    PAINKILLER_H: 5, BETABLOCK_H: 4,
    NOISE: { crouchStep: 1.4, walkStep: 3.2, runStep: 8.5, gunPistol: 55, gunShotgun: 80, gunRifle: 66, meleeHit: 9, meleeWhiff: 4.5, windowBreak: 26, doorBang: 13, hammer: 18, chop: 16, explosion: 130, glassBreak: 22, pry: 10, climb: 5 },
    VISION: { dayR: 13.5, nightR: 2.6, indoorLitR: 7.5, indoorDarkR: 2.8, fogMul: 0.62, rainMul: 0.82, stormMul: 0.66, crouchMul: 0.72, flashCone: { r: 9.5, half: 34 * Math.PI / 180 } },
    ZOMBIE: {
      types: {
        shambler: { hp: 55, spd: 1.0, dmg: 8, sight: 11, scale: 1.0, w: 1 },
        walker:   { hp: 78, spd: 1.75, dmg: 11, sight: 13, scale: 1.05, w: 5 },
        jogger:   { hp: 90, spd: 2.65, dmg: 13, sight: 15, scale: 1.0, w: 2 },
        sprinter: { hp: 70, spd: 4.4, dmg: 15, sight: 17, scale: 0.95, w: 0.45 },
        tank:     { hp: 240, spd: 1.25, dmg: 22, sight: 12, scale: 1.38, w: 0.5 }
      },
      attackRange: 1.0, windup: 0.55, cooldown: 1.4, grabRange: 0.95,
      hearMod: 1.0, groanAlertR: 8, loseSecs: 6
    },
    GUNS: {
      pistol:   { name: 'M1911 手枪', dmg: 36, mag: 7, ammo: 'ammo9', rof: 0.38, spread: 4.5, aimSpread: 1.6, range: 16, noise: 55, reload: 1.6, pellets: 1, tracer: '#ffd27a' },
      shotgun:  { name: '泵动霰弹枪', dmg: 13, mag: 5, ammo: 'shell', rof: 0.95, spread: 9, aimSpread: 7, range: 10, noise: 80, reload: 0.75, pellets: 6, tracer: '#fff3c8' },
      rifle:    { name: '栓动猎步枪', dmg: 95, mag: 5, ammo: 'ammoR', rof: 1.25, spread: 1.2, aimSpread: 0.25, range: 30, noise: 66, reload: 2.4, pellets: 1, tracer: '#bff2ff' }
    },
    SKILLS: ['strength', 'fitness', 'aiming', 'reload', 'firstaid', 'carpentry'],
    SKILL_NAMES: { strength: '力量', fitness: '体格', aiming: '射击', reload: '装填', firstaid: '急救', carpentry: '木工' },
    XP_PER_LV: lv => 60 + lv * 55,
    BODY: {
      parts: [
        { id: 'head', name: '头部', hp: 30, hitW: 0.10 },
        { id: 'torso', name: '躯干', hp: 55, hitW: 0.33 },
        { id: 'armL', name: '左臂', hp: 32, hitW: 0.10 },
        { id: 'armR', name: '右臂', hp: 32, hitW: 0.10 },
        { id: 'legL', name: '左腿', hp: 36, hitW: 0.185 },
        { id: 'legR', name: '右腿', hp: 36, hitW: 0.185 }
      ]
    },
    WEIGHT: { baseCap: 8, perStr: 0.45, packs: { pack_s: 6, pack_l: 12, milpack: 17 } },
    OVERWEIGHT_TIERS: [1.05, 1.18, 1.32, 1.5], // 超重倍率阈值→减速分档
    EVAC_FUEL_NEEDED: 3,
    PAL: {
      outline: '#23262d',
      grassA: '#5a6b4f', grassB: '#54654a', dirt: '#6e5f49',
      road: '#43464c', roadLine: '#9a9da3', sidewalk: '#75787d', lot: '#4a4d52',
      wallExt: '#8a7a63', wallTop: '#9c8b72', wallInt: '#77685c',
      floorWood: '#8f7355', floorWoodB: '#82684c', floorTile: '#a3a8ab', floorTileB: '#969b9e', floorGym: '#b08d5f',
      turf: '#53704a', heli: '#5d7a54',
      roofA: '#6d5147', roofB: '#5d6470', roofC: '#706252', roofMetal: '#68707a',
      water: '#3f5a6b',
      duck: '#ffd23f', duckShade: '#dfa92e', duckBelly: '#ffe58a', beak: '#ff9330', beakDark: '#e0762a',
      zSkin: '#93a46f', zShade: '#74855a', zEye: '#1c2016',
      feather: '#fff6df', featherY: '#ffe08a',
      treeTrunk: '#5d4a36', treeA: '#48603f', treeB: '#3e5537',
      carCols: ['#7d8288', '#8c6f52', '#5f7285', '#85565a', '#6d7a63', '#93948d'],
      uiAmber: '#ffb454', danger: '#ff5a49', ok: '#79c26a'
    },
    AMBIENT_KEYS: [ // [hour, rgb]
      [0, 12, 18, 42], [4.4, 12, 18, 42], [5.6, 74, 62, 84], [6.6, 190, 150, 120],
      [8, 255, 250, 240], [16.5, 255, 248, 235], [18.3, 235, 170, 110], [19.6, 120, 84, 96],
      [20.8, 22, 28, 56], [24, 12, 18, 42]
    ],
    WEATHERS: ['clear', 'cloudy', 'fog', 'rain', 'storm'],
    WEATHER_NAMES: { clear: '晴朗', cloudy: '阴云', fog: '浓雾', rain: '降雨', storm: '雷暴' },
    MOODLES_META: {
      hungry:   { icon: '🍖', name: '饥饿' }, thirsty: { icon: '💧', name: '口渴' },
      tired:    { icon: '😴', name: '疲劳' }, pain:    { icon: '🤕', name: '疼痛' },
      panic:    { icon: '😰', name: '恐慌' }, bleed:   { icon: '🩸', name: '流血' },
      fract:    { icon: '🦴', name: '骨折' }, sick:    { icon: '🤢', name: '感染' },
      chilled:  { icon: '🥶', name: '湿冷' }, heavy:   { icon: '🎒', name: '超重' },
      exhausted:{ icon: '💀', name: '力竭' }, drunkZ:  { icon: '☣️', name: '病毒' }
    }
  };
  DZ.C = C;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
