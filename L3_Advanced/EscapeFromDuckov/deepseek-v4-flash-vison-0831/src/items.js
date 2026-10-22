// ================= 物品数据库（僵毁式硬核物资体系） =================
export const ITEMS = {};
const I = (id, def) => { ITEMS[id] = { id, ...def }; return id; };

// ---- 武器 ----
I('fist', { name: '鸭掌', icon: '🦆', cat: 'weapon', type: 'melee', weight: 0, melee: { dmg: 0.25, range: 0.9, arc: 1.4, kb: 0.3, swing: 0.45, stam: 0.03, crit: 0.01 }, desc: '赤手空拳的鸭子也不好惹。' });
I('kitchen_knife', { name: '菜刀', icon: '🔪', cat: 'weapon', type: 'melee', weight: 0.3, melee: { dmg: 0.9, range: 1.0, arc: 1.15, kb: 0.25, swing: 0.4, stam: 0.05, crit: 0.1, stab: true }, maxCond: 60, condLoss: 0.5, desc: '短小精悍，一击必杀的厨房神话。' });
I('bat', { name: '警棍', icon: '🥢', cat: 'weapon', type: 'melee', weight: 0.7, melee: { dmg: 0.95, range: 1.1, arc: 1.2, kb: 0.6, swing: 0.5, stam: 0.06, crit: 0.1 }, maxCond: 80, condLoss: 0.25, desc: '防暴警察的标准配置。' });
I('handcuffs', { name: '手铐', icon: '⛓️', cat: 'misc', weight: 0.3, desc: '如果还有人的话。' });
I('baseball_bat', { name: '棒球棒', icon: '🏏', cat: 'weapon', type: 'melee', weight: 1.0, melee: { dmg: 1.3, range: 1.35, arc: 1.3, kb: 0.9, swing: 0.62, stam: 0.085, crit: 0.15 }, maxCond: 100, condLoss: 0.25, desc: '经典。敲起来声音清脆。' });
I('crowbar', { name: '撬棍', icon: '🪛', cat: 'weapon', type: 'melee', weight: 1.2, melee: { dmg: 1.15, range: 1.25, arc: 1.2, kb: 0.7, swing: 0.58, stam: 0.08, crit: 0.12 }, maxCond: 150, condLoss: 0.15, tool: 'crowbar', desc: '开门利器，亦是开颅利器。' });
I('fire_axe', { name: '消防斧', icon: '🪓', cat: 'weapon', type: 'melee', weight: 2.5, melee: { dmg: 2.1, range: 1.5, arc: 1.35, kb: 1.4, swing: 0.85, stam: 0.13, crit: 0.2 }, maxCond: 120, condLoss: 0.3, tool: 'axe', desc: '消防队的遗产。砍树砍门砍丧尸。' });
I('hammer', { name: '羊角锤', icon: '🔨', cat: 'weapon', type: 'melee', weight: 0.9, melee: { dmg: 0.85, range: 1.05, arc: 1.1, kb: 0.4, swing: 0.5, stam: 0.06, crit: 0.08 }, maxCond: 100, condLoss: 0.2, tool: 'hammer', desc: '木工与近战两相宜。' });
I('machete', { name: '砍刀', icon: '🗡️', cat: 'weapon', type: 'melee', weight: 0.8, melee: { dmg: 1.7, range: 1.3, arc: 1.25, kb: 0.6, swing: 0.66, stam: 0.09, crit: 0.22 }, maxCond: 80, condLoss: 0.35, desc: '锋利、耐用、致命。' });
I('garden_hoe', { name: '园艺锄', icon: '🧑‍🌾', cat: 'weapon', type: 'melee', weight: 1.4, melee: { dmg: 1.0, range: 1.4, arc: 1.25, kb: 0.7, swing: 0.72, stam: 0.1, crit: 0.1 }, maxCond: 80, condLoss: 0.3, tool: 'hoe', desc: '本用来翻土，现在用来翻…' });
I('spear', { name: '简易长矛', icon: '🔱', cat: 'weapon', type: 'melee', weight: 1.2, melee: { dmg: 1.15, range: 1.7, arc: 1.05, kb: 0.5, swing: 0.8, stam: 0.11, crit: 0.14 }, maxCond: 35, condLoss: 0.45, desc: '保持距离，活下去。' });
I('molotov', { name: '燃烧瓶', icon: '🍾', cat: 'weapon', type: 'throw', weight: 0.9, dmg: 1.2, fire: true, desc: '投掷后引燃一片区域。' });
I('fish_bait', { name: '鱼饵', icon: '🪱', cat: 'misc', type: 'bait', weight: 0.05, stack: true, ammoCnt: 10, desc: '钓鱼用。' });
I('barricade_kit', { name: '加固板', icon: '🪟', cat: 'material', type: 'material', weight: 1.5, stack: true, ammoCnt: 5, tool: 'bkit', desc: '安装在门窗上的木板。' });

