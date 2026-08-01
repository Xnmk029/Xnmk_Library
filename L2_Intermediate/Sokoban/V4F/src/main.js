// ---------------------------------------------------------------
// 主入口：Three.js 风格化草地场景
//  - HDRI 环境（Poly Haven kloofendal，自动采样地平线颜色做雾）
//  - 地形起伏 + 土路 + 池塘 + 园林树木
//  - Dylearn 风格实例化草地 Shader（风/定格动画/角色推开/伪透视/卡通光影/云影）
//  - 像素风渲染模式（低分辨率 + nearest 上采样）
// ---------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import { TERRAIN_SIZE, POND, terrainHeight, buildTerrain, buildRoad, buildPond } from './world.js';
import { createGrassMesh, createFlowerMesh, makeGrassUpdater } from './grass.js';
import { createTreeSystem } from './trees.js';
import { createPlayer, createNPC } from './characters.js';
import { TERRAIN_VERT, TERRAIN_FRAG } from './shaders.js';
import {
  makeGrassBladeTexture, makeWindNoiseTexture, makeCloudTexture,
  makeToonGradientMap, makeRoadTexture, makeBlobShadowTexture, makeFlowerTexture,
} from './textures.js';
import { installDebugProbe } from './debug.js';

// —— 诊断标记（仅 ?debug=1 时启用，无头验证用）——
if (new URLSearchParams(location.search).has('debug')) {
  window.__errors = [];
  window.addEventListener('error', e => window.__errors.push(String(e.message || e.error) + ' @ ' + (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', e => window.__errors.push('REJ: ' + String(e.reason)));
  document.title = 'GRASS-EVAL-START';
  // 早期错误转储（模块中途抛错时也能看到）
  setInterval(() => {
    if (window.__errors.length && !document.getElementById('early-errors')) {
      const el = document.createElement('pre');
      el.id = 'early-errors';
      el.style.cssText = 'position:fixed;top:0;left:0;z-index:999;background:#f003;color:#ff9;font:11px monospace;padding:6px;max-width:80vw;white-space:pre-wrap;';
      el.textContent = window.__errors.join('\n---\n');
      document.body.appendChild(el);
    }
  }, 400);
}

// ---------------- 渲染器 ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.setPixelRatio(0.5); // 像素风：低分辨率渲染
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// 注意：scene.fog 必须在首次渲染前设置（three 的 program 缓存按首次编译参数生成，
// 若首帧无雾、之后再加雾，所有 ShaderMaterial 都不会重新编译 → 报错）
scene.fog = new THREE.Fog(new THREE.Color('#c9deec'), 95, 330);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 1000);
camera.position.set(-120, 17, -64);

// ---------------- 灯光 ----------------
const sun = new THREE.DirectionalLight(0xfff2dd, 3.2);
sun.position.set(80, 100, 30);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x5a6b4a, 0.55));
const lightDir = new THREE.Vector3().copy(sun.position).normalize();

// ---------------- 程序化纹理 ----------------
const grassTex = makeGrassBladeTexture();
const windNoiseTex = makeWindNoiseTexture();
const cloudTex = makeCloudTexture();
const gradientMap = makeToonGradientMap();
const roadTex = makeRoadTexture();
const blobTex = makeBlobShadowTexture();
const flowerTex = makeFlowerTexture();

// ---------------- 材质 ----------------
// 地形（自定义 ShaderMaterial：卡通光影 + 云影 + 岸线 + 迷雾）
const terrainUniforms = {
  uLightDir: { value: lightDir.clone() },
  uColA: { value: new THREE.Color('#4a8a35') },
  uColB: { value: new THREE.Color('#66a84c') },
  uColDirt: { value: new THREE.Color('#9a7a58') },
  uShoreColor: { value: new THREE.Color('#7a6248') },
  uPondCenter: { value: new THREE.Vector2(POND.x, POND.z) },
  uPondR: { value: POND.r },
  uCloudTex: { value: cloudTex },
  uTime: { value: 0 },
  uCloudSpeed: { value: 0.0035 },
  uCloudEnabled: { value: 1 },
  // ShaderMaterial 启用 fog:true 时必须声明这三个雾 uniform（渲染器每帧写入）
  fogColor: { value: new THREE.Color() },
  fogNear: { value: 0 },
  fogFar: { value: 1 },
};
const terrainShader = new THREE.ShaderMaterial({
  vertexShader: TERRAIN_VERT,
  fragmentShader: TERRAIN_FRAG,
  uniforms: terrainUniforms,
  fog: true,
});

