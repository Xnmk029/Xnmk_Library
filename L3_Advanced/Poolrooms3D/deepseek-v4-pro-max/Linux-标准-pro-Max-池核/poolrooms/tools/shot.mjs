// Headless visual verification harness.
//
// Usage:
//   node tools/shot.mjs --url http://127.0.0.1:4318/ --out /tmp/shot.png [--wait 6000]
//        [--w 1280] [--h 720] [--swiftshader] [--script "await page.keyboard.down('KeyW')"]
//        [--shots 3] [--every 1500] [--eval "window.__poolrooms.stats()"]
//
// Prints every console message, page error and failed request, then the result of --eval.
// Exit code 1 if a page error or console error was seen.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name, def = null) => {
  const i = argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

const URL_ = arg('url', 'http://127.0.0.1:4318/');
const OUT = arg('out', '/tmp/poolrooms-shot.png');
const WAIT = Number(arg('wait', 7000));
const W = Number(arg('w', 1280));
const H = Number(arg('h', 720));
const SHOTS = Number(arg('shots', 1));
const EVERY = Number(arg('every', 1500));
const EVAL = arg('eval', null);
const SCRIPT = arg('script', null);

const gpuFlags = arg('swiftshader')
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : ['--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--enable-webgl2-compute-context',
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    `--window-size=${W},${H}`,
    ...gpuFlags,
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

const errors = [];
page.on('console', async (m) => {
  const t = m.type();
  let text = `[${t}] ${m.text()}`;
  if (m.text().includes('JSHandle')) {
    try {
      const parts = await Promise.all(
        m.args().map((a) => a.evaluate((v) => (v && v.stack ? v.stack : String(v))).catch(() => '?')),
      );
      text = `[${t}] ` + parts.join(' ');
    } catch {}
  }
  console.log(text);
  if (t === 'error') errors.push(text);
});
page.on('pageerror', (e) => {
  const text = `[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`;
  console.log(text);
  errors.push(text);
});
page.on('requestfailed', (r) => {
  const text = `[requestfailed] ${r.url()} ${r.failure()?.errorText}`;
  console.log(text);
  errors.push(text);
});

await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });

// Wait for the app to finish booting, then dismiss the click-to-start veil.
try {
  await page.waitForFunction('window.__poolrooms && window.__poolrooms.ready === true', { timeout: 40000 });
  console.log('[boot] app ready');
} catch {
  console.log('[boot] window.__poolrooms never became ready');
}
try {
  await page.mouse.click(Math.floor(W / 2), Math.floor(H / 2));
  await page.evaluate('window.__poolrooms && window.__poolrooms.begin && window.__poolrooms.begin()');
} catch {}

await new Promise((r) => setTimeout(r, WAIT));

if (SCRIPT) {
  // eslint-disable-next-line no-new-func
  const fn = new Function('page', 'sleep', `return (async () => { ${SCRIPT} })()`);
  await fn(page, (ms) => new Promise((r) => setTimeout(r, ms)));
}

const shot = async (i) => {
  const out = SHOTS > 1 ? OUT.replace(/\.png$/, `-${i}.png`) : OUT;
  await page.screenshot({ path: out });
  console.log('[shot] ' + out + ' ' + (fs.statSync(out).size / 1024).toFixed(0) + 'kB');
};

for (let i = 0; i < SHOTS; i++) {
  if (i > 0) await new Promise((r) => setTimeout(r, EVERY));
  await shot(i);
}

if (EVAL) {
  try {
    const v = await page.evaluate(EVAL);
    console.log('[eval] ' + JSON.stringify(v, null, 2));
  } catch (e) {
    console.log('[eval-error] ' + e.message);
    errors.push('eval: ' + e.message);
  }
}

const fatalText = await page.evaluate(() => document.getElementById('fatal')?.textContent || '');
if (fatalText) console.log('[fatal-overlay]\n' + fatalText.slice(0, 1500));

const info = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  let gl = null;
  let renderer = 'n/a';
  try {
    gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
  } catch {}
  return { canvas: c ? `${c.width}x${c.height}` : 'none', renderer };
});
console.log('[gl] ' + JSON.stringify(info));

await browser.close();
console.log(errors.length ? `\n=== ${errors.length} ERROR(S) ===` : '\n=== clean run ===');
process.exit(errors.length ? 1 : 0);
