// src/sim/vehicle.mjs — 四轮双轨车辆刚体（纯 JS，Node 可测，不依赖 three）
//
// - 每轮独立魔术公式轮胎 + 相似法复合滑移 + 载荷敏感性 + 侧向一阶松弛
// - Ackermann 内外轮转角、开式差速器（等扭矩、无静态抓地力上限）、每轮刹车
// - 半隐式离合器（drivetrain）、6 速 + 倒挡 + 终传、TC/ABS（默认开）
// - 车身系积分保留科里奥利耦合项：vx_dot = Fx/m + vy·r、vy_dot = Fy/m − vx·r
//   （否则车辆会以零滑移“滚过弯”）
// - 限速器火花切断（drivetrain）、滑移角 ±69° 保护、30s 随机滥用 0 NaN
// - 渲染姿态输出：pitch/roll 目标（加速翘头、刹车点头、转向向外侧倾）

'use strict';

import { Tire } from './tires.mjs';
import { Drivetrain } from './drivetrain.mjs';
import { SteeringAssist } from './steering.mjs';

const RAD = Math.PI / 180;
const DEG69 = 69 * RAD;

export class Vehicle {
  constructor(cfg = {}) {
    this.m = cfg.mass ?? 1680;         // kg
    this.Iz = cfg.Iz ?? 2900;          // kg·m²
    this.L = cfg.wheelbase ?? 2.8;     // 轴距 m
    this.a = cfg.a ?? 1.15;            // 前轴到 CG
    this.b = cfg.b ?? this.L - this.a; // 后轴到 CG
    this.track = cfg.track ?? 1.58;    // 轮距 m
    this.h = cfg.cgHeight ?? 0.5;      // CG 高
    this.g = cfg.g ?? 9.81;
    this.rho = 1.225;
    this.CdA = cfg.CdA ?? 0.62;        // 风阻 m²
    this.Crr = cfg.Crr ?? 0.013;       // 滚动阻力

    // 轮胎（左前/右前/左后/右后）
    const tireCfg = cfg.tire || {};
    this.tires = [
      new Tire(tireCfg), new Tire(tireCfg),
      new Tire(tireCfg), new Tire(tireCfg),
    ];
    this.drivetrain = new Drivetrain(cfg.drivetrain || { wheelRadius: (cfg.tire || {}).r || 0.33 });
    this.steerAssist = new SteeringAssist({
      wheelbase: this.L,
      maxSteer: cfg.maxSteer ?? 0.61,
      ...(cfg.steerAssist || {}),
    });

    // 状态
    this.x = cfg.x ?? 0;
    this.y = cfg.y ?? 0;
    this.yaw = cfg.yaw ?? 0;
    this.vx = 0; this.vy = 0; this.yawRate = 0;
    this.wheelOmega = [0, 0, 0, 0];   // 每轮角速度 rad/s
    this.airborne = false;
    this.dtAcc = 0;
    this.fixedDt = 1 / 120;

    // 输入（缓存）
    this.throttleIn = 0;
    this.brakeIn = 0;
    this.handbrakeIn = 0;
    this.clutchIn = 0;
    this.steerInput = 0;
    this.gearUpEdge = false;
    this.gearDownEdge = false;
    this.reverseEdge = false;
    this.ignition = true;

    // 表面查询（渲染层提供：按位置返回 muScale）
    this.getSurface = cfg.getSurface || (() => 1);

    // 输出缓存
    this.ax = 0; this.ay = 0;          // 车身系加速度（ay 左为正）
    this.gLat = 0; this.gLong = 0;
    this.frontSlipDeg = 0; this.rearSlipDeg = 0;
    this.wheelSlipDeg = [0, 0, 0, 0];
    this.wheelSlipRatio = [0, 0, 0, 0];
    this.wheelLoad = [0, 0, 0, 0];
    this.steerAngle = 0;
    this.pitchTarget = 0; this.rollTarget = 0;
    this.tcActive = false; this.absActive = false;
    this._tcSm = [0, 0, 0, 0]; // TC 滑移平滑
    this.speed = 0; this.rpm = 0;
    this.bodySlip = 0;
    this.surfaceMu = 1;
    this.backfire = false;

    this._state0 = {
      x: this.x, y: this.y, yaw: this.yaw,
      vx: 0, vy: 0, yawRate: 0,
      wheelOmega: [0, 0, 0, 0],
    };
  }

