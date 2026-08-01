/**
 * Application wiring for the V4f driving scene.
 *
 * Ownership is one-directional: the simulation runs, then the renderer and
 * the audio graph read its state. Nothing in src/sim knows three.js exists,
 * and nothing in src/render writes to the physics. The engine audio is the
 * V4f EngineSoundDriver from the same project -- same worklet, same presets.
 */

import { CROSSPLANE_V8, FLATPLANE_V8, REVERB_PRESETS } from './engine-config.mjs';
import { EngineSoundDriver } from './engine-driver.mjs';
import { Vehicle, MUSCLE_CAR } from './sim/vehicle.mjs';
import { Track, LapTimer } from './track/track.js';
import { buildScenery } from './track/scenery.js';
import { Renderer, CameraRig } from './render/scene.js';
import { SKY_PRESETS } from './render/sky.js';
import { Car, CAR_COLORS } from './render/car.js';
import { loadExternalCar } from './render/external-car.js';
import { TyreSmoke, SkidMarks } from './render/effects.js';
import { Input } from './ui/input.js';
import { Hud } from './ui/hud.js';

const REVERB_KEYS = Object.keys(REVERB_PRESETS);
const SKY_KEYS = Object.keys(SKY_PRESETS);

/**
 * Non-engine ambience: tyre roll, scrub and wind. Three tiny native nodes
 * rather than a second worklet -- the browser's filters are already SIMD and
 * this keeps the DSP budget for the engine.
 */
class VehicleAmbience {
  constructor(driver) {
    this.d = driver;
    this.built = false;
  }

  build() {
    if (this.built || !this.d.ready) return;
    const ctx = this.d.ctx;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.283;
      data[i] = (b0 + b1 + w * 0.1848) * 0.4;
    }
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    const mk = (type, hz, q) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      f.Q.value = q;
      return f;
    };
    this.roll = ctx.createGain();
    this.roll.gain.value = 0;
    this.rollF = mk('bandpass', 520, 0.7);
    this.scrub = ctx.createGain();
    this.scrub.gain.value = 0;
    this.scrubF = mk('bandpass', 1450, 4.5);
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    this.windF = mk('highpass', 700, 0.6);
    this.src.connect(this.rollF).connect(this.roll).connect(this.d.master);
    this.src.connect(this.scrubF).connect(this.scrub).connect(this.d.master);
    this.src.connect(this.windF).connect(this.wind).connect(this.d.master);
    this.src.start();
    this.built = true;
  }

  update(speed, slip, cabin) {
    if (!this.built) return;
    const t = this.d.ctx.currentTime;
    const v = Math.min(speed / 60, 1.4);
    const roll = Math.min(0.16, v * 0.11) * (0.5 + 0.5 * cabin);
    const scrub = Math.min(0.3, Math.pow(Math.max(0, slip - 0.12), 1.5) * 1.1) * Math.min(1, speed / 4);
    const wind = Math.min(0.11, v * v * v * 0.045) * (0.35 + 0.65 * cabin);
    this.roll.gain.setTargetAtTime(roll, t, 0.05);
    this.scrub.gain.setTargetAtTime(scrub, t, 0.02);
    this.wind.gain.setTargetAtTime(wind, t, 0.08);
    this.rollF.frequency.setTargetAtTime(340 + speed * 7, t, 0.08);
  }
}

