/**
 * assets/AssetManager.js — loads manifest, jbeam parts, DAE scenes (ColladaLoader),
 * binds meshes to the vehicle, resolves textures (converted PNGs or procedural fallbacks)
 */
import * as THREE from 'three';
import { ColladaLoader } from 'three/addons/ColladaLoader.js';
import { CFG } from '../config.js';
import { parseJbeam, normPath } from '../utils/jbeam.js';

export class AssetManager {
  constructor(onProgress) {
    this.onProgress = onProgress || (() => {});
    this.manifest = null;
    this.jbeams = {};          // url -> parsed object
    this.daeScenes = {};       // url -> {scene, meshes: Map<name, THREE.Mesh>}
    this.meshIndex = {};       // normalized mesh name -> {daeUrl, mesh}
    this.parts = [];           // resolved build parts
    this.wheelParts = [];
    this.tireParts = [];
    this.extraMeshes = [];
    this.proceduralCache = new Map();
  }

  async load() {
    this.log('fetching manifest…');
    const res = await fetch(CFG.MANIFEST);
    this.manifest = await res.json();
    this.log(`manifest OK — ${this.manifest.textureCount} textures, ${Object.keys(this.manifest.flexbodyIndex).length} flexbody mesh entries`);

    // resolve build recipe
    const build = CFG.BUILD;
    const neededDae = new Set(build.daeFiles.map(normPath));
    this.parts = [];
    for (const p of build.parts) {
      const url = normPath(p.file);
      const obj = await this.loadJbeam(url);
      if (obj && obj[p.part]) {
        const flex = this.flexbodiesOf(obj[p.part]);
        this.parts.push({ ...p, url, def: obj[p.part], flexbodies: flex });
        for (const f of flex) {
          const dae = this.manifest.flexbodyIndex[f.mesh];
          if (dae) neededDae.add(normPath(dae));
        }
      } else {
        this.log(`WARN part not found: ${url} :: ${p.part}`);
      }
    }
    for (const w of build.wheels) {
      const url = normPath(w.file);
      const obj = await this.loadJbeam(url);
      if (obj && obj[w.part]) {
        this.wheelParts.push({ ...w, url, def: obj[w.part] });
      } else {
        // fallback: first part in file that has flexbodies
        const first = obj ? Object.keys(obj).find(k => Array.isArray(obj[k].flexbodies)) : null;
        if (first) this.wheelParts.push({ ...w, part: first, url, def: obj[first] });
        else this.log(`WARN wheel part missing: ${url}`);
      }
    }
    for (const t of build.tires) {
      const url = normPath(t.file);
      const obj = await this.loadJbeam(url);
      if (obj && obj[t.part]) this.tireParts.push({ ...t, url, def: obj[t.part] });
      else this.log(`WARN tire part missing: ${url} (${t.part})`);
    }
    this.log(`build recipe resolved: ${this.parts.length} parts, ${this.wheelParts.length} wheel sets, ${this.tireParts.length} tire sets`);

    // load dae scenes
    let i = 0;
    for (const d of neededDae) {
      await this.loadDae(d, (pct) => {
        this.onProgress(0.15 + 0.75 * ((i + pct) / neededDae.size));
      });
      i++;
      this.onProgress(0.15 + 0.75 * (i / neededDae.size));
    }
    this.onProgress(0.92);
    this.buildMeshIndex();
    this.onProgress(1);
  }

  log(msg) {
    console.log('[BEAMGL][assets] ' + msg);
    if (window.__beamglLog) window.__beamglLog(msg);
  }

  async loadJbeam(url) {
    if (this.jbeams[url]) return this.jbeams[url];
    const res = await fetch(CFG.ASSET_ROOT + '/' + url);
    if (!res.ok) { this.log(`jbeam fetch failed: ${url}`); return null; }
    const text = await res.text();
    const obj = parseJbeam(text);
    this.jbeams[url] = obj;
    return obj;
  }

  /** Extract flexbody mesh names of a part (with per-part resolution of common groups) */
  flexbodiesOf(part) {
    const out = [];
    const rows = part.flexbodies;
    if (!Array.isArray(rows)) return out;
    for (const r of rows) {
      if (!Array.isArray(r) || typeof r[0] !== 'string' || r[0] === 'mesh') continue;
      if (typeof r[1] === 'string' || !Array.isArray(r[1])) continue;
      out.push({ mesh: r[0], groups: r[1], transform: r[3] });
    }
    return out;
  }

  loadDae(url, onProgress) {
    return new Promise((resolve, reject) => {
      const loader = new ColladaLoader();
      loader.load(
        CFG.ASSET_ROOT + '/' + url,
        (collada) => {
          const scene = collada.scene;
          this.prepareDaeScene(scene);
          this.daeScenes[url] = { scene, collada };
          this.log(`DAE loaded: ${url} (${scene.children.length} roots)`);
          resolve();
        },
        (xhr) => { if (onProgress && xhr.total) onProgress(xhr.loaded / xhr.total); },
        (err) => { this.log(`DAE FAILED: ${url} — ${err.message || err}`); resolve(); }
      );
    });
  }

