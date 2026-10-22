# Test report

Everything objective is automated; tone, rumble and driving feel stay a human judgement. The numbers
below were measured on Windows, Node 24.15, Chrome headless (SwiftShader), one core of a desktop CPU.

Reproduce with:

```bash
npm test              # 110 Node tests
npm run test:browser  # 15 browser checks
npm run test:all      # both + the real-time benchmark
```

## Summary

| suite | file(s) | tests | result |
| --- | --- | --- | --- |
| firing kinematics | `test/audio-firing.test.mjs` | 10 | pass |
| engine states (idle, load, cuts) | `test/audio-engine-state.test.mjs` | 7 | pass |
| engine orders / rpm tracking | `test/audio-orders.test.mjs` | 8 | pass |
| output bounds and click-freedom | `test/audio-bounds.test.mjs` | 9 | pass |
| DSP primitives | `test/audio-dsp.test.mjs` | 15 | pass |
| AudioWorklet protocol | `test/audio-worklet.test.mjs` | 6 | pass |
| real-time budget | `test/audio-performance.test.mjs` | 4 | pass |
| vehicle idle | `test/vehicle-idle.test.mjs` | 6 | pass |
| vehicle acceleration | `test/vehicle-acceleration.test.mjs` | 7 | pass |
| vehicle braking | `test/vehicle-braking.test.mjs` | 7 | pass |
| vehicle steering | `test/vehicle-steering.test.mjs` | 9 | pass |
| vehicle robustness | `test/vehicle-robustness.test.mjs` | 6 | pass |
| track geometry and lap timing | `test/track-layout.test.mjs` | 10 | pass |
| integration (car -> engine -> audio) | `test/integration-drive.test.mjs` | 6 | pass |
| **Node total** | | **110** | **pass in ~35 s** |
| browser suite | `scripts/test-browser.mjs` | 21 | pass in ~90 s |

## Phase 1 - audio, measured values

### Firing / order mathematics (exact, not approximate)

* 8 firings per 720 degrees, interval exactly 90 degrees; firing frequency exactly `rpm/15`;
  main order exactly 4; order `n` at `n*rpm/60` Hz - all asserted to 1e-9.
* Cross-plane crank: pin angles {0, 90, 180, 270}, per-bank intervals {90, 180, 180, 270},
  throw pairs (1,2)(3,4)(5,6)(7,8) consistent from both banks.
* Flat-plane reference: pin angles {0, 180}, per-bank intervals {180, 180, 180, 180}.

### Order tracking in the rendered audio

Measured peak of the 4th order versus `4*rpm/60` (2.8 s window, Hann, log-domain parabolic
interpolation; assertion threshold 0.3 %):

| rpm | expected | measured | error |
| --- | --- | --- | --- |
| 800 | 53.33 Hz | 53.35 Hz | +0.04 % |
| 1800 | 120.00 Hz | 120.02 Hz | +0.02 % |
| 3400 | 226.67 Hz | 226.67 Hz | 0.00 % |
| 5000 | 333.33 Hz | 333.32 Hz | -0.00 % |
| 6400 | 426.67 Hz | 426.67 Hz | 0.00 % |

Also asserted: the 4th order is the strongest order below the 6th at every operating point
(idle to 6300 rpm) and stands >= 8 dB above its 3.5/4.5 sidebands; orders 8, 12 and 16 land within
0.1 % of `n*rpm/60` and >= 5 dB above the local non-harmonic floor; the loudest component below
1.2 kHz is always within 2 % of an integer multiple of the firing frequency; tracking is identical at
44.1 kHz and 48 kHz.

### Cross-plane character (objective, not subjective)

Half-integer order energy in one channel, wide open throttle: cross-plane exceeds the flat-plane
reference by **+22.0 dB at 900 rpm, +29.4 dB at 3000 rpm, +29.0 dB at 5200 rpm** (assertion: > 12 dB),
while the 4th order differs by less than 4 dB between the two layouts.

### Output bounds

| case | peak | clipped samples | non-finite |
| --- | --- | --- | --- |
| 0 rpm to 7400 rpm, idle to full load (8 points) | < 0.75 | 0 | 0 |
| every space preset x 3 operating points | < 0.96 | 0 | 0 |
| master gain 4x in the tunnel space | < 1 | 0 | 0 |
| hostile controls (NaN, +/-Inf, 1e12, negative) | < 1 | 0 | 0 |
| engine + ambience, worst case, gain 3x | < 1 | 0 | 0 |
| 40 s of car-driven audio (integration) | < 1 | 0 | 0 |

RMS spans -26 dBFS at idle to -12 dBFS at the limiter, so load dynamics survive the leveller.

### Click-freedom

A simultaneous step of rpm (820 -> 6600), throttle (0.05 -> 1), cabin, master gain (0.4 -> 2) and
reverb preset produces a maximum sample-to-sample delta below **2.5x** the steady-state baseline in
both directions - i.e. no discontinuity. Rendering is bit-identical for a given seed and independent
of the render quantum (32/64/128/256 frames agree to 1e-9).

