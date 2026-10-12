# -*- coding: utf-8 -*-
"""Auto-review a completed sandbox run — protocol 2.0.

Integrity is OBSERVED, not self-reported:
  H1  workdir sits outside the repo (location check, not OS access enforcement)
  H2  workdir snapshot diff: prompt untouched, no forbidden entries
  H3  optional transcript scan for repo-path leakage (--transcript)

Deliverable checks (D*) run against the workdir only. There is no
result.json contract: a missing self-report is not a failure, and a
self-report cannot soften an observed breach.

Usage:
  python sandbox/scripts/review_run.py --run sandbox/runs/<model>/<run_id>
  python sandbox/scripts/review_run.py --model <slug> --latest
  python sandbox/scripts/review_run.py --run ... --transcript session.txt --strict
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (  # noqa: E402
    AGENT_STATE_NAMES,
    FORBIDDEN_DIR_NAMES,
    PROMPT_FILE,
    REVIEW_MD,
    ROOT,
    RUN_META,
    RUNS,
    SNAPSHOT,
    diff_snapshot,
    dump_json,
    extract_requirements,
    list_deliverables,
    load_json,
    load_meta,
    now_iso,
    primary_html,
    primary_svg,
    scan_forbidden_imports,
    scan_transcript,
    sha256_file,
    snapshot_dir,
    workdir_of,
)


def find_latest_run(model: str) -> Path:
    base = RUNS / model
    if not base.is_dir():
        raise FileNotFoundError(f"no runs for model {model!r} under {base}")
    cands = [d for d in base.iterdir() if d.is_dir() and (d / RUN_META).is_file()]
    if not cands:
        raise FileNotFoundError(f"no run dirs with meta.json under {base}")
    return max(cands, key=lambda d: d.stat().st_mtime)


def observed_integrity_checks(meta: dict, workdir: Path,
                              harness_dir: Path, transcript: str | None
                              ) -> list[tuple[str, str, str]]:
    """H-series: environment evidence, replacing self-reported integrity."""
    rows = []

    # H1: workspace outside the repo
    try:
        wd = workdir.resolve()
        if wd.is_relative_to(ROOT.resolve()):
            rows.append(("H1", "FAIL", f"workdir 位于仓库内: {wd}——隔离失效"))
        else:
            rows.append(("H1", "PASS", f"workdir 在仓库外: {wd}"))
    except OSError as e:
        rows.append(("H1", "FAIL", f"workdir 解析失败: {e}"))

    # H2: snapshot diff — prompt untouched, nothing removed/modified
    snap_path = harness_dir / SNAPSHOT
    if not snap_path.is_file():
        rows.append(("H2", "FAIL", "缺少 prepare 期快照，无法验证目录未被污染"))
    else:
        before = load_json(snap_path)
        after = snapshot_dir(workdir)
        diff = diff_snapshot(before, after)
        problems = []
        if PROMPT_FILE in diff["modified"] or PROMPT_FILE in diff["removed"]:
            problems.append(f"{PROMPT_FILE} 被改动/删除")
        if diff["modified"]:
            problems.append(f"已有文件被修改: {diff['modified']}")
        if diff["removed"]:
            problems.append(f"已有文件被删除: {diff['removed']}")
        names = {Path(a).name for a in diff["added"]}
        bad = names & (FORBIDDEN_DIR_NAMES | AGENT_STATE_NAMES)
        if bad:
            problems.append(f"新增禁入项: {sorted(bad)}")
        if problems:
            rows.append(("H2", "FAIL", "；".join(problems)))
        else:
            n = len(diff["added"])
            rows.append(("H2", "PASS", f"快照 diff 干净：新增 {n} 个文件，无修改/删除"))

    # H3: transcript leak scan
    if transcript is None:
        rows.append(("H3", "N/A", "未提供会话 transcript，跳过越权路径扫描"))
    else:
        hits = scan_transcript(transcript)
        if hits:
            rows.append(("H3", "FAIL", f"transcript 出现仓库路径痕迹: {', '.join(hits[:8])}"))
        else:
            rows.append(("H3", "PASS", f"transcript ({len(transcript)} chars) 未见仓库路径痕迹"))
    return rows


def leakage_check(workdir: Path) -> list[tuple[str, str, str]]:
    """Foreign entries currently in the workdir."""
    rows = []
    try:
        entries = list(workdir.iterdir())
    except OSError:
        return [("L1", "FAIL", f"workdir 不可读: {workdir}")]
    bad = [e.name for e in entries
           if e.name in FORBIDDEN_DIR_NAMES or e.name in AGENT_STATE_NAMES]
    if bad:
        rows.append(("L1", "FAIL", f"workdir 内出现禁入项: {', '.join(sorted(bad))}"))
    dirs = [e.name for e in entries if e.is_dir()
            and e.name not in FORBIDDEN_DIR_NAMES and e.name not in AGENT_STATE_NAMES]
    if dirs:
        rows.append(("L2", "WARN", f"workdir 内存在子目录: {', '.join(sorted(dirs))}（确认非外部拷贝/工具状态）"))
    dots = [e.name for e in entries if e.is_file() and e.name.startswith(".")]
    if dots:
        rows.append(("L3", "WARN", f"workdir 内存在点文件: {', '.join(sorted(dots))}"))
    return rows


def static_delivery_checks(workdir: Path, names: list[str],
                           html_path: Path | None, prompt_text: str
                           ) -> list[tuple[str, str, str]]:
    rows = []
    if not names:
        rows.append(("D0", "FAIL", "workdir 无交付物"))
        return rows
    rows.append(("D0", "PASS", f"交付物: {', '.join(names)}"))

    wants_html = bool(re.search(r"HTML|html|单文件.*网页|网页.*单文件", prompt_text))
    wants_svg = bool(re.search(r"\bSVG\b|\.svg", prompt_text, re.I))
    svg_path = primary_svg(workdir, names) if wants_svg or any(
        n.lower().endswith(".svg") for n in names) else None

    if wants_svg and not re.search(r"交付.*HTML|单\s*HTML|index\.html|answer\.html", prompt_text, re.I):
        wants_html = False
    # 禁止/不要输出 HTML 不是交付要求（写作题常见）
    if wants_html and re.search(
        r"(不要|不得|禁止).{0,24}HTML|(不要|不得|禁止)输出.{0,40}HTML",
        prompt_text,
        re.I,
    ) and not re.search(
        r"(交付|产出).{0,40}(\.html|HTML 文件)|单\s*HTML|index\.html|answer\.html",
        prompt_text,
        re.I,
    ):
        wants_html = False

    if wants_html:
        if html_path and html_path.is_file():
            rows.append(("D1", "PASS", f"存在 HTML 交付 {html_path.name} ({html_path.stat().st_size} bytes)"))
        else:
            rows.append(("D1", "FAIL", "题面涉及 HTML 但未找到 .html 交付物"))
    elif wants_svg:
        if svg_path and svg_path.is_file():
            rows.append(("D1", "PASS", f"存在 SVG 交付 {svg_path.name} ({svg_path.stat().st_size} bytes)"))
        else:
            rows.append(("D1", "FAIL", "题面涉及 SVG 但未找到 .svg 交付物"))
    else:
        rows.append(("D1", "N/A", "题面未要求 HTML/SVG"))

    single = bool(re.search(r"单\s*HTML|单文件|single\s*HTML|单个可独立打开", prompt_text, re.I))
    if single and html_path:
        htmls = [n for n in names if n.lower().endswith((".html", ".htm"))]
        if len(htmls) <= 1:
            rows.append(("D2", "PASS", "满足单 HTML 交付形态"))
        else:
            rows.append(("D2", "WARN", f"多个 HTML 文件: {htmls}（题面倾向单文件）"))
    elif single and svg_path:
        svgs = [n for n in names if n.lower().endswith(".svg")]
        if len(svgs) <= 1:
            rows.append(("D2", "PASS", "满足单 SVG 交付形态"))
        else:
            rows.append(("D2", "WARN", f"多个 SVG 文件: {svgs}（题面倾向单文件）"))

    if svg_path and svg_path.is_file():
        body = svg_path.read_text(encoding="utf-8", errors="replace")
        if re.search(r"<svg\b", body, re.I) and re.search(
                r"<(path|rect|circle|ellipse|polygon|polyline|g|line)\b", body, re.I):
            rows.append(("S1", "PASS", "SVG 含根节点与矢量图元"))
        else:
            rows.append(("S1", "FAIL", "SVG 缺少可解析的矢量图元"))
        if re.search(r'xlink:href=["\']https?://|href=["\']https?://', body, re.I):
            rows.append(("S2", "WARN", "SVG 存在外链 href，需人工确认是否伪装位图"))
        elif re.search(r"base64,", body, re.I):
            rows.append(("S2", "WARN", "SVG 含 base64 数据，需确认是否伪装位图主体"))
        else:
            rows.append(("S2", "PASS", "未发现外链/base64 冒充主体"))

    combined_flags: set[str] = set()
    scanned = 0
    for n in names:
        p = workdir / n
        if p.suffix.lower() not in {".html", ".htm", ".js", ".mjs", ".css", ".json", ".md", ".svg"}:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        scanned += 1
        combined_flags.update(scan_forbidden_imports(text))
    if "placeholder_tokens" in combined_flags:
        rows.append(("D4", "FAIL", "交付物中出现 TODO/FIXME/未实现/占位符 等红线信号"))
    elif scanned:
        rows.append(("D4", "PASS", f"已扫描 {scanned} 个文本交付物，未见占位符红线"))
    else:
        rows.append(("D4", "N/A", "无文本类交付物可扫"))
    if "possible_path_escape" in combined_flags:
        rows.append(("D5", "WARN", "检测到 ../ 或 file:/// 字符串，请人工确认是否越权读题"))
    else:
        rows.append(("D5", "PASS", "未见明显路径逃逸字符串"))

    if re.search(r"不使用外部\s*3D|不使用外部模型|不加载外部", prompt_text) and html_path:
        body = html_path.read_text(encoding="utf-8", errors="replace")
        if re.search(r"\.(glb|gltf|fbx|obj)\b", body, re.I):
            rows.append(("D6", "WARN", "题面禁止外部 3D 资产，但交付物引用了 glb/gltf/fbx/obj"))
        else:
            rows.append(("D6", "PASS", "未发现外部网格资产引用"))
    else:
        rows.append(("D6", "N/A", "题面未声明外部 3D 禁令或无 HTML"))

    # informational only — a voluntary self-report is nice to have
    if (workdir / "result.json").is_file():
        try:
            r = json.loads((workdir / "result.json").read_text(encoding="utf-8"))
            rows.append(("D8", "N/A",
                         f"模型自愿提交了 result.json（status={r.get('status')!r}），仅作参考不计入 verdict"))
        except ValueError:
            rows.append(("D8", "N/A", "存在 result.json 但无法解析，仅作参考"))
    return rows


def requirements_trace(req: dict) -> list[str]:
    lines = []
    for label, key in (("交付要点", "delivery"), ("限制要点", "limits"), ("静态红线", "forbidden")):
        items = req[key]
        if not items:
            continue
        lines.append(f"### {label}")
        for x in items:
            lines.append(f"- [ ] {x}")
    return lines


def render_review(meta: dict, rows: list[tuple[str, str, str]],
                  notes: list[str], verdict: str) -> str:
    table = ["| ID | Status | Detail |", "|---|---|---|"]
    for cid, st, detail in rows:
        table.append(f"| {cid} | **{st}** | {detail.replace('|', '\\|')} |")
    notes_md = "\n".join(f"- {n}" for n in notes) if notes else "- （无）"

    return f"""# REVIEW.md · 自动审阅报告

