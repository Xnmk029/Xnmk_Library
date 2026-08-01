// E2E smoke test: drives the real page in headless Chrome via CDP,
// waits for BOOT_OK, lets the sim run real frames, then screenshots.
// Usage: node test/e2e/shoot.mjs [url] [outPng] [waitMs]
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:8080/?test=1';
const out = process.argv[3] || '../shot_e2e.png';
const waitMs = Number(process.argv[4] || 6000);

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--window-size=1280,720', '--mute-audio'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
try {
  await page.waitForFunction(
    () => document.getElementById('boot-log') && document.getElementById('boot-log').textContent.includes('BOOT_OK'),
    { timeout: 90000 },
  );
  console.log('BOOT_OK detected');
} catch {
  const log = await page.evaluate(() => document.getElementById('boot-log')?.textContent || '(no boot-log)');
  console.log('BOOT TIMEOUT. boot-log:\n' + log);
}
await new Promise((r) => setTimeout(r, waitMs)); // let the sim run real frames
const state = await page.evaluate(() => {
  const log = document.getElementById('boot-log')?.textContent || '';
  const frames = (log.match(/frame \d+ rendered/g) || []).pop() || 'no frames';
  const speed = document.getElementById('speedNum')?.textContent || '?';
  return { frames, speed };
});
console.log('state:', JSON.stringify(state));
await page.screenshot({ path: out });
console.log('screenshot -> ' + out);
if (errors.length) console.log('errors:\n' + errors.slice(0, 8).join('\n'));
await browser.close();
