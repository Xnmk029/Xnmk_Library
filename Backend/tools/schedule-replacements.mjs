import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const oldSlug=process.argv[2]||'backend-pilot-20261015',newSlug=process.argv[3]||'backend-replacement-20261015';
const python='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const running=new Map(),attempted=new Set();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function runs(slug){const base=path.join(root,'sandbox/runs',slug);return fs.readdirSync(base).map(n=>path.join(base,n)).filter(h=>fs.existsSync(path.join(h,'meta.json'))).map(h=>({h,meta:JSON.parse(fs.readFileSync(path.join(h,'meta.json'),'utf8')),done:fs.existsSync(path.join(h,'execution.json'))}));}
let failed=false;
while(true){
 const old=runs(oldSlug),fresh=runs(newSlug),remainingOld=old.filter(r=>!r.done).length;
 const pending=fresh.filter(r=>!r.done&&!running.has(r.meta.project)&&!attempted.has(r.meta.project));
 let available=Math.max(0,2-remainingOld-running.size);
 for(const item of pending.slice(0,available)){
  attempted.add(item.meta.project);
  const child=spawn(python,['sandbox/scripts/cli_suite.py','execute','--model',newSlug,'--adapter','Backend/tools/pilot-adapter.json','--jobs','1','--wall','600','--only',item.meta.project],{cwd:root,env:{...process.env,PYTHONUTF8:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  running.set(item.meta.project,child);let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  child.on('error',e=>{failed=true;console.error(String(e));running.delete(item.meta.project);});
  child.on('exit',code=>{fs.writeFileSync(path.join(item.h,'replacement-controller.log'),log);running.delete(item.meta.project);if(code!==0)failed=true;console.log('replacement ended '+item.meta.project+' controller='+code);});
  console.log('replacement started '+item.meta.project+'; total generation slots <= 2');
 }
 if(failed){process.exitCode=1;break;}
 if(runs(newSlug).every(r=>r.done)&&running.size===0)break;
 await sleep(3000);
}
