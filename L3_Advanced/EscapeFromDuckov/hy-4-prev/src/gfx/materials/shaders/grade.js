// 全屏调色（文档 §5.1）：对比 +10~15%、饱和 −20%、ACES Tonemapping，奠定废土低饱和暗沉底色。
// 角色层在本 pass 之后绘制，故不受影响 —— 这就是"角色保持固有色"的实现方式。
import * as THREE from 'three';
import { POST_VERT, ACES_FN } from './post.js';

export const ColorGradeShader = {
  name: 'ColorGrade',
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.13 },
    uSaturation: { value: 0.80 },
    uExposure: { value: 1.04 },
    uExposureNight: { value: 1.18 },
    uNight: { value: 0 },
    uTint: { value: new THREE.Color(0xfff2dd) },
    uTintAmount: { value: 0.10 },
    uAmount: { value: 1 },
    uTime: { value: 0 },
  },
  vertexShader: POST_VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    uniform float uContrast, uSaturation, uExposure, uExposureNight, uNight, uTintAmount, uAmount, uTime;
    uniform vec3 uTint;
    ${ACES_FN}
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (uAmount <= 0.001) { gl_FragColor = c; return; }
      vec3 col = c.rgb * mix(uExposure, uExposureNight, uNight);
      col = acesFilm(col);
      // 调色的对比/饱和度必须在"显示参考空间"里做：
      // 线性空间的 0.5 是极亮值，拿它当支点会把整幅画面压成黑色。
      vec3 d = pow(max(col, 0.0), vec3(1.0 / 2.2));
      float l = dot(d, vec3(0.2126, 0.7152, 0.0722));
      d = mix(vec3(l), d, uSaturation);
      d = (d - 0.5) * uContrast + 0.5;
      d = mix(d, d * uTint, uTintAmount);
      gl_FragColor = vec4(max(pow(max(d, 0.0), vec3(2.2)), 0.0), c.a);
    }
  `,
};