  reset() {
    Object.assign(this, {
      x: this._state0.x, y: this._state0.y, yaw: this._state0.yaw,
      vx: 0, vy: 0, yawRate: 0,
      airborne: false, dtAcc: 0,
    });
    this.wheelOmega = this._state0.wheelOmega.slice();
    this.drivetrain.rpm = this.drivetrain.idleRpm;
    this.drivetrain.stall = false;
    this.drivetrain.fuelCut = false;
    this.drivetrain.gear = 1;
    this.drivetrain.reverse = false;
    this.throttleIn = 0; this.brakeIn = 0; this.steerInput = 0;
  }

  // 外部输入接口（渲染层/手柄每帧调用）
  setInput(i) {
    this.throttleIn = Math.max(0, Math.min(1, i.throttle ?? 0));
    this.brakeIn = Math.max(0, Math.min(1, i.brake ?? 0));
    this.handbrakeIn = Math.max(0, Math.min(1, i.handbrake ?? 0));
    this.clutchIn = Math.max(0, Math.min(1, i.clutch ?? 0));
    this.steerInput = Math.max(-1, Math.min(1, i.steer ?? 0));
    this.ignition = i.ignition ?? true;
    // 同步到传动系
    this.drivetrain.throttleIn = this.throttleIn;
    this.drivetrain.clutchIn = this.clutchIn;
    this.drivetrain.ignition = this.ignition;
    if (i.gearUp) { this.drivetrain.shiftUp(); }
    if (i.gearDown) { this.drivetrain.shiftDown(); }
    if (i.reverse !== undefined) this.drivetrain.setReverse(i.reverse);
    if (i.tcOn !== undefined) this.drivetrain.tcOn = i.tcOn;
    if (i.absOn !== undefined) this.drivetrain.absOn = i.absOn;
    if (i.assistOn !== undefined) this.steerAssist.setEnabled(i.assistOn);
    if (i.reset) this.reset();
  }

  // 主步进：外部 dt 秒（内部固定 1/120 子步）
  step(dt) {
    this.dtAcc += Math.max(0, Math.min(0.1, dt));
    const h = this.fixedDt;
    let guard = 0;
    while (this.dtAcc >= h - 1e-9 && guard++ < 40) {
      this._substep(h);
      this.dtAcc -= h;
    }
    // 同步输出
    this.speed = Math.hypot(this.vx, this.vy);
    this.rpm = this.drivetrain.rpm;
    this.bodySlip = Math.atan2(this.vy, Math.max(1, this.vx));
  }

