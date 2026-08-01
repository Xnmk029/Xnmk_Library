// 浏览器端引擎音频驱动：AudioWorklet 为主、ScriptProcessor 兜底。
// 两个路径共用同一份 DSP 状态接口，方便二阶段 HUD/模拟器集成。
// 注意：engine-dsp.js 必须以经典脚本先于 bundle 加载（提供 window.EngineDSP 兜底），
// Worklet 模块 URL 使用 document.baseURI（bundle 后 import.meta.url 会 404）。

export class EngineDriver {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.mode = 'none'; // 'worklet' | 'script'
    this.ready = false;
    this.fallback = null;
    this.state = { rpm: 800, throttle: 0, ignition: true, cutoff: false, preset: 'hall', quality: 'high', firingOrder: 'crossplane', noiseGain: 1 };
  }

  async init() {
    if (this.ready) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) throw new Error('当前环境不支持 Web Audio');
    this.ctx = new AC();
    // 音频必须在用户手势后启动
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    try {
      const workletUrl = new URL('./src/engine-dsp.js', document.baseURI);
      await this.ctx.audioWorklet.addModule(workletUrl.href);
      this.node = new AudioWorkletNode(this.ctx, 'engine-dsp', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        parameterData: { rpm: this.state.rpm, throttle: this.state.throttle }
      });
      this.node.port.onmessage = (e) => {
        if (e.data && e.data.ready) this.ready = true;
      };
      this.node.port.postMessage({ ...this.state });
      this.mode = 'worklet';
    } catch (err) {
      console.warn('[EngineDriver] AudioWorklet 不可用，回退 ScriptProcessor：', err.message);
      this.mode = 'script';
      const DSP = globalThis.EngineDSP;
      if (!DSP) throw new Error('缺少经典脚本 engine-dsp.js（未提供 window.EngineDSP 兜底）');
      this.fallback = DSP.createEngine({ sampleRate: this.ctx.sampleRate, quality: this.state.quality });
      this.fallback.update(this.state);
      const sp = this.ctx.createScriptProcessor(4096, 0, 2);
      sp.onaudioprocess = (e) => {
        const outL = e.outputBuffer.getChannelData(0);
        const outR = e.outputBuffer.getChannelData(1);
        const st = this.state;
        for (let i = 0; i < outL.length; i++) {
          this.fallback.update({ rpm: st.rpm, throttle: st.throttle });
          const s = this.fallback.processSample();
          outL[i] = s[0];
          outR[i] = s[1];
        }
      };
      this.node = sp;
      this.ready = true;
    }
    this.node.connect(this.ctx.destination);
  }

  setState(patch) {
    Object.assign(this.state, patch);
    if (!this.node) return;
    if (this.mode === 'worklet') {
      this.node.port.postMessage(patch);
    } else if (this.fallback) {
      this.fallback.update(patch);
    }
  }

  setRpm(rpm) { this.setState({ rpm }); }
  setThrottle(throttle) { this.setState({ throttle }); }
  setPreset(preset) { this.setState({ preset }); }
  setQuality(quality) { this.setState({ quality }); }
  setFiringOrder(firingOrder) { this.setState({ firingOrder }); }

  suspend() { if (this.ctx) return this.ctx.suspend(); }
  resume() { if (this.ctx) return this.ctx.resume(); }
}
