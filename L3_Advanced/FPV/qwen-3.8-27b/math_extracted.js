
/* ---------------- 纯数学层（无 DOM 依赖，可独立单元测试） ---------------- */
const V3={
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len:(a)=>Math.hypot(a[0],a[1],a[2]),
  norm:(a)=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];}
};
/* 3x3 矩阵（行主序存储 m[r*3+c]）。姿态 R ∈ SO(3)。 */
const M3={
  ident:()=>[1,0,0,0,1,0,0,0,1],
  mul(a,b){const o=new Array(9);
    for(let r=0;r<3;r++){const r3=r*3;
      o[r3  ]=a[r3  ]*b[0]+a[r3+1]*b[3]+a[r3+2]*b[6];
      o[r3+1]=a[r3  ]*b[1]+a[r3+1]*b[4]+a[r3+2]*b[7];
      o[r3+2]=a[r3  ]*b[2]+a[r3+1]*b[5]+a[r3+2]*b[8];}
    return o;},
  transp:(a)=>[a[0],a[3],a[6],a[1],a[4],a[7],a[2],a[5],a[8]],
  transv:(a,v)=>[a[0]*v[0]+a[3]*v[1]+a[6]*v[2],
                 a[1]*v[0]+a[4]*v[1]+a[7]*v[2],
                 a[2]*v[0]+a[5]*v[1]+a[8]*v[2]],
  /* 修正 Gram-Schmidt：把矩阵拉回 SO(3)（保持最接近输入的旋转） */
  reorth(R){
    const c0=[R[0],R[3],R[6]],c1=[R[1],R[4],R[7]],c2=[R[2],R[5],R[8]];
    const a0=V3.norm(c0);
    let a1=V3.sub(c1,V3.scale(a0,V3.dot(a0,c1)));a1=V3.norm(a1);
    let a2=V3.sub(c2,V3.scale(a0,V3.dot(a0,c2)));
    a2=V3.sub(a2,V3.scale(a1,V3.dot(a1,a2)));a2=V3.norm(a2);
    return[a0[0],a1[0],a2[0], a0[1],a1[1],a2[1], a0[2],a1[2],a2[2]];
  }
};
function rotX(a){const c=Math.cos(a),s=Math.sin(a);return[1,0,0, 0,c,-s, 0,s,c];}
function rotY(a){const c=Math.cos(a),s=Math.sin(a);return[c,0,s, 0,1,0, -s,0,c];}
function rotZ(a){const c=Math.cos(a),s=Math.sin(a);return[c,-s,0, s,c,0, 0,0,1];}
/* 李代数 so(3)：向量 → 反对称矩阵 [w]× */
function hat(w){return[0,-w[2],w[1], w[2],0,-w[0], -w[1],w[0],0];}
/* so(3) 指数映射（Rodrigues）: exp([w]×) = I + (sinθ/θ)[w]× + ((1−cosθ)/θ²)[w]×² */
function so3Exp(w){
  const th=Math.hypot(w[0],w[1],w[2]);
  const O=hat(w),O2=M3.mul(O,O);
  const out=new Array(9);
  if(th<1e-6){ /* 小角 Taylor: I + [w]× + ½[w]×² */
    for(let i=0;i<9;i++)out[i]=((i===0||i===4||i===8)?1:0)+O[i]+0.5*O2[i];
  }else{
    const s=Math.sin(th)/th,c=(1-Math.cos(th))/(th*th);
    for(let i=0;i<9;i++)out[i]=((i===0||i===4||i===8)?1:0)+O[i]*s+O2[i]*c;
  }
  return M3.reorth(out);
}
/* ---------------- PID ---------------- */
function makePID(){return{i:0,prev:0};}
function pidReset(p){p.i=0;p.prev=0;}
/* 微分在测量值上（避免设定值跳变冲击），积分限幅抗饱和 */
function pidStep(p,gain,target,measured,dt,iMax){
  const e=target-measured;
  p.i+=e*dt; if(p.i>iMax)p.i=iMax; else if(p.i<-iMax)p.i=-iMax;
  const d=(measured-p.prev)/Math.max(dt,1e-6);
  p.prev=measured;
  return gain.kp*e+gain.ki*p.i-gain.kd*d;
}
/* ---------------- 4 电机混合（X 型，前左/前右/后左/后右） ----------------
 * 体轴: +x 前, +y 右, +z 上。电机位: FL(+f,−s) FR(+f,+s) RL(−f,−s) RR(−f,+s)
 * τx=Σpy·t, τy=Σ(−px)·t, τz=Σq·t, q=(+1,−1,−1,+1)·kYaw
 * 求解  (T,τx,τy,τz) → t[4]（含 0..tMax 饱和），并回算真实输出。 */