  _substep(dt) {
    const dt_ = dt;
    // 转向柱速率限制（转向系统惯性：8Hz 平滑，物理正确且抑制弯道入口振荡）
    if (this._steerSm === undefined) this._steerSm = 0;
    this._steerSm += Math.min(1, 8 * dt_) * (this.steerInput - this._steerSm);
    // 转向辅助
    const muNow = this.surfaceMu;
    const saResult = this.steerAssist.update(dt_, {
      vx: this.vx, vy: this.vy, yawRate: this.yawRate, speed: this.speed,
      frontSlipDeg: this.frontSlipDeg, rearSlipDeg: this.rearSlipDeg,
      mu: muNow, airborne: this.airborne, a: this.a,
    }, this._steerSm);
    const steerBase = saResult.steerAngle;
    this.steerAngle = steerBase;

    // Ackermann：内外轮转角
    let deltaInner = steerBase, deltaOuter = steerBase;
    if (Math.abs(steerBase) > 0.001) {
      const R = this.L / Math.tan(steerBase);
      const s = Math.sign(steerBase);
      const t2 = this.track / 2;
      // R 为转向中心到后轴中点距离；内轮（弯内侧）转角更大
      const Rin = Math.max(0.6, Math.abs(R) - t2);
      const Rout = Math.max(0.6, Math.abs(R) + t2);
      deltaInner = s * Math.atan(this.L / Rin);
      deltaOuter = s * Math.atan(this.L / Rout);
    }

    // 载荷（静态 + 纵向/横向转移）
    const m = this.m, g = this.g;
    const L = this.L, a = this.a, b = this.b, h = this.h, t = this.track;
    const FzFrontStatic = m * g * b / L;
    const FzRearStatic = m * g * a / L;
    const axNow = this.ax, ayNow = this.ay;
    const dFzLong = -axNow * h / L * m * g / g; // 纵向转移（刹车→前轮）
    const dFzLatFront = ayNow * h / t * FzFrontStatic / g * g / (FzFrontStatic / (m * g / 2)) * 0.5;
    // 简化横向转移：ΔFz = m·ay·h/t 按轴分配
    const dFzLatF = m * ayNow * h / t * (FzFrontStatic / (m * g));
    const dFzLatR = m * ayNow * h / t * (FzRearStatic / (m * g));
    this.wheelLoad[0] = Math.max(0, FzFrontStatic + dFzLong / 2 + dFzLatF);
    this.wheelLoad[1] = Math.max(0, FzFrontStatic + dFzLong / 2 - dFzLatF);
    this.wheelLoad[2] = Math.max(0, FzRearStatic - dFzLong / 2 + dFzLatR);
    this.wheelLoad[3] = Math.max(0, FzRearStatic - dFzLong / 2 - dFzLatR);

    // 各轮运动学
    const vx = this.vx, vy = this.vy, r = this.yawRate;
    const deltas = [deltaInner, deltaOuter, 0, 0]; // 前轮转向，后轮直行
    const wheelStates = [];
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const d = deltas[i];
      const c = Math.cos(d), s = Math.sin(d);
      // 轮心速度（车身系）
      const wx = front ? a : -b;
      const wy = (i % 2 === 0 ? 1 : -1) * t / 2;
      const vxWheel = vx + r * -wy * 0 + 0; // 车身系下轮心速度 = 车体质心速度 + r×轮心位置
      const vyWheel = vy + r * wx;
      // 注意：轮心横向位置贡献 r·wy 在纵向（很小，忽略），横向 = vy + r·wx
      // 车轮转向后的轮系速度
      const vxTire = vxWheel * c + vyWheel * s;
      const vyTire = -vxWheel * s + vyWheel * c;
      wheelStates.push({ vxTire, vyTire, c, s });
    }

    // 驱动轴：开式差速器（后轮平均 ω → 传动系），等扭矩分配
    const driveIdx = [2, 3];
    const slipCutoff = 0.16; // TC/ABS 阈值
    const omegaRearAvg = (this.wheelOmega[2] + this.wheelOmega[3]) / 2;
    // TC：离合侧限制 = 牵引力 × 滑移回落因子（慢适应状态，配合烧胎衰减
    // 后平衡点明确，不再高频狩猎；TC 关时允许烧胎）
    this.tcActive = false;
    this.tcFactor = 1;
    if (this.drivetrain.tcOn) {
      const sm = Math.min(1, 0.08 * dt_ * 120); // 滑移平滑 ≈10Hz
      let tractionTotal = 0;
      let kappaMax = 0;
      for (const i of driveIdx) {
        const tire = this.tires[i];
        tractionTotal += tire._muX(Math.max(50, tire.Fz)) * tire.Fz * tire.r;
        const kappaR = (this.wheelOmega[i] * tire.r - this.vx) / Math.max(1.5, Math.abs(this.vx));
        this._tcSm[i] += sm * (kappaR - this._tcSm[i]);
        kappaMax = Math.max(kappaMax, this._tcSm[i]);
      }
      // 目标因子：κ>0.13 后线性回落，下限 0.35
      const target = Math.max(0.35, 1 - Math.max(0, kappaMax - 0.13) * 2.0);
      const adapt = Math.min(1, 0.05 * dt_ * 120); // 适应 ≈6Hz（慢 → 不狩猎）
      if (this._tcFactorState === undefined) this._tcFactorState = target;
      this._tcFactorState += adapt * (target - this._tcFactorState);
      this.tcFactor = this._tcFactorState;
      this.drivetrain.tcLimitWheel = tractionTotal * this.tcFactor;
      this.tcActive = kappaMax > slipCutoff;
    } else {
      this.drivetrain.tcLimitWheel = 0;
    }
    const dtRes = this.drivetrain.update(dt_, omegaRearAvg, muNow);
    this.rpm = dtRes.rpm;
    this.backfire = dtRes.backfireRequest;
    const gearRatio = dtRes.ratio;
    const TOut = dtRes.torqueOut; // 已含 TC 限制（引擎侧）

