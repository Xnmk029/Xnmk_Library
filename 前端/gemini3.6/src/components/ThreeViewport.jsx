import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Float, Sparkles, MeshWobbleMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { Maximize2, RefreshCw, Eye, Box, Cpu, Shield, Layers } from 'lucide-react';

// Custom 3D Mesh representing the selected Cyber Role
function Role3DMesh({ activeRoleId, color }) {
  const meshRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.4;
      meshRef.current.rotation.y += delta * 0.6;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z -= delta * 0.8;
      ring1Ref.current.rotation.x += delta * 0.3;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += delta * 0.7;
    }
  });

  const threeColor = new THREE.Color(color);

  return (
    <group>
      {/* Outer Rotating Cyber Rings */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[2.2, 0.03, 16, 100]} />
        <meshBasicMaterial color={threeColor} wireframe transparent opacity={0.6} />
      </mesh>

      <mesh ref={ring2Ref}>
        <torusGeometry args={[2.6, 0.02, 16, 100]} />
        <meshBasicMaterial color={threeColor} wireframe transparent opacity={0.35} />
      </mesh>

      {/* Role-Specific Core Geometry */}
      <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
        <mesh ref={meshRef}>
          {activeRoleId === 'ai' && (
            <dodecahedronGeometry args={[1.3, 0]} />
          )}
          {activeRoleId === 'bike' && (
            <torusKnotGeometry args={[0.9, 0.3, 100, 16]} />
          )}
          {activeRoleId === 'admin' && (
            <boxGeometry args={[1.5, 1.5, 1.5]} />
          )}
          {activeRoleId === '3d' && (
            <octahedronGeometry args={[1.4, 0]} />
          )}

          <meshStandardMaterial
            color={threeColor}
            wireframe
            emissive={threeColor}
            emissiveIntensity={0.8}
            roughness={0.2}
            metalness={0.9}
          />
        </mesh>
      </Float>

      {/* Inner Glowing Core */}
      <mesh>
        <sphereGeometry args={[0.6, 32, 32]} />
        <MeshWobbleMaterial
          color={threeColor}
          factor={0.4}
          speed={2}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Floating Sparkles & Particles */}
      <Sparkles
        count={70}
        scale={6}
        size={3}
        speed={0.8}
        opacity={0.8}
        color={color}
      />
    </group>
  );
}

export const ThreeViewport = ({ activeRoleId = 'ai', color = '#23ff00', roleTitle = 'AI PROMPT ENGINEER' }) => {
  const [wireframe, setWireframe] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="cyber-viewport-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* HUD Viewport Header */}
      <div className="viewport-hud-header">
        <div className="viewport-title-group">
          <span className="live-dot" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}></span>
          <span className="hud-label">LIVE 3D RENDER // {roleTitle}</span>
        </div>
        <div className="viewport-controls">
          <button
            className="hud-btn"
            title="Toggle View Mode"
            onClick={() => setWireframe(!wireframe)}
          >
            <Layers size={14} />
            <span>{wireframe ? 'WIREFRAME' : 'SOLID'}</span>
          </button>
          <div className="hud-badge-sm" style={{ borderColor: color, color: color }}>
            60 FPS // R3F ENGINE
          </div>
        </div>
      </div>

      {/* Three.js Canvas Container */}
      <div className="canvas-wrapper">
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 5.5]} fov={50} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} color={color} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ffffff" />
          
          <Role3DMesh activeRoleId={activeRoleId} color={color} />
          
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate={!isHovered}
            autoRotateSpeed={1.5}
          />
        </Canvas>

        {/* HUD Crosshair Corner Overlays */}
        <div className="hud-corner top-left"></div>
        <div className="hud-corner top-right"></div>
        <div className="hud-corner bottom-left"></div>
        <div className="hud-corner bottom-right"></div>

        {/* Viewport Info Overlay */}
        <div className="viewport-overlay-footer">
          <div className="hud-readout">
            <span className="dim">MESH:</span> POLYS [1,420]
          </div>
          <div className="hud-readout">
            <span className="dim">SHADER:</span> HUD_NEON_GLOW_V2
          </div>
          <div className="hud-readout">
            <span className="dim">STATUS:</span> OPERATIONAL
          </div>
        </div>
      </div>
    </div>
  );
};
