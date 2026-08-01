// ============================================================================
// vehicle.js — 四轮双轨车辆动力学（魔术公式轮胎 + 载荷转移 + 变速器）
// 平面动力学：vLon(纵向) / vLat(侧向) / ψ(航向) / ω(横摆角速度)
// 固定步长半隐式欧拉积分，与渲染层解耦（输出状态快照）
// ============================================================================
import { tireForce, TIRE_PARAMS } from './tire.js'
import { clamp, clampUnit, lookup } from '../audio/engine-math.js'

export const VEHICLE_PARAMS = {
  mass: 1650,        // kg
  wheelbase: 2.85,   // m
  cgToFront: 1.25,   // m（重心距前轴）
  trackWidth: 1.62,  // m
  cgHeight: 0.55,    // m
  wheelRadius: 0.34, // m
  yawInertia: 2450,  // kg·m²
  wheelInertia: 1.6, // kg·m²（单轴等效）
  maxSteerLock: 0.42,// rad（转向机最大锁止角）
  maxBrakeTorque: 5200, // N·m 总量
  brakeBias: 0.62,   // 前轴制动比例
  driveAxle: 'rear', // 美式肌肉车：后驱
  dragCoef: 0.38,    // Cd
  frontalArea: 2.2,  // m²
  rollingCoef: 0.015,
  gearRatios: [3.35, 2.18, 1.52, 1.12, 0.87, 0.68],
  finalDrive: 3.9,
  engineRedline: 6400,
  idleRpm: 800
}

const G = 9.81
const RHO = 1.225

/** 曲轴扭矩随转速的归一化曲线（峰值 4200rpm） */
const TORQUE_RPM = [
  [0, 0.55], [1200, 0.72], [2500, 0.88], [3800, 0.98],
  [4200, 1.00], [5000, 0.94], [5800, 0.85], [6400, 0.74], [7200, 0.55]
]

export class Vehicle {
  constructor(params = {}) {
    this.p = { ...VEHICLE_PARAMS, ...params }
    const p = this.p
    this.Lf = p.cgToFront
    this.Lr = p.wheelbase - p.cgToFront

    // 静态轴荷（N）
    this.FzFrontStatic = p.mass * G * (this.Lr / p.wheelbase)
    this.FzRearStatic = p.mass * G * (this.Lf / p.wheelbase)
    this.FzPerWheelFront = this.FzFrontStatic / 2
    this.FzPerWheelRear = this.FzRearStatic / 2

    // 状态
    this.posX = 0; this.posZ = 0
    this.yaw = 0; this.yawRate = 0
    this.vLon = 0; this.vLat = 0
    this.wheelSpinFront = 0 // rad/s
    this.wheelSpinRear = 0
    this.gear = 0
    this.shiftTimer = 0

    this.throttle = 0
    this.brake = 0
    this.reverse = 0
    this.mu = 1
    this.steerAngle = 0 // 经手感辅助后的实际前轮转角 rad

    // 观测
    this.accelLon = 0; this.accelLat = 0
    this.slipAngles = [0, 0, 0, 0] // FL FR RL RR
    this.kappas = [0, 0, 0, 0]
    this.fzWheels = [0, 0, 0, 0]
    this.wheelForces = [{ Fx: 0, Fy: 0 }, { Fx: 0, Fy: 0 }, { Fx: 0, Fy: 0 }, { Fx: 0, Fy: 0 }]
    this.rpmEngine = p.idleRpm
  }

  /** 重置 */
  reset(x = 0, z = 0, yaw = 0) {
    this.posX = x; this.posZ = z; this.yaw = yaw
    this.yawRate = 0; this.vLon = 0; this.vLat = 0
    this.wheelSpinFront = 0; this.wheelSpinRear = 0
    this.gear = 0; this.accelLon = 0; this.accelLat = 0
    this.rpmEngine = this.p.idleRpm
  }

