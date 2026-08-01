// 四轮双轨车辆模型（纯 JS，无 three 依赖）：
//   - 每轮独立魔术公式 + 相似法复合滑移 + 载荷敏感性 + 侧向一阶松弛
//   - Ackermann 内外轮转角、开式差速器（等扭矩、无静态抓地力上限）、每轮刹车
//   - 半隐式离合器、6 速 + 倒挡 + 终传 3.09、TC/ABS（默认开）、限速器火花切断
//   - 车身系积分保留科里奥利耦合：vx_dot=Fx/m+vy·r、vy_dot=Fy/m−vx·r

import { Tire } from './tire.mjs';
import { Drivetrain, FINAL_DRIVE, DRIVETRAIN_EFF } from './drivetrain.mjs';
import { SteeringAssist } from './steering.mjs';

export const VEHICLE_SPEC = {
  mass: 1850,
  wheelbase: 2.946,
  track: 1.62,
  wheelRadius: 0.352,
  cgHeight: 0.52,
  frontAxleToCg: 1.51,
  rearAxleToCg: 1.436,
  inertia: 3200,
  drag: 0.42,          // 0.5*ρ*Cd*A
  rolling: 0.012,
  maxSteer: 0.45,
  brakeFront: 3120,
  brakeRear: 2340,
  handbrakeTorque: 1200,
  tcKappa: 0.18,
  tcStrength: 1.5,
  absSlip: 0.18,
  shiftUpRpm: 6400,
  shiftDownRpm: 2400,
  tireFront: { muX: 1.12, muY: 1.30, Bx: 11.0, Cx: 1.55, Ex: 0.32, By: 25.0, Cy: 1.30, Ey: -0.45, nomFz: 4800 },
  tireRear: { muX: 1.18, muY: 1.35, Bx: 11.0, Cx: 1.55, Ex: 0.32, By: 25.0, Cy: 1.30, Ey: -0.50, nomFz: 5200 }
};

const G = 9.81;

export class Vehicle {
  constructor(opts) {
    opts = opts || {};
    this.spec = { ...VEHICLE_SPEC, ...opts.spec };
    const s = this.spec;
    this.tires = [
      new Tire({ ...s.tireFront, radius: s.wheelRadius, inertia: 1.8 }),
      new Tire({ ...s.tireFront, radius: s.wheelRadius, inertia: 1.8 }),
      new Tire({ ...s.tireRear, radius: s.wheelRadius, inertia: 1.8 }),
      new Tire({ ...s.tireRear, radius: s.wheelRadius, inertia: 1.8 })
    ];
    this.drivetrain = new Drivetrain(opts.drivetrain);
    this.steerAssist = new SteeringAssist(opts.steerAssist || {});
    this.reset();
  }

  reset() {
    this.x = 0; this.y = 0; this.yaw = 0;
    this.vx = 0; this.vy = 0; this.r = 0;
    this.ax = 0; this.ay = 0;
    this.time = 0;
    this.steerInput = 0; this.throttle = 0; this.brake = 0;
    this.handbrake = 0; this.clutch = 1;
    this.tcOn = true; this.absOn = true; this.assistOn = true;
    this.autoShift = true;
    this.ignition = true;
    this.wheelDelta = [0, 0, 0, 0];
    this.deltaEff = 0;
    this.airborne = false;
    this.surfaceMu = 1;
    this.tcActive = false;
    this.absActive = false;
    this.steerAssist.reset();
    this.drivetrain.gear = 1;
    this.drivetrain.gearNeutral = false;
    this.drivetrain.reverse = false;
    this.drivetrain.shiftTimer = 0;
    this.drivetrain.omegaE = 2 * Math.PI * this.drivetrain.idleRpm / 60;
  }

  get speedKmh() { return Math.abs(this.vx) * 3.6; }
  get lateralG() { return this.ay / G; }
  get yawRateDeg() { return this.r * 180 / Math.PI; }
  get rpm() { return this.drivetrain.rpm(); }

