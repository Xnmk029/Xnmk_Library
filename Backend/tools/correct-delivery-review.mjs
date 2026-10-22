import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const names=new Set(['HttpHealthProbe','LedgerAudit','DirectorySyncReport','TransactionalRename','OrderEventReplay','LocalShortLinks']);
for(const slug of ['backend-pilot-20261015','backend-replacement-20261015']){
 const base=path.join(root,'sandbox/runs',slug);for(const n of fs.readdirSync(base)){const h=path.join(base,n),file=path.join(h,'meta.json');if(!fs.existsSync(file))continue;const m=JSON.parse(fs.readFileSync(file,'utf8'));if(!names.has(m.project)||m.verdict!=='FAIL')continue;
 const failures=(m.review_checks||[]).filter(c=>c.status==='FAIL');if(failures.length!==1||failures[0].id!=='D1')continue;
 const prompt=fs.readFileSync(path.join(m.workdir,'PROMPT.md'),'utf8');if(!/报告由|生成.*HTML|HTML.*报告|服务端直接生成/.test(prompt))throw Error('Missing explicit generated-output contract');
 const verdict=(m.review_checks||[]).some(c=>c.status==='WARN')?'PASS_WITH_WARNINGS':'PASS';
 m.machine_verdict='FAIL';m.verdict=verdict;m.review_override={correctedCheck:'D1',originalMachineVerdict:'FAIL',reason:'The task explicitly generates HTML at runtime or serves it from server.js. It does not require a separate source .html deliverable. This correction concerns file form only; independent BASELINE results determine functional completion.',evidence:'PROMPT.md plus BASELINE.json / BASELINE.recheck.json',correctedAt:new Date().toISOString()};
 fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');fs.appendFileSync(path.join(h,'REVIEW.md'),`\n## 交付格式复核\n\n最终静态复核：**${verdict}**。D1 把题面中的 HTML 产物误判成必须随源码交付独立 .html 文件；题面明确由程序运行生成报告或由 server.js 渲染页面。原始机器 FAIL 保留，meta.json 记录有依据的 review_override。此项只校正交付格式，功能完成情况以独立 BASELINE 报告为准。\n`);console.log('Corrected runtime HTML delivery form: '+m.project);
 }
}
