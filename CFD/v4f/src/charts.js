export class StripChart {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.color = opts.color || '#4db6d0';
    this.min = opts.min;
    this.max = opts.max;
    this.capacity = opts.capacity || 200;
    this.data = new Float32Array(this.capacity);
    this.head = 0;
    this.length = 0;
    this._autoMax = opts.autoMax || 1;
    this._autoMin = opts.autoMin || 0;
    this.dpr = 1;
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas.parentElement);
    this._resize();
  }

  _resize() {
    const box = this.canvas.parentElement;
    const w = Math.max(40, Math.floor(box.clientWidth));
    const h = Math.max(30, Math.floor(box.clientHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.draw();
  }

  push(v) {
    this.data[this.head] = v;
    this.head = (this.head + 1) % this.capacity;
    if (this.length < this.capacity) this.length++;
    if (this.max === undefined && v > this._autoMax) this._autoMax = v;
    if (this.min === undefined && v < this._autoMin) this._autoMin = v;
    if (this.max === undefined) this._autoMax *= 0.999;
  }

  clear() {
    this.length = 0;
    this.head = 0;
  }

  draw() {
    const c = this.canvas;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, w, h);

    const lo = this.min !== undefined ? this.min : this._autoMin;
    const hi = this.max !== undefined ? this.max : Math.max(this._autoMax, lo + 1e-6);
    const span = hi - lo;

    ctx.strokeStyle = 'rgba(70, 78, 86, 0.55)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#3a3f44';
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, h - 1, w, 1);
    for (let i = 1; i < 4; i++) {
      const y = Math.round((h * i) / 4) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const x = Math.round((w * i) / 4) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    if (this.length > 1) {
      const n = Math.min(this.length, this.capacity);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      const step = w / (this.capacity - 1);
      for (let k = 0; k < n; k++) {
        const idx = (this.head - n + k + this.capacity * 2) % this.capacity;
        const v = this.data[idx];
        const x = w - (n - 1 - k) * step;
        const y = h - 3 - ((v - lo) / span) * (h - 8);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}
