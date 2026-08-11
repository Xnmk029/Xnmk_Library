# -*- coding: utf-8 -*-
"""Build Swiss-style 评分_认领.html with claim UI + embedded images."""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(r"F:\benchmark\Image")
SCORES_MAIN = ROOT / "scores" / "round-2026-08-09.json"
SCORES_GROK = ROOT / "scores" / "round-2026-08-09-grok-bench.json"
OUT = ROOT / "评分_认领.html"
EXTRACTED = Path(r"F:\benchmark\暂存\onenote_extracted")
TARGET_MAX = 50 * 1024 * 1024
LONG_EDGE = 1600
RUBRICS = {
    "ArchPhotoreal": {
        "label": "建筑建模真实化",
        "items": [
            ("s1", "建筑结构保持", "比例、体块、门窗、屋顶与右翼体量"),
            ("s2", "道路真实化与走向", "材质、标线、路缘；走向与源图一致"),
            ("s3", "背景丘陵与植被", "红底→中南丘陵+真实树林"),
            ("s4", "玻璃识别与光学", "透明、高光、环境反射"),
            ("s5", "表面材质优化", "砖瓦木金；减少循环贴图"),
            ("s6", "整体光影融合", "统一光照，接近实拍"),
            ("s7", "门口沟坎深度", "入口挡土/沟坎纵深与层次"),
            ("s8", "门头字牌可辨", "门头竖牌文字清晰可辨"),
            ("s9", "画面清晰度", "锐度、噪声、糊边、过压缩"),
            ("s10", "生成速率与费用", "时延、单价、单位质量成本"),
        ],
    },
    "StandardBooks3D": {
        "label": "国标图书 3D",
        "items": [
            ("s1", "文字清晰度", "封面/书脊标题、分册名可读"),
            ("s2", "物体合理度", "厚度、透视、阴影、装帧"),
            ("s3", "提示词遵循度", "约 5 册；封面与书脊名称"),
            ("s4", "细节标识准确性", "GB/徽章、底纹、金蓝饰带"),
            ("s5", "整体构图", "3/4 等距、影棚、3:4 美学"),
        ],
    },
    "ConstructivistPoster": {
        "label": "构成主义海报",
        "items": [
            ("s1", "文字与品牌清晰度", "DeepSeek/V4 与轮廓锐度"),
            ("s2", "物体/角色合理度", "动漫女性拟人完整性"),
            ("s3", "提示词遵循度", "构成主义几何、扁平高对比"),
            ("s4", "细节标识与材质", "三色限定 + 丝网颗粒磨损"),
            ("s5", "整体构图", "不对称张力、海报冲击力"),
        ],
    },
    "WindowGlitchPoster": {
        "label": "窗口故障拼贴",
        "items": [
            ("s1", "文字与界面清晰度", "窗体字与角色线稿"),
            ("s2", "物体/角色合理度", "全身动态、非常规站桩"),
            ("s3", "提示词遵循度", "窗格叠层 + 天空透明视窗"),
            ("s4", "细节标识与特效", "Glitch；克莱因蓝+白"),
            ("s5", "整体构图", "律动、留白、诗意"),
        ],
    },
    "GovTechPPT": {
        "label": "政务科技 PPT",
        "items": [
            ("s1", "文字清晰度", "文案、L3/L4、副/主驾驶可读"),
            ("s2", "物体合理度", "左侧 3D 书册与光影"),
            ("s3", "提示词遵循度", "底板基因；左书右文；动线"),
            ("s4", "细节标识与信息", "标准号、L 级、叙事正确"),
            ("s5", "整体构图", "汇报主视觉完成度"),
        ],
    },
    "TextbookPeachBlossom": {
        "label": "桃花源记课本",
        "items": [
            ("s1", "文字清晰度", "标题与正文可读"),
            ("s2", "物体合理度", "展开课本物理状态"),
            ("s3", "提示词遵循度", "语文课本展开 + 桃花源记"),
            ("s4", "细节标识与内容", "篇名/文言气质"),
            ("s5", "是否有插图与插图合理性", "有无插图；是否贴合文意与教材版式"),
        ],
    },
}


def resolve_path(entry: dict) -> Path | None:
    if entry.get("repo_path"):
        p = ROOT / entry["repo_path"]
        if p.exists():
            return p
    # grok bench synthetic filenames
    if str(entry.get("file", "")).startswith("grok-bench-"):
        task = entry.get("task") or ""
        p = ROOT / task / "grok-image-2" / "result.jpg"
        if p.exists():
            return p
    p = EXTRACTED / entry["file"]
    return p if p.exists() else None


