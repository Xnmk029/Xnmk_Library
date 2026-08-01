// V4f 主入口：物理 + 渲染 + 音频 + 输入 + HUD。
// 经典脚本打包后暴露 window.Sim；Node 冒烟用 headless 模式跑 12 帧。
import { Vehicle } from './sim/vehicle.mjs';
import { Track } from './track/track.mjs';
import { buildScene } from './render/scene-builder.mjs';
import { loadCar } from './render/car-builder.mjs';
import { ChaseCamera, CAMERA_MODES } from './render/camera-controller.mjs';
import { HUD } from './render/hud.mjs';
import { InputManager } from './ui/input.mjs';
import { applySky, SKY_PRESETS } from './render/sky.mjs';
import { EngineDriver } from './engine-driver.mjs';

const PHYS_DT = 1 / 240;
const WHEEL_R = 0.352;
const FRONT_AXLE = 1.473;
const REAR_AXLE = -1.473;
const TRACK_W = 1.62;

export class Sim {
  constructor(opts) {
    opts = opts || {};
    this.headless = !!opts.headless;
    this.container = opts.container || (typeof document !== 'undefined' ? document.body : null);
    this.canvas = opts.canvas || null;
    this.vehicle = new Vehicle();
    this.track = new Track();
    this.time = 0;
    this.paused = false;
    this.presetIndex = 3;
    this.skyIndex = 1;
    this.lapStart = 0;
    this.lapLast = null;
    this.lapInvalid = false;
    this._passedStart = false;
    this._frames = 0;
    this._fpsTime = 0;
    this._fps = 60;
    this._accum = 0;
    this._audio = null;
    this._audioReady = false;
    this._helpVisible = false;
  }

