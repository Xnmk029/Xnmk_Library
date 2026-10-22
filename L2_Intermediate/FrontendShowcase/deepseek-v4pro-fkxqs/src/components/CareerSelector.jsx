import { motion } from 'framer-motion';
import { rgbString } from '../lib/color';
import ScrambleText from './ScrambleText';

const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.6 };

/**
 * The four class entries. Hovering a row extends its guide line to the right,
 * lights it in the class neon, drops a connector tick and pushes the whole
 * Canvas field to that colour (handled by the parent).
 */
export default function CareerSelector({ careers, activeId, hoverId, onHover, onOpen }) {
  return (
    <>
      <div className="classes">
        {careers.map((c, i) => {
          const lit = hoverId === c.id || activeId === c.id;
          return (
            <motion.button
              key={c.id}
              type="button"
              className="class-row"
              data-active={activeId === c.id}
              style={{ '--c': c.color, '--c-rgb': rgbString(c.rgb) }}
              onMouseEnter={() => onHover(c.id)}
              onFocus={() => onHover(c.id)}
              onMouseLeave={() => onHover(null)}
              onBlur={() => onHover(null)}
              onClick={() => onOpen(c.id)}
              initial={{ opacity: 0, x: -26 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              aria-label={`${c.label} — ${c.labelCn}`}
            >
              <span className="class-index">{c.index}</span>

              <motion.span className="class-badge" layoutId={`class-code-${c.id}`} transition={SPRING}>
                {c.code}
              </motion.span>

              <span className="class-name">
                <span className="cn-title">
                  <ScrambleText text={c.label} whenInView speed={16} settle={140} delay={i * 90} />
                </span>
                <p>{c.labelCn}</p>
              </span>

              <span className="class-guide" aria-hidden="true">
                <span className="class-guide-base" />
                <motion.span
                  className="class-guide-lit"
                  animate={{ width: lit ? '100%' : '0%' }}
                  transition={{ type: 'spring', stiffness: 190, damping: 24 }}
                >
                  <motion.span
                    className="class-guide-node"
                    animate={{ opacity: lit ? 1 : 0, scale: lit ? 1 : 0.3 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.span
                    className="class-guide-drop"
                    animate={{ scaleY: lit ? 1 : 0 }}
                    transition={{ duration: 0.35, delay: lit ? 0.18 : 0 }}
                  />
                </motion.span>
              </span>

              <span className="class-meta">
                <span className="class-meta-val">
                  <u>SYNC</u>
                  <b>{c.overall}%</b>
                </span>
                <span className="class-enter">
                  ENTER
                  <span className="class-arrow" />
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="classes-hint">
        <span>◆ hover = extend guide line + retint bezier field</span>
        <span>◆ click = open dossier transition</span>
        <span>◆ esc = disengage</span>
      </div>
    </>
  );
}
