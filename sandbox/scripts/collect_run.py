# -*- coding: utf-8 -*-
"""Collect a reviewed sandbox run back into the formal project model folder.

Copies deliverables to <project>/<model-slug>/.
Does NOT copy TASK.md / PROJECT_PROMPT.md / meta.json / REVIEW.md by default
(use --with-review to include REVIEW.md).

Usage:
  python sandbox/scripts/collect_run.py --run sandbox/runs/my-model/20260909-120000-USP
  python sandbox/scripts/collect_run.py --run ... --dry-run
  python sandbox/scripts/collect_run.py --run ... --with-review
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (
    ROOT,
    REVIEW_MD,
    RUN_META,
    TASK_MD,
    PROMPT_MD,
    list_deliverables,
    load_meta,
    now_iso,
    primary_html,
    project_rel,
    resolve_project_dir,
    sha256_file,
)


PROTOCOL_KEEP = {TASK_MD, PROMPT_MD, RUN_META, REVIEW_MD, "manifest.json"}


def collect(run_dir: Path, dry_run: bool = False, with_review: bool = False, overwrite: bool = False) -> int:
    run_dir = run_dir.resolve()
    meta = load_meta(run_dir)
    model = meta.get("model") or "unknown-model"
    project_dir = resolve_project_dir(meta.get("project_rel") or meta.get("project"))
    dest = project_dir / model

    # prompt integrity vs formal tree
    formal_prompt = project_dir / PROMPT_MD
    run_prompt = run_dir / PROMPT_MD
    if formal_prompt.is_file() and run_prompt.is_file():
        if sha256_file(formal_prompt) != sha256_file(run_prompt):
            print("ERROR: run PROJECT_PROMPT.md differs from formal tree prompt", file=sys.stderr)
            return 2

    names = list_deliverables(run_dir)
    # always try result.json / log.md even if filter skipped
    for extra in ("result.json", "log.md"):
        if (run_dir / extra).is_file() and extra not in names:
            names.append(extra)
    if with_review and (run_dir / REVIEW_MD).is_file():
        names.append(REVIEW_MD)

    if not names:
        print("ERROR: nothing to collect", file=sys.stderr)
        return 1

    print(f"collect → {project_rel(project_dir)}/{model}/")
    for n in names:
        src = run_dir / n
        dst = dest / n
        print(f"  {n} ({src.stat().st_size} bytes)")
        if dry_run:
            continue
        if dst.exists() and not overwrite:
            # auto-suffix
            stem, suffix, i = dst.stem, dst.suffix, 1
            while dst.exists():
                dst = dest / f"{stem}~{i}{suffix}"
                i += 1
            print(f"    → renamed {dst.name} (target existed)")
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    if not dry_run:
        html = primary_html(run_dir, names)
        note = (
            f"# Migration note\n\n"
            f"- Collected from sandbox run `{meta.get('run_id')}`\n"
            f"- source project: `{meta.get('project_rel')}`\n"
            f"- prompt_sha256: `{meta.get('prompt_sha256')}`\n"
            f"- collected_at: {now_iso()}\n"
            f"- primary_deliverable: `{html.name if html else 'n/a'}`\n"
            f"- review_scope: `{meta.get('review_scope')}`\n"
            f"- verdict: `{meta.get('verdict', 'n/a')}`\n"
        )
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "MIGRATION.md").write_text(note, encoding="utf-8")
        meta["status"] = "collected"
        meta["collected_to"] = project_rel(dest)
        from sandbox_lib import dump_json
        dump_json(run_dir / RUN_META, meta)
        print(f"  wrote MIGRATION.md")

    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Collect sandbox run into formal project tree")
    ap.add_argument("--run", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--with-review", action="store_true", help="Also copy REVIEW.md")
    ap.add_argument("--overwrite", action="store_true", help="Allow overwriting existing files")
    args = ap.parse_args(argv)
    return collect(args.run, dry_run=args.dry_run, with_review=args.with_review, overwrite=args.overwrite)


if __name__ == "__main__":
    raise SystemExit(main())
