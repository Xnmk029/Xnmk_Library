/**
 * EngineLab - the on-screen sound + auto-driver laboratory (toggle: L).
 *
 * Three live instruments, all fed by the same telemetry the audio thread and
 * the physics consume:
 *
 *   1. Per-cylinder panel: the 720-degree crank clock, and one tile per cylinder
 *      in firing order showing which bank it lives on, its crank-throw angle,
 *      the seconds until its exhaust valve opens, the exhaust/intake lift
 *      windows as two live bars, and a fire indicator that lights when the crank
 *      passes that cylinder's firing TDC (kept glowing for 450 ms so a human can
 *      follow the event train).
 *
 *   2. Live spectrum: a 2048-point windowed FFT of the AnalyserNode (the real
 *      mixed output), drawn as dB bars with the engine-order comb overlaid:
 *      solid ticks for the firing harmonics, faint ticks for the half orders,
 *      and measured levels for orders 4/8/12/16. Same FFT code as the CI tests.
 *
 *   3. Auto-driver decision panel: the steering law decomposed term by term
 *      (Ackermann + slip feed-forward + heading error + Stanley cross-track
 *      - yaw damping) next to the speed planner and the throttle/brake outputs.
 */

import {
  FOUR_STROKE_CYCLE_DEG,
  buildValveTables,
  createFiringSchedule,
  crankThrows,
  orderToHz,
  valveLift,
  wrapCycle,
} from "../audio/firing.js";
import { fftInPlace, hannWindow } from "../audio/analysis/fft.js";

const FIRE_HOLD_SECONDS = 0.45;
const FFT_SIZE = 2048;
const FFT_INTERVAL_FRAMES = 4;

export class EngineLab {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container
   * @param {import('../audio/engine-config.js').EngineConfig} options.engine
   * @param {import('../vehicle/vehicle-model.js').VehicleModel} options.vehicle
   * @param {import('../app/audio-engine.js').BrowserAudioEngine} options.audio
   * @param {() => boolean} [options.autoDriveActive]
   */
  constructor({ container, engine, vehicle, audio, autoDriveActive = () => false }) {
    this.container = container;
    this.engine = engine;
    this.vehicle = vehicle;
    this.audio = audio;
    this.autoDriveActive = autoDriveActive;
    this.autoDriver = null; // wired by the app after the auto driver exists

    this.schedule = createFiringSchedule(engine);
    this.valveTables = buildValveTables(this.schedule, 2048);
    this.throwByCylinder = new Map();
    for (const throwInfo of crankThrows(this.schedule)) {
      this.throwByCylinder.set(throwInfo.cylinders[0], throwInfo.index + 1);
      this.throwByCylinder.set(throwInfo.cylinders[1], throwInfo.index + 1);
    }

    this.phaseDeg = 0;
    this.previousRpm = engine.limits.idleRpm;
    this.previousRelative = new Map(this.schedule.events.map((event) => [event.cylinder, null]));
    this.fireUntil = new Map();
    this.edgeCount = 0;
    this.lastEdges = [];
    this.frame = 0;
    this.visible = false;
    this.fftTimer = 0;
    this.fft = {
      re: new Float64Array(FFT_SIZE),
      im: new Float64Array(FFT_SIZE),
      window: hannWindow(FFT_SIZE),
      spectrum: new Float64Array(FFT_SIZE / 2),
    };
    this.orderMarkers = [];
    for (let order = 0.5; order <= 16.0001; order += 0.5) this.orderMarkers.push(Math.round(order * 10) / 10);

    this.buildDom();
    this.resize();
  }

