import * as THREE from "three";
import { buildAtlas, TILE } from "./textures";

export function createAtlasTexture(): THREE.DataArrayTexture {
  const a = buildAtlas();
  const tex = new THREE.DataArrayTexture(a.data, TILE, TILE, a.layers);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `
in float aLayer;
in vec3 aLight;
out vec2 vUv;
out float vLayer;
out vec3 vLight;
out float vFogDepth;
void main() {
  vUv = uv;
  vLayer = aLayer;
  vLight = aLight;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uAtlas;
uniform float uDay;
uniform vec3 uSkyTint;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform float uAlpha;
in vec2 vUv;
in float vLayer;
in vec3 vLight;
in float vFogDepth;
out vec4 outColor;
float bright(float l) { return l / (4.0 - 3.0 * l); }
void main() {
  vec2 uv = vUv;
  #ifdef LIQUID
  uv.y += uTime * 0.04;
  uv.x += sin(uTime * 0.5) * 0.02;
  #endif
  vec4 tex = texture(uAtlas, vec3(uv, vLayer));
  #ifndef LIQUID
  if (tex.a < 0.5) discard;
  #endif
  float s = bright(clamp(vLight.x * uDay, 0.0, 1.0));
  float b = bright(clamp(vLight.y, 0.0, 1.0));
  vec3 skyCol = uSkyTint * s;
  vec3 torchCol = vec3(1.0, 0.83, 0.62) * b;
  vec3 light = max(skyCol, torchCol);
  light = max(light, vec3(0.035));
  vec3 col = tex.rgb * light * vLight.z;
  float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
  col = mix(col, uFogColor, fog);
  outColor = vec4(col, tex.a * uAlpha);
}
`;

export interface WorldUniforms {
  uAtlas: { value: THREE.DataArrayTexture };
  uDay: { value: number };
  uSkyTint: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogNear: { value: number };
  uFogFar: { value: number };
  uTime: { value: number };
  uAlpha: { value: number };
}

export function createWorldMaterials(atlas: THREE.DataArrayTexture) {
  const uniforms: WorldUniforms = {
    uAtlas: { value: atlas },
    uDay: { value: 1 },
    uSkyTint: { value: new THREE.Color(1, 1, 1) },
    uFogColor: { value: new THREE.Color(0.7, 0.82, 1) },
    uFogNear: { value: 60 },
    uFogFar: { value: 96 },
    uTime: { value: 0 },
    uAlpha: { value: 1 },
  };
  const solid = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    side: THREE.FrontSide,
  });
  const liquidUniforms = { ...uniforms, uAlpha: { value: 1.0 } };
  const liquid = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: liquidUniforms as unknown as Record<string, THREE.IUniform>,
    defines: { LIQUID: 1 },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  return { solid, liquid, uniforms };
}

// ---------------- Entity (items) material: per-object light uniforms ----------------
const ENT_VERT = /* glsl */ `
in float aLayer;
in float aShade;
out vec2 vUv;
out float vLayer;
out float vShade;
out float vFogDepth;
void main() {
  vUv = uv;
  vLayer = aLayer;
  vShade = aShade;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const ENT_FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uAtlas;
uniform float uDay;
uniform vec3 uSkyTint;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uSky;
uniform float uBlock;
uniform vec3 uTint;
in vec2 vUv;
in float vLayer;
in float vShade;
in float vFogDepth;
out vec4 outColor;
float bright(float l) { return l / (4.0 - 3.0 * l); }
void main() {
  vec4 tex = texture(uAtlas, vec3(vUv, vLayer));
  if (tex.a < 0.5) discard;
  float s = bright(clamp(uSky * uDay, 0.0, 1.0));
  float b = bright(clamp(uBlock, 0.0, 1.0));
  vec3 light = max(uSkyTint * s, vec3(1.0, 0.83, 0.62) * b);
  light = max(light, vec3(0.035));
  vec3 col = tex.rgb * light * vShade * uTint;
  float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
  col = mix(col, uFogColor, fog);
  outColor = vec4(col, 1.0);
}
`;
export function createEntityMaterial(shared: WorldUniforms) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: ENT_VERT,
    fragmentShader: ENT_FRAG,
    uniforms: {
      uAtlas: shared.uAtlas,
      uDay: shared.uDay,
      uSkyTint: shared.uSkyTint,
      uFogColor: shared.uFogColor,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uSky: { value: 1 },
      uBlock: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
    },
    side: THREE.DoubleSide,
  });
}

