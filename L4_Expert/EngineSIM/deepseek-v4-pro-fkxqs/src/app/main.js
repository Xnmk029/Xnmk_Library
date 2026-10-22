/**
 * Application entry point: builds the scene, runs the loops, wires the audio.
 *
 * Loop structure (the reason the car feels the same on any monitor):
 *   - physics runs at a fixed 120 Hz through an accumulator,
 *   - rendering runs once per animation frame,
 *   - audio control messages are posted once per frame; the DSP itself runs on
 *     the audio thread at the device sample rate.
 *
 * A small automation surface is exposed on `window.__DRIVE_SIM__` so the browser
 * test suite can drive the simulation deterministically, read the HUD, sample the
 * framebuffer and run the audio self-test.
 */

import * as THREE from "three";

import { CROSSPLANE_V8 } from "../audio/engine-config.js";
import { mainOrder } from "../audio/firing.js";
import {
  ambienceControlsFromTelemetry,
  engineControlsFromTelemetry,
  spaceForCamera,
} from "../audio/telemetry-mapping.js";
import { LapTimer, TrackLayout } from "../track/track-layout.js";
import { AutoDriver } from "../vehicle/auto-driver.js";
import { MUSCLE_CAR, VehicleModel } from "../vehicle/vehicle-model.js";
import { BrowserAudioEngine } from "./audio-engine.js";
import { CameraRig } from "../scene/camera-rig.js";
import { createCarMesh } from "../scene/car-mesh.js";
import { createEnvironment, createTerrain } from "../scene/environment.js";
import { EngineLab } from "../scene/engine-lab.js";
import { Hud } from "../scene/hud.js";
import { InputManager } from "../scene/input.js";
import { createTrackMeshes } from "../scene/track-mesh.js";

const PHYSICS_HZ = 120;
const PHYSICS_DT = 1 / PHYSICS_HZ;
const MAX_STEPS_PER_FRAME = 8;

/**
 * @param {object} options
 * @param {HTMLCanvasElement} options.canvas
 * @param {HTMLElement} options.hudContainer
 * @param {string} options.workletUrl
 * @param {HTMLElement} [options.statusElement]
 */
