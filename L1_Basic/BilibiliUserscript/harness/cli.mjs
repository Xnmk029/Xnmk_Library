import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluate } from './runner.mjs';
import { writeHTML } from './report.mjs';

export function argumentsFor(argv) {
  const options={};
  for(let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if(arg==='--help') return {help:true};
    if(!['--script','--out','--html','--seed','--track','--channel','--browser','--artifacts','--screenshots'].includes(arg)||!argv[i+1]) throw new Error('Unknown argument or missing value: '+arg);
    options[arg.slice(2)]=argv[++i];
  }
  if(!options.script) throw new Error('--script <candidate.user.js> is required');
  return options;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options=argumentsFor(process.argv.slice(2));
    if(options.help) console.log('node harness/cli.mjs --script answer.user.js --out runs/result.json [--track controlled-v2|diagnostic-v1] [--seed 20260930] [--channel msedge|chrome] [--browser /path/to/chromium] [--artifacts runs/evidence]');
    else {
      options.progress=(id,pass)=>console.error((pass?'PASS ':'FAIL ')+id);
      const report=await evaluate(options);
      if(options.out) {const output=path.resolve(options.out);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');}
      if(options.html) await writeHTML(report,options.html);
      console.log(JSON.stringify({score:report.score,verdict:report.verdict,qualifiedScore:report.qualifiedScore,failedGates:report.failedGates,output:options.out||null}));
      if(!options.out) console.log(JSON.stringify(report,null,2));
      process.exitCode=report.verdict==='PASS'?0:1;
    }
  } catch(error) {console.error('HARNESS ERROR: '+error.stack);process.exitCode=2;}
}
