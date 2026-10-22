import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'Backend/pilots/20261016/environment');
fs.mkdirSync(base,{recursive:true});
const checks=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const task of ['RaftTxnWorkbench','DurableCollab']){
 const p=path.join(root,'L4_Expert',task),lock=JSON.parse(fs.readFileSync(path.join(p,'STARTER_LOCK.json')));
 const good=hash(fs.readFileSync(path.join(p,'starter.tar')))===lock.sha256;
 checks.push({task,name:'frozen input hash',pass:good,sha256:lock.sha256});
 if(!good)throw Error('starter changed');
}
const go='F:/benchmark-tools/go1.23.12/go/bin/go.exe',cwd=path.join(root,'Backend/.cache/RaftTxnWorkbench/repo'),exe=path.join(base,'upstream.test.exe');
let r=spawnSync(go,['test','-c','-o',exe,'.'],{cwd,encoding:'utf8'});
fs.writeFileSync(path.join(base,'raft-compile.txt'),r.stdout+r.stderr);
checks.push({task:'RaftTxnWorkbench',name:'compile original upstream tests',pass:r.status===0});
if(r.status===0){
 const names=spawnSync(exe,['-test.list','.'],{encoding:'utf8'}).stdout.trim().split(/\r?\n/).filter(n=>n.startsWith('Test'));
 for(const name of names){
   // Windows cannot remove an open WAL immediately; original upstream tests reuse the
   // same directory across cases. Give each unmodified case a fresh process and cwd.
   const run=path.join(base,name);fs.mkdirSync(run,{recursive:true});
   r=spawnSync(exe,['-test.run','^'+name+'$','-test.timeout','60s','-test.v'],{cwd:run,encoding:'utf8',timeout:65000});
   fs.writeFileSync(path.join(base,name+'.txt'),(r.stdout??'')+(r.stderr??''));
   checks.push({task:'RaftTxnWorkbench',name,pass:r.status===0,status:r.status,error:String(r.error??'')});
 }
}
const ycwd=path.join(root,'Backend/.cache/DurableCollab/repo');
r=spawnSync(process.execPath,['C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js','test'],{cwd:ycwd,encoding:'utf8',timeout:60000});
fs.writeFileSync(path.join(base,'y-websocket-upstream-test.txt'),r.stdout+r.stderr);
checks.push({task:'DurableCollab',name:'upstream npm test (standard + tsc)',pass:r.status===0});
const Y=createRequire(path.join(ycwd,'package.json'))('yjs');
for(const deletion of [false,true]){
 const d=new Y.Doc(),us=[];d.on('update',u=>us.push(u));d.getText('text').insert(0,'abcdef');
 if(deletion)d.getText('text').delete(1,4);else d.getText('text').insert(6,'X');
 const pending=new Y.Doc();Y.applyUpdate(pending,us[1]);
 // Real negative control: a lossy compactor reconstructing a new doc from visible
 // text. Pinned Yjs encodeStateAsUpdate itself preserves pending structs/deletes.
 const bad=new Y.Doc();bad.getText('text').insert(0,pending.getText('text').toString());Y.applyUpdate(bad,us[0]);
 const good=new Y.Doc();Y.applyUpdate(good,Y.mergeUpdates([us[1]]));Y.applyUpdate(good,us[0]);
 const expected=d.getText('text').toString();
 checks.push({task:'DurableCollab',name:deletion?'delete-set negative control':'missing-struct negative control',pass:good.getText('text').toString()===expected&&bad.getText('text').toString()!==expected,expected,lossyResult:bad.getText('text').toString(),losslessResult:good.getText('text').toString()});
 for(const doc of [d,pending,bad,good])doc.destroy();
}
const report={createdAt:new Date().toISOString(),node:process.version,go:spawnSync(go,['version'],{encoding:'utf8'}).stdout.trim(),checks,passed:checks.filter(c=>c.pass).length,total:checks.length,note:'Engineering environment and negative-control validation; not model performance. Original raft tests run one fresh process/cwd per case to avoid known Windows WAL cleanup reuse.'};
fs.writeFileSync(path.join(base,'CHECKS.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
