// ---- prototype validation v2: fixed scrub, Y-Z instant centre, longer steer arm ----
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>{const l=len(a)||1e-12;return [a[0]/l,a[1]/l,a[2]/l];};
function rotAxis(p,o,u,t){const d=sub(p,o);const c=Math.cos(t),s=Math.sin(t),ud=dot(u,d);
  return [o[0]+d[0]*c+(u[1]*d[2]-u[2]*d[1])*s+u[0]*ud*(1-c),
          o[1]+d[1]*c+(u[2]*d[0]-u[0]*d[2])*s+u[1]*ud*(1-c),
          o[2]+d[2]*c+(u[0]*d[1]-u[1]*d[0])*s+u[2]*ud*(1-c)];}
function rodrigues(k,ang){const c=Math.cos(ang),s=Math.sin(ang),t=1-c;const [x,y,z]=k;
  return [c+x*x*t,x*y*t-z*s,x*z*t+y*s, y*x*t+z*s,c+y*y*t,y*z*t-x*s, z*x*t-y*s,z*y*t+x*s,c+z*z*t];}
const mv=(R,p)=>[R[0]*p[0]+R[1]*p[1]+R[2]*p[2],R[3]*p[0]+R[4]*p[1]+R[5]*p[2],R[6]*p[0]+R[7]*p[1]+R[8]*p[2]];
const deg=r=>r*180/Math.PI;

const G={
  lcaInF:[0.095,0.300,0.190], lcaInR:[-0.235,0.300,0.190],
  ucaInF:[0.055,0.415,0.505], ucaInR:[-0.145,0.415,0.505],
  tieIn:[-0.050,0.360,0.290], strutTop:[-0.040,0.455,0.880],
  lbj:[0.020,0.740,0.200], ubj:[-0.015,0.695,0.480],
  wc:[0.005,0.760,0.315], tieOut:[0.225,0.610,0.250], dmpLow:[-0.030,0.726,0.415],
};
const AXl=norm(sub(G.lcaInF,G.lcaInR)), AXu=norm(sub(G.ucaInF,G.ucaInR));
const LKN=len(sub(G.ubj,G.lbj)), LTIE=len(sub(G.tieOut,G.tieIn));
console.log('knuckle',LKN.toFixed(4),'tie',LTIE.toFixed(4),'strut',len(sub(G.strutTop,G.dmpLow)).toFixed(4));
const kp0=norm(sub(G.ubj,G.lbj));
console.log('caster',deg(Math.atan2(-kp0[0],kp0[2])).toFixed(2),'KPI',deg(Math.atan2(-kp0[1],kp0[2])).toFixed(2));
// steering arm effective length (perp to kingpin)
const a=sub(G.tieOut,G.lbj), aPerp=sub(a,mul(kp0,dot(a,kp0)));
console.log('steer arm eff',len(aPerp).toFixed(4));

function pose(th){
  const lbj=rotAxis(G.lbj,G.lcaInF,AXl,th);
  let phi=0,ok=false;
  for(let i=0;i<50;i++){
    const f=len(sub(rotAxis(G.ubj,G.ucaInF,AXu,phi),lbj))-LKN;
    if(Math.abs(f)<1e-12){ok=true;break;}
    const h=1e-5;
    const fp=((len(sub(rotAxis(G.ubj,G.ucaInF,AXu,phi+h),lbj))-LKN)-(len(sub(rotAxis(G.ubj,G.ucaInF,AXu,phi-h),lbj))-LKN))/(2*h);
    if(!isFinite(fp)||fp===0)break;
    phi-=Math.max(-0.25,Math.min(0.25,f/fp));
  }
  const ubj=rotAxis(G.ubj,G.ucaInF,AXu,phi);
  const a1=norm(sub(G.ubj,G.lbj)), b1=norm(sub(ubj,lbj));
  const d=Math.max(-1,Math.min(1,dot(a1,b1)));
  let R; if(d>0.999999)R=[1,0,0,0,1,0,0,0,1];
  else if(d<-0.999999){R=rodrigues(norm(cross(a1,[1,0,0])),Math.PI);}
  else{const v=cross(a1,b1);R=rodrigues(norm(v),Math.atan2(len(v),d));}
  const t=sub(lbj,mv(R,G.lbj));
  return {ok,th,phi,lbj,ubj,R,T:p=>add(mv(R,p),t),
    wc:add(mv(R,G.wc),t),tieOut:add(mv(R,G.tieOut),t),dmpLow:add(mv(R,G.dmpLow),t),
    lcaF:rotAxis(G.lcaInF,G.lcaInF,AXl,th),lcaR:rotAxis(G.lcaInR,G.lcaInF,AXl,th),
    ucaF:rotAxis(G.ucaInF,G.ucaInF,AXu,phi),ucaR:rotAxis(G.ucaInR,G.ucaInF,AXu,phi)};
}
function thForDz(dz){let lo=-0.5,hi=0.5;const fz=t=>pose(t).wc[2]-G.wc[2]-dz;
  let flo=fz(lo);if(flo*fz(hi)>0)return NaN;
  for(let i=0;i<60;i++){const m=(lo+hi)/2;const fm=fz(m);if(flo*fm<=0)hi=m;else{lo=m;flo=fm;}}
  return (lo+hi)/2;}
