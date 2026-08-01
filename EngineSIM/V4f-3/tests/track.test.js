// ============================================================================
// tests/track.test.js — 赛道几何与表面分类验收
// 运行：node --test tests/track.test.js
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildTrackCurve, closestOnCurve, classifySurface, TRACK } from '../src/scene/track.js'
import { firstNonFinite } from '../src/audio/engine-math.js'

test('赛道为闭合样条且点全部有限', () => {
  const curve = buildTrackCurve()
  assert.ok(curve.closed, '应闭合')
  const p0 = curve.getPointAt(0)
  const p1 = curve.getPointAt(1)
  assert.ok(p0.distanceTo(p1) < 1e-3, '闭合：t=0 与 t=1 重合')
  for (let i = 0; i <= 40; i++) {
    const p = curve.getPointAt(i / 40)
    assert.equal(firstNonFinite(p.x, p.y, p.z), null)
    assert.ok(Math.abs(p.y) < 1e-6)
  }
  // 曲线总长合理（几百米级赛道）
  const len = curve.getLength()
  assert.ok(len > 600 && len < 3000, `赛道长度异常: ${len.toFixed(0)}m`)
})

test('最近点查询：线上点距离≈0，线外点距离正确', () => {
  const curve = buildTrackCurve()
  const on = curve.getPointAt(0.3)
  const r1 = closestOnCurve(curve, on.x, on.z)
  assert.ok(r1.dist < 0.5, `线上点应近零距离，实际 ${r1.dist.toFixed(2)}`)
  const off = { x: on.x + 200, z: on.z + 200 }
  const r2 = closestOnCurve(curve, off.x, off.z)
  assert.ok(r2.dist > 100, `远处点距离应大，实际 ${r2.dist.toFixed(0)}`)
})

test('表面分类：赛道内柏油 μ=1.0，远草 地 μ=0.55', () => {
  const curve = buildTrackCurve()
  const on = curve.getPointAt(0.5)
  const s1 = classifySurface(curve, on.x, on.z)
  assert.equal(s1.mu, TRACK.muAsphalt)
  assert.equal(s1.onTrack, true)
  const s2 = classifySurface(curve, on.x + 60, on.z + 60)
  assert.equal(s2.mu, TRACK.muGrass)
  assert.equal(s2.onTrack, false)
  const s3 = classifySurface(curve, 0, 0)
  assert.equal(s3.mu, TRACK.muAsphalt, '起点应在赛道上')
})

test('Track 参数合法', () => {
  assert.ok(TRACK.roadWidth > 0)
  assert.ok(TRACK.muAsphalt > TRACK.muGrass)
  assert.ok(TRACK.muGrass > 0.3 && TRACK.muGrass < 0.9)
})
