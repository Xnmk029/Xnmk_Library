"""Pin imported adapter support files before any case is dispatched."""
import argparse, json
from pathlib import Path
from sandbox_lib import sha256_file
from vision_profile import no_links

def freeze(suite_path, support_files):
    suite=json.loads(suite_path.read_text(encoding='utf-8'))
    if any((Path(r['harness'])/name).exists() for r in suite['runs'] for name in ('started.json','execution.json')):
        raise ValueError('cannot extend a suite after dispatch')
    additions={}
    for support in support_files:
        path=support.resolve();no_links(path)
        if not path.is_file():raise ValueError('support file is missing')
        additions[str(path)]=sha256_file(path)
    existing=suite.setdefault('adapter_files',{})
    for path,digest in additions.items():
        if path in existing and existing[path]!=digest:raise ValueError('already pinned support file changed')
    existing.update(additions)
    suite_path.write_text(json.dumps(suite,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'pinned_files':len(existing),'suite':str(suite_path)}))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--suite',type=Path,required=True);ap.add_argument('--file',type=Path,action='append',required=True)
    a=ap.parse_args();freeze(a.suite,a.file)