  async init() {
    if (!this.headless && this.container) {
      const THREE = globalThis.THREE;
      if (!THREE) throw new Error('缺少 three.classic.js');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);
      }
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.renderer.shadowMap.enabled = true;
      this.renderer.toneMappingExposure = 1.0;
      this.scene = buildScene(THREE);
      this.scene.userData.renderer = this.renderer;
      const W = this.container.clientWidth || 960;
      const H = this.container.clientHeight || 540;
      this.renderer.setSize(W, H);
      this.renderer.setPixelRatio(Math.min(2, (globalThis.devicePixelRatio || 1)));
      this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
      this.chaseCam = new ChaseCamera(THREE, this.camera);
      const base = new URL('.', document.baseURI).href;
      this.car = await loadCar(THREE, base);
      this.carRoot = new THREE.Group();
      this.carRoot.add(this.car);
      this.scene.add(this.carRoot);
      applySky(THREE, this.scene, SKY_PRESETS[this.skyIndex].id);
      this.hud = new HUD(this.container);
      this.input = new InputManager(this);
      this._resizeHandler = () => {
        const w = this.container.clientWidth, h = this.container.clientHeight;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', this._resizeHandler);
    }
    return this;
  }

  async _ensureAudio() {
    if (this._audioReady || this.headless) return;
    if (!this._audio) {
      this._audio = new EngineDriver();
      await this._audio.init();
    }
    this._audioReady = true;
  }

  start() {
    if (this.headless) {
      for (let i = 0; i < 12; i++) this.update(1 / 60);
      return;
    }
    const loop = (ts) => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - (this._lastTs || ts)) / 1000);
      this._lastTs = ts;
      if (!this.paused) this.update(dt);
      this._frames++;
      this._fpsTime += dt;
      if (this._fpsTime >= 0.5) {
        this._fps = Math.round(this._frames / this._fpsTime);
        this._frames = 0; this._fpsTime = 0;
      }
      this.render();
    };
    this._raf = requestAnimationFrame(loop);
  }

  update(dt) {
    this._accum += dt;
    const input = this.input ? this.input.poll() : { steer: 0, throttle: 0.3, brake: 0, clutch: 1 };
    let steps = 0;
    while (this._accum >= PHYS_DT && steps < 8) {
      const proj = this.track.project(this.vehicle.x, this.vehicle.y);
      this.vehicle.setSurfaceMu(proj.mu);
      this.vehicle.step(PHYS_DT, {
        steer: input.steer,
        throttle: input.throttle,
        brake: input.brake,
        handbrake: input.handbrake,
        clutch: input.clutch
      });
      this._accum -= PHYS_DT;
      steps++;
      this._lapLogic(proj);
    }
    this.time += dt;
    this._syncAudio();
    if (this.headless) return;
    this._syncCarVisuals(dt);
    this.chaseCam.update(dt, this.vehicle, this.time);
    this.hud.update(this.vehicle, {
      fps: this._fps,
      audioMode: this._audio ? this._audio.mode : (this.headless ? 'none' : 'pending'),
      preset: this._presetName(),
      mu: this.track.project(this.vehicle.x, this.vehicle.y).mu,
      capPct: Math.round((this.vehicle.steerAssist.capLow / 0.45) * 100),
      lap: this.lapLast,
      lapInvalid: this.lapInvalid
    });
    // 动态阴影跟随车辆
    const sun = this._findSun();
    if (sun) {
      const T = globalThis.THREE;
      sun.position.set(this.vehicle.x + 35, 85, this.vehicle.y - 35);
      sun.target.position.set(this.vehicle.x, 0, this.vehicle.y);
      this.scene.updateMatrixWorld();
    }
  }

  render() {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  _presetName() {
    return (globalThis.EngineDSP ? globalThis.EngineDSP.REVERB_PRESETS[this.presetIndex] : null)?.name || '大厅';
  }

  _findSun() {
    let sun = null;
    if (!this.scene) return null;
    this.scene.traverse((o) => {
      if (!sun && o instanceof globalThis.THREE.DirectionalLight) sun = o;
    });
    return sun;
  }

  _syncAudio() {
    const v = this.vehicle;
    if (!this._audio) return;
    this._audio.setState({
      rpm: v.rpm,
      throttle: v.throttle,
      ignition: v.ignition,
      cutoff: v.drivetrain.cutoff
    });
  }

  _syncCarVisuals(dt) {
    const T = globalThis.THREE;
    const v = this.vehicle;
    this.carRoot.position.set(v.x, 0, v.y);
    this.carRoot.rotation.y = v.yaw;
    // 姿态：加速翘头（rotation.x = -ax），左转外侧倾（rotation.z = +ay）
    this.car.rotation.x = -v.ax * 0.006;
    this.car.rotation.z = v.ay * 0.005;
    const wheels = this.car.userData.wheels;
    const keys = ['fl', 'fr', 'rl', 'rr'];
    for (let i = 0; i < 4; i++) {
      const w = wheels[keys[i]];
      if (!w) continue;
      if (i < 2) w.steerPivot.rotation.y = v.wheelDelta[i];
      // 正 omega（前进）→ spin.rotation.x += omega*dt（轮胎冠部朝车头滚动）
      w.spinPivot.rotation.x += v.tires[i].omega * dt;
    }
    // 尾灯随刹车发光
    this.car.traverse((o) => {
      if (o.material && o.material.name === 'taillight') {
        o.material.emissiveIntensity = v.brake > 0.05 ? 3.0 : 1.0;
      }
    });
    // 座舱模式隐藏外壳
    const cockpit = this.chaseCam.mode === 2;
    this.car.userData.bodyGroup.visible = !cockpit;
  }

  _lapLogic(proj) {
    const v = this.vehicle;
    if (proj.u < 0.05 && v.speedKmh > 5) {
      if (!this._passedStart) {
        this._passedStart = true;
        if (this.lapStart > 0) {
          this.lapLast = this.time - this.lapStart;
          if (this.lapInvalid) this.lapLast = null;
        }
        this.lapStart = this.time;
        this.lapInvalid = false;
      }
    } else if (proj.u > 0.5) {
      this._passedStart = false;
    }
    if (Math.abs(proj.lateral) > 4.5) this.lapInvalid = true;
  }

  shiftGear(d) { if (this.vehicle.autoShift) this.vehicle.autoShift = false; this.vehicle.drivetrain.shift(d); }
  toggleAutoShift() { this.vehicle.autoShift = !this.vehicle.autoShift; }
  toggleReverse() { this.vehicle.drivetrain.setReverse(!this.vehicle.drivetrain.reverse); }
  toggleIgnition() { this.vehicle.ignition = !this.vehicle.ignition; this._ensureAudio(); }
  toggleTC() { this.vehicle.tcOn = !this.vehicle.tcOn; }
  toggleABS() { this.vehicle.absOn = !this.vehicle.absOn; }
  toggleAssist() { this.vehicle.assistOn = !this.vehicle.assistOn; this.vehicle.steerAssist.enabled = this.vehicle.assistOn; }
  togglePause() { this.paused = !this.paused; }
  reset() {
    this.vehicle.reset();
    this.lapStart = 0; this.lapLast = null; this.lapInvalid = false; this._passedStart = false;
    this._accum = 0;
  }
  toggleHelp() {
    this._helpVisible = !this._helpVisible;
    if (this.hud) {
      this.hud.showHelp(this._helpVisible ? HELP_TEXT : '');
    }
  }
  cycleCamera() { if (this.chaseCam) this.chaseCam.setMode(this.chaseCam.mode + 1); }
  cyclePreset(d) {
    const n = globalThis.EngineDSP ? globalThis.EngineDSP.REVERB_PRESETS.length : 8;
    this.presetIndex = (this.presetIndex + d + n) % n;
    if (this._audio) this._audio.setPreset(globalThis.EngineDSP.REVERB_PRESETS[this.presetIndex].id);
  }
  cycleSky(d) {
    this.skyIndex = (this.skyIndex + d + SKY_PRESETS.length) % SKY_PRESETS.length;
    if (!this.headless) applySky(globalThis.THREE, this.scene, SKY_PRESETS[this.skyIndex].id);
  }
  toggleFiringOrder() {
    const cur = this._firingOrder || 'crossplane';
    this._firingOrder = cur === 'crossplane' ? 'flatplane' : 'crossplane';
    if (this._audio) this._audio.setFiringOrder(this._firingOrder);
  }
}

const HELP_TEXT = `W/S 油门/刹车 · A/D 转向 · Space 手刹 · Shift 离合 · Q/E 换挡 · M 自动/手动 · G 倒挡 · I 点火 · V 曲轴音色 · N/K 混响 · T/B TC/ABS · Y 转向辅助 · C 视角 · R 复位 · P 暂停 · H 帮助 · F11 全屏`;

// 兜底：浏览器端自动启动
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (window.__v4fStarted) return;
    window.__v4fStarted = true;
    const sim = new Sim({ container: document.getElementById('app') || document.body });
    sim.init().then(() => sim.start()).catch((e) => {
      console.error('V4f 启动失败：', e);
      const d = document.getElementById('app') || document.body;
      d.insertAdjacentHTML('beforeend', `<pre style="color:#f66;padding:12px">${e.stack || e.message}</pre>`);
    });
    window.sim = sim;
  });
}
