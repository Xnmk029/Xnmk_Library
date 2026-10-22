import {createTaskDocs} from './task-docs.js';
import {createSpriteReview} from './sprite-review.js';
import {createTaskSidebar} from './task-sidebar.js';
import {createMarkup} from './markup.js';
import {makeKit} from './reference/lib/primitives.mjs';
import {SCENES} from './reference/catalog.mjs';
import {dividerAt,materialAt} from './motion.mjs';
'use strict';
const $=id=>document.getElementById(id),catalog=window.IMAGE_CATALOG,tasks=catalog.tasks;
const palettes={iris:['#17152f','#554598','#9a8ed2','#e6edb4'],mineral:['#101c39','#255868','#6c9e8b','#e1e9b0'],ember:['#22182f','#65334f','#c96b4c','#f1ce8c']};
let task=tasks.find(t=>t.id==='RemoveAllPeople')||tasks[0],fi=0,ids=[],mode='wipe',split=.5,zoom=1,pan={x:0,y:0},auto=false,blinkB=false,pair=[],images=[],generation=0,uploads={},initial=null;
const canvas=$('canvas'),cache=new Map();
let kit=makeKit(canvas),ctx=kit.ctx;
let taskSidebar=null,sprite=null,taskDocs=null;
function displayImages(){return sprite?.active?sprite.images:images}
let labelsVisible=false,textureVisible=true,markup=null;
const panel=document.createElement('dialog');panel.id='controlPanel';panel.setAttribute('aria-label','对比控制台');panel.innerHTML='<div class=panelhead><strong>对比控制台</strong><button id=closePanel>关闭 · Esc</button></div><div id=shortcutHelp></div><div id=heatAnalysis hidden></div>';document.body.append(panel);
const header=document.querySelector('header');panel.append(header);for(const child of [...$('review').children])if(child.id!=='stage')panel.append(child);document.querySelector('footer').hidden=true;document.body.classList.add('immersive');
const live=document.createElement('div');live.className='sr';live.setAttribute('role','status');live.id='comparisonStatus';document.body.append(live);
const hint=document.createElement('button');hint.id='keyHint';hint.textContent='Tab / ? · 控制与快捷键';hint.onclick=()=>openPanel();document.body.append(hint);setTimeout(()=>hint.classList.add('faded'),5000);
function openPanel(target){if(!panel.open)panel.showModal();if(target==='tasks')document.querySelector('.taskdrawer').open=true;const node=target==='sprite'?$('spriteReview'):target==='tasks'?$('search'):target==='models'?$('left'):target==='info'?$('provenance'):null;if(node){node.closest('details')?.setAttribute('open','');node.scrollIntoView({block:'center'});if(node.focus)node.focus();}}
function closePanel(){panel.close();$('stage').focus()}
$('closePanel').onclick=closePanel;panel.addEventListener('click',e=>{if(e.target===panel)closePanel()});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let sceneTime=reduced?8:0,motionPlaying=!reduced,manualSplit=false,lastFrame=0;
const sceneStart=SCENES.find(s=>s.id==='compare').start;
function replay(){sceneTime=0;manualSplit=false;motionPlaying=true;auto=false;draw()}
function stopSweep(){manualSplit=true;auto=false;}

