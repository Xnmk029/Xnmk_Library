export const frameWGSL = /* wgsl */ `
struct Frame {
  viewProj: mat4x4<f32>,
  view: mat4x4<f32>,
  proj: mat4x4<f32>,
  shadowVP: mat4x4<f32>,
  cameraPos: vec4<f32>,
  sunDir: vec4<f32>,
  sunColor: vec4<f32>,
  zenith: vec4<f32>,
  horizon: vec4<f32>,
  groundC: vec4<f32>,
  p0: vec4<f32>,
  p1: vec4<f32>,
  clipPlane: vec4<f32>,
  jitter: vec4<f32>,
  fillA: vec4<f32>,
  fillB: vec4<f32>,
  fillC: vec4<f32>,
  p2: vec4<f32>,
  paintBase: vec4<f32>,
  paintDark: vec4<f32>,
  paintEra: vec4<f32>,
  paintEra2: vec4<f32>,
  paintCloth: vec4<f32>,
  paintHelm: vec4<f32>,
};
struct Mats { data: array<vec4<f32>, 64> };
`;

const vary = /* wgsl */ `
struct Vary {
  @builtin(position) pos: vec4<f32>,
  @location(0) world: vec3<f32>,
  @location(1) nrm: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) @interpolate(flat) part: vec4<f32>,
};
`;

