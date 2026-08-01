/**
 * Balatro 小丑牌 - 动效系统
 * 粒子特效、屏幕震动、得分动画、背景效果
 */

class AnimationSystem {
    constructor() {
        this.bgCanvas = document.getElementById('bg-canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.fxCanvas = document.getElementById('fx-canvas');
        this.fxCtx = this.fxCanvas.getContext('2d');
        this.particles = [];
        this.bgParticles = [];
        this.animating = false;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initBgParticles();
        this.startBgLoop();
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.bgCanvas.width = w;
        this.bgCanvas.height = h;
        this.fxCanvas.width = w;
        this.fxCanvas.height = h;
    }

    // === 背景粒子 ===
    initBgParticles() {
        this.bgParticles = [];
        for (let i = 0; i < 50; i++) {
            this.bgParticles.push({
                x: Math.random() * this.bgCanvas.width,
                y: Math.random() * this.bgCanvas.height,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.3 + 0.1,
                hue: Math.random() * 60 + 200, // 蓝紫色调
            });
        }
    }

    startBgLoop() {
        const loop = () => {
            this.drawBg();
            requestAnimationFrame(loop);
        };
        loop();
    }

    drawBg() {
        const ctx = this.bgCtx;
        const w = this.bgCanvas.width;
        const h = this.bgCanvas.height;
        ctx.clearRect(0, 0, w, h);

        for (const p of this.bgParticles) {
            p.x += p.speedX;
            p.y += p.speedY;
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${p.opacity})`;
            ctx.fill();
        }
    }

    // === 粒子爆发效果 ===
    emitParticles(x, y, count = 20, color = '#f39c12') {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = Math.random() * 4 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                life: 1,
                decay: Math.random() * 0.02 + 0.015,
                size: Math.random() * 5 + 2,
                color,
            });
        }
        if (!this.animating) {
            this.animating = true;
            this.fxLoop();
        }
    }

    // 筹码粒子（蓝色）
    emitChips(x, y, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
            const speed = Math.random() * 5 + 3;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: Math.random() * 0.02 + 0.01,
                size: Math.random() * 6 + 3,
                color: `hsl(${210 + Math.random() * 20}, 80%, ${55 + Math.random() * 15}%)`,
                shape: 'circle',
            });
        }
        if (!this.animating) {
            this.animating = true;
            this.fxLoop();
        }
    }

    // 倍率粒子（红色）
    emitMult(x, y, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
            const speed = Math.random() * 5 + 3;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: Math.random() * 0.02 + 0.01,
                size: Math.random() * 6 + 3,
                color: `hsl(${0 + Math.random() * 15}, 80%, ${50 + Math.random() * 15}%)`,
                shape: 'diamond',
            });
        }
        if (!this.animating) {
            this.animating = true;
            this.fxLoop();
        }
    }

    // 大型庆祝粒子
    emitCelebration() {
        const w = this.fxCanvas.width;
        const colors = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
        for (let i = 0; i < 80; i++) {
            const x = Math.random() * w;
            const y = this.fxCanvas.height + 10;
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: -(Math.random() * 10 + 5),
                life: 1,
                decay: Math.random() * 0.008 + 0.005,
                size: Math.random() * 8 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                gravity: 0.15,
            });
        }
        if (!this.animating) {
            this.animating = true;
            this.fxLoop();
        }
    }

    fxLoop() {
        const ctx = this.fxCtx;
        ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);

        this.particles = this.particles.filter(p => p.life > 0);

        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.gravity) p.vy += p.gravity;
            p.life -= p.decay;
            p.vx *= 0.98;

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;

            if (p.shape === 'diamond') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(Math.PI / 4);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1;

        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.fxLoop());
        } else {
            this.animating = false;
        }
    }

    // === 屏幕震动 ===
    screenShake(intensity = 1) {
        const container = document.getElementById('game-container');
        container.classList.remove('screen-shake');
        void container.offsetWidth; // reflow
        container.style.setProperty('--shake-intensity', intensity);
        container.classList.add('screen-shake');
        setTimeout(() => container.classList.remove('screen-shake'), 400);
    }

    // === 得分弹出文字 ===
    showScorePopup(x, y, text, color = '#f39c12') {
        const layer = document.getElementById('scoring-fx-layer');
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = text;
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        popup.style.color = color;
        layer.appendChild(popup);
        setTimeout(() => popup.remove(), 1000);
    }

    // === 数字滚动动画 ===
    animateNumber(element, from, to, duration = 500, prefix = '', suffix = '') {
        const start = performance.now();
        const diff = to - from;

        const update = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + diff * eased);
            element.textContent = prefix + current.toLocaleString() + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        requestAnimationFrame(update);
    }

    // === 卡牌计分高亮 ===
    highlightCard(cardEl) {
        return new Promise(resolve => {
            cardEl.classList.add('scoring');
            const rect = cardEl.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            this.emitChips(cx, cy, 6);
            setTimeout(() => {
                cardEl.classList.remove('scoring');
                resolve();
            }, 500);
        });
    }

    // === 小丑牌触发效果 ===
    triggerJoker(jokerEl) {
        return new Promise(resolve => {
            if (!jokerEl) { resolve(); return; }
            jokerEl.style.transform = 'translateY(-8px) scale(1.2)';
            jokerEl.style.boxShadow = '0 0 20px rgba(243, 156, 18, 0.6)';
            const rect = jokerEl.getBoundingClientRect();
            this.emitParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 10, '#f39c12');
            setTimeout(() => {
                jokerEl.style.transform = '';
                jokerEl.style.boxShadow = '';
                resolve();
            }, 400);
        });
    }

    // === 胜利闪光 ===
    winFlash() {
        const container = document.getElementById('game-container');
        container.classList.add('win-flash');
        this.emitCelebration();
        this.screenShake(2);
        setTimeout(() => container.classList.remove('win-flash'), 600);
    }

    // === 得分框跳动 ===
    bumpScore(type) {
        const el = document.getElementById(type === 'chip' ? 'chip-display' : type === 'mult' ? 'mult-display' : 'total-score-box');
        if (el) {
            el.classList.remove('bump');
            void el.offsetWidth;
            el.classList.add('bump');
        }
    }
}

// 全局动画系统实例
let animSystem = null;
function getAnimSystem() {
    if (!animSystem) animSystem = new AnimationSystem();
    return animSystem;
}
