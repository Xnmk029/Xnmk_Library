/* 验证脚本：从 answer.html 提取纯数学层，做数值单元测试（SO(3)/混合/闭环物理）。
 * 同时把整段 <script> 抽出存为 script_extracted.js 供 `node --check` 语法检查。 */
"use strict";
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'answer.html'),'utf8');

/* 1) 整段脚本语法检查素材 */
const sm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!sm)throw new Error('未找到 <script> 段');
fs.writeFileSync(path.join(__dirname,'script_extracted.js'),sm[1]);

/* 2) 提取纯数学层 */
const m=html.match(/\/\/ ====MATH-START====([\s\S]*?)\/\/ ====MATH-END====/);
if(!m)throw new Error('未找到数学层标记');
const code=m[1];
fs.writeFileSync(path.join(__dirname,'math_extracted.js'),
  code+'\nmodule.exports={V3,M3,rotX,rotY,rotZ,hat,so3Exp,makePID,pidReset,pidStep,mixMotors,physStep,groundCollide};\n');
const M=require('./math_extracted.js');

let pass=0,fail=0;
function T(name,cond,detail){
  if(cond){pass++;console.log('  PASS  '+name);}
  else{fail++;console.log('  FAIL  '+name+(detail?('  :: '+detail):''));}
}
const near=(a,b,eps)=>Math.abs(a-b)<eps;
const m3close=(a,b,eps)=>{for(let i=0;i<9;i++)if(!near(a[i],b[i],eps))return false;return true;};
const vec=(a)=>Math.hypot(a[0],a[1],a[2]);
const finite3=(a)=>isFinite(a[0])&&isFinite(a[1])&&isFinite(a[2]);

console.log('== SO(3) 指数映射 ==');
const I0=M.so3Exp([0,0,0]);
T('exp(0)=I', m3close(I0,[1,0,0,0,1,0,0,0,1],1e-9));
const A=M.so3Exp([0,0,Math.PI/2]);
T('exp(90°z)=Rz(90°)（Rodrigues 一致性）', m3close(A,M.rotZ(Math.PI/2),1e-6));
const Asm=M.so3Exp([1e-4,0,0]);
T('小角 Taylor: R≈I+[w]×', near(Asm[5],-1e-4,1e-9)&&near(Asm[7],1e-4,1e-9));
const R1=M.so3Exp([0.7,-1.3,2.1]);
const Rt=M.M3.mul(R1,M.M3.transp(R1));
let orth=true;
for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(!near(Rt[i*3+j],i===j?1:0,1e-9))orth=false;
T('正交性 R·Rᵀ=I',orth);
const c0=[R1[0],R1[3],R1[6]],c1=[R1[1],R1[4],R1[7]],c2=[R1[2],R1[5],R1[8]];
const det=M.V3.dot(c0,M.V3.cross(c1,c2));
T('det=+1（真旋转，SO(3)）',near(det,1,1e-9));
const prod=M.M3.mul(M.so3Exp([0.3,0,-0.2]),M.so3Exp([0.45,0,-0.3]));
T('同轴合成 exp(a)exp(b)=exp(a+b)', m3close(prod,M.so3Exp([0.75,0,-0.5]),1e-6));
/* 长时积分不漂移：随机角速度 60s，姿态保持正交 */
{
  let R=M.M3.ident();
  const h=1/240;
  for(let i=0;i<60/h;i++){
    const w=[Math.sin(i*0.013)*8,Math.cos(i*0.017)*8,Math.sin(i*0.023)*4];
    R=M.M3.mul(R,M.so3Exp([w[0]*h,w[1]*h,w[2]*h]));
  }
  const Rt2=M.M3.mul(R,M.M3.transp(R));
  let ok=true;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(!near(Rt2[i*3+j],i===j?1:0,1e-6))ok=false;
  T('60s 随机角速度积分后仍 ∈ SO(3)（无漂移）',ok);
}

console.log('== 电机混合（线性解 + 饱和回算） ==');
const mix=M.mixMotors(8.0,0.2,-0.1,0.05,0.16,0.16,0.02,100);
T('混合恢复 T', near(mix.T,8.0,1e-9));
T('混合恢复 τx', near(mix.tx,0.2,1e-9));
T('混合恢复 τy', near(mix.ty,-0.1,1e-9));
T('混合恢复 τz', near(mix.tz,0.05,1e-9));
const mix2=M.mixMotors(4.0,5,5,5,0.16,0.16,0.02,3.0);
T('混合饱和后各电机 ∈ [0,tMax]', mix2.t.every(t=>t>=0&&t<=3.0+1e-12));
T('混合饱和后 T 不超 4·tMax', mix2.T<=4*3.0+1e-9);

