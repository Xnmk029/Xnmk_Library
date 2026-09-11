# -*- coding: utf-8 -*-
"""Build sandbox/review-lab/review.html — quick multi-batch review dashboard (live-test + live-pro)."""
from __future__ import annotations

import json
import re
from pathlib import Path

LAB = Path(__file__).resolve().parent          # sandbox/review-lab
ROOT = LAB.parents[1]                           # repo root
OUT = LAB / "review.html"
REF_ASSETS = LAB / "reference-assets"
# review.html sits at sandbox/review-lab/ → repo-root-relative links need "../../"
URL_PREFIX = "../" * len(LAB.relative_to(ROOT).parts)

QUESTIONS = [
    {
        "slug": "QinBearSVG",
        "name": "北极熊骑秦始皇",
        "level": "L1",
        "domain": "SVG 插画",
        "color": "#f59e0b",
        "icon": "QB",
        "deliverable": "answer.svg",
        "preview": "svg",
    },
    {
        "slug": "DoubleWishbone",
        "name": "双叉臂前悬挂",
        "level": "L2",
        "domain": "3D / 运动学",
        "color": "#3b82f6",
        "icon": "DW",
        "deliverable": "index.html",
        "preview": "html",
    },
    {
        "slug": "USP",
        "name": "USP Match 机械分解",
        "level": "L3",
        "domain": "3D / PS1",
        "color": "#a855f7",
        "icon": "US",
        "deliverable": "answer.html",
        "preview": "html",
    },
    {
        "slug": "StyleContinuation",
        "name": "有文风参考续写",
        "level": "L3",
        "domain": "网文续写",
        "color": "#10b981",
        "icon": "SC",
        "deliverable": "answer.md",
        "preview": "md",
    },
    {
        "slug": "VoxelLujiazui",
        "name": "体素陆家嘴三件套",
        "level": "L3",
        "domain": "体素城市",
        "color": "#06b6d4",
        "icon": "VL",
        "deliverable": "answer.html",
        "preview": "html",
    },
]

# batch_key -> { "label", "path", "runs": {slug: run_dir_name} }
BATCHES = {
    "live-test": {
        "label": "live-test",
        "color": "#38bdf8",
        "path": ROOT / "sandbox" / "runs" / "live-test",
        "runs": {
            "QinBearSVG": "20260909-193148-QinBearSVG",
            "DoubleWishbone": "20260909-193359-DoubleWishbone",
            "USP": "20260909-193410-USP",
            "StyleContinuation": "20260909-193411-StyleContinuation",
            "VoxelLujiazui": "20260909-193411-VoxelLujiazui",
        },
    },
    "live-test-b": {
        "label": "live-test·B",
        "color": "#2dd4bf",
        "path": ROOT / "sandbox" / "runs" / "live-test",
        "runs": {
            "QinBearSVG": "20260909-211450-QinBearSVG",
            "DoubleWishbone": "20260909-211453-DoubleWishbone",
            "USP": "20260909-211455-USP",
            "VoxelLujiazui": "20260909-211457-VoxelLujiazui",
            "StyleContinuation": "20260909-211459-StyleContinuation",
        },
    },
    "live-pro": {
        "label": "live-pro",
        "color": "#a78bfa",
        "path": ROOT / "sandbox" / "runs" / "live-pro",
        "runs": {
            "QinBearSVG": "20260909-200955-QinBearSVG",
            "DoubleWishbone": "20260909-200946-DoubleWishbone",
            "USP": "20260909-200946-USP",
            "StyleContinuation": "20260909-200947-StyleContinuation",
            "VoxelLujiazui": "20260909-200947-VoxelLujiazui",
        },
    },
    "pangu-2.0-pro": {
        "label": "pangu-2.0-pro",
        "color": "#fb923c",
        "path": ROOT / "sandbox" / "runs" / "pangu-2.0-pro",
        "runs": {
            "QinBearSVG": "20260909-212936-QinBearSVG",
            "DoubleWishbone": "20260909-215034-DoubleWishbone",
            "USP": "20260909-212935-USP",
            "StyleContinuation": "20260909-212939-StyleContinuation",
            "VoxelLujiazui": "20260909-212937-VoxelLujiazui",
        },
    },
}

RUNS = {k: v["path"] for k, v in BATCHES.items()}


def expand_catalog() -> list[dict]:
    items = []
    for batch_key, batch in BATCHES.items():
        for q in QUESTIONS:
            run_name = batch["runs"].get(q["slug"])
            if not run_name:
                continue
            meta = {
                "batch": batch_key,
                "batchLabel": batch["label"],
                "batchColor": batch["color"],
                "dir": run_name,
                **q,
            }
            items.append(meta)
    return items


CATALOG = expand_catalog()


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")

MODEL_IDS = {"live-test": "mimo-x-flash", "live-test-b": "pangu-2.0-flash", "live-pro": "mimo-x-pro", "pangu-2.0-pro": "pangu-2.0-pro"}

def read_json(p):
    if not p.exists(): return {}
    try: return json.loads(read_text(p))
    except (ValueError, OSError): return {"_error": "JSON 无法解析"}

