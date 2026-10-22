// 战术视野（文档 §3.1）：可见多边形 + 视线判定 + 盲区实体剔除。
// 玩家 FoV、AI 感知、渲染剔除三者共用这里的实现 —— 视野只有唯一真源，
// 否则"看得见却打不中"或"打得中却看不见"这类割裂必然出现。
import { VISION } from '../data/balance.js';
import { TILE } from './world.js';
import { TAU, angleDiff, clamp, smoothstep } from '../core/math2d.js';

/** DDA 网格步进求视线遮挡距离：精确、O(格数)、无采样量化误差 */
export function castRay(world, ox, oz, dx, dz, maxDist) {
  const lx = ox - world.minX, lz = oz - world.minZ;
  let tx = Math.floor(lx), tz = Math.floor(lz);
  if (world.blocksSight(tx, tz)) return 0;

  const stepX = dx > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);
  let tMaxX = dx === 0 ? Infinity
    : dx > 0 ? (Math.floor(lx) + 1 - lx) / dx
      : (Math.floor(lx) - lx) / dx;
  let tMaxZ = dz === 0 ? Infinity
    : dz > 0 ? (Math.floor(lz) + 1 - lz) / dz
      : (Math.floor(lz) - lz) / dz;

  let t = 0;
  const guard = Math.ceil(maxDist) * 4 + 8;
  for (let i = 0; i < guard; i++) {
    if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDeltaX; tx += stepX; }
    else { t = tMaxZ; tMaxZ += tDeltaZ; tz += stepZ; }
    if (t >= maxDist) return maxDist;
    if (world.blocksSight(tx, tz)) return t;
  }
  return maxDist;
}

export class Vision {
  constructor(world) {
    this.world = world;
    this.rays = VISION.rays;
    this.poly = new Float32Array(this.rays * 2);
    this.polyCount = 0;
    this.range = VISION.baseSightRange;
    this.fov = (VISION.playerFovDeg * Math.PI) / 180;
    this.hash = 0;              // 多边形指纹：没变化就不重传贴图
    this.visibleEntities = 0;
  }

  /**
   * 生成可见多边形。视锥内用完整视距，视锥外只留"贴身感知圈"
   * —— 这正好实现文档要求的"玩家背后同样被阴影蒙版遮罩"。
   */
  cast(ox, oz, facing, range = this.range) {
    const n = this.rays;
    const half = this.fov / 2;
    const personal = 2.4;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rel = Math.abs(angleDiff(a, facing));
      const k = smoothstep(half, half + 0.55, rel);
      const r = range + (personal - range) * k;
      const dx = Math.sin(a), dz = Math.cos(a);
      const d = castRay(this.world, ox, oz, dx, dz, r);
      this.poly[i * 2] = ox + dx * d;
      this.poly[i * 2 + 1] = oz + dz * d;
      // 指纹：量化到 0.25 单位，玩家小幅移动不会触发重传
      h = (Math.imul(h ^ Math.round(d * 4), 16777619) >>> 0);
    }
    this.polyCount = n;
    this.hash = (h ^ Math.round(ox * 2) ^ Math.round(oz * 2)) >>> 0;
    return this.poly;
  }

  /** 目标点是否可见（供 AI 与 UI 共用） */
  canSee(ox, oz, facing, tx, tz, range = this.range, fov = this.fov) {
    const dx = tx - ox, dz = tz - oz;
    const d = Math.hypot(dx, dz);
    if (d > range) return false;
    if (d > 2.4) {
      const rel = Math.abs(angleDiff(Math.atan2(dx, dz), facing));
      if (rel > fov / 2) return false;
    }
    if (d < 0.001) return true;
    const hit = castRay(this.world, ox, oz, dx / d, dz / d, d);
    return hit >= d - 0.001;
  }

  /** 点是否落在当前可见多边形内（宽相位：比逐射线便宜） */
  inPolygon(x, z) {
    // 找到 x,z 相对原点的角度对应的射线桶，比较距离即可（多边形是星形的）
    const ox = this.poly[0], oz = this.poly[1];
    const dx = x - ox, dz = z - oz;
    const d = Math.hypot(dx, dz);
    if (d > this.range + 0.5) return false;
    let a = Math.atan2(dx, dz);
    if (a < 0) a += TAU;
    const i = Math.floor((a / TAU) * this.rays) % this.rays;
    const rd = Math.hypot(this.poly[i * 2] - ox, this.poly[i * 2 + 1] - oz);
    // 取相邻两桶的较小值，避免桶边界误判
    const j = (i + 1) % this.rays;
    const rd2 = Math.hypot(this.poly[j * 2] - ox, this.poly[j * 2 + 1] - oz);
    return d <= Math.max(rd, rd2) + 0.35;
  }

  /**
   * 逐实体判定可见性并做渲染剔除（文档：盲区内的敌对模型必须剔除，防作弊式）。
   * entities 需要有 x / z，写入 .seen 与 .hidden。
   */
  update(entities, px, pz, facing, range = this.range, dt = 0) {
    let vis = 0;
    for (const e of entities) {
      const dx = e.x - px, dz = e.z - pz;
      const d2 = dx * dx + dz * dz;
      let seen = false;
      if (d2 < (range + 1) * (range + 1)) {
        const d = Math.sqrt(d2);
        if (d <= 2.4) seen = true;
        else if (Math.abs(angleDiff(Math.atan2(dx, dz), facing)) <= this.fov / 2) {
          seen = castRay(this.world, px, pz, dx / d, dz / d, d) >= d - 0.001;
        }
      }
      e.seen = seen;
      e.hidden = !seen;
      if (seen) vis++;
      // 记忆：离开视野后仍短暂"知道"目标在哪（AI 用）
      if (seen) { e.lastSeenX = e.x; e.lastSeenZ = e.z; e.memory = VISION.memorySec; }
      else if (e.memory > 0) e.memory -= dt;
    }
    this.visibleEntities = vis;
    return vis;
  }
}

/** 依据时间/天气/手电计算当前视距（M5 天气接入后 weatherMul 会变化） */
export function sightRange(dayK, weatherMul = 1, flashlightOn = false, thermal = false) {
  let r = VISION.baseSightRange;
  r *= 0.45 + 0.55 * dayK;                       // 夜晚视距大幅缩短
  r *= weatherMul;
  if (flashlightOn) r = Math.max(r, VISION.flashlightRange * 1.25);
  if (thermal) r = Math.max(r, VISION.baseSightRange * 0.85);
  return clamp(r, 3.5, VISION.baseSightRange * 1.4);
}
