'use strict';

const assert = require('node:assert');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { test } = require('./harness.cjs');

const METRICS = pathToFileURL(path.join(__dirname, '..', 'tools', 'experiments', 'vehicle-metrics.mjs')).href;
let M = null;

test('vehicle: 0-100 km/h ≈5.34s（TC 开，后轮峰值滑移 <0.8）', async () => {
  M = M || (await import(METRICS));
  const r = M.launchTest(true);
  assert.ok(r.t100 > 0, '应能到达 100km/h');
  assert.ok(r.t100 >= 4.5 && r.t100 <= 6.0, `0-100 时间 ${r.t100}s 应在 4.5~6.0s`);
  assert.ok(r.peakSlip < 0.8, `TC 开后轮峰值滑移 ${r.peakSlip} 应 <0.8`);
  assert.ok(r.peakSlipSteady < 0.3, `稳态滑移 ${r.peakSlipSteady} 应保持低滑移`);
});

test('vehicle: TC 关烧胎且更慢', async () => {
  M = M || (await import(METRICS));
  const on = M.launchTest(true);
  const off = M.launchTest(false);
  assert.ok(off.peakSlip >= 0.8, `TC 关峰值滑移 ${off.peakSlip} 应烧胎（≥0.8）`);
  assert.ok(off.t100 > on.t100, `TC 关 ${off.t100}s 应慢于 TC 开 ${on.t100}s`);
});

test('vehicle: 100→1 km/h 制动 ≈37.5m', async () => {
  M = M || (await import(METRICS));
  const r = M.brakingTest();
  assert.ok(r.dist >= 34 && r.dist <= 40, `制动距离 ${r.dist.toFixed(1)}m 应在 34~40m`);
  assert.ok(r.peakDecel >= 9, `峰值减速度 ${r.peakDecel.toFixed(2)}m/s² 应 ≥9`);
  assert.ok(Number.isFinite(r.dist));
});

test('vehicle: 稳态弯道峰值 ≥0.85g（实测约 1.02g）', async () => {
  M = M || (await import(METRICS));
  const r = M.corneringTest();
  assert.ok(r.peakG >= 0.85, `弯道峰值 ${r.peakG.toFixed(3)}g 应 ≥0.85g`);
  assert.ok(r.maxVy < 5, `侧滑速度 ${r.maxVy.toFixed(2)}m/s 应保持稳定（<5）`);
});

test('vehicle: 直线 100km/h 5s 无横向漂移', async () => {
  M = M || (await import(METRICS));
  const r = M.straightTest();
  assert.ok(Math.abs(r.drift) < 0.3, `横向漂移 ${r.drift.toExponential(2)}m 应 <0.3m`);
  assert.ok(Math.abs(r.yawDeg) < 0.5, `航向变化 ${r.yawDeg.toExponential(2)}° 应 <0.5°`);
  assert.ok(r.speed >= 95 && r.speed <= 110, `巡航速度 ${r.speed.toFixed(1)}km/h 应在 95~110`);
});

test('vehicle: 30s 随机滥用 0 NaN 且横摆率 ≤28°/s', async () => {
  M = M || (await import(METRICS));
  const r = M.abuseTest(30);
  assert.ok(!r.nan, `第 ${r.at} 秒出现 NaN/Inf`);
  assert.ok(r.maxYawRate <= 28.5, `滥用峰值横摆率 ${r.maxYawRate.toFixed(1)}°/s 应 ≤28°/s`);
  assert.ok(r.maxSpeed < 200, `滥用最高车速 ${r.maxSpeed.toFixed(1)}km/h 应有界`);
});