// ---- 枪械 ----
const G = (id, def) => I(id, { cat: 'weapon', type: 'gun', ...def });
G('m1911', { name: 'M1911 手枪', icon: '🔫', weight: 1.1, ammo: '45acp', magCap: 7, range: 16, noise: 70, damage: 2.2, acc: 0.62, rof: 1.0, maxCond: 100, condLoss: 0.12, slots: ['muzzle'], desc: '百年经典，.45 的可靠伙伴。' });
G('glock17', { name: 'G17 手枪', icon: '🔫', weight: 0.7, ammo: '9mm', magCap: 17, range: 15, noise: 62, damage: 1.7, acc: 0.66, rof: 1.1, maxCond: 100, condLoss: 0.1, slots: ['muzzle', 'sight'], desc: '警用手枪，弹容宽裕。' });
G('mp5', { name: 'MP5 冲锋枪', icon: '🔫', weight: 2.6, ammo: '9mm', magCap: 30, range: 20, noise: 55, damage: 1.5, acc: 0.72, rof: 0.11, maxCond: 120, condLoss: 0.14, slots: ['muzzle', 'sight', 'stock'], desc: '特警标配，连射稳定。' });
G('akm', { name: 'AKM 突击步枪', icon: '🔫', weight: 3.4, ammo: '762x39', magCap: 30, range: 28, noise: 78, damage: 2.4, acc: 0.68, rof: 0.1, maxCond: 140, condLoss: 0.18, slots: ['muzzle', 'sight', 'stock', 'grip'], desc: '废土之王，从不卡壳（骗你的）。' });
G('m16', { name: 'M16 突击步枪', icon: '🔫', weight: 3.2, ammo: '556', magCap: 30, range: 30, noise: 74, damage: 2.2, acc: 0.74, rof: 0.1, maxCond: 130, condLoss: 0.15, slots: ['muzzle', 'sight', 'stock', 'grip'], desc: '精准与火力兼具。' });
G('rem870', { name: '雷明顿 870 霰弹枪', icon: '🔫', weight: 3.0, ammo: '12g', magCap: 6, range: 9, noise: 82, damage: 1.2, pellets: 6, spread: 0.13, acc: 0.6, rof: 0.75, maxCond: 110, condLoss: 0.16, slots: ['stock'], desc: '近距离众生平等。' });
G('sks', { name: 'SKS 半自动步枪', icon: '🔫', weight: 3.6, ammo: '762x39', magCap: 10, range: 34, noise: 76, damage: 2.6, acc: 0.8, rof: 0.55, maxCond: 120, condLoss: 0.12, slots: ['sight', 'stock'], desc: '猎鸭神枪，一枪一个。' });
G('hunting_rifle', { name: '猎枪 (栓动)', icon: '🔫', weight: 3.3, ammo: '308', magCap: 4, range: 42, noise: 80, damage: 3.4, acc: 0.88, rof: 1.1, maxCond: 110, condLoss: 0.1, slots: ['sight', 'stock'], desc: '远距离点名，安静而致命。' });

