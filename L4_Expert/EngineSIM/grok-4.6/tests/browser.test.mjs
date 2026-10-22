import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { EngineDsp, attachScriptProcessor } from '../engine-dsp.mjs';
import { Vehicle } from '../vehicle.mjs';
import { createInputState, applyKey, toVehicleInput } from '../input.mjs';
import { formatHud, HUD_FIELDS } from '../hud.mjs';
import { SCENE_SPEC, sampleRoundedRect } from '../scene.mjs';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('index.html wires AudioContext, HUD, driving keys and Three.js CDN', () => {
  const html = read('index.html');
  const main = read('main.mjs');
  assert.match(html, /cdn\.jsdelivr\.net\/npm\/three@/);
  assert.match(html, /id="hud-rpm"/);
  assert.match(html, /id="hud-speed"/);
  assert.match(html, /id="hud-gear"/);
  assert.match(html, /id="hud-throttle"/);
  assert.match(html, /id="hud-status"/);
  assert.match(html, /id="view"/);
  assert.match(html, /id="start-overlay"/);
  assert.match(main, /AudioContext|webkitAudioContext/);
  assert.match(main, /attachScriptProcessor/);
  assert.match(main, /WebGLRenderer/);
  assert.match(main, /bindKeyboard/);
  assert.match(html, /KeyW|W \/ ↑/);
});

test('scene spec includes sky, lighting, asphalt and dual-color curbs', () => {
  const sceneSrc = read('scene.mjs');
  assert.equal(SCENE_SPEC.sky, true);
  assert.equal(SCENE_SPEC.asphalt, true);
  assert.deepEqual(SCENE_SPEC.dualColorCurbs, ['#c41e3a', '#f4f0e6']);
  assert.match(sceneSrc, /HemisphereLight/);
  assert.match(sceneSrc, /DirectionalLight/);
  assert.match(sceneSrc, /SphereGeometry/);
  assert.match(sceneSrc, /0xc41e3a/);
  assert.match(sceneSrc, /0xf4f0e6/);
  assert.match(sceneSrc, /engineBay/);
  const path = sampleRoundedRect(180, 110, 28, 4);
  assert.ok(path.length > 80);
});

test('browser session: input, physics, HUD and audio buffers', () => {
  const vehicle = new Vehicle();
  const dsp = new EngineDsp({ sampleRate: 44100 });
  const input = createInputState();
  applyKey(input, 'KeyW', true);
  applyKey(input, 'KeyD', true);
  vehicle.setInput(toVehicleInput(input));
  for (let i = 0; i < 240; i++) vehicle.step(1 / 120);
  const st = vehicle.getState();
  const hud = formatHud(st);
  for (const field of HUD_FIELDS) assert.ok(field in hud);
  assert.equal(typeof hud.rpm, 'number');
  assert.equal(typeof hud.speedKmh, 'number');
  assert.equal(typeof hud.gear, 'string');
  assert.match(hud.throttleText, /%$/);
  assert.ok(hud.status.length > 0);
  assert.ok(st.speedMs > 1);

  let resumed = false;
  const fakeCtx = {
    sampleRate: 44100,
    state: 'suspended',
    destination: {},
    resume() {
      this.state = 'running';
      resumed = true;
      return Promise.resolve();
    },
    createScriptProcessor() {
      return {
        connect() {},
        onaudioprocess: null,
      };
    },
  };
  fakeCtx.resume();
  const node = attachScriptProcessor(fakeCtx, dsp, () => ({
    rpm: st.rpm,
    throttle: st.throttle,
    load: st.load,
    fuelCut: st.fuelCut,
    speedMs: st.speedMs,
  }));
  const left = new Float32Array(512);
  const right = new Float32Array(512);
  node.onaudioprocess({
    outputBuffer: {
      getChannelData(ch) {
        return ch === 0 ? left : right;
      },
    },
  });
  assert.equal(resumed, true);
  assert.equal(fakeCtx.state, 'running');
  assert.equal(Number.isFinite(left[0]), true);
  assert.ok(hud.rpm > 0);
});

test('product sources have no unfinished markers', () => {
  const files = [
    'engine-dsp.mjs',
    'vehicle.mjs',
    'scene.mjs',
    'main.mjs',
    'input.mjs',
    'hud.mjs',
    'index.html',
    'README.md',
    'serve.mjs',
  ];
  for (const rel of files) {
    const text = read(rel);
    assert.equal(/TOD[O]/.test(text), false, rel);
    assert.equal(text.includes('FIXME'), false, rel);
  }
});
