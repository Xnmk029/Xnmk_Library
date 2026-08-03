import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///G:/产品/新benchmark/CFD/v4f/index.html';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1280,860',
    '--no-first-run'
  ],
  defaultViewport: { width: 1280, height: 860 }
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 4000));

const result = await page.evaluate(() => {
  const b = window.__bench;
  const out = {};
  const timeSteps = (count) => {
    const s = b.solver;
    // warmup
    for (let i = 0; i < 25; i++) s.step(s.dt);
    const t0 = performance.now();
    for (let i = 0; i < count; i++) s.step(s.dt);
    return (performance.now() - t0) / count;
  };
  const timeRender = (count) => {
    const r = b.renderer;
    const scene = b.dam.scene;
    const camera = b.dam.camera;
    for (let i = 0; i < 10; i++) r.render(scene, camera);
    const t0 = performance.now();
    for (let i = 0; i < count; i++) r.render(scene, camera);
    return (performance.now() - t0) / count;
  };
  out.medium = { count: b.solver.count, msStep: timeSteps(120), renderMs: timeRender(80), fps: b.fps };
  // switch to high
  document.querySelector('#presetSeg button[data-preset="high"]').click();
  return new Promise((resolve) => {
    setTimeout(() => {
      out.high = { count: b.solver.count, msStep: timeSteps(120), renderMs: timeRender(80), fps: b.fps };
      resolve(out);
    }, 1200);
  });
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
