import {flow,settle,depart,clamp,mix,snap,W,H,T} from './primitives.mjs';
import {CAPTIONS} from './captions.mjs';
const enter=(t,start,duration)=>settle((t-start)/duration);

// 底色状态随章节语义切换（design.md §2.3）：开场/章节/片尾走 SIGNAL，
// 信息、证据与数据段走 LIGHT。
export const SCENE_STATE={opening:'signal',chapter:'signal',transition:'signal',media:'light',lowerthird:'light',captions:'light',callout:'light',metric:'light',chart:'light',compare:'light',process:'light',takeaway:'light',outro:'signal'};

// 开场：窄像素缝按单一方向拓开成波面窗口，标题经阶梯前沿显影（M01）。
export function opening(k,t,c){
  const P=k.S.signal;
  const wp=enter(t,.12,.6),texP=flow(clamp((t-.8)/.55));
  k.window(840,0,1080,H,wp,{field:'wave',slab:T.cobalt,fringe:T.mint,texP});
  k.pixelTag('PHASE · 01',150,210,44,P.sub,enter(t,.34,.35),'left');
  k.reveal(c.title[0],150,462,124,enter(t,.5,.45),{color:P.fg,maxW:640,fringe:P.sub});
  k.reveal(c.title[1],150,632,124,enter(t,.59,.45),{color:P.fg,maxW:640,fringe:P.sub});
  if(t>1.2)k.text(c.subtitle,150,782,40,P.sub);
  for(let i=0;i<4;i++)k.rect(150+i*30,930,16,16,i===0?P.accent:P.quiet);
}

// 章节：偏心环场迁移到位，孔洞保留负空间；右侧标题显影。
export function chapter(k,t,c){
  const P=k.S.signal;
  const p=enter(t,.3,.85),cx=mix(1010,640,p);
  k.disc(cx,540,246,'tide',null,'wave');
  k.disc(cx,540,106,'tide',P.bg);
  k.pixelTag('02',cx,545,92,P.fg,p,'center',4);
  k.pixelTag('CHAPTER',1060,330,44,P.sub,enter(t,.66,.3),'left');
  k.text(c.index,1060,398,44,P.sub);
  k.reveal(c.title,1060,568,118,enter(t,.8,.45),{color:P.fg,maxW:700,fringe:P.sub});
  if(t>1.55)k.text(c.subtitle,1060,700,38,P.quiet);
  for(let i=0;i<6;i++)k.rect(150+i*28,940,14,14,i<2?P.fg:P.quiet);
}

// 转场：条带沿同一方向覆盖再掀开；前后各保持一种底色状态。
export function transition(k,t,c){
  const A=k.S.signal,B=k.S.light,after=t>2.35;
  k.rect(0,0,W,H,after?B.bg:A.bg);
  if(after){
    k.window(1180,200,560,680,1,{field:'plate',fringe:false});
    k.title(c.after,240,530,118,B.fg);
    k.text('STATE · LIGHT',240,700,36,B.quiet);
  }else{
    k.disc(1350,520,235,'tide',null,'wave');
    k.disc(1350,520,96,'tide',A.bg);
    k.title(c.before,240,530,118,A.fg);
    k.text('STATE · SIGNAL',240,700,36,A.quiet);
  }
  k.text('同一方向，完成交接',960,1000,40,after?B.quiet:A.quiet,'center');
  if(t>1.1&&t<3.45){const p=(t-1.1)/2.35;if(p<.53)k.shutter(flow(p/.53),'strata',false,'wave');else k.shutter(1-flow((p-.53)/.47),'strata',true,'wave');}
}

// 内容开窗：像素边界单方向拓开，素材接管窗口；纹理退到边框之外。
export function media(k,t,c){
  const L=k.S.light;
  const p=enter(t,.35,.8),x=160,y=170,w=1600,h=780;
  const wv=k.teethPath(x,y,w,h,p,{grid:12});
  k.ctx.save();k.ctx.clip();k.rect(x,y,w,h,T.track);k.footage(t,x,y,w,h);k.ctx.restore();
  if(p<1&&wv>0)k.rect(x+wv-4,y,8,h,L.sub);
  if(t>2.1){k.reveal(c.title,160,86,60,enter(t,2.1,.4),{color:L.fg,fringe:L.sub,maxW:1100});k.rect(160,132,64,8,L.sub);k.text(c.label,1810,86,34,L.quiet,'right');}
}

// 身份名条：墨条展开 → 阅读 → 按反序干脆撤离。
export function lowerthird(k,t,c){
  const L=k.S.light;
  k.footage(t);
  const p=enter(t,.65,.7)*(1-depart(clamp((t-4.7)/.55)));
  if(p<=0)return;const x=100,y=756,wMax=960,h=224,wide=Math.ceil(wMax*p/12)*12;
  k.ctx.save();k.ctx.beginPath();k.ctx.rect(x,y,wide,h);k.ctx.clip();
  k.cut(x,y,wMax,h,T.ink,40);
  k.rect(x+40,y+40,10,h-80,T.mint);
  k.text(c.name,x+86,y+82,66,T.paper,'left',700);
  k.text(c.role,x+90,y+170,38,T.mint);
  k.ctx.restore();
}

