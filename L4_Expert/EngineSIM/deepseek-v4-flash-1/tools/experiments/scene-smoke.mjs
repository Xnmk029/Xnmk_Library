// 场景图冒烟（无 WebGL）：验证 buildScene / loadCar / 相机 / HUD 代码路径无引用错误。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---- 最小 document/canvas 桩 ----
const noop = () => {};
function makeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 0 });
      if (k === 'canvas') return {};
      return noop;
    },
    set() { return true; }
  });
}
function makeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => makeCtx(), addEventListener: noop };
}
function makeElement() {
  const child = () => ({ classList: { toggle: noop }, style: { setProperty: noop } });
  const el = {
    style: { setProperty: noop },
    classList: { toggle: noop },
    getContext: () => makeCtx(),
    width: 0, height: 0,
    children: [child(), child(), child(), child(), child()],
    appendChild: noop,
    querySelector: () => makeElement(),
    insertAdjacentHTML: noop,
    textContent: '',
    innerHTML: ''
  };
  return el;
}
globalThis.document = {
  baseURI: 'http://localhost:8080/',
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : makeElement()),
  body: { appendChild: noop, insertAdjacentHTML: noop },
  addEventListener: noop,
  getElementById: () => ({ appendChild: noop, insertAdjacentHTML: noop, clientWidth: 960, clientHeight: 540, querySelector: () => makeElement() }),
  documentElement: {}
};
globalThis.window = globalThis;
globalThis.fetch = async (url) => {
  const file = path.resolve(process.cwd(), decodeURIComponent(url.replace('http://localhost:8080/', '')));
  return { ok: true, status: 200, text: async () => fs.readFileSync(file, 'utf8') };
};

require('../../vendor/three/three.classic.js');
require('../../vendor/three/addons/loaders/OBJLoader.js');
require('../../vendor/three/addons/loaders/MTLLoader.js');

const THREE = globalThis.THREE;
const { buildScene } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/render/scene-builder.mjs')).href);
const { loadCar } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/render/car-builder.mjs')).href);
const { ChaseCamera } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/render/camera-controller.mjs')).href);
const { HUD } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/render/hud.mjs')).href);
const { Vehicle } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/sim/vehicle.mjs')).href);

const scene = buildScene(THREE);
let meshes = 0;
scene.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
console.log('场景网格数:', meshes);

const car = await loadCar(THREE, 'http://localhost:8080/');
console.log('车模加载:', car.userData.loaded ? 'OBJ' : 'fallback', 'wheels:', Object.keys(car.userData.wheels).join(','));

const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
const cc = new ChaseCamera(THREE, camera);
const fakeCar = new Vehicle();
fakeCar.x = 10; fakeCar.y = 5; fakeCar.yaw = 1.2; fakeCar.vx = 25; fakeCar.vy = 0.2;
fakeCar.r = 0.1; fakeCar.ax = 1; fakeCar.ay = 3; fakeCar.steerInput = 0.3;
fakeCar.wheelDelta = [0.2, 0.2, 0, 0]; fakeCar.throttle = 0.6; fakeCar.brake = 0;
for (let i = 0; i < 60; i++) cc.update(1 / 60, fakeCar, i / 60);
for (let i = 0; i < 5; i++) { cc.setMode(i); cc.update(1 / 60, fakeCar, 1); }
console.log('相机 5 模式切换 OK');

const hud = new HUD(globalThis.document.body);
hud.update(fakeCar, { fps: 60, audioMode: 'worklet', preset: '大厅', mu: 1.0, capPct: 40, lap: 88.5, lapInvalid: false });
hud.setIndicators([{ label: 'TC', on: true }]);
console.log('HUD 更新 OK');
console.log('scene-smoke: OK');
