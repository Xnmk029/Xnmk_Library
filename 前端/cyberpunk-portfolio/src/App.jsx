import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Float, MeshDistortMaterial } from '@react-three/drei'
import CanvasBackground from './components/CanvasBackground.jsx'
import './App.css'

// ============================================
// 乱码滚动文本组件 (Scramble Text)
// ============================================
const CHARS = '!<>-_\\/[]{}—=+*^?#________'

function ScrambleText({ text, className = '', delay = 0 }) {
  const [displayText, setDisplayText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const frameRef = useRef(0)
  const queueRef = useRef([])

  useEffect(() => {
    const timeout = setTimeout(() => {
      const oldText = ''
      const length = Math.max(oldText.length, text.length)
      const queue = []

      for (let i = 0; i < length; i++) {
        const from = oldText[i] || ''
        const to = text[i] || ''
        const start = Math.floor(Math.random() * 40)
        const end = start + Math.floor(Math.random() * 40)
        queue.push({ from, to, start, end, char: '' })
      }

      queueRef.current = queue
      frameRef.current = 0
      setIsComplete(false)

      const update = () => {
        let output = ''
        let complete = 0
        const queue = queueRef.current
        const frame = frameRef.current

        for (let i = 0; i < queue.length; i++) {
          const { from, to, start, end } = queue[i]
          let { char } = queue[i]

          if (frame >= end) {
            complete++
            output += to
          } else if (frame >= start) {
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
        frameRef.current++

        if (complete === queue.length) {
          setIsComplete(true)
          setDisplayText(text)
        } else {
          requestAnimationFrame(update)
        }
      }

      update()
    }, delay)

    return () => clearTimeout(timeout)
  }, [text, delay])

  return (
    <span
      className={`scramble-text ${className} ${isComplete ? 'complete' : ''}`}
      dangerouslySetInnerHTML={{ __html: displayText }}
    />
  )
}

// ============================================
// 职业数据
// ============================================
const CAREERS = [
  {
    id: 'ai',
    label: 'AI PROMPT ENGINEER',
    title: 'AI 提示词专家',
    color: '#23ff00',
    description: '精通大语言模型的提示工程，擅长构建高效的 AI 工作流与自动化系统。通过精心设计的提示词，释放 AI 的全部潜能。',
    skills: ['Prompt Design', 'LLM Fine-tuning', 'RAG Systems', 'AI Automation', 'Chain-of-Thought', 'Few-shot Learning']
  },
  {
    id: 'bicycle',
    label: 'BICYCLE TECHNICIAN',
    title: '单车工程技师',
    color: '#ffaa00',
    description: '从公路车到山地车，精通各类自行车的维修、调校与改装。对机械传动系统有深入理解，追求极致的骑行体验。',
    skills: ['Frame Building', 'Wheel Truing', 'Drivetrain Tuning', 'Suspension Setup', 'Bike Fitting', 'Custom Mods']
  },
  {
    id: 'it',
    label: 'IT SYSTEMS ADMIN',
    title: 'IT 系统管理员',
    color: '#00f0ff',
    description: '管理复杂的企业级 IT 基础设施，从服务器集群到网络架构。确保系统高可用性、安全性与性能优化。',
    skills: ['Linux Server', 'Docker/K8s', 'Network Security', 'CI/CD Pipeline', 'Cloud Infra', 'Monitoring']
  },
  {
    id: '3d',
    label: '3D LEVEL DESIGNER',
    title: '3D 关卡设计师',
    color: '#ff0055',
    description: '创造沉浸式的 3D 游戏关卡与虚拟环境。结合美学与游戏性设计，打造令人难忘的交互体验。',
    skills: ['Unreal Engine', 'Unity', 'Blender', 'Level Flow', 'Lighting Design', 'Environmental Art']
  }
]

// ============================================
// 技能 Bento Grid 数据
// ============================================
const SKILLS_BENTO = [
  {
    icon: '🧠',
    title: 'AI & Machine Learning',
    desc: '深度学习模型训练、自然语言处理、计算机视觉应用开发',
    tags: ['PyTorch', 'TensorFlow', 'Transformers'],
    size: 'large',
    accent: '#23ff00'
  },
  {
    icon: '⚙️',
    title: 'System Architecture',
    desc: '分布式系统设计与高可用架构',
    tags: ['Microservices', 'Event-Driven'],
    size: '',
    accent: '#00f0ff'
  },
  {
    icon: '🔧',
    title: 'Mechanical Engineering',
    desc: '精密机械调校与定制改装',
    tags: ['CAD', 'CNC'],
    size: '',
    accent: '#ffaa00'
  },
  {
    icon: '🎮',
    title: 'Game Development',
    desc: '3D 关卡设计、游戏机制与叙事设计，创造沉浸式虚拟世界',
    tags: ['Unreal', 'Unity', 'Blender', 'Houdini'],
    size: 'wide',
    accent: '#ff0055'
  },
  {
    icon: '🛡️',
    title: 'Cybersecurity',
    desc: '渗透测试、安全审计与防御体系构建',
    tags: ['Pentesting', 'SIEM'],
    size: '',
    accent: '#00f0ff'
  },
  {
    icon: '☁️',
    title: 'Cloud & DevOps',
    desc: '云原生应用部署与自动化运维',
    tags: ['AWS', 'Terraform', 'GitOps'],
    size: 'tall',
    accent: '#00f0ff'
  },
  {
    icon: '🎨',
    title: 'Creative Coding',
    desc: '生成艺术、着色器编程与交互装置',
    tags: ['GLSL', 'Processing', 'TouchDesigner'],
    size: '',
    accent: '#ff0055'
  },
  {
    icon: '📡',
    title: 'IoT & Embedded',
    desc: '物联网设备开发与嵌入式系统编程',
    tags: ['Arduino', 'ESP32', 'MQTT'],
    size: 'wide',
    accent: '#ffaa00'
  }
]

// ============================================
// 3D 视窗组件
// ============================================
function Scene3D({ color = '#00f0ff' }) {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, -10, -10]} color={color} intensity={1} />
      
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <mesh>
          <icosahedronGeometry args={[1.5, 4]} />
          <MeshDistortMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.2}
            roughness={0.2}
            metalness={0.8}
            distort={0.3}
            speed={2}
            wireframe
          />
        </mesh>
      </Float>

      <Float speed={1.5} rotationIntensity={2} floatIntensity={1}>
        <mesh position={[2.5, 1, -2]}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
            wireframe
          />
        </mesh>
      </Float>

      <Float speed={1.8} rotationIntensity={1.5} floatIntensity={1.5}>
        <mesh position={[-2.5, -1, -1]}>
          <torusGeometry args={[0.4, 0.15, 16, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
            wireframe
          />
        </mesh>
      </Float>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  )
}

// ============================================
// 主应用组件
// ============================================
export default function App() {
  const [activeCareer, setActiveCareer] = useState(null)
  const [selectedCareer, setSelectedCareer] = useState(null)
  const [scrollY, setScrollY] = useState(0)

  // 监听滚动
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 获取当前激活颜色
  const activeColor = selectedCareer
    ? CAREERS.find(c => c.id === selectedCareer)?.color
    : activeCareer
      ? CAREERS.find(c => c.id === activeCareer)?.color
      : '#00f0ff'

  const handleCareerClick = useCallback((careerId) => {
    setSelectedCareer(careerId)
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedCareer(null)
  }, [])

  const selectedCareerData = CAREERS.find(c => c.id === selectedCareer)

  return (
    <div className="app-container">
      {/* Canvas 贝塞尔曲线背景 */}
      <CanvasBackground activeCareer={activeCareer || selectedCareer} />

      {/* ============================================
          Hero 首屏
          ============================================ */}
      <section className="hero-section">
        {/* 状态栏 */}
        <motion.div
          className="status-bar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="status-dot" />
          <ScrambleText text="STATUS: MULTI-THREADED ONLINE" delay={500} />
        </motion.div>

        {/* 主标题 */}
        <motion.h1
          className="hero-title"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
        >
          <span className="line">
            <ScrambleText text="MAKER" delay={800} />
          </span>
          <span className="line">
            <ScrambleText text="SYS" delay={1000} />
            <span className="underscore">_</span>
            <ScrambleText text="ADMIN" delay={1200} />
          </span>
        </motion.h1>

        {/* 副标题 */}
        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
        >
          复合型物理与数字技术创客 / 全栈枢纽
        </motion.p>

        {/* 职业导航 */}
        <motion.nav
          className="career-nav"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 1.8 }}
        >
          {CAREERS.map((career, index) => (
            <motion.div
              key={career.id}
              className={`career-item ${activeCareer === career.id ? 'active' : ''}`}
              data-career={career.id}
              onMouseEnter={() => setActiveCareer(career.id)}
              onMouseLeave={() => setActiveCareer(null)}
              onClick={() => handleCareerClick(career.id)}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 2 + index * 0.15 }}
              whileHover={{ x: -10 }}
            >
              <div className="career-line" />
              <span className="career-label">{career.label}</span>
            </motion.div>
          ))}
        </motion.nav>

        {/* 滚动提示 */}
        <motion.div
          className="scroll-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.5 }}
        >
          <span>SCROLL DOWN TO REVEAL</span>
          <span className="arrow">CORE SKILLS ↓</span>
        </motion.div>
      </section>

      {/* ============================================
          3D 视窗区域
          ============================================ */}
      <section className="viewport-section">
        <div className="viewport-container">
          <Scene3D color={activeColor} />
          <div className="viewport-overlay" />
          <div className="viewport-label">
            LIVE 3D VIEWPORT // INTERACTIVE
          </div>
        </div>
      </section>

      {/* ============================================
          核心技能 Bento Grid
          ============================================ */}
      <section className="skills-section" id="skills">
        <div className="section-header">
          <motion.span
            className="section-tag"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            // CAPABILITIES MATRIX
          </motion.span>
          <motion.h2
            className="section-title"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <ScrambleText text="CORE SKILLS" delay={0} />
          </motion.h2>
        </div>

        <div className="bento-grid">
          {SKILLS_BENTO.map((skill, index) => (
            <motion.div
              key={skill.title}
              className={`bento-card ${skill.size}`}
              style={{ '--card-accent': skill.accent }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{
                duration: 0.6,
                delay: index * 0.1
              }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="bento-card-icon">{skill.icon}</div>
              <h3 className="bento-card-title">{skill.title}</h3>
              <p className="bento-card-desc">{skill.desc}</p>
              <div className="skill-tags">
                {skill.tags.map(tag => (
                  <span key={tag} className="skill-tag">{tag}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================
          页脚
          ============================================ */}
      <footer className="footer">
        <span className="footer-text">
          © 2024 MAKER_SYS_ADMIN // ALL SYSTEMS OPERATIONAL
        </span>
        <div className="footer-links">
          <a href="#" className="footer-link">GitHub</a>
          <a href="#" className="footer-link">LinkedIn</a>
          <a href="#" className="footer-link">Contact</a>
        </div>
      </footer>

      {/* ============================================
          职业详情转场面板
          ============================================ */}
      <AnimatePresence>
        {selectedCareerData && (
          <motion.div
            className="career-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleClosePanel}
          >
            <motion.div
              className="career-panel-content"
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.h2
                className="career-panel-title"
                style={{ color: selectedCareerData.color }}
                layoutId={`career-title-${selectedCareerData.id}`}
              >
                {selectedCareerData.title}
              </motion.h2>
              <p className="career-panel-desc">
                {selectedCareerData.description}
              </p>
              <div className="skill-tags" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
                {selectedCareerData.skills.map(skill => (
                  <span
                    key={skill}
                    className="skill-tag"
                    style={{ borderColor: selectedCareerData.color + '40' }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
              <button className="career-panel-close" onClick={handleClosePanel}>
                [ CLOSE PANEL ]
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
