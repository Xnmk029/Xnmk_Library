import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, Cpu, Zap, Activity, CheckCircle, Sliders, ShieldAlert, Wrench, Layers, Server } from 'lucide-react';
import { ScrambleText } from './ScrambleText';
import { cyberAudio } from '../utils/audio';

export const RoleDetailModal = ({ role, onClose }) => {
  if (!role) return null;

  // State for interactive mini-tools inside modals
  const [promptInput, setPromptInput] = useState('Build a cyberpunk HUD interface with high-density data metrics.');
  const [temperature, setTemperature] = useState(0.7);
  const [frontTeeth, setFrontTeeth] = useState(50);
  const [rearTeeth, setRearTeeth] = useState(14);
  const [cadence, setCadence] = useState(90);

  // Server admin node simulation state
  const [nodes, setNodes] = useState([
    { id: 'node-01', name: 'PROXMOX-ALPHA', status: 'ONLINE', cpu: 24, ram: 42 },
    { id: 'node-02', name: 'K8S-WORKER-01', status: 'ONLINE', cpu: 68, ram: 79 },
    { id: 'node-03', name: 'STORAGE-NAS-01', status: 'ONLINE', cpu: 12, ram: 31 },
    { id: 'node-04', name: 'AI-LLM-INFERENCE', status: 'BUSY', cpu: 91, ram: 88 },
  ]);

  // 3D Level lighting state
  const [fogDensity, setFogDensity] = useState(65);
  const [bloom, setBloom] = useState(80);

  const calculatedRatio = (frontTeeth / rearTeeth).toFixed(2);
  const calculatedSpeed = ((frontTeeth / rearTeeth) * (cadence * 60 * 2.1) / 1000).toFixed(1);

  const toggleNodeStatus = (index) => {
    cyberAudio.playClick();
    setNodes(prev => prev.map((n, i) => {
      if (i === index) {
        const nextStatus = n.status === 'ONLINE' ? 'MAINTENANCE' : 'ONLINE';
        return { ...n, status: nextStatus };
      }
      return n;
    }));
  };

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
        <motion.div
          className="cyber-modal-card"
          style={{ borderColor: role.color, boxShadow: `0 0 30px ${role.color}33` }}
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="modal-header" style={{ borderBottomColor: `${role.color}44` }}>
            <div className="modal-title-group">
              <span className="role-icon-badge" style={{ backgroundColor: `${role.color}22`, color: role.color }}>
                {role.icon}
              </span>
              <div>
                <div className="hud-tag" style={{ color: role.color }}>SYS_MODULE // 0{role.id}</div>
                <h2 style={{ color: role.color }}>
                  <ScrambleText text={role.title} autoStart={true} />
                </h2>
              </div>
            </div>
            <button
              className="modal-close-btn"
              style={{ color: role.color }}
              onClick={() => {
                cyberAudio.playClick();
                onClose();
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="modal-body">
            {/* Overview & Specialization */}
            <div className="modal-section">
              <h3 className="section-label">
                <Terminal size={14} /> CORE MATRIX & DESCRIPTION
              </h3>
              <p className="role-description-text">{role.description}</p>

              <div className="skills-tag-list">
                {role.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="skill-pill"
                    style={{ borderColor: `${role.color}66`, backgroundColor: `${role.color}11`, color: role.color }}
                  >
                    #{skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Interactive Role Tool Sub-Panel */}
            <div className="modal-section tool-panel" style={{ borderColor: `${role.color}44` }}>
              <h3 className="section-label" style={{ color: role.color }}>
                <Zap size={14} /> INTERACTIVE {role.id.toUpperCase()}_SIMULATOR
              </h3>

              {/* AI Tool */}
              {role.id === 'ai' && (
                <div className="interactive-tool-box">
                  <div className="input-group">
                    <label>PROMPT INPUT / TASK PARAMETER:</label>
                    <input
                      type="text"
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      className="cyber-input"
                    />
                  </div>
                  <div className="slider-group">
                    <div className="slider-label">
                      <span>TEMPERATURE SAMPLING: {temperature}</span>
                      <span className="dim">OPTIMAL: 0.7</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.5"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="cyber-range"
                      style={{ accentColor: role.color }}
                    />
                  </div>
                  <div className="output-console">
                    <div className="console-line text-green">&gt; SYSTEM_PROMPT_GENERATED:</div>
                    <div className="console-output">
                      `[ROLE: SYSTEM_EXPERT] Context: {promptInput} | Temp: {temperature} | Matrix Output: Structured JSON payload with zero hallucination enforcement.`
                    </div>
                    <div className="token-counter">EST. TOKENS: {promptInput.length * 4 + 120} // COST: $0.0004</div>
                  </div>
                </div>
              )}

              {/* Bicycle Tech Tool */}
              {role.id === 'bike' && (
                <div className="interactive-tool-box">
                  <div className="sliders-grid">
                    <div className="slider-group">
                      <label>FRONT CHAINRING TEETH: {frontTeeth}T</label>
                      <input
                        type="range"
                        min="30"
                        max="56"
                        value={frontTeeth}
                        onChange={(e) => setFrontTeeth(parseInt(e.target.value))}
                        className="cyber-range"
                        style={{ accentColor: role.color }}
                      />
                    </div>
                    <div className="slider-group">
                      <label>REAR CASSETTE TEETH: {rearTeeth}T</label>
                      <input
                        type="range"
                        min="10"
                        max="36"
                        value={rearTeeth}
                        onChange={(e) => setRearTeeth(parseInt(e.target.value))}
                        className="cyber-range"
                        style={{ accentColor: role.color }}
                      />
                    </div>
                    <div className="slider-group">
                      <label>PEDALING CADENCE: {cadence} RPM</label>
                      <input
                        type="range"
                        min="50"
                        max="130"
                        value={cadence}
                        onChange={(e) => setCadence(parseInt(e.target.value))}
                        className="cyber-range"
                        style={{ accentColor: role.color }}
                      />
                    </div>
                  </div>
                  <div className="calc-metrics-grid">
                    <div className="metric-card">
                      <span className="label">GEAR RATIO</span>
                      <span className="value" style={{ color: role.color }}>{calculatedRatio} : 1</span>
                    </div>
                    <div className="metric-card">
                      <span className="label">EST. VELOCITY</span>
                      <span className="value" style={{ color: role.color }}>{calculatedSpeed} km/h</span>
                    </div>
                  </div>
                </div>
              )}

              {/* IT Systems Admin Tool */}
              {role.id === 'admin' && (
                <div className="interactive-tool-box">
                  <div className="nodes-list">
                    {nodes.map((node, index) => (
                      <div key={node.id} className="node-row">
                        <div className="node-info">
                          <Server size={14} style={{ color: role.color }} />
                          <span className="node-name">{node.name}</span>
                        </div>
                        <div className="node-meters">
                          <span className="dim">CPU: {node.cpu}%</span>
                          <span className="dim">RAM: {node.ram}%</span>
                        </div>
                        <button
                          className={`node-status-badge ${node.status.toLowerCase()}`}
                          onClick={() => toggleNodeStatus(index)}
                        >
                          {node.status}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3D Level Designer Tool */}
              {role.id === '3d' && (
                <div className="interactive-tool-box">
                  <div className="slider-group">
                    <label>VOLUMETRIC FOG DENSITY: {fogDensity}%</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={fogDensity}
                      onChange={(e) => setFogDensity(parseInt(e.target.value))}
                      className="cyber-range"
                      style={{ accentColor: role.color }}
                    />
                  </div>
                  <div className="slider-group">
                    <label>LUMEN BLOOM INTENSITY: {bloom}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={bloom}
                      onChange={(e) => setBloom(parseInt(e.target.value))}
                      className="cyber-range"
                      style={{ accentColor: role.color }}
                    />
                  </div>
                  <div className="lighting-preview" style={{ filter: `blur(${(100 - fogDensity) / 20}px)` }}>
                    <div
                      className="glow-orb"
                      style={{
                        backgroundColor: role.color,
                        boxShadow: `0 0 ${bloom * 0.8}px ${role.color}`
                      }}
                    ></div>
                    <span className="dim">REAL-TIME SHADER LIGHTING SIMULATION</span>
                  </div>
                </div>
              )}
            </div>

            {/* Experience & Milestones Timeline */}
            <div className="modal-section">
              <h3 className="section-label">
                <Activity size={14} /> FIELD EXPERIENCE & DEPLOYMENTS
              </h3>
              <div className="timeline-list">
                {role.timeline.map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-dot" style={{ backgroundColor: role.color }}></div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-year" style={{ color: role.color }}>{item.year}</span>
                        <span className="timeline-title">{item.title}</span>
                      </div>
                      <p className="timeline-desc">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer" style={{ borderTopColor: `${role.color}33` }}>
            <div className="hud-readout">
              <span className="dim">STATUS:</span> MODULE ACTIVE
            </div>
            <button
              className="action-btn"
              style={{ backgroundColor: role.color, color: '#050507' }}
              onClick={() => {
                cyberAudio.playClick();
                onClose();
              }}
            >
              DISMISS INTERFACE
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
