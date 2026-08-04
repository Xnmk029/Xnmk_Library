# EngineSIM V4f-3：V8 发动机声音与车辆动力学模拟

参考开源项目 `ange-yaghi/engine-sim` 的公开原理实现的**精简低性能要求**浏览器驾驶模拟：
前中置引擎、等长排气芭蕉、十字曲轴 V8 程序化音色 + 魔术公式四轮双轨物理 + Three.js 场景，强化卷积混响与驾驶听感。

## 快速开始

```bash
# 本机 npm 包装脚本损坏，统一用直调方式：
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build
node scripts/serve.mjs            # → http://localhost:8080/ 直达驾驶场景
```

开发模式：`node "…\npm-cli.js" run dev`（vite）。完整操作见 `docs/操作指南.md`。

## 架构（音频/物理与渲染解耦）

```
src/
  audio/     引擎声音 DSP（engine-math 纯数学 + engine-sound 音频图 + 卷积混响）
  physics/   魔术公式四轮双轨车辆（tire / vehicle / 转向手感辅助 steering-assist）
  input/     键盘 + XInput 手柄（compose 归一化纯函数）
  camera/    追尾镜头（enhanceddriver 风格：G力/预瞄/抖动/FOV，显式模式切换）
  scene/     赛道 / 天空 / 程序化贴图 / 车辆模型加载 / HUD
  core/      主循环集成（120Hz 固定步长物理）
scripts/     serve.mjs（8080）/ download-model.mjs / screenshot.mjs
tests/       单元测试（node --test）+ 浏览器冒烟（无头 Chrome + CDP）
docs/        操作指南 / 深度提示词 / 外部引用披露 / 开发笔记
```

## 测试

```bash
node --test tests/            # 51 项单测（音频13 + 物理20 + 输入8 + 赛道4 + 相机6）
node tests/browser-smoke.mjs  # 无头 Chrome：启动冒烟 + 自动驾驶回路（HUD 车速验证）
```

## 验收对照（清单）

| 清单项 | 状态 | 验证方式 |
|---|---|---|
| 1 精简低性能 + 混响优化 | ✅ | 6 振荡器 + 2 噪声路径 + 单卷积混响（总 24 节点），`audioBudget` 单测锁定 |
| 2 前中置/等长芭蕉/十字曲轴 V8 | ✅ | 发火顺序 1-8-4-3-6-5-7-2、90° 间隔、阶次数学关系单测 |
| 3 Three.js 场景 | ✅ | 赛道/路肩/发车格/天空/光照/模型/HUD，冒烟+截图 |
| 4 启动不卡标题 | ✅ | 冒烟：overlay 关闭、HUD 挂载 |
| 5 资源/ESM 加载零失败 | ✅ | vite 构建 + 冒烟（生产模式服务 dist/） |
| 6 8080 → sim.html | ✅ | serve.mjs 根路径直达 |
| 7 驾驶场景有声 | ✅ | 点击解锁 AudioContext，冒烟无音频错误 |
| 8 物理姿态正确 | ✅ | 单测：加速抬头/制动点头/弯外倾符号锁定 |
| 9 XInput 手柄 | ✅ | gamepad 模块 + compose 单测 |
| 10 现成模型 | ✅ | Kenney CC0 `sedan-sports.glb`（`public/models/SOURCES.md`） |
| 11 手感优化 | ✅ | 手感文档算法全量落地 + 6 项单测 |
| 12 车轮方向 | ✅ | 单测：前轮运动学跟随 + 后轮方向一致 |
| 13/二.4 外引审计 | ✅ | `docs/外部引用披露.md` |
| 14 深度提示词 | ✅ | `docs/深度提示词.md`（仅总结需求） |
| 15 工作区规则 | ✅ | `AGENTS.md`（已更正为 V4f-3） |
| 二.1 操作指南 | ✅ | `docs/操作指南.md` |
| 二.2 后追镜头优化 | ✅ | enhanceddriver 算法移植（G力/预瞄/抖动/FOV） |
| 二.3 不自动切换视角 | ✅ | 相机单测：0~70m/s+漂移+倒车 400 帧不切换 |

## 参考边界

- **参考**：engine-sim 公开原理（发火/阶次建模思路）、enhanceddriver（镜头算法，已披露）、手感文档（转向辅助公式，已披露）、Kenney CC0 模型。
- **自主实现**：全部代码（音频合成、物理、场景、集成、测试）；详见 `docs/外部引用披露.md`。
