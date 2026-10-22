"""Explicit continuation of an existing DSH Blender session, with separate evidence."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import uuid

from blender_profile import integrity, review, collect
from godot_profile import hidden_process
from sandbox_lib import dump_json, load_json, load_meta, now_iso, sha256_file, snapshot_dir


def resume(h: Path, cli: Path, session: str, wall: int = 14400):
    h, cli = h.resolve(), cli.resolve()
    meta = load_meta(h)
    if meta.get('profile') != 'native-blender-v1':
        raise RuntimeError('Only a registered Blender run is supported')
    if any(status == 'FAIL' for _, status, _ in integrity(meta, h)):
        raise RuntimeError('Original registered input integrity failed')
    if load_json(h / 'provider_evidence.json').get('session_id') != session:
        raise RuntimeError('Session must match the observed original provider trace')
    previous = load_json(h / 'CONTINUATION_STATE.json') if (h / 'CONTINUATION_STATE.json').exists() else {}
    if previous.get('status') in {'starting', 'running'}:
        raise RuntimeError('A continuation is already recorded as active')
    package = cli.parent.parent / 'package.json'
    if load_json(package).get('version') != '0.2.1-rc.1':
        raise RuntimeError('The original DSH version 0.2.1-rc.1 is required')
    expected_manifest = load_json(h / 'HOST_CODE_LOCK.json')['files'][
        r'C:\Users\Administrator\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\package.json']
    if sha256_file(package) != expected_manifest:
        raise RuntimeError('Restored CLI package manifest differs from the original')
    original = load_json(h / 'adapter.json')
    if original['requested_model'] != 'opendes/deepseek-v4.1-flash':
        raise RuntimeError('Unexpected original model route')
    work = Path(meta['workdir'])
    attempt = h / 'continuations' / (time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6])
    attempt.mkdir(parents=True, exist_ok=False)
    history = attempt / 'prior-evidence'
    history.mkdir()
    for p in h.iterdir():
        if p.is_file():
            shutil.copy2(p, history / p.name)
    dump_json(attempt / 'source-before.json', snapshot_dir(work))
    shutil.copy2(h / 'snapshot.json', attempt / 'snapshot.json')
    patch = attempt / 'provider.patch.yml'
    shutil.copy2(Path(original['argv'][5]), patch)
    argv = list(original['argv'])
    argv[1], argv[5] = str(cli), str(patch)
    argv[argv.index('--json'):argv.index('--json')] = ['--session-id', session]
    adapter = {**original, 'argv': argv, 'fresh_session': False, 'resumed_session': session}
    dump_json(attempt / 'adapter.json', adapter)
    prompt = '继续完成当前工作目录 PROMPT.md 中的任务与验证。'
    (attempt / 'followup.txt').write_text(prompt, encoding='utf-8')
    attempt_meta = dict(meta)
    for key in ['verdict', 'reviewed_at', 'review_checks', 'reviewed_snapshot', 'deliverables',
                'review_transcript', 'review_transcript_sha256', 'runtime_report_sha256', 'collected_to']:
        attempt_meta.pop(key, None)
    attempt_meta.update(status='running', execution_status='continuation_running',
                        runtime_validation='pending', harness=str(attempt), continuation=True,
                        continuation_of=str(h), user_authorized_resume=True,
                        benchmark_note='Same-session continuation after an interrupted initial attempt; not an uninterrupted fresh run.')
    dump_json(attempt / 'meta.json', attempt_meta)
    environment = os.environ.copy()
    environment['PYTHONUTF8'] = '1'
    for key, child in [('BLENDER_USER_CONFIG', 'config'), ('BLENDER_USER_SCRIPTS', 'scripts'),
                       ('BLENDER_USER_DATAFILES', 'datafiles')]:
        environment[key] = str(work / '_blender_runtime' / child)
    record = dict(status='starting', started_at=now_iso(), session_id=session,
                  fresh_session=False, user_authorized_resume=True, automatic_retries=0,
                  requested_model=original['requested_model'], requested_effort=original.get('requested_effort'),
                  actual_model=None, usage=None, wall_seconds=wall, attempt_dir=str(attempt),
                  workdir=str(work), argv=argv, cli_version='0.2.1-rc.1',
                  cli_sha256=sha256_file(cli), patch_sha256=sha256_file(patch),
                  host_code_sha256={p.name: sha256_file(p) for p in [
                      Path(__file__).resolve(), Path(__file__).with_name('sandbox_lib.py'),
                      Path(__file__).with_name('blender_profile.py')]},
                  original_execution=load_json(h / 'execution.json'), isolation_verification='unverified')
    start = time.monotonic()
    with (attempt / 'stdout.log').open('wb') as out, (attempt / 'stderr.log').open('wb') as err:
        process = subprocess.Popen(argv, cwd=work, env=environment, stdin=subprocess.PIPE,
                                   stdout=out, stderr=err, **hidden_process())
        record.update(status='running', pid=process.pid)
        dump_json(attempt / 'execution.json', record)
        dump_json(h / 'CONTINUATION_STATE.json', record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
        try:
            process.communicate(prompt.encode('utf-8'), timeout=wall)
            record.update(status='completed' if process.returncode == 0 else 'process_error', exit_code=process.returncode)
        except subprocess.TimeoutExpired:
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                           capture_output=True, **hidden_process())
            process.wait(timeout=15)
            record.update(status='timeout', exit_code=process.returncode)
    record.update(finished_at=now_iso(), elapsed_seconds=round(time.monotonic() - start, 3))
    dump_json(attempt / 'execution.json', record)
    dump_json(h / 'CONTINUATION_STATE.json', record)
    module_spec = importlib.util.spec_from_file_location('original_dsh_host', h / 'host_job.py')
    extractor = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(extractor)
    provider = extractor.evidence(attempt, 'dsh')
    logs = [h / 'stdout.log', h / 'stderr.log']
    for segment in sorted((h / 'continuations').iterdir()):
        logs.extend([segment / 'followup.txt', segment / 'stdout.log', segment / 'stderr.log'])
    transcript = attempt / 'transcript.txt'
    transcript.write_text('\n'.join(p.read_text(encoding='utf-8', errors='replace')
                                    for p in logs if p.is_file()), encoding='utf-8')
    review(attempt, transcript_path=transcript)
    current = load_meta(attempt)
    collected = None
    if current.get('verdict') in {'PASS', 'PASS_WITH_WARNINGS', 'FAIL'}:
        collected = collect(attempt, with_review=True)
        current = load_meta(attempt)
    result = dict(status='finished', finished_at=now_iso(), continuation=True, session_id=session,
                  execution=record, provider_evidence=provider, verdict=current.get('verdict'),
                  collected_to=current.get('collected_to'), collection_exit=collected,
                  visual_score=None, isolation_verification='unverified')
    dump_json(attempt / 'RUN_RESULT.json', result)
    dump_json(h / 'CONTINUATION_RESULT.json', result)
    if current.get('collected_to'):
        destination = Path(current['collected_to'])
        dump_json(destination / 'CONTINUATION.json', result)
        archive = load_json(destination / 'archive.json')
        archive.update(continuation=True, uninterrupted_run=False,
                       benchmark_note=attempt_meta['benchmark_note'])
        dump_json(destination / 'archive.json', archive)
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', required=True, type=Path)
    parser.add_argument('--cli', required=True, type=Path)
    parser.add_argument('--session', required=True)
    parser.add_argument('--wall', default=14400, type=int)
    args = parser.parse_args()
    if not 1 <= args.wall <= 14400:
        parser.error('--wall must be 1..14400')
    resume(args.run, args.cli, args.session, args.wall)
