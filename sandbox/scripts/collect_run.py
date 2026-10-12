# -*- coding: utf-8 -*-
"""Collect a reviewed sandbox run into the formal project tree — protocol 2.0.

Copies deliverables from the external workdir to <project>/<model-slug>/,
normalizing a lone primary deliverable to answer.<ext> (original names are
recorded in MIGRATION.md).

Gate: only PASS / PASS_WITH_WARNINGS are collected; FAIL / INVALID /
unreviewed runs are refused (exit 3). --force overrides and is logged.

Usage:
  python sandbox/scripts/collect_run.py --run sandbox/runs/<model>/<run_id>
  python sandbox/scripts/collect_run.py --run ... --dry-run
  python sandbox/scripts/collect_run.py --run ... --with-review
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (  # noqa: E402
    PROMPT_FILE,
    PROMPT_MD,
    REVIEW_MD,
    ROOT,
    RUN_META,
    dump_json,
    list_deliverables,
    load_meta,
    normalize_deliverable,
    now_iso,
    primary_html,
    project_rel,
    resolve_project_dir,
    sha256_file,
    workdir_of,
)

COLLECTABLE_VERDICTS = {"PASS", "PASS_WITH_WARNINGS"}


def collect(harness_dir: Path, dry_run: bool = False, with_review: bool = False,
            overwrite: bool = False, force: bool = False) -> int:
    harness_dir = harness_dir.resolve()
    meta = load_meta(harness_dir)
    if meta.get("protocol_version") != "2.0":
        print(f"ERROR: run 为旧协议 {meta.get('protocol_version', '1.x')}，"
              f"已标记 deprecated，不再收卷。", file=sys.stderr)
        return 4

    if meta.get("profile") == "bare-vision-v1":
        from vision_profile import collect as vision_collect
        return vision_collect(harness_dir, dry_run=dry_run, with_review=with_review,
                              overwrite=overwrite, force=force)
    if meta.get("profile") == "legacy-vision-explore-v1":
        from legacy_vision import collect as legacy_collect
        return legacy_collect(harness_dir, dry_run=dry_run)
    if meta.get("profile") == "native-godot-v1":
        from godot_profile import collect as godot_collect
        return godot_collect(harness_dir, dry_run=dry_run, with_review=with_review,
                             overwrite=overwrite, force=force)

    model = meta.get("model") or "unknown-model"
    project_dir = resolve_project_dir(meta.get("project_rel") or meta.get("project"))
    dest = project_dir / model
    workdir = workdir_of(meta)

    verdict = meta.get("verdict")
    if verdict not in COLLECTABLE_VERDICTS:
        reason = f"verdict={verdict!r}" if verdict else f"status={meta.get('status')!r}（未审阅）"
        if not force:
            print(f"ERROR: run 不满足收卷条件（{reason}）；"
                  f"仅 PASS / PASS_WITH_WARNINGS 可入库。确需强收请显式加 --force。", file=sys.stderr)
            return 3
        print(f"WARN: --force 绕过 verdict 闸门（{reason}）", file=sys.stderr)

    # prompt integrity: workdir prompt must still match the formal tree
    formal_prompt = project_dir / PROMPT_MD
    run_prompt = workdir / PROMPT_FILE
    if formal_prompt.is_file() and run_prompt.is_file():
        if sha256_file(formal_prompt) != sha256_file(run_prompt):
            print("ERROR: workdir PROMPT.md differs from formal tree prompt", file=sys.stderr)
            return 2

    names = list_deliverables(workdir)
    if with_review and (harness_dir / REVIEW_MD).is_file():
        pass  # review file lives in harness dir, handled below
    if not names:
        print("ERROR: nothing to collect", file=sys.stderr)
        return 1

    # normalize: lone primary deliverable → answer.<ext>; extras keep names
    renames: dict[str, str] = {}
    primary_set = False
    for n in names:
        norm = normalize_deliverable(n)
        if norm != Path(n).name and not primary_set:
            renames[n] = norm
            primary_set = True
        else:
            renames[n] = Path(n).name

    print(f"collect → {project_rel(project_dir)}/{model}/")
    for n in names:
        src = workdir / n
        dst_name = renames[n]
        print(f"  {n} → {dst_name} ({src.stat().st_size} bytes)")
        if dry_run:
            continue
        dst = dest / dst_name
        if dst.exists() and not overwrite:
            stem, suffix, i = dst.stem, dst.suffix, 1
            while dst.exists():
                dst = dest / f"{stem}~{i}{suffix}"
                i += 1
            print(f"    → renamed {dst.name} (target existed)")
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    if with_review and (harness_dir / REVIEW_MD).is_file() and not dry_run:
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(harness_dir / REVIEW_MD, dest / REVIEW_MD)
        print(f"  + {REVIEW_MD} (from harness dir)")

    if not dry_run:
        html = primary_html(workdir, names)
        note = (
            f"# Migration note\n\n"
            f"- Collected from sandbox run `{meta.get('run_id')}`\n"
            f"- source project: `{meta.get('project_rel')}`\n"
            f"- protocol: `{meta.get('protocol_version')}` ({meta.get('mode')})\n"
            f"- workdir: `{meta.get('workdir')}`\n"
            f"- prompt_sha256: `{meta.get('prompt_sha256')}`\n"
            f"- collected_at: {now_iso()}\n"
            f"- primary_deliverable: `{html.name if html else 'n/a'}`\n"
            f"- deliverable_map: `{renames}`\n"
            f"- review_scope: `{meta.get('review_scope')}`\n"
            f"- verdict: `{meta.get('verdict', 'n/a')}`\n"
            + (f"- **force-collected**: verdict gate bypassed\n" if force else "")
        )
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "MIGRATION.md").write_text(note, encoding="utf-8")
        meta["status"] = "collected"
        meta["collected_to"] = project_rel(dest)
        meta["deliverable_map"] = renames
        dump_json(harness_dir / RUN_META, meta)
        print("  wrote MIGRATION.md")

    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Collect sandbox run into formal project tree")
    ap.add_argument("--run", type=Path, required=True, help="Harness run dir")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--with-review", action="store_true", help="Also copy REVIEW.md")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--force", action="store_true", help="Bypass the verdict gate (logged)")
    args = ap.parse_args(argv)
    return collect(args.run, dry_run=args.dry_run, with_review=args.with_review,
                   overwrite=args.overwrite, force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