// ---- 弹药 ----
const A = (id, def) => I(id, { cat: 'ammo', type: 'ammo', stack: true, ...def });
A('9mm', { name: '9mm 子弹', icon: '🧿', weight: 0.012, ammo: '9mm', ammoCnt: 50, cal: '9mm', desc: '常见手枪弹。' });
A('45acp', { name: '.45 ACP 子弹', icon: '🧿', weight: 0.016, ammo: '45acp', ammoCnt: 50, cal: '45acp', desc: '大口径手枪弹。' });
A('762x39', { name: '7.62×39 子弹', icon: '🧿', weight: 0.018, ammo: '762x39', ammoCnt: 30, cal: '762x39', desc: 'AK 系步枪弹。' });
A('556', { name: '5.56 NATO 子弹', icon: '🧿', weight: 0.014, ammo: '556', ammoCnt: 30, cal: '556', desc: 'M16 系步枪弹。' });
A('12g', { name: '12号 霰弹', icon: '🧿', weight: 0.04, ammo: '12g', ammoCnt: 25, cal: '12g', desc: '霰弹枪弹药。' });
A('308', { name: '.308 步枪弹', icon: '🧿', weight: 0.02, ammo: '308', ammoCnt: 20, cal: '308', desc: '全威力步枪弹。' });

// ---- 配件 ----
const M = (id, def) => I(id, { cat: 'weapon', type: 'attach', stack: false, ...def });
M('sup_9', { name: '消音器 (9mm)', icon: '🔇', weight: 0.4, slot: 'muzzle', noiseMult: 0.35, forAmmo: ['9mm'], desc: '大幅降低枪声。' });
M('sup_762', { name: '消音器 (7.62)', icon: '🔇', weight: 0.5, slot: 'muzzle', noiseMult: 0.4, forAmmo: ['762x39', '556', '308'], desc: '步枪消音器。' });
M('comp_45', { name: '制退器 (.45)', icon: '➖', weight: 0.2, slot: 'muzzle', accMult: 1.12, forAmmo: ['45acp'], desc: '降低后坐晃动。' });
M('reddot', { name: '红点瞄准镜', icon: '🎯', weight: 0.3, slot: 'sight', accMult: 1.18, desc: '快速瞄准，提升精度。' });
M('scope4x', { name: '4倍镜', icon: '🔭', weight: 0.55, slot: 'sight', accMult: 1.4, rangeMult: 1.35, desc: '远距离利器。' });
M('laser', { name: '激光指示器', icon: '📡', weight: 0.15, slot: 'grip', accMult: 1.1, desc: '腰射更稳。' });
M('stock_pad', { name: '枪托垫', icon: '🪑', weight: 0.25, slot: 'stock', accMult: 1.08, desc: '更贴肩，更稳定。' });

// ---- 服装（保温/防护/护甲等级） ----
const C = (id, def) => I(id, { cat: 'clothing', type: 'cloth', stack: false, ...def });
C('tshirt', { name: 'T恤', icon: '👕', weight: 0.25, slot: 'shirt', warmth: 0.1, prot: { bite: 0.02, scratch: 0.03 } });
C('hoddie', { name: '连帽衫', icon: '🧥', weight: 0.6, slot: 'shirt', warmth: 0.35, prot: { bite: 0.05, scratch: 0.08 } });
C('sweater', { name: '毛衣', icon: '🧶', weight: 0.5, slot: 'shirt', warmth: 0.5, prot: { bite: 0.04, scratch: 0.07 } });
C('leather_jacket', { name: '皮夹克', icon: '🧥', weight: 2.0, slot: 'jacket', warmth: 0.55, prot: { bite: 0.2, scratch: 0.28 } });
C('jeans', { name: '牛仔裤', icon: '👖', weight: 0.8, slot: 'pants', warmth: 0.3, prot: { bite: 0.06, scratch: 0.1 } });
C('boots', { name: '军靴', icon: '👢', weight: 1.0, slot: 'shoes', warmth: 0.35, prot: { bite: 0.08, scratch: 0.1 }, stepNoise: 0.9 });
C('sneakers', { name: '运动鞋', icon: '👟', weight: 0.5, slot: 'shoes', warmth: 0.1, stepNoise: 0.65 });
C('police_vest', { name: '警用防弹背心', icon: '🦺', weight: 4.5, slot: 'vest', warmth: 0.3, armor: 3, prot: { bite: 0.45, scratch: 0.5 }, armorZone: ['torso', 'upperBack'] });
C('military_vest', { name: '军用防弹背心', icon: '🦺', weight: 6.5, slot: 'vest', warmth: 0.4, armor: 5, prot: { bite: 0.65, scratch: 0.72 }, armorZone: ['torso', 'upperBack'] });
C('tactical_helmet', { name: '战术头盔', icon: '🪖', weight: 1.5, slot: 'head', warmth: 0.15, armor: 4, prot: { bite: 0.5, scratch: 0.6 }, armorZone: ['head'] });
C('ballcap', { name: '鸭舌帽', icon: '🧢', weight: 0.15, slot: 'head', warmth: 0.05 });
C('gas_mask', { name: '防毒面具', icon: '😷', weight: 0.8, slot: 'mask', corpseSickMult: 0.25, style: 'gas' });
C('scarf', { name: '围巾', icon: '🧣', weight: 0.2, slot: 'mask', warmth: 0.2 });
C('gloves', { name: '工作手套', icon: '🧤', weight: 0.2, slot: 'gloves', prot: { bite: 0.05, scratch: 0.08 } });

