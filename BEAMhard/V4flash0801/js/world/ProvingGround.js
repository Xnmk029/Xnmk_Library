/**
 * world/ProvingGround.js — procedural proving ground construction
 *  1. Suspension test: Belgian cobblestone + asymmetric bumps
 *  2. Steering test: slalom corridor + high-banked oval
 *  3. Wading test: deep pool with water
 *  + start gate, return road, knockable slalom cones (prop physics)
 */
import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeToonMaterial, makeWaterMaterial } from '../render/Toon.js';

const _v = new THREE.Vector3();

export class ProvingGround {
  constructor(scene, ground) {
    this.scene = scene;
    this.ground = ground;
    this.group = new THREE.Group();
    this.group.name = 'proving-ground';
    scene.add(this.group);
    this.cones = [];
    this.water = null;
    this.hits = [];           // collision events for fx
    this.coneKnocks = [];
  }

  build() {
    this.buildGroundMesh();
    this.buildCobblestones();
    this.buildBumps();
    this.buildBankedTrack();
    this.buildPool();
    this.buildSlalom();
    this.buildStartGate();
    this.buildReturnRoad();
    this.buildSigns();
    this.buildBoundaryPosts();
    return this;
  }

  mat(color, opts = {}) {
    return makeToonMaterial({ color, ...opts, skyColor: 0x9fc4ff, groundColor: 0x54412f, fogColor: 0x1b2f5c });
  }

