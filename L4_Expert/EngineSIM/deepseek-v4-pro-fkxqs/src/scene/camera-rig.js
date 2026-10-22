/**
 * Camera rig with four views and critically damped motion.
 *
 * The chase camera is a spring: it lags in acceleration and swings wide in
 * corners, which is most of what makes a driving camera feel fast. The cockpit
 * and hood views are rigid mounts, and "cinematic" is a slow orbit for replays
 * and screenshots.
 */

import * as THREE from "three";

export const CAMERA_VIEWS = ["chase", "cockpit", "hood", "cinematic"];

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {object} car geometry from `MUSCLE_CAR`
   */
  constructor(camera, car) {
    this.camera = camera;
    this.car = car;
    this.view = "chase";
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.lookVelocity = new THREE.Vector3();
    this.shake = 0;
    this.orbitAngle = 0;
    this.baseFov = camera.fov;
    this.tempA = new THREE.Vector3();
    this.tempB = new THREE.Vector3();
    this.initialised = false;
  }

  /** @param {string} view */
  setView(view) {
    if (!CAMERA_VIEWS.includes(view)) return this.view;
    this.view = view;
    this.initialised = false;
    return this.view;
  }

  /** Cycle to the next view (keyboard "C"). */
  nextView() {
    const index = CAMERA_VIEWS.indexOf(this.view);
    return this.setView(CAMERA_VIEWS[(index + 1) % CAMERA_VIEWS.length]);
  }

  /**
   * @param {object} telemetry
   * @param {number} dt
   */
  update(telemetry, dt) {
    const { position, heading, speedMps } = telemetry;
    const carPosition = this.tempA.set(position.x, 0, -position.y);
    const forward = this.tempB.set(Math.cos(heading), 0, -Math.sin(heading));
    const step = Math.min(dt, 0.1);

    let targetPosition;
    let targetLook;
    let fov = this.baseFov;

    if (this.view === "cockpit") {
      targetPosition = carPosition
        .clone()
        .add(forward.clone().multiplyScalar(0.25))
        .add(new THREE.Vector3(0, 1.16, 0))
        .add(sideVector(heading).multiplyScalar(-0.36));
      targetLook = targetPosition.clone().add(forward.clone().multiplyScalar(24)).setY(1.05);
      fov = this.baseFov + 6;
    } else if (this.view === "hood") {
      targetPosition = carPosition
        .clone()
        .add(forward.clone().multiplyScalar(1.35))
        .add(new THREE.Vector3(0, 1.05, 0));
      targetLook = targetPosition.clone().add(forward.clone().multiplyScalar(30)).setY(0.9);
      fov = this.baseFov + 4;
    } else if (this.view === "cinematic") {
      this.orbitAngle += step * 0.32;
      const radius = 12 + Math.min(speedMps * 0.18, 8);
      targetPosition = carPosition
        .clone()
        .add(new THREE.Vector3(Math.cos(this.orbitAngle) * radius, 3.4 + Math.sin(this.orbitAngle * 0.7) * 1.2, Math.sin(this.orbitAngle) * radius));
      targetLook = carPosition.clone().setY(0.9);
      fov = this.baseFov - 8;
    } else {
      // Chase: distance and height open up with speed, and the camera is pulled
      // slightly to the outside of the corner.
      const speedBlend = Math.min(speedMps / 60, 1);
      const distance = 7.2 + speedBlend * 2.6;
      const height = 2.5 + speedBlend * 0.7;
      const lateral = THREE.MathUtils.clamp(-telemetry.lateralG * 0.9, -1.6, 1.6);
      targetPosition = carPosition
        .clone()
        .add(forward.clone().multiplyScalar(-distance))
        .add(new THREE.Vector3(0, height, 0))
        .add(sideVector(heading).multiplyScalar(lateral));
      targetLook = carPosition.clone().add(forward.clone().multiplyScalar(6.5)).setY(1.1);
      fov = this.baseFov + speedBlend * 8;
    }

    if (!this.initialised) {
      this.position.copy(targetPosition);
      this.lookAt.copy(targetLook);
      this.velocity.set(0, 0, 0);
      this.lookVelocity.set(0, 0, 0);
      this.initialised = true;
    }

    const stiffness = this.view === "chase" ? 9 : 26;
    springTo(this.position, this.velocity, targetPosition, stiffness, step);
    springTo(this.lookAt, this.lookVelocity, targetLook, stiffness * 1.4, step);

    // Engine/road shake, strongest at high rpm and over kerbs.
    const rpmShake = Math.max(0, telemetry.rpm / 7000 - 0.35) * 0.02;
    const kerbShake = (telemetry.kerb ?? 0) * 0.06 + (telemetry.offTrack ? 0.035 : 0);
    this.shake += ((rpmShake + kerbShake) - this.shake) * Math.min(1, step * 8);
    const t = performance.now() * 0.001;
    const shakeOffset = new THREE.Vector3(
      Math.sin(t * 47.3) * this.shake,
      Math.sin(t * 61.7) * this.shake * 0.8,
      Math.sin(t * 53.1) * this.shake,
    );

    this.camera.position.copy(this.position).add(shakeOffset);
    this.camera.lookAt(this.lookAt);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, step * 4);
      this.camera.updateProjectionMatrix();
    }
    return this;
  }
}

function sideVector(heading) {
  // Physics "left" (+y) maps to world (-sin h, 0, -cos h).
  return new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
}

/** Critically damped spring towards a target. */
function springTo(value, velocity, target, stiffness, dt) {
  const damping = 2 * Math.sqrt(stiffness);
  const ax = (target.x - value.x) * stiffness - velocity.x * damping;
  const ay = (target.y - value.y) * stiffness - velocity.y * damping;
  const az = (target.z - value.z) * stiffness - velocity.z * damping;
  velocity.x += ax * dt;
  velocity.y += ay * dt;
  velocity.z += az * dt;
  value.x += velocity.x * dt;
  value.y += velocity.y * dt;
  value.z += velocity.z * dt;
}
