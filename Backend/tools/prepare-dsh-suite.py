"""Freeze an eight-task DSH/OpenDesign high run via the standard prepare entry point."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
LABEL = sys.argv[1] if len(sys.argv) > 1 else 'backend-dsh-opendes-v41f-high-20261016'
OUT = ROOT / 'Backend/pilots' / LABEL
OUT.mkdir(parents=True, exist_ok=False)

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def write(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

bank = json.loads((ROOT/'Backend/BANK.json').read_text(encoding='utf-8'))
tasks = [t for t in bank['tasks'] if t['status'] == 'active']
assert len(tasks) == 8
for task in tasks:
    assert sha(ROOT/task['prompt']) == task['promptSha256'], task['id']
    if task.get('input'):
        assert sha(ROOT/task['input']['file']) == task['input']['sha256']
        lock = json.loads((ROOT/task['input']['lock']).read_text(encoding='utf-8'))
        assert lock['sha256'] == task['input']['sha256']

original = ROOT/'sandbox/adapters/deepseek-v4.1-flash-headless.patch.yml'
patch = OUT/'dsh-high.patch.yml'
content = original.read_text(encoding='utf-8')
needle = '    model: deepseek-v4.1-flash\n'
assert content.count(needle) == 1
patch.write_text(content.replace(needle, needle+'    reasoningEffort: high\n'), encoding='utf-8')
adapter = json.loads((ROOT/'sandbox/adapters/deepseek-v4.1-flash-headless.json').read_text(encoding='utf-8'))
adapter['argv'][adapter['argv'].index('--patch')+1] = str(patch)
adapter['requested_effort'] = 'high'
adapter['wall_seconds'] = 1800
adapter.update(time_policy='penalty-no-deadline',soft_seconds=600,
               soft_seconds_by_project={'RaftTxnWorkbench':1800,'DurableCollab':1800})
adapter['_notes']['budget'] = 'Soft score thresholds: L1-L3 600s; L4 v2 1800s. Never kill at threshold. Maximum two generation processes. No automatic retries.'
adapter['_notes']['effort'] = 'Process-local agent-default-model.reasoningEffort=high; model compat supportsReasoningEffort=true.'
write(OUT/'adapter.json', adapter)
write(OUT/'BANK.snapshot.json', bank)
write(OUT/'PLAN.json', {
    'label': LABEL, 'provider': 'opendes', 'requestedModel': 'deepseek-v4.1-flash',
    'requestedEffort': 'high', 'dshVersion': '0.2.1-alpha.2',
    'concurrency': 2, 'budgets': {'L1-L3':600, 'L4':1800},
    'timePolicy':'penalty-no-deadline','budgetsAre':'soft-score-thresholds-only',
    'penalty':{'scalePoints':100,'pointsPerThresholdOverrun':10,'capPoints':10,
               'formula':'min(10, 10 * max(0, elapsed / threshold - 1))'},
    'isolationVerification':'unverified', 'retryPolicy':'no automatic retry',
    'adapterSha256':sha(OUT/'adapter.json'), 'patchSha256':sha(patch),
    'bankSha256':sha(ROOT/'Backend/BANK.json'),
    'tasks':[{'id':t['id'],'name':t['name'],'level':t['level'],
              'project':t['dispatchProject'],'promptSha256':t['promptSha256'],
              'input':t.get('input')} for t in tasks]
})
subprocess.run([sys.executable, str(ROOT/'sandbox/scripts/cli_suite.py'), 'prepare',
                '--model',LABEL,'--projects',','.join(t['dispatchProject'] for t in tasks)],
               cwd=ROOT, env={**os.environ,'PYTHONUTF8':'1'}, check=True)
