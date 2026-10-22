# Voxel Marina Bay — Singapore Digital Twin

A procedurally voxelised, explorable scale model of **Singapore's Marina Bay and the
Downtown Core (Raffles Place / CBD)**, delivered as a **single self-contained HTML file**.

> Open `voxel-marina-bay.html` in any modern browser (double-click works — no server,
> no build step). The only network dependency is the Three.js engine, loaded from a CDN.

![Marina Bay](_src/shots/F1-birdseye.png)

<sub>Bird's-eye over Marina Bay — the Downtown Core cluster, the bay, Marina Bay Sands,
the Supertree Grove and the Suntec towers. Click the file to open it.</sub>

---

## Modes at a glance

| Bird's-eye | First-person | Night |
|---|---|---|
| ![](_src/shots/F1-birdseye.png) | ![](_src/shots/F2-firstperson.png) | ![](_src/shots/F3-night.png) |

---

## What's in the model

The city is **not** a hand-placed approximation — the geometry is derived from real
**OpenStreetMap** data for the Downtown Core, rasterised onto a 2 m voxel grid and
rebuilt procedurally at runtime.

| Element | Source / method |
|---|---|
| Shoreline, bay basin, Singapore River mouth | OSM `natural=water` multipolygons ("Marina Reservoir", "Singapore River") |
| Building footprints (1 600+ buildings) | OSM `building=*` ways and relations, with real published heights |
| Road network (7 300+ ways) | OSM `highway=*`, classified by surface and width |
| Greenery, parks, promenades, plazas | OSM `leisure`, `landuse`, `highway=pedestrian` |
| Marina Bay Sands (3 towers + SkyPark cantilever) | OSM footprints + bespoke procedural SkyPark deck |
| ArtScience Museum (lotus), Esplanade (durian domes), Merlion, Helix Bridge, Gardens by the Bay Supertrees, Fountain of Wealth | Procedural voxel sculpts, placed on surveyed OSM positions |
| Traffic (190 vehicles), boats, pedestrians | Runtime simulation on the real road / water / promenade network |

Heights for the landmark towers are the **real published heights** — Guoco Tower 290 m,
UOB Plaza / One Raffles Place / Republic Plaza 280 m, OUE Bayfront 280 m, CapitaSpring 201 m,
CapitaGreen 197 m, Ocean Financial Centre 243 m, the MBS towers 200 m, Millenia Tower 280 m.

---

## Controls

### Bird's-eye mode (default)

| Input | Action |
|---|---|
| **Drag** | Orbit the bay |
| **Wheel** | Zoom in / out |
| **Right-drag** / Shift-drag | Pan across the city |
| **1 – 9** | Fly to a landmark (Marina Bay Sands · ArtScience · Merlion · Esplanade · UOB · Republic Plaza · Guoco · The Sail · MBFC) |
| **F** | Frame the whole skyline |
| **Tab** | Switch to first-person |
| **H** | Show / hide the help panel |
| **M** | Show / hide the minimap |
| **T** | Toggle the automatic day/night cycle |

### First-person mode

| Input | Action |
|---|---|
| **Click** on the canvas | Capture the mouse and look around |
| **W A S D** | Walk / strafe |
| **Shift** | Run |
| **E** | Toggle fly mode (then **Space** / **Ctrl** to go up / down) |
| **Esc** | Release the mouse |
| **Tab** | Back to bird's-eye |

### On-screen controls

* **Time** slider — scrub the day/night cycle (dawn → noon → sunset → night), or press
  **▶ AUTO** to let it run.
* **TRAFFIC / PEDESTRIANS / REFLECTIONS / SHADOWS / LABELS** — toggle each system.
* **? HELP** — the full control reference.

---

## Rendering & atmosphere

* **Voxel construction** — every surface is built from instanced boxes on a 2 m grid.
  Building walls are merged into contiguous runs per storey band (fast), while roofs,
  trees, street furniture, quay walls and all landmark sculpture stay per-voxel.
* **Cine lighting** — a single directional sun with a 2048² shadow map that follows the
  view, a hemisphere light for sky/bounce fill, and a soft ambient floor. The sun path
  follows Singapore's actual latitude (1.3° N), so the sun passes close to the zenith.
* **Day/night cycle** — 24 h scrubbable, with dawn, noon, golden-hour, sunset and night
  palettes, atmospheric haze, drifting clouds and a star field.
* **Materials** — reflective glass curtain walls with per-window shading, concrete,
  granite and heritage masonry, asphalt, timber promenades, equatorial foliage and
  bay water. All are procedurally shaded, no textures are downloaded.
* **Water** — a custom shader with three scrolling wave layers, Fresnel mix between deep
  water and sky, sun glitter, and a **true planar reflection** (the scene is re-rendered
  from a mirrored camera into a render target and sampled with projected coordinates).
* **Night** — office windows light up stochistically, street lamps and the Helix Bridge
  glow, vehicle headlights switch on, and the skyline reads against the stars.

---

## Performance

The renderer is built for a mid-range GPU: the whole city is **~440 000 instanced voxels**
in **8 draw calls**. The shadow map and the planar reflection are refreshed a few times a
second rather than every frame, the render pixel ratio is capped at 1.5 and adapts
automatically, and the scene builds in **under a second** in the browser.

---

## Files

| Path | Purpose |
|---|---|
| `voxel-marina-bay.html` | **The deliverable** — one self-contained file with the city data inlined. |
| `README.md` | This document. |
| `_src/app-template.html` | The application source (HTML + CSS + all shaders and systems). |
| `_src/city-data.json` | The extracted city dataset: water, buildings, roads, greens, plazas, labels. |
| `_src/build-data.mjs` | Extracts the city dataset from the raw OSM XML tiles. |
| `_src/assemble.mjs` | Inlines the dataset into the template to produce the single file. |
| `_src/qa.mjs` | Headless-Chrome screenshot / diagnostics harness used for visual QA. |
| `_src/osm/*.osm` | Raw OpenStreetMap extracts (the model's source data). |
| `_src/shots/` | Showcase renders (bird's-eye, night, first-person, street level). |
| `_src/_qa-history/`, `_src/_scratch/` | Intermediate QA renders and exploratory scripts. |

Rebuild the single file with:

```bash
node _src/build-data.mjs     # refresh _src/city-data.json from the OSM tiles
node _src/assemble.mjs       # produce voxel-marina-bay.html
```

Capture screenshots with:

```bash
node _src/qa.mjs '[{"wait":2000,"shot":"my-shot"}]'
```

---

## Performance

The whole city is **~440 000 instanced voxels** in **8 draw calls** (~5.6 M triangles).
To keep it smooth:

* the 1536² shadow map is re-rendered every 3rd–5th frame rather than every frame;
* the planar reflection is rendered at 38 % resolution every 2nd–5th frame;
* the render pixel ratio is capped at 1.5 and adapts automatically (down to 0.6) if the
  frame rate drops, and the shadow/reflection refresh rates relax further under load.

The scene builds in **under a second** in the browser, so the loader is barely visible.

---

## Data credit

Geometry is derived from **© OpenStreetMap contributors**, licensed under the
**Open Data Commons Open Database License (ODbL 1.0)**. Building heights for the
landmark towers are published figures. No 3D models, textures or videos are used —
every voxel in the scene is generated procedurally in the browser.
