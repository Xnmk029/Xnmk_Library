import {makeRenderer,PALETTES,FIELDS,STATES,T} from './moire.mjs';
export {PALETTES,FIELDS,STATES,T};
export const W=1920,H=1080;
export const clamp=n=>Math.max(0,Math.min(1,n));
export const mix=(a,b,p)=>a+(b-a)*p;
export const snap=(v,g=12)=>Math.round(v/g)*g;
export const stepped=(p,steps=8)=>Math.floor(clamp(p)*steps)/steps;

// Motion tokens (design.md §9.1): settle 入场 / flow 相位过渡 / depart 离场 / stepped 断裂
export const cubic=(x1,y1,x2,y2)=>{
  const bx=t=>3*(1-t)**2*t*x1+3*(1-t)*t*t*x2+t*t*t;
  const by=t=>3*(1-t)**2*t*y1+3*(1-t)*t*t*y2+t*t*t;
  return p=>{const x=clamp(p);let lo=0,hi=1,t=x;for(let i=0;i<26;i++){const e=bx(t)-x;if(Math.abs(e)<1e-4)break;if(e>0)hi=t;else lo=t;t=(lo+hi)/2;}return clamp(by(t));};
};
export const settle=cubic(0.22,1,0.36,1);
export const flow=cubic(0.45,0,0.55,1);
export const depart=cubic(0.64,0,0.78,0);
export const ease=flow; // legacy alias: smooth in-out
export const out=settle; // legacy alias: fast in, soft landing

// Type stack (design.md §5): modern CJK sans, heavy titles; mono numerals for data.
const cjkFamily=w=>w>=800?'MiSans Heavy':w>=700?'MiSans Bold':w>=600?'MiSans Semibold':w>=500?'MiSans Medium':'MiSans';
const cjkWeight=w=>w>=800?800:w>=700?700:w>=600?600:w>=500?500:400;
const fontCJK=(size,w)=>`${cjkWeight(w)} ${size}px "${cjkFamily(w)}","Noto Sans SC","Microsoft YaHei",sans-serif`;
const fontMono=(size,w)=>`${w>=600?700:500} ${size}px "Fira Code","Cascadia Mono",Consolas,monospace`;

