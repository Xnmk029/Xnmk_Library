// ============================================================================
// tests/physics.test.js — 车辆物理与手感优化验收
// 覆盖：魔术公式、双轨动力学（加速/制动/转向/载荷转移/车轮方向）、
//       手感辅助（防推头/自回正/横摆阻尼/低速淡出）、全程数值边界
// 运行：node --test tests/physics.test.js
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { magicFormula, tireForce, TIRE_PARAMS } from '../src/physics/tire.js'
import { Vehicle, VEHICLE_PARAMS, visualPose } from '../src/physics/vehicle.js'
import { SteeringAssist, LowPassSmoother, smoothstepNorm } from '../src/physics/steering-assist.js'
import { firstNonFinite } from '../src/audio/engine-math.js'

const DT = 1 / 120

function run(vehicle, seconds, inputsFn) {
  const steps = Math.floor(seconds / DT)
  let snap = null
  for (let i = 0; i < steps; i++) {
    snap = vehicle.step(DT, inputsFn ? inputsFn(i, snap) : {})
  }
  return snap
}

// ---------------------------------------------------------------------------
// 1. 魔术公式轮胎
// ---------------------------------------------------------------------------
test('魔术公式：α=0 无力、反对称、峰值约 8~10°、饱和后回落', () => {
  const p = TIRE_PARAMS.front
  const fy = a => tireForce({ alpha: a, kappa: 0, Fz: 5000, B: p.B, C: p.C, D: p.D, E: p.E }).Fy
  assert.ok(Math.abs(fy(0)) < 1e-9, 'α=0 侧向力应为 0')
  assert.ok(Math.abs(fy(0.1) + fy(-0.1)) < 1e-6, '反对称 Fy(-α) = -Fy(α)')
  // 0~8° 递增（未过峰）
  assert.ok(Math.abs(fy(0.05)) < Math.abs(fy(0.14)), '5° 力应小于 8° 附近')
  // 超过峰值后回落（饱和）
  assert.ok(Math.abs(fy(0.14)) > Math.abs(fy(0.6)), '大侧偏角后应饱和回落')
  // 侧向力与滑移方向相反（α>0 → Fy<0）
  assert.ok(fy(0.1) < 0, '速度在轮面右侧(α>0) → 力应向左(Fy<0)')
})

test('魔术公式：纵向力 κ>0 驱动为正，载荷线性缩放', () => {
  const p = TIRE_PARAMS.rear
  const fx = (k, Fz) => tireForce({ alpha: 0, kappa: k, Fz, B: p.B, C: p.C, D: p.D, E: p.E }).Fx
  assert.ok(Math.abs(fx(0, 5000)) < 1e-9)
  assert.ok(fx(0.1, 5000) > 0, '驱动滑移 κ>0 → 驱动力 > 0')
  assert.ok(fx(-0.1, 5000) < 0, '制动滑移 κ<0 → 制动力 < 0')
  const f1 = fx(0.1, 4000)
  const f2 = fx(0.1, 8000)
  assert.ok(Math.abs(f2 / f1 - 2) < 0.05, 'D ∝ Fz：载荷加倍力加倍')
})

// ---------------------------------------------------------------------------
// 2. 车辆动力学
// ---------------------------------------------------------------------------
test('静止稳定性：无输入 2 秒不漂移、数值有限', () => {
  const v = new Vehicle()
  const snap = run(v, 2, () => ({ throttle: 0, brake: 0, steerAngle: 0 }))
  assert.ok(Math.abs(snap.speed) < 0.1, `静止漂移过大: ${snap.speed}`)
  assert.equal(firstNonFinite(snap.vLon, snap.vLat, snap.yawRate, snap.rpm), null)
})

test('加速：全油门 8 秒车速超过 25 m/s，发动机转速升高', () => {
  const v = new Vehicle()
  const snap = run(v, 8, () => ({ throttle: 1, brake: 0, steerAngle: 0 }))
  assert.ok(snap.speed > 25, `8s 全油门应 > 25 m/s，实际 ${snap.speed}`)
  assert.ok(snap.rpm > 1500, `转速应升高，实际 ${snap.rpm}`)
})

test('制动：从高速制动可减速至近停', () => {
  const v = new Vehicle()
  run(v, 8, () => ({ throttle: 1, brake: 0, steerAngle: 0 }))
  const snap = run(v, 8, () => ({ throttle: 0, brake: 0.9, steerAngle: 0 }))
  assert.ok(snap.speed < 3, `8s 制动后应接近停止，实际 ${snap.speed} m/s`)
})

test('转向方向：左打方向 → 左转（yaw>0），右打 → 右转（yaw<0）', () => {
  const v1 = new Vehicle()
  run(v1, 6, () => ({ throttle: 0.45, brake: 0, steerAngle: 0.30 }))
  assert.ok(v1.yaw > 0.2, `左转 yaw 应为正，实际 ${v1.yaw}`)
  assert.ok(v1.yawRate > 0)

  const v2 = new Vehicle()
  run(v2, 6, () => ({ throttle: 0.45, brake: 0, steerAngle: -0.30 }))
  assert.ok(v2.yaw < -0.2, `右转 yaw 应为负，实际 ${v2.yaw}`)
  assert.ok(v2.yawRate < 0)
})

