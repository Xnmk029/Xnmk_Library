/**
 * Per-wheel Pacejka Magic Formula tyre model with similarity-method combined
 * slip and first-order lateral relaxation.
 *
 * The Magic Formula
 *
 *     F(s) = D sin( C atan( B s - E (B s - atan(B s)) ) )
 *
 * gives the shape every tyre has: linear at small slip, a rounded peak, then
 * a falling plateau. The falling part matters -- it is why a car snaps once
 * you are past the limit.
 *
 * Combined slip uses the similarity method: normalise longitudinal and
 * lateral slip by their respective peak locations, take the magnitude, run
 * the formula once, then split the force back along the slip vector. Cheap,
 * and it produces a proper friction ellipse.
 *
 * SIGN CONVENTION: body axes x forward, y left, yaw positive counter-
 * clockwise. Positive slip angle -> positive (leftward) lateral force;
 * positive slip ratio -> positive (forward) longitudinal force.
 */

/** Surface grip multipliers (used by the track's gripAt()). */
export const SURFACE = {
  asphalt: 1.0,
  kerb: 0.86,
  paint: 0.93,
  grass: 0.46,
  gravel: 0.58,
};

export const DEFAULT_TIRE = {
  /** Peak friction coefficient at the reference load. */
  mu: 1.1,
  /**
   * Reference vertical load, N. This is a *wheel* load in the dual-track
   * model (about half an axle), unlike the bicycle model's axle-scale value.
   */
  fz0: 4800,
  /** Load sensitivity: mu falls as load rises. */
  loadSensitivity: 0.14,

  /** Magic Formula shape factors. B is derived from the peak slips below. */
  cLong: 1.62,
  eLong: 0.42,
  cLat: 1.32,
  eLat: 0.5,

  /** Slip at which each channel peaks (ratio, and radians of slip angle). */
  kappaPeak: 0.12,
  alphaPeak: 0.09, // ~5.2 deg, realistic for a wide performance tyre

  /** Lateral relaxation length, m. */
  relaxLength: 0.42,
  /** Rolling resistance coefficient. */
  rollingResistance: 0.014,
};

function magic(s, B, C, E) {
  const bs = B * s;
  return Math.sin(C * Math.atan(bs - E * (bs - Math.atan(bs))));
}

/**
 * Solve for the stiffness factor B that puts the Magic Formula peak exactly
 * at `sPeak`. Bisection on g(u) = u - E(u - atan u), monotonic for E < 1.
 */
function solveB(C, E, sPeak) {
  const target = Math.tan(Math.PI / (2 * C));
  const g = (u) => u - E * (u - Math.atan(u));
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) < target) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) / sPeak;
}

export class Tire {
  constructor(params = {}) {
    this.p = { ...DEFAULT_TIRE, ...params };
    this.p.bLong = solveB(this.p.cLong, this.p.eLong, this.p.kappaPeak);
    this.p.bLat = solveB(this.p.cLat, this.p.eLat, this.p.alphaPeak);
    this.fy = 0; // relaxed lateral force
    this.fx = 0;
    this.slip = 0; // normalised combined slip magnitude (for smoke/audio)
    this.saturation = 0; // >1 means past the friction peak
    this.kappaStiffness = 0; // dFx/dkappa at origin, for stability helpers
    this.grip = 1; // last surface multiplier
  }

  /**
   * @param {number} kappa  longitudinal slip ratio (omega*R - vx) / |vx|
   * @param {number} alpha  slip angle, radians
   * @param {number} fz     vertical load, N (>= 0)
   * @param {number} vx     longitudinal contact-patch speed, m/s
   * @param {number} dt     seconds
   * @param {number} grip   surface multiplier
   * @returns {{fx:number, fy:number}} contact forces, N
   */
  update(kappa, alpha, fz, vx, dt, grip = 1) {
    const p = this.p;
    this.grip = grip;
    if (fz <= 1) {
      this.fx = 0;
      this.fy *= 0.5;
      this.slip = 0;
      this.saturation = 0;
      this.kappaStiffness = 0;
      return { fx: 0, fy: this.fy };
    }

    // Load sensitivity: doubling the load does not double the grip.
    const mu = p.mu * grip * (1 - p.loadSensitivity * (fz / p.fz0 - 1));
    const D = Math.max(0.05, mu) * fz;
    this.kappaStiffness = D * p.cLong * p.bLong;

    // Normalised slip vector.
    const nx = kappa / p.kappaPeak;
    const ny = Math.tan(alpha) / p.alphaPeak;
    const sigma = Math.hypot(nx, ny);
    this.saturation = sigma;

    let fx = 0;
    let fyTarget = 0;
    if (sigma > 1e-6) {
      const sNorm = sigma * p.kappaPeak;
      const blend = magic(sNorm, p.bLong, p.cLong, p.eLong);
      const latFrac = Math.abs(ny) / (Math.abs(nx) + Math.abs(ny) + 1e-9);
      const latShape = magic(sigma * p.alphaPeak, p.bLat, p.cLat, p.eLat);
      const F = D * (blend * (1 - latFrac) + latShape * latFrac);
      fx = (F * nx) / sigma;
      fyTarget = (F * ny) / sigma;
    }

    // Lateral relaxation: force lags by a rolling distance, not a time.
    const speed = Math.abs(vx);
    const kRelax = Math.min(1, (speed * dt) / p.relaxLength + dt * 2.5);
    this.fy += (fyTarget - this.fy) * kRelax;
    this.fx = fx;

    // Rolling resistance always opposes motion.
    const rr = p.rollingResistance * fz * Math.sign(vx);
    this.slip = Math.min(2, sigma);
    return { fx: this.fx - rr, fy: this.fy };
  }
}

/** Slip ratio with a low-speed guard so it stays finite at a standstill. */
export function slipRatio(omega, radius, vx) {
  const wheelSpeed = omega * radius;
  const denom = Math.max(Math.abs(vx), 1.2);
  return (wheelSpeed - vx) / denom;
}