- **run_id**: `{meta.get('run_id')}`
- **model**: `{meta.get('model')}`
- **project**: `{meta.get('project_rel')}`
- **protocol**: `{meta.get('protocol_version')}` ({meta.get('mode')})
- **reviewed_at**: {now_iso()}
- **review_scope**: `project_prompt_only`（仅对照题面，不读 README 评分细则 / 其他模型输出）
- **prompt_sha256**: `{meta.get('prompt_sha256')}`
- **verdict**: **{verdict}**

## 检查表

{chr(10).join(table)}

## 题面要求对照（勾选由审阅 agent / 人工补全）

> 下列条目从题面机械提取，仅对审阅可见；受测方从未见过这份摘要。

{notes_md}

## 智能层补记

> 审阅 Agent 追加：逐项勾选、引用依据、运行时观察、是否推翻机器 verdict。禁止粘贴其他模型实现。

（待补记）

## 结论说明

- `PASS`：静态检查与观测完整性通过。
- `FAIL`：交付物红线（缺失、占位符、SVG 无效等）。
- `INVALID`：观测到的完整性违规（H1 隔离失效 / H2 快照污染 / H3 越权读题）——作废不收卷。
- `WARN`：需人工复核，不自动否决。
- 本报告**不**替代 README「自动化验收建议」中的运行时/视觉验收。