  /** @private */
  buildDom() {
    const root = document.createElement("div");
    root.className = "engine-lab";
    root.id = "engine-lab";

    const header = document.createElement("div");
    header.className = "lab-header";
    const title = document.createElement("span");
    title.textContent = this.engine.label;
    title.id = "lab-title";
    const chip = document.createElement("span");
    chip.className = "lab-chip";
    chip.textContent = this.engine.cylinderCount + " firings / 720 deg - order " + this.schedule.mainOrder + " = rpm / 15 Hz";
    header.append(title, chip);
    root.appendChild(header);

    const columns = document.createElement("div");
    columns.className = "lab-columns";
    root.appendChild(columns);

    // -------------------------------------------------------- cylinder column
    const cylinderColumn = document.createElement("div");
    cylinderColumn.className = "lab-column lab-column-cylinders";

    const clockRow = document.createElement("div");
    clockRow.className = "lab-crank-clock";
    this.clockArc = document.createElement("canvas");
    this.clockArc.id = "lab-crank-arc";
    clockRow.appendChild(this.clockArc);
    const clockText = document.createElement("div");
    clockText.className = "lab-crank-text";
    this.clockDegrees = document.createElement("div");
    this.clockDegrees.id = "lab-crank-degrees";
    this.clockRpm = document.createElement("div");
    this.clockRpm.id = "lab-crank-rpm";
    clockText.append(this.clockDegrees, this.clockRpm);
    clockRow.appendChild(clockText);
    cylinderColumn.appendChild(clockRow);

    for (const event of this.schedule.events) {
      const tile = document.createElement("div");
      tile.className = "lab-cylinder";
      tile.id = "lab-cylinder-" + event.cylinder;

      const head = document.createElement("div");
      head.className = "lab-cylinder-head";
      const name = document.createElement("span");
      name.textContent = "C" + event.cylinder;
      name.id = "lab-cylinder-name-" + event.cylinder;
      const bank = document.createElement("span");
      bank.textContent = event.bank.toUpperCase();
      bank.id = "lab-cylinder-bank-" + event.cylinder;
      const fire = document.createElement("span");
      fire.className = "lab-fire";
      fire.id = "lab-cylinder-fire-" + event.cylinder;
      head.append(name, bank, fire);
      tile.appendChild(head);

      const meta = document.createElement("div");
      meta.className = "lab-cylinder-meta";
      meta.textContent = "throw " + this.throwByCylinder.get(event.cylinder) + " - EVO --s";
      meta.id = "lab-cylinder-meta-" + event.cylinder;
      tile.appendChild(meta);

      const bars = document.createElement("div");
      bars.className = "lab-lift-bars";
      for (const [label, kind] of [["EXH", "exh"], ["INT", "int"]]) {
        const row = document.createElement("div");
        row.className = "lab-lift-row";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = label;
        const track = document.createElement("div");
        track.className = "lab-lift-track";
        const fill = document.createElement("div");
        fill.className = "lab-lift-fill";
        fill.id = "lab-lift-" + kind + "-" + event.cylinder;
        track.appendChild(fill);
        row.append(nameSpan, track);
        bars.appendChild(row);
      }
      tile.appendChild(bars);
      cylinderColumn.appendChild(tile);
    }
    columns.appendChild(cylinderColumn);

    // ---------------------------------------------------------- spectrum column
    const spectrumColumn = document.createElement("div");
    spectrumColumn.className = "lab-column lab-column-spectrum";
    const spectrumHead = document.createElement("div");
    spectrumHead.className = "lab-subhead";
    spectrumHead.textContent = "live spectrum (dB) - solid ticks: firing harmonics, faint: half orders";
    this.spectrumCanvas = document.createElement("canvas");
    this.spectrumCanvas.id = "lab-spectrum-canvas";
    this.spectrumLegend = document.createElement("div");
    this.spectrumLegend.className = "lab-legend";
    this.spectrumLegend.id = "lab-spectrum-legend";
    spectrumColumn.append(spectrumHead, this.spectrumCanvas, this.spectrumLegend);
    columns.appendChild(spectrumColumn);

    // ------------------------------------------------------------ driver column
    const driverColumn = document.createElement("div");
    driverColumn.className = "lab-column lab-column-driver";
    const driverHead = document.createElement("div");
    driverHead.className = "lab-subhead";
    driverHead.textContent = "auto-driver decision chain";
    this.driverRows = this.makeReadout(driverColumn, [
      ["lab-driver-status", "status", "--"],
      ["lab-driver-target", "planned speed", "--"],
      ["lab-driver-speed", "actual speed", "--"],
      ["lab-driver-lookahead", "look-ahead", "--"],
      ["lab-driver-grip", "grip plan", "--"],
      ["lab-driver-lateral", "lateral error", "--"],
      ["lab-driver-ackermann", "steer: ackermann", "--"],
      ["lab-driver-slipff", "steer: slip feed-forward", "--"],
      ["lab-driver-heading", "steer: heading error", "--"],
      ["lab-driver-stanley", "steer: cross-track (Stanley)", "--"],
      ["lab-driver-damping", "steer: yaw damping", "--"],
      ["lab-driver-angle", "steer: road-wheel angle", "--"],
      ["lab-driver-throttle", "throttle output", "--"],
      ["lab-driver-brake", "brake output", "--"],
      ["lab-driver-steer", "steer output", "--"],
      ["lab-driver-integral", "speed integral", "--"],
    ]);
    columns.appendChild(driverColumn);

    const footer = document.createElement("div");
    footer.className = "lab-footer";
    footer.id = "lab-footer";
    footer.textContent =
      "phase is integrated from the same rpm the worklet tracks; valve lifts come from the cam windows in engine-config.js";
    root.appendChild(footer);

    this.container.appendChild(root);
    this.root = root;
  }

