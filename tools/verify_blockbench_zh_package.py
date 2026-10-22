"""公共题包自检；不读取历史候选答卷。"""
from pathlib import Path
import base64,hashlib,io,json,shutil,struct,importlib.util
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'NativeWorkflowBench/BlockbenchWeaponHands_ZH'
PUB=BASE/'candidate'

def save(name,obj):
    (BASE/'verification'/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
    native=json.loads((PUB/'inputs/HANDS_NEUTRAL.bbmodel').read_text(encoding='utf-8'))
    assert native['meta']['model_format']=='free' and native['meta']['format_version']=='5.0'
    assert len(native['elements'])==34 and len(native['groups'])==33
    assert not native.get('animations')
    assert all('path' not in t for t in native['textures'])
    tex=Image.open(io.BytesIO(base64.b64decode(native['textures'][0]['source'].split(',',1)[1]))).convert('RGB')
    assert tex.size==(512,512) and tex.getcolors()==[(512*512,(152,152,152))]
    raw=(PUB/'inputs/HANDS_NEUTRAL.glb').read_bytes()
    assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
    offset=12; doc=None; binary=None
    while offset<len(raw):
        n,kind=struct.unpack_from('<II',raw,offset);offset+=8
        if kind==0x4e4f534a:doc=json.loads(raw[offset:offset+n])
        if kind==0x004e4942:binary=raw[offset:offset+n]
        offset+=n
    assert doc['asset']['version']=='2.0' and not doc.get('animations')
    assert len(doc['images'])==1
    view=doc['bufferViews'][doc['images'][0]['bufferView']]
    start=view.get('byteOffset',0)
    image=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB')
    assert image.size==(512,512) and image.tobytes()==tex.tobytes()
    triangles=0
    for node in doc['nodes']:
        if 'mesh' in node:
            for p in doc['meshes'][node['mesh']]['primitives']:
                assert p.get('mode',4)==4
                triangles+=doc['accessors'][p['indices']]['count']//3
    assert triangles==408
    save('公共输入结构核对.json',{'原生格式':'free / 5.0','方块数':34,'组数':33,'原生与导出动画数':0,'实际导出三角面':triangles,'贴图尺寸':[512,512],'内嵌图像与原图逐像素一致':True,'绝对纹理路径':False,'内容范围':'独立制作的中性手与前臂，不含枪械、核心动作或完成贴图','概念原图SHA256':hashlib.sha256((PUB/'inputs/概念示意.png').read_bytes()).hexdigest()})
    # 原目录结构缺项必须如实失败；不把公共底模当作完成答卷。
    module_path=PUB/'tools/inspect_submission.py'
    spec=importlib.util.spec_from_file_location('bb_public_inspector',module_path)
    inspector=importlib.util.module_from_spec(spec);spec.loader.exec_module(inspector)
    negative=ROOT/'tmp/BB01G_缺项反例'
    (negative/'model').mkdir(parents=True,exist_ok=True);(negative/'export').mkdir(exist_ok=True)
    shutil.copyfile(PUB/'inputs/HANDS_NEUTRAL.bbmodel',negative/'model/WeaponHands.bbmodel')
    shutil.copyfile(PUB/'inputs/HANDS_NEUTRAL.glb',negative/'export/WeaponHands.glb')
    report=inspector.inspect(negative)
    assert report['自动检查无失败'] is False
    assert sum(x['通过'] is False for x in report['检查'] if x['项目'].startswith('动作 '))==6
    assert report['美术与接触评分'] is None
    # 新目录含中文与空格，排除所有旧缓存，供原生和目标端实际重开。
    relocated=ROOT/'tmp/BB01G 中文搬迁'
    for p in PUB.rglob('*'):
        rel=p.relative_to(PUB)
        if not p.is_file() or {'.godot','runtime','__pycache__'}.intersection(rel.parts) or p.suffix in {'.pyc','.uid','.import'}:continue
        target=relocated/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
    save('环境与清洗核对.json',{'中文材料':'题面、界面、契约、迁移清单、评分与收卷说明使用中文；保留技术标识','结构检查缺项反例':'只有手底模且缺六核心动作的反例被正确拒绝；未生成美术分','搬迁目录':'独立的新目录，含中文与空格；未复制生成缓存','软件参考指纹':{'Blockbench_5.2.2_便携版exe':'2c29819ac9ad2f0abcfda2ba6eed8a75afcb1ead58412b6f6152d2eb9e81e827','Godot_4.5.1_主程序exe':'a829242096d640007de9fa93ea923d0f666d13d6a3b472a0231c820be6dc7627','Godot_4.5.1_console启动器exe':'f0336c8b2ae039d39767a64c416f01b1b49d95d8dde87724012874dd4be1c1a8'},'实际图形环境':'OpenGL 3.3；NVIDIA GeForce RTX 3060 Ti；驱动 610.74','Python':'3.12.14','安装文件随包':False,'受测模型成果随包':False,'凭据与会话记录随包':False,'评分校准完成':False,'原生界面鼠标点击验证':False,'已观察环境限制':'Godot 在本机受限账户下报告无法读取系统根证书库；本题离线 glTF 加载/动画/图形捕获仍成功。需要联网功能时须单独排查。'})
    print('公共输入、内嵌像素、负例统计与搬迁副本已准备。')

if __name__=='__main__':main()