// ---- 背包/容器 ----
const B = (id, def) => I(id, { cat: 'container', type: 'bag', stack: false, ...def });
B('schoolbag', { name: '书包', icon: '🎒', weight: 0.6, cap: 10, red: 0.7 });
B('duffelbag', { name: '行李袋', icon: '👜', weight: 0.8, cap: 16, red: 0.65 });
B('hiking_bag', { name: '登山包', icon: '🎒', weight: 1.6, cap: 26, red: 0.55 });
B('military_ruck', { name: '军用大背囊', icon: '🎒', weight: 2.8, cap: 36, red: 0.45 });
B('fanny', { name: '腰包', icon: '👝', weight: 0.2, cap: 4, red: 0.9 });

// ---- 食物（spoil=变质小时数） ----
const F = (id, def) => I(id, { cat: 'food', type: 'food', stack: true, ...def });
F('can_beans', { name: '黄豆罐头', icon: '🥫', weight: 0.42, hunger: -30, thirst: 2, spoil: -1, opened: { name: '打开的黄豆罐头', icon: '🥫', spoil: 30, hunger: -30 }, desc: '灾难的浪漫。' });
F('can_tuna', { name: '金枪鱼罐头', icon: '🥫', weight: 0.35, hunger: -25, thirst: 3, spoil: -1, opened: { name: '打开的鱼罐头', icon: '🥫', spoil: 26, hunger: -25 } });
F('beef_jerky', { name: '牛肉干', icon: '🥩', weight: 0.12, hunger: -12, thirst: 6, spoil: 2400, desc: '高蛋白，耐储存。' });
F('chips', { name: '薯片', icon: '🍟', weight: 0.15, hunger: -10, thirst: 7, spoil: 2000, happy: 6, bored: -6, desc: '嘎嘣脆，鸭生快乐水。' });
F('candy', { name: '糖果', icon: '🍬', weight: 0.05, hunger: -5, happy: 4, bored: -4, spoil: -1 });
F('chocolate', { name: '巧克力', icon: '🍫', weight: 0.1, hunger: -18, happy: 10, bored: -8, spoil: 1800 });
F('apple', { name: '苹果', icon: '🍎', weight: 0.2, hunger: -10, thirst: -6, happy: 2, spoil: 72 });
F('banana', { name: '香蕉', icon: '🍌', weight: 0.18, hunger: -12, happy: 3, spoil: 60 });
F('bread', { name: '面包', icon: '🍞', weight: 0.25, hunger: -22, spoil: 72 });
F('ramen', { name: '泡面', icon: '🍜', weight: 0.1, hunger: -16, thirst: 9, spoil: -1, cook: true, rawHunger: -8 });
F('peanut_butter', { name: '花生酱', icon: '🥜', weight: 0.5, hunger: -28, spoil: -1 });
F('canned_soup', { name: '浓汤罐头', icon: '🥫', weight: 0.4, hunger: -20, thirst: -5, spoil: -1, cook: true, rawHunger: -12, opened: { name: '打开的浓汤', icon: '🥫', spoil: 20, hunger: -20, thirst: -5 } });
F('dogfood', { name: '狗粮', icon: '🦴', weight: 0.4, hunger: -26, unhappy: 6, spoil: -1, desc: '鸭力太大时才会吃。' });
F('milk', { name: '牛奶', icon: '🥛', weight: 0.3, hunger: -8, thirst: -20, spoil: 48 });
F('watermelon', { name: '西瓜', icon: '🍉', weight: 2.5, hunger: -35, thirst: -30, happy: 8, spoil: 96 });

