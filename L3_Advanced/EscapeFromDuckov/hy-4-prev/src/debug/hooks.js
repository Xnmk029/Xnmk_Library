// 无头测试与手动调试的抓手。?headless=1 会额外禁用 rAF 驱动，改由 __GAME.step(n) 确定性推帧。
export function installHooks(game) {
  const g = {
    get frames() { return game.loop.frames; },
    get fps() { return game.loop.fps; },
    get frameMs() { return game.loop.frameMs; },
    get errors() { return window.__FATAL || []; },
    get player() {
      const p = game.player;
      return { x: +p.x.toFixed(3), z: +p.z.toFixed(3), speed: +p.speed.toFixed(2), stamina: +p.stamina.toFixed(1), hp: p.hp ?? 1 };
    },
    get render() {
      const i = game.renderer.info;
      return { calls: i.render.calls, tris: i.render.triangles, programs: i.programs?.length ?? 0, geometries: i.memory.geometries, textures: i.memory.textures };
    },
    get world() {
      const w = game.world;
      return {
        id: w.id, size: [w.w, w.h], buildings: w.buildings.length,
        props: w.props.length, containers: w.containers.length, exits: w.exitPoints.length,
      };
    },
    get fow() { return game.vision ? { polys: game.vision.rays, visible: game.vision.visibleEntities ?? 0 } : null; },
    get time() { return game.clock ? { day: game.clock.day, minutes: +game.clock.minutes.toFixed(1), hour: game.clock.hour } : null; },

    /** 确定性推帧：不依赖 rAF，供 Playwright 断言 */
    step(n = 1) {
      game.loop.paused = true;
      for (let i = 0; i < n; i++) game.loop.stepN(1);
      game.renderOnce(1);
      return g.frames;
    },
    /** 直接把玩家瞬移到某点（测试用） */
    teleport(x, z) {
      game.player.x = x; game.player.z = z;
      game.player.px = x; game.player.pz = z;
      game.rig.snapTo(x, z);
    },
    /**
     * 画面自检：渲染一帧后立刻从 GL 后台缓冲读像素。
     * 必须在同一个任务里同步读取 —— 没有 preserveDrawingBuffer 时，
     * 一旦交回事件循环，绘制缓冲就会被合成器清空（drawImage 到 2D canvas 会读到全黑）。
     */
    grab(step = 4) {
      game.renderOnce(1);
      const gl = game.renderer.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let sum = 0, min = 255, max = 0, n = 0;
      const hist = new Set();
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const i = (y * W + x) * 4;
          const l = buf[i] * 0.299 + buf[i + 1] * 0.587 + buf[i + 2] * 0.114;
          sum += l; n++;
          if (l < min) min = l;
          if (l > max) max = l;
          hist.add(((buf[i] >> 4) << 8) | ((buf[i + 1] >> 4) << 4) | (buf[i + 2] >> 4));
        }
      }
      return { mean: +(sum / n).toFixed(1), min: +min.toFixed(0), max: +max.toFixed(0), colors: hist.size, w: W, h: H };
    },

    /** 把后台缓冲打印成 ASCII 亮度图：无头环境下"看图"的唯一可靠手段 */
    grabAscii(cols = 64, rows = 26) {
      game.renderOnce(1);
      const gl = game.renderer.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const chars = ' .:-=+*#%@';
      const lines = [];
      for (let r = rows - 1; r >= 0; r--) {           // readPixels 原点在左下，需翻转
        let line = '';
        for (let c = 0; c < cols; c++) {
          const x = Math.floor(((c + 0.5) / cols) * W);
          const y = Math.floor(((r + 0.5) / rows) * H);
          const i = (y * W + x) * 4;
          const l = (buf[i] * 0.299 + buf[i + 1] * 0.587 + buf[i + 2] * 0.114) / 255;
          line += chars[Math.min(chars.length - 1, Math.floor(l * chars.length))];
        }
        lines.push(line);
      }
      return lines.join('\n');
    },

    setKey(name, down) {
      game.input.keys[name] = down;
      game.input._syncIntent();
    },
    press(name) { g.setKey(name, true); setTimeout(() => g.setKey(name, false), 60); },
    start() { game.startRun(); },
    game,
  };
  window.__GAME = g;
  return g;
}
