"""封装 Blockbench 单题；复制白名单，不打包任何历史候选目录。"""
from pathlib import Path
import csv,hashlib,json,re,shutil,struct,zipfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'NativeWorkflowBench/BlockbenchWeaponHands_ZH'
PUB=SOURCE/'candidate'
EXCLUDED={'.godot','runtime','__pycache__'}
SUFFIXES={'.md','.txt','.json','.png','.svg','.bbmodel','.glb','.py','.gd','.tscn','.godot','.csv'}

def dump(path,obj):
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def public_files():
    return sorted(p for p in PUB.rglob('*') if p.is_file() and not EXCLUDED.intersection(p.relative_to(PUB).parts) and p.suffix in SUFFIXES and p.name!='FILES_SHA256.json')

def record(path,base):
    raw=path.read_bytes()
    return {'路径':path.relative_to(base).as_posix(),'字节数':len(raw),'SHA256':hashlib.sha256(raw).hexdigest()}

def manifests():
    dump(PUB/'TASK.json',{'题号':'BB01-G','版本':'1.0','语言':'简体中文','目标':'ROOK-7 精细虚构枪械与第一人称手部动画','阶段':['建模、分件、UV、表面、层级和快照','六段手部动作、导出和目标回放'],'题面':'题目.md','公开契约':'兼容契约.md','派发入口':'派发提示词.txt','公共手底模':'inputs/HANDS_NEUTRAL.bbmodel','目标参考':'inputs/概念示意.png','版本锁':{'Blockbench':'5.2.2','bbmodel':'5.0','Godot':'4.5.1.stable.official.f62fdbde1','glTF':'2.0'},'TACZ条件':False,'正式收卷管线已登记':False,'自动评分已校准':False,'状态':'公共输入与查看器可用于人工监考试测；评分需独立复核，正式管线另行接入'})
    dump(PUB/'FILES_SHA256.json',{'说明':'仅覆盖发布时的公开材料，不包含本清单自身、运行缓存和候选提交。','文件':[record(p,PUB) for p in public_files()]})

def env_csv():
    items=[
        ['Windows','10/11 x64','必需基线','桌面与录屏、可写工作/临时目录','记录具体系统版本'],
        ['Blockbench','5.2.2','必需','https://github.com/JannisX11/blockbench/releases/tag/v5.2.2','Generic Model/free；内置glTF导出；独立配置'],
        ['Godot','4.5.1 stable','必需','https://godotengine.org/download/archive/4.5.1-stable/','标准版；Compatibility；console程序与主程序同目录'],
        ['Python','3.12；脚本最低3.10','必需','https://www.python.org/downloads/windows/','公开工具仅用标准库，无需pip'],
        ['FFmpeg','7.1，同场固定构建','可选','https://ffmpeg.org/download.html','视频恒定30帧/秒；保留真实帧数'],
        ['Node.js','24','组织者维护可选','https://nodejs.org/en/download','仅原生API传输辅助；不是考生运行依赖'],
        ['MCP','本包未指定','工具条件可选','自行冻结服务器、版本/提交、工具名和启动参数','先做无关小方块原生往返；不宣称预装可用'],
        ['硬件','建议16GB内存、OpenGL3.3、5GB可用磁盘','建议','非已测性能门槛','逐帧证据需额外空间；不按宿主帧率评分'],
        ['其他外部依赖','无必需素材下载/付费插件/云API','无','所有公共题目输入随包','软件安装文件不随包；不构成完全离线软件镜像'],
    ]
    with (SOURCE/'organizer/环境配置清单.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.writer(f);writer.writerow(['项目','版本或配置','必要性','获取或准备','验收注意']);writer.writerows(items)

def finalize():
    env_csv();manifests()
    verification_names=['验证摘要.md','底模原生构建.json','底模原生重开.json','底模目标加载.json','动画探针.json','迁移原生重开.json','迁移目标加载.json','公共输入结构核对.json','环境与清洗核对.json','预览器实际渲染.png','PROBE_ONLY.glb','create_probe.gd','capture_viewer.gd']
    files=[SOURCE/'README.md',*public_files(),PUB/'FILES_SHA256.json']
    files += [p for p in (SOURCE/'organizer').iterdir() if p.is_file() and p.suffix in {'.md','.csv','.json','.js','.mjs'}]
    files += [SOURCE/'verification'/n for n in verification_names]
    assert all(p.is_file() for p in files),[str(p) for p in files if not p.is_file()]
    assert len(set(files))==len(files)
    for p in files:
        if p.suffix in {'.md','.txt','.json','.csv','.gd','.js','.mjs','.py','.tscn','.godot','.svg','.bbmodel'}:
            text=p.read_text(encoding='utf-8-sig')
            assert not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]',text),f'控制字符：{p}'
            if p.suffix in {'.md','.txt'}: assert '\t' not in text,f'说明文档出现意外制表符：{p}'
            assert not re.search(r'(?:[A-Z]:[\\/](?:Users|benchmark|creative-workflow-pilots|bench-runs)|Administrator|gpt-6\.1|claude-opus|gemini-4|deepseek-v4|api_key\s*[=:]\s*[\"\'][A-Za-z0-9]{12})',text,re.I),f'残留本机路径、模型信息或密钥模式：{p}'
            if p.suffix=='.json': json.loads(text)
    manifest=SOURCE/'FILES_SHA256.json'
    dump(manifest,{'题包':'Blockbench_BB01-G_完整中文题包_v1.0_20261019','说明':'不含本清单自身；压缩包外部另提供SHA256。candidate为考生材料；organizer与verification不派发。','文件':[record(p,SOURCE) for p in sorted(files)]})
    files.append(manifest)
    export=ROOT/'artifacts/bench-packages'
    export.mkdir(parents=True,exist_ok=True)
    dest=export/'Blockbench_BB01-G_完整中文题包_v1.0_20261019.zip'
    with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(files):
            z.write(p,arcname='Blockbench_BB01-G_ZH_v1.0/'+p.relative_to(SOURCE).as_posix())
    with zipfile.ZipFile(dest) as z:
        assert z.testzip() is None
        assert len(z.namelist())==len(set(z.namelist()))==len(files)
        assert not any('..' in n.split('/') or n.startswith('/') or ':' in n for n in z.namelist())
    sha=hashlib.sha256(dest.read_bytes()).hexdigest()
    dest.with_suffix('.zip.sha256.txt').write_text(sha+'  '+dest.name+'\n',encoding='utf-8')
    result={'文件':str(dest),'字节数':dest.stat().st_size,'文件数':len(files),'SHA256':sha,'ZIP完整性':True,'题目范围':'仅Blockbench BB01-G','受测模型成果':False,'本机路径与历史模型信息扫描':'通过','说明':'ZIP由已审核的显式白名单生成；没有遍历或读取历史候选产出目录。'}
    dump(export/'Blockbench_BB01-G_打包报告.json',result)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__': finalize()
