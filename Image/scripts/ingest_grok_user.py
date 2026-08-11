# -*- coding: utf-8 -*-
"""Ingest user Grok Image 2 results from 暂存 and build Grok-only scoring HTML."""
from __future__ import annotations

import base64
import io
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

staging = Path(r"F:\benchmark\暂存")
root = Path(r"F:\benchmark\Image")
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
model = "Grok Image 2"
slug = "grok-image-2"
run_id = "2026-08-09-grok-image2-user"

# (src_filename, task, friendly_name)
mapping = [
    ("grok-image-49b94752-7caa-4d19-acda-70e9ffa9de7b.jpg", "ArchPhotoreal", "A_ArchPhotoreal"),
    ("grok-image-e35d56c0-ba4c-435d-b695-74d9d6111eb4.jpg", "StandardBooks3D", "B_StandardBooks3D"),
    ("85fe73d2-6e08-4016-81c2-375edfa13411.jpg", "ConstructivistPoster", "C_ConstructivistPoster"),
    ("0dc641d4-4e94-4fdc-a072-efbf27548f93.jpg", "WindowGlitchPoster", "D_WindowGlitchPoster"),
    ("grok-image-e18fd33e-03c1-4d0c-a61b-1ac961a0df85.jpg", "GovTechPPT", "E_GovTechPPT"),
    ("ebfa1028-38fd-412e-9dbe-c873e0992244.jpg", "TextbookPeachBlossom", "F_TextbookPeachBlossom"),
]

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

named_dir = staging / "grok_image2_named"
named_dir.mkdir(exist_ok=True)
entries = []