const shadeFns = /* wgsl */ `
override PASS: f32 = 0.0;

fn hash21(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

fn envColor(dirIn: vec3<f32>) -> vec3<f32> {
  let dir = normalize(dirIn);
  let up = smoothstep(-0.08, 0.35, dir.y);
  var col = mix(frame.horizon.xyz, frame.zenith.xyz, pow(max(up, 0.0), 0.65));
  let groundMix = smoothstep(0.05, -0.25, dir.y);
  col = mix(col, frame.groundC.xyz * 0.55, groundMix);
  let sd = dot(dir, normalize(frame.sunDir.xyz));
  let ang = max(frame.sunColor.w, 0.0015);
  let sun = smoothstep(1.0 - ang * 6.0, 1.0, sd);
  col = col + frame.sunColor.xyz * frame.sunDir.w * sun * 1.8;
  return col;
}

fn applyPaint(id: u32, albedo: vec3<f32>, world: vec3<f32>) -> vec3<f32> {
  if (frame.p1.w > 1.5 && (id == 0u || id == 1u || id == 10u || id == 11u)) {
    let n = hash21(floor(world.xz * 0.55));
    let n2 = hash21(floor(world.xz * 0.22 + vec2<f32>(3.0, 1.0)));
    if (n2 > 0.78) { return vec3<f32>(0.11, 0.12, 0.09); }
    if (n > 0.58) { return vec3<f32>(0.46, 0.39, 0.26); }
    return frame.paintBase.xyz;
  }
  if (id == 0u) { return frame.paintBase.xyz; }
  if (id == 1u) { return frame.paintDark.xyz; }
  if (id == 2u) { return frame.paintEra.xyz; }
  if (id == 3u) { return frame.paintEra2.xyz; }
  if (id == 10u) { return frame.paintCloth.xyz; }
  if (id == 11u) { return frame.paintHelm.xyz; }
  return albedo;
}

fn shadowVis(world: vec3<f32>, nrm: vec3<f32>) -> f32 {
  let lp = frame.shadowVP * vec4<f32>(world + nrm * 0.03, 1.0);
  let ndc = lp.xyz / max(lp.w, 0.0001);
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, -ndc.y * 0.5 + 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || ndc.z < 0.0 || ndc.z > 1.0) {
    return 1.0;
  }
  let base = ndc.z - 0.002;
  var vis = 0.0;
  let soft = frame.p2.y;
  for (var i = 0; i < 8; i = i + 1) {
    let ang = (f32(i) + frame.p1.y * 0.41) * 2.399963;
    let rad = (f32(i) + 0.5) / 8.0 * soft;
    let o = vec2<f32>(cos(ang), sin(ang)) * rad;
    vis = vis + textureSampleCompareLevel(shadowMap, shadowSamp, uv + o, base);
  }
  return vis / 8.0;
}

fn shade(world: vec3<f32>, nrmIn: vec3<f32>, uv: vec2<f32>, part: vec4<f32>, edge: f32, front: bool) -> vec4<f32> {
  let id = u32(part.x + 0.5);
  let interior = part.y;
  let a = mats.data[id * 2u];
  let b = mats.data[id * 2u + 1u];
  var albedo = applyPaint(id, a.xyz, world);
  let metallic = a.w;
  var rough = clamp(b.x, 0.045, 1.0);
  var emission = albedo * b.y;
  var ao = b.z;

  if (id == 2u || id == 3u) {
    let fu = fract(uv);
    let border = step(fu.x, 0.08) + step(0.92, fu.x) + step(fu.y, 0.08) + step(0.92, fu.y);
    albedo = albedo * mix(1.0, 0.62, clamp(border, 0.0, 1.0));
    let bolt = smoothstep(0.11, 0.07, length(fu - vec2<f32>(0.5, 0.5)));
    albedo = mix(albedo, albedo * 0.45, bolt);
    rough = mix(rough, 0.32, bolt);
  }
  if (id == 7u) {
    let groove = smoothstep(0.15, 0.0, abs(fract(uv.x * 3.0) - 0.5));
    albedo = albedo * mix(1.0, 0.7, groove);
  }
  if (id == 17u) {
    let n = hash21(floor(world.xz * 3.0));
    albedo = mix(albedo, frame.groundC.xyz, 0.78);
    albedo = albedo * (0.86 + n * 0.22);
    var rut = 0.0;
    for (var s = 0; s < 2; s = s + 1) {
      let sx = select(-1.36, 1.36, s == 1);
      let dx = world.x - sx;
      let groove = exp(-dx * dx / 0.055);
      let along = smoothstep(-3.8, -2.6, world.z) * smoothstep(4.6, 3.3, world.z);
      rut = max(rut, groove * along);
    }
    let chev = smoothstep(0.35, 0.95, abs(sin(world.z * 46.0)));
    albedo = albedo * mix(1.0, 0.62, rut * 0.85);
    albedo = albedo * mix(1.0, 0.9, rut * chev);
    rough = mix(rough, 0.78, rut * 0.4);
  }
  if (id == 16u) {
    let scan = step(0.55, fract(uv.y * 7.0 + frame.cameraPos.w * 0.35));
    let col = mix(vec3<f32>(0.05, 0.35, 0.16), vec3<f32>(0.45, 1.0, 0.62), scan);
    emission = col * 1.6;
    albedo = col * 0.2;
  }

  let N = normalize(nrmIn);
  let V = normalize(frame.cameraPos.xyz - world);
  let L = normalize(frame.sunDir.xyz);
  let nl = max(dot(N, L), 0.0);
  let nv = max(dot(N, V), 0.0);
  let H = normalize(L + V);
  let nh = max(dot(N, H), 0.0);
  let a2 = rough * rough;
  let d = nh * nh * (a2 - 1.0) + 1.0;
  let D = a2 / (3.14159265 * d * d + 0.0001);
  let k = (rough + 1.0) * (rough + 1.0) / 8.0;
  let G = (nv / (nv * (1.0 - k) + k)) * (nl / (nl * (1.0 - k) + k));
  let F0 = mix(vec3<f32>(0.04), albedo, metallic);
  let F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  let spec = D * G * F / (4.0 * nv * nl + 0.001);
  let kd = (vec3<f32>(1.0) - F) * (1.0 - metallic);
  let vis = shadowVis(world, N);
  let sun = frame.sunColor.xyz * frame.sunDir.w;
  var color = (kd * albedo / 3.14159265 + spec) * sun * nl * vis;

  let hemi = mix(frame.groundC.xyz, frame.zenith.xyz, clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
  let R = reflect(-V, N);
  let envSpec = envColor(R);
  let fres = pow(1.0 - nv, 5.0);
  color = color + hemi * albedo * (1.0 - metallic) * ao * 0.55;
  color = color + envSpec * mix(F0, vec3<f32>(1.0), fres) * (1.0 - rough) * 0.35;
  let bounce = frame.groundC.xyz * frame.sunDir.w * max(N.y, 0.0) * albedo * 0.08;
  color = color + bounce;

  let fillL = normalize(frame.fillA.xyz);
  let rimL = normalize(frame.fillB.xyz);
  color = color + albedo * frame.fillC.xyz * frame.fillA.w * max(dot(N, fillL), 0.0) * (0.35 + 0.65 * (1.0 - metallic));
  color = color + vec3<f32>(0.75, 0.82, 1.0) * frame.fillB.w * pow(max(dot(N, rimL), 0.0), 1.4);

  if (interior > 0.5) {
    let lift = frame.p2.z;
    color = color + albedo * lift;
    color = color + vec3<f32>(1.0, 0.92, 0.75) * max(dot(N, normalize(vec3<f32>(0.2, 0.8, 0.4))), 0.0) * (0.22 + lift * 0.35);
  }

  let cavity = clamp(1.0 - edge * 2.2, 0.45, 1.0);
  ao = ao * cavity;
  color = color * mix(0.72, 1.0, ao);

  if (frame.p0.w > 0.5) {
    let ink = smoothstep(0.12, 0.55, edge);
    color = mix(color, color * 0.25, ink * 0.65);
  }

  if (frame.p0.y > 0.5 && part.z > 0.5) {
    let stripe = fract(dot(world, vec3<f32>(0.35, 0.8, 0.2)) * 1.6 - frame.cameraPos.w * 0.35);
    let band = smoothstep(0.42, 0.5, stripe) * smoothstep(0.72, 0.58, stripe);
    color = mix(color, vec3<f32>(1.0, 0.42, 0.12), 0.55);
    emission = emission + vec3<f32>(1.0, 0.35, 0.08) * (0.25 + band * 0.9);
  }

  color = color + emission;
  let viewZ = max(length(frame.cameraPos.xyz - world), 0.001);
  let xray = frame.p0.z > 0.5;
  let fogK = select(frame.fillC.w, select(frame.fillC.w * 0.35, 0.0, xray), frame.p1.x > 0.5 || xray);
  let fog = 1.0 - exp(-viewZ * fogK);
  color = mix(color, frame.horizon.xyz * 0.9, fog);

  var alpha = 1.0;
  if (PASS > 1.5) {
    let running = id == 6u || id == 7u || id == 23u;
    let glass = select(select(0.16, 0.05, running), select(0.02, 0.008, running), front);
    alpha = glass;
    color = mix(color, vec3<f32>(0.42, 0.48, 0.4), select(0.08, 0.62, front));
  }
  return vec4<f32>(color, alpha);
}
`;

