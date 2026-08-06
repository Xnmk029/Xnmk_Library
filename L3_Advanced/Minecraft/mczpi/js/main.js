/* MCZPI 主程序：初始化、输入、主循环、存档 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const demo = params.has('demo');
  const seedParam = params.get('seed');
  const timeParam = params.get('time');
  const tpParam = params.get('tp');
  const lookParam = params.get('look');
  const SAVE_KEY = 'mczpi_save_v1';

  const { B, DEFS, H } = window.Blocks;
  const HOTBAR_IDS = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.SAND, B.LOG, B.PLANKS, B.LEAVES, B.GLASS];
  const PARTICLE_COLORS = {
    [B.GRASS]: 0x7CBD4B, [B.DIRT]: 0x79553A, [B.STONE]: 0x7E7E7E, [B.COBBLE]: 0x7E7E7E,
    [B.SAND]: 0xDBD3A0, [B.LOG]: 0x6B5227, [B.LEAVES]: 0x5DA01F, [B.PLANKS]: 0xAD8C5E,
    [B.BEDROCK]: 0x1B1B1B, [B.WATER]: 0x3F76E4, [B.SNOW_GRASS]: 0x7CBD4B, [B.SNOW]: 0xF8FBFC,
    [B.COAL]: 0x2A2A2A, [B.IRON]: 0xD8AF93, [B.GRAVEL]: 0x7B7368, [B.GLASS]: 0xBFE0F8, [B.BRICK]: 0x9E5A47
  };

  // ---------- 渲染器 ----------
  const canvas = document.getElementById('game-canvas');
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    new UI([]).showGLError('WebGL 初始化失败：' + e.message);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  const atlasTex = new THREE.CanvasTexture(window.Tex.atlas);
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
  atlasTex.encoding = THREE.sRGBEncoding;
  atlasTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const SOLID_MAT = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 });
  const WATER_MAT = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, transparent: true, depthWrite: false });

  // ---------- 对象 ----------
  let world = null, player = null, sky = null, particles = null, ui = null;
  const audio = new window.AudioSys();
  let playing = false, locked = false, paused = false;
  let slot = 0, hit = null, stepAcc = 0, prevInWater = false;
  const input = { forward: false, back: false, left: false, right: false, up: false, down: false, sprint: false, sneak: false };

  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85 })
  );
  highlight.renderOrder = 2;
  highlight.visible = false;
  scene.add(highlight);

  sky = new window.Sky(scene);
  if (params.has('nofog')) { scene.fog = null; sky.nofog = true; }
  particles = new window.Particles(scene);
  ui = new window.UI(HOTBAR_IDS);
  ui.setSlot(0);

  // ---------- 存档 ----------
  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
  }
  function saveGame() {
    if (!world || !player || !sky) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, seed: world.seed,
        x: player.pos.x, y: player.pos.y, z: player.pos.z,
        yaw: player.yaw, pitch: player.pitch,
        time: sky.hours, slot
      }));
    } catch (e) { /* 忽略 */ }
  }

  // ---------- 开始游戏 ----------
  function startGame(seed) {
    playing = true;
    paused = false;
    ui.hideTitle();
    ui.hidePause();
    ui.showHUD(true);
    world = new window.World(seed);
    world.scene = scene;
    world.materials = { solid: SOLID_MAT, water: WATER_MAT };
    player = new window.Player(world, camera);
    const save = loadSave();
    if (save && save.seed === seed) {
      player.pos.set(save.x, save.y, save.z);
      player.yaw = save.yaw; player.pitch = save.pitch;
      sky.setTime(save.time);
      slot = save.slot || 0;
    } else {
      const sp = world.findSpawn();
      player.pos.set(sp.x, sp.y, sp.z);
      player.yaw = Math.PI * 0.25;
      player.pitch = -0.1;
      sky.setTime(8);
      slot = 0;
    }
    if (timeParam !== null) sky.setTime(Number(timeParam));
    if (tpParam) {
      const p = tpParam.split(',').map(Number);
      if (p.length >= 3 && isFinite(p[0])) player.pos.set(p[0], p[1], p[2]);
    }
    ui.setSlot(slot);
    audio.init();
    audio.playClick();
    if (!demo) {
      try {
        const pl = canvas.requestPointerLock();
        if (pl && pl.catch) pl.catch(() => {});
      } catch (e) { /* 无头环境忽略 */ }
      ui.toast('WASD 移动 · 空格 跳跃 · 左键 破坏 · 右键 放置 · F 飞行', 6000);
    }
    saveGame();
  }

  // ---------- 交互 ----------
  function breakBlock() {
    if (!hit) return;
    const id = world.getBlock(hit.x, hit.y, hit.z);
    world.setBlock(hit.x, hit.y, hit.z, B.AIR);
    particles.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, PARTICLE_COLORS[id] || 0x888888, 14);
    audio.playBreak();
  }
  function placeBlock() {
    if (!hit) return;
    const bx = hit.x + hit.face[0], by = hit.y + hit.face[1], bz = hit.z + hit.face[2];
    if (by < 0 || by >= H) return;
    const cur = world.getBlock(bx, by, bz);
    if (cur !== 0 && cur !== B.WATER) return;
    if (player.collides(bx + 0.5, by, bz + 0.5)) return;
    world.setBlock(bx, by, bz, HOTBAR_IDS[slot]);
    audio.playPlace();
  }
  function pickBlock() {
    if (!hit) return;
    const id = world.getBlock(hit.x, hit.y, hit.z);
    const i = HOTBAR_IDS.indexOf(id);
    if (i >= 0) { slot = i; ui.setSlot(slot); audio.playClick(); }
  }

  canvas.addEventListener('click', () => {
    if (playing && !locked && !demo) {
      canvas.requestPointerLock();
      ui.hidePause();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked && playing && !demo) { paused = true; ui.showPause(); }
    else paused = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (!locked && !demo) return;
    player.yaw -= e.movementX * 0.0024;
    player.pitch -= e.movementY * 0.0024;
    player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!playing) return;
    audio.init();
    if (!locked || demo) return;
    e.preventDefault();
    if (e.button === 0) breakBlock();
    else if (e.button === 2) placeBlock();
    else if (e.button === 1) pickBlock();
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    if (!playing || !locked) return;
    e.preventDefault();
    const d = e.deltaY > 0 ? 1 : -1;
    slot = (slot + d + HOTBAR_IDS.length) % HOTBAR_IDS.length;
    ui.setSlot(slot);
    audio.playClick();
  }, { passive: false });

  // ---------- 键盘 ----------
  const MOVE_KEYS = {
    KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
    Space: 'up', ShiftLeft: 'down', ShiftRight: 'down',
    ControlLeft: 'sprint', ControlRight: 'sprint'
  };
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (MOVE_KEYS[e.code]) {
      if (e.code === 'Space') e.preventDefault();
      input[MOVE_KEYS[e.code]] = true;
    }
    if (e.code === 'KeyF' && playing) {
      player.fly = !player.fly;
      player.vel.y = 0;
      ui.toast(player.fly ? '飞行模式（空格上升 / Shift 下降）' : '生存模式', 2000);
    }
    if (e.code === 'KeyM') {
      audio.init();
      const m = audio.toggleMute();
      ui.toast(m ? '已静音' : '声音已开启', 1500);
    }
    if (e.code === 'F3') { e.preventDefault(); ui.toggleDebug(); }
    if (e.code.indexOf('Digit') === 0 && playing) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= HOTBAR_IDS.length) { slot = n - 1; ui.setSlot(slot); audio.playClick(); }
    }
  });
  document.addEventListener('keyup', (e) => {
    if (MOVE_KEYS[e.code]) input[MOVE_KEYS[e.code]] = false;
  });

  // ---------- UI 回调 ----------
  const save = loadSave();
  ui.onStart = (seedStr) => {
    const s = save ? save.seed : null;
    let seed;
    if (seedStr && seedStr.trim() !== '') {
      const n = Number(seedStr);
      seed = isFinite(n) ? (n >>> 0) : (seedStr.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7));
    } else if (s !== null) seed = s;
    else seed = (Math.random() * 0x7fffffff) >>> 0;
    startGame(seed);
  };
  ui.onNew = () => {
    const seed = (Math.random() * 0x7fffffff) >>> 0;
    ui.seedInput.value = String(seed);
    startGame(seed);
  };
  ui.onResume = () => { ui.hidePause(); paused = false; if (!demo) canvas.requestPointerLock(); };
  ui.onSaveExit = () => { saveGame(); location.reload(); };
  ui.onReset = () => { localStorage.removeItem(SAVE_KEY); location.reload(); };
  ui.showTitle(save !== null, save ? save.seed : '');

  // ---------- 主循环 ----------
  let last = performance.now();
  let fpsFrames = 0, fpsTime = 0, fpsVal = 60;
  const camDir = new THREE.Vector3();

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!playing) { renderer.render(scene, camera); return; }

    fpsFrames++; fpsTime += dt;
    if (fpsTime >= 0.5) { fpsVal = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }

    // 演示模式：自动巡航
    if (demo) {
      player.fly = true;
      if (lookParam) {
        const lk = lookParam.split(',').map(Number);
        if (lk.length >= 2 && isFinite(lk[0])) { player.yaw = lk[0]; player.pitch = lk[1]; }
      } else {
        player.yaw += dt * 0.07;
        player.pitch = -0.3 + Math.sin(now * 0.0004) * 0.06;
      }
      let alt = 72;
      if (tpParam) {
        const tp = tpParam.split(',').map(Number);
        if (isFinite(tp[1])) alt = tp[1];
      }
      input.forward = lookParam ? false : true;
      input.up = player.pos.y < alt;
      input.down = player.pos.y > alt + 2;
      input.back = input.left = input.right = input.sprint = input.sneak = false;
    }

    if (!paused) {
      player.update(dt, input);
      if (!player.fly && player.onGround && !player.inWater) {
        const sp = Math.hypot(player.vel.x, player.vel.z);
        stepAcc += sp * dt;
        if (stepAcc > 2.4) { stepAcc = 0; audio.playStep(); }
      }
      if (player.inWater && !prevInWater) audio.playSplash();
      prevInWater = player.inWater;

      world.update(player.pos.x, player.pos.z);
      camera.getWorldDirection(camDir);
      hit = world.raycast(camera.position.x, camera.position.y, camera.position.z,
        camDir.x, camDir.y, camDir.z, 5);
      if (hit) {
        highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        highlight.visible = true;
      } else highlight.visible = false;
    }

    sky.update(dt);
    particles.update(dt);

    if (ui.debugVisible && player && world) {
      const hh = Math.floor(sky.hours), mm = String(Math.floor((sky.hours % 1) * 60)).padStart(2, '0');
      const bio = world.getBiome(Math.floor(player.pos.x), Math.floor(player.pos.z));
      const bh = world.getHeight(Math.floor(player.pos.x), Math.floor(player.pos.z));
      let biomeName = bh < window.Blocks.SEA ? '海洋' : (bio.desert ? '沙漠' : (bio.snowy ? '雪原' : (bio.moisture > 0.45 ? '森林' : '平原')));
      let facing = '南';
      const fw = camDir;
      if (Math.abs(fw.x) > Math.abs(fw.z)) facing = fw.x > 0 ? '东' : '西';
      else if (Math.abs(fw.z) > 0.01) facing = fw.z > 0 ? '南' : '北';
      ui.updateDebug(
        'MCZPI  ' + fpsVal + ' fps\n' +
        'XYZ: ' + player.pos.x.toFixed(2) + ' / ' + player.pos.y.toFixed(2) + ' / ' + player.pos.z.toFixed(2) + '\n' +
        '区块: ' + (player.pos.x / 16 >> 0) + ' ' + (player.pos.z / 16 >> 0) + '  朝向: ' + facing + '\n' +
        '群系: ' + biomeName + '  种子: ' + world.seed + '\n' +
        '时间: ' + String(hh).padStart(2, '0') + ':' + mm + '\n' +
        '区块: ' + world.loadedCount() + '  三角形: ' + renderer.info.render.triangles + '\n' +
        '模式: ' + (player.fly ? '创造(飞行)' : '生存') + '  声音: ' + (audio.muted ? '关' : '开')
      );
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  setInterval(() => { if (playing) saveGame(); }, 25000);
  window.addEventListener('beforeunload', saveGame);

  // 调试暴露
  window.__mczpi = { scene, world: () => world, player: () => player, sky: () => sky };
  window.__scene = scene;
  window.__setPaused = (v) => { paused = !!v; ui.hidePause(); };
  window.__debugStart = (seed) => startGame(seed);
  // 像素射线探针（渲染取证用）：输入屏幕像素坐标，返回该像素射线的命中信息
  window.__probe = (sx, sy) => {
    if (!world || !player) return null;
    const ndcX = (sx / window.innerWidth) * 2 - 1;
    const ndcY = -(sy / window.innerHeight) * 2 + 1;
    const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const hit = world.raycast(camera.position.x, camera.position.y, camera.position.z, dir.x, dir.y, dir.z, 300);
    if (!hit) return { hit: null, dir: [dir.x, dir.y, dir.z] };
    const b = world.getBlock(hit.x, hit.y, hit.z);
    return { hit: [hit.x, hit.y, hit.z], face: hit.face, dist: +hit.t.toFixed(1), block: b, name: window.Blocks.DEFS[b].name, dir: [dir.x, dir.y, dir.z], unproj: [v.x, v.y, v.z] };
  };
  window.__blockAt = (x, y, z) => {
    const b = world ? world.getBlock(x, y, z) : -1;
    return { id: b, name: b >= 0 ? window.Blocks.DEFS[b].name : 'none' };
  };

  // 演示模式自动启动
  if (demo) {
    const s = seedParam !== null ? (Number(seedParam) >>> 0) : (save ? save.seed : 12345);
    startGame(s);
  }
  requestAnimationFrame(loop);
})();