// ---- 饮料 ----
const D = (id, def) => I(id, { cat: 'food', type: 'drink', stack: true, ...def });
D('water_bottle', { name: '瓶装水', icon: '💧', weight: 0.5, thirst: -40, hunger: 0, spoil: -1, keepsContainer: 'bottle' });
D('cola', { name: '汽水', icon: '🥤', weight: 0.5, thirst: -22, hunger: -5, happy: 4, spoil: -1, keepsContainer: 'bottle' });
D('coffee', { name: '咖啡', icon: '☕', weight: 0.4, thirst: -18, fatigue: -12, spoil: 24, keepsContainer: 'bottle', cook: true });
D('juice', { name: '果汁', icon: '🧃', weight: 0.5, thirst: -26, hunger: -6, happy: 3, spoil: 60, keepsContainer: 'bottle' });
D('whiskey', { name: '威士忌', icon: '🥃', weight: 0.7, thirst: -8, happy: 12, pain: -8, drunk: 15, spoil: -1 });
D('antiseptic_drink', { name: '消毒液(误)', icon: '🧴', weight: 0.3, thirst: -5, sick: 30, desc: '…认真的吗？' });

// ---- 医疗 ----
const H = (id, def) => I(id, { cat: 'medical', type: 'med', stack: true, ...def });
H('bandage', { name: '绷带', icon: '🩹', weight: 0.05, heal: { stopBleed: 1, healRate: 2.2 }, uses: 1, useTime: 2 });
H('bandage_sterile', { name: '无菌绷带', icon: '🩹', weight: 0.05, heal: { stopBleed: 1, infectRed: 1, healRate: 2.6 }, uses: 1, useTime: 2 });
H('suture', { name: '缝合针线', icon: '🧵', weight: 0.03, heal: { stopBleed: 1.4, healRate: 5, needs: 'sew' }, uses: 1, useTime: 4 });
H('splint', { name: '夹板', icon: '🩼', weight: 0.7, heal: { fixFracture: 1 }, uses: 1, useTime: 3 });
H('painkillers', { name: '止痛药', icon: '💊', weight: 0.02, pain: -40, painDur: 4, uses: 2, useTime: 0.8 });
H('antibiotics', { name: '抗生素', icon: '💊', weight: 0.02, sick: -25, sickDur: 8, uses: 2, useTime: 0.8 });
H('vitamins', { name: '维生素', icon: '💊', weight: 0.02, fatigue: -12, uses: 3, useTime: 0.8 });
H('beta_blockers', { name: 'β-阻断剂', icon: '💊', weight: 0.02, panic: -30, panicDur: 6, uses: 2, useTime: 0.8 });
H('sleeping_pills', { name: '安眠药', icon: '💊', weight: 0.02, sleepiness: 60, uses: 2, useTime: 0.8 });
H('firstaid_kit', { name: '急救包', icon: '🧰', weight: 1.5, heal: { stopBleed: 1, healRate: 12, infectRed: 1 }, uses: 1, useTime: 5, desc: '大回血，但需要安全环境。' });
H('tweezers', { name: '镊子', icon: '🥢', weight: 0.05, tool: 'tweezers', desc: '清理伤口碎玻璃。' });
H('disinfectant', { name: '消毒水', icon: '🧴', weight: 0.4, heal: { infectRed: 1 }, uses: 4, useTime: 1.5, desc: '消毒伤口，降低感染。' });
H('sterile_rag', { name: '无菌敷料', icon: '🧻', weight: 0.02, heal: { stopBleed: 0.7 }, uses: 1, useTime: 1.5 });

