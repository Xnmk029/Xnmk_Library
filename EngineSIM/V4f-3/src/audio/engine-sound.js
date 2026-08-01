// ============================================================================
// engine-sound.js — 浏览器端引擎声音图（低 CPU：6 振荡器 + 2 噪声路径 + 卷积混响）
// 与渲染层解耦：只接收 {rpm, throttle, load, fuelCut} 状态，不依赖 DOM/Three
// ============================================================================
import {
  V8_ORDER_PROFILES, orderAmplitude, orderFrequency,
  clampUnit, clamp, firstNonFinite, audioBudget
} from './engine-math.js'
import { createReverb } from './reverb.js'

const SMOOTH_GAIN_S = 0.045  // 增益平滑（防参数跳变爆音）
const SMOOTH_FREQ_S = 0.09   // 频率平滑（防音高跳跃）

export class EngineSound {
  /**
   * @param {BaseAudioContext} ctx 由调用方在用户手势中创建/恢复
   * @param {{reverbMix?:number, masterGain?:number}} opts
   */
  constructor(ctx, opts = {}) {
    this.ctx = ctx
    this.running = false
    this.reverbMix = clampUnit(opts.reverbMix ?? 0.30)
    this.masterGainLevel = clampUnit(opts.masterGain ?? 0.9)

    this._oscs = []
    this._oscGains = []
    this._lastState = { rpm: 750, throttle: 0, load: 0, fuelCut: false }
  }

  /** 构建音频图（幂等） */
  build() {
    if (this.running) return
    const ctx = this.ctx

    // --- 干湿母线 ---
    this.bus = ctx.createGain(); this.bus.gain.value = 1.0
    this.dryGain = ctx.createGain(); this.dryGain.gain.value = 1.0
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -14
    this.compressor.knee.value = 8
    this.compressor.ratio.value = 5
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.22
    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = this.masterGainLevel

    // --- 混响（卷积） ---
    const reverb = createReverb(ctx, { seconds: 2.2, decay: 3.4, preDelayMs: 20 })
    this.reverbWet = reverb.wet
    this.reverbWet.gain.value = this.reverbMix

    // --- 阶次振荡器（每个阶次 1 个振荡器，总计 6 个） ---
    for (const profile of V8_ORDER_PROFILES) {
      const osc = ctx.createOscillator()
      osc.type = profile.type
      osc.frequency.value = orderFrequency(750, profile.order)
      const g = ctx.createGain()
      g.gain.value = orderAmplitude(750, profile.order, 0) * 0.5
      osc.connect(g).connect(this.bus)
      osc.start()
      this._oscs.push(osc)
      this._oscGains.push(g)
    }

    // --- 排气/进气噪声（白噪声循环 + 带通，2 条路径） ---
    this.noiseBuf = this._makeNoiseBuffer(2.0)
    this.noiseSrc = ctx.createBufferSource()
    this.noiseSrc.buffer = this.noiseBuf
    this.noiseSrc.loop = true
    this.exhaustBP = ctx.createBiquadFilter()
    this.exhaustBP.type = 'bandpass'
    this.exhaustBP.frequency.value = 800
    this.exhaustBP.Q.value = 0.8
    this.exhaustGain = ctx.createGain(); this.exhaustGain.gain.value = 0.0
    this.intakeBP = ctx.createBiquadFilter()
    this.intakeBP.type = 'bandpass'
    this.intakeBP.frequency.value = 400
    this.intakeBP.Q.value = 1.6
    this.intakeGain = ctx.createGain(); this.intakeGain.gain.value = 0.0
    this.noiseSrc.connect(this.exhaustBP).connect(this.exhaustGain).connect(this.bus)
    this.noiseSrc.connect(this.intakeBP).connect(this.intakeGain).connect(this.bus)
    this.noiseSrc.start()

    // --- 总线接线：干/湿 → 压缩限幅 → 主音量 → 输出 ---
    this.bus.connect(this.dryGain)
    this.dryGain.connect(this.compressor)
    this.bus.connect(this.reverbWet)
    this.reverbWet.connect(this.compressor)
    this.compressor.connect(this.masterGain)
    this.masterGain.connect(ctx.destination)

    this.running = true
  }

  _makeNoiseBuffer(seconds) {
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  /**
   * 每帧驱动：state = {rpm, throttle, load, fuelCut}
   * 所有目标值经 clamp 与平滑，杜绝 NaN/爆音
   */
  update(state) {
    if (!this.running) return
    const s = state
    const rpm = clamp(s.rpm, 0, 9000)
    const throttle = clampUnit(s.throttle)
    const load = clampUnit(s.load)
    const fuelCut = !!s.fuelCut
    const now = this.ctx.currentTime

    if (firstNonFinite(rpm, throttle, load) !== null) return // 数值防护

    // 断油：阶次音量骤降（点火切断），保留风声质感；恢复时平滑回升
    const orderScale = fuelCut ? 0.12 : 1.0
    for (let i = 0; i < V8_ORDER_PROFILES.length; i++) {
      const profile = V8_ORDER_PROFILES[i]
      const targetGain = orderAmplitude(rpm, profile.order, load) * orderScale
      this._oscGains[i].gain.setTargetAtTime(targetGain, now, SMOOTH_GAIN_S)
      this._oscs[i].frequency.setTargetAtTime(orderFrequency(rpm, profile.order), now, SMOOTH_FREQ_S)
    }

    // 排气噪声：随 4 阶转速与油门开度（断油时轻微增加“放炮感”基础量）
    const exhaustFreq = clamp(orderFrequency(rpm, 4) * 2.4, 60, 9000)
    const exhaustTarget = fuelCut ? 0.06 + 0.10 * throttle : 0.03 + 0.16 * throttle
    this.exhaustBP.frequency.setTargetAtTime(exhaustFreq, now, SMOOTH_FREQ_S)
    this.exhaustGain.gain.setTargetAtTime(exhaustTarget, now, SMOOTH_GAIN_S)

    // 进气噪声：低通，随 1 阶与油门
    const intakeFreq = clamp(orderFrequency(rpm, 1) * 1.8, 30, 4000)
    this.intakeBP.frequency.setTargetAtTime(intakeFreq, now, SMOOTH_FREQ_S)
    this.intakeGain.gain.setTargetAtTime(0.02 + 0.05 * throttle, now, SMOOTH_GAIN_S)

    this._lastState = { rpm, throttle, load, fuelCut }
  }

  /** 混响量（0..1） */
  setReverbMix(v) {
    this.reverbMix = clampUnit(v)
    if (this.running) this.reverbWet.gain.setTargetAtTime(this.reverbMix, this.ctx.currentTime, 0.1)
  }

  /** 主音量（0..1） */
  setMasterGain(v) {
    this.masterGainLevel = clampUnit(v)
    if (this.running) this.masterGain.gain.setTargetAtTime(this.masterGainLevel, this.ctx.currentTime, 0.05)
  }

  getMetrics() {
    return {
      budget: audioBudget(),
      rpm: this._lastState.rpm,
      fuelCut: this._lastState.fuelCut,
      oscFreqs: this._oscs.map((o, i) => ({ order: V8_ORDER_PROFILES[i].order, freq: o.frequency.value }))
    }
  }

  dispose() {
    if (!this.running) return
    for (const o of this._oscs) { try { o.stop() } catch { /* 已停 */ } }
    try { this.noiseSrc.stop() } catch { /* 已停 */ }
    try { this.masterGain.disconnect() } catch { /* */ }
    this.running = false
  }
}
