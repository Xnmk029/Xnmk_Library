# 开发笔记（DEV）

## 工具链

- Node v24.15.0（`node --version` 可用）
- 注意：本机 `npm` 包装脚本损坏（会错误调用 wsl.exe）。统一使用：
  `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" <命令>`
- 已装依赖：`three`、`vite`（`npm-cli.js install` 已执行成功）
- 单测：Node 内置 `node --test`（零额外依赖）
- 无 curl/sed/head/which —— shell 内一律用 node 脚本代替

## 入口与端口

- 8080 根路径直接返回 `sim.html`（驾驶场景），无音频实验室页
- `npm run serve` → `node scripts/serve.mjs`（极简静态服务器，8080）
- `npm run dev` → vite（同样 8080，根路径经 index.html 重定向到 sim.html）

## 模型

- `public/models/muscle-car.glb` — Kenney Car Kit `sedan-sports.glb`，CC0，177KB
- 来源记录：`public/models/SOURCES.md`
- 重新下载：`node scripts/download-model.mjs`

## 目录结构

```
src/
  audio/    引擎声音 DSP（阶段1）
  physics/  车辆物理与手感（阶段2）
  scene/    Three.js 场景（阶段3）
  input/    键盘 + XInput 手柄（阶段2）
  camera/   追尾镜头（阶段4）
  core/     主循环与状态（阶段5 集成）
tests/      Node 单测 + 浏览器冒烟
public/     模型 / 贴图 / 音频资源
docs/       操作指南 / 深度提示词 / 外部引用披露
```

## 外部引用（只读，已获用户授权）

- `C:\Users\Administrator\Downloads\enhanceddriver`（BeamNG 追尾镜头 mod，用于阶段4）
- `G:\产品\SimCarLite\手感优化模块AI总结.md`（用户提供，用于阶段2 手感）
- GitHub `ange-yaghi/engine-sim`（公开开源参考，阶段1）
- Kenney CC0 模型（已下载）
