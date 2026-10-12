# -*- coding: utf-8 -*-
"""Overview of sandbox runs for orchestration agents.

Scans sandbox/runs/<model>/<run_id>/meta.json (harness side) and prints a
table, newest first. Protocol-1.x runs are shown as [deprecated].

Usage:
  python sandbox/scripts/status.py                 # all runs
  python sandbox/scripts/status.py --model my-slug # one model
  python sandbox/scripts/status.py --pending       # not yet reviewed
  python sandbox/scripts/status.py --json          # machine-readable
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import RUNS, RUN_META, load_json  # noqa: E402


def scan_runs(model: str | None = None) -> list[dict]:
    if not RUNS.is_dir():
        return []
    bases = [RUNS / model] if model else [d for d in sorted(RUNS.iterdir()) if d.is_dir()]
    rows = []
    for base in bases:
        if not base.is_dir():
            continue
        for run in sorted(base.iterdir()):
            meta_p = run / RUN_META
            if not run.is_dir() or not meta_p.is_file():
                continue
            try:
                m = load_json(meta_p)
            except (ValueError, OSError):
                m = {}
            proto = m.get("protocol_version", "1.1")
            rows.append({
                "model": m.get("model", base.name),
                "run_id": m.get("run_id", run.name),
                "project": m.get("project_rel") or m.get("project", "?"),
                "protocol": proto,
                "mode": m.get("mode", "dir+discipline"),
                "deprecated": proto != "2.0",
                "status": m.get("status", "?"),
                "verdict": m.get("verdict", "-"),
                "profile": m.get("profile"),
                "runtime_validation": m.get("runtime_validation"),
                "visual_review": m.get("visual_review"),
                "isolation_verification": m.get("isolation_verification", "unverified"),
                "workdir": m.get("workdir", run.as_posix()),
                "created_at": m.get("created_at", "-"),
                "run_dir": run.as_posix(),
            })
    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Sandbox runs overview")
    ap.add_argument("--model", help="Filter by model slug")
    ap.add_argument("--pending", action="store_true", help="Only runs not yet reviewed")
    ap.add_argument("--json", action="store_true", help="Machine-readable output")
    args = ap.parse_args(argv)

    rows = scan_runs(args.model)
    if args.pending:
        rows = [r for r in rows if r["status"] == "prepared"]

    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    if not rows:
        print("(no runs)", file=sys.stderr)
        return 0
    head = ("MODEL", "RUN_ID", "PROJECT", "MODE", "STATUS", "VERDICT", "CREATED")
    data = [head] + [
        (r["model"],
         r["run_id"] + (" [deprecated]" if r["deprecated"] else ""),
         r["project"], r["mode"], r["status"], r["verdict"], r["created_at"][:19])
        for r in rows
    ]
    w = [max(len(str(row[i])) for row in data) for i in range(len(head))]
    for i, row in enumerate(data):
        line = "  ".join(str(c).ljust(w[j]) for j, c in enumerate(row))
        print(line if i else line + "\n" + "  ".join("-" * x for x in w))
    print(f"# {len(rows)} run(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
