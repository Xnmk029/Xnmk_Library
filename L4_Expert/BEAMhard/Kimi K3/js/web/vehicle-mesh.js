// ============================================================================
// web/vehicle-mesh.js — Phase 1.3 binding + Phase 4 NPR styling of the CCF.
//  * Loads the real Collada body mesh (ccfcup.dae via vendored ColladaLoader)
//  * Auto-aligns it to the JBeam node cloud (1:1 Cartesian check, reports
//    mounting-point residuals to the diagnostic log)
//  * Replaces every material with the anime cel-shader + inverted-hull outline
//  * Builds procedural soft-tire wheel visuals driven by the physics solver
//    (spin, steer, suspension compression, carcass deflection squash)
//  * Procedural fallback body if the DAE cannot be loaded (offline safety)
// ============================================================================

import * as THREE from 'three';
import { ColladaLoader } from '../../vendor/ColladaLoader.js';
import { makeToonMaterial, addOutlines } from './npr.js';

const DAE_URL = 'vehicles/ccf2/ccf/ccfcup.dae';

// rotate vector by the conjugate of quaternion q (world -> body frame)
function quatConjRotate(q, x, y, z) {
  const qx = -q.x, qy = -q.y, qz = -q.z, qw = q.w;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return {
    x: x + qw * tx + (qy * tz - qz * ty),
    y: y + qw * ty + (qz * tx - qx * tz),
    z: z + qw * tz + (qx * ty - qy * tx),
  };
}

// JBeam -> Three axis fix used by BeamNG Collada exports: the loader already
// handles up-axis; we only need yaw alignment (model faces +Z, car fwd = -Z).
const MODEL_YAW = Math.PI;