export const solidShader = /* wgsl */ `
${frameWGSL}
${vary}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<uniform> mats: Mats;
@group(0) @binding(2) var shadowMap: texture_depth_2d;
@group(0) @binding(3) var shadowSamp: sampler_comparison;

struct Object {
  model: mat4x4<f32>,
  nmat: mat4x4<f32>,
  p: vec4<f32>,
};
@group(1) @binding(0) var<uniform> object: Object;

${shadeFns}

@vertex fn vs(
  @location(0) pos: vec3<f32>,
  @location(1) nrm: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) part: vec4<f32>
) -> Vary {
  var o: Vary;
  let world = object.model * vec4<f32>(pos, 1.0);
  var clip = frame.viewProj * world;
  clip.x = clip.x + frame.jitter.x * clip.w;
  clip.y = clip.y + frame.jitter.y * clip.w;
  o.pos = clip;
  o.world = world.xyz;
  o.nrm = normalize((object.nmat * vec4<f32>(nrm, 0.0)).xyz);
  o.uv = uv;
  o.part = part;
  return o;
}

@fragment fn fs(v: Vary, @builtin(front_facing) front: bool) -> @location(0) vec4<f32> {
  let edge = length(fwidth(v.nrm));
  let interior = v.part.y;
  if (PASS < 0.5 && interior > 0.5) { discard; }
  if (PASS > 0.5 && PASS < 1.5 && interior < 0.5) { discard; }
  if (PASS > 1.5 && interior > 0.5) { discard; }
  if (frame.p1.x > 0.5 && interior < 0.5 && (PASS < 0.5 || PASS > 1.5)) {
    if (dot(vec4<f32>(v.world, 1.0), frame.clipPlane) > 0.0) { discard; }
  }
  return shade(v.world, v.nrm, v.uv, v.part, edge, front);
}
`;

export const instShader = /* wgsl */ `
${frameWGSL}
${vary}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<uniform> mats: Mats;
@group(0) @binding(2) var shadowMap: texture_depth_2d;
@group(0) @binding(3) var shadowSamp: sampler_comparison;

struct Inst {
  model: mat4x4<f32>,
  nmat: mat4x4<f32>,
  p: vec4<f32>,
};
@group(1) @binding(0) var<storage, read> instances: array<Inst>;

${shadeFns}

@vertex fn vs(
  @location(0) pos: vec3<f32>,
  @location(1) nrm: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) part: vec4<f32>,
  @builtin(instance_index) id: u32
) -> Vary {
  var o: Vary;
  let inst = instances[id];
  let world = inst.model * vec4<f32>(pos, 1.0);
  var clip = frame.viewProj * world;
  clip.x = clip.x + frame.jitter.x * clip.w;
  clip.y = clip.y + frame.jitter.y * clip.w;
  o.pos = clip;
  o.world = world.xyz;
  o.nrm = normalize((inst.nmat * vec4<f32>(nrm, 0.0)).xyz);
  o.uv = uv;
  o.part = vec4<f32>(part.x, max(part.y, inst.p.y), max(part.z, inst.p.x), part.w);
  return o;
}

@fragment fn fs(v: Vary, @builtin(front_facing) front: bool) -> @location(0) vec4<f32> {
  let edge = length(fwidth(v.nrm));
  let interior = v.part.y;
  if (PASS < 0.5 && interior > 0.5) { discard; }
  if (PASS > 0.5 && PASS < 1.5 && interior < 0.5) { discard; }
  if (PASS > 1.5 && interior > 0.5) { discard; }
  if (frame.p1.x > 0.5 && interior < 0.5 && (PASS < 0.5 || PASS > 1.5)) {
    if (dot(vec4<f32>(v.world, 1.0), frame.clipPlane) > 0.0) { discard; }
  }
  return shade(v.world, v.nrm, v.uv, v.part, edge, front);
}
`;

