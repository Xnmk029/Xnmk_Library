import { AnimatePresence, motion } from 'framer-motion';
import { rgbString } from '../lib/color';
import { BarMeter } from './Meters';
import ScrambleText from './ScrambleText';

const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.6 };
const EASE = [0.16, 1, 0.3, 1];

const BARS = [
  { top: '18%', h: 26, delay: 0 },
  { top: '44%', h: 12, delay: 0.05 },
  { top: '61%', h: 40, delay: 0.02 },
  { top: '82%', h: 18, delay: 0.08 },
];

/**
 * Full-screen class dossier — the cyberpunk transition sub-page.
 * Opening morphs the class code badge via a shared `layoutId` spring, sweeps
 * four glitch bars across the veil and unfolds the panel with a clip-path wipe.
 */
export default function CareerDossier({ career, onClose, onStep }) {
  return (
    <AnimatePresence>
      {career ? (
        <motion.div
          className="dossier-root"
          style={{ '--c': career.color, '--c-rgb': rgbString(career.rgb) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.div
            className="dossier-veil"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            role="presentation"
          />

          <div className="dossier-bars" aria-hidden="true">
            {BARS.map((b) => (
              <motion.span
                key={b.top}
                className="dossier-bar"
                style={{ top: b.top, height: b.h }}
                initial={{ scaleX: 0, opacity: 0.85 }}
                animate={{ scaleX: [0, 1, 1, 0], opacity: [0.9, 0.35, 0.12, 0] }}
                transition={{ duration: 0.72, delay: b.delay, ease: 'easeInOut' }}
              />
            ))}
          </div>

          <motion.section
            className="dossier-panel"
            initial={{ clipPath: 'inset(46% 0% 46% 0%)', opacity: 0, scale: 0.985 }}
            animate={{ clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.5, ease: EASE }}
            role="dialog"
            aria-modal="true"
            aria-label={`${career.label} dossier`}
          >
            <span className="dossier-accent" aria-hidden="true" />

            <header className="dossier-head">
              <motion.span className="dossier-code" layoutId={`class-code-${career.id}`} transition={SPRING}>
                {career.code}
              </motion.span>

              <div className="dossier-title">
                <h3>
                  <ScrambleText text={career.label} key={`t-${career.id}`} speed={17} settle={110} />
                </h3>
                <p>
                  {career.labelCn} · SINCE {career.since} · SYNC {career.overall}%
                </p>
              </div>

              <div className="dossier-actions">
                <span className="hud-chip">
                  <u>THREAD</u>
                  <b>{career.index} / 04</b>
                </span>
                <button type="button" className="dossier-close" onClick={onClose} aria-label="close dossier">
                  ✕
                </button>
              </div>
            </header>

            <div className="dossier-body">
              <div className="dossier-col">
                <h4>BRIEF · 职能简述</h4>
                <p className="dossier-tagline">
                  <ScrambleText text={career.tagline} key={`g-${career.id}`} speed={13} settle={220} />
                </p>
                <p className="dossier-summary">{career.summary}</p>
                <div className="dossier-stats">
                  {career.stats.map((s) => (
                    <div key={s.k}>
                      <u>{s.k}</u>
                      <b>{s.v}</b>
                      <i>{s.sub}</i>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dossier-col">
                <h4>CAPABILITY · 能力矩阵</h4>
                <div className="gauge-list">
                  {career.gauges.map((g, i) => (
                    <BarMeter
                      key={g.name}
                      label={g.name}
                      labelCn={g.nameCn}
                      value={g.value}
                      delay={0.18 + i * 0.07}
                    />
                  ))}
                </div>
              </div>

              <div className="dossier-col dossier-col--missions">
                <h4>MISSIONS · 关键战役</h4>
                <div className="dossier-missions">
                  {career.missions.map((m, i) => (
                    <motion.article
                      key={m.code}
                      className="dmission"
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.22 + i * 0.09, ease: EASE }}
                    >
                      <div className="dmission-top">
                        <u>{m.code}</u>
                        <b>{m.name}</b>
                        <i>{m.year}</i>
                      </div>
                      <p>
                        <strong style={{ color: 'var(--ink)', fontWeight: 400 }}>{m.nameCn}</strong> — {m.desc}
                      </p>
                      <div className="dmission-foot">
                        {m.tags.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                        <em>{m.impact}</em>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>
            </div>

            <footer className="dossier-foot">
              <span>◆ dossier {career.code} decrypted · press esc or click backdrop to disengage</span>
              <span className="dossier-switch">
                <button type="button" onClick={() => onStep(-1)}>
                  ◀ PREV CLASS
                </button>
                <button type="button" onClick={() => onStep(1)}>
                  NEXT CLASS ▶
                </button>
              </span>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
