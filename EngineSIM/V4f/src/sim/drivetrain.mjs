/**
 * Clutch, gearbox and final drive.
 *
 * The clutch is the interesting part acoustically: it lets engine speed
 * diverge from wheel speed, so a launch sounds like a launch instead of a
 * fixed-ratio whine.
 */

/** TR6060-style 6-speed manual behind a 6.4 L V8. */
export const MUSCLE_DRIVETRAIN = {
  gears: [2.97, 2.1, 1.46, 1.0, 0.74, 0.5],
  reverse: 3.28,
  finalDrive: 3.09,
  efficiency: 0.93,
  /** Clutch torque capacity, Nm. Comfortably above peak engine torque. */
  clutchCapacity: 1050,
  /** Coupling stiffness, Nm per rad/s of slip (semi-implicit, see below). */
  clutchStiffness: 3000,
  /** Auto-clutch: rpm above idle needed for full engagement. */
  engageBand: 950,
  shiftTimeMs: 160,
  autoUpRpm: 6150,
  autoDownRpm: 2350,
};

const RADS_TO_RPM = 60 / (2 * Math.PI);

export class Drivetrain {
  constructor(def, engineDef) {
    this.def = def;
    this.engineDef = engineDef;
    this.gear = 1; // -1 reverse, 0 neutral, 1..n
    this.clutchPedal = 0; // 0 engaged, 1 fully disengaged
    this.shiftTimer = 0;
    this.pendingGear = null;
    this.auto = true;
    this.clutchTorque = 0;
    this.wheelTorque = 0;
    this.slipOmega = 0;
    this.engagement = 0;
    this.shifting = false;
  }

  get gearCount() {
    return this.def.gears.length;
  }

  gearLabel() {
    if (this.gear === -1) return 'R';
    if (this.gear === 0) return 'N';
    return String(this.gear);
  }

  /** Signed ratio from gearbox input shaft to wheels. */
  ratio(gear = this.gear) {
    if (gear === 0) return 0;
    if (gear === -1) return -this.def.reverse * this.def.finalDrive;
    return this.def.gears[gear - 1] * this.def.finalDrive;
  }

  requestGear(g) {
    if (g === this.gear || this.shiftTimer > 0) return;
    if (g < -1 || g > this.gearCount) return;
    this.pendingGear = g;
    this.shiftTimer = this.def.shiftTimeMs / 1000;
  }

  shiftUp() {
    this.requestGear(Math.min(this.gearCount, Math.max(1, this.gear + 1)));
  }

  shiftDown() {
    this.requestGear(this.gear <= 1 ? Math.max(-1, this.gear - 1) : this.gear - 1);
  }

  /**
   * @param {object} s
   * @param {number} s.engineOmega   rad/s
   * @param {number} s.wheelOmega    rad/s of the driven axle (average rear)
   * @param {number} s.throttle      0..1
   * @param {number} s.speed         m/s
   * @param {number} s.brake         0..1, so the clutch releases on a hold
   * @param {number} s.engineInertia kg m^2
   * @param {number} s.axleInertia   kg m^2
   */
  update(dt, s) {
    const d = this.def;
    const { engineOmega, wheelOmega, throttle, speed, brake } = s;
    const rpm = engineOmega * RADS_TO_RPM;

    // --- shift sequencing ---------------------------------------------
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= d.shiftTimeMs / 2000 && this.pendingGear !== null) {
        this.gear = this.pendingGear;
        this.pendingGear = null;
      }
    } else if (this.auto && this.gear > 0) {
      // Decide on ROAD SPEED, not the tachometer (a free-revving engine
      // would otherwise bounce through every gear during a shift).
      const impliedRpm = (g) => Math.abs(wheelOmega * this.ratio(g)) * RADS_TO_RPM;
      const downRpm = d.autoDownRpm * (1 + throttle * 0.55);
      if (impliedRpm(this.gear) > d.autoUpRpm && this.gear < this.gearCount) {
        this.shiftUp();
      } else if (this.gear > 1 && impliedRpm(this.gear) < downRpm) {
        if (impliedRpm(this.gear - 1) < this.engineDef.limiterRpm * 0.95) this.shiftDown();
      }
    }

    const shifting = this.shiftTimer > 0 ? 1 : 0;
    this.shifting = !!shifting;

    const ratio = this.ratio();
    if (ratio === 0) {
      this.clutchTorque = 0;
      this.wheelTorque = 0;
      this.engagement = 0;
      this.slipOmega = engineOmega;
      return { clutchTorque: 0, wheelTorque: 0 };
    }

    // --- auto-clutch ---------------------------------------------------
    const idle = this.engineDef.idleRpm;
    let autoLock = Math.min(1, Math.max(0, (rpm - idle * 0.92) / d.engageBand));
    if (Math.abs(speed) > 4) autoLock = 1;
    if (Math.abs(speed) < 1.2 && brake > 0.15) autoLock = 0;
    const lock = Math.max(0, (1 - this.clutchPedal) * autoLock * (1 - shifting));

    const inputOmega = wheelOmega * ratio;
    const slip = engineOmega - inputOmega;
    this.slipOmega = slip;
    this.engagement = lock;

    // --- coupling torque, semi-implicitly ------------------------------
    // Backward Euler on the slip: slip' = slip / (1 + dt k invEff) is
    // unconditionally stable at any stiffness and asymptotes to the stiffest
    // coupling the timestep can carry.
    const invEff = 1 / s.engineInertia + (ratio * ratio) / s.axleInertia;
    const k = d.clutchStiffness;
    const capacity = d.clutchCapacity * lock;
    let torque = (k * slip) / (1 + dt * k * invEff);
    if (torque > capacity) torque = capacity;
    else if (torque < -capacity) torque = -capacity;

    // Torque signs: at the clutch, positive accelerates the engine.
    // At the wheels, positive pushes the car forward.
    this.clutchTorque = torque;
    this.wheelTorque = (torque * ratio) / d.efficiency * (torque >= 0 ? 1 : d.efficiency);
    return { clutchTorque: torque, wheelTorque: this.wheelTorque };
  }
}