  // input: { steer, throttle, brake, handbrake, clutch, gearDelta, reverse, ignition }
  step(dt, input) {
    input = input || {};
    const s = this.spec;
    if (input.ignition !== undefined) this.ignition = !!input.ignition;
    if (!this.ignition) {
      // 熄火：引擎减速至停转，刹车保持
      this.drivetrain.omegaE = Math.max(0, this.drivetrain.omegaE - dt * 8);
    }
    this.steerInput = clampNum(input.steer ?? this.steerInput, -1, 1);
    this.throttle = clampNum(input.throttle ?? this.throttle, 0, 1);
    this.brake = clampNum(input.brake ?? this.brake, 0, 1);
    this.handbrake = clampNum(input.handbrake ?? this.handbrake, 0, 1);
    this.clutch = clampNum(input.clutch ?? this.clutch, 0, 1);

    if (input.gearDelta) {
      if (this.autoShift) this.autoShift = false;
      this.drivetrain.shift(input.gearDelta);
    }
    if (input.reverse !== undefined) this.drivetrain.setReverse(input.reverse);

    // 自动换挡
    if (this.autoShift && !this.drivetrain.reverse) {
      const rpm = this.rpm;
      const dt_ = this.drivetrain;
      if (rpm > s.shiftUpRpm && dt_.gear < 6 && !dt_.gearNeutral) dt_.shift(1);
      else if (rpm < s.shiftDownRpm && dt_.gear > 1 && !dt_.gearNeutral) dt_.shift(-1);
    }

    // 转向辅助（默认开）
    this.steerAssist.enabled = this.assistOn;
    // 带符号滑移角（转向辅助需要方向信息）
    const frontSlipDeg = (this.tires[0].alphaEff + this.tires[1].alphaEff) / 2 * 180 / Math.PI;
    const rearSlipDeg = (this.tires[2].alphaEff + this.tires[3].alphaEff) / 2 * 180 / Math.PI;
    const assistTarget = this.steerAssist.step(
      Math.hypot(this.vx, this.vy), this.steerInput, this.steerInput * s.maxSteer,
      this.r, frontSlipDeg, rearSlipDeg, this.airborne, dt, 1.02
    );
    this.deltaEff = this.assistOn ? assistTarget : this.steerInput * s.maxSteer;
    this.deltaEff = clampNum(this.deltaEff, -s.maxSteer, s.maxSteer);

    // Ackermann：R = L/tan(δ)，每轮 δ_i = atan(L/(R + py_i))
    const R = s.wheelbase / Math.tan(this.deltaEff || 1e-9);
    const wheelPos = [
      { px: s.frontAxleToCg, py: -s.track / 2 },
      { px: s.frontAxleToCg, py: s.track / 2 },
      { px: -s.rearAxleToCg, py: -s.track / 2 },
      { px: -s.rearAxleToCg, py: s.track / 2 }
    ];
    for (let i = 0; i < 4; i++) {
      const isFront = i < 2;
      const delta = isFront ? Math.atan(s.wheelbase / (R + wheelPos[i].py)) : 0;
      this.wheelDelta[i] = clampNum(delta, -s.maxSteer, s.maxSteer);
    }

    // 载荷（用上一帧加速度；低速起步时避免除零）
    const axPrev = this.ax;
    const ayPrev = this.ay;
    const FzF0 = this.spec.mass * G * s.rearAxleToCg / s.wheelbase;
    const FzR0 = this.spec.mass * G * s.frontAxleToCg / s.wheelbase;
    const dLong = -this.spec.mass * axPrev * s.cgHeight / s.wheelbase;
    const dLat = -this.spec.mass * ayPrev * s.cgHeight / s.track;
    const fz = [
      (FzF0 + dLong) / 2 - dLat / 2,
      (FzF0 + dLong) / 2 + dLat / 2,
      (FzR0 - dLong) / 2 - dLat / 2,
      (FzR0 - dLong) / 2 + dLat / 2
    ];

    // 轮心速度（车身系）+ 轮胎系
    const vWheel = [];
    for (let i = 0; i < 4; i++) {
      const p = wheelPos[i];
      const vbx = this.vx - this.r * p.py;
      const vby = this.vy + this.r * p.px;
      const d = this.wheelDelta[i];
      const cd = Math.cos(d), sd = Math.sin(d);
      const vLon = vbx * cd + vby * sd;
      const vLat = -vbx * sd + vby * cd;
      vWheel.push({ vLon, vLat, d, cd, sd });
    }

    // 轮胎力
    const bodyFx = [0, 0, 0, 0];
    const bodyFy = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const tire = this.tires[i];
      const w = vWheel[i];
      const res = tire.step(dt, w.vLon, w.vLat, fz[i]);
      bodyFx[i] = res.Fx * w.cd - res.Fy * w.sd;
      bodyFy[i] = res.Fx * w.sd + res.Fy * w.cd;
      // 路面 μ（柏油 1.0 / 路肩 0.72 / 砾石 0.55 / 草地 0.38）
      bodyFx[i] *= this.surfaceMu;
      bodyFy[i] *= this.surfaceMu;
    }

