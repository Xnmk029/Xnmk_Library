// VOXY CRAFT — 水面着色器（浅水折射水下 / 深水反射天空 + 涟漪 + 菲涅尔）
// 水深编码在 aColor.a（网格化时写入）。低成本近似，无额外 RT pass。SPEC-技术 §8.6。
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute vec4 aColor;
  varying vec4 vColor;
  varying vec3 vWorld;
  void main() {
    vColor = aColor;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec4 vColor;
  varying vec3 vWorld;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSkyColor;
  uniform vec3 uCamPos;
  uniform float uDay;

  void main() {
    float depth = vColor.a;                       // 0 浅 .. 1 深
    vec2 p = vWorld.xz * 0.7;
    float n = sin(p.x * 3.1 + uTime * 1.6) * 0.5 + sin(p.y * 2.6 - uTime * 1.2) * 0.5
            + sin((p.x + p.y) * 1.7 + uTime * 0.8) * 0.35;
    vec3 N = normalize(vec3(n * 0.09, 1.0, n * 0.09));
    vec3 V = normalize(uCamPos - vWorld);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);

    vec3 R = reflect(-V, N);
    float sunRefl = pow(max(dot(R, uSunDir), 0.0), 48.0);
    vec3 refl = uSkyColor * (0.55 + 0.45 * max(R.y, 0.0)) + vec3(1.0, 0.9, 0.7) * sunRefl * 0.9;

    vec3 refr = vColor.rgb * (0.5 + 0.2 * n) + vec3(0.02, 0.06, 0.05);  // 折射水下色调

    float deepMix = clamp(depth * 1.15 + fres * 0.75, 0.0, 1.0);
    vec3 col = mix(refr, refl, deepMix);
    col *= 0.45 + 0.55 * uDay;                    // 夜晚变暗
    gl_FragColor = vec4(col, 0.92);
  }
`;

export function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSkyColor: { value: new THREE.Color(0xbcd6ee) },
      uCamPos: { value: new THREE.Vector3() },
      uDay: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });
}
