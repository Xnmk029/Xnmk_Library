/**
 * Balatro 小丑牌 - 核心游戏逻辑
 */

const BLINDS = [
    { name: '小盲注', type: 'small', mult: 1, reward: 3 },
    { name: '大盲注', type: 'big', mult: 1.5, reward: 4 },
    { name: 'Boss盲注', type: 'boss', mult: 2, reward: 5 },
];

const ANTE_BASE_SCORES = [300, 450, 600, 900, 1400, 2000, 3000, 5000];

class Game {
    constructor() {
        this.deck = new Deck();
        this.evaluator = new PokerEvaluator();
        this.shop = new Shop(this);

        // 游戏状态
        this.ante = 1;
        this.round = 1; // 1=小盲, 2=大盲, 3=Boss
        this.money = 4;
        this.roundScore = 0;
        this.targetScore = 300;
        this.handsLeft = 4;
        this.discardsLeft = 3;
        this.maxJokers = 5;

        // 手牌
        this.hand = [];
        this.selectedCards = [];
        this.jokers = [];
        this.isPlaying = false;

        // DOM
        this.handArea = document.getElementById('hand-area');
        this.playedArea = document.getElementById('played-cards-area');
        this.jokerSlots = document.getElementById('joker-slots');
    }

    init() {
        this.deck.init();
        this.startBlind();
        this.bindEvents();
        this.updateUI();
    }

    bindEvents() {
        document.getElementById('btn-play').addEventListener('click', () => this.playHand());
        document.getElementById('btn-discard').addEventListener('click', () => this.discardCards());
        document.getElementById('btn-sort-rank').addEventListener('click', () => this.sortHand('rank'));
        document.getElementById('btn-sort-suit').addEventListener('click', () => this.sortHand('suit'));
        document.getElementById('btn-reroll').addEventListener('click', () => this.shop.reroll());
        document.getElementById('btn-next-round').addEventListener('click', () => this.shop.nextRound());
        document.getElementById('btn-restart').addEventListener('click', () => this.restart());
    }

    get currentBlind() {
        return BLINDS[this.round - 1];
    }

    getTargetScore() {
        const base = ANTE_BASE_SCORES[Math.min(this.ante - 1, ANTE_BASE_SCORES.length - 1)];
        return Math.floor(base * this.currentBlind.mult);
    }

    startBlind() {
        this.targetScore = this.getTargetScore();
        this.roundScore = 0;
        this.handsLeft = 4;
        this.discardsLeft = 3;
        this.hand = [];
        this.selectedCards = [];
        this.isPlaying = false;

        // 重置牌组
        this.deck.init();

        // 发牌
        this.dealCards(8);
        this.updateUI();
        this.renderJokers();
    }

    dealCards(count, animate = true) {
        const drawn = this.deck.draw(count);
        for (const card of drawn) {
            this.hand.push(card);
        }
        this.renderHand(animate ? drawn.length : 0);
    }

    toggleCard(card) {
        if (this.isPlaying) return;
        if (card.selected) {
            card.selected = false;
            this.selectedCards = this.selectedCards.filter(c => c.id !== card.id);
            card.element.classList.remove('selected');
        } else {
            if (this.selectedCards.length >= 5) return;
            card.selected = true;
            this.selectedCards.push(card);
            card.element.classList.add('selected');
        }
        this.updateHandPreview();
    }

    updateHandPreview() {
        if (this.selectedCards.length > 0) {
            const result = this.evaluator.evaluate(this.selectedCards);
            if (result) {
                document.getElementById('hand-type-name').textContent = result.name;
                document.getElementById('hand-level').textContent = `Lv.${result.level}`;
                document.getElementById('chip-value').textContent = result.baseChips;
                document.getElementById('mult-value').textContent = `×${result.baseMult}`;
            }
        } else {
            document.getElementById('hand-type-name').textContent = '选择卡牌';
            document.getElementById('hand-level').textContent = '';
            document.getElementById('chip-value').textContent = '0';
            document.getElementById('mult-value').textContent = '×0';
        }
    }

