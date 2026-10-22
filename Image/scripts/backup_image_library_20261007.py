from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import json,hashlib,shutil,datetime
ROOT=Path('F:/benchmark');image=ROOT/'Image'
stamp=datetime.datetime.now().strftime('%H%M%S')
name='image-library-20261007-'+stamp
OUT=ROOT/'暂存/image-backups'/name;OUT.mkdir(parents=True,exist_ok=False)
sources=[(image,'Image'),(ROOT/'暂存/IMAGE','original-imports/IMAGE'),(ROOT/'暂存/muse-image-batch-20261007/agent-image-batch-20261007','original-imports/muse-agent-batch')]
pdf=ROOT/'output/pdf/image-agent-batch-guide-20261007.pdf'
files=[]
for base,prefix in sources:
 for p in sorted(base.rglob('*')):
  if p.is_file() and not any(a in {'.git','__pycache__','.env','node_modules'} for a in p.relative_to(base).parts):files.append((p,prefix+'/'+p.relative_to(base).as_posix()))
if pdf.exists():files.append((pdf,'guide/'+pdf.name))
manifest={'snapshot':name,'workspace':'F:/benchmark','file_count':len(files),'files':[],'parts':[]}
groups=[];group=[];size=0
for p,arc in files:
 length=p.stat().st_size
 if size+length>70_000_000 and group:groups.append(group);group=[];size=0
 group.append((p,arc));size+=length
 manifest['files'].append({'path':arc,'bytes':length,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
if group:groups.append(group)
hashes={r['path']:r['sha256'] for r in manifest['files']}
for i,g in enumerate(groups,1):
 part=OUT/f'{name}-part{i:02d}.zip'
 with ZipFile(part,'w',compression=ZIP_DEFLATED,compresslevel=1) as z:
  for p,arc in g:z.write(p,arc)
 with ZipFile(part) as z:
  assert z.testzip() is None
  for n in z.namelist():assert hashlib.sha256(z.read(n)).hexdigest()==hashes[n]
 manifest['parts'].append({'file':part.name,'bytes':part.stat().st_size,'sha256':hashlib.sha256(part.read_bytes()).hexdigest(),'files':len(g)})
manifest_path=OUT/'MANIFEST.json';manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'RESTORE.txt').write_text('将全部 partXX.zip 解压到同一个空目录，保留路径；这些是独立 ZIP 文件而非分卷压缩。Image/ 为完整图片库和预览工具，original-imports/ 为原始导入资产，guide/ 为 PDF 指南。校验清单在 MANIFEST.json。启动 Image/compare/start-preview.ps1；若 Python 路径不同，使用本机 Python 执行：python -m http.server 8771 --bind 127.0.0.1 --directory Image。打开 http://127.0.0.1:8771/compare/。备份未包含 API key。',encoding='utf8')
iout=Path('I:/backups/benchmark-images')/name;iout.mkdir(parents=True,exist_ok=False)
for p in OUT.iterdir():
 if p.is_file():
  shutil.copy2(p,iout/p.name);assert hashlib.sha256(p.read_bytes()).digest()==hashlib.sha256((iout/p.name).read_bytes()).digest()
(ROOT/'暂存/image-backups/LATEST.json').write_text(json.dumps({'snapshot':name,'local':str(OUT),'i_backup':str(iout),'files':[str(p) for p in sorted(OUT.iterdir()) if p.is_file()]},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'snapshot':name,'files':len(files),'parts':len(groups),'bytes':sum(x['bytes'] for x in manifest['parts']),'local':str(OUT),'i_backup':str(iout),'verified':True}))
