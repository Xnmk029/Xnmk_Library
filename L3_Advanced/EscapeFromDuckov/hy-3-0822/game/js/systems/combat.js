// ============================================================
//  combat.js — 战斗系统
//  子弹/护甲公式/近战/爆炸/伤害结算
//  护甲公式：实际伤害 = 基础伤害 × 2 / (护甲等级 - 子弹穿透等级 + 2)
// ============================================================
import { rng, clamp, normAng } from '../core/util.js';
import { raycastSolid } from '../world/pathfind.js';
import { itemDef } from '../data/items.js';
import { TRACER } from '../core/palette.js';
import { takeItems, countOf, addItem } from './inventory.js';
import { PART_IDS, randomPart } from './body.js';
import { emitNoise } from './vision.js';

const BULLET_SPEED = 30;

function armorScale(base, armorTier, pen) {
  let denom = armorTier - pen + 2;
  if (denom < 1.5) denom = 1.5;
  return base * (2 / denom);
}

function tracerOf(tier) { return TRACER[tier] || '#ffe08a'; }

// ---------------- 抛射物 ----------------
function spawnBullet(game, x, y, ang, opt) {
  const sp = opt.speed ?? BULLET_SPEED;
  game.projectiles.push({
    kind: 'bullet', x, y,
    vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
    dmg: opt.dmg, pen: opt.pen ?? 1, range: opt.range ?? 14, life: opt.range ?? 14,
    faction: opt.faction, tracer: opt.tracer || '#fff', from: opt.from, ang,
  });
}

function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}

function bulletCanHit(p, ent) {
  if (ent.immune) return false;
  if (p.faction === 'player') return !!ent.isEnemy;
  // 敌方子弹：打玩家；拾荒鸭也会误伤尸群
  if (ent.isPlayer) return true;
  if (ent.faction === 'zed') return true;
  return false;
}

function explode(game, x, y, radius, dmg, opts = {}) {
  const lv = game.level;
  // 敌人
  for (const e of game.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > radius) continue;
    const falloff = 1 - d / radius;
    const part = randomPart(rng, false);
    const head = part === 'head';
    applyDamageToEnemy(game, e, dmg * falloff * (head ? 1.6 : 1), part, { pen: opts.pen ?? 3, knock: 4 * falloff, from: opts.from || 'player' });
  }
  // 玩家
  const P = game.player;
  if (P && !P.body.dead) {
    const d = Math.hypot(P.x - x, P.y - y);
    if (d <= radius) {
      const falloff = 1 - d / radius;
      applyDamageToPlayer(game, dmg * falloff, randomPart(rng, false), { pen: opts.pen ?? 3, knock: 4 * falloff });
    }
  }
  // 结构
  const r = Math.ceil(radius);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (i * i + j * j > radius * radius) continue;
    const tx = (x | 0) + i, ty = (y | 0) + j;
    if (!lv.inB(tx, ty)) continue;
    if (rng.chance(0.5)) lv.damageStruct(tx, ty, 18, 'boom', rng);
  }
  // 火
  if (opts.fire) game.fires.push({ x, y, r: radius * 0.7, life: opts.fireLife || 9, max: opts.fireLife || 9 });
  emitNoise(game, x, y, 26, 'boom');
  game.particles.push({ kind: 'boom', x, y, r: radius, life: 0.45, max: 0.45 });
  game.shake = Math.min(14, (game.shake || 0) + radius * 0.6);
}

export function throwItem(game, shooter, item, ang) {
  const def = itemDef(item.id);
  const sp = 15;
  game.projectiles.push({
    kind: 'throw', x: shooter.x, y: shooter.y,
    vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
    life: def.fuse ?? 1.1, fuse: def.fuse ?? 1.1,
    faction: shooter.isPlayer ? 'player' : 'enemy',
    boom: def.boom || 50, radius: def.blast || 3.2, fire: def.fire || 0, from: shooter.isPlayer ? 'player' : 'enemy',
    item: item.id,
  });
  emitNoise(game, shooter.x, shooter.y, 8, 'throw');
}

