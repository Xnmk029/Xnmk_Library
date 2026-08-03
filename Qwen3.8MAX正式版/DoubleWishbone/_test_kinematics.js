/* Node verification harness — reuses the solver code extracted from index.html. */
"use strict";
const fs=require("fs");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const a=html.indexOf("/* ---------------- vector utils ----------------");
const b=html.indexOf("/* ====",a);
if(a<0||b<0){console.error("marker not found");process.exit(1);}
eval(html.slice(a,b)+"\n;globalThis.__exp={solve,computeSweep,GEO,UPRIGHT_LB,TIE_ROD,KPI0,CASTER0,SWEEP_N,norm,sub};");
const{solve,computeSweep,GEO,UPRIGHT_LB,TIE_ROD,KPI0,CASTER0,SWEEP_N,norm,sub}=globalThis.__exp;

const R2D=180/Math.PI;
let pass=0,fail=0;
function check(name,cond,detail){
  if(cond){pass++;console.log("PASS  "+name+"  "+(detail||""));}
  else{fail++;console.log("FAIL  "+name+"  "+(detail||""));}
}

/* ---- neutral state ---- */
const n=solve(0,0);
console.log("NEUTRAL: camber=%s toe=%s kpi=%s caster=%s scrub=%s spring=%s steer=%s maxErr=%s ok=%s",
  n.camber.toFixed(2),n.toe.toFixed(3),n.kpi.toFixed(2),n.caster.toFixed(2),
  n.scrub.toFixed(1),n.spLen.toFixed(1),(n.d*R2D).toFixed(3),n.maxErr.toFixed(4),n.ok);

/* ---- A1: camber varies continuously with bump ---- */
let camberMono=true,prev=n.camber,span=0,minC=1e9,maxC=-1e9;
for(let bb=-80;bb<=80;bb+=5){
  const s=solve(bb,0);
  if(Math.abs(s.camber-prev)>1)camberMono=false;
  minC=Math.min(minC,s.camber);maxC=Math.max(maxC,s.camber);prev=s.camber;
}
span=maxC-minC;
check("A1 bump->camber continuous & varying",span>0.3&&camberMono,
  `camber range [${minC.toFixed(2)}, ${maxC.toFixed(2)}] deg`);

/* ---- A2: symmetric toe for +/- rack ---- */
const sl=solve(0,60),sr=solve(0,-60);
const toeSym=Math.abs(sl.toe+sr.toe)<0.3&&Math.abs(Math.abs(sl.toe)-Math.abs(sr.toe))<0.3;
check("A2 steering toe symmetric",toeSym,`toe(+60)=${sl.toe.toFixed(3)} toe(-60)=${sr.toe.toFixed(3)}`);
const steerSym=Math.abs(sl.d+sr.d)*R2D<0.4;
check("A2b steer angle symmetric",steerSym,`steer(+60)=${(sl.d*R2D).toFixed(2)} steer(-60)=${(sr.d*R2D).toFixed(2)}`);

/* ---- A3: combined bump+steer bounded, no divergence ---- */
let diverge=false,worst=0;
for(let bb=-80;bb<=80;bb+=10){
  for(const rr of[-60,-30,0,30,60]){
    const s=solve(bb,rr);
    if(!s.ok||s.maxErr>1||Math.abs(s.d*R2D)>50||!isFinite(s.camber+s.toe+s.scrub))diverge=true;
    worst=Math.max(worst,s.maxErr);
  }
}
check("A3 combined bump+steer converges",!diverge,`worst constraint err=${worst.toFixed(4)} mm`);

/* ---- A4: all rigid links keep constant rendered length ---- */
function links(s,rack){
  const rackP=[GEO.RACK0[0]+rack,GEO.RACK0[1],GEO.RACK0[2]];
  return[
    ["lowerF",norm(sub(s.LBJ,GEO.LFp))],["lowerR",norm(sub(s.LBJ,GEO.RFp))],
    ["upperF",norm(sub(s.UBJ,GEO.UFp))],["upperR",norm(sub(s.UBJ,GEO.URp))],
    ["upright",norm(sub(s.UBJ,s.LBJ))],
    ["tieRod",norm(sub(s.ARM,rackP))],
    ["armSeg",norm(sub(s.ARM,s.LBJ))]
  ];
}
const ref=links(solve(0,0),0);
let maxDev=0;
for(let bb=-80;bb<=80;bb+=10){
  for(const rr of[-60,0,60]){
    const L=links(solve(bb,rr),rr);
    L.forEach((l,i)=>{maxDev=Math.max(maxDev,Math.abs(l[1]-ref[i][1]));});
  }
}
check("A4 rigid link lengths constant",maxDev<0.5,`max deviation=${maxDev.toFixed(4)} mm (upright=${UPRIGHT_LB.toFixed(2)}, tieRod=${TIE_ROD.toFixed(2)})`);

/* ---- A5: spring length readout matches rendered seat distance ---- */
let spBad=false;
for(const bb of[-80,-40,0,40,80]){
  const s=solve(bb,0);
  const rendered=norm(sub(GEO.SMT,s.spA));
  if(Math.abs(rendered-s.spLen)>1e-6)spBad=true;
}
const s80=solve(80,0),sm80=solve(-80,0);
check("A5 spring readout==render & varies with travel",!spBad&&Math.abs(s80.spLen-sm80.spLen)>20,
  `spring: bump-80=${sm80.spLen.toFixed(1)} -> bump+80=${s80.spLen.toFixed(1)} mm`);

/* ---- bump steer observable ---- */
const bsUp=solve(60,0),bsDn=solve(-60,0);
check("B1 bump steer observable",Math.abs(bsUp.toe)>0.005||Math.abs(bsDn.toe)>0.005,
  `toe@bump+60=${bsUp.toe.toFixed(4)} toe@bump-60=${bsDn.toe.toFixed(4)} deg`);

/* ---- F3 sweep builds without error ---- */
const sw=computeSweep(30);
check("C1 sweep cluster size",sw.traj.wc.length===SWEEP_N&&sw.ghosts.length>0,
  `samples=${sw.traj.wc.length} ghosts=${sw.ghosts.length}`);

/* ---- travel tracks bump input ---- */
let travOK=true;
for(const bb of[-80,-40,0,40,80]){
  const s=solve(bb,0);
  if(Math.abs(s.bump-bb)>0.5)travOK=false;
}
check("D1 solved travel follows bump input",travOK);

/* ---- KPI/caster near design values ---- */
check("E1 KPI/caster plausible",Math.abs(n.kpi-KPI0)<1.5&&Math.abs(n.caster-CASTER0)<1.5,
  `design KPI=${KPI0.toFixed(2)} caster=${CASTER0.toFixed(2)}`);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
