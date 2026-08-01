// src/main-sim.mjs — 驾驶模拟主入口（打包为经典脚本 sim.bundle.js）
//
// 组装：车辆物理 → 引擎声音驱动 → Three.js 场景 → 输入 → HUD。
// 环境音（胎噪/风噪/路缘）用少量原生节点实现，随速度/滑移/视角变化。

import { Vehicle } from './sim/vehicle.mjs';
import { AudioEngineDriver } from './engine-driver.mjs';
import { GameScene } from './render/scene.js';
import { InputManager } from './ui/input.js';
import { Hud } from './ui/hud.js';

export class Sim {
  constructor() {
    this.state = 'title';     // title / running / paused
    this.vehicle = new Vehicle();
    this.input = new InputManager();
    this.audio = new AudioEngineDriver({ quality: 'high' });
    this.hud = null;
    this.scene = null;
    this.lastT = performance.now();
    this.accT = 0;
    this.fixedH = 1 / 120;
    this.autoTrans = true;
    this.envNoise = null;
    this.envGain = 0;
    this.diag = {};
    this.helpVisible = false;
    this._initUI();
    this._initEnvAudio();
    this._bindEvents();
    this._loop();
  }

  _initUI() {
    const el = (id) => document.getElementById(id);
    this.titleEl = el('title-screen');
    this.hudRoot = el('hud-root');
    this.pauseEl = el('pause-screen');
    this.helpEl = el('help-screen');
    this.statusEl = el('audio-status');
    this.btnStart = el('btn-start');
    this.btnStart.addEventListener('click', () => this.start());
    // 触屏虚拟按键（自动显示）
    this.touchUI = el('touch-ui');
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.touchUI.style.display = 'flex';
      const bind = (id, fn) => {
        const b = document.getElementById(id);
        if (!b) return;
        b.addEventListener('touchstart', (e) => { e.preventDefault(); fn(true); });
        b.addEventListener('touchend', () => fn(false));
      };
      bind('t-throttle', (v) => { this._touch = this._touch || {}; this._touch.throttle = v ? 1 : 0; });
      bind('t-brake', (v) => { this._touch = this._touch || {}; this._touch.brake = v ? 1 : 0; });
      bind('t-left', (v) => { this._touch = this._touch || {}; this._touch.steer = (this._touch.steer || 0) + (v ? -1 : 1) * 0; this._touch.left = v; });
      bind('t-right', (v) => { this._touch = this._touch || {}; this._touch.right = v; });
      bind('t-cam', () => { this._touch.cam = true; });
      bind('t-reset', () => { this._touch.reset = true; });
      bind('t-rev', () => { this._touch.reverse = true; });
    }
  }

  _initEnvAudio() {
    // 环境音在音频启动后建立（wind + tire noise 原生节点）
    this.envNodes = null;
  }

  async _setupEnvAudio() {
    if (this.envNodes || !this.audio.ctx) return;
    const ctx = this.audio.ctx;
    // 白噪声源（循环）→ 两个带通 → 风噪/胎噪
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const wind = ctx.createBiquadFilter();
    wind.type = 'bandpass'; wind.frequency.value = 420; wind.Q.value = 0.6;
    const windGain = ctx.createGain(); windGain.gain.value = 0;
    const tire = ctx.createBiquadFilter();
    tire.type = 'bandpass'; tire.frequency.value = 220; tire.Q.value = 0.9;
    const tireGain = ctx.createGain(); tireGain.gain.value = 0;
    src.connect(wind).connect(windGain).connect(this.audio.envBus);
    src.connect(tire).connect(tireGain).connect(this.audio.envBus);
    src.start();
    this.envNodes = { windGain, tireGain, wind, tire };
  }

  start() {
    if (this.state === 'running') return;
    this.audio.start().then((ok) => {
      if (this.statusEl) {
        this.statusEl.textContent = ok ? `音频: ${this.audio.lastStatus}` : this.audio.lastStatus;
      }
      if (ok) this._setupEnvAudio();
    });
    this.titleEl.style.display = 'none';
    this.hud = new Hud(this.hudRoot);
    this.scene = new GameScene(document.getElementById('scene-root'));
    this.vehicle.setInput({ gearUp: true }); // 挂 1 挡
    this.state = 'running';
  }

  _bindEvents() {
    this.input.onEvent = (action) => {
      switch (action) {
        case 'camera': this.scene && this.scene.cam.cycle(); break;
        case 'reverbNext': this.audio.cyclePreset(1); break;
        case 'skyNext': this.scene && this.scene.sky.cycle(); break;
        case 'tc': this.vehicle.setInput({ tcOn: !this.vehicle.drivetrain.tcOn }); break;
        case 'abs': this.vehicle.setInput({ absOn: !this.vehicle.drivetrain.absOn }); break;
        case 'assist': this.vehicle.setInput({ assistOn: !this.vehicle.steerAssist.on }); break;
        case 'crank': {
          const next = this.vehicle.crankKind === 'flat' ? 'cross' : 'flat';
          this.vehicle.crankKind = next;
          this.audio.setCrankKind(next);
          break;
        }
      }
    };
  }

  _inputSnapshot(dt) {
    const i = this.input.poll(dt);
    const t = this._touch || {};
    // 触屏合成
    let steer = i.steer;
    if (t.left || t.right) steer = (t.right ? 1 : 0) - (t.left ? 1 : 0);
    return {
      throttle: Math.max(i.throttle, t.throttle || 0),
      brake: Math.max(i.brake, t.brake || 0),
      steer,
      handbrake: i.handbrake,
      clutch: i.clutch,
      gearUp: i.gearUp, gearDown: i.gearDown,
      reverse: i.reverse || t.reverse,
      ignition: i.ignition,
      tcOn: i.tcOn, absOn: i.absOn, assistOn: i.assistOn,
      reset: i.reset || t.reset,
      pause: i.pause,
      cam: t.cam,
    };
  }

  _handleEvents(inp) {
    if (inp.pause) {
      this.state = this.state === 'running' ? 'paused' : 'running';
      this.pauseEl.style.display = this.state === 'paused' ? 'flex' : 'none';
    }
    if (this.state !== 'running') return;
    if (inp.reverse) this.vehicle.setInput({ reverse: true });
    if (inp.reset) { this.vehicle.reset(); this.vehicle.setInput({ gearUp: true }); }
    if (inp.ignition === false) this.vehicle.setInput({ ignition: false, clutch: 1 });
    if (inp.cam) { this.scene.cam.cycle(); this._touch.cam = false; }
    if (this._touch) { this._touch.reset = false; this._touch.reverse = false; this._touch.cam = false; }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.state === 'title') return;

    const inp = this._inputSnapshot(dt);
    this._handleEvents(inp);
    if (this.state !== 'running') return;

    // 固定步进物理
    this.accT += dt;
    let guard = 0;
    while (this.accT >= this.fixedH && guard++ < 30) {
      this.vehicle.setInput({
        throttle: inp.throttle,
        brake: inp.brake,
        steer: inp.steer,
        handbrake: inp.handbrake,
        clutch: inp.clutch,
        gearUp: inp.gearUp,
        gearDown: inp.gearDown,
        reverse: inp.reverse,
        ignition: inp.ignition,
        tcOn: inp.tcOn, absOn: inp.absOn, assistOn: inp.assistOn,
      });
      this.vehicle.step(this.fixedH);
      this.accT -= this.fixedH;
    }
    const v = this.vehicle.snapshot();

    // 声音驱动
    this.audio.updateFromVehicle(v);
    // 环境音
    if (this.envNodes) {
      const speedF = Math.min(1, v.speed / 55);
      const tireAmt = Math.min(1, (Math.abs(v.wheelSlipRatio[2]) + Math.abs(v.wheelSlipDeg[2]) / 60)) * speedF;
      this.envNodes.windGain.gain.value = speedF * speedF * 0.35;
      this.envNodes.tireGain.gain.value = Math.max(0, tireAmt * 0.5);
      this.envNodes.wind.frequency.value = 300 + speedF * 900;
    }

    // 渲染
    this.scene.render(v, dt);
    // HUD
    this.hud.updateLap(this.scene.track.nearest(v.x, v.y).t, now / 1000);
    this.hud.update(v, {
      FPS: Math.round(1 / Math.max(1e-4, dt)),
      DSP: this.audio.lastStatus,
      mu: v.surfaceMu.toFixed(2),
      cap: (this.vehicle.steerAssist.capRatio * 100).toFixed(0) + '%',
      reverb: this.audio.currentPreset(),
    });
  }
}