export function createSimulation({ canvas, hudContainer, labContainer = null, workletUrl, statusElement = null }) {
  // ------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    // Needed so the browser test (and screenshots) can read the framebuffer.
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.25, 4000);

  // ---------------------------------------------------------------- world
  const track = new TrackLayout();
  const environment = createEnvironment(scene, renderer);
  const terrain = createTerrain(track);
  scene.add(terrain.group);
  const trackMeshes = createTrackMeshes(track);
  scene.add(trackMeshes.group);

  const car = createCarMesh(MUSCLE_CAR);
  scene.add(car.group);

  // -------------------------------------------------------------- physics
  const vehicle = new VehicleModel({ surfaceAt: (x, y) => track.surfaceAt(x, y) });
  const startPose = track.startPose();
  vehicle.reset({ x: startPose.x, y: startPose.y, heading: startPose.heading, speedMps: 0 });
  const lapTimer = new LapTimer(track);
  const autoDriver = new AutoDriver(track);

  // ----------------------------------------------------------------- view
  const rig = new CameraRig(camera, MUSCLE_CAR);
  const hud = new Hud(hudContainer, {
    redlineRpm: CROSSPLANE_V8.limits.redlineRpm,
    maxRpm: CROSSPLANE_V8.limits.maxRpm,
    mainOrder: mainOrder(CROSSPLANE_V8.cylinderCount),
  });

  // ---------------------------------------------------------------- audio
  const audio = new BrowserAudioEngine({ workletUrl });

  // ----------------------------------------------------- sound / driver lab
  const lab = labContainer
    ? new EngineLab({
        container: labContainer,
        engine: CROSSPLANE_V8,
        vehicle,
        audio,
        autoDriveActive: () => state.autoDrive,
      })
    : null;
  if (lab) lab.autoDriver = autoDriver;

  // ---------------------------------------------------------------- state
  const state = {
    running: true,
    paused: false,
    autoDrive: false,
    frames: 0,
    physicsSteps: 0,
    simulatedTime: 0,
    lastFrameMs: 0,
    fps: 0,
    accumulator: 0,
    lastTelemetry: vehicle.telemetry(),
    frameLoop: true,
  };

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  const input = new InputManager(window, {
    onAction: (action) => {
      switch (action) {
        case "shiftUp":
          vehicle.setAutoShift(false);
          vehicle.shiftUp();
          break;
        case "shiftDown":
          vehicle.setAutoShift(false);
          vehicle.shiftDown();
          break;
        case "reverse":
          vehicle.setAutoShift(false);
          vehicle.selectGear(vehicle.powertrain.gearIndex === 0 ? 2 : 0);
          break;
        case "camera":
          rig.nextView();
          break;
        case "lab":
          if (lab) {
            lab.toggle();
            setStatus(lab.visible ? "laboratory open (L)" : "laboratory closed (L)");
          }
          break;
        case "reset":
          resetToTrack();
          break;
        case "auto":
          state.autoDrive = !state.autoDrive;
          autoDriver.reset();
          setStatus(state.autoDrive ? "auto driver engaged (T)" : "manual driving (T)");
          break;
        case "mute":
          audio.setMuted();
          break;
        case "pause":
          state.paused = !state.paused;
          setStatus(state.paused ? "paused (P)" : "running");
          break;
        default:
          break;
      }
    },
  });

  /** Put the car back on the circuit, pointing the right way. */
  function resetToTrack() {
    const near = track.nearest(vehicle.x, vehicle.y);
    const point = track.sampleAtDistance(near.distance - 12);
    vehicle.reset({ x: point.x, y: point.y, heading: point.heading, speedMps: 8 });
    vehicle.setAutoShift(true);
    vehicle.powertrain.gearIndex = 2;
    autoDriver.reset();
    setStatus("car reset to the circuit (R)");
  }

  /** One fixed physics step, including lap timing. */
  function stepPhysics(dt) {
    if (state.autoDrive) {
      autoDriver.drive(vehicle, dt);
    } else {
      vehicle.setInput(input.state);
      vehicle.update(dt);
    }
    const near = track.nearest(vehicle.x, vehicle.y);
    lapTimer.update(dt, near.distance, { valid: Math.abs(near.lateral) < near.halfWidth * 3 });
    state.physicsSteps++;
    state.simulatedTime += dt;
  }

  /** Push the current telemetry into the audio thread. */
  function updateAudio(telemetry) {
    if (!audio.ready) return;
    audio.setSpace(spaceForCamera(rig.view, telemetry));
    audio.setEngineControls(engineControlsFromTelemetry(telemetry, { camera: rig.view }));
    audio.setAmbienceControls(ambienceControlsFromTelemetry(telemetry, { camera: rig.view }));
  }

  /** Update everything visual for the current telemetry. */
  function updateVisuals(telemetry, dt) {
    const worldPosition = new THREE.Vector3(telemetry.position.x, 0, -telemetry.position.y);
    car.group.position.copy(worldPosition);
    car.group.rotation.y = telemetry.heading;
    car.update(telemetry, dt);
    rig.update(telemetry, dt);
    environment.followTarget(worldPosition);
    hud.update(telemetry, {
      lap: lapTimer.snapshot(),
      audio: audio.status,
      camera: rig.view,
      autoDrive: state.autoDrive,
    });
    if (lab) lab.update(telemetry, dt);
  }

  /**
   * Advance the simulation by a wall-clock delta: input, fixed-step physics,
   * audio and visuals. Shared by the animation loop and the automation hook.
   * @param {number} dt seconds
   * @param {boolean} [render]
   */
  function advance(dt, render = true) {
    const clamped = Math.min(Math.max(dt, 0), 0.25);
    input.update(clamped);
    if (!state.paused) {
      state.accumulator += clamped;
      let steps = 0;
      while (state.accumulator >= PHYSICS_DT && steps < MAX_STEPS_PER_FRAME) {
        stepPhysics(PHYSICS_DT);
        state.accumulator -= PHYSICS_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) state.accumulator = 0;
    }
    const telemetry = vehicle.telemetry();
    state.lastTelemetry = telemetry;
    updateAudio(telemetry);
    updateVisuals(telemetry, clamped);
    if (render) {
      renderer.render(scene, camera);
      state.frames++;
    }
    return telemetry;
  }

  // ------------------------------------------------------------ main loop
  let previousTimestamp = 0;
  function frame(timestamp) {
    if (!state.running || !state.frameLoop) {
      requestAnimationFrame(frame);
      return;
    }
    const dt = previousTimestamp ? (timestamp - previousTimestamp) / 1000 : 1 / 60;
    previousTimestamp = timestamp;
    state.lastFrameMs = dt * 1000;
    state.fps = dt > 0 ? 1 / dt : 0;
    advance(dt, true);
    requestAnimationFrame(frame);
  }

  function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", handleResize);
  handleResize();

  // Render one frame immediately so the first paint is the circuit, not black.
  advance(1 / 60, true);
  requestAnimationFrame(frame);

  // ----------------------------------------------------- automation surface
  const automation = {
    version: "1.0.0",
    ready: true,
    describe() {
      return {
        track: track.describe(),
        car: { name: MUSCLE_CAR.name, massKg: MUSCLE_CAR.massKg, wheelbaseM: MUSCLE_CAR.wheelbaseM },
        engine: { id: CROSSPLANE_V8.id, label: CROSSPLANE_V8.label, mainOrder: mainOrder(CROSSPLANE_V8.cylinderCount) },
        physicsHz: PHYSICS_HZ,
      };
    },
    telemetry() {
      return state.lastTelemetry;
    },
    lap() {
      return lapTimer.snapshot();
    },
    stats() {
      return {
        frames: state.frames,
        physicsSteps: state.physicsSteps,
        simulatedTime: state.simulatedTime,
        fps: state.fps,
        paused: state.paused,
        autoDrive: state.autoDrive,
        camera: rig.view,
        render: { ...renderer.info.render },
        memory: { ...renderer.info.memory },
      };
    },
    /** Deterministically advance the simulation without waiting for frames. */
    advance(seconds, { render = false, step = 1 / 60 } = {}) {
      const total = Math.min(Math.max(seconds, 0), 600);
      let elapsed = 0;
      while (elapsed < total) {
        const dt = Math.min(step, total - elapsed);
        advance(dt, render);
        elapsed += dt;
      }
      return state.lastTelemetry;
    },
    /** Force driver input (bypasses the keyboard smoothing). */
    setInput(partial) {
      Object.assign(input.state, partial);
      vehicle.setInput(input.state);
      return { ...input.state };
    },
    /** Drive the input through the keyboard path, as a real player would. */
    holdKeys(codes, held = true) {
      for (const code of codes) {
        if (held) input.pressed.add(code);
        else input.pressed.delete(code);
      }
      return [...input.pressed];
    },
    setCamera(view) {
      return rig.setView(view);
    },
    lab: {
      open() {
        if (!lab) return false;
        lab.setVisible(true);
        return true;
      },
      close() {
        if (!lab) return false;
        lab.setVisible(false);
        return true;
      },
      toggle() {
        return lab ? lab.toggle() : false;
      },
      snapshot() {
        return lab ? lab.snapshot() : null;
      },
      get visible() {
        return Boolean(lab && lab.visible);
      },
    },
    setAutoDrive(enabled) {
      state.autoDrive = Boolean(enabled);
      autoDriver.reset();
      return state.autoDrive;
    },
    setPaused(paused) {
      state.paused = Boolean(paused);
      return state.paused;
    },
    /**
     * Enable/disable the live animation loop. Off, the simulation only advances
     * through `advance()`, which makes lab instrumentation deterministic.
     */
    setFrameLoop(enabled) {
      state.frameLoop = Boolean(enabled);
      return state.frameLoop;
    },
    /** Release every driver input (used before lab/idle measurements). */
    resetInputs() {
      input.pressed.clear();
      Object.assign(input.state, { throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0 });
      vehicle.setInput({ throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0 });
      return { ...input.state };
    },
    reset() {
      resetToTrack();
      return state.lastTelemetry;
    },
    /** Put the car back on the circuit at a chosen speed (used by tests/lab). */
    resetAt(speedMps = 8, { gearIndex = 2, autoShift = true } = {}) {
      const near = track.nearest(vehicle.x, vehicle.y);
      const point = track.sampleAtDistance(near.distance - 12);
      vehicle.reset({ x: point.x, y: point.y, heading: point.heading, speedMps });
      vehicle.setAutoShift(autoShift);
      vehicle.powertrain.gearIndex = gearIndex;
      vehicle.powertrain.shiftTimer = 0;
      autoDriver.reset();
      return state.lastTelemetry;
    },
    async startAudio() {
      await audio.start();
      return audio.status;
    },
    audioStatus() {
      audio.requestDiagnostics();
      return audio.status;
    },
    async audioSelfTest(options) {
      return audio.runOfflineSelfTest(options);
    },
    hudIds: Hud.ids,
    hudValues() {
      const read = (id) => document.getElementById(id)?.textContent ?? null;
      return {
        speed: read(Hud.ids.speed),
        rpm: read(Hud.ids.rpm),
        gear: read(Hud.ids.gear),
        throttle: read(Hud.ids.throttleValue),
        brake: read(Hud.ids.brakeValue),
        lateral: read(Hud.ids.lateral),
        surface: read(Hud.ids.surface),
        camera: read(Hud.ids.camera),
        lapCount: read(Hud.ids.lapCount),
        order: read(Hud.ids.order),
      };
    },
    /**
     * Statistics of the rendered framebuffer: proves the scene really drew
     * something (a blank canvas has zero variance).
     */
    samplePixels({ width = 128, height = 80 } = {}) {
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
      const w = Math.min(width, buffer.x);
      const h = Math.min(height, buffer.y);
      const x = Math.max(0, Math.floor((buffer.x - w) / 2));
      const y = Math.max(0, Math.floor((buffer.y - h) / 2));
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let sum = 0;
      let sumSquares = 0;
      const unique = new Set();
      for (let i = 0; i < pixels.length; i += 4) {
        const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
        sum += luminance;
        sumSquares += luminance * luminance;
        unique.add((pixels[i] >> 2) * 16384 + (pixels[i + 1] >> 2) * 128 + (pixels[i + 2] >> 2));
      }
      const count = pixels.length / 4;
      const mean = sum / count;
      return {
        width: w,
        height: h,
        mean,
        variance: sumSquares / count - mean * mean,
        uniqueColours: unique.size,
        drawingBuffer: { width: buffer.x, height: buffer.y },
      };
    },
    dispose() {
      state.running = false;
      input.dispose();
      window.removeEventListener("resize", handleResize);
      audio.dispose();
      renderer.dispose();
    },
  };

  setStatus("ready - press W to drive, T for the auto driver, C for the camera");

  return {
    renderer,
    scene,
    camera,
    track,
    trackMeshes,
    terrain,
    environment,
    vehicle,
    lapTimer,
    autoDriver,
    car,
    rig,
    hud,
    lab,
    input,
    audio,
    state,
    advance,
    resetToTrack,
    automation,
  };
}

