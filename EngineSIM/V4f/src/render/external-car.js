/**
 * Downloaded low-poly muscle car, integrated into the same chassis rig as
 * the procedural body.
 *
 * The asset is Quaternius "Realistic Car Pack - Nov 2018" (CC0),
 * SportsCar2.obj/SportsCar2.mtl. The OBJ stores every vertex in one global
 * list, so each mesh's geometry is centred on the model origin rather than
 * on its own wheel centre. This module therefore:
 *
 *   - scales the whole assembly so the model's wheelbase/track/wheel radius
 *     land exactly on the physics constants (MUSCLE_CAR);
 *   - reparents the front wheel meshes into steer+spin pivots and the two
 *     rear wheels (one combined mesh) into a single axle spin group;
 *   - upgrades the MTL's MeshPhongMaterials to MeshStandardMaterial so the
 *     car responds to the scene's environment map, and wires the tail light
 *     material to the brake pedal.
 *
 * Measured from the OBJ: wheelbase 2.507 m, front track 1.452 m, rear track
 * 1.58 m, wheel radius 0.2805 m, body centre (0, 0.67, -0.065), front axle
 * z = 1.186, rear axle z = -1.321, front +Z (headlights at +z).
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { buildInterior, updateCarRig, CAR_COLORS } from './car.js';

const MODEL = {
  base: 'assets/models/quaternius-cars/',
  obj: 'SportsCar2.obj',
  mtl: 'SportsCar2.mtl',
  body: 'SportsCar2_Cube.006',
  fl: 'SportsCar2_FrontLeftWheel_Cylinder.017',
  fr: 'SportsCar2_FrontRightWheel_Cylinder.018',
  rear: 'SportsCar2_BackWheels_Cylinder.002',
  flCentre: new THREE.Vector3(0.726, 0.265, 1.186),
  frCentre: new THREE.Vector3(-0.726, 0.265, 1.186),
  rearCentre: new THREE.Vector3(0, 0.265, -1.321),
  wheelRadius: 0.2805,
};

/** Turn the MTL's flat Phong materials into environment-aware standards. */
function upgradeMaterials(materials, bodyColor) {
  const out = new Map();
  for (const [name, src] of Object.entries(materials)) {
    if (!src || !src.isMaterial) continue;
    const isPaint = name === 'White' || name === 'Grey';
    const colour = isPaint
      ? new THREE.Color(bodyColor).multiplyScalar(name === 'Grey' ? 0.66 : 1)
      : (src.color ? src.color.clone() : new THREE.Color(0xcccccc));
    const mat = new THREE.MeshStandardMaterial({
      name,
      color: colour,
      roughness: name === 'Windows' ? 0.06 : isPaint ? 0.34 : 0.55,
      metalness: name === 'Windows' ? 0 : isPaint ? 0.12 : 0.18,
      envMapIntensity: name === 'Windows' ? 1.6 : 1.1,
      transparent: name === 'Windows',
      opacity: name === 'Windows' ? 0.62 : 1,
      flatShading: false,
    });
    if (name === 'Headlights') {
      mat.emissive = new THREE.Color(0xfff2c8);
      mat.emissiveIntensity = 0.3;
    }
    if (name === 'TailLights') {
      mat.emissive = new THREE.Color(0xd8140c);
      mat.emissiveIntensity = 0.18;
    }
    out.set(name, mat);
  }
  return out;
}

