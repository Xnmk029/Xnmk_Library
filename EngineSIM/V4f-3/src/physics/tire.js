// ============================================================================
// tire.js — 魔术公式（Pacejka 近似）轮胎模型
// 横向：侧偏角 α → 侧向力 Fy；纵向：滑移率 κ → 纵向力 Fx
// 约定：α = 车轮系中速度矢量相对轮面朝向的夹角 atan2(vy,|vx|)；
//   轮胎侧向力与滑移方向相反 → Fy = -magic(α)
//   验证：轮头朝北、速度朝东北(右滑) → Fy 指向西(左) ✓
// 带组合滑移衰减（Gx/Gy）与垂直载荷缩放（D ∝ Fz）
// ============================================================================
import { clamp } from '../audio/engine-math.js'

/**
 * 魔术公式主函数（纯 Pacejka 曲线）
 * @param {number} x  输入（侧偏角 rad 或滑移率）
 * @param {{B:number,C:number,D:number,E:number}} p
 */
export function magicFormula(x, p) {
  const { B, C, D, E } = p
  const Bx = B * x
  return D * Math.sin(C * Math.atan(Bx - E * (Bx - Math.atan(Bx))))
}

/** 默认轮胎参数（B=刚度,C=形状,D=峰值,E=曲率；D 由载荷动态缩放）
 * 侧向刚度 = B*1.4（峰值约 8~10°），纵向 = B*0.9（峰值 κ≈0.23） */
export const TIRE_PARAMS = {
  front: { B: 5.2, C: 1.35, D: 1.0, E: -0.35 },
  rear: { B: 5.5, C: 1.30, D: 1.0, E: -0.40 }
}

/**
 * 轮胎力计算
 * @param {{alpha:number, kappa:number, Fz:number, B:number, C:number, D:number, E:number, mu?:number}} tire
 *   alpha: 侧偏角 rad；kappa: 纵向滑移率（驱动>0，制动<0）；Fz: 垂直载荷 N；mu: 路面摩擦系数(默认1)
 * @returns {{Fx:number, Fy:number, muPeak:number}}
 */
export function tireForce(tire) {
  const { alpha, kappa, Fz, B, C, D, E, mu = 1 } = tire
  if (!(Fz > 0)) return { Fx: 0, Fy: 0, muPeak: 0 }

  const Dx = D * Fz * mu // 纵向峰值（附着力）
  const Dy = D * Fz * 0.94 * mu // 横向峰值（略小于纵向）
  const muPeak = D * mu

  // 纯侧偏 / 纯滑移力
  // 侧向力与滑移方向相反：Fy = -magic(α)（详见文件头约定）
  const Fy0 = -magicFormula(alpha, { B: B * 1.4, C, D: Dy, E })
  const Fx0 = magicFormula(kappa, { B: B * 0.9, C: 1.25, D: Dx, E: E - 0.2 })

  // 组合滑移（摩擦椭圆近似）：总附着方向受限
  const cosA = Math.cos(alpha)
  const Gx = Math.sqrt(Math.max(0, 1 - Math.pow(clamp(Math.tan(alpha) * 1.0, -1, 1), 2)))
  const Gy = Math.sqrt(Math.max(0, 1 - Math.pow(clamp(kappa, -1, 1), 2)))
  const Fx = Fx0 * Gx
  const Fy = Fy0 * Gy * cosA

  return { Fx, Fy, muPeak }
}

/**
 * 由轮胎侧偏角/滑移率生成滑移比（用于手感文档的自学习触发条件）
 * @returns {{slipRatio:number, alphaRad:number}}
 */
export function slipRatioFrom(tire) {
  // 相对滑移率：纵向滑移速度 / 纵向速度（防除零）
  const vLon = tire.vLon ?? 1
  const ratio = vLon > 0.5 ? Math.abs(tire.vLat) / Math.abs(vLon) : 0
  return { slipRatio: ratio, alphaRad: Math.atan2(tire.vLat, Math.abs(vLon)) }
}
