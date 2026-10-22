# Design notes

How the simulator works, why each choice was made, and exactly where the line sits between
principles taken from `ange-yaghi/engine-sim` and original work.

---

## 1. Attribution / boundary with engine-sim

`engine-sim` is a C++ desktop application. Its published principle is that engine sound is not a
sample bank or a bank of oscillators: it is the *acoustic consequence of combustion events whose
timing comes from the crank*. Concretely, the ideas taken from it are:

| Ported principle | How it appears here |
| --- | --- |
| Sound is generated from a crank-angle-driven firing schedule, not from samples | `src/audio/firing.js` builds the schedule; `EngineSynth` advances the crank angle every sample and fires events sub-sample accurately |
| The acoustic excitation is the exhaust gas leaving the cylinder when the exhaust valve opens (blow-down), one event per cylinder per cycle | `buildBlowdownPulse()` + the per-cylinder voice pool in `engine-synth.js` |
| The engine's audio identity comes from its *configuration* (cylinder count, V angle, crank type, firing order, runner lengths), so a different engine is data, not code | `src/audio/engine-config.js` (`CROSSPLANE_V8`, `FLATPLANE_V8`) |
| The pulse train is shaped by the acoustic response of the exhaust system before it is heard | Digital waveguides for runner / collector / tailpipe plus muffler combs, instead of engine-sim's impulse-response convolution |
| A leveling stage keeps the output usable across the whole rpm range | `EngineSynth`'s slow leveller (attenuation only, so load dynamics survive) |
| Simulation runs on its own clock and is resampled/streamed to the audio device | The whole DSP runs inside an `AudioWorklet` at the device rate |

Everything below is **original work for this project**:

* **Cheap pipe acoustics.** engine-sim convolves with impulse responses of the gas network. Here the
  same resonances are *generated* by bi-directional delay lines with physical reflection
  coefficients. Cost drops from an FFT convolution per cylinder to a handful of adds per sample.
* **One filter per bank, not per cylinder.** The brief specifies equal-length headers, so all four
  primaries of a bank share a transfer function `H`. Filtering is linear, so
  `H(p1)+H(p2)+H(p3)+H(p4) = H(p1+p2+p3+p4)`: summing first and filtering once is mathematically
  identical and four times cheaper.
* **The rumble mechanism** (see section 3) - time-varying valve termination plus acoustically
  separate banks.
* **Space engine**: early reflections + a modulated 4x4 Hadamard feedback delay network with four
  named environments, switched by the camera. engine-sim ships no reverberator.
* **Vehicle ambience**: road, wind, tyre scrub/squeal, kerb rumble, brake squeal.
* **Everything in phase 2**: tyre model, powertrain/clutch, single-track vehicle dynamics, driver
  aids, auto driver, track geometry and surfaces, lap timing, the Three.js scene, the HUD, the
  browser application and both test suites.
* **The engine-order analysis tooling** (`src/audio/analysis`) that turns "does it sound right" into
  numbers a CI job can check.

No engine-sim source code was copied or transliterated; no assets were reused.

---

## 2. Crank geometry: why the firing order is not arbitrary

For a 90 degree V8 each crank throw carries one cylinder from each bank, and the two cylinders on a
throw fire 90 crank degrees apart. With `pin(left) = firing mod 360` and
`pin(right) = (firing + 90) mod 360`, the shipped order **1-8-4-3-6-5-7-2** with banks
L = {1,3,5,7} / R = {2,4,6,8} gives:

| throw | cylinders | pin angle |
| --- | --- | --- |
| 1 | 1 (L @ 0 deg), 2 (R @ 630 deg) | 0 deg |
| 2 | 3 (L @ 270 deg), 4 (R @ 180 deg) | 270 deg |
| 3 | 5 (L @ 450 deg), 6 (R @ 360 deg) | 90 deg |
| 4 | 7 (L @ 540 deg), 8 (R @ 90 deg) | 180 deg |

Four distinct pin angles 90 degrees apart - a genuine **cross-plane** crank - and the pairs
(1,2), (3,4), (5,6), (7,8) are exactly the pairs that share a throw on a real American V8. The
flat-plane reference preset (order 1-4-3-2-5-8-7-6) resolves to pins {0, 180, 0, 180}: a real
180 degree crank. `test/audio-firing.test.mjs` asserts both, so a typo in a firing order cannot
silently produce an impossible engine.

Consequences used by the synthesiser:

* whole engine: 8 events per 720 degrees, evenly spaced -> firing frequency = 4th order,
* cross-plane bank: intervals 90/180/270/180 -> the bank is periodic over 720 degrees, and its
  Fourier content sits at **half-integer orders** (1.5 and 2.5 are the strongest) plus multiples of 4,
