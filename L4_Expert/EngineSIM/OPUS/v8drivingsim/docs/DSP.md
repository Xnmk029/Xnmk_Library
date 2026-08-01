# Engine acoustics: the model, and why it is shaped this way

This documents the reasoning behind `src/audio/engine-worklet.js`. The headline
constraint was *lightweight* — the synthesis has to leave the CPU budget free
for physics and rendering — so almost every decision here is about which parts
of an engine's sound carry its identity and which parts can be replaced by a
closed-form equivalent.

The reference point is [ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim),
which solves compressible gas dynamics per cylinder and convolves the result
with a measured impulse response. That is the right way to do it if simulation
fidelity is the product. It is the wrong way to do it if the engine is one of
six things competing for a 16 ms frame.

---

## 1. The firing table is the instrument

A four-stroke fires each cylinder once per 720° of crank rotation. With evenly
spaced crankpins, successive firings in the firing order are `720 / n` apart —
90° for a V8. That part is the same for every V8 ever built.

What differs is what each **bank** sees, because the exhaust manifolds are per
bank. Take the 6.4 L Hemi order `1-8-4-3-6-5-7-2` with odd cylinders on the left
bank:

| crank angle | 0 | 90 | 180 | 270 | 360 | 450 | 540 | 630 |
|---|---|---|---|---|---|---|---|---|
| cylinder | 1 | 8 | 4 | 3 | 6 | 5 | 7 | 2 |
| bank | A | B | B | A | B | A | A | B |

Collect one bank at a time:

- **Bank A** fires at 0, 270, 450, 540 → intervals **270, 180, 90, 180**
- **Bank B** fires at 90, 180, 360, 630 → intervals **90, 180, 270, 180**

Each bank's collector is therefore hit by a *lopsided* pulse train. That
asymmetry, and nothing else, is the American V8 burble. A flat-plane crank
reorders the same eight cylinders so each bank fires every 180°, and the burble
is replaced by an even, high-strung howl.

So the model does not contain a "burble" parameter. It contains a firing order
and a bank map, and the burble falls out. Press `V` in either page to swap the
crank and hear the counterfactual: only `firingOrder` changes.

`test/dsp.test.js` asserts this quantitatively — the cross-plane crank must put
substantially more energy on the odd half-orders (1.5, 2.5, 3.5) than the
flat-plane one. Measured with `tools/analyze.js` at 2400 rpm:

```
cross-plane   half-order / whole-order energy = -24.0 dB
flat-plane    half-order / whole-order energy = -44.3 dB
```

A 20 dB difference, from a permutation of eight integers.

---

## 2. Equal-length headers collapse to one filter per bank

Eight primary runners means eight acoustic waveguides. Modelled honestly that
is 8 bidirectional delay lines, plus 8 more for the return reflections.

But the brief specifies **equal-length headers** — every runner is the same
length. Eight *identical* linear time-invariant filters, each fed a different
signal, whose outputs are then summed, is the same thing as summing the signals
first and filtering once:

```
Σ H(x_i)  =  H(Σ x_i)        when every H is the same filter
```

So one delay line per bank does the work of sixteen. This is exact, not an
approximation — and it is exact *only* for equal-length headers, which is
precisely the design we were asked for. (Unequal-length runners would need the
per-cylinder version, and would smear the resonance rather than reinforcing it,
which is the real acoustic argument for equal-length headers in the first place.)

Each runner is modelled as a quarter-wave pipe: closed at the valve, open into
the collector. A feedback comb with round-trip delay `2L/c` and **negative**
feedback resonates at odd multiples of `c/4L`, which is the correct mode
structure for that boundary condition. For `L = 0.82 m` and `c = 540 m/s` (hot
exhaust gas) that puts the primary resonance at **165 Hz**, with further modes
at 494 Hz, 823 Hz… `test/dsp.test.js` verifies the peak lands there and that
the even multiples do *not*.

---

## 3. True dual exhaust, or the burble cancels

This one bit me during development, and the test caught it.

Bank A fires at 0/270/450/540 and bank B at 90/180/360/630. Add those two trains
together and you get eight evenly spaced pulses — **pure 4th order, no burble at
all**. The asymmetry only exists per bank; it vanishes on summation.

The first version of the model ran both banks through identical filters and
summed them at the collector. By the identity in §2 that is algebraically the
same as summing first, so it cancelled the exact thing the model was built to
reproduce. The half-order test failed, which is what a good test is for.

The fix is also the physically correct topology: a **true dual system**. Each
bank keeps its own midpipe, muffler chambers and tailpipe, and the two are
coupled only partially, by an X-pipe (`crossoverMix = 0.34`). The banks stay
acoustically distinct all the way to the tips, and are then mixed to stereo with
crossfeed — so the stereo image is physical rather than a widener. The two sides
also carry a few percent of length mismatch, because real fabrication does.

This is why a V8 with true duals burbles harder than one with a single
collector, and it is why the model needs headphones to show off.

---

## 4. What each cylinder emits

Per cylinder, per sample: one interpolated table read.

