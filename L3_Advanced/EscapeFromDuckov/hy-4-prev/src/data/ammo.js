// 弹药：口径 × 等级。等级决定穿透（甲弹关系的核心），曳光颜色是玩家读战场信息的唯一线索。
export const TIER = { NORMAL: 1, BLUE: 3, PURPLE: 5, STORM: 7 };

export const TIER_INFO = {
  1: { name: '常规弹', color: 0xffa63a, dmgMul: 1.00, noiseMul: 1.00, tracer: 0xffb347 },
  3: { name: '蓝弹·穿甲', color: 0x4aa3d6, dmgMul: 1.08, noiseMul: 1.05, tracer: 0x5cb8f0 },
  5: { name: '紫弹·高阶穿甲', color: 0xa56ad6, dmgMul: 1.18, noiseMul: 1.10, tracer: 0xc07cf0 },
  7: { name: '风暴能量弹', color: 0x4ad6c8, dmgMul: 1.35, noiseMul: 0.85, tracer: 0x6ff0e4 },
};

/** 口径 → 基础伤害/初速/噪音 */
export const CALIBER = {
  '9mm': { base: 26, speed: 120, noise: 60, name: '9×19mm' },
  '.45': { base: 32, speed: 105, noise: 66, name: '.45 ACP' },
  '5.56': { base: 36, speed: 190, noise: 120, name: '5.56×45mm' },
  '7.62': { base: 48, speed: 165, noise: 140, name: '7.62×39mm' },
  '7.62x54': { base: 62, speed: 200, noise: 170, name: '7.62×54mmR' },
  '12g': { base: 18, pellets: 8, speed: 95, noise: 200, name: '12 号霰弹' },
  '.50': { base: 110, speed: 240, noise: 190, name: '.50 BMG' },
};

/** 一份具体弹药实例的数据：{ id, caliber, tier } */
export function ammoStats(caliber, tier = TIER.NORMAL) {
  const c = CALIBER[caliber];
  const t = TIER_INFO[tier] || TIER_INFO[TIER.NORMAL];
  return {
    caliber,
    tier,
    name: `${c.name} ${t.name}`,
    damage: c.base * t.dmgMul,
    pen: tier,                     // 穿透等级 = 弹药等级
    pellets: c.pellets || 1,
    speed: c.speed,
    noise: c.noise * t.noiseMul,
    tracer: t.tracer,
    color: t.color,
  };
}

export const AMMO_IDS = (() => {
  const out = {};
  for (const cal in CALIBER) {
    for (const tier of [1, 3, 5, 7]) {
      const id = `${cal}_${tier}`;
      out[id] = { id, caliber: cal, tier, ...ammoStats(cal, tier) };
    }
  }
  return out;
})();
