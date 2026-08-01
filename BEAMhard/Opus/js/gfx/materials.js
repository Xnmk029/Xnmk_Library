/**
 * materials.js — BeamNG *.materials.json → NPR toon material bridge.
 *
 * Responsibilities:
 *   · parse every materials.json in the VFS (relaxed parser — several mod
 *     files are not strict JSON) and index by mapTo/name
 *   · classify each material (paint / glass / light / interior / tire / etc.)
 *   · build a ToonCarMaterial per DAE material name, then stream the DDS
 *     textures in asynchronously (base color, normal, AO, opacity, paint mask)
 *   · answer with a deterministic tinted fallback when the texture or the
 *     definition is missing (mods routinely reference vanilla-game assets)
 */
import * as THREE from 'three';
import { parseJBeam } from '../jbeam/relaxedjson.js';
import { makeToonMaterial } from './npr.js';

const EXT_SWAPS = [['.png', '.dds'], ['.jpg', '.dds'], ['.dds', '.png']];

const FALLBACK_TINTS = [
  [/glass|window|screenglass/i, { tint: 0x9fb4c4, transparent: true, opacity: 0.32, envStrength: 0.5, specStrength: 0.9, doubleSided: true }],
  [/tire|rubber/i, { tint: 0x17181c, specStrength: 0.08, bands: 2 }],
  [/chrome|badge|lugs|exhaust_tip|mirror_glass/i, { tint: 0xd8dce2, envStrength: 0.75, specStrength: 0.9, specPower: 160 }],
  [/light|signal|drl|beam|reflector|flasher/i, { tint: 0xcfd6da, envStrength: 0.3, specStrength: 0.7, emissive: 0x151312 }],
  [/interior|carpet|dash|seat|belt|roof|card|console/i, { tint: 0x2a2c31, specStrength: 0.12, bands: 2 }],
  [/engine|mech|suspension|subframe|arm|hub|brake|diff|shaft|coilover|swaybar|rack/i, { tint: 0x53565e, specStrength: 0.3 }],
  [/plate|licence|license/i, { tint: 0xe8e5da }],
  [/skin|main|body|paint|bumper|door|bonnet|boot|wing|quarter/i, { tint: 0xd7d9dc, paintable: true, envStrength: 0.4, specStrength: 0.6, specPower: 120 }],
];

export class MaterialLibrary {
  constructor(vfs, ddsLoader, log = () => {}) {
    this.vfs = vfs;
    this.dds = ddsLoader;
    this.log = log;
    this.defs = new Map();        // lower(mapTo|name) -> def
    this.cache = new Map();       // dae material name -> THREE material
    this.texCache = new Map();    // norm path -> Promise<Texture|null>
    this.paint = new THREE.Color('#ff5a2d');   // FR-anime sunset orange default
    this.paintables = [];
    this.pending = 0;
    this.stats = { defs: 0, built: 0, texOk: 0, texMiss: 0 };
  }

  async loadAll() {
    const files = this.vfs.listByExt('.materials.json');
    for (const f of files) {
      try {
        const doc = parseJBeam(await this.vfs.text(f), f);
        for (const [name, def] of Object.entries(doc)) {
          if (!def || typeof def !== 'object') continue;
          def.__file = f;
          const keys = new Set([name, def.mapTo, def.name].filter(Boolean));
          for (const k of keys) this.defs.set(String(k).toLowerCase(), def);
        }
      } catch (e) {
        this.log(`materials: ${f} unparsable (${e.message})`, 'warn');
      }
    }
    this.stats.defs = this.defs.size;
    this.log(`materials: indexed ${this.defs.size} definitions from ${files.length} files`);
  }

  setPaint(hex) {
    this.paint.set(hex);
    for (const m of this.paintables) m.uniforms.uPaint.value.copy(this.paint);
  }

  async loadTexture(path, srgb) {
    if (!path) return null;
    const key = path.toLowerCase() + (srgb ? '|s' : '|l');
    if (this.texCache.has(key)) return this.texCache.get(key);
    const p = (async () => {
      try {
        if (!this.vfs.has(path, EXT_SWAPS)) { this.stats.texMiss++; return null; }
        const buf = await this.vfs.arrayBuffer(path, EXT_SWAPS);
        const tex = this.dds.parse(buf, srgb, path);
        if (tex) this.stats.texOk++; else this.stats.texMiss++;
        return tex;
      } catch { this.stats.texMiss++; return null; }
    })();
    this.texCache.set(key, p);
    return p;
  }

