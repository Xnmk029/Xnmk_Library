'use strict';
/* generator.js — procedural brushstroke generator for the Mona Lisa study (pure SVG).
   Deterministic (seeded), so the exact output can be regenerated. Every mark is a short
   quadratic arc (quill/brush stroke); strokes are piled up in painterly layers
   (sky -> mountains -> landscape -> figure -> glazes) to imitate glazing & sfumato. */

const fs = require('fs');

/* ---------------- RNG ---------------- */
const SEED = 20260825;
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rnd=mulberry32(SEED);
const R=(a,b)=>a+(b-a)*rnd();
const RI=(a,b)=>Math.floor(R(a,b+1));
const pick=a=>a[Math.floor(rnd()*a.length)];
const r1=n=>Math.round(n*10)/10;
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);

/* ---------------- stroke builders ---------------- */
function P(x1,y1,x2,y2,c,w,o,maxBend){
  x1=clamp(x1,0,1200);y1=clamp(y1,0,1600);x2=clamp(x2,0,1200);y2=clamp(y2,0,1600);
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;
  const nx=-dy/len,ny=dx/len;
  const mb=maxBend??(1.6+w*0.22);
  const b=(rnd()*2-1)*mb*(0.35+0.65*Math.min(1,len/46));
  const mx=(x1+x2)/2+nx*b,my=(y1+y2)/2+ny*b;
  return `<path d="M${r1(x1)} ${r1(y1)}Q${r1(mx)} ${r1(my)} ${r1(x2)} ${r1(y2)}" stroke="${c}" stroke-width="${r1(w)}" opacity="${o>=1?o:Math.round(o*1000)/1000}"/>`;
}
function PS(x1,y1,x2,y2,c,w,o,bend){
  x1=clamp(x1,0,1200);y1=clamp(y1,0,1600);x2=clamp(x2,0,1200);y2=clamp(y2,0,1600);
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;
  const nx=-dy/len,ny=dx/len;
  const mx=(x1+x2)/2+nx*bend,my=(y1+y2)/2+ny*bend;
  return `<path d="M${r1(x1)} ${r1(y1)}Q${r1(mx)} ${r1(my)} ${r1(x2)} ${r1(y2)}" stroke="${c}" stroke-width="${r1(w)}" opacity="${o>=1?o:Math.round(o*1000)/1000}"/>`;
}

const layers=[];
const stats=[];
function layer(name,arr){if(arr.length){layers.push('<g stroke-linecap="round" fill="none">'+arr.join('')+'</g>');stats.push([name,arr.length]);}}

/* ---------------- geometry helpers ---------------- */
const inEll=(x,y,cx,cy,rx,ry)=>{const a=(x-cx)/rx,b=(y-cy)/ry;return a*a+b*b<=1;};
function ellipseSample(cx,cy,rx,ry,r0=0.1,r1=0.97){
  const t=R(0,Math.PI*2),rr=Math.sqrt(R(r0*r0,r1*r1));
  return [cx+rx*rr*Math.cos(t),cy+ry*rr*Math.sin(t)];
}
function ellipseDir(cx,cy,rx,ry,tw,rw,vw){
  return (x,y)=>{
    const th=Math.atan2((y-cy)/ry,(x-cx)/rx);
    const tx=-Math.sin(th),ty=Math.cos(th);
    const ex=Math.cos(th),ey=Math.sin(th);
    let dx=tx*tw+ex*rw,dy=ty*tw+ey*rw+vw;
    const l=Math.hypot(dx,dy)||1;
    return [dx/l+R(-0.07,0.07),dy/l+R(-0.07,0.07)];
  };
}
function flowPass(o){
  const out=[];
  for(let i=0;i<o.count;i++){
    let p=o.sample();let ok=false;
    for(let k=0;k<8&&!ok;k++){ok=!(o.inside&&!o.inside(p[0],p[1]));if(!ok)p=o.sample();}
    if(!ok)continue;
    const d=o.dirAt(p[0],p[1]),dl=Math.hypot(d[0],d[1])||1;
    const len=R(o.lenMin,o.lenMax);
    const x1=p[0]-d[0]/dl*len/2,y1=p[1]-d[1]/dl*len/2,x2=p[0]+d[0]/dl*len/2,y2=p[1]+d[1]/dl*len/2;
    out.push(P(x1,y1,x2,y2,o.color(),R(o.wMin,o.wMax),R(o.oMin,o.oMax),o.maxBend));
  }
  return out;
}

