// Wait for measured CLI completion, then independently verify immutable submissions.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),label=process.argv[2]??'backend-expert-open-20261016';
const suite=JSON.parse(fs.readFileSync(path.join(root,'sandbox/runs',label,'suite-'+label+'.json')));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await Promise.all(suite.runs.map(async run=>{
 const execution=path.join(run.harness,'execution.json');const end=Date.now()+2100000;
 while(!fs.existsSync(execution)&&Date.now()<end)await pause(2000);
 if(!fs.existsSync(execution))throw Error('Execution record missing: '+run.project);
 const e=JSON.parse(fs.readFileSync(execution));
 const out=path.join(root,'Backend/pilots/20261016',run.project);
 if(fs.existsSync(path.join(out,'candidate')))throw Error('Refusing to overwrite evidence');
 console.log('Verifying '+run.project+' after '+e.status+' in '+e.elapsed_seconds+'s');
 const args=[path.join(root,'Backend/tools/expert-evaluate.mjs'),run.project,path.join(run.workdir,'repo'),out];
 if(run.project==='RaftTxnWorkbench')args.push('--extended');
 await new Promise((resolve,reject)=>{const c=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:'inherit'});c.on('error',reject);c.on('exit',code=>code===0?resolve():reject(Error(run.project+' verifier exited '+code)));});
}));
