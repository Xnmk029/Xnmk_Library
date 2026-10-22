/**
 * Public surface of the audio engine (phase 1 deliverable).
 *
 * Nothing in here touches the DOM, WebAudio or Three.js, so the whole module
 * runs identically in Node (tests, offline WAV rendering) and in an
 * AudioWorklet.
 */

export {
  CROSSPLANE_V8,
  FLATPLANE_V8,
  ENGINE_PRESETS,
  validateEngineConfig,
  withEngineOverrides,
  speedOfSound,
  quarterWaveHz,
  halfWaveHz,
} from "./engine-config.js";

export {
  FOUR_STROKE_CYCLE_DEG,
  REVOLUTION_DEG,
  mainOrder,
  firingIntervalDeg,
  firingFrequencyHz,
  orderToHz,
  hzToOrder,
  rpmForOrderHz,
  crankDegreesPerSecond,
  valveLift,
  createFiringSchedule,
  bankFiringIntervalsDeg,
  engineFiringIntervalsDeg,
  crankThrows,
  crankPinAngles,
  buildValveTables,
  sampleCycleTable,
  wrapCycle,
  wrapRevolution,
} from "./firing.js";

export { EngineController, torqueShape, throttleToLoad } from "./engine-state.js";
export { EngineSynth } from "./engine-synth.js";
export { VehicleAmbience } from "./vehicle-ambience.js";
export { SPACE_PRESETS, spacePresetNames } from "./dsp/reverb.js";
export {
  DEFAULT_ORDERS,
  renderStereo,
  warmup,
  orderLevelsDb,
  halfOrderEnergyDb,
  integerOrderEnergyDb,
  dominantOrder,
  measureOrderFrequency,
  dominantPeakAsFiringMultiple,
  maxSampleDelta,
  signalStats,
} from "./analysis/order-analysis.js";
export { fftInPlace, magnitudeSpectrum, peakInBand, bandMagnitude, toDb } from "./analysis/fft.js";
