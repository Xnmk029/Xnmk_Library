// 固定步长主循环：生存数值必须定步长积分，否则快进/切标签页会漂移。
// 两个时钟：simDt（真实秒，物理/AI）与 gameDt（游戏分钟，生存/天气/时间）。
export const SIM_DT = 1 / 60;
const MAX_STEPS = 5;          // 单帧最多追 5 步，防止卡顿后爆炸
const MAX_FRAME = 0.25;       // dt 上限

export class Loop {
  constructor({ step, render, onSecond }) {
    this.step = step;            // (simDt, gameDt) => void
    this.render = render;        // (alpha) => void
    this.onSecond = onSecond;    // 每秒回调（FPS 统计）
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.raf = 0;
    this.frames = 0;
    this.simSteps = 0;
    this.fps = 0;
    this.frameMs = 0;
    this._fpsAcc = 0; this._fpsFrames = 0; this._msAcc = 0;
    this.timeScale = 1;          // 游戏时间倍率 ×1/2/5/20
    this.paused = false;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this._tick);
  }
  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  /** 切回标签页时丢弃积压时间，避免"瞬间模拟三小时" */
  reset() { this.acc = 0; this.last = performance.now(); }

  _tick(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    this._msAcc += dt * 1000;

    if (!this.paused) {
      this.acc += dt;
      let steps = 0;
      const gameDtPerStep = SIM_DT * 60 * this.timeScale;   // 1 真实秒 = 60 游戏分钟 × timeScale
      while (this.acc >= SIM_DT && steps < MAX_STEPS) {
        this.step(SIM_DT, gameDtPerStep / 60);
        this.acc -= SIM_DT;
        steps++;
        this.simSteps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;                // 追不上就丢弃，宁可慢放不要卡死
    }

    this.render(this.paused ? 1 : this.acc / SIM_DT);
    this.frames++;

    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc >= 1) {
      this.fps = Math.round(this._fpsFrames / this._fpsAcc);
      this.frameMs = +(this._msAcc / this._fpsFrames).toFixed(2);
      this._fpsAcc = 0; this._fpsFrames = 0; this._msAcc = 0;
      if (this.onSecond) this.onSecond(this.fps, this.frameMs);
    }
  }

  /** 无头测试用：确定性推帧，不依赖 rAF */
  stepN(n) {
    for (let i = 0; i < n; i++) this.step(SIM_DT, SIM_DT * 60 * this.timeScale);
    this.simSteps += n;
    this.frames += n;
  }
}
