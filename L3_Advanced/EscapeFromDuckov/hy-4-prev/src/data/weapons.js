// 武器与配件（文档 §4.1）。基础值 + 配件 add/mult 由 statPipeline 合成，这里只放纯数据。
export const WEAPONS = {
  m9: {
    id: 'm9', name: 'M9 手枪', kind: 'pistol', caliber: '9mm', magSize: 15,
    slots: ['muzzle', 'grip', 'mag'],
    base: { damage: 26, rpm: 420, recoil: 6, ergonomics: 72, noise: 60, range: 18, spread: 2.2, aimTime: 0.18, weight: 1.1 },
    auto: false, tier: 1, desc: '可靠的自卫手枪，噪音低。',
  },
  mp5: {
    id: 'mp5', name: 'MP5 冲锋枪', kind: 'smg', caliber: '9mm', magSize: 30,
    slots: ['scope', 'muzzle', 'grip', 'stock', 'mag'],
    base: { damage: 27, rpm: 800, recoil: 7, ergonomics: 65, noise: 90, range: 22, spread: 3.0, aimTime: 0.22, weight: 2.8 },
    auto: true, tier: 2, desc: '高射速，适合室内清场。',
  },
  akm: {
    id: 'akm', name: 'AKM 突击步枪', kind: 'ar', caliber: '7.62', magSize: 30,
    slots: ['scope', 'muzzle', 'grip', 'stock', 'mag'],
    base: { damage: 48, rpm: 600, recoil: 12, ergonomics: 48, noise: 140, range: 34, spread: 3.4, aimTime: 0.34, weight: 3.6 },
    auto: true, tier: 3, desc: '硬派主力，后坐力大但停止作用强。',
  },
  mcx: {
    id: 'mcx', name: 'MCX Spear', kind: 'ar', caliber: '5.56', magSize: 30,
    slots: ['scope', 'muzzle', 'grip', 'stock', 'mag'],
    base: { damage: 38, rpm: 700, recoil: 8, ergonomics: 62, noise: 125, range: 38, spread: 2.6, aimTime: 0.26, weight: 3.2 },
    auto: true, tier: 4, desc: '模块化精确射手步枪，改装潜力极高。',
  },
  sv98: {
    id: 'sv98', name: 'SV98 狙击步枪', kind: 'sr', caliber: '7.62x54', magSize: 10,
    slots: ['scope', 'muzzle', 'stock', 'mag'],
    base: { damage: 88, rpm: 55, recoil: 18, ergonomics: 30, noise: 175, range: 70, spread: 0.8, aimTime: 0.85, weight: 4.6 },
    auto: false, tier: 4, desc: '一枪一个，但开镜慢、噪音传得远。',
  },
  m107: {
    id: 'm107', name: 'M107 反器材步枪', kind: 'sr', caliber: '.50', magSize: 10,
    slots: ['scope', 'muzzle', 'stock', 'mag'],
    base: { damage: 150, rpm: 45, recoil: 26, ergonomics: 22, noise: 200, range: 90, spread: 0.6, aimTime: 1.1, weight: 12.5 },
    auto: false, tier: 5, desc: '连 Boss 的六级甲都能凿穿。',
  },
  toz: {
    id: 'toz', name: 'TOZ 双管霰弹枪', kind: 'shotgun', caliber: '12g', magSize: 2,
    slots: ['muzzle', 'stock'],
    base: { damage: 18, rpm: 160, recoil: 20, ergonomics: 40, noise: 200, range: 11, spread: 9.0, aimTime: 0.3, weight: 3.1 },
    auto: false, tier: 2, desc: '近距离一发糊脸，远处几乎无效。',
  },
  // ---- 近战（死亡不掉落，占据专属槽位）----
  bat: {
    id: 'bat', name: '球棒', kind: 'melee', melee: 'blunt', magSize: 0,
    slots: [],
    base: { damage: 26, rpm: 95, recoil: 0, ergonomics: 80, noise: 12, range: 1.8, spread: 0, aimTime: 0, weight: 1.6 },
    auto: false, tier: 1, staminaCost: 3.2, desc: '随处可见的可靠家伙。',
  },
  knife: {
    id: 'knife', name: '战术匕首', kind: 'melee', melee: 'blade', magSize: 0,
    slots: [],
    base: { damage: 18, rpm: 175, recoil: 0, ergonomics: 92, noise: 8, range: 1.3, spread: 0, aimTime: 0, weight: 0.4 },
    auto: false, tier: 1, staminaCost: 1.4, bleedBonus: 0.5, desc: '快、静、易造成撕裂伤。',
  },
  axe: {
    id: 'axe', name: '消防斧', kind: 'melee', melee: 'axe', magSize: 0,
    slots: [],
    base: { damage: 42, rpm: 70, recoil: 0, ergonomics: 55, noise: 14, range: 1.7, spread: 0, aimTime: 0, weight: 3.0 },
    auto: false, tier: 2, staminaCost: 5.0, desc: '也能用来拆门拆家具。',
  },
};

/** 配件：add 为加值，mult 为乘值（合成顺序见 statPipeline） */
export const ATTACHMENTS = {
  silencer: { id: 'silencer', name: '消音器', slot: 'muzzle', add: { ergonomics: -6, weight: 0.3 }, mult: { noise: 0.25, recoil: 0.92 } },
  compensator: { id: 'compensator', name: '补偿器', slot: 'muzzle', add: { ergonomics: -3, weight: 0.25 }, mult: { recoil: 0.78 } },
  brake: { id: 'brake', name: '枪口制退器', slot: 'muzzle', add: { ergonomics: -2, weight: 0.2 }, mult: { recoil: 0.86, noise: 1.12 } },
  holo: { id: 'holo', name: '全息瞄具', slot: 'scope', add: { ergonomics: 8, weight: 0.2 }, mult: { spread: 0.80, aimTime: 1.10 } },
  scope4x: { id: 'scope4x', name: '4 倍镜', slot: 'scope', add: { ergonomics: -8, weight: 0.5 }, mult: { spread: 0.55, range: 1.30, aimTime: 1.45 } },
  thermal: { id: 'thermal', name: '热成像瞄具', slot: 'scope', add: { ergonomics: -12, weight: 0.8 }, mult: { spread: 0.62, aimTime: 1.55 }, thermal: true },
  gripV: { id: 'gripV', name: '垂直握把', slot: 'grip', add: { ergonomics: 4, weight: 0.2 }, mult: { recoil: 0.88 } },
  gripA: { id: 'gripA', name: '前握把', slot: 'grip', add: { ergonomics: 2, weight: 0.15 }, mult: { recoil: 0.93, aimTime: 0.92 } },
  stockTac: { id: 'stockTac', name: '战术枪托', slot: 'stock', add: { ergonomics: 5, weight: 0.4 }, mult: { recoil: 0.84 } },
  stockFold: { id: 'stockFold', name: '折叠枪托', slot: 'stock', add: { ergonomics: 9, weight: 0.2 }, mult: { recoil: 1.10 } },
  magExt: { id: 'magExt', name: '扩容弹匣', slot: 'mag', add: { magSize: 15, weight: 0.3, ergonomics: -3 }, mult: {} },
  magQuick: { id: 'magQuick', name: '快拔弹匣', slot: 'mag', add: { weight: 0.1, ergonomics: 3 }, mult: { aimTime: 0.9 } },
};

export const SLOT_NAMES = {
  scope: '瞄具', muzzle: '枪口', grip: '握把', stock: '枪托', mag: '弹匣',
};