* flat-plane bank: intervals 180/180/180/180 -> periodic over 360 degrees, only even orders.

---

## 3. Why this model actually rumbles

A trap worth documenting: the sum of both banks of a cross-plane V8 is an *even* 90 degree pulse
train. Passing it through one shared, linear, time-invariant exhaust model produces energy only at
multiples of order 4 - the half orders cancel exactly, and the engine sounds flat-plane. Two
mechanisms fix that here, both physical:

1. **True dual exhaust.** Each bank keeps its own collector, tailpipe (lengths differ by 2.8 %),
   muffler and radiation point, with only 17 % X-pipe coupling. Each channel therefore carries one
   bank's uneven train, and the mono sum of two *differently* filtered uneven trains no longer
   cancels. This is also why the rumble is partly a stereo effect - as it is in a real car.
2. **Time-varying valve termination.** The reflection coefficient at the runner's valve end follows
   the bank's aggregate valve-area table (+0.93 closed, +0.16 open). Because a cross-plane bank opens
   its valves at uneven spacing, that modulation has a 720 degree period, which mixes the order-4
   carrier down onto the half orders. A linear time-invariant filter can never do this.

Measured effect (left channel, half-integer order energy, wide open throttle):

| rpm | cross-plane | flat-plane | difference |
| --- | --- | --- | --- |
| 900 | -30.1 dB | -52.1 dB | **+22.0 dB** |
| 3000 | -20.8 dB | -50.2 dB | **+29.4 dB** |
| 5200 | -20.5 dB | -49.5 dB | **+29.0 dB** |

Small per-cylinder trim (+/-4.5 %) and a 1.4 % bank temperature skew add the last bit of life; they
are real effects, not dither.

---

## 4. Signal chain and its cost

Per sample, per channel-pair (48 kHz stereo):

| stage | implementation | approx. cost |
| --- | --- | --- |
| crank + event scheduling | one add, one compare | ~5 flops |
| blow-down voices | table lookups, 1-3 active | ~20 flops |
| valve-area tables | 2 interpolated lookups | ~10 flops |
| runner waveguides (x2) | 2 delay lines + loss filter each | ~40 flops |
| X-pipe + collectors (x2) | mix + 2 waveguides | ~40 flops |
| saturation + tailpipes + mufflers (x2) | asymmetric saturator, waveguide, 2 combs, absorber | ~80 flops |
| radiation + DC + cabin EQ (x2) | 3 biquads per side | ~60 flops |
| intake | pink noise, 3 resonators, bandpass | ~40 flops |
| mechanical | sine table + bandpass | ~15 flops |
| space reverb | 8 early taps + 4 lines + 4 dampers + Hadamard | ~60 flops |
| leveller + limiter | envelope followers + bounded saturator | ~20 flops |

Measured (`node scripts/benchmark-audio.mjs`, one core, Node 24): **4.0 %** steady, **5.0 %** with
every control moving every block, **4.2 %** with the tunnel reverb and cabin filtering, **4.6 %**
including the ambience bus - 20 to 25x faster than real time, which is what "low computational cost"
means in practice. Design rules that keep it there: no allocation after
construction, no transcendental calls in the inner loop (sine and pulse tables instead), control-rate
work batched every 32 samples, and one filter per *bank* rather than per cylinder.

Numerical safety is structural rather than hopeful: every control input is clamped and smoothed,
every recursive stage is either provably lossy or damped, the limiter's output passes through a
monotone saturator with `|y| < 1`, and a final guard converts any non-finite value to silence and
flushes the recursive state. `clampSample(NaN) === 0` deliberately returns silence rather than full
scale - a NaN is a bug report, not a reason to blow a speaker.

---

## 5. Vehicle dynamics

State: `x, y, heading, vx, vy, yawRate, omegaFront, omegaRear` (plus the crank speed inside the
powertrain). Fixed 240 Hz integration, called from a 120 Hz accumulator in the app.

* **Tyres** - normalised magic formula with a single hump, combined slip through one normalised slip
  vector (a real friction circle: asking for cornering force costs longitudinal force), load
  sensitivity referenced to *axle* load, and separate front/rear compounds so the car understeers.
* **Relaxation length** - the tyre needs to roll ~0.5 m before its force develops. This is not a
  detail: without it, the wheel/tyre loop is numerically stiff (the linearised time constant is
  ~0.2 ms) and explicit integration at 240 Hz oscillates instead of gripping. With it, the loop is
  well conditioned and the same code is stable from 30 Hz to 1 kHz frame rates.
