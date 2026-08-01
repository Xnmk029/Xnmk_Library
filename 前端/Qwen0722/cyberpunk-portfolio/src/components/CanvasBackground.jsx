import { useRef, useEffect, useCallback } from 'react';

const CURVE_COUNT = 250;
const MOUSE_RADIUS = 180;
const MOUSE_FORCE = 60;

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function lerpColor(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export default function CanvasBackground({ activeColor = '#00f0ff' }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const scrollRef = useRef(0);
  const curvesRef = useRef([]);
  const colorRef = useRef({ current: hexToRgb('#00f0ff'), target: hexToRgb(activeColor) });
  const animFrameRef = useRef(null);

  const initCurves = useCallback((width, height) => {
    const curves = [];
    for (let i = 0; i < CURVE_COUNT; i++) {
      const y = (i / CURVE_COUNT) * height;
      curves.push({
        baseY: y,
        amplitude: 20 + Math.random() * 40,
        frequency: 0.002 + Math.random() * 0.004,
        phase: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.015,
        opacity: 0.03 + Math.random() * 0.08,
        segments: 4 + Math.floor(Math.random() * 3),
      });
    }
    curvesRef.current = curves;
  }, []);

  useEffect(() => {
    colorRef.current.target = hexToRgb(activeColor);
  }, [activeColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      initCurves(width, height);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleWheel = (e) => {
      scrollRef.current += e.deltaY * 0.01;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: true });

    let time = 0;

    const draw = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      const { current, target } = colorRef.current;
      const lerped = lerpColor(current, target, 0.02);
      colorRef.current.current = lerped;

      const mouse = mouseRef.current;
      const scrollOffset = scrollRef.current;
      const curves = curvesRef.current;

      for (let i = 0; i < curves.length; i++) {
        const curve = curves[i];
        const { baseY, amplitude, frequency, phase, speed, opacity, segments } = curve;

        const waveAmp = amplitude + Math.sin(scrollOffset * 0.5 + i * 0.1) * 15;
        const y = baseY + Math.sin(time * speed + phase) * waveAmp * 0.3;

        ctx.beginPath();
        ctx.moveTo(0, y);

        const segWidth = width / segments;
        for (let s = 0; s < segments; s++) {
          const x1 = s * segWidth;
          const x2 = (s + 1) * segWidth;
          const midX = (x1 + x2) / 2;

          let cpY = y + Math.sin(time * speed + phase + s * 1.5) * waveAmp;

          const distToMouse = Math.sqrt(
            Math.pow(midX - mouse.x, 2) + Math.pow(cpY - mouse.y, 2)
          );

          if (distToMouse < MOUSE_RADIUS) {
            const force = (1 - distToMouse / MOUSE_RADIUS) * MOUSE_FORCE;
            const angle = Math.atan2(cpY - mouse.y, midX - mouse.x);
            cpY += Math.sin(angle) * force;
          }

          ctx.quadraticCurveTo(midX, cpY, x2, y + Math.sin(time * speed + phase + (s + 1) * 1.2) * waveAmp * 0.5);
        }

        const alpha = opacity * (0.6 + Math.sin(time * 0.01 + i) * 0.4);
        ctx.strokeStyle = `rgba(${lerped.r}, ${lerped.g}, ${lerped.b}, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [initCurves]);

  return <canvas ref={canvasRef} className="canvas-background" />;
}