// 土路
const roadMaterial = new THREE.MeshToonMaterial({
  map: roadTex, gradientMap, transparent: true, envMapIntensity: 0.2,
});

// ---------------- 世界物体 ----------------
scene.add(buildTerrain(terrainShader));
scene.add(buildRoad(roadMaterial));
scene.add(buildPond(gradientMap, blobTex));
scene.add(createTreeSystem({ gradientMap, blobTex }));

// ---------------- 草地 & 花朵 ----------------
const grassMesh = createGrassMesh({ grassTex, windNoiseTex, cloudTex });
const flowerMesh = createFlowerMesh({ flowerTex, windNoiseTex, cloudTex });
scene.add(grassMesh);
scene.add(flowerMesh);

// ---------------- 角色 ----------------
const player = createPlayer(scene, blobTex);
const npc = createNPC(scene, blobTex);

// ---------------- 控制器 ----------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 150;
controls.maxPolarAngle = 1.52;
controls.target.set(player.pos.x, player.pos.y + 1, player.pos.z);

// ---------------- HDRI 环境 ----------------
const pmrem = new THREE.PMREMGenerator(renderer);

function sampleHorizonFogColor(hdrTex) {
  const img = hdrTex.image;
  const data = img.data;
  const w = img.width, h = img.height;
  let r = 0, g = 0, b = 0, n = 0;
  // 取地平线上方天空带（避开太阳盘，防雾色被烧白），逐像素限幅后平均
  for (let row = Math.floor(h * 0.30); row <= Math.floor(h * 0.44); row += 2) {
    for (let x = 0; x < w; x += 4) {
      const k = (row * w + x) * 4;
      r += Math.min(data[k], 1.0);
      g += Math.min(data[k + 1], 1.0);
      b += Math.min(data[k + 2], 1.0);
      n++;
    }
  }
  r /= n; g /= n; b /= n;
  const toSRGB = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  return new THREE.Color(toSRGB(r), toSRGB(g), toSRGB(b));
}

function makeFallbackSky() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7db4e8');
  g.addColorStop(0.45, '#bfe0f2');
  g.addColorStop(0.55, '#f2e8cf');
  g.addColorStop(1, '#d8c9a8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  ctx.beginPath();
  ctx.arc(400, 62, 32, 0, Math.PI * 2);
  ctx.fillStyle = '#fff7d9';
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

async function setupEnvironment() {
  try {
    const hdr = await new RGBELoader().loadAsync('/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr');
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const envRT = pmrem.fromEquirectangular(hdr);
    scene.environment = envRT.texture;
    scene.background = hdr;
    const fogColor = sampleHorizonFogColor(hdr).multiplyScalar(0.88);
    scene.fog.color.copy(fogColor);
    console.log('[env] HDRI 已加载，雾色 =', fogColor.getHexString());
  } catch (err) {
    console.warn('[env] HDRI 加载失败，使用程序化天空兜底', err);
    const sky = makeFallbackSky();
    scene.environment = pmrem.fromEquirectangular(sky).texture;
    scene.background = sky;
    scene.fog.color.set('#c9deec');
  }
}

// ---------------- 每帧更新 ----------------
const updateGrass = makeGrassUpdater(grassMesh, flowerMesh, terrainUniforms);
const windDir = new THREE.Vector3();

const keys = { up: false, down: false, left: false, right: false };
window.addEventListener('keydown', e => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': keys.up = true; e.preventDefault(); break;
    case 'KeyS': case 'ArrowDown': keys.down = true; e.preventDefault(); break;
    case 'KeyA': case 'ArrowLeft': keys.left = true; e.preventDefault(); break;
    case 'KeyD': case 'ArrowRight': keys.right = true; e.preventDefault(); break;
    case 'KeyP': togglePixel(); break;
    case 'KeyR': resetCamera(); break;
  }
});
window.addEventListener('keyup', e => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': keys.up = false; break;
    case 'KeyS': case 'ArrowDown': keys.down = false; break;
    case 'KeyA': case 'ArrowLeft': keys.left = false; break;
    case 'KeyD': case 'ArrowRight': keys.right = false; break;
  }
});

const clock = new THREE.Clock();
let pixelMode = true;

