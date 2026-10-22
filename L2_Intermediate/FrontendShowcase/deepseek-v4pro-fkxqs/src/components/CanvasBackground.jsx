import { useEffect, useRef } from 'react';
import { clamp, hexToRgb, lerp, smoothing } from '../lib/color';
import { onTick } from '../lib/raf';

/* =================================================================
   CanvasBackground
   250 glowing cubic-Bezier ribbons.

   · Mouse acts as a repulsion field pushing every anchor outward.
   · Wheel input injects "wave energy" that swells the amplitude and
     then decays, so scrolling visibly ripples through the field.
   · The active career theme colour + opacity are eased every frame,
     so hovering / selecting a class cross-fades the whole field.

   Performance strategy: the 250 ribbons are grouped into 4 depth
   layers; every layer is batched into ONE canvas path and stroked
   twice (wide + soft = bloom, thin + bright = core). That means
   8 stroke calls per frame instead of 500. An adaptive quality
   governor drops the bloom pass (and then the faintest layer) if the
   measured frame cost climbs, so the field never tanks the frame rate.
   ================================================================= */

const CURVE_COUNT = 250;
const ANCHORS = 7; // → 6 chained bezier segments per ribbon
const REPEL_RADIUS = 300;
const REPEL_FORCE = 92;
const MAX_DPR = 1.5;

/** near → far depth layers */
const LAYERS = [
  { alpha: 0.5, width: 1.35, bloom: 4.6, bloomAlpha: 0.075, depth: 1 },
  { alpha: 0.34, width: 1.0, bloom: 3.6, bloomAlpha: 0.058, depth: 0.78 },
  { alpha: 0.21, width: 0.8, bloom: 2.8, bloomAlpha: 0.042, depth: 0.56 },
  { alpha: 0.12, width: 0.6, bloom: 2.2, bloomAlpha: 0.03, depth: 0.36 },
];

function buildCurves() {
  const curves = [];
  for (let i = 0; i < CURVE_COUNT; i += 1) {
    const t = i / (CURVE_COUNT - 1);
    // Weight the layers so the crisp foreground stays sparse.
    const layer = i % 7 === 0 ? 0 : i % 5 === 0 ? 1 : i % 2 === 0 ? 2 : 3;
    curves.push({
      layer,
      // Spread beyond the viewport so ribbons bleed off both edges.
      y: -0.18 + t * 1.36 + (Math.random() - 0.5) * 0.035,
      amp: 0.018 + Math.random() * 0.075,
      freq: 0.55 + Math.random() * 2.1,
      speed: 0.045 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      harmonic: 1.7 + Math.random() * 2.4,
      skew: (Math.random() - 0.5) * 0.16,
      drift: 0.3 + Math.random() * 0.9,
    });
  }
  return curves;
}