function mixMotors(T,tx,ty,tz,armX,armY,kYaw,tMax){
  const a=tx/(4*armY),b=ty/(4*armX),c=tz/(4*kYaw);
  const t=[T/4-a-b+c, T/4+a-b-c, T/4-a+b-c, T/4+a+b+c];
  for(let i=0;i<4;i++){t[i]=Math.max(0,Math.min(tMax,t[i]));}
  return{
    t:t,
    T:t[0]+t[1]+t[2]+t[3],
    tx:armY*(-t[0]+t[1]-t[2]+t[3]),
    ty:armX*(-t[0]-t[1]+t[2]+t[3]),
    tz:kYaw*(t[0]-t[1]-t[2]+t[3])
  };
}
/* ---------------- 刚体单步（SO(3) 指数映射积分） ----------------
 * d: {p,v,R,w}   cmd: {torque:[tx,ty,tz] 体帧, T 集体推力}   P: 参数   dt: 步长 */
function physStep(d,cmd,dt,P){
  const I=P.I;
  /* 1) 体帧刚体欧拉方程: I·dω/dt = τ − ω×(Iω) − c·ω */
  const iw=[I[0]*d.w[0],I[1]*d.w[1],I[2]*d.w[2]];
  const cw=V3.cross(d.w,iw);
  const dw=[
    (cmd.torque[0]-cw[0]-P.angDamp*d.w[0])/I[0],
    (cmd.torque[1]-cw[1]-P.angDamp*d.w[1])/I[1],
    (cmd.torque[2]-cw[2]-P.angDamp*d.w[2])/I[2]
  ];
  d.w=[d.w[0]+dw[0]*dt,d.w[1]+dw[1]*dt,d.w[2]+dw[2]*dt];
  /* 2) 姿态演化: 体帧角速度 → R ← R·exp([ω]×dt)（右乘），再正交化 */
  d.R=M3.reorth(M3.mul(d.R,so3Exp([d.w[0]*dt,d.w[1]*dt,d.w[2]*dt])));
  /* 3) 平动: a = R·(0,0,T/m) + (0,0,−g) − (k/m)·|v|·v （二次气体阻尼）
   * 机体 +z 在世界系 = R 的第 2 列 (R[2],R[5],R[8])，世界 +z 向上 */
  const rz=[d.R[2],d.R[5],d.R[8]];
  const vlen=V3.len(d.v);
  const a=[rz[0]*cmd.T/P.m, rz[1]*cmd.T/P.m, rz[2]*cmd.T/P.m - P.g];
  a[0]+=-(P.dragK/P.m)*vlen*d.v[0];
  a[1]+=-(P.dragK/P.m)*vlen*d.v[1];
  a[2]+=-(P.dragK/P.m)*vlen*d.v[2];
  d.v=[d.v[0]+a[0]*dt,d.v[1]+a[1]*dt,d.v[2]+a[2]*dt];
  d.p=[d.p[0]+d.v[0]*dt,d.p[1]+d.v[1]*dt,d.p[2]+d.v[2]*dt];
}
/* 地面碰撞（恢复系数 + 摩擦 + 姿态阻尼） */
function groundCollide(d,dt){
  const zmin=0.14;
  if(d.p[2]<zmin){
    d.p[2]=zmin;
    if(d.v[2]<0)d.v[2]=-d.v[2]*0.25;
    if(Math.abs(d.v[2])<0.15)d.v[2]=0;
    const f=Math.max(0,1-4*dt);
    d.v[0]*=f;d.v[1]*=f;
    const wf=Math.max(0,1-6*dt);
    d.w=[d.w[0]*wf,d.w[1]*wf,d.w[2]*wf];
  }
}

module.exports={V3,M3,rotX,rotY,rotZ,hat,so3Exp,makePID,pidReset,pidStep,mixMotors,physStep,groundCollide};
