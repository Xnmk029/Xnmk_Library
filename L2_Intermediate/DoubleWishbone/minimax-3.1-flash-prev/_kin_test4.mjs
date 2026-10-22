// ---- v4: solve steering arm radius for real lock; explicit L/R Ackermann; guarded IC ----
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
const deg=r=>r*180/Math.PI, rad=d=>d*Math.PI/180;

const CH={  // chassis hard points, left side, body frame: +x fwd, +y left, +z up
 lcaInF:[0.095,0.300,0.190],lcaInR:[-0.235,0.300,0.190],
 ucaInF:[0.055,0.415,0.505],ucaInR:[-0.145,0.415,0.505],
 tieIn:[-0.090,0.360,0.290],strutTop:[-0.040,0.455,0.880]};
const KP0={lbj:[0.020,0.740,0.200],ubj:[-0.015,0.695,0.480],wc:[0.005,0.760,0.315],dmpLow:[-0.030,0.726,0.415]};

function mk(side,armR,armAngL,armAngR,armZ){
 // side: +1 left (y>0), -1 right. armAng measured from +x toward outboard, deg.
 const sgn=side;
 const ang=rad(sgn>0?armAngL:armAngR);
 const kp0=norm(sub(KP0.ubj,KP0.lbj));
 // build tieOut: perpendicular offset from kingpin axis, in wheel plane
 // base direction forward(+x) with slight outboard tilt
 let dir=[Math.cos(ang)*sgn*-1*0+Math.cos(ang), 0,0]; // keep x positive
 dir=[Math.abs(Math.cos(ang)), 0,0];
 // vector from lbj: forward `cos`, outboard `sin`
 const v=[Math.cos(ang), sgn*Math.sin(ang), 0];
 // project out the kingpin-axis component
 let w=sub(v,mul(kp0,dot(v,kp0)));
 w=norm(w);
 const tieOut=add(KP0.lbj,mul(w,armR));
 // set vertical: lift the arm tip to armZ height
 const tieOut2=[tieOut[0],tieOut[1],armZ];
 const G={...CH,lbj:KP0.lbj,ubj:KP0.ubj,wc:KP0.wc,dmpLow:KP0.dmpLow,tieOut:tieOut2};
 G.lcaInF=[CH.lcaInF[0],sgn*CH.lcaInF[1],CH.lcaInF[2]];
 G.lcaInR=[CH.lcaInR[0],sgn*CH.lcaInR[1],CH.lcaInR[2]];
 G.ucaInF=[CH.ucaInF[0],sgn*CH.ucaInF[1],CH.ucaInF[2]];
 G.ucaInR=[CH.ucaInR[0],sgn*CH.ucaInR[1],CH.ucaInR[2]];
 G.tieIn=[CH.tieIn[0],sgn*CH.tieIn[1],CH.tieIn[2]];
 G.strutTop=[CH.strutTop[0],sgn*CH.strutTop[1],CH.strutTop[2]];
 return G;
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
  const sn=Math.abs(den)/(Math.hypot(...da)*Math.hypot(...db));
  if(sn<0.02)return{valid:false,y:NaN,z:NaN,arm:NaN,rc:NaN};
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

// find arm radius giving target lock at target rack travel (bisect)
function solveArm(angL,angR,targetDeg,rackMM){
 const target=targetDeg*Math.PI/180;
 let lo=0.05,hi=0.30;
 for(let i=0;i<50;i++){
  const m=(lo+hi)/2;
  const G=mk(1,m,angL,angR,0.252);
  const M=build(G);
  const a=M.steer(M.pose(0),rackMM/1000);
  if(Math.abs(a.psi)<target)lo=m;else hi=m;
 }
 return(lo+hi)/2;
}
console.log('=== arm radius for 34deg lock @ 75mm rack (Ackermann angles 12/16 deg) ===');
for(const [aL,aR] of [[12,16],[10,18],[14,20],[12,12]]){
 const r=solveArm(aL,aR,34,75);
 const GL=mk(1,r,aL,aR,0.252),GR=mk(-1,r,aL,aR,0.252);
 const ML=build(GL),MR=build(GR);
 const kp=norm(sub(GL.ubj,GL.lbj));
 const av=sub(GL.tieOut,GL.lbj),eff=len(sub(av,mul(kp,dot(av,kp))));
 console.log('angL',aL,'angR',aR,'armR',r.toFixed(4),'eff',eff.toFixed(4),'tieL',ML.LTIE.toFixed(4),'tieR',MR.LTIE.toFixed(4));
 for(const mm of [0,40,75,-75]){
  const a=ML.steer(ML.pose(0),mm/1000),b=MR.steer(MR.pose(0),mm/1000);
  console.log('   rack',String(mm).padStart(4),'L psi',a.psi.toFixed(2).padStart(7),'R psi',b.psi.toFixed(2).padStart(7),
   'ackDiff(deg)',(Math.abs(a.psi)-Math.abs(b.psi)).toFixed(3));
 }
}
console.log('\n=== final geometry check: suspension sweep with chosen arm ===');
const rF=solveArm(12,16,34,75);
const GL=mk(1,rF,12,16,0.252);
const M=build(GL);
console.log('tieOut',GL.tieOut.map(v=>v.toFixed(4)).join(', '),'tieLen',M.LTIE.toFixed(4));
console.log('dz    camber   toe     MR     scrub  KPI   RC(mm)');
for(let mm=-100;mm<=100;mm+=10){
 const dz=mm/1000,th=M.thForDz(dz),P=M.pose(th);
 const cam=deg(Math.asin(Math.max(-1,Math.min(1,mv(P.R,[0,1,0])[2]))));
 const toe=deg(Math.atan2(mv(P.R,[1,0,0])[1],mv(P.R,[1,0,0])[0]));
 const s1=len(sub(P.dmpLow,GL.strutTop)),s2=len(sub(M.pose(M.thForDz(dz+0.005)).dmpLow,GL.strutTop));
 const MRr=-(s2-s1)/0.005;
 const kp=norm(sub(P.ubj,P.lbj)),t=(0-P.lbj[2])/kp[2];
 const sc=len(sub(add(P.lbj,mul(kp,t)),[P.wc[0],P.wc[1],0]))*1000;
 const i=M.ic(P);
 console.log(String(mm).padStart(4),cam.toFixed(3).padStart(8),toe.toFixed(3).padStart(7),MRr.toFixed(3).padStart(6),
  sc.toFixed(1).padStart(7),deg(Math.atan2(-kp[1],kp[2])).toFixed(2).padStart(6),
  (i.valid?(i.rc*1000).toFixed(0):'--').padStart(7),P.ok?'':'FAIL');
}
