"""Native Godot project profile. Host-side validation, source-preserving collection.

No model inference, no visual scores, and no claim of OS access isolation.
Validation runs a disposable copy so editor imports cannot change the submission.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path

from sandbox_lib import (
    ROOT, PROMPT_FILE, PROMPT_MD, FORBIDDEN_DIR_NAMES, AGENT_STATE_NAMES,
    load_json, load_meta, dump_json, now_iso, sha256_file, scan_transcript,
)
from vision_profile import safe_tree, no_links, safe_slug

PROFILE = "native-godot-v1"
REGISTRATION = "BENCH_PROFILE.json"
CACHE_DIRS = {".godot", "__pycache__"}
ERROR_PATTERN = re.compile(r"(?m)^(?:SCRIPT ERROR:|SHADER ERROR:|ERROR:)")


def payload(project: Path) -> dict | None:
    path = project / REGISTRATION
    if not path.is_file():
        return None
    no_links(path)
    config = load_json(path)
    if config.get("profile") != PROFILE:
        return None
    if config.get("input_payload") != "prompt_only":
        raise RuntimeError("native Godot profile currently accepts prompt-only input")
    return {
        "profile": PROFILE,
        "benchmark_id": config["benchmark_id"],
        "engine_version": config["engine_version"],
        "renderer": config["renderer"],
        "profile_config_sha256": sha256_file(path),
        "isolation_verification": "unverified",
        "visual_review": "pending",
        "runtime_validation": "pending",
    }


def files(workdir: Path) -> dict:
    """Every ordinary submitted file, including unknown/binary dependencies."""
    safe_tree(workdir)
    result = {}
    for path in sorted(workdir.rglob("*")):
        relative = path.relative_to(workdir)
        if not path.is_file() or any(part.lower() in CACHE_DIRS for part in relative.parts):
            continue
        if relative.as_posix() == PROMPT_FILE:
            continue
        result[relative.as_posix()] = {"sha256": sha256_file(path), "size": path.stat().st_size}
    return result


def projects(workdir: Path, snapshot: dict) -> list[Path]:
    return [workdir / name for name in snapshot if Path(name).name == "project.godot"]


def integrity(meta: dict, harness: Path, transcript: str | None = None) -> list[tuple]:
    rows = []
    workdir = Path(meta["workdir"])
    try:
        safe_tree(workdir)
        if workdir.resolve().is_relative_to(ROOT.resolve()):
            raise RuntimeError("workdir is inside the benchmark repository")
        rows.append(("H1", "PASS", "External workdir; this is not an OS permission verdict."))
        before = load_json(harness / "snapshot.json")
        if set(before) != {PROMPT_FILE}:
            raise RuntimeError("prepare snapshot must contain exactly the original prompt")
        prompt = workdir / PROMPT_FILE
        if not prompt.is_file() or sha256_file(prompt) != meta["prompt_sha256"] or sha256_file(prompt) != before[PROMPT_FILE]["sha256"]:
            raise RuntimeError("original PROMPT.md was modified or removed")
        registration = payload(ROOT / meta["project_rel"])
        if not registration or registration["profile_config_sha256"] != meta["profile_config_sha256"]:
            raise RuntimeError("registered profile changed after preparation")
        if sha256_file(ROOT / meta["project_rel"] / PROMPT_MD) != meta["prompt_sha256"]:
            raise RuntimeError("formal prompt changed after preparation")
        banned = {value.lower() for value in FORBIDDEN_DIR_NAMES | AGENT_STATE_NAMES}
        for path in workdir.rglob("*"):
            if path.name.lower() in banned:
                raise RuntimeError("forbidden repository/tool state entry: " + path.name)
        rows.append(("H2", "PASS", "Prompt/profile hashes intact; no links or forbidden tool state."))
    except (OSError, ValueError, KeyError, RuntimeError) as exc:
        rows.append(("H2", "FAIL", str(exc)))
    if transcript is None:
        rows.append(("H3", "N/A", "No tested-session transcript supplied."))
    else:
        hits = scan_transcript(transcript)
        rows.append(("H3", "FAIL" if hits else "PASS", str(hits) if hits else "No repository-path tokens observed."))
    return rows


def resolve_engine(path: str | None, expected: str) -> Path:
    choices = [path, os.environ.get("GODOT4_EXE"),
               str(ROOT.parent / "bench-probes/godot-4.5.1/Godot_v4.5.1-stable_win64_console.exe"),
               shutil.which("godot"), shutil.which("godot4")]
    for value in choices:
        if value and Path(value).is_file():
            executable = Path(value).resolve()
            version = subprocess.run([str(executable), "--version"], capture_output=True, timeout=15,
                                     **hidden_process()).stdout.decode("utf-8", "replace").strip()
            if not version.startswith(expected + ".") and version != expected:
                raise RuntimeError(f"Godot version mismatch: expected {expected}, found {version}")
            return executable
    raise RuntimeError("Godot not found; pass --godot or set GODOT4_EXE")


def hidden_process() -> dict:
    if os.name != "nt":
        return {}
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = 0
    return {"startupinfo": startup, "creationflags": subprocess.CREATE_NO_WINDOW}


def command(argv: list[str], cwd: Path, folder: Path, label: str, timeout: int,
            environment: dict) -> dict:
    started = time.monotonic()
    with (folder / (label + ".stdout.log")).open("wb") as stdout, (folder / (label + ".stderr.log")).open("wb") as stderr:
        process = subprocess.Popen(argv, cwd=cwd, env=environment, stdout=stdout, stderr=stderr,
                                   stdin=subprocess.DEVNULL, **hidden_process())
        dump_json(folder / "active-process.json", {"pid": process.pid, "stage": label, "started_at": now_iso()})
        timed_out = False
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True,
                               **hidden_process())
            else:
                process.kill()
            process.wait(timeout=15)
    dump_json(folder / "active-process.json", {"pid": process.pid, "stage": label,
                                               "finished": True, "finished_at": now_iso()})
    output = "\n".join((folder / (label + suffix)).read_text(encoding="utf-8", errors="replace")
                       for suffix in [".stdout.log", ".stderr.log"])
    return {"argv": argv, "exit_code": process.returncode, "timeout": timed_out,
            "elapsed_seconds": round(time.monotonic() - started, 3),
            "engine_errors": ERROR_PATTERN.findall(output),
            "ok": process.returncode == 0 and not timed_out and not ERROR_PATTERN.search(output)}


def validate(harness: Path, godot: str | None = None, timeout: int = 120,
             frames: int = 90) -> int:
    harness = harness.resolve()
    meta = load_meta(harness)
    if meta.get("profile") != PROFILE:
        raise RuntimeError("run is not registered for native Godot validation")
    rows = integrity(meta, harness)
    if any(row[1] == "FAIL" for row in rows):
        raise RuntimeError("Run integrity failed before Godot startup: " + str(rows))
    workdir = Path(meta["workdir"])
    snapshot = files(workdir)
    folder = harness / "godot-validation" / uuid.uuid4().hex[:12]
    folder.mkdir(parents=True, exist_ok=False)
    result = {"profile": PROFILE, "status": "failed", "source_snapshot": snapshot,
              "isolation_verification": "unverified", "visual_score": None,
              "requirements_verified": False, "validation_dir": str(folder),
              "started_at": now_iso(), "scope": "engine import + actual GPU main-scene boot"}
    try:
        roots = projects(workdir, snapshot)
        if len(roots) != 1:
            raise RuntimeError(f"Need exactly one project.godot; found {len(roots)}")
        executable = resolve_engine(godot, meta["engine_version"])
        result["engine_executable"] = str(executable)
        copied = folder / "project"
        copied.mkdir()
        for name in snapshot:
            destination = copied / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(workdir / name, destination)
        project = copied / roots[0].parent.relative_to(workdir)
        user_dir_name = "BenchRuns/" + meta["model"] + "/" + meta["run_id"] + "/" + folder.name
        override = project / "override.cfg"
        prefix = override.read_text(encoding="utf-8") if override.exists() else ""
        source_config = (project / "project.godot").read_text(encoding="utf-8") + "\n" + prefix
        keys = {"config/use_custom_user_dir", "config/custom_user_dir_name"}
        keys.update(re.findall(r"(?m)^\s*(config/(?:use_custom_user_dir|custom_user_dir_name)(?:\.[^=\s]+)?)\s*=", source_config))
        settings = "\n".join(key + "=" + ("true" if key.startswith("config/use_custom_user_dir") else json.dumps(user_dir_name)) for key in sorted(keys))
        override.write_text(prefix + '\n[application]\n' + settings + '\n', encoding="utf-8")
        result["runtime_override"] = {"use_custom_user_dir": True, "custom_user_dir_name": user_dir_name}
        environment = os.environ.copy()
        temp_dir = folder / "temp"
        temp_dir.mkdir()
        environment["TEMP"] = str(temp_dir)
        environment["TMP"] = str(temp_dir)
        base = [str(executable), "--path", str(project)]
        result["import"] = command(base + ["--headless", "--editor", "--import", "--quit"],
                                   project, folder, "import", timeout, environment)
        if not result["import"]["ok"]:
            raise RuntimeError("Godot import failed; inspect retained engine logs")
        screenshot = folder / "preview.png"
        probe_report = folder / "probe.json"
        probe = Path(__file__).with_name("godot_probe.gd").resolve()
        result["gpu"] = command(base + ["--rendering-method", meta["renderer"], "--resolution", "1280x720",
                                 "--disable-vsync", "--max-fps", "60", "--script", str(probe), "--",
                                 "--bench-output=" + screenshot.as_posix(),
                                 "--bench-report=" + probe_report.as_posix(), "--bench-frames=" + str(frames)],
                                project, folder, "gpu", timeout, environment)
        if not result["gpu"]["ok"] or not probe_report.is_file() or not screenshot.is_file():
            raise RuntimeError("GPU boot did not produce a clean report and screenshot")
        probe_data = load_json(probe_report)
        result["probe"] = probe_data
        if not probe_data.get("screenshot_saved") or probe_data.get("renderer") != meta["renderer"] or not probe_data.get("adapter"):
            raise RuntimeError("Expected actual GPU/rendering backend was not observed")
        user_dir = str(probe_data["user_data_dir"]).replace("\\", "/")
        if not user_dir.rstrip("/").endswith(user_dir_name):
            raise RuntimeError("Godot user data directory did not use the run-specific override")
        if files(workdir) != snapshot:
            raise RuntimeError("Submission changed during validation")
        result["status"] = "passed"
        result["screenshot_sha256"] = sha256_file(screenshot)
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as exc:
        result["error"] = str(exc)
    result["finished_at"] = now_iso()
    dump_json(folder / "validation.json", result)
    dump_json(harness / "GODOT_VALIDATION.json", result)
    meta["runtime_validation"] = result["status"]
    meta["godot_validation_dir"] = str(folder)
    dump_json(harness / "meta.json", meta)
    print(json.dumps({"status": result["status"], "report": str(harness / "GODOT_VALIDATION.json"),
                      "error": result.get("error"), "visual_score": None}, ensure_ascii=False))
    return 0 if result["status"] == "passed" else 1


def review(harness: Path, strict: bool = False, transcript_path: Path | None = None) -> int:
    meta = load_meta(harness)
    transcript = transcript_path.read_text(encoding="utf-8", errors="replace") if transcript_path else None
    rows = integrity(meta, harness, transcript)
    snapshot = {}
    if not any(row[1] == "FAIL" for row in rows):
        snapshot = files(Path(meta["workdir"]))
        roots = projects(Path(meta["workdir"]), snapshot)
        rows.append(("G1", "PASS" if len(roots) == 1 else "FAIL", f"project.godot count: {len(roots)}"))
        report_path = harness / "GODOT_VALIDATION.json"
        if not report_path.exists():
            validate(harness)
            meta = load_meta(harness)
        if not report_path.exists():
            rows.append(("G2", "WARN", "GPU runtime validation pending; visual review also pending."))
        else:
            report = load_json(report_path)
            if report.get("source_snapshot") != snapshot:
                rows.append(("H4", "FAIL", "Source files changed after runtime validation."))
            else:
                rows.append(("G2", "PASS" if report.get("status") == "passed" else "FAIL",
                             "Import/GPU boot: " + str(report.get("status"))))
        rows.append(("G3", "N/A", "Six preview combinations, interaction, pixel stability and aesthetics require human evidence review."))
    invalid = any(status == "FAIL" and key.startswith("H") for key, status, _ in rows)
    failed = any(status == "FAIL" for _, status, _ in rows)
    verdict = "INVALID" if invalid else "FAIL" if failed else "PASS_WITH_WARNINGS" if any(row[1] == "WARN" for row in rows) else "PASS"
    meta.update(status="reviewed", reviewed_at=now_iso(), verdict=verdict,
                isolation_verification="unverified", visual_review="pending",
                deliverables=list(snapshot), reviewed_snapshot=snapshot,
                review_checks=[{"id": a, "status": b, "detail": c} for a, b, c in rows])
    if transcript_path:
        meta["review_transcript"] = str(transcript_path.resolve())
        meta["review_transcript_sha256"] = sha256_file(transcript_path)
    dump_json(harness / "meta.json", meta)
    table = "\n".join(f"| {a} | {b} | {c} |" for a, b, c in rows)
    (harness / "REVIEW.md").write_text(
        f"# Native Godot review\n\nVerdict: **{verdict}**. Visual score: **pending**.\n\n"
        "OS access isolation: **unverified**. Engine boot does not establish task/visual correctness.\n\n"
        "| Check | Status | Evidence |\n|---|---|---|\n" + table + "\n", encoding="utf-8")
    print(f"reviewed native Godot: {verdict}; visual scoring pending")
    return 1 if strict and failed else 0


def collect(harness: Path, dry_run: bool = False, with_review: bool = False,
            overwrite: bool = False, force: bool = False) -> int:
    """Archive valid reviewed samples including valid runtime failures; never flatten."""
    meta = load_meta(harness)
    transcript_path = Path(meta["review_transcript"]) if meta.get("review_transcript") else None
    if transcript_path and (not transcript_path.is_file() or sha256_file(transcript_path) != meta.get("review_transcript_sha256")):
        print("REFUSED: reviewed transcript changed", file=sys.stderr)
        return 3
    transcript = transcript_path.read_text(encoding="utf-8", errors="replace") if transcript_path else None
    rows = integrity(meta, harness, transcript)
    if meta.get("status") not in {"reviewed", "collected"} or meta.get("verdict") == "INVALID" or any(row[1] == "FAIL" for row in rows):
        print("REFUSED: unreviewed or invalid sample; --force cannot bypass integrity", file=sys.stderr)
        return 3
    workdir = Path(meta["workdir"])
    snapshot = files(workdir)
    if not snapshot or snapshot != meta.get("reviewed_snapshot"):
        print("REFUSED: empty or changed reviewed submission", file=sys.stderr)
        return 3
    runtime_path = harness / "GODOT_VALIDATION.json"
    if not runtime_path.is_file() or load_json(runtime_path).get("source_snapshot") != snapshot:
        print("REFUSED: current runtime report required before archive", file=sys.stderr)
        return 3
    safe_slug(meta["model"])
    safe_slug(meta["run_id"])
    destination = ROOT / meta["project_rel"] / "results" / meta["model"] / meta["run_id"]
    no_links(destination)
    if destination.exists():
        print("REFUSED: existing archive is preserved; overwrite/force do not replace it", file=sys.stderr)
        return 3
    if dry_run:
        print(f"collect native Godot: {len(snapshot)} source/dependency files -> {destination}")
        return 0
    submission = destination / "submission"
    submission.mkdir(parents=True, exist_ok=False)
    for name in snapshot:
        target = submission / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(workdir / name, target)
    if files(submission) != snapshot or files(workdir) != snapshot:
        raise RuntimeError("Collected bytes do not match reviewed source snapshot")
    shutil.copy2(workdir / PROMPT_FILE, destination / PROMPT_FILE)
    shutil.copy2(runtime_path, destination / "GODOT_VALIDATION.json")
    runtime = load_json(runtime_path)
    logs = destination / "runtime-evidence"
    logs.mkdir()
    for path in Path(runtime["validation_dir"]).iterdir():
        if path.is_file():
            shutil.copy2(path, logs / path.name)
    if with_review:
        shutil.copy2(harness / "REVIEW.md", destination / "REVIEW.md")
    dump_json(destination / "source-manifest.json", snapshot)
    dump_json(destination / "archive.json", {"profile": PROFILE, "run_id": meta["run_id"],
        "model": meta["model"], "verdict": meta["verdict"], "runtime_status": runtime["status"],
        "engineering_fixture": bool(meta.get("engineering_fixture", False)),
        "visual_score": None, "isolation_verification": "unverified", "collected_at": now_iso(),
        "project_rel": meta["project_rel"], "prompt_sha256": meta["prompt_sha256"]})
    meta.update(status="collected", collected_to=str(destination), collected_at=now_iso())
    dump_json(harness / "meta.json", meta)
    print(f"collected native Godot: {destination}; runtime={runtime['status']}; visual score pending")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Native Godot runtime validator (host-side)")
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--godot")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--frames", type=int, default=90)
    args = parser.parse_args()
    if not 1 <= args.timeout <= 600 or not 45 <= args.frames <= 600:
        parser.error("timeout must be 1..600 and frames 45..600")
    return validate(args.run, args.godot, args.timeout, args.frames)


if __name__ == "__main__":
    raise SystemExit(main())
