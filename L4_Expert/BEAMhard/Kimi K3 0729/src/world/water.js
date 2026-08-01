/**
 * water.js — Animated water volume for the wading pool + hydrodynamic drag helper.
 *
 * Renders a transparent animated water plane (custom ShaderMaterial: scrolling
 * normal-perturbed specular + fresnel, depth-fade alpha near the pool edges,
 * uniform time). Geometry matches the ProvingGround pool rect; construct with
 * `new WaterVolume(scene, pg.waterSpec)` for a perfect fit. Y-up, meters.
 */

import * as THREE from '../../lib/three.module.js';

const WATER_VERT = /* glsl */`
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  // macro ripples (small vertex displacement; fragment adds matching detail normals)
  wp.y += 0.025 * sin(wp.x * 0.9 + uTime * 1.4)
        + 0.018 * sin(wp.z * 1.2 - uTime * 1.1)
        + 0.012 * sin((wp.x + wp.z) * 0.55 + uTime * 0.8);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec2 uSize;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vWorld;

// Analytic gradient of the scrolling wave field (macro terms match the vertex
// shader; three higher-frequency scrolling detail terms are fragment-only).
vec3 waterNormal(vec2 p, float t) {
  float dx = 0.0;
  float dz = 0.0;
  dx += 0.025 * 0.9 * cos(p.x * 0.9 + t * 1.4);
  dz += 0.018 * 1.2 * cos(p.y * 1.2 - t * 1.1);
  float c3 = cos((p.x + p.y) * 0.55 + t * 0.8);
  dx += 0.012 * 0.55 * c3; dz += 0.012 * 0.55 * c3;
  float c4 = cos(p.x * 2.6 + p.y * 1.3 + t * 2.2);
  dx += 0.030 * 2.6 * c4; dz += 0.030 * 1.3 * c4;
  float c5 = cos(p.x * 3.9 - p.y * 2.4 - t * 2.9);
  dx += 0.022 * 3.9 * c5; dz -= 0.022 * 2.4 * c5;
  float c6 = cos(p.x * 1.1 + p.y * 5.2 + t * 1.7);
  dx += 0.018 * 1.1 * c6; dz += 0.018 * 5.2 * c6;
  return normalize(vec3(-dx, 1.0, -dz));
}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = waterNormal(vWorld.xz, uTime);
  float fres = 0.08 + 0.92 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 col = mix(uDeep, uSky, fres);
  vec3 H = normalize(V + uSunDir);
  float ndh = max(dot(N, H), 0.0);
  col += uSunColor * (pow(ndh, 220.0) * 1.7 + pow(ndh, 36.0) * 0.10);
  // depth-fade proxy: alpha (and a pale shore tint) ramps near the pool edges,
  // where the entry ramps push the bed above the waterline
  float edge = min(min(vUv.x, 1.0 - vUv.x) * uSize.x, min(vUv.y, 1.0 - vUv.y) * uSize.y);
  float fade = smoothstep(0.0, 1.6, edge);
  col = mix(col, vec3(0.82, 0.90, 0.94), (1.0 - fade) * 0.30);
  gl_FragColor = vec4(col, uOpacity * (0.30 + 0.70 * fade));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class WaterVolume {
  /**
   * @param {THREE.Scene} scene
   * @param {object} pool pool geometry; use `ProvingGround.waterSpec` for an exact match
   * @param {number} pool.cx pool center x (m)
   * @param {number} pool.cz pool center z (m)
   * @param {number} pool.w extent along x (m)
   * @param {number} pool.l extent along z (m)
   * @param {number} pool.surfaceY water surface height (m)
   */
  constructor(scene, { cx, cz, w, l, surfaceY }) {
    this.cx = cx;
    this.cz = cz;
    this.w = w;
    this.l = l;
    this.surfaceY = surfaceY;
    this._time = 0;

    this._uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.35, 0.75, 0.45).normalize() },
      uSunColor: { value: new THREE.Color(1.0, 0.96, 0.88) },
      uDeep: { value: new THREE.Color(0.045, 0.110, 0.180) },
      uSky: { value: new THREE.Color(0.760, 0.830, 0.900) }, // matches sky day horizon
      uSize: { value: new THREE.Vector2(w, l) },
      uOpacity: { value: 0.86 },
    };
    const geo = new THREE.PlaneGeometry(w, l, 48, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    /** @type {THREE.Mesh} transparent animated water plane at surfaceY */
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(cx, surfaceY, cz);
    this.mesh.renderOrder = 4;
    this.mesh.name = 'water';
    scene.add(this.mesh);
  }

  /**
   * Advance the water animation.
   * @param {number} dt seconds since last frame
   * @param {number} [time] absolute clock (s); when omitted, dt is accumulated
   */
  update(dt, time) {
    if (time !== undefined) this._time = time;
    else this._time += dt;
    this._uniforms.uTime.value = this._time;
  }

  /**
   * Sync sun/sky colors with a SkyEnvironment so water, sky and fog share one palette.
   * @param {object} env
   * @param {THREE.Vector3} [env.sunDir] unit vector toward the sun (SkyEnvironment.sunDir)
   * @param {THREE.Color} [env.sunColor]
   * @param {THREE.Color} [env.skyColor] horizon color (SkyEnvironment.horizonColor)
   */
  setEnvironment({ sunDir, sunColor, skyColor } = {}) {
    if (sunDir) this._uniforms.uSunDir.value.copy(sunDir);
    if (sunColor) this._uniforms.uSunColor.value.copy(sunColor);
    if (skyColor) this._uniforms.uSky.value.copy(skyColor);
  }

  /**
   * Quadratic water-drag helper for the vehicle physics step. Pure math, no three.
   * Buoyancy itself is computed by the parent vehicle code from queryWater();
   * this helper provides the drag term for a set of submerged AABB sample points.
   *
   * @param {Array<{x:number, y:number, z:number}>} points world-space sample points
   * @param {{x:number, y:number, z:number}} vel velocity of the sampled body (m/s)
   * @param {number} surfaceY waterline height (m), e.g. WaterVolume.surfaceY
   * @param {number} [dragCoef=2.2] lumped drag coefficient (absorbs 0.5 * rho)
   * @param {number} [area=2.4] reference area (m^2)
   * @returns {{submergedCount:number, avgDepth:number, drag:{x:number, y:number, z:number}}}
   *   drag = -dragCoef * area * (submergedCount / points.length) * |v| * v (force,
   *   before integration). avgDepth is the mean submersion depth of the submerged
   *   points (m); 0 when nothing is submerged.
   */
  static computeHydrodynamics(points, vel, surfaceY, dragCoef = 2.2, area = 2.4) {
    let submergedCount = 0;
    let depthSum = 0;
    const n = points ? points.length : 0;
    for (let i = 0; i < n; i++) {
      const d = surfaceY - points[i].y;
      if (d > 0) {
        submergedCount++;
        depthSum += d;
      }
    }
    const drag = { x: 0, y: 0, z: 0 };
    if (submergedCount > 0 && n > 0) {
      const frac = submergedCount / n;
      const speed = Math.hypot(vel.x, vel.y, vel.z);
      const k = -dragCoef * area * frac * speed;
      drag.x = k * vel.x;
      drag.y = k * vel.y;
      drag.z = k * vel.z;
    }
    return {
      submergedCount,
      avgDepth: submergedCount > 0 ? depthSum / submergedCount : 0,
      drag,
    };
  }
}
