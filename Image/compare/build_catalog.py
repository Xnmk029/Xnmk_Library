"""Rebuild the local comparison catalog from images actually present on disk."""
from pathlib import Path
from PIL import Image
import json, hashlib, os

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
NAMES={'ArchPhotoreal':'建筑真实化','StandardBooks3D':'国标图书','ConstructivistPoster':'构成主义海报','WindowGlitchPoster':'窗口故障海报','GovTechPPT':'政务 PPT','TextbookPeachBlossom':'桃花源记课本','InteriorDesignRender':'苏醒崖连续渲染','ComicSixPanel':'F1 · 弯道交锋','SpriteLoop':'循环精灵图'}
EXT={'.png','.jpg','.jpeg','.webp'}
NAMES['SanFranciscoStreetPhone']='旧金山街头 · 手机写实'
NAMES.update({'VocaloidEnsemble':'世界知识 · V家六人同屏','GenshinEnsemble':'世界知识 · 原神六人同屏','ParisTrocaderoView':'世界知识 · 巴黎特罗卡德罗实景'})
WORLD_KNOWLEDGE={'VocaloidEnsemble','GenshinEnsemble','ParisTrocaderoView'}
NAMES.update({'GithubOutageCover':'GitHub · 崩溃视频封面','SwissModelSpec':'瑞士国际主义 · 模型参数','CharacterReplacement':'双角色替换 · 氛围与眼神保持'})
def read(p):
    try:return json.loads(p.read_text(encoding='utf-8-sig'))
    except (OSError,ValueError):return {}
def url(p):return Path(os.path.relpath(p,HERE)).as_posix()
def asset(p):
    if not p or not p.exists():return None
    with Image.open(p) as im:w,h=im.size
    return {'url':url(p)+'?v='+str(p.stat().st_mtime_ns),'width':w,'height':h}
def label(slug,m):
    if 'imagegen-builtin' in slug or m.get('model_id','x') is None and not m.get('model'):
        return '内置 Image Gen · 模型 ID 未公开'
    name=m.get('model') or slug
    q=m.get('quality') or m.get('parameters',{}).get('quality')
    return name+(' / '+q if q else '')
def output_files(d):
    # Include restored/parallel results such as result-qwen-4.jpg alongside
    # the conventional result.jpg without picking up unrelated assets.
    return sorted(p for p in d.glob('result*') if p.is_file() and p.suffix.lower() in EXT)
tasks=[]
excluded_tasks=set(read(ROOT/'batch-scope.json').get('excluded_tasks',[]))
for task,name in NAMES.items():
    if task in excluded_tasks:continue
    directory=ROOT/task
    if not directory.exists():continue
    versions=['1.0','2.0','3.0'] if task in WORLD_KNOWLEDGE else ['1.0','2.0'] if task=='ComicSixPanel' else ['2.0' if task=='InteriorDesignRender' else '1.0']
    for version in versions:
        item={'id':task+('-v1' if task=='ComicSixPanel' and version=='1.0' else ''),'title':'最后一班渡船 · 历史 v1' if task=='ComicSixPanel' and version=='1.0' else name,'version':version,'kind':'历史题' if task=='ComicSixPanel' and version=='1.0' else '现行题','frames':[]}
        if task in WORLD_KNOWLEDGE and version!='1.0':
            item.update(id=task+'-v'+version.split('.')[0],title=name+' · 难题 v'+version.split('.')[0],kind='知识难题 · 单次试跑')
        for frame in (range(1,9) if task=='InteriorDesignRender' else [1]):
            source=directory/'assets/frames'/f'frame_{frame:02}.png' if task=='InteriorDesignRender' else directory/'assets'/('source.jpg' if task=='ArchPhotoreal' else 'bg.jpg') if task in ['ArchPhotoreal','GovTechPPT'] else None
            if source and not source.exists():
                source=next((source.with_suffix(ext) for ext in ['.png','.jpg','.jpeg','.webp'] if source.with_suffix(ext).exists()),None)
            if source is None and task in ['CharacterReplacement','GithubOutageCover']:source=directory/'assets/source.png'
            entry={'number':frame,'source':asset(source),'variants':[]}
            for d in sorted(directory.iterdir()):
                if not d.is_dir() or d.name.startswith(('_','.')) or d.name=='assets':continue
                if task=='InteriorDesignRender':
                    candidates=[d/'v2-independent'/f'frame_{frame:02}.png']
                    mp=d/'v2-independent'/f'frame_{frame:02}.meta.json'
                    if not mp.exists():mp=d/'v2-independent/meta.json'
                    m=read(mp)
                    if 'records' in m:
                        detail=next((r for r in m['records'] if r.get('frame')==frame),{})
                        m={**m,**detail}
                else:
                    candidates=output_files(d);m=read(d/'meta.json');mp=d/'meta.json'
                if task=='ComicSixPanel':
                    actual=str(m.get('task_version','2.0' if 'v2' in d.name else '1.0'))
                    if actual!=version:continue
                if task in WORLD_KNOWLEDGE and str(m.get('task_version','1.0'))!=version:continue
                for p in candidates:
                    a=asset(p)
                    if not a:continue
                    seconds=m.get('seconds')
                    if seconds is None and m.get('elapsedMs') is not None:seconds=m['elapsedMs']/1000
                    a.update(id=d.name, label=label(d.name,m),run=d.name,seconds=seconds,meta=url(mp) if mp.exists() else None,promptHash=m.get('prompt_sha256') or (hashlib.sha256(m['prompt'].encode()).hexdigest() if m.get('prompt') else None))
                    entry['variants'].append(a)
            item['frames'].append(entry)
        if any(f['variants'] for f in item['frames']):tasks.append(item)
