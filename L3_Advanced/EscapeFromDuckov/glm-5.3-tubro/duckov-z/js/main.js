/* DUCKOV Z - 主循环：状态机/输入/昼夜天气/事件/撤离 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U;
  const M = { S: null, mode: 'title', cam: { x: 0, y: 0, scale: C.SCALE_DEF }, input: {}, lastT: 0, saveT: 0, fps: 0 };
  const $ = id => document.getElementById(id);

  M.init = function () {
    M.cv = $('game');
    M.ctx = M.cv.getContext('2d');
    DZ.RD.init();
    DZ.UIH.init();
    bindInput();
    window.addEventListener('resize', resize);
    resize();
    DZ.UI.hooks = {
      newGame: prof => M.newGame(prof),
      continueGame: () => M.continueGame(),
      toTitle: () => M.toTitle(),
      save: () => M.saveGame(),
      hasSave: () => DZ.SAVE.exists(),
      inGame: () => M.mode === 'play' || M.mode === 'sleep',
      freeplay: () => M.freeplay()
    };
    DZ.UI.showTitle();
    requestAnimationFrame(loop);
  };

  function resize() {
    if (!M.cv) return;
    M.cv.width = window.innerWidth;
    M.cv.height = window.innerHeight;
  }

  // ---------- 开局 ----------
  M.newGame = function (profId) {
    DZ.SAVE.clear();
    startRun(DZ.W.gen((Math.random() * 1e9) | 0), profId);
  };
  M.continueGame = function () {
    const S = DZ.SAVE.load();
    if (!S) { DZ.UI.showTitle(); return; }
    startRun(S, S.player.prof, true);
  };
  function startRun(S, profId, loaded) {
    M.S = S;
    S.input = M.input;
    if (!loaded) {
      S.player = DZ.P.create(S, profId);
      DZ.Z.seedAll ? null : seedZombiesSafe(S);
    }
    S.radioLog = S.radioLog || [];
    DZ.RM.prerender(S);
    DZ.RD.buildMini(S);
    M.cam.x = S.player.x; M.cam.y = S.player.y; M.cam.scale = C.SCALE_DEF;
    M.mode = 'play';
    showHud(true);
    DZ.UI.closeAll();
    DZ.audio.resume(); DZ.audio.startAmbience();
    if (!loaded) queueRadioScript(S);
    else DZ.UIH.toast('欢迎回到鸭鸣镇。');
    M.saveT = C.AUTOSAVE_SEC;
  }
  function seedZombiesSafe(S) {
    // player 已创建 → 安全圈可用
    const entries = Object.entries(C.ZOMBIE.types);
    let tries = 0;
    while (S.zombies.length < C.Z_COUNT && tries++ < 5000) {
      const tx = U.range(3, C.MW - 4), ty = U.range(3, C.MH - 4);
      const tile = DZ.W.tget(S, tx, ty);
      const indoor = S.room[ty * C.MW + tx] >= 0;
      if (DZ.W.SOLID.has(tile) || tile === DZ.W.T.DOOR || tile === DZ.W.T.WIN) continue;
      const px = (tx + 0.5) * C.TILE, py = (ty + 0.5) * C.TILE;
      if (U.dist(px, py, S.home.x, S.home.y) < 300 && !indoor) continue;
      const walkableOut = [0, 1, 2, 3, 6, 7, 8].includes(tile);
      if (!indoor && !walkableOut) continue;
      const type = U.wpick(entries.map(e => [e[0], e[1].w]));
      DZ.Z.spawn(S, px, py, type, indoor && Math.random() < 0.7);
    }
  }
  M.toTitle = function () {
    M.mode = 'title'; M.S = null;
    showHud(false);
    DZ.UI.closeAll();
    DZ.UI.showTitle();
  };
  M.freeplay = function () { M.mode = 'play'; M.S.evacOpen = false; M.S.flags.freeplay = true; DZ.UIH.radioBanner('自由生存模式', '直升机走了。现在，这里只有你和它们。'); };

  function showHud(on) { $('hud').style.display = on ? '' : 'none'; }

  // ---------- 广播脚本 ----------
  function queueRadioScript(S) {
    S.flags.radioStep = 0;
  }
  function radioTick(S) {
    const step = S.flags.radioStep || 0;
    const t = S.totalMins;
    const script = [
      [9.5 * 60, '📻 应急广播', '幸存者们…军队已在城东学校操场设立撤离点。保持隐蔽，保存体力。'],
      [10 * 60, '📻 生存提示', '按 E 搜刮家具与容器。绷带止血，夹板接骨。被咬的人……别犹豫。'],
      [12 * 60, '📻 撤离通告', '第7天正午，直升机将在学校操场降落。它只带得走有燃料的鸭子——准备3桶汽油。'],
      [(24 + 11.5) * 60, '⚡ 电力公告', '电网过载崩溃，全城停电。冰箱里的东西……且吃且珍惜。'],
      [(24 + 13) * 60, '📻 老杰夫', '我是杰夫…如果你在我家，苹果在冰箱第二层。替我吃掉它。'],
      [(2 * 24 + 7.5) * 60, '💧 水务公告', '泵站完全失压。从现在起收集雨水，或者祈祷瓶装水还没喝完。'],
      [(3 * 24 + 21) * 60, '⚠ 气象警报', '今夜动物行为异常——建议锁好门窗，钉死木板。它们成群了。'],
      [(5 * 24 + 9) * 60, '📻 军方频道', '撤离行动如期进行。重复：第7天正午，学校操场。带燃料。愿好运眷顾鸭子。'],
      [(6 * 24 + 20) * 60, '📻 最后广播', '明天正午。学校。别迟到。这是我们最后的通话。']
    ];
    if (step < script.length && t >= script[step][0]) {
      DZ.UIH.radioBanner(script[step][1], script[step][2]);
      S.radioLog.push({ t: 'D' + S.day + ' ' + U.fmtTime(S.mins), txt: script[step][1] + ' ' + script[step][2] });
      S.flags.radioStep = step + 1;
    }
  }

  // ---------- 输入 ----------
  function bindInput() {
    const keys = {};
    M.keys = keys;
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      keys[k] = true;
      handleKey(k, e);
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    M.cv.addEventListener('contextmenu', e => e.preventDefault());
    M.mouse = { x: innerWidth / 2, y: innerHeight / 2, lmb: false, rmb: false, onUI: false };
    window.addEventListener('mousemove', e => {
      M.mouse.x = e.clientX; M.mouse.y = e.clientY;
      M.mouse.onUI = !!(e.target.closest && e.target.closest('#hud .clickable, #panels'));
    });
    M.cv.addEventListener('mousedown', e => {
      DZ.audio.resume();
      if (e.button === 0) { M.mouse.lmb = true; attackPress(); }
      if (e.button === 2) M.mouse.rmb = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) M.mouse.lmb = false;
      if (e.button === 2) M.mouse.rmb = false;
    });
    M.cv.addEventListener('wheel', e => {
      e.preventDefault();
      M.cam.scale = U.clamp(M.cam.scale * (e.deltaY > 0 ? 0.92 : 1.08), C.SCALE_MIN, C.SCALE_MAX);
    }, { passive: false });
  }
  function handleKey(k, e) {
    if (M.mode !== 'play' && M.mode !== 'sleep') return;
    const pl = M.S.player;
    if (k === 'tab') { e.preventDefault(); DZ.UI.toggleInv(); return; }
    if (k === 'escape') {
      if (DZ.UI.dlgOpen) { /* 对话框交给其按钮 */ }
      else if (DZ.UI.open) DZ.UI.closeAll();
      else DZ.UI.showPause();
      return;
    }
    if (DZ.UI.anyOpen()) return;
    switch (k) {
      case 'e': interactPress(); break;
      case 'r': DZ.P.beginReload(pl); break;
      case 'f': toggleFlashlight(pl); break;
      case 'n': toggleNV(pl); break;
      case 'c': pl.crouch = !pl.crouch; break;
      case 'v': tryRoll(pl); break;
      case ' ': e.preventDefault(); spacePress(pl); break;
      case 'm': DZ.UI.showBigMap(); break;
      case 'j': DZ.UI.showRadioLog(); break;
    }
  }
  function toggleFlashlight(pl) {
    const fl = pl.inv.find(i => i.id === 'flashlight');
    if (!fl) { DZ.UI.toast('你没有手电（仓库/文具店抽屉里找找）'); return; }
    if (fl.batt <= 0) { DZ.UI.toast('手电没电了，需要干电池？——不，本作里换电池会自动续上，去找电池吧'); return; }
    pl.flashlight = !pl.flashlight;
  }
  function toggleNV(pl) {
    const nv = pl.inv.find(i => i.id === 'nv');
    if (!nv) { DZ.UI.toast('需要夜视仪（军用物资箱里有概率出现）'); return; }
    pl.nv = !pl.nv;
  }
  function tryRoll(pl) {
    if (pl.rolling > 0 || pl.grabbedBy || pl.stamina < C.STAMINA.rollCost) return;
    const mv = moveVec();
    let a = Math.atan2(mv.my, mv.mx);
    if (!mv.mx && !mv.my) a = pl.a;
    pl.rollA = a;
    pl.rolling = 0.28;
    pl.stamina -= C.STAMINA.rollCost;
    DZ.audio.playRaw('roll');
  }
  function spacePress(pl) {
    // 挣扎 or 推开
    if (pl.grabbedBy) {
      pl.struggle += 34 + Math.random() * 20;
      DZ.audio.playRaw('shove', pl.x, pl.y);
      if (pl.struggle >= 100) {
        const z = pl.grabbedBy;
        z.staggerT = 1.1;
        const ka = Math.atan2(z.y - pl.y, z.x - pl.x);
        const solid = DZ.W.solidFn(M.S);
        const [nx, ny] = U.moveCircle(z.x, z.y, Math.cos(ka) * 26, Math.sin(ka) * 26, 0.32 * z.scale * C.TILE, solid);
        z.x = nx; z.y = ny;
        pl.grabbedBy = null;
        DZ.UI.toast('挣脱了！');
      }
      return;
    }
    // 前方推开
    const fx = pl.x + Math.cos(pl.a) * C.TILE * 0.9, fy = pl.y + Math.sin(pl.a) * C.TILE * 0.9;
    for (const z of M.S.zombies) {
      if (z.dead) continue;
      if (U.dist(z.x, z.y, fx, fy) < C.TILE * 0.9) {
        z.staggerT = 0.8;
        const ka = Math.atan2(z.y - pl.y, z.x - pl.x);
        const solid = DZ.W.solidFn(M.S);
        const [nx, ny] = U.moveCircle(z.x, z.y, Math.cos(ka) * 18, Math.sin(ka) * 18, 0.32 * z.scale * C.TILE, solid);
        z.x = nx; z.y = ny;
        pl.stamina -= 6;
        DZ.audio.play('shove', pl.x, pl.y);
        return;
      }
    }
  }
  function attackPress() {
    if (M.mode !== 'play' || DZ.UI.anyOpen()) return;
    const pl = M.S.player;
    if (pl.dead) return;
    // 手持燃烧瓶 → 投掷
    if (pl.lastThrowMode) { /* 由 UI 切换，暂略 */ }
    if (pl.slots.primary && !pl.slots.meleeOnlySwing) {
      if (!DZ.CB.fireGun(M.S, pl)) {
        // 枪打不了（装填中）→ 尝试近战
        if (pl.fireT <= 0 && pl.reloadT <= 0 && pl.slots.melee) DZ.CB.swingMelee(M.S, pl);
      }
    } else DZ.CB.swingMelee(M.S, pl);
  }
  function interactPress() {
    const acts = DZ.P.getInteracts(M.S, M.S.player);
    if (!acts.length) return;
    if (acts.length === 1 || acts[0].prio >= 9) DZ.P.doInteract(M.S, M.S.player, acts[0]);
    else DZ.UI.choiceDialog('互动', acts.slice(0, 5).map(a => ({ id: String(acts.indexOf(a)), label: a.label })), sel => DZ.P.doInteract(M.S, M.S.player, acts[+sel]));
  }
  function moveVec() {
    const k = M.keys;
    let mx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    let my = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
    return { mx, my };
  }

  // ---------- 撤离 ----------
  M.tryEvac = function () {
    const S = M.S, pl = S.player;
    if (S.flags.freeplay) { DZ.UI.toast('直升机早就走了。'); return; }
    if (!S.evacOpen) { DZ.UI.toast(`撤离窗口未开启：第${C.EVAC_DAY}天正午开放`); return; }
    const fuel = DZ.P.count(pl, 'gascanF');
    if (fuel < C.EVAC_FUEL_NEEDED) { DZ.UI.toast(`燃油不足 ${fuel}/${C.EVAC_FUEL_NEEDED} 桶`); return; }
    DZ.audio.playRaw('heli');
    DZ.UI.showWin(true);
    M.mode = 'win';
  };

  // ---------- 主循环 ----------
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - M.lastT) / 1000 || 0.016);
    M.lastT = ts;
    M.fps = M.fps * 0.95 + (1 / dt) * 0.05;
    const ctx = M.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, M.cv.width, M.cv.height);
    if (M.mode === 'title') { drawTitleBg(ctx, ts / 1000); return; }
    const S = M.S;
    if (!S) return;

    if (M.mode === 'sleep') {
      DZ.P.updateSleep(S, S.player, dt);
      DZ.FX.update(dt * C.SLEEP_SPEED);
      if (!S.sleeping) M.mode = 'play';
    } else if (M.mode === 'play') {
      gameTick(S, dt);
    }
    render(S, dt);
  }

  function gameTick(S, dt) {
    const pl = S.player;
    if (pl.dead) { onDeath(); return; }
    const iv = moveVec();
    const worldMouse = screenToWorld(M.mouse.x, M.mouse.y);
    Object.assign(M.input, iv, { aimX: worldMouse.x, aimY: worldMouse.y, rmb: M.mouse.rmb, crouch: pl.crouch });
    pl.wantRun = !!M.keys['shift'];
    DZ.P.update(S, pl, dt, M.input);
    // 左键持续开火
    if (M.mouse.lmb && !DZ.UI.anyOpen()) attackHold();
    // 僵尸
    for (const z of S.zombies) {
      if (!z.dead) DZ.Z.update(S, z, dt, pl);
    }
    // 清理 & 尸潮
    if (S.zombies.length && S.zombies.filter(z => !z.dead).length < C.Z_COUNT * 0.35 && Math.random() < dt * 0.02) trickleSpawn(S);
    hordeEvent(S, dt);
    // 火焰
    DZ.CB.tickFires(S, dt, dt / C.RSPM);
    // 特效与噪音衰减
    DZ.FX.update(dt);
    for (let i = S.noises.length - 1; i >= 0; i--) { S.noises[i].t -= dt; if (S.noises[i].t <= 0) S.noises.splice(i, 1); }
    for (let i = S.heat.length - 1; i >= 0; i--) { S.heat[i].t -= dt / C.RSPM; if (S.heat[i].t <= 0) S.heat.splice(i, 1); }
    // 时间
    advanceTime(S, dt / C.RSPM);
    radioTick(S);
    // 相机
    M.cam.x += (pl.x + Math.cos(pl.a) * 30 - M.cam.x) * Math.min(1, dt * 5);
    M.cam.y += (pl.y + Math.sin(pl.a) * 30 - M.cam.y) * Math.min(1, dt * 5);
    // 交互提示
    const acts = DZ.P.getInteracts(S, pl);
    S.curInteract = acts[0] || null;
    // 容器距离检查
    DZ.UI.tickContainerDist(S);
    // 音频监听
    DZ.audio.setCam(M.cam.x, M.cam.y, M.cam.scale);
    DZ.audio.tick(dt, S);
    const danger = zombieDanger(S, pl);
    DZ.audio.heartbeat(dt, danger);
    // 自动存档
    M.saveT -= dt;
    if (M.saveT <= 0) { M.saveT = C.AUTOSAVE_SEC; M.saveGame(); }
  }
  function attackHold() {
    const pl = M.S.player;
    const gI = pl.slots.primary;
    if (gI && pl.fireT <= 0 && pl.reloadT <= 0 && pl.swingT <= 0) DZ.CB.fireGun(M.S, pl);
  }
  function zombieDanger(S, pl) {
    let close = 0;
    for (const z of S.zombies) {
      if (z.dead) continue;
      const d = U.dist(z.x, z.y, pl.x, pl.y);
      if (d < C.TILE * 7 && (z.state === 'chase' || z.state === 'investigate')) close++;
    }
    const hpCrit = Math.min(...Object.values(pl.body).map(b => Math.max(0, b.hp))) < 22 ? 0.35 : 0;
    return U.clamp(close * 0.28 + hpCrit + (pl.grabbedBy ? 0.5 : 0), 0, 1);
  }
  function trickleSpawn(S) {
    // 远处补充游荡者
    for (let t = 0; t < 40; t++) {
      const tx = U.range(3, C.MW - 4), ty = U.range(3, C.MH - 4);
      const px = (tx + .5) * C.TILE, py = (ty + .5) * C.TILE;
      const d = U.dist(px, py, S.player.x, S.player.y);
      if (d < 26 * C.TILE || d > 55 * C.TILE) continue;
      const tile = DZ.W.tget(S, tx, ty);
      if ([0, 1, 2, 3, 6, 7, 8].includes(tile)) { DZ.Z.spawn(S, px, py, U.wpick([['walker', 5], ['shambler', 3], ['jogger', 1]])); return; }
    }
  }
  function hordeEvent(S, dt) {
    if (S.flags.freeplay) return;
    if (!S.hordeActive) {
      if (S.day >= 3 && U.isNight(S.mins) && !S.flags['horde_d' + S.day] && Math.random() < dt * 0.008) {
        S.flags['horde_d' + S.day] = true;
        S.hordeActive = 15;
        DZ.UIH.radioBanner('🚨 尖啸划破夜空', '远处的尸群被惊动了——它们朝这边来了。');
        DZ.audio.playRaw('siren');
      }
    } else {
      S.hordeSpawnT = (S.hordeSpawnT || 0) - dt;
      if (S.hordeSpawnT <= 0 && S.hordeActive > 0) {
        S.hordeSpawnT = 2.5;
        S.hordeActive--;
        const ang = Math.random() * Math.PI * 2;
        const dist = 34 * C.TILE;
        const px = S.player.x + Math.cos(ang) * dist, py = S.player.y + Math.sin(ang) * dist;
        const tx = px / C.TILE | 0, ty = py / C.TILE | 0;
        if (tx > 2 && ty > 2 && tx < C.MW - 2 && ty < C.MH - 2 && ![DZ.W.T.WEXT, DZ.W.T.WINT].includes(DZ.W.tget(S, tx, ty))) {
          const z = DZ.Z.spawn(S, px, py, U.wpick([['walker', 5], ['jogger', 2], ['shambler', 2]]));
          z.state = 'investigate'; z.lastHeard = { x: S.player.x, y: S.player.y };
        }
      }
    }
  }
  function advanceTime(S, gm) {
    S.totalMins += gm;
    const prevDay = S.day;
    S.mins = S.totalMins % 1440;
    S.day = Math.floor(S.totalMins / 1440) + 1;
    S.stats.daysSurvived = S.day;
    if (S.totalMins >= C.POWER_OFF_MIN && S.powerOn) {
      S.powerOn = false;
      DZ.UIH.radioBanner('⚡ 全城停电', '冰箱停了。路灯灭了。油泵成了摆设。');
    }
    if (S.totalMins >= C.WATER_OFF_MIN && S.waterOn) {
      S.waterOn = false;
      DZ.UIH.radioBanner('💧 停水', '水管干了。雨水收集器和瓶装水是最后的水源。');
    }
    if (!S.evacOpen && !S.flags.freeplay && S.day >= C.EVAC_DAY && S.mins >= C.EVAC_HOUR * 60) {
      S.evacOpen = true;
      DZ.UIH.radioBanner('🚁 直升机已就位', `学校操场撤离点开启！携带 ${C.EVAC_FUEL_NEEDED} 桶满油前往！`);
      DZ.audio.playRaw('heli');
    }
    if (S.evacOpen && !S.flags.freeplay && S.day >= C.EVAC_DAY && S.mins >= (C.EVAC_HOUR + C.EVAC_WINDOW_H) * 60) {
      S.evacOpen = false;
      DZ.UIH.radioBanner('🚁 直升机离开', '旋翼声远去……你错过了。也许还有下一班。（继续生存）');
    }
    // 天气机
    S.weather.timer -= gm;
    if (S.weather.timer <= 0) {
      S.weather.timer = U.range(180, 480);
      const roll = Math.random();
      S.weather.cur = roll < 0.38 ? 'clear' : roll < 0.58 ? 'cloudy' : roll < 0.72 ? 'fog' : roll < 0.92 ? 'rain' : 'storm';
      DZ.UIH.toast('天气转为：' + C.WEATHER_NAMES[S.weather.cur]);
    }
    if (prevDay !== S.day) { S.stats.daysSurvived = prevDay; M.saveGame(); }
  }
  function onDeath() {
    if (M.mode === 'dead') return;
    M.mode = 'dead';
    DZ.SAVE.clear();
    setTimeout(() => DZ.UI.showDeath(M.S.player.deadCause), 900);
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - M.cv.width / 2) / M.cam.scale + M.cam.x,
      y: (sy - M.cv.height / 2) / M.cam.scale + M.cam.y
    };
  }

  function render(S, dt) {
    DZ.RD.frame(M.ctx, S, M.cam, dt, M.cv.width, M.cv.height, M.mouse.onUI ? null : M.mouse);
    DZ.UIH.update(S, dt);
    if (M.mode === 'sleep') {
      M.ctx.fillStyle = 'rgba(5,6,10,0.78)';
      M.ctx.fillRect(0, 0, M.cv.width, M.cv.height);
      M.ctx.fillStyle = '#ffb454';
      M.ctx.font = 'bold 22px "Segoe UI","Microsoft YaHei",sans-serif';
      M.ctx.textAlign = 'center';
      M.ctx.fillText('z Z z …  睡梦中', M.cv.width / 2, M.cv.height / 2);
    }
  }
  // 调试钩子：供无头环境同步跑帧
  M.debugTick = function (dt) {
    if (!M.S || M.mode !== 'play') return false;
    gameTick(M.S, dt || 0.033);
    render(M.S, dt || 0.033);
    return true;
  };

  // 标题背景：缓慢漂浮的鸭子剪影
  function drawTitleBg(ctx, ts) {
    const w = M.cv.width, h = M.cv.height;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#141a20'); g.addColorStop(1, '#232b23');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = ((i * 173 + ts * (8 + i % 5 * 3)) % (w + 120)) - 60;
      const y = h * (0.25 + (i * 0.05) % 0.6) + Math.sin(ts * 0.7 + i) * 14;
      ctx.globalAlpha = 0.08;
      DZ.RM.drawDuck(ctx, { x, y, a: 0.2, scale: 1 + (i % 3) * 0.3, zomb: i % 3 === 0, walkPhase: ts * 2 + i });
      ctx.globalAlpha = 1;
    }
  }

  M.saveGame = function () {
    if (!M.S || M.mode === 'title') return false;
    return DZ.SAVE.save(M.S);
  };
  window.addEventListener('keydown', e => { if (e.key === 'F5') { e.preventDefault(); M.saveGame() && DZ.UIH.toast('已手动存档'); } });

  // 自测模式（?selftest=1）：无头跑 600 tick 验证逻辑链路
  M.selftest = function () {
    try {
      const S = DZ.W.gen(12345);
      S.input = {};
      S.player = DZ.P.create(S, 'police');
      seedZombiesSafe(S);
      const pl = S.player;
      let errs = [];
      for (let i = 0; i < 900; i++) {
        const iv = { mx: Math.sin(i * 0.05), my: Math.cos(i * 0.043), aimX: pl.x + 50, aimY: pl.y, rmb: i % 7 === 0 };
        DZ.P.update(S, pl, 0.033, iv);
        for (const z of S.zombies) if (!z.dead) DZ.Z.update(S, z, 0.033, pl);
        if (i % 30 === 0) DZ.CB.fireGun(S, pl);
        if (i % 45 === 0) DZ.CB.swingMelee(S, pl);
        DZ.FX.update(0.033);
        advanceTimeTest(S, 0.066);
        DZ.P.applyDamage(S, pl, 'torso', 0.01, 'hit');
        const poly = DZ.FOV.compute(S, pl.x, pl.y, 10);
        if (!poly.length) errs.push('fov empty at ' + i);
        if (isNaN(pl.x) || isNaN(pl.y)) { errs.push('player NaN at ' + i); break; }
      }
      const conts = S.containers.size, zs = S.zombies.length;
      console.log('[SELFTEST] zombies=' + zs + ' containers=' + conts + ' kills=' + S.stats.kills + ' day=' + S.day + ' errors=' + JSON.stringify(errs));
      document.title = errs.length ? 'SELFTEST-FAIL' : 'SELFTEST-OK';
      const div = document.createElement('div');
      div.id = 'selftestResult';
      div.textContent = document.title + ' zombies=' + zs + ' containers=' + conts + ' errors=' + errs.length;
      document.body.appendChild(div);
    } catch (e) {
      document.title = 'SELFTEST-ERROR';
      console.error(e);
      const div = document.createElement('div');
      div.id = 'selftestResult';
      div.textContent = 'SELFTEST-ERROR ' + e.message;
      document.body.appendChild(div);
    }
  };
  function advanceTimeTest(S, gm) {
    S.totalMins += gm; S.mins = S.totalMins % 1440;
  }

  // 启动
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
  function boot() {
    M.init();
    // 兼容 ?flag 与 #flag 两种传参（file:// 下 # 更可靠）
    const q = (location.search || '') + '#' + (location.hash || '');
    if (q.includes('selftest=1')) setTimeout(() => M.selftest(), 300);
    if (q.includes('shot=1')) {
      // 无头环境可能不驱动 rAF：同步开局并手动跑帧
      try {
        M.newGame('firefighter');
        M.cam.scale = 1.25;
        const night = q.includes('night=1');
        if (night) {
          M.S.mins = 22 * 60; M.S.totalMins = 22 * 60;
          M.S.player.inv.push(DZ.IT.newInst('flashlight'));
          M.S.player.flashlight = true;
        }
        for (let i = 0; i < 45; i++) M.debugTick(0.033);
        document.title = 'SHOT:' + M.mode + ':' + Math.round(M.S.player.x) + ',' + Math.round(M.S.player.y);
      } catch (e) { document.title = 'SHOT-ERR ' + e.message; console.error(e); }
    }
  }
  DZ.main = M;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
