# deepseek-v4-flash 集成说明

## 页面加载链（经典脚本，零 ES module 机制）

`index.html` 按固定顺序加载：

```
vendor/three/three.classic.js        → window.THREE（自研兼容精简层）
vendor/three/addons/loaders/*.js     → THREE.OBJLoader / THREE.MTLLoader
src/engine-dsp.js                    → window.EngineDSP（兜底 + Worklet 模块）
sim.bundle.js                        → window.Sim（由 tools/bundle-sim.mjs 生成）
```

## 音频路径

`src/engine-driver.mjs` 以 AudioWorklet 为主：

```js
audioWorklet.addModule(new URL('./src/engine-dsp.js', document.baseURI))
```

（bundle 后 `import.meta.url` 会 404，因此必须用 `document.baseURI`。）
失败时回退 ScriptProcessor，使用 `window.EngineDSP`（经典脚本兜底）。
同一份 `engine-dsp.js` 在 Node 中 `require` 即为离线渲染/测试所用 DSP。

## 外部模拟器桥接

```bash
node tools/bridge-server.mjs          # UDP 4001 + HTTP 8081
```

- UDP 4001：接收 JSON（`{"rpm":5200,"throttle":0.65,"preset":"tunnel"}`）
  或 `rpm,throttle` 文本；
- HTTP 8081：`GET /state` 取最新状态；`POST /state` 更新；`GET /poll` 10s 长轮询。

## 本地运行

```bash
npm test                              # 22/22 全量测试
npm run check                         # bundle 冒烟（smoke: ... 12 frames ran OK）
npm run serve                         # http://localhost:8080/
npm run render                        # 20s 离线渲染 WAV（tools/render-offline.mjs）
```

## 打包器（tools/bundle-sim.mjs）

- 递归解析 `src/main-sim.mjs` 的 ESM 模块图，内联为单文件经典脚本；
- 支持 `export async function`、`export default class`；
- `import.meta.url` → `document.baseURI`；
- 依赖顺序为 DFS 后序，每个模块包装为 `__modules[id]` + 局部 `__require`；
- `--check` 在 Node 中执行冒烟：headless Sim 构造 + 12 帧物理更新。

## 渲染层（自研 THREE 兼容精简层）

`vendor/three/three.classic.js` 提供本项目所需子集：数学库、场景图、几何体、
材质（含 MeshStandardMaterial 的粗糙度/金属度/自发光）、环境/半球/平行光、
阴影贴图（1024，跟随车辆）、雾、ACES 色调映射。OBJ/MTL 加载器同样自研。
接口保持 Three.js 命名兼容，未来可替换为官方 three.classic.js。

已知简化（相对完整 Three.js）：PMREM 环境贴图以半球环境 + 金属反射近似替代；
天空为 4 时段程序化配色（黎明/白天/黄昏/夜晚），无体积云与太阳圆盘。
