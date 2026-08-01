// Phase 1.2 — Tire decoupling: every JBeam tire node group becomes an
// independent soft-body wheel assembly. The carcass is modelled as a ring of
// N virtual soft nodes with radial springs (pressure-derived stiffness), the
// suspension as a raycast spring/damper with separate bump/rebound rates parsed
// from the JBeam damper beams, and the contact patch uses a combined-slip tire
// model with an explicit high-friction PhysicsMaterial (friction >= 1.2, rough).

import * as THREE from '../../lib/three.module.js';

/**
 * Explicit physical material for tires, per benchmark directive:
 * friction >= 1.2, rough = true.
 */
export const TIRE_PHYSICS_MATERIAL = Object.freeze({
  name: 'jbeam_tire_softbody',
  friction: 1.4,      // >= 1.2 mandated
  rough: true,
  restitution: 0.05,
});

/** Soft-body tire carcass: a ring of radial spring nodes decoupled from the chassis. */
export class SoftTireRing {
  /**
   * @param {number} radius unloaded tire radius (m)
   * @param {number} width tire width (m)
   * @param {number} nodeCount virtual soft nodes around the ring
   * @param {number} pressurePa inflation pressure -> radial stiffness scaling
   */
  constructor(radius, width, nodeCount = 16, pressurePa = 220000) {
    this.radius = radius;
    this.width = width;
    this.nodeCount = nodeCount;
    this.pressurePa = pressurePa;
    // Radial spring rate per node derived from pressure (empirical mapping).
    this.radialK = 90000 * (pressurePa / 220000);
    this.radialD = 4500;
    // Per-node radial deflection state (m), index 0 = contact node.
    this.deflection = new Float32Array(nodeCount);
    this.deflectionVel = new Float32Array(nodeCount);
    // Aggregate contact metrics, written each step by WheelAssembly.
    this.contactDeflection = 0; // deflection at the contact patch (m)
    this.effectiveRadius = radius; // radius - contact deflection
  }

  /**
   * Distribute a contact-patch deflection across neighbouring ring nodes
   * (gaussian falloff) and integrate the soft ring one step.
   * @param {number} patchDeflection raw penetration at the contact node (m, >=0)
   * @param {number} dt
   */
  applyContact(patchDeflection, dt) {
    const n = this.nodeCount;
    const sigma = n / 8;
    for (let i = 0; i < n; i++) {
      // Distance around the ring from the contact node.
      const d = Math.min(i, n - i);
      const influence = Math.exp(-(d * d) / (2 * sigma * sigma));
      const target = patchDeflection * influence;
      // Node radial spring toward its (possibly deformed) target deflection.
      const acc = (target - this.deflection[i]) * 220 - this.deflectionVel[i] * 28;
      this.deflectionVel[i] += acc * dt;
      this.deflection[i] += this.deflectionVel[i] * dt;
    }
    this.contactDeflection = this.deflection[0];
    this.effectiveRadius = Math.max(this.radius * 0.55, this.radius - this.contactDeflection);
  }
}

export class WheelAssembly {
  /**
   * @param {object} spec
   * @param {string} spec.name e.g. 'FL'
   * @param {THREE.Vector3} spec.attachLocal suspension hardpoint in body frame
   * @param {boolean} spec.steerable, spec.driven
   * @param {number} spec.radius tire radius, spec.width tire width
   * @param {number} spec.springK wheel-rate spring (N/m)
   * @param {number} spec.dampBump compression damping (N·s/m)
   * @param {number} spec.dampRebound rebound damping (N·s/m)
   * @param {number} spec.travelUp bump travel (m), spec.travelDown droop travel (m)
   * @param {number} spec.brakeTorqueMax peak brake torque (N·m)
   * @param {number} spec.inertia wheel+tire rotational inertia (kg·m²)
   * @param {number} spec.mass unsprung mass (kg)
   * @param {number} [spec.gripScale] per-axle grip multiplier
   */
  constructor(spec) {
    Object.assign(this, {
      name: 'W', steerable: false, driven: false,
      radius: 0.33, width: 0.21, springK: 45000,
      dampBump: 2600, dampRebound: 5200,
      travelUp: 0.09, travelDown: 0.11,
      brakeTorqueMax: 2000, inertia: 1.1, mass: 24, gripScale: 1,
    }, spec);
    this.attachLocal = this.attachLocal.clone();

    this.material = TIRE_PHYSICS_MATERIAL; // shared high-friction rough material
    this.tire = new SoftTireRing(this.radius, this.width, 16);

    // Dynamic state.
    this.angularVel = 0;       // wheel spin (rad/s, + = forward roll)
    this.steerAngle = 0;       // current steer (rad)
    this.compression = 0;      // suspension compression from ride height (m)
    this.damperVelocity = 0;
    this.suspensionForce = 0;  // last vertical force (N)
    this.inContact = false;
    this.slipRatio = 0;
    this.slipAngle = 0;
    this.longForce = 0;
    this.latForce = 0;
    this.loadN = 0;            // vertical load on the tire (N)
    this.submerged = false;

    // Scratch objects (avoid per-step allocation).
    this._wAttach = new THREE.Vector3();
    this._wDir = new THREE.Vector3();
    this._wContact = new THREE.Vector3();
    this._wVel = new THREE.Vector3();
    this._basisF = new THREE.Vector3();
    this._basisR = new THREE.Vector3();
  }

