/**
 * binder.js — Task 1.3: bind COLLADA flexbody meshes onto the converted
 * physics rig with zero-offset mounting and true steering pivots.
 *
 *   · loads the needed .dae files (body + selected wheels/tires) through the
 *     VFS, swaps ColladaLoader's materials for NPR toon materials
 *   · every flexbody row is classified: SPIN (rims/tires/discs, re-origined
 *     to the wheel centre and oriented on the real axle axis), CARRIER
 *     (knuckles/calipers — steered about the jbeam kingpin axis but not
 *     spinning), or CHASSIS
 *   · soft-tire meshes get the deformation uniforms (squash/contact/spin)
 *     driven 1:1 by the physics carcass deflection
 *   · builds the node-beam X-ray overlay (N key) straight from the rig arrays
 */
import * as THREE from 'three';
import { addOutline } from '../gfx/npr.js';

const SPIN_RE = /tire|wheel_|_wheel|rim|disc|brakeglow/i;
const CARRIER_RE = /knuckle|caliper|brakeprotector|hub_/i;
const NO_OUTLINE_RE = /glass|int_|_int|interior|gauge|dash|seat|carpet|column|screen|mirror_glass|needle/i;

export class VehicleBinder {
  constructor(vfs, matlib, rig, log = () => {}) {
    this.vfs = vfs;
    this.matlib = matlib;
    this.rig = rig;
    this.log = log;
    this.meshIndex = new Map();     // mesh name (lower) -> source Object3D
    this.root = new THREE.Group();  // chassis frame (origin = COM)
    this.root.name = 'vehicle';
    this.wheelGroups = [];          // per wheel: {carrier, spin, tireMats[]}
    this.stats = { attached: 0, missing: [], spin: 0, carrier: 0, chassis: 0 };
  }

  /** Which DAE files do the chosen parts need? */
  daeShortlist() {
    const names = this.rig.parts.map(p => p.name.toLowerCase()).join(' ');
    const daes = new Set(['vehicles/ccf/ccfremodel.dae']);
    const all = this.vfs.listByExt('.dae');
    const want = [];
    if (/_lj_/.test(names)) want.push(/wheels_lj/i);
    if (/_thw_|_thw$|\d+x\d+_thw/.test(names)) want.push(/wheel_1_thw|wheels_thw/i);
    if (/_fsw_/.test(names)) want.push(/wheels_fsw|ccfcup/i);
    want.push(/common\/tires\/ccftires/i);
    if (/offroad/i.test(names)) want.push(/tires\/country/i);
    for (const p of all) {
      for (const re of want) if (re.test(p)) daes.add(p);
    }
    return [...daes];
  }

  async loadMeshes(ColladaLoaderClass, onProgress = () => {}) {
    // DAE files embed the mod author's local texture paths (D:/User/…) —
    // ColladaLoader would try to fetch them. Redirect every image request to
    // a 1×1 data URI; real textures come from materials.json via MaterialLibrary.
    const manager = new THREE.LoadingManager();
    const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
    manager.setURLModifier((url) => /\.(png|jpg|jpeg|dds|tga)(\?|$)/i.test(url) ? PIXEL : url);
    const loader = new ColladaLoaderClass(manager);
    const files = this.daeShortlist();
    let done = 0;
    for (const path of files) {
      try {
        const text = await this.vfs.text(path);
        const t0 = performance.now();
        const collada = loader.parse(text, path.slice(0, path.lastIndexOf('/') + 1));
        const scene = collada.scene;
        let count = 0;
        scene.updateMatrixWorld(true);
        scene.traverse(o => {
          if (o.name && (o.isMesh || o.isGroup || o.type === 'Object3D')) {
            const key = o.name.toLowerCase();
            if (!this.meshIndex.has(key)) { this.meshIndex.set(key, o); count++; }
          }
        });
        this.log(`dae ${path.split('/').pop()}: ${count} nodes in ${(performance.now() - t0).toFixed(0)} ms`);
      } catch (e) {
        this.log(`dae ${path} failed: ${e.message}`, 'warn');
      }
      done++;
      onProgress(done / files.length, path);
    }
  }

