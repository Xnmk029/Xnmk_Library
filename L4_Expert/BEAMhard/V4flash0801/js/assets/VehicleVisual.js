/**
 * assets/VehicleVisual.js — binds parsed JBeam parts & DAE meshes onto the physics chassis
 *  - chassis group (mirrored & lifted), wheel groups with steering/spin/deformation
 *  - toon material conversion + inverted-hull outlines
 *  - brake/head light overlays
 */
import * as THREE from 'three';
import { CFG } from '../config.js';
import { convertToToon, addOutline } from '../render/Toon.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class VehicleVisual {
  constructor(assets, scene) {
    this.assets = assets;
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'vehicle-visual';
    scene.add(this.root);
    this.chassis = new THREE.Group();
    this.chassis.position.y = CFG.VEHICLE.LIFT;
    this.root.add(this.chassis);
    this.outlineGroup = new THREE.Group();
    this.chassis.add(this.outlineGroup);
    this.wheelGroups = [];
    this.bodyMeshes = [];
    this.rearlightMeshes = [];
    this.headlightMeshes = [];
    this.lightOverlays = [];
    this.lightsOn = false;
    this.brakeOn = false;
  }

  build() {
    const assets = this.assets;
    // ---------- chassis parts ----------
    let bound = 0, missing = 0;
    const missingList = [];
    for (const p of assets.parts) {
      for (const fb of p.flexbodies) {
        const mesh = assets.findMesh(fb.mesh);
        if (!mesh) { missing++; if (missingList.length < 14) missingList.push(fb.mesh); continue; }
        this.addBodyMesh(mesh);
        bound++;
      }
    }
    // extra powertrain meshes
    for (const name of CFG.BUILD.extraMeshes) {
      const mesh = assets.findMesh(name);
      if (mesh) { this.addBodyMesh(mesh); bound++; }
      else missing++;
    }
    console.log(`[BEAMGL][vehicle] body meshes bound: ${bound}, missing: ${missing} (${missingList.join(', ')})`);

    // ---------- wheels & tires ----------
    const wheelDefs = CFG.VEHICLE.WHEELS;
    for (let i = 0; i < wheelDefs.length; i++) {
      const wd = wheelDefs[i];
      const group = this.buildWheelGroup(i, wd);
      this.wheelGroups.push(group);
      this.root.add(group.group);
    }

    // ---------- outlines (inverted hull) for body ----------
    for (const m of this.bodyMeshes) {
      const name = m.name.toLowerCase();
      if (name.includes('glass') || name.includes('tire') || name.includes('wheel') || name.includes('light')) continue;
      const out = addOutline(m, this.outlineGroup, 0x0a0f1e, CFG.RENDER.outlineWidth);
      out.scale.copy(m.scale);
    }

    // ---------- light overlays ----------
    this.buildLightOverlays();
    return this;
  }

  addBodyMesh(mesh) {
    const clone = this.assets.cloneMesh(mesh);
    clone.name = mesh.name + '_bound';
    clone.castShadow = true;
    clone.receiveShadow = true;
    if (Array.isArray(clone.material)) clone.material = clone.material.map(m => convertToToon(m));
    else clone.material = convertToToon(clone.material);
    // keep glass transparent
    if (clone.material && clone.material.transparent && clone.material.uniforms) {
      clone.material.uniforms.uAlpha.value = 0.55;
      clone.material.depthWrite = false;
    }
    this.chassis.add(clone);
    this.bodyMeshes.push(clone);
    const nm = (mesh.name || '').toLowerCase();
    if (nm.includes('rearlight') || nm.includes('taillight') || nm.includes('chmsl')) this.rearlightMeshes.push(clone);
    if (nm.includes('headlight') && !nm.includes('housing')) this.headlightMeshes.push(clone);
    return clone;
  }

  buildWheelGroup(idx, wd) {
    const group = new THREE.Group();
    group.name = 'wheel-' + wd.id;
    group.position.set(wd.x, wd.y, wd.z);
    const steerGroup = new THREE.Group();
    steerGroup.name = 'steer';
    group.add(steerGroup);
    const spinGroup = new THREE.Group();
    spinGroup.name = 'spin';
    steerGroup.add(spinGroup);

    // wheel mesh (from wheel part flexbodies)
    const wp = this.assets.wheelParts.find(w => w.def) || null;
    if (wp) {
      for (const fb of this.flexbodiesOf(wp.def)) {
        const targetGroups = fb.groups.map(g2 => g2.toLowerCase());
        const match = targetGroups.some(g2 => g2.includes('wheelhub') || g2.includes('wheel_' + wd.id.toLowerCase()));
        if (!match) continue;
        const mesh = this.assets.findMesh(fb.mesh);
        if (!mesh) continue;
        const clone = this.assets.cloneMesh(mesh);
        if (Array.isArray(clone.material)) clone.material = clone.material.map(m => convertToToon(m, { specGloss: 60 }));
        else clone.material = convertToToon(clone.material, { specGloss: 60 });
        clone.castShadow = true;
        // wheel mesh is centered on axle (X axis) in jbeam; mesh mirrored in asset prep
        spinGroup.add(clone);
      }
    }

    // tire mesh
    const tp = this.assets.tireParts[Math.floor(idx / 2)] || null;
    const tireMesh = this.bindTire(tp, wd.id, spinGroup);

    return { group, steerGroup, spinGroup, tireMesh, id: wd.id };
  }

  flexbodiesOf(part) {
    const out = [];
    const rows = part.flexbodies;
    if (!Array.isArray(rows)) return out;
    for (const r of rows) {
      if (!Array.isArray(r) || typeof r[0] !== 'string' || r[0] === 'mesh') continue;
      if (typeof r[1] === 'string' || !Array.isArray(r[1])) continue;
      out.push({ mesh: r[0], groups: r[1], transform: r[3] });
    }
    return out;
  }

  bindTire(tp, wheelId, spinGroup) {
    if (!tp) return null;
    for (const fb of this.flexbodiesOf(tp.def)) {
      const target = 'wheel_' + wheelId.toLowerCase();
      if (!fb.groups.some(g2 => g2.toLowerCase().includes(target))) continue;
      const mesh = this.assets.findMesh(fb.mesh);
      if (!mesh) continue;
      const clone = this.assets.cloneMesh(mesh);
      if (Array.isArray(clone.material)) clone.material = clone.material.map(m => convertToToon(m, { specGloss: 8 }));
      else clone.material = convertToToon(clone.material, { specGloss: 8 });
      clone.castShadow = true;
      // apply flexbody transform (scale / rotation) from the tire part definition
      if (fb.transform) {
        const tr = fb.transform;
        if (tr.scale) clone.scale.set(tr.scale.x || 1, tr.scale.y || 1, tr.scale.z || 1);
        if (tr.rot) {
          // jbeam degrees, x/y/z rotations; x-mirrored asset space => negate z
          clone.rotation.set(
            (tr.rot.x || 0) * Math.PI / 180,
            (tr.rot.y || 0) * Math.PI / 180,
            -(tr.rot.z || 0) * Math.PI / 180
          );
        }
      }
      spinGroup.add(clone);
      return clone;
    }
    return null;
  }

  buildLightOverlays() {
    const mk = (color, opacity) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      return m;
    };
    for (const rm of this.rearlightMeshes) {
      const overlay = new THREE.Mesh(rm.geometry, mk(0xff2211, 0.9));
      overlay.position.copy(rm.position);
      overlay.quaternion.copy(rm.quaternion);
      overlay.scale.copy(rm.scale);
      overlay.visible = false;
      overlay.renderOrder = 5;
      rm.parent.add(overlay);
      this.lightOverlays.push({ mesh: overlay, kind: 'brake' });
    }
    for (const hm of this.headlightMeshes) {
      const overlay = new THREE.Mesh(hm.geometry, mk(0xfff6d8, 0.95));
      overlay.position.copy(hm.position);
      overlay.quaternion.copy(hm.quaternion);
      overlay.scale.copy(hm.scale);
      overlay.visible = false;
      overlay.renderOrder = 5;
      hm.parent.add(overlay);
      this.lightOverlays.push({ mesh: overlay, kind: 'head' });
    }
  }

  setLights(on) {
    this.lightsOn = on;
    for (const o of this.lightOverlays) {
      if (o.kind === 'head') o.mesh.visible = on;
    }
  }

  /** sync with physics */
  update(vehicle, dt) {
    const body = vehicle.body;
    this.root.position.copy(body.pos);
    this.root.quaternion.copy(body.quat);

    // wheel visuals
    const invQ = _q.copy(body.quat).invert();
    for (let i = 0; i < this.wheelGroups.length; i++) {
      const wg = this.wheelGroups[i];
      const w = vehicle.wheels[i];
      // wheel center relative to body
      _v.copy(w.wheelPos).sub(body.pos).applyQuaternion(invQ);
      wg.group.position.copy(_v);
      wg.steerGroup.rotation.y = w.steerAngle;
      wg.spinGroup.rotation.x = w.spinAngle;
      // tire deformation (soft tire decoupling)
      if (wg.tireMesh) {
        const c = w.compression;
        const squash = 1 - c * 1.35;
        wg.tireMesh.scale.set(1 + c * 0.7, Math.max(0.55, squash), Math.max(0.55, squash));
        wg.tireMesh.position.y = -c * 0.3;
      }
    }
    // brake lights
    const brake = this.brakeOn;
    const wantBrake = (vehicle.input.brake > 0.05 || vehicle.input.handbrake) && vehicle.speed > 0.3;
    if (wantBrake !== brake) {
      this.brakeOn = wantBrake;
      for (const o of this.lightOverlays) {
        if (o.kind === 'brake') o.mesh.visible = this.brakeOn;
      }
    }
  }
}
