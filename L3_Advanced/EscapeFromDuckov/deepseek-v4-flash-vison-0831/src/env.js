import * as THREE from 'three';
import { clamp, lerp, TAU } from './util.js';
import { HALF } from './world.js';

// ================= 昼夜循环 / 天气 / 光照环境 =================
export class Env {
  constructor(game) {
    this.game = game;
    this.cfg = game.cfg;
    this.day = 1;
    this.hour = 9; // 开局早上 9 点
    this.dayMinutes = 60 / this.cfg.dayLenHours; // 现实分钟 ↔ 游戏小时
    this.powerOn = true;
    this.waterOn = true;
    this.weather = 'clear';
    this.weatherT = 0;
    this.rain = 0; this.rainTarget = 0;
    this.fog = 0; this.fogTarget = 0;
    this.cloud = 0;
    this.temp = 18;
    this.thunderT = 0;
    this.dayNight = 1; this.nightBlue = 0;
    this.fogColor = new THREE.Color(0x9fb2bd);
    this.skyColor = new THREE.Color(0xbfd4e0);
    this.saturation = 0.92; this.contrast = 1.12;
    this.fogDensity = 0.009;
    this.ambientLight = 0.55;
    this.moonLight = 0.0;
    this.lastMetaEvent = 0;
  }
  get isNight() { return this.hour > 20.5 || this.hour < 6; }
  tick(dt) {
    const g = this.game;
    this.hour += dt / 3600 * 60 / this.cfg.dayLenHours;
    if (this.hour >= 24) { this.hour -= 24; this.day++; g.events.emit('day', this.day); }

    // ---- 天气马尔可夫链 ----
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      this.weatherT = 90 + Math.random() * 240;
      const w = ['clear', 'clear', 'cloudy', 'cloudy', 'rain', 'storm', 'fog'][Math.floor(Math.random() * 7)];
      this.weather = w;
      this.rainTarget = w === 'rain' ? 0.55 : w === 'storm' ? 1 : 0;
      this.fogTarget = w === 'fog' ? 0.55 : w === 'storm' ? 0.75 : w === 'rain' ? 0.25 : 0;
      this.cloud = w === 'clear' ? 0.15 : w === 'cloudy' ? 0.75 : 0.95;
      if (w === 'storm') g.toast('⚡ 暴风雨来袭，能见度骤降', 'warn');
    }
    this.rain = lerp(this.rain, this.rainTarget, dt * 0.05);
    this.fog = lerp(this.fog, this.fogTarget, dt * 0.04);
    this.thunderT -= dt;
    if (this.weather === 'storm' && this.thunderT <= 0) {
      this.thunderT = 14 + Math.random() * 22;
      g.audio.thunder();
      g.events.emit('thunder');
    }
    // 环境温度：昼夜 + 天气
    const dayCurve = Math.sin((this.hour - 6) / 24 * TAU) * 0.5 + 0.5;
    this.temp = 8 + dayCurve * 14 - this.rain * 5 - this.fog * 2;

    // ---- 光照环境 ----
    const sun = this.sunCurve(this.hour);
    this.dayNight = clamp(sun, 0, 1);
    this.nightBlue = clamp(1 - this.dayNight * 1.6, 0, 1);
    this.fogDensity = 0.0065 + this.fog * 0.045 + (1 - this.dayNight) * 0.01 + this.rain * 0.014;
    this.saturation = lerp(0.92, 0.62, this.nightBlue * 0.6 + this.rain * 0.25);
    this.contrast = lerp(1.12, 1.28, this.nightBlue);
    // 雾色
    this.fogColor.setHSL(0.55, 0.1 - this.fog * 0.05, 0.5 + this.dayNight * 0.14 - this.fog * 0.1);
    this.skyColor.setHSL(0.56, 0.2 - this.cloud * 0.12, 0.5 + this.dayNight * 0.2);
    this.ambientLight = lerp(0.1, 0.85, Math.pow(this.dayNight, 1.3));
    this.moonLight = lerp(0.22, 0.0, this.dayNight);