export default function CanvasBackground({ color = '#7c8ea6', intensity = 0.9, paused = false }) {
  const canvasRef = useRef(null);
  const targetRef = useRef({ rgb: hexToRgb(color), intensity, paused });

  // Keep the render loop fed with the latest props without ever restarting it,
  // so retinting or pausing never rebuilds (and visually resets) the field.
  useEffect(() => {
    targetRef.current.rgb = hexToRgb(color);
    targetRef.current.intensity = intensity;
    targetRef.current.paused = paused;
  }, [color, intensity, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    const curves = buildCurves();
    const buckets = LAYERS.map((_, li) => curves.filter((c) => c.layer === li));
    const px = new Float32Array(ANCHORS);
    const py = new Float32Array(ANCHORS);

    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let w = 0;
    let h = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();

    // --- interaction state ------------------------------------------------
    const pointer = { x: w * 0.5, y: h * 0.42, tx: w * 0.5, ty: h * 0.42, active: false };
    let wheelEnergy = 0; // 0..~1.8, decays every frame
    let scrollPhase = 0; // accumulated scroll → travelling wave offset
    let scrollNorm = 0; // page progress → slow vertical parallax

    const onPointerMove = (e) => {
      pointer.tx = e.clientX;
      pointer.ty = e.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    const onWheel = (e) => {
      const d = clamp(Math.abs(e.deltaY), 0, 160);
      wheelEnergy = clamp(wheelEnergy + d * 0.0042, 0, 1.9);
      scrollPhase += e.deltaY * 0.0016;
    };
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollNorm = clamp(window.scrollY / max, 0, 1);
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // --- eased visual state ----------------------------------------------
    const rgb = [...targetRef.current.rgb];
    let vis = 0.0; // fades in on mount
    let cost = 14; // EMA of frame cost (ms)
    let quality = 2; // 2 = bloom, 1 = no bloom, 0 = no bloom + 3 layers
    let frames = 0;

    const draw = (time, dt) => {
      const target = targetRef.current;
      if (target.paused || document.hidden) return;
      const t0 = performance.now();

      // ease colour / opacity / pointer
      const kSlow = smoothing(dt, 2.6);
      rgb[0] = lerp(rgb[0], target.rgb[0], kSlow);
      rgb[1] = lerp(rgb[1], target.rgb[1], kSlow);
      rgb[2] = lerp(rgb[2], target.rgb[2], kSlow);
      vis = lerp(vis, target.intensity, smoothing(dt, 1.5));

      const kPtr = smoothing(dt, 7);
      pointer.x = lerp(pointer.x, pointer.tx, kPtr);
      pointer.y = lerp(pointer.y, pointer.ty, kPtr);

      wheelEnergy *= Math.exp(-dt * 1.7);
      const ampBoost = 1 + wheelEnergy * 1.75;
      const parallax = (scrollNorm - 0.5) * 0.16;
      const rgbStr = `${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const mx = pointer.x;
      const my = pointer.y;
      const repelR = pointer.active ? REPEL_RADIUS : 0;
      const repelR2 = repelR * repelR;
      const layerCount = quality === 0 ? 3 : LAYERS.length;

      for (let li = 0; li < layerCount; li += 1) {
        const L = LAYERS[li];
        const bucket = buckets[li];
        ctx.beginPath();

        for (let ci = 0; ci < bucket.length; ci += 1) {
          const c = bucket[ci];
          const amp = c.amp * ampBoost * L.depth;

          for (let a = 0; a < ANCHORS; a += 1) {
            const u = a / (ANCHORS - 1);
            const nx = -0.08 + 1.16 * u;
            let x = nx * w;

            const wavePhase = time * c.speed * 6.283 + c.phase + nx * c.freq * 6.283 + scrollPhase * c.drift;
            let ny = c.y + c.skew * nx + parallax * L.depth;
            ny += Math.sin(wavePhase) * amp;
            ny += Math.sin(wavePhase * c.harmonic + c.phase) * amp * 0.32;
            let y = ny * h;

            if (repelR2 > 0) {
              const dx = x - mx;
              const dy = y - my;
              const d2 = dx * dx + dy * dy;
              if (d2 < repelR2) {
                const d = Math.sqrt(d2) || 0.0001;
                const f = 1 - d / repelR;
                const push = f * f * REPEL_FORCE * (0.45 + L.depth * 0.85);
                x += (dx / d) * push;
                y += (dy / d) * push;
              }
            }
            px[a] = x;
            py[a] = y;
          }

          // Catmull-Rom → cubic Bezier for C1-continuous ribbons.
          ctx.moveTo(px[0], py[0]);
          for (let a = 0; a < ANCHORS - 1; a += 1) {
            const p0x = px[a === 0 ? 0 : a - 1];
            const p0y = py[a === 0 ? 0 : a - 1];
            const p1x = px[a];
            const p1y = py[a];
            const p2x = px[a + 1];
            const p2y = py[a + 1];
            const p3x = px[a + 2 > ANCHORS - 1 ? ANCHORS - 1 : a + 2];
            const p3y = py[a + 2 > ANCHORS - 1 ? ANCHORS - 1 : a + 2];
            ctx.bezierCurveTo(
              p1x + (p2x - p0x) / 6,
              p1y + (p2y - p0y) / 6,
              p2x - (p3x - p1x) / 6,
              p2y - (p3y - p1y) / 6,
              p2x,
              p2y,
            );
          }
        }

        if (quality === 2) {
          ctx.lineWidth = L.bloom;
          ctx.strokeStyle = `rgba(${rgbStr}, ${(L.bloomAlpha * vis).toFixed(4)})`;
          ctx.stroke();
        }
        ctx.lineWidth = L.width;
        ctx.strokeStyle = `rgba(${rgbStr}, ${(L.alpha * vis * (0.72 + wheelEnergy * 0.24)).toFixed(4)})`;
        ctx.stroke();
      }

      // cursor bloom — a soft themed halo tracking the pointer
      if (pointer.active) {
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, REPEL_RADIUS * 1.15);
        g.addColorStop(0, `rgba(${rgbStr}, ${(0.075 * vis).toFixed(4)})`);
        g.addColorStop(0.45, `rgba(${rgbStr}, ${(0.022 * vis).toFixed(4)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, my, REPEL_RADIUS * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      // adaptive quality governor
      cost = cost * 0.9 + (performance.now() - t0) * 0.1;
      frames += 1;
      if (cost > 11 && quality > 0) quality -= 1;
      else if (cost < 5 && quality < 2) quality += 1;
    };

    const stop = onTick(draw);

    // Small introspection surface so the field can be asserted from the
    // outside (headless verification) instead of eyeballed.
    window.__NEUROLINK_FIELD__ = {
      curves: CURVE_COUNT,
      anchors: ANCHORS,
      segmentsPerCurve: ANCHORS - 1,
      repelRadius: REPEL_RADIUS,
      read() {
        return {
          wheelEnergy: Number(wheelEnergy.toFixed(4)),
          scrollPhase: Number(scrollPhase.toFixed(4)),
          rgb: [Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2])],
          intensity: Number(vis.toFixed(3)),
          quality,
          pointerActive: pointer.active,
          pointer: [Math.round(pointer.x), Math.round(pointer.y)],
          frameCostMs: Number(cost.toFixed(2)),
          frames,
        };
      },
    };

    return () => {
      stop();
      delete window.__NEUROLINK_FIELD__;
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return <canvas ref={canvasRef} className="bg-canvas" aria-hidden="true" />;
}
