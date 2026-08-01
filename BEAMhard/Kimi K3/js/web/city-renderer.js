// ============================================================================
// web/city-renderer.js — Phase 5.2: 3D vector tile Web pipeline (render side).
//  * Vector-to-Mesh: tile road LineStrings -> triangle ribbons fed to a
//    SCREEN-SPACE CONSTANT-WIDTH line shader; building Polygons -> extruded
//    volumes; markings -> dashed ribbons.
//  * Dynamic tile streaming: instantiate/destroy tile Chunks by frustum+zoom.
//  * Instanced streetlights & traffic signals; POI floating labels w/ LOD.
// ============================================================================

import * as THREE from 'three';
import { makeToonMaterial } from './npr.js';

// --- Screen-space constant-width polyline shader ------------------------------
export const LINE_VERT = /* glsl */`
  attribute vec3 pointA;
  attribute vec3 pointB;
  attribute float side;
  attribute float t;
  uniform vec2 uResolution;
  uniform float uWidthPx;
  varying float vDashCoord;
  void main() {
    vec4 clipA = projectionMatrix * viewMatrix * vec4(pointA, 1.0);
    vec4 clipB = projectionMatrix * viewMatrix * vec4(pointB, 1.0);
    vec2 ndcA = clipA.xy / clipA.w;
    vec2 ndcB = clipB.xy / clipB.w;
    vec2 dir = normalize(ndcB - ndcA + vec2(1e-7, 0.0));
    vec2 nrm = vec2(-dir.y, dir.x);
    vec4 clip = (t < 0.5) ? clipA : clipB;
    vec2 offset = nrm * side * (uWidthPx * 0.5) / uResolution * 2.0 * clip.w;
    clip.xy += offset;
    vDashCoord = (t < 0.5) ? 0.0 : distance(pointA, pointB);
    gl_Position = clip;
  }
`;
export const LINE_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uDashLen;
  varying float vDashCoord;
  void main() {
    if (uDashLen > 0.0) {
      float m = mod(vDashCoord, uDashLen * 2.0);
      if (m > uDashLen) discard;
    }
    gl_FragColor = vec4(uColor, uOpacity);
    #include <colorspace_fragment>
  }
