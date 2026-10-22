import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* -------------------------------------------------------------------------
   Four neon wireframe scenes — one per class. Everything is drawn with
   additive LineBasicMaterial / PointsMaterial / MeshBasicMaterial: no lights,
   no textures, no network assets — so the viewport stays cheap and always
   reads as "neon", whatever the active theme colour is.
   ------------------------------------------------------------------------- */

const UNIT_BOX_EDGES = (() => {
  const v = [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, -0.5, 0.5],
    [-0.5, -0.5, 0.5],
    [-0.5, 0.5, -0.5],
    [0.5, 0.5, -0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ];
  const e = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const arr = new Float32Array(e.length * 6);
  e.forEach(([a, b], i) => {
    arr.set(v[a], i * 6);
    arr.set(v[b], i * 6 + 3);
  });
  return arr;
})();

function useGeometry(positions) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  useEffect(() => () => geom.dispose(), [geom]);
  return geom;
}

function useBoxEdgeGeometry() {
  return useGeometry(UNIT_BOX_EDGES);
}

function ringPositions(radius, segments) {
  const arr = new Float32Array(segments * 6);
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    arr.set([Math.cos(a0) * radius, Math.sin(a0) * radius, 0], i * 6);
    arr.set([Math.cos(a1) * radius, Math.sin(a1) * radius, 0], i * 6 + 3);
  }
  return arr;
}

const neon = (color, opacity) => (
  <lineBasicMaterial
    color={color}
    transparent
    opacity={opacity}
    blending={THREE.AdditiveBlending}
    depthWrite={false}
    toneMapped={false}
  />
);

function Lines({ positions, color, opacity = 0.7, ...rest }) {
  const geom = useGeometry(positions);
  return (
    <lineSegments geometry={geom} {...rest}>
      {neon(color, opacity)}
    </lineSegments>
  );
}

function Solid({ color, opacity }) {
  return (
    <meshBasicMaterial
      color={color}
      transparent
      opacity={opacity}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      toneMapped={false}
    />
  );
}

/* ========================= 01 · SEMANTIC LATTICE ========================= */
function NeuralLattice({ color }) {
  const group = useRef();
  const inner = useRef();

  const { points, links } = useMemo(() => {
    const N = 132;
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i += 1) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = golden * i;
      const rad = 1.85 + (i % 5) * 0.055;
      pts.push(new THREE.Vector3(Math.cos(th) * r * rad, y * rad, Math.sin(th) * r * rad));
    }
    const flat = new Float32Array(N * 3);
    pts.forEach((p, i) => flat.set([p.x, p.y, p.z], i * 3));

    const seg = [];
    for (let i = 0; i < N; i += 1) {
      for (let j = i + 1; j < N; j += 1) {
        if (pts[i].distanceTo(pts[j]) < 0.62) seg.push(pts[i], pts[j]);
      }
    }
    const linkArr = new Float32Array(seg.length * 3);
    seg.forEach((p, i) => linkArr.set([p.x, p.y, p.z], i * 3));
    return { points: flat, links: linkArr };
  }, []);

  const equator = useMemo(() => ringPositions(2.52, 96), []);
  const pointGeom = useGeometry(points);

  useFrame((state, dt) => {
    if (group.current) {
      group.current.rotation.y += dt * 0.19;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.24) * 0.18;
    }
    if (inner.current) {
      inner.current.rotation.y -= dt * 0.55;
      inner.current.rotation.z += dt * 0.22;
      inner.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.7) * 0.06);
    }
  });

  return (
    <group ref={group}>
      <Lines positions={links} color={color} opacity={0.24} />
      <points geometry={pointGeom}>
        <pointsMaterial
          color={color}
          size={0.075}
          sizeAttenuation
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.82, 1]} />
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Lines positions={equator} color={color} opacity={0.18} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