/* ================= PALETTES (ochre brown / dark gold / olive / deep brown / airy blue-green) ================ */
const SKY       =['#aec4bd','#b8cbc4','#9fb6ae','#a5b8b0','#b8c9c2','#94aca4','#c0cec6'];
const SKY_WARM  =['#cfd6c4','#c6cdb8','#c9d2bf','#d6d8c6'];
const MTN_FAR   =['#8fa89b','#7c988c','#6e8a80','#93aa9e','#82998d','#a3b5aa'];
const MTN_MID   =['#6e8377','#5f7569','#778d80','#65796d'];
const HAZE      =['#c3d0c8','#b9c8bd','#ccd7d0','#bfcec5'];
const LAND_L    =['#6d7d5d','#5f7050','#77876a','#65755a','#82906f','#93a07c'];
const TREE      =['#4a5c41','#3f4f38','#55684a','#43543c'];
const PATH_C    =['#c2b48f','#b3a47e','#cbb98f','#ab9c76','#baab84'];
const ROCK_R    =['#5a5244','#6b6150','#4c4638','#7a6f5a','#544b3e'];
const RIVER     =['#6f8f88','#5d7f78','#7fa49b','#5b7a73','#86a898'];
const BRIDGE    =['#7a6a52','#8a7a60','#5c4f3d','#96856a'];
const COLUMN    =['#8a7f6a','#7d7261','#958a70','#6e6353','#847963'];
const GROUND_N  =['#4a4a3a','#3f4434','#57503e','#33382c','#444434'];
const HAIR_D    =['#241a10','#1d150c','#2e2116','#33241a','#181108'];
const HAIR_H    =['#402c18','#4e341d','#583a20','#3a2813'];
const VEIL      =['#8a7f6a','#958a70','#7d7261','#847963'];
const VEIL_H    =['#b4a98e','#c2b695'];
const DRESS_B   =['#3b3a2c','#413f30','#454235','#3f3d2e','#37362a'];
const DRESS_D   =['#26251c','#2e2c22','#1f1e16'];
const DRESS_H   =['#5c5648','#6a614a','#544e3e','#5e5949','#6d6550'];
const EMBROID   =['#7a7357','#8a8365','#6a614a','#948c6c'];
const FACE_BASE =['#c7986b','#c1905f','#bf8d60','#c99a6e','#c4976b'];
const FACE_MID  =['#b08157','#a97a50','#c7986b','#b98a5f','#ab7c52'];
const FACE_DARK =['#8f6542','#7a5334','#96663f','#85603c','#6b452c'];
const FACE_LIT  =['#d9ad7f','#e2b98c','#d3a474','#dcb184'];
const BLUSH     =['#c08b5e','#cd9970','#c68f62'];
const EYE_DARK  =['#241a10','#1d150c','#33251a'];
const IRIS      =['#6b4a2a','#7a5a35','#57381f'];
const SPARK     =['#eeddc0','#e6d2b2'];
const BROW      =['#3e2c1a','#4a3520'];
const LIP       =['#b07a52','#a06e46','#9a6a44','#c08b5e'];
const LIP_D     =['#7f5536','#6b452c'];
const WOOD      =['#3a2c1e','#4a3826','#2c2015','#523d28'];
const GLAZE     =['#7a6a4e','#8a7a5e','#6e5d49'];

