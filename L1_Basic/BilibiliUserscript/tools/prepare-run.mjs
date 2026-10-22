import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++) {
  if(!['--out','--model','--track','--seed'].includes(args[i])||!args[i+1]) throw new Error('Unknown argument: '+args[i]);
  options[args[i].slice(2)]=args[++i];
}
if(!options.out||!options.model) throw new Error('Usage: node tools/prepare-run.mjs --out F:/bench-runs/<new-run> --model <exact-model-id> [--track controlled-v2|diagnostic-v1]');
const manifest=JSON.parse(await fs.readFile(path.join(root,'benchmark.json'),'utf8'));
const track=options.track||'controlled-v2';
if(!manifest.tracks[track]) throw new Error('Unknown track');
const target=path.resolve(options.out);
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.mkdir(target); // Deliberately refuses an existing run: never overwrite model outputs.
const prompt=await fs.readFile(path.join(root,manifest.tracks[track].prompt));
await fs.writeFile(path.join(target,'PROMPT.md'),prompt);
let contractSha256=null;
if(track==='controlled-v2') {
  const contract=await fs.readFile(path.join(root,manifest.publicContract));
  await fs.writeFile(path.join(target,'CONTRACT.md'),contract);
  contractSha256=createHash('sha256').update(contract).digest('hex');
}
const metadata={schemaVersion:1,taskId:manifest.id,benchmarkVersion:manifest.version,model:options.model,track,seed:options.seed||'20260930',promptSha256:createHash('sha256').update(prompt).digest('hex'),contractSha256,createdAt:new Date().toISOString(),generation:{status:'not_started',provider:null,reasoningEffort:null,temperature:null,inputTokens:null,outputTokens:null,wallTimeMs:null},expectedOutput:'answer.user.js'};
await fs.writeFile(path.join(target,'run-manifest.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({workspace:target,prompt:'PROMPT.md',contract:track==='controlled-v2'?'CONTRACT.md':null,model:options.model,track}));
