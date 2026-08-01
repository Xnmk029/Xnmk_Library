/**
 * Track centreline: geometry, arc-length parameterisation and point location.
 *
 * The circuit is a closed radial curve
 *
 *     r(theta) = R * (1 + sum_k a_k cos(k theta + phi_k))
 *
 * which is closed and C-infinity by construction -- no control points to
 * hand-tune into a loop that almost joins up, and no risk of a kink at the
 * seam. Picking a few harmonics gives a circuit with genuinely different
 * corners: k=2 makes it oval, k=3 adds a hairpin-ish end, k=5 and k=7 put in
 * the medium-speed changes of direction.
 *
 * Being star-shaped about the origin also buys the single most useful
 * operation in the whole simulator for free: to find where a car is on the
 * track, take atan2(z, x) and refine locally. No nearest-neighbour search.
 *
 * Pure JS -- no three.js -- so the surface model is testable under node.
 */

import { SURFACE } from '../sim/tires.js';

export const CIRCUIT = {
  radius: 232,
  /**
   * Amplitudes chosen so the tightest corner comes out around a 29 m radius
   * (a second-gear corner) while opposite sides of the circuit stay ~43 m
   * apart -- comfortably more than the ~22 m the paved width needs, so the
   * ribbon can never self-intersect.
   */
  harmonics: [
    { k: 2, a: 0.2015, phi: 0.42 },
    { k: 3, a: 0.1144, phi: 1.94 },
    { k: 5, a: 0.0676, phi: 0.71 },
    { k: 7, a: 0.0312, phi: 2.63 },
  ],
  /** Half-width of the racing surface, m. */
  halfWidth: 7.4,
  /** Kerb width outboard of the racing surface, m. */
  kerbWidth: 1.35,
  /** Paved run-off beyond the kerb before it turns to grass, m. */
  runoffWidth: 2.5,
  /** Samples around the lap. ~1450 m / 900 -> 1.6 m resolution. */
  samples: 900,
};

export class TrackSpline {
  constructor(cfg = CIRCUIT) {
    this.cfg = cfg;
    const n = cfg.samples;
    this.n = n;
    this.px = new Float64Array(n + 1);
    this.pz = new Float64Array(n + 1);
    this.tx = new Float64Array(n + 1); // unit tangent
    this.tz = new Float64Array(n + 1);
    this.nx = new Float64Array(n + 1); // unit normal, pointing left of travel
    this.nz = new Float64Array(n + 1);
    this.curv = new Float64Array(n + 1); // signed, +ve turning left
    this.s = new Float64Array(n + 1); // cumulative arc length
    this.theta = new Float64Array(n + 1);

    this.build();
  }

  /** Radius of the centreline at polar angle theta. */
  radiusAt(theta) {
    let r = 1;
    for (const h of this.cfg.harmonics) r += h.a * Math.cos(h.k * theta + h.phi);
    return this.cfg.radius * r;
  }

  build() {
    const n = this.n;
    // Sample uniformly in theta first. The samples are then *not* uniform in
    // arc length, which is fine: `s` records where each one actually falls and
    // every lookup goes through it.
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      const r = this.radiusAt(th);
      this.theta[i] = th;
      this.px[i] = r * Math.cos(th);
      this.pz[i] = r * Math.sin(th);
    }

    // Arc length and tangents from central differences, so the seam at i=0
    // is treated exactly like every other sample.
    this.s[0] = 0;
    for (let i = 0; i <= n; i++) {
      const ip = (i + 1) % n;
      const im = (i - 1 + n) % n;
      let dx = this.px[ip] - this.px[im];
      let dz = this.pz[ip] - this.pz[im];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      this.tx[i] = dx;
      this.tz[i] = dz;
      // Left of a heading (dx, dz) in this coordinate system, matching the
      // vehicle model's convention (forward +Z -> left +X).
      this.nx[i] = dz;
      this.nz[i] = -dx;
      if (i > 0) {
        this.s[i] = this.s[i - 1] + Math.hypot(this.px[i] - this.px[i - 1], this.pz[i] - this.pz[i - 1]);
      }
    }
    this.length = this.s[n];

    // Discrete signed curvature from the circumscribed circle of each triple.
    for (let i = 0; i <= n; i++) {
      const ip = (i + 1) % n;
      const im = (i - 1 + n) % n;
      const ax = this.px[im];
      const az = this.pz[im];
      const bx = this.px[i];
      const bz = this.pz[i];
      const cx = this.px[ip];
      const cz = this.pz[ip];
      const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      const dab = Math.hypot(bx - ax, bz - az);
      const dbc = Math.hypot(cx - bx, cz - bz);
      const dca = Math.hypot(ax - cx, az - cz);
      const denom = dab * dbc * dca;
      this.curv[i] = denom > 1e-9 ? (2 * cross) / denom : 0;
    }

