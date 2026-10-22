from pathlib import Path, PurePosixPath
from zipfile import ZipFile
from PIL import Image, ImageDraw
import json,hashlib,shutil,re

ROOT=Path(__file__).resolve().parents[1]
ZIP=Path('C:/Users/Administrator/Downloads/agent-image-batch-20261007.zip')
STAGING=ROOT.parent/'暂存/muse-image-batch-20261007'
RUN='muse-image-import20261007'
COMP=ROOT/'compare'
catalog=json.loads((COMP/'catalog.js').read_text(encoding='utf8').split(' = ',1)[1].strip().removesuffix(';'))
known={t['id']:t for t in catalog['tasks']}
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def local(u):return (COMP/u.split('?')[0]).resolve()
with ZipFile(ZIP) as z:
    # Validate all destinations before writing, including archive path traversal.
    for e in z.infolist():
        parts=PurePosixPath(e.filename).parts
        if '..' in parts or PurePosixPath(e.filename).is_absolute() or '\\' in e.filename or ':' in e.filename:
            raise ValueError('Unsafe ZIP member')
        target=(STAGING/e.filename).resolve()
        assert target.is_relative_to(STAGING.resolve())
    z.extractall(STAGING)
archive=STAGING/'agent-image-batch-20261007'
records=[]
for td in sorted(archive.iterdir()):
    if not td.is_dir():continue
    match=re.fullmatch(r'\d+-(.+)',td.name)
    if not match:continue
    task_id=match[1]
    assert task_id in known,task_id
    images=list(td.glob('media-generation-*-0-*.png'))
    assert len(images)==1,(task_id,len(images))
    src=images[0]
    if task_id.startswith('QualityStudy-'):
        target_task=ROOT/'QualityStudy20260911'/task_id.removeprefix('QualityStudy-')
    elif task_id=='InteriorDesignRender-legacy':target_task=ROOT/'InteriorDesignRender'
    elif task_id in ['RemoveAllPeople','BlackGoldGrade','HumanAnimalPoseEdit']:
        target_task=ROOT/'scores/edit-trials-20260909'/task_id
    else:target_task=ROOT/task_id
    dest=target_task/RUN;dest.mkdir(exist_ok=True,parents=True)
    shutil.copy2(src,dest/'result.png')
    assert digest(src)==digest(dest/'result.png')
    with Image.open(src) as im:width,height=im.size;im.verify()
    prompt=(td/'prompt.txt').read_text(encoding='utf-8-sig')
    shutil.copy2(td/'prompt.txt',dest/'prompt.txt')
    inputs=[]
    if (td/'assets').exists():
        (dest/'inputs').mkdir(exist_ok=True)
        for asset in sorted((td/'assets').iterdir()):
            if not asset.is_file():continue
            shutil.copy2(asset,dest/'inputs'/asset.name)
            reference=None
            for frame in known[task_id]['frames']:
                if frame.get('source') and asset.stem in ['source','bg']:reference=local(frame['source']['url']);break
            if reference is None:
                for r in known[task_id].get('references',[]):
                    candidate=local(r['url'])
                    if candidate.name==asset.name:reference=candidate;break
            inputs.append({'file':'inputs/'+asset.name,'sha256':digest(asset),
                           'workspace_reference':str(reference) if reference else None,
                           'matches_workspace_bytes':digest(asset)==digest(reference) if reference else None})
    raw_files=[]
    for raw in td.glob('*.json'):
        shutil.copy2(raw,dest/raw.name);raw_files.append(raw.name)
    m={'model':'Muse Image','label':'Muse Image','model_identity_source':'用户声明 muse image；压缩包未提供实际 API 模型 ID',
       'quality':None,'task_id':task_id,'prompt':prompt,'prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),
       'source_archive':str(ZIP),'source_member':str(src.relative_to(STAGING)),
       'imported_on':'2026-10-07','width':width,'height':height,'sha256':digest(src),
       'inputs':inputs,'input_provenance':'批次报告记载从 PDF 提取参考图；保留本批次实际资产，不替换工作区原图',
       'raw_records':raw_files,'batch_report':str(archive/'BATCH_REPORT.md')}
    if task_id=='ComicSixPanel':m['task_version']='2.0'
    (dest/'meta.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
    records.append({'task_id':task_id,'destination':str(dest/'result.png'),'sha256':digest(src),
                    'width':width,'height':height,'input_count':len(inputs),
                    'input_matches':sum(a['matches_workspace_bytes'] is True for a in inputs)})
assert len(records)==18,len(records)
(STAGING/'IMPORT-MANIFEST.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
# Review sheet made only from imported images, without changing stored originals.
for start in range(0,18,9):
    sheet=Image.new('RGB',(1200,1020),'#eef0f4');draw=ImageDraw.Draw(sheet)
    for i,r in enumerate(records[start:start+9]):
        with Image.open(r['destination']) as im:
            im=im.convert('RGB');im.thumbnail((390,300))
            x=i%3*400;y=i//3*340;sheet.paste(im,(x+(400-im.width)//2,y+25))
            draw.text((x+5,y+5),r['task_id'],fill='#172b40')
    sheet.save(STAGING/f'contact-{start//9+1}.jpg')
print(json.dumps({'imported':len(records),'reference_assets':sum(r['input_count'] for r in records),
                  'reference_assets_matching_workspace':sum(r['input_matches'] for r in records),
                  'manifest':str(STAGING/'IMPORT-MANIFEST.json')}))
