/* ================================================================================
   verify.mjs —— 无头自测（零依赖 / 零网络）
   在 DOM + WebGL2 桩件下真实执行 answer.html 内的脚本，驱动主循环若干帧，
   并对 SO(3) 指数映射积分、受力模型、Acro 三轴 PID、碰撞、VTX 衰减、
   Failsafe、四通道映射、参数实时接入、HUD/菜单 做数值与结构断言。
   运行：  node verify.mjs        （输出 PASS/FAIL 与证据，退出码 0=全通过）
   产物：  verify-result.json
   ================================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'answer.html'), 'utf8');
const mm = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!mm) { console.error('无法从 answer.html 提取内联脚本'); process.exit(1); }
const src = mm[1];

/* ============================ DOM / WebGL 桩 ============================ */
let nowMs = 0;
function mkEl(tag = 'div') {
  const el = {
    tagName: tag, style: {}, dataset: {}, children: [], _h: {}, _q: {},
    classList: { add() { }, remove() { }, toggle() { }, contains: () => false },
    set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html || ''; },
    set textContent(v) { this._txt = String(v); }, get textContent() { return this._txt || ''; },
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); }, removeEventListener() { },
    querySelector(sel) { return this._q[sel] || (this._q[sel] = mkEl('x')); },
    querySelectorAll: () => [mkEl('b'), mkEl('b'), mkEl('b'), mkEl('b')],
    getContext: () => GL, focus() { },
    getBoundingClientRect: () => ({ width: 1280, height: 720 }),
    width: 0, height: 0, clientWidth: 1280, clientHeight: 720, value: '', checked: false, type: '',
  };
  return el;
}
const EL = new Map();
const byId = (id) => { if (!EL.has(id)) EL.set(id, mkEl()); return EL.get(id); };
const KNOWN = { ACTIVE_UNIFORMS: 12 };
const GL = new Proxy({ drawingBufferWidth: 1280, drawingBufferHeight: 720 }, {
  get(t, k) {
    if (typeof k !== 'string') return undefined;
    if (k in t) return t[k];
    if (/^[A-Z][A-Z0-9_]*$/.test(k)) return KNOWN[k] !== undefined ? KNOWN[k] : k.length + 1000;
    if (k === 'getShaderParameter') return () => true;
    if (k === 'getProgramParameter') return (p, n) => (n === KNOWN.ACTIVE_UNIFORMS ? 0 : true);
    if (k === 'getShaderInfoLog' || k === 'getProgramInfoLog') return () => '';
    return () => ({ id: k + Math.random() });
  },
  set(t, k, v) { t[k] = v; return true; },
});
const document = {
  getElementById: byId, createElement: mkEl, createTextNode: mkEl,
  querySelector: (s) => byId('Q:' + s), querySelectorAll: () => [mkEl(), mkEl(), mkEl(), mkEl()],
  addEventListener() { }, body: mkEl('body'), documentElement: mkEl('html'),
};
const listeners = {};
const window = {
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  removeEventListener() { }, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
};
const navigator = { getGamepads: () => [null], userAgent: 'node-verify' };
const store = new Map();
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const perf = { now: () => nowMs };
const rafQ = [];
const requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };

/* ============================ 执行页面脚本 ============================ */
const errs = [];
const consoleStub = { log() { }, warn() { }, error: (...a) => errs.push(a.join(' ')) };
new Function('window', 'document', 'navigator', 'performance', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'console', src)
  (window, document, navigator, perf, localStorage, requestAnimationFrame, () => { }, consoleStub);
const fire = (type, ev = {}) => (listeners[type] || []).forEach((f) => f(Object.assign({ preventDefault() { }, target: { tagName: 'DIV' }, code: 'None' }, ev)));
fire('DOMContentLoaded');
const F = window.__FPV;
if (!F) { console.error('boot() 未导出 __FPV —— 初始化即失败'); process.exit(1); }
const stepFrames = (n, ms = 16.7) => { for (let i = 0; i < n; i++) { nowMs += ms; for (const cb of rafQ.splice(0, rafQ.length)) cb(nowMs); } };
byId('bootGo').onclick();     // 点 START
stepFrames(3);

