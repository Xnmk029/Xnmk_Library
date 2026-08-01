/**
 * ui/POIOverlay.js — city POI floating labels with LOD fade & smooth scaling
 */
import * as THREE from 'three';

export class POIOverlay {
  constructor(container, city, camera) {
    this.container = container;
    this.city = city;
    this.camera = camera;
    this.v = new THREE.Vector3();
    this.items = [];
    for (const p of city.pois) {
      const el = document.createElement('div');
      el.className = 'poi' + (p.importance > 1 ? ' poi-minor' : '');
      el.innerHTML = `<div>${p.name}</div>` + (p.type === 'zone' ? `<div class="poi-sub">TEST ZONE</div>` : '');
      el.style.opacity = 0;
      el.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('beamgl:poi-focus', { detail: { x: p.x, z: p.z } }));
      });
      container.appendChild(el);
      this.items.push({ ...p, el });
    }
  }

  /** update positions & LOD */
  update(zoomLevel, hideAll) {
    const cam = this.camera;
    const v = this.v;
    const w = window.innerWidth, h = window.innerHeight;
    for (const it of this.items) {
      const show = (it.importance === 1 && zoomLevel >= 1) || (it.importance === 2 && zoomLevel >= 3);
      if (!show || hideAll) {
        it.el.style.opacity = 0;
        continue;
      }
      v.set(it.x, 1, it.z).project(cam);
      if (v.z > 1 || v.z < -1) { it.el.style.opacity = 0; continue; }
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) { it.el.style.opacity = 0; continue; }
      const dist = Math.hypot(it.x - cam.position.x, it.z - cam.position.z);
      const fade = THREE.MathUtils.clamp(1 - (dist - 120) / 900, 0, 1);
      const scale = THREE.MathUtils.clamp(1.25 - zoomLevel * 0.12, 0.7, 1.2);
      it.el.style.opacity = String(fade);
      it.el.style.left = sx + 'px';
      it.el.style.top = sy + 'px';
      it.el.style.transform = `translate(-50%, -100%) scale(${scale})`;
    }
  }

  dispose() {
    for (const it of this.items) it.el.remove();
    this.items = [];
  }
}
