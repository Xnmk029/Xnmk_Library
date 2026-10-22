from pathlib import Path
from PIL import Image
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT.parent/'暂存/IMAGE'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
tasks={'黑金调色':'BlackGoldGrade','人犬姿势':'HumanAnimalPoseEdit','人物去除':'RemoveAllPeople','F1':'ComicSixPanel','精灵图':'SpriteLoop'}
models={'grok':'Grok Image 2','hyimage':'HY Image 3.5','nanobanana':'Nano Banana 2','qwen':'Qwen Image 3','seedream':'Seedream 5 Pro'}
catalog=json.loads((ROOT/'compare/catalog.js').read_text(encoding='utf8').split(' = ',1)[1].strip().removesuffix(';'))
known={t['id']:t for t in catalog['tasks']};records=[]
for src in sorted(SOURCE.iterdir()):
 if not src.is_file() or src.suffix.lower() not in {'.png','.jpeg','.jpg','.jfif','.webp'}:continue
 task=next((v for k,v in tasks.items() if k.lower() in src.name.lower()),None)
 model=next((v for k,v in models.items() if src.name.lower().startswith(k)),None)
 if not task or not model:raise ValueError('Unmapped file '+src.name)
 sha=digest(src)
 if task=='SpriteLoop':
  records.append({'source':str(src),'task':task,'model':model,'sha256':sha,'status':'excluded_by_user','note':'保留在备份中，不恢复到当前题集'});continue
 # Byte-level duplicate detection within the same task, retaining existing metadata.
 existing=None
 if task in known:
  for a in known[task]['frames'][0]['variants']:
   p=(ROOT/'compare'/a['url'].split('?')[0]).resolve()
   if digest(p)==sha:existing=p;break
 if existing:
  records.append({'source':str(src),'task':task,'model':model,'sha256':sha,'status':'already_cataloged','destination':str(existing)});continue
 base=ROOT/task if task=='ComicSixPanel' else ROOT/'scores/edit-trials-20260909'/task
 slug=model.lower().replace(' ','-')+'-image-dir-import20261007';dest=base/slug;dest.mkdir(exist_ok=True,parents=True)
 extension='.jpg' if src.suffix.lower()=='.jfif' else src.suffix.lower()
 p=dest/('result'+extension);shutil.copy2(src,p);assert digest(p)==sha
 with Image.open(p) as im:w,h=im.size;im.verify()
 metadata={'model':model,'model_identity_source':'文件名；Nano Banana 文件名错误已按用户此前声明统一为 Nano Banana 2','quality':None,'source_file':str(src),'imported_on':'2026-10-07','sha256':sha,'width':w,'height':h,'prompt_known':False}
 if task=='ComicSixPanel':metadata['task_version']='2.0'
 (dest/'meta.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf8')
 records.append({'source':str(src),'task':task,'model':model,'sha256':sha,'status':'imported','destination':str(p)})
(ROOT/'scripts/IMAGE-directory-import-20261007.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({s:sum(r['status']==s for r in records) for s in ['imported','already_cataloged','excluded_by_user']}))
