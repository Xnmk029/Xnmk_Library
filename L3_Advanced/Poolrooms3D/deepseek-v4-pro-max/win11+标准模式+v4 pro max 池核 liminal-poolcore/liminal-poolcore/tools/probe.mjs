/**
 * tools/probe.mjs — 分段渲染探针（定位画面发白/发暗出自哪一段）
 * ===========================================================================
 * 在一次无头运行里依次渲染并回读多种配置：
 *   scene-only / scene-no-fog / geometry-normals / composer-no-rays-no-bloom / full-chain
 * 每段输出：亮度均值、标准差、平均 RGB、量化色数、24×10 ASCII 亮度图。
 * 另外报告视线探针（相机朝向、最近实体距离与类型）。
 *
 * 用法：node tools/probe.mjs [--quality=2] [--maxframes=16] [--port=5201]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=')[1];

const QUALITY = arg('quality', '2');
const MAXFRAMES = arg('maxframes', '16');
const PORT = Number(arg('port', 5201));
const BUDGET = arg('budget', '25000');
const WINDOW = arg('window', '640,420');

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const browser = process.env.CHROME_PATH || CANDIDATES.find((p) => fs.existsSync(p));
if (!browser) { console.error('找不到 Chrome/Edge，设置 CHROME_PATH'); process.exit(2); }

const profile = path.join(ROOT, '.probe-profile');
const server = createServer();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const url = `http://127.0.0.1:${PORT}/?quality=${QUALITY}&auto=0&smoke=1&maxframes=${MAXFRAMES}&probe=1`;
console.log('[probe] ' + url);

const out = await new Promise((resolve) => {
  const child = spawn(browser, [
    '--headless=new', '--no-sandbox', '--no-first-run', '--disable-extensions', '--mute-audio',
    '--disable-sync', '--disable-default-apps', '--no-default-browser-check', '--disable-component-update',
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    `--window-size=${WINDOW}`, '--hide-scrollbars', `--user-data-dir=${profile}`,
    `--virtual-time-budget=${BUDGET}`, '--dump-dom', url,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; });
  child.on('close', () => resolve(buf));
});
server.close();
fs.rmSync(profile, { recursive: true, force: true });

const m = out.match(/<div id="diag">([\s\S]*?)<\/div>/);
if (!m) { console.error('未取到 #diag'); process.exit(1); }
const diag = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));

console.log('stage    :', diag.stage, '| frames:', diag.frames, '| chunks:', diag.chunks, '| instances:', diag.instances);
console.log('errors   :', JSON.stringify(diag.errors));
console.log('warnings :', JSON.stringify(diag.warnings?.slice(0, 4) ?? []));
console.log('view     :', JSON.stringify(diag.view));
console.log('lightBudget:', JSON.stringify(diag.lightBudget));
console.log('final    :', JSON.stringify(diag.pixels && {
  mean: diag.pixels.mean, std: diag.pixels.std, rgb: diag.pixels.rgb, colors: diag.pixels.colors,
}));

for (const p of diag.probes ?? []) {
  console.log(`\n--- ${p.name}  mean=${p.mean} std=${p.std} rgb=${JSON.stringify(p.rgb)} colors=${p.colors}`);
  for (const row of p.ascii) console.log('   |' + row + '|');
}
if (!diag.probes?.length) console.log('\n(没有探针数据 —— 检查 ?probe=1 是否生效)');
