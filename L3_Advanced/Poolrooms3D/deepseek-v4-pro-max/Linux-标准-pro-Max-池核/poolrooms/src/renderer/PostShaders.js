// Post-processing shader library.
//
// Pass order (see Pipeline.js):
//   gbuffer -> forward -> water -> SSGI/SSR -> volumetric fog -> resolve -> TAA -> bloom -> final
//
// Everything reconstructs view/world position from the depth buffer, so the passes are all
// fullscreen quads with no geometry cost.

export const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FS_VERT_GLSL3 = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Shared helpers (GLSL1 + GLSL3 compatible: no texture()/texture2D() calls inside).
export const HELPERS = /* glsl */ `
#ifndef PI
#define PI 3.141592653589793
#endif

float linearizeDepth(float d, float near, float far) {
  // Returns positive view-space distance along -Z.
  return (2.0 * near * far) / (far + near - (d * 2.0 - 1.0) * (far - near));
}

vec3 viewPosFromDepth(vec2 uv, float viewZ, mat4 invProj) {
  vec4 clip = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  vec3 ray = (invProj * clip).xyz;
  ray /= ray.z;
  return ray * viewZ;
}

float unpackRGBAToDepth01(vec4 v) {
  const vec4 bitSh = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
  return dot(v, bitSh);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

float vnoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash33(i + vec3(0, 0, 0)).x;
  float n100 = hash33(i + vec3(1, 0, 0)).x;
  float n010 = hash33(i + vec3(0, 1, 0)).x;
  float n110 = hash33(i + vec3(1, 1, 0)).x;
  float n001 = hash33(i + vec3(0, 0, 1)).x;
  float n101 = hash33(i + vec3(1, 0, 1)).x;
  float n011 = hash33(i + vec3(0, 1, 1)).x;
  float n111 = hash33(i + vec3(1, 1, 1)).x;
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

// Hemisphere ambient probe: cheap stand-in for the far-field irradiance.
vec3 ambientProbe(vec3 dir, vec3 up, vec3 horizon, vec3 down) {
  float t = dir.y;
  vec3 c = t > 0.0 ? mix(horizon, up, t) : mix(horizon, down, -t);
  return c;
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

export const COPY_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(tSrc, vUv); }
`;

// ------------------------------------------------------------------------------------------------
// Screen-space GI + AO + reflections. Half resolution, MRT:
//   out0 = (indirect diffuse radiance, ambient occlusion)
//   out1 = (reflection radiance, confidence)
// ------------------------------------------------------------------------------------------------
export const SSGI_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tColor;      // scene colour (with water), full res
uniform sampler2D tNormalRough;
uniform sampler2D tAlbedoMetal;
uniform sampler2D tDepth;
uniform mat4 uProj;
uniform mat4 uInvProj;
uniform mat4 uViewInv;
uniform vec2 uRes;             // half-res target size
uniform float uNear;
uniform float uFar;
uniform float uFrame;
uniform int uRays;
uniform int uSteps;
uniform int uSsrSteps;
uniform float uRadius;
uniform vec3 uAmbUp;
uniform vec3 uAmbHorizon;
uniform vec3 uAmbDown;
uniform float uGiScale;

in vec2 vUv;
layout(location = 0) out vec4 outGi;
layout(location = 1) out vec4 outSsr;

${HELPERS}

float depthAt(vec2 uv) { return texture(tDepth, uv).x; }

float viewZAt(vec2 uv) {
  float d = depthAt(uv);
  if (d >= 1.0) return -uFar * 8.0;
  return -linearizeDepth(d, uNear, uFar);
}

// March a ray in view space against the depth buffer. Returns hit uv (.xy), hit flag (.z), t (.w)
vec4 marchRay(vec3 origin, vec3 dir, int steps, float stride, float growth, float thickness, float jitter) {
  vec3 p = origin;
  float step0 = stride * (0.6 + jitter * 0.8);
  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    float adv = step0 * pow(growth, float(i));
    p += dir * adv;
    if (p.z > -uNear) return vec4(0.0);
    vec4 clip = uProj * vec4(p, 1.0);
    vec2 uv = (clip.xy / clip.w) * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    float sceneZ = viewZAt(uv);
    float diff = p.z - sceneZ;
    if (diff > 0.015 && diff < thickness + adv * 1.2) {
      return vec4(uv, 1.0, length(p - origin));
    }
  }
  return vec4(0.0);
}

