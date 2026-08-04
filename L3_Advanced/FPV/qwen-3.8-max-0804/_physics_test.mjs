// 临时物理验证脚本：加载真实 index.html 内的脚本，打桩浏览器 API，
// 同步驱动飞行物理，验证 SO(3) 积分 / PID / 推力爬升 / 横滚。测完即删。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('NO SCRIPT FOUND'); process.exit(1); }
const code = m[1];

// ---------- WebGL 打桩 ----------
const glProxy = new Proxy({}, {
  get(t, prop) {
    if (prop === 'getShaderParameter' || prop === 'getProgramParameter') return () => true;
    if (prop === 'getShaderInfoLog' || prop === 'getProgramInfoLog') return () => '';
    if (prop === 'getUniformLocation') return () => ({});
    if (prop === 'isContextLost') return () => false;
    return () => 0; // 其余全部 no-op；常量作为参数传入无影响
  }
});

// ---------- DOM 打桩 ----------
function makeEl() {
  return {
    className: '', textContent: '', innerHTML: '', style: {}, value: '',
    width: 1280, height: 720,
    onclick: null, oninput: null, onchange: null,
    appendChild() {}, removeChild() {},
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    getContext: () => glProxy
  };
}
const elements = {};
const documentMock = {
  getElementById: (id) => (elements[id] ||= makeEl()),
  createElement: () => makeEl(),
  body: makeEl(),
  title: 'test'
};

// ---------- 全局沙箱 ----------
const sandbox = {
  console,
  document: documentMock,
  navigator: { getGamepads: () => [null, null, null, null] },
  addEventListener: () => {},
  requestAnimationFrame: () => 0, // 永不触发, 由测试手动驱动物理
  setInterval: () => 0,           // 屏蔽主循环, 保证确定性
  setTimeout: () => 0,
  clearTimeout: () => {},
  clearInterval: () => {},
  performance: { now: () => Date.now() },
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 720,
  KeyboardEvent: function () {},
  Math, JSON, Uint16Array, Float32Array, Array, Number, isNaN: Number.isNaN
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
  vm.runInContext(code, sandbox, { filename: 'inline-script.js' });
} catch (e) {
  console.error('SCRIPT LOAD ERROR:', e.message);
  console.error((e.stack || '').split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}

// ---------- 确定性飞行测试 ----------
const testCode = `
(function(){
  const out = {};
  // 解锁 (低油门电平触发)
  keys['Enter'] = true; readInput(); keys['Enter'] = false;
  out.armed = drone.armed;
  // 满油门爬升 2 秒 (480 步 @240Hz)
  keys['ArrowUp'] = true;
  for (let i = 0; i < 480; i++) { readInput(); physics(1/240); }
  out.climb = { motor:+drone.motor.toFixed(2), alt:+drone.p[1].toFixed(2), vy:+drone.v[1].toFixed(2), thr:+ch.throttle.toFixed(2) };
  keys['ArrowUp'] = false;
  // 悬停油门(~0.33)下横滚 2 秒: 直接给定通道值, 验证 PID 角速度闭环与 SO(3) 积分
  for (let i = 0; i < 480; i++) { ch.throttle = 0.33; ch.roll = 1; physics(1/240); }
  out.roll = { rollRate:+drone.w[0].toFixed(2), target:+(cfg.pid.rate).toFixed(1),
               qNorm:+vLen(drone.q).toFixed(5), alt:+drone.p[1].toFixed(2),
               qNaN:drone.q.some(Number.isNaN), pNaN:drone.p.some(Number.isNaN) };
  // 持续翻滚 5 秒(多周大角度), 检查四元数范数与数值稳定性(无万向节死锁)
  for (let i = 0; i < 1200; i++) { ch.throttle = 0.33; ch.roll = 1; physics(1/240); }
  out.longRoll = { qNorm:+vLen(drone.q).toFixed(5), qNaN:drone.q.some(Number.isNaN),
                   rollRate:+drone.w[0].toFixed(2), wNorm:+vLen(drone.w).toFixed(3), armed:drone.armed };
  ch.roll = 0;
  // 俯仰通道验证
  for (let i = 0; i < 240; i++) { ch.throttle = 0.33; ch.pitch = 1; physics(1/240); }
  out.pitch = { pitchRate:+drone.w[2].toFixed(2), qNorm:+vLen(drone.q).toFixed(5) };
  ch.pitch = 0;
  return out;
})()
`;
let result;
try {
  result = vm.runInContext(testCode, sandbox, { filename: 'test.js' });
} catch (e) {
  console.error('TEST RUN ERROR:', e.message);
  console.error((e.stack || '').split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
