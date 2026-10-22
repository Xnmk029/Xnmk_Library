/* 无头冒烟测试: DOM/Canvas stub + 核心求解/渲染循环验证 */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---- DOM / Canvas stub ---- */
function mkCtx(){
  return new Proxy({}, {
    get(t, p){
      if(p === 'measureText') return () => ({width: 8});
      if(typeof p === 'symbol') return undefined;
      return (...a) => undefined;
    },
    set(){ return true; }
  });
}
global.document = {
  getElementById: () => null,
  createElement: () => ({ getContext: mkCtx, style: {}, width: 0, height: 0, addEventListener: () => {} }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.window = global;
global.requestAnimationFrame = () => 0;

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if(!m){ console.error('FAIL: script not found'); process.exit(1); }
(0, eval)(m[1]);
const DW = globalThis.DW;
if(!DW){ console.error('FAIL: DW api missing'); process.exit(1); }

let failures = 0;
function check(name, ok, detail){
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
  if(!ok) failures++;
}

/* ============ A. 正弦激励连续 4800 帧 ============ */
DW.state.sineB = true; DW.state.sineR = true;
DW.state.ampB = 0.080; DW.state.fB = 0.40; DW.state.fR = 0.13;
let nonFinite = 0, degraded = 0, maxErr = 0;
const rodErr = {};
const times = [];
for(let i=0;i<4800;i++){
  const t0 = performance.now();
  const mod = DW.stepSim(1/60);
  const t1 = performance.now();
  times.push(t1-t0);
  const m2 = DW.state.lastGood;
  if(!m2){ nonFinite++; continue; }
  degraded += DW.state.degraded > 0 && i === 0 ? 0 : 0; // degraded is cumulative
  if(!Number.isFinite(m2.L.WC[2]) || !Number.isFinite(m2.R.WC[2]) || !Number.isFinite(m2.track)) nonFinite++;
  for(const rd of m2.rods){
    if(!Number.isFinite(rd.act) || !Number.isFinite(rd.nom) || !Number.isFinite(rd.err)){ nonFinite++; continue; }
    if(rd.err > 1e-6) { /* record violation */ }
    if(!(rd.name in rodErr)) rodErr[rd.name] = {nom: rd.nom, max: 0};
    rodErr[rd.name].max = Math.max(rodErr[rd.name].max, rd.err);
    maxErr = Math.max(maxErr, rd.err);
  }
}
const avg = a => a.reduce((s,v)=>s+v,0)/a.length;
const first200 = avg(times.slice(0,200)), last200 = avg(times.slice(-200));
console.log('--- A. 4800帧正弦激励 ---');
check('无非有限值', nonFinite === 0, 'nonFinite=' + nonFinite);
check('求解降级计数为0', DW.state.degraded === 0, 'degraded=' + DW.state.degraded);
check('刚性杆误差 < 1e-6 m', maxErr < 1e-6, 'maxErr=' + maxErr.toExponential(3) + ' m');
check('帧时间无异常增长', last200 < first200*3 + 0.05, 'first200=' + first200.toFixed(4) + 'ms last200=' + last200.toFixed(4) + 'ms');
console.log('  平均步进耗时: %.4f ms (首200帧) / %.4f ms (末200帧)', first200, last200);
const rodNames = Object.keys(rodErr);
rodNames.sort((a,b)=>rodErr[b].max-rodErr[a].max);
console.log('  逐杆最大误差 (m), 共' + rodNames.length + '杆:');
for(const n of rodNames) console.log('    ' + n.padEnd(10) + ' nom=' + rodErr[n].nom.toFixed(6) + ' maxErr=' + rodErr[n].max.toExponential(3));

/* ============ B. b×r 输入网格扫描 ============ */
console.log('--- B. b×r 网格扫描 (b步进20mm, r步进15mm) ---');
let solved = 0, unsolved = 0, gridMaxErr = 0, gridDegraded = 0;
for(let b=-80; b<=80; b+=20){
  for(let r=-60; r<=60; r+=15){
    const mm = DW.solveModel(b/1000, r/1000);
    if(!mm){ unsolved++; continue; }
    if(mm.diag.degraded) gridDegraded++;
    let bad = false;
    for(const rd of mm.rods){ if(rd.err > 1e-6) bad = true; gridMaxErr = Math.max(gridMaxErr, rd.err); }
    const nums = [mm.L.camberDeg, mm.L.toeDeg, mm.R.camberDeg, mm.R.toeDeg, mm.L.springLen, mm.track, mm.L.scrub, mm.L.travel];
    if(nums.some(v=>!Number.isFinite(v))) bad = true;
    if(bad) unsolved++; else solved++;
  }
}
const total = 9*9;
check('网格全范围求解收敛', solved === total, solved + '/' + total + ' 收敛, 降级帧=' + gridDegraded + ', 网格最大杆误差=' + gridMaxErr.toExponential(3) + ' m');

/* ============ C. 左右对称转向 r=±30mm ============ */
console.log('--- C. 对称转向 r=±30mm ---');
const mp = DW.solveModel(0, 0.030), mn = DW.solveModel(0, -0.030);
const relAsym = (a,b) => Math.abs(a+b)/Math.max(Math.abs(a),Math.abs(b),1e-12)*100;
const toeAsym = relAsym(mp.L.toeDeg, mn.L.toeDeg);
const camAsym = relAsym(mp.L.camberDeg, mn.L.camberDeg);
console.log('  toe_L(+30)=%+.5f°  toe_L(-30)=%+.5f°  符号对称: %s  幅值偏差: %.6f%%',
  mp.L.toeDeg, mn.L.toeDeg, mp.L.toeDeg * mn.L.toeDeg < 0 ? '是' : '否', toeAsym);
console.log('  camber_L(+30)=%+.5f° camber_L(-30)=%+.5f° 符号对称: %s  幅值偏差: %.6f%%',
  mp.L.camberDeg, mn.L.camberDeg, mp.L.camberDeg * mn.L.camberDeg < 0 ? '是' : '否', camAsym);
console.log('  右轮: toe_R(+30)=%+.5f° toe_R(-30)=%+.5f° camber_R(+30)=%+.5f° camber_R(-30)=%+.5f°',
  mp.R.toeDeg, mn.R.toeDeg, mp.R.camberDeg, mn.R.camberDeg);
check('前束响应符号对称且幅值偏差<1%', mp.L.toeDeg*mn.L.toeDeg < 0 && toeAsym < 1, 'asym=' + toeAsym.toFixed(6) + '%');
/* 外倾-转向响应含 KPI 倾斜固有的偶次分量: even/odd ≈ (kz·|ky|/|kx|)·tan(δ/2) ≈ 14.4% @δ≈11°,
 * 纯主销旋转下即存在, 无法通过连杆几何消除; 且与前束幅值对称互斥 (前束对称要求 |δ(+r)|=|δ(−r)|,
 * 外倾幅值对称反而要求 |δ(−r)| 比 |δ(+r)| 大 ~15%)。阈值取 20%: 覆盖物理下限 14.4%,
 * 同时仍能捕获真实缺陷 (臂相位失配的旧几何为 23.9%, 会 FAIL)。 */
check('外倾响应符号对称且幅值偏差<20%(含KPI固有偶次项)', mp.L.camberDeg*mn.L.camberDeg < 0 && camAsym < 20, 'asym=' + camAsym.toFixed(4) + '% (物理下限≈14.4%)');

/* ============ D. 弹簧长度独立复算 ============ */
console.log('--- D. 弹簧长度一致性 (独立复算 vs 求解器读数) ---');
const GEO = DW.GEO;
const Ll = Math.hypot(GEO.lbj0[1]-0.300, GEO.lbj0[2]-0.150);
const th0 = Math.atan2(GEO.lbj0[2]-0.150, GEO.lbj0[1]-0.300);
let springMaxDiff = 0; // mm
const S = DW.getStatics();
for(let b=-80; b<=80; b+=5){
  for(let r=-60; r<=60; r+=15){
    const mm = DW.solveModel(b/1000, r/1000);
    if(!mm) continue;
    for(const c of [mm.L, mm.R]){
      // 独立复算弹簧下支座位置 (右角为 Y 镜像: 枢轴与径向 y 分量取 side 符号, 否则复算的不是右侧支座)
      const s = c.side;
      const dth = c.thetaL - th0;
      const ang = s*dth;   /* Y 镜像: 径向 y 与旋转角同时反号, z 不变 */
      const sy0 = s*(GEO.spLo[1]-0.300), sz0 = GEO.spLo[2]-0.150;
      const sp = [GEO.spLo[0], s*0.300 + sy0*Math.cos(ang) - sz0*Math.sin(ang), 0.150 + sy0*Math.sin(ang) + sz0*Math.cos(ang)];
      const dx = sp[0]-c.SPlo[0], dy = sp[1]-c.SPlo[1], dz = sp[2]-c.SPlo[2];
      const nodeDiff = Math.sqrt(dx*dx+dy*dy+dz*dz)*1000;
      // 读数与渲染几何: springLen 定义即 |SPup-SPlo|, 再独立验一次
      const indep = Math.hypot(c.SPup[0]-c.SPlo[0], c.SPup[1]-c.SPlo[1], c.SPup[2]-c.SPlo[2]);
      const readDiff = Math.abs(indep - c.springLen)*1000;
      springMaxDiff = Math.max(springMaxDiff, nodeDiff, readDiff);
    }
  }
}
check('弹簧读数与渲染几何一致 (<0.1mm)', springMaxDiff < 0.1, 'maxDiff=' + springMaxDiff.toFixed(6) + ' mm, 中位弹簧长度=' + (S.spring0*1000).toFixed(2) + ' mm');

/* ============ E. 中位几何与指标抽查 ============ */
console.log('--- E. 中位指标 / bump steer ---');
const N = DW.getNeutral();
console.log('  中位: KPI=%.3f° Caster=%.3f° camber=%.4f° toe=%.4f° scrub=%.2fmm trail=%.2fmm',
  N.L.kpiDeg, N.L.casterDeg, N.L.camberDeg, N.L.toeDeg, N.L.scrub*1000, N.L.trail*1000);
const m80 = DW.solveModel(0.080, 0), mn80 = DW.solveModel(-0.080, 0);
console.log('  外倾连续变化: b=-80:%+.3f° b=0:%+.3f° b=+80:%+.3f° (单调/连续)',
  mn80.L.camberDeg, N.L.camberDeg, m80.L.camberDeg);
console.log('  轮距变化: b=-80:%+.2fmm b=+80:%+.2fmm', mn80.dTrack*1000, m80.dTrack*1000);
const bs = DW.getBS();
console.log('  Bump Steer 特征: 前束Δ@±80mm=%.4f° 外倾Δ@±80mm=%.4f°', bs.toe, bs.camber);
check('轮跳时外倾角连续变化', Math.abs(m80.L.camberDeg - N.L.camberDeg) > 0.5 && Math.abs(mn80.L.camberDeg - N.L.camberDeg) > 0.5,
  'camber(-80/0/+80)=' + mn80.L.camberDeg.toFixed(3) + '/' + N.L.camberDeg.toFixed(3) + '/' + m80.L.camberDeg.toFixed(3));

/* 叠加不发散: b=80,r=60 极限角点 */
const mc = DW.solveModel(0.080, 0.060);
check('轮跳+转向极限叠加收敛', !!mc && mc.rods.every(rd=>rd.err<1e-6) && Number.isFinite(mc.L.toeDeg),
  mc ? ('camber=' + mc.L.camberDeg.toFixed(3) + '° toe=' + mc.L.toeDeg.toFixed(3) + '° maxRodErr=' + mc.maxRodErr.toExponential(2)) : 'null');

/* ============ F. 渲染 / 图表冒烟 ============ */
console.log('--- F. 渲染与图表冒烟 ---');
let renderOK = true;
try {
  DW.computeGhosts(0.03);
  const ctx = mkCtx();
  DW.drawScene(ctx, 1280, 720, mc || N);
  DW.drawChart(ctx, 284, 126, [{color:'#5ab8b8', pts:[[-80,1],[0,0],[80,-1]]}], [-80,80], 12, '外倾°');
  const sw = DW.sweepCharts(30);
  check('扫描/残影/渲染/图表无异常', sw.b.length === 41 && DW.ghosts.items.length === 33, 'sweep=' + sw.b.length + ' pts, ghosts=' + DW.ghosts.items.length);
} catch(e){ renderOK = false; check('扫描/残影/渲染/图表无异常', false, String(e)); }

console.log('');
if(failures > 0){ console.error('SMOKE FAILED: ' + failures + ' failure(s)'); process.exit(2); }
console.log('SMOKE PASSED: all checks green');
