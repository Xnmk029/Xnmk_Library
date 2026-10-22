# Cedar Ridge - browser cross-plane V8 sound + driving simulator

A **procedural engine-sound synthesiser** and a **drivable Three.js circuit**, built as one
product: the crank angle of a front-mid 6.2 L **cross-plane V8** drives both the noise you hear
and the wheels of the car you steer. Nothing is sampled - every sound is generated from the
firing schedule of the engine inside an `AudioWorklet`.

Inspired by the public principles of [ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim)
(physics-driven combustion events -> pipe acoustics -> audio), re-derived for the browser with a
strict real-time budget. The boundary between "ported principle" and "own work" is documented in
[DESIGN.md](./DESIGN.md#attribution--boundary-with-engine-sim).

```
        crank angle  ->  firing schedule  ->  blow-down pulses  ->  equal-length runners
             |                                                            |
      valve-area tables (time varying pipe termination)          X-pipe + collectors
             |                                                            |
      intake + mechanical noise                              TRUE DUAL tailpipes + mufflers
             \____________________________  bus  ______________________/
                                             |
                      cabin/exterior EQ -> space reverb (FDN) -> leveller -> limiter
```

## Quick start

```bash
npm install          # three, esbuild, puppeteer-core (only these three)
npm run build        # bundles dist/app.js + dist/engine-worklet.js
npm run serve        # http://127.0.0.1:8125/
```

Open the page, press **Start engine** (a gesture is required by the browser autoplay policy) and
drive. Headphones are recommended: the two cylinder banks leave through two separate tailpipes, so
the cross-plane rumble is partly a stereo effect.

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `W` / `S` | throttle / brake | `C` | camera: chase, cockpit, hood, cinematic |
| `A` / `D` | steer left / right | `T` | hand over to the auto driver |
| `Q` / `E` | gear down / up (leaves auto mode) | `R` | put the car back on the circuit |
| `Space` | handbrake | `M` | mute |
| `Shift` | clutch | `P` | pause |
| `Z` | reverse | `L` | **sound / auto-driver laboratory** |

A gamepad works too (left stick steers, triggers are throttle and brake).

## What is being simulated

### Phase 1 - engine and audio DSP

* **Layout**: 8 cylinders, 90 degree bank angle, **90 degree (cross-plane) crank**, firing order
  **1-8-4-3-6-5-7-2**, equal-length primary headers, true dual exhaust with a 17 % X-pipe.
* **Firing mathematics** (all of it asserted in `test/audio-firing.test.mjs`):

  | quantity | relation | V8 value |
  | --- | --- | --- |
  | cycle | four-stroke | 720 crank degrees |
  | firing interval | `720 / cylinders` | 90 deg (even) |
  | firing frequency | `rpm/60 * cylinders/2` | `rpm / 15` Hz |
  | main engine order | `cylinders / 2` | **4th order** |
  | order n | `n * rpm / 60` Hz | 200 Hz at 3000 rpm (n=4) |
  | per-bank pattern | cross-plane | 90/180/270/180 deg -> **half orders exist** |
  | per-bank pattern | flat-plane reference | 180/180/180/180 deg -> even orders only |

* **Acoustics**: each bank's blow-down pulses excite one equal-length runner modelled as a
  bi-directional digital waveguide. The reflection at the valve end is driven by the bank's
  valve-area table, so the pipe is *time varying* with a 720 degree period - that, plus keeping the
  two banks acoustically separate, is what makes the cross-plane rumble a consequence of the
  geometry instead of a bolted-on effect. Pipe delays follow the speed of sound in the exhaust gas,
  so the note sharpens as the engine heats up under load.
* **Operating states**: idle governor (PID on a bypass throttle), part/full load, rev-limiter
  ignition cut with hysteresis (bounces at ~8 Hz), deceleration fuel cut-off with overrun crackle,
  throttle tip-in bark, per-cylinder trim.
* **Space**: an original early-reflection + 4x4 feedback-delay-network reverberator with four
  presets (`cockpit`, `trackside`, `pitlane`, `tunnel`), switched automatically by the camera view.
* **Ambience**: road/rolling noise, wind, tyre scrub and squeal, kerb rumble and brake squeal,
  driven by the same telemetry (`src/audio/vehicle-ambience.js`).
* **Safety**: parameter smoothing on every control, a slow leveller, a peak limiter and a final
  bounded stage. Output is provably free of NaN, infinities and clipping (see the test report).

### Phase 2 - driving simulator

* **Vehicle**: two-axle single-track (bicycle) planar model - position, heading, body velocities,
  yaw rate and a wheel speed per axle. Longitudinal load transfer, aero drag and downforce,
  combined-slip tyres with a friction circle and load sensitivity, tyre relaxation length,
  traction control, ABS, handbrake and reverse.
* **Powertrain**: the same `EngineController` the synthesiser uses, coupled through a bounded
  viscous clutch to a 6-speed gearbox with automatic or manual shifting.
* **Track**: "Cedar Ridge Motorsport Park", a 2 348 m closed circuit generated from a Catmull-Rom
  centreline: asphalt, white lines, painted kerbs in 11 corners, aprons, gravel traps, tyre
  barriers, grandstand, pit building, start gantry, sponsor and braking-distance boards.
  `surfaceAt()` feeds grip and rolling resistance straight into the physics, so running wide
  really does cost you.
* **Scene**: physical sky, low sun with shadows, exponential haze, displaced terrain with 400+
  instanced trees, and a low-poly modern American muscle car with steering/rolling wheels, body
  pitch and roll, brake and reverse lights and quad exhaust tips.
* **HUD**: analogue tachometer with redline, gear, speed, throttle/brake bars, lateral and
  longitudinal g, lap timing, surface, the live 4th-order frequency and status lamps
  (LIMITER, FUEL CUT, TC, ABS, SHIFT, OFF TRACK).
* **Sound laboratory (`L`)**: a slide-in panel with three live instruments -
  the 720-degree crank clock plus one tile per cylinder in firing order (bank,
  crank throw, seconds to exhaust-valve opening, exhaust/intake lift bars and a
  fire lamp that pulses at each cylinder's firing TDC), a real-time FFT spectrum
  of the mixed output with the engine-order comb overlaid (solid = firing
  harmonics, faint = half orders, plus measured levels for orders 4/8/12/16),
  and the auto-driver's decision chain decomposed term by term.

## Project layout

```
src/
  scene/engine-lab.js     the sound + auto-driver laboratory (per-cylinder state, live FFT, driver decisions)
  audio/                  phase 1: no DOM, no WebAudio - runs in Node and in a worklet
    engine-config.js      engine layout + acoustic geometry (cross-plane and flat-plane presets)
    firing.js             crank/firing kinematics, order maths, valve-area tables
    engine-state.js       torque, idle governor, rev limiter, fuel cut
    engine-synth.js       the synthesiser (pulses, waveguides, muffler, bus, reverb, limiter)
    vehicle-ambience.js   road, wind, tyre and brake noise
    telemetry-mapping.js  vehicle telemetry -> audio controls (pure)
    worklet-processor.js  AudioWorklet front end
    dsp/                  filters, delays, waveguides, reverb, limiter, tables, RNG
    analysis/             FFT + engine-order analysis (used by tests and diagnostics)
  vehicle/                tyre model, powertrain, single-track dynamics, auto driver
  track/                  track geometry, surfaces, lap timing (pure maths)
  scene/                  three.js: textures, environment, track meshes, car, camera, HUD, input
  app/                    browser audio engine + application entry point
test/                     110 Node tests (audio, vehicle, track, integration)
scripts/                  build, serve, browser suite, WAV renderer, benchmark, run-all
artifacts/                rendered WAV clips, screenshots, JSON reports
```

## Tests

```bash
npm test              # 110 Node tests  (~35 s)
npm run test:browser  # 21 browser checks in headless Chrome (~90 s)
npm run test:all      # both, plus the real-time benchmark
npm run render:wav    # 7 WAV clips into artifacts/ for subjective listening
node scripts/benchmark-audio.mjs
```

The audio engine needs **4-5 % of one CPU core** for 48 kHz stereo (20-25x faster than real time);
the whole stack including 120 Hz physics needs about 6.6 %.

Objective acceptance criteria (order frequencies, rpm tracking, output bounds, real-time budget,
vehicle performance, state finiteness, HUD/render/audio-context health) are automated - the measured
values are in [TEST-REPORT.md](./TEST-REPORT.md). Tone, rumble and driving feel stay a **human**
judgement; `npm run render:wav` exists to make that judgement easy:

| clip | what to listen for |
| --- | --- |
| `01-idle-trackside.wav` | the lopey cross-plane beat at 820 rpm |
| `02-throttle-blips.wav` | tip-in bark, overrun crackle on the way down |
| `03-sweep-to-limiter.wav` | order 4 rising from 55 Hz to 450 Hz, limiter bounce |
| `04-cockpit-cruise.wav` | cabin filtering and the short cockpit reverb |
| `05-tunnel-pass.wav` | the tunnel tail doing the work |
| `06-flatplane-reference.wav` | the same pull with a 180 degree crank: no rumble (A/B) |
| `07-slide-and-kerbs.wav` | tyre squeal, rumble strip and exhaust together |

## Requirements

Node 20+ and a Chromium-based browser for the browser suite (the suite uses the Chrome or Edge
already installed on the machine; set `CHROME_PATH` to override). Runtime dependencies of the app
itself: **three** only. `esbuild` and `puppeteer-core` are dev tools.