void main() {
  float d = depthAt(vUv);
  if (d >= 1.0) {
    outGi = vec4(0.0, 0.0, 0.0, 1.0);
    outSsr = vec4(0.0);
    return;
  }

  float viewZ = -linearizeDepth(d, uNear, uFar);
  vec3 viewPos = viewPosFromDepth(vUv, viewZ, uInvProj);
  vec4 nr = texture(tNormalRough, vUv);
  vec3 N = normalize(nr.xyz);
  float rough = clamp(nr.w, 0.02, 1.0);
  vec4 am = texture(tAlbedoMetal, vUv);
  float metal = am.w;

  vec3 V = normalize(-viewPos);
  float rnd = hash12(vUv * uRes + vec2(uFrame * 7.13, uFrame * 3.71));

  // ---- diffuse GI + AO -------------------------------------------------------------------------
  vec3 gi = vec3(0.0);
  float occl = 0.0;
  int rays = uRays;

  // Build a tangent frame.
  vec3 T = normalize(abs(N.z) < 0.9 ? cross(vec3(0.0, 0.0, 1.0), N) : cross(vec3(1.0, 0.0, 0.0), N));
  vec3 B = cross(N, T);

  for (int r = 0; r < 12; r++) {
    if (r >= rays) break;
    float a1 = fract(rnd + float(r) * 0.61803398875);
    float a2 = fract(rnd * 1.61803398875 + float(r) * 0.38196601125);
    // Cosine-weighted hemisphere sample.
    float phi = 2.0 * PI * a1;
    float cosT = sqrt(1.0 - a2);
    float sinT = sqrt(a2);
    vec3 dir = normalize(T * (cos(phi) * sinT) + B * (sin(phi) * sinT) + N * cosT);

    vec4 hit = marchRay(viewPos + N * 0.035, dir, uSteps, uRadius * 0.16, 1.42, 0.6, a2);
    if (hit.z > 0.5) {
      vec3 c = texture(tColor, hit.xy).rgb;
      float fall = 1.0 / (1.0 + hit.w * hit.w * 0.09);
      gi += c * fall;
      occl += min(1.0, 1.6 / (1.0 + hit.w * hit.w * 1.4));
    } else {
      vec3 wdir = (uViewInv * vec4(dir, 0.0)).xyz;
      gi += ambientProbe(wdir, uAmbUp, uAmbHorizon, uAmbDown) * 0.35;
    }
  }
  float inv = 1.0 / float(max(rays, 1));
  gi *= inv * uGiScale;
  float ao = clamp(1.0 - occl * inv, 0.0, 1.0);

  // ---- specular reflection ---------------------------------------------------------------------
  vec3 ssrCol = vec3(0.0);
  float conf = 0.0;
  if (rough < 0.62) {
    vec3 R = reflect(-V, N);
    // Roughness cone jitter keeps rough surfaces from looking like mirrors.
    vec3 jit = (hash33(vec3(vUv * uRes, uFrame)) - 0.5) * rough * rough * 2.6;
    R = normalize(R + jit);
    vec4 hit = marchRay(viewPos + N * 0.03, R, uSsrSteps, 0.20, 1.16, 0.55, rnd);
    if (hit.z > 0.5) {
      vec2 uvh = hit.xy;
      float edge = smoothstep(0.0, 0.12, min(min(uvh.x, 1.0 - uvh.x), min(uvh.y, 1.0 - uvh.y)));
      ssrCol = texture(tColor, uvh).rgb;
      conf = edge * (1.0 - smoothstep(0.35, 0.62, rough));
    }
  }

  outGi = vec4(max(gi, vec3(0.0)), ao);
  outSsr = vec4(max(ssrCol, vec3(0.0)), conf * (0.25 + 0.75 * (1.0 - metal * 0.0)));
}
`;

// ------------------------------------------------------------------------------------------------
// Volumetric fog / god rays. Half resolution: rgb = in-scattered light, a = transmittance.
// ------------------------------------------------------------------------------------------------
export const FOG_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tDepth;
uniform sampler2D tShadow;
uniform mat4 uShadowMatrix;
uniform mat4 uInvProj;
uniform mat4 uViewInv;
uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbUp;
uniform vec3 uAmbHorizon;
uniform vec3 uAmbDown;
uniform float uNear;
uniform float uFar;
uniform float uTime;
uniform float uFrame;
uniform int uSteps;
uniform float uDensity;
uniform float uHeightFalloff;
uniform float uMistY;
uniform float uAnisotropy;
uniform float uUnderwater;
uniform float uMaxDist;
uniform vec2 uRes;

varying vec2 vUv;

${HELPERS}

float hgPhase(float cosT, float g) {
  float gg = g * g;
  return (1.0 - gg) / (4.0 * PI * pow(1.0 + gg - 2.0 * g * cosT, 1.5));
}

float shadowAt(vec3 worldPos) {
  vec4 sc = uShadowMatrix * vec4(worldPos, 1.0);
  sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  float ref = unpackRGBAToDepth01(texture2D(tShadow, sc.xy));
  return sc.z - 0.0012 <= ref ? 1.0 : 0.0;
}

float densityAt(vec3 p) {
  float h = exp(-max(0.0, p.y - uMistY) * uHeightFalloff);
  // Slowly drifting mist so the volume is never static.
  float n = vnoise3(p * 0.09 + vec3(uTime * 0.013, uTime * 0.007, -uTime * 0.011));
  float n2 = vnoise3(p * 0.31 - vec3(uTime * 0.02, 0.0, uTime * 0.017));
  float f = 0.62 + 0.55 * n + 0.22 * n2;
  return uDensity * h * f;
}

void main() {
  float d = texture2D(tDepth, vUv).x;
  float sceneDist = d >= 1.0 ? uMaxDist : linearizeDepth(d, uNear, uFar);
  sceneDist = min(sceneDist, uMaxDist);

  vec3 viewPos = viewPosFromDepth(vUv, -1.0, uInvProj);
  vec3 rayDirW = normalize((uViewInv * vec4(normalize(viewPos), 0.0)).xyz);

  int steps = uSteps;
  float jitter = hash12(vUv * uRes + vec2(uFrame * 1.37, uFrame * 2.71));
  float segment = sceneDist / float(steps);

  float cosT = dot(rayDirW, uSunDir);
  float phase = hgPhase(cosT, uAnisotropy);       // integrates to 1 over the sphere
  float ambPhase = 0.42;                          // isotropic-ish ambient in-scatter

  vec3 inscatter = vec3(0.0);
  float transmittance = 1.0;
  vec3 ambient = ambientProbe(vec3(0.0, 0.6, 0.0), uAmbUp, uAmbHorizon, uAmbDown);

  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    float t = segment * (float(i) + jitter);
    vec3 p = uCameraPos + rayDirW * t;
    float dens = densityAt(p);
    if (dens < 1e-5) continue;
    float sigma = dens * segment;
    float shadow = shadowAt(p);
    // uSunColor carries the sun irradiance; ambient is a radiance, so it needs no phase term.
    vec3 light = uSunColor * shadow * phase + ambient * ambPhase;
    vec3 s = light * dens * segment;
    inscatter += transmittance * s;
    transmittance *= exp(-sigma * (1.0 + uUnderwater * 1.2));
    if (transmittance < 0.004) break;
  }

  gl_FragColor = vec4(inscatter, transmittance);
}
`;

