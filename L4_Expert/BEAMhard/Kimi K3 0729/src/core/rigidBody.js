// Phase 1.2 — 6-DOF rigid-body dynamics core (custom web physics solver).
// The JBeam soft-body node/beam chassis network is collapsed into a single
// RigidBody (mass, CoM, full inertia tensor from the point-mass cloud) plus a
// composite CollisionShape made of axis-aligned boxes clustered from the nodes.
// Semi-implicit Euler integration, body-frame diagonal inertia, world-space
// force/torque accumulation. Runs in browser and Node (three.js is pure ESM).

import * as THREE from '../../lib/three.module.js';

/** A single collision primitive of the composite chassis shape. */
export class CollisionBox {
  /**
   * @param {THREE.Vector3} centerLocal box center in body frame
   * @param {THREE.Vector3} halfExtents half sizes in body frame
   * @param {number} friction surface friction coefficient
   */
  constructor(centerLocal, halfExtents, friction = 0.6) {
    this.centerLocal = centerLocal;
    this.halfExtents = halfExtents;
    this.friction = friction;
  }
  /** World-space contact sample points: the box's bottom 4 corners + center. */
  getContactPoints(body, out) {
    out.length = 0;
    const he = this.halfExtents;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = new THREE.Vector3(
          this.centerLocal.x + sx * he.x,
          this.centerLocal.y - he.y,
          this.centerLocal.z + sz * he.z,
        );
        out.push(body.localToWorld(p));
      }
    }
    return out;
  }
}

export class RigidBody {
  /**
   * @param {{mass:number, inertia:THREE.Vector3, position?:THREE.Vector3,
   *          quaternion?:THREE.Quaternion, collisionBoxes?:CollisionBox[]}} spec
   */
  constructor(spec) {
    this.mass = spec.mass;
    this.invMass = 1 / spec.mass;
    // Diagonal inertia in body frame (kg·m²).
    this.inertia = spec.inertia.clone();
    this.invInertia = new THREE.Vector3(1 / spec.inertia.x, 1 / spec.inertia.y, 1 / spec.inertia.z);

    this.position = (spec.position || new THREE.Vector3()).clone();
    this.quaternion = (spec.quaternion || new THREE.Quaternion()).clone();
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3(); // world frame

    this.force = new THREE.Vector3();
    this.torque = new THREE.Vector3();

    this.collisionBoxes = spec.collisionBoxes || [];

    // Mild numerical damping (air/structural); keeps the integrator stable.
    this.linearDamping = 0.005;
    this.angularDamping = 0.05;

    this._tmpQ = new THREE.Quaternion();
    this._tmpV = new THREE.Vector3();
    this._contactScratch = [];
  }

  /** Apply a world-frame force at a world-frame point (or at CoM when point omitted). */
  applyForce(force, point) {
    this.force.add(force);
    if (point) {
      this._tmpV.copy(point).sub(this.position);
      this.torque.add(this._tmpV.cross(force));
    }
  }

  /** Apply a world-frame torque. */
  applyTorque(t) { this.torque.add(t); }

  /** World-frame velocity of a world point rigidly attached to the body. */
  velocityAtPoint(point, out = new THREE.Vector3()) {
    out.copy(point).sub(this.position);
    out.copy(this.angularVelocity).cross(out).add(this.velocity);
    return out;
  }

  /** Body-frame -> world-frame for a local point (allocating-light helper). */
  localToWorld(local, out = new THREE.Vector3()) {
    return out.copy(local).applyQuaternion(this.quaternion).add(this.position);
  }

  /** World -> body frame direction. */
  worldDirToLocal(dir, out = new THREE.Vector3()) {
    return out.copy(dir).applyQuaternion(this._tmpQ.copy(this.quaternion).invert());
  }

