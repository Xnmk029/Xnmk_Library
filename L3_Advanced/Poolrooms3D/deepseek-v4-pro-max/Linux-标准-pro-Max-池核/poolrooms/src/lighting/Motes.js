// Motes: drifting dust/spore particles that only light up inside the sun shafts.
//
// The particles sample the sun's shadow map in the vertex shader, so they glow when they drift
// through a skylight beam and nearly vanish elsewhere. They wrap around the player, so a small fixed
// particle count covers an infinite world.

import * as THREE from 'three';

const VERT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uPlayer;
uniform vec3 uVolume;      // half extents of the wrapping box
uniform mat4 uShadowMatrix;
uniform sampler2D uShadowMap;
uniform float uPixelRatio;
uniform float uSize;

attribute vec3 aSeed;      // (phase, sizeScale, driftScale)

varying float vLit;
varying float vFade;

float unpackDepth(vec4 v) {
  return dot(v, vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0));
}

void main() {
  // Slow turbulent drift.
  float t = uTime * 0.06 + aSeed.x * 40.0;
  vec3 drift = vec3(
    sin(t * 1.7 + aSeed.x * 6.28) * 0.9,
    sin(t * 0.9 + aSeed.y * 6.28) * 0.5 + uTime * 0.012 * aSeed.z,
    cos(t * 1.3 + aSeed.z * 6.28) * 0.9
  );

  // Wrap the cloud around the player so a fixed budget covers everywhere.
  vec3 p = position + drift;
  vec3 rel = p - uPlayer;
  rel = mod(rel + uVolume, uVolume * 2.0) - uVolume;
  vec3 world = uPlayer + rel;

  // Sunlit test straight from the shadow map.
  vec4 sc = uShadowMatrix * vec4(world, 1.0);
  sc.xyz /= sc.w;
  float lit = 1.0;
  if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) {
    float ref = unpackDepth(texture2D(uShadowMap, sc.xy));
    lit = sc.z - 0.002 <= ref ? 1.0 : 0.0;
  }
  vLit = lit;

  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  float dist = -mv.z;
  // Fade in the distance and very close to the camera.
  vFade = smoothstep(0.4, 1.6, dist) * (1.0 - smoothstep(24.0, 46.0, dist));

  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aSeed.y * uPixelRatio * (12.0 / max(dist, 0.6));
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform float uOpacity;

varying float vLit;
varying float vFade;

void main() {
  // Soft round sprite.
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float alpha = smoothstep(0.25, 0.0, r);

  vec3 col = uAmbient * 0.35 + uSunColor * vLit;
  gl_FragColor = vec4(col, alpha * vFade * uOpacity * (0.25 + 0.75 * vLit));
}
`;

export class Motes {
  constructor({ scene, count = 2200, volume = [26, 5.5, 26] }) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * volume[0];
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * volume[1];
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * volume[2];
      seed[i * 3] = Math.random();
      seed[i * 3 + 1] = 0.45 + Math.random() * 1.15;
      seed[i * 3 + 2] = 0.4 + Math.random() * 1.6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); // never cull

    this.uniforms = {
      uTime: { value: 0 },
      uPlayer: { value: new THREE.Vector3() },
      uVolume: { value: new THREE.Vector3(...volume) },
      uShadowMatrix: { value: new THREE.Matrix4() },
      uShadowMap: { value: null },
      uPixelRatio: { value: 1 },
      uSize: { value: 1.35 },
      uSunColor: { value: new THREE.Color(1.0, 0.93, 0.82) },
      uAmbient: { value: new THREE.Color(0.35, 0.45, 0.5) },
      uOpacity: { value: 0.55 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20; // after the water surfaces
    this.points.name = 'motes';
    scene.add(this.points);
  }

  update(time, playerPos, sun, pixelRatio, ambient) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uPlayer.value.copy(playerPos);
    u.uPixelRatio.value = pixelRatio;
    if (sun.shadow.map) {
      u.uShadowMap.value = sun.shadow.map.texture;
      u.uShadowMatrix.value.copy(sun.shadow.matrix);
    }
    if (ambient) u.uAmbient.value.setRGB(ambient.x, ambient.y, ambient.z);
  }

  setVisible(v) {
    this.points.visible = v;
  }
}