/* ========================= 02 · DRIVETRAIN RIG ========================== */
function DrivetrainRig({ color }) {
  const wheel = useRef();
  const cassette = useRef();
  const crank = useRef();

  const spokes = useMemo(() => {
    const N = 32;
    const arr = new Float32Array(N * 6);
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      const off = i % 2 ? 0.34 : -0.34;
      arr.set([Math.cos(a + off) * 0.18, Math.sin(a + off) * 0.18, i % 2 ? 0.055 : -0.055], i * 6);
      arr.set([Math.cos(a) * 1.72, Math.sin(a) * 1.72, 0], i * 6 + 3);
    }
    return arr;
  }, []);

  const rim = useMemo(() => ringPositions(1.75, 84), []);
  const rimInner = useMemo(() => ringPositions(1.6, 84), []);
  const hub = useMemo(() => ringPositions(0.19, 24), []);
  const chainring = useMemo(() => ringPositions(0.62, 48), []);
  const crankArm = useMemo(() => new Float32Array([0, 0, 0, 0, -0.95, 0, 0, 0, 0, 0, 0.95, 0]), []);
  const cogs = useMemo(() => [0.42, 0.37, 0.32, 0.27, 0.22, 0.17].map((r) => ringPositions(r, 34)), []);
  const chain = useMemo(
    () =>
      new Float32Array([
        -1.05, 0.6, 0, 1.72, 0.4, 0,
        -1.05, -0.6, 0, 1.72, -0.4, 0,
        -1.05, 0.6, 0, -1.05, -0.6, 0,
        1.72, 0.4, 0, 1.72, -0.4, 0,
      ]),
    [],
  );

  useFrame((_state, dt) => {
    if (wheel.current) wheel.current.rotation.z -= dt * 1.15;
    if (cassette.current) cassette.current.rotation.z -= dt * 2.6;
    if (crank.current) crank.current.rotation.z -= dt * 1.15;
  });

  return (
    <group rotation={[0.42, -0.62, 0]} position={[0, -0.1, 0]}>
      <group ref={wheel}>
        <Lines positions={rim} color={color} opacity={0.85} />
        <Lines positions={rimInner} color={color} opacity={0.35} />
        <Lines positions={spokes} color={color} opacity={0.4} />
        <Lines positions={hub} color={color} opacity={0.9} />
      </group>

      <group position={[-1.05, 0, 0]} ref={crank}>
        <Lines positions={chainring} color={color} opacity={0.8} />
        <Lines positions={crankArm} color={color} opacity={0.65} />
      </group>

      <group position={[1.72, 0, 0]} ref={cassette}>
        {cogs.map((c, i) => (
          <Lines key={i} positions={c} color={color} opacity={0.32 + i * 0.1} position={[0, 0, i * 0.085 - 0.21]} />
        ))}
      </group>

      <Lines positions={chain} color={color} opacity={0.5} />
    </group>
  );
}