    // 制动（每轮独立，ABS 释放）
    const wAvgRear = (this.tires[2].omega + this.tires[3].omega) / 2;
    const wds = wAvgRear * FINAL_DRIVE;
    // TC：抓地力估算扭矩上限 + 滑移比例削减（平滑，不硬切断）
    let tcFactor = 1;
    let tcCap = Infinity;
    if (this.tcOn) {
      const rearSlipMax = Math.max(Math.abs(this.tires[2].slip), Math.abs(this.tires[3].slip));
      if (rearSlipMax > s.tcKappa) {
        tcFactor = clampNum(1 - (rearSlipMax - s.tcKappa) * s.tcStrength, 0.15, 1);
        this.tcActive = true;
      } else {
        this.tcActive = false;
      }
      const muRear = Math.min(this.tires[2].muAt(this.tires[2].Fz).x, this.tires[3].muAt(this.tires[3].Fz).x);
      const fzRear = this.tires[2].Fz + this.tires[3].Fz;
      tcCap = muRear * fzRear * s.wheelRadius * 0.80 * tcFactor;
    }
    const drive = this.drivetrain.step(dt, this.throttle, this.clutch, wds, this.ignition ? tcFactor : 0);
    const totalRatio = this.drivetrain.totalRatio();
    const wheelTorqueTotal = drive.wheelTorque * totalRatio * DRIVETRAIN_EFF;

    for (let i = 0; i < 4; i++) {
      const tire = this.tires[i];
      const isFront = i < 2;
      let Tb = this.brake * (isFront ? s.brakeFront : s.brakeRear);
      if (!isFront && this.handbrake > 0) {
        // 手刹高速衰减（低速漂移可用，高速防瞬间甩尾）
        const hbFade = this.handbrake * (1 - Math.min(1, Math.abs(this.vx) / 30) * 0.7);
        Tb += hbFade * s.handbrakeTorque;
      }
      if (Tb > 0) {
        if (this.absOn && Math.abs(tire.slip) > s.absSlip && Math.abs(tire.omega) > 1) {
          Tb *= 0.25;
          this.absActive = true;
        } else if (Math.abs(tire.slip) <= s.absSlip) {
          this.absActive = false;
        }
      }
      let Td = 0;
      if (!isFront && totalRatio !== 0) {
        Td = wheelTorqueTotal / 2;
        if (Number.isFinite(tcCap)) Td = clampNum(Td, -tcCap / 2, tcCap / 2);
        if (this.tcOn) {
          // 起步轮加速度上限（TC 开）：轮胎力建立前限制 ω 突爆
          const accelCap = tire.inertia * 60 + s.wheelRadius * Math.abs(bodyFx[i]);
          Td = clampNum(Td, -accelCap, accelCap);
        }
      }
      const brakeSign = -Math.sign(tire.omega + (this.vx >= 0 ? 0.01 : -0.01));
      const T = Td + (Tb > 0 ? brakeSign * Tb : 0);
      // 微小车轮滚动阻尼，避免自由轮数值漂移
      const rollDamp = -Math.sign(tire.omega) * 4;
      tire.omega += dt * (T + rollDamp - s.wheelRadius * bodyFx[i]) / tire.inertia;
      if (this.drivetrain.reverse) tire.omega = Math.min(tire.omega, 0.01); // 倒挡限制
    }

    // 底盘合力（含气动阻力与滚动阻力）
    let Fx = bodyFx[0] + bodyFx[1] + bodyFx[2] + bodyFx[3];
    let Fy = bodyFy[0] + bodyFy[1] + bodyFy[2] + bodyFy[3];
    const vAbs = Math.hypot(this.vx, this.vy);
    if (vAbs > 0.01) {
      Fx -= s.drag * this.vx * vAbs;
      Fy -= s.drag * this.vy * vAbs;
      Fx -= Math.sign(this.vx) * s.rolling * s.mass * G;
    }
    let Mz = 0;
    for (let i = 0; i < 4; i++) {
      const p = wheelPos[i];
      Mz += p.px * bodyFy[i] - p.py * bodyFx[i];
    }

    // 车身系积分（科里奥利耦合项必须保留）
    this.ax = Fx / s.mass + this.vy * this.r;
    this.ay = Fy / s.mass - this.vx * this.r;
    this.vx += this.ax * dt;
    this.vy += this.ay * dt;
    this.r += (Mz / s.inertia) * dt;
    this.yaw += this.r * dt;
    this.x += (this.vx * Math.cos(this.yaw) - this.vy * Math.sin(this.yaw)) * dt;
    this.y += (this.vx * Math.sin(this.yaw) + this.vy * Math.cos(this.yaw)) * dt;
    this.time += dt;
    this.airborne = false;
    return this;
  }

  setSurfaceMu(mu) {
    this.surfaceMu = Math.max(0.1, Math.min(1.5, mu));
  }
}

function clampNum(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}
