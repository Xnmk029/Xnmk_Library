// ============================================================================
// car-model.js — 加载下载的肌肉车 GLB，自动定向（前轮→+x）、识别车轮、
// 车身姿态组（pitch/roll 由物理驱动）
// ============================================================================
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const CAR_TARGET = { length: 4.75, wheelRadius: 0.34 }

/**
 * 加载并规范化车辆模型
 * @returns {Promise<{root:THREE.Group, body:THREE.Group, wheels:{mesh:THREE.Mesh, steer:THREE.Group, axis:'y'}[], radius:number}>}
 */
export async function loadCarModel(url = '/models/muscle-car.glb') {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(url)
  const model = gltf.scene

  // 1) 收集所有网格；按名称/几何形状识别车轮（圆柱：直径≈高，厚度小）
  const meshes = []
  model.traverse(o => { if (o.isMesh) meshes.push(o) })
  const wheels = meshes.filter(m => {
    if (/wheel|tire/i.test(m.name)) return true
    const box = new THREE.Box3().setFromObject(m)
    const s = new THREE.Vector3(); box.getSize(s)
    return s.y > 0.5 && Math.abs(s.x - s.y) < 0.3 * s.y && s.z < 0.5 * s.y
  })
  const nonWheels = meshes.filter(m => !wheels.includes(m))

  // 2) 车身包围盒：前→后方向（用车轮定位：后轮组→前轮组）
  const wheelCenters = wheels.map(m => new THREE.Vector3().setFromMatrixPosition(m.matrixWorld).clone())
  const frontWheels = wheelCenters.filter(w => w.x === Math.max(...wheelCenters.map(c => c.x)))
  const rearWheels = wheelCenters.filter(w => w.x === Math.min(...wheelCenters.map(c => c.x)))
  let forwardDir = null
  if (frontWheels.length && rearWheels.length) {
    const f = frontWheels[0], r = rearWheels[0]
    forwardDir = new THREE.Vector3().subVectors(f, r)
    if (forwardDir.lengthSq() < 1e-4) forwardDir = null
  }
  // 兜底：沿模型 x 轴
  if (!forwardDir) {
    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3(); box.getSize(size)
    forwardDir = new THREE.Vector3(size.x >= size.z ? 1 : 0, 0, size.x >= size.z ? 0 : 1)
  }
  forwardDir.y = 0
  forwardDir.normalize()

  // 3) 仅绕 Y 轴旋转，使前向对齐 +x（保持车轮轴竖直）
  const target = new THREE.Vector3(1, 0, 0)
  const yaw = Math.atan2(forwardDir.z, forwardDir.x) // 需旋转角度（绕Y）
  const root = new THREE.Group()
  root.add(model)
  model.rotation.y = -yaw

  // 4) 归一化比例：车长 → CAR_TARGET.length
  const box = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3(); box.getSize(size)
  const scale = CAR_TARGET.length / Math.max(size.x, 1e-6)
  root.scale.setScalar(scale)

  // 5) 姿态组 + 车轮组
  const body = new THREE.Group()
  root.add(body)
  nonWheels.forEach(m => {
    m.castShadow = true
    m.receiveShadow = true
    body.attach(m)
  })

  const wheelGroups = wheels.map(w => {
    const steer = new THREE.Group()
    root.add(steer)
    steer.attach(w)
    return { mesh: w, steer, axis: 'y' }
  })

  // 车轮半径（取第一个车轮的实际半径）
  let radius = CAR_TARGET.wheelRadius
  if (wheels.length) {
    const wb = new THREE.Box3().setFromObject(wheels[0])
    const ws = new THREE.Vector3(); wb.getSize(ws)
    radius = Math.max(ws.x, ws.y) / 2 * scale
  }

  // 兜底：若模型无车轮网格，生成简化车轮
  if (wheelGroups.length === 0) {
    const geo = new THREE.CylinderGeometry(radius, radius, 0.26, 14)
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 })
    for (const [fx, fy] of [[1.35, 0.78], [1.35, -0.78], [-1.5, 0.78], [-1.5, -0.78]]) {
      const steer = new THREE.Group()
      steer.position.set(fx, radius, fy)
      const wheel = new THREE.Mesh(geo, mat)
      wheel.rotation.z = Math.PI / 2 // 轴沿 Y
      steer.add(wheel)
      root.add(steer)
      wheelGroups.push({ mesh: wheel, steer, axis: 'y' })
    }
  }

  // 车漆：给车身主体统一上色（Kenney 白模）
  const paint = new THREE.MeshStandardMaterial({ color: 0x8f1f24, metalness: 0.55, roughness: 0.32 })
  body.traverse(o => { if (o.isMesh && !/glass|window|light/i.test(o.name)) o.material = paint })

  return { root, body, wheels: wheelGroups, radius }
}