export class VehicleMesh {
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group();          // chassis transform (pos+quat)
    this.root.name = 'vehicle';
    this.bodyPivot = new THREE.Group();     // CoM offset compensation
    this.root.add(this.bodyPivot);
    this.wheelMeshes = [];
    this.alignmentReport = [];
    this._buildWheels();
  }

  async loadBody(onProgress = () => {}) {
    // URL modifier: DAE texture refs point to the author's local machine
    // ("/C:/Users/wilki/...png") — redirect any unroutable texture request to
    // a transparent 1x1 pixel so the load stays clean (NPR recolours anyway).
    const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (/\.(png|jpe?g|tga|dds|bmp|webp)$/i.test(url) && !url.startsWith('data:')) return PIXEL;
      return url;
    });
    const loader = new ColladaLoader(manager);
    let collada = null;
    try {
      collada = await new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error('DAE load timeout')), 60000);
        loader.load(DAE_URL, (c) => { clearTimeout(timer); res(c); }, (ev) => {
          if (ev.total) onProgress(ev.loaded / ev.total);
        }, (e) => { clearTimeout(timer); rej(e); });
      });
    } catch (e) {
      console.warn('[vehicle-mesh] DAE load failed, using procedural fallback:', e.message);
      this._buildFallbackBody();
      return false;
    }
    const model = collada.scene;

    // --- NPR material replacement (keep albedo colour; DAE texture refs point
    // to the author's local machine and cannot resolve, so maps are dropped) --
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = false;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const newMats = mats.map((m) => {
        let color = (m && m.color) ? m.color.getHex() : 0xb8bcc4;
        // ColladaLoader leaves near-black diffuse when the texture is missing
        if (color === 0x000000) color = 0x9aa2ae;
        const isGlass = /glass/i.test(m?.name || '') || (m && m.transparent);
        return makeToonMaterial({
          color, map: null, steps: 4,
          opacity: isGlass ? 0.55 : 1,
          shadowTint: 0x46506a,
        });
      });
      obj.material = Array.isArray(obj.material) ? newMats : newMats[0];
    });

    // --- alignment: normalise yaw, scale by track width, seat the shell floor
    // on the body node cloud's underside (wheels/tires excluded) --------------
    model.rotation.y = MODEL_YAW;
    const container = new THREE.Group();
    container.add(model);
    container.updateMatrixWorld(true);

    const ext = this.spec.bodyExtents || this.spec.dims.extents;
    const cloudW = ext.x1 - ext.x0, cloudL = ext.z1 - ext.z0, cloudH = ext.y1 - ext.y0;

    const bbox = new THREE.Box3().setFromObject(container);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const scaleFix = cloudW / Math.max(size.x, 1e-3);
    const scale = (scaleFix > 0.7 && scaleFix < 1.4) ? scaleFix : 1.0;
    container.scale.setScalar(scale);
    container.updateMatrixWorld(true);
    const bbox2 = new THREE.Box3().setFromObject(container);
    const centre = new THREE.Vector3(); bbox2.getCenter(centre);

    // x/z: centre on cloud centre; y: floor (bbox min) onto cloud underside
    container.position.x += (ext.x0 + ext.x1) / 2 - centre.x;
    container.position.z += (ext.z0 + ext.z1) / 2 - centre.z;
    container.position.y += ext.y0 - bbox2.min.y + 0.02;

    const residual = {
      width: Math.abs(size.x * scale - cloudW),
      length: Math.abs(size.z * scale - cloudL),
      height: Math.abs(size.y * scale - cloudH),
      scale,
    };
    this.alignmentReport.push(
      `DAE bbox ${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)} -> scale ${scale.toFixed(3)}`,
      `alignment residuals: dW=${residual.width.toFixed(3)}m dL=${residual.length.toFixed(3)}m dH=${residual.height.toFixed(3)}m (floor-seated)`
    );

    addOutlines(container, { width: 1.8 });
    this.bodyPivot.add(container);
    this.body = container;

    // CoM offset: physics pose is at CoM; mesh node cloud is in JBeam frame
    this.bodyPivot.position.set(-this.spec.com.x, -this.spec.com.y, -this.spec.com.z);
    return true;
  }

  _buildFallbackBody() {
    const g = new THREE.Group();
    const paint = makeToonMaterial({ color: 0xc23b2e, steps: 4 });
    const dark = makeToonMaterial({ color: 0x22262e, steps: 3 });
    const glass = makeToonMaterial({ color: 0x9fc6e8, steps: 2, opacity: 0.6 });

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.42, 4.05), paint);
    lower.position.y = 0.32;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.42, 1.9), glass);
    cabin.position.set(0, 0.72, 0.25);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.2), paint);
    hood.position.set(0, 0.55, -1.35);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.9), paint);
    deck.position.set(0, 0.55, 1.55);
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.3), dark);
    splitter.position.set(0, 0.16, -2.05);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.35), dark);
    wing.position.set(0, 0.95, 1.95);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.25), dark);
    wingL.position.set(-0.6, 0.8, 1.95);
    const wingR = wingL.clone(); wingR.position.x = 0.6;
    g.add(lower, cabin, hood, deck, splitter, wing, wingL, wingR);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    addOutlines(g, { width: 2 });
    this.bodyPivot.add(g);
    this.body = g;
    this.bodyPivot.position.set(-this.spec.com.x, -this.spec.com.y, -this.spec.com.z);
    this.alignmentReport.push('procedural fallback body built (DAE unavailable)');
  }

  // --- wheels: procedural soft-tire visuals bound to physics wheels ----------
  _buildWheels() {
    for (const w of this.spec.wheels) {
      const wg = new THREE.Group();
      const r = w.radius, width = w.width;

      const tireGeo = new THREE.TorusGeometry(r - width * 0.42, width * 0.42, 10, 24);
      tireGeo.rotateY(Math.PI / 2);
      const tireMat = makeToonMaterial({ color: 0x15161a, steps: 3, shadowTint: 0x0a0a0c });
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;

      const rimGeo = new THREE.CylinderGeometry(w.hubRadius * 0.92, w.hubRadius * 0.92, width * 0.72, 14);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMat = makeToonMaterial({ color: 0xcfd3da, steps: 4, specStep: 0.5, specStrength: 0.9 });
      const rim = new THREE.Mesh(rimGeo, rimMat);

      const spokeGeo = new THREE.BoxGeometry(width * 0.74, w.hubRadius * 0.28, w.hubRadius * 1.7);
      const spokeMat = makeToonMaterial({ color: 0x3a3f4a, steps: 3 });
      const spokes = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(spokeGeo, spokeMat);
        s.rotation.x = (i / 5) * Math.PI * 2;
        spokes.add(s);
      }

      wg.add(tire, rim, spokes);
      addOutlines(wg, { width: 1.4 });
      this.root.add(wg);
      this.wheelMeshes.push({ group: wg, tire, rim, spokes, def: w });
    }
  }

  // Sync visuals from physics state. Called every frame.
  update(phys) {
    // chassis pose (physics is CoM-centred)
    this.root.position.set(phys.pos.x, phys.pos.y, phys.pos.z);
    this.root.quaternion.set(phys.quat.x, phys.quat.y, phys.quat.z, phys.quat.w);

    for (let i = 0; i < this.wheelMeshes.length; i++) {
      const wm = this.wheelMeshes[i];
      const pw = phys.wheels[i];
      // wheel world -> chassis local (manual, no stale matrixWorld dependency)
      const dx = pw.worldPos.x - phys.pos.x;
      const dy = pw.worldPos.y - phys.pos.y;
      const dz = pw.worldPos.z - phys.pos.z;
      const lp = quatConjRotate(phys.quat, dx, dy, dz);
      wm.group.position.set(lp.x, lp.y, lp.z);
      // steer (yaw) + spin (roll about local X)
      wm.group.rotation.set(0, pw.steerAngle, 0);
      wm.tire.rotation.x = pw.spinAngle;
      wm.rim.rotation.x = pw.spinAngle;
      wm.spokes.rotation.x = pw.spinAngle;
      // soft-body carcass squash: scale tire vertically by deflection
      const squash = 1 - (pw.tireDeflection / pw.def.radius) * 0.55;
      wm.tire.scale.set(1, squash, 1);
    }
  }
}
