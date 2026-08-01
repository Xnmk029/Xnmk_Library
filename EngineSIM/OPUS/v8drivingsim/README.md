# Cross-plane V8 driving simulator

A real-time procedural engine-sound synthesiser — no samples — driving a Three.js
racing simulator with a nonlinear tyre model.

Inspired by [ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim),
but built to a different constraint: the audio has to be cheap enough to run
*underneath* a driving simulator that also wants its CPU for physics and
rendering. Roughly **3% of one core** for the whole engine.

```
npm install
npm start          # http://localhost:8080
```

- **`/`** — the simulator. Click once to start the engine (browsers require a
  gesture before audio), then `H` for controls.
- **`/audio-lab.html`** — the acoustic model on its own bench: rev sweeps, crank
  swaps, room swaps, and a live order spectrum.

Headphones are worth it. The two cylinder banks are genuinely separate signals
all the way to the tailpipes.

---

## What makes the noise

The engine is a 6.4 L naturally aspirated **cross-plane V8**, front-mid mounted,
with **equal-length long-tube headers**, a true dual exhaust and an X-pipe. All
of that is modelled rather than described.

**The burble is the firing table.** A cross-plane crank makes each bank fire at
uneven 90/180/270/180° intervals, and each bank has its own manifold. That
asymmetry *is* the American V8 sound. There is no burble parameter in the code —
there is a firing order and a bank map, and the character falls out of the
arithmetic. Press `V` to switch to a flat-plane crank: nothing changes but the
firing order, and the burble is replaced by a flat-plane howl.

Measured at 2400 rpm with `node tools/analyze.js`:

```
cross-plane   half-order / whole-order energy = -24.0 dB
flat-plane    half-order / whole-order energy = -44.3 dB
```

A 20 dB difference from a permutation of eight integers.

**Equal-length headers collapse to one filter per bank.** Eight identical LTI
filters summed is the same thing as one filter applied to the sum, so one delay
line per bank does the work of sixteen. Exact — and exact *only* because the
headers are equal-length, which is the design that was specified.

**The reverb is a feedback delay network, not a convolution.** A 4×4 FDN with a
Hadamard feedback matrix: ~68 flops and zero added latency per sample, against
~2900 flops and at least a block of latency for a partitioned-FFT convolver with
an equivalent tail. About 40× cheaper, and switching rooms is instantaneous
because a preset is four numbers rather than a new impulse response.

Also modelled: quarter-wave runner resonance at `c/4L` (165 Hz for these
headers), collector and midpipe modes, muffler expansion chambers, tailpipe
radiation, intake plenum and runner resonance, throttle-plate hiss, valvetrain
ticks, per-cylinder manufacturing scatter, rev-limiter spark cut, overrun
crackle, and interior/exterior listener perspective.

Full derivation and cost accounting: **[docs/DSP.md](docs/DSP.md)**.

## What it drives like

A **two-axle single-track (bicycle) model** at 1 kHz with:

- **Pacejka Magic Formula** tyres — nonlinear, with the falling plateau past the
  peak that makes a car snap when you overdrive it. `B` is solved at construction
  so the peak lands exactly at the configured slip and reaches exactly `μ·Fz`.
- **Combined slip** by the similarity method, producing a real friction ellipse:
  you cannot brake and corner at full capacity simultaneously.
- Load sensitivity, relaxation length, longitudinal weight transfer, aero drag
  and downforce, per-axle surface grip.
- A real powertrain: torque curve, flywheel inertia, slipping auto-clutch,
  6-speed gearbox with road-speed-based shift logic, engine braking, rev limiter,
  traction control and ABS (both toggleable, both acting on the pedal so the
  exhaust note responds the way it would to a driver lifting).

Measured, not estimated (`node tools/…` and the test suite):

| | |
|---|---|
| 0–100 km/h | 5.1 s |
| quarter mile | 13.1 s @ 183 km/h |
| top speed | 293 km/h, drag-limited in 5th |
| 100–0 km/h | 42 m (0.94 g average, 1.04 g peak) |
| peak lateral | 1.09 g |

Those land close to a real 6.4 L Challenger, which is the point — the numbers
come out of the model rather than being dialled in. Wheelspin off the line is
real: peak rear slip ratio is 0.88 with traction control off and 0.25 with it
on.

Details and the bugs that shaped it: **[docs/VEHICLE.md](docs/VEHICLE.md)**.

## The world

- A **1.6 km circuit** generated as a closed radial harmonic curve, so it is
  smooth and closed by construction with no control points to nudge into a loop
  that almost joins up. Four distinct corners, tightest radius 29 m. Being
  star-shaped also makes locating the car an `atan2` instead of a search.
