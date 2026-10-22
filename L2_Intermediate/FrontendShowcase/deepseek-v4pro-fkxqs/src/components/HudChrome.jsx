import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ScrambleText from './ScrambleText';

const pad = (n) => String(n).padStart(2, '0');

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export default function HudChrome({
  operator,
  sections,
  activeSection,
  onNav,
  careers,
  activeId,
  hoverId,
  scrollProgress,
}) {
  const clock = useClock();

  const tickerItems = useMemo(() => {
    const items = [
      `OPERATOR ${operator.callsign}`,
      `CLASSES ONLINE 04/04`,
      ...careers.map((c) => `${c.code} ${c.label} · ${c.overall}%`),
      `GEO ${operator.geo}`,
      `BEZIER FIELD 250 RIBBONS · MOUSE REPULSION ACTIVE`,
      `WHEEL INPUT MODULATES WAVE AMPLITUDE`,
      `UPTIME 99.98% · MTTR 07M · NODES 46`,
      `${operator.clearance} · SESSION ENCRYPTED`,
    ];
    return items;
  }, [careers, operator]);

  const ticker = (
    <>
      {tickerItems.map((s, i) => (
        <span key={`${s}-${i}`}>
          <em>◆</em> {s}
        </span>
      ))}
    </>
  );

  return (
    <>
      <div className="hud-scanlines" aria-hidden="true" />
      <div className="hud-scanbeam" aria-hidden="true" />

      <header className="hud-topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">
            <b>NEUROLINK</b>
            <span>//OS-4</span>
          </span>
        </div>

        <nav className="hud-nav" aria-label="sections">
          {sections.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="hud-nav-btn"
              data-on={activeSection === s.id}
              onClick={() => onNav(s.id)}
            >
              {activeSection === s.id ? (
                <motion.span
                  layoutId="hud-nav-underline"
                  className="hud-nav-underline"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <i>{pad(i + 1)}</i>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="hud-topright">
          <span className="hud-chip">
            <u>GEO</u>
            <b>{operator.location}</b>
          </span>
          <span className="hud-chip">
            <u>T</u>
            <b>{clock}</b>
          </span>
          <span className="hud-live">
            <em aria-hidden="true" />
            <ScrambleText text="LINK LIVE" speed={40} settle={420} />
          </span>
        </div>
      </header>

      <aside className="hud-rail hud-rail--left" aria-hidden="true">
        <span className="rail-vert">
          <b>SYS</b> · COMPOSITE OPERATOR DOSSIER
        </span>
        <div className="rail-ticks">
          {Array.from({ length: 17 }).map((_, i) => (
            <span key={i} className="rail-tick" data-major={i % 4 === 0} />
          ))}
        </div>
        <span className="rail-vert">V4PRO · FKXQS</span>
      </aside>

      <aside className="hud-rail hud-rail--right" aria-hidden="true">
        <span className="rail-vert">
          SCROLL <b>PROGRESS</b>
        </span>
        <div className="rail-progress">
          <motion.span className="rail-progress-fill" style={{ scaleY: scrollProgress }} />
        </div>
        <div className="rail-legend">
          {careers.map((c) => (
            <span
              key={c.id}
              className="rail-dot"
              style={{ color: c.color }}
              data-on={activeId === c.id || hoverId === c.id}
            />
          ))}
        </div>
      </aside>

      <span className="hud-corner" data-c="tl" aria-hidden="true" />
      <span className="hud-corner" data-c="tr" aria-hidden="true" />
      <span className="hud-corner" data-c="bl" aria-hidden="true" />
      <span className="hud-corner" data-c="br" aria-hidden="true" />

      <footer className="hud-ticker">
        <span className="hud-ticker-tag">SYS · FEED</span>
        <div className="hud-ticker-view">
          <div className="hud-ticker-track">
            {ticker}
            {ticker}
          </div>
        </div>
      </footer>
    </>
  );
}
