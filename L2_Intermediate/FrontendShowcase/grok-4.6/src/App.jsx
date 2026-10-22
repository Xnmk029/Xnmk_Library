import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import CanvasBackground from './components/CanvasBackground.jsx'
import CareerRail from './components/CareerRail.jsx'
import CareerStage from './components/CareerStage.jsx'
import LiveViewport from './components/LiveViewport.jsx'
import ScrambleText from './components/ScrambleText.jsx'
import SkillBento from './components/SkillBento.jsx'
import { CAREERS, OPERATOR } from './data/profile.js'
import './App.css'

function pad(n) {
  return String(n).padStart(2, '0')
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export default function App() {
  const [activeId, setActiveId] = useState('ai')
  const [hoveredId, setHoveredId] = useState(null)
  const [booted, setBooted] = useState(false)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const clock = useClock()

  const focusId = hoveredId || activeId
  const focus = useMemo(() => CAREERS.find((c) => c.id === focusId) || CAREERS[0], [focusId])
  const active = useMemo(() => CAREERS.find((c) => c.id === activeId) || CAREERS[0], [activeId])
  const intensity = hoveredId ? 1 : 0.74

  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 1600)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const hit = CAREERS.find((c) => c.key === e.key)
      if (hit) setActiveId(hit.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onMove = (e) => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="app-root" style={{ '--neon': focus.color }}>
      <CanvasBackground color={focus.color} intensity={intensity} />
      <div className="grid-layer" />
      <div className="vignette-layer" />
      <div className="scanline-layer" />
      <div
        className="cursor-glow"
        style={{
          left: cursor.x,
          top: cursor.y,
          background: `radial-gradient(circle, ${focus.color}33 0%, transparent 70%)`,
        }}
      />

      <AnimatePresence>
        {!booted && (
          <motion.div
            className="boot-mask"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            <ScrambleText className="boot-title" text="NEXUS HUD ONLINE" duration={1100} />
            <ScrambleText className="boot-sub" text={`${OPERATOR.handle} // ${OPERATOR.clearance}`} delay={120} duration={900} />
          </motion.div>
        )}
      </AnimatePresence>

      <header className="hud-top">
        <div className="hud-brand">
          <span className="brand-mark" />
          <div>
            <ScrambleText className="brand-handle" text={OPERATOR.handle} duration={800} />
            <div className="brand-name">
              {OPERATOR.name} / {OPERATOR.latin}
            </div>
          </div>
        </div>
        <div className="hud-status">
          <ScrambleText
            className="status-line"
            text={`UPLINK ${OPERATOR.uplink}  ·  ${OPERATOR.location}  ·  ${active.codename}`}
            trigger={activeId}
            duration={760}
          />
          <span className="status-clock">{clock}</span>
        </div>
        <div className="hud-clearance">
          <span className="led" />
          <ScrambleText text={OPERATOR.clearance} duration={700} />
        </div>
      </header>

      <div className="hud-corners" aria-hidden="true">
        <i className="c tl" />
        <i className="c tr" />
        <i className="c bl" />
        <i className="c br" />
      </div>

      <main className="hud-main">
        <CareerRail
          careers={CAREERS}
          activeId={activeId}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onSelect={setActiveId}
        />

        <div className="stage-wrap">
          <AnimatePresence mode="wait">
            <CareerStage key={activeId} career={active} />
          </AnimatePresence>
        </div>

        <aside className="live-panel">
          <div className="live-head">
            <span className="live-dot" />
            <ScrambleText className="live-label" text="LIVE VIEWPORT" trigger={activeId} duration={620} />
            <span className="live-id">{active.index}</span>
          </div>
          <div className="live-frame">
            <LiveViewport careerId={activeId} color={active.color} />
          </div>
          <div className="live-meta">
            <ScrambleText text={`GRAPH · ${active.en}`} trigger={activeId} duration={680} />
            <span>dpr auto · r3f</span>
          </div>
        </aside>
      </main>

      <SkillBento careers={CAREERS} activeId={activeId} />

      <footer className="hud-foot">
        <span>NEXUS.04 · POLYMATH OPERATOR</span>
        <span>HOVER ROLE TO IGNITE FIELD · WHEEL TO MODULATE WAVE</span>
        <span>NO STATIC MOCK · ALL SYSTEMS LIVE</span>
      </footer>
    </div>
  )
}
