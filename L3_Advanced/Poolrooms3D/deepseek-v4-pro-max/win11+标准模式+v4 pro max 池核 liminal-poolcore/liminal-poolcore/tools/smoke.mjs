/**
 * tools/smoke.mjs — 无头浏览器冒烟测试（零依赖，不需要 puppeteer）
 * ===========================================================================
 * 做三件事：
 *   1. 起一个本地静态服务器（复用 serve.mjs）
 *   2. 用系统里的 Chrome / Edge 以 headless 模式打开页面，跑满 virtual-time-budget
 *   3. --dump-dom 抓回 DOM，解析页面里 #diag 的 JSON（由 main.js 周期性写入），
 *      断言：无 JS 错误、帧数在推进、chunk 已生成、draw call / 三角形 > 0、Shader 编译成功
 * 另外附带 --screenshot 出一张 PNG，便于人工/像素级检查。
 *
 * 用法：node tools/smoke.mjs [--quality=0] [--frames=20] [--keep]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const QUALITY = arg('quality', '0');
const MIN_FRAMES = Number(arg('frames', 12));
const MAX_FRAMES = Number(arg('maxframes', 24));
const BUDGET = Number(arg('budget', 20000));
const PORT = Number(arg('port', 5199));
const WINDOW = arg('window', '640,420');

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = process.env.CHROME_PATH || CANDIDATES.find((p) => fs.existsSync(p));
if (!browser) {
  console.error('找不到 Chrome/Edge。设置环境变量 CHROME_PATH 指向浏览器可执行文件。');
  process.exit(2);
}

const shot = path.join(ROOT, 'smoke-shot.png');
const profileDir = path.join(ROOT, '.smoke-profile');

function runBrowser(extraArgs) {
  return new Promise((resolve) => {
    const args = [
      '--headless=new', '--disable-gpu-sandbox', '--no-sandbox', '--no-first-run',
      '--disable-extensions', '--disable-background-networking', '--mute-audio',
      '--disable-sync', '--disable-default-apps', '--no-default-browser-check',
      '--disable-component-update', '--disable-client-side-phishing-detection',
      '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
      `--window-size=${WINDOW}`, '--hide-scrollbars',
      `--user-data-dir=${profileDir}`,
      `--virtual-time-budget=${BUDGET}`,
      ...extraArgs,
    ];
    const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

const server = createServer();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const url = `http://127.0.0.1:${PORT}/?quality=${QUALITY}&auto=0&smoke=1&maxframes=${MAX_FRAMES}`;
console.log(`[smoke] 浏览器: ${browser}`);
console.log(`[smoke] 页面: ${url}`);

const dom = await runBrowser(['--dump-dom', url]);
const shotRun = await runBrowser([`--screenshot=${shot}`, url]);
server.close();

// ── 解析 #diag ─────────────────────────────────────────────────
let diag = null;
const m = dom.out.match(/<div id="diag">([\s\S]*?)<\/div>/);
if (m) { try { diag = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch (e) { /* 见下 */ } }

const fails = [];
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
  if (!cond) fails.push(name);
};

console.log('\n=== 冒烟测试结果 ===');
ok('页面 DOM 抓取成功', dom.out.length > 200, `${dom.out.length} bytes`);
ok('#diag 解析成功', !!diag, diag ? '' : (m ? '内容非 JSON：' + m[1].slice(0, 200) : '未找到 #diag'));
if (diag) {
  ok('无致命错误', (diag.errors?.length ?? 0) === 0, JSON.stringify(diag.errors?.slice(0, 3) ?? []));
  ok('启动阶段到达 running/done', diag.stage === 'running' || diag.stage === 'done', String(diag.stage));
  ok(`帧数 ≥ ${MIN_FRAMES}`, (diag.frames ?? 0) >= MIN_FRAMES, `frames=${diag.frames}`);
  ok('WebGL2 上下文可用', diag.webgl?.version === 2, diag.webgl?.renderer ?? '');
  ok('chunk 已生成', (diag.chunks ?? 0) > 0, `chunks=${diag.chunks} pending=${diag.pending}`);
  ok('实例化实例数 > 0', (diag.instances ?? 0) > 0, `instances=${diag.instances}`);
  ok('draw call > 0', (diag.drawCalls ?? 0) > 0, `calls=${diag.drawCalls}`);
  ok('三角形 > 0', (diag.triangles ?? 0) > 0, `tris=${diag.triangles}`);
  ok('Shader 程序已编译', (diag.programs ?? 0) > 0, `programs=${diag.programs}`);
  ok('元素库已构建', (diag.elements ?? 0) > 0, `geometries=${diag.elements}`);
  ok('相机已被玩家控制器接管', !!diag.position, JSON.stringify(diag.position));
  // 帧缓冲回读：确定性验证"渲染出了内容"，不依赖浏览器截图链路
  const px = diag.pixels;
  ok('帧缓冲回读成功', !!px, px ? px.size : '无');
  if (px) {
    // 这些阈值是实测标定后锁定的：一旦配光/曝光/后处理被改回"过曝白"或"全黑"，这里会立刻报警
    ok('曝光在合理区间（40~205）', px.mean > 40 && px.mean < 205, `亮度均值 ${px.mean}`);
    ok('画面有对比度（std > 15）', px.std > 15, `标准差 ${px.std}`);
    ok('色阶丰富（真实渲染）', px.colors > 200, `${px.colors} 个量化色`);
    ok('色调偏青（池核调色板）', px.rgb[2] >= px.rgb[0], `R=${px.rgb[0]} B=${px.rgb[2]}`);
    console.log('\n[帧缓冲缩略亮度图]');
    for (const row of px.ascii) console.log('  |' + row + '|');
  }
  if (diag.warnings?.length) console.log('\n[warn] ' + diag.warnings.slice(0, 6).join('\n[warn] ').slice(0, 900));
  console.log('\n[diag] ' + JSON.stringify(diag, null, 1).slice(0, 1600));
}
// 浏览器进程日志：只关心 GPU / Shader / WebGL 层面的真实报错，其余 chrome 内部噪声全部忽略
const glErrors = (dom.err + shotRun.err)
  .split('\n')
  .filter((l) => /THREE\.|Shader Error|shader compilation|WebGL: INVALID|GL_INVALID|program link/i.test(l))
  .slice(0, 12);
ok('浏览器日志无 Shader/THREE 报错', glErrors.length === 0, glErrors.join(' | ').slice(0, 900));
ok('截图已产出', fs.existsSync(shot) && fs.statSync(shot).size > 5000, fs.existsSync(shot) ? fs.statSync(shot).size + ' bytes' : '无');

if (!argv.includes('--keep')) fs.rmSync(profileDir, { recursive: true, force: true });

console.log(fails.length ? `\n${fails.length} 项失败 ❌  → ${fails.join(', ')}` : '\n全部通过 ✅');
process.exit(fails.length ? 1 : 0);
