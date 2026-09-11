# -*- coding: utf-8 -*-
"""Sandbox shared library: paths, discovery, integrity helpers."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

# sandbox/scripts/sandbox_lib.py → repo root is parents[2]
ROOT = Path(__file__).resolve().parents[2]
SANDBOX = ROOT / "sandbox"
RUNS = SANDBOX / "runs"

LEVEL_DIRS = ("L1_Basic", "L2_Intermediate", "L3_Advanced", "L4_Expert", "Image")

RUN_META = "meta.json"
TASK_MD = "TASK.md"
PROMPT_MD = "PROJECT_PROMPT.md"
REVIEW_MD = "REVIEW.md"
MANIFEST_NAME = "manifest.json"

# Patterns that would indicate the runner (or an accidental copy) leaked neighbors.
FORBIDDEN_DIR_NAMES = {
    ".git", "node_modules", "暂存", "_archives", "FARM100", "Vision",
    "DOMAIN_INDEX.zh.md", "DOMAIN_INDEX.en.md", "session.v2.jsonl",
}

DELIVERABLE_SKIP = {
    TASK_MD, PROMPT_MD, RUN_META, MANIFEST_NAME, REVIEW_MD,
    "log.md", "result.json", "PLAN.md",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")


def ts_slug() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def dump_json(p: Path, data) -> None:
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_meta(run_dir: Path) -> dict:
    p = run_dir / RUN_META
    if not p.is_file():
        raise FileNotFoundError(f"missing {RUN_META} in {run_dir}")
    return load_json(p)


def resolve_project_dir(project: str) -> Path:
    """Accept 'USP', 'L3_Advanced/USP', or an absolute path to a project root."""
    p = Path(project)
    if p.is_dir() and (p / PROMPT_MD).is_file():
        return p.resolve()
    cand = ROOT / project
    if cand.is_dir() and (cand / PROMPT_MD).is_file():
        return cand.resolve()
    # bare name search (unique match required)
    hits = []
    for lv in LEVEL_DIRS:
        d = ROOT / lv / project
        if d.is_dir() and (d / PROMPT_MD).is_file():
            hits.append(d)
    if len(hits) == 1:
        return hits[0].resolve()
    if not hits:
        raise FileNotFoundError(f"project not found: {project!r} (need {PROMPT_MD})")
    names = ", ".join(str(h.relative_to(ROOT)) for h in hits)
    raise RuntimeError(f"ambiguous project name {project!r}: {names}")


def project_rel(project_dir: Path) -> str:
    return project_dir.relative_to(ROOT).as_posix()


def discover_projects() -> list[dict]:
    """Enumerate all formal projects that have PROJECT_PROMPT.md."""
    out = []
    for lv in LEVEL_DIRS:
        base = ROOT / lv
        if not base.is_dir():
            continue
        if lv == "Image":
            # Image items are also one level down
            children = [d for d in base.iterdir() if d.is_dir()]
        else:
            children = [d for d in base.iterdir() if d.is_dir()]
        for d in sorted(children):
            prompt = d / PROMPT_MD
            if prompt.is_file():
                out.append({
                    "level": lv,
                    "name": d.name,
                    "rel": project_rel(d),
                    "prompt_sha256": sha256_file(prompt),
                })
    return out


def extract_requirements(prompt_text: str) -> dict:
    """Heuristically pull deliverable/constraint lines from PROJECT_PROMPT."""
    lines = [ln.strip() for ln in prompt_text.splitlines() if ln.strip()]
    section = None
    buckets = {"交付": [], "限制": [], "禁用": [], "要求": []}
    heading_re = re.compile(r"^#{1,4}\s*(.+)$")
    for ln in lines:
        m = heading_re.match(ln)
        if m:
            title = m.group(1)
            if any(k in title for k in ("交付", "限制", "约束")):
                # "交付与限制要求" groups both; file under 交付 once
                section = "交付" if "交付" in title else "限制"
            elif any(k in title for k in ("需求", "要求", "实现")):
                section = "要求"
            else:
                section = None
            continue
        if section and ln.startswith(("-", "•", "*")):
            buckets[section].append(ln.lstrip("-•* ").strip())
    # global forbidden patterns
    blob = prompt_text
    forbidden = []
    if re.search(r"TODO|未完成占位|占位符", blob):
        forbidden.append("不得包含 TODO 或未完成占位符（若题面明确要求）")
    if re.search(r"单\s*HTML|single\s*HTML|单文件", blob, re.I):
        forbidden.append("优先交付单文件 HTML（若题面明确要求）")
    if re.search(r"不使用外部\s*3D|不使用外部模型|无外部资源|纯代码生成", blob):
        forbidden.append("不依赖外部 3D/二进制资产（若题面明确要求）")
    return {
        "delivery": buckets["交付"],
        "limits": buckets["限制"],
        "requirements": buckets["要求"],
        "forbidden": forbidden,
    }


def discipline_block() -> str:
    """Numbered discipline list only (no heading)."""
    return """1. 你只允许读取本 run 目录内的文件。禁止读取仓库其他任何路径（L1–L4 / Image / Vision / 暂存 / 模型输出目录 / DOMAIN_INDEX* / .git 等）。
