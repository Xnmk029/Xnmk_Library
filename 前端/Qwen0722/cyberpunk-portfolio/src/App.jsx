import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Wireframe } from '@react-three/drei';
import * as THREE from 'three';
import CanvasBackground from './components/CanvasBackground';
import './App.css';

/* ===== 职业数据 ===== */
const PROFESSIONS = [
  {
    id: 'ai-prompt',
    index: '01',
    title: 'AI 提示词专家',
    subtitle: 'AI PROMPT ENGINEER',
    color: '#23ff00',
    icon: '⚡',
    tag: 'PROMPT CRAFT',
    description:
      '专注于大语言模型的提示工程与优化，设计高效、精准的 Prompt 架构。擅长 Chain-of-Thought、Few-Shot 策略与系统级提示词设计，将复杂任务分解为可执行的指令链。',
    skills: [
      { label: 'Prompt Architecture', value: '98%', bar: 98 },
      { label: 'Chain-of-Thought', value: '95%', bar: 95 },
      { label: 'System Design', value: '92%', bar: 92 },
      { label: 'Token Optimization', value: '88%', bar: 88 },
      { label: 'Multi-Modal', value: '85%', bar: 85 },
      { label: 'Evaluation', value: '90%', bar: 90 },
    ],
  },
  {
    id: 'bicycle',
    index: '02',
    title: '单车工程技师',
    subtitle: 'BICYCLE TECHNICIAN',
    color: '#ffaa00',
    icon: '🔧',
    tag: 'MECH WORKS',
    description:
      '精通公路车、山地车与城市通勤车的全系统维护与调校。从变速系统精准校准到液压碟刹深度保养，从轮组编圈到车架几何分析，以工匠精神对待每一个零件。',
    skills: [
      { label: 'Drivetrain Tuning', value: '96%', bar: 96 },
      { label: 'Hydraulic Brakes', value: '94%', bar: 94 },
      { label: 'Wheel Building', value: '90%', bar: 90 },
      { label: 'Frame Geometry', value: '87%', bar: 87 },
      { label: 'Suspension Setup', value: '85%', bar: 85 },
      { label: 'Diagnostics', value: '92%', bar: 92 },
    ],
  },
  {
    id: 'it-admin',
    index: '03',
    title: 'IT 系统管理员',
    subtitle: 'IT SYSTEMS ADMIN',
    color: '#00f0ff',
    icon: '🖥️',
    tag: 'SYS OPS',
    description:
      '负责企业级基础设施的运维与安全保障。管理 Linux/Windows 服务器集群、Docker 容器编排、CI/CD 流水线与网络架构。7×24 小时监控，确保系统高可用与零宕机。',
    skills: [
      { label: 'Linux Server', value: '97%', bar: 97 },
      { label: 'Docker / K8s', value: '93%', bar: 93 },
      { label: 'Network Security', value: '91%', bar: 91 },
      { label: 'CI/CD Pipeline', value: '89%', bar: 89 },
      { label: 'Cloud Infra', value: '86%', bar: 86 },
      { label: 'Monitoring', value: '94%', bar: 94 },
    ],
  },
  {
    id: '3d-design',
    index: '04',
    title: '3D 关卡设计师',
    subtitle: '3D LEVEL DESIGNER',
    color: '#ff0055',
    icon: '🎮',
    tag: 'LEVEL CRAFT',
    description:
      '使用 Unreal Engine 与 Unity 构建沉浸式游戏关卡。从白盒原型到最终光照烘焙，把控空间叙事、玩家动线与视觉节奏。热爱用几何体讲述无声的故事。',
    skills: [
      { label: 'Unreal Engine', value: '94%', bar: 94 },
      { label: 'Level Blocking', value: '96%', bar: 96 },
      { label: 'Lighting Design', value: '91%', bar: 91 },
      { label: 'Spatial Narrative', value: '89%', bar: 89 },
      { label: 'Shader / VFX', value: '83%', bar: 83 },
      { label: 'Optimization', value: '88%', bar: 88 },
    ],
  },
];

/* ===== Scramble Text 组件 ===== */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>{}[]';

