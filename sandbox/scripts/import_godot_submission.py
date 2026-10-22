"""Register a user-supplied native Godot submission using the standard prepare flow.

Never overlays another run. The supplied archive is provenance, not provider
identity evidence. Integrity and collection still use native Godot gates.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath

from prepare_run import prepare
from sandbox_lib import RUNS, dump_json, load_json, now_iso, sha256_file
from godot_profile import files, integrity


def import_submission(archive: Path, project: str, model: str, previous_run: str | None = None):
    archive = archive.resolve(strict=True)
    archive_hash = sha256_file(archive)
    with zipfile.ZipFile(archive) as z:
        entries = []
        names = set()
        for info in z.infolist():
            name = info.filename
            p = PurePosixPath(name)
            if "\\" in name or p.is_absolute() or ".." in p.parts or ":" in name:
                raise RuntimeError("Unsafe ZIP path: " + name)
            if stat.S_ISLNK(info.external_attr >> 16):
                raise RuntimeError("ZIP symlink is not accepted: " + name)
            if not p.parts or p.parts[0] != "candidate":
                raise RuntimeError("Expected candidate/ archive root: " + name)
            rel = PurePosixPath(*p.parts[1:]).as_posix()
            if info.is_dir() or rel == ".":
                continue
            if rel.casefold() in names:
                raise RuntimeError("Duplicate ZIP destination: " + name)
            names.add(rel.casefold())
            entries.append((info, rel))
        protected = {"PROMPT.md", "STARTER_PROJECT.zip", "SQLITE_DEPENDENCY.zip"}
        prepared = prepare(project, model)
        meta = prepared["meta"]
        if meta.get("profile") != "native-godot-v1":
            raise RuntimeError("A native Godot registration is required")
        work = Path(meta["workdir"])
        harness = RUNS / meta["model"] / meta["run_id"]
        supplied = {rel for _, rel in entries}
        if not protected.issubset(supplied):
            raise RuntimeError("Submission is missing original public inputs")
        for name in protected:
            if z.read("candidate/" + name) != (work / name).read_bytes():
                raise RuntimeError("Submission changed original input: " + name)
        for info, rel in entries:
            if rel in protected:
                continue
            target = work / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as source, target.open("xb") as dest:
                shutil.copyfileobj(source, dest)
        rows = integrity(meta, harness)
        if any(status == "FAIL" for _, status, _ in rows):
            raise RuntimeError("Imported submission integrity failed: " + str(rows))

    evidence = work / "evidence/evidence_manifest.json"
    checks = []
    if evidence.is_file():
        for name, expected in load_json(evidence)["files"].items():
            p = PurePosixPath(name)
            if p.is_absolute() or ".." in p.parts or "\\" in name or ":" in name:
                raise RuntimeError("Unsafe evidence path: " + name)
            path = evidence.parent / name
            actual = {"bytes": path.stat().st_size, "sha256": sha256_file(path)} if path.is_file() else None
            checks.append({"path": name, "passed": actual == expected, "expected": expected, "actual": actual})
    current = files(work)
    provenance = {
        "status": "imported", "imported_at": now_iso(), "run_id": meta["run_id"],
        "source_archive": str(archive), "source_archive_sha256": archive_hash,
        "source_archive_size": archive.stat().st_size, "archive_member_files": len(entries),
        "previous_run": previous_run, "model_attribution": "user_context_only",
        "actual_model": None, "actual_reasoning_effort": None, "usage": None,
        "provider_trace_supplied": False, "transcript_supplied": False,
        "identity_note": "External submission supplied by user; previous CLI runtime identity does not establish this archive's author/model.",
        "input_hashes_match": True, "evidence_manifest_checks": len(checks),
        "evidence_manifest_mismatches": [r for r in checks if not r["passed"]],
        "isolation_verification": "unverified", "workdir": str(work), "harness": str(harness),
    }
    dump_json(harness / "IMPORT.json", provenance)
    dump_json(harness / "IMPORTED_SOURCE_SNAPSHOT.json", current)
    dump_json(harness / "IMPORTED_EVIDENCE_CHECK.json", checks)
    meta.update(submission_origin="user_supplied_external_archive", model_identity_verification="unverified",
                import_source_sha256=archive_hash, associated_previous_run=previous_run,
                execution_status="external_submission_imported")
    dump_json(harness / "meta.json", meta)
    dump_json(harness.parents[1] / "LATEST_GODOT_IMPORT.json", {"harness": str(harness), "workdir": str(work), "run_id": meta["run_id"]})
    print(json.dumps(provenance, ensure_ascii=False, indent=2))
    return harness


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--previous-run")
    args = parser.parse_args()
    import_submission(args.archive, args.project, args.model, args.previous_run)