2. 禁止读取其他模型的 answer / log / result / 评分报告；禁止搜索、grep、glob 仓库根目录下的历史答案。
3. 禁止外部联网拉取参考实现；禁止调用外部模型代写。允许 CDN 引入题面允许的库。
4. 交付物全部写在本 run 目录。除规定的交付文件与可选 `log.md`、`result.json` 外，不得写入其他路径。
5. 在 `result.json` 的 `integrity` 字段如实自报：
   - `read_prompt_only`: true（是否只依据 TASK.md / PROJECT_PROMPT.md 作答）
   - `read_other_model_outputs`: false（是否读到其他模型输出）
   - `external_help`: false（是否使用外部代写/外部求解服务）
6. `PROJECT_PROMPT.md` 为题面原文，禁止修改。"""


def list_deliverables(run_dir: Path) -> list[str]:
    """Candidate deliverable files in a run dir (exclude protocol files)."""
    protocol = DELIVERABLE_SKIP | {"MIGRATION.md"}
    out: list[str] = []
    for p in sorted(run_dir.iterdir()):
        if not p.is_file() or p.name.startswith("."):
            continue
        if p.name in protocol:
            continue
        name_l = p.name.lower()
        if name_l.endswith((
            ".html", ".htm", ".js", ".mjs", ".css", ".user.js",
            ".py", ".ts", ".tsx", ".jsx", ".svg", ".vue",
        )):
            out.append(p.name)
            continue
        if name_l in {"result.json", "log.md"}:
            out.append(p.name)
            continue
        if name_l.startswith("answer") and p.suffix.lower() in {".md", ".json", ".txt", ".svg"}:
            out.append(p.name)
            continue
    return out


def scan_forbidden_imports(text: str) -> list[str]:
    """Static signals of leakage or placeholders inside HTML/JS deliverables."""
    problems = []
    if re.search(r"TODO(?!\w)|FIXME|XXX\b|未实现|占位符", text, re.I):
        problems.append("placeholder_tokens")
    # relative escapes
    if re.search(r"(\.\./)+|file:///", text):
        # may be legit in comments; flag lightly
        problems.append("possible_path_escape")
    return problems


def primary_html(run_dir: Path, names: list[str]) -> Path | None:
    """Pick the main HTML deliverable."""
    htmls = [n for n in names if n.lower().endswith((".html", ".htm"))]
    if not htmls:
        return None
    for pref in ("answer.html", "index.html", "demo.html", "main.html"):
        if pref in htmls:
            return run_dir / pref
    # largest html as primary
    return run_dir / max(htmls, key=lambda n: (run_dir / n).stat().st_size)


def primary_svg(run_dir: Path, names: list[str]) -> Path | None:
    svgs = [n for n in names if n.lower().endswith(".svg")]
    if not svgs:
        return None
    for pref in ("answer.svg", "index.svg", "main.svg"):
        if pref in svgs:
            return run_dir / pref
    return run_dir / max(svgs, key=lambda n: (run_dir / n).stat().st_size)
