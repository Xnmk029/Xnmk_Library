import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),file=path.join(root,'Backend/BANK.json');
const bank=JSON.parse(fs.readFileSync(file));
if(bank.tasks.some(t=>t.name==='RaftTxnWorkbench'))throw Error('Already upgraded; will not re-retire or overwrite historical evidence');
const frozen=path.join(root,'Backend/pilots/20261015/BANK.snapshot.json');
if(fs.existsSync(frozen))throw Error('Historical snapshot already exists');
fs.copyFileSync(file,frozen);
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [id,name,title] of [['B07','RaftTxnWorkbench','Raft 条件事务与分区恢复'],['B08','DurableCollab','双进程持久协同与无损压缩']]){
 const index=bank.tasks.findIndex(t=>t.id===id),old=bank.tasks[index];
 const src=path.resolve(root,old.project),archive=path.resolve(root,'Backend/retired',old.name);
 // Validate both absolute targets before moving a directory on Windows.
 if(!src.startsWith(root+path.sep)||!archive.startsWith(path.join(root,'Backend/retired')+path.sep))throw Error('Unsafe archive target');
 if(fs.existsSync(archive))throw Error('Archive exists: '+archive);
 if(hash(path.join(src,'PROJECT_PROMPT.md'))!==old.promptSha256)throw Error('Old prompt changed');
 fs.renameSync(src,archive);
 const archivedProject=path.relative(root,archive).split(path.sep).join('/');
 bank.history.push({...old,status:'retired',retiredAt:'2026-10-16',retiredReason:'user-requested-expert-difficulty-upgrade',originalPrompt:old.prompt,prompt:archivedProject+'/PROJECT_PROMPT.md',archivedProject,replacementProject:'L4_Expert/'+name});
 const readme=path.join(archive,'README.md');
 fs.writeFileSync(readme,`> 2026-10-16 退役：用户要求提升 L4 难度，替换为 [${title}](../../../L4_Expert/${name}/README.md)。原题面与 20261015 试测证据保留；本次退役原因不是超时。\n\n`+fs.readFileSync(readme,'utf8'));
 const project='L4_Expert/'+name,upstream=JSON.parse(fs.readFileSync(path.join(root,project,'UPSTREAM.json')));
 const input=JSON.parse(fs.readFileSync(path.join(root,project,'STARTER_LOCK.json')));
 bank.tasks[index]={id,level:'L4',name,title,project,prompt:project+'/PROJECT_PROMPT.md',dispatchProject:project,status:'active',track:'repository-expert-v1',replaces:old.project,promptSha256:hash(path.join(root,project,'PROJECT_PROMPT.md')),input:{file:project+'/starter.tar',sha256:input.sha256,lock:project+'/STARTER_LOCK.json'},upstream:{url:upstream.url,commit:upstream.commit,license:upstream.license},budget:{hardSeconds:1800,replacementRule:'expert correctness and measured workload review; no 480-second cutoff'},validation:{status:'pilot-running',report:'Backend/EXPERT_UPGRADE_REPORT.md',environment:'Backend/pilots/20261016/environment/CHECKS.json'},pilot:null};
}
bank.version='2.0.0-expert-pilot';bank.updatedAt='2026-10-16';bank.status='expert-upgrade-pilot';
if(bank.tasks.length!==8||['L1','L2','L3','L4'].some(l=>bank.tasks.filter(t=>t.level===l).length!==2))throw Error('Bank cardinality changed');
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');
console.log('Registered expert upgrades; 8 active tasks, old prompts preserved.');
