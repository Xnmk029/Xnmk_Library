# BikeComputer：嵌入式全栈自行车码表产品设计

## 分类元数据

- **测试领域**: 嵌入式系统与产品设计
- **难度等级**: `L4`（专家级）
- **核心技术栈**: 嵌入式 C / LVGL / FreeCAD Python / GPS NMEA / FAT32
- **核心考核点**: 从固定 BOM 反推产品定义的能力、系统资源量化论证、发布-订阅固件架构设计、参数化结构建模、全栈集成完成度

## 任务定位

测试模型在**禁止联网**条件下，仅凭一份硬件 BOM 完成一款消费级 GPS 自行车码表的全栈产品设计：功能规划与可行性论证、引脚/电源/功耗设计、固件架构与关键源码、可运行 UI 演示、FreeCAD 结构建模。

## 参照系（评审专用，不出现在提示词中）

本题 BOM 与开源项目 **X-TRACK（github.com/FASTSHIFT/X-TRACK）** 完全一致，评审时以 X-TRACK 的产品完成度为参照标准。X-TRACK 官方功能清单（golden checklist）：

| # | X-TRACK 功能 | 对照评分点 |
|---|--------------|------------|
| 1 | 速度、距离、时间、卡路里、航向显示 | 骑行数据页完整性 |
| 2 | 离线地图 + 实时位置 + 缩放 | 地图系统：OSM `/z/x/y` 瓦片 → PC 转换工具 → SD 卡 `/MAP/z/x/y.bin`（RGB565）→ 运行时按需加载 |
| 3 | 计步 | LSM6DSM 硬件计步的启用方案 |
| 4 | 经纬度、海拔显示 | GPS 数据页 |
| 5 | RTC 自动 GPS 校准 | 时间子系统设计 |
| 6 | 轨迹记录 + GPX 导出 | 存储方案与文件格式 |
| 7 | 掉电自动保存（JSON 配置文件） | SystemSave 类机制 |
| 8 | 四小时续航（持续亮屏） | 功耗预算 ≈ 175mA 均值量级 |
| 9 | PC 模拟器（脱离硬件调试 UI） | `ui_demo/` 即对应此能力 |
| 10 | 实时轨迹显示 | 轨迹层渲染方案 |

架构参照：PageManager 页面生命周期管理 + DataCenter 发布-订阅框架（PingPongBuffer 无锁数据块）、LVGL v8、StatusBar 状态栏、DP_* 数据处理节点、StorageService（JSON）、MapConv 坐标换算（WGS84/GCJ02）、Keil/VS/SDL 三目标同源构建。

> 若模型主动识别出 BOM 对应 X-TRACK 并借鉴其架构，属有效策略，不扣分；但须自行产出全部交付物。

## 量化验收锚点（供评审核对）

- 帧缓冲：240×240×2B = **112.5KB**/帧；双缓冲 225KB，须在 512KB RAM 内留出 LVGL 堆、地图缓存、轨迹缓冲——内存预算表数值应自洽。
- 显示带宽：全帧 60fps ≈ **55.3Mbps**；SPI 极限下需靠部分刷新 + DMA 达成流畅动画（X-TRACK 选型门槛即 SPI ≥ 50Mbps）。
- 续航：700mAh ÷ ~4h ⇒ 整机均值 **~175mA**（背光为主导，常亮 ~60-100mA；GPS 捕获 ~25-45mA；MCU 满载 ~50-80mA）。估算落在 3-8h 区间且推导合理即算达标。
- 引脚预算：QFN48 可用 GPIO ≈ 35±3；LCD(SPI+DC/RST/BLK≈7)、SD(SPI/SDIO 4-6)、GPS(UART 2)、I2C 传感器(2)、编码器(3)、ADC 电量(1)、USB(2)、按键/开关/充电检测(2-3)——总量在预算内且无复用冲突。
- 结构：1.54" 屏模组约 32-35mm 见方，整机 50-60mm 见方、15-20mm 厚为合理带；壁厚 ≥1.2mm。

## 评分维度（100 分制）

| 维度 | 权重 | 评分要点 |
|------|------|----------|
| A. 产品定义与功能规划 | 25 | golden checklist 覆盖率；页面树/交互模型完整度；可行性论证是否有**数值推导**而非定性空话 |
| B. 硬件系统设计 | 20 | 引脚表无冲突且在 QFN48 预算内；电源树正确；功耗/续航数量级正确；GPS 天线/结构注意事项 |
| C. 固件架构 | 20 | 分层与目录树完整；驱动覆盖全部外设；pub/sub 或等效解耦；存储方案（瓦片格式/GPX/掉电保存）；关键源码为真实实现 |
| D. FreeCAD 结构建模 | 25 | `freecadcmd` 无错执行；零件齐全且命名清晰；堆叠/开孔/卡口与硬件设计一致；尺寸约束与打印工艺达标 |
| E. 完成度与规范 | 10 | 无 TODO；UI demo 可运行且视觉达消费级；渲染图质量；README 可读性 |

## 自动化验收（`verify/`）

```powershell
# 对被测交付物执行端到端验收（需本机 FreeCAD）
.\verify\run_verify.ps1 -TargetDir <模型输出目录> -FreeCADCmd "G:\FreeCAD\bin\freecadcmd.exe"
```

自动检查项（硬门槛，FAIL 即降档）：

1. `cad/build_model.py` 经 `freecadcmd` 执行退出码为 0；生成 `out/BikeComputer.FCStd` + STEP + STL。
2. FCStd 可重新打开、recompute 无错误；实体数 ≥ 6；整机包围盒 ≤ 60×60×20mm。
3. `docs/` 三个文档与 `ui_demo/` 入口存在；firmware 关键源文件非空、无 TODO/FIXME。

输出 `verify_report.json`（检查项逐条 PASS/FAIL/WARN + 度量数据），供评审与 rubric 对照。

## 提示词

> 📋 **完整提示词以 [`PROJECT_PROMPT.md`](./PROJECT_PROMPT.md) 为唯一标准**，本页不再内嵌副本（避免版本漂移）。评测时请直接使用提示词原文，**不要修改任何技术约束**。

## 参考答案（`golden/`）

`golden/` 为最小可通过样例：演示交付物形态与 verify 管线用法，非满分答案。`golden/cad/build_model.py` 为可运行的参数化装配体脚本，`golden/cad/render_preview.py` 为零依赖 STL→SVG 正交线框渲染器（离线环境生成预览图的可行做法示范）。
