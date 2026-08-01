(function () {
'use strict';
const __modules = {};
const __resolved = {"0":{},"1":{},"2":{"../engine-config.mjs":1},"3":{},"4":{"./tire.mjs":0,"./drivetrain.mjs":2,"./steering.mjs":3},"5":{},"6":{"../track/track.mjs":5},"7":{},"8":{},"9":{},"10":{},"11":{},"12":{},"13":{"./sim/vehicle.mjs":4,"./track/track.mjs":5,"./render/scene-builder.mjs":6,"./render/car-builder.mjs":7,"./render/camera-controller.mjs":8,"./render/hud.mjs":9,"./ui/input.mjs":10,"./render/sky.mjs":11,"./engine-driver.mjs":12}};
__modules[0] = { exports: {} };
(function () {
  const __exports = __modules[0].exports;
  const __require = (spec) => { const tid = __resolved[0][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// 魔术公式轮胎（Pacejka）+ 相似法复合滑移（摩擦椭圆）+ 载荷敏感性 + 侧向一阶松弛。
// 纯函数、无 three 依赖，可在 Node 直接测试。

const MAX_SLIP_ANGLE = 69 * Math.PI / 180; // 超过 90° 会翻转符号导致自旋（踩坑记录）

function pacejka(slip, B, C, D, E) {
  const x = slip;
  const bx = B * x;
  return D * Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

class Tire {
  constructor(opts) {
    opts = opts || {};
    this.radius = opts.radius || 0.352;
    this.inertia = opts.inertia || 1.8;
    this.muX = opts.muX || 1.12;
    this.muY = opts.muY || 1.10;
    this.Bx = opts.Bx || 11.0;
    this.Cx = opts.Cx || 1.55;
    this.Ex = opts.Ex || 0.32;
    this.By = opts.By || 9.5;
    this.Cy = opts.Cy || 1.30;
    this.Ey = opts.Ey || -0.45;
    this.loadSens = opts.loadSens || 0.08;   // μ 随载荷下降
    this.nomFz = opts.nomFz || 4500;
    this.relaxL = opts.relaxL || 0.18;       // 侧向松弛长度
    this.omega = 0;                          // 车轮角速度（rad/s，前进为正）
    this.alphaEff = 0;                       // 一阶松弛后的有效滑移角
    this.slip = 0;                           // 纵向滑移率
    this.Fx = 0;
    this.Fy = 0;
    this.Fz = 0;
  }

  muAt(fz) {
    const k = this.loadSens * (fz - this.nomFz) / this.nomFz;
    return {
      x: Math.max(0.3, this.muX * (1 - k)),
      y: Math.max(0.3, this.muY * (1 - k))
    };
  }

  // vLon/vLat：轮胎坐标系纵向/侧向速度；dt 积分步长
  step(dt, vLon, vLat, fz) {
    // 低速混合（ε=2m/s）：起步时避免 κ 在 ±1.2 间跳变
    const v = Math.max(2.5, Math.abs(vLon));
    // 纵向滑移率：驱动为正
    const kappa = (this.radius * this.omega - vLon) / v;
    this.slip = clamp(kappa, -1.2, 1.2);
    // 侧向滑移角（限制 ±69°）
    let alpha = Math.atan2(vLat, v);
    alpha = clamp(alpha, -MAX_SLIP_ANGLE, MAX_SLIP_ANGLE);
    // 一阶松弛
    const tau = Math.min(0.05, this.relaxL / Math.max(2, v));
    this.alphaEff += (alpha - this.alphaEff) * clamp(dt / Math.max(1e-4, tau), 0, 1);

    this.Fz = Math.max(10, fz);
    const mu = this.muAt(this.Fz);
    const Dx = mu.x * this.Fz;
    const Dy = mu.y * this.Fz;
    const Fx0 = pacejka(this.slip, this.Bx, this.Cx, Dx, this.Ex);
    // 侧向力与侧滑方向相反（摩擦抵抗侧滑）；符号错误会导致自激横摆
    const Fy0 = -pacejka(this.alphaEff, this.By, this.Cy, Dy, this.Ey);
    // 相似法（摩擦椭圆）
    const rx = clamp(1 - (Fy0 / Math.max(1, Dy)) ** 2, 0, 1);
    const ry = clamp(1 - (Fx0 / Math.max(1, Dx)) ** 2, 0, 1);
    // 高滑移衰减：超过峰值区后纵向力随滑移增大明显下降（烧胎时牵引力损失）
    const hsDecay = 1 / (1 + Math.max(0, Math.abs(this.slip) - 0.3) * 1.1);
    this.Fx = Fx0 * Math.sqrt(rx) * hsDecay;
    this.Fy = Fy0 * Math.sqrt(ry);
    return { Fx: this.Fx, Fy: this.Fy, Fz: this.Fz, slip: this.slip, alpha: this.alphaEff };
  }

  // 该轮当前纵向力上限（用于 ABS/开式差速器）
  maxDriveForce(fz) {
    return this.muAt(Math.max(10, fz)).x * Math.max(10, fz);
  }
}

__exports.MAX_SLIP_ANGLE = MAX_SLIP_ANGLE;
__exports.pacejka = pacejka;
__exports.clamp = clamp;
__exports.Tire = Tire;
})();
__modules[1] = { exports: {} };
(function () {
  const __exports = __modules[1].exports;
  const __require = (spec) => { const tid = __resolved[1][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// V4f 引擎配置（单一来源之一）。
// 说明：engine-dsp.js 是浏览器/Worklet/Node 三端共用的无 import/export 通用文件，
// 因此关键 DSP 常量在其中内嵌一份；本文件面向 Node 工具链与二阶段物理模块。
// test/dsp.test.cjs 中的“配置一致性”测试会锁定两份常量不漂移。

const SOUND_SPEED = 343.15; // m/s

// 等长芭蕉：每侧一根延迟线，L = c/(4*f0)，f0 = 164.6 Hz（1/3/5... 奇次模）。
const EXHAUST_RUNNER_LENGTH_M = 0.5212;
const EXHAUST_FUNDAMENTAL_HZ = 164.6;

const CYLINDERS = 8;
const IDLE_RPM = 800;
const MAX_RPM = 6800;
const LIMITER_RPM = 6800;
const SOFT_LIMIT_RPM = 6400;

// 真实点火顺序（1..8 缸）。LS 风格十字曲轴；flat-plane 采用左右缸组严格交替
// 的代表性点火顺序，使每侧每 180° 曲轴角点火一次（偶数拍）。
const FIRING_ORDERS = {
  crossplane: [1, 8, 4, 3, 6, 5, 7, 2],
  flatplane: [1, 8, 3, 6, 5, 2, 7, 4]
};

// 缸组归属（LS 风格：1/3/5/7 为左列，2/4/6/8 为右列）。
const BANK_OF = { 1: 'L', 2: 'R', 3: 'L', 4: 'R', 5: 'L', 6: 'R', 7: 'L', 8: 'R' };

const QUALITY_LEVELS = ['lite', 'high'];

// 8 组空间预设（FDN 反馈/阻尼/预延迟/早期反射/湿声比）。
// 说明：为满足“切换零点击”，FDN 延迟线长度在任意预设下保持不变
// （互质素数长度），预设仅改变反馈、阻尼、预延迟（交叉淡化）与早期反射增益。
const REVERB_PRESETS = [
  { id: 'zero',    name: '零延迟', preDelayMs: 0,  early: [0, 0, 0, 0],                  fdbk: 0.00, damp: 0.00, wet: 0.00, sizeMs: 2 },
  { id: 'small',   name: '小房间', preDelayMs: 3,  early: [0.5, 0.35, 0.2, 0],           fdbk: 0.55, damp: 0.18, wet: 0.35, sizeMs: 12 },
  { id: 'garage',  name: '车库',   preDelayMs: 8,  early: [0.6, 0.4, 0.25, 0],           fdbk: 0.62, damp: 0.22, wet: 0.45, sizeMs: 18 },
  { id: 'hall',    name: '大厅',   preDelayMs: 18, early: [0.7, 0.5, 0.32, 0.2],         fdbk: 0.72, damp: 0.28, wet: 0.55, sizeMs: 40 },
  { id: 'tunnel',  name: '隧道',   preDelayMs: 12, early: [0.75, 0.6, 0.45, 0],          fdbk: 0.78, damp: 0.12, wet: 0.65, sizeMs: 58 },
  { id: 'church',  name: '教堂',   preDelayMs: 28, early: [0.6, 0.45, 0.3, 0.18],        fdbk: 0.80, damp: 0.30, wet: 0.70, sizeMs: 85 },
  { id: 'stadium', name: '体育场', preDelayMs: 24, early: [0.6, 0.45, 0.32, 0],          fdbk: 0.83, damp: 0.35, wet: 0.75, sizeMs: 120 },
  { id: 'outdoor', name: '开阔地', preDelayMs: 10, early: [0.3, 0.15, 0, 0],             fdbk: 0.35, damp: 0.40, wet: 0.22, sizeMs: 30 }
];

const DEFAULT_ENGINE_PARAMS = {
  idleRpm: IDLE_RPM,
  maxRpm: MAX_RPM,
  limiterRpm: LIMITER_RPM,
  softLimitRpm: SOFT_LIMIT_RPM,
  soundSpeed: SOUND_SPEED,
  exhaustRunnerLengthM: EXHAUST_RUNNER_LENGTH_M,
  firingOrder: FIRING_ORDERS.crossplane,
  bankOf: BANK_OF,
  quality: 'high',
  preset: 'hall',
  noiseGain: 1,
  masterGain: 0.9
};

// 扭矩曲线（二阶段物理用）：[rpm, 扭矩 Nm]，归一化到发动机输出。
const TORQUE_CURVE = [
  [800, 420], [1200, 460], [1800, 500], [2400, 540], [3000, 575],
  [3600, 600], [4200, 618], [4800, 625], [5400, 615], [6000, 590], [6800, 530]
];

function torqueAt(rpm) {
  const t = TORQUE_CURVE;
  if (rpm <= t[0][0]) return t[0][1];
  if (rpm >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 1; i < t.length; i++) {
    if (rpm <= t[i][0]) {
      const k = (rpm - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return t[i - 1][1] + k * (t[i][1] - t[i - 1][1]);
    }
  }
  return t[t.length - 1][1];
}

__exports.SOUND_SPEED = SOUND_SPEED;
__exports.EXHAUST_RUNNER_LENGTH_M = EXHAUST_RUNNER_LENGTH_M;
__exports.EXHAUST_FUNDAMENTAL_HZ = EXHAUST_FUNDAMENTAL_HZ;
__exports.CYLINDERS = CYLINDERS;
__exports.IDLE_RPM = IDLE_RPM;
__exports.MAX_RPM = MAX_RPM;
__exports.LIMITER_RPM = LIMITER_RPM;
__exports.SOFT_LIMIT_RPM = SOFT_LIMIT_RPM;
__exports.FIRING_ORDERS = FIRING_ORDERS;
__exports.BANK_OF = BANK_OF;
__exports.QUALITY_LEVELS = QUALITY_LEVELS;
__exports.REVERB_PRESETS = REVERB_PRESETS;
__exports.DEFAULT_ENGINE_PARAMS = DEFAULT_ENGINE_PARAMS;
__exports.TORQUE_CURVE = TORQUE_CURVE;
__exports.torqueAt = torqueAt;
})();
__modules[2] = { exports: {} };
(function () {
  const __exports = __modules[2].exports;
  const __require = (spec) => { const tid = __resolved[2][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
const { torqueAt } = __require("../engine-config.mjs");
// 动力总成：扭矩曲线、半隐式离合器、6 速 + 倒挡 + 终传 3.09、开式差速器、
// TC/ABS（默认开）、限速器火花切断。


const GEAR_RATIOS = [3.06, 1.91, 1.34, 1.00, 0.80, 0.67];
const REVERSE_RATIO = -3.06;
const FINAL_DRIVE = 3.09;
const DRIVETRAIN_EFF = 0.90;

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

class Drivetrain {
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

__exports.GEAR_RATIOS = GEAR_RATIOS;
__exports.REVERSE_RATIO = REVERSE_RATIO;
__exports.FINAL_DRIVE = FINAL_DRIVE;
__exports.DRIVETRAIN_EFF = DRIVETRAIN_EFF;
__exports.Drivetrain = Drivetrain;
})();
__modules[3] = { exports: {} };
(function () {
  const __exports = __modules[3].exports;
  const __require = (spec) => { const tid = __resolved[3][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// 转向辅助（默认开，Y 键开关）：
//   1. 防推头限幅：R=v²/(μg) → θ=atan(L/R)，capResponse=0.9 留峰值余量，9Hz 低通；
//      前轮峰值滑移在线自学习（2°~14° 有界），限幅自适应 ±35%。
//   2. 自回正/漂移反打：前轴速度方向 ψ 充当主销后倾，车轮被推向 ψ，
//      按 (1-|input|) 加权；后轴滑移 5°~12° 平滑增强。
//   3. 电控横摆阻尼：-r·K·(1-|input|)，松手时最强。
// 状态融合：后轴滑移 2°~5° 且玩家反打（输入与横摆方向相反）时限幅放宽到满舵；
// <15km/h 整体淡出；空中禁用。

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

class SteeringAssist {
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

__exports.clamp = clamp;
__exports.SteeringAssist = SteeringAssist;
})();
__modules[4] = { exports: {} };
(function () {
  const __exports = __modules[4].exports;
  const __require = (spec) => { const tid = __resolved[4][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
const { Tire } = __require("./tire.mjs");
const { Drivetrain, FINAL_DRIVE, DRIVETRAIN_EFF } = __require("./drivetrain.mjs");
const { SteeringAssist } = __require("./steering.mjs");
// 四轮双轨车辆模型（纯 JS，无 three 依赖）：
//   - 每轮独立魔术公式 + 相似法复合滑移 + 载荷敏感性 + 侧向一阶松弛
//   - Ackermann 内外轮转角、开式差速器（等扭矩、无静态抓地力上限）、每轮刹车
//   - 半隐式离合器、6 速 + 倒挡 + 终传 3.09、TC/ABS（默认开）、限速器火花切断
//   - 车身系积分保留科里奥利耦合：vx_dot=Fx/m+vy·r、vy_dot=Fy/m−vx·r


const VEHICLE_SPEC = {
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

class Vehicle {
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

__exports.VEHICLE_SPEC = VEHICLE_SPEC;
__exports.Vehicle = Vehicle;
})();
__modules[5] = { exports: {} };
(function () {
  const __exports = __modules[5].exports;
  const __require = (spec) => { const tid = __resolved[5][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// 闭合样条赛道：centripetal Catmull-Rom + 弧长参数化；柏油/路肩/砾石/草地（不同 mu）。

const TRACK_HALF_WIDTH = 4.5;
const CURB_HALF_WIDTH = 5.0;
const GRAVEL_HALF_WIDTH = 8.0;

const CONTROL_POINTS = [
  [0, 0], [90, 0], [170, 30], [235, 110], [215, 205], [130, 250],
  [30, 235], [-50, 170], [-70, 85], [-35, 25]
];

function catmullRom(p0, p1, p2, p3, t, alpha) {
  function tj(ti, pi, pj) {
    const dx = pj[0] - pi[0], dy = pj[1] - pi[1];
    return Math.pow(dx * dx + dy * dy, alpha * 0.5) + ti;
  }
  const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
  const u = t1 + t * (t2 - t1);
  function blend(i, ti) {
    const a1 = (ti === t0 ? 0 : (t1 - ti) / (t1 - t0)) * (ti === t1 ? 0 : (t2 - ti) / (t2 - t1));
    const a2 = (ti === t0 ? 0 : (t1 - ti) / (t1 - t0)) * (ti === t2 ? 0 : (t3 - ti) / (t3 - t2));
    const a3 = (ti === t1 ? 0 : (t2 - ti) / (t2 - t1)) * (ti === t2 ? 0 : (t3 - ti) / (t3 - t2));
    const a4 = (ti === t1 ? 0 : (t2 - ti) / (t2 - t1)) * (ti === t3 ? 0 : (t3 - ti) / (t3 - t2));
    return a1 * p0[i] + a2 * p1[i] + a3 * p2[i] + a4 * p3[i];
  }
  return [blend(0, u), blend(1, u)];
}

class Track {
  constructor(points) {
    this.points = points || CONTROL_POINTS;
    this.N = 1200;
    this.pts = [];
    this.arc = new Float64Array(this.N + 1);
    const n = this.points.length;
    for (let i = 0; i < this.N; i++) {
      const u = i / this.N;
      const seg = u * n;
      const i0 = Math.floor(seg) % n, i1 = (i0 + 1) % n, i2 = (i1 + 1) % n, i3 = (i2 + 1) % n;
      const t = seg - Math.floor(seg);
      this.pts.push(catmullRom(this.points[i0], this.points[i1], this.points[i2], this.points[i3], t, 0.5));
    }
    for (let i = 1; i <= this.N; i++) {
      const a = this.pts[i - 1], b = this.pts[i % this.N];
      this.arc[i] = this.arc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    this.length = this.arc[this.N];
  }

  // u ∈ [0,1) → 位置/切向/曲率
  sample(u) {
    u = ((u % 1) + 1) % 1;
    const s = u * this.length;
    // 弧长二分
    let lo = 0, hi = this.N;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.arc[mid] < s) lo = mid; else hi = mid;
    }
    const a = this.pts[lo], b = this.pts[(lo + 1) % this.N];
    const frac = (s - this.arc[lo]) / Math.max(1e-9, this.arc[lo + 1] - this.arc[lo]);
    const x = a[0] + (b[0] - a[0]) * frac;
    const z = a[1] + (b[1] - a[1]) * frac;
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const prev = this.pts[(lo - 1 + this.N) % this.N];
    const cur = this.pts[lo], next = this.pts[(lo + 1) % this.N];
    const angPrev = Math.atan2(cur[1] - prev[1], cur[0] - prev[0]);
    const angNext = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
    let dAng = angNext - angPrev;
    while (dAng > Math.PI) dAng -= Math.PI * 2;
    while (dAng < -Math.PI) dAng += Math.PI * 2;
    const ds = (this.arc[lo + 1] - this.arc[lo]) || 1;
    return { x, z, dx, dz, angle: Math.atan2(dx, dz), curvature: dAng / ds, s };
  }

  // 投影：最近弧长 u、侧向偏移（右为正）、路面类型与 mu 缩放
  project(x, z) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.N; i += 4) {
      const p = this.pts[i];
      const d = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
      if (d < bestD) { bestD = d; best = i; }
    }
    for (let d = -6; d <= 6; d++) {
      const i = (best + d + this.N) % this.N;
      const p = this.pts[i];
      const dd = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    const p = this.pts[best], q = this.pts[(best + 1) % this.N];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const l = Math.hypot(dx, dz) || 1;
    // 侧向：法线 (-dz, dx)/l，右为正
    const lateral = ((x - p[0]) * (-dz) + (z - p[1]) * dx) / l;
    const u = ((this.arc[best] / this.length) % 1 + 1) % 1;
    const absL = Math.abs(lateral);
    let surface, mu;
    if (absL <= TRACK_HALF_WIDTH - 0.4) { surface = 'asphalt'; mu = 1.0; }
    else if (absL <= CURB_HALF_WIDTH) { surface = 'curb'; mu = 0.72; }
    else if (absL <= GRAVEL_HALF_WIDTH) { surface = 'gravel'; mu = 0.55; }
    else { surface = 'grass'; mu = 0.38; }
    return { u, lateral, surface, mu, s: this.arc[best] };
  }

  startLine() { return this.sample(0); }
}

__exports.TRACK_HALF_WIDTH = TRACK_HALF_WIDTH;
__exports.CURB_HALF_WIDTH = CURB_HALF_WIDTH;
__exports.GRAVEL_HALF_WIDTH = GRAVEL_HALF_WIDTH;
__exports.Track = Track;
})();
__modules[6] = { exports: {} };
(function () {
  const __exports = __modules[6].exports;
  const __require = (spec) => { const tid = __resolved[6][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
const { Track, TRACK_HALF_WIDTH, CURB_HALF_WIDTH, GRAVEL_HALF_WIDTH } = __require("../track/track.mjs");
// 场景构建：闭合样条赛道（柏油/双色路肩/砾石/草地）、程序化纹理、
// 动态阴影跟随、雾与天空同色。

function makeCanvasTexture(THREE, kind) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  if (kind === 'asphalt') {
    g.fillStyle = '#3a3d40';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      const v = 40 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    g.fillStyle = 'rgba(20,20,22,0.55)';
    for (let i = 0; i < 12; i++) {
      g.fillRect(0, Math.random() * 256, 256, 1 + Math.random() * 2);
    }
  } else if (kind === 'curb') {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = x % 2 === 0 ? '#d43b3b' : '#e8e8e8';
      g.fillRect(x * 32, 0, 32, 256);
    }
  } else if (kind === 'gravel') {
    g.fillStyle = '#6b5d4c';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(120,105,85,0.8)' : 'rgba(70,60,48,0.8)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
  } else {
    g.fillStyle = '#3f7a35';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(70,120,50,0.7)' : 'rgba(45,90,38,0.7)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 5, 3 + Math.random() * 5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = 1000; // RepeatWrapping
  return tex;
}

function ribbon(THREE, track, halfW, y, uvScale, tex, materialOpts) {
  const N = 300;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const s = track.sample(i / N);
    const nx = -s.dz, nz = s.dx;
    pos.push(s.x - nx * halfW, y, s.z - nz * halfW, s.x + nx * halfW, y, s.z + nz * halfW);
    uv.push(i / N * uvScale, 0, i / N * uvScale, 1);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.computeVertexNormals();
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, ...materialOpts });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function buildScene(THREE) {
  const track = new Track();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xa8c6e0, 90, 380);
  scene.userData.track = track;

  const hemi = new THREE.HemisphereLight(0x7fb2e5, 0x3c4a35, 1.0);
  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.25);
  sun.castShadow = true;
  sun.position.set(35, 85, -35);
  scene.add(hemi, amb, sun, sun.target);

  // 草地
  const grassTex = makeCanvasTexture(THREE, 'grass');
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  // 砾石带
  scene.add(ribbon(THREE, track, GRAVEL_HALF_WIDTH, 0.015, 30, makeCanvasTexture(THREE, 'gravel'),
    { color: 0x9a8c78 }));
  // 柏油路
  scene.add(ribbon(THREE, track, TRACK_HALF_WIDTH, 0.03, 45, makeCanvasTexture(THREE, 'asphalt'),
    { color: 0xbfc2c5 }));
  // 双色路肩（左右两条）
  const curbTex = makeCanvasTexture(THREE, 'curb');
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.85 });
  for (const side of [-1, 1]) {
    const N = 300;
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const s = track.sample(i / N);
      const nx = -s.dz, nz = s.dx;
      const w0 = side > 0 ? TRACK_HALF_WIDTH : -TRACK_HALF_WIDTH;
      const w1 = side > 0 ? CURB_HALF_WIDTH : -CURB_HALF_WIDTH;
      pos.push(s.x + nx * w0, 0.035, s.z + nz * w0, s.x + nx * w1, 0.035, s.z + nz * w1);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Array.from({ length: (N + 1) * 2 }, (_, i) => (i % 2 === 0 ? i / 2 / N * 60 : 0))), 2));
    geo.computeVertexNormals();
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    const curb = new THREE.Mesh(geo, curbMat);
    curb.receiveShadow = true;
    scene.add(curb);
  }
  return scene;
}

__exports.buildScene = buildScene;
})();
__modules[7] = { exports: {} };
(function () {
  const __exports = __modules[7].exports;
  const __require = (spec) => { const tid = __resolved[7][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// 车模装载与挂载：OBJ/MTL 异步加载 → MTL 材质升级 → 车轮 pivot（转向+滚动）。
// 失败自动回退程序化车身。

const WHEEL_R = 0.352;
const FRONT_AXLE = 1.473;
const REAR_AXLE = -1.473;
const TRACK = 1.62;

async function loadCar(THREE, baseUrl) {
  try {
    const mtl = await fetchText(baseUrl + 'assets/models/sports-car2/SportsCar2.mtl');
    const obj = await fetchText(baseUrl + 'assets/models/sports-car2/SportsCar2.obj');
    const mtlLoader = new THREE.MTLLoader();
    const materials = mtlLoader.parse(mtl).materials;
    const objLoader = new THREE.OBJLoader();
    const loaded = objLoader.parse(obj);
    return buildFromLoaded(THREE, loaded, materials);
  } catch (err) {
    console.warn('[car] 模型加载失败，使用程序化回退：', err && err.message);
    return buildFallback(THREE);
  }
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

function buildFromLoaded(THREE, loaded, materials) {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const wheels = { fl: null, fr: null, rl: null, rr: null };
  for (const mesh of loaded.children) {
    const matName = mesh.material.userData.objMat || mesh.material.name;
    const mat = materials[matName];
    if (mat) {
      const m = mat.clone();
      m.name = mat.name;
      mesh.material = m;
    }
    const groupName = mesh.userData.group || mesh.name;
    if (groupName.startsWith('wheel_')) {
      const key = groupName.slice(6).toLowerCase(); // FL/FR/RL/RR
      const side = key.startsWith('F') ? 1 : -1;
      const lateral = key.endsWith('L') ? -TRACK / 2 : TRACK / 2;
      const axle = side > 0 ? FRONT_AXLE : REAR_AXLE;
      const steerPivot = new THREE.Group();
      steerPivot.name = 'steer_' + key;
      steerPivot.position.set(lateral, WHEEL_R, axle);
      const spinPivot = new THREE.Group();
      spinPivot.name = 'spin_' + key;
      steerPivot.add(spinPivot);
      spinPivot.add(mesh);
      mesh.position.set(0, 0, 0);
      root.add(steerPivot);
      wheels[key.toLowerCase()] = { steerPivot, spinPivot, mesh };
    } else {
      bodyGroup.add(mesh);
    }
  }
  root.userData.wheels = wheels;
  root.userData.bodyGroup = bodyGroup;
  root.userData.loaded = true;
  return root;
}

function buildFallback(THREE) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.55, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x8a1410, roughness: 0.25, metalness: 0.55 })
  );
  body.position.y = 0.72;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.45, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75 })
  );
  cabin.position.set(0, 1.08, -0.15);
  const bodyGroup = new THREE.Group();
  bodyGroup.add(body, cabin);
  root.add(bodyGroup);
  const wheels = {};
  for (const key of ['fl', 'fr', 'rl', 'rr']) {
    const side = key.startsWith('f') ? 1 : -1;
    const lateral = key.endsWith('l') ? -TRACK / 2 : TRACK / 2;
    const axle = side > 0 ? FRONT_AXLE : REAR_AXLE;
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.28, 18),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 })
    );
    tire.rotation.z = Math.PI / 2;
    const steerPivot = new THREE.Group();
    steerPivot.position.set(lateral, WHEEL_R, axle);
    const spinPivot = new THREE.Group();
    steerPivot.add(spinPivot);
    spinPivot.add(tire);
    root.add(steerPivot);
    wheels[key] = { steerPivot, spinPivot, mesh: tire };
  }
  root.userData.wheels = wheels;
  root.userData.bodyGroup = bodyGroup;
  root.userData.loaded = false;
  return root;
}

__exports.loadCar = loadCar;
})();
__modules[8] = { exports: {} };
(function () {
  const __exports = __modules[8].exports;
  const __require = (spec) => { const tid = __resolved[8][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// 相机 5 模式：追尾/引擎盖/座舱/轮毂/环绕。
// 关键修复：车辆 yaw 连续累加；相机角度统一连续域包装（禁止混用 atan2 包装角）。

const CAMERA_MODES = ['chase', 'hood', 'cockpit', 'wheel', 'orbit'];

class ChaseCamera {
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

__exports.CAMERA_MODES = CAMERA_MODES;
__exports.ChaseCamera = ChaseCamera;
})();
__modules[9] = { exports: {} };
(function () {
  const __exports = __modules[9].exports;
  const __require = (spec) => { const tid = __resolved[9][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// HUD：转速表（红区换挡灯）、车速/挡位/踏板、圈速（出赛道标 INV）、
// TC/ABS/SLIP/OFF/ASST 指示灯、诊断面板（FPS/音频 DSP/混响/mu/转向辅助 cap%）。

class HUD {
  constructor(container) {
    this.container = container;
    this.el = {};
    const hud = document.createElement('div');
    hud.className = 'v4f-hud';
    hud.innerHTML = `
      <div class="diag"></div>
      <div class="lap"></div>
      <div class="indicators"></div>
      <div class="gauges">
        <canvas class="rpm-canvas" width="200" height="200"></canvas>
        <div class="shift-lights"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="speed-box"><b>0</b><span>km/h</span></div>
        <div class="gear-box">N</div>
        <div class="pedals"><div class="throttle"></div><div class="brake"></div></div>
      </div>
      <div class="help hidden"></div>`;
    container.appendChild(hud);
    this.el.diag = hud.querySelector('.diag');
    this.el.lap = hud.querySelector('.lap');
    this.el.indicators = hud.querySelector('.indicators');
    this.el.canvas = hud.querySelector('.rpm-canvas');
    this.el.shift = hud.querySelector('.shift-lights');
    this.el.speed = hud.querySelector('.speed-box b');
    this.el.gear = hud.querySelector('.gear-box');
    this.el.throttle = hud.querySelector('.throttle');
    this.el.brake = hud.querySelector('.brake');
    this.el.help = hud.querySelector('.help');
    this.ctx = this.el.canvas.getContext('2d');
    this._dirty = true;
  }

  showHelp(html) {
    this.el.help.innerHTML = html;
    this.el.help.classList.toggle('hidden', !html);
  }

  setIndicators(list) {
    this.el.indicators.innerHTML = list.map((s) => `<i class="${s.on ? 'on' : ''}">${s.label}</i>`).join('');
  }

  update(car, stats) {
    const rpmNorm = Math.min(1, car.rpm / 6800);
    this.el.speed.textContent = Math.round(car.speedKmh);
    this.el.gear.textContent = car.drivetrain.reverse ? 'R' : (car.drivetrain.gearNeutral ? 'N' : car.drivetrain.gear);
    this.el.throttle.style.setProperty('--thr', (car.throttle * 100).toFixed(0) + '%');
    this.el.brake.style.setProperty('--brk', (car.brake * 100).toFixed(0) + '%');
    for (let i = 0; i < 5; i++) {
      const on = rpmNorm > 0.82 + i * 0.035;
      this.el.shift.children[i].classList.toggle('on', on);
    }
    this._drawGauge(rpmNorm);
    this.el.diag.innerHTML = stats
      ? `FPS ${stats.fps} · 音频 ${stats.audioMode} · 混响 ${stats.preset} · μ ${stats.mu.toFixed(2)} · 辅助 ${stats.capPct}%`
      : '';
    if (stats && stats.lap !== null) {
      this.el.lap.textContent = `圈速 ${stats.lap.toFixed(2)}s${stats.lapInvalid ? ' INV' : ''}`;
    }
  }

  _drawGauge(norm) {
    const c = this.ctx, W = 200, H = 200;
    c.clearRect(0, 0, W, H);
    const cx = 100, cy = 100, r = 82;
    c.lineWidth = 10;
    const start = Math.PI * 0.75, end = Math.PI * 2.25;
    c.strokeStyle = '#1c2430';
    c.beginPath(); c.arc(cx, cy, r, start, end); c.stroke();
    const grad = c.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#22c55e'); grad.addColorStop(0.72, '#eab308'); grad.addColorStop(1, '#ef4444');
    c.strokeStyle = grad;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, r, start, start + (end - start) * Math.min(1, norm));
    c.stroke();
    const ang = start + (end - start) * Math.min(1, norm);
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(ang) * (r - 16), cy + Math.sin(ang) * (r - 16));
    c.stroke();
    c.fillStyle = '#dbe4f0';
    c.font = 'bold 22px sans-serif';
    c.textAlign = 'center';
    c.fillText('RPM', cx, cy + 8);
  }
}

__exports.HUD = HUD;
})();
__modules[10] = { exports: {} };
(function () {
  const __exports = __modules[10].exports;
  const __require = (spec) => { const tid = __resolved[10][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// 输入：键盘（完整键位映射）+ XInput/标准手柄 + 触屏虚拟按键。

class InputManager {
  constructor(sim) {
    this.sim = sim;
    this.state = { steer: 0, throttle: 0, brake: 0, handbrake: 0, clutch: 1 };
    this._keys = {};
    this._touch = { active: false };
    this._padEdge = {};
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => { this._keys = {}; this.state.steer = 0; this.state.throttle = 0; this.state.brake = 0; });
    window.addEventListener('touchstart', () => { this._touch.active = true; this._buildTouch(); }, { once: true });
  }

  _key(e, down) {
    const k = e.key.toLowerCase();
    this._keys[k] = down;
    const s = this.sim;
    if (down && s._ensureAudio) s._ensureAudio();
    if (!down) {
      if (k === 'q') s.shiftGear(-1);
      if (k === 'e') s.shiftGear(1);
      if (k === 'g') s.toggleReverse();
      if (k === 'i') s.toggleIgnition();
      if (k === 'v') s.toggleFiringOrder();
      if (k === 'n') s.cyclePreset(1);
      if (k === 'k') s.cyclePreset(-1);
      if (k === 't') s.toggleTC();
      if (k === 'b') s.toggleABS();
      if (k === 'y') s.toggleAssist();
      if (k === 'c') s.cycleCamera();
      if (k === 'r') s.reset();
      if (k === 'p') s.togglePause();
      if (k === 'h') s.toggleHelp();
      if (k === 'm') s.toggleAutoShift();
      if (k === 'f11') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      }
      if (k === ' ') e.preventDefault();
    }
  }

  poll() {
    const K = this._keys;
    this.state.steer = (K['a'] ? -1 : 0) + (K['d'] ? 1 : 0);
    this.state.throttle = K['w'] ? 1 : 0;
    this.state.brake = K['s'] ? 1 : 0;
    this.state.handbrake = K[' '] ? 1 : 0;
    this.state.clutch = K['shift'] ? 0 : 1;
    // 手柄
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.12) this.state.steer = ax;
      const rt = pad.buttons[7] ? pad.buttons[7].value : 0;
      const lt = pad.buttons[6] ? pad.buttons[6].value : 0;
      if (rt > 0.05) this.state.throttle = rt;
      if (lt > 0.05) this.state.brake = lt;
      if (pad.buttons[0] && pad.buttons[0].pressed) this.state.handbrake = 1;
      if (pad.buttons[1] && pad.buttons[1].pressed) this.state.clutch = 0;
      const edge = (id, fn) => {
        const pressed = !!(pad.buttons[id] && pad.buttons[id].pressed);
        if (pressed && !this._padEdge[id]) { fn(); this._padEdge[id] = true; }
        if (!pressed) this._padEdge[id] = false;
      };
      edge(4, () => this.sim.shiftGear(-1));
      edge(5, () => this.sim.shiftGear(1));
      edge(3, () => this.sim.cycleCamera());
      edge(2, () => this.sim.toggleReverse());
      edge(8, () => this.sim.reset());
      edge(9, () => this.sim.togglePause());
      edge(12, () => this.sim.cyclePreset(1));
      edge(13, () => this.sim.cyclePreset(-1));
    }
    return this.state;
  }

  _buildTouch() {
    const s = this.sim;
    const bar = document.createElement('div');
    bar.className = 'touch-bar';
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = cls; b.textContent = label;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); fn(true); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); fn(false); }, { passive: false });
      bar.appendChild(b);
    };
    mk('◀', 't-l', (d) => { if (d) this._touch.steerL = true; else this._touch.steerL = false; });
    mk('▶', 't-r', (d) => { if (d) this._touch.steerR = true; else this._touch.steerR = false; });
    mk('油门', 't-thr', (d) => { this._touch.throttle = d ? 1 : 0; });
    mk('刹车', 't-brk', (d) => { this._touch.brake = d ? 1 : 0; });
    mk('视角', 't-cam', () => s.cycleCamera());
    mk('复位', 't-reset', () => s.reset());
    mk('R', 't-rev', () => s.toggleReverse());
    document.body.appendChild(bar);
  }
}

__exports.InputManager = InputManager;
})();
__modules[11] = { exports: {} };
(function () {
  const __exports = __modules[11].exports;
  const __require = (spec) => { const tid = __resolved[11][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// 程序化天空：4 时段预设（黎明/白天/黄昏/夜晚），驱动半球光、太阳光、雾与清屏色。

const SKY_PRESETS = [
  {
    id: 'dawn', name: '黎明',
    sky: 0xf2a06a, ground: 0x3a2a22, fog: 0xdd9271,
    sun: 0xffc78a, sunDir: [-0.55, 0.18, -0.35], sunIntensity: 0.75,
    ambient: 0.45, hemi: 0.85, fogNear: 60, fogFar: 260
  },
  {
    id: 'day', name: '白天',
    sky: 0x7fb2e5, ground: 0x3c4a35, fog: 0xa8c6e0,
    sun: 0xfff2d8, sunDir: [0.35, 0.85, -0.35], sunIntensity: 1.25,
    ambient: 0.55, hemi: 1.0, fogNear: 90, fogFar: 380
  },
  {
    id: 'dusk', name: '黄昏',
    sky: 0xc96a4a, ground: 0x2c2320, fog: 0xb8705a,
    sun: 0xff9a5c, sunDir: [0.7, 0.12, -0.2], sunIntensity: 0.85,
    ambient: 0.38, hemi: 0.75, fogNear: 55, fogFar: 250
  },
  {
    id: 'night', name: '夜晚',
    sky: 0x0c1428, ground: 0x10151d, fog: 0x0c1428,
    sun: 0x9fb4d8, sunDir: [-0.4, 0.55, 0.3], sunIntensity: 0.18,
    ambient: 0.28, hemi: 0.35, fogNear: 50, fogFar: 240
  }
];

function applySky(THREE, scene, id) {
  const p = SKY_PRESETS.find((s) => s.id === id) || SKY_PRESETS[1];
  scene.traverse((o) => {
    if (o instanceof THREE.HemisphereLight) {
      o.skyColor.set(p.sky); o.groundColor.set(p.ground); o.intensity = p.hemi;
    } else if (o instanceof THREE.DirectionalLight) {
      o.color.set(p.sun); o.intensity = p.sunIntensity;
      o.position.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).multiplyScalar(100);
      o.target.position.set(0, 0, 0);
    } else if (o instanceof THREE.AmbientLight) {
      o.color.set(p.sky).multiplyScalar(p.ambient);
    }
  });
  scene.fog.color.set(p.fog);
  scene.fog.near = p.fogNear;
  scene.fog.far = p.fogFar;
  if (scene.userData.renderer) {
    scene.userData.renderer.setClearColor(p.sky);
  }
  return p;
}

__exports.SKY_PRESETS = SKY_PRESETS;
__exports.applySky = applySky;
})();
__modules[12] = { exports: {} };
(function () {
  const __exports = __modules[12].exports;
  const __require = (spec) => { const tid = __resolved[12][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
// 浏览器端引擎音频驱动：AudioWorklet 为主、ScriptProcessor 兜底。
// 两个路径共用同一份 DSP 状态接口，方便二阶段 HUD/模拟器集成。
// 注意：engine-dsp.js 必须以经典脚本先于 bundle 加载（提供 window.EngineDSP 兜底），
// Worklet 模块 URL 使用 document.baseURI（bundle 后 (typeof document !== "undefined" ? document.baseURI : "") 会 404）。

class EngineDriver {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.mode = 'none'; // 'worklet' | 'script'
    this.ready = false;
    this.fallback = null;
    this.state = { rpm: 800, throttle: 0, ignition: true, cutoff: false, preset: 'hall', quality: 'high', firingOrder: 'crossplane', noiseGain: 1 };
  }

  async init() {
    if (this.ready) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) throw new Error('当前环境不支持 Web Audio');
    this.ctx = new AC();
    // 音频必须在用户手势后启动
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    try {
      const workletUrl = new URL('./src/engine-dsp.js', document.baseURI);
      await this.ctx.audioWorklet.addModule(workletUrl.href);
      this.node = new AudioWorkletNode(this.ctx, 'engine-dsp', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        parameterData: { rpm: this.state.rpm, throttle: this.state.throttle }
      });
      this.node.port.onmessage = (e) => {
        if (e.data && e.data.ready) this.ready = true;
      };
      this.node.port.postMessage({ ...this.state });
      this.mode = 'worklet';
    } catch (err) {
      console.warn('[EngineDriver] AudioWorklet 不可用，回退 ScriptProcessor：', err.message);
      this.mode = 'script';
      const DSP = globalThis.EngineDSP;
      if (!DSP) throw new Error('缺少经典脚本 engine-dsp.js（未提供 window.EngineDSP 兜底）');
      this.fallback = DSP.createEngine({ sampleRate: this.ctx.sampleRate, quality: this.state.quality });
      this.fallback.update(this.state);
      const sp = this.ctx.createScriptProcessor(4096, 0, 2);
      sp.onaudioprocess = (e) => {
        const outL = e.outputBuffer.getChannelData(0);
        const outR = e.outputBuffer.getChannelData(1);
        const st = this.state;
        for (let i = 0; i < outL.length; i++) {
          this.fallback.update({ rpm: st.rpm, throttle: st.throttle });
          const s = this.fallback.processSample();
          outL[i] = s[0];
          outR[i] = s[1];
        }
      };
      this.node = sp;
      this.ready = true;
    }
    this.node.connect(this.ctx.destination);
  }

  setState(patch) {
    Object.assign(this.state, patch);
    if (!this.node) return;
    if (this.mode === 'worklet') {
      this.node.port.postMessage(patch);
    } else if (this.fallback) {
      this.fallback.update(patch);
    }
  }

  setRpm(rpm) { this.setState({ rpm }); }
  setThrottle(throttle) { this.setState({ throttle }); }
  setPreset(preset) { this.setState({ preset }); }
  setQuality(quality) { this.setState({ quality }); }
  setFiringOrder(firingOrder) { this.setState({ firingOrder }); }

  suspend() { if (this.ctx) return this.ctx.suspend(); }
  resume() { if (this.ctx) return this.ctx.resume(); }
}

__exports.EngineDriver = EngineDriver;
})();
__modules[13] = { exports: {} };
(function () {
  const __exports = __modules[13].exports;
  const __require = (spec) => { const tid = __resolved[13][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };
const { Vehicle } = __require("./sim/vehicle.mjs");
const { Track } = __require("./track/track.mjs");
const { buildScene } = __require("./render/scene-builder.mjs");
const { loadCar } = __require("./render/car-builder.mjs");
const { ChaseCamera, CAMERA_MODES } = __require("./render/camera-controller.mjs");
const { HUD } = __require("./render/hud.mjs");
const { InputManager } = __require("./ui/input.mjs");
const { applySky, SKY_PRESETS } = __require("./render/sky.mjs");
const { EngineDriver } = __require("./engine-driver.mjs");
// V4f 主入口：物理 + 渲染 + 音频 + 输入 + HUD。
// 经典脚本打包后暴露 window.Sim；Node 冒烟用 headless 模式跑 12 帧。

const PHYS_DT = 1 / 240;
const WHEEL_R = 0.352;
const FRONT_AXLE = 1.473;
const REAR_AXLE = -1.473;
const TRACK_W = 1.62;

class Sim {
  constructor(opts) {
    opts = opts || {};
    this.headless = !!opts.headless;
    this.container = opts.container || (typeof document !== 'undefined' ? document.body : null);
    this.canvas = opts.canvas || null;
    this.vehicle = new Vehicle();
    this.track = new Track();
    this.time = 0;
    this.paused = false;
    this.presetIndex = 3;
    this.skyIndex = 1;
    this.lapStart = 0;
    this.lapLast = null;
    this.lapInvalid = false;
    this._passedStart = false;
    this._frames = 0;
    this._fpsTime = 0;
    this._fps = 60;
    this._accum = 0;
    this._audio = null;
    this._audioReady = false;
    this._helpVisible = false;
  }

  async init() {
    if (!this.headless && this.container) {
      const THREE = globalThis.THREE;
      if (!THREE) throw new Error('缺少 three.classic.js');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);
      }
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.renderer.shadowMap.enabled = true;
      this.renderer.toneMappingExposure = 1.0;
      this.scene = buildScene(THREE);
      this.scene.userData.renderer = this.renderer;
      const W = this.container.clientWidth || 960;
      const H = this.container.clientHeight || 540;
      this.renderer.setSize(W, H);
      this.renderer.setPixelRatio(Math.min(2, (globalThis.devicePixelRatio || 1)));
      this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
      this.chaseCam = new ChaseCamera(THREE, this.camera);
      const base = new URL('.', document.baseURI).href;
      this.car = await loadCar(THREE, base);
      this.carRoot = new THREE.Group();
      this.carRoot.add(this.car);
      this.scene.add(this.carRoot);
      applySky(THREE, this.scene, SKY_PRESETS[this.skyIndex].id);
      this.hud = new HUD(this.container);
      this.input = new InputManager(this);
      this._resizeHandler = () => {
        const w = this.container.clientWidth, h = this.container.clientHeight;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', this._resizeHandler);
    }
    return this;
  }

  async _ensureAudio() {
    if (this._audioReady || this.headless) return;
    if (!this._audio) {
      this._audio = new EngineDriver();
      await this._audio.init();
    }
    this._audioReady = true;
  }

  start() {
    if (this.headless) {
      for (let i = 0; i < 12; i++) this.update(1 / 60);
      return;
    }
    const loop = (ts) => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - (this._lastTs || ts)) / 1000);
      this._lastTs = ts;
      if (!this.paused) this.update(dt);
      this._frames++;
      this._fpsTime += dt;
      if (this._fpsTime >= 0.5) {
        this._fps = Math.round(this._frames / this._fpsTime);
        this._frames = 0; this._fpsTime = 0;
      }
      this.render();
    };
    this._raf = requestAnimationFrame(loop);
  }

  update(dt) {
    this._accum += dt;
    const input = this.input ? this.input.poll() : { steer: 0, throttle: 0.3, brake: 0, clutch: 1 };
    let steps = 0;
    while (this._accum >= PHYS_DT && steps < 8) {
      const proj = this.track.project(this.vehicle.x, this.vehicle.y);
      this.vehicle.setSurfaceMu(proj.mu);
      this.vehicle.step(PHYS_DT, {
        steer: input.steer,
        throttle: input.throttle,
        brake: input.brake,
        handbrake: input.handbrake,
        clutch: input.clutch
      });
      this._accum -= PHYS_DT;
      steps++;
      this._lapLogic(proj);
    }
    this.time += dt;
    this._syncAudio();
    if (this.headless) return;
    this._syncCarVisuals(dt);
    this.chaseCam.update(dt, this.vehicle, this.time);
    this.hud.update(this.vehicle, {
      fps: this._fps,
      audioMode: this._audio ? this._audio.mode : (this.headless ? 'none' : 'pending'),
      preset: this._presetName(),
      mu: this.track.project(this.vehicle.x, this.vehicle.y).mu,
      capPct: Math.round((this.vehicle.steerAssist.capLow / 0.45) * 100),
      lap: this.lapLast,
      lapInvalid: this.lapInvalid
    });
    // 动态阴影跟随车辆
    const sun = this._findSun();
    if (sun) {
      const T = globalThis.THREE;
      sun.position.set(this.vehicle.x + 35, 85, this.vehicle.y - 35);
      sun.target.position.set(this.vehicle.x, 0, this.vehicle.y);
      this.scene.updateMatrixWorld();
    }
  }

  render() {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  _presetName() {
    return (globalThis.EngineDSP ? globalThis.EngineDSP.REVERB_PRESETS[this.presetIndex] : null)?.name || '大厅';
  }

  _findSun() {
    let sun = null;
    if (!this.scene) return null;
    this.scene.traverse((o) => {
      if (!sun && o instanceof globalThis.THREE.DirectionalLight) sun = o;
    });
    return sun;
  }

  _syncAudio() {
    const v = this.vehicle;
    if (!this._audio) return;
    this._audio.setState({
      rpm: v.rpm,
      throttle: v.throttle,
      ignition: v.ignition,
      cutoff: v.drivetrain.cutoff
    });
  }

  _syncCarVisuals(dt) {
    const T = globalThis.THREE;
    const v = this.vehicle;
    this.carRoot.position.set(v.x, 0, v.y);
    this.carRoot.rotation.y = v.yaw;
    // 姿态：加速翘头（rotation.x = -ax），左转外侧倾（rotation.z = +ay）
    this.car.rotation.x = -v.ax * 0.006;
    this.car.rotation.z = v.ay * 0.005;
    const wheels = this.car.userData.wheels;
    const keys = ['fl', 'fr', 'rl', 'rr'];
    for (let i = 0; i < 4; i++) {
      const w = wheels[keys[i]];
      if (!w) continue;
      if (i < 2) w.steerPivot.rotation.y = v.wheelDelta[i];
      // 正 omega（前进）→ spin.rotation.x += omega*dt（轮胎冠部朝车头滚动）
      w.spinPivot.rotation.x += v.tires[i].omega * dt;
    }
    // 尾灯随刹车发光
    this.car.traverse((o) => {
      if (o.material && o.material.name === 'taillight') {
        o.material.emissiveIntensity = v.brake > 0.05 ? 3.0 : 1.0;
      }
    });
    // 座舱模式隐藏外壳
    const cockpit = this.chaseCam.mode === 2;
    this.car.userData.bodyGroup.visible = !cockpit;
  }

  _lapLogic(proj) {
    const v = this.vehicle;
    if (proj.u < 0.05 && v.speedKmh > 5) {
      if (!this._passedStart) {
        this._passedStart = true;
        if (this.lapStart > 0) {
          this.lapLast = this.time - this.lapStart;
          if (this.lapInvalid) this.lapLast = null;
        }
        this.lapStart = this.time;
        this.lapInvalid = false;
      }
    } else if (proj.u > 0.5) {
      this._passedStart = false;
    }
    if (Math.abs(proj.lateral) > 4.5) this.lapInvalid = true;
  }

  shiftGear(d) { if (this.vehicle.autoShift) this.vehicle.autoShift = false; this.vehicle.drivetrain.shift(d); }
  toggleAutoShift() { this.vehicle.autoShift = !this.vehicle.autoShift; }
  toggleReverse() { this.vehicle.drivetrain.setReverse(!this.vehicle.drivetrain.reverse); }
  toggleIgnition() { this.vehicle.ignition = !this.vehicle.ignition; this._ensureAudio(); }
  toggleTC() { this.vehicle.tcOn = !this.vehicle.tcOn; }
  toggleABS() { this.vehicle.absOn = !this.vehicle.absOn; }
  toggleAssist() { this.vehicle.assistOn = !this.vehicle.assistOn; this.vehicle.steerAssist.enabled = this.vehicle.assistOn; }
  togglePause() { this.paused = !this.paused; }
  reset() {
    this.vehicle.reset();
    this.lapStart = 0; this.lapLast = null; this.lapInvalid = false; this._passedStart = false;
    this._accum = 0;
  }
  toggleHelp() {
    this._helpVisible = !this._helpVisible;
    if (this.hud) {
      this.hud.showHelp(this._helpVisible ? HELP_TEXT : '');
    }
  }
  cycleCamera() { if (this.chaseCam) this.chaseCam.setMode(this.chaseCam.mode + 1); }
  cyclePreset(d) {
    const n = globalThis.EngineDSP ? globalThis.EngineDSP.REVERB_PRESETS.length : 8;
    this.presetIndex = (this.presetIndex + d + n) % n;
    if (this._audio) this._audio.setPreset(globalThis.EngineDSP.REVERB_PRESETS[this.presetIndex].id);
  }
  cycleSky(d) {
    this.skyIndex = (this.skyIndex + d + SKY_PRESETS.length) % SKY_PRESETS.length;
    if (!this.headless) applySky(globalThis.THREE, this.scene, SKY_PRESETS[this.skyIndex].id);
  }
  toggleFiringOrder() {
    const cur = this._firingOrder || 'crossplane';
    this._firingOrder = cur === 'crossplane' ? 'flatplane' : 'crossplane';
    if (this._audio) this._audio.setFiringOrder(this._firingOrder);
  }
}

const HELP_TEXT = `W/S 油门/刹车 · A/D 转向 · Space 手刹 · Shift 离合 · Q/E 换挡 · M 自动/手动 · G 倒挡 · I 点火 · V 曲轴音色 · N/K 混响 · T/B TC/ABS · Y 转向辅助 · C 视角 · R 复位 · P 暂停 · H 帮助 · F11 全屏`;

// 兜底：浏览器端自动启动
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (window.__v4fStarted) return;
    window.__v4fStarted = true;
    const sim = new Sim({ container: document.getElementById('app') || document.body });
    sim.init().then(() => sim.start()).catch((e) => {
      console.error('V4f 启动失败：', e);
      const d = document.getElementById('app') || document.body;
      d.insertAdjacentHTML('beforeend', `<pre style="color:#f66;padding:12px">${e.stack || e.message}</pre>`);
    });
    window.sim = sim;
  });
}

__exports.Sim = Sim;
})();
const __v4fExports = __modules[13].exports;
if (typeof window !== 'undefined') { window.Sim = __v4fExports.Sim || __v4fExports.default; window.SimExports = __v4fExports; }
return __v4fExports;
})();