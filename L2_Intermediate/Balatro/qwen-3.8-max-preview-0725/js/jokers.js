/**
 * Balatro 小丑牌 - 小丑牌(Joker)系统
 * 各种被动效果的小丑牌
 */

const JOKER_DEFS = [
    {
        id: 'joker',
        name: '小丑',
        emoji: '🃏',
        desc: '+4 倍率',
        price: 4,
        rarity: 'common',
        calculate(hand, chips, mult) { return { mult: 4 }; }
    },
    {
        id: 'greedy_joker',
        name: '贪婪小丑',
        emoji: '💎',
        desc: '打出的方块牌给予 +3 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            const diamonds = hand.scoringCards.filter(c => c.suit === 'diamonds').length;
            return { mult: diamonds * 3 };
        }
    },
    {
        id: 'lusty_joker',
        name: '色欲小丑',
        emoji: '❤️',
        desc: '打出的红心牌给予 +3 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            const hearts = hand.scoringCards.filter(c => c.suit === 'hearts').length;
            return { mult: hearts * 3 };
        }
    },
    {
        id: 'wrathful_joker',
        name: '愤怒小丑',
        emoji: '🖤',
        desc: '打出的黑桃牌给予 +3 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            const spades = hand.scoringCards.filter(c => c.suit === 'spades').length;
            return { mult: spades * 3 };
        }
    },
    {
        id: 'glutton_joker',
        name: '暴食小丑',
        emoji: '🍽️',
        desc: '打出的梅花牌给予 +3 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            const clubs = hand.scoringCards.filter(c => c.suit === 'clubs').length;
            return { mult: clubs * 3 };
        }
    },
    {
        id: 'jolly_joker',
        name: '欢乐小丑',
        emoji: '😄',
        desc: '如果打出的牌包含对子，+8 倍率',
        price: 4,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['pair', 'two_pair', 'three_of_kind', 'full_house', 'four_of_kind', 'five_of_kind'].includes(hand.type)) {
                return { mult: 8 };
            }
            return {};
        }
    },
    {
        id: 'zany_joker',
        name: '滑稽小丑',
        emoji: '🤪',
        desc: '如果打出的牌包含三条，+12 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['three_of_kind', 'full_house', 'four_of_kind', 'five_of_kind'].includes(hand.type)) {
                return { mult: 12 };
            }
            return {};
        }
    },
    {
        id: 'mad_joker',
        name: '疯狂小丑',
        emoji: '🤡',
        desc: '如果打出的牌包含两对，+10 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['two_pair', 'full_house'].includes(hand.type)) {
                return { mult: 10 };
            }
            return {};
        }
    },
    {
        id: 'crazy_joker',
        name: '癫狂小丑',
        emoji: '🎪',
        desc: '如果打出的牌包含顺子，+12 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['straight', 'straight_flush', 'royal_flush'].includes(hand.type)) {
                return { mult: 12 };
            }
            return {};
        }
    },
    {
        id: 'droll_joker',
        name: '诙谐小丑',
        emoji: '🎭',
        desc: '如果打出的牌包含同花，+10 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['flush', 'straight_flush', 'royal_flush', 'flush_house', 'flush_five'].includes(hand.type)) {
                return { mult: 10 };
            }
            return {};
        }
    },
    {
        id: 'sly_joker',
        name: '狡黠小丑',
        emoji: '🦊',
        desc: '如果打出的牌包含对子，+50 筹码',
        price: 4,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['pair', 'two_pair', 'three_of_kind', 'full_house', 'four_of_kind', 'five_of_kind'].includes(hand.type)) {
                return { chips: 50 };
            }
            return {};
        }
    },
    {
        id: 'wily_joker',
        name: '诡计小丑',
        emoji: '🐱',
        desc: '如果打出的牌包含三条，+100 筹码',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['three_of_kind', 'full_house', 'four_of_kind', 'five_of_kind'].includes(hand.type)) {
                return { chips: 100 };
            }
            return {};
        }
    },
    {
        id: 'clever_joker',
        name: '聪慧小丑',
        emoji: '🧠',
        desc: '如果打出的牌包含两对，+80 筹码',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['two_pair', 'full_house'].includes(hand.type)) {
                return { chips: 80 };
            }
            return {};
        }
    },
    {
        id: 'devious_joker',
        name: '奸诈小丑',
        emoji: '😈',
        desc: '如果打出的牌包含顺子，+100 筹码',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['straight', 'straight_flush', 'royal_flush'].includes(hand.type)) {
                return { chips: 100 };
            }
            return {};
        }
    },
    {
        id: 'crafty_joker',
        name: '精巧小丑',
        emoji: '🔨',
        desc: '如果打出的牌包含同花，+80 筹码',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (['flush', 'straight_flush', 'royal_flush', 'flush_house', 'flush_five'].includes(hand.type)) {
                return { chips: 80 };
            }
            return {};
        }
    },
    {
        id: 'half_joker',
        name: '半个小丑',
        emoji: '🌓',
        desc: '如果打出的牌不超过3张，+20 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            if (hand.allCards.length <= 3) {
                return { mult: 20 };
            }
            return {};
        }
    },
    {
        id: 'steel_joker',
        name: '钢铁小丑',
        emoji: '🔩',
        desc: '×1.5 倍率',
        price: 6,
        rarity: 'uncommon',
        calculate(hand, chips, mult) { return { xmult: 1.5 }; }
    },
    {
        id: 'abstract_joker',
        name: '抽象小丑',
        emoji: '🎨',
        desc: '每个小丑牌 +3 倍率',
        price: 6,
        rarity: 'uncommon',
        jokerCount: 0,
        calculate(hand, chips, mult) { return { mult: (this.jokerCount || 1) * 3 }; }
    },
    {
        id: 'even_steven',
        name: '偶数斯蒂文',
        emoji: '2️⃣',
        desc: '每张偶数牌 +4 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            const evens = hand.scoringCards.filter(c => [2,4,6,8,10].includes(c.sortRank)).length;
            return { mult: evens * 4 };
        }
    },
    {
        id: 'odd_todd',
        name: '奇数托德',
        emoji: '3️⃣',
        desc: '每张奇数牌 +31 筹码',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            const odds = hand.scoringCards.filter(c => [3,5,7,9,11].includes(c.sortRank)).length;
            return { chips: odds * 31 };
        }
    },
    {
        id: 'scholar',
        name: '学者',
        emoji: '📚',
        desc: '每张A +20 筹码 +4 倍率',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) {
            const aces = hand.scoringCards.filter(c => c.rank === 'A').length;
            return { chips: aces * 20, mult: aces * 4 };
        }
    },
    {
        id: 'fibonacci',
        name: '斐波那契',
        emoji: '🐚',
        desc: '每张A/2/3/5/8给予 +8 倍率',
        price: 7,
        rarity: 'uncommon',
        calculate(hand, chips, mult) {
            const fib = hand.scoringCards.filter(c => ['A','2','3','5','8'].includes(c.rank)).length;
            return { mult: fib * 8 };
        }
    },
    {
        id: 'banner',
        name: '旗帜',
        emoji: '🚩',
        desc: '每剩余一次弃牌 +30 筹码',
        price: 5,
        rarity: 'common',
        discardsLeft: 0,
        calculate(hand, chips, mult) { return { chips: (this.discardsLeft || 0) * 30 }; }
    },
    {
        id: 'mystic_summit',
        name: '神秘之巅',
        emoji: '⛰️',
        desc: '当弃牌次数为0时，+15 倍率',
        price: 5,
        rarity: 'common',
        discardsLeft: 0,
        calculate(hand, chips, mult) {
            if ((this.discardsLeft || 0) === 0) return { mult: 15 };
            return {};
        }
    },
    {
        id: 'bull',
        name: '公牛',
        emoji: '🐂',
        desc: '每$1给予 +2 筹码',
        price: 6,
        rarity: 'uncommon',
        money: 0,
        calculate(hand, chips, mult) { return { chips: (this.money || 0) * 2 }; }
    },
    {
        id: 'blackboard',
        name: '黑板',
        emoji: '📋',
        desc: '如果手牌全是黑桃/梅花，×3 倍率',
        price: 7,
        rarity: 'uncommon',
        allBlack: false,
        calculate(hand, chips, mult) {
            if (this.allBlack) return { xmult: 3 };
            return {};
        }
    },
    {
        id: 'blue_joker',
        name: '蓝色小丑',
        emoji: '🔵',
        desc: '每张剩余牌组中的牌 +2 筹码',
        price: 5,
        rarity: 'common',
        deckRemaining: 0,
        calculate(hand, chips, mult) { return { chips: (this.deckRemaining || 0) * 2 }; }
    },
    {
        id: 'faceless_joker',
        name: '无面小丑',
        emoji: '👤',
        desc: '如果同时弃牌3张以上，+$5',
        price: 5,
        rarity: 'common',
        calculate(hand, chips, mult) { return {}; }
    },
    {
        id: 'green_joker',
        name: '绿色小丑',
        emoji: '💚',
        desc: '每次出牌 +1 倍率，每次弃牌 -1 倍率',
        price: 5,
        rarity: 'common',
        currentMult: 0,
        calculate(hand, chips, mult) { return { mult: this.currentMult || 0 }; }
    },
    {
        id: 'red_card',
        name: '红牌',
        emoji: '🟥',
        desc: '跳过商店选项时 +3 倍率',
        price: 5,
        rarity: 'common',
        currentMult: 0,
        calculate(hand, chips, mult) { return { mult: this.currentMult || 0 }; }
    },
    {
        id: 'the_duo',
        name: '二人组',
        emoji: '👥',
        desc: '如果打出的牌包含对子，×2 倍率',
        price: 8,
        rarity: 'rare',
        calculate(hand, chips, mult) {
            if (['pair', 'two_pair', 'three_of_kind', 'full_house', 'four_of_kind', 'five_of_kind'].includes(hand.type)) {
                return { xmult: 2 };
            }
            return {};
        }
    },
    {
        id: 'the_trio',
        name: '三人组',
        emoji: '👨‍👩‍👦',
        desc: '如果打出的牌包含三条，×3 倍率',
        price: 8,
        rarity: 'rare',
        calculate(hand, chips, mult) {
            if (['three_of_kind', 'full_house', 'four_of_kind', 'five_of_kind'].includes(hand.type)) {
                return { xmult: 3 };
            }
            return {};
        }
    },
    {
        id: 'the_family',
        name: '家族',
        emoji: '👨‍👩‍👧‍👦',
        desc: '如果打出的牌包含四条，×4 倍率',
        price: 9,
        rarity: 'rare',
        calculate(hand, chips, mult) {
            if (['four_of_kind', 'five_of_kind'].includes(hand.type)) {
                return { xmult: 4 };
            }
            return {};
        }
    },
];

