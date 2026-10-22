import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { rgbString } from '../lib/color';
import CareerScene, { Rig } from './scenes/CareerScenes';
import { BarMeter } from './Meters';
import ScrambleText from './ScrambleText';

/**
 * LIVE 3D viewport. One WebGL canvas drives all four class scenes; the render
 * loop is parked (`frameloop="never"`) whenever the stage scrolls out of view,
 * so the page never burns GPU time on an invisible canvas.
 */
export default function LiveViewport({ career, careers, onSelect, onHover }) {
  const stageRef = useRef(null);
  const inView = useInView(stageRef, { amount: 0.2 });
  const [ready, setReady] = useState(false);

  return (
    <div className="viewport-wrap">
      <div className="viewport-stage" ref={stageRef}>
        <div className="viewport-canvas">
          <Canvas
            dpr={[1, 1.6]}
            frameloop={inView ? 'always' : 'never'}
            camera={{ position: [0, 0.35, 6.6], fov: 42, near: 0.1, far: 60 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            onCreated={() => setReady(true)}
          >
            <Rig />
            <CareerScene key={career.id} scene={career.scene} color={career.color} />
          </Canvas>
        </div>

        <div className="viewport-grid" aria-hidden="true" />
        <div className="viewport-cross" aria-hidden="true" />

        <div className="viewport-overlay">
          <div className="viewport-top">
            <span className="viewport-rec">
              <em aria-hidden="true" />
              {inView ? 'REC · LIVE' : 'STANDBY'}
            </span>
            <span className="viewport-title">
              <ScrambleText text={career.sceneLabel} key={career.id} speed={13} settle={120} />
            </span>
          </div>

          <div className="viewport-bottom">
            <div className="viewport-meta">
              {career.meta.map((m) => (
                <div key={m.k}>
                  <u>{m.k}</u>
                  <b>{m.v}</b>
                </div>
              ))}
              <div>
                <u>RENDER</u>
                <b>WEBGL · ADDITIVE</b>
              </div>
            </div>
            <span className="viewport-hint">
              move pointer → camera parallax
              <br />
              switch class → scene morph
            </span>
          </div>
        </div>

        {!ready ? <div className="viewport-boot">spinning up gl context …</div> : null}
      </div>

      <div className="telemetry">
        <div className="tabs">
          {careers.map((c) => (
            <button
              key={c.id}
              type="button"
              className="tab"
              data-on={career.id === c.id}
              style={{ '--c': c.color, '--c-rgb': rgbString(c.rgb) }}
              onClick={() => onSelect(c.id)}
              onMouseEnter={() => onHover(c.id)}
              onMouseLeave={() => onHover(null)}
            >
              <AnimatePresence>
                {career.id === c.id ? (
                  <motion.span
                    layoutId="viewport-tab-glow"
                    className="tab-glow"
                    transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                  />
                ) : null}
              </AnimatePresence>
              <u>{c.code}</u>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        <section className="panel">
          <header className="panel-head">
            <b>CAPABILITY TELEMETRY</b>
            <i>{career.overall}% SYNC</i>
          </header>
          <div className="panel-body">
            <div className="gauge-list">
              {career.gauges.map((g, i) => (
                <BarMeter
                  key={`${career.id}-${g.name}`}
                  label={g.name}
                  labelCn={g.nameCn}
                  value={g.value}
                  delay={i * 0.07}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <b>SCENE MANIFEST</b>
            <i>{career.scene.toUpperCase()}</i>
          </header>
          <div className="panel-body">
            <div className="wire-list">
              <div className="wire-row">
                <u>CLASS</u>
                <span />
                <b>{career.label}</b>
              </div>
              <div className="wire-row">
                <u>TAGLINE</u>
                <span />
                <b>{career.taglineCn}</b>
              </div>
              <div className="wire-row">
                <u>LOOP</u>
                <span />
                <b>{inView ? 'ALWAYS' : 'PARKED'}</b>
              </div>
              <div className="wire-row">
                <u>PRIMITIVES</u>
                <span />
                <b>LINES · POINTS · PLANES</b>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
