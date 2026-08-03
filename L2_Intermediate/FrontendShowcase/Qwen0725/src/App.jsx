import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Float, MeshDistortMaterial, Environment } from '@react-three/drei'
import * as THREE from 'three'
import CanvasBackground from './components/CanvasBackground'
import './App.css'

/* ============================================
   职业数据配置
   ============================================ */
const CAREERS = [
  {
    id: 'ai',
    index: '01',
    icon: '🧠',
    title: 'AI PROMPT ENGINEER',
    titleZh: 'AI 提示词专家',
    color: '#23ff00',
    desc: '精通大语言模型交互设计，构建高效提示词工程体系',
    skills: [
      { name: 'Prompt Engineering', level: 95 },
      { name: 'LLM Fine-tuning', level: 88 },
      { name: 'RAG Architecture', level: 82 },
      { name: 'Agent Workflow', level: 90 },
    ],
    stats: [
      { label: 'Projects', value: '120+' },
      { label: 'Models', value: '15+' },
      { label: 'Accuracy', value: '94%' },
    ],
    description: '专注于大语言模型的提示词设计与优化，擅长构建复杂的 AI 工作流和智能体系统。通过精准的提示词工程，释放 AI 的最大潜能。'
  },
  {
    id: 'bike',
    index: '02',
    icon: '🔧',
    title: 'BICYCLE TECHNICIAN',
    titleZh: '单车工程技师',
    color: '#ffaa00',
    desc: '专业自行车维修与调校，精通各类传动系统与车架力学',
    skills: [
      { name: 'Drivetrain Tuning', level: 92 },
      { name: 'Wheel Building', level: 88 },
      { name: 'Frame Alignment', level: 85 },
      { name: 'Suspension Setup', level: 90 },
    ],
    stats: [
      { label: 'Repairs', value: '2000+' },
      { label: 'Brands', value: '30+' },
      { label: 'Years', value: '8' },
    ],
    description: '拥有8年专业自行车维修经验，精通公路车、山地车、场地车的全面调校。从传动系统到悬挂设置，追求极致的机械性能表现。'
  },
  {
    id: 'it',
    index: '03',
    icon: '🖥️',
    title: 'IT SYSTEMS ADMIN',
    titleZh: 'IT 系统管理员',
    color: '#00f0ff',
    desc: '企业级基础设施运维，网络安全与自动化部署专家',
    skills: [
      { name: 'Linux/Windows Server', level: 94 },
      { name: 'Network Security', level: 89 },
      { name: 'Docker/K8s', level: 86 },
      { name: 'CI/CD Pipeline', level: 91 },
    ],
    stats: [
      { label: 'Servers', value: '500+' },
      { label: 'Uptime', value: '99.9%' },
      { label: 'Incidents', value: '0.1%' },
    ],
    description: '负责企业级 IT 基础设施的规划、部署与运维。擅长构建高可用架构，实施自动化运维流程，确保系统安全稳定运行。'
  },
  {
    id: '3d',
    index: '04',
    icon: '🎮',
    title: '3D LEVEL DESIGNER',
    titleZh: '3D 关卡设计师',
    color: '#ff0055',
    desc: '游戏关卡设计与场景构建，打造沉浸式交互体验',
    skills: [
      { name: 'Unreal Engine', level: 90 },
      { name: 'Unity 3D', level: 87 },
      { name: 'Blender Modeling', level: 85 },
      { name: 'Level Flow Design', level: 93 },
    ],
    stats: [
      { label: 'Levels', value: '80+' },
      { label: 'Games', value: '12' },
      { label: 'Players', value: '1M+' },
    ],
    description: '专注于游戏关卡设计与3D场景构建，擅长运用空间叙事和视觉引导创造沉浸式游戏体验。从概念设计到最终实现的全流程把控。'
  }
]

/* ============================================
   乱码滚动文本组件 (Scramble Text)
   ============================================ */
const CHARS = '!<>-_\\/[]{}—=+*^?#________'

function ScrambleText({ text, className = '', delay = 0 }) {
  const [displayText, setDisplayText] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)
  const frameRef = useRef(0)
  const queueRef = useRef([])
  const rafRef = useRef(null)

  const scramble = useCallback(() => {
    const oldText = text
    const length = oldText.length
    const queue = []
    
    for (let i = 0; i < length; i++) {
      const from = CHARS[Math.floor(Math.random() * CHARS.length)]
      const to = oldText[i]
      const start = Math.floor(Math.random() * 40)
      const end = start + Math.floor(Math.random() * 40)
      queue.push({ from, to, start, end, char: '' })
    }
    
    queueRef.current = queue
    frameRef.current = 0
    setIsAnimating(true)
    
    const update = () => {
      let output = ''
      let complete = 0
      
      for (let i = 0; i < queue.length; i++) {
        const { from, to, start, end } = queue[i]
        let { char } = queue[i]
        
        if (frameRef.current >= end) {
          complete++
          output += to
        } else if (frameRef.current >= start) {
          if (!char || Math.random() < 0.28) {
            char = CHARS[Math.floor(Math.random() * CHARS.length)]
            queue[i].char = char
          }
          output += `<span class="scramble-char">${char}</span>`
        } else {
          output += from
        }
      }
      
      setDisplayText(output)
      
      if (complete < queue.length) {
        frameRef.current++
        rafRef.current = requestAnimationFrame(update)
      } else {
        setDisplayText(text)
        setIsAnimating(false)
      }
    }
    
    update()
  }, [text])

  useEffect(() => {
    const timer = setTimeout(scramble, delay)
    return () => {
      clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [scramble, delay])

  return (
    <span 
      className={`scramble-text ${className}`}
      dangerouslySetInnerHTML={{ __html: displayText }}
    />
  )
}

/* ============================================
   3D 视窗组件
   ============================================ */
function RotatingGeometry({ color }) {
  const meshRef = useRef()
  const materialRef = useRef()
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5
    }
  })

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={meshRef} scale={1.5}>
        <icosahedronGeometry args={[1, 1]} />
        <MeshDistortMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.8}
          distort={0.3}
          speed={2}
          wireframe
        />
      </mesh>
    </Float>
  )
}

