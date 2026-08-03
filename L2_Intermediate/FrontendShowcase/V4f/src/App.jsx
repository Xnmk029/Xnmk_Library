import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import CanvasBackground from './components/CanvasBackground';

/* --------------------------------- data --------------------------------- */

const PROFESSIONS = [
  {
    id: 'prompt',
    no: '01',
    en: 'AI PROMPT ENGINEER',
    zh: 'AI 提示词专家',
    tagline: '用语言塑造智能边界',
    enTagline: 'SHAPING INTELLIGENCE WITH LANGUAGE',
    color: '#23ff00',
    desc: '专注大模型应用工程：把模糊的业务问题翻译成稳定、可评估的 LLM 工作流。负责提示词体系、知识增强、函数调用与多智能体编排，从原型验证到生产环境全链路交付。',
    skills: [
      'Prompt Design',
      'Chain-of-Thought',
      'RAG / Knowledge Graph',
      'Function Calling',
      'Multi-Agent',
      'Eval & Red-Team',
      'Token Optimization',
      'Model Tuning',
    ],
    stats: [
      ['2,400+', 'PROMPT ITERATIONS'],
      ['38%', 'AVG COST REDUCED'],
      ['12', 'PROD AGENTS SHIPPED'],
      ['99.2%', 'TASK SUCCESS RATE'],
    ],
    scene: 'knot',
  },
  {
    id: 'bicycle',
    no: '02',
    en: 'BICYCLE TECHNICIAN',
    zh: '单车工程技师',
    tagline: '每一毫米的精准，都是速度',
    enTagline: 'PRECISION IS SPEED',
    color: '#ffaa00',
    desc: '从车架几何到传动系统，提供整车装配、轮组编制与竞赛级调校。坚持扭矩标准与数据化流程，让每一台车以最高效率、最稳定的状态运转。',
    skills: [
      'Frame Geometry',
      'Wheel Building',
      'Drivetrain Tuning',
      'Hydraulic Brake',
      'Suspension Setup',
      'E-Bike Systems',
      'Torque Protocol',
      'Track Repair',
    ],
    stats: [
      ['800+', 'FULL BUILDS'],
      ['1,500+', 'WHEELS BUILT'],
      ['3 MIN', 'FAST DIAGNOSIS'],
      ['100%', 'TORQUE STANDARD'],
    ],
    scene: 'wheel',
  },
  {
    id: 'sysadmin',
    no: '03',
    en: 'IT SYSTEMS ADMIN',
    zh: 'IT 系统管理员',
    tagline: '稳定，是最高级的炫技',
    enTagline: 'STABILITY IS THE FLEX',
    color: '#00f0ff',
    desc: '负责服务器、网络与安全体系的规划与自动化运维。用脚本消灭重复劳动，用监控守住每一毫秒，以可恢复、可审计、可扩展的架构支撑业务持续在线。',
    skills: [
      'Linux / Windows Server',
      'Docker / Kubernetes',
      'Network & Firewall',
      'AD / Entra ID',
      'Prometheus / Zabbix',
      'Shell / PowerShell',
      'Backup & DR',
      'Incident Response',
    ],
    stats: [
      ['99.98%', 'UPTIME'],
      ['120+', 'SERVERS MANAGED'],
      ['24/7', 'MONITORING GRID'],
      ['<15 MIN', 'AVG RECOVERY'],
    ],
    scene: 'core',
  },
  {
    id: 'level',
    no: '04',
    en: '3D LEVEL DESIGNER',
    zh: '3D 关卡设计师',
    tagline: '用空间讲述故事',
    enTagline: 'TELL STORIES WITH SPACE',
    color: '#ff0055',
    desc: '从灰盒到光照与性能优化，专注于关卡节奏、空间叙事与可玩性打磨。在 Unity / Unreal 中快速落地可玩原型，并用数据与玩家反馈持续迭代。',
    skills: [
      'Level Blockout',
      'Lighting & Mood',
      'Unity / Unreal',
      'Performance Budget',
      'World Building',
      'Game Feel',
      'Cinematic Flow',
      'Playtest Iteration',
    ],
    stats: [
      ['26', 'PLAYABLE LEVELS'],
      ['3', 'SHIPPED PROJECTS'],
      ['60 FPS', 'PERF TARGET'],
      ['4.8/5', 'PLAYER RATING'],
    ],
    scene: 'tower',
  },
];