class Sim {
  constructor(audio, ambience) {
    this.canvas = document.getElementById('gl');
    this.hudCanvas = document.getElementById('hud');
    this.overlay = document.getElementById('overlay');
    this.helpEl = document.getElementById('help');

    this.renderer = new Renderer(this.canvas, { skyPreset: 'afternoon' });
    this.hud = new Hud(this.hudCanvas);

    // --- world ----------------------------------------------------------
    this.track = new Track();
    this.renderer.scene.add(this.track.group);
    this.renderer.scene.add(buildScenery(this.track));

    this.smoke = new TyreSmoke(420);
    this.skids = new SkidMarks(1400);
    this.renderer.scene.add(this.smoke.points);
    this.renderer.scene.add(this.skids.mesh);

    // --- car ------------------------------------------------------------
    this.engineDef = CROSSPLANE_V8;
    this.vehicle = new Vehicle(this.engineDef, MUSCLE_CAR);
    this.car = new Car({
      color: CAR_COLORS.torred,
      wheelRadius: MUSCLE_CAR.wheelRadius,
      wheelbase: MUSCLE_CAR.wheelbase,
      trackWidth: MUSCLE_CAR.trackWidth,
    });
    this.renderer.scene.add(this.car.group);

    this.rig = new CameraRig(this.renderer.camera);
    this.lap = new LapTimer(this.track.spline);

    // --- audio (the V4f engine sound driver) -----------------------------
    this.audio = audio;
    this.ambience = ambience;
    this.reverbIndex = 0;
    this.skyIndex = 1;

    // --- input ----------------------------------------------------------
    this.input = new Input(window);
    this.input.onGamepad = (label) => this.flash(`Gamepad: ${label}`, 3);
    this.bindKeys();
    this.bindVirtualGamepad();

    this.time = 0;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsCount = 0;
    this.paused = false;
    this.message = null;
    this.messageUntil = 0;
    this.offTrackTimer = 0;

    this.respawn();
    // If the gesture's audio start finished before this heavy constructor
    // did, pick up where it left off.
    if (this.audio.ready) this.onAudioReady();

    // Upgrade the shell to the downloaded muscle car when it arrives; the
    // procedural body keeps the car drivable until then (and forever if the
    // asset is unreachable).
    this.loadExternalModel();

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.hud.resize();
    });

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /** Swap in the Quaternius muscle car shell once its OBJ/MTL load. */
  loadExternalModel() {
    loadExternalCar({
      color: CAR_COLORS.torred,
      wheelRadius: MUSCLE_CAR.wheelRadius,
      wheelbase: MUSCLE_CAR.wheelbase,
      trackWidth: MUSCLE_CAR.trackWidth,
    })
      .then((ext) => {
        if (!this.car) return;
        this.renderer.scene.remove(this.car.group);
        this.car.dispose();
        this.car = ext;
        this.car.setInteriorView(this.rig.mode === 'cockpit');
        this.renderer.scene.add(this.car.group);
        this.flash('External model: Quaternius SportsCar2 (CC0)', 3);
      })
      .catch((err) => {
        console.warn('External car model unavailable, keeping procedural body:', err);
        if (this.car) this.flash('External car model unavailable - using built-in body', 3);
      });
  }

  /** Called once audio is ready (and the sim exists) from the gesture. */
  onAudioReady() {
    if (this.audio.ready) {
      this.ambience.build();
      this.vehicle.engine.startCranking();
      this.flash('Engine start');
    }
  }

  flash(msg, seconds = 2) {
    this.message = msg;
    this.messageUntil = this.time + seconds;
  }

  bindVirtualGamepad() {
    const v = this.input.virtualControls;
    const bindBtn = (id, onStart, onEnd) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        el.classList.add('active');
        onStart();
      };
      const end = (e) => {
        e.preventDefault();
        el.classList.remove('active');
        onEnd();
      };
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
    };
    bindBtn('vbtn-throttle', () => { v.throttle = 1; }, () => { v.throttle = 0; });
    bindBtn('vbtn-brake', () => { v.brake = 1; }, () => { v.brake = 0; });
    bindBtn('vbtn-left', () => { v.steer = 1; }, () => { v.steer = 0; });
    bindBtn('vbtn-right', () => { v.steer = -1; }, () => { v.steer = 0; });

    const bindClick = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        action();
      });
    };
    bindClick('vbtn-cam', () => {
      this.rig.cycle(1);
      this.flash(`Camera: ${this.rig.mode}`);
    });
    bindClick('vbtn-reset', () => {
      this.respawn();
      this.flash('Back on track');
    });
    bindClick('vbtn-gear', () => {
      const dt = this.vehicle.drivetrain;
      dt.auto = false;
      dt.requestGear(dt.gear === -1 ? 1 : -1);
      this.flash(dt.gear === -1 ? 'Forward' : 'Reverse');
    });
  }

  bindKeys() {
    const i = this.input;
    i.on('KeyC', () => {
      this.rig.cycle(1);
      this.flash(`Camera: ${this.rig.mode}`);
    });
    i.on('KeyR', () => {
      this.respawn();
      this.flash('Back on track');
    });
    i.on('KeyM', () => {
      const dt = this.vehicle.drivetrain;
      dt.auto = !dt.auto;
      this.flash(`Gearbox: ${dt.auto ? 'automatic' : 'manual (Q / E)'}`);
    });
    i.on('KeyG', () => {
      const dt = this.vehicle.drivetrain;
      dt.auto = false;
      dt.requestGear(dt.gear === -1 ? 1 : -1);
      this.flash(dt.gear === -1 ? 'Forward' : 'Reverse');
    });
    i.on('KeyE', () => this.vehicle.drivetrain.shiftUp());
    i.on('KeyQ', () => this.vehicle.drivetrain.shiftDown());
    i.on('KeyT', () => {
      const a = this.vehicle.assists;
      a.tc = !a.tc;
      this.flash(`Traction control ${a.tc ? 'on' : 'off'}`);
    });
    i.on('KeyB', () => {
      const a = this.vehicle.assists;
      a.abs = !a.abs;
      this.flash(`ABS ${a.abs ? 'on' : 'off'}`);
    });
    i.on('KeyY', () => {
      const a = this.vehicle.assists;
      a.steer = !a.steer;
      this.flash(`Steering assist ${a.steer ? 'on' : 'off'}`);
    });
    i.on('KeyI', () => {
      const e = this.vehicle.engine;
      if (e.running || e.starting) {
        e.stop();
        this.flash('Ignition off');
      } else {
        e.startCranking();
        this.flash('Cranking');
      }
    });
    i.on('KeyV', () => {
      this.engineDef = this.engineDef === CROSSPLANE_V8 ? FLATPLANE_V8 : CROSSPLANE_V8;
      const rpm = this.vehicle.engine.rpm;
      this.vehicle = new Vehicle(this.engineDef, MUSCLE_CAR);
      this.vehicle.engine.rpm = rpm;
      this.vehicle.engine.omega = (rpm * 2 * Math.PI) / 60;
      this.vehicle.engine.running = true;
      this.respawn();
      this.audio.swap(this.engineDef, this.audio.quality);
      this.flash(this.engineDef.name);
    });
    i.on('KeyN', () => {
      this.reverbIndex = (this.reverbIndex + 1) % REVERB_KEYS.length;
      const key = REVERB_KEYS[this.reverbIndex];
      this.audio.setPreset(key);
      this.flash(`Reverb: ${REVERB_PRESETS[key].name}`);
    });
    i.on('KeyK', () => {
      this.skyIndex = (this.skyIndex + 1) % SKY_KEYS.length;
      const key = SKY_KEYS[this.skyIndex];
      this.renderer.applySkyPreset(SKY_PRESETS[key]);
      this.flash(`Sky: ${SKY_PRESETS[key].name}`);
    });
    i.on('KeyP', () => {
      this.paused = !this.paused;
      this.flash(this.paused ? 'Paused - P to resume' : 'Resumed', 1);
    });
    i.on('KeyH', () => {
      this.helpEl.classList.toggle('hidden');
    });
    i.on('F11', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    });
  }

  respawn() {
    const sp = this.track.spline;
    const p = sp.project(this.vehicle.x, this.vehicle.z);
    const f = sp.frameAt(p.s + 6);
    this.vehicle.reset(f.x, f.z, Math.atan2(f.tx, f.tz));
    this.vehicle.engine.startCranking();
    this.offTrackTimer = 0;
  }

  updateTyreEffects(t, dt) {
    const sy = Math.sin(t.yaw);
    const cy = Math.cos(t.yaw);
    const lx = cy;
    const lz = -sy;
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const side = i % 2 === 0 ? 1 : -1;
      const along = front ? this.vehicle.a : -this.vehicle.b;
      const x = t.x + sy * along + lx * this.vehicle.halfTrack * side;
      const z = t.z + cy * along + lz * this.vehicle.halfTrack * side;
      const slip = front ? t.slipF : t.slipR;
      const surface = this.track.surfaceAt(x, z);
      const onPaved = surface === 'asphalt' || surface === 'paint' || surface === 'kerb';
      const intensity = Math.max(0, slip - 1.05);
      if (intensity > 0.02 && t.speed > 1.2 && onPaved) {
        this.skids.lay(`w${i}`, x, z, lx, lz, front ? 0.28 : 0.33, Math.min(1, intensity));
        if (!front || intensity > 0.6) {
          const puffs = Math.min(3, Math.floor(intensity * 2.2) + 1);
          for (let p = 0; p < puffs; p++) {
            this.smoke.emit(x, z, Math.min(1, intensity * 0.7), sy * t.speed, cy * t.speed);
          }
        }
      } else {
        this.skids.breakTrail(`w${i}`);
      }
      if ((surface === 'grass' || surface === 'gravel') && t.speed > 4) {
        this.smoke.emit(x, z, 0.32, sy * t.speed * 0.4, cy * t.speed * 0.4);
      }
    }
    this.skids.flush();
    this.smoke.update(dt);
  }

  step(dt) {
    const controls = this.input.update(dt);
    if (this.input.padShift) {
      if (this.input.padShift.up && !this._padUp) this.vehicle.drivetrain.shiftUp();
      if (this.input.padShift.down && !this._padDown) this.vehicle.drivetrain.shiftDown();
      this._padUp = this.input.padShift.up;
      this._padDown = this.input.padShift.down;
    }

    this.vehicle.update(dt, controls, this.track);
    this.time += dt;

    const t = this.vehicle.telemetry();
    const surface = this.track.surfaceAt(t.x, t.z);
    const offTrack = surface === 'grass' || surface === 'gravel';
    this.lap.update(this.time, t.x, t.z, offTrack);

    // Auto-recover if beached well off the circuit and going nowhere.
    const p = this.track.spline.project(t.x, t.z);
    const way = Math.abs(p.lateral) > this.track.cfg.halfWidth + 16;
    this.offTrackTimer = way && t.speed < 2.5 ? this.offTrackTimer + dt : 0;
    if (this.offTrackTimer > 3) {
      this.respawn();
      this.flash('Recovered');
    }

    // --- audio ----------------------------------------------------------
    const cabin = this.rig.isInterior ? 1 : 0.25;
    this.audio.update(this.vehicle.engine.audioState(cabin));
    this.ambience.update(t.speed, Math.max(t.slipF, t.slipR) * 0.5, cabin);

    // Light rumble when a tyre is well past its friction peak.
    if (Math.max(t.slipF, t.slipR) > 1.2 && t.speed > 2) {
      this.input.rumble(0.5, 150);
    }

    // --- visuals ---------------------------------------------------------
    this.car.setInteriorView(this.rig.mode === 'cockpit');
    this.car.update(t, dt, controls.brake);
    this.rig.update(t, dt, controls.steer);
    this.renderer.updateShadow(this.car.group.position);
    this.renderer.sky.update(dt);
    this.updateTyreEffects(t, dt);

    return { t, controls, surface, offTrack, grip: this.track.gripAt(t.x, t.z) };
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = Math.min(Math.max(dt, 0.0001), 0.1);

    this._fpsAcc += dt;
    this._fpsCount++;
    if (this._fpsAcc > 0.4) {
      this.fps = this._fpsCount / this._fpsAcc;
      this._fpsAcc = 0;
      this._fpsCount = 0;
    }

    const frame = this.paused
      ? {
          t: this.vehicle.telemetry(),
          controls: this.input.controls,
          surface: this.track.surfaceAt(this.vehicle.x, this.vehicle.z),
          offTrack: false,
          grip: 1,
        }
      : this.step(dt);

    if (this.messageUntil < this.time) this.message = null;
    const stats = this.audio.getStats();
    this.hud.render({
      telemetry: frame.t,
      engine: this.engineDef,
      lap: this.lap,
      controls: frame.controls,
      info: {
        fps: this.fps,
        cpu: stats.cpu,
        drawCalls: this.renderer.renderer.info.render.calls,
        tris: this.renderer.renderer.info.render.triangles,
        preset: REVERB_PRESETS[REVERB_KEYS[this.reverbIndex]].name,
        reverb: REVERB_PRESETS[REVERB_KEYS[this.reverbIndex]].name,
        engineName: this.engineDef.name,
        sampleRate: this.audio.sampleRate,
        cameraMode: this.rig.mode,
        input: this.input.usingGamepad ? 'PAD' : 'KB',
        assist: this.vehicle.assists.steer ? 'on' : 'off',
        steerCap: frame.t.steerCap,
        surface: frame.surface,
        grip: frame.grip,
        audioReady: this.audio.ready,
        autoBox: this.vehicle.drivetrain.auto,
        sparkCut: this.vehicle.engine.sparkCut,
        offTrack: frame.offTrack,
        time: this.time,
        message: this.paused ? 'Paused - P to resume' : this.message,
      },
    });

    this.renderer.render();
  }
}

