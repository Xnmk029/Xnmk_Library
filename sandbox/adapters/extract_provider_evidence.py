"""Extract provider evidence (identity/usage/finish) from codex runtime rollouts.

For each executed run in a suite manifest:
  1. thread_id comes from the run's stdout.log JSONL (thread.started).
  2. The matching rollout-*.jsonl under ~/.codex/sessions is copied verbatim
     into the harness as codex_rollout.jsonl (raw provider log, never edited).
  3. actual_model / usage / finish_reason are extracted from the rollout copy
     and written to provider_evidence.json with the copy's sha256.

Values are taken only from the runtime trace; nothing is inferred from model
self-report or exit codes. Missing values stay null.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

FINISH_STOP = {'task_complete', 'turn_complete', 'turn_completed', 'agent_end_turn'}
FINISH_ERROR = {'turn_failed', 'task_failed', 'error', 'stream_error'}


def extract(h: Path):
    stdout = h / 'stdout.log'
    text = stdout.read_text(encoding='utf-8', errors='replace')
    m = re.search(r'\{"type":"thread\.started","thread_id":"([^"]+)"\}', text)
    if not m:
        return None, 'no thread_id in stdout.log'
    tid = m.group(1)
    sessions = Path.home() / '.codex' / 'sessions'
    hits = sorted(sessions.rglob(f'*{tid}.jsonl'))
    if not hits:
        return None, f'no rollout for {tid}'
    dst = h / 'codex_rollout.jsonl'
    shutil.copyfile(hits[0], dst)

    model = usage = finish = effort = provider = None
    for line in dst.read_text(encoding='utf-8', errors='replace').splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        pl = e.get('payload') or {}
        if pl.get('model'):
            model = pl['model']
        if pl.get('effort'):
            effort = pl['effort']
        mp = pl.get('model_provider')
        if isinstance(mp, dict) and mp.get('name'):
            provider = mp['name']
        if e.get('type') == 'event_msg' and pl.get('type') == 'token_count':
            info = pl.get('info') or {}
            if info.get('total_token_usage'):
                usage = info['total_token_usage']
        pt = pl.get('type')
        if pt in FINISH_STOP:
            finish = 'stop'
        elif pt in FINISH_ERROR:
            finish = pt

    evidence = {
        'actual_model': model,
        'usage': usage,
        'finish_reason': finish,
        'requested_effort': effort,
        'model_provider': provider,
        'thread_id': tid,
        'extraction_note': 'values extracted from codex runtime rollout; verbatim copy in codex_rollout.jsonl',
        'source': {'file': 'codex_rollout.jsonl',
                   'sha256': hashlib.sha256(dst.read_bytes()).hexdigest()},
    }
    (h / 'provider_evidence.json').write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return evidence, None


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--suite', type=Path, required=True)
    args = ap.parse_args()
    suite = json.loads(args.suite.read_text(encoding='utf-8'))
    for run in suite['runs']:
        h = Path(run['harness'])
        if (h / 'provider_evidence.json').is_file():
            print(run['case'], 'skip (exists)')
            continue
        if not (h / 'execution.json').is_file():
            print(run['case'], 'skip (not executed)')
            continue
        ev, err = extract(h)
        if err:
            print(run['case'], 'MISSING:', err)
        else:
            print(run['case'], ev['actual_model'], ev['finish_reason'], json.dumps(ev['usage']))


if __name__ == '__main__':
    main()