  /** Body-frame basis vectors in world space. */
  getBasis() {
    return {
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion),
      forward: new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion),
    };
  }

  /**
   * Advance the body by dt (semi-implicit Euler + quaternion derivative).
   * @param {number} dt seconds
   * @param {THREE.Vector3} gravity e.g. (0,-9.81,0)
   */
  integrate(dt, gravity) {
    // Linear.
    const acc = this._tmpV.copy(this.force).multiplyScalar(this.invMass);
    if (gravity) acc.add(gravity);
    this.velocity.addScaledVector(acc, dt);
    this.velocity.multiplyScalar(Math.max(0, 1 - this.linearDamping * dt));
    this.position.addScaledVector(this.velocity, dt);

    // Angular: tau = I·alpha in body frame.
    const localTorque = this.worldDirToLocal(this.torque, new THREE.Vector3());
    const localOmega = this.worldDirToLocal(this.angularVelocity, new THREE.Vector3());
    localOmega.x += localTorque.x * this.invInertia.x * dt;
    localOmega.y += localTorque.y * this.invInertia.y * dt;
    localOmega.z += localTorque.z * this.invInertia.z * dt;
    // Gyroscopic term omega x (I·omega) — keeps fast yaw/pitch honest.
    const iw = new THREE.Vector3(
      localOmega.x * this.inertia.x,
      localOmega.y * this.inertia.y,
      localOmega.z * this.inertia.z,
    );
    const gyro = new THREE.Vector3().copy(localOmega).cross(iw);
    localOmega.x -= gyro.x * this.invInertia.x * dt;
    localOmega.y -= gyro.y * this.invInertia.y * dt;
    localOmega.z -= gyro.z * this.invInertia.z * dt;
    localOmega.multiplyScalar(Math.max(0, 1 - this.angularDamping * dt));
    // Numeric safety: the explicit gyroscopic term above goes unstable for
    // very large |omega| (crash impulses). Clamp spin to a physical range.
    const spin = localOmega.length();
    if (spin > 40) localOmega.multiplyScalar(40 / spin);
    this.angularVelocity.copy(localOmega).applyQuaternion(this.quaternion);

    // Quaternion derivative: q' = 0.5 * w_quat * q.
    if (this.quaternion.lengthSq() < 1e-12) this.quaternion.set(0, 0, 0, 1); // NaN guard
    const wq = this._tmpQ.set(
      this.angularVelocity.x, this.angularVelocity.y, this.angularVelocity.z, 0,
    );
    wq.multiply(this.quaternion);
    this.quaternion.set(
      this.quaternion.x + 0.5 * wq.x * dt,
      this.quaternion.y + 0.5 * wq.y * dt,
      this.quaternion.z + 0.5 * wq.z * dt,
      this.quaternion.w + 0.5 * wq.w * dt,
    ).normalize();

    // Clear accumulators for the next step.
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }

  /**
   * Resolve chassis-vs-ground contact for every composite collision box.
   * Impulse-based: normal spring-damper + Coulomb friction clamp, applied at
   * the penetrating corner points. Returns the number of active contacts.
   * @param {(x:number,z:number)=>{height:number,nx:number,ny:number,nz:number,grip:number}} queryGround
   */
  resolveGroundContacts(queryGround) {
    let contacts = 0;
    const up = new THREE.Vector3();
    for (const box of this.collisionBoxes) {
      const pts = box.getContactPoints(this, this._contactScratch);
      for (const p of pts) {
        const g = queryGround(p.x, p.z);
        const penetration = g.height - p.y;
        if (penetration <= 0) continue;
        contacts++;
        up.set(g.nx, g.ny, g.nz);
        const vel = this.velocityAtPoint(p, new THREE.Vector3());
        const vn = vel.dot(up);
        // Normal impulse: stiff contact spring with damping.
        const normalForceMag = Math.max(0, penetration * 120000 - vn * 9000);
        const normalForce = up.clone().multiplyScalar(Math.min(normalForceMag, this.mass * 40));
        this.applyForce(normalForce, p);
        // Friction: tangential velocity kill, clamped by mu * normal.
        const tangent = vel.clone().addScaledVector(up, -vn);
        const speedT = tangent.length();
        if (speedT > 1e-4) {
          const maxF = box.friction * g.grip * normalForce.length();
          const fr = tangent.normalize().multiplyScalar(-Math.min(speedT * this.mass * 2, maxF));
          this.applyForce(fr, p);
        }
      }
    }
    return contacts;
  }
}
