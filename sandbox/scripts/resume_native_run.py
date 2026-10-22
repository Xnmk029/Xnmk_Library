"""User-authorized continuation of one interrupted native Godot CLI session.

Preserves original logs, records the additional attempt, and uses the standard
native review/collection gates after completion. No fresh-run claim or retry.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import time
import tomllib
import uuid
from pathlib import Path

from godot_profile import collect, files, hidden_process, integrity, review
from sandbox_lib import dump_json, load_json, load_meta, now_iso, sha256_file


def resume(harness: Path, adapter_path: Path, thread: str):
    harness = harness.resolve()
    meta = load_meta(harness)
    work = Path(meta["workdir"])
    if any(status == "FAIL" for _, status, _ in integrity(meta, harness)):
        raise RuntimeError("Original prompt/input/profile integrity failed")
    if (harness / "RUN_RESULT.json").exists():
        raise RuntimeError("Existing completion result is preserved")
    spec = load_json(adapter_path)
    assert spec["requested_model"] == "gpt-6.1-sol" and spec["requested_effort"] == "xhigh"
    argv = [s.replace("{workdir}", str(work)).replace("{harness}", str(harness)) for s in spec["argv"]]
    argv[0] = os.environ.get("CODEX_CLI_PATH", argv[0])
    assert argv[-1] == "-"
    argv = argv[:-1] + ["resume", thread, "-"]
    config = tomllib.loads((Path.home() / ".codex/config.toml").read_text(encoding="utf-8"))
    for section in ["plugins", "mcp_servers"]:
        for name in config.get(section, {}):
            argv[1:1] = ["-c", section + "." + json.dumps(name) + ".enabled=false"]
    attempt = harness / "continuations" / (time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6])
    attempt.mkdir(parents=True)
    dump_json(attempt / "source-before.json", files(work))
    prompt = "继续完成当前工作目录 PROMPT.md 中的任务与验证。"
    (attempt / "followup.txt").write_text(prompt, encoding="utf-8")
    record = {"status": "running", "started_at": now_iso(), "thread_id": thread,
              "requested_model": "gpt-6.1-sol", "requested_effort": "xhigh", "fresh_session": False,
              "user_authorized_resume": True, "access_path": "native-cli-resume",
              "app_resume_note": "An app continuation was read-only and was ended before this writable CLI continuation.",
              "workdir": str(work), "attempt_dir": str(attempt), "argv": argv,
              "cli_sha256": sha256_file(Path(argv[0])), "wall_seconds": 14400,
              "automatic_retries": 0, "isolation_verification": "unverified"}
    started = time.monotonic()
    with (attempt / "stdout.log").open("wb") as out, (attempt / "stderr.log").open("wb") as err:
        process = subprocess.Popen(argv, cwd=work, stdin=subprocess.PIPE, stdout=out, stderr=err, **hidden_process())
        record["pid"] = process.pid
        dump_json(attempt / "execution.json", record)
        dump_json(harness / "CONTINUATION_STATE.json", record)
        meta.update(execution_status="continuation_running", continuation_dir=str(attempt))
        dump_json(harness / "meta.json", meta)
        dump_json(harness / "OBSERVED_STATUS.json", {"status": "running", "observed_at": now_iso(),
                  "thread_id": thread, "access_path": "native-cli-resume", "attempt_dir": str(attempt)})
        print(json.dumps({"status": "running", "pid": process.pid, "attempt_dir": str(attempt), "thread_id": thread}), flush=True)
        try:
            process.communicate(prompt.encode("utf-8"), timeout=14400)
            record.update(status="completed" if process.returncode == 0 else "process_error", exit_code=process.returncode)
        except subprocess.TimeoutExpired:
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, **hidden_process())
            process.wait(timeout=15)
            record.update(status="timeout", exit_code=process.returncode)
    record.update(finished_at=now_iso(), elapsed_seconds=round(time.monotonic() - started, 3))
    dump_json(attempt / "execution.json", record)
    dump_json(harness / "CONTINUATION_STATE.json", record)
    dump_json(harness / "execution.json", record)
    extractor_path = Path(__file__).resolve().parents[1] / "adapters/extract_provider_evidence.py"
    module_spec = importlib.util.spec_from_file_location("resume_provider_evidence", extractor_path)
    extractor = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(extractor)
    evidence, evidence_error = extractor.extract(harness)
    logs = [harness / "stdout.log", harness / "stderr.log"]
    logs.extend(sorted((harness / "continuations").glob("*/stdout.log")))
    logs.extend(sorted((harness / "continuations").glob("*/stderr.log")))
    if (harness / "codex_rollout.jsonl").exists():
        logs.append(harness / "codex_rollout.jsonl")
    transcript = harness / "transcript.txt"
    transcript.write_text("\n".join(p.read_text(encoding="utf-8", errors="replace") for p in logs if p.is_file()), encoding="utf-8")
    review(harness, transcript_path=transcript)
    meta = load_meta(harness)
    collected = None
    if meta.get("verdict") in {"PASS", "PASS_WITH_WARNINGS", "FAIL"}:
        collected = collect(harness, with_review=True)
        meta = load_meta(harness)
    result = {"status": "finished", "finished_at": now_iso(), "run_id": meta["run_id"],
              "execution_status": record["status"], "continuation": True, "thread_id": thread,
              "provider_evidence": evidence, "provider_evidence_error": evidence_error,
              "verdict": meta.get("verdict"), "runtime_validation": meta.get("runtime_validation"),
              "collected_to": meta.get("collected_to"), "collection_exit": collected,
              "visual_score": None, "isolation_verification": "unverified"}
    dump_json(harness / "RUN_RESULT.json", result)
    if meta.get("collected_to"):
        shutil.copy2(attempt / "execution.json", Path(meta["collected_to"]) / "CONTINUATION.json")
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--adapter", type=Path, required=True)
    p.add_argument("--thread", required=True)
    a = p.parse_args()
    resume(a.run, a.adapter, a.thread)
