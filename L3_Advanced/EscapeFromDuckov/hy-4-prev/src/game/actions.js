// 系统间接线：把"事件"翻译成"后果"。
// 放在 main.js 之外，是为了让主文件只负责装配与循环，而不是塞满业务逻辑。
import { bus } from '../core/events.js';
import { castRay } from '../systems/vision.js';
import { showDeath, showExtract, showEnding, showHideout, toast } from '../ui/screens.js';
import { itemDef } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';

const WEAPONS_MELEE = new Set(Object.values(WEAPONS).filter((w) => w.melee).map((w) => w.id));

/** 注册所有跨系统监听。每个监听者抛错都会被 Bus 兜住，不会拖垮主循环。 */
export function wireEvents(game) {
  bus.on('weapon:fired', (e) => {
    game.tracers.muzzleFlash(e.x, e.z, e.aim);
    game.particles?.muzzleSparks(e.x, e.z, e.aim);
    if (!WEAPONS_MELEE.has(game.equipped?.id)) game.particles?.ejectShell(e.x, e.z, e.aim);
  });

  // 命中反馈：打鸭子爆羽毛、打硬物溅火花（文档 §4.2 —— 用羽毛替代血腥）
  bus.on('fx:impact', ({ x, z, kind }) => {
    if (kind === 'duck') game.particles?.burstFeathers(x, z, 12);
    else game.particles?.burstImpact(x, z, kind === 'metal' ? 'metal' : 'wall', 7);
  });
  bus.on('weapon:dry', () => toast('弹匣已空 — 按 R 装填', 'bad'));
  bus.on('weapon:jam', () => { toast('卡壳！', 'bad'); if (game.equipped) game.equipped.mag++; });
  bus.on('weapon:reloaded', () => toast('装填完毕', 'good'));

  bus.on('enemy:died', (e) => {
    game.corpses.push(new game.CorpseCls(e.x, e.z, e));
    game.kills = (game.kills || 0) + 1;
    toast(`击倒 ${e.def.name}`, 'good');
  });

  bus.on('enemy:attack', ({ enemy, target, damage }) => {
    if (target !== game.player || !game.player.alive) return;
    if (game.player.invulnerable) { toast('闪避！', 'good'); return; }
    hurtPlayer(game, damage, enemy);
  });

  bus.on('enemy:shoot', ({ enemy, target }) => {
    const r = enemy.def.ranged;
    if (!r) return;
    const a = Math.atan2(target.x - enemy.x, target.z - enemy.z)
      + ((Math.random() - 0.5) * r.spread * Math.PI) / 90;
    const dx = Math.sin(a), dz = Math.cos(a);
    const wall = castRay(game.world, enemy.x, enemy.z, dx, dz, r.range);
    const d = Math.hypot(target.x - enemy.x, target.z - enemy.z);
    game.combat.tracers.push({
      x0: enemy.x, z0: enemy.z,
      x1: enemy.x + dx * Math.min(wall, r.range),
      z1: enemy.z + dz * Math.min(wall, r.range),
      life: 0.09, max: 0.09, color: 0xff8a4a,
    });
    if (wall >= d && !game.player.invulnerable) hurtPlayer(game, r.damage, enemy);
  });

  // 撤离：物资入库 → 推进任务 → 落盘
  bus.on('raid:extracted', ({ exit }) => {
    toast(`从${exit?.name ?? '撤离点'}成功撤离`, 'good');
    game.extractedCount = (game.extractedCount || 0) + 1;
    onExtracted(game);
  });
  bus.on('raid:overtime', () => toast('超过撤离时限 —— 尸潮开始涌入', 'bad'));
  bus.on('world:chopper', () => toast('直升机在上空盘旋，它会把尸群引向你', 'bad'));
  bus.on('weather:changed', (w) => toast(`天气转为${w.name}`, ''));

  // 伤病事件播报：这些提示本身就是玩法信息（不告诉玩家，他不会知道自己在流血）
  bus.on('health:event', (e) => {
    if (e.type === 'bandageDirty') toast('绷带脏了 — 尽快更换，否则必感染', 'bad');
    if (e.type === 'woundInfected') toast('伤口感染了 — 需要抗生素', 'bad');
    if (e.type === 'infectionCleared') toast('感染已清除', 'good');
    if (e.type === 'healed') toast('伤口愈合', 'good');
  });
  bus.on('health:knox', () => toast('你感到一阵反胃……（克诺克斯病毒，无解）', 'bad'));
  bus.on('health:died', (e) => {
    if (game.player.alive) { game.player.alive = false; onPlayerDied(game, null, e?.type === 'zombified'); }
  });
  bus.on('health:castCancel', (e) => toast(e.reason, 'bad'));
  bus.on('health:castDone', (e) => { if (e.msg) toast(e.msg, e.ok ? 'good' : 'bad'); });
}

