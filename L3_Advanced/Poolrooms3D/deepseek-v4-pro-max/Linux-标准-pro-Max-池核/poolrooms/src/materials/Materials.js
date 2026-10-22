// Materials: PBR surfaces for the poolrooms + matching G-buffer variants.
//
// Every world surface uses one of a small fixed set of material keys. For each key we build:
//   .std  : MeshStandardMaterial used in the forward lighting pass (IBL + sun + caustics + wetness)
//   .gbuf : GLSL3 MRT ShaderMaterial used in the depth/normal prepass, writing
//           location0 = (viewNormal.xyz, roughness), location1 = (albedo.rgb, metalness)
//
// The geometry builder bakes world-planar UVs (already divided by the material's worldScale) plus a
// per-face `aSurf` attribute = (causticMask, waterSurfaceY, wetness, tintJitter).

import * as THREE from 'three';
import { TextureFactory } from './TextureFactory.js';

export const MAT_KEYS = [
  'deckTile',
  'wallTile',
  'poolTile',
  'poolTileDeep',
  'concrete',
  'plaster',
  'coping',
  'metal',
];

// Shared GLSL: cheap animated caustics + tiny helpers, used by both the forward and gbuffer shaders.
export const CAUSTIC_GLSL = /* glsl */ `
// Layered "refracted sunlight" field. The domain must live in the classic mod(p*k, TAU) - 250
// window: that offset is what keeps the reciprocal term bounded, giving sparse bright filaments
// (numerically calibrated: mean ~0.06, p99 ~0.34, max ~0.67).
float causticField(vec2 world, float t, float freq) {
  vec2 p = mod(world * freq, 6.28318530718) - 250.0;
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.005;
  for (int n = 0; n < 3; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 3.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

// Two octaves at different scales/speeds so the 1.2 m period never reads as a repeating decal.
vec3 causticsAt(vec3 worldPos, float waterY, float time, vec3 tint) {
  float depth = max(0.0, waterY - worldPos.y);
  vec2 p = worldPos.xz;
  float a = causticField(p + vec2(0.0, depth * 0.22), time * 0.42, 5.2);
  float b = causticField(p * 0.55 - vec2(depth * 0.18, 0.0), time * 0.27 + 12.7, 3.1);
  float c = a * 0.85 + b * 0.6;
  // Sharpest just under the surface, diffusing with depth.
  float atten = exp(-depth * 0.30) * 0.55 + 0.45 * exp(-depth * 0.10);
  return tint * c * atten;
}
`;

const GBUF_VERT = /* glsl */ `
in vec3 position;
in vec3 normal;
in vec2 uv;
in vec4 aSurf;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

out vec2 vUv;
out vec3 vViewNormal;
out vec3 vViewPos;
out vec4 vSurf;

void main() {
  vUv = uv;
  vSurf = aSurf;
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const GBUF_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uMap;
uniform sampler2D uNormalMap;
uniform sampler2D uOrmMap;
uniform vec2 uNormalScale;
uniform float uRoughness;
uniform float uMetalness;
uniform vec3 uColor;

in vec2 vUv;
in vec3 vViewNormal;
in vec3 vViewPos;
in vec4 vSurf;

layout(location = 0) out vec4 gNormalRough;
layout(location = 1) out vec4 gAlbedoMetal;

// Derivative tangent frame (matches three.js' normal mapping when no tangent attribute exists).
mat3 tbn(vec3 n, vec3 p, vec2 uv) {
  vec3 dp1 = dFdx(p);
  vec3 dp2 = dFdy(p);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, n);
  vec3 dp1perp = cross(n, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-8);
  return mat3(T * invmax, B * invmax, n);
}

void main() {
  vec3 n = normalize(vViewNormal);
  vec3 mapN = texture(uNormalMap, vUv).xyz * 2.0 - 1.0;
  mapN.xy *= uNormalScale;
  n = normalize(tbn(n, vViewPos, vUv) * mapN);

  vec4 orm = texture(uOrmMap, vUv);
  float rough = clamp(orm.g * uRoughness, 0.02, 1.0);
  rough = mix(rough, 0.035, vSurf.z); // wet surfaces go mirror-smooth
  vec3 albedo = texture(uMap, vUv).rgb * uColor * mix(1.0, 0.66, vSurf.z) * vSurf.w;

  gNormalRough = vec4(n, rough);
  gAlbedoMetal = vec4(albedo, orm.b * uMetalness);
}
`;