- **Procedural textures**, all generated into canvases at load: asphalt with a
  normal map derived from the same height field as the albedo, plus a roughness
  map so the racing line is shinier than the rest of the track; grass, gravel
  run-off, concrete, and a scuffed start/finish chequer.
- **Two-tone kerbs** placed by curvature — inside kerbs through apexes, outside
  kerbs at corner exits — coloured with vertex colours, so the blocks align
  exactly to geometry with no texture and no aliasing.
- A **procedural sky** with an analytic atmosphere, Mie forward scattering, a sun
  disc and drifting noise clouds, prefiltered into an environment map so the car
  paint, chrome and Armco have something to reflect. The sun direction is a
  parameter, so the sky, the directional light and the fog colour always agree.
  Four times of day (`K`).
- A **low-poly muscle car** built as a lofted hull — ten cross-sections, ten
  points each — with body roll, pitch, squat and suspension travel driven by the
  chassis accelerations, independent wheel spin per axle, and brake lights.
- Tyre smoke and skid marks as fixed-size ring buffers, so a long drift never
  allocates.
- Grandstand, start gantry with lights, Armco, tyre walls, braking boards and
  ~260 instanced trees. About 90 draw calls for the whole scene.

## Controls

| | |
|---|---|
| `W` `S` / `↑` `↓` | throttle, brake |
| `A` `D` / `←` `→` | steer |
| `Space` | handbrake |
| `Shift` | clutch |
| `Q` `E` | shift down / up |
| `M` | automatic / manual gearbox |
| `G` | reverse |
| `C` | camera (chase, hood, cockpit, wheel, orbit) |
| `K` | time of day |
| `[` `]` | acoustic room |
| `V` | cross-plane / flat-plane crank |
| `T` `B` | traction control / ABS |
| `R` | back on track |
| `N` | clear skid marks |
| `P` `H` | pause, help |

A gamepad is picked up automatically and takes priority the moment an axis moves;
keyboard input is rate-limited into analogue ramps, because a step from zero to
full lock is not an input any human or wheel can produce.

## Tests and tools

```
npm test                          # 39 tests: DSP, tyres, powertrain, chassis
node tools/render-wav.js          # render a rev sweep to a WAV, no browser
node tools/render-wav.js --script launch --preset tunnel
node tools/analyze.js --rpm 2400  # order spectrum in the terminal
node tools/analyze.js --rpm 2400 --engine flatplane-v8-64
```

The tests are the interesting part, because several of them found real bugs:

- *the cross-plane crank puts energy at half-orders that a flat-plane crank does
  not* — caught the exhaust topology cancelling the burble exactly (both banks
  through identical filters, then summed, is the same as summing first).
- *the tyre peaks near its design slip and falls off past it* — caught the Magic
  Formula peaking at 27° of slip instead of the configured 8.9°.
- *equal-length primaries resonate where a quarter-wave pipe should* — pins the
  duct model to `c/4L` and its odd harmonics.
- *nothing goes non-finite under 60 s of abusive input*, *a huge frame time does
  not blow the integrator up* — the unglamorous ones.

## Layout

```
src/
  audio/    engine-config.js    engine definitions, firing-order derivation
            engine-worklet.js   the DSP (self-contained: worklets cannot import)
            engine-audio.js     AudioContext, presets, ambience
  sim/      engine.js  drivetrain.js  tires.js  vehicle.js
  track/    spline.js  track.js  textures.js  scenery.js
  render/   scene.js  sky.js  car.js  effects.js
  ui/       input.js  hud.js
tools/      serve.js  render-wav.js  analyze.js
docs/       DSP.md  VEHICLE.md
```

`src/audio/*` and `src/sim/*` import nothing from three.js, which is why they can
be tested under bare node. `src/render/*` and `src/track/*` never write to the
simulation. The dependency arrow points one way: the physics runs, then the
renderer and the audio graph read it.

## Requirements

A browser with WebGL2 and AudioWorklet — any current Chrome, Firefox, Safari or
Edge. `npm install` pulls exactly one dependency (three.js); an import map
resolves it, so there is no build step. Swap the import map in `index.html` for a
CDN URL if you would rather not install anything.

Note that the in-app DSP readout reports `n/a in browser` on Chromium:
`performance.now()` is absent from its `AudioWorkletGlobalScope`, and
`AudioContext.renderCapacity` is still flagged off. The code uses whichever is
available and refuses to report a confident zero when neither is — use
`npm test` for a real measurement.

## Licence

MIT.
