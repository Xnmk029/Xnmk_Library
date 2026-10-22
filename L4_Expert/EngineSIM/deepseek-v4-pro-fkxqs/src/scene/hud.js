/**
 * HUD: analogue tachometer on a canvas plus a DOM readout panel.
 *
 * Every value shown here comes from the same telemetry object the audio engine
 * consumes, and every element has a stable id so the browser test can compare
 * what the driver sees with what the simulation computed.
 */

const IDS = {
  speed: "hud-speed",
  speedUnit: "hud-speed-unit",
  rpm: "hud-rpm",
  gear: "hud-gear",
  throttleBar: "hud-throttle-bar",
  brakeBar: "hud-brake-bar",
  throttleValue: "hud-throttle-value",
  brakeValue: "hud-brake-value",
  lateral: "hud-lateral",
  longitudinal: "hud-longitudinal",
  lapCount: "hud-lap-count",
  lapCurrent: "hud-lap-current",
  lapLast: "hud-lap-last",
  lapBest: "hud-lap-best",
  surface: "hud-surface",
  order: "hud-order",
  firing: "hud-firing",
  load: "hud-load",
  audio: "hud-audio",
  camera: "hud-camera",
  driver: "hud-driver",
  status: "hud-status",
};

const STATUS_LAMPS = [
  { id: "limiter", label: "LIMITER" },
  { id: "cut", label: "FUEL CUT" },
  { id: "tc", label: "TC" },
  { id: "abs", label: "ABS" },
  { id: "shift", label: "SHIFT" },
  { id: "off", label: "OFF TRACK" },
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Hud {
  /**
   * @param {HTMLElement} container
   * @param {object} options
   * @param {number} options.redlineRpm
   * @param {number} options.maxRpm
   * @param {number} options.mainOrder engine order of the firing frequency
   */
  constructor(container, { redlineRpm = 6500, maxRpm = 7400, mainOrder = 4 } = {}) {
    this.container = container;
    this.redlineRpm = redlineRpm;
    this.maxRpm = maxRpm;
    this.mainOrder = mainOrder;
    this.lamps = new Map();
    this.build();
    this.lastDraw = 0;
  }

  /** @private */
  build() {
    const root = element("div", "hud");
    root.id = "hud";

    // ---- tachometer
    const tachWrap = element("div", "hud-tach");
    this.canvas = document.createElement("canvas");
    this.canvas.id = "hud-tach-canvas";
    this.canvas.width = 320;
    this.canvas.height = 320;
    tachWrap.appendChild(this.canvas);
    const gear = element("div", "hud-gear", "1");
    gear.id = IDS.gear;
    tachWrap.appendChild(gear);
    const rpm = element("div", "hud-rpm", "0");
    rpm.id = IDS.rpm;
    tachWrap.appendChild(rpm);
    root.appendChild(tachWrap);

    // ---- speed
    const speedBlock = element("div", "hud-speed-block");
    const speed = element("div", "hud-speed", "0");
    speed.id = IDS.speed;
    const unit = element("div", "hud-speed-unit", "km/h");
    unit.id = IDS.speedUnit;
    speedBlock.append(speed, unit);
    root.appendChild(speedBlock);

    // ---- pedals + g meter
    const pedals = element("div", "hud-pedals");
    const throttleRow = element("div", "hud-bar-row");
    throttleRow.append(element("span", "hud-bar-label", "THR"));
    const throttleTrack = element("div", "hud-bar-track");
    this.throttleBar = element("div", "hud-bar-fill hud-bar-throttle");
    this.throttleBar.id = IDS.throttleBar;
    throttleTrack.appendChild(this.throttleBar);
    const throttleValue = element("span", "hud-bar-value", "0%");
    throttleValue.id = IDS.throttleValue;
    throttleRow.append(throttleTrack, throttleValue);

    const brakeRow = element("div", "hud-bar-row");
    brakeRow.append(element("span", "hud-bar-label", "BRK"));
    const brakeTrack = element("div", "hud-bar-track");
    this.brakeBar = element("div", "hud-bar-fill hud-bar-brake");
    this.brakeBar.id = IDS.brakeBar;
    brakeTrack.appendChild(this.brakeBar);
    const brakeValue = element("span", "hud-bar-value", "0%");
    brakeValue.id = IDS.brakeValue;
    brakeRow.append(brakeTrack, brakeValue);

    const gRow = element("div", "hud-g-row");
    const lateral = element("span", "hud-g", "0.00 g lat");
    lateral.id = IDS.lateral;
    const longitudinal = element("span", "hud-g", "0.00 g lon");
    longitudinal.id = IDS.longitudinal;
    gRow.append(lateral, longitudinal);

    pedals.append(throttleRow, brakeRow, gRow);
    root.appendChild(pedals);

    // ---- status lamps
    const status = element("div", "hud-status");
    status.id = IDS.status;
    for (const lamp of STATUS_LAMPS) {
      const node = element("span", "hud-lamp", lamp.label);
      node.id = `hud-lamp-${lamp.id}`;
      status.appendChild(node);
      this.lamps.set(lamp.id, node);
    }
    root.appendChild(status);

    // ---- engine / audio panel
    const info = element("div", "hud-info");
    const rows = [
      ["order", `ORDER ${this.mainOrder}`, IDS.order],
      ["firing", "FIRING", IDS.firing],
      ["load", "LOAD", IDS.load],
      ["surface", "SURFACE", IDS.surface],
      ["audio", "AUDIO", IDS.audio],
      ["camera", "CAMERA", IDS.camera],
      ["driver", "DRIVER", IDS.driver],
    ];
    for (const [, label, id] of rows) {
      const row = element("div", "hud-info-row");
      row.append(element("span", "hud-info-label", label));
      const value = element("span", "hud-info-value", "-");
      value.id = id;
      row.appendChild(value);
      info.appendChild(row);
    }
    root.appendChild(info);

    // ---- lap timing
    const laps = element("div", "hud-laps");
    const lapRows = [
      ["LAP", IDS.lapCount, "0"],
      ["CURRENT", IDS.lapCurrent, "0.00"],
      ["LAST", IDS.lapLast, "--.--"],
      ["BEST", IDS.lapBest, "--.--"],
    ];
    for (const [label, id, initial] of lapRows) {
      const row = element("div", "hud-lap-row");
      row.append(element("span", "hud-lap-label", label));
      const value = element("span", "hud-lap-value", initial);
      value.id = id;
      row.appendChild(value);
      laps.appendChild(row);
    }
    root.appendChild(laps);

    this.container.appendChild(root);
    this.root = root;
    this.nodes = Object.fromEntries(Object.entries(IDS).map(([key, id]) => [key, document.getElementById(id)]));
    this.context = this.canvas.getContext("2d");
    this.drawTach(0, 0);
  }

  /** @private Format a lap time as m:ss.mmm (or --.-- when unset). */
  static formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "--.--";
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return minutes > 0
      ? `${minutes}:${rest.toFixed(2).padStart(5, "0")}`
      : rest.toFixed(2);
  }

  /** @private Draw the analogue tachometer. */
  drawTach(rpm, shiftFlash) {
    const ctx = this.context;
    const size = this.canvas.width;
    const centre = size / 2;
    const radius = centre - 18;
    ctx.clearRect(0, 0, size, size);

    const start = Math.PI * 0.75;
    const end = Math.PI * 2.25;
    const sweep = end - start;

    // dial background
    ctx.beginPath();
    ctx.arc(centre, centre, radius, start, end);
    ctx.lineWidth = 16;
    ctx.strokeStyle = "rgba(12, 16, 22, 0.72)";
    ctx.stroke();

    // redline zone
    const redlineFraction = this.redlineRpm / this.maxRpm;
    ctx.beginPath();
    ctx.arc(centre, centre, radius, start + sweep * redlineFraction, end);
    ctx.strokeStyle = shiftFlash > 0.5 ? "#ff5b4a" : "#b2201a";
    ctx.stroke();

    // value arc
    const fraction = Math.max(0, Math.min(1, rpm / this.maxRpm));
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#43d6ff");
    gradient.addColorStop(0.65, "#ffd166");
    gradient.addColorStop(1, "#ff5b4a");
    ctx.beginPath();
    ctx.arc(centre, centre, radius, start, start + sweep * fraction);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 12;
    ctx.stroke();

    // ticks
    ctx.strokeStyle = "rgba(226, 232, 240, 0.75)";
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const step = 1000;
    for (let value = 0; value <= this.maxRpm; value += step) {
      const angle = start + sweep * (value / this.maxRpm);
      const inner = radius - 14;
      const outer = radius - 4;
      ctx.lineWidth = value % 2000 === 0 ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(centre + Math.cos(angle) * inner, centre + Math.sin(angle) * inner);
      ctx.lineTo(centre + Math.cos(angle) * outer, centre + Math.sin(angle) * outer);
      ctx.stroke();
      if (value % 2000 === 0) {
        const labelRadius = radius - 32;
        ctx.fillText(String(value / 1000), centre + Math.cos(angle) * labelRadius, centre + Math.sin(angle) * labelRadius);
      }
    }

    // needle
    const angle = start + sweep * fraction;
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centre - Math.cos(angle) * 14, centre - Math.sin(angle) * 14);
    ctx.lineTo(centre + Math.cos(angle) * (radius - 22), centre + Math.sin(angle) * (radius - 22));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centre, centre, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();
  }

  /**
   * Refresh the whole HUD.
   * @param {object} telemetry vehicle telemetry
   * @param {object} extra
   * @param {object} [extra.lap] lap timer snapshot
   * @param {object} [extra.audio] audio status
   * @param {string} [extra.camera]
   * @param {boolean} [extra.autoDrive]
   */
  update(telemetry, { lap = null, audio = null, camera = "chase", autoDrive = false } = {}) {
    const nodes = this.nodes;
    const shiftFlash = telemetry.rpm > this.redlineRpm ? (Math.floor(performance.now() / 90) % 2) : 0;
    this.drawTach(telemetry.rpm, shiftFlash);

    nodes.rpm.textContent = String(Math.round(telemetry.rpm));
    nodes.gear.textContent = telemetry.gearLabel;
    nodes.speed.textContent = String(Math.round(Math.abs(telemetry.speedKph)));
    nodes.throttleBar.style.width = `${(telemetry.throttle * 100).toFixed(0)}%`;
    nodes.brakeBar.style.width = `${(telemetry.brake * 100).toFixed(0)}%`;
    nodes.throttleValue.textContent = `${Math.round(telemetry.throttle * 100)}%`;
    nodes.brakeValue.textContent = `${Math.round(telemetry.brake * 100)}%`;
    nodes.lateral.textContent = `${telemetry.lateralG.toFixed(2)} g lat`;
    nodes.longitudinal.textContent = `${telemetry.longitudinalG.toFixed(2)} g lon`;

    const firingHz = (telemetry.rpm / 60) * this.mainOrder;
    nodes.order.textContent = `${firingHz.toFixed(1)} Hz`;
    nodes.firing.textContent = `${(telemetry.rpm / 60).toFixed(1)} rev/s`;
    nodes.load.textContent = `${Math.round(telemetry.engineLoad * 100)}%`;
    nodes.surface.textContent = telemetry.surface + (telemetry.offTrack ? " (off)" : "");
    nodes.camera.textContent = camera;
    nodes.driver.textContent = autoDrive ? "AUTO" : "MANUAL";
    if (audio) {
      nodes.audio.textContent = audio.running
        ? `${audio.state} ${(audio.sampleRate / 1000).toFixed(1)}k`
        : audio.state ?? "off";
    }

    if (lap) {
      nodes.lapCount.textContent = String(lap.lapCount);
      nodes.lapCurrent.textContent = Hud.formatTime(lap.currentLapTime);
      nodes.lapLast.textContent = Hud.formatTime(lap.lastLapTime);
      nodes.lapBest.textContent = Hud.formatTime(lap.bestLapTime);
    }

    this.setLamp("limiter", telemetry.limiterActive);
    this.setLamp("cut", telemetry.ignitionCut);
    this.setLamp("tc", telemetry.tractionControl > 0.05);
    this.setLamp("abs", telemetry.absFront < 0.95 || telemetry.absRear < 0.95);
    this.setLamp("shift", telemetry.shifting);
    this.setLamp("off", telemetry.offTrack);
    return this;
  }

  /** @private */
  setLamp(id, active) {
    const node = this.lamps.get(id);
    if (!node) return;
    if (active) node.classList.add("is-on");
    else node.classList.remove("is-on");
  }

  /** Element ids, so tests and external tooling do not hard-code strings. */
  static get ids() {
    return { ...IDS };
  }
}
