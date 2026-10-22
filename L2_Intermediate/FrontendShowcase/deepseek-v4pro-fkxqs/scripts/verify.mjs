/**
 * Headless verification pass for NEUROLINK//OS-4.
 *
 *   node scripts/verify.mjs [url]
 *
 * Requires a running dev server (npm run dev) and a local Chrome.
 * Checks: zero console errors, zero page errors, no horizontal scrollbar at
 * 1080p/1440p, all interactive systems present, hover retint, dossier
 * transition, wheel-driven field response. Writes screenshots to artifacts/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://127.0.0.1:5183/';
const OUT = path.resolve('artifacts');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('no chrome/edge binary found');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1920,1080',
  ],
});

const page = await browser.newPage();
const consoleErrors = [];
const consoleWarnings = [];
const pageErrors = [];
const failedRequests = [];

page.on('console', (msg) => {
  const t = msg.type();
  const text = msg.text();
  if (t === 'error') consoleErrors.push(text);
  else if (t === 'warning' || t === 'warn') consoleWarnings.push(text);
});
page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
page.on('requestfailed', (req) => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`));
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
});

await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await sleep(600);

// ---- boot overlay ---------------------------------------------------------
const bootPresent = await page.$('.boot');
record('boot overlay renders', Boolean(bootPresent));
await page.screenshot({ path: path.join(OUT, '01-boot-1080p.png') });

await page.evaluate(() => {
  const b = document.querySelector('.boot');
  if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForFunction(() => !document.querySelector('.boot'), { timeout: 8000 });
await sleep(1200);

// Instant (non-smooth) scrolling keeps the probe coordinates deterministic.
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = 'auto';
});
const scrollTo = async (id) => {
  await page.evaluate((sid) => document.getElementById(sid).scrollIntoView({ block: 'start' }), id);
  await page
    .waitForFunction(
      () => {
        const y = window.scrollY;
        if (window.__lastY === y) return true;
        window.__lastY = y;
        return false;
      },
      { polling: 120, timeout: 6000 },
    )
    .catch(() => {});
  await sleep(450);
};

// ---- structural systems --------------------------------------------------
const struct = await page.evaluate(() => ({
  bgCanvas: Boolean(document.querySelector('canvas.bg-canvas')),
  glCanvas: document.querySelectorAll('.viewport-canvas canvas').length,
  classRows: document.querySelectorAll('.class-row').length,
  bentoCards: document.querySelectorAll('.bento-card').length,
  scrambles: document.querySelectorAll('[data-scramble]').length,
  oplog: document.querySelectorAll('.oplog-row').length,
  ticker: Boolean(document.querySelector('.hud-ticker-track')),
  vignette: getComputedStyle(document.body, '::after').background.includes('gradient'),
}));
record('canvas bezier field mounted', struct.bgCanvas);
record('webgl 3d viewport mounted', struct.glCanvas === 1, `${struct.glCanvas} canvas`);
record('four class entries', struct.classRows === 4, `${struct.classRows} rows`);
record('bento skill cards', struct.bentoCards === 7, `${struct.bentoCards} cards`);
record('scramble instances', struct.scrambles > 20, `${struct.scrambles} nodes`);
record('ops log rows', struct.oplog === 12, `${struct.oplog} rows`);
record('hud ticker present', struct.ticker);

// ---- canvas actually painting (non-empty pixels) -------------------------
await page.mouse.move(960, 460);
await sleep(700);
const painted = await page.evaluate(() => {
  const c = document.querySelector('canvas.bg-canvas');
  if (!c) return 0;
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 6) lit += 1;
  return lit;
});
record('bezier field is painting pixels', painted > 200, `${painted} lit samples`);

// ---- theme retint on hover ----------------------------------------------
const themeAt = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--theme').trim());
const base = await themeAt();
record('default theme = class 01 green', base === '#23ff00', base);

await scrollTo('classes');
await page.mouse.move(6, 6); // park the pointer somewhere inert first
await sleep(300);
const classRows = await page.$$('.class-row');
await classRows[1].hover();
await sleep(900);
const hovered = await themeAt();
record('hover class 02 retints field to orange', hovered === '#ffaa00', hovered);

const readGuide = () =>
  page.evaluate(() => {
    const lit = document.querySelectorAll('.class-row')[1].querySelector('.class-guide-lit');
    return lit ? lit.getBoundingClientRect().width : -1;
  });
await page
  .waitForFunction(
    () => {
      const lit = document.querySelectorAll('.class-row')[1].querySelector('.class-guide-lit');
      return Boolean(lit) && lit.getBoundingClientRect().width > 40;
    },
    { timeout: 5000, polling: 100 },
  )
  .catch(() => {});
const guide = await readGuide();
record('guide line extended on hover', guide > 40, `${guide.toFixed(1)}px`);
await page.screenshot({ path: path.join(OUT, '02-classes-hover-1080p.png') });

// ---- dossier transition -------------------------------------------------
await classRows[1].click();
await page.waitForSelector('.dossier-panel', { timeout: 15000 });
await sleep(1100);
const dossier = await page.evaluate(() => {
  const p = document.querySelector('.dossier-panel');
  return {
    ok: Boolean(p),
    code: document.querySelector('.dossier-code')?.textContent?.trim(),
    missions: document.querySelectorAll('.dmission').length,
    gauges: document.querySelectorAll('.dossier-col .bar').length,
  };
});
record('dossier sub-page opens', dossier.ok, `${dossier.code}`);
record('dossier missions rendered', dossier.missions === 3, `${dossier.missions}`);
record('dossier gauges rendered', dossier.gauges === 5, `${dossier.gauges}`);
await page.screenshot({ path: path.join(OUT, '03-dossier-1080p.png') });

await page.keyboard.press('ArrowRight');
await sleep(900);
const stepped = await page.evaluate(() => document.querySelector('.dossier-code')?.textContent?.trim());
record('dossier prev/next class step', stepped === 'SYS-03', String(stepped));

await page.keyboard.press('Escape');
let closed = true;
await page
  .waitForFunction(() => !document.querySelector('.dossier-panel'), { timeout: 15000, polling: 150 })
  .catch(() => {
    closed = false;
  });
record('dossier closes on escape', closed);

// ---- wheel wave + scroll through every section --------------------------
for (const id of ['viewport', 'matrix', 'oplog']) {
  await scrollTo(id);
  await page.mouse.wheel({ deltaY: 260 });
  await sleep(900);
}
await scrollTo('matrix');
await sleep(1500);

const bentoReveal = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.bento-card'));
  const shown = cards.filter((c) => Number(getComputedStyle(c).opacity) > 0.9).length;
  const bars = Array.from(document.querySelectorAll('.b-prof .bar-fill'));
  const grown = bars.filter((b) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(b).transform);
    return m.a > 0.4;
  }).length;
  return { shown, total: cards.length, grown, bars: bars.length };
});
record('bento cards revealed on scroll', bentoReveal.shown === bentoReveal.total, `${bentoReveal.shown}/${bentoReveal.total}`);
record('proficiency bars animated in', bentoReveal.grown === bentoReveal.bars, `${bentoReveal.grown}/${bentoReveal.bars}`);
await scrollTo('matrix');
await sleep(700);
await page.screenshot({ path: path.join(OUT, '04-bento-1080p.png') });

await scrollTo('viewport');
await sleep(1400);
await page.screenshot({ path: path.join(OUT, '05-viewport-1080p.png') });

// ---- switch class from the viewport tabs -------------------------------
await page.evaluate(() => document.querySelectorAll('.tab')[3].click());
await sleep(1300);
const tabTheme = await themeAt();
record('viewport tab switches class theme', tabTheme === '#ff0055', tabTheme);
await page.screenshot({ path: path.join(OUT, '06-viewport-class04-1080p.png') });

// ---- bezier field internals (250 ribbons / repulsion / wheel wave) -----
const fieldMeta = await page.evaluate(() => {
  const f = window.__NEUROLINK_FIELD__;
  return f ? { curves: f.curves, anchors: f.anchors, seg: f.segmentsPerCurve, radius: f.repelRadius } : null;
});
record(
  'field declares 250 bezier ribbons',
  Boolean(fieldMeta) && fieldMeta.curves === 250,
  fieldMeta ? `${fieldMeta.curves} ribbons × ${fieldMeta.seg} cubic segments (${fieldMeta.anchors} anchors)` : 'no hook',
);

await sleep(1200);
const tinted = await page.evaluate(() => window.__NEUROLINK_FIELD__.read());
record(
  'field colour eased to class 04 magenta',
  tinted.rgb[0] > 190 && tinted.rgb[1] < 90 && tinted.rgb[2] > 40,
  `rgb(${tinted.rgb.join(', ')}) · intensity ${tinted.intensity}`,
);

await page.mouse.move(1200, 620);
await sleep(400);
const repelState = await page.evaluate(() => window.__NEUROLINK_FIELD__.read());
record(
  'pointer repulsion field engaged',
  repelState.pointerActive === true,
  `pointer ${repelState.pointer.join(',')} · radius ${fieldMeta.radius}px`,
);

for (let i = 0; i < 6; i += 1) await page.mouse.wheel({ deltaY: 130 });
await sleep(90);
const waveState = await page.evaluate(() => window.__NEUROLINK_FIELD__.read());
record(
  'wheel input injects wave amplitude energy',
  waveState.wheelEnergy > 0.2 && Math.abs(waveState.scrollPhase) > 0,
  `energy ${waveState.wheelEnergy} · phase ${waveState.scrollPhase}`,
);
await sleep(2600);
// Drive real frames from inside the page: an idle headless renderer stops
// producing BeginFrames, which would freeze (not decay) the field. Measure the
// decay over a fixed number of *field frames* rather than wall-clock time.
const decayed = await page.evaluate(
  (startFrames) =>
    new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        const s = window.__NEUROLINK_FIELD__.read();
        if (s.frames - startFrames >= 60 || performance.now() - t0 > 9000) res(s);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }),
  waveState.frames,
);
record(
  'wave energy decays back to rest',
  decayed.wheelEnergy < waveState.wheelEnergy * 0.4,
  `${waveState.wheelEnergy} → ${decayed.wheelEnergy} over ${decayed.frames - waveState.frames} field frames`,
);
record(
  'field frame cost within budget',
  waveState.frameCostMs < 14,
  `${waveState.frameCostMs}ms/frame · quality tier ${waveState.quality}`,
);

// ---- clipped-content audit --------------------------------------------
await scrollTo('matrix');
await sleep(1200);
const clipAudit = await page.evaluate(() => {
  const sel = ['.bento-card', '.term', '.stack-list', '.viewport-stage', '.panel', '.class-row', '.oplog-row', '.prof-grid'];
  const out = [];
  sel.forEach((s) =>
    document.querySelectorAll(s).forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3) {
        out.push(`${s}[${el.className}] ${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight}`);
      }
    }),
  );
  return out;
});
record('no clipped panel/card content', clipAudit.length === 0, clipAudit.slice(0, 5).join(' | '));

// ---- layout integrity: no horizontal scrollbar -------------------------
async function overflowAt(w, h, tag) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    bsw: document.body.scrollWidth,
  }));
  record(`no horizontal scroll @ ${tag}`, m.sw <= m.cw && m.bsw <= m.cw, `scrollWidth ${m.sw} / client ${m.cw}`);
  await page.screenshot({ path: path.join(OUT, `07-identity-${tag}.png`) });
}
await overflowAt(1920, 1080, '1920x1080');
await overflowAt(2560, 1440, '2560x1440');
await overflowAt(1440, 900, '1440x900');

// ---- console hygiene ---------------------------------------------------
record('zero page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 400));
record('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 400));
record('zero failed requests', failedRequests.length === 0, failedRequests.join(' | ').slice(0, 400));
if (consoleWarnings.length) console.log(`note: ${consoleWarnings.length} console warning(s): ${consoleWarnings.slice(0, 4).join(' | ')}`);

await browser.close();

const failed = results.filter((r) => !r.ok);
const report = {
  url: URL,
  when: new Date().toISOString(),
  passed: results.length - failed.length,
  total: results.length,
  results,
  consoleWarnings,
};
await writeFile(path.join(OUT, 'verify-report.json'), JSON.stringify(report, null, 2), 'utf8');

console.log(`\n${report.passed}/${report.total} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
