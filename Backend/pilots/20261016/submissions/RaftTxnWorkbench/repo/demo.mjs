// Real process regression and evidence report. Node.js >= 18, no npm dependencies.
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync, openSync, closeSync, writeFileSync, readFileSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const run=resolve(root,'artifacts',new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(run,{recursive:true});
const binary=process.env.RAFTTXN_BINARY || join(root,process.platform==='win32'?'rafttxn.exe':'rafttxn');
if(!process.env.RAFTTXN_BINARY){const b=spawnSync('go',['build','-o',binary,'.'],{cwd:root,encoding:'utf8',windowsHide:true});if(b.status!==0)throw Error(b.stderr||b.error);}
const history={started:new Date().toISOString(),run,timeoutMs:1500,events:[],checks:[],stages:[],outcome:'running'};
const processes=new Map();let phase='启动';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function event(type,data){const e={time:new Date().toISOString(),phase,type,...data};history.events.push(e);return e;}
function check(name,fn){fn();history.checks.push({time:new Date().toISOString(),phase,name,passed:true});console.log('PASS',name);}
async function port(){const s=net.createServer();await new Promise((r,j)=>s.listen(0,'127.0.0.1',r).once('error',j));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const ports=[];while(ports.length<6){const p=await port();if(!ports.includes(p))ports.push(p);}
const peers=ports.slice(0,3).map(p=>`http://127.0.0.1:${p}`).join(',');
history.nodes=[1,2,3].map(id=>({id,peer:ports[id-1],http:ports[id+2],data:join(run,`node-${id}`)}));
function start(id){
 const n=history.nodes[id-1],fd=openSync(join(run,`node-${id}.log`),'a');
 const args=['--id',String(id),'--cluster',peers,'--port',String(n.http),'--data-dir',n.data,'--snap-count','8','--request-timeout','1500ms'];
 const p=spawn(binary,args,{cwd:root,stdio:['ignore',fd,fd],windowsHide:true});
 p.done=new Promise(r=>p.once('exit',(code,signal)=>{closeSync(fd);event('exit',{node:id,code,signal});r();}));
 p.on('error',e=>event('processError',{node:id,error:String(e)}));processes.set(id,p);event('start',{node:id,pid:p.pid,args});
}
async function kill(id){const p=processes.get(id);if(!p)return;event('kill',{node:id,pid:p.pid});p.kill('SIGKILL');await p.done;processes.delete(id);}
async function request(id,path,body,method=body===undefined?'GET':'POST'){
 const start=performance.now();let res;
 const input=typeof body==='string'?body:body===undefined?undefined:JSON.stringify(body);
 try {const r=await fetch(`http://127.0.0.1:${ports[id+2]}${path}`,{method,body:input,headers:input===undefined?{}:{'Content-Type':'application/json'},signal:AbortSignal.timeout(5000)});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}res={status:r.status,raw,data};}
 catch(e){res={status:0,raw:String(e),data:null};}
 const entry=event('http',{node:id,method,path,request:input,...res,elapsedMs:Math.round(performance.now()-start)});return entry;
}
const status=id=>request(id,'/v1/status');
const get=(id,key)=>request(id,'/v1/kv?key='+encodeURIComponent(key));
const txn=(id,body)=>request(id,'/v1/txn',body);
const put=(requestId,key,value,compare=[])=>({requestId,compare,success:[{op:'put',key,value}]});
async function until(fn,label,ms=12000){const deadline=Date.now()+ms;let v;while(Date.now()<deadline){v=await fn();if(v)return v;await sleep(120);}throw Error(`Timed out: ${label}`);}
async function ready(ids=[1,2,3]){await until(async()=>{const rs=await Promise.all(ids.map(status));return rs.every(r=>r.status===200&&r.data.leaderId>0)&&rs;},'leader election');}
async function stage(name){phase=name;const nodes=await Promise.all([1,2,3].map(status));history.stages.push({name,time:new Date().toISOString(),nodes:nodes.map(x=>({node:x.node,status:x.status,data:x.data}))});console.log('\n'+name);}
async function retryTxn(id,t){return until(async()=>{const r=await txn(id,t);return r.status===200&&r;},'transaction retry');}

try {
 [1,2,3].forEach(start);await ready();await until(async()=>{const r=await get(1,'ready');return r.status===200;},'initial linear read');
 await stage('01 · 并发 CAS 与原子事务');
 const cas=await Promise.all(Array.from({length:12},(_,i)=>txn(i%3+1,put('cas-'+i,'race','winner-'+i,[{key:'race',modRevision:0}]))));
 check('12 个并发 CAS 仅一个成功，全部在健康多数派完成',()=>{assert(cas.every(r=>r.status===200&&r.elapsedMs<5000));assert.equal(cas.filter(r=>r.data.succeeded).length,1);assert.equal(new Set(cas.map(r=>r.data.revision)).size,1);});
 const winner=cas.find(r=>r.data.succeeded),failed=cas.find(r=>!r.data.succeeded);
 const originalWinner=JSON.parse(winner.request),failedTxn=JSON.parse(failed.request);
 const multi={requestId:'multi',compare:[{key:'left',modRevision:0},{key:'right',modRevision:0}],success:[{op:'put',key:'left',value:'L'},{op:'put',key:'right',value:'R'}]};
 const mr=await txn(2,multi);
 check('多 key 同次提交、同一 revision、结果顺序一致',()=>{assert.equal(mr.status,200);assert(mr.data.succeeded);assert.deepEqual(mr.data.results.map(x=>x.key),['left','right']);assert(mr.data.results.every(x=>x.modRevision===mr.data.revision));});
 const atomicFail=await txn(3,{requestId:'atomic-fail',compare:[{key:'left',modRevision:mr.data.revision},{key:'right',modRevision:0}],success:[{op:'delete',key:'left'},{op:'delete',key:'right'}]});
 const lr=await get(1,'left'),rr=await get(3,'right');
 check('其中一个 compare 失败，两个 key 均保持原值',()=>{assert.equal(atomicFail.data.succeeded,false);assert.equal(lr.data.value,'L');assert.equal(rr.data.value,'R');assert.equal(lr.data.modRevision,rr.data.modRevision);});
 const duplicate=await Promise.all([1,2,3,1,2,3].map(id=>txn(id,multi)));
 check('并发跨节点重试返回字节相同的原始结果',()=>assert(duplicate.every(r=>r.status===200&&r.raw===mr.raw)));
 const reordered=await request(1,'/v1/txn',JSON.stringify({success:multi.success.map(x=>({value:x.value,key:x.key,op:x.op})),requestId:'multi',compare:multi.compare.map(x=>({modRevision:x.modRevision,key:x.key}))},null,2));
 check('JSON 字段顺序、空白不影响请求身份',()=>assert.equal(reordered.raw,mr.raw));
 const conflict=await txn(1,put('multi','left','changed'));
 const orderConflict=await txn(2,{...multi,success:[...multi.success].reverse()});
 check('同 ID 异内容或数组换序返回 409',()=>{assert.equal(conflict.status,409);assert.equal(orderConflict.status,409);});
 const failedAgain=await txn(3,failedTxn);
 check('比较失败的历史结果在 revision 增长后仍保持原始字节',()=>assert.equal(failedAgain.raw,failed.raw));
 const del=await txn(1,{requestId:'delete',compare:[],success:[{op:'delete',key:'left'},{op:'delete',key:'never-existed'}]});
 const tomb=await get(2,'left'),missing=await get(3,'never-existed');
 const aba=await txn(2,put('aba','left','wrong',[{key:'left',modRevision:0}]));
 check('删除与不存在 key 均保留墓碑，禁止 ABA',()=>{assert.equal(tomb.data.value,null);assert.equal(tomb.data.modRevision,del.data.revision);assert.equal(missing.data.modRevision,del.data.revision);assert.equal(aba.data.succeeded,false);});
 const recreate=await txn(2,put('recreate','left','new',[{key:'left',modRevision:del.data.revision}]));
 check('带墓碑 revision 的重建成功且 revision 单调增加',()=>assert(recreate.data.succeeded&&recreate.data.revision>del.data.revision));
 const invalids=[{requestId:'bad',compare:[],success:[]},{requestId:'bad',compare:[{key:'x'}],success:[{op:'delete',key:'x'}]},{requestId:'bad',compare:[],success:[{op:'put',key:'x',value:1}]},{requestId:'bad',compare:[],success:[{op:'delete',key:'x'},{op:'delete',key:'x'}]}];
 const invalidResponses=await Promise.all(invalids.map(x=>txn(1,x)));
 check('非法请求全部返回 400',()=>assert(invalidResponses.every(r=>r.status===400)));
 const legacy=await request(3,'/legacy','committed-value','PUT'),legacyGet=await request(1,'/legacy');
 check('原 PUT 在提交应用后返回，跨节点立即 GET 可见',()=>{assert.equal(legacy.status,204);assert.equal(legacyGet.raw,'committed-value');});

 await stage('02 · 隔离旧 leader，保留客户端 HTTP');
 const leader=(await status(1)).data.leaderId,majority=[1,2,3].filter(x=>x!==leader);
 history.oldLeader=leader;
 await Promise.all([request(leader,'/v1/debug/partition',{blockedPeerIds:majority}),...majority.map(id=>request(id,'/v1/debug/partition',{blockedPeerIds:[leader]}))]);
 const isolated=await Promise.all([get(leader,'left'),txn(leader,put('unknown-isolated','isolated','maybe')),txn(leader,originalWinner)]);
 check('孤立旧 leader 的读取、写入、已知 ID 重试均超时，≤ 配置超时 + 1 秒',()=>assert(isolated.every(r=>[503,504].includes(r.status)&&r.elapsedMs<=2500)));
 await until(async()=>{const ss=await Promise.all(majority.map(status));return ss.every(r=>r.status===200&&majority.includes(r.data.leaderId));},'majority elects new leader');
 const majorityResult=await retryTxn(majority[0],put('majority-write','available','yes'));
 const majorityRead=await get(majority[1],'available');
 check('多数派选出新 leader，继续提交并从另一节点读取',()=>{assert.equal(majorityResult.status,200);assert.equal(majorityRead.data.value,'yes');});
 await stage('03 · 多数派继续写入并压缩日志');
 const oldApplied=(await status(leader)).data.appliedIndex;
 for(let i=0;i<40;i++){const r=await txn(majority[i%2],put('partition-fill-'+i,'progress',String(i)));assert.equal(r.status,200);}
 await until(async()=>{const s=await status(majority[0]);return s.data.snapshotIndex>oldApplied+8;},'log compaction beyond old leader');
 await Promise.all([1,2,3].map(id=>request(id,'/v1/debug/partition',{blockedPeerIds:[]})));
 await until(async()=>{const s=await status(leader);return s.status===200&&s.data.installedSnapshotIndex>oldApplied;},'old leader installs transferred snapshot');
 const healed=await get(leader,'progress'),winnerRetry=await txn(leader,originalWinner),failureRetry=await txn(leader,failedTxn);
 check('恢复后旧 leader 通过真实快照安装追平，成功和失败 ID 均保留',()=>{assert.equal(healed.data.value,'39');assert.equal(winnerRetry.raw,winner.raw);assert.equal(failureRetry.raw,failed.raw);});
 const unknownResolved=await txn(leader,put('unknown-isolated','isolated','maybe'));
 const unknownRepeated=await txn(majority[0],put('unknown-isolated','isolated','maybe'));
 check('分区期间结果未知的请求恢复后可安全重试，返回唯一持久结果',()=>{assert.equal(unknownResolved.status,200);assert.equal(unknownResolved.raw,unknownRepeated.raw);});
 await stage('04 · 应答后立即强杀全部进程，复用 WAL 重启');
 const durable=put('durable','after-kill','persisted');
 const confirmed=await txn(majority[0],durable);assert.equal(confirmed.status,200);
 const killStart=performance.now();await Promise.all([1,2,3].map(kill));history.killDelayMs=Math.round(performance.now()-killStart);
 [1,2,3].forEach(start);await ready();
 const recovered=await retryTxn(2,durable),recoveredGet=await get(3,'after-kill');
 check('确认响应后立即强杀三进程，WAL 重启后值与原始幂等结果不丢失',()=>{assert.equal(recovered.raw,confirmed.raw);assert.equal(recoveredGet.data.value,'persisted');});
 await stage('05 · 停止落后节点，多数派压缩后再启动');
 const currentLeader=(await status(1)).data.leaderId,lag=[1,2,3].find(id=>id!==currentLeader),before=(await status(lag)).data;
 const logOffset=readFileSync(join(run,`node-${lag}.log`),'utf8').length;
 await kill(lag);const live=[1,2,3].filter(id=>id!==lag);
 for(let i=0;i<40;i++){const r=await txn(live[i%2],put('offline-fill-'+i,'offline-progress',String(i)));assert.equal(r.status,200);}
 await until(async()=>{const s=await status(live[0]);return s.data.snapshotIndex>before.appliedIndex+8;},'offline compaction');
 start(lag);
 const installed=await until(async()=>{const s=await status(lag);return s.status===200&&s.data.installedSnapshotIndex>before.appliedIndex&&s;},'restarted laggard installs snapshot');
 const latest=await get(lag,'offline-progress'),oldSuccess=await txn(lag,originalWinner),oldFailure=await txn(lag,failedTxn);
 const transferredLog=readFileSync(join(run,`node-${lag}.log`),'utf8').slice(logOffset);
 check('离线节点跨越压缩边界，Raft 日志证明真实 snapshot restore',()=>{assert(installed.data.installedSnapshotIndex>before.appliedIndex);assert.match(transferredLog,/restored snapshot|restored\s+snapshot|restore snapshot/);assert.equal(latest.data.value,'39');});
 check('安装快照后旧成功 ID 与旧失败 ID 返回原始结果',()=>{assert.equal(oldSuccess.raw,winner.raw);assert.equal(oldFailure.raw,failed.raw);});
 await stage('06 · 从已落盘快照再次重启');
 await kill(lag);start(lag);await ready();const localSnapRetry=await retryTxn(lag,originalWinner);
 check('本地快照 + WAL 恢复仍保留永久幂等结果',()=>assert.equal(localSnapRetry.raw,winner.raw));
 await stage('07 · 所有节点互相隔离，无 quorum');
 await Promise.all([1,2,3].map(id=>request(id,'/v1/debug/partition',{blockedPeerIds:[1,2,3].filter(x=>x!==id)})));
 const noQuorum=await Promise.all([1,2,3].map(id=>get(id,'after-kill')));
 check('无 quorum 时三节点读取均在超时界限内拒绝成功',()=>assert(noQuorum.every(r=>[503,504].includes(r.status)&&r.elapsedMs<=2500)));
 await Promise.all([1,2,3].map(id=>request(id,'/v1/debug/partition',{blockedPeerIds:[]})));
 await ready();await until(async()=>{const rs=await Promise.all([1,2,3].map(id=>get(id,'offline-progress')));return rs.every(r=>r.status===200&&r.data.value==='39');},'final linear reads');await stage('08 · 恢复完成');
 history.outcome='passed';
} catch(e){history.outcome='failed';history.error=e.stack||String(e);event('failure',{error:history.error});console.error(history.error);process.exitCode=1;}
finally {
 await Promise.all([...processes.keys()].map(kill));history.finished=new Date().toISOString();
	history.raceReports=history.nodes.filter(n=>/WARNING: DATA RACE/.test(readFileSync(join(run,`node-${n.id}.log`),'utf8'))).map(n=>n.id);
	if(history.raceReports.length){history.outcome='failed';history.error='Go race detector reported races on nodes '+history.raceReports.join(',');process.exitCode=1;}
 writeFileSync(join(run,'history.json'),JSON.stringify(history,null,2));
 const {renderReport}=await import('./report.mjs');writeFileSync(join(run,'report.html'),renderReport(history));
 writeFileSync(join(root,'artifacts','latest.json'),JSON.stringify({run,report:join(run,'report.html'),outcome:history.outcome},null,2));
 console.log(`\n${history.outcome.toUpperCase()} · ${history.checks.length} checks\nReport: ${join(run,'report.html')}`);
}
