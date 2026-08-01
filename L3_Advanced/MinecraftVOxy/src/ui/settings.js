// VOXY CRAFT — 设置面板（视距滑条 / FOV / 灵敏度 / 昼夜）
export class Settings {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('settings');
    this._bind('s-view', (v) => { game.setViewDistance(+v); return v; });
    this._bind('s-fov', (v) => { game.camera.fov = +v; game.camera.updateProjectionMatrix(); return v; });
    this._bind('s-sens', (v) => { game.controls.sensitivity = v / 10000; return (v / 10).toFixed(1); });
    this._bind('s-time', (v) => { game.setTimeOfDay(v / 100); return (v / 100).toFixed(2); });
    document.getElementById('s-dayauto').addEventListener('change', (e) => { game.dayAuto = e.target.checked; });
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
  }

  _bind(id, fn) {
    const inp = document.getElementById(id);
    const val = document.getElementById(id + '-v');
    inp.addEventListener('input', () => { const out = fn(inp.value); if (val) val.textContent = out; });
  }

  open() { this.el.classList.add('open'); }
  close() { this.el.classList.remove('open'); }
  toggle() { this.el.classList.toggle('open'); }
  get isOpen() { return this.el.classList.contains('open'); }
}
