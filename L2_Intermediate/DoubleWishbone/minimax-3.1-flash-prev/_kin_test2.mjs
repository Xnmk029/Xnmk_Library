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
  return [c+x*x*t,x*y*t-z*s,x*z*t+y*s,y*x*t+z*s,c+y*y*t,y*z*t-x*s,z*x*t-y*s,z*y*t+x*s,c+z*z*t];}
const mv=(R,p)=>[R[0]*p[0]+R[1]*p[1]+R[2]*p[2],R[3]*p[0]+R[4]*p[1]+R[5]*p[2],R[6]*p[0]+R[7]*p[1]+R[8]*p[2]];
const deg=r=>r*180/Math.PI;

function build(G){
 const AXl=norm(sub(G.lcaInF,G.lcaInR)), AXu=norm(sub(G.ucaInF,G.ucaInR));
 const LKN=len(sub(G.ubj,G.lbj)), LTIE=len(sub(G.tieOut,G.tieIn));
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
  const a1=norm(sub(G.ubj,G.lbj)),b1=norm(sub(ubj,lbj));
  const d=Math.max(-1,Math.min(1,dot(a1,b1)));
  let R; if(d>0.999999)R=[1,0,0,0,1,0,0,0,1];
  else if(d<-0.999999)R=rodrigues(norm(cross(a1,[1,0,0])),Math.PI);
  else{const v=cross(a1,b1);R=rodrigues(norm(v),Math.atan2(len(v),d));}
  const t=sub(lbj,mv(R,G.lbj));
  return {ok,th,phi,lbj,ubj,R,T:p=>add(mv(R,p),t),
   wc:add(mv(R,G.wc),t),dmpLow:add(mv(R,G.dmpLow),t),
   lcaInF:G.lcaInF,lcaInR:G.lcaInR,ucaInF:G.ucaInF,ucaInR:G.ucaInR};
 }
 function thForDz(dz){let lo=-0.5,hi=0.5;const fz=t=>pose(t).wc[2]-G.wc[2]-dz;
  let flo=fz(lo);if(flo*fz(hi)>0)return NaN;
  for(let i=0;i<60;i++){const m=(lo+hi)/2;const fm=fz(m);if(flo*fm<=0)hi=m;else{lo=m;flo=fm;}}
  return (lo+hi)/2;}
 function icYZ(P){ // front-view: intersect lower-arm & upper-arm centrelines in Y-Z
  const p1=[P.lbj[1],P.lbj[2]], d1=[0,0];
  // use the arm lines: lower = lcaInF -> lbj ; upper = ucaInF -> ubj  (take nearest inner pivot)
  const a0=[P.lcaInF[1],P.lcaInF[2]], a1p=[P.lcaInR[1],P.lcaInR[2]];
  const b0=[P.ucaInF[1],P.ucaInF[2]], b1p=[P.ucaInR[1],P.ucaInR[2]];
  const PA=[(a0[0]+a1p[0])/2,(a0[1]+a1p[1])/2], DA=[P.lbj[1]-PA[0],P.lbj[2]-PA[1]];
  const PB=[(b0[0]+b1p[0])/2,(b0[1]+b1p[1])/2], DB=[P.ubj[1]-PB[0],P.ubj[2]-PB[1]];
  const den=DA[0]*DB[1]-DA[1]*DB[0];
  if(!isFinite(den)||Math.abs(den)<1e-9)return null;
  const t=((PB[0]-PA[0])*DB[1]-(PB[1]-PA[1])*DB[0])/den;
  return {y:PA[0]+DA[0]*t, z:PA[1]+DA[1]*t, den};
 }
 function steer(P,rack){
  const kp=norm(sub(P.ubj,P.lbj));
  const tieIn=add(G.tieIn,[rack,0,0]);
  const outer=psi=>{const q=P.T(G.tieOut),d=sub(q,P.lbj),c=Math.cos(psi),s=Math.sin(psi),ud=dot(kp,d);
   return add(P.lbj,[d[0]*c+(kp[1]*d[2]-kp[2]*d[1])*s+kp[0]*ud*(1-c),
    d[1]*c+(kp[2]*d[0]-kp[0]*d[2])*s+kp[1]*ud*(1-c),d[2]*c+(kp[0]*d[1]-kp[1]*d[0])*s+kp[2]*ud*(1-c)]);};
  let psi=0;
  for(let i=0;i<50;i++){const f=len(sub(outer(psi),tieIn))-LTIE;
   if(Math.abs(f)<1e-12)break;const h=1e-5;
   const fp=(len(sub(outer(psi+h),tieIn))-len(sub(outer(psi-h),tieIn)))/(2*h);
   if(!isFinite(fp)||fp===0)break;psi-=Math.max(-0.2,Math.min(0.2,f/fp));}
  const R=rodrigues(kp,psi);
  const n=mv(R,mv(P.R,[0,1,0])), f2=mv(R,mv(P.R,[1,0,0]));
  return {psi:deg(psi),camber:deg(Math.asin(Math.max(-1,Math.min(1,n[2])))),toe:deg(Math.atan2(f2[1],f2[0]))};
 }
 return {pose,thForDz,icYZ,steer,LTIE,LKN};
}
const base={
 lcaInF:[0.095,0.300,0.190],lcaInR:[-0.235,0.300,0.190],
 ucaInF:[0.055,0.415,0.505],ucaInR:[-0.145,0.415,0.505],
 tieIn:[-0.050,0.360,0.290],strutTop:[-0.040,0.455,0.880],
 lbj:[0.020,0.740,0.200],ubj:[-0.015,0.695,0.480],
 wc:[0.005,0.760,0.315],tieOut:[0.225,0.610,0.250],dmpLow:[-0.030,0.726,0.415]};

