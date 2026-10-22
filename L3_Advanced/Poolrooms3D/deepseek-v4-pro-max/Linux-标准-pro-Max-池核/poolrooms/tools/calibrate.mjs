// Calibration harness: loads the sim once, then sweeps look parameters / camera poses,
// screenshotting and analyzing each variant so tuning is driven by numbers instead of guesswork.
//
// Usage:
//   node tools/calibrate.mjs                       # default sweep
//   node tools/calibrate.mjs --plan poses          # camera pose survey with current settings
//   node tools/calibrate.mjs --plan sweep --out /tmp/cal
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { decodePNG, analyze, diff } from './analyze.mjs';

const argv = process.argv.slice(2);
const arg = (n, d = null) => {
  const i = argv.indexOf('--' + n);
  return i === -1 ? d : argv[i + 1];
};
const PLAN = arg('plan', 'sweep');
const OUT = arg('out', '/tmp/cal');
const W = Number(arg('w', 1280));
const H = Number(arg('h', 720));
const URL_ = arg('url', 'http://127.0.0.1:4318/');

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl',
    '--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist',
    '--disable-gpu-vsync', '--disable-frame-rate-limit',
    `--window-size=${W},${H}`,
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (process.env.VERBOSE) console.log('[' + m.type() + '] ' + m.text());
});

await page.goto(URL_, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__poolrooms && window.__poolrooms.ready === true', { timeout: 60000 });
await page.evaluate('window.__poolrooms.begin(); window.__poolrooms.lockQuality(true)');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1200);

const shoot = async (label) => {
  const file = `${OUT}/${label}.png`;
  await page.screenshot({ path: file });
  const st = analyze(decodePNG(fs.readFileSync(file)), 3);
  return { label, file, st };
};

const report = (r, extra = '') => {
  const s = r.st;
  console.log(
    `${r.label.padEnd(26)} luma ${String(s.meanLuma).padEnd(6)} med ${String(s.medianLuma).padEnd(6)} ` +
      `p05 ${String(s.p05).padEnd(6)} p95 ${String(s.p95).padEnd(6)} white% ${String(s.whitePct).padEnd(5)} ` +
      `black% ${String(s.blackPct).padEnd(5)} sat ${String(s.saturation).padEnd(5)} edge ${String(s.edgeEnergy).padEnd(7)} ${extra}`,
  );
};

// A tour of viewpoints that exercises the interesting surfaces.
const POSES = [
  { name: 'deck-forward', yaw: 0.8, pitch: -0.05 },
  { name: 'deck-down', yaw: 0.8, pitch: -0.85 },
  { name: 'deck-up', yaw: 0.8, pitch: 0.75 },
  { name: 'spin-90', yaw: 0.8 + Math.PI / 2, pitch: -0.1 },
  { name: 'spin-180', yaw: 0.8 + Math.PI, pitch: -0.1 },
  { name: 'spin-270', yaw: 0.8 + Math.PI * 1.5, pitch: -0.1 },
];

async function poseSurvey(tag = '') {
  const rows = [];
  for (const p of POSES) {
    await page.evaluate(`window.__poolrooms.look(${p.yaw}, ${p.pitch})`);
    await sleep(700);
    const r = await shoot(`${tag}${p.name}`);
    const probe = await page.evaluate('window.__poolrooms.probe()');
    report(r, `fwd=${probe.fwd ? probe.fwd.dist + 'm ' + probe.fwd.mat : 'sky'} up=${probe.up ? probe.up.dist + 'm' : 'SKY'} down=${probe.down ? probe.down.dist + 'm' : 'VOID'}`);
    rows.push({ ...r, probe });
  }
  return rows;
}

