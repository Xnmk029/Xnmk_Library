/**
 * AudioWorklet front end for the engine synthesiser.
 *
 * The processor itself owns no DSP: it forwards control messages to
 * `EngineSynth` / `VehicleAmbience` and copies their output into the render
 * quantum. Keeping it this thin is what lets the same DSP run in Node tests.
 *
 * The class is produced by `createEngineProcessorClass` so a Node test can
 * instantiate it against a stub base class; registration only happens when the
 * file is actually loaded inside an AudioWorkletGlobalScope.
 *
 * Messages accepted on the port:
 *   { type: "controls",  ...EngineSynth controls }
 *   { type: "ambience",  ...VehicleAmbience controls }
 *   { type: "space",     space: "cockpit" | "trackside" | "pitlane" | "tunnel" }
 *   { type: "engine",    engineId: "crossplane-v8-62" | "flatplane-v8-62" }
 *   { type: "reset" }
 *   { type: "diagnostics" }            -> replies with a diagnostics message
 *   { type: "reportInterval", ms }     -> automatic diagnostics cadence (0 = off)
 */

import { EngineSynth } from "./engine-synth.js";
import { VehicleAmbience } from "./vehicle-ambience.js";
import { CROSSPLANE_V8, ENGINE_PRESETS } from "./engine-config.js";

/**
 * @param {Function} BaseProcessor AudioWorkletProcessor (or a stub in tests)
 * @param {number} hostSampleRate
 */
export function createEngineProcessorClass(BaseProcessor, hostSampleRate) {
  return class EngineSoundProcessor extends BaseProcessor {
    constructor(options = {}) {
      super(options);
      const processorOptions = options.processorOptions ?? {};
      const sampleRate = processorOptions.sampleRate ?? hostSampleRate ?? 48000;
      const config = ENGINE_PRESETS[processorOptions.engineId] ?? CROSSPLANE_V8;
      this.sampleRate = sampleRate;
      this.synth = new EngineSynth({
        sampleRate,
        config,
        space: processorOptions.space ?? "trackside",
        seed: processorOptions.seed ?? 0x2f6e2b1,
      });
      this.ambience = new VehicleAmbience({ sampleRate, seed: processorOptions.seed ?? 0x7f4a7c15 });
      this.ambienceEnabled = processorOptions.ambience !== false;
      this.reportIntervalFrames = Math.round((processorOptions.reportIntervalMs ?? 250) * sampleRate) / 1000;
      this.framesSinceReport = 0;
      this.totalFrames = 0;
      this.blocks = 0;
      this.messages = 0;
      this.port.onmessage = (event) => this.handleMessage(event.data);
      this.post({ type: "ready", sampleRate, engineId: config.id, label: config.label });
    }

    /** @private */
    post(message) {
      if (this.port && typeof this.port.postMessage === "function") this.port.postMessage(message);
    }

    /**
     * Handle one control message. Unknown types are ignored on purpose: an
     * audio thread must never throw because a host sent something new.
     * @param {any} message
     */
    handleMessage(message) {
      if (!message || typeof message !== "object") return;
      this.messages++;
      switch (message.type) {
        case "controls":
          this.synth.setControls(message);
          break;
        case "ambience":
          this.ambience.setControls(message);
          if (typeof message.enabled === "boolean") this.ambienceEnabled = message.enabled;
          break;
        case "space":
          if (message.space) this.synth.setSpace(message.space);
          break;
        case "engine": {
          const config = ENGINE_PRESETS[message.engineId];
          if (config) {
            const previous = this.synth.controls;
            this.synth = new EngineSynth({
              sampleRate: this.sampleRate,
              config,
              space: this.synth.spaceName,
            });
            this.synth.setControls(previous);
          }
          break;
        }
        case "reset":
          this.synth.reset();
          this.ambience.reset();
          break;
        case "reportInterval":
          this.reportIntervalFrames = Math.max(0, Math.round(((message.ms ?? 0) * this.sampleRate) / 1000));
          break;
        case "diagnostics":
          this.post(this.diagnosticsMessage());
          break;
        default:
          break;
      }
    }

    /** @private */
    diagnosticsMessage() {
      return {
        type: "diagnostics",
        totalFrames: this.totalFrames,
        blocks: this.blocks,
        messages: this.messages,
        ambienceEnabled: this.ambienceEnabled,
        engine: this.synth.getDiagnostics(),
        ambience: this.ambience.getDiagnostics(),
      };
    }

    /**
     * @param {Float32Array[][]} inputs
     * @param {Float32Array[][]} outputs
     */
    process(inputs, outputs) {
      const output = outputs[0];
      if (!output || output.length === 0) return true;
      const left = output[0];
      const right = output.length > 1 ? output[1] : output[0];
      const frames = left.length;
      if (right === left) {
        // Mono host: render into a scratch pair and fold down.
        if (!this.scratchL || this.scratchL.length !== frames) {
          this.scratchL = new Float32Array(frames);
          this.scratchR = new Float32Array(frames);
        }
        this.synth.render(this.scratchL, this.scratchR, frames);
        if (this.ambienceEnabled) this.ambience.addInto(this.scratchL, this.scratchR, frames);
        for (let i = 0; i < frames; i++) left[i] = (this.scratchL[i] + this.scratchR[i]) * 0.5;
      } else {
        this.synth.render(left, right, frames);
        if (this.ambienceEnabled) this.ambience.addInto(left, right, frames);
        for (let channel = 2; channel < output.length; channel++) output[channel].set(left);
      }

      this.totalFrames += frames;
      this.blocks++;
      if (this.reportIntervalFrames > 0) {
        this.framesSinceReport += frames;
        if (this.framesSinceReport >= this.reportIntervalFrames) {
          this.framesSinceReport = 0;
          this.post(this.diagnosticsMessage());
        }
      }
      return true;
    }
  };
}

// Only registers when this module is loaded inside an AudioWorkletGlobalScope.
if (typeof AudioWorkletProcessor !== "undefined" && typeof registerProcessor === "function") {
  registerProcessor(
    "engine-sound-processor",
    createEngineProcessorClass(AudioWorkletProcessor, typeof sampleRate === "number" ? sampleRate : 48000),
  );
}