// ---- 工具 ----
const T = (id, def) => I(id, { cat: 'tool', type: 'tool', stack: false, ...def });
T('screwdriver', { name: '螺丝刀', icon: '🪛', weight: 0.3, tool: 'screwdriver' });
T('saw', { name: '手锯', icon: '🪚', weight: 1.0, tool: 'saw', desc: '锯木板，锯木板。' });
T('nails', { name: '钉子', icon: '📌', weight: 0.005, cat: 'material', type: 'material', stack: true, ammoCnt: 100, tool: 'nails' });
T('lighter', { name: '打火机', icon: '🔥', weight: 0.05, tool: 'lighter' });
T('matches', { name: '火柴', icon: '🔥', weight: 0.02, cat: 'material', stack: true, ammoCnt: 20, tool: 'lighter', toolUses: 20 });
T('flashlight', { name: '手电筒', icon: '🔦', weight: 0.5, tool: 'flashlight', desc: '照亮黑暗的可靠伙伴。' });
T('tent_kit', { name: '帐篷工具包', icon: '⛺', weight: 1.5, tool: 'tent' });
T('can_opener', { name: '开罐器', icon: '🥫', weight: 0.1, tool: 'canopener' });
T('frying_pan', { name: '平底锅', icon: '🍳', weight: 1.0, tool: 'cookware', desc: '可以煎蛋，也可以煎脑。' });
T('pot', { name: '汤锅', icon: '🍲', weight: 1.4, tool: 'cookware' });
T('bucket', { name: '水桶', icon: '🪣', weight: 0.6, tool: 'bucket', desc: '接雨水，装水。' });
T('watering_can', { name: '洒水壶', icon: '🫗', weight: 0.4, tool: 'watering' });
T('seed_pack', { name: '蔬菜种子', icon: '🌱', weight: 0.3, cat: 'material', stack: true, ammoCnt: 10, tool: 'seed' });
T('trowel', { name: '小铲', icon: '🪏', weight: 0.3, tool: 'trowel' });
T('radio', { name: '收音机', icon: '📻', weight: 0.6, tool: 'radio', desc: '听听紧急广播里的人类文明余音。' });
T('watch', { name: '电子表', icon: '⌚', weight: 0.05, tool: 'watch', desc: '没有它你怎么看时间？' });
T('wire', { name: '电线', icon: '〰️', weight: 0.3, cat: 'material', stack: true, ammoCnt: 5, tool: 'wire' });
T('electronics_scrap', { name: '电子元件', icon: '🔌', weight: 0.15, cat: 'material', stack: true, ammoCnt: 10, tool: 'escrap' });
T('duct_tape', { name: '胶带', icon: '🧻', weight: 0.15, cat: 'material', stack: true, ammoCnt: 5, tool: 'tape' });
T('rope', { name: '绳子', icon: '🪢', weight: 0.5, cat: 'material', stack: true, ammoCnt: 5, tool: 'rope' });
T('glue', { name: '胶水', icon: '🧴', weight: 0.1, cat: 'material', stack: true, ammoCnt: 5, tool: 'glue' });
T('sheet', { name: '床单', icon: '🧺', weight: 0.4, cat: 'material', stack: true, ammoCnt: 10, tool: 'sheet' });
T('ripped_sheet', { name: '撕碎的床单', icon: '🧻', weight: 0.05, cat: 'material', stack: true, ammoCnt: 20, tool: 'rsheet' });
T('wood_plank', { name: '木板', icon: '🪵', weight: 1.4, cat: 'material', stack: true, ammoCnt: 10, tool: 'plank', desc: '锯出来的好木板。' });
T('log', { name: '原木', icon: '🪵', weight: 6, cat: 'material', stack: true, ammoCnt: 3, tool: 'log' });
T('twigs', { name: '树枝', icon: '🌿', weight: 0.3, cat: 'material', stack: true, ammoCnt: 20, tool: 'twigs' });
T('stone', { name: '石头', icon: '🪨', weight: 0.5, cat: 'material', stack: true, ammoCnt: 10, tool: 'stone' });
T('gas_can', { name: '汽油桶', icon: '⛽', weight: 5, tool: 'gas', fuel: 10, desc: '发电机与汽车的血液。' });
T('car_battery', { name: '汽车蓄电池', icon: '🔋', weight: 8, tool: 'carbattery', desc: '修车必备。' });
T('generator', { name: '发电机', icon: '⚙️', weight: 30, tool: 'generator', desc: '把汽油变成电。需要电工技能。' });
T('car_key', { name: '车钥匙', icon: '🔑', weight: 0.02, tool: 'carkey' });
T('fuel_tank_part', { name: '油箱零件', icon: '🛢️', weight: 1.2, cat: 'material', stack: true, ammoCnt: 3, tool: 'tankpart' });

