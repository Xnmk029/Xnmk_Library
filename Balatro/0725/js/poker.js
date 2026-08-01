/**
 * Balatro 小丑牌 - 牌型判定与计分系统
 */

const HAND_TYPES = {
    'high_card': { name: '高牌', chips: 5, mult: 1, level: 1 },
    'pair': { name: '对子', chips: 10, mult: 2, level: 1 },
    'two_pair': { name: '两对', chips: 20, mult: 2, level: 1 },
    'three_of_kind': { name: '三条', chips: 30, mult: 3, level: 1 },
    'straight': { name: '顺子', chips: 30, mult: 4, level: 1 },
    'flush': { name: '同花', chips: 35, mult: 4, level: 1 },
    'full_house': { name: '葫芦', chips: 40, mult: 4, level: 1 },
    'four_of_kind': { name: '四条', chips: 60, mult: 7, level: 1 },
    'straight_flush': { name: '同花顺', chips: 100, mult: 8, level: 1 },
    'royal_flush': { name: '皇家同花顺', chips: 100, mult: 8, level: 1 },
    'five_of_kind': { name: '五条', chips: 120, mult: 12, level: 1 },
    'flush_house': { name: '同花葫芦', chips: 140, mult: 14, level: 1 },
    'flush_five': { name: '同花五条', chips: 160, mult: 16, level: 1 },
};

// 每级升级加成
const LEVEL_UP_CHIPS = {
    'high_card': 10, 'pair': 15, 'two_pair': 20, 'three_of_kind': 20,
    'straight': 30, 'flush': 15, 'full_house': 25, 'four_of_kind': 30,
    'straight_flush': 40, 'royal_flush': 40, 'five_of_kind': 35,
    'flush_house': 40, 'flush_five': 50,
};
const LEVEL_UP_MULT = {
    'high_card': 1, 'pair': 1, 'two_pair': 1, 'three_of_kind': 1,
    'straight': 1, 'flush': 1, 'full_house': 1, 'four_of_kind': 1,
    'straight_flush': 1, 'royal_flush': 1, 'five_of_kind': 1,
    'flush_house': 1, 'flush_five': 1,
};

class PokerEvaluator {
    constructor() {
        this.handLevels = {};
        for (const key in HAND_TYPES) {
            this.handLevels[key] = { level: 1, played: 0 };
        }
    }

    getHandInfo(type) {
        const base = HAND_TYPES[type];
        const lvl = this.handLevels[type].level;
        return {
            name: base.name,
            chips: base.chips + (lvl - 1) * LEVEL_UP_CHIPS[type],
            mult: base.mult + (lvl - 1) * LEVEL_UP_MULT[type],
            level: lvl,
        };
    }

    levelUp(type) {
        if (this.handLevels[type]) {
            this.handLevels[type].level++;
        }
    }

    /**
     * 评估一手牌（最多5张）
     * 返回 { type, scoringCards, name }
     */
    evaluate(cards) {
        if (!cards || cards.length === 0) return null;

        const sorted = [...cards].sort((a, b) => b.sortRank - a.sortRank);
        const ranks = sorted.map(c => c.sortRank);
        const suits = sorted.map(c => c.suit);

        // 统计
        const rankCount = {};
        const suitCount = {};
        for (const c of sorted) {
            rankCount[c.sortRank] = (rankCount[c.sortRank] || 0) + 1;
            suitCount[c.suit] = (suitCount[c.suit] || 0) + 1;
        }

        const counts = Object.values(rankCount).sort((a, b) => b - a);
        const isFlush = cards.length === 5 && Object.values(suitCount).some(v => v === 5);
        const isStraight = this.checkStraight(ranks);

        // 判定牌型
        let type = 'high_card';
        let scoringCards = [sorted[0]]; // 默认高牌

        if (cards.length === 5) {
            if (counts[0] === 5) {
                type = isFlush ? 'flush_five' : 'five_of_kind';
                scoringCards = sorted;
            } else if (counts[0] === 4) {
                type = 'four_of_kind';
                scoringCards = sorted.filter(c => rankCount[c.sortRank] === 4);
            } else if (counts[0] === 3 && counts[1] === 2) {
                type = isFlush ? 'flush_house' : 'full_house';
                scoringCards = sorted;
            } else if (isFlush && isStraight) {
                // 检查皇家同花顺
                const isRoyal = ranks.includes(14) && ranks.includes(13) && ranks.includes(12) && ranks.includes(11) && ranks.includes(10);
                type = isRoyal ? 'royal_flush' : 'straight_flush';
                scoringCards = sorted;
            } else if (isFlush) {
                type = 'flush';
                scoringCards = sorted;
            } else if (isStraight) {
                type = 'straight';
                scoringCards = sorted;
            } else if (counts[0] === 3) {
                type = 'three_of_kind';
                scoringCards = sorted.filter(c => rankCount[c.sortRank] === 3);
            } else if (counts[0] === 2 && counts[1] === 2) {
                type = 'two_pair';
                scoringCards = sorted.filter(c => rankCount[c.sortRank] === 2);
            } else if (counts[0] === 2) {
                type = 'pair';
                scoringCards = sorted.filter(c => rankCount[c.sortRank] === 2);
            }
        } else {
            // 少于5张
            if (counts[0] >= 4) {
                type = 'four_of_kind';
                scoringCards = sorted.filter(c => rankCount[c.sortRank] >= 4);
            } else if (counts[0] === 3) {
                type = 'three_of_kind';
                scoringCards = sorted.filter(c => rankCount[c.sortRank] === 3);
            } else if (counts[0] === 2 && counts[1] === 2) {
                type = 'two_pair';
                scoringCards = sorted.filter(c => rankCount[c.sortRank] === 2);
            } else if (counts[0] === 2) {
                type = 'pair';
                scoringCards = sorted.filter(c => rankCount[c.sortRank] === 2);
            }
        }

        const info = this.getHandInfo(type);
        this.handLevels[type].played++;

        return {
            type,
            name: info.name,
            baseChips: info.chips,
            baseMult: info.mult,
            level: info.level,
            scoringCards,
            allCards: sorted,
        };
    }

    checkStraight(ranks) {
        if (ranks.length !== 5) return false;
        const unique = [...new Set(ranks)].sort((a, b) => b - a);
        if (unique.length !== 5) return false;
        // 正常顺子
        if (unique[0] - unique[4] === 4) return true;
        // A-2-3-4-5 (轮子)
        if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) return true;
        return false;
    }

    /**
     * 计算得分
     */
    calculateScore(evalResult, jokers = []) {
        let chips = evalResult.baseChips;
        let mult = evalResult.baseMult;
        const events = []; // 记录计分事件用于动画

        // 逐张计分卡牌
        for (const card of evalResult.scoringCards) {
            chips += card.chipValue;
            events.push({ type: 'card_score', card, chips: card.chipValue });
        }

        // 小丑牌效果
        for (const joker of jokers) {
            const effect = joker.calculate(evalResult, chips, mult);
            if (effect.chips) {
                chips += effect.chips;
                events.push({ type: 'joker_chips', joker, value: effect.chips });
            }
            if (effect.mult) {
                mult += effect.mult;
                events.push({ type: 'joker_mult', joker, value: effect.mult });
            }
            if (effect.xmult) {
                mult *= effect.xmult;
                events.push({ type: 'joker_xmult', joker, value: effect.xmult });
            }
        }

        return {
            chips,
            mult,
            total: Math.floor(chips * mult),
            events,
        };
    }
}
