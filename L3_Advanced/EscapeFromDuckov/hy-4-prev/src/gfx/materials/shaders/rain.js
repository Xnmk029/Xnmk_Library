// 风暴区恶劣气候（文档 §3.5）：屏幕挂雨痕（法线偏移折射背景）
// + 距离消隐高度雾 + 落雷白闪。镜头级效果，故置于链尾覆盖全画面。
import { POST_VERT, NOISE_FN } from './post.js';

export const RainShader = {
  name: 'RainLens',
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0 },      // 雨强 0..1
    uStorm: { value: 0 },
    uTime: { value: 0 },
    uFlash: { value: 0 },       // 落雷瞬时亮度
    uFogColor: { value: null },
    uWind: { value: 0.6 },
  },
  vertexShader: POST_VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    uniform float uAmount, uStorm, uTime, uFlash, uWind;
    ${NOISE_FN}

    // 雨痕法线：竖向条纹 + 缓慢下滑的水珠
    vec2 rainNormal(vec2 uv, float t){
      vec2 g = uv * vec2(9.0, 3.2);
      g.y += t * 1.35;
      float streak = snoise(g * 2.4) * 0.6 + snoise(g * 5.1) * 0.4;
      // 水珠：沿 y 缓慢滑落的大颗粒
      vec2 d = uv * vec2(7.0, 2.0);
      d.y += t * 0.55 + snoise(vec2(uv.x * 6.0, 1.7)) * 0.4;
      float drop = smoothstep(0.72, 0.98, snoise(d * 3.0));
      float n1 = snoise(uv * 14.0 + vec2(t * 0.3, t * 1.9));
      float n2 = snoise(uv * 26.0 - vec2(t * 0.2, t * 2.7));
      return vec2(streak * 0.5 + n1 * 0.35 + drop * 0.4 + uWind * 0.16,
                  drop * 0.9 + n2 * 0.3);
    }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (uAmount <= 0.001 && uFlash <= 0.001) { gl_FragColor = c; return; }
      vec3 col = c.rgb;
      if (uAmount > 0.001) {
        vec2 n = rainNormal(vUv, uTime);
        float a = uAmount * (0.6 + uStorm * 0.4);
        vec2 off = n * 0.012 * a;
        col = mix(col, texture2D(tDiffuse, vUv + off).rgb, 0.85);
        // 雨幕整体压暗 + 冷调
        col = mix(col, col * vec3(0.72, 0.80, 0.92), a * 0.5);
        // 水痕高光
        col += vec3(0.10, 0.12, 0.15) * smoothstep(0.55, 1.0, n.y) * a;
      }
      col += vec3(0.85, 0.90, 1.0) * uFlash;                 // 落雷
      gl_FragColor = vec4(col, c.a);
    }
  `,
};
