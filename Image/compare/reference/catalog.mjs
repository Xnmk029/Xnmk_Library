export const FPS=30;
// state: 'signal' = 深蓝信号场（片头/章节/收束）；'light' = 亮色编辑场（信息与证据段）
export const SCENES=[
  {id:'opening',title:'开场显影',state:'signal',duration:7,category:'开场',description:'像素窄缝按单一方向拓开成波面窗口，中文标题经阶梯前沿显影。',beats:[[0,'信号窄缝'],[0.6,'标题显影'],[2.8,'标题阅读']],content:{title:['让变化','成为语言'],subtitle:'个人频道 · 动效语言实验'}},
  {id:'chapter',title:'章节换幕',state:'signal',duration:5,category:'衔接',description:'纹理环场迁移、收出孔洞，带出章节信息，建立新的观看节奏。',beats:[[0,'环场迁移'],[1.4,'章节显现'],[2.2,'章节阅读']],content:{index:'第二章',title:'进入细节',subtitle:'从整体印象，到具体观察'}},
  {id:'transition',title:'条带转场',state:'signal',duration:5,category:'衔接',description:'错时推进的硬边条带遮住深蓝场，再从同一方向露出亮色编辑场。',beats:[[0,'信号场'],[1.3,'条带接力'],[2.9,'编辑场']],content:{before:'形态 A',after:'形态 B'}},
  {id:'media',title:'内容开窗',state:'light',duration:7,category:'内容',description:'像素边界单方向拓开，让示例画面接管主体，包装退到画面边缘。',beats:[[0,'拓开边界'],[.7,'内容接管'],[2.2,'完整观看']],content:{title:'把画面交给内容',label:'演示素材 · 几何构造'}},
  {id:'lowerthird',title:'身份名条',state:'light',duration:6,category:'信息',description:'墨色名条干脆展开；阅读结束后，按反向顺序撤离。',beats:[[0,'观看内容'],[.7,'名条展开'],[2,'身份阅读'],[4.7,'名条撤离']],content:{name:'你的频道',role:'主讲 / 创作与测试'}},
  {id:'captions',title:'字幕强调',state:'light',duration:7,category:'信息',description:'字幕保持墨底稳定，只在关键词下方进行一次强调，再切换下一句。',beats:[[0,'第一句'],[1.3,'关键词强调'],[3.7,'第二句']],content:{lines:['让动效带路，让信息落地。','关键判断，留出足够的阅读时间。']}},
  {id:'callout',title:'局部标注',state:'light',duration:7,category:'信息',description:'钴蓝角标锁定一个细节，折线路径连接真实裁切的放大视图。',beats:[[0,'观察整体'],[1,'定位细节'],[2.4,'放大阅读']],content:{title:'把注意力放在这里',label:'局部观察',note:'同一画面的局部放大'}},
  {id:'metric',title:'数字揭示',state:'light',duration:6,category:'数据',description:'一百个格点依次聚合，等宽计数与完成率同步到达目标值。',beats:[[0,'矩阵聚合'],[.6,'数值增长'],[2.5,'数据定格']],content:{value:78,label:'任务完成率',disclaimer:'示例数据'}},
  {id:'chart',title:'数据比较',state:'light',duration:8,category:'数据',description:'同尺度的条形逐行展开；纹理只保留在生长端，终态保持稳定。',beats:[[0,'建立尺度'],[.7,'条形展开'],[3.2,'对比阅读']],content:{title:'让差异自己显现',labels:['方案 A','方案 B','方案 C'],values:[72,86,64],unit:'完成率 / %',disclaimer:'示例数据'}},
  {id:'compare',title:'双画面对照',state:'light',duration:8,category:'内容',description:'两个示意版本共享视角，墨色分界轴移动以显露变化，最终回到等分。',beats:[[0,'同视角'],[1.4,'分界观察'],[4.5,'等分阅读']],content:{title:'同一画面，观察变化',labels:['初始','调整'],disclaimer:'示意对照 · 非评测结果'}},
  {id:'process',title:'流程演进',state:'light',duration:7,category:'信息',description:'一股纹理沿阶梯路径流动，依次激活节点，形成有方向的思考过程。',beats:[[0,'建立路径'],[.8,'逐项激活'],[4.2,'全程回看']],content:{title:'一条看得见的思考路径',steps:['提出问题','建立实验','观察差异','形成判断']}},
  {id:'takeaway',title:'结论收束',state:'light',duration:6,category:'收束',description:'装饰退至角标，结论在中央显影，留出完整的阅读停顿。',beats:[[0,'收拢纹理'],[1.1,'结论显影'],[2.5,'结论阅读']],content:{lines:['先让人看见，','再让人理解。'],subtitle:'视觉张力与阅读节奏，在同一套语言里切换。'}},
  {id:'outro',title:'片尾落款',state:'signal',duration:6,category:'收束',description:'分散的像素单元回到一个临时观察符号，完成落款和结束节奏。',beats:[[0,'像素归位'],[1.8,'符号聚合'],[2.6,'结束阅读']],content:{title:'继续观察',subtitle:'下一次，一起看见更多。'}},
];
let cursor=0;
for(const scene of SCENES){scene.start=cursor;scene.frames=Math.round(scene.duration*FPS);cursor+=scene.duration;}
export const DURATION=cursor;
export function locate(seconds){let i=SCENES.findIndex(s=>seconds<s.start+s.duration);if(i<0)i=SCENES.length-1;return {index:i,scene:SCENES[i],local:Math.max(0,Math.min(SCENES[i].duration,seconds-SCENES[i].start))};}
export function beatAt(scene,t){return [...scene.beats].reverse().find(b=>t>=b[0])?.[1]||scene.beats[0][1];}
