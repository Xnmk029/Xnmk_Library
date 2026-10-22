// ---- v7: solve arm reach for 33deg lock AND pick arm inner-pivot Y for IC robustness ----
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>{const l=len(a)||1e-12;return [a[0]/l,a[1]/l,a[2]/l];};
function rotAxis(p,o,u,t){const d=sub(p,o);const c=Math.cos(t),s=Math.sin(t),ud=dot(u,d);
  return[o[0]+d[0]*c+(u[1]*d[2]-u[2]*d[1])*s+u[0]*ud*(1-c),
        o[1]+d[1]*c+(u[2]*d[0]-u[0]*d[2])*s+u[1]*ud*(1-c),
        o[2]+d[2]*c+(u[0]*d[1]-u[1]*d[0])*s+u[2]*ud*(1-c)];}
function rodrigues(k,a){const c=Math.cos(a),s=Math.sin(a),t=1-c;const[x,y,z]=k;
  return[c+x*x*t,x*y*t-z*s,x*z*t+y*s,y*x*t+z*s,c+y*y*t,y*z*t-x*s,z*x*t-y*s,z*y*t+x*s,c+z*z*t];}
const mv=(R,p)=>[R[0]*p[0]+R[1]*p[1]+R[2]*p[2],R[3]*p[0]+R[4]*p[1]+R[5]*p[2],R[6]*p[0]+R[7]*p[1]+R[8]*p[2]];
const deg=r=>r*180/Math.PI;

const KP={lbj:[0.020,0.740,0.200],ubj:[-0.015,0.695,0.480],wc:[0.005,0.760,0.315],dmpLow:[-0.030,0.726,0.415]};
function side(P,sgn){
 const M=v=>[v[0],sgn*v[1],v[2]];
 return{lbj:M(KP.lbj),ubj:M(KP.ubj),wc:M(KP.wc),dmpLow:M(KP.dmpLow),
  tieOut:[KP.lbj[0]+P.armFwd, sgn*(KP.lbj[1]+P.armOut), P.armZ],
  lcaInF:M([0.095,P.lcaInY,0.190]),lcaInR:M([-0.235,P.lcaInY,0.190]),
  ucaInF:M([0.055,P.ucaInY,0.505]),ucaInR:M([-0.145,P.ucaInY,0.505]),
  tieIn:[P.tieInX,sgn*P.tieInY,0.290],strutTop:M([-0.040,0.455,0.880])};
}
function build(G){
 const AXl=norm(sub(G.lcaInF,G.lcaInR)),AXu=norm(sub(G.ucaInF,G.ucaInR));
 const LKN=len(sub(G.ubj,G.lbj)),LTIE=len(sub(G.tieOut,G.tieIn));
 function pose(th){
  const lbj=rotAxis(G.lbj,G.lcaInF,AXl,th);let phi=0,ok=false;
  for(let i=0;i<60;i++){
   const f=len(sub(rotAxis(G.ubj,G.ucaInF,AXu,phi),lbj))-LKN;
   if(Math.abs(f)<1e-12){ok=true;break;}
   const h=1e-5;
   const fp=((len(sub(rotAxis(G.ubj,G.ucaInF,AXu,phi+h),lbj))-LKN)-(len(sub(rotAxis(G.ubj,G.ucaInF,AXu,phi-h),lbj))-LKN))/(2*h);
   if(!isFinite(fp)||fp===0)break;phi-=Math.max(-0.25,Math.min(0.25,f/fp));
  }
  const ubj=rotAxis(G.ubj,G.ucaInF,AXu,phi);
  const a1=norm(sub(G.ubj,G.lbj)),b1=norm(sub(ubj,lbj));
  const d=Math.max(-1,Math.min(1,dot(a1,b1)));
  let R;
  if(d>0.999999)R=[1,0,0,0,1,0,0,0,1];
  else if(d<-0.999999)R=rodrigues(norm(cross(a1,[1,0,0])),Math.PI);
  else{const v=cross(a1,b1);R=rodrigues(norm(v),Math.atan2(len(v),d));}
  const t=sub(lbj,mv(R,G.lbj));
  return{ok,th,phi,lbj,ubj,R,T:p=>add(mv(R,p),t),wc:add(mv(R,G.wc),t),dmpLow:add(mv(R,G.dmpLow),t)};
 }
 function thForDz(dz){let lo=-0.5,hi=0.5;const fz=t=>pose(t).wc[2]-G.wc[2]-dz;
  let flo=fz(lo);if(flo*fz(hi)>0)return NaN;
  for(let i=0;i<64;i++){const m=(lo+hi)/2;const fm=fz(m);if(flo*fm<=0)hi=m;else{lo=m;flo=fm;}}
  return(lo+hi)/2;}
 function ic(P){
  const a0=[(G.lcaInF[1]+G.lcaInR[1])/2,(G.lcaInF[2]+G.lcaInR[2])/2];
  const b0=[(G.ucaInF[1]+G.ucaInR[1])/2,(G.ucaInF[2]+G.ucaInR[2])/2];
  const da=[P.lbj[1]-a0[0],P.lbj[2]-a0[1]],db=[P.ubj[1]-b0[0],P.ubj[2]-b0[1]];
  const den=da[0]*db[1]-da[1]*db[0];
  const sn=Math.abs(den)/(Math.hypot(da[0],da[1])*Math.hypot(db[0],db[1]));
  if(sn<0.01)return{valid:false,rc:NaN,arm:NaN,y:NaN,z:NaN,sn};
  const t=((b0[0]-a0[0])*db[1]-(b0[1]-a0[1])*db[0])/den;
  const y=a0[0]+da[0]*t,z=a0[1]+da[1]*t,arm=Math.abs(y-P.wc[1]);
  return{valid:true,y,z,arm,rc:z*P.wc[1]/arm,sn};
 }
 function steer(P,rack){
  const kp=norm(sub(P.ubj,P.lbj));
  const tieIn=add(G.tieIn,[rack,0,0]);
  const outer=psi=>{const q=P.T(G.tieOut),d=sub(q,P.lbj),c=Math.cos(psi),s=Math.sin(psi),ud=dot(kp,d);
   return add(P.lbj,[d[0]*c+(kp[1]*d[2]-kp[2]*d[1])*s+kp[0]*ud*(1-c),
    d[1]*c+(kp[2]*d[0]-kp[0]*d[2])*s+kp[1]*ud*(1-c),d[2]*c+(kp[0]*d[1]-kp[1]*d[0])*s+kp[2]*ud*(1-c)]);};
  let psi=0;
  for(let i=0;i<=60;i++){const f=len(sub(outer(psi),tieIn))-LTIE;
   if(!isFinite(f))break;if(Math.abs(f)<1e-12)break;const h=1e-5;
   const fp=(len(sub(outer(psi+h),tieIn))-len(sub(outer(psi-h),tieIn)))/(2*h);
   if(!isFinite(fp)||fp===0)break;psi-=Math.max(-0.2,Math.min(0.2,f/fp));}
  const R=rodrigues(kp,psi);
  const n=mv(R,mv(P.R,[0,1,0])),f2=mv(R,mv(P.R,[1,0,0]));
  return{psi:deg(psi),camber:deg(Math.asin(Math.max(-1,Math.min(1,n[2])))),toe:deg(Math.atan2(f2[1],f2[0]))};
 }
 return{pose,thForDz,ic,steer,LTIE,LKN};
}
const P0={armFwd:0.18,armOut:0.0,armZ:0.252,tieInX:0.14,tieInY:0.36,lcaInY:0.30,ucaInY:0.415};

