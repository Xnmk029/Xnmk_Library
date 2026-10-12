# -*- coding: utf-8 -*-
"""Prepare an isolated sandbox run — protocol 2.0 "bare" mode.

Creates two trees:
  workdir   <RUNS_ROOT>/<model>/<run_id>/       tested model sees ONLY this
      PROMPT.md                                   verbatim PROJECT_PROMPT copy
  harness   sandbox/runs/<model>/<run_id>/      orchestrator/reviewer only
      meta.json                                   run metadata (incl. workdir)
      snapshot.json                               workdir hashes at prepare

The tested model gets no discipline text, no contract, no rubric summary,
no result.json requirement — just the prompt and a one-line dispatch note.

Usage:
  python sandbox/scripts/prepare_run.py --list
  python sandbox/scripts/prepare_run.py --project USP --model my-model-slug
  python sandbox/scripts/prepare_run.py --project USP --model m1 --dry-run
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (  # noqa: E402
    PROMPT_FILE,
    PROMPT_MD,
    PROTOCOL_VERSION,
    ROOT,
    RUN_META,
    RUNS,
    RUNS_ROOT,
    SNAPSHOT,
    build_dispatch_text,
    discover_projects,
    dump_json,
    extract_requirements,
    new_run_id,
    now_iso,
    project_rel,
    resolve_project_dir,
    sha256_file,
    snapshot_dir,
)


def prepare(project_arg: str, model: str, dry_run: bool = False) -> dict:
    from vision_profile import safe_slug, no_links, payload, stage
    safe_slug(model)
    project_dir = resolve_project_dir(project_arg)
    profile = payload(project_dir)
    if not profile:
        from godot_profile import payload as godot_payload
        profile = godot_payload(project_dir)
    rel = project_rel(project_dir)
    prompt_path = project_dir / PROMPT_MD
    prompt_sha = sha256_file(prompt_path)
    req = extract_requirements(prompt_path.read_text(encoding="utf-8"))

    run_id = new_run_id(model, project_dir.name)
    workdir = RUNS_ROOT / model / run_id
    harness = RUNS / model / run_id
    no_links(workdir)
    no_links(harness)
    if workdir.resolve().is_relative_to(ROOT.resolve()):
        raise RuntimeError("workdir must be outside repository")

    info = {
        "run_id": run_id,
        "model": model,
        "project": project_dir.name,
        "project_rel": rel,
        "workdir": str(workdir),
        "harness": str(harness),
        "prompt_sha256": prompt_sha,
        "n_delivery_lines": len(req["delivery"]),
        "n_limit_lines": len(req["limits"]),
    }

    if dry_run:
        print(f"[dry-run] would create")
        print(f"  workdir : {workdir}")
        print(f"  harness : {harness}")
        for k, v in info.items():
            if k not in ("workdir", "harness"):
                print(f"  {k}={v}")
        return info

    workdir.mkdir(parents=True, exist_ok=False)
    harness.mkdir(parents=True, exist_ok=False)

    (workdir / PROMPT_FILE).write_bytes(prompt_path.read_bytes())
    if profile and profile.get("profile") == "bare-vision-v1":
        stage(project_dir, workdir, profile)

    meta = {
        "run_id": run_id,
        "model": model,
        "project": project_dir.name,
        "project_rel": rel,
        "created_at": now_iso(),
        "prompt_sha256": prompt_sha,
        "prompt_source": rel + "/" + PROMPT_MD,
        "protocol_version": PROTOCOL_VERSION,
        "mode": "bare",
        "isolation": "external-empty-dir+observation",
        "workdir": str(workdir),
        "review_scope": "project_prompt_only",
        "status": "prepared",
    }
    if profile:
        meta.update(profile)
    dump_json(harness / RUN_META, meta)
    dump_json(harness / SNAPSHOT, snapshot_dir(workdir))

    print(f"prepared(bare): {run_id}")
    print(f"  workdir : {workdir}   ← 受测模型的工作区（题面及已登记的输入文件）")
    print(f"  harness : {harness.relative_to(ROOT).as_posix()}")
    print(f"  dispatch prompt ↓")
    print("  " + "-" * 56)
    for line in build_dispatch_text(project_dir.name, workdir).splitlines():
        print("  " + line)
    print("  " + "-" * 56)
    return {"meta": meta, "dispatch_text": build_dispatch_text(project_dir.name, workdir)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Prepare isolated sandbox run (bare mode)")
    ap.add_argument("--project", help="Project name or path, e.g. USP or L3_Advanced/USP")
    ap.add_argument("--model", default="anon", help="Model slug (runs root <model>/<run_id>, default: anon)")
    ap.add_argument("--list", action="store_true", help="List all discoverable projects")
    ap.add_argument("--dry-run", action="store_true", help="Validate and print without writing")
    args = ap.parse_args(argv)

    if args.list:
        rows = discover_projects()
        for r in rows:
            print(f"{r['rel']}\t{r['prompt_sha256'][:12]}")
        print(f"# {len(rows)} projects", file=sys.stderr)
        return 0

    if not args.project:
        ap.error("--project is required (or use --list)")

    try:
        prepare(args.project, args.model, dry_run=args.dry_run)
        return 0
    except (FileNotFoundError, RuntimeError, FileExistsError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
