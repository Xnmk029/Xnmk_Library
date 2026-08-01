/**
 * tools/smoke_test.js — headless browser integration test
 * 1. starts server.js  2. loads the app in headless Chrome  3. collects console/errors
 * 4. waits for init, evaluates physics + rendering state, takes screenshots
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const results = { console: [], errors: [], timings: {} };

async function main() {
  // start server
  const server = spawn(process.execPath, [path.join(ROOT, '..', 'server.js'), '8123'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: false,
  });
  server.stdout.on('data', d => process.stdout.write('[server] ' + d));
  server.stderr.on('data', d => process.stderr.write('[server-err] ' + d));
  await new Promise(r => setTimeout(r, 1500));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 860 },
  });
  const page = await browser.newPage();
  page.on('console', (m) => {
    const t = m.type();
    const txt = m.text();
    results.console.push({ type: t, text: txt.slice(0, 300) });
    if (t === 'error') results.errors.push(txt.slice(0, 500));
  });
  page.on('pageerror', (e) => results.errors.push('PAGEERROR: ' + (e.message || e).slice(0, 500)));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.includes('fonts') && !u.includes('favicon')) results.errors.push('REQFAIL: ' + r.failure().errorText + ' ' + u.slice(0, 200));
  });

  const t0 = Date.now();
  await page.goto('http://localhost:8123/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  results.timings.nav = Date.now() - t0;

  // wait for ready flag
  const t1 = Date.now();
  try {
    await page.waitForFunction('window.__BEAMGL && window.__BEAMGL.ready === true', { timeout: 240000, polling: 500 });
    results.timings.ready = Date.now() - t1;
  } catch (e) {
    results.timings.ready = -1;
    results.errors.push('TIMEOUT waiting for ready');
  }

  // let it run 8s (physics + streaming)
  await new Promise(r => setTimeout(r, 8000));

  await page.evaluate(() => { navigator.getGamepads = () => []; });
  const probe = await page.evaluate(() => {
    const app = window.__BEAMGL;
    if (!app) return { noApp: true };
    return { hasHud: !!app.hud, fpsBox: app.hud ? !!app.hud.fpsBox : null, fpsBoxId: app.hud && app.hud.el ? !!app.hud.el.fpsBox : null, tiles: !!app.tiles, vis: !!app.vehicleVisual, city: !!app.city, post: !!app.post, poi: !!app.poi, camRig: !!app.cameraRig, audio: !!app.audio, tele: !!app.telemetry, pg: !!app.pg };
  });
  results.probe = probe;
  const pageErrors = await page.evaluate(() => window.__lastErrors || []);
  results.pageErrors = pageErrors;
  const state = await page.evaluate(() => {
    const app = window.__BEAMGL;
    if (!app) return { error: 'no app' };
    const v = app.vehicle;
    if (!v) return { error: 'no vehicle', ready: app.ready };
    try {
      const tele = v.telemetry();
      return {
        ready: app.ready,
        mass: Math.round(v.mass),
        wheels: v.wheels.length,
        wheel0Travel: v.wheels[0].compression.toFixed(4),
        rpm: Math.round(tele.rpm),
        speed: tele.speed.toFixed(2),
        pos: [v.body.pos.x.toFixed(2), v.body.pos.y.toFixed(2), v.body.pos.z.toFixed(2)],
        gear: tele.gear,
        tilesLoaded: app.tiles ? app.tiles.tiles.size : -1,
        tileStats: app.tiles ? app.tiles.stats : null,
        bodyMeshes: app.vehicleVisual ? app.vehicleVisual.bodyMeshes.length : 0,
        cityBuildings: app.city ? app.city.buildings.length : 0,
        cityRoads: app.city ? app.city.roads.length : 0,
        fps: app.hud && app.hud.el ? app.hud.el.fpsBox.textContent : '',
        canvasW: app.renderer.domElement.width,
        canvasH: app.renderer.domElement.height,
        zone: app.telemetry.curZone,
      };
    } catch (e) { return { error: e.message }; }
  });
  results.state = state;

  await page.screenshot({ path: path.join(ROOT, 'shot1.png') });

  // simulate driving: hold throttle, trace drivetrain dynamics
  await page.keyboard.down('KeyW');
  const trace = [];
  for (let s = 0; s < 6; s++) {
    await new Promise(r => setTimeout(r, 500));
    const t2 = await page.evaluate(() => {
      const v = window.__BEAMGL.vehicle;
      return {
        rpm: Math.round(v.drivetrain.rpm),
        wheelRPM: Math.round(v.drivetrain.wheelRPMToEngine((v.wheels[2].spinVel + v.wheels[3].spinVel) / 2, v.drivetrain.ratios[v.drivetrain.gear] || 0)),
        tq: Math.round(v.engineTorqueOut),
        speed: v.speed.toFixed(2),
        gear: v.drivetrain.gear,
        spins: v.wheels.map(w => w.spinVel.toFixed(1)),
        fx: v.wheels.map(w => (w.fxApplied || 0).toFixed(0)),
        force: v.body.force.toArray().map(x => x.toFixed(0)),
        vel: v.body.vel.toArray().map(x => x.toFixed(2)),
      };
    });
    trace.push(t2);
  }
  results.trace = trace;
  const st1 = await page.evaluate(() => { const a = window.__BEAMGL; a.__c = { ticks: 0, substeps: 0, dtSum: 0 }; const orig = a.tick.bind(a); a.tick = () => { a.__c.ticks++; orig(); }; return a.vehicle.time; });
  await new Promise(r => setTimeout(r, 2000));
  const st2 = await page.evaluate(() => { const a = window.__BEAMGL; return { t: a.vehicle.time, c: a.__c }; });
  results.simRate = { simAdvance: +(st2.t - st1).toFixed(2), wall: 2.0, ticks: st2.c.ticks, substeps: st2.c.substeps };
  await page.keyboard.up('KeyW');
  const driving = await page.evaluate(() => {
    const app = window.__BEAMGL;
    const tele = app.vehicle.telemetry();
    return {
      speed: tele.speed.toFixed(2), rpm: Math.round(tele.rpm), gear: tele.gear,
      pos: [app.vehicle.body.pos.x.toFixed(2), app.vehicle.body.pos.z.toFixed(2)],
      wheelTq: app.vehicle.wheelTorque.map(v => v.toFixed(0)),
      engineTq: app.vehicle.engineTorqueOut.toFixed(0),
      loads: app.vehicle.wheels.map(w => w.load.toFixed(0)),
      spins: app.vehicle.wheels.map(w => w.spinVel.toFixed(2)),
      slips: app.vehicle.wheels.map(w => w.slip.toFixed(2)),
      throttle: app.vehicle.input.throttle,
      y: app.vehicle.body.pos.y.toFixed(3),
    };
  });
  await page.keyboard.up('KeyW');
  results.driving = driving;
  await page.screenshot({ path: path.join(ROOT, 'shot2.png') });

  // validation
  const val = await page.evaluate(() => {
    const app = window.__BEAMGL;
    app.teleportTo(0, 105);           // cobble zone
    return 'teleported';
  });
  await new Promise(r => setTimeout(r, 2500));
  const valRows = await page.evaluate(() => {
    const app = window.__BEAMGL;
    return app.telemetry.validate();
  });
  results.validation = valRows;
  await page.screenshot({ path: path.join(ROOT, 'shot3.png') });

  await browser.close();
  server.kill();

  // report
  console.log('\n================ SMOKE TEST REPORT ================');
  console.log(JSON.stringify(results, null, 2));
  const errCount = results.errors.length;
  const errors = results.errors.filter(e => !e.includes('favicon'));
  console.log('ERRORS:', errors.length);
  for (const e of errors.slice(0, 20)) console.log('  ✗', e);
  const ok = results.state && results.state.ready && errCount < 5 && results.driving && results.driving.speed > 2;
  console.log(ok ? '\nRESULT: PASS ✓' : '\nRESULT: FAIL ✗');
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('SMOKE TEST CRASH', e.message);
  console.error('COLLECTED CONSOLE:');
  for (const c of results.console.slice(-40)) console.error('  [' + c.type + ']', c.text);
  process.exit(2);
});
