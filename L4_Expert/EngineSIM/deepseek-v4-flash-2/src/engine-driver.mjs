// engine-driver.mjs — 引擎声音驱动层
//
// 职责：
//   1. 把驾驶模拟状态（rpm/油门/负载/挡位/离合/点火/断油）平滑映射为 DSP 参数；
//   2. 在浏览器中构建音频图（AudioWorklet 优先，ScriptProcessor 兜底，
//      保证“Audio unavailable”类问题有明确诊断与降级路径）；
//   3. 提供离线渲染入口（Node 侧出 WAV / 单测）；
//   4. 提供 UDP(4001)/HTTP(8081) 桥，供外部驾驶模拟软件直接驱动声音。

import { EngineDSP, REVERB_PRESETS, presetNames } from './engine-dsp.mjs';

// ---------- 离线渲染（Node 与浏览器通用） ----------
export function renderEngine({ seconds = 8, sampleRate = 48000, quality = 'high', paramFn = null, cfg = null }) {
  const dsp = new EngineDSP(sampleRate, cfg, quality);
  return dsp.render(seconds, paramFn);
}

// ---------- 浏览器音频图 ----------
export class AudioEngineDriver {
  constructor({ quality = 'high', onStatus = null } = {}) {
    this.quality = quality;
    this.onStatus = onStatus || (() => {});
    this.ctx = null;
    this.node = null;          // AudioWorkletNode 或 ScriptProcessorNode
    this.master = null;
    this.workletMode = false;
    this.started = false;
    this.lastStatus = '';
    this._paramQueue = [];
  }

  _status(msg) { this.lastStatus = msg; this.onStatus(msg); }

