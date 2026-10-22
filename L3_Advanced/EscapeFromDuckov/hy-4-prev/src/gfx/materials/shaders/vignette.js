// 战损/低血量反馈（文档 §3.4）：屏幕边缘红色椭圆渐晕（随 HP 正弦呼吸）
// + 流血/疼痛时的色散重影与雪花噪点。
import * as THREE from 'three';
import { POST_VERT, NOISE_FN } from './post.js';

export const VignetteShader = {
  name: 'VignetteCA',
  uniforms: {
    tDiffuse: { value: null },
    uHp: { value: 1 },          // 生命百分比
    uBleed: { value: 0 },
    uPain: { value: 0 },
    uDrunk: { value: 0 },
    uInfection: { value: 0 },
    uPanic: { value: 0 },
    uTime: { value: 0 },
    uAmount: { value: 1 },
    uAspect: { value: 1.777 },
  },
  vertexShader: POST_VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    uniform float uHp, uBleed, uPain, uDrunk, uInfection, uPanic, uTime, uAmount, uAspect;
    ${NOISE_FN}
    void main() {
      vec2 uv = vUv;
      float ca = (uBleed * 0.0035 + uPain * 0.0022 + uDrunk * 0.0040) * uAmount;
      // 呼吸感：强度随 HP 正弦波动
      float pulse = 0.72 + 0.28 * sin(uTime * 2.4);
      float lowHp = clamp(1.0 - uHp, 0.0, 1.0);
      float inj = max(lowHp, uBleed * 0.85);

      vec3 col;
      if (ca > 0.00002) {
        vec2 dir = uv - 0.5;
        float r = texture2D(tDiffuse, uv + dir * ca).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - dir * ca).b;
        col = vec3(r, g, b);
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }
      if (uAmount <= 0.001) { gl_FragColor = vec4(col, 1.0); return; }

      // 边缘血光：椭圆渐变，强度随伤势与呼吸
      vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) * 2.0;
      float d = length(p);
      float edge = smoothstep(0.62, 1.42, d);
      vec3 blood = vec3(0.72, 0.10, 0.08);
      col = mix(col, blood, edge * inj * 0.62 * pulse);

      // 常态微暗角（微缩模型质感）
      col *= 1.0 - smoothstep(0.85, 1.85, d) * 0.28;

      // 感染时的病态绿
      col = mix(col, col * vec3(0.86, 1.10, 0.82), uInfection * 0.55);
      // 恐慌：轻微去色 + 冷调
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, mix(vec3(l), vec3(l) * vec3(0.80, 0.86, 1.0), 0.5), uPanic * 0.35);

      // 雪花噪点
      float n = snoise(uv * vec2(320.0, 220.0) + uTime * 12.0);
      col += (n - 0.5) * (uBleed * 0.10 + uPain * 0.06 + uInfection * 0.05);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
