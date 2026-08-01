/**
 * Renderer, lighting and cameras.
 *
 * Lighting is one directional light plus a hemisphere fill, with the shadow
 * camera dragged along behind the car. That last part matters: a shadow map
 * sized to the whole 1.6 km circuit would give the car a shadow a few pixels
 * across, so instead a 60 m box follows it and every one of those 2048 pixels
 * lands where the player is looking.
 *
 * No post-processing. ACES tone mapping in the main pass gets most of the
 * visual benefit of a bloom chain for none of the fill-rate.
 */

import * as THREE from 'three';
import { Sky, SKY_PRESETS } from './sky.js';

export const CAMERA_MODES = ['chase', 'hood', 'cockpit', 'wheel', 'orbit'];

export class Renderer {
  constructor(canvas, opts = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: opts.antialias !== false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio ?? 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    // A tight near/far ratio is what keeps the near-coplanar track layers from
    // z-fighting. Fog hides everything past 2.1 km, so 5 km of far plane is
    // already more than is ever visible.
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 5000);

    // --- sky ------------------------------------------------------------
    this.sky = new Sky(4200);
    this.scene.add(this.sky.mesh);

    // --- lights ----------------------------------------------------------
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(opts.shadowMapSize ?? 2048, opts.shadowMapSize ?? 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    const half = 34;
    const cam = this.sun.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 260;
    this.shadowHalf = half;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd2ea, 0x4a4438, 0.55);
    this.scene.add(this.hemi);

    this.applySkyPreset(SKY_PRESETS[opts.skyPreset || 'midday']);

