/**
 * labels.js — Task 5.3: POI / city-name floating overlay.
 *
 * DOM label pool projected through the (possibly blended ortho↔persp) camera
 * matrix. Zoom-banded LOD with smooth fade + scale, plus a screen grid
 * de-crowder: one label per 112×46 px cell, higher rank wins.
 */
export class LabelLayer {
  constructor(container, pois) {
    this.container = container;
    this.pois = pois.map(p => ({ ...p, el: null, opacity: 0 }));
    this.pool = [];
    for (const p of this.pois) {
      const el = document.createElement('div');
      el.className = `poi rank-${p.rank}`;
      el.innerHTML = `${escape(p.name)}<small>${p.kind.toUpperCase()}</small>`;
      el.style.opacity = '0';
      container.appendChild(el);
      p.el = el;
    }
    this.visible = false;
  }

  setVisible(v) {
    this.visible = v;
    if (!v) for (const p of this.pois) { p.opacity = 0; p.el.style.opacity = '0'; }
  }

  /** zoom bands per kind: [fadeInDist, fadeOutDist] on camera distance */
  band(kind) {
    switch (kind) {
      case 'district': return [430, 4200];
      case 'landmark': return [60, 900];
      case 'station': return [90, 1600];
      case 'park': return [70, 700];
      default: return [80, 900];
    }
  }

  update(cam, dist, dt) {
    if (!this.visible) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const grid = new Map();
    const order = [...this.pois].sort((a, b) => a.rank - b.rank);
    const v = { x: 0, y: 0, z: 0 };

    for (const p of order) {
      const [dIn, dOut] = this.band(p.kind);
      let target = (dist > dIn && dist < dOut) ? 1 : 0;

      if (target > 0) {
        // project
        v.x = p.x; v.y = (p.h || 0) + 4; v.z = p.z;
        const pr = project(v, cam);
        if (!pr || pr.z > 1) target = 0;
        else {
          const sx = (pr.x * 0.5 + 0.5) * w;
          const sy = (-pr.y * 0.5 + 0.5) * h;
          if (sx < -60 || sx > w + 60 || sy < -40 || sy > h + 40) target = 0;
          else {
            const cellKey = `${Math.floor(sx / 112)}_${Math.floor(sy / 46)}`;
            if (grid.has(cellKey)) target = 0;
            else if (target > 0) {
              grid.set(cellKey, p);
              const scale = Math.min(1.3, Math.max(0.72, 520 / Math.max(60, dist)));
              p.el.style.transform =
                `translate(-50%,-120%) translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) scale(${scale.toFixed(2)})`;
            }
          }
        }
      }

      // smooth fade
      p.opacity += (target - p.opacity) * Math.min(1, dt * 6);
      const op = p.opacity < 0.02 ? 0 : p.opacity;
      p.el.style.opacity = op.toFixed(2);
      p.el.style.visibility = op > 0 ? 'visible' : 'hidden';
    }
  }
}

function project(p, cam) {
  const e = cam.matrixWorldInverse.elements;
  const x = p.x, y = p.y, z = p.z;
  const vx = e[0] * x + e[4] * y + e[8] * z + e[12];
  const vy = e[1] * x + e[5] * y + e[9] * z + e[13];
  const vz = e[2] * x + e[6] * y + e[10] * z + e[14];
  const pr = cam.projectionMatrix.elements;
  const cx = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12];
  const cy = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13];
  const cz = pr[2] * vx + pr[6] * vy + pr[10] * vz + pr[14];
  const cw = pr[3] * vx + pr[7] * vy + pr[11] * vz + pr[15];
  if (cw <= 0) return null;
  return { x: cx / cw, y: cy / cw, z: cz / cw };
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default LabelLayer;
