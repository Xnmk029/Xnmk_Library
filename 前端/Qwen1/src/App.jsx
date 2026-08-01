/* ═══════════════════════════════════════════════════════════
   NEXUS//OPERATOR — Main Application
   · ScrambleText: matrix-style glyph decode animation
   · HomeView: HUD status bar + profession selector rail
   · DetailView: layoutId seamless transition + 3D live viewport
   · BentoGrid: scroll-triggered skill matrix
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'
import CanvasBackground from './components/CanvasBackground'
import './App.css'

/* ─────────────────────────────────────────────
   DATA: Four Profession Cores
   ───────────────────────────────────────────── */
const PROFESSIONS = [
  {
    id: 'ai',
    index: '01',
    title: 'AI PROMPT ENGINEER',
    zh: 'AI 提示词专家',
    color: '#23ff00',
    colorDim: 'rgba(35,255,0,0.12)',
    tagline: 'LANGUAGE IS THE NEW COMPILER',
    desc: 'Architecting high-precision prompt systems for frontier LLMs. From chain-of-thought routing to multi-agent orchestration — turning natural language into deterministic execution pipelines with measurable eval coverage.',
    stats: [
      { label: 'PROMPT ARCHITECTURE', value: 92 },
      { label: 'MODEL EVALUATION', value: 88 },
      { label: 'RAG PIPELINES', value: 85 },
      { label: 'AGENT ORCHESTRATION', value: 90 }
    ],
    skills: [
      { name: 'System Prompt Design', level: 'S', span: 'wide', desc: 'Role anchoring, constraint lattices, output schema enforcement for production-grade system prompts.' },
      { name: 'Chain-of-Thought Routing', level: 'A', desc: 'Dynamic reasoning path selection with self-verification gates.' },
      { name: 'Few-Shot Calibration', level: 'A', desc: 'Example curation strategies that maximize in-context transfer.' },
      { name: 'Token Economics', level: 'B', desc: 'Latency/cost/quality Pareto optimization under budget constraints.' },
      { name: 'Eval Harness Engineering', level: 'S', span: 'wide', desc: 'Automated scoring rubrics, adversarial test batteries, regression detection across model versions.' },
      { name: 'Injection Defense', level: 'A', desc: 'Prompt injection taxonomy and layered sanitization protocols.' },
      { name: 'Multi-Agent Topology', level: 'S', desc: 'DAG-based agent coordination with failure isolation.' },
      { name: 'Context Window Strategy', level: 'A', desc: 'Compression, chunking, and retrieval-aware context packing.' }
    ]
  },
  {
    id: 'bike',
    index: '02',
    title: 'BICYCLE TECHNICIAN',
    zh: '单车工程技师',
    color: '#ffaa00',
    colorDim: 'rgba(255,170,0,0.12)',
    tagline: 'PRECISION IN EVERY ROTATION',
    desc: 'Full-spectrum bicycle engineering: electronic drivetrain calibration, hydraulic system surgery, carbon composite repair, and race-day suspension tuning. Millimeter tolerance, zero compromise.',
    stats: [
      { label: 'DRIVETRAIN TUNING', value: 95 },
      { label: 'WHEEL BUILDING', value: 91 },
      { label: 'SUSPENSION SETUP', value: 87 },
      { label: 'FRAME ALIGNMENT', value: 89 }
    ],
    skills: [
      { name: 'Electronic Shifting Calibration', level: 'S', span: 'wide', desc: 'Shimano Di2 / SRAM AXS firmware-level tuning, micro-index adjustment under load.' },
      { name: 'Hydraulic Brake Surgery', level: 'S', desc: 'Full bleed protocols, lever feel tuning, mineral oil vs DOT systems.' },
      { name: 'Carbon Frame Repair', level: 'A', desc: 'Delamination assessment, layup patch engineering, structural refinishing.' },
      { name: 'Suspension Tuning', level: 'A', span: 'wide', desc: 'Air spring curves, damper shim stacks, sag/rebound setup for rider weight and terrain profile.' },
      { name: 'Wheel Truing & Tension', level: 'S', desc: 'Sub-0.3mm lateral true, spoke tension histograms, stress-relief cycles.' },
      { name: 'Ceramic Bearing Service', level: 'B', desc: 'BB/headset ceramic upgrade paths, preload micro-adjustment.' },
      { name: 'Bike Fit Geometry', level: 'A', span: 'wide', desc: 'Motion-capture fit analysis, stack/reach optimization, cleat alignment.' },
      { name: 'E-Bike Diagnostics', level: 'A', desc: 'Motor firmware, battery health telemetry, torque sensor calibration.' }
    ]
  },
  {
    id: 'admin',
    index: '03',
    title: 'IT SYSTEMS ADMIN',
    zh: 'IT 系统管理员',
    color: '#00f0ff',
    colorDim: 'rgba(0,240,255,0.12)',
    tagline: 'UPTIME IS A LIFESTYLE',
    desc: 'Hardened infrastructure across bare-metal and cloud-native stacks. Zero-trust networking, immutable deployments, full observability. 99.99% uptime is the baseline, not the goal.',
    stats: [
      { label: 'LINUX INFRASTRUCTURE', value: 93 },
      { label: 'NETWORK ARCHITECTURE', value: 90 },
      { label: 'CONTAINER ORCHESTRATION', value: 88 },
      { label: 'SECURITY HARDENING', value: 91 }
    ],
    skills: [
      { name: 'Zero-Trust Network', level: 'S', span: 'wide', desc: 'mTLS mesh, identity-aware proxies, micro-segmentation across multi-site topology.' },
      { name: 'K8s Cluster Operations', level: 'A', desc: 'GitOps-driven lifecycle, etcd surgery, multi-tenancy isolation.' },
      { name: 'Bare-Metal Provisioning', level: 'A', desc: 'PXE/iPXE chains, firmware fleets, RAID/ZFS storage pools.' },
      { name: 'Observability Stack', level: 'S', span: 'wide', desc: 'Metrics/traces/logs unification — Prometheus, Tempo, Loki with SLO-based alert routing.' },
      { name: 'Disaster Recovery', level: 'S', desc: 'RPO/RTO engineering, cross-region replication, chaos-drill automation.' },
      { name: 'DNS / CDN Edge', level: 'A', desc: 'Anycast architecture, geo-steering, cache purge orchestration.' },
      { name: 'Hardened SSH Bastion', level: 'A', desc: 'Certificate-based auth, session recording, just-in-time access.' },
      { name: 'Automated Patching', level: 'B', desc: 'Canary rollout pipelines with kernel livepatch integration.' }
    ]
  },
  {
    id: 'level3d',
    index: '04',
    title: '3D LEVEL DESIGNER',
    zh: '3D 关卡设计师',
    color: '#ff0055',
    colorDim: 'rgba(255,0,85,0.12)',
    tagline: 'SPACE TELLS THE STORY',
    desc: 'Crafting playable space from graybox to gold master. Sightline choreography, pacing curves, modular kit architecture — every corridor is a sentence, every arena a paragraph in the player\'s journey.',
    stats: [
      { label: 'GRAYBOX ITERATION', value: 94 },
      { label: 'LIGHTING & MOOD', value: 89 },
      { label: 'GAMEPLAY FLOW', value: 92 },
      { label: 'PERFORMANCE BUDGET', value: 86 }
    ],
    skills: [
      { name: 'Environmental Storytelling', level: 'S', span: 'wide', desc: 'Diegetic narrative layering — props, decay, and light as plot devices.' },
      { name: 'Sightline Choreography', level: 'S', desc: 'Reveal timing, landmark hierarchy, player gaze steering.' },
      { name: 'Modular Kit Design', level: 'A', desc: 'Grid-locked kit pieces with seamless tiling and variation masks.' },
      { name: 'Collision & Navmesh', level: 'A', desc: 'AI pathing optimization, climbable surface authoring, physics QC.' },
      { name: 'LOD Strategy', level: 'S', span: 'wide', desc: 'HLOD chains, impostor swaps, draw-call budgeting for open-world streaming.' },
      { name: 'Shader-Based Mood', level: 'B', desc: 'Fog cards, god-ray placement, palette grading per zone.' },
      { name: 'Vertical Slice Pacing', level: 'A', desc: 'Tension curves, reward cadence, difficulty ramp authoring.' },
      { name: 'Engine Optimization', level: 'A', desc: 'Occlusion culling, instancing strategy, memory atlas planning.' }
    ]
  }
]

