import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTerrain, getTerrainHeight } from './terrain.js';
import { createGrass } from './grass.js';
import { createTrees } from './trees.js';
import { createEnvironment, createFog, createGroundFog, createSun } from './environment.js';
import { GameManager, GameState } from './game/GameManager.js';
import { GameUI } from './game/UI.js';
import { MenuScene } from './game/MenuScene.js';
import { LEVELS, validateAllLevels } from './game/levels.js';
import { PixelFilter } from './game/PixelFilter.js';
import { createGameGrass, createRocksRing, createWaterRing } from './game/SceneDecor.js';

// ============================================
// 关卡验证 (启动时检查所有关卡可解性)
// ============================================
console.log('WHALE BOX - 启动关卡验证...');
validateAllLevels();

// ============================================
// 全局状态
// ============================================
let currentMode = 'menu'; // 'menu' | 'game'
let unlockedLevel = 0;
let completedLevels = [];
let menuOrbitAngle = Math.atan2(30, 30); // 菜单相机环绕角度

// 从 localStorage 加载进度
try {
  const saved = localStorage.getItem('whalebox_progress');
  if (saved) {
    const data = JSON.parse(saved);
    unlockedLevel = data.unlockedLevel || 0;
    completedLevels = data.completedLevels || [];
  }
} catch (e) {}

function saveProgress() {
  try {
    localStorage.setItem('whalebox_progress', JSON.stringify({
      unlockedLevel,
      completedLevels
    }));
  } catch (e) {}
}

// ============================================
// 场景设置
// ============================================
const scene = new THREE.Scene();
// 方案C: 场景背景色改为天蓝色，与明亮水面协调
scene.background = new THREE.Color(0x87ceeb);

// 正交相机
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 35;

const camera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2,
  frustumSize * aspect / 2,
  frustumSize / 2,
  -frustumSize / 2,
  0.1,
  500
);
camera.position.set(30, 25, 30);
camera.lookAt(0, 0, 0);

// 渲染器
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('app').appendChild(renderer.domElement);

// 控制器
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.2;
controls.minPolarAngle = Math.PI / 6;
controls.minZoom = 0.5;
controls.maxZoom = 5.0;
controls.target.set(0, 0, 0);

// ============================================
// 光照
// ============================================
const ambientLight = new THREE.AmbientLight(0x8fbc8f, 0.7);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.4);
sunLight.position.set(40, 50, 25);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 150;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
sunLight.shadow.bias = -0.002;
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7a4a, 0.5);
scene.add(hemiLight);

const fillLight = new THREE.DirectionalLight(0xb0d0ff, 0.3);
fillLight.position.set(-20, 10, -20);
scene.add(fillLight);

// ============================================
// 环境场景 (菜单背景)
// ============================================
const { sky } = createEnvironment(renderer, scene);
createFog(scene);

const terrain = createTerrain();
scene.add(terrain);

const grass = createGrass(camera);
scene.add(grass.mesh);

const trees = createTrees();
scene.add(trees);

const groundFog = createGroundFog();
scene.add(groundFog);

const sun = createSun();
scene.add(sun);

// ============================================
// 菜单场景 (滚动箱子)
// ============================================
let menuScene = new MenuScene(scene);

// ============================================
// 游戏管理器
// ============================================
const gameManager = new GameManager(scene, camera, renderer);

// ============================================
// 像素滤镜 (极高pixelSize)
// ============================================
const pixelFilter = new PixelFilter(renderer, scene, camera);
pixelFilter.setPixelSize(4); // 高级别像素化 (原6降低25%)

// ============================================
// 游戏场景装饰 (草地/岩石/水面)
// ============================================
let gameDecor = { grass: null, rocks: null, water: null };

// ============================================
// UI 系统
// ============================================
const ui = new GameUI();
ui.init();

// UI 回调
ui.on('start', () => {
  startGame(unlockedLevel);
});

ui.on('levels', () => {
  ui.showLevelSelect(unlockedLevel, completedLevels);
});

ui.on('back', () => {
  ui.showMenu();
});

ui.on('selectLevel', (level) => {
  startGame(level);
});

ui.on('reset', () => {
  gameManager.resetLevel();
  ui.showHUD(gameManager.getLevelInfo());
});

ui.on('pause', () => {
  ui.showPause();
});

ui.on('resume', () => {
  ui.showHUD(gameManager.getLevelInfo());
});

ui.on('next', () => {
  const nextLevel = gameManager.currentLevel + 1;
  if (nextLevel < LEVELS.length) {
    startGame(nextLevel);
  } else {
    ui.showMenu();
    currentMode = 'menu';
  }
});

ui.on('replay', () => {
  startGame(gameManager.currentLevel);
});

ui.on('menu', () => {
  returnToMenu();
});

ui.on('move', (dir) => {
  const dirMap = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
  };
  if (dirMap[dir]) {
    gameManager.movePlayer(...dirMap[dir]);
  }
});

// 游戏事件
gameManager.onMove = (moves, pushes) => {
  ui.updateStats(moves, pushes);
};

gameManager.onLevelComplete = (level, moves, pushes) => {
  // 更新进度
  if (!completedLevels.includes(level)) {
    completedLevels.push(level);
  }
  if (level + 1 > unlockedLevel) {
    unlockedLevel = level + 1;
  }
  saveProgress();
  
  setTimeout(() => {
    ui.showLevelComplete(gameManager.getLevelInfo());
  }, 500);
};

