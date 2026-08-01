/**
 * Tyre smoke and skid marks.
 *
 * Both are fixed-size ring buffers written from JS into pre-allocated typed
 * arrays. Nothing is allocated per frame and nothing is added to or removed
 * from the scene graph at runtime, which is what keeps a car doing donuts from
 * causing a GC pause.
 */

import * as THREE from 'three';
import { smokeTexture } from '../track/textures.js';

const SMOKE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Perspective size attenuation, clamped so near particles do not fill the
    // screen with one enormous sprite.
    gl_PointSize = clamp(aSize * 320.0 / max(-mv.z, 1.0), 1.0, 190.0);
  }
`;

const SMOKE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    if (t.a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(uColor, t.a * vAlpha);
    // Same reason as the sky: a raw ShaderMaterial must run the output
    // pipeline itself or it will not match the lit scene around it.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class TyreSmoke {
  constructor(max = 420) {
    this.max = max;
    this.cursor = 0;
    this.positions = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.alphas = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);

    // Park everything out of sight until it is used.
    for (let i = 0; i < max; i++) this.positions[i * 3 + 1] = -1000;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: smokeTexture(64) },
        uColor: { value: new THREE.Color(0.82, 0.8, 0.78) },
      },
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'tyre-smoke';
    this.geo = geo;
  }

  /**
   * @param {number} x world position of the contact patch
   * @param {number} z
   * @param {number} intensity 0..1
   * @param {number} vx  world velocity to inherit
   * @param {number} vz
   */
  emit(x, z, intensity, vx, vz) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const p = i * 3;
    this.positions[p] = x + (Math.random() - 0.5) * 0.5;
    this.positions[p + 1] = 0.12 + Math.random() * 0.1;
    this.positions[p + 2] = z + (Math.random() - 0.5) * 0.5;
    // Smoke is dragged along by the car and rolls upward and outward.
    this.vel[p] = vx * 0.18 + (Math.random() - 0.5) * 1.4;
    this.vel[p + 1] = 0.5 + Math.random() * 0.9;
    this.vel[p + 2] = vz * 0.18 + (Math.random() - 0.5) * 1.4;
    this.sizes[i] = 0.5 + Math.random() * 0.4;
    this.alphas[i] = 0.1 + intensity * 0.34;
    this.maxLife[i] = 1.5 + Math.random() * 1.6;
    this.life[i] = this.maxLife[i];
  }

  update(dt) {
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      live++;
      this.life[i] -= dt;
      const p = i * 3;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.positions[p] += this.vel[p] * dt;
      this.positions[p + 1] += this.vel[p + 1] * dt;
      this.positions[p + 2] += this.vel[p + 2] * dt;
      // Air drag, and the plume slows its rise as it expands.
      const drag = 1 - dt * 1.5;
      this.vel[p] *= drag;
      this.vel[p + 1] *= 1 - dt * 0.75;
      this.vel[p + 2] *= drag;
      this.sizes[i] += dt * 2.3;
      // Fade in fast, out slowly.
      this.alphas[i] *= 1 - dt * (0.5 + t * 1.5);
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        this.positions[p + 1] = -1000;
      }
    }
    this.live = live;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.material.uniforms.uMap.value.dispose();
    this.material.dispose();
  }
}

/**
 * Skid marks, laid as a ribbon of quads under each rear wheel.
 *
 * A ring buffer of 1400 segments at roughly 0.35 m each is about 480 m of
 * marks -- long enough that the oldest end is out of sight before it gets
 * recycled, so no fade is needed and the per-frame cost is two quad writes.
 */
export class SkidMarks {
  constructor(maxSegments = 1400) {
    this.max = maxSegments;
    this.cursor = 0;
    const verts = maxSegments * 4;

    this.positions = new Float32Array(verts * 3);
    this.colors = new Float32Array(verts * 4);
    const indices = new Uint32Array(maxSegments * 6);
    for (let s = 0; s < maxSegments; s++) {
      const v = s * 4;
      const o = s * 6;
      indices[o] = v;
      indices[o + 1] = v + 2;
      indices[o + 2] = v + 1;
      indices[o + 3] = v + 1;
      indices[o + 4] = v + 2;
      indices[o + 5] = v + 3;
    }
    for (let i = 0; i < verts; i++) this.positions[i * 3 + 1] = -1000;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      // Marks sit a couple of centimetres above the tarmac; polygon offset
      // keeps them from shimmering against it at distance.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'skid-marks';
    this.geo = geo;

    /** Per-wheel last contact point, so segments join up. */
    this.last = new Map();
  }

  /**
   * @param {string} key      wheel identifier
   * @param {number} x        contact patch
   * @param {number} z
   * @param {number} leftX    unit vector across the tyre
   * @param {number} leftZ
   * @param {number} width    tyre width, m
   * @param {number} strength 0..1
   */
  lay(key, x, z, leftX, leftZ, width, strength) {
    const prev = this.last.get(key);
    this.last.set(key, { x, z, leftX, leftZ });
    if (!prev) return;
    const d = Math.hypot(x - prev.x, z - prev.z);
    // Too short to matter, or a teleport (respawn) -- skip.
    if (d < 0.12 || d > 6) return;

    const s = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const v = s * 4;
    const hw = width * 0.5;

    const set = (vi, px, pz, lx, lz, sign) => {
      const o = vi * 3;
      this.positions[o] = px + lx * hw * sign;
      this.positions[o + 1] = 0.019;
      this.positions[o + 2] = pz + lz * hw * sign;
    };
    set(v, prev.x, prev.z, prev.leftX, prev.leftZ, 1);
    set(v + 1, prev.x, prev.z, prev.leftX, prev.leftZ, -1);
    set(v + 2, x, z, leftX, leftZ, 1);
    set(v + 3, x, z, leftX, leftZ, -1);

    const a = Math.min(0.72, strength * 0.72);
    for (let k = 0; k < 4; k++) {
      const o = (v + k) * 4;
      this.colors[o] = 0.06;
      this.colors[o + 1] = 0.055;
      this.colors[o + 2] = 0.05;
      this.colors[o + 3] = a;
    }
    this.dirty = true;
  }

  /** Break the trail so the next mark does not stretch back to the old spot. */
  breakTrail(key) {
    this.last.delete(key);
  }

  flush() {
    if (!this.dirty) return;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.dirty = false;
  }

  clear() {
    this.positions.fill(0);
    for (let i = 0; i < this.max * 4; i++) this.positions[i * 3 + 1] = -1000;
    this.colors.fill(0);
    this.last.clear();
    this.cursor = 0;
    this.dirty = true;
    this.flush();
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}
