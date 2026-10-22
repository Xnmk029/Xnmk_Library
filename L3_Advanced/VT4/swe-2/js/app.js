/* ============================================================
 * app.js — UI 绑定 / 相机控制 / 主循环
 * ============================================================ */
"use strict";
(function () {
  const M = VT4.M, P = VT4.P;
  const $ = id => document.getElementById(id);

  /* ---------------- 全局状态 ---------------- */
  const S = {
    variant: "base", explode: 0, gunElev: 0, xray: 0,
    clipAxis: "off", clipPos: 0.12, interiorOnly: false,
    sysvis: { hull: true, turret: true, run: true, interior: false, crew: true },
    hlDiff: true,
    rmode: "preview", rscale: 1,
    camMode: "orbit",
    focal: 52, aperture: 8, focus: 9, ev: 0, tonemap: 0,
    env: "noon", dust: 0.55, soft: true, ao: true, fx: true,
    dirty: true,
  };
  const TONEMAP_ID = { aces: 0, agx: 1, reinhard: 2, linear: 3 };

  /* ---------------- 相机 ---------------- */
  const cam = {
    target: [0, 1.15, 0], yaw: M.rad(-142), pitch: M.rad(15), dist: 10.5,
    pos: [0, 2, 8], fYaw: 0, fPitch: 0,
    // 平滑过渡目标
    t: null,
    eye() {
      if (S.camMode === "free") return this.pos.slice();
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      return [
        this.target[0] + this.dist * cp * Math.sin(this.yaw),
        this.target[1] + this.dist * sp,
        this.target[2] + this.dist * cp * Math.cos(this.yaw)];
    },
    fwd() {
      if (S.camMode === "free") {
        const cp = Math.cos(this.fPitch);
        return [cp * Math.sin(this.fYaw), Math.sin(this.fPitch), cp * Math.cos(this.fYaw) * -1];
      }
      return M.norm(M.sub(this.target, this.eye()));
    },
    syncFreeFromOrbit() {
      this.pos = this.eye();
      const f = M.norm(M.sub(this.target, this.pos));
      this.fPitch = Math.asin(M.norm(f)[1]);
      this.fYaw = Math.atan2(f[0], -f[2]);
    },
  };
  function applyView(v) {
    // v: {eye?, target, dist?} → 转入轨道参数
    const presets = {
      front45: { yaw: M.rad(-142), pitch: M.rad(15), dist: 10.5, target: [0, 1.15, 0] },
      side:    { yaw: M.rad(-90),  pitch: M.rad(6),  dist: 9.5,  target: [0, 1.1, 0] },
      rear:    { yaw: M.rad(2),    pitch: M.rad(13), dist: 9.5,  target: [0, 1.1, 0] },
      top:     { yaw: M.rad(-140), pitch: M.rad(80), dist: 12,   target: [0, 0.8, 0] },
      bow:     { yaw: M.rad(-158), pitch: M.rad(9),  dist: 5.4,  target: [0, 1.05, -2.7] },
      turret:  { yaw: M.rad(-148), pitch: M.rad(20), dist: 5.8,  target: [0, 2.0, -0.45] },
      drv:     { yaw: M.rad(-30), pitch: M.rad(35), dist: 3.2,  target: [0, 0.95, -2.2] },
      fight:   { yaw: M.rad(125), pitch: M.rad(38), dist: 4.2,  target: [0, 1.15, -0.4] },
      eng:     { yaw: M.rad(160), pitch: M.rad(32), dist: 4.6,  target: [0, 1.0, 2.4] },
      autoloader: { yaw: M.rad(115), pitch: M.rad(60), dist: 3.2, target: [0, 0.72, -0.45] },
      cmd:     { yaw: M.rad(20),  pitch: M.rad(26), dist: 2.6,  target: [0.58, 1.55, -0.1] },
      gunner:  { yaw: M.rad(-140), pitch: M.rad(26), dist: 2.6, target: [-0.52, 1.4, -0.8] },
    };
    const p = presets[v]; if (!p) return;
    cam.t = { ...cam }; // from
    cam.t0 = performance.now();
    cam.tTo = p;
    if (["drv", "fight", "eng", "autoloader", "cmd", "gunner"].includes(v)) {
      if (S.xray < 0.5) { S.xray = 0.8; $("xray").value = 0.8; $("xray-v").textContent = "80%"; }
      S.sysvis.interior = true; document.querySelector('.sysvis[data-k="interior"]').checked = true;
      updateParts();
    }
  }
  function camTick(now) {
    if (!cam.t) return;
    const k = Math.min((now - cam.t0) / 500, 1);
    const e = 1 - Math.pow(1 - k, 3);
    for (const key of ["yaw", "pitch", "dist"]) cam[key] = cam.t[key] + (cam.tTo[key] - cam.t[key]) * e;
    for (let i = 0; i < 3; i++) cam.target[i] = cam.t.target[i] + (cam.tTo.target[i] - cam.t.target[i]) * e;
    if (k >= 1) cam.t = null;
    S.dirty = true;
  }

  /* ---------------- 引擎初始化 ---------------- */
  const canvas = $("gpu-canvas");
  const engine = new VT4.Engine();
  let tank = null;

  async function boot() {
    try {
      console.log("[VT4] engine.init …");
      await engine.init(canvas);
      console.log("[VT4] engine ready");
    } catch (e) {
      console.error("[VT4] init failed:", e);
      $("gpu-fail").classList.remove("hidden");
      $("gpu-fail-msg").textContent = String(e.message || e);
      return;
    }
    $("gpu-badge").textContent = "WebGPU · " + (engine.maxTex >= 8192 ? "8K 就绪" : "4K");
    rebuildTank("base");
    engine.setTerrain(VT4.buildTerrain());
    dust = new VT4.Dust(engine.dustCap);
    dust.density = S.dust;
    updateParts();
    requestAnimationFrame(loop);
  }

  let dust = null;

  function rebuildTank(v) {
    const t0 = performance.now();
    tank = VT4.buildTank(v);
    engine.setTank(tank.mesh);
    $("hud-tris").textContent = (tank.mesh.ni / 3 / 1000).toFixed(0) + "k tris · 构建 " + (performance.now() - t0).toFixed(0) + "ms";
    buildDiffList();
    updateParts();
    S.dirty = true;
  }

  /* ---------------- 零件可见性 / 高亮 ---------------- */
  const clipOn = () => S.clipAxis !== "off";
  function updateParts() {
    const vis = [], hl = [];
    VT4.partList.forEach((p, i) => {
      let v = S.sysvis[p.sys] !== false;
      if (p.sys === "env") v = true;
      if (p.sys === "interior" && (S.xray > 0.02 || clipOn() || S.interiorOnly)) v = true;
      if (S.interiorOnly) v = (p.sys === "interior" || p.sys === "crew");
      vis[i] = v ? 1 : 0;
      hl[i] = 0;
    });
    if (S.hlDiff && tank) for (const d of tank.diffs) if (d.part >= 0) hl[d.part] = 1.0;
    engine.updateParts(vis, hl);
    S.dirty = true;
  }

  function buildDiffList() {
    const el = $("diff-list");
    el.innerHTML = "";
    for (const d of tank.diffs) {
      const div = document.createElement("div");
      div.className = "di" + (S.hlDiff && d.part >= 0 ? " on" : "");
      div.textContent = d.label;
      div.onclick = () => {
        if (d.focus) {
          const f = d.focus;
          cam.t = { ...cam }; cam.t0 = performance.now();
          const tgt = [f[3], f[4], f[5]], eye = [f[0], f[1], f[2]];
          const dvec = M.sub(eye, tgt), dist = M.len(dvec);
          cam.tTo = { yaw: Math.atan2(dvec[0], dvec[2]), pitch: Math.asin(dvec[1] / dist), dist, target: tgt };
        }
      };
      el.appendChild(div);
    }
  }

  /* ---------------- 拾取 ---------------- */
  let hoverPart = -1;
  function pickRay(mx, my) {
    const r = canvas.getBoundingClientRect();
    const x = (mx - r.left) / r.width * 2 - 1, y = 1 - (my - r.top) / r.height * 2;
    const eye = cam.eye();
    const fovY = 2 * Math.atan(12 / S.focal);
    const asp = r.width / r.height;
    const proj = M.persp(fovY, asp, 0.05, 200);
    const view = M.lookAt(eye, M.add(eye, cam.fwd()), [0, 1, 0]);
    const inv = M.invert(M.mul(proj, view));
    const p0 = M.applyP(inv, [x, y, -1]), p1 = M.applyP(inv, [x, y, 1]);
    return { o: p0, d: M.norm(M.sub(p1, p0)) };
  }
  function rayAABB(o, d, box) {
    let t0 = 0, t1 = 1e9;
    for (let i = 0; i < 3; i++) {
      const inv = 1 / (d[i] || 1e-9);
      let a = (box.min[i] - o[i]) * inv, b = (box.max[i] - o[i]) * inv;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    return t1 >= t0 ? t0 : -1;
  }
  function pickPart(mx, my) {
    if (!tank) return -1;
    const { o, d } = pickRay(mx, my);
    let best = -1, bt = 1e9;
    for (const k in tank.mesh.aabb) {
      const i = +k;
      const p = VT4.partList[i];
      if (p.sys === "env") continue;
      const t = rayAABB(o, d, tank.mesh.aabb[k]);
      if (t > 0 && t < bt) { bt = t; best = i; }
    }
    return best;
  }

  /* ---------------- 输入 ---------------- */
  const tooltip = $("tooltip");
  let dragging = 0, lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown", e => {
    dragging = e.button === 2 ? 2 : 1; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    if (S.camMode === "free") cam.syncFreeFromOrbit && 0;
  });
  canvas.addEventListener("pointerup", e => {
    if (dragging === 1 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 4) {
      const p = pickPart(e.clientX, e.clientY);
      if (p >= 0) {
        const info = VT4.partList[p];
        const sysName = { hull: "车体系统", turret: "炮塔/武器系统", run: "行动装置", interior: "车内构", crew: "乘员组", env: "场景" }[info.sys] || "";
        $("pick-info").innerHTML = `<b style="color:var(--acc)">${info.name}</b><br>分系统: ${sysName}<br>零件 ID: ${info.id}`;
      }
    }
    dragging = 0;
  });
  canvas.addEventListener("pointermove", e => {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (dragging === 1) {
      cam.t = null;
      if (S.camMode === "orbit") { cam.yaw -= dx * 0.005; cam.pitch = Math.max(-1.45, Math.min(1.5, cam.pitch + dy * 0.005)); }
      else { cam.fYaw += dx * 0.0035; cam.fPitch = Math.max(-1.5, Math.min(1.5, cam.fPitch - dy * 0.0035)); }
      S.dirty = true;
    } else if (dragging === 2) {
      cam.t = null;
      const r = cam.right ? cam.right() : M.norm(M.cross(cam.fwd(), [0, 1, 0]));
      const u = M.cross(r, cam.fwd());
      const k = cam.dist * 0.0012;
      if (S.camMode === "orbit") for (let i = 0; i < 3; i++) cam.target[i] += (-r[i] * dx + u[i] * dy) * k;
      else for (let i = 0; i < 3; i++) cam.pos[i] += (-r[i] * dx + u[i] * dy) * k;
      S.dirty = true;
    } else {
      const p = pickPart(e.clientX, e.clientY);
      hoverPart = p;
      if (p >= 0) {
        tooltip.classList.remove("hidden");
        tooltip.textContent = VT4.partList[p].name;
        tooltip.style.left = (e.clientX - canvas.getBoundingClientRect().left + 14) + "px";
        tooltip.style.top = (e.clientY - canvas.getBoundingClientRect().top + 10) + "px";
      } else tooltip.classList.add("hidden");
    }
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener("wheel", e => {
    e.preventDefault(); cam.t = null;
    cam.dist = Math.max(0.8, Math.min(40, cam.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    if (S.camMode === "orbit") S.focus = cam.dist, $("focus").value = cam.dist, $("focus-v").textContent = cam.dist.toFixed(1) + "m";
    S.dirty = true;
  }, { passive: false });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  cam.right = () => M.norm(M.cross(cam.fwd(), [0, 1, 0]));

  // 自由飞行键盘
  const keys = {};
  window.addEventListener("keydown", e => { keys[e.code] = true; });
  window.addEventListener("keyup", e => { keys[e.code] = false; });
  function freeTick(dt) {
    if (S.camMode !== "free") return;
    const f = cam.fwd(), r = cam.right();
    const sp = (keys.ShiftLeft ? 8 : 3) * dt;
    let mv = [0, 0, 0];
    if (keys.KeyW) mv = M.add(mv, f);
    if (keys.KeyS) mv = M.add(mv, M.scale(f, -1));
    if (keys.KeyD) mv = M.add(mv, r);
    if (keys.KeyA) mv = M.add(mv, M.scale(r, -1));
    if (keys.KeyR || keys.Space) mv = M.add(mv, [0, 1, 0]);
    if (keys.KeyF) mv = M.add(mv, [0, -1, 0]);
    if (mv[0] || mv[1] || mv[2]) { cam.pos = M.add(cam.pos, M.scale(M.norm(mv), sp)); S.dirty = true; }
  }

  /* ---------------- UI 绑定 ---------------- */
  function bind(id, fn, ev = "input") { $(id).addEventListener(ev, fn); }
  bind("explode", e => { S.explode = +e.target.value; $("explode-v").textContent = Math.round(S.explode * 100) + "%"; S.dirty = true; });
  bind("gun-elev", e => { S.gunElev = M.rad(+e.target.value); $("gun-elev-v").textContent = (+e.target.value).toFixed(1) + "°"; S.dirty = true; });
  bind("xray", e => { S.xray = +e.target.value; $("xray-v").textContent = S.xray < 0.02 ? "关" : Math.round(S.xray * 100) + "%"; updateParts(); });
  bind("clip-pos", e => { S.clipPos = +e.target.value; $("clip-pos-v").textContent = S.clipPos.toFixed(2); S.dirty = true; });
  bind("clip-axis", e => { S.clipAxis = e.target.value; updateParts(); }, "change");
  bind("interior-only", e => { S.interiorOnly = e.target.checked; updateParts(); }, "change");
  bind("hl-diff", e => { S.hlDiff = e.target.checked; updateParts(); }, "change");
  bind("focal", e => { S.focal = +e.target.value; $("focal-v").textContent = S.focal + "mm"; S.dirty = true; });
  bind("aperture", e => { S.aperture = +e.target.value; $("aperture-v").textContent = "f/" + S.aperture; S.dirty = true; });
  bind("focus", e => { S.focus = +e.target.value; $("focus-v").textContent = S.focus.toFixed(1) + "m"; S.dirty = true; });
  bind("ev", e => { S.ev = +e.target.value; $("ev-v").textContent = S.ev.toFixed(1); S.dirty = true; });
  bind("dust", e => { S.dust = +e.target.value; $("dust-v").textContent = Math.round(S.dust * 100) + "%"; if (dust) dust.density = S.dust; S.dirty = true; });
  bind("rscale", e => { S.rscale = +e.target.value; $("rscale-v").textContent = S.rscale.toFixed(2) + "×"; engine.renderScale = S.rscale; engine.resize(); });
  bind("tonemap", e => { S.tonemap = TONEMAP_ID[e.target.value]; S.dirty = true; }, "change");
  bind("env", e => { S.env = e.target.value; S.dirty = true; }, "change");
  bind("cam-mode", e => { S.camMode = e.target.value; if (S.camMode === "free") cam.syncFreeFromOrbit(); S.dirty = true; }, "change");
  bind("soft-shadow", e => { S.soft = e.target.checked; S.dirty = true; }, "change");
  bind("ao-on", e => { S.ao = e.target.checked; S.dirty = true; }, "change");
  bind("vignette", e => { S.fx = e.target.checked; S.dirty = true; }, "change");

  document.querySelectorAll(".sysvis").forEach(c =>
    c.addEventListener("change", () => { S.sysvis[c.dataset.k] = c.checked; updateParts(); }));
  document.querySelectorAll('input[name="variant"]').forEach(r =>
    r.addEventListener("change", () => { S.variant = r.value; rebuildTank(S.variant); }));
  document.querySelectorAll('input[name="rmode"]').forEach(r =>
    r.addEventListener("change", () => { S.rmode = r.value; engine.resetAccum(); S.dirty = true; }));
  document.querySelectorAll(".vpre").forEach(b =>
    b.addEventListener("click", () => applyView(b.dataset.v)));
  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
      document.querySelectorAll(".pane").forEach(p => p.classList.toggle("active", p.id === "pane-" + t.dataset.tab));
    }));
  window.addEventListener("resize", () => engine.resize());

  /* ---------------- 导出 ---------------- */
  $("export-btn").addEventListener("click", async () => {
    const [w, h] = $("exp-res").value.split("x").map(Number);
    const samples = +$("exp-samples").value;
    const prog = $("exp-progress"), bar = $("exp-progress-bar"), txt = $("exp-progress-txt");
    prog.classList.remove("hidden");
    $("export-btn").disabled = true;
    try {
      const inp = renderInput(true);
      const img = await engine.exportImage(w, h, samples, inp, (s, n) => {
        bar.style.width = (s / n * 100) + "%";
        txt.textContent = `累积渲染中 ${s}/${n} 样本 · ${w}×${h}`;
      });
      txt.textContent = "编码 PNG …";
      const cv = document.createElement("canvas"); cv.width = img.w; cv.height = img.h;
      cv.getContext("2d").putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
      cv.toBlob(b => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `VT4_${S.variant}_${img.w}x${img.h}_${samples}spp.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        $("exp-status").textContent = "已导出";
        prog.classList.add("hidden");
        $("export-btn").disabled = false;
      }, "image/png");
    } catch (e) {
      txt.textContent = "导出失败: " + e.message;
      $("export-btn").disabled = false;
    }
  });

  /* ---------------- 主循环 ---------------- */
  function renderInput(forExport) {
    const eye = cam.eye(), fwd = cam.fwd();
    const right = M.norm(M.cross(fwd, [0, 1, 0]));
    const up = M.norm(M.cross(right, fwd));
    const fovY = 2 * Math.atan(12 / S.focal);
    // 光圈物理半径(夸大系数以呈现可见景深)
    const apR = (S.focal / 1000) / (S.aperture * 2) * 22;
    let clip = null;
    if (S.clipAxis !== "off") {
      const ext = { x: 2.2, y: 2.8, z: 4.0 }[S.clipAxis];
      const n = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[S.clipAxis];
      clip = { n, d: S.clipPos * ext + { x: 0, y: 0.9, z: 0 }[S.clipAxis] };
    }
    return {
      eye, fwd, right, up, fovY, near: 0.05, far: 220,
      focusDist: S.camMode === "orbit" ? cam.dist : S.focus, apR,
      explode: S.explode, gunElev: S.gunElev, xray: S.xray, clip,
      env: VT4.ENVS[S.env], ao: S.ao, soft: S.soft, vmVariant: 7,
      time: performance.now() / 1000, ev: S.ev, tonemap: S.tonemap, fx: S.fx,
    };
  }

  let lastT = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0;
  let autoRot = false;
  bind("autorotate", e => { autoRot = e.target.checked; }, "change");

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastT) / 1000, 0.1); lastT = now;
    camTick(now);
    freeTick(dt);
    if (autoRot) { cam.yaw += dt * 0.25; S.dirty = true; }
    if (dust) { dust.update(dt, now / 1000); engine.updateDust(dust); }

    const accum = S.rmode === "accum";
    // 预览模式每帧重累积; 累积模式仅在有变化或未满时推进
    if (!accum || S.dirty || engine.sampleCount < 4096) {
      engine.render(renderInput(), accum);
      S.dirty = false;
    }
    // HUD
    fpsAcc += dt; fpsN++;
    if ((fpsT += dt) > 0.5) {
      $("hud-fps").textContent = (fpsN / fpsAcc).toFixed(0) + " FPS";
      $("hud-samples").textContent = accum ? `累积 ${engine.sampleCount} spp` : "实时预览";
      $("hud-cam").textContent = `${S.focal}mm f/${S.aperture} · ${S.camMode === "free" ? "自由" : "轨道"}`;
      $("accum-n").textContent = engine.sampleCount;
      $("accum-bar").style.width = Math.min(engine.sampleCount / 512 * 100, 100) + "%";
      fpsAcc = 0; fpsN = 0; fpsT = 0;
    }
  }

  boot();
})();
