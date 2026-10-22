import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),bank=JSON.parse(fs.readFileSync(path.join(root,'Backend/BANK.json')));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const original=JSON.parse(fs.readFileSync(path.join(root,'Backend/pilots/20261015/BANK.snapshot.json')));
assert.equal(bank.tasks.length,8);
for(const level of ['L1','L2','L3','L4'])assert.equal(bank.tasks.filter(t=>t.status==='active'&&t.level===level).length,2);
assert.deepEqual(bank.tasks.filter(t=>t.level!=='L4'),original.tasks.filter(t=>t.level!=='L4'));
for(const task of bank.tasks){assert.equal(hash(path.join(root,task.prompt)),task.promptSha256,task.name);assert(fs.existsSync(path.join(root,task.project,'README.md')));if(task.input){assert.equal(hash(path.join(root,task.input.file)),task.input.sha256);const lock=JSON.parse(fs.readFileSync(path.join(root,task.input.lock)));assert.equal(lock.sha256,task.input.sha256);const reg=JSON.parse(fs.readFileSync(path.join(root,task.project,'PROMPT_REGISTRY.json')));assert.deepEqual(reg.inputFiles,['starter.tar']);assert.equal(reg.sha256,task.promptSha256);}}
for(const old of bank.history.filter(t=>['user-requested-expert-difficulty-upgrade','user-requested-expert-v2-strengthening'].includes(t.retiredReason)))assert.equal(hash(path.join(root,old.prompt)),old.promptSha256);
const frozen=JSON.parse(fs.readFileSync(path.join(root,'Backend/pilots/20261015/REPORT_FREEZE.json')));assert.equal(hash(path.join(root,frozen.frozen)),frozen.sha256);
const docs=['Backend/README.md','Backend/EXPERT_UPGRADE_REPORT.md','Backend/EXPERT_V2.md','Backend/PILOT_REPORT.md','L4_Expert/RaftTxnWorkbench/README.md','L4_Expert/DurableCollab/README.md'];
for(const f of docs){const p=path.join(root,f);for(const m of fs.readFileSync(p,'utf8').matchAll(/\]\(([^)]+)\)/g)){let target=m[1];if(/^(https?:|#|<)/.test(target)||target.includes('<'))continue;target=target.split('#')[0];if(!target)continue;assert(fs.existsSync(path.resolve(path.dirname(p),target)),f+' broken link '+target);}}
console.log('Bank integrity: 8 active, 2 per level; L1-L3 unchanged; prompt/input/history hashes and key links verified.');