for src_name, task, friendly in mapping:
    src = staging / src_name
    if not src.exists():
        raise SystemExit(f"missing {src}")

    named = named_dir / f"{friendly}_grok-image-2.jpg"
    flat = staging / f"{friendly}_grok-image-2.jpg"
    shutil.copy2(src, named)
    shutil.copy2(src, flat)

    dest_dir = root / task / slug
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "result.jpg"
    if dest.exists():
        bak = dest_dir / "result_imagine_prior.jpg"
        if not bak.exists():
            shutil.copy2(dest, bak)
    shutil.copy2(src, dest)
    shutil.copy2(src, dest_dir / f"source_{src.stem[:16]}.jpg")

    im = Image.open(dest)
    meta = {
        "source_file": f"{friendly}_grok-image-2.jpg",
        "original_filename": src_name,
        "model": model,
        "model_slug": slug,
        "task": task,
        "note": "User-tested real Grok Image 2; ingested from 暂存",
        "scores": {},
        "done": False,
        "updatedAt": now,
        "result": "result.jpg",
        "width": im.size[0],
        "height": im.size[1],
        "engine": "Grok Image 2",
        "run_id": run_id,
    }
    (dest_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    entries.append(
        {
            "file": meta["source_file"],
            "original_filename": src_name,
            "model": model,
            "model_slug": slug,
            "task": task,
            "tag": "grok-image-2-user",
            "note": meta["note"],
            "scores": {},
            "done": False,
            "updatedAt": now,
            "repo_path": str(dest.relative_to(root)).replace("\\", "/"),
            "engine": "Grok Image 2",
            "run_id": run_id,
            "w": im.size[0],
            "h": im.size[1],
            "abs_path": str(dest),
        }
    )
    print(f"OK {friendly:28} <- {src_name}")

run = {
    "version": 1,
    "round": run_id,
    "model": model,
    "engine": "Grok Image 2 (user)",
    "ingestedAt": now,
    "images": entries,
}
out_json = root / "scores" / "round-2026-08-09-grok-image2-user.json"
out_json.write_text(json.dumps(run, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", out_json)

# ---- embed + HTML (Swiss + claim, Grok only) ----
packed = []
for e in entries:
    path = Path(e["abs_path"])
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = min(1.0, 1600 / max(w, h))
    if scale < 1:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90, optimize=True)
    data = buf.getvalue()
    packed.append(
        {
            "id": e["file"],
            "file": e["file"],
            "task": e["task"],
            "model": e["model"],
            "note": e["note"],
            "tag": e["tag"],
            "run_id": e["run_id"],
            "ref_scores": {},
            "w": im.size[0],
            "h": im.size[1],
            "src": "data:image/jpeg;base64," + base64.b64encode(data).decode("ascii"),
        }
    )

images_js = json.dumps(packed, ensure_ascii=False, separators=(",", ":"))
rubrics_js = json.dumps(RUBRICS, ensure_ascii=False, separators=(",", ":"))
meta_js = json.dumps(
    {
        "round": run_id,
        "model": model,
        "imageCount": len(packed),
        "kind": "grok-image-2-only",
        "source": "round-2026-08-09-grok-image2-user.json",
    },
    ensure_ascii=False,
)

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Grok Image 2 · 评分认领</title>
<style>
:root {{
  --bg:#fff; --ink:#000; --muted:#5c5c5c; --line:#000; --line-soft:#d0d0d0;
  --accent:#e30613; --panel:#f4f4f4;
  --font:"Helvetica Neue",Helvetica,Arial,"PingFang SC","Microsoft YaHei",sans-serif;
}}
* {{ box-sizing:border-box; }}
html,body {{ height:100%; margin:0; }}
body {{
  font-family:var(--font); background:var(--bg); color:var(--ink);
  display:grid; grid-template-rows:56px 1fr 72px; min-height:100vh;
}}
button,input,select,textarea {{
  font-family:inherit; color:var(--ink); background:#fff;
  border:1px solid var(--ink); border-radius:0; padding:8px 12px;
}}
button {{
  cursor:pointer; text-transform:uppercase; letter-spacing:.06em;
  font-size:11px; font-weight:700;
}}
button:hover {{ background:var(--ink); color:#fff; }}
button.primary {{ background:var(--accent); color:#fff; border-color:var(--accent); }}
button.primary:hover {{ background:#b0000a; border-color:#b0000a; color:#fff; }}
button:disabled {{ opacity:.3; cursor:not-allowed; }}
header {{
  display:grid; grid-template-columns:240px 1fr auto; align-items:stretch;
  border-bottom:2px solid var(--ink);
}}
.brand {{
  display:flex; flex-direction:column; justify-content:center; padding:0 16px;
  border-right:2px solid var(--ink); background:var(--ink); color:#fff;
}}
.brand .t {{ font-size:15px; font-weight:700; letter-spacing:.06em; }}
.brand .s {{ margin-top:4px; font-size:10px; letter-spacing:.14em; text-transform:uppercase; opacity:.75; }}
.hdr-mid {{ display:flex; align-items:center; gap:16px; padding:0 20px; min-width:0; }}
.idx-big {{ font-size:28px; font-weight:700; letter-spacing:-.02em; white-space:nowrap; }}
.idx-big span {{ color:var(--muted); font-weight:400; }}
.file-meta .task {{ font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }}
.file-meta .name {{ font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
.hdr-actions {{ display:flex; align-items:stretch; }}
.hdr-actions button {{ border:none; border-left:1px solid var(--ink); min-width:88px; }}
main {{ display:grid; grid-template-columns:minmax(0,1fr) 360px; min-height:0; }}
@media (max-width:960px) {{ main {{ grid-template-columns:1fr; grid-template-rows:48vh 1fr; }} }}
.stage {{
  position:relative; min-width:0; min-height:0; border-right:2px solid var(--ink);
  background:
    linear-gradient(90deg,transparent 47px,rgba(0,0,0,.04) 47px,rgba(0,0,0,.04) 48px,transparent 48px),
    linear-gradient(transparent 47px,rgba(0,0,0,.04) 47px,rgba(0,0,0,.04) 48px,transparent 48px), #fafafa;
  background-size:48px 48px;
}}
.viewport {{
  min-height:0; height:100%; display:grid; place-items:center;
  padding:24px 48px; overflow:auto; overscroll-behavior:contain;
}}
.viewport.is-zoomed {{ place-items:start center; cursor:grab; }}
.viewport.is-zoomed.dragging {{ cursor:grabbing; }}
.viewport img {{
  max-width:100%; max-height:100%; width:auto; height:auto;
  object-fit:contain; background:#fff;
  border:1px solid var(--ink); box-shadow:12px 12px 0 rgba(0,0,0,.08);
  cursor:zoom-in; user-select:none; -webkit-user-drag:none;
}}
.viewport.is-zoomed img {{
  max-width:none !important; max-height:none !important;
  object-fit:unset; cursor:inherit;
}}
.nav-abs {{
  position:absolute; top:50%; transform:translateY(-50%); width:44px; height:88px; z-index:2;
  border:1px solid var(--ink); background:#fff; font-size:22px; font-weight:700;
}}
.nav-prev {{ left:12px; }} .nav-next {{ right:12px; }}
aside {{ display:flex; flex-direction:column; min-height:0; }}
aside .scroll {{ flex:1; overflow:auto; }}
.block {{ border-bottom:1px solid var(--ink); padding:16px 18px; }}
.block h2 {{ margin:0 0 12px; font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; }}
.task-title {{ font-size:20px; font-weight:700; margin:0 0 6px; line-height:1.15; }}
.hint {{ font-size:11px; color:var(--muted); line-height:1.45; margin:0 0 10px; }}
label.field {{ display:block; margin-bottom:10px; }}
label.field > span {{
  display:block; font-size:10px; font-weight:700; letter-spacing:.12em;
  text-transform:uppercase; margin-bottom:4px; color:var(--muted);
}}
label.field input, label.field select, label.field textarea {{ width:100%; font-size:13px; }}
label.field textarea {{ min-height:56px; resize:vertical; }}
.row2 {{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }}
.score-head {{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px; }}
.score-total {{ font-size:22px; font-weight:700; }}
.score-total small {{ font-size:11px; font-weight:400; color:var(--muted); }}
.crit {{ border-top:1px solid var(--line-soft); padding:12px 0; }}
.crit:first-child {{ border-top:none; padding-top:0; }}
.crit-top {{ display:flex; justify-content:space-between; gap:8px; margin-bottom:4px; }}
.crit-name {{ font-size:13px; font-weight:700; }}
.crit-score {{ font-size:13px; font-weight:700; color:var(--accent); min-width:2ch; text-align:right; }}
.crit-desc {{ font-size:11px; color:var(--muted); margin-bottom:8px; line-height:1.4; }}
.nums {{ display:flex; flex-wrap:wrap; gap:4px; }}
.nums button {{ width:28px; height:28px; padding:0; font-size:11px; font-weight:700; border-color:var(--line-soft); }}
.nums button.on {{ background:var(--ink); color:#fff; border-color:var(--ink); }}
.nums button.zero {{ width:auto; padding:0 8px; }}
.actions {{ display:grid; grid-template-columns:1fr 1fr; }}
.actions button {{ border:none; border-right:1px solid var(--ink); border-top:1px solid var(--ink); min-height:48px; }}
.actions button:nth-child(2n) {{ border-right:none; }}
.foot-note {{ padding:12px 18px 18px; font-size:10px; color:var(--muted); line-height:1.5; }}
footer {{
  border-top:2px solid var(--ink); display:grid; grid-template-columns:160px 1fr 200px; align-items:stretch;
}}
.foot-label {{
  display:flex; align-items:center; padding:0 16px; font-size:10px; font-weight:700;
  letter-spacing:.16em; text-transform:uppercase; border-right:1px solid var(--ink); background:var(--panel);
}}
.thumbs {{ display:flex; overflow-x:auto; }}
.thumbs button {{
  border:none; border-right:1px solid var(--line-soft); width:64px; padding:0; position:relative; background:#fff;
}}
.thumbs button img {{ width:100%; height:100%; object-fit:cover; opacity:.55; filter:grayscale(1); display:block; }}
.thumbs button.active img {{ opacity:1; filter:none; }}
.thumbs button.done::after {{ content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:var(--accent); }}
.foot-status {{
  display:flex; align-items:center; justify-content:flex-end; gap:12px; padding:0 16px;
  border-left:1px solid var(--ink); font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
}}
.pill {{ display:inline-block; padding:4px 8px; border:1px solid var(--ink); }}
.pill.ok {{ background:var(--ink); color:#fff; }}
.toast {{
  position:fixed; left:50%; bottom:88px; transform:translateX(-50%) translateY(8px);
  background:var(--ink); color:#fff; padding:10px 16px; font-size:12px; font-weight:700;
  letter-spacing:.08em; text-transform:uppercase; opacity:0; pointer-events:none; transition:.18s; z-index:50;
}}
.toast.show {{ opacity:1; transform:translateX(-50%) translateY(0); }}
kbd {{ font-size:10px; border:1px solid var(--line-soft); padding:0 4px; }}
</style>
</head>
<body>
<header>
  <div class="brand">
    <div class="t">Grok Image 2</div>
    <div class="s">Only · Score & Claim</div>
  </div>
  <div class="hdr-mid">
    <div class="idx-big" id="counter">01 <span>/ 06</span></div>
    <div class="file-meta">
      <div class="task" id="taskLabel">—</div>
      <div class="name" id="fileName">—</div>
    </div>
  </div>
  <div class="hdr-actions">
    <button type="button" id="btnPrev">Prev</button>
    <button type="button" id="btnNext">Next</button>
    <button type="button" id="btnUnscored">Next Open</button>
    <button type="button" id="btnZoom" title="点击图片或按 Z 切换缩放">Zoom Fit</button>
    <button type="button" id="btnExport">Export</button>
    <button type="button" class="primary" id="btnSave">Save</button>
  </div>
</header>
<main>
  <section class="stage">
    <button type="button" class="nav-abs nav-prev" id="fabPrev">←</button>
    <button type="button" class="nav-abs nav-next" id="fabNext">→</button>
    <div class="viewport" id="viewport"><img id="mainImg" alt=""/></div>
  </section>
  <aside>
    <div class="scroll">
      <div class="block">
        <h2>Claim · 认领</h2>
        <p class="task-title" id="taskTitle">—</p>
        <p class="hint">仅含本轮真实 Grok Image 2 成片（6 题）。模型默认已填，可改备注后打分。</p>
        <label class="field"><span>模型</span><input type="text" id="claimModel"/></label>
        <label class="field"><span>测试项</span>
          <select id="claimTask">
            <option value="ArchPhotoreal">ArchPhotoreal · 建筑真实化 (10)</option>
            <option value="StandardBooks3D">StandardBooks3D · 国标图书 (5)</option>
            <option value="ConstructivistPoster">ConstructivistPoster · 构成主义 (5)</option>
            <option value="WindowGlitchPoster">WindowGlitchPoster · 窗口故障 (5)</option>
            <option value="GovTechPPT">GovTechPPT · 政务 PPT (5)</option>
            <option value="TextbookPeachBlossom">TextbookPeachBlossom · 桃花源记 (5)</option>
          </select>
        </label>
        <div class="row2">
          <label class="field"><span>标签</span><input type="text" id="claimTag"/></label>
          <label class="field"><span>评分人</span><input type="text" id="rater"/></label>
        </div>
        <label class="field"><span>备注</span><textarea id="claimNote"></textarea></label>
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
      <div class="foot-note">KEYS · <kbd>←</kbd><kbd>→</kbd> · <kbd>S</kbd> save · <kbd>1</kbd>–<kbd>0</kbd> score<br/>Export JSON to re-ingest</div>
    </div>
  </aside>
</main>
<footer>
  <div class="foot-label">Index</div>
  <div class="thumbs" id="thumbs"></div>
  <div class="foot-status"><span class="pill" id="savePill">Local</span><span id="progressText">0 / 6</span></div>
</footer>
<div class="toast" id="toast"></div>
<script>
const IMAGES = {images_js};
const RUBRICS = {rubrics_js};
const META = {meta_js};
const STORAGE_KEY = "grok_image2_only_score_v1";
const ZOOM_STEPS = [0, 1, 1.5, 2, 3]; // 0=适应视口，其余=相对原图像素倍率
const state = {{ index:0, zoomScale:0, data:loadAll(), dirty:false, focusCrit:0, drag:null }};
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
function loadAll() {{ try {{ const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):{{}}; }} catch {{ return {{}}; }} }}
function saveAll() {{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); state.dirty=false; updateSavePill(); }}
function seed(im) {{
  if (!state.data[im.id]) {{
    state.data[im.id] = {{
      model: im.model||"Grok Image 2", task: im.task||"", tag: im.tag||"",
      rater:"", note: im.note||"", scores:{{}}, done:false, updatedAt:null
    }};
  }}
  return state.data[im.id];
}}
function entry(id) {{ return seed(IMAGES.find(x=>x.id===id)||{{id}}); }}
function current() {{ return IMAGES[state.index]; }}
function flush() {{
  const e=entry(current().id);
  e.model=document.getElementById("claimModel").value.trim();
  e.task=document.getElementById("claimTask").value;
  e.tag=document.getElementById("claimTag").value.trim();
  e.rater=document.getElementById("rater").value.trim();
  e.note=document.getElementById("claimNote").value.trim();
}}
function fill() {{
  const e=entry(current().id);
  document.getElementById("claimModel").value=e.model||"";
  document.getElementById("claimTask").value=e.task||"";
  document.getElementById("claimTag").value=e.tag||"";
  document.getElementById("rater").value=e.rater||"";
  document.getElementById("claimNote").value=e.note||"";
}}
function toast(m) {{
  const el=document.getElementById("toast"); el.textContent=m; el.classList.add("show");
  clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove("show"),1400);
}}
function pad(n) {{ return String(n).padStart(2,"0"); }}
function isComplete(e,task) {{
  if (!e) return false; if (e.done) return true;
  const rub=RUBRICS[task]; if (!rub) return false;
  return rub.items.every(it=>typeof e.scores[it[0]]==="number");
}}
function updateSavePill() {{
  const doneN=IMAGES.filter(im=>isComplete(entry(im.id), entry(im.id).task||im.task)).length;
  document.getElementById("progressText").textContent=doneN+" / "+IMAGES.length;
  const pill=document.getElementById("savePill");
  if (state.dirty) {{ pill.textContent="Unsaved"; pill.classList.remove("ok"); }}
  else {{ pill.textContent=doneN?"Saved "+doneN:"Local"; pill.classList.toggle("ok",!!doneN); }}
}}
function renderThumbs() {{
  const strip=document.getElementById("thumbs"); strip.innerHTML="";
  IMAGES.forEach((im,i)=>{{
    const b=document.createElement("button"); b.type="button";
    if (i===state.index) b.classList.add("active");
    const e=entry(im.id);
    if (isComplete(e,e.task||im.task)) b.classList.add("done");
    const img=document.createElement("img"); img.src=im.src; img.alt=im.file;
    b.appendChild(img); b.onclick=()=>go(i); strip.appendChild(b);
  }});
  const a=strip.querySelector("button.active"); if (a) a.scrollIntoView({{inline:"center",block:"nearest",behavior:"smooth"}});
}}
function renderCriteria() {{
  const im=current(), e=entry(im.id), task=e.task||im.task, rub=RUBRICS[task], box=document.getElementById("criteria");
  box.innerHTML="";
  if (!rub) {{ box.innerHTML='<p class="hint">No rubric</p>'; return; }}
  rub.items.forEach((it,idx)=>{{
    const key=it[0], name=it[1], desc=it[2], val=e.scores[key];
    const row=document.createElement("div"); row.className="crit";
    const top=document.createElement("div"); top.className="crit-top";
    const n=document.createElement("div"); n.className="crit-name"; n.textContent=(idx+1)+". "+name;
    const s=document.createElement("div"); s.className="crit-score"; s.textContent=typeof val==="number"?String(val):"—";
    top.appendChild(n); top.appendChild(s);
    const d=document.createElement("div"); d.className="crit-desc"; d.textContent=desc;
    const nums=document.createElement("div"); nums.className="nums";
    row.appendChild(top); row.appendChild(d); row.appendChild(nums);
    const z=document.createElement("button"); z.type="button"; z.className="zero"+(val===0?" on":""); z.textContent="0";
    z.onclick=()=>setScore(key,0,idx); nums.appendChild(z);
    for (let i=1;i<=10;i++) {{
      const b=document.createElement("button"); b.type="button"; b.textContent=String(i);
      if (val===i) b.classList.add("on");
      b.onclick=()=>setScore(key,i,idx); nums.appendChild(b);
    }}
    box.appendChild(row);
  }});
  const vals=rub.items.map(it=>e.scores[it[0]]).filter(v=>typeof v==="number");
  const sum=vals.reduce((a,b)=>a+b,0), max=rub.items.length*10;
  const avg=vals.length?(sum/vals.length).toFixed(1):"—";
  document.getElementById("scoreTotal").innerHTML=(vals.length?sum:"—")+" <small>/ "+max+" · AVG "+avg+" · "+vals.length+"/"+rub.items.length+"</small>";
}}
function setScore(key,value,idx) {{
  flush(); const e=entry(current().id); e.scores[key]=value; state.focusCrit=idx; state.dirty=true;
  renderCriteria(); renderThumbs(); updateSavePill();
}}
function go(i) {{
  if (i<0||i>=IMAGES.length) return;
  if (document.getElementById("claimModel")) flush();
  state.index=i; state.zoomScale=0; state.drag=null;
  const im=current(); seed(im);
  const main=document.getElementById("mainImg");
  main.onload = () => applyZoom();
  main.src=im.src;
  applyZoom();
  document.getElementById("counter").innerHTML=pad(i+1)+" <span>/ "+pad(IMAGES.length)+"</span>";
  const e=entry(im.id), task=e.task||im.task, rub=RUBRICS[task];
  document.getElementById("taskLabel").textContent=task||"—";
  document.getElementById("taskTitle").textContent=rub?rub.label:(task||"—");
  document.getElementById("fileName").textContent=im.file+" · "+im.w+"×"+im.h;
  fill();
  document.getElementById("btnPrev").disabled=i===0;
  document.getElementById("btnNext").disabled=i===IMAGES.length-1;
  document.getElementById("fabPrev").disabled=i===0;
  document.getElementById("fabNext").disabled=i===IMAGES.length-1;
  renderCriteria(); renderThumbs(); updateSavePill();
}}
function saveCurrent(markDone) {{
  flush(); const e=entry(current().id); if (markDone) e.done=true;
  e.updatedAt=new Date().toISOString(); saveAll(); renderThumbs(); toast(markDone?"Saved · Done":"Saved");
}}
function nextUnscored() {{
  flush();
  for (let step=1; step<=IMAGES.length; step++) {{
    const i=(state.index+step)%IMAGES.length; const e=entry(IMAGES[i].id);
    if (!isComplete(e,e.task||IMAGES[i].task)) {{ go(i); return; }}
  }}
  toast("All complete");
}}
function exportJson() {{
  flush();
  const payload={{ version:1, kind:"grok-image-2-only", meta:META, exportedAt:new Date().toISOString(),
    images:IMAGES.map(im=>({{ file:im.file, ...(state.data[im.id]||{{}}) }})) }};
  const blob=new Blob([JSON.stringify(payload,null,2)],{{type:"application/json"}});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="grok_image2_scores_"+new Date().toISOString().slice(0,10)+".json"; a.click();
  URL.revokeObjectURL(a.href); toast("Exported");
}}
document.getElementById("btnPrev").onclick=()=>go(state.index-1);
document.getElementById("btnNext").onclick=()=>go(state.index+1);
document.getElementById("fabPrev").onclick=()=>go(state.index-1);
document.getElementById("fabNext").onclick=()=>go(state.index+1);
document.getElementById("btnUnscored").onclick=nextUnscored;
document.getElementById("btnSave").onclick=()=>saveCurrent(false);
document.getElementById("btnDone").onclick=()=>saveCurrent(true);
document.getElementById("btnExport").onclick=exportJson;
document.getElementById("btnImport").onclick=()=>document.getElementById("importFile").click();
document.getElementById("importFile").onchange=(ev)=>{{
  const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{{ try {{
    const obj=JSON.parse(r.result); const list=obj.images||obj;
    list.forEach(row=>{{ const id=row.file||row.id; if(!id) return;
      state.data[id]={{ model:row.model||"", task:row.task||"", tag:row.tag||"", rater:row.rater||"",
        note:row.note||"", scores:row.scores||{{}}, done:!!row.done, updatedAt:row.updatedAt||new Date().toISOString() }};
    }});
    saveAll(); fill(); renderCriteria(); renderThumbs(); toast("Imported");
  }} catch {{ toast("Import failed"); }} }};
  r.readAsText(f); ev.target.value="";
}};
document.getElementById("btnReset").onclick=()=>{{ flush(); const e=entry(current().id); e.scores={{}}; e.done=false; state.dirty=true; renderCriteria(); renderThumbs(); updateSavePill(); }};
document.getElementById("btnClear").onclick=()=>{{ if(!confirm("清空本机 Grok 评分？")) return; state.data={{}}; saveAll(); fill(); renderCriteria(); renderThumbs(); toast("Cleared"); }};
["claimModel","claimTask","claimTag","rater","claimNote"].forEach(id=>{{
  const el=document.getElementById(id);
  el.addEventListener("change",()=>{{ flush(); state.dirty=true;
    if(id==="claimTask"){{ const e=entry(current().id); const rub=RUBRICS[e.task];
      document.getElementById("taskLabel").textContent=e.task||"—";
      document.getElementById("taskTitle").textContent=rub?rub.label:e.task; renderCriteria(); }}
    renderThumbs(); updateSavePill(); }});
  el.addEventListener("input",()=>{{ state.dirty=true; updateSavePill(); }});
}});
document.getElementById("btnZoom").onclick=()=>cycleZoom(1);
document.getElementById("mainImg").onclick=(ev)=>{{
  if (state._didDrag) {{ state._didDrag=false; return; }}
  cycleZoom(1);
}};
// 拖拽平移（放大后）
(() => {{
  const vp = document.getElementById("viewport");
  vp.addEventListener("pointerdown", (e) => {{
    if (!state.zoomScale) return;
    if (e.button !== 0) return;
    state.drag = {{ x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop }};
    vp.classList.add("dragging");
    vp.setPointerCapture(e.pointerId);
  }});
  vp.addEventListener("pointermove", (e) => {{
    if (!state.drag) return;
    const dx = e.clientX - state.drag.x;
    const dy = e.clientY - state.drag.y;
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
document.addEventListener("keydown",(ev)=>{{
  const tag=(ev.target&&ev.target.tagName)||"";
  if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT") {{ if(ev.key==="Escape") ev.target.blur(); return; }}
  if(ev.key==="ArrowLeft"){{ ev.preventDefault(); go(state.index-1); }}
  else if(ev.key==="ArrowRight"){{ ev.preventDefault(); go(state.index+1); }}
  else if(ev.key==="s"||ev.key==="S"){{ ev.preventDefault(); saveCurrent(false); }}
  else if(ev.key==="z"||ev.key==="Z"||ev.key==="+"){{ ev.preventDefault(); cycleZoom(1); }}
  else if(ev.key==="-"||ev.key==="_"){{ ev.preventDefault(); cycleZoom(-1); }}
  else if(ev.key==="0" && (ev.ctrlKey||ev.metaKey)){{ ev.preventDefault(); state.zoomScale=0; applyZoom(); }}
  else if(ev.key>="0"&&ev.key<="9" && !ev.ctrlKey && !ev.metaKey){{
    const e=entry(current().id); const rub=RUBRICS[e.task||current().task]; if(!rub) return;
    const idx=Math.min(state.focusCrit||0, rub.items.length-1);
    const score=ev.key==="0"?10:parseInt(ev.key,10);
    setScore(rub.items[idx][0], score, idx);
    state.focusCrit=Math.min(idx+1, rub.items.length-1);
    toast(rub.items[idx][1]+" → "+score);
  }}
}});
go(0);
</script>
</body>
</html>
"""

out_html = root / "评分_GrokImage2.html"
out_html.write_text(html, encoding="utf-8")
print("wrote", out_html, "MB", out_html.stat().st_size / 1024 / 1024)

# summary snippet
sum_path = root / "scores" / "SUMMARY-2026-08-09.md"
extra = f"""

## Grok Image 2 用户真测入库（{run_id}）

| 测试项 | 命名 | 原文件 | 产物 |
| :--- | :--- | :--- | :--- |
"""
for e in entries:
    extra += f"| {e['task']} | `{e['file']}` | `{e['original_filename'] if 'original_filename' in e else e.get('original_filename','')}` | `{e['repo_path']}` |\n"

# fix original in extra - entries don't have original in loop for summary - add from mapping
extra = f"""

## Grok Image 2 用户真测入库（{run_id}）

| 题 | 命名 | 原文件名 | 入库路径 |
| :---: | :--- | :--- | :--- |
"""
for src_name, task, friendly in mapping:
    extra += f"| {friendly[0]} | `{friendly}_grok-image-2.jpg` | `{src_name}` | `{task}/grok-image-2/result.jpg` |\n"
extra += f"""
- 数据：[`round-2026-08-09-grok-image2-user.json`](./round-2026-08-09-grok-image2-user.json)
- 专用评分页：[`评分_GrokImage2.html`](../评分_GrokImage2.html)（仅 6 张 Grok Image 2）
- 暂存命名副本：`暂存/grok_image2_named/` 与 `暂存/A_*_grok-image-2.jpg` …
"""
if sum_path.exists():
    t = sum_path.read_text(encoding="utf-8")
    if run_id not in t:
        sum_path.write_text(t.rstrip() + extra, encoding="utf-8")

readme = root / "README.md"
rt = readme.read_text(encoding="utf-8")
if "评分_GrokImage2.html" not in rt:
    rt = rt.replace(
        "| [`评分_认领.html`](./评分_认领.html) | **有** | 可改模型名/测试项/备注；预填入库参考分与 Grok 跑次 |",
        "| [`评分_认领.html`](./评分_认领.html) | **有** | 可改模型名/测试项/备注；预填入库参考分与 Grok 跑次 |\n| [`评分_GrokImage2.html`](./评分_GrokImage2.html) | **有** | **仅真实 Grok Image 2 用户测 6 题** |",
    )
    readme.write_text(rt, encoding="utf-8")

print("done")
