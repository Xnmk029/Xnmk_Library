/**
 * Browser test suite.
 *
 * Drives the real application in a real Chromium through the Chrome DevTools
 * Protocol (puppeteer-core against the browser already installed on this
 * machine - no extra download). It covers exactly the four things the brief asks
 * for in the browser: the audio context, the driving inputs, the HUD and the
 * scene rendering.
 *
 *   node scripts/test-browser.mjs [--headful] [--keep-open]
 *
 * Artefacts (screenshots + a JSON report) land in artifacts/.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { startServer } from "./serve.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const ARTIFACTS = join(ROOT, "artifacts");
const headful = process.argv.includes("--headful");
const keepOpen = process.argv.includes("--keep-open");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function findBrowser() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`no Chrome/Edge binary found. Set CHROME_PATH. Tried: ${CHROME_CANDIDATES.join(", ")}`);
}

const results = [];
let failures = 0;

/**
 * @param {string} name
 * @param {() => Promise<any>} body
 */
async function check(name, body) {
  const started = Date.now();
  try {
    const detail = await body();
    results.push({ name, ok: true, ms: Date.now() - started, detail: detail ?? null });
    console.log(`  PASS  ${name}`);
    return detail;
  } catch (error) {
    failures++;
    results.push({ name, ok: false, ms: Date.now() - started, error: error?.message ?? String(error) });
    console.error(`  FAIL  ${name}: ${error?.message ?? error}`);
    return null;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

mkdirSync(ARTIFACTS, { recursive: true });

const server = await startServer({ port: 0, quiet: true });
console.log(`serving ${server.url}`);

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: !headful,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--disable-dev-shm-usage",
    "--window-size=1280,720",
    "--mute-audio",
  ],
  defaultViewport: { width: 1280, height: 720 },
});

const consoleErrors = [];
const pageErrors = [];
let page;

