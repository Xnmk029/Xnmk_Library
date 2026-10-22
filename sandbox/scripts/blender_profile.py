"""Native Blender input staging, source-preserving inspection and collection."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import uuid

from sandbox_lib import ROOT, PROMPT_FILE, PROMPT_MD, FORBIDDEN_DIR_NAMES, AGENT_STATE_NAMES
from sandbox_lib import load_json, load_meta, dump_json, now_iso, sha256_file, scan_transcript
from vision_profile import no_links, safe_tree, safe_slug
from godot_profile import command, hidden_process, files

PROFILE = "native-blender-v1"


def input_path(project: Path, name: str) -> Path:
    relative = PurePosixPath(name)
    if relative.is_absolute() or ".." in relative.parts or ":" in name or "\\" in name or not name.startswith("references/"):
        raise RuntimeError("Invalid native Blender input path: " + name)
    path = project / name
    if not path.resolve().is_relative_to(project.resolve()):
        raise RuntimeError("Native Blender input escapes project")
    no_links(path)
    return path


def payload(project: Path) -> dict | None:
    registration = project / "BENCH_PROFILE.json"
    if not registration.is_file():
        return None
    no_links(registration)
    config = load_json(registration)
    if config.get("profile") != PROFILE:
        return None
    mode = config.get("input_payload")
    if mode == "prompt_only":
        if config.get("input_files") != {}:
            raise RuntimeError("Text-only Blender profile must have an empty input whitelist")
    elif mode == "prompt_and_locked_references":
        if not isinstance(config.get("input_files"), dict) or not config["input_files"]:
            raise RuntimeError("Blender profile needs an explicit locked reference whitelist")
    else:
        raise RuntimeError("Unsupported Blender input payload")
    for name, expected in config["input_files"].items():
        path = input_path(project, name)
        if not path.is_file() or sha256_file(path) != expected["sha256"] or path.stat().st_size != expected["size"]:
            raise RuntimeError("Registered Blender input changed: " + name)
    return {"profile": PROFILE, "benchmark_id": config["benchmark_id"],
            "engine_version": config["engine_version"], "engine_build": config["engine_build"],
            "engine_executable": config["engine_executable"], "main_file": config["main_file"],
            "input_files": config["input_files"], "profile_config_sha256": sha256_file(registration),
            **{key: config[key] for key in ("expected_dimensions_xyz_mm", "liquid_volume") if key in config},
            "input_payload": config["input_payload"], "runtime_validation": "pending",
            "visual_review": "pending", "isolation_verification": "unverified"}


def stage(project: Path, workdir: Path, profile: dict):
    for name, expected in profile["input_files"].items():
        source = input_path(project, name)
        target = workdir / name
        no_links(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        if sha256_file(target) != expected["sha256"]:
            raise RuntimeError("Input changed during Blender staging: " + name)


def integrity(meta: dict, harness: Path, transcript: str | None = None) -> list[tuple]:
    rows = []
    try:
        workdir = Path(meta["workdir"])
        safe_tree(workdir)
        if workdir.resolve().is_relative_to(ROOT.resolve()):
            raise RuntimeError("workdir is inside repository")
        rows.append(("H1", "PASS", "External workdir; OS access isolation remains unverified"))
        profile = payload(ROOT / meta["project_rel"])
        if not profile or profile["profile_config_sha256"] != meta["profile_config_sha256"] or profile["input_files"] != meta["input_files"]:
            raise RuntimeError("Registered Blender profile changed")
        before = load_json(harness / "snapshot.json")
        expected = {PROMPT_FILE: {"sha256": meta["prompt_sha256"]}, **profile["input_files"]}
        if set(before) != set(expected):
            raise RuntimeError("Initial input snapshot whitelist mismatch")
        if sha256_file(ROOT / meta["project_rel"] / PROMPT_MD) != meta["prompt_sha256"]:
            raise RuntimeError("Formal prompt changed")
        for name, item in expected.items():
            path = workdir / name
            if not path.is_file() or sha256_file(path) != item["sha256"] or before[name]["sha256"] != item["sha256"]:
                raise RuntimeError("Locked input missing or changed: " + name)
        banned = {s.lower() for s in FORBIDDEN_DIR_NAMES | AGENT_STATE_NAMES}
        for path in workdir.rglob("*"):
            if path.name.lower() in banned:
                raise RuntimeError("Forbidden tool/repository state: " + path.name)
        rows.append(("H2", "PASS", "Prompt, registered references and source paths intact"))
    except (OSError, KeyError, ValueError, RuntimeError) as error:
        rows.append(("H2", "FAIL", str(error)))
    hits = scan_transcript(transcript) if transcript is not None else []
    rows.append(("H3", "N/A" if transcript is None else "FAIL" if hits else "PASS",
                 "No tested-session transcript supplied" if transcript is None else str(hits)))
    return rows


def validate(harness: Path, timeout: int = 120) -> int:
    harness = harness.resolve()
    meta = load_meta(harness)
    if meta.get("profile") != PROFILE or any(row[1] == "FAIL" for row in integrity(meta, harness)):
        raise RuntimeError("Invalid native Blender run")
    workdir = Path(meta["workdir"])
    snapshot = files(workdir)
    folder = harness / "blender-validation" / uuid.uuid4().hex[:12]
    folder.mkdir(parents=True)
    result = {"profile": PROFILE, "status": "failed", "source_snapshot": snapshot,
              "validation_dir": str(folder), "started_at": now_iso(),
              "visual_score": None, "isolation_verification": "unverified",
              "scope": "open saved .blend with autoexec disabled + controlled GPU preview"}
    try:
        engine = Path(meta["engine_executable"])
        no_links(engine)
        version = subprocess.check_output([str(engine), "--version"], timeout=15, **hidden_process()).decode("utf-8", "replace")
        if ("Blender " + meta["engine_version"]) not in version or meta["engine_build"] not in version:
            raise RuntimeError("Pinned Blender version/build mismatch")
        main = workdir / meta["main_file"]
        if not main.is_file():
            raise RuntimeError("Missing main file: " + meta["main_file"])
        copied = folder / "project"
        copied.mkdir()
        for name in snapshot:
            target = copied / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(workdir / name, target)
        env = os.environ.copy()
        for key, name in {"BLENDER_USER_CONFIG": "config", "BLENDER_USER_SCRIPTS": "scripts", "BLENDER_USER_DATAFILES": "datafiles", "TEMP": "temp", "TMP": "temp"}.items():
            path = folder / name
            path.mkdir(exist_ok=True)
            env[key] = str(path)
        report = folder / "probe.json"
        screenshot = folder / "preview.png"
        registered = payload(ROOT / meta["project_rel"])
        spec = folder / "inspection-spec.json"
        dump_json(spec, {"expected_xyz_mm": registered.get("expected_dimensions_xyz_mm", [84.3, 124.9, 51.0]), "liquid_volume": registered.get("liquid_volume")})
        result["inspection"] = command([str(engine), "--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", "--python", str(Path(__file__).with_name("blender_inspect.py").resolve()), "--", str(copied / meta["main_file"]), str(report), str(screenshot), str(spec)], copied, folder, "open-render", timeout, env)
        if not result["inspection"]["ok"] or not report.is_file() or not screenshot.is_file():
            raise RuntimeError("Blender open/render failed; retained logs are authoritative")
        result["probe"] = load_json(report)
        if result["probe"]["blender"] != meta["engine_version"] or result["probe"]["build_hash"] != meta["engine_build"] or not result["probe"].get("renderer"):
            raise RuntimeError("Expected native Blender/GPU was not observed")
        if result["probe"]["missing_resources"]:
            raise RuntimeError("Missing or external project resources")
        if files(workdir) != snapshot:
            raise RuntimeError("Source changed during inspection")
        result["status"] = "passed"
        result["screenshot_sha256"] = sha256_file(screenshot)
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        result["error"] = str(error)
    result["finished_at"] = now_iso()
    dump_json(folder / "validation.json", result)
    report_path = harness / "BLENDER_VALIDATION.json"
    dump_json(report_path, result)
    meta.update(runtime_validation=result["status"], blender_validation_dir=str(folder),
                runtime_report_sha256=sha256_file(report_path))
    dump_json(harness / "meta.json", meta)
    print(json.dumps({"status": result["status"], "error": result.get("error"), "report": str(report_path)}, ensure_ascii=False))
    return int(result["status"] != "passed")


def review(harness: Path, strict: bool = False, transcript_path: Path | None = None) -> int:
    meta = load_meta(harness)
    text = transcript_path.read_text(encoding="utf-8", errors="replace") if transcript_path else None
    rows = integrity(meta, harness, text)
    snapshot = {}
    if not any(row[1] == "FAIL" for row in rows):
        snapshot = files(Path(meta["workdir"]))
        if not (harness / "BLENDER_VALIDATION.json").is_file():
            validate(harness)
            meta = load_meta(harness)
        report = load_json(harness / "BLENDER_VALIDATION.json")
        if report["source_snapshot"] != snapshot or sha256_file(harness / "BLENDER_VALIDATION.json") != meta.get("runtime_report_sha256"):
            rows.append(("H4", "FAIL", "Runtime evidence changed or submission snapshot is stale"))
        else:
            rows.append(("B1", "PASS" if report["status"] == "passed" else "FAIL", "Native open/render: " + report["status"]))
            probe = report.get("probe", {})
            if probe:
                rows.append(("B2", "PASS" if probe.get("dimensions_within_3_percent") and probe.get("has_product_collection") else "FAIL", "PRODUCT dimensions XYZ mm: " + str(probe.get("dimensions_xyz_mm"))))
                if probe.get("liquid_volume_check") is not None:
                    liquid = probe["liquid_volume_check"]
                    rows.append(("B3", "PASS" if liquid.get("closed_mesh") and liquid.get("within_tolerance") else "FAIL", "Liquid volume verification: " + str(liquid)))
        rows.append(("V1", "N/A", "Shape, topology, materials and evidence quality require human review; score is null"))
    invalid = any(a.startswith("H") and b == "FAIL" for a, b, _ in rows)
    failed = any(b == "FAIL" for _, b, _ in rows)
    verdict = "INVALID" if invalid else "FAIL" if failed else "PASS_WITH_WARNINGS" if any(b in {"WARN", "N/A"} for _, b, _ in rows) else "PASS"
    meta.update(status="reviewed", reviewed_at=now_iso(), verdict=verdict,
                visual_review="pending", visual_score=None, reviewed_snapshot=snapshot,
                deliverables=list(snapshot), review_checks=[dict(id=a, status=b, detail=c) for a, b, c in rows])
    if transcript_path:
        meta.update(review_transcript=str(transcript_path.resolve()), review_transcript_sha256=sha256_file(transcript_path))
    dump_json(harness / "meta.json", meta)
    table = "\n".join(f"| {a} | {b} | {c} |" for a, b, c in rows)
    (harness / "REVIEW.md").write_text(f"# Native Blender review\n\nVerdict: **{verdict}**. Visual score: **pending**. OS isolation: **unverified**.\n\n| Check | Status | Detail |\n|---|---|---|\n{table}\n", encoding="utf-8")
    print("reviewed native Blender: " + verdict)
    return int(strict and failed)


def collect(harness: Path, dry_run: bool = False, with_review: bool = False, **_) -> int:
    meta = load_meta(harness)
    tp = Path(meta["review_transcript"]) if meta.get("review_transcript") else None
    if tp and (not tp.is_file() or sha256_file(tp) != meta.get("review_transcript_sha256")):
        print("REFUSED: reviewed transcript changed")
        return 3
    rows = integrity(meta, harness, tp.read_text(encoding="utf-8", errors="replace") if tp else None)
    if meta.get("status") not in {"reviewed", "collected"} or meta.get("verdict") not in {"PASS", "PASS_WITH_WARNINGS", "FAIL"} or any(b == "FAIL" for _, b, _ in rows):
        print("REFUSED: unreviewed or invalid native Blender sample")
        return 3
    snapshot = files(Path(meta["workdir"]))
    runtime = harness / "BLENDER_VALIDATION.json"
    if snapshot != meta.get("reviewed_snapshot") or not runtime.is_file() or sha256_file(runtime) != meta.get("runtime_report_sha256") or load_json(runtime)["source_snapshot"] != snapshot:
        print("REFUSED: changed source or stale runtime evidence")
        return 3
    safe_slug(meta["model"])
    safe_slug(meta["run_id"])
    destination = ROOT / meta["project_rel"] / "results" / meta["model"] / meta["run_id"]
    no_links(destination)
    if destination.exists():
        print("REFUSED: archive already exists; never overwrite")
        return 3
    if dry_run:
        print("collect native Blender -> " + str(destination))
        return 0
    submission = destination / "submission"
    submission.mkdir(parents=True)
    for name in snapshot:
        target = submission / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(Path(meta["workdir"]) / name, target)
    if files(submission) != snapshot or files(Path(meta["workdir"])) != snapshot:
        raise RuntimeError("Archive does not match reviewed source")
    for name in (PROMPT_FILE,):
        shutil.copy2(Path(meta["workdir"]) / name, destination / name)
    for name in ("BLENDER_VALIDATION.json", "REVIEW.md", "meta.json", "snapshot.json"):
        shutil.copy2(harness / name, destination / name)
    evidence = destination / "runtime-evidence"
    evidence.mkdir()
    for path in Path(load_json(runtime)["validation_dir"]).iterdir():
        if path.is_file():
            shutil.copy2(path, evidence / path.name)
    dump_json(destination / "source-manifest.json", snapshot)
    dump_json(destination / "archive.json", dict(profile=PROFILE, model=meta["model"], run_id=meta["run_id"], verdict=meta["verdict"], engineering_fixture=bool(meta.get("engineering_fixture")), visual_score=None, isolation_verification="unverified", collected_at=now_iso()))
    meta.update(status="collected", collected_to=str(destination), collected_at=now_iso())
    dump_json(harness / "meta.json", meta)
    print("collected native Blender: " + str(destination))
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()
    if not 1 <= args.timeout <= 600:
        parser.error("timeout must be 1..600")
    raise SystemExit(validate(args.run, args.timeout))
