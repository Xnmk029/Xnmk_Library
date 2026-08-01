# CCF Vehicle Lab — Proving Ground Validation Matrix

Deliverable 5 of the WebGL vehicle-physics benchmark: results of the automated
full-course validation sweep (`T` key in-app, or headless via Playwright),
plus the physics-conversion audit trail and a raw telemetry excerpt.

Everything below is **measured output** from the actual application
(`claude-fable browser run — Chromium headless SwiftShader + Node 240 Hz replica; both
produce identical results because the solver is fixed-step deterministic).

---

## 1. Validation matrix — 14 / 14 PASS

Automated driver: 240 Hz in-sim controller (launch → Belgian pave → asymmetric
bumps → slalom → high-bank carousel → wading pool). One logged recovery
teleport is permitted after the carousel exit landing (see §4 note).

| # | Test | Metric | Measured | Criteria | Result |
|---|------|--------|----------|----------|--------|
| 0 | LAUNCH | 0–60 km/h sprint | **3.99 s** | < 6 s | **PASS** |
| 1 | BELGIAN PAVE | suspension velocity RMS | **0.993 m/s** | 0.05–1.2 m/s | **PASS** |
| 2 | BELGIAN PAVE | max suspension travel | **50 mm** | > 8 mm | **PASS** |
| 3 | ASYM BUMPS | L/R alternation events | **8** | ≥ 4 | **PASS** |
| 4 | ASYM BUMPS | peak travel L/R | **59 / 60 mm** | both > 30 mm | **PASS** |
| 5 | SLALOM | peak lateral acceleration | **0.90 g** | ≥ 0.55 g | **PASS** |
| 6 | SLALOM | yaw-rate reversals | **8** | ≥ 6 | **PASS** |
| 7 | SLALOM | cones struck | **0** | ≤ 2 | **PASS** |
| 8 | HIGH BANK | time on 28° banking | **17.3 s** | ≥ 3 s | **PASS** |
| 9 | HIGH BANK | max body roll vs gravity | **30.0°** | ≥ 14° | **PASS** |
| 10 | WADING | max water depth | **46 cm** | ≥ 20 cm | **PASS** |
| 11 | WADING | hydro drag deceleration | **28 → 7 km/h** (coast) | drop ≥ 15 % | **PASS** |
| 12 | WADING | splash events | **1** | ≥ 1 | **PASS** |
| 13 | POWERTRAIN | max engine speed | **7522 rpm** | ≤ maxRPM + 80 | **PASS** |

Machine-readable copy: [`validation_run.json`](validation_run.json)
(captured from the browser run; `window.__VALIDATION` + `VALIDATION_JSON`
console line).

Reproduce headlessly:

```bash
node scripts/serve.mjs 8091 &
# Node replica (no GPU needed, ~3 s):
node tests/test_validation.mjs
# Full browser (SwiftShader), turbo autopilot:
#   open http://localhost:8091/?autostart&turbo=1  and press T
```

---

## 2. Physics conversion report (Task 1.2 audit)

Every quantity the solver uses is derived from the parsed jbeam data with its
source logged (in-app: diagnostics panel `` ` ``):

| Quantity | Value | Source |
|----------|-------|--------|
| Rigid chassis mass | 1434.8 kg over 655 nodes (incl. 33.5 kg fuel) | Σ nodeWeight + mainTank |
| Centre of mass | [−0.005, 0.467, 0.131] m | Σ m·p / M |
| Inertia diagonal | [1698, 1959, 444] kg·m² (pitch/yaw/roll) | point-mass tensor |
| Beam network | 4140 beams, mean k = 1.37 MN/m | beams table (X-ray overlay: `N`) |
| Suspension F | k = 30 000 N/m, c = 2925/7600 N·s/m | coilover beamSpring/beamDamp |
| Suspension R | k = 24 000 N/m, c = 2925/7300 N·s/m | coilover beamSpring/beamDamp |
| Anti-roll bars | F 46 102 / R 15 375 N/m eff | swaybar torsionbars ÷ lever² |
| Wheelbase / tracks | 2.319 / 1.420 / 1.420 m | wheel node geometry |
| Tires | r 0.305 m, w 0.205 m, 30/28 psi, **µ = 1.2** (raw 1.0 clamped per spec, rough) | pressureWheels + tire parts |
| Kingpin axis (FR) | base fh1r, axis ≈ 14° inclination | steerAxisUp/Down nodes |
| Engine | inline-4, 172 kW (231 hp) @ 7000, 272 Nm @ 5500, idle 950, max 10 200, limiter 7500 | ccf_engine_f4 torque table |
| Gearbox | 6M [4.01 2.72 2.10 1.70 1.30 0.97], R −3.21, final 3.58 | gearbox + differential configs |
| Drivetrain | RWD + LSD | powertrain device graph |
| Brakes | F 1900 / R 800 N·m, park 1250 | wheeldata rows |

