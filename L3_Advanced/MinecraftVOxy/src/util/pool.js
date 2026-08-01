// VOXY CRAFT — Worker 线程池（模块 Worker + 优先级派发）
import { PriorityQueue } from './priorityQueue.js';

// 单文件打包时 worker 代码被内联为字符串，用 Blob 创建（兼容 file://）
function makeWorker(url) {
  if (typeof globalThis.__VOXY_WORKER_SRC__ === 'string') {
    const blob = new Blob([globalThis.__VOXY_WORKER_SRC__], { type: 'text/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }
  return new Worker(url, { type: 'module' });
}

export class WorkerPool {
  constructor(url, size, onResult) {
    this.onResult = onResult;
    this.queue = new PriorityQueue();
    this.idle = [];
    this.workers = [];
    this.busy = 0;
    for (let i = 0; i < size; i++) {
      const w = makeWorker(url);
      w.onmessage = (e) => {
        this.busy--;
        this.idle.push(w);
        this.onResult(e.data);
        this._pump();
      };
      w.onerror = (err) => { console.error('[worker] 错误:', err.message); };
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  // task 必须含 _transfer（ArrayBuffer 列表，可为空）
  submit(task, priority) {
    this.queue.push(task, priority);
    this._pump();
  }

  _pump() {
    while (this.idle.length > 0 && this.queue.size > 0) {
      const w = this.idle.pop();
      const task = this.queue.pop();
      const transfer = task._transfer || [];
      this.busy++;
      w.postMessage(task, transfer);
    }
  }

  clearQueue() { this.queue.clear(); }
  get pending() { return this.queue.size; }
  terminate() { for (const w of this.workers) w.terminate(); }
}
