/**
 * V8 Cross-Plane Engine Sound Simulator
 * 参考: https://github.com/ange-yaghi/engine-sim
 * 
 * 特征: 十字曲轴Cross-Plane V8, 等长排气芭蕉(Equal-Length Headers), 混响优化
 *  firing order: 1-8-4-3-6-5-7-2
 *  曲轴夹角: 90° cross-plane
 *  点火间隔: 交替 90°/270° (产生标志性"burble"煮水声)
 */

export class EngineSoundSimulator {
    constructor() {
        this.audioCtx = null;
        this.initialized = false;
        this.running = false;

        // 引擎参数 (6.2L V8 类似 LT4)
        this.params = {
            displacement: 6.2,        // 排量 (L)
            cylinders: 8,
            idleRPM: 800,
            maxRPM: 7200,
            redlineRPM: 6800,
            firingOrder: [1, 8, 4, 3, 6, 5, 7, 2], // Cross-plane V8
            // 十字曲轴点火间隔 (曲轴角度)
            firingIntervals: [90, 270, 90, 270, 90, 270, 90, 270],
            headerType: 'equal-length',  // 等长芭蕉
        };

        // 实时状态
        this.state = {
            rpm: 0,
            targetRPM: 800,
            throttle: 0,
            crankAngle: 0,
            ignition: false,
            starterEngaged: false,
        };

        // 音频节点
        this.nodes = {};
        this.reverbLevel = 0.35;
        this.masterVolume = 0.7;
    }

    async init() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this.audioCtx;

        // === 主输出链 ===
        this.nodes.masterGain = ctx.createGain();
        this.nodes.masterGain.gain.value = this.masterVolume;

        // 混响 (Convolver) - 模拟车库/隧道空间感
        this.nodes.convolver = ctx.createConvolver();
        this.nodes.convolver.buffer = this._generateReverbIR(2.2, 3.5);

        this.nodes.reverbGain = ctx.createGain();
        this.nodes.reverbGain.gain.value = this.reverbLevel;

        this.nodes.dryGain = ctx.createGain();
        this.nodes.dryGain.gain.value = 1.0 - this.reverbLevel * 0.5;

        // 干声 + 湿声混合
        this.nodes.masterGain.connect(this.nodes.dryGain);
        this.nodes.masterGain.connect(this.nodes.convolver);
        this.nodes.convolver.connect(this.nodes.reverbGain);
        this.nodes.dryGain.connect(ctx.destination);
        this.nodes.reverbGain.connect(ctx.destination);

        // === 排气声合成链 ===
        this._createExhaustChain();
        // === 进气声合成链 ===
        this._createIntakeChain();
        // === 机械噪声 ===
        this._createMechanicalNoise();

