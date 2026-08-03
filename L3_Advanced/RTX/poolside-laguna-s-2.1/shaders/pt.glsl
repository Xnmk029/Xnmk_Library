precision highp float;

uniform vec2 u_resolution;
uniform float u_seed;
uniform int u_maxBounces;
uniform int u_samples;
uniform vec3 u_cameraPos;
uniform vec3 u_cameraDir;
uniform vec3 u_cameraUp;
uniform vec3 u_cameraRight;
uniform float u_fov;

varying vec2 v_uv;

#define NUM_SPHERES 4
#define NUM_PLANES 6

struct Sphere {
  vec3 center;
  float radius;
  vec3 albedo;
  vec3 emission;
  int type;
};

struct Plane {
  vec3 normal;
  float d;
  vec3 albedo;
  vec3 emission;
  int type;
};

Sphere spheres[NUM_SPHERES];
Plane planes[NUM_PLANES];

void initScene() {
  spheres[0] = Sphere(vec3(0.0, -0.6, 0.0), 0.4, vec3(0.9, 0.2, 0.2), vec3(0.0), 0);
  spheres[1] = Sphere(vec3(-0.9, 0.0, 0.5), 0.3, vec3(0.95, 0.95, 0.95), vec3(0.0), 1);
  spheres[2] = Sphere(vec3(0.9, 0.0, 0.3), 0.3, vec3(0.9, 0.9, 0.9), vec3(0.0), 2);
  spheres[3] = Sphere(vec3(0.0, 0.0, -100.4), 100.0, vec3(0.2, 0.8, 0.2), vec3(0.0), 0);

  planes[0] = Plane(vec3(0.0, 1.0, 0.0), 1.0, vec3(0.9), vec3(0.0), 0);
  planes[1] = Plane(vec3(0.0, -1.0, 0.0), 1.0, vec3(0.9), vec3(0.0), 0);
  planes[2] = Plane(vec3(1.0, 0.0, 0.0), 1.0, vec3(0.8, 0.3, 0.3), vec3(0.0), 0);
  planes[3] = Plane(vec3(-1.0, 0.0, 0.0), 1.0, vec3(0.3, 0.3, 0.8), vec3(0.0), 0);
  planes[4] = Plane(vec3(0.0, 0.0, 1.0), 1.0, vec3(0.9), vec3(0.0), 0);
  planes[5] = Plane(vec3(0.0, 0.0, -1.0), 1.0, vec3(0.0), vec3(8.0, 8.0, 8.0), 0);
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec2 random2(vec2 st) {
  return vec2(random(st), random(st + 37.0));
}

vec3 random3(vec2 st) {
  return vec3(random(st), random(st + 13.0), random(st + 71.0));
}

vec3 cosineSampleHemisphere(vec2 u) {
  float r = sqrt(u.x);
  float theta = 6.2831853 * u.y;
  return vec3(r * cos(theta), r * sin(theta), sqrt(max(0.0, 1.0 - u.x)));
}

vec3 reflectVec(vec3 v, vec3 n) {
  return v - 2.0 * dot(v, n) * n;
}

vec3 refractVec(vec3 v, vec3 n, float eta) {
  float cosTheta = dot(-v, n);
  float k = 1.0 - eta * eta * (1.0 - cosTheta * cosTheta);
  if (k < 0.0) return vec3(0.0);
  return eta * v + (eta * cosTheta - sqrt(k)) * n;
}

struct HitResult {
  float t;
  vec3 position;
  vec3 normal;
  vec3 albedo;
  vec3 emission;
  int type;
  bool hit;
};

float intersectSphere(vec3 ro, vec3 rd, Sphere s) {
  vec3 oc = ro - s.center;
  float b = 2.0 * dot(oc, rd);
  float c = dot(oc, oc) - s.radius * s.radius;
  float disc = b * b - 4.0 * c;
  if (disc < 0.0) return 1e20;
  float t = (-b - sqrt(disc)) / 2.0;
  if (t < 1e-4) return 1e20;
  return t;
}

float intersectPlane(vec3 ro, vec3 rd, Plane p) {
  float denom = dot(p.normal, rd);
  if (abs(denom) < 1e-6) return 1e20;
  float t = -(dot(p.normal, ro) + p.d) / denom;
  if (t < 1e-4) return 1e20;
  return t;
}

HitResult intersectScene(vec3 ro, vec3 rd) {
  HitResult result;
  result.t = 1e20;
  result.hit = false;

  for (int i = 0; i < NUM_SPHERES; i++) {
    float t = intersectSphere(ro, rd, spheres[i]);
    if (t < result.t) {
      result.t = t;
      result.position = ro + rd * t;
      result.normal = normalize(result.position - spheres[i].center);
      result.albedo = spheres[i].albedo;
      result.emission = spheres[i].emission;
      result.type = spheres[i].type;
      result.hit = true;
    }
  }

  for (int i = 0; i < NUM_PLANES; i++) {
    float t = intersectPlane(ro, rd, planes[i]);
    if (t < result.t) {
      result.t = t;
      result.position = ro + rd * t;
      result.normal = planes[i].normal;
      result.albedo = planes[i].albedo;
      result.emission = planes[i].emission;
      result.type = planes[i].type;
      result.hit = true;
    }
  }

  return result;
}

void main() {
  initScene();

  vec2 res = u_resolution;
  vec2 st = (gl_FragCoord.xy + vec2(random(v_uv + u_seed), random(v_uv + u_seed + 37.0))) / res;

  float scale = tan(u_fov * 0.5);
  float x = (st.x * 2.0 - 1.0) * scale;
  float y = (st.y * 2.0 - 1.0) * scale * res.y / res.x;
  vec3 rayDir = normalize(u_cameraDir + u_cameraRight * x + u_cameraUp * y);
  vec3 rayOrigin = u_cameraPos;

  vec3 throughput = vec3(1.0);
  vec3 radiance = vec3(0.0);
  vec2 seed = v_uv * u_seed;

  for (int bounce = 0; bounce < 16; bounce++) {
    if (bounce >= u_maxBounces) break;

    HitResult hit = intersectScene(rayOrigin, rayDir);
    if (!hit.hit) {
      float t = 0.5 * (rayDir.y + 1.0);
      radiance += throughput * mix(vec3(0.2, 0.3, 0.5), vec3(0.4, 0.5, 0.7), t);
      break;
    }

    radiance += throughput * hit.emission;

    if (hit.type == 1) {
      rayDir = reflectVec(rayDir, hit.normal);
      rayOrigin = hit.position + hit.normal * 1e-4;
      throughput *= hit.albedo;
      continue;
    }

    if (hit.type == 2) {
      float cosTheta = dot(-rayDir, hit.normal);
      float eta = (cosTheta > 0.0) ? 1.0/1.5 : 1.5;
      vec3 newNormal = (cosTheta > 0.0) ? -hit.normal : hit.normal;
      vec3 refracted = refractVec(rayDir, newNormal, eta);
      if (length(refracted) > 0.0) {
        rayDir = normalize(refracted);
        rayOrigin = hit.position - newNormal * 1e-4;
      } else {
        rayDir = reflectVec(rayDir, newNormal);
        rayOrigin = hit.position + newNormal * 1e-4;
      }
      throughput *= hit.albedo;
      continue;
    }

    vec2 u = vec2(random(seed), random(seed + 13.0));
    vec3 localDir = cosineSampleHemisphere(u);
    vec3 w = (abs(hit.normal.z) < 0.999) ? vec3(0,0,1) : vec3(1,0,0);
    vec3 tangent = normalize(cross(w, hit.normal));
    vec3 bitangent = cross(hit.normal, tangent);
    vec3 newDir = normalize(tangent * localDir.x + bitangent * localDir.y + hit.normal * localDir.z);
    float cosTheta = max(0.0, dot(newDir, hit.normal));
    throughput *= hit.albedo * cosTheta / 3.14159265;
    rayDir = newDir;
    rayOrigin = hit.position + hit.normal * 1e-4;
  }

  gl_FragColor = vec4(radiance, 1.0);
}
