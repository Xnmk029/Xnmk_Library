export function createTaskSidebar({tasks,current,choose,canOpen}) {
 const rail=document.createElement('button');rail.id='taskEdge';rail.textContent='题目';rail.setAttribute('aria-label','展开题目侧栏');rail.setAttribute('aria-controls','quickTasks');rail.setAttribute('aria-expanded','false');
 const sidebar=document.createElement('nav');sidebar.id='quickTasks';sidebar.setAttribute('aria-label','快速切换题目');sidebar.inert=true;sidebar.setAttribute('aria-hidden','true');
 sidebar.innerHTML='<div class="quick-head"><strong>题目索引</strong><button aria-label="收起题目侧栏" class="quick-close">×</button></div><input type="search" aria-label="侧栏搜索题目" placeholder="搜索题目"><div class="quick-list"></div><p class="quick-empty" hidden>没有匹配题目</p><small>靠近左边缘展开 · 移开收起</small>';
 document.body.append(rail,sidebar);
 let opened=false,closing=null;const search=sidebar.querySelector('input'),list=sidebar.querySelector('.quick-list');
 function close(){clearTimeout(closing);if(sidebar.contains(document.activeElement))document.activeElement.blur();opened=false;sidebar.classList.remove('open');sidebar.inert=true;sidebar.setAttribute('aria-hidden','true');rail.setAttribute('aria-expanded','false')}
 function open(focus=false){if(!canOpen())return;clearTimeout(closing);opened=true;sidebar.inert=false;sidebar.setAttribute('aria-hidden','false');sidebar.classList.add('open');rail.setAttribute('aria-expanded','true');if(focus)search.focus()}
 function deferClose(){clearTimeout(closing);closing=setTimeout(()=>{if(!sidebar.matches(':hover')&&!rail.matches(':hover')&&!sidebar.contains(document.activeElement))close()},320)}
 function render(){const query=search.value.trim().toLowerCase();list.replaceChildren();let count=0,lastTopic=null;tasks.forEach((task,index)=>{if(!(task.title+' '+task.id+' '+task.kind+' '+(task.topic||'')).toLowerCase().includes(query))return;if(task.topic&&task.topic!==lastTopic){const heading=document.createElement('div');heading.className='quick-topic';heading.textContent=task.topic;list.append(heading)}lastTopic=task.topic;count++;const b=document.createElement('button');b.className='quick-task';b.setAttribute('aria-current',current()===task.id?'true':'false');const n=document.createElement('span');n.className='quick-number';n.textContent=String(index+1).padStart(2,'0');const text=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');title.textContent=task.title;detail.textContent=task.kind+' · '+task.version+(task.frames.length>1?' · '+task.frames.length+' 帧':'');text.append(title,detail);b.append(n,text);b.onclick=()=>{choose(task);close();document.getElementById('stage').focus()};list.append(b)});sidebar.querySelector('.quick-empty').hidden=count!==0;}
 search.oninput=render;rail.onclick=()=>open(true);rail.onpointerenter=e=>{if(e.pointerType==='mouse'&&!e.buttons)open()};rail.onpointerleave=deferClose;
 sidebar.onpointerenter=()=>clearTimeout(closing);sidebar.onpointerleave=deferClose;sidebar.addEventListener('focusout',deferClose);sidebar.querySelector('.quick-close').onclick=close;
 document.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!e.buttons&&e.clientX<=14)open()});
 document.addEventListener('pointerdown',e=>{if(opened&&!sidebar.contains(e.target)&&e.target!==rail)close()},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();e.stopImmediatePropagation();close();document.getElementById('stage').focus()}},true);
 render();return {render,close};
}