export class ExternalCar {
  /**
   * @param {THREE.Group} root  OBJLoader result
   * @param {object} opts wheelRadius/wheelbase/trackWidth/color
   */
  constructor(root, opts = {}) {
    const wheelbase = opts.wheelbase ?? 2.946;
    const trackWidth = opts.trackWidth ?? 1.62;
    const wheelRadius = opts.wheelRadius ?? 0.352;
    const bodyColor = opts.color ?? CAR_COLORS.torred;

    const a = wheelbase * 0.48; // front axle
    const b = wheelbase * 0.52; // rear axle
    const sx = trackWidth / (2 * MODEL.flCentre.x);
    const sz = wheelbase / (MODEL.flCentre.z - MODEL.rearCentre.z);
    const sy = wheelRadius / MODEL.wheelRadius;
    // The model's scaled axle positions land 2 cm short of the physics
    // axles; shift the whole assembly forward so arches and wheels agree.
    const shiftZ = a - MODEL.flCentre.z * sz;
    const wheelY = MODEL.rearCentre.y * sy;
    const scale = new THREE.Vector3(sx, sy, sz);

    this.group = new THREE.Group();
    this.group.name = 'car-external';
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.shell = [];

    // --- materials -------------------------------------------------------
    this.mats = { tail: null };
    const mats = upgradeMaterials(
      (root.userData && root.userData.materials) || {},
      bodyColor
    );
    // Do this before any mesh is reparented out of `root`: OBJLoader meshes
    // use multi-material arrays, and traverse() only visits live children.
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const upgraded = list.map((m) => {
        if (!m || !m.name) return m;
        const nm = mats.get(m.name);
        if (nm && m.name === 'TailLights') this.mats.tail = nm;
        return nm || m;
      });
      o.material = upgraded;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    // Tail light should always exist; fall back to a plain red if the asset
    // changed.
    if (!this.mats.tail) {
      this.mats.tail = new THREE.MeshStandardMaterial({
        color: 0x550d08,
        emissive: 0xd8140c,
        emissiveIntensity: 0.18,
      });
    }

    // --- body ------------------------------------------------------------
    const body = root.getObjectByName(MODEL.body);
    if (!body || !body.isMesh) throw new Error('external car: body mesh missing');
    body.scale.copy(scale);
    body.position.set(0, 0, shiftZ);
    this.body.add(body);
    this.shell.push(body);

    // --- wheels -----------------------------------------------------------
    // Geometry is global, so each wheel mesh is re-centred inside its pivot
    // by subtracting the scaled wheel centre. Pivots sit exactly on the
    // physics axle positions, so steering and suspension compose like the
    // procedural car.
    this.wheels = [];
    const halfTrack = trackWidth / 2;
    const addWheel = (name, centre, pivotPos, isFront, side) => {
      const mesh = root.getObjectByName(name);
      if (!mesh || !mesh.isMesh) throw new Error(`external car: ${name} missing`);
      mesh.scale.copy(scale);
      mesh.position
        .copy(centre)
        .multiply(scale)
        .negate();
      const pivot = new THREE.Group();
      pivot.position.copy(pivotPos);
      const spin = new THREE.Group();
      pivot.add(spin);
      spin.add(mesh);
      this.group.add(pivot);
      this.wheels.push({ name, pivot, spin, isFront, side, restY: wheelY });
    };

    addWheel(
      MODEL.fl,
      MODEL.flCentre,
      new THREE.Vector3(halfTrack, wheelY, a),
      true,
      1
    );
    addWheel(
      MODEL.fr,
      MODEL.frCentre,
      new THREE.Vector3(-halfTrack, wheelY, a),
      true,
      -1
    );
    // Rear wheels share one mesh; one axle spin group turns them together
    // (they run at the same omegaR anyway).
    addWheel(
      MODEL.rear,
      MODEL.rearCentre,
      new THREE.Vector3(0, wheelY, -b),
      false,
      1
    );
    // The rear axle is one combined mesh in the OBJ, so a single wheel
    // record drives it. It cannot roll left/right independently, which is
    // fine -- the physics reports one omegaR for the whole axle.
    this.wheels[2].name = 'R';

    // --- interior ----------------------------------------------------------
    const built = buildInterior();
    this.interior = built.group;
    this.steeringWheel = built.steeringWheel;
    this.body.add(this.interior);

    // --- state --------------------------------------------------------------
    this.bodyRestY = 0;
    this._roll = 0;
    this._pitch = 0;
    this._heave = 0;
    this._steerVis = 0;
    this._wheelAngle = 0;
  }

  /** Swap between the exterior shell and the cockpit interior. */
  setInteriorView(on) {
    for (const m of this.shell) m.visible = !on;
    this.interior.visible = on;
  }

  update(t, dt, brake = 0) {
    updateCarRig(this, t, dt, brake);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m && m.dispose) m.dispose();
    });
  }
}

/**
 * Fetch the OBJ + MTL from the static server and build the car.
 * Rejects if either asset is missing so callers can fall back to the
 * procedural body.
 */
export async function loadExternalCar(opts = {}) {
  const mtl = new MTLLoader();
  mtl.setPath(MODEL.base);
  const materials = await mtl.loadAsync(MODEL.mtl);
  // r185 parse() only stores materialsInfo; material instances are created
  // lazily. Preload them so the upgrade pass below can remap every surface.
  materials.preload();
  const loader = new OBJLoader();
  loader.setMaterials(materials);
  loader.setPath(MODEL.base);
  const root = await loader.loadAsync(MODEL.obj);
  // Remember the material table for the upgrade pass.
  root.userData.materials = materials.materials || {};
  return new ExternalCar(root, opts);
}
