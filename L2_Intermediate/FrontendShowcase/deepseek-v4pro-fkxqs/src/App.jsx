import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import './App.css';
import { ALL_MISSIONS, CAREERS, CAREER_MAP, NEUTRAL, OPERATOR, SECTIONS } from './data/careers';
import { rgbString } from './lib/color';
import BentoSkills from './components/BentoSkills';
import BootOverlay from './components/BootOverlay';
import CanvasBackground from './components/CanvasBackground';
import CareerDossier from './components/CareerDossier';
import CareerSelector from './components/CareerSelector';
import HudChrome from './components/HudChrome';
import LiveViewport from './components/LiveViewport';
import OpsTimeline from './components/OpsTimeline';
import ScrambleText from './components/ScrambleText';

const EASE = [0.16, 1, 0.3, 1];

function SectionHead({ index, title, subtitle }) {
  return (
    <header className="sect-head">
      <span className="sect-index">{index}</span>
      <div className="sect-titles">
        <h2>
          <ScrambleText text={title} whenInView speed={18} settle={140} />
        </h2>
        <p>{subtitle}</p>
      </div>
      <span className="sect-rule" aria-hidden="true" />
      <span className="sect-rule-cap" aria-hidden="true" />
    </header>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [hoverId, setHoverId] = useState(null);
  const [activeId, setActiveId] = useState(CAREERS[0].id);
  const [dossierId, setDossierId] = useState(null);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 130, damping: 28, mass: 0.4 });

  const activeCareer = CAREER_MAP[activeId];
  const dossier = dossierId ? CAREER_MAP[dossierId] : null;

  // hover wins over the open dossier, which wins over the current selection
  const focus = CAREER_MAP[hoverId] || dossier || activeCareer;
  const theme = booting ? NEUTRAL : focus;
  const fieldIntensity = booting ? 0.5 : hoverId || dossier ? 1.2 : 0.92;

  /* ---- drive the global neon theme from one place --------------------- */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme', theme.color);
    root.style.setProperty('--theme-rgb', rgbString(theme.rgb));
  }, [theme]);

  /* ---- drop the pre-hydration shell ---------------------------------- */
  useEffect(() => {
    const shell = document.getElementById('pre-boot');
    if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
  }, []);

  /* ---- which section owns the top-bar highlight ----------------------- */
  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (nodes.length === 0) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: '-42% 0px -52% 0px', threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const goto = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const openDossier = useCallback((id) => {
    setDossierId(id);
    setActiveId(id);
  }, []);

  const step = useCallback(
    (dir) => {
      if (!dossierId) return;
      const idx = CAREERS.findIndex((c) => c.id === dossierId);
      const next = CAREERS[(idx + dir + CAREERS.length) % CAREERS.length];
      setDossierId(next.id);
      setActiveId(next.id);
    },
    [dossierId],
  );

  /* ---- dossier: scroll lock + keyboard ------------------------------- */
  useEffect(() => {
    if (!dossier) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setDossierId(null);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [dossier, step]);

  const missions = useMemo(() => ALL_MISSIONS, []);

  return (
    <>
      <CanvasBackground color={theme.color} intensity={fieldIntensity} paused={Boolean(dossier)} />

      <AnimatePresence>{booting ? <BootOverlay onFinish={() => setBooting(false)} /> : null}</AnimatePresence>

      <HudChrome
        operator={OPERATOR}
        sections={SECTIONS}
        activeSection={activeSection}
        onNav={goto}
        careers={CAREERS}
        activeId={activeId}
        hoverId={hoverId}
        scrollProgress={progress}
      />

      <div className="app">
        <main className="shell">
          {/* ============================ IDENTITY ==================== */}
          <section className="sect hero" id="identity">
            <div>
              <div className="hero-kicker">
                <ScrambleText text={OPERATOR.clearance} speed={26} settle={260} delay={120} />
              </div>

              <h1 className="hero-name">
                <ScrambleText text={OPERATOR.nameEn} speed={44} settle={200} delay={220} />
                <span className="hero-name-cn">
                  <ScrambleText text={OPERATOR.nameCn} speed={90} settle={420} delay={520} />
                </span>
              </h1>

              <div className="hero-role">
                <span>{OPERATOR.roleEn}</span>
                <span className="slash">//</span>
                <span>{OPERATOR.roleCn}</span>
                <span className="slash">//</span>
                <span>{OPERATOR.callsign}</span>
              </div>

              <p className="hero-intro">{OPERATOR.intro}</p>

              <div className="hero-cta">
                <button type="button" className="hud-btn hud-btn--solid" onClick={() => goto('classes')}>
                  <em>▸</em> SELECT CLASS
                </button>
                <button type="button" className="hud-btn" onClick={() => goto('viewport')}>
                  <em>◈</em> LIVE 3D VIEWPORT
                </button>
                <button type="button" className="hud-btn" onClick={() => openDossier(activeId)}>
                  <em>◆</em> OPEN DOSSIER
                </button>
              </div>
            </div>

            <aside className="hero-side">
              <section className="panel">
                <header className="panel-head">
                  <b>OPERATOR STATUS</b>
                  <i>REALTIME</i>
                </header>
                <div className="readout-grid">
                  {OPERATOR.readouts.map((r, i) => (
                    <div className="readout" key={r.k}>
                      <u>{r.k}</u>
                      <b>
                        <ScrambleText text={r.v} speed={30} settle={300} delay={700 + i * 130} />
                      </b>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <header className="panel-head">
                  <b>IDENTITY BUS</b>
                  <i>04 THREADS</i>
                </header>
                <div className="panel-body">
                  <div className="wire-list">
                    <div className="wire-row">
                      <u>CALLSIGN</u>
                      <span />
                      <b>{OPERATOR.callsign}</b>
                    </div>
                    <div className="wire-row">
                      <u>GEO</u>
                      <span />
                      <b>{OPERATOR.geo}</b>
                    </div>
                    <div className="wire-row">
                      <u>SERVICE</u>
                      <span />
                      <b>{OPERATOR.years} YEARS</b>
                    </div>
                    <div className="wire-row">
                      <u>FOCUS</u>
                      <span />
                      <b>{focus.label}</b>
                    </div>
                    <div className="wire-row">
                      <u>FIELD</u>
                      <span />
                      <b>250 BEZIER RIBBONS</b>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <header className="panel-head">
                  <b>CLASS LEGEND</b>
                  <i>HOVER TO RETINT</i>
                </header>
                <div className="panel-body">
                  <div className="wire-list">
                    {CAREERS.map((c) => (
                      <div
                        className="wire-row"
                        key={c.id}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoverId(c.id)}
                        onMouseLeave={() => setHoverId(null)}
                        onClick={() => openDossier(c.id)}
                        role="presentation"
                      >
                        <u style={{ color: c.color }}>{c.code}</u>
                        <span />
                        <b style={{ color: hoverId === c.id ? c.color : undefined }}>{c.labelCn}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </aside>
          </section>

          {/* ============================ CLASSES ===================== */}
          <section className="sect" id="classes">
            <SectionHead index="01" title="CLASS SELECT" subtitle="四条并行主线 · 悬停点亮导引线 · 点击展开档案" />
            <CareerSelector
              careers={CAREERS}
              activeId={activeId}
              hoverId={hoverId}
              onHover={setHoverId}
              onOpen={openDossier}
            />
          </section>

          {/* ============================ LIVE 3D ===================== */}
          <section className="sect" id="viewport">
            <SectionHead index="02" title="LIVE 3D VIEWPORT" subtitle="WebGL 实时视窗 · 每个职业一套霓虹线框场景" />
            <LiveViewport
              career={activeCareer}
              careers={CAREERS}
              onSelect={setActiveId}
              onHover={setHoverId}
            />
          </section>

          {/* ============================ SKILL MATRIX ================ */}
          <section className="sect" id="matrix">
            <SectionHead index="03" title="SKILL MATRIX" subtitle="滚动触发的 Bento 技能库 · 随所选职业重绘" />
            <BentoSkills career={activeCareer} />
          </section>

          {/* ============================ OPS LOG ===================== */}
          <section className="sect" id="oplog">
            <SectionHead index="04" title="OPS LOG" subtitle="跨职业作战日志 · 按年份倒序 · 颜色区分归属" />
            <OpsTimeline missions={missions} onHover={setHoverId} onSelect={openDossier} />
          </section>

          {/* ============================ FOOTER ====================== */}
          <motion.footer
            className="site-foot"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <div className="foot-big">
              <ScrambleText text="END OF TRANSMISSION" whenInView speed={22} settle={160} />
            </div>
            <div className="foot-cols">
              {OPERATOR.contacts.map((c) => (
                <div className="foot-col" key={c.k}>
                  <u>{c.k}</u>
                  <b>{c.v}</b>
                </div>
              ))}
              <div className="foot-col">
                <u>CLASSES</u>
                <b>04 / 04 SYNCED</b>
              </div>
            </div>
            <div className="foot-note">
              <span>NEUROLINK//OS-4 · composite operator dossier</span>
              <span>react 18 · framer motion · three.js · canvas 2d</span>
              <span>build v4pro-fkxqs</span>
            </div>
          </motion.footer>
        </main>
      </div>

      <CareerDossier career={dossier} onClose={() => setDossierId(null)} onStep={step} />
    </>
  );
}
