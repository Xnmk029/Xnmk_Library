/* 游戏数据定义 —— 原创实现 */
const SUITS = [
  { key: 'S', name: '黑桃', sym: '♠', color: 'black' },
  { key: 'H', name: '红桃', sym: '♥', color: 'red' },
  { key: 'C', name: '梅花', sym: '♣', color: 'black' },
  { key: 'D', name: '方块', sym: '♦', color: 'red' },
];

const RANKS = [
  { key: '2', v: 2, chips: 2 }, { key: '3', v: 3, chips: 3 },
  { key: '4', v: 4, chips: 4 }, { key: '5', v: 5, chips: 5 },
  { key: '6', v: 6, chips: 6 }, { key: '7', v: 7, chips: 7 },
  { key: '8', v: 8, chips: 8 }, { key: '9', v: 9, chips: 9 },
  { key: '10', v: 10, chips: 10 }, { key: 'J', v: 11, chips: 10 },
  { key: 'Q', v: 12, chips: 10 }, { key: 'K', v: 13, chips: 10 },
  { key: 'A', v: 14, chips: 11 },
];

/* 牌型基础表：[基础筹码, 基础倍率, 每级+筹码, 每级+倍率] */
const HAND_TYPES = {
  flush_five:     { name: '同花五条', chips: 160, mult: 16, upC: 50, upM: 3 },
  flush_house:    { name: '同花葫芦', chips: 140, mult: 14, upC: 40, upM: 4 },
  five_kind:      { name: '五条',     chips: 120, mult: 12, upC: 35, upM: 3 },
  straight_flush: { name: '同花顺',   chips: 100, mult: 8,  upC: 40, upM: 4 },
  four_kind:      { name: '四条',     chips: 60,  mult: 7,  upC: 30, upM: 3 },
  full_house:     { name: '葫芦',     chips: 40,  mult: 4,  upC: 25, upM: 2 },
  flush:          { name: '同花',     chips: 35,  mult: 4,  upC: 15, upM: 2 },
  straight:       { name: '顺子',     chips: 30,  mult: 4,  upC: 30, upM: 3 },
  three_kind:     { name: '三条',     chips: 30,  mult: 3,  upC: 20, upM: 2 },
  two_pair:       { name: '两对',     chips: 20,  mult: 2,  upC: 20, upM: 1 },
  pair:           { name: '对子',     chips: 10,  mult: 2,  upC: 15, upM: 1 },
  high_card:      { name: '高牌',     chips: 5,   mult: 1,  upC: 10, upM: 1 },
};

/* 底注需求分数 */
const ANTE_BASE = [100, 300, 800, 2000, 5000, 11000, 20000, 35000];

const BLINDS = {
  small: { name: '小盲注', mult: 1, reward: 3, icon: '🔵' },
  big:   { name: '大盲注', mult: 1.5, reward: 4, icon: '🟠' },
};

/* Boss 盲注 —— 原创效果 */
const BOSSES = [
  { key: 'wall',    name: '高墙',   desc: '需求分数额外 ×1.5', mult: 2.25, reward: 5 },
  { key: 'hook',    name: '铁钩',   desc: '每次出牌后随机弃掉 2 张手牌', mult: 2, reward: 5 },
  { key: 'water',   name: '深水',   desc: '本回合弃牌次数为 0', mult: 2, reward: 5 },
  { key: 'club',    name: '锁花',   desc: '梅花牌不参与计分', mult: 2, reward: 5 },
  { key: 'window',  name: '窗口',   desc: '首次出的牌型本回合不再计分', mult: 2, reward: 5 },
  { key: 'manacle', name: '镣铐',   desc: '手牌上限 -1', mult: 2, reward: 5 },
  { key: 'needle',  name: '钢针',   desc: '本回合只能出 1 次牌', mult: 1, reward: 5 },
  { key: 'psychic', name: '通灵',   desc: '每次必须打出 5 张牌', mult: 2, reward: 5 },
];

/* 小丑牌 —— 原创设计
   trigger: passive(常驻) / scored(计分牌逐张) / held(留手牌逐张) / after(牌型判定后) / end(回合结算) */
