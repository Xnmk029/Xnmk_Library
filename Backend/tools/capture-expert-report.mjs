import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'Backend/pilots/20261016/RaftTxnWorkbench'),repo=path.join(out,'candidate');
const reports=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory()){if(!['node_modules','.git','.cache'].includes(e.name))walk(f);}else if(e.name==='report.html')reports.push(f);}}
walk(repo);const report=reports.sort().at(-1);assert(report,'No generated report found');
const {chromium}=createRequire(path.join(root,'L1_Basic/BilibiliUserscript/package.json'))('playwright-core');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(pathToFileURL(report).href);const text=await page.locator('body').innerText();assert(text.length>300);await page.screenshot({path:path.join(out,'visual-report.png'),fullPage:true});fs.writeFileSync(path.join(out,'VISUAL.json'),JSON.stringify({kind:'render-only engineering check',browser:browser.version(),relativeReport:path.relative(repo,report),sha256:createHash('sha256').update(fs.readFileSync(report)).digest('hex'),bodyCharacters:text.length,note:'Generated model demo report, not an independent correctness oracle. The original first screenshot showed the API root; use visual-report.png for the actual HTML report. Original evidence retained.'},null,2)+'\n');}finally{await browser.close();}
console.log(report);
