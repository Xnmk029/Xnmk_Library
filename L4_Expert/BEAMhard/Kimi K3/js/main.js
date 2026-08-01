// ============================================================================
// main.js — Boot & integration orchestrator.
// Loads manifest -> fetches & parses all JBeam -> builds VehicleSpec -> boots
// WebGL (HDR env + post), proving ground, vehicle, audio, HUD, city tiles.
// Modes: [1] Proving Ground drive  [2] City drive  [3] Vector map (zoom cam)
// ============================================================================

import * as THREE from 'three';
import { parseJBeamFile } from './core/jbeam-parser.js';
import { buildVehicleSpec } from './core/vehicle-builder.js';
import { VehiclePhysics } from './core/vehicle-physics.js';
import { makeProvingGroundSurface, makeCitySurface, TRACK } from './core/track-zones.js';
import { generateCity } from './core/city-gen.js';
import { QuadTreeTiler } from './core/quadtree.js';
import { clamp, clamp01, lerp } from './core/math.js';
import { ThreeApp } from './web/three-app.js';
import { buildProvingGround } from './web/track-mesh.js';
import { VehicleMesh } from './web/vehicle-mesh.js';
import { EngineAudio } from './web/engine-audio.js';
import { HUD } from './web/hud.js';
import { CityRenderer } from './web/city-renderer.js';
import { HybridMapCamera } from './web/map-camera.js';
import { setToonLight } from './web/npr.js';

const $ = (id) => document.getElementById(id);
const loadingEl = $('loading');
const loadBar = $('load-bar-fill');
const loadText = $('load-text');

function setProgress(p, msg) {
  loadBar.style.width = `${(p * 100).toFixed(0)}%`;
  if (msg) loadText.textContent = msg;
}

