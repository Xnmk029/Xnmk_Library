/**
 * react/PoolcoreCanvas.jsx — React / React Three Fiber 集成示例
 * ===========================================================================
 * 引擎本体是"框架无关"的纯 three（src/main.js 是它的 vanilla 入口）。
 * 如果你的项目跑在 React / R3F 里，有两种接法：
 *
 *  A) <PoolcoreCanvas />：本文件默认导出。自己持有 renderer 与主循环（推荐）。
 *     —— 这套引擎有 5 个渲染通道（折射/反射/焦散/遮挡/主渲染）与自己的帧预算调度，
 *        由引擎掌控 render loop 最省心，R3F 只负责挂载/卸载与 UI 叠层。
 *
 *  B) <PoolcoreLayer />：挂在已有的 <Canvas> 内部，复用 R3F 的 renderer 与 useFrame。
 *     —— 适合"池核只是你场景的一部分"。注意要把 R3F 的自动渲染关掉
 *        （<Canvas frameloop="never"> 或用 gl.autoClear 自行管理），否则会与后处理链打架。
 *
 * 两种接法共用同一批模块，不复制任何逻辑。
 */

import React, { useEffect, useRef } from 'react';

/** A) 自持渲染循环：最简单、最稳 */
export default function PoolcoreCanvas({ seed, quality = 2, auto = true, style }) {
  const hostRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let api = null;

    // 引擎读 URL 参数决定 seed/画质；这里用 history 注入后再动态 import
    const url = new URL(window.location.href);
    if (seed !== undefined) url.searchParams.set('seed', String(seed));
    url.searchParams.set('quality', String(quality));
    url.searchParams.set('auto', auto ? '1' : '0');
    window.history.replaceState(null, '', url);

    // 引擎需要 #scene canvas 与 #diag 容器
    const host = hostRef.current;
    host.innerHTML = '<canvas id="scene"></canvas><div id="diag" style="display:none"></div><pre id="fatal" style="display:none"></pre>';

    import('../main.js').then(() => {
      if (disposed) return;
      api = window.__LP;
    });

    return () => {
      disposed = true;
      // 引擎把内部对象挂在 window.__LP 上，卸载时逐个释放
      const lp = api || window.__LP;
      if (lp) {
        lp.chunkManager?.dispose?.();
        lp.water?.dispose?.();
        lp.caustics?.dispose?.();
        lp.postfx?.dispose?.();
        lp.materials?.dispose?.();
        lp.sky?.dispose?.();
        lp.player?.dispose?.();
        lp.hud?.dispose?.();
        lp.textures?.dispose?.();
        lp.renderer?.dispose?.();
        delete window.__LP;
      }
      if (host) host.innerHTML = '';
    };
  }, [seed, quality, auto]);

  return <div ref={hostRef} style={{ position: 'fixed', inset: 0, ...style }} />;
}

/**
 * B) 挂进已有的 R3F <Canvas>：复用 R3F 的 renderer / scene / camera。
 * 用法：
 *   <Canvas frameloop="always" gl={{ antialias: false }}>
 *     <PoolcoreLayer seed={1234} />
 *   </Canvas>
 * 注意：本层内部自己跑后处理链，请不要再叠 R3F 的 <EffectComposer>。
 */
export function PoolcoreLayer({ seed = 20240517, qualityTier = 2 }) {
  // 这里用 require 风格的动态 import，避免在没装 @react-three/fiber 的项目里报错
  const R3F = requireR3F();
  const { useThree, useFrame } = R3F;
  const { gl, scene, camera, size } = useThree();
  const state = useRef({ ready: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [
        { Field }, { createElementGeometries }, { ChunkManager }, { PerfGovernor },
        { createProceduralTextures }, { createMaterials, createSharedUniforms },
        { createSky }, { WaterSystem }, { CausticsGenerator }, { PostFX }, { Player },
        { QUALITY_TIERS, PERF },
      ] = await Promise.all([
        import('../gen/Field.js'), import('../gen/Elements.js'), import('../core/ChunkManager.js'),
        import('../core/PerfGovernor.js'), import('../render/Textures.js'), import('../render/Materials.js'),
        import('../render/Sky.js'), import('../render/Water.js'), import('../render/Caustics.js'),
        import('../render/PostFX.js'), import('../player/Player.js'), import('../config.js'),
      ]);
      if (cancelled) return;

      const quality = QUALITY_TIERS[qualityTier];
      gl.shadowMap.enabled = true;
      gl.info.autoReset = false;

      const textures = createProceduralTextures({ seed: seed ^ 0x7ab1 });
      const elements = createElementGeometries({ lodLevels: 3 });
      const sky = await createSky({ scene, renderer: gl, camera, textures, quality });
      const water = new WaterSystem(gl, { textures, quality });
      const caustics = new CausticsGenerator(gl, { size: quality.causticsSize });
      const uniforms = createSharedUniforms();
      const materials = createMaterials({ textures, csm: sky.csm, uniforms });
      const field = new Field(seed);
      const chunkManager = new ChunkManager({
        scene, field, elements, quality, materials: { ...materials, water: water.material },
      });
      const player = new Player({ camera, domElement: gl.domElement, field, water });
      player.spawn(field.findSpawn());
      const postfx = new PostFX(gl, scene, camera, { quality, textures });
      const governor = new PerfGovernor({ initialTier: qualityTier });

      state.current = {
        ready: true, time: 0, last: performance.now(),
        textures, elements, sky, water, caustics, materials, field, chunkManager, player, postfx, governor, PERF,
      };
    })();
    return () => {
      cancelled = true;
      const s = state.current;
      if (!s.ready) return;
      s.chunkManager.dispose(); s.water.dispose(); s.caustics.dispose();
      s.postfx.dispose(); s.materials.dispose(); s.sky.dispose();
      s.player.dispose(); s.textures.dispose();
      state.current = { ready: false };
    };
  }, [gl, scene, camera, seed, qualityTier]);

  useEffect(() => {
    const s = state.current;
    if (!s.ready) return;
    s.water.setSize(size.width, size.height);
    s.postfx.setSize(size.width, size.height);
  }, [size]);

  useFrame(() => {
    const s = state.current;
    if (!s.ready) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    s.time += dt;

    gl.info.reset();
    s.player.update(dt, s.time);
    s.sky.update(camera);
    s.materials.update({ time: s.time, cameraPosition: camera.position, underwater: s.player.underwater, causticsTexture: s.caustics.texture });
    s.caustics.update(s.time);
    s.chunkManager.update(camera, s.PERF.chunkBudgetMs);
    s.water.update({ scene, camera, chunkManager: s.chunkManager, time: s.time, causticsTexture: s.caustics.texture });
    s.postfx.godRays.renderOcclusion(scene, camera, s.materials);
    s.postfx.render(dt, s.time);
    s.governor.sample(dt * 1000);
  }, 1);

  return null;
}

function requireR3F() {
  // 延迟解析，避免非 R3F 项目 import 本文件时崩掉
  try {
    // eslint-disable-next-line
    return require('@react-three/fiber');
  } catch {
    throw new Error('PoolcoreLayer 需要 @react-three/fiber；若只想用引擎本体，请使用默认导出 <PoolcoreCanvas />');
  }
}
