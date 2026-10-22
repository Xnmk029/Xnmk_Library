from pathlib import Path
import sys,json,shutil,hashlib
from PIL import Image
root=Path(__file__).resolve().parents[1]
queue=root.parent/'暂存/mai-image-2.6-web-test-20261007/tasks.json'
tasks=json.loads(queue.read_text(encoding='utf8'))
task=next(t for t in tasks if t['task_id']==sys.argv[1])
src=Path(sys.argv[2])
if task['task_id'].startswith('QualityStudy-'):
 directory=root/'QualityStudy20260911'/task['task_id'].removeprefix('QualityStudy-')
elif task['task_id'] in ['RemoveAllPeople','BlackGoldGrade','HumanAnimalPoseEdit']:
 directory=root/'scores/edit-trials-20260909'/task['task_id']
elif task['task_id']=='InteriorDesignRender-legacy':directory=root/'InteriorDesignRender'
else:directory=root/task['task_id']
dest=directory/'mai-image-2.6-web20261007';dest.mkdir(exist_ok=True)
target=dest/('result'+src.suffix.lower());shutil.copy2(src,target)
digest=hashlib.sha256(src.read_bytes()).hexdigest()
assert digest==hashlib.sha256(target.read_bytes()).hexdigest()
with Image.open(target) as im:width,height=im.size;im.verify()
m={'model':'MAI-Image-2.6','prompt':task['prompt'],'prompt_sha256':hashlib.sha256(task['prompt'].encode()).hexdigest(),'quality':None,'width':width,'height':height,'source_file':str(src),'sha256':digest,'entry':'Microsoft AI Playground / Codex in-app browser','references':task['references'],'conversation_url':sys.argv[3] if len(sys.argv)>3 else None}
if task['task_id']=='ComicSixPanel':m['task_version']='2.0'
(dest/'meta.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
task.update(status='completed',result=str(target),sha256=digest)
queue.write_text(json.dumps(tasks,ensure_ascii=False,indent=2),encoding='utf8')
print(task['task_id'],width,height,'saved')