const watermarks=document.createElement('div');watermarks.id='modelWatermarks';watermarks.innerHTML='<div id="watermarkA"></div><div id="watermarkB"></div>';$('stage').append(watermarks);
const modelMenu=document.createElement('div');modelMenu.id='modelMenu';modelMenu.hidden=true;modelMenu.setAttribute('role','dialog');modelMenu.setAttribute('aria-label','快速切换对比模型');modelMenu.innerHTML='<div class="contextTitle">切换对比模型 <button id="closeModelMenu" aria-label="关闭模型菜单">×</button></div><label>A · 左侧<select id="contextA" aria-label="右键菜单左侧模型"></select></label><label>B · 右侧<select id="contextB" aria-label="右键菜单右侧模型"></select></label><button id="contextSwap">交换 A / B</button>';document.body.append(modelMenu);
function closeModelMenu(){modelMenu.hidden=true;}
function showModelMenu(e){e.preventDefault();const list=options();['contextA','contextB'].forEach((id,i)=>{const select=$(id);select.replaceChildren();for(const a of list){const option=new Option(a.label+(a.missing?' · 当前帧缺失':''),a.id);option.disabled=!!a.missing;select.add(option)}if(uploads[i])select.add(new Option(uploads[i].label,'upload'+i));select.value=uploads[i]?'upload'+i:ids[i]});modelMenu.hidden=false;const bounds=modelMenu.getBoundingClientRect();modelMenu.style.left=Math.max(8,Math.min(e.clientX,innerWidth-bounds.width-8))+'px';modelMenu.style.top=Math.max(8,Math.min(e.clientY,innerHeight-bounds.height-8))+'px';const b=$('stage').getBoundingClientRect();$(e.clientX<b.left+b.width*(mode==='wipe'?split:.5)?'contextA':'contextB').focus();}
$('stage').addEventListener('contextmenu',showModelMenu);
$('closeModelMenu').onclick=closeModelMenu;$('contextSwap').onclick=()=>{$('swap').click();closeModelMenu()};
['contextA','contextB'].forEach((id,i)=>$(id).onchange=()=>{const value=$(id).value;if(value==='upload'+i)return;ids[i]=value;delete uploads[i];closeModelMenu();renderControls();loadPair();$('stage').focus()});
document.addEventListener('pointerdown',e=>{if(!modelMenu.hidden&&!modelMenu.contains(e.target))closeModelMenu()},true);
modelMenu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeModelMenu();$('stage').focus()}else if(e.key==='Tab'){const all=[...modelMenu.querySelectorAll('button,select')];const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
function variants(){return task.frames[fi].variants}
function options(){const list=[];if(task.frames.some(f=>f.source))list.push({id:'source',label:'原始参考图',...task.frames[fi].source,missing:!task.frames[fi].source});const map=new Map();for(const f of task.frames)for(const a of f.variants)map.set(a.id,a);for(const a of map.values()){const current=variants().find(x=>x.id===a.id);list.push(current||{...a,url:null,missing:true})}return list}
function best(list){return list.find(a=>a.id.includes('sunburst'))||list.find(a=>a.id.includes('builtin'))||list[list.length-1]}
function defaults(){const list=options(),source=list.find(a=>a.id==='source'),b=best(list.filter(a=>a.id!=='source'));const a=source||list.find(a=>a.id.includes('flare'))||list.find(a=>a.id!==b?.id)||b;ids=[a?.id,b?.id]}
function taskButtons(){const q=$('search').value.toLowerCase();$('tasks').replaceChildren();tasks.forEach((t,i)=>{if(!(t.title+t.id+(t.topic||'')).toLowerCase().includes(q))return;const b=document.createElement('button'),n=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');b.append(n,document.createTextNode(t.title));b.classList.toggle('active',t.id===task.id);b.onclick=()=>choose(t);$('tasks').append(b)});$('count').textContent=String(tasks.length).padStart(2,'0')}
function choose(t){document.querySelector('.taskdrawer').open=false;task=t;fi=0;uploads={};defaults();resetView();renderControls();loadPair()}
function resetView(){manualSplit=true;zoom=1;pan={x:0,y:0};split=.5;auto=false;$('auto').textContent='重播分界运动';$('zoom').value=1;$('zoomLabel').value='1.0×'}
function renderControls(){taskButtons();taskSidebar?.render();$('title').textContent=task.title;$('currentTask').textContent=task.title;$('kind').textContent=task.kind+' / '+task.id+' / v'+task.version;$('frames').replaceChildren();if(task.frames.length>1)task.frames.forEach((f,i)=>{const b=document.createElement('button');b.textContent=String(f.number).padStart(2,'0');b.classList.toggle('active',i===fi);b.title='场景帧 '+f.number;b.onclick=()=>{fi=i;uploads={};renderControls();loadPair()};$('frames').append(b)});
 const list=options();['left','right'].forEach((id,i)=>{const s=$(id);s.replaceChildren();list.forEach(a=>{const o=new Option(a.label+(a.missing?' · 当前帧缺失':''),a.id);s.add(o)});if(uploads[i])s.add(new Option(uploads[i].label,'upload'+i));s.value=uploads[i]?'upload'+i:ids[i]});$('original').disabled=!list.some(a=>a.id==='source');
 $('variants').replaceChildren();list.forEach(a=>{const b=document.createElement('button');b.classList.toggle('active',!uploads[1]&&a.id===ids[1]);b.title=a.run||a.label;if(a.url){const im=new Image();im.src=a.url;im.loading='lazy';im.alt=a.label;b.append(im)}const text=document.createElement('span');text.textContent=a.label+(a.missing?' · 本帧无输出':'');b.append(text);b.onclick=()=>{ids[1]=a.id;delete uploads[1];renderControls();loadPair()};$('variants').append(b)});$('available').textContent=variants().length+' 个可用结果'+(task.frames[fi].source?' + 原图':' · 文生图，无原图')}
async function getImage(a){if(!a?.url)return null;if(cache.has(a.url))return cache.get(a.url);const promise=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('图片无法载入'));im.src=a.url});cache.set(a.url,promise);try{return await promise}catch(e){cache.delete(a.url);throw e}}
async function loadPair(){const token=++generation;pair=ids.map((id,i)=>uploads[i]||options().find(a=>a.id===id));images=[];sprite?.setSources(task.id,[],pair);$('loading').hidden=false;$('loading').textContent='正在载入图片…';const result=await Promise.allSettled(pair.map(getImage));if(token!==generation)return;images=result.map(r=>r.status==='fulfilled'?r.value:null);sprite?.setSources(task.id,images,pair);$('loading').hidden=true;pair.forEach((a,i)=>{const letter=i?'B':'A';$('label'+letter).textContent=a?.label||'无图片';$('info'+letter).textContent=a?.missing?'当前帧未生成，不以其他帧代替':a?.url?`${a.width||images[i]?.width} × ${a.height||images[i]?.height}${a.seconds!=null?' · '+Number(a.seconds).toFixed(1)+' 秒':''} · `+(a.run||'原始输入'):'没有可用图片';const link=$('open'+letter);link.hidden=!a?.url;if(a?.url)link.href=a.url});
 const notes=[];if(result.some(r=>r.status==='rejected'))notes.push('部分图片载入失败，请检查文件是否仍在原位置。');if(pair.some(a=>a?.missing))notes.push('当前选择有缺帧，保留空位供审查。');if(pair[0]?.id===pair[1]?.id&&pair[0]?.url===pair[1]?.url)notes.push('左右为同一张图片。');if(images.every(Boolean)&&Math.abs(images[0].width/images[0].height-images[1].width/images[1].height)>.002)notes.push('宽高比不同：完整等比显示，未拉伸、裁切或自动配准。');if(pair.every(a=>a?.promptHash)&&pair[0].promptHash!==pair[1].promptHash)notes.push('实际提示词记录不同，请结合调用记录比较。');if(task.kind==='历史题')notes.push('历史 v1 独立展示，不与 F1 v2 混比。');$('notice').textContent=notes.join(' ')||'完整显示原始图片 · 同步缩放与平移 · 不改变图片颜色';$('provenance').replaceChildren();pair.forEach((a,i)=>{const p=document.createElement('p');p.textContent=(i?'B':'A')+'：'+(a?.run||'原始参考图')+' ';if(a?.meta){const link=document.createElement('a');link.href=a.meta;link.target='_blank';link.rel='noopener';link.textContent='查看调用记录 ↗';p.append(link)}$('provenance').append(p)});$('comparisonStatus').textContent=task.title+'，A：'+(pair[0]?.label||'无图片')+'，B：'+(pair[1]?.label||'无图片')+'。'+notes.join(' ');saveHash();sceneTime=motionPlaying?0:8;manualSplit=false;draw()}
function saveHash(){const p=new URLSearchParams({task:task.id,frame:fi+1,a:ids[0]||'',b:ids[1]||'',mode});try{history.replaceState(null,'','#'+p)}catch{}}
function background(x,y,w,h){ctx.fillStyle=kit.C.bg;ctx.fillRect(x,y,w,h);if(textureVisible){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.globalAlpha=.085;ctx.scale(1,canvas.height/1080);kit.pat(0,0,1920,1080,'strata');ctx.restore()}}
function paint(i,x,y,w,h){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();background(x,y,w,h);const im=displayImages()[i];if(im){const scale=Math.min(w/im.width,h/im.height)*zoom;const dw=im.width*scale,dh=im.height*scale;if(sprite?.active){ctx.fillStyle=({white:'#fff',dark:'#17152f',pink:'#edafd0'})[sprite.background]||'#c5c5c5';ctx.fillRect(x+(w-dw)/2+pan.x*w,y+(h-dh)/2+pan.y*h,dw,dh);if(sprite.background==='checker'){ctx.save();ctx.translate(x+(w-dw)/2+pan.x*w,y+(h-dh)/2+pan.y*h);ctx.fillStyle='#999';for(let yy=0;yy<dh;yy+=24)for(let xx=0;xx<dw;xx+=24)if((Math.floor(xx/24)+Math.floor(yy/24))%2)ctx.fillRect(xx,yy,Math.min(24,dw-xx),Math.min(24,dh-yy));ctx.restore()}}ctx.imageSmoothingEnabled=!sprite?.active;ctx.imageSmoothingQuality='high';ctx.drawImage(im,x+(w-dw)/2+pan.x*w,y+(h-dh)/2+pan.y*h,dw,dh)}else{ctx.fillStyle='#ada8c5';ctx.font='28px Microsoft YaHei';ctx.textAlign='center';ctx.fillText(pair[i]?.missing?'此帧没有输出':'图片不可用',x+w/2,y+h/2)}ctx.restore()}
function shortLabel(a){if(!a)return '无图片';if(a.id==='source')return '原始参考图';if(a.label.includes('内置'))return '内置 Image Gen';const m=a.label.match(/(flare|sunburst)/i);if(m)return m[1][0].toUpperCase()+m[1].slice(1)+' / '+(a.label.match(/low|max|high|medium/i)?.[0]||'');return a.label.length>28?a.label.slice(0,26)+'…':a.label}
function draw(){
 const box=$('stage').getBoundingClientRect();const height=Math.round(1920*box.height/Math.max(1,box.width));if(canvas.height!==height)canvas.height=height;kit.begin(sceneStart+materialAt(sceneTime));kit.rect(0,0,1920,canvas.height,kit.C.bg);
 
 
 const x=0,y=0,w=1920,h=canvas.height;
 if(!manualSplit&&mode==='wipe')split=dividerAt(sceneTime)/1920;
 if(mode==='side'){paint(0,x,y,w/2-10,h);paint(1,w/2+10,y,w/2-10,h)}
 else if(mode==='blink')paint(blinkB?1:0,x,y,w,h);
 else{paint(0,x,y,w,h);const d=x+w*split;ctx.save();ctx.beginPath();ctx.rect(d,y,x+w-d,h);ctx.clip();paint(1,x,y,w,h);ctx.restore();
 ctx.imageSmoothingEnabled=false;kit.rect(d-10,y,20,h,kit.C.bg);ctx.save();ctx.scale(1,h/1080);kit.pat(d-6,0,12,1080,'strata');ctx.restore();kit.cut(d-44,h/2-44,88,88,kit.C.bg,20);kit.rect(d-16,h/2-20,8,36,kit.C.paper);kit.rect(d+8,h/2-20,8,36,kit.C.paper);
 }
 watermarks.hidden=!(mode==='wipe'||mode==='side'||labelsVisible);$('watermarkA').textContent='A · '+(pair[0]?.label||'无图片')+(pair[0]?.missing?' · 当前帧缺失':'');$('watermarkB').textContent='B · '+(pair[1]?.label||'无图片')+(pair[1]?.missing?' · 当前帧缺失':'');
 if(sceneTime<.32){ctx.save();ctx.scale(1,h/1080);kit.shutter(1-sceneTime/.32,'tide',true);ctx.restore();}
 $('divider').hidden=mode!=='wipe';$('divider').style.left=((x+w*split)/1920*100)+'%';$('divider').setAttribute('aria-valuenow',Math.round(split*100));
 $('blinkLabel').style.display=mode==='blink'?'block':'none';$('blinkLabel').textContent=blinkB?'B':'A';
 $('motionTime').value=Math.min(8,sceneTime);$('motionClock').textContent=Math.min(8,sceneTime).toFixed(2)+' / 8.00';
 $('motionPhase').textContent=manualSplit?'手动观察':sceneTime<.32?'条带揭幕':sceneTime<1.15?'建立同视角':sceneTime<4.5?'分界往返':'等分阅读';
 $('motion').textContent=motionPlaying?'暂停动效':'继续动效';markup?.render();
}
function setMode(m){mode=m;auto=false;$('auto').textContent='重播分界运动';$('auto').disabled=m!=='wipe';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));$('help').textContent=m==='blink'?'每 0.8 秒切换 A/B · 空格暂停 / 恢复':m==='side'?'滚轮缩放 · 拖动画面同步平移':'拖动分界线 · 滚轮缩放 · 拖动画面平移';saveHash();draw()}
let lastBlink=0;
function tick(t){if(!lastFrame)lastFrame=t;const dt=Math.min((t-lastFrame)/1000,.1);if(t-lastFrame>=1000/30){lastFrame=t;if(!document.hidden){sprite?.tick(dt);if(motionPlaying)sceneTime+=dt;if(mode==='blink'&&motionPlaying&&t-lastBlink>800){blinkB=!blinkB;lastBlink=t;}if(motionPlaying)draw()}}requestAnimationFrame(tick)}
$('replay').onclick=replay;$('motion').onclick=()=>{motionPlaying=!motionPlaying;draw()};
$('motionTime').oninput=()=>{sceneTime=Number($('motionTime').value);motionPlaying=false;manualSplit=false;draw()};
function changeZoom(value){zoom=Math.max(1,Math.min(6,value));if(zoom===1)pan={x:0,y:0};$('zoom').value=zoom;$('zoomLabel').value=zoom.toFixed(1)+'×';draw()}
let drag=null;$('divider').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();$('divider').focus();stopSweep();$('auto').textContent='重播分界运动';drag={type:'divider'};$('divider').setPointerCapture(e.pointerId)};$('divider').onpointermove=e=>{if(drag?.type!=='divider')return;const b=$('stage').getBoundingClientRect();split=Math.max(0,Math.min(1,(e.clientX-b.left)/b.width));draw()};$('divider').onpointerup=()=>drag=null;$('divider').onpointercancel=()=>drag=null;$('divider').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stopSweep();split=Math.max(0,Math.min(1,split+(e.key==='ArrowRight'?.02:-.02)));draw()}};
$('stage').onpointerdown=e=>{if(e.button!==0)return;if(e.target.closest('#divider'))return;const box=$('stage').getBoundingClientRect(),x=(e.clientX-box.left)/box.width,y=(e.clientY-box.top)/box.height;drag={type:'pan',x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};$('stage').setPointerCapture(e.pointerId)};$('stage').onpointermove=e=>{if(drag?.type!=='pan')return;const b=$('stage').getBoundingClientRect();pan.x=Math.max(-3,Math.min(3,drag.px+(e.clientX-drag.x)/(b.width/(mode==='side'?2:1))));pan.y=Math.max(-3,Math.min(3,drag.py+(e.clientY-drag.y)/(b.height)));draw()};$('stage').onpointerup=()=>drag=null;$('stage').onpointercancel=()=>drag=null;$('stage').addEventListener('wheel',e=>{const b=$('stage').getBoundingClientRect(),y=(e.clientY-b.top)/b.height,x=(e.clientX-b.left)/b.width;e.preventDefault();changeZoom(zoom*Math.exp(-e.deltaY*.001))},{passive:false});$('stage').ondblclick=()=>{resetView();draw()};
['left','right'].forEach((id,i)=>$(id).onchange=()=>{ids[i]=$(id).value;delete uploads[i];renderControls();loadPair()});$('swap').onclick=()=>{ids.reverse();uploads={0:uploads[1],1:uploads[0]};renderControls();loadPair()};$('original').onclick=()=>{ids[0]='source';delete uploads[0];renderControls();loadPair()};$('zoom').oninput=()=>changeZoom(Number($('zoom').value));$('fit').onclick=()=>{resetView();draw()};$('auto').onclick=()=>{sceneTime=1.15;manualSplit=false;motionPlaying=true;draw()};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$('search').oninput=taskButtons;
$('palette').onchange=()=>{palettes[$('palette').value].forEach((c,i)=>document.documentElement.style.setProperty(['--bg','--mid','--soft','--paper'][i],c));kit=makeKit(canvas,$('palette').value);ctx=kit.ctx;draw()};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{$('notice').textContent='浏览器不支持此处全屏，可使用浏览器全屏功能。'}};
$('share').onclick=async()=>{saveHash();if(Object.values(uploads).some(Boolean)){$('notice').textContent='临时导入图片无法包含在链接中；链接仅保存内置图片选择。'}try{await navigator.clipboard.writeText(location.href);$('share').textContent='链接已复制';setTimeout(()=>$('share').textContent='复制当前对比链接',1600)}catch{$('notice').textContent='可直接复制浏览器地址栏，当前选择已写入链接。'}};
['uploadA','uploadB'].forEach((id,i)=>$(id).onchange=async()=>{const f=$(id).files[0];if(!f)return;const token=task.id+':'+fi;const u=URL.createObjectURL(f);try{const im=await getImage({url:u});if(token!==task.id+':'+fi){URL.revokeObjectURL(u);return}uploads[i]={id:'upload'+i,label:f.name,url:u,width:im.width,height:im.height,run:'临时导入'};renderControls();loadPair()}catch{URL.revokeObjectURL(u);$('notice').textContent='导入失败：文件不是浏览器可解码的图片。'}});
const keyGroups=[['题目文档','F2 / Alt + ↑','题面 / 提示词（可复制全文）'],['精灵审查','W','打开切片审查面板'],['精灵审查','S / Space','图集与切片切换 / 同步播放'],['精灵审查',', / . / ↑ / ↓','逐帧 / 切换动作行'],['模型','右键','快速切换左右模型；分栏与遮罩常显 ID'],['圈画','D / E / G / N','画笔 / 椭圆 / 方框 / 箭头'],['圈画','Q / Z / Shift+Z','退出 / 撤销 / 重做'],['材质','Y','浅底纹显隐'],
 ['核心 · 高频','Tab / `','控制台显隐'],['核心 · 高频','1 / 2 / 3','划线 / 并排 / 闪切'],['核心 · 高频','A / B（Shift 反向）','循环左 / 右模型'],['核心 · 高频','← / →','分界线微调'],['核心 · 高频','+ / − / 0','放大 / 缩小 / 复位'],['核心 · 高频','Shift + 方向键','平移画面'],['核心 · 高频','X / O','交换两侧 / A 设原图'],
 ['导航 · 中频','J / K','上一题 / 下一题'],['导航 · 中频','[ / ]','上一帧 / 下一帧'],['导航 · 中频','T / M','题目搜索 / 模型选择'],['观察 · 中频','Space / R','暂停继续 / 重播动效'],['观察 · 中频','Alt + F / F','切换全屏'],['观察 · 中频','L','闪切标签显隐'],['观察 · 中频','I / C','调用记录 / 复制对比链接'],['辅助 · 低频','U / Shift+U','导入 A / B'],['辅助 · 低频','V / Shift+V','打开 A / B 原始文件'],['辅助 · 低频','P','循环界面配色'],['辅助 · 低频','? / H','快捷键 / 元素热图分析'],['辅助 · 低频','Esc','关闭面板；无面板时暂停']];
