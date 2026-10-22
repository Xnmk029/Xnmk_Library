// ---- geometry tuning: target ~33deg inner lock at +-85mm rack, real Ackermann, stable IC ----
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
function rodrigues(k,a){const c=Math.cos(a),s=Math.sin(a),t=1-c;const[x,y,z]=k;
  return[c+x*x*t,x*y*t-z*s,x*z*t+y*s,y*x*t+z*s,c+y*y*t,y*z*t-x*s,z*x*t-y*s,z*y*t+x*s,c+z*z*t];}
const mv=(R,p)=>[R[0]*p[0]+R[1]*p[1]+R[2]*p[2],R[3]*p[0]+R[4]*p[1]+R[5]*p[2],R[6]*p[0]+R[7]*p[1]+R[8]*p[2]];
const deg=r=>r*180/Math.PI;

function build(G){
 const AXl=norm(sub(G.lcaInF,G.lcaInR)),AXu=norm(sub(G.ucaInF,G.ucaInR));
 const LKN=len(sub(G.ubj,G.lbj)),LTIE=len(sub(G.tieOut,G.tieIn));
 function pose(th){
  const lbj=rotAxis(G.lbj,G.lcaInF,AXl,th);
  let phi=0,ok=false;
  for(let i=0;i<60;i++){
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
  let R;
  if(d>0.999999)R=[1,0,0,0,1,0,0,0,1];
  else if(d<-0.999999)R=rodrigues(norm(cross(a1,[1,0,0])),Math.PI);
  else{const v=cross(a1,b1);R=rodrigues(norm(v),Math.atan2(len(v),d));}
  const t=sub(lbj,mv(R,G.lbj));
  return{ok,th,phi,lbj,ubj,R,T:p=>add(mv(R,p),t),wc:add(mv(R,G.wc),t),
   dmpLow:add(mv(R,G.dmpLow),t),lcaInF:G.lcaInF,lcaInR:G.lcaInR,ucaInF:G.ucaInF,ucaInR:G.ucaInR};
 }
 function thForDz(dz){let lo=-0.5,hi=0.5;const fz=t=>pose(t).wc[2]-G.wc[2]-dz;
  let flo=fz(lo);if(flo*fz(hi)>0)return NaN;
  for(let i=0;i<64;i++){const m=(lo+hi)/2;const fm=fz(m);if(flo*fm<=0)hi=m;else{lo=m;flo=fm;}}
  return(lo+hi)/2;}
 // instant centre: robust 2-line intersection in the Y-Z (front) view, using arm axis lines
 function ic(P){
  const LA=[G.lcaInF,G.lcaInR],UA=[G.ucaInF,G.ucaInR];
  const a0=[(LA[0][1]+LA[1][1])/2,(LA[0][2]+LA[1][2])/2];
  const b0=[(UA[0][1]+UA[1][1])/2,(UA[0][2]+UA[1][2])/2];
  const da=[P.lbj[1]-a0[0],P.lbj[2]-a0[1]],db=[P.ubj[1]-b0[0],P.ubj[2]-b0[1]];
  const den=da[0]*db[1]-da[1]*db[0];
  const scale=Math.hypot(da[0],da[1])*Math.hypot(db[0],db[1]);
  const diverge=Math.abs(den)/scale;              // sin of angle between arms
  if(diverge<2e-3)return{y:NaN,z:NaN,arm:NaN,rc:NaN,diverge};
  const t=((b0[0]-a0[0])*db[1]-(b0[1]-a0[1])*db[0])/den;
  const y=a0[0]+da[0]*t,z=a0[1]+da[1]*t;
  const arm=Math.abs(y-P.wc[1]);
  return{y,z,arm,rc:z*P.wc[1]/arm,diverge};
 }
 function steer(P,rack){
  const kp=norm(sub(P.ubj,P.lbj));
  const tieIn=add(G.tieIn,[rack,0,0]);
  const outer=psi=>{const q=P.T(G.tieOut),d=sub(q,P.lbj),c=Math.cos(psi),s=Math.sin(psi),ud=dot(kp,d);
   return add(P.lbj,[d[0]*c+(kp[1]*d[2]-kp[2]*d[1])*s+kp[0]*ud*(1-c),
    d[1]*c+(kp[2]*d[0]-kp[0]*d[2])*s+kp[1]*ud*(1-c),d[2]*c+(kp[0]*d[1]-kp[1]*d[0])*s+kp[2]*ud*(1-c)]);};
  let psi=0;
  for(let i=0;i<60;i++){const f=len(sub(outer(psi),tieIn))-LTIE;
   if(Math.abs(f)<1e-12)break;const h=1e-5;
   const fp=(len(sub(outer(psi+h),tieIn))-len(sub(outer(psi-h),tieIn)))/(2*h);
   if(!isFinite(fp)||fp===0)break;psi-=Math.max(-0.2,Math.min(0.2,f/fp));}
  const R=rodrigues(kp,psi);
  const n=mv(R,mv(P.R,[0,1,0])),f2=mv(R,mv(P.R,[1,0,0]));
  return{psi:deg(psi),camber:deg(Math.asin(Math.max(-1,Math.min(1,n[2])))),toe:deg(Math.atan2(f2[1],f2[0]))};
 }
 return{pose,thForDz,ic,steer,LTIE,LKN};
}
const mirrorY=G=>{const o={};for(const k in G)o[k]=Array.isArray(G[k])?[G[k][0],-G[k][1],G[k][2]]:G[k];return o;};

const base={
 lcaInF:[0.095,0.300,0.190],lcaInR:[-0.235,0.300,0.190],
 ucaInF:[0.055,0.415,0.505],ucaInR:[-0.145,0.415,0.505],
 tieIn:[-0.050,0.360,0.290],strutTop:[-0.040,0.455,0.880],
 lbj:[0.020,0.740,0.200],ubj:[-0.015,0.695,0.480],
 wc:[0.005,0.760,0.315],tieOut:[0.225,0.610,0.250],dmpLow:[-0.030,0.726,0.415]};

// ---- Ackermann geometry: put the tie-rod inner ends on a rack offset from the kingpin line,
//      and angle the steering arms so the inner wheel turns more. Tune arm length for ~33deg. ----
console.log('=== steering arm x rack-offset sweep (want inner ~33deg @ 85mm) ===');
const cands=[];
for(const arm of [0.16,0.18,0.20,0.22]){
 for(const rackX of [-0.050,-0.090]){
  const toeOut=deg(Math.atan(0.05)); // 2.9deg arm angle for Ackermann
  // tieOut placed at arm length from kingpin axis, in the plane of the wheel, angled
  const toe=2.6*Math.PI/180;
  const G={...base,tieIn:[rackX,0.360,0.290]};
  // tieOut = lbj + rotate a vector about z by -toe (arms point forward-outboard)
  const dx=0.235,dy=-0.150;
  const cs=Math.cos(toe),sn=Math.sin(toe);
  const rx=dx*cs-dy*sn, ry=dx*sn+dy*cs;
  G.tieOut=[G.lbj[0]+rx,G.lbj[1]+ry,G.lbj[2]+0.052];
  const M=build(G),MR=build(mirrorY(G));
  const kp=norm(sub(G.ubj,G.lbj));
  const av=sub(G.tieOut,G.lbj),eff=len(sub(av,mul(kp,dot(av,kp))));
  const inAng=Math.abs(M.steer(M.pose(0),0.085).toe);
  cands.push({arm,rackX,eff,tie:M.LTIE,inAng});
  console.log('armLen',arm,'rackX',rackX,'eff',eff.toFixed(3),'tie',M.LTIE.toFixed(3),'inner@85mm',inAng.toFixed(2));
 }
}
console.log('\n=== IC stability with current arm geometry ===');
{
 const M=build(base);
 for(const mm of [-100,-50,0,50,80,100]){
  const th=M.thForDz(mm/1000),P=M.pose(th),i=M.ic(P);
  console.log(String(mm).padStart(5),'y',i.y.toFixed(3),'z',i.z.toFixed(3),'arm',i.arm.toFixed(3),'RC(mm)',(i.rc*1000).toFixed(0),'div',i.diverge.toFixed(4),P.ok?'':'FAIL');
 }
}
console.log('\n=== full dump for chosen candidate ===');
{
 // pick arm giving ~33deg: solve roughly from sweep output manually
 const G={...base};
 const toe=2.6*Math.PI/180,dx=0.235,dy=-0.150;
 const cs=Math.cos(toe),sn=Math.sin(toe);
 G.tieOut=[G.lbj[0]+dx*cs-dy*sn,G.lbj[1]+dx*sn+dy*cs,G.lbj[2]+0.052];
 G.tieIn=[-0.090,0.360,0.290];
 const M=build(G),MR=build(mirrorY(G));
 console.log('tieOut',G.tieOut.map(v=>v.toFixed(3)).join(','),'tieLen',M.LTIE.toFixed(3));
 for(const mm of [0,40,85,-40,-85]){
  const a=M.steer(M.pose(0),mm/1000),b=MR.steer(MR.pose(0),mm/1000);
  console.log('rack',String(mm).padStart(4),'inner',a.toe.toFixed(2),'outer',(-b.toe).toFixed(2),'ackDiff',(Math.abs(a.toe)-Math.abs(b.toe)).toFixed(2),'psi',a.psi.toFixed(2));
 }
}