The exhaust-port pressure pulse is baked into a 1024-entry table covering the
exhaust-valve-open window (246° of crank). Its shape is a fast blowdown spike —
the cylinder is at several bar when the valve cracks and the flow chokes —
followed by the slower piston-driven scavenge hump and a small step as the valve
seats. The table is DC-corrected so the pipe network is driven by a flow rather
than a pressure offset.

Amplitude comes from cylinder pressure at valve opening, which is a function of
throttle, of load, and of volumetric efficiency (peaking mid-range). Turbulent
flow noise is injected proportional to instantaneous flow, so it rises and falls
with the pulse instead of sitting underneath as a constant hiss.

Two details that matter more than they look:

- **Per-cylinder scatter.** Each cylinder gets a fixed ±3.5% amplitude trim and
  up to 0.9° of firing-angle jitter. Real engines are not eight clones, and
  removing this makes the sound noticeably synthetic.
- **Spark cut is not silence.** A cut cylinder still pumps air (about 12% of a
  fired charge) and dumps raw mixture that lights off downstream. That is why
  a rev limiter sounds like a machine gun rather than a fade-out, and why
  overrun crackles.

---

## 5. Reverb: a feedback delay network, not a convolution

"Reverb-optimized" is a hard requirement in the brief, so this is the part with
the arithmetic written out.

The room is a **4×4 feedback delay network**: four delay lines with mutually
prime lengths, a Hadamard feedback matrix, one-pole damping per line, and two
allpass diffusers on the input.

The Hadamard matrix is orthogonal, so the recirculation is **lossless by
construction** — decay time is set entirely by the loop gain and the damping
filters, with no possibility of accidental blow-up and no tuning loop. It is
also implemented as a butterfly: 8 adds and 4 multiplies, where a general 4×4
matrix would need 16 multiplies and 12 adds.

### Cost, counted

Per output sample:

| stage | flops |
|---|---:|
| 4 fractional delay reads | ~20 |
| 4 one-pole damping filters | 12 |
| Hadamard butterfly + input injection | ~16 |
| 4 delay writes | 4 |
| 2 Schroeder allpasses | 12 |
| DC/low cut | 4 |
| **total** | **~68** |

At 48 kHz that is **3.3 Mflop/s**, and ~226 kB of delay state (allocated for
the largest preset; changing preset only moves read pointers, so switching rooms
is instantaneous and allocation-free).

Compare a convolution reverb with a 1.2 s stereo impulse response — 57,600 taps
per channel:

- **Direct convolution:** 2 × 57,600 MACs per sample ≈ **115,000 flops/sample**,
  1700× the FDN.
- **Uniform-partitioned FFT convolution**, block `B = 256`, `L/B = 225`
  partitions: each partition needs a complex multiply-accumulate across `2B =
  512` bins at 6 flops per bin, so `225 × 512 × 6 ≈ 691,000` flops per 256-sample
  block, plus a forward and inverse FFT. That is **~2900 flops/sample** —
  roughly **40× the FDN** — and it costs ~1.4 MB for the partitioned IR plus at
  least one block of added latency.

The FDN also has **zero latency**, which matters for a driving simulator: the
engine note is a control signal the driver steers by, and a block of reverb
latency is a block of delay between the throttle and the ear.

Six presets (`open`, `cabin`, `pitlane`, `garage`, `tunnel`, `canyon`) are four
numbers each: delay-length scale, loop gain, damping corner, wet mix.

---

## 6. Total budget

Everything runs in one AudioWorklet: 8 crank-angle-driven cylinders, 2
equal-length-header banks, 2 collectors, an X-pipe, 2 independent midpipe →
muffler → tailpipe chains, an intake path with plenum and runner resonances,
valvetrain and bearing noise, per-channel cabin shaping, the FDN, and a limiter.

Measured offline (`npm test`, which renders 20 s of audio at 48 kHz and reports
the ratio):

```
engine DSP: ~3.2% of one core at 48 kHz
```

Browser figures will differ, and the in-app readout says `n/a in browser` when
it genuinely cannot measure: `performance.now()` is absent from Chromium's
`AudioWorkletGlobalScope` (only `Date.now()` is there, whose 1 ms resolution is
useless against a 2.7 ms block budget), and `AudioContext.renderCapacity` is
still flagged off. The code uses `renderCapacity` where it exists and the
worklet's own timing where `performance` exists, and reports null rather than a
confident zero when neither does.

A `quality: 'low'` setting drops the X-pipe and the second muffler chamber for
weaker hardware.

## 7. Aliasing

There is no oversampling. Aliasing is instead controlled at the source: the
pulse tables are smooth, every duct has a lowpass in its feedback loop, and a
one-pole port filter at 5.2 kHz stands in for the physical throttling of high
frequencies through the valve. The engine does get brighter with rpm, which is
correct behaviour, but the high-frequency content is bounded rather than
scaling without limit. `test/dsp.test.js` checks for the sample-to-sample
discontinuities that parameter jumps and aliasing would produce across a fast
rev sweep.
