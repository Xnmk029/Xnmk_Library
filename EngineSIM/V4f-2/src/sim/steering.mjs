// src/sim/steering.mjs — 转向物理辅助与自回正算法（默认开，Y 键切换）
//
// 按“手感优化”方向实现三部分（纯 JS，Node 可测）：
//  1. 防推头限幅：R = v²/(μ·g) → 允许轮角 θ = atan(L/R)，capResponse 留峰值余量，
//     低通限幅；前轮峰值滑移角在线自学习（有界 2°–14°），限幅自适应 ±35%；
//  2. 自回正/漂移反打：前轴速度方向 ψ 充当主销后倾，车轮被推向 ψ
//     （甩尾时即自动反打）；按 (1−|input|) 加权，玩家主动打方向时不干预；
//     后轴滑移 5°–12° 平滑增强；
//  3. 电控横摆阻尼：−r·K·(1−|input|)，松手时最强。
//  状态融合：后轴滑移 2°–5° 且玩家反打（输入与横摆方向相反）时限幅放宽到满舵；
//  <15 km/h 整体淡出；空中禁用。

'use strict';

const RAD = Math.PI / 180;

export class SteeringAssist {
  constructor(cfg = {}) {
    this.maxSteer = cfg.maxSteer ?? 0.61;      // 最大前轮转角 rad（≈35°）
    this.capResponse = cfg.capResponse ?? 0.8; // 限幅峰值余量（留 20% 余量 → 弯道入口稳定）
    this.L = cfg.wheelbase ?? 2.8;             // 轴距
    this.g = cfg.g ?? 9.81;
    // 低通（防推头限幅，约 9 Hz）
    this.capLp = 0;
    this.capLpA = 1 - Math.exp(-2 * Math.PI * 9 * (1 / 120));
    // 前轮峰值滑移自学习（度）
    this.slipPeakEst = 8;     // 起始估计 8°
    this.slipPeakMin = 2;
    this.slipPeakMax = 14;
    this.slipLearnRate = 0.02;
    // 自回正
    this.selfAlignGain = cfg.selfAlignGain ?? 1.6;
    this.rearEnhance = cfg.rearEnhance ?? 0.8;
    // 横摆阻尼
    this.yawDampGain = cfg.yawDampGain ?? 0.14;
    this.enabled = cfg.enabled ?? true;
    this.on = this.enabled;

    // 调试信息
    this.capRatio = 1;
    this.selfAlign = 0;
    this.yawDamp = 0;
    this.rearSlipDeg = 0;
  }

  setEnabled(on) { this.on = on; }

  // v：车辆状态快照 { vx, vy, yawRate, speed, wheelbase, frontSlipDeg(平均), rearSlipDeg(平均), mu, airborne }
  // steerInput：-1..1
  // 返回 { steerAngle: rad, capRatio, assistActive }
  update(dt, v, steerInput) {
    const input = Math.max(-1, Math.min(1, steerInput));
    const speed = Math.abs(v.speed);
    const mu = Math.max(0.1, v.mu ?? 1);

    // 基础转向角
    let steer = input * this.maxSteer;

    if (!this.on || v.airborne) {
      this.capRatio = 1;
      this.selfAlign = 0;
      this.yawDamp = 0;
      return { steerAngle: steer, capRatio: 1, assistActive: false, selfAlign: 0, yawDamp: 0 };
    }
    // 低速淡出：限幅与横摆阻尼随速度减弱，自回正（主销后倾）全速域生效
    const speedFade = Math.min(1, speed / (15 / 3.6));

    // ---- 1. 防推头限幅 ----
    const R = speed * speed / (mu * this.g);          // 所需转弯半径
    const thetaAllow = R > 0.01 ? Math.atan(this.L / R) : this.maxSteer;
    let cap = thetaAllow * this.capResponse;
    // 峰值滑移自学习：限幅自适应 ±35%
    const adapt = 0.65 + 0.70 * (this.slipPeakEst - this.slipPeakMin) / (this.slipPeakMax - this.slipPeakMin);
    cap *= Math.max(0.65, Math.min(1.35, adapt));
    // 低通（防推头限幅，约 9 Hz）
    const lpA = Math.min(1, this.capLpA * dt / (1 / 120));
    this.capLp += lpA * (cap - this.capLp);
    // 学习：前轮滑移峰值朝实测值缓慢移动
    const fs = Math.abs(v.frontSlipDeg || 0);
    if (fs > 0.5) {
      this.slipPeakEst += (Math.max(this.slipPeakMin, Math.min(this.slipPeakMax, fs)) - this.slipPeakEst) * this.slipLearnRate;
    }
    const capRatio = Math.min(1, this.capLp / Math.max(0.05, this.maxSteer)) * speedFade;
    this.capRatio = capRatio;

    // ---- 2. 自回正 / 漂移反打（全速域：主销后倾的物理效应） ----
    // 前轴速度方向（相对车头）
    const aF = v.a ?? this.L * 0.41;
    const vxG = Math.max(1, Math.abs(v.vx));
    const psi = Math.atan2(v.vy + v.yawRate * aF, vxG);
    const rearSlipDeg = v.rearSlipDeg || 0;
    this.rearSlipDeg = rearSlipDeg;
    // 后轴滑移 5°–12° 平滑增强
    const rearBoost = Math.max(0, Math.min(1, (Math.abs(rearSlipDeg) - 5) / 7)) * this.rearEnhance;
    const saGain = this.selfAlignGain * (1 + rearBoost) * (1 - Math.abs(input));
    let selfAlign = psi * saGain;
    // 限制自回正幅度（不越过满舵）
    selfAlign = Math.max(-this.maxSteer, Math.min(this.maxSteer, selfAlign));
    this.selfAlign = selfAlign;

    // ---- 3. 电控横摆阻尼（随速度淡入；满舵时保留 30% 基线 → 弯道入口稳定） ----
    const yawDamp = -v.yawRate * this.yawDampGain * (0.3 + 0.7 * (1 - Math.abs(input))) * (1 + rearBoost * 0.5) * speedFade;
    this.yawDamp = yawDamp;

    // ---- 状态融合：甩尾反打时限幅放宽到满舵 ----
    // 约定：input +1 = 右打 → 车右转（yawRate<0）；反打 = 输入与横摆方向相反
    // （物理相反 → 代码符号相同，即 sign(input)·sign(yawRate) > 0）
    let capEffective = capRatio;
    const counterSteer = Math.abs(rearSlipDeg) > 5 && Math.abs(v.yawRate) > 0.2
      && Math.sign(input) * Math.sign(v.yawRate) > 0 && Math.abs(input) > 0.05;
    if (counterSteer) capEffective = 1;

    steer = input * this.maxSteer * capEffective + selfAlign + yawDamp;
    steer = Math.max(-this.maxSteer, Math.min(this.maxSteer, steer));
    return { steerAngle: steer, capRatio: capEffective, assistActive: true, selfAlign, yawDamp };
  }

  // 记录前轮滑移（由 vehicle 层每帧喂入，用于自学习）
  observeFrontSlip(deg) {
    // 峰值滑移自学习在 update 内完成（使用 v.frontSlipDeg）
  }
}
