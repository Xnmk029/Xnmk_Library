// 轻量事件总线
export class Bus {
  constructor() { this.h = new Map(); }
  on(ev, fn) { if (!this.h.has(ev)) this.h.set(ev, new Set()); this.h.get(ev).add(fn); return () => this.h.get(ev).delete(fn); }
  emit(ev, data) { const s = this.h.get(ev); if (s) for (const fn of [...s]) fn(data); }
  once(ev, fn) { const off = this.on(ev, d => { off(); fn(d); }); }
}
export const bus = new Bus();
