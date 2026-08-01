import React, { useEffect, useRef } from 'react';
import type { BlindType } from '../engine/blindDefs';

interface BackgroundShaderProps {
  mode: BlindType | 'shop' | 'title';
  crtEnabled?: boolean;
}

export const BackgroundShader: React.FC<BackgroundShaderProps> = ({ mode, crtEnabled = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth / 2; // half resolution for pixelated performance
      canvas.height = window.innerHeight / 2;
    };
    resize();
    window.addEventListener('resize', resize);

    // Color palettes per mode
    const getPalettes = () => {
      switch (mode) {
        case 'small': // Emerald / Teal
          return [
            [20, 60, 50],
            [10, 110, 90],
            [40, 160, 120],
            [5, 40, 35]
          ];
        case 'big': // Orange / Amber
          return [
            [80, 30, 10],
            [160, 70, 20],
            [220, 120, 40],
            [50, 20, 5]
          ];
        case 'boss': // Crimson / Deep Red / Violet
          return [
            [90, 10, 30],
            [160, 20, 50],
            [70, 10, 70],
            [40, 5, 20]
          ];
        case 'shop': // Indigo / Violet Gold
          return [
            [30, 20, 70],
            [70, 40, 130],
            [110, 70, 180],
            [20, 10, 50]
          ];
        case 'title':
        default: // Classic Balatro Deep Blue & Red
          return [
            [20, 30, 80],
            [120, 30, 60],
            [40, 80, 140],
            [15, 15, 40]
          ];
      }
    };

    const draw = () => {
      time += 0.015;
      const w = canvas.width;
      const h = canvas.height;
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      const palette = getPalettes();

      // Fluid vortex math simulation
      for (let y = 0; y < h; y += 2) {
        const ny = (y / h) * 2 - 1;
        for (let x = 0; x < w; x += 2) {
          const nx = (x / w) * 2 - 1;

          const dist = Math.sqrt(nx * nx + ny * ny);
          const angle = Math.atan2(ny, nx) + dist * 3.0 - time * 0.8;

          // Multi-frequency wave pattern
          const v1 = Math.sin(angle * 4.0 + time);
          const v2 = Math.cos(dist * 8.0 - time * 1.5);
          const v3 = Math.sin((nx + ny) * 3.0 + time * 0.5);

          const value = (v1 + v2 + v3 + 3.0) / 6.0; // 0 to 1

          const colorIdx = Math.floor(value * (palette.length - 1));
          const nextIdx = Math.min(palette.length - 1, colorIdx + 1);
          const factor = (value * (palette.length - 1)) % 1;

          const c1 = palette[colorIdx];
          const c2 = palette[nextIdx];

          const r = Math.floor(c1[0] + (c2[0] - c1[0]) * factor);
          const g = Math.floor(c1[1] + (c2[1] - c1[1]) * factor);
          const b = Math.floor(c1[2] + (c2[2] - c1[2]) * factor);

          // Fill 2x2 blocks for low-fi pixel feel
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const px = x + dx;
              const py = y + dy;
              if (px < w && py < h) {
                const idx = (py * w + px) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
              }
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Canvas Shader */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover filter contrast-125 saturate-150 scale-105"
      />

      {/* Retro CRT Scanlines Overlay */}
      {crtEnabled && (
        <div
          className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
          style={{
            background:
              'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))',
            backgroundSize: '100% 4px, 6px 100%',
          }}
        />
      )}

      {/* Subtle Vignette */}
      <div className="absolute inset-0 bg-radial-vignette opacity-60 pointer-events-none" />
    </div>
  );
};
