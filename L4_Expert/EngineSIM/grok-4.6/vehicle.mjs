/**
 * Planar vehicle dynamics: two-axle single-track (bicycle) model
 * with a linear+friction-circle tire approximation.
 *
 * Independent of rendering. Coupled to the engine audio module only
 * through the scalar state { rpm, throttle, load, fuelCut, speedMs }.
 */

export const VEHICLE_SPEC = Object.freeze({
  mass: 1680,
  iz: 2900,
  wheelbase: 2.89,
  a: 1.38,
  b: 1.51,
  wheelRadius: 0.335,
  steerMaxRad: (32 * Math.PI) / 180,
  mu: 0.95,
  caFront: 72000,
  caRear: 68000,
  idleRpm: 800,
  redlineRpm: 6800,
  fuelCutRpm: 6900,
  maxTorqueNm: 560,
  gears: Object.freeze([3.24, 2.18, 1.54, 1.18, 1.0, 0.85]),
  finalDrive: 3.54,
  drivelineEff: 0.88,
  engineInertia: 0.28,
  layout: 'front-mid',
});

const G = 9.81;
const TWO_PI = Math.PI * 2;

export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

export function finiteOr(x, fallback) {
  return Number.isFinite(x) ? x : fallback;
}

export function torqueCurveNm(rpm) {
  const red = VEHICLE_SPEC.redlineRpm;
  const x = clamp((rpm - 700) / (red - 700), 0, 1);
  const shape = Math.sin(Math.PI * Math.pow(x, 0.82));
  return (90 + VEHICLE_SPEC.maxTorqueNm * shape) * (rpm < 500 ? rpm / 500 : 1);
}

