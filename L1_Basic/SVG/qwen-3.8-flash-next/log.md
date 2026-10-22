# 过程记录 — 蒙娜丽莎纯 SVG 笔触复刻

## 流程

1. **读题**：完整读取工作目录 `task.md`，确认硬性要求（纯矢量、数千笔触、构图对位、联网检索参考、约 1200×1600）。
2. **联网检索参考（题面要求，仅此用途）**：`web_search` 找到 Wikimedia Commons 上 C2RMF 修复扫描版 *Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg*（公有领域），`curl` 下载至 `reference/monalisa_c2rmf.jpg`（1280×1908，980 KB）。用自身视觉读取参考图，标定构图比例：头顶 y≈9%、眼 y≈23%、鼻底 y≈30%、口 y≈35%、颏 y≈40%、交叠双手 y≈75–88%、地平线 y≈31%、面中心 x≈0.47 等，映射到 1200×1600 画布。
3. **编写生成器** `generator.mjs`（Node，确定性随机种子 20260827，可复现）：
   - 分层笔触系统：35 个 `<g>` 语义层（背景山水 → 头发 → 衣裙 → 颈胸 → 面部四层晕染 → 五官 → 薄纱 → 袖与手 → 罩染/暗角）；
   - 方向场：面部椭球切向（混横向防同心环）、自发际中点的垂落场、多段线切向（小径/河流/袖褶）、噪声扰动；
   - 明暗场：`faceShade()` 左上光源渐变 + 颏下投影 + 边界柔化 fade（sfumato）；
   - 笔触原语：短弧 `Q` 描边（round cap，宽 0.9–4.5，alpha 0.1–0.7）+ 锥形填充薄片（taperStroke，模拟笔锋）+ 6 个 circle（瞳/鼻孔）；
   - 色彩：赭褐/暗金/橄榄绿/深棕主调，蓝绿空气透视，每条笔触 ±7~12 邻近色抖动；
   - 内置 QA 光栅化器（自研，zlib 写 PNG），支持全幅与面部特写两种渲染。
4. **迭代调参**（分片纪律：由脚本直接产出 answer.svg，未手工手写大文件；空 `parts/` 目录已删除）：
   - v1（12.7k 元素）：预览过暗、背景不可读、面部同心环、五官弱 → 提亮色板、加密笔触、混横向打散环纹；
   - v2（20.1k）：结构成立但缝隙显黑底 → 发现独立打开时透明缝隙会显示为白底，补 1 个全幅深色 `<rect>` 有色底（imprimatura，古典画布底色，不造型，README 声明），并再加密天空/岩石/衣裙；
   - v3（25.4k）：加面部特写渲染模式复核 → 精修五官（眼睑褶、主唇线锥形笔触、鼻侧影柱、颏下投影）、面部笔触改短改细；
   - 最终（26,184 元素，3.5 MB）：全幅与特写复核通过。
5. **校验**：pwsh `[xml]` 全文件解析 OK；regex 统计 path=26178 / circle=6 / rect=1 / g=35；`<image>`=0、href=0、base64=0、gradient=0、TODO=0；坐标均在 viewBox 内；无 `<text>`（零字体依赖）。
6. **交付**：`answer.svg` + `README.md`（参考来源与许可）+ `result.json`（自查）+ 本 log。

## 诚信声明（逐条对应 result.json integrity）

1. **read_files_outside_workspace = false**：全程只读/写 `F:\benchmark\暂存\qwen-3.8-flash-next-20260827\ws-monalisa\` 内文件（task.md、reference/、qa/、generator.mjs、answer.svg 等）；未读取、列举或搜索工作目录外任何路径；pwsh 仅用于本目录内的 node 执行、下载落盘、文件统计与 XML 解析校验。
2. **used_git_history = false**：未执行任何 git 命令，未窥探任何版本历史。
3. **created_subagents_or_workflows = false**：未调用 subagent / subagent_fork / workflow / ralph / job_* / dev_* / goal 类工具，作答全程独立完成。
4. **used_external_model_or_web**：网络使用仅限题面豁免的构图参考——1 次 web_search（检索公有领域原作扫描）+ 1 次 curl 下载（Wikimedia Commons C2RMF 扫描 → reference/）；未检索题面原文、答案、题库、他人同题作品或任何"SVG 复刻蒙娜丽莎"现成实现；未调用 qwen_generate / qwen_vision / qwen_chat 等外部模型 API 作画或校验。QA 预览由自研 Node 光栅化器生成，`read_image` 仅用于查看自己脚本渲染出的自有结果（同一模型自身视觉，非外部模型调用）。画面 100% 由 generator.mjs 输出的纯 SVG 代码构成，无位图嵌入、无 base64 主体、无外链。

## 未达标/偏差项（如实）

- 五官相似性为程序化近似，颧骨—鼻翼过渡不及原作精到；
- 右侧远景拱桥偏弱、易被雾色吞没；
- 面部轮廓略圆于原作窄椭圆；
- 存在 1 个全幅单色 `<rect>` 有色底：属古典 imprimatura 技法声明，不参与造型，但在最严格"禁大面积平涂"口径下存在解释风险；
- QA 光栅化为近似渲染，与专业 SVG 渲染器（resvg/浏览器）的最终像素会有细微差异。
