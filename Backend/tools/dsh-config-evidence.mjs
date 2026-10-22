// Only allowlisted configuration fields leave the subprocess; credentials are never saved.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const label=process.argv[2]??'backend-dsh-opendes-v41f-high-20261016';
const out=path.join(root,'Backend/pilots',label);
const adapter=JSON.parse(fs.readFileSync(path.join(out,'adapter.json')));
const bin=adapter.argv[1],yaml=createRequire(bin)('yaml');
const r=spawnSync(process.execPath,[bin,'--profile','headless','--patch',path.join(out,'dsh-high.patch.yml'),'--dump-config'],{encoding:'utf8',timeout:60000,windowsHide:true});
if(r.status!==0)throw Error('DSH config resolution failed (raw output withheld)');
const parsed=yaml.parse(r.stdout);
const matches=[];
function walk(v){if(!v||typeof v!=='object')return;if(v.id==='agent-default-model'||v.name==='@deepseek-ai/dsh-agent-default-model'){const c=v.config??{};matches.push({component:v.id,name:v.name,provider:c.provider,model:c.model,reasoningEffort:c.reasoningEffort});}if(v.id==='llm-pi-ai'||v.name==='@deepseek-ai/dsh-llm-pi-ai'){const c=v.config?.providers?.opendes;if(c)matches.push({component:v.id,provider:'opendes',displayName:c.displayName,baseURL:c.baseURL,api:c.api,models:c.models?.map(m=>({id:m.id,reasoningEfforts:m.reasoningEfforts,compat:m.compat}))});}for(const x of Object.values(v))walk(x);}
walk(parsed);
if(!matches.some(m=>m.provider==='opendes'&&m.model==='deepseek-v4.1-flash'&&m.reasoningEffort==='high'))throw Error('Composed model/effort did not match');
const evidence={createdAt:new Date().toISOString(),dshVersion:'0.2.1-alpha.2',source:'DSH composed config, allowlist only',settings:matches,note:'This verifies effective local selection. Provider response model identity is recorded separately from session traces; no wire-level effort claim.'};
fs.writeFileSync(path.join(out,'CONFIG.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence));