// ------------------------------------------------------------------------------------------------
// Resolve: composite GI/AO/SSR/fog onto the lit scene, plus underwater absorption.
// ------------------------------------------------------------------------------------------------
export const RESOLVE_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tScene;
uniform sampler2D tGi;
uniform sampler2D tSsr;
uniform sampler2D tFog;
uniform sampler2D tAlbedoMetal;
uniform sampler2D tNormalRough;
uniform sampler2D tDepth;      // opaque depth
uniform sampler2D tDepthAll;   // depth including water
uniform mat4 uInvProj;
uniform vec2 uRes;
uniform vec2 uHalfRes;
uniform float uNear;
uniform float uFar;
uniform float uTapSpread;
uniform float uAo;
uniform float uGi;
uniform float uSsr;
uniform float uFogOn;
uniform float uUnderwater;
uniform vec3 uWaterAbsorb;
uniform vec3 uWaterScatter;
uniform float uWaterSurfaceY;
uniform vec3 uCameraPos;

varying vec2 vUv;

${HELPERS}

// Depth-aware bilateral upsample of the half-res buffers, 4 taps with weights shared between the
// GI and reflection buffers (halves the texture traffic of this full-res pass).
struct Taps {
  vec2 uv0; vec2 uv1; vec2 uv2; vec2 uv3;
  float w0; float w1; float w2; float w3; float wsum;
};

