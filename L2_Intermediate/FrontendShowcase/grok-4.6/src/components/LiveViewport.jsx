import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

function Nodes({ color }) {
  const group = useRef()
  const count = 18
  const positions = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      arr.push([Math.cos(a) * 1.35, Math.sin(a * 1.7) * 0.45, Math.sin(a) * 1.35])
    }
    return arr
  }, [])

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.35
  })

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.7} roughness={0.25} wireframe />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#050507" emissive={color} emissiveIntensity={0.35} metalness={0.4} roughness={0.4} />
      </mesh>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Gears({ color }) {
  const a = useRef()
  const b = useRef()
  const c = useRef()
  useFrame((_, dt) => {
    if (a.current) a.current.rotation.z += dt * 0.6
    if (b.current) b.current.rotation.z -= dt * 0.85
    if (c.current) c.current.rotation.y += dt * 0.4
  })
  return (
    <group>
      <mesh ref={a} position={[-0.55, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.08, 12, 28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh ref={b} position={[0.55, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.07, 12, 22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh ref={c}>
        <cylinderGeometry args={[0.18, 0.18, 0.22, 16]} />
        <meshStandardMaterial color="#1a1208" emissive={color} emissiveIntensity={0.2} metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Racks({ color }) {
  const group = useRef()
  const lights = useRef([])
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.35
    lights.current.forEach((m, i) => {
      if (!m) return
      const pulse = (Math.sin(state.clock.elapsedTime * 3 + i * 1.7) + 1) * 0.5
      m.material.emissiveIntensity = 0.2 + pulse * 1.4
    })
  })
  const boxes = []
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      boxes.push([x * 0.55, y * 0.42, 0])
    }
  }
  return (
    <group ref={group}>
      {boxes.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <boxGeometry args={[0.42, 0.32, 0.22]} />
            <meshStandardMaterial color="#0a1218" metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.12} />
          </mesh>
          <mesh ref={(el) => { lights.current[i] = el }} position={[0.14, 0.08, 0.12]}>
            <boxGeometry args={[0.06, 0.04, 0.02]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function District({ color }) {
  const group = useRef()
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.22
  })
  return (
    <group ref={group}>
      <mesh position={[-0.7, -0.35, 0.2]}>
        <boxGeometry args={[0.7, 0.9, 0.5]} />
        <meshStandardMaterial color="#1a0a10" emissive={color} emissiveIntensity={0.25} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0.15, -0.1, -0.15]}>
        <boxGeometry args={[0.55, 1.4, 0.45]} />
        <meshStandardMaterial color="#12060a" emissive={color} emissiveIntensity={0.35} metalness={0.5} roughness={0.35} wireframe />
      </mesh>
      <mesh position={[0.75, -0.45, 0.1]}>
        <boxGeometry args={[0.4, 0.7, 0.4]} />
        <meshStandardMaterial color="#1a0a10" emissive={color} emissiveIntensity={0.2} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0.15, 0.85, -0.15]} rotation={[0, 0.4, 0]}>
        <coneGeometry args={[0.22, 0.4, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} metalness={0.6} roughness={0.25} />
      </mesh>
      <gridHelper args={[4.5, 12, color, '#1a1a22']} position={[0, -0.85, 0]} />
    </group>
  )
}

function Scene({ careerId, color }) {
  return (
    <>
      <color attach="background" args={['#050507']} />
      <fog attach="fog" args={['#050507', 4.5, 9]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[2.4, 2.2, 3]} intensity={5} color={color} distance={12} />
      <pointLight position={[-2.5, -1.2, 2]} intensity={2.2} color={color} distance={10} />
      <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.35}>
        {careerId === 'ai' && <Nodes color={color} />}
        {careerId === 'bike' && <Gears color={color} />}
        {careerId === 'it' && <Racks color={color} />}
        {careerId === 'level' && <District color={color} />}
      </Float>
    </>
  )
}

export default function LiveViewport({ careerId, color }) {
  return (
    <div className="live-viewport">
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 0.35, 4.2], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <Scene careerId={careerId} color={color} />
      </Canvas>
    </div>
  )
}
