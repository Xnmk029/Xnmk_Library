// ---- v5 FINAL: corrected steering arm direction, per-side Ackermann, guarded IC ----
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
  return[c+x*x*t,x*y*t-z*s,x*z+t*0,y*x*t+z*s,c+y*y*t,y*z*t-x*s,z*x*t-y*s,z*y*t+x*s,c+z*z*t];}
const mv=(R,p)=>[R[0]*p[0]+R[1]*p[1]+R[2]*p[2],R[3]*p[0]+R[4]*p[1]+R[5]*p[2],R[6]*p[0]+R[7]*p[1]+R[8]*p[2]];
const deg=r=>r*180/Math.PI,rad=d=>d*Math.PI/180;

const KP={lbj:[0.020,0.740,0.200],ubj:[-0.015,0.695,0.480],wc:[0.005,0.760,0.315],dmpLow:[-0.030,0.726,0.415]};
// arm tip expressed in the knuckle design frame: forward reach, outboard reach, height
function side(sgn,armFwd,armOut,armZ){
 const g={};
 const M=(v)=>[v[0],sgn*v[1],v[2]];
 g.lbj=M(KP.lbj);g.ubj=M(KP.ubj);g.wc=M(KP.wc);g.dmpLow=M(KP.dmpLow);
 g.tieOut=[KP.lbj[0]+armFwd, sgn*(KP.lbj[1]+armOut), armZ];
 g.lcaInF=M([0.095,0.300,0.190]);g.lcaInR=M([-0.235,0.300,0.190]);
 g.ucaInF=M([0.055,0.415,0.505]);g.ucaInR=M([-0.145,0.415,0.505]);
 g.tieIn=[-0.090,sgn*0.360,0.290];
 g.strutTop=M([-0.040,0.455,0.880]);
 return g;
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
  if(sn<0.015)return{valid:false,y:NaN,z:NaN,arm:NaN,rc:NaN};
  const t=((b0[0]-a0[0])*db[1]-(b0[1]-a0[1])*db[0])/den;
  const y=a0[0]+da[0]*t,z=a0[1]+da[1]*t,arm=Math.abs(y-P.wc[1]);
  return{valid:true,y,z,arm,rc:z*P.wc[1]/arm};
 }
 function steer(P,rack){
  const kp=norm(sub(P.ubj,P.lbj));
  const tieIn=add(G.tieIn,[rack,0,0]);
  const outer=psi=>{const q=P.T(G.tieOut),d=sub(q,P.lbj),c=Math.cos(psi),s=Math.sin(psi),ud=dot(kp,d);
   return add(P.lbj,[d[0]*c+(kp[1]*d[2]-kp[2]*d[1])*s+kp[0]*ud*(1-c),
    d[1]*c+(kp[2]*d[0]-kp[0]*d[2])*s+kp[1]*ud*(1-c),d[2]*c+(kp[0]*d[1]-kp[1]*d[0])*s+kp[2]*ud*(1-c)]);};
  let psi=0;
  for(let i=0;i<60;i++){const f=len(sub(outer(psi),tieIn))-LTIE;
   if(!isFinite(f))break;if(Math.abs(f)<1e-12)break;const h=1e-5;
   const fp=(len(sub(outer(psi+h),tieIn))-len(sub(outer(psi-h),tieIn)))/(2*h);
   if(!isFinite(fp)||fp===0)break;psi-=Math.max(-0.2,Math.min(0.2,f/fp));}
  const R=rodrigues(kp,psi);
  const n=mv(R,mv(P.R,[0,1,0])),f2=mv(R,mv(P.R,[1,0,0]));
  return{psi:deg(psi),camber:deg(Math.asin(Math.max(-1,Math.min(1,n[2])))),toe:deg(Math.atan2(f2[1],f2[0]))};
 }
 return{pose,thForDz,ic,steer,LTIE,LKN};
}
const lockAt=(fwd,out,z,rack)=>{const M=build(side(1,fwd,out,z));return Math.abs(M.steer(M.pose(0),rack).psi);};
console.log('=== arm reach sweep (need ~34deg @ 75mm) ===');
for(const fwd of [0.12,0.15,0.18,0.21,0.24]){
 const row=[];
 for(const out of [0.0,0.03,0.06]){
  row.push(`out${out}=${lockAt(fwd,out,0.252,0.075).toFixed(1)}`);
 }
 console.log('fwd',fwd.toFixed(2),row.join('  '));
}
console.log('\n=== pick final: fwd=0.180 out=0.020 ===');
const FWD=0.180,OUT=0.020,AZ=0.252;
const GL=side(1,FWD,OUT,AZ),GR=side(-1,FWD,OUT,AZ);
const ML=build(GL),MR=build(GR);
console.log('tieOut L',GL.tieOut.map(v=>v.toFixed(4)).join(','),'tieLen',ML.LTIE.toFixed(4));
for(const mm of [0,25,50,75,-50,-75]){
 const a=ML.steer(ML.pose(0),mm/1000),b=MR.steer(MR.pose(0),mm/1000);
 console.log('rack',String(mm).padStart(4),'Lpsi',a.psi.toFixed(2).padStart(7),'Rpsi',b.psi.toFixed(2).padStart(7),
  'ackDiff',(Math.abs(a.psi)-Math.abs(b.psi)).toFixed(3).padStart(7),'ackPct',(100*Math.abs(b.psi)/Math.abs(a.psi)).toFixed(1)+'%');
}
console.log('\n=== per-side Ackermann: vary OUT to split angles (real design lever) ===');
for(const oL of [0.0,0.02,0.04]){
 const oR=0.05;
 const AL=build(side(1,FWD,oL,AZ)),AR=build(side(-1,FWD,oR,AZ));
 const a=AL.steer(AL.pose(0),0.075),b=AR.steer(AR.pose(0),0.075);
 console.log('outL',oL,'outR',oR,'Lpsi',a.psi.toFixed(2),'Rpsi',b.psi.toFixed(2),'split',(Math.abs(a.psi)-Math.abs(b.psi)).toFixed(2));
}
console.log('\n=== FINAL sweep: kinematics + IC ===');
console.log('dz    camber   toe     MR     strut  scrub  KPI   cast  RC(mm)');
for(let mm=-100;mm<=100;mm+=10){
 const dz=mm/1000,th=ML.thForDz(dz),P=ML.pose(th);
 const cam=deg(Math.asin(Math.max(-1,Math.min(1,mv(P.R,[0,1,0])[2]))));
 const toe=deg(Math.atan2(mv(P.R,[1,0,0])[1],mv(P.R,[1,0,0])[0]));
 const s1=len(sub(P.dmpLow,GL.strutTop)),s2=len(sub(ML.pose(ML.thForDz(dz+0.005)).dmpLow,GL.strutTop));
 const MRr=-(s2-s1)/0.005;
 const kp=norm(sub(P.ubj,P.lbj)),t=(0-P.lbj[2])/kp[2];
 const sc=len(sub(add(P.lbj,mul(kp,t)),[P.wc[0],P.wc[1],0]))*1000;
 const i=ML.ic(P);
 console.log(String(mm).padStart(4),cam.toFixed(3).padStart(8),toe.toFixed(3).padStart(7),MRr.toFixed(3).padStart(6),
  s1.toFixed(4).padStart(7),sc.toFixed(1).padStart(7),deg(Math.atan2(-kp[1],kp[2])).toFixed(2).padStart(6),
  deg(Math.atan2(-kp[0],kp[2])).toFixed(2).padStart(6),(i.valid?(i.rc*1000).toFixed(0):'--').padStart(6),P.ok?'':'FAIL');
}
console.log('\n=== spring rates: MR 0.845 -> wheel rate, and strut rate ===');
{
 const MRr=0.845;
 for(const ks of [25,30,35]) console.log('spring',ks,'N/mm -> wheel rate',(ks*MRr*MRr).toFixed(1),'N/mm =',(ks*MRr*MRr).toFixed(0),'N/mm at tyre');
}
