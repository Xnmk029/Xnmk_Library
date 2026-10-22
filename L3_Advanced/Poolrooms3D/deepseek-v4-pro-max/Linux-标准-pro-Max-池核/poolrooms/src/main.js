// Poolrooms — entry point.
//
// Boot order: renderer -> procedural PBR textures -> baked HDRI -> world stream -> render loop.
// There is no UI and no objective: the only interaction is looking and moving.

import * as THREE from 'three';
import { CFG, applyTier, QUALITY_TIERS } from './core/Config.js';
import { MaterialLibrary } from './materials/Materials.js';
import { SkySystem } from './lighting/Sky.js';
import { LightPool } from './lighting/LightPool.js';
import { Motes } from './lighting/Motes.js';
import { WaterSystem } from './water/Water.js';
import { ChunkStreamer } from './world/ChunkStreamer.js';
import { Pipeline } from './renderer/Pipeline.js';
import { Player } from './player/Player.js';
import { Ambience } from './audio/Ambience.js';
import { generateChunk } from './world/WorldGen.js';

const canvas = document.getElementById('view');
const veil = document.getElementById('veil');
const bar = document.querySelector('#bar > i');
const hint = document.getElementById('hint');

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const progress = async (pct, _label) => {
  if (bar) bar.style.width = Math.round(pct * 100) + '%';
  await nextFrame();
};

// The veil is the only piece of screen furniture. Register its dismissal before the (async) boot so
// an impatient click is never swallowed.
let started = false;
let onBegin = null;
function begin() {
  if (started) return;
  started = true;
  veil?.classList.add('gone');
  setTimeout(() => veil?.remove(), 1400);
  if (canvas.requestPointerLock) {
    try { canvas.requestPointerLock(); } catch { /* headless / denied */ }
  }
  onBegin?.();
}
veil?.addEventListener('click', begin);
addEventListener('keydown', begin, { once: true });
canvas.addEventListener('click', begin);

// ---- renderer ----------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // TAA handles edges
  alpha: false,
  stencil: false,
  depth: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
if (!renderer.capabilities.isWebGL2) {
  throw new Error('WebGL2 is required for the Poolrooms renderer.');
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CFG.quality.maxPixelRatio));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NoToneMapping; // graded in the final pass
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;

// Pick a starting quality tier from a coarse GPU guess.
(() => {
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const name = (dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || '';
  const soft = /swiftshader|software|llvmpipe|basic render/i.test(name);
  const weak = /intel|uhd|iris|apple m1(?!.*max)|adreno|mali|powervr/i.test(name);
  applyTier(soft ? 'low' : weak ? 'medium' : 'high');
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CFG.quality.maxPixelRatio));
  console.log('[poolrooms] GPU:', name || 'unknown', '-> tier', CFG.quality.name);
})();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CFG.fov, innerWidth / innerHeight, CFG.near, CFG.far);
camera.rotation.order = 'YXZ';
scene.add(camera);

// ---- boot sequence -----------------------------------------------------------------------------
await progress(0.05);

const lib = new MaterialLibrary(renderer, {
  textureSize: CFG.quality.textureSize,
  anisotropy: CFG.quality.anisotropy,
});
await progress(0.4);

const sky = new SkySystem(renderer, scene, CFG);
sky.build(1024);
lib.setEnvironment(sky.envMap, CFG.envIntensity);
await progress(0.6);

const water = new WaterSystem({ renderer, camera, cfg: CFG, sky });
const streamer = new ChunkStreamer({
  scene,
  lib,
  water,
  seed: CFG.seed,
  radius: CFG.chunkRadius,
  budgetMs: 5,
});

// Spawn on the deck of the origin chunk.
const home = generateChunk(0, 0, CFG.seed);
const spawn = home.spawn || [16, 0, 16];
streamer.primeAround(spawn[0], spawn[2]);
await progress(0.85);

const player = new Player({ camera, streamer, domElement: canvas, cfg: CFG });

