// VOXY CRAFT — 优先级队列（最小堆，priority 越小越优先）
/*LOGIC_START*/
export class PriorityQueue {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item, priority) {
    this.a.push({ item, priority });
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].priority <= this.a[i].priority) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    if (this.a.length === 0) return undefined;
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length > 0) {
      this.a[0] = last;
      let i = 0;
      const n = this.a.length;
      while (true) {
        let l = 2 * i + 1, r = l + 1, s = i;
        if (l < n && this.a[l].priority < this.a[s].priority) s = l;
        if (r < n && this.a[r].priority < this.a[s].priority) s = r;
        if (s === i) break;
        [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
        i = s;
      }
    }
    return top.item;
  }
  clear() { this.a = []; }
}
/*LOGIC_END*/