TRIAL=ROOT/'scores/edit-trials-20260909'
legacy_dir=ROOT/'InteriorDesignRender'
legacy_variants=[]
if legacy_dir.exists():
    for d in sorted(legacy_dir.iterdir()):
        if not d.is_dir() or d.name.startswith(('_','.')) or d.name=='assets':continue
        for p in output_files(d):
            m=read(d/'meta.json');a=asset(p)
            a.update(id=d.name+'-'+p.stem,label=label(d.name,m),run=d.name,seconds=None,meta=url(d/'meta.json') if (d/'meta.json').exists() else None,promptHash=None)
            legacy_variants.append(a)
if legacy_variants:
    tasks.append({'id':'InteriorDesignRender-legacy','title':'室内设计渲染 · 历史双图题','version':'历史','kind':'历史题（非连续渲染）','frames':[{'number':1,'source':asset(legacy_dir/'assets/source.png'),'variants':legacy_variants}]})
for task,title in [('RemoveAllPeople','街道人物清除'),('BlackGoldGrade','建筑黑金调色'),('HumanAnimalPoseEdit','人与犬姿态重构')]:
    d=TRIAL/task;m=read(d/'meta.json');p=d/'result.png'
    if not d.exists():continue
    variants=[]
    if p.exists():
        a=asset(p);a.update(id='imagegen-trial',label='内置 Image Gen · 模型 ID 未公开',run='首轮草案试题',seconds=m.get('seconds'),meta=url(d/'meta.json'),promptHash=hashlib.sha256(m.get('prompt','').encode()).hexdigest())
        variants.append(a)
    for run_dir in sorted(d.iterdir()):
        if not run_dir.is_dir():continue
        metadata=read(run_dir/'meta.json')
        for image_path in output_files(run_dir):
            result=asset(image_path)
            if not result:continue
            seconds=metadata.get('seconds')
            if seconds is None and metadata.get('elapsedMs') is not None:seconds=metadata['elapsedMs']/1000
            result.update(id=run_dir.name,label=label(run_dir.name,metadata),run=run_dir.name,seconds=seconds,meta=url(run_dir/'meta.json') if (run_dir/'meta.json').exists() else None,promptHash=metadata.get('prompt_sha256'))
            variants.append(result)
    if variants:
        tasks.append({'id':task,'title':title,'version':'草案','kind':'新试题','frames':[{'number':1,'source':asset(d/m['input']) if m.get('input') else None,'variants':variants}]})
# Keep document provenance separate from per-model invocation records.
for task in tasks:
    task_id=task['id']
    if task_id=='ComicSixPanel-v1':
        directory=ROOT/'ComicSixPanel/_legacy/v1-ferry'
    elif any(task_id==base+'-v'+version for base in WORLD_KNOWLEDGE for version in ['2','3']):
        base,version=task_id.rsplit('-v',1)
        directory=ROOT/base/'_versions'/('v'+version)
    elif task_id=='InteriorDesignRender-legacy':
        directory=ROOT/'InteriorDesignRender'
    elif task_id in ['RemoveAllPeople','BlackGoldGrade','HumanAnimalPoseEdit']:
        directory=TRIAL/task_id
    else:
        directory=ROOT/task_id
    prompt=directory/('PROMPT.md' if directory.parent==TRIAL else 'PROJECT_PROMPT.md')
    statement=directory/'README.md'
    task['documents']={'prompt':url(prompt) if prompt.exists() else None,'statement':url(statement) if statement.exists() else None}
    task['references']=[dict(asset(directory/r['file']),label=r['label']) for r in read(directory/'references.json').get('images',[]) if asset(directory/r['file'])]

# Dedicated topic: API quality matrix, Codex built-in, and labeled web outputs.
study=ROOT/'QualityStudy20260911'
for slug,title in [('i2i-precise','夜港 · 详细提示词'),('i2i-open','夜港 · 开放提示词'),('t2i-poster','DeepSeek V4 · 海报')]:
    directory=study/slug
    if not directory.exists():continue
    variants=[]
    for d in sorted(directory.iterdir()):
        if not d.is_dir() or d.name.startswith(('_','.')):continue
        key=d.name;m=read(d/'meta.json')
        for p in output_files(d):
            a=asset(p)
            if not a:continue
            name=m.get('label') or ('Codex 内置 Image Gen · 模型 ID 未公开' if key=='codex-imagegen' else m.get('model',key)+' / '+str(m.get('quality','未知')))
            a.update(id='quality-study-'+key,label=name,run=key,seconds=m.get('elapsedMs')/1000 if m.get('elapsedMs') is not None else None,meta=url(d/'meta.json'),promptHash=m.get('prompt_sha256'))
            variants.append(a)
    tasks.append({'id':'QualityStudy-'+slug,'title':title,'topic':'Image 2.5 · 强度与入口对照','version':'20260911','kind':'专题','documents':{'prompt':url(directory/'PROMPT.md'),'statement':url(study/'TOPIC.md')},'frames':[{'number':1,'source':asset(directory/'source.png'),'variants':variants}]})

data={'tasks':tasks,'styleSource':'codex://threads/01a07a39-8a50-7d32-b69e-3dce6dffacaa','preset':'motion-kit-v03 / compare','note':'仅收录实际存在的结果；模型名来自本地记录，历史记录未经本页验证。'}
(HERE/'catalog.js').write_text('window.IMAGE_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf8')
print(f'{len(tasks)} task groups, {sum(len(f["variants"]) for t in tasks for f in t["frames"])} images cataloged')