    let minR = Infinity;
    for (let i = 0; i < n; i++) {
      const k = Math.abs(this.curv[i]);
      if (k > 1e-9) minR = Math.min(minR, 1 / k);
    }
    this.minRadius = minR;
  }

  /** Index of the sample nearest a polar angle, wrapped. */
  indexForTheta(theta) {
    let t = theta;
    while (t < 0) t += Math.PI * 2;
    while (t >= Math.PI * 2) t -= Math.PI * 2;
    return Math.round((t / (Math.PI * 2)) * this.n) % this.n;
  }

  /**
   * Locate a world point relative to the centreline.
   *
   * Uses the star-shaped property for an O(1) initial guess, then refines over
   * a small window because the arc-length-nearest sample is not always the
   * angle-nearest one where the curve bends hard.
   *
   * @returns {{index:number, s:number, lateral:number, heading:number, curvature:number}}
   *   `lateral` is positive to the left of the direction of travel.
   */
  project(x, z) {
    const start = this.indexForTheta(Math.atan2(z, x));
    let best = start;
    let bestD2 = Infinity;
    for (let d = -6; d <= 6; d++) {
      const i = (start + d + this.n) % this.n;
      const dx = x - this.px[i];
      const dz = z - this.pz[i];
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    const dx = x - this.px[best];
    const dz = z - this.pz[best];
    // Decompose the offset into along-track and across-track components.
    const along = dx * this.tx[best] + dz * this.tz[best];
    const lateral = dx * this.nx[best] + dz * this.nz[best];
    return {
      index: best,
      s: (this.s[best] + along + this.length) % this.length,
      lateral,
      heading: Math.atan2(this.tx[best], this.tz[best]),
      curvature: this.curv[best],
    };
  }

  /** Centreline frame at an arc-length position, with wrapping. */
  frameAt(s) {
    const len = this.length;
    let t = s % len;
    if (t < 0) t += len;
    // Binary search the cumulative arc-length table.
    let lo = 0;
    let hi = this.n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.s[mid] <= t) lo = mid;
      else hi = mid;
    }
    const seg = this.s[hi] - this.s[lo] || 1;
    const f = (t - this.s[lo]) / seg;
    const lerp = (a, b) => a + (b - a) * f;
    const hiw = hi % this.n;
    return {
      x: lerp(this.px[lo], this.px[hiw]),
      z: lerp(this.pz[lo], this.pz[hiw]),
      tx: lerp(this.tx[lo], this.tx[hiw]),
      tz: lerp(this.tz[lo], this.tz[hiw]),
      nx: lerp(this.nx[lo], this.nx[hiw]),
      nz: lerp(this.nz[lo], this.nz[hiw]),
      curvature: lerp(this.curv[lo], this.curv[hiw]),
      heading: Math.atan2(lerp(this.tx[lo], this.tx[hiw]), lerp(this.tz[lo], this.tz[hiw])),
    };
  }

  /**
   * Which surface is at a world point, and therefore how much grip.
   * This is the function the tyre model actually consumes.
   */
  surfaceAt(x, z) {
    const p = this.project(x, z);
    const a = Math.abs(p.lateral);
    const c = this.cfg;
    if (a <= c.halfWidth - 0.35) return 'asphalt';
    if (a <= c.halfWidth) return 'paint'; // the white line is slippery
    if (a <= c.halfWidth + c.kerbWidth) return 'kerb';
    if (a <= c.halfWidth + c.kerbWidth + c.runoffWidth) return 'gravel';
    return 'grass';
  }

  gripAt(x, z) {
    return SURFACE[this.surfaceAt(x, z)];
  }

  /**
   * Kerbs only belong at corners. Returns, for each sample, whether the inside
   * and/or outside edge should be kerbed -- an inside kerb through the apex and
   * an outside kerb at the exit, which is where cars actually run wide.
   */
  kerbMask() {
    const n = this.n;
    const left = new Uint8Array(n);
    const right = new Uint8Array(n);
    const threshold = 1 / 78; // tighter than a 78 m radius counts as a corner
    for (let i = 0; i < n; i++) {
      // Look a little ahead and behind so a kerb starts before the apex and
      // runs past it, rather than appearing exactly where curvature peaks.
      let peak = 0;
      for (let d = -8; d <= 8; d++) {
        const k = this.curv[(i + d + n) % n];
        if (Math.abs(k) > Math.abs(peak)) peak = k;
      }
      if (Math.abs(peak) > threshold) {
        if (peak > 0) left[i] = 1; // turning left: inside is the left edge
        else right[i] = 1;
        // Exit kerb on the outside, where cars actually run wide.
        let ahead = 0;
        for (let d = -20; d <= -4; d++) {
          const k = this.curv[(i + d + n) % n];
          if (Math.abs(k) > Math.abs(ahead)) ahead = k;
        }
        if (Math.abs(ahead) > threshold * 1.5) {
          if (ahead > 0) right[i] = 1;
          else left[i] = 1;
        }
      }
    }
    return { left, right };
  }

  /** Start/finish pose: on the centreline at s = 0, facing along the track. */
  startPose() {
    const f = this.frameAt(4);
    return { x: f.x, z: f.z, yaw: Math.atan2(f.tx, f.tz) };
  }
}
