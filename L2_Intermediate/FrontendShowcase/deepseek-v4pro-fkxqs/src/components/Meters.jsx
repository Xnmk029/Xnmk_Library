import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];
const VIEW = { once: true, amount: 0.15 };

/*
 * Every meter drives its own `useInView` gate instead of relying on
 * `whileInView`. Nested `whileInView` children inside a parent variant tree
 * (the Bento stagger) can have their propagated state clobbered, which
 * silently leaves some bars at zero — explicit control is deterministic.
 */

/** Big radial composite dial used by the Bento "SKILL CORE" card. */
export function RadialDial({ value = 0, size = 208, label = 'COMPOSITE' }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW);
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const ticks = 48;

  return (
    <div className="dial" style={{ width: size, height: size }} ref={ref}>
      <span className="dial-ring" aria-hidden="true" />
      <span className="dial-ring2" aria-hidden="true" />
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--theme)"
          strokeWidth="5"
          strokeDasharray={circ}
          initial={false}
          animate={{ strokeDashoffset: inView ? circ * (1 - value / 100) : circ }}
          transition={{ duration: 1.5, ease: EASE }}
          style={{ filter: 'drop-shadow(0 0 7px var(--theme))' }}
        />
        <g>
          {Array.from({ length: ticks }).map((_, i) => {
            const a = (i / ticks) * Math.PI * 2;
            const inner = r - 12;
            const outer = i % 6 === 0 ? r - 21 : r - 17;
            const cx = size / 2;
            const cy = size / 2;
            return (
              <line
                key={i}
                x1={cx + Math.cos(a) * inner}
                y1={cy + Math.sin(a) * inner}
                x2={cx + Math.cos(a) * outer}
                y2={cy + Math.sin(a) * outer}
                stroke={i % 6 === 0 ? 'var(--theme)' : 'rgba(255,255,255,0.16)'}
                strokeWidth="1"
                opacity={i / ticks <= value / 100 ? 0.9 : 0.22}
              />
            );
          })}
        </g>
      </svg>
      <span className="dial-val">
        <b>{value}</b>
        <u>{label}</u>
      </span>
    </div>
  );
}

/** Horizontal proficiency bar with segmented tick overlay. */
export function BarMeter({ label, labelCn, value = 0, delay = 0, showCn = true }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW);
  return (
    <div ref={ref}>
      <div className="gauge-row-top">
        <b>{label}</b>
        <i>{value}%</i>
      </div>
      {showCn && labelCn ? <div className="gauge-row-cn">{labelCn}</div> : null}
      <div className="bar">
        <motion.span
          className="bar-fill"
          initial={false}
          animate={{ scaleX: inView ? value / 100 : 0 }}
          transition={{ duration: 0.95, delay: inView ? delay : 0, ease: EASE }}
          style={{ scaleX: 0 }}
        />
        <span className="bar-ticks" aria-hidden="true" />
      </div>
    </div>
  );
}

/** Animated throughput sparkline (stroke draw-in + gradient fill). */
export function Sparkline({ data = [], id = 'spark' }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW);
  const w = 200;
  const h = 74;
  const n = Math.max(data.length, 2);
  const pts = data.map((v, i) => [(i / (n - 1)) * w, h - 4 - v * (h - 12)]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" ref={ref}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--theme)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--theme)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${id}-fill)`}
        initial={false}
        animate={{ opacity: inView ? 1 : 0 }}
        transition={{ duration: 0.9, delay: inView ? 0.4 : 0 }}
        style={{ opacity: 0 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--theme)"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
        initial={false}
        animate={{ pathLength: inView ? 1 : 0 }}
        transition={{ duration: 1.4, ease: EASE }}
        style={{ pathLength: 0, filter: 'drop-shadow(0 0 6px var(--theme))' }}
      />
    </svg>
  );
}

/** Dot-matrix heat grid — the "load distribution" Bento tile. */
export function DotMatrix({ data = [] }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW);
  return (
    <div className="matrix-grid" ref={ref}>
      {data.map((v, i) => (
        <motion.span
          key={i}
          className="matrix-cell"
          initial={false}
          animate={{ opacity: inView ? 0.12 + v * 0.8 : 0 }}
          transition={{ duration: 0.5, delay: inView ? (i % 15) * 0.018 + Math.floor(i / 15) * 0.05 : 0 }}
          style={{ opacity: 0 }}
        />
      ))}
    </div>
  );
}
