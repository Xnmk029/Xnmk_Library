/*! V4f 自研 MTL 加载器（经典脚本，依赖 window.THREE 精简层） */
(function (root) {
  'use strict';
  const THREE = root.THREE;

  function MTLLoader() { this.path = ''; }
  MTLLoader.prototype.setPath = function (p) { this.path = p || ''; return this; };
  MTLLoader.prototype.load = function (url, onLoad, onError) {
    const self = this;
    fetch(this.path + url).then((r) => {
      if (!r.ok) throw new Error('MTL HTTP ' + r.status);
      return r.text();
    }).then((text) => {
      const mats = self.parse(text);
      // 预加载贴图（本项目 MTL 无 map_Kd，直接回调）
      onLoad(mats);
    }).catch((e) => onError && onError(e));
    return this;
  };
  MTLLoader.prototype.parse = function (text) {
    const materials = {};
    let cur = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const p = line.split(/\s+/);
      const k = p[0].toLowerCase();
      if (k === 'newmtl') {
        cur = { name: p[1], color: 0xcccccc, roughness: 0.6, metalness: 0.1, emissive: 0, opacity: 1, transparent: false };
        materials[p[1]] = cur;
      } else if (cur) {
        if (k === 'kd') cur.color = rgb(p);
        else if (k === 'ke') cur.emissive = rgb(p);
        else if (k === 'ks') { /* 高光色 → 金属感 */ cur.metalness = 0.35; cur.roughness = Math.max(0.2, cur.roughness); }
        else if (k === 'ns') cur.roughness = Math.min(0.9, Math.max(0.05, 1000 / Math.max(1, parseFloat(p[1]))));
        else if (k === 'd' || k === 'tr') { cur.opacity = k === 'd' ? parseFloat(p[1]) : 1 - parseFloat(p[1]); cur.transparent = cur.opacity < 0.999; }
        else if (k === 'map_kd') cur.map = p[1];
      }
    }
    const out = { materials: {} };
    for (const key of Object.keys(materials)) {
      const m = materials[key];
      const mat = new THREE.MeshStandardMaterial({
        color: m.color, roughness: m.roughness, metalness: m.metalness,
        emissive: m.emissive, emissiveIntensity: m.emissive ? 1 : 0,
        transparent: m.transparent, opacity: m.opacity
      });
      mat.name = key;
      out.materials[key] = mat;
    }
    return out;
  };
  function rgb(p) {
    const r = Math.max(0, Math.min(1, parseFloat(p[1])));
    const g = Math.max(0, Math.min(1, parseFloat(p[2])));
    const b = Math.max(0, Math.min(1, parseFloat(p[3])));
    return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
  }
  root.THREE.MTLLoader = MTLLoader;
})(typeof globalThis !== 'undefined' ? globalThis : this);
