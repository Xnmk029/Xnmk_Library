import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),bankFile=path.join(root,'Backend/BANK.json');
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const dir=path.join(root,'Backend/pilots/20261016-v2'),snapshot=path.join(dir,'previous-BANK.json');
const bank=JSON.parse(fs.readFileSync(bankFile));
if(process.argv[2]==='archive'){
 assert(!fs.existsSync(snapshot),'Previous version already archived');fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(bankFile,snapshot);
 for(const t of bank.tasks.filter(t=>t.level==='L4')){
  assert.equal(sha(path.join(root,t.prompt)),t.promptSha256);
  const dest=path.join(root,'Backend/retired-expert/v1',t.name);assert(!fs.existsSync(dest));fs.mkdirSync(dest,{recursive:true});
  for(const f of ['PROJECT_PROMPT.md','README.md','PROMPT_REGISTRY.json','STARTER_LOCK.json','UPSTREAM.json','starter.tar'])fs.copyFileSync(path.join(root,t.project,f),path.join(dest,f));
  fs.writeFileSync(path.join(dest,'ARCHIVE_NOTE.md'),'# 专家题 v1 冻结副本\n\n因用户要求继续提高难度，当前题面升级为 v2。本目录保留 v1 输入字节和哈希；README 亦为原始快照，其相对链接不作为现行入口。旧成绩仍位于 Backend/EXPERT_UPGRADE_REPORT.md 与 Backend/pilots/20261016。\n');
 }
 console.log('Frozen expert v1 inputs and registry.');
}else if(process.argv[2]==='register'){
 const previous=JSON.parse(fs.readFileSync(snapshot));assert.equal(bank.version,previous.version,'Unexpected concurrent bank update');
 for(const t of bank.tasks.filter(t=>t.level==='L4')){
  const old=previous.tasks.find(x=>x.id===t.id),archive='Backend/retired-expert/v1/'+t.name;
  assert.equal(sha(path.join(root,archive,'PROJECT_PROMPT.md')),old.promptSha256);
  const digest=sha(path.join(root,t.prompt));assert.notEqual(digest,old.promptSha256,'Missing stronger prompt');
  bank.history.push({...old,status:'retired',retiredAt:'2026-10-16',retiredReason:'user-requested-expert-v2-strengthening',originalPrompt:old.prompt,prompt:archive+'/PROJECT_PROMPT.md',archivedProject:archive,replacementProject:t.project,replacementPromptSha256:digest});
  t.version='2.0.0';t.track='repository-expert-v2';t.promptSha256=digest;t.pilot=null;
  t.title=t.name==='RaftTxnWorkbench'?'Raft 在线换节点与无日志读取':'检查点恢复与跨进程世代隔离';
  t.previousVersion={prompt:archive+'/PROJECT_PROMPT.md',promptSha256:old.promptSha256,report:'Backend/EXPERT_UPGRADE_REPORT.md'};
  t.validation={status:'new-contracts-under-validation',report:'Backend/EXPERT_V2.md',previousResultsApplicable:false};
  t.budget={hardSeconds:1800,replacementRule:'Keep expert correctness boundaries; report timeouts as censored measurements. No 480-second simplification rule.'};
  const regFile=path.join(root,t.project,'PROMPT_REGISTRY.json'),reg=JSON.parse(fs.readFileSync(regFile));reg.sha256=digest;reg.note='Expert v2; same public upstream starter, stronger public protocol. Prior expert v1 source/score are not inputs.';fs.writeFileSync(regFile,JSON.stringify(reg,null,2)+'\n');
 }
 bank.version='3.0.0-expert-v2-candidate';bank.status='expert-v2-contract-validation';bank.updatedAt='2026-10-16';assert.equal(bank.tasks.length,8);
 fs.writeFileSync(bankFile,JSON.stringify(bank,null,2)+'\n');console.log('Registered v2; old timing/score removed from active L4 rows.');
}else throw Error('usage: node upgrade-expert-v2.mjs archive|register');