// ---------------------------------------------------------------------------
// Input: keyboard + gamepad
// ---------------------------------------------------------------------------
class Input {
  constructor() {
    this.keys = new Set();
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  }
  poll() {
    const k = this.keys;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    let throttle = (k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0;
    let brake = (k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0;
    let steerL = (k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0;
    let steerR = (k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0;
    let hb = k.has('Space');
    const ax = gp ? (gp.axes[0] || 0) : 0;
    if (gp) {
      throttle = Math.max(throttle, gp.buttons[7]?.value || 0);
      brake = Math.max(brake, gp.buttons[6]?.value || 0);
      if (ax < -0.12) steerL = Math.max(steerL, -ax);
      if (ax > 0.12) steerR = Math.max(steerR, ax);
      hb = hb || !!gp.buttons[0]?.pressed;
    }
    // smoothing (steer: left key = negative angle = turn toward -x = left)
    const s = this.state;
    s.throttle = lerp(s.throttle, throttle, 0.35);
    s.brake = lerp(s.brake, brake, 0.35);
    s.steer = lerp(s.steer, steerR - steerL, 0.28);
    s.handbrake = hb;
    return s;
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  const hud = new HUD();
  hud.log('THW_CCF2 Web Pipeline booting…');

  // ---- Phase 1: fetch + parse the whole JBeam package ------------------------
  setProgress(0.02, 'Fetching JBeam manifest…');
  const manifest = await (await fetch('vehicles/manifest.json')).json();
  hud.log(`Manifest: ${manifest.jbeamFiles.length} JBeam files`);
  const partsByFile = {};
  let done = 0, parseErrors = 0, totalNodes = 0, totalBeams = 0;
  const CHUNK = 12;
  for (let i = 0; i < manifest.jbeamFiles.length; i += CHUNK) {
    const slice = manifest.jbeamFiles.slice(i, i + CHUNK);
    const texts = await Promise.all(slice.map(async (rel) => {
      const r = await fetch(rel);
      if (!r.ok) throw new Error(`fetch failed ${r.status}: ${rel}`);
      return [rel, await r.text()];
    }));
    for (const [rel, text] of texts) {
      try {
        const parts = parseJBeamFile(text, rel);
        partsByFile[rel] = parts;
        for (const p of Object.values(parts)) { totalNodes += p.nodes.length; totalBeams += p.beams.length; }
      } catch (e) {
        parseErrors++;
        hud.log(`PARSE FAIL ${rel}: ${e.message}`);
      }
    }
    done += slice.length;
    setProgress(0.02 + 0.3 * (done / manifest.jbeamFiles.length), `Parsing JBeam ${done}/${manifest.jbeamFiles.length}…`);
  }
  hud.log(`Parsed ${done} files: ${totalNodes} nodes, ${totalBeams} beams, errors=${parseErrors}`);

  setProgress(0.34, 'Converting soft-body -> rigid chassis + soft tires…');
  const spec = buildVehicleSpec(partsByFile);
  for (const d of spec.diagnostics) hud.log('[spec] ' + d);

  // ---- WebGL app ----------------------------------------------------------------
  setProgress(0.4, 'Initialising WebGL renderer…');
  const app = new ThreeApp($('gl'));

  // ---- Phase 3: proving ground ----------------------------------------------------
  setProgress(0.46, 'Building proving ground…');
  const pg = buildProvingGround();
  app.scene.add(pg.group);

  const surfacePG = makeProvingGroundSurface();
  const surfaceCity = makeCitySurface();
  let surface = surfacePG;

  // ---- vehicle -----------------------------------------------------------------------
  setProgress(0.55, 'Loading vehicle body mesh (Collada)…');
  const phys = new VehiclePhysics(spec, surface);
  phys.reset(TRACK.spawn.x, TRACK.spawn.z, TRACK.spawn.heading);
  const vehMesh = new VehicleMesh(spec);
  const daeOk = await vehMesh.loadBody((p) => setProgress(0.55 + p * 0.3, `DAE ${(p * 100).toFixed(0)}%`));
  for (const line of vehMesh.alignmentReport) hud.log('[align] ' + line);
  app.scene.add(vehMesh.root);
  hud.log(daeOk ? 'Collada body bound to physics node tree' : 'Procedural body active');

  // ---- Phase 5: procedural city + tiles ----------------------------------------------
  setProgress(0.87, 'Generating procedural city…');
  const city = generateCity({ seed: 20260728, size: 1600 });
  hud.log(`[city] ${JSON.stringify(city.stats)}`);
  const tiler = new QuadTreeTiler({ minX: -city.half, minZ: -city.half, maxX: city.half, maxZ: city.half }, 6);
  const t0 = performance.now();
  tiler.build(city);
  hud.log(`[tiles] ${tiler.stats().tiles} tiles built in ${(performance.now() - t0).toFixed(0)} ms`);
  const cityRenderer = new CityRenderer(app.scene, tiler, city,
    new THREE.Vector2(window.innerWidth, window.innerHeight));
  cityRenderer.group.visible = false;

  // ---- audio (Phase 2) -------------------------------------------------------------------
  const audio = new EngineAudio();
  const startAudio = () => {
    if (!audio.started) {
      audio.start(spec.engine.acoustics).then(() => hud.log('Web Audio engine online (worklet+panners)'));
    }
  };
  window.addEventListener('pointerdown', startAudio, { once: false });
  window.addEventListener('keydown', startAudio, { once: false });

  // ---- modes ------------------------------------------------------------------------------
  const input = new Input();
  let mode = 1; // 1 proving, 2 city, 3 map
  const mapCam = new HybridMapCamera($('gl'), city.half);
  let mapZoomHud = 3;

  function setMode(m) {
    mode = m;
    pg.group.visible = (m === 1);
    cityRenderer.group.visible = (m >= 2);
    if (m === 3) { mapCam.target.set(phys.pos.x, 0, phys.pos.z); }
    else cityRenderer.hideAllLabels();
    if (m === 1) { surface = surfacePG; phys.surface = surfacePG; phys.reset(TRACK.spawn.x, TRACK.spawn.z, TRACK.spawn.heading); }
    if (m === 2) { surface = surfaceCity; phys.surface = surfaceCity; phys.reset(0, 0, 0); }
    hud.setMode(['', 'PROVING GROUND', 'CITY DRIVE', 'VECTOR MAP'][m]);
    hud.log(`Mode -> ${['', 'Proving Ground', 'City Drive', 'Vector Map'][m]}`);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') setMode(1);
    if (e.code === 'Digit2') setMode(2);
    if (e.code === 'Digit3') setMode(3);
    if (e.code === 'KeyM') hud.toggleMap();
    if (e.code === 'KeyR') {
      if (mode === 1) phys.reset(TRACK.spawn.x, TRACK.spawn.z, TRACK.spawn.heading);
      if (mode === 2) phys.reset(0, 0, 0);
    }
    if (e.code === 'KeyX') phys.engine.shiftUp();
    if (e.code === 'KeyC') phys.engine.shiftDown();
    if (e.code === 'Equal' || e.code === 'NumpadAdd') mapZoomHud = Math.min(6, mapZoomHud + 1);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') mapZoomHud = Math.max(1, mapZoomHud - 1);
  });
  setMode(1);

  // ---- chase camera ------------------------------------------------------------------
  const chase = { pos: new THREE.Vector3(0, 3, 8), look: new THREE.Vector3() };
  function updateChaseCam(dt) {
    const q = phys.quat;
    const fwd = rotateQ(q, { x: 0, y: 0, z: -1 });
    const speed = Math.hypot(phys.vel.x, phys.vel.z);
    const dist = 6.2 + speed * 0.06;
    const height = 2.4 + speed * 0.012;
    const tx = phys.pos.x - fwd.x * dist;
    const tz = phys.pos.z - fwd.z * dist;
    const ty = phys.pos.y + height;
    const k = 1 - Math.pow(0.0015, dt);
    chase.pos.x += (tx - chase.pos.x) * k;
    chase.pos.y += (ty - chase.pos.y) * k;
    chase.pos.z += (tz - chase.pos.z) * k;
    app.camera.position.copy(chase.pos);
    chase.look.set(phys.pos.x + fwd.x * 6, phys.pos.y + 1.1, phys.pos.z + fwd.z * 6);
    app.camera.lookAt(chase.look);
  }

  // ---- telemetry CSV ring buffer ------------------------------------------------------
  const csvRows = ['t,speedKmh,rpm,gear,zone,FLmm,FRmm,RLmm,RRmm,FLload,FRload,RLload,RRload,latG,inWater'];
  let csvTimer = 0;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') {
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'telemetry_export.csv';
      a.click();
      hud.log(`Telemetry CSV exported (${csvRows.length - 1} rows)`);
    }
  });

  // ---- main loop -------------------------------------------------------------------------
  setProgress(1, 'Ready');
  loadingEl.classList.add('done');
  hud.log('Boot complete — W/S throttle-brake, A/D steer, Space handbrake, 1/2/3 modes, M map, T CSV');

  let last = performance.now();
  let fps = 60, fpsAcc = 0, fpsN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const tFrame0 = performance.now();

    // physics (drive modes)
    if (mode !== 3) {
      const inp = input.poll();
      phys.setInput(inp);
      phys.step(dt);
      phys.sampleLatAcc(dt);
    }
    const tm = phys.getTelemetry();

    // telemetry capture (5 Hz)
    csvTimer += dt;
    if (csvTimer > 0.2 && csvRows.length < 20000) {
      csvTimer = 0;
      csvRows.push([
        tm.t.toFixed(2), tm.speedKmh.toFixed(1), tm.rpm.toFixed(0), tm.gear, tm.zone.key,
        tm.wheels.FL.travelMM.toFixed(1), tm.wheels.FR.travelMM.toFixed(1),
        tm.wheels.RL.travelMM.toFixed(1), tm.wheels.RR.travelMM.toFixed(1),
        tm.wheels.FL.load.toFixed(0), tm.wheels.FR.load.toFixed(0),
        tm.wheels.RL.load.toFixed(0), tm.wheels.RR.load.toFixed(0),
        tm.latG.toFixed(2), tm.inWater ? 1 : 0,
      ].join(','));
    }

    // cameras & visuals
    if (mode === 3) {
      const cam = mapCam.update(dt);
      app.activeCamera = cam;
      const stream = cityRenderer.update(cam, { x: mapCam.target.x, z: mapCam.target.z }, mapCam.zoom01());
      if ((frame.n = (frame.n || 0) + 1) % 120 === 0) {
        hud.log(`[map] z-level ${stream.level}, ${stream.tilesVisible} tiles streamed`);
      }
    } else {
      app.activeCamera = app.camera;
      updateChaseCam(dt);
      if (mode === 2) {
        // stream tiles around the car at street level
        cityRenderer.update(app.camera, { x: phys.pos.x, z: phys.pos.z }, 0.92);
        // simple building collision (2D circle vs footprints)
        resolveBuildingCollision(phys, city);
      }
    }
    vehMesh.update(phys);
    setToonLight(app.scene, app.sunDir);
    app.followShadow(phys.pos);

    // animated water
    if (pg.waterTex) pg.waterTex.offset.y = (now * 0.00003) % 1;

    // audio
    if (audio.started) {
      const slipAvg = (Math.abs(tm.wheels.FL.slipRatio) + Math.abs(tm.wheels.FR.slipRatio) +
        Math.abs(tm.wheels.RL.slipAngleDeg) / 20) / 3;
      const camNow = app.activeCamera || app.camera;
      audio.update(phys.acousticState(), {
        pos: phys.pos, quat: phys.quat, speedMS: tm.speedMS, slipAvg, inWater: tm.inWater,
      }, {
        pos: { x: camNow.position.x, y: camNow.position.y, z: camNow.position.z },
        fwd: dirOf(camNow),
      });
    }

    // HUD
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    hud.update(tm, { fps, ms: performance.now() - tFrame0 });
    if (hud.mapVisible) {
      hud.drawMap(tiler, city, phys.pos, mapZoomHud);
    }

    cityRenderer.setResolution(window.innerWidth, window.innerHeight);
    app.render();
  }
  requestAnimationFrame(frame);
}

