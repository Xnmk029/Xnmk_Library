// ============ AIM FORGE 应用主逻辑 ============
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const CFG = window.AF_CONFIG;
    const RANGE = window.AF_RANGE;

    // ---------- 元素 ----------
    const canvas = $('game');
    const overlay = $('aimOverlay');
    const engine = new AimEngine(canvas, overlay);
    engine.setPointer(0.5, 0.5);

    // 状态
    const state = {
        game: 'cs',
        mode: 'grid',
        running: false,
        sens: 1.0,           // 鼠标基准
        inSens: 1.0,         // 游戏内灵敏度
        fov: 103,
        targetSize: 48,
        ttk: 1200,           // 过杀时间
        maxKills: 80,
        hitFx: true,
        dynCross: true,
        colorT: false,
        ballModel: true,

        shot: 0,
        hit: 0,
        kills: 0,
        bestStreak: 0,
        streak: 0,
        startTime: 0,
        lastShot: 0,
        lastSpawn: 0,
        flicks: [],
    };

    // 合成灵敏度（滚轮可调）：跨越倍数，用于把鼠标位移换算成准星位移
    let effScale = 1.0;

    // 准星像素坐标（由鼠标增量 * 有效灵敏度 累积得出）
    let crossPosX = window.innerWidth / 2, crossPosY = window.innerHeight / 2;
    // 平滑目标的当前像素（仅用于显示/命中）
    let curX = crossPosX, curY = crossPosY;

    // ================= 工具 =================
    function effSens() { return state.sens * state.inSens * effScale; }

    function getRange(id) {
        const el = $(id);
        const cfg = RANGE[id];
        return {
            el, val: parseFloat(el.value),
            update: () => { el.min = cfg.min; el.max = cfg.max; el.step = cfg.step; el.value = cfg.value; $('' + id + 'V').textContent = cfg.value; },
            emit: () => { $('' + id + 'V').textContent = el.value; },
        };
    }

    // ================= 游戏预设应用 =================
    function applyGame(game, resetSens = false) {
        const g = CFG.games[game];
        state.game = game;
        state.fov = g.fov;
        state.inSens = g.inSens;

        // 更新 FOV + 游戏内灵敏度滑块与显示
        $('fov').value = g.fov; $('fovV').textContent = g.fov;
        $('inSens').value = g.inSens; $('inSensV').textContent = g.inSens;
        engine.fov = g.fov;

        // 更新选中的 chip
        document.querySelectorAll('#gameGroup .mode-chip').forEach((chip) => {
            chip.classList.toggle('active', chip.dataset.game === game);
        });

        // 同步灵敏度显示
        updateEffDisplay();
    }

    function applyMode(mode) {
        const m = CFG.modes[mode];
        state.mode = mode;
        state.targetSize = m.targetSize;
        state.ttk = m.ttk;
        state.maxKills = m.maxKills;

        // 同步滑块与数值
        $('targetSize').value = m.targetSize; $('targetSizeV').textContent = m.targetSize;
        $('ttk').value = m.ttk; $('ttkV').textContent = m.ttk;
        $('maxKills').value = m.maxKills; $('maxKillsV').textContent = m.maxKills;

        engine.spawnType = mode;

        document.querySelectorAll('#modeBar [data-mode]').forEach((chip) => {
            chip.classList.toggle('active', chip.dataset.mode === mode);
        });
    }

    function updateEffDisplay() {
        $('effSens').textContent = effSens().toFixed(3);
    }

    // ================= 训练开始/结束 =================
    function startTraining() {
        state.shot = 0; state.hit = 0; state.kills = 0;
        state.streak = 0; state.bestStreak = 0;
        state.startTime = performance.now();
        state.running = true;
        state.lastSpawn = 0;
        state.flicks = [];

        engine.reset();
        applyMode(state.mode);
        applyGame(state.game);

        // 把 engine 参数同步
        engine.targetSize = state.targetSize;
        engine.hitFx = state.hitFx;
        engine.ballModel = state.ballModel;
        engine.colorTargets = state.colorT;
        engine.dynamicCrosshair = state.dynCross;
        engine.aimSens = effSens();

        $('summary').classList.add('hidden');
        overlay.innerHTML = '';

        // 初始出球
        for (let i = 0; i < preSpawnCount(); i++) engine.spawnBall();

        engine.begin();
        updateLive();
    }

    function preSpawnCount() {
        switch (state.mode) {
            case 'grid': case 'zen': return 1;
            case 'flick': return 2;
            case 'track': case 'sw': return 3;
        }
        return 1;
    }

    function endTraining() {
        state.running = false;
        engine.stop();
        showSummary();
    }

    function showSummary() {
        const dt = (performance.now() - state.startTime) / 1000;
        $('sumAim').textContent = state.shot > 0 ? (state.hit / state.shot * 100).toFixed(1) + '%' : '--';
        $('sumHit').textContent = state.hit;
        $('sumShot').textContent = state.shot;
        $('sumKill').textContent = state.kills;
        $('sumBest').textContent = state.bestStreak;
        $('sumTime').textContent = dt.toFixed(1);
        $('summary').classList.remove('hidden');
        overlay.innerHTML = '训练结束';
    }

    // 检查胜利条件
    function checkKills() {
        if (state.kills >= state.maxKills) endTraining();
    }

    // ================= 射击 =================
    function shoot() {
        if (!state.running) return;
        const now = performance.now();
        const px = curX, py = curY;

        state.shot++;
        state.lastShot = now;

        // 命中判定
        const ball = engine.hitTest(px, py);
        if (ball) {
            state.hit++;
            state.kills++;
            state.streak++;
            if (state.streak > state.bestStreak) state.bestStreak = state.streak;
            engine.kill(ball);
            addFlick(now);
            spawnMaintain();
        } else {
            state.streak = 0;
            // 未命中抖动
            muzzle(px, py);
        }

        // 武器后坐模拟（动态准星）
        engine._recoil = 1;
        setTimeout(() => { engine._recoil = 0; }, 120);

        updateLive();
        checkKills();
    }

    function muzzle(x, y) {
        // 简单miss提示粒子
        const p = { x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.2, r: 4, color: '#ff7a6b' };
        engine.particles.push(p);
    }

    // 维护小球数量
    function spawnMaintain() {
        const m = state.mode;
        const target = preSpawnCount();
        const alive = engine.balls.filter((b) => !b.expired).length;
        for (let i = alive; i < target; i++) engine.spawnBall();
    }

    // 记录 flick 时间用于急停高玩统计（简化：不展示）
    function addFlick(t) {
        if (state.flicks.length < 30) state.flicks.push(t);
    }

    // 追踪/小微动时需要持续的漂移球补充；急停定时瞬移
    function tick(target) {
        if (!state.running) return;
        const now = performance.now();
        const dt = (now - target) / 1000;

        // 定期补充（追踪移除慢点）
        if (state.mode === 'track' || state.mode === 'sw') {
            spawnMaintain();
        }
        // flick 模式：定期让小球瞬移到新位置
        if (state.mode === 'flick' && now - (state.lastFlick || 0) > 600) {
            state.lastFlick = now;
            for (const b of engine.balls) {
                if (b.expired) continue;
                const pt = engine._pickSpawnPoint();
                b.x = pt.x; b.y = pt.y; b.homeX = pt.x; b.homeY = pt.y;
            }
        }
        // 小微型保持漂移
        if (state.mode === 'sw') {
            // 微调出生点 —— 已由 engine 处理 home 抖动
        }
    }

    // ================= 实时UI =================
    function updateLive() {
        $('liveAim').textContent = state.shot > 0 ? (state.hit / state.shot * 100).toFixed(1) + '%' : '--';
        $('liveShot').textContent = state.shot;
        $('liveHit').textContent = state.hit;
        $('liveKill').textContent = state.kills;
        updateEffDisplay();
    }

    // ================= 鼠标输入 =================
    // 使用增量移动 + 有效灵敏度换算，使“手感”参数真实起作用。
    // 若浏览器支持 Pointer Lock，则锁定鼠标以支持快速甩枪；
    // 否则回退到跟随鼠标移动（此时灵敏度仅影响显示指标）。
    let locked = false;
    function tryLock() {
        try {
            const p = canvas.requestPointerLock && canvas.requestPointerLock();
            if (p && p.catch) p.catch(() => {});
        } catch (e) {}
        return false; // 异步判断，见 lockchange
    }

    function unlock() {
        if (document.pointerLockElement === canvas) document.exitPointerLock();
    }

    function onLockChange() {
        locked = document.pointerLockElement === canvas;
    }

    function onMouseMove(e) {
        if (locked) {
            crossPosX += e.movementX * effSens();
            crossPosY += e.movementY * effSens();
        } else {
            crossPosX = e.clientX;
            crossPosY = e.clientY;
        }
        clampCross();
        engine.crossX = curX;
        engine.crossY = curY;
    }

    function clampCross() {
        crossPosX = Math.max(0, Math.min(window.innerWidth, crossPosX));
        crossPosY = Math.max(0, Math.min(window.innerHeight, crossPosY));
        // 平滑当前准星位置（避免指针锁定下跳变）
        curX = crossPosX;
        curY = crossPosY;
    }

    function onMouseDown(e) {
        if (e.button === 0) {
            shoot();
        } else if (e.button === 2) {
            tryLock();
        }
    }

    function onWheel(e) {
        e.preventDefault();
        const dir = e.deltaY > 0 ? -1 : 1;
        effScale = Math.min(3, Math.max(0.2, effScale + dir * 0.05));
        updateEffDisplay();
    }

    // ================= 主帧循环（业务逻辑） =================
    let lastRaf = 0;
    function mainLoop(t) {
        const dt = lastRaf ? (t - lastRaf) : 0;
        lastRaf = t;
        tick(t);
        requestAnimationFrame(mainLoop);
    }
    requestAnimationFrame(mainLoop);

    // ================= 事件绑定 =================
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });
    document.addEventListener('dblclick', () => { tryLock(); });

    // 模式/游戏
    document.querySelectorAll('#gameGroup .mode-chip').forEach((chip) => {
        chip.addEventListener('click', () => { applyGame(chip.dataset.game, true); });
    });
    document.getElementById('modeBar').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-mode]');
        if (!chip) return;
        applyMode(chip.dataset.mode);
        if (state.running) restart();
    });

    document.getElementById('btnStart').addEventListener('click', () => {
        if (state.running) restart();
        else startTraining();
    });
    document.getElementById('btnReset').addEventListener('click', () => { restart(); });
    document.getElementById('btnReplay').addEventListener('click', () => { startTraining(); });
    document.getElementById('btnBack').addEventListener('click', () => { $('summary').classList.add('hidden'); engine.reset(); });

    function restart() {
        engine.stop();
        state.running = false;
        startTraining();
    }

    // ================= 设置面板 =================
    function bindSlider(id, cb, extra) {
        const el = $(id);
        const on = () => { $('' + id + 'V').textContent = el.value; cb(parseFloat(el.value)); };
        el.addEventListener('input', on);
        return on;
    }
    function bindCheck(id, cb) {
        const el = $(id);
        el.addEventListener('change', () => cb(el.checked));
    }

    window.addEventListener('DOMContentLoaded', init);

    function initPanelSync() {
        // 把当前状态写入面板
        $('sens').value = state.sens; $('sensV').textContent = state.sens;
        $('inSens').value = state.inSens; $('inSensV').textContent = state.inSens;
        $('fov').value = state.fov; $('fovV').textContent = state.fov;
        $('targetSize').value = state.targetSize; $('targetSizeV').textContent = state.targetSize;
        $('ttk').value = state.ttk; $('ttkV').textContent = state.ttk;
        $('maxKills').value = state.maxKills; $('maxKillsV').textContent = state.maxKills;
        $('dynCross').checked = state.dynCross;
        $('hitFx').checked = state.hitFx;
        $('ballModel').checked = state.ballModel;
        $('colorT').checked = state.colorT;
    }

    function init() {
        // 面板打开
        $('btnSettings').addEventListener('click', () => { initPanelSync(); $('panel').classList.remove('hidden'); });
        $('closePanel').addEventListener('click', closePanel);
        $('saveSettings').addEventListener('click', saveSettings);
        $('btnHelp').addEventListener('click', () => { $('help').classList.remove('hidden'); });
        $('closeHelp').addEventListener('click', () => { $('help').classList.add('hidden'); });

        bindSlider('sens', (v) => { state.sens = v; updateEffDisplay(); });
        bindSlider('inSens', (v) => { state.inSens = v; updateEffDisplay(); });
        bindSlider('fov', (v) => { state.fov = v; engine.fov = v; });
        bindSlider('targetSize', (v) => { state.targetSize = v; engine.targetSize = v; });
        bindSlider('ttk', (v) => { state.ttk = v; });
        bindSlider('maxKills', (v) => { state.maxKills = v; });
        bindCheck('dynCross', (v) => { state.dynCross = v; engine.dynamicCrosshair = v; });
        bindCheck('hitFx', (v) => { state.hitFx = v; engine.hitFx = v; });
        bindCheck('ballModel', (v) => { state.ballModel = v; engine.ballModel = v; });
        bindCheck('colorT', (v) => { state.colorT = v; engine.colorTargets = v; });

        // 键盘微调灵敏度
        window.addEventListener('keydown', (e) => {
            if (e.key === ']') { effScale = Math.min(3, effScale + 0.05); updateEffDisplay(); }
            if (e.key === '[') { effScale = Math.max(0.2, effScale - 0.05); updateEffDisplay(); }
        });

        // 初始应用
        applyGame('cs');
        applyMode('grid');
        updateEffDisplay();

        // 启动画布循环
        engine.begin();

        // 隐藏 boot
        setTimeout(() => { $('boot').classList.add('done'); }, 600);
    }

    function closePanel() { $('panel').classList.add('hidden'); }
    function saveSettings() {
        closePanel();
        if (state.running) restart();
        else { engine.targetSize = state.targetSize; }
    }

    // 如果 DOM 已加载则直接 init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();