function ParticleField({ color }) {
  const pointsRef = useRef()
  const count = 500
  
  const positions = useRef(
    Float32Array.from({ length: count * 3 }, () => (Math.random() - 0.5) * 10)
  )

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color={color}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

function Viewport3D({ color }) {
  return (
    <div className="viewport-3d">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} color={color} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ffffff" />
        <Suspense fallback={null}>
          <RotatingGeometry color={color} />
          <ParticleField color={color} />
          <Environment preset="night" />
        </Suspense>
        <OrbitControls 
          enableZoom={false} 
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  )
}

/* ============================================
   Bento Grid 技能展示
   ============================================ */
function BentoGrid({ career }) {
  return (
    <div className="bento-grid">
      {/* 统计数据 */}
      {career.stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className="bento-item"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="item-label">{stat.label}</div>
          <div className="item-value">{stat.value}</div>
        </motion.div>
      ))}
      
      {/* 描述卡片 */}
      <motion.div
        className="bento-item span-2"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
      >
        <div className="item-label">Overview</div>
        <div className="item-desc">{career.description}</div>
      </motion.div>
      
      {/* 技能条 */}
      {career.skills.map((skill, i) => (
        <motion.div
          key={skill.name}
          className={`bento-item ${i === 0 ? 'span-2' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.1 }}
        >
          <div className="item-label">{skill.name}</div>
          <div className="item-value" style={{ fontSize: '1.2rem' }}>{skill.level}%</div>
          <div className="skill-bar">
            <motion.div
              className="skill-fill"
              initial={{ width: 0 }}
              whileInView={{ width: `${skill.level}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ============================================
   主应用组件
   ============================================ */
export default function App() {
  const [activeCareer, setActiveCareer] = useState(null)
  const [hoveredCareer, setHoveredCareer] = useState(null)
  
  const currentCareer = CAREERS.find(c => c.id === activeCareer)
  const activeColor = currentCareer?.color || '#00f0ff'
  const bgCareer = hoveredCareer || activeCareer || 'default'

  const handleSelectCareer = (id) => {
    setActiveCareer(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setActiveCareer(null)
  }

  return (
    <div className="app-container" style={{ '--active-color': activeColor }}>
      {/* 交互式 Canvas 背景 */}
      <CanvasBackground activeCareer={bgCareer} />
      
      {/* 转场框架 */}
      <div className="transition-frame">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
      </div>
      
      {/* 扫描线 */}
      <div className="scanline" />
      
      {/* HUD 顶部状态栏 */}
      <header className="hud-header">
        <div className="hud-logo">
          CYBER<span>::</span>PORTFOLIO
        </div>
        <div className="hud-status">
          <div className="status-item">
            <span className="status-dot" />
            <span>SYSTEM ONLINE</span>
          </div>
          <div className="status-item">
            <span>MODE: {activeCareer ? 'DETAIL' : 'SELECT'}</span>
          </div>
        </div>
      </header>
      
      {/* 主内容 */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {!activeCareer ? (
            /* === 英雄区域 + 职业选择 === */
            <motion.section
              key="hero"
              className="hero-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.5 }}
            >
              <motion.h1 
                className="hero-title"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                <ScrambleText text="MULTI-CLASS" delay={300} />
                <br />
                <ScrambleText text="CREATOR" delay={600} />
              </motion.h1>
              
              <motion.p 
                className="hero-subtitle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                复合型创客与系统管理员 // <span className="highlight">SELECT YOUR PATH</span>
              </motion.p>
              
              <motion.div 
                className="career-selector"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.8 }}
              >
                {CAREERS.map((career, i) => (
                  <motion.div
                    key={career.id}
                    className="career-card"
                    style={{ '--card-color': career.color }}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.4 + i * 0.15 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleSelectCareer(career.id)}
                    onMouseEnter={() => setHoveredCareer(career.id)}
                    onMouseLeave={() => setHoveredCareer(null)}
                  >
                    <div className="card-index">{career.index} //</div>
                    <div className="card-icon">{career.icon}</div>
                    <div className="card-title">{career.title}</div>
                    <div className="card-desc">{career.desc}</div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>
          ) : (
            /* === 职业详情页面 === */
            <motion.section
              key={activeCareer}
              className="career-detail"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
            >
              <div className="detail-header">
                <button className="back-btn" onClick={handleBack}>
                  ← BACK
                </button>
                <div>
                  <h2 className="detail-title">
                    <ScrambleText text={currentCareer.title} />
                  </h2>
                  <p className="detail-subtitle">{currentCareer.titleZh}</p>
                </div>
              </div>
              
              {/* 3D 视窗 */}
              <Viewport3D color={activeColor} />
              
              {/* Bento Grid 技能展示 */}
              <BentoGrid career={currentCareer} />
            </motion.section>
          )}
        </AnimatePresence>
        
        {/* 页脚 */}
        <footer className="hud-footer">
          <p>© 2024 CYBER::PORTFOLIO // ALL SYSTEMS OPERATIONAL</p>
        </footer>
      </main>
    </div>
  )
}
