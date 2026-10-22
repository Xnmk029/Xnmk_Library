/**
 * main.js — 装配与主循环
 * ===========================================================================
 * 一帧的完整顺序（顺序本身就是正确性的一部分）：
 *
 *   1. 玩家/相机更新（解析碰撞、涉水、涟漪）
 *   2. 光照：CSM 级联跟随相机重算
 *   3. 焦散：把动画焦散渲进 256² RT（一次全屏 quad）
 *   4. chunk 流式加载：在帧预算内推进生成器、卸载远块、chunk 级视锥剔除
 *   5. 水体：折射通道（隐藏水面渲场景 + 深度）、平面反射通道（镜像相机 + 裁剪面）
 *   6. 体积光遮挡图：全黑覆盖 + 天窗层纯白（近距离相机，远块自动剔除）
 *   7. 主渲染 + 后处理链（GTAO → 体积光 → 水下滤镜 → Bloom → ACES 输出 → SMAA）
 *   8. 性能治理：喂帧时间，必要时升降档
 *
 * 诊断：window.__LP_DIAG 暴露运行状态，并周期性写入 #diag（供无头冒烟测试读取）。
 */

import * as THREE from 'three';
import { CONFIG, WORLD, RENDER, PERF, QUALITY_TIERS } from './config.js';
import { Field } from './gen/Field.js';
import { createElementGeometries, describeElementGeometries } from './gen/Elements.js';
import { ChunkManager } from './core/ChunkManager.js';
import { PerfGovernor } from './core/PerfGovernor.js';
import { createProceduralTextures } from './render/Textures.js';
import { createMaterials, createSharedUniforms } from './render/Materials.js';
import { createSky } from './render/Sky.js';
import { WaterSystem } from './render/Water.js';
import { CausticsGenerator } from './render/Caustics.js';
import { PostFX } from './render/PostFX.js';
import { Player } from './player/Player.js';
import { Hud } from './ui/Hud.js';

// ── 诊断（无头测试与真人调试共用）─────────────────────────────────
const DIAG = {
  stage: 'boot', ready: false, frames: 0, fps: 0, ms: 0,
  errors: [], warnings: [], webgl: null, quality: '', seed: 0,
  chunks: 0, pending: 0, instances: 0, drawCalls: 0, triangles: 0,
  position: null, underwater: false, elements: 0, programs: 0,
};
window.__LP_DIAG = DIAG;
const diagEl = () => document.getElementById('diag');
function flushDiag() {
  const el = diagEl();
  if (el) el.textContent = JSON.stringify(DIAG);
}
function fatal(err) {
  const msg = err?.stack || err?.message || String(err);
  DIAG.errors.push(msg.slice(0, 800));
  DIAG.stage = 'error';
  flushDiag();
  document.title = 'ERR: ' + (err?.message || String(err)).slice(0, 90);
  const overlay = document.getElementById('fatal');
  if (overlay) {
    overlay.style.display = 'block';
    overlay.textContent = '初始化失败：\n' + msg;
  }
  console.error(err);
}
window.addEventListener('error', (e) => { DIAG.errors.push(String(e.message).slice(0, 400)); flushDiag(); });
window.addEventListener('unhandledrejection', (e) => { DIAG.errors.push('unhandled: ' + String(e.reason).slice(0, 400)); flushDiag(); });

// 接管 console.error / warn：three 的 Shader 编译失败、纹理格式警告等都会走这里，
// 这样无头冒烟测试只看 DIAG 就能发现 GPU 层面的问题（不依赖浏览器日志抓取）。
for (const [level, bucket] of [['error', DIAG.errors], ['warn', DIAG.warnings]]) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    if (bucket.length < 12) {
      bucket.push(args.map((a) => (a && a.stack) || String(a)).join(' ').slice(0, 600));
    }
    original(...args);
  };
}

