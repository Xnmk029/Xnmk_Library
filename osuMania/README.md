# osu!mania：Python OpenGL 高效视频渲染工具 Benchmark



## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: Python Tools & Native Engines
- **Difficulty Level (难度等级)**: `L4 (Expert)`
- **Primary Tech Stack (核心技术栈)**: Python / PyOpenGL / GLFW / FFMPEG Pipe / skin.ini parser
- **Core Evaluation Focus (核心考核点)**: 480p skin.ini coordinate mapping, .osu parser, LN note stretching, FFMPEG video pipe

## 任务定位

测试模型在使用 Python + OpenGL 开发高性能 2D 图形与音视频渲染工具方面的能力，重点考核：
1. **渲染管线与高性能导出**：使用 OpenGL/ModernGL 结合 FFMPEG 进行高效逐帧离线渲染与实时预览。
2. **像素级界面还原与坐标转换**：对 osu! stable 经典 480p 虚构坐标系及 `skin.ini` 参数的精准解析与还原。
3. **皮肤与谱面解析引擎**：完整支持自定义皮肤包格式解析（`skin.ini` 及 PNG 精灵纹理）、`.osu` (Mania 模式) 谱面文件解析。

---

## 标准化提示词

```markdown
你是一名精通 Python 2D/3D 图形学、OpenGL 与游戏音视频引擎的高级系统架构师。请编写一个基于 Python 和 OpenGL 的高效 osu!mania 视频渲染工具。

### 核心功能与技术要求

#### 1. 渲染架构与导出引擎
- **技术栈**：使用 Python（如 PyOpenGL / ModernGL + GLFW / Pygame）搭建 OpenGL 渲染管线。
- **渲染效率**：支持高帧率实时预览与硬加速离线视频导出（集成 `ffmpeg-python` 或通过管道输出 FFMPEG 导出 MP4 视频）。
- **参数可调**：支持命令行或配置文件自定义输出分辨率（如 1920x1080、2560x1440 等）及渲染帧率（如 60fps、120fps、240fps）。

#### 2. osu! stable Mania 界面像素级还原
- **480p 虚拟坐标映射**：osu! stable 内部采用 480p (640x480) 虚拟坐标系。系统必须自动将 `skin.ini` 中的各项数值映射至当前渲染目标分辨率。
- **轨道与舞台 (Stage Layout)**：
  - 支持 `ColumnStart`、`ColumnWidth`、`ColumnSpacing`、`ColumnRight` 参数计算。
  - 正确渲染 `StageLeft`、`StageRight`、`StageHint`（判定线提示）、`StageLight`（按键光束）与 `StageBottom`。
- **按键与 Note 下落 (Receptors & Notes)**：
  - 完美渲染标准 Note（单点）与 Long Note (LN/长条 Note，包含 Head 头部、Body 身体纹理拉伸、Tail 尾部）。
  - 支持 `HitPosition` 参数（决定判定线的垂直 Y 轴像素位置）。
  - 正确响应 `KeyImage[N]` (未按下) 与 `KeyImage[N]D` (按下状态/按键反馈)。
- **判定与 Combo UI (Judgement & Combo UI)**：
  - 精确显示 300g (MAX)、300、200、100、50、0 (Miss) 判定文字动画（缩放与渐淡效果）。
  - 结合 `ComboPosition` 与自定义数字图片（`Combo-0.png` ~ `Combo-9.png`）动态渲染当前连击数。
- **血条与计分板 (Health & Score)**：
  - 支持 HP 状态栏（`scorebar-bg` / `scorebar-colour`）与 Score 计分板渲染。

#### 3. 自定义皮肤与谱面文件解析 (`skin.ini` & `.osu`)
- **`skin.ini` 解析器**：
  - 完整读取 `[Mania]` 配置段落，包括 `Keys: 4` / `Keys: 7` 等键数配置。
  - 支持精灵图片缺省回退（如果皮肤中未提供特定图片，自动回退到内置默认样式或回退规则）。
- **`.osu` 谱面解析器**：
  - 解析 `[TimingPoints]` 获取 BPM 与 Timing 偏移。
  - 解析 `[HitObjects]` 中的轨道映射（根据 X 轴坐标计算所在音符轨道 Column = floor(x * KeyCount / 512)）。
  - 正确区分普通 Note 与 LN Note（根据类型掩码及冒号分隔的结束时间戳 `endTime`）。

#### 4. 代码质量与交付
- 代码结构清晰、解耦（分为 `parser` 谱面皮肤解析、`engine` 渲染引擎、`exporter` 视频导出器）。
- 提供命令行启动入口（支持传入 `.osu` 文件路径、皮肤目录路径、导出视频路径、分辨率与 FPS 参数）。
```

---

## 验收与评分标准

1. **界面还原度（40%）**：
   - 是否准确根据 `HitPosition`、`ColumnWidth` 等放置判定线和轨道。
   - LN 长条 Note 的 Body 是否平滑拉伸且 Head/Tail 无变形割裂。
   - Combo 数字与 Hit 判定的缩放动画是否符合经典 osu! 体验。

2. **皮肤与谱面兼容性（30%）**：
   - 能否正确加载不同的 `skin.ini` 和 PNG 纹理贴图。
   - 能否准确解析 4K / 7K 的 `.osu` 谱面并在指定时间戳准确下落。

3. **渲染效率与稳定性（30%）**：
   - 是否充分利用 OpenGL VAO/VBO/Batching 批量渲染，避免逐帧频繁重装纹理导致顿挫。
   - 能否稳定导出高帧率无卡顿的 MP4 视频。
