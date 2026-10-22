/* Headless numeric verification for answer.html.
   Extracts the marker-delimited MATH (SO(3)) and PHYSICS blocks from the
   single-file deliverable and runs closed-form checks against them.        */
import { readFileSync } from 'node:fs';

const doc = readFileSync(new URL('./answer.html', import.meta.url), 'utf-8');
function grab(b,e){
  const i=doc.indexOf(b), j=doc.indexOf(e);
  if(i<0||j<0||j<i) throw new Error('markers missing');
  return doc.slice(i+b.length, j);
}
const mathSrc = grab('/*__MATH_BEGIN__*/','/*__MATH_END__*/');
const physEndTok='/* ============================ INPUT PIPELINE';
const i0=doc.indexOf('/*__PHYS_BEGIN__*/'), i1=doc.indexOf(physEndTok);
if(i0<0||i1<0||i1<i0) throw new Error('phys markers missing');
const physSrc=doc.slice(i0+'/*__PHYS_BEGIN__*/'.length,i1);

const glue =
 'module.exports={v3,vset,vadd,vsub,vscale,vdot,vcross,vlen,vnorm,'+
 'm3ident,m3copy,m3mul,m3mulv,m3col,m3orthonormalize,m3exp,so3Deviation,'+
 'makeDefaults,GRAVITY,makeDroneState,linkQuality,pidAxis,stepDrone,'+
 'channelsToRates,resetDrone,setHOME:function(h){HOME=h;}};';
const mod={exports:{}};
new Function('module','exports',mathSrc+'\n'+physSrc+'\n'+glue)(mod,mod.exports);
const X=mod.exports;

const results=[]; let failures=0;
function check(name, pass, evidence){
  if(!pass) failures++;
  results.push({name,pass,evidence});
  console.log((pass?'PASS':'FAIL')+'  '+name+'   '+evidence);}