/* ================= 1. SKY ================= */
{
  const out=[];
  for(let i=0;i<560;i++){
    const y=R(0,452), x=R(0,1200);
    const len=R(70,150);
    out.push(P(x,y,x+len*R(-1,1),y+R(-8,8),pick(SKY),R(9,20),R(0.13,0.26)));
  }
  // warm left-top glow (light source of the painting)
  for(let i=0;i<60;i++){
    const y=R(30,240), x=R(30,300);
    out.push(P(x,y,x+R(60,130),y+R(-6,6),pick(SKY_WARM),R(8,16),R(0.12,0.22)));
  }
  layer('sky',out);
}
/* ================= 2. FAR MISTY MOUNTAINS ================= */
{
  const out=[];
  const ridges=[
    {y0:400,y1:472,amp:34,per:0.004,ph:1.3,col:MTN_FAR,o:[0.24,0.4]},
    {y0:468,y1:536,amp:44,per:0.0055,ph:3.1,col:MTN_FAR.concat(MTN_MID),o:[0.3,0.48]},
    {y0:520,y1:588,amp:56,per:0.007,ph:5.2,col:MTN_MID,o:[0.38,0.56]}
  ];
  for(const rg of ridges){
    for(let x=6;x<1194;x+=R(12,16)){
      const peak=rg.y0+Math.max(0,Math.sin(x*rg.per+rg.ph))*rg.amp+R(-10,10);
      const hh=R(30,80);
      const y1=Math.min(rg.y1,peak), y2=Math.max(rg.y1,peak)+hh*0.4;
      out.push(P(x+R(-3,3),y1+R(-6,6),x+R(-3,3),y2,pick(rg.col),R(9,20),R(rg.o[0],rg.o[1])));
    }
    for(let i=0;i<70;i++){
      const x=R(0,1200), y=R(rg.y0-20,rg.y1);
      out.push(P(x+R(-20,20),y,x+R(-30,30),y+R(6,18),pick(rg.col),R(6,12),R(0.12,0.24)));
    }
  }
  layer('far-mountains',out);
}
/* ================= 3. HAZE (air perspective band) ================= */
{
  const out=[];
  for(let i=0;i<140;i++){
    const y=R(430,545), x=R(0,1200);
    out.push(P(x,y,x+R(60,170),y+R(-4,4),pick(HAZE),R(10,22),R(0.1,0.2)));
  }
  layer('haze',out);
}
/* ================= 4. LEFT LANDSCAPE (olive hills + winding path + arch bridge) ================= */
{
  const out=[];
  for(let i=0;i<470;i++){
    const x=R(0,470), y=R(560,880);
    const len=R(30,70);
    out.push(P(x,y,x+R(-20,26),y+R(-16,26),pick(LAND_L),R(6,13),R(0.2,0.38)));
  }
  // dark treeline on the left ridge
  for(let i=0;i<130;i++){
    const x=R(0,420), y=R(600,R(640,700));
    out.push(P(x,y,x+R(-4,4),y+R(20,46),pick(TREE),R(5,11),R(0.3,0.5)));
  }
  // small trees (blobs of radial strokes)
  for(const cx of [170,270,120,360]){
    for(let i=0;i<16;i++){
      const t=R(0,Math.PI*2),rr=R(6,26);
      const x=cx+rr*Math.cos(t), y=690+rr*Math.sin(t)*0.7;
      out.push(P(x,y,x+R(-6,6),y+R(6,18),pick(TREE),R(3,6),R(0.25,0.45)));
    }
  }
  // winding path descending left toward the viewer
  {
    const t0=R(0.05,0.12);
    for(let i=0;i<260;i++){
      const t=t0+R(0.05,0.92);
      const x=300-250*t+70*Math.sin(3.1*t)*t;
      const y=598+330*t;
      const ddx=-250+70*Math.cos(3.1*t)*t+70*Math.sin(3.1*t);
      const dl=Math.hypot(ddx,330)||1;
      const len=R(26,58);
      out.push(P(x-ddx/dl*len/2,y-330/dl*len/2,x+ddx/dl*len/2,y+330/dl*len/2,pick(PATH_C),R(6,12),R(0.2,0.36)));
    }
    // darker edges hugging the path
    for(let i=0;i<70;i++){
      const t=R(0.15,0.95);
      const x=300-250*t+70*Math.sin(3.1*t)*t;
      const y=598+330*t;
      out.push(P(x+R(-14,-6),y,x+R(-22,-10),y+R(20,40),pick(TREE),R(4,7),R(0.2,0.32)));
      out.push(P(x+R(6,14),y,x+R(10,22),y+R(20,40),pick(TREE),R(4,7),R(0.2,0.32)));
    }
  }
  // small stone arched bridge crossing the left path
  {
    for(let i=0;i<46;i++){
      const t=R(0.05,0.95);
      const x=212+120*t, y=648-26*Math.sin(Math.PI*t);
      out.push(P(x+R(-4,4),y,x+R(-4,4),y+R(14,26),pick(BRIDGE),R(4,8),R(0.25,0.4)));
    }
    out.push(PS(216,664,322,664,'#5c4f3d',3,0.55,0));
    out.push(PS(218,648,320,648,'#8a7a60',2.5,0.6,0));
    out.push(PS(224,630,314,630,'#96856a',2.2,0.5,8));
    // arch shadow under the deck
    out.push(PS(220,668,318,668,'#3f4434',2.5,0.4,0));
    // stone block hatching
    for(let i=0;i<36;i++){
      const x=R(224,312),y=R(648,668);
      out.push(P(x,y,x+R(-3,3),y+R(-3,11),pick(['#7a6a52','#5c4f3d','#6b5c46']),R(2,4),R(0.2,0.35)));
    }
  }
  layer('left-landscape',out);
}
/* ================= 5. RIGHT LANDSCAPE (rocks, river, mist) ================= */
{
  const out=[];
  // rocky hills on the far right
  for(let i=0;i<380;i++){
    const x=R(980,1200), y=R(560,820);
    const len=R(24,64);
    out.push(P(x,y,x+R(-24,22),y+R(-14,30),pick(ROCK_R),R(6,13),R(0.22,0.4)));
  }
  // river band flowing down the right side
  for(let i=0;i<260;i++){
    const x=R(1000,1190), y=R(585,960);
    const len=R(50,110);
    out.push(P(x,y,x+len*R(-0.9,-0.5),y+R(-10,10),pick(RIVER),R(8,18),R(0.18,0.34)));
  }
  // vertical reflections in the river
  for(let i=0;i<120;i++){
    const x=R(1025,1185), y=R(600,950);
    out.push(P(x,y,x+R(-3,3),y+R(16,42),pick(RIVER),R(3,7),R(0.12,0.24)));
  }
  layer('right-landscape',out);
}
/* ================= 6. SUBTLE COLUMNS AT THE EDGES (as in the original) ================= */
{
  const out=[];
  for(let i=0;i<90;i++){
    const x=R(52,108), y=R(120,760);
    out.push(P(x+R(-5,5),y,x+R(-5,5),y+R(34,92),pick(COLUMN),R(6,12),R(0.14,0.28)));
  }
  for(let i=0;i<90;i++){
    const x=R(1092,1148), y=R(120,760);
    out.push(P(x+R(-5,5),y,x+R(-5,5),y+R(34,92),pick(COLUMN),R(6,12),R(0.14,0.28)));
  }
  for(let i=0;i<16;i++){
    const x=R(300,900), y=R(120,300);
    out.push(P(x,y,x+R(20,60),y+R(-4,4),pick(SKY),R(6,14),R(0.1,0.18)));
  }
  layer('columns',out);
}
/* ================= 7. NEAR GROUND (dark olive foreground corners + bottom band) ================= */
{
  const out=[];
  for(let i=0;i<220;i++){
    const x=R(0,252), y=R(940,1600);
    const len=R(26,64);
    out.push(P(x,y,x+R(-18,18),y+R(14,44),pick(GROUND_N),R(6,12),R(0.34,0.5)));
  }
  for(let i=0;i<200;i++){
    const x=R(992,1200), y=R(960,1600);
    const len=R(26,64);
    out.push(P(x,y,x+R(-18,18),y+R(14,44),pick(GROUND_N),R(6,12),R(0.34,0.5)));
  }
  for(let i=0;i<60;i++){
    const y=R(1532,1600), x=R(0,1200);
    out.push(P(x,y,x+R(30,110),y+R(2,8),pick(GROUND_N),R(8,16),R(0.3,0.44)));
  }
  layer('near-ground',out);
}
/* ---- 7b. FIGURE UNDERCOAT (dark impasto base massing the whole figure) ---- */
{
  const out=[];
  const inFigure=(x,y)=>{
    if(y<=330)return false;
    if(y<760)return inEll(x,y,600,452,198,212)&&!inEll(x,y,600,470,96,128);
    const t=Math.min(1,(y-760)/840);
    const l=352+(226-352)*t, r=866+(994-866)*t;
    return x>l-26&&x<r+26;
  };
  out.push(flowPass({
    count:640,
    sample:()=>[R(180,1020),R(340,1590)],
    inside:inFigure,
    dirAt:()=>[R(-0.35,0.35),1],
    color:()=>pick(['#4a3a2a','#3d2f20','#55432f','#2f2418']),
    lenMin:60,lenMax:150,wMin:14,wMax:30,oMin:0.16,oMax:0.26
  }).join(''));
  layer('figure-undercoat',out);
}

