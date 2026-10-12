# -*- coding: utf-8 -*-
"""Generic multi-topic bare suite: prepare -> parallel CLI dispatch -> review/collect.

The generic sibling of vision_suite.py: vision_suite is locked to the
PairedVision release and dispatches sequentially; this runner works for any
L1-L4 project set and dispatches through a local CLI adapter in parallel.

Adapter contract (identical to vision_suite.execute):
  argv           nonempty string array; substitutions {workdir} {harness} {prompt} {prompt_file}
  prompt_via     "argv" | "stdin"
  fresh_session  must be true (one fresh process per run, never resumed)
  wall_seconds   1..14400
  requested_model / requested_effort   declarations recorded in execution.json

Usage:
  python sandbox/scripts/cli_suite.py prepare  --model grok-4.7 --projects DoubleWishbone,USP
  python sandbox/scripts/cli_suite.py execute  --model grok-4.7 --adapter sandbox/adapters/grok-4.7-build-cli.json --jobs 6
  python sandbox/scripts/cli_suite.py finalize --model grok-4.7 [--collect]
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (  # noqa: E402
    RUNS,
    build_dispatch_text,
    dump_json,
    load_json,
    load_meta,
    now_iso,
    sha256_file,
    snapshot_dir,
)
from vision_profile import no_links, safe_slug  # noqa: E402
from prepare_run import prepare  # noqa: E402
from review_run import review  # noqa: E402
from collect_run import collect  # noqa: E402


def suite_file(model: str) -> Path:
    return RUNS / model / ("suite-" + model + ".json")


def run_dirs(model: str) -> list:
    base = RUNS / model
    if not base.is_dir():
        return []
    return [d for d in sorted(base.iterdir()) if d.is_dir() and (d / "meta.json").is_file()]


def entry_of(meta: dict) -> dict:
    return {
        "project": meta["project"],
        "run_id": meta["run_id"],
        "workdir": meta["workdir"],
        "harness": str(RUNS / meta["model"] / meta["run_id"]),
        "prompt_sha256": meta["prompt_sha256"],
        "dispatch": build_dispatch_text(meta["project"], Path(meta["workdir"])),
    }


def prepare_suite(model: str, projects: list) -> Path:
    safe_slug(model)
    entries = []
    for p in projects:
        r = prepare(p, model)
        entries.append(entry_of(r["meta"]))
    out = suite_file(model)
    dump_json(out, {"suite": "bare-multitopic", "protocol": "2.0", "model_slug": model,
                    "created_at": now_iso(), "fresh_context_per_run": True,
                    "status": "prepared", "runs": entries})
    out.with_suffix(".md").write_text(
        "# dispatch list (orchestrator only)\n\n" + "\n\n".join(
            "## " + e["project"] + "\n\n" + e["dispatch"] for e in entries),
        encoding="utf-8")
    print("SUITE=" + str(out))
    return out


def record_suite(model: str, dirs: list) -> Path:
    """Snapshot the discovered prepared runs as suite evidence before dispatch."""
    out = suite_file(model)
    dump_json(out, {"suite": "bare-multitopic", "protocol": "2.0", "model_slug": model,
                    "created_at": now_iso(), "fresh_context_per_run": True,
                    "status": "dispatched",
                    "runs": [entry_of(load_meta(h)) for h in dirs]})
    return out


def execute(model: str, adapter: Path, jobs: int = 6, wall: int | None = None,
            only: list | None = None) -> int:
    spec = load_json(adapter)
    if spec.get("fresh_session") is not True or spec.get("prompt_via") not in {"stdin", "argv"}:
        raise RuntimeError("adapter must declare fresh_session=true and prompt_via=stdin|argv")
    argv_tpl = spec.get("argv")
    if not isinstance(argv_tpl, list) or not argv_tpl or not all(isinstance(a, str) for a in argv_tpl):
        raise RuntimeError("adapter argv must be a nonempty string array")
    wall_s = wall or spec.get("wall_seconds", 1800)
    if type(wall_s) is not int or not 1 <= wall_s <= 14400:
        raise RuntimeError("wall_seconds must be 1..14400")

    all_runs = run_dirs(model)
    pending = [h for h in all_runs if not (h / "execution.json").exists()]
    if only:
        wanted = {x.strip() for x in only if x.strip()}
        pending = [h for h in pending if load_meta(h)["project"] in wanted]
    if not pending:
        print("nothing pending for " + model)
        return 0
    print("SUITE=" + str(record_suite(model, all_runs)))
    adapter_sha = sha256_file(adapter)

    def one(h: Path):
        meta = load_meta(h)
        wd = Path(meta["workdir"])
        no_links(wd)
        if snapshot_dir(wd) != load_json(h / "snapshot.json"):
            raise RuntimeError("workspace changed before execution: " + meta["project"])
        dispatch = build_dispatch_text(meta["project"], wd)
        argv = []
        for a in argv_tpl:
            a = a.replace("{workdir}", str(wd)).replace("{harness}", str(h))
            a = a.replace("{prompt_file}", str(wd / "PROMPT.md")).replace("{prompt}", dispatch)
            argv.append(a)
        rec = {
            "execution_profile": "agent-tools",
            "adapter": str(adapter),
            "adapter_sha256": adapter_sha,
            "requested_model": spec.get("requested_model"),
            "requested_effort": spec.get("requested_effort"),
            "max_output_tokens": spec.get("max_output_tokens"),
            "wall_seconds": wall_s,
            "actual_model": None,
            "usage": None,
            "finish_reason": None,
            "identity_note": "Requested values are adapter declarations; actual identity/usage come from the provider trace in stdout.log.",
            "isolation_verification": "unverified",
            "prompt_chars": len(dispatch),
            "started_at": now_iso(),
        }
        start = time.monotonic()
        with (h / "stdout.log").open("wb") as so, (h / "stderr.log").open("wb") as se:
            try:
                proc = subprocess.Popen(
                    argv, cwd=str(wd), shell=False,
                    stdin=subprocess.PIPE if spec["prompt_via"] == "stdin" else subprocess.DEVNULL,
                    stdout=so, stderr=se)
                try:
                    data = dispatch.encode("utf-8") if spec["prompt_via"] == "stdin" else b""
                    proc.communicate(data, timeout=wall_s)
                    rec.update(status="completed" if proc.returncode == 0 else "process_error",
                               exit_code=proc.returncode)
                except subprocess.TimeoutExpired:
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                                       capture_output=True)
                        proc.kill()
                    else:
                        proc.kill()
                    try:
                        proc.wait(timeout=10)
                    except Exception:  # noqa: BLE001
                        pass
                    rec.update(status="timeout", exit_code=proc.returncode)
            except OSError as e:
                rec.update(status="launch_error", error=str(e), exit_code=None)
        rec["elapsed_seconds"] = round(time.monotonic() - start, 3)
        dump_json(h / "execution.json", rec)
        m2 = load_meta(h)
        m2["execution_status"] = rec["status"]
        m2["executed_at"] = now_iso()
        dump_json(h / "meta.json", m2)
        return rec["status"], meta["project"], rec["elapsed_seconds"]

    with ThreadPoolExecutor(max_workers=max(1, jobs)) as ex:
        for status, project, secs in ex.map(one, pending):
            print("dispatch " + project + " " + status + " " + str(secs), flush=True)
    return 0


def finalize(model: str, do_collect: bool = False) -> int:
    rows = []
    for h in run_dirs(model):
        traces = [h / n for n in ("stdout.log", "stderr.log") if (h / n).is_file()]
        transcript = None
        if traces:
            transcript = h / "transcript.txt"
            transcript.write_text(
                "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in traces),
                encoding="utf-8")
        meta = load_meta(h)
        if not meta.get("verdict"):
            review(h, strict=False, transcript_path=transcript)
            meta = load_meta(h)
        ex = load_json(h / "execution.json") if (h / "execution.json").is_file() else {}
        collect_exit = None
        native_terminal = meta.get("profile") == "native-godot-v1" and meta["verdict"] in {"PASS", "PASS_WITH_WARNINGS", "FAIL"} and ex.get("status") in {"completed", "process_error", "timeout"}
        if native_terminal or (meta["verdict"] in {"PASS", "PASS_WITH_WARNINGS"} and ex.get("status") == "completed"):
            collect_exit = collect(h, dry_run=not do_collect)
        elif meta["verdict"] in {"PASS", "PASS_WITH_WARNINGS"}:
            print("  gate: verdict " + str(meta["verdict"]) + " but execution_status="
                  + str(ex.get("status")) + " -> NOT collectable")
        rows.append({
            "project": meta["project"], "run_id": meta["run_id"], "verdict": meta["verdict"],
            "workdir": meta["workdir"], "harness": str(h),
            "deliverables": meta.get("deliverables"),
            "review_checks": meta.get("review_checks"),
            "execution_status": ex.get("status"),
            "elapsed_seconds": ex.get("elapsed_seconds"),
            "requested_model": ex.get("requested_model"),
            "profile": meta.get("profile"),
            "runtime_validation": meta.get("runtime_validation"),
            "visual_review": meta.get("visual_review"),
            "isolation_verification": meta.get("isolation_verification", "unverified"),
            "collect_exit": collect_exit,
        })
    out = suite_file(model).with_name("suite-" + model + "-results.json")
    dump_json(out, {"suite": "bare-multitopic", "model_slug": model, "runs": rows})
    print("RESULTS=" + str(out))
    for r in rows:
        print("  " + r["project"] + " | " + str(r["verdict"]) + " | " + str(r["execution_status"])
              + " | " + str(r["elapsed_seconds"]) + "s | " + str(r["deliverables"]))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="command", required=True)
    p = sub.add_parser("prepare")
    p.add_argument("--model", required=True)
    p.add_argument("--projects", required=True)
    p = sub.add_parser("execute")
    p.add_argument("--model", required=True)
    p.add_argument("--adapter", type=Path, required=True)
    p.add_argument("--jobs", type=int, default=6)
    p.add_argument("--wall", type=int, default=None)
    p.add_argument("--only", default=None, help="comma-separated project names to dispatch")
    p = sub.add_parser("finalize")
    p.add_argument("--model", required=True)
    p.add_argument("--collect", action="store_true")
    args = ap.parse_args()
    if args.command == "prepare":
        prepare_suite(args.model, [x.strip() for x in args.projects.split(",") if x.strip()])
        return 0
    if args.command == "execute":
        return execute(args.model, args.adapter, args.jobs, args.wall,
                       args.only.split(",") if args.only else None)
    return finalize(args.model, args.collect)


if __name__ == "__main__":
    raise SystemExit(main())
