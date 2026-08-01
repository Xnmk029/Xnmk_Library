// src/sim/drivetrain.mjs — 传动系：引擎扭矩曲线、半隐式离合器、6MT+倒挡、
// 终传、开式差速器（等扭矩分配）、TC/ABS、限速器火花切断
// 纯 JS，Node 可测，不依赖渲染。

'use strict';

// 扭矩曲线（rpm → Nm），分段线性插值
const TORQUE_CURVE = [
  [700, 360], [1000, 420], [1500, 490], [2000, 540], [2500, 580],
  [3000, 600], [3500, 620], [4000, 635], [4400, 640], [4800, 630],
  [5200, 605], [5500, 585], [5800, 565], [6000, 545], [6200, 520],
  [6400, 495], [6600, 460],
];

// 6 速手动 + 倒挡（美式肌肉车风格齿比）
export const GEAR_RATIOS = [3.36, 2.04, 1.43, 1.06, 0.84, 0.70];
export const REVERSE_RATIO = 3.28;
export const FINAL_DRIVE = 3.09;

export function torqueAt(rpm) {
  const t = TORQUE_CURVE;
  if (rpm <= t[0][0]) return t[0][1];
  if (rpm >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 1; i < t.length; i++) {
    if (rpm <= t[i][0]) {
      const [r0, T0] = t[i - 1], [r1, T1] = t[i];
      return T0 + (T1 - T0) * (rpm - r0) / (r1 - r0);
    }
  }
  return t[t.length - 1][1];
}

export class Drivetrain {
  constructor(cfg = {}) {
    this.idleRpm = cfg.idleRpm ?? 700;
    this.redlineRpm = cfg.redlineRpm ?? 6400;
    this.limiterRpm = cfg.limiterRpm ?? 6600;
    this.finalDrive = cfg.finalDrive ?? FINAL_DRIVE;
    this.Je = cfg.Je ?? 0.42;            // 曲轴+飞轮惯量 kg·m²
    this.Jw = cfg.Jw ?? 1.1;             // 单轮（含驱动轴折算）惯量
    this.wheelRadius = cfg.wheelRadius ?? 0.33;
    this.maxClutchTorque = cfg.maxClutchTorque ?? 620; // 离合器最大传矩 Nm

    this.gear = 0;         // 0=空挡, 1..6
    this.reverse = false;
    this.gearRatios = cfg.gearRatios ?? GEAR_RATIOS;
    this.reverseRatio = cfg.reverseRatio ?? REVERSE_RATIO;

    this.rpm = this.idleRpm;
    this.clutchIn = 0;     // 0=完全结合, 1=踩到底
    this.throttleIn = 0;   // 0..1
    this.ignition = true;
    this.fuelCut = false;  // 断油（滑行/限速）
    this.stall = false;
    this.tcOn = true;
    this.absOn = true;
    this.limiterActive = false;
    this.backfireRequest = false;
    this.rpmTarget = this.idleRpm;

    this._prevGearRpm = this.rpm;
    this._stallTimer = 0;
    this._limiterLatched = false;
  }

  get gearRatio() {
    if (this.reverse) return -this.reverseRatio;
    if (this.gear === 0) return 0;
    return this.gearRatios[this.gear - 1];
  }

  shiftUp() { if (!this.reverse && this.gear < 6) this.gear += 1; }
  shiftDown() { if (!this.reverse && this.gear > 0) this.gear -= 1; }
  setReverse(on) {
    if (on === this.reverse) return;
    this.reverse = on;
    if (on) this.gear = 0;
  }

