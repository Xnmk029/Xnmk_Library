/**
 * TextureFactory — GPU-baked, perfectly tileable PBR texture sets for the Poolrooms.
 *
 * No image files, no network: every map is produced by fullscreen shader passes into
 * WebGLRenderTargets at load time. Four passes per preset:
 *
 *   1. DATA pass   -> scratch RT (RGBA): R = height, G = stain, B = wear, A = feature mask
 *                     (puddle / crack / brush, depending on family). This is the only
 *                     expensive pass (all the periodic noise lives here).
 *   2. ALBEDO pass -> reads the data RT, writes linear colour into an sRGB RT.
 *   3. NORMAL pass -> central differences of the *same* height field (texel-space).
 *   4. ORM  pass   -> AO from multi-tap height occlusion, roughness/metalness from masks.
 *
 * Tileability: every noise primitive hashes an integer lattice cell that is wrapped with
 * `mod(cell, period)`, so all fields — including domain-warped and ridged ones — are exactly
 * periodic over [0,1]². There is no `fract(sin(dot()))` domain warp and no aperiodic FBM.
 *
 * Consumer contract (see bake()): map / normalMap / ormMap, worldScale (metres per repeat)
 * and params. `ormMap` is glTF-packed (R=AO, G=roughness, B=metalness) and is meant to be
 * assigned to aoMap + roughnessMap + metalnessMap at once; every texture uses UV channel 0.
 */

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/* -------------------------------------------------------------------------- */
/* Presets                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Option reference (all presets accept all of these; `bake()` shallow-merges overrides):
 *
 *  size        int    baked resolution (clamped to the factory size and GPU limit)
 *  worldScale  float  METRES covered by one texture repeat
 *  family      enum   'tile' | 'surface' | 'metal' — which shader branch bakes it
 *  tiles       int    tiles across one repeat (tile family; 1 for surfaces)
 *  tint        [r,g,b] base albedo, authored in sRGB 0..1
 *  second      [r,g,b] secondary colour: grout (tile family) / crack+stain (surfaces)
 *  hue         float  hue rotation applied to `tint`, in turns (0..1)
 *  hueVar      float  per-tile hue jitter (turns)
 *  satVar      float  per-tile saturation jitter (relative)
 *  valVar      float  per-tile value jitter (relative)
 *  grout       float  grout half-width as a fraction of the tile pitch
 *  groutDepth  float  grout recess in height units (0..1)
 *  groutRough  float  roughness of grout / cracks
 *  bevel       float  tile edge bevel width, fraction of tile pitch
 *  tileWarp    float  tile-to-tile height variance
 *  dirt        float  mineral / limescale / damp staining amount
 *  streak      float  downward water streaks (walls)
 *  puddle      float  puddle-darkened patches (decks)
 *  scratch     float  isotropic micro wear near tile edges
 *  speckle     float  aggregate / warm speckle
 *  crack       float  hairline cracks
 *  grain       float  fine sand grain
 *  stipple     float  roller stipple
 *  mottle      float  broad low-frequency mottling
 *  roughRange  [min,max] roughness written into ORM.g
 *  metalness   float  ORM.b
 *  bump        float  height -> normal gradient gain (bake-time only, calibrated at 1024
 *                     and auto-scaled with `size` so slopes are resolution independent)
 *  aoStrength  float  baked AO gain
 *  normalScale float  RECOMMENDED material.normalScale
 *  aoIntensity float  RECOMMENDED material.aoMapIntensity
 *  seed        float  changes every random field
 */
const DEFAULTS = {
  size: 1024,
  worldScale: 1,
  family: 'surface',
  tiles: 1,
  tint: [0.7, 0.7, 0.7],
  second: [0.5, 0.5, 0.5],
  hue: 0,
  hueVar: 0,
  satVar: 0,
  valVar: 0,
  grout: 0.05,
  groutDepth: 0.3,
  groutRough: 0.8,
  bevel: 0.04,
  tileWarp: 0.03,
  dirt: 0.3,
  streak: 0,
  puddle: 0,
  scratch: 0,
  speckle: 0,
  crack: 0,
  grain: 0,
  stipple: 0,
  mottle: 0,
  roughRange: [0.3, 0.6],
  metalness: 0,
  bump: 10,
  aoStrength: 1.2,
  normalScale: 1,
  aoIntensity: 0.9,
  seed: 1,
};

