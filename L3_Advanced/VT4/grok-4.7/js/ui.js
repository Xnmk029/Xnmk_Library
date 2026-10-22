import { SPEC_ROWS, VARIANT_COPY } from "./state.js";
import { norm, v3 } from "./math.js";

const PRESETS = {
  front: { yaw: 0.62, pitch: 0.28, dist: 12.4, target: [0, 1.15, 0.8] },
  side: { yaw: 1.58, pitch: 0.16, dist: 12.8, target: [0, 1.15, 0.2] },
  top: { yaw: 0.4, pitch: 1.2, dist: 14, target: [0, 0.4, 0.2] },
  rear: { yaw: 3.05, pitch: 0.28, dist: 11.5, target: [0, 1.15, -0.8] },
  power: { yaw: 2.35, pitch: 0.42, dist: 8.2, target: [0.2, 1.05, -1.6] },
};

export function setupUI(state, renderer) {
  const spec = document.getElementById("spec");
  spec.innerHTML = SPEC_ROWS.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

  const tabs = [...document.querySelectorAll("#tabs button")];
  const setTab = (id) => {
    state.tab = id;
    tabs.forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== id;
    });
    renderer.invalidate();
  };
  tabs.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  document.querySelectorAll("[data-show]").forEach((input) => {
    input.addEventListener("change", () => {
      state.show[input.dataset.show] = input.checked;
    });
  });

  const yaw = document.getElementById("yaw");
  const elev = document.getElementById("elev");
  const explode = document.getElementById("explode");
  const bindRange = (el, out, fn) => {
    const sync = () => {
      out.textContent = fn(Number(el.value));
    };
    el.addEventListener("input", sync);
    sync();
  };
  bindRange(yaw, document.getElementById("yaw-out"), (v) => {
    state.turretYaw = (v * Math.PI) / 180;
    return `${v.toFixed(0)}°`;
  });
  bindRange(elev, document.getElementById("elev-out"), (v) => {
    state.gunElev = (v * Math.PI) / 180;
    return `${v.toFixed(1)}°`;
  });
  bindRange(explode, document.getElementById("explode-out"), (v) => {
    state.explode = v / 100;
    return `${v.toFixed(0)}%`;
  });
  document.getElementById("spin").addEventListener("change", (e) => { state.autoRotate = e.target.checked; });
  document.getElementById("tech").addEventListener("change", (e) => { state.tech = e.target.checked; });
  document.getElementById("run").addEventListener("change", (e) => { state.running = e.target.checked; });
  document.getElementById("presets").addEventListener("click", (e) => {
    const id = e.target.dataset.view;
    if (!id || !PRESETS[id]) return;
    Object.assign(state.cameras.assembly, PRESETS[id]);
    state.cameras.assembly.target = [...PRESETS[id].target];
  });

  const cards = [...document.querySelectorAll("#variant-cards button")];
  const paintVariant = () => {
    const copy = VARIANT_COPY[state.variant];
    document.getElementById("var-title").textContent = copy.title;
    document.getElementById("var-sub").textContent = copy.sub;
    document.getElementById("var-lead").textContent = copy.lead;
    document.getElementById("var-points").innerHTML = copy.points.map((p) => `<li>${p}</li>`).join("");
    cards.forEach((b) => b.classList.toggle("on", b.dataset.variant === state.variant));
  };
  cards.forEach((b) => b.addEventListener("click", () => {
    state.variant = b.dataset.variant;
    paintVariant();
  }));
  paintVariant();

  const modeButtons = [...document.querySelectorAll("#viewmode button")];
  modeButtons.forEach((b) => b.addEventListener("click", () => {
    state.viewMode = b.dataset.mode;
    modeButtons.forEach((n) => n.classList.toggle("on", n === b));
  }));
  document.getElementById("highlight").addEventListener("change", (e) => { state.highlight = e.target.checked; });
  const axisButtons = [...document.querySelectorAll("#clip-axis button")];
  axisButtons.forEach((b) => b.addEventListener("click", () => {
    state.clipAxis = b.dataset.axis;
    axisButtons.forEach((n) => n.classList.toggle("on", n === b));
  }));
  bindRange(document.getElementById("clip"), document.getElementById("clip-out"), (v) => {
    state.clipPos = v;
    return `${v.toFixed(2)} m`;
  });
  document.getElementById("paint").addEventListener("change", (e) => { state.paint = e.target.value; });

  const camButtons = [...document.querySelectorAll("#cammode button")];
  camButtons.forEach((b) => b.addEventListener("click", () => {
    const next = b.dataset.cam;
    if (next === "free" && state.camMode !== "free") {
      const cam = state.cameras.studio;
      const cy = Math.cos(cam.pitch);
      state.free.pos = [
        cam.target[0] + Math.sin(cam.yaw) * cy * cam.dist,
        cam.target[1] + Math.sin(cam.pitch) * cam.dist,
        cam.target[2] + Math.cos(cam.yaw) * cy * cam.dist,
      ];
      const dir = norm(v3(cam.target[0] - state.free.pos[0], cam.target[1] - state.free.pos[1], cam.target[2] - state.free.pos[2]));
      state.free.yaw = Math.atan2(dir[0], dir[2]);
      state.free.pitch = Math.asin(Math.max(-1, Math.min(1, dir[1])));
    }
    state.camMode = next;
    camButtons.forEach((n) => n.classList.toggle("on", n === b));
  }));
  bindRange(document.getElementById("focal"), document.getElementById("focal-out"), (v) => {
    state.focal = v;
    return `${v.toFixed(0)} mm`;
  });
  bindRange(document.getElementById("aperture"), document.getElementById("aperture-out"), (v) => {
    state.aperture = v;
    return `f/${v.toFixed(1)}`;
  });
  const focusEl = document.getElementById("focus");
  const focusOut = document.getElementById("focus-out");
  const syncFocus = (fromUser) => {
    const v = Number(focusEl.value);
    state.focus = v;
    if (fromUser) {
      state.autoFocus = false;
      document.getElementById("autofocus").checked = false;
    }
    focusOut.textContent = `${v.toFixed(1)} m`;
  };
  focusEl.addEventListener("input", () => syncFocus(true));
  syncFocus(false);
  document.getElementById("autofocus").addEventListener("change", (e) => { state.autoFocus = e.target.checked; });
  bindRange(document.getElementById("exposure"), document.getElementById("exp-out"), (v) => {
    state.exposure = v;
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)} EV`;
  });
  document.getElementById("tonemap").addEventListener("change", (e) => { state.tonemap = Number(e.target.value); });
  const envButtons = [...document.querySelectorAll("#env button")];
  envButtons.forEach((b) => b.addEventListener("click", () => {
    state.env = b.dataset.env;
    envButtons.forEach((n) => n.classList.toggle("on", n === b));
  }));
  bindRange(document.getElementById("dust"), document.getElementById("dust-out"), (v) => {
    state.dust = v / 100;
    return `${v.toFixed(0)}%`;
  });
  document.getElementById("accum").addEventListener("change", (e) => { state.accum = e.target.checked; });
  bindRange(document.getElementById("spp"), document.getElementById("spp-out"), (v) => {
    state.sppMax = v;
    return `${v}`;
  });
  document.getElementById("reset-cam").addEventListener("click", () => {
    state.cameras.studio.yaw = 0.98;
    state.cameras.studio.pitch = 0.2;
    state.cameras.studio.dist = 15.5;
    state.cameras.studio.target = [0, 1.05, 0.35];
    state.camMode = "orbit";
    camButtons.forEach((n) => n.classList.toggle("on", n.dataset.cam === "orbit"));
  });

  const canvas = document.getElementById("view");
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, button: e.button };
    canvas.setPointerCapture(e.pointerId);
    canvas.focus();
  });
  canvas.addEventListener("pointerup", () => { drag = null; });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (state.tab === "studio" && state.camMode === "free") {
      state.free.yaw += dx * 0.005;
      state.free.pitch = Math.max(-1.15, Math.min(1.15, state.free.pitch - dy * 0.004));
      return;
    }
    const cam = state.cameras[state.tab];
    if (e.shiftKey || drag.button === 2) {
      const cy = Math.cos(cam.pitch);
      const forward = [Math.sin(cam.yaw) * cy, Math.sin(cam.pitch), Math.cos(cam.yaw) * cy];
      const up = [0, 1, 0];
      const right = [
        up[1] * forward[2] - up[2] * forward[1],
        up[2] * forward[0] - up[0] * forward[2],
        up[0] * forward[1] - up[1] * forward[0],
      ];
      const cup = [
        forward[1] * right[2] - forward[2] * right[1],
        forward[2] * right[0] - forward[0] * right[2],
        forward[0] * right[1] - forward[1] * right[0],
      ];
      const scale = cam.dist * 0.0018;
      cam.target[0] += (-right[0] * dx + cup[0] * dy) * scale;
      cam.target[1] += (-right[1] * dx + cup[1] * dy) * scale;
      cam.target[2] += (-right[2] * dx + cup[2] * dy) * scale;
    } else if (drag.button === 1) {
      cam.dist = Math.max(2.4, Math.min(70, cam.dist * Math.exp(dy * 0.008)));
    } else {
      cam.yaw -= dx * 0.008;
      cam.pitch = Math.max(0.06, Math.min(1.28, cam.pitch + dy * 0.006));
    }
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (state.tab === "studio" && state.camMode === "free") {
      state.free.speed = Math.max(0.8, Math.min(30, state.free.speed * Math.exp(-e.deltaY * 0.001)));
      return;
    }
    const cam = state.cameras[state.tab];
    cam.dist = Math.max(2.4, Math.min(70, cam.dist * Math.exp(e.deltaY * 0.001)));
  }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select, textarea")) return;
    state.keys.add(e.key.toLowerCase());
    if (e.key === "1") setTab("assembly");
    if (e.key === "2") setTab("variant");
    if (e.key === "3") setTab("studio");
  });
  window.addEventListener("keyup", (e) => state.keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => state.keys.clear());

  const labelRoot = document.getElementById("labels");
  renderer.onHud = (info) => {
    document.getElementById("mode-chip").textContent = info.mode;
    document.getElementById("spp-chip").textContent = info.spp ? `${info.spp} / ${info.max} spp` : `${info.fps.toFixed(0)} fps`;
    document.getElementById("foot-right").textContent = `${Math.round(info.tris).toLocaleString()} tris · ${info.fps.toFixed(0)} fps`;
    document.getElementById("rd-mode").textContent = info.mode;
    document.getElementById("rd-fps").textContent = info.fps.toFixed(0);
    document.getElementById("rd-spp").textContent = info.spp ? `${info.spp} / ${info.max}` : "预览";
    document.getElementById("rd-focal").textContent = `${state.focal.toFixed(0)} mm`;
    document.getElementById("rd-ap").textContent = `f/${state.aperture.toFixed(1)}`;
    labelRoot.innerHTML = (info.labels || []).map((label) => {
      if (label.x < -40 || label.y < -20 || label.x > canvas.clientWidth + 40 || label.y > canvas.clientHeight + 20) return "";
      return `<div class="label" style="left:${label.x}px;top:${label.y}px">${label.text}</div>`;
    }).join("");
  };

  const modal = document.getElementById("modal");
  const runExport = async (w, h, samples) => {
    modal.hidden = false;
    document.getElementById("modal-title").textContent = `正在累积 ${w}×${h}`;
    document.getElementById("modal-bar").style.width = "0%";
    try {
      const blob = await renderer.exportImage(w, h, samples, (p) => {
        const pct = Math.round(p * 100);
        document.getElementById("modal-bar").style.width = `${pct}%`;
        document.getElementById("modal-text").textContent = `${pct}%`;
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `VT-4_${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      document.getElementById("modal-text").textContent = err.message || String(err);
      await new Promise((r) => setTimeout(r, 1600));
    } finally {
      modal.hidden = true;
    }
  };
  document.getElementById("ex-4k").addEventListener("click", () => runExport(3840, 2160, 12));
  document.getElementById("ex-8k").addEventListener("click", () => runExport(7680, 4320, 6));
  document.getElementById("gpu").textContent = renderer.adapter;
}
