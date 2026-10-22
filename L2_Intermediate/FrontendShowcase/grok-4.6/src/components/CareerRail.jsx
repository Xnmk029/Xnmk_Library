import { motion } from 'framer-motion'

export default function CareerRail({ careers, activeId, hoveredId, onHover, onSelect }) {
  return (
    <nav className="career-rail" aria-label="职业入口">
      <div className="rail-kicker">SELECT ROLE // 1-4</div>
      {careers.map((career) => {
        const hot = hoveredId === career.id || activeId === career.id
        const hovered = hoveredId === career.id
        const active = activeId === career.id
        return (
          <button
            key={career.id}
            type="button"
            className={`career-entry${active ? ' is-active' : ''}${hovered ? ' is-hover' : ''}`}
            style={{ '--neon': career.color, '--neon-dim': career.colorDim }}
            onMouseEnter={() => onHover(career.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(career.id)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(career.id)}
          >
            <span className="entry-index">{career.index}</span>
            <span className="entry-copy">
              <span className="entry-zh">{career.zh}</span>
              <span className="entry-en">{career.en}</span>
            </span>
            <span className="entry-key">{career.key}</span>
            <span className="guide" aria-hidden="true">
              <motion.span
                className="guide-stem"
                animate={{
                  scaleX: hot ? 1 : 0.12,
                  opacity: hot ? 1 : 0.22,
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                style={{
                  background: career.color,
                  boxShadow: hot
                    ? `0 0 10px ${career.color}, 0 0 22px ${career.color}`
                    : `0 0 0 ${career.color}`,
                }}
              />
              <motion.span
                className="guide-cap"
                animate={{
                  opacity: hot ? 1 : 0,
                  scale: hot ? 1 : 0.4,
                  x: hot ? 0 : -8,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                style={{
                  borderColor: career.color,
                  boxShadow: `0 0 12px ${career.color}`,
                }}
              />
            </span>
            {active && (
              <motion.span
                className="entry-active-bar"
                layoutId="career-accent"
                style={{ background: career.color, boxShadow: `0 0 16px ${career.color}` }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