`;

export function makeVectorLineMaterial({ color = 0xffffff, widthPx = 3, opacity = 1, dashLen = 0 }) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    uniforms: {
      uResolution: { value: new THREE.Vector2(1920, 1080) },
      uWidthPx: { value: widthPx },
      uColor: { value: new THREE.Color(color).toArray() },
      uOpacity: { value: opacity },
      uDashLen: { value: dashLen },
    },
    transparent: opacity < 1,
    depthWrite: false,
  });
  mat.isVectorLineMaterial = true;
  return mat;
}

// clipped polyline segments -> ribbon BufferGeometry (quads per segment)
function segmentsToRibbonGeometry(segments, y) {
  let quadCount = 0;
  for (const seg of segments) quadCount += (seg.length - 1);
  const n = quadCount * 4;
  const posA = new Float32Array(n * 3);
  const posB = new Float32Array(n * 3);
  const side = new Float32Array(n);
  const t = new Float32Array(n);
  const idx = new Uint32Array(quadCount * 6);
  let v = 0, q = 0;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      const a = seg[i - 1], b = seg[i];
      for (const [p, s, tt] of [[a, -1, 0], [a, 1, 0], [b, -1, 1], [b, 1, 1]]) {
        posA[v * 3] = a[0]; posA[v * 3 + 1] = y; posA[v * 3 + 2] = a[1];
        posB[v * 3] = b[0]; posB[v * 3 + 1] = y; posB[v * 3 + 2] = b[1];
        side[v] = s; t[v] = tt;
        v++;
      }
      const b0 = q * 4;
      idx.set([b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3], q * 6);
      q++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('pointA', new THREE.BufferAttribute(posA, 3));
  geo.setAttribute('pointB', new THREE.BufferAttribute(posB, 3));
  geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('t', new THREE.BufferAttribute(t, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(posA.slice(), 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

function polygonToBuildingGeometry(poly, height) {
  const shape = new THREE.Shape();
  shape.moveTo(poly[0][0], -poly[0][1]);
  for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0], -poly[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

const ROAD_COLORS = { arterial: 0x3d434e, collector: 0x434a56, local: 0x4a515c };

export class CityRenderer {
  constructor(scene, tiler, city, resolution = new THREE.Vector2(1920, 1080)) {
    this.scene = scene;
    this.tiler = tiler;
    this.city = city;
    this.resolution = resolution;
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);

    this.tiles = new Map();
    this.maxCachedTiles = 48;
    this._frame = 0;

    this.markingMat = makeVectorLineMaterial({ color: 0xf2e6a2, widthPx: 2, dashLen: 4 });
    this.edgeMat = makeVectorLineMaterial({ color: 0xd8dde6, widthPx: 1.5 });
    this.buildingMat = makeToonMaterial({ color: 0x8d97a8, steps: 3, shadowTint: 0x3d4454 });

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(city.size * 1.3, city.size * 1.3),
      makeToonMaterial({ color: 0x2c313a, steps: 2, shadowTint: 0x1c2026 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);

    this._buildProps();

    this.labelLayer = document.getElementById('poi-layer');
    this.labels = city.pois.map((p) => {
      const el = document.createElement('div');
      el.className = 'poi-label' + (p.importance >= 1 ? ' major' : '');
      el.textContent = p.name;
      this.labelLayer.appendChild(el);
      return { el, p, visible: false };
    });
  }

  setResolution(w, h) {
    this.resolution.set(w, h);
    for (const m of [this.markingMat, this.edgeMat]) m.uniforms.uResolution.value.copy(this.resolution);
    for (const t of this.tiles.values()) {
      for (const m of t.lineMats) m.uniforms.uResolution.value.copy(this.resolution);
    }
  }

  _buildProps() {
    const city = this.city;
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 6, 6);
    poleGeo.translate(0, 3, 0);
    const poleMat = makeToonMaterial({ color: 0x2a2e36, steps: 2 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, city.streetlights.length);
    const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
    headGeo.translate(0, 6.05, 0);
    const headMat = makeToonMaterial({ color: 0xfff2b0, emissive: 0x776622, steps: 2 });
    const heads = new THREE.InstancedMesh(headGeo, headMat, city.streetlights.length);
    const m4 = new THREE.Matrix4();
    city.streetlights.forEach((s, i) => {
      m4.makeTranslation(s.x, 0, s.z);
      poles.setMatrixAt(i, m4);
      heads.setMatrixAt(i, m4);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.group.add(poles, heads);

    // traffic signals at arterial intersections
    const sigGeo = new THREE.BoxGeometry(0.3, 5.2, 0.3);
    sigGeo.translate(0, 2.6, 0);
    const sigMat = makeToonMaterial({ color: 0x222831, steps: 2 });
    const sigs = new THREE.InstancedMesh(sigGeo, sigMat, city.signals.length);
    city.signals.forEach((s, i) => {
      m4.makeTranslation(s.x, 0, s.z);
      sigs.setMatrixAt(i, m4);
    });
    sigs.instanceMatrix.needsUpdate = true;
    this.group.add(sigs);
  }

  // Instantiate one tile chunk (roads/markings/buildings as meshes).
  _buildTile(tile) {
    const g = new THREE.Group();
    g.name = `tile-${tile.key}`;
    const lineMats = [];
    for (const r of tile.roads) {
      const wMeters = r.width;
      const mat = makeVectorLineMaterial({ color: ROAD_COLORS[r.kind] || 0x4a515c, widthPx: 10 });
      // road width: encode real metres via a wider ribbon at build time instead
      // -> we rebuild geometry per road with world-space width baked as widthPx
      //    mapped through a " metres to pixels at reference" trick:
      mat.uniforms.uWidthPx.value = wMeters * 1.0; // treated as px; updated by zoom-scaler
      mat.uniforms.uResolution.value.copy(this.resolution);
      mat.userData.worldWidth = wMeters;
      const geo = segmentsToRibbonGeometry(r.segments, 0.02);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = true;
      g.add(mesh);
      lineMats.push(mat);
    }
    for (const m of tile.markings) {
      const mat = m.kind === 'dashed' ? this.markingMat : this.edgeMat;
      const geo = segmentsToRibbonGeometry(m.segments, 0.05);
      g.add(new THREE.Mesh(geo, mat));
    }
    for (const bd of tile.buildings) {
      const geo = polygonToBuildingGeometry(bd.polygon, bd.height);
      const mesh = new THREE.Mesh(geo, this.buildingMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return { group: g, lineMats, lastUsed: this._frame };
  }

  /**
   * Streaming update — call each frame from map mode.
   * @param camera   active camera
   * @param camPos   {x,z} focus
   * @param zoom01   0 (far/ortho-like) .. 1 (close street level)
   */
  update(camera, camPos, zoom01) {
    this._frame++;
    // zoom -> tile level mapping (street level uses deep tiles)
    const level = Math.max(1, Math.min(6, Math.round(1 + zoom01 * 5)));
    // cover radius shrinks as we zoom in
    const radius = (1 - zoom01) * 900 + 180;
    const wanted = this.tiler.cover(level,
      camPos.x - radius, camPos.z - radius, camPos.x + radius, camPos.z + radius);
    const wantedKeys = new Set(wanted.map((t) => t.key));

    // instantiate missing
    for (const t of wanted) {
      if (!this.tiles.has(t.key)) {
        const chunk = this._buildTile(t);
        this.tiles.set(t.key, chunk);
        this.group.add(chunk.group);
      }
      const chunk = this.tiles.get(t.key);
      chunk.lastUsed = this._frame;
      chunk.group.visible = true;
    }
    // evict / hide
    for (const [key, chunk] of this.tiles) {
      if (!wantedKeys.has(key)) {
        if (this.tiles.size > this.maxCachedTiles || this._frame - chunk.lastUsed > 240) {
          this.group.remove(chunk.group);
          chunk.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
          this.tiles.delete(key);
        } else {
          chunk.group.visible = false;
        }
      }
    }

    // scale road line widths with zoom (screen-space constant feel)
    const pxPerMeter = Math.pow(2, zoom01 * 4 - 1.2);
    for (const chunk of this.tiles.values()) {
      for (const m of chunk.lineMats) {
        m.uniforms.uWidthPx.value = Math.max(2, m.userData.worldWidth * pxPerMeter);
      }
    }

    this._updateLabels(camera, zoom01);
    return { level, tilesVisible: [...this.tiles.values()].filter((c) => c.group.visible).length };
  }

  _updateLabels(camera, zoom01) {
    // LOD fade: landmarks appear early, amenities only when zoomed in
    const v = new THREE.Vector3();
    for (const L of this.labels) {
      const show = L.p.importance >= 1 ? zoom01 > 0.05 : zoom01 > 0.55;
      if (!show) {
        if (L.visible) { L.el.style.opacity = '0'; L.visible = false; }
        continue;
      }
      v.set(L.p.x, 4, L.p.z).project(camera);
      if (v.z > 1 || v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1) {
        if (L.visible) { L.el.style.opacity = '0'; L.visible = false; }
        continue;
      }
      const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const importance = L.p.importance >= 1 ? 1 : (zoom01 - 0.55) / 0.45;
      const sc = (L.p.importance >= 1 ? 1.0 : 0.8) * (0.7 + zoom01 * 0.5);
      L.el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%,-100%) scale(${sc.toFixed(2)})`;
      L.el.style.opacity = String(Math.min(1, importance));
      L.visible = true;
    }
  }

  hideAllLabels() {
    for (const L of this.labels) { L.el.style.opacity = '0'; L.visible = false; }
  }
}
