/* ============================================
   CanvasBackground.jsx
   High-performance interactive Canvas with 250
   glowing bezier curves that react to mouse
   position, scroll, and career hover state.
   ============================================ */
import { useRef, useEffect, useCallback } from 'react';

const CURVE_COUNT = 250;
const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ';

// Career color map
const CAREER_COLORS = {
  none: { r: 0, g: 240, b: 255 },    // default cyan
  ai:   { r: 35, g: 255, b: 0 },     // green
  bike: { r: 255, g: 170, b: 0 },    // orange
  it:   { r: 0, g: 240, b: 255 },    // cyan
  '3d': { r: 255, g: 0, b: 85 },     // pink
};

export default function CanvasBackground({ activeCareer = 'none' }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const scrollRef = useRef(0);
  const colorRef = useRef({ ...CAREER_COLORS.none });
  const targetColorRef = useRef({ ...CAREER_COLORS.none });
  const curvesRef = useRef([]);
  const animFrameRef = useRef(null);
  const timeRef = useRef(0);

  // Generate curve data once
  const initCurves = useCallback((w, h) => {
    const curves = [];
    for (let i = 0; i < CURVE_COUNT; i++) {
      const yBase = (i / CURVE_COUNT) * h * 1.4 - h * 0.2;
      curves.push({
        yBase,
        amplitude: 15 + Math.random() * 40,
        frequency: 0.001 + Math.random() * 0.003,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.6,
        opacity: 0.015 + Math.random() * 0.06,
        width: 0.3 + Math.random() * 0.8,
      });
    }
    return curves;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let running = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      curvesRef.current = initCurves(window.innerWidth, window.innerHeight);
    };

    const handleMouse = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('scroll', handleScroll);

    const draw = () => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const t = timeRef.current;
      timeRef.current += 0.016;

      // Smooth color transition
      const tc = targetColorRef.current;
      const cc = colorRef.current;
      cc.r += (tc.r - cc.r) * 0.04;
      cc.g += (tc.g - cc.g) * 0.04;
      cc.b += (tc.b - cc.b) * 0.04;

      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const scrollWave = Math.sin(scrollRef.current * 0.003) * 25;

      const curves = curvesRef.current;
      for (let i = 0; i < curves.length; i++) {
        const c = curves[i];
        const y = c.yBase + scrollWave;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${Math.round(cc.r)}, ${Math.round(cc.g)}, ${Math.round(cc.b)}, ${c.opacity})`;
        ctx.lineWidth = c.width;

        const segments = 60;
        const segW = w / segments;

        for (let s = 0; s <= segments; s++) {
          const x = s * segW;
          const wave = Math.sin(x * c.frequency + t * c.speed + c.phase) * c.amplitude;

          // Mouse repulsion
          const dx = x - mx;
          const dy = (y + wave) - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const repulse = dist < 180 ? (1 - dist / 180) * 55 * (dy > 0 ? 1 : -1) : 0;

          const py = y + wave + repulse + scrollWave * Math.sin(s * 0.1);

          if (s === 0) {
            ctx.moveTo(x, py);
          } else {
            const prevX = (s - 1) * segW;
            const cpx = (prevX + x) / 2;
            ctx.quadraticCurveTo(cpx, py, x, py);
          }
        }

        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [initCurves]);

  // Update target color when career changes
  useEffect(() => {
    const col = CAREER_COLORS[activeCareer] || CAREER_COLORS.none;
    targetColorRef.current = { ...col };
  }, [activeCareer]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
