import { motion } from 'framer-motion';
import { rgbString } from '../lib/color';
import { CAREER_MAP } from '../data/careers';
import ScrambleText from './ScrambleText';

const EASE = [0.16, 1, 0.3, 1];

/** Cross-class mission log, newest first, colour-keyed by originating class. */
export default function OpsTimeline({ missions, onHover, onSelect }) {
  return (
    <div className="oplog">
      {missions.map((m, i) => {
        const career = CAREER_MAP[m.careerId];
        return (
          <motion.article
            key={m.code}
            className="oplog-row"
            style={{ '--c': m.color, '--c-rgb': rgbString(career.rgb) }}
            initial={{ opacity: 0, x: -22 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, delay: (i % 4) * 0.06, ease: EASE }}
            onMouseEnter={() => onHover(m.careerId)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(m.careerId)}
          >
            <span className="oplog-year">{m.year}</span>
            <span className="oplog-code">{m.code}</span>
            <span className="oplog-name">
              <b>
                <ScrambleText text={m.name} whenInView speed={16} settle={120} />
              </b>
              <span>{m.nameCn}</span>
            </span>
            <span className="oplog-desc">{m.desc}</span>
            <span className="oplog-right">
              <span className="oplog-impact">{m.impact}</span>
              <span className="oplog-tags">
                {m.tags.map((t) => (
                  <i key={t}>{t}</i>
                ))}
                <i>{m.careerCode}</i>
              </span>
            </span>
          </motion.article>
        );
      })}
    </div>
  );
}
