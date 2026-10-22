import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

export const root=path.resolve(import.meta.dirname,'../..');
export const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function until(fn,ms=12000){let error;const end=Date.now()+ms;do{try{const value=await fn();if(value)return value;}catch(e){error=e;}await sleep(60);}while(Date.now()<end);throw error??Error('Timed out');}
export const port=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});});
export function assertReadOnlyInterval(before,after){assert.equal(after.term,before.term,'Read-only observation crossed a term change');assert.equal(after.leaderId,before.leaderId,'Read-only observation crossed a leader change');assert.equal(after.appliedIndex,before.appliedIndex,'GET appended hidden Raft log entries');}
export function assertEpochMismatch(response,epoch){assert.equal(response.status,409);assert.equal(response.data.error,'EPOCH_MISMATCH');assert.equal(response.data.epoch,epoch);}
function retained(f){const parts=f.split(path.sep);if(parts.some(p=>['node_modules','.git','.npm-cache','.cache','__pycache__'].includes(p)||/^raftexample-\d+(-snap)?$/.test(p)))return false;if(/\.(exe|db|sqlite|wal|snap|tmp)(-|$)/.test(f)||/-(wal|shm)$/.test(f))return false;return !fs.statSync(f).isFile()||fs.statSync(f).size<=8*1024*1024;}
function snapshot(dir){const files={};for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(!retained(f))continue;if(e.isDirectory())for(const [k,v]of Object.entries(snapshot(f)))files[e.name+'/'+k]=v;else if(e.isFile())files[e.name]=sha(f);}return files;}
export function harness(task,sourceArg,outArg,mode){
 const source=path.resolve(sourceArg),out=path.resolve(outArg),repo=path.join(out,'candidate');assert(!fs.existsSync(out),'Use a fresh evidence directory');fs.mkdirSync(out,{recursive:true});
 fs.cpSync(source,repo,{recursive:true,filter:retained});const initial=snapshot(source),checks=[],events=[],children=new Set();
 const grader=path.join(root,'Backend/tools/expert-v2-evaluate.mjs');fs.copyFileSync(grader,path.join(out,'GRADER.mjs'));fs.copyFileSync(import.meta.filename,path.join(out,'HARNESS.mjs'));
 const graderSha256=sha(path.join(out,'GRADER.mjs')),harnessSha256=sha(path.join(out,'HARNESS.mjs'));
 const save=()=>fs.writeFileSync(path.join(out,'CHECKS.json'),JSON.stringify({task,profile:'repository-expert-v2',scope:'additional-v2-contracts; not a complete replacement for all original regression coverage',mode,source,createdAt:new Date().toISOString(),graderSha256,harnessSha256,passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length,blocked:checks.filter(c=>c.status==='BLOCKED').length,total:checks.length,checks,events},null,2)+'\n');
 const check=async(id,fn,requires=true)=>{if(!requires){checks.push({id,status:'BLOCKED',reason:'Required earlier capability failed; not independently scored'});save();return false;}const start=performance.now();try{await fn();checks.push({id,status:'PASS',seconds:(performance.now()-start)/1000});save();return true;}catch(e){checks.push({id,status:'FAIL',seconds:(performance.now()-start)/1000,error:String(e.stack??e)});save();return false;}};
 const req=async(base,url,body,timeout=6000)=>{const start=performance.now();try{const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)}),text=await r.text();let data;try{data=JSON.parse(text);}catch{data={raw:text};}const result={status:r.status,data,ms:performance.now()-start};events.push({base,url,request:body,...result});return result;}catch(e){events.push({base,url,request:body,transportError:String(e),ms:performance.now()-start});throw e;}};
 const launch=(exe,args,label,env={})=>{const fd=fs.openSync(path.join(out,label+'.log'),'a'),c=spawn(exe,args,{cwd:repo,windowsHide:true,env:{...process.env,...env},stdio:['ignore',fd,fd]});fs.closeSync(fd);children.add(c);events.push({type:'spawn',label,pid:c.pid});c.once('error',e=>events.push({type:'spawn-error',label,error:String(e)}));c.once('exit',(code,signal)=>{children.delete(c);events.push({type:'exit',label,pid:c.pid,code,signal});});return c;};
 const stop=async c=>{if(!c||c.exitCode!==null||c.signalCode!==null)return;c.kill('SIGKILL');await until(()=>c.exitCode!==null||c.signalCode!==null,5000);};
 const exec=async(exe,args,label,env={})=>{const c=launch(exe,args,label,env);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(process.platform==='win32')spawn('taskkill.exe',['/PID',String(c.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else c.kill('SIGKILL');reject(Error(label+' timed out'));},180000);c.once('error',e=>{clearTimeout(timer);reject(e);});c.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(label+' exited '+code));});});};
 const finish=async()=>{await Promise.all([...children].map(stop));assert.deepEqual(snapshot(source),initial,'Original source changed');save();return {task,checks:checks.map(c=>({id:c.id,status:c.status})),report:path.join(out,'CHECKS.json')};};
 return {task,source,out,repo,checks,events,check,req,launch,stop,exec,finish,save};
}