  /** Convert a source object into a display mesh list (geometry in vehicle space). */
  extractMeshes(srcObj) {
    const out = [];
    srcObj.updateMatrixWorld(true);
    srcObj.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      out.push({ geo, matName: Array.isArray(o.material) ? (o.material[0]?.name || '') : (o.material?.name || '') });
    });
    return out;
  }

  groupsOfFlexbody(fb) {
    let g = fb.group;
    if (typeof g === 'string') g = g ? [g] : [];
    return Array.isArray(g) ? g.filter(x => typeof x === 'string') : [];
  }

  build() {
    const rig = this.rig;
    const com = rig.chassis.com;

    // ---- wheel frames -------------------------------------------------------
    for (const w of rig.wheels) {
      const carrier = new THREE.Group();
      carrier.name = `carrier_${w.name}`;
      carrier.position.set(w.center[0], w.center[1], w.center[2]);

      // orientation: X = axisOut, Y ⊥ up-ish, Z completes RH frame
      const X = new THREE.Vector3(...w.axisOut).normalize();
      const Yr = new THREE.Vector3(0, 1, 0);
      const Z = new THREE.Vector3().crossVectors(X, Yr).normalize();
      const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
      const m = new THREE.Matrix4().makeBasis(X, Y, Z);
      carrier.quaternion.setFromRotationMatrix(m);
      carrier.userData.baseQuat = carrier.quaternion.clone();
      carrier.userData.basePos = carrier.position.clone();
      carrier.userData.invBase = m.clone().invert();

      const spin = new THREE.Group();
      spin.name = `spin_${w.name}`;
      carrier.add(spin);
      this.root.add(carrier);
      this.wheelGroups.push({ def: w, carrier, spin, tireMats: [], outlineMats: [] });
    }

    // wheel group name lookup: hub/tire group -> wheel index
    const wheelByGroup = new Map();
    rig.wheels.forEach((w, i) => {
      if (w.hubGroup) wheelByGroup.set(String(w.hubGroup).toLowerCase(), i);
      if (w.tireGroup) wheelByGroup.set(String(w.tireGroup).toLowerCase(), i);
      wheelByGroup.set(`wheelhub_${w.name}`.toLowerCase(), i);
      wheelByGroup.set(`wheel_${w.name}`.toLowerCase(), i);
      wheelByGroup.set(`tire_${w.name}`.toLowerCase(), i);
    });

    // node groups -> member centroid (for carrier-side resolution)
    const groupCentroid = new Map();
    {
      const acc = new Map();
      const { groupsOf, posLocal, count } = rig.nodes;
      for (let i = 0; i < count; i++) {
        for (const g of groupsOf[i]) {
          const k = g.toLowerCase();
          let a = acc.get(k);
          if (!a) { a = [0, 0, 0, 0]; acc.set(k, a); }
          a[0] += posLocal[i * 3]; a[1] += posLocal[i * 3 + 1]; a[2] += posLocal[i * 3 + 2]; a[3]++;
        }
      }
      for (const [k, a] of acc) groupCentroid.set(k, [a[0] / a[3], a[1] / a[3], a[2] / a[3]]);
    }

    const nearestWheel = (p) => {
      let best = -1, bd = 1e9;
      rig.wheels.forEach((w, i) => {
        const d = (w.center[0] - p[0]) ** 2 + (w.center[1] - p[1]) ** 2 + (w.center[2] - p[2]) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      return bd < 0.6 * 0.6 ? best : -1;
    };

    // ---- flexbody attach loop ----------------------------------------------
    const seen = new Set();
    for (const fb of rig.flexbodies) {
      const meshName = String(fb.mesh || '').trim();
      if (!meshName) continue;
      const src = this.meshIndex.get(meshName.toLowerCase());
      if (!src) { this.stats.missing.push(meshName); continue; }

      const groups = this.groupsOfFlexbody(fb).map(g => g.toLowerCase());
      let wheelIdx = -1;
      for (const g of groups) {
        if (wheelByGroup.has(g)) { wheelIdx = wheelByGroup.get(g); break; }
      }
      const isSpin = wheelIdx >= 0 && (SPIN_RE.test(meshName) || groups.some(g => wheelByGroup.has(g)));
      let mode = 'chassis';
      if (isSpin) mode = 'spin';
      else if (CARRIER_RE.test(meshName)) {
        // find side via group centroid
        let p = null;
        for (const g of groups) if (groupCentroid.has(g)) { p = groupCentroid.get(g); break; }
        if (!p) {
          // fall back: mesh bbox centre in vehicle space
          const mm = this.extractMeshes(src);
          if (mm.length) {
            mm[0].geo.computeBoundingBox();
            const c = mm[0].geo.boundingBox.getCenter(new THREE.Vector3());
            p = [c.x - com[0], c.y - com[1], c.z - com[2]];
          }
        }
        if (p) { wheelIdx = nearestWheel(p); if (wheelIdx >= 0) mode = 'carrier'; }
      }

      const dedupeKey = `${meshName}|${mode}|${wheelIdx}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const pieces = this.extractMeshes(src);
      for (const piece of pieces) {
        const mat = this.matlib.get(piece.matName || meshName);
        const geo = piece.geo;
        // vehicle-space -> chassis frame (COM origin)
        geo.translate(-com[0], -com[1], -com[2]);

        const isTireMesh = /tire/i.test(meshName);
        let target;
        if (mode === 'spin' || (mode === 'carrier' && wheelIdx >= 0 && isTireMesh)) {
          const wg = this.wheelGroups[wheelIdx];
          const w = wg.def;
          geo.translate(-w.center[0], -w.center[1], -w.center[2]);
          geo.applyMatrix4(wg.carrier.userData.invBase);
          target = wg.spin;
        } else if (mode === 'carrier' && wheelIdx >= 0) {
          const wg = this.wheelGroups[wheelIdx];
          const w = wg.def;
          geo.translate(-w.center[0], -w.center[1], -w.center[2]);
          geo.applyMatrix4(wg.carrier.userData.invBase);
          target = wg.carrier;
        } else {
          target = this.root;
        }

        let useMat = mat;
        if (isTireMesh && wheelIdx >= 0) {
          // tire needs its own material instance (per-wheel deform uniforms)
          useMat = mat.clone();
          useMat.uniforms.uIsTire.value = 1;
          useMat.uniforms.uTireR.value = this.wheelGroups[wheelIdx].def.radius;
          useMat.uniforms.uHubR.value = this.wheelGroups[wheelIdx].def.hubRadius;
          useMat.userData.isToon = true;
          this.wheelGroups[wheelIdx].tireMats.push(useMat);
        }

        const mesh = new THREE.Mesh(geo, useMat);
        mesh.name = meshName;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        target.add(mesh);
        this.stats.attached++;
        this.stats[mode]++;

        // ink outline (skip interior + glass)
        if (!NO_OUTLINE_RE.test(meshName) && !useMat.transparent) {
          const hull = addOutline(mesh, 1.9);
          if (isTireMesh && wheelIdx >= 0) {
            hull.material.uniforms.uIsTire.value = 1;
            hull.material.uniforms.uTireR.value = this.wheelGroups[wheelIdx].def.radius;
            hull.material.uniforms.uHubR.value = this.wheelGroups[wheelIdx].def.hubRadius;
            this.wheelGroups[wheelIdx].outlineMats.push(hull.material);
          }
        }
      }
    }

    this.buildXray();
    this.log(`flexbody bind: ${this.stats.attached} meshes (${this.stats.spin} spin, ${this.stats.carrier} carrier, ` +
      `${this.stats.chassis} chassis), ${this.stats.missing.length} missing (vanilla refs)`);
    if (this.stats.missing.length) {
      this.log('missing meshes: ' + this.stats.missing.slice(0, 12).join(', ') +
        (this.stats.missing.length > 12 ? ` +${this.stats.missing.length - 12} more` : ''), 'warn');
    }
    return this.root;
  }

  /** Node-beam X-ray overlay (toggle with N). */
  buildXray() {
    const { posLocal } = this.rig.nodes;
    const pairs = this.rig.beams.pairs;
    const lpos = new Float32Array(pairs.length * 3);
    for (let i = 0; i < pairs.length; i++) {
      const n = pairs[i];
      lpos[i * 3] = posLocal[n * 3];
      lpos[i * 3 + 1] = posLocal[n * 3 + 1];
      lpos[i * 3 + 2] = posLocal[n * 3 + 2];
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: 0x37e5ff, transparent: true, opacity: 0.34, depthTest: false,
    }));
    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute('position', new THREE.BufferAttribute(posLocal, 3));
    const pts = new THREE.Points(ptsGeo, new THREE.PointsMaterial({
      color: 0xffd23e, size: 0.035, transparent: true, opacity: 0.8, depthTest: false,
    }));
    this.xray = new THREE.Group();
    this.xray.add(lines, pts);
    this.xray.visible = false;
    this.xray.renderOrder = 50;
    this.root.add(this.xray);
  }

  toggleXray() { this.xray.visible = !this.xray.visible; return this.xray.visible; }

  /** Per-frame: pose chassis + wheels from the sim. */
  syncFromSim(sim) {
    this.root.position.copy(sim.pos);
    this.root.quaternion.copy(sim.quat);

    const downWorld = new THREE.Vector3(0, -1, 0);
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();

    for (let i = 0; i < this.wheelGroups.length; i++) {
      const wg = this.wheelGroups[i];
      const sw = sim.wheels[i];
      const def = wg.def;

      // suspension travel along car-up in chassis frame
      wg.carrier.position.copy(wg.userData?.basePos || wg.carrier.userData.basePos);
      wg.carrier.position.y = wg.carrier.userData.basePos.y + sw.s;

      // steering about the kingpin axis (falls back to +Y)
      if (def.steered) {
        const axis = def.kingpin ? v.set(...def.kingpin.axis).normalize() : v.set(0, 1, 0);
        q.setFromAxisAngle(axis, sw.steer);
        wg.carrier.quaternion.copy(q).multiply(wg.carrier.userData.baseQuat);
      } else {
        wg.carrier.quaternion.copy(wg.carrier.userData.baseQuat);
      }

      // spin (jbeam wheelDir gives the roll sign per side)
      const rollSign = def.wheelDir >= 0 ? 1 : -1;
      wg.spin.rotation.x = sw.spinAngle * rollSign;

      // soft-tire uniforms: squash from physics, contact dir in carrier frame
      if (wg.tireMats.length || wg.outlineMats.length) {
        // world down → carrier local (unspun) direction, projected to YZ plane
        const invQ = wg.carrier.getWorldQuaternion(q).invert();
        const dLocal = v.copy(downWorld).applyQuaternion(invQ);
        const len = Math.hypot(dLocal.y, dLocal.z) || 1;
        const cy = dLocal.y / len, cz = dLocal.z / len;
        for (const m of [...wg.tireMats, ...wg.outlineMats]) {
          m.uniforms.uSquash.value = sw.squash;
          m.uniforms.uSpin.value = wg.spin.rotation.x;
          m.uniforms.uContactDir.value.set(cy, cz);
        }
      }
    }
  }
}

export default VehicleBinder;