const JOKERS = [
  { key: 'grin',   name: '傻笑小丑', cost: 3, rarity: 0, desc: '+4 倍率',
    after: (ctx) => ({ mult: 4 }) },
  { key: 'greedy', name: '贪婪小丑', cost: 4, rarity: 0, desc: '计分的方块牌每张 +3 倍率',
    scored: (c) => c.suit === 'D' ? { mult: 3 } : null },
  { key: 'lusty',  name: '炽热小丑', cost: 4, rarity: 0, desc: '计分的红桃牌每张 +3 倍率',
    scored: (c) => c.suit === 'H' ? { mult: 3 } : null },
  { key: 'wrath',  name: '怒目小丑', cost: 4, rarity: 0, desc: '计分的黑桃牌每张 +3 倍率',
    scored: (c) => c.suit === 'S' ? { mult: 3 } : null },
  { key: 'glut',   name: '暴食小丑', cost: 4, rarity: 0, desc: '计分的梅花牌每张 +3 倍率',
    scored: (c) => c.suit === 'C' ? { mult: 3 } : null },
  { key: 'chipper',name: '筹码师',   cost: 4, rarity: 0, desc: '+30 筹码',
    after: () => ({ chips: 30 }) },
  { key: 'duo',    name: '对子迷',   cost: 5, rarity: 0, desc: '牌型含对子时 +8 倍率',
    after: (ctx) => ctx.has.pair ? { mult: 8 } : null },
  { key: 'trio',   name: '三连客',   cost: 6, rarity: 1, desc: '牌型含三条时 +12 倍率',
    after: (ctx) => ctx.has.three ? { mult: 12 } : null },
  { key: 'runner', name: '跑者',     cost: 6, rarity: 1, desc: '牌型含顺子时 +20 筹码并 +4 倍率',
    after: (ctx) => ctx.has.straight ? { chips: 20, mult: 4 } : null },
  { key: 'painter',name: '油漆匠',   cost: 6, rarity: 1, desc: '牌型含同花时 ×1.5 倍率',
    after: (ctx) => ctx.has.flush ? { xmult: 1.5 } : null },
  { key: 'face',   name: '人头收藏家', cost: 5, rarity: 0, desc: '计分的 J/Q/K 每张 +4 倍率',
    scored: (c) => c.rankV >= 11 && c.rankV <= 13 ? { mult: 4 } : null },
  { key: 'even',   name: '偶数教',   cost: 5, rarity: 0, desc: '计分的偶数牌每张 +12 筹码',
    scored: (c) => (c.rankV <= 10 && c.rankV % 2 === 0) ? { chips: 12 } : null },
  { key: 'odd',    name: '奇数教',   cost: 5, rarity: 0, desc: '计分的奇数牌(含A)每张 +8 倍率',
    scored: (c) => (c.rankV === 14 || (c.rankV <= 9 && c.rankV % 2 === 1)) ? { mult: 8 } : null },
  { key: 'ace',    name: '王牌间谍', cost: 6, rarity: 1, desc: '计分的 A 每张 +20 筹码 +4 倍率',
    scored: (c) => c.rankV === 14 ? { chips: 20, mult: 4 } : null },
  { key: 'banker', name: '银行家',   cost: 6, rarity: 1, desc: '每持有 $5 增加 +1 倍率(最多+10)',
    after: (ctx) => ({ mult: Math.min(10, Math.floor(ctx.money / 5)) }) },
  { key: 'miser',  name: '守财奴',   cost: 5, rarity: 0, desc: '回合结算额外 +$4',
    end: () => ({ money: 4 }) },
  { key: 'photo',  name: '摄影师',   cost: 7, rarity: 1, desc: '首张计分的人头牌 ×2 倍率',
    scoredOnce: (c) => (c.rankV >= 11 && c.rankV <= 13) ? { xmult: 2 } : null },
  { key: 'stone',  name: '压舱石',   cost: 7, rarity: 1, desc: '剩余出牌次数每次 ×0.5 额外倍率(乘算)',
    after: (ctx) => ctx.handsLeft > 0 ? { xmult: 1 + 0.5 * ctx.handsLeft } : null },
  { key: 'baron',  name: '男爵',     cost: 8, rarity: 2, desc: '留在手中的 K 每张 ×1.5 倍率',
    held: (c) => c.rankV === 13 ? { xmult: 1.5 } : null },
  { key: 'hiker',  name: '登山者',   cost: 5, rarity: 0, desc: '每张计分牌永久 +2 筹码',
    scored: (c) => { c.bonusChips = (c.bonusChips || 0) + 2; return { chips: 2, grow: true }; } },
  { key: 'abstract',name:'抽象派',   cost: 6, rarity: 1, desc: '每持有一张小丑牌 +3 倍率',
    after: (ctx) => ({ mult: 3 * ctx.jokerCount }) },
  { key: 'blackboard',name:'黑板',   cost: 8, rarity: 2, desc: '手牌全为黑色花色时 ×3 倍率',
    after: (ctx) => ctx.handAllBlack ? { xmult: 3 } : null },
];

