// 热成像屏幕后处理（文档 §3.3）：色彩替换在材质内由 uThermal 完成，
// 本 pass 只叠加扫描线、噪点与冷调晕影，并穿透浓烟高亮热源。
import { POST_VERT, NOISE_FN } from './post.js';

export const ThermalShader = {
  name: 'ThermalFX',
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0 },
    uTime: { value: 0 },
    uScan: { value: 0.16 },
    uGrain: { value: 0.09 },
  },
  vertexShader: POST_VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    uniform float uAmount, uTime, uScan, uGrain;
    ${NOISE_FN}
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (uAmount <= 0.001) { gl_FragColor = c; return; }
      vec3 col = c.rgb;
      // 扫描线
      float sl = sin((vUv.y + uTime * 0.06) * 900.0) * 0.5 + 0.5;
      col *= 1.0 - uScan * sl * uAmount;
      // 缓慢滚动的水平条纹（探测器刷新）
      float band = smoothstep(0.0, 0.06, abs(fract(vUv.y * 0.5 - uTime * 0.05) - 0.5));
      col *= mix(1.0, 0.92 + 0.08 * band, uAmount);
      // 探测器噪点
      float n = snoise(vUv * 260.0 + uTime * 30.0);
      col += (n - 0.5) * uGrain * uAmount;
      // 边角冷晕
      vec2 p = (vUv - 0.5) * 2.0;
      col = mix(col, col * vec3(0.55, 0.70, 1.0), smoothstep(0.5, 1.5, length(p)) * 0.45 * uAmount);
      gl_FragColor = vec4(col, c.a);
    }
  `,
};
