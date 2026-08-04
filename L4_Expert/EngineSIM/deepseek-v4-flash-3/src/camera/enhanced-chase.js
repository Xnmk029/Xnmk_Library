// ============================================================================
// enhanced-chase.js — 追尾镜头（移植 enhanceddriver 核心手感）
// G力俯仰/横摆/侧倾 · 转向预瞄 · 速度抖动(fBm) · 漂移抖动 · 速度FOV · 显式模式切换
// 关键承诺：镜头模式仅由 C 键切换，任何速度/状态都不自动切换视角
// ============================================================================
import * as THREE from 'three'
import { CAMERA_MODES, MODE_CFG } from './chase-camera.js'
import { ValueNoise } from './noise.js'

/** 非线性时域平滑（对应 enhanceddriver 的 newTemporalSmoothingNonLinear） */
class Smoother {
  constructor(rate = 4, start = 0) { this.rate = rate; this.state = start }
  get(target, dt) {
    const r = Math.min(1, dt * this.rate)
    this.state += (target - this.state) * r
    return this.state
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const atan = v => Math.atan(v)

export const CAM_SETTINGS = {
  // G 力角度增益（度/单位力）
  gForceYaw: 6.0,      // 侧向力 → 相机横摆（弯道外甩感）
  gForceRoll: 5.5,     // 侧向力 → 相机侧倾
  gForcePitch: 4.2,    // 纵向力 → 相机俯仰（加速抬头/制动点头的镜头呼应）
  // 平滑速率
  smoothSide: 4.2,
  smoothFwd: 4.2,
  // 阈值（去噪，对应 gForceX/YThreshold）
  sideThreshold: 0.9,
  fwdThreshold: 0.8,
  // 低速淡入（对应 gForceEffectFactor = clamp(v/4,0,1)）
  gForceMinSpeed: 4.0,
  // 转向预瞄
  steeringLookAhead: 0.055, // rad
  steeringLookRate: 3.5,
  // 速度抖动
  shakeMinSpeed: 8,    // m/s 起振
  shakeMaxSpeed: 45,
  shakeAmp: 0.09,      // m
  shakeFreq: 5.5,      // 倍率
  // 漂移抖动
  driftShakeAmp: 0.14,
  // FOV 速度扩展
  fovMinSpeed: 12,
  fovMaxSpeed: 45,
  fovAddDegrees: 13,
  fovSmooth: 2.5
}

export class EnhancedChaseCamera {
  constructor(camera, initial = 'chase', seed = 1337) {
    this.camera = camera
    this.modeIndex = Math.max(0, CAMERA_MODES.indexOf(initial))
    this.mode = CAMERA_MODES[this.modeIndex]
    this.pos = new THREE.Vector3(0, 6, -12)
    this.look = new THREE.Vector3()
    this.lastYaw = 0
    this.yawBlend = 0

    // 平滑器（G力 + 转向预瞄 + FOV）
    this.sideS = new Smoother(CAM_SETTINGS.smoothSide)
    this.fwdS = new Smoother(CAM_SETTINGS.smoothFwd)
    this.steerS = new Smoother(CAM_SETTINGS.steeringLookRate)
    this.fovS = new Smoother(CAM_SETTINGS.fovSmooth, 0)
    this.noise = new ValueNoise(seed)
    this.shakeT = 0
    this.camRoll = 0
    this.lastSpeed = 0
  }

  get name() { return this.mode }

  /** 显式切换（仅由 C 键调用；内部不存在任何自动切换路径） */
  cycle() {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length
    this.mode = CAMERA_MODES[this.modeIndex]
    return this.mode
  }

  setMode(m) {
    const i = CAMERA_MODES.indexOf(m)
    if (i >= 0) { this.modeIndex = i; this.mode = m }
  }

  snapTo(carPos, yaw) {
    const cfg = MODE_CFG[this.mode]
    const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw))
    this.pos.set(carPos.x - back.x * cfg.dist, cfg.height, carPos.z - back.z * cfg.dist)
    this.yawBlend = yaw
  }