// ---------------- Sky ----------------
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // push to far plane
}
`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform float uSunset;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -1.0, 1.0);
  float t = pow(clamp(h, 0.0, 1.0), 0.55);
  vec3 col = mix(uHorizon, uTop, t);
  if (h < 0.0) col = mix(uHorizon, uHorizon * 0.55, clamp(-h * 3.0, 0.0, 1.0));
  // sunset glow around the sun direction near the horizon
  float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  float glow = pow(sd, 6.0) * uSunset * (1.0 - clamp(abs(h) * 3.0, 0.0, 1.0));
  col = mix(col, vec3(1.0, 0.55, 0.25), glow * 0.8);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  group = new THREE.Group();
  dome: THREE.Mesh;
  sun: THREE.Mesh;
  moon: THREE.Mesh;
  stars: THREE.Points;
  clouds: THREE.Mesh;
  pivot = new THREE.Group();
  skyUniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uSunset: { value: 0 },
  };
  cloudTex: THREE.CanvasTexture;

  constructor() {
    const domeMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    const sunTex = makeSunTexture();
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), sunMat);
    this.sun.position.set(400, 0, 0);
    this.sun.lookAt(0, 0, 0);
    this.sun.renderOrder = -9;
    const moonTex = makeMoonTexture();
    const moonMat = new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), moonMat);
    this.moon.position.set(-400, 0, 0);
    this.moon.lookAt(0, 0, 0);
    this.moon.renderOrder = -9;
    this.pivot.add(this.sun, this.moon);

    // stars
    const starPos: number[] = [];
    const rnd = mulberry(1234);
    for (let i = 0; i < 900; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      starPos.push(Math.cos(th) * r * 450, u * 450, Math.sin(th) * r * 450);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    const sm = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, sm);
    this.stars.renderOrder = -9;
    this.pivot.add(this.stars);
    this.group.add(this.pivot);

    // clouds
    this.cloudTex = makeCloudTexture();
    const cloudMat = new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false, side: THREE.DoubleSide, color: 0xffffff });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 138;
    this.clouds.renderOrder = -5;
    this.clouds.frustumCulled = false;
    this.group.add(this.clouds);
  }

  /** time: 0..1 (0 = sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight) */
  update(time: number, cam: THREE.Vector3, elapsed: number) {
    this.group.position.set(cam.x, cam.y, cam.z);
    this.clouds.position.set(0, 138 - cam.y, 0);
    const ang = time * Math.PI * 2;
    this.pivot.rotation.z = ang;
    const sunY = Math.sin(ang);
    const day = smooth(-0.12, 0.18, sunY);
    const sunset = (1 - smooth(0.05, 0.3, Math.abs(sunY))) * smooth(-0.35, 0.0, sunY);
    const dayTop = new THREE.Color(0x4d8ee6), dayHor = new THREE.Color(0xbcd6f7);
    const nightTop = new THREE.Color(0x03050f), nightHor = new THREE.Color(0x0a0f22);
    const setTop = new THREE.Color(0x3d5f9e), setHor = new THREE.Color(0xf0966a);
    const top = nightTop.clone().lerp(dayTop, day).lerp(setTop, sunset * 0.5);
    const hor = nightHor.clone().lerp(dayHor, day).lerp(setHor, sunset * 0.7);
    this.skyUniforms.uTop.value.copy(top);
    this.skyUniforms.uHorizon.value.copy(hor);
    this.skyUniforms.uSunDir.value.set(Math.cos(ang), Math.sin(ang), 0);
    this.skyUniforms.uSunset.value = sunset;
    (this.stars.material as THREE.PointsMaterial).opacity = (1 - day) * 0.9;
    (this.clouds.material as THREE.MeshBasicMaterial).color.setScalar(0.25 + 0.75 * day);
    const cm = this.clouds.material as THREE.MeshBasicMaterial;
    if (cm.map) {
      const rx = cm.map.repeat.x, ry = cm.map.repeat.y;
      cm.map.offset.set((cam.x / 2400) * rx + elapsed * 0.0018, (-cam.z / 2400) * ry);
    }
    return { day, horizon: hor, top, sunset };
  }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeSunTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
  g.addColorStop(0, "rgba(255,250,220,1)");
  g.addColorStop(0.45, "rgba(255,240,180,0.95)");
  g.addColorStop(0.6, "rgba(255,200,120,0.35)");
  g.addColorStop(1, "rgba(255,180,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "rgba(255,252,230,1)";
  ctx.fillRect(18, 18, 28, 28);
  const t = new THREE.CanvasTexture(c);
  return t;
}
function makeMoonTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#dfe6f2";
  ctx.fillRect(6, 6, 20, 20);
  ctx.fillStyle = "#b8c2d6";
  for (const [x, y, s] of [[9, 9, 4], [17, 12, 3], [12, 18, 5], [20, 20, 3]]) ctx.fillRect(x, y, s, s);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}
function makeCloudTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const rnd = mulberry(99);
  const grid: number[] = [];
  const G = 16;
  for (let i = 0; i < G * G; i++) grid.push(rnd());
  const sample = (x: number, y: number) => {
    const gx = Math.floor(x), gy = Math.floor(y);
    const fx = x - gx, fy = y - gy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const g = (a: number, b: number) => grid[(((a % G) + G) % G) * G + (((b % G) + G) % G)];
    const a = g(gx, gy), b = g(gx + 1, gy), cc = g(gx, gy + 1), d = g(gx + 1, gy + 1);
    return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = sample(x / 8, y / 8) * 0.6 + sample(x / 4 + 5, y / 4 + 5) * 0.4;
      const i = (y * size + x) * 4;
      const on = n > 0.56;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = on ? 255 : 0;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2400 / (size * 12), 2400 / (size * 12));
  return t;
}
