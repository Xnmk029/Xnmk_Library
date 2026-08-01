// Phase 1.3 / 4 — Collada mesh loading for the CCF, wired to the physics.
// * DDS texture resolution: the DAEs reference the author's local .png paths;
//   a LoadingManager URL modifier maps each basename to the extracted .dds
//   (looked up in the asset manifest) and DDSLoader decodes it.
// * Node selection: ccfremodel.dae carries every factory/aftermarket variant;
//   selectCarConfigNodes() hides RHD duplicates and option-suffix variants so
//   the default cup configuration renders as one coherent car.
// * Wheel meshes come from the common wheel DAE, cloned x4 and normalised to
//   the physics tire radius; main.js binds them to the WheelAssembly poses.

import * as THREE from '../../lib/three.module.js';
import { ColladaLoader } from '../../lib/ColladaLoader.js';
import { DDSLoader } from '../../lib/DDSLoader.js';

/** Build a basename(lower-case) -> asset path map from the manifest path list. */
export function buildAssetIndex(manifestPaths) {
  const map = new Map();
  for (const p of manifestPaths) {
    const base = p.slice(p.lastIndexOf('/') + 1).toLowerCase();
    if (!map.has(base)) map.set(base, p);
  }
  return map;
}

/**
 * LoadingManager that rewrites any texture URL to its extracted DDS twin.
 * Falls back to the original URL when no twin exists (loader then 404s
 * quietly and the material keeps its flat color).
 */
export function makeAssetManager(assetIndex) {
  const manager = new THREE.LoadingManager();
  manager.addHandler(/\.dds$/i, new DDSLoader());
  manager.setURLModifier((url) => {
    if (/\.(png|jpg|jpeg|tga|dds)$/i.test(url)) {
      const base = url.slice(url.lastIndexOf('/') + 1).toLowerCase().replace(/\.(png|jpg|jpeg|tga)$/i, '.dds');
      const hit = assetIndex.get(base);
      if (hit) return encodeURI(hit);
    }
    return url;
  });
  return manager;
}

const LOCATION_SUFFIX = /^(l|r|lhd|rhd|fl|fr|rl|rr|front|rear|left|right|l_2|r_2|\d+)$/i;

/**
 * Hide variant/duplicate nodes of the full-remodel DAE so only the default
 * cup configuration stays visible. Rules:
 *  1. `_rhd` twin hidden when the `_lhd` (or base) version exists.
 *  2. A node whose name extends another existing node name by `_suffix` is a
 *     variant -> hidden, unless the suffix is a mere location (L/R/FL/...).
 * Returns {shown, hidden} counts for diagnostics.
 */
export function selectCarConfigNodes(root) {
  const names = new Set();
  root.traverse((o) => { if (o.name) names.add(o.name); });
  let shown = 0;
  let hidden = 0;
  root.traverse((o) => {
    if (!o.name) return;
    const n = o.name;
    let hide = false;
    const rhd = n.match(/^(.*)_rhd(.*)$/i);
    if (rhd && (names.has(`${rhd[1]}_lhd${rhd[2]}`) || names.has(`${rhd[1]}${rhd[2]}`))) hide = true;
    if (!hide) {
      let best = null;
      for (const m of names) {
        if (m.length < n.length && n.startsWith(m + '_') && (!best || m.length > best.length)) best = m;
      }
      if (best) {
        const suffix = n.slice(best.length + 1);
        const first = suffix.split('_')[0];
        if (!LOCATION_SUFFIX.test(first)) hide = true;
      }
    }
    if (hide) { o.visible = false; hidden++; } else shown++;
  });
  return { shown, hidden };
}

/** Apply diffuseColor entries from a BeamNG materials.json to loaded materials. */
export function applyMaterialColors(root, materialsJson) {
  if (!materialsJson) return 0;
  let applied = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || m.userData.colorApplied) continue;
      const entry = materialsJson[m.name];
      const c = entry && (entry.diffuseColor || entry.baseColor);
      if (Array.isArray(c) && c.length >= 3 && !m.map) {
        m.color = new THREE.Color(c[0], c[1], c[2]);
        m.userData.colorApplied = true;
        applied++;
      }
      // Glass-like materials become transparent.
      if (entry && /glass/i.test(m.name)) {
        m.transparent = true;
        m.opacity = 0.35;
        m.depthWrite = false;
      }
    }
  });
  return applied;
}

/** Generic material hygiene for Collada output (roughness, shadows, env). */
export function sanitizeMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if ('shininess' in m) m.shininess = Math.min(m.shininess ?? 30, 60);
      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.anisotropy = 4;
      }
    }
  });
}

export class CarMeshLoader {
  /** @param {string[]} manifestPaths entries of vehicles/manifest.json */
  constructor(manifestPaths) {
    this.assetIndex = buildAssetIndex(manifestPaths);
    this.manager = makeAssetManager(this.assetIndex);
    this.loader = new ColladaLoader(this.manager);
  }

  /** Load one Collada file -> THREE.Group. */
  load(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(encodeURI(url), (collada) => resolve(collada.scene), undefined, reject);
    });
  }

  /**
   * Load the car body: remodel DAE filtered to the cup configuration,
   * plus the cup-parts overlay DAE.
   */
  async loadBody({ remodelUrl, cupUrl, materialsJson, onProgress } = {}) {
    const group = new THREE.Group();
    group.name = 'ccf_body_group';
    const remodel = await this.load(remodelUrl);
    const sel = selectCarConfigNodes(remodel);
    sanitizeMaterials(remodel);
    applyMaterialColors(remodel, materialsJson);
    group.add(remodel);
    if (onProgress) onProgress('remodel', sel);
    if (cupUrl) {
      const cup = await this.load(cupUrl);
      sanitizeMaterials(cup);
      applyMaterialColors(cup, materialsJson);
      group.add(cup);
      if (onProgress) onProgress('cup', null);
    }
    return group;
  }

  /**
   * Load a wheel DAE and return a normalised template: centered at the hub,
   * scaled so its bounding radius matches `radius`. Clone per corner.
   */
  async loadWheelTemplate(url, radius) {
    const g = await this.load(url);
    sanitizeMaterials(g);
    // Center at bounding-box midpoint (hub axis) and rescale to physics radius.
    const box = new THREE.Box3().setFromObject(g);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const outerR = Math.max(size.y, size.z) * 0.5;
    const scale = outerR > 1e-4 ? radius / outerR : 1;
    const wrapper = new THREE.Group();
    g.position.sub(center);
    wrapper.add(g);
    wrapper.scale.setScalar(scale);
    return wrapper;
  }
}