// Pick the most open of the nearby chunk spawns and face the roomiest direction, so the first
// thing the player sees is a hall rather than a corner.
function chooseSpawn() {
  const rc = new THREE.Raycaster();
  rc.far = 40;
  const dir = new THREE.Vector3();
  const origin = new THREE.Vector3();

  const candidates = [];
  for (const rec of streamer.chunks.values()) {
    const sp = rec.chunk.spawn;
    if (!sp) continue;
    if (Math.abs(rec.cx) > 1 || Math.abs(rec.cz) > 1) continue;
    candidates.push({ sp, archetype: rec.chunk.archetype });
  }
  if (!candidates.length) return { pos: spawn, yaw: Math.PI * 0.25 };

  let best = null;
  for (const c of candidates) {
    const ground = streamer.groundHeight(c.sp[0], c.sp[2], c.sp[1] + 1.4);
    const y = (isFinite(ground) ? Math.max(c.sp[1], ground) : c.sp[1]) + CFG.eyeHeight;
    origin.set(c.sp[0], y, c.sp[2]);
    let total = 0;
    let bestDir = 0;
    let bestDist = -1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      dir.set(Math.sin(a), 0, Math.cos(a)).normalize();
      rc.set(origin, dir);
      const hit = rc.intersectObject(streamer.group, true);
      const d = hit.length ? hit[0].distance : rc.far;
      total += d;
      if (d > bestDist) {
        bestDist = d;
        // Camera yaw convention: forward is (-sin(yaw), 0, -cos(yaw)).
        bestDir = Math.atan2(-dir.x, -dir.z);
      }
    }
    // Prefer open space, and nudge towards the archetypes that show the water off best.
    const bonus = { grandPool: 1.45, atrium: 1.4, lapPools: 1.2, stairTerraces: 1.15, shallowHall: 1.1, divingWell: 0.9, changingRooms: 0.85, corridorMaze: 0.9 }[c.archetype] || 1.0;
    const score = total * bonus;
    if (!best || score > best.score) best = { score, pos: [c.sp[0], c.sp[1], c.sp[2]], yaw: bestDir, archetype: c.archetype };
  }
  return best;
}

/** Aim the spawn at the nearest unobstructed pool, so the first view is water. */
function aimAtWater(pos, fallbackYaw) {
  const rc = new THREE.Raycaster();
  const eye = new THREE.Vector3(pos[0], pos[1] + CFG.eyeHeight, pos[2]);
  let best = null;
  for (const rec of streamer.chunks.values()) {
    for (const w of rec.waters) {
      const cx = (w.x0 + w.x1) * 0.5;
      const cz = (w.z0 + w.z1) * 0.5;
      const area = (w.x1 - w.x0) * (w.z1 - w.z0);
      const dx = cx - eye.x;
      const dz = cz - eye.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.5 || dist > 30) continue;
      const dir = new THREE.Vector3(dx, w.surface - eye.y, dz).normalize();
      rc.set(eye, dir);
      rc.far = dist;
      const hit = rc.intersectObject(streamer.group, true);
      const blocked = hit.length > 0 && hit[0].distance < dist - 1.0;
      if (blocked) continue;
      const score = area / (dist * dist + 1);
      if (!best || score > best.score) best = { score, yaw: Math.atan2(-dx, -dz) };
    }
  }
  return best ? best.yaw : fallbackYaw;
}

const chosen = chooseSpawn();
chosen.yaw = aimAtWater(chosen.pos, chosen.yaw);
const spawnGround = streamer.groundHeight(chosen.pos[0], chosen.pos[2], chosen.pos[1] + 1.2);
player.teleport(chosen.pos[0], Math.max(chosen.pos[1], spawnGround) + 0.05, chosen.pos[2]);
player.yaw = chosen.yaw;
console.log('[poolrooms] spawn', chosen.archetype, chosen.pos.map((v) => Math.round(v)).join(','));

const pipeline = new Pipeline({ renderer, scene, camera, cfg: CFG, sky, water, streamer });
pipeline.ambient.up.copy(sky.ambient.up);
pipeline.ambient.horizon.copy(sky.ambient.horizon);
pipeline.ambient.down.copy(sky.ambient.down);

