// src/sim/tires.mjs — 轮胎模型：Pacejka 魔术公式（纯 JS，Node 可测）
//
// - 每轮独立魔术公式（侧向 B/C/D/E + 纵向 B/C/D/E）
// - 相似法复合滑移（摩擦椭圆）：合成滑移 s = √(κ² + tan²α)，力按滑移方向分配
// - 载荷敏感性：μ 随 Fz 增大而下降
// - 侧向一阶松弛（横向速度滞后）
// - 滑移角硬限制 ±69°（防止 tan(α) 过 90° 符号翻转导致自旋）

'use strict';

const DEG69 = 69 * Math.PI / 180;

export class Tire {
  constructor(cfg = {}) {
    this.r = cfg.r ?? 0.33;            // 滚动半径 m
    this.Fz0 = cfg.Fz0 ?? 4500;        // 标称载荷 N
    this.muX0 = cfg.muX0 ?? 1.15;      // 峰值纵向 μ
    this.muY0 = cfg.muY0 ?? 1.05;      // 峰值侧向 μ
    this.sigma = cfg.sigma ?? 0.35;    // 侧向松弛长度 m
    // Pacejka 形状参数
    this.Bx = cfg.Bx ?? 11;
    this.Cx = cfg.Cx ?? 1.5;
    this.Ex = cfg.Ex ?? -0.4;
    this.By = cfg.By ?? 9;
    this.Cy = cfg.Cy ?? 1.35;
    this.Ey = cfg.Ey ?? -0.5;
    // 状态
    this.Fz = 0;        // 当前载荷 N
    this.alpha = 0;     // 侧偏角 rad（滞后后的）
    this.alphaTarget = 0;
    this.kappa = 0;     // 纵向滑移率
    this.Fx = 0;        // 输出的纵向力
    this.Fy = 0;        // 输出的侧向力
    this.slipPeak = 0;  // 峰值滑移（供 TC/ABS/特效）
    this.muScale = 1;   // 表面 μ 缩放（默认柏油）
  }

  // 表面 μ 缩放（柏油/草地/砾石）
  setSurface(muScale = 1) {
    this.muScale = muScale;
  }

  _magic(x, B, C, E) {
    // 魔术公式：D·sin(C·atan(Bx − E(Bx − atan(Bx))))
    const bx = B * x;
    return Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
  }

  // 载荷计算（含载荷敏感性：μ 随 Fz/Fz0 增大略降）
  _muX(Fz) { return this.muX0 * this.muScale * (1 - 0.10 * Math.max(0, Fz / this.Fz0 - 1)); }
  _muY(Fz) { return this.muY0 * this.muScale * (1 - 0.08 * Math.max(0, Fz / this.Fz0 - 1)); }

  // 侧偏角松弛（一阶滞后）
  updateRelaxation(dt, alphaTarget, vx) {
    const v = Math.max(1, Math.abs(vx));
    const k = Math.min(1, this.sigma > 0 ? v * dt / this.sigma : 1);
    this.alpha += (alphaTarget - this.alpha) * Math.min(1, k);
    this.alphaTarget = alphaTarget;
  }

  // 复合滑移力计算（摩擦椭圆相似法）
  // 输入：kappa（纵向滑移）、alpha（侧偏角 rad）、Fz、vx（纵向速度，决定符号）
  // 输出：Fx（纵向）、Fy（侧向）
  solve(kappa, alpha, Fz, vx, dt = 1 / 120, kappaSpeed = 0) {
    this.Fz = Math.max(50, Fz);
    // 滑移角限制（防 tan 翻转）+ 一阶松弛（随车速）
    this.alpha = Math.max(-DEG69, Math.min(DEG69, this.alpha + (alpha - this.alpha) * Math.min(1, Math.abs(vx) * dt / this.sigma)));
    this.alphaTarget = alpha;
    // 纵向滑移：一阶松弛，速率随轮面速度（|ω·r|），
    // 否则起步/急刹时接触斑刷新过慢导致轮胎力冻结
    const kappaRaw = Math.max(-1.5, Math.min(1.5, kappa));
    const relSpeed = Math.max(Math.abs(vx), kappaSpeed);
    this.kappa += (kappaRaw - this.kappa) * Math.min(1, relSpeed * dt / (this.sigma * 0.9));

    const Fz2 = this.Fz;
    const muX = this._muX(Fz2);
    const muY = this._muY(Fz2);
    const Dx = muX * Fz2;
    const Dy = muY * Fz2;

    // 相似法：合成滑移
    const tanA = Math.tan(this.alpha);
    // 纵向使用 κ 的符号方向，合成时 κ 带符号参与
    const sComb = Math.sqrt(this.kappa * this.kappa + tanA * tanA);
    const sCombC = Math.max(1e-6, sComb);
    // 烧胎衰减：极端滑移（κ>0.5）时橡胶脱离抓地，力回落
    // （物理必需：否则烧胎区轮速无界、开式差速把微小不对称放大成自旋）
    const burnout = 1 / (1 + Math.max(0, Math.abs(this.kappa) - 0.5) * 0.7);

    // 纵向力（驱动正滑移 → 正力）
    let FxMagic = 0, FyMagic = 0;
    if (sComb > 0.0005) {
      // 各自用合成滑移的魔术公式（相似法：同一条曲线，方向按滑移分量分配）
      FxMagic = Dx * this._magic(sComb, this.Bx, this.Cx, this.Ex) * burnout;
      // 极端侧偏角衰减（同烧胎：大侧滑角时橡胶剪切脱离，力回落；
      // 物理必需：否则大漂移角下轮胎持续满出力 → 无限侧滑）
      const latFalloff = 1 / (1 + Math.max(0, Math.abs(this.alpha) - 0.35) * 1.1);
      FyMagic = Dy * this._magic(sComb, this.By, this.Cy, this.Ey) * latFalloff;
      // 方向：按滑移分量归一化（摩擦椭圆）
      const fx = this.kappa / sCombC;
      const fy = tanA / sCombC;
      // 椭圆：总力不超过分量方向上的椭圆边界（简化：直接按比例合成，再限制合力 ≤ μ·Fz）
      this.Fx = FxMagic * fx;
      this.Fy = FyMagic * fy;
      // 合力限制（摩擦椭圆上限）
      const Ftot = Math.hypot(this.Fx, this.Fy);
      const Fmax = Math.hypot(Dx, Dy) * 0.98;
      if (Ftot > Fmax && Ftot > 0) {
        const s = Fmax / Ftot;
        this.Fx *= s; this.Fy *= s;
      }
    } else {
      this.Fx = 0; this.Fy = 0;
    }
    // 纵向力符号跟随滑移率（防反向）
    if (Math.sign(this.Fx) !== Math.sign(this.kappa) && Math.abs(this.Fx) > 1e-9) {
      this.Fx = Math.sign(this.kappa) * Math.min(Math.abs(this.Fx), muX * Fz2 * 0.5);
    }
    this.slipPeak = Math.hypot(this.kappa, Math.abs(this.alpha));
    return { Fx: this.Fx, Fy: this.Fy };
  }
}
