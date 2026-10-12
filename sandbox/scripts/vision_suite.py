"""Prepare, execute through a local CLI adapter, then review/collect eight fresh runs."""
from __future__ import annotations
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from sandbox_lib import ROOT, RUNS, dump_json, load_json, load_meta, now_iso, sha256_file, snapshot_dir
from prepare_run import prepare
from review_run import review
from collect_run import collect
from vision_profile import RELEASE, lock, safe_slug, no_links, safe_tree, evaluate


def prepare_suite(model):
    safe_slug(model)
    entries = []
    for q in lock()['cases']:
        r = prepare('PV1-' + q, model)
        m = r['meta']
        entries.append({'case': q, 'run_id': m['run_id'], 'workdir': m['workdir'],
                        'harness': str(RUNS / model / m['run_id']), 'dispatch': r['dispatch_text']})
    out = RUNS / model / ('suite-' + entries[0]['run_id'] + '.json')
    dump_json(out, {'suite': 'PairedVision-v1', 'release_sha256': sha256_file(RELEASE / 'LOCK.json'),
                    'created_at': now_iso(), 'model_slug': model, 'status': 'prepared',
                    'fresh_context_per_case': True, 'runs': entries})
    out.with_suffix('.md').write_text('# 派发清单（仅编排方可读）\n\n' + '\n\n'.join(
        '## ' + r['case'] + '\n\n```text\n' + r['dispatch'] + '\n```' for r in entries), encoding='utf-8')
    print('SUITE_MANIFEST=' + str(out))
    return out


def execute(manifest, adapter):
    """Adapter must invoke a fresh CLI session. Host isolation is not implied by cwd.

    argv substitutions: {workdir}, {prompt}, {prompt_file}. No shell expansion.
    stdout is trace only; the tested agent writes answer.json through its tools.
    """
    suite, spec = load_json(manifest), load_json(adapter)
    if spec.get('fresh_session') is not True or spec.get('prompt_via') not in {'stdin', 'argv'}:
        raise RuntimeError('adapter must declare fresh_session=true and prompt_via=stdin|argv')
    if not isinstance(spec.get('argv'), list) or not spec['argv'] or not all(isinstance(a, str) for a in spec['argv']):
        raise RuntimeError('adapter argv must be a nonempty string array')
    wall = spec.get('wall_seconds', 600)
    if type(wall) is not int or not 1 <= wall <= 3600:
        raise RuntimeError('wall_seconds must be 1..3600')
    if suite['release_sha256'] != sha256_file(RELEASE / 'LOCK.json'):
        raise RuntimeError('suite release mismatch')
    lock()
    for run in suite['runs']:
        h, wd = Path(run['harness']), Path(run['workdir'])
        no_links(wd)
        if (h / 'execution.json').exists():
            print('skip already executed:', run['case'])
            continue
        safe_tree(wd)
        if snapshot_dir(wd) != load_json(h / 'snapshot.json'):
            raise RuntimeError('workspace changed before execution; prepare a fresh run')
        # Metadata stays outside the tested workspace. Never copy adapter/config there.
        argv = [a.replace('{workdir}', str(wd)).replace('{harness}', str(h)).replace('{prompt_file}', str(wd / 'PROMPT.md')).replace('{prompt}', run['dispatch']) for a in spec['argv']]
        record = {'execution_profile': 'agent-tools', 'adapter_sha256': sha256_file(adapter),
                  'requested_model': spec.get('requested_model'), 'requested_effort': spec.get('requested_effort'),
                  'max_output_tokens': spec.get('max_output_tokens'), 'wall_seconds': wall,
                  'actual_model': None, 'usage': None, 'finish_reason': None,
                  'identity_note': 'Requested values are adapter declarations; actual identity/usage require provider trace extraction.',
                  'isolation_verification': 'unverified', 'started_at': now_iso()}
        start = time.monotonic()
        try:
            with (h / 'stdout.log').open('wb') as stdout, (h / 'stderr.log').open('wb') as stderr:
                proc = subprocess.Popen(argv, cwd=wd, stdin=subprocess.PIPE, stdout=stdout, stderr=stderr, shell=False)
                try:
                    data = run['dispatch'].encode('utf-8') if spec['prompt_via'] == 'stdin' else b''
                    proc.communicate(data, timeout=wall)
                    record.update(status='completed' if proc.returncode == 0 else 'process_error', exit_code=proc.returncode)
                except subprocess.TimeoutExpired:
                    if os.name == 'nt':
                        subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'], capture_output=True)
                    proc.kill()
                    proc.wait(timeout=10)
                    record.update(status='timeout', exit_code=proc.returncode)
        except OSError as e:
            record.update(status='launch_error', error=str(e), exit_code=None)
        record['elapsed_seconds'] = round(time.monotonic() - start, 3)
        dump_json(h / 'execution.json', record)
        m = load_meta(h)
        m['execution_status'] = record['status']
        dump_json(h / 'meta.json', m)
        print(run['case'], record['status'], record['elapsed_seconds'], flush=True)