def record(path, question, model, batch, uid, reference=False, source=None):
    run = path.parent
    result = read_json(run / "result.json") if not reference else {}
    review = read_text(run / "REVIEW.md") if not reference and (run / "REVIEW.md").exists() else ""
    checks = []
    for line in review.splitlines():
        cells = [c.strip().replace("**", "") for c in line.strip().strip("|").split("|")]
        if line.startswith("|") and len(cells) >= 3 and re.fullmatch(r"[A-Z]+[0-9]+", cells[0]):
            checks.append(dict(id=cells[0], status=cells[1], detail=" | ".join(cells[2:])))
    verdict = re.search(r"\*\*verdict\*\*:\s*\*\*([A-Z_]+)\*\*", review)
    exists = path.is_file() and path.stat().st_size > 0
    relative = path.relative_to(ROOT).as_posix()
    return dict(id=uid, slug=question["slug"], model=model, batch=batch, reference=reference,
        identitySource="用户确认", source=source or relative, path=relative, url=URL_PREFIX + relative,
        file=path.name, bytes=path.stat().st_size if exists else 0,
        content=read_text(path) if exists else "", result=result,
        selfReport=result.get("model_self_report", {}), checks=checks, review=review,
        verdict="NO_DELIVERABLE" if not exists else verdict.group(1) if verdict else "NOT_REVIEWED",
        log=read_text(run / "log.md") if not reference and (run / "log.md").exists() else "")

def build_items():
    items=[]
    for entry in CATALOG:
        run=RUNS[entry["batch"]] / entry["dir"]
        path=run / entry["deliverable"]
        if not path.exists():
            path=next((run / f for f in ("answer.html", "index.html", "answer.svg", "answer.md") if (run / f).exists()), path)
        items.append(record(path, entry, MODEL_IDS[entry["batch"]], entry["batch"], entry["batch"]+"/"+entry["dir"]))
    refs={"QinBearSVG": "Astra_PRO_polar_bear_riding_qin_shi_huang.svg", "DoubleWishbone": "astra_双叉臂悬挂.html", "USP": "astra_usp-match.html"}
    for q in QUESTIONS:
        if q["slug"] in refs:
            items.append(record(ROOT / "暂存" / refs[q["slug"]], q, "astra", "SOTA 参考", "reference/"+q["slug"], True))
    import zipfile
    archive=ROOT / "暂存" / "V4pro0902灰度测试.zip"
    target=REF_ASSETS / "v4-pro-0902"
    # Only production files; no probes, executables or archive path traversal.
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            rel=Path(info.filename)
            if not info.is_dir() and (info.filename == "sh/dist/lujiazui.html" or info.filename.startswith("sh/src/") or info.filename == "sh/README.md"):
                out=(target / rel).resolve()
                if not out.is_relative_to(target.resolve()): raise ValueError("Unsafe archive path")
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(z.read(info))
    q=next(q for q in QUESTIONS if q["slug"]=="VoxelLujiazui")
    items.append(record(target / "sh/dist/lujiazui.html", q, "v4-pro-0902-gray", "SOTA 参考", "reference/VoxelLujiazui", True, "暂存/V4pro0902灰度测试.zip → sh/dist/lujiazui.html"))
    for item in items:
        primary=ROOT / item["path"]
        folder=primary.parent
        files=[primary]
        if item["model"]=="v4-pro-0902-gray":
            files += sorted((target / "sh/src").rglob("*.js")) + [target / "sh/README.md"]
        elif not item["reference"]:
            files += [p for p in sorted(folder.iterdir()) if p.is_file() and p!=primary and p.suffix.lower() in {".md", ".json", ".js", ".css", ".html", ".svg", ".py"}]
        item["files"]=[dict(name=p.relative_to(folder).as_posix() if p.is_relative_to(folder) else p.relative_to(target / "sh").as_posix(), path=p.relative_to(ROOT).as_posix(), url=URL_PREFIX+p.relative_to(ROOT).as_posix(), content=read_text(p), bytes=p.stat().st_size) for p in files if p.exists()]
    return items

def main():
    items=build_items()
    project_paths={"QinBearSVG":"L1_Basic", "DoubleWishbone":"L2_Intermediate", "USP":"L3_Advanced", "StyleContinuation":"L3_Advanced", "VoxelLujiazui":"L3_Advanced"}
    questions=[dict(q, prompt=read_text(ROOT / project_paths[q["slug"]] / q["slug"] / "PROJECT_PROMPT.md")) for q in QUESTIONS]
    import base64
    vendor={}
    for lib in sorted((REF_ASSETS / "vendor").rglob("*.js")):
        vendor[lib.parent.name+"/"+lib.name]="data:text/javascript;base64,"+base64.b64encode(lib.read_bytes()).decode()
    payload=dict(items=items, questions=questions, original=read_text(ROOT / "暂存/续写网文.md"), vendor=vendor)
    data=json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c")
    shell=read_text(Path(__file__).with_name("review_ui_shell.html"))
    OUT.write_text(shell.replace("__DATA__", data), encoding="utf-8")
    print(f"Built {OUT}: {len(items)} entries, {len(questions)} questions")

if __name__ == "__main__": main()
