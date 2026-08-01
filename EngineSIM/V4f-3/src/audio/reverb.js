// ============================================================================
// reverb.js — 程序化混响（卷积 + 生成脉冲响应），浏览器原生 ConvolverNode
// 低性能要求：单次卷积核（约 2.2s），湿声一路 send，开销恒定
// ============================================================================

/**
 * 生成指数衰减噪声脉冲响应（含前置延迟，模拟房间/赛道环境）
 * @param {number} sampleRate
 * @param {{seconds?:number, decay?:number, preDelayMs?:number, stereo?:boolean}} opts
 * @returns {AudioBuffer}
 */
export function generateImpulseResponse(sampleRate, opts = {}) {
  const { seconds = 2.2, decay = 3.2, preDelayMs = 18, stereo = true } = opts
  const len = Math.max(1, Math.floor(sampleRate * seconds))
  const preDelaySamples = Math.max(0, Math.floor((preDelayMs / 1000) * sampleRate))
  const channels = stereo ? 2 : 1
  const buffer = new AudioBuffer({ numberOfChannels: channels, length: len + preDelaySamples, sampleRate })
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch)
    // 高通装饰：左右声道用不同种子噪声，避免纯白噪“金属感”
    let last = 0
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate
      const env = Math.pow(1 - t / seconds, decay) * (t < 0.002 ? t / 0.002 : 1) // 起始淡入防爆音
      const white = Math.random() * 2 - 1
      const onePole = last + 0.28 * (white - last) // 低通染色（模拟墙壁吸收高频）
      last = onePole
      data[preDelaySamples + i] = onePole * env * 0.9
    }
  }
  return buffer
}

/**
 * 创建混响节点链：convolver → wet gain
 * @param {BaseAudioContext} ctx
 * @returns {{input: AudioNode, wet: GainNode}}
 */
export function createReverb(ctx, opts = {}) {
  const convolver = ctx.createConvolver()
  convolver.buffer = generateImpulseResponse(ctx.sampleRate, opts)
  convolver.normalize = true
  const wet = ctx.createGain()
  wet.gain.value = 0.0
  convolver.connect(wet)
  return { input: convolver, wet }
}