console.log('=== 1) arm reach for 33deg @75mm rack (shorter perpendicular radius) ===');
for(const f of [0.05,0.07,0.09,0.11,0.13]){
 for(const o of [0.0,0.05]){
  const P={...P0,armFwd:f,armOut:o};
  const M=build(side(P,1));
  const a=M.steer(M.pose(0),0.075);
  const kp=norm(sub(KP.ubj,KP.lbj));
  const av=[f,o,0.052];const pr=len(sub(av,mul(kp,dot(av,kp))));
  console.log('fwd',f.toFixed(2),'out',o.toFixed(2),'perpR',pr.toFixed(3),'tie',M.LTIE.toFixed(3),'lock@75',a.psi.toFixed(2));
 }
}
console.log('\n=== 2) IC robustness: min sin(angle) over travel, vs arm inner Y ===');
for(const ly of [0.26,0.30,0.34]){
 for(const uy of [0.36,0.415,0.47]){
  const P={...P0,armFwd:0.09,armOut:0.03,lcaInY:ly,ucaInY:uy};
  const M=build(side(P,1));
  let minSn=1e9,rc0=NaN,ok=true;
  for(let mm=-100;mm<=100;mm+=5){
   const th=M.thForDz(mm/1000);
   if(!isFinite(th)){ok=false;break;}
   const i=M.ic(M.pose(th));
   if(!i.valid){ok=false;break;}
   minSn=Math.min(minSn,i.sn);
   if(mm===0)rc0=i.rc;
  }
  console.log('lcaInY',ly,'ucaInY',uy,'minSin',minSn.toFixed(4),'RC(0)mm',(rc0*1000).toFixed(0),ok?'OK':'DIVERGE');
 }
}