Taps buildTaps(vec2 uv, float centerZ, vec3 centerN) {
  // The taps double as the spatial denoiser for the noisy half-res GI/SSR buffers: spreading them
  // past one texel filters ray noise, while depth+normal weights stop light bleeding across edges.
  vec2 o = (1.0 / uHalfRes) * uTapSpread;
  Taps t;
  t.uv0 = uv + vec2(-o.x, -o.y);
  t.uv1 = uv + vec2(o.x, -o.y);
  t.uv2 = uv + vec2(-o.x, o.y);
  t.uv3 = uv + vec2(o.x, o.y);
  float d0 = texture2D(tDepth, t.uv0).x;
  float d1 = texture2D(tDepth, t.uv1).x;
  float d2 = texture2D(tDepth, t.uv2).x;
  float d3 = texture2D(tDepth, t.uv3).x;
  float z0 = d0 >= 1.0 ? uFar : linearizeDepth(d0, uNear, uFar);
  float z1 = d1 >= 1.0 ? uFar : linearizeDepth(d1, uNear, uFar);
  float z2 = d2 >= 1.0 ? uFar : linearizeDepth(d2, uNear, uFar);
  float z3 = d3 >= 1.0 ? uFar : linearizeDepth(d3, uNear, uFar);
  vec3 n0 = normalize(texture2D(tNormalRough, t.uv0).xyz);
  vec3 n1 = normalize(texture2D(tNormalRough, t.uv1).xyz);
  vec3 n2 = normalize(texture2D(tNormalRough, t.uv2).xyz);
  vec3 n3 = normalize(texture2D(tNormalRough, t.uv3).xyz);
  t.w0 = exp(-abs(z0 - centerZ) * 1.6) * pow(max(dot(n0, centerN), 0.0), 16.0);
  t.w1 = exp(-abs(z1 - centerZ) * 1.6) * pow(max(dot(n1, centerN), 0.0), 16.0);
  t.w2 = exp(-abs(z2 - centerZ) * 1.6) * pow(max(dot(n2, centerN), 0.0), 16.0);
  t.w3 = exp(-abs(z3 - centerZ) * 1.6) * pow(max(dot(n3, centerN), 0.0), 16.0);
  t.wsum = t.w0 + t.w1 + t.w2 + t.w3;
  return t;
}

vec4 applyTaps(sampler2D tex, Taps t, vec2 uv) {
  if (t.wsum <= 1e-5) return texture2D(tex, uv);
  return (texture2D(tex, t.uv0) * t.w0 + texture2D(tex, t.uv1) * t.w1 +
          texture2D(tex, t.uv2) * t.w2 + texture2D(tex, t.uv3) * t.w3) / t.wsum;
}

void main() {
  vec3 color = texture2D(tScene, vUv).rgb;
  float dOpaque = texture2D(tDepth, vUv).x;
  float dAll = texture2D(tDepthAll, vUv).x;
  float zOpaque = dOpaque >= 1.0 ? uFar : linearizeDepth(dOpaque, uNear, uFar);
  float zAll = dAll >= 1.0 ? uFar : linearizeDepth(dAll, uNear, uFar);

  // Water pixels shade themselves (their own SSR/absorption), so skip the opaque GI/SSR there.
  float isWater = step(0.06, zOpaque - zAll);

  if (dOpaque < 1.0 && isWater < 0.5) {
    vec4 am = texture2D(tAlbedoMetal, vUv);
    vec4 nr = texture2D(tNormalRough, vUv);
    float rough = clamp(nr.w, 0.02, 1.0);
    Taps taps = buildTaps(vUv, zOpaque, normalize(nr.xyz));
    vec4 gi = applyTaps(tGi, taps, vUv);
    vec4 ssr = applyTaps(tSsr, taps, vUv);

    // AO on the ambient term only (approximated by a soft multiply).
    float ao = mix(1.0, gi.a, uAo);
    color *= mix(1.0, ao, 0.85);

    // Indirect diffuse bounce.
    color += gi.rgb * am.rgb * uGi;

    // Screen-space specular. Fresnel-ish weight, faded out with roughness.
    float viewZ = -zOpaque;
    vec3 viewPos = viewPosFromDepth(vUv, viewZ, uInvProj);
    vec3 V = normalize(-viewPos);
    float NdV = clamp(dot(normalize(nr.xyz), V), 0.0, 1.0);
    float f0 = mix(0.04, 1.0, am.w);
    float fres = f0 + (1.0 - f0) * pow(1.0 - NdV, 5.0);
    float w = ssr.a * uSsr * mix(fres, 1.0, am.w) * (1.0 - smoothstep(0.25, 0.62, rough));
    color = mix(color, color + ssr.rgb * mix(vec3(1.0), am.rgb, am.w), clamp(w, 0.0, 1.0));
  }

  // Underwater absorption for everything seen from below the surface. The scattered term keeps a
  // little contrast instead of flooding the frame with flat teal.
  if (uUnderwater > 0.5) {
    float dist = min(zAll, 60.0);
    vec3 T = exp(-uWaterAbsorb * dist);
    float depthBelow = clamp((uWaterSurfaceY - uCameraPos.y) * 0.18, 0.0, 1.0);
    vec3 scatterLit = uWaterScatter * mix(0.85, 0.35, depthBelow);
    color = color * T + scatterLit * (1.0 - T);
  }

  // Volumetric fog composite.
  if (uFogOn > 0.5) {
    vec4 fog = texture2D(tFog, vUv);
    color = color * fog.a + fog.rgb;
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

// ------------------------------------------------------------------------------------------------
// TAA: camera-reprojected history accumulation with neighbourhood clamping.
// The world is static, so reprojection by depth is exact and gives us a free denoiser for
// SSGI/SSR/fog plus 8x supersampled edges.
// ------------------------------------------------------------------------------------------------
export const TAA_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tCurrent;
uniform sampler2D tHistory;
uniform sampler2D tDepth;
uniform mat4 uInvViewProj;
uniform mat4 uPrevViewProj;
uniform vec2 uRes;
uniform float uBlend;
uniform float uValid;

varying vec2 vUv;

${HELPERS}

vec3 rgb2ycocg(vec3 c) {
  return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b);
}
vec3 ycocg2rgb(vec3 c) {
  return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z);
}