export function frictionCircle(fxDes, fyDes, fMax) {
  const mag = Math.hypot(fxDes, fyDes);
  if (mag <= fMax || mag < 1e-9) return { fx: fxDes, fy: fyDes };
  const s = fMax / mag;
  return { fx: fxDes * s, fy: fyDes * s };
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export class Vehicle {
  constructor(opts) {
    this.spec = Object.assign({}, VEHICLE_SPEC, opts || {});
    this.reset();
  }

  reset() {
    const s = this.spec;
    this.x = 0;
    this.y = 0;
    this.yaw = 0;
    this.vx = 0;
    this.vy = 0;
    this.r = 0;
    this.rpm = s.idleRpm;
    this.gear = 1;
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.fuelCutCmd = false;
    this.fuelCut = false;
    this.load = 0;
    this.engineBrake = 0;
    this.clutch = 0;
    this.omegaW = 0;
    this.shiftTimer = 0;
    this.idleI = 0;
  }

  setInput(input) {
    const i = input || {};
    this.throttle = clamp(finiteOr(i.throttle, this.throttle), 0, 1);
    this.brake = clamp(finiteOr(i.brake, this.brake), 0, 1);
    this.steer = clamp(finiteOr(i.steer, this.steer), -1, 1);
    if (typeof i.fuelCut === 'boolean') this.fuelCutCmd = i.fuelCut;
  }

  _shiftLogic(dt) {
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      return;
    }
    const rpm = this.rpm;
    const thr = this.throttle;
    const up = 5600 + 900 * thr;
    const down = 1700 + 700 * thr;
    if (rpm > up && this.gear < this.spec.gears.length) {
      this.gear += 1;
      this.shiftTimer = 0.18;
    } else if (rpm < down && this.gear > 1 && this.vx > 4) {
      this.gear -= 1;
      this.shiftTimer = 0.12;
    }
  }

  _idleGovernor() {
    const err = this.spec.idleRpm - this.rpm;
    this.idleI = clamp(this.idleI + err * 0.00025, -80, 220);
    const p = 0.55 * err;
    return clamp(p + this.idleI, 0, 280);
  }

  step(dt) {
    const s = this.spec;
    dt = clamp(finiteOr(dt, 0), 1e-4, 0.05);

    this._shiftLogic(dt);

    const delta = this.steer * s.steerMaxRad;
    const ratio = s.gears[this.gear - 1] * s.finalDrive;
    const speed = Math.hypot(this.vx, this.vy);
    const wheelOmegaTarget = Math.abs(this.vx) / s.wheelRadius;
    const rpmFromWheels = (wheelOmegaTarget * ratio * 60) / TWO_PI;

    this.clutch = clamp(
      smoothstep(0.25, 1.8, speed) * 0.5 + this.throttle * 0.72 + (speed > 2.2 ? 0.28 : 0),
      0,
      1
    );

    this.fuelCut =
      this.fuelCutCmd ||
      this.rpm >= s.fuelCutRpm ||
      (this.throttle < 0.04 && this.rpm > s.idleRpm + 450 && speed > 3);

    const combustion = this.fuelCut ? 0 : 1;
    const idleTq = this.throttle < 0.06 ? this._idleGovernor() : 0;
    const driverTq = torqueCurveNm(this.rpm) * this.throttle * combustion;
    const coast = this.fuelCut || this.throttle < 0.05 ? 0.012 * (this.rpm - s.idleRpm) : 0;
    const netEngineTq = driverTq + idleTq - coast;

    const driveForce =
      (netEngineTq * ratio * s.drivelineEff * this.clutch) / s.wheelRadius;
    const brakeForce = this.brake * 11500 + (this.brake > 0.95 ? 2500 : 0);
    const drag = 0.42 * 1.2 * 0.5 * speed * speed;
    const roll = 180 * Math.tanh(this.vx * 0.6);

    const m = s.mass;
    const fzF = (m * G * s.b) / (s.a + s.b);
    const fzR = (m * G * s.a) / (s.a + s.b);
    const fMaxF = s.mu * fzF;
    const fMaxR = s.mu * fzR;

    const vxSafe = this.vx >= 0 ? Math.max(this.vx, 0.35) : Math.min(this.vx, -0.35);
    const alphaF = Math.atan2(this.vy + s.a * this.r, vxSafe) - delta;
    const alphaR = Math.atan2(this.vy - s.b * this.r, vxSafe);

    const fyFdes = -s.caFront * alphaF;
    const fyRdes = -s.caRear * alphaR;
    const fxFdes = -0.38 * brakeForce * Math.sign(this.vx || 1);
    const fxRdes = driveForce - 0.62 * brakeForce * Math.sign(this.vx || 1) - roll * 0.55;

    const front = frictionCircle(fxFdes, fyFdes, fMaxF);
    const rear = frictionCircle(fxRdes, fyRdes, fMaxR);

    const c = Math.cos(delta);
    const sn = Math.sin(delta);
    const fx = front.fx * c - front.fy * sn + rear.fx - drag * Math.sign(this.vx || 1);
    const fy = front.fx * sn + front.fy * c + rear.fy;

    const ax = fx / m + this.vy * this.r;
    const ay = fy / m - this.vx * this.r;
    const yawAcc = (s.a * (front.fx * sn + front.fy * c) - s.b * rear.fy) / s.iz;

    const kinBlend = 1 - smoothstep(0.6, 3.2, Math.abs(this.vx));
    const rKin = this.vx * Math.tan(delta) / (s.a + s.b);

    this.vx += ax * dt;
    this.vy += ay * dt;
    this.r += yawAcc * dt;
    this.r = this.r * (1 - kinBlend) + rKin * kinBlend;
    this.vy *= 1 - 0.35 * kinBlend;

    if (this.brake > 0.2 && Math.abs(this.vx) < 0.45) {
      this.vx = 0;
      this.vy *= 0.4;
      this.r *= 0.4;
    }

    this.vx = finiteOr(this.vx, 0);
    this.vy = finiteOr(this.vy, 0);
    this.r = finiteOr(this.r, 0);

    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    this.x += (this.vx * cy - this.vy * sy) * dt;
    this.y += (this.vx * sy + this.vy * cy) * dt;
    this.yaw += this.r * dt;
    this.x = finiteOr(this.x, 0);
    this.y = finiteOr(this.y, 0);
    this.yaw = finiteOr(this.yaw, 0);

    const loadTorque = this.clutch * (driveForce * s.wheelRadius) / Math.max(ratio, 0.5);
    const rpmDot = ((netEngineTq - loadTorque) / s.engineInertia) * (60 / TWO_PI);
    let rpmTarget;
    const launching = speed < 2.8 && this.throttle > 0.08;
    if (launching || this.clutch < 0.22) {
      rpmTarget = s.idleRpm + this.throttle * 2800;
      this.rpm += (rpmTarget - this.rpm) * clamp(dt * 3.4, 0, 1);
      this.rpm += rpmDot * dt * 0.12;
    } else {
      rpmTarget = clamp(rpmFromWheels, 500, s.redlineRpm + 200);
      this.rpm += (rpmTarget - this.rpm) * clamp(dt * 6.5, 0, 1);
      this.rpm += rpmDot * dt * 0.08;
    }
    this.rpm = clamp(finiteOr(this.rpm, s.idleRpm), 480, s.redlineRpm + 250);

    const driveUsed = Math.abs(rear.fx);
    this.load = clamp(driveUsed / (fMaxR + 1), 0, 1);
    this.engineBrake = coast;
    this.omegaW = Math.abs(this.vx) / s.wheelRadius;
  }

  getState() {
    const speedMs = Math.hypot(this.vx, this.vy);
    return {
      x: this.x,
      y: this.y,
      yaw: this.yaw,
      vx: this.vx,
      vy: this.vy,
      yawRate: this.r,
      rpm: this.rpm,
      speedMs,
      speedKmh: speedMs * 3.6,
      gear: this.gear,
      throttle: this.throttle,
      brake: this.brake,
      steer: this.steer,
      fuelCut: this.fuelCut,
      load: this.load,
      clutch: this.clutch,
      layout: this.spec.layout,
      finite: Number.isFinite(this.x) && Number.isFinite(this.rpm) && Number.isFinite(this.r),
    };
  }
}