/* ================= FIGURE ================= */

/* ---- 8. BACK HAIR (dark mass framing the face) ---- */
{
  const out=[];
  const inHairBack=(x,y)=>inEll(x,y,600,452,186,206)&&!inEll(x,y,600,470,88,118)&&y<780;
  // deep volume
  out.push(flowPass({
    count:640,
    sample:()=>ellipseSample(600,452,186,206,0.15,0.97),
    inside:inHairBack,
    dirAt:(x,y)=>[(x-600)*0.024+R(-0.1,0.1),1+R(-0.16,0.1)],
    color:()=>pick(HAIR_D),
    lenMin:30,lenMax:82,wMin:6,wMax:13,oMin:0.38,oMax:0.6
  }).join(''));
  // cascading strands from the centre parting (600,345)
  for(let i=0;i<560;i++){
    const x=R(470,730), y=383+R(-34,30);
    const ex=x+(x-600)*0.55+R(-34,34);
    const ey=y+R(200,392);
    if(ex<0||ex>1200)continue;
    out.push(P(x,y,ex,ey,pick(HAIR_D),R(4,9),R(0.32,0.54)));
  }
  // locks falling over the shoulders
  for(let i=0;i<90;i++){
    const side=i%2===0;
    const x=side?R(452,512):R(700,746);
    const y=R(600,720);
    out.push(P(x,y,x+ (side?-26:26)*R(0.6,1.2),y+R(60,150),pick(HAIR_D),R(5,10),R(0.3,0.48)));
  }
  // warm sheen highlights
  out.push(flowPass({
    count:120,
    sample:()=>ellipseSample(600,452,174,192,0.25,0.9),
    inside:inHairBack,
    dirAt:(x,y)=>[(x-600)*0.03+R(-0.08,0.08),1],
    color:()=>pick(HAIR_H),
    lenMin:24,lenMax:58,wMin:3,wMax:6,oMin:0.22,oMax:0.34
  }).join(''));
  // centre part line
  out.push(PS(600,338,598,392,'#1d150c',2.6,0.55,-3));
  out.push(PS(598,392,596,432,'#241a10',2.2,0.42,0));
  layer('hair',out);
}
/* ---- 9. DRESS (dark olive-brown body, layered folds, gold embroidery) ---- */
{
  const out=[];
  const inDress=(x,y)=>{
    if(y<752||y>1600)return false;
    const t=Math.min(1,(y-752)/850);
    const l=352+(226-352)*t, r=866+(994-866)*t;
    return x>l&&x<r;
  };
  out.push(flowPass({
    count:1000,
    sample:()=>[R(200,1000),R(756,1590)],
    inside:inDress,
    dirAt:()=>[R(-0.22,0.22),1],
    color:()=>pick(DRESS_B),
    lenMin:34,lenMax:80,wMin:6,wMax:12,oMin:0.42,oMax:0.62
  }).join(''));
  // dark fold valleys on fixed vertical fold lines
  const folds=[352,405,458,512,566,620,674,728,782,836,888,942];
  for(let i=0;i<420;i++){
    const fx=pick(folds)+R(-8,8), y=R(770,1580);
    out.push(P(fx,y,fx+R(-14,12),y+R(26,64),pick(DRESS_D),R(5,10),R(0.42,0.56)));
  }
  // lighter raised fold ridges
  out.push(flowPass({
    count:300,
    sample:()=>[R(200,1000),R(770,1580)],
    inside:inDress,
    dirAt:()=>[R(-0.15,0.15),1],
    color:()=>pick(DRESS_H),
    lenMin:20,lenMax:48,wMin:3,wMax:6,oMin:0.22,oMax:0.38
  }).join(''));
  // neckline with golden-thread embroidery
  for(let i=0;i<64;i++){
    const t=R(0.02,0.98);
    const x=468+264*t, y=754+26*Math.sin(Math.PI*t);
    const ddx=264, ddy=26*Math.PI*Math.cos(Math.PI*t);
    const dl=Math.hypot(ddx,ddy)||1;
    const len=R(7,16);
    out.push(P(x-ddx/dl*len/2,y-ddy/dl*len/2,x+ddx/dl*len/2,y+ddy/dl*len/2,pick(EMBROID),R(1.8,3.4),R(0.4,0.62)));
  }
  // neckline cast shadow
  out.push(PS(470,758,730,758,'#26251c',3,0.5,12));
  out.push(PS(480,750,720,750,'#413f30',2.4,0.5,8));
  layer('dress',out);
}
/* ---- 10. SLEEVES and standing arms leading to the folded hands ---- */
{
  const out=[];
  // left sleeve (viewer left): shoulder -> cuff toward centre-right
  for(let i=0;i<260;i++){
    const t=R(0.05,0.95);
    const ax=400+320*t, ay=776+490*t;
    const jx=R(-34,34), jy=R(-16,16);
    const x=clamp(ax+jx,0,1200), y=clamp(ay+jy,0,1600);
    const len=R(40,84);
    const ddx=320, ddy=490, dl=Math.hypot(ddx,ddy)||1;
    out.push(P(x-ddx/dl*len/2,y-ddy/dl*len/2,x+ddx/dl*len/2,y+ddy/dl*len/2,pick([i%5===0?'#26251c':pick(DRESS_B),DRESS_D[RI(0,2)]]),R(6,12),R(0.38,0.55)));
  }
  // right sleeve (viewer right)
  for(let i=0;i<220;i++){
    const t=R(0.05,0.95);
    const ax=862-62*t, ay=782+530*t;
    const jx=R(-30,30), jy=R(-16,16);
    const x=clamp(ax+jx,0,1200), y=clamp(ay+jy,0,1600);
    const len=R(40,84);
    const ddx=-62, ddy=530, dl=Math.hypot(ddx,ddy)||1;
    out.push(P(x-ddx/dl*len/2,y-ddy/dl*len/2,x+ddx/dl*len/2,y+ddy/dl*len/2,pick([DRESS_B[RI(0,4)],DRESS_D[RI(0,2)]]),R(6,12),R(0.38,0.55)));
  }
  layer('sleeves',out);
}
/* ---- 11. NECK ---- */
{
  const out=[];
  out.push(flowPass({
    count:200,
    sample:()=>ellipseSample(600,640,58,56,0.2,0.95),
    inside:(x,y)=>inEll(x,y,600,642,60,58)&&y>588,
    dirAt:()=>[R(-0.1,0.1),1],
    color:()=>pick(FACE_BASE.concat(FACE_MID)),
    lenMin:24,lenMax:52,wMin:4.5,wMax:9,oMin:0.28,oMax:0.48
  }).join(''));
  // shadow side of the neck
  out.push(flowPass({
    count:80,
    sample:()=>ellipseSample(600,642,60,58,0.2,0.95),
    inside:(x,y)=>inEll(x,y,600,642,60,58)&&x>620&&y>590,
    dirAt:()=>[R(-0.1,0.12),1],
    color:()=>pick(FACE_DARK),
    lenMin:18,lenMax:44,wMin:3.5,wMax:7,oMin:0.26,oMax:0.44
  }).join(''));
  // shadow cast under the chin
  for(let i=0;i<56;i++){
    const x=R(556,648), y=R(594,610);
    out.push(P(x,y,x+R(-14,14),y+R(-2,8),pick(FACE_DARK),R(3,6),R(0.28,0.44)));
  }
  // collarbone shading
  for(let i=0;i<44;i++){
    const x=R(540,664), y=R(682,706);
    out.push(P(x,y,x+R(-16,16),y+R(-4,10),pick(FACE_DARK.concat(['#a97a50'])),R(2.5,5),R(0.2,0.36)));
  }
  layer('neck',out);
}

