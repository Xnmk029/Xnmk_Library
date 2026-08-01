struct Uniforms {
  resolution: vec2<f32>;
  seed: f32;
  maxBounces: f32;
  samples: f32;
  cameraPos: vec3<f32>;
  cameraDir: vec3<f32>;
  cameraUp: vec3<f32>;
  cameraRight: vec3<f32>;
  fov: f32;
};

struct Camera {
  pos: vec3<f32>;
  dir: vec3<f32>;
  up: vec3<f32>;
  right: vec3<f32>;
  fov: f32;
};

struct Sphere {
  center: vec3<f32>;
  radius: f32;
  albedo: vec3<f32>;
  emission: vec3<f32>;
  type: f32;
};

struct Plane {
  normal: vec3<f32>;
  d: f32;
  albedo: vec3<f32>;
  emission: vec3<f32>;
  type: f32;
};

[[group(0), binding(0)]] var<uniform> uniforms: Uniforms;
[[group(0), binding(1)]] var accumIn: texture_storage_2d<rgba16f, read>;
[[group(0), binding(2)]] var accumOut: texture_storage_2d<rgba16f, write>;

var<private> spheres: array<Sphere, 4>;
var<private> planes: array<Plane, 6>;

fn initScene() {
  spheres[0] = Sphere(vec3<f32>(0.0, -0.6, 0.0), 0.4, vec3<f32>(0.9, 0.2, 0.2), vec3<f32>(0.0), 0.0);
  spheres[1] = Sphere(vec3<f32>(-0.9, 0.0, 0.5), 0.3, vec3<f32>(0.95, 0.95, 0.95), vec3<f32>(0.0), 1.0);
  spheres[2] = Sphere(vec3<f32>(0.9, 0.0, 0.3), 0.3, vec3<f32>(0.9, 0.9, 0.9), vec3<f32>(0.0), 2.0);
  spheres[3] = Sphere(vec3<f32>(0.0, 0.0, -100.4), 100.0, vec3<f32>(0.2, 0.8, 0.2), vec3<f32>(0.0), 0.0);

  planes[0] = Plane(vec3<f32>(0.0, 1.0, 0.0), 1.0, vec3<f32>(0.9), vec3<f32>(0.0), 0.0);
  planes[1] = Plane(vec3<f32>(0.0, -1.0, 0.0), 1.0, vec3<f32>(0.9), vec3<f32>(0.0), 0.0);
  planes[2] = Plane(vec3<f32>(1.0, 0.0, 0.0), 1.0, vec3<f32>(0.8, 0.3, 0.3), vec3<f32>(0.0), 0.0);
  planes[3] = Plane(vec3<f32>(-1.0, 0.0, 0.0), 1.0, vec3<f32>(0.3, 0.3, 0.8), vec3<f32>(0.0), 0.0);
  planes[4] = Plane(vec3<f32>(0.0, 0.0, 1.0), 1.0, vec3<f32>(0.9), vec3<f32>(0.0), 0.0);
  planes[5] = Plane(vec3<f32>(0.0, 0.0, -1.0), 1.0, vec3<f32>(0.0), vec3<f32>(8.0, 8.0, 8.0), 0.0);
}

fn random(seed: ptr<function, f32>) -> f32 {
  *seed = fract(*seed * 78.233 + uniforms.seed);
  return *seed;
}

fn cosineSampleHemisphere(u1: f32, u2: f32) -> vec3<f32> {
  let r = sqrt(u1);
  let theta = 6.2831853 * u2;
  return vec3<f32>(r * cos(theta), r * sin(theta), sqrt(max(0.0, 1.0 - u1)));
}

fn reflect(v: vec3<f32>, n: vec3<f32>) -> vec3<f32> {
  return v - 2.0 * dot(v, n) * n;
}

fn refract(v: vec3<f32>, n: vec3<f32>, eta: f32) -> vec3<f32> {
  let cosTheta = dot(-v, n);
  let k = 1.0 - eta * eta * (1.0 - cosTheta * cosTheta);
  if (k < 0.0) { return vec3<f32>(0.0); }
  return eta * v + (eta * cosTheta - sqrt(k)) * n;
}

struct HitResult {
  t: f32;
  position: vec3<f32>;
  normal: vec3<f32>;
  albedo: vec3<f32>;
  emission: vec3<f32>;
  type: f32;
  hit: bool;
};

fn intersectSphere(rayOrigin: vec3<f32>, rayDir: vec3<f32>, s: Sphere) -> f32 {
  let oc = rayOrigin - s.center;
  let b = 2.0 * dot(oc, rayDir);
  let c = dot(oc, oc) - s.radius * s.radius;
  let disc = b * b - 4.0 * c;
  if (disc < 0.0) { return 1e20; }
  let t = (-b - sqrt(disc)) / 2.0;
  if (t < 1e-4) { return 1e20; }
  return t;
}