// ---- 书籍 ----
const K = (id, def) => I(id, { cat: 'book', type: 'book', stack: false, ...def });
K('book_fishing1', { name: '《钓鱼入门》', icon: '📕', weight: 0.3, bookSkill: 'fishing', bookLvl: 1 });
K('book_fishing2', { name: '《钓遍鸭科夫》', icon: '📕', weight: 0.3, bookSkill: 'fishing', bookLvl: 2 });
K('book_carp1', { name: '《木工基础》', icon: '📕', weight: 0.3, bookSkill: 'carpentry', bookLvl: 1 });
K('book_carp2', { name: '《末日木工手册》', icon: '📕', weight: 0.3, bookSkill: 'carpentry', bookLvl: 2 });
K('book_cook1', { name: '《家常菜谱》', icon: '📕', weight: 0.3, bookSkill: 'cooking', bookLvl: 1 });
K('book_cook2', { name: '《末日厨房》', icon: '📕', weight: 0.3, bookSkill: 'cooking', bookLvl: 2 });
K('book_mech1', { name: '《汽修基础》', icon: '📕', weight: 0.3, bookSkill: 'mechanics', bookLvl: 1 });
K('book_mech2', { name: '《引擎与电瓶》', icon: '📕', weight: 0.3, bookSkill: 'mechanics', bookLvl: 2 });
K('book_med1', { name: '《急救常识》', icon: '📕', weight: 0.3, bookSkill: 'firstaid', bookLvl: 1 });
K('book_med2', { name: '《战地医疗》', icon: '📕', weight: 0.3, bookSkill: 'firstaid', bookLvl: 2 });
K('book_farm1', { name: '《种植指南》', icon: '📕', weight: 0.3, bookSkill: 'farming', bookLvl: 1 });
K('book_elec1', { name: '《电工入门》', icon: '📕', weight: 0.3, bookSkill: 'electrical', bookLvl: 1 });
K('book_elec2', { name: '《家用电网改造》', icon: '📕', weight: 0.3, bookSkill: 'electrical', bookLvl: 2 });
K('book_blade1', { name: '《刀法基础》', icon: '📕', weight: 0.3, bookSkill: 'blade', bookLvl: 1 });
K('book_aim1', { name: '《射击原理》', icon: '📕', weight: 0.3, bookSkill: 'aiming', bookLvl: 1 });
K('magazine', { name: '杂志', icon: '📰', weight: 0.15, bored: -30, happy: 4, desc: '消磨时光。' });
K('comic', { name: '漫画书', icon: '📚', weight: 0.2, bored: -45, happy: 10 });
K('keycard_blue', { name: '蓝色门禁卡', icon: '💳', weight: 0.01, cat: 'misc', tool: 'key_blue', desc: '军械库蓝色钥匙卡。' });
K('keycard_red', { name: '红色门禁卡', icon: '💳', weight: 0.01, cat: 'misc', tool: 'key_red', desc: '军械库红色钥匙卡。' });
K('scrap_metal', { name: '废金属', icon: '⚙️', weight: 0.8, cat: 'material', stack: true, ammoCnt: 10, tool: 'scrap' });
K('cloth_scrap', { name: '布料', icon: '🧵', weight: 0.05, cat: 'material', stack: true, ammoCnt: 20, tool: 'cloth' });
K('whiskey_empty', { name: '空酒瓶', icon: '🍾', weight: 0.3, cat: 'material', stack: true, ammoCnt: 3, tool: 'bottle' });

// ---- 家具掉落物（世界容器用） ----
I('plank_pile', { name: '木料堆', icon: '🪵', cat: 'material', weight: 0, worldOnly: true });
I('nail_box', { name: '钉子盒', icon: '📌', cat: 'material', weight: 0, worldOnly: true });

