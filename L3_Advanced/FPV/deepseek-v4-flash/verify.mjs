// verify.mjs — 物理核心闭环验证 (副产物, 写入工作区并披露)
// 1) 对 answer.html 内联 JS 做语法检查 (new Function 编译, 不执行 DOM 部分)
// 2) 抽取纯数学核心 (PURE-START..PURE-END) 在 node 中做:
//    - SO(3) 指数映射积分: 正交性/行列式/范数保持
//    - 悬停闭环: 15s 悬停漂移有界
//    - 角速度阶跃响应: 720°/s 目标速率收敛
//    - 偏航 90° 转动总量
//    - 平方阻尼: F ∝ |v|·v 验证
//    - 激烈机动正交性保持
import fs from 'fs';

const html = fs.readFileSync(new URL('./answer.html', import.meta.url), 'utf8');
const results = [];
function check(name, pass, evidence) { results.push({ item: name, pass, evidence }); console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + evidence); }

/* ---- 1. 全量 JS 语法检查 ---- */
try {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no script block');
  new Function(m[1]); // 编译不执行
  check('inline-JS-syntax', true, 'main <script> compiles, len=' + m[1].length);
} catch (e) {
  check('inline-JS-syntax', false, String(e));
}

/* ---- 2. 抽取纯核心 ---- */
const coreRaw = html.split('PURE-START')[1].split('PURE-END')[0];
const coreCode = coreRaw.slice(coreRaw.indexOf('const MathC'), coreRaw.lastIndexOf('})();') + 4);
const MathC = new Function(coreCode + '; return MathC;')();
const { clamp, v3len, v3norm, v3sub, v3scale, v3dot, matMul, so3Exp, orthoR3, makePID, pidStep, stepQuad, D2R } = MathC;

