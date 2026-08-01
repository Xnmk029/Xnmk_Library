// 自动基准：固定场景与机位，多档分辨率顺序测量

const SCENARIOS = [
  { label: '720p · 5 弹射', w: 1280, h: 720, bounces: 5, spp: 1 },
  { label: '1080p · 5 弹射', w: 1920, h: 1080, bounces: 5, spp: 1 },
  { label: '1080p · 10 弹射', w: 1920, h: 1080, bounces: 10, spp: 1 },
  { label: '1440p · 8 弹射', w: 2560, h: 1440, bounces: 8, spp: 1 },
  { label: '4K · 8 弹射', w: 3840, h: 2160, bounces: 8, spp: 1 },
];

const WARMUP_MS = 2000;
const MEASURE_MS = 3000;

class Benchmark {
  constructor() {
    this.active = false;
    this.scenarios = [];
    this.idx = -1;
    this.phase = 'idle';
    this.phaseTime = 0;
    this.frames = 0;
    this.minDt = Infinity;
    this.results = [];
    this.hooks = {};
  }

  start(scenarios, hooks = {}) {
    this.active = true;
    this.scenarios = scenarios;
    this.hooks = hooks;
    this.results = [];
    this.idx = -1;
    this._next();
  }

  _next() {
    this.idx++;
    if (this.idx >= this.scenarios.length) {
      this._finish();
      return;
    }
    const s = this.scenarios[this.idx];
    this.phase = 'warmup';
    this.phaseTime = 0;
    this.frames = 0;
    this.minDt = Infinity;
    this.hooks.onScenarioStart?.(s, this.idx, this.scenarios.length);
  }

  tick(dt) {
    if (!this.active) return;
    this.phaseTime += dt;
    const s = this.scenarios[this.idx];
    if (this.phase === 'warmup') {
      this.hooks.onProgress?.(this.idx, this.phase, this.phaseTime, 0);
      if (this.phaseTime >= WARMUP_MS) {
        this.phase = 'measure';
        this.phaseTime = 0;
        this.frames = 0;
        this.minDt = Infinity;
        this.hooks.onPhase?.(s, this.idx, this.scenarios.length, 'measure');
      }
    } else if (this.phase === 'measure') {
      this.frames++;
      this.minDt = Math.min(this.minDt, dt);
      this.hooks.onProgress?.(this.idx, this.phase, this.phaseTime, this.frames);
      if (this.phaseTime >= MEASURE_MS) {
        const avgDt = this.phaseTime / this.frames;
        const fps = 1000 / avgDt;
        const msamples = (s.w * s.h * s.spp * fps) / 1e6;
        const row = {
          ...s,
          fps,
          minFps: 1000 / Math.max(this.minDt, 0.001),
          msPerFrame: avgDt,
          msamples,
        };
        this.results.push(row);
        this.hooks.onScenarioDone?.(row, this.idx, this.scenarios.length);
        this._next();
      }
    }
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.hooks.onAbort?.();
  }

  _finish() {
    this.active = false;
    let score = 1;
    if (this.results.length) {
      let logSum = 0;
      for (const r of this.results) logSum += Math.log(r.msamples);
      score = Math.exp(logSum / this.results.length);
    }
    this.hooks.onDone?.(this.results, score);
  }
}