const BENTO = [
  { tag: 'AI', title: 'Prompt Engineering', desc: 'RAG / CoT / Function Calling / Multi-Agent', level: 94, color: '#23ff00', size: 'w2', glyph: '{ }' },
  { tag: 'SYS', title: 'Sys Ops & SRE', desc: 'Docker / Kubernetes / Zabbix / DR', level: 88, color: '#00f0ff', size: '', glyph: '>_' },
  { tag: 'WEB', title: 'Full-Stack Dev', desc: 'React / Vite / Node.js', level: 85, color: '#00f0ff', size: '', glyph: '</>' },
  { tag: '3D', title: 'Level Design', desc: 'Unity / Unreal / Blender', level: 84, color: '#ff0055', size: 'h2', glyph: '▦' },
  { tag: 'BIKE', title: 'Bicycle Engineering', desc: '整车装配 / 轮组编制 / 竞赛调校', level: 91, color: '#ffaa00', size: 'w2', glyph: '◉' },
  { tag: 'TOOL', title: 'Scripting & Automata', desc: 'Shell / PowerShell / Python', level: 86, color: '#23ff00', size: '', glyph: '#!' },
  { tag: 'NET', title: 'Network & Security', desc: '防火墙 / VPN / 安全审计', level: 79, color: '#00f0ff', size: '', glyph: '⚿' },
  { tag: 'AIOPS', title: 'AI Application Ops', desc: '评测 / 红队 / 上线治理', level: 84, color: '#23ff00', size: 'w2', glyph: 'λ' },
  { tag: 'GAME', title: 'Game Feel & Lighting', desc: '节奏 / 光照 / 性能预算', level: 82, color: '#ff0055', size: 'w2', glyph: '◐' },
  { tag: 'EBIKE', title: 'E-Bike Systems', desc: '电池 / 电机 / BMS 诊断', level: 76, color: '#ffaa00', size: 'w2', glyph: '⚡' },
];

/* ------------------------------ scramble text ---------------------------- */

function ScrambleText({ text, delay = 0, speed = 1, className = '' }) {
  const [out, setOut] = useState('');
  const glyphs = '!<>-_\\/[]{}=+*^?#01$%&@ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  useEffect(() => {
    let rafId = 0;
    let timerId = 0;
    let t0 = 0;
    const chars = Array.from(text);
    const durs = chars.map((c) =>
      /[A-Za-z0-9]/.test(c) ? 280 + Math.random() * 620 : 120 + Math.random() * 180,
    );

    timerId = window.setTimeout(() => {
      const step = (now) => {
        if (!t0) t0 = now;
        const el = (now - t0) / 1000;
        let done = true;
        let next = '';
        for (let i = 0; i < chars.length; i += 1) {
          const p = Math.min(1, el / ((durs[i] / 1000) * (1 / speed)));
          if (p >= 1) {
            next += chars[i];
          } else {
            done = false;
            next += /[A-Za-z0-9]/.test(chars[i])
              ? glyphs[(Math.random() * glyphs.length) | 0]
              : ' ';
          }
        }
        setOut(next);
        if (!done) rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timerId);
      cancelAnimationFrame(rafId);
    };
  }, [text, delay, speed, glyphs]);

  return <span className={className} data-text={text}>{out || '\u00A0'}</span>;
}

/* --------------------------------- clock --------------------------------- */

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <span>
      {pad(now.getHours())}:{pad(now.getMinutes())}:<b>{pad(now.getSeconds())}</b>
    </span>
  );
}

