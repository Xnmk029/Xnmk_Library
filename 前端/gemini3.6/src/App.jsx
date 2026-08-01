import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Wrench, Server, Box, Volume2, VolumeX, Cpu, Activity, Shield, Terminal as TerminalIcon,
  ChevronRight, ExternalLink, Code2, Sparkles, Layers, RefreshCw, Zap
} from 'lucide-react';
import { CanvasBackground } from './components/CanvasBackground';
import { ScrambleText } from './components/ScrambleText';
import { ThreeViewport } from './components/ThreeViewport';
import { RoleDetailModal } from './components/RoleDetailModal';
import { cyberAudio } from './utils/audio';

import './index.css';
import './App.css';

// 4 Main Cyber Roles Data Definition
const ROLES = [
  {
    id: 'ai',
    title: 'AI PROMPT ENGINEER',
    subtitle: 'LLM Fine-tuning & System Prompt Architecture',
    color: '#23ff00',
    icon: <Bot size={22} />,
    description: 'Specializing in high-density prompt engineering, RAG pipeline architecture, synthetic data generation, and LLM behavior alignment with zero-hallucination protocols.',
    skills: ['GPT-4o / Claude 3.5', 'RAG Vectors (Chroma/Pinecone)', 'System Prompting', 'Few-Shot Chain of Thought', 'Python / PyTorch'],
    timeline: [
      { year: '2025 - PRESENT', title: 'Lead Prompt Architect @ CyberAI Lab', desc: 'Designed multi-agent auto-eval workflows reducing LLM latency by 45%.' },
      { year: '2024', title: 'RAG Pipeline Engineer @ VectorMesh', desc: 'Constructed hybrid vector retrieval system handling 2M+ docs daily.' }
    ]
  },
  {
    id: 'bike',
    title: 'BICYCLE TECHNICIAN',
    subtitle: 'Custom Frame Geometry & Precision Mechanical Engineering',
    color: '#ffaa00',
    icon: <Wrench size={22} />,
    description: 'Master mechanic in high-end road/enduro bicycles, carbon fiber torque tolerance, mineral oil hydraulic brake bleeding, and custom hand-built wheel tensioning.',
    skills: ['Shimano Di2 / SRAM AXS', 'Hydraulic Bleeding', 'Carbon Fiber Repair', 'Custom Wheel Lacing', 'Frame Geometry Optimization'],
    timeline: [
      { year: '2023 - PRESENT', title: 'Senior Race Tech @ Velospeed Workshop', desc: 'Maintained pro-peloton carbon race frames & electronic shifting.' },
      { year: '2022', title: 'Custom Builder @ AeroCraft Cycles', desc: 'Engineered custom internal routing cockpits and wheelsets.' }
    ]
  },
  {
    id: 'admin',
    title: 'IT SYSTEMS ADMIN',
    subtitle: 'Proxmox Clusters, Kubernetes Mesh & Network Topology',
    color: '#00f0ff',
    icon: <Server size={22} />,
    description: 'Managing high-availability homelabs, Linux hypervisors, containerized microservices, WireGuard VPN meshes, and automated Ansible deployment playbooks.',
    skills: ['Proxmox VE Cluster', 'Docker & Kubernetes', 'Ansible / Terraform', 'WireGuard VPN', 'Nginx Reverse Proxy', 'ZFS / TrueNAS'],
    timeline: [
      { year: '2023 - PRESENT', title: 'Infrastructure Admin @ DataNet Systems', desc: 'Managed 99.99% uptime for 64-node bare-metal hypervisor cluster.' },
      { year: '2021', title: 'Network Security Ops @ CyberShield', desc: 'Deployed zero-trust mesh networks and automated backup vaults.' }
    ]
  },
  {
    id: '3d',
    title: '3D LEVEL DESIGNER',
    subtitle: 'Unreal Engine 5 Lumen/Nanite & Spatial Lighting',
    color: '#ff0055',
    icon: <Box size={22} />,
    description: 'Crafting immersive sci-fi environments, volumetric lighting setups, spatial level pacing, Nanite mesh blockouts, and interactive gameplay trigger mechanics.',
    skills: ['Unreal Engine 5', 'Blender 3D Blockout', 'Lumen & Volumetric Fog', 'Substance Painter', 'Environmental Storytelling'],
    timeline: [
      { year: '2024 - PRESENT', title: 'Level Environment Lead @ NeonRealm Games', desc: 'Designed Cyberpunk city blockouts and interactive spatial triggers.' },
      { year: '2022', title: '3D Environment Artist @ FX Studios', desc: 'Created PBR materials and hard-surface prop libraries.' }
    ]
  }
];