---
*由 sandbox/scripts/review_run.py 生成（protocol 2.0）。*
"""


def review(harness_dir: Path, strict: bool = False,
           transcript_path: Path | None = None) -> int:
    harness_dir = harness_dir.resolve()
    meta = load_meta(harness_dir)
    if meta.get("protocol_version") != "2.0":
        print(f"ERROR: run 为旧协议 {meta.get('protocol_version', '1.x')}，"
              f"已标记 deprecated；请用 bare 模式重新组卷。", file=sys.stderr)
        return 4

    if meta.get("profile") == "bare-vision-v1":
        from vision_profile import review as vision_review
        return vision_review(harness_dir, strict, transcript_path)
    if meta.get("profile") == "legacy-vision-explore-v1":
        from legacy_vision import review as legacy_review
        return legacy_review(harness_dir, strict, transcript_path)
    if meta.get("profile") == "native-godot-v1":
        from godot_profile import review as godot_review
        return godot_review(harness_dir, strict, transcript_path)

    workdir = workdir_of(meta)
    prompt_path = workdir / PROMPT_FILE
    if not prompt_path.is_file():
        print(f"ERROR: missing {PROMPT_FILE} in workdir {workdir}", file=sys.stderr)
        return 2
    if sha256_file(prompt_path) != meta["prompt_sha256"]:
        print("WARN: PROMPT.md hash mismatch vs meta — H2 will flag this", file=sys.stderr)

    transcript = None
    if transcript_path:
        transcript = Path(transcript_path).read_text(encoding="utf-8", errors="replace")

    prompt_text = prompt_path.read_text(encoding="utf-8")
    req = extract_requirements(prompt_text)
    names = list_deliverables(workdir)
    html_path = primary_html(workdir, names)

    rows: list[tuple[str, str, str]] = []
    rows.append(("P1", "PASS", f"题面载入 {len(prompt_text)} chars"))
    rows.extend(observed_integrity_checks(meta, workdir, harness_dir, transcript))
    rows.extend(leakage_check(workdir))
    rows.extend(static_delivery_checks(workdir, names, html_path, prompt_text))

    fails = [r for r in rows if r[1] == "FAIL"]
    warns = [r for r in rows if r[1] == "WARN"]
    if fails:
        verdict = "INVALID" if any(r[0].startswith(("H", "L1")) for r in fails) else "FAIL"
    elif warns:
        verdict = "PASS_WITH_WARNINGS"
    else:
        verdict = "PASS"

    text = render_review(meta, rows, requirements_trace(req), verdict)
    (harness_dir / REVIEW_MD).write_text(text, encoding="utf-8")

    meta["status"] = "reviewed"
    meta["reviewed_at"] = now_iso()
    meta["verdict"] = verdict
    meta["deliverables"] = names
    meta["review_checks"] = [{"id": a, "status": b, "detail": c} for a, b, c in rows]
    dump_json(harness_dir / RUN_META, meta)

    rel = harness_dir.relative_to(ROOT).as_posix() if harness_dir.is_relative_to(ROOT) else harness_dir
    print(f"reviewed: {rel}")
    print(f"  verdict: {verdict}")
    print(f"  fails={len(fails)} warns={len(warns)} total_checks={len(rows)}")
    print(f"  wrote {REVIEW_MD}")

    if strict and fails:
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Auto-review sandbox run (protocol 2.0)")
    ap.add_argument("--run", type=Path, help="Harness run dir (sandbox/runs/<model>/<run_id>)")
    ap.add_argument("--model", help="With --latest: pick newest run for this model slug")
    ap.add_argument("--latest", action="store_true")
    ap.add_argument("--transcript", type=Path,
                    help="Optional session transcript for leak scan (H3)")
    ap.add_argument("--strict", action="store_true", help="Exit 1 on FAIL/INVALID")
    args = ap.parse_args(argv)

    if args.latest:
        if not args.model:
            ap.error("--latest requires --model")
        run_dir = find_latest_run(args.model)
    elif args.run:
        run_dir = args.run
    else:
        ap.error("need --run PATH or --model SLUG --latest")
        return 2

    return review(run_dir, strict=args.strict, transcript_path=args.transcript)


if __name__ == "__main__":
    raise SystemExit(main())
