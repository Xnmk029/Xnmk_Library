# CCF Vehicle Lab — JBeam → WebGL Physics, Engine Audio & NPR City Benchmark

A complete, dependency-free HTML5/WebGL vehicle laboratory built for the
"ultra-complex multi-disciplinary AI benchmark" prompt in this repository:
it ingests a real BeamNG vehicle mod (Hirochi CCF, `thw_ccf2`), converts its
jbeam soft-body definition into a browser physics rig, synthesizes the
engine through the Web Audio API, renders everything as cel-shaded anime
NPR, and embeds a procedurally generated city served through a quadtree
3D vector-tile pipeline.

**Stack purity:** HTML5 + CSS3 + ES6 modules + WebGL2 (Three.js r180,
vendored) + Web Audio API. No engines, no build step, no external services —
everything runs client-side.

![proving ground](docs/media/proving_ground.png)

## Run it

```bash
node scripts/serve.mjs           # http://localhost:8080  (any static server works)
```

Open the page, wait for the pipeline stages, **CLICK TO IGNITE**, drive with
WASD. `T` runs the automated validation sweep (14/14 PASS —
[docs/VALIDATION.md](docs/VALIDATION.md)).

| Key | Action |
|-----|--------|
| WASD / arrows / gamepad | throttle · brake · steer |
| Space / Q / E / G | handbrake · shift down/up · auto/manual |
| C / N / P / U | cockpit cam · **node-beam X-ray** · paint cycle · mute |
| M / V | city vector-tile map · drive in the city |
| T / ` / R | validation autopilot · diagnostics console · reset |

URL flags: `?autostart` (skip ignite gesture, no audio), `&turbo=1`
(6× validation time-warp). You can also drag & drop BeamNG mod `.zip`
packages onto the page — they unpack in-browser (DecompressionStream) into
the asset overlay.

## Phase map (what lives where)

**Phase 1 — mod parsing & physics conversion**
- `js/jbeam/relaxedjson.js` — tolerant SJSON parser (comments, missing commas)
- `js/jbeam/schema.js` — table expansion, sticky modifiers, `$vars`/`case()`
- `js/jbeam/assembler.js` — slot-tree part resolution (133 parts), cross-part
  section merging with BeamNG `nodeOffset` mirror semantics
- `js/jbeam/convert.js` — node network → rigid body (mass/COM/inertia),
  pressureWheels → decoupled wheel entities, coilover/swaybar → spring rates,
  tires clamped to **µ ≥ 1.2 rough** per spec; full provenance report
- `js/core/loader.js` — VFS + native in-browser zip unpacker
- `js/vehicle/binder.js` — COLLADA flexbody binding on real kingpin axes,
  node-beam X-ray overlay
- `js/physics/vehicle.js` — 240 Hz fixed-step 6-DOF solver: suspension,
  combined-slip brush tires with carcass squash (drives the soft-tire
  deformation shader), full powertrain (torque curve, slipping clutch, 6M,
  LSD), water buoyancy/drag, hull & building contacts

**Phase 2 — engine acoustics** — `js/audio/engine-worklet.js` (AudioWorklet
DSP: firing-order pulse train, manifold/tail comb resonators, intake,
overrun crackle) + `js/audio/engine.js` (3-D panner bus: engine bay, exhaust
tips, gear whine, tire slip, cobble rumble, wind, splashes).

**Phase 3 — proving ground** — `js/physics/surface.js` (one analytic field
drives physics *and* meshes: Belgian pave, asymmetric bumps, slalom, 28°
carousel, wading pool) + `js/world/proving.js` + `js/validation/autopilot.js`.

**Phase 4 — NPR & HUD** — `js/gfx/npr.js` (GLSL3 cel ramp, BC5 normals,
paint masking, inverted-hull pixel-width outlines), `js/gfx/post.js` (HDR
bloom, depth/normal ink edges, ACES, FXAA), `js/gfx/sky.js`, `js/ui/hud.js`
(canvas tach, telemetry graphs, diagnostics).

**Phase 5 — procedural city & vector tiles** — `js/city/citygen.js` (seeded
grid-graph: 701 roads, 4421 extruded buildings, 5514 streetlights, 114 POIs),
`js/city/tiles.js` (quadtree z0–z5, LOD content policy, budgeted streaming,
LRU), `js/city/lines.js` (screen-pixel-constant line shader),
`js/city/camera.js` (pan/orbit/zoom with seamless ortho↔perspective morph),
`js/city/labels.js` (POI overlay with zoom-band fade + de-crowding).

## Assets

`vehicles/` is the reconstructed `thw_ccf2` mod tree (Hirochi CCF by Theo &
Finn Wilkinson — 115 jbeam files, COLLADA meshes, BC4–BC7 DDS textures,
included here as benchmark input data). `vehicles/manifest.json` indexes it
for the browser (`node scripts/gen_manifest.mjs` to regenerate).

## Tests

```bash
node tests/test_assembler.mjs    # parser + slot resolution against the real mod
node tests/test_drive.mjs        # WOT launch: clutch, shifts, 0-100 ≈ 7 s
node tests/test_validation.mjs   # full autopilot course → 14/14 matrix (~3 s)
```

Node tests resolve the vendored Three.js through `node_modules/three`
(recreate if missing: a package.json + two symlinks into `js/vendor/`).

---

# AI Prompt Testing Repository (AIpromptTest)

欢迎使用 **AIpromptTest** 仓库。本项目用于存放、测试、评估与迭代各种 AI 提示词（Prompts）及测试用例。

## 📁 目录结构说明

```
AIpromptTest/
├── index.html + css/ + js/  # ↑ 上述 WebGL 车辆基准测试应用
├── vehicles/             # 基准载具资产 (thw_ccf2 mod 树)
├── docs/                 # 验证矩阵与截图
├── tests/                # Node 物理/解析测试
├── prompts/              # 提示词库
│   ├── system_prompts/   # 系统提示词 (System Prompts)
│   └── templates/        # 提示词模板 (Prompt Templates)
├── test_cases/           # 测试用例与评估基准
├── evaluations/          # 测试结果与评估报告
├── scripts/              # 自动化测试与评估脚本 (+ serve.mjs / gen_manifest.mjs)
├── config.example.json   # 配置文件模板
└── .gitignore            # Git 忽略配置
```

## 🚀 快速开始

### 1. 编写与管理 Prompt
在 `prompts/` 目录下创建或修改提示词文件，建议使用 Markdown 或 JSON 格式记录版本号与设计初衷。

### 2. 配置环境
复制配置文件模板：
```bash
cp config.example.json config.json
```
在 `config.json` 中配置您的 API 密钥与模型参数（注意：请勿提交包含真实 API Key 的 `config.json`）。

### 3. 运行提示词测试
使用 `scripts/` 目录下的测试脚本评估提示词效果：
```bash
python scripts/run_tests.py
```

## 📝 贡献规范
- 新增提示词时，请在 `test_cases/` 中同步添加对应的评估测试用例。
- 每次提示词修改建议在 commit 信息中注明变更原因与期望效果。