  /** Fallback opts by material name heuristics. */
  classify(name) {
    for (const [re, opts] of FALLBACK_TINTS) if (re.test(name)) return { ...opts };
    return { tint: 0x8f939b };
  }

  /**
   * Resolve a THREE material for a DAE material name. Returns immediately with
   * a tinted toon material; textures attach asynchronously as they decode.
   */
  get(daeName) {
    const clean = String(daeName || '').replace(/-material$/i, '').trim();
    const cacheKey = clean.toLowerCase();
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const def = this.defs.get(cacheKey) || null;
    const cls = this.classify(clean);
    const stages = def && Array.isArray(def.Stages) ? def.Stages : [];
    const s0 = stages[0] || {};
    const s1 = stages[1] || {};

    const translucent = !!(def && (def.translucentBlendOp === 'PreMulAlpha' || def.translucentBlendOp === 'LerpAlpha' || def.translucent));
    const paintable = !!(s1.instanceDiffuse || s1.colorPaletteMap || cls.paintable);
    const isGlassLike = translucent || cls.transparent;

    const opts = {
      ...cls,
      paintable,
      transparent: isGlassLike,
      opacity: isGlassLike ? (cls.opacity ?? 0.45) : 1,
      envStrength: cls.envStrength ?? (paintable ? 0.4 : 0),
      paint: this.paint.getHex(),
    };
    if (def && Array.isArray(s0.diffuseColor) && !s0.baseColorMap) {
      const [r, g, b] = s0.diffuseColor;
      opts.tint = new THREE.Color(r ?? 0.8, g ?? 0.8, b ?? 0.8).getHex();
    }
    const mat = makeToonMaterial(opts);
    mat.name = clean;
    if (paintable) {
      mat.uniforms.uPaint.value.copy(this.paint);
      this.paintables.push(mat);
    }
    this.cache.set(cacheKey, mat);
    this.stats.built++;

    if (def) {
      this.pending++;
      this.attachTextures(mat, s0, s1, isGlassLike).finally(() => this.pending--);
    }
    return mat;
  }

  async attachTextures(mat, s0, s1, glass) {
    const base = await this.loadTexture(s0.baseColorMap || s0.colorMap || s0.diffuseMap, true);
    if (base) {
      mat.uniforms.uMap.value = base;
      mat.uniforms.uHasMap.value = 1;
      mat.uniforms.uTint.value.setRGB(1, 1, 1);
    }
    const nrm = await this.loadTexture(s0.normalMap, false);
    if (nrm) {
      mat.uniforms.uNormalMap.value = nrm;
      mat.uniforms.uHasNormal.value = 1;
      mat.uniforms.uNormalIsRG.value = (nrm.format === THREE.RED_GREEN_RGTC2_Format) ? 1 : 0;
    }
    const ao = await this.loadTexture(s0.ambientOcclusionMap, false);
    if (ao) { mat.uniforms.uAOMap.value = ao; mat.uniforms.uHasAO.value = 1; }
    if (glass && s0.opacityMap) {
      const op = await this.loadTexture(s0.opacityMap, false);
      if (op) { mat.uniforms.uOpacityMap.value = op; mat.uniforms.uHasOpacityMap.value = 1; }
    }
    // paint blend mask lives in the second stage's opacityMap (…_c.data.dds)
    if (mat.uniforms.uPaintable.value > 0.5 && s1.opacityMap) {
      const mask = await this.loadTexture(s1.opacityMap, false);
      if (mask) { mat.uniforms.uPaintMask.value = mask; mat.uniforms.uHasPaintMask.value = 1; }
    }
  }

  async waitIdle(timeoutMs = 20000) {
    const t0 = performance.now();
    while (this.pending > 0 && performance.now() - t0 < timeoutMs) {
      await new Promise(r => setTimeout(r, 60));
    }
  }
}

export default MaterialLibrary;