        this.initialized = true;
    }

    /**
     * 生成脉冲响应 (模拟混响空间)
     * 优化: 使用指数衰减噪声，低性能消耗
     */
    _generateReverbIR(duration, decay) {
        const ctx = this.audioCtx;
        const sampleRate = ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = ctx.createBuffer(2, length, sampleRate);

        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                // 指数衰减 + 早期反射模拟
                const envelope = Math.exp(-decay * t);
                // 早期反射 (前50ms内的离散回声)
                let earlyReflection = 0;
                if (t < 0.05) {
                    const reflections = [0.008, 0.015, 0.023, 0.034, 0.045];
                    for (const r of reflections) {
                        if (Math.abs(t - r) < 0.001) {
                            earlyReflection += 0.6;
                        }
                    }
                }
                data[i] = (Math.random() * 2 - 1) * envelope + earlyReflection * envelope;
            }
        }
        return buffer;
    }

    /**
     * 排气声合成 - 核心音色
     * 使用ScriptProcessorNode的替代方案: 周期性脉冲 + 波表合成
     */
    _createExhaustChain() {
        const ctx = this.audioCtx;

        // 使用AudioWorklet替代方案: 用多个振荡器模拟排气谐波
        // 基频 = firing frequency = RPM/60 * 4 (V8四冲程)

        // 排气脉冲振荡器组 (模拟各次谐波)
        this.nodes.exhaustOscillators = [];
        this.nodes.exhaustGains = [];

        // 谐波配置: [频率倍数, 增益, 波形]
        const harmonics = [
            { mult: 1.0, gain: 1.0, type: 'sawtooth' },      // 基频 - 主要排气脉冲
            { mult: 2.0, gain: 0.6, type: 'square' },         // 2次谐波
            { mult: 3.0, gain: 0.35, type: 'sawtooth' },      // 3次谐波
            { mult: 4.0, gain: 0.2, type: 'triangle' },       // 4次谐波
            { mult: 0.5, gain: 0.8, type: 'sawtooth' },       // 亚谐波 - 增加"厚度"
            { mult: 6.0, gain: 0.1, type: 'sine' },           // 高频泛音
        ];

        for (const h of harmonics) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = h.type;
            osc.frequency.value = 53 * h.mult; // 初始: 800RPM的firing freq
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(this.nodes.masterGain);
            osc.start();
            this.nodes.exhaustOscillators.push(osc);
            this.nodes.exhaustGains.push(gain);
        }
        this.exhaustHarmonics = harmonics;

        // 排气脉冲shaper (非线性失真模拟排气管共振)
        this.nodes.exhaustShaper = ctx.createWaveShaper();
        this.nodes.exhaustShaper.curve = this._makeDistortionCurve(80);

        // 排气低通滤波 (模拟消音器)
        this.nodes.exhaustLPF = ctx.createBiquadFilter();
        this.nodes.exhaustLPF.type = 'lowpass';
        this.nodes.exhaustLPF.frequency.value = 800;
        this.nodes.exhaustLPF.Q.value = 2.0;

        // 排气带通共振 (模拟排气管谐振频率)
        this.nodes.exhaustBPF = ctx.createBiquadFilter();
        this.nodes.exhaustBPF.type = 'bandpass';
        this.nodes.exhaustBPF.frequency.value = 180;
        this.nodes.exhaustBPF.Q.value = 3.0;

        // 脉冲噪声 (模拟排气爆破声)
        this._createPulseNoise();
    }

    /**
     * 排气脉冲噪声 - 模拟每次点火的爆破感
     */
    _createPulseNoise() {
        const ctx = this.audioCtx;
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // 生成有色噪声 (偏低频)
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            // 简单的一阶低通 (brown noise近似)
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            data[i] = lastOut * 3.5;
        }

        this.nodes.exhaustNoise = ctx.createBufferSource();
        this.nodes.exhaustNoise.buffer = buffer;
        this.nodes.exhaustNoise.loop = true;

        this.nodes.exhaustNoiseGain = ctx.createGain();
        this.nodes.exhaustNoiseGain.gain.value = 0;

        this.nodes.exhaustNoiseFilter = ctx.createBiquadFilter();
        this.nodes.exhaustNoiseFilter.type = 'lowpass';
        this.nodes.exhaustNoiseFilter.frequency.value = 400;

        this.nodes.exhaustNoise.connect(this.nodes.exhaustNoiseFilter);
        this.nodes.exhaustNoiseFilter.connect(this.nodes.exhaustNoiseGain);
        this.nodes.exhaustNoiseGain.connect(this.nodes.masterGain);
        this.nodes.exhaustNoise.start();
    }

    /**
     * 进气声 - 高转速时明显
     */
    _createIntakeChain() {
        const ctx = this.audioCtx;

        // 进气噪声 (白噪声通过带通滤波)
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.nodes.intakeNoise = ctx.createBufferSource();
        this.nodes.intakeNoise.buffer = buffer;
        this.nodes.intakeNoise.loop = true;

        this.nodes.intakeBPF = ctx.createBiquadFilter();
        this.nodes.intakeBPF.type = 'bandpass';
        this.nodes.intakeBPF.frequency.value = 600;
        this.nodes.intakeBPF.Q.value = 1.5;

        this.nodes.intakeGain = ctx.createGain();
        this.nodes.intakeGain.gain.value = 0;

        this.nodes.intakeNoise.connect(this.nodes.intakeBPF);
        this.nodes.intakeBPF.connect(this.nodes.intakeGain);
        this.nodes.intakeGain.connect(this.nodes.masterGain);
        this.nodes.intakeNoise.start();
    }

    /**
     * 机械噪声 - 气门机构、正时链条等
     */
    _createMechanicalNoise() {
        const ctx = this.audioCtx;
        const bufferSize = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.nodes.mechNoise = ctx.createBufferSource();
        this.nodes.mechNoise.buffer = buffer;
        this.nodes.mechNoise.loop = true;

        this.nodes.mechHPF = ctx.createBiquadFilter();
        this.nodes.mechHPF.type = 'highpass';
        this.nodes.mechHPF.frequency.value = 2000;

        this.nodes.mechGain = ctx.createGain();
        this.nodes.mechGain.gain.value = 0;

        this.nodes.mechNoise.connect(this.nodes.mechHPF);
        this.nodes.mechHPF.connect(this.nodes.mechGain);
        this.nodes.mechGain.connect(this.nodes.masterGain);
        this.nodes.mechNoise.start();
    }

    _makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) /
                (Math.PI + amount * Math.abs(x));
        }
        return curve;
    }

    /**
     * 每帧更新引擎声音
     * @param {number} dt - 时间步长(秒)
     * @param {object} vehicleState - 车辆状态 {rpm, throttle, speed, gear}
     */
    update(dt, vehicleState) {
        if (!this.initialized || !this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const { rpm, throttle } = vehicleState;
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // 计算点火频率: V8四冲程 = RPM/60 * 4 次点火/秒
        const firingFreq = (rpm / 60) * 4;
        const rpmNorm = rpm / this.params.maxRPM; // 0~1
        const throttleNorm = Math.max(0, Math.min(1, throttle));

        // === 更新排气谐波振荡器 ===
        for (let i = 0; i < this.nodes.exhaustOscillators.length; i++) {
            const h = this.exhaustHarmonics[i];
            const freq = firingFreq * h.mult;
            this.nodes.exhaustOscillators[i].frequency.setTargetAtTime(
                Math.max(20, freq), now, 0.02
            );

            // 增益随RPM和油门变化
            let gain = h.gain * (0.15 + rpmNorm * 0.85);
            // 油门开启时增加中高频谐波
            if (h.mult > 2) {
                gain *= (0.3 + throttleNorm * 0.7);
            }
            // 等长芭蕉特征: 谐波更纯净，基频更突出
            if (h.mult === 1.0) {
                gain *= 1.2;
            }
            this.nodes.exhaustGains[i].gain.setTargetAtTime(
                gain * 0.12, now, 0.03
            );
        }

        // === 排气噪声 (随RPM增加) ===
        const noiseGain = 0.05 + rpmNorm * 0.25 + throttleNorm * 0.15;
        this.nodes.exhaustNoiseGain.gain.setTargetAtTime(noiseGain, now, 0.05);
        this.nodes.exhaustNoiseFilter.frequency.setTargetAtTime(
            200 + rpmNorm * 1200 + throttleNorm * 600, now, 0.05
        );

        // === 排气LPF随RPM开启 (高转更明亮) ===
        this.nodes.exhaustLPF.frequency.setTargetAtTime(
            400 + rpmNorm * 3000 + throttleNorm * 2000, now, 0.05
        );

        // === 进气声 (高油门高转速时明显) ===
        const intakeLevel = throttleNorm * rpmNorm * 0.15;
        this.nodes.intakeGain.gain.setTargetAtTime(intakeLevel, now, 0.05);
        this.nodes.intakeBPF.frequency.setTargetAtTime(
            400 + rpmNorm * 2000, now, 0.05
        );

        // === 机械噪声 (高转速) ===
        const mechLevel = Math.max(0, rpmNorm - 0.5) * 0.06;
        this.nodes.mechGain.gain.setTargetAtTime(mechLevel, now, 0.05);

        // === Cross-plane特征: 调制增益模拟不均匀点火间隔 ===
        // 90°/270°交替产生振幅调制 (burble效果)
        const burbleFreq = firingFreq / 2; // 每两个点火一个周期
        if (!this.nodes.burbleLFO) {
            this.nodes.burbleLFO = ctx.createOscillator();
            this.nodes.burbleLFOGain = ctx.createGain();
            this.nodes.burbleLFO.type = 'sine';
            this.nodes.burbleLFOGain.gain.value = 0.03;
            this.nodes.burbleLFO.connect(this.nodes.burbleLFOGain);
            // 连接到排气主增益的调制
            this.nodes.burbleLFOGain.connect(this.nodes.exhaustGains[0].gain);
            this.nodes.burbleLFO.start();
        }
        this.nodes.burbleLFO.frequency.setTargetAtTime(
            Math.max(1, burbleFreq), now, 0.05
        );
        // 低转速时burble更明显
        this.nodes.burbleLFOGain.gain.setTargetAtTime(
            0.04 * (1 - rpmNorm * 0.6), now, 0.1
        );
    }

    /**
     * 设置混响级别
     */
    setReverbLevel(level) {
        this.reverbLevel = Math.max(0, Math.min(1, level));
        if (this.nodes.reverbGain) {
            this.nodes.reverbGain.gain.setTargetAtTime(
                this.reverbLevel, this.audioCtx.currentTime, 0.1
            );
            this.nodes.dryGain.gain.setTargetAtTime(
                1.0 - this.reverbLevel * 0.5, this.audioCtx.currentTime, 0.1
            );
        }
    }

    /**
     * 设置主音量
     */
    setVolume(vol) {
        this.masterVolume = Math.max(0, Math.min(1, vol));
        if (this.nodes.masterGain) {
            this.nodes.masterGain.gain.setTargetAtTime(
                this.masterVolume, this.audioCtx.currentTime, 0.05
            );
        }
    }

    /**
     * 启动/停止引擎声音
     */
    setEngineOn(on) {
        if (!this.initialized) return;
        const now = this.audioCtx.currentTime;
        if (!on) {
            // 熄火 - 快速淡出
            for (const g of this.nodes.exhaustGains) {
                g.gain.setTargetAtTime(0, now, 0.1);
            }
            this.nodes.exhaustNoiseGain.gain.setTargetAtTime(0, now, 0.1);
            this.nodes.intakeGain.gain.setTargetAtTime(0, now, 0.1);
            this.nodes.mechGain.gain.setTargetAtTime(0, now, 0.1);
        }
        this.state.ignition = on;
    }

    dispose() {
        if (this.audioCtx) {
            this.audioCtx.close();
        }
    }
}