console.log('=== IC debug (v2 front-view construction) ===');
{
 const M=build(base);
 for(const mm of [0,50,100,-50]){
  const th=M.thForDz(mm/1000),P=M.pose(th),ic=M.icYZ(P);
  const rollArm=Math.abs(ic.y-P.wc[1]);
  const rcH=0.760*(ic.z)/rollArm;   // roll centre height, side-view construction
  console.log(mm,'IC y=',ic.y.toFixed(3),'z=',ic.z.toFixed(3),'rollArm=',rollArm.toFixed(3),'RC height=',(rcH*1000).toFixed(0),'mm');
 }
}
console.log('\n=== steering arm sweep: need ~30-33deg at +-100mm rack ===');
for(const tieOut of [[0.225,0.610,0.250],[0.290,0.585,0.240],[0.330,0.560,0.235],[0.365,0.545,0.230],[0.290,0.560,0.255],[0.330,0.530,0.245]]){
 const G={...base,tieOut};
 const M=build(G);
 const kp=norm(sub(G.ubj,G.lbj));
 const av=sub(G.tieOut,G.lbj), eff=len(sub(av,mul(kp,dot(av,kp))));
 const s=M.steer(M.pose(0),0.100);
 console.log('tieOut',JSON.stringify(tieOut),'arm_eff',eff.toFixed(3),'tieLen',M.LTIE.toFixed(3),'-> psi@100mm',s.psi.toFixed(2),'toe',s.toe.toFixed(2));
}
console.log('\n=== cross-check: same rack, L vs R wheel (mirror Y) ===');
{
 const M=build({...base,tieOut:[0.330,0.560,0.235]});
 for(const mm of [0,50,100,-50,-100]){
  const L=M.steer(M.pose(0),mm/1000);
  // mirrored right wheel: y -> -y, rack moves +x too
  const G={...base,tieOut:[0.330,-0.560,0.235],lbj:[0.020,-0.740,0.200],ubj:[-0.015,-0.695,0.480],wc:[0.005,-0.760,0.315],tieIn:[-0.050,-0.360,0.290],lcaInF:[0.095,-0.300,0.190],lcaInR:[-0.235,-0.300,0.190],ucaInF:[0.055,-0.415,0.505],ucaInR:[-0.145,-0.415,0.505]};
  const M2=build(G);
  const R2=M2.steer(M2.pose(0),mm/1000);
  console.log('rack',mm,'L psi',L.psi.toFixed(2),'L toe',L.toe.toFixed(2),' R psi',R2.psi.toFixed(2),'R toe',R2.toe.toFixed(2));
 }
}
