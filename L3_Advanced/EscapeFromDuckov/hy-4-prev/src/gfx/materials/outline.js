// 卡通描边（文档 §2.1 方法一：背面外扩 Back-Face Extrusion Pass）。
// 单独一份 ShaderMaterial，渲染反面并沿法线外扩，得到硬朗等宽黑边。
import * as THREE from 'three';

const VERT = /* glsl */`
#include <common>
uniform float uWidth;
uniform float uPerspective;
#ifdef USE_INSTANCING
  attribute float aOutline;
#endif
void main() {
  #include <beginnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  vec3 nrm = objectNormal;
  #ifdef USE_INSTANCING
    nrm = mat3(instanceMatrix) * objectNormal;
  #endif
  nrm = normalize(normalMatrix * nrm);
  // 正交投影下 -mvPosition.z 不代表距离，宽度保持恒定；透视模式才按距离缩放
  float w = uWidth * mix(1.0, clamp(-mvPosition.z * 0.09, 0.6, 2.4), uPerspective);
  #ifdef USE_INSTANCING
    w *= aOutline;
  #endif
  gl_Position = projectionMatrix * vec4(mvPosition.xyz + nrm * w, 1.0);
}
`;

const FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor, uOpacity); }
`;

export function outlineMaterial({ width = 0.035, color = 0x10151a, opacity = 1, instanced = false } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uWidth: { value: width },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPerspective: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    transparent: opacity < 1,
    depthWrite: true,
  });
  m.customProgramCacheKey = () => 'outline' + (instanced ? 'i' : '');
  return m;
}
