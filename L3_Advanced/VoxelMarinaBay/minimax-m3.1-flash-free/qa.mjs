// Headless QA harness: loads the app, drives it, captures screenshots + console.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('C:/Users/Administrator/AppData/Roaming/npm/node_modules/');
const puppeteer = require('puppeteer-core');

const HERE = 'F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/_src';
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const APP = 'file:///F:/bench-runs/minimax-m3.1-flash-free/20261019-202531-VoxelMarinaBay/voxel-marina-bay.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const steps = JSON.parse(process.argv[2] || '[]');
const HEADFUL = process.argv.includes('--gpu');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: HEADFUL ? false : 'new',
  protocolTimeout: 600000,
  args: [
    '--allow-file-access-from-files',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--window-size=1600,900',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-sandbox'
  ],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 }
});
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
page.on('requestfailed', r => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

console.log('loading…');
const t0 = Date.now();
await page.goto(APP, { waitUntil: 'load', timeout: 180000 });
console.log('loaded in', Date.now() - t0, 'ms');

const READY_TIMEOUT = (process.argv.find(a => a.startsWith('--ready-timeout=')) || '').split('=')[1];
try {
  await page.waitForFunction('window.__ready === true', { timeout: READY_TIMEOUT ? +READY_TIMEOUT : 240000, polling: 500 });
  console.log('app ready in', Date.now() - t0, 'ms');
} catch (e) {
  console.log('NOT READY:', e.message);
  const st = await page.evaluate(() => ({ status: document.querySelector('#status')?.textContent, err: document.querySelector('#err')?.textContent })).catch(() => null);
  console.log('loader state:', JSON.stringify(st));
  console.log('---- console so far (' + logs.length + ') ----');
  for (const l of logs.slice(0, 40)) console.log(l);
  await browser.close();
  process.exit(1);
}

for (const s of steps) {
  if (s.eval) {
    if (HEADFUL) { try { await page.bringToFront(); } catch (e) {} }
    try { const r = await page.evaluate(s.eval); if (r !== undefined) console.log(`eval ${s.name || ''}:`, JSON.stringify(r).slice(0, 900)); }
    catch (e) { console.log('eval error:', e.message); }
  }
  if (s.wait) await new Promise(r => setTimeout(r, s.wait));
  if (s.shot) {
    await page.screenshot({ path: path.join(SHOTS, s.shot + '.png') });
    console.log('shot ->', s.shot);
  }
}
console.log('---- console (' + logs.length + ') ----');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
