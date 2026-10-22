import { clamp, lerp, TAU, dist2 } from './util.js';
import { HALF } from './world.js';

// ================= 丧尸（感染鸭）与尸群管理 =================
export class Zombie {
  constructor(game, x, z, kind) {
    this.game = game;
    this.x = x; this.z = z;
    this.kind = kind || 'shambler';
    this.face = Math.random() * TAU;
    this.hp = this.maxHp = kind === 'fat' ? 7 : kind === 'sprinter' ? 3.2 : 4.5;
    this.speed = kind === 'sprinter' ? 1.7 : kind === 'fat' ? 0.55 : 0.85;
    this.dead = false;
    this.state = 'idle';
    this.wanderT = 2 + Math.random() * 6;
    this.wanderDir = Math.random() * TAU;
    this.attackT = 0;
    this.chargeT = 0;
    this.charging = false;
    this.lastSeen = null;
    this.alert = 0;
    this.bashing = null;
    this.bashT = 0;
    this.corpseT = 0;
    this.visibleToPlayer = false;
    this.hidden = false;
    this.visTimer = Math.random() * 0.3;
    this.animSeed = Math.random() * 10;
    this.moveT = 0;
    this.bucket = null;
    this.lootRolled = false;
  }
  update(dt) {
    if (this.dead) { this.corpseT += dt; return; }
    const g = this.game, w = g.world, p = g.player;
    if (!p || p.dead) return;
    const dPlayer = dist2(this.x, this.z, p.x, p.z);
    // 出生保护期：附近丧尸静默
    if (g.startGrace && g.now < g.startGrace && dPlayer < 20) return;
    // 感知
    const isNight = g.env.isNight;
    const light = g.env.dayNight;
    const sightBase = this.kind === 'sprinter' ? 20 : 15;
    const sight = sightBase * (1 - g.env.fog * 0.7) * (0.35 + 0.65 * light);
    let hearR = this.kind === 'fat' ? 9 : this.kind === 'sprinter' ? 26 : 16;
    if (this.alert > 0) hearR *= 1.6;
    // 声音事件
    for (const ev of g.pendingNoise) {
      const d = dist2(this.x, this.z, ev.x, ev.z);
      if (d < ev.r * hearR / 16) {
        const blocked = d > 1.5 && w.losBlocked(ev.x, ev.z, this.x, this.z);
        if (!blocked) { this.alert = 1; this.lastSeen = { x: ev.x, z: ev.z }; this.state = 'investigate'; }
      }
    }
    // 视野
    const canSee = dPlayer < sight && (isNight ? dPlayer < sight * 0.7 : true) && !w.losBlocked(this.x, this.z, p.x, p.z);
    // 玩家噪音
    if (p.moving) {
      const pNoise = (p.running ? 13 : p.sneaking ? 3.2 : 7.5) * p.stats.noiseMult * p.stats.sneakNoiseMult;
      if (dPlayer < pNoise * 1.25) {
        if (this.kind !== 'sprinter' || dPlayer < pNoise) { this.alert = 1; this.lastSeen = { x: p.x, z: p.z }; if (this.state === 'idle') this.state = 'investigate'; }
      }
    }
    if (canSee) {
      this.alert = 1;
      this.lastSeen = { x: p.x, z: p.z };
      this.state = 'chase';
    }
    // 状态机
    switch (this.state) {
      case 'idle': {
        this.wanderT -= dt;
        this.moveT = 0;
        if (this.wanderT <= 0) {
          this.wanderT = 4 + Math.random() * 8;
          this.wanderDir += (Math.random() - 0.5) * 2.4;
          this.moveT = 1.5 + Math.random() * 2;
        }
        if (this.moveT > 0) {
          this.moveT -= dt;
          this.move(this.wanderDir, 0.3, dt);
        }
        this.alert = Math.max(0, this.alert - dt * 0.15);
        break;
      }
      case 'investigate': {
        if (!this.lastSeen) { this.state = 'idle'; break; }
        const d = dist2(this.x, this.z, this.lastSeen.x, this.lastSeen.z);
        if (d < 0.8) { this.state = 'idle'; this.alert = 0.3; break; }
        this.move(Math.atan2(this.lastSeen.x - this.x, this.lastSeen.z - this.z), 0.6, dt);
        this.alert = Math.max(0, this.alert - dt * 0.08);
        if (this.alert <= 0.05) this.state = 'idle';
        break;
      }
      case 'chase': {
        if (!p || p.dead) { this.state = 'idle'; break; }
        // 狂暴冲刺（红光亮效蓄力）
        if (this.kind === 'sprinter' && dPlayer > 3.2 && dPlayer < 9 && this.chargeT <= 0 && Math.random() < dt * 0.5) {
          this.chargeT = 0.55; this.charging = true;
        }
        if (this.charging) {
          this.chargeT -= dt;
          if (this.chargeT <= 0) { this.charging = false; this.chargeT = 3; this.dash = { x: p.x, z: p.z, t: 0.5 }; }
        }
        let spd = this.speed;
        if (this.dash) {
          this.dash.t -= dt;
          const dd = dist2(this.x, this.z, this.dash.x, this.dash.z);
          if (this.dash.t <= 0 || dd < 0.6) this.dash = null;
          else { spd = this.speed * 3.2; this.move(Math.atan2(this.dash.x - this.x, this.dash.z - this.z), spd, dt); break; }
        }
        const ang = Math.atan2(p.x - this.x, p.z - this.z);
        if (dPlayer > 0.75) {
          // 门挡路 → 砸门
          const wall = w.findDoorNear(this.x, this.z, 1.15);
          if (wall && wall.blocksMove() && wall.type === 'door') {
            this.bash(wall, dt);
          } else {
            this.move(ang, spd * (1 + Math.min(1, this.alert)), dt);
          }
        } else {
          this.attack(dt);
        }
        break;
      }
    }
    this.attackT = Math.max(0, this.attackT - dt);
    // 爬行者趴行
    if (this.kind === 'crawler') this.speed = 0.38;
  }
  move(angle, speed, dt) {
    const w = this.game.world;
    const r = w.moveCircle(this.x, this.z, 0.3, Math.sin(angle) * speed * dt, Math.cos(angle) * speed * dt);
    this.x = r.x; this.z = r.z;
    this.face = angle;
    if (r.hit) this.wanderDir += Math.PI * 0.7;
  }
  bash(wall, dt) {
    if (this.bashing !== wall) { this.bashing = wall; this.bashT = 0; }
    this.bashT += dt;
    if (this.bashT > 0.9) {
      this.bashT = 0;
      wall.hp -= this.kind === 'fat' ? 8 : 4;
      this.game.events.emit('noise', { x: wall.x, z: wall.z, r: 7, type: 'bash' });
      if (wall.hp <= 0) {
        if (wall.type === 'window') { wall.smashed = true; this.game.renderer.updateWindowVisual(wall); }
        else { wall.smashed = true; wall.type = 'hole'; }
        this.bashing = null;
        this.game.toast('💥 丧尸砸开了障碍！', 'warn');
      }
    }
  }
  attack(dt) {
    const p = this.game.player;
    if (this.attackT > 0 || p.rollActive()) return;
    this.attackT = this.kind === 'sprinter' ? 0.8 : 1.4;
    // 蓄力红光
    this.game.renderer.addFeathers(this.x - HALF, 0.6, this.z - HALF, 2, 0xffb0a0);
    const r = p.stats.applyZombieHit(this, Math.random);
    if (r && r.hit) {
      p.stats.panic = clamp(p.stats.panic + 18, 0, 100);
    }
  }
  takeMelee(dmg, kb, headshot, src) {
    if (this.dead) return;
    if (headshot && this.kind !== 'fat') { this.die(src); return; }
    this.hp -= dmg;
    const ang = Math.atan2(this.x - src.x, this.z - src.z);
    const r = this.game.world.moveCircle(this.x, this.z, 0.3, Math.sin(ang) * kb * 0.25, Math.cos(ang) * kb * 0.25);
    this.x = r.x; this.z = r.z;
    if (this.hp <= 0) this.die(src);
    else { this.alert = 1; this.state = 'chase'; this.lastSeen = { x: src.x, z: src.z }; }
  }
  die(src) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.state = 'dead';
    this.game.audio.meleeKill();
    this.game.renderer.addFeathers(this.x - HALF, 0.8, this.z - HALF, 14, 0xb8c890);
    // 尸体可搜刮
    this.corpseT = 0;
    if (this.game.world) {
      // 尸体进入容器列表
      const c = { x: this.x, z: this.z, type: 'corpse', items: [], searched: false, open: true, cap: 4, loot: 'zombie', name: '感染鸭的尸体', bucket: null, zombie: this };
      this.game.world.addContainer(c);
      this.corpseContainer = c;
    }
  }
  updateVisible() {
    const g = this.game, p = g.player;
    this.visTimer -= g.dt;
    if (this.visTimer > 0) return;
    this.visTimer = 0.12 + Math.random() * 0.1;
    const d = dist2(this.x, this.z, p.x, p.z);
    if (d > 46) { this.hidden = true; return; }
    if (g.world.losBlocked(p.x, p.z, this.x, this.z)) { this.hidden = true; return; }
    this.hidden = false;
  }
}