/* ================= FACE (layered sfumato) ================= */
const F={cx:600,cy:470,rx:88,ry:118};
{
  const out=[];
  // pass 1: warm ochre base wash, strokes hugging the face volume
  out.push(flowPass({
    count:560,
    sample:()=>ellipseSample(F.cx,F.cy,F.rx,F.ry,0.16,0.97),
    inside:(x,y)=>inEll(x,y,F.cx,F.cy,F.rx,F.ry),
    dirAt:ellipseDir(F.cx,F.cy,F.rx,F.ry,0.55,0.25,0.2),
    color:()=>pick(FACE_BASE),
    lenMin:26,lenMax:58,wMin:7,wMax:13,oMin:0.2,oMax:0.36
  }).join(''));
  // pass 2: mid tone build
  out.push(flowPass({
    count:560,
    sample:()=>ellipseSample(F.cx,F.cy,F.rx,F.ry,0.12,0.96),
    inside:(x,y)=>inEll(x,y,F.cx,F.cy,F.rx,F.ry),
    dirAt:ellipseDir(F.cx,F.cy,F.rx,F.ry,0.5,0.3,0.2),
    color:()=>pick(FACE_MID),
    lenMin:20,lenMax:46,wMin:5,wMax:10,oMin:0.28,oMax:0.48
  }).join(''));
  // pass 3: shadow build on the light-away side (viewer right)
  out.push(flowPass({
    count:430,
    sample:()=>ellipseSample(F.cx,F.cy,F.rx,F.ry,0.1,0.96),
    inside:(x,y)=>inEll(x,y,F.cx,F.cy,F.rx,F.ry)&&(x-F.cx)/F.rx>0.06,
    dirAt:ellipseDir(F.cx,F.cy,F.rx,F.ry,0.45,0.3,0.25),
    color:()=>pick(FACE_DARK),
    lenMin:18,lenMax:44,wMin:4,wMax:8,oMin:0.24,oMax:0.44
  }).join(''));
  // pass 4: highlight build on the light side (viewer left)
  out.push(flowPass({
    count:330,
    sample:()=>ellipseSample(F.cx,F.cy,F.rx,F.ry,0.1,0.95),
    inside:(x,y)=>inEll(x,y,F.cx,F.cy,F.rx,F.ry)&&(x-F.cx)/F.rx<-0.16,
    dirAt:ellipseDir(F.cx,F.cy,F.rx,F.ry,0.5,0.28,0.22),
    color:()=>pick(FACE_LIT),
    lenMin:16,lenMax:40,wMin:3.5,wMax:7,oMin:0.24,oMax:0.44
  }).join(''));
  // pass 5: forehead fine arcs
  out.push(flowPass({
    count:120,
    sample:()=>ellipseSample(F.cx,F.cy,F.rx,F.ry*0.9,0.1,0.9),
    inside:(x,y)=>inEll(x,y,F.cx,F.cy,F.rx,F.ry)&&y<430,
    dirAt:ellipseDir(F.cx,F.cy,F.rx,F.ry,0.85,0.1,-0.12),
    color:()=>pick(FACE_LIT.concat(FACE_BASE)),
    lenMin:14,lenMax:34,wMin:3,wMax:6,oMin:0.22,oMax:0.4
  }).join(''));
  // pass 6: eye sockets & brow shading
  {
    const holes=[[566,458,26,15],[646,453,22,13]];
    for(const h of holes){
      out.push(flowPass({
        count:60,
        sample:()=>ellipseSample(h[0],h[1],h[2],h[3],0.2,0.98),
        inside:(x,y)=>inEll(x,y,h[0],h[1],h[2],h[3]),
        dirAt:ellipseDir(h[0],h[1],h[2],h[3],0.7,0.2,0.1),
        color:()=>pick(FACE_DARK),
        lenMin:10,lenMax:26,wMin:3,wMax:6,oMin:0.26,oMax:0.46
      }).join(''));
    }
  }
  // pass 7: nose shadow column
  out.push(flowPass({
    count:70,
    sample:()=>ellipseSample(616,484,13,46,0.2,0.96),
    inside:(x,y)=>inEll(x,y,616,484,13,46),
    dirAt:(x,y)=>[0.12+R(-0.1,0.1),1],
    color:()=>pick(FACE_DARK),
    lenMin:12,lenMax:30,wMin:3,wMax:6,oMin:0.24,oMax:0.42
  }).join(''));
  // pass 8: mouth shadow & smile dimples
  out.push(flowPass({
    count:70,
    sample:()=>ellipseSample(612,556,34,20,0.1,0.95),
    inside:(x,y)=>inEll(x,y,612,556,34,20),
    dirAt:ellipseDir(612,556,34,20,0.6,0.3,0.1),
    color:()=>pick(LIP_D),
    lenMin:10,lenMax:24,wMin:2.5,wMax:5,oMin:0.22,oMax:0.38
  }).join(''));
  // pass 9: soft blush on the light-side cheek
  out.push(flowPass({
    count:40,
    sample:()=>ellipseSample(548,506,24,15,0.15,0.95),
    inside:(x,y)=>inEll(x,y,548,506,24,15),
    dirAt:ellipseDir(548,506,24,15,0.7,0.3,0),
    color:()=>pick(BLUSH),
    lenMin:10,lenMax:22,wMin:3,wMax:6,oMin:0.18,oMax:0.3
  }).join(''));
  layer('face-sfumato',out);
}
/* ---- 12. FACIAL FEATURES (precise short strokes: brows, eyes, nose, mouth) ---- */
{
  const out=[];
  const fs=[]; // feature strokes: x1,y1,x2,y2,color,w,o,bend

  // faint eyebrows (barely visible, as in the cleaned original)
  fs.push([512,440,578,431,'#4a3520',2.2,0.26,-5]);
  fs.push([516,436,570,429,'#3e2c1a',1.8,0.22,-4]);
  fs.push([596,429,664,436,'#4a3520',2,0.22,4]);
  fs.push([602,426,656,434,'#3e2c1a',1.6,0.2,3]);

  // LEFT eye (viewer left)
  fs.push([538,459,584,451,'#241a10',2.8,0.5,-13]);   // upper lid
  fs.push([536,456,542,458,'#241a10',1.8,0.45,2]);
  fs.push([542,465,578,460,'#a97a50',1.5,0.3,4]);     // lower lid hint
  fs.push([556,454,564,460,'#6b4a2a',2.2,0.75,0]);    // iris
  fs.push([555,459,565,453,'#57381f',1.7,0.6,0]);
  fs.push([557,452,562,461,'#7a5a35',1.4,0.45,0]);
  fs.push([559,455,562,459,'#1d150c',2,0.85,0]);      // pupil
  fs.push([563,452,565,450,'#eeddc0',1.1,0.75,0]);    // catchlight
  fs.push([546,462,552,464,'#8f6542',1.6,0.3,0]);     // inner corner shade

  // RIGHT eye (viewer right)
  fs.push([627,457,659,450,'#241a10',2.6,0.48,-11]);
  fs.push([625,454,631,456,'#241a10',1.7,0.42,2]);
  fs.push([631,464,655,459,'#a97a50',1.4,0.28,3]);
  fs.push([638,452,646,457,'#6b4a2a',2,0.72,0]);
  fs.push([637,457,647,452,'#57381f',1.6,0.58,0]);
  fs.push([639,450,644,458,'#7a5a35',1.3,0.42,0]);
  fs.push([641,453,644,457,'#1d150c',1.9,0.85,0]);
  fs.push([645,450,647,448,'#eeddc0',1,0.7,0]);
  fs.push([633,460,637,463,'#8f6542',1.5,0.3,0]);

  // NOSE
  fs.push([604,446,610,506,'#e2b98c',3.2,0.5,-1]);    // bridge highlight
  fs.push([598,450,606,500,'#d9ad7f',2.3,0.35,0]);
  fs.push([614,452,620,516,'#a97a50',3,0.42,0]);      // bridge shade
  fs.push([596,520,602,526,'#7f5536',2,0.55,3]);      // nostril left
  fs.push([628,519,634,525,'#7f5536',2,0.55,-3]);     // nostril right
  fs.push([608,516,620,524,'#c7986b',2.4,0.5,0]);     // tip
  fs.push([609,518,617,522,'#e2b98c',1.7,0.45,0]);    // tip highlight

  // MOUTH with the enigmatic smile (corners slightly lifted)
  fs.push([574,551,612,544,'#9a6a44',2.6,0.75,-6]);   // upper lip L
  fs.push([612,544,648,551,'#9a6a44',2.6,0.75,-6]);   // upper lip R
  fs.push([570,547,574,551,'#7f5536',1.8,0.5,0]);     // lifted corner L
  fs.push([648,551,652,547,'#7f5536',1.8,0.5,0]);     // lifted corner R
  fs.push([584,568,612,572,'#b07a52',2.8,0.7,4]);     // lower lip L
  fs.push([612,572,640,566,'#b07a52',2.8,0.7,4]);     // lower lip R
  fs.push([592,564,612,566,'#d9ad7f',1.6,0.4,0]);     // lower lip highlight
  fs.push([586,576,638,572,'#7f5536',2,0.35,0]);      // shadow under lip
  fs.push([608,547,610,554,'#c7986b',1.4,0.4,0]);     // philtrum
  // dimple shadow lines from the nose wings (adds the mystery)
  fs.push([596,524,574,550,'#8f6542',1.6,0.26,-2]);
  fs.push([634,525,648,550,'#8f6542',1.6,0.26,2]);

  // CHIN and jaw
  fs.push([596,584,612,588,'#d9ad7f',1.8,0.4,0]);
  fs.push([612,588,628,583,'#8f6542',1.8,0.35,0]);
  fs.push([590,592,634,590,'#7f5536',1.6,0.28,-8]);  // chin crease
  // jaw shading strokes along the masseter volume
  for(let i=0;i<26;i++){
    const t=R(0,1);
    const x=610+t*64, y=556+t*44;
    out.push(P(x+R(-3,3),y,x+R(-3,3),y+R(8,20),pick(['#8f6542','#7a5334']),R(2.4,4.5),R(0.2,0.36)));
  }
  // ear hints
  fs.push([516,498,522,528,'#a97a50',2.4,0.38,-8]);
  fs.push([684,496,678,524,'#a97a50',2,0.3,8]);
  // temple shadows where hair meets the face
  fs.push([512,452,496,530,'#7a5334',3.5,0.32,-4]);
  fs.push([688,452,702,528,'#7a5334',3,0.28,4]);
  // dark hair locks framing the temples
  fs.push([506,436,478,540,'#241a10',4.5,0.5,-6]);
  fs.push([494,436,468,540,'#2e2116',3.4,0.38,-6]);
  fs.push([694,434,724,538,'#241a10',4,0.45,6]);
  fs.push([706,434,732,538,'#2e2116',3,0.38,6]);

  for(const s of fs) out.push(PS(s[0],s[1],s[2],s[3],s[4],s[5],s[6],s[7]));
  layer('features',out);
}
/* ---- 13. VEIL (diaphanous strokes over the hair top and shoulders) ---- */
{
  const out=[];
  for(let i=0;i<300;i++){
    const top=R(0,1);
    let x,y;
    if(top<0.55){
      const p=ellipseSample(600,430,158,168,0.2,0.95);
      x=p[0];y=p[1];
    }else{
      x=R(430,770);y=R(640,890);
    }
    if(inEll(x,y,600,470,88,118))continue;
    out.push(P(x,y,x+(x-600)*0.22+R(-14,14),y+R(40,110),pick(VEIL),R(3,7),R(0.1,0.2)));
  }
  for(let i=0;i<60;i++){
    const x=R(470,545)+R(-6,6), y=R(380,560);
    out.push(P(x,y,x+R(-20,10),y+R(50,110),pick(VEIL_H),R(2,4),R(0.12,0.2)));
  }
  for(let i=0;i<60;i++){
    const x=R(655,730)+R(-6,6), y=R(380,560);
    out.push(P(x,y,x+R(-10,20),y+R(50,110),pick(VEIL_H),R(2,4),R(0.12,0.2)));
  }
  layer('veil',out);
}
/* ---- 14. FOLDED HANDS on the armrest (lower right, one over the other) ---- */
{
  const out=[];
  // back of the lower (left) hand
  out.push(flowPass({
    count:110,
    sample:()=>ellipseSample(738,1318,58,30,0.15,0.96),
    inside:(x,y)=>inEll(x,y,738,1318,58,30),
    dirAt:()=>[0.8+R(-0.25,0.25),0.35],
    color:()=>pick(FACE_BASE),
    lenMin:12,lenMax:30,wMin:3.5,wMax:6,oMin:0.3,oMax:0.5
  }).join(''));
  // upper (right) hand with fingers
  out.push(flowPass({
    count:110,
    sample:()=>ellipseSample(774,1272,50,26,0.12,0.95),
    inside:(x,y)=>inEll(x,y,774,1272,50,26),
    dirAt:()=>[0.8+R(-0.2,0.2),0.4],
    color:()=>pick(FACE_BASE.concat(FACE_MID)),
    lenMin:12,lenMax:30,wMin:3.5,wMax:6,oMin:0.3,oMax:0.5
  }).join(''));
  // finger strokes of the upper hand
  for(let f=0;f<4;f++){
    for(let i=0;i<8;i++){
      const x0=796+f*13, y0=1270+f*4;
      const x=x0+R(-3,3), y=y0+R(-2,3);
      out.push(P(x,y,x+R(30,40),y+R(30,44),pick(FACE_MID.concat(FACE_BASE)),R(2.8,4.6),R(0.3,0.5)));
    }
  }
  // shadows between the fingers
  for(let f=0;f<3;f++){
    const x0=803+f*13, y0=1272+f*4;
    for(let i=0;i<6;i++){
      out.push(P(x0+R(-1,2),y0+R(-2,4),x0+R(28,36),y0+R(30,42),pick(FACE_DARK),R(1.6,2.8),R(0.28,0.44)));
    }
  }
  // knuckle & edge highlights
  for(let i=0;i<40;i++){
    const p=ellipseSample(760,1296,56,30,0.2,0.97);
    out.push(P(p[0],p[1],p[0]+R(-4,4),p[1]+R(6,14),pick(FACE_LIT),R(1.8,3.2),R(0.22,0.38)));
  }
  // outer contour shade
  for(let i=0;i<30;i++){
    const p=ellipseSample(738,1318,60,32,0.9,0.99);
    out.push(P(p[0],p[1],p[0]+R(-5,5),p[1]+R(6,16),pick(FACE_DARK),R(2,4),R(0.24,0.4)));
  }
  // sleeve cuffs above the wrists
  for(let i=0;i<22;i++){
    const x=R(700,766), y=R(1226,1268);
    out.push(P(x,y,x+R(-8,8),y+R(16,30),pick(['#5c5648','#6a614a','#544e3e']),R(3,5),R(0.32,0.48)));
  }
  for(let i=0;i<18;i++){
    const x=R(788,836), y=R(1210,1252);
    out.push(P(x,y,x+R(-8,8),y+R(16,30),pick(['#5c5648','#6a614a','#544e3e']),R(3,5),R(0.32,0.48)));
  }
  layer('hands',out);
}
/* ---- 15. ARMREST (wooden rail under the hands) ---- */
{
  const out=[];
  for(let i=0;i<150;i++){
    const x=R(652,900), y=R(1410,1560);
    const len=R(90,210);
    out.push(P(x,y,x+len,y+R(-6,7),pick(WOOD),R(5,10),R(0.34,0.54)));
  }
  for(let i=0;i<46;i++){
    const x=R(660,892), y=R(1402,1452);
    out.push(P(x,y,x+R(60,180),y+R(-2,4),pick(['#523d28','#6a4a2e']),R(3,6),R(0.24,0.4)));
  }
  // vertical support post right
  for(let i=0;i<34;i++){
    const x=R(856,884), y=R(1400,1580);
    out.push(P(x,y,x+R(-2,2),y+R(26,74),pick(WOOD),R(4,8),R(0.3,0.5)));
  }
  layer('armrest',out);
}