$('shortcutHelp').innerHTML='<h2>快捷键</h2><p>输入框、下拉选择和文件选择中保留原生按键。Tab 在面板内正常切换焦点。</p><div class=keygrid>'+keyGroups.map(([g,k,v])=>'<div><kbd>'+k+'</kbd><span>'+v+'</span></div>').join('')+'</div>';
function heatmap(){const heat=$('heatAnalysis');heat.hidden=!heat.hidden;panel.classList.toggle('heatmap',!heat.hidden);const groups=[['高 · 直接影响对比结果','.selectors,.toolbar,#variants', '模型选择、模式、缩放、交换与原图'],['中 · 导航与观察','.taskdrawer,.sectionhead,.transport,.captions,.foottools','题目、帧、动画、文件与分享'],['低 · 设置与记录','header,details:not(.taskdrawer),#shortcutHelp','配色、导入、元数据、说明']];for(const [rank,sel]of groups)panel.querySelectorAll(sel).forEach(n=>n.dataset.heat=rank);heat.innerHTML='<h2>元素重要性热图</h2><p>设计推演，非真实点击统计。按任务关联度、预期频率及操作影响分级；不会采集或上传行为数据。</p><p>画面对比区域与分界拖柄：最高优先级，默认保留。标签：按 L 呼出。加载与缺帧提示：仅需要时显示。</p>'+groups.map(([rank,sel,desc])=>'<p><b>'+rank+'</b>：'+desc+'</p>').join('')+'<p>品牌、标题、副标题、页脚与冗余装饰：最低优先级，沉浸视图隐藏。各组包含其中的全部按钮、选择器、文字、缩略图与链接。</p>';}
function cycleModel(side,delta){const list=options();if(!list.length)return;let n=list.findIndex(a=>a.id===ids[side]);ids[side]=list[(n+delta+list.length)%list.length].id;delete uploads[side];renderControls();loadPair()}
function cycleFrame(delta){if(task.frames.length<2)return;fi=(fi+delta+task.frames.length)%task.frames.length;uploads={};renderControls();loadPair()}
// Capture explicit Alt shortcuts so they also work inside dialogs.
document.addEventListener('keydown',e=>{
 if(!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
 const key=e.key.toLowerCase();
 if(key!=='arrowup'&&key!=='f')return;
 e.preventDefault();e.stopImmediatePropagation();
 if(e.repeat)return;
 if(key==='f')$('fullscreen').click();
 else{closeModelMenu();taskDocs?.open('prompt')}
},true);
document.addEventListener('keydown',e=>{
 if(taskDocs?.isOpen)return;
 if(e.key==='F2'){e.preventDefault();closeModelMenu();taskDocs.open('statement');return;}
 if(!modelMenu.hidden||e.target.closest('#quickTasks'))return;
 if(e.key==='Escape'){if(panel.open){e.preventDefault();closePanel()}else{sprite?.pause();motionPlaying=false;draw()}return;}
 const editing=e.target.isContentEditable||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
 if(editing||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key==='Tab'){if(!panel.open){e.preventDefault();openPanel()}return;}
 const k=e.key.toLowerCase();if(panel.open&&!['`','?','h'].includes(k))return;if(sprite?.handleKey(e)){e.preventDefault();return;}
 if(markup?.handleKey(k,e.shiftKey)){e.preventDefault();return;}
 let handled=true;
 if(k==='`'){panel.open?closePanel():openPanel()}
 else if(k==='?'){openPanel();$('shortcutHelp').scrollIntoView()}
 else if(k==='h'){openPanel();heatmap();$('heatAnalysis').scrollIntoView()}
 else if(k==='w'&&task.id==='SpriteLoop')openPanel('sprite');else if(k==='t')openPanel('tasks');else if(k==='m')openPanel('models');else if(k==='i')openPanel('info');
 else if(['1','2','3'].includes(k))setMode({1:'wipe',2:'side',3:'blink'}[k]);
 else if(k==='a'||k==='b')cycleModel(k==='b'?1:0,e.shiftKey?-1:1);
 else if(k==='j'||k==='k')choose(tasks[(tasks.indexOf(task)+(k==='j'?-1:1)+tasks.length)%tasks.length]);
 else if(k==='['||k===']')cycleFrame(k==='['?-1:1);
 else if(k==='x')$('swap').click();else if(k==='o')$('original').click();
 else if(k==='+'||k==='=')changeZoom(zoom*1.2);else if(k==='-')changeZoom(zoom/1.2);else if(k==='0'){$('fit').click()}
 else if(k===' '){$('motion').click()}else if(k==='r')replay();else if(k==='f')$('fullscreen').click();
 else if(k==='l'){labelsVisible=!labelsVisible;draw()}
 else if(k==='y'){textureVisible=!textureVisible;draw()}
 else if(k==='p'){const el=$('palette');el.selectedIndex=(el.selectedIndex+1)%el.options.length;el.onchange()}
 else if(k==='c')$('share').click();else if(k==='u')$(e.shiftKey?'uploadB':'uploadA').click();else if(k==='v')$(e.shiftKey?'openB':'openA').click();
 else if(k.startsWith('arrow')){stopSweep();if(e.shiftKey){if(k==='arrowleft')pan.x-=.04;if(k==='arrowright')pan.x+=.04;if(k==='arrowup')pan.y-=.04;if(k==='arrowdown')pan.y+=.04;}else if(k==='arrowleft'||k==='arrowright')split=Math.max(0,Math.min(1,split+(k==='arrowright'?.02:-.02)));draw()}
 else handled=false;
 if(handled)e.preventDefault();
});
// Divider keyboard handling is centralized to avoid double increments.
$('divider').onkeydown=null;
markup=createMarkup({stage:$('stage'),getView:()=>({task:task.id,frame:sprite?.active?sprite.key:fi,mode,ids:pair.map(p=>p?.url||p?.id),images:displayImages(),zoom,pan,split,blinkB}),onChange:()=>{sprite?.pause();motionPlaying=false;sceneTime=Math.max(.32,sceneTime);manualSplit=true;draw()}});
taskDocs=createTaskDocs({getTask:()=>({task,frame:fi}),getPair:()=>pair,controls:panel,stage:$('stage')});
sprite=createSpriteReview({panel,onChange:draw});
taskSidebar=createTaskSidebar({tasks,current:()=>task.id,choose,canOpen:()=>!panel.open&&modelMenu.hidden&&!$('stage').classList.contains('marking')});
new ResizeObserver(draw).observe($('stage'));const initialHash=new URLSearchParams(location.hash.slice(1));if(initialHash.has('task'))task=tasks.find(t=>t.id===initialHash.get('task'))||task;fi=Math.max(0,Math.min(task.frames.length-1,(Number(initialHash.get('frame'))||1)-1));defaults();const list=options();['a','b'].forEach((k,i)=>{if(list.some(a=>a.id===initialHash.get(k)))ids[i]=initialHash.get(k)});renderControls();setMode(['wipe','side','blink'].includes(initialHash.get('mode'))?initialHash.get('mode'):'wipe');loadPair();requestAnimationFrame(tick);

