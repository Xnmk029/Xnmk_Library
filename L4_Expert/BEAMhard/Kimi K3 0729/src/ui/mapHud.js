// Phase 5 — Map HUD: fullscreen 2D map overlay (M key) rendering the vector
// road network + POIs + vehicle marker, and floating 3D POI labels projected
// from world space with distance/zoom LOD fading. Works for both the city
// mode (CityData) and the proving ground (zone schematic).

import * as THREE from '../../lib/three.module.js';

const KLASS_COLOR = { arterial: '#ffd23e', collector: '#8be9ff', local: 'rgba(255,255,255,0.55)' };
const KIND_ICON = { tower: '▲', mall: '■', station: '●', park: '◆', shrine: '★' };

export class MapHUD {
  /** @param {HTMLElement} root overlay container */
  constructor(root) {
    root.insertAdjacentHTML('beforeend', `
      <div class="map-overlay" id="mapOverlay">
        <canvas id="mapCanvas"></canvas>
        <div class="map-title" id="mapTitle">MAP</div>
      </div>
      <div id="poiLayer"></div>`);
    this.overlay = root.querySelector('#mapOverlay');
    this.canvas = root.querySelector('#mapCanvas');
    this.title = root.querySelector('#mapTitle');
    this.poiLayer = root.querySelector('#poiLayer');
    this.ctx = this.canvas.getContext('2d');
    this.visible = false;
    this.data = null; // {roads, pois, bounds, title}
    this._labelPool = [];
    this._proj = new THREE.Vector3();
  }

  /** @param {{roads?:Array, pois?:Array, bounds?:object, title?:string}} data */
  setData(data) {
    this.data = data;
    this.title.textContent = (data && data.title) || 'MAP';
  }

  toggle() {
    this.visible = !this.visible;
    this.overlay.classList.toggle('visible', this.visible);
    if (this.visible) this._resize();
    return this.visible;
  }

  hide() {
    this.visible = false;
    this.overlay.classList.remove('visible', false);
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /** Redraw the fullscreen map. Call when visible each frame (cheap enough). */
  draw(vehiclePos, yawRad) {
    if (!this.visible || !this.data || !this.data.bounds) return;
    if (this.canvas.width !== window.innerWidth) this._resize();
    const { ctx } = this;
    const b = this.data.bounds;
    const W = this.canvas.width; const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const pad = 60;
    const sx = (W - pad * 2) / Math.max(1e-6, b.maxX - b.minX);
    const sz = (H - pad * 2) / Math.max(1e-6, b.maxZ - b.minZ);
    const s = Math.min(sx, sz);
    const ox = pad + (W - pad * 2 - (b.maxX - b.minX) * s) / 2;
    const oz = pad + (H - pad * 2 - (b.maxZ - b.minZ) * s) / 2;
    const px = (x) => ox + (x - b.minX) * s;
    const pz = (z) => oz + (z - b.minZ) * s;

    // Roads.
    ctx.lineCap = 'round';
    for (const r of this.data.roads || []) {
      ctx.strokeStyle = KLASS_COLOR[r.klass] || KLASS_COLOR.local;
      ctx.lineWidth = Math.max(1.2, (r.width || 6) * s * 0.6);
      ctx.beginPath();
      r.points.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(px(x), pz(z)) : ctx.lineTo(px(x), pz(z))));
      ctx.stroke();
    }
    // POIs.
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    for (const p of this.data.pois || []) {
      ctx.fillStyle = '#ffe93e';
      ctx.fillText(KIND_ICON[p.kind] || '●', px(p.x), pz(p.z) + 4);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'italic 10px Arial';
      ctx.fillText(p.name || '', px(p.x), pz(p.z) + 15);
      ctx.font = '13px Arial';
    }
    // Vehicle marker (heading triangle).
    if (vehiclePos) {
      const vx = px(vehiclePos.x); const vz = pz(vehiclePos.z);
      ctx.save();
      ctx.translate(vx, vz);
      ctx.rotate(yawRad);
      ctx.fillStyle = '#ff3c3c';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Update floating 3D POI labels. LOD: labels fade in inside `near` metres,
   * fade out beyond `far`, hide behind the camera.
   * @param {THREE.PerspectiveCamera} camera
   * @param {Array<{x,z,name,kind,y?}>} pois
   * @param {number} dt
   */
  updatePOILabels(camera, pois, dt) {
    const W = window.innerWidth; const H = window.innerHeight;
    const camPos = camera.position;
    let used = 0;
    for (const poi of pois) {
      const dx = poi.x - camPos.x; const dz = poi.z - camPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 900) continue;
      this._proj.set(poi.x, (poi.y ?? 8) + 6, poi.z).project(camera);
      if (this._proj.z > 1 || this._proj.z < -1) continue;
      const sx = (this._proj.x * 0.5 + 0.5) * W;
      const sy = (-this._proj.y * 0.5 + 0.5) * H;
      if (sx < -80 || sx > W + 80 || sy < -40 || sy > H + 40) continue;
      let el = this._labelPool[used];
      if (!el) {
        el = document.createElement('div');
        el.className = 'poi-label';
        this.poiLayer.appendChild(el);
        this._labelPool[used] = el;
      }
      used++;
      const alpha = dist < 60 ? Math.max(0.15, dist / 60) : Math.min(1, 1.6 - dist / 900);
      el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%,-100%) scale(${Math.max(0.6, Math.min(1.1, 120 / Math.max(30, dist))).toFixed(2)})`;
      el.style.opacity = alpha.toFixed(2);
      el.textContent = `${KIND_ICON[poi.kind] || '●'} ${poi.name} · ${dist.toFixed(0)}m`;
    }
    for (let i = used; i < this._labelPool.length; i++) {
      if (this._labelPool[i]) this._labelPool[i].style.opacity = '0';
    }
  }
}