export const PRESETS = {
  /** Small glossy ceramic pool tiles: ~10 across a 1.2 m repeat => ~12 cm each. */
  poolTile: {
    size: 1024, worldScale: 1.2, family: 'tile', tiles: 10,
    tint: [0.70, 0.865, 0.855], second: [0.795, 0.795, 0.775],
    hue: 0, hueVar: 0.018, satVar: 0.34, valVar: 0.10,
    grout: 0.055, groutDepth: 0.42, groutRough: 0.80, bevel: 0.035, tileWarp: 0.045,
    dirt: 0.40, streak: 0.16, scratch: 0.06, speckle: 0.05,
    roughRange: [0.05, 0.18], metalness: 0,
    bump: 7.5, aoStrength: 2.0, normalScale: 1.0, aoIntensity: 0.9, seed: 11,
  },

  /** Deep-end basin: same family, deeper blue-teal, dirtier. */
  poolTileDeep: {
    size: 1024, worldScale: 1.2, family: 'tile', tiles: 10,
    tint: [0.375, 0.655, 0.715], second: [0.70, 0.715, 0.705],
    hue: 0, hueVar: 0.022, satVar: 0.30, valVar: 0.13,
    grout: 0.055, groutDepth: 0.44, groutRough: 0.84, bevel: 0.035, tileWarp: 0.055,
    dirt: 0.62, streak: 0.22, scratch: 0.08, speckle: 0.05,
    roughRange: [0.06, 0.24], metalness: 0,
    bump: 7.5, aoStrength: 2.1, normalScale: 1.05, aoIntensity: 0.95, seed: 23,
  },

  /** Deck slabs: ~3 across a 2.4 m repeat => ~80 cm, semi-matte, puddles. */
  deckTile: {
    size: 1024, worldScale: 2.4, family: 'tile', tiles: 3,
    tint: [0.855, 0.840, 0.800], second: [0.630, 0.615, 0.585],
    hue: 0, hueVar: 0.008, satVar: 0.26, valVar: 0.075,
    grout: 0.022, groutDepth: 0.36, groutRough: 0.88, bevel: 0.016, tileWarp: 0.030,
    dirt: 0.38, streak: 0.05, puddle: 0.95, scratch: 0.75, speckle: 0.55,
    roughRange: [0.30, 0.55], metalness: 0,
    bump: 6.5, aoStrength: 1.9, normalScale: 0.9, aoIntensity: 0.85, seed: 37,
  },

  /** Wall tiles: ~6 across a 1.8 m repeat => ~30 cm, bevelled, water streaks. */
  wallTile: {
    size: 1024, worldScale: 1.8, family: 'tile', tiles: 6,
    tint: [0.895, 0.930, 0.930], second: [0.900, 0.900, 0.880],
    hue: 0, hueVar: 0.012, satVar: 0.40, valVar: 0.055,
    grout: 0.030, groutDepth: 0.30, groutRough: 0.78, bevel: 0.085, tileWarp: 0.028,
    dirt: 0.34, streak: 0.90, scratch: 0.05, speckle: 0.04,
    roughRange: [0.06, 0.16], metalness: 0,
    bump: 8.0, aoStrength: 1.9, normalScale: 1.0, aoIntensity: 0.9, seed: 53,
  },

  /** Troweled concrete: broad mottling, aggregate, hairline cracks. */
  concrete: {
    size: 1024, worldScale: 4.0, family: 'surface', tiles: 1,
    tint: [0.650, 0.652, 0.638], second: [0.300, 0.300, 0.292],
    hue: 0, grout: 0, groutDepth: 0, groutRough: 0.75,
    dirt: 0.48, speckle: 0.85, crack: 1.0, grain: 0.55, stipple: 0, mottle: 1.0,
    roughRange: [0.25, 0.70], metalness: 0,
    bump: 20, aoStrength: 1.0, normalScale: 0.85, aoIntensity: 0.8, seed: 71,
  },

  /** Painted plaster: roller stipple, gentle unevenness, damp blooms. */
  plaster: {
    size: 1024, worldScale: 3.0, family: 'surface', tiles: 1,
    tint: [0.878, 0.888, 0.878], second: [0.560, 0.575, 0.560],
    hue: 0, grout: 0, groutDepth: 0, groutRough: 0.82,
    dirt: 0.60, speckle: 0, crack: 0.18, grain: 0.28, stipple: 1.0, mottle: 0.70,
    roughRange: [0.50, 0.80], metalness: 0,
    bump: 22, aoStrength: 0.9, normalScale: 0.8, aoIntensity: 0.75, seed: 97,
  },

  /** Cast-stone coping: smooth cement render with fine sand grain. */
  coping: {
    size: 1024, worldScale: 2.0, family: 'surface', tiles: 1,
    tint: [0.800, 0.792, 0.762], second: [0.520, 0.515, 0.495],
    hue: 0, grout: 0, groutDepth: 0, groutRough: 0.70,
    dirt: 0.26, speckle: 0.35, crack: 0.10, grain: 1.0, stipple: 0, mottle: 0.35,
    roughRange: [0.40, 0.60], metalness: 0,
    bump: 20, aoStrength: 0.85, normalScale: 0.8, aoIntensity: 0.75, seed: 131,
  },

  /** Brushed stainless: railings, grates, drain covers. Streaks run along U. */
  metal: {
    size: 1024, worldScale: 1.0, family: 'metal', tiles: 1,
    tint: [0.775, 0.787, 0.795], second: [0.400, 0.405, 0.410],
    hue: 0, grout: 0, groutDepth: 0, groutRough: 0.45,
    dirt: 0.22, speckle: 0, crack: 0, grain: 0.4, stipple: 0, mottle: 0.3,
    roughRange: [0.18, 0.35], metalness: 1.0,
    bump: 26, aoStrength: 0.45, normalScale: 0.7, aoIntensity: 0.5, seed: 173,
  },
};

