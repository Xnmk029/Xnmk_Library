// src/render/camera-controller.mjs — 相机 5 视角
//
// 后追（chase）视角按“增强驾驶”思路优化：
//   - 转向预判（steering look-ahead）：视角 yaw 跟随（车头角 + 转向角 × 速度系数），
//     打舵时提前转动视角，出弯更跟手；
//   - G 力姿态：俯仰/横摆/侧倾随纵向/横向加速度（抬头/点头/侧倾）；
//   - 速度 FOV：车速越高视野越宽；
//   - 动态前瞻点：目标点随车速前移；
//   - 抖动反馈：路缘/颠簸的轻微抖动。
//
// ★ 相机角度回绕修复（早期遗留 bug 根因）：
//   车辆 yaw 连续累加可越过 ±180°（甚至多圈累计）；若直接混用“原始 yaw”与
//   “atan2 包装角”，每过 ±180° 边界相机瞬间跳 ~180°（表现为“莫名切到侧视”）。
//   修复：相机维护自己的连续角度状态（camYaw），所有角度统一包装域
//   [−π, π)，速度方向用 velAngle = yaw + bodySlip（相对车头侧滑角，天然连续），
//   禁止混用原始 yaw 与包装角。顺行过缝 0° 跳变、漂移/侧滑/倒行均为小角度。

import * as THREE from 'three';

const wrapPi = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
// 最短有向角差（目标 - 当前，包装域）
const angleDiff = (target, current) => wrapPi(target - current);

// 非线性时序平滑器（enhanceddriver 思路：快攻击/慢释放，抖动抑制）
class Smoother {
  constructor(attack, release) { this.a = attack; this.r = release; this.v = 0; }
  get(x, dt) {
    const rate = Math.abs(x) > Math.abs(this.v) ? this.a : this.r;
    this.v += Math.min(1, rate * dt) * (x - this.v);
    return this.v;
  }
}

