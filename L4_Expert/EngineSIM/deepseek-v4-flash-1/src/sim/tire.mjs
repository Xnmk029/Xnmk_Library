// 魔术公式轮胎（Pacejka）+ 相似法复合滑移（摩擦椭圆）+ 载荷敏感性 + 侧向一阶松弛。
// 纯函数、无 three 依赖，可在 Node 直接测试。

export const MAX_SLIP_ANGLE = 69 * Math.PI / 180; // 超过 90° 会翻转符号导致自旋（踩坑记录）

export function pacejka(slip, B, C, D, E) {
  const x = slip;
  const bx = B * x;
  return D * Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export class Tire {
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
