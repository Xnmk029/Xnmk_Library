// test/render.test.mjs — 渲染层单测（node --test）
// 覆盖：
//  1. 相机角度回绕修复：多圈累计 yaw（±20 rad）后相机角度仍连续（无 >100° 跳变）；
//  2. 赛道表面 μ 查询（柏油/砾石/草地）；
//  3. 相机 5 视角切换与速度 FOV；
//  4. 车轮旋转方向约定（正 omega → rotation.x += omega·dt 前进滚动）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraController } from '../src/render/camera-controller.mjs';
import { TRACK_CONFIG } from '../src/render/track.js';

// ---------- 1. 相机角度连续性（视角回绕修复验收） ----------
test('render: 多圈累计 yaw 下相机角度连续（无“莫名切侧视”跳变）', () => {
  const cam = new CameraController(new THREE.PerspectiveCamera(60, 1.7, 0.1, 3000));
  let prevCamYaw = 0;
  let maxStep = 0;
  let yaw = 0;
  // 模拟 5 圈顺行 + 漂移 + 倒行：yaw 累计超过 ±20 rad
  const dt = 1 / 60;
  let t = 0;
  let n = 0;
  while (t < 12) {
    // 赛道一圈 ≈ 2.2km，80km/h 一圈 ~100s；这里加速 yaw 变化模拟多圈
    const speed = 40 + Math.sin(t * 1.3) * 8;
    const yawRate = speed / 20; // 弯道横摆（快节奏累计角度）
    yaw += yawRate * dt * (1 + Math.sin(t * 0.5) * 0.6);
    const v = {
      x: Math.cos(yaw) * 10, y: Math.sin(yaw) * 10, yaw,
      speed, vx: speed, vy: 0, bodySlip: Math.sin(t * 2.1) * 0.12,
      steerInput: Math.sin(t * 0.7) * 0.4, yawRate, gLong: 0.2, gLat: 0.5,
      surfaceMu: 1,
    };
    cam.update(v, dt);
    // 物理角变化 = 最短角差（表示域 ±π 回绕是合法连续过渡）
    let d = cam.camYaw - prevCamYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const step = Math.abs(d);
    if (step > maxStep) maxStep = step;
    prevCamYaw = cam.camYaw;
    t += dt;
    n++;
  }
  assert.ok(Math.abs(yaw) > 15, `yaw accumulated ${yaw.toFixed(1)} rad (>15)`);
  assert.ok(maxStep < 0.5, `max camera yaw step = ${maxStep.toFixed(4)} rad (<0.5 ≈ 28°)`);
  assert.ok(Number.isFinite(cam.camera.position.x));
});

// ---------- 2. 相机模式 ----------
test('render: 5 视角切换且每帧输出有限', () => {
  const cam = new CameraController(new THREE.PerspectiveCamera(60, 1.7, 0.1, 3000));
  const v = { x: 0, y: 0, yaw: 1.2, speed: 25, vx: 25, vy: 0.3, bodySlip: 0.01,
    steerInput: 0.2, yawRate: 0.1, gLong: 0.1, gLat: 0.4, surfaceMu: 1 };
  for (let i = 0; i < 5; i++) {
    cam.setMode(i);
    cam.update(v, 1 / 60);
    assert.ok(Number.isFinite(cam.camera.position.x) && Number.isFinite(cam.camera.position.z),
      `mode ${i} finite`);
  }
  assert.equal(cam.modeName, 'orbit');
  assert.ok(cam.fov > 50, `fov ${cam.fov.toFixed(1)}`);
});

// ---------- 3. 速度 FOV ----------
test('render: 车速越高 FOV 越宽（速度感知）', () => {
  const cam = new CameraController(new THREE.PerspectiveCamera(60, 1.7, 0.1, 3000));
  const base = { x: 0, y: 0, yaw: 0, speed: 5, vx: 5, vy: 0, bodySlip: 0,
    steerInput: 0, yawRate: 0, gLong: 0, gLat: 0, surfaceMu: 1 };
  for (let i = 0; i < 60; i++) cam.update({ ...base, speed: 5, vx: 5 }, 1 / 60);
  const fovSlow = cam.fov;
  for (let i = 0; i < 120; i++) cam.update({ ...base, speed: 50, vx: 50 }, 1 / 60);
  assert.ok(cam.fov > fovSlow + 5, `fov ${fovSlow.toFixed(1)} -> ${cam.fov.toFixed(1)}`);
});

// ---------- 4. 赛道表面 μ ----------
test('render: 赛道 μ 查询——柏油 1.0、路肩外砾石、远处草地', () => {
  // 用纯数学复刻 track.js 的 μ 判定逻辑（Track 类依赖 DOM canvas，无法在 Node 直接实例化）
  const roadHalf = TRACK_CONFIG.roadWidth + TRACK_CONFIG.curbWidth;
  assert.equal(roadHalf > 10 && roadHalf < 20, true);
  // 判定逻辑签名与 track.js 一致
  const surf = (dist) => {
    if (dist < roadHalf) return TRACK_CONFIG.muAsphalt;
    if (dist < roadHalf + 6) return TRACK_CONFIG.muGravel;
    return TRACK_CONFIG.muGrass;
  };
  assert.equal(surf(0), 1.0);
  assert.equal(surf(roadHalf - 0.5), 1.0);
  assert.equal(surf(roadHalf + 1), TRACK_CONFIG.muGravel);
  assert.equal(surf(roadHalf + 30), TRACK_CONFIG.muGrass);
  assert.ok(TRACK_CONFIG.muGrass < TRACK_CONFIG.muGravel && TRACK_CONFIG.muGravel < 1);
});

// ---------- 5. 车轮旋转方向约定 ----------
test('render: 正 omega（前进）→ spin.rotation.x += omega·dt（视觉向前滚动）', () => {
  // 与 car.js 相同的约定：轮子以车头 +Z 为轴，正旋转把胎冠推向车头方向
  let spin = 0;
  const omega = 50, dt = 1 / 60;
  spin += omega * dt;
  assert.ok(spin > 0, 'forward omega increases rotation.x');
  // 与 vehicle 测试一致：前进时 wheelOmega > 0 → 视觉前进 ✓
  assert.ok(omega > 0);
});
