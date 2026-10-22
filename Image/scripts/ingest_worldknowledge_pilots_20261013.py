from pathlib import Path
from PIL import Image
import json,hashlib,shutil

root=Path(__file__).resolve().parents[1]
notes={
 ('VocaloidEnsemble','2.0'):'六个完整主体；出现相似的泛化汉服造型。角色身份及首次声库衣装尚未按官方历史立绘逐项复核，不给正式知识分。',
 ('GenshinEnsemble','2.0'):'三组各两人的布局可见，具体角色身份、默认衣装及神之眼仍需逐项核验。',
 ('ParisTrocaderoView','2.0'):'生成了反向主轴取景；楼层高度与精确地理关系未正式评分。',
 ('GenshinEnsemble','3.0'):'视觉初判：左组绮良良与琴，中组神里绫华与申鹤，右组芭芭拉与甘雨；没有按蒙德、稻妻、璃月正确分组。衣装细节尚待官方逐项核验。',
 ('ParisTrocaderoView','3.0'):'生成了历史风格的反向取景；宫殿与中央园林形态需与1900年照片核验。没有正式知识分。'
}
records=[]
for major in [2,3]:
 manifest=root/f'imports/imagegen-worldknowledge-v{major}-20261013/calls.json'
 calls=json.loads(manifest.read_text(encoding='utf-8'))
 for call in calls:
  task=call['task_id'];version=call['task_version'];prompt=call['prompt']
  src=Path(call['source_file']);data=src.read_bytes();digest=hashlib.sha256(data).hexdigest()
  d=root/task/f'imagegen-builtin-worldknowledge-v{major}-20261013'
  d.mkdir(parents=True,exist_ok=True)
  out=d/'result.png'
  if out.exists() and out.read_bytes()!=data:raise ValueError('Result collision')
  shutil.copy2(src,out)
  with Image.open(out) as im:w,h=im.size;im.verify()
  (d/'prompt.txt').write_text(prompt,encoding='utf-8',newline='')
  meta=dict(task_id=task,task_version=version,model='内置 Image Gen · 模型 ID 未公开',
   model_id=None,quality=None,entry='built-in image_gen',generated_on='2026-10-13',
   prompt=prompt,prompt_sha256=hashlib.sha256(prompt.encode()).hexdigest(),width=w,height=h,
   sha256=digest,source_file=str(src),input_refs=[],generation_agent_used_search=False,
   orchestrator_used_search=True,orchestrator_search_scope='出题核验与生成后的评审；检索内容没有追加到生成提示词或参考图输入',
   internal_search_trace='工具未返回，未验证',review_used_sources_after_generation=True,
   status='generated_pilot',formal_score=None,observations=notes[(task,version)],
   sampling='One first attempt for this prompt version; not a calibrated ranking',
   size_note='实际1536×1024；3:2比例，低于建议2400×1600；未重采样或修图')
  (d/'meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
  snapshot=root/task/'_versions'/f'v{major}';snapshot.mkdir(parents=True,exist_ok=True)
  snapshot_prompt=snapshot/'PROJECT_PROMPT.md'
  if snapshot_prompt.exists() and snapshot_prompt.read_text(encoding='utf-8').strip()!=prompt.strip():
   raise ValueError('Prompt snapshot collision')
  snapshot_prompt.write_text(prompt,encoding='utf-8',newline='')
  (snapshot/'README.md').write_text(f'# 世界知识 {task} v{major}\n\n版本：{version}。2026-10-13单次首轮试跑题面。无参考图，禁止搜索；生成与评审阶段分离。实际调用见各结果meta.json。\n\nv1及其他版本结果独立保存，不将不同题面当作同题同参数结果。该版本尚未完成多样本难度校准；评审标准与答案资料不作为生成输入。\n',encoding='utf-8')
  assert out.read_bytes()==data
  records.append(dict(task_id=task,version=version,path=str(out),sha256=digest,width=w,height=h))
report=root/'imports/worldknowledge-pilots-20261013.json'
report.write_text(json.dumps(dict(generated_on='2026-10-13',results=records,formal_scores=None,
 recommendation={'VocaloidEnsemble':'2.0','GenshinEnsemble':'3.0','ParisTrocaderoView':'3.0'},
 conclusion='Harder pilot prompts selected; one sample each does not establish a model ceiling.'),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Imported {len(records)} exact PNG copies with separate prompt snapshots.')