def load_entries() -> list[dict]:
    entries: list[dict] = []
    main = json.loads(SCORES_MAIN.read_text(encoding="utf-8"))
    for e in main["images"]:
        if e.get("task") and e.get("task") != "_skip":
            entries.append(e)
    if SCORES_GROK.exists():
        grok = json.loads(SCORES_GROK.read_text(encoding="utf-8"))
        for e in grok.get("images", []):
            # avoid dup if same repo_path already present as notes-era grok
            entries.append(e)
    task_order = [
        "ArchPhotoreal",
        "StandardBooks3D",
        "ConstructivistPoster",
        "WindowGlitchPoster",
        "GovTechPPT",
        "TextbookPeachBlossom",
    ]
    order_map = {t: i for i, t in enumerate(task_order)}
    entries.sort(
        key=lambda e: (
            order_map.get(e.get("task"), 99),
            0 if e.get("run_id") == "2026-08-09-grok-bench" else 1,
            e.get("file") or "",
        )
    )
    return entries

def compress_image(path: Path, quality: int, long_edge: int) -> tuple[bytes, str, tuple[int, int]]:
    im = Image.open(path)
    if im.mode in ("RGBA", "P"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        if im.mode == "P":
            im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1] if im.mode == "RGBA" else None)
        im = bg
    else:
        im = im.convert("RGB")
    w, h = im.size
    scale = min(1.0, long_edge / max(w, h))
    if scale < 1.0:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    data = buf.getvalue()
    return data, "image/jpeg", im.size


def pack_images(entries: list[dict]) -> list[dict]:
    """Compress until total payload <= TARGET_MAX."""
    qualities = [88, 82, 76, 70, 64, 58, 52]
    edges = [1600, 1400, 1280, 1024, 896]

    for long_edge in edges:
        for q in qualities:
            packed = []
            total = 0
            for e in entries:
                path = resolve_path(e)
                if not path:
                    continue
                data, mime, size = compress_image(path, q, long_edge)
                total += len(data)
                packed.append(
                    {
                        "id": e["file"],
                        "file": e["file"],
                        "task": e.get("task") or "",
                        "model": e.get("model") or "",
                        "note": e.get("note") or "",
                        "tag": e.get("tag") or "",
                        "run_id": e.get("run_id") or "",
                        "ref_scores": e.get("scores") or {},
                        "mime": mime,
                        "w": size[0],
                        "h": size[1],
                        "bytes": len(data),
                        "b64": base64.b64encode(data).decode("ascii"),
                    }
                )
            print(f"try long_edge={long_edge} q={q} n={len(packed)} total_MB={total/1024/1024:.2f}")
            if total <= TARGET_MAX:
                return packed, total, long_edge, q
    # last resort: return last pack even if over
    return packed, total, long_edge, q


