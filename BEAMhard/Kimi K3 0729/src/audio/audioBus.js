// Phase 2 — Web Audio engine acoustic synthesizer (programmatic, sample-free)
/**
 * @file audioBus.js
 * Shared Web Audio infrastructure for the vehicle simulation: owns the
 * AudioContext, the master bus gain, the listener pose, and factories for
 * spatial (3D-panned) and local (non-spatial) voices.
 *
 * The module is import-safe in Node: no browser global is touched at import
 * or construction time. The AudioContext is created lazily inside resume(),
 * which the parent app must call from a user gesture.
 */

/**
 * Smooth an AudioParam towards a value, falling back to direct assignment
 * on ancient implementations without AudioParam automation methods.
 * @param {AudioParam|null|undefined} param
 * @param {number} value
 * @param {number} time  AudioContext time (usually ctx.currentTime)
 * @param {number} [k=0.03]  setTargetAtTime time constant (s)
 */
function _smooth(param, value, time, k = 0.03) {
  if (!param) return;
  if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(value, time, k);
  else param.value = value;
}

/** Shared audio context / master bus / voice factory. */
export class AudioBus {
  /**
   * Creates the bus. Does NOT create an AudioContext yet — that happens in
   * resume(), so constructing an AudioBus in Node (or before a user gesture)
   * is always safe.
   */
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;
    /** @type {GainNode|null} */
    this._master = null;
  }

  /**
   * @returns {AudioContext|null} the shared AudioContext, or null before resume()
   */
  get ctx() {
    return this._ctx;
  }

  /**
   * @returns {GainNode|null} master gain (0.8) feeding ctx.destination, or null before resume()
   */
  get master() {
    return this._master;
  }

  /**
   * Creates the AudioContext on first call (plus the master GainNode at 0.8,
   * connected to the destination) and resumes it. Safe to call repeatedly;
   * no-op in environments without Web Audio (e.g. Node smoke tests).
   * Must be invoked from a user gesture to satisfy autoplay policies.
   * @returns {Promise<void>}
   */
  async resume() {
    if (!this._ctx) {
      const g = typeof globalThis !== 'undefined' ? globalThis : {};
      const w = typeof window !== 'undefined' ? window : g;
      const AC = w.AudioContext || w.webkitAudioContext || g.AudioContext;
      if (typeof AC !== 'function') return; // headless / unsupported: stay silent
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.8; // creation-time init, not an audible move
      this._master.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
      await this._ctx.resume();
    }
  }

  /**
   * @returns {number} ctx.currentTime, or 0 when no context exists
   */
  now() {
    return this._ctx ? this._ctx.currentTime : 0;
  }

  /**
   * Moves the audio listener. Uses AudioParam smoothing (setTargetAtTime)
   * when available; falls back to the legacy setPosition/setOrientation API.
   * @param {{x:number,y:number,z:number}} pos  world position
   * @param {{x:number,y:number,z:number}} fwd  forward unit vector
   * @param {{x:number,y:number,z:number}} up   up unit vector
   */
  setListener(pos, fwd, up) {
    const ctx = this._ctx;
    if (!ctx || !ctx.listener || !pos || !fwd || !up) return;
    const l = ctx.listener;
    const t = ctx.currentTime;
    if (l.positionX && l.forwardX && l.upX) {
      const k = 0.05;
      _smooth(l.positionX, pos.x, t, k);
      _smooth(l.positionY, pos.y, t, k);
      _smooth(l.positionZ, pos.z, t, k);
      _smooth(l.forwardX, fwd.x, t, k);
      _smooth(l.forwardY, fwd.y, t, k);
      _smooth(l.forwardZ, fwd.z, t, k);
      _smooth(l.upX, up.x, t, k);
      _smooth(l.upY, up.y, t, k);
      _smooth(l.upZ, up.z, t, k);
    } else {
      if (typeof l.setPosition === 'function') l.setPosition(pos.x, pos.y, pos.z);
      if (typeof l.setOrientation === 'function') l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  /**
   * Creates a spatial voice: input GainNode -> PannerNode ('inverse' distance
   * model), connected to the master bus (or an explicit node) via connect().
   * @param {object} [opts]
   * @param {number} [opts.refDistance=8]
   * @param {number} [opts.maxDistance=300]
   * @param {number} [opts.rolloffFactor=1.2]
   * @param {string} [opts.panningModel='HRTF']
   * @returns {{input: GainNode, setPosition: function({x:number,y:number,z:number}): void,
   *   setVelocity: function({x:number,y:number,z:number}): void,
   *   connect: function(AudioNode=): void, dispose: function(): void}}
   * @throws {Error} if called before resume() created an AudioContext
   */
  createSpatialVoice({ refDistance = 8, maxDistance = 300, rolloffFactor = 1.2, panningModel = 'HRTF' } = {}) {
    const ctx = this._ctx;
    if (!ctx) throw new Error('AudioBus.createSpatialVoice: call resume() first');
    const bus = this;
    const input = ctx.createGain();
    const panner = ctx.createPanner();
    panner.panningModel = panningModel;
    panner.distanceModel = 'inverse';
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = rolloffFactor;
    input.connect(panner);
    let destination = null;
    return {
      input,
      /**
       * Moves the voice (smoothed via positionX/Y/Z, legacy fallback).
       * @param {{x:number,y:number,z:number}} pos
       */
      setPosition(pos) {
        if (!pos) return;
        if (panner.positionX) {
          const t = ctx.currentTime;
          _smooth(panner.positionX, pos.x, t);
          _smooth(panner.positionY, pos.y, t);
          _smooth(panner.positionZ, pos.z, t);
        } else if (typeof panner.setPosition === 'function') {
          panner.setPosition(pos.x, pos.y, pos.z);
        }
      },
      /**
       * Sets the voice velocity (drives doppler on supporting browsers).
       * @param {{x:number,y:number,z:number}} v
       */
      setVelocity(v) {
        if (!v) return;
        if (panner.positionX && typeof panner.positionX.setTargetAtTime === 'function' &&
            typeof panner.velocityX !== 'undefined') {
          const t = ctx.currentTime;
          _smooth(panner.velocityX, v.x, t);
          _smooth(panner.velocityY, v.y, t);
          _smooth(panner.velocityZ, v.z, t);
        } else if (typeof panner.setVelocity === 'function') {
          panner.setVelocity(v.x, v.y, v.z);
        }
      },
      /**
       * Connects the voice output (panner) to a destination.
       * @param {AudioNode} [node=bus.master]
       */
      connect(node = bus.master) {
        if (!node) return;
        if (destination) {
          try { panner.disconnect(destination); } catch (_) { /* not connected */ }
        }
        panner.connect(node);
        destination = node;
      },
      /** Tears the voice down, disconnecting input and panner. */
      dispose() {
        try { input.disconnect(); } catch (_) { /* ignore */ }
        try { panner.disconnect(); } catch (_) { /* ignore */ }
        destination = null;
      },
    };
  }

  /**
   * Creates a non-spatial voice: a plain GainNode wired straight to the
   * master bus (UI sounds, cabin audio, etc.).
   * @param {object} [opts]
   * @param {number} [opts.gain=1]  initial gain (creation-time init)
   * @returns {{input: GainNode, setGain: function(number): void, dispose: function(): void}}
   * @throws {Error} if called before resume() created an AudioContext
   */
  createLocalVoice({ gain = 1 } = {}) {
    const ctx = this._ctx;
    if (!ctx) throw new Error('AudioBus.createLocalVoice: call resume() first');
    const input = ctx.createGain();
    input.gain.value = gain; // creation-time init, not an audible move
    if (this._master) input.connect(this._master);
    return {
      input,
      /**
       * Smoothly retargets the voice gain (click-free).
       * @param {number} g
       */
      setGain(g) {
        _smooth(input.gain, g, ctx.currentTime);
      },
      /** Disconnects the voice from the master bus. */
      dispose() {
        try { input.disconnect(); } catch (_) { /* ignore */ }
      },
    };
  }
}
