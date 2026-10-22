// Marks use image coordinates, so zoom and pan keep them attached to the picture.
export function createMarkup({stage,getView,onChange}) {
 const layer=document.createElement('canvas');layer.id='markup';stage.append(layer);
 const bar=document.createElement('div');bar.id='markupTools';bar.hidden=true;
 bar.innerHTML='<span>圈画</span><button data-tool="pen">画笔 D</button><button data-tool="ellipse">椭圆 E</button><button data-tool="rect">方框 G</button><button data-tool="arrow">箭头 N</button><label>颜色 <input id="inkColor" type="color" value="#e6edb4"></label><label>笔宽 <select id="inkWidth"><option value="3">细</option><option value="5" selected>中</option><option value="9">粗</option></select></label><button id="inkUndo">撤销 Z</button><button id="inkRedo">重做 ⇧Z</button><button id="inkClear">清空本组</button><button id="inkClose">退出 Q</button>';
 document.body.append(bar);
 const buckets=new Map();let tool=null,draft=null,color='#e6edb4',width=5,activePointer=null;
 const key=()=>{const v=getView();return JSON.stringify([v.task,v.frame,v.mode,v.ids])};
 function bucket(){const k=key();if(!buckets.has(k))buckets.set(k,{marks:[],undo:[],redo:[]});return buckets.get(k)}
 function geometry(side){const v=getView(),b=stage.getBoundingClientRect(),im=v.images[side];if(!im)return null;const pw=b.width/(v.mode==='side'?2:1),left=v.mode==='side'?side*pw:0,scale=Math.min(pw/im.width,b.height/im.height)*v.zoom;return {x:left+(pw-im.width*scale)/2+v.pan.x*pw,y:(b.height-im.height*scale)/2+v.pan.y*b.height,s:scale,left,pw,h:b.height};}
 function point(e,g){const b=stage.getBoundingClientRect();return [(Math.round((e.clientX-b.left)/3)*3-g.x)/g.s,(Math.round((e.clientY-b.top)/3)*3-g.y)/g.s]}
 function chooseSide(e){const v=getView(),b=stage.getBoundingClientRect(),x=(e.clientX-b.left)/b.width;return v.mode==='side'?(x<.5?0:1):v.mode==='blink'?(v.blinkB?1:0):(x<v.split?0:1)}
 function setTool(value){tool=value;layer.style.pointerEvents=tool?'auto':'none';bar.hidden=!tool;stage.classList.toggle('marking',!!tool);bar.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));if(tool)onChange();render()}
 function render(){const b=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(layer.width!==Math.round(b.width*dpr)||layer.height!==Math.round(b.height*dpr)){layer.width=Math.round(b.width*dpr);layer.height=Math.round(b.height*dpr)}const c=layer.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,b.width,b.height);
  const list=[...bucket().marks];if(draft&&draft.key===key())list.push(draft);
  for(const m of list){const g=geometry(m.side);if(!g)continue;c.save();if(getView().mode==='side'){c.beginPath();c.rect(g.left,0,g.pw,g.h);c.clip()}const pts=m.points.map(([x,y])=>[g.x+x*g.s,g.y+y*g.s]);const a=pts[0],z=pts.at(-1);c.beginPath();
   if(m.tool==='pen'){c.moveTo(...a);for(const p of pts)c.lineTo(...p);if(pts.length===1)c.lineTo(a[0]+1,a[1]);}
   else if(m.tool==='rect')c.rect(a[0],a[1],z[0]-a[0],z[1]-a[1]);
   else if(m.tool==='ellipse'){const cx=(a[0]+z[0])/2,cy=(a[1]+z[1])/2,rx=Math.abs(z[0]-a[0])/2,ry=Math.abs(z[1]-a[1])/2;for(let i=0;i<=96;i++){const t=i/96*Math.PI*2,x=Math.round((cx+rx*Math.cos(t))/3)*3,y=Math.round((cy+ry*Math.sin(t))/3)*3;i?c.lineTo(x,y):c.moveTo(x,y)}c.closePath();}
   else{c.moveTo(...a);c.lineTo(...z);const t=Math.atan2(z[1]-a[1],z[0]-a[0]),len=Math.min(22,Math.hypot(z[0]-a[0],z[1]-a[1])*.4);for(const d of [-.6,.6]){c.moveTo(...z);c.lineTo(z[0]-len*Math.cos(t+d),z[1]-len*Math.sin(t+d))}}
   c.lineJoin='miter';c.lineCap='square';c.lineWidth=m.width+3;c.strokeStyle='#17152f';c.stroke();c.lineWidth=m.width;c.strokeStyle=m.color;c.stroke();c.restore();
  }
  bar.querySelector('#inkUndo').disabled=!bucket().undo.length;bar.querySelector('#inkRedo').disabled=!bucket().redo.length;bar.querySelector('#inkClear').disabled=!bucket().marks.length;
 }
 layer.onpointerdown=e=>{if(!tool||e.button!==0)return;const side=chooseSide(e),g=geometry(side);if(!g)return;e.preventDefault();e.stopPropagation();activePointer=e.pointerId;layer.setPointerCapture(e.pointerId);draft={key:key(),tool,side,color,width,points:[point(e,g)]};render()};
 layer.onpointermove=e=>{if(!draft||e.pointerId!==activePointer)return;e.preventDefault();e.stopPropagation();const g=geometry(draft.side);if(!g)return;const p=point(e,g);if(draft.tool==='pen')draft.points.push(p);else draft.points[1]=p;render()};
 layer.onpointerup=e=>{e.stopPropagation();if(draft&&draft.key===key()){bucket().undo.push([...bucket().marks]);bucket().marks.push(draft);bucket().redo=[]}draft=null;activePointer=null;render()};layer.onpointercancel=()=>{draft=null;activePointer=null;render()};
 layer.addEventListener('wheel',e=>{e.preventDefault()},{passive:false});layer.ondblclick=e=>e.stopPropagation();
 const undo=()=>{const b=bucket();if(b.undo.length){b.redo.push([...b.marks]);b.marks=b.undo.pop()}render()},redo=()=>{const b=bucket();if(b.redo.length){b.undo.push([...b.marks]);b.marks=b.redo.pop()}render()};
 bar.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));bar.querySelector('#inkColor').oninput=e=>color=e.target.value;bar.querySelector('#inkWidth').onchange=e=>width=Number(e.target.value);
 bar.querySelector('#inkUndo').onclick=undo;bar.querySelector('#inkRedo').onclick=redo;bar.querySelector('#inkClear').onclick=()=>{const b=bucket();if(b.marks.length){b.undo.push([...b.marks]);b.marks=[];b.redo=[]}render()};
 bar.querySelector('#inkClose').onclick=()=>setTool(null);
 return {render,setTool,handleKey(k,shift){if({d:1,e:1,g:1,n:1}[k]){setTool({d:'pen',e:'ellipse',g:'rect',n:'arrow'}[k]);return true}if(k==='q'){setTool(null);return true}if(k==='z'){shift?redo():bar.querySelector('#inkUndo').onclick();return true}return false}};
}