/* --------------------------------- icons --------------------------------- */

function ProfIcon({ id }) {
  const common = {
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  if (id === 'prompt') {
    return (
      <svg {...common}>
        <path d="M19 11 8 24l11 13" />
        <path d="M29 11l11 13-11 13" />
      </svg>
    );
  }
  if (id === 'bicycle') {
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="16" />
        <circle cx="24" cy="24" r="6" />
        <path d="M24 8v10M24 30v10M8 24h10M30 24h10M12.7 12.7l7.1 7.1M28.2 28.2l7.1 7.1M35.3 12.7l-7.1 7.1M19.8 28.2l-7.1 7.1" />
      </svg>
    );
  }
  if (id === 'sysadmin') {
    return (
      <svg {...common}>
        <rect x="6" y="10" width="36" height="28" rx="3" />
        <path d="M13 19l6 5-6 5" />
        <path d="M24 29h11" />
      </svg>
    );
  }
  if (id === 'level') {
    return (
      <svg {...common}>
        <rect x="7" y="30" width="34" height="10" />
        <rect x="12" y="20" width="24" height="10" />
        <rect x="17" y="10" width="14" height="10" />
        <path d="M24 3v7" />
      </svg>
    );
  }
  return null;
}

/* -------------------------------- 3D scene ------------------------------- */

function SceneShape({ kind, color }) {
  const wire = {
    color,
    emissive: color,
    emissiveIntensity: 1.5,
    wireframe: true,
    transparent: true,
    opacity: 0.92,
  };
  const solidWire = {
    color,
    emissive: color,
    emissiveIntensity: 0.9,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
  };

  if (kind === 'knot') {
    return (
      <mesh>
        <torusKnotGeometry args={[1.05, 0.3, 220, 26]} />
        <meshStandardMaterial {...wire} />
      </mesh>
    );
  }

  if (kind === 'wheel') {
    return (
      <group>
        <mesh>
          <torusGeometry args={[1.38, 0.06, 12, 72]} />
          <meshStandardMaterial {...wire} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.92, 0.038, 10, 48]} />
          <meshStandardMaterial {...wire} />
        </mesh>
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0]} rotation={[0, 0, a]}>
              <cylinderGeometry args={[0.02, 0.02, 1.0, 6]} />
              <meshStandardMaterial {...wire} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (kind === 'core') {
    return (
      <group>
        <mesh>
          <icosahedronGeometry args={[1.05, 1]} />
          <meshStandardMaterial {...wire} />
        </mesh>
        <mesh>
          <boxGeometry args={[2.1, 2.1, 2.1]} />
          <meshStandardMaterial {...solidWire} />
        </mesh>
        <mesh>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial {...wire} />
        </mesh>
      </group>
    );
  }

  if (kind === 'tower') {
    const blocks = [
      { y: -1.15, s: 2.7 },
      { y: -0.55, s: 2.15 },
      { y: 0.05, s: 1.6 },
      { y: 0.65, s: 1.05 },
      { y: 1.15, s: 0.55 },
    ];
    return (
      <group position={[0, -0.2, 0]}>
        {blocks.map((b, i) => (
          <mesh key={i} position={[0, b.y, 0]}>
            <boxGeometry args={[b.s, 0.42, b.s]} />
            <meshStandardMaterial {...(i === 4 ? wire : solidWire)} />
          </mesh>
        ))}
      </group>
    );
  }

  return null;
}

function Rotating({ children, speed = 0.4 }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * speed;
      ref.current.rotation.x = 0.38 + Math.sin(performance.now() * 0.0004) * 0.08;
    }
  });
  return <group ref={ref}>{children}</group>;
}

