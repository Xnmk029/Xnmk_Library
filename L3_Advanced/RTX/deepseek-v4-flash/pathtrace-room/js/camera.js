// 轨道相机：拖拽旋转 / 滚轮缩放 / 右键平移

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

class OrbitCamera {
  constructor(canvas, preset, onChange) {
    this.canvas = canvas;
    this.onChange = onChange || (() => {});
    this.preset = preset;
    this.pointers = new Map();
    this.pinchDist = 0;
    this.apply(preset);
    this._attach();
  }

  setPreset(preset) {
    this.preset = preset;
    this.apply(preset);
    this.onChange();
  }

  apply(p) {
    this.target = p.target.slice();
    this.yaw = p.yaw;
    this.pitch = p.pitch;
    this.dist = p.dist;
    this.fov = p.fov;
  }

  reset() {
    this.apply(this.preset);
    this.onChange();
  }

  view() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const pos = [
      this.target[0] + this.dist * cp * sy,
      this.target[1] + this.dist * sp,
      this.target[2] + this.dist * cp * cy,
    ];
    const fwd = norm(sub(this.target, pos));
    const right = norm(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    return { pos, right, up, fwd, fovTan: Math.tan((this.fov * Math.PI) / 360) };
  }

  _pan(dx, dy) {
    const v = this.view();
    const k = 0.0025 * this.dist;
    this.target[0] -= (v.right[0] * dx + v.up[0] * dy) * k;
    this.target[1] -= (v.right[1] * dx + v.up[1] * dy) * k;
    this.target[2] -= (v.right[2] * dx + v.up[2] * dy) * k;
    this.onChange();
  }

  _attach() {
    const cv = this.canvas;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch { /* noop */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const pt = this.pointers.get(e.pointerId);
      if (!pt) return;
      if (this.pointers.size === 1) {
        const dx = e.clientX - pt.x;
        const dy = e.clientY - pt.y;
        pt.x = e.clientX;
        pt.y = e.clientY;
        if (pt.button === 0) {
          this.yaw -= dx * 0.005;
          this.pitch = clamp(this.pitch + dy * 0.005, -1.2, 1.2);
          this.onChange();
        } else if (pt.button === 2) {
          this._pan(dx, dy);
        }
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: pt.button });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0 && d > 0) {
          this.dist = clamp((this.dist * this.pinchDist) / d, 1.8, 14);
          this.onChange();
        }
        this.pinchDist = d;
      }
    });
    const release = (e) => this.pointers.delete(e.pointerId);
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0012), 1.8, 14);
      this.onChange();
    }, { passive: false });
    cv.addEventListener('dblclick', () => this.reset());
  }
}
