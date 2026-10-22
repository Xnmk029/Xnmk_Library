import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {root,sha,assertReadOnlyInterval,assertEpochMismatch} from './expert-v2-lib.mjs';

test('ReadIndex oracle accepts a stable read-only interval',()=>{
 assertReadOnlyInterval({leaderId:1,term:3,appliedIndex:12},{leaderId:1,term:3,appliedIndex:12});
});
test('ReadIndex oracle rejects a log-barrier read implementation',()=>{
 assert.throws(()=>assertReadOnlyInterval({leaderId:1,term:3,appliedIndex:5},{leaderId:1,term:3,appliedIndex:69}),/hidden Raft log/);
});
test('ReadIndex oracle does not compare different leader terms as a valid interval',()=>{
 assert.throws(()=>assertReadOnlyInterval({leaderId:1,term:3,appliedIndex:12},{leaderId:2,term:4,appliedIndex:13}),/term change/);
});
test('epoch oracle rejects acknowledged stale writes and wrong generations',()=>{
 assertEpochMismatch({status:409,data:{error:'EPOCH_MISMATCH',epoch:2}},2);
 assert.throws(()=>assertEpochMismatch({status:200,data:{epoch:2}},2));
 assert.throws(()=>assertEpochMismatch({status:409,data:{error:'EPOCH_MISMATCH',epoch:1}},2));
});
test('checkpoint truth excludes post-checkpoint updates and preserves missing dependencies',()=>{
 const Y=createRequire(path.join(root,'Backend/.cache/DurableCollab/repo/package.json'))('yjs');
 const doc=new Y.Doc(),us=[];doc.on('update',u=>us.push(u));doc.getText('text').insert(0,'A');const cp=Y.mergeUpdates([us[0]]);doc.getText('text').insert(1,'B');
 const restored=new Y.Doc();Y.applyUpdate(restored,cp);assert.equal(restored.getText('text').toString(),'A');
 const pendingCheckpoint=Y.mergeUpdates([us[1]]),pendingRestore=new Y.Doc();Y.applyUpdate(pendingRestore,pendingCheckpoint);assert.equal(pendingRestore.getText('text').toString(),'');Y.applyUpdate(pendingRestore,us[0]);assert.equal(pendingRestore.getText('text').toString(),'AB');
 for(const d of [doc,restored,pendingRestore])d.destroy();
});
test('delete-set checkpoint preserves the effect when its target arrives after restore',()=>{
 const Y=createRequire(path.join(root,'Backend/.cache/DurableCollab/repo/package.json'))('yjs'),doc=new Y.Doc(),us=[];doc.on('update',u=>us.push(u));doc.getText('text').insert(0,'abcdef');doc.getText('text').delete(1,4);const restored=new Y.Doc();Y.applyUpdate(restored,Y.mergeUpdates([us[1]]));Y.applyUpdate(restored,us[0]);assert.equal(restored.getText('text').toString(),'af');doc.destroy();restored.destroy();
});
test('v1 archives and upstream inputs remain immutable while active prompts change',()=>{
 const previous=JSON.parse(fs.readFileSync(path.join(root,'Backend/pilots/20261016-v2/previous-BANK.json'))),bank=JSON.parse(fs.readFileSync(path.join(root,'Backend/BANK.json')));
 assert.equal(bank.tasks.length,8);assert.deepEqual(bank.tasks.filter(t=>t.level!=='L4'),previous.tasks.filter(t=>t.level!=='L4'));
 for(const old of previous.tasks.filter(t=>t.level==='L4')){const current=bank.tasks.find(t=>t.id===old.id);assert.equal(sha(path.join(root,'Backend/retired-expert/v1',old.name,'PROJECT_PROMPT.md')),old.promptSha256);assert.equal(current.input.sha256,old.input.sha256);assert.notEqual(current.promptSha256,old.promptSha256);assert.equal(current.pilot,null);}
});
test('negative-control reports retain exact grader and harness snapshots',()=>{
 for(const name of ['RaftTxnWorkbench','DurableCollab']){const dir=path.join(root,'Backend/pilots/20261016-v2/previous-v1-final',name),report=JSON.parse(fs.readFileSync(path.join(dir,'CHECKS.json')));assert.equal(report.mode,'previous-v1-negative-control');assert.equal(report.graderSha256,sha(path.join(dir,'GRADER.mjs')));assert.equal(report.harnessSha256,sha(path.join(dir,'HARNESS.mjs')));assert(!report.checks.some(c=>c.id==='harness-or-environment-terminal'));}
});