export const shadowShader = /* wgsl */ `
${frameWGSL}
@group(0) @binding(0) var<uniform> frame: Frame;
struct Object {
  model: mat4x4<f32>,
  nmat: mat4x4<f32>,
  p: vec4<f32>,
};
@group(1) @binding(0) var<uniform> object: Object;

@vertex fn vs(@location(0) pos: vec3<f32>) -> @builtin(position) vec4<f32> {
  let world = object.model * vec4<f32>(pos, 1.0);
  return frame.shadowVP * world;
}
`;

export const shadowInstShader = /* wgsl */ `
${frameWGSL}
@group(0) @binding(0) var<uniform> frame: Frame;
struct Inst {
  model: mat4x4<f32>,
  nmat: mat4x4<f32>,
  p: vec4<f32>,
};
@group(1) @binding(0) var<storage, read> instances: array<Inst>;

@vertex fn vs(@location(0) pos: vec3<f32>, @builtin(instance_index) id: u32) -> @builtin(position) vec4<f32> {
  let world = instances[id].model * vec4<f32>(pos, 1.0);
  return frame.shadowVP * world;
}
`;

export const skyShader = /* wgsl */ `
${frameWGSL}
@group(0) @binding(0) var<uniform> frame: Frame;

struct SkyOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex fn vs(@builtin(vertex_index) id: u32) -> SkyOut {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var o: SkyOut;
  o.pos = vec4<f32>(p[id], 0.9999, 1.0);
  o.uv = p[id];
  return o;
}

@fragment fn fs(v: SkyOut) -> @location(0) vec4<f32> {
  let ndc = v.uv;
  let right = vec3<f32>(frame.view[0][0], frame.view[1][0], frame.view[2][0]);
  let up = vec3<f32>(frame.view[0][1], frame.view[1][1], frame.view[2][1]);
  let back = vec3<f32>(frame.view[0][2], frame.view[1][2], frame.view[2][2]);
  let viewRay = vec3<f32>(ndc.x / frame.proj[0][0], ndc.y / frame.proj[1][1], -1.0);
  let dir = normalize(right * viewRay.x + up * viewRay.y + back * viewRay.z);
  let upMix = smoothstep(-0.05, 0.4, dir.y);
  var col = mix(frame.horizon.xyz, frame.zenith.xyz, pow(max(upMix, 0.0), 0.7));
  col = mix(col, frame.groundC.xyz * 0.65, smoothstep(0.02, -0.2, dir.y));
  let sd = dot(dir, normalize(frame.sunDir.xyz));
  let ang = max(frame.sunColor.w, 0.002);
  col = col + frame.sunColor.xyz * frame.sunDir.w * smoothstep(1.0 - ang * 8.0, 1.0, sd);
  if (frame.p0.z > 0.5) {
    col = mix(vec3<f32>(0.045, 0.05, 0.055), vec3<f32>(0.1, 0.11, 0.12), upMix);
  }
  return vec4<f32>(col, 1.0);
}
`;

export const particleShader = /* wgsl */ `
${frameWGSL}
@group(0) @binding(0) var<uniform> frame: Frame;

struct POut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) alpha: f32,
  @location(2) kind: f32,
};

@vertex fn vs(
  @location(0) corner: vec2<f32>,
  @location(1) center: vec3<f32>,
  @location(2) misc: vec3<f32>
) -> POut {
  let right = vec3<f32>(frame.view[0][0], frame.view[1][0], frame.view[2][0]);
  let up = vec3<f32>(frame.view[0][1], frame.view[1][1], frame.view[2][1]);
  let world = center + (right * corner.x + up * corner.y) * misc.x;
  var clip = frame.viewProj * vec4<f32>(world, 1.0);
  clip.x = clip.x + frame.jitter.x * clip.w;
  clip.y = clip.y + frame.jitter.y * clip.w;
  var o: POut;
  o.pos = clip;
  o.uv = corner;
  o.alpha = misc.y;
  o.kind = misc.z;
  return o;
}

@fragment fn fs(v: POut) -> @location(0) vec4<f32> {
  let d = length(v.uv);
  let a = smoothstep(0.72, 0.08, d) * v.alpha;
  if (a < 0.01) { discard; }
  let dust = mix(vec3<f32>(0.72, 0.62, 0.46), vec3<f32>(0.55, 0.46, 0.32), v.kind);
  return vec4<f32>(dust * 0.85, a);
}
`;