/* ================= FINAL ATMOSPHERE ================= */
/* ---- 16. glazing passes (very low opacity long strokes that fuse the layers) ---- */
{
  const out=[];
  const inDress=(x,y)=>{
    if(y<760||y>1600)return false;
    const t=Math.min(1,(y-760)/840);
    const l=356+(230-356)*t, r=862+(990-862)*t;
    return x>l&&x<r;
  };
  for(let i=0;i<240;i++){
    const x=R(240,960), y=R(880,1560);
    const len=R(70,180);
    out.push(P(x,y,x+len*R(-0.7,0.7),y+R(-10,10),pick(GLAZE),R(10,26),R(0.04,0.08)));
  }
  for(let i=0;i<70;i++){
    const p=ellipseSample(600,720,320,420,0.15,0.95);
    const x=p[0],y=p[1];
    const len=R(60,150);
    out.push(P(x,y,x+len*R(-0.8,0.8),y+R(-12,12),pick(['#8a7a5e','#7a6a4e']),R(9,22),R(0.045,0.08)));
  }
  // soft glaze over the face region
  for(let i=0;i<90;i++){
    const p=ellipseSample(600,470,110,146,0.1,0.96);
    const len=R(40,100);
    out.push(P(p[0],p[1],p[0]+len*R(-0.6,0.6),p[1]+len*R(-0.3,0.3),pick(['#c7986b','#a97a50']),R(8,17),R(0.05,0.09)));
  }
  layer('glazes',out);
}
/* ---- 17. vignette (darkened edges of the canvas) ---- */
{
  const out=[];
  for(let i=0;i<64;i++){const y=R(0,50);out.push(P(R(0,1200),y,R(0,1200),y+R(16,64),pick(['#6e5d49','#57483a','#5a4c3c']),R(12,28),R(0.06,0.12)));}
  for(let i=0;i<64;i++){const y=R(1548,1600);out.push(P(R(0,1200),y,R(0,1200),y-R(16,64),pick(['#6e5d49','#57483a','#5a4c3c']),R(12,28),R(0.06,0.12)));}
  for(let i=0;i<42;i++){const x=R(0,44);out.push(P(x,R(0,1600),x+R(14,48),R(0,1600),pick(['#6e5d49','#57483a']),R(12,26),R(0.06,0.12)));}
  for(let i=0;i<42;i++){const x=R(1156,1200);out.push(P(x,R(0,1600),x-R(14,48),R(0,1600),pick(['#6e5d49','#57483a']),R(12,26),R(0.06,0.12)));}
  layer('vignette',out);
}
/* ---- 18. painterly sparkle accents (tiny strokes) ---- */
{
  const out=[];
  for(let i=0;i<70;i++){
    const x=R(100,1080), y=R(50,420);
    const a=R(0,Math.PI*2),len=R(2.5,7);
    out.push(P(x,y,x+Math.cos(a)*len,y+Math.sin(a)*len,pick(['#d6ddc8','#c3d0c8','#e2e6d2']),R(1,2.2),R(0.18,0.32)));
  }
  for(let i=0;i<60;i++){
    const x=R(1020,1185), y=R(600,950);
    const a=R(0,Math.PI*2),len=R(2.5,7);
    out.push(P(x,y,x+Math.cos(a)*len,y+Math.sin(a)*len,pick(['#b9d0c2','#9db8ac','#cfe0d0']),R(1,2.2),R(0.15,0.28)));
  }
  for(let i=0;i<40;i++){
    const p=ellipseSample(600,430,150,160,0.3,0.95);
    out.push(P(p[0],p[1],p[0]+R(-3,3),p[1]+R(-2,6),pick(['#4e341d','#583a20']),R(1.4,2.6),R(0.22,0.36)));
  }
  layer('sparkle',out);
}

/* ---------------- assemble ---------------- */
const total=stats.reduce((s,x)=>s+x[1],0);
console.log('layers:',stats.length,' total strokes:',total);
for(const s of stats) console.log(' ',s[0],s[1]);

const head='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">\n'+
'<title>Mona Lisa — procedural brushstroke study (pure vector SVG)</title>\n'+
'<desc>Study after Leonardo da Vinci, Mona Lisa (Louvre, Paris; public domain). Painted entirely with short quadratic-quill strokes in layered passes (glazing / sfumato). No raster content, no external resources, no gradients.</desc>\n'+
'<!-- generated by generator.js, seeded RNG (seed '+SEED+'), '+new Date().toISOString()+' -->\n';
const foot='</svg>\n';
fs.writeFileSync('answer.svg', head+layers.join('\n')+'\n'+foot);
console.log('wrote answer.svg bytes=',fs.statSync('answer.svg').size);