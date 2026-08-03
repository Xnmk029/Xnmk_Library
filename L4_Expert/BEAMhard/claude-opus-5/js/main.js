/**
 * main.js — application conductor for the CCF Vehicle Lab.
 *
 * Boot: VFS manifest → jbeam parse/assemble/convert (Phase 1) → materials +
 * COLLADA bind (Task 1.3) → sky/post (3.1) → proving ground (3.2) → city +
 * tiles + labels (Phase 5) → ignite (Web Audio, Phase 2) → main loop.
 *
 * Modes: PG drive · CITY drive · MAP fly-over. T runs the automated
 * validation suite and prints the pass/fail matrix (Phase 3 validation).
 */
import * as THREE from 'three';
import { ColladaLoader } from './vendor/ColladaLoader.js';
import { AssetVFS } from './core/loader.js';
import { VehicleAssembler } from './jbeam/assembler.js';
import { convertToPhysicsRig } from './jbeam/convert.js';
import { DDSTextureLoader } from './gfx/dds.js';
import { MaterialLibrary } from './gfx/materials.js';
import { setSharedEnvMap, updateToonUniforms, updateOutlineViewports } from './gfx/npr.js';
import { SkyRig } from './gfx/sky.js';
import { PostPipeline } from './gfx/post.js';
import { VehicleSim } from './physics/vehicle.js';
import { surfaceInfo, normalAt, waterLevelAt, zoneAt, SURF, BANK } from './physics/surface.js';
import { ProvingGround } from './world/proving.js';
import { VehicleBinder } from './vehicle/binder.js';
import { EngineAudio } from './audio/engine.js';
import { HUD } from './ui/hud.js';
import { generateCity } from './city/citygen.js';
import { TileManager } from './city/tiles.js';
import { MapCamera } from './city/camera.js';
import { LabelLayer } from './city/labels.js';
import { updateLineViewports } from './city/lines.js';
import { Autopilot } from './validation/autopilot.js';

const app = {
  mode: 'PG',                    // PG | CITY | MAP
  prevDriveMode: 'PG',
  cockpit: false,
  autopilot: null,
  turbo: new URLSearchParams(location.search).has('turbo'),
  started: false,
};
window.__app = app;              // debug/inspection hook

/* ================================ loading UI ============================== */
const STAGES = [
  ['manifest', 'ASSET MANIFEST'],
  ['jbeam', 'JBEAM PARSE (115 FILES)'],
  ['convert', 'RIGID-BODY CONVERSION'],
  ['materials', 'MATERIAL LIBRARY'],
  ['mesh', 'COLLADA MESH BIND'],
  ['world', 'PROVING GROUND'],
  ['city', 'PROCEDURAL CITY'],
  ['audio', 'WEB AUDIO (ON IGNITE)'],
];
const stageEls = {};
{
  const wrap = document.getElementById('loadStages');
  for (const [id, label] of STAGES) {
    const el = document.createElement('div');
    el.className = 'load-stage';
    el.textContent = label;
    wrap.appendChild(el);
    stageEls[id] = el;
  }
}
const loadMsg = document.getElementById('loadMsg');
const loadFill = document.getElementById('loadBarFill');
let stageProgress = 0;
function setStage(id, state, msg) {
  const el = stageEls[id];
  if (el) el.className = 'load-stage ' + state;
  if (msg) loadMsg.textContent = msg;
  if (state === 'done') { stageProgress += 1 / STAGES.length; loadFill.style.width = `${Math.min(100, stageProgress * 100)}%`; }
}

