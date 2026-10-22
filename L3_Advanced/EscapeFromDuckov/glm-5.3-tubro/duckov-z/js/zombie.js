/* DUCKOV Z - 僵尸：感知/状态机/攻击/抓握/尸变 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U, W = DZ.W, T = W.T;
  const Z = {};
  let zid = 1;

  Z.spawn = function (S, px, py, type, dormant) {
    const def = C.ZOMBIE.types[type] || C.ZOMBIE.types.walker;
    const z = {
      id: zid++, x: px, y: py, a: U.frange(0, Math.PI * 2), type,
      hp: def.hp * (type === 'tank' ? 1 : U.frange(0.85, 1.15)), max: def.hp,
      spd: def.spd, dmg: def.dmg, sight: def.sight, scale: def.scale,
      state: dormant ? 'dormant' : 'wander', tx: px, ty: py,
      lastSeen: null, lastHeard: null, loseT: 0, thinkT: U.frange(0, 3),
      windup: 0, cdT: 0, staggerT: 0, biteT: 0, flashT: 0, crawl: false,
      dormant: !!dormant, dead: false, walkPhase: Math.random() * 6, stepT: 0,
      stuckT: 0, lpx: px, lpy: py, groanT: U.frange(2, 12)
    };
    S.zombies.push(z);
    return z;
  };

  // 视野参数（受天气/光照影响）
  function sightRange(S, pl, z) {
    let r = z.sight;
    const h = S.mins;
    const night = U.isNight(h);
    if (night) r *= 0.42;
    else if (h > 18.5 * 60 || h < 7 * 60) r *= 0.75; // 黄昏黎明
    const w = S.weather.cur;
    if (w === 'fog') r *= C.VISION.fogMul;
    else if (w === 'rain') r *= C.VISION.rainMul;
    else if (w === 'storm') r *= C.VISION.stormMul;
    if (pl.crouch) r *= C.VISION.crouchMul;
    return r;
  }

  Z.update = function (S, z, dt, pl) {
    if (z.dead) return;
    const def = C.ZOMBIE.types[z.type];
    const spdMul = z.crawl ? 0.28 : 1;
    z.flashT = Math.max(0, z.flashT - dt);
    z.cdT -= dt; z.groanT -= dt; z.biteT -= dt;
    if (z.staggerT > 0) { z.staggerT -= dt; return; }
    const dPx = U.dist(z.x, z.y, pl.x, pl.y);

    // ---- 感知 ----
    let seesP = false;
    if (!pl.dead && !pl.grabbedBy || !pl.dead) {
      const r = sightRange(S, pl, z);
      const halfFov = 62 * Math.PI / 180;
      seesP = DZ.FOV.canSee(S, z.x, z.y, pl.x, pl.y, r, halfFov, z.a);
      // 手电/枪口暴露
      if (!seesP && pl.flashlight && dPx < 15 && DZ.FOV.canSee(S, z.x, z.y, pl.x, pl.y, 15, null)) seesP = true;
      // 贴脸感知
      if (!seesP && dPx < C.TILE * 1.6) seesP = true;
    }
    if (seesP) {
      if (z.state !== 'chase') {
        z.state = 'chase';
        if (z.groanT <= 0) { DZ.audio.play('groan', z.x, z.y); z.groanT = U.frange(3, 8); }
        // 呼唤同伴
        for (const o of S.zombies) {
          if (o === z || o.dead) continue;
          if (U.dist(o.x, o.y, z.x, z.y) < C.ZOMBIE.groanAlertR * C.TILE && (o.state === 'wander' || o.state === 'dormant')) {
            o.state = 'investigate'; o.lastHeard = { x: pl.x, y: pl.y }; o.dormant = false;
          }
        }
      }
      z.lastSeen = { x: pl.x, y: pl.y }; z.loseT = 0;
    } else if (z.state === 'chase') {
      z.loseT += dt;
      if (z.loseT > C.ZOMBIE.loseSecs) { z.state = 'investigate'; }
    }

    // 听觉目标优先
    if (z.lastHeard && (z.state === 'wander' || z.state === 'dormant')) { z.state = 'investigate'; z.dormant = false; }

    // ---- 状态行为 ----
    let mvx = 0, mvy = 0, speed = 0;
    if (z.state === 'dormant') {
      // 室内沉睡：近距离动静唤醒
      if (seesP || (pl.stepNoise && dPx < C.TILE * 5)) { z.state = 'investigate'; z.dormant = false; z.lastHeard = { x: pl.x, y: pl.y }; }
    } else if (z.state === 'wander') {
      z.thinkT -= dt;
      if (z.thinkT <= 0 || U.dist(z.x, z.y, z.tx, z.ty) < C.TILE * 0.6) {
        z.thinkT = U.frange(3, 8);
        // 枪声热度偏置
        let bx = z.x, by = z.y;
        if (S.heat.length && Math.random() < 0.35) {
          const h = S.heat[S.heat.length - 1];
          if (U.dist(z.x, z.y, h.x, h.y) < 45 * C.TILE) { bx = h.x; by = h.y; }
        }
        z.tx = bx + U.frange(-6, 6) * C.TILE; z.ty = by + U.frange(-6, 6) * C.TILE;
      }
      speed = z.spd * 0.32 * spdMul;
      mvx = z.tx - z.x; mvy = z.ty - z.y;
    } else if (z.state === 'investigate') {
      const tgt = z.lastHeard;
      if (!tgt) { z.state = 'wander'; }
      else {
        const dTgt = U.dist(z.x, z.y, tgt.x, tgt.y);
        if (dTgt < C.TILE * 0.9) { z.lookT = (z.lookT || 0) + dt; z.tx = z.x; z.ty = z.y; if (z.lookT > 3) { z.lookT = 0; z.lastHeard = null; z.state = 'wander'; } }
        else { speed = z.spd * 0.62 * spdMul; mvx = tgt.x - z.x; mvy = tgt.y - z.y; }
      }
    } else if (z.state === 'chase') {
      const tgt = seesP ? pl : (z.lastSeen || pl);
      // 攻击判定
      if (seesP && dPx < C.ZOMBIE.attackRange * C.TILE * (0.9 + z.scale * 0.15)) {
        if (z.windup <= 0 && z.cdT <= 0) {
          z.windup = C.ZOMBIE.windup;
          DZ.audio.play('hiss', z.x, z.y);
        }
      } else if (z.windup <= 0) {
        speed = z.spd * spdMul * (U.isNight(S.mins) && z.type === 'sprinter' ? 1.1 : 1);
        mvx = tgt.x - z.x; mvy = tgt.y - z.y;
        // 撞墙时尝试破坏门窗
        if (speed > 0) tryBreakObstacle(S, z, mvx, mvy, pl, dt);
      }
      // 抓住玩家：持续啃咬
      if (pl.grabbedBy === z) {
        speed = 0; mvx = mvy = 0;
        if (z.biteT <= 0) {
          z.biteT = 1.25;
          DZ.audio.play('biteChomp', z.x, z.y);
          DZ.P.applyDamage(S, pl, U.pick(['armL', 'armR', 'torso']), z.dmg * 0.8, 'bite');
        }
      }
    }

    // ---- 蓄力攻击结算 ----
    if (z.windup > 0) {
      z.windup -= dt;
      z.a = U.angLerp(z.a, Math.atan2(pl.y - z.y, pl.x - z.x), dt * 6); // 锁定转向
      if (z.windup <= 0) {
        z.cdT = C.ZOMBIE.cooldown;
        const reach = C.ZOMBIE.attackRange * C.TILE + C.TILE * 0.35;
        if (!pl.dead && U.dist(z.x, z.y, pl.x, pl.y) < reach) {
          if (pl.rolling > 0) { DZ.audio.play('swing', z.x, z.y); } // 无敌帧闪避
          else {
            const hitRoll = Math.random() < (pl.crouch ? 0.55 : 0.72);
            if (hitRoll) {
              const part = U.wpick(C.BODY.parts.map(p => [p.id, p.hitW]));
              const kind = Math.random() < 0.55 ? 'scratch' : Math.random() < 0.75 ? 'laceration' : 'bite';
              DZ.P.applyDamage(S, pl, part, z.dmg * U.frange(0.85, 1.2), kind);
              // 抓握
              if (!pl.grabbedBy && kind !== 'scratch' && Math.random() < 0.38 && !pl.rolling) {
                pl.grabbedBy = z; pl.struggle = 0;
                DZ.UI && DZ.UI.toast('被抓住了！狂按 空格 挣脱！');
              } else {
                const ka = Math.atan2(pl.y - z.y, pl.x - z.x);
                const solid = W.solidFn(S);
                const [kx, ky] = U.moveCircle(pl.x, pl.y, Math.cos(ka) * 14 / z.scale, Math.sin(ka) * 14 / z.scale, 0.3 * C.TILE, solid);
                pl.x = kx; pl.y = ky; pl.stagger = 0.25;
              }
            } else DZ.audio.play('swing', z.x, z.y);
          }
        }
      }
    }

    // ---- 移动 ----
    if (mvx || mvy) {
      const ml = Math.hypot(mvx, mvy);
      z.a = U.angLerp(z.a, Math.atan2(mvy, mvx), dt * (z.state === 'chase' ? 5 : 2));
      const vx = Math.cos(z.a) * speed * C.TILE * dt, vy = Math.sin(z.a) * speed * C.TILE * dt;
      const solid = W.solidFn(S);
      const before = U.dist2(z.x, z.y, z.lpx, z.lpy);
      const [nx, ny] = U.moveCircle(z.x, z.y, vx, vy, 0.32 * z.scale * C.TILE, solid);
      z.x = nx; z.y = ny;
      z.walkPhase += dt * speed * 2;
      z.stepT -= dt * speed;
      if (z.stepT <= 0 && speed > 0.5) { z.stepT = 1.4; DZ.audio.play('step', z.x, z.y, { zomb: true }); }
      // 卡死检测
      z.stuckT += dt;
      if (z.stuckT > 0.9) {
        const moved = U.dist2(z.x, z.y, z.lpx, z.lpy);
        if (moved < (speed * C.TILE * 0.9) ** 2 * 0.02 && z.state !== 'wander') {
          // 绕行扰动
          z.a += (Math.random() < 0.5 ? 1 : -1) * 1.4;
          tryBreakObstacle(S, z, Math.cos(z.a), Math.sin(z.a), pl, dt, true);
        }
        z.stuckT = 0; z.lpx = z.x; z.lpy = z.y;
      }
    }
  };

  // 破坏门窗/木板
  function tryBreakObstacle(S, z, dx, dy, pl, dt, force) {
    const fx = z.x + Math.cos(z.a) * C.TILE * 0.9, fy = z.y + Math.sin(z.a) * C.TILE * 0.9;
    const tx = fx / C.TILE | 0, ty = fy / C.TILE | 0;
    const t = W.tget(S, tx, ty);
    const key = tx + ',' + ty, m = S.meta.get(key);
    z.bangT = (z.bangT || 0) - dt;
    if (t === T.DOOR && m && (!m.open || m.locked)) {
      if (m.locked) { /* 撬不开锁，撞门板 */ m.hp -= dt * 26 * z.scale; if (z.bangT <= 0) { z.bangT = 0.9; DZ.audio.play('doorSlam', z.x, z.y); } if (m.hp <= 0) { m.locked = false; m.open = true; DZ.CB.noise(S, z.x, z.y, C.NOISE.windowBreak * 0.6); } }
      else if (m.open) return;
    } else if ((t === T.DOOR || t === T.WIN) && m) {
      if (m.boards > 0) {
        m.boardHp = (m.boardHp || 150) - dt * 30 * z.scale;
        if (z.bangT <= 0) { z.bangT = 0.9; DZ.audio.play('hammer', z.x, z.y); }
        if (m.boardHp <= 0) { m.boardHp = 0; m.boards--; DZ.CB.noise(S, z.x, z.y, C.NOISE.hammer); }
      } else if (t === T.WIN && !m.broken) {
        m.hp -= dt * 40 * z.scale;
        if (z.bangT <= 0) { z.bangT = 0.8; DZ.audio.play('thudWood', z.x, z.y); }
        if (m.hp <= 0) { m.broken = true; DZ.audio.play('glassBreak', z.x, z.y); DZ.CB.noise(S, z.x, z.y, C.NOISE.windowBreak); }
      } else if (t === T.WIN && m.broken) {
        // 爬窗
        if (!z.climbT) z.climbT = 1.4;
        z.climbT -= dt;
        if (z.climbT <= 0) {
          z.climbT = 0;
          const dirx = (pl.x / C.TILE | 0) > tx ? 1 : -1;
          const solid = W.solidFn(S);
          let ox = tx + dirx, oy = ty;
          if (solid(tx, ty - 1) && !solid(tx, ty + 1)) { oy = ty + 1; ox = tx; }
          else if (solid(tx, ty + 1) && !solid(tx, ty - 1)) { oy = ty - 1; ox = tx; }
          z.x = (ox + .5) * C.TILE; z.y = (oy + .5) * C.TILE;
          DZ.audio.play('glassBreak', z.x, z.y);
        }
      }
    }
  }

  // 受击
  Z.damage = function (S, z, amt, opts) {
    opts = opts || {};
    if (z.dead) return false;
    if (z.type === 'tank' && !opts.explosion) amt *= 0.85;
    z.hp -= amt;
    z.flashT = 0.09;
    z.staggerT = Math.max(z.staggerT, opts.knock ? 0.35 : 0.12);
    DZ.FX.feathers(z.x, z.y, opts.head ? 10 : 5);
    DZ.audio.play('hitFlesh', z.x, z.y);
    if (z.hp <= 0) {
      if (!opts.head && !z.crawl && ['walker', 'shambler', 'jogger'].includes(z.type) && Math.random() < 0.2) {
        // 变成爬行者
        z.type = 'crawler'; z.crawl = true; z.hp = 24; z.max = 24; z.spd = 0.5; z.scale *= 0.8;
        DZ.UI && DZ.UI.floatText('它还在爬…', z.x, z.y - 20);
        return false;
      }
      z.dead = true;
      S.stats.kills++;
      if (opts.head) S.stats.headshots++;
      DZ.FX.feathers(z.x, z.y, 16);
      DZ.audio.play('feathers', z.x, z.y);
      S.corpses.push({ id: 'c' + z.id, x: z.x, y: z.y, a: z.a, scale: z.scale, loot: DZ.IT.corpseLoot(Math.random), searched: false });
      if (opts.byGun) DZ.P.xp(S, S.player, 'aiming', opts.head ? 9 : 5);
      else DZ.P.xp(S, S.player, 'strength', 6);
      return true;
    }
    // 受击反击意识
    if (z.state === 'wander' || z.state === 'dormant') { z.state = 'chase'; z.dormant = false; z.lastSeen = { x: S.player.x, y: S.player.y }; }
    return false;
  };
  DZ.Z = Z;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
