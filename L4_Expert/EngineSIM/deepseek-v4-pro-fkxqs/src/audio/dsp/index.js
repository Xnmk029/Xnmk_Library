/** Barrel for the DSP primitives (kept dependency-free and worklet-safe). */
export { Xorshift32, PinkNoise } from "./random.js";
export {
  clampFrequency,
  OnePoleLowpass,
  OnePoleHighpass,
  DcBlocker,
  Biquad,
  Resonator,
} from "./filters.js";
export { FractionalDelay, WaveguideSection, CombChamber } from "./delay.js";
export { softClip, saturate, saturateAsymmetric, clampSample, sanitize } from "./nonlinear.js";
export { ParamSmoother, SlewLimiter } from "./smoothing.js";
export { SpaceReverb, SPACE_PRESETS, spacePresetNames } from "./reverb.js";
export { Limiter } from "./limiter.js";
export { SINE_TABLE, sineLookup, buildBlowdownPulse, buildTurbulenceEnvelope, tableLookup } from "./tables.js";
