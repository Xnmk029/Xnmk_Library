import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,sha} from './expert-v2-lib.mjs';
const dir=path.join(root,'Backend/pilots/20261016-v2'),bankFile=path.join(root,'Backend/BANK.json'),bank=JSON.parse(fs.readFileSync(bankFile));
assert(bank.tasks.filter(t=>t.level==='L4').every(t=>t.track==='repository-expert-v2'&&t.pilot===null));
const tap=path.join(dir,'ORACLE_TESTS.tap'),tests=fs.readFileSync(tap,'utf8');assert.match(tests,/# fail 0\b/);const passedUnitTests=Number(tests.match(/# pass (\d+)/)[1]);
const requirements={RaftTxnWorkbench:['R2-ReadIndex-no-log-growth','R2-linearizable-member-view'],DurableCollab:['C2-state-has-persistent-epoch','C2-missing-epoch-rejected-before-update','C2-checkpoint-endpoint']};
const records=[];
for(const [task,expectedFailures]of Object.entries(requirements)){
 const base=path.join(dir,'previous-v1-final',task),file=path.join(base,'CHECKS.json'),report=JSON.parse(fs.readFileSync(file));
 assert.equal(report.mode,'previous-v1-negative-control');assert.equal(report.graderSha256,sha(path.join(base,'GRADER.mjs')));assert.equal(report.harnessSha256,sha(path.join(base,'HARNESS.mjs')));
 for(const id of expectedFailures)assert.equal(report.checks.find(c=>c.id===id)?.status,'FAIL',task+' did not demonstrate intended strengthening');
 assert(!report.checks.some(c=>c.id==='harness-or-environment-terminal'));
 const setup=task==='RaftTxnWorkbench'?['R2-build','R2-three-node-ready']:['C2-install-locked-dependencies','C2-server-start'];for(const id of setup)assert.equal(report.checks.find(c=>c.id===id)?.status,'PASS');
 const entry=bank.tasks.find(t=>t.name===task),evidence=path.relative(root,file).split(path.sep).join('/');
 entry.title=task==='RaftTxnWorkbench'?'Raft 在线换节点与无日志读取':'检查点恢复与跨进程世代隔离';
 entry.validation={status:'new-contract-negative-control-validated',report:'Backend/EXPERT_V2.md',additionalGate:'Backend/tools/expert-v2-evaluate.mjs',negativeControl:evidence,previousResultsApplicable:false,fullV2Pilot:'pending',positiveEndToEndCalibration:'pending'};
 const record={task,taskId:entry.id,kind:'previous-v1-negative-control',evidence,sha256:sha(file),expectedRejections:expectedFailures,observedExpectedRejections:expectedFailures.length,blocked:report.blocked,scope:report.scope};
 if(task==='RaftTxnWorkbench'){const first=report.events.findIndex(e=>e.url==='/v1/kv?key=base'),before=report.events.slice(0,first).filter(e=>e.url==='/v1/status').at(-1),after=report.events.slice(first).find(e=>e.url==='/v1/status');assert(before&&after);record.readOnlyInterval={beforeApplied:before.data.appliedIndex,afterApplied:after.data.appliedIndex,beforeTerm:before.data.term,afterTerm:after.data.term};}
 records.push(record);
}
bank.status='expert-v2-negative-controls-validated';fs.writeFileSync(bankFile,JSON.stringify(bank,null,2)+'\n');
const oldReport=path.join(root,'Backend/EXPERT_UPGRADE_REPORT.md'),frozen=path.join(dir,'EXPERT_V1.frozen.md');if(!fs.existsSync(frozen))fs.copyFileSync(oldReport,frozen);
let oldText=fs.readFileSync(oldReport,'utf8');if(!oldText.startsWith('> v1 历史报告'))fs.writeFileSync(oldReport,'> v1 历史报告：当前 L4 已强化为 v2，现行题面及新增门槛见 [EXPERT_V2.md](EXPERT_V2.md)。本页保留当时的用时、成绩与失败记录。\n\n'+oldText);
const result={schemaVersion:1,createdAt:new Date().toISOString(),kind:'question-strengthening-validation',activeTasks:8,newGenerationTiming:null,fullV2Pilot:'pending',positiveEndToEndCalibration:'pending',hardBudgetSeconds:1800,oracleTests:{passed:passedUnitTests,failed:0,evidence:'Backend/pilots/20261016-v2/ORACLE_TESTS.tap',sha256:sha(tap)},v1ReportSnapshot:{file:'Backend/pilots/20261016-v2/EXPERT_V1.frozen.md',sha256:sha(frozen)},records};
fs.writeFileSync(path.join(dir,'RESULTS.json'),JSON.stringify(result,null,2)+'\n');
const raft=records.find(r=>r.task==='RaftTxnWorkbench'),interval=raft.readOnlyInterval;
const content=`<!-- EXPERT-V2-CONTROLS:START -->\n\n判定器/快照检查 **${passedUnitTests}/${passedUnitTests} 通过**，见 [ORACLE_TESTS.tap](pilots/20261016-v2/ORACLE_TESTS.tap)。旧交付回放实际检出了以下新增门槛：\n\n| 旧交付 | 自动检出的不满足项 | 后续未执行场景 | 证据 |\n|---|---|---:|---|\n| Raft v1 | 64 次读使 appliedIndex 从 ${interval.beforeApplied} 增至 ${interval.afterApplied}；缺少成员 API | ${raft.blocked} 项 BLOCKED | [回放](pilots/20261016-v2/previous-v1-final/RaftTxnWorkbench/CHECKS.json) |\n| 协同 v1 | 无 epoch；缺失 epoch 的写入仍成功；无检查点 API | ${records.find(r=>r.task==='DurableCollab').blocked} 项 BLOCKED | [回放](pilots/20261016-v2/previous-v1-final/DurableCollab/CHECKS.json) |\n\nRaft 旧实现仍通过“丢失 quorum 后不能复用旧屏障”的检查；被淘汰的原因是新增能力不足，不是把其原有正确性判错。后续配置迁移/恢复场景因前置 API 缺失没有实际运行，不能按失败数量夸大区分度。这里的 FAIL 是预期的旧版本负对照结果，不是新模型成绩。\n\n[机读记录](pilots/20261016-v2/RESULTS.json) 包含题面版本、证据哈希与验证范围；执行时的 GRADER.mjs/HARNESS.mjs 快照与原始请求响应同目录保留。\n\n<!-- EXPERT-V2-CONTROLS:END -->`;
const reportFile=path.join(root,'Backend/EXPERT_V2.md');fs.writeFileSync(reportFile,fs.readFileSync(reportFile,'utf8').replace(/<!-- EXPERT-V2-CONTROLS:START -->[\s\S]*?<!-- EXPERT-V2-CONTROLS:END -->/,content));
console.log(JSON.stringify({oracleTests:passedUnitTests,negativeControlRejections:records.map(r=>({task:r.task,expected:r.observedExpectedRejections,blocked:r.blocked})),fullV2Pilot:'pending'}));
