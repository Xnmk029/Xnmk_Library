/**
 * Clutch, gearbox and final drive.
 *
 * The clutch is the interesting part acoustically: it is what lets the engine
 * speed diverge from the wheel speed, so it is what makes a launch sound like
 * a launch instead of a fixed-ratio whine.
 */

/** TR6060-style 6-speed manual behind a 6.4 L V8. */
export const MUSCLE_DRIVETRAIN = {
  gears: [2.97, 2.1, 1.46, 1.0, 0.74, 0.5],
  reverse: 3.28,
  finalDrive: 3.09,
  efficiency: 0.93,
  /** Clutch torque capacity, Nm. Comfortably above peak engine torque. */
  clutchCapacity: 1050,
  /**
   * Coupling stiffness, Nm per rad/s of slip. Set deliberately high: the
   * update is semi-implicit, so it self-limits to the stiffest value the
   * timestep can carry instead of oscillating.
   */
  clutchStiffness: 3000,
  /** Auto-clutch: how much rpm above idle is needed for full engagement. */
  engageBand: 950,
  shiftTimeMs: 160,
  /** Automatic mode shift points. */
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
   * @param {number} dt
   * @param {object} s
   * @param {number} s.engineOmega   rad/s
   * @param {number} s.wheelOmega    rad/s of the driven axle
   * @param {number} s.throttle      0..1
   * @param {number} s.speed         m/s
   * @param {number} s.brake         0..1, so the clutch can release on a hold
   * @param {number} s.engineInertia kg m^2
   * @param {number} s.axleInertia   kg m^2
   * @param {number} s.reflectedMass kg m^2, vehicle mass seen at the axle
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
      // Shift on ROAD SPEED, not on the tachometer.
      //
      // During a shift the clutch is open, so the engine is free. Deciding
      // from the actual engine speed means a free-revving engine hits the
      // upshift threshold instantly, opens the clutch again, and runs the
      // whole gearbox from 2nd to top in half a second. Every real TCU
      // decides from output-shaft speed for exactly this reason.
      const impliedRpm = (g) => Math.abs(wheelOmega * this.ratio(g)) * RADS_TO_RPM;
      // Kickdown: hold a lower gear longer when the driver is asking for it.
      const downRpm = d.autoDownRpm * (1 + throttle * 0.55);
      if (impliedRpm(this.gear) > d.autoUpRpm && this.gear < this.gearCount) {
        this.shiftUp();
      } else if (this.gear > 1 && impliedRpm(this.gear) < downRpm) {
        // Never downshift into the limiter.
        if (impliedRpm(this.gear - 1) < this.engineDef.limiterRpm * 0.95) this.shiftDown();
      }
    }

    // Cut drive through the shift -- this is where the exhaust goes quiet
    // for a beat and then cracks back in.
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
    // Engagement ramps in above idle so the car creeps and launches without
    // the driver having to manage a clutch pedal, while still *slipping*
    // (which is what the engine and the exhaust need to hear).
    //
    // Below idle the capacity is zero. That matters more than it looks: a
    // cranking engine makes less torque than a partially engaged clutch
    // absorbs, so any non-zero floor here stalls the car on every start.
    const idle = this.engineDef.idleRpm;
    let autoLock = Math.min(1, Math.max(0, (rpm - idle * 0.92) / d.engageBand));
    // Once rolling, lock fully regardless of rpm.
    if (Math.abs(speed) > 4) autoLock = 1;
    // Stopped with the brake on: release, the way an automatic's converter
    // effectively does. Without this, holding the brake at a light stalls it.
    if (Math.abs(speed) < 1.2 && brake > 0.15) autoLock = 0;
    const lock = Math.max(0, (1 - this.clutchPedal) * autoLock * (1 - shifting));

    const inputOmega = wheelOmega * ratio;
    const slip = engineOmega - inputOmega;
    this.slipOmega = slip;
    this.engagement = lock;

    // --- coupling torque, semi-implicitly ------------------------------
    // A stiff viscous clutch is a stiff spring between two small inertias,
    // and an explicit step blows up when dt * k * (1/Ie + n^2/Iw) > 2. At
    // 1 kHz in first gear that limit is around 40 Nm per rad/s, which is far
    // too soft -- the engine would read hundreds of rpm above the gear.
    //
    // Backward Euler on the slip instead: slip' = slip / (1 + dt k invEff).
    // The result is unconditionally stable at any stiffness and asymptotes to
    // the stiffest coupling the timestep can actually carry. The few rad/s of
    // residual slip that remain are a fair stand-in for real driveline
    // torsional compliance.
    // invEff must use the *true* inertias. Inflating it (say, by adding the
    // vehicle mass reflected through the tyre) weakens the implicit term and
    // the clutch chatters between +/- capacity instead of settling.
    const invEff = 1 / s.engineInertia + (ratio * ratio) / s.axleInertia;
    const k = d.clutchStiffness;
    const capacity = d.clutchCapacity * lock;
    let torque = (k * slip) / (1 + dt * k * invEff);
    if (torque > capacity) torque = capacity;
    else if (torque < -capacity) torque = -capacity;

    // Engine braking through a locked clutch also flows this way (negative
    // torque), which is what triggers overrun crackle in Engine.update.
    this.clutchTorque = torque;
    this.wheelTorque = torque * ratio * d.efficiency;
    return { clutchTorque: torque, wheelTorque: this.wheelTorque };
  }
}