const lightPool = new LightPool(scene, { count: 6, range: 40 });
// Motes live in the water scene, which the pipeline draws after the opaque pass with depth intact.
const motes = new Motes({ scene: water.scene, count: 2200, volume: [26, 5.5, 26] });
const ambience = new Ambience();

function resize() {
  const scale = CFG.quality.renderScale;
  const pr = Math.min(devicePixelRatio || 1, CFG.quality.maxPixelRatio);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const w = Math.floor(innerWidth * pr * scale);
  const h = Math.floor(innerHeight * pr * scale);
  pipeline.setSize(w, h);
}
addEventListener('resize', resize);
resize();
await progress(1.0);

// ---- adaptive quality --------------------------------------------------------------------------
const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];
const perf = { avg: 16.7, samples: 0, lastSwitch: 0, locked: false, renderAvg: 8, renderSamples: 0, playerAvg: 0, worldAvg: 0, failedTier: null, warmed: false, bootAt: performance.now(), lastVerdict: 0, slowStreak: 0, fastStreak: 0 };

function adapt(dtMs, now) {
  perf.avg += (dtMs - perf.avg) * 0.05;
  perf.samples++;

  // Ignore the first couple of seconds: shader compiles, texture bakes and the initial chunk build
  // all land there and would trigger a spurious downgrade.
  if (!perf.warmed) {
    if (perf.samples > 60 && now - perf.bootAt > 2500) {
      perf.warmed = true;
      perf.avg = 16.7;
      perf.renderAvg = 8;
      perf.samples = 0;
      perf.renderSamples = 0;
    }
    return;
  }
  if (perf.locked || perf.samples < 60) return;

  // Judge once a second on the frame delta (what actually rises when a vsync'd browser cannot keep
  // up) with GPU-synchronised render time as a secondary signal for benchmark runs. A tier only
  // changes after the verdict holds for several seconds, so a single hiccup never flips quality.
  if (now - perf.lastVerdict < 1000) return;
  perf.lastVerdict = now;

  const slow = perf.avg > 21.5 || perf.renderAvg > 14.5;
  const fast = perf.avg < 17.2 && perf.renderAvg < 9.0;
  perf.slowStreak = slow ? perf.slowStreak + 1 : 0;
  perf.fastStreak = fast ? perf.fastStreak + 1 : 0;

  if (now - perf.lastSwitch < 5000) return;
  const idx = TIER_ORDER.indexOf(CFG.quality.name);

  if (perf.slowStreak >= 3 && idx > 0) {
    perf.failedTier = CFG.quality.name;
    applyTier(TIER_ORDER[idx - 1]);
    perf.lastSwitch = now;
    perf.slowStreak = 0;
    perf.fastStreak = 0;
    resizeForTier();
  } else if (perf.fastStreak >= 6 && idx < 2 && TIER_ORDER[idx + 1] !== perf.failedTier) {
    // Only auto-climb to 'high'; 'ultra' stays opt-in.
    applyTier(TIER_ORDER[idx + 1]);
    perf.lastSwitch = now;
    perf.slowStreak = 0;
    perf.fastStreak = 0;
    resizeForTier();
  }
}

function resizeForTier() {
  water.uniforms.uSsrSteps.value = CFG.quality.ssrSteps;
  pipeline.width = 0;
  pipeline.height = 0;
  resize();
  console.log('[poolrooms] quality ->', CFG.quality.name, 'avg', perf.avg.toFixed(1) + 'ms');
}

// ---- loop --------------------------------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;
let frames = 0;
let fpsAcc = 0;
let fps = 0;