def finalize(manifest):
    suite = load_json(manifest)
    rows = []
    for run in suite['runs']:
        h = Path(run['harness'])
        # stdout and stderr may both include tool paths; scan both as one trace.
        traces = [h / n for n in ('stdout.log', 'stderr.log') if (h / n).is_file()]
        transcript = None
        if traces:
            transcript = h / 'transcript.txt'
            transcript.write_text('\n'.join(p.read_text(encoding='utf-8', errors='replace') for p in traces), encoding='utf-8')
        meta = load_meta(h)
        if meta.get('collected_to'):
            old = load_json(h / 'SCORE.json')
            if evaluate(meta, h, (old.get('transcript') or {}).get('path')) != old:
                raise RuntimeError('collected run changed; preserve archive and prepare a new suite')
        else:
            review(h, strict=True, transcript_path=transcript)
            meta = load_meta(h)
        c = None
        if meta['verdict'] in {'PASS', 'PASS_WITH_WARNINGS'} and meta.get('status') != 'collected':
            # Re-finalizing may review an already archived run; do not duplicate the archive.
            if not meta.get('collected_to'):
                c = collect(h)
        provider = None
        if (h / 'provider_evidence.json').is_file():
            provider = load_json(h / 'provider_evidence.json')
            source = h / provider['source']['file']
            if not source.resolve().is_relative_to(h.resolve()):
                raise RuntimeError('provider evidence source must be inside harness')
            no_links(source)
            if sha256_file(source) != provider['source']['sha256']:
                raise RuntimeError('provider evidence source hash mismatch')
        rows.append({'case': run['case'], 'harness': str(h), 'verdict': meta['verdict'],
                     'score': meta.get('score'), 'collect_exit': c,
                     'execution': load_json(h / 'execution.json') if (h / 'execution.json').is_file() else None,
                     'provider_evidence': provider,
                     'isolation_verification': meta.get('isolation_verification')})
    dest = manifest.with_name(manifest.stem + '-results.json')
    dump_json(dest, {'suite': suite['suite'], 'model_slug': suite['model_slug'], 'runs': rows,
                     'note': 'No pooled ranking. Engineering fixtures are not model runs.'})
    lines = ['# PairedVision suite results', '', '| 条件 | 交付状态 | 内容得分 | 请求模型 | 返回模型 | 秒 | usage | finish | 隔离验证 |', '|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        s = r['score']
        label = f"{s['correct_fields']}/{s['total_fields']} ({s['score']:.1%})" if s and s.get('valid_schema') else '—'
        execution, provider = r['execution'] or {}, r['provider_evidence'] or {}
        values = [r['case'], r['verdict'], label, execution.get('requested_model'),
                  provider.get('actual_model'), execution.get('elapsed_seconds'),
                  provider.get('usage'), provider.get('finish_reason'), r['isolation_verification']]
        lines.append('| ' + ' | '.join(str(v if v is not None else '未记录').replace('|', '\\|').replace('\n', ' ') for v in values) + ' |')
    dest.with_suffix('.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('RESULTS=' + str(dest))
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest='command', required=True)
    p = sub.add_parser('prepare'); p.add_argument('--model', required=True)
    p = sub.add_parser('execute'); p.add_argument('--suite', type=Path, required=True); p.add_argument('--adapter', type=Path, required=True)
    p = sub.add_parser('finalize'); p.add_argument('--suite', type=Path, required=True)
    args = ap.parse_args()
    if args.command == 'prepare': prepare_suite(args.model)
    elif args.command == 'execute': execute(args.suite, args.adapter)
    else: finalize(args.suite)


if __name__ == '__main__':
    main()