function SceneViewport({ scene, color }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.1, 5.1], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      <pointLight position={[-4, -2, 3]} intensity={2.2} color={color} />
      <Float speed={1.7} rotationIntensity={0.7} floatIntensity={1.1}>
        <Rotating speed={0.42}>
          <SceneShape kind={scene} color={color} />
        </Rotating>
      </Float>
      <Sparkles count={80} scale={[7, 5, 4]} size={2.4} speed={0.35} opacity={0.7} color={color} />
    </Canvas>
  );
}

/* ---------------------------------- app ---------------------------------- */

export default function App() {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const accent = (selected || hovered)?.color || '#23ff00';

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selected]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openProf = (p) => setSelected(p);

  return (
    <div
      className="site"
      style={{ '--accent': accent, '--accent-08': `${accent}14`, '--accent-20': `${accent}33` }}
    >
      <CanvasBackground accent={accent} focus={selected ? 1 : hovered ? 0.85 : 0} />
      <div className="cyber-fx" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">
            MAKER<b>-OS</b> // V4.0
          </span>
        </div>
        <div className="topbar-right">
          <div className="sys-status">
            <span className="led" /> SYS: <b>ONLINE</b>
          </div>
          <div className="clock">
            <Clock />
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-kicker">MULTI-ROLE CREATIVE RESUME</div>
          <h1 className="hero-title">
            <ScrambleText text="COMPOSITE" delay={150} />
            <span className="line2">
              <ScrambleText text="MAKER" delay={380} /> <span className="amp">&amp;</span>{' '}
              <span className="ghost">
                <ScrambleText text="SYS.ADMIN" delay={600} />
              </span>
            </span>
          </h1>
          <p className="hero-zh">
            复合型创客 · 系统管理员 · <b>多职业技能矩阵</b>
          </p>
          <div className="hero-meta">
            {PROFESSIONS.map((p) => (
              <button
                key={p.id}
                className="hero-chip"
                style={{ '--c': p.color }}
                onClick={() => openProf(p)}
              >
                <i style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                {p.en}
              </button>
            ))}
          </div>
          <div className="terminal">
            <motion.div
              className="term-line"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <span className="term-prompt">root@maker</span>
              <span className="term-path">:~</span>
              <span className="term-cursor">$</span>
              <span>
                <ScrambleText text="init --profile multi-role --hud cyberpunk" />
              </span>
            </motion.div>
            <motion.div
              className="term-line"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
            >
              <span className="term-tag">[ OK ]</span>
              <span>LOADING 4 PROFESSION MODULES ...</span>
            </motion.div>
            <motion.div
              className="term-line"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.35 }}
            >
              <span className="term-tag">[ OK ]</span>
              <span>BINDING HUD INTERFACE v4.0</span>
            </motion.div>
            <motion.div
              className="term-line"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.7 }}
            >
              <span className="term-prompt">root@maker</span>
              <span className="term-path">:~</span>
              <span className="term-cursor">$</span>
              <span className="blink">▊</span>
            </motion.div>
          </div>
        </section>

        <section className="professions" id="modules">
          <div className="section-head">
            <h2 className="section-title">PROFESSION MODULES</h2>
            <span className="section-hint">HOVER TO FOCUS · CLICK TO ENTER</span>
          </div>
          <div className="prof-grid">
            {PROFESSIONS.map((p, i) => (
              <motion.article
                key={p.id}
                className="prof-card"
                style={{ '--c': p.color, '--c-soft': `${p.color}24`, '--c-faint': `${p.color}0f` }}
                role="button"
                tabIndex={0}
                aria-label={`打开 ${p.zh} 模块`}
                initial={{ opacity: 0, y: 44 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered((h) => (h?.id === p.id ? null : h))}
                onClick={() => openProf(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openProf(p);
                  }
                }}
              >
                <span className="guide guide-v" />
                <span className="guide guide-h" />
                <span className="prof-shine" />
                <div className="prof-top">
                  <span className="prof-no">MODULE {p.no}</span>
                  <motion.span
                    layoutId={`flag-${p.id}`}
                    className="card-flag"
                    style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }}
                  />
                  <span className="prof-ico">
                    <ProfIcon id={p.id} />
                  </span>
                </div>
                <div className="prof-mid">
                  <h3 className="prof-en">{p.en}</h3>
                  <p className="prof-zh">{p.zh}</p>
                  <p className="prof-tagline">{p.tagline}</p>
                </div>
                <div className="prof-bottom">
                  <div className="prof-skills">
                    {p.skills.slice(0, 3).map((s) => (
                      <span key={s} className="prof-skill">
                        {s}
                      </span>
                    ))}
                  </div>
                  <span className="prof-enter">ENTER MODULE</span>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="bento-section" id="skills">
          <div className="section-head">
            <h2 className="section-title">SKILL LIBRARY / BENTO GRID</h2>
            <span className="section-hint">SCROLL TO LOAD</span>
          </div>
          <div className="bento-grid">
            {BENTO.map((b, i) => (
              <motion.div
                key={b.title}
                className={`bento-item ${b.size}`}
                style={{ '--c': b.color }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.06 }}
              >
                <span className="bento-glyph">{b.glyph}</span>
                <div>
                  <span className="bento-tag">{b.tag}</span>
                  <h3>{b.title}</h3>
                  <p>{b.desc}</p>
                </div>
                <div>
                  <div className="bento-bar">
                    <motion.span
                      className="bento-fill"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${b.level}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.2 + (i % 4) * 0.06 }}
                    />
                  </div>
                  <div className="bento-lvl">
                    <span>LEVEL</span>
                    <span>{b.level}%</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>
          © 2026 <b>MAKER-OS</b> // COMPOSITE MAKER
        </span>
        <span>
          DESIGNED FOR THE GRID <span className="led" />
        </span>
      </footer>

      <AnimatePresence>
        {selected && (
          <motion.div
            key="detail"
            className="detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="detail-card"
              style={{
                '--accent': selected.color,
                '--accent-08': `${selected.color}14`,
                '--accent-20': `${selected.color}33`,
              }}
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.96, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.97, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            >
              <div className="detail-head">
                <button className="back-btn" onClick={() => setSelected(null)}>
                  ← BACK
                </button>
                <div className="detail-flag">
                  <motion.span
                    layoutId={`flag-${selected.id}`}
                    className="detail-flag-dot"
                    style={{ background: selected.color, boxShadow: `0 0 10px ${selected.color}` }}
                  />
                  MODULE {selected.no} // ACTIVE
                </div>
                <div className="detail-status">
                  <span className="led" /> LIVE
                </div>
              </div>

              <div className="detail-body">
                <div className="detail-info">
                  <h2 className="detail-en">
                    <ScrambleText text={selected.en} speed={1.8} />
                  </h2>
                  <h3 className="detail-zh">{selected.zh}</h3>
                  <p className="detail-tagline">
                    {selected.tagline} · <span className="mono-small">{selected.enTagline}</span>
                  </p>
                  <p className="detail-desc">{selected.desc}</p>
                  <div className="stat-grid">
                    {selected.stats.map(([num, label]) => (
                      <div key={label} className="stat">
                        <div className="stat-num">{num}</div>
                        <div className="stat-label">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="skill-chips">
                    {selected.skills.map((s) => (
                      <span key={s} className="skill-chip">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="viewport-wrap">
                  <div className="hud-corners" aria-hidden="true">
                    <span className="tl" />
                    <span className="tr" />
                    <span className="bl" />
                    <span className="br" />
                  </div>
                  <SceneViewport scene={selected.scene} color={selected.color} />
                  <div className="viewport-readout">
                    RENDER // {selected.en} <span className="blink">▊</span>
                  </div>
                </div>
              </div>

              <div className="detail-foot">
                <span>MODULE {selected.no} / 04</span>
                <span>ALL SYSTEMS NOMINAL</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
