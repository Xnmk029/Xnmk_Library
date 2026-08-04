// 相机 5 模式：追尾/引擎盖/座舱/轮毂/环绕。
// 关键修复：车辆 yaw 连续累加；相机角度统一连续域包装（禁止混用 atan2 包装角）。

export const CAMERA_MODES = ['chase', 'hood', 'cockpit', 'wheel', 'orbit'];

export class ChaseCamera {
  constructor(THREE, camera) {
    this.THREE = THREE;
    this.camera = camera;
    this.mode = 0;
    this.camYaw = 0;
    this.orbitAngle = 0;
    this.smoothPitch = 0;
    this.smoothRoll = 0;
    this.smoothFov = camera.fov;
  }

  setMode(i) {
    this.mode = ((i % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
    return this.mode;
  }

  contAngle(prev, target) {
    let d = target - prev;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return prev + d;
  }

  update(dt, car, time) {
    const T = this.THREE;
    const speed = Math.abs(car.vx);
    const carPos = new T.Vector3(car.x, 0, car.y);
    const yaw = car.yaw;
    // 速度方向角：yaw + bodySlip（相对车头侧滑角，天然连续，禁止混用包装角）
    const bodySlip = Math.atan2(car.vy, Math.max(0.5, Math.abs(car.vx))) * Math.sign(car.vx || 1);
    const velAngle = yaw + bodySlip;
    const fwd = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const look = new T.Vector3().copy(fwd);
    const pos = new T.Vector3();
    const gK = 0.018;
    this.smoothPitch = T.MathUtils.damp(this.smoothPitch, -car.ax * gK, 6, dt);
    this.smoothRoll = T.MathUtils.damp(this.smoothRoll, car.ay * gK * 0.7, 6, dt);

    if (this.mode === 0) { // 追尾
      const dist = 4.0 + speed * 0.055;
      const h = 1.45 + speed * 0.008;
      const targetYaw = yaw + Math.PI;
      this.camYaw = this.contAngle(this.camYaw, targetYaw);
      pos.set(
        carPos.x - Math.sin(this.camYaw) * dist,
        h,
        carPos.z - Math.cos(this.camYaw) * dist
      );
      const lookahead = 2.5 + speed * 0.16;
      const steerLook = car.steerInput * 1.3;
      look.copy(fwd).multiplyScalar(lookahead).add(right.multiplyScalar(steerLook));
      const target = new T.Vector3().copy(carPos).add(look);
      target.y += this.smoothPitch * 8 + 0.2;
      this.camera.position.copy(pos);
      this.camera.lookAt(target);
      this.camera.rotateZ(this.smoothRoll);
      const targetFov = 58 + Math.min(1, speed / 42) * 16;
      this.smoothFov = T.MathUtils.damp(this.smoothFov, targetFov, 5, dt);
      this.camera.fov = this.smoothFov;
      this.camera.updateProjectionMatrix();
    } else if (this.mode === 1) { // 引擎盖
      pos.copy(carPos).addScaledVector(fwd, 1.15).addScaledVector(new T.Vector3(0, 1.02, 0), 1);
      this.camera.position.copy(pos);
      const target = new T.Vector3().copy(carPos).addScaledVector(fwd, 18).addScaledVector(right, car.steerInput * 4);
      target.y = 0.9;
      this.camera.lookAt(target);
      this.camera.rotateZ(this.smoothRoll * 0.5);
    } else if (this.mode === 2) { // 座舱
      pos.copy(carPos).addScaledVector(fwd, 0.35).addScaledVector(new T.Vector3(0, 1.12, 0), 1);
      this.camera.position.copy(pos);
      const target = new T.Vector3().copy(carPos).addScaledVector(fwd, 30).addScaledVector(right, car.steerInput * 6);
      target.y = 1.1;
      this.camera.lookAt(target);
    } else if (this.mode === 3) { // 轮毂
      pos.copy(carPos).addScaledVector(fwd, 1.45).addScaledVector(right, 0.78).addScaledVector(new T.Vector3(0, 0.42, 0), 1);
      this.camera.position.copy(pos);
      const target = new T.Vector3().copy(carPos).addScaledVector(fwd, 4 + car.steerInput * 2).addScaledVector(right, car.steerInput * 1.5);
      target.y = 0.3;
      this.camera.lookAt(target);
    } else { // 环绕
      this.orbitAngle += dt * 0.28;
      pos.copy(carPos).add(new T.Vector3(Math.sin(this.orbitAngle) * 7, 2.4, Math.cos(this.orbitAngle) * 7));
      this.camera.position.copy(pos);
      this.camera.lookAt(carPos);
    }
    // 抖动反馈（追尾/轮毂，随速度）
    if (this.mode === 0 || this.mode === 3) {
      const k = 0.015 * Math.min(1, speed / 35);
      this.camera.position.x += Math.sin(time * 41.3) * k;
      this.camera.position.y += Math.sin(time * 37.7) * k;
    }
    this.camera.updateMatrixWorld();
  }
}
