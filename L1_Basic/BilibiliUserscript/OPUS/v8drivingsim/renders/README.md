# Pre-rendered audio

Rendered offline with `node tools/render-wav.js` — the same DSP the browser
runs, evaluated under node. Nothing here is a sample library; these are the
model's output.

| file | what it is |
|---|---|
| `crossplane-v8-sweep.wav` | idle, a blip, a full pull to the limiter, then a trailing-throttle overrun |
| `flatplane-v8-sweep.wav` | the identical sweep with a flat-plane crank — only the firing order differs |
| `crossplane-v8-launch-cabin.wav` | standing start with four upshifts, interior perspective, cabin room |
| `crossplane-v8-coldstart.wav` | starter cranking, catch, settle to idle |

Listen to the two sweeps back to back on headphones. Same displacement, same
pipes, same everything except which cylinder fires when — the cross-plane
version burbles and the flat-plane version howls. That difference is 20 dB of
odd half-order energy, and it comes out of a permutation of eight integers.

Regenerate or explore other operating points:

    node tools/render-wav.js --script sweep|launch|steady|start \
                             --engine crossplane-v8-64|flatplane-v8-64 \
                             --preset open|cabin|pitlane|garage|tunnel|canyon \
                             --rpm 3000 --dur 9