### Real-time budget (48 kHz stereo, 128-frame quanta, 2.67 ms budget)

Isolated benchmark (`node scripts/benchmark-audio.mjs`, one core):

| scenario | core | speed vs real time |
| --- | --- | --- |
| steady 4000 rpm | 4.00 % | 25x |
| every control moving every block | 5.01 % | 20x |
| tunnel reverb + cabin filtering | 4.15 % | 24x |
| engine + vehicle ambience (full mix) | 4.60 % | 22x |
| physics 120 Hz + audio 48 kHz in one process | 6.62 % | 15x |

Inside `test/audio-performance.test.mjs` the same scenarios are measured while the rest of the suite
runs in parallel processes, so the figures there are higher (12-21 % of a core, median block
0.16-0.29 ms, p95 0.61-1.76 ms against a 2.67 ms budget). The assertions are set at 30-40 % of a core
and 60-75 % of the block period so a busy CI machine stays green while a real regression still fails.

Heap growth over 10 s of continuous rendering: < 4 MiB (no per-sample allocation).

## Phase 2 - vehicle, measured values

| quantity | measured | assertion |
| --- | --- | --- |
| idle speed (in gear, no input) | 820 rpm, band < 20 rpm | within 60 rpm, band < 60 rpm |
| creep at idle | < 0.01 km/h | < 3 km/h |
| 0-100 km/h | 5.08 s | 3.2-7.5 s |
| 0-200 km/h | 15.9 s | < 22 s |
| 100-0 km/h braking | 35.7 m, peak 1.29 g | 26-48 m, peak < 1.6 g |
| peak lateral acceleration | 1.26 g | < 1.12 x tyre mu, > 0.85 g |
| steady-state radius vs kinematic prediction | within 0.02 rad of `L/R + aF - aR` | same |
| balance | front slip > rear slip (understeer) | asserted |
| ABS | releases to 0.43 of pedal, front slip kept > -0.75 | asserted |
| traction control | intervenes on every launch, keeps slip < 1.2 | asserted, and > 1.5x worse with TC off |
| frame-rate independence (30/60/144 Hz) | speed spread < 3 km/h, yaw spread < 0.05 rad/s | same |
| 24 000-step random-input fuzz | 0 non-finite states, 0 clamp recoveries | asserted |
| auto-driver lap | 77.2 s, 109.5 km/h average, 0 s off track | >= 1 lap, < 5 % off track |

Track: 2 347.9 m, 1 174 centreline samples, 11 kerbed corners, tightest radius 29.4 m, minimum gap
between non-adjacent parts of the circuit 28.9 m (no self-intersection), `nearest()` agrees with a
brute-force search to within 2 samples.

## Browser suite (headless Chrome, real CDP session)

| check | measured |
| --- | --- |
| boot + self description | track 2 347.9 m, 11 corners, main order 4, physics 120 Hz |
| scene renders | 140 draw calls, 115 142 triangles, 114 geometries, 29 textures |
| framebuffer is a real image | luminance variance 3 708, 104 distinct colours in a 128x80 sample |
| AudioContext from a gesture | running, 48 kHz, worklet loaded, no error |
| worklet pulling audio | 168 448 frames rendered on the audio thread, 0 non-finite, 0 clipped |
| offline audio self-test | peak 0.196, rms -26.0 dBFS, stereo delta 0.040, 0 clipped, 0 non-finite |
| keyboard throttle | 138 km/h, 5 163 rpm, 3rd gear after 8 s of `W` |
| HUD agreement | speed within 1 km/h, rpm within 25, gear identical, order readout live |
| braking | 140 -> 34 km/h, peak -1.29 g, ABS modulating |
| steering | left: +0.27 rad/s yaw, +0.48 g; right: negative yaw and g |
| auto driver | 1 197 m covered, on asphalt, lap timing armed |
| all four camera views | each renders (variance 197-651) and selects its acoustic space |
| 40 s unattended | all telemetry finite, 0 recoveries, lap 87.7 s, audio still clean |
| sound laboratory | L toggles it; 8 cylinder tiles in firing order, fire lamps pulse at TDC (~30 events / 4.5 s at idle), live FFT legend shows orders 4/8/12/16, auto-driver readouts show ackermann/slip/heading/cross-track terms |
| screenshots | `artifacts/browser-{chase,cockpit,cinematic,lab}.png` |
| console | 0 page errors, 0 real console errors |

## Human (subjective) scoring

Not automated by design:

* exhaust tone and the strength/character of the cross-plane rumble,
* overrun crackle and tip-in bark plausibility,
* reverb sense of space per camera view,
* steering feel, balance on the limit, and how readable the car is at the edge of grip.

`npm run render:wav` writes seven clips plus `artifacts/audio-render-report.json` (peak, RMS, clip
count, rpm range per clip) so the listener can score tone while still having objective context.
