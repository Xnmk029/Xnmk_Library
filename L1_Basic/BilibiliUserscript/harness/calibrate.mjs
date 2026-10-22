import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,evaluate} from './runner.mjs';
import {writeHTML} from './report.mjs';
const output=path.join(ROOT,'calibration/results');
await fs.mkdir(output,{recursive:true});
const gold=path.join(ROOT,'gold/bilireveal-bench.user.js');
const source=await fs.readFile(gold,'utf8');
const temp=path.join(ROOT,'runs/calibration-mutants');
await fs.mkdir(temp,{recursive:true});
const swap=(from,to)=>{if(!source.includes(from)) throw new Error('Mutation anchor missing: '+from);return source.replace(from,to);};
const mutants=[
  {name:'wrong-location',code:swap('const value = reply?.reply_control?.location;', 'const value = "IP属地：北京";'),ids:['D01'],mustFail:'D01'},
  {name:'duplicate-label',code:swap('let label = root.querySelector(own);','let label = null;').replace('for (const other of root.querySelectorAll(own)) if (other !== label) other.remove();',''),ids:['L02'],mustFail:'L02'},
  {name:'persistent-data',code:source+'\nlocalStorage.setItem("comment-location", "synthetic private value");',ids:['D01'],mustFail:'P01'},
  {name:'outbound-network',code:source+'\nfetch("https://telemetry.invalid/collect").catch(()=>{});',ids:['D01'],mustFail:'P01'},
  {name:'executable-location',code:swap('if (label.textContent !== text) label.textContent = text;','label.innerHTML = text;').replace('const location = benchEscape(benchLocation(item) || "IP属地：未提供");','const location = benchLocation(item) || "IP属地：未提供";'),ids:['D04'],mustFail:'D04'},
  {name:'no-op',code:source.slice(0,source.indexOf('// ==/UserScript==')+20)+'\n(()=>{})();',ids:['D01'],mustFail:'D01'},
];
const targets=[
  {name:'gold-seed-20260930',script:gold,seed:'20260930',expectFullPass:true},
  {name:'gold-seed-73191',script:gold,seed:'73191',expectFullPass:true},
  {name:'upstream-bilireveal-lite',script:path.join(ROOT,'gold/upstream/bilireveal.lite.user.js'),seed:'20260930',track:'diagnostic-v1'},
  {name:'supplied-ai',script:path.join(ROOT,'calibration/candidates/supplied-ai.user.js'),seed:'20260930',track:'diagnostic-v1'},
];
for(const mutation of mutants) {
  const script=path.join(temp,mutation.name+'.user.js');
  await fs.writeFile(script,mutation.code);
  targets.push({name:mutation.name,script,seed:'20260930',caseIds:mutation.ids,mustFail:mutation.mustFail});
}
const summary=[];
for(const target of targets) {
  console.error('CALIBRATING '+target.name);
  const report=await evaluate({...target,artifacts:path.join(ROOT,'runs/calibration-evidence',target.name),progress:(id,pass)=>console.error(target.name+' '+id+' '+(pass?'PASS':'FAIL'))});
  await fs.writeFile(path.join(output,target.name+'.json'),JSON.stringify(report,null,2)+'\n');
  await writeHTML(report,path.join(output,target.name+'.html'));
  const valid=target.expectFullPass?report.score===100&&report.failedGates.length===0:target.mustFail?!report.checks.find(c=>c.id===target.mustFail)?.pass:true;
  summary.push({name:target.name,score:report.score,maximumScore:report.maximumScore,verdict:report.verdict,failed:report.checks.filter(c=>!c.pass).map(c=>c.id),expectedFailure:target.mustFail||null,calibrationPassed:valid,sha256:report.candidate.sha256,report:target.name+'.json',environment:report.environment,engineSha256:report.provenance.engineSha256});
  console.error(target.name+' => '+report.score+'/'+report.maximumScore+' '+(valid?'CALIBRATED':'CALIBRATION FAILED'));
}
await fs.writeFile(path.join(output,'summary.json'),JSON.stringify({schemaVersion:1,createdAt:new Date().toISOString(),allCalibrationChecksPassed:summary.every(x=>x.calibrationPassed),targets:summary},null,2)+'\n');
console.log(JSON.stringify(summary.map(x=>({name:x.name,score:x.score,maximum:x.maximumScore,calibrationPassed:x.calibrationPassed,failed:x.failed}))));
process.exitCode=summary.every(x=>x.calibrationPassed)?0:1;
