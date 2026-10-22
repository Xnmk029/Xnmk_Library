import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '../../L1_Basic/BilibiliUserscript/node_modules/playwright-core/index.mjs';
import { ROOT } from '../../L1_Basic/BilibiliUserscript/harness/runner.mjs';
import { installMonitor } from '../../L1_Basic/BilibiliUserscript/harness/monitor.mjs';
import { makeRecords } from '../../L1_Basic/BilibiliUserscript/harness/data.mjs';
import { replayHTML } from '../../L1_Basic/BilibiliUserscript/fixtures/replay.mjs';

const out = path.join(ROOT, 'runs/review-20261015');
await fs.mkdir(out, {recursive: true});
const code = await fs.readFile(path.join(out, 'overlay-gap.user.js'), 'utf8');
const browser = await chromium.launch({headless: true, channel: 'msedge'});
try {
  const context = await browser.newContext({serviceWorkers: 'block'});
  await context.route('**/*', route => route.fulfill({contentType: 'text/html', body: replayHTML({framework: 'vue3', scenario: 'controls', records: makeRecords('20261015', 'U02', 'controls')})}));
  await context.addInitScript({content: '(' + installMonitor.toString() + ')();\n' + code + '\nlocalStorage["review-probe"]="synthetic";'});
  const page = await context.newPage();
  await page.goto('https://www.bilibili.com/blackboard/replay.html');
  await page.waitForTimeout(1900);
  const before = await page.evaluate(() => {
    const b = document.querySelector('[data-replay-key] button');
    const r = b.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    return {x, y, hitElementId: document.elementFromPoint(x,y)?.id, clicks: window.__replayFixture.clicks(), storageValue: localStorage.getItem('review-probe'), storageEvents: window.__replayEvents.filter(e => e.type === 'persistent-write')};
  });
  await page.mouse.click(before.x, before.y);
  const coveredClicks = await page.evaluate(() => window.__replayFixture.clicks());
  await page.evaluate(() => document.getElementById('review-overlay').remove());
  await page.mouse.click(before.x, before.y);
  const uncoveredClicks = await page.evaluate(() => window.__replayFixture.clicks());
  const evidence = {browser: browser.version(), before, coveredClicks, uncoveredClicks, overlayConfirmed: coveredClicks === before.clicks && uncoveredClicks === before.clicks + 1, storageGapConfirmed: before.storageValue === 'synthetic' && before.storageEvents.length === 0};
  await fs.writeFile(path.join(out, 'gap-proof.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
  if (!evidence.overlayConfirmed || !evidence.storageGapConfirmed) process.exitCode = 1;
} finally { await browser.close(); }
