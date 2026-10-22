# Poolrooms — WebGL 池核模拟器

A browser-native, infinitely generated **Poolrooms / poolcore** simulator built on **Three.js (WebGL2)**
with a hand-rolled deferred-ish render pipeline aimed at a UE5 *Lumen + volumetrics* look: screen-space
global illumination, screen-space reflections, physically-based water, volumetric god rays, TAA and
ACES grading — all procedural, with **zero downloaded assets**.

First person, 1.7 m tall, no HUD, no objectives. Only exploration.

```
node tools/serve.mjs      # http://127.0.0.1:4318/
```

Requires WebGL2 (Chrome / Edge / Firefox / Safari 16+).

## Controls

| input | action |
|---|---|
| move mouse | look (click once to capture the pointer) |
| `W A S D` / arrows | walk, wade, swim |
| `Shift` | run / fast swim |
| `Space` | jump, or swim up |
| `Ctrl` / `C` | swim down |
| `Esc` | release the pointer |

Touch: drag to look, touch the upper half to move forward.

## Rendering pipeline

Each frame, in order (`src/renderer/Pipeline.js`):

| # | pass | resolution | what it does |
|---|---|---|---|
| 1 | G-buffer prepass | full | MRT: view normal + roughness, albedo + metalness, depth. Materials are swapped to GLSL3 `RawShaderMaterial` variants that share the same baked maps. |
| 2 | forward opaque | full | `MeshStandardMaterial` PBR: IBL from the baked HDRI, sun with PCF-soft shadows, injected wetness + animated underwater caustics. |
| 3 | copy | full | opaque colour, used as the refraction source for water. |
| 4 | water | full | drawn into the same HDR buffer so it depth-tests against the opaque pass. |
| 5 | copy | full | scene colour *including* water — the source for screen-space lighting. |
| 6 | SSGI + SSR | half | cosine-weighted hemisphere rays marched against the depth buffer → indirect diffuse + AO; one roughness-jittered mirror ray → reflections. Misses fall back to the sky probe. |
| 7 | volumetric fog | half | ray-march with shadow-map lookups (god rays through the skylights), Henyey-Greenstein phase, drifting 3D noise, denser underwater. |
| 8 | resolve | full | depth-aware upsample of 6 & 7, AO + GI + reflection composite, Beer-Lambert underwater absorption, fog composite. |
| 9 | TAA | full | Halton-jittered projection, depth reprojection through the previous view-projection, YCoCg neighbourhood clamp. Doubles as the denoiser for 6 & 7. |
| 10 | bloom | mip chain | thresholded 13-tap downsample + tent upsample. |
| 11 | final | full | chromatic aberration, ACES filmic tonemap, grade, underwater warp + tint, vignette, grain, dither, sRGB. |

The world is static, so TAA reprojection by depth is exact — that is what makes the noisy
screen-space passes usable at half resolution.

## Water

`src/water/Water.js` — one shader doing:

* 4 Gerstner waves for vertex displacement, damped towards the pool rim
* three octaves of **analytic-gradient** gradient noise for ripple normals (one eval per octave)
* refraction of the opaque buffer, rejected when the sample lies in front of the surface
* **Beer-Lambert absorption** over the real water-column depth → shallow reads clear, deep reads teal
* screen-space reflection march with bisection refinement, Fresnel-gated and distance-adaptive,
  falling back to the HDRI
* GGX sun specular, shoreline foam from geometry proximity, and a below-surface branch with a
  Snell window and total internal reflection
* caustics are projected by the *receiving* surfaces (`src/materials/Materials.js`), attenuated by
  depth, so they land on pool floors and walls, not on the water plane

## World generation

`src/world/WorldGen.js` — deterministic, pure-JS, chunked (32 m), infinite in all directions.
Eight archetypes: `grandPool`, `shallowHall`, `corridorMaze`, `lapPools`, `stairTerraces`, `atrium`,
`changingRooms`, `divingWell`. Doorway positions are hashed from the *shared edge key*, so
neighbouring chunks agree without ever talking to each other.

`tools/worldgen-test.mjs` asserts determinism, bounds, budgets, border agreement and — most
importantly — **walkability**: a flood fill proves every chunk spawn is mutually reachable and no
platform is a trap.