fn intersectPlane(rayOrigin: vec3<f32>, rayDir: vec3<f32>, p: Plane) -> f32 {
  let denom = dot(p.normal, rayDir);
  if (abs(denom) < 1e-6) { return 1e20; }
  let t = -(dot(p.normal, rayOrigin) + p.d) / denom;
  if (t < 1e-4) { return 1e20; }
  return t;
}

fn intersectScene(rayOrigin: vec3<f32>, rayDir: vec3<f32>) -> HitResult {
  var result: HitResult;
  result.t = 1e20;
  result.hit = false;

  for (var i: i32 = 0; i < 4; i = i + 1) {
    let t = intersectSphere(rayOrigin, rayDir, spheres[i]);
    if (t < result.t) {
      result.t = t;
      result.position = rayOrigin + rayDir * t;
      result.normal = normalize(result.position - spheres[i].center);
      result.albedo = spheres[i].albedo;
      result.emission = spheres[i].emission;
      result.type = spheres[i].type;
      result.hit = true;
    }
  }

  for (var i: i32 = 0; i < 6; i = i + 1) {
    let t = intersectPlane(rayOrigin, rayDir, planes[i]);
    if (t < result.t) {
      result.t = t;
      result.position = rayOrigin + rayDir * t;
      result.normal = planes[i].normal;
      result.albedo = planes[i].albedo;
      result.emission = planes[i].emission;
      result.type = planes[i].type;
      result.hit = true;
    }
  }

  return result;
}

[[stage(compute), workgroup_size(16, 16)]]
fn main([[builtin(global_invocation_id)]] gid: vec3<u32>) {
  let dims = uniforms.resolution;
  if (gid.x >= u32(dims.x) || gid.y >= u32(dims.y)) { return; }

  initScene();

  var seed: f32 = f32(gid.x * 1973 + gid.y * 9277 + uniforms.samples * 31) + uniforms.seed;
  let u1 = random(&seed);
  let u2 = random(&seed);
  let uv = vec2<f32>(f32(gid.x) + u1, f32(gid.y) + u2) / dims;

  let scale = tan(uniforms.fov * 0.5);
  let x = (uv.x * 2.0 - 1.0) * scale;
  let y = (uv.y * 2.0 - 1.0) * scale * dims.y / dims.x;
  let rayDir = normalize(uniforms.cameraDir + uniforms.cameraRight * x + uniforms.cameraUp * y);

  var throughput = vec3<f32>(1.0);
  var radiance = vec3<f32>(0.0);
  var rayOrigin = uniforms.cameraPos;
  var rayD = rayDir;

  for (var bounce: i32 = 0; bounce < i32(uniforms.maxBounces); bounce = bounce + 1) {
    let hit = intersectScene(rayOrigin, rayD);
    if (!hit.hit) {
      let t = 0.5 * (rayD.y + 1.0);
      radiance += throughput * mix(vec3<f32>(0.2, 0.3, 0.5), vec3<f32>(0.4, 0.5, 0.7), t);
      break;
    }

    radiance += throughput * hit.emission;

    if (hit.type > 0.5 && hit.type < 1.5) {
      rayD = reflect(rayD, hit.normal);
      rayOrigin = hit.position + hit.normal * 1e-4;
      throughput *= hit.albedo;
      continue;
    }

    if (hit.type > 1.5) {
      let cosTheta = dot(-rayD, hit.normal);
      let eta = select(1.5, 1.0/1.5, cosTheta > 0.0);
      let newNormal = select(hit.normal, -hit.normal, cosTheta > 0.0);
      let refracted = refract(rayD, newNormal, eta);
      if (length(refracted) > 0.0) {
        rayD = normalize(refracted);
        rayOrigin = hit.position - newNormal * 1e-4;
      } else {
        rayD = reflect(rayD, newNormal);
        rayOrigin = hit.position + newNormal * 1e-4;
      }
      throughput *= hit.albedo;
      continue;
    }

    let u1 = random(&seed);
    let u2 = random(&seed);
    let localDir = cosineSampleHemisphere(u1, u2);
    let w = select(hit.normal, vec3<f32>(0,0,1), abs(hit.normal.z) < 0.999);
    let tangent = normalize(cross(w, hit.normal));
    let bitangent = cross(hit.normal, tangent);
    let newDir = normalize(tangent * localDir.x + bitangent * localDir.y + hit.normal * localDir.z);
    let cosTheta = max(0.0, dot(newDir, hit.normal));
    throughput *= hit.albedo * cosTheta / 3.14159265;
    rayD = newDir;
    rayOrigin = hit.position + hit.normal * 1e-4;
  }

  let newSample = radiance;

  let prev = accumIn.read(gid.xy);
  let totalSamples = f32(uniforms.samples);
  let accumulated = (prev.xyz * (totalSamples - 1.0) + newSample) / totalSamples;
  accumOut.write(gid.xy, vec4<f32>(accumulated, 1.0));
}
