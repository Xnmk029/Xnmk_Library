// 动力总成：扭矩曲线、半隐式离合器、6 速 + 倒挡 + 终传 3.09、开式差速器、
// TC/ABS（默认开）、限速器火花切断。

import { torqueAt } from '../engine-config.mjs';

export const GEAR_RATIOS = [3.06, 1.91, 1.34, 1.00, 0.80, 0.67];
export const REVERSE_RATIO = -3.06;
export const FINAL_DRIVE = 3.09;
export const DRIVETRAIN_EFF = 0.90;

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export class Drivetrain {
  constructor(opts) {
    opts = opts || {};
    this.engineInertia = opts.engineInertia || 0.25;
    this.clutchK = opts.clutchK || 260;       // Nm/(rad/s)
    this.clutchMax = opts.clutchMax || 1400;  // Nm
    this.idleRpm = opts.idleRpm ?? 800;
    this.limiterRpm = opts.limiterRpm ?? 6800;
    this.softLimitRpm = opts.softLimitRpm ?? 6400;
    this.gear = 1;
    this.gearNeutral = false;
    this.reverse = false;
    this.omegaE = 2 * Math.PI * this.idleRpm / 60;
    this.cutoff = false;
    this.shiftTimer = 0;
    this.tcActive = false;
    this.absActive = false;
    this.engineTorque = 0;
  }

  rpm() {
    return this.omegaE * 60 / (2 * Math.PI);
  }

  totalRatio() {
    if (this.gearNeutral) return 0;
    const g = this.reverse ? REVERSE_RATIO : GEAR_RATIOS[this.gear - 1];
    return g * FINAL_DRIVE;
  }

  shift(direction) {
    if (this.gearNeutral) {
      if (direction < 0) { this.gear = 1; this.gearNeutral = false; }
      return;
    }
    if (this.reverse) {
      if (direction > 0) { this.reverse = false; this.gear = 1; }
      return;
    }
    const next = this.gear + direction;
    if (next < 1) { this.gearNeutral = true; this.gear = 1; }
    else if (next > GEAR_RATIOS.length) { /* 保持最高挡 */ }
    else this.gear = next;
    this.shiftTimer = 0.08; // 换挡短暂切断
  }

  setReverse(on) {
    if (this.reverse === on) return;
    this.reverse = !!on;
    this.gear = 1;
    this.gearNeutral = false;
  }

  // 发动机净扭矩（火花切断/TC 在这里生效）
  engineNetTorque(throttle, tcFactor) {
    const rpm = this.rpm();
    let te = torqueAt(rpm) * clamp01(throttle) * tcFactor;
    // 怠速阻尼 + 发动机制动
    if (throttle < 0.02) te -= 60 + rpm * 0.006;
    // 怠速调节：低于怠速时补扭矩，防止锁止起步熄火
    if (rpm < this.idleRpm) te += (this.idleRpm - rpm) * 1.5;
    // 限速器火花切断（带滞回：>limiter 切断，回落到 softLimit 恢复）
    if (rpm > this.limiterRpm) this.cutoff = true;
    else if (rpm < this.softLimitRpm) this.cutoff = false;
    if (this.cutoff) te = 0;
    this.engineTorque = te;
    return te;
  }

  // 半隐式离合器：先预测 ωe' 再算传递扭矩，避免显式耦合失稳。
  // wds：驱动轴角速度（rad/s，后轮平均 ω × 终传）。
  // 返回 { te, engaged, wheelTorque }，wheelTorque 为离合器/发动机传到驱动轴的总扭矩。
  step(dt, throttle, clutchInput, wds, tcFactor) {
    const te = this.engineNetTorque(throttle, tcFactor);
    const engaged = clutchInput >= 0.95 && this.shiftTimer <= 0;
    let wheelTorque;
    if (engaged) {
      this.omegaE = Math.max(0, wds);
      wheelTorque = te;
    } else {
      const wePred = this.omegaE + dt * te / this.engineInertia;
      const slip = wePred - wds;
      const tc = clamp(this.clutchK * clamp01(clutchInput) * slip, -this.clutchMax, this.clutchMax);
      this.omegaE = this.omegaE + dt * (te - tc) / this.engineInertia;
      wheelTorque = tc;
    }
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    this.wheelTorque = wheelTorque;
    return { te, engaged, wheelTorque };
  }
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}
