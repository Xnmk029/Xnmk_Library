# -*- coding: utf-8 -*-
"""Sandbox shared library: paths, discovery, harness-side observation.

Protocol 2.0 ("bare"): the tested model's workspace is an EMPTY directory
outside the repo containing only the verbatim task prompt. There is no
discipline text, no contract, no result.json — isolation and integrity are
enforced by the environment and observed by the harness, never instructed.

Layout:
    <RUNS_ROOT>/<model>/<run_id>/      workdir: prompt + model output only
        PROMPT.md                      verbatim copy of PROJECT_PROMPT.md
    sandbox/runs/<model>/<run_id>/     harness dir (never shown to model)
        meta.json                      run metadata
        snapshot.json                  workdir file hashes at prepare time

RUNS_ROOT defaults to <repo_parent>/bench-runs (F:\\bench-runs here);
override with env SANDBOX_RUNS_ROOT.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

# sandbox/scripts/sandbox_lib.py → repo root is parents[2]
ROOT = Path(__file__).resolve().parents[2]
SANDBOX = ROOT / "sandbox"
RUNS = SANDBOX / "runs"                      # harness-side bookkeeping only

# Tested-model workspaces live OUTSIDE the repo: nothing else to read there.
RUNS_ROOT = Path(os.environ.get("SANDBOX_RUNS_ROOT", str(ROOT.parent / "bench-runs")))

LEVEL_DIRS = ("L1_Basic", "L2_Intermediate", "L3_Advanced", "L4_Expert", "Image", "Vision/PairedVision/v1/public", "NativeWorkflowBench")

RUN_META = "meta.json"
SNAPSHOT = "snapshot.json"
PROMPT_FILE = "PROMPT.md"                    # name inside the workdir
PROMPT_MD = "PROJECT_PROMPT.md"              # name in the formal tree
REVIEW_MD = "REVIEW.md"
PROTOCOL_VERSION = "2.0"

# Names that must never appear inside a workdir — their presence means the
# tested model reached outside the isolated workspace and copied things in.
FORBIDDEN_DIR_NAMES = {
    ".git", "node_modules", "暂存", "_archives", "FARM100", "Vision",
    "DOMAIN_INDEX.zh.md", "DOMAIN_INDEX.en.md", "session.v2.jsonl",
}

# Well-known agent/IDE tool state — pollution signal, WARN not FAIL.
AGENT_STATE_NAMES = {
    ".arts", ".codeartsdoer", ".cursor", ".claude", ".devin", ".windsurf",
    ".trae", ".codebase", ".vscode", ".idea",
}

DELIVERABLE_SKIP = {PROMPT_FILE, PROMPT_MD, RUN_META, SNAPSHOT, REVIEW_MD}

# Extensions treated as candidate deliverables found in a workdir.
DELIVERABLE_EXTS = (
    ".html", ".htm", ".js", ".mjs", ".css", ".user.js",
    ".py", ".ts", ".tsx", ".jsx", ".svg", ".vue",
    ".md", ".markdown", ".txt", ".csv", ".json", ".xml", ".yaml", ".yml",
    ".go", ".rs", ".java", ".c", ".cc", ".cpp", ".h", ".hpp",
    ".sh", ".ps1", ".rb", ".php", ".swift", ".kt", ".kts", ".lua",
    ".sql", ".glsl", ".ipynb", ".toml",
    ".godot", ".gd", ".gdshader", ".gdshaderinc", ".tscn", ".scn", ".tres", ".res", ".cfg", ".uid",
)

# Transcript tokens that prove the tested session saw the repo. Any hit in a
# pasted session transcript → H3 FAIL.
LEAK_TOKENS = (
    "DOMAIN_INDEX", "session.v2.jsonl", "review-lab", "reference-assets",
    "sandbox/runs", "sandbox\\runs", "暂存", "_archives", "FARM100",
    "Vision/", "Vision\\", ".git/",
)
LEAK_LEVELS = tuple(lv + "/" for lv in LEVEL_DIRS) + tuple(
    lv + "\\" for lv in LEVEL_DIRS
)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")


def ts_slug() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def dump_json(p: Path, data) -> None:
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_meta(harness_dir: Path) -> dict:
    p = harness_dir / RUN_META
    if not p.is_file():
        raise FileNotFoundError(f"missing {RUN_META} in {harness_dir}")
    return load_json(p)


def workdir_of(meta: dict) -> Path:
    """The tested-model workspace for a run (outside the repo)."""
    return Path(meta["workdir"])


def new_run_id(model: str, project_name: str) -> str:
    """Unique run id under both the harness tree and the workdir tree."""
    base_id = f"{ts_slug()}-{project_name}"
    run_id, n = base_id, 1
    while (RUNS / model / run_id).exists() or (RUNS_ROOT / model / run_id).exists():
        n += 1
        run_id = f"{base_id}-{n}"
    return run_id


def resolve_project_dir(project: str) -> Path:
    """Accept 'USP', 'L3_Advanced/USP', or a path to a project root."""
    cand = ROOT / project
    if cand.is_dir() and (cand / PROMPT_MD).is_file():
        return cand.resolve()
    hits = []
    for lv in LEVEL_DIRS:
        d = ROOT / lv / project
        if d.is_dir() and (d / PROMPT_MD).is_file():
            hits.append(d)
    if len(hits) == 1:
        return hits[0].resolve()
    if len(hits) > 1:
        names = ", ".join(str(h.relative_to(ROOT)) for h in hits)
        raise RuntimeError(f"ambiguous project name {project!r}: {names}")
    p = Path(project)
    if p.is_dir() and (p / PROMPT_MD).is_file():
        p = p.resolve()
        if not p.is_relative_to(ROOT):
            raise RuntimeError(f"project dir outside repo root: {p}")
        return p
    raise FileNotFoundError(f"project not found: {project!r} (need {PROMPT_MD})")


def project_rel(project_dir: Path) -> str:
    return project_dir.relative_to(ROOT).as_posix()


def discover_projects() -> list[dict]:
    """Enumerate all formal projects that have PROJECT_PROMPT.md."""
    out = []
    for lv in LEVEL_DIRS:
        base = ROOT / lv
        if not base.is_dir():
            continue
        for d in sorted(x for x in base.iterdir() if x.is_dir()):
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
    """Heuristically pull deliverable/constraint lines from PROJECT_PROMPT.
    Reviewer-facing only — never injected into the tested model's view."""
    lines = [ln.strip() for ln in prompt_text.splitlines() if ln.strip()]
    section = None
    buckets = {"交付": [], "限制": [], "要求": []}
    heading_re = re.compile(r"^#{1,4}\s*(.+)$")
    for ln in lines:
        m = heading_re.match(ln)
        if m:
            title = m.group(1)
            if any(k in title for k in ("交付", "限制", "约束")):
                section = "交付" if "交付" in title else "限制"
            elif any(k in title for k in ("需求", "要求", "实现")):
                section = "要求"
            else:
                section = None
            continue
        if section and ln.startswith(("-", "•", "*")):
            buckets[section].append(ln.lstrip("-•* ").strip())
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