if (PLAN === 'uw') {
  // Dive and sweep the in-water absorption / scattering.
  const pool = await page.evaluate(`
    (() => {
      let best = null;
      for (const s of window.__poolrooms.water.surfaces) {
        const r = s.rect;
        const area = (r.x1 - r.x0) * (r.z1 - r.z0);
        const depth = r.surface - r.bottom;
        if (area < 25 || depth < 1.5) continue;
        const score = depth * 60 + Math.min(area, 300);
        if (!best || score > best.score) best = { score, depth, rect: r };
      }
      return best;
    })()
  `);
  const r = pool.rect;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  await page.evaluate(`window.__poolrooms.teleport(${cx}, ${r.bottom + 0.1}, ${cz})`);
  await page.evaluate('window.__poolrooms.press("down", true)');
  await sleep(2400);
  await page.evaluate('window.__poolrooms.look(0.8, 0.15)');
  const st = await page.evaluate('window.__poolrooms.stats()');
  console.log('submerged =', st.submerged, 'pos', JSON.stringify(st.position));
  const VARIANTS = [
    ['current', {}],
    ['softer red absorb', { uwAbsorb: [0.11, 0.05, 0.042], uwScatter: [0.06, 0.22, 0.25] }],
    ['neutral-ish', { uwAbsorb: [0.085, 0.048, 0.042], uwScatter: [0.09, 0.20, 0.22] }],
    ['clear water', { uwAbsorb: [0.065, 0.04, 0.036], uwScatter: [0.10, 0.18, 0.20] }],
  ];
  for (const [label, t] of VARIANTS) {
    await page.evaluate(`window.__poolrooms.tune(${JSON.stringify(t)})`);
    await sleep(1200);
    const v = await shoot('uw-' + label.replace(/[^a-z]+/gi, '-'));
    report(v, JSON.stringify(t));
  }
  await page.evaluate('window.__poolrooms.press("down", false)');
} else if (PLAN === 'gallery') {
  // Capture a set of representative views for human review.
  const dir = arg('gdir', 'gallery');
  fs.mkdirSync(dir, { recursive: true });
  const grab = async (name, note) => {
    const file = `${dir}/${name}.png`;
    await page.screenshot({ path: file });
    const st = analyze(decodePNG(fs.readFileSync(file)), 3);
    console.log(`  ${name.padEnd(26)} luma ${String(st.meanLuma).padEnd(6)} sat ${String(st.saturation).padEnd(5)} edge ${String(st.edgeEnergy).padEnd(7)} white% ${String(st.whitePct).padEnd(5)} ${note}`);
  };

  await sleep(1600);
  await grab('01-spawn-atrium', 'the view you get on load');

  const st0 = await page.evaluate('window.__poolrooms.stats()');
  const [sx, sy, sz] = st0.position;

  await page.evaluate(`window.__poolrooms.look(${await page.evaluate('window.__poolrooms.player.yaw')}, 0.62)`);
  await sleep(900);
  await grab('02-skylight-up', 'looking up at the skylight / god rays');

  await page.evaluate(`window.__poolrooms.look(${await page.evaluate('window.__poolrooms.player.yaw')}, -0.75)`);
  await sleep(900);
  await grab('03-deck-down', 'wet deck tiles + reflections underfoot');

  // Biggest deep pool: rim view, then underwater.
  const pool = await page.evaluate(`
    (() => {
      let best = null;
      for (const s of window.__poolrooms.water.surfaces) {
        const r = s.rect;
        const area = (r.x1 - r.x0) * (r.z1 - r.z0);
        const depth = r.surface - r.bottom;
        if (area < 25) continue;
        const score = depth * 60 + Math.min(area, 300);
        if (!best || score > best.score) best = { score, area, depth, rect: r };
      }
      return best;
    })()
  `);
  if (pool) {
    const r = pool.rect;
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    await page.evaluate(`window.__poolrooms.teleport(${cx}, 0.05, ${r.z0 - 1.4})`);
    await page.evaluate('window.__poolrooms.look(Math.PI, -0.30)');
    await sleep(1300);
    await grab('04-pool-rim', `deep pool ${pool.depth.toFixed(1)}m: refraction + depth gradient`);
    await page.evaluate('window.__poolrooms.look(Math.PI, -0.05)');
    await sleep(900);
    await grab('05-pool-level', 'grazing angle: reflections on the water');
    await page.evaluate(`window.__poolrooms.teleport(${cx}, ${r.bottom + 0.1}, ${cz})`);
    await page.evaluate('window.__poolrooms.press("down", true)');
    await sleep(2200);
    await page.evaluate('window.__poolrooms.look(0.8, 0.2)');
    await sleep(1100);
    await grab('06-underwater', 'submerged: absorption, caustics, Snell window');
    await page.evaluate('window.__poolrooms.look(0.8, 0.95)');
    await sleep(900);
    await grab('07-underwater-surface', 'looking up at the underside of the surface');
    await page.evaluate('window.__poolrooms.press("down", false)');
  }

  // Shallow hall: caustics are strongest here.
  const shallow = await page.evaluate(`
    (() => {
      let best = null;
      for (const s of window.__poolrooms.water.surfaces) {
        const r = s.rect;
        const area = (r.x1 - r.x0) * (r.z1 - r.z0);
        if (r.surface - r.bottom > 1.0 || area < 40) continue;
        if (!best || area > best.area) best = { area, rect: r };
      }
      return best;
    })()
  `);
  if (shallow) {
    const r = shallow.rect;
    await page.evaluate(`window.__poolrooms.teleport(${(r.x0 + r.x1) / 2}, 0.2, ${(r.z0 + r.z1) / 2})`);
    await page.evaluate('window.__poolrooms.look(0.9, -0.35)');
    await sleep(1600);
    await grab('08-shallow-caustics', 'ankle-deep hall: caustics on the tile floor');
    await page.evaluate('window.__poolrooms.look(0.9, 0.05)');
    await sleep(900);
    await grab('09-shallow-far', 'columns receding into the mist');
  }

  // Back to spawn, then a couple of walked-to views.
  await page.evaluate(`window.__poolrooms.teleport(${sx}, ${sy}, ${sz})`);
  await page.evaluate('window.__poolrooms.press("fwd", true); window.__poolrooms.press("run", true)');
  await sleep(5000);
  await page.evaluate('window.__poolrooms.press("fwd", false); window.__poolrooms.press("run", false)');
  await sleep(1200);
  await grab('10-walked-away', 'somewhere else entirely, after running for 5s');
  console.log('  saved to ' + dir + '/');
} else if (PLAN === 'perfclean') {
  // Measure exactly one configuration on a freshly loaded page: no feature toggles, no tier
  // changes, nothing that could leave state behind.
  const tier = arg('tier', null);
  if (tier) {
    await page.evaluate(`window.__poolrooms.setTier('${tier}')`);
    await sleep(1500);
  }
  const flagsArg = arg('flags', null);
  if (flagsArg) {
    await page.evaluate(`window.__poolrooms.flags(${flagsArg})`);
    await sleep(1500);
  }
  await page.evaluate('window.__poolrooms.flags({ gpuSync: true })');
  const runs = [];
  for (let i = 0; i < 4; i++) {
    await sleep(1200);
    await page.evaluate('window.__poolrooms.perfReset()');
    await sleep(2400);
    runs.push((await page.evaluate('window.__poolrooms.perfRead()')).renderMs);
  }
  const good = runs.filter((v) => v > 1.0).sort((a, b) => a - b);
  const med = good[Math.floor(good.length / 2)];
  const st = await page.evaluate('window.__poolrooms.stats()');
  console.log(
    `  ${(arg('label', tier || st.tier)).padEnd(18)} ${st.renderSize.join('x').padEnd(10)} render ${med.toFixed(2).padStart(6)} ms -> ${(1000 / med).toFixed(0).padStart(4)} fps` +
      `  draws=${st.drawCalls}  [${runs.map((v) => v.toFixed(1)).join(' ')}]`,
  );
} else if (PLAN === 'firstview') {
  // Exactly what a visitor sees on load: no teleport, no look override.
  await sleep(1500);
  const st = await page.evaluate('window.__poolrooms.stats()');
  const probe = await page.evaluate('window.__poolrooms.probe()');
  const hdr = await page.evaluate("window.__poolrooms.hdrProbe('hdrRT')");
  console.log('spawn      ', JSON.stringify(st.position), 'archetype ring:', st.archetypes.slice(0, 3).join(','));
  console.log('probe      ', JSON.stringify(probe));
  console.log('hdr        ', JSON.stringify(hdr));
  const base = await shoot('firstview');
  report(base, 'first frame');
  const baseImg = decodePNG(fs.readFileSync(base.file));
  await page.evaluate('window.__poolrooms.flags({ water: false })');
  await sleep(900);
  const nw = await shoot('firstview-nowater');
  const d = diff(baseImg, decodePNG(fs.readFileSync(nw.file)));
  console.log(`water in first view -> meanAbsDiff ${d.meanAbs} changed ${d.changedPct}%  (grid ${JSON.stringify(d.grid)})`);
  await page.evaluate('window.__poolrooms.flags({ water: true })');
} else if (PLAN === 'move') {
  // Directed movement probe: hold W on a fixed heading and measure metres per second.
  await page.evaluate('window.__poolrooms.flags({ gpuSync: false })');
  const start = await page.evaluate('window.__poolrooms.stats()');
  console.log('spawn', JSON.stringify(start.position), 'archetype[0]', start.archetypes[0]);
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2;
    await page.evaluate(`window.__poolrooms.teleport(${start.position[0]}, ${start.position[1]}, ${start.position[2]})`);
    await page.evaluate(`window.__poolrooms.look(${yaw}, 0)`);
    await sleep(300);
    const a = await page.evaluate('window.__poolrooms.stats()');
    await page.evaluate('window.__poolrooms.press("fwd", true); window.__poolrooms.press("run", true)');
    await sleep(4000);
    const b = await page.evaluate('window.__poolrooms.stats()');
    await page.evaluate('window.__poolrooms.press("fwd", false); window.__poolrooms.press("run", false)');
    const d = Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);
    const probe = await page.evaluate('window.__poolrooms.probe()');
    console.log(
      `  yaw ${(yaw).toFixed(2)}: moved ${d.toFixed(1)} m in 4 s (${(d / 4).toFixed(2)} m/s)  ` +
        `y ${a.position[1].toFixed(2)}->${b.position[1].toFixed(2)} onGround=${b.onGround} inWater=${b.inWater} ` +
        `fwdHit=${probe.fwd ? probe.fwd.dist + 'm ' + probe.fwd.mat : 'open'}`,
    );
  }
} else if (PLAN === 'walk') {
  // Drive the player around for a while and watch for traps, falls, streaming stalls and errors.
  const seconds = Number(arg('secs', 60));
  await page.evaluate('window.__poolrooms.flags({ gpuSync: false })');
  const log = [];
  let yaw = 0.6;
  await page.evaluate('window.__poolrooms.press("fwd", true)');
  const t0 = Date.now();
  let stuckFor = 0;
  let last = null;
  while ((Date.now() - t0) / 1000 < seconds) {
    // Steer like a wall follower: only turn when the way ahead is blocked.
    const probe0 = await page.evaluate('window.__poolrooms.probe()');
    const ahead = probe0.fwd ? probe0.fwd.dist : 99;
    if (ahead < 1.6) yaw += (Math.random() > 0.5 ? 1 : -1) * (0.9 + Math.random() * 0.9);
    else if (Math.random() > 0.82) yaw += (Math.random() - 0.5) * 0.9;
    await page.evaluate(`window.__poolrooms.look(${yaw}, ${(Math.random() - 0.6) * 0.35})`);
    await page.evaluate(`window.__poolrooms.press("run", ${Math.random() > 0.35})`);
    if (Math.random() > 0.7) {
      await page.evaluate('window.__poolrooms.press("up", true)');
      await sleep(120);
      await page.evaluate('window.__poolrooms.press("up", false)');
    }
    await sleep(1400);
    const st = await page.evaluate('window.__poolrooms.stats()');
    if (last) {
      const d = Math.hypot(st.position[0] - last[0], st.position[2] - last[2]);
      if (d < 0.35) stuckFor++;
      else stuckFor = 0;
    }
    last = st.position;
    log.push(st);
  }
  await page.evaluate('window.__poolrooms.press("fwd", false)');

  const ys = log.map((s) => s.position[1]);
  const xs = log.map((s) => s.position[0]);
  const zs = log.map((s) => s.position[2]);
  const fpsAll = log.map((s) => s.fps).filter((v) => v > 0);
  const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const arche = new Set(log.flatMap((s) => s.archetypes));
  console.log(`  samples          ${log.length}`);
  console.log(`  travel span      ${span.toFixed(1)} m   (x ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}, z ${Math.min(...zs).toFixed(0)}..${Math.max(...zs).toFixed(0)})`);
  console.log(`  y range          ${Math.min(...ys).toFixed(2)} .. ${Math.max(...ys).toFixed(2)}`);
  console.log(`  fps min/med      ${Math.min(...fpsAll).toFixed(0)} / ${fpsAll.sort((a, b) => a - b)[Math.floor(fpsAll.length / 2)].toFixed(0)}`);
  console.log(`  chunks resident  ${[...new Set(log.map((s) => s.chunks))].join(',')}   pending max ${Math.max(...log.map((s) => s.pending))}`);
  console.log(`  in water samples ${log.filter((s) => s.inWater).length}   submerged ${log.filter((s) => s.submerged).length}`);
  console.log(`  stuck streak     ${stuckFor}`);
  console.log(`  archetypes seen  ${[...arche].join(', ')}`);
  const bad = [];
  if (Math.min(...ys) < -8) bad.push('fell below the world');
  if (Math.max(...ys) > 12) bad.push('ended up above the ceilings');
  if (span < 15) bad.push('barely moved — possible trap');
  if (stuckFor > 6) bad.push('stuck at the end');
  console.log(bad.length ? '  PROBLEMS: ' + bad.join('; ') : '  no traversal problems detected');
} else if (PLAN === 'caustics') {
  // Stand in a big SHALLOW pool and compare caustics off / normal / cranked.
  const pool = await page.evaluate(`
    (() => {
      let best = null;
      for (const s of window.__poolrooms.water.surfaces) {
        const r = s.rect;
        const area = (r.x1 - r.x0) * (r.z1 - r.z0);
        const depth = r.surface - r.bottom;
        if (depth > 1.0 || area < 40) continue;
        if (!best || area > best.area) best = { area, depth, rect: r };
      }
      return best;
    })()
  `);
  console.log('shallow pool:', JSON.stringify(pool));
  const r = pool.rect;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  await page.evaluate(`window.__poolrooms.teleport(${cx}, 0.05, ${cz})`);
  await page.evaluate('window.__poolrooms.look(0.6, -0.55)');
  await page.evaluate('window.__poolrooms.flags({ freeze: true })');
  await sleep(1600);
  const st = await page.evaluate('window.__poolrooms.stats()');
  console.log('stats:', JSON.stringify({ pos: st.position, inWater: st.inWater, submerged: st.submerged }));

  const shots = {};
  for (const c of [0, 0.5, 1, 2]) {
    await page.evaluate(`window.__poolrooms.tune({ caustics: ${c} })`);
    await sleep(1100);
    const v = await shoot('caustic-' + c);
    shots[c] = decodePNG(fs.readFileSync(v.file));
    report(v, 'causticStrength=' + c);
  }
  for (const c of [0.5, 1, 2]) {
    const d = diff(shots[0], shots[c]);
    console.log(`  caustics ${String(c).padStart(2)} vs 0 -> meanAbsDiff ${d.meanAbs} changed ${d.changedPct}% maxAbs ${d.maxAbs.toFixed(0)}`);
  }
  await page.evaluate('window.__poolrooms.tune({ caustics: 1 })');
} else if (PLAN === 'water') {
  // Find the biggest resident pool and inspect it from the rim, then from underwater.
  const pool = await page.evaluate(`
    (() => {
      const p = window.__poolrooms;
      let best = null;
      for (const s of p.water.surfaces) {
        const r = s.rect;
        const area = (r.x1 - r.x0) * (r.z1 - r.z0);
        const depth = r.surface - r.bottom;
        if (area < 25) continue;
        const score = depth * 100 + Math.min(area, 200);
        if (!best || score > best.score) best = { score, area, depth, rect: r };
      }
      return best;
    })()
  `);
  console.log('pool:', JSON.stringify(pool));
  const r = pool.rect;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;

  // 1. From the rim, looking down into the water.
  const standZ = r.z0 - 1.3;
  await page.evaluate(`window.__poolrooms.teleport(${cx}, 0.05, ${standZ})`);
  // yaw 0 faces -z, so PI faces +z, i.e. towards the pool we just stepped back from.
  await page.evaluate('window.__poolrooms.look(Math.PI, -0.42)');
  await sleep(1200);
  let st = await page.evaluate('window.__poolrooms.stats()');
  console.log('rim stats:', JSON.stringify({ pos: st.position, inWater: st.inWater, submerged: st.submerged }));
  await page.evaluate('window.__poolrooms.flags({ freeze: true })');
  await sleep(1200);
  const rim = await shoot('water-rim');
  report(rim, 'looking down into the pool');
  const rimImg = decodePNG(fs.readFileSync(rim.file));
  for (const [name, off] of [['caustics', { caustics: false }], ['ssr', { ssr: false }], ['bloom', { bloom: false }], ['water', { water: false }]]) {
    await page.evaluate(`window.__poolrooms.flags(${JSON.stringify(off)})`);
    await sleep(900);
    const v = await shoot('water-rim-no-' + name);
    const d = diff(rimImg, decodePNG(fs.readFileSync(v.file)));
    console.log(`  ${name.padEnd(9)} off -> meanAbsDiff ${String(d.meanAbs).padEnd(7)} changed ${d.changedPct}%`);
    const on = {};
    for (const k of Object.keys(off)) on[k] = true;
    await page.evaluate(`window.__poolrooms.flags(${JSON.stringify(on)})`);
  }

  // 2. Submerged in the middle of the pool.
  await page.evaluate('window.__poolrooms.flags({ freeze: false })');
  // Put the feet just above the basin floor so the eye sits well below the surface.
  const feet = r.bottom + 0.08;
  await page.evaluate(`window.__poolrooms.teleport(${cx}, ${feet}, ${cz})`);
  await page.evaluate('window.__poolrooms.press("down", true)');
  await sleep(2500);
  st = await page.evaluate('window.__poolrooms.stats()');
  console.log('dive stats:', JSON.stringify({ pos: st.position, inWater: st.inWater, submerged: st.submerged }));
  for (const [name, yaw, pitch] of [['under-level', 0, -0.1], ['under-up', 0, 0.95], ['under-down', 0, -0.9]]) {
    await page.evaluate(`window.__poolrooms.look(${yaw}, ${pitch})`);
    await sleep(900);
    const v = await shoot('water-' + name);
    const probe = await page.evaluate('window.__poolrooms.probe()');
    report(v, `submerged=${st.submerged} eye=${JSON.stringify(probe.eye)}`);
  }
  await page.evaluate('window.__poolrooms.press("down", false)');
} else if (PLAN === 'bound') {
  await page.evaluate('window.__poolrooms.flags({ gpuSync: true }); window.__poolrooms.setTier("high")');
  const measure = async (label) => {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await sleep(900);
      await page.evaluate('window.__poolrooms.perfReset()');
      await sleep(1800);
      runs.push((await page.evaluate('window.__poolrooms.perfRead()')).renderMs);
    }
    const good = runs.filter((v) => v > 1.0).sort((a, b) => a - b);
    const med = good.length ? good[Math.floor(good.length / 2)] : Math.max(...runs);
    const st = await page.evaluate('window.__poolrooms.stats()');
    console.log(`  ${label.padEnd(30)} ${med.toFixed(2).padStart(6)} ms -> ${(1000 / med).toFixed(0).padStart(4)} fps  draws=${String(st.drawCalls).padStart(3)} size=${st.renderSize.join('x')}  [${runs.map((v) => v.toFixed(1)).join(' ')}]`);
    return med;
  };
  await measure('baseline high 1080p');
  await page.evaluate('window.__poolrooms.flags({ radius: 1 })');
  await measure('chunk radius 1 (9 chunks)');
  await page.evaluate('window.__poolrooms.flags({ radius: 2 })');
  await page.evaluate('window.__poolrooms.qual({ renderScale: 0.5 })');
  await measure('renderScale 0.5');
  await page.evaluate('window.__poolrooms.qual({ renderScale: 1.0 })');
  await page.evaluate('window.__poolrooms.flags({ prepass: false })');
  await measure('no gbuffer prepass');
  await page.evaluate('window.__poolrooms.flags({ prepass: true, water: false, fog: false, ssgi: false, ssr: false, taa: false, bloom: false })');
  await measure('forward+prepass only');
  await page.evaluate('window.__poolrooms.flags({ prepass: false })');
  await measure('forward only');
} else if (PLAN === 'qsweep') {
  await page.evaluate('window.__poolrooms.flags({ gpuSync: true }); window.__poolrooms.setTier("high")');
  const measure = async (label) => {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await sleep(1000);
      await page.evaluate('window.__poolrooms.perfReset()');
      await sleep(1800);
      runs.push((await page.evaluate('window.__poolrooms.perfRead()')).renderMs);
    }
    const good = runs.filter((v) => v > 1.0).sort((a, b) => a - b);
    const med = good.length ? good[Math.floor(good.length / 2)] : Math.max(...runs);
    console.log(`  ${label.padEnd(34)} ${med.toFixed(2).padStart(6)} ms -> ${(1000 / med).toFixed(0).padStart(4)} fps  [${runs.map((v) => v.toFixed(1)).join(' ')}]`);
    return med;
  };
  const VARIANTS = [
    ['high baseline (6x12 .5)', {}],
    ['ssgi 6x14 scale .6', { ssgiRays: 6, ssgiSteps: 14, ssgiScale: 0.6 }],
    ['+ fog 28 scale .6', { fogSteps: 28, fogScale: 0.6 }],
    ['+ ssr 30 / water 30', { ssrSteps: 30 }],
    ['+ shadow 4096', { shadowMapSize: 4096 }],
    ['ssgi 8x16 scale .7', { ssgiRays: 8, ssgiSteps: 16, ssgiScale: 0.7 }],
    ['ssgi full res 6x12', { ssgiRays: 6, ssgiSteps: 12, ssgiScale: 1.0 }],
  ];
  for (const [label, q] of VARIANTS) {
    const applied = await page.evaluate(`window.__poolrooms.qual(${JSON.stringify(q)})`);
    await measure(label);
    void applied;
  }
} else if (PLAN === 'split') {
  // CPU submission cost vs CPU+GPU cost, to tell whether we are draw-call bound.
  const run = async (label, sync) => {
    await page.evaluate(`window.__poolrooms.flags({ gpuSync: ${sync} })`);
    const runs = [];
    let last = {};
    for (let i = 0; i < 4; i++) {
      await sleep(1100);
      await page.evaluate('window.__poolrooms.perfReset()');
      await sleep(2000);
      const pr = await page.evaluate('window.__poolrooms.perfRead()');
      runs.push(pr.renderMs);
      last = pr;
    }
    const good = runs.filter((v) => v > 0.2).sort((a, b) => a - b);
    const med = good[Math.floor(good.length / 2)];
    console.log(`  ${label.padEnd(28)} ${med.toFixed(2).padStart(6)} ms   [${runs.map((v) => v.toFixed(1)).join(' ')}]  player ${last.playerMs}ms world ${last.worldMs}ms`);
    return med;
  };
  const st = await page.evaluate('window.__poolrooms.stats()');
  console.log('size', st.renderSize.join('x'), 'draws/frame', st.drawCalls, 'tier', st.tier);
  const cpu = await run('CPU submit only (no sync)', false);
  const both = await run('CPU + GPU (finish)', true);
  console.log(`  => GPU-side ~${(both - cpu).toFixed(2)} ms, CPU-side ~${cpu.toFixed(2)} ms`);
  await page.evaluate('window.__poolrooms.setTier("high")');
  await page.evaluate('window.__poolrooms.flags({ water: false })');
  const noWater = await run('CPU+GPU, water hidden', true);
  console.log(`  => water costs ~${(both - noWater).toFixed(2)} ms`);
} else if (PLAN === 'perfrepeat') {
  await page.evaluate('window.__poolrooms.flags({ freeze: false, gpuSync: true })');
  for (let i = 0; i < 6; i++) {
    await sleep(1500);
    await page.evaluate('window.__poolrooms.perfReset()');
    await sleep(2600);
    const p = await page.evaluate('window.__poolrooms.perfRead()');
    const st = await page.evaluate('window.__poolrooms.stats()');
    console.log(`  run ${i}: render ${p.renderMs} ms (${p.fpsFromRender} fps) rAF ${p.avgFrameMs} n=${p.renderSamples} draws=${st.drawCalls} tris=${st.triangles} chunks=${st.chunks} waters=${st.waterSurfaces}`);
  }
} else if (PLAN === 'perf') {
  await page.evaluate('window.__poolrooms.flags({ freeze: false, gpuSync: true })');
  // Headless Chromium intermittently skips real GL execution for a window, producing absurdly low
  // samples; take the median of three runs and drop implausible ones.
  const measure = async (label) => {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await sleep(1200);
      await page.evaluate('window.__poolrooms.perfReset()');
      await sleep(2200);
      const p = await page.evaluate('window.__poolrooms.perfRead()');
      runs.push(p.renderMs);
    }
    const good = runs.filter((v) => v > 1.6).sort((a, b) => a - b);
    const med = good.length ? good[Math.floor(good.length / 2)] : Math.max(...runs);
    const st = await page.evaluate('window.__poolrooms.stats()');
    console.log(
      `  ${label.padEnd(22)} render ${med.toFixed(2).padStart(6)} ms -> ${(1000 / med).toFixed(0).padStart(4)} fps` +
        `   [${runs.map((v) => v.toFixed(1)).join(' ')}]  draws=${st.drawCalls} tris=${(st.triangles / 1000).toFixed(0)}k`,
    );
    return { avgFrameMs: med };
  };
  const stats = await page.evaluate('window.__poolrooms.stats()');
  console.log('render size', stats.renderSize.join('x'), 'tier', stats.tier);
  const full = await measure('everything on');
  const STEPS = [
    ['no TAA', { taa: false }],
    ['no SSGI/SSR', { ssgi: false, ssr: false }],
    ['no fog', { fog: false }],
    ['no bloom', { bloom: false }],
    ['no water', { water: false }],
    ['no shadows', { shadows: false }],
  ];
  for (const [label, off] of STEPS) {
    await page.evaluate(`window.__poolrooms.flags(${JSON.stringify(off)})`);
    const p = await measure(label);
    console.log(`      -> saves ${(full.avgFrameMs - p.avgFrameMs).toFixed(2)} ms`);
    const on = {};
    for (const k of Object.keys(off)) on[k] = true;
    await page.evaluate(`window.__poolrooms.flags(${JSON.stringify(on)})`);
  }
  for (const tier of ['low', 'medium', 'high', 'ultra']) {
    await page.evaluate(`window.__poolrooms.setTier('${tier}')`);
    await sleep(900);
    await measure('tier ' + tier);
  }
} else if (PLAN === 'features') {
  // For each subsystem: capture ON, capture OFF, and report how much it changes the frame.
  // A near-zero difference means the feature is silently doing nothing.
  const pose = { yaw: Number(arg('yaw', 0.8)), pitch: Number(arg('pitch', -0.12)) };
  const spot = arg('at', null);
  if (spot) {
    const [x, y, z] = spot.split(',').map(Number);
    await page.evaluate(`window.__poolrooms.teleport(${x}, ${y}, ${z})`);
  }
  await page.evaluate(`window.__poolrooms.look(${pose.yaw}, ${pose.pitch})`);
  await sleep(900);

  await page.evaluate('window.__poolrooms.flags({ freeze: true })');
  await sleep(1400);
  const base = await shoot('feat-all-on');
  report(base);
  const baseImg = decodePNG(fs.readFileSync(base.file));
  await sleep(700);
  const again = await shoot('feat-all-on-2');
  const floor = diff(baseImg, decodePNG(fs.readFileSync(again.file)));
  console.log(`  [noise floor] repeat capture meanAbsDiff ${floor.meanAbs} changed ${floor.changedPct}%`);

  const FEATURES = [
    ['taa', { taa: false }],
    ['ssgi', { ssgi: false }],
    ['ssr', { ssr: false }],
    ['fog', { fog: false }],
    ['bloom', { bloom: false }],
    ['caustics', { caustics: false }],
    ['shadows', { shadows: false }],
    ['water', { water: false }],
    ['motes', { motes: false }],
  ];
  for (const [name, off] of FEATURES) {
    await page.evaluate(`window.__poolrooms.flags(${JSON.stringify(off)})`);
    await sleep(900);
    const r = await shoot('feat-no-' + name);
    const d = diff(baseImg, decodePNG(fs.readFileSync(r.file)));
    console.log(
      `  ${name.padEnd(9)} off -> meanAbsDiff ${String(d.meanAbs).padEnd(7)} changed ${String(d.changedPct).padEnd(6)}% maxAbs ${String(d.maxAbs).padEnd(4)} ` +
        `luma ${r.st.meanLuma} sat ${r.st.saturation} edge ${r.st.edgeEnergy}`,
    );
    const on = {};
    for (const k of Object.keys(off)) on[k] = true;
    await page.evaluate(`window.__poolrooms.flags(${JSON.stringify(on)})`);
    await sleep(400);
  }
} else if (PLAN === 'tour') {
  // Walk the resident chunk spawns and report how each location exposes.
  const spots = await page.evaluate(`
    [...window.__poolrooms.streamer.chunks.values()].map((c) => ({
      key: c.key, archetype: c.chunk.archetype, spawn: c.chunk.spawn,
    })).filter((c) => c.spawn).slice(0, 10)
  `);
  const sun = await page.evaluate('window.__poolrooms.sunProbe(300)');
  console.log('sunProbe:', JSON.stringify(sun));
  for (const sp of spots) {
    await page.evaluate(`window.__poolrooms.teleport(${sp.spawn[0]}, ${sp.spawn[1] + 0.1}, ${sp.spawn[2]})`);
    let best = null;
    for (const yaw of [0.4, 1.9, 3.4, 4.9]) {
      await page.evaluate(`window.__poolrooms.look(${yaw}, -0.08)`);
      await sleep(450);
      const hdr = await page.evaluate("window.__poolrooms.hdrProbe('hdrRT')");
      if (!best || hdr.lumaMax > best.hdr.lumaMax) best = { yaw, hdr };
    }
    await page.evaluate(`window.__poolrooms.look(${best.yaw}, -0.08)`);
    await sleep(500);
    const r = await shoot(`tour-${sp.archetype}-${sp.key.replace(',', '_')}`);
    report(r, `hdrMean=${best.hdr.lumaMean} hdrP95=${best.hdr.lumaP95} hdrMax=${best.hdr.lumaMax}`);
  }
} else if (PLAN === 'exposure') {
  for (const e of [1.0, 1.2, 1.4, 1.6, 1.9, 2.2]) {
    await page.evaluate(`window.__poolrooms.tune({ exposure: ${e} })`);
    await sleep(800);
    const r = await shoot('exp-' + e);
    const hdr = await page.evaluate("window.__poolrooms.hdrProbe('sceneA')");
    report(r, `hdrLuma=${hdr.lumaMean} hdrP95=${hdr.lumaP95} hdrMax=${hdr.lumaMax}`);
  }
} else if (PLAN === 'poses') {
  const stats = await page.evaluate('window.__poolrooms.stats()');
  console.log('stats:', JSON.stringify(stats));
  await poseSurvey();
} else if (PLAN === 'sweep') {
  // Sweep the exposure/lighting rig; the goal is mean luma ~0.42-0.58 with p95 < 0.97,
  // white clipping under ~4%, and saturation above ~0.1.
  const variants = [
    { label: 'base', tune: {} },
    { label: 'sun2.6-env0.55-e1.0', tune: { sun: 2.6, fill: 0.12, env: 0.55, exposure: 1.0, gi: 0.7 } },
    { label: 'sun2.0-env0.40-e0.9', tune: { sun: 2.0, fill: 0.1, env: 0.4, exposure: 0.9, gi: 0.6 } },
    { label: 'sun1.6-env0.30-e0.8', tune: { sun: 1.6, fill: 0.08, env: 0.3, exposure: 0.8, gi: 0.5 } },
    { label: 'sun3.2-env0.65-e0.7', tune: { sun: 3.2, fill: 0.12, env: 0.65, exposure: 0.7, gi: 0.8 } },
    { label: 'sun1.2-env0.22-e0.75', tune: { sun: 1.2, fill: 0.06, env: 0.22, exposure: 0.75, gi: 0.45 } },
    { label: 'sun0.9-env0.16-e0.7', tune: { sun: 0.9, fill: 0.05, env: 0.16, exposure: 0.7, gi: 0.4 } },
  ];
  for (const v of variants) {
    const applied = await page.evaluate(`window.__poolrooms.tune(${JSON.stringify(v.tune)})`);
    await sleep(900);
    const r = await shoot('sweep-' + v.label);
    report(r, JSON.stringify(applied));
  }
}

if (errors.length) console.log('\nERRORS:\n' + errors.slice(0, 10).join('\n'));
await browser.close();
