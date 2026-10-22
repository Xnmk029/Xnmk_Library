import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ScrambleText from './ScrambleText';

const LINES = [
  { tag: 'BIOS', text: 'neurolink cortex bridge v4.2.1', ok: 'OK' },
  { tag: 'MEM', text: 'mapping 262,144 semantic pages', ok: 'OK' },
  { tag: 'GFX', text: 'bezier field :: 250 ribbons armed', ok: 'OK' },
  { tag: 'NET', text: 'tunnel wg0 :: handshake complete', ok: 'OK' },
  { tag: 'CLASS', text: 'loading 04 operator profiles', ok: 'OK' },
  { tag: 'AUTH', text: 'clearance alpha-4 verified', ok: 'GRANTED' },
];

const STEP = 210;
const TAIL = 460;

export default function BootOverlay({ onFinish }) {
  const [shown, setShown] = useState(0);
  const [progress, setProgress] = useState(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const timers = [];
    LINES.forEach((_, i) => {
      timers.push(window.setTimeout(() => setShown(i + 1), STEP * i + 120));
    });
    const total = STEP * LINES.length + TAIL;
    const started = performance.now();
    const id = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - started) / total);
      setProgress(p);
      if (p >= 1) window.clearInterval(id);
    }, 40);
    timers.push(window.setTimeout(() => finishRef.current && finishRef.current(), total));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(id);
    };
  }, []);

  return (
    <motion.div
      className="boot"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => finishRef.current && finishRef.current()}
      role="presentation"
    >
      <div className="boot-inner">
        <div className="boot-brand">
          <ScrambleText text="NEUROLINK" speed={38} settle={120} />
          <span>
            <ScrambleText text="//OS-4" speed={44} settle={220} delay={220} />
          </span>
        </div>

        <div className="boot-lines">
          {LINES.slice(0, shown).map((l) => (
            <div className="boot-line" key={l.tag}>
              <u>[{l.tag}]</u>
              <ScrambleText text={l.text} speed={11} settle={90} />
              <b>{l.ok}</b>
            </div>
          ))}
        </div>

        <div className="boot-bar">
          <i style={{ width: `${(progress * 100).toFixed(2)}%` }} />
        </div>
        <div className="boot-foot">
          <span>decrypting operator dossier · {(progress * 100).toFixed(0)}%</span>
          <span>click anywhere to skip</span>
        </div>
      </div>
    </motion.div>
  );
}