def build_dispatch_text(project: str, workdir: Path) -> str:
    """The ENTIRE prompt the tested model sees in bare mode: the dispatch
    line points at the workdir; the task itself is PROMPT.md inside it.
    No identity framing, no discipline, no contract, no rubric summary."""
    return (
        f"工作目录：{workdir}\n"
        f"任务说明在该目录的 PROMPT.md，产出文件写在同一目录。"
    )


# --- harness-side observation -------------------------------------------------

def snapshot_dir(d: Path) -> dict:
    """{relpath: {sha256, size}} for every file under d (recursive)."""
    snap = {}
    if not d.is_dir():
        return snap
    for p in sorted(d.rglob("*")):
        if p.is_file():
            rel = p.relative_to(d).as_posix()
            snap[rel] = {"sha256": sha256_file(p), "size": p.stat().st_size}
    return snap


def diff_snapshot(before: dict, after: dict) -> dict:
    """added / removed / modified file lists between two snapshots."""
    b, a = set(before), set(after)
    modified = [
        k for k in b & a
        if before[k]["sha256"] != after[k]["sha256"]
    ]
    return {
        "added": sorted(a - b),
        "removed": sorted(b - a),
        "modified": sorted(modified),
    }


def scan_transcript(text: str) -> list[str]:
    """Scan actual JSONL string values, not MIME data or JSON escape syntax.

    Native image events contain mime=image/png and data-image attachments; these
    are not the repository's Image/ directory. Decoding also prevents a Python
    `from PIL import Image` followed by JSON's escaped newline matching Image\\.
    Keep the original transcript unchanged for hashing and human inspection.
    """
    parts = []
    def visit(value, key=None):
        if isinstance(value, dict):
            for k, v in value.items(): visit(v, k)
        elif isinstance(value, list):
            for v in value: visit(v, key)
        elif isinstance(value, str):
            if key in {'mime', 'mimeType', 'mime_type', 'media_type'} and re.fullmatch(r'image/[a-zA-Z0-9.+-]+', value):
                return
            if re.fullmatch(r'data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+', value):
                return
            parts.append(value)
    for line in text.splitlines():
        try: visit(json.loads(line))
        except (ValueError, RecursionError): parts.append(line)
    hits = []
    root_l = str(ROOT).lower().rstrip("\\/")
    tl = '\n'.join(parts).lower()
    if root_l in tl.replace("/", "\\") or root_l.replace("\\", "/") in tl:
        hits.append(str(ROOT))
    for tok in LEAK_TOKENS + LEAK_LEVELS:
        if tok.lower() in tl:
            hits.append(tok)
    return sorted(set(hits))