console.log('== 受力模型 ==');
{
  const P={m:0.45,g:9.81,I:[0.0045,0.0045,0.009],dragK:0.005,angDamp:0.0004};
  const d={p:[0,0,0.14],v:[0,0,0],R:M.M3.ident(),w:[0,0,0]};
  const Tq=P.m*P.g; /* 悬停推力 */
  for(let i=0;i<240*10;i++)M.physStep(d,{torque:[0,0,0],T:Tq},1/240,P);
  T('悬停：T=mg 时高度稳定', near(d.p[2],0.14,0.01)&&vec(d.v)<0.05, 'z='+d.p[2]);
  T('悬停：无水平漂移', Math.hypot(d.p[0],d.p[1])<0.01);
}
{
  const P={m:0.45,g:0,I:[0.0045,0.0045,0.009],dragK:0.005,angDamp:0};
  const d={p:[0,0,1],v:[10,0,0],R:M.M3.ident(),w:[0,0,0]};
  M.physStep(d,{torque:[0,0,0],T:0},1/240,P);
  const expect=10-((0.005/0.45)*100)*(1/240);
  T('二次气体阻尼 a=−(k/m)|v|v 精确', near(d.v[0],expect,1e-9), 'v='+d.v[0]+' expect='+expect);
}
{
  const P={m:0.45,g:9.81,I:[0.0045,0.0045,0.009],dragK:0,angDamp:0};
  const d={p:[0,0,1],v:[0,0,0],R:M.M3.ident(),w:[0,0,0]};
  M.physStep(d,{torque:[0,0,0],T:0},1/240,P);
  T('重力项 a=−g 精确', near(d.v[2],-9.81/240,1e-12));
}
{
  /* 90° 右滚转后，机体+z（推力方向）应指向世界+y */
  const P={m:0.45,g:0,I:[0.0045,0.0045,0.009],dragK:0,angDamp:0};
  const d={p:[0,0,1],v:[0,0,0],R:M.so3Exp([-Math.PI/2,0,0]),w:[0,0,0]};
  M.physStep(d,{torque:[0,0,0],T:10},1/240,P);
  T('90°右滚后推力沿机体+z（世界+y）',
    near(d.v[1],(10/0.45)/240,1e-9)&&Math.abs(d.v[0])<1e-12&&Math.abs(d.v[2])<1e-12,
    'v='+d.v.map(x=>x.toExponential(3)).join(','));
}

console.log('== 相机映射（渲染边界手性修正，从 answer.html 提取实际常量） ==');
{
  const mmM=html.match(/const MM3=\[([\d\s,\-]+)\];/);
  const cmM=html.match(/const M_CAM=\[([\d\s,\-]+)\];/);
  if(!mmM||!cmM)throw new Error('未在 answer.html 中找到 MM3/M_CAM');
  const MM3=mmM[1].split(',').map(Number);
  const M_CAM=cmM[1].split(',').map(Number);
  const camR=M.M3.mul(MM3,M.M3.mul(M.M3.ident(),M_CAM));
  const prod=M.M3.mul(camR,M.M3.transp(camR));
  let ok=true;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(!near(prod[i*3+j],i===j?1:0,1e-12))ok=false;
  T('相机旋转正交 R·Rᵀ=I',ok);
  const det=M.V3.dot([camR[0],camR[3],camR[6]],M.V3.cross([camR[1],camR[4],camR[7]],[camR[2],camR[5],camR[8]]));
  T('相机旋转 det=+1（真旋转）',near(det,1,1e-12));
  const look=[-camR[2],-camR[5],-camR[8]];
  T('R=I 时相机沿 +x 前向看',near(look[0],1,1e-12)&&near(look[1],0,1e-12)&&near(look[2],0,1e-12));
  const up=[camR[1],camR[4],camR[7]];
  T('R=I 时相机上方向 = +z',near(up[0],0,1e-12)&&near(up[1],0,1e-12)&&near(up[2],1,1e-12));
}

