import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, evaluate } from '../../L1_Basic/BilibiliUserscript/harness/runner.mjs';
import { writeHTML } from '../../L1_Basic/BilibiliUserscript/harness/report.mjs';

const out = path.join(ROOT, 'runs/review-20261015');
await fs.mkdir(out, {recursive: true});
const source = await fs.readFile(path.join(ROOT, 'gold/bilireveal-bench.user.js'), 'utf8');
function swap(from, to) {
  if (!source.includes(from)) throw new Error('Missing mutation anchor: ' + from);
  return source.replace(from, to);
}
const probes = [
  { id: 'wrong-location', code: swap('const value = reply?.reply_control?.location;', 'const value = "IP属地：北京";'), cases: ['D01'], expectedFailure: 'D01' },
  { id: 'duplicate-label', code: swap('let label = root.querySelector(own);', 'let label = null;').replace('for (const other of root.querySelectorAll(own)) if (other !== label) other.remove();', ''), cases: ['L02'], expectedFailure: 'L02' },
  { id: 'network', code: source + '\nfetch("https://telemetry.invalid/collect").catch(()=>{});', cases: ['D01'], expectedFailure: 'P01' },
  { id: 'storage-method', code: source + '\nlocalStorage.setItem("review-probe", "synthetic");', cases: ['D01'], expectedFailure: 'P01' },
  { id: 'executable-location', code: swap('if (label.textContent !== text) label.textContent = text;', 'label.innerHTML = text;').replace('const location = benchEscape(benchLocation(item) || "IP属地：未提供");', 'const location = benchLocation(item) || "IP属地：未提供";'), cases: ['D04'], expectedFailure: 'D04' },
  { id: 'no-op', code: source.slice(0, source.indexOf('// ==/UserScript==') + 20) + '\n(()=>{})();', cases: ['D01'], expectedFailure: 'D01' },
  { id: 'overlay-gap', code: source + '\naddEventListener("DOMContentLoaded",()=>{const cover=document.createElement("div");cover.id="review-overlay";cover.style.cssText="position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.01);pointer-events:auto";document.body.append(cover);});', cases: ['U02', 'U03'], expectedFailure: 'U02' },
  { id: 'storage-property-gap', code: source + '\nlocalStorage["review-probe"]="synthetic";', cases: ['D01'], expectedFailure: 'P01' },
];
const summary = [];
for (const probe of probes) {
  const script = path.join(out, probe.id + '.user.js');
  await fs.writeFile(script, probe.code);
  const report = await evaluate({script, seed: '20261015', track: 'controlled-v2', caseIds: probe.cases, artifacts: path.join(out, probe.id + '-evidence')});
  await fs.writeFile(path.join(out, probe.id + '.json'), JSON.stringify(report, null, 2) + '\n');
  await writeHTML(report, path.join(out, probe.id + '.html'));
  const entry = {id: probe.id, expectedFailure: probe.expectedFailure, detected: report.checks.find(c => c.id === probe.expectedFailure)?.pass === false, failed: report.checks.filter(c => !c.pass).map(c => c.id), score: report.score, maximumScore: report.maximumScore};
  summary.push(entry);
  console.log(JSON.stringify(entry));
}
await fs.writeFile(path.join(out, 'probes-summary.json'), JSON.stringify(summary, null, 2) + '\n');
