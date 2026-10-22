/**
 * core/PerfGovernor.js — 性能治理器
 * ===========================================================================
 * 唯一职责：观察真实帧时间，在 QUALITY_TIERS 之间升降档。
 * 所有效果（视距 / 阴影 / AO / 体积光 / 反射分辨率 / 焦散分辨率 / 像素比 / LOD 偏移）
 * 都由档位统一描述，避免"各效果各自为政"导致的性能悬崖。
 *
 * ▍为什么用中位数而不是平均值
 *   GC、chunk 上传、shader 编译会造成偶发的巨大尖峰。平均值会被尖峰拖偏，
 *   导致误降档；中位数对尖峰免疫，反映的是"稳态帧时间"。
 *   同时单独统计 p95，只有当尖峰**持续**出现时才额外降档。
 */

import { QUALITY_TIERS, PERF } from '../config.js';

export class PerfGovernor {
  constructor({ initialTier = 2, onChange = null, enabled = true } = {}) {
    this.tiers = QUALITY_TIERS;
    this.tierIndex = Math.max(0, Math.min(this.tiers.length - 1, initialTier));
    this.onChange = onChange;
    this.enabled = enabled;

    this._samples = new Float32Array(PERF.sampleFrames);
    this._count = 0;
    this._cursor = 0;
    this._lastChange = 0;
    this._sorted = new Float32Array(PERF.sampleFrames);

    this.stats = { median: 16.7, p95: 16.7, fps: 60, changes: 0, reason: 'init' };
  }

  get quality() { return this.tiers[this.tierIndex]; }
  get name() { return this.quality.name; }

  /** 手动指定档位（HUD 的 1/2/3/4 键） */
  setTier(i, reason = 'manual') {
    const idx = Math.max(0, Math.min(this.tiers.length - 1, i));
    if (idx === this.tierIndex) return false;
    this.tierIndex = idx;
    this.stats.changes++;
    this.stats.reason = reason;
    this._count = 0; this._cursor = 0;              // 换档后重新观察
    this._lastChange = performance.now();
    this.onChange?.(this.quality, this.tierIndex, reason);
    return true;
  }

  /** 每帧喂入帧时间（ms） */
  sample(frameMs) {
    if (!(frameMs > 0) || frameMs > 500) return;     // 忽略切标签页等异常值
    this._samples[this._cursor] = frameMs;
    this._cursor = (this._cursor + 1) % this._samples.length;
    this._count = Math.min(this._count + 1, this._samples.length);
    if (this._count < this._samples.length) return;

    const n = this._count;
    this._sorted.set(this._samples.subarray(0, n));
    const arr = this._sorted.subarray(0, n);
    Array.prototype.sort.call(arr, (a, b) => a - b);
    const median = arr[(n * 0.5) | 0];
    const p95 = arr[Math.min(n - 1, (n * 0.95) | 0)];
    this.stats.median = median;
    this.stats.p95 = p95;
    this.stats.fps = 1000 / median;

    if (!this.enabled) return;
    const now = performance.now();
    if (now - this._lastChange < PERF.cooldownMs) return;

    if (median > PERF.downgradeMs && this.tierIndex > 0) {
      this.setTier(this.tierIndex - 1, `帧时间 ${median.toFixed(1)}ms > ${PERF.downgradeMs}ms`);
    } else if (median < PERF.upgradeMs && p95 < PERF.downgradeMs && this.tierIndex < this.tiers.length - 1) {
      this.setTier(this.tierIndex + 1, `帧时间 ${median.toFixed(1)}ms < ${PERF.upgradeMs}ms`);
    }
  }
}

export default PerfGovernor;
