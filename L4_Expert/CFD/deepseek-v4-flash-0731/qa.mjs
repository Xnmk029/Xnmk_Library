import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///G:/产品/新benchmark/CFD/v4f/index.html';
const OUT = 'G:\\产品\\新benchmark\\CFD\\v4f';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1680,950',
    '--no-first-run'
  ],
  defaultViewport: { width: 1680, height: 950 }
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});

await page.goto(URL, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 7000));

const probe = () => page.evaluate(() => {
  const b = window.__bench;
  if (!b) return { missing: true };
  const s = b.solver;
  const pos = s.pos;
  let finite = true;
  let maxSpeed = 0;
  for (let i = 0; i < pos.length; i++) {
    if (!Number.isFinite(pos[i])) { finite = false; break; }
  }
  for (let i = 0; i < s.speed.length; i++) {
    if (s.speed[i] > maxSpeed) maxSpeed = s.speed[i];
  }
  return {
    time: s.time,
    count: s.count,
    waterLevel: s.waterLevel,
    wavefront: s.wavefront,
    kinetic: s.kinetic,
    maxSpeed,
    finite,
    fps: b.fps,
    physMs: b.physMs,
    paused: b.state.paused,
    pixels: b.countLitPixels(),
    gateVisible: b.dam.gate.visible
  };
});

await page.screenshot({ path: OUT + '\\qa_tab2.png' });

const r1 = await probe();
console.log('=== TAB2 AFTER 7s ===');
console.log(JSON.stringify(r1, null, 2));

// pause + single step
await page.click('#btnPause');
const t1 = (await probe()).time;
await page.click('#btnStep');
const t2 = (await probe()).time;
console.log('step delta =', (t2 - t1).toFixed(6), 'expected dt =', (await probe()).count ? 'ok' : 'bad');

// reset
await page.click('#btnReset');
await page.waitForFunction(
  () => window.__bench && window.__bench.dam.gate.visible === true,
  { timeout: 6000 }
);
const afterReset = await probe();
console.log('after reset time =', afterReset.time, 'gate visible =', afterReset.gateVisible);

// preset high
await page.click('#presetSeg button[data-preset="high"]');
await new Promise((r) => setTimeout(r, 2500));
const high = await probe();
console.log('=== PRESET HIGH AFTER 2.5s ===');
console.log(JSON.stringify({ count: high.count, time: high.time, finite: high.finite, fps: high.fps }, null, 2));

// switch to tab1 placeholder
await page.click('#tabBtn1');
await new Promise((r) => setTimeout(r, 1500));
const tab1Canvas = await page.evaluate(() => {
  const c = document.querySelector('#gl1 canvas');
  return { exists: !!c, w: c ? c.width : 0, h: c ? c.height : 0 };
});
await page.screenshot({ path: OUT + '\\qa_tab1.png' });
console.log('tab1 canvas:', JSON.stringify(tab1Canvas));

console.log('JS ERRORS:', errors.length ? errors : 'none');
await browser.close();
