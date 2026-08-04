# osu!mania：Python OpenGL 高效视频渲染工具 Benchmark

## 分类元数据

- **测试领域**: Python 工具与原生引擎
- **难度等级**: `L4`（专家级）
- **核心技术栈**: Python / PyOpenGL / GLFW / FFMPEG Pipe / skin.ini parser
- **核心考核点**: 480p skin.ini 坐标映射、.osu 解析器、长条音符拉伸、FFMPEG 视频管道

## 任务定位

测试模型在使用 Python + OpenGL 开发高性能 2D 图形与音视频渲染工具方面的能力，重点考核：
1. **渲染管线与高性能导出**：使用 OpenGL/ModernGL 结合 FFMPEG 进行高效逐帧离线渲染与实时预览。
2. **像素级界面还原与坐标转换**：对 osu! stable 经典 480p 虚构坐标系及 `skin.ini` 参数的精准解析与还原。
3. **皮肤与谱面解析引擎**：完整支持自定义皮肤包格式解析（`skin.ini` 及 PNG 精灵纹理）、`.osu` (Mania 模式) 谱面文件解析。

---

## 提示词

> 📋 **完整提示词以 [`PROJECT_PROMPT.md`](./PROJECT_PROMPT.md) 为唯一标准**，本页不再内嵌副本（避免版本漂移）。一键复制请见仓库根目录 [`DOMAIN_INDEX.zh.md`](../../DOMAIN_INDEX.zh.md)。
> 评测时请直接使用提示词原文，**不要修改任何技术约束**。
>
> 下方小节为任务要点速览，仅供理解项目背景；**评测输入请以 PROJECT_PROMPT.md 原文为准**。

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
