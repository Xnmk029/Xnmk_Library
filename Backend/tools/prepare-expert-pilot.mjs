import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const bank=JSON.parse(fs.readFileSync(path.join(root,'Backend/BANK.json')));
const isV2=bank.tasks.some(t=>t.track==='repository-expert-v2');
const label=process.argv[2]??(isV2?'backend-expert-v2-20261016':'backend-expert-open-20261016');
for(const name of ['RaftTxnWorkbench','DurableCollab']) {
  const p=path.join(root,'L4_Expert',name);
  const lock=JSON.parse(fs.readFileSync(path.join(p,'STARTER_LOCK.json')));
  if(hash(fs.readFileSync(path.join(p,lock.file)))!==lock.sha256)throw Error('Starter hash mismatch: '+name);
  const registered=bank.tasks.find(t=>t.name===name);
  if(registered?.input&&registered.input.sha256!==lock.sha256)throw Error('Bank starter version mismatch: '+name);
}
const adapter=JSON.parse(fs.readFileSync(path.join(root,'Backend/tools/pilot-adapter.json')));
adapter.wall_seconds=1800;
adapter.time_policy='penalty-no-deadline';
adapter.soft_seconds=1800;
adapter.argv[adapter.argv.indexOf('-s')+1]='danger-full-access';
adapter.note='Expert repository pilot; 1800s soft score threshold, no automatic termination. Full-access CLI required because Windows workspace sandbox denies package downloads and global caches. OS isolation is NOT verified. Dependencies prewarmed, installation and model self-tests still included in elapsed time. No automatic time-based replacement.';
const adapterName=isV2?'expert-v2-adapter.json':'expert-adapter.json';
fs.writeFileSync(path.join(root,'Backend/tools',adapterName),JSON.stringify(adapter,null,2)+'\n');
const python='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const result=spawnSync(python,['sandbox/scripts/cli_suite.py','prepare','--model',label,'--projects','L4_Expert/RaftTxnWorkbench,L4_Expert/DurableCollab'],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exitCode=result.status;
