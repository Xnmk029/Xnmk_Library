import { motion } from 'framer-motion';
import { BarMeter, DotMatrix, RadialDial, Sparkline } from './Meters';
import ScrambleText from './ScrambleText';

const EASE = [0.16, 1, 0.3, 1];

const wrapV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const cardV = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: EASE } },
};

function Card({ area, title, tag, children }) {
  return (
    <motion.article className={`bento-card ${area}`} variants={cardV}>
      <header className="bento-head">
        <h4>
          <ScrambleText text={title} whenInView speed={14} settle={120} />
        </h4>
        <u>{tag}</u>
      </header>
      {children}
    </motion.article>
  );
}

/**
 * Scroll-triggered Bento skill library. The whole grid is keyed by the active
 * class, so switching class re-plays the reveal with the new neon theme.
 */
export default function BentoSkills({ career }) {
  return (
    <motion.div
      className="bento"
      key={career.id}
      variants={wrapV}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.12 }}
    >
      <Card area="b-core" title="SKILL CORE" tag={`${career.code} · COMPOSITE ${career.overall}%`}>
        <div className="core-inner">
          <RadialDial value={career.overall} label="SYNC RATE" />
          <div className="core-copy">
            <h3>
              <ScrambleText text={career.label} whenInView speed={15} settle={130} />
            </h3>
            <div className="core-cn">{career.labelCn} · SINCE {career.since}</div>
            <p>{career.summary}</p>
            <ul className="core-bullets">
              {career.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card area="b-prof" title="PROFICIENCY" tag="CALIBRATED · 0-100">
        <div className="prof-grid">
          {career.gauges.map((g, i) => (
            <BarMeter key={g.name} label={g.name} labelCn={g.nameCn} value={g.value} delay={0.1 + i * 0.06} />
          ))}
        </div>
      </Card>

      <Card area="b-spark" title="THROUGHPUT" tag="26 CYCLE WINDOW">
        <div className="spark-wrap">
          <Sparkline data={career.spark} id={`spark-${career.id}`} />
        </div>
        <div className="spark-legend">
          <span>T-26</span>
          <span>PEAK {(Math.max(...career.spark) * 100).toFixed(0)}%</span>
          <span>NOW</span>
        </div>
      </Card>

      <Card area="b-stack" title="TOOLCHAIN" tag={`${career.stack.length} MODULES`}>
        <div className="stack-list">
          {career.stack.map((s) => (
            <span className="stack-chip" key={s} title={s}>
              <em aria-hidden="true" />
              {s}
            </span>
          ))}
        </div>
      </Card>

      <Card area="b-log" title="OPS FEED" tag="TAIL -F LIVE">
        <div className="term">
          {career.logs.map((l, i) => (
            <div className="term-line" key={l}>
              <em>$</em>
              <ScrambleText text={l} whenInView speed={7} settle={90} delay={i * 180} />
            </div>
          ))}
          <div className="term-line">
            <em>$</em>
            <i className="term-cursor" aria-hidden="true" />
          </div>
        </div>
      </Card>

      <Card area="b-stats" title="FIELD DATA" tag="LIFETIME">
        <div className="stat-grid">
          {career.stats.map((s) => (
            <div className="stat-cell" key={s.k}>
              <u>{s.k}</u>
              <b>
                <ScrambleText text={s.v} whenInView speed={26} settle={160} />
              </b>
              <i>{s.sub}</i>
            </div>
          ))}
        </div>
      </Card>

      <Card area="b-matrix" title="LOAD MATRIX" tag="60 SLOTS · SELF-REPORTED">
        <DotMatrix data={career.matrix} />
      </Card>
    </motion.div>
  );
}