    this.resize();
  }

  /**
   * Prefilter the procedural sky into an environment map.
   *
   * Without this, every metallic or low-roughness material in the scene has
   * nothing to reflect and renders black -- car paint, chrome exhaust tips,
   * wheel rims and the Armco all turn into silhouettes. One PMREM pass at
   * startup (and on each sky change) fixes all of them at zero per-frame cost.
   *
   * The dome used here is deliberately tiny: the sky shader depends only on
   * view direction, so radius is irrelevant, and a small sphere keeps the
   * generator's near/far planes uncontroversial.
   */
  buildEnvironment() {
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    if (!this.envScene) {
      this.envScene = new THREE.Scene();
      this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(5, 32, 20), this.sky.material));
    }
    const previous = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 50);
    this.scene.environment = this.envRT.texture;
    if (previous) previous.dispose();
  }

  applySkyPreset(preset) {
    const dir = this.sky.applyPreset(preset);
    this.sunDir = dir.clone();
    this.sun.intensity = preset.intensity;
    this.sun.color.setHex(preset.sunColor);
    // The environment map now supplies most of the ambient term, so the
    // hemisphere light is pulled back to a fill rather than double-counting it.
    this.hemi.intensity = preset.ambient * 0.4;
    this.hemi.color.copy(this.sky.horizonColor());
    this.buildEnvironment();

    // Fog matched to the sky's horizon, so distant scenery dissolves into the
    // actual colour of the sky rather than into a guess at it.
    const fogColor = this.sky.horizonColor();
    this.scene.fog = new THREE.Fog(fogColor, 380, 2100);
    this.skyPreset = preset;
  }

  /** Keep the shadow volume centred on a point of interest. */
  updateShadow(target) {
    const d = 120;
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(this.sunDir, d);
    this.sun.target.updateMatrixWorld();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.sky.follow(this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  get info() {
    return this.renderer.info;
  }

  dispose() {
    this.sky.dispose();
    if (this.envRT) this.envRT.dispose();
    if (this.pmrem) this.pmrem.dispose();
    this.renderer.dispose();
  }
}

/**
 * Camera rig.
 *
 * The chase camera is a critically-damped spring toward a point behind the
 * car, but it follows the car's *velocity* direction rather than its heading.
 * Anchoring to heading makes the camera whip round during a slide and hides
 * exactly the thing the driver needs to see; anchoring to velocity keeps the
 * car visibly sideways in frame, which is what makes a drift catchable.
 *
 * The chase feel is further enhanced the way the "Enhanced Driver" camera
 * mod does it: the camera leans into the corner before the car rotates
 * (steering look-ahead), reacts to smoothed longitudinal/lateral g-forces
 * (pitch / yaw / roll), widens the FOV with speed, and vibrates with smooth
 * value noise instead of white static.
 */

/**
 * Cheap 1D value noise (smooth, deterministic-ish) used for camera
 * vibration. Layered octaves make it read as road buzz rather than jitter.
 */
class VibrationNoise {
  constructor(seed = 7) {
    this.seed = seed;
  }

  hash(i) {
    const s = Math.sin(i * 12.9898 + this.seed * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  value(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return this.hash(i) * (1 - u) + this.hash(i + 1) * u;
  }

  fbm(x, octaves = 3) {
    let v = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      v += amp * this.value(x * freq + o * 7.31);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return v / norm;
  }
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.pos = new THREE.Vector3(0, 3, -8);
    this.look = new THREE.Vector3();
    this.orbitAngle = 0;
    this.shake = 0;
    this._tmp = new THREE.Vector3();
    this._fov = 62;
    // Enhanced-chase state (see class comment above).
    this.steerLook = 0; // smoothed steering input, -1..1, left positive
    this.gLong = 0; // smoothed longitudinal acceleration, +forward m/s^2
    this.gLat = 0; // smoothed lateral acceleration, +left m/s^2
    this.noiseT = (Math.random() * 1000) | 0;
    this.noise = new VibrationNoise(((Math.random() * 999) | 0) + 1);
  }

  setMode(mode) {
    if (CAMERA_MODES.includes(mode)) {
      this.mode = mode;
      // Snap, rather than letting the spring sweep across the world.
      this.snap = true;
      // Snap the enhanced-chase state too, so a mode switch never swings.
      this.steerLook = 0;
      this.gLong = 0;
      this.gLat = 0;
      this.shake = 0;
    }
  }

  cycle(dir = 1) {
    const i = CAMERA_MODES.indexOf(this.mode);
    this.setMode(CAMERA_MODES[(i + dir + CAMERA_MODES.length) % CAMERA_MODES.length]);
  }

  /** True when the listener should hear the car from inside. */
  get isInterior() {
    return this.mode === 'cockpit' || this.mode === 'hood';
  }

  /**
   * @param {object} t   vehicle telemetry
   * @param {number} dt
   * @param {number} steerInput  normalized steering input (-1..1, left+)
   */
  update(t, dt, steerInput = 0) {
    // Wrap the accumulated heading into (-pi, pi] before any angle math.
    // The vehicle integrates yaw continuously (it can exceed a full turn),
    // while atan2() returns a wrapped angle. Mixing the two made camYaw
    // jump ~126 deg the moment the heading crossed +-180 deg -- once per
    // lap on a closed circuit -- and threw the chase camera to the side of
    // the car at that spot. sin/cos are unaffected by the wrap.
    const yaw = Math.atan2(Math.sin(t.yaw), Math.cos(t.yaw));
    const fwd = this._tmp.set(Math.sin(yaw), 0, Math.cos(yaw));
    const carPos = new THREE.Vector3(t.x, 0, t.z);
    const speed = t.speed;
    // Frame-rate-independent smoothing; clamp so pauses cannot pop the camera.
    const dtc = Math.min(dt, 0.05);

    let target;
    let lookAt;
    let fov = 62;
    let stiffness = 6.5;
    let rollAngle = 0;
    let pitchAngle = 0;

    if (this.mode === 'chase') {
      // Blend between heading and velocity direction: at low speed there is no
      // meaningful velocity vector, at high speed it is the honest one.
      // Velocity direction is expressed *relative to the wrapped heading*
      // via the body-slip angle, so it can never wrap against the
      // accumulated yaw. The old code scaled the heading by speed and fed
      // that to atan2 -- a no-op that left the bodySlip term below to swing
      // the camera around the car during a slide.
      const velAngle = yaw + t.bodySlip;
      const blend = Math.min(1, speed / 12);

      // Steering look-ahead: rotate the camera toward the input before the
      // car actually responds, so corners are anticipated, not chased.
      const steerTarget = Math.max(-1, Math.min(1, steerInput));
      this.steerLook += (steerTarget - this.steerLook) * (1 - Math.exp(-dtc * 5));
      const steerLookAhead = this.steerLook * 0.1 * Math.min(1, speed / 20);

      // G-force response, smoothed and dead-zoned (Enhanced-Driver style).
      this.gLong += (t.ax - this.gLong) * (1 - Math.exp(-dtc * 5));
      this.gLat += (t.ay - this.gLat) * (1 - Math.exp(-dtc * 5));
      const speedFactor = Math.min(1, Math.max(0, (speed - 3) / 12));
      const dead = (v, z) => (Math.abs(v) < z ? 0 : v - Math.sign(v) * z);
      const gLat = dead(this.gLat, 0.35) * speedFactor;
      const gLong = dead(this.gLong, 0.45) * speedFactor;
      const latYaw = gLat * 0.0042; // look into the corner
      const latRoll = gLat * 0.0032; // lean with the driver's head
      const gPitch = gLong * 0.0022; // nose rises on accel, dives on brake

      const camYaw =
        yaw * (1 - blend * 0.35) +
        velAngle * blend * 0.35 -
        t.bodySlip * 0.45 * blend +
        latYaw +
        steerLookAhead;
      const back = 7.4 + Math.min(3.2, speed * 0.07);
      const height = 2.75 + Math.min(0.9, speed * 0.012);
      target = new THREE.Vector3(
        t.x - Math.sin(camYaw) * back,
        height,
        t.z - Math.cos(camYaw) * back
      );
      // Look further ahead with speed so the next corner is readable.
      lookAt = carPos
        .clone()
        .addScaledVector(fwd, 6.5 + Math.min(4.5, speed * 0.09))
        .setY(1.08 + Math.min(0.3, speed * 0.005));
      fov = 62 + Math.min(16, speed * 0.3);
      stiffness = 7.5;
      rollAngle = latRoll;
      pitchAngle = gPitch;
    } else if (this.mode === 'hood') {
      // On the hood, not inside the greenhouse. At z = 0.55 the roofline is
      // still 1.4 m up, so a camera at 1.16 m there is looking at the inside
      // of the windscreen.
      target = carPos.clone().addScaledVector(fwd, 1.72).setY(1.06);
      lookAt = carPos.clone().addScaledVector(fwd, 26).setY(0.95);
      fov = 68;
      stiffness = 26;
    } else if (this.mode === 'cockpit') {
      // Driver's eye. The car hides its shell in this mode (see
      // Car#setInteriorView) because a lofted hull has no cabin to sit in.
      const left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      target = carPos
        .clone()
        .addScaledVector(fwd, -0.06)
        .addScaledVector(left, 0.36)
        .setY(1.12);
      lookAt = carPos.clone().addScaledVector(fwd, 24).addScaledVector(left, 0.30).setY(0.98);
      fov = 74;
      stiffness = 30;
    } else if (this.mode === 'wheel') {
      const left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      target = carPos.clone().addScaledVector(fwd, 1.3).addScaledVector(left, 1.5).setY(0.5);
      lookAt = carPos.clone().addScaledVector(fwd, -0.6).addScaledVector(left, 0.6).setY(0.45);
      fov = 66;
      stiffness = 22;
    } else {
      // Orbit: slow drift around the car, for looking at it.
      this.orbitAngle += dt * 0.28;
      const r = 9.5;
      target = new THREE.Vector3(
        t.x + Math.sin(this.orbitAngle) * r,
        3.1,
        t.z + Math.cos(this.orbitAngle) * r
      );
      lookAt = carPos.clone().setY(0.85);
      fov = 55;
      stiffness = 4;
    }

    // Decay chase-only state while another camera is active, so switching
    // back never resumes a stale swing.
    if (this.mode !== 'chase') {
      this.steerLook += (0 - this.steerLook) * Math.min(1, dtc * 4);
      this.gLong *= Math.exp(-dtc * 3);
      this.gLat *= Math.exp(-dtc * 3);
    }

    if (this.snap) {
      this.pos.copy(target);
      this.look.copy(lookAt);
      this.snap = false;
    } else {
      const k = 1 - Math.exp(-dt * stiffness);
      this.pos.lerp(target, k);
      this.look.lerp(lookAt, 1 - Math.exp(-dt * stiffness * 1.5));
    }

    // Camera vibration: wheelspin/kerb shake (existing), plus speed shake
    // and drift shake, all driven by smooth value noise instead of white
    // static. Scaled by speed so it never rattles at a standstill.
    const slipShake = Math.min(1, Math.max(0, t.slipR - 0.6) * 0.35) * Math.min(1, speed / 8);
    const driftShake =
      Math.min(1, Math.max(0, Math.abs(t.bodySlip) - 0.1) * 2.4) * Math.min(1, speed / 9);
    const speedShake = Math.min(1, Math.max(0, speed - 10) / 16);
    const shakeTarget = Math.min(1, slipShake * 0.5 + driftShake * 0.32 + speedShake * 0.18);
    this.shake += (shakeTarget - this.shake) * (1 - Math.exp(-dtc * 6));
    this.noiseT += dtc * (5 + speed * 0.25);
    const s = this.shake * 0.05;

    this.camera.position.copy(this.pos);
    if (s > 0.0003) {
      const n = this.noise;
      const nx = n.fbm(this.noiseT, 3) * 2 - 1;
      const ny = n.fbm(this.noiseT * 1.37 + 19.1, 3) * 2 - 1;
      const nz = n.fbm(this.noiseT * 1.61 + 43.7, 3) * 2 - 1;
      this.camera.position.x += nx * s;
      this.camera.position.y += ny * s * 0.7;
      this.camera.position.z += nz * s;
    }
    this.camera.lookAt(this.look);
    // Enhanced-Driver-style attitude: pitch first, then roll around the
    // view axis so the two never couple into a drunken sway.
    if (Math.abs(pitchAngle) > 0.0001) this.camera.rotateX(pitchAngle);
    if (Math.abs(rollAngle) > 0.0001) this.camera.rotateZ(rollAngle);

    this._fov += (fov - this._fov) * Math.min(1, dtc * 3);
    if (Math.abs(this.camera.fov - this._fov) > 0.01) {
      this.camera.fov = this._fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
