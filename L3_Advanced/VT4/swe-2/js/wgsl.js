/* ============================================================
 * wgsl.js — WebGPU WGSL 着色器源
 * 管线: 阴影深度 → G-Buffer(反照率/法线/深度) → 光照+SSAO+软阴影(累积)
 *       → 粒子(累积) → 色调映射 → FXAA → Canvas
 * ============================================================ */
"use strict";
(function () {
  VT4.WGSL = {};

  const COMMON = /* wgsl */`
struct Frame {
  viewProj : mat4x4f, view : mat4x4f, invVP : mat4x4f, invProj : mat4x4f,
  proj : mat4x4f, lightVP : mat4x4f,
  camPos   : vec4f,   // w = EV 曝光乘数
  sunDir   : vec4f,   // w = 强度
  sunCol   : vec4f,   // w = 角半径(软阴影)
  envZen   : vec4f,   // w = 环境光强度
  envHor   : vec4f,   // w = 雾霭系数
  envGnd   : vec4f,
  clip     : vec4f,   // xyz=法线; w=距离; w<-1e7 表示关闭
  misc     : vec4f,   // x=帧序 y=爆炸度 z=X-Ray强度 w=火炮俯仰角
  misc2    : vec4f,   // x=AO开 y=软阴影开 z=改型掩码 w=时间
  gunPivot : vec4f,
  screen   : vec4f,   // w,h,1/w,1/h
};
struct PartT { a : array<vec4f,64>, b : array<vec4f,64>, c : array<vec4f,64> };
struct Mat { c : vec4f, p : vec4f };
@group(0) @binding(0) var<uniform> F : Frame;
@group(0) @binding(1) var<storage, read> PT : PartT;
@group(0) @binding(2) var<uniform> MATS : array<Mat, 32>;

fn hash11(p : f32) -> f32 { return fract(sin(p * 127.1) * 43758.5453); }
fn hash21(p : vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn hash31(p : vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }

fn envColor(d : vec3f) -> vec3f {
  let t = d.y;
  var c = mix(F.envHor.rgb, F.envZen.rgb, pow(clamp(t, 0.0, 1.0), 0.55));
  if (t < 0.0) { c = mix(F.envHor.rgb, F.envGnd.rgb, clamp(-t * 2.2, 0.0, 1.0)); }
  let sd = max(dot(d, F.sunDir.xyz), 0.0);
  c += F.sunCol.rgb * pow(sd, 900.0) * F.sunDir.w * 60.0;
  c += F.sunCol.rgb * pow(sd, 8.0) * F.sunDir.w * 0.06 * (1.0 + F.envHor.w);
  return c;
}
fn elevRot(p : vec3f, a : f32) -> vec3f {
  let q = p - F.gunPivot.xyz;
  let c = cos(a); let s = sin(a);
  return F.gunPivot.xyz + vec3f(q.x, c * q.y - s * q.z, s * q.y + c * q.z);
}
fn partClip(pid : u32, wp0 : vec3f) -> vec4f {
  let pa = PT.a[pid]; let pb = PT.b[pid];
  var wp = wp0 + pa.xyz * F.misc.y;
  if (pb.z > 0.5) { wp = elevRot(wp, F.misc.w); }
  var cp = F.viewProj * vec4f(wp, 1.0);
  if (pa.w < 0.5 || (u32(pb.w + 0.5) & u32(F.misc2.z + 0.5)) == 0u) {
    cp = vec4f(0.0, 0.0, 2.0, 1.0);
  }
  return cp;
}
fn shadowClip(pid : u32, wp0 : vec3f) -> vec4f {
  let pa = PT.a[pid]; let pb = PT.b[pid];
  var wp = wp0 + pa.xyz * F.misc.y;
  if (pb.z > 0.5) { wp = elevRot(wp, F.misc.w); }
  var cp = F.lightVP * vec4f(wp, 1.0);
  if (pa.w < 0.5 || (u32(pb.w + 0.5) & u32(F.misc2.z + 0.5)) == 0u) {
    cp = vec4f(0.0, 0.0, 2.0, 1.0);
  }
  return cp;
}
`;

  /* ---------------- G-Buffer ---------------- */
  VT4.WGSL.gbuffer = COMMON + /* wgsl */`
struct VIn {
  @location(0) pos : vec3f,
  @location(1) nrm : vec3f,
  @location(2) mat : f32,
  @location(3) part : f32,
};
struct VOut {
  @builtin(position) cp : vec4f,
  @location(0) wp : vec3f,
  @location(1) wn : vec3f,
  @location(2) @interpolate(flat) mat : f32,
  @location(3) @interpolate(flat) part : f32,
};
@vertex fn vs(in : VIn) -> VOut {
  let pid = u32(in.part + 0.5);
  var o : VOut;
  o.cp = partClip(pid, in.pos);
  var wp = in.pos + PT.a[pid].xyz * F.misc.y;
  if (PT.b[pid].z > 0.5) { wp = elevRot(wp, F.misc.w); }
  o.wp = wp; o.wn = in.nrm; o.mat = in.mat; o.part = in.part;
  return o;
}
struct FOut {
  @location(0) a0 : vec4f,
  @location(1) a1 : vec4f,
};
@fragment fn fs(in : VOut) -> FOut {
  if (F.clip.w > -1e7 && dot(in.wp, F.clip.xyz) > F.clip.w) { discard; }
  let pb = PT.b[u32(in.part + 0.5)];
  if (pb.y > 0.5 && F.misc.z > 0.001) {
    let h = hash21(in.cp.xy + vec2f(F.misc.x * 17.13, F.misc.x * 7.31));
    if (h < F.misc.z) { discard; }
  }
  let m = MATS[u32(in.mat + 0.5)];
  // 细腻漆面颗粒(低频+高频混合, 弱幅度)
  let n = hash31(floor(in.wp * 2.7)) * 0.55 + hash31(floor(in.wp * 23.0)) * 0.45;
  var o : FOut;
  o.a0 = vec4f(m.c.rgb * (0.93 + 0.11 * n), in.mat);
  o.a1 = vec4f(normalize(in.wn), in.part);
  return o;
}
`;

  /* ---------------- 阴影深度 ---------------- */
  VT4.WGSL.shadow = COMMON + /* wgsl */`
struct VIn {
  @location(0) pos : vec3f,
  @location(1) nrm : vec3f,
  @location(2) mat : f32,
  @location(3) part : f32,
};
@vertex fn vs(in : VIn) -> @builtin(position) vec4f {
  return shadowClip(u32(in.part + 0.5), in.pos);
}
`;

  /* ---------------- 光照 + 累积 ---------------- */
  VT4.WGSL.light = COMMON + /* wgsl */`
@group(1) @binding(0) var gA : texture_2d<f32>;
@group(1) @binding(1) var gB : texture_2d<f32>;
@group(1) @binding(2) var gD : texture_depth_2d;
@group(1) @binding(3) var shT : texture_depth_2d;
@group(1) @binding(4) var shS : sampler_comparison;
@group(1) @binding(5) var dS : sampler;

const PI = 3.14159265;

fn ggxD(nh : f32, r : f32) -> f32 {
  let a = max(r, 0.05); let a2 = a * a;
  let d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 1e-6);
}
fn ggxV(nv : f32, nl : f32, r : f32) -> f32 {
  let k = (r + 1.0) * (r + 1.0) / 8.0;
  return (nv / (nv * (1.0 - k) + k + 1e-5)) * (nl / (nl * (1.0 - k) + k + 1e-5));
}
fn vpos(uv : vec2f, d : f32) -> vec3f {
  let ndc = vec4f(uv.x * 2.0 - 1.0, (1.0 - uv.y) * 2.0 - 1.0, d, 1.0);
  let v = F.invProj * ndc;
  return v.xyz / max(v.w, 1e-6);
}
fn wpos(uv : vec2f, d : f32) -> vec3f {
  let ndc = vec4f(uv.x * 2.0 - 1.0, (1.0 - uv.y) * 2.0 - 1.0, d, 1.0);
  let w = F.invVP * ndc;
  return w.xyz / max(w.w, 1e-6);
}

/* SSAO —— 每帧随机半球核, 累积收敛 */
fn ssao(vp : vec3f, vn : vec3f, frag : vec2f) -> f32 {
  var occ = 0.0;
  let radius = 0.30;
  let seed = F.misc.x * 13.7 + frag.x * 0.9173 + frag.y * 1.3171;
  for (var i = 0; i < 8; i++) {
    let a = hash11(seed + f32(i) * 3.31) * PI * 2.0;
    let rr = (0.2 + 0.8 * hash11(seed + f32(i) * 7.77)) * radius;
    var dir = vec3f(cos(a), sin(a), hash11(seed + f32(i) * 5.13) * 2.0 - 1.0);
    dir = normalize(dir);
    if (dot(dir, vn) < 0.0) { dir = -dir; }
    let sp = vp + dir * rr;
    if (sp.z > -0.05) { continue; }
    let pr = F.proj * vec4f(sp, 1.0);
    let suv = vec2f(pr.x / pr.w * 0.5 + 0.5, 0.5 - pr.y / pr.w * 0.5);
    if (suv.x <= 0.0 || suv.x >= 1.0 || suv.y <= 0.0 || suv.y >= 1.0) { continue; }
    let sd = textureSampleLevel(gD, dS, suv, 0);
    let spv = vpos(suv, sd);
    if (spv.z > sp.z + 0.02 && spv.z < sp.z + 1.2) { occ += 1.0; }
  }
  return clamp(1.0 - occ * (1.0 / 8.0) * 1.35, 0.0, 1.0);
}

/* 软阴影: 旋转泊松盘 PCF, 随机旋转逐帧收敛 */
fn shadow(wp : vec3f, nl : f32, frag : vec2f) -> f32 {
  let lp = F.lightVP * vec4f(wp, 1.0);
  if (lp.w <= 0.0) { return 1.0; }
  var suv = lp.xyz / lp.w;
  let uv = vec2f(suv.x * 0.5 + 0.5, 0.5 - suv.y * 0.5);
  if (uv.x <= 0.001 || uv.x >= 0.999 || uv.y <= 0.001 || uv.y >= 0.999) { return 1.0; }
  let depth = suv.z - 0.0018 - 0.002 * (1.0 - nl);
  if (depth > 1.0) { return 1.0; }
  if (F.misc2.y < 0.5) {
    return textureSampleCompareLevel(shT, shS, uv, depth);
  }
  let rot = hash21(frag + vec2f(F.misc.x * 3.7, F.misc.x * 9.1)) * PI * 2.0;
  let cs = cos(rot); let sn = sin(rot);
  let texel = 1.0 / 2048.0;
  let rad = max(F.sunCol.w * 900.0, 1.0) * texel;
  var s = 0.0;
  for (var i = 0; i < 12; i++) {
    let fi = f32(i);
    let ang = fi * 2.4 + hash11(fi * 17.0) * 0.8;
    let rr = sqrt((fi + 0.7) / 12.0) * rad;
    var off = vec2f(cos(ang), sin(ang)) * rr;
    off = vec2f(off.x * cs - off.y * sn, off.x * sn + off.y * cs);
    s += textureSampleCompareLevel(shT, shS, uv + off, depth);
  }
  return s / 12.0;
}

struct LO { @builtin(position) cp : vec4f, @location(0) uv : vec2f };
@vertex fn vs(@builtin(vertex_index) vi : u32) -> LO {
  var p = array<vec2f,3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
  var o : LO;
  o.cp = vec4f(p[vi], 0.9999, 1.0);
  o.uv = p[vi] * 0.5 + 0.5;
  return o;
}
@fragment fn fs(in : LO) -> @location(0) vec4f {
  let uv = in.uv;
  let d = textureSampleLevel(gD, dS, uv, 0);
  let cp = F.camPos.xyz;
  if (d >= 0.99999) {
    let ndc = vec4f(uv.x * 2.0 - 1.0, (1.0 - uv.y) * 2.0 - 1.0, 1.0, 1.0);
    let w = F.invVP * ndc;
    let dir = normalize(w.xyz / max(w.w, 1e-6) - cp);
    return vec4f(envColor(dir) * F.envZen.w, 1.0);
  }
  let A = textureSampleLevel(gA, dS, uv, 0.0);
  let B = textureSampleLevel(gB, dS, uv, 0.0);
  let mat = MATS[u32(A.w + 0.5)];
  let pb = PT.b[u32(B.w + 0.5)];
  let wp = wpos(uv, d);
  let vp = vpos(uv, d);
  let wn = normalize(B.xyz);
  let vn = normalize((F.view * vec4f(wn, 0.0)).xyz);
  let V = normalize(cp - wp);
  let L = normalize(F.sunDir.xyz);
  let N = wn;
  let nl = max(dot(N, L), 0.0);
  // ---- 直接光 GGX ----
  let albedo = A.rgb;
  let metal = mat.p.x; let rough = max(mat.p.y, 0.06);
  var f0 = mix(vec3f(0.04), albedo, metal);
  let H = normalize(V + L);
  let nv = max(dot(N, V), 1e-4);
  let Ds = ggxD(max(dot(N, H), 0.0), rough);
  let Vs = ggxV(nv, nl, rough);
  let Fv = f0 + (1.0 - f0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  let spec = Ds * Vs * Fv / max(4.0 * nl * nv, 1e-4);
  let kd = (1.0 - Fv) * (1.0 - metal);
  let sh = shadow(wp, nl, in.cp.xy);
  var col = (kd * albedo / PI + spec) * F.sunCol.rgb * nl * sh * F.sunDir.w;
  // ---- 环境项: IBL 近似 ----
  let ao = ssao(vp, vn, in.cp.xy);
  let irr = envColor(N) * F.envZen.w;
  col += albedo * irr * (1.0 - metal) * ao;
  let R = reflect(-V, N);
  let envSpec = envColor(normalize(R)) * F.envZen.w;
  let fres = f0 + (1.0 - f0) * pow(1.0 - nv, 5.0);
  col += envSpec * fres * pow(1.0 - rough, 2.0) * ao;
  // ---- 舱内照明(内构填充光, 模拟舱内灯/亮内壁) ----
  let pc = PT.c[u32(B.w + 0.5)];
  col += albedo * vec3f(0.95, 0.97, 1.0) * pc.x * 0.30;
  // ---- 自发光(屏幕/仪表) ----
  col += albedo * mat.p.z;
  // ---- 考证高亮(橙色脉冲) ----
  col += pb.x * vec3f(1.0, 0.45, 0.10) * (0.7 + 0.5 * sin(F.misc2.w * 5.0));
  // ---- 距离雾霭 ----
  let dist = length(wp - cp);
  let fog = 1.0 - exp(-dist * dist * F.envHor.w * 0.0016);
  col = mix(col, F.envHor.rgb * F.envZen.w * 0.9, clamp(fog, 0.0, 0.85));
  return vec4f(col, 1.0);
}
`;

  /* ---------------- 扬尘粒子 ---------------- */
  VT4.WGSL.dust = COMMON + /* wgsl */`
struct VI {
  @location(0) c : vec4f,   // xyz=位置 w=尺寸
  @location(1) s : vec2f,   // x=alpha y=seed
};
struct VO { @builtin(position) cp : vec4f, @location(0) uv : vec2f, @location(1) a : f32 };
@vertex fn vs(in : VI, @builtin(vertex_index) vi : u32) -> VO {
  var quad = array<vec2f,6>(
    vec2f(-1,-1), vec2f(1,-1), vec2f(1,1),
    vec2f(-1,-1), vec2f(1,1), vec2f(-1,1));
  let q = quad[vi];
  let rgt = vec3f(F.view[0].x, F.view[1].x, F.view[2].x);
  let up  = vec3f(F.view[0].y, F.view[1].y, F.view[2].y);
  let wp = in.c.xyz + (rgt * q.x + up * q.y) * in.c.w;
  var o : VO;
  o.cp = F.viewProj * vec4f(wp, 1.0);
  o.uv = q; o.a = in.s.x;
  return o;
}
@fragment fn fs(in : VO) -> @location(0) vec4f {
  let r = length(in.uv);
  let fall = smoothstep(1.0, 0.15, r);
  let lit = 0.6 + 0.4 * F.sunDir.w * 0.3;
  let c = mix(F.envGnd.rgb, F.envHor.rgb, 0.55) * (1.1 + lit);
  return vec4f(c * F.envZen.w, fall * in.a * 0.55);
}
`;

  /* ---------------- 色调映射 ---------------- */
  VT4.WGSL.display = /* wgsl */`
@group(0) @binding(0) var accT : texture_2d<f32>;
@group(0) @binding(1) var dS : sampler;
@group(0) @binding(2) var<uniform> DP : vec4f;  // x=样本数 y=EV乘数 z=色调映射模式 w=特效开关
@group(0) @binding(3) var<uniform> DP2 : vec4f; // x=帧序(颗粒种子) y=w h=z w=unused
fn h21(p : vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn aces(x : vec3f) -> vec3f {
  let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}
fn agx(x0 : vec3f) -> vec3f {
  var x = max(x0, vec3f(0.0));
  x = vec3f(
    0.842479062 * x.r + 0.042328242 * x.g + 0.042375654 * x.b,
    0.078433599 * x.r + 0.878468636 * x.g + 0.0784336 * x.b,
    0.079223745 * x.r + 0.079166017 * x.g + 0.879142973 * x.b);
  x = pow(x, vec3f(1.2));
  x = max((x - 0.002) / 0.98, vec3f(0.0));
  let l = pow(x, vec3f(1.55)) ;
  return clamp(vec3f(
    0.969 * l.r + 0.031 * l.g + 0.011 * l.b,
    0.011 * l.r + 0.961 * l.g + 0.011 * l.b,
    0.012 * l.r + 0.013 * l.g + 0.962 * l.b), vec3f(0.0), vec3f(1.0));
}
struct VO { @builtin(position) cp : vec4f, @location(0) uv : vec2f };
@vertex fn vs(@builtin(vertex_index) vi : u32) -> VO {
  var p = array<vec2f,3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
  var o : VO; o.cp = vec4f(p[vi], 0.0, 1.0); o.uv = p[vi] * 0.5 + 0.5;
  return o;
}
@fragment fn fs(in : VO) -> @location(0) vec4f {
  let px = vec2i(in.cp.xy);
  var c = textureLoad(accT, px, 0).rgb / max(DP.x, 1.0);
  c *= DP.y;
  let mode = u32(DP.z + 0.5);
  if (mode == 0u) { c = aces(c * 0.9); }
  else if (mode == 1u) { c = agx(c * 1.1); }
  else if (mode == 2u) { c = c / (c + 1.0); }
  c = pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.2));
  if (DP.w > 0.5) {
    let q = in.uv - 0.5;
    c *= 1.0 - dot(q, q) * 0.55;                       // 暗角
    let g = h21(in.cp.xy + vec2f(DP2.x * 61.7, DP2.x * 31.3)) - 0.5;
    c += g * 0.014;                                     // 胶片颗粒
  }
  return vec4f(c, 1.0);
}
`;

  /* ---------------- FXAA ---------------- */
  VT4.WGSL.fxaa = /* wgsl */`
@group(0) @binding(0) var t : texture_2d<f32>;
@group(0) @binding(1) var s : sampler;
@group(0) @binding(2) var<uniform> SC : vec4f; // 1/w,1/h,-,-
fn lum(c : vec3f) -> f32 { return dot(c, vec3f(0.299, 0.587, 0.114)); }
struct VO { @builtin(position) cp : vec4f, @location(0) uv : vec2f };
@vertex fn vs(@builtin(vertex_index) vi : u32) -> VO {
  var p = array<vec2f,3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
  var o : VO; o.cp = vec4f(p[vi], 0.0, 1.0); o.uv = p[vi] * 0.5 + 0.5;
  return o;
}
@fragment fn fs(in : VO) -> @location(0) vec4f {
  let px = SC.xy;
  let cM = textureSampleLevel(t, s, in.uv, 0.0).rgb;
  let cNW = textureSampleLevel(t, s, in.uv + vec2f(-1,-1) * px, 0.0).rgb;
  let cNE = textureSampleLevel(t, s, in.uv + vec2f( 1,-1) * px, 0.0).rgb;
  let cSW = textureSampleLevel(t, s, in.uv + vec2f(-1, 1) * px, 0.0).rgb;
  let cSE = textureSampleLevel(t, s, in.uv + vec2f( 1, 1) * px, 0.0).rgb;
  let lM = lum(cM); let lNW = lum(cNW); let lNE = lum(cNE); let lSW = lum(cSW); let lSE = lum(cSE);
  let lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  let lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < 0.06) { return vec4f(cM, 1.0); }
  var dir = vec2f(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  dir = normalize(dir + vec2f(1e-5));
  let cA = 0.5 * (textureSampleLevel(t, s, in.uv + dir * (1.0/3.0 - 0.5) * px, 0.0).rgb
              + textureSampleLevel(t, s, in.uv + dir * (2.0/3.0 - 0.5) * px, 0.0).rgb);
  let cB = cA * 0.5 + 0.25 * (textureSampleLevel(t, s, in.uv + dir * -0.5 * px, 0.0).rgb
              + textureSampleLevel(t, s, in.uv + dir * 0.5 * px, 0.0).rgb);
  let lB = lum(cB);
  if (lB < lMin || lB > lMax) { return vec4f(cA, 1.0); }
  return vec4f(cB, 1.0);
}
`;
})();