let frozen = false;
let gpuSync = false;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!frozen) elapsed += dt;
  const now = performance.now();

  const tA = performance.now();
  player.update(dt);
  const tB = performance.now();
  streamer.update(player.position.x, player.position.z);
  lightPool.update(dt, player.position, streamer);
  motes.update(elapsed, player.position, sky.sun, renderer.getPixelRatio(), sky.ambient.horizon);
  sky.update(player.position);
  lib.update(elapsed);
  const tC = performance.now();

  // Audio follows the player's contact with water.
  const step = player.consumeFootstep();
  if (step) {
    ambience.footstep(step === 2);
    if (step === 2) water.addRipple(player.position.x, player.position.z, 0.9);
  }
  if (player.consumeSplash()) {
    ambience.splash();
    water.addRipple(player.position.x, player.position.z, 2.2);
  }
  // Swimming continuously stirs the surface.
  if (player.swimming && Math.random() < dt * 6) {
    water.addRipple(player.position.x, player.position.z, 0.55);
  }
  ambience.update(dt, {
    submerged: player.submerged,
    nearWater: !!streamer.waterColumnAt(player.position.x, player.position.z),
    speed: Math.hypot(player.velocity.x, player.velocity.z),
  });

  // Measure the render itself; with gpuSync the GPU is drained inside the window, so this is the
  // true cost of one frame's rendering work (CPU submission + GPU execution).
  const rt0 = performance.now();
  pipeline.render(dt, elapsed, player);
  if (gpuSync) renderer.getContext().finish();
  const renderMs = performance.now() - rt0;
  perf.renderAvg += (renderMs - perf.renderAvg) * 0.04;
  perf.renderSamples++;
  perf.playerAvg += (tB - tA - perf.playerAvg) * 0.04;
  perf.worldAvg += (tC - tB - perf.worldAvg) * 0.04;

  fpsAcc += dt;
  frames++;
  if (fpsAcc > 0.5) {
    fps = frames / fpsAcc;
    frames = 0;
    fpsAcc = 0;
  }
  adapt(dt * 1000, now);
  perf.lastDraws = renderer.info.render.calls;
  perf.lastTris = renderer.info.render.triangles;
  renderer.info.reset();
  requestAnimationFrame(frame);
}

onBegin = () => ambience.start();
if (started) ambience.start();
hint?.classList.add('on');

requestAnimationFrame(frame);

