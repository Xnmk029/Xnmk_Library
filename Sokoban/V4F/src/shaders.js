// ---------------------------------------------------------------
// GLSL 着色器
// 草地：移植自 Dylearn「Stylized Grass 3D Pixel Art」方案——
//  世界空间旋转 / 低帧率定格动画 / 伪透视 UV 补偿 / 多角色推开 /
//  混合卡通光影 / 云影投影 / 迷雾
// ---------------------------------------------------------------

// ---------------- 草地顶点着色器 ----------------
export const GRASS_VERT = /* glsl */ `
uniform float uTime;
uniform float uFps;              // 定格动画帧率
uniform float uWindStrength;
uniform sampler2D uWindNoiseTex;
uniform vec3 uWindDirection;     // 归一化风向
uniform vec4 uCharacters[64];    // x,y,z,radius
uniform float uCharacterCount;

varying vec2 vUv;
varying float vWindIntensity;
varying float vPlayerDisplacement;
varying vec3 vWorldPos;
varying float vInstTint;

#include <fog_pars_vertex>

mat4 rotationAxisAngle(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat4(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
    0.0,                                0.0,                                0.0,                                1.0
  );
}

void main() {
  vUv = uv;

  // 1. 实例世界坐标
  vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 worldPos = instancePos.xyz;

  // 2. 定格动画：按实例位置哈希错开刷新相位，避免全局卡顿
  float phaseOffset = fract(sin(dot(worldPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float steppedTime = floor((uTime + phaseOffset * 0.8) * uFps) / uFps;

  // 3. 风噪（两层不同频率 fbm 噪波相乘，乘无理数 1.314 破周期）
  vec2 noiseUV1 = worldPos.xz * 0.055 + uWindDirection.xz * steppedTime * 0.25;
  vec2 noiseUV2 = worldPos.xz * 0.023 + uWindDirection.xz * (steppedTime * 1.314) * 0.12;
  float noise1 = texture2D(uWindNoiseTex, noiseUV1).r;
  float noise2 = texture2D(uWindNoiseTex, noiseUV2).r;
  float windNoise = clamp(noise1 * noise2 * 1.7, 0.0, 1.0);
  vWindIntensity = windNoise;

  // 4. 绕「垂直于风向的水平轴」旋转，草尖位移最大
  vec3 rotAxis = normalize(vec3(-uWindDirection.z, 0.0, uWindDirection.x));
  float maxRotAngle = 0.5 * uWindStrength;
  float finalRotAngle = maxRotAngle * windNoise * uv.y * (0.7 + 0.6 * uv.y)
                        + (phaseOffset - 0.5) * 0.16;   // 每根草微小的静态倾角

  // 5. 多角色交互位移（由近及远倒数衰减，草尖位移最大）
  vec3 totalDisp = vec3(0.0);
  float dispFactor = 0.0;
  for (int i = 0; i < 64; i++) {
    if (float(i) >= uCharacterCount) break;
    vec3 charPos = uCharacters[i].xyz;
    float radius = uCharacters[i].w;
    float dist = distance(worldPos, charPos);
    if (dist < radius) {
      float force = 1.0 - (dist / radius);
      force = force * force;
      vec3 dirToGrass = worldPos - charPos;
      dirToGrass.y = 0.0;
      float len = length(dirToGrass);
      if (len > 0.0001) dirToGrass /= len; else dirToGrass = vec3(0.0, 0.0, 1.0);
      totalDisp += dirToGrass * force;
      dispFactor = max(dispFactor, force);
    }
  }
  vPlayerDisplacement = dispFactor;

  // 6. 几何形变：风旋转 + 角色推开
  vec4 localPosition = vec4(position, 1.0);
  localPosition = rotationAxisAngle(rotAxis, finalRotAngle) * localPosition;
  localPosition.xyz += totalDisp * uv.y * 0.9;

  vInstTint = fract(sin(dot(worldPos.xz * 1.31, vec2(7.77, 3.31))) * 43758.5453);
  vWorldPos = worldPos + localPosition.xyz;

  // 7. Y 轴 Billboard：草始终竖直并面向相机
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mvPosition.xy += localPosition.xy * vec2(
    length(modelMatrix[0].xyz),
    length(modelMatrix[1].xyz)
  );

  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`;

