"""Import the user's eleven labeled results without altering image bytes."""
from pathlib import Path
from PIL import Image
import json, hashlib, shutil

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path('C:/Users/Administrator/Downloads')
TRIAL = ROOT / 'scores/edit-trials-20260909'
RUN = 'nanobanana-2.1-4k-high-import20261007'
new_prompts = {
    'GithubOutageCover': '帮我生成一期视频封面，需要使用图片1 Github图标，以：Github出现大规模崩溃  作为标题，整体风格使用平面、简洁，有封面吸引力',
    'SwissModelSpec': '帮我生成图片：使用瑞士国际主义设计风格为我生成一张平面设计图片：用于展示一个模型的具体参数，首先以大标题全大写展示模型的ID、公司logo，其余展示模型参数，大致需要展示：型号名 参数量 上下文窗口 输入价格 输出价格 缓存价格 TPS 使用渠道，',
    'CharacterReplacement': '将图片中任务进行替换，左侧彩发女性替换为图片2，右侧黄衣男性替换为图片3，注意保持原图氛围环境、人物眼神等等细节',
}
notes = {
    'GithubOutageCover': '用户新增题。GitHub 图标参考尚未单独提供；本次附件中的封面为生成结果，不作为图标原图。标题属于题目设定，不代表新闻事实核查。',
    'SwissModelSpec': '用户新增题。模型 ID、公司 logo 和参数值尚未指定。结果中的 OMNI-7B / SYNAPSE LABS 及数值为图片内容，不作为真实模型参数。',
    'CharacterReplacement': '用户已提供题面及现有生成结果；原场景、左角色参考图片2、右角色参考图片3待用户后续补充。当前附件编号不作为这三张参考图的对应关系。',
}
mapping = [
    ('1_27AM', ROOT/'CharacterReplacement', '双角色替换'),
    ('1_39AM', ROOT/'StandardBooks3D', '国标图书'),
    ('12_56AM', ROOT/'GithubOutageCover', 'GitHub 封面'),
    ('12_49AM', TRIAL/'HumanAnimalPoseEdit', '人与犬姿态重构'),
    ('1_10AM', ROOT/'GovTechPPT', '政务 PPT'),
    ('1_12AM', TRIAL/'BlackGoldGrade', '建筑黑金调色'),
    ('12_53AM', ROOT/'SwissModelSpec', '瑞士风格模型参数'),
    ('1_56AM', ROOT/'InteriorDesignRender', '室内设计历史双图题'),
    ('1_40AM', ROOT/'ArchPhotoreal', '建筑真实化'),
    ('12_51AM', ROOT/'ComicSixPanel', 'F1 弯道交锋'),
    ('1_07AM', ROOT/'ConstructivistPoster', 'DeepSeek 构成主义海报'),
]
records = []
for clock, task, title in mapping:
    src = DOWNLOADS / f'Generated Image October 07, 2026 - {clock}.jpg'
    dest = task/RUN
    dest.mkdir(parents=True, exist_ok=True)
    target = dest/'result.jpg'
    shutil.copy2(src, target)
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
    with Image.open(target) as im:
        width, height = im.size
        im.verify()
    m = {'model': 'Nano Banana 2.1 / 4K', 'quality': 'high',
         'declared_resolution': '4K', 'parameters_source': '用户声明',
         'source_file': str(src), 'imported_on': '2026-10-07',
         'sha256': digest, 'width': width, 'height': height,
         'task_assignment_source': '附件画面内容及现有题面',
         'prompt_known': False}
    if task.name == 'ComicSixPanel': m['task_version'] = '2.0'
    if task.name in new_prompts:
        prompt = new_prompts[task.name]
        (task/'PROJECT_PROMPT.md').write_text(prompt+'\n', encoding='utf8')
        (task/'README.md').write_text(notes[task.name]+'\n', encoding='utf8')
        m.update(prompt=prompt, prompt_known=True, prompt_source='用户提供题面',
                 prompt_sha256=hashlib.sha256(prompt.encode()).hexdigest())
    elif task.parent == TRIAL:
        prompt_path = task/'PROMPT.md'
        if not prompt_path.exists():
            prompt_path.write_text('将图片转换为黑金调色风格。' if task.name == 'BlackGoldGrade' else '修改图片中人物与动物的姿势。', encoding='utf8')
            (task/'README.md').write_text('历史编辑题，按用户历史要求恢复题面。原图尚待恢复。本轮导入结果的实际完整提示词未提供。', encoding='utf8')
    elif task.name == 'ComicSixPanel' and not (task/'PROJECT_PROMPT.md').exists():
        (task/'PROJECT_PROMPT.md').write_text('绘制一段 F1 赛车对车格斗场面，六格漫画，分镜分格由模型自主决定。此为历史要求摘要，完整原脚本尚未恢复。', encoding='utf8')
        (task/'README.md').write_text('F1 弯道交锋，现行 v2 题。当前结果按画面内容匹配；完整历史脚本尚未恢复。', encoding='utf8')
    (dest/'meta.json').write_text(json.dumps(m,ensure_ascii=False,indent=2), encoding='utf8')
    records.append({'task':task.name,'title':title,'source':str(src),'destination':str(target),'sha256':digest,'width':width,'height':height})
(ROOT/'scripts/import-nanobanana-20261007.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
print(f'Imported and decoded {len(records)} images; all SHA-256 copies match.')
