/* DUCKOV Z - 物品数据库 / 职业 / 配方 / 战利品表 */
(function (DZ) {
  'use strict';
  const U = DZ.U;
  // sh=图标形状 col=图标色 wt=重量kg stack=堆叠上限
  const DB = {
    // ---- 食物 ----
    beans:      { n: '罐装豆子', cat: 'food', wt: 0.5, sh: 'can', col: '#7d8a5a', stack: 4, food: { nut: 38 } },
    soup:       { n: '罐装浓汤', cat: 'food', wt: 0.5, sh: 'can', col: '#a3502e', stack: 4, food: { nut: 30, hyd: 10 } },
    fishcan:    { n: '鱼罐头', cat: 'food', wt: 0.4, sh: 'can', col: '#5c7894', stack: 4, food: { nut: 34 } },
    crackers:   { n: '苏打饼干', cat: 'food', wt: 0.2, sh: 'box', col: '#c2a36b', stack: 6, food: { nut: 12 } },
    chips:      { n: '薯片', cat: 'food', wt: 0.2, sh: 'bag', col: '#c75b39', stack: 6, food: { nut: 15 } },
    chocolate:  { n: '巧克力棒', cat: 'food', wt: 0.1, sh: 'bar', col: '#5b3a29', stack: 8, food: { nut: 18, sta: 8 } },
    cereal:     { n: '麦片盒', cat: 'food', wt: 0.4, sh: 'box', col: '#caa84f', stack: 4, food: { nut: 26 } },
    apple:      { n: '苹果', cat: 'food', wt: 0.15, sh: 'fruit', col: '#c0392b', stack: 8, food: { nut: 14, hyd: 8, fresh: 3 } },
    berry:      { n: '野莓果', cat: 'food', wt: 0.05, sh: 'berries', col: '#8e44ad', stack: 12, food: { nut: 9, hyd: 5, fresh: 2, sickP: 0.12 } },
    bread:      { n: '面包', cat: 'food', wt: 0.3, sh: 'bread', col: '#c99b57', stack: 5, food: { nut: 22, fresh: 4 } },
    rawMeat:    { n: '生肉', cat: 'food', wt: 0.6, sh: 'meat', col: '#b35454', stack: 6, food: { nut: 8, fresh: 1.5, sickP: 0.65, cookTo: 'cookedMeat' } },
    cookedMeat: { n: '烤肉排', cat: 'food', wt: 0.5, sh: 'meat', col: '#8a5a33', stack: 6, food: { nut: 42, fresh: 2 } },
    stew:       { n: '热炖菜', cat: 'food', wt: 0.7, sh: 'bowl', col: '#b06f34', stack: 4, food: { nut: 48, hyd: 10, fresh: 1, heal: 4 } },
    // ---- 饮品 ----
    water:      { n: '瓶装水', cat: 'drink', wt: 0.6, sh: 'bottle', col: '#6fb3d9', stack: 5, drink: { hyd: 55 }, leaves: 'bottleE' },
    soda:       { n: '汽水', cat: 'drink', wt: 0.4, sh: 'can', col: '#c0392b', stack: 6, drink: { hyd: 38, sta: 12 }, leaves: 'bottleE' },
    coffee:     { n: '速溶咖啡', cat: 'drink', wt: 0.3, sh: 'cup', col: '#6b4a2f', stack: 5, drink: { hyd: 16, wake: 26 } },
    bottleE:    { n: '空瓶子', cat: 'mat', wt: 0.2, sh: 'bottle', col: '#9db8c4', stack: 6 },
    // ---- 医疗 ----
    bandage:    { n: '绷带', cat: 'med', wt: 0.1, sh: 'roll', col: '#e8e4d8', stack: 8, med: { kind: 'bandage', stopBleed: 1, heal: 8 } },
    rag:        { n: '破布条', cat: 'med', wt: 0.08, sh: 'cloth', col: '#b9b2a0', stack: 10, med: { kind: 'bandage', stopBleed: 1, heal: 3 } },
    splint:     { n: '夹板', cat: 'med', wt: 0.3, sh: 'splint', col: '#b08d5f', stack: 4, med: { kind: 'splint' } },
    surgery:    { n: '手术包', cat: 'med', wt: 0.9, sh: 'kit', col: '#4f6f8f', stack: 2, med: { kind: 'surgery' } },
    painkiller: { n: '止痛药', cat: 'med', wt: 0.05, sh: 'pills', col: '#e0e0e0', stack: 6, med: { kind: 'pill', pill: 'pain' } },
    antibiotics:{ n: '抗生素', cat: 'med', wt: 0.05, sh: 'pills', col: '#d9a441', stack: 6, med: { kind: 'pill', pill: 'anti' } },
    betablock:  { n: 'β受体阻滞剂', cat: 'med', wt: 0.05, sh: 'pills', col: '#8fb3d9', stack: 6, med: { kind: 'pill', pill: 'beta' } },
    vitamins:   { n: '维生素片', cat: 'med', wt: 0.05, sh: 'pills', col: '#f2c94c', stack: 6, med: { kind: 'pill', pill: 'vit' } },
    firstaidbook:{ n: '急救手册', cat: 'book', wt: 0.7, sh: 'book', col: '#7d3c3c', stack: 1, read: { skill: 'firstaid', xp: 120, once: 1 } },
    // ---- 近战武器 (mel: dmg伤害 rng距离tiles cd冷却 stam耗体力 knock击退 dur耐久次数) ----
    plank:      { n: '木板', cat: 'mat', wt: 1.2, sh: 'plank', col: '#b08d5f', stack: 6, mel: { dmg: 11, rng: 1.35, arc: 70, cd: 0.62, stam: 7, knock: 90, dur: 28 } },
    nailbat:    { n: '钉刺球棒', cat: 'wmelee', wt: 1.6, sh: 'bat2', col: '#8a6a45', stack: 1, mel: { dmg: 23, rng: 1.5, arc: 75, cd: 0.68, stam: 8, knock: 130, dur: 60 } },
    bat:        { n: '棒球棒', cat: 'wmelee', wt: 1.3, sh: 'bat', col: '#a97e50', stack: 1, mel: { dmg: 17, rng: 1.5, arc: 80, cd: 0.62, stam: 7, knock: 120, dur: 70 } },
    kitchenknife:{ n: '菜刀', cat: 'wmelee', wt: 0.5, sh: 'knife', col: '#aab4bd', stack: 1, mel: { dmg: 14, rng: 1.1, arc: 55, cd: 0.36, stam: 4, knock: 40, dur: 55, crit: 0.2 } },
    fireaxe:    { n: '消防斧', cat: 'wmelee', wt: 3.2, sh: 'axe', col: '#a03b2e', stack: 1, mel: { dmg: 38, rng: 1.55, arc: 85, cd: 0.95, stam: 13, knock: 170, dur: 110, chop: 1 } },
    crowbar:    { n: '撬棍', cat: 'wmelee', wt: 2.4, sh: 'crow', col: '#7a4a4a', stack: 1, mel: { dmg: 19, rng: 1.35, arc: 60, cd: 0.6, stam: 8, knock: 100, dur: 240, pry: 1 } },
    wrench:     { n: '管钳扳手', cat: 'wmelee', wt: 1.4, sh: 'wrench', col: '#8f969c', stack: 1, mel: { dmg: 13, rng: 1.15, arc: 55, cd: 0.5, stam: 6, knock: 70, dur: 140 } },
    // ---- 枪械与弹药 (数据在 C.GUNS) ----
    pistol:     { n: 'M1911 手枪', cat: 'gun', wt: 1.1, sh: 'gpistol', col: '#4a4f55', stack: 1, gun: 'pistol' },
    shotgun:    { n: '泵动霰弹枪', cat: 'gun', wt: 3.2, sh: 'gshotgun', col: '#6d4a33', stack: 1, gun: 'shotgun' },
    rifle:      { n: '栓动猎步枪', cat: 'gun', wt: 3.8, sh: 'grifle', col: '#5d4a36', stack: 1, gun: 'rifle' },
    ammo9:      { n: '.45ACP 弹药盒', cat: 'ammo', wt: 0.15, sh: 'ammobox', col: '#8a7a4a', stack: 8, ammount: 15 },
    shell:      { n: '12号霰弹', cat: 'ammo', wt: 0.06, sh: 'shellred', col: '#a03b2e', stack: 20, ammount: 6 },
    ammoR:      { n: '步枪弹弹药盒', cat: 'ammo', wt: 0.18, sh: 'ammobox', col: '#5d7a54', stack: 8, ammount: 10 },
    // ---- 材料/工具/特殊 ----
    nails:      { n: '钉子盒', cat: 'mat', wt: 0.25, sh: 'nails', col: '#9aa0a6', stack: 6, nailsEach: 12 },
    log:        { n: '原木', cat: 'mat', wt: 3.5, sh: 'log', col: '#6d5138', stack: 3 },
    hammer:     { n: '羊角锤', cat: 'tool', wt: 1.0, sh: 'hammer', col: '#7a4a2e', stack: 1 },
    lighter:    { n: '打火机', cat: 'tool', wt: 0.05, sh: 'lighter', col: '#c0392b', stack: 1 },
    battery:    { n: '干电池', cat: 'tool', wt: 0.1, sh: 'battery', col: '#5d7a54', stack: 5 },
    flashlight: { n: '战术手电', cat: 'tool', wt: 0.4, sh: 'flashlight', col: '#4a4f55', stack: 1 },
    nv:         { n: '夜视仪', cat: 'tool', wt: 0.6, sh: 'nv', col: '#3d5a45', stack: 1 },
    gascanE:    { n: '空油桶', cat: 'mat', wt: 1.0, sh: 'gascan', col: '#8f969c', stack: 2 },
    gascanF:    { n: '满油桶', cat: 'mat', wt: 5.5, sh: 'gascan', col: '#a03b2e', stack: 2 },
    molotov:    { n: '燃烧瓶', cat: 'tool', wt: 0.7, sh: 'molotov', col: '#c9871f', stack: 3 },
    elecPart:   { n: '电子零件', cat: 'val', wt: 0.4, sh: 'chip', col: '#4f8f5f', stack: 3 },
    watch:      { n: '金壳腕表', cat: 'val', wt: 0.1, sh: 'watch', col: '#d9b53f', stack: 4 },
    ring:       { n: '钻戒', cat: 'val', wt: 0.02, sh: 'ring', col: '#cfe3ef', stack: 6 },
    cash:       { n: '现金捆', cat: 'val', wt: 0.05, sh: 'cash', col: '#79c26a', stack: 8 },
    // ---- 服饰/装备 gear.slot: head/vest/jacket/pack ----
    hardhat:    { n: '安全帽', cat: 'gear', wt: 0.6, sh: 'hardhat', col: '#d9a441', stack: 1, gear: { slot: 'head', lv: 1, abs: 0.22 } },
    helmet:     { n: '战术头盔', cat: 'gear', wt: 1.4, sh: 'helmet', col: '#4a5240', stack: 1, gear: { slot: 'head', lv: 2, abs: 0.38 } },
    vest1:      { n: 'Ⅰ级防弹背心', cat: 'gear', wt: 2.2, sh: 'vest1', col: '#5d6470', stack: 1, gear: { slot: 'vest', lv: 1, abs: 0.25, biteSave: 0.25 } },
    vest2:      { n: 'Ⅱ级防弹插板', cat: 'gear', wt: 3.4, sh: 'vest2', col: '#49523d', stack: 1, gear: { slot: 'vest', lv: 2, abs: 0.42, biteSave: 0.4 } },
    vest3:      { n: 'Ⅲ级重型护甲', cat: 'gear', wt: 5.0, sh: 'vest3', col: '#3d4348', stack: 1, gear: { slot: 'vest', lv: 3, abs: 0.58, biteSave: 0.55 } },
    hoodie:     { n: '加绒连帽衫', cat: 'gear', wt: 0.9, sh: 'jacket', col: '#6d5a7a', stack: 1, gear: { slot: 'jacket', warm: 1, wetRes: 0.2 } },
    raincoat:   { n: '鸭羽雨衣', cat: 'gear', wt: 0.8, sh: 'jacket', col: '#c9a227', stack: 1, gear: { slot: 'jacket', wetRes: 0.75 } },
    jacketFire: { n: '消防战斗服', cat: 'gear', wt: 2.8, sh: 'jacket', col: '#8f4a26', stack: 1, gear: { slot: 'jacket', warm: 1, wetRes: 0.5, abs: 0.18 } },
    packS:      { n: '学生书包', cat: 'gear', wt: 0.5, sh: 'pack', col: '#7a4a8f', stack: 1, gear: { slot: 'pack', cap: 6 } },
    packL:      { n: '登山背包', cat: 'gear', wt: 1.0, sh: 'pack', col: '#5d6470', stack: 1, gear: { slot: 'pack', cap: 12 } },
    milpack:    { n: '军用背囊', cat: 'gear', wt: 1.6, sh: 'pack', col: '#49523d', stack: 1, gear: { slot: 'pack', cap: 17 } }
  };

  // ---- 职业 ----
  const PROFS = [
    { id: 'firefighter', n: '消防员', desc: '火斧开路，战斗服防火保暖。近战之王。', items: [['fireaxe', 1], ['jacketFire', 1], ['hardhat', 1]], eq: { jacket: 'jacketFire', head: 'hardhat' }, sk: { strength: 2, fitness: 1 }, spawn: 'firestation', perk: '力量+2 体格+1' },
    { id: 'police', n: '警员', desc: '制式手枪与防弹背心，开局即有火力。', items: [['pistol', 1], ['ammo9', 2], ['vest1', 1]], eq: { primary: 'pistol', vest: 'vest1' }, sk: { aiming: 2, reload: 1 }, spawn: 'police', perk: '射击+2 装填+1' },
    { id: 'chef', n: '厨师', desc: '刀工了得，代谢高效——饥饿更慢。', items: [['kitchenknife', 1], ['stew', 2], ['water', 1]], eq: {}, sk: { strength: 1 }, spawn: 'diner', perk: '饥饿速率−20%', hungerMul: 0.8 },
    { id: 'doctor', n: '医生', desc: '满手医疗物资，处理伤口快人一步。', items: [['bandage', 4], ['surgery', 1], ['antibiotics', 2], ['painkiller', 1]], eq: {}, sk: { firstaid: 2 }, spawn: 'clinic', perk: '治疗速度×2', healMul: 2 },
    { id: 'carpenter', n: '木匠', desc: '锤子钉子撬棍齐全，工事大师。', items: [['hammer', 1], ['plank', 6], ['nails', 2], ['crowbar', 1]], eq: {}, sk: { carpentry: 2, strength: 1 }, spawn: 'garage', perk: '路障耐久+50%' },
    { id: 'unemployed', n: '无业游民', desc: '一无所有，但学什么都快。', items: [['plank', 1], ['rag', 2], ['water', 1], ['crackers', 2]], eq: {}, sk: {}, spawn: 'house', perk: '全部经验+25%', xpMul: 1.25 }
  ];

  // ---- 配方 ----
  const RECIPES = [
    { id: 'r_bandage', out: [{ id: 'bandage', q: 1 }], ins: [['rag', 2]], time: 3, sk: 'firstaid', name: '绷带', desc: '破布条×2 卷制' },
    { id: 'r_nailbat', out: [{ id: 'nailbat', q: 1 }], ins: [['bat', 1], ['nails', 1]], time: 6, sk: 'carpentry', name: '钉刺球棒', desc: '球棒+钉子盒' },
    { id: 'r_molotov', out: [{ id: 'molotov', q: 1 }, { id: 'gascanE', q: 1 }], ins: [['bottleE', 1], ['rag', 1], ['gascanF', 1]], time: 4, name: '燃烧瓶', desc: '消耗一桶汽油灌装' },
    { id: 'r_plank', out: [{ id: 'plank', q: 3 }], ins: [['log', 1]], time: 6, sk: 'carpentry', name: '锯木板×3', desc: '原木分解' },
    { id: 'r_campfire', out: [{ id: '__campfire', q: 1 }], ins: [['log', 1]], time: 5, sk: 'carpentry', name: '营地篝火', desc: '放置后照明/取暖/烹饪', place: 'campfire' },
    { id: 'r_raincol', out: [{ id: '__raincol', q: 1 }], ins: [['plank', 4], ['nails', 1]], time: 8, sk: 'carpentry', name: '雨水收集器', desc: '放置后接雨水饮用', place: 'raincol' },
    { id: 'r_cookmeat', out: [{ id: 'cookedMeat', q: 1 }], ins: [['rawMeat', 1]], time: 6, need: 'heat', name: '烤肉排', desc: '需在炉灶或篝火旁制作' }
  ];

  // ---- 战利品表: [物品id, 权重, 数量min, 数量max] ----
  const LT = {
    fridge: [[['apple', 3, 1, 3], ['bread', 2, 1, 2], ['stew', 1, 1, 1], ['water', 3, 1, 2], ['rawMeat', 1.5, 1, 2], ['soda', 2, 1, 2]]],
    kitchcab: [[['beans', 3, 1, 3], ['soup', 2, 1, 2], ['crackers', 2, 1, 2], ['fishcan', 2, 1, 2], ['rag', 2, 1, 2], ['lighter', 0.7, 1, 1], ['cereal', 1.5, 1, 1]]],
    bathcab: [[['bandage', 2, 1, 2], ['rag', 3, 1, 3], ['painkiller', 1, 1, 1], ['vitamins', 1, 1, 1], ['bottleE', 1, 1, 1]]],
    medcab: [[['bandage', 4, 2, 4], ['splint', 1.5, 1, 1], ['painkiller', 2, 1, 2], ['antibiotics', 1, 1, 2], ['surgery', 0.5, 1, 1]]],
    hospshelf: [[['bandage', 5, 3, 5], ['splint', 2, 1, 2], ['antibiotics', 2, 1, 2], ['surgery', 1, 1, 1], ['betablock', 1.5, 1, 2], ['vitamins', 2, 1, 2], ['firstaidbook', 0.8, 1, 1]]],
    wardrobe: [[['hoodie', 2, 1, 1], ['raincoat', 0.7, 1, 1], ['rag', 3, 1, 3], ['bat', 0.5, 1, 1], ['watch', 0.8, 1, 1], ['packS', 0.8, 1, 1]]],
    crate: [[['plank', 4, 2, 5], ['nails', 3, 1, 2], ['hammer', 1, 1, 1], ['gascanE', 1.2, 1, 1], ['bottleE', 1.5, 1, 2], ['log', 1, 1, 2], ['elecPart', 0.6, 1, 1]]],
    gunsafe: [[['pistol', 2, 1, 1], ['shotgun', 1.4, 1, 1], ['rifle', 0.9, 1, 1], ['ammo9', 3, 1, 2], ['shell', 2.5, 2, 4], ['ammoR', 1.5, 1, 2], ['vest2', 0.5, 1, 1]]],
    policeLocker: [[['ammo9', 4, 2, 3], ['vest1', 2, 1, 1], ['pistol', 1.2, 1, 1], ['helmet', 0.6, 1, 1], ['betablock', 1, 1, 1]]],
    fireLocker: [[['jacketFire', 1.2, 1, 1], ['fireaxe', 1, 1, 1], ['hardhat', 1.5, 1, 1], ['bandage', 2, 1, 2]]],
    desk: [[['cash', 2, 1, 2], ['watch', 1, 1, 1], ['battery', 2, 1, 2], ['flashlight', 0.8, 1, 1], ['__note', 1.5, 1, 1], ['coffee', 1.5, 1, 1]]],
    bookshelf: [[['__note', 2, 1, 1], ['firstaidbook', 0.5, 1, 1], ['coffee', 1, 1, 1]]],
    shopshelf: [[['chips', 3, 1, 3], ['chocolate', 3, 1, 3], ['soda', 3, 1, 3], ['cereal', 2, 1, 2], ['crackers', 2, 1, 3]]],
    grocery: [[['beans', 3, 1, 4], ['soup', 2, 1, 3], ['water', 3, 1, 3], ['fishcan', 2, 1, 3], ['apple', 1.5, 1, 3], ['bread', 1.5, 1, 2]]],
    toolbox: [[['hammer', 1.5, 1, 1], ['wrench', 2, 1, 1], ['nails', 2.5, 1, 2], ['crowbar', 0.8, 1, 1], ['battery', 1, 1, 1]]],
    trunk: [[['gascanE', 1.5, 1, 1], ['gascanF', 0.5, 1, 1], ['plank', 2, 1, 2], ['packS', 0.8, 1, 1], ['rag', 2, 1, 2], ['cash', 1, 1, 1]]],
    dumpster: [[['rag', 3, 1, 3], ['plank', 1.5, 1, 2], ['bottleE', 2, 1, 2], ['apple', 1, 1, 1], ['nails', 1, 1, 1]]],
    milcrate: [[['milpack', 1.5, 1, 1], ['vest2', 1.5, 1, 1], ['vest3', 0.7, 1, 1], ['helmet', 1.5, 1, 1], ['nv', 1.2, 1, 1], ['ammoR', 2, 1, 2], ['ammo9', 2, 2, 3]]]
  };
  // 尸体掉落
  function corpseLoot(rng) {
    const out = [];
    if (rng() < 0.35) out.push({ id: 'rag', qty: U.range(1, 2, rng) });
    if (rng() < 0.14) out.push({ id: 'bandage', qty: 1 });
    if (rng() < 0.1) out.push({ id: 'battery', qty: 1 });
    if (rng() < 0.08) out.push({ id: 'lighter', qty: 1 });
    if (rng() < 0.07) out.push({ id: 'chocolate', qty: 1 });
    return out;
  }

  // 实例工厂
  function newInst(id, qty, rng) {
    const def = DB[id];
    if (!def) return null;
    const inst = { id, qty: qty || 1 };
    if (def.mel) inst.cond = 100;
    if (def.gun) {
      const g = DZ.C.GUNS[def.gun];
      inst.loaded = (rng && rng() < 0.5) ? U.range(0, g.mag, rng) : g.mag;
      inst.cond = U.range(70, 100, rng);
    }
    if (def.food && def.food.fresh) inst.fresh = def.food.fresh;
    if (id === 'flashlight') inst.batt = U.range(50, 100, rng);
    if (id === 'nv') inst.batt = U.range(60, 100, rng);
    if (def.ammount && !qty) inst.qty = 1; // 一盒
    return inst;
  }
  function rollTable(tableId, rng) {
    const t = LT[tableId]; if (!t) return [];
    const groups = U.pick(t, rng);
    const n = U.range(1, Math.min(4, groups.length), rng);
    const picks = U.shuffle(groups.slice(), rng).slice(0, n);
    return picks.map(([id, w, a, b]) => {
      if (id === '__note') return { id: '__note_' + (U.range(1, 8, rng)), qty: 1 };
      return newInst(id, U.range(a, b, rng), rng);
    }).filter(Boolean);
  }
  const NOTES = {
    __note_1: '「停电通知：电网将于明日中午维护性关闭。——市电力局（最后通告）」',
    __note_2: '「自来水泵站失压……如果看到这个，别再指望水龙头了。」',
    __note_3: '「军队在学校操场设了撤离点！他们说第7天正午有直升机！带上燃料！」',
    __note_4: '「别开枪。它们听得见。用斧子，或者干脆跑。」',
    __note_5: '「妈妈：我去找你。窗户都钉好了。冰箱里的苹果留给你的。——杰夫」',
    __note_6: '「被咬的人会变。没有例外。别心软。」',
    __note_7: '「加油站的电泵断电就废了。想囤燃油的趁早。」',
    __note_8: '「雨要下很久。接雨水喝之前记得煮开……算了，总比渴死强。」'
  };
  DZ.IT = { DB, PROFS, RECIPES, LT, NOTES, newInst, rollTable, corpseLoot,
    name(id) { return NOTES[id] ? '泛黄的便签' : (DB[id] ? DB[id].n : id); },
    def(id) { return DB[id] || {}; },
    weight(inst) { const d = DB[inst.id]; if (!d) return 0; let w = d.wt * (inst.id.startsWith('__') ? 0 : inst.qty); if (inst.id === 'gascanF') w = d.wt; return w; }
  };
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