// ============================================
// 游戏控制
// ============================================
function startGame(level) {
  currentMode = 'game';
  
  // 隐藏菜单场景
  if (menuScene) {
    menuScene.dispose();
    menuScene = null;
  }
  
  // 隐藏环境场景元素 (保留天空和光照)
  terrain.visible = false;
  grass.mesh.visible = false;
  trees.visible = false;
  groundFog.visible = false;
  
  // 背景色匹配水面深色，彻底消除正交相机下水面边缘截断
  scene.background = new THREE.Color(0x2a7ab0);
  
  // 加载关卡
  gameManager.loadLevel(level);
  
  // 创建游戏场景装饰
  const { width, height } = gameManager.levelData;
  
  // 外圈密集草地
  const gameGrass = createGameGrass(scene, width, height);
  scene.add(gameGrass.group);
  gameDecor.grass = gameGrass;
  
  // 岩石环
  const rocks = createRocksRing(width, height);
  scene.add(rocks);
  gameDecor.rocks = rocks;
  
  // 水面环
  const water = createWaterRing(width, height);
  scene.add(water.group);
  gameDecor.water = water;
  
  ui.showHUD(gameManager.getLevelInfo());
}

function returnToMenu() {
  currentMode = 'menu';
  
  // 清除游戏场景
  gameManager.clearLevel();
  
  // 清除游戏装饰
  if (gameDecor.grass) {
    scene.remove(gameDecor.grass.group);
    gameDecor.grass = null;
  }
  if (gameDecor.rocks) {
    scene.remove(gameDecor.rocks);
    gameDecor.rocks = null;
  }
  if (gameDecor.water) {
    scene.remove(gameDecor.water.group);
    gameDecor.water = null;
  }
  
  // 显示环境场景
  scene.background = new THREE.Color(0x87ceeb);
  terrain.visible = true;
  grass.mesh.visible = true;
  trees.visible = true;
  groundFog.visible = true;
  
  // 重建菜单场景
  menuScene = new MenuScene(scene);
  
  // 重置菜单相机环绕角度
  menuOrbitAngle = Math.atan2(30, 30);
  controls.target.set(0, 0, 0);
  
  ui.showMenu();
}

// ============================================
// 键盘控制
// ============================================
document.addEventListener('keydown', (e) => {
  if (currentMode !== 'game') return;
  
  const key = e.key.toLowerCase();
  
  switch (key) {
    case 'w':
    case 'arrowup':
      e.preventDefault();
      gameManager.movePlayer(0, -1);
      break;
    case 's':
    case 'arrowdown':
      e.preventDefault();
      gameManager.movePlayer(0, 1);
      break;
    case 'a':
    case 'arrowleft':
      e.preventDefault();
      gameManager.movePlayer(-1, 0);
      break;
    case 'd':
    case 'arrowright':
      e.preventDefault();
      gameManager.movePlayer(1, 0);
      break;
    case 'r':
      gameManager.resetLevel();
      ui.showHUD(gameManager.getLevelInfo());
      break;
    case 'escape':
      ui.showPause();
      break;
  }
});

// ============================================
// 动画循环
// ============================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();
  
  // 根据模式更新
  if (currentMode === 'menu' && menuScene) {
    // 菜单模式: 禁用手动控制，使用自动环绕相机
    controls.enabled = false;
    menuScene.update(deltaTime);
    
    menuOrbitAngle += deltaTime * 0.12;
    const radius = 20;
    camera.position.x = Math.cos(menuOrbitAngle) * radius;
    camera.position.z = Math.sin(menuOrbitAngle) * radius;
    camera.position.y = 16 + Math.sin(elapsedTime * 0.3) * 1.5;
    camera.lookAt(0, 0, 0);
    camera.zoom = 1.4;
    camera.updateProjectionMatrix();
  } else if (currentMode === 'game') {
    controls.enabled = true;
    controls.update();
    gameManager.update();
    // 更新游戏装饰
    if (gameDecor.grass) gameDecor.grass.update(elapsedTime);
    if (gameDecor.water) gameDecor.water.update(elapsedTime);
  }
  
  // 更新草地 shader
  grass.update(elapsedTime, []);
  
  // 更新地面薄雾
  groundFog.children.forEach((fogPlane, i) => {
    fogPlane.position.x = Math.sin(elapsedTime * 0.05 + i * 0.7) * 8;
    fogPlane.position.z = Math.cos(elapsedTime * 0.04 + i * 0.5) * 8;
  });
  
  // 使用像素滤镜渲染
  pixelFilter.render();
}

// ============================================
// 窗口自适应
// ============================================
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  
  camera.left = -frustumSize * aspect / 2;
  camera.right = frustumSize * aspect / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.updateProjectionMatrix();
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  pixelFilter.resize(window.innerWidth, window.innerHeight);
});

// ============================================
// 启动
// ============================================
document.getElementById('loading').classList.add('hidden');
setTimeout(() => {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.remove();
}, 600);

ui.showMenu();
animate();

console.log('WHALE BOX - A Sokoban Tale');
console.log('Controls: WASD/Arrows to move | R to reset | ESC to pause');