// 塔罗牌定义
const TAROT_DEFS = [
    { id: 'fool', name: '愚者', emoji: '🌀', desc: '复制上次使用的塔罗/星球牌', price: 3 },
    { id: 'magician', name: '魔术师', emoji: '✨', desc: '将最多2张手牌变为幸运牌', price: 3 },
    { id: 'high_priestess', name: '女祭司', emoji: '🌙', desc: '获得最多2个随机星球牌', price: 3 },
    { id: 'empress', name: '女皇', emoji: '👑', desc: '将最多2张手牌变为倍率牌(+4倍率)', price: 3 },
    { id: 'strength', name: '力量', emoji: '💪', desc: '增加最多2张手牌的点数', price: 3 },
    { id: 'hanged_man', name: '倒吊人', emoji: '🙃', desc: '销毁最多2张手牌', price: 3 },
    { id: 'death', name: '死神', emoji: '💀', desc: '将一张手牌转化为另一张', price: 3 },
    { id: 'tower', name: '塔', emoji: '🗼', desc: '将最多2张手牌变为增强牌(+50筹码)', price: 3 },
    { id: 'sun', name: '太阳', emoji: '☀️', desc: '将最多2张手牌变为红心', price: 3 },
    { id: 'moon', name: '月亮', emoji: '🌕', desc: '将最多2张手牌变为黑桃', price: 3 },
    { id: 'star', name: '星星', emoji: '⭐', desc: '将最多2张手牌变为方块', price: 3 },
    { id: 'world', name: '世界', emoji: '🌍', desc: '将最多2张手牌变为梅花', price: 3 },
];