  /**
   * @param {{pos:{x,z}, yaw:number, vLon:number, vLat:number, accelLon:number, accelLat:number, steerAngle:number}} car
   */
  update(car, dt) {
    const cfg = MODE_CFG[this.mode]
    const { x, z } = car.pos
    const yaw = car.yaw
    const speed = Math.hypot(car.vLon, car.vLat)
    this.shakeT += dt

    // ============ 1. 基础追尾位置（横摆角平滑防跳变） ============
    let dYaw = yaw - this.yawBlend
    while (dYaw > Math.PI) dYaw -= Math.PI * 2
    while (dYaw < -Math.PI) dYaw += Math.PI * 2
    this.yawBlend += dYaw * Math.min(1, dt * cfg.lerp)
    const back = new THREE.Vector3(-Math.cos(this.yawBlend), 0, Math.sin(this.yawBlend))
    const target = new THREE.Vector3(x + back.x * cfg.dist, cfg.height, z + back.z * cfg.dist)
    const k = 1 - Math.exp(-cfg.lerp * dt)
    this.pos.lerp(target, k)

    const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    this.look.set(x + fwd.x * cfg.lookAhead, 1.0, z + fwd.z * cfg.lookAhead)

    // ============ 2. G 力动态（enhanceddriver 移植） ============
    const gFactor = clamp(speed / CAM_SETTINGS.gForceMinSpeed, 0, 1)
    // 侧向力（左转为正，对应车辆 +y）→ 横摆/侧倾
    const rawSide = car.accelLat
    let side = Math.abs(rawSide) > CAM_SETTINGS.sideThreshold ? rawSide : 0
    side = this.sideS.get(side, dt) * gFactor
    // 纵向力（加速为正）→ 俯仰
    const rawFwd = car.accelLon
    let fwdF = Math.abs(rawFwd) > CAM_SETTINGS.fwdThreshold ? rawFwd : 0
    fwdF = this.fwdS.get(fwdF, dt) * gFactor

    // 角度合成（度）：侧向 G → 横摆外甩 + 侧倾；纵向 G → 俯仰（加速抬头=俯角下压=往上看车头前方）
    // 注意：three.js 正旋转(绕+Y)为左转；弯外摆需取反（左转→相机看向车右侧/弯外）
    const yawOff = -atan(side * 0.30) * CAM_SETTINGS.gForceYaw
    const rollOff = atan(-side * 0.30) * CAM_SETTINGS.gForceRoll
    const pitchOff = atan(-fwdF * 0.35) * CAM_SETTINGS.gForcePitch

    // ============ 3. 转向预瞄（enhanceddriver steeringLookAhead） ============
    const steerSm = this.steerS.get(car.steerAngle / 0.42, dt)
    const steerOff = steerSm * CAM_SETTINGS.steeringLookAhead

    // ============ 4. 速度抖动 + 漂移抖动（fBm） ============
    const speedScale = clamp((speed - CAM_SETTINGS.shakeMinSpeed) / (CAM_SETTINGS.shakeMaxSpeed - CAM_SETTINGS.shakeMinSpeed), 0, 1)
    const driftRatio = speed > 3 ? clamp(Math.abs(car.vLat) / Math.max(4, speed), 0, 1) : 0
    const shakeAmp = CAM_SETTINGS.shakeAmp * speedScale + CAM_SETTINGS.driftShakeAmp * driftRatio
    const sx = shakeAmp * this.noise.fbm(this.shakeT * 1.7 * CAM_SETTINGS.shakeFreq, 3.1, 3)
    const sy = shakeAmp * this.noise.fbm(this.shakeT * 1.3 * CAM_SETTINGS.shakeFreq, 7.7, 3)

    // ============ 5. 相机定位 ============
    // 侧倾时相机横向微位移（弯道外侧摆动）
    const sideLean = clamp(side * 0.06, -0.35, 0.35)
    const left = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const pos = this.pos.clone()
      .add(left.clone().multiplyScalar(sideLean))
      .add(new THREE.Vector3(sx, sy * 0.5, sx * 0.4))

    this.camera.position.copy(pos)

    // 朝向：基础 lookAt + 横摆/俯仰偏移（绕车辆竖轴与侧轴旋转视线）
    const dir = new THREE.Vector3().subVectors(this.look, pos).normalize()
    const rotYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawOff + steerOff)
    const rotPitch = new THREE.Quaternion().setFromAxisAngle(left, -pitchOff * Math.PI / 180)
    dir.applyQuaternion(rotYaw).applyQuaternion(rotPitch)
    const lookTarget = pos.clone().add(dir.multiplyScalar(100))
    this.camera.lookAt(lookTarget)
    // 侧倾（绕视线轴）
    this.camRoll += (rollOff * Math.PI / 180 - this.camRoll) * Math.min(1, dt * 6)
    if (Math.abs(this.camRoll) > 1e-4) {
      this.camera.rotateZ(this.camRoll)
    }

    // ============ 6. 速度 FOV ============
    const fovScale = clamp((speed - CAM_SETTINGS.fovMinSpeed) / (CAM_SETTINGS.fovMaxSpeed - CAM_SETTINGS.fovMinSpeed), 0, 1)
    const targetFov = cfg.fov + this.fovS.get(fovScale, dt) * CAM_SETTINGS.fovAddDegrees
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3)
    this.camera.updateProjectionMatrix()

    this.lastSpeed = speed
  }
}
