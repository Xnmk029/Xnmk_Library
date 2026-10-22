// Global configuration + quality tiers.
// Everything tweakable lives here so the adaptive quality controller can retune at runtime.

export const CFG = {
  // ---- world / streaming ----
  chunkRadius: 2, // 5x5 chunks of 32m => 160m of world resident
  seed: 20260119,

  // ---- camera / player ----
  fov: 68,
  near: 0.06,
  far: 260,
  eyeHeight: 1.68, // 1.7m tall player, eyes just below the top of the head
  radius: 0.32,
  walkSpeed: 2.9,
  runSpeed: 5.4,
  swimSpeed: 2.0,
  gravity: 22.0,
  jumpSpeed: 5.2,
  mouseSensitivity: 0.0022,

  // ---- lighting ----
  sunAzimuth: 2.42,
  sunElevation: 0.60, // radians (~34deg): long shafts that still reach the floor indoors
  sunIntensity: 5.6,
  skyIntensity: 1.0,
  envIntensity: 1.0,
  exposure: 1.2,

  // ---- atmosphere ----
  fogDensity: 0.024,
  fogHeightFalloff: 0.22, // humid air pools near the water instead of filling the room evenly
  fogAnisotropy: 0.72,

  // ---- quality (mutated by AdaptiveQuality) ----
  quality: {
    name: 'high',
    renderScale: 1.0,
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    textureSize: 1024,
    anisotropy: 8,
    ssgi: true,
    ssgiScale: 0.6,
    ssgiRays: 6,
    ssgiSteps: 14,
    ssr: true,
    ssrSteps: 28,
    fog: true,
    fogSteps: 26,
    fogScale: 0.6,
    taa: true,
    bloom: true,
    waterTess: 96,
  },
};

export const QUALITY_TIERS = {
  ultra: {
    name: 'ultra',
    renderScale: 1.0,
    maxPixelRatio: 2.0,
    shadowMapSize: 4096,
    textureSize: 1024,
    anisotropy: 16,
    ssgi: true,
    ssgiScale: 0.7,
    ssgiRays: 8,
    ssgiSteps: 16,
    ssr: true,
    ssrSteps: 36,
    fog: true,
    fogSteps: 32,
    fogScale: 0.7,
    taa: true,
    bloom: true,
    waterTess: 128,
  },
  high: {
    name: 'high',
    renderScale: 1.0,
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    textureSize: 1024,
    anisotropy: 8,
    ssgi: true,
    ssgiScale: 0.6,
    ssgiRays: 6,
    ssgiSteps: 14,
    ssr: true,
    ssrSteps: 28,
    fog: true,
    fogSteps: 26,
    fogScale: 0.6,
    taa: true,
    bloom: true,
    waterTess: 96,
  },
  medium: {
    name: 'medium',
    renderScale: 0.85,
    maxPixelRatio: 1.25,
    shadowMapSize: 2048,
    textureSize: 512,
    anisotropy: 4,
    ssgi: true,
    ssgiScale: 0.4,
    ssgiRays: 4,
    ssgiSteps: 8,
    ssr: true,
    ssrSteps: 22,
    fog: true,
    fogSteps: 18,
    fogScale: 0.4,
    taa: true,
    bloom: true,
    waterTess: 72,
  },
  low: {
    name: 'low',
    renderScale: 0.7,
    maxPixelRatio: 1.0,
    shadowMapSize: 1024,
    textureSize: 512,
    anisotropy: 2,
    ssgi: false,
    ssgiScale: 0.35,
    ssgiRays: 3,
    ssgiSteps: 6,
    ssr: true,
    ssrSteps: 14,
    fog: true,
    fogSteps: 12,
    fogScale: 0.35,
    taa: true,
    bloom: true,
    waterTess: 48,
  },
};

export function applyTier(name) {
  const tier = QUALITY_TIERS[name];
  if (!tier) return CFG.quality;
  CFG.quality = { ...tier };
  return CFG.quality;
}
