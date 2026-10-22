// 天气状态机（PZ：天气会改变听距、视距、体温与湿度）。
// 风暴区强制锁定雷暴；其它地图按马尔可夫链在四态之间迁移。
import { bus } from '../core/events.js';
import { clamp, clamp01, lerp } from '../core/math2d.js';

export const WEATHER = {
  clear: { id: 'clear', name: '晴', rain: 0, fog: 0, sight: 1.00, temp: 0, wetRate: 0 },
  cloudy: { id: 'cloudy', name: '阴', rain: 0, fog: 0.15, sight: 0.94, temp: -1.5, wetRate: 0 },
  fog: { id: 'fog', name: '雾', rain: 0, fog: 1.0, sight: 0.60, temp: -1.0, wetRate: 0.05 },
  rain: { id: 'rain', name: '雨', rain: 0.55, fog: 0.35, sight: 0.82, temp: -2.5, wetRate: 0.55 },
  storm: { id: 'storm', name: '雷暴', rain: 1.0, fog: 0.6, sight: 0.48, temp: -4.5, wetRate: 1.0 },
  snow: { id: 'snow', name: '雪', rain: 0.35, fog: 0.5, sight: 0.75, temp: -8, wetRate: 0.35 },
};

// 每小时的迁移权重
const TRANSITION = {
  clear: { clear: 0.80, cloudy: 0.18, fog: 0.02 },
  cloudy: { cloudy: 0.62, clear: 0.22, rain: 0.14, fog: 0.02 },
  fog: { fog: 0.55, cloudy: 0.35, clear: 0.10 },
  rain: { rain: 0.66, cloudy: 0.24, storm: 0.10 },
  storm: { storm: 0.58, rain: 0.38, cloudy: 0.04 },
  snow: { snow: 0.70, cloudy: 0.30 },
};

export class Weather {
  constructor(game, rng) {
    this.game = game;
    this.rng = rng;
    this.locked = game.mapDef.storm ? 'storm' : null;
    this.id = this.locked || 'clear';
    this.hours = 0;
    this.flash = 0;                // 落雷亮度
    this.nextBolt = 4 + rng.float(0, 10);
    this.wind = 0.4;
    this.baseTemp = 21;
  }

  get def() { return WEATHER[this.id]; }
  get sightMul() { return this.def.sight; }
  get rainAmount() { return this.def.rain; }
  get stormAmount() { return this.id === 'storm' ? 1 : this.id === 'rain' ? 0.35 : 0; }

  /** 推进一个游戏小时 */
  updateHours(hours) {
    this.hours += hours;
    if (this.locked) return;
    if (this.rng.chance(hours * 0.35)) {
      const t = TRANSITION[this.id] || TRANSITION.clear;
      let total = 0;
      for (const k in t) total += t[k];
      let r = this.rng.float(0, total);
      for (const k in t) { r -= t[k]; if (r <= 0) { if (k !== this.id) { this.id = k; bus.emit('weather:changed', WEATHER[k]); } break; } }
    }
    // 风向缓慢漂移
    this.wind = clamp01(this.wind + this.rng.float(-0.12, 0.12));
  }

  /** 每帧：落雷计时 */
  update(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.id !== 'storm') return;
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.nextBolt = 4 + this.rng.float(0, 14);
      this.flash = 1;
      this.game.rig?.addShake(0.35);
      bus.emit('weather:thunder', { x: this.game.player.x + this.rng.float(-40, 40), z: this.game.player.z + this.rng.float(-40, 40) });
    }
  }

  /** 环境温度：昼夜 + 天气 + 季节衰减（越往后越冷） */
  ambientTemp(dayK, day) {
    const season = clamp((day - 1) / 30, 0, 1) * -9;      // 一个月入秋
    return this.baseTemp + season + this.def.temp + (dayK - 0.5) * 9;
  }

  /** 风雨越强，声音传播越差（PZ：雨天听得更远、风声掩盖脚步） */
  hearingMul() { return 1 + this.def.rain * 0.25; }
}

/** 体温模型：环境 + 衣物 + 潮湿 + 风寒 → 核心体温缓慢漂移 */
export function updateBodyTemp(body, ambient, gameHours, ctx = {}) {
  const clothing = ctx.clothing ?? 0;
  const wet = body.wet ?? 0;
  let effective = ambient + clothing * 2.2;
  effective -= wet * (5 + (ctx.wind ?? 0.4) * 7);          // 风寒效应
  if (ctx.nearFire) effective += 11;
  if (ctx.indoors) effective += 3.5;
  // 核心体温向有效温度缓慢靠拢
  const rate = 0.55 * gameHours;
  body.temp = lerp(body.temp, effective, clamp01(rate / 6));
  return body.temp;
}