Coordinate mapping (constraint #3): `three = (jb.x, jb.z, −jb.y)` —
determinant +1, identical to ColladaLoader's Z_UP handling, so flexbody
meshes and physics nodes align with **zero offset** (verify with the
node-beam X-ray overlay, `N`).

---

## 3. Telemetry excerpt — Belgian pave @ ~37 km/h

60 Hz stream (in-app: telemetry strip + ring-buffer graph). Wheel loads spike
to ~8 kN on stone caps with brief unloading at crests; tire carcass squash
(soft-tire layer) tracks Fz 1:1 and drives the deformation shader.

```
t_s  | z_m  | v_kmh | sFL   sFR   sRL   sRR  (mm) | vFL m/s | FzFL N | squash mm
0.20 | 32.1 | 35.5  |  9.5  25.3 −26.0 −21.8      | −0.49   |     0  |  0.0
0.30 | 33.0 | 34.6  | 39.1  41.3 −16.3 −11.8      |  0.89   |  7610  | 28.7
0.50 | 35.0 | 35.3  | 36.1  40.8   1.3   5.6      |  0.71   |  6906  | 26.1
0.60 | 36.0 | 35.6  | 15.9  20.1  18.2  31.8      |  1.34   |  8138  | 30.7
0.80 | 38.0 | 36.2  |  2.2  15.6  12.8  23.2      |  0.60   |  5274  | 19.9
0.90 | 39.0 | 36.5  | −6.4   2.9  26.1  28.7      |  1.25   |  7151  | 27.0
1.30 | 43.1 | 37.7  |  9.5  11.8   3.3  11.0      |  0.35   |  5046  | 19.0
1.50 | 45.2 | 38.2  | 13.7  14.3  13.9  16.1      |  0.98   |  7207  | 27.2
```

Powertrain launch trace (WOT, staging pad): clutch bites ~1 s, brief
wheelspin (slip 5.3), launch squat +400 N/rear wheel, shifts at 7000 rpm with
forward load transfer, **0–100 km/h ≈ 7.0 s** — right for 231 hp / 1435 kg.

---

## 4. Diagnostics excerpt (browser boot, headless Chromium)

```
[lab:info] assembled "ccf": 143 parts, 655 nodes, 4150 beams, 4 wheel defs in 46.7 ms
[lab:info] DDS support: bc7:y bc6h:y bc4:y bc5:y dxt:y
[lab:info] materials: indexed 415 definitions from 11 files
[lab:info] dae ccfremodel.dae: 504 nodes in 2766 ms
[lab:info] flexbody bind: 201 meshes (12 spin, 8 carrier, 181 chassis), 19 missing (vanilla refs)
[lab:warn] missing meshes: brake_disc_solid, … (base-game references — expected for a mod)
[lab:info] proving ground: 5 patches, 372k tris in 216 ms
[lab:info] city: {"roads":701,"arterials":28,"collectors":398,"locals":275,
                  "buildings":4421,"parks":65,"lights":5514,"signals":300,"pois":114}
[lab:ok]   VALIDATION COMPLETE — 14/14 PASS
==== 0 error lines ====
```

Note on the carousel: the car circulates the 28° band at its equilibrium
speed (v_eq = √(g·tan 28°·r) ≈ 18 m/s at r = 62.5). The scripted exit dives
through the gate feather; on a hard landing the run may use one **logged
recovery teleport** to the wading approach — it never affects the zone
metrics, which are phase-gated.

---

## 5. Screenshots (headless SwiftShader captures)

| | |
|---|---|
| ![proving ground](media/proving_ground.png) Proving ground — NPR toon + ink outlines, FR-Legends HUD | ![x-ray](media/nodebeam_xray.png) Node-beam X-ray — 4150 jbeam beams aligned 1:1 on the mesh |
| ![vector map](media/vector_map.png) Vector-tile city map — quadtree streaming, POI labels, ortho blend | ![city drive](media/city_drive.png) City drive — extruded blocks, streetlights, px-constant markings |
