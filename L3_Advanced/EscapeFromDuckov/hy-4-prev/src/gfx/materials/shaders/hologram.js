// 全息预览着色器（文档 §5.3）：Fresnel 边缘自发光 + 扫描线 + 透明度剪裁。
// 改装界面里给"尚未拥有的配件"用，营造高科技战术组装的观感。
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  vPos = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uTime, uAlpha, uScanSpeed, uGlow;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vPos;
void main() {
  float fres = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir)));
  fres = pow(fres, 2.2);
  // 水平扫描线：沿模型 Y 轴滚动
  float scan = sin((vPos.y * 26.0) - uTime * uScanSpeed * 6.0) * 0.5 + 0.5;
  float band = smoothstep(0.35, 0.9, scan);
  float a = (fres * uGlow + band * 0.35) * uAlpha;
  // 透明度剪裁：低于阈值直接丢弃，做出断续的全息栅格
  if (a < 0.04) discard;
  gl_FragColor = vec4(uColor * (0.75 + fres * 1.4), a);
}
`;

export function hologramMaterial(color = 0x5fd6ff) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uAlpha: { value: 0.9 },
      uScanSpeed: { value: 1.0 },
      uGlow: { value: 1.1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}
