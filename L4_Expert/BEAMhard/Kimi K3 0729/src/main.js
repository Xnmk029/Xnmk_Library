// main.js — Browser integration entry for the CCF Physics Lab.
// Boots the renderer, parses the JBeam set into a VehicleSpec, builds the
// proving ground (default) or the procedural city (?mode=city), loads the
// Collada car meshes (skipped with ?test=1), and runs the frame loop that
// glues physics, audio, HUD, NPR shading and post-processing together.
// Boot progress is mirrored line-by-line into the hidden #boot-log element
// so headless runs can be scraped; success ends with "BOOT_OK".

import * as THREE from '../lib/three.module.js';
import { parseJBeamFiles } from './core/jbeamParser.js';
import { buildVehicleSpec, CURATED_JBEAM_FILES } from './core/vehicleBuilder.js';
import { Vehicle } from './core/vehicle.js';
import { InputManager } from './core/input.js';
import { ProvingGround } from './world/provingGround.js';
import { WaterVolume } from './world/water.js';
import { SkyEnvironment } from './world/skybox.js';
import { CarMeshLoader } from './render/meshLoader.js';
import { applyToonShading, revertToOriginal, toonLighting } from './render/toonShader.js';
import { PostFX } from './render/postfx.js';
import { HUD } from './ui/hud.js';
import { MapHUD } from './ui/mapHud.js';
import { AudioBus } from './audio/audioBus.js';
import { EngineSynth } from './audio/engineSynth.js';
import { generateCity } from './city/cityGen.js';
import { TileSystem } from './city/tileSystem.js';
import { MapCameraController } from './city/mapCamera.js';

/* ------------------------------------------------------------------ boot -- */

const params = new URLSearchParams(location.search);
const TEST_MODE = params.has('test');
const CITY_MODE = params.get('mode') === 'city';

const bootLogEl = document.getElementById('boot-log');
const loadFill = document.getElementById('loadFill');
const loadStatus = document.getElementById('loadStatus');
let loadFrac = 0;

function boot(line, frac) {
  const stamp = `[boot ${(performance.now() / 1000).toFixed(2)}s]`;
  bootLogEl.textContent += `${stamp} ${line}\n`;
  console.log(stamp, line);
  if (frac !== undefined) {
    loadFrac = Math.max(loadFrac, frac);
    loadFill.style.width = `${Math.round(loadFrac * 100)}%`;
  }
  loadStatus.textContent = line;
}

function bootFail(err) {
  const msg = err && err.stack ? err.stack : String(err);
  bootLogEl.textContent += `BOOT_FAIL ${msg}\n`;
  console.error('[boot] FAIL', err);
  loadStatus.textContent = `BOOT FAILED — ${err && err.message ? err.message : err}`;
  loadStatus.style.color = '#ff5a5a';
}

/* ------------------------------------------------------- fallback car mesh -- */

/** Simple box car used for ?test=1 and as a fallback when the DAEs fail. */
function makeFallbackCar(spec) {
  const group = new THREE.Group();
  group.name = 'ccf_fallback';
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd7263d, roughness: 0.45, metalness: 0.15 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.52, 4.1), bodyMat);
  hull.position.y = 0.12;
  hull.castShadow = true;
  group.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.42, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.2, metalness: 0.4 }),
  );
  cabin.position.set(0, 0.55, 0.25);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelTpl = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.62, 20), // unit radius, scaled per corner
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 }),
  );
  tire.rotation.z = Math.PI / 2; // cylinder axis -> X (axle)
  tire.castShadow = true;
  wheelTpl.add(tire);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.64, 12),
    new THREE.MeshStandardMaterial({ color: 0xb9bdc6, roughness: 0.35, metalness: 0.7 }),
  );
  hub.rotation.z = Math.PI / 2;
  wheelTpl.add(hub);
  wheelTpl.userData.unitRadius = true;
  return { group, wheelTpl };
}

/* -------------------------------------------------------------- main boot -- */

