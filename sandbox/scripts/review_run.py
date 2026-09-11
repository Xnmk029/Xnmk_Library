# -*- coding: utf-8 -*-
"""Auto-review a completed sandbox run against PROJECT_PROMPT only.

Reads the verbatim prompt + deliverables inside the run dir, emits REVIEW.md
and patches meta.json. Does not read other models' outputs or project README
rubrics (review_scope = project_prompt_only).

Usage:
  python sandbox/scripts/review_run.py --run sandbox/runs/my-model/20260909-120000-USP
  python sandbox/scripts/review_run.py --model my-model --latest
  python sandbox/scripts/review_run.py --run ... --strict
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (
    PROMPT_MD,
    REVIEW_MD,
    ROOT,
    RUN_META,
    TASK_MD,
    dump_json,
    extract_requirements,
    list_deliverables,
    load_meta,
    now_iso,
    primary_html,
    primary_svg,
    scan_forbidden_imports,
    sha256_file,
)


def find_latest_run(model: str) -> Path:
    base = ROOT / "sandbox" / "runs" / model
    if not base.is_dir():
        raise FileNotFoundError(f"no runs for model {model!r} under {base}")
    cands = [d for d in base.iterdir() if d.is_dir() and (d / RUN_META).is_file()]
    if not cands:
        raise FileNotFoundError(f"no run dirs with meta.json under {base}")
    return max(cands, key=lambda d: d.stat().st_mtime)


def integrity_check(meta: dict, result: dict | None) -> list[tuple[str, str, str]]:
    """Return list of (check_id, status, detail). status: PASS|FAIL|WARN|N/A."""
    rows = []
    integ = (result or {}).get("integrity")
    if not isinstance(integ, dict):
        rows.append(("I1", "WARN", "result.json 缺少 integrity 字段（无法核实自报）"))
        return rows
    if integ.get("read_prompt_only") is True:
        rows.append(("I1", "PASS", "自报仅依据题面作答"))
    else:
        rows.append(("I1", "FAIL", f"read_prompt_only={integ.get('read_prompt_only')!r}"))
    if integ.get("read_other_model_outputs") is False:
        rows.append(("I2", "PASS", "自报未读其他模型输出"))
    else:
        rows.append(("I2", "FAIL", f"read_other_model_outputs={integ.get('read_other_model_outputs')!r}"))
    if integ.get("external_help") is False:
        rows.append(("I3", "PASS", "自报无外部代写"))
    else:
        rows.append(("I3", "FAIL", f"external_help={integ.get('external_help')!r}"))
    return rows


def static_delivery_checks(run_dir: Path, names: list[str], html_path: Path | None, prompt_text: str) -> list[tuple[str, str, str]]:
    rows = []
    if not names:
        rows.append(("D0", "FAIL", "run 目录无交付物"))
        return rows
    rows.append(("D0", "PASS", f"交付物: {', '.join(names)}"))

    wants_html = bool(re.search(r"HTML|html|单文件.*网页|网页.*单文件", prompt_text))
    wants_svg = bool(re.search(r"\bSVG\b|\.svg", prompt_text, re.I))
    svg_path = primary_svg(run_dir, names) if wants_svg or any(n.lower().endswith(".svg") for n in names) else None

    # SVG-primary prompts may mention "网页打开" casually — do not require HTML then
    if wants_svg and not re.search(r"交付.*HTML|单\s*HTML|index\.html|answer\.html", prompt_text, re.I):
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

    if (run_dir / "result.json").is_file():
        rows.append(("D3", "PASS", "存在 result.json"))
    else:
        rows.append(("D3", "WARN", "缺少 result.json（契约建议提供）"))

    # SVG-specific checks
    if svg_path and svg_path.is_file():
        body = svg_path.read_text(encoding="utf-8", errors="replace")
        if re.search(r"<svg\b", body, re.I) and re.search(r"<(path|rect|circle|ellipse|polygon|polyline|g|line)\b", body, re.I):
            rows.append(("S1", "PASS", "SVG 含根节点与矢量图元"))
        else:
            rows.append(("S1", "FAIL", "SVG 缺少可解析的矢量图元"))
        if re.search(r'xlink:href=["\']https?://|href=["\']https?://', body, re.I):
            rows.append(("S2", "WARN", "SVG 存在外链 href，需人工确认是否伪装位图"))
        elif re.search(r"base64,", body, re.I):
            rows.append(("S2", "WARN", "SVG 含 base64 数据，需确认是否伪装位图主体"))
        else:
            rows.append(("S2", "PASS", "未发现外链/base64 冒充主体"))

    # text scan on html/js-like files
    combined_flags: set[str] = set()
    scanned = 0
    for n in names:
        p = run_dir / n
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

    # external 3d assets
    if re.search(r"不使用外部\s*3D|不使用外部模型|不加载外部", prompt_text) and html_path:
        body = html_path.read_text(encoding="utf-8", errors="replace")
        if re.search(r"\.(glb|gltf|fbx|obj)\b", body, re.I):
            rows.append(("D6", "WARN", "题面禁止外部 3D 资产，但交付物引用了 glb/gltf/fbx/obj"))
        else:
            rows.append(("D6", "PASS", "未发现外部网格资产引用"))
    else:
        rows.append(("D6", "N/A", "题面未声明外部 3D 禁令或无 HTML"))

    return rows


def requirements_trace(req: dict) -> list[str]:
    """Markdown bullets for extracted requirements + status placeholder."""
    lines = []
    for label, key in (("交付要点", "delivery"), ("限制要点", "limits"), ("静态红线", "forbidden")):
        items = req[key]
        if not items:
            continue
        lines.append(f"### {label}")
        for x in items:
            lines.append(f"- [ ] {x}")
    return lines


def render_review(meta: dict, rows: list[tuple[str, str, str]], notes: list[str], verdict: str) -> str:
    def status_icon(s: str) -> str:
        return {"PASS": "PASS", "FAIL": "FAIL", "WARN": "WARN", "N/A": "N/A"}.get(s, s)

    table = ["| ID | Status | Detail |", "|---|---|---|"]
    for cid, st, detail in rows:
        detail_esc = detail.replace("|", "\\|")
        table.append(f"| {cid} | **{status_icon(st)}** | {detail_esc} |")

    notes_md = "\n".join(f"- {n}" for n in notes) if notes else "- （无）"

    return f"""# REVIEW.md · 自动审阅报告