/* --- 1. exponential map vs closed-form rotation --------------------------- */
{
  const th=Math.PI/3, w=X.v3(0,2,0), dt=th/2;
  const R=X.m3exp(w,dt,X.m3ident());
  const c=Math.cos(th),s=Math.sin(th);
  const want=[[c,0,s],[0,1,0],[-s,0,c]];
  let e=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++)
    e=Math.max(e,Math.abs(R[i][j]-want[i][j]));
  check('exp-map == analytic Rot_Y(pi/3)', e<1e-13, 'max cell err='+e.toExponential(2));
}
/* --- 2. long-horizon SO(3) integrity under sustained spin ------------------ */
{
  const cfg=X.makeDefaults(), home=[0,0.9,16];
  X.resetDrone(X.makeDroneState(home),home); // define HOME
  const S=X.makeDroneState(home);X.resetDrone(S,home);
  S.armed=false;
  const w=X.v3(97,400,-211), dt=1/240; const tmp=X.m3ident(),prod=X.m3ident();
  let worstO=0,worstD=0;
  for(let k=0;k<120000;k++){
    X.m3exp(w,dt,tmp);X.m3mul(S.R,tmp,prod);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)S.R[i][j]=prod[i][j];
    X.m3orthonormalize(S.R);
    if(k%997===0){const d=X.so3Deviation(S.R);
      worstO=Math.max(worstO,d.orthoErr);worstD=Math.max(worstD,d.detErr);}
  }
  const fin=X.so3Deviation(S.R);
  check('SO(3) integrity after 500 s spin @400 rad/s',
    fin.orthoErr<1e-9&&fin.detErr<1e-9&&worstO<1e-9&&worstD<1e-9,
    'max|RtR-I|='+worstO.toExponential(2)+' max|det-1|='+worstD.toExponential(2)+
    ' over 120000 exponential-map updates');
}
/* --- 3. hover trim: thrust balances weight exactly ------------------------- */
{
  const cfg=X.makeDefaults(), home=[0,0.9,16];
  const S=X.makeDroneState(home);X.resetDrone(S,home);S.armed=true;
  const thr=X.GRAVITY*cfg.phys.mass/cfg.phys.thrustMax;
  const ctrl={thr:thr,tx:X.v3()};
  const y0=S.pos[1];
  for(let k=0;k<480;k++)X.stepDrone(S,cfg,ctrl,1/240);
  const drift=Math.abs(S.pos[1]-y0);
  check('hover trim @ thr=g*m/Tmax (level SO(3) frame)',
    drift<1e-6&&Math.abs(S.vel[1])<1e-6,
    'thr='+thr.toFixed(4)+'  altitude drift='+(drift*1000).toPrecision(3)+' mm over 2 s, vy='+S.vel[1].toExponential(1));
}
/* --- 4. quadratic drag isolated: a_x(0+) = -k|v|^2/m ----------------------- */
{
  const cfg=X.makeDefaults();
  const home=[0,50,16];
  const S=X.makeDroneState(home);X.resetDrone(S,home);S.armed=true;
  S.vel[0]=10;S.vel[1]=0;S.vel[2]=0;
  const ctrl={thr:X.GRAVITY*cfg.phys.mass/cfg.phys.thrustMax,tx:X.v3()};
  X.stepDrone(S,cfg,ctrl,1/240);
  const theory=-cfg.phys.dragK*100/cfg.phys.mass;
  const relErr=Math.abs(S.accx-theory)/Math.abs(theory);
  const ayOk=Math.abs(S.accy)<1e-9, azOk=Math.abs(S.accz)<1e-12;
  check('drag law sample: a_x=-k|v|^2/m',
    relErr<1e-9&&ayOk&&azOk,
    'a_x sim='+S.accx.toFixed(6)+' theory='+theory.toFixed(6)+' rel.err='+relErr.toExponential(2)+' (a_y~0: hover holds gravity)');
}
/* --- 5. acro rate-PID tracks a 1.5 rad/s roll command ---------------------- */
{
  const cfg=X.makeDefaults();
  const home=[0,60,16];
  const S=X.makeDroneState(home);X.resetDrone(S,home);
  S.armed=true;
  const ctrl={thr:0.45,tx:X.v3(0,0,1.5)};
  const hist=[];
  for(let k=0;k<480;k++){X.stepDrone(S,cfg,ctrl,1/240);hist.push(S.om[2]);}
  const tail=hist.slice(-100);
  const mean=tail.reduce((a,b)=>a+b,0)/tail.length;
  const dev=Math.abs(mean-1.5);
  const overshoot=Math.max(...tail)-1.5;
  check('three-axis PID closes the loop onto body-rate setpoint',
    dev<0.05&&Math.abs(overshoot)<0.15,
    'mean om_z(tail 0.42s)='+mean.toFixed(4)+' rad/s (cmd 1.5), err='+dev.toExponential(2)+', overshoot='+overshoot.toExponential(2));
}
/* --- 6. link model monotonic decay + failsafe latch past range -------------- */
{
  const cfg=X.makeDefaults(); const range=cfg.vtx.range;
  let mono=true,last=Infinity;
  for(let d=0;d<=range+40;d+=17){
    const q=X.linkQuality(d,range);
    if(q>last+1e-15)mono=false; last=q;}
  const home=[0,60,16];
  const S=X.makeDroneState(home);X.resetDrone(S,home);
  S.pos[0]=range+25; // > range from home
  X.stepDrone(S,cfg,{thr:0,tx:X.v3()},1/240);
  check('distance-based link decay is monotonic; sig==0 latches FAILSAFE',
    mono&&S.sig===0&&S.failsafe===true&&S.rssi===0,
    'q(range+25)='+S.sig+' failsafe='+S.failsafe+' rssi='+S.rssi+' (range '+range+' m)');
}
/* --- 7. stick channel -> rate setpoint mapping ------------------------------ */
{
  const cfg=X.makeDefaults();
  const tx=X.v3();
  X.channelsToRates({pitch:-1,roll:1,yaw:1,thr:1},cfg,tx);
  const p=cfg.rate.pitch*Math.PI/180, r=cfg.rate.roll*Math.PI/180, yw=cfg.rate.yaw*Math.PI/180;
  const ok=Math.abs(Math.abs(tx[0])-p)<1e-12&&
           Math.abs(Math.abs(tx[2])-r)<1e-12&&
           Math.abs(Math.abs(tx[1])-yw)<1e-12;
  check('channel->body-rate mapping honours configured max rates',
    ok,
    '|tx|=['+Math.abs(tx[0]).toFixed(4)+','+Math.abs(tx[1]).toFixed(4)+','+
    Math.abs(tx[2]).toFixed(4)+'] rad/s vs config ['+(p).toFixed(4)+','+(yw).toFixed(4)+','+(r).toFixed(4)+']');
}
/* --- 8. Gram-Schmidt reorthonormalization repairs injected drift ------------ */
{
  const R=X.m3ident();
  R[0][1]+=3e-6;R[2][2]-=1e-5;R[1][0]+=5e-7;
  const before=X.so3Deviation(R);
  X.m3orthonormalize(R);
  const after=X.so3Deviation(R);
  check('re-orthonormalization restores SO(3) numerically',
    after.orthoErr<1e-13&&after.detErr<1e-13,
    'pre: |RtR-I|='+before.orthoErr.toExponential(1)+
    ' -> post: '+after.orthoErr.toExponential(1));
}

console.log('\n'+results.filter(r=>r.pass).length+'/'+results.length+' checks passed');
process.exit(failures?1:0);
