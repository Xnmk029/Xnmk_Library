import * as THREE from 'three';

// ================= 后处理：深度描边 + 废土调色 + 血光/雨痕/热成像 =================
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float uTime;
uniform vec2 uRes;
uniform float uSaturation;
uniform float uContrast;
uniform float uNightBlue;
uniform float uVignette;
uniform float uDamage;
uniform float uPain;
uniform float uDrunk;
uniform float uGrain;
uniform float uRain;
uniform float uRainDir;
uniform float uMode;   // 0 normal, 1 thermal, 2 nightvision
uniform float uNoiseAmp;
varying vec2 vUv;

float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

vec2 rainUv(vec2 uv){
  float t = uTime * (0.25 + uRain);
  vec2 r = vec2(uv.x + t * uRainDir, uv.y + t);
  vec2 g = fract(r * vec2(29.0, 37.0)) - 0.5;
  g = fract(g * vec2(13.7, 17.3));
  return uv + g * 0.012 * uRain;
}

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

void main(){
  vec2 uv = vUv;
  vec2 px = 1.0 / uRes;
  vec2 wob = vec2(sin(uTime*7.3), cos(uTime*6.1)) * 0.0035 * uDrunk;
  uv += wob;

  // ---- 雨痕折射 ----
  if(uRain > 0.01){
    float t = uTime * (2.0 + 4.0*uRain);
    vec2 rp = vec2(uv.x + t*0.13*uRainDir, uv.y + t*0.05);
    float d1 = sin(rp.x*230.0)*sin(rp.y*190.0);
    float d2 = sin((rp*1.7).x*170.0)*sin((rp*1.7).y*130.0);
    float drop = smoothstep(0.82, 1.0, 0.5+0.5*d1) * 0.55 + smoothstep(0.9,1.0,0.5+0.5*d2)*0.35;
    uv += vec2(d1*0.4, d2*0.4) * drop * 0.008 * uRain;
  }

  // ---- 色差（疼痛/醉酒） ----
  float ca = 0.0015 + uPain*0.004 + uDrunk*0.005;
  float r = texture2D(tDiffuse, uv + vec2(ca,0.0)).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - vec2(ca,0.0)).b;
  vec3 col = vec3(r,g,b);

  // ---- 深度描边（Sobel） ----
  float d = texture2D(tDepth, uv).r;
  float dL = texture2D(tDepth, uv - vec2(px.x,0.0)).r;
  float dR = texture2D(tDepth, uv + vec2(px.x,0.0)).r;
  float dU = texture2D(tDepth, uv - vec2(0.0,px.y)).r;
  float dD = texture2D(tDepth, uv + vec2(0.0,px.y)).r;
  float edge = abs(d - dL) + abs(d - dR) + abs(d - dU) + abs(d - dD);
  // 深度随距离增大而增大 → 相对阈值
  float th = 0.00012 + d * 0.012;
  float o = smoothstep(th, th*2.4, edge);
  col = mix(col, col * 0.30, o * 0.9);

  // ---- 热成像 ----
  if(uMode > 0.5 && uMode < 1.5){
    float lu = luma(col);
    float heat = texture2D(tDiffuse, uv).g; // 热源为自发光绿通道标记
    vec3 cold = mix(vec3(0.05,0.08,0.16), vec3(0.2,0.16,0.45), lu*1.4);
    vec3 hot = vec3(1.0, 0.55, 0.12) * (0.6 + heat*2.0);
    col = mix(cold, hot, smoothstep(0.5, 0.9, heat + lu*0.4));
  }
  // ---- 夜视仪 ----
  if(uMode > 1.5){
    float lu = luma(col);
    col = vec3(lu*1.9, lu*2.5, lu*1.4) * vec3(0.45, 1.0, 0.4);
    col += vec3(hash(uv*37.0+uTime)*0.06);
  }

  // ---- 废土调色（低饱和 + 伽马提亮 + 夜景冷调） ----
  float sat = uSaturation;
  float gr = luma(col);
  col = mix(vec3(gr), col, sat);
  col = pow(max(col, vec3(0.0)) * 1.15, vec3(0.58)); // 伽马提亮
  // 赛璐璐色带（Toon Banding）
  float bandL = floor(luma(col) * 4.0 + 0.5) / 4.0;
  col = mix(col, vec3(bandL) * (0.5 + 0.5 * normalize(col + 0.0001)), 0.22);
  col = mix(col, col*vec3(0.72,0.85,1.08), uNightBlue*0.55);

  // ---- 血光暗角（伤害/疼痛呼吸波动） ----
  float dV = length((uv - 0.5) * vec2(1.0, uRes.x/uRes.y));
  float pulse = 0.5 + 0.5*sin(uTime*2.4);
  float vin = smoothstep(0.34, 0.95, dV);
  float dmg = clamp(uDamage*1.6 + uPain*0.5, 0.0, 1.0) * (0.55 + 0.45*pulse);
  col *= 1.0 - vin*(0.32 + dmg*0.55);
  col += vec3(0.62,0.05,0.04) * vin * dmg * 0.85;

  // ---- 噪点 ----
  col += (hash(uv*uRes + uTime*61.7) - 0.5) * (0.02 + uGrain*0.14 + uNoiseAmp*0.1);

  // ---- 最终编码 ----
  gl_FragColor = vec4(col, 1.0);
}
`;
const VERT = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.5, 1.0);
}
`;

export class PostFX {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false, depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uSaturation: { value: 0.92 },
        uContrast: { value: 1.12 },
        uNightBlue: { value: 0 },
        uVignette: { value: 0.5 },
        uDamage: { value: 0 },
        uPain: { value: 0 },
        uDrunk: { value: 0 },
        uGrain: { value: 0 },
        uRain: { value: 0 },
        uRainDir: { value: 0.6 },
        uMode: { value: 0 },
        uNoiseAmp: { value: 0 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.scene.add(quad);
  }
  render(r) {
    const g = this.game;
    const m = this.mat.uniforms;
    m.tDiffuse.value = r.targetA.texture;
    m.tDepth.value = r.targetA.depthTexture;
    m.uTime.value = g.now;
    m.uRes.value.set(window.innerWidth, window.innerHeight);
    const env = g.env || {};
    const st = g.player ? g.player.stats : null;
    m.uNightBlue.value = env.nightBlue ?? 0;
    m.uRain.value = env.rain ?? 0;
    m.uDamage.value = st ? st.damageFx : 0;
    m.uPain.value = st ? Math.max(0, (st.pain - 40) / 60) : 0;
    m.uDrunk.value = st ? st.drunk / 100 : 0;
    m.uGrain.value = (env.rain || 0) * 0.4 + (st && st.drowsy > 80 ? 0.25 : 0);
    m.uMode.value = g.viewMode || 0;
    m.uNoiseAmp.value = st ? st.panic / 100 : 0;
    m.uSaturation.value = env.saturation ?? 0.92;
    m.uContrast.value = env.contrast ?? 1.12;
    r.renderer.render(this.scene, this.cam);
  }
}
