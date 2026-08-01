// ============================================================================
// tests/camera.test.js — 追尾镜头验收（清单二.3：速度全区间不自动切换视角）
// 运行：node --test tests/camera.test.js
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { EnhancedChaseCamera, CAM_SETTINGS } from '../src/camera/enhanced-chase.js'
import { ValueNoise } from '../src/camera/noise.js'

const DT = 1 / 60

function makeCar(over = {}) {
  return {
    pos: { x: 0, z: 0 }, yaw: 0, vLon: 0, vLat: 0,
    accelLon: 0, accelLat: 0, steerAngle: 0, ...over
  }
}

test('核心承诺（清单二.3）：速度全区间/漂移/倒车均不自动切换视角', () => {
  const cam = new EnhancedChaseCamera(new THREE.PerspectiveCamera(60, 1.6, 0.1, 1000), 'chase')
  const speeds = [0, 3, 8, 15, 30, 50, 70]
  const scenarios = []
  for (const s of speeds) {
    scenarios.push(makeCar({ vLon: s }))                       // 高速
    scenarios.push(makeCar({ vLon: s, vLat: s * 0.4 }))        // 漂移
    scenarios.push(makeCar({ vLon: -Math.min(s, 10) }))        // 倒车
    scenarios.push(makeCar({ vLon: s, yawRate: 3, accelLat: 9 })) // 急弯
  }
  for (let i = 0; i < 400; i++) {
    const car = scenarios[i % scenarios.length]
    car.pos = { x: i * 0.7, z: Math.sin(i * 0.1) * 3 }
    car.yaw = (i * 0.05) % (Math.PI * 2)
    car.accelLon = Math.sin(i * 0.3) * 6
    cam.update(car, DT)
    assert.equal(cam.mode, 'chase', `第 ${i} 帧模式不应自动改变`)
  }
  // 显式切换仍正常
  cam.cycle()
  assert.equal(cam.mode, 'far')
  cam.cycle()
  assert.equal(cam.mode, 'hood')
  cam.cycle()
  assert.equal(cam.mode, 'chase')
})

test('镜头输出全程数值有限', () => {
  const cam = new EnhancedChaseCamera(new THREE.PerspectiveCamera(60, 1.6, 0.1, 1000), 'chase')
  for (let i = 0; i < 600; i++) {
    const car = makeCar({
      vLon: 10 + Math.sin(i * 0.1) * 25, vLat: Math.cos(i * 0.07) * 5,
      accelLon: Math.sin(i * 0.2) * 8, accelLat: Math.cos(i * 0.15) * 8,
      yaw: i * 0.02, steerAngle: Math.sin(i * 0.1) * 0.4
    })
    cam.update(car, DT)
    for (const v of [cam.camera.position.x, cam.camera.position.y, cam.camera.position.z, cam.camera.fov]) {
      assert.ok(Number.isFinite(v), `第 ${i} 帧出现非有限值 ${v}`)
    }
    assert.ok(cam.camera.position.y > 0, '镜头不应低于地面')
  }
})

test('高速 FOV 扩展有界且低速回落', () => {
  const cam = new EnhancedChaseCamera(new THREE.PerspectiveCamera(60, 1.6, 0.1, 1000), 'chase')
  // 预热高速
  for (let i = 0; i < 240; i++) cam.update(makeCar({ vLon: 50 }), DT)
  const highFov = cam.camera.fov
  assert.ok(highFov > 66, `高速应扩展 FOV，实际 ${highFov}`)
  assert.ok(highFov < 62 + CAM_SETTINGS.fovAddDegrees + 2, 'FOV 不应超界')
  // 低速回落（收敛到基础 FOV ≈ 62）
  for (let i = 0; i < 240; i++) cam.update(makeCar({ vLon: 0 }), DT)
  assert.ok(cam.camera.fov < highFov - 3, `低速 FOV 应明显回落，实际 ${cam.camera.fov} vs 高速 ${highFov}`)
  assert.ok(cam.camera.fov < 64, `低速 FOV 应接近基础值 62，实际 ${cam.camera.fov}`)
})

test('G力横摆：左转（侧向加速度为正）时相机向弯外偏转', () => {
  const cam = new EnhancedChaseCamera(new THREE.PerspectiveCamera(60, 1.6, 0.1, 1000), 'chase')
  const cam2 = new EnhancedChaseCamera(new THREE.PerspectiveCamera(60, 1.6, 0.1, 1000), 'chase')
  const carL = makeCar({ vLon: 18, accelLat: 6 })
  const carR = makeCar({ vLon: 18, accelLat: -6 })
  for (let i = 0; i < 90; i++) { cam.update(carL, DT); cam2.update(carR, DT) }
  // 取相机实际朝向（含 G 力旋转）与车头(+x)的夹角
  const yawDiff = c => {
    const dir = new THREE.Vector3()
    c.camera.getWorldDirection(dir)
    dir.y = 0; dir.normalize()
    const fwd = new THREE.Vector3(1, 0, 0)
    return Math.atan2(fwd.x * dir.z - fwd.z * dir.x, fwd.x * dir.x + fwd.z * dir.z)
  }
  const dL = yawDiff(cam), dR = yawDiff(cam2)
  assert.ok(dL > 0.02, `左转相机应明显向右偏转，实际 ${dL.toFixed(3)} rad`)
  assert.ok(dR < -0.02, `右转相机应明显向左偏转，实际 ${dR.toFixed(3)} rad`)
  assert.ok(Math.abs(dL - dR) > 0.05, `左右弯偏转应方向相反且有幅度: ${dL.toFixed(3)} vs ${dR.toFixed(3)}`)
})

test('抖动：高速振幅大于低速（比较抖动路径长度）', () => {
  const mk = seed => new EnhancedChaseCamera(new THREE.PerspectiveCamera(60, 1.6, 0.1, 1000), 'chase', seed)
  const camFast = mk(11), camSlow = mk(12)
  const pathLen = cam => {
    let sum = 0
    let prev = null
    for (let i = 0; i < 180; i++) {
      cam.update(makeCar({ vLon: 40 }), DT) // 车静态，仅抖动分量
      if (i >= 60) { // 跳过收敛期，只测稳定段
        if (prev) sum += cam.camera.position.distanceTo(prev)
        prev = cam.camera.position.clone()
      }
    }
    return sum
  }
  const fast = pathLen(camFast)
  const slow = (() => {
    let sum = 0
    let prev = null
    for (let i = 0; i < 180; i++) {
      camSlow.update(makeCar({ vLon: 1 }), DT)
      if (i >= 60) {
        if (prev) sum += camSlow.camera.position.distanceTo(prev)
        prev = camSlow.camera.position.clone()
      }
    }
    return sum
  })()
  assert.ok(fast > slow * 3, `高速抖动路径应显著大于低速: ${fast.toFixed(4)} vs ${slow.toFixed(4)}`)
  assert.ok(fast > 0.02, `高速段应存在可测抖动，实际 ${fast.toFixed(4)}`)
})

test('ValueNoise：确定性、有界、fbm 归一化', () => {
  const n1 = new ValueNoise(42)
  const n2 = new ValueNoise(42)
  const a = n1.noise(1.3, 2.7), b = n2.noise(1.3, 2.7)
  assert.equal(a, b, '同种子应确定')
  for (let i = 0; i < 200; i++) {
    const v = n1.fbm(i * 0.13, i * 0.07, 3)
    assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.01, `fbm 越界 ${v}`)
  }
})
