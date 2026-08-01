// ============================================================================
// track.js — 赛道：闭合样条 + 路面/双色路肩/草地/护栏/发车格
// 数学部分（最近点/表面分类）纯函数化，可在 Node 单测
// ============================================================================
import * as THREE from 'three'
import { makeAsphaltTexture, makeCurbTexture, makeGrassTexture, makeCheckerTexture } from './textures.js'

export const TRACK = {
  roadWidth: 13,
  curbWidth: 1.1,
  muAsphalt: 1.0,
  muGrass: 0.55
}

/** 赛道中心线控制点（x, z 平面，y=0） */
export const TRACK_POINTS = [
  [0, 0], [60, -10], [120, -45], [165, -105], [185, -175],
  [165, -240], [110, -280], [45, -290], [-15, -270], [-60, -225],
  [-85, -165], [-90, -105], [-75, -50], [-40, -12]
]

export function buildTrackCurve() {
  const pts = TRACK_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5)
  return curve
}

/** 沿曲线采样最近点（64 段粗查 + 精查），返回 {t, point} */
export function closestOnCurve(curve, x, z, samples = 96) {
  let bestT = 0, bestD = Infinity
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const p = curve.getPointAt(t)
    const d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < bestD) { bestD = d; bestT = t }
  }
  // 精查：在 bestT 邻域 2/samples 内细分
  const span = 2 / samples
  for (let i = 0; i <= 12; i++) {
    const t = (bestT - span / 2 + span * i / 12 + 1) % 1
    const p = curve.getPointAt(t)
    const d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < bestD) { bestD = d; bestT = t }
  }
  return { t: bestT, point: curve.getPointAt(bestT), dist: Math.sqrt(bestD) }
}

/** 表面分类：返回 {mu, onTrack} */
export function classifySurface(curve, x, z) {
  const { dist } = closestOnCurve(curve, x, z)
  const onTrack = dist <= TRACK.roadWidth / 2 + TRACK.curbWidth
  return { mu: onTrack ? TRACK.muAsphalt : TRACK.muGrass, onTrack, dist }
}

/** 沿曲线构建路面带（含双色路肩边缘） */
export function buildTrackMesh(curve) {
  const group = new THREE.Group()
  const segments = 240
  const halfW = TRACK.roadWidth / 2

  // --- 路面 ribbon ---
  const positions = new Float32Array((segments + 1) * 2 * 3)
  const uvs = new Float32Array((segments + 1) * 2 * 2)
  const indices = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    const left = new THREE.Vector3(-tan.z, 0, tan.x).normalize() // 路面横向
    const a = i * 2, b = i * 2 + 1
    positions.set([p.x + left.x * halfW, 0.02, p.z + left.z * halfW], a * 3)
    positions.set([p.x - left.x * halfW, 0.02, p.z - left.z * halfW], b * 3)
    uvs.set([0, t * 26], a * 2)  // 纵向贴图重复
    uvs.set([1, t * 26], b * 2)
    if (i < segments) {
      indices.push(a, b, a + 2, b, b + 2, a + 2)
    }
  }
  const roadGeo = new THREE.BufferGeometry()
  roadGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  roadGeo.setIndex(indices)
  const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({
    map: makeAsphaltTexture(), roughness: 0.92, metalness: 0.0
  }))
  road.receiveShadow = true
  group.add(road)

  // --- 双色路肩（左右两条） ---
  for (const side of [1, -1]) {
    const cp = []
    const cu = []
    const ci = []
    const colors = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const p = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      const left = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
      const inner = halfW + TRACK.curbWidth * side * 0.0
      const o = halfW * side
      const iw = (halfW + TRACK.curbWidth) * side
      cp.push(p.x + left.x * o, 0.035, p.z + left.z * o)
      cp.push(p.x + left.x * iw, 0.035, p.z + left.z * iw)
      // 红白交替（每 4 段一段）
      const col = Math.floor(t * segments / 4) % 2 === 0 ? [0.85, 0.22, 0.18] : [0.92, 0.92, 0.92]
      colors.push(...col, ...col)
      const u = t * 30
      cu.push(0, u, 1, u)
      if (i < segments) {
        const a = i * 2, b = i * 2 + 1
        ci.push(a, b, a + 2, b, b + 2, a + 2)
      }
    }
    const curbGeo = new THREE.BufferGeometry()
    curbGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cp), 3))
    curbGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cu), 2))
    curbGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
    curbGeo.setIndex(ci)
    const curb = new THREE.Mesh(curbGeo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85
    }))
    curb.receiveShadow = true
    group.add(curb)
  }

  // --- 发车格（起点） ---
  const start = curve.getPointAt(0)
  const tan = curve.getTangentAt(0)
  const left = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK.roadWidth * 0.92, 5),
    new THREE.MeshStandardMaterial({ map: makeCheckerTexture(10), roughness: 0.8 })
  )
  grid.rotation.x = -Math.PI / 2
  grid.rotation.z = -Math.atan2(tan.x, tan.z) // 对齐曲线方向
  grid.position.set(start.x, 0.05, start.z)
  group.add(grid)

  return group
}

/** 草地底盘 + 简单护栏与树木点缀 */
export function buildSurroundings() {
  const group = new THREE.Group()
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 })
  )
  grass.rotation.x = -Math.PI / 2
  grass.position.y = -0.02
  grass.receiveShadow = true
  group.add(grass)

  // 护栏柱（沿曲线内侧等距采样）
  return group
}

/** 在曲线两侧点缀树木 */
export function buildTrees(curve, count = 46) {
  const group = new THREE.Group()
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b2e, roughness: 1 })
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    const left = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
    const side = i % 2 === 0 ? 1 : -1
    const off = 14 + Math.random() * 26
    const tree = new THREE.Group()
    const h = 3.5 + Math.random() * 2.5
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, h, 5), trunkMat)
    trunk.position.y = h / 2
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.6 + Math.random(), h * 1.1, 6), leafMat)
    leaf.position.y = h + h * 0.45
    tree.add(trunk, leaf)
    tree.position.set(p.x + left.x * off * side, 0, p.z + left.z * off * side)
    tree.rotation.y = Math.random() * Math.PI
    tree.castShadow = true
    group.add(tree)
  }
  return group
}