// ---- debug / automation surface (no visible UI) -------------------------------------------------
window.__poolrooms = {
  ready: true,
  CFG,
  THREE,
  renderer,
  scene,
  camera,
  player,
  streamer,
  water,
  sky,
  pipeline,
  lib,
  begin,
  stats: () => ({
    fps: Math.round(fps * 10) / 10,
    avgFrameMs: Math.round(perf.avg * 100) / 100,
    tier: CFG.quality.name,
    renderSize: [pipeline.width, pipeline.height],
    drawCalls: perf.lastDraws || 0,
    triangles: perf.lastTris || 0,
    programs: renderer.info.programs?.length ?? 0,
    chunks: streamer.stats.chunks,
    pending: streamer.stats.pending,
    waterSurfaces: water.surfaces.length,
    position: player.position.toArray().map((v) => Math.round(v * 100) / 100),
    submerged: player.submerged,
    inWater: player.inWater,
    onGround: player.onGround,
    archetypes: [...streamer.chunks.values()].map((c) => c.chunk.archetype),
    ambientProbe: {
      up: sky.ambient.up.toArray().map((v) => Math.round(v * 1000) / 1000),
      horizon: sky.ambient.horizon.toArray().map((v) => Math.round(v * 1000) / 1000),
      down: sky.ambient.down.toArray().map((v) => Math.round(v * 1000) / 1000),
    },
  }),
  hdrProbe: (which = 'hdrRT') => pipeline.readHDR(which),

  /** Fraction of deck sample points that can see the sun / the sky straight up. */
  sunProbe: (n = 240) => {
    const rc = new THREE.Raycaster();
    rc.far = 120;
    const up = new THREE.Vector3(0, 1, 0);
    const toSun = sky.sunDir.clone();
    let lit = 0;
    let open = 0;
    let valid = 0;
    const base = player.position;
    for (let i = 0; i < n; i++) {
      const a = (i * 0.61803398875) % 1;
      const b = ((i * 0.7548776662) % 1);
      const x = base.x + (a - 0.5) * 90;
      const z = base.z + (b - 0.5) * 90;
      const g = streamer.groundHeight(x, z, 3.0);
      if (!isFinite(g)) continue;
      valid++;
      const o = new THREE.Vector3(x, g + 0.25, z);
      rc.set(o, toSun);
      if (rc.intersectObject(streamer.group, true).length === 0) lit++;
      rc.set(o, up);
      if (rc.intersectObject(streamer.group, true).length === 0) open++;
    }
    return { samples: valid, sunlitPct: Math.round((lit / Math.max(1, valid)) * 100), openSkyPct: Math.round((open / Math.max(1, valid)) * 100) };
  },
  teleport: (x, y, z) => player.teleport(x, y, z),
  look: (yaw, pitch) => {
    player.yaw = yaw;
    player.pitch = pitch;
  },
  press: (k, down = true) => {
    player.keys[k] = down;
  },
  setTier: (name) => {
    if (!QUALITY_TIERS[name]) return false;
    applyTier(name);
    perf.locked = true;
    resizeForTier();
    return true;
  },
  lockQuality: (v = true) => {
    perf.locked = v;
  },
  perfReset: () => {
    perf.samples = 0;
    perf.avg = 16.7;
    perf.renderSamples = 0;
    perf.renderAvg = 8;
    perf.playerAvg = 0;
    perf.worldAvg = 0;
    return true;
  },
  perfRead: () => ({
    avgFrameMs: Math.round(perf.avg * 100) / 100,
    renderMs: Math.round(perf.renderAvg * 100) / 100,
    fpsFromRender: Math.round((1000 / Math.max(0.01, perf.renderAvg)) * 10) / 10,
    playerMs: Math.round(perf.playerAvg * 100) / 100,
    worldMs: Math.round(perf.worldAvg * 100) / 100,
    samples: perf.samples,
    renderSamples: perf.renderSamples,
  }),

  /** Set individual quality fields at runtime (used by tools/calibrate.mjs --plan qsweep). */
  qual: (o = {}) => {
    const q = CFG.quality;
    let realloc = false;
    for (const k of ['ssgiRays', 'ssgiSteps', 'ssrSteps', 'fogSteps', 'waterTess']) {
      if (o[k] !== undefined) q[k] = o[k];
    }
    for (const k of ['ssgiScale', 'fogScale', 'renderScale', 'maxPixelRatio']) {
      if (o[k] !== undefined && q[k] !== o[k]) {
        q[k] = o[k];
        realloc = true;
      }
    }
    if (o.shadowMapSize !== undefined && o.shadowMapSize !== q.shadowMapSize) {
      q.shadowMapSize = o.shadowMapSize;
      sky.sun.shadow.mapSize.set(o.shadowMapSize, o.shadowMapSize);
      sky.sun.shadow.map?.dispose();
      sky.sun.shadow.map = null;
    }
    water.uniforms.uSsrSteps.value = q.ssrSteps;
    perf.locked = true;
    if (realloc) resizeForTier();
    pipeline.historyValid = false;
    return { ...q };
  },

  /** Toggle individual render features (A/B verification). */
  flags: (o = {}) => {
    const q = CFG.quality;
    if (o.taa !== undefined) q.taa = !!o.taa;
    if (o.ssgi !== undefined) q.ssgi = !!o.ssgi;
    if (o.ssr !== undefined) q.ssr = !!o.ssr;
    if (o.fog !== undefined) q.fog = !!o.fog;
    if (o.bloom !== undefined) q.bloom = !!o.bloom;
    if (o.water !== undefined) water.scene.visible = !!o.water;
    if (o.caustics !== undefined) lib.causticStrength.value = o.caustics ? 1 : 0;
    if (o.motes !== undefined) motes.setVisible(!!o.motes);
    if (o.freeze !== undefined) frozen = !!o.freeze;
    if (o.gpuSync !== undefined) gpuSync = !!o.gpuSync;
    if (o.prepass !== undefined) pipeline.skipPrepass = !o.prepass;
    if (o.radius !== undefined) {
      CFG.chunkRadius = o.radius;
      streamer.radius = o.radius;
      streamer.center = [Infinity, Infinity];
      streamer.update(player.position.x, player.position.z);
      while (streamer.queue.length) streamer._buildOne();
    }
    if (o.shadows !== undefined) {
      renderer.shadowMap.enabled = !!o.shadows;
      for (const m of lib.forwardMaterials) m.needsUpdate = true;
    }
    pipeline.historyValid = false;
    return { taa: q.taa, ssgi: q.ssgi, ssr: q.ssr, fog: q.fog, bloom: q.bloom, water: water.scene.visible, caustics: lib.causticStrength.value, shadows: renderer.shadowMap.enabled, motes: motes.points.visible, frozen };
  },

  /** Live look calibration (used by tools/calibrate.mjs). */
  tune: (o = {}) => {
    if (o.sun !== undefined) {
      CFG.sunIntensity = o.sun;
      sky.sun.intensity = o.sun;
    }
    if (o.fill !== undefined) sky.fill.intensity = o.fill;
    if (o.env !== undefined) {
      CFG.envIntensity = o.env;
      scene.environmentIntensity = o.env;
    }
    if (o.bg !== undefined) {
      CFG.skyIntensity = o.bg;
      scene.backgroundIntensity = o.bg;
    }
    if (o.exposure !== undefined) CFG.exposure = o.exposure;
    if (o.gi !== undefined) pipeline.giScale = o.gi;
    if (o.ao !== undefined) pipeline.aoStrength = o.ao;
    if (o.ssr !== undefined) pipeline.ssrScale = o.ssr;
    if (o.bloom !== undefined) pipeline.bloomStrength = o.bloom;
    if (o.fog !== undefined) CFG.fogDensity = o.fog;
    if (o.fogSun !== undefined) pipeline.fogSunScale = o.fogSun;
    if (o.caustics !== undefined) lib.causticStrength.value = o.caustics;
    if (o.absorb !== undefined) water.uniforms.uAbsorb.value.fromArray(o.absorb);
    if (o.scatter !== undefined) water.uniforms.uScatter.value.fromArray(o.scatter);
    if (o.uwAbsorb !== undefined) pipeline.resolveQuad.material.uniforms.uWaterAbsorb.value.fromArray(o.uwAbsorb);
    if (o.uwScatter !== undefined) pipeline.resolveQuad.material.uniforms.uWaterScatter.value.fromArray(o.uwScatter);
    pipeline.historyValid = false;
    return {
      sun: CFG.sunIntensity, fill: sky.fill.intensity, env: CFG.envIntensity, bg: CFG.skyIntensity,
      exposure: CFG.exposure, gi: pipeline.giScale, ao: pipeline.aoStrength, ssr: pipeline.ssrScale,
      bloom: pipeline.bloomStrength, fog: CFG.fogDensity, fogSun: pipeline.fogSunScale,
    };
  },

  /** Ray-probe the world so automation can tell whether the camera is enclosed. */
  probe: () => {
    const rc = new THREE.Raycaster();
    rc.far = 200;
    const dirs = {
      fwd: new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion),
      back: new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
      left: new THREE.Vector3(-1, 0, 0).applyQuaternion(camera.quaternion),
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
      up: new THREE.Vector3(0, 1, 0),
      down: new THREE.Vector3(0, -1, 0),
    };
    const out = {};
    for (const [k, d] of Object.entries(dirs)) {
      rc.set(camera.position, d.normalize());
      const hits = rc.intersectObject(streamer.group, true);
      out[k] = hits.length
        ? { dist: Math.round(hits[0].distance * 100) / 100, mat: hits[0].object.material.name || hits[0].object.name }
        : null;
    }
    const w = streamer.waterColumnAt(camera.position.x, camera.position.z);
    out.water = w ? { surface: w.surface, bottom: w.bottom, kind: w.kind } : null;
    out.eye = camera.position.toArray().map((v) => Math.round(v * 100) / 100);
    out.enclosed = !!(out.up && out.down);
    return out;
  },
};
console.log('[poolrooms] ready');