  // 必须由用户手势调用（解决浏览器自动播放策略）
  async start() {
    if (this.started) { await this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this._status('Audio unavailable: no AudioContext'); return false; }
    let ctx = null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    this.ctx = ctx;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* 忽略 */ } }

    // 1) 尝试 AudioWorklet
    try {
      const url = new URL('./engine-dsp.mjs', document.baseURI);
      await ctx.audioWorklet.addModule(url.href);
      const node = new AudioWorkletNode(ctx, 'engine-dsp', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { sampleRate: ctx.sampleRate, quality: this.quality },
      });
      this.node = node;
      this.workletMode = true;
      this._status('audio: worklet');
    } catch (e1) {
      // 2) 兜底：ScriptProcessor（同一份 DSP）
      try {
        const node = ctx.createScriptProcessor(512, 0, 2);
        const dsp = new EngineDSP(ctx.sampleRate, null, this.quality);
        node.onaudioprocess = (ev) => {
          const L = ev.outputBuffer.getChannelData(0);
          const R = ev.outputBuffer.getChannelData(1);
          dsp.process(L.length, L, R);
        };
        this._fallbackDsp = dsp;
        this.node = node;
        this.workletMode = false;
        this._status('audio: scriptprocessor');
      } catch (e2) {
        this._status('Audio unavailable: worklet & fallback failed');
        return false;
      }
    }

    // 主链路：引擎节点 → master 增益 → 压缩/限幅 → 输出
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6; comp.knee.value = 12;
    comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.node.connect(master).connect(comp).connect(ctx.destination);
    this.master = master;

    // 环境音（胎噪/风噪/路缘）由场景侧创建后接入 master 之前，这里预留总线
    this.envBus = ctx.createGain();
    this.envBus.gain.value = 0;
    this.envBus.connect(master);

    this.started = true;
    // 补发排队参数
    for (const m of this._paramQueue) this.send(m);
    this._paramQueue = [];
    return true;
  }

  // 参数消息（Worklet 走 port；兜底走直调）
  send(msg) {
    if (!this.started) { this._paramQueue.push(msg); return; }
    if (this.workletMode && this.node) {
      try { this.node.port.postMessage(msg); } catch (e) { /* 忽略 */ }
    } else if (this._fallbackDsp) {
      this._applyDirect(this._fallbackDsp, msg);
    }
  }
  _applyDirect(dsp, msg) {
    if (!msg) return;
    switch (msg.type) {
      case 'param':
        if (msg.key === 'rpm') dsp.setRpm(msg.value);
        else if (msg.key === 'throttle') dsp.setThrottle(msg.value);
        else if (msg.key === 'load') dsp.setLoad(msg.value);
        else if (msg.key === 'ignition') dsp.setIgnition(msg.value);
        else if (msg.key === 'fuelCut') dsp.setFuelCut(msg.value);
        else if (msg.key === 'stall') dsp.setStall(msg.value);
        break;
      case 'crank': dsp.setCrankKind(msg.value); break;
      case 'preset': dsp.setPreset(msg.value); break;
      case 'quality': dsp.setQuality(msg.value); break;
      case 'backfire': dsp.triggerBackfire(); break;
    }
  }

  setPreset(name) {
    if (!REVERB_PRESETS[name]) return;
    this.send({ type: 'preset', value: name });
  }
  cyclePreset(dir = 1) {
    const names = presetNames();
    const idx = names.indexOf(this.currentPreset());
    const next = names[(idx + dir + names.length) % names.length];
    this.setPreset(next);
    return next;
  }
  currentPreset() {
    // 工作集与兜底各自维护；驱动层缓存
    return this._preset || 'garage';
  }
  setQuality(q) { this.quality = q; this.send({ type: 'quality', value: q }); }
  backfire() { this.send({ type: 'backfire' }); }
  setCrankKind(kind) { this.send({ type: 'crank', value: kind }); }
  setRpm(v) { this.send({ type: 'param', key: 'rpm', value: v }); }
  setThrottle(v) { this.send({ type: 'param', key: 'throttle', value: v }); }
  setLoad(v) { this.send({ type: 'param', key: 'load', value: v }); }
  setIgnition(v) { this.send({ type: 'param', key: 'ignition', value: v }); }
  setFuelCut(v) { this.send({ type: 'param', key: 'fuelCut', value: v }); }
  setStall(v) { this.send({ type: 'param', key: 'stall', value: v }); }

  // 驾驶状态 → DSP 参数（每帧调用；含限速器火花切断与断油映射）
  updateFromVehicle(v) {
    if (!this.started) return;
    const rpm = v.rpm;
    const throttle = v.throttleInput;
    const limiterCut = v.limiterActive || false;
    const coastCut = v.fuelCut || false;
    this.setRpm(rpm);
    this.setThrottle(throttle);
    this.setLoad(v.load !== undefined ? v.load : throttle);
    this.setIgnition(v.ignition !== false);
    this.setFuelCut(limiterCut || coastCut);
    if (v.backfire) { this.backfire(); v.backfire = false; }
    if (v.stall) this.setStall(true);
  }

  suspend() { if (this.ctx) this.ctx.suspend(); }
  resume() { if (this.ctx) this.ctx.resume(); }
}

// ---------- 外部模拟器桥（UDP 4001 + HTTP 8081） ----------
// 供驾驶模拟软件（如 BeamNG/自研）推送 rpm/throttle 驱动声音
export function startBridge({ onState, portUdp = 4001, portHttp = 8081 } = {}) {
  const results = { udp: false, http: false, error: null };
  if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') return results;
  try {
    // 浏览器内通过本地 WebSocket 网关（tools/udp-bridge.mjs 提供）
    const ws = new WebSocket(`ws://${location.hostname}:${portHttp}`);
    ws.onopen = () => { results.udp = true; results.http = true; };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (onState) onState(d);
      } catch (err) { /* 忽略 */ }
    };
    ws.onerror = () => { results.error = 'bridge: ws error'; };
    results.ws = ws;
  } catch (e) {
    results.error = String(e && e.message || e);
  }
  return results;
}