console.log('== Acro 三轴 PID 闭环（体帧欧拉方程 + 混合回灌） ==');
{
  const P={m:0.45,g:9.81,I:[0.0045,0.0045,0.009],dragK:0.005,angDamp:0.0004,yawK:0.02};
  const cfg={
    pid:{roll:{kp:0.030,ki:0.020,kd:0.0006},pitch:{kp:0.030,ki:0.020,kd:0.0006},yaw:{kp:0.016,ki:0.010,kd:0.0005}},
    maxThrust:10.5,maxRate:10,yawMaxRate:6
  };
  const d={p:[0,0,0.14],v:[0,0,0],R:M.M3.ident(),w:[0,0,0]};
  const pids={roll:M.makePID(),pitch:M.makePID(),yaw:M.makePID()};
  const H=1/240;
  function step(h,sr,sp,sy,thr){
    const tR=-sr*cfg.maxRate,tP=-sp*cfg.maxRate,tY=sy*cfg.yawMaxRate;
    let tr=M.pidStep(pids.roll,cfg.pid.roll,tR,d.w[0],h,1.0);
    let tp=M.pidStep(pids.pitch,cfg.pid.pitch,tP,d.w[1],h,1.0);
    let ty=M.pidStep(pids.yaw,cfg.pid.yaw,tY,d.w[2],h,1.0);
    tr=Math.max(-0.8,Math.min(0.8,tr));tp=Math.max(-0.8,Math.min(0.8,tp));ty=Math.max(-0.3,Math.min(0.3,ty));
    const mx=M.mixMotors(thr*cfg.maxThrust,tr,tp,ty,0.16,0.16,0.02,cfg.maxThrust/4*1.4);
    M.physStep(d,{torque:[mx.tx,mx.ty,mx.tz],T:mx.T},h,P);
  }
  const hoverThr=0.45*9.81/10.5;
  for(let i=0;i<240*2;i++)step(H,0,0,0,hoverThr);
  for(let i=0;i<240*3;i++)step(H,1,0,0,hoverThr);
  T('PID 横滚: 阶杆 → ωx 跟踪 −10 rad/s', Math.abs(d.w[0]-(-10))<1.2, 'w='+d.w[0].toFixed(3));
  for(let i=0;i<240*3;i++)step(H,0,0,0.5,hoverThr);
  T('PID 偏航: 阶杆 → ωz 跟踪 +3 rad/s', Math.abs(d.w[2]-3)<0.8, 'w='+d.w[2].toFixed(3));
  /* 闭环稳定性：回中后角速度应收敛到 0 附近 */
  for(let i=0;i<240*4;i++)step(H,0,0,0,hoverThr);
  T('PID 回中：角速度收敛', vec(d.w)<1.0, 'w='+d.w.map(x=>x.toFixed(2)).join(','));
}

console.log('== 鲁棒性：20s 随机输入混沌飞行 ==');
{
  const P={m:0.45,g:9.81,I:[0.0045,0.0045,0.009],dragK:0.005,angDamp:0.0004,yawK:0.02};
  const d={p:[0,0,0.14],v:[0,0,0],R:M.M3.ident(),w:[0,0,0]};
  const pids={roll:M.makePID(),pitch:M.makePID(),yaw:M.makePID()};
  const H=1/240;let okAll=true;
  for(let t=0;t<20;t+=0.5){
    const sr=Math.random()*2-1,sp=Math.random()*2-1,sy=Math.random()*2-1,th=Math.random();
    for(let i=0;i<120;i++){
      const tR=-sr*10,tP=-sp*10,tY=sy*6;
      let tr=M.pidStep(pids.roll,{kp:0.03,ki:0.02,kd:0.0006},tR,d.w[0],H,1.0);
      let tp=M.pidStep(pids.pitch,{kp:0.03,ki:0.02,kd:0.0006},tP,d.w[1],H,1.0);
      let ty=M.pidStep(pids.yaw,{kp:0.016,ki:0.01,kd:0.0005},tY,d.w[2],H,1.0);
      tr=Math.max(-0.8,Math.min(0.8,tr));tp=Math.max(-0.8,Math.min(0.8,tp));ty=Math.max(-0.3,Math.min(0.3,ty));
      const mx=M.mixMotors(th*10.5,tr,tp,ty,0.16,0.16,0.02,10.5/4*1.4);
      M.physStep(d,{torque:[mx.tx,mx.ty,mx.tz],T:mx.T},H,P);
      M.groundCollide(d,H);
      if(!finite3(d.p)||!finite3(d.v)||!finite3(d.w)||!d.R.every(isFinite))okAll=false;
    }
  }
  T('20s 混沌飞行：状态全有限（无 NaN/发散）',okAll);
}

console.log('\nRESULT: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
