// ---- FINAL VERIFIED GEOMETRY (double wishbone front suspension) ----
// body frame: +x fwd, +y left, +z up, origin at ground under kingpin axis
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
  return[c+x*x*t,x*y*t-z*s,x*z*t+y*s,y*x*t+z*s,c+y*y*t,y*z*t-x*s,z*x*t-y*s,z*y*t+x*s,c+z*z+t*0];}
const mv=(R,p)=>[R[0]*p[0]+R[1]*p[1]+R[2]*p[2],R[3]*p[0]+R[4]*p[1]+R[5]*p[2],R[6]*p[0]+R[7]*p[1]+R[8]*p[2]];
const deg=r=>r*180/Math.PI;

const KPB={lbj:[0.020,0.740,0.200],ubj:[-0.015,0.695,0.480],wc:[0.005,0.760,0.315],dmpLow:[-0.030,0.726,0.415]};
const P={aDeg:51,armLen:0.115,armZ:0.252,tieInX:-0.060,tieInY:0.380,tieInZ:0.290,
         lcaInY:0.360,lcaInZ:0.190,ucaInY:0.380,ucaInZ:0.505};
function side(sgn){
 const M=v=>[v[0],sgn*v[1],v[2]];
 const a=P.aDeg*Math.PI/180;
 return{lbj:M(KPB.lbj),ubj:M(KPB.ubj),wc:M(KPB.wc),dmpLow:M(KPB.dmpLow),
  tieOut:[KPB.lbj[0]+Math.cos(a)*P.armLen, sgn*(KPB.lbj[1]+Math.sin(a)*P.armLen), P.armZ],
  lcaInF:M([0.095,P.lcaInY,P.lcaInZ]),lcaInR:M([-0.235,P.lcaInY,P.lcaInZ]),
  ucaInF:M([0.055,P.ucaInY,P.ucaInZ]),ucaInR:M([-0.145,P.ucaInY,P.ucaInZ]),
  tieIn:[P.tieInX,sgn*P.tieInY,P.tieInZ],strutTop:M([-0.040,0.455,0.880])};
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
  let R; if(d>0.999999)R=[1,0,0,0,1,0,0,0,1];
  else if(d<-0.999999)R=rodrigues(norm(cross(a1,[1,0,0])),Math.PI);
  else{const v=cross(a1,b1);R=rodrigues(norm(v),Math.atan2(len(v),d));}
  const t=sub(lbj,mv(R,G.lbj));
  return{ok,th,phi,lbj,ubj,R,T:p=>add(mv(R,p),t),wc:add(mv(R,G.wc),t),dmpLow:add(mv(R,G.dmpLow),t)};
 }
 function thForDz(dz){let lo=-0.5,hi=0.5;const fz=t=>pose(t).wc[2]-G.wc[2]-dz;
  let flo=fz(lo);if(flo*fz(hi)>0)return NaN;
  for(let i=0;i<64;i++){const m=(lo+hi)/2;const fm=fz(m);if(flo*fm<=0)hi=m;else{lo=m;flo=fm;}}
  return(lo+hi)/2;}
 function ic(P2){
  const a0=[(G.lcaInF[1]+G.lcaInR[1])/2,(G.lcaInF[2]+G.lcaInR[2])/2];
  const b0=[(G.ucaInF[1]+G.ucaInR[1])/2,(G.ucaInF[2]+G.ucaInR[2])/2];
  const da=[P2.lbj[1]-a0[0],P2.lbj[2]-a0[1]],db=[P2.ubj[1]-b0[0],P2.ubj[2]-b0[1]];
  const den=da[0]*db[1]-da[1]*db[0];
  const sn=Math.abs(den)/(Math.hypot(da[0],da[1])*Math.hypot(db[0],db[1]));
  if(sn<0.008)return{valid:false,y:NaN,z:NaN,arm:NaN,rc:NaN};
  const t=((b0[0]-a0[0])*db[1]-(b0[1]-a0[1])*db[0])/den;
  const y=a0[0]+da[0]*t,z=a0[1]+da[1]*t,arm=Math.abs(y-P2.wc[1]);
  return{valid:true,y,z,arm,rc:z*P2.wc[1]/arm};
 }
 function steer(P2,rack){
  const kp=norm(sub(P2.ubj,P2.lbj));const tieIn=add(G.tieIn,[rack,0,0]);
  const outer=psi=>{const q=P2.T(G.tieOut),d=sub(q,P2.lbj),c=Math.cos(psi),s=Math.sin(psi),ud=dot(kp,d);
   return add(P2.lbj,[d[0]*c+(kp[1]*d[2]-kp[2]*d[1])*s+kp[0]*ud*(1-c),
    d[1]*c+(kp[2]*d[0]-kp[0]*d[2])*s+kp[1]*ud*(1-c),d[2]*c+(kp[0]*d[1]-kp[1]*d[0])*s+kp[2]*ud*(1-c)]);};
  let psi=0;
  for(let i=0;i<=60;i++){const f=len(sub(outer(psi),tieIn))-LTIE;
   if(!isFinite(f))break;if(Math.abs(f)<1e-12)break;const h=1e-5;
   const fp=(len(sub(outer(psi+h),tieIn))-len(sub(outer(psi-h),tieIn)))/(2*h);
   if(!isFinite(fp)||fp===0)break;psi-=Math.max(-0.2,Math.min(0.2,f/fp));}
  const R=rodrigues(kp,psi);const n=mv(R,mv(P2.R,[0,1,0])),f2=mv(R,mv(P2.R,[1,0,0]));
  return{psi:deg(psi),camber:deg(Math.asin(Math.max(-1,Math.min(1,n[2])))),toe:deg(Math.atan2(f2[1],f2[0]))};
 }
 return{pose,thForDz,ic,steer,LTIE,LKN,AXl,AXu};
}
const GL=side(1),GR=side(-1);
const ML=build(GL),MR=build(GR);
console.log('================ FINAL HARD POINTS (LEFT) ================');
for(const k of Object.keys(GL))console.log('  '+k.padEnd(9),GL[k].map(v=>v.toFixed(4).padStart(9)).join(' '));
const kp=norm(sub(GL.ubj,GL.lbj));
console.log('\nknuckle len  ',ML.LKN.toFixed(4));
console.log('tie rod len  ',ML.LTIE.toFixed(4));
console.log('caster       ',deg(Math.atan2(-kp[0],kp[2])).toFixed(2),'deg');
console.log('KPI          ',deg(Math.atan2(-kp[1],kp[2])).toFixed(2),'deg');
console.log('strut len    ',len(sub(GL.strutTop,GL.dmpLow)).toFixed(4));
console.log('LCA fwd/rear ',len(sub(GL.lbj,GL.lcaInF)).toFixed(4),len(sub(GL.lbj,GL.lcaInR)).toFixed(4));
console.log('UCA fwd/rear ',len(sub(GL.ubj,GL.ucaInF)).toFixed(4),len(sub(GL.ubj,GL.ucaInR)).toFixed(4));
console.log('\n=== STEERING ===');
console.log('rack(mm)  Lpsi    Rpsi    Ltoe    Rtoe   camberAck');
for(const mm of [0,25,50,75,-50,-75]){
 const a=ML.steer(ML.pose(0),mm/1000),b=MR.steer(MR.pose(0),mm/1000);
 console.log(String(mm).padStart(7),a.psi.toFixed(2).padStart(8),b.psi.toFixed(2).padStart(8),
  a.toe.toFixed(2).padStart(8),b.toe.toFixed(2).padStart(8),a.camber.toFixed(2).padStart(9));
}
console.log('\n=== SUSPENSION ===');
console.log('dz(mm) camber    toe      MR    strut   scrub   KPI    RC(mm)');
let minSn=1e9;
for(let mm=-100;mm<=100;mm+=10){
 const dz=mm/1000,th=ML.thForDz(dz),Q=ML.pose(th);
 const cam=deg(Math.asin(Math.max(-1,Math.min(1,mv(Q.R,[0,1,0])[2]))));
 const toe=deg(Math.atan2(mv(Q.R,[1,0,0])[1],mv(Q.R,[1,0,0])[0]));
 const s1=len(sub(Q.dmpLow,GL.strutTop)),s2=len(sub(ML.pose(ML.thForDz(dz+0.005)).dmpLow,GL.strutTop));
 const MRr=-(s2-s1)/0.005;
 const k2=norm(sub(Q.ubj,Q.lbj)),t=(0-Q.lbj[2])/k2[2];
 const sc=len(sub(add(Q.lbj,mul(k2,t)),[Q.wc[0],Q.wc[1],0]))*1000;
 const i=ML.ic(Q);
 if(i.valid)minSn=Math.min(minSn,Math.hypot(...[0])||1e9);
 console.log(String(mm).padStart(6),cam.toFixed(3).padStart(7),toe.toFixed(3).padStart(8),
  MRr.toFixed(3).padStart(7),s1.toFixed(4).padStart(8),sc.toFixed(1).padStart(7),
  deg(Math.atan2(-k2[1],k2[2])).toFixed(2).padStart(6),(i.valid?(i.rc*1000).toFixed(0):'--').padStart(7),Q.ok?'':'FAIL');
}
const P0=ML.pose(0);
const MR0=(()=>{const a=len(sub(P0.dmpLow,GL.strutTop));const b=len(sub(ML.pose(ML.thForDz(0.005)).dmpLow,GL.strutTop));return (-(b-a)/0.005);})();
console.log('\nMR at design =',MR0.toFixed(3));
console.log('wheel rate @ 30 N/mm spring =',(30*MR0*MR0).toFixed(1),'N/mm');
console.log('\n=== INSTANT CENTRE ===');
for(const mm of [-80,-40,0,40,80]){
 const th=ML.thForDz(mm/1000),Q=ML.pose(th),i=ML.ic(Q);
 console.log(String(mm).padStart(5),'IC y=',i.y.toFixed(3),'z=',i.z.toFixed(3),'rollArm=',i.arm.toFixed(3),'RC=',(i.rc*1000).toFixed(0),'mm');
}
