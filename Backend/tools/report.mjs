import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const bank=JSON.parse(fs.readFileSync(path.join(root,'Backend/BANK.json'),'utf8'));
if(!bank.version.startsWith('1.'))throw Error('Historical 20261015 report is frozen. Use finish-expert-pilot.mjs for the expert registry; never overwrite old results with new tasks.');
const slugs=process.argv.slice(2);if(!slugs.length)slugs.push('backend-pilot-20261015');
const records=[];
for(const slug of slugs){const base=path.join(root,'sandbox/runs',slug);if(!fs.existsSync(base))continue;for(const n of fs.readdirSync(base)){const h=path.join(base,n);if(!fs.existsSync(path.join(h,'execution.json')))continue;
 const meta=JSON.parse(fs.readFileSync(path.join(h,'meta.json'),'utf8'));
 const execution=JSON.parse(fs.readFileSync(path.join(h,'execution.json'),'utf8'));
 const originalFile=fs.existsSync(path.join(h,'BASELINE.original.json'))?'BASELINE.original.json':'BASELINE.json';
 const initialBaseline=fs.existsSync(path.join(h,originalFile))?JSON.parse(fs.readFileSync(path.join(h,originalFile),'utf8')):null;
 const baseline=fs.existsSync(path.join(h,'BASELINE.recheck.json'))?JSON.parse(fs.readFileSync(path.join(h,'BASELINE.recheck.json'),'utf8')):initialBaseline;
 const output=fs.existsSync(path.join(h,'stdout.log'))?fs.readFileSync(path.join(h,'stdout.log'),'utf8'):'';
 const events=output.trim().split('\n').map(x=>{try{return JSON.parse(x);}catch{return null;}}).filter(Boolean);
 const last=events.filter(e=>e.type==='turn.completed').at(-1);
 const provider=fs.existsSync(path.join(h,'provider_evidence.json'))?JSON.parse(fs.readFileSync(path.join(h,'provider_evidence.json'),'utf8')):null;
 const files={};function walk(dir,rel=''){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git'].includes(ent.name))continue;const name=path.posix.join(rel,ent.name),p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,name);else files[name]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}
 if(fs.existsSync(meta.workdir))walk(meta.workdir);
 records.push({modelSlug:slug,project:meta.project,projectRel:meta.project_rel,runId:meta.run_id,harness:path.relative(root,h).replaceAll('\\','/'),workdir:meta.workdir,promptSha256:meta.prompt_sha256,status:execution.status,generationSeconds:execution.elapsed_seconds,wallLimitSeconds:execution.wall_seconds,timedOut:execution.status==='timeout',overTimeBudget:execution.elapsed_seconds>480,basicCompleted:execution.status==='completed'&&baseline?.allPassed===true&&['PASS','PASS_WITH_WARNINGS'].includes(meta.verdict),reviewVerdict:meta.verdict??null,reviewOverride:meta.review_override??null,reviewPathTokenFix:meta.review_path_token_fix??null,actualModelTrace:provider?.actual_model??null,usage:provider?.usage??last?.usage??null,baseline,initialBaseline,files,isolationVerification:'unverified'});
}}
const dest=path.join(root,'Backend/pilots/20261015');fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'results.json'),JSON.stringify({schemaVersion:1,createdAt:new Date().toISOString(),criteria:{slowSeconds:480,hardWallSeconds:600,independentSamplesPerPrompt:1,concurrency:2},records},null,2)+'\n');
const active=bank.tasks.filter(t=>t.status==='active');
const rows=records.map(r=>`| ${r.runId} | ${r.status} | ${r.generationSeconds.toFixed(1)} | ${r.baseline?`${r.baseline.passed}/${r.baseline.total}`:'待验收'} | ${r.baseline?.validationSeconds??'—'} | ${r.overTimeBudget?'超时长预算':'预算内'} |`).join('\n');
const selected=active.map(t=>({t,r:records.filter(r=>r.promptSha256===t.promptSha256).at(-1)}));
const accepted=selected.filter(({r})=>r?.basicCompleted&&!r.overTimeBudget);
const mmss=s=>`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;
const activeRows=selected.map(({t,r})=>{const status=!r?'待测':r.basicCompleted&&!r.overTimeBudget?'基础通过':r.overTimeBudget?'耗时超线':'待复核/未通过';const source=t.pilot?.sourceReadme||t.pilot?.sourceBundle+'/PILOT-NOTE.md';const evidence=r?`[报告](../${r.harness}/${fs.existsSync(path.join(root,r.harness,'BASELINE.recheck.json'))?'BASELINE.recheck.json':'BASELINE.json'})`:'—';const shot=r&&(fs.existsSync(path.join(root,r.harness,'baseline-ui.png'))?'baseline-ui.png':fs.existsSync(path.join(root,r.harness,'baseline-evidence/U02.png'))?'baseline-evidence/U02.png':null);return `| ${t.id} | ${t.level} | [${t.title}](../${t.prompt}) | ${r?mmss(r.generationSeconds):'—'} | ${r?.baseline?`${r.baseline.passed}/${r.baseline.total}`:'—'} | ${status} | ${evidence}${shot?` · [截图](../${r.harness}/${shot})`:''}${t.pilot?` · [源码](../${source})`:''} |`;}).join('\n');
const average=accepted.length?accepted.reduce((n,{r})=>n+r.generationSeconds,0)/accepted.length:0;
const assessments={B01:'历史 L1 上沿；三代组件受控适配接近 L2，真实站点另验。',B02:'L1：有限输入、请求超时、并发上限与可视化报告。',B03:'L2：真实内容判重、文件边界与持久结果；用时接近筛选线。',B04:'L2：HTTP 跳转、幂等别名与并发持久计数。',B05:'L3：乱序事件、版本缺口、去重与状态机的确定性投影。',B06:'L3：限流窗口与熔断恢复，重点在失败和并发边界。',B07:'L4 候选：跨进程事务、幂等与审计链；用时接近筛选线。',B08:'L4 候选：预占、支付、取消、过期竞争与总量守恒。'};
const assessmentRows=selected.map(({t})=>`| ${t.id} | ${assessments[t.id]} |`).join('\n');
const md=[
 '# 后端题库基础试测与时间筛选',
 '日期：2026-10-15（Asia/Shanghai）。',
 `当前 **${active.length} 题**，L1–L4 各 2 题；**${accepted.length}/${active.length}** 已在 480 秒内正常结束并通过独立基础检查。累计试测 ${records.length} 个题面版本，退役 ${bank.history?.length||0} 个，旧版本不计入有效题库。有效题平均生成用时 ${mmss(average)}。`,
 '本机默认 gpt-6-astra / high；CLI 0.162.0-alpha.17.2。每题独立新会话，600 秒硬上限、480 秒筛选线，最多同时运行 2 个生成进程。每版题面只进行一次生成；这是基础工程筛选。模型与 token 用量来自运行时 trace / CLI 事件，缺失值保留 null。',
 '生成用时包含读取、思考、实现、自测与工具等待，不含排队及独立验收。达到截止时间的样本是右删失数据，不能写成“600 秒完成”。通过数是基础检查计数，各题分母不同，不是统一百分制成绩。',
 '## 当前有效题目',
 '| ID | 等级 | 题目 | 生成用时 | 基础检查 | 结论 | 复核入口 |\n|---|---|---|---:|---:|---|---|\n'+activeRows,
 'B01 的 26 项包含“脚本存在”及原有 25 项回放检查；既有行为权重为 100 分。B01 派发的是题面与契约合并的试测输入，实际输入哈希见 meta/results，不与历史轨道混排。',
 '## 难度观察',
 '| ID | 观察 |\n|---|---|\n'+assessmentRows,
 '本轮强模型全部基础通过，尚不足以证明 L1–L4 的跨模型区分度。等级按正确性边界分层，用时不必随等级单调增加；L4 当前以事务一致性与审计为目标等级，完整故障矩阵和更多模型样本仍需后续校准。B03、B07 只有数秒预算余量，后续应优先复测其用时稳定性。',
 '## 全部试次与替换证据',
 '| 试次 | 进程结果 | 生成/截止秒数 | 复核检查 | 验收秒数 | 时间筛选 |\n|---|---|---:|---:|---:|---|\n'+rows,
 '完整记录、初始/复核结果和输出文件哈希：[results.json](pilots/20261015/results.json)。原始日志、execution.json、题面快照、BASELINE 和截图保存在对应 harness；合格交付的源码副本位于 submissions，含逐文件哈希与省略项清单。源码副本是模型试测输出，独立评分器未以它作为金标。',
 '## 验收器与题面复核记录',
 '初始报告全部保留。通用 D1 曾把题面提及 HTML 误当成必须交付独立 .html 文件；已按“运行时生成报告/服务端渲染”的明确契约复核，原机器判定与更正理由保存在 meta/REVIEW。早期基础检查漏了 README 必交项，已补齐并对相关旧样本复核。',
 'Webhook 题没有规定 attempts 的数组顺序，独立断言改为验证两次真实投递及状态集合，保留 BASELINE.original 并重新验证。退役日志精简版的 total 口径不够明确，复核接受合法行数/全部非空行数两种解释；当前有效题已改为字段含义明确的 HTTP 探针。',
 '通用 H3 原先把普通词“暂存”误判为路径痕迹；现在只对路径形式的该词触发，3 组回归测试仍确认真实目录和仓库路径可被发现。相关原始 INVALID 判定另存，复核记录没有声称 OS 访问隔离已证实。',
 '界面检查包含实际浏览器启动、可见结果与截图，但未穷尽每个交互；有限故障用例也不代表完整混沌认证。账本的强制终止是否命中窗口见 acknowledged-persistence 的 detail，未命中时只记跨进程持久化覆盖。B01 已知的点击遮挡/Storage 属性赋值漏检仍见 [专项报告](BILIBILI_AUTOMATION.md)。',
 '## 判定与复现',
 '超过 480 秒的版本替换，600 秒未退出标记生成未完成；模型输出的文件出现时间不能代替交付完成。功能缺项、题面歧义、评分器误报和模型接口/环境错误分别记录。新题使用相同模型配置与预算重新生成，候选答案不作人工修补。',
 '运行入口见 [RUN_PROTOCOL.md](RUN_PROTOCOL.md)。本轮为外部工作目录加观测的基础试测，isolationVerification 保持 unverified；结果不作为正式跨模型排名。',
 ].join('\n\n')+'\n';
fs.writeFileSync(path.join(root,'Backend/PILOT_REPORT.md'),md);
console.log(JSON.stringify({attempts:records.length,activeTasks:active.length,withinBudgetAndPassed:accepted.length,meanSeconds:average},null,2));
