/**
 * Headless smoke test for the browser app.
 *
 * Loads both pages in Chromium, drives the car for a few seconds, and fails on
 * any page error, failed request or console error. Node tests cover the DSP and
 * the physics; this covers everything that only exists once WebGL and
 * AudioWorklet are real -- shader compilation, the import map, the worklet
 * module load, texture generation, and the render loop actually running.
 *
 *   node tools/browser-check.js
 *   node tools/browser-check.js --url http://localhost:8080 --shot out.png
 *
 * Requires the dev server to be up (`npm start`) and playwright to be
 * installed; it is deliberately NOT a dependency, so this stays optional.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = { url: 'http://localhost:8080', shot: null, drive: 5000, headless: true };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i].replace(/^--/, '');
  if (k in args) {
    const v = process.argv[i + 1];
    args[k] = /^\d+$/.test(v) ? Number(v) : v;
    i++;
  }
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('playwright is not installed:  npm i -D playwright');
  process.exit(2);
}

/** Prefer a pre-provisioned browser if the environment supplies one. */
function findExecutable() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    process.env.PLAYWRIGHT_BROWSERS_PATH
      ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium')
      : null,
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || undefined;
}

const problems = [];
const browser = await chromium.launch({
  executablePath: findExecutable(),
  headless: args.headless !== 'false',
  args: [
    // Software GL, so this runs on a machine with no GPU.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--no-sandbox',
  ],
});

async function check(pagePath, label, run) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => problems.push(`${label}: uncaught ${e.message}`));
  page.on('requestfailed', (r) =>
    problems.push(`${label}: request failed ${r.url()} (${r.failure()?.errorText})`)
  );
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`${label}: console error ${m.text().slice(0, 200)}`);
  });
  await page.goto(args.url + pagePath, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);
  const result = await run(page);
  await page.close();
  return result;
}

// --- simulator --------------------------------------------------------
const sim = await check('/', 'index', async (page) => {
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(args.drive * 0.6);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(args.drive * 0.4);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(500);
  // Exercise every keybinding that rebuilds something.
  for (const key of ['KeyC', 'KeyC', 'KeyK', 'KeyV', 'BracketRight', 'KeyM', 'KeyR', 'KeyN']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
  }
  if (args.shot) await page.screenshot({ path: args.shot });
  return page.evaluate(() => {
    const s = window.sim;
    if (!s) throw new Error('window.sim missing -- the app did not start');
    const t = s.vehicle.telemetry();
    return {
      moved: Math.hypot(t.x - s.track.startPose.x, t.z - s.track.startPose.z) > 1,
      engineRunning: s.vehicle.engine.running,
      audioReady: s.audio.ready,
      audioError: s.audio.failed ? String(s.audio.failed.message) : null,
      drawCalls: s.renderer.info.render.calls,
      triangles: s.renderer.info.render.triangles,
      programs: s.renderer.info.programs.length,
      textures: s.renderer.info.memory.textures,
      finite: [t.x, t.z, t.yaw, t.rpm, t.speed].every(Number.isFinite),
      trackLength: Math.round(s.track.spline.length),
      fps: Math.round(s.fps),
    };
  });
});

// --- audio lab --------------------------------------------------------
const lab = await check('/audio-lab.html', 'audio-lab', async (page) => {
  await page.click('#start');
  await page.waitForTimeout(1200);
  await page.click('#sweep');
  await page.waitForTimeout(2500);
  await page.selectOption('#engine', 'flatplane-v8-64');
  await page.waitForTimeout(600);
  await page.selectOption('#room', 'tunnel');
  await page.waitForTimeout(600);
  return page.evaluate(() => ({
    audioReady: window.lab.audio.ready,
    audioError: window.lab.audio.failed ? String(window.lab.audio.failed.message) : null,
    engine: window.lab.state.engineKey,
  }));
});

await browser.close();

console.log('simulator  ', JSON.stringify(sim));
console.log('audio lab  ', JSON.stringify(lab));

// --- assertions -------------------------------------------------------
const fail = (cond, msg) => {
  if (cond) problems.push(msg);
};
fail(!sim.moved, 'the car did not move under throttle');
fail(!sim.engineRunning, 'the engine did not start');
fail(!sim.finite, 'telemetry went non-finite');
fail(!sim.audioReady, `engine audio failed to start: ${sim.audioError}`);
fail(!lab.audioReady, `audio lab failed to start: ${lab.audioError}`);
fail(sim.drawCalls < 20, `suspiciously few draw calls (${sim.drawCalls}) -- scene may be empty`);
fail(sim.drawCalls > 400, `draw calls regressed to ${sim.drawCalls}`);
fail(sim.triangles < 10000, `suspiciously few triangles (${sim.triangles})`);
fail(lab.engine !== 'flatplane-v8-64', 'engine swap did not take effect');

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nok - both pages load, render and make sound with no errors');
