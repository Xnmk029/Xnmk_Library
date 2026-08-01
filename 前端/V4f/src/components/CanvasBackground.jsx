import { useEffect, useRef } from 'react';

const PALETTE = [
  [0x23, 0xff, 0x00],
  [0xff, 0xaa, 0x00],
  [0x00, 0xf0, 0xff],
  [0xff, 0x00, 0x55],
];

const COUNT = 250;
const RADIUS = 170;

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export default function CanvasBackground({ accent = '#23ff00', focus = 0 }) {
  const canvasRef = useRef(null);
  const focusRef = useRef(focus);
  const accentRef = useRef(hexToRgb(accent) || { r: 35, g: 255, b: 0 });

  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  useEffect(() => {
    const rgb = hexToRgb(accent);
    if (rgb) accentRef.current = rgb;
  }, [accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let raf = 0;
    const curves = [];
    const mouse = { x: -9999, y: -9999 };
    const scroll = { target: 0, value: 0 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      curves.length = 0;
      for (let i = 0; i < COUNT; i += 1) {
        const p = PALETTE[i % PALETTE.length];
        curves.push({
          x: Math.random() * w,
          y: Math.random() * h,
          angle: Math.random() * Math.PI * 2,
          len: 120 + Math.random() * 360,
          amp: 12 + Math.random() * 44,
          speed: 0.3 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
          r: p[0],
          g: p[1],
          b: p[2],
          cr: p[0],
          cg: p[1],
          cb: p[2],
          alpha: 0.045 + Math.random() * 0.16,
          width: 0.7 + Math.random() * 1.5,
        });
      }
    }

    function repel(x, y, power) {
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= RADIUS * RADIUS || d2 < 0.01) return { x: 0, y: 0 };
      const d = Math.sqrt(d2);
      const f = (1 - d / RADIUS) * power;
      return { x: (dx / d) * f, y: (dy / d) * f };
    }

    function draw(now, schedule = true) {
      const t = now * 0.001;
      scroll.value += (scroll.target - scroll.value) * 0.06;
      const boost = 1 + scroll.value * 2.8;
      const focusNow = focusRef.current;
      const target = accentRef.current;
      const alphaMul = 0.72 + focusNow * 0.28;
      const power = 46 * (0.45 + focusNow * 0.55);

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < curves.length; i += 1) {
        const c = curves[i];
        const tr = focusNow > 0.01 ? target.r : c.r;
        const tg = focusNow > 0.01 ? target.g : c.g;
        const tb = focusNow > 0.01 ? target.b : c.b;
        c.cr += (tr - c.cr) * 0.08;
        c.cg += (tg - c.cg) * 0.08;
        c.cb += (tb - c.cb) * 0.08;

        c.x += Math.sin(t * 0.05 + c.phase) * 0.05;
        c.y += Math.cos(t * 0.04 + c.phase * 1.3) * 0.05;
        if (c.x < -60) c.x = w + 50;
        if (c.x > w + 60) c.x = -50;
        if (c.y < -60) c.y = h + 50;
        if (c.y > h + 60) c.y = -50;

        const wob = Math.sin(t * c.speed + c.phase);
        const wob2 = Math.cos(t * c.speed * 0.85 + c.phase * 1.7);
        const dx = Math.cos(c.angle);
        const dy = Math.sin(c.angle);
        const px = -dy;
        const py = dx;

        const sx0 = c.x + wob * 10;
        const sy0 = c.y + wob2 * 10;
        const ex0 = c.x + dx * c.len + px * wob2 * c.amp * 0.4 * boost;
        const ey0 = c.y + dy * c.len + py * wob2 * c.amp * 0.4 * boost;
        const cx0 = c.x + dx * c.len * 0.5 + px * wob * c.amp * 0.55 * boost;
        const cy0 = c.y + dy * c.len * 0.5 + py * wob * c.amp * 0.55 * boost;

        const r1 = repel(sx0, sy0, power);
        const r2 = repel(cx0, cy0, power * 1.25);
        const r3 = repel(ex0, ey0, power);
        const sx = sx0 + r1.x;
        const sy = sy0 + r1.y;
        const qx = cx0 + r2.x;
        const qy = cy0 + r2.y;
        const ex = ex0 + r3.x;
        const ey = ey0 + r3.y;

        const mx = (sx + qx + ex) / 3 - mouse.x;
        const my = (sy + qy + ey) / 3 - mouse.y;
        const near = Math.max(0, 1 - Math.sqrt(mx * mx + my * my) / 320);
        const a = Math.min(0.9, c.alpha * alphaMul + near * 0.1);
        const r = c.cr | 0;
        const g = c.cg | 0;
        const b = c.cb | 0;

        ctx.strokeStyle = `rgba(${r},${g},${b},${(a * 0.22).toFixed(3)})`;
        ctx.lineWidth = c.width * 5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(qx, qy, ex, ey);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
        ctx.lineWidth = c.width;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(qx, qy, ex, ey);
        ctx.stroke();
      }

      if (schedule) raf = requestAnimationFrame(draw);
    }

    function onMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function onScroll() {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scroll.target = Math.min(1, Math.max(0, window.scrollY / max));
    }

    function onResize() {
      resize();
    }

    resize();
    onScroll();
    if (reduced) {
      draw(performance.now(), false);
    } else {
      raf = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="bg-canvas" aria-hidden="true" />;
}
