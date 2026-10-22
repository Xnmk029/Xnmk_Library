// ============================================================
//  input.js — 键鼠输入（双摇杆式操作：WASD 移动 / 鼠标瞄准）
// ============================================================

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();       // 当前按下
    this.justDown = new Set();   // 本帧按下
    this.justUp = new Set();
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    this.mDown = [false, false, false];
    this.mJust = [false, false, false];
    this.mJustUp = [false, false, false];
    this.wheel = 0;
    this.blocked = false;        // UI 打开时屏蔽世界输入

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // 避免空格/方向键滚动页面
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
      this.down.add(e.code);
      this.justDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.justUp.add(e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.mDown = [false, false, false]; });

    const upd = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.sx = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.sy = (e.clientY - r.top) * (canvas.height / r.height);
    };
    canvas.addEventListener('mousemove', upd);
    canvas.addEventListener('mousedown', (e) => {
      upd(e);
      if (e.button < 3) { this.mDown[e.button] = true; this.mJust[e.button] = true; }
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) { this.mDown[e.button] = false; this.mJustUp[e.button] = true; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  isDown(code) { return !this.blocked && this.down.has(code); }
  isDownRaw(code) { return this.down.has(code); }
  pressed(code) { return !this.blocked && this.justDown.has(code); }
  pressedRaw(code) { return this.justDown.has(code); }
  released(code) { return this.justUp.has(code); }
  mouseDown(b = 0) { return !this.blocked && this.mDown[b]; }
  mousePressed(b = 0) { return !this.blocked && this.mJust[b]; }
  mouseReleased(b = 0) { return this.mJustUp[b]; }

  /** 移动输入向量（已归一化） */
  moveVec() {
    let x = 0, y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    if (l > 1e-4) { x /= l; y /= l; }
    return { x, y };
  }

  endFrame() {
    this.justDown.clear();
    this.justUp.clear();
    this.mJust = [false, false, false];
    this.mJustUp = [false, false, false];
    this.wheel = 0;
  }
}