    async playHand() {
        if (this.selectedCards.length === 0 || this.handsLeft <= 0 || this.isPlaying) return;
        this.isPlaying = true;

        const anim = getAnimSystem();
        const playedCards = [...this.selectedCards];

        // 从手牌移除
        for (const card of playedCards) {
            this.hand = this.hand.filter(c => c.id !== card.id);
            card.selected = false;
        }
        this.selectedCards = [];
        this.handsLeft--;

        // 动画：卡牌飞出到出牌区
        this.playedArea.innerHTML = '';
        for (let i = 0; i < playedCards.length; i++) {
            const card = playedCards[i];
            const el = card.createElement();
            el.classList.add('playing');
            el.style.animationDelay = `${i * 0.1}s`;
            this.playedArea.appendChild(el);
            card.element = el;
        }

        // 从手牌区移除已打出的牌
        this.renderHand();

        await this.delay(600);

        // 评估牌型
        const evalResult = this.evaluator.evaluate(playedCards);
        if (!evalResult) { this.isPlaying = false; return; }

        // 更新小丑牌动态属性
        this.updateJokerState();

        // 计算得分
        const score = this.evaluator.calculateScore(evalResult, this.jokers);

        // 显示牌型名
        document.getElementById('hand-type-name').textContent = evalResult.name;
        document.getElementById('hand-level').textContent = `Lv.${evalResult.level}`;

        // 逐张计分动画
        let currentChips = evalResult.baseChips;
        let currentMult = evalResult.baseMult;
        document.getElementById('chip-value').textContent = currentChips;
        document.getElementById('mult-value').textContent = `×${currentMult}`;

        await this.delay(300);

        // 卡牌逐个计分
        const cardEls = this.playedArea.querySelectorAll('.card');
        for (let i = 0; i < evalResult.scoringCards.length; i++) {
            const scoringCard = evalResult.scoringCards[i];
            const cardEl = cardEls[playedCards.indexOf(scoringCard)];
            if (cardEl) {
                await anim.highlightCard(cardEl);
                currentChips += scoringCard.chipValue;
                document.getElementById('chip-value').textContent = currentChips;
                anim.bumpScore('chip');
                const rect = cardEl.getBoundingClientRect();
                anim.showScorePopup(rect.left + rect.width / 2, rect.top, `+${scoringCard.chipValue}`, '#4a9eff');
                await this.delay(150);
            }
        }

        // 小丑牌效果动画
        for (const event of score.events) {
            if (event.type === 'joker_chips' || event.type === 'joker_mult' || event.type === 'joker_xmult') {
                const jokerIdx = this.jokers.indexOf(event.joker);
                const jokerEl = this.jokerSlots.children[jokerIdx];
                await anim.triggerJoker(jokerEl);

                if (event.type === 'joker_chips') {
                    currentChips += event.value;
                    document.getElementById('chip-value').textContent = currentChips;
                    anim.bumpScore('chip');
                } else if (event.type === 'joker_mult') {
                    currentMult += event.value;
                    document.getElementById('mult-value').textContent = `×${currentMult}`;
                    anim.bumpScore('mult');
                } else if (event.type === 'joker_xmult') {
                    currentMult = Math.round(currentMult * event.value);
                    document.getElementById('mult-value').textContent = `×${currentMult}`;
                    anim.bumpScore('mult');
                    anim.screenShake(1);
                }
                await this.delay(200);
            }
        }

        // 计算总分
        const totalScore = Math.floor(currentChips * currentMult);
        document.getElementById('total-score').textContent = totalScore.toLocaleString();
        anim.bumpScore('total');

        // 大分数震动
        if (totalScore > 100) {
            anim.screenShake(Math.min(totalScore / 200, 3));
        }
        if (totalScore > 500) {
            anim.emitCelebration();
        }

        // 更新回合分数
        this.roundScore += totalScore;
        anim.animateNumber(
            document.getElementById('round-score-value'),
            this.roundScore - totalScore,
            this.roundScore,
            600
        );

        await this.delay(800);

        // 检查是否胜利
        if (this.roundScore >= this.targetScore) {
            await this.winRound();
            return;
        }

        // 检查是否还有出牌次数
        if (this.handsLeft <= 0) {
            this.gameOver();
            return;
        }

        // 补牌
        this.playedArea.innerHTML = '';
        const drawCount = Math.min(playedCards.length, this.deck.remaining);
        if (drawCount > 0) {
            this.dealCards(drawCount);
        } else if (this.deck.remaining === 0 && this.deck.discardPile.length > 0) {
            this.deck.reshuffleDiscard();
            this.dealCards(Math.min(playedCards.length, this.deck.remaining));
        }

        this.updateUI();
        this.isPlaying = false;
    }

    async discardCards() {
        if (this.selectedCards.length === 0 || this.discardsLeft <= 0 || this.isPlaying) return;
        this.isPlaying = true;

        const anim = getAnimSystem();
        const discarded = [...this.selectedCards];
        this.discardsLeft--;

        // 弃牌动画
        for (const card of discarded) {
            if (card.element) {
                card.element.classList.add('discarding');
            }
            this.hand = this.hand.filter(c => c.id !== card.id);
            card.selected = false;
        }
        this.selectedCards = [];

        // 更新绿色小丑
        for (const j of this.jokers) {
            if (j.id === 'green_joker' && j.currentMult > 0) {
                j.currentMult--;
            }
        }

        await this.delay(400);
        this.renderHand();

        // 弃牌放入弃牌堆
        this.deck.discard(discarded);

        // 补牌
        const drawCount = Math.min(discarded.length, this.deck.remaining);
        if (drawCount > 0) {
            this.dealCards(drawCount);
        } else if (this.deck.remaining === 0 && this.deck.discardPile.length > 0) {
            this.deck.reshuffleDiscard();
            this.dealCards(Math.min(discarded.length, this.deck.remaining));
        }

        this.updateUI();
        this.updateHandPreview();
        this.isPlaying = false;
    }

