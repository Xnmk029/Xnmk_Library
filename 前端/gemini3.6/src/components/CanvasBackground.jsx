import React, { useEffect, useRef } from 'react';

// Helper to convert hex to RGB object
function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export const CanvasBackground = ({ activeColor = '#00f0ff', activeOpacity = 0.35 }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  // Target and current color states for smooth transition
  const colorRef = useRef({
    current: hexToRgb('#00f0ff'),
    target: hexToRgb(activeColor),
    currentOpacity: 0.25,
    targetOpacity: activeOpacity
  });

  const mouseRef = useRef({ x: -1000, y: -1000, vx: 0, vy: 0 });
  const scrollRef = useRef({ current: 0, target: 0 });

  useEffect(() => {
    colorRef.current.target = hexToRgb(activeColor);
    colorRef.current.targetOpacity = activeOpacity;
  }, [activeColor, activeOpacity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initCurves();
    };

    const handleMouseMove = (e) => {
      const prevX = mouseRef.current.x;
      const prevY = mouseRef.current.y;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.vx = e.clientX - prevX;
      mouseRef.current.vy = e.clientY - prevY;
    };

    const handleScroll = () => {
      scrollRef.current.target = window.scrollY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Generate 250 Bezier curves
    const CURVE_COUNT = 250;
    let curves = [];

    function initCurves() {
      curves = [];
      for (let i = 0; i < CURVE_COUNT; i++) {
        const yRatio = i / CURVE_COUNT;
        const baseY = yRatio * height;

        curves.push({
          x0: -100,
          y0: baseY,
          // Control point 1
          cp1x: width * 0.3,
          cp1y: baseY + (Math.random() - 0.5) * 120,
          origCp1y: baseY + (Math.random() - 0.5) * 120,
          cp1vx: 0,
          cp1vy: 0,
          // Control point 2
          cp2x: width * 0.7,
          cp2y: baseY + (Math.random() - 0.5) * 120,
          origCp2y: baseY + (Math.random() - 0.5) * 120,
          cp2vx: 0,
          cp2vy: 0,
          // End point
          x1: width + 100,
          y1: baseY,
          // Individual oscillation physics
          speed: 0.005 + Math.random() * 0.015,
          phase: Math.random() * Math.PI * 2,
          amplitude: 15 + Math.random() * 35,
          lineWidth: 0.5 + Math.random() * 1.2
        });
      }
    }

    initCurves();

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Smooth color lerp
      const c = colorRef.current;
      c.current.r += (c.target.r - c.current.r) * 0.06;
      c.current.g += (c.target.g - c.current.g) * 0.06;
      c.current.b += (c.target.b - c.current.b) * 0.06;
      c.currentOpacity += (c.targetOpacity - c.currentOpacity) * 0.06;

      // Smooth scroll lerp
      scrollRef.current.current += (scrollRef.current.target - scrollRef.current.current) * 0.1;
      const scrollVal = scrollRef.current.current;

      const r = Math.round(c.current.r);
      const g = Math.round(c.current.g);
      const b = Math.round(c.current.b);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < CURVE_COUNT; i++) {
        const curve = curves[i];

        // Dynamic wave physics driven by time & scroll
        const wave = Math.sin(time * curve.speed * 4 + curve.phase + scrollVal * 0.003) * (curve.amplitude + (scrollVal * 0.05) % 20);

        // Repulsion from mouse pointer for CP1
        const d1x = mx - curve.cp1x;
        const d1y = my - (curve.origCp1y + wave);
        const dist1 = Math.sqrt(d1x * d1x + d1y * d1y);
        const maxRepel = 220;

        if (dist1 < maxRepel) {
          const force = (1 - dist1 / maxRepel) * 35;
          const angle = Math.atan2(d1y, d1x);
          curve.cp1vy -= Math.sin(angle) * force * 0.15;
          curve.cp1vx -= Math.cos(angle) * force * 0.15;
        }

        // Repulsion for CP2
        const d2x = mx - curve.cp2x;
        const d2y = my - (curve.origCp2y - wave);
        const dist2 = Math.sqrt(d2x * d2x + d2y * d2y);
        if (dist2 < maxRepel) {
          const force = (1 - dist2 / maxRepel) * 35;
          const angle = Math.atan2(d2y, d2x);
          curve.cp2vy -= Math.sin(angle) * force * 0.15;
          curve.cp2vx -= Math.cos(angle) * force * 0.15;
        }

        // Spring return to original control point positions
        curve.cp1y += (curve.origCp1y + wave - curve.cp1y) * 0.08 + curve.cp1vy;
        curve.cp2y += (curve.origCp2y - wave - curve.cp2y) * 0.08 + curve.cp2vy;

        curve.cp1vy *= 0.85;
        curve.cp1vx *= 0.85;
        curve.cp2vy *= 0.85;
        curve.cp2vx *= 0.85;

        // Draw Bezier curve
        ctx.beginPath();
        ctx.moveTo(curve.x0, curve.y0 + wave * 0.5);
        ctx.bezierCurveTo(
          curve.cp1x,
          curve.cp1y,
          curve.cp2x,
          curve.cp2y,
          curve.x1,
          curve.y1 - wave * 0.5
        );

        // Alpha modulation per line for depth
        const lineAlpha = (c.currentOpacity * (0.2 + (i % 5) * 0.18)).toFixed(3);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${lineAlpha})`;
        ctx.lineWidth = curve.lineWidth;

        // Subtle glow effect every 10th line
        if (i % 12 === 0) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
};
