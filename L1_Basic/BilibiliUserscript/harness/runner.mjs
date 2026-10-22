import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { chromium } from 'playwright-core';
import { inspectSource } from './static.mjs';
import { sha256,makeRecords,changedRecords } from './data.mjs';
import { installMonitor } from './monitor.mjs';
import { replayHTML } from '../fixtures/replay.mjs';
import { snapshotFooters,validateFooters,clickNativeControls } from './assertions.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function evaluate(options) {
  const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'benchmark.json'),'utf8'));
  const cases=JSON.parse(await fs.readFile(path.join(ROOT,manifest.caseManifest),'utf8'));
  if(cases.reduce((sum,c)=>sum+c.weight,0)!==100) throw new Error('Case weights must sum to 100');
  const selection=options.caseIds?cases.filter(c=>c.kind||options.caseIds.includes(c.id)):cases;
  if(options.caseIds?.some(id=>!cases.some(c=>c.id===id))) throw new Error('Unknown calibration case ID');
  const script=path.resolve(options.script);
  const source=await fs.readFile(script,'utf8');
  const seed=String(options.seed??20260930),track=options.track||'controlled-v2';
  if(!manifest.tracks[track]) throw new Error('Unknown track: '+track);
  const prompt=await fs.readFile(path.join(ROOT,manifest.tracks[track].prompt));
  const contractSha256=track==='controlled-v2'?sha256(await fs.readFile(path.join(ROOT,manifest.publicContract))):null;
  const engineFiles=['benchmark.json','fixtures/cases.json','fixtures/replay.mjs','harness/runner.mjs','harness/static.mjs','harness/data.mjs','harness/monitor.mjs','harness/assertions.mjs','package-lock.json'];
  const engineDigests={};
  for(const file of engineFiles) engineDigests[file]=sha256(await fs.readFile(path.join(ROOT,file)));
  const staticResult=inspectSource(source,path.basename(script));
  const results=staticResult.checks.map(c=>({...cases.find(x=>x.id===c.id),...c}));
  const allEvents=[],requestEvents=[];
  const started=new Date().toISOString();
  const launch={headless:true};
  if(options.browser) launch.executablePath=path.resolve(options.browser);
  else launch.channel=options.channel||manifest.runtime.defaultChannel;
  const browser=await chromium.launch(launch);
  const browserVersion=browser.version();
  const artifactDir=options.artifacts?path.resolve(options.artifacts):null;
  if(artifactDir) await fs.mkdir(artifactDir,{recursive:true});
  try {
    for(const test of selection.filter(c=>c.framework)) {
      const rows=makeRecords(seed,test.id,test.scenario);
      let finalRows=rows;
      const config={...test,records:rows};
      const url=test.framework==='vue2'?'https://www.bilibili.com/blackboard/feed-topic.html':test.framework==='vue3'?'https://www.bilibili.com/blackboard/replay.html':'https://www.bilibili.com/video/BVfixture';
      const context=await browser.newContext({viewport:test.scenario==='narrow'?{width:720,height:800}:manifest.runtime.viewport,locale:manifest.runtime.locale,timezoneId:manifest.runtime.timezoneId,serviceWorkers:'block'});
      const page=await context.newPage();
      page.setDefaultTimeout(manifest.runtime.caseTimeoutMs);
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('dialog',async dialog=>{allEvents.push({case:test.id,type:'dialog',detail:dialog.message()});await dialog.dismiss();});
      await context.route('**/*',async route=>{
        const request=route.request(),requestURL=request.url();
        if(request.isNavigationRequest()&&requestURL===url) return route.fulfill({contentType:'text/html',body:replayHTML(config)});
        if(/^https:\/\/api\.bilibili\.com\/x\/v2\/reply\/main\?/.test(requestURL)) {
          const body=requestURL.includes('fixture_fail')?{code:-500,data:null}:{code:0,data:{replies:rows}};
          requestEvents.push({case:test.id,type:'fixture-response',url:requestURL});
          return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'https://www.bilibili.com'},body:JSON.stringify(body)});
        }
        requestEvents.push({case:test.id,type:'blocked-request',url:requestURL,resourceType:request.resourceType()});
        await route.abort();
      });
      await context.addInitScript({content:'('+installMonitor.toString()+')();\ntry {\n'+source+'\n} catch(error) { window.__replayEvents.push({type:"uncaught-error",detail:String(error)}); }'});
      let result;
      try {
        await page.goto(url,{waitUntil:'load',timeout:manifest.runtime.caseTimeoutMs});
        await pause(manifest.runtime.settleMs);
        if(['clear','recycle'].includes(test.scenario)) {
          finalRows=changedRecords(rows,test.scenario==='clear');
          await page.evaluate(next=>window.__replayFixture.update(next),finalRows);
          await pause(manifest.runtime.settleMs);
        } else if(test.scenario==='repeat') {
          await page.evaluate(()=>window.__replayFixture.repeat(12));await pause(manifest.runtime.settleMs);
        } else if(['push','replace-pop'].includes(test.scenario)) {
          finalRows=changedRecords(rows);
          await page.evaluate(({method,next,cross})=>window.__replayFixture.navigate(method,next,cross?'/blackboard/replay.html':'/video/BVnext',cross?'vue3':null),{method:test.scenario==='push'?'pushState':'replaceState',next:finalRows,cross:test.scenario==='replace-pop'});
          await pause(manifest.runtime.settleMs);
        }
        const snapshots=await page.evaluate(snapshotFooters);
        result={...test,...validateFooters(snapshots,finalRows,test.scenario),snapshots};
        if(['controls','narrow'].includes(test.scenario)) {
          const clicks=await page.evaluate(clickNativeControls);result.clicks=clicks;
          if(clicks.count!==finalRows.length*2||clicks.received!==clicks.count) {result.pass=false;result.findings.push('Native click listeners did not survive injection');}
        }
        if(test.scenario==='failed-response') {
          const code=await page.evaluate(()=>window.__replayFixture.responseCode);
          if(code!==-500) {result.pass=false;result.findings.push('Page GET result was changed or consumed: '+code);}
        }
        const events=await page.evaluate(()=>window.__replayEvents);
        allEvents.push(...events.map(event=>({case:test.id,...event})),...errors.map(detail=>({case:test.id,type:'uncaught-error',detail})));
        if(artifactDir) {
          await fs.writeFile(path.join(artifactDir,test.id+'.json'),JSON.stringify({result,events},null,2));
          if(!result.pass||options.screenshots==='all') await page.screenshot({path:path.join(artifactDir,test.id+'.png'),fullPage:true,timeout:3000}).catch(()=>{});
        }
      } catch(error) {
        result={...test,pass:false,findings:[String(error)],snapshots:[]};
        allEvents.push({case:test.id,type:'uncaught-error',detail:String(error)});
      } finally { await context.close(); }
      results.push(result);
      if(options.progress) options.progress(test.id,result.pass,result.findings);
    }
  } finally {await browser.close();}
  const violations=allEvents.filter(e=>['candidate-network','persistent-write','dialog','uncaught-error'].includes(e.type));
  violations.push(...requestEvents.filter(e=>e.type==='blocked-request'));
  results.push({...cases.find(c=>c.id==='P01'),pass:violations.length===0,findings:violations});
  results.sort((a,b)=>cases.findIndex(c=>c.id===a.id)-cases.findIndex(c=>c.id===b.id));
  const groups={};
  for(const test of results) {
    const group=(groups[test.group]||={earned:0,maximum:0});
    group.maximum+=test.weight;if(test.pass) group.earned+=test.weight;
    test.earned=test.pass?test.weight:0;
  }
  const score=results.reduce((sum,c)=>sum+c.earned,0);
  const failedGates=results.filter(c=>manifest.policy.criticalChecks.includes(c.id)&&!c.pass).map(c=>c.id);
  return {
    schemaVersion:1,taskId:manifest.id,benchmarkVersion:manifest.version,track,seed,
    rankingEligible:manifest.tracks[track].rankingEligible&&failedGates.length===0&&!options.caseIds,
    selection:{complete:!options.caseIds,caseIds:results.map(c=>c.id)},maximumScore:results.reduce((sum,c)=>sum+c.weight,0),
    startedAt:started,finishedAt:new Date().toISOString(),
    candidate:{path:script,sha256:sha256(source),bytes:Buffer.byteLength(source),metadata:staticResult.metadata},
    provenance:{promptSha256:sha256(prompt),contractSha256,originalPromptSha256:manifest.originalPromptSha256,fixtureManifestSha256:engineDigests['fixtures/cases.json'],engineSha256:sha256(JSON.stringify(engineDigests)),engineFiles:engineDigests,goldSha256:sha256(await fs.readFile(path.join(ROOT,manifest.gold)))},
    environment:{node:process.version,platform:process.platform,osRelease:os.release(),browserVersion,channel:launch.channel||null,executablePath:launch.executablePath||null,playwrightVersion:JSON.parse(await fs.readFile(path.join(ROOT,'node_modules/playwright-core/package.json'),'utf8')).version},
    score,qualifiedScore:failedGates.length||options.caseIds||!manifest.tracks[track].rankingEligible?null:score,failedGates,
    verdict:failedGates.length?'REJECTED':options.caseIds?'CALIBRATION':score===100?'PASS':score>=85?'STRONG':score>=60?'PARTIAL':'FAIL',
    groups,checks:results,events:allEvents,requests:requestEvents,
    limitations:['Synthetic replay; not live Bilibili acceptance','GM API shim and page injection; not a full userscript manager','Runtime observations do not prove absence of all dormant data leaks'],
  };
}
