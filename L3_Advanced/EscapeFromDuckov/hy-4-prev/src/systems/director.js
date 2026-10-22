// 战局导演：撤离读条、时限后的尸潮、直升机事件、停水停电、元事件。
// 这些是 PZ 的"世界在动"感来源 —— 没有它们，地图只是一张静态靶场。
import { bus, noise } from '../core/events.js';
import { EXTRACT, WORLD_EVENT, NOISE } from '../data/balance.js';
import { clamp, clamp01 } from '../core/math2d.js';

export class Director {
  constructor(game) {
    this.game = game;
    this.elapsed = 0;                       // 局内已过秒数
    this.limit = EXTRACT.raidMinutes * 60 / 60;   // 1 游戏分钟 = 1 真实秒，故时限同为秒
    this.extracting = false;
    this.extractT = 0;
    this.extracted = false;
    this.overtime = false;

    // 停电 / 停水：开局时按天数范围掷一次
    const r = game.rng;
    const [pa, pb] = WORLD_EVENT.powerShutoff.dayRange;
    const [wa, wb] = WORLD_EVENT.waterShutoff.dayRange;
    this.powerDay = r.int(pa, pb);
    this.waterDay = r.int(wa, wb);
    this.powerOn = game.day < this.powerDay;
    this.waterOn = game.day < this.waterDay;

    // 直升机：第 6~9 天的白天
    const [ha, hb] = WORLD_EVENT.helicopter.dayRange;
    this.chopperDay = r.int(ha, hb);
    this.chopperHour = r.int(...WORLD_EVENT.helicopter.hourRange);
    this.chopperFired = false;
    this.chopper = null;
    this.metaT = 0;
  }

  /** 局内计时（真实秒） */
  update(dt, gameMinutes) {
    const g = this.game;
    if (this.extracted || !g.player.alive) return;
    this.elapsed += dt;

    // ---- 撤离读条 ----
    const at = this.nearestExit();
    if (at) {
      if (!this.extracting) { this.extracting = true; this.extractT = 0; }
      this.extractT += dt;
      if (this.extractT >= EXTRACT.channelSeconds) {
        this.extracted = true;
        bus.emit('raid:extracted', { exit: at });
      }
    } else if (this.extracting) {
      this.extracting = false;
      this.extractT = 0;
    }

    // ---- 超时：尸潮模式 ----
    if (this.elapsed > this.limit) {
      if (!this.overtime) { this.overtime = true; bus.emit('raid:overtime'); }
      this.hordeT = (this.hordeT || 0) + dt;
      if (this.hordeT > 12) { this.hordeT = 0; this.spawnHorde(EXTRACT.overtimeHordePerMinute); }
    }

    this.updateWorldEvents(dt, gameMinutes);
  }

  nearestExit() {
    const p = this.game.player;
    for (const e of this.game.world.exitPoints) {
      if (Math.hypot(e.x - p.x, e.z - p.z) <= (e.r ?? 3)) return e;
    }
    return null;
  }

  /** 直升机事件 / 停水停电 / 每日元事件 */
  updateWorldEvents(dt, gameMinutes) {
    const g = this.game;
    const hour = Math.floor(g.minutes / 60);

    if (this.powerOn && g.day >= this.powerDay) {
      this.powerOn = false;
      if (!this.powerAnnounced) {
        this.powerAnnounced = true;
        bus.emit('world:powerOut');
        g.toast?.('停电了 —— 冰箱与路灯停止工作', 'bad');
      }
    }
    if (this.waterOn && g.day >= this.waterDay) {
      this.waterOn = false;
      if (!this.waterAnnounced) {
        this.waterAnnounced = true;
        bus.emit('world:waterOut');
        g.toast?.('自来水停了 —— 雨水收集器变得关键', 'bad');
      }
    }

    // 直升机：到达预定日的预定小时，持续盘旋并发出巨大噪音
    if (!this.chopperFired && g.day === this.chopperDay && hour === this.chopperHour) {
      this.chopperFired = true;
      this.chopper = { t: 0, x: g.player.x + 40, z: g.player.z - 40, angle: 0 };
      bus.emit('world:chopper', this.chopper);
      g.toast?.('远处传来直升机的声音……', 'bad');
    }
    if (this.chopper) {
      this.chopper.t += dt;
      this.chopper.angle += dt * 0.6;
      const R = 45;
      this.chopper.x = g.player.x + Math.cos(this.chopper.angle) * R;
      this.chopper.z = g.player.z + Math.sin(this.chopper.angle) * R;
      noise.emit(this.chopper.x, this.chopper.z, NOISE.chopper, 'chopper', null, 0.6);
      if (this.chopper.t > (WORLD_EVENT.helicopter.lingerMinutes * 60) / 60) this.chopper = null;
    }

    // 元事件：每日至多一次，让尸群自然迁徙
    this.metaT += dt;
    if (this.metaT > 45) {
      this.metaT = 0;
      const p = g.world.randomOpenPoint(g.rng, g.playerSpawn, 30);
      noise.emit(p.x, p.z, 90, 'meta', null, 0.8);
    }
  }

  /** 尸潮：从玩家视野外缘刷出（僵毁的"被噪音引来的尸群"） */
  spawnHorde(n) {
    const g = this.game;
    for (let i = 0; i < n; i++) {
      const a = g.rng.float(0, Math.PI * 2);
      const R = 26 + g.rng.float(0, 12);
      const x = g.player.x + Math.cos(a) * R;
      const z = g.player.z + Math.sin(a) * R;
      if (Math.abs(x - g.world.minX) < 2 || Math.abs(z - g.world.minZ) < 2) continue;
      const t = g.world.toTile(x, z);
      if (g.world.blocksMove(t.tx, t.tz)) continue;
      const E = g.enemies[0]?.constructor;
      if (E) g.enemies.push(new E('scav', x, z));
    }
    g.toast?.('尸潮正在逼近！', 'bad');
  }

  get progress() { return clamp01(this.elapsed / this.limit); }
  get remaining() { return Math.max(0, this.limit - this.elapsed); }
}

export const EXTRACT_SECONDS = EXTRACT.channelSeconds;