    // 驱动力矩分配（开式差速器：等扭矩，按轴内弱轮牵引力限制 → 两轮严格等矩）
    const TEach = TOut / 2;
    let tractionLimitRear = Infinity;
    for (const i of driveIdx) {
      const tire = this.tires[i];
      tractionLimitRear = Math.min(tractionLimitRear, tire._muX(Math.max(50, tire.Fz)) * tire.Fz * tire.r);
    }
    if (!Number.isFinite(tractionLimitRear)) tractionLimitRear = 0;

    // 轮力计算
    const forces = [];
    let FxTotal = 0, FyTotal = 0, Mz = 0;
    let rearSlipSum = 0, frontSlipSum = 0;
    this.absActive = false;
    // 后轴锁定近似（开式差速器 → 等扭矩 + 共用轴转速）：
    // 消除低速混沌区左右轮的发散通道，弯道横摆仍由滑移差产生
    let omegaRearSh = this.wheelOmega[2];
    let axleTdrive = 0, axleTbrake = 0;

    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const tire = this.tires[i];
      const { vxTire, vyTire } = wheelStates[i];
      const muScale = this.getSurface(i) * muNow; // 表面 μ
      tire.setSurface(muScale);

      // 滑移率：κ = (ω·r − vx)/max(|vx|, ε)
      const omega = front ? this.wheelOmega[i] : omegaRearSh;
      const rw = tire.r;
      const vxC = Math.max(1.5, Math.abs(vxTire));
      const kappa = (omega * rw - vxTire) / vxC;
      // 侧偏角（atan2 自然处理方向；限 ±69° 防 tan 翻转）
      let alpha = Math.atan2(vyTire, vxTire);
      alpha = Math.max(-DEG69, Math.min(DEG69, alpha));
      this.wheelSlipDeg[i] = alpha / RAD;
      this.wheelSlipRatio[i] = kappa;

      // 刹车/手刹力矩（ABS 干预）
      let Tbrake = 0;
      const brakeScale = front ? 0.62 : 0.45;
      if (this.brakeIn > 0.01) {
        Tbrake = 2900 * brakeScale * this.brakeIn;
        if (this.drivetrain.absOn && kappa < -slipCutoff) {
          Tbrake *= 0.25; // ABS 释放
          this.absActive = true;
        }
      }
      if (!front && this.handbrakeIn > 0.01) {
        Tbrake += 1500 * this.handbrakeIn;
      }

      // 驱动力矩：等扭矩；正驱动受 TC 限制，负值（引擎制动）照常传递，
      // 幅值受轮胎抓地限制
      let Tdrive = 0;
      if (!front && TEach !== 0) {
        const lim = TEach > 0 ? tractionLimitRear * this.tcFactor : -tractionLimitRear;
        Tdrive = TEach > 0 ? Math.min(TEach, lim) : Math.max(TEach, lim);
        axleTdrive += Tdrive;
      }
      if (!front) {
        axleTbrake += Tbrake;
        // 熄火发动机制动（引擎摩擦经传动比传到车轮）
        const stallDrag = this.drivetrain._stallDrag || 0;
        if (stallDrag > 0) axleTdrive += -stallDrag;
      }

