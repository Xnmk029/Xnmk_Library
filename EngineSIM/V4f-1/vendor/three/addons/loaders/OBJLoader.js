/*! V4f 自研 OBJ 加载器（经典脚本，依赖 window.THREE 精简层） */
(function (root) {
  'use strict';
  const THREE = root.THREE;

  function OBJLoader() { this.path = ''; }
  OBJLoader.prototype.setPath = function (p) { this.path = p || ''; return this; };
  OBJLoader.prototype.load = function (url, onLoad, onError) {
    const self = this;
    fetch(this.path + url).then((r) => {
      if (!r.ok) throw new Error('OBJ HTTP ' + r.status);
      return r.text();
    }).then((text) => onLoad(self.parse(text))).catch((e) => onError && onError(e));
    return this;
  };
  OBJLoader.prototype.parse = function (text) {
    const group = new THREE.Group();
    const v = [], vt = [], vn = [];
    let currentMat = null;
    let currentGroup = null;
    let currentGeo = null;
    let currentPos = [], currentUv = [], currentNorm = [], currentIdx = [];
    let baseVertex = 0;

    function flush() {
      if (!currentGeo || currentIdx.length === 0) {
        currentPos = []; currentUv = []; currentNorm = []; currentIdx = [];
        baseVertex = 0;
        currentGeo = null;
        return;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(currentPos), 3));
      if (currentNorm.length) geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(currentNorm), 3));
      if (currentUv.length) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(currentUv), 2));
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(currentIdx), 1));
      const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6, metalness: 0.2 });
      mat.name = currentMat || 'default';
      mat.userData = { objMat: currentMat || 'default' };
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = currentGroup || currentMat || 'mesh';
      mesh.userData.group = currentGroup || currentMat || 'mesh';
      group.add(mesh);
      currentPos = []; currentUv = []; currentNorm = []; currentIdx = [];
      baseVertex = 0;
      currentGeo = null;
    }

    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/\s+/);
      switch (parts[0]) {
        case 'v': v.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])); break;
        case 'vt': vt.push(parseFloat(parts[1]), 1 - parseFloat(parts[2])); break;
        case 'vn': vn.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])); break;
        case 'usemtl': {
          if (parts[1] !== currentMat) { flush(); currentMat = parts[1]; currentGeo = {}; }
          break;
        }
        case 'g': {
          // 新组强制拆分（同材质不同组也要独立网格，如四个车轮）
          flush(); currentGeo = {}; currentGroup = parts[1];
          break;
        }
        case 'f': {
          if (!currentGeo) { currentMat = currentMat || 'default'; currentGeo = {}; }
          const face = [];
          for (let i = 1; i < parts.length; i++) {
            const idx = parts[i].split('/');
            face.push({
              vi: parseInt(idx[0], 10) - 1,
              ti: idx[1] ? parseInt(idx[1], 10) - 1 : -1,
              ni: idx[2] ? parseInt(idx[2], 10) - 1 : -1
            });
          }
          for (let i = 1; i + 1 < face.length; i++) {
            const tri = [face[0], face[i], face[i + 1]];
            for (const f of tri) {
              currentPos.push(v[f.vi * 3], v[f.vi * 3 + 1], v[f.vi * 3 + 2]);
              if (f.ni >= 0) currentNorm.push(vn[f.ni * 3], vn[f.ni * 3 + 1], vn[f.ni * 3 + 2]);
              if (f.ti >= 0) currentUv.push(vt[f.ti * 2], vt[f.ti * 2 + 1]);
              else currentUv.push(0, 0);
              currentIdx.push(baseVertex++);
            }
          }
          break;
        }
      }
    }
    flush();
    return group;
  };

  root.THREE.OBJLoader = OBJLoader;
})(typeof globalThis !== 'undefined' ? globalThis : this);