  /** bake scene-root Z_UP->Y_UP + per-node transforms into geometry (clones keep correct
   *  orientation), mirror geometry (jbeam x+ = left -> three x+ = right), fix normals */
  prepareDaeScene(scene) {
    const rootMatrix = new THREE.Matrix4().compose(scene.position, scene.quaternion, scene.scale);
    const hasRoot = rootMatrix.determinant() !== 0 && !rootMatrix.equals(new THREE.Matrix4());
    const rootNormalMatrix = new THREE.Matrix3().getNormalMatrix(rootMatrix);
    const identity = new THREE.Matrix4();

    scene.traverse((o) => {
      if (o.isMesh) {
        let g = o.geometry;
        if (!g) return;
        const localM = new THREE.Matrix4().compose(o.position, o.quaternion, o.scale);
        const hasLocal = !localM.equals(identity);
        // clone shared geometries that carry distinct local transforms (avoid bake pollution)
        if (hasLocal) {
          g = g.clone();
          o.geometry = g;
        }
        const M = hasRoot || hasLocal ? rootMatrix.clone().multiply(localM) : null;
        if (M) {
          g.applyMatrix4(M);
          const n = g.attributes.normal;
          if (n) n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(M));
        }
        // mirror: jbeam/dae x+ = left -> three x+ = right
        g.scale(-1, 1, 1);
        const n = g.attributes.normal;
        if (n) {
          for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), n.getY(i), n.getZ(i));
          n.needsUpdate = true;
        }
        g.computeBoundingBox();
        g.computeBoundingSphere();
        // transform baked into geometry: reset node transform
        o.position.set(0, 0, 0);
        o.quaternion.identity();
        o.scale.set(1, 1, 1);

        if (Array.isArray(o.material)) {
          for (const m of o.material) this.fixMaterial(m);
        } else if (o.material) this.fixMaterial(o.material);
      }
    });
    // reset root transform (already baked in)
    scene.position.set(0, 0, 0);
    scene.quaternion.identity();
    scene.scale.set(1, 1, 1);
    // replace broken/missing textures with procedural fallbacks
    this.patchMissingTextures(scene);
  }

  fixMaterial(m) {
    if (!m) return;
    m.side = THREE.DoubleSide;
    if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
    if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    if (m.alphaMap) m.alphaMap.colorSpace = THREE.SRGBColorSpace;
    // remember original opacity (glass etc.)
    m.userData.baseOpacity = m.opacity !== undefined ? m.opacity : 1;
  }

  buildMeshIndex() {
    this.meshIndex = {};
    for (const [daeUrl, { scene }] of Object.entries(this.daeScenes)) {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const names = [o.name, o.geometry && o.geometry.name];
        if (o.userData && o.userData.name) names.push(o.userData.name);
        for (const nm of names) {
          if (!nm) continue;
          const k = this.normKey(nm);
          if (!this.meshIndex[k]) this.meshIndex[k] = { daeUrl, mesh: o };
        }
      });
    }
  }

  normKey(name) {
    let k = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (k.endsWith('mesh')) k = k.slice(0, -4);
    return k;
  }

  /** find a mesh by flexbody-style name with tolerance for _F/_R suffixes */
  findMesh(name) {
    if (!name) return null;
    const cands = [
      name,
      name.replace(/_[fr]$/i, ''),
      name.replace(/_\d+$/i, ''),
      name.replace(/_staticc$/i, '').replace(/_static$/i, ''),
    ];
    for (const c of cands) {
      const m = this.meshIndex[this.normKey(c)];
      if (m) return m.mesh;
    }
    return null;
  }

  /** clone a mesh (shallow geometry clone NOT needed — geometry reused, material cloned) */
  cloneMesh(mesh) {
    const cloned = mesh.clone();
    if (Array.isArray(mesh.material)) cloned.material = mesh.material.map(m => m.clone());
    else cloned.material = mesh.material ? mesh.material.clone() : null;
    return cloned;
  }

  /** procedural fallback texture for missing assets */
  proceduralTexture(key, w = 256, h = 256) {
    if (this.proceduralCache.has(key)) return this.proceduralCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const seed = this.hashStr(key);
    const hue = seed % 360;
    // dark metal-ish base with subtle gradient + noise
    ctx.fillStyle = `hsl(${hue}, 14%, 24%)`;
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, `hsla(${hue}, 30%, 34%, .9)`);
    grad.addColorStop(1, `hsla(${(hue + 30) % 360}, 25%, 16%, .95)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      const g = 20 + ((seed * 31 + i * 17) % 40);
      ctx.fillStyle = `rgba(${g},${g},${g + 8},0.05)`;
      ctx.fillRect((seed * 13 + i * 97) % w, (seed * 7 + i * 53) % h, 3, 3);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.proceduralCache.set(key, tex);
    return tex;
  }

  hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  }

  /** fix up textures that failed to load (replaced with _missing.png placeholder or empty) */
  patchMissingTextures(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        for (const slot of ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap']) {
          const t = m[slot];
          if (!t) continue;
          const img = t.image;
          const broken = !img ||
            (!img.src && !img.data && !img.width) ||
            (img.src && img.src.includes('_missing'));
          if (broken) {
            const name = o.name + '_' + slot;
            const rep = this.proceduralTexture(name, 512, 512);
            if (slot === 'normalMap') rep.colorSpace = THREE.NoColorSpace;
            m[slot] = rep;
            m.needsUpdate = true;
          }
        }
      }
    });
  }
}