// --- boot order ---------------------------------------------------------
// The title screen must respond to a click IMMEDIATELY, before the scene
// finishes building (renderer, canvas textures and scenery take a moment on
// slow machines). So the audio driver is created and the gesture listeners
// are attached first, then the heavy Sim construction runs.
const audio = new EngineSoundDriver(CROSSPLANE_V8, {
  preset: 'open',
  quality: 'lite',
  masterGain: 0.85,
});
const ambience = new VehicleAmbience(audio);
const overlayEl = document.getElementById('overlay');
let sim = null;

const unlock = () => {
  overlayEl.classList.add('hidden');
  audio
    .start()
    .then((ok) => {
      if (ok && sim) sim.onAudioReady();
      else if (!ok && sim) {
        const why = audio.failed ? ` (${audio.failed.message})` : '';
        sim.flash(`Audio unavailable${why} - visuals only`, 4);
      }
    })
    .catch((err) => {
      console.warn('Audio start error:', err);
      if (sim) sim.flash(`Audio error (${err.message}) - visuals only`, 4);
    });
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('click', unlock);
  window.removeEventListener('keydown', unlock);
  overlayEl.removeEventListener('click', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('click', unlock);
window.addEventListener('keydown', unlock);
overlayEl.addEventListener('click', unlock);

try {
  sim = new Sim(audio, ambience);
  window.sim = sim;
} catch (err) {
  console.error(err);
  overlayEl.classList.remove('hidden');
  const card = overlayEl.querySelector('.overlay-card');
  if (card) {
    const msg = card.querySelector('#boot-error');
    if (msg) msg.style.display = 'block';
    if (msg) msg.textContent = `加载失败: ${err.message}`;
  }
}
