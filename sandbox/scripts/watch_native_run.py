"""Finish an already-dispatched native Godot run without steering the candidate.

Observes only the selected run. Does not dispatch or retry a model. Existing
review/collection gates remain authoritative, including INVALID rejection.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import time
from pathlib import Path

from sandbox_lib import dump_json, load_json, load_meta, now_iso
from godot_profile import files, review, collect


def finish(harness: Path, timeout: int) -> int:
    harness = harness.resolve()
    meta = load_meta(harness)
    if meta.get("profile") != "native-godot-v1":
        raise RuntimeError("Only registered native Godot runs are supported")
    result_path = harness / "RUN_RESULT.json"
    if result_path.exists():
        raise RuntimeError("Completion result already exists; refusing to replace it")
    dump_json(harness / "COMPLETION_MONITOR.json", {
        "started_at": now_iso(), "status": "waiting_for_execution",
        "model_dispatches": 0, "candidate_changes": 0,
        "timeout_seconds": timeout,
    })
    deadline = time.monotonic() + timeout
    while not (harness / "execution.json").is_file():
        if time.monotonic() >= deadline:
            raise RuntimeError("Monitor timeout; candidate was not stopped or retried")
        time.sleep(5)
    execution = load_json(harness / "execution.json")
    extractor_path = Path(__file__).resolve().parents[1] / "adapters" / "extract_provider_evidence.py"
    spec = importlib.util.spec_from_file_location("native_provider_evidence", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(extractor)
    evidence, extraction_error = extractor.extract(harness)
    transcript = harness / "transcript.txt"
    transcript.write_text("\n".join(
        (harness / name).read_text(encoding="utf-8", errors="replace")
        for name in ("stdout.log", "stderr.log") if (harness / name).is_file()
    ), encoding="utf-8")
    review(harness, transcript_path=transcript)
    meta = load_meta(harness)
    collection_exit = None
    if meta.get("verdict") in {"PASS", "PASS_WITH_WARNINGS", "FAIL"} and execution.get("status") in {"completed", "process_error", "timeout"}:
        collection_exit = collect(harness, with_review=True)
        meta = load_meta(harness)
    snapshot = files(Path(meta["workdir"]))
    dump_json(harness / "SUBMISSION_SNAPSHOT.json", snapshot)
    result = {
        "run_id": meta["run_id"], "finished_at": now_iso(),
        "requested_model": execution.get("requested_model"),
        "requested_effort": execution.get("requested_effort"),
        "provider_evidence": evidence, "provider_evidence_error": extraction_error,
        "execution_status": execution.get("status"),
        "elapsed_seconds": execution.get("elapsed_seconds"),
        "verdict": meta.get("verdict"), "collection_exit": collection_exit,
        "runtime_validation": meta.get("runtime_validation"),
        "visual_score": None, "isolation_verification": "unverified",
        "workdir": meta["workdir"], "harness": str(harness),
        "submission_file_count": len(snapshot),
        "collected_to": meta.get("collected_to"),
        "identity_note": "Runtime model/effort evidence is retained. A server model snapshot is not inferred from the configured alias.",
        "collection_note": "INVALID runs remain in their original workdir and harness; no formal results archive or score is created.",
    }
    dump_json(result_path, result)
    dump_json(harness / "COMPLETION_MONITOR.json", {
        "status": "finished", "finished_at": now_iso(),
        "model_dispatches": 0, "candidate_changes": 0,
        "result": str(result_path),
    })
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--timeout", type=int, default=15000)
    args = parser.parse_args()
    if not 1 <= args.timeout <= 18000:
        parser.error("timeout must be 1..18000")
    raise SystemExit(finish(args.run, args.timeout))
