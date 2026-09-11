# -*- coding: utf-8 -*-
"""Prepare an isolated sandbox run for a formal benchmark project.

Creates sandbox/runs/<model>/<ts>-<project>/ containing ONLY:
  TASK.md            discipline + verbatim PROJECT_PROMPT + answer contract
  PROJECT_PROMPT.md  byte-identical copy of the source prompt (do not edit)
  meta.json          run metadata for collect / review / audit

Usage:
  python sandbox/scripts/prepare_run.py --project USP --model my-model-slug
  python sandbox/scripts/prepare_run.py --project L3_Advanced/USP --model hy4-prev --list
  python sandbox/scripts/prepare_run.py --project USP --model m1 --dry-run
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (  # noqa: E402
    PROMPT_MD,
    ROOT,
    RUNS,
    RUN_META,
    TASK_MD,
    discipline_block,
    dump_json,
    extract_requirements,
    now_iso,
    project_rel,
    resolve_project_dir,
    sha256_file,
    ts_slug,
    discover_projects,
)


def build_task_md(project: str, rel: str, prompt_text: str, req: dict) -> str:
    req_lines = []
    if req["delivery"]:
        req_lines.append("### 交付要点（从题面提取）")
        req_lines += [f"- {x}" for x in req["delivery"]]
    if req["limits"]:
        req_lines.append("")
        req_lines.append("### 限制要点（从题面提取）")
        req_lines += [f"- {x}" for x in req["limits"]]
    if req["forbidden"]:
        req_lines.append("")
        req_lines.append("### 静态红线（自动推断）")
        req_lines += [f"- {x}" for x in req["forbidden"]]
    req_block = "\n".join(req_lines) if req_lines else "（题面未识别到分节要点，以下原文为唯一标准）"

    return f"""# {project} · 隔离临时测试（sandbox run）

## 纪律（违反任一条即作废重测）

{discipline_block()}

## 试题提示词（原文，唯一标准）

> `PROJECT_PROMPT.md` 与本节提示词同源。**不要修改任何技术约束。**

```markdown
{prompt_text}
```

## 提取的要求摘要（非替代原文）

{req_block}

## 作答契约

1. 在本目录生成题面要求的交付物（单文件 HTML 通常命名 `answer.html`）。
2. 写入 `result.json`，至少包含：

```json
{{
  "task": "{project}",
  "model": "<your-model-slug>",
  "deliverable": "answer.html",
  "status": "complete",
  "integrity": {{
    "read_prompt_only": true,
    "read_other_model_outputs": false,
    "external_help": false
  }},
  "notes": "可选：实现要点与自验说明"
}}
```

3. 可选：`log.md` 记录实现与自测（同样不得泄露其他模型内容）。
4. 工作目录最终尽量只保留：`TASK.md`、`PROJECT_PROMPT.md`、交付物、`result.json`、`log.md`。

## 环境提示

- 运行目录：本文件所在目录。你是受测模型；不要尝试 `cd ..` 或读取上级目录。
- 若需本地起服务预览，请在本目录内进行，产物仍以文件交付为准。
"""


def prepare(project_arg: str, model: str, dry_run: bool = False) -> Path:
    project_dir = resolve_project_dir(project_arg)
    rel = project_rel(project_dir)
    prompt_path = project_dir / PROMPT_MD
    prompt_text = prompt_path.read_text(encoding="utf-8")
    prompt_sha = sha256_file(prompt_path)
    req = extract_requirements(prompt_text)

    run_id = f"{ts_slug()}-{project_dir.name}"
    run_dir = RUNS / model / run_id

    if dry_run:
        print(f"[dry-run] would create {run_dir}")
        print(f"  project={rel}")
        print(f"  prompt_sha256={prompt_sha}")
        print(f"  delivery_lines={len(req['delivery'])} limits={len(req['limits'])}")
        return run_dir

    if run_dir.exists():
        raise FileExistsError(f"run dir already exists: {run_dir}")

    run_dir.mkdir(parents=True, exist_ok=False)
    (run_dir / PROMPT_MD).write_bytes(prompt_path.read_bytes())
    (run_dir / TASK_MD).write_text(
        build_task_md(project_dir.name, rel, prompt_text, req),
        encoding="utf-8",
    )

    meta = {
        "run_id": run_id,
        "model": model,
        "project": project_dir.name,
        "project_rel": rel,
        "created_at": now_iso(),
        "prompt_sha256": prompt_sha,
        "prompt_source": rel + "/" + PROMPT_MD,
        "isolation": "dir+discipline",
        "review_scope": "project_prompt_only",
        "status": "prepared",
    }
    dump_json(run_dir / RUN_META, meta)

    print(f"prepared: {run_dir.relative_to(ROOT).as_posix()}")
    print(f"  project: {rel}")
    print(f"  prompt_sha256: {prompt_sha[:16]}…")
    print(f"  next: open the run dir as the model workspace, deliver files, then review_run.py")
    return run_dir


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Prepare isolated sandbox run")
    ap.add_argument("--project", help="Project name or path, e.g. USP or L3_Advanced/USP")
    ap.add_argument("--model", help="Model slug (sandbox runs/<model>/...)")
    ap.add_argument("--list", action="store_true", help="List all discoverable projects")
    ap.add_argument("--dry-run", action="store_true", help="Validate and print without writing")
    args = ap.parse_args(argv)

    if args.list:
        rows = discover_projects()
        for r in rows:
            print(f"{r['rel']}\t{r['prompt_sha256'][:12]}")
        print(f"# {len(rows)} projects", file=sys.stderr)
        return 0

    if not args.project or not args.model:
        ap.error("--project and --model are required (or use --list)")

    try:
        prepare(args.project, args.model, dry_run=args.dry_run)
        return 0
    except (FileNotFoundError, RuntimeError, FileExistsError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