export class ZombieManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.spawnTimer = 0;
    this.spawned = 0;
  }
  spawn(x, z, kind) {
    const kinds = ['shambler', 'shambler', 'shambler', 'crawler', 'fat', 'sprinter'];
    const k = kind || kinds[Math.floor(Math.random() * kinds.length * 0.9)];
    const zed = new Zombie(this.game, x, z, k);
    this.list.push(zed);
    this.game.world.addToBucket(zed);
    this.spawned++;
    return zed;
  }
  init() {
    const g = this.game, w = g.world;
    const pop = g.cfg.zombiePop;
    const target = Math.round(90 * pop);
    // 城区热区
    const hot = [
      [HALF - 5, HALF - 4, 26],
      [HALF + 16, HALF + 26, 12],
      [HALF - 30, HALF + 10, 18],
      [HALF + 8, HALF - 20, 10],
    ];
    let guard = 0;
    while (this.spawned < target && guard++ < target * 30) {
      const z = g.rng.range(4, g.WORLD_SIZE - 4);
      let x;
      if (Math.random() < 0.65) {
        const h = hot[Math.floor(Math.random() * hot.length)];
        const a = Math.random() * TAU, r = Math.random() * h[2];
        x = h[0] + Math.cos(a) * r;
        const zz = h[1] + Math.sin(a) * r;
        if (Math.hypot(x - h[0], zz - h[1]) < 4 && this.spawned % 3 !== 0) continue;
        this.spawn(x, zz);
      } else {
        this.spawn(Math.random() * (g.WORLD_SIZE - 10) + 5, Math.random() * (g.WORLD_SIZE - 10) + 5);
      }
    }
    // 初始远离玩家
    for (const z of this.list) {
      if (dist2(z.x, z.z, g.player.x, g.player.z) < 26) {
        const a = Math.random() * TAU;
        z.x = clamp(g.player.x + Math.cos(a) * 30, 3, g.WORLD_SIZE - 3);
        z.z = clamp(g.player.z + Math.sin(a) * 30, 3, g.WORLD_SIZE - 3);
      }
    }
  }
  update(dt) {
    const g = this.game;
    this.spawnTimer += dt;
    const cap = Math.round(160 * g.cfg.zombiePop);
    if (this.spawnTimer > 900 && this.list.filter(z => !z.dead).length < cap) {
      this.spawnTimer = 0;
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * TAU;
        const d = 30 + Math.random() * 50;
        const x = clamp(g.player.x + Math.cos(a) * d, 4, g.WORLD_SIZE - 4);
        const z = clamp(g.player.z + Math.sin(a) * d, 4, g.WORLD_SIZE - 4);
        this.spawn(x, z);
      }
    }
    for (const z of this.list) {
      const d = dist2(z.x, z.z, g.player.x, g.player.z);
      if (z.dead) {
        // 尸体留存一段时间
        if (z.corpseT > g.cfg.corpseHours * 3600) { /* 保留 */ }
        continue;
      }
      if (d < 70) z.update(dt);
      z.updateVisible();
    }
  }
  nearbyThreat() {
    const g = this.game;
    let n = 0;
    for (const z of this.list) {
      if (z.dead) continue;
      const d = dist2(z.x, z.z, g.player.x, g.player.z);
      if (d < 16 && !g.world.losBlocked(g.player.x, g.player.z, z.x, z.z)) n++;
    }
    return n;
  }
  metaEventHorde(x, z) {
    // 元事件：尸群向目标点移动
    let moved = 0;
    for (const z of this.list) {
      if (z.dead) continue;
      if (dist2(z.x, z.z, x, z) < 60 && Math.random() < 0.7) {
        z.state = 'investigate';
        z.lastSeen = { x, z };
        z.alert = 1;
        moved++;
      }
    }
    return moved;
  }
}