      // 轮转动动力学
      if (front) {
        // 非驱动轮：运动学精确锁定（ω·r ≡ vx），避免自由轮纵向力伪影
        this.wheelOmega[i] = vxTire / rw;
      } else {
        // 后轴在循环后统一积分（使用同一步轮胎力，隐式稳定）
      }
      tire.solve(kappa, alpha, this.wheelLoad[i], vxTire, dt_, Math.abs(omega * rw));
      let { Fx, Fy } = tire;
      if (front) {
        // 前轮纵向力 = 刹车力矩模型（自由轮无驱动）；
        // 钳制在抓地极限（隐式 ABS：制动力不可能超过轮胎能力），
        // 防抱死标志在接近极限时点亮
        const muX = tire._muX(Math.max(50, tire.Fz));
        const Fmax = muX * tire.Fz;
        Fx = -Math.min(Tbrake / rw, Fmax * 0.97);
        if (this.brakeIn > 0.5 && Math.abs(Fx) > Fmax * 0.85) this.absActive = true;
      } else if (Tbrake > 0 && Tdrive <= 0) {
        // 后轮刹车：同样的直接刹车力模型（隐式 ABS，防振荡）
        const muX = tire._muX(Math.max(50, tire.Fz));
        const Fmax = muX * tire.Fz;
        Fx = -Math.min(Tbrake / rw, Fmax * 0.97);
        if (this.brakeIn > 0.5 && Math.abs(Fx) > Fmax * 0.85) this.absActive = true;
      }
      // 速度增益：轮胎需要滚动才产生侧向力（vx→0 时 Fy→0），
      // 二次方衰减确保低速段完全由运动学混合接管，防止侧偏角饱和失控
      const vGain = Math.min(1, Math.pow(Math.abs(vxTire) / 1.5, 2));
      Fy *= vGain;
      // 变换回车身系（考虑转向）
      const FxBody = Fx * wheelStates[i].c - Fy * wheelStates[i].s;
      const FyBody = Fx * wheelStates[i].s + Fy * wheelStates[i].c;
      forces.push({ FxBody, FyBody, x: front ? this.a : -this.b, y: (i % 2 === 0 ? 1 : -1) * this.track / 2 });
      FxTotal += FxBody;
      FyTotal += FyBody;
      Mz += FxBody * -((i % 2 === 0 ? 1 : -1) * this.track / 2) + FyBody * (front ? this.a : -this.b);
      if (front) frontSlipSum += Math.abs(alpha);
      else rearSlipSum += Math.abs(alpha);
    }
    // 后轴统一积分（隐式：用同一步轮胎力）；锁定差速近似 → 左右 ω 严格相等
    const TnetAxle = axleTdrive - (this.tires[2].Fx + this.tires[3].Fx) * this.tires[2].r - axleTbrake;
    omegaRearSh += TnetAxle / (2 * this.drivetrain.Jw) * dt_;
    // 防超高速空转（轮胎物理极限）
    const omax = (Math.abs(this.vx) + 60) / this.tires[2].r;
    omegaRearSh = Math.max(-omax, Math.min(omax, omegaRearSh));
    this.wheelOmega[2] = omegaRearSh;
    this.wheelOmega[3] = omegaRearSh;
    this.frontSlipDeg = frontSlipSum / 2 / RAD;
    this.rearSlipDeg = rearSlipSum / 2 / RAD;

    // 空气阻力 + 滚动阻力（简化：总滚阻按载荷）
    const speed = Math.hypot(this.vx, this.vy);
    const Fdrag = 0.5 * this.rho * this.CdA * this.vx * Math.abs(this.vx);
    const Frr = this.Crr * m * g * (1 + speed * 0.01);
    FxTotal -= Fdrag + (Math.abs(this.vx) > 0.5 ? Frr * Math.sign(this.vx) : 0);

    // 低速运动学区混合：低于 ~11 km/h 时横摆由转向几何决定（r = vx·tanδ/L），
    // 侧向速度被强阻尼（真实车辆的低速几何跟踪），轮胎横摆矩逐步淡出。
    // 防止低速起步/停车时侧偏角饱和导致的失控横滑。
    const speedNow = Math.hypot(this.vx, this.vy);
    if (speedNow < 3.0) {
      const w = 1 - speedNow / 3.0; // 0..1 权重
      const kinR = this.vx * Math.tan(this.steerAngle) / this.L;
      this.yawRate += (kinR - this.yawRate) * Math.min(1, w * 10 * dt_);
      FyTotal -= w * 14 * this.vy * m;
      Mz -= w * this.yawRate * this.Iz * 0.5;
    }

    // 空中：无地面力
    if (this.airborne) { FxTotal = 0; FyTotal = 0; Mz = 0; }

    // 刚体积分（保留科里奥利耦合项）
    this.ax = FxTotal / m + this.vy * this.yawRate;
    this.ay = FyTotal / m - this.vx * this.yawRate;
    this.vx += this.ax * dt_;
    this.vy += this.ay * dt_;
    this.yawRate += Mz / this.Iz * dt_;
    // 横摆率软限制（防失控自旋；1.5 rad/s ≈ 86°/s，保留漂移空间）
    this.yawRate = Math.max(-1.5, Math.min(1.5, this.yawRate));
    this.yaw += this.yawRate * dt_;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.x += (this.vx * c - this.vy * s) * dt_;
    this.y += (this.vx * s + this.vy * c) * dt_;

    this.gLat = this.ay / g;
    this.gLong = this.ax / g;

    // 渲染姿态目标：加速翘头（后蹲）、刹车点头、转向向外侧倾
    // 正 ax = 加速（速度增大）；点头 = −ax；左转 ay>0 → 车身向右倾（负 roll 视觉）
    this.pitchTarget = -this.ax / g * 0.05;
    this.rollTarget = -this.ay / g * 0.045;

    // 表面 μ（取左后轮）
    this.surfaceMu = muNow;
  }

  // 隐式迭代用的轮胎纵向力估计（同一步内，含烧胎衰减）
  _iterFx(tire, kappa, alpha) {
    const Fz = Math.max(50, tire.Fz);
    const muX = tire._muX(Fz);
    const tanA = Math.tan(alpha);
    const sComb = Math.sqrt(kappa * kappa + tanA * tanA) || 1e-6;
    const burnout = 1 / (1 + Math.max(0, Math.abs(kappa) - 0.5) * 0.7);
    const FxMagic = muX * Fz * tire._magic(sComb, tire.Bx, tire.Cx, tire.Ex) * burnout;
    const fx = kappa / sComb;
    let F = FxMagic * fx;
    const Fmax = muX * Fz * 1.02;
    if (Math.abs(F) > Fmax) F = Math.sign(F) * Fmax;
    return F;
  }

  // 供渲染：取输出快照
  snapshot() {
    return {
      x: this.x, y: this.y, yaw: this.yaw,
      vx: this.vx, vy: this.vy, yawRate: this.yawRate,
      speed: this.speed, rpm: this.rpm,
      gear: this.drivetrain.gear, reverse: this.drivetrain.reverse,
      throttleIn: this.throttleIn, brakeIn: this.brakeIn, clutchIn: this.clutchIn, handbrakeIn: this.handbrakeIn,
      steerInput: this.steerInput, steerAngle: this.steerAngle,
      frontSlipDeg: this.frontSlipDeg, rearSlipDeg: this.rearSlipDeg,
      bodySlip: this.bodySlip,
      pitchTarget: this.pitchTarget, rollTarget: this.rollTarget,
      ax: this.ax, ay: this.ay, gLat: this.gLat, gLong: this.gLong,
      fuelCut: this.drivetrain.fuelCut, limiterActive: this.drivetrain.limiterActive,
      ignition: this.ignition, stall: this.drivetrain.stall,
      tcActive: this.tcActive, absActive: this.absActive,
      assistOn: this.steerAssist.on,
      surfaceMu: this.surfaceMu,
      airborne: this.airborne,
      wheelOmega: this.wheelOmega.slice(),
      wheelSlipRatio: this.wheelSlipRatio.slice(),
      wheelSlipDeg: this.wheelSlipDeg.slice(),
      wheelLoad: this.wheelLoad.slice(),
      backfire: this.backfire,
    };
  }
}
