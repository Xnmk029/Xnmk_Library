# 蒙娜丽莎 · 纯 SVG 笔触复刻 — 交付说明

## 交付物

| 文件 | 说明 |
|---|---|
| `answer.svg` | 主作品：1200×1600 竖幅纯矢量复刻（约 3.5 MB，26,178 条 path + 6 个 circle + 35 个分层 `<g>`） |
| `generator.mjs` | 生成脚本（Node，确定性种子 `20260827`，可复现：`node generator.mjs`） |
| `qa/preview.png`、`qa/face.png` | 自研光栅化 QA 渲染（仅自查用，不参与画面） |
| `reference/monalisa_c2rmf.jpg` | 构图参考图（下载件，仅参考，未嵌入 SVG） |
| `log.md` / `result.json` | 过程记录与自查结果 |

## 参考图来源与许可状态

- **原作**：列奥纳多·达·芬奇《蒙娜丽莎》（约 1503–1519，枫木板上油画，77 × 53 cm），巴黎卢浮宫博物馆藏（INV 779）。
- **使用的数字影像**：C2RMF（法国博物馆研究与修复中心）修复扫描版
  *Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg*
  检索渠道：联网搜索（web_search）→ Wikimedia Commons
  文件页：<https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg>
  下载直链：`https://commons.wikimedia.org/wiki/Special:FilePath/…?width=1200`（存为 `reference/monalisa_c2rmf.jpg`，1280×1908 px）
- **许可状态**：原作创作于 16 世纪，作者逝世已逾 500 年，属**公有领域（Public Domain）**；Wikimedia Commons 上该扫描件标注为 PD-Art / PD-old-100（艺术作品复制品公有领域）。参考图**仅用于构图对位与色彩研究**，未以任何形式嵌入 SVG（无 `<image>`、无 base64、无外链位图）。

## 画法概要（纯矢量笔触）

- 全部形体由约 **26,000 条短弧描边**（二次贝塞尔 `Q` 弧段，`stroke-linecap="round"`，宽 0.9–4.5 px，不透明度 0.1–0.7）与 **135 条锥形填充薄片**（沿弧线宽度渐减的 path，模拟提白/勾线笔锋）构成；另有 6 个小 circle（瞳孔/鼻孔）。
- 笔触方向沿体积场排布：面部沿椭球切向包裹（sfumato 晕涂，多层明暗 + 邻近色抖动 + 边界柔化），头发自发际中点向垂落方向偏转，衣褶/袖子沿褶皱法向，山水沿山脊线与水纹。
- 35 个 `<g>` 层次分组：`ground → sky/haze/mtn/water/rocks/path/bridge/parapet（背景左右不对称山水）→ hair-back → dress/yoke → neck-chest → face 四层晕染 + features → hair-front/veil → sleeves/hands → glaze/vignette（全局罩染与暗角）`。
- 色板：赭褐 / 暗金 / 橄榄绿 / 深棕为主，肤色暖赭三层分明暗，背景蓝绿空气透视渐远。
- 唯一非笔触元素为 1 个 `<rect>` 全幅**有色底（imprimatura）**——古典油画的标准画布底色，仅统一缝隙底色，不表现任何形体；所有形体均由笔触层绘制。

## 已知局限

- 程序化笔触对五官的相似性为近似而非精确临摹；右侧远景拱桥较弱；面部略圆于原作。详见 `log.md`。
