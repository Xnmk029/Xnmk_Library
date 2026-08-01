/**
 * Balatro 小丑牌 - 入口文件
 */

document.addEventListener('DOMContentLoaded', () => {
    // 初始化动画系统
    getAnimSystem();

    // 初始化游戏
    const game = new Game();
    game.init();

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            game.playHand();
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            game.discardCards();
        }
        if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4' || e.key === '5') {
            const idx = parseInt(e.key) - 1;
            if (game.hand[idx] && !game.isPlaying) {
                game.toggleCard(game.hand[idx]);
            }
        }
    });

    // 手牌区悬停效果增强
    const handArea = document.getElementById('hand-area');
    handArea.addEventListener('mousemove', (e) => {
        const cards = handArea.querySelectorAll('.card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const dist = Math.abs(e.clientX - centerX);
            if (dist < 100 && !card.classList.contains('selected')) {
                const lift = Math.max(0, (100 - dist) / 100 * 8);
                const baseTransform = card.style.transform || '';
                if (!baseTransform.includes('translateY(-')) {
                    card.style.marginTop = `-${lift}px`;
                }
            } else if (!card.classList.contains('selected')) {
                card.style.marginTop = '0px';
            }
        });
    });

    handArea.addEventListener('mouseleave', () => {
        const cards = handArea.querySelectorAll('.card:not(.selected)');
        cards.forEach(card => {
            card.style.marginTop = '0px';
        });
    });

    console.log('%c🃏 Balatro 小丑牌', 'font-size: 24px; font-weight: bold; color: #f39c12;');
    console.log('%c按 Enter 出牌 | Backspace 弃牌 | 1-5 选牌', 'color: #aaa;');
});