try {
  page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(server.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction("window.__DRIVE_SIM__ && window.__DRIVE_SIM__.ready === true", { timeout: 45000 });

  // --------------------------------------------------------------- scene
  const description = await check("the simulation boots and describes itself", async () => {
    const info = await page.evaluate(() => window.__DRIVE_SIM__.describe());
    assert(info.track.lengthM > 1500, `track length ${info.track.lengthM}`);
    assert(info.track.cornerCount >= 6, `corner count ${info.track.cornerCount}`);
    assert(info.engine.mainOrder === 4, `main order ${info.engine.mainOrder}`);
    assert(info.physicsHz >= 100, `physics rate ${info.physicsHz}`);
    return info;
  });

  await check("the scene actually renders geometry", async () => {
    const stats = await page.evaluate(async () => {
      window.__DRIVE_SIM__.advance(0.25, { render: false });
      window.__DRIVE_SIM__.advance(1 / 60, { render: true });
      return window.__DRIVE_SIM__.stats();
    });
    assert(stats.render.calls > 20, `only ${stats.render.calls} draw calls`);
    assert(stats.render.triangles > 20000, `only ${stats.render.triangles} triangles`);
    assert(stats.memory.geometries > 20, `only ${stats.memory.geometries} geometries`);
    assert(stats.memory.textures > 5, `only ${stats.memory.textures} textures`);
    return stats;
  });

  await check("the framebuffer contains a real image (not a blank canvas)", async () => {
    const sample = await page.evaluate(() => window.__DRIVE_SIM__.samplePixels());
    assert(sample.drawingBuffer.width > 800, `drawing buffer ${sample.drawingBuffer.width}`);
    assert(sample.variance > 40, `luminance variance ${sample.variance.toFixed(1)} - the frame looks flat`);
    assert(sample.uniqueColours > 40, `only ${sample.uniqueColours} distinct colours`);
    assert(sample.mean > 8 && sample.mean < 250, `mean luminance ${sample.mean.toFixed(1)}`);
    return sample;
  });

  // --------------------------------------------------------------- audio
  await check("the audio context starts from a user gesture", async () => {
    await page.click("#start-button");
    await page.waitForFunction("window.__DRIVE_SIM__.audioStatus().ready === true", { timeout: 20000 });
    const status = await page.evaluate(() => window.__DRIVE_SIM__.audioStatus());
    assert(status.supported, "AudioContext is not supported");
    assert(status.workletSupported, "AudioWorklet is not supported");
    assert(!status.error, `audio error: ${status.error}`);
    assert(status.sampleRate >= 8000, `sample rate ${status.sampleRate}`);
    assert(status.state === "running" || status.state === "suspended", `state ${status.state}`);
    return status;
  });

  await check("the worklet is pulling audio on the audio thread", async () => {
    await new Promise((r) => setTimeout(r, 1200));
    const status = await page.evaluate(() => {
      window.__DRIVE_SIM__.audioStatus();
      return new Promise((resolve) => setTimeout(() => resolve(window.__DRIVE_SIM__.audioStatus()), 400));
    });
    const diagnostics = status.diagnostics;
    assert(diagnostics, "no diagnostics message arrived from the worklet");
    assert(diagnostics.engine.frames > 1000, `worklet only rendered ${diagnostics.engine.frames} frames`);
    assert(diagnostics.engine.nonFiniteSamples === 0, `${diagnostics.engine.nonFiniteSamples} non-finite samples`);
    assert(diagnostics.engine.clippedSamples === 0, `${diagnostics.engine.clippedSamples} clipped samples`);
    assert(diagnostics.engine.rpm > 0, "the worklet has no rpm");
    return { frames: diagnostics.engine.frames, rpm: diagnostics.engine.rpm, peak: diagnostics.engine.peak };
  });

  await check("the offline audio self-test produces clean, stereo, bounded audio", async () => {
    const report = await page.evaluate(() => window.__DRIVE_SIM__.audioSelfTest({ seconds: 1.2, rpm: 4200 }));
    assert(report.supported, `self-test unsupported: ${report.reason}`);
    assert(report.nonFinite === 0, `${report.nonFinite} non-finite samples`);
    assert(report.clipped === 0, `${report.clipped} clipped samples`);
    assert(report.peak > 0.02, `peak ${report.peak.toFixed(4)} - the engine is silent`);
    assert(report.peak < 1, `peak ${report.peak.toFixed(4)} reaches full scale`);
    assert(report.rmsDb > -30 && report.rmsDb < -5, `rms ${report.rmsDb.toFixed(1)} dBFS`);
    assert(report.stereoDelta > 1e-4, "the two channels are identical - dual exhaust is not working");
    return report;
  });

  // ------------------------------------------------------------- driving
  const accelerated = await check("keyboard throttle accelerates the car through the gears", async () => {
    const before = await page.evaluate(() => window.__DRIVE_SIM__.telemetry());
    await page.keyboard.down("KeyW");
    const after = await page.evaluate(() => window.__DRIVE_SIM__.advance(8, { render: false }));
    assert(after.speedKph > 60, `only reached ${after.speedKph.toFixed(1)} km/h`);
    assert(after.rpm > 1500, `rpm ${after.rpm.toFixed(0)}`);
    assert(after.gearLabel !== "1" || after.speedKph > 60, `gear stuck at ${after.gearLabel}`);
    assert(after.distanceM > before.distanceM + 50, "the car did not travel");
    assert(Number.isFinite(after.speedKph) && Number.isFinite(after.rpm), "telemetry went non-finite");
    return { speedKph: after.speedKph, rpm: after.rpm, gear: after.gearLabel };
  });

  await check("the HUD shows what the simulation computed", async () => {
    const { telemetry, hud } = await page.evaluate(() => ({
      telemetry: window.__DRIVE_SIM__.telemetry(),
      hud: window.__DRIVE_SIM__.hudValues(),
    }));
    assert(hud.speed !== null, "the HUD has no speed element");
    const hudSpeed = Number(hud.speed);
    assert(Math.abs(hudSpeed - Math.round(Math.abs(telemetry.speedKph))) <= 1, `HUD ${hud.speed} vs telemetry ${telemetry.speedKph.toFixed(1)}`);
    const hudRpm = Number(hud.rpm);
    assert(Math.abs(hudRpm - Math.round(telemetry.rpm)) <= 25, `HUD rpm ${hud.rpm} vs ${telemetry.rpm.toFixed(0)}`);
    assert(hud.gear === telemetry.gearLabel, `HUD gear ${hud.gear} vs ${telemetry.gearLabel}`);
    assert(hud.order && hud.order.includes("Hz"), `order readout was "${hud.order}"`);
    assert(hud.camera === "chase", `camera readout ${hud.camera}`);
    assert(Number(hud.throttle.replace("%", "")) > 50, `throttle readout ${hud.throttle}`);
    return hud;
  });

  // ----------------------------------------------------------- sound lab
  await check("the L key opens the sound laboratory", async () => {
    await page.keyboard.press("KeyL");
    const opened = await page.evaluate(() => ({
      visible: window.__DRIVE_SIM__.lab.visible,
      dom: Boolean(document.getElementById("engine-lab")),
      cylinders: document.querySelectorAll(".lab-cylinder").length,
      columns: document.querySelectorAll(".lab-column").length,
    }));
    assert(opened.visible, "the lab did not open");
    assert(opened.dom, "the lab drawer is missing from the DOM");
    assert(opened.cylinders === 8, `expected 8 cylinder tiles, saw ${opened.cylinders}`);
    assert(opened.columns === 3, `expected 3 lab columns, saw ${opened.columns}`);
    await page.keyboard.press("KeyL");
    const closed = await page.evaluate(() => window.__DRIVE_SIM__.lab.visible);
    assert(!closed, "the lab did not close on the second L");
    await page.keyboard.press("KeyL"); // reopen for the following checks
    return opened;
  });

  await check("the lab shows every cylinder in firing order with correct data", async () => {
    const data = await page.evaluate(() => {
      window.__DRIVE_SIM__.advance(1, { render: false });
      const snapshot = window.__DRIVE_SIM__.lab.snapshot();
      const read = (id) => document.getElementById(id)?.textContent ?? null;
      return {
        snapshot,
        title: read("lab-title"),
        crank: read("lab-crank-degrees"),
        crankRpm: read("lab-crank-rpm"),
        names: Array.from(document.querySelectorAll("[id^=lab-cylinder-name-]")).map((n) => n.textContent),
        fireLamps: document.querySelectorAll(".lab-fire").length,
        liftBars: document.querySelectorAll(".lab-lift-fill").length,
        spectrum: read("lab-spectrum-legend"),
        driverStatus: read("lab-driver-status"),
      };
    });
    assert(JSON.stringify(data.snapshot.firingOrder) === JSON.stringify([1, 8, 4, 3, 6, 5, 7, 2]), `order ${data.snapshot.firingOrder}`);
    assert(
      JSON.stringify(data.names) === JSON.stringify(["C1", "C8", "C4", "C3", "C6", "C5", "C7", "C2"]),
      `tile order ${data.names}`,
    );
    assert(data.snapshot.cylinders.length === 8, "snapshot must contain 8 cylinders");
    assert(data.fireLamps === 8, "one fire lamp per cylinder");
    assert(data.liftBars === 16, "one exhaust + one intake bar per cylinder");
    assert(data.title.includes("cross-plane"), `title ${data.title}`);
    assert(data.crank && data.crank.includes("720"), `crank readout ${data.crank}`);
    assert(data.crankRpm && data.crankRpm.includes("deg/s"), `crank rpm readout ${data.crankRpm}`);
    assert(data.driverStatus === "off (T to engage)", `driver status ${data.driverStatus}`);
    // Phase must advance with rpm.
    const before = data.snapshot.phaseDeg;
    const after = await page.evaluate(() => {
      window.__DRIVE_SIM__.advance(1, { render: false });
      return window.__DRIVE_SIM__.lab.snapshot().phaseDeg;
    });
    assert(after !== before, "the crank phase is not advancing");
    assert(after >= 0 && after < 720, `phase ${after}`);
    return data.snapshot;
  });

  await check("fire lamps pulse as cylinders pass TDC", async () => {
    // Deterministic measurement at idle: the live animation loop is stopped,
    // so the only phase motion is the one requested here. At idle (~820 rpm)
    // the crank moves ~25 degrees per 0.05 s sample, far smaller than the fire
    // window - the crossing can never be skipped between two samples.
    const observed = await page.evaluate(() => {
      window.__DRIVE_SIM__.setFrameLoop(false);
      window.__DRIVE_SIM__.setAutoDrive(false);
      window.__DRIVE_SIM__.resetInputs();
      window.__DRIVE_SIM__.resetAt(0, { gearIndex: 2, autoShift: false });
      window.__DRIVE_SIM__.advance(1, { render: false }); // settle at idle
      window.__DRIVE_SIM__.lab.snapshot(); // ensure the lab is up to date
      let lit = 0;
      const phaseSamples = [];
      const rpmSamples = [];
      const phaseDeltas = [];
      let previous = null;
      for (let i = 0; i < 90; i++) {
        window.__DRIVE_SIM__.advance(0.05, { render: false });
        const snapshot = window.__DRIVE_SIM__.lab.snapshot();
        phaseSamples.push(Math.round(snapshot.phaseDeg));
        rpmSamples.push(Math.round(snapshot.rpm));
        if (previous !== null) {
          let delta = snapshot.phaseDeg - previous;
          if (delta < -360) delta += 720;
          if (delta > 360) delta -= 720;
          phaseDeltas.push(Math.round(delta));
        }
        previous = snapshot.phaseDeg;
        if (snapshot.cylinders.some((cylinder) => cylinder.firing)) lit++;
      }
      window.__DRIVE_SIM__.setFrameLoop(true);
      return {
        litFrames: lit,
        rpm: window.__DRIVE_SIM__.telemetry().rpm,
        phaseSamples,
        rpmSamples,
        phaseDeltas,
        edges: window.__DRIVE_SIM__.lab.snapshot().lastEdges,
        edgeCount: window.__DRIVE_SIM__.lab.snapshot().edgeCount,
      };
    });
    assert(observed.rpm > 500 && observed.rpm < 2000, `expected idle, saw ${observed.rpm.toFixed(0)} rpm`);
    assert(
      observed.litFrames >= 1,
      `no firing lamp ever lit (rpm ${observed.rpm}, edges ${observed.edgeCount}: ${JSON.stringify(observed.edges)}, deltas ${observed.phaseDeltas.slice(0, 6)}, phases ${observed.phaseSamples.slice(0, 6)})`,
    );
    // One firing per cylinder per 720 degrees: 8 events per two revolutions,
    // i.e. 4 events per revolution. At ~820 rpm that is ~30 events in 4.5 s.
    // Each lamp holds for 450 ms and 8 lamps overlap, so nearly every sample
    // shows *some* lamp lit - the physically meaningful invariant is the event
    // count, which the edge detector below checks.
    assert(observed.edgeCount >= 15, `expected ~30 firing events, detected ${observed.edgeCount}`);
    assert(observed.edgeCount < 55, `firing edge latching bug: ${observed.edgeCount} edges in 4.5 s at idle`);
    assert(observed.litFrames >= 1, "no fire lamp lit at all");
    return observed;
  });

  await check("the lab spectrum shows the live order comb and the engine is audible", async () => {
    const data = await page.evaluate(() => {
      window.__DRIVE_SIM__.advance(2, { render: false });
      return {
        legend: document.getElementById("lab-spectrum-legend")?.textContent ?? null,
        canvas: Boolean(document.getElementById("lab-spectrum-canvas")),
        analyser: window.__DRIVE_SIM__.audioStatus().analyserAttached,
      };
    });
    assert(data.analyser, "the AnalyserNode was not attached to the audio graph");
    assert(data.canvas, "the spectrum canvas is missing");
    assert(data.legend && data.legend.includes("o4"), `legend ${data.legend}`);
    assert(data.legend !== "audio not started" && data.legend !== "engine off", `legend ${data.legend}`);
    return data;
  });

  await check("the lab exposes the auto-driver decision chain", async () => {
    await page.evaluate(() => window.__DRIVE_SIM__.setAutoDrive(true));
    await page.evaluate(() => window.__DRIVE_SIM__.advance(3, { render: false }));
    const data = await page.evaluate(() => ({
      snapshot: window.__DRIVE_SIM__.lab.snapshot().driver,
      status: document.getElementById("lab-driver-status")?.textContent,
      target: document.getElementById("lab-driver-target")?.textContent,
      lookahead: document.getElementById("lab-driver-lookahead")?.textContent,
      ackermann: document.getElementById("lab-driver-ackermann")?.textContent,
      slipff: document.getElementById("lab-driver-slipff")?.textContent,
      heading: document.getElementById("lab-driver-heading")?.textContent,
      stanley: document.getElementById("lab-driver-stanley")?.textContent,
      throttle: document.getElementById("lab-driver-throttle")?.textContent,
      steer: document.getElementById("lab-driver-steer")?.textContent,
    }));
    assert(data.snapshot && data.snapshot.active, "auto-driver diagnostics never ran");
    assert(data.status.includes("engaged"), `status ${data.status}`);
    assert(data.target && data.target.includes("km/h"), `planned speed ${data.target}`);
    assert(data.lookahead && data.lookahead.includes("m"), `look-ahead ${data.lookahead}`);
    for (const [name, value] of [
      ["ackermann", data.ackermann],
      ["slip feed-forward", data.slipff],
      ["heading error", data.heading],
      ["cross-track", data.stanley],
      ["throttle", data.throttle],
      ["steer", data.steer],
    ]) {
      assert(value && !value.includes("--"), `${name} readout is "${value}"`);
    }
    assert(data.snapshot.ackermannRad !== data.snapshot.steerAngleRad, "the controller really adds slip/error terms");
    return data.snapshot;
  });

  await check("a lab screenshot is captured", async () => {
    await page.evaluate(() => {
      window.__DRIVE_SIM__.advance(2, { render: false });
      window.__DRIVE_SIM__.advance(1 / 60, { render: true });
    });
    const file = join(ARTIFACTS, "browser-lab.png");
    await page.screenshot({ path: file });
    assert(existsSync(file), "lab screenshot was not written");
    return file.replace(ROOT, ".");
  });

  await check("braking slows the car and lights the brake lamp", async () => {
    // Return to manual control (the lab checks left the auto driver engaged)
    // and rebuild some speed first, because the previous tests may have left
    // the car crawling off a corner.
    await page.evaluate(() => {
      window.__DRIVE_SIM__.setAutoDrive(false);
      window.__DRIVE_SIM__.reset();
      window.__DRIVE_SIM__.holdKeys(["KeyW"]);
      window.__DRIVE_SIM__.advance(5, { render: false });
    });
    await page.keyboard.down("KeyS");
    const before = await page.evaluate(() => window.__DRIVE_SIM__.telemetry());
    // Sample through the stop so the measurement is the braking phase, not the
    // stationary car at the end of it.
    const samples = await page.evaluate(() => {
      const trace = [];
      for (let i = 0; i < 24; i++) {
        const telemetry = window.__DRIVE_SIM__.advance(0.12, { render: false });
        trace.push({ speedKph: telemetry.speedKph, g: telemetry.longitudinalG, brake: telemetry.brake, absFront: telemetry.absFront });
      }
      return trace;
    });
    const hud = await page.evaluate(() => window.__DRIVE_SIM__.hudValues());
    const after = await page.evaluate(() => window.__DRIVE_SIM__.telemetry());
    await page.keyboard.up("KeyS");
    const peakDecel = Math.min(...samples.map((entry) => entry.g));
    const absActive = samples.some((entry) => entry.absFront < 0.95);
    assert(after.speedKph < before.speedKph - 20, `speed went ${before.speedKph.toFixed(1)} -> ${after.speedKph.toFixed(1)} km/h`);
    assert(Math.max(...samples.map((entry) => entry.brake)) > 0.5, "brake input never rose");
    assert(Number(hud.brake.replace("%", "")) > 50, `HUD brake ${hud.brake}`);
    assert(peakDecel < -0.6, `peak deceleration only ${peakDecel.toFixed(2)} g`);
    assert(absActive, "ABS never modulated during a full-pedal stop");
    return { before: before.speedKph, after: after.speedKph, peakDecel, absActive };
  });

  await check("steering changes the car's heading in the right direction", async () => {
    // A steering measurement must start from a known speed on the circuit:
    // earlier tests can leave the car fast, slow or sliding, and any of those
    // would dominate the small yaw-rate signal we are looking for.
    const measure = async (key) => {
      await page.evaluate(() => {
        window.__DRIVE_SIM__.setFrameLoop(false);
        window.__DRIVE_SIM__.setAutoDrive(false);
        window.__DRIVE_SIM__.resetAt(25, { gearIndex: 4, autoShift: false });
        window.__DRIVE_SIM__.advance(0.3, { render: false }); // settle the driveline
      });
      const before = await page.evaluate(() => window.__DRIVE_SIM__.telemetry());
      await page.keyboard.down(key);
      const after = await page.evaluate(() => window.__DRIVE_SIM__.advance(2, { render: false }));
      await page.keyboard.up(key);
      await page.evaluate(() => window.__DRIVE_SIM__.setFrameLoop(true));
      return { before, after };
    };

    const left = await measure("KeyA");
    assert(left.after.steerAngleRad > 0.01, `left steer angle ${left.after.steerAngleRad.toFixed(3)} rad`);
    assert(left.after.yawRate > 0.02, `left yaw rate ${left.after.yawRate.toFixed(3)} rad/s`);
    assert(left.after.lateralG > 0.05, `left lateral g ${left.after.lateralG.toFixed(2)}`);
    assert(
      Math.abs(left.after.heading - left.before.heading) > 0.05,
      `heading barely moved (${left.before.heading.toFixed(3)} -> ${left.after.heading.toFixed(3)})`,
    );

    const right = await measure("KeyD");
    assert(right.after.steerAngleRad < -0.01, `right steer angle ${right.after.steerAngleRad.toFixed(3)} rad`);
    assert(right.after.yawRate < -0.02, `right yaw rate ${right.after.yawRate.toFixed(3)} rad/s`);
    return {
      left: { yawRate: left.after.yawRate, lateralG: left.after.lateralG },
      right: { yawRate: right.after.yawRate, lateralG: right.after.lateralG },
    };
  });

  await check("the auto driver can lap the circuit unattended", async () => {
    await page.evaluate(() => {
      window.__DRIVE_SIM__.reset();
      window.__DRIVE_SIM__.setAutoDrive(true);
    });
    const telemetry = await page.evaluate(() => window.__DRIVE_SIM__.advance(45, { render: false }));
    const lap = await page.evaluate(() => window.__DRIVE_SIM__.lap());
    assert(telemetry.speedKph > 40, `auto driver is only doing ${telemetry.speedKph.toFixed(1)} km/h`);
    assert(!telemetry.offTrack, `the auto driver ended up on ${telemetry.surface}`);
    assert(telemetry.distanceM > 400, `only covered ${telemetry.distanceM.toFixed(0)} m`);
    assert(lap.timing, "lap timing never armed");
    return { speedKph: telemetry.speedKph, distanceM: telemetry.distanceM, lap };
  });

  await check("every camera view renders and the audio space follows it", async () => {
    const views = ["cockpit", "hood", "cinematic", "chase"];
    const seen = [];
    for (const view of views) {
      const result = await page.evaluate((target) => {
        window.__DRIVE_SIM__.setCamera(target);
        window.__DRIVE_SIM__.advance(0.6, { render: false });
        return {
          camera: window.__DRIVE_SIM__.stats().camera,
          audioSpace: window.__DRIVE_SIM__.audioStatus().space,
          sample: window.__DRIVE_SIM__.samplePixels(),
          hudCamera: window.__DRIVE_SIM__.hudValues().camera,
        };
      }, view);
      assert(result.camera === view, `camera did not switch to ${view}`);
      assert(result.hudCamera === view, `HUD camera shows ${result.hudCamera}`);
      assert(result.sample.variance > 20, `${view} view looks flat (variance ${result.sample.variance.toFixed(1)})`);
      seen.push({ view, space: result.audioSpace, variance: Math.round(result.sample.variance) });
    }
    const cockpit = seen.find((entry) => entry.view === "cockpit");
    assert(cockpit.space === "cockpit", `cockpit view used the "${cockpit.space}" space`);
    return seen;
  });

  await check("a long unattended run stays finite and keeps the audio clean", async () => {
    const telemetry = await page.evaluate(() => window.__DRIVE_SIM__.advance(40, { render: false }));
    const status = await page.evaluate(() => window.__DRIVE_SIM__.audioStatus());
    for (const [key, value] of Object.entries(telemetry)) {
      if (typeof value === "number") assert(Number.isFinite(value), `telemetry.${key} became ${value}`);
    }
    assert(telemetry.recoveries === 0, `${telemetry.recoveries} state recoveries were needed`);
    const diagnostics = status.diagnostics;
    if (diagnostics) {
      assert(diagnostics.engine.nonFiniteSamples === 0, "the worklet produced non-finite samples");
      assert(diagnostics.engine.clippedSamples === 0, "the worklet clipped");
    }
    return { simulatedTime: telemetry.time, laps: await page.evaluate(() => window.__DRIVE_SIM__.lap()) };
  });

  // ----------------------------------------------------------- artefacts
  await check("screenshots of every view are captured", async () => {
    const shots = [];
    for (const view of ["chase", "cockpit", "cinematic"]) {
      await page.evaluate((target) => {
        window.__DRIVE_SIM__.setCamera(target);
        window.__DRIVE_SIM__.setAutoDrive(true);
        // Advance without rendering, then draw exactly one frame: the software
        // rasteriser used in headless mode makes every rendered frame expensive.
        window.__DRIVE_SIM__.advance(2.5, { render: false });
        window.__DRIVE_SIM__.advance(1 / 60, { render: true });
      }, view);
      const file = join(ARTIFACTS, `browser-${view}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
    }
    assert(shots.length === 3, "expected three screenshots");
    return shots.map((file) => file.replace(ROOT, "."));
  });

  await check("no console errors or uncaught exceptions were logged", () => {
    assert(pageErrors.length === 0, `page errors: ${pageErrors.join(" | ")}`);
    const ignorable = /favicon|Failed to load resource/i;
    const real = consoleErrors.filter((text) => !ignorable.test(text));
    assert(real.length === 0, `console errors: ${real.join(" | ")}`);
    return { consoleErrors: consoleErrors.length, pageErrors: pageErrors.length };
  });

  void description;
} finally {
  if (!keepOpen) {
    if (page) await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  await server.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  url: server.url,
  passed: results.filter((entry) => entry.ok).length,
  failed: failures,
  results,
  consoleErrors,
  pageErrors,
};
const reportPath = join(ARTIFACTS, "browser-test-report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n${report.passed} passed, ${failures} failed - report: ${reportPath}`);
process.exit(failures > 0 ? 1 : 0);