  buildGroundMesh() {
    const { x0, x1, z0, z1 } = { x0: -300, x1: 300, z0: -360, z1: 470 };
    const step = 3.2;
    const nx = Math.floor((x1 - x0) / step) + 1;
    const nz = Math.floor((z1 - z0) / step) + 1;
    const pos = new Float32Array(nx * nz * 3);
    const col = new Float32Array(nx * nz * 3);
    const idx = [];
    const tmp = new THREE.Color();
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = x0 + ix * step, z = z0 + iz * step;
        const h = this.ground.heightAt(x, z);
        const i = (iz * nx + ix) * 3;
        pos[i] = x; pos[i + 1] = h.y; pos[i + 2] = z;
        tmp.setHex(this.ground.materialColor(h.material));
        // subtle checker for asphalt zones
        if (h.material === 'asphalt') {
          const ch = ((ix >> 2) + (iz >> 2)) & 1;
          tmp.multiplyScalar(ch ? 0.96 : 1.04);
        }
        col[i] = tmp.r; col[i + 1] = tmp.g; col[i + 2] = tmp.b;
        if (ix < nx - 1 && iz < nz - 1) {
          const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = makeToonMaterial({ color: 0xffffff, toonMix: 0, skyColor: 0x9fc4ff, groundColor: 0x54412f });
    m.vertexColors = true;
    // enable vertex colors in toon shader: reuse via custom attribute — patch by injecting
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = 'pg-ground';
    this.group.add(mesh);
    this.groundMesh = mesh;
  }

  buildCobblestones() {
    // instanced stones over the cobble zone
    const zone = { x0: -68, x1: 68, z0: 64, z1: 148 };
    const s = 0.42;
    const nx = Math.floor((zone.x1 - zone.x0) / s);
    const nz = Math.floor((zone.z1 - zone.z0) / s);
    const geo = new THREE.BoxGeometry(0.24, 0.07, 0.26);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7a7b80, roughness: 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, nx * nz);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    let i = 0;
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = zone.x0 + ix * s + Math.sin(ix * 7.3) * 0.04;
        const z = zone.z0 + iz * s + Math.cos(iz * 5.1) * 0.04;
        const h = this.ground.heightAt(x, z);
        p.set(x, h.y + 0.035, z);
        q.setFromEuler(new THREE.Euler(Math.sin(ix * 3.7) * 0.2, 0, Math.cos(iz * 2.9) * 0.2));
        sc.set(1, 0.7 + ((ix * 13 + iz * 7) % 5) * 0.09, 1);
        m4.compose(p, q, sc);
        mesh.setMatrixAt(i++, m4);
      }
    }
    mesh.count = i;
    mesh.name = 'cobblestones';
    this.group.add(mesh);
    // stone perimeter frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(zone.x1 - zone.x0 + 0.8, 0.16, 0.5),
      this.mat(0x4a4d55));
    frame.position.set((zone.x0 + zone.x1) / 2, 0.08, zone.z0 - 0.3);
    this.group.add(frame);
  }

  buildBumps() {
    const rowSpacing = 13.2;
    const rows = 6;
    const len = 136;
    for (let r = 0; r < rows; r++) {
      const z0 = 150 + r * rowSpacing;
      for (const side of [-1, 1]) {
        const hMax = side < 0 ? 0.155 : 0.06;
        const geo = new THREE.CylinderGeometry(hMax, hMax, len / 2, 14, 1, false, 0, Math.PI);
        geo.rotateZ(side * Math.PI / 2);
        geo.rotateX(Math.PI / 2);
        geo.translate(0, hMax, 0);
        const mesh = new THREE.Mesh(geo, this.mat(side < 0 ? 0x565b66 : 0x6a6e78));
        mesh.position.set(side * (len / 4) - (side < 0 ? 0.5 : 0), 0, z0);
        this.group.add(mesh);
      }
      // center marker
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 4.2), this.mat(0xffd200));
      strip.position.set(0, 0.011, z0 + 2.1);
      this.group.add(strip);
    }
  }

  buildBankedTrack() {
    const B = this.ground.bank;
    const seg = 96, width = 14;
    const pos = [], norm = [], idx = [], col = [];
    const tmp = new THREE.Color(0x2e3138);
    const bank = B.bankDeg * Math.PI / 180;
    const cb = Math.cos(bank), sb = Math.sin(bank);
    const half = width / 2;
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const cx = B.cx + Math.cos(th) * B.R;
      const cz = B.cz + Math.sin(th) * B.R;
      const tx = -Math.sin(th), tz = Math.cos(th);   // tangent
      for (let j = 0; j <= 8; j++) {
        const s = -half + (j / 8) * width;
        // lateral in banked plane: perpendicular to tangent, tilted up by bank
        const lx = -tz, lz = tx;                       // radial outward
        const x = cx + lx * s * cb;
        const y = s * sb;
        const z = cz + lz * s * cb;
        pos.push(x, y, z);
        // normal: perpendicular to (tangent) and (lateral banked dir)
        const nxp = -tz, nyp = 0, nzp = tx;            // horizontal normal (radial)
        // rotate normal by -bank around tangent
        const nx2 = nxp * cb - 0 * sb;
        const ny2 = nxp * sb + 0 * cb;
        const nz2 = nzp;
        norm.push(nx2, ny2, nz2);
        col.push(tmp.r, tmp.g, tmp.b);
        if (i < seg && j < 8) {
          const a = i * 9 + j, b = a + 1, c = a + 9, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, this.mat(0xffffff, { toonMix: 0 }));
    mesh.name = 'banked-track';
    this.group.add(mesh);
    // kerbs
    const kerbGeo = new THREE.TorusGeometry(B.R, 0.22, 6, 96);
    for (const r of [B.R - width / 2, B.R + width / 2]) {
      const k = new THREE.Mesh(kerbGeo, this.mat(0xcf3a2f));
      k.scale.set(r / B.R, 1, r / B.R);
      k.rotation.x = Math.PI / 2;
      k.position.set(B.cx, 0.1, B.cz);
      this.group.add(k);
    }
    // start line on track
    const startLine = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, 0.5), this.mat(0xffffff));
    startLine.position.set(B.cx + B.R, 0.05, B.cz);
    startLine.rotation.y = Math.PI / 2;
    this.group.add(startLine);
    // banked track POI sign
    this.addSign(B.cx - B.R - 8, 1.2, B.cz, 'BANKED OVAL // 17°', 0xffd200);
  }

  buildPool() {
    const P = this.ground.pool;
    const wallMat = this.mat(0x4d5a66);
    const w = P.x1 - P.x0, d = P.z1 - P.z0;
    const mkWall = (x, z, ww, hh, rotY) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.6), wallMat);
      m.position.set(x, -hh / 2 - 0.05, z);
      m.rotation.y = rotY;
      this.group.add(m);
    };
    mkWall((P.x0 + P.x1) / 2, P.z0 - 0.3, w + 1, 2.4, 0);
    mkWall((P.x0 + P.x1) / 2, P.z1 + 0.3, w + 1, 2.4, 0);
    mkWall(P.x0 - 0.3, (P.z0 + P.z1) / 2, d + 1, 2.4, Math.PI / 2);
    mkWall(P.x1 + 0.3, (P.z0 + P.z1) / 2, d + 1, 2.4, Math.PI / 2);
    // east ramp
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, d), this.mat(0x575d66));
    ramp.position.set(P.x1 + 8, -0.25, (P.z0 + P.z1) / 2);
    ramp.rotation.z = -Math.atan2(2.1, 16);
    this.group.add(ramp);
    // water
    const waterGeo = new THREE.PlaneGeometry(w, d, 48, 48);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, makeWaterMaterial(0x2a6f8f));
    water.position.set((P.x0 + P.x1) / 2, CFG.WORLD.waterLevel, (P.z0 + P.z1) / 2);
    water.name = 'pool-water';
    this.group.add(water);
    this.water = water;
    // depth markers
    for (const zz of [P.z0 + 24, (P.z0 + P.z1) / 2, P.z1 - 24]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.24), this.mat(0xffd200));
      m.position.set(P.x1 - 8, 0.8, zz);
      this.group.add(m);
    }
    this.addSign(P.x1 + 10, 1.4, P.z1 - 10, 'WADING POOL // DEPTH 2.1M', 0x35e0ff);
  }

  buildSlalom() {
    const coneMat = this.mat(0xff5a1f, { rimColor: 0xffffff, specGloss: 40 });
    const baseMat = this.mat(0x2b2e36);
    for (let i = 0; i < 15; i++) {
      const z = 262 + i * 10.5;
      const x = (i % 2 === 0 ? 1 : -1) * 2.1;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.52, 10), coneMat);
      cone.position.set(x, 0.26, z);
      cone.name = 'slalom-cone-' + i;
      this.group.add(cone);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.34), baseMat);
      base.position.set(x, 0.025, z);
      this.group.add(base);
      this.cones.push({ mesh: cone, base, pos: new THREE.Vector3(x, 0.26, z), vel: new THREE.Vector3(), ang: new THREE.Quaternion(), angVel: new THREE.Vector3(), hit: false, restT: 0 });
    }
    // start/end gates
    for (const z of [246, 420]) {
      for (const sx of [-4.5, 4.5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), this.mat(0xe8e8ee));
        post.position.set(sx, 1.3, z);
        this.group.add(post);
      }
      const banner = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.5, 0.06), this.mat(0xff2e4d));
      banner.position.set(0, 2.55, z);
      this.group.add(banner);
    }
    this.addSign(0, 3.4, 246, 'SLALOM // START', 0xff2e4d);
    this.addSign(0, 3.4, 420, 'SLALOM // FINISH', 0xff2e4d);
  }

  buildStartGate() {
    this.addSign(0, 3.2, -6, 'CCF PROVING GROUND // 试验场', 0xffd200);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), this.mat(0x35e0ff));
    arrow.position.set(0, 0.9, 28);
    arrow.rotation.x = Math.PI / 2;
    this.group.add(arrow);
  }

  buildReturnRoad() {
    // west return road: pool -> start pad
    const pts = [[-233, -250], [-233, 62], [0, 62], [0, 30]];
    const w = 7.5;
    const pos = [], idx = [], col = [];
    const c = new THREE.Color(0x2a2d34);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const px = -dz / len, pz = dx / len;
      const base = pos.length / 3;
      pos.push(a[0] + px * w / 2, 0.012, a[1] + pz * w / 2);
      pos.push(a[0] - px * w / 2, 0.012, a[1] - pz * w / 2);
      pos.push(b[0] - px * w / 2, 0.012, b[1] - pz * w / 2);
      pos.push(b[0] + px * w / 2, 0.012, b[1] + pz * w / 2);
      for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, this.mat(0xffffff, { toonMix: 0 }));
    mesh.name = 'return-road';
    this.group.add(mesh);
    this.addSign(-233, 3.0, -150, 'RETURN ROAD', 0x35e0ff);
  }

  buildSigns() {
    this.addSign(40, 2.4, 66, 'SUSPENSION TEST ZONE', 0x35e0ff);
    this.addSign(40, 2.4, 152, 'ASYMMETRIC BUMPS', 0xffd200);
  }

  buildBoundaryPosts() {
    // red/white posts along the cobble zone boundary (visual only)
    const zone = { x0: -70, x1: 70, z0: 62, z1: 150 };
    const posts = [];
    for (let x = zone.x0; x <= zone.x1; x += 10) posts.push([x, zone.z0 - 2], [x, zone.z1 + 2]);
    for (const [x, z] of posts) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), this.mat(0xe8e8ee));
      p.position.set(x, 0.6, z);
      this.group.add(p);
    }
  }

  addSign(x, y, z, text, color = 0xffd200) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101828';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 46px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: tex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), m);
    sign.position.set(x, y, z);
    sign.rotation.y = Math.PI;
    this.group.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, y, 6), this.mat(0x888d99));
    pole.position.set(x, y / 2, z);
    this.group.add(pole);
  }

  /** update dynamic props (cones) & water shader time */
  update(dt, vehicle, time) {
    // water animation
    if (this.water && this.water.material.uniforms) {
      this.water.material.uniforms.uTime.value = time;
    }
    // cones: knock-over physics
    const chassis = vehicle.body;
    const hy = vehicle.shape.halfExtents.y;
    const cz = chassis.pos.y + vehicle.shape.center.y - hy;
    for (const cone of this.cones) {
      const dx = cone.pos.x - chassis.pos.x;
      const dz = cone.pos.z - chassis.pos.z;
      const dist = Math.hypot(dx, dz);
      // chassis box approx: circle of radius 1.6 around body center at ground level
      if (dist < 1.9 && cz < 1.1 && !cone.hit) {
        const push = Math.min(14, Math.max(2, vehicle.speed * 1.1 + 3));
        const dir = _v.set(dx / Math.max(dist, 0.01), 0, dz / Math.max(dist, 0.01));
        cone.vel.addScaledVector(dir, push * (1 - dist / 2.2));
        cone.vel.y += 1.6 + vehicle.speed * 0.05;
        cone.hit = true;
        this.coneKnocks.push({ t: 0 });
        if (this.coneKnocks.length > 8) this.coneKnocks.shift();
      }
      // integrate
      cone.vel.y -= 9.81 * dt;
      cone.pos.addScaledVector(cone.vel, dt);
      cone.vel.multiplyScalar(Math.max(0, 1 - dt * 1.6));
      // ground
      if (cone.pos.y < 0.26) {
        cone.pos.y = 0.26;
        cone.vel.y *= -0.32;
        cone.vel.x *= 0.82;
        cone.vel.z *= 0.82;
        if (Math.abs(cone.vel.y) < 0.4) cone.vel.y = 0;
      }
      cone.mesh.position.copy(cone.pos);
      if (cone.hit) {
        // tumble rotation
        cone.angVel.x += (Math.random() - 0.5) * 2 * dt * 8;
        cone.angVel.z += (Math.random() - 0.5) * 2 * dt * 8;
        cone.angVel.multiplyScalar(Math.max(0, 1 - dt * 2.5));
        const q = cone.mesh.quaternion;
        q.x += cone.angVel.x * dt; q.y += cone.angVel.y * dt; q.z += cone.angVel.z * dt;
        q.normalize();
        cone.base.position.copy(cone.pos).setY(0.025);
        cone.base.quaternion.copy(q);
      }
    }
  }
}