export function updateProjectiles(game, dt) {
  const lv = game.level;
  const out = [];
  for (const p of game.projectiles) {
    const ox = p.x, oy = p.y;
    if (p.kind === 'throw') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt;
      // 落地/撞墙即炸
      const tx = p.x | 0, ty = p.y | 0;
      const hitWall = lv.inB(tx, ty) && lv.solid[lv.i(tx, ty)];
      if (p.life <= 0 || hitWall) {
        explode(game, p.x, p.y, p.radius, p.boom, { from: p.from, fire: p.fire, pen: 3 });
        continue;
      }
      out.push(p); continue;
    }
    // 子弹
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    const dx = p.x - ox, dy = p.y - oy;
    const seg = Math.hypot(dx, dy);
    let blocked = false;
    if (seg > 0) {
      const hit = raycastSolid(lv, ox, oy, dx / seg, dy / seg, seg);
      if (hit.hit && hit.dist <= seg) {
        p.x = hit.x; p.y = hit.y; blocked = true;
        game.particles.push({ kind: 'spark', x: hit.x, y: hit.y, life: 0.18, max: 0.18, ang: p.ang });
      }
    }
    // 命中实体
    let hitEnt = null;
    if (!blocked) {
      const cand = p.faction === 'player' ? game.enemies : [...game.enemies, game.player];
      for (const e of cand) {
        if (e.dead) continue;
        if (!bulletCanHit(p, e)) continue;
        const rad = (e.size || 0.42);
        if (pointSegDist(e.x, e.y, ox, oy, p.x, p.y) <= rad) { hitEnt = e; break; }
      }
    }
    if (hitEnt) {
      const part = randomPart(rng, false);
      const head = part === 'head';
      if (hitEnt.isPlayer) {
        applyDamageToPlayer(game, p.dmg * (head ? 1.6 : 1), part, { pen: p.pen, knock: 1.2 });
      } else {
        applyDamageToEnemy(game, hitEnt, p.dmg * (head ? 1.6 : 1), part, { pen: p.pen, knock: 1.2, from: p.faction });
      }
      game.particles.push({ kind: 'blood', x: hitEnt.x, y: hitEnt.y, life: 0.4, max: 0.4 });
      continue;
    }
    if (blocked || p.life <= 0) {
      if (blocked) game.particles.push({ kind: 'spark', x: p.x, y: p.y, life: 0.15, max: 0.15 });
      continue;
    }
    out.push(p);
  }
  game.projectiles = out;
}

// ---------------- 开枪 ----------------
export function fireGun(game, shooter, weapon, ang, opts = {}) {
  const def = weapon.def || itemDef(weapon.id);
  if (!def || (def.t !== 'gun' && def.cls !== 'gun')) return false;
  if ((weapon.extra?.mag ?? 0) <= 0) return false;
  if (shooter.fireCd > 0) return false;
  const spread = (def.spread + (shooter.recoil || 0) * 60 + (shooter.sneaking ? -1.5 : 0)) * Math.PI / 180;
  const jitter = (rng.next() - 0.5) * 2 * spread;
  const a = ang + jitter + (shooter.recoil || 0);
  const ammoDef = def.ammo ? itemDef(def.ammo) : null;
  const tier = weapon.ammoTier || (ammoDef ? ammoDef.tier : 1);
  spawnBullet(game, shooter.x, shooter.y, a, {
    dmg: def.dmg, pen: tier, range: def.rangeT, faction: shooter.isPlayer ? 'player' : 'enemy',
    tracer: tracerOf(tier), from: shooter.isPlayer ? 'player' : 'enemy', speed: opts.speed,
  });
  weapon.extra.mag -= 1;
  if (weapon.loaded !== undefined) weapon.loaded = weapon.extra.mag;
  shooter.fireCd = 60 / def.rpm;
  shooter.recoil = clamp((shooter.recoil || 0) + def.recoil * 0.02, 0, 0.42);
  emitNoise(game, shooter.x, shooter.y, def.noise);
  game.particles.push({ kind: 'muzzle', x: shooter.x, y: shooter.y, ang: a, life: 0.06, max: 0.06 });
  if (shooter.isPlayer) game.shake = Math.min(8, (game.shake || 0) + def.recoil * 0.4);
  return true;
}