// ── URL 参数：?seed=123&quality=2&auto=0 ──────────────────────────
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? (Number(params.get('seed')) | 0) : CONFIG.seed;
const initialTier = params.has('quality')
  ? Math.max(0, Math.min(QUALITY_TIERS.length - 1, Number(params.get('quality')) | 0))
  : 2;
const autoQuality = params.get('auto') !== '0';
/** 冒烟/离屏模式：requestAnimationFrame 在无头浏览器（无合成器）里不会被驱动，
 *  因此提供定时器驱动 + 定帧停止，让自动化测试可以确定性地跑完 N 帧。 */
const SMOKE = params.get('smoke') === '1';
const MAX_FRAMES = params.has('maxframes') ? Math.max(1, Number(params.get('maxframes')) | 0) : 0;

async function boot() {
  DIAG.seed = seed;
  DIAG.stage = 'renderer';

  const canvas = document.getElementById('scene');
  // 注意：上下文属性由这里的 getContext 决定（renderer 的同名选项在传入 context 时不生效）。
  // 冒烟模式下开启 preserveDrawingBuffer：主循环跑完固定帧数后停止，
  // 若不保留缓冲，无头截图拿到的会是被清空的画布（黑屏）。
  const gl2 = canvas.getContext('webgl2', {
    antialias: false, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: SMOKE,
  });
  if (!gl2) throw new Error('需要 WebGL2 支持（本项目使用 WebGL2 特性：半浮点 RT / 深度纹理 / 实例化）');

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl2, antialias: false, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // 实际由 OutputPass 执行
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 关键优化：一帧里有 4 个几何通道（折射/反射/遮挡×2/主渲染），
  // three 默认每次 render() 都会重算阴影贴图 → 这里改为每帧只在第一个通道前更新一次。
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false;                      // 我们手动重置，以统计"整帧所有通道"的开销
  DIAG.webgl = {
    version: 2,
    renderer: gl2.getParameter(gl2.RENDERER),
    maxTextureSize: gl2.getParameter(gl2.MAX_TEXTURE_SIZE),
    maxSamples: gl2.getParameter(gl2.MAX_SAMPLES),
  };

  const hud = new Hud(document.body, { title: 'INFINITE LIMINAL POOLCORE' });
  hud.setLoading(0.05, '生成程序化贴图…');

  const governor = new PerfGovernor({
    initialTier, enabled: autoQuality,
    onChange: (q, i, reason) => applyQuality(q, reason),
  });
  let quality = governor.quality;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(RENDER.fov, window.innerWidth / window.innerHeight, RENDER.near, RENDER.far);
  camera.position.set(0, WORLD.deckY + 1.7, 0);

  // ── 程序化贴图 ────────────────────────────────────────────────
  DIAG.stage = 'textures';
  const textures = createProceduralTextures({
    size: 512, tiles: 8, seed: seed ^ 0x7ab1,
    anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
  });
  hud.setLoading(0.25, '构建元素库几何…');

  // ── 元素库 ────────────────────────────────────────────────────
  DIAG.stage = 'elements';
  const elements = createElementGeometries({ lodLevels: 3 });
  DIAG.elements = describeElementGeometries(elements).length;
  hud.setLoading(0.4, '布置光照与级联阴影…');

  // ── 光照（先于材质：CSM 必须先 setupMaterial）──────────────────
  DIAG.stage = 'sky';
  const sky = await createSky({ scene, renderer, camera, textures, quality });

  // ── 水体 / 焦散 / 材质 ────────────────────────────────────────
  DIAG.stage = 'water';
  const water = new WaterSystem(renderer, { textures, quality });
  const caustics = new CausticsGenerator(renderer, { size: quality.causticsSize });
  const uniforms = createSharedUniforms();
  const materials = createMaterials({ textures, csm: sky.csm, uniforms });
  // 显式挂环境贴图：否则 three r163+ 会用 scene.environmentIntensity 覆盖材质级 envMapIntensity
  materials.setEnvironment(sky.envMap);
  materials.uniforms.uCaustics.value = caustics.texture;
  water.uniforms.uCaustics.value = caustics.texture;
  caustics.onTextureChange = (tex) => {
    materials.uniforms.uCaustics.value = tex;
    water.uniforms.uCaustics.value = tex;
  };
  hud.setLoading(0.6, '解析场域并流式生成 chunk…');

  // ── 世界 ──────────────────────────────────────────────────────
  DIAG.stage = 'world';
  let field = new Field(seed);
  const chunkManager = new ChunkManager({
    scene, field, elements, quality,
    materials: { ...materials, water: water.material },
  });

  const player = new Player({ camera, domElement: renderer.domElement, field, water });
  player.spawn(field.findSpawn());

  // ── 后处理 ────────────────────────────────────────────────────
  DIAG.stage = 'postfx';
  const postfx = new PostFX(renderer, scene, camera, { quality, textures });
  hud.setLoading(0.85, '编译 Shader…');

  // ── 画质切换 ──────────────────────────────────────────────────
  function applyQuality(q, reason = '') {
    quality = q;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    const w = renderer.domElement.width, h = renderer.domElement.height;
    chunkManager.setQuality(q);
    water.setQuality(q);
    water.setSize(w, h);
    caustics.setSize(q.causticsSize);
    sky.setQuality(q);
    postfx.setQuality(q, w, h);
    postfx.setSize(w, h);
    hud.setMessage(`画质 → ${q.name}${reason ? '（' + reason + '）' : ''}`, 1800);
  }
  applyQuality(quality, '初始');

  // ── 交互 ──────────────────────────────────────────────────────
  hud.setKeyHelp([
    'W A S D 移动 · Shift 疾行 · Space 跳跃/上浮 · C 下潜',
    '鼠标左键 在水面打出涟漪 · Esc 释放鼠标',
    '1/2/3/4 画质档位 · F 自动画质开关 · N 新种子世界',
    'R 平面反射 · O 环境光遮蔽 · G 体积光',
  ]);
  hud.showStartOverlay(() => player.controls.lock());
  player.controls.addEventListener('unlock', () => hud.showStartOverlay(() => player.controls.lock()));

  renderer.domElement.addEventListener('mousedown', () => {
    if (player.controls.isLocked) player.splashAhead(clockTime);
  });

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': {
        governor.enabled = false;
        governor.setTier(Number(e.code.slice(-1)) - 1, '手动');
        hud.setMessage(`手动画质 ${governor.name}（自动治理已关闭，F 恢复）`, 2200);
        break;
      }
      case 'KeyF':
        governor.enabled = !governor.enabled;
        hud.setMessage(`自动画质治理 ${governor.enabled ? '开' : '关'}`, 1600);
        break;
      case 'KeyR':
        quality.reflection = !quality.reflection;
        water.setQuality(quality);
        hud.setMessage(`平面反射 ${quality.reflection ? '开' : '关'}`, 1400);
        break;
      case 'KeyO':
        quality.ao = !quality.ao;
        if (postfx.gtaoPass) postfx.gtaoPass.enabled = quality.ao;
        hud.setMessage(`环境光遮蔽 ${quality.ao ? '开' : '关'}`, 1400);
        break;
      case 'KeyG':
        quality.rays = !quality.rays;
        postfx.godRays.enabled = quality.rays;
        hud.setMessage(`体积光 ${quality.rays ? '开' : '关'}`, 1400);
        break;
      case 'KeyN': {
        const newSeed = (Math.random() * 0x7fffffff) | 0;
        field = new Field(newSeed);
        chunkManager.field = field;
        chunkManager.builder.field = field;
        for (const key of [...chunkManager.chunks.keys()]) chunkManager._disposeChunk(key);
        chunkManager.pending.clear();
        player.field = field;
        player.spawn(field.findSpawn());
        DIAG.seed = newSeed;
        hud.setMessage(`新世界 seed = ${newSeed}`, 2200);
        break;
      }
    }
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const dw = renderer.domElement.width, dh = renderer.domElement.height;
    water.setSize(dw, dh);
    postfx.setSize(dw, dh);
  });

  // ── 主循环 ────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let clockTime = 0;
  let lastUnderwater = null;
  let frameStart = performance.now();

  hud.setLoading(1, '');
  DIAG.stage = 'running';

  // ── 帧驱动器：优先 rAF；若 1 秒内没被驱动（无头/隐藏标签页）则降级为定时器 ──
  let driverGen = 0;
  let useTimer = SMOKE;
  function scheduleNext(gen) {
    if (MAX_FRAMES && DIAG.frames >= MAX_FRAMES) {
      DIAG.stage = 'done';
      flushDiag();
      return;
    }
    if (useTimer) setTimeout(() => frame(gen), 0);
    else requestAnimationFrame(() => frame(gen));
  }
  if (!SMOKE) {
    setTimeout(() => {
      if (DIAG.frames === 0) {
        DIAG.warnings.push('requestAnimationFrame 未被驱动，切换为定时器驱动');
        useTimer = true;
        driverGen++;
        scheduleNext(driverGen);
      }
    }, 1000);
  }

  /** 采集当前默认帧缓冲的统计（供 captureFramebufferStats 与探针共用） */
  function readbackStats() {
    const gl = renderer.getContext();
    const w = renderer.domElement.width, h = renderer.domElement.height;
    const buf = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const lumAt = (x, y) => {
      const i = ((h - 1 - y) * w + x) * 4;   // readPixels 上下翻转
      return 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
    };
    let sR = 0, sG = 0, sB = 0, sL = 0, sL2 = 0, n = 0;
    const colors = new Set();
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const i = (y * w + x) * 4;
        const r = buf[i], g = buf[i + 1], b = buf[i + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sR += r; sG += g; sB += b; sL += l; sL2 += l * l; n++;
        colors.add((r >> 3 << 10) | (g >> 3 << 5) | (b >> 3));
      }
    }
    const mean = sL / n;
    const ramp = ' .:-=+*#%@';
    const CW = 24, CH = 10, rows = [];
    for (let cy = 0; cy < CH; cy++) {
      let row = '';
      for (let cx = 0; cx < CW; cx++) {
        let acc = 0, cnt = 0;
        for (let y = Math.floor((cy / CH) * h); y < Math.floor(((cy + 1) / CH) * h); y += 4) {
          for (let x = Math.floor((cx / CW) * w); x < Math.floor(((cx + 1) / CW) * w); x += 4) {
            acc += lumAt(x, y); cnt++;
          }
        }
        row += ramp[Math.min(9, Math.floor(((cnt ? acc / cnt : 0) / 255) * 10))];
      }
      rows.push(row);
    }
    return {
      size: `${w}x${h}`,
      mean: +mean.toFixed(1),
      std: +Math.sqrt(Math.max(0, sL2 / n - mean * mean)).toFixed(1),
      rgb: [+(sR / n).toFixed(1), +(sG / n).toFixed(1), +(sB / n).toFixed(1)],
      colors: colors.size,
      ascii: rows,
    };
  }

  // ── 帧缓冲回读（冒烟模式）──────────────────────────────────────
  // 直接从默认帧缓冲 readPixels，绕开浏览器截图/合成链路，
  // 得到"引擎究竟渲染出了什么"的确定性测量：均值/标准差/色数 + 24×10 缩略亮度图。
  function captureFramebufferStats() {
    try {
      DIAG.pixels = readbackStats();
      // 视线探针：沿相机朝向解析步进查询场域，报告最近实体的距离与类型
      const dir = camera.getWorldDirection(new THREE.Vector3());
      let hit = null;
      for (let t = 0.3; t < 80; t += 0.25) {
        const x = camera.position.x + dir.x * t;
        const y = camera.position.y + dir.y * t;
        const z = camera.position.z + dir.z * t;
        if (field.isSolid(x, y, z)) {
          const c = field.cellAtWorld(x, z);
          hit = { dist: +t.toFixed(2), wall: c.wall, kind: c.kind, floorY: +c.floorY.toFixed(2) };
          break;
        }
      }
      DIAG.view = {
        dir: [+dir.x.toFixed(2), +dir.y.toFixed(2), +dir.z.toFixed(2)],
        hit,
        waterDepthHere: +field.waterDepthAt(camera.position.x, camera.position.z).toFixed(2),
      };
    } catch (err) {
      DIAG.warnings.push('readPixels 失败：' + (err?.message || err));
    }
  }

  /**
   * 分段探针（?probe=1）：在同一次运行里依次渲染多种配置并回读，
   * 用于定位"画面发白/发暗"到底出自哪一段（雾 / 后处理 / 体积光 / 泛光 / 主渲染）。
   */
  function runProbes() {
    const probes = [];
    const snap = (name) => probes.push({ name, ...readbackStats() });

    // ① 纯主渲染（不走 composer）
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    snap('scene-only');

    // ② 关雾
    const fog = scene.fog;
    scene.fog = null;
    renderer.render(scene, camera);
    snap('scene-no-fog');
    scene.fog = fog;

    // ③ 关雾 + 覆盖为无光照白模（看几何轮廓是否存在）
    const normalMat = new THREE.MeshNormalMaterial();
    scene.fog = null;
    scene.overrideMaterial = normalMat;
    renderer.render(scene, camera);
    snap('geometry-normals');
    scene.overrideMaterial = null;
    scene.fog = fog;
    normalMat.dispose();

    // ③b 光照预算分解：逐个关断光源，量化各自贡献（定位"室内被填平"的元凶）
    const sunLights = sky.csm ? sky.csm.lights : sky.sunLight ? [sky.sunLight] : [];
    const sunWas = sunLights.map((l) => l.intensity);
    sunLights.forEach((l) => { l.intensity = 0; });
    renderer.render(scene, camera);
    snap('no-sun');
    sunLights.forEach((l, i) => { l.intensity = sunWas[i]; });

    const envWas = scene.environment;
    scene.environment = null;
    renderer.render(scene, camera);
    snap('no-ibl');
    scene.environment = envWas;

    const hemiWas = sky.hemi.intensity, ambWas = sky.ambient.intensity;
    sky.hemi.intensity = 0; sky.ambient.intensity = 0;
    renderer.render(scene, camera);
    snap('no-hemi-no-ambient');
    sky.hemi.intensity = hemiWas; sky.ambient.intensity = ambWas;

    // ③c 只留阳光 → 判断天花板阴影是否真的挡住了阳光（若很亮说明阴影没生效）
    scene.environment = null; sky.hemi.intensity = 0; sky.ambient.intensity = 0;
    renderer.render(scene, camera);
    snap('sun-only');
    scene.environment = envWas; sky.hemi.intensity = hemiWas; sky.ambient.intensity = ambWas;

    // ③d 运行时改 envMapIntensity（验证 IBL 强度这条 uniform 路是否真的生效）
    const eiWas = [materials.tile.envMapIntensity, materials.metal.envMapIntensity, materials.gloss.envMapIntensity];
    materials.tile.envMapIntensity = 0.02;
    materials.metal.envMapIntensity = 0.02;
    materials.gloss.envMapIntensity = 0.02;
    renderer.render(scene, camera);
    snap('envMapIntensity-0.02');
    materials.tile.envMapIntensity = eiWas[0];
    materials.metal.envMapIntensity = eiWas[1];
    materials.gloss.envMapIntensity = eiWas[2];

    // ③e scene.environmentIntensity（three r163+ 的全局 IBL 强度）
    if ('environmentIntensity' in scene) {
      const seiWas = scene.environmentIntensity;
      scene.environmentIntensity = 0.1;
      renderer.render(scene, camera);
      snap('sceneEnvironmentIntensity-0.1');
      scene.environmentIntensity = seiWas;
    }

    // ③f 覆盖成 50% 灰的无光照材质：看几何覆盖率（排除"大面积自发光面板"的可能）
    const flat = new THREE.MeshBasicMaterial({ color: 0x808080, fog: false });
    scene.overrideMaterial = flat;
    renderer.render(scene, camera);
    snap('flat-gray-coverage');
    scene.overrideMaterial = null;
    flat.dispose();

    DIAG.lightBudget = {
      tileEnvMapIntensity: materials.tile.envMapIntensity,
      sceneEnvironmentIntensity: scene.environmentIntensity ?? null,
      hemi: sky.hemi.intensity, ambient: sky.ambient.intensity,
      sun: sunLights.map((l) => +l.intensity.toFixed(2)),
      exposure: renderer.toneMappingExposure,
      envMapIsSet: !!scene.environment,
      tileHasOwnEnvMap: !!materials.tile.envMap,
    };

    // ④ composer：关体积光 + 关泛光
    const raysWas = postfx.godRays.enabled, bloomWas = postfx.bloomPass?.enabled;
    postfx.godRays.enabled = false;
    if (postfx.bloomPass) postfx.bloomPass.enabled = false;
    postfx.render(0.016, clockTime);
    snap('composer-no-rays-no-bloom');
    postfx.godRays.enabled = raysWas;
    if (postfx.bloomPass) postfx.bloomPass.enabled = !!bloomWas;

    // ⑤ 完整链路
    postfx.godRays.renderOcclusion(scene, camera, materials);
    postfx.render(0.016, clockTime);
    snap('full-chain');

    // ⑥ 水下视角：把相机放进最近的深水，验证水面 Snell 窗分支 + 水下滤镜真的会渲染
    const camWas = camera.position.clone();
    let deep = null;
    for (let r = 1; r < 40 && !deep; r++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const cx = Math.round(Math.cos(a) * r), cz = Math.round(Math.sin(a) * r);
        const c = field.cell(cx, cz);
        if (c.waterDepth > 1.6 && !c.wall) {
          deep = {
            x: (cx + 0.5) * WORLD.cell,
            y: WORLD.waterY - Math.min(0.8, c.waterDepth * 0.5),
            z: (cz + 0.5) * WORLD.cell,
            depth: +c.waterDepth.toFixed(2),
          };
          break;
        }
      }
    }
    if (deep) {
      camera.position.set(deep.x, deep.y, deep.z);
      camera.updateMatrixWorld(true);
      materials.update({ time: clockTime, cameraPosition: camera.position, underwater: true, causticsTexture: caustics.texture });
      sky.setUnderwater(true);
      postfx.setUnderwater(true);
      postfx.underwaterPass.uniforms.uAmount.value = 1;
      postfx.underwaterPass.enabled = true;
      water.update({ scene, camera, chunkManager, time: clockTime, causticsTexture: caustics.texture });
      postfx.godRays.renderOcclusion(scene, camera, materials);
      postfx.render(0.016, clockTime);
      snap('underwater-view');
      DIAG.underwaterProbe = deep;

      // ⑦ 焦散贡献量测：同一机位关掉焦散再渲一次，两者之差就是焦散的真实可见度
      const causWas = materials.uniforms.uCausticsIntensity.value;
      materials.uniforms.uCausticsIntensity.value = 0;
      water.update({ scene, camera, chunkManager, time: clockTime, causticsTexture: caustics.texture });
      postfx.render(0.016, clockTime);
      snap('underwater-no-caustics');
      materials.uniforms.uCausticsIntensity.value = causWas;

      camera.position.copy(camWas);
      camera.updateMatrixWorld(true);
      sky.setUnderwater(false);
      postfx.setUnderwater(false);
      postfx.underwaterPass.uniforms.uAmount.value = 0;
      materials.update({ time: clockTime, cameraPosition: camera.position, underwater: false, causticsTexture: caustics.texture });
    }

    DIAG.probes = probes;
  }

  function frame(gen) {
    if (gen !== driverGen) return;      // 旧驱动器的残余回调直接丢弃
    scheduleNext(gen);
    const now = performance.now();
    const frameMs = now - frameStart;
    frameStart = now;

    const dt = Math.min(0.05, clock.getDelta());
    clockTime += dt;
    renderer.info.reset();

    // 1) 玩家
    player.update(dt, clockTime);
    camera.updateMatrixWorld(true);      // 视锥剔除/镜像相机/体积光都要用当帧矩阵，不能滞后一帧

    // 2) 水下状态切换
    if (player.underwater !== lastUnderwater) {
      lastUnderwater = player.underwater;
      sky.setUnderwater(player.underwater);
      postfx.setUnderwater(player.underwater);
      hud.setStats({ underwater: player.underwater });
    }

    // 3) 光照 + 共享 uniform
    sky.update(camera);
    materials.update({
      time: clockTime,
      cameraPosition: camera.position,
      underwater: player.underwater,
      causticsTexture: caustics.texture,
    });

    // 4) 焦散 RT
    caustics.update(clockTime);

    // 5) chunk 流式
    chunkManager.update(camera, PERF.chunkBudgetMs);

    // 6) 水体折射 / 反射（本帧第一个几何通道 → 在此之前放开阴影更新）
    renderer.shadowMap.needsUpdate = quality.shadows;
    water.update({ scene, camera, chunkManager, time: clockTime, causticsTexture: caustics.texture });

    // 7) 体积光遮挡图 + 主渲染
    postfx.godRays.renderOcclusion(scene, camera, materials);
    postfx.render(dt, clockTime);

    // 8) 性能治理
    governor.sample(frameMs);

    // 冒烟模式：最后一帧回读帧缓冲（必须在同一任务内，才保证内容有效）
    if (MAX_FRAMES && DIAG.frames + 1 >= MAX_FRAMES) {
      captureFramebufferStats();
      if (params.get('probe') === '1') { try { runProbes(); } catch (e) { DIAG.warnings.push('probe: ' + e.message); } }
    }

    // ── HUD / 诊断 ──
    DIAG.frames++;
    if ((DIAG.frames & 7) === 0 || SMOKE) {
      const info = renderer.info;
      DIAG.fps = governor.stats.fps;
      DIAG.ms = governor.stats.median;
      DIAG.drawCalls = info.render.calls;
      DIAG.triangles = info.render.triangles;
      DIAG.programs = info.programs?.length ?? 0;
      DIAG.chunks = chunkManager.stats.loaded;
      DIAG.pending = chunkManager.stats.pending;
      DIAG.instances = chunkManager.stats.instances;
      DIAG.quality = governor.name;
      DIAG.underwater = player.underwater;
      DIAG.position = { x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(1), z: +camera.position.z.toFixed(1) };
      DIAG.ready = DIAG.frames > 8 && chunkManager.stats.loaded > 0;
      hud.setStats({
        fps: DIAG.fps, ms: DIAG.ms,
        drawCalls: DIAG.drawCalls, triangles: DIAG.triangles, instances: DIAG.instances,
        chunks: { loaded: chunkManager.stats.loaded, pending: chunkManager.stats.pending, built: chunkManager.stats.builtTotal },
        quality: governor.name + (governor.enabled ? ' (auto)' : ' (manual)'),
        viewDistance: (quality.viewChunks * WORLD.chunkSize) | 0,
        position: DIAG.position, seed: DIAG.seed, underwater: player.underwater,
        effects: { ao: !!(postfx.gtaoPass?.enabled), rays: postfx.godRays.enabled, reflection: !!quality.reflection, shadows: !!quality.shadows },
      });
      if ((DIAG.frames & 63) === 0 || SMOKE) flushDiag();
    }
  }

  flushDiag();
  frame(driverGen);

  // 供调试台/宿主使用
  window.__LP = { renderer, scene, camera, field, chunkManager, water, caustics, materials, sky, postfx, player, governor, hud, textures, elements };
}

boot().catch(fatal);