function icYZ(P){
  const p1=[ (P.lcaF[1]+P.lcaR[1])/2, (P.lcaF[2]+P.lcaR[2])/2 ], d1=[P.lbj[1]-p1[1],P.lbj[2]-p1[2]];
  const p2=[ (P.ucaF[1]+P.ucaR[1])/2, (P.ucaF[2]+P.ucaR[2])/2 ], d2=[P.ubj[1]-p2[1],P.ubj[2]-p2[2]];
  const den=d1[0]*d2[1]-d1[1]*d2[0]; if(Math.abs(den)<1e-9)return null;
  const t=((p2[0]-p1[0])*d2[1]-(p2[1]-p1[1])*d2[0])/den;
  return [p1[0]+d1[0]*t, p1[1]+d1[1]*t];
}
console.log('\ndz    th     phi    camber  toe    strut  MR     scrub  KPI   cast  rollArm');
for(let mm=-110;mm<=110;mm+=10){
  const dz=mm/1000, th=thForDz(dz), P=pose(th);
  const cam=deg(Math.asin(Math.max(-1,Math.min(1,mv(P.R,[0,1,0])[2]))));
  const toeA=deg(Math.atan2(mv(P.R,[1,0,0])[1],mv(P.R,[1,0,0])[0]));
  const s1=len(sub(P.dmpLow,G.strutTop)), s2=len(sub(pose(thForDz(dz+0.005)).dmpLow,G.strutTop));
  const MR=-(s2-s1)/0.005;
  const kp=norm(sub(P.ubj,P.lbj)); const t=(0-P.lbj[2])/kp[2];
  const sc=len(sub(add(P.lbj,mul(kp,t)),[P.wc[0],P.wc[1],0]))*1000;
  const ic=icYZ(P); const arm=ic?Math.abs(ic[0]-P.wc[1]):NaN;
  console.log(String(mm).padStart(4),deg(P.th).toFixed(2).padStart(6),deg(P.phi).toFixed(2).padStart(6),
    cam.toFixed(3).padStart(7),toeA.toFixed(3).padStart(7),s1.toFixed(4).padStart(7),MR.toFixed(3).padStart(6),
    sc.toFixed(1).padStart(7),deg(Math.atan2(-kp[1],kp[2])).toFixed(2).padStart(6),
    deg(Math.atan2(-kp[0],kp[2])).toFixed(2).padStart(6),arm.toFixed(3).padStart(7),P.ok?'':'UNCLOSED');
}
function steer(P,rack){
  const kp=norm(sub(P.ubj,P.lbj));
  const tieIn=add(G.tieIn,[rack,0,0]);
  const outer=psi=>{const q=P.T(G.tieOut),d=sub(q,P.lbj),c=Math.cos(psi),s=Math.sin(psi),ud=dot(kp,d);
    return add(P.lbj,[d[0]*c+(kp[1]*d[2]-kp[2]*d[1])*s+kp[0]*ud*(1-c),
      d[1]*c+(kp[2]*d[0]-kp[0]*d[2])*s+kp[1]*ud*(1-c), d[2]*c+(kp[0]*d[1]-kp[1]*d[0])*s+kp[2]*ud*(1-c)]);};
  let psi=0;
  for(let i=0;i<50;i++){const f=len(sub(outer(psi),tieIn))-LTIE;
    if(Math.abs(f)<1e-12)break;const h=1e-5;
    const fp=(len(sub(outer(psi+h),tieIn))-len(sub(outer(psi-h),tieIn)))/(2*h);
    if(!isFinite(fp)||fp===0)break;psi-=Math.max(-0.2,Math.min(0.2,f/fp));}
  const R=rodrigues(kp,psi);
  const n=mv(R,mv(P.R,[0,1,0])), f2=mv(R,mv(P.R,[1,0,0]));
  return {psi:deg(psi),camber:deg(Math.asin(Math.max(-1,Math.min(1,n[2])))),toe:deg(Math.atan2(f2[1],f2[0]))};
}
console.log('\nrack   psi    toe    camberAck  [with bump travel 50mm]');
for(let mm=0;mm<=100;mm+=20){
  const a=steer(pose(0),mm/1000);
  const Pb=pose(thForDz(0.05)); const ic=icYZ(Pb); const R=ic?Math.abs(ic[0]):NaN;
  const t2=0.760,W=2.60,TK=1.52;
  const inner=Math.abs(a.toe),outer=Math.abs(a.toe); // placeholder
  console.log(String(mm).padStart(4),a.psi.toFixed(2).padStart(7),a.toe.toFixed(3).padStart(7),a.camber.toFixed(3).padStart(7),
    ' Rturn',R.toFixed(2),' idealInner',deg(Math.atan(W/(R-TK/2))).toFixed(2),' idealOuter',deg(Math.atan(W/(R+TK/2))).toFixed(2));
}
console.log('\nleft/right pair (rack +80 -> left steers right):');
for(const mm of [40,80]){
  const sgn=1; const a=steer(pose(0),mm/1000);
  const ic=icYZ(pose(0)); const R=Math.abs(ic[0]); const W=2.60,TK=1.52;
  // left wheel y>0, toe>0 = out; right wheel mirrored -> same toe sign convention
  const dL=Math.abs(a.toe), dR=Math.abs(a.toe);
  console.log(' rack',mm,'psi',a.psi.toFixed(2),'toeAbs',a.toe.toFixed(2),
    'ideal in/out',deg(Math.atan(W/(R-TK/2))).toFixed(2),deg(Math.atan(W/(R+TK/2))).toFixed(2));
}
console.log('\nspring/wheel rate: MR(0)=', (()=>{const P=pose(0);const s1=len(sub(P.dmpLow,G.strutTop));const s2=len(sub(pose(thForDz(0.005)).dmpLow,G.strutTop));return (-(s2-s1)/0.005).toFixed(3);})());