  // 引擎转速更新（半隐式离合器模型）
  // driveshaftOmega：驱动轴转速 rad/s（经终传后的轮端平均 ω）
  // 返回 { rpm, clutchTorque, engineTorque, stall, fuelCut, limiterActive }
  update(dt, driveshaftOmega, surfaceGrip = 1) {
    const ratio = this.gearRatio;
    // 输入轴转速 = 驱动轴 × 总传动比（引擎比轮子快 ratio·final 倍）；
    // 空挡时输入轴随引擎自由旋转（离合无负载）
    const engineOmega = this.rpm * 2 * Math.PI / 60;
    const inputOmega = ratio !== 0 ? driveshaftOmega * ratio * this.finalDrive : engineOmega;
    const inputRpm = ratio !== 0 ? inputOmega * 60 / (2 * Math.PI) : 0;

    // 断油判定：松油门滑行（rpm 高于怠速+400）或限速器
    const coastCut = this.throttleIn < 0.03 && this.rpm > this.idleRpm + 400 && !this.stall;
    this.limiterActive = this.rpm >= this.limiterRpm;
    if (this.limiterActive && !this._limiterLatched) {
      this.backfireRequest = true; // 限速器切断瞬间回火
    }
    this._limiterLatched = this.limiterActive;
    this.fuelCut = (coastCut || this.limiterActive) && this.ignition && !this.stall;

    // 引擎输出扭矩（断油时 0）；闭油门基础扭矩低于摩擦 → 怠速由闭环调速器维持
    let Te = 0;
    if (this.ignition && !this.stall && !this.fuelCut) {
      Te = torqueAt(this.rpm) * (0.01 + 0.97 * this.throttleIn);
      const err = this.idleRpm - this.rpm;
      if (err > 0 && this.throttleIn < 0.1) {
        Te += Math.min(200, 0.8 * err); // Kp=0.8 Nm/rpm
      }
    }
    // 起动机：熄火后点火 → 启动马达带动曲轴（rpm<500 时）
    if (this.ignition && this.stall && !this.fuelCut && this.rpm < 500) {
      Te += 190;
      if (this.rpm > 380) this.stall = false;
    }
    // 机械摩擦（泵气/传动损耗；高转速压缩阻力 → 发动机制动）；
    // 泵气损失随节气门变化：全油门时小、滑行时大（物理正确）
    const TfricBase = 6 + 0.6 * Math.pow(this.rpm / 1000, 2) + 0.008 * this.rpm;
    const Tfric = TfricBase * (1 - 0.55 * this.throttleIn);
    // 熄火判定：结合挡位且转速过低
    if (this.ignition && !this.stall && ratio !== 0 && this.rpm < 320) {
      this.stall = true;
    }

    // 半隐式离合器：Tc = f(滑差) 的显式估计；TC 时限制离合扭矩（引擎侧）
    const grip = Math.max(0, 1 - this.clutchIn);
    let Tc = 0;
    if (grip > 0.001) {
      const dOmega = (this.rpm * 2 * Math.PI / 60) - inputOmega;
      const k = 260 * grip; // Nm·s/rad
      Tc = Math.max(-this.maxClutchTorque, Math.min(this.maxClutchTorque, k * dOmega));
      // TC：限制离合传递扭矩 ≤ 后轮牵引力上限（经传动比折算），
      // 引擎保持高转、车轮按抓地力弹射（真实 TC 逻辑）
      if (this.tcOn && this.tcLimitWheel > 0 && ratio !== 0) {
        const tcMax = this.tcLimitWheel / (ratio * this.finalDrive);
        Tc = Math.min(Tc, Math.max(0, tcMax));
      }
    }
    // 熄火（点火关闭）：离合断开，引擎自行停转；发动机制动 = 摩擦扭矩经传动比
    if (!this.ignition) {
      Tc = 0;
      this._stallDrag = Tfric * Math.abs(ratio) * this.finalDrive; // 供车轮引擎制动
    } else {
      this._stallDrag = 0;
    }
    // 引擎角加速度（含摩擦）
    const dOmegaE = (Te - Tc - Tfric) / this.Je;
    this.rpm += dOmegaE * dt * 60 / (2 * Math.PI);
    this.rpm = Math.max(0, this.rpm);
    if (!this.ignition || this.stall) {
      this.rpm = Math.max(0, this.rpm - 40 * dt * 60 / (2 * Math.PI) * 0.5); // 摩擦衰减
    }

    // 输出轴扭矩（传到驱动轮，经 TC 限制）
    let TOut = 0;
    if (ratio !== 0 && grip > 0.001) {
      TOut = Tc * ratio * this.finalDrive;
    }
    // TC：按驱动轮滑移由 vehicle 层进一步限制；这里只做基础削峰
    if (this.tcOn) {
      TOut = Math.min(TOut, 1e5); // 实际限制在 vehicle 层
    }
    this.rpmTarget = this.rpm;
    return {
      rpm: this.rpm,
      clutchTorque: Tc,
      engineTorque: Te,
      stall: this.stall,
      fuelCut: this.fuelCut,
      limiterActive: this.limiterActive,
      torqueOut: TOut,
      ratio,
      inputRpm,
    };
  }
}
