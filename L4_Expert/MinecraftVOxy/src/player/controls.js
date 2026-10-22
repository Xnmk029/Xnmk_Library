// VOXY CRAFT — 输入控制（Pointer Lock + 键鼠）
export class Controls {
  constructor(dom) {
    this.dom = dom;
    this.keys = Object.create(null);
    this.locked = false;
    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 0.0022;
    this.onBreak = null;
    this.onPlace = null;
    this.onPick = null;
    this.onToggleFly = null;
    this._lastSpace = -1e9;
    this._bind();
  }

  _bind() {
    this.dom.addEventListener('click', () => { if (!this.locked && this.dom.requestPointerLock) this.dom.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.dom; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        const now = performance.now();
        if (now - this._lastSpace < 300 && this.onToggleFly) this.onToggleFly();
        this._lastSpace = now;
      }
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.dom.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0 && this.onBreak) this.onBreak();
      else if (e.button === 2 && this.onPlace) this.onPlace();
      else if (e.button === 1 && this.onPick) this.onPick();
    });
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // 世界 XZ 期望方向（基于 yaw，归一化）
  wish() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);   // 前
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);    // 右
    let mx = 0, mz = 0;
    if (this.keys['KeyW']) { mx += fx; mz += fz; }
    if (this.keys['KeyS']) { mx -= fx; mz -= fz; }
    if (this.keys['KeyD']) { mx += rx; mz += rz; }
    if (this.keys['KeyA']) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    return { mx, mz };
  }
}
