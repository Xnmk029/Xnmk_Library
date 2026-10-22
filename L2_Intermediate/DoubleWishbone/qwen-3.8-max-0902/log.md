# log.md — Double Wishbone Suspension (L2_Intermediate/DoubleWishbone)

Candidate-model work log. Single independent attempt.

## 1. Task intake
- Workspace: `F:/benchmark/L2_Intermediate/DoubleWishbone/qwen-3.8-max-0902`.
- Inventory of the workspace showed only `PROJECT_PROMPT.md` (no `task.md` present), so `PROJECT_PROMPT.md` was treated as the sole specification (R2 respected: nothing else under `F:/benchmark` was read, searched or listed).
- Spec requirements extracted:
  1. Single self-contained HTML file output.
  2. Simulation basis = rigid lines + deformable lines + nodes.
  3. A double-wishbone suspension display page.
  4. Suspension bounce simulation.
  5. Front-wheel steering tie-rod linkage driving the wheel.
  6. Kingpin motion path.
  7. Represent the real structure as faithfully as possible.
  8. Industrial-software visual style (accurate, professional).
  9. No emoji, no rounded corners, no shadows / non-essential decoration.

## 2. Key decisions
- **Zero-dependency vanilla Canvas 2D.** Chose to hand-write a small 3D engine (perspective + orthographic projection, depth-sorted painter's algorithm, flat directional shading) instead of pulling Three.js from a CDN. Rationale: guaranteed offline rendering, no CDN/network dependency, single truly self-contained file, and full control over the CAD aesthetic. Because the deliverable references no CDN, the R5 runtime-install exception was never needed.
- **Physics-first kinematics.** The motion is *solved* from rigid-link constraints, not scripted, so camber/toe/SAI/caster/scrub emerge from the geometry.

## 3. Kinematics development & validation (in a temp dir)
- Built and verified the solver standalone in Node inside a temporary `parts/` directory before embedding it.
- Model (vehicle frame X=forward, Y=outboard, Z=up, mm):
  - Suspension = 1 DOF. Lower A-arm rotates about its chassis axis by `phi`; the lower ball joint (LBJ) rides its locus circle. The upper ball joint (UBJ) = intersection of the upper A-arm locus circle with a sphere of fixed knuckle length centred on LBJ (**sphere–circle intersection**), branch chosen by continuity (stepped from design each solve).
  - Steering = 1 DOF. Knuckle rotates about the live kingpin axis (UBJ→LBJ); the fixed-length tie-rod from the rack node to the knuckle node gives the steer angle via a bracketed 1-D root find. A closed-form inverse (rack ↔ angle) was also derived and used to cross-check the forward solve.
- **Iterative tuning (evidence of real solving, not guessing):**
  - First geometry gained *positive* camber in compression (wrong). Diagnosed via the front-view instant-centre / ball-joint-arc argument (the upper ball joint must arc inboard faster than the lower). Re-positioned the upper arm so its ball joint sits higher above its pivot axis → correct **negative camber gain**.
  - Fixed the camber definition to use the wheel-up vector `w = f × a` (the naive axle-based formula over-reported camber change during steering by ~3×).
  - Reduced bump-steer from ~10° to ~3.2° by relocating the tie-rod inner (rack) pivot.
- Node self-test results (all PASS): design state reproduces target hard points exactly (camber −1.00°, SAI 6.46°, caster 4.32°, scrub 61.8 mm, spring 337.4 mm); all outputs finite/monotonic across travel; camber +3.3°@−87 mm → −6.6°@+87 mm; forward steer solve matched the analytic inverse to <0.1 mm; 0 solve failures across rack [−58, +52] mm at droop/design/bump extremes.

## 4. Build
Assembled `answer.html` in stages (shell + industrial CSS + verified kinematics → 3D renderer/primitives → scene builder + Front/Top ortho views + overlays → charts → app/UI/animation), embedding the *verified* solver code verbatim.

Scene contents: upper/lower triangular A-arms (rigid tubes), upright knuckle plate, spindle + hub, wheel/tire (3-D tread band, rim, spokes), coilover (helical spring = deformable + telescoping damper), tie-rod + sliding rack, ghosted chassis reference frame, ground grid, ball-joint/pivot nodes, kingpin axis, and motion-path traces (UBJ, LBJ, wheel centre, kingpin-at-ground + axis sweep fan). UI: numbered panels, telemetry grid, 3 live kinematic curves, topology/legend panel, 4 projection modes, 12 layer toggles, bounce + steering-sweep animation, mouse/touch camera, keyboard shortcuts.

## 5. Self-test (headless, offline)
- **Syntax:** extracted the inline `<script>` and compiled it with Node `vm.Script` → SYNTAX OK; token scan confirmed no `three`/`http(s)`/`cdn`/`fetch`/`import`.
- **Render:** used the **pre-installed local** Chromium browsers (Microsoft Edge / Google Chrome) in headless mode, loading the page via `file://` (no network, no server). Captured screenshots for: default/design, +45 mm bump, −78 mm droop, −45 mm rack steer, Dimensions-on, and all four views (3D / Front / Top / Iso).
  - Every run: process exit 0 and **0 page console errors** (the only CONSOLE line seen came from a browser extension, not the page).
  - On-screen telemetry matched the Node solver to 2 decimals in every state (e.g. travel +45 → camber −3.52°, SAI 9.04°, spring 311.2 mm; travel −78 → camber +2.86°, scrub 87.0 mm, spring 380.1 mm). ~60 fps.
- **Bugs found & fixed during render testing:**
  1. Init hard-coded `setView('3d')`, overriding the view state → changed to `setView(S.view)`.
  2. `travel` was derived from the *steered* wheel centre, so steering alone registered as suspension travel (STATE flipped to DROOP) → now uses a steering-independent wheel-centre reference.
  3. The toe chart's live cursor fell outside the bump-steer auto-range when steered → charts now include the current value in their auto-range.
  4. Chassis reference panel was too opaque and could obscure the mechanism → reduced to a ghost fill.
- **UI compliance scan:** no `box-shadow`/`text-shadow`/`filter`; `border-radius` only ever set to `0`; emoji codepoint ranges (U+1F000–1FAFF, U+2600–27BF, U+25A0–25FF) all absent — only a technical arrow glyph (U+2192) appears, 3 instances of which are inside code comments. File is UTF-8 (no BOM) with all CJK labels intact.

## 6. R5 / R6 disclosure
- **R5 (network):** No network access at any point. No research/tutorial/reference-implementation/CDN fetching. **No runtime libraries were installed** — the deliverable has zero dependencies, so nothing needed to be fetched for testing; the R5 install-exception was not exercised. Self-testing used only the pre-installed local Node.js and the pre-installed local headless Edge/Chrome opening the file via `file://`.
- **R6 (workspace):** All writes stayed inside the workspace. `task.md` was not modified (none existed). A temporary development directory `parts/` was used for the standalone solver test, extracted-script syntax check, headless screenshots and throwaway view-variant HTML files; **the entire `parts/` directory was deleted at completion** (no `node_modules`, no intermediates remain). Final retained files: `answer.html`, `result.json`, `log.md`.
- **R1/R3/R4:** Acted only as the candidate model (no organizer/reviewer framing, no assumptions about grading/batches). No git commands. No sub-agents, workflows, background/nested agents, or external model APIs.

## 7. Outcome
`answer.html` — one self-contained, offline, dependency-free page implementing a constraint-solved double-wishbone suspension with bounce simulation, tie-rod steering linkage, kingpin motion paths, camber/toe/KPI analysis, industrial CAD-style UI, and no emoji/rounded-corners/shadows.
