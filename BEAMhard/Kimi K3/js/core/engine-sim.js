// ============================================================================
// core/engine-sim.js — Combustion engine + gearbox simulation (pure JS).
// Parameters come straight from the parsed JBeam powertrain sections:
// torque curve, idle/max RPM, inertia, friction, gear ratios, final drive.
// Also exposes the acoustic descriptors (cylinder count, firing order,
// exhaust manifold length) consumed by the Web Audio synthesizer.
// ============================================================================

import { clamp, tableInterp } from './math.js';

export const DEFAULT_ACOUSTICS = {
  cylinders: 4,                    // 2.3L F4 (flat-four "box4")
  configuration: 'flat-4',
  firingOrder: [1, 3, 2, 4],       // typical Subaru-style flat-4
  exhaustManifoldLength: 0.85,     // m, primary runner length
  strokesPerCycle: 4,
};

export class EngineSim {
  /**
   * cfg: {
   *   torqueTable:[[rpm,Nm]...], idleRPM, maxRPM, inertia, friction,
   *   dynamicFriction, engineBrakeTorque, gearRatios:[reverse,0,g1..g6],
   *   finalDrive, drivenAxle:'RWD'|'FWD'|'AWD', acoustics
   * }
   */
  constructor(cfg) {
    this.torqueTable = cfg.torqueTable;
    this.idleRPM = cfg.idleRPM ?? 950;
    this.maxRPM = cfg.maxRPM ?? 10200;
    this.limiterRPM = cfg.limiterRPM ?? 7500;   // soft limiter engagement
    this.inertia = cfg.inertia ?? 0.11;
    this.friction = cfg.friction ?? 11.5;
    this.dynamicFriction = cfg.dynamicFriction ?? 0.024;
    this.engineBrakeTorque = cfg.engineBrakeTorque ?? 38;
    this.gearRatios = cfg.gearRatios ?? [-3.21, 0, 4.01, 2.72, 2.1, 1.7, 1.3, 0.97];
    this.finalDrive = cfg.finalDrive ?? 3.07;
    this.drivenAxle = cfg.drivenAxle ?? 'RWD';
    this.acoustics = cfg.acoustics ?? { ...DEFAULT_ACOUSTICS };

    this.rpm = this.idleRPM;
    this.throttle = 0;
    this.gear = 1;               // -1 = R, 0 = N, 1..6
    this.gearCount = this.gearRatios.length - 2;
    this.clutch = 0;             // 0 = fully open (standstill), 1 = locked
    this.limiterActive = false;
    this.shiftTimer = 0;         // >0 while a shift is in progress
    this.torqueOut = 0;          // Nm at crank (post losses)
    this.load = 0;               // 0..1 acoustic load estimate
    this.running = true;
    this._shiftCooldown = 0;
  }

  currentGearRatio() {
    if (this.gear === 0) return 0;
    const idx = this.gear === -1 ? 0 : this.gear + 1;
    return this.gearRatios[idx] ?? 0;
  }

  // Soft rev limiter: torque cuts progressively above limiterRPM.
  limiterFactor(rpm) {
    if (rpm < this.limiterRPM) return 1;
    const over = (rpm - this.limiterRPM) / (this.maxRPM - this.limiterRPM + 1);
    // sputtering cut: deterministic square wave ~15 Hz
    const sputter = (Math.floor(performanceNow() * 15) % 2 === 0) ? 0.15 : 0.55;
    return Math.max(0, 1 - over * 2.2) * sputter;
  }