/* ─────────────────────────────────────────────
   ScrambleText — Matrix glyph decode effect
   ───────────────────────────────────────────── */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#@$%&01'

function ScrambleText({ text, className = '', speed = 2, delay = 0, trigger = true }) {
  const [display, setDisplay] = useState('')
  const frameRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!trigger) {
      setDisplay('')
      return
    }
    let frame = 0
    const totalFrames = text.length * speed + 20
    frameRef.current = 0

    const tick = () => {
      frame++
      if (frame < delay) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const progress = (frame - delay) / speed
      let out = ''
      for (let i = 0; i < text.length; i++) {
        if (i < progress) {
          out += text[i]
        } else if (i < progress + 6) {
          out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        } else {
          out += '\u00a0'
        }
      }
      setDisplay(out)
      if (frame < totalFrames) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(text)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [text, speed, delay, trigger])

  return <span className={`scramble-text ${className}`}>{display}</span>
}

/* ─────────────────────────────────────────────
   3D Viewport Scenes (per profession)
   ───────────────────────────────────────────── */
function NeuralCore({ color }) {
  const groupRef = useRef()
  const pointsRef = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(180 * 3)
    for (let i = 0; i < 180; i++) {
      const r = 0.9 + Math.random() * 0.7
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [])

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.15
    }
    if (pointsRef.current) pointsRef.current.rotation.y -= delta * 0.15
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.7} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.025} transparent opacity={0.8} sizeAttenuation />
      </points>
    </group>
  )
}