    // ---- 供水/供电停供事件 ----
    if (this.cfg.powerShutoff > 0 && this.day > this.cfg.powerShutoff && this.powerOn) {
      this.powerOn = false; g.toast('⚠️ 电网停止供电', 'warn');
    }
    if (this.cfg.waterShutoff > 0 && this.day > this.cfg.waterShutoff && this.waterOn) {
      this.waterOn = false; g.toast('⚠️ 自来水断供', 'warn');
    }

    // ---- 元事件（随机远处枪声 / 直升机） ----
    if (this.cfg.metaEvents > 0 && g.now - this.lastMetaEvent > 240 + Math.random() * 240) {
      this.lastMetaEvent = g.now;
      g.events.emit('metaEvent');
    }
  }
  sunCurve(hour) {
    // 6-18 点白天曲线
    const t = clamp((hour - 5.5) / 13, 0, 1);
    return Math.sin(t * Math.PI);
  }
  sunAngle(hour) {
    const el = lerp(-0.35, 1.15, this.sunCurve(hour));
    const az = (hour - 6) / 12 * Math.PI;
    return { el, az };
  }
  weatherName() {
    const w = { clear: '晴', cloudy: '多云', rain: '雨', storm: '暴雨', fog: '雾' };
    return w[this.weather] || '晴';
  }
  applyToRenderer(r) {
    const g = this.game;
    if (!r.sun) return;
    const { el, az } = this.sunAngle(this.hour);
    const dist = 70;
    const px = g.player ? g.player.x - HALF : 0, pz = g.player ? g.player.z - HALF : 0;
    r.sun.position.set(px + Math.cos(az) * dist, el * dist + 4, pz + Math.sin(az) * dist * 0.6);
    r.sun.target.position.set(px, 0, pz);
    const dayC = new THREE.Color(0xffe2b8);
    const nightC = new THREE.Color(0x8ea8e0);
    const sunC = dayC.clone().lerp(nightC, this.nightBlue);
    r.sun.color.copy(sunC);
    r.sun.intensity = lerp(1.0, 6.0, this.dayNight) * (1 - this.cloud * 0.4);
    r.hemi.color.setHSL(0.55, 0.3, 0.66);
    r.hemi.groundColor.setHSL(0.6, 0.2, 0.16);
    r.hemi.intensity = 1.0 + this.ambientLight * 1.5 + this.moonLight * 0.6;
    // 街灯（供电时夜间亮）
    const slOn = this.powerOn && this.nightBlue > 0.35;
    r.pointLights.forEach((pl, i) => {
      const sl = r.streetlights[i * 2 + Math.floor(i / 2)];
      if (slOn && sl) {
        pl.visible = true;
        pl.position.set(sl.x - HALF, 3.6, sl.z - HALF);
        pl.intensity = this.nightBlue * 6;
        pl.color.setHSL(0.11, 0.9, 0.72);
      } else if (i === 3) {
        // 保留一个灯给篝火/火源
        pl.visible = false;
      } else pl.visible = false;
    });
    // 篝火
    if (g.world && r.pointLights[3]) {
      let used = false;
      for (const f of g.world.fires.values()) {
        if (f.lit && Math.hypot(f.x - g.player.x, f.z - g.player.z) < 24) {
          r.pointLights[3].visible = true;
          r.pointLights[3].position.set(f.x - HALF, 1.4, f.z - HALF);
          r.pointLights[3].intensity = 7 + Math.sin(g.now * 9) * 1.2;
          r.pointLights[3].color.setHSL(0.07, 0.95, 0.6);
          used = true;
          break;
        }
      }
      if (!used && r.pointLights[3] !== r.pointLights[0]) { /* 由上面街灯循环覆盖 */ }
    }
    // 场景背景色
    r.renderer.setClearColor(this.skyColor, 1);
  }
}