// 字幕：稳定墨底衬，关键词只做一次钴蓝下划强调。
export function captions(k,t,c){
  const L=k.S.light;
  k.footage(t);
  const cap=CAPTIONS.find(v=>t*1000>=v.startMs&&t*1000<v.endMs);if(!cap)return;
  const local=t-cap.startMs/1000,first=cap===CAPTIONS[0],size=48;
  const line=first?c.lines[0]:c.lines[1];
  const tw=k.measure(line,size,500),bw=tw+176;
  const p=enter(local,0,.3);
  k.ctx.save();k.ctx.beginPath();k.ctx.rect(960-bw/2,820,bw*p,150);k.ctx.clip();
  k.cut(960-bw/2,820,bw,150,T.ink,30);
  k.rect(960-tw/2-64,852,8,86,T.mint);
  k.text(line,960,893,size,T.paper,'center',500);
  if(first){const prefix='让动效带路，让',word='信息落地';const px=960-tw/2+k.measure(prefix,size,500),ww=k.measure(word,size,500);k.rect(px,940,ww*enter(local,.8,.5),6,T.mint);}
  k.ctx.restore();
}

// 局部标注：钴蓝角标锁定细节，折线路径接上真实裁切放大视图。
export function callout(k,t,c){
  const L=k.S.light;
  k.title(c.title,120,116,66,L.fg);k.rect(120,162,56,8,L.sub);
  const source=k.footage(t,104,240,1144,644),[px,py]=source.point;
  const p=enter(t,.85,.5);k.corners(px-65,py-65,130,130,p,L.sub);
  const path=[[px+70,py],[1280,py],[1280,455],[1360,455]];
  k.line(path,1,L.quiet,8);k.line(path,enter(t,1.4,.6),L.sub,8);
  if(t>2){
    const reveal=enter(t,2,.45);k.ctx.save();k.ctx.beginPath();k.ctx.rect(1352,270,460*reveal,540);k.ctx.clip();
    k.cut(1352,270,460,540,T.paperDim,36);k.corners(1352,270,460,540,1,L.fg);
    k.rect(1352,270,150,52,T.ink);k.pixelTag('ZOOM',1378,297,34,T.paper,1,'left',3);
    const [sx,sy]=source.sourcePoint;
    k.ctx.imageSmoothingEnabled=false;k.ctx.drawImage(source.canvas,sx-150,sy-150,300,300,1384,318,396,396);
    k.text(c.label,1582,758,48,L.fg,'center',600);k.ctx.restore();
  }
  if(t>2.5)k.text(c.note,1582,884,32,L.quiet,'center');
}

// 数字揭示：百格聚合与计数同步到达；结果数字走等宽字体。
export function metric(k,t,c){
  const L=k.S.light;
  k.text(c.disclaimer,160,108,34,L.quiet);
  const count=Math.round(c.value*settle(clamp((t-.5)/1.85)));
  const cell=58,gap=12,x=144,y=215;
  for(let i=0;i<100;i++){const xx=x+(i%10)*(cell+gap),yy=y+Math.floor(i/10)*(cell+gap);
    k.rect(xx,yy,cell,cell,i<count?L.fg:T.track);
    if(i===count-1&&t<2.5)k.rect(xx,yy,cell,cell,L.accent);}
  k.text(`${count}${c.suffix??'%'}`,1330,492,190,L.fg,'center',700,true);
  k.text(c.label,1330,690,60,L.fg,'center',600);
  k.text(c.note??'一百个格点，对应一百个百分点',1330,812,32,L.quiet,'center');
}

// 数据比较：同尺度条形逐行展开，纹理只留在生长端，终态干净。行数随数据自适应。
export function chart(k,t,c){
  const L=k.S.light;
  const n=c.values.length,dense=n>3;
  k.title(c.title,142,dense?96:118,dense?62:72,L.fg);k.rect(142,dense?140:168,64,8,L.sub);
  k.text(`${c.disclaimer} · ${c.unit}`,144,dense?196:222,34,L.quiet);
  const x=440,max=1216,bh=dense?44:56,ys=n<=3?[380,578,776]:Array.from({length:n},(_,i)=>300+i*132);
  for(let i=0;i<n;i++){
    const target=max*c.values[i]/100,p=enter(t,.65+i*.32,1.4),width=Math.floor(target*p/8)*8;
    k.text(c.labels[i],144,ys[i]+bh/2,dense?44:52,L.fg,'left',600);
    k.rect(x,ys[i],max,bh,T.track);k.rect(x,ys[i],width,bh,i===1?L.fg:L.sub);
    if(p<1&&width>24)k.pat(x+width-24,ys[i],24,bh,'strata','plate');
    if(p>=1)k.text(String(c.values[i]),x+target+80,ys[i]+bh/2+2,dense?46:58,L.fg,'center',700,true);
  }
  const axisY=Math.min(945,ys[n-1]+bh+58);
  for(const v of [0,25,50,75,100]){const xx=x+max*v/100;k.rect(xx,axisY,2,16,L.quiet);k.text(String(v),xx,axisY+52,30,L.quiet,'center',500,true);}
}