  // -------------------------------------------------------------------------
  // 变速器：自动换挡
  // -------------------------------------------------------------------------
  _shiftLogic(dt) {
    const p = this.p
    this.shiftTimer -= dt
    const wheelSpeedRpm = Math.abs(this.wheelSpinRear) * 60 / (2 * Math.PI)
    const curRatio = p.gearRatios[this.gear] * p.finalDrive
    const rpm = wheelSpeedRpm * curRatio
    const rpmRatio = rpm / p.engineRedline

    if (this.shiftTimer <= 0) {
      if (rpmRatio > 0.93 && this.gear < p.gearRatios.length - 1) {
        this.gear += 1; this.shiftTimer = 0.45
      } else if (rpmRatio < 0.52 && this.gear > 0) {
        this.gear -= 1; this.shiftTimer = 0.35
      }
    }
  }

  /** 发动机转速（车轮转速 × 传动比，含怠速下限与红线上限防轮空转爆转） */
  _engineRpm() {
    const p = this.p
    const ratio = p.gearRatios[this.gear] * p.finalDrive
    const wheelRpm = Math.abs(this.wheelSpinRear) * 60 / (2 * Math.PI)
    return clamp(Math.max(p.idleRpm, wheelRpm * ratio), 0, 8000)
  }

  // -------------------------------------------------------------------------
  // 主积分步（固定 dt，建议 1/120）
  // -------------------------------------------------------------------------
  step(dt, inputs = {}) {
    const p = this.p
    this.throttle = clampUnit(inputs.throttle ?? this.throttle)
    this.brake = clampUnit(inputs.brake ?? this.brake)
    this.reverse = clampUnit(inputs.reverse ?? this.reverse)
    this.mu = clamp(inputs.mu ?? this.mu ?? 1, 0.2, 1.5)
    if (inputs.steerAngle !== undefined) this.steerAngle = clamp(inputs.steerAngle, -p.maxSteerLock, p.maxSteerLock)

    this._shiftLogic(dt)

    // ---- 载荷转移（用上一拍加速度） ----
    const aLonPrev = this.accelLon
    const aLatPrev = this.accelLat
    const dFzLon = aLonPrev * p.mass * p.cgHeight / p.wheelbase
    const dFzLat = aLatPrev * p.mass * p.cgHeight / p.trackWidth
    const FzFL = (this.FzFrontStatic / 2) - dFzLon / 2 - dFzLat / 2
    const FzFR = (this.FzFrontStatic / 2) - dFzLon / 2 + dFzLat / 2
    const FzRL = (this.FzRearStatic / 2) + dFzLon / 2 - dFzLat / 2
    const FzRR = (this.FzRearStatic / 2) + dFzLon / 2 + dFzLat / 2
    this.fzWheels = [FzFL, FzFR, FzRL, FzRR]

    // ---- 车轮运动学（车体系：+x 前，+y 左） ----
    const speed = Math.hypot(this.vLon, this.vLat)
    const steerL = this.steerAngle
    const steerR = this.steerAngle
    const halfT = p.trackWidth / 2

    // 轮位（车体系）
    const wheelPos = [
      { fx: this.Lf, fy: halfT, steer: steerL },
      { fx: this.Lf, fy: -halfT, steer: steerR },
      { fx: -this.Lr, fy: halfT, steer: 0 },
      { fx: -this.Lr, fy: -halfT, steer: 0 }
    ]

    // 制动/驱动分配
    const brakePerWheel = (this.brake * p.maxBrakeTorque) / 2
    const frontBrake = brakePerWheel * p.brakeBias / (p.brakeBias + (1 - p.brakeBias)) * 2
    const rearBrake = brakePerWheel * (1 - p.brakeBias) / (p.brakeBias + (1 - p.brakeBias)) * 2
    // 驱动扭矩：转速特性曲线（肌肉车：峰值 4200rpm，红线回落）
    const torqueFactor = lookup(TORQUE_RPM, this._engineRpm())
    const engineTorqueCrank = 480 * torqueFactor * (0.35 + 0.65 * this.throttle)
    const gearRatio = p.gearRatios[this.gear] * p.finalDrive
    const driveTorqueAxle = engineTorqueCrank * gearRatio * 0.86 // 传动效率
    const driveSign = this.reverse > 0 ? -1 : 1

    let FxSum = 0, FySum = 0, MzSum = 0
    const S = new Array(4)
    // 循环前快照轮速：保证左右轮使用同一拍轮速（避免左右不对称产生虚假横摆力矩）
    const spinF0 = this.wheelSpinFront
    const spinR0 = this.wheelSpinRear
    let dSpinF = 0, dSpinR = 0

    for (let i = 0; i < 4; i++) {
      const w = wheelPos[i]
      const isFront = i < 2
      const isLeft = i % 2 === 0
      const Fz = this.fzWheels[i]

      // 车体速度（车体系）+ 刚体旋转切向速度 ω×r = (−ω·fy, +ω·fx)
      // 左转(ω>0)：前轴速度偏左(+ω·fx)，后轴偏右(−ω·fx)——符号错误会导致后轮
      // 从“阻尼横摆”变为“助力旋转”（爆旋），已修正
      const vxV = this.vLon - this.yawRate * w.fy
      const vyV = this.vLat + this.yawRate * w.fx
      // 旋转到轮面坐标系（steer>0 = 左转）
      const cs = Math.cos(w.steer), sn = Math.sin(w.steer)
      const vxW = vxV * cs + vyV * sn
      const vyW = -vxV * sn + vyV * cs

      // 侧偏角（轮面系速度角）
      const alpha = Math.atan2(vyW, Math.abs(vxW) + 0.5)

      // 滑移率（轮速 vs 车速；驱动>0，制动<0）——使用循环前快照轮速
      const spin = isFront ? spinF0 : spinR0
      const wheelSpeed = spin * p.wheelRadius
      let kappa = 0
      let inBrake = false
      const driveWheel = p.driveAxle === 'rear' ? !isFront : isFront
      if (this.throttle > 0.02 && driveWheel) {
        kappa = (wheelSpeed - vxW) / Math.max(Math.abs(vxW), 1.5)
      } else if (this.brake > 0.02) {
        // 制动：轮速低于车速 → 负滑移 → 制动力（符号已验证）
        kappa = (wheelSpeed - vxW) / Math.max(Math.abs(wheelSpeed), 1.5)
        inBrake = true
      }
      kappa = clamp(kappa, -1, 1)
      // 制动分支中不允许产生驱动力（ABS 释放瞬间 κ 翻正的尖峰抑制；不影响驱动分支）
      if (inBrake && kappa > 0) kappa = 0

      // 轮胎力
      const tp = TIRE_PARAMS[isFront ? 'front' : 'rear']
      const f = tireForce({ alpha, kappa, Fz, B: tp.B, C: tp.C, D: tp.D, E: tp.E, mu: this.mu })
      // 轮面→车体系
      const cos = Math.cos(w.steer), sin = Math.sin(w.steer)
      const FxVeh = f.Fx * cos - f.Fy * sin
      const FyVeh = f.Fx * sin + f.Fy * cos
      FxSum += FxVeh
      FySum += FyVeh
      MzSum += w.fx * FyVeh - w.fy * FxVeh // τz = r×F：fx·Fy − fy·Fx

      // 轮速积分（驱动/制动扭矩 vs 地面力）——先累加，循环结束后统一提交
      let Tdrive = 0, Tbrake = 0
      if (p.driveAxle === 'rear' && !isFront) Tdrive = driveSign * (isLeft ? driveTorqueAxle / 2 : driveTorqueAxle / 2)
      if (isFront) Tbrake = frontBrake / 2
      else Tbrake = rearBrake / 2
      if (this.brake <= 0.02) Tbrake = 0
      // ABS 滑移率控制：制动滑移过峰（κ<-0.25）即释放部分制动扭矩，
      // 防止离散积分下轮速极限环振荡（锁死↔空转）导致制动效率减半
      if (this.brake > 0.02 && kappa < -0.25) Tbrake *= 0.55
      // 非驱动轴（前轮）自由滚动：除制动外始终运动学跟随车速（保证轮向与行驶方向一致）
      if (isFront && this.brake <= 0.02) {
        this.wheelSpinFront = vxW / p.wheelRadius
      } else {
        const Tnet = Tdrive - Tbrake - f.Fx * p.wheelRadius
        const spinDot = Tnet / p.wheelInertia
        if (isFront) dSpinF += spinDot * dt
        else dSpinR += spinDot * dt
      }

      S[i] = { alpha, kappa, Fx: f.Fx, Fy: f.Fy }
      this.wheelForces[i] = { Fx: f.Fx, Fy: f.Fy }
      this.slipAngles[i] = alpha
      this.kappas[i] = kappa
    }

    // 统一提交轮速积分（前轴非制动时已在循环内做运动学约束，此处只提交积分量）
    this.wheelSpinFront += dSpinF
    this.wheelSpinRear += dSpinR
    // 约束1：轮速不反向疯转（倒车除外）
    if (this.wheelSpinFront < 0 && this.throttle > 0 && this.reverse === 0) this.wheelSpinFront = 0
    if (this.wheelSpinRear < 0 && this.throttle > 0 && this.reverse === 0) this.wheelSpinRear = 0
    // 约束2：前进中制动时轮速不得反向（防低速锁死翻转→κ 符号震荡失稳）
    if (this.brake > 0.02 && this.vLon > 0.3) {
      if (this.wheelSpinFront < 0) this.wheelSpinFront = 0
      if (this.wheelSpinRear < 0) this.wheelSpinRear = 0
    }
    // 约束3：重刹低速完全停稳（消除末端蠕行振荡；轻刹/随机操作不受影响）
    if (this.brake > 0.4 && Math.hypot(this.vLon, this.vLat) < 0.4 && this.vLon > -0.1) {
      this.vLon = 0; this.vLat = 0
      this.wheelSpinFront = 0; this.wheelSpinRear = 0
      this.yawRate *= 0.7
    }

    // ---- 阻力 ----
    const drag = 0.5 * RHO * p.dragCoef * p.frontalArea * this.vLon * Math.abs(this.vLon)
    const rolling = p.rollingCoef * p.mass * G * Math.sign(this.vLon)
    FxSum -= drag + rolling

    // ---- 刚体积分（半隐式欧拉） ----
    const ax = FxSum / p.mass
    const ay = FySum / p.mass
    const omegaDot = MzSum / p.yawInertia
    this.yawRate += omegaDot * dt
    this.vLon += ax * dt
    this.vLat += ay * dt
    // 横摆与侧滑速度的耦合修正（稳定化）
    this.vLon += this.vLat * this.yawRate * dt * 0.0 // 保留纯运动学积分
    this.yaw += this.yawRate * dt
    // 世界系（车体系 +x 前、+y 左 → 世界 x 东、z 南）
    // f̂=(cosψ, −sinψ) 前向，l̂=(−sinψ, −cosψ) 左侧
    const cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw)
    this.posX += (this.vLon * cosY - this.vLat * sinY) * dt
    this.posZ += (-this.vLon * sinY - this.vLat * cosY) * dt

