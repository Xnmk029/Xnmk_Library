import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const bank=JSON.parse(fs.readFileSync(path.join(root,'Backend/BANK.json'),'utf8'));
const active=bank.tasks.filter(t=>t.status==='active');
const start='<!-- VISUAL-BACKEND:START -->',end='<!-- VISUAL-BACKEND:END -->';
function block(text,content){const a=text.indexOf(start);if(a>=0){const z=text.indexOf(end,a);return text.slice(0,a)+content+text.slice(z+end.length);}return text.trimEnd()+'\n\n'+content+'\n';}
{
 const file=path.join(root,'Backend/README.md');let text=fs.readFileSync(file,'utf8');
 const time=s=>`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;
 const rows=active.map(t=>`| ${t.id} | ${t.level} | [${t.title}](../${t.prompt}) | ${t.pilot?time(t.pilot.generationSeconds):'待测'} | ${t.pilot?`${t.pilot.passed}/${t.pilot.total} ${t.pilot.passed===t.pilot.total?'通过':'部分通过'}`:'待验收'} |`).join('\n');
 const content=`${start}\n\n## 当前有效题目\n\n| ID | 等级 | 题面 | 生成用时 | 独立检查 |\n|---|---|---|---:|---|\n${rows}\n\n[20261015 基础试测](PILOT_REPORT.md) · [L4 v1 历史试测](EXPERT_UPGRADE_REPORT.md) · [L4 v2 强化与反例验证](EXPERT_V2.md) · [运行方法](RUN_PROTOCOL.md)。现行 L4 v2 增加 ReadIndex、在线换节点和 epoch 恢复隔离，保持 1800 秒预算；旧用时/成绩不沿用，新版本尚待完整生成试测。下方保留初版构思，实际派发以本表和 BANK.json 为准。\n\n${end}`;
 if(!text.includes(start))text=text.replace('## 选题依据',content+'\n\n## 选题依据');else text=block(text,content);
 text=text.replace('## 总览','## 初版构思总览（供替换前后对照）');fs.writeFileSync(file,text);
}
for(const [file,en] of [['README.md',false],['README.en.md',true]]){
 let text=fs.readFileSync(path.join(root,file),'utf8');
 text=text.replace(/^\*\*候选扩展：[^\n]*\n/m,'');
 const rows=active.map(t=>`| ${t.id} | ${t.level} | [${t.title}](./${t.project}/README.md) | [${en?'Prompt':'题面'}](./${t.prompt}) |`).join('\n');
 const content=`${start}\n\n## ${en?'Visual Backend Suite':'脚本与可视化后端题库'}\n\n${en?'Eight registered tasks, two per level. B01 reuses the existing Bilibili task; seven projects are newly registered. Timing and difficulty are being calibrated in independent CLI sessions.':'已登记 8 题，L1–L4 各 2 题；B01 沿用现有 B 站项目，其余 7 个项目新增入库。基础测试、完成时间及替换记录见题库报告。'}\n\n[${en?'Suite and pilot results':'题库、试测结果与耗时'}](./Backend/README.md) · [${en?'Machine-readable registry':'机读登记'}](./Backend/BANK.json)\n\n| ID | Level | ${en?'Task':'题目'} | ${en?'Input':'派发输入'} |\n|---|---|---|---|\n${rows}\n\n${end}`;
 text=block(text,content);
 const names=['L1_Basic','L2_Intermediate','L3_Advanced','L4_Expert'];let total=0;
 for(const lv of names){const count=fs.readdirSync(path.join(root,lv)).filter(n=>fs.existsSync(path.join(root,lv,n,'PROJECT_PROMPT.md'))).length;total+=count;const re=new RegExp('('+lv+'/[^\\n]*[（(])\\d+( 个项目| projects)[）)]');text=text.replace(re,`$1${count}$2${en?')':'）'}`);}
 if(en)text=text.replace(/\*\*\d+ benchmark projects\*\* \(L1–L4\)/,`**${total} benchmark projects** (L1–L4)`);else text=text.replace(/\*\*\d+ 个独立测试项目\*\*（L1–L4）/,`**${total} 个独立测试项目**（L1–L4）`);
 fs.writeFileSync(path.join(root,file),text);
}
for(const [file,en] of [['DOMAIN_INDEX.zh.md',false],['DOMAIN_INDEX.en.md',true]]){
 let text=fs.readFileSync(path.join(root,file),'utf8');
 if(en)text=text.replace(/All \d+ benchmark projects organized by \*\*\d+ technical domains\*\*[^\n]*/, 'Benchmark prompts are organized by technical domain, with a registered visual backend suite below. Every prompt is embedded in full or linked to its versioned dispatch input.');
 else text=text.replace(/全部 \d+ 个测试项目按 \*\*\d+ 大技术领域\*\*[^\n]*/, '测试项目按技术领域归类，另含已登记的脚本与可视化后端题组。提示词全文内嵌在下方，或链接到各自版本的派发输入。');
 text=text.replace(/^\| \[.*\]\(#backend\)[^\n]*\n/gm,'');
 const nav=`| [${en?'Visual Backend Suite':'脚本与可视化后端'}](#backend) | 8 | ${active.map(t=>t.name).join(' · ')} |\n`;
 const pos=text.indexOf('\n---',text.indexOf(en?'## Quick Navigation':'## 快速导航'));
 if(pos>=0){const last=text.lastIndexOf('|',pos),insert=text.indexOf('\n',last)+1;text=text.slice(0,insert)+nav+text.slice(insert);}
 const rows=active.map(t=>`| ${t.id} | ${t.level} | [${t.title}](./${t.prompt}) |`).join('\n');
 const prompts=active.filter(t=>t.id!=='B01').map(t=>`### ${t.id} · ${t.title}\n\n[${en?'Source':'源题面'}](./${t.prompt})\n\n<details>\n<summary>📋 ${en?'Full prompt':'提示词全文'}</summary>\n\n\`\`\`text\n${fs.readFileSync(path.join(root,t.prompt),'utf8').trimEnd()}\n\`\`\`\n\n</details>`).join('\n\n');
 const content=`${start}\n\n<a id="backend"></a>\n\n## ${en?'Scripts and Visual Backend':'脚本与可视化后端'}\n\n${en?'Cross-domain suite: eight active tasks, B01 reuses the existing task rather than counting as a ninth project.':'跨领域题组：8 个有效题目，B01 复用既有项目，不重复增加项目数。'} [${en?'Registry and timing calibration':'登记与时间校准'}](./Backend/README.md)。\n\n| ID | Level | ${en?'Prompt':'题面'} |\n|---|---|---|\n${rows}\n\n${prompts}\n\n${end}`;
 text=block(text,content);fs.writeFileSync(path.join(root,file),text);
}
console.log('Synced '+active.length+' active tasks into both README and domain indexes.');
