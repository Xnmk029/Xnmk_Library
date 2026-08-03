/* 动效系统 —— 卡牌浮动/倾斜/弹出数字/震屏，原创实现 */
const FX = (function () {
  const popups = document.getElementById('popups');

  /* ---------- 全局卡牌"呼吸浮动" ---------- */
  const floaters = new Set();
  function registerFloat(el) { floaters.add(el); }
  function unregisterFloat(el) { floaters.delete(el); }

  (function tick(now) {
    const t = now / 1000;
    floaters.forEach(el => {
      if (!el.isConnected) { floaters.delete(el); return; }
      const seed = el._seed || (el._seed = Math.random() * 100);
      const inner = el.querySelector('.card-float');
      if (!inner) return;
      let rx = Math.sin(t * 1.1 + seed) * 3.5;
      let ry = Math.cos(t * 0.9 + seed * 1.7) * 3.5;
      let rz = Math.sin(t * 0.7 + seed) * 1.6;
      let dy = Math.sin(t * 1.3 + seed) * 2;

      if (el._hover && el._mx !== undefined) {
        ry += el._mx * 16;
        rx += -el._my * 16;
      }
      if (el._juice) {
        const k = Math.max(0, 1 - (now - el._juice) / 450);
        const wob = Math.sin((now - el._juice) / 28) * 14 * k;
        rz += wob;
        inner.style.setProperty('--jscale', 1 + 0.18 * k);
      } else {
        inner.style.setProperty('--jscale', 1);
      }
      inner.style.transform =
        `translateY(${dy}px) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rz}deg) scale(var(--jscale,1))`;
    });
    requestAnimationFrame(tick);
  })(performance.now());

  function attachTilt(el) {
    registerFloat(el);
    el.addEventListener('pointerenter', () => { el._hover = true; });
    el.addEventListener('pointerleave', () => { el._hover = false; el._mx = el._my = 0; });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el._mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      el._my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
  }

  /* 计分时的"果冻抖动" */
  function juice(el) { if (el) el._juice = performance.now(); }

  /* ---------- 震屏 ---------- */
  let shakeAmt = 0;
  const game = document.getElementById('game');
  (function shakeTick() {
    if (shakeAmt > 0.3) {
      const a = shakeAmt;
      game.style.transform =
        `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px) rotate(${(Math.random() - 0.5) * a * 0.05}deg)`;
      shakeAmt *= 0.88;
    } else if (shakeAmt !== 0) {
      shakeAmt = 0; game.style.transform = '';
    }
    requestAnimationFrame(shakeTick);
  })();
  function shake(power) { shakeAmt = Math.max(shakeAmt, power); }

  /* ---------- 弹出文字 ---------- */
  function popText(el, text, cls) {
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    popAt(r.left + r.width / 2, r.top - 6, text, cls);
  }

  function popAt(x, y, text, cls) {
    const d = document.createElement('div');
    d.className = 'pop ' + (cls || '');
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.setProperty('--dx', (Math.random() * 30 - 15) + 'px');
    popups.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }

  /* ---------- 数字滚动 ---------- */
  function tween(from, to, dur, onUpdate, onDone) {
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      onUpdate(from + (to - from) * e, p);
      if (p < 1) requestAnimationFrame(step);
      else if (onDone) onDone();
    })(t0);
  }

  /* 面板数值受击缩放 */
  function pulse(el, scale) {
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = `scale(${scale || 1.25})`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform .28s cubic-bezier(.2,2.4,.4,1)';
      el.style.transform = 'scale(1)';
    }));
  }

  /* ---------- FLIP 布局动画：元素移动到新位置时平滑过渡 ---------- */
  function flip(container, mutate) {
    const kids = Array.from(container.children);
    const first = new Map(kids.map(k => [k, k.getBoundingClientRect()]));
    mutate();
    Array.from(container.children).forEach(k => {
      const f = first.get(k);
      if (!f) return;
      const l = k.getBoundingClientRect();
      const dx = f.left - l.left, dy = f.top - l.top;
      if (!dx && !dy) return;
      k.style.transition = 'none';
      k.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        k.style.transition = 'transform .32s cubic-bezier(.25,1.5,.45,1)';
        k.style.transform = '';
      }));
    });
  }

  /* ---------- 粒子喷发（胜利/购买） ---------- */
  function burst(x, y, colors, count) {
    for (let i = 0; i < (count || 18); i++) {
      const d = document.createElement('div');
      d.className = 'particle';
      d.style.background = colors[i % colors.length];
      d.style.left = x + 'px'; d.style.top = y + 'px';
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 140;
      d.style.setProperty('--px', Math.cos(a) * v + 'px');
      d.style.setProperty('--py', (Math.sin(a) * v - 80) + 'px');
      d.style.setProperty('--pr', (Math.random() * 720 - 360) + 'deg');
      popups.appendChild(d);
      setTimeout(() => d.remove(), 900);
    }
  }

  return { attachTilt, unregisterFloat, juice, shake, popText, popAt, tween, pulse, flip, burst };
})();
