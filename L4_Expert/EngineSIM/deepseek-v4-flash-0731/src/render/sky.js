/**
 * Procedural sky dome.
 *
 * An analytic atmosphere plus noise clouds on a single inward-facing sphere.
 * No cubemap to generate, no HDRI to download, ~1.5 ms of GPU time, and the
 * sun position is a parameter -- so the directional light, the fog colour and
 * the sky always agree with each other by construction.
 */

import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // Direction from the camera through this vertex, in world space.
    vDir = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform float uTime;
  uniform float uCloudCover;
  uniform float uCloudScale;
  uniform float uExposure;

  varying vec3 vDir;

  // --- cheap value noise ------------------------------------------------
  // This hash scales the input DOWN before the first fract(), which is the
  // whole trick. The common "fract(p * vec2(123.34, 456.21))" form multiplies
  // up instead, so by the fifth fbm octave the lattice coordinate is in the
  // hundreds and the product is in the hundred-thousands -- past the point
  // where a 24-bit mantissa has fractional bits left. The visible symptom is
  // vertical streaks near the horizon, where the cloud-deck projection pushes
  // coordinates highest.
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      // Small per-octave offset keeps coordinates bounded; a large one is
      // what drives the hash into its bad range.
      p = p * 2.03 + vec2(0.71, 0.37);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    float up = max(h, 0.0);

    // --- atmosphere ----------------------------------------------------
    // Rayleigh-ish vertical gradient: saturated overhead, pale and hazy at
    // the horizon where the optical path through the atmosphere is longest.
    float grad = pow(1.0 - up, 3.2);
    vec3 sky = mix(uZenith, uHorizon, grad);

    // Mie forward scattering: a broad halo tight to the sun, plus a wide
    // brightening across the whole sunward half of the sky.
    float cosA = dot(dir, uSunDir);
    float halo = pow(max(cosA, 0.0), 180.0) * 0.55 + pow(max(cosA, 0.0), 8.0) * 0.16;
    sky += uSunColor * halo;

    // The sun itself. Soft-edged so it does not alias into a jagged dot.
    float disc = smoothstep(0.99965, 0.99992, cosA);
    sky += uSunColor * disc * 9.0;

    // --- clouds ---------------------------------------------------------
    // Project the view direction onto a flat cloud deck. The projection
    // stretches toward the horizon, so it is clamped hard and the deck is faded
    // out well before the skyline -- otherwise the stretch turns individual
    // cloud cells into vertical light shafts. A real deck vanishes into haze
    // near the horizon anyway.
    if (up > 0.005) {
      vec2 cp = dir.xz / max(up, 0.25) * uCloudScale;
      cp += vec2(uTime * 0.004, uTime * 0.0016);
      float n = fbm(cp);
      // Second, slower layer for depth.
      float n2 = fbm(cp * 0.42 + vec2(-uTime * 0.0015, 0.0));
      float d = n * 0.68 + n2 * 0.32;

      float cover = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.30, d);
      // Fade the deck out at the horizon so it does not form a hard ring.
      cover *= smoothstep(0.05, 0.30, up);

      // Light the cloud: bright where it faces the sun, grey-blue in shadow.
      float lit = 0.55 + 0.45 * max(cosA, 0.0);
      vec3 cloudLit = mix(vec3(0.55, 0.58, 0.65), vec3(1.02, 1.0, 0.97), lit);
      // A rim of brightness where the deck thins.
      cloudLit += uSunColor * pow(max(cosA, 0.0), 24.0) * 0.35 * (1.0 - cover);
      sky = mix(sky, cloudLit, cover * 0.93);
    }

    // Below the horizon, fade to the ground haze colour rather than showing
    // the underside of the dome.
    sky = mix(sky, uHorizon * 0.62, smoothstep(0.0, -0.10, h));

    gl_FragColor = vec4(sky * uExposure, 1.0);

    // A raw ShaderMaterial gets none of three's output pipeline for free.
    // Without these two chunks the sky is written as linear values straight
    // into an sRGB framebuffer -- which reads several stops too dark and, more
    // importantly, disagrees with every lit surface in the scene.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const SKY_PRESETS = {
  midday: {
    name: 'Midday',
    elevation: 58,
    azimuth: 138,
    sunColor: 0xfff3dd,
    zenith: 0x2a5ca8,
    horizon: 0xb8cbe0,
    cloudCover: 0.42,
    intensity: 3.1,
    ambient: 0.55,
    exposure: 1.0,
  },
  afternoon: {
    name: 'Afternoon',
    elevation: 26,
    azimuth: 252,
    sunColor: 0xffd9a0,
    zenith: 0x2f5f9c,
    horizon: 0xd8c4a8,
    cloudCover: 0.5,
    intensity: 2.5,
    ambient: 0.46,
    exposure: 1.02,
  },
  goldenHour: {
    name: 'Golden hour',
    elevation: 8.5,
    azimuth: 285,
    sunColor: 0xffb264,
    zenith: 0x2b4e86,
    horizon: 0xf0b078,
    cloudCover: 0.56,
    intensity: 1.85,
    ambient: 0.4,
    exposure: 1.06,
  },
  overcast: {
    name: 'Overcast',
    elevation: 42,
    azimuth: 165,
    sunColor: 0xdfe4ea,
    zenith: 0x6d7c8c,
    horizon: 0xa8b2bc,
    cloudCover: 0.93,
    intensity: 1.15,
    ambient: 0.78,
    exposure: 0.98,
  },
};

export class Sky {
  /** @param {number} radius should sit inside the camera's far plane */
  constructor(radius = 4200) {
    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xfff3dd) },
      uZenith: { value: new THREE.Color(0x2a5ca8) },
      uHorizon: { value: new THREE.Color(0xb8cbe0) },
      uTime: { value: 0 },
      uCloudCover: { value: 0.42 },
      uCloudScale: { value: 1.35 },
      uExposure: { value: 1 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: true,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), this.material);
    this.mesh.name = 'sky';
    // Drawn first, never occludes, never culled.
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;

    this.preset = SKY_PRESETS.midday;
  }

  /** Sun direction from elevation/azimuth in degrees. */
  static sunDirection(elevationDeg, azimuthDeg) {
    const el = THREE.MathUtils.degToRad(elevationDeg);
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    return new THREE.Vector3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az)
    ).normalize();
  }

  applyPreset(preset) {
    this.preset = preset;
    const dir = Sky.sunDirection(preset.elevation, preset.azimuth);
    this.uniforms.uSunDir.value.copy(dir);
    this.uniforms.uSunColor.value.setHex(preset.sunColor);
    this.uniforms.uZenith.value.setHex(preset.zenith);
    this.uniforms.uHorizon.value.setHex(preset.horizon);
    this.uniforms.uCloudCover.value = preset.cloudCover;
    this.uniforms.uExposure.value = preset.exposure;
    return dir;
  }

  /** Colour to use for fog and for the hemisphere light's sky term. */
  horizonColor() {
    return this.uniforms.uHorizon.value.clone();
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
  }

  /** Keep the dome centred on the camera so it never gets closer. */
  follow(camera) {
    this.mesh.position.copy(camera.position);
    this.mesh.updateMatrix();
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
