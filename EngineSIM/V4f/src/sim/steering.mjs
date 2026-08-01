/**
 * Steering assist: grip-limited steering (anti-push), self-centring /
 * drift counter-steer and electronic yaw damping.
 *
 * Pure JS (no three.js), matching the rest of src/sim. Sign conventions are
 * the vehicle body frame: +x forward, +y left, yaw positive = turning left,
 * steer +1 = full left lock.
 *
 * The three terms:
 *
 *  1. Anti-push cap. At speed v with front grip `mu`, the smallest radius
 *     the front tyres can hold is R = v^2 / (mu * g). The wheel angle that
 *     radius needs is atan(L / R); anything more just saturates the front
 *     tyres and the car pushes wide. The cap trims the player's input to
 *     that angle (with a small online-learned correction for the tyre's
 *     actual peak slip angle).
 *  2. Self-centring. The front axle velocity direction psi acts like caster:
 *     the wheels are pushed toward psi, which in a slide means an automatic
 *     counter-steer. Scaled by (1 - |input|) so it never fights the driver
 *     who is already steering.
 *  3. Yaw damping. A negative feedback on yaw rate, strongest with hands
 *     off, that catches the beginning of a spin (ESC-style).
 *
 * The cap widens towards full lock when the rear axle is sliding and the
 * driver is counter-steering, so a drift can be held and recovered instead
 * of being strangled by the anti-push limiter. The whole assist fades to
 * zero below ~15 km/h so parking and reversing feel untouched.
 */

const G = 9.81;
const RAD = Math.PI / 180;

