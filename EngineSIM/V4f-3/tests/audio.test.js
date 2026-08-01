// ============================================================================
// tests/audio.test.js — 引擎音频数学核心验收
// 覆盖：发火间隔、主阶次、转速跟踪、输出边界、断油状态机、实时预算
// 运行：node --test tests/audio.test.js
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FIRING_ORDER_V8_CROSSPLANE, FIRING_INTERVAL_REVS, firingIntervalSec,
  orderFrequency, crankDegPerSec, orderAmplitude, V8_ORDER_PROFILES,
  EngineModel, loadTorque, throttleTorque, clampUnit, firstNonFinite,
  audioBudget, ENGINE_PARAMS, lookup
} from '../src/audio/engine-math.js'

// ---------------------------------------------------------------------------
// 1. 发火顺序与发火间隔
// ---------------------------------------------------------------------------
test('十字曲轴 V8 发火顺序为 8 缸、每 90° 一次', () => {
  assert.equal(FIRING_ORDER_V8_CROSSPLANE.length, 8)
  assert.equal(new Set(FIRING_ORDER_V8_CROSSPLANE).size, 8)
  assert.deepEqual(FIRING_ORDER_V8_CROSSPLANE, [1, 8, 4, 3, 6, 5, 7, 2])
  // 720° / 8 = 90° = 0.25 圈
  assert.equal(FIRING_INTERVAL_REVS, 0.25)
})

test('发火间隔与转速成反比：interval = 15 / rpm', () => {
  assert.ok(Math.abs(firingIntervalSec(800) - 15 / 800) < 1e-12)
  assert.ok(Math.abs(firingIntervalSec(6400) - 15 / 6400) < 1e-12)
  assert.ok(firingIntervalSec(800) > firingIntervalSec(6400))
  // 800rpm: ~18.75ms；6400rpm: ~2.34ms
  assert.ok(firingIntervalSec(800) > 0.015 && firingIntervalSec(800) < 0.025)
  assert.ok(firingIntervalSec(6400) > 0.002 && firingIntervalSec(6400) < 0.003)
})

test('曲轴角速度：rpm * 6 deg/s，推进保持 [0,720)', () => {
  assert.equal(crankDegPerSec(1000), 6000)
  const m = new EngineModel()
  m.rpm = 1000
  m.step(0.1) // 前进 600°
  assert.ok(m.crankAngle >= 0 && m.crankAngle < 720)
  assert.ok(Number.isFinite(m.crankAngle))
})

// ---------------------------------------------------------------------------
// 2. 主阶次频率关系
// ---------------------------------------------------------------------------
test('阶次频率 = rpm/60 × order（0.5/1/2/4/8 阶）', () => {
  const rpm = 6000
  for (const order of [0.5, 1, 2, 4, 8]) {
    assert.ok(Math.abs(orderFrequency(rpm, order) - (rpm / 60) * order) < 1e-9)
  }
  // 6000rpm: 4 阶 = 400Hz、8 阶 = 800Hz、0.5 阶 = 50Hz
  assert.ok(Math.abs(orderFrequency(6000, 4) - 400) < 1e-9)
  assert.ok(Math.abs(orderFrequency(6000, 8) - 800) < 1e-9)
  assert.ok(Math.abs(orderFrequency(6000, 0.5) - 50) < 1e-9)
})

test('阶次配置覆盖主要发动机阶次且振幅表合法', () => {
  const orders = V8_ORDER_PROFILES.map(p => p.order)
  for (const o of [0.5, 1, 1.5, 2, 4, 8]) assert.ok(orders.includes(o))
  for (const p of V8_ORDER_PROFILES) {
    assert.ok(p.curve.length >= 2)
    for (const [r, a] of p.curve) {
      assert.ok(Number.isFinite(r) && Number.isFinite(a))
      assert.ok(a >= 0 && a <= 1, `振幅越界 order=${p.order} rpm=${r} a=${a}`)
    }
  }
})

test('阶次振幅恒在 [0,1] 且负载调制单调放大', () => {
  for (let rpm = 0; rpm <= 8000; rpm += 500) {
    for (const p of V8_ORDER_PROFILES) {
      const a0 = orderAmplitude(rpm, p.order, 0)
      const a1 = orderAmplitude(rpm, p.order, 1)
      assert.ok(Number.isFinite(a0) && a0 >= 0 && a0 <= 1)
      assert.ok(Number.isFinite(a1) && a1 >= 0 && a1 <= 1)
      assert.ok(a1 >= a0, `负载应放大振幅 order=${p.order} rpm=${rpm}`)
    }
  }
})

