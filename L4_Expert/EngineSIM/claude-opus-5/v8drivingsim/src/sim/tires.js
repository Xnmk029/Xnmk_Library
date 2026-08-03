/**
 * Tyre model: simplified Pacejka Magic Formula with similarity-method
 * combined slip and first-order relaxation.
 *
 * The Magic Formula
 *
 *     F(s) = D sin( C atan( B s - E (B s - atan(B s)) ) )
 *
 * gives the characteristic shape every tyre has: linear at small slip, a
 * rounded peak, then a falling plateau. The falling part matters -- it is why
 * a car snaps once you are past the limit, and a linear tyre model can never
 * reproduce it.
 *
 * Combined slip uses the similarity method: normalise longitudinal and
 * lateral slip by their respective peak locations, take the magnitude, run
 * the Magic Formula once on that, then split the resulting force back along
 * the slip vector. Cheap, and it produces a proper friction ellipse -- you
 * cannot brake and corner at full capacity simultaneously.
 *
 * SIGN CONVENTION: body axes are x forward, y left, yaw positive counter-
 * clockwise. A positive slip angle produces a positive (leftward) lateral
 * force, and a positive slip ratio produces a positive (forward) longitudinal
 * force. The vehicle model relies on this, so do not "fix" it in isolation.
 */

/** Surface grip multipliers. */
export const SURFACE = {
  asphalt: 1.0,
  kerb: 0.86,
  paint: 0.93,
  grass: 0.46,
  gravel: 0.58,
};

export const DEFAULT_TIRE = {
  /**
   * Peak friction coefficient at the reference load. A good summer performance
   * tyre on dry asphalt, not a slick -- which is what makes 645 Nm through the
   * rear axle actually light them up.
   */
  mu: 1.10,
  /**
   * Reference vertical load, N, at which `mu` is quoted.
   *
   * This is an *axle* load, not a wheel load, because a single-track model
   * lumps both wheels of an axle into one tyre and hands it the whole axle's
   * share of the weight. Setting it to a per-wheel figure makes every
   * normalised load 2-3x too large, so load sensitivity eats grip that should
   * be there -- it cost about 0.25 g of braking before this was corrected.
   */
  fz0: 9600,
  /** Load sensitivity: mu falls as load rises. */
  loadSensitivity: 0.14,

  /**
   * Magic Formula shape factors. C sets how far the curve falls away past the
   * peak, E sets how sharp the peak is. B is *derived* from the peak slip
   * below rather than hand-tuned, because otherwise `kappaPeak` and
   * `alphaPeak` are decorative and the curve peaks wherever it likes.
   */
  cLong: 1.62,
  eLong: 0.42,
  cLat: 1.34,
  eLat: 0.72,

  /** Slip at which each channel peaks (ratio, and radians of slip angle). */
  kappaPeak: 0.12,
  alphaPeak: 0.155,

  /** Relaxation length, m. Lateral force needs rolling distance to build. */
  relaxLength: 0.42,

  /** Rolling resistance coefficient. */
  rollingResistance: 0.014,
};

function magic(s, B, C, E) {
  const bs = B * s;
  return Math.sin(C * Math.atan(bs - E * (bs - Math.atan(bs))));
}

/**
 * Solve for the stiffness factor B that puts the Magic Formula's peak exactly
 * at `sPeak`.
 *
 * The formula peaks where C*atan(g(Bs)) = pi/2, i.e. where
 * g(Bs) = tan(pi / 2C) with g(u) = u - E(u - atan u). g is monotonic for
 * E < 1, so a bisection nails it. Doing this once at construction means the
 * curve's peak *value* is exactly mu*Fz and its peak *location* is exactly
 * the slip we asked for -- both properties the model is supposed to have.
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
    this.slip = 0; // normalised combined slip magnitude, for audio/smoke
    this.saturation = 0; // 0..1+, >1 means past the friction peak
    /**
     * dFx/dkappa at the origin, N. The vehicle model folds this into a
     * backward-Euler term so the stiff wheel/tyre loop stays stable at 1 kHz.
     */
    this.kappaStiffness = 0;
  }

  /**
   * @param {number} kappa  longitudinal slip ratio (omega*R - vx) / |vx|
   * @param {number} alpha  slip angle, radians
   * @param {number} fz     vertical load, N (>= 0)
   * @param {number} vx     longitudinal contact-patch speed, m/s
   * @param {number} dt     seconds
   * @param {number} grip   surface multiplier
   * @returns {{fx:number, fy:number}} contact-patch forces, N
   */
  update(kappa, alpha, fz, vx, dt, grip = 1) {
    const p = this.p;
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
    // Slope of the Magic Formula at the origin: D * C * B.
    this.kappaStiffness = D * p.cLong * p.bLong;

    // Normalised slip vector.
    const nx = kappa / p.kappaPeak;
    const ny = Math.tan(alpha) / p.alphaPeak;
    const sigma = Math.hypot(nx, ny);
    this.saturation = sigma;

    let fx = 0;
    let fyTarget = 0;
    if (sigma > 1e-6) {
      // Run the formula once on the combined slip, in "peak-normalised"
      // units, then scale back out along each axis.
      const sNorm = sigma * p.kappaPeak; // put sigma back on the kappa scale
      const blend = magic(sNorm, p.bLong, p.cLong, p.eLong);
      // Weight the shape factors by how much of the slip is lateral, so a
      // pure-cornering tyre still uses its lateral characteristic.
      const latFrac = Math.abs(ny) / (Math.abs(nx) + Math.abs(ny) + 1e-9);
      const latShape = magic(sigma * p.alphaPeak, p.bLat, p.cLat, p.eLat);
      const F = D * (blend * (1 - latFrac) + latShape * latFrac);
      fx = (F * nx) / sigma;
      fyTarget = (F * ny) / sigma;
    }

    // Lateral relaxation: force lags by a rolling distance, not a time.
    // Expressing it this way keeps it stable down to a standstill.
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
