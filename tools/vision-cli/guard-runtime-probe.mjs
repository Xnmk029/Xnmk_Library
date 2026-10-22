// Exercise the real DSH native-tool registry, without creating an Agent or LLM call.
import path from 'node:path';
export const inject = ['tools', 'fs'];
export function apply(ctx) {
  const exit=ctx.get('appExit');
  setTimeout(async () => {
    try {
      const invoke=(name,args) => ctx.tools.execute({name,arguments:args,callId:'guard-probe-'+name+'-'+Math.random(),signal:new AbortController().signal});
      const inside=await invoke('read',{file_path:path.join(process.cwd(),'PROMPT.md')});
      const outside=await invoke('read',{file_path:path.join(process.cwd(),'..','sentinel.txt')});
      const listing=await invoke('glob',{path:path.dirname(process.cwd()),pattern:'**/*'});
      const text=x=>JSON.stringify(x.content || []);
      const checks={inside_read:!inside.isError && text(inside).includes('VISIBLE_FIXTURE'),
        outside_read_denied:outside.isError && text(outside).includes('outside the current workspace'),
        parent_glob_denied:listing.isError && text(listing).includes('outside the current workspace'),
        sentinel_not_disclosed:!text(outside).includes('PRIVATE_FIXTURE')};
      console.log(JSON.stringify({kind:'guard_native_registry_probe',model_calls:0,checks,pass:Object.values(checks).every(Boolean)}));
      exit(Object.values(checks).every(Boolean)?0:1);
    } catch(error) {
      console.error(String(error));exit(1);
    }
  },250);
}