def build_html(images: list[dict], meta: dict) -> str:
    # strip b64 into JS array to avoid huge template issues — still one file
    images_js = json.dumps(
        [
            {
                "id": im.get("id") or im["file"],
                "file": im["file"],
                "task": im["task"],
                "model": im["model"],
                "note": im["note"],
                "tag": im.get("tag") or "",
                "run_id": im.get("run_id") or "",
                "ref_scores": im["ref_scores"],
                "w": im["w"],
                "h": im["h"],
                "src": f"data:{im['mime']};base64,{im['b64']}",
            }
            for im in images
        ],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    rubrics_js = json.dumps(RUBRICS, ensure_ascii=False, separators=(",", ":"))
    meta_js = json.dumps(meta, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>评分认领 · IMAGE BENCHMARK</title>
<style>
  :root {{
    --bg: #ffffff;
    --ink: #000000;
    --muted: #5c5c5c;
    --line: #000000;
    --line-soft: #d0d0d0;
    --accent: #e30613;
    --panel: #f4f4f4;
    --font: "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
    --mono: "Helvetica Neue", Helvetica, Arial, monospace;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ height: 100%; margin: 0; }}
  body {{
    font-family: var(--font);
    background: var(--bg);
    color: var(--ink);
    display: grid;
    grid-template-rows: 56px 1fr 72px;
    min-height: 100vh;
  }}
  button, input, select, textarea {{
    font-family: inherit;
    color: var(--ink);
    background: var(--bg);
    border: 1px solid var(--ink);
    border-radius: 0;
    padding: 8px 12px;
  }}
  button {{
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 11px;
    font-weight: 700;
    background: var(--bg);
  }}
  button:hover {{ background: var(--ink); color: var(--bg); }}
  button.primary {{ background: var(--accent); color: #fff; border-color: var(--accent); }}
  button.primary:hover {{ background: #b0000a; border-color: #b0000a; color: #fff; }}
  button:disabled {{ opacity: 0.3; cursor: not-allowed; }}
  button:disabled:hover {{ background: var(--bg); color: var(--ink); }}

  header {{
    display: grid;
    grid-template-columns: 220px 1fr auto;
    align-items: stretch;
    border-bottom: 2px solid var(--ink);
  }}
  .brand {{
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 16px;
    border-right: 2px solid var(--ink);
    background: var(--ink);
    color: #fff;
  }}
  .brand .t {{
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1;
  }}
  .brand .s {{
    margin-top: 4px;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.75;
  }}
  label.field {{ display: block; margin-bottom: 10px; }}
  label.field > span {{
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 4px;
    color: var(--muted);
  }}
  label.field input, label.field select, label.field textarea {{
    width: 100%;
    border: 1px solid var(--ink);
    border-radius: 0;
    padding: 8px 10px;
    font-size: 13px;
    background: #fff;
  }}
  label.field textarea {{ min-height: 56px; resize: vertical; }}
  .row2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
  .hdr-mid {{
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    min-width: 0;
  }}
  .idx-big {{
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    white-space: nowrap;
  }}
  .idx-big span {{ color: var(--muted); font-weight: 400; }}
  .file-meta {{
    min-width: 0;
    overflow: hidden;
  }}
  .file-meta .task {{
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }}
  .file-meta .name {{
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .hdr-actions {{
    display: flex;
    align-items: stretch;
  }}
  .hdr-actions button {{
    border: none;
    border-left: 1px solid var(--ink);
    min-width: 88px;
  }}

  main {{
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    min-height: 0;
  }}
  @media (max-width: 960px) {{
    main {{ grid-template-columns: 1fr; grid-template-rows: 48vh 1fr; }}
    header {{ grid-template-columns: 1fr; }}
    .brand {{ border-right: none; border-bottom: 1px solid #fff; }}
  }}

  .stage {{
    display: grid;
    grid-template-rows: 1fr;
    min-width: 0;
    min-height: 0;
    border-right: 2px solid var(--ink);
    position: relative;
    background:
      linear-gradient(90deg, transparent 47px, rgba(0,0,0,0.04) 47px, rgba(0,0,0,0.04) 48px, transparent 48px),
      linear-gradient(transparent 47px, rgba(0,0,0,0.04) 47px, rgba(0,0,0,0.04) 48px, transparent 48px),
      #fafafa;
    background-size: 48px 48px;
  }}
  .viewport {{
    min-height: 0;
    display: grid;
    place-items: center;
    padding: 24px 48px;
    overflow: auto;
    overscroll-behavior: contain;
  }}
  .viewport.is-zoomed {{ place-items: start center; cursor: grab; }}
  .viewport.is-zoomed.dragging {{ cursor: grabbing; }}
  .viewport img {{
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    background: #fff;
    border: 1px solid var(--ink);
    box-shadow: 12px 12px 0 rgba(0,0,0,0.08);
    cursor: zoom-in;
    user-select: none;
    -webkit-user-drag: none;
  }}
  .viewport.is-zoomed img {{
    max-width: none !important;
    max-height: none !important;
    object-fit: unset;
    cursor: inherit;
  }}
  .nav-abs {{
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 88px;
    z-index: 2;
    border: 1px solid var(--ink);
    background: #fff;
    font-size: 22px;
    font-weight: 700;
  }}
  .nav-prev {{ left: 12px; }}
  .nav-next {{ right: 12px; }}

  aside {{
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--bg);
  }}
  aside .scroll {{
    flex: 1;
    overflow: auto;
    padding: 0;
  }}
  .block {{
    border-bottom: 1px solid var(--ink);
    padding: 16px 18px;
  }}
  .block h2 {{
    margin: 0 0 12px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }}
  .task-title {{
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.15;
    margin: 0 0 6px;
  }}
  .hint {{
    font-size: 11px;
    color: var(--muted);
    line-height: 1.45;
    margin: 0;
  }}
  .model-line {{
    font-size: 12px;
    margin-top: 10px;
    display: none;
  }}
  .model-line.show {{ display: block; }}
  .model-line b {{ font-weight: 700; }}
  .score-head {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 12px;
  }}
  .score-total {{
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }}
  .score-total small {{
    font-size: 11px;
    font-weight: 400;
    color: var(--muted);
    letter-spacing: 0;
  }}
  .crit {{
    border-top: 1px solid var(--line-soft);
    padding: 12px 0;
  }}
  .crit:first-child {{ border-top: none; padding-top: 0; }}
  .crit-top {{
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }}
  .crit-name {{
    font-size: 13px;
    font-weight: 700;
  }}
  .crit-score {{
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    min-width: 2ch;
    text-align: right;
  }}
  .crit-desc {{
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 8px;
    line-height: 1.4;
  }}
  .nums {{
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }}
  .nums button {{
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 11px;
    font-weight: 700;
    border-color: var(--line-soft);
  }}
  .nums button.on {{
    background: var(--ink);
    color: #fff;
    border-color: var(--ink);
  }}
  .nums button.zero {{ width: auto; padding: 0 8px; }}
  .actions {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }}
  .actions button {{
    border: none;
    border-right: 1px solid var(--ink);
    border-top: 1px solid var(--ink);
    min-height: 48px;
  }}
  .actions button:nth-child(2n) {{ border-right: none; }}
  .foot-note {{
    padding: 12px 18px 18px;
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 0.04em;
    line-height: 1.5;
  }}
  kbd {{
    font-family: var(--font);
    font-size: 10px;
    border: 1px solid var(--line-soft);
    padding: 0 4px;
  }}

  footer {{
    border-top: 2px solid var(--ink);
    display: grid;
    grid-template-columns: 160px 1fr 200px;
    align-items: stretch;
    background: var(--bg);
  }}
  .foot-label {{
    display: flex;
    align-items: center;
    padding: 0 16px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    border-right: 1px solid var(--ink);
    background: var(--panel);
  }}
  .thumbs {{
    display: flex;
    gap: 0;
    overflow-x: auto;
    align-items: stretch;
  }}
  .thumbs button {{
    border: none;
    border-right: 1px solid var(--line-soft);
    width: 64px;
    padding: 0;
    position: relative;
    background: #fff;
  }}
  .thumbs button img {{
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0.55;
    filter: grayscale(1);
  }}
  .thumbs button.active img {{
    opacity: 1;
    filter: none;
  }}
  .thumbs button.done::after {{
    content: "";
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 3px;
    background: var(--accent);
  }}
  .foot-status {{
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 0 16px;
    border-left: 1px solid var(--ink);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }}
  .pill {{
    display: inline-block;
    padding: 4px 8px;
    border: 1px solid var(--ink);
  }}
  .pill.ok {{ background: var(--ink); color: #fff; }}
  .toast {{
    position: fixed;
    left: 50%;
    bottom: 88px;
    transform: translateX(-50%) translateY(8px);
    background: var(--ink);
    color: #fff;
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0;
    pointer-events: none;
    transition: .18s ease;
    z-index: 50;
  }}
  .toast.show {{ opacity: 1; transform: translateX(-50%) translateY(0); }}
  .ref-note {{
    margin-top: 8px;
    font-size: 10px;
    color: var(--muted);
  }}
</style>
</head>
<body>
<header>
  <div class="brand">
    <div class="t">评分认领</div>
    <div class="s">Image Benchmark · Claim</div>
  </div>
  <div class="hdr-mid">
    <div class="idx-big" id="counter">01 <span>/ 00</span></div>
    <div class="file-meta">
      <div class="task" id="taskLabel">—</div>
      <div class="name" id="fileName">—</div>
    </div>
  </div>
  <div class="hdr-actions">
    <button type="button" id="btnPrev">Prev</button>
    <button type="button" id="btnNext">Next</button>
    <button type="button" id="btnUnscored">Next Open</button>
    <button type="button" id="btnZoom" title="Z / click image to zoom">Zoom Fit</button>
    <button type="button" id="btnExport">Export</button>
    <button type="button" class="primary" id="btnSave">Save</button>
  </div>
</header>

<main>
  <section class="stage">
    <button type="button" class="nav-abs nav-prev" id="fabPrev" aria-label="prev">←</button>
    <button type="button" class="nav-abs nav-next" id="fabNext" aria-label="next">→</button>
    <div class="viewport" id="viewport">
      <img id="mainImg" alt=""/>
    </div>
  </section>
  <aside>
    <div class="scroll">
      <div class="block">
        <h2>Claim · 认领</h2>
        <p class="task-title" id="taskTitle">—</p>
        <p class="hint">单张浏览。可修改模型名与测试项后打分；数据存 localStorage，Export 可汇总入库。</p>
        <label class="field"><span>模型 / 来源</span>
          <input type="text" id="claimModel" list="modelList" autocomplete="off"/>
        </label>
        <datalist id="modelList">
          <option value="Grok Image 2"></option>
          <option value="Gemini Nano Banana 2"></option>
          <option value="GPT Image 2"></option>
          <option value="Qwen Image 3"></option>
          <option value="Seedream 5.0 lite"></option>
          <option value="Seedream 5 pro"></option>
          <option value="源图 / 输入"></option>
          <option value="忽略 / 碎片"></option>
        </datalist>
        <label class="field"><span>归属测试项</span>
          <select id="claimTask">
            <option value="">— 未指定 —</option>
            <option value="ArchPhotoreal">ArchPhotoreal · 建筑真实化 (10)</option>
            <option value="StandardBooks3D">StandardBooks3D · 国标图书 (5)</option>
            <option value="ConstructivistPoster">ConstructivistPoster · 构成主义 (5)</option>
            <option value="WindowGlitchPoster">WindowGlitchPoster · 窗口故障 (5)</option>
            <option value="GovTechPPT">GovTechPPT · 政务 PPT (5)</option>
            <option value="TextbookPeachBlossom">TextbookPeachBlossom · 桃花源记 (5)</option>
            <option value="_skip">不评分（源图/碎片）</option>
          </select>
        </label>
        <div class="row2">
          <label class="field"><span>标签</span><input type="text" id="claimTag"/></label>
          <label class="field"><span>评分人</span><input type="text" id="rater"/></label>
        </div>
        <label class="field"><span>备注</span><textarea id="claimNote"></textarea></label>
        <p class="ref-note" id="refNote"></p>
      </div>
      <div class="block">
        <div class="score-head">
          <h2 style="margin:0">Score</h2>
          <div class="score-total" id="scoreTotal">— <small>/ —</small></div>
        </div>
        <div id="criteria"></div>
      </div>
      <div class="actions">
        <button type="button" id="btnReset">Reset</button>
        <button type="button" id="btnDone">Mark Done</button>
        <button type="button" id="btnImport">Import</button>
        <button type="button" id="btnClear">Clear All</button>
      </div>
      <input type="file" id="importFile" accept="application/json,.json" hidden/>
      <div class="foot-note">
        KEYS · <kbd>←</kbd><kbd>→</kbd> navigate · <kbd>S</kbd> save · <kbd>1</kbd>–<kbd>0</kbd> score<br/>
        Swiss grid · localStorage only · export JSON to share
      </div>
    </div>
  </aside>
</main>

<footer>
  <div class="foot-label">Index</div>
  <div class="thumbs" id="thumbs"></div>
  <div class="foot-status">
    <span class="pill" id="savePill">Local</span>
    <span id="progressText">0 / 0</span>
  </div>
</footer>
<div class="toast" id="toast"></div>

<script>
const IMAGES = {images_js};
const RUBRICS = {rubrics_js};
const META = {meta_js};
const STORAGE_KEY = "claim_score_v1";

const ZOOM_STEPS = [0, 1, 1.5, 2, 3];
const state = {{
  index: 0,
  zoomScale: 0,
  data: loadAll(),
  dirty: false,
  focusCrit: 0,
  drag: null,
  _didDrag: false
}};
function applyZoom() {{
  const img = document.getElementById("mainImg");
  const vp = document.getElementById("viewport");
  const btn = document.getElementById("btnZoom");
  const z = state.zoomScale;
  if (!z) {{
    img.style.width = "";
    img.style.height = "";
    img.style.maxWidth = "";
    img.style.maxHeight = "";
    vp.classList.remove("is-zoomed");
    if (btn) btn.textContent = "Zoom Fit";
  }} else {{
    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;
    img.style.maxWidth = "none";
    img.style.maxHeight = "none";
    img.style.width = Math.round(nw * z) + "px";
    img.style.height = Math.round(nh * z) + "px";
    vp.classList.add("is-zoomed");
    if (btn) btn.textContent = "Zoom " + z + "×";
  }}
}}
function cycleZoom(dir) {{
  const steps = ZOOM_STEPS;
  let i = steps.indexOf(state.zoomScale);
  if (i < 0) i = 0;
  i = (i + (dir || 1) + steps.length * 10) % steps.length;
  state.zoomScale = steps[i];
  applyZoom();
}}

function loadAll() {{
  try {{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {{}};
  }} catch {{ return {{}}; }}
}}
function saveAll() {{
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  state.dirty = false;
  updateSavePill();
}}
function seedEntry(im) {{
  if (!state.data[im.id]) {{
    state.data[im.id] = {{
      model: im.model || "",
      task: im.task || "",
      tag: im.tag || "",
      rater: "",
      note: im.note || "",
      scores: Object.assign({{}}, im.ref_scores || {{}}),
      done: false,
      updatedAt: null
    }};
  }}
  return state.data[im.id];
}}
function entry(id) {{
  const im = IMAGES.find(x => x.id === id) || {{ id: id }};
  return seedEntry(im);
}}
function current() {{ return IMAGES[state.index]; }}
function flushForm() {{
  const im = current();
  const e = entry(im.id);
  e.model = document.getElementById("claimModel").value.trim();
  e.task = document.getElementById("claimTask").value;
  e.tag = document.getElementById("claimTag").value.trim();
  e.rater = document.getElementById("rater").value.trim();
  e.note = document.getElementById("claimNote").value.trim();
}}
function fillForm() {{
  const e = entry(current().id);
  document.getElementById("claimModel").value = e.model || "";
  document.getElementById("claimTask").value = e.task || "";
  document.getElementById("claimTag").value = e.tag || "";
  document.getElementById("rater").value = e.rater || "";
  document.getElementById("claimNote").value = e.note || "";
}}
function toast(msg) {{
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1400);
}}
function pad(n) {{ return String(n).padStart(2, "0"); }}
function updateSavePill() {{
  const pill = document.getElementById("savePill");
  const doneN = IMAGES.filter(im => isComplete(entry(im.id), im.task)).length;
  document.getElementById("progressText").textContent = doneN + " / " + IMAGES.length;
  if (state.dirty) {{
    pill.textContent = "Unsaved";
    pill.classList.remove("ok");
  }} else {{
    pill.textContent = doneN ? "Saved " + doneN : "Local";
    pill.classList.toggle("ok", !!doneN);
  }}
}}
function isComplete(e, task) {{
  if (!e) return false;
  if (e.done) return true;
  if (task === "_skip") return !!(e.model || e.task);
  const rub = RUBRICS[task];
  if (!rub) return false;
  return rub.items.every(it => typeof e.scores[it[0]] === "number");
}}
function activeTask() {{
  const e = entry(current().id);
  return e.task || current().task || "";
}}
function renderThumbs() {{
  const strip = document.getElementById("thumbs");
  strip.innerHTML = "";
  IMAGES.forEach((im, i) => {{
    const b = document.createElement("button");
    b.type = "button";
    if (i === state.index) b.classList.add("active");
    if (isComplete(entry(im.id), im.task)) b.classList.add("done");
    const img = document.createElement("img");
    img.src = im.src;
    img.alt = im.file;
    b.appendChild(img);
    b.addEventListener("click", () => go(i));
    strip.appendChild(b);
  }});
  const active = strip.querySelector("button.active");
  if (active) active.scrollIntoView({{ inline: "center", block: "nearest", behavior: "smooth" }});
}}
function renderCriteria() {{
  const im = current();
  const e = entry(im.id);
  const task = e.task || im.task;
  const rub = RUBRICS[task];
  const box = document.getElementById("criteria");
  box.innerHTML = "";
  if (task === "_skip") {{
    box.innerHTML = '<p class="hint">标记为不评分，仅保存认领信息。</p>';
    document.getElementById("scoreTotal").innerHTML = "— <small>/ —</small>";
    return;
  }}
  if (!rub) {{
    box.innerHTML = '<p class="hint">请先选择归属测试项以加载评分表。</p>';
    document.getElementById("scoreTotal").innerHTML = "— <small>/ —</small>";
    return;
  }}
  rub.items.forEach((it, idx) => {{
    const key = it[0], name = it[1], desc = it[2];
    const val = e.scores[key];
    const row = document.createElement("div");
    row.className = "crit";
    const top = document.createElement("div");
    top.className = "crit-top";
    const nameEl = document.createElement("div");
    nameEl.className = "crit-name";
    nameEl.textContent = (idx + 1) + ". " + name;
    const scoreEl = document.createElement("div");
    scoreEl.className = "crit-score";
    scoreEl.textContent = typeof val === "number" ? String(val) : "—";
    top.appendChild(nameEl);
    top.appendChild(scoreEl);
    const descEl = document.createElement("div");
    descEl.className = "crit-desc";
    descEl.textContent = desc;
    const nums = document.createElement("div");
    nums.className = "nums";
    row.appendChild(top);
    row.appendChild(descEl);
    row.appendChild(nums);
    const z = document.createElement("button");
    z.type = "button";
    z.className = "zero" + (val === 0 ? " on" : "");
    z.textContent = "0";
    z.addEventListener("click", () => setScore(key, 0, idx));
    nums.appendChild(z);
    for (let s = 1; s <= 10; s++) {{
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(s);
      if (val === s) b.classList.add("on");
      b.addEventListener("click", () => setScore(key, s, idx));
      nums.appendChild(b);
    }}
    box.appendChild(row);
  }});
  const vals = rub.items.map(it => e.scores[it[0]]).filter(v => typeof v === "number");
  const sum = vals.reduce((a, b) => a + b, 0);
  const max = rub.items.length * 10;
  const avg = vals.length ? (sum / vals.length).toFixed(1) : "—";
  document.getElementById("scoreTotal").innerHTML =
    (vals.length ? sum : "—") + " <small>/ " + max + " · AVG " + avg + " · " + vals.length + "/" + rub.items.length + "</small>";
}}
function setScore(key, value, idx) {{
  flushForm();
  const e = entry(current().id);
  e.scores[key] = value;
  state.focusCrit = typeof idx === "number" ? idx : state.focusCrit;
  state.dirty = true;
  renderCriteria();
  renderThumbs();
  updateSavePill();
}}
function go(i) {{
  if (i < 0 || i >= IMAGES.length) return;
  if (document.getElementById("claimModel")) flushForm();
  state.index = i;
  state.zoomScale = 0;
  state.drag = null;
  const im = current();
  seedEntry(im);
  const main = document.getElementById("mainImg");
  main.onload = () => applyZoom();
  main.src = im.src;
  applyZoom();
  document.getElementById("counter").innerHTML = pad(i + 1) + " <span>/ " + pad(IMAGES.length) + "</span>";
  const e = entry(im.id);
  const task = e.task || im.task;
  const rub = RUBRICS[task];
  document.getElementById("taskLabel").textContent = task || "—";
  document.getElementById("taskTitle").textContent = rub ? rub.label : (task || "未指定测试项");
  document.getElementById("fileName").textContent = im.file + " · " + im.w + "×" + im.h;
  fillForm();
  const refKeys = Object.keys(im.ref_scores || {{}});
  document.getElementById("refNote").textContent = refKeys.length
    ? "已预填入库参考分（可改） · REF SCORES LOADED"
    : (im.run_id ? "GROK BENCH RUN · 待认领打分" : "");
  document.getElementById("btnPrev").disabled = i === 0;
  document.getElementById("btnNext").disabled = i === IMAGES.length - 1;
  document.getElementById("fabPrev").disabled = i === 0;
  document.getElementById("fabNext").disabled = i === IMAGES.length - 1;
  renderCriteria();
  renderThumbs();
  updateSavePill();
}}
function saveCurrent(markDone) {{
  flushForm();
  const e = entry(current().id);
  if (markDone) e.done = true;
  e.updatedAt = new Date().toISOString();
  saveAll();
  renderThumbs();
  toast(markDone ? "Saved · Done" : "Saved");
}}
function nextUnscored() {{
  flushForm();
  const n = IMAGES.length;
  for (let step = 1; step <= n; step++) {{
    const i = (state.index + step) % n;
    const e = entry(IMAGES[i].id);
    const task = e.task || IMAGES[i].task;
    if (!isComplete(e, task)) {{
      go(i);
      return;
    }}
  }}
  toast("All complete");
}}
function exportJson() {{
  flushForm();
  const payload = {{
    version: 1,
    kind: "claim",
    meta: META,
    exportedAt: new Date().toISOString(),
    images: IMAGES.map(im => ({{
      file: im.file,
      ...(state.data[im.id] || {{ model: im.model, task: im.task }})
    }}))
  }};
  const blob = new Blob([JSON.stringify(payload, null, 2)], {{ type: "application/json" }});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "claim_scores_" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Exported");
}}
function importJson(file) {{
  const reader = new FileReader();
  reader.onload = () => {{
    try {{
      const obj = JSON.parse(reader.result);
      const list = obj.images || obj;
      list.forEach(row => {{
        const id = row.file || row.id;
        if (!id) return;
        state.data[id] = {{
          model: row.model || "",
          task: row.task || "",
          tag: row.tag || "",
          rater: row.rater || "",
          note: row.note || "",
          scores: row.scores || {{}},
          done: !!row.done,
          updatedAt: row.updatedAt || new Date().toISOString()
        }};
      }});
      saveAll();
      fillForm();
      renderCriteria();
      renderThumbs();
      toast("Imported");
    }} catch (err) {{
      toast("Import failed");
    }}
  }};
  reader.readAsText(file);
}}

document.getElementById("btnPrev").onclick = () => go(state.index - 1);
document.getElementById("btnNext").onclick = () => go(state.index + 1);
document.getElementById("fabPrev").onclick = () => go(state.index - 1);
document.getElementById("fabNext").onclick = () => go(state.index + 1);
document.getElementById("btnUnscored").onclick = nextUnscored;
document.getElementById("btnSave").onclick = () => saveCurrent(false);
document.getElementById("btnDone").onclick = () => saveCurrent(true);
document.getElementById("btnExport").onclick = exportJson;
document.getElementById("btnImport").onclick = () => document.getElementById("importFile").click();
document.getElementById("importFile").onchange = (ev) => {{
  const f = ev.target.files && ev.target.files[0];
  if (f) importJson(f);
  ev.target.value = "";
}};
document.getElementById("btnReset").onclick = () => {{
  flushForm();
  const e = entry(current().id);
  e.scores = {{}};
  e.done = false;
  state.dirty = true;
  renderCriteria();
  renderThumbs();
  updateSavePill();
}};
document.getElementById("btnClear").onclick = () => {{
  if (!confirm("清空本机全部认领与评分？")) return;
  state.data = {{}};
  saveAll();
  fillForm();
  renderCriteria();
  renderThumbs();
  toast("Cleared");
}};
["claimModel","claimTask","claimTag","rater","claimNote"].forEach(id => {{
  const el = document.getElementById(id);
  el.addEventListener("change", () => {{
    flushForm();
    state.dirty = true;
    if (id === "claimTask") {{
      const e = entry(current().id);
      const rub = RUBRICS[e.task];
      document.getElementById("taskLabel").textContent = e.task || "—";
      document.getElementById("taskTitle").textContent = rub ? rub.label : (e.task || "未指定测试项");
      renderCriteria();
    }}
    renderThumbs();
    updateSavePill();
  }});
  el.addEventListener("input", () => {{ state.dirty = true; updateSavePill(); }});
}});
document.getElementById("btnZoom").onclick = () => cycleZoom(1);
document.getElementById("mainImg").onclick = () => {{
  if (state._didDrag) {{ state._didDrag = false; return; }}
  cycleZoom(1);
}};
(() => {{
  const vp = document.getElementById("viewport");
  vp.addEventListener("pointerdown", (e) => {{
    if (!state.zoomScale || e.button !== 0) return;
    state.drag = {{ x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop }};
    vp.classList.add("dragging");
    vp.setPointerCapture(e.pointerId);
  }});
  vp.addEventListener("pointermove", (e) => {{
    if (!state.drag) return;
    const dx = e.clientX - state.drag.x, dy = e.clientY - state.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) state._didDrag = true;
    vp.scrollLeft = state.drag.sl - dx;
    vp.scrollTop = state.drag.st - dy;
  }});
  const endDrag = (e) => {{
    if (!state.drag) return;
    state.drag = null;
    vp.classList.remove("dragging");
    try {{ vp.releasePointerCapture(e.pointerId); }} catch (_) {{}}
  }};
  vp.addEventListener("pointerup", endDrag);
  vp.addEventListener("pointercancel", endDrag);
  vp.addEventListener("wheel", (e) => {{
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    cycleZoom(e.deltaY > 0 ? -1 : 1);
  }}, {{ passive: false }});
}})();
document.addEventListener("keydown", (ev) => {{
  const tag = (ev.target && ev.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {{
    if (ev.key === "Escape") ev.target.blur();
    return;
  }}
  if (ev.key === "ArrowLeft") {{ ev.preventDefault(); go(state.index - 1); }}
  else if (ev.key === "ArrowRight") {{ ev.preventDefault(); go(state.index + 1); }}
  else if (ev.key === "s" || ev.key === "S") {{ ev.preventDefault(); saveCurrent(false); }}
  else if (ev.key === "z" || ev.key === "Z" || ev.key === "+") {{ ev.preventDefault(); cycleZoom(1); }}
  else if (ev.key === "-" || ev.key === "_") {{ ev.preventDefault(); cycleZoom(-1); }}
  else if (ev.key >= "0" && ev.key <= "9") {{
    const task = activeTask();
    const rub = RUBRICS[task];
    if (!rub) return;
    const idx = Math.min(state.focusCrit || 0, rub.items.length - 1);
    const score = ev.key === "0" ? 10 : parseInt(ev.key, 10);
    setScore(rub.items[idx][0], score, idx);
    state.focusCrit = Math.min(idx + 1, rub.items.length - 1);
    toast(rub.items[idx][1] + " → " + score);
  }}
}});

go(0);
</script>
</body>
</html>
"""


def main():
    entries = load_entries()
    raw_total = 0
    for e in entries:
        p = resolve_path(e)
        if p:
            raw_total += p.stat().st_size
        else:
            print("MISSING", e.get("file"), e.get("repo_path"))
    print(f"entries={len(entries)} raw_MB={raw_total/1024/1024:.2f}")

    packed, total, edge, q = pack_images(entries)
    # attach tag/run_id into packed from entries
    by_file = {e.get("file"): e for e in entries}
    for im in packed:
        src = by_file.get(im["file"], {})
        im["tag"] = src.get("tag") or ""
        im["run_id"] = src.get("run_id") or ""
        # rebuild src already in pack; also ensure id unique for grok vs notes
        if src.get("run_id") == "2026-08-09-grok-bench":
            im["id"] = "grok::" + im["file"]
        else:
            im["id"] = im["file"]

    print(f"packed n={len(packed)} total_MB={total/1024/1024:.2f} edge={edge} q={q}")

    meta = {
        "round": "2026-08-09+grok-bench",
        "source": ["round-2026-08-09.json", "round-2026-08-09-grok-bench.json"],
        "imageCount": len(packed),
        "rawBytes": raw_total,
        "packedBytes": total,
        "longEdge": edge,
        "jpegQuality": q,
        "compressed": raw_total > TARGET_MAX,
        "kind": "claim",
    }
    # rebuild images_js fields with tag/run_id/id
    html = build_html(packed, meta)
    OUT.write_text(html, encoding="utf-8")
    out_sz = OUT.stat().st_size
    print(f"wrote {OUT} html_MB={out_sz/1024/1024:.2f}")


if __name__ == "__main__":
    main()
