# 集成指南

## 1. 浏览器端集成（零运行时依赖）

- 页面只加载经典脚本（无 ES module 动态导入）：
  ```html
  <script src="vendor/three/three.classic.js"></script>
  <script src="sim.bundle.js"></script>
  ```
- `sim.bundle.js` 由 `node tools/bundle-sim.mjs` 生成（esbuild IIFE，
  globalName = `EngineSIM`），入口 `EngineSIM.Sim`。
- 音频 worklet 文件 `src/engine-dsp.mjs` 由 AudioWorklet.addModule 运行时拉取
  （本地服务器，MIME 正确）；失败自动降级 ScriptProcessor。
- 服务器 `tools/serve.mjs`：
  - 根路径 `/` → **sim.html**（驾驶场景）；
  - `/audio-lab.html` 音频实验室；MIME 覆盖 .mjs/.glb/.obj/.mtl/.wav 等。

## 2. 外部模拟器驱动声音（UDP/HTTP 桥）

`node tools/udp-bridge.mjs` 启动：

- **UDP 4001**：接收 CSV `rpm,throttle,load`（每包一行，例如 `4500,0.8,0.7`）；
- **WebSocket 8081**：转发 JSON `{"rpm":4500,"throttle":0.8,"load":0.7}`；
- 浏览器端：`audio-lab.html` 或任意页面
  ```js
  const ws = new WebSocket('ws://localhost:8081');
  ws.onmessage = (e) => {
    const s = JSON.parse(e.data);
    audio.setRpm(s.rpm); audio.setThrottle(s.throttle); audio.setLoad(s.load);
  };
  ```
- 也可用 `AudioEngineDriver.updateFromVehicle(vehicleSnapshot)` 直接把
  `{rpm, throttleInput, load, ignition, fuelCut, limiterActive, stall, backfire}`
  映射进 DSP（驾驶模拟内置此调用）。

## 3. 离线渲染

- `node tools/render-wav.mjs all` → `out/{idle,cruise,launch,limiter,sweep,preset-*}.wav`；
- 程序内：`import { renderEngine } from './src/engine-driver.mjs'` →
  `renderEngine({ seconds, paramFn })` 返回 {left, right} Float64Array。

## 4. 音频链路状态机

| 状态 | 含义 |
|---|---|
| `audio: worklet` | AudioWorklet 正常（首选） |
| `audio: scriptprocessor` | 已降级 ScriptProcessor（同一 DSP） |
| `Audio unavailable: ...` | 无 AudioContext 或两者都失败（检查自动播放/权限） |

标题页点击「开始驾驶」= 用户手势 → 创建 AudioContext → resume →
addModule → 主链路（引擎节点 → master → compressor → destination）。

## 5. 构建与测试

```bash
npm run build        # bundle + 冒烟
npm test             # 38 项测试
node tools/bundle-sim.mjs --check   # 冒烟：bundle booted, Sim constructed
```

## 6. 运行时不依赖工作区外路径

- `vendor/three/three.classic.js` 本地化（esbuild 从 node_modules 生成）；
- 车辆模型 `assets/models/*.glb` 本地（Kenney CC0）；
- worklet URL 基于 `document.baseURI`，不引用 import.meta.url 或外部 CDN。