    this.accelLon = ax
    this.accelLat = ay
    this.rpmEngine = this._engineRpm()

    return this.snapshot()
  }

  /** 世界系速度（车体系 +x 前、+y 左 → 世界 x 东、z 南） */
  worldVelocity() {
    const cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw)
    return { x: this.vLon * cosY - this.vLat * sinY, z: -this.vLon * sinY - this.vLat * cosY }
  }

  snapshot() {
    return {
      pos: { x: this.posX, z: this.posZ },
      yaw: this.yaw, yawRate: this.yawRate,
      vLon: this.vLon, vLat: this.vLat,
      speed: Math.hypot(this.vLon, this.vLat),
      gear: this.gear,
      rpm: this.rpmEngine,
      throttle: this.throttle,
      brake: this.brake,
      steerAngle: this.steerAngle,
      accelLon: this.accelLon, accelLat: this.accelLat,
      slipAngles: [...this.slipAngles],
      fzWheels: [...this.fzWheels]
    }
  }
}

// ---------------------------------------------------------------------------
// 视觉姿态（供渲染层）：加速抬头、制动点头、转向向弯外侧倾
// 语义：pitchNoseUp>0 = 车头抬起；rollRight>0 = 车身向右倾（左弯外侧）
// 历史 bug（加速点头/减速抬头/转向侧沉）即此处的符号约定错误
// ---------------------------------------------------------------------------
export function visualPose(snap) {
  const K_PITCH = 0.0016 // rad per m/s²
  const K_ROLL = 0.0012
  return {
    pitchNoseUp: clamp(snap.accelLon * K_PITCH, -0.10, 0.10), // 加速 → 抬头
    rollRight: clamp(snap.accelLat * K_ROLL, -0.08, 0.08)     // 左转(ay>0) → 向弯外(右)倾
  }
}