test('转弯半径合理性：约 20 m/s 滑行过弯，半径在抓地力与几何范围内', () => {
  const v = new Vehicle()
  run(v, 3.5, () => ({ throttle: 1, brake: 0, steerAngle: 0 }))      // 加速
  run(v, 1.0, () => ({ throttle: 0, brake: 0.5, steerAngle: 0 }))      // 制动降至可控速度
  run(v, 2.5, () => ({ throttle: 0, brake: 0, steerAngle: 0.08 }))     // 松油滑行 + 小角度转向
  const { speed, yawRate } = v.snapshot()
  assert.ok(speed > 10 && speed < 26, `测试工况速度应为 10~26 m/s，实际 ${speed.toFixed(1)}`)
  assert.ok(yawRate > 0, `左转 yawRate 应为正，实际 ${yawRate}`)
  const radius = speed / Math.max(1e-6, Math.abs(yawRate))
  // 几何半径 L/tan(0.08)≈35.6m；抓地力下限 v²/μg≈20m
  assert.ok(radius > 20 && radius < 90, `半径 ${radius.toFixed(1)}m 超出合理范围`)
})

test('载荷转移：加速后轴增载、制动前轴增载', () => {
  const v = new Vehicle()
  run(v, 2.5, () => ({ throttle: 1, brake: 0, steerAngle: 0 })) // 强加速段采样
  const accel = v.snapshot()
  const rearAccel = accel.fzWheels[2] + accel.fzWheels[3]
  const frontAccel = accel.fzWheels[0] + accel.fzWheels[1]
  assert.ok(rearAccel > frontAccel, `加速应后轴增载: 前${frontAccel.toFixed(0)} 后${rearAccel.toFixed(0)}`)

  run(v, 2, () => ({ throttle: 0, brake: 0.9, steerAngle: 0 })) // 强制动段采样
  const brakeSnap = v.snapshot()
  const frontBrake = brakeSnap.fzWheels[0] + brakeSnap.fzWheels[1]
  const rearBrake = brakeSnap.fzWheels[2] + brakeSnap.fzWheels[3]
  assert.ok(frontBrake > rearBrake, `制动应前轴增载: 前${frontBrake.toFixed(0)} 后${rearBrake.toFixed(0)}`)
})

test('车轮旋转方向与前进方向一致（清单#12：方向反了问题）', () => {
  const v = new Vehicle()
  run(v, 6, () => ({ throttle: 0.8, brake: 0, steerAngle: 0 }))
  const snap = v.snapshot()
  assert.ok(snap.speed > 5)
  assert.ok(v.wheelSpinFront > 0 && v.wheelSpinRear > 0, `前进时轮速应为正: F=${v.wheelSpinFront} R=${v.wheelSpinRear}`)
  assert.ok(v.wheelSpinRear > v.wheelSpinFront || Math.abs(v.wheelSpinRear - v.wheelSpinFront) < 2)
})

test('倒车：reverse 输入产生反向运动', () => {
  const v = new Vehicle()
  run(v, 5, () => ({ throttle: 0.5, brake: 0, reverse: 1, steerAngle: 0 }))
  assert.ok(v.vLon < -2, `倒车 vLon 应为负，实际 ${v.vLon}`)
  assert.ok(v.wheelSpinRear < 0, '倒车后轮速应为负')
})

test('视觉姿态语义：加速抬头、制动点头、左转向外倾（清单#8）', () => {
  const v = new Vehicle()
  run(v, 1.5, () => ({ throttle: 1, brake: 0, steerAngle: 0 })) // 强加速段
  const accelPose = visualPose(v.snapshot())
  assert.ok(v.snapshot().accelLon > 1, `测试段应有明显加速度，实际 ${v.snapshot().accelLon}`)
  assert.ok(accelPose.pitchNoseUp > 0, `加速应抬头，实际 ${accelPose.pitchNoseUp}`)

  run(v, 1.2, () => ({ throttle: 0, brake: 0.9, steerAngle: 0 })) // 强制动段
  const brakePose = visualPose(v.snapshot())
  assert.ok(brakePose.pitchNoseUp < 0, `制动应点头，实际 ${brakePose.pitchNoseUp}`)

  const v2 = new Vehicle()
  run(v2, 3, () => ({ throttle: 0.3, brake: 0, steerAngle: 0.30 })) // 中速转向段
  const turnPose = visualPose(v2.snapshot())
  assert.ok(v2.snapshot().accelLat > 0.5, '左转应有明显侧向加速度')
  assert.ok(turnPose.rollRight > 0, `左转应向右(弯外)倾，实际 ${turnPose.rollRight}`)
})