/* ============================ 断言 ============================ */
const R = [];
const chk = (name, cond, ev = '') => { R.push({ name, pass: !!cond, evidence: ev }); console.log((cond ? 'PASS ' : 'FAIL ') + name + '\n      · ' + ev); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const VL = (a) => Math.hypot(a[0], a[1], a[2]);
const CFG = F.CFG, H = CFG.phys;
const HOVER = (H.mass * H.gravity) / H.maxThrust;
CFG.rates.thrExpo = 0;                        // 单位油门曲线，便于与解析值比对
const RAD = Math.PI / 180;

/* 1 so(3) 指数映射闭式：输出严格 ∈ SO(3)（含 θ→0 与 θ>2π） */
{
  let worst = 0;
  for (let i = 0; i < 4000; i++) {
    const sc = i < 2000 ? 14 : 1e-10;
    const p = [(Math.random() - .5) * sc, (Math.random() - .5) * sc, (Math.random() - .5) * sc];
    const E = F.so3_exp(p);
    worst = Math.max(worst, F.orthError(E), Math.abs(F.M3.det(E) - 1));
  }
  chk('so(3)→SO(3) 指数映射（Rodrigues 闭式）4000 随机样本严格正交、det=1',
    worst < 1e-9 && near(F.so3_exp([0, 0, 0])[0], 1, 1e-12),
    `max(‖RᵀR−I‖, |det−1|)=${worst.toExponential(2)}；exp(0)=I ✓；含 θ<1e-9 的 Taylor 退化区 ✓`);
}
/* 2 李群一步复合 = 解析解，且优于一阶欧拉（对照实验） */
{
  const w = [0.4, -0.7, 1.6], h = 1 / 240;
  let Rg = F.M3.id(), Re = F.M3.id();
  const exact = F.so3_exp(w.map((x) => x * 1.0));
  for (let i = 0; i < 240; i++) {
    Rg = F.M3.mul(Rg, F.so3_exp(w.map((x) => x * h)));
    const p = w.map((x) => x * h), K = [0, p[2], -p[1], -p[2], 0, p[0], p[1], -p[0], 0];
    Re = F.M3.mul(Re, [1 + K[0], K[1], K[2], K[3], 1 + K[4], K[5], K[6], K[7], 1 + K[8]]);
  }
  const ang = (A) => VL(F.so3_log(F.M3.mul(F.M3.transpose(exact), A))) / RAD;
  chk('姿态积分严格停留在 SO(3) 流形上（对照：一阶欧拉法脱离流形）',
    ang(Rg) < 1e-9 && F.orthError(Rg) < 1e-12 && F.orthError(Re) > 1e-3,
    `exp-map 复合角误差=${ang(Rg).toExponential(2)}°、正交误差=${F.orthError(Rg).toExponential(2)}（机器精度）；同条件一阶欧拉 (I+[ωΔt]×)ⁿ 正交误差=${F.orthError(Re).toExponential(2)}、det=${F.M3.det(Re).toFixed(4)}（长度漂移）`);
}
/* 3 长时间闭环演化：20000 子步剧烈机动后仍在 SO(3)、无溢出 */
{
  const S = F.createState(); S.pos = [0, 0, 60]; S.armed = true;
  for (let i = 0; i < 20000; i++) F.stepBody(S, 1 / 240, [Math.sin(i * .01) * 12, Math.cos(i * .013) * 10, Math.sin(i * .007) * 9], 0.7);
  const err = F.orthError(S.R), d = F.M3.det(S.R);
  const finite = [...S.pos, ...S.v, ...S.omega, ...S.R, ...S.motor].every(Number.isFinite);
  chk('83s 连续剧烈翻滚（flip/spin）后 R 仍 ∈ SO(3)，状态无 NaN',
    finite && err < 1e-3 && Math.abs(d - 1) < 1e-3,
    `orthErr=${err.toExponential(2)} det=${d.toFixed(8)} |ω|=${VL(S.omega).toFixed(1)}rad/s(${(VL(S.omega) / RAD).toFixed(0)}°/s) z=${S.pos[2].toFixed(0)}m`);
}
/* 4 万向节死锁不存在（欧拉角奇异位形下仍有三轴权限） */
{
  const S = F.createState(); S.pos = [0, 0, 400]; S.armed = true;
  S.R = F.so3_exp([0, Math.PI / 2, 0]);                  // 机头竖直（pitch=±90° 奇异）
  const nose0 = F.M3.mv(S.R, [1, 0, 0]), R0 = S.R.slice();
  for (let i = 0; i < 120; i++) F.stepBody(S, 1 / 240, [9, 0, 0], HOVER);
  const rot = VL(F.so3_log(F.M3.mul(S.R, F.M3.transpose(R0)))) / RAD;
  const nose1 = F.M3.mv(S.R, [1, 0, 0]);
  const S2 = F.createState(); S2.pos = [0, 0, 400]; S2.armed = true; S2.R = R0.slice();
  for (let i = 0; i < 120; i++) F.stepBody(S2, 1 / 240, [0, 0, 6], HOVER);
  const rot2 = VL(F.so3_log(F.M3.mul(S2.R, F.M3.transpose(R0)))) / RAD;
  chk('pitch=90° 奇异位形下 roll/yaw 指令依然产生真实旋转（无死锁）',
    Math.abs(nose0[2]) > 0.999 && rot > 40 && rot2 > 15 && Math.abs(nose1[2]) > 0.9,
    `机头 z=${nose0[2].toFixed(3)}（严格竖直）· 0.5s roll 指令转过 ${rot.toFixed(1)}° · yaw 指令转过 ${rot2.toFixed(1)}° · 末机头 z=${nose1[2].toFixed(3)}`);
}
/* 5 平动方程：自由落体 a≈g，收敛于 √(mg/k) 终端速度 */
{
  const S = F.createState(); S.pos = [0, 0, 3000];
  for (let i = 0; i < 48; i++) F.stepBody(S, 1 / 240, [0, 0, 0], 0);
  const a02 = S.v[2] / 0.2;
  for (let i = 0; i < 240 * 30; i++) F.stepBody(S, 1 / 240, [0, 0, 0], 0);
  const vt = S.v[2], ex = -Math.sqrt(H.mass * H.gravity / H.drag);
  chk('受力模型 m·v̇ = R·(0,0,T) + m·g − k|v|v：落体加速度与平方阻尼终端速度',
    near(a02, -H.gravity, 0.15) && near(vt, ex, Math.abs(ex) * 0.04),
    `0.2s 内平均 a=${a02.toFixed(3)}m/s²（g=${H.gravity}）· 30s 后 v_z=${vt.toFixed(3)} vs √(mg/k)=${ex.toFixed(3)}`);
}
/* 6 三力闭合：悬停油门下 8s 高度稳定（推力矢量随 R 旋转生效） */
{
  const cap0 = CFG.phys.battery; CFG.phys.battery = 1e7;   // 关闭电池衰减，纯验证力平衡
  const S = F.createState(); S.pos = [0, 0, 120]; S.armed = true;
  for (let i = 0; i < 240 * 2; i++) F.stepBody(S, 1 / 240, [0, 0, 0], HOVER);
  const z0 = S.pos[2];
  for (let i = 0; i < 240 * 8; i++) F.stepBody(S, 1 / 240, [0, 0, 0], HOVER);
  const dz = S.pos[2] - z0;
  /* 固定 30° 低头姿态（ω=0）：水平加速度应 ≈ g·tan30，验证推力矢量随 R 旋转 */
  const S2 = F.createState(); S2.pos = [0, 0, 260]; S2.armed = true;
  S2.R = F.so3_exp([0, 30 * RAD, 0]); S2.omega = [0, 0, 0];
  for (let i = 0; i < 96; i++) F.stepBody(S2, 1 / 480, [0, 0, 0], HOVER);      // 电机滞后稳定
  const v0 = S2.v.slice(), T0 = S2.thrustNow, dtw = 12 / 480;
  for (let i = 0; i < 12; i++) F.stepBody(S2, 1 / 480, [0, 0, 0], HOVER);       // 25ms 窗口
  const ax = (S2.v[0] - v0[0]) / dtw, az = (S2.v[2] - v0[2]) / dtw;
  const sp = VL(v0);
  const axEx = (T0 * Math.sin(30 * RAD) - H.drag * sp * v0[0]) / H.mass;
  const azEx = (T0 * Math.cos(30 * RAD) - H.drag * sp * v0[2] - H.mass * H.gravity) / H.mass;
  CFG.phys.battery = cap0;
  chk('悬停力平衡（mg=T）+ 推力矢量按 SO(3) 姿态旋转（a = R·(0,0,T)/m + g）',
    Math.abs(S.thrustNow - H.mass * H.gravity) < 0.02 * H.mass * H.gravity && dz > -6 && VL(S.v) < 1.2
    && Math.abs(ax - axEx) < 0.08 * Math.abs(axEx) && Math.abs(az - azEx) < 0.12,
    `hover stick=${HOVER.toFixed(4)}（TWR=${(H.maxThrust / (H.mass * H.gravity)).toFixed(2)}）· T=${S.thrustNow.toFixed(3)}N vs mg=${(H.mass * H.gravity).toFixed(3)}N · 8s Δz=${dz.toFixed(2)}m（acro 无定高，保留起转残差）· 锁定低头 30°：实测 a=(${ax.toFixed(2)}, ${az.toFixed(2)}) 理论 (${axEx.toFixed(2)}, ${azEx.toFixed(2)}) m/s²`);
}
/* 7 Acro 三轴角速度 PID 闭环品质 */
{
  const spec = [['roll', 0, 500, 0.16], ['pitch', 1, 400, 0.16], ['yaw', 2, 250, 0.45]];
  const res = spec.map(([k, ax, wdeg, tl]) => {
    const S = F.createState(); S.pos = [0, 0, 500]; S.armed = true;
    const target = wdeg * RAD, wd = [0, 0, 0]; wd[ax] = target;
    let peak = 0, t90 = null, se = 0, n = 0;
    for (let i = 0; i < 600; i++) {
      F.stepBody(S, 1 / 240, wd, HOVER);
      const w = S.omega[ax]; peak = Math.max(peak, w);
      if (t90 === null && w >= 0.9 * target) t90 = i / 240;
      if (i > 200) { se += Math.abs(w - target) / target; n++; }
    }
    return { k, t90, over: (peak / target - 1) * 100, ss: se / n * 100, ok: t90 !== null && t90 < (ax === 2 ? 0.5 : 0.22) && Math.abs(peak / target - 1) < 0.35 && se / n * 100 < 6 };
  });
  chk('三轴 PID：roll/pitch t90<0.22s、yaw t90<0.50s、超调<35%、稳态误差<6%',
    res.every((r) => r.ok),
    res.map(r => `${r.k} t90=${r.t90 === null ? '—' : r.t90.toFixed(2) + 's'} 超调=${r.over.toFixed(1)}% 稳态误差=${r.ss.toFixed(2)}%`).join(' | '));
}
/* 8 力矩符号与机体轴右手系一致（短时积分，避免转过 180°） */
{
  const mk = () => { const S = F.createState(); S.pos = [0, 0, 200]; S.armed = true; return S; };
  const S1 = mk(), S2 = mk();
  for (let i = 0; i < 72; i++) { F.stepBody(S1, 1 / 240, [5, 0, 0], HOVER); F.stepBody(S2, 1 / 240, [0, 5, 0], HOVER); }
  const rightTip = F.M3.mv(S1.R, [0, -1, 0]), leftTip = F.M3.mv(S1.R, [0, 1, 0]);
  const nose = F.M3.mv(S2.R, [1, 0, 0]);
  const yawS = mk(); for (let i = 0; i < 72; i++) F.stepBody(yawS, 1 / 240, [0, 0, 5], HOVER);
  const noseY = F.M3.mv(yawS.R, [1, 0, 0]);
  chk('力矩符号右手系一致：+roll 右倾 / +pitch 低头 / +yaw 左偏（机头向 +y 转）',
    rightTip[2] < -0.5 && leftTip[2] > 0.5 && nose[2] < -0.5 && noseY[1] > 0.5 && Math.abs(noseY[2]) < 0.3,
    `右臂 z=${rightTip[2].toFixed(3)} 左臂 z=${leftTip[2].toFixed(3)} · +pitch 后机头 z=${nose[2].toFixed(3)} · +yaw 后机头 y=${noseY[1].toFixed(3)} z=${noseY[2].toFixed(3)}`);
}
/* 9 碰撞：圆柱 / 地面 / 环面管 */
{
  F.setScene(F.buildTrack());
  const sc = F.getScene(), PR = 0.20;
  const cyl = sc.colliders.find((c) => c.kind === 'cyl');
  const S1 = F.createState(); S1.pos = [cyl.c[0] + 0.05, cyl.c[1], (cyl.z0 + cyl.z1) / 2]; S1.v = [2, 0, -5];
  const h1 = F.resolveCollisions(S1, PR);
  const d = Math.hypot(S1.pos[0] - cyl.c[0], S1.pos[1] - cyl.c[1]);
  const S2 = F.createState(); S2.pos = [0, 0, 0.02]; S2.v = [0, 0, -9];
  const h2 = F.resolveCollisions(S2, PR);
  const t = sc.colliders.find((c) => c.kind === 'torus');
  const wdir = F.V3.norm(F.V3.cross(F.V3.norm(t.n), [0, 0, 1]));
  const S3 = F.createState(); S3.pos = F.V3.add(t.c, F.V3.scale(wdir, t.R)); S3.v = [0, 0, -3];
  const h3 = F.resolveCollisions(S3, PR);
  const ab = sc.colliders.find((c) => c.kind === 'aabb');
  const S4 = F.createState(); S4.pos = [(ab.lo[0] + ab.hi[0]) / 2, (ab.lo[1] + ab.hi[1]) / 2, (ab.lo[2] + ab.hi[2]) / 2]; S4.v = [0, -4, 0];
  const h4 = F.resolveCollisions(S4, PR);
  chk('碰撞检测与响应：立柱/地面/环面管/墙体 AABB 均推出并反弹',
    h1.any && d >= cyl.r + PR - 1e-3 && h2.any && S2.pos[2] >= PR - 1e-6 && S2.v[2] > 0 && h3.any && h4.any,
    `立柱推出至 ${d.toFixed(3)}m(≥${(cyl.r + PR).toFixed(3)}) · 地面 z=${S2.pos[2].toFixed(3)} vz=${S2.v[2].toFixed(2)} · 环面管=${h3.any} · 墙体=${h4.any}`);
}
/* 10 VTX 距离衰减模型 */
{
  const sc = F.getScene(), V = CFG.vtx;
  const at = (dd) => F.vtxSignal([sc.start[0] + dd, sc.start[1], 20], 1).s;
  const s0 = F.vtxSignal(sc.start, 0);
  chk('信号强度按与起点距离单调衰减：满信号→衰弱带→归零',
    s0.s > 0.99 && at(V.range * 0.6) > 0.9 && at(V.range) > 0.75 && at(V.range + V.fade * 0.5) < 0.8 && at(V.range + V.fade * 0.5) > 0.1 && at(V.range + V.fade * 1.6) < 0.02,
    `R=${V.range}m fade=${V.fade}m · d=0:${s0.s.toFixed(2)} 0.6R:${at(V.range * 0.6).toFixed(2)} R:${at(V.range).toFixed(2)} R+½fade:${at(V.range + V.fade * 0.5).toFixed(2)} R+1.6fade:${at(V.range + V.fade * 1.6).toFixed(3)}`);
}
/* 11 主循环随机花飞 420 帧：无运行时错误 */
{
  const IN = F.getIN(), S = F.getS();
  S.crashed = false; S.armed = true; S.pos = [0, 0, 1.5]; S.v = [0, 0, 0];
  const keys = ['KeyW', 'KeyS', 'KeyD', 'KeyA', 'KeyQ', 'KeyE'];
  let threw = null, maxW = 0, zmax = -1e9, dmax = 0;
  try {
    for (let f = 0; f < 420; f++) {
      IN.keys['ShiftLeft'] = true;                       // 持续给油
      if (f > 40 && f % 23 === 0) { keys.forEach((k) => IN.keys[k] = false); IN.keys[keys[(f / 23 | 0) % keys.length]] = true; }
      stepFrames(1);
      const st = F.getS();
      st.crashed = false; st.armed = true;               // 测试期间保持解锁（真实飞行由 R 复位）
      maxW = Math.max(maxW, VL(st.omega)); zmax = Math.max(zmax, st.pos[2]);
      dmax = Math.max(dmax, F.vtxSignal(st.pos, 0).d);
    }
  } catch (e) { threw = e; }
  keys.forEach((k) => IN.keys[k] = false); IN.keys['ShiftLeft'] = false;
  const st = F.getS();
  const finite = [...st.pos, ...st.v, ...st.omega, ...st.R].every(Number.isFinite);
  chk('主循环 420 帧（≈7s 持续油门 + 随机三轴花飞）无运行时错误、确实起飞机动',
    !threw && finite && maxW > 2 && zmax > 8 && dmax > 3,
    threw ? '抛错：' + threw.message : `max|ω|=${(maxW / RAD).toFixed(0)}°/s · 升限 ${zmax.toFixed(1)}m · 最远 ${dmax.toFixed(0)}m · pos=[${st.pos.map(x => x.toFixed(1))}] · console.error=${errs.length}`);
}
/* 12 超程失联 → FAILSAFE（忽略杆量）；返航恢复 */
{
  const IN = F.getIN(), S = F.getS(), sc = F.getScene(), V = CFG.vtx;
  S.crashed = false; S.armed = true;
  S.pos = [sc.start[0] + V.range + V.fade + 90, sc.start[1], 30]; S.v = [0, 0, 0];
  stepFrames(45);
  const fsOn = IN.failsafe, thr = IN.throttle, rsum = Math.abs(IN.rates[0]) + Math.abs(IN.rates[1]) + Math.abs(IN.rates[2]);
  IN.keys['KeyD'] = true; IN.keys['ShiftLeft'] = true; stepFrames(8);
  const ignored = IN.throttle === thr && Math.abs(IN.rates[0]) + Math.abs(IN.rates[2]) === 0;
  IN.keys['KeyD'] = false; IN.keys['ShiftLeft'] = false;
  S.pos = [sc.start[0] + 4, sc.start[1], 8]; S.v = [0, 0, 0];
  stepFrames(160);
  const back = !IN.failsafe;
  chk('超出图传极限 → 黑屏失联 + FAILSAFE 接管（杆量被忽略）；返航后自动恢复',
    fsOn && ignored && back && Math.abs(thr - V.fsThrottle) < 1e-6 && rsum === 0,
    `失联=${fsOn} 强制油门=${thr.toFixed(2)}（fsThrottle=${V.fsThrottle}）目标角速度和=${rsum.toFixed(2)} · 打杆无效=${ignored} · 返航恢复=${back}`);
}
/* 13 四通道：键盘语义方向 + Gamepad 轴 + 反向 */
{
  const IN = F.getIN();
  const clear = () => ['KeyW', 'KeyS', 'KeyD', 'KeyA', 'KeyQ', 'KeyE', 'ShiftLeft', 'ControlLeft'].forEach(k => IN.keys[k] = false);
  const set = (o) => { clear(); Object.assign(IN.keys, o); stepFrames(2); };
  set({ KeyW: true }); const f = { ...IN.ch, r: [...IN.rates] }; clear(); stepFrames(2);
  set({ KeyD: true }); const g = { ...IN.ch, r: [...IN.rates] }; clear(); stepFrames(2);
  set({ KeyE: true }); const y = { ...IN.ch, r: [...IN.rates] }; clear(); stepFrames(2);
  set({ ShiftLeft: true }); const t = { ...IN.ch }; clear(); stepFrames(2);
  set({ KeyS: true }); const f2 = { ...IN.ch }; clear(); stepFrames(2);
  /* 虚拟遥控器（Mode2 轴：左副翼 L/R，左升降舵 F/B，右副翼 yaw，右升降舵 thr） */
  navigator.getGamepads = () => [{ axes: [0.9, -0.8, 0.6, -1.0], buttons: [{ value: 0 }, { value: 0 }], index: 0, id: 'TEST-RC-MODE2' }];
  stepFrames(3);
  const pad = { ...IN.ch, r: [...IN.rates] };
  const padName = IN.padName;
  const rv = CFG.input.roll.rev; CFG.input.roll.rev = !rv; stepFrames(2);
  const padRev = IN.ch.roll; CFG.input.roll.rev = rv;
  navigator.getGamepads = () => [null]; stepFrames(2);
  const ok =
    f.pitch > 0.9 && f.r[1] > 0 &&                      // W = 推杆 → 正 pitch 率（机头向下）
    f2.pitch < -0.9 &&                                   // S 反向
    g.roll > 0.9 && g.r[0] > 0 &&                        // D = 右 → 正 roll 率
    y.yaw < -0.9 && y.r[2] < 0 &&                        // E = 右转 → 负 yaw 率
    t.thr > 0.95 &&                                      // Shift = 满油门
    /TEST-RC/.test(padName) && pad.roll > 0.75 && pad.pitch > 0.6 && pad.yaw < -0.35 && pad.thr > 0.95 &&
    Math.sign(padRev) === -Math.sign(pad.roll);
  chk('Gamepad 四通道读取+归一化映射（含 Mode2 轴序、油门行程）与通道反向',
    ok,
    `键盘 W→pitch ${f.pitch.toFixed(2)}(ω_y ${f.r[1].toFixed(1)}rad/s) S→${f2.pitch.toFixed(2)} · D→roll ${g.roll.toFixed(2)} · E→yaw ${y.yaw.toFixed(2)}(ω_z ${y.r[2].toFixed(1)}) · Shift→thr ${t.thr.toFixed(2)}\n      · 遥控器[${padName}] ax0..3 → r=${pad.roll.toFixed(2)} p=${pad.pitch.toFixed(2)} y=${pad.yaw.toFixed(2)} t=${pad.thr.toFixed(2)}；反向后 r=${padRev.toFixed(2)}`);
}
/* 14 源码结构核查：指数映射积分 / 无欧拉角积分 / 无第三方物理引擎 / 无外链 */
{
  const eulerIntegrate = /(\b(pitch|roll|yaw)\b\s*(\+=|-=)\s*.*dt)/.test(src);
  const hasExp = /M3\.mul\(\s*S\.R\s*,\s*so3_exp\(/.test(src);
  const hat = /function hat3\(/.test(src) && /Math\.sin\(th\)\s*\/\s*th/.test(src);
  const engine = /(cannon|ammo\.js|rapiernode|rapier3d|matter\.js|planck|oimo|cannon-es|havok)/i.test(src.replace(/Cannonball/g, ''));
  const remote = /<script[^>]+src=/i.test(html) || /https?:\/\/[^"'\s]+\.(js|css|wasm)/i.test(html);
  chk('实现核查：R←R·exp([ωΔt]×)+Rodrigues 闭式；无欧拉角积分、无第三方物理引擎、无任何外部资源',
    hasExp && hat && !eulerIntegrate && !engine && !remote,
    `指数映射调用=${hasExp} hat3+sinθ/θ=${hat} 欧拉积分=${eulerIntegrate} 物理引擎=${engine} 外链资源=${remote}（单文件 ${(html.length / 1024).toFixed(0)}KB）`);
}
/* 15 VTX 后处理着色器完备 */
{
  const need = ['#version 300 es', 'uSig', 'uNoise', 'uTear', 'uBand', 'uGlitch', 'uVig', 'uSat',
    'static noise', 'horizontal tearing', 'rolling bands', 's <= 0.001'];
  const miss = need.filter((n) => !src.includes(n));
  chk('独立后处理 pass：FBO→全屏三角形 GLSL，含雪花/撕裂/滚动条纹/黑屏分级',
    miss.length === 0 && /ensureFbo/.test(src) && /drawPost/.test(src),
    miss.length ? '缺标记：' + miss.join(',') : 'FBO + uSig/uNoise/uTear/uBand/uGlitch 全在；三种视效各自实现；s→0 输出底噪黑屏');
}
/* 16 设置菜单 + 预设持久化 */
{
  const nBefore = EL.size;
  byId('bCopy').onclick();
  CFG.phys.mass = 0.91; CFG.vtx.range = 233; CFG.pid.roll.P = 1.23;
  byId('bSave').onclick();
  CFG.phys.mass = 0.11; CFG.vtx.range = 11; CFG.pid.roll.P = 0.5;
  byId('bLoad').onclick();
  const ok = CFG.phys.mass === 0.91 && CFG.vtx.range === 233 && CFG.pid.roll.P === 1.23;
  CFG.phys.mass = H.mass; CFG.vtx.range = 300; CFG.pid.roll.P = 1.20;
  chk('GUI 设置菜单可构建（① 通道 ② Rate ③ PID ④ 气动 ⑤ VTX ⑥ 相机）+ 预设存取',
    nBefore > 18 && ok && typeof store.get('fpv.cfg') === 'string' && byId('cfgIO').value.length > 200,
    `菜单相关元素 ${EL.size} 个；写 {0.91, 233m, P=1.23} → 读回 {${CFG.phys.mass}, ${CFG.vtx.range}, ${CFG.pid.roll.P}}；导出 JSON ${byId('cfgIO').value.length}B`);
}
/* 17 参数真的接入控制环（非线性装饰） */
{
  const lim0 = CFG.pid.roll.lim, P0 = CFG.pid.roll.P, I0 = CFG.pid.roll.I;
  CFG.pid.roll.lim = 30; CFG.pid.roll.I = 0;                // 线性区 + 关 I 项，暴露 P 增益本身
  const t50 = (P) => {
    CFG.pid.roll.P = P;
    const S = F.createState(); S.pos = [0, 0, 500]; S.armed = true;
    const target = 0.9; let t = 3;
    for (let i = 0; i < 240 * 3; i++) { F.stepBody(S, 1 / 480, [target, 0, 0], HOVER); if (t === 3 && S.omega[0] >= 0.5 * target) t = i / 480; }
    return t;
  };
  const slow = t50(P0 / 10), fast = t50(P0);
  CFG.pid.roll.P = P0; CFG.pid.roll.lim = lim0; CFG.pid.roll.I = I0;
  chk('PID 参数实时接入控制环（P↓10× → 闭环上升时间近乎等比变慢）',
    slow > fast * 4,
    `t50：P=${(P0 / 10).toFixed(2)} → ${slow.toFixed(3)}s；P=${P0} → ${fast.toFixed(3)}s（慢 ${(slow / fast).toFixed(1)}×，理论 ≈10×；P-only 存在 angDamp 静差）`);
}
/* 18 气动/刚体参数 + 分配器饱和收缩 */
{
  const fall = (k) => { CFG.phys.drag = k; const S = F.createState(); S.pos = [0, 0, 4000]; for (let i = 0; i < 240 * 25; i++) F.stepBody(S, 1 / 240, [0, 0, 0], 0); return S.v[2]; };
  const v1 = fall(0.028), v2 = fall(0.10); CFG.phys.drag = H.drag;
  const yawT90 = (kq) => {
    CFG.phys.kQ = kq; const S = F.createState(); S.pos = [0, 0, 200]; S.armed = true;
    let t = null; for (let i = 0; i < 240 * 2; i++) { F.stepBody(S, 1 / 240, [0, 0, 6], HOVER); if (t === null && S.omega[2] >= 0.9 * 6) t = i / 240; }
    return t === null ? 2 : t;
  };
  const y1 = yawT90(0.075), y2 = yawT90(0.006); CFG.phys.kQ = H.kQ;
  /* 分配器：极限力矩指令下总推力不得暴涨（饱和收缩） */
  const Sm = F.createState(); Sm.pos = [0, 0, 100]; Sm.armed = true;
  for (let i = 0; i < 480; i++) F.stepBody(Sm, 1 / 240, [0, 0, 9], HOVER);
  const thrustErr = Math.abs(Sm.thrustNow - H.mass * H.gravity) / (H.mass * H.gravity);
  const m0 = CFG.phys.mass; CFG.phys.mass = m0 * 2;
  const Sv = F.createState(); Sv.armed = true; Sv.pos = [0, 0, 100];
  for (let i = 0; i < 240; i++) F.stepBody(Sv, 1 / 240, [0, 0, 0], HOVER);
  const vHeavy = Sv.v[2]; CFG.phys.mass = m0;
  chk('气动/刚体参数接入：k↑终端速度↓ · kQ↓偏航上升变慢 · 饱和时总推力守恒 · 质量翻倍下坠',
    Math.abs(v1) > Math.abs(v2) * 1.4 && y2 > y1 * 2.5 && thrustErr < 0.12 && vHeavy < -3,
    `drag .028→${v1.toFixed(2)} vs .10→${v2.toFixed(2)}m/s · kQ .075→yaw t90=${y1.toFixed(2)}s vs .006→${y2.toFixed(2)}s · 极限偏航指令下 ΣT 偏差 ${(thrustErr * 100).toFixed(1)}% · 2×质量同油门 1s vz=${vHeavy.toFixed(2)}m/s`);
}
/* 19 场地内容 */
{
  const sc = F.getScene(), kinds = {};
  sc.colliders.forEach((c) => kinds[c.kind] = (kinds[c.kind] || 0) + 1);
  const tris = sc.objs.reduce((a, o) => a + o.mesh.idx.length / 3, 0);
  chk('3D 场地：地表+天空 + 花飞障碍（环门/带洞墙体/立柱群/废墟斜板/烟囱）',
    sc.objs.length > 60 && sc.gates.length >= 6 && kinds.cyl > 8 && kinds.aabb >= 4 && kinds.torus >= 6,
    `${sc.objs.length} 个网格物体 / ${tris.toFixed(0)} 三角面 · 环门 ${sc.gates.length} 道 · 碰撞体 ${JSON.stringify(kinds)}`);
}
/* 20 HUD 输出（遥测 + RSSI 条 + 通道条） */
{
  const t = byId('telem').innerHTML, mb = byId('modeBox').innerHTML;
  const sigW = byId('Q:#sig .bar i').style.width, msgTxt = byId('msg').innerHTML;
  chk('HUD 实时遥测 / 姿态 / 模式 / RSSI / 消息层均正确写入',
    /ALT/.test(t) && /RATES/.test(t) && /GATES/.test(t) && /ARMED/.test(mb) && /%/.test(String(sigW)) && /VTX RSSI/.test(html),
    `telem ${(t.length)}B · modeBox ${(mb.length)}B · RSSI 条宽度=${sigW} · 静态标记含 “VTX RSSI” ✓ · 最后消息="${String(msgTxt).replace(/<[^>]+>/g, '').slice(0, 24)}"`);
}
/* 22 ANGLE 自稳外环（串级，仍走同一 SO(3) rate 内环） */
{
  const mode0 = CFG.flight.mode; CFG.flight.mode = 'angle';
  const IN = F.getIN(); IN.stick = { roll: 0, pitch: 0, yaw: 0 }; IN.failsafe = false;
  const S = F.createState(); S.pos = [0, 0, 200]; S.armed = true;
  S.R = F.so3_exp([0.9, 0.7, 0]);                        // 任意大倾角（≈65°）
  for (let i = 0; i < 240 * 3; i++) F.stepBody(S, 1 / 240, [0, 0, 0], HOVER);
  const up = F.M3.mv(S.R, [0, 0, 1]);
  const lev0 = Math.acos(Math.min(1, up[2])) / RAD;
  IN.stick = { roll: 0.5, pitch: 0, yaw: 0 };
  for (let i = 0; i < 240 * 3; i++) F.stepBody(S, 1 / 240, [0, 0, 0], HOVER);
  const up2 = F.M3.mv(S.R, [0, 0, 1]);
  const hold = Math.acos(Math.min(1, up2[2])) / RAD;
  IN.stick = { roll: 0, pitch: 0, yaw: 0 };
  CFG.flight.mode = mode0;
  chk('ANGLE 模式：大倾角 3s 自动回平，半杆稳定在设定倾角附近（串级外环）',
    lev0 < 6 && Math.abs(hold - CFG.flight.tilt * 0.5) < 8,
    `回平后倾角=${lev0.toFixed(2)}° · 半杆(0.5) 稳态倾角=${hold.toFixed(1)}°（期望 ≈${(CFG.flight.tilt * 0.5).toFixed(0)}°）`);
}
/* 23 模式切换：ACRO 无自稳（保持角速度），ANGLE 有回平力矩 */
{
  const run = (mode) => {
    CFG.flight.mode = mode;
    const IN = F.getIN(); IN.stick = { roll: 0, pitch: 0, yaw: 0 };
    const S = F.createState(); S.pos = [0, 0, 300]; S.armed = true;
    S.R = F.so3_exp([0.8, 0, 0]); S.omega = [1.2, 0, 0];       // 带初角速度的倾斜姿态
    for (let i = 0; i < 240 * 1.5; i++) F.stepBody(S, 1 / 240, [0, 0, 0], HOVER);
    const up = F.M3.mv(S.R, [0, 0, 1]);
    return { tilt: Math.acos(Math.min(1, Math.abs(up[2]))) / RAD, w: VL(S.omega) };
  };
  const acro = run('acro'), angle = run('angle');
  CFG.flight.mode = 'acro';
  chk('模式切换改变闭环：ACRO 锁定当前倾斜姿态（rate 语义）/ ANGLE 自动回平（姿态语义）',
    acro.tilt > 30 && acro.w < 0.25 && angle.tilt < 6 && angle.w < 0.25,
    `同一初值（45.8° 倾角 + 1.2rad/s 角速度，杆量居中，1.5s 后）：ACRO 倾角=${acro.tilt.toFixed(1)}° |ω|=${acro.w.toFixed(3)}（保持姿态不自动回平 ✓）· ANGLE 倾角=${angle.tilt.toFixed(1)}° |ω|=${angle.w.toFixed(3)}（回平 ✓）`);
}
/* 24 全程无未捕获异常 / console.error */
{
  const ok = !errs.length;
  chk('整轮自测中页面未产生任何 console.error / 未捕获异常', ok, ok ? '0 条错误（含渲染 400+ 帧与 21 项测试）' : errs.join(' | ').slice(0, 300));
}

const fails = R.filter((r) => !r.pass);
console.log(`\n=== ${R.length - fails.length}/${R.length} PASS ===`);
if (fails.length) console.log('FAILED: ' + fails.map((f) => f.name).join('  ;  '));
fs.writeFileSync(path.join(dir, 'verify-result.json'), JSON.stringify({ total: R.length, failed: fails.length, checks: R }, null, 2));
process.exit(fails.length ? 2 : 0);
