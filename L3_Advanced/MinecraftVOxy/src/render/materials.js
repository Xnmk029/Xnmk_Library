// VOXY CRAFT — 体素 ShaderMaterial（M4：图集采样 + 面朝向 + AO）
// 解码压缩顶点属性，按 aTile 采样图集，aUV 提供每方块重复 UV。
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aDir;
  attribute float aAO;
  attribute float aTile;
  attribute vec2 aUV;
  varying vec2 vUV;
  varying float vTile;
  varying float vDir;
  varying float vShade;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
    int d = int(aDir + 0.5);
    float shade = (d == 2) ? 1.0 : (d == 3) ? 0.5 : (d == 0 || d == 1) ? 0.72 : 0.86;
    int a = int(aAO + 0.5);
    float ao = (a == 0) ? 0.5 : (a == 1) ? 0.72 : (a == 2) ? 0.86 : 1.0;
    vShade = shade * ao;
    vUV = aUV;
    vTile = aTile;
    vDir = aDir;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;
  uniform sampler2D uAtlas;
  uniform float uCols;
  uniform float uRows;
  uniform float uTileSize;
  uniform float uAmbient;
  varying vec2 vUV;
  varying float vTile;
  varying float vDir;
  varying float vShade;
  void main() {
    vec2 tuv = fract(vUV);
    float d = floor(vDir + 0.5);
    if (d != 2.0 && d != 3.0) tuv.y = 1.0 - tuv.y;   // 侧面：贴图顶部对齐世界上方
    float inset = 0.5 / uTileSize;
    tuv = clamp(tuv, inset, 1.0 - inset);
    float ti = floor(vTile + 0.5);
    float tx = mod(ti, uCols);
    float ty = floor(ti / uCols);
    vec2 atlasUV = vec2((tx + tuv.x) / uCols, (ty + tuv.y) / uRows);
    vec4 tex = texture2D(uAtlas, atlasUV);
    if (tex.a < 0.5) discard;
    gl_FragColor = vec4(tex.rgb * vShade * uAmbient, 1.0);
  }
`;

export function createVoxelMaterial(atlas) {
  const rows = Math.ceil(atlas.tileCount / atlas.tilesPerRow);
  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlas.texture },
      uCols: { value: atlas.tilesPerRow },
      uRows: { value: rows },
      uTileSize: { value: atlas.tileSize },
      uAmbient: { value: 1.0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.FrontSide,
  });
}

export function createWaterMaterial() {
  return new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false });
}
