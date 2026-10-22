import { motion } from 'framer-motion'
import ScrambleText from './ScrambleText.jsx'

export default function CareerStage({ career }) {
  return (
    <motion.section
      className="career-stage"
      key={career.id}
      initial={{ opacity: 0, x: 28, filter: 'blur(10px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{ '--neon': career.color }}
    >
      <div className="stage-kicker">
        <span className="stage-code">{career.codename}</span>
        <span className="stage-years">{career.years}</span>
      </div>
      <ScrambleText
        as="h2"
        className="stage-title"
        text={career.zh}
        duration={720}
        trigger={career.id}
      />
      <p className="stage-en">{career.en}</p>
      <p className="stage-tag">{career.tagline}</p>
      <p className="stage-body">{career.manifesto}</p>

      <div className="stat-row">
        {career.stats.map((s) => (
          <div key={s.k} className="stat-cell">
            <ScrambleText className="stat-v" text={s.v} duration={640} trigger={career.id + s.k} />
            <span className="stat-k">{s.k}</span>
          </div>
        ))}
      </div>

      <div className="toolkit">
        {career.toolkit.map((item) => (
          <span key={item} className="chip">
            {item}
          </span>
        ))}
      </div>

      <ol className="mission-log">
        {career.log.map((row) => (
          <li key={row.t}>
            <time>{row.t}</time>
            <div>
              <strong>{row.title}</strong>
              <p>{row.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <blockquote className="stage-quote">“{career.quote}”</blockquote>
    </motion.section>
  )
}