function dirOf(cam) {
  const v = new THREE.Vector3();
  cam.getWorldDirection(v);
  return { x: v.x, y: v.y, z: v.z };
}

function rotateQ(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

// cheap building collision: push the car out of footprints (city mode)
function resolveBuildingCollision(phys, city) {
  const px = phys.pos.x, pz = phys.pos.z;
  if (Math.abs(px) > city.half || Math.abs(pz) > city.half) return;
  const R = 1.1;
  for (const b of city.buildings) {
    // quick reject via circumscribed circle
    const hw = (b.polygon[1] ? Math.abs(b.polygon[1][0] - b.polygon[0][0]) : 20) / 2 + R + 30;
    if (Math.abs(b.cx - px) > hw || Math.abs(b.cz - pz) > hw) continue;
    // point-in-polygon (ray cast)
    let inside = false;
    const poly = b.polygon;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if ((poly[i][1] > pz) !== (poly[j][1] > pz) &&
        px < (poly[j][0] - poly[i][0]) * (pz - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) {
        inside = !inside;
      }
    }
    if (inside) {
      // push out toward nearest edge (x or z axis approximation)
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of poly) {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]);
      }
      const dxl = px - minX + R, dxr = maxX - px + R;
      const dzl = pz - minZ + R, dzr = maxZ - pz + R;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) { phys.pos.x = minX - R; phys.vel.x = Math.min(phys.vel.x, 0) * 0.3; }
      else if (m === dxr) { phys.pos.x = maxX + R; phys.vel.x = Math.max(phys.vel.x, 0) * 0.3; }
      else if (m === dzl) { phys.pos.z = minZ - R; phys.vel.z = Math.min(phys.vel.z, 0) * 0.3; }
      else { phys.pos.z = maxZ + R; phys.vel.z = Math.max(phys.vel.z, 0) * 0.3; }
    }
  }
}

boot().catch((e) => {
  loadText.textContent = 'BOOT FAILED: ' + e.message;
  console.error(e);
});