* **Load transfer** - static split plus a first-order lag on longitudinal acceleration, plus aero
  downforce. Lateral transfer is deliberately absent: a single-track model has one contact patch per
  axle.
* **Clutch** - a bounded viscous coupling
  (`T = clamp(k*slip, +/-capacity) * engagement`) instead of a hard constraint: stiff enough to feel
  locked, cannot chatter at a fixed step, and gives a launch that slips and then locks for free.
  Engagement ramps with rpm above idle, so the wheels cannot stall the engine.
* **Driver aids** - traction control is a PI controller that *holds* the driven axle near peak slip
  (cutting the throttle outright makes the car bog: it cost 1.2 s over 0-100 km/h in testing); ABS
  releases pressure when a wheel starts to lock. Both can be switched off in the car preset, and the
  tests assert that switching them off makes the wheels spin/lock more.
* **Parking branch** - below 0.35 m/s with the brake on or the throttle closed, friction is applied
  directly and the slip states are cleared, so the car sits perfectly still and the HUD does not
  report a phantom 1 g.
* **Finite-state guard** - every state is range checked each step; the counter it increments is
  asserted to stay at zero in the fuzz tests.

Measured behaviour: 0-100 km/h in **5.1 s**, 0-200 in **15.9 s**, ~253 km/h, 100-0 km/h in
**35.7 m** at a peak of 1.29 g, up to **1.26 g** lateral, idle held at 820 rpm within a 20 rpm band,
and the auto driver laps in **77.2 s** (109.5 km/h average) without leaving the road.

---

## 6. Track and scene

`TrackLayout` is pure maths: a closed Catmull-Rom centreline resampled to a constant 2 m spacing,
with smoothed curvature, per-sample width, kerb strength, a spatial grid for O(1) nearest-point
queries (~1.2 us), surface classification (asphalt / kerb / apron / grass / gravel) and lap timing
that arms on the first line crossing and refuses to bank a lap completed off the road.

The renderer consumes exactly the same samples, so physics and visuals cannot disagree: the road
ribbon, white lines, aprons, kerb strips (only where `kerb > 0.25`), gravel traps, tyre barriers,
grandstand, pit building, gantry, sponsor and braking boards are all generated from them. Textures
are drawn procedurally on canvases at load time - no binary assets.

The car is assembled from primitives (~40 meshes) with a hood scoop, ducktail spoiler, quad tips and
functioning lights; wheels steer and spin from telemetry, and the body pitches and rolls with the
measured accelerations.

## 7. Sound / auto-driver laboratory

`src/scene/engine-lab.js` (toggle with `L`) is a read-only instrument panel, not a second
simulation: it integrates the same crank phase the worklet tracks from the vehicle's rpm and
derives every per-cylinder quantity from the same firing schedule and cam windows the
synthesiser uses. The fire lamps pulse at each cylinder's firing TDC (edge-detected on the
720-degree wrap, held for 450 ms); the spectrum is a 2048-point windowed FFT of the real
`AnalyserNode` output with the order comb overlaid - the same FFT code the CI tests use; and the
auto-driver column reads the controller's new `diagnostics` snapshot, so its steering law is
visible term by term instead of being a black box.

## 8. Loops and coupling

```
requestAnimationFrame
  |- input.update(dt)                       key/pad smoothing
  |- while (accumulator >= 1/120)           fixed-step physics
  |    |- driver or auto driver -> vehicle.update(1/120)
  |    \- lap timer
  |- telemetry -> engineControlsFromTelemetry / ambienceControlsFromTelemetry
  |    \- postMessage to the AudioWorklet (control rate only)
  |- car mesh, camera rig, HUD
  \- renderer.render()
```

The audio thread never waits on the render thread: it receives control values and keeps synthesising
at the device rate. `window.__DRIVE_SIM__.advance(seconds)` runs the same `advance()` used by the
animation loop, which is what lets the browser suite drive the simulation deterministically.

## 9. Known simplifications

* One contact patch per axle: no lateral load transfer, no individual wheel lock-up, no roll degree
  of freedom.
* The road surface is planar; elevation exists only in the scenery.
* The exhaust is a chain of waveguide sections with lumped reflection coefficients rather than a
  scattering-junction network; it reproduces the resonances, not the exact impedance mismatches.
* Combustion is parametric (pressure pulse amplitude from load, rpm and cut state) rather than a
  thermodynamic cycle solved per cylinder - that is the main deliberate departure from engine-sim,
  and the reason this runs at a few percent of one core in a browser tab.
* No wind tunnel: the aero coefficients are plausible values for a 1.7 t coupe, not measured data.