function ScrambleText({ text, className = '', delay = 0 }) {
  const [display, setDisplay] = useState('');
  const [started, setStarted] = useState(false);
  const frameRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let frame = 0;
    const totalFrames = text.length * 3;

    const animate = () => {
      frame++;
      const progress = frame / totalFrames;
      const revealed = Math.floor(progress * text.length);

      let result = '';
      for (let i = 0; i < text.length; i++) {
        if (i < revealed) {
          result += text[i];
        } else if (text[i] === ' ') {
          result += ' ';
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      setDisplay(result);

      if (frame < totalFrames) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(text);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [started, text]);

  return <span className={`scramble-text ${className}`}>{display || '\u00A0'}</span>;
}

/* ===== 3D 视窗组件 ===== */
function RotatingGeometry({ color }) {
  const meshRef = useRef();
  const colorObj = new THREE.Color(color);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.5, 1]} />
      <Wireframe color={colorObj} thickness={0.02} />
    </mesh>
  );
}

function Viewport3D({ color }) {
  return (
    <div className="viewport-3d">
      <span className="viewport-label">3D LIVE VIEWPORT</span>
      <span className="viewport-fps">60 FPS</span>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={0.8} />
        <RotatingGeometry color={color} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} />
      </Canvas>
    </div>
  );
}

/* ===== Bento 技能网格 ===== */
function BentoGrid({ profession }) {
  return (
    <div className="bento-section">
      <div className="bento-section-title">SKILL MATRIX — {profession.subtitle}</div>
      <div className="bento-grid">
        {profession.skills.map((skill, i) => (
          <motion.div
            key={skill.label}
            className={`bento-item ${i === 0 ? 'span-2' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <div className="bento-label">{skill.label}</div>
            <div className="bento-value" style={{ color: profession.color }}>
              {skill.value}
            </div>
            <div className="bento-bar">
              <motion.div
                className="bento-bar-fill"
                style={{ background: profession.color, boxShadow: `0 0 8px ${profession.color}` }}
                initial={{ width: 0 }}
                animate={{ width: `${skill.bar}%` }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ===== 主应用 ===== */
export default function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PROFESSIONS[activeIndex];

  const handleSelect = useCallback((index) => {
    setActiveIndex(index);
  }, []);

  return (
    <div className="app-container">
      <CanvasBackground activeColor={active.color} />

      {/* HUD 头部 */}
      <header className="hud-header">
        <div className="hud-logo">
          <span>◆</span> MAKER.SYS
        </div>
        <div className="hud-status">
          <span className="online-dot" />
          SYSTEM ONLINE — <ScrambleText text="ALL MODULES ACTIVE" delay={500} />
        </div>
      </header>

      {/* 主内容 */}
      <main className="main-content">
        {/* 英雄区 */}
        <section className="hero-section">
          <h1 className="hero-title">
            <ScrambleText text="复合型创客" delay={200} />
          </h1>
          <p className="hero-subtitle">
            <ScrambleText text="MULTI-DISCIPLINE MAKER & SYSTEMS ADMINISTRATOR" delay={600} />
          </p>

          {/* 职业导航 */}
          <div className="profession-nav">
            {PROFESSIONS.map((prof, i) => (
              <motion.div
                key={prof.id}
                className={`profession-card ${i === activeIndex ? 'active' : ''}`}
                style={{ '--card-accent': prof.color }}
                onClick={() => handleSelect(i)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                layoutId={`card-${prof.id}`}
              >
                <div className="card-index">{prof.index}</div>
                <div className="card-title">{prof.title}</div>
                <div className="card-subtitle">{prof.subtitle}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 职业详情 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            className="profession-detail"
            style={{ '--detail-accent': active.color }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="detail-header">
              <div className="detail-icon">{active.icon}</div>
              <div className="detail-title">{active.title}</div>
              <span className="detail-tag">{active.tag}</span>
            </div>

            <p className="detail-description">{active.description}</p>

            {/* 3D 视窗 */}
            <Viewport3D color={active.color} />

            {/* Bento 技能 */}
            <BentoGrid profession={active} />
          </motion.div>
        </AnimatePresence>

        {/* 底部 */}
        <footer className="app-footer">
          <p>
            <ScrambleText text="© 2026 MAKER.SYS — BUILT WITH REACT + THREE.JS + FRAMER MOTION" delay={1000} />
          </p>
        </footer>
      </main>
    </div>
  );
}
