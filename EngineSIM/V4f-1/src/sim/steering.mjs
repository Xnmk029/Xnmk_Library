// 转向辅助（默认开，Y 键开关）：
//   1. 防推头限幅：R=v²/(μg) → θ=atan(L/R)，capResponse=0.9 留峰值余量，9Hz 低通；
//      前轮峰值滑移在线自学习（2°~14° 有界），限幅自适应 ±35%。
//   2. 自回正/漂移反打：前轴速度方向 ψ 充当主销后倾，车轮被推向 ψ，
//      按 (1-|input|) 加权；后轴滑移 5°~12° 平滑增强。
//   3. 电控横摆阻尼：-r·K·(1-|input|)，松手时最强。
// 状态融合：后轴滑移 2°~5° 且玩家反打（输入与横摆方向相反）时限幅放宽到满舵；
// <15km/h 整体淡出；空中禁用。

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export class SteeringAssist {
  constructor(opts) {
    opts = opts || {};
    this.enabled = opts.enabled !== false;
    this.capResponse = opts.capResponse ?? 1.0;
    this.lowpassHz = opts.lowpassHz || 9;
    this.yawDampK = opts.yawDampK ?? 0.01;
    this.alignGain = opts.alignGain ?? 0.05;
    this.rearEnhanceGain = opts.rearEnhanceGain ?? 1.0;
    this.learnRate = opts.learnRate || 2.0;   // deg/s
    this.learnLo = opts.learnLo ?? 2;         // deg
    this.learnHi = opts.learnHi ?? 14;        // deg
    this.adaptiveRange = opts.adaptiveRange ?? 0.35;
    this.learnedSlip = 6.0;                   // deg（初始目标值）
    this.capLow = 0;
    this.deltaTarget = 0;
    this.output = 0;
    this.limiterActive = false;
  }

  reset() {
    this.learnedSlip = 6.0;
    this.capLow = 0;
    this.deltaTarget = 0;
    this.output = 0;
    this.limiterActive = false;
  }

  // 输入（SI）：v 车速、steerInput -1..1、delta 当前前轮平均角、r 横摆率、
  // frontSlipDeg/rearSlipDeg、airborne、dt。返回附加的转向修正（弧度，叠加到轮角）。
  step(v, steerInput, delta, r, frontSlipDeg, rearSlipDeg, airborne, dt, mu) {
    this.output = 0;
    this.limiterActive = false;
    if (!this.enabled || airborne) return 0;

    const input = clamp(steerInput, -1, 1);
    const speed = Math.abs(v);
    const fade = clamp((speed - 1) / 14, 0, 1); // <1m/s 全关，15m/s 全开
    if (fade <= 0) return 0;

    const muEff = mu || 1.02;
    const g = 9.81;
    const L = 2.946;

    // ---- 1. 防推头限幅 ----
    let cap = Infinity;
    let capResponse = this.capResponse;
    if (speed > 8) {
      const R = (speed * speed) / (muEff * g);
      const thetaMax = Math.atan(L / Math.max(1, R));
      // 在线学习：前轮滑移偏离目标(6°)时收紧/放宽限幅，±35%
      const target = 6;
      // 学习到的高滑移（>6°）→ 收紧限幅（最多 -35%）；低于目标 → 保持标称
      const adapt = clamp(1 - this.adaptiveRange * Math.max(0, this.learnedSlip - target) / (this.learnHi - target), 1 - this.adaptiveRange, 1 + this.adaptiveRange);
      cap = thetaMax * capResponse * adapt;
      this.limiterActive = true;
    }

    // 状态融合：后轴滑移 2°~5° 且玩家反打（输入与横摆方向相反）→ 放宽到满舵
    const counter = Math.sign(input) * Math.sign(r) < 0 && Math.abs(input) > 0.15;
    if (rearSlipDeg >= 2 && rearSlipDeg <= 5 && counter) {
      cap = Infinity;
      this.limiterActive = false;
    }

    // 目标轮角 = 输入映射 + 修正；修正量按 9Hz 低通
    const kLow = 1 - Math.exp(-2 * Math.PI * this.lowpassHz * dt);
    const baseTarget = input * 0.45;

    // 限幅生效时把目标钳到 cap（方向跟随输入符号）
    let limitedTarget = baseTarget;
    if (Number.isFinite(cap) && Math.abs(baseTarget) > cap) {
      limitedTarget = Math.sign(baseTarget) * cap;
      this.limiterActive = true;
    }

    // ---- 2. 自回正 / 漂移反打 ----
    // 车轮被推向前轴速度方向 ψ = δ + α；修正量即带符号的前轮滑移角 α。
    // （必须传带符号滑移角，绝对值会把修正永远推向加深转向 → 自激甩尾）
    const alphaF = frontSlipDeg * Math.PI / 180;
    const align = clamp(alphaF, -0.8, 0.8) * this.alignGain * (1 - Math.abs(input)) * fade;
    // 后轴滑移 5°~12° 平滑增强反打（方向 = 后轴滑移方向）
    const absRear = Math.abs(rearSlipDeg);
    const rearBoost = absRear >= 5 && absRear <= 12
      ? Math.sign(rearSlipDeg) * ((absRear - 5) / 7) * this.rearEnhanceGain * (1 - Math.abs(input)) * fade
      : 0;

    // ---- 3. 电控横摆阻尼 ----
    const damp = -r * this.yawDampK * (1 - Math.abs(input)) * fade;

    const correction = (align + rearBoost + damp) * fade;
    const target = clamp(limitedTarget + correction, -0.5, 0.5);

    // 9Hz 低通（对 deltaTarget 平滑，而不是只平滑修正）
    this.deltaTarget += kLow * (target - this.deltaTarget);
    this.output = this.deltaTarget;

    // 学习：仅在有转向输入且非极限（滑移角有效）时更新
    if (Math.abs(input) > 0.05 && speed > 20) {
      const err = frontSlipDeg - this.learnedSlip;
      this.learnedSlip = clamp(this.learnedSlip + clamp(err, -1, 1) * this.learnRate * dt, this.learnLo, this.learnHi);
    }

    // 融合：放宽到满舵时记录 cap
    this.capLow = Number.isFinite(cap) ? cap : 0.45;
    return this.output;
  }
}