const MODES = ['chase', 'hood', 'cockpit', 'wheel', 'orbit'];

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0;
    this.camYaw = 0;        // 连续（包装域）yaw 状态
    this.camPitch = 0.16;
    this.camDist = 9.2;
    this.camHeight = 3.1;
    this.fov = 62;
    this.shake = 0;
    this.lookAhead = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this._lastPos = new THREE.Vector3();
    this._smoothYawRate = 0;
    // enhanceddriver 风格 G 力平滑器（快攻击/慢释放）
    this.gFwd = new Smoother(6, 2.5);
    this.gSide = new Smoother(6, 2.5);
    this.gSideRoll = new Smoother(5, 2);
    this.steerLookSm = 0;
  }

  cycle() { this.mode = (this.mode + 1) % MODES.length; return MODES[this.mode]; }
  get modeName() { return MODES[this.mode]; }
  setMode(m) { this.mode = Math.max(0, Math.min(MODES.length - 1, m)); }

  // v：车辆快照；dt：秒
  update(v, dt) {
    const carPos = new THREE.Vector3(v.x, 0, v.y);
    const carYaw = v.yaw;
    const speed = Math.abs(v.speed);
    const speedFade = Math.min(1, speed / 12);

    // —— 统一角度域：速度方向 = yaw + bodySlip（连续，不包装）——
    const velAngle = v.yaw + (v.bodySlip || 0);

    // 转向预判：方向盘的平滑输入（enhanceddriver：steeringLookAheadAngle）
    const steer = v.steerInput || 0;
    this.steerLookSm += Math.min(1, 8 * dt) * (steer - this.steerLookSm);
    const lookSteer = this.steerLookSm * 0.5 * speedFade * (this.mode === 0 ? 1 : 0.35);
    const targetYaw = carYaw + lookSteer;

    // 相机 yaw 平滑跟随（包装域差值 → 永不跳变）
    const smoothK = Math.min(1, 5.5 * dt);
    this.camYaw = wrapPi(this.camYaw + angleDiff(targetYaw, this.camYaw) * smoothK);

    // —— G 力姿态（enhanceddriver：阈值去噪 + 非线性平滑 + 速度淡入）——
    const gEffect = Math.min(1, speed / 4);          // 低速时淡化，防怠速抖动
    const thr = 0.05;                                // 激活阈值
    const rawFwd = Math.abs(v.gLong) > thr ? v.gLong : 0;
    const rawSide = Math.abs(v.gLat) > thr ? v.gLat : 0;
    const fwdG = this.gFwd.get(rawFwd, dt) * gEffect;
    const sideG = this.gSide.get(rawSide, dt) * gEffect;
    const sideRollG = this.gSideRoll.get(rawSide, dt) * gEffect;
    // 纵向 G → 俯仰（加速抬头）；侧向 G → 横摆 + 侧倾（方向相反）
    const pitchG = -fwdG * 0.14;
    const sideYawG = -sideG * 0.10;                  // 惯性头拽：侧向 G → 视角反向横摆
    const sideRoll = -sideRollG * 0.16;              // 身体侧倾：侧向 G → 反向滚转
    const yawRateK = THREE.MathUtils.clamp(v.yawRate * 0.8, -0.7, 0.7);
    const gYaw = -yawRateK * 0.35 * speedFade;

    // 速度 FOV
    const targetFov = 58 + Math.min(34, speed * 0.75);
    this.fov += (targetFov - this.fov) * Math.min(1, 2.5 * dt);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // 动态前瞻点
    const lookAheadDist = Math.min(14, 2.2 + speed * 0.22);
    this.lookAhead.set(
      carPos.x - Math.sin(velAngle) * lookAheadDist * 0.4,
      0.9,
      carPos.z - Math.cos(velAngle) * lookAheadDist * 0.4
    );

    // 抖动（路缘/颠簸）
    this.shake *= Math.max(0, 1 - 6 * dt);
    if (v.surfaceMu < 0.6 && speed > 6) this.shake += 0.3 * dt;
    const shX = (Math.random() - 0.5) * this.shake * 0.08;
    const shY = (Math.random() - 0.5) * this.shake * 0.06;

    // —— 各模式 ——
    const c = Math.cos(this.camYaw), s = Math.sin(this.camYaw);
    let eye, target;
    if (this.mode === 0) {
      // 后追
      const dist = this.camDist * (0.9 + speed * 0.012);
      const height = this.camHeight * (0.85 + speed * 0.015) + 0.4;
      eye = new THREE.Vector3(
        carPos.x + s * dist * 0.55 + shX,
        height + pitchG * 1.2 + shY,
        carPos.z + c * dist * 0.55
      );
      target = this.lookAhead.clone().add(new THREE.Vector3(0, pitchG * 0.6, 0));
    } else if (this.mode === 1) {
      // 引擎盖
      eye = new THREE.Vector3(carPos.x - s * 2.6, 1.05 + pitchG * 0.8, carPos.z - c * 2.6);
      target = new THREE.Vector3(carPos.x - s * 40, 0.8, carPos.z - c * 40);
    } else if (this.mode === 2) {
      // 座舱
      eye = new THREE.Vector3(carPos.x - s * 0.12, 1.25 + pitchG * 0.9 + shY * 0.5, carPos.z - c * 0.12);
      target = new THREE.Vector3(carPos.x - s * 30, 1.0, carPos.z - c * 30);
      this.camera.fov = this.fov - 6;
      this.camera.updateProjectionMatrix();
    } else if (this.mode === 3) {
      // 轮毂
      eye = new THREE.Vector3(carPos.x + s * 1.1 - Math.cos(this.camYaw) * 1.3, 0.45, carPos.z + c * 1.1 - Math.sin(this.camYaw) * 1.3);
      target = carPos.clone().add(new THREE.Vector3(0, 0.7, 0));
    } else {
      // 环绕
      const orbit = performance.now() / 1000 * 0.4;
      const r = 8.5;
      eye = new THREE.Vector3(
        carPos.x + Math.cos(orbit) * r,
        3.2,
        carPos.z + Math.sin(orbit) * r
      );
      target = carPos.clone().add(new THREE.Vector3(0, 1, 0));
    }

    // G 力横摆/侧倾（chase/hood）
    if (this.mode <= 1) {
      const dir = target.clone().sub(eye).normalize();
      // 绕视线轴侧倾
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      target.add(right.multiplyScalar(sideRoll * 3.2 + gYaw * 1.4 + sideYawG * 1.6));
    }

    this.camera.position.lerp(eye, Math.min(1, 8 * dt));
    this._target = target;
    this.camera.lookAt(this._target);
    this._lastPos.copy(carPos);
  }
}