function orthoErr(R) {
  // max |R*R^T - I|
  const Rt = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
  const I9 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let err = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0;
    for (let k = 0; k < 3; k++) s += R[i * 3 + k] * Rt[k * 3 + j];
    err = Math.max(err, Math.abs(s - I9[i * 3 + j]));
  }
  return err;
}
function det3(R) {
  return R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6]) + R[2] * (R[3] * R[7] - R[4] * R[6]);
}
function randOmega(mag) {
  return [(Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag];
}
function newState() {
  /* 水平初始姿态: 机身 +Z(推力)→世界 +Y(上) */
  const R0 = so3Exp([-Math.PI / 2, 0, 0], 1);
  return { pos: [0, 2.2, 0], vel: [0, 0, 0], R: R0, omega: [0, 0, 0], motorLevels: [0, 0, 0, 0], landed: false, time: 0 };
}
function mkPhys() {
  return {
    mass: 0.48, Fmax: 2.5, arm: 0.05, kdProp: 0.02, drag: 0.006, angDrag: 0.003,
    g: 9.81, Ix: 0.0042, Iy: 0.0042, Iz: 0.0085, wMax: 45,
    pidR: makePID(0.24, 0.03, 0.006, 0.12),
    pidP: makePID(0.24, 0.03, 0.006, 0.12),
    pidY: makePID(0.16, 0.01, 0.030, 0.10)
  };
}

/* 2a. 指数映射 + 正交化长时间随机旋转 */
{
  const s = newState();
  const dt = 1 / 240;
  let maxErr = 0, dets = [];
  for (let i = 0; i < 20000; i++) {
    s.omega = randOmega(1.5);
    const dR = so3Exp(s.omega, Math.min(dt, 0.02) + 0);
    s.R = orthoR3(matMul(s.R, so3Exp(s.omega, dt)));
    if (i % 200 === 0) { maxErr = Math.max(maxErr, orthoErr(s.R)); dets.push(det3(s.R)); }
  }
  const detOK = dets.every(d => Math.abs(d - 1) < 1e-6);
  check('exp-map-orthonormal', maxErr < 1e-6 && detOK,
    '20000步随机旋转 max|RR^T-I|=' + maxErr.toExponential(2) + ' det范围=[' + Math.min(...dets).toFixed(7) + ',' + Math.max(...dets).toFixed(7) + ']');
}

/* 2b. 悬停 15s */
{
  const s = newState();
  const P = mkPhys();
  const hover = (P.mass * P.g) / (4 * P.Fmax);
  const ctrl = { throttle: hover, targetRates: [0, 0, 0], failsafe: false };
  const dt = 1 / 240;
  let nan = false;
  for (let i = 0; i < 15 / dt; i++) {
    s.time += dt;
    stepQuad(s, ctrl, P, dt);
    if (!isFinite(s.pos[0] + s.pos[1] + s.pos[2] + s.omega[0])) { nan = true; break; }
  }
  const horiz = Math.hypot(s.pos[0], s.pos[2]);
  const om = v3len(s.omega);
  check('hover-15s', !nan && s.pos[1] > 1.4 && s.pos[1] < 3.2 && horiz < 4 && om < 0.25,
    'pos=[' + s.pos.map(x => x.toFixed(2)).join(',') + '] |omega|=' + om.toFixed(4) + ' 油门=' + hover.toFixed(4));
}

/* 2c. 720°/s 滚转速率阶跃 (高空, 0.8s 内评估) */
{
  const s = newState();
  s.pos = [0, 20, 0];
  const P = mkPhys();
  const target = 720 * D2R;
  const ctrl = { throttle: 0.5, targetRates: [target, 0, 0], failsafe: false };
  const dt = 1 / 240;
  for (let i = 0; i < 0.8 / dt; i++) { s.time += dt; stepQuad(s, ctrl, P, dt); }
  check('roll-rate-step', Math.abs(s.omega[0] - target) < 1.0 && s.pos[1] > 10,
    '目标720°/s=' + target.toFixed(3) + ' rad/s, 0.8s后 omega_x=' + s.omega[0].toFixed(3) + ' rad/s (' + (s.omega[0] / D2R).toFixed(0) + '°/s), alt=' + s.pos[1].toFixed(1) + 'm');
}

/* 2d. 偏航 90° 总转动 */
{
  const s = newState();
  const P = mkPhys();
  const wY = 90 * D2R;
  const dt = 1 / 240;
  const c1 = { throttle: 0.5, targetRates: [0, 0, wY], failsafe: false };
  const c0 = { throttle: 0.5, targetRates: [0, 0, 0], failsafe: false };
  for (let i = 0; i < 1.0 / dt; i++) { s.time += dt; stepQuad(s, c1, P, dt); }
  for (let i = 0; i < 3.5 / dt; i++) { s.time += dt; stepQuad(s, c0, P, dt); }
  const tr = s.R[0] + s.R[4] + s.R[8];
  const ang = Math.acos(clamp((tr - 1) / 2, -1, 1));
  check('yaw-90deg', Math.abs(ang - Math.PI / 2) < 0.42 && Math.abs(s.omega[2]) < 0.05,
    '总转动角=' + (ang / D2R).toFixed(1) + '° (期望 90°), omega_z 停稳=' + s.omega[2].toFixed(4));
}

/* 2e. 平方阻尼 F ∝ |v|·v */
{
  const s = newState();
  s.vel = [20, 0, 0];
  const P = mkPhys();
  const ctrl = { throttle: 0, targetRates: [0, 0, 0], failsafe: true };
  const dt = 1 / 240;
  const v0 = s.vel[0];
  stepQuad(s, ctrl, P, dt);
  const acc = (s.vel[0] - v0) / dt;
  const expect = -P.drag * 20 * 20 / P.mass; // -k|v|v/m = -0.006*400/0.48
  check('quadratic-drag', Math.abs(acc - expect) < 0.5,
    'v=20m/s 时实测加速度=' + acc.toFixed(3) + ' m/s², 理论 -k|v|v/m=' + expect.toFixed(3));
}

/* 2f. 激烈机动 5s 正交性保持 */
{
  const s = newState();
  const P = mkPhys();
  const dt = 1 / 240;
  let worst = 0;
  for (let i = 0; i < 5 / dt; i++) {
    const tgt = [randOmega(6)[0], randOmega(6)[1], randOmega(6)[2]];
    const ctrl = { throttle: 0.6, targetRates: tgt, failsafe: false };
    s.time += dt;
    stepQuad(s, ctrl, P, dt);
    if (i % 100 === 0) worst = Math.max(worst, orthoErr(s.R));
  }
  check('agile-ortho', worst < 1e-6 && isFinite(s.omega[0] + s.pos[1]),
    '5s 随机机动 max|RR^T-I|=' + worst.toExponential(2));
}

console.log('SUMMARY ' + results.filter(r => r.pass).length + '/' + results.length + ' passed');
process.exit(results.every(r => r.pass) ? 0 : 1);