// Texture-free G-buffer variant (lamps and any other untextured fixture).
const GBUF_FRAG_FLAT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uRoughness;
uniform float uMetalness;
in vec2 vUv;
in vec3 vViewNormal;
in vec3 vViewPos;
in vec4 vSurf;
layout(location = 0) out vec4 gNormalRough;
layout(location = 1) out vec4 gAlbedoMetal;
void main() {
  gNormalRough = vec4(normalize(vViewNormal), clamp(uRoughness, 0.02, 1.0));
  gAlbedoMetal = vec4(uColor, uMetalness);
}
`;

// Per-key tuning on top of the baked texture sets.
const TUNE = {
  deckTile: { color: 0xffffff, rough: 1.0, metal: 1.0, normalScale: 0.85, env: 1.0 },
  wallTile: { color: 0xffffff, rough: 1.0, metal: 1.0, normalScale: 0.7, env: 1.05 },
  poolTile: { color: 0xffffff, rough: 1.0, metal: 1.0, normalScale: 0.9, env: 1.1 },
  poolTileDeep: { color: 0xffffff, rough: 1.0, metal: 1.0, normalScale: 0.9, env: 1.1 },
  concrete: { color: 0xffffff, rough: 1.0, metal: 1.0, normalScale: 1.0, env: 0.9 },
  plaster: { color: 0xffffff, rough: 1.0, metal: 1.0, normalScale: 1.0, env: 0.9 },
  coping: { color: 0xffffff, rough: 1.0, metal: 1.0, normalScale: 1.0, env: 0.95 },
  metal: { color: 0xffffff, rough: 1.0, metal: 1.0, normalScale: 1.0, env: 1.2 },
};

export class MaterialLibrary {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.factory = new TextureFactory(renderer, {
      size: opts.textureSize || 1024,
      anisotropy: opts.anisotropy || 8,
    });
    this.time = { value: 0 };
    this.causticStrength = { value: 1.0 };
    this.causticColor = { value: new THREE.Color(0.62, 0.86, 0.95) };
    this.sets = new Map();
    this.materials = new Map();
    this.forwardMaterials = [];
    this._build();
    // All baking happens here at load time; hand the scratch buffer back to the driver.
    this.factory.releaseScratch?.();
  }

  _build() {
    this._buildLamp();
    for (const key of MAT_KEYS) {
      const set = this.factory.bake(key);
      this.sets.set(key, set);
      const tune = TUNE[key];

      const std = new THREE.MeshStandardMaterial({
        color: tune.color,
        map: set.map,
        normalMap: set.normalMap,
        aoMap: set.ormMap,
        roughnessMap: set.ormMap,
        metalnessMap: set.ormMap,
        roughness: (set.params?.roughness ?? 1.0) * tune.rough,
        metalness: (set.params?.metalness ?? 1.0) * tune.metal,
        normalScale: new THREE.Vector2(1, 1).multiplyScalar(
          (set.params?.normalScale ?? 1.0) * tune.normalScale,
        ),
        envMapIntensity: tune.env,
        dithering: true,
      });
      std.name = key;
      this._patchForward(std, key);

      const gbuf = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: {
          uMap: { value: set.map },
          uNormalMap: { value: set.normalMap },
          uOrmMap: { value: set.ormMap },
          uNormalScale: {
            value: new THREE.Vector2(1, 1).multiplyScalar(
              (set.params?.normalScale ?? 1.0) * tune.normalScale,
            ),
          },
          uRoughness: { value: (set.params?.roughness ?? 1.0) * tune.rough },
          uMetalness: { value: (set.params?.metalness ?? 1.0) * tune.metal },
          uColor: { value: new THREE.Color(tune.color) },
        },
        vertexShader: GBUF_VERT,
        fragmentShader: GBUF_FRAG,
      });
      gbuf.name = key + ':gbuf';

      this.materials.set(key, { std, gbuf, worldScale: set.worldScale });
    }
  }

  /** Emissive fixture material for pillar lamps (no baked maps needed). */
  _buildLamp() {
    const std = new THREE.MeshStandardMaterial({
      color: 0x22262a,
      emissive: new THREE.Color(1.0, 0.86, 0.68),
      emissiveIntensity: 6.0,
      roughness: 0.35,
      metalness: 0.0,
    });
    std.name = 'lamp';
    const gbuf = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uMap: { value: null },
        uNormalMap: { value: null },
        uOrmMap: { value: null },
        uNormalScale: { value: new THREE.Vector2(0, 0) },
        uRoughness: { value: 0.35 },
        uMetalness: { value: 0.0 },
        uColor: { value: new THREE.Color(1.0, 0.9, 0.78) },
      },
      vertexShader: GBUF_VERT,
      fragmentShader: GBUF_FRAG_FLAT,
    });
    gbuf.name = 'lamp:gbuf';
    this.materials.set('lamp', { std, gbuf, worldScale: 1.0 });
  }

  // Inject wetness, per-face tint and underwater caustics into MeshStandardMaterial.
  //
  // NOTE: three computes `outgoingLight` *before* <opaque_fragment>, so light added to
  // totalEmissiveRadiance at that point is discarded. We add to outgoingLight instead, and assert
  // that every single replacement actually matched.
  _patchForward(mat, key) {
    const inject = (src, needle, replacement, tag) => {
      if (src.indexOf(needle) === -1) {
        console.error(`[poolrooms] shader injection failed for ${key}: ${tag} (missing ${needle})`);
        return src;
      }
      return src.replace(needle, replacement);
    };

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.time;
      shader.uniforms.uCausticStrength = this.causticStrength;
      shader.uniforms.uCausticColor = this.causticColor;

      let v = shader.vertexShader;
      v = inject(
        v,
        '#include <common>',
        `#include <common>
         in vec4 aSurf;
         out vec4 vSurf;
         out vec3 vWorldPosition2;`,
        'vertex decls',
      );
      v = inject(
        v,
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vSurf = aSurf;
         vWorldPosition2 = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        'vertex body',
      );
      shader.vertexShader = v;

      let f = shader.fragmentShader;
      f = inject(
        f,
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uCausticStrength;
         uniform vec3 uCausticColor;
         in vec4 vSurf;
         in vec3 vWorldPosition2;
         ${CAUSTIC_GLSL}`,
        'fragment decls',
      );
      f = inject(
        f,
        '#include <map_fragment>',
        `#include <map_fragment>
         // Per-face tint breaks up tiling; wet surfaces darken and cool down.
         diffuseColor.rgb *= vSurf.w;
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.60, 0.70, 0.74), vSurf.z);`,
        'albedo wetness',
      );
      f = inject(
        f,
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.035, vSurf.z);`,
        'roughness wetness',
      );
      f = inject(
        f,
        '#include <opaque_fragment>',
        `// --- refracted sunlight (caustics) on submerged surfaces ----------------------
         if (vSurf.x > 0.5) {
           float submergedFace = step(vWorldPosition2.y, vSurf.y);
           vec3 caus = causticsAt(vWorldPosition2, vSurf.y, uTime, uCausticColor);
           float up = clamp(normal.y * 0.5 + 0.5, 0.25, 1.0);
           outgoingLight += caus * uCausticStrength * up * submergedFace * diffuseColor.rgb * 1.6;
         }
         #include <opaque_fragment>`,
        'caustics',
      );
      shader.fragmentShader = f;
    };
    mat.customProgramCacheKey = () => 'poolrooms-forward-' + key;
    this.forwardMaterials.push(mat);
  }

  get(key) {
    return this.materials.get(key) || this.materials.get('concrete');
  }

  worldScale(key) {
    const s = this.sets.get(key);
    return s ? s.worldScale : 2.0;
  }

  setEnvironment(envMap, intensity = 1.0) {
    for (const key of MAT_KEYS) {
      const m = this.materials.get(key);
      if (!m) continue;
      m.std.envMap = envMap;
      m.std.envMapIntensity = (TUNE[key]?.env ?? 1.0) * intensity;
      m.std.needsUpdate = true;
    }
  }

  update(elapsed) {
    this.time.value = elapsed;
  }

  dispose() {
    for (const m of this.materials.values()) {
      m.std.dispose();
      m.gbuf.dispose();
    }
    this.factory.dispose();
  }
}
