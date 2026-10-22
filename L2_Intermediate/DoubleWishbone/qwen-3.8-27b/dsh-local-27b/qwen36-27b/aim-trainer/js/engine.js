// ============ AIM FORGE 渲染引擎 (Canvas 2D) ============
// 负责画布、背景网格、小球碰撞物理、准星绘制与命中反馈。
(function (global) {
    'use strict';

    const TWO_PI = Math.PI * 2;

    class AimEngine {
        constructor(canvas, overlay) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.overlay = overlay;
            this.W = 0;
            this.H = 0;

            // 参数（由 app 注入）
            this.targetSize = 48;
            this.ballModel = true;
            this.colorTargets = false;
            this.hitFx = true;
            this.dynamicCrosshair = true;

            // 状态
            this.crossX = 0;   // 准星逻辑位置（0..1）
            this.crossY = 0;
            this.aimSens = 1.0;   // 有效灵敏度
            this.fov = 103;

            // 小球
            this.balls = [];
            this.spawnType = 'grid';

            // 视觉
            this.particles = [];
            this.flashUntil = 0;   // 命中闪光结束时间
            this.hitRipple = [];
            this.ghost = null;     // 命中瞬间的残影球

            this.running = false;
            this._raf = null;
            this._last = 0;
            this._time = 0;

            this._resize();
            window.addEventListener('resize', () => this._resize());
        }

        _resize() {
            const r = this.canvas.getBoundingClientRect();
            this.W = this.canvas.width = window.innerWidth;
            this.H = this.canvas.height = window.innerHeight;
        }

        reset() {
            this.balls = [];
            this.particles = [];
            this.hitRipple = [];
            this.ghost = null;
            this.flashUntil = 0;
            this._time = 0;
        }

        begin() {
            if (this._raf) return;
            this._last = performance.now();
            this.running = true;
            this._loop(this._last);
        }

        stop() {
            this.running = false;
            if (this._raf) cancelAnimationFrame(this._raf);
            this._raf = null;
        }

        // 目标生成（由 app 调用，遵循模式）
        spawnBall() {
            const t = this._pickSpawnPoint();
            const b = {
                x: t.x, y: t.y,
                homeX: t.x, homeY: t.y,
                r: this.targetSize,
                vx: 0, vy: 0,
                born: this._time,
                expired: false,
                color: this._pickColor(),
                phase: Math.random() * TWO_PI,
                wob: Math.random() * 10,
                moving: false,
                targetVX: 0, targetVY: 0,
            };
            this.balls.push(b);
            this._ensureOne();
            return b;
        }

        _ensureOne() {
            // 追踪/小微动 模式保证至少一个活跃小球
            if (this.spawnType === 'track' || this.spawnType === 'sw') {
                const alive = this.balls.filter((b) => !b.expired);
                if (alive.length === 0 && this.balls.length < 200) {
                    // 已经由 spawnBall 生成过
                }
            }
        }

        _pickColor() {
            if (!this.colorTargets) return '#8fd3ff';
            const palette = ['#ff5c5c', '#ffd257', '#4ee06a', '#5ca8ff', '#c684ff'];
            return palette[(Math.random() * palette.length) | 0];
        }

        _pickSpawnPoint() {
            const m = this.spawnType;
            const w = this.W, h = this.H;
            const pad = 120;
            if (m === 'grid') {
                // 从近些区域随机
                return { x: pad + Math.random() * (w - pad * 2), y: pad + Math.random() * (h - pad * 2) };
            }
            if (m === 'track') {
                return { x: w * 0.5, y: h * 0.3 + Math.random() * h * 0.3 };
            }
            return { x: pad + Math.random() * (w - pad * 2), y: pad + Math.random() * (h - pad * 2) };
        }

        _pickVel() {
            const s = this.W / 1200;
            const base = (40 + Math.random() * 90) * s;
            const ang = Math.random() * TWO_PI;
            return { x: Math.cos(ang) * base, y: Math.sin(ang) * base };
        }

        // 命中判定：检查点 (mx,my) 是否落在球内
        hitTest(mx, my) {
            for (let i = this.balls.length - 1; i >= 0; i--) {
                const b = this.balls[i];
                if (b.expired) continue;
                const dx = mx - b.x, dy = my - b.y;
                const rr = b.r * b.r;
                if (dx * dx + dy * dy <= rr) {
                    return b;
                }
            }
            return null;
        }

        // 小球被命中：物理反应 + 记录残影与粒子
        kill(ball) {
            ball.expired = true;
            this.ghost = { x: ball.x, y: ball.y, r: ball.r, color: ball.color, age: 0 };

            // 命中冲击粒子
            if (this.hitFx) {
                const n = 14;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * TWO_PI + Math.random() * 0.4;
                    const sp = 120 + Math.random() * 220;
                    this.particles.push({
                        x: ball.x, y: ball.y,
                        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                        life: 0.45 + Math.random() * 0.3,
                        r: 2 + Math.random() * 3.5,
                        color: ball.color,
                    });
                }
            }
            this.flashUntil = this._time + 0.08;
            this.hitRipple.push({ x: ball.x, y: ball.y, r: ball.r, age: 0, life: 0.4 });

            // 移除
            const idx = this.balls.indexOf(ball);
            if (idx >= 0) this.balls.splice(idx, 1);
        }

        // 更新小球状态（含追踪漂移与小微动）
        _updateBalls(dt) {
            const m = this.spawnType;
            for (const b of this.balls) {
                if (b.expired) continue;
                b.phase += dt * 3;

                if (m === 'track') {
                    // 平滑漂移跟枪
                    if (!b.moving || Math.random() < 0.01) {
                        const v = this._pickVel();
                        b.targetVX = v.x; b.targetVY = v.y;
                        b.moving = true;
                    }
                    b.vx += (b.targetVX - b.vx) * Math.min(1, dt * 2.2);
                    b.vy += (b.targetVY - b.vy) * Math.min(1, dt * 2.2);
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                } else if (m === 'sw') {
                    // 高频小幅震动
                    const amp = b.r * 1.6;
                    b.wob += dt * 8;
                    b.x = b.homeX + Math.sin(b.wob + b.phase) * amp;
                    b.y = b.homeY + Math.cos(b.wob * 1.3) * amp * 0.8;
                } else if (m === 'flick') {
                    // 随机瞬移（短距急停感），由 app 定时调用
                } else if (m === 'zen') {
                    // 静止
                }

                // 边界反弹（对所有模式防御）
                if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
                if (b.x > this.W - b.r) { b.x = this.W - b.r; b.vx = -Math.abs(b.vx); }
                if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
                if (b.y > this.H - b.r) { b.y = this.H - b.r; b.vy = -Math.abs(b.vy); }
            }
        }

        // 主循环
        _loop(now) {
            if (!this.running) return;
            let dt = (now - this._last) / 1000;
            this._last = now;
            dt = Math.min(dt, 0.05);
            this._time += dt;

            this._updateBalls(dt);
            this._updateParticles(dt);
            this._draw();
            this._raf = requestAnimationFrame((n) => this._loop(n));
        }

        _updateParticles(dt) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.life -= dt;
                if (p.life <= 0) { this.particles.splice(i, 1); continue; }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= (1 - dt * 2);
                p.vy *= (1 - dt * 2);
            }
            for (let i = this.hitRipple.length - 1; i >= 0; i--) {
                const r = this.hitRipple[i];
                r.age += dt;
                if (r.age > r.life) { this.hitRipple.splice(i, 1); }
            }
            if (this.ghost) {
                this.ghost.age += dt;
                if (this.ghost.age > 0.35) this.ghost = null;
            }
        }

        // ============ 绘制 ============
        _draw() {
            const c = this.ctx;
            c.clearRect(0, 0, this.W, this.H);

            // 背景渐变
            const grad = c.createRadialGradient(this.W / 2, this.H / 2, 50, this.W / 2, this.H / 2, this.W * 0.7);
            grad.addColorStop(0, '#141b2a');
            grad.addColorStop(1, '#0b0f18');
            c.fillStyle = grad;
            c.fillRect(0, 0, this.W, this.H);

            // 网格
            c.strokeStyle = 'rgba(90,120,180,0.10)';
            c.lineWidth = 1;
            const gs = 64;
            c.beginPath();
            for (let x = 0; x < this.W; x += gs) { c.moveTo(x, 0); c.lineTo(x, this.H); }
            for (let y = 0; y < this.H; y += gs) { c.moveTo(0, y); c.lineTo(this.W, y); }
            c.stroke();

            // 命中波动涟漪
            for (const r of this.hitRipple) {
                const p = r.age / r.life;
                c.strokeStyle = `rgba(126,180,255,${0.6 * (1 - p)})`;
                c.lineWidth = 3;
                c.beginPath();
                c.arc(r.x, r.y, r.r + p * r.r * 3, 0, TWO_PI);
                c.stroke();
            }

            // 残影
            if (this.ghost) {
                const g = this.ghost;
                const a = 1 - g.age / 0.35;
                c.globalAlpha = a * 0.5;
                c.fillStyle = g.color;
                c.beginPath();
                c.arc(g.x, g.y, g.r * (1 + g.age * 0.5), 0, TWO_PI);
                c.fill();
                c.globalAlpha = 1;
            }

            // 小球
            for (const b of this.balls) {
                if (b.expired) continue;
                // 球体阴影
                c.fillStyle = 'rgba(0,0,0,0.35)';
                c.beginPath();
                c.arc(b.x + 3, b.y + 5, b.r, 0, TWO_PI);
                c.fill();

                // 球体（径向渐变，模拟小球模型）
                const g2 = c.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
                g2.addColorStop(0, '#cfe9ff');
                g2.addColorStop(0.2, b.color);
                g2.addColorStop(0.85, this._shade(b.color, -0.25));
                g2.addColorStop(1, this._shade(b.color, -0.5));
                c.fillStyle = g2;
                c.beginPath();
                c.arc(b.x, b.y, b.r, 0, TWO_PI);
                c.fill();

                // 高光
                c.fillStyle = 'rgba(255,255,255,0.5)';
                c.beginPath();
                c.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, TWO_PI);
                c.fill();

                // 外环
                c.strokeStyle = 'rgba(255,255,255,0.08)';
                c.lineWidth = 2;
                c.beginPath();
                c.arc(b.x, b.y, b.r + 4, 0, TWO_PI);
                c.stroke();
            }

            // 命中闪光
            if (this._time < this.flashUntil) {
                const a = (this.flashUntil - this._time) / 0.08;
                c.fillStyle = `rgba(220,240,255,${a * 0.10})`;
                c.fillRect(0, 0, this.W, this.H);
            }

            // 粒子
            for (const p of this.particles) {
                c.globalAlpha = Math.max(0, p.life / 0.6);
                c.fillStyle = p.color;
                c.beginPath();
                c.arc(p.x, p.y, p.r, 0, TWO_PI);
                c.fill();
                c.globalAlpha = 1;
            }

            // 准星
            this._drawCross();
        }

        _drawCross() {
            const c = this.ctx;
            const x = this.crossX, y = this.crossY;
            const len = this.dynamicCrosshair ? 12 + (this._recoil || 0) * 40 : 12;
            const gap = this.dynamicCrosshair ? 4 + (this._recoil || 0) * 20 : 4;
            const col = 'rgba(120,255,170,0.9)';

            c.strokeStyle = col;
            c.lineWidth = 2;
            c.lineCap = 'round';
            c.beginPath();
            // 四向
            c.moveTo(x - gap - len, y); c.lineTo(x - gap, y);
            c.moveTo(x + gap, y);       c.lineTo(x + gap + len, y);
            c.moveTo(x, y - gap - len); c.lineTo(x, y - gap);
            c.moveTo(x, y + gap);       c.lineTo(x, y + gap + len);
            c.stroke();

            // 中心点
            c.fillStyle = col;
            c.beginPath();
            c.arc(x, y, 1.6, 0, TWO_PI);
            c.fill();
        }

        _shade(hex, amt) {
            const n = parseInt(hex.slice(1), 16);
            let r = (n >> 16) + amt * 255;
            let g = ((n >> 8) & 0xff) + amt * 255;
            let b = (n & 0xff) + amt * 255;
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));
            return `rgb(${r | 0},${g | 0},${b | 0})`;
        }

        // 显示鼠标（用于把真实光标映射到逻辑准星）
        setPointer(rx, ry) {
            // rx,ry 为像素坐标；仅更新状态
            this.crossX = rx / this.W;
            this.crossY = ry / this.H;
        }
    }

    global.AimEngine = AimEngine;
})(window);