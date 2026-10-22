"""Fresh trials after observed DSH resume infrastructure failure, without old answers."""
import json,sys,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'sandbox/scripts'))
from prepare_run import prepare
from cli_suite import record_suite,run_dirs
label='backend-dsh-opendes-v41f-high-20261016'
out=root/'Backend/pilots'/label
plan=json.loads((out/'PLAN.json').read_text(encoding='utf-8'))
if plan.get('retests'):raise RuntimeError('Retests already prepared')
bank=json.loads((out/'BANK.snapshot.json').read_text(encoding='utf-8'))
retests=[]
for task in bank['tasks']:
    if task['id'] not in {'B01','B03'}:continue
    old=next(h for h in run_dirs(label) if json.loads((h/'meta.json').read_text(encoding='utf-8'))['project']==Path(task['dispatchProject']).name)
    error=(old/'stderr.log').read_text(encoding='utf-8')
    if 'format v4 message requires a producer-owned source kind' not in error:raise RuntimeError('Expected observed infrastructure failure')
    result=prepare(task['dispatchProject'],label)
    retests.append({'taskId':task['id'],'priorHarness':old.relative_to(root).as_posix(),'newRunId':result['meta']['run_id'],
                    'reason':'Prior forced cutoff; DSH original-session resume failed before provider call: format v4 message requires a producer-owned source kind.',
                    'carryOverAnswers':False,'timeMeasurement':'New uninterrupted generation; historical cutoff/recovery costs retained separately.'})
suite=root/'sandbox/runs'/label/('suite-'+label+'.json')
shutil.copyfile(suite,out/'SUITE.before-soft-retests.json')
record_suite(label,run_dirs(label))
plan['retests']=retests
(out/'PLAN.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared two fresh retests; no prior code or history provided.')