/**
 * 玩家受伤 → 落到部位伤病系统。
 * 僵毁式：伤害不是扣总血条，而是制造伤口；咬伤 100%、撕裂 25%、抓伤 7% 感染克诺克斯病毒。
 */
export function hurtPlayer(game, amount, source) {
  const p = game.player;
  const part = pickHitPart(game, source);
  const h = game.health;
  const armor = game.inventory?.loadout.armorLevel ?? 0;
  const dmg = amount * (1 - Math.min(0.75, armor * 0.12));
  const type = source?.def?.boss ? 'laceration'
    : Math.random() < 0.22 ? 'bite'
      : Math.random() < 0.5 ? 'laceration' : 'scratch';
  h.damage(dmg, part, type, { armorReduce: armor * 0.12, hpLoss: dmg * 0.35 });
  game.playerView.flash(0.8);
  game.rig.addShake(0.22);
  game.damageNumbers.push({ x: p.x + 0.5, z: p.z, v: -Math.round(dmg), life: 0.9 });
}

function pickHitPart(game, source) {
  const a = Math.atan2((source?.x ?? 0) - game.player.x, (source?.z ?? 0) - game.player.z);
  const right = Math.sin(a - game.player.facing) > 0;
  const r = Math.random();
  if (r < 0.12) return 'head';
  if (r < 0.20) return 'neck';
  if (r < 0.52) return r < 0.36 ? 'torso_up' : 'torso_low';
  if (r < 0.76) return right ? 'arm_r' : 'arm_l';
  return right ? 'leg_r' : 'leg_l';
}

export function onPlayerDied(game, source, knox = false) {
  game.running = false;
  game.loop.paused = true;
  toast(knox ? '病毒发作 — 你倒了下去' : `你被${source?.def?.name ?? '敌人'}击倒了`, 'bad');
  setTimeout(() => (knox ? showEnding('zombified') : showDeath(game, source, knox)), 700);
}

/**
 * 撤离成功：按鸭科夫规则，带出来的物资全部入库；死亡则反之（仅留近战槽与保险箱）。
 * 入库后立即落盘 —— 玩家最不能接受的就是"刚撤离就丢档"。
 */
export function onExtracted(game) {
  game.running = false;
  game.loop.paused = true;
  let value = 0;
  const inv = game.inventory;
  for (const it of [...inv.grid.items.values()]) {
    value += (itemDef(it.id)?.value ?? 0) * (it.count || 1);
    game.hideout.give(it.id, it.count || 1);
    inv.grid.remove(it.uid, Infinity);
  }
  // 装备一并带回（活着撤离不掉装备）
  for (const s of ['primary', 'secondary', 'melee', 'head', 'body', 'backpack']) {
    const it = inv.loadout.get(s);
    if (it) { game.hideout.give(it.id, it.count || 1); inv.loadout.set(s, null); }
  }
  game.hideout.cash += Math.round(value * 0.25);
  game.hideout.checkQuests();
  game.saveNow?.();
  showExtract(game, value, () => showHideout(game, () => game.startRun()));
}

/** 阵亡：只保留近战武器槽与保险箱内的物品（鸭科夫死亡惩罚） */
export function applyDeathPenalty(game) {
  const inv = game.inventory;
  const keepMelee = inv.loadout.get('melee');
  const keepSafe = [...inv.safe.items.values()].map((s) => ({ id: s.id, n: s.n }));
  for (const it of [...inv.grid.items.values()]) inv.grid.remove(it.uid, Infinity);
  for (const s of ['primary', 'secondary', 'head', 'body', 'backpack']) inv.loadout.set(s, null);
  for (const k of keepSafe) game.hideout.give(k.id, k.n);
  if (keepMelee) game.hideout.give(keepMelee.id, keepMelee.count || 1);
  inv.recalc();
  game.saveNow?.();
  return { keptMelee: keepMelee?.id ?? null, keptSafe: keepSafe.length };
}
