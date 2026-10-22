# EngineSIM Web — Front-Mid Cross-Plane V8

浏览器端低开销发动机声音 + 双轴单轨驾驶模拟。交付目录仅含本文件夹内文件。

## 运行浏览器 Demo

需要本地静态服务（ES module）。在本目录执行：

```bat
node serve.mjs
```

浏览器打开 `http://127.0.0.1:8080/`，点击 **START ENGINE** 以创建 `AudioContext`。

操作：`W/↑` 油门，`S/↓` 制动，`A D / ← →` 转向，`C` 或 `Shift` 断油/点火切断，`Space` 手刹，`R` 复位。

Three.js 由 `index.html` / `main.mjs` 从 jsDelivr CDN 加载，无 npm 依赖。

## 运行自动化测试

零依赖，使用 Node 内置测试运行器：

```bat
node --test tests/engine-dsp.test.mjs tests/vehicle.test.mjs tests/browser.test.mjs
```

- `tests/engine-dsp.test.mjs`：发火间隔、主阶次、转速跟踪、无 NaN/持续削波、实时预算、AudioContext 桥
- `tests/vehicle.test.mjs`：怠速、加速、制动、转向、状态有限
- `tests/browser.test.mjs`：HUD / 输入 / 场景规格 / 虚拟音频上下文会话

听感与手感为人工主观项；阶次频率、输出边界、物理有限性由上述测试覆盖。

## 模块边界

| 模块 | 职责 |
| --- | --- |
| `engine-dsp.mjs` | 程序化 V8 音频，不依赖 Three.js |
| `vehicle.mjs` | 双轴单轨 + 轮胎摩擦圆，不依赖渲染/Web Audio |
| `scene.mjs` | 赛道 / 天空 / 肌肉车网格 |
| `input.mjs` / `hud.mjs` | 驾驶输入与 HUD 纯函数 |
| `main.mjs` | 把三者接到 WebGL 与 ScriptProcessor |

## engine-sim 原理 vs 自研

**移植自 `ange-yaghi/engine-sim` 公开原理（非 C++ 逐行移植）：** 四冲程曲轴转角上的逐缸燃烧/排气事件；十字曲轴 V8 发火顺序 `1-8-4-3-6-5-7-2`（每 90° 一次，主阶次 = 每转 4 次发火）；油门、负载与断油/点火切断缩放脉冲能量；排气歧管视为各缸脉冲的延迟混合。

**自研 / Web 向简化与增强：** 不用气缸压力积分、气门机构或排气管流体求解，改为低开销包络脉冲 + 噪声 + 管共振梳状滤波；等长歧管实现为全部气缸共享同一 header 延迟，前中置再加尾管延迟；用 FDN 座舱混响强化驾驶空间感（原项目更偏近场机械/排气直达声）；车辆层为自研自行车模型 + 摩擦圆轮胎，Three.js 赛道与低多边形美式肌肉车亦为自研，不属于 engine-sim。