/* ========================= 03 · RACK TELEMETRY ========================= */
function ServerStack({ color }) {
  const group = useRef();
  const ledMats = useRef([]);
  const packets = useRef([]);
  const boxGeom = useBoxEdgeGeometry();

  const units = useMemo(() => [0, 1, 2, 3, 4].map((i) => -1.55 + i * 0.78), []);
  const leds = useMemo(() => {
    const out = [];
    units.forEach((y, ui) => {
      for (let i = 0; i < 7; i += 1) out.push({ id: `${ui}-${i}`, y: y + 0.13, x: -0.92 + i * 0.19 });
    });
    return out;
  }, [units]);
  const spine = useMemo(
    () => new Float32Array([1.5, -2.1, 0, 1.5, 2.1, 0, -1.5, -2.1, 0, -1.5, 2.1, 0]),
    [],
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (group.current) group.current.rotation.y = Math.sin(t * 0.26) * 0.42 - 0.2;
    for (let i = 0; i < ledMats.current.length; i += 1) {
      const m = ledMats.current[i];
      if (m) m.opacity = 0.18 + Math.abs(Math.sin(t * (1.6 + i * 0.31) + i)) * 0.8;
    }
    for (let i = 0; i < packets.current.length; i += 1) {
      const p = packets.current[i];
      if (!p) continue;
      p.position.y += dt * (1.5 + i * 0.42);
      if (p.position.y > 2.1) p.position.y = -2.1;
    }
  });

  return (
    <group ref={group} scale={1.06}>
      <lineSegments geometry={boxGeom} scale={[2.5, 4.1, 1.5]}>
        {neon(color, 0.3)}
      </lineSegments>

      {units.map((y, i) => (
        <group key={y} position={[0, y, 0]}>
          <lineSegments geometry={boxGeom} scale={[2.28, 0.58, 1.32]}>
            {neon(color, 0.62)}
          </lineSegments>
          <mesh position={[0, 0, 0.67]} scale={[2.28, 0.58, 1]}>
            <planeGeometry args={[1, 1]} />
            <Solid color={color} opacity={0.05 + (i % 2) * 0.03} />
          </mesh>
        </group>
      ))}

      {leds.map((l, i) => (
        <mesh key={l.id} position={[l.x, l.y, 0.69]}>
          <planeGeometry args={[0.075, 0.038]} />
          <meshBasicMaterial
            ref={(m) => {
              ledMats.current[i] = m;
            }}
            color={color}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <Lines positions={spine} color={color} opacity={0.3} />
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            packets.current[i] = m;
          }}
          position={[i % 2 ? 1.5 : -1.5, -2.1 + i * 1.05, 0]}
        >
          <planeGeometry args={[0.05, 0.3]} />
          <Solid color={color} opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ========================= 04 · BLOCKOUT VOLUME ======================== */
const BLOCKS = [
  [-2.2, 0.3, -1.4, 1.4, 0.6, 1.4],
  [-0.6, 0.55, -2.1, 1.2, 1.1, 1.2],
  [1.4, 0.9, -1.6, 1.6, 1.8, 1.3],
  [2.4, 0.35, 0.5, 1.1, 0.7, 1.6],
  [0.5, 0.2, 0.9, 2.0, 0.4, 1.4],
  [-1.9, 0.75, 1.3, 1.2, 1.5, 1.2],
  [-3.1, 0.45, 0.2, 0.9, 0.9, 2.1],
  [0.2, 1.55, -0.6, 0.8, 0.3, 0.8],
  [3.0, 1.2, -0.8, 0.7, 2.4, 0.7],
];

function LevelBlockout({ color }) {
  const group = useRef();
  const player = useRef();
  const boxGeom = useBoxEdgeGeometry();

  const beams = useMemo(() => {
    const arr = new Float32Array(BLOCKS.length * 6);
    BLOCKS.forEach((b, i) => arr.set([b[0], b[1] + b[4] / 2, b[2], b[0], 3.4, b[2]], i * 6));
    return arr;
  }, []);

  const path = useMemo(
    () => [
      new THREE.Vector3(-3.0, 0.95, 1.4),
      new THREE.Vector3(-1.0, 1.2, 1.0),
      new THREE.Vector3(0.6, 0.55, 1.0),
      new THREE.Vector3(2.4, 0.85, 0.6),
      new THREE.Vector3(1.4, 1.95, -1.6),
      new THREE.Vector3(-0.6, 1.25, -2.1),
      new THREE.Vector3(-2.2, 0.72, -1.4),
    ],
    [],
  );

  const pathLine = useMemo(() => {
    const arr = new Float32Array(path.length * 6);
    for (let i = 0; i < path.length; i += 1) {
      const a = path[i];
      const b = path[(i + 1) % path.length];
      arr.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    }
    return arr;
  }, [path]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (group.current) group.current.rotation.y = Math.sin(t * 0.16) * 0.5 + 0.35;
    if (player.current) {
      const total = path.length;
      const u = (t * 0.24) % 1;
      const idx = Math.floor(u * total);
      const f = u * total - idx;
      player.current.position.lerpVectors(path[idx], path[(idx + 1) % total], f);
      player.current.rotation.y += dt * 2.2;
      player.current.rotation.x += dt * 1.1;
    }
  });

  return (
    <group ref={group} position={[0, -1.1, 0]}>
      <gridHelper args={[9, 18, color, color]} material-transparent material-opacity={0.16} />
      {BLOCKS.map((b, i) => (
        <group key={i} position={[b[0], b[1], b[2]]}>
          <lineSegments geometry={boxGeom} scale={[b[3], b[4], b[5]]}>
            {neon(color, 0.72)}
          </lineSegments>
          <mesh scale={[b[3], b[4], b[5]]}>
            <boxGeometry args={[1, 1, 1]} />
            <Solid color={color} opacity={0.055} />
          </mesh>
        </group>
      ))}
      <Lines positions={beams} color={color} opacity={0.14} />
      <Lines positions={pathLine} color={color} opacity={0.4} />
      <mesh ref={player} position={[-3, 0.95, 1.4]}>
        <octahedronGeometry args={[0.19, 0]} />
        <Solid color="#ffffff" opacity={0.95} />
      </mesh>
    </group>
  );
}

/** Soft pointer parallax on the camera, shared by every scene. */
export function Rig() {
  useFrame((state, dt) => {
    const cam = state.camera;
    const k = Math.min(1, dt * 3.4);
    cam.position.x += (state.pointer.x * 1.25 - cam.position.x) * k;
    cam.position.y += (state.pointer.y * 0.85 + 0.25 - cam.position.y) * k;
    cam.lookAt(0, 0, 0);
  });
  return null;
}

const SCENES = {
  neural: NeuralLattice,
  drive: DrivetrainRig,
  rack: ServerStack,
  block: LevelBlockout,
};

export default function CareerScene({ scene, color }) {
  const Cmp = SCENES[scene] || NeuralLattice;
  return <Cmp color={color} />;
}