// ---------------- 草地片元着色器 ----------------
export const GRASS_FRAG = /* glsl */ `
uniform sampler2D uGrassTex;
uniform vec3 uBaseColor;
uniform vec3 uTipColor;
uniform vec3 uWindDirection;
uniform vec3 uCameraForward;
uniform float uPerspectiveIntensity;
uniform vec3 uLightDir;
uniform sampler2D uCloudTex;
uniform float uTime;
uniform float uCloudSpeed;
uniform float uCloudEnabled;

varying vec2 vUv;
varying float vWindIntensity;
varying float vPlayerDisplacement;
varying vec3 vWorldPos;
varying float vInstTint;

#include <fog_pars_fragment>

// 混合卡通光影：多阶 + 平滑过渡带，避免像素突变闪烁
float getHybridToonShadow(float NdotL, float bands, float smoothness) {
  float bandWidth = 1.0 / bands;
  float rawValue = NdotL * 0.5 + 0.5;
  float stepped = floor(rawValue * bands) / bands;
  float dist = rawValue - stepped;
  float edge = bandWidth * smoothness;
  return stepped + smoothstep(0.0, edge, dist) * bandWidth;
}

void main() {
  // 1. 伪透视补偿：风/位移把草压扁时沿 X 拉伸 UV，抵消“纸片感”
  float dotAlign = abs(dot(normalize(uWindDirection), normalize(uCameraForward)));
  float scaleFactor = 1.0 + (vWindIntensity * 0.3 + vPlayerDisplacement * 0.5)
                            * (1.0 - vUv.y) * dotAlign * uPerspectiveIntensity;
  vec2 correctedUv = vUv;
  correctedUv.x = (correctedUv.x - 0.5) / scaleFactor + 0.5;

  // 2. 草叶贴图 + Alpha 剪裁
  vec4 texColor = texture2D(uGrassTex, correctedUv);
  if (texColor.a < 0.5) discard;

  // 3. 颜色：基色→尖色渐变 + 实例色调变化
  vec3 finalColor = mix(uBaseColor, uTipColor, pow(vUv.y, 1.25));
  finalColor *= 0.82 + 0.36 * vInstTint;

  // 4. 混合卡通光影（法线朝上，统一柔和受光）
  vec3 lightDir = normalize(uLightDir);
  vec3 normal = vec3(0.0, 1.0, 0.0);
  float NdotL = dot(normal, lightDir);
  float toonLight = getHybridToonShadow(NdotL, 3.0, 0.25);
  finalColor *= (0.5 + toonLight * 0.5);

  // 5. 云影
  vec2 cloudUV = vWorldPos.xz * 0.004 + uTime * uCloudSpeed;
  float cloudShadow = texture2D(uCloudTex, cloudUV).r;
  float cloudFactor = mix(1.0, mix(0.6, 1.0, cloudShadow), uCloudEnabled);
  finalColor *= cloudFactor;

  // 6. 风压轻微变暗，增加“活物感”
  finalColor *= 1.0 - vWindIntensity * 0.05;

  gl_FragColor = vec4(finalColor * texColor.rgb, 1.0);

  #include <fog_fragment>
}
`;

// ---------------- 地形顶点着色器 ----------------
export const TERRAIN_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;