void main() {
  vec3 current = texture2D(tCurrent, vUv).rgb;
  float d = texture2D(tDepth, vUv).x;

  if (uValid < 0.5) {
    gl_FragColor = vec4(current, 1.0);
    return;
  }

  // Reproject through the previous view-projection.
  vec4 clip = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 world = uInvViewProj * clip;
  world /= world.w;
  vec4 prevClip = uPrevViewProj * world;
  vec2 prevUv = (prevClip.xy / prevClip.w) * 0.5 + 0.5;

  float offscreen = (prevUv.x < 0.0 || prevUv.x > 1.0 || prevUv.y < 0.0 || prevUv.y > 1.0) ? 1.0 : 0.0;
  vec3 history = texture2D(tHistory, prevUv).rgb;

  // Neighbourhood clamp in YCoCg to suppress ghosting on the animated water.
  vec2 texel = 1.0 / uRes;
  vec3 m1 = vec3(0.0);
  vec3 m2 = vec3(0.0);
  // Five-tap cross: nearly as good as the full 3x3 for clamping, at half the bandwidth.
  vec3 c0 = rgb2ycocg(current);
  vec3 c1 = rgb2ycocg(texture2D(tCurrent, vUv + vec2(texel.x, 0.0)).rgb);
  vec3 c2 = rgb2ycocg(texture2D(tCurrent, vUv - vec2(texel.x, 0.0)).rgb);
  vec3 c3 = rgb2ycocg(texture2D(tCurrent, vUv + vec2(0.0, texel.y)).rgb);
  vec3 c4 = rgb2ycocg(texture2D(tCurrent, vUv - vec2(0.0, texel.y)).rgb);
  m1 = (c0 + c1 + c2 + c3 + c4) / 5.0;
  m2 = (c0 * c0 + c1 * c1 + c2 * c2 + c3 * c3 + c4 * c4) / 5.0;
  vec3 sigma = sqrt(max(m2 - m1 * m1, vec3(0.0)));
  vec3 lo = m1 - sigma * 1.35;
  vec3 hi = m1 + sigma * 1.35;

  vec3 hy = rgb2ycocg(history);
  hy = clamp(hy, lo, hi);
  history = ycocg2rgb(hy);

  float blend = uBlend * (1.0 - offscreen);
  // Reject history when it disagrees wildly (fast motion, disocclusion).
  float diff = abs(luma(history) - luma(current)) / max(0.08, max(luma(history), luma(current)));
  blend *= 1.0 - clamp((diff - 0.45) * 1.6, 0.0, 1.0);

  vec3 outc = mix(current, history, clamp(blend, 0.0, 0.97));
  gl_FragColor = vec4(max(outc, vec3(0.0)), 1.0);
}
`;

export const BLOOM_PREFILTER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform float uThreshold;
uniform float uSoftKnee;
varying vec2 vUv;
${HELPERS}
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = luma(c);
  float knee = uThreshold * uSoftKnee + 1e-5;
  float soft = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float w = max(soft, l - uThreshold) / max(l, 1e-4);
  gl_FragColor = vec4(c * w, 1.0);
}
`;