    async winRound() {
        const anim = getAnimSystem();
        anim.winFlash();

        // 计算奖励金
        const blindReward = this.currentBlind.reward;
        const handBonus = this.handsLeft; // 每剩余一次出牌+$1
        const interest = Math.min(Math.floor(this.money / 5), 5); // 利息
        const totalReward = blindReward + handBonus + interest;

        this.money += totalReward;

        await this.delay(1000);

        // 打开商店
        this.updateUI();
        this.shop.open();
    }

    nextBlind() {
        this.round++;
        if (this.round > 3) {
            this.round = 1;
            this.ante++;
            if (this.ante > 8) {
                this.gameWin();
                return;
            }
        }
        this.startBlind();
    }

    gameOver() {
        document.getElementById('gameover-title').textContent = '游戏结束';
        document.getElementById('gameover-title').style.color = '#e74c3c';
        document.getElementById('gameover-info').textContent =
            `你在底注 ${this.ante} 的${this.currentBlind.name}中倒下了。最终得分: ${this.roundScore}/${this.targetScore}`;
        document.getElementById('gameover-overlay').classList.remove('hidden');
    }

    gameWin() {
        document.getElementById('gameover-title').textContent = '🎉 恭喜通关！';
        document.getElementById('gameover-title').style.color = '#f39c12';
        document.getElementById('gameover-info').textContent =
            `你成功通过了所有8个底注！最终资金: $${this.money}`;
        document.getElementById('gameover-overlay').classList.remove('hidden');
        getAnimSystem().emitCelebration();
    }

    restart() {
        document.getElementById('gameover-overlay').classList.add('hidden');
        this.ante = 1;
        this.round = 1;
        this.money = 4;
        this.jokers = [];
        this.evaluator = new PokerEvaluator();
        this.handArea.innerHTML = '';
        this.playedArea.innerHTML = '';
        this.jokerSlots.innerHTML = '';
        this.startBlind();
    }

    // === 排序 ===
    sortHand(mode) {
        if (mode === 'rank') {
            this.hand.sort((a, b) => b.sortRank - a.sortRank || a.sortSuit - b.sortSuit);
        } else {
            this.hand.sort((a, b) => a.sortSuit - b.sortSuit || b.sortRank - a.sortRank);
        }
        this.renderHand();
    }

    // === 渲染 ===
    renderHand(dealAnimCount = 0) {
        this.handArea.innerHTML = '';
        const total = this.hand.length;
        for (let i = 0; i < total; i++) {
            const card = this.hand[i];
            const el = card.createElement();
            el.addEventListener('click', () => this.toggleCard(card));
            if (card.selected) el.classList.add('selected');

            // 发牌动画（最后N张）
            if (dealAnimCount > 0 && i >= total - dealAnimCount) {
                el.classList.add('dealing');
                el.style.animationDelay = `${(i - (total - dealAnimCount)) * 0.08}s`;
            }

            // 扇形效果
            const mid = (total - 1) / 2;
            const offset = i - mid;
            const rotation = offset * 2;
            const yOffset = Math.abs(offset) * 3;
            el.style.transform = `rotate(${rotation}deg) translateY(${yOffset}px)`;
            el.style.zIndex = i;

            this.handArea.appendChild(el);
        }
    }

    renderJokers() {
        this.jokerSlots.innerHTML = '';
        for (const joker of this.jokers) {
            this.jokerSlots.appendChild(joker.createElement());
        }
    }

    addJoker(joker) {
        if (this.jokers.length >= this.maxJokers) return;
        this.jokers.push(joker);
        this.renderJokers();
    }

    updateJokerState() {
        for (const j of this.jokers) {
            if (j.id === 'banner') j.discardsLeft = this.discardsLeft;
            if (j.id === 'mystic_summit') j.discardsLeft = this.discardsLeft;
            if (j.id === 'bull') j.money = this.money;
            if (j.id === 'blue_joker') j.deckRemaining = this.deck.remaining;
            if (j.id === 'abstract_joker') j.jokerCount = this.jokers.length;
            if (j.id === 'green_joker') j.currentMult = (j.currentMult || 0) + 1;
            if (j.id === 'blackboard') {
                j.allBlack = this.hand.every(c => c.suit === 'spades' || c.suit === 'clubs');
            }
        }
    }

    updateUI() {
        document.getElementById('ante-num').textContent = this.ante;
        document.getElementById('round-num').textContent = this.round;
        document.getElementById('money-value').textContent = this.money;
        document.getElementById('target-score').textContent = this.targetScore.toLocaleString();
        document.getElementById('round-target').textContent = this.targetScore.toLocaleString();
        document.getElementById('round-score-value').textContent = this.roundScore.toLocaleString();
        document.getElementById('hands-left').textContent = this.handsLeft;
        document.getElementById('discards-left').textContent = this.discardsLeft;
        document.getElementById('total-score').textContent = '0';

        // 盲注徽章
        const badge = document.getElementById('blind-badge');
        badge.className = `blind-${this.currentBlind.type}`;
        document.getElementById('blind-name').textContent = this.currentBlind.name;

        // 按钮状态
        document.getElementById('btn-play').disabled = this.handsLeft <= 0;
        document.getElementById('btn-discard').disabled = this.discardsLeft <= 0;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