/* 星球牌：升级对应牌型 */
const PLANETS = [
  { key: 'p_pair',     name: '冥王星', hand: 'pair' },
  { key: 'p_two_pair', name: '天王星', hand: 'two_pair' },
  { key: 'p_three',    name: '金星',   hand: 'three_kind' },
  { key: 'p_straight', name: '土星',   hand: 'straight' },
  { key: 'p_flush',    name: '木星',   hand: 'flush' },
  { key: 'p_full',     name: '地球',   hand: 'full_house' },
  { key: 'p_four',     name: '火星',   hand: 'four_kind' },
  { key: 'p_high',     name: '水星',   hand: 'high_card' },
  { key: 'p_sf',       name: '海王星', hand: 'straight_flush' },
];

/* 塔罗牌 —— 简化原创效果 */
const TAROTS = [
  { key: 't_money',  name: '命运之轮', desc: '立即获得 $5', use: (g) => { g.money += 5; return true; } },
  { key: 't_strength',name:'力量',     desc: '选中至多2张牌点数+1', needSel: [1, 2],
    use: (g, sel) => { sel.forEach(c => bumpRank(c, 1)); return true; } },
  { key: 't_death',  name: '死神',     desc: '选中2张牌：左边变成右边的复制', needSel: [2, 2],
    use: (g, sel) => { const [a, b] = sel; a.rank = b.rank; a.rankV = b.rankV; a.chips = b.chips; a.suit = b.suit; return true; } },
  { key: 't_sun',    name: '太阳',     desc: '选中至多3张牌变为红桃', needSel: [1, 3],
    use: (g, sel) => { sel.forEach(c => c.suit = 'H'); return true; } },
  { key: 't_moon',   name: '月亮',     desc: '选中至多3张牌变为梅花', needSel: [1, 3],
    use: (g, sel) => { sel.forEach(c => c.suit = 'C'); return true; } },
  { key: 't_star',   name: '星星',     desc: '选中至多3张牌变为方块', needSel: [1, 3],
    use: (g, sel) => { sel.forEach(c => c.suit = 'D'); return true; } },
  { key: 't_world',  name: '世界',     desc: '选中至多3张牌变为黑桃', needSel: [1, 3],
    use: (g, sel) => { sel.forEach(c => c.suit = 'S'); return true; } },
  { key: 't_hanged', name: '倒吊人',   desc: '摧毁选中的至多2张牌', needSel: [1, 2],
    use: (g, sel) => { g.destroyCards(sel); return true; } },
];

function bumpRank(c, n) {
  const idx = RANKS.findIndex(r => r.key === c.rank);
  const ni = Math.min(RANKS.length - 1, idx + n);
  const r = RANKS[ni];
  c.rank = r.key; c.rankV = r.v; c.chips = r.chips;
}

const RARITY = [
  { name: '普通', color: '#4f9cff' },
  { name: '罕见', color: '#35bd6a' },
  { name: '稀有', color: '#ff5c5c' },
];
