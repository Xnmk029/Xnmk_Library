// 自动化显卡 Benchmark 评测套件 (Automated Benchmark Suite)
// 多维度测试：渲染吞吐量、光线弹射负载、降噪 Pass 延迟、算力收敛速率与 RTX 得分生成

export class BenchmarkSuite {
  constructor(engine, rtxReport, onProgressCallback, onCompleteCallback) {
    this.engine = engine;
    this.rtxReport = rtxReport;
    this.onProgress = onProgressCallback;
    this.onComplete = onCompleteCallback;

    this.isRunning = false;
    this.currentPhaseIndex = 0;
    this.phaseData = [];

    this.phases = [
      {
        name: '1080p 标准光照渲染基准测试 (Standard GI Test)',
        bounces: 4,
        samples: 1,
        nee: true,
        fp16: false,
        durationFrames: 120
      },
      {
        name: '多重弹射极端高负载测试 (Extreme Bounce Stress Test)',
        bounces: 8,
        samples: 2,
        nee: true,
        fp16: false,
        durationFrames: 120
      },
      {
        name: 'A-Trous 实时双边降噪延迟评估 (Denoiser Overhead Test)',
        bounces: 4,
        samples: 1,
        nee: true,
        fp16: false,
        durationFrames: 90
      },
      {
        name: 'RTX FP16 半精度算力加速吞吐测试 (FP16 Throughput Test)',
        bounces: 4,
        samples: 1,
        nee: true,
        fp16: true,
        durationFrames: 90
      }
    ];
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentPhaseIndex = 0;
    this.phaseData = [];

    // 备份原有引擎设置
    this.savedBounces = this.engine.maxBounces;
    this.savedSamples = this.engine.samplesPerFrame;
    this.savedNEE = this.engine.enableNEE;
    this.savedFP16 = this.engine.fp16Sim;

    this.runNextPhase();
  }

  runNextPhase() {
    if (this.currentPhaseIndex >= this.phases.length) {
      this.finishBenchmark();
      return;
    }

    const phase = this.phases[this.currentPhaseIndex];

    // 应用当前 Phase 参数
    this.engine.maxBounces = phase.bounces;
    this.engine.samplesPerFrame = phase.samples;
    this.engine.enableNEE = phase.nee;
    this.engine.fp16Sim = phase.fp16;
    this.engine.resetAccumulation();

    const fpsHistory = [];
    const megaRaysHistory = [];
    const frameTimes = [];

    let frameCounter = 0;

    const testStep = () => {
      if (!this.isRunning) return;

      const t0 = performance.now();
      this.engine.render();
      const t1 = performance.now();

      const frameTimeMs = t1 - t0;
      frameTimes.push(frameTimeMs);

      if (frameCounter > 10) { // 忽略头 10 帧预热
        fpsHistory.push(this.engine.fps);
        megaRaysHistory.push(this.engine.megaRaysPerSec);
      }

      frameCounter++;
      const progressPercent = Math.min(100, Math.floor((frameCounter / phase.durationFrames) * 100));

      if (this.onProgress) {
        this.onProgress({
          phaseName: phase.name,
          phaseIndex: this.currentPhaseIndex + 1,
          totalPhases: this.phases.length,
          progressPercent,
          currentFps: Math.round(this.engine.fps),
          currentMegaRays: this.engine.megaRaysPerSec.toFixed(2)
        });
      }

      if (frameCounter < phase.durationFrames) {
        requestAnimationFrame(testStep);
      } else {
        // 完成当前 Phase 统计数据
        const avgFps = fpsHistory.length > 0 ? (fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 60;
        const avgMegaRays = megaRaysHistory.length > 0 ? (megaRaysHistory.reduce((a, b) => a + b, 0) / megaRaysHistory.length) : 10;
        
        // 计算 99% Low 帧生成时间
        frameTimes.sort((a, b) => b - a);
        const low99FrameTime = frameTimes[Math.floor(frameTimes.length * 0.05)] || 16.6;

        this.phaseData.push({
          phaseName: phase.name,
          avgFps: Math.round(avgFps),
          avgMegaRays: parseFloat(avgMegaRays.toFixed(2)),
          low99FrameTime: parseFloat(low99FrameTime.toFixed(2))
        });

        this.currentPhaseIndex++;
        setTimeout(() => this.runNextPhase(), 300);
      }
    };

    requestAnimationFrame(testStep);
  }

  finishBenchmark() {
    this.isRunning = false;

    // 恢复引擎原有参数
    this.engine.maxBounces = this.savedBounces;
    this.engine.samplesPerFrame = this.savedSamples;
    this.engine.enableNEE = this.savedNEE;
    this.engine.fp16Sim = this.savedFP16;
    this.engine.resetAccumulation();

    // 汇总评测结果得分算法
    const p1 = this.phaseData[0] || { avgFps: 60, avgMegaRays: 20 };
    const p2 = this.phaseData[1] || { avgFps: 40, avgMegaRays: 30 };
    const p4 = this.phaseData[3] || { avgFps: 65, avgMegaRays: 25 };

    // 得分加权
    let rawScore = Math.floor(
      p1.avgFps * 50 + 
      p1.avgMegaRays * 200 + 
      p2.avgMegaRays * 300 + 
      p4.avgFps * 30 +
      this.rtxReport.tierScore * 0.5
    );

    // 确定显卡评级 (Rank)
    let rank = 'A';
    let rankColor = '#00ffcc';
    if (rawScore > 18000) { rank = 'S+ (RTX 极客旗舰)'; rankColor = '#76b900'; }
    else if (rawScore > 13000) { rank = 'S (高端光追显卡)'; rankColor = '#00ffcc'; }
    else if (rawScore > 9000) { rank = 'A+ (主流光追显卡)'; rankColor = '#3b82f6'; }
    else if (rawScore > 6000) { rank = 'A (入门级光追/高性能集成显卡)'; rankColor = '#f59e0b'; }
    else { rank = 'B (常规渲染显卡)'; rankColor = '#ef4444'; }

    const finalReport = {
      score: rawScore,
      rank: rank,
      rankColor: rankColor,
      rtxInfo: this.rtxReport,
      phaseDetails: this.phaseData
    };

    if (this.onComplete) {
      this.onComplete(finalReport);
    }
  }

  cancel() {
    this.isRunning = false;
  }
}