export const STEERING_ASSIST_DEFAULT = {
  /** Fraction of the physical grip cap actually applied (margin below peak). */
  capResponse: 0.9,
  /** Low-pass rate on the cap, 1/s. */
  capRate: 9,

  /** Online slip-angle learning. */
  learnRate: 0.4,
  learnSpeed: 8, // m/s
  learnSatLo: 0.8,
  learnSatHi: 1.5,
  learnMin: 2 * RAD,
  learnMax: 14 * RAD,
  learnScaleMin: 0.9,
  learnScaleMax: 1.35,

  /** Self-centring shaping. */
  centerGain: 0.9, // normalized steer at |psi| == centerRef
  centerExponent: 0.75,
  centerRef: 0.45, // rad of front-axle slip at which gain saturates
  centerDeadband: 0.02, // rad; ignore tiny noise on a straight line

  /** Yaw damping: normalized steer per rad/s of yaw rate. */
  yawDampingGain: 0.2,

  /** Rear-slip fusion thresholds. */
  capWidenStart: 2 * RAD,
  capWidenEnd: 5 * RAD,
  steerBlendStart: 5 * RAD,
  steerBlendEnd: 12 * RAD,

  /** Speed fade, km/h. */
  fadeInKph: 1.8,
  fadeFullKph: 15,
};

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(x, a, b) {
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

export class SteeringAssist {
  /**
   * @param {object} [params]  overrides for STEERING_ASSIST_DEFAULT
   * @param {number} [alphaPeak] front tyre peak slip angle, radians
   */
  constructor(params = {}, alphaPeak = 0.09) {
    this.p = { ...STEERING_ASSIST_DEFAULT, ...params };
    this.alphaPeak = alphaPeak;
    this.learned = alphaPeak;
    this.cap = 1;
    this.center = 0;
    this.damp = 0;
    this.psi = 0;
    this.assisted = 0;
  }

  reset() {
    this.learned = this.alphaPeak;
    this.cap = 1;
    this.center = 0;
    this.damp = 0;
    this.psi = 0;
    this.assisted = 0;
  }

  /**
   * @param {object} s
   * @param {number} s.vx         forward speed, m/s
   * @param {number} s.vy         lateral speed, m/s (left +)
   * @param {number} s.r          yaw rate, rad/s (left +)
   * @param {number} s.frontAxle  CG -> front axle, m
   * @param {number} s.rearAxle   CG -> rear axle, m
   * @param {number} s.wheelbase  m
   * @param {number} s.maxSteer   current steering lock, rad
   * @param {number} s.frontMu    effective front friction coefficient
   * @param {number} s.frontSat   front saturation (0 = no slip, 1 = peak)
   * @param {number} s.steer      current smoothed road-wheel angle, rad
   * @param {boolean} s.airborne
   * @param {number} raw          player input, -1..1
   * @param {number} dt           seconds
   * @returns {number} assisted input, -1..1
   */
  update(s, raw, dt) {
    const p = this.p;
    const input = clamp(raw, -1, 1);
    const speed = Math.hypot(s.vx, s.vy);
    const fade = smoothstep(speed * 3.6, p.fadeInKph, p.fadeFullKph);

    // Front-axle velocity direction relative to the heading (left +). This
    // is the direction the wheels want to align with.
    const psi = Math.atan2(s.vy + s.r * s.frontAxle, Math.max(Math.abs(s.vx), 0.8));
    const frontSlip = s.steer - psi;
    const rearSlip = -Math.atan2(
      s.vy - s.r * s.rearAxle,
      Math.max(Math.abs(s.vx), 0.8)
    );
    this.psi = psi;

    // --- online learning of the front peak slip angle -------------------
    // When the front is genuinely near its limit, remember how much slip
    // angle the tyre actually carries and scale the cap by it.
    if (!s.airborne && speed > p.learnSpeed && s.frontSat > p.learnSatLo && s.frontSat < p.learnSatHi) {
      const obs = clamp(Math.abs(frontSlip), p.learnMin, p.learnMax);
      this.learned += (obs - this.learned) * Math.min(1, dt * p.learnRate);
    }
    const learnScale = clamp(this.learned / this.alphaPeak, p.learnScaleMin, p.learnScaleMax);

    // --- anti-push cap ---------------------------------------------------
    const gripAcc = clamp(s.frontMu, 0.08, 3) * G;
    const rBest = Math.max((speed * speed) / gripAcc, 0.05);
    const thetaLimit = Math.atan2(s.wheelbase, rBest);
    const capTarget = clamp((thetaLimit / s.maxSteer) * p.capResponse * learnScale, 0, 1);
    this.cap += (capTarget - this.cap) * Math.min(1, dt * p.capRate);

    // --- self-centring + yaw damping -------------------------------------
    const inputMag = Math.abs(input);
    const handsOff = 1 - inputMag;
    const relPsi = clamp(psi / p.centerRef, -1, 1);
    const engage = Math.abs(psi) > p.centerDeadband ? 1 : 0;
    const align =
      Math.sign(relPsi) *
      p.centerGain *
      Math.pow(Math.abs(relPsi), p.centerExponent) *
      handsOff *
      engage;
    const damp = -s.r * p.yawDampingGain * handsOff;

    // --- state fusion ------------------------------------------------------
    const rearAbs = clamp(Math.abs(rearSlip), 0, 0.8);
    const wCap = smoothstep(rearAbs, p.capWidenStart, p.capWidenEnd);
    const wSteer = smoothstep(rearAbs, p.steerBlendStart, p.steerBlendEnd);
    // The driver is counter-steering when their input opposes the yaw
    // rotation (or, near a rotation reversal, the front-axle slide). That is
    // when the anti-push cap must step aside so the slide can be caught.
    const counter =
      inputMag > 0.04 &&
      ((Math.sign(input) !== Math.sign(s.r) && Math.abs(s.r) > 0.05) ||
        (Math.sign(input) !== Math.sign(psi) && Math.abs(psi) > 0.02));
    const capEff = counter ? lerp(this.cap, 1, wCap) : this.cap;
    const center = lerp(align * 0.5, align, wSteer);
    this.center = center;
    this.damp = damp;

    if (s.airborne || fade <= 0) {
      this.center = 0;
      this.damp = 0;
      this.assisted = input;
      return input;
    }

    const out = clamp(input * capEff + center + damp, -1, 1);
    this.assisted = out;
    return lerp(input, out, fade);
  }
}
