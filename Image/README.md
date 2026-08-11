# Image · 图像生成与编辑评测分区

本目录与 `L1_Basic`–`L4_Expert` **并列**，专用于 **图像生成 / 图像编辑** 类测试项。每个子目录是 **独立测试项**（各自 `PROJECT_PROMPT.md` + `README.md`），可单独喂模型、单独打分。

**[English →](./README.en.md)**（若尚未提供英文版，以本页为准）

---

## 目录架构

```text
Image/
├── README.md                      # 本索引
├── ArchPhotoreal/                 # 建筑建模真实化（I2I）
├── StandardBooks3D/               # 国标图书 3D 产品渲染（T2I）
├── ConstructivistPoster/          # DeepSeek V4 构成主义海报（T2I）
├── WindowGlitchPoster/            # DeepSeek V4 窗口叠层故障海报（T2I）
├── GovTechPPT/                    # 政务科技 PPT 演示海报（I2I）
└── TextbookPeachBlossom/          # 桃花源记语文课本展开页（T2I）
```

---

## 测试项一览

| 序号 | 目录 | 名称 | 类型 | 评分项数 | 资源入口 |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 01 | [`ArchPhotoreal`](./ArchPhotoreal) | **建筑建模真实化** | I2I | 10 | [提示词](./ArchPhotoreal/PROJECT_PROMPT.md) \| [评分](./ArchPhotoreal/README.md) |
| 02 | [`StandardBooks3D`](./StandardBooks3D) | **国标系列图书 3D 渲染** | T2I | 5 | [提示词](./StandardBooks3D/PROJECT_PROMPT.md) \| [评分](./StandardBooks3D/README.md) |
| 03 | [`ConstructivistPoster`](./ConstructivistPoster) | **构成主义宣传海报** | T2I | 5 | [提示词](./ConstructivistPoster/PROJECT_PROMPT.md) \| [评分](./ConstructivistPoster/README.md) |
| 04 | [`WindowGlitchPoster`](./WindowGlitchPoster) | **窗口叠层与故障拼贴** | T2I | 5 | [提示词](./WindowGlitchPoster/PROJECT_PROMPT.md) \| [评分](./WindowGlitchPoster/README.md) |
| 05 | [`GovTechPPT`](./GovTechPPT) | **政务科技 PPT 海报** | I2I | 5 | [提示词](./GovTechPPT/PROJECT_PROMPT.md) \| [评分](./GovTechPPT/README.md) |
| 06 | [`TextbookPeachBlossom`](./TextbookPeachBlossom) | **桃花源记课本展开页** | T2I | 5 | [提示词](./TextbookPeachBlossom/PROJECT_PROMPT.md) \| [评分](./TextbookPeachBlossom/README.md) |

---

## 评测流程

1. 进入目标测试项目录。
2. 将 `PROJECT_PROMPT.md` **原样**提交给待测图像模型（I2I 项附带 `assets/` 内规定源图）。
3. 对照该目录 `README.md` 评分表打分。
4. 模型产物建议放在该目录下的 `<model-name>/` 中。

## 与 L1–L4 的关系

- **互不替代**：L1–L4 仍以代码/交互/3D 工程能力为主；`Image/` 专测图像模态。
- **索引**：主仓库 [`README.md`](../README.md) 可链入本分区；领域全文索引可择机并入 `DOMAIN_INDEX`。

## 评分轮次

| 轮次 | 摘要 | 数据 |
| :--- | :--- | :--- |
| 2026-08-09 | [SUMMARY-2026-08-09.md](./scores/SUMMARY-2026-08-09.md) | [round-2026-08-09.json](./scores/round-2026-08-09.json) |

模型产物约定：各测试项目录下 `<model-slug>/result.*` + `meta.json`。

## 众评 / 认领评分（单文件）

| 页面 | 认领 | 说明 |
| :--- | :---: | :--- |
| [`众评.html`](./众评.html) | 无 | 盲评向；测试项由入库绑定 |
| [`评分_认领.html`](./评分_认领.html) | **有** | 可改模型名/测试项/备注；预填入库参考分与 Grok 跑次 |
| [`评分_GrokImage2.html`](./评分_GrokImage2.html) | **有** | **仅真实 Grok Image 2 用户测 6 题** |

- 风格：瑞士国际主义 · **单张浏览** · 图片 base64 内嵌（源图合计 >50MB 时 JPEG 压缩）
- 重建：`python Image/scripts/build_crowd_html.py` ｜ `python Image/scripts/build_claim_html.py`
- localStorage：`crowd_score_v1` / `claim_score_v1`；Export JSON 可再入库

### Grok Image 2 自主跑次

- 数据：[`scores/round-2026-08-09-grok-bench.json`](./scores/round-2026-08-09-grok-bench.json)
- 产物：各测试项 `grok-image-2/result.jpg` + `meta.json`（引擎：xAI Imagine）
- **待人工打分**；建议用 `评分_认领.html` 完成并导出

