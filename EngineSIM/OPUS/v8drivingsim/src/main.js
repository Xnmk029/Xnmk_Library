/**
 * Application wiring.
 *
 * Ownership is deliberately one-directional: the simulation runs, then the
 * renderer and the audio graph read its state. Nothing in src/sim or src/audio
 * knows three.js exists, and nothing in src/render writes to the physics.
 */

import { CROSSPLANE_V8, ENGINES } from './audio/engine-config.js';
import { EngineAudio, VehicleAmbience, REVERB_PRESETS } from './audio/engine-audio.js';
import { Vehicle, MUSCLE_CAR } from './sim/vehicle.js';
import { Track, LapTimer } from './track/track.js';
import { buildScenery } from './track/scenery.js';
import { Renderer, CameraRig } from './render/scene.js';
import { SKY_PRESETS } from './render/sky.js';
import { Car, CAR_COLORS } from './render/car.js';
import { TyreSmoke, SkidMarks } from './render/effects.js';
import { Input } from './ui/input.js';
import { Hud } from './ui/hud.js';

const REVERB_KEYS = Object.keys(REVERB_PRESETS);
const SKY_KEYS = Object.keys(SKY_PRESETS);
const ENGINE_KEYS = Object.keys(ENGINES);

class Sim {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.hudCanvas = document.getElementById('hud');
    this.overlay = document.getElementById('overlay');
    this.helpEl = document.getElementById('help');

