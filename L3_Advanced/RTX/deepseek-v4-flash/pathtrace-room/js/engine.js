// WebGL2 路径追踪渲染核心：
// 全屏三角形 -> 追踪 1 个新采样 -> RGBA16F 乒乓累积 -> ACES 色调映射输出

const VERT_SRC = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID & 1) == 1 ? 3.0 : -1.0, (gl_VertexID & 2) == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const TRACE_FRAG_SRC = `#version 300 es
precision highp float;
precision highp int;

const int MAX_PRIMS = 64;
const float PI = 3.141592653589793;
const float TWO_PI = 6.283185307179586;

uniform vec2 u_res;
uniform uint u_frame;
uniform int u_spp;
uniform int u_maxBounces;
uniform vec3 u_camPos;
uniform mat3 u_camBasis;
uniform float u_fovTan;
uniform sampler2D u_sceneTex;
uniform sampler2D u_matTex;
uniform int u_primCount;
uniform int u_lightCount;
uniform ivec4 u_lights[8];
uniform vec3 u_envTop;
uniform vec3 u_envBottom;
uniform float u_envIntensity;

out vec4 outColor;

struct Hit {
  bool ok;
  float t;
  vec3 p;
  vec3 n;
  int m;
  int prim;
};

Hit g_hit;
uint rngState;

vec4 getPrim(int i, int k) {
  return texelFetch(u_sceneTex, ivec2(i * 4 + k, 0), 0);
}
vec4 getMat(int m, int k) {
  return texelFetch(u_matTex, ivec2(m * 4 + k, 0), 0);
}

float rnd() {
  rngState = rngState * 747796405u + 2891336453u;
  uint w = ((rngState >> ((rngState >> 28u) + 4u)) ^ rngState) * 277803737u;
  w = (w >> 22u) ^ w;
  return float(w) * (1.0 / 4294967295.0);
}

void initRng(int bounce, int sampleId) {
  uint h = u_frame * 0x9E3779B1u
         + uint(sampleId) * 0x85EBCA77u
         + uint(gl_FragCoord.x) * 0xC2B2AE3Du
         + uint(gl_FragCoord.y) * 0x27D4EB2Fu
         + uint(bounce) * 0x165667B1u;
  h ^= h >> 16u;
  h *= 0x7FEB352Du;
  h ^= h >> 15u;
  h *= 0x846CA68Bu;
  h ^= h >> 16u;
  rngState = h | 1u;
}

void tryHit(float t, vec3 p, vec3 n, int m, int prim) {
  if (t > 1e-4 && (!g_hit.ok || t < g_hit.t)) {
    g_hit = Hit(true, t, p, n, m, prim);
  }
}

void interSphere(vec3 o, vec3 d, int i) {
  vec4 a = getPrim(i, 1);
  vec3 c = a.xyz;
  float r = a.w;
  vec3 oc = o - c;
  float b = dot(oc, d);
  float cc = dot(oc, oc) - r * r;
  float disc = b * b - cc;
  if (disc <= 0.0) return;
  float sq = sqrt(disc);
  float t = -b - sq;
  if (t <= 1e-4) t = -b + sq;
  if (t <= 1e-4) return;
  vec3 p = o + d * t;
  tryHit(t, p, (p - c) / r, int(getPrim(i, 0).y), i);
}

void interQuad(vec3 o, vec3 d, int i) {
  vec4 t1 = getPrim(i, 1);
  vec4 t2 = getPrim(i, 2);
  vec4 t3 = getPrim(i, 3);
  vec3 c = t1.xyz;
  vec3 ua = t2.xyz;
  vec3 va = t3.xyz;
  float du = t1.w;
  float dv = t2.w;
  vec3 n = normalize(cross(ua, va));
  float den = dot(d, n);
  if (abs(den) < 1e-6) return;
  float t = dot(c - o, n) / den;
  if (t <= 1e-4) return;
  vec3 p = o + d * t;
  vec3 q = p - c;
  if (abs(dot(q, ua)) > du || abs(dot(q, va)) > dv) return;
  tryHit(t, p, den < 0.0 ? n : -n, int(getPrim(i, 0).y), i);
}

void interBox(vec3 o, vec3 d, int i) {
  vec4 t1 = getPrim(i, 1);
  vec4 t2 = getPrim(i, 2);
  vec3 c = t1.xyz;
  vec3 h = vec3(t1.w, t2.x, t2.y);
  float ang = t2.z;
  float cs = cos(-ang);
  float sn = sin(-ang);
  vec3 lo = vec3(cs * (o.x - c.x) - sn * (o.z - c.z), o.y - c.y, sn * (o.x - c.x) + cs * (o.z - c.z));
  vec3 ld = vec3(cs * d.x - sn * d.z, d.y, sn * d.x + cs * d.z);
  vec3 inv = 1.0 / ld;
  vec3 t0 = (-h - lo) * inv;
  vec3 t1v = (h - lo) * inv;
  vec3 tmin = min(t0, t1v);
  vec3 tmax = max(t0, t1v);
  float tN = max(max(tmin.x, tmin.y), tmin.z);
  float tF = min(min(tmax.x, tmax.y), tmax.z);
  if (!(tN <= tF) || tF <= 1e-4) return;
  float t = tN > 1e-4 ? tN : tF;
  vec3 lp = lo + ld * t;
  vec3 q = lp / h;
  float ax = abs(q.x), ay = abs(q.y), az = abs(q.z);
  vec3 ln = vec3(0.0);
  if (ax >= ay && ax >= az) ln = vec3(sign(q.x), 0.0, 0.0);
  else if (ay >= az) ln = vec3(0.0, sign(q.y), 0.0);
  else ln = vec3(0.0, 0.0, sign(q.z));
  if (dot(ln, ld) > 0.0) ln = -ln;
  vec3 n = vec3(cs * ln.x + sn * ln.z, ln.y, -sn * ln.x + cs * ln.z);
  vec3 p = o + d * t;
  tryHit(t, p, n, int(getPrim(i, 0).y), i);
}

void interPlane(vec3 o, vec3 d, int i) {
  vec4 a = getPrim(i, 1);
  vec3 axis = a.xyz;
  float off = a.w;
  float den = dot(d, axis);
  if (abs(den) < 1e-7) return;
  float t = (off - dot(o, axis)) / den;
  if (t <= 1e-4) return;
  vec3 p = o + d * t;
  tryHit(t, p, den < 0.0 ? axis : -axis, int(getPrim(i, 0).y), i);
}

void intersect(vec3 o, vec3 d) {
  g_hit.ok = false;
  g_hit.t = 1e30;
  for (int i = 0; i < MAX_PRIMS; i++) {
    if (i >= u_primCount) break;
    int ty = int(getPrim(i, 0).x);
    if (ty == 1) interSphere(o, d, i);
    else if (ty == 2) interBox(o, d, i);
    else if (ty == 3) interQuad(o, d, i);
    else if (ty == 4) interPlane(o, d, i);
  }
}

vec3 envColor(vec3 d) {
  float t = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  return mix(u_envBottom, u_envTop, t) * u_envIntensity;
}

vec3 fresnelSchlick(float cosV, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - clamp(cosV, 0.0, 1.0), 5.0);
}

float ggxD(float NoH, float a) {
  float t = NoH * NoH * (a * a - 1.0) + 1.0;
  return (a * a) / (PI * t * t);
}

float smithG(float NoV, float NoL, float a) {
  float a2 = a * a;
  float den = NoL * sqrt(max(0.0, a2 + (1.0 - a2) * NoV * NoV))
            + NoV * sqrt(max(0.0, a2 + (1.0 - a2) * NoL * NoL));
  return den > 1e-6 ? (2.0 * NoV * NoL) / den : 0.0;
}

vec3 evalSpec(vec3 F0, float NoV, float NoL, float NoH, float VoH, float a) {
  float D = ggxD(NoH, a);
  float G = smithG(NoV, NoL, a);
  vec3 F = fresnelSchlick(NoV, F0);
  return F * D * G / max(4.0 * NoV * NoL, 1e-6);
}

vec3 ggxSampleHalf(vec3 n, float a, float r1, float r2) {
  float phi = r2 * TWO_PI;
  float cosT = sqrt((1.0 - r1) / (1.0 + (a * a - 1.0) * r1));
  float sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
  vec3 t = abs(n.y) < 0.999 ? normalize(cross(n, vec3(0.0, 1.0, 0.0))) : vec3(1.0, 0.0, 0.0);
  vec3 b = cross(t, n);
  return sinT * (cos(phi) * t + sin(phi) * b) + cosT * n;
}

float specMixProb(vec3 F, float rough, float metal) {
  float f = max(F.r, max(F.g, F.b));
  if (metal > 0.5) return 1.0;
  return clamp(f * 0.85 + (1.0 - f) * pow(max(1.0 - rough * 1.4, 0.0), 3.0) * 0.55, 0.03, 0.95);
}

void evalBsdf(vec3 n, vec3 d, vec3 wi, vec4 m0, vec4 m1, vec4 m2, out vec3 f, out float pdfMix) {
  vec3 alb = m0.rgb;
  float rough = clamp(m0.a, 0.02, 1.0);
  float metal = m1.a;
  float trans = m2.y;
  f = vec3(0.0);
  pdfMix = 0.0;
  if (trans > 0.5) return;
  vec3 v = -d;
  float NoV = max(dot(n, v), 1e-4);
  float NoL = max(dot(wi, n), 0.0);
  if (NoL <= 1e-4) return;
  vec3 hsum = v + wi;
  if (length(hsum) < 1e-6) return;
  vec3 h = hsum / length(hsum);
  float NoH = max(dot(n, h), 1e-4);
  float VoH = max(dot(v, h), 1e-4);
  vec3 F0 = mix(vec3(0.04), alb, metal);
  vec3 F = fresnelSchlick(NoV, F0);
  float a = rough * rough;
  float pSpec = specMixProb(F, rough, metal);
  float pdfDiff = NoL * (1.0 / PI);
  float pdfSpec = ggxD(NoH, a) * NoH / max(4.0 * VoH, 1e-6);
  pdfMix = pSpec * pdfSpec + (1.0 - pSpec) * pdfDiff;
  vec3 fSpec = evalSpec(F0, NoV, NoL, NoH, VoH, a);
  vec3 fDiff = (vec3(1.0) - F) * alb * (1.0 / PI) * (1.0 - metal);
  f = fSpec + fDiff;
}

vec3 sampleBsdf(vec3 n, vec3 d, vec4 m0, vec4 m1, vec4 m2, out vec3 w, out float pdf) {
  vec3 alb = m0.rgb;
  float rough = clamp(m0.a, 0.02, 1.0);
  float metal = m1.a;
  float ior = m2.x;
  float trans = m2.y;
  vec3 v = -d;
  float NoV = max(dot(n, v), 1e-4);
  vec3 F0 = mix(vec3(0.04), alb, metal);
  vec3 F = fresnelSchlick(NoV, F0);
  float fmax = max(F.r, max(F.g, F.b));
  pdf = 0.0;

  if (trans > 0.5) {
    float cosI = clamp(abs(dot(n, d)), 0.0, 1.0);
    vec3 Fg = fresnelSchlick(cosI, vec3(0.04));
    float fg = max(Fg.r, max(Fg.g, Fg.b));
    if (rnd() < fg) {
      w = reflect(d, n);
      pdf = fg;
      return vec3(1.0);
    }
    float eta = dot(n, d) < 0.0 ? 1.0 / max(ior, 1.01) : max(ior, 1.01);
    vec3 nn = dot(n, d) < 0.0 ? n : -n;
    vec3 r = refract(d, nn, eta);
    if (length(r) < 0.5) {
      w = reflect(d, n);
      pdf = 1.0;
      return vec3(1.0);
    }
    w = r;
    pdf = 1.0 - fg;
    return alb;
  }

  float a = rough * rough;
  float pSpec = specMixProb(F, rough, metal);
  if (rnd() < pSpec) {
    vec3 h = ggxSampleHalf(n, a, rnd(), rnd());
    w = reflect(v, h);
    float NoL = max(dot(w, n), 0.0);
    if (NoL <= 1e-4 || dot(w, h) <= 0.0) {
      pdf = 0.0;
      return vec3(0.0);
    }
    float NoH = max(dot(n, h), 1e-4);
    float VoH = max(dot(v, h), 1e-4);
    float D = ggxD(NoH, a);
    pdf = pSpec * D * NoH / max(4.0 * VoH, 1e-6);
    vec3 fSpec = evalSpec(F0, NoV, NoL, NoH, VoH, a);
    return fSpec * NoL / pdf;
  } else {
    float r1 = rnd(), r2 = rnd();
    float st = sqrt(r1);
    float ct = sqrt(1.0 - r1);
    vec3 t = abs(n.y) < 0.999 ? normalize(cross(n, vec3(0.0, 1.0, 0.0))) : vec3(1.0, 0.0, 0.0);
    vec3 b = cross(t, n);
    w = st * (cos(r2 * TWO_PI) * t + sin(r2 * TWO_PI) * b) + ct * n;
    float NoL = max(dot(w, n), 1e-4);
    pdf = (1.0 - pSpec) * NoL * (1.0 / PI);
    vec3 fDiff = (vec3(1.0) - F) * alb * (1.0 / PI) * (1.0 - metal);
    return fDiff * NoL / pdf;
  }
}

bool sampleLight(vec3 p, vec3 n, out vec3 wi, out float pNee, out vec3 Li, out float lightDist) {
  if (u_lightCount <= 0) return false;
  int li = int(rnd() * float(u_lightCount));
  int pi = u_lights[li].x;
  vec4 t1 = getPrim(pi, 1);
  vec4 t2 = getPrim(pi, 2);
  vec4 t3 = getPrim(pi, 3);
  vec3 c = t1.xyz;
  vec3 ua = t2.xyz;
  vec3 va = t3.xyz;
  vec3 lp = c + ua * (rnd() * 2.0 - 1.0) * t1.w + va * (rnd() * 2.0 - 1.0) * t2.w;
  vec3 to = lp - p;
  float dist2 = dot(to, to);
  lightDist = sqrt(dist2);
  wi = to / max(lightDist, 1e-6);
  if (dot(wi, n) <= 1e-4) return false;
  vec3 norm = normalize(cross(ua, va));
  float cosL = abs(dot(norm, wi));
  float area = 4.0 * t1.w * t2.w;
  pNee = dist2 / (area * max(cosL, 1e-4)) / float(u_lightCount);
  int lm = int(getPrim(pi, 0).y);
  Li = getMat(lm, 1).rgb;
  return true;
}

float lightHitPdf(int pi, vec3 hitPos, vec3 prevPos) {
  if (u_lightCount <= 0) return 0.0;
  vec4 t1 = getPrim(pi, 1);
  vec4 t2 = getPrim(pi, 2);
  vec4 t3 = getPrim(pi, 3);
  vec3 to = hitPos - prevPos;
  float dist2 = dot(to, to);
  vec3 norm = normalize(cross(t2.xyz, t3.xyz));
  float cosL = abs(dot(norm, to)) / sqrt(max(dist2, 1e-8));
  float area = 4.0 * t1.w * t2.w;
  return dist2 / (area * max(cosL, 1e-4)) / float(u_lightCount);
}

vec3 traceSample(int sampleId) {
  vec2 uv = (2.0 * gl_FragCoord.xy - u_res) / u_res.y;
  vec3 ro = u_camPos;
  vec3 d = normalize(u_camBasis[0] * uv.x + u_camBasis[1] * (-uv.y) + u_camBasis[2] * (1.0 / u_fovTan));
  vec3 L = vec3(0.0);
  vec3 T = vec3(1.0);
  vec3 prevPos = ro;
  float pdfPrev = 1.0;
  bool glassPrev = false;

  for (int b = 0; b < 64; b++) {
    if (b >= u_maxBounces) break;
    initRng(b, sampleId);
    intersect(ro, d);
    if (!g_hit.ok) {
      L += T * envColor(d);
      break;
    }
    int m = g_hit.m;
    int pi = g_hit.prim;
    vec3 p = g_hit.p;
    vec3 n = g_hit.n;
    vec4 m0 = getMat(m, 0);
    vec4 m1 = getMat(m, 1);
    vec4 m2 = getMat(m, 2);
    vec3 em = m1.rgb;

    if (b == 0 && any(greaterThan(em, vec3(0.0)))) {
      L += T * em;
      break;
    }
    if (any(greaterThan(em, vec3(0.0)))) {
      if (glassPrev || pdfPrev <= 1e-8) {
        L += T * em;
      } else {
        float pNee = lightHitPdf(pi, p, prevPos);
        L += T * em * (pdfPrev / (pdfPrev + pNee));
      }
      break;
    }

    float trans = m2.y;
    bool glass = trans > 0.5;
    if (!glass) {
      vec3 wi;
      float pNee;
      vec3 Li;
      float lightDist;
      if (sampleLight(p, n, wi, pNee, Li, lightDist)) {
        vec3 sp = p + n * 1e-3;
        intersect(sp, wi);
        bool occl = false;
        if (g_hit.ok && g_hit.t < lightDist - 1e-3) {
          if (getMat(g_hit.m, 2).y < 0.5) occl = true;
        }
        if (!occl) {
          vec3 f;
          float pdfMix;
          evalBsdf(n, d, wi, m0, m1, m2, f, pdfMix);
          if (pdfMix > 1e-8) {
            float wMIS = pNee / (pNee + pdfMix);
            L += T * f * max(dot(wi, n), 0.0) * Li / pNee * wMIS;
          }
        }
      }
    }

    vec3 w;
    float pdfB;
    vec3 wgt = sampleBsdf(n, d, m0, m1, m2, w, pdfB);
    if (pdfB <= 1e-8 || length(w) < 0.5) break;
    T *= wgt;
    prevPos = p;
    pdfPrev = pdfB;
    glassPrev = glass;
    d = w;
    ro = p + w * 1e-3;

    if (b >= 1) {
      float rr = max(T.r, max(T.g, T.b));
      float q = clamp(rr * 0.9, 0.08, 0.95);
      if (rnd() > q) break;
      T /= q;
    }
  }
  return L;
}

void main() {
  vec3 acc = vec3(0.0);
  for (int s = 0; s < 4; s++) {
    if (s >= u_spp) break;
    acc += traceSample(s);
  }
  outColor = vec4(acc / float(max(u_spp, 1)), 1.0);
}`;

