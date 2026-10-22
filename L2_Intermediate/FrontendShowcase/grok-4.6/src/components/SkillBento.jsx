import { motion } from 'framer-motion'
import { SKILLS } from '../data/profile.js'
import ScrambleText from './ScrambleText.jsx'

export default function SkillBento({ careers, activeId }) {
  const active = careers.find((c) => c.id === activeId)

  return (
    <section className="bento-section" id="skill-matrix">
      <header className="bento-head">
        <div>
          <div className="rail-kicker">SCROLL LOCK // SKILL MATRIX</div>
          <ScrambleText as="h3" className="bento-title" text="复合能力库" trigger={activeId} duration={700} />
        </div>
        <p className="bento-note">
          高亮当前职业 <span style={{ color: active.color }}>{active.zh}</span> 相关模块。其余条目保持低亮度待命。
        </p>
      </header>
      <div className="bento-grid">
        {SKILLS.map((skill, i) => {
          const linked = skill.careers.includes(activeId)
          const accent = careers.find((c) => c.id === skill.careers[0])
          return (
            <motion.article
              key={skill.id}
              className={`bento-card span-${skill.span}${skill.tall ? ' is-tall' : ''}${linked ? ' is-linked' : ''}`}
              style={{ '--neon': accent.color }}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: linked ? 1 : 0.42, y: 0 }}
              viewport={{ once: false, amount: 0.35 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24, delay: i * 0.03 }}
              whileHover={{ y: -4, opacity: 1 }}
            >
              <div className="bento-top">
                <span className="bento-metric">{skill.metric}</span>
                <span className="bento-tags">
                  {skill.careers.map((id) => {
                    const c = careers.find((x) => x.id === id)
                    return (
                      <i key={id} style={{ background: c.color }} title={c.zh} />
                    )
                  })}
                </span>
              </div>
              <h4>{skill.title}</h4>
              <p className="bento-sub">{skill.sub}</p>
              <p className="bento-body">{skill.body}</p>
            </motion.article>
          )
        })}
      </div>
    </section>
  )
}
