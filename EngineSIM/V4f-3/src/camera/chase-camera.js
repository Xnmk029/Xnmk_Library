// ============================================================================
// chase-camera.js — 追尾/外部/机舱 三种相机（显式键位切换，无速度自动切换）
// 阶段3 基础版：位置平滑 + 速度视野；阶段4 将升级 G 力动态
// ============================================================================
import * as THREE from 'three'

export const CAMERA_MODES = ['chase', 'far', 'hood']

export const MODE_CFG = {
  chase: { dist: 8.2, height: 3.1, lookAhead: 4.5, fov: 62, lerp: 5.5 },
  far: { dist: 14.5, height: 5.6, lookAhead: 6.0, fov: 54, lerp: 4.0 },
  hood: { dist: -0.6, height: 1.25, lookAhead: 6.5, fov: 72, lerp: 12 }
}

export class ChaseCamera {
  constructor(camera, initial = 'chase') {
    this.camera = camera
    this.modeIndex = CAMERA_MODES.indexOf(initial)
    if (this.modeIndex < 0) this.modeIndex = 0
    this.mode = CAMERA_MODES[this.modeIndex]
    this.pos = new THREE.Vector3(0, 6, -12)
    this.look = new THREE.Vector3()
    this.lastYaw = 0
    this.yawBlend = 0
  }

  get name() { return this.mode }

  /** 显式切换（仅 C 键触发，无任何速度相关自动切换逻辑） */
  cycle() {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length
    this.mode = CAMERA_MODES[this.modeIndex]
    return this.mode
  }

  /** 瞬移到车辆（复位/换模式时避免镜头拉丝） */
  snapTo(carPos, yaw) {
    const cfg = MODE_CFG[this.mode]
    const back = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw))
    this.pos.set(
      carPos.x - back.x * cfg.dist,
      cfg.height,
      carPos.z - back.z * cfg.dist
    )
    this.yawBlend = yaw
  }

  update(car, dt) {
    const { x, z } = car.pos
    const yaw = car.yaw
    const cfg = MODE_CFG[this.mode]

    // 目标点：车后方 dist、上方 height
    // 车体 +x 前、+y 左 → 世界(东,南)：后方 = -(cos yaw, -sin yaw) = (-cos yaw, sin yaw)
    const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw))
    const target = new THREE.Vector3(x + back.x * cfg.dist, cfg.height, z + back.z * cfg.dist)

    // 横摆角跨越 ±π 时平滑混合防跳变
    let dYaw = yaw - this.yawBlend
    while (dYaw > Math.PI) dYaw -= Math.PI * 2
    while (dYaw < -Math.PI) dYaw += Math.PI * 2
    this.yawBlend += dYaw * Math.min(1, dt * cfg.lerp)

    const backBlend = new THREE.Vector3(-Math.cos(this.yawBlend), 0, Math.sin(this.yawBlend))
    const smoothTarget = new THREE.Vector3(x + backBlend.x * cfg.dist, cfg.height, z + backBlend.z * cfg.dist)

    // 指数平滑位置（加速/刹车时镜头滞后感）
    const k = 1 - Math.exp(-cfg.lerp * dt)
    this.pos.lerp(smoothTarget, k)

    // 注视点：车前方 lookAhead（跟随车头方向）
    const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    this.look.set(x + fwd.x * cfg.lookAhead, 1.1, z + fwd.z * cfg.lookAhead)

    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)

    // 速度相关视野（有界）
    const speed = Math.hypot(car.vLon, car.vLat)
    const fov = cfg.fov + Math.min(14, speed * 0.22)
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3)
    this.camera.updateProjectionMatrix()
  }
}
