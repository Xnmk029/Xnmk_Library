/* DUCKOV Z - 战斗：射击/近战/噪音传播/爆炸/火焰 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U, W = DZ.W, T = W.T, IT = DZ.IT;
  const CB = {};

  // ---------- 噪音传播 ----------
  CB.noise = function (S, x, y, radiusTiles, loud) {
    const n = { x, y, r: radiusTiles * C.TILE, t: 0.55, loud: !!loud };
    S.noises.push(n);
    if (loud) {
      S.heat.push({ x, y, t: 180 }); // 3游戏小时的吸引热度
      if (S.heat.length > 6) S.heat.shift();
    }
    const hearMul = (S.weather.cur === 'rain' || S.weather.cur === 'storm') ? 0.75 : 1;
    for (const z of S.zombies) {
      if (z.dead) continue;
      const d = U.dist(z.x, z.y, x, y);
      if (d < n.r * hearMul * (z.crawl ? 0.7 : 1)) {
        z.lastHeard = { x: x + U.frange(-1, 1) * C.TILE, y: y + U.frange(-1, 1) * C.TILE };
        if (z.state === 'wander' || z.state === 'dormant') { z.state = 'investigate'; z.dormant = false; }
      }
    }
    return n;
  };

  // 射线检测墙
  function castWall(S, x, y, a, maxD) {
    const dx = Math.cos(a), dy = Math.sin(a);
    const steps = Math.ceil(maxD / (C.TILE * 0.3));
    for (let i = 1; i <= steps; i++) {
      const cx = x + dx * i / steps * maxD, cy = y + dy * i / steps * maxD;
      const tx = cx / C.TILE | 0, ty = cy / C.TILE | 0;
      const t = W.tget(S, tx, ty);
      if (t === T.WEXT || t === T.WINT) return { d: i / steps * maxD, x: cx, y: cy };
      const m = S.meta.get(tx + ',' + ty);
      if (m && m.t === 'door' && !m.open) return { d: i / steps * maxD, x: cx, y: cy };
    }
    return null;
  }

  // ---------- 开火 ----------
  CB.fireGun = function (S, pl) {
    const gunI = pl.slots.primary;
    if (!gunI || pl.reloadT > 0 || pl.fireT > 0 || pl.swingT > 0) return false;
    if (pl.grabbedBy) { DZ.UI && DZ.UI.toast('被抓住了！按空格挣脱！'); return false; }
    const key = IT.def(gunI.id).gun, g = C.GUNS[key];
    if (gunI.loaded <= 0) { DZ.audio.playRaw('dryfire'); DZ.P.beginReload(pl); return false; }
    gunI.loaded--;
    pl.fireT = g.rof;
    const mx = S.input.aimX, my = S.input.aimY;
    const baseA = Math.atan2(my - pl.y, pl.x != null ? mx - pl.x : 0);
    // 散布：稳瞄/技能/恐慌/移动
    let spreadDeg = pl.aiming ? g.aimSpread : g.spread;
    spreadDeg *= Math.max(0.5, 1 - (pl.sk.aiming.lv - 1) * 0.06);
    spreadDeg *= 1 + pl.panic / 160 + (S.input.mvx ? 0.5 : 0);
    DZ.audio.play('gunshot', pl.x, pl.y, key);
    CB.noise(S, pl.x, pl.y, g.noise, true);
    DZ.FX.muzzle(pl.x + Math.cos(baseA) * 22, pl.y + Math.sin(baseA) * 22, baseA);
    DZ.FX.shell(pl.x, pl.y, baseA);
    DZ.FX.shake(key === 'shotgun' ? 7 : 4);
    let anyHead = false, killed = false;
    for (let p = 0; p < g.pellets; p++) {
      const a = baseA + U.frange(-spreadDeg, spreadDeg) * Math.PI / 180;
      const wallHit = castWall(S, pl.x, pl.y, a, g.range * C.TILE);
      const maxD = wallHit ? wallHit.d : g.range * C.TILE;
      // 找最近命中僵尸（沿线采样）
      let bestZ = null, bestT = Infinity;
      for (const z of S.zombies) {
        if (z.dead) continue;
        const rel = U.dist(pl.x, pl.y, z.x, z.y);
        if (rel > maxD + 20) continue;
        const ang = Math.atan2(z.y - pl.y, z.x - pl.x);
        const off = Math.abs(U.angDiff(a, ang)) * rel;
        const rad = 16 * z.scale;
        if (off < rad && rel < bestT) { bestT = rel; bestZ = z; }
      }
      const endX = bestZ ? pl.x + Math.cos(a) * bestT : (wallHit ? wallHit.x : pl.x + Math.cos(a) * maxD);
      const endY = bestZ ? pl.y + Math.sin(a) * bestT : (wallHit ? wallHit.y : pl.y + Math.sin(a) * maxD);
      DZ.FX.tracer(pl.x + Math.cos(a) * 20, pl.y + Math.sin(a) * 20, endX, endY, g.tracer, key);
      if (bestZ) {
        let dmg = g.dmg * (1 + (pl.sk.aiming.lv - 1) * 0.05) * U.frange(0.9, 1.1);
        if (g.pellets > 1) dmg *= 1.15;
        const headChance = 0.24 + (pl.sk.aiming.lv - 1) * 0.02 + (pl.aiming ? 0.14 : 0);
        const head = Math.random() < headChance;
        if (head) dmg *= 3;
        killed = DZ.Z.damage(S, bestZ, dmg, { head, byGun: true }) || killed;
        anyHead = anyHead || head;
      } else if (wallHit) {
        // 爆炸桶？
        const btx = wallHit.x / C.TILE | 0, bty = wallHit.y / C.TILE | 0;
        if (W.tget(S, btx, bty) === T.BARREL) CB.explode(S, (btx + .5) * C.TILE, (bty + .5) * C.TILE);
        else DZ.FX.spark(wallHit.x, wallHit.y, a);
      }
    }
    if (killed && anyHead) DZ.UI && DZ.UI.floatText('爆头!', mx, my - 30, '#ffd23f');
    else if (killed) DZ.UI && DZ.UI.floatText('击杀!', mx, my - 30);
    return true;
  };

  // ---------- 近战 ----------
  CB.swingMelee = function (S, pl) {
    if (pl.swingT > 0 || pl.fireT > 0) return false;
    const wI = pl.slots.melee;
    const mel = wI ? IT.def(wI.id).mel : { dmg: 6, rng: 1.05, arc: 60, cd: 0.45, stam: 5, knock: 50, dur: Infinity };
    if (pl.stamina < mel.stam * 0.5) { DZ.audio.playRaw('dryfire'); return false; }
    pl.swingT = mel.cd;
    pl.stamina -= mel.stam;
    const reach = mel.rng * C.TILE;
    const facing = Math.atan2(S.input.aimY - pl.y, S.input.aimX - pl.x);
    DZ.audio.play('swing', pl.x, pl.y);
    let hitAny = false;
    for (const z of S.zombies) {
      if (z.dead) continue;
      const d = U.dist(pl.x, pl.y, z.x, z.y);
      if (d > reach + 14 * z.scale) continue;
      const ang = Math.atan2(z.y - pl.y, z.x - pl.x);
      if (Math.abs(U.angDiff(facing, ang)) > mel.arc * Math.PI / 360) continue;
      hitAny = true;
      const crit = Math.random() < (mel.crit || 0.08);
      let dmg = mel.dmg * (1 + (pl.sk.strength.lv - 1) * 0.05) * U.frange(0.9, 1.15) * (crit ? 1.8 : 1);
      if (pl.stamina < 25) dmg *= 0.65; // 力竭挥砍无力
      const killed = DZ.Z.damage(S, z, dmg, { knock: mel.knock, melee: true });
      if (killed) DZ.UI && DZ.UI.floatText(crit ? '暴击击杀!' : '击杀!', z.x, z.y - 26, crit ? '#ff5a49' : '#fff');
      // 击退（一次性冲量，上限22px）
      const kbp = U.clamp(mel.knock * (z.type === 'tank' ? 0.3 : 1) / 90, 0, 1) * 22;
      const solid = W.solidFn(S);
      const [nx, ny] = U.moveCircle(z.x, z.y, Math.cos(ang) * kbp, Math.sin(ang) * kbp, 0.32 * z.scale * C.TILE, solid);
      z.x = nx; z.y = ny;
      if (wI) {
        wI.cond = (wI.cond ?? 100) - 100 / mel.dur;
        if (wI.cond <= 0) {
          DZ.UI && DZ.UI.toast(IT.name(wI.id) + ' 坏掉了！');
          pl.slots.melee = null;
          DZ.audio.play('thudWood', pl.x, pl.y);
          break;
        }
      }
    }
    if (hitAny) { DZ.CB.noise(S, pl.x, pl.y, C.NOISE.meleeHit); DZ.FX.shake(2); }
    else DZ.CB.noise(S, pl.x, pl.y, C.NOISE.meleeWhiff);
    return true;
  };

  // ---------- 爆炸 ----------
  CB.explode = function (S, x, y) {
    DZ.audio.play('explode', x, y);
    DZ.FX.explosion(x, y);
    DZ.FX.shake(16);
    CB.noise(S, x, y, C.NOISE.explosion, true);
    const R = C.TILE * 3.4;
    for (const z of S.zombies) {
      if (z.dead) continue;
      const d = U.dist(z.x, z.y, x, y);
      if (d < R) DZ.Z.damage(S, z, 130 * (1 - d / R) + 30, { explosion: true });
    }
    const pd = U.dist(S.player.x, S.player.y, x, y);
    if (pd < R) {
      const part = U.pick(['torso', 'legL', 'legR']);
      DZ.P.applyDamage(S, S.player, part, 70 * (1 - pd / R), 'explosion');
    }
    // 连环引爆其他桶
    const btx = x / C.TILE | 0, bty = y / C.TILE | 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const tx = btx + dx, ty = bty + dy;
      if (W.tget(S, tx, ty) === T.BARREL) {
        S.tiles[ty * C.MW + tx] = T.RUBBLE;
        const bx = (tx + .5) * C.TILE, by = (ty + .5) * C.TILE;
        if (U.dist(bx, by, x, y) > 10) setTimeout(() => CB.explode(S, bx, by), 200 + Math.random() * 300);
      }
    }
  };

  // ---------- 投掷物（燃烧瓶） ----------
  CB.throwMolotov = function (S, pl, tx, ty) {
    const idx = pl.inv.findIndex(i => i.id === 'molotov');
    if (idx < 0) return false;
    pl.inv.splice(idx, 1);
    const d = U.dist(pl.x, pl.y, tx, ty);
    const maxR = C.TILE * 7;
    const scale = Math.min(1, d / maxR);
    DZ.FX.molotovArc(pl.x, pl.y, tx, ty, scale, () => {
      DZ.audio.play('glassBreak', tx, ty);
      DZ.FX.fireBurst(tx, ty);
      CB.noise(S, tx, ty, C.NOISE.glassBreak);
      S.fires.push({ x: tx, y: ty, fuel: 9, big: true });
    });
    return true;
  };

  // 火焰伤害 tick
  CB.tickFires = function (S, dt, gameMin) {
    const raining = S.weather.cur === 'rain' || S.weather.cur === 'storm';
    for (let i = S.fires.length - 1; i >= 0; i--) {
      const f = S.fires[i];
      f.fuel -= dt * (raining && !f.big ? 2.2 : 1) * (gameMin > 0 ? 1 : 1);
      if (f.big) f.fuel -= gameMin * 0.4;
      if (f.fuel <= 0) { S.fires.splice(i, 1); continue; }
      if (Math.random() < dt * 2) DZ.audio.play('crackle', f.x, f.y);
      const R = f.big ? C.TILE * 2.2 : C.TILE * 1.4;
      for (const z of S.zombies) {
        if (z.dead) continue;
        if (U.dist(z.x, z.y, f.x, f.y) < R) DZ.Z.damage(S, z, 34 * dt, { fire: true });
      }
      if (U.dist(S.player.x, S.player.y, f.x, f.y) < R * 0.8) DZ.P.applyDamage(S, S.player, 'legL', 20 * dt, 'explosion');
    }
  };
  DZ.CB = CB;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
