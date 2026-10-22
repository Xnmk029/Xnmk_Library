from pathlib import Path
from PIL import Image
import hashlib, json, shutil

root=Path(__file__).resolve().parents[1]
source=Path('C:/Users/Administrator/.codex/generated_images/01a08c27-c229-7b92-85e0-18f89c44a497')
run='imagegen-builtin-worldknowledge-20261010'
calls={r['task_id']:r for r in json.loads((root/'imports/imagegen-worldknowledge-20261010/calls.json').read_text(encoding='utf-8'))}
items=[
 ('VocaloidEnsemble','exec-d4c9188f-9f25-40ce-9300-f0abe18ca2c9.png','六位主体可见；人物身体部分被画面边缘裁切，未满足每位完整出现。'),
 ('GenshinEnsemble','exec-d66d6c17-9b62-4a35-83b4-7a34044b09eb.png','六位主体可见；下半身被桌面遮挡或裁切，未满足每位完整出现。'),
 ('ParisTrocaderoView','exec-f32e3c81-0e7a-43ad-83f2-7b6e6f6a68eb.png','实景方向题已生成；具体地理关系尚未独立核验。'),
]
for task, filename, note in items:
 d=root/task/run; d.mkdir(parents=True,exist_ok=True)
 src=source/filename
 out=d/'result.png'
 if out.exists() and out.read_bytes()!=src.read_bytes(): raise ValueError('Result collision')
 shutil.copy2(src,out)
 with Image.open(out) as im: w,h=im.size; im.verify()
 prompt=calls[task]['prompt']
 (d/'prompt.txt').write_text(prompt,encoding='utf-8',newline='')
 meta=dict(model='内置 Image Gen · 模型 ID 未公开', model_id=None,quality=None,
  task_id=task,task_version='1.0',entry='built-in image_gen',generated_on='2026-10-10',
  prompt=prompt,prompt_sha256=hashlib.sha256(prompt.encode()).hexdigest(),
  source_file=str(src),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),width=w,height=h,
  search_policy='禁止外部搜索与参考图片',input_refs=[],agent_used_search=False,
  generation_tool_internal_search='工具未返回内部轨迹，无法独立核验',
  requested_size='3:2，建议 2400×1600 或更高',size_check='实际 1536×1024，符合比例但低于建议尺寸',
  observations=note,iteration=1,status='generated')
 (d/'meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
 print(task,w,h)