const ACCUM_FRAG_SRC = `#version 300 es
precision highp float;
uniform sampler2D u_sample;
uniform sampler2D u_prev;
uniform float u_n;
out vec4 outColor;
void main() {
  vec4 s = texelFetch(u_sample, ivec2(gl_FragCoord.xy), 0);
  if (u_n <= 1.0) {
    outColor = s;
    return;
  }
  vec4 p = texelFetch(u_prev, ivec2(gl_FragCoord.xy), 0);
  outColor = p * ((u_n - 1.0) / u_n) + s / u_n;
}`;

const DISPLAY_FRAG_SRC = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform float u_exposure;
out vec4 outColor;
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec3 c = texelFetch(u_tex, ivec2(gl_FragCoord.xy), 0).rgb;
  c = pow(max(aces(c * u_exposure), 0.0), vec3(1.0 / 2.2));
  outColor = vec4(c, 1.0);
}`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function linkProgram(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(log);
  }
  return p;
}

function createTex(gl, w, h, internal, format, type) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function createFbo(gl, tex) {
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return f;
}

class PathTraceEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    });
    if (!this.gl) {
      throw new Error('当前环境不支持 WebGL2。请使用最新版 Chrome / Edge 浏览器。');
    }
  }

  init() {
    const gl = this.gl;
    try {
      this.progTrace = linkProgram(gl, VERT_SRC, TRACE_FRAG_SRC);
      this.progAccum = linkProgram(gl, VERT_SRC, ACCUM_FRAG_SRC);
      this.progDisplay = linkProgram(gl, VERT_SRC, DISPLAY_FRAG_SRC);
    } catch (e) {
      throw new Error('着色器编译失败：\n' + e.message);
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.sceneTex = gl.createTexture();
    this.matTex = gl.createTexture();
    this.lights = new Int32Array(32);
    this.spp = 1;
    this.maxBounces = 6;
    this.exposure = 1;
    this.camPos = new Float32Array([0, 0, 5]);
    this.camBasis = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, -1]);
    this.fovTan = 0.5;
    this.primCount = 0;
    this.lightCount = 0;
    this.envTop = new Float32Array([0, 0, 0]);
    this.envBottom = new Float32Array([0, 0, 0]);
    this.envIntensity = 1;
    this.w = 2;
    this.h = 2;
    this.hdr = true;
    this.readIdx = 0;

    this.uTrace = this._collect(this.progTrace, [
      'u_res', 'u_frame', 'u_spp', 'u_maxBounces', 'u_camPos', 'u_camBasis', 'u_fovTan',
      'u_sceneTex', 'u_matTex', 'u_primCount', 'u_lightCount', 'u_lights',
      'u_envTop', 'u_envBottom', 'u_envIntensity',
    ]);
    this.uAccum = this._collect(this.progAccum, ['u_sample', 'u_prev', 'u_n']);
    this.uDisplay = this._collect(this.progDisplay, ['u_tex', 'u_exposure']);

    this._makeBuffers(2, 2);
    this.gpuName = this._gpuName();
    return this;
  }

  _collect(prog, names) {
    const out = {};
    for (const n of names) out[n] = this.gl.getUniformLocation(prog, n);
    return out;
  }

  _gpuName() {
    const gl = this.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const raw = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      if (raw) return String(raw);
    }
    return 'WebGL2（未公开显卡型号）';
  }

  setScene(scene) {
    const gl = this.gl;
    this.primCount = scene.prims.length / 16;
    this.lightCount = scene.lights.length;
    this.lights.fill(-1);
    for (let i = 0; i < scene.lights.length; i++) this.lights[i] = scene.lights[i];
    this.envTop = Float32Array.from(scene.envTop);
    this.envBottom = Float32Array.from(scene.envBottom);
    this.envIntensity = scene.envIntensity;

    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.primCount * 4, 1, 0, gl.RGBA, gl.FLOAT, scene.prims);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, this.matTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, scene.materials.length / 16 * 4, 1, 0, gl.RGBA, gl.FLOAT, scene.materials);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  setCamera(view) {
    this.camPos = Float32Array.from(view.pos);
    const r = view.right, u = view.up, f = view.fwd;
    this.camBasis = Float32Array.from([
      r[0], r[1], r[2],
      u[0], u[1], u[2],
      f[0], f[1], f[2],
    ]);
    this.fovTan = view.fovTan;
  }

  setSettings(s) {
    if (s.spp !== undefined) this.spp = Math.max(1, s.spp | 0);
    if (s.maxBounces !== undefined) this.maxBounces = Math.max(1, s.maxBounces | 0);
    if (s.exposure !== undefined) this.exposure = s.exposure;
  }

  resize(w, h) {
    this.w = Math.max(2, w | 0);
    this.h = Math.max(2, h | 0);
    this._makeBuffers(this.w, this.h);
    this.readIdx = 0;
    this._clearAcc();
  }

  _freeBuffers() {
    const gl = this.gl;
    if (this.sampleTex) gl.deleteTexture(this.sampleTex);
    if (this.accTex) for (const t of this.accTex) gl.deleteTexture(t);
    if (this.traceFbo) gl.deleteFramebuffer(this.traceFbo);
    if (this.accFbo) for (const f of this.accFbo) gl.deleteFramebuffer(f);
    this.sampleTex = null;
    this.accTex = null;
    this.traceFbo = null;
    this.accFbo = null;
  }

  _makeBuffers(w, h) {
    const gl = this.gl;
    this._freeBuffers();
    const build = (hdr) => {
      if (hdr) {
        this.sampleTex = createTex(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
        this.accTex = [
          createTex(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT),
          createTex(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT),
        ];
      } else {
        this.sampleTex = createTex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
        this.accTex = [
          createTex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE),
          createTex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE),
        ];
      }
      this.traceFbo = createFbo(gl, this.sampleTex);
      this.accFbo = [createFbo(gl, this.accTex[0]), createFbo(gl, this.accTex[1])];
    };
    build(true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.traceFbo);
    let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (ok) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFbo[0]);
      ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
    if (!ok) {
      this._freeBuffers();
      build(false);
      this.hdr = false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _clearAcc() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFbo[0]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFbo[1]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resetAccum() {
    this._clearAcc();
  }

  render(frame) {
    const gl = this.gl;
    const w = this.w, h = this.h;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.traceFbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.progTrace);
    gl.uniform2f(this.uTrace.u_res, w, h);
    gl.uniform1ui(this.uTrace.u_frame, frame >>> 0);
    gl.uniform1i(this.uTrace.u_spp, this.spp);
    gl.uniform1i(this.uTrace.u_maxBounces, this.maxBounces);
    gl.uniform3fv(this.uTrace.u_camPos, this.camPos);
    gl.uniformMatrix3fv(this.uTrace.u_camBasis, false, this.camBasis);
    gl.uniform1f(this.uTrace.u_fovTan, this.fovTan);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.uniform1i(this.uTrace.u_sceneTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.matTex);
    gl.uniform1i(this.uTrace.u_matTex, 1);
    gl.uniform1i(this.uTrace.u_primCount, this.primCount);
    gl.uniform1i(this.uTrace.u_lightCount, this.lightCount);
    gl.uniform4iv(this.uTrace.u_lights, this.lights);
    gl.uniform3fv(this.uTrace.u_envTop, this.envTop);
    gl.uniform3fv(this.uTrace.u_envBottom, this.envBottom);
    gl.uniform1f(this.uTrace.u_envIntensity, this.envIntensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const out = 1 - this.readIdx;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFbo[out]);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.progAccum);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sampleTex);
    gl.uniform1i(this.uAccum.u_sample, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.accTex[this.readIdx]);
    gl.uniform1i(this.uAccum.u_prev, 1);
    gl.uniform1f(this.uAccum.u_n, frame);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.readIdx = out;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.progDisplay);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.accTex[this.readIdx]);
    gl.uniform1i(this.uDisplay.u_tex, 0);
    gl.uniform1f(this.uDisplay.u_exposure, this.exposure);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
