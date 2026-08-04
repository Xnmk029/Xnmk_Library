使用 Python 和 OpenGL 编写一个高效的 osu!mania 视频渲染工具。要求尽可能像素级还原 osu! stable mania 模式的真实游玩界面。支持分辨率调整、帧率调整以及用户自定义皮肤与播放谱面。

### 核心功能与技术要求

#### 1. 渲染架构与导出引擎
- **技术栈**：使用 Python（推荐 PyOpenGL / ModernGL + GLFW 或 Pygame）搭建 OpenGL 渲染管线。
- **渲染效率**：支持高帧率实时预览与硬加速离线视频导出（集成 `ffmpeg-python` 或通过管道无缝导出 MP4 视频）。
- **参数可调**：支持自定义输出分辨率（如 1920x1080、2560x1440 等）及渲染帧率（如 60fps、120fps、240fps）。

#### 2. osu! stable Mania 界面像素级还原
- **480p 虚拟坐标映射**：osu! stable 内部采用 480p (640x480) 虚拟坐标系。系统必须自动将 `skin.ini` 中的各项数值映射至当前渲染目标分辨率。
- **轨道与舞台 (Stage Layout)**：
  - 支持 `ColumnStart`、`ColumnWidth`、`ColumnSpacing`、`ColumnRight` 等参数计算。
  - 正确渲染 `StageLeft`、`StageRight`、`StageHint`（判定线提示）、`StageLight`（按键光束）与 `StageBottom`。
- **按键与 Note 下落 (Receptors & Notes)**：
  - 完美渲染标准 Note（单点）与 Long Note (LN/长条 Note，包含 Head 头部、Body 身体纹理拉伸、Tail 尾部）。
  - 支持 `HitPosition` 参数（决定判定线的垂直 Y 轴像素位置）。
  - 正确响应 `KeyImage[N]` (未按下) 与 `KeyImage[N]D` (按下状态/按键反馈)。
- **判定与 Combo UI (Judgement & Combo UI)**：
  - 精确显示 300g (MAX)、300、200、100、50、0 (Miss) 判定文字动画（淡入、缩放与渐淡）。
  - 结合 `ComboPosition` 与自定义数字图片（`Combo-0.png` ~ `Combo-9.png`）动态渲染当前连击数。
- **血条与计分板 (Health & Score)**：
  - 支持 HP 状态栏（`scorebar-bg` / `scorebar-colour`）与 Score 计分板渲染。

#### 3. 自定义皮肤与谱面文件解析 (`skin.ini` & `.osu`)
- **`skin.ini` 解析器**：
  - 完整读取 `[Mania]` 配置段落，包括 `Keys: 4` / `Keys: 7` 等键数配置。
  - 支持精灵图片缺省回退（若皮肤缺少特定图片，能降级回退到默认图形）。
- **`.osu` 谱面解析器**：
  - 解析 `[TimingPoints]` 获取 BPM 与 Timing 时间轴。
  - 解析 `[HitObjects]` 中的轨道映射（根据 X 轴坐标计算所在音符轨道 Column = floor(x * KeyCount / 512)）。
  - 正确区分普通 Note 与 LN Note（根据类型掩码及冒号分隔的结束时间戳 `endTime`）。

#### 4. 代码质量与交付
- 代码结构清晰解耦（包含 `parser` 谱面皮肤解析模块、`engine` OpenGL 渲染引擎模块、`exporter` 视频导出器模块）。
- 提供命令行启动入口（支持传入 `.osu` 文件路径、皮肤目录路径、导出视频路径、分辨率与 FPS 参数）。
