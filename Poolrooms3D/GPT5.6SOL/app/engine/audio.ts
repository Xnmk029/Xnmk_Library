export class FootstepAudio {
  private context: AudioContext | null = null;
  private echo: ConvolverNode | null = null;
  private gain: GainNode | null = null;

  resume() {
    if (!this.context) this.setup();
    void this.context?.resume();
  }

  private setup() {
    const context = new AudioContext();
    const echo = context.createConvolver();
    const impulseLength = context.sampleRate * 2.8;
    const impulse = context.createBuffer(2, impulseLength, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < impulseLength; i += 1) {
        const decay = Math.pow(1 - i / impulseLength, 3.5);
        data[i] = (Math.random() * 2 - 1) * decay * (channel === 0 ? 0.62 : 0.55);
      }
    }
    echo.buffer = impulse;
    const gain = context.createGain();
    gain.gain.value = 0.18;
    echo.connect(gain).connect(context.destination);
    this.context = context;
    this.echo = echo;
    this.gain = gain;
  }

  play() {
    const context = this.context;
    const echo = this.echo;
    if (!context || !echo || context.state !== "running") return;

    const length = Math.floor(context.sampleRate * 0.12);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 4);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const direct = context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 540;
    filter.Q.value = 0.7;
    direct.gain.value = 0.055;
    source.buffer = buffer;
    source.playbackRate.value = 0.76 + Math.random() * 0.08;
    source.connect(filter);
    filter.connect(direct).connect(context.destination);
    filter.connect(echo);
    source.start();
  }

  dispose() {
    this.echo?.disconnect();
    this.gain?.disconnect();
    void this.context?.close();
    this.context = null;
  }
}