/**
 * Boot the app from the page: waits for the DOM, wires the start overlay (the
 * gesture that lets the AudioContext run) and installs the automation hook.
 */
export async function boot() {
  const canvas = document.getElementById("scene");
  const hudContainer = document.getElementById("hud-root");
  const statusElement = document.getElementById("status-line");
  const overlay = document.getElementById("start-overlay");
  const startButton = document.getElementById("start-button");
  const loading = document.getElementById("loading");

  const simulation = createSimulation({
    canvas,
    hudContainer,
    labContainer: document.getElementById("lab-root"),
    workletUrl: "./engine-worklet.js",
    statusElement,
  });

  if (loading) loading.remove();

  let audioBootstrap = null;
  const beginAudio = async () => {
    if (!audioBootstrap) audioBootstrap = simulation.automation.startAudio();
    const status = await audioBootstrap;
    if (overlay) overlay.classList.add("is-hidden");
    if (status.error) {
      statusElement.textContent = `audio unavailable: ${status.error}`;
    } else {
      statusElement.textContent = `audio running at ${(status.sampleRate / 1000).toFixed(1)} kHz - W/S drive, A/D steer, C camera, T auto`;
    }
  };

  if (startButton) startButton.addEventListener("click", beginAudio);
  // Any first interaction is a valid gesture for the audio policy.
  window.addEventListener("keydown", beginAudio, { once: true });
  window.addEventListener("pointerdown", beginAudio, { once: true });

  globalThis.__DRIVE_SIM__ = simulation.automation;
  globalThis.__DRIVE_SIM_APP__ = simulation;
  return simulation;
}

if (typeof document !== "undefined" && !globalThis.__DRIVE_SIM_NO_AUTOBOOT__) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot().catch((error) => {
        const status = document.getElementById("status-line");
        if (status) status.textContent = `failed to start: ${error?.message ?? error}`;
        console.error(error);
      });
    });
  } else {
    boot().catch((error) => console.error(error));
  }
}
