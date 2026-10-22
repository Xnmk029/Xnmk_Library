"""Record an explicit user-requested policy change without altering old evidence."""
import hashlib,json,shutil
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[2]
out=root/'Backend/pilots/backend-dsh-opendes-v41f-high-20261016'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
plan=read(out/'PLAN.json')
shutil.copyfile(out/'PLAN.json',out/'PLAN.initial-hard-stop.json')
for name in ['RESULTS.json','REPORT.md']:
    if (out/name).exists():shutil.copyfile(out/name,out/(Path(name).stem+'.initial-hard-stop'+Path(name).suffix))
adapter=read(out/'adapter.json')
adapter.update(time_policy='penalty-no-deadline',soft_seconds=600,
               soft_seconds_by_project={'RaftTxnWorkbench':1800,'DurableCollab':1800})
adapter['_notes']['budget']='Soft thresholds only: L1-L3 600s; L4 1800s. Crossing thresholds never terminates generation.'
adapter['_notes']['continuation']='User explicitly requested continuation after prior hard stops; retain cutoff evidence and mark interrupted trials.'
write(out/'adapter-soft.json',adapter)
plan.update(timePolicy='penalty-no-deadline',budgetsAre='soft-score-thresholds-only',
            penalty={'scalePoints':100,'pointsPerThresholdOverrun':10,'capPoints':10,'formula':'min(10, 10 * max(0, elapsed / threshold - 1))'},
            policyChangedAt=datetime.now(timezone.utc).isoformat(),
            policyChangeReason='Explicit user correction: overtime deducts points; do not stop at threshold.',
            activeAdapter='adapter-soft.json',activeAdapterSha256=hashlib.sha256((out/'adapter-soft.json').read_bytes()).hexdigest(),
            retryPolicy='No automatic fresh retries. Explicit same-session continuation for runs interrupted by prior policy.')
write(out/'PLAN.json',plan)
print('Soft scoring policy activated; original configuration and reports retained.')