// 星球牌定义
const PLANET_DEFS = [
    { id: 'pluto', name: '冥王星', emoji: '🪐', desc: '升级高牌', hand: 'high_card', price: 3 },
    { id: 'mercury', name: '水星', emoji: '☿️', desc: '升级对子', hand: 'pair', price: 3 },
    { id: 'uranus', name: '天王星', emoji: '🔵', desc: '升级两对', hand: 'two_pair', price: 3 },
    { id: 'venus', name: '金星', emoji: '♀️', desc: '升级三条', hand: 'three_of_kind', price: 3 },
    { id: 'saturn', name: '土星', emoji: '🪐', desc: '升级顺子', hand: 'straight', price: 3 },
    { id: 'jupiter', name: '木星', emoji: '🟠', desc: '升级同花', hand: 'flush', price: 3 },
    { id: 'earth', name: '地球', emoji: '🌍', desc: '升级葫芦', hand: 'full_house', price: 3 },
    { id: 'mars', name: '火星', emoji: '🔴', desc: '升级四条', hand: 'four_of_kind', price: 3 },
    { id: 'neptune', name: '海王星', emoji: '🔷', desc: '升级同花顺', hand: 'straight_flush', price: 3 },
];

class Joker {
    constructor(def) {
        this.id = def.id;
        this.name = def.name;
        this.emoji = def.emoji;
        this.desc = def.desc;
        this.price = def.price;
        this.rarity = def.rarity;
        this._calculate = def.calculate;
        // 复制动态属性
        if (def.currentMult !== undefined) this.currentMult = def.currentMult;
        if (def.jokerCount !== undefined) this.jokerCount = def.jokerCount;
        if (def.discardsLeft !== undefined) this.discardsLeft = def.discardsLeft;
        if (def.money !== undefined) this.money = def.money;
        if (def.deckRemaining !== undefined) this.deckRemaining = def.deckRemaining;
        if (def.allBlack !== undefined) this.allBlack = def.allBlack;
    }

    calculate(evalResult, chips, mult) {
        return this._calculate.call(this, evalResult, chips, mult);
    }

    createElement() {
        const el = document.createElement('div');
        el.className = 'joker-card';
        el.innerHTML = `
            <span class="joker-emoji">${this.emoji}</span>
            <span class="joker-name">${this.name}</span>
            <div class="joker-tooltip">
                <strong>${this.name}</strong><br>
                <span>${this.desc}</span>
            </div>
        `;
        return el;
    }
}

function getRandomJokers(count = 3) {
    const available = [...JOKER_DEFS];
    const result = [];
    for (let i = 0; i < count && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        result.push(new Joker(available[idx]));
        available.splice(idx, 1);
    }
    return result;
}

function getRandomTarot() {
    const def = TAROT_DEFS[Math.floor(Math.random() * TAROT_DEFS.length)];
    return { ...def, type: 'tarot' };
}

function getRandomPlanet() {
    const def = PLANET_DEFS[Math.floor(Math.random() * PLANET_DEFS.length)];
    return { ...def, type: 'planet' };
}
