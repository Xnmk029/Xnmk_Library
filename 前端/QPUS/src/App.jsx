/* ============================================
   App.jsx — Main Entry
   Cyberpunk HUD Portfolio with scramble text,
   career transitions, 3D viewport, and
   scroll-triggered Bento skill grid.
   ============================================ */
import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Float, MeshDistortMaterial, Wireframe, Text3D, Center } from '@react-three/drei';
import CanvasBackground from './components/CanvasBackground';
import './App.css';

/* ── Scramble Text Hook ── */
const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`アイウエオカキクケコ01';

function useScrambleText(finalText, { speed = 30, delay = 0, active = true } = {}) {
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) { setDisplay(''); setDone(false); return; }
    let cancelled = false;
    let timer;

    const run = () => {
      let iteration = 0;
      const len = finalText.length;

      const tick = () => {
        if (cancelled) return;
        const resolved = Math.floor(iteration / 3);
        let str = '';
        for (let i = 0; i < len; i++) {
          if (i < resolved) {
            str += finalText[i];
          } else if (i < resolved + 4) {
            str += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
          } else {
            str += ' ';
          }
        }
        setDisplay(str);
        iteration++;
        if (resolved >= len) {
          setDisplay(finalText);
          setDone(true);
          return;
        }
        timer = setTimeout(tick, speed);
      };
      tick();
    };

    const delayTimer = setTimeout(run, delay);
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(delayTimer); };
  }, [finalText, speed, delay, active]);

  return { display, done };
}

/* ── Career Data ── */
const CAREERS = [
  {
    id: 'ai',
    index: '01',
    title: 'AI Prompt Engineer',
    cn: 'AI 提示词专家',
    color: '#23ff00',
    colorDim: 'rgba(35,255,0,0.15)',
    desc: '专注于大语言模型的提示词工程与智能体架构设计。擅长构建复杂的多步推理链、RAG 系统与 AI 工作流自动化，让 AI 以最优路径产出高质量结果。',
    skills: [
      { icon: '🧠', name: 'Prompt Engineering', desc: 'Chain-of-thought, few-shot, multi-modal prompting', level: 95 },
      { icon: '🤖', name: 'LLM Architecture', desc: 'GPT-4, Claude, Gemini, LLaMA fine-tuning', level: 90 },
      { icon: '🔗', name: 'RAG Systems', desc: 'Vector DB, embedding, retrieval pipelines', level: 85 },
      { icon: '⚡', name: 'AI Automation', desc: 'LangChain, AutoGen, agent orchestration', level: 88 },
      { icon: '📊', name: 'Data Analysis', desc: 'Python, Pandas, visualization pipelines', level: 82 },
      { icon: '🛡️', name: 'AI Safety', desc: 'Guardrails, red-teaming, alignment', level: 78 },
    ],
    modelType: 'torus',
  },
  {
    id: 'bike',
    index: '02',
    title: 'Bicycle Technician',
    cn: '单车工程技师',
    color: '#ffaa00',
    colorDim: 'rgba(255,170,0,0.15)',
    desc: '精通各类自行车的维修、改装与调校。从公路车到山地车、从碟刹到圈刹、从变速系统到轮组编制，拥有完整的机械师资质与丰富的实战经验。',
    skills: [
      { icon: '🔧', name: 'Drivetrain', desc: 'Shimano, SRAM, Campagnolo系统调校', level: 95 },
      { icon: '🛞', name: 'Wheel Building', desc: '手工编圈、辐条张力调校、轮组校正', level: 90 },
      { icon: '🔩', name: 'Hydraulic Brakes', desc: '液压碟刹排气、更换、调试', level: 92 },
      { icon: '📐', name: 'Bike Fitting', desc: '人体工学骑行姿态调整', level: 85 },
      { icon: '⚙️', name: 'Suspension', desc: '前叉/后避震器拆解、保养、调校', level: 88 },
      { icon: '🏗️', name: 'Frame Repair', desc: '碳纤维检测修复、铝合金焊接', level: 75 },
    ],
    modelType: 'icosahedron',
  },
  {
    id: 'it',
    index: '03',
    title: 'IT Systems Admin',
    cn: 'IT 系统管理员',
    color: '#00f0ff',
    colorDim: 'rgba(0,240,255,0.15)',
    desc: '负责企业级 IT 基础设施的部署、监控与维护。精通 Linux/Windows 服务器管理、网络安全、虚拟化技术与云原生架构，保障系统 7×24 稳定运行。',
    skills: [
      { icon: '🐧', name: 'Linux Admin', desc: 'RHEL, Ubuntu, Arch 系统管理', level: 93 },
      { icon: '☁️', name: 'Cloud Infra', desc: 'AWS, Azure, GCP 云架构设计', level: 88 },
      { icon: '🐳', name: 'Containers', desc: 'Docker, Kubernetes, Helm 编排', level: 90 },
      { icon: '🔒', name: 'Security', desc: '防火墙、IDS/IPS、渗透测试', level: 85 },
      { icon: '📡', name: 'Networking', desc: 'VLAN, VPN, BGP, DNS 架构', level: 87 },
      { icon: '📈', name: 'Monitoring', desc: 'Prometheus, Grafana, ELK Stack', level: 82 },
    ],
    modelType: 'octahedron',
  },
  {
    id: '3d',
    index: '04',
    title: '3D Level Designer',
    cn: '3D 关卡设计师',
    color: '#ff0055',
    colorDim: 'rgba(255,0,85,0.15)',
    desc: '专攻游戏关卡设计与 3D 环境艺术。从灰盒原型到最终打磨，兼顾游戏性与视觉表现力，擅长使用 Unreal Engine 和 Blender 构建沉浸式游戏世界。',
    skills: [
      { icon: '🎮', name: 'Level Design', desc: '灰盒布局、流线规划、节奏控制', level: 92 },
      { icon: '🏔️', name: 'Unreal Engine', desc: 'UE5 地形、光照、蓝图系统', level: 90 },
      { icon: '🎨', name: 'Blender', desc: '建模、UV、材质、雕刻', level: 88 },
      { icon: '💡', name: 'Lighting', desc: '实时/烘焙光照、氛围渲染', level: 85 },
      { icon: '🌍', name: 'World Building', desc: '开放世界/线性叙事环境设计', level: 87 },
      { icon: '🎭', name: 'Cinematics', desc: 'Sequencer 过场动画、镜头语言', level: 80 },
    ],
    modelType: 'dodecahedron',
  },
];

/* ── 3D Model Components ── */
function CareerModel({ type, color }) {
  const meshProps = {
    castShadow: true,
    receiveShadow: true,
  };

  const material = (
    <MeshDistortMaterial
      color={color}
      emissive={color}
      emissiveIntensity={0.3}
      roughness={0.2}
      metalness={0.8}
      distort={0.25}
      speed={2}
      wireframe={false}
      transparent
      opacity={0.85}
    />
  );

  switch (type) {
    case 'torus':
      return (
        <Float speed={2} rotationIntensity={1.5} floatIntensity={1}>
          <mesh {...meshProps}>
            <torusKnotGeometry args={[1, 0.35, 128, 32]} />
            {material}
          </mesh>
        </Float>
      );
    case 'icosahedron':
      return (
        <Float speed={1.5} rotationIntensity={2} floatIntensity={0.8}>
          <mesh {...meshProps}>
            <icosahedronGeometry args={[1.3, 1]} />
            {material}
          </mesh>
        </Float>
      );
    case 'octahedron':
      return (
        <Float speed={1.8} rotationIntensity={1.2} floatIntensity={1.2}>
          <mesh {...meshProps}>
            <octahedronGeometry args={[1.3, 0]} />
            {material}
          </mesh>
        </Float>
      );
    case 'dodecahedron':
      return (
        <Float speed={1.2} rotationIntensity={1.8} floatIntensity={0.6}>
          <mesh {...meshProps}>
            <dodecahedronGeometry args={[1.3, 0]} />
            {material}
          </mesh>
        </Float>
      );
    default:
      return (
        <Float speed={2} rotationIntensity={1} floatIntensity={1}>
          <mesh {...meshProps}>
            <sphereGeometry args={[1.2, 32, 32]} />
            {material}
          </mesh>
        </Float>
      );
  }
}

/* ── Bento Cell Component ── */
function BentoCell({ skill, color, index }) {
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      className="bento-cell"
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      style={{ '--cell-color': color }}
    >
      <span className="bento-cell__icon">{skill.icon}</span>
      <div className="bento-cell__name" style={{ color }}>{skill.name}</div>
      <div className="bento-cell__desc">{skill.desc}</div>
      <div className="bento-cell__level">
        <div
          className="bento-cell__level-fill"
          style={{
            width: inView ? `${skill.level}%` : '0%',
            background: `linear-gradient(90deg, ${color}, transparent)`,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
      <style>{`
        .bento-cell:hover::before {
          background: ${color};
          box-shadow: 0 0 12px ${color};
        }
      `}</style>
    </motion.div>
  );
}

/* ── Career Detail Page ── */
function CareerDetailPage({ career, onBack }) {
  const { display: titleDisplay } = useScrambleText(career.title, { speed: 25, delay: 200 });
  const { display: descDisplay, done: descDone } = useScrambleText(career.desc, { speed: 8, delay: 600 });

  return (
    <motion.div
      className="career-detail"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <button className="career-detail__back" onClick={onBack} id="btn-back">
        ← BACK // 返回
      </button>

      <motion.div
        className="career-detail__header"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="career-detail__tag" style={{ color: career.color }}>
          {career.index} // {career.cn}
        </div>
        <h1
          className="career-detail__title"
          style={{
            color: career.color,
            textShadow: `0 0 30px ${career.colorDim}, 0 0 60px ${career.colorDim}`,
          }}
        >
          {titleDisplay}
          <span className="scramble-cursor" style={{ background: career.color }} />
        </h1>
        <p className="career-detail__desc">{descDisplay}</p>
      </motion.div>

      {/* 3D Viewport */}
      <motion.div
        className="viewport-section"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <div className="viewport-frame">
          <div className="viewport-hud">
            <span style={{ color: career.color }}>▸ LIVE VIEWPORT</span>
            <span>MODEL: {career.modelType.toUpperCase()}</span>
            <span>STATUS: RENDERING</span>
          </div>
          <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }}>
            <ambientLight intensity={0.15} />
            <pointLight position={[5, 5, 5]} intensity={0.8} color={career.color} />
            <pointLight position={[-5, -3, 3]} intensity={0.3} color="#ffffff" />
            <Suspense fallback={null}>
              <CareerModel type={career.modelType} color={career.color} />
            </Suspense>
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              autoRotate
              autoRotateSpeed={1.5}
            />
          </Canvas>
        </div>
      </motion.div>

      {/* Bento Skills Grid */}
      <div className="bento-section">
        <div className="bento-section__title" style={{ color: career.color }}>
          ▸ SKILL MATRIX // 技能矩阵
        </div>
        <div className="bento-grid">
          {career.skills.map((skill, i) => (
            <BentoCell key={skill.name} skill={skill} color={career.color} index={i} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main App ── */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeCareer, setActiveCareer] = useState('none');
  const [selectedCareer, setSelectedCareer] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  // Hero scramble texts
  const { display: heroName } = useScrambleText('QPUS', { speed: 40, delay: 1600, active: !loading });
  const { display: heroSub } = useScrambleText(
    '复合型创客 · 系统管理员 · 数字工匠',
    { speed: 12, delay: 2200, active: !loading }
  );
  const { display: statusText } = useScrambleText(
    'SYS.ONLINE // ALL SUBSYSTEMS NOMINAL',
    { speed: 15, delay: 1800, active: !loading }
  );

  // Loading simulation
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  // Update canvas color based on hover/selection
  useEffect(() => {
    if (selectedCareer) {
      setActiveCareer(selectedCareer.id);
    } else if (hoveredCard) {
      setActiveCareer(hoveredCard);
    } else {
      setActiveCareer('none');
    }
  }, [hoveredCard, selectedCareer]);

  const handleCardClick = useCallback((career) => {
    setSelectedCareer(career);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCareer(null);
    setHoveredCard(null);
  }, []);

  return (
    <div className="app-container">
      <CanvasBackground activeCareer={activeCareer} />

      {/* HUD Frame */}
      <div className="hud-frame" />
      <div className="hud-corner hud-corner--tl" />
      <div className="hud-corner hud-corner--tr" />
      <div className="hud-corner hud-corner--bl" />
      <div className="hud-corner hud-corner--br" />

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="loading-overlay"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="loading-overlay__text">INITIALIZING SYSTEM...</div>
            <div className="loading-overlay__bar">
              <div className="loading-overlay__bar-fill" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {selectedCareer ? (
          <CareerDetailPage
            key={selectedCareer.id}
            career={selectedCareer}
            onBack={handleBack}
          />
        ) : (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Hero Section */}
            <section className="hero-section" id="hero">
              <div className="hero-status-bar">
                <span className="status-dot" />
                <span>{statusText}</span>
              </div>

              <div className="hero-title-block">
                <div className="hero-label">MULTI-DISCIPLINARY MAKER</div>
                <h1 className="hero-name">
                  {heroName}
                  <span className="scramble-cursor" />
                </h1>
                <div className="hero-subtitle">
                  {heroSub}
                </div>
              </div>

              {/* Career Navigation */}
              <nav className="career-nav" id="career-nav" aria-label="Career selection">
                {CAREERS.map((career) => (
                  <motion.div
                    key={career.id}
                    className="career-card"
                    data-career={career.id}
                    id={`career-card-${career.id}`}
                    onClick={() => handleCardClick(career)}
                    onMouseEnter={() => setHoveredCard(career.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    layout
                  >
                    <span className="career-card__index">{career.index}</span>
                    <span className="career-card__title">{career.title}</span>
                    <span className="career-card__cn">{career.cn}</span>
                    <span className="career-card__line" />
                  </motion.div>
                ))}
              </nav>
            </section>

            {/* Footer */}
            <footer className="footer" id="footer">
              <div className="footer__line" />
              <div>QPUS // CYBERPUNK PORTFOLIO v2.0</div>
              <div style={{ marginTop: 6, opacity: 0.5 }}>
                BUILT WITH REACT · THREE.JS · FRAMER MOTION
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