export const BLOOM_DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  // 13-tap Call of Duty style downsample.
  vec3 a = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 f = texture2D(tSrc, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + uTexel * vec2( 2.0, 0.0)).rgb;
  vec3 h = texture2D(tSrc, vUv + uTexel * vec2( 0.0, -2.0)).rgb;
  vec3 i = texture2D(tSrc, vUv + uTexel * vec2( 0.0,  2.0)).rgb;
  vec3 col = e * 0.25 + (a + b + c + d) * 0.125 + (f + g + h + i) * 0.0625;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const BLOOM_UP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform sampler2D tPrev;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;
void main() {
  // Tent filter upsample, additive with the finer mip.
  vec2 o = uTexel * uRadius;
  vec3 s = texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 1.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -o.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 1.0;
  s += texture2D(tSrc, vUv + vec2(-o.x, 0.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + vec2(o.x, 0.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 1.0;
  s += texture2D(tSrc, vUv + vec2(0.0, o.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 1.0;
  s /= 16.0;
  gl_FragColor = vec4(texture2D(tPrev, vUv).rgb + s, 1.0);
}
`;

// ------------------------------------------------------------------------------------------------
// Final grade: underwater warp, exposure, ACES filmic, bloom, CA, grain, vignette, sRGB.
// ------------------------------------------------------------------------------------------------
export const FINAL_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uRes;
uniform float uExposure;
uniform float uBloom;
uniform float uTime;
uniform float uUnderwater;
uniform float uGrain;
uniform float uVignette;
uniform float uCa;
uniform float uContrast;
uniform float uSaturation;

varying vec2 vUv;

${HELPERS}

// ACES fit (Stephen Hill) — filmic highlight rolloff with sane hues.
const mat3 ACESInput = mat3(
  0.59719, 0.07600, 0.02840,
  0.35458, 0.90834, 0.13383,
  0.04823, 0.01566, 0.83777
);
const mat3 ACESOutput = mat3(
   1.60475, -0.10208, -0.00327,
  -0.53108,  1.10813, -0.07276,
  -0.07367, -0.00605,  1.07602
);
vec3 rrtOdtFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFitted(vec3 c) {
  c = ACESInput * c;
  c = rrtOdtFit(c);
  c = ACESOutput * c;
  return clamp(c, 0.0, 1.0);
}

vec3 linearToSRGB(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(1e-5)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  vec2 uv = vUv;

  // Underwater: gentle refractive wobble.
  if (uUnderwater > 0.5) {
    float w1 = sin(uv.y * 26.0 + uTime * 1.7) * 0.0016;
    float w2 = cos(uv.x * 31.0 - uTime * 1.3) * 0.0014;
    uv += vec2(w1 + w2, w2 - w1 * 0.6);
  }

  // Chromatic aberration grows toward the corners.
  vec2 centre = uv - 0.5;
  float r2 = dot(centre, centre);
  vec3 color;
  if (uCa > 0.0) {
    vec2 off = centre * r2 * uCa;
    color.r = texture2D(tScene, uv - off).r;
    color.g = texture2D(tScene, uv).g;
    color.b = texture2D(tScene, uv + off).b;
  } else {
    color = texture2D(tScene, uv).rgb;
  }

  color += texture2D(tBloom, uv).rgb * uBloom;
  color *= uExposure;

  color = acesFitted(color);

  // Grade.
  float l = luma(color);
  color = mix(vec3(l), color, uSaturation);
  color = clamp((color - 0.5) * uContrast + 0.5, 0.0, 1.0);

  if (uUnderwater > 0.5) {
    color *= vec3(0.84, 0.97, 1.0);
    color = mix(color, vec3(0.07, 0.26, 0.31), 0.06);
  }

  // Vignette + film grain.
  float vig = 1.0 - uVignette * smoothstep(0.18, 0.95, r2 * 2.0);
  color *= vig;
  float grain = (hash12(uv * uRes + fract(uTime) * 137.0) - 0.5) * uGrain;
  color += grain * (0.35 + 0.65 * (1.0 - luma(color)));

  color = linearToSRGB(max(color, vec3(0.0)));
  // Ordered dither to hide 8-bit banding in the dark, humid corners.
  float dither = (hash12(uv * uRes + 11.0) - 0.5) / 255.0;
  gl_FragColor = vec4(color + dither, 1.0);
}
`;