export default function App() {
  const [activeRole, setActiveRole] = useState(ROLES[0]);
  const [hoveredRole, setHoveredRole] = useState(null);
  const [modalRole, setModalRole] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  // Live Clocks
  const [localTime, setLocalTime] = useState('');
  const [utcTime, setUtcTime] = useState('');

  // Terminal State
  const [terminalHistory, setTerminalHistory] = useState([
    { text: 'CYBER_CORE OS v3.6.0 [INITIALIZED]', type: 'system' },
    { text: 'Type "help" or "skills" for command index.', type: 'info' }
  ]);
  const [terminalInput, setTerminalInput] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLocalTime(now.toLocaleTimeString('en-US', { hour12: false }));
      setUtcTime(now.toUTCString().split(' ')[4] + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentThemeColor = hoveredRole ? hoveredRole.color : activeRole.color;

  const handleRoleHover = (role) => {
    setHoveredRole(role);
    cyberAudio.playHover();
  };

  const handleRoleSelect = (role) => {
    setActiveRole(role);
    cyberAudio.playRoleSelect(role.color);
  };

  const handleOpenModal = (role, e) => {
    e.stopPropagation();
    cyberAudio.playClick();
    setModalRole(role);
  };

  const handleToggleMute = () => {
    const muted = cyberAudio.toggleMute();
    setIsMuted(muted);
  };

  // Terminal Command Parser
  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim().toLowerCase();
    const newLogs = [...terminalHistory, { text: `> ${terminalInput}`, type: 'user' }];

    if (cmd === 'help') {
      newLogs.push({ text: 'AVAILABLE COMMANDS: help, skills, roles, clear, status, matrix', type: 'system' });
    } else if (cmd === 'skills') {
      newLogs.push({ text: 'CORE STACK: Python, PyTorch, React, Three.js, Docker, K8s, UE5, Shimano AXS', type: 'info' });
    } else if (cmd === 'roles') {
      newLogs.push({ text: 'ACTIVE MODULES: AI_PROMPT, BICYCLE_TECH, SYS_ADMIN, 3D_LEVEL_DESIGN', type: 'info' });
    } else if (cmd === 'clear') {
      setTerminalHistory([]);
      setTerminalInput('');
      return;
    } else if (cmd === 'status') {
      newLogs.push({ text: 'SYSTEM STATUS: 100% OPERATIONAL // ALL NODES LINKED', type: 'green' });
    } else {
      newLogs.push({ text: `Command not recognized: "${cmd}". Type "help" for options.`, type: 'error' });
    }

    cyberAudio.playClick();
    setTerminalHistory(newLogs);
    setTerminalInput('');
  };

  return (
    <div className="app-container">
      {/* Dynamic 250 Bezier Lines Canvas Background */}
      <CanvasBackground activeColor={currentThemeColor} activeOpacity={0.4} />

      {/* ==================== HUD TOP HEADER ==================== */}
      <header className="hud-header">
        <div className="hud-header-left">
          <div className="logo-symbol">
            <Zap size={20} /> CYBER_CORE // 3.6
          </div>
          <div className="sys-tag">SYS_ADMIN_HUD</div>
        </div>

        <div className="hud-header-right">
          <div className="hud-stat-item">
            <span className="text-dim">LOCAL:</span> {localTime}
          </div>
          <div className="hud-stat-item">
            <span className="text-dim">UTC:</span> {utcTime}
          </div>
          <div className="hud-stat-item">
            <span className="text-dim">LINK:</span> <span className="text-green">ONLINE</span>
          </div>
          <button className="audio-toggle-btn" onClick={handleToggleMute}>
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{isMuted ? 'MUTED' : 'AUDIO_ON'}</span>
          </button>
        </div>
      </header>

      {/* ==================== HERO & ROLE MATRIX ==================== */}
      <section className="hero-section">
        <div className="hero-sub-title">
          <ScrambleText text="// MULTI-DISCIPLINARY MAKER & SYSTEMS ADMIN" />
        </div>
        <h1 className="hero-main-title">
          INTERACTIVE CYBER PORTFOLIO
        </h1>
        <p className="hero-bio">
          Bridging physical hardware engineering with advanced LLM prompt architecture, bare-metal server infrastructure, and real-time 3D spatial design.
        </p>

        {/* 4 ROLES SELECTION MATRIX */}
        <div className="roles-matrix-container">
          {ROLES.map((role) => {
            const isSelected = activeRole.id === role.id;
            const isHovered = hoveredRole?.id === role.id;

            return (
              <div
                key={role.id}
                className={`role-card-item ${isSelected ? 'active' : ''}`}
                style={{
                  '--card-color': role.color,
                  borderColor: isSelected || isHovered ? role.color : 'rgba(255,255,255,0.12)',
                  boxShadow: isSelected || isHovered ? `0 0 25px ${role.color}44` : 'none'
                }}
                onMouseEnter={() => handleRoleHover(role)}
                onMouseLeave={() => setHoveredRole(null)}
                onClick={() => handleRoleSelect(role)}
              >
                <div className="role-card-header">
                  <div
                    className="role-icon-box"
                    style={{ color: role.color, borderColor: isSelected ? role.color : 'rgba(255,255,255,0.15)' }}
                  >
                    {role.icon}
                  </div>
                  <span className="role-tag">0{ROLES.indexOf(role) + 1} // SYS</span>
                </div>

                <div className="role-card-title" style={{ color: isSelected || isHovered ? role.color : '#ffffff' }}>
                  <ScrambleText text={role.title} autoStart={isSelected} scrambleOnHover={true} />
                </div>

                <div className="role-card-sub">{role.subtitle}</div>

                <div className="role-card-footer">
                  <span className="text-dim">CLICK TO ACTIVATE</span>
                  <button
                    className="enter-link"
                    style={{ color: role.color }}
                    onClick={(e) => handleOpenModal(role, e)}
                  >
                    SPEC_SHEET <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== 3D RENDER & QUICK STATS DASHBOARD ==================== */}
      <section className="main-dashboard-grid">
        {/* Three.js Live Render Viewport */}
        <ThreeViewport
          activeRoleId={activeRole.id}
          color={currentThemeColor}
          roleTitle={activeRole.title}
        />

        {/* Live System Stats Side Panel */}
        <div className="stats-panel-card" style={{ borderColor: `${currentThemeColor}44` }}>
          <div className="panel-header">
            <span className="title" style={{ color: currentThemeColor }}>
              <Activity size={16} /> SYSTEM TELEMETRY
            </span>
            <span className="hud-badge-sm text-green">LIVE</span>
          </div>

          <div className="stat-row-item">
            <div className="stat-label-group">
              <span className="text-dim">ACTIVE PROFILE:</span>
              <span style={{ color: currentThemeColor }}>{activeRole.id.toUpperCase()}</span>
            </div>
          </div>

          <div className="stat-row-item">
            <div className="stat-label-group">
              <span>CPU COMPUTE LOAD</span>
              <span style={{ color: currentThemeColor }}>38%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: '38%', backgroundColor: currentThemeColor }}></div>
            </div>
          </div>

          <div className="stat-row-item">
            <div className="stat-label-group">
              <span>MEMORY (PROXMOX CLUSTER)</span>
              <span style={{ color: currentThemeColor }}>64%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: '64%', backgroundColor: currentThemeColor }}></div>
            </div>
          </div>

          <div className="stat-row-item">
            <div className="stat-label-group">
              <span>LLM PROMPT TOKEN SPEED</span>
              <span style={{ color: currentThemeColor }}>142 T/s</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: '85%', backgroundColor: currentThemeColor }}></div>
            </div>
          </div>

          <div className="stat-row-item">
            <div className="stat-label-group">
              <span>MECHANICAL TORQUE PRESET</span>
              <span style={{ color: currentThemeColor }}>5.5 Nm</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: '55%', backgroundColor: currentThemeColor }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== BENTO GRID SKILLS & TERMINAL ==================== */}
      <section className="bento-section">
        <div className="section-title-bar">
          <h2>
            <ScrambleText text="// BENTO_GRID SKILLS & TERMINAL" />
          </h2>
          <span className="hud-tag" style={{ color: currentThemeColor }}>MODULE_INDEX</span>
        </div>

        <div className="bento-grid">
          {/* Card 1: Active Role Deep Dive Preview */}
          <div className="bento-card span-2" style={{ borderColor: `${activeRole.color}44` }}>
            <div className="bento-card-title" style={{ color: activeRole.color }}>
              {activeRole.icon} ACTIVE MODULE: {activeRole.title}
            </div>
            <p className="bento-card-desc">{activeRole.description}</p>

            <div className="project-tech-stack">
              {activeRole.skills.map((skill, i) => (
                <span key={i} className="tech-badge" style={{ borderColor: `${activeRole.color}55`, color: activeRole.color }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Card 2: Interactive Cyber Command Terminal */}
          <div className="bento-card">
            <div className="bento-card-title text-cyan">
              <TerminalIcon size={18} /> INTERACTIVE TERMINAL
            </div>

            <div className="cyber-terminal">
              {terminalHistory.map((item, index) => (
                <div key={index} className={`terminal-line ${item.type}`}>
                  {item.text}
                </div>
              ))}

              <form onSubmit={handleTerminalSubmit} className="terminal-input-row">
                <span className="terminal-prompt">&gt;</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder="type command..."
                  className="terminal-input"
                />
              </form>
            </div>
          </div>

          {/* Card 3: Featured Cyber Project 1 */}
          <div className="bento-card">
            <div className="bento-card-title">
              <Bot size={18} style={{ color: '#23ff00' }} /> RAG Matrix Agent
            </div>
            <p className="bento-card-desc">
              Autonomous LLM knowledge indexer with hybrid vector search and local Llama-3 quantization.
            </p>
            <div className="project-tech-stack">
              <span className="tech-badge">Python</span>
              <span className="tech-badge">LangChain</span>
              <span className="tech-badge">ChromaDB</span>
            </div>
          </div>

          {/* Card 4: Featured Cyber Project 2 */}
          <div className="bento-card">
            <div className="bento-card-title">
              <Server size={18} style={{ color: '#00f0ff' }} /> Homelab Proxmox Mesh
            </div>
            <p className="bento-card-desc">
              Zero-trust WireGuard mesh infrastructure with automated Ansible deployment scripts.
            </p>
            <div className="project-tech-stack">
              <span className="tech-badge">Proxmox</span>
              <span className="tech-badge">Ansible</span>
              <span className="tech-badge">WireGuard</span>
            </div>
          </div>

          {/* Card 5: Featured Cyber Project 3 */}
          <div className="bento-card">
            <div className="bento-card-title">
              <Box size={18} style={{ color: '#ff0055' }} /> UE5 Cyber District
            </div>
            <p className="bento-card-desc">
              Photorealistic dystopian street level blockout featuring Lumen spatial lighting & procedural fog.
            </p>
            <div className="project-tech-stack">
              <span className="tech-badge">Unreal 5</span>
              <span className="tech-badge">Lumen</span>
              <span className="tech-badge">Blender</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== ROLE DETAIL INTERACTIVE MODAL ==================== */}
      {modalRole && (
        <RoleDetailModal
          role={modalRole}
          onClose={() => setModalRole(null)}
        />
      )}
    </div>
  );
}
