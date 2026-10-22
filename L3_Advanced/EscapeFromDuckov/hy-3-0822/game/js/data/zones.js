// ============================================================
//  zones.js — 5 张递进地图（鸭科夫地图体系 + 僵毁式开放城镇）
// ============================================================

export const ZONES = {
  zone0: {
    id: 'zone0', name: '零号区', gen: 'town', w: 104, h: 104, tier: 1,
    density: 0.9, lootMul: 1.0, weather: { rain: 0.25, storm: false, fog: 0.05 },
    ambient: 1.0, extractions: 2, raidHours: 0,
    boss: [{ type: 'boss_warden', chance: 0.35, place: 'far' }],
    unlock: null,
    breach: { to: 'warehouse', label: '北山裂缝墙体' },
    desc: '新手枢纽。老村长杰夫的村落废墟，尸群稀疏但物资贫瘠。',
  },
  warehouse: {
    id: 'warehouse', name: '仓库区', gen: 'warehouse', w: 108, h: 108, tier: 2,
    density: 1.25, lootMul: 1.25, weather: { rain: 0.35, storm: false, fog: 0.1 },
    ambient: 0.92, extractions: 2,
    boss: [{ type: 'boss_warden', chance: 0.2, place: 'far' }],
    unlock: { flag: 'breach_zone0', label: '需在零号区用爆破包炸开北山裂缝' },
    breach: { to: 'farm', label: '西厂区最深处的裂缝墙体' },
    desc: '废弃工业仓库群。货架成排，尸群成潮，室内昏暗需要手电。',
  },
  farm: {
    id: 'farm', name: '农场镇', gen: 'farm', w: 120, h: 120, tier: 3,
    density: 1.35, lootMul: 1.45, weather: { rain: 0.45, storm: false, fog: 0.15 },
    ambient: 1.0, extractions: 3, merchant: true,
    boss: [{ type: 'boss_miner', chance: 1, place: 'mine' }, { type: 'boss_logger', chance: 1, place: 'sawmill' }],
    unlock: { flag: 'breach_warehouse', label: '需在仓库区用爆破包炸开西厂区墙体' },
    labEntry: true,
    desc: '开放农田、锯木厂与矿场。神秘商人常驻，办公楼地下通往 J-Lab。',
  },
  lab: {
    id: 'lab', name: 'J-Lab 实验室', gen: 'lab', w: 92, h: 92, tier: 4,
    density: 1.5, lootMul: 1.9, weather: { rain: 0, storm: false, fog: 0 },
    ambient: 0.06, indoor: true, extractions: 1, powerPuzzle: true,
    boss: [{ type: 'boss_roadblock', chance: 1, place: 'b1core' }],
    unlock: { consume: 'credential_1', label: '消耗 1 级凭证' },
    desc: 'B1 电力控制区 + B2 彩色门卡房。全程黑暗，隐身怪出没。',
  },
  storm: {
    id: 'storm', name: '风暴区', gen: 'storm', w: 108, h: 108, tier: 5,
    density: 1.6, lootMul: 2.2, weather: { rain: 1.0, storm: true, fog: 0.55 },
    ambient: 0.42, extractions: 1, aaMissile: true,
    boss: [{ type: 'boss_knight', chance: 1, place: 'center', count: 4 }],
    unlock: { consume: 'credential_3', label: '消耗 3 级凭证（路障掉落）' },
    desc: '终局战场。暴雨遮蔽视线与声音，四骑士守着空间核心。',
  },
};

export const ZONE_ORDER = ['zone0', 'warehouse', 'farm', 'lab', 'storm'];

/** 藏身处（局外） */
export const HIDEOUT = { id: 'hideout', name: '藏身处', gen: 'hideout', w: 46, h: 34, tier: 0, ambient: 1.0, safe: true };

/** 基地设施：等级 → 花费与加成 */
export const FACILITIES = {
  generator: {
    name: '发电机', desc: '为藏身处供电：照明、工作台、厨房。',
    levels: [
      { cost: null },
      { cost: { cash: 300, mech_parts: 3, scrap: 6 }, effect: '基础供电' },
      { cost: { cash: 1200, mech_parts: 8, electronics: 6 }, effect: '供电稳定 + 局内起始电量 +50%' },
      { cost: { cash: 4000, mech_parts: 16, gpu: 2 }, effect: '全区供电 + 电池自动补充' },
    ],
  },
  workbench: {
    name: '工作台', desc: '枪械改装、弹药复装、金属加工。',
    levels: [
      { cost: null },
      { cost: { cash: 200, plank: 8, nails: 20 }, effect: '解锁基础改装/复装' },
      { cost: { cash: 1000, sheet_metal: 4, mech_parts: 6 }, effect: '解锁消音器等高级配件 + 武器修理效率 +50%' },
      { cost: { cash: 3500, sheet_metal: 10, gpu: 1, mech_parts: 12 }, effect: '解锁紫弹改装' },
    ],
  },
  kitchen: {
    name: '厨房', desc: '烹饪、烧水、保存食物。',
    levels: [
      { cost: null },
      { cost: { cash: 150, protein_powder: 1, scrap: 4 }, effect: '可烹饪与净水' },
      { cost: { cash: 800, protein_powder: 2, electronics: 4 }, effect: '食物腐坏速度 -50%，烹饪加成' },
    ],
  },
  gym: {
    name: '健身房', desc: '提升体能与负重上限。',
    levels: [
      { cost: null },
      { cost: { cash: 250, protein_powder: 1, scrap: 8 }, effect: '负重 +5kg，体力上限 +15%' },
      { cost: { cash: 1200, protein_powder: 3, mech_parts: 5 }, effect: '负重 +12kg，体力上限 +30%，力量训练' },
    ],
  },
  tech: {
    name: '技术中心', desc: '小明的实验台：凭证复制、血清合成。',
    levels: [
      { cost: null },
      { cost: { cash: 600, electronics: 8, gpu: 1 }, effect: '解锁凭证复制' },
      { cost: { cash: 2500, electronics: 20, gpu: 3, chemicals: 6 }, effect: '解锁血清合成 + 情报（局内标记 Boss）' },
    ],
  },
  medbay: {
    name: '医疗站', desc: '治疗部位重伤、修复生命上限。',
    levels: [
      { cost: null },
      { cost: { cash: 400, cloth: 10, chemicals: 2 }, effect: '返回基地时自动包扎并加速愈合' },
      { cost: { cash: 1600, chemicals: 8, electronics: 6 }, effect: '自动治疗骨折/深伤，生命上限恢复' },
    ],
  },
};

/** 飞船建造进度：5 个部件 */
export const SHIP_PARTS = ['ship_engine', 'ship_hull', 'ship_nav', 'ship_fuel', 'ship_core'];
