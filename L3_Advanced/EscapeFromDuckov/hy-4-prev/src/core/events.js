// 同步事件总线 + 噪音队列（噪音是 PZ 的灵魂：一切动静都会吸引尸群）
export class Bus {
  constructor() { this.map = new Map(); this.log = []; this.logCap = 200; }
  on(type, fn) {
    let l = this.map.get(type);
    if (!l) { l = []; this.map.set(type, l); }
    l.push(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) { const l = this.map.get(type); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  emit(type, payload) {
    const l = this.map.get(type);
    if (l) for (let i = 0; i < l.length; i++) {
      try { l[i](payload); }
      catch (e) { console.error(`[bus:${type}]`, e); }   // 一个监听者炸了不能拖垮整帧
    }
    if (this.log.length >= this.logCap) this.log.shift();
    this.log.push({ type, t: performance.now() });
  }
}

/** 世界噪音：产生者只负责"发出"，谁听见由 AI 自行查询 */
export class NoiseField {
  constructor() { this.events = []; }         // {x,z,radius,ttl,kind,source}
  emit(x, z, radius, kind = 'walk', source = null, ttl = 0.35) {
    this.events.push({ x, z, radius, kind, source, ttl, age: 0 });
    return this.events[this.events.length - 1];
  }
  /** 查询某点听到的最大噪音强度（0..1），并附带最近事件 */
  hear(x, z, hearingMul = 1) {
    let best = 0, ev = null;
    for (const e of this.events) {
      const d = Math.hypot(e.x - x, e.z - z);
      const r = e.radius * hearingMul;
      if (d < r) {
        const s = 1 - d / r;
        if (s > best) { best = s; ev = e; }
      }
    }
    return { strength: best, ev };
  }
  update(dt) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      e.age += dt;
      if (e.age >= e.ttl) this.events.splice(i, 1);
    }
  }
  clear() { this.events.length = 0; }
}

export const bus = new Bus();
export const noise = new NoiseField();
