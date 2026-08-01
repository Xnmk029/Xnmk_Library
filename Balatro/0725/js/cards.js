/**
 * Balatro 小丑牌 - 卡牌系统
 * 管理卡牌数据、创建、渲染
 */

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS = { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };
const RANK_CHIPS = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };
const RANK_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

let cardIdCounter = 0;

class Card {
    constructor(rank, suit) {
        this.id = ++cardIdCounter;
        this.rank = rank;
        this.suit = suit;
        this.selected = false;
        this.element = null;
        // 增强效果
        this.bonusChips = 0;
        this.bonusMult = 0;
        this.enhancement = null; // 'bonus', 'mult', 'wild', 'glass', 'steel', 'gold', 'lucky'
    }

    get color() { return SUIT_COLORS[this.suit]; }
    get symbol() { return SUIT_SYMBOLS[this.suit]; }
    get chipValue() { return RANK_CHIPS[this.rank] + this.bonusChips; }
    get sortRank() { return RANK_ORDER[this.rank]; }
    get sortSuit() { return SUITS.indexOf(this.suit); }

    createElement() {
        const el = document.createElement('div');
        el.className = `card ${this.color}`;
        el.dataset.cardId = this.id;
        el.innerHTML = `
            <div class="card-inner">
                <div class="card-top">
                    <span class="card-rank">${this.rank}</span>
                    <span class="card-suit-small">${this.symbol}</span>
                </div>
                <div class="card-center">${this.symbol}</div>
                <div class="card-bottom">
                    <span class="card-rank">${this.rank}</span>
                    <span class="card-suit-small">${this.symbol}</span>
                </div>
            </div>
        `;
        this.element = el;
        return el;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.drawPile = [];
        this.discardPile = [];
    }

    init() {
        this.cards = [];
        this.drawPile = [];
        this.discardPile = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new Card(rank, suit));
            }
        }
        this.shuffle();
    }

    shuffle() {
        this.drawPile = [...this.cards];
        // Fisher-Yates shuffle
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
        }
    }

    draw(count) {
        const drawn = [];
        for (let i = 0; i < count && this.drawPile.length > 0; i++) {
            drawn.push(this.drawPile.pop());
        }
        return drawn;
    }

    discard(cards) {
        this.discardPile.push(...cards);
    }

    get remaining() { return this.drawPile.length; }

    reshuffleDiscard() {
        this.drawPile = [...this.drawPile, ...this.discardPile];
        this.discardPile = [];
        // shuffle
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
        }
    }
}
