import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export function extractDsh(h){
 const parse=f=>fs.readFileSync(f,'utf8').split(/\r?\n/).flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}});
 const stdout=path.join(h,'stdout.log'),events=parse(stdout),sessions=events.filter(e=>e.type==='session').map(e=>e.sessionId);
 if(sessions.length!==1)throw Error('Expected one fresh DSH session');
 const id=sessions[0],home=path.join(os.homedir(),'.dsh/sessions'),hits=[];
 for(const d of fs.readdirSync(home,{withFileTypes:true}))if(d.isDirectory()){const f=path.join(home,d.name,id,'session.v4.jsonl.zstd');if(fs.existsSync(f))hits.push(f);}
 if(hits.length!==1)throw Error('Expected one persisted session trace');
 const raw=path.join(h,'dsh_session.jsonl.zstd'),decoded=path.join(h,'dsh_session.jsonl');
 if(fs.existsSync(raw)||fs.existsSync(decoded))throw Error('Provider evidence already frozen');
 fs.copyFileSync(hits[0],raw);
 const compressed=fs.readFileSync(raw),parts=[];let off=0;
 while(off<compressed.length){const r=zlib.zstdDecompressSync(compressed.subarray(off),{info:true});if(!r.engine.bytesWritten)throw Error('zstd frame did not advance');off+=r.engine.bytesWritten;parts.push(r.buffer);}
 fs.writeFileSync(decoded,Buffer.concat(parts));
 const trace=parse(decoded),models=new Set(),selections=[],responses=[];
 function selectionsIn(v){if(!v||typeof v!=='object')return;if(v.provider&&v.model&&v.reasoningEffort)selections.push({provider:v.provider,model:v.model,reasoningEffort:v.reasoningEffort});for(const x of Object.values(v))if(x&&typeof x==='object')selectionsIn(x);}
 for(const e of trace){selectionsIn(e);if(e.type==='assistant/message')for(const s of e.data?.stream??[]){const r=s.chunk?.replayState?.response;if(r?.model){models.add(r.model);responses.push({model:r.model,id:r.id??null,usage:r.usage??null,finishReason:r.choices?.[0]?.finish_reason??null});}}}
 const steps=events.filter(e=>e.type==='status'&&e.phase==='step_end'&&e.usage).map(e=>({turn:e.turn,step:e.step,...e.usage}));
 const usage={perStep:steps,totals:Object.fromEntries(['inputTokens','outputTokens','cacheReadTokens','cacheWriteTokens','totalTokens'].map(k=>[k,steps.reduce((n,e)=>n+(e[k]??0),0)])),note:'Completed DSH step_end records from this execution segment only. Interrupted in-flight calls may be missing; prior segment usage is retained separately. Input/cache semantics are provider-specific.'};
 const finish=events.findLast(e=>e.type==='status'&&e.phase==='turn_end');
 const evidence={sessionId:id,actualModel:[...models],selectionObservations:[...new Map(selections.map(s=>[JSON.stringify(s),s])).values()],usage,finishReason:finish?.reason??null,providerResponses:responses,source:{stdoutSha256:sha(stdout),compressedSha256:sha(raw),decodedSha256:sha(decoded)},identityNote:'Response model values come from persisted provider replay state. Requested route/effort and effective local config are separate evidence; no model-self-report identity.'};
 fs.writeFileSync(path.join(h,'provider_evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 const file=path.join(h,'execution.json'),execution=JSON.parse(fs.readFileSync(file));
 Object.assign(execution,{actual_model:evidence.actualModel.length?evidence.actualModel:null,usage:evidence.usage,finish_reason:evidence.finishReason,session_id:id});
 fs.writeFileSync(file,JSON.stringify(execution,null,2)+'\n');
 return evidence;
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){const e=extractDsh(path.resolve(process.argv[2]));console.log(JSON.stringify({sessionId:e.sessionId,actualModel:e.actualModel,selections:e.selectionObservations,usage:e.usage.totals}));}
