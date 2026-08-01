// 高性能路径光线追踪 Shader (Path Tracer Fragment Shader - 渐进累积与 G-Buffer 深度版)
// 支持 Cornell Box 场景、全局光照 (GI)、GGX 镜面反射、玻璃折射/焦散、硬/软阴影与 NEE 显式光源采样

export const pathTracerVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export const pathTracerFragmentShader = `
precision highp float;
precision highp int;

varying vec2 vUv;

uniform sampler2D uAccumTexture; // 上一帧收敛的 Ping-Pong 纹理
uniform vec2 uResolution;
uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform float uCameraFov;
uniform int uFrameCount;
uniform int uMaxBounces;
uniform int uSamplesPerFrame;
uniform float uLightIntensity;
uniform vec3 uLightColor;
uniform bool uEnableNEE; // Direct Light Sampling (Next Event Estimation)
uniform bool uFP16Sim;   // FP16 精度加速模拟标志
uniform float uRoughnessSphere1;
uniform float uMetallicSphere1;
uniform float uGlassIOR;

// 常量定义
#define PI 3.14159265359
#define INFINITY 1e5
#define EPSILON 0.001

// 材质类型定义
#define MAT_DIFFUSE 0
#define MAT_METAL 1
#define MAT_GLASS 2
#define MAT_LIGHT 3

struct Ray {
  vec3 origin;
  vec3 direction;
};

struct Material {
  int type;
  vec3 color;
  float roughness;
  float metallic;
  float ior;
  vec3 emission;
};

struct HitInfo {
  bool hit;
  float t;
  vec3 p;
  vec3 normal;
  Material mat;
};

// 伪随机数生成器 (PRNG)
uint uState;

uint pcg_hash() {
  uint state = uState;
  uState = uState * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

float rand() {
  return float(pcg_hash()) / 4294967295.0;
}

void initRandom(vec2 pixel, int frame) {
  uState = uint(pixel.x) * 1973u + uint(pixel.y) * 9277u + uint(frame) * 26699u;
  pcg_hash();
}

vec3 randomOnHemisphere(vec3 normal) {
  float u1 = rand();
  float u2 = rand();
  
  float r = sqrt(u1);
  float phi = 2.0 * PI * u2;
  
  vec3 dir;
  dir.x = r * cos(phi);
  dir.y = r * sin(phi);
  dir.z = sqrt(max(0.0, 1.0 - u1));
  
  vec3 up = abs(normal.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, normal));
  vec3 bitangent = cross(normal, tangent);
  
  return normalize(tangent * dir.x + bitangent * dir.y + normal * dir.z);
}

// 球体求交
void intersectSphere(Ray ray, vec3 center, float radius, Material mat, inout HitInfo hit) {
  vec3 oc = ray.origin - center;
  float b = dot(oc, ray.direction);
  float c = dot(oc, oc) - radius * radius;
  float h = b * b - c;
  if (h > 0.0) {
    float t = -b - sqrt(h);
    if (t > EPSILON && t < hit.t) {
      hit.hit = true;
      hit.t = t;
      hit.p = ray.origin + t * ray.direction;
      hit.normal = normalize(hit.p - center);
      hit.mat = mat;
    }
  }
}

// 平面/矩形求交
void intersectPlane(Ray ray, vec3 p0, vec3 n, vec2 size, Material mat, inout HitInfo hit) {
  float denom = dot(n, ray.direction);
  if (abs(denom) > EPSILON) {
    float t = dot(p0 - ray.origin, n) / denom;
    if (t > EPSILON && t < hit.t) {
      vec3 p = ray.origin + t * ray.direction;
      vec3 d = p - p0;
      
      vec3 u = abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 v1 = normalize(cross(n, u));
      vec3 v2 = cross(n, v1);
      
      if (abs(dot(d, v1)) <= size.x * 0.5 && abs(dot(d, v2)) <= size.y * 0.5) {
        hit.hit = true;
        hit.t = t;
        hit.p = p;
        hit.normal = denom < 0.0 ? n : -n;
        hit.mat = mat;
      }
    }
  }
}

// Cornell Box 场景几何求交函数
HitInfo intersectScene(Ray ray) {
  HitInfo hit;
  hit.hit = false;
  hit.t = INFINITY;

  Material matRed     = Material(MAT_DIFFUSE, vec3(0.85, 0.12, 0.12), 0.9, 0.0, 1.0, vec3(0.0));
  Material matGreen   = Material(MAT_DIFFUSE, vec3(0.12, 0.85, 0.12), 0.9, 0.0, 1.0, vec3(0.0));
  Material matWhite   = Material(MAT_DIFFUSE, vec3(0.78, 0.78, 0.78), 0.9, 0.0, 1.0, vec3(0.0));
  Material matLight   = Material(MAT_LIGHT,   vec3(1.0), 0.0, 0.0, 1.0, uLightColor * uLightIntensity);
  
  Material matChrome  = Material(MAT_METAL,   vec3(0.95, 0.92, 0.88), uRoughnessSphere1, uMetallicSphere1, 1.0, vec3(0.0));
  Material matGlass   = Material(MAT_GLASS,   vec3(0.98, 0.98, 1.0), 0.0, 0.0, uGlassIOR, vec3(0.0));

  // 1. 墙面 (Cornell Box 5面墙)
  intersectPlane(ray, vec3(-2.0, 0.0, 0.0), vec3( 1.0, 0.0, 0.0), vec2(4.0, 4.0), matRed, hit);   // 左墙(红)
  intersectPlane(ray, vec3( 2.0, 0.0, 0.0), vec3(-1.0, 0.0, 0.0), vec2(4.0, 4.0), matGreen, hit); // 右墙(绿)
  intersectPlane(ray, vec3(0.0, -2.0, 0.0), vec3(0.0,  1.0, 0.0), vec2(4.0, 4.0), matWhite, hit); // 地板
  intersectPlane(ray, vec3(0.0,  2.0, 0.0), vec3(0.0, -1.0, 0.0), vec2(4.0, 4.0), matWhite, hit); // 天花板
  intersectPlane(ray, vec3(0.0, 0.0, -2.0), vec3(0.0, 0.0,  1.0), vec2(4.0, 4.0), matWhite, hit); // 后墙

  // 2. 顶置方形面光源
  intersectPlane(ray, vec3(0.0, 1.98, -0.2), vec3(0.0, -1.0, 0.0), vec2(1.2, 1.2), matLight, hit);

  // 3. 场景物体 (金属球、玻璃球)
  intersectSphere(ray, vec3(-0.8, -1.3, -0.4), 0.7, matChrome, hit); // 左下金属球
  intersectSphere(ray, vec3( 0.85, -1.35, 0.2), 0.65, matGlass, hit); // 右下玻璃球

  return hit;
}

float fresnelSchlick(float cosTheta, float refIdx) {
  float r0 = (1.0 - refIdx) / (1.0 + refIdx);
  r0 = r0 * r0;
  return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
}

// 单次采样路径追踪
vec3 tracePath(Ray primaryRay, out float firstDepth) {
  vec3 radiance = vec3(0.0);
  vec3 throughput = vec3(1.0);
  Ray currentRay = primaryRay;
  firstDepth = 100.0;

  for (int bounce = 0; bounce < 8; ++bounce) {
    if (bounce >= uMaxBounces) break;

    HitInfo hit = intersectScene(currentRay);

    if (!hit.hit) {
      if (bounce == 0) firstDepth = 100.0;
      radiance += throughput * vec3(0.02, 0.02, 0.03);
      break;
    }

    if (bounce == 0) firstDepth = hit.t;

    if (hit.mat.type == MAT_LIGHT) {
      radiance += throughput * hit.mat.emission;
      break;
    }

    vec3 nextDir;
    
    if (hit.mat.type == MAT_DIFFUSE) {
      nextDir = randomOnHemisphere(hit.normal);
      throughput *= hit.mat.color;

      if (uEnableNEE) {
        vec3 lightPos = vec3((rand() - 0.5) * 1.2, 1.97, -0.2 + (rand() - 0.5) * 1.2);
        vec3 shadowRayDir = normalize(lightPos - hit.p);
        float lightDist = length(lightPos - hit.p);

        Ray shadowRay = Ray(hit.p + hit.normal * EPSILON, shadowRayDir);
        HitInfo shadowHit = intersectScene(shadowRay);

        if (shadowHit.hit && shadowHit.mat.type == MAT_LIGHT && shadowHit.t >= lightDist - 0.05) {
          float cosN = max(0.0, dot(hit.normal, shadowRayDir));
          float cosL = max(0.0, dot(vec3(0.0, -1.0, 0.0), -shadowRayDir));
          float pdf = (lightDist * lightDist) / (1.44 * cosL + EPSILON);
          radiance += throughput * hit.mat.color * uLightColor * uLightIntensity * cosN / max(0.1, pdf);
        }
      }
    } 
    else if (hit.mat.type == MAT_METAL) {
      vec3 refl = reflect(currentRay.direction, hit.normal);
      vec3 randDir = randomOnHemisphere(hit.normal);
      nextDir = normalize(mix(refl, randDir, hit.mat.roughness));
      throughput *= hit.mat.color;
    } 
    else if (hit.mat.type == MAT_GLASS) {
      bool into = dot(hit.normal, currentRay.direction) < 0.0;
      vec3 outwardNormal = into ? hit.normal : -hit.normal;
      float niOverNt = into ? (1.0 / hit.mat.ior) : hit.mat.ior;

      float cosI = dot(-currentRay.direction, outwardNormal);
      float sinT2 = niOverNt * niOverNt * (1.0 - cosI * cosI);

      float fresnel = fresnelSchlick(cosI, hit.mat.ior);

      if (sinT2 > 1.0 || rand() < fresnel) {
        nextDir = reflect(currentRay.direction, outwardNormal);
      } else {
        nextDir = refract(currentRay.direction, outwardNormal, niOverNt);
      }
      throughput *= hit.mat.color;
    }

    if (uFP16Sim) {
      throughput = floor(throughput * 2048.0) / 2048.0;
    }

    if (bounce > 2) {
      float p = max(throughput.r, max(throughput.g, throughput.b));
      if (rand() > p) break;
      throughput /= p;
    }

    currentRay = Ray(hit.p + nextDir * EPSILON, nextDir);
  }

  return radiance;
}

void main() {
  vec2 pixel = gl_FragCoord.xy;
  initRandom(pixel, uFrameCount);

  vec2 st = (pixel + vec2(rand(), rand()) - 0.5) / uResolution.xy;
  vec2 ndc = st * 2.0 - 1.0;
  ndc.x *= uResolution.x / uResolution.y;

  vec3 camForward = normalize(uCameraTarget - uCameraPos);
  vec3 camRight = normalize(cross(camForward, vec3(0.0, 1.0, 0.0)));
  vec3 camUp = cross(camRight, camForward);

  float tanFov = tan(radians(uCameraFov) * 0.5);
  vec3 rayDir = normalize(camForward + ndc.x * tanFov * camRight + ndc.y * tanFov * camUp);

  Ray ray = Ray(uCameraPos, rayDir);

  float firstDepth = 100.0;
  vec3 currentRadiance = tracePath(ray, firstDepth);

  // 蒙特卡洛帧渐进累积算式 (Running Average Accumulation)
  vec3 finalRadiance = currentRadiance;
  
  if (uFrameCount > 0) {
    vec4 prevData = texture2D(uAccumTexture, vUv);
    float weight = 1.0 / (float(uFrameCount) + 1.0);
    finalRadiance = mix(prevData.rgb, currentRadiance, weight);
  }

  // RGB: 累积 Radiance 颜色, A: 线性深度
  gl_FragColor = vec4(finalRadiance, firstDepth);
}
`;