// 双画面对照：共享视角，墨色分界轴平移显露变化，最终回到等分。
export function compare(k,t,c){
  const L=k.S.light;
  k.title(c.title,130,112,70,L.fg);k.rect(130,160,64,8,L.sub);
  k.text(c.disclaimer,130,210,33,L.quiet);
  let divider=960;if(t>1.15&&t<4.5)divider=960+330*Math.sin((t-1.15)/3.35*Math.PI*2)*Math.sin((t-1.15)/3.35*Math.PI);
  const x=110,y=280,w=1700,h=660;k.footage(t,x,y,w,h,0);
  k.ctx.save();k.ctx.beginPath();k.ctx.rect(divider,y,1810-divider,h);k.ctx.clip();k.footage(t,x,y,w,h,1);k.ctx.restore();
  k.rect(divider-10,y,20,h,T.ink);k.rect(divider+10,y,6,h,L.sub);
  k.cut(divider-44,575,88,88,T.ink,20);k.rect(divider-14,599,8,36,T.paper);k.rect(divider+8,599,8,36,T.paper);
  for(const [xx,label] of [[510,c.labels[0]],[1410,c.labels[1]]]){const tw=k.measure(label,40,600)+72;k.cut(xx-tw/2,968,tw,64,T.ink,18);k.text(label,xx,1002,40,T.paper,'center',600);}
}

// 流程演进：路径先建立，钴蓝沿阶梯路径逐项激活节点。
export function process(k,t,c){
  const L=k.S.light;
  k.title(c.title,960,120,70,L.fg,'center');
  const pts=[[300,545],[740,545],[1180,545],[1620,545]];
  for(let i=0;i<3;i++){
    const a=pts[i],b=pts[i+1],path=[[a[0]+104,a[1]],[a[0]+180,a[1]],[a[0]+180,450],[b[0]-170,450],[b[0]-170,b[1]],[b[0]-104,b[1]]];
    k.line(path,1,T.track,8);k.line(path,enter(t,1.2+i*.9,.75),L.sub,8);
  }
  pts.forEach(([x,y],i)=>{
    const p=enter(t,.55+i*.9,.6);
    k.disc(x,y,100,'strata',p>=1?L.sub:T.track);
    if(p>0&&p<1)k.disc(x,y,100*p,'strata',null,'plate');
    k.text(String(i+1),x,y+2,80,p>=1?T.paper:L.quiet,'center',700,true);
    if(p>.9)k.text(c.steps[i],x,752,46,L.fg,'center',600);
  });
  for(let i=0;i<40;i++)k.rect(480+i*24,933,i%5===4?18:8,i%5===4?18:8,i%5===4?L.sub:L.quiet);
}

// 结论收束：装饰退到角标，结论在中央显影，留完整阅读停顿。
export function takeaway(k,t,c){
  const L=k.S.light;
  for(let i=0;i<3;i++){k.rect(150+i*26,196-i*26,22,22,L.accent);k.rect(1748-i*26,858+i*26,22,22,L.accent);}
  k.reveal(c.lines[0],960,400,122,enter(t,.5,.45),{color:L.fg,align:'center',fringe:L.sub,maxW:1500});
  k.reveal(c.lines[1],960,598,122,enter(t,.59,.45),{color:L.fg,align:'center',fringe:L.sub,maxW:1500});
  if(t>1.7){k.rect(880,758,160,8,L.sub);k.text(c.subtitle,960,846,38,L.quiet,'center');}
}

// 片尾：像素单元归位成观察符号，标题显影后安静收尾。
export function outro(k,t,c){
  const P=k.S.signal;
  const p=enter(t,.35,1.4),cx=960,cy=382;
  const dots=[[-2,-1],[-1,-2],[0,-2],[1,-2],[2,-1],[2,0],[2,1],[1,2],[0,2],[-1,2],[-2,1],[-2,0]];
  dots.forEach(([x,y],i)=>{const spread=1+(1-p)*1.6,xx=cx+x*62*spread,yy=cy+y*62*spread;
    k.rect(xx-23,yy-23,46,46,i%4===0?P.accent:i%3===0?P.fg:P.sub);});
  k.disc(cx,cy,54*p,'tide',null,'wave');
  k.reveal(c.title,960,716,118,enter(t,1.55,.45),{color:P.fg,align:'center',fringe:P.sub,maxW:1200});
  if(t>2.4)k.text(c.subtitle,960,872,40,P.quiet,'center');
}

export const DRAW={opening,chapter,transition,media,lowerthird,captions,callout,metric,chart,compare,process,takeaway,outro};