// ================= 工具需求 =================
export const TOOLS = {
  hammer: { name: '锤子' }, saw: { name: '锯子' }, screwdriver: { name: '螺丝刀' }, axe: { name: '斧头' },
  crowbar: { name: '撬棍' }, lighter: { name: '打火机' }, canopener: { name: '开罐器' }, cookware: { name: '锅具' },
  bucket: { name: '水桶' }, watering: { name: '洒水壶' }, seed: { name: '种子' }, trowel: { name: '小铲' },
  nails: { name: '钉子' }, plank: { name: '木板' }, sheet: { name: '床单' }, rsheet: { name: '布条' },
  tape: { name: '胶带' }, glue: { name: '胶水' }, twigs: { name: '树枝' }, stone: { name: '石头' },
  wire: { name: '电线' }, escrap: { name: '电子元件' }, scrap: { name: '废金属' }, cloth: { name: '布料' },
  rope: { name: '绳子' }, bottle: { name: '瓶子' }, log: { name: '原木' }, gas: { name: '汽油' },
  tweezers: { name: '镊子' }, carkey: { name: '车钥匙' }, carbattery: { name: '汽车蓄电池' },
  generator: { name: '发电机' }, tent: { name: '帐篷包' }, flashlight: { name: '手电筒' },
  radio: { name: '收音机' }, watch: { name: '手表' }, hoe: { name: '锄头' }, bkit: { name: '加固板' },
};

// ================= 制作配方 =================
export const RECIPES = [
  { id: 'rc_ripped', name: '撕床单', out: [{ id: 'ripped_sheet', n: 4 }], inp: [{ id: 'sheet', n: 1 }], time: 2, xp: { tailoring: 1 }, desc: '把床单撕成布条。' },
  { id: 'rc_bandage', name: '制作绷带', out: [{ id: 'bandage', n: 1 }], inp: [{ id: 'ripped_sheet', n: 2 }], time: 3, xp: { firstaid: 2 }, desc: '简易止血用品。' },
  { id: 'rc_splint', name: '制作夹板', out: [{ id: 'splint', n: 1 }], inp: [{ id: 'wood_plank', n: 1 }, { id: 'ripped_sheet', n: 2 }], time: 6, xp: { firstaid: 3 }, desc: '固定骨折部位。' },
  { id: 'rc_campfire', name: '搭建营火', out: [{ id: 'campfire', n: 1, place: true }], inp: [{ id: 'twigs', n: 2 }, { id: 'log', n: 1 }], tools: ['lighter'], time: 8, xp: { cooking: 2 }, desc: '在脚下搭建篝火（需打火机）。' },
  { id: 'rc_plank', name: '锯木板', out: [{ id: 'wood_plank', n: 2 }], inp: [{ id: 'log', n: 1 }], tools: ['saw'], time: 10, xp: { carpentry: 2 }, desc: '把原木加工成木板。' },
  { id: 'rc_spear', name: '制作简易长矛', out: [{ id: 'spear', n: 1 }], inp: [{ id: 'wood_plank', n: 1 }, { id: 'kitchen_knife', n: 1, keep: true }], tools: ['tape'], time: 8, xp: { carpentry: 1 }, desc: '拉开距离的智慧。' },
  { id: 'rc_bottle', name: '制作燃烧瓶', out: [{ id: 'molotov', n: 1 }], inp: [{ id: 'bottle', n: 1 }, { id: 'gas', n: 1, keep: true }], tools: ['cloth'], time: 5, xp: { electrical: 1 }, desc: '莫洛托夫鸡尾鸭。' },
  { id: 'rc_bait', name: '制作鱼饵', out: [{ id: 'fish_bait', n: 1 }], inp: [{ id: 'twigs', n: 1 }, { id: 'cloth_scrap', n: 1 }], time: 2, xp: { fishing: 1 }, desc: '简单但有效。' },
  { id: 'rc_barricade', name: '加固门板', out: [{ id: 'barricade_kit', n: 1 }], inp: [{ id: 'wood_plank', n: 2 }, { id: 'nails', n: 2 }], tools: ['hammer'], time: 9, xp: { carpentry: 3 }, desc: '获得一块可安装的门窗加固板。' },
  { id: 'rc_repair_weap', name: '修理武器', out: [{ id: 'repair_weapon', n: 1, special: true }], inp: [{ id: 'duct_tape', n: 1 }], time: 6, xp: { maintenance: 3 }, desc: '用胶带修复手持武器耐久。' },
];