  /** @private */
  makeReadout(parent, entries) {
    const rows = {};
    for (const [id, label] of entries) {
      const row = document.createElement("div");
      row.className = "lab-readout-row";
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      const valueNode = document.createElement("span");
      valueNode.className = "lab-readout-value";
      valueNode.id = id;
      row.append(labelNode, valueNode);
      parent.appendChild(row);
      rows[id] = valueNode;
    }
    return rows;
  }

  /** @private Size the canvases to the drawer's actual width. */
  resize() {
    if (!this.root || this.root.getBoundingClientRect().width === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const spectrumWidth = Math.max(260, Math.round(this.spectrumCanvas.getBoundingClientRect().width));
    this.spectrumCanvas.width = Math.round(spectrumWidth * dpr);
    this.spectrumCanvas.height = Math.round(150 * dpr);
    this.spectrumCanvas.style.height = "150px";
    this.spectrumScale = dpr;

    const clockSize = 92;
    this.clockArc.width = Math.round(92 * dpr);
    this.clockArc.height = Math.round(92 * dpr);
    this.clockArc.style.width = "92px";
    this.clockArc.style.height = "92px";
    this.clockScale = dpr;
    void clockSize;
  }

  /** Toggle open/closed; returns the new state. */
  toggle() {
    this.setVisible(!this.visible);
    return this.visible;
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.visible = Boolean(visible);
    this.root.classList.toggle("is-open", this.visible);
    if (this.visible) this.resize();
    return this.visible;
  }

  /**
   * Called every app frame after the physics step.
   * @param {object} telemetry
   * @param {number} dt wall-clock delta
   */
  update(telemetry, dt) {
    this.frame++;
    const step = Math.min(Math.max(dt, 0), 0.1);
    const rpm = Number.isFinite(telemetry.rpm) ? Math.max(0, telemetry.rpm) : this.previousRpm;
    const degreesPerSecond = (rpm * 360) / 60;
    this.phaseDeg = wrapCycle(this.phaseDeg + degreesPerSecond * step);
    this.previousRpm = rpm;
    // Phase accumulates even while the drawer is closed, so the fire-edge
    // detectors are warm (with real previous angles) the moment it opens.
    if (!this.visible) return;

    this.drawCrankClock();
    this.updateCylinders();
    this.updateSpectrum();
    this.updateDriverReadouts(telemetry);
  }

  /** @private Four-stroke dial with a 720 degree phase hand. */
  drawCrankClock() {
    const ctx = this.clockArc.getContext("2d");
    const size = this.clockArc.width / this.clockScale;
    const centre = size / 2;
    const radius = centre - 10;
    ctx.clearRect(0, 0, size, size);
    const start = Math.PI * 0.75;
    const sweep = Math.PI * 2;

    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(148,163,184,0.16)";
    ctx.beginPath();
    ctx.arc(centre, centre, radius, 0, Math.PI * 2);
    ctx.stroke();

    for (let tick = 0; tick < 8; tick++) {
      const angle = start + sweep * (tick / 8);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(226,232,240,0.5)";
      ctx.beginPath();
      ctx.moveTo(centre + Math.cos(angle) * (radius - 8), centre + Math.sin(angle) * (radius - 8));
      ctx.lineTo(centre + Math.cos(angle) * (radius + 2), centre + Math.sin(angle) * (radius + 2));
      ctx.stroke();
    }

    const fraction = this.phaseDeg / FOUR_STROKE_CYCLE_DEG;
    const angle = start + sweep * fraction;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#43d6ff";
    ctx.beginPath();
    ctx.moveTo(centre - Math.cos(angle) * 8, centre - Math.sin(angle) * 8);
    ctx.lineTo(centre + Math.cos(angle) * (radius - 6), centre + Math.sin(angle) * (radius - 6));
    ctx.stroke();

    this.clockDegrees.textContent = Math.round(this.phaseDeg) + " deg / 720";
    this.clockRpm.textContent = Math.round(this.previousRpm) + " rpm - " + degreesPerSecondLabel(this.previousRpm);
  }

  /** @private Fire-edge detection + lift bars + EVO countdown per cylinder. */
  updateCylinders() {
    const now = performance.now() / 1000;
    const degreesPerSecond = Math.max((this.previousRpm * 360) / 60, 1);
    for (const event of this.schedule.events) {
      const cylinder = event.cylinder;
      const relative = wrapCycle(this.phaseDeg - event.firingAngleDeg);
      const previous = this.previousRelative.get(cylinder);
      // Crossing 720 -> 0 means the crank just passed this cylinder's firing TDC.
      // The window is 45 degrees: wide enough that a normal frame step (~25 deg
      // at idle, ~90 deg at the limiter under a 60 Hz loop) cannot jump over the
      // crossing, and narrow enough that the lamp lights exactly once per event
      // instead of once per frame inside the window.
      if (previous !== null && relative < 45 && previous > FOUR_STROKE_CYCLE_DEG - 45) {
        this.lightFire(cylinder);
        this.edgeCount++;
        if (this.lastEdges.length < 5) {
          this.lastEdges.push({ cylinder, previous: Math.round(previous), relative: Math.round(relative), phase: Math.round(this.phaseDeg) });
        }
      }
      this.previousRelative.set(cylinder, relative);

      const exhaustLift = valveLift(
        relative,
        event.exhaustOpenDeg - event.firingAngleDeg,
        event.exhaustCloseDeg - event.firingAngleDeg,
      );
      const intakeLift = valveLift(
        relative,
        event.intakeOpenDeg - event.firingAngleDeg,
        event.intakeCloseDeg - event.firingAngleDeg,
      );

      const exhaustFill = document.getElementById("lab-lift-exh-" + cylinder);
      const intakeFill = document.getElementById("lab-lift-int-" + cylinder);
      if (exhaustFill) {
        exhaustFill.style.width = (exhaustLift * 100).toFixed(0) + "%";
        exhaustFill.classList.toggle("is-lifting", exhaustLift > 0.05);
      }
      if (intakeFill) {
        intakeFill.style.width = (intakeLift * 100).toFixed(0) + "%";
        intakeFill.classList.toggle("is-lifting", intakeLift > 0.05);
      }

      const evoRelative = wrapCycle(event.exhaustOpenDeg - this.phaseDeg);
      const secondsToEvo = evoRelative / degreesPerSecond;
      const meta = document.getElementById("lab-cylinder-meta-" + cylinder);
      if (meta) meta.textContent = "throw " + this.throwByCylinder.get(cylinder) + " - EVO in " + secondsToEvo.toFixed(2) + "s";

      const fireNode = document.getElementById("lab-cylinder-fire-" + cylinder);
      const tile = document.getElementById("lab-cylinder-" + cylinder);
      if (fireNode && tile) {
        const lit = now < (this.fireUntil.get(cylinder) ?? 0);
        fireNode.classList.toggle("is-on", lit);
        tile.classList.toggle("is-firing", lit);
      }
    }
  }

  /** @private Keep a cylinder's fire lamp lit for FIRE_HOLD_SECONDS. */
  lightFire(cylinder) {
    this.fireUntil.set(cylinder, performance.now() / 1000 + FIRE_HOLD_SECONDS);
  }

  /** @private Live spectrum with the order comb and measured harmonics. */
  updateSpectrum() {
    const ctx = this.spectrumCanvas.getContext("2d");
    const width = this.spectrumCanvas.width / this.spectrumScale;
    const height = this.spectrumCanvas.height / this.spectrumScale;
    ctx.clearRect(0, 0, width, height);

    const analyser = this.audio.analyser;
    const sampleRate = this.audio.context?.sampleRate;
    if (!analyser || !sampleRate) {
      this.spectrumLegend.textContent = "audio not started";
      return;
    }

    this.fftTimer++;
    if (this.fftTimer % FFT_INTERVAL_FRAMES === 1) {
      const timeDomain = new Float32Array(FFT_SIZE);
      analyser.getFloatTimeDomainData(timeDomain);
      const { re, im, window, spectrum } = this.fft;
      for (let i = 0; i < FFT_SIZE; i++) re[i] = timeDomain[i] * window[i];
      im.fill(0);
      fftInPlace(re, im);
      for (let i = 0; i < FFT_SIZE / 2; i++) {
        const magnitude = Math.hypot(re[i], im[i]) * (2 / FFT_SIZE);
        spectrum[i] = 20 * Math.log10(Math.max(magnitude, 1e-7));
      }
    }
    const { spectrum } = this.fft;
    const binHz = sampleRate / FFT_SIZE;
    const lowHz = 24;
    const highHz = 2200;
    const firstBin = Math.max(1, Math.floor(lowHz / binHz));
    const lastBin = Math.min(spectrum.length - 1, Math.ceil(highHz / binHz));

    let peak = -120;
    for (let i = firstBin; i <= lastBin; i++) peak = Math.max(peak, spectrum[i]);
    const floor = peak - 55;

    const xForHz = (hz) => ((hz - lowHz) / (highHz - lowHz)) * width;
    const drawMark = (hz, colour, lineWidth) => {
      const x = xForHz(hz);
      ctx.strokeStyle = colour;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    };

    const rpm = this.previousRpm;
    for (const order of this.orderMarkers) {
      const hz = orderToHz(order, rpm);
      if (hz < lowHz || hz > highHz) continue;
      if (Number.isInteger(order)) drawMark(hz, "rgba(255,209,102,0.42)", 1.5);
      else drawMark(hz, "rgba(148,163,184,0.16)", 1);
    }

    for (let i = firstBin; i <= lastBin; i++) {
      const value = spectrum[i];
      const normalised = Math.max(0, Math.min(1, (value - floor) / (peak - floor)));
      const hz = i * binHz;
      const x = xForHz(hz);
      const barHeight = normalised * (height - 8);
      const isOrder = this.orderMarkers.some((order) => Math.abs(orderToHz(order, rpm) - hz) < binHz * 0.9);
      ctx.fillStyle = isOrder ? "rgba(255,209,102,0.9)" : "rgba(67,214,255,0.45)";
      ctx.fillRect(x, height - 2 - barHeight, Math.max(1, (width * binHz) / (highHz - lowHz)), barHeight);
    }

    const legendParts = [];
    for (const order of [4, 8, 12, 16]) {
      const hz = orderToHz(order, rpm);
      if (hz < lowHz || hz > highHz) continue;
      const centreBin = Math.round(hz / binHz);
      let best = -120;
      const span = Math.max(2, Math.round(6 / binHz));
      for (let i = Math.max(1, centreBin - span); i <= Math.min(spectrum.length - 2, centreBin + span); i++) {
        best = Math.max(best, spectrum[i]);
      }
      legendParts.push("o" + order + " " + hz.toFixed(0) + "Hz " + best.toFixed(0) + "dB");
    }
    this.spectrumLegend.textContent = legendParts.join("  -  ") || "engine off";
  }

  /** @private Auto-driver decision readouts. */
  updateDriverReadouts(telemetry) {
    const diagnostics = this.autoDriver?.diagnostics ?? null;
    const read = (id, text) => {
      const node = this.driverRows[id];
      if (node && node.textContent !== text) node.textContent = text;
    };
    if (!diagnostics || !this.autoDriveActive()) {
      read("lab-driver-status", "off (T to engage)");
      return;
    }
    read("lab-driver-status", "engaged - gear " + telemetry.gearLabel + " - " + telemetry.surface);
    read("lab-driver-target", (diagnostics.targetSpeedMps * 3.6).toFixed(0) + " km/h");
    read(
      "lab-driver-speed",
      (diagnostics.actualSpeedMps * 3.6).toFixed(0) +
        " km/h (" +
        (diagnostics.speedErrorMps >= 0 ? "+" : "") +
        (diagnostics.speedErrorMps * 3.6).toFixed(1) +
        ")",
    );
    read("lab-driver-lookahead", diagnostics.lookaheadM.toFixed(1) + " m");
    read(
      "lab-driver-grip",
      "mu x " + diagnostics.plannedGripScale.toFixed(2) + " - off-line " + Math.round(diagnostics.offLineAmount * 100) + "%",
    );
    read(
      "lab-driver-lateral",
      (diagnostics.lateralErrorM >= 0 ? "left" : "right") + " " + Math.abs(diagnostics.lateralErrorM).toFixed(2) + " m",
    );
    read("lab-driver-ackermann", (diagnostics.ackermannRad * 57.3).toFixed(2) + " deg");
    read("lab-driver-slipff", (diagnostics.slipFeedforwardRad * 57.3).toFixed(2) + " deg");
    read("lab-driver-heading", (diagnostics.headingErrorRad * 57.3).toFixed(2) + " deg");
    read("lab-driver-stanley", (diagnostics.crossTrackTermRad * 57.3).toFixed(2) + " deg");
    read("lab-driver-damping", (diagnostics.yawDampingRad * 57.3).toFixed(2) + " deg");
    read("lab-driver-angle", (diagnostics.steerAngleRad * 57.3).toFixed(2) + " deg");
    read("lab-driver-throttle", Math.round(diagnostics.throttle * 100) + "%");
    read("lab-driver-brake", Math.round(diagnostics.brake * 100) + "%");
    read("lab-driver-steer", diagnostics.steer.toFixed(3) + " (input)");
    read("lab-driver-integral", diagnostics.speedIntegral.toFixed(3));
  }

  /** Snapshot for tests and the automation surface. */
  snapshot() {
    const now = performance.now() / 1000;
    return {
      visible: this.visible,
      phaseDeg: this.phaseDeg,
      rpm: this.previousRpm,
      edgeCount: this.edgeCount,
      lastEdges: this.lastEdges,
      firingOrder: this.schedule.events.map((event) => event.cylinder),
      cylinders: this.schedule.events.map((event) => ({
        cylinder: event.cylinder,
        bank: event.bank,
        pinAngleDeg: event.pinAngleDeg,
        throwIndex: this.throwByCylinder.get(event.cylinder),
        firing: now < (this.fireUntil.get(event.cylinder) ?? 0),
      })),
      driver: this.autoDriver?.diagnostics ?? null,
    };
  }
}

/** @private human-friendly crank speed label. */
function degreesPerSecondLabel(rpm) {
  const dps = (rpm * 360) / 60;
  return dps >= 1000 ? (dps / 1000).toFixed(1) + "k deg/s" : dps.toFixed(0) + " deg/s";
}
