import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const bankFile=path.join(root,'Backend/BANK.json'),bank=JSON.parse(fs.readFileSync(bankFile,'utf8'));
const allowed=new Set(['.js','.mjs','.cjs','.ts','.html','.css','.md','.json','.txt','.jsonl','.sql','.svg','.png','.jpg','.webp','.woff2']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const runs=[];for(const slug of ['backend-pilot-20261015','backend-replacement-20261015']){const base=path.join(root,'sandbox/runs',slug);for(const n of fs.readdirSync(base)){const h=path.join(base,n);if(fs.existsSync(path.join(h,'meta.json'))&&fs.existsSync(path.join(h,'execution.json')))runs.push({h,m:JSON.parse(fs.readFileSync(path.join(h,'meta.json'),'utf8')),e:JSON.parse(fs.readFileSync(path.join(h,'execution.json'),'utf8'))});}}
for(const task of bank.tasks.filter(t=>t.status==='active')){
 const run=runs.find(r=>r.m.prompt_sha256===task.promptSha256&&r.e.status==='completed'&&r.e.elapsed_seconds<=480);
 if(!run||!['PASS','PASS_WITH_WARNINGS'].includes(run.m.verdict))continue;
 const scoreFile=path.join(run.h,fs.existsSync(path.join(run.h,'BASELINE.recheck.json'))?'BASELINE.recheck.json':'BASELINE.json');if(!fs.existsSync(scoreFile))continue;const score=JSON.parse(fs.readFileSync(scoreFile,'utf8'));if(!score.allPassed)continue;
 const rel=`Backend/pilots/20261015/submissions/${task.id}`,dest=path.join(root,rel),files={},omitted=[];fs.mkdirSync(dest,{recursive:true});
 function walk(dir,prefix=''){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const name=path.posix.join(prefix,ent.name),src=path.join(dir,ent.name),st=fs.lstatSync(src);if(st.isSymbolicLink()){omitted.push({path:name,reason:'link'});continue;}if(ent.name.startsWith('.')||ent.name==='node_modules'||ent.name==='PROMPT.md')continue;if(ent.isDirectory()){walk(src,name);continue;}if(!allowed.has(path.extname(name).toLowerCase())||st.size>4*1024*1024){omitted.push({path:name,reason:'runtime/binary or over 4 MiB'});continue;}const bytes=fs.readFileSync(src),target=path.join(dest,name);if(fs.existsSync(target)&&sha(fs.readFileSync(target))!==sha(bytes))throw Error('Refusing changed source overwrite: '+target);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files[name]=sha(bytes);}}
 walk(run.m.workdir);
 for(const [name,digest] of Object.entries(files))if(sha(fs.readFileSync(path.join(run.m.workdir,name)))!==digest)throw Error('Source changed during archive: '+name);
 const readme=Object.keys(files).find(n=>n.toLowerCase()==='readme.md')||null;
 const manifest={taskId:task.id,runId:run.m.run_id,modelSlug:run.m.model,promptSha256:task.promptSha256,generationSeconds:run.e.elapsed_seconds,scoreSha256:sha(fs.readFileSync(scoreFile)),scope:'pilot model output, not reference gold; source and small fixtures retained, runtime state omitted',files,omitted};
 fs.writeFileSync(path.join(dest,'PILOT-SNAPSHOT.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(dest,'PILOT-NOTE.md'),`# 试测源码副本\n\n题号 ${task.id}，试次 ${run.m.run_id}，生成用时 ${run.e.elapsed_seconds} 秒。此副本是本轮模型输出，供复看与运行，不是规范金标。保留普通源码、文档与小型夹具；数据库、日志、链接及大文件不纳入源码包。原始提交全量文件哈希见题库试测 results.json，副本逐文件哈希和省略项见 PILOT-SNAPSHOT.json。\n`);
 task.pilot={status:'basic-complete',generationSeconds:run.e.elapsed_seconds,passed:score.passed,total:score.total,sourceBundle:rel,sourceReadme:readme?rel+'/'+readme:null,evidence:path.relative(root,scoreFile).replaceAll('\\','/')};
 console.log(task.id+' archived '+Object.keys(files).length+' source files');
}
fs.writeFileSync(bankFile,JSON.stringify(bank,null,2)+'\n');