test('30 秒随机输入长跑：无 NaN、速度有界', () => {
  const v = new Vehicle()
  let seed = 42
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  let maxSpeed = 0
  for (let i = 0; i < 30 / DT; i++) {
    const snap = v.step(DT, {
      throttle: rnd(), brake: rnd() * 0.5,
      steerAngle: (rnd() * 2 - 1) * VEHICLE_PARAMS.maxSteerLock
    })
    assert.equal(firstNonFinite(snap.pos.x, snap.pos.z, snap.yaw, snap.yawRate, snap.vLon, snap.vLat, snap.rpm), null)
    assert.ok(snap.speed < 80, `速度越界 ${snap.speed}`)
    maxSpeed = Math.max(maxSpeed, snap.speed)
  }
  assert.ok(maxSpeed > 1, '长跑应包含运动')
})

// ---------------------------------------------------------------------------
// 3. 手感优化（防推头 / 自回正 / 横摆阻尼 / 低速淡出）
// ---------------------------------------------------------------------------
const assistState = (over = {}) => ({
  vLat: 0, vLon: 15, yawRate: 0, mass: 1650,
  downforce: 1650 * 9.81, mu: 1.0, wheelbase: 2.85,
  steeringLock: 0.42, alphaRear: 0, slipRatioFront: 0, grounded: true, dt: DT,
  ...over
})

test('低速淡出：速度 < 1.8 km/h 时输出 = 原始输入', () => {
  const a = new SteeringAssist()
  const out = a.update(1.0, assistState({ vLon: 0, vLat: 0 }))
  assert.ok(Math.abs(out - 1.0) < 1e-6, `低速应直通，实际 ${out}`)
})

test('高速满舵：防推头限幅使输出小于输入', () => {
  const a = new SteeringAssist()
  const out = a.update(1.0, assistState({ vLon: 30 }))
  assert.ok(out < 1.0, `高速满舵应被限幅，实际 ${out}`)
  assert.ok(out > 0, '不应反向')
})

test('速度越高限幅越强', () => {
  const a = new SteeringAssist()
  const outSlow = a.update(1.0, assistState({ vLon: 18 }))
  const outFast = a.update(1.0, assistState({ vLon: 45 }))
  assert.ok(outFast < outSlow, `高速限幅应更强: ${outFast} < ${outSlow}`)
})

test('自回正：松手(vLat≠0)时自动打向滑移方向', () => {
  const a = new SteeringAssist()
  // 预热平滑器（实际运行每帧调用）
  for (let i = 0; i < 60; i++) a.update(0, assistState({ vLon: 15, vLat: 1.5, yawRate: 0 }))
  const out = a.update(0, assistState({ vLon: 15, vLat: 1.5, yawRate: 0 }))
  assert.ok(Math.abs(out) > 0.01, '有侧滑时应产生自回正输出')
  assert.ok(out > 0, `自回正方向应同 vLat 符号，实际 ${out} (vLat=1.5)`)
  const a2 = new SteeringAssist()
  for (let i = 0; i < 60; i++) a2.update(0, assistState({ vLon: 15, vLat: -1.5 }))
  const out2 = a2.update(0, assistState({ vLon: 15, vLat: -1.5 }))
  assert.ok(out2 < 0, 'vLat<0 时应反向')
})

test('横摆阻尼：无输入时横摆被抑制', () => {
  const a = new SteeringAssist()
  const out = a.update(0, assistState({ vLat: 0, yawRate: 2.5 }))
  assert.ok(out < 0, `横摆阻尼应为负向修正，实际 ${out}`)
})

test('反打救车：漂移中反打时限幅拓宽（允许更大反打角）', () => {
  const a = new SteeringAssist()
  // 尾部左甩（alphaRear>0），玩家向右反打（input<0，与 vLat 反向）
  const out = a.update(-0.8, assistState({ vLon: 15, vLat: 2.0, alphaRear: 0.12, yawRate: 1.0 }))
  assert.ok(Math.abs(out) > 0, '应输出')
  assert.ok(out < 0, '反打方向输出为负')
  assert.ok(Math.abs(out) > 0.3, '反打限幅应明显放宽')
})

test('辅助输出恒在 [-1,1] 且数值有限', () => {
  const a = new SteeringAssist()
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let i = 0; i < 2000; i++) {
    const out = a.update(rnd() * 2 - 1, assistState({
      vLon: rnd() * 40, vLat: (rnd() * 2 - 1) * 6,
      yawRate: (rnd() * 2 - 1) * 3, alphaRear: (rnd() * 2 - 1) * 0.3,
      slipRatioFront: rnd() * 2, grounded: true
    }))
    assert.ok(Number.isFinite(out) && out >= -1 && out <= 1, `越界输出 ${out}`)
  }
})

test('低通平滑器与 smoothstep 行为', () => {
  const s = new LowPassSmoother(10, 0)
  s.update(1, 0.05); s.update(1, 0.05)
  assert.ok(s.state > 0 && s.state < 1, `渐进逼近，实际 ${s.state}`)
  assert.equal(smoothstepNorm(0, 2, 5), 0)
  assert.equal(smoothstepNorm(10, 2, 5), 1)
  assert.ok(smoothstepNorm(3.5, 2, 5) > 0 && smoothstepNorm(3.5, 2, 5) < 1)
})
