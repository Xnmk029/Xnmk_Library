# POOL / NULL — WebGPU Poolrooms Architecture

## 1. Frame architecture

The runtime is intentionally split into five independent systems:

1. `PoolroomsApp` owns renderer initialization, frame pacing, resize handling, and the render graph.
2. `ProceduralWorld` maintains a 5 × 5 chunk ring around the player and rebuilds shared `InstancedMesh` buffers only after a chunk-boundary crossing.
3. `materials` creates the physically based tile channels and the TSL water/caustic graph.
4. `FirstPersonController` owns pointer lock, a fixed 1.7 m eye height, collision, slow walking, and low-amplitude head bob.
5. `FootstepAudio` synthesizes wet impacts and a long stereo convolution tail. There is no music layer.

The render budget is governed by a small, stable number of instanced draws rather than by the number of visible architectural modules. At any time only 25 chunks exist, while fog hides the streaming boundary.

## 2. Enclosed lighting

There is no environment map, skybox, sun, or directional key light. Cold emissive ceiling panels supply the visible luminaires; eight pooled rectangular area lights follow the active chunk ring. A very low cyan ambient term approximates the far-field part of multi-bounce indoor light. GTAO restores contact depth that the ambient term would otherwise flatten.

For a production art pass, replace the ambient approximation with one of these:

- Bake a sparse irradiance volume per architecture module and trilinearly blend the nearest probes.
- Add a half-resolution SSGI node before bloom and temporally accumulate it.
- Bake directional lightmaps for static modules and reserve screen-space GI for newly streamed transitions.

## 3. WebGPU render graph

The primary renderer is Three.js `WebGPURenderer`. It selects WebGPU when available and automatically falls back to the renderer's WebGL 2 backend.

The scene pass writes MRT attachments:

```text
output      HDR scene color
normal      view-space normal
roughness   material roughness
metalness   material metalness
depth       hardware depth
```

The post graph is:

```text
Scene MRT
 ├─ GTAO at 0.5× ───────────┐
 ├─ SSR at 0.5× ────────────┤
 └─ HDR color ──────────────┴─ enclosed composite
                                  ↓
                            wide soft bloom
                                  ↓
                         chromatic aberration
                                  ↓
                         animated film grain
                                  ↓
                         AgX tone mapping
```

SSR is deliberately half-resolution, has a short 13 m ray distance, and is softened by roughness. This is sufficient because exponential fog removes distant reflection detail. For production water-only SSR, add a water mask MRT and composite reflections through that mask instead of reflecting every dielectric surface.

## 4. Water shader logic

The water material is a `MeshPhysicalNodeMaterial` with IOR 1.333, low roughness, partial transmission, and no depth write.

Three low-frequency wave fields perturb the local normal:

```glsl
float a = sin(x * 1.42 + time * 0.17) * 0.018;
float b = sin(y * 1.76 - time * 0.12) * 0.015;
float c = sin((x + y) * 0.63 + time * 0.08) * 0.012;
N = normalize(Nlocal + vec3(a, b + c, 0.0));
```

This keeps the surface nearly still while giving SSR enough normal variation to produce slow, distorted reflections. The current framework uses a deterministic basin-depth field for shallow-to-deep absorption. A full production implementation should sample the opaque scene depth, reconstruct world thickness, and use Beer–Lambert absorption:

```glsl
float thickness = max(0.0, opaqueViewDepth - waterViewDepth);
vec3 transmittance = exp(-absorptionRGB * thickness);
vec3 refracted = sampleSceneColor(refractedUV) * transmittance;
```

Caustics are a cheap analytic interference field evaluated in world space. Raising the absolute sum of two moving sine fields to a high power produces narrow, slowly drifting light bands. It is injected into the tile material's emissive channel, so it appears on both pool floors and tiled walls without decal draws.

## 5. Procedural generation

Chunks use coordinate hashing, not mutable random state. Shared edge hashes guarantee that the east opening of one chunk equals the west opening of its neighbor. This makes regeneration deterministic and removes save-state requirements.

Each chunk chooses:

- shallow or deep basin elevation;
- one to four orthogonal columns;
- a cold ceiling panel position;
- optional symmetric stairs and metal rails;
- four shared-edge wall states.

To replace the grid generator with Wave Function Collapse, keep the same `rebuild()` output contract. WFC should resolve only a small frontier outside the active ring, cache the selected module IDs by integer coordinate, and then write the same instance matrices.

## 6. Performance guardrails

- 25 live chunks; no unbounded scene graph growth.
- Eight major instanced draws for floors, ceilings, walls, water, columns, luminaires, stairs, and rails.
- Lighting is pooled and capped at eight area lights.
- GTAO and SSR run at half resolution.
- Pixel ratio is capped at 1.5 and reduced under sustained slow frames.
- Fog density and camera far plane agree, avoiding shading invisible geometry.
- No real-time shadow maps: soft architectural occlusion comes from GTAO, roughness, and enclosed fill light.

The next quality tiers should be device profiles rather than individual effect toggles: `high` (SSR + GTAO + bloom), `balanced` (SSR and GTAO at quarter resolution), and `low` (probe light + bloom only).