export const accumShader = /* wgsl */ `
@group(0) @binding(0) var sampleTex: texture_2d<f32>;
@group(0) @binding(1) var histTex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
struct Acc { count: f32, _pad0: f32, _pad1: f32, _pad2: f32 };
@group(0) @binding(3) var<uniform> acc: Acc;

struct V { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex fn vs(@builtin(vertex_index) id: u32) -> V {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var o: V;
  o.pos = vec4<f32>(p[id], 0.0, 1.0);
  o.uv = vec2<f32>(p[id].x * 0.5 + 0.5, 0.5 - p[id].y * 0.5);
  return o;
}

@fragment fn fs(v: V) -> @location(0) vec4<f32> {
  let s = textureSampleLevel(sampleTex, samp, v.uv, 0.0).rgb;
  let n = acc.count;
  if (n < 0.5) { return vec4<f32>(s, 1.0); }
  let h = textureSampleLevel(histTex, samp, v.uv, 0.0).rgb;
  return vec4<f32>((h * n + s) / (n + 1.0), 1.0);
}
`;

export const presentShader = /* wgsl */ `
@group(0) @binding(0) var hdrTex: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
struct Present { exposure: f32, tonemap: f32, bloom: f32, _p: f32 };
@group(0) @binding(2) var<uniform> present: Present;

struct V { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex fn vs(@builtin(vertex_index) id: u32) -> V {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var o: V;
  o.pos = vec4<f32>(p[id], 0.0, 1.0);
  o.uv = vec2<f32>(p[id].x * 0.5 + 0.5, 0.5 - p[id].y * 0.5);
  return o;
}

fn aces(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
  return clamp((x * (a * x + vec3<f32>(b))) / (x * (c * x + vec3<f32>(d)) + vec3<f32>(e)), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment fn fs(v: V) -> @location(0) vec4<f32> {
  var hdr = textureSampleLevel(hdrTex, samp, v.uv, 0.0).rgb;
  var bloom = vec3<f32>(0.0);
  let r = 0.0012;
  bloom = bloom + max(textureSampleLevel(hdrTex, samp, v.uv + vec2<f32>(r, 0.0), 0.0).rgb - vec3<f32>(1.15), vec3<f32>(0.0));
  bloom = bloom + max(textureSampleLevel(hdrTex, samp, v.uv + vec2<f32>(-r, 0.0), 0.0).rgb - vec3<f32>(1.15), vec3<f32>(0.0));
  bloom = bloom + max(textureSampleLevel(hdrTex, samp, v.uv + vec2<f32>(0.0, r), 0.0).rgb - vec3<f32>(1.15), vec3<f32>(0.0));
  bloom = bloom + max(textureSampleLevel(hdrTex, samp, v.uv + vec2<f32>(0.0, -r), 0.0).rgb - vec3<f32>(1.15), vec3<f32>(0.0));
  hdr = hdr + bloom * 0.18 * present.bloom;
  hdr = hdr * exp2(present.exposure);
  var mapped = hdr;
  let mode = present.tonemap;
  if (mode < 0.5) { mapped = aces(hdr); }
  else if (mode < 1.5) { mapped = hdr / (vec3<f32>(1.0) + hdr); }
  else if (mode < 2.5) {
    let x = max(vec3<f32>(0.0), hdr - vec3<f32>(0.004));
    mapped = (x * (6.2 * x + vec3<f32>(0.5))) / (x * (6.2 * x + vec3<f32>(1.7)) + vec3<f32>(0.06));
    return vec4<f32>(mapped, 1.0);
  } else {
    mapped = clamp(hdr, vec3<f32>(0.0), vec3<f32>(1.0));
  }
  let srgb = pow(max(mapped, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
  let vig = smoothstep(1.35, 0.55, length(v.uv - vec2<f32>(0.5)));
  return vec4<f32>(srgb * mix(0.94, 1.0, vig), 1.0);
}
`;