export function makeKit(canvas,palette='phase'){
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
  const legacy=PALETTES[palette]?.colors||null; // 存档色板：仅覆盖波面配色
  const S=legacy
    ?{signal:{bg:legacy[0],fg:legacy[3],sub:legacy[2],quiet:legacy[2],accent:legacy[3],field:'legacy',alt:'legacy'},
      light:{bg:legacy[3],fg:legacy[0],sub:legacy[1],quiet:legacy[1],accent:legacy[2],field:'legacy',alt:'legacy'}}
    :STATES;
  const fields=legacy?{legacy}:FIELDS;
  let C=S.signal,stateName='signal',materialTime=0;
  const patterns=new Map(),glyphs=new Map(),bounds=[];
  const media=document.createElement('canvas');media.width=W;media.height=H;
  const mc=media.getContext('2d',{alpha:false});
  function pattern(kind,field){
    const key=`${kind}|${field}`;let p=patterns.get(key);
    if(!p){const c=document.createElement('canvas');p={canvas:c,renderer:makeRenderer(c,{mode:kind,field:fields[field],pitch:4})};p.renderer.draw(materialTime);patterns.set(key,p);}
    return p;
  }

  function text(s,x,y,size=56,color=null,align='left',weight=500,mono=false){
    ctx.font=mono?fontMono(size,weight):fontCJK(size,weight);ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color||C.fg;
    if('letterSpacing' in ctx)ctx.letterSpacing='0px';
    const width=ctx.measureText(s).width;
    bounds.push({text:s,x:x-(align==='center'?width/2:align==='right'?width:0),y:y-size*.6,width,height:size*1.2});
    ctx.fillText(s,x,y);return width;
  }
  function measure(s,size,weight=800,mono=false){ctx.font=mono?fontMono(size,weight):fontCJK(size,weight);return ctx.measureText(s).width;}
  function title(s,x,y,size=110,color=null,align='left'){
    ctx.font=fontCJK(size,800);ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color||C.fg;
    if('letterSpacing' in ctx)ctx.letterSpacing=`${-Math.round(size*.02)}px`;
    const width=ctx.measureText(s).width;
    bounds.push({text:s,x:x-(align==='center'?width/2:align==='right'?width:0),y:y-size*.6,width,height:size*1.24});
    ctx.fillText(s,x,y);if('letterSpacing' in ctx)ctx.letterSpacing='0px';return width;
  }
  // 像素字仅用于短拉丁标签（PHASE 01 / SIGNAL / 02），中文不走像素化。
  function glyph(s,size,color,step=3){
    const key=[s,size,color,step].join('|');if(glyphs.has(key))return glyphs.get(key);
    const tmp=document.createElement('canvas');let tc=tmp.getContext('2d');
    const fs=Math.round(size/step);tc.font=fontMono(fs,700);
    tmp.width=Math.ceil(tc.measureText(s).width)+6;tmp.height=Math.ceil(fs*1.55);
    tc=tmp.getContext('2d');tc.font=fontMono(fs,700);tc.textBaseline='middle';tc.fillStyle='#fff';tc.fillText(s,3,tmp.height/2);
    const pixels=tc.getImageData(0,0,tmp.width,tmp.height),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=rgb[0];pixels.data[i+1]=rgb[1];pixels.data[i+2]=rgb[2];pixels.data[i+3]=pixels.data[i+3]>105?255:0;}
    tc.putImageData(pixels,0,0);
    const g={canvas:tmp,width:tmp.width*step,height:tmp.height*step};glyphs.set(key,g);return g;
  }
  function pixelTag(s,x,y,size=44,color=null,progress=1,align='center',step=3){
    if(progress<=0)return 0;
    const g=glyph(s,size,color||C.fg,step),left=x-(align==='center'?g.width/2:align==='right'?g.width:0),top=y-g.height/2;
    const w=Math.ceil(g.width*clamp(progress)/8)*8;
    ctx.save();ctx.beginPath();ctx.rect(left,top,w,g.height);ctx.clip();ctx.drawImage(g.canvas,left,top,g.width,g.height);ctx.restore();
    bounds.push({text:s,x:left,y:top,width:g.width,height:g.height});return g.width;
  }
  // M01 相位显影：文本沿单一方向被网格对齐的阶梯前沿"印刷"出来，
  // 文字随前沿同向位移 24–48px 并以 settle 收敛；前沿色带在落定后撤离。
  function reveal(s,x,y,size,p,{color=null,weight=800,align='left',fringe=null,mono=false,offset=36,dir=1,maxW=Infinity,tracking=-.02}={}){
    if(p<=0)return 0;
    const e=settle(p);
    if(mono){ctx.font=fontMono(size,weight);}else{ctx.font=fontCJK(size,weight);if('letterSpacing' in ctx)ctx.letterSpacing=`${Math.round(size*tracking)}px`;}
    let w=ctx.measureText(s).width;
    if(w>maxW){size=Math.max(20,Math.floor(size*maxW/w));if(mono)ctx.font=fontMono(size,weight);else ctx.font=fontCJK(size,weight);w=ctx.measureText(s).width;}
    const left=align==='center'?x-w/2:align==='right'?x-w:x,top=y-size*.62,hgt=size*1.24;
    const vis=snap(w*e,8);if(vis<=0){if('letterSpacing' in ctx)ctx.letterSpacing='0px';return w;}
    const dx=(1-e)*offset*dir;
    ctx.save();ctx.beginPath();
    const rows=Math.ceil(hgt/16);
    for(let r=0;r<rows;r++){
      const tooth=(1-e)*((r%3)*8);
      const wide=Math.min(w,vis+tooth);
      if(dir>0)ctx.rect(left,top+r*16,wide,Math.min(16,hgt-r*16));
      else ctx.rect(left+w-wide,top+r*16,wide,Math.min(16,hgt-r*16));
    }
    ctx.clip();ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=color||C.fg;
    ctx.fillText(s,left-dx,y);
    if(e<1){ctx.fillStyle=fringe||C.sub;const fx=dir>0?left+vis-4:left+w-vis-4;ctx.fillRect(fx,top,8,hgt);}
    ctx.restore();if('letterSpacing' in ctx)ctx.letterSpacing='0px';
    bounds.push({text:s,x:left,y:top,width:w,height:hgt});return w;
  }
  // 阶梯前沿路径：窗口"拓开"的统一几何。单方向扩展 + 行列错位齿边，
  // 齿差随进度归零，落定后是整齐窗口（design.md M01/M06）。
  function teethPath(x,y,w,h,p,{grid=12,dir=1,rowH=24}={}){
    const e=settle(p),wv=Math.max(p>0?grid*2:0,snap(w*e,grid));
    ctx.beginPath();
    if(wv<=0)return 0;
    const rows=Math.ceil(h/rowH);
    for(let r=0;r<rows;r++){
      const tooth=(1-e)*((r%4)*grid);
      const wide=Math.min(w,wv+tooth),rh=Math.min(rowH,h-r*rowH);
      if(dir>0)ctx.rect(x,y+r*rowH,wide,rh);else ctx.rect(x+w-wide,y+r*rowH,wide,rh);
    }
    return wv;
  }
  function pat(x=0,y=0,w=W,h=H,kind='tide',field=null){
    if(w<=0||h<=0)return;const p=pattern(kind,field||(C.field));
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(p.canvas,0,0,W,H);ctx.restore();
  }
  // 像素窗口拓开：窄缝按单一方向展开成波面窗口；texP<1 时内部先为色块，
  // 纹理随后按行"显影"（装饰纹理晚于标题约 80ms 由调用方控制）。
  function window(x,y,w,h,p,{field=null,kind='tide',slab=null,fringe=null,grid=12,dir=1,texP=1,rowH=24}={}){
    const wv=teethPath(x,y,w,h,p,{grid,dir,rowH});if(wv<=0)return 0;
    ctx.save();ctx.clip();
    if(texP<1){ctx.fillStyle=slab||C.sub;ctx.fillRect(x,y,w,h);
      if(texP>0){const rows=Math.ceil(h/rowH);ctx.beginPath();
        for(let r=0;r<rows;r++)if(r/rows<texP)ctx.rect(x,y+r*rowH,w,rowH);
        ctx.clip();pat(x,y,w,h,kind,field);}
    }else pat(x,y,w,h,kind,field);
    ctx.restore();
    if(p<1&&fringe!==false){const e=settle(p),fx=dir>0?x+wv-4:x+w-wv-4;rect(fx,y,8,h,fringe||C.accent);}
    return wv;
  }
  function rect(x,y,w,h,color=null){if(w<=0||h<=0)return;ctx.fillStyle=color||C.fg;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function cutPath(x,y,w,h,cut=48){
    const c=Math.min(cut,w/5,h/5),q=Math.max(4,Math.round(c/3));ctx.beginPath();
    ctx.moveTo(x+c,y);ctx.lineTo(x+w-c,y);ctx.lineTo(x+w-c,y+q);ctx.lineTo(x+w-q,y+q);ctx.lineTo(x+w-q,y+c);ctx.lineTo(x+w,y+c);
    ctx.lineTo(x+w,y+h-c);ctx.lineTo(x+w-q,y+h-c);ctx.lineTo(x+w-q,y+h-q);ctx.lineTo(x+w-c,y+h-q);ctx.lineTo(x+w-c,y+h);
    ctx.lineTo(x+c,y+h);ctx.lineTo(x+c,y+h-q);ctx.lineTo(x+q,y+h-q);ctx.lineTo(x+q,y+h-c);ctx.lineTo(x,y+h-c);
    ctx.lineTo(x,y+c);ctx.lineTo(x+q,y+c);ctx.lineTo(x+q,y+q);ctx.lineTo(x+c,y+q);ctx.closePath();
  }
  function cut(x,y,w,h,color=null,corner=48){if(w<=0||h<=0)return;cutPath(x,y,w,h,corner);ctx.fillStyle=color||C.bg;ctx.fill();}
  function disc(x,y,r,kind='tide',color=null,field=null){
    if(r<1)return;ctx.save();ctx.beginPath();const step=12;
    for(let yy=-r;yy<r;yy+=step){const xx=Math.floor(Math.sqrt(Math.max(0,r*r-(yy+step/2)**2))/step)*step;ctx.rect(x-xx,y+Math.floor(yy/step)*step,xx*2,step);}
    ctx.clip();if(color)rect(x-r-20,y-r-20,r*2+40,r*2+40,color);else pat(0,0,W,H,kind,field);ctx.restore();
  }
  function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}
  function line(points,progress=1,color=null,width=6){
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let remaining=lengths.reduce((a,b)=>a+b,0)*clamp(progress);
    ctx.beginPath();ctx.moveTo(...points[0]);for(let i=0;i<lengths.length;i++){const a=points[i],b=points[i+1];const f=Math.min(1,remaining/lengths[i]);ctx.lineTo(mix(a[0],b[0],f),mix(a[1],b[1],f));remaining-=lengths[i];if(remaining<=0)break;}
    ctx.strokeStyle=color||C.fg;ctx.lineWidth=width;ctx.lineJoin='miter';ctx.stroke();
  }
  function corners(x,y,w,h,p=1,color=null){const l=38*clamp(p),z=8,c=color||C.fg;for(const [xx,yy,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){rect(sx>0?xx:xx-l,yy,l,z,c);rect(xx,sy>0?yy:yy-l,z,l,c);}}
  function shutter(p,kind='strata',reverse=false,field=null){
    if(p<=0)return;for(let row=0;row<12;row++){const advance=clamp(p*1.35-(row%4)*.085);const wide=Math.ceil(advance*W/24)*24;pat(reverse?W-wide:0,row*90,wide,90,kind,field);}
  }
  function makeMedia(t,variant=0){
    mc.fillStyle=T.paperDim;mc.fillRect(0,0,W,H);
    // Abstract demonstration footage, drawn from the same camera for all comparisons.
    const project=(x,y,z)=>[W*.49+(x-z)*190,H*.52+(x+z)*72-y*190];
    const angle=.28+t*.075,co=Math.cos(angle),si=Math.sin(angle);
    const rotate=([x,y,z])=>[x*co-z*si,y,x*si+z*co];
    const verts=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(rotate);
    const pts=verts.map(v=>project(...v));
    const faces=[[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2],[3,2,6,7],[0,1,5,4]];
    const ordered=faces.map((f,i)=>({f,i,depth:f.reduce((sum,n)=>sum+verts[n][0]+verts[n][2],0)})).sort((a,b)=>a.depth-b.depth);
    mc.strokeStyle='#C9C4B2';mc.lineWidth=2;
    for(let i=-5;i<=5;i++){for(const endpoints of [[[i,-1.45,-5],[i,-1.45,5]],[[-5,-1.45,i],[5,-1.45,i]]]){mc.beginPath();mc.moveTo(...project(...endpoints[0]));mc.lineTo(...project(...endpoints[1]));mc.stroke();}}
    for(const {f,i} of ordered){mc.beginPath();f.forEach((n,k)=>k?mc.lineTo(...pts[n]):mc.moveTo(...pts[n]));mc.closePath();mc.fillStyle=[T.cobalt,T.mint,T.violet,T.cobalt,T.mint,T.ink][i];mc.fill();mc.strokeStyle=T.paper;mc.lineWidth=variant?5:3;mc.stroke();
      if(variant){mc.save();mc.clip();mc.strokeStyle=T.coral;mc.lineWidth=6;for(let j=-2;j<18;j++){mc.beginPath();mc.moveTo(j*130,0);mc.lineTo(j*130-500,H);mc.stroke();}mc.restore();}}
    mc.font=fontCJK(38,500);mc.textAlign='left';mc.textBaseline='middle';mc.fillStyle=T.ink;mc.fillText('演示素材 / 几何构造',80,88);
    return {canvas:media,point:pts[6]};
  }
  function footage(t,x=0,y=0,w=W,h=H,variant=0){
    const source=makeMedia(t,variant),scale=Math.max(w/W,h/H),dx=x+(w-W*scale)/2,dy=y+(h-H*scale)/2;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(media,dx,dy,W*scale,H*scale);ctx.restore();
    return {point:[dx+source.point[0]*scale,dy+source.point[1]*scale],sourcePoint:source.point,canvas:media};
  }
  function begin(globalTime,state='signal'){
    bounds.length=0;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
    stateName=state;C=S[state]||S.signal;materialTime=globalTime;
    rect(0,0,W,H,C.bg);
    for(const p of patterns.values())p.renderer.draw(materialTime);
  }
  const kit={ctx,get C(){return C;},get state(){return stateName;},S,T,text,measure,title,reveal,pixelTag,rect,cut,cutPath,teethPath,pat,window,disc,poly,line,corners,shutter,footage,makeMedia,media,begin,bounds,
    settle,flow,depart,stepped,snap,mix,clamp};
  return kit;
}
