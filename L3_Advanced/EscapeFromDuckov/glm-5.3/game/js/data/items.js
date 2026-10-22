// ============================================================
// data/items.js — 物品数据库（鸭科夫撤离经济 × 僵毁硬核生存物资）
// 甲弹公式（逃离鸭科夫文档 §4.2）: 实伤 = 基伤 × 2 / (护甲等级 - 穿透等级 + 2)
// ============================================================
'use strict';
const DB = {};

DB.calibers = { c9: '9mm', c12: '12号霰弹', c762: '7.62mm', c308: '.308', cell: '风暴电池' };

DB.items = {
  // ---------- 近战（近战槽位死亡不掉落 · 鸭科夫规则） ----------
  wpn_stick:  { nm: '木棍',     cat: 'melee', wt: 1.0, skill: 'blunt',  dmg: 12, rng: 1.1, arc: 1.7, swing: 0.55, knock: 120, dur: 60,  noise: 5,  val: 8,   ic: { k: 'melee', c: '#8a6b45' }, desc: '随手捡的木棍，聊胜于无。' },
  wpn_wrench: { nm: '扳手',     cat: 'melee', wt: 2.2, skill: 'blunt',  dmg: 20, rng: 1.0, arc: 1.6, swing: 0.70, knock: 220, dur: 140, noise: 6,  val: 30,  ic: { k: 'melee', c: '#8d99a6' }, desc: '五金店标配。敲鸭壳很顺手。' },
  wpn_knife:  { nm: '战术匕首', cat: 'melee', wt: 0.6, skill: 'blade',  dmg: 16, rng: 0.9, arc: 1.2, swing: 0.34, knock: 40,  dur: 120, noise: 3,  val: 60,  ic: { k: 'melee', c: '#c8d3dc' }, desc: '快而短。割布条、开罐头、捅鸭尸。' },
  wpn_crow:   { nm: '撬棍',     cat: 'melee', wt: 2.8, skill: 'blunt',  dmg: 24, rng: 1.2, arc: 1.7, swing: 0.75, knock: 300, dur: 200, noise: 6,  val: 45,  ic: { k: 'melee', c: '#b0453a' }, desc: '红色撬棍，末日经典。' },
  wpn_axe:    { nm: '消防斧',   cat: 'melee', wt: 4.5, skill: 'blade',  dmg: 45, rng: 1.4, arc: 2.0, swing: 1.05, knock: 380, dur: 160, noise: 9,  val: 140, ic: { k: 'melee', c: '#d13438' }, desc: '一斧一个小老弟。消耗体力较多。' },
  wpn_nbat:   { nm: '钉刺球棒', cat: 'melee', wt: 3.0, skill: 'blunt',  dmg: 38, rng: 1.3, arc: 1.9, swing: 0.85, knock: 320, dur: 130, noise: 8,  val: 120, ic: { k: 'melee', c: '#b98a4e' }, desc: '自制钉头锤，木工的浪漫。[制作]' },
  wpn_spear:  { nm: '长矛',     cat: 'melee', wt: 3.2, skill: 'spear',  dmg: 34, rng: 2.0, arc: 0.9, swing: 0.95, knock: 180, dur: 90,  noise: 5,  val: 100, ic: { k: 'melee', c: '#c9a86a' }, desc: '刀绑在棍上。距离就是生命。[制作]' },
  wpn_shovel: { nm: '铁铲',     cat: 'melee', wt: 3.5, skill: 'blunt',  dmg: 26, rng: 1.3, arc: 1.8, swing: 0.9,  knock: 300, dur: 180, noise: 7,  val: 55,  ic: { k: 'melee', c: '#7d8a96' }, desc: '既能挖坑也能拍鸭。' },

  // ---------- 枪械（可改装：枪口/瞄具/弹匣槽位） ----------
  gun_m9:     { nm: 'M9 手枪',      cat: 'gun', wt: 1.4, cal: 'c9',   dmg: 26, rof: 260, mag: 15, auto: false, spread: 5.5, rng: 11, noise: 55, reload: 1.8, recoil: 1.6, slots: { muzzle: 1, scope: 1 }, val: 220, ic: { k: 'gun', c: '#5b6670' }, desc: '军用手枪。省心的自卫武器。' },
  gun_mp5:    { nm: 'MP5 冲锋枪',   cat: 'gun', wt: 2.9, cal: 'c9',   dmg: 22, rof: 700, mag: 30, auto: true,  spread: 6.5, rng: 10, noise: 60, reload: 2.2, recoil: 1.2, slots: { muzzle: 1, scope: 1, mag: 1 }, val: 650, ic: { k: 'gun', c: '#3d4a55' }, desc: '近距离拉打之王。' },
  gun_shotgun:{ nm: 'M870 霰弹枪',  cat: 'gun', wt: 3.6, cal: 'c12',  dmg: 15, pellets: 6, rof: 70, mag: 6, auto: false, spread: 11, rng: 7, noise: 85, reload: 3.0, recoil: 4.5, slots: { muzzle: 1 }, val: 580, ic: { k: 'gun', c: '#6b4a33' }, desc: '6 枚弹丸齐射。贴脸即正义。' },
  gun_ak:     { nm: 'AK-103',       cat: 'gun', wt: 3.9, cal: 'c762', dmg: 34, rof: 600, mag: 30, auto: true,  spread: 7.5, rng: 13, noise: 80, reload: 2.6, recoil: 3.0, slots: { muzzle: 1, scope: 1, mag: 1 }, val: 1100, ic: { k: 'gun', c: '#5c4a2f' }, desc: ' rusty but trusty。全自动压制。' },
  gun_m14:    { nm: 'M14 步枪',     cat: 'gun', wt: 4.2, cal: 'c762', dmg: 48, rof: 240, mag: 20, auto: false, spread: 3.5, rng: 16, noise: 78, reload: 2.8, recoil: 3.6, slots: { muzzle: 1, scope: 1, mag: 1 }, val: 1250, ic: { k: 'gun', c: '#4e5138' }, desc: '半自动精准步枪，架起来很稳。' },
  gun_sv98:   { nm: 'SV98 狙击枪',  cat: 'gun', wt: 5.4, cal: 'c308', dmg: 92, rof: 45,  mag: 10, auto: false, spread: 1.2, rng: 22, noise: 95, reload: 3.6, recoil: 6.0, slots: { muzzle: 1, scope: 1, mag: 1 }, val: 2100, ic: { k: 'gun', c: '#3a4636' }, desc: '一发一只装甲鸭。' },
  gun_storm:  { nm: '风暴枪',       cat: 'gun', wt: 4.6, cal: 'cell', dmg: 40, rof: 520, mag: 40, auto: true,  spread: 3.0, rng: 15, noise: 30, reload: 2.4, recoil: 1.4, slots: { scope: 1 }, val: 5000, ic: { k: 'gun', c: '#3fd2c8' }, desc: '风暴区终极图纸武器：储能弹芯，自带抑制声爆。[工作台III+图纸]' },

  // ---------- 弹药（曳光颜色 = 穿透等级 · 鸭科夫 §4.2） ----------
  a_9:    { nm: '9mm 常规弹',   cat: 'ammo', wt: 0.01, cal: 'c9',   pen: 1, stack: 60, val: 2,  ic: { k: 'ammo', c: '#f2a13c' }, desc: '橙黄曳光。对付无甲鸭尸。' },
  a_9ap:  { nm: '9mm 穿甲弹',   cat: 'ammo', wt: 0.012, cal: 'c9',   pen: 3, stack: 60, val: 5,  ic: { k: 'ammo', c: '#4fa3e3' }, desc: '蓝弹。可击穿中等护甲。' },
  a_12:   { nm: '12号 鹿弹',    cat: 'ammo', wt: 0.02, cal: 'c12',  pen: 1, stack: 40, val: 4,  ic: { k: 'ammo', c: '#f2a13c' }, desc: '6 枚弹丸，扇面覆盖。' },
  a_762:  { nm: '7.62 常规弹',  cat: 'ammo', wt: 0.013, cal: 'c762', pen: 1, stack: 60, val: 4,  ic: { k: 'ammo', c: '#f2a13c' }, desc: '步枪基础弹药。' },
  a_762ap:{ nm: '7.62 穿甲弹', cat: 'ammo', wt: 0.014, cal: 'c762', pen: 3, stack: 60, val: 9,  ic: { k: 'ammo', c: '#4fa3e3' }, desc: '蓝弹。军规鸭尸的克星。' },
  a_762x: { nm: '7.62 高级穿甲弹', cat: 'ammo', wt: 0.015, cal: 'c762', pen: 5, stack: 60, val: 18, ic: { k: 'ammo', c: '#c07ce8' }, desc: '紫弹。专为 Boss 级装甲准备。' },
  a_308:  { nm: '.308 穿甲弹', cat: 'ammo', wt: 0.016, cal: 'c308', pen: 3, stack: 40, val: 10, ic: { k: 'ammo', c: '#4fa3e3' }, desc: '狙击用蓝弹。' },
  a_308x: { nm: '.308 高级穿甲弹', cat: 'ammo', wt: 0.018, cal: 'c308', pen: 5, stack: 40, val: 22, ic: { k: 'ammo', c: '#c07ce8' }, desc: '紫弹。风暴骑士的入场券。' },
  a_cell: { nm: '风暴电池',     cat: 'ammo', wt: 0.02, cal: 'cell', pen: 5, stack: 40, val: 30, ic: { k: 'ammo', c: '#3fd2c8' }, desc: '青色曳光。风暴枪专用。' },

  // ---------- 配件 ----------
  at_sil:   { nm: '消音器',     cat: 'attach', wt: 0.5, slot: 'muzzle', mods: { noise: -0.72 }, val: 320, ic: { k: 'attach', c: '#39424b' }, desc: '枪声噪音 -72%。潜行流的灵魂。' },
  at_comp:  { nm: '制退器',     cat: 'attach', wt: 0.3, slot: 'muzzle', mods: { recoil: -0.4 }, val: 180, ic: { k: 'attach', c: '#57616b' }, desc: '后坐力 -40%。' },
  at_rdot:  { nm: '红点镜',     cat: 'attach', wt: 0.2, slot: 'scope',  mods: { spread: -0.3 }, val: 260, ic: { k: 'attach', c: '#b0453a' }, desc: '散布 -30%。' },
  at_mag:   { nm: '扩容弹匣',   cat: 'attach', wt: 0.4, slot: 'mag',    mods: { mag: 0.6 }, val: 300, ic: { k: 'attach', c: '#4a5433' }, desc: '弹匣容量 +60%。' },
  at_thermal:{ nm: '热成像瞄具', cat: 'attach', wt: 0.6, slot: 'scope', mods: { spread: -0.15 }, thermal: true, val: 1500, ic: { k: 'attach', c: '#e86a3a' }, desc: '按 T 切换热成像：迷彩鸭无所遁形。' },

  // ---------- 护甲（1-6 级 · 鸭科夫 §4.2） ----------
  ar_cloth:  { nm: '布夹克',        cat: 'armor', wt: 1.0, slot: 'body', cls: 0, ins: 1, val: 15,  ic: { k: 'armor', c: '#6a5a48' }, desc: '聊胜于无的保暖。' },
  ar_rain:   { nm: '雨衣',          cat: 'armor', wt: 1.2, slot: 'body', cls: 0, ins: 2, rain: true, val: 40,  ic: { k: 'armor', c: '#3f6e5a' }, desc: '免疫淋湿。风暴区必备。' },
  ar_leather:{ nm: '皮夹克',        cat: 'armor', wt: 2.0, slot: 'body', cls: 1, ins: 2, val: 90,  ic: { k: 'armor', c: '#5c4632' }, desc: '1 级防护 + 保暖。' },
  ar_vest:   { nm: '警用防刺背心',  cat: 'armor', wt: 3.5, slot: 'body', cls: 2, ins: 1, val: 240, ic: { k: 'armor', c: '#2e3f52' }, desc: '2 级。警察局的遗产。' },
  ar_lab:    { nm: '实验室防护服',  cat: 'armor', wt: 2.2, slot: 'body', cls: 2, ins: 1, inf: 0.6, val: 380, ic: { k: 'armor', c: '#d8d4c4' }, desc: '2 级 + 伤口感染风险 -40%。' },
  ar_plate3: { nm: '军规防弹衣 III', cat: 'armor', wt: 5.5, slot: 'body', cls: 3, ins: 1, val: 620, ic: { k: 'armor', c: '#4b573a' }, desc: '3 级插板。军用检查站限定。' },
  ar_plate4: { nm: '军规防弹衣 IV', cat: 'armor', wt: 6.5, slot: 'body', cls: 4, ins: 1, val: 980, ic: { k: 'armor', c: '#394231' }, desc: '4 级插板。重，但很安心。' },
  ar_viktor: { nm: '“鸭维克托”重型装甲', cat: 'armor', wt: 9.0, slot: 'body', cls: 6, ins: 3, val: 4000, ic: { k: 'armor', c: '#2f3a2f' }, desc: '6 级。路障的遗物。[Boss 掉落]' },
  h_cap:     { nm: '棒球帽',        cat: 'helmet', wt: 0.2, slot: 'head', cls: 0, val: 10,  ic: { k: 'helmet', c: '#37506b' }, desc: '时尚时尚最时尚。' },
  h_hard:    { nm: '工地安全盔',    cat: 'helmet', wt: 0.7, slot: 'head', cls: 1, ins: 1, val: 40,  ic: { k: 'helmet', c: '#d9a520' }, desc: '1 级头部防护。' },
  h_police:  { nm: '警用头盔',      cat: 'helmet', wt: 1.1, slot: 'head', cls: 2, val: 160, ic: { k: 'helmet', c: '#2b3f5c' }, desc: '2 级头部防护。' },
  h_mil:     { nm: '军用头盔',      cat: 'helmet', wt: 1.5, slot: 'head', cls: 3, ins: 1, val: 420, ic: { k: 'helmet', c: '#4b573a' }, desc: '3 级头部防护。' },
  h_sf:      { nm: '特种作战盔',    cat: 'helmet', wt: 1.7, slot: 'head', cls: 4, val: 850, ic: { k: 'helmet', c: '#333c33' }, desc: '4 级。实验室 B2 限定。' },

  // ---------- 背包 / 照明 / 护目 ----------
  bag_school:{ nm: '学生书包',    cat: 'bag', wt: 0.8, cap: 8,  val: 50,  ic: { k: 'bag', c: '#7a4a3a' }, desc: '容量 +8kg。' },
  bag_tac:   { nm: '战术背包',    cat: 'bag', wt: 1.6, cap: 14, val: 320, ic: { k: 'bag', c: '#4b573a' }, desc: '容量 +14kg。' },
  bag_hike:  { nm: '登山背包',    cat: 'bag', wt: 2.4, cap: 20, val: 600, ic: { k: 'bag', c: '#8a6b45' }, desc: '容量 +20kg。撤离发财专用。' },
  fl_torch:  { nm: '手电筒',      cat: 'light', wt: 0.5, slot: 'light', beam: 9, batt: 1.0, drain: 0.35, val: 40, ic: { k: 'light', c: '#c9c9c9' }, desc: '装电池。夜战与实验室必需。' },
  fl_tact:   { nm: '战术强光手电', cat: 'light', wt: 0.7, slot: 'light', beam: 13, batt: 1.0, drain: 0.22, val: 180, ic: { k: 'light', c: '#8d99a6' }, desc: '更远更亮更省电。' },
  it_batt:   { nm: '电池',        cat: 'tool', wt: 0.1, stack: 4, val: 12, ic: { k: 'tool', c: '#e8b33a' }, desc: '为手电补充电量。' },
  g_thermal: { nm: '热成像护目镜', cat: 'goggle', wt: 0.5, slot: 'goggles', thermal: true, val: 1200, ic: { k: 'goggle', c: '#e86a3a' }, desc: '占用护目槽，按 T 开启热成像。' },

  // ---------- 医疗（僵毁 §6 伤情体系） ----------
  m_bandage: { nm: '绷带',       cat: 'med', wt: 0.1, use: { type: 'bandage', power: 1 }, stack: 5, val: 18, ic: { k: 'med', c: '#d8d3c0' }, desc: '止血 + 缓慢愈合。可能不干净。' },
  m_bandS:   { nm: '无菌绷带',   cat: 'med', wt: 0.1, use: { type: 'bandage', power: 1.5, clean: true }, stack: 5, val: 40, ic: { k: 'med', c: '#eef0e6' }, desc: '止血且大幅降低伤口感染。' },
  m_alcohol: { nm: '酒精棉',     cat: 'med', wt: 0.05, use: { type: 'disinfect' }, stack: 6, val: 15, ic: { k: 'med', c: '#b8e0d2' }, desc: '消毒伤口，预防/治疗伤口感染。' },
  m_pain:    { nm: '止痛药',     cat: 'med', wt: 0.05, use: { type: 'painkiller', t: 300 }, stack: 4, val: 25, ic: { k: 'med', c: '#e8d06a' }, desc: '5 游戏小时内压制疼痛 debuff。' },
  m_antibio: { nm: '抗生素',     cat: 'med', wt: 0.05, use: { type: 'antibio' }, stack: 3, val: 60, ic: { k: 'med', c: '#e88a8a' }, desc: '延缓伤口感染与流感恶化。' },
  m_splint:  { nm: '夹板',       cat: 'med', wt: 0.3, use: { type: 'splint' }, stack: 2, val: 30, ic: { k: 'med', c: '#c9a86a' }, desc: '固定骨折。腿部骨折不用它就等死吧。' },
  m_medkit:  { nm: '急救包',     cat: 'med', wt: 1.2, use: { type: 'medkit', power: 45, t: 4 }, val: 130, ic: { k: 'med', c: '#e5484d' }, desc: '大量回血。使用需静止站桩 4 秒。' },
  m_surgery: { nm: '手术包',     cat: 'med', wt: 1.5, use: { type: 'surgery', t: 6 }, val: 320, ic: { k: 'med', c: '#d8b0e0' }, desc: '复位骨折 + 修复部位上限。站桩 6 秒。' },
  m_syr:     { nm: '恢复针',     cat: 'med', wt: 0.15, use: { type: 'syringe', hot: 14, t: 8 }, stack: 2, val: 260, ic: { k: 'med', c: '#4fd0a0' }, desc: '移动中使用！8 秒持续回血。打带跑神器。[鸭科夫]' },
  m_syrWt:   { nm: '负重针',     cat: 'med', wt: 0.15, use: { type: 'syringeWt', t: 60 }, stack: 2, val: 200, ic: { k: 'med', c: '#4fa3e3' }, desc: '10 游戏分钟内负重上限 +12kg。[鸭科夫]' },
  it_smoke:  { nm: '香烟',       cat: 'med', wt: 0.02, use: { type: 'smoke' }, stack: 8, val: 6, ic: { k: 'cig', c: '#e8e4d8' }, desc: '减压。需要打火机。老烟枪离不开它。' },

  // ---------- 食物 / 水（僵毁需求系统） ----------
  f_canBeans:{ nm: '罐头·炖豆', cat: 'food', wt: 0.4, eat: { hunger: 28 }, stack: 3, val: 14, ic: { k: 'food', c: '#b5652a' }, desc: '干了这罐豆。' },
  f_canCorn: { nm: '罐头·玉米', cat: 'food', wt: 0.35, eat: { hunger: 22 }, stack: 3, val: 12, ic: { k: 'food', c: '#e0c04a' }, desc: '甜的。' },
  f_canSoup: { nm: '罐头·浓汤', cat: 'food', wt: 0.5, eat: { hunger: 24, thirst: 10 }, stack: 3, val: 18, ic: { k: 'food', c: '#c98a3a' }, desc: '连吃带喝。' },
  f_ration:  { nm: '压缩口粮',  cat: 'food', wt: 0.2, eat: { hunger: 35, happy: -3 }, stack: 4, val: 26, ic: { k: 'food', c: '#8a7d5a' }, desc: '军用热量砖。难吃但顶饿。' },
  f_pbz:     { nm: '花生酱',    cat: 'food', wt: 0.6, eat: { hunger: 40, happy: 4 }, uses: 3, val: 30, ic: { k: 'food', c: '#c9862a' }, desc: '末日硬通货。' },
  f_choco:   { nm: '巧克力',    cat: 'food', wt: 0.1, eat: { hunger: 10, happy: 12 }, stack: 5, val: 16, ic: { k: 'food', c: '#6b4632' }, desc: ' unhappiness 的答案。' },
  f_meatRaw: { nm: '生肉',      cat: 'food', wt: 0.5, eat: { hunger: 22, raw: true, poison: 0.45 }, cookTo: 'f_meatCook', val: 10, ic: { k: 'food', c: '#c05a5a' }, desc: '生吃会食物中毒。想办法烤了。' },
  f_meatCook:{ nm: '烤肉',      cat: 'food', wt: 0.4, eat: { hunger: 42, happy: 6 }, val: 22, ic: { k: 'food', c: '#a8763a' }, desc: '喷香。' },
  f_berry:   { nm: '浆果',      cat: 'food', wt: 0.05, eat: { hunger: 8, thirst: 4 }, stack: 8, val: 3, ic: { k: 'food', c: '#b0453a' }, desc: '野外搜集获得。' },
  f_mush:    { nm: '蘑菇',      cat: 'food', wt: 0.08, eat: { hunger: 10, poison: 0.5 }, stack: 8, val: 3, ic: { k: 'food', c: '#c9b07a' }, desc: '红伞伞白杆杆……' },
  f_protein: { nm: '蛋白粉',    cat: 'food', wt: 0.8, eat: { hunger: 15, fit: 1 }, val: 60, ic: { k: 'food', c: '#d8d0b8' }, desc: '泥巴的最爱：健身技能经验 +30%。' },
  f_cookie:  { nm: '过期饼干',  cat: 'food', wt: 0.2, eat: { hunger: 14, happy: -8 }, stack: 4, val: 5, ic: { k: 'food', c: '#9a8a6a' }, desc: '受潮了。吃了不开心。' },
  w_bottle:  { nm: '瓶装水',    cat: 'drink', wt: 0.8, drink: { thirst: 55 }, uses: 2, val: 12, ic: { k: 'drink', c: '#7fc8e8' }, desc: '干净的水。' },
  w_dirty:   { nm: '浑水',      cat: 'drink', wt: 0.8, drink: { thirst: 50, sick: 0.35 }, uses: 2, val: 2, ic: { k: 'drink', c: '#8a9a6a' }, desc: '直接喝有风险。用净水药片处理。' },
  w_puritab: { nm: '净水药片',  cat: 'med', wt: 0.02, use: { type: 'purify' }, stack: 6, val: 10, ic: { k: 'med', c: '#8ad0e8' }, desc: '将浑水净化为瓶装水。' },
  w_soda:    { nm: '汽水',      cat: 'drink', wt: 0.4, drink: { thirst: 35, happy: 6 }, stack: 3, val: 10, ic: { k: 'drink', c: '#e05a5a' }, desc: '糖分带来快乐。' },
  w_coffee:  { nm: '罐装咖啡',  cat: 'drink', wt: 0.3, drink: { thirst: 12, fatigue: -35 }, stack: 3, val: 18, ic: { k: 'drink', c: '#6b4a32' }, desc: '疲劳消除。' },
  w_beer:    { nm: '啤酒',      cat: 'drink', wt: 0.5, drink: { thirst: 18, stress: -20, drunk: 1 }, stack: 3, val: 8, ic: { k: 'drink', c: '#d8a83a' }, desc: '借酒消愁。会晕。' },

  // ---------- 材料 / 工具 ----------
  mat_plank: { nm: '木板',     cat: 'mat', wt: 1.2, stack: 6, val: 6,  ic: { k: 'mat', c: '#a8824e' }, desc: '封窗钉门的基本材料。' },
  mat_nails: { nm: '盒装钉子', cat: 'mat', wt: 0.3, stack: 4, val: 8,  ic: { k: 'mat', c: '#aab2ba' }, desc: '木工好伙伴。' },
  mat_sheet: { nm: '布条',     cat: 'mat', wt: 0.08, stack: 8, val: 3, ic: { k: 'mat', c: '#c4b8a0' }, desc: '撕衣服获得。可制绷带。' },
  mat_scrap: { nm: '零件',     cat: 'mat', wt: 0.5, stack: 10, val: 12, ic: { k: 'mat', c: '#7a828c' }, desc: '升级工作台 / 制作配件。' },
  mat_elec:  { nm: '电子元件', cat: 'mat', wt: 0.1, stack: 8, val: 30, ic: { k: 'mat', c: '#5ab0a0' }, desc: '高科技材料。藏身处升级核心。' },
  mat_powder:{ nm: '火药',     cat: 'mat', wt: 0.1, stack: 6, val: 15, ic: { k: 'mat', c: '#8a7a5a' }, desc: '压装弹药。' },
  mat_case:  { nm: '弹壳',     cat: 'mat', wt: 0.02, stack: 20, val: 2, ic: { k: 'mat', c: '#c9a83a' }, desc: '回收再利用。' },
  mat_head:  { nm: '弹头',     cat: 'mat', wt: 0.02, stack: 20, val: 2, ic: { k: 'mat', c: '#9aa2aa' }, desc: '压装弹药。' },
  mat_duct:  { nm: '胶带',     cat: 'mat', wt: 0.2, stack: 3, val: 10, ic: { k: 'mat', c: '#8a8a8a' }, desc: '万物皆可粘。修复武器耐久。' },
  mat_chem:  { nm: '化学试剂', cat: 'mat', wt: 0.4, stack: 5, val: 45, ic: { k: 'mat', c: '#b07ce8' }, desc: '实验室材料。合成紫弹。' },
  t_hammer:  { nm: '锤子',     cat: 'tool', wt: 1.0, tool: 'hammer', val: 20, ic: { k: 'tool', c: '#8d99a6' }, desc: '封窗 / 木工制作。' },
  t_screw:   { nm: '螺丝刀',   cat: 'tool', wt: 0.3, tool: 'screw', val: 12, ic: { k: 'tool', c: '#d13438' }, desc: '拆装配件。' },
  t_saw:     { nm: '锯子',     cat: 'tool', wt: 1.4, tool: 'saw', val: 24, ic: { k: 'tool', c: '#7d8a96' }, desc: '锯木板 / 制作长矛。' },
  t_lighter: { nm: '打火机',   cat: 'tool', wt: 0.05, tool: 'lighter', val: 8, ic: { k: 'tool', c: '#e8a03a' }, desc: '点烟 / 引燃篝火。' },

  // ---------- 贵重品 / 凭证 / 书籍（鸭科夫撤离经济） ----------
  v_cash:   { nm: '现金',         cat: 'val', wt: 0.05, stack: 50, val: 20, ic: { k: 'val', c: '#6ba85a' }, desc: '神秘商人只收现金。' },
  v_gpu:    { nm: '显卡',         cat: 'val', wt: 1.8, val: 850, ic: { k: 'val', c: '#3a3f46' }, desc: '为什么末日了还有人在抢显卡？' },
  v_gold:   { nm: '金条',         cat: 'val', wt: 4.0, val: 1800, ic: { k: 'val', c: '#e8c03a' }, desc: '沉沉的安心感。' },
  v_intel:  { nm: '情报文件',     cat: 'val', wt: 0.2, stack: 5, val: 120, ic: { k: 'val', c: '#c9a86a' }, desc: '鸭科夫残留情报。情报中心需要它。' },
  v_bpwb:   { nm: '工作台图纸·III', cat: 'val', wt: 0.3, val: 600, ic: { k: 'val', c: '#4a90d8' }, desc: '解锁工作台 III 级（紫弹/风暴枪）。' },
  v_bpship: { nm: '神秘飞船图纸', cat: 'val', wt: 0.2, val: 3000, ic: { k: 'val', c: '#7ce8d8' }, desc: '「它们来自星海，也将归于星海。」触发隐藏结局。' },
  k_blue:   { nm: '蓝门禁卡', cat: 'key', wt: 0.02, val: 100, ic: { k: 'key', c: '#4fa3e3' }, desc: 'J-Lab B2 蓝卡房。' },
  k_purple: { nm: '紫门禁卡', cat: 'key', wt: 0.02, val: 200, ic: { k: 'key', c: '#b07ce8' }, desc: 'J-Lab B2 紫卡房。' },
  k_red:    { nm: '红门禁卡', cat: 'key', wt: 0.02, val: 350, ic: { k: 'key', c: '#e5484d' }, desc: 'J-Lab B2 红卡房。' },
  k_cred1:  { nm: '1级凭证', cat: 'key', wt: 0.05, val: 500, ic: { k: 'key', c: '#e8c03a' }, desc: '进入 J-Lab 实验室的通行证。' },
  k_cred3:  { nm: '3级凭证', cat: 'key', wt: 0.05, val: 1500, ic: { k: 'key', c: '#e8603a' }, desc: '进入风暴区的通行证。消耗品。' },
  b_novel:  { nm: '小说《鸭雾》', cat: 'book', wt: 0.5, read: { boredom: -45 }, val: 15, ic: { k: 'book', c: '#8a5a6a' }, desc: '打发无聊。' },
  b_carp:   { nm: '木工手册', cat: 'book', wt: 0.6, read: { xp: { carpentry: 2.5 } }, val: 40, ic: { k: 'book', c: '#a8824e' }, desc: '研读 +木工经验 250%。' },
  b_fa:     { nm: '急救手册', cat: 'book', wt: 0.6, read: { xp: { firstaid: 2.5 } }, val: 40, ic: { k: 'book', c: '#d8d3c0' }, desc: '研读 +急救经验 250%。' },
  b_aim:    { nm: '射击教程', cat: 'book', wt: 0.6, read: { xp: { aiming: 2.5 } }, val: 40, ic: { k: 'book', c: '#5b6670' }, desc: '研读 +枪法经验 250%。' },
};

// 甲弹公式（文档 §4.2）
DB.dmgFormula = function (base, armorCls, pen) {
  const m = 2 / Math.max(1, (armorCls - pen + 2));
  return base * U.clamp(m, 0.1, 1.25);
};

// 实例化物品
DB.mk = function (id, qty = 1) {
  const d = DB.items[id];
  if (!d) { console.warn('未知物品', id); return null; }
  const it = { uid: U.uid(), id, qty: d.stack ? qty : 1, cond: 1 };
  if (d.cat === 'gun') { it.loaded = 0; it.ammoId = null; it.attach = {}; }
  if (d.uses) it.qty = d.uses;
  return it;
};
DB.it = id => DB.items[id];
DB.ammoOfCal = cal => Object.keys(DB.items).filter(k => DB.items[k].cat === 'ammo' && DB.items[k].cal === cal);
window.DB = DB;