export function startReload(game, shooter, weapon) {
  const def = itemDef(weapon.id);
  if (!def || def.cls !== 'gun') return false;
  if ((weapon.extra?.mag ?? 0) >= def.mag) return false;
  if (shooter.reloadT > 0) return false;
  const need = def.mag - (weapon.extra?.mag ?? 0);
  if (countOf(shooter.inv, def.ammo) <= 0) return false;
  shooter.reloadT = def.reload / Math.max(0.5, 1 + (shooter.skills?.get?.('reload') || 0) * 0.05);
  shooter.reloadWpn = weapon;
  return true;
}
export function finishReload(game, shooter) {
  const w = shooter.reloadWpn; if (!w) return;
  const def = itemDef(w.id);
  const need = def.mag - (w.extra?.mag ?? 0);
  const got = takeItems(shooter.inv, def.ammo, need);
  w.extra.mag = (w.extra?.mag ?? 0) + got;
  if (w.loaded !== undefined) w.loaded = w.extra.mag;
  shooter.reloadT = 0; shooter.reloadWpn = null;
}

// ---------------- 近战 ----------------
export function meleeSwing(game, src, dmg, reach, ang, fov, opts = {}) {
  const targets = src.isPlayer ? game.enemies : [...game.enemies, game.player];
  let hitAny = false;
  for (const e of targets) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - src.x, e.y - src.y);
    if (d > reach + (e.size || 0.4)) continue;
    const a = Math.atan2(e.y - src.y, e.x - src.x);
    let da = Math.abs(normAng(a - ang));
    if (da > fov) continue;
    const part = randomPart(rng, false);
    const head = part === 'head';
    if (e.isPlayer) applyDamageToPlayer(game, dmg * (head ? 1.5 : 1), part, { pen: 1, knock: 2.4 });
    else applyDamageToEnemy(game, e, dmg * (head ? 1.5 : 1), part, { pen: 1, knock: 2.4, from: src.isPlayer ? 'player' : 'enemy' });
    game.particles.push({ kind: 'feather', x: e.x, y: e.y, life: 0.6, max: 0.6 });
    hitAny = true;
  }
  return hitAny;
}

// ---------------- 伤害结算 ----------------
export function applyDamageToEnemy(game, e, dmg, part, opts = {}) {
  if (e.dead || e.immune) return;
  let d = dmg;
  const head = part === 'head';
  d = armorScale(d, head ? 0 : (e.armor || 0), opts.pen ?? 1);
  d = Math.max(0, d);
  e.hp -= d;
  // 出血概率
  if (rng.chance(0.18 + (e.armor > 0 ? 0.1 : 0))) e.bleed = (e.bleed || 0) + 0.4;
  if (opts.knock) {
    const a = Math.atan2(e.y - (opts.from === 'player' ? game.player.x : 0), e.x - (opts.from === 'player' ? game.player.y : 0));
    e.vx += Math.cos(a) * opts.knock * 0.4; e.vy += Math.sin(a) * opts.knock * 0.4;
  }
  e.alert = 1; e.seenT = game.time;
  e.lastSeen = { x: game.player.x, y: game.player.y };
  if (e.hp <= 0) { e.dead = true; e.deathT = game.time; e.deathCause = 'killed'; }
}

const PART_ARMOR = { head: 'helm', torso: 'vest', l_arm: 'vest', r_arm: 'vest', l_fore: 'vest', r_fore: 'vest' };
export function applyDamageToPlayer(game, dmg, part, opts = {}) {
  const P = game.player; if (!P || P.body.dead) return;
  const armorTier = PART_ARMOR[part] ? (itemDef(P.eq[PART_ARMOR[part]]?.id)?.level || 0) : 0;
  let d = armorScale(dmg, armorTier, opts.pen ?? 1);
  d = Math.max(0.5, d);
  P.body.damage(part, d, { bleed: rng.chance(0.25), bite: opts.bite });
  if (opts.knock) { P.vx += Math.cos(P.facing) * 0; } // 轻推由速度处理
  game.fxDamage(0.5 + Math.min(0.5, d / 30));
  game.shake = Math.min(10, (game.shake || 0) + Math.min(6, d / 5));
  if (P.body.dead) game.onPlayerDead('伤重不治');
}