- **run_id**: `{meta.get('run_id')}`
- **model**: `{meta.get('model')}`
- **project**: `{meta.get('project_rel')}`
- **reviewed_at**: {now_iso()}
- **review_scope**: `project_prompt_only`（仅对照 PROJECT_PROMPT，不读 README 评分细则 / 其他模型输出）
- **prompt_sha256**: `{meta.get('prompt_sha256')}`
- **verdict**: **{verdict}**

## 检查表

{chr(10).join(table)}

## 题面要求对照（勾选由审阅 agent / 人工补全）

> 下列条目从 PROJECT_PROMPT 机械提取，作为 checklist；细项判定结合「智能层补记」。

{notes_md}

## 智能层补记

> 审阅 Agent 追加：逐项勾选、引用依据、运行时观察、是否推翻机器 verdict。禁止粘贴其他模型实现。

（待补记）

## 结论说明

- `PASS`：静态检查通过。
- `FAIL`：存在违反纪律自报或明确红线；`--strict` 时进程退出码非 0。
- `WARN`：需人工复核，不自动否决。
- 本报告**不**替代 README「自动化验收建议」中的运行时/视觉验收；那些需要浏览器或专项工具在隔离环境中另测。

---
*由 sandbox/scripts/review_run.py 生成。完整评分口径请在隔离审阅流程中单独打开项目 README，勿将 rubric 注入受测 run。*
"""


def review(run_dir: Path, strict: bool = False) -> int:
    run_dir = run_dir.resolve()
    meta = load_meta(run_dir)
    if meta.get("prompt_sha256"):
        p = run_dir / PROMPT_MD
        if p.is_file() and sha256_file(p) != meta["prompt_sha256"]:
            print(f"WARN: PROJECT_PROMPT.md hash mismatch vs meta", file=sys.stderr)

    prompt_path = run_dir / PROMPT_MD
    if not prompt_path.is_file():
        print(f"ERROR: missing {PROMPT_MD} in {run_dir}", file=sys.stderr)
        return 2
    prompt_text = prompt_path.read_text(encoding="utf-8")
    req = extract_requirements(prompt_text)

    result = None
    rp = run_dir / "result.json"
    if rp.is_file():
        try:
            import json
            result = json.loads(rp.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            print(f"WARN: result.json parse failed: {e}", file=sys.stderr)

    names = list_deliverables(run_dir)
    html_path = primary_html(run_dir, names)

    rows: list[tuple[str, str, str]] = []
    rows.append(("P1", "PASS", f"题面载入 {len(prompt_text)} chars"))
    rows.extend(integrity_check(meta, result))
    rows.extend(static_delivery_checks(run_dir, names, html_path, prompt_text))

    if result and isinstance(result, dict):
        status = result.get("status")
        if status == "complete":
            rows.append(("R1", "PASS", "result.status=complete"))
        elif status:
            rows.append(("R1", "WARN", f"result.status={status!r}"))
        else:
            rows.append(("R1", "WARN", "result.status 缺失"))
        model_in_result = result.get("model")
        if model_in_result and model_in_result != meta.get("model"):
            rows.append(("R2", "WARN", f"result.model={model_in_result!r} ≠ meta.model={meta.get('model')!r}"))
        else:
            rows.append(("R2", "PASS", "model 标识一致或未冲突"))
    else:
        rows.append(("R1", "WARN", "无 result.json，跳过状态字段检查"))

    # prompt checklist excerpt for agent to fill
    check_lines = requirements_trace(req)
    notes = check_lines

    fails = [r for r in rows if r[1] == "FAIL"]
    warns = [r for r in rows if r[1] == "WARN"]
    if fails:
        verdict = "INVALID" if any(r[0].startswith("I") for r in fails) else "FAIL"
    elif warns:
        verdict = "PASS_WITH_WARNINGS"
    else:
        verdict = "PASS"

    text = render_review(meta, rows, notes, verdict)
    (run_dir / REVIEW_MD).write_text(text, encoding="utf-8")

    meta["status"] = "reviewed"
    meta["reviewed_at"] = now_iso()
    meta["verdict"] = verdict
    meta["review_checks"] = [{"id": a, "status": b, "detail": c} for a, b, c in rows]
    dump_json(run_dir / RUN_META, meta)

    print(f"reviewed: {run_dir.relative_to(ROOT).as_posix() if run_dir.is_relative_to(ROOT) else run_dir}")
    print(f"  verdict: {verdict}")
    print(f"  fails={len(fails)} warns={len(warns)} total_checks={len(rows)}")
    print(f"  wrote {REVIEW_MD}")

    if strict and fails:
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Auto-review sandbox run (prompt-only scope)")
    ap.add_argument("--run", type=Path, help="Path to run directory")
    ap.add_argument("--model", help="With --latest: pick newest run for this model slug")
    ap.add_argument("--latest", action="store_true", help="Review latest run for --model")
    ap.add_argument("--strict", action="store_true", help="Exit 1 on FAIL")
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

    return review(run_dir, strict=args.strict)


if __name__ == "__main__":
    raise SystemExit(main())