function WheelAssembly({ color }) {
  const groupRef = useRef()
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z -= delta * 1.2
      groupRef.current.rotation.x = 0.4 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  const spokes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 16; i++) {
      arr.push((i / 16) * Math.PI * 2)
    }
    return arr
  }, [])

  return (
    <group rotation={[0.4, 0, 0]}>
      <group ref={groupRef}>
        <mesh>
          <torusGeometry args={[1.4, 0.06, 8, 48]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.8} />
        </mesh>
        <mesh>
          <torusGeometry args={[1.15, 0.03, 6, 48]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.35} />
        </mesh>
        {spokes.map((angle, i) => (
          <mesh key={i} rotation={[0, 0, angle]}>
            <boxGeometry args={[2.3, 0.015, 0.015]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} />
          </mesh>
        ))}
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.3, 12]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  )
}

function ServerGrid({ color }) {
  const groupRef = useRef()
  const boxesRef = useRef([])

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.25
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.12
    }
    boxesRef.current.forEach((mesh, i) => {
      if (!mesh) return
      const pulse = Math.sin(state.clock.elapsedTime * 2.2 + i * 1.7) * 0.5 + 0.5
      mesh.material.opacity = 0.15 + pulse * 0.6
    })
  })

  const cells = useMemo(() => {
    const arr = []
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          arr.push([x * 0.72, y * 0.72, z * 0.72])
    return arr
  }, [])

  return (
    <group ref={groupRef}>
      {cells.map((pos, i) => (
        <mesh
          key={i}
          position={pos}
          ref={(el) => (boxesRef.current[i] = el)}
        >
          <boxGeometry args={[0.52, 0.52, 0.52]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[2.4, 2.4, 2.4]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

function LevelShard({ color }) {
  const groupRef = useRef()
  const shardsRef = useRef()

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3
    }
    if (shardsRef.current) {
      shardsRef.current.rotation.y -= delta * 0.5
      shardsRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.2
    }
  })

  const shards = useMemo(() => {
    const arr = []
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2
      arr.push({
        pos: [Math.cos(angle) * 1.9, Math.sin(angle * 2.3) * 0.5, Math.sin(angle) * 1.9],
        scale: 0.12 + Math.random() * 0.18,
        rot: [Math.random() * Math.PI, Math.random() * Math.PI, 0]
      })
    }
    return arr
  }, [])

  return (
    <group ref={groupRef}>
      <mesh>
        <dodecahedronGeometry args={[1.2, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[Math.PI / 5, 0.4, 0]}>
        <torusGeometry args={[1.7, 0.015, 4, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      <group ref={shardsRef}>
        {shards.map((s, i) => (
          <mesh key={i} position={s.pos} rotation={s.rot} scale={s.scale}>
            <tetrahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Viewport3D({ profession }) {
  const scene = useMemo(() => {
    switch (profession.id) {
      case 'ai': return NeuralCore
      case 'bike': return WheelAssembly
      case 'admin': return ServerGrid
      case 'level3d': return LevelShard
      default: return NeuralCore
    }
  }, [profession.id])

  const SceneObj = scene

  return (
    <div className="viewport-3d" style={{ borderColor: profession.colorDim }}>
      <div className="viewport-label mono">
        LIVE.RENDER // {profession.id.toUpperCase()}.OBJ
      </div>
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
      >
        <Float speed={1.6} rotationIntensity={0.2} floatIntensity={0.5}>
          <SceneObj color={profession.color} />
        </Float>
      </Canvas>
      <div className="viewport-corners">
        <i /><i /><i /><i />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   HUD Atoms
   ───────────────────────────────────────────── */
function StatusBar({ color }) {
  const [clock, setClock] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setClock(
        now.toTimeString().slice(0, 8) + '.' +
        String(now.getMilliseconds()).padStart(3, '0')
      )
    }
    update()
    const id = setInterval(update, 47)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="status-bar mono">
      <div className="status-left">
        <span className="status-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span>SYS.ONLINE</span>
        <span className="status-sep">//</span>
        <span>NEXUS-OS v4.2.1</span>
        <span className="status-sep">//</span>
        <span>UPLINK:STABLE</span>
      </div>
      <div className="status-right">
        <span style={{ color }}>{clock}</span>
        <span className="cursor-blink">█</span>
      </div>
    </header>
  )
}

function StatBar({ label, value, color, delay }) {
  return (
    <motion.div
      className="stat-row"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      <div className="stat-meta mono">
        <span>{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div className="stat-track">
        <motion.div
          className="stat-fill"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay: delay + 0.2, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="stat-ticks" />
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   HomeView — Profession Selector Rail
   ───────────────────────────────────────────── */
function HomeView({ onSelect, onHover, hovered }) {
  return (
    <motion.main
      className="home-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <div className="home-grid">
        {/* Left: Identity block */}
        <section className="identity-block">
          <motion.p
            className="mono identity-super"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ScrambleText text="MULTI-CLASS MAKER // SYSTEMS OPERATOR" delay={20} />
          </motion.p>

          <h1 className="identity-title display">
            <ScrambleText text="NEXUS" delay={45} speed={3} />
            <span className="title-slash">//</span>
            <ScrambleText text="OPERATOR" delay={70} speed={3} />
          </h1>

          <motion.div
            className="identity-desc"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            <p>
              四条职业主线，一个操作系统级人格。从神经网络的语言层到自行车的传动层，
              从数据中心的冷通道到游戏引擎的渲染管线——跨域整合是我的默认运行模式。
            </p>
            <p className="mono identity-hint">
              [ SELECT A PROFESSION MODULE TO INITIALIZE ]
            </p>
          </motion.div>

          <motion.div
            className="identity-metrics mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
          >
            <div className="metric">
              <span className="metric-value">04</span>
              <span className="metric-label">PROFESSIONS</span>
            </div>
            <div className="metric">
              <span className="metric-value">12+</span>
              <span className="metric-label">YRS.COMBINED</span>
            </div>
            <div className="metric">
              <span className="metric-value">∞</span>
              <span className="metric-label">CROSS-DOMAIN</span>
            </div>
          </motion.div>
        </section>

        {/* Right: Profession selector rail */}
        <nav className="profession-rail">
          {PROFESSIONS.map((p, i) => (
            <motion.button
              key={p.id}
              className={`profession-entry ${hovered === p.id ? 'is-hovered' : ''}`}
              style={{ '--p-color': p.color, '--p-dim': p.colorDim }}
              onClick={() => onSelect(p)}
              onMouseEnter={() => onHover(p.id)}
              onMouseLeave={() => onHover(null)}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="entry-index mono">{p.index}</span>
              <span className="entry-line">
                <i className="line-base" />
                <i className="line-glow" />
              </span>
              <span className="entry-text">
                <span className="entry-title display">{p.title}</span>
                <span className="entry-zh">{p.zh}</span>
              </span>
              <span className="entry-arrow mono">ENTER →</span>
            </motion.button>
          ))}
        </nav>
      </div>

      <footer className="home-footer mono">
        <span>LAT 31.2304 // LON 121.4737</span>
        <span className="footer-mid">SCROLL.WAVE.ACTIVE — MOVE CURSOR TO DISTURB FIELD</span>
        <span>BUILD 2026.07.21</span>
      </footer>
    </motion.main>
  )
}

/* ─────────────────────────────────────────────
   DetailView — Profession Module (layoutId transition)
   ───────────────────────────────────────────── */
function DetailView({ profession, onBack }) {
  const c = profession.color

  return (
    <motion.main
      className="detail-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30, filter: 'blur(6px)' }}
      transition={{ duration: 0.4 }}
    >
      {/* HUD frame — spring scale boot-in */}
      <motion.div
        className="detail-frame"
        style={{ borderColor: c }}
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <div className="frame-corners" style={{ '--fc': c }}>
          <i /><i /><i /><i />
        </div>

        {/* Header */}
        <header className="detail-header">
          <button className="back-btn mono" onClick={onBack}>
            ◄ EXIT.MODULE
          </button>
          <h2 className="detail-title display" style={{ color: c }}>
            <ScrambleText text={profession.title} speed={2} />
          </h2>
          <span className="detail-index mono">{profession.index} / 04</span>
        </header>

        {/* Core grid: 3D viewport + intel */}
        <div className="detail-core">
          {/* BISECT: <Viewport3D profession={profession} /> */}
          <div className="viewport-3d" style={{ borderColor: profession.colorDim, minHeight: 380 }}>
            <div className="viewport-label mono">PLACEHOLDER</div>
          </div>

          <section className="detail-intel">
            <p className="detail-tagline mono" style={{ color: c }}>
              <ScrambleText text={`"${profession.tagline}"`} delay={15} />
            </p>
            <p className="detail-desc">{profession.desc}</p>
            <div className="detail-stats">
              <h3 className="section-label mono">CORE.METRICS</h3>
              {profession.stats.map((s, i) => (
                <StatBar
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  color={c}
                  delay={0.3 + i * 0.12}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Bento skill matrix */}
        <section className="skill-matrix">
          <h3 className="section-label mono">
            SKILL.MATRIX <span className="label-dim">// {profession.zh}</span>
          </h3>
          <div className="bento-grid">
            {profession.skills.map((skill, i) => (
              <motion.article
                key={skill.name}
                className={`bento-cell ${skill.span === 'wide' ? 'bento-wide' : ''}`}
                style={{ '--p-color': c, '--p-dim': profession.colorDim }}
                initial={{ opacity: 0, y: 32, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: (i % 4) * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="cell-top">
                  <span className="cell-level mono" style={{ color: c, borderColor: c }}>
                    {skill.level}
                  </span>
                  <span className="cell-id mono">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h4 className="cell-name">{skill.name}</h4>
                <p className="cell-desc">{skill.desc}</p>
                <div className="cell-bar">
                  <motion.i
                    style={{ background: c }}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.7 }}
                  />
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      </motion.div>
    </motion.main>
  )
}

/* ─────────────────────────────────────────────
   Boot Sequence Overlay
   ───────────────────────────────────────────── */
function BootOverlay({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="boot-overlay mono"
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <div className="boot-lines">
        <ScrambleText text="> NEXUS-OS KERNEL 4.2.1 — COLD BOOT" speed={1} />
        <br />
        <ScrambleText text="> MOUNTING PROFESSION MODULES... [OK]" speed={1} delay={18} />
        <br />
        <ScrambleText text="> CALIBRATING NEON SPECTRUM... [OK]" speed={1} delay={36} />
        <br />
        <ScrambleText text="> FIELD RENDERER: 250 STREAMLINES ACTIVE" speed={1} delay={54} />
        <br />
        <ScrambleText text="> INTERFACE READY_" speed={1} delay={72} />
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   App Root
   ───────────────────────────────────────────── */
export default function App() {
  const [booted, setBooted] = useState(false)
  const [active, setActive] = useState(null)
  const [hovered, setHovered] = useState(null)

  const displayColor = active?.color
    || PROFESSIONS.find((p) => p.id === hovered)?.color
    || '#00f0ff'

  const intensity = active ? 0.85 : hovered ? 0.55 : 0.3

  return (
    <div className="app" style={{ '--accent': displayColor }}>
      <CanvasBackground color={displayColor} intensity={intensity} />
      <div className="scanline-overlay" aria-hidden="true" />

      <AnimatePresence>
        {!booted && <BootOverlay onDone={() => setBooted(true)} />}
      </AnimatePresence>

      {booted && (
        <>
          <StatusBar color={displayColor} />
          <AnimatePresence mode="wait">
            {active === null ? (
              <HomeView
                key="home"
                onSelect={(p) => setActive(p)}
                onHover={setHovered}
                hovered={hovered}
              />
            ) : (
              <DetailView
                key={active.id}
                profession={active}
                onBack={() => setActive(null)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