`src/world/GeometryBuilder.js` merges each chunk into ~5 draw calls, projects world-planar UVs so
grout lines run continuously across separate boxes, expands props (railings, ladders, benches,
drains, lamps) into boxes, and bakes a per-face `aSurf` attribute = (causticMask, waterSurfaceY,
wetness, tintJitter).

## Materials

`src/materials/TextureFactory.js` bakes every texture on the GPU at boot from periodic (tileable)
noise: albedo (sRGB), tangent-space normal, and a glTF-style packed **ORM** map (AO / roughness /
metalness) for `poolTile`, `poolTileDeep`, `deckTile`, `wallTile`, `concrete`, `plaster`, `coping`,
`metal`. No image files exist in this project.

`src/lighting/Sky.js` bakes the HDRI once with a real single-scattering atmosphere integral
(16 view × 8 light samples), cumulus clouds and a Lambertian ground bounce, in the **same linear
units as the scene lights**, then feeds `PMREMGenerator` for IBL and reads a 32×16 float copy back to
build the hemisphere ambient probe used by SSGI and the fog.

## Performance

Measured with a GPU-synchronised timer (`--plan perf`) at **1920×1080**, headless Chromium/ANGLE on
an RTX 4070 Laptop — real browsers are typically faster than this path:

| tier | internal resolution | render time | fps |
|---|---|---|---|
| low | 1344×756 (0.70×) | 2.6 ms | 389 |
| medium | 1632×918 (0.85×) | 4.8 ms | 207 |
| **high (default)** | 1920×1080 | **8.9 ms** | **112** |
| ultra | 1920×1080 | ~11.5 ms | 87 |

At **2560×1440** the `high` tier lands at **16.7 ms (60 fps)**; on slower GPUs the adaptive
controller steps down on its own (verified: it drops to `medium` / 2176×1224 when 1440p `high` cannot
hold up).

Adaptive quality switches render scale, shadow resolution, ray/step counts and effect resolutions.
It judges on the real frame delta (which is what rises when a vsync'd browser cannot keep up), with
GPU-synchronised render time as a secondary signal for benchmark situations where vsync is disabled.
It ignores the first 2.5 s (shader compiles, texture bakes, the initial chunk build), remembers which
tier proved too heavy so it never oscillates, and starts from a GPU-name heuristic.

Two optimisations mattered far more than the rest, and both were found by measurement rather than
intuition:

1. **Light pooling.** The generator scatters a few fill lights per chunk; with 25+ chunks resident
   that was ~100 `PointLight`s, every one of them evaluated per fragment by the forward pass. A
   fixed pool of 6 lights re-bound to the nearest ones (`src/lighting/LightPool.js`) took the
   forward pass from 18.6 ms to 2.4 ms — 47 fps → 113 fps.
2. **Water shader cost.** Analytic-gradient noise (one evaluation per octave instead of three
   finite-difference taps), a Fresnel/distance gate on the SSR march, and bisection refinement
   instead of brute-force steps.
3. **Denoising for free.** A dedicated à-trous pass over the half-res GI/reflection buffers cost
   5 ms. Widening the resolve pass's existing bilateral upsample taps (and adding a normal-similarity
   weight) denoises *better* at no extra cost: the frame-to-frame noise floor fell from 4.25 to 2.41
   (mean abs difference between two identical frozen captures, 0-255 scale) while the frame got
   *faster*.

## Screenshots

`gallery/` holds ten captured views (spawn, skylight, wet deck, pool rim, grazing water,
underwater, Snell window, shallow-hall caustics, misted columns, and a random spot after running for
five seconds). Regenerate with:

```
node tools/calibrate.mjs --plan gallery --w 1600 --h 900
```

## Tooling (development only)

| tool | purpose |
|---|---|
| `tools/serve.mjs` | static server |
| `tools/shot.mjs` | headless Chromium screenshot + console/error capture |
| `tools/analyze.mjs` | PNG decode → luminance/clipping/saturation/edge statistics and A/B diff |
| `tools/calibrate.mjs` | `--plan poses \| tour \| exposure \| sweep \| features \| perf` — drives the sim through poses and settings, screenshots each, and reports numbers |
| `tools/worldgen-test.mjs` | world generator assertions + ASCII maps |
| `tools/tex-test.html` | texture bake preview page |

The debug surface `window.__poolrooms` exposes `stats()`, `probe()`, `sunProbe()`, `hdrProbe()`,
`flags()`, `tune()`, `teleport()`, `look()`, `setTier()` — used by the tools above. There is no
in-page UI.