// ---------------------------------------------------------------------------
// 3. 转速模型：怠速 / 加速 / 断油 / 边界
// ---------------------------------------------------------------------------
test('怠速稳定：零油门保持怠速附近且状态有限', () => {
  const m = new EngineModel()
  m.setThrottle(0)
  for (let i = 0; i < 600; i++) m.step(1 / 60)
  assert.ok(m.rpm > 400 && m.rpm < 1100, `怠速漂移过大: ${m.rpm}`)
  const snap = m.snapshot()
  assert.equal(firstNonFinite(snap.rpm, snap.throttle, snap.load, snap.torqueNet), null)
})

test('全油门加速可达高转（转速跟踪）', () => {
  const m = new EngineModel()
  m.setThrottle(1)
  for (let i = 0; i < 60 * 10; i++) m.step(1 / 60)
  assert.ok(m.rpm > 4500, `10s 全油门应超过 4500rpm，实际 ${m.rpm}`)
  assert.ok(m.rpm <= ENGINE_PARAMS.maxRpm)
})

test('断油状态机：高转收油触发点火切断，回落恢复', () => {
  const m = new EngineModel()
  m.setThrottle(1)
  for (let i = 0; i < 60 * 8; i++) m.step(1 / 60)
  assert.ok(m.rpm > ENGINE_PARAMS.fuelCutRpm, `需先拉到高转，实际 ${m.rpm}`)
  m.setThrottle(0)
  m.step(1 / 60)
  assert.equal(m.fuelCut, true, '高转收油应立即断油')
  // 断油后转速应持续下降
  const before = m.rpm
  for (let i = 0; i < 120; i++) m.step(1 / 60)
  assert.ok(m.rpm < before, '断油后转速应下降')
  for (let i = 0; i < 60 * 8; i++) m.step(1 / 60)
  assert.equal(m.fuelCut, false, '回落到 rejoin 转速以下应恢复点火')
  assert.ok(m.rpm < ENGINE_PARAMS.fuelRejoinRpm + 200)
})

test('30 秒随机输入长跑：全程数值有限、转速不越界', () => {
  const m = new EngineModel()
  let seed = 12345
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let i = 0; i < 60 * 30; i++) {
    m.setThrottle(rnd())
    m.step(1 / 60)
    const s = m.snapshot()
    assert.equal(firstNonFinite(s.rpm, s.throttle, s.load, s.torqueNet, s.crankAngle), null)
    assert.ok(s.rpm >= 0 && s.rpm <= ENGINE_PARAMS.maxRpm + 1e-6)
  }
})

test('负载/油门扭矩与 lookup 表行为正确', () => {
  assert.ok(loadTorque(0) > 0 && loadTorque(6000) > loadTorque(0))
  assert.equal(throttleTorque(4000, 0), 0)
  assert.ok(throttleTorque(4200, 1) > throttleTorque(1000, 1))
  assert.equal(lookup([[0, 0], [10, 100]], 5), 50)
  assert.equal(lookup([[0, 0], [10, 100]], 20), 100) // 钳制上界
  assert.equal(lookup([[0, 0], [10, 100]], -5), 0)   // 钳制下界
})

// ---------------------------------------------------------------------------
// 4. 数值防护与预算
// ---------------------------------------------------------------------------
test('firstNonFinite 能捕获 NaN/Infinity', () => {
  assert.equal(firstNonFinite(1, 2, 3), null)
  assert.ok(Number.isNaN(firstNonFinite(1, NaN, 3)))
  assert.equal(firstNonFinite(1, Infinity, 3), Infinity)
  assert.equal(clampUnit(-0.5), 0)
  assert.equal(clampUnit(1.5), 1)
})

test('实时预算：6 个阶次振荡器 + 2 噪声路径（低性能要求）', () => {
  const b = audioBudget()
  assert.equal(b.oscillators, 6)
  assert.equal(b.noisePaths, 2)
  assert.ok(b.totalNodes < 40)
})
