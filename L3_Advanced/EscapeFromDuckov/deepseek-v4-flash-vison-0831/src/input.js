import * as THREE from 'three';
import { TAU, clamp } from './util.js';
import { HALF } from './world.js';

// ================= 键盘鼠标输入 =================
export class Input {
  constructor(game) {
    this.game = game;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = { x: 0, y: 0 };
    this.aimAngle = null;
    this.wheel = 0;
    this.onContext = null;
    this.dragMode = null; // 'move'
    this.drag = { sx: 0, sy: 0 };
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('mousemove', e => this.onMove(e));
    window.addEventListener('mousedown', e => this.onDown(e));
    window.addEventListener('mouseup', e => this.onUp(e));
    window.addEventListener('wheel', e => this.wheel += e.deltaY, { passive: true });
    window.addEventListener('contextmenu', e => e.preventDefault());
  }
  onKey(e, down) {
    if (e.repeat) { if (down) this.pressedKeys.add(e.code); return; }
    const g = this.game;
    if (down) {
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space') this.keys.add('attack2');
      g.audio.resume();
    } else { this.keys.delete(e.code); if (e.code === 'Space') this.keys.delete('attack2'); }
    if (down) this.dispatch(e.code);
    // 阻止浏览器快捷键
    if (['KeyW','KeyA','KeyS','KeyD','KeyE','KeyR','Space','Tab'].includes(e.code)) e.preventDefault();
  }
  dispatch(code) {
    const g = this.game;
    const map = {
      KeyE: 'interact', KeyI: 'inv', KeyC: 'craft', KeyH: 'health', KeyK: 'skill', KeyM: 'map',
      KeyJ: 'journal', KeyF: 'flashlight', KeyR: 'roll', KeyT: 'viewmode', Escape: 'escape',
      KeyL: 'dbg', Space: 'attack2', Digit1: 'hot1', Digit2: 'hot2', Digit3: 'hot3', Digit4: 'hot4',
      Digit5: 'hot5', Digit6: 'hot6', Digit7: 'hot7', Digit8: 'hot8',
      KeyQ: 'camccw', KeyV: 'camcw',
    };
    const act = map[code];
    if (!act) return;
    g.events.emit('key', act);
  }
  onMove(e) {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    if (this.dragMode === 'move') {
      this.game.player.lastDrag = { x: this.mouse.x - this.drag.sx, y: this.mouse.y - this.drag.sy };
    }
  }
  onDown(e) {
    if (e.button === 0) {
      this.keys.add('attack');
      this.keys.add('aim');
      this.game.audio.resume();
      return;
    }
    if (e.button === 1 || e.button === 2) {
      if (!this.game.ui.onRightDown(e)) {
        this.dragMode = 'move';
        this.drag.sx = e.clientX; this.drag.sy = e.clientY;
      }
    }
  }
  onUp(e) {
    if (e.button === 0) { this.keys.delete('attack'); this.keys.delete('aim'); }
    if (e.button === 1 || e.button === 2) this.dragMode = null;
  }
  down(name) {
    const map = {
      w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', c: 'KeyC',
      shift: 'ShiftLeft', alt: 'AltLeft', attack: 'attack', attack2: 'attack2', aim: 'aim',
    };
    if (name === 'shift') return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (name === 'alt') return this.keys.has('AltLeft') || this.keys.has('AltRight');
    return this.keys.has(map[name] || name);
  }
  pressed(act) {
    const map = {
      interact: 'KeyE', roll: 'KeyR', flashlight: 'KeyF', viewmode: 'KeyT', inv: 'KeyI',
      craft: 'KeyC', health: 'KeyH', skill: 'KeyK', map: 'KeyM', journal: 'KeyJ',
      camccw: 'KeyQ', camcw: 'KeyV', escape: 'Escape',
      hot1: 'Digit1', hot2: 'Digit2', hot3: 'Digit3', hot4: 'Digit4',
      hot5: 'Digit5', hot6: 'Digit6', hot7: 'Digit7', hot8: 'Digit8',
    };
    return this.keys.has(map[act]);
  }
  consumePressed() { this.pressedKeys.clear(); }
  computeAim() {
    const g = this.game;
    if (!g.player || g.ui.screenActive()) { this.aimAngle = null; return; }
    // 射线到地平面（y=0），从准星中心发射
    const r = g.renderer;
    const ndcX = (this.mouse.x / window.innerWidth) * 2 - 1;
    const ndcY = -(this.mouse.y / window.innerHeight) * 2 + 1;
    const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(r.camera);
    const dir = v.sub(r.camera.position).normalize();
    if (dir.y < -0.05) {
      const t = -r.camera.position.y / dir.y;
      const wx = r.camera.position.x + dir.x * t;
      const wz = r.camera.position.z + dir.z * t;
      this.aimAngle = Math.atan2(wx - (g.player.x - HALF), wz - (g.player.z - HALF));
      return { wx: wx + HALF, wz: wz + HALF };
    }
    this.aimAngle = null;
    return null;
  }
  endFrame() { this.pressedKeys.clear(); this.wheel = 0; }
}