#include <fog_pars_vertex>

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(normalMatrix * normal);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`;

// ---------------- 地形片元着色器 ----------------
export const TERRAIN_FRAG = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColDirt;
uniform vec3 uShoreColor;
uniform vec2 uPondCenter;
uniform float uPondR;
uniform sampler2D uCloudTex;
uniform float uTime;
uniform float uCloudSpeed;
uniform float uCloudEnabled;

varying vec3 vWorldPos;
varying vec3 vNormal;

#include <fog_pars_fragment>

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float getHybridToonShadow(float NdotL, float bands, float smoothness) {
  float bandWidth = 1.0 / bands;
  float rawValue = NdotL * 0.5 + 0.5;
  float stepped = floor(rawValue * bands) / bands;
  float dist = rawValue - stepped;
  float edge = bandWidth * smoothness;
  return stepped + smoothstep(0.0, edge, dist) * bandWidth;
}

void main() {
  vec3 n = normalize(vNormal);
  float NdotL = dot(n, normalize(uLightDir));

  // 草色斑驳（晶格化避免闪烁）
  float mottle = hash21(floor(vWorldPos.xz * 0.055));
  vec3 col = mix(uColA, uColB, mottle);

  // 陡坡露土
  float slope = 1.0 - n.y;
  col = mix(col, uColDirt, smoothstep(0.16, 0.42, slope));

  // 大块明暗斑块
  float blotch = hash21(floor(vWorldPos.xz * 0.017 + 5.5));
  col *= 0.88 + 0.24 * blotch;

  // 池塘岸线：湿土
  float dPond = distance(vWorldPos.xz, uPondCenter);
  float shore = smoothstep(uPondR * 1.55, uPondR * 0.8, dPond);
  col = mix(col, uShoreColor, shore);

  // 混合卡通光影
  float toonLight = getHybridToonShadow(NdotL, 3.0, 0.3);
  col *= (0.5 + toonLight * 0.5);

  // 云影
  vec2 cloudUV = vWorldPos.xz * 0.004 + uTime * uCloudSpeed;
  float cloudShadow = texture2D(uCloudTex, cloudUV).r;
  float cloudFactor = mix(1.0, mix(0.6, 1.0, cloudShadow), uCloudEnabled);
  col *= cloudFactor;

  gl_FragColor = vec4(col, 1.0);

  #include <fog_fragment>
}
`;

// ---------------- 花朵顶点着色器 ----------------
export const FLOWER_VERT = /* glsl */ `
uniform float uTime;
uniform float uFps;
uniform float uWindStrength;
uniform sampler2D uWindNoiseTex;
uniform vec3 uWindDirection;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vColor;

#include <fog_pars_vertex>

void main() {
  vUv = uv;
  vColor = instanceColor;

  vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 worldPos = instancePos.xyz;

  float phase = fract(sin(dot(worldPos.xz, vec2(9.7, 61.3))) * 43758.5453);
  float steppedTime = floor((uTime + phase) * uFps) / uFps;
  vec2 nuv = worldPos.xz * 0.09 + uWindDirection.xz * steppedTime * 0.3;
  float wind = clamp(texture2D(uWindNoiseTex, nuv).r * 1.4, 0.0, 1.0);

  vec3 rotAxis = normalize(vec3(-uWindDirection.z, 0.0, uWindDirection.x));
  float rotAngle = 0.32 * uWindStrength * wind * uv.y;
  vec3 pos = position;
  float s = sin(rotAngle), c = cos(rotAngle);
  pos = pos * c + cross(rotAxis, pos) * s + rotAxis * dot(rotAxis, pos) * (1.0 - c);

  vWorldPos = worldPos + pos;

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mvPosition.xy += pos.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`;

// ---------------- 花朵片元着色器 ----------------
export const FLOWER_FRAG = /* glsl */ `
uniform sampler2D uFlowerTex;
uniform vec3 uLightDir;
uniform sampler2D uCloudTex;
uniform float uTime;
uniform float uCloudSpeed;
uniform float uCloudEnabled;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vColor;

#include <fog_pars_fragment>

float getHybridToonShadow(float NdotL, float bands, float smoothness) {
  float bandWidth = 1.0 / bands;
  float rawValue = NdotL * 0.5 + 0.5;
  float stepped = floor(rawValue * bands) / bands;
  float dist = rawValue - stepped;
  float edge = bandWidth * smoothness;
  return stepped + smoothstep(0.0, edge, dist) * bandWidth;
}

void main() {
  vec4 texColor = texture2D(uFlowerTex, vUv);
  if (texColor.a < 0.5) discard;

  vec3 finalColor = texColor.rgb * mix(vColor, vec3(1.0), 0.35);

  vec3 lightDir = normalize(uLightDir);
  float toonLight = getHybridToonShadow(dot(vec3(0.0, 1.0, 0.0), lightDir), 3.0, 0.25);
  finalColor *= (0.5 + toonLight * 0.5);

  vec2 cloudUV = vWorldPos.xz * 0.004 + uTime * uCloudSpeed;
  float cloudShadow = texture2D(uCloudTex, cloudUV).r;
  float cloudFactor = mix(1.0, mix(0.6, 1.0, cloudShadow), uCloudEnabled);
  finalColor *= cloudFactor;

  gl_FragColor = vec4(finalColor, 1.0);

  #include <fog_fragment>
}
`;