const FAMILY_ID = { tile: 0, surface: 1, metal: 2 };

/* -------------------------------------------------------------------------- */
/* Shaders                                                                    */
/* -------------------------------------------------------------------------- */

// FullScreenQuad supplies a clip-space triangle with uv in [0,2]; uv covers [0,1] on screen.
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

// ---- shared GLSL: periodic hashes + noise, tile lattice, colour helpers ----
// GLSL ES 1.00 on purpose (works on both WebGL1 and WebGL2 contexts); the texel size is a
// uniform instead of textureSize() for the same reason.
const COMMON = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform vec2 uTexel;      // 1 / resolution
uniform int  uFamily;
uniform float uSeed;
uniform vec2 uTiles;
uniform float uGrout, uGroutDepth, uGroutRough, uBevel, uTileWarp;
uniform vec3 uTint, uSecond;
uniform float uHue;
uniform vec3 uJitter;     // hue, sat, val per-tile jitter
uniform float uDirt, uStreak, uPuddle, uScratch, uSpeckle, uCrack, uGrain, uStipple, uMottle;
uniform vec2 uRough;
uniform float uMetal, uBump, uAO, uAoR;

// Integer-lattice hash. The mod() wrap is what makes every field below exactly tileable.
float hash1( vec2 cell, vec2 period, float seed ) {
  cell = mod( cell, max( period, vec2( 1.0 ) ) );
  vec3 p3 = fract( vec3( cell.x, cell.y, cell.x + cell.y ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yzx + 33.33 + seed );
  return fract( ( p3.x + p3.y ) * p3.z );
}

vec2 hash2( vec2 cell, vec2 period, float seed ) {
  cell = mod( cell, max( period, vec2( 1.0 ) ) );
  vec3 p3 = fract( vec3( cell.x, cell.y, cell.x + cell.y ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yzx + 33.33 + seed );
  return fract( vec2( ( p3.x + p3.y ) * p3.z, ( p3.x + p3.z ) * p3.y ) );
}

// Periodic value noise. p = uv * freq, period = freq (must be integral).
float vnoise( vec2 p, vec2 period, float seed ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = hash1( i, period, seed );
  float b = hash1( i + vec2( 1.0, 0.0 ), period, seed );
  float c = hash1( i + vec2( 0.0, 1.0 ), period, seed );
  float d = hash1( i + vec2( 1.0, 1.0 ), period, seed );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

// Periodic FBM: frequency and period double together, so every octave stays seamless.
#define FBM(NAME, OCT) float NAME( vec2 uv, float f, float seed ) { \
  float s = 0.0, a = 0.5, n = 0.0; \
  for ( int i = 0; i < OCT; i ++ ) { \
    s += a * vnoise( uv * f, vec2( f ), seed + float( i ) * 7.13 ); \
    n += a; a *= 0.5; f *= 2.0; \
  } \
  return s / n; }
FBM( fbm3, 3 )
FBM( fbm4, 4 )
FBM( fbm5, 5 )

// Periodic Worley F1 (aggregate grains, roller stipple).
float voronoi( vec2 p, vec2 period, float seed ) {
  vec2 ip = floor( p );
  vec2 fp = fract( p );
  float md = 8.0;
  for ( int j = -1; j <= 1; j ++ ) {
    for ( int i = -1; i <= 1; i ++ ) {
      vec2 g = vec2( float( i ), float( j ) );
      vec2 o = hash2( ip + g, period, seed );
      vec2 r = g + o - fp;
      md = min( md, dot( r, r ) );
    }
  }
  return sqrt( md );
}

// Ridged periodic noise -> thin filaments for cracks.
float ridge( vec2 p, vec2 period, float seed ) {
  return 1.0 - abs( 2.0 * vnoise( p, period, seed ) - 1.0 );
}

// Tile lattice: cell index, in-tile coords, distance to the nearest grout line, per-tile random.
void tileLattice( vec2 uv, out vec2 cell, out vec2 f, out float edge, out float rnd ) {
  vec2 tp = uv * uTiles;
  cell = floor( tp );
  f = fract( tp );
  vec2 d = min( f, 1.0 - f );
  edge = min( d.x, d.y );
  rnd = hash1( cell, uTiles, uSeed );
}

// 0 in the grout groove, 1 on the tile face.
float faceMask( float edge, float aa ) {
  return smoothstep( uGrout, uGrout + max( uBevel, aa ), edge );
}

vec3 rgb2hsv( vec3 c ) {
  vec4 K = vec4( 0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0 );
  vec4 p = mix( vec4( c.bg, K.wz ), vec4( c.gb, K.xy ), step( c.b, c.g ) );
  vec4 q = mix( vec4( p.xyw, c.r ), vec4( c.r, p.yzx ), step( p.x, c.r ) );
  float d = q.x - min( q.w, q.y );
  float e = 1.0e-10;
  return vec3( abs( q.z + ( q.w - q.y ) / ( 6.0 * d + e ) ), d / ( q.x + e ), q.x );
}

vec3 hsv2rgb( vec3 c ) {
  vec4 K = vec4( 1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0 );
  vec3 p = abs( fract( c.xxx + K.xyz ) * 6.0 - K.www );
  return c.z * mix( K.xxx, clamp( p - K.xxx, 0.0, 1.0 ), c.y );
}
`;

// ---- DATA pass: one height field + three masks, everything periodic ----
const DATA_FRAG = COMMON + /* glsl */ `
void main() {
  vec2 uv = vUv;
  float aa = uTexel.x * max( uTiles.x, 1.0 );   // one texel, in tile units
  float h = 0.5, stain = 0.0, wear = 0.0, feat = 0.0;

  if ( uFamily == 0 ) {

    // ---------------- ceramic tile: pool / deck / wall ----------------
    vec2 cell, f; float edge, rnd;
    tileLattice( uv, cell, f, edge, rnd );
    float face = faceMask( edge, aa );

    float grain = vnoise( uv * 320.0, vec2( 320.0 ), uSeed + 4.0 );
    // one periodic warp field, reused for the glaze waviness, the bloom and the puddles
    vec2 w = vec2( fbm3( uv, 4.0, uSeed + 1.0 ), fbm3( uv, 4.0, uSeed + 2.0 ) ) - 0.5;
    float dome = smoothstep( 0.0, 0.34, edge );                       // glaze curvature
    float groutH = 1.0 - uGroutDepth + 0.10 * uGroutDepth * grain;    // grainy grout floor
    h = mix( groutH, 1.0 - 0.014 * ( 1.0 - dome ), face );
    h += face * ( rnd - 0.5 ) * uTileWarp;                            // tile-to-tile step
    h += face * w.x * 0.090;                                          // hand-made unevenness
    h += 0.009 * ( grain - 0.5 );                                     // micro relief

    // Mineral bloom / limescale: periodic FBM on a periodically warped domain.
    float bloom = fbm4( uv + w * 0.09, 6.0, uSeed + 3.0 );
    stain = smoothstep( 0.50, 0.86, bloom );

    // Water streaks: noise stretched along V so it reads as long vertical smears.
    float s1 = vnoise( uv * vec2( 56.0, 2.0 ), vec2( 56.0, 2.0 ), uSeed + 5.0 );
    float s2 = vnoise( uv * vec2( 112.0, 5.0 ), vec2( 112.0, 5.0 ), uSeed + 6.0 );
    float streak = smoothstep( 0.16, 0.52, s1 * s2 );

    stain = clamp( ( stain + uStreak * streak ) * uDirt + ( 1.0 - face ) * 0.40 * uDirt, 0.0, 1.0 );

    // Isotropic micro wear, strongest along the tile borders.
    float micro = vnoise( uv * 420.0, vec2( 420.0 ), uSeed + 7.0 );
    float edgeBand = 1.0 - smoothstep( uGrout, uGrout + 0.16, edge );
    // NOTE: the per-tile term is gated by the face mask so the grout line keeps a
    // continuous brightness instead of stepping at every tile boundary.
    wear = clamp( 0.30 * micro + 0.45 * rnd * face + uScratch * edgeBand * micro * 1.6, 0.0, 1.0 );
    h -= uScratch * edgeBand * micro * 0.02 * face;

    // Puddle-darkened patches (deck).
    feat = smoothstep( 0.54, 0.71, fbm4( uv + w * 0.05, 3.0, uSeed + 8.0 ) ) * uPuddle;
    h -= feat * 0.010;                                                // puddles sit in dips

  } else if ( uFamily == 1 ) {

    // ---------------- troweled surfaces: concrete / plaster / coping ----------------
    float m1 = fbm5( uv, 2.0, uSeed );                                // broad mottling
    float m2 = fbm4( uv, 9.0, uSeed + 2.0 );                          // mid blotches
    float grain = vnoise( uv * 256.0, vec2( 256.0 ), uSeed + 3.0 );    // sand grain
    float agg = 0.30, stip = 0.5;                                       // neutral defaults
    if ( uSpeckle > 0.001 ) agg = 1.0 - smoothstep( 0.03, 0.30, voronoi( uv * 48.0, vec2( 48.0 ), uSeed + 4.0 ) );
    if ( uStipple > 0.001 ) stip = 1.0 - voronoi( uv * 104.0, vec2( 104.0 ), uSeed + 5.0 );

    // Hairline cracks: ridged noise on a periodically warped domain, thresholded thin.
    vec2 w = vec2( fbm3( uv, 3.0, uSeed + 6.0 ), fbm3( uv, 3.0, uSeed + 7.0 ) ) - 0.5;
    float crack = 0.0;
    if ( uCrack > 0.001 ) {
      float cr = max( ridge( ( uv + w * 0.12 ) * 5.0, vec2( 5.0 ), uSeed + 8.0 ),
                      ridge( ( uv + w * 0.12 ) * 9.0, vec2( 9.0 ), uSeed + 9.0 ) * 0.985 );
      crack = smoothstep( 0.970, 0.999, cr );
    }

    h = 0.56
      + uMottle * ( m1 - 0.5 ) * 0.46
      + 0.09 * ( m2 - 0.5 )
      + uGrain * ( grain - 0.5 ) * 0.022
      + uSpeckle * ( agg - 0.30 ) * 0.050
      + uStipple * ( stip - 0.5 ) * 0.055;
    h -= uCrack * crack * 0.38;

    stain = clamp( uDirt * smoothstep( 0.44, 0.82, fbm4( uv + w * 0.10, 4.0, uSeed + 10.0 ) ), 0.0, 1.0 );
    wear = clamp( 0.5 + ( m2 - 0.5 ) * 1.15 + ( m1 - 0.5 ) * 0.85 + ( grain - 0.5 ) * 0.35, 0.0, 1.0 );
    feat = crack;

  } else {

    // ---------------- brushed stainless: streaks run along U ----------------
    float b1 = vnoise( uv * vec2( 5.0, 176.0 ), vec2( 5.0, 176.0 ), uSeed );
    float b2 = vnoise( uv * vec2( 11.0, 56.0 ), vec2( 11.0, 56.0 ), uSeed + 1.0 );
    float brush = 0.60 * b1 + 0.40 * b2;
    float deep = smoothstep( 0.88, 1.0, vnoise( uv * vec2( 2.0, 88.0 ), vec2( 2.0, 88.0 ), uSeed + 2.0 ) );

    h = 0.5 + ( brush - 0.5 ) * 0.075 - deep * 0.045;
    stain = uDirt * smoothstep( 0.55, 0.92, fbm4( uv, 5.0, uSeed + 3.0 ) );
    wear = clamp( brush + 0.35 * deep, 0.0, 1.0 );
    feat = brush;

  }

  gl_FragColor = vec4( clamp( h, 0.0, 1.0 ), stain, wear, feat );
}
`;

// ---- OUTPUT pass: albedo (mode 1), normal (2), ORM (3) from the data RT ----
const OUT_FRAG = COMMON + /* glsl */ `
uniform sampler2D uData;
uniform int uMode;

float H( vec2 uv ) { return texture2D( uData, uv ).r; }

// sRGB -> linear: albedo is authored in sRGB but the target is an SRGB8_ALPHA8 render
// target, so the GPU re-encodes on write. Writing linear keeps the round trip exact.
float s2l( float c ) {
  return c < 0.04045 ? c * 0.0773993808 : pow( c * 0.9478672986 + 0.0521327014, 2.4 );
}

void main() {
  vec4 d = texture2D( uData, vUv );
  float aa = uTexel.x * max( uTiles.x, 1.0 );

  if ( uMode == 1 ) {

    // ------------------------------- ALBEDO -------------------------------
    vec3 col;

    if ( uFamily == 0 ) {

      vec2 cell, f; float edge, rnd;
      tileLattice( vUv, cell, f, edge, rnd );
      float face = faceMask( edge, aa );
      float band = 1.0 - smoothstep( uGrout * 0.75, uGrout + max( aa, uBevel * 0.35 ), edge );

      // Per-tile hue / saturation / value variance.
      float r2 = hash1( cell + 17.0, uTiles, uSeed + 3.0 );
      float r3 = hash1( cell + 41.0, uTiles, uSeed + 9.0 );
      vec3 hsv = rgb2hsv( uTint );
      hsv.x = fract( hsv.x + uHue + ( rnd - 0.5 ) * uJitter.x );
      hsv.y = clamp( hsv.y * ( 1.0 + ( r2 - 0.5 ) * uJitter.y ), 0.0, 1.0 );
      hsv.z = clamp( hsv.z * ( 1.0 + ( r3 - 0.5 ) * uJitter.z ), 0.0, 1.0 );
      col = hsv2rgb( hsv );

      col *= 0.985 + 0.030 * d.b;                                        // fine glaze variation
      col = mix( col, col * vec3( 1.045, 1.005, 0.945 ), uSpeckle * d.b ); // warm speckle
      col = mix( col, mix( vec3( 0.905, 0.930, 0.920 ), col, 0.42 ), d.g * 0.80 ); // limescale film
      col = mix( col, uSecond * ( 0.88 + 0.24 * d.b ), band );           // grout
      col *= mix( 1.0, 0.78, band * ( 0.35 + 0.65 * d.g ) );             // dirt in the groove
      col *= mix( 1.0, 0.80, d.a );                                      // puddles darken
      col = mix( col, col * 1.05 + 0.012, uScratch * d.b * ( 1.0 - face ) * 0.6 );

    } else if ( uFamily == 1 ) {

      col = uTint;
      col *= 0.86 + 0.28 * clamp( ( d.r - 0.48 ) * 1.9 + 0.5, 0.0, 1.0 ); // height-linked value
      col *= 0.965 + 0.070 * d.b;                                        // aggregate / speckle
      col = mix( col, col * vec3( 0.845, 0.870, 0.885 ), d.g * 0.85 );    // damp discoloration
      col = mix( col, uSecond, d.a * 0.80 );                             // cracks read dark

    } else {

      col = uTint * ( 0.88 + 0.24 * d.a );                               // brushed banding
      col = mix( col, uSecond, d.g * 0.30 );                             // smudges
      col *= 0.97 + 0.06 * d.b;

    }

    col = clamp( col, 0.0, 1.0 );
    gl_FragColor = vec4( s2l( col.r ), s2l( col.g ), s2l( col.b ), 1.0 );

  } else if ( uMode == 2 ) {

    // ------------------------------- NORMAL -------------------------------
    // Central differences on the same height field, one texel apart, +Y up (OpenGL).
    float hl = H( vUv - vec2( uTexel.x, 0.0 ) );
    float hr = H( vUv + vec2( uTexel.x, 0.0 ) );
    float hd = H( vUv - vec2( 0.0, uTexel.y ) );
    float hu = H( vUv + vec2( 0.0, uTexel.y ) );
    vec2 g = vec2( hr - hl, hu - hd ) * 0.5 * uBump;
    vec3 n = normalize( vec3( -g.x, -g.y, 1.0 ) );
    gl_FragColor = vec4( n * 0.5 + 0.5, 1.0 );

  } else {

    // --------------------------------- ORM ---------------------------------
    // R: AO from a cheap two-radius height-occlusion sweep. uAoR is the dominant crevice
    // half width IN TEXELS (derived from the preset at bake time), so the kernel brackets the
    // grout/crack no matter what resolution the set is baked at.
    float h0 = d.r;
    float occ = 0.0;
    for ( int i = 0; i < 8; i ++ ) {
      float a = float( i ) * 0.78539816;
      vec2 dir = vec2( cos( a ), sin( a ) );
      occ += 1.0 * max( 0.0, H( vUv + dir * uTexel * uAoR * 0.55 ) - h0 );
      occ += 0.7 * max( 0.0, H( vUv + dir * uTexel * uAoR * 1.50 ) - h0 );
    }
    occ /= 8.0 * 1.7;
    float ao = clamp( 1.0 - occ * uAO, 0.0, 1.0 );

    // G: roughness. B: metalness.
    float rough;
    float metal = uMetal;

    if ( uFamily == 0 ) {
      vec2 cell, f; float edge, rnd;
      tileLattice( vUv, cell, f, edge, rnd );
      float band = 1.0 - smoothstep( uGrout * 0.75, uGrout + max( aa, uBevel * 0.35 ), edge );
      float v = clamp( 0.34 * rnd + 0.66 * d.b, 0.0, 1.0 );
      rough = mix( uRough.x, uRough.y, v );
      rough += 0.22 * d.g;                       // limescale scatters a little
      rough = mix( rough, uGroutRough, band );   // grout is matte
      rough = mix( rough, rough * 0.35, d.a );   // puddles are wet and glossy
    } else if ( uFamily == 1 ) {
      rough = mix( uRough.x, uRough.y, clamp( d.b, 0.0, 1.0 ) );
      rough += 0.14 * d.g;
      rough = mix( rough, uGroutRough, d.a * 0.7 );
    } else {
      rough = mix( uRough.x, uRough.y, clamp( d.b, 0.0, 1.0 ) );
      rough += 0.20 * d.g;
      metal = uMetal * ( 1.0 - 0.25 * d.g );
    }

    gl_FragColor = vec4( ao, clamp( rough, 0.0, 1.0 ), clamp( metal, 0.0, 1.0 ), 1.0 );

  }
}
`;

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

const clampPow2 = (v) => {
  const n = Math.round(Math.log2(Math.max(16, Math.min(4096, Number(v) || 1024))));
  return 2 ** Math.max(4, Math.min(12, n));
};

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export class TextureFactory {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {{size?:number, anisotropy?:number}} opts `size`, when given, is the baked
   *        resolution for every preset (rounded to a power of two and clamped to the GPU
   *        limit); a per-call `overrides.size` still wins, and when neither is given the
   *        preset's own `size` applies. `anisotropy` is clamped to the GPU limit.
   */
  constructor(renderer, opts = { size: 1024, anisotropy: 8 }) {
    if (!renderer || renderer.isWebGLRenderer !== true) {
      throw new Error('TextureFactory: a THREE.WebGLRenderer is required.');
    }
    this.renderer = renderer;
    // null => let each preset decide its own size
    this._size = opts && opts.size != null ? clampPow2(opts.size) : null;
    this.size = this._size !== null ? this._size : 0;
    this.anisotropy = Math.max(
      1,
      Math.min(opts && opts.anisotropy != null ? opts.anisotropy : 8, renderer.capabilities.getMaxAnisotropy()),
    );
    /** Accumulated GPU-submission time of every bake so far, in ms. */
    this.bakeMs = 0;

    this._cache = new Map();
    this._targets = [];          // owned output RTs
    this._scratch = new Map();   // size -> reusable data RT

    this._uniforms = {
      uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
      uFamily: { value: 0 },
      uSeed: { value: 1 },
      uTiles: { value: new THREE.Vector2(1, 1) },
      uGrout: { value: 0.05 },
      uGroutDepth: { value: 0.3 },
      uGroutRough: { value: 0.8 },
      uBevel: { value: 0.04 },
      uTileWarp: { value: 0.03 },
      uTint: { value: new THREE.Vector3(0.7, 0.7, 0.7) },
      uSecond: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uHue: { value: 0 },
      uJitter: { value: new THREE.Vector3(0, 0, 0) },
      uDirt: { value: 0.3 },
      uStreak: { value: 0 },
      uPuddle: { value: 0 },
      uScratch: { value: 0 },
      uSpeckle: { value: 0 },
      uCrack: { value: 0 },
      uGrain: { value: 0 },
      uStipple: { value: 0 },
      uMottle: { value: 0 },
      uRough: { value: new THREE.Vector2(0.3, 0.6) },
      uMetal: { value: 0 },
      uBump: { value: 10 },
      uAO: { value: 1.2 },
      uAoR: { value: 8 },
      uData: { value: null },
      uMode: { value: 1 },
    };

    const common = {
      uniforms: this._uniforms,
      vertexShader: VERT,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    };
    this._dataMat = new THREE.ShaderMaterial({ ...common, name: 'TF.data', fragmentShader: DATA_FRAG });
    this._outMat = new THREE.ShaderMaterial({ ...common, name: 'TF.out', fragmentShader: OUT_FRAG });
    this._quad = new FullScreenQuad(this._dataMat);
  }

  /**
   * Bake (or return the cached) texture set for a preset. Synchronous.
   * @param {string} name key of PRESETS
   * @param {object} overrides shallow-merged over the preset options
   */
  bake(name, overrides = {}) {
    const preset = PRESETS[name];
    if (!preset) throw new Error(`TextureFactory: unknown preset "${name}".`);

    const key = name + '|' + JSON.stringify(overrides || {});
    const cached = this._cache.get(key);
    if (cached) return cached;

    const o = Object.assign({}, DEFAULTS, preset, overrides || {});
    // resolution: explicit override > factory-wide size > the preset's own default
    const wanted = overrides && overrides.size != null ? overrides.size
      : this._size !== null ? this._size : o.size;
    const size = Math.min(clampPow2(wanted), this.renderer.capabilities.maxTextureSize);
    const t0 = performance.now();

    const albedoRT = this._makeTarget(size, THREE.SRGBColorSpace, `${name}.map`);
    const normalRT = this._makeTarget(size, THREE.NoColorSpace, `${name}.normalMap`);
    const ormRT = this._makeTarget(size, THREE.NoColorSpace, `${name}.ormMap`);
    const dataRT = this._dataTarget(size);

    // --- save renderer state -------------------------------------------------
    const r = this.renderer;
    const prevRT = r.getRenderTarget();
    const prevFace = r.getActiveCubeFace();
    const prevMip = r.getActiveMipmapLevel();
    const prevAutoClear = r.autoClear;
    r.autoClear = false; // the quad covers every texel; never touch the clear colour

    this._setUniforms(o, size);
    const u = this._uniforms;

    // pass 1: height + masks -> scratch
    u.uData.value = null;
    this._quad.material = this._dataMat;
    r.setRenderTarget(dataRT);
    this._quad.render(r);

    // passes 2-4: albedo / normal / ORM (mipmaps are generated by renderer.render)
    u.uData.value = dataRT.texture;
    this._quad.material = this._outMat;
    u.uMode.value = 1;
    r.setRenderTarget(albedoRT);
    this._quad.render(r);
    u.uMode.value = 2;
    r.setRenderTarget(normalRT);
    this._quad.render(r);
    u.uMode.value = 3;
    r.setRenderTarget(ormRT);
    this._quad.render(r);

    // --- restore renderer state ---------------------------------------------
    u.uData.value = null;
    r.setRenderTarget(prevRT, prevFace, prevMip);
    r.autoClear = prevAutoClear;

    const set = {
      map: albedoRT.texture,
      normalMap: normalRT.texture,
      ormMap: ormRT.texture,
      worldScale: o.worldScale,
      params: {
        normalScale: o.normalScale,
        // The ORM map multiplies material.roughness / material.metalness in three.js,
        // so these must stay at 1 for the baked values to be used verbatim.
        roughness: 1,
        metalness: 1,
        aoIntensity: o.aoIntensity,
      },
    };
    this.bakeMs += performance.now() - t0;
    this._cache.set(key, set);
    return set;
  }

  /**
   * Optional, additive to the contract: free the internal scratch height/mask target
   * (size^2 RGBA16F, ~8 MB at 1024) once the initial bake burst is done. Baked texture sets
   * stay valid; the next bake() simply reallocates it.
   */
  releaseScratch() {
    for (const rt of this._scratch.values()) rt.dispose();
    this._scratch.clear();
  }

  /**
   * Free every GPU resource this factory owns. WARNING: this also destroys the map /
   * normalMap / ormMap textures handed out by bake(), so only call it when the materials
   * using them are gone too.
   */
  dispose() {
    for (const rt of this._targets) rt.dispose();
    for (const rt of this._scratch.values()) rt.dispose();
    this._targets.length = 0;
    this._scratch.clear();
    this._cache.clear();
    this._dataMat.dispose();
    this._outMat.dispose();
    this._quad.dispose();
  }

  /* ---------------------------- internals ---------------------------------- */

  _makeTarget(size, colorSpace, name) {
    const rt = new THREE.WebGLRenderTarget(size, size, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      colorSpace,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearMipmapLinearFilter,
      generateMipmaps: true,
      anisotropy: this.anisotropy,
      depthBuffer: false,
      stencilBuffer: false,
    });
    const t = rt.texture;
    t.name = name;
    t.channel = 0; // ormMap is used as aoMap too: everything must sample the `uv` attribute
    t.flipY = false;
    this._targets.push(rt);
    return rt;
  }

  // Scratch height/mask target, reused by every preset of the same size.
  _dataTarget(size) {
    let rt = this._scratch.get(size);
    if (rt) return rt;
    const ext = this.renderer.extensions;
    const half = ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float');
    rt = new THREE.WebGLRenderTarget(size, size, {
      format: THREE.RGBAFormat,
      // Half float keeps the height field smooth enough for clean central differences;
      // 8 bit is a valid (slightly steppier) fallback.
      type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      colorSpace: THREE.NoColorSpace,
      wrapS: THREE.RepeatWrapping, // wrapping is what makes the derivative taps seamless
      wrapT: THREE.RepeatWrapping,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false,
    });
    rt.texture.name = 'TF.data';
    this._scratch.set(size, rt);
    return rt;
  }

  _setUniforms(o, size) {
    const u = this._uniforms;
    u.uTexel.value.set(1 / size, 1 / size);
    u.uFamily.value = FAMILY_ID[o.family] != null ? FAMILY_ID[o.family] : 1;
    u.uSeed.value = o.seed;
    const tiles = Math.max(1, Math.round(o.tiles));
    u.uTiles.value.set(tiles, tiles);
    u.uGrout.value = o.grout;
    u.uGroutDepth.value = o.groutDepth;
    u.uGroutRough.value = o.groutRough;
    u.uBevel.value = o.bevel;
    u.uTileWarp.value = o.tileWarp;
    u.uTint.value.copy(v3(o.tint));
    u.uSecond.value.copy(v3(o.second));
    u.uHue.value = o.hue;
    u.uJitter.value.set(o.hueVar, o.satVar, o.valVar);
    u.uDirt.value = o.dirt;
    u.uStreak.value = o.streak;
    u.uPuddle.value = o.puddle;
    u.uScratch.value = o.scratch;
    u.uSpeckle.value = o.speckle;
    u.uCrack.value = o.crack;
    u.uGrain.value = o.grain;
    u.uStipple.value = o.stipple;
    u.uMottle.value = o.mottle;
    u.uRough.value.set(o.roughRange[0], o.roughRange[1]);
    u.uMetal.value = o.metalness;
    // The height->normal gain is per texel, so it must scale with resolution for a 512 and a
    // 2048 bake of the same preset to describe the same physical slope. `bump` is calibrated
    // at 1024.
    u.uBump.value = o.bump * (size / 1024);
    u.uAO.value = o.aoStrength;
    // AO kernel size: the grout/bevel half width for tiles, a fixed feature scale otherwise
    const aoR = o.family === 'tile'
      ? (o.grout + o.bevel) * (size / tiles)
      : size / 128;
    u.uAoR.value = Math.max(2.5, Math.min(aoR, size / 12));
  }
}

export default TextureFactory;