    this.renderer = new Renderer(this.canvas, { skyPreset: 'midday' });
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
      color: CAR_COLORS.sublime,
      wheelRadius: MUSCLE_CAR.wheelRadius,
      wheelbase: MUSCLE_CAR.wheelbase,
      trackWidth: MUSCLE_CAR.trackWidth,
    });
    this.renderer.scene.add(this.car.group);

    this.rig = new CameraRig(this.renderer.camera);
    this.lap = new LapTimer(this.track.spline);

    // --- audio ----------------------------------------------------------
    this.audio = new EngineAudio(this.engineDef, { preset: 'open', quality: 'high' });
    this.ambience = new VehicleAmbience(this.audio);
    this.reverbIndex = 0;
    this.skyIndex = 0;
    this.engineIndex = 0;

    // --- input ----------------------------------------------------------
    this.input = new Input(window);
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

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.hud.resize();
    });

    // Audio needs a user gesture. Any of these will do.
    const unlock = async () => {
      try {
        const ok = await this.audio.start();
        if (ok) {
          this.ambience.build();
          this.vehicle.engine.startCranking();
          this.flash('Engine start');
        } else {
          this.flash('Audio unavailable - visuals only');
        }
      } catch (err) {
        console.warn('Audio start error:', err);
        this.flash('Audio error - visuals only');
      } finally {
        this.overlay.classList.add('hidden');
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      this.overlay.removeEventListener('click', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    this.overlay.addEventListener('click', unlock);

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
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
    i.on('BracketRight', () => this.cycleReverb(1));
    i.on('BracketLeft', () => this.cycleReverb(-1));
    i.on('KeyK', () => {
      this.skyIndex = (this.skyIndex + 1) % SKY_KEYS.length;
      const preset = SKY_PRESETS[SKY_KEYS[this.skyIndex]];
      this.renderer.applySkyPreset(preset);
      this.flash(`Sky: ${preset.name}`);
    });
    i.on('KeyV', () => this.cycleEngine());
    i.on('KeyN', () => {
      this.skids.clear();
      this.flash('Marks cleared');
    });
    i.on('KeyH', () => {
      this.helpEl.classList.toggle('hidden');
    });
    i.on('KeyP', () => {
      this.paused = !this.paused;
      this.flash(this.paused ? 'Paused' : 'Running', 1);
    });
    i.on('KeyG', () => {
      // Reverse gear, since it is not in the automatic's ladder.
      const dt = this.vehicle.drivetrain;
      dt.auto = false;
      dt.requestGear(dt.gear === -1 ? 1 : -1);
      this.flash(dt.gear === -1 ? 'Forward' : 'Reverse');
    });
  }

  cycleReverb(dir) {
    this.reverbIndex = (this.reverbIndex + dir + REVERB_KEYS.length) % REVERB_KEYS.length;
    const key = REVERB_KEYS[this.reverbIndex];
    this.audio.setPreset(key);
    this.flash(`Room: ${REVERB_PRESETS[key].name}`);
  }

  /**
   * Swap between the cross-plane and flat-plane cranks.
   *
   * Same displacement, same pipes, same car -- only the firing table and the
   * rev range change. It is the clearest demonstration that the character of
   * the sound comes out of the model rather than out of a sample library.
   */
  cycleEngine() {
    this.engineIndex = (this.engineIndex + 1) % ENGINE_KEYS.length;
    const def = ENGINES[ENGINE_KEYS[this.engineIndex]];
    this.engineDef = def;

    // Preserve the running state across the swap.
    const prev = this.vehicle.engine;
    this.vehicle.engine = new (prev.constructor)(def);
    this.vehicle.engine.rpm = prev.rpm;
    this.vehicle.engine.omega = prev.omega;
    this.vehicle.engine.running = prev.running;
    this.vehicle.drivetrain.engineDef = def;

    this.audio.swapEngine(def);
    this.flash(def.name);
  }

  respawn() {
    // Put the car back on the centreline, pointing down the track, at the
    // nearest point rather than at the start line -- being teleported a
    // kilometre backwards for running wide is not a useful punishment.
    const sp = this.track.spline;
    let pose;
    if (this.vehicle && (this.vehicle.x !== 0 || this.vehicle.z !== 0)) {
      const p = sp.project(this.vehicle.x, this.vehicle.z);
      const f = sp.frameAt(p.s + 6);
      pose = { x: f.x, z: f.z, yaw: Math.atan2(f.tx, f.tz) };
    } else {
      pose = this.track.startPose;
    }
    const wasRunning = this.vehicle.engine.running;
    this.vehicle.reset(pose.x, pose.z, pose.yaw);
    if (wasRunning || this.audio.ready) {
      this.vehicle.engine.running = true;
      this.vehicle.engine.rpm = this.engineDef.idleRpm;
      this.vehicle.engine.omega = (this.engineDef.idleRpm * 2 * Math.PI) / 60;
    }
    this.rig.snap = true;
    for (const w of this.car.wheels) this.skids.breakTrail(w.name);
    this.offTrackTimer = 0;
  }

  /**
   * Lay skid marks and puff smoke where the tyres are actually sliding.
   *
   * Contact points come from the visual wheel positions, which are derived
   * from the same geometry the physics uses -- so the marks land under the
   * tyres even though the physics itself is single-track.
   */
  updateTyreEffects(t, dt) {
    const sp = Math.sin(t.yaw);
    const cp = Math.cos(t.yaw);
    const leftX = cp;
    const leftZ = -sp;
    const speed = t.speed;

    for (const w of this.car.wheels) {
      const slip = w.isFront ? t.slipF : t.slipR;
      const halfTrack = MUSCLE_CAR.trackWidth / 2 * w.side;
      const along = w.isFront ? this.vehicle.a : -this.vehicle.b;
      const x = t.x + sp * along + leftX * halfTrack;
      const z = t.z + cp * along + leftZ * halfTrack;

      // Marks start once the tyre is past its friction peak, not merely
      // working. Below that a tyre leaves nothing visible.
      const surface = this.track.surfaceAt(x, z);
      const onPaved = surface === 'asphalt' || surface === 'paint' || surface === 'kerb';
      const intensity = Math.max(0, slip - 1.05);
      if (intensity > 0.02 && speed > 1.2 && onPaved) {
        this.skids.lay(w.name, x, z, leftX, leftZ, w.isFront ? 0.28 : 0.33, Math.min(1, intensity));
        if (!w.isFront || intensity > 0.6) {
          // Smoke rate scales with how hard it is sliding.
          const puffs = Math.min(3, Math.floor(intensity * 2.2) + 1);
          for (let p = 0; p < puffs; p++) {
            this.smoke.emit(x, z, Math.min(1, intensity * 0.7), sp * t.speed, cp * t.speed);
          }
        }
      } else {
        this.skids.breakTrail(w.name);
      }

      // Dust off the grass, regardless of slip.
      if ((surface === 'grass' || surface === 'gravel') && speed > 4) {
        this.smoke.emit(x, z, 0.32, sp * t.speed * 0.4, cp * t.speed * 0.4);
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

    // --- visuals ---------------------------------------------------------
    this.car.setInteriorView(this.rig.mode === 'cockpit');
    this.car.update(t, dt, controls.brake);
    this.rig.update(t, dt);
    this.renderer.updateShadow(this.car.group.position);
    this.renderer.sky.update(dt);
    this.updateTyreEffects(t, dt);

    return { t, controls, surface, offTrack, grip: this.track.gripAt(t.x, t.z) };
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    // Clamp so a background tab or a hitch cannot teleport the car.
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

    this.renderer.render();

    if (this.message && this.time > this.messageUntil) this.message = null;
    const info = this.renderer.info.render;
    this.hud.render({
      telemetry: frame.t,
      engine: this.engineDef,
      lap: this.lap,
      controls: frame.controls,
      info: {
        fps: this.fps,
        drawCalls: info.calls,
        tris: info.triangles,
        cpu: this.audio.cpu,
        sampleRate: this.audio.sampleRate,
        audioReady: this.audio.ready,
        reverb: this.audio.preset.name,
        engineName: this.engineDef.name.replace('6.4L ', ''),
        cameraMode: this.rig.mode,
        surface: frame.surface,
        grip: frame.grip,
        autoBox: this.vehicle.drivetrain.auto,
        sparkCut: this.vehicle.engine.sparkCut,
        offTrack: frame.offTrack,
        time: this.time,
        message: this.paused ? 'Paused - P to resume' : this.message,
      },
    });

    this.input.endFrame();
  }
}

// Surface load errors rather than failing to a black screen.
try {
  window.sim = new Sim();
} catch (err) {
  console.error(err);
  const o = document.getElementById('overlay');
  if (o) {
    o.classList.remove('hidden');
    o.innerHTML = `<div class="card"><h1>Failed to start</h1><pre>${String(
      err && err.stack ? err.stack : err
    )}</pre></div>`;
  }
}
