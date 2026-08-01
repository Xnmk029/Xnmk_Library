// ============================================================================
// tests/input.test.js — 输入归一化与合并验收
// 运行：node --test tests/input.test.js
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeInput, applyDeadzone, SteerSmoother, EdgeTrigger, STEER_DEADZONE } from '../src/input/input-state.js'

const DT = 1 / 60
const empty = () => ({ steer: 0, throttle: 0, brake: 0, reverse: false, handbrake: false, reset: false, camera: false })

test('键盘全油门/全刹车直接合成', () => {
  const out = composeInput({ ...empty(), throttle: 1, brake: 0 }, null, DT)
  assert.equal(out.throttle, 1)
  assert.equal(out.brake, 0)
  const out2 = composeInput({ ...empty(), brake: 1 }, null, DT)
  assert.equal(out2.brake, 1)
})

test('手柄模拟量优先于键盘阶跃', () => {
  const kb = { ...empty(), steer: 1 }
  const pad = { ...empty(), steer: 0.3 }
  const out = composeInput(kb, pad, DT)
  const expected = applyDeadzone(0.3)
  assert.ok(Math.abs(out.steer - expected) < 1e-6, `应取手柄值(含死区)，实际 ${out.steer} 预期 ${expected}`)
  const padFull = { ...empty(), steer: 1 }
  const out2 = composeInput(kb, padFull, DT)
  assert.ok(Math.abs(out2.steer - 1) < 1e-6)
})

test('手柄油门/刹车与键盘取最大值', () => {
  const out = composeInput({ ...empty(), throttle: 1 }, { ...empty(), throttle: 0.5 }, DT)
  assert.equal(out.throttle, 1)
  const out2 = composeInput({ ...empty(), throttle: 0 }, { ...empty(), throttle: 0.8 }, DT)
  assert.equal(out2.throttle, 0.8)
})

test('摇杆死区：小输入归零，线性重映射', () => {
  assert.equal(applyDeadzone(0.02), 0)
  assert.equal(applyDeadzone(0.05), 0)
  assert.ok(applyDeadzone(0.3) > 0.2 && applyDeadzone(0.3) < 0.3)
  assert.equal(applyDeadzone(-0.05), 0)
  assert.ok(applyDeadzone(-0.9) < -0.8)
})

test('键盘转向经平滑渐进（不瞬跳）', () => {
  const smoother = new SteerSmoother(8)
  const o1 = composeInput({ ...empty(), steer: 1 }, null, DT, { smoother })
  assert.ok(o1.steer > 0 && o1.steer < 1, `首拍应渐进，实际 ${o1.steer}`)
  let s = o1.steer
  for (let i = 0; i < 60; i++) s = composeInput({ ...empty(), steer: 1 }, null, DT, { smoother }).steer
  assert.ok(Math.abs(s - 1) < 0.02, `60 帧后应收敛到 1，实际 ${s}`)
  // 回中更快
  for (let i = 0; i < 30; i++) s = composeInput(empty(), null, DT, { smoother }).steer
  assert.ok(Math.abs(s) < 0.05, `30 帧内应回中，实际 ${s}`)
})

test('手柄转向无平滑（直驱，仅死区重映射）', () => {
  const smoother = new SteerSmoother(8)
  const out = composeInput(empty(), { ...empty(), steer: 0.7 }, DT, { smoother })
  const expected = applyDeadzone(0.7)
  assert.ok(Math.abs(out.steer - expected) < 1e-6, `手柄应直通(含死区)，实际 ${out.steer}`)
})

test('按键边沿触发：只有 0→1 瞬间为 true', () => {
  const e = new EdgeTrigger()
  assert.equal(e.poll('camera', false), false)
  assert.equal(e.poll('camera', true), true)
  assert.equal(e.poll('camera', true), false, '持续按住不重复触发')
  assert.equal(e.poll('camera', false), false)
  assert.equal(e.poll('camera', true), true, '松开再按重新触发')
})

test('输出恒有限且有界', () => {
  const smoother = new SteerSmoother()
  for (let i = 0; i < 500; i++) {
    const out = composeInput(
      { steer: Math.sin(i), throttle: i % 2, brake: i % 3 === 0 ? 1 : 0, reverse: i % 7 === 0 },
      { steer: Math.cos(i) * 0.9, throttle: (i % 5) / 5, brake: (i % 4) / 4, reverse: false },
      DT, { smoother })
    for (const v of [out.steer, out.throttle, out.brake]) {
      assert.ok(Number.isFinite(v) && v >= -1.0001 && v <= 1.0001)
    }
  }
})
