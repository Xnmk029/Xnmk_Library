"""Wait for the original DSH queue, then execute the preregistered guard cohort."""
import json
import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
RUNS = ROOT / 'sandbox/runs'
HERE = ROOT / 'Vision/iteration/20260921/cli-review/20260929'
SOURCE = RUNS / 'vision-cli-dsh-r6-20260929'
PROBE = RUNS / 'vision-cli-dsh-guarded-gridprobe-20260929'
TARGET = RUNS / 'vision-cli-dsh-guarded-r6-20260929'


def state(status, **details):
    record = {'utc': datetime.now(timezone.utc).isoformat(), 'status': status, **details}
    (HERE / 'GUARDED_QUEUE.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(record), flush=True)


def source_terminal():
    suite = json.loads((SOURCE / 'SUITE.json').read_text(encoding='utf-8'))
    # A missing record never demonstrates a stopped process. STOP is written
    # only after the current child exits and its terminal record is persisted.
    return (SOURCE / 'STOP.json').is_file() or all(
        (Path(run['harness']) / 'execution.json').is_file() for run in suite['runs'])


def run_suite(base):
    subprocess.run([sys.executable, '-B', str(ROOT / 'sandbox/scripts/iteration_cli.py'),
                    'execute', '--suite', str(base / 'SUITE.json')], cwd=ROOT, check=True)


def main():
    state('waiting_for_original_dsh_terminal', source=str(SOURCE))
    deadline = time.monotonic() + 7200
    while not source_terminal():
        if time.monotonic() >= deadline:
            state('waiting_deadline_no_dispatch')
            return
        time.sleep(5)
    state('guarded_probe_running')
    run_suite(PROBE)
    result = json.loads((PROBE / 'RESULTS.json').read_text(encoding='utf-8'))
    if not result['complete'] or result['macro_score'] != 100 or not all(
            r.get('provider', {}).get('image_tool_observed') for r in result['rows']):
        state('guarded_probe_not_passed_no_full_dispatch')
        return
    state('guarded_full_cohort_running', suite=str(TARGET / 'SUITE.json'))
    run_suite(TARGET)
    state('guarded_executor_returned', stopped_early=(TARGET / 'STOP.json').exists())
    subprocess.run([sys.executable, '-B', str(HERE / 'build_report.py')], cwd=ROOT, check=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        state('coordinator_error_no_retry', error=type(exc).__name__ + ': ' + str(exc))
        raise
