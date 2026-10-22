# PY 流光 (PY Flowing Light) - 桌面液态玻璃流光悬浮球小部件

`PY Flowing Light` 是一个基于 **PyQt6** 与 **psutil** 构建的高性能、高颜值桌面系统资源悬浮监控小部件。采用无边框透明窗口、液态玻璃（Glassmorphism）高光质感与 60 FPS 锥形流光光环设计，实时呈现 CPU 与内存资源占用状态。

---

## 🌟 核心特性

1. **悬浮球桌面形态**：
   - **无边框与透明背景**：利用 `Qt.WindowType.FramelessWindowHint` 与 `WA_TranslucentBackground` 实现纯粹的圆形光晕悬浮球。
   - **置顶与工具窗口**：默认 `WindowStaysOnTopHint` 置顶显示，同时配置 `Qt.WindowType.Tool`，不侵占任务栏空间。
   - **自由拖拽与屏幕贴合**：支持鼠标左键在屏幕任意位置平滑拖拽，并具备防越界吸附限制。
   - **触觉反馈**：点击时微缩、释放时弹性回弹（Elastic Spring Bounce）。

2. **硬件资源实时采集**：
   - **异步无阻塞线程**：后台独立 `QThread` 线程采集数据，避免 CPU 密集阻塞 Qt 60 FPS 渲染主循环。
   - **真实系统读取**：基于 `psutil` 准确获取 CPU 百分比、逻辑核心数、运行主频及内存已用/总容量（附带平滑波形兜底机制）。
   - **多维度可视化**：支持 **双环仪表（CPU 外环 + 内存内环）**、**单项专属仪表** 及 **自动轮播模式**。

3. **液态玻璃与流光视觉质感**：
   - **60 FPS 旋转流光光环**：基于 `QConicalGradient` 驱动多色阶流光环绕旋转，带外层柔和霓虹光晕。
   - **3D 液态玻璃球体**：球体核心采用多阶偏心 `QRadialGradient` 拟真球面受光，叠加顶部半月形高光弧与底部菲涅尔内折射光。
   - **丰富流光预设**：内置 **彩虹流光 (Rainbow)**、**赛博霓虹 (Cyber Neon)**、**极光掠影 (Aurora)**、**落日余晖 (Sunset)**、**翡翠流光 (Emerald)** 及 **自定义单色**。

4. **交互与即时个性化设置面板**：
   - **右键上下文菜单**：快速切换主题、显示模式、置顶开关、锁定位置与复位。
   - **独立设置面板**：提供球体直径（60–140px）、玻璃透明度、流光粗细、旋转速度、刷新频率及颜色选择器。
   - **所见即所得**：调节控件即时在桌面悬浮球生效，配置自动持久化保存为 `config.json`。

---

## 🚀 快速上手

### 1. 安装依赖环境

确保已安装 Python 3.8+，并在终端或命令行中执行：

```bash
pip install -r requirements.txt
```

或者直接安装核心依赖：
```bash
pip install PyQt6 psutil
```

### 2. 运行程序

在当前项目根目录下运行：

```bash
python main.py
```
*(亦可执行 `python py_flowing_light.py`)*

---

## 🎮 交互指南

| 操作方式 | 对应功能 |
| :--- | :--- |
| **鼠标左键按住拖动** | 移动悬浮球到桌面任意位置（松开后自动保存坐标） |
| **鼠标左键双击** | 快速切换显示模式（双环 -> 仅 CPU -> 仅内存 -> 自动轮播） |
| **鼠标悬停** | 放大 1.04x 微光反馈，并显示详细系统信息提示框（核心数、主频、内存 GB） |
| **鼠标右键点击** | 唤出右键快捷菜单（主题选择、显示模式、置顶/锁定、设置面板入口、退出） |

---

## ⚙️ 配置文件说明 (`config.json`)

程序运行后会在同级目录下生成/读取 `config.json`，支持自定义以下参数：

```json
{
    "diameter": 96,
    "opacity": 0.92,
    "ring_mode": "rainbow",
    "custom_color": "#00E5FF",
    "ring_width": 3.5,
    "ring_visibility": "always",
    "rotation_speed": 1.5,
    "display_mode": "dual",
    "cycle_interval": 3.0,
    "monitor_interval": 1.0,
    "always_on_top": true,
    "position_locked": false,
    "pos_x": 1720,
    "pos_y": 120
}
```

---

## 📂 工程模块结构

```text
gemini-3.7-flash/
├── config.py           # 配置管理系统（JSON 持久化、默认参数与主题色板）
├── floating_ball.py    # 桌面悬浮球核心组件（QPainter 自绘、液态物理高光、鼠标交互）
├── monitor.py          # 异步硬件监控后台线程（psutil 系统指标采样）
├── settings_dialog.py  # 现代化深色风格个性化设置面板
├── main.py             # 应用程序主入口
├── py_flowing_light.py # 兼容性快捷启动脚本
├── requirements.txt    # 依赖声明文件
└── README.md           # 详细说明文档
```
