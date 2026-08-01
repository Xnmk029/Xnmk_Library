/**
 * Balatro 小丑牌 - 商店系统
 */

class Shop {
    constructor(game) {
        this.game = game;
        this.items = [];
        this.rerollCost = 5;
    }

    open() {
        this.generateItems();
        this.render();
        document.getElementById('shop-overlay').classList.remove('hidden');
    }

    close() {
        document.getElementById('shop-overlay').classList.add('hidden');
    }

    generateItems() {
        this.items = [];
        // 2个小丑牌
        const jokers = getRandomJokers(2);
        for (const j of jokers) {
            this.items.push({
                type: 'joker',
                data: j,
                name: j.name,
                emoji: j.emoji,
                desc: j.desc,
                price: j.price,
                sold: false,
            });
        }
        // 1个塔罗牌或星球牌
        if (Math.random() > 0.5) {
            const tarot = getRandomTarot();
            this.items.push({
                type: 'tarot',
                data: tarot,
                name: tarot.name,
                emoji: tarot.emoji,
                desc: tarot.desc,
                price: tarot.price,
                sold: false,
            });
        } else {
            const planet = getRandomPlanet();
            this.items.push({
                type: 'planet',
                data: planet,
                name: planet.name,
                emoji: planet.emoji,
                desc: planet.desc,
                price: planet.price,
                sold: false,
            });
        }
        // 额外一个随机物品
        if (Math.random() > 0.4) {
            const joker = getRandomJokers(1)[0];
            this.items.push({
                type: 'joker',
                data: joker,
                name: joker.name,
                emoji: joker.emoji,
                desc: joker.desc,
                price: joker.price,
                sold: false,
            });
        }
    }

    render() {
        const container = document.getElementById('shop-items');
        container.innerHTML = '';

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const el = document.createElement('div');
            el.className = `shop-item ${item.sold ? 'sold' : ''}`;
            el.innerHTML = `
                <span class="item-emoji">${item.emoji}</span>
                <span class="item-name">${item.name}</span>
                <span class="item-desc">${item.desc}</span>
                <span class="item-price">$${item.price}</span>
            `;
            if (!item.sold) {
                el.addEventListener('click', () => this.buyItem(i));
            }
            container.appendChild(el);
        }

        // 更新刷新按钮
        document.getElementById('btn-reroll').textContent = `刷新 ($${this.rerollCost})`;
    }

    buyItem(index) {
        const item = this.items[index];
        if (item.sold || this.game.money < item.price) return;

        this.game.money -= item.price;
        item.sold = true;

        if (item.type === 'joker') {
            this.game.addJoker(item.data);
        } else if (item.type === 'planet') {
            this.game.evaluator.levelUp(item.data.hand);
        }
        // 塔罗牌效果简化处理

        this.game.updateUI();
        this.render();
        getAnimSystem().emitParticles(
            window.innerWidth / 2, window.innerHeight / 2, 15, '#27ae60'
        );
    }

    reroll() {
        if (this.game.money < this.rerollCost) return;
        this.game.money -= this.rerollCost;
        this.rerollCost++;
        this.generateItems();
        this.game.updateUI();
        this.render();
    }

    nextRound() {
        this.close();
        this.rerollCost = 5;
        this.game.nextBlind();
    }
}
