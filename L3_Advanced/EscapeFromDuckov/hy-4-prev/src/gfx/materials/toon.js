// 赛璐璐卡通着色：MeshToonMaterial + gradientMap 阶梯光照 + onBeforeCompile 注入玩法向 uniform。
// 不自己写 ShaderMaterial，是为了白拿阴影、雾、USE_INSTANCING 注入与色彩空间处理。
import * as THREE from 'three';

/** 所有卡通材质共享的 uniform 对象：改一处，全场生效 */
export const gu = {
  uTime: { value: 0 },
  uThermal: { value: 0 },          // >0.5 切热成像
  uFowDark: { value: 0.22 },       // 迷雾区残余亮度
  uFogTint: { value: new THREE.Color(0x0a1018) },
  uHeatColor: { value: new THREE.Color(0xff7a2a) },
  uFlashColor: { value: new THREE.Color(0xfff2f2) },
  uStorm: { value: 0 },
  uFlashlight: { value: 0 },       // 手电开启时给被照物体一点补光
};

let _ramp = null;
/** 阶梯渐变图：N 段硬边界（NearestFilter）→ 明确的亮/过渡/暗三部 */
export function gradientMap(steps = 4) {
  if (_ramp) return _ramp;
  const data = new Uint8Array(steps);
  // 必须 clamp：Uint8Array 会把 263 截断成 8，最亮的一档反而变成近乎全黑
  for (let i = 0; i < steps; i++) data[i] = Math.min(255, Math.round(64 + (255 - 64) * (i / (steps - 1))));
  const t = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  _ramp = t;
  return t;
}

const FRAG_HEAD = `
uniform float uThermal; uniform float uFowDark; uniform float uTime;
uniform vec3 uHeatColor; uniform vec3 uFlashColor; uniform vec3 uFogTint;
`;

export function patchToon(mat, flags = {}) {
  const f = {
    fow: false, flash: false, heat: false, sway: false,
    ...flags,
  };
  // 用三个独立 attribute 名，避免"部分网格没绑定某属性"导致的未定义行为
  const attrs = [];
  if (f.fow) attrs.push('attribute float aState;');
  if (f.flash) attrs.push('attribute float aState2;');
  if (f.heat) attrs.push('attribute float aState3;');
  if (f.sway) attrs.push('attribute float aPhase;');
  const varys = [];
  if (f.fow) varys.push('varying float vFow;');
  if (f.flash) varys.push('varying float vFlash;');
  if (f.heat) varys.push('varying float vHeat;');
  if (f.sway) varys.push('varying float vPhase;');

  const vHead = attrs.join('\n') + '\n' + varys.join('\n') + '\nuniform float uTime;\n';
  let vBody = '';
  if (f.fow) vBody += '  vFow = aState;\n';
  if (f.flash) vBody += '  vFlash = aState2;\n';
  if (f.heat) vBody += '  vHeat = aState3;\n';
  if (f.sway) vBody += '  vPhase = aPhase;\n';
  if (f.sway) {
    vBody += `  {
    float h = max(transformed.y, 0.0);
    float w = sin(uTime * 1.6 + aPhase) * 0.5 + sin(uTime * 2.7 + aPhase * 1.7) * 0.5;
    transformed.x += w * 0.055 * h;
    transformed.z += w * 0.035 * h;
  }\n`;
  }

  const fHead = varys.join('\n') + '\n' + FRAG_HEAD;
  let fBody = '';
  if (f.flash) fBody += '  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlashColor, clamp(vFlash, 0.0, 1.0));\n';
  if (f.heat) fBody += '  gl_FragColor.rgb += uHeatColor * clamp(vHeat, 0.0, 1.0);\n';
  if (f.fow) fBody += '  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogTint, clamp(vFow, 0.0, 1.0) * (1.0 - uFowDark));\n';
  fBody += `  if (uThermal > 0.5) {
    float l = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 hot = mix(vec3(0.16, 0.10, 0.42), vec3(1.0, 0.86, 0.35), smoothstep(0.28, 0.92, l));
    gl_FragColor.rgb = mix(vec3(l) * vec3(0.55, 0.72, 1.15), hot, smoothstep(0.18, 0.55, l));
  }\n`;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, gu);
    shader.vertexShader = vHead + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n' + vBody
    );
    shader.fragmentShader = fHead + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\n' + fBody
    );
  };
  // 关键：没有这个，每个 mesh 都会编译一个新 program（首发/切热成像时 200ms 卡顿）
  const key = `toon|${f.fow ? 1 : 0}${f.flash ? 1 : 0}${f.heat ? 1 : 0}${f.sway ? 1 : 0}`;
  mat.customProgramCacheKey = () => key;
  mat.userData.toonFlags = f;
  return mat;
}

/** 建一个卡通材质 */
export function toon(params = {}, flags = {}) {
  const m = new THREE.MeshToonMaterial({
    gradientMap: gradientMap(4),
    ...params,
  });
  return patchToon(m, flags);
}

/** 未受光的自发光（枪口焰、热源 billboard、全息） */
export function unlit(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}