# --- deliverable discovery ----------------------------------------------------

def list_deliverables(workdir: Path) -> list[str]:
    """Files in the workdir that look like model output: not the prompt, not
    protocol files, not dotfiles. result.json/log.md count as deliverables
    if the model happened to write them (no longer required)."""
    skip_l = {n.lower() for n in DELIVERABLE_SKIP}
    out: list[str] = []
    if not workdir.is_dir():
        return out
    for p in sorted(workdir.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(workdir).as_posix()
        if any(part.startswith(".") for part in p.relative_to(workdir).parts):
            continue
        if p.name.lower() in skip_l:
            continue
        if p.suffix.lower() in DELIVERABLE_EXTS or p.name.lower().startswith("answer"):
            out.append(rel)
    return out


def normalize_deliverable(name: str) -> str:
    """Collect-time renaming: a lone primary deliverable becomes answer.<ext>;
    anything else keeps its name."""
    ext = Path(name).suffix.lower()
    if ext in (".html", ".htm"):
        return "answer.html"
    if ext == ".svg":
        return "answer.svg"
    if ext in (".md", ".markdown"):
        return "answer.md"
    if ext == ".py":
        return "answer.py"
    if ext == ".txt":
        return "answer.txt"
    return Path(name).name


def scan_forbidden_imports(text: str) -> list[str]:
    """Static signals of leakage or placeholders inside deliverables."""
    problems = []
    if re.search(r"TODO(?!\w)|FIXME|XXX\b|未实现|占位符", text, re.I):
        problems.append("placeholder_tokens")
    if re.search(r"(\.\./)+|file:///", text):
        problems.append("possible_path_escape")
    return problems


def primary_html(workdir: Path, names: list[str]) -> Path | None:
    htmls = [n for n in names if n.lower().endswith((".html", ".htm"))]
    if not htmls:
        return None
    for pref in ("answer.html", "index.html", "demo.html", "main.html"):
        if pref in htmls:
            return workdir / pref
    return workdir / max(htmls, key=lambda n: (workdir / n).stat().st_size)


def primary_svg(workdir: Path, names: list[str]) -> Path | None:
    svgs = [n for n in names if n.lower().endswith(".svg")]
    if not svgs:
        return None
    for pref in ("answer.svg", "index.svg", "main.svg"):
        if pref in svgs:
            return workdir / pref
    return workdir / max(svgs, key=lambda n: (workdir / n).stat().st_size)