function togglePixel() {
  pixelMode = !pixelMode;
  renderer.setPixelRatio(pixelMode ? 0.5 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('pixelBtn').textContent = `像素风模式：${pixelMode ? '开' : '关'} (P)`;
  document.getElementById('pixelBtn').classList.toggle('on', pixelMode);
}
function resetCamera() {
  camera.position.set(-120, 17, -64);
  controls.target.set(player.pos.x, player.pos.y + 1, player.pos.z);
}

// UI
const windSlider = document.getElementById('wind');
const fpsSlider = document.getElementById('fps');
const perspSlider = document.getElementById('persp');
const cloudsBox = document.getElementById('clouds');
let windStrength = 1, fps = 12, persp = 0.3, cloudsOn = true;
windSlider.addEventListener('input', () => {
  windStrength = parseFloat(windSlider.value);
  document.getElementById('windV').textContent = windStrength.toFixed(2);
});
fpsSlider.addEventListener('input', () => {
  fps = parseInt(fpsSlider.value);
  document.getElementById('fpsV').textContent = fps;
});
perspSlider.addEventListener('input', () => {
  persp = parseFloat(perspSlider.value);
  document.getElementById('perspV').textContent = persp.toFixed(2);
});
cloudsBox.addEventListener('change', () => { cloudsOn = cloudsBox.checked; });
document.getElementById('pixelBtn').addEventListener('click', togglePixel);
document.getElementById('resetBtn').addEventListener('click', resetCamera);

// 草地更新参数
const grassParams = {
  fps: 12, windStrength: 1, persp: 0.3, clouds: true,
};
windSlider.dispatchEvent(new Event('input'));
fpsSlider.dispatchEvent(new Event('input'));
perspSlider.dispatchEvent(new Event('input'));

// URL 参数支持：?wind=1.5&fps=6&persp=0&clouds=0&x=..&y=..&z=..&tx=..&ty=..&tz=..
{
  const p = new URLSearchParams(location.search);
  if (p.has('wind')) { windSlider.value = p.get('wind'); windSlider.dispatchEvent(new Event('input')); }
  if (p.has('fps')) { fpsSlider.value = p.get('fps'); fpsSlider.dispatchEvent(new Event('input')); }
  if (p.has('persp')) { perspSlider.value = p.get('persp'); perspSlider.dispatchEvent(new Event('input')); }
  if (p.has('clouds')) cloudsBox.checked = p.get('clouds') !== '0';
  if (p.has('x') && p.has('y') && p.has('z')) camera.position.set(+p.get('x'), +p.get('y'), +p.get('z'));
  if (p.has('tx') && p.has('ty') && p.has('tz')) controls.target.set(+p.get('tx'), +p.get('ty'), +p.get('tz'));
}

// ---------------- 主循环 ----------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setupEnvironment().then(() => {
  document.getElementById('loading').classList.add('hide');
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // 风向缓慢漂移
  const a = 0.52 + 0.3 * Math.sin(t * 0.05);
  windDir.set(Math.cos(a), 0, Math.sin(a)).normalize();

  // 角色
  player.update(dt, keys);
  npc.update(dt, t);

  // 草地 & 共享 uniform
  grassParams.fps = fps; grassParams.windStrength = windStrength;
  grassParams.persp = persp; grassParams.clouds = cloudsOn;
  updateGrass({
    time: t, windDir, lightDir, camera,
    actors: [player, npc],
    fps: grassParams.fps, windStrength: grassParams.windStrength,
    persp: grassParams.persp, clouds: grassParams.clouds,
  });

  // 相机跟随玩家（平滑）；?follow=0 可禁用（调试/截图用）
  const follow = new URLSearchParams(location.search).get('follow') !== '0';
  if (follow) {
    controls.target.lerp(new THREE.Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z), 0.045);
  }
  controls.update();

  try {
    renderer.render(scene, camera);
  } catch (e) {
    window.__renderError = (window.__renderError || 0) + 1;
    window.__renderStack = e && e.stack ? String(e.stack) : String(e);
  }
}
animate();
console.log('[scene] 初始化完成，TERRAIN_SIZE =', TERRAIN_SIZE);

// 诊断探针（?debug=1）
const probe = new URLSearchParams(location.search).has('debug') ? installDebugProbe(renderer, scene) : null;
if (probe) {
  probe.run(() => ({
    grass: grassMesh.count,
    flowers: flowerMesh.count,
    fog: scene.fog ? scene.fog.color.getHexString() : null,
    fogNear: scene.fog ? scene.fog.near : null,
    fogFar: scene.fog ? scene.fog.far : null,
    env: !!scene.environment,
    bg: scene.background ? scene.background.type : null,
    cam: [camera.position.x, camera.position.y, camera.position.z].map(v => +v.toFixed(1)),
    player: [player.pos.x, player.pos.y, player.pos.z].map(v => +v.toFixed(1)),
    windDir: [windDir.x, windDir.y, windDir.z].map(v => +v.toFixed(2)),
    cloudEnabled: terrainUniforms.uCloudEnabled.value,
  }));
}