  /**
   * Advance the engine.
   * @param dt        seconds
   * @param throttle  0..1
   * @param wheelRPM  rpm at driven wheels (average, absolute)
   * @param stuck     true when driven wheels are blocked (handbrake/stall)
   */
  update(dt, throttle, wheelRPM, stuck = false) {
    this.throttle = clamp(throttle, 0, 1);
    const ratio = this.currentGearRatio();
    const totalRatio = ratio * this.finalDrive;

    // --- clutch model: engages above idle, locks once moving ---------------
    const targetRPMFromWheels = Math.abs(totalRatio) > 1e-5
      ? Math.abs(wheelRPM * totalRatio) : 0;
    let clutchTarget;
    if (this.gear === 0 || this.shiftTimer > 0) clutchTarget = 0;
    else if (stuck && this.rpm < this.idleRPM + 400) clutchTarget = 0.15;
    else clutchTarget = clamp((this.rpm - this.idleRPM + 200) / 900, 0.12, 1);
    this.clutch += clamp(clutchTarget - this.clutch, -dt * 6, dt * 6);
    if (this.shiftTimer > 0) this.shiftTimer -= dt;

    // --- torque production ---------------------------------------------------
    const baseTq = tableInterp(this.torqueTable, this.rpm);
    const limF = this.limiterFactor(this.rpm);
    this.limiterActive = limF < 1;
    const request = baseTq * this.throttle * limF;

    // pumping + friction + engine braking
    const lossTq = this.friction * 0.12 + this.rpm * this.dynamicFriction * 0.06 +
      this.engineBrakeTorque * (1 - this.throttle) * clamp(this.rpm / 4000, 0, 1) * 0.25;

    // --- rpm dynamics ---------------------------------------------------------
    let netTq;
    const follow = targetRPMFromWheels;
    const rpmGap = Math.abs(follow - this.rpm);
    const lockWindow = Math.max(220, this.rpm * 0.14);
    if (this.clutch > 0.9 && Math.abs(totalRatio) > 1e-5 && rpmGap < lockWindow) {
      // fully locked: crank follows driven wheels
      const error = follow - this.rpm;
      this.rpm += error * clamp(dt * 12, 0, 1);
      netTq = request - lossTq;
    } else {
      // slipping/free: crank integrates on its own inertia; the clutch pack
      // drags the crank toward the wheel-matched speed (kinetic clutch).
      const dragToWheels = (follow - this.rpm) * this.clutch * 0.05;
      netTq = request - lossTq + dragToWheels;
      const alpha = (netTq / Math.max(this.inertia, 0.03)) * (60 / (2 * Math.PI)); // rpm/s
      this.rpm += alpha * dt;
      // strong viscous pull once the clutch is nearly fully engaged
      if (this.clutch > 0.5) {
        this.rpm += (follow - this.rpm) * clamp(dt * 8 * this.clutch, 0, 1);
      }
    }

    // idle governor
    if (this.throttle < 0.02 && this.rpm < this.idleRPM) {
      this.rpm += (this.idleRPM - this.rpm) * clamp(dt * 8, 0, 1);
    }
    this.rpm = clamp(this.rpm, 0, this.maxRPM * 1.02);

    // output torque at crank delivered to gearbox
    this.torqueOut = Math.max(0, request) * this.clutch - (1 - this.throttle) * this.engineBrakeTorque * 0.4 * this.clutch;
    this.load = clamp((request / Math.max(baseTq, 1)) * (0.35 + 0.65 * this.throttle), 0, 1);

    // --- automatic gearbox logic (upshift gated by driveline sync) -----------
    this._shiftCooldown -= dt;
    const nearSync = Math.abs(follow - this.rpm) < 700;
    if (this.gear > 0 && this._shiftCooldown <= 0 && this.shiftTimer <= 0) {
      const upRPM = 6900, downRPM = 2400;
      if (this.rpm > upRPM && this.gear < this.gearCount && this.throttle > 0.15 && nearSync) {
        this.gear++; this.shiftTimer = 0.28; this._shiftCooldown = 0.5;
      } else if (this.rpm < downRPM && this.gear > 1 && (this.throttle < 0.6 || this.rpm < 1700)) {
        // downshifts rev-match through clutch slip — no sync gate needed
        this.gear--; this.shiftTimer = 0.22; this._shiftCooldown = 0.5;
      }
    }
  }

  setGear(g) { this.gear = clamp(Math.round(g), -1, this.gearCount); }
  shiftUp() { if (this.gear < this.gearCount) { this.gear++; this.shiftTimer = 0.25; this._shiftCooldown = 0.4; } }
  shiftDown() { if (this.gear > -1) { this.gear--; this.shiftTimer = 0.25; this._shiftCooldown = 0.4; } }

  // Wheel torque (Nm) per driven wheel after gearbox & differential.
  wheelTorquePerDrivenWheel() {
    const ratio = this.currentGearRatio() * this.finalDrive;
    if (Math.abs(ratio) < 1e-5) return 0;
    const efficiency = 0.88;
    const n = this.drivenAxle === 'AWD' ? 4 : 2;
    return (this.torqueOut * ratio * efficiency) / n;
  }

  // Acoustic snapshot for the Web Audio synthesizer.
  acousticState() {
    const a = this.acoustics;
    const revsPerSec = this.rpm / 60;
    const firingsPerRev = a.cylinders / 2; // 4-stroke
    return {
      rpm: this.rpm,
      firingFreq: revsPerSec * firingsPerRev,      // Hz, fundamental exhaust pulse
      subFreq: revsPerSec / 2,                      // Hz, crank sub-harmonic
      throttle: this.throttle,
      load: this.load,
      gear: this.gear,
      limiterActive: this.limiterActive,
      cylinders: a.cylinders,
      firingOrder: a.firingOrder,
      manifoldLength: a.exhaustManifoldLength,
      running: this.running,
    };
  }
}

// performance.now shim for Node (validation harness) — injectable clock.
let _now = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000);
export function _setEngineClock(fn) { _now = fn; }
function performanceNow() { return _now(); }