async function main() {
  boot('renderer init', 0.04);
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 3000);

  // Sky + lighting (both modes share it).
  const sky = new SkyEnvironment(scene, renderer);
  sky.setTimeOfDay(CITY_MODE ? 0.5 : 0.35); // city: noon light lifts the dark Lambert materials
  boot('sky environment ready', 0.08);

  // ------------------------------------------------------- vehicle physics
  boot('fetching asset manifest', 0.1);
  const manifest = await (await fetch('vehicles/manifest.json')).json();
  boot(`manifest: ${manifest.length} asset paths`, 0.14);

  boot(`parsing ${CURATED_JBEAM_FILES.length} jbeam files`, 0.16);
  const fetchText = async (url) => (await fetch(encodeURI(url))).text();
  const parsed = await parseJBeamFiles(fetchText, CURATED_JBEAM_FILES);
  const spec = buildVehicleSpec(parsed);
  boot(`spec: ${spec.name} — ${spec.mass.toFixed(0)} kg, ${spec.stats.nodeCount} nodes, ${spec.stats.partsUsed.length} parts`, 0.3);
  const vehicle = new Vehicle(spec);

  // ------------------------------------------------------------- world mode
  let env;
  let pg = null;
  let water = null;
  let tiles = null;
  let cityData = null;
  let spawn;

  if (CITY_MODE) {
    boot('generating procedural city (seed 7)', 0.36);
    cityData = generateCity(7);
    boot(`city: ${cityData.roads.length} roads, ${cityData.buildings.length} buildings, ${cityData.pois.length} POIs`, 0.46);
    tiles = new TileSystem(scene, cityData, { minZoom: 11, maxZoom: 16 });
    tiles.setResolution(window.innerWidth, window.innerHeight);
    env = {
      queryGround: () => ({ height: 0, nx: 0, ny: 1, nz: 0, grip: 1, type: 'road' }),
      queryWater: () => null,
    };
    spawn = { x: 0, y: 0.65, z: 0, headingRad: 0 };
  } else {
    boot('building proving ground', 0.36);
    pg = new ProvingGround(scene, {});
    water = new WaterVolume(scene, pg.waterSpec);
    water.setEnvironment({ sunDir: sky.sunDir, skyColor: sky.horizonColor });
    pg.water = water; // chain water animation through pg.update()
    env = {
      queryGround: pg.queryGround.bind(pg),
      queryWater: pg.queryWater.bind(pg),
    };
    spawn = pg.getSpawnPoint();
    boot('proving ground: pad, slalom, cobbles, bumps, banked 180, wading pool', 0.46);
  }
  vehicle.reset(new THREE.Vector3(spawn.x, spawn.y + 0.2, spawn.z), spawn.headingRad);
  boot(`spawn: x=${spawn.x} y=${spawn.y} z=${spawn.z} heading=${spawn.headingRad}`);

  // -------------------------------------------------------------- car mesh
  let carGroup;
  let wheelTemplate = null;
  if (TEST_MODE) {
    const fb = makeFallbackCar(spec);
    carGroup = fb.group;
    wheelTemplate = fb.wheelTpl;
    boot('test mode: fallback box car (DAE skipped)', 0.55);
  } else {
    try {
      boot('loading Collada car meshes', 0.5);
      const meshLoader = new CarMeshLoader(manifest);
      let materialsJson = null;
      try {
        materialsJson = await (await fetch('vehicles/ccf/main.materials.json')).json();
      } catch (e) {
        boot(`materials.json unavailable (${e.message}); flat colors`, 0.52);
      }
      carGroup = await meshLoader.loadBody({
        remodelUrl: 'vehicles/ccf/ccfremodel.dae',
        cupUrl: 'vehicles/ccf/ccfcup.dae',
        materialsJson,
        onProgress: (stage, sel) => boot(`dae ${stage} loaded${sel ? ` (${sel.shown} shown/${sel.hidden} hidden)` : ''}`, stage === 'remodel' ? 0.68 : 0.8),
      });
      try {
        wheelTemplate = await meshLoader.loadWheelTemplate(
          'vehicles/common/wheels/ccf_wheels_fsw/ccfcupwheel.dae', spec.wheels[0].radius);
        boot('wheel template normalized', 0.86);
      } catch (e) {
        boot(`wheel DAE failed (${e.message}); using primitive wheels`, 0.86);
        wheelTemplate = makeFallbackCar(spec).wheelTpl;
      }
    } catch (e) {
      boot(`car DAE failed (${e.message}); fallback box car`, 0.8);
      const fb = makeFallbackCar(spec);
      carGroup = fb.group;
      wheelTemplate = fb.wheelTpl;
    }
  }
  scene.add(carGroup);

  // Four wheel wrappers: spin group (X axis) inside a steer group (Y axis).
  const wheelRigs = spec.wheels.map((w, i) => {
    const steerG = new THREE.Group();
    const spinG = new THREE.Group();
    const mesh = wheelTemplate.clone(true);
    if (w.attachLocal.x > 0) mesh.rotation.y = Math.PI; // mirror right side
    if (wheelTemplate.userData.unitRadius) mesh.scale.setScalar(w.radius);
    spinG.add(mesh);
    steerG.add(spinG);
    scene.add(steerG);
    return { steerG, spinG, wheel: vehicle.wheels[i], spinAngle: 0 };
  });

  // ------------------------------------------------------------------- HUD
  const hud = new HUD(document.getElementById('hud-root'));
  const mapHud = new MapHUD(document.getElementById('hud-root'));
  if (CITY_MODE) {
    mapHud.setData({ roads: cityData.roads, pois: cityData.pois, bounds: cityData.bounds, title: 'CITY — seed 7' });
  } else {
    mapHud.setData({
      roads: [], pois: [],
      bounds: { minX: -400, minZ: -400, maxX: 400, maxZ: 400 },
      title: 'PROVING GROUND',
    });
  }
  boot('HUD ready', 0.88);

  // ----------------------------------------------------------------- audio
  const audioBus = new AudioBus();
  const synth = new EngineSynth(audioBus, {
    cylinders: 4,
    firingOrder: [1, 3, 4, 2],
    idleRPM: spec.engine.idleRPM,
    maxRPM: spec.engine.maxRPM,
    turbo: false,
    gearRatios: spec.transmission.gearRatios,
    finalDrive: spec.transmission.finalDrive,
    gearWhine: [0.03, 0, 0.02, 0.018, 0.016, 0.014, 0.012, 0.01],
    engineName: 'f4',
  });
  let audioStarted = false;
  const startAudio = async () => {
    if (audioStarted) return;
    audioStarted = true;
    await audioBus.resume();
    synth.start();
    synth.blipStarter();
    boot('audio engine started');
  };
  window.addEventListener('keydown', startAudio, { once: false });
  window.addEventListener('pointerdown', startAudio, { once: false });

  // ----------------------------------------------------------------- input
  const input = new InputManager();
  input.attach(window);

  // --------------------------------------------------------------- cameras
  const CAM = { CHASE: 0, HOOD: 1, FREE: 2 };
  let camMode = CAM.CHASE;
  const chasePos = new THREE.Vector3(spawn.x - 7, spawn.y + 2.6, spawn.z); // start behind the car
  const chaseLook = new THREE.Vector3();
  let mapCam = null;
  if (CITY_MODE) {
    mapCam = new MapCameraController(canvas, {
      bounds: cityData.bounds,
      perspectiveCamera: camera,
      orthographicCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 5000),
    });
    mapCam.focusOn(spawn.x, spawn.z, 15);
  }

  // ---------------------------------------------------------------- postfx
  let postfx = null;
  try {
    postfx = new PostFX(renderer, window.innerWidth, window.innerHeight);
    boot('postfx pipeline ready', 0.92);
  } catch (e) {
    boot(`postfx unavailable (${e.message}); direct rendering`, 0.92);
  }

  // ------------------------------------------------------------- telemetry
  let recording = false;
  let teleRows = [];
  let teleTimer = 0;
  const TELE_HEADER = 'time,speedKmh,rpm,gear,latG,longG,throttle,brake,steer';
  function downloadTelemetry() {
    if (!teleRows.length) { hud.log('telemetry: nothing recorded yet'); return; }
    const blob = new Blob([[TELE_HEADER, ...teleRows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'telemetry.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    hud.log(`telemetry: ${teleRows.length} rows downloaded`);
  }

  // ------------------------------------------------------------------ NPR
  let nprOn = false;
  function toggleNPR() {
    nprOn = !nprOn;
    if (nprOn) applyToonShading(carGroup);
    else revertToOriginal(carGroup);
    hud.log(`NPR toon shading ${nprOn ? 'ON' : 'OFF'}`);
  }

  // ---------------------------------------------------------------- resize
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (postfx) postfx.setSize(w, h);
    if (tiles) tiles.setResolution(w, h);
  });

  // ------------------------------------------------------------- main loop
  const clock = new THREE.Clock();
  const _basis = { right: null, up: null, forward: null };
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _v3 = new THREE.Vector3();
  let simTime = 0;
  let prevThrottle = 0;
  let frameCount = 0;

  boot('BOOT_OK', 1);
  document.getElementById('loading-screen').style.display = 'none';
  // Debug/e2e hooks (harmless in production).
  window.__vehicle = vehicle;
  window.__env = env;
  window.__spec = spec;
  window.__tiles = tiles;
  hud.log(`${spec.name} — ${spec.mass.toFixed(0)} kg, ${spec.stats.nodeCount} nodes parsed from JBeam`);
  hud.log(CITY_MODE ? 'city mode: seed 7' : 'proving ground: 6 test zones');

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(Math.max(clock.getDelta(), 1e-4), 0.05);
    simTime += dt;

    // ---- one-shot actions
    if (input.consume('reset')) {
      vehicle.reset(new THREE.Vector3(spawn.x, spawn.y + 0.2, spawn.z), spawn.headingRad);
      hud.log('car reset to spawn');
    }
    if (input.consume('camera')) {
      camMode = (camMode + 1) % (mapCam ? 3 : 2);
      hud.log(`camera: ${['chase', 'hood', 'map/free'][camMode]}`);
    }
    if (input.consume('npr')) toggleNPR();
    if (input.consume('help')) hud.toggleHelp();
    if (input.consume('map')) mapHud.toggle();
    if (input.consume('telemetry')) {
      recording = !recording;
      if (recording) { teleRows = []; teleTimer = 0; }
      hud.log(`telemetry recording ${recording ? 'STARTED (Enter to download)' : 'STOPPED'}`);
    }
    if (input.consume('confirm')) downloadTelemetry();

    // ---- physics
    const controls = input.poll(dt);
    vehicle.update(dt, controls, env);
    const t = vehicle.telemetry(env);

    // lift-off backfire above 5000 rpm
    if (prevThrottle > 0.6 && controls.throttle < 0.05 && t.rpm > 5000 && Math.random() < 0.35) {
      synth.backfire();
    }
    prevThrottle = controls.throttle;

    // ---- mesh sync
    carGroup.position.copy(vehicle.body.position);
    carGroup.quaternion.copy(vehicle.body.quaternion);
    const basis = vehicle.body.getBasis();
    _basis.right = basis.right; _basis.up = basis.up; _basis.forward = basis.forward;
    for (const rig of wheelRigs) {
      const w = rig.wheel;
      _v1.copy(w.attachLocal).applyQuaternion(vehicle.body.quaternion).add(vehicle.body.position);
      _v1.addScaledVector(basis.up, -w.compression);
      rig.steerG.position.copy(_v1);
      rig.steerG.quaternion.copy(vehicle.body.quaternion);
      rig.steerG.rotateY(w.steerAngle || 0);
      rig.spinAngle += (w.angularVel || 0) * dt;
      rig.spinG.rotation.x = rig.spinAngle;
    }

    // ---- cameras
    let activeCam = camera;
    if (camMode === CAM.FREE && mapCam) {
      activeCam = mapCam.update(dt);
    } else if (camMode === CAM.HOOD) {
      _v2.set(0.32, 0.78, -0.25).applyQuaternion(vehicle.body.quaternion).add(vehicle.body.position);
      camera.position.copy(_v2);
      _v3.copy(basis.forward).multiplyScalar(30).add(_v2).addScaledVector(basis.up, 0.4);
      camera.up.copy(basis.up);
      camera.lookAt(_v3);
    } else {
      // chase: behind + above, smoothed
      _v2.copy(basis.forward).multiplyScalar(-7.2).addScaledVector(basis.up, 2.6).add(vehicle.body.position);
      chasePos.lerp(_v2, Math.min(1, 5 * dt));
      camera.position.copy(chasePos);
      camera.up.set(0, 1, 0);
      chaseLook.copy(vehicle.body.position).addScaledVector(basis.forward, 6).addScaledVector(basis.up, 1.1);
      camera.lookAt(chaseLook);
    }

    // ---- world updates
    sky.update(dt);
    if (pg) pg.update(dt, camera.position);
    if (tiles) {
      tiles.setVehiclePosition(vehicle.body.position.x, vehicle.body.position.z);
      tiles.update(activeCam, dt);
    }

    // ---- toon lighting follows sun + camera
    toonLighting.uLightDir.value.copy(sky.sunDir);
    toonLighting.uCamPos.value.copy(activeCam.position);

    // ---- HUD
    if (pg) {
      const g = pg.queryGround(vehicle.body.position.x, vehicle.body.position.z);
      hud.setZone(g.type.toUpperCase());
    } else {
      hud.setZone('CITY — SEED 7');
    }
    hud.update(t, dt, spec);
    if (mapHud.visible) {
      const yaw = Math.atan2(basis.forward.x, basis.forward.z);
      mapHud.draw(vehicle.body.position, -yaw);
    }
    if (CITY_MODE && tiles) mapHud.updatePOILabels(activeCam, tiles.getVisiblePOIs(), dt);

    // ---- audio
    if (synth.running) {
      synth.update(dt, vehicle.audioState());
      synth.setPosition(vehicle.body.position, vehicle.body.velocity);
      _v3.set(0, 0, -1).applyQuaternion(activeCam.quaternion);
      _v1.set(0, 1, 0).applyQuaternion(activeCam.quaternion);
      audioBus.setListener(activeCam.position, _v3, _v1);
    }

    // ---- telemetry recording (10 Hz)
    if (recording) {
      teleTimer += dt;
      if (teleTimer >= 0.1) {
        teleTimer -= 0.1;
        teleRows.push([
          simTime.toFixed(2), t.speedKmh.toFixed(2), t.rpm.toFixed(0), t.gear,
          t.latG.toFixed(3), t.longG.toFixed(3), t.throttle.toFixed(2),
          t.brake.toFixed(2), t.steer.toFixed(3),
        ].join(','));
      }
    }

    // ---- render
    if (postfx) postfx.render(scene, activeCam);
    else { renderer.setRenderTarget(null); renderer.render(scene, activeCam); }
    frameCount++;
    if (frameCount === 1 || frameCount === 60) boot(`frame ${frameCount} rendered (cam ${activeCam.position.x.toFixed(1)},${activeCam.position.y.toFixed(1)},${activeCam.position.z.toFixed(1)})`);
  }
  try {
    frame();
  } catch (e) {
    boot(`FRAME_ERROR ${e && e.message} | ${(e && e.stack || '').split('\n')[1] || ''}`);
    throw e;
  }
  frame();
}

main().catch(bootFail);
