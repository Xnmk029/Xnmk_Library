"""Freeze an existing user-selected Godot directory as a separate submission.

Uses the standard prepare and native integrity gates. Source instructions from
an earlier stage stay in host provenance instead of replacing the current task.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from godot_profile import files, integrity
from prepare_run import prepare
from sandbox_lib import ROOT, RUNS, dump_json, now_iso, sha256_file


def import_directory(source: Path, project: str, model: str, source_prompt: str,
                     previous_run: str | None = None):
    source = source.resolve(strict=True)
    if source.is_relative_to(ROOT.resolve()):
        raise RuntimeError("Submission source must be outside the benchmark repository")
    submitted_prompt = source / source_prompt
    if not submitted_prompt.resolve().is_relative_to(source) or not submitted_prompt.is_file():
        raise RuntimeError("Missing source prompt inside submission")
    snapshot = files(source)
    prepared = prepare(project, model)
    meta = prepared["meta"]
    if meta.get("profile") != "native-godot-v1":
        raise RuntimeError("Native Godot profile required")
    work = Path(meta["workdir"])
    harness = RUNS / meta["model"] / meta["run_id"]
    if submitted_prompt.read_bytes() != (work / "PROMPT.md").read_bytes():
        raise RuntimeError("Supplied task does not match registered question")
    protected = set(meta["input_files"])
    for name in protected:
        if (source / name).read_bytes() != (work / name).read_bytes():
            raise RuntimeError("Supplied input differs from registered input: " + name)
    prior_prompt = source / "PROMPT.md"
    prior_descriptor = None
    if prior_prompt.is_file() and prior_prompt.read_bytes() != submitted_prompt.read_bytes():
        shutil.copy2(prior_prompt, harness / "PRIOR_STAGE_PROMPT.md")
        prior_descriptor = {"sha256": sha256_file(prior_prompt), "size": prior_prompt.stat().st_size,
                            "preserved_as": "PRIOR_STAGE_PROMPT.md"}
    for name in snapshot:
        if name in protected:
            continue
        destination = work / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / name, destination)
    if files(source) != snapshot or files(work) != snapshot:
        raise RuntimeError("Source changed during import or copied bytes differ")
    checks = integrity(meta, harness)
    if any(status == "FAIL" for _, status, _ in checks):
        raise RuntimeError("Imported submission integrity failed: " + str(checks))
    record = {"status": "imported", "imported_at": now_iso(), "run_id": meta["run_id"],
              "source_directory": str(source), "source_prompt": source_prompt,
              "prompt_sha256": meta["prompt_sha256"], "input_hashes_match": True,
              "copied_file_hashes_match": True, "source_unchanged": True,
              "ordinary_submission_files": len(snapshot), "ordinary_submission_bytes": sum(v["size"] for v in snapshot.values()),
              "excluded_generated_cache_dirs": [".godot", "__pycache__"],
              "previous_run": previous_run, "prior_stage_prompt": prior_descriptor,
              "actual_development_condition": "continued_in_existing_stage1_directory" if prior_descriptor else "not_independently_verified",
              "fresh_start_verified": False, "model_attribution": "user_context_only",
              "actual_model": None, "actual_reasoning_effort": None, "usage": None,
              "provider_trace_supplied": False, "transcript_supplied": False,
              "source_note": "Current source and earlier-stage instructions preserved separately; no previous validation/identity evidence is reused as this submission's proof.",
              "workdir": str(work), "harness": str(harness), "isolation_verification": "unverified"}
    dump_json(harness / "IMPORT.json", record)
    dump_json(harness / "IMPORTED_SOURCE_SNAPSHOT.json", snapshot)
    meta.update(submission_origin="user_selected_existing_directory", model_identity_verification="unverified",
                associated_previous_run=previous_run, actual_development_condition=record["actual_development_condition"],
                fresh_start_verified=False, execution_status="external_submission_imported")
    dump_json(harness / "meta.json", meta)
    dump_json(RUNS / "LATEST_GODOT_DIRECTORY_IMPORT.json", {"harness": str(harness), "workdir": str(work), "run_id": meta["run_id"]})
    print(json.dumps(record, ensure_ascii=False, indent=2), flush=True)
    return harness


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--project", required=True)
    p.add_argument("--model", required=True)
    p.add_argument("--source-prompt", required=True)
    p.add_argument("--previous-run")
    a = p.parse_args()
    import_directory(a.source, a.project, a.model, a.source_prompt, a.previous_run)
