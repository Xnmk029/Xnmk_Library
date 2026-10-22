from pathlib import Path
import json,re,html
from urllib.parse import unquote
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Image as RLImage,Table,TableStyle,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from PIL import Image
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]; COMP=ROOT/'compare'
OUT=ROOT.parent/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('CN','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('CNBold','C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
styles={
 'title':ParagraphStyle('title',fontName='CNBold',fontSize=27,leading=38,textColor=colors.HexColor('#172b40'),spaceAfter=18),
 'head':ParagraphStyle('head',fontName='CNBold',fontSize=17,leading=25,spaceAfter=12,textColor=colors.HexColor('#172b40')),
 'sub':ParagraphStyle('sub',fontName='CNBold',fontSize=10,leading=15,spaceBefore=6,spaceAfter=4),
 'body':ParagraphStyle('body',fontName='CN',fontSize=9,leading=13,wordWrap='CJK',spaceAfter=4),
 'small':ParagraphStyle('small',fontName='CN',fontSize=7,leading=11,wordWrap='CJK',textColor=colors.HexColor('#5d6671'),spaceAfter=4),
}
story=[]
def p(s,style='body'):
 story.append(Paragraph(html.escape(str(s)).replace('\n','<br/>'),styles[style]))
def path_for(u):return (COMP/unquote(u.split('?')[0])).resolve()
def image_block(path,label):
 with Image.open(path) as im:w,h=im.size
 scale=min(470/w,125/h)
 return KeepTogether([RLImage(str(path),width=w*scale,height=h*scale),Paragraph(html.escape(label),styles['small']),Spacer(1,6)])
def prompt_lines(text):
 for line in text.splitlines():
  if not line.strip():continue
  if line.startswith('#'):p(line.lstrip('# ').replace('**',''),'sub')
  else:p(line)

data=json.loads((COMP/'catalog.js').read_text(encoding='utf8').split(' = ',1)[1].strip().removesuffix(';'))
tasks=data['tasks']
blocked={
 'GithubOutageCover':'待补齐：独立 GitHub 图标参考（图片1）。已有封面结果不能代替输入图标。',
 'SwissModelSpec':'待补齐：指定模型 ID、公司 logo、各项参数值及单位。不得把现有结果中的虚构名称和数值当作输入。',
 'InteriorDesignRender-legacy':'待补齐：原始线稿图1与色调/氛围图2。当前库存仅有结果图片。',
 'BlackGoldGrade':'待补齐：原始建筑照片。历史结果不能作为原图替代。',
 'HumanAnimalPoseEdit':'待补齐：公园人物与犬原图，以及目标姿态。现有题面仅为历史要求摘要。',
 'ComicSixPanel':'完整历史脚本尚未恢复。下列文字为摘要；批量重跑前需要确认统一脚本。',
}
extras=[
 ('InteriorDesignRender-v2-pending','苏醒崖 · 连续场景渲染','历史任务 / 暂不派发','将同一场景运镜视频的 8 张连续截图分别渲染，原图锚定结构，文字锚定统一风格，不使用额外风格参考图。保持相机、地形、石桥、河道与建筑位置及跨帧材质/光照一致。此为历史需求摘要，完整 v2 提示词及 8 张截图尚未恢复。用户此前明确：没有派发时不要派发连续场景题。'),
 ('SpriteLoop-pending','循环精灵图','历史任务 / 待恢复','进行连续动图的精灵图绘制。此为历史需求摘要，完整提示词、角色定义、网格尺寸、帧数、动作和背景约定尚未恢复。补齐后输出精灵图及帧布局说明，用预览工具的裁切播放器验证动作循环、角色一致性和帧边界。'),
 ('ComicSixPanel-v1-pending','最后一班渡船 · 历史漫画 v1','历史题 / 不纳入默认批次','历史漫画题已被 F1 弯道交锋替代。完整旧脚本和资产尚未恢复，仅保留题目身份供追溯。不得凭标题重写后声称为原题。'),
]
blocked={}
extras=[]
p('图像生成任务库\nAgent 批量执行指南','title')
p('2026-10-07 · 工作区快照','sub')
p('18 个题组，覆盖写实生成、照片编辑、平面排版、漫画叙事，以及提示词与质量强度专题。全文提示词取工作区文档；参考资产已按用户补充更新。循环精灵图、连续场景和旧渡船漫画不纳入本次批量任务。')
p('执行总则','sub')
for s in ['逐题确认模型、质量、尺寸、数量及参考图输入顺序；未指定时不要继承其他题目的 high / 4K 档位。','逐字使用“提示词原文”。如模型接口需要追加格式参数，记录在调用元数据中，不擅自改写题面。','待补齐任务跳过并记录原因；不要用模型输出冒充原图，不编造缺失脚本、logo 或模型参数。','每个模型/参数组合输出 1 张结果；连续帧任务独立确认后按帧输出。不要重发已成功任务或自动付费重试。','统一目录：F:/benchmark/暂存/agent-image-batch-YYYYMMDD/<task_id>/<model_id>-<quality>/。保存 result、meta.json、prompt.txt；记录请求模型、返回模型、参数、耗时、usage、request ID、输入/输出 SHA-256 与失败信息。密钥不得写入记录。','保留原始输出字节及尺寸。验收文本准确性、布局、编辑保真、结构/角色一致性；错误、遗漏或多余人物记录为结果缺陷，不擅自修图。','生成完成后按现有 compare/build_catalog.py 结构入库；保留题目版本及来源，以 HTTP 预览验证图片、提示词和参考链接。']:
 p('• '+s)
p('参考资产使用','sub')
p('PDF 中嵌入可用原图缩略图和所有已知角色参考图，便于辨认。Agent 调用必须读取下方绝对路径的原始文件，不能使用 PDF 缩略图作为生成输入。跨电脑执行需同时迁移这些资产目录。')
p('专题批次','sub')
p('Image 2.5 强度与入口专题包含三个独立提示词。若重跑原 API 矩阵：同一输入、提示词及尺寸下，sunburst max / low、flare max / low 各生成一次，共 12 张；flare auto 为另一个 3 张补充批次。内置和网页端记录是独立入口，不假定参数等价。')
story.append(PageBreak());p('测试部分与对比方式','head')
for title,text in [('写实生成与渲染','建筑真实化、室内设计渲染、旧金山手机街景。检查材质、光影、透视、结构保持及摄影真实感。'),('图片编辑与保真','人物清除、黑金调色、人犬姿态、双角色替换。检查目标修改是否完成，非目标区域是否保持，身份、姿态、眼神与遮挡是否可信。'),('平面设计与排版','国标图书、政务 PPT、构成主义海报、窗口故障海报、课本、GitHub 封面、瑞士模型参数图。检查文字、层级、布局及风格。'),('漫画叙事','F1 六格漫画。检查故事因果、攻防空间、跨格车辆一致性和自主分镜。'),('强度与提示词专题','夜港详细/开放提示词和 DeepSeek 海报。比较模型分支、质量设置及不同入口。')]:p(title,'sub');p(text)
p('四种测试关系','sub');p('原图与结果；同题不同模型；同模型不同设置；不同提示词或入口。历史库存的尺寸和参数不完全统一，主要用于效果审查。受控实验须固定输入、提示词、尺寸、数量及其他可控参数，仅改变目标变量。单次结果不代表稳定排名。')
p('预览工具','sub');p('划线遮罩：拖动分界查看局部；左右并排：比较构图和整体效果；A/B 闪切：观察结构位置差异。支持缩放、平移及圈画。Alt + ↑ 查看提示词，F2 查看题面，Alt + F 全屏；左侧边缘唤起题目侧栏，右键菜单切换两侧模型。')
story.append(PageBreak());p('题目索引','head')
for i,t in enumerate(tasks,1):
 source=any(f.get('source') for f in t['frames'])
 status=blocked.get(t['id'],'可执行：文生图' if not source else '可执行：已配原图')
 p(f'{i:02d}  {t["title"]}  |  {t["id"]}','body');p(status,'small')
for j,(tid,title,status,_) in enumerate(extras,len(tasks)+1):p(f'{j:02d}  {title}  |  {status}','sub')

for i,t in enumerate(tasks,1):
 story.append(PageBreak());p(f'{i:02d}  {t["title"]}','head')
 p(f'任务 ID：{t["id"]} | 版本：{t["version"]} | 分类：{t["kind"]}','small')
 p(blocked.get(t['id'],'输入检查：使用下列实际存在的参考原图；没有参考输入的题目按文生图执行。'),'sub')
 if t['id'].startswith('QualityStudy-'):p('专题提示词独立执行；保持固定设置以比较质量强度的影响。')
 if t['id']=='SwissModelSpec':p('模型 ID、公司 logo 与参数留空，由模型自主构思。输出视为虚构设计样例，不要求对应真实模型。')
 originals=[]
 for f in t['frames']:
  if f.get('source'):originals.append((path_for(f['source']['url']),f'帧 {f["number"]} 原图'))
 for r in t.get('references',[]):
  pp=path_for(r['url'])
  if all(x[0]!=pp for x in originals):originals.append((pp,r['label']))
 p('输入与参考资产','sub')
 if originals:
  for pp,label in originals:
   p(label+'：'+str(pp),'small');story.append(image_block(pp,label))
 else:p('本题当前无已收录参考原图。若上方标为待补齐，跳过生成；否则按文生图执行。')
 u=t['documents'].get('prompt');p('提示词原文','sub')
 if u:
  pp=path_for(u);p('来源：'+str(pp),'small');prompt_lines(pp.read_text(encoding='utf-8-sig'))
 else:p('缺失：未找到提示词文档，不可依据结果图片反推原始提示词。')
 p('交付与核验','sub')
 p('每个已授权模型配置输出 1 张；优先遵循原文中的画幅和文件格式。保存原始成片、完整提示词和调用元数据。参考图不变时记录同一输入哈希。')
 p('预览：http://127.0.0.1:8771/compare/#task='+t['id'],'small')
 if t['id'] in ['StandardBooks3D','GovTechPPT']:p('原文包含标准编号及宣传表述，作为用户提供的素材内容保留；本指南未对发布或评级事实作核验。','small')

for j,(tid,title,status,text) in enumerate(extras,len(tasks)+1):
 story.append(PageBreak());p(f'{j:02d}  {title}','head');p('任务 ID：'+tid,'small');p(status,'sub');p(text);p('此记录不包含完整可执行原始提示词，禁止默认派发。补齐输入和题面后再升级为可执行任务。')
def footer(c,doc):
 c.setStrokeColor(colors.HexColor('#d8dee4'));c.line(42,38,A4[0]-42,38);c.setFont('CN',7);c.setFillColor(colors.HexColor('#5d6671'));c.drawString(42,25,'图像任务库 · Agent 批量执行指南 · 2026-10-07');c.drawRightString(A4[0]-42,25,str(doc.page))
pdf=OUT/'image-agent-batch-guide-20261007.pdf'
SimpleDocTemplate(str(pdf),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=42,bottomMargin=50,title='图像生成任务库 - Agent 批量执行指南',author='Benchmark workspace').build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(pdf);text='\n'.join(p.extract_text() or '' for p in reader.pages)
assert all(t['id'] in text for t in tasks)
assert all(tid in text for tid,_,_,_ in extras)
print(json.dumps({'pdf':str(pdf),'pages':len(reader.pages),'task_records':len(tasks)+len(extras),'bytes':pdf.stat().st_size},ensure_ascii=False))