  /**
   * One suspension + tire step. Applies forces to the chassis body.
   * @param {number} dt
   * @param {RigidBody} body chassis
   * @param {Function} queryGround analytic ground sampler
   * @param {Function|null} queryWater analytic water sampler
   * @param {object} ctrl {driveTorque, brake(0-1), handbrake(bool), steerAngle}
   */
  update(dt, body, queryGround, queryWater, ctrl) {
    this.steerAngle = ctrl.steerAngle || 0;
    const basis = body.getBasis();

    // Suspension acts along chassis -up (double-wishbone approximation).
    const suspDir = this._wDir.copy(basis.up).multiplyScalar(-1);
    const attachW = body.localToWorld(this.attachLocal, this._wAttach);
    const restLen = this.travelDown + this.radius; // attach->ground at ride height

    // Raycast along suspension axis against analytic ground.
    // Sample ground at the wheel's XZ (approximation: patch directly below attach).
    const g = queryGround(attachW.x, attachW.z);
    const distToGround = (attachW.y - g.height);
    const suspensionLen = distToGround; // along Y; adequate for moderate roll/pitch
    const maxLen = this.travelDown + this.radius + this.tire.radius * 0.4;
    const prevCompression = this.compression;
    this.compression = THREE.MathUtils.clamp(restLen - suspensionLen, -this.travelDown, this.travelUp + 0.05);
    this.inContact = suspensionLen < maxLen && this.compression > -this.travelDown + 0.001;

    // --- Suspension spring/damper force (split bump/rebound rates) ---
    let Fz = 0;
    if (this.inContact) {
      // Digressive damper: clamp the effective shaft velocity so a single
      // hard landing step cannot inject an 80 kN spike into one corner.
      this.damperVelocity = THREE.MathUtils.clamp(
        (this.compression - prevCompression) / Math.max(dt, 1e-5), -5, 5);
      const springF = this.springK * Math.max(0, this.compression + this.tire.contactDeflection * 0.5);
      const dampRate = this.damperVelocity > 0 ? this.dampBump : this.dampRebound;
      const dampF = dampRate * this.damperVelocity;
      // Progressive bump stops near full travel.
      let bumpStop = 0;
      if (this.compression > this.travelUp * 0.8) {
        bumpStop = (this.compression - this.travelUp * 0.8) * 250000;
      }
      Fz = Math.max(0, springF + dampF + bumpStop);
      this.suspensionForce = Fz;
      this.loadN = Fz;
      body.applyForce(this._wVel.copy(basis.up).multiplyScalar(Fz), attachW);
    } else {
      this.suspensionForce = 0;
      this.loadN = 0;
      this.damperVelocity = 0;
    }

    // --- Water drag on the tire (wading zone) ---
    if (queryWater) {
      const w = queryWater(attachW.x, attachW.z);
      this.submerged = !!(w && w.depth > 0 && attachW.y - this.radius < w.surfaceY);
      if (this.submerged) {
        const vel = body.velocityAtPoint(attachW, this._wVel);
        const depthFrac = THREE.MathUtils.clamp((w.surfaceY - (attachW.y - this.radius)) / (this.radius * 2), 0, 1);
        body.applyForce(vel.multiplyScalar(-180 * depthFrac), attachW);
      }
    } else {
      this.submerged = false;
    }

    // --- Tire contact patch forces ---
    if (this.inContact && this.loadN > 1) {
      // Contact point on the ground under the wheel.
      const contact = this._wContact.set(attachW.x, g.height, attachW.z);
      // Wheel rolling basis: steered forward/right on the ground plane.
      const fwd = this._basisF.copy(basis.forward)
        .applyAxisAngle(basis.up, -this.steerAngle);
      fwd.y = 0; fwd.normalize();
      const right = this._basisR.set(fwd.z, 0, -fwd.x); // fwd x up
      const vel = body.velocityAtPoint(contact, this._wVel);
      const vLong = vel.dot(fwd);
      const vLat = vel.dot(right);

      // Slip quantities.
      const wheelSurfaceSpeed = this.angularVel * this.tire.effectiveRadius;
      this.slipRatio = Math.abs(vLong) > 0.5
        ? THREE.MathUtils.clamp((wheelSurfaceSpeed - vLong) / Math.abs(vLong), -1, 1)
        : THREE.MathUtils.clamp((wheelSurfaceSpeed - vLong) * 0.4, -1, 1);
      this.slipAngle = Math.abs(vLong) > 0.5
        ? Math.atan2(vLat, Math.abs(vLong))
        : Math.atan2(vLat * 0.15, 1);

      // Combined-slip friction ellipse on a high-friction rough material.
      const mu = this.material.friction * this.gripScale * g.grip;
      const maxForce = mu * this.loadN;
      const rho = Math.hypot(this.slipRatio * 1.0, this.slipAngle * 0.9) + 1e-6;
      // Pacejka-lite: sharp rise, saturated peak, mild load sensitivity.
      const shape = Math.min(1, rho * 9) * (1 - 0.06 * Math.min(1, rho * 2));
      const Fx = (this.slipRatio * 1.0 / rho) * shape * maxForce;
      const Fy = -(this.slipAngle * 0.9 / rho) * shape * maxForce;
      this.longForce = Fx;
      this.latForce = Fy;

      const force = new THREE.Vector3()
        .addScaledVector(fwd, Fx)
        .addScaledVector(right, Fy);
      body.applyForce(force, contact);

      // Rolling resistance (approx 1.2% of load).
      body.applyForce(fwd.clone().multiplyScalar(-Math.sign(vLong) * 0.012 * this.loadN), contact);

      // --- Soft ring update from patch penetration ---
      const patchDeflection = Math.max(0, this.radius - suspensionLen + this.compression) * 0.35
        + this.loadN / this.tire.radialK * this.tire.nodeCount;
      this.tire.applyContact(Math.min(patchDeflection, this.radius * 0.45), dt);

      // --- Wheel spin dynamics ---
      let driveT = ctrl.driveTorque || 0;
      let brakeT = (ctrl.brake || 0) * this.brakeTorqueMax;
      if (ctrl.handbrake && !this.steerable) brakeT = this.brakeTorqueMax * 1.2;
      const reactionT = Fx * this.tire.effectiveRadius;
      const angAcc = (driveT - reactionT - Math.sign(this.angularVel) * Math.min(brakeT, Math.abs(this.angularVel) * this.inertia / Math.max(dt, 1e-5) * 0.9 + 1)) / this.inertia;
      this.angularVel += angAcc * dt;
      // Ground lock at near-zero speed with brakes applied.
      if (Math.abs(vLong) < 0.3 && brakeT > 10 && Math.abs(driveT) < 1) this.angularVel *= 0.6;
    } else {
      // Airborne: free spin-down.
      this.tire.applyContact(0, dt);
      const brakeT = (ctrl.brake || 0) * this.brakeTorqueMax + (ctrl.handbrake && !this.steerable ? this.brakeTorqueMax : 0);
      this.angularVel -= Math.sign(this.angularVel) * Math.min(brakeT / this.inertia * Math.max(dt, 0), Math.abs(this.angularVel));
      this.angularVel *= (1 - 0.02 * dt);
      this.slipRatio = 0;
      this.slipAngle = 0;
      this.longForce = 0;
      this.latForce = 0;
    }
  }
}