/* ================================ input ================================== */
class Input {
  constructor() {
    this.keys = new Set();
    this.steer = 0; this.throttle = 0; this.brake = 0; this.handbrake = 0; this.clutch = 0;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      app.onKey?.(e.code, e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }
  update(dt) {
    const k = this.keys;
    const left = k.has('KeyA') || k.has('ArrowLeft');
    const right = k.has('KeyD') || k.has('ArrowRight');
    const tgt = left && !right ? 1 : right && !left ? -1 : 0;
    const rate = tgt !== 0 ? 3.2 : 4.5;
    this.steer += THREE.MathUtils.clamp(tgt - this.steer, -rate * dt, rate * dt);

    const thrTgt = (k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0;
    const brkTgt = (k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0;
    this.throttle += THREE.MathUtils.clamp(thrTgt - this.throttle, -8 * dt, 4.2 * dt);
    this.brake += THREE.MathUtils.clamp(brkTgt - this.brake, -9 * dt, 5.5 * dt);
    this.handbrake = k.has('Space') ? 1 : 0;

    // gamepad overlay
    const gp = navigator.getGamepads?.()[0];
    if (gp) {
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.09) this.steer = -ax;
      const rt = gp.buttons[7]?.value || 0, lt = gp.buttons[6]?.value || 0;
      if (rt > 0.02) this.throttle = rt;
      if (lt > 0.02) this.brake = lt;
      if (gp.buttons[0]?.pressed) this.handbrake = 1;
      if (gp.buttons[5]?.pressed && !this._rb) app.sim?.shiftUp();
      if (gp.buttons[4]?.pressed && !this._lb) app.sim?.shiftDown();
      this._rb = gp.buttons[5]?.pressed; this._lb = gp.buttons[4]?.pressed;
    }
  }
}

/* ================================ boot ==================================== */
async function boot() {
  const canvas = document.getElementById('view');
  const hud = new HUD();
  app.hud = hud;
  const log = (msg, lv = 'info') => hud.log(msg, lv);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    loadMsg.textContent = 'WebGL unavailable: ' + e.message;
    return;
  }
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;   // count draws across the whole post chain
  app.renderer = renderer;

  // ---- Phase 1: assets ------------------------------------------------------
  const vfs = new AssetVFS();
  vfs.onLog = log;
  app.vfs = vfs;

  /* --------------------------- drag & drop mod zips ------------------------ */
  document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dropping'); });
  document.addEventListener('dragleave', (e) => { if (e.target === document.body || e.clientX <= 0) document.body.classList.remove('dropping'); });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('dropping');
    let added = 0;
    for (const f of e.dataTransfer.files) {
      if (f.name.endsWith('.zip')) {
        const n = await vfs.ingestZip(f, f.name);
        hud.toast(`OVERLAY +${n} FILES`);
        added += n;
      }
    }
    if (added > 0 && app._resumeBoot) {
      app._resumeBoot();
      app._resumeBoot = null;
    }
  });

  setStage('manifest', 'active', 'fetching vehicles/manifest.json…');
  try {
    const man = await vfs.loadManifest();
    setStage('manifest', 'done', `${man.fileCount} files indexed (${(man.totalBytes / 1e6).toFixed(0)} MB tree)`);
  } catch (e) {
    setStage('manifest', 'fail', 'manifest missing — drop mod zips onto the page to continue');
    log('manifest missing, waiting for drop...', 'warn');
    
    // Wait for the user to drop a zip file
    await new Promise((resolve) => {
      app._resumeBoot = resolve;
    });

    // Dynamically generate a manifest from the in-memory overlay
    vfs.manifest = {
      jbeam: [...vfs.overlay.keys()].filter(k => k.endsWith('.jbeam')),
      materials: [...vfs.overlay.keys()].filter(k => k.endsWith('materials.json') || k.endsWith('.cs')),
      textures: [...vfs.overlay.keys()].filter(k => k.endsWith('.dds') || k.endsWith('.png') || k.endsWith('.jpg')),
      meshes: [...vfs.overlay.keys()].filter(k => k.endsWith('.dae')).map(k => ({ path: k, size: 0 }))
    };
    for(const k of vfs.overlay.keys()) {
      vfs.manifestPaths.add(k);
      vfs.pathCache.set(k.toLowerCase(), k);
    }
    setStage('manifest', 'done', `generated manifest from overlay (${vfs.manifest.jbeam.length} jbeams)`);
  }

  setStage('jbeam', 'active', 'parsing jbeam topology…');
  const jbeamFiles = new Map();
  {
    const list = vfs.manifest.jbeam;
    let done = 0;
    const batch = 14;
    for (let i = 0; i < list.length; i += batch) {
      await Promise.all(list.slice(i, i + batch).map(async p => {
        jbeamFiles.set(p, await vfs.text(p));
        done++;
      }));
      loadMsg.textContent = `jbeam ${done}/${list.length}`;
    }
  }
  const assembler = new VehicleAssembler(jbeamFiles, log);
  const bundle = assembler.assemble();
  setStage('jbeam', 'done', `${bundle.stats.parts} parts · ${bundle.stats.nodes} nodes · ${bundle.stats.beams} beams`);

  setStage('convert', 'active', 'deriving rigid body + wheel entities…');
  const rig = convertToPhysicsRig(bundle, (m) => log(m, 'tele'));
  hud.reportTable('PHYSICS CONVERSION REPORT (Task 1.2)', rig.report);
  setStage('convert', 'done', `${rig.chassis.mass.toFixed(0)} kg · ${rig.wheels.length} wheels · ${rig.drivetrain.layout}`);

  setStage('materials', 'active', 'indexing materials.json…');
  const dds = new DDSTextureLoader(renderer);
  log(`DDS support: ${dds.supportSummary()}`);
  const matlib = new MaterialLibrary(vfs, dds, log);
  await matlib.loadAll();
  setStage('materials', 'done', `${matlib.stats.defs} material defs`);

  setStage('mesh', 'active', 'parsing COLLADA scenes (56 MB body — one moment)…');
  const binder = new VehicleBinder(vfs, matlib, rig, log);
  await binder.loadMeshes(ColladaLoader, (f, p) => { loadMsg.textContent = `dae ${(f * 100).toFixed(0)}% ${p.split('/').pop()}`; });
  const carRoot = binder.build();
  setStage('mesh', 'done', `${binder.stats.attached} flexbodies bound`);

  // ---- scene ------------------------------------------------------------------
  const scene = new THREE.Scene();
  app.scene = scene;
  const sky = new SkyRig(renderer, scene);
  const envCube = sky.bakeEnv();
  setSharedEnvMap(envCube);
  scene.add(carRoot);

  setStage('world', 'active', 'displacing terrain patches…');
  const proving = new ProvingGround(scene, log);
  setStage('world', 'done', 'proving ground online');

  setStage('city', 'active', 'growing road network…');
  const city = generateCity(1337);
  log(`city: ${JSON.stringify(city.stats)}`);
  const tiles = new TileManager(city, scene, log);
  tiles.setAllVisible(false);
  const labels = new LabelLayer(document.getElementById('labelLayer'), city.pois);
  const mapCam = new MapCamera(canvas);
  setStage('city', 'done', `${city.stats.buildings} buildings · ${city.stats.roads} roads · ${city.stats.pois} POIs`);

  // spawn arterial for city driving (nearest vertical arterial to downtown)
  let citySpawnX = 0;
  {
    let best = 1e9;
    for (const r of city.roads) {
      if (r.cls !== 0 || r.pts[0] !== r.pts[2]) continue;
      const d = Math.abs(r.pts[0] - 140);
      if (d < best) { best = d; citySpawnX = r.pts[0]; }
    }
  }

  // ---- physics + control -------------------------------------------------------
  const sim = new VehicleSim(rig, null, log);
  sim.cones = proving.cones;
  app.sim = sim;
  const input = new Input();
  const audio = new EngineAudio(log);
  const post = new PostPipeline(renderer);
  const chaseCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, 4200);
  chaseCam.position.set(0, 3, -8);
  const autopilot = new Autopilot(sim, hud);
  app.autopilot = autopilot;

  const citySurface = {
    info: (x, z) => ({ h: 0, type: SURF.ASPHALT }),
    normal: () => [0, 1, 0],
    waterLevel: () => -Infinity,
  };

  // minimap static features
  const pgFeatures = [
    { kind: 'road', pts: [0, -40, 0, 760], w: 15, color: '#3d4048' },
    { kind: 'rect', x: 0, z: 633, w: 22, h: 96, color: '#1d4a5c' },
    { kind: 'dot', x: 0, z: 20, color: '#ff4d2e' }, { kind: 'dot', x: 0, z: 140, color: '#ffd23e' },
    { kind: 'dot', x: 0, z: 280, color: '#41c8ff' }, { kind: 'dot', x: 0, z: 580, color: '#3ee06e' },
  ];
  {
    const bankPts = [];
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      bankPts.push(BANK.cx + Math.cos(a) * 62, BANK.cz + Math.sin(a) * 62);
    }
    pgFeatures.push({ kind: 'road', pts: bankPts, w: 26, color: '#4a4436' });
  }
  const cityFeatures = city.roads.filter(r => r.cls === 0).map(r => ({ kind: 'road', pts: r.pts, w: r.w, color: '#3d4048' }));

  /* -------------------------- mode switching ------------------------------ */
  function setMode(mode) {
    const prev = app.mode;
    app.mode = mode;
    if (mode === 'MAP') {
      app.prevDriveMode = prev === 'MAP' ? app.prevDriveMode : prev;
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('mapUI').classList.remove('hidden');
      mapCam.enabled = true;
      labels.setVisible(true);
      tiles.setAllVisible(true);
      proving.group.visible = false;
      carRoot.visible = false;
      hud.setMode('CITY MAP');
    } else {
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('mapUI').classList.add('hidden');
      mapCam.enabled = false;
      labels.setVisible(false);
      carRoot.visible = true;
      if (mode === 'CITY') {
        tiles.setAllVisible(true);
        proving.group.visible = false;
        sim.surface = citySurface;
        sim.cones = [];
        if (prev !== 'CITY') sim.reset(new THREE.Vector3(citySpawnX, 0, -380), 0);
        hud.setMode('CITY RUN');
      } else {
        tiles.setAllVisible(false);
        proving.group.visible = true;
        sim.surface = defaultSurface;
        sim.cones = proving.cones;
        if (prev !== 'PG') sim.reset(new THREE.Vector3(0, 0, -18), 0);
        hud.setMode('PROVING GROUND');
      }
    }
  }
  const defaultSurface = { info: surfaceInfo, normal: normalAt, waterLevel: waterLevelAt };
  sim.surface = defaultSurface;

  /* ------------------------------ keys ------------------------------------ */
  const paints = ['#ff5a2d', '#f5f2e8', '#ffd23e', '#3ec6ff', '#161a1f', '#7bd94a', '#c13cff'];
  let paintIdx = 0;
  app.onKey = (code, e) => {
    if (!app.started) return;
    switch (code) {
      case 'KeyQ': sim.shiftDown(); break;
      case 'KeyE': sim.shiftUp(); break;
      case 'KeyG': sim.autoShift = !sim.autoShift; hud.toast(sim.autoShift ? 'AUTO SHIFT' : 'MANUAL SHIFT'); break;
      case 'KeyC': app.cockpit = !app.cockpit; break;
      case 'KeyN': { const on = binder.toggleXray(); hud.toast(on ? 'NODE-BEAM X-RAY' : 'X-RAY OFF'); break; }
      case 'KeyM': setMode(app.mode === 'MAP' ? app.prevDriveMode : 'MAP'); break;
      case 'KeyV': setMode(app.mode === 'CITY' ? 'PG' : 'CITY'); break;
      case 'KeyR': sim.reset(app.mode === 'CITY' ? new THREE.Vector3(citySpawnX, 0, -380) : new THREE.Vector3(0, 0, -18), 0); break;
      case 'KeyT': setMode('PG'); autopilot.start(); break;
      case 'KeyP': paintIdx = (paintIdx + 1) % paints.length; matlib.setPaint(paints[paintIdx]); hud.toast('PAINT ' + paints[paintIdx]); break;
      case 'KeyU': audio.setMuted(!audio.muted); hud.toast(audio.muted ? 'MUTED' : 'AUDIO ON'); break;
      case 'KeyH': { const u = post.matComposite.uniforms.uHalftone; u.value = u.value > 0 ? 0 : 0.16; break; }
      case 'Backquote': hud.toggleDiag(); break;
    }
  };

  /* --------------------------- drag & drop mod zips ------------------------ */
  // (Listeners moved to the top of boot() to allow dropping when manifest is missing)

  /* ------------------------------- ignite ---------------------------------- */
  const igniteBtn = document.getElementById('igniteBtn');
  igniteBtn.classList.remove('hidden');
  loadMsg.textContent = 'ready — all systems converted';
  igniteBtn.onclick = async () => {
    igniteBtn.disabled = true;
    setStage('audio', 'active', 'starting AudioWorklet…');
    const ok = await audio.init({ cylinders: rig.engine.cylinders });
    setStage('audio', ok ? 'done' : 'fail');
    document.getElementById('loading').style.display = 'none';
    hud.show();
    hud.setMode('PROVING GROUND');
    app.started = true;
    log(`ALL SYSTEMS GO — ${rig.info.name} by ${rig.info.authors} · ` +
      `${rig.chassis.mass.toFixed(0)} kg · ${rig.engine.peakPowerKW.toFixed(0)} kW · µ=${rig.wheels[0].mu}`, 'ok');
  };
  // headless / automation: ?autostart skips the gesture (no audio)
  if (new URLSearchParams(location.search).has('autostart')) {
    document.getElementById('loading').style.display = 'none';
    hud.show(); hud.setMode('PROVING GROUND');
    app.started = true;
    log('autostart (no user gesture — audio deferred)', 'warn');
  }

  /* ------------------------------- cameras --------------------------------- */
  const camPos = new THREE.Vector3(0, 3, -10);
  const camLook = new THREE.Vector3();
  function updateChase(dt) {
    const back = app.cockpit
      ? new THREE.Vector3(rig.camera?.pos[0] ?? 0, rig.camera?.pos[1] ?? 0.6, rig.camera?.pos[2] ?? 0.2)
      : new THREE.Vector3(0, 2.3, -6.4);
    const target = back.clone().applyQuaternion(sim.quat).add(sim.pos);
    const stiff = app.cockpit ? 1 : Math.min(1, dt * 5.2);
    camPos.lerp(target, stiff);
    // keep camera above terrain
    const gh = sim.surface.info(camPos.x, camPos.z).h;
    if (!app.cockpit && camPos.y < gh + 0.6) camPos.y = gh + 0.6;
    chaseCam.position.copy(camPos);
    if (app.cockpit) {
      chaseCam.quaternion.copy(sim.quat);
      chaseCam.fov = rig.camera?.fov ?? 58;
    } else {
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(sim.quat);
      camLook.copy(sim.pos).addScaledVector(fwd, 3.2).add(new THREE.Vector3(0, 1.0, 0));
      chaseCam.lookAt(camLook);
      chaseCam.fov = 58 + Math.min(14, sim.vel.length() * 0.16);
    }
    chaseCam.updateProjectionMatrix();
  }

  /* ------------------------------- resize ---------------------------------- */
  function onResize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    post.setSize(renderer.domElement.width, renderer.domElement.height);
    chaseCam.aspect = w / h;
    chaseCam.updateProjectionMatrix();
    updateOutlineViewports(carRoot, renderer.domElement.width, renderer.domElement.height);
    updateLineViewports(tiles.group, renderer.domElement.width, renderer.domElement.height);
  }
  window.addEventListener('resize', onResize);
  onResize();

  /* ------------------------------- main loop -------------------------------- */
  let last = performance.now();
  let obTimer = 0;
  const clockV = new THREE.Vector3();

  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const rawDt = (now - last) / 1000;
    let dt = Math.min(0.05, rawDt);
    last = now;
    if (!app.started) { renderer.setRenderTarget(null); return; }
    renderer.info.reset();

    const driveMode = app.mode !== 'MAP';

    if (driveMode) {
      input.update(dt);
      if (autopilot.active) {
        // autopilot steers from inside the fixed-step loop; turbo feeds raw
        // wall time ×6 per frame (CPU-budgeted in VehicleSim.update), so the
        // sweep completes even on sub-fps software rasterizers
        sim.update(Math.min(5, (app.turbo ? rawDt * 6 : dt)), app.turbo ? 60 : 22);
      } else {
        sim.setInput({
          steer: input.steer, throttle: input.throttle, brake: input.brake,
          handbrake: input.handbrake, clutch: 0,
        });
        sim.update(dt);
      }

      // city obstacles refresh
      if (app.mode === 'CITY') {
        obTimer -= dt;
        if (obTimer <= 0) {
          sim.obstacles = tiles.collidersNear(sim.pos.x, sim.pos.z, 70);
          obTimer = 0.35;
        }
      } else sim.obstacles = [];

      sim.telemetry.zone = app.mode === 'CITY' ? 'NIHONBASHI-EAST' : zoneAt(sim.pos.z, sim.pos.x);
      binder.syncFromSim(sim);
      updateChase(dt);
    }

    const activeCam = app.mode === 'MAP' ? mapCam.camera : chaseCam;
    if (app.mode === 'MAP') {
      mapCam.update();
      const st = tiles.update(mapCam.camera, mapCam.target, mapCam.height(), 5);
      labels.update(mapCam.camera, mapCam.dist, dt);
      hud.el.mapZoom.textContent = 'Z' + st.zoom;
      hud.el.mapTiles.textContent = `tiles ${st.visible}/${st.cached}`;
      hud.el.mapProj.textContent = mapCam.orthoBlend > 0.55 ? 'ORTHO' : mapCam.orthoBlend > 0.1 ? 'BLEND' : 'PERSP';
      sky.update(now / 1000, mapCam.target);
    } else {
      if (app.mode === 'CITY') tiles.update(chaseCam, sim.pos, 90, 3.5);
      proving.update(dt, chaseCam.position, sky.sunDir);
      sky.update(now / 1000, sim.pos);
    }

    // toon global uniforms
    updateToonUniforms(scene, sky.sunDir, activeCam.position, envCube);

    // audio
    if (audio.ready && driveMode) {
      const drivenHz = sim.wheels.filter(w => w.def.driven).reduce((a, w) => a + Math.abs(w.spinVel), 0) /
        Math.max(1, sim.wheels.filter(w => w.def.driven).length) / (2 * Math.PI);
      const susRMS = Math.sqrt(sim.telemetry.susVel.reduce((a, v) => a + v * v, 0) / 4);
      const fwdW = new THREE.Vector3(0, 0, 1).applyQuaternion(sim.quat);
      const camFwd = new THREE.Vector3();
      activeCam.getWorldDirection(camFwd);
      for (const ev of sim.events) if (ev.type === 'splash') audio.splash(ev.v / 8);
      if (!autopilot.active) sim.events.length = 0;
      audio.update({
        rpm: sim.engine.rpm,
        throttle: sim.engine.throttle,
        load: sim.engine.load,
        gearRatio: rig.drivetrain.gears[sim.gear] || 0,
        wheelHz: drivenHz,
        slip: sim.telemetry.slip,
        tireLoad: Math.max(...sim.telemetry.loads),
        speed: sim.vel.length(),
        susRMS,
        carPos: sim.pos,
        engineOffset: new THREE.Vector3(0, 0.35, 1.3).applyQuaternion(sim.quat),
        exhaustOffset: new THREE.Vector3(-0.35, -0.15, -2.05).applyQuaternion(sim.quat),
        camPos: activeCam.position,
        camFwd,
        camUp: activeCam.up.clone().applyQuaternion(activeCam.quaternion),
      });
    }

    // render through NPR post pipeline
    post.render(scene, activeCam);

    // HUD
    const heading = (() => {
      const f = new THREE.Vector3(0, 0, 1).applyQuaternion(sim.quat);
      return Math.atan2(f.x, f.z);
    })();
    hud.update(dt, {
      tele: sim.telemetry,
      input: sim.input,
      redline: rig.engine.revLimit,
      maxRPM: Math.max(1000, Math.ceil(rig.engine.maxRPM / 1000) * 1000),
      drawCalls: renderer.info.render.calls,
      minimap: driveMode ? {
        carX: sim.pos.x, carZ: sim.pos.z, yaw: heading,
        scale: app.mode === 'CITY' ? 0.09 : 0.16,
        features: (app.mode === 'CITY' ? cityFeatures : pgFeatures)
          .concat(app.mode === 'PG' ? proving.cones.filter(c => !c.knocked).map(c => ({ kind: 'dot', x: c.x, z: c.z, color: '#ff7b3e' })) : []),
      } : null,
    });
  }
  requestAnimationFrame(frame);
}

boot().catch(e => {
  console.error(e);
  document.getElementById('loadMsg').textContent = 'BOOT FAILURE: ' + e.message;
  const el = document.createElement('pre');
  el.style.cssText = 'color:#ff6a5a;font-size:11px;max-height:30vh;overflow:auto;text-align:left';
  el.textContent = e.stack || String(e);
  document.querySelector('.load-card')?.appendChild(el);
});
