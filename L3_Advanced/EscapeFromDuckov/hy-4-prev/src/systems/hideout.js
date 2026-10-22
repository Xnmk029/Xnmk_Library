// 藏身处（文档 §2.3）：五设施升级 + NPC 任务 + 局外仓库。
// 这是"搜打撤"循环的另一半 —— 没有它，带出来的物资就没有去处。
import { ITEMS, itemDef } from '../data/items.js';
import { bus } from '../core/events.js';

export const FACILITIES = {
  workbench: {
    id: 'workbench', name: '工作台', icon: '🔧', max: 3,
    desc: '解锁武器改装与弹药压装',
    cost: (lv) => ({ scrap: 6 * lv, gunpowder: 2 * lv, electronic: lv }),
    effect: (lv) => `改装槽 +${lv} · 可压装至 ${['常规', '蓝弹', '紫弹'][lv - 1] ?? '常规'}`,
  },
  kitchen: {
    id: 'kitchen', name: '厨房', icon: '🍳', max: 3,
    desc: '烹饪与净水，降低饥饿增长',
    cost: (lv) => ({ plank: 4 * lv, scrap: 3 * lv }),
    effect: (lv) => `饥饿增长 −${lv * 12}% · 可烹饪`,
  },
  gym: {
    id: 'gym', name: '健身房', icon: '🏋️', max: 3,
    desc: '提升力量与体质上限',
    cost: (lv) => ({ plank: 5 * lv, scrap: 4 * lv, protein_powder: lv }),
    effect: (lv) => `负重 +${lv * 2.5}kg · 体力恢复 +${lv * 10}%`,
  },
  medstation: {
    id: 'medstation', name: '医疗站', icon: '⛑️', max: 3,
    desc: '定期补给医疗物资',
    cost: (lv) => ({ medparts: 4 * lv, electronic: 2 * lv }),
    effect: (lv) => `每次出击前补给 ${lv} 件医疗品`,
  },
  intel: {
    id: 'intel', name: '情报中心', icon: '📡', max: 3,
    desc: '小明的据点：出售凭证与稀有货架',
    cost: (lv) => ({ electronic: 6 * lv, gpu: Math.max(1, lv - 1) }),
    effect: (lv) => `解锁 ${['1 级凭证', '3 级凭证信息', '彩色门卡'][lv - 1] ?? '—'}`,
  },
};

export const NPC = {
  jeffrey: { id: 'jeffrey', name: '老村长杰夫', icon: '🧓', desc: '新手引导，发布前期的生存与基地整备任务。' },
  mud: { id: 'mud', name: '泥巴', icon: '🦆', desc: '生存保障。给他送物资，他替你扩建厨房与健身房。' },
  xiaoming: { id: 'xiaoming', name: '小明', icon: '🧑‍🔬', desc: '技术中心与情报中心主管，掌握飞船建造进度。' },
  merchant: { id: 'merchant', name: '神秘商人', icon: '🕶️', desc: '只收现金，出售极度稀有的医疗品与图纸。免疫普通伤害。' },
};

/** 任务：每条都有明确目标、奖励与推进主线的作用 */
export const QUESTS = [
  {
    id: 'jeffrey_intro', npc: 'jeffrey', name: '站稳脚跟',
    text: '在零号区搜刮 3 个容器并成功撤离一次。',
    goal: { search: 3, extract: 1 }, reward: { cash: 120, scrap: 2 },
  },
  {
    id: 'mud_supply', npc: 'mud', name: '泥巴的补给',
    text: '给泥巴带 2 份蛋白粉，他会帮你扩建健身房。',
    goal: { item: { id: 'protein_powder', n: 2 } }, reward: { facility: 'gym', cash: 200 },
  },
  {
    id: 'merchant_meet', npc: 'merchant', name: '神秘商人',
    text: '在农场镇找到神秘商人并用现金交易一次。',
    goal: { item: { id: 'gpu', n: 1 } }, reward: { blueprint: 1, cash: 300 },
  },
  {
    id: 'xiaoming_credential', npc: 'xiaoming', name: '复制凭证',
    text: '给小明带 1 张显卡，他可以给你 1 级凭证。',
    goal: { item: { id: 'gpu', n: 1 } }, reward: { item: 'credential1' },
  },
  {
    id: 'final_spacecraft', npc: 'xiaoming', name: '星际飞船',
    text: '集齐飞船图纸与燃料，修复飞船。',
    goal: { item: { id: 'spacecraftBp', n: 1 } }, reward: { ending: 'perfect' },
  },
];

export class Hideout {
  constructor(game, saved = null) {
    this.game = game;
    this.levels = { workbench: 1, kitchen: 1, gym: 0, medstation: 1, intel: 1 };
    this.stash = [];                 // 局外仓库：[{id, n}]
    this.quests = {};                // id → {done, progress}
    this.cash = 250;
    if (saved) this.deserialize(saved);
  }

  level(id) { return this.levels[id] ?? 0; }

  /** 升级设施：从仓库扣材料 */
  upgrade(id) {
    const f = FACILITIES[id];
    if (!f) return { ok: false, reason: '没有这个设施' };
    const lv = this.level(id);
    if (lv >= f.max) return { ok: false, reason: '已满级' };
    const cost = f.cost(lv + 1);
    for (const k in cost) {
      if (this.count(k) < cost[k]) return { ok: false, reason: `${itemDef(k)?.name ?? k} 不足（需 ${cost[k]}）` };
    }
    for (const k in cost) this.take(k, cost[k]);
    this.levels[id] = lv + 1;
    bus.emit('hideout:upgraded', { id, level: lv + 1 });
    return { ok: true, level: lv + 1 };
  }

  count(id) { return this.stash.filter((s) => s.id === id).reduce((n, s) => n + s.n, 0); }
  give(id, n = 1) {
    const def = itemDef(id);
    const stack = def?.stack ?? (def?.cat === 'ammo' ? 999 : 9999);
    let left = n;
    const slot = this.stash.find((s) => s.id === id && s.n < stack);
    if (slot) { const take = Math.min(left, stack - slot.n); slot.n += take; left -= take; }
    while (left > 0) {
      const take = Math.min(left, stack);
      this.stash.push({ id, n: take });
      left -= take;
    }
  }
  take(id, n = 1) {
    let left = n;
    for (let i = this.stash.length - 1; i >= 0 && left > 0; i--) {
      if (this.stash[i].id !== id) continue;
      const take = Math.min(left, this.stash[i].n);
      this.stash[i].n -= take;
      left -= take;
      if (this.stash[i].n <= 0) this.stash.splice(i, 1);
    }
    return n - left;
  }

  /** 出击前：医疗站按等级发放补给 */
  supplyBeforeRaid() {
    const lv = this.level('medstation');
    const kit = { 1: ['bandage'], 2: ['bandage', 'painkillers'], 3: ['bandage', 'painkillers', 'medkit'] }[lv] || [];
    for (const k of kit) this.game.inventory.addItem(k, 1);
    return kit;
  }

  /** 任务进度检查 */
  checkQuests() {
    const g = this.game;
    for (const q of QUESTS) {
      const st = this.quests[q.id] || (this.quests[q.id] = { done: false, progress: {} });
      if (st.done) continue;
      const goal = q.goal;
      let ok = true;
      if (goal.search) ok = ok && (g.searched || 0) >= goal.search;
      if (goal.extract) ok = ok && (g.extractedCount || 0) >= goal.extract;
      if (goal.item) {
        ok = ok && this.count(goal.item.id) >= goal.item.n;
        st.progress.item = Math.min(this.count(goal.item.id), goal.item.n);
      }
      st.progress.search = g.searched || 0;
      if (!ok) continue;
      st.done = true;
      this.grantReward(q);
      bus.emit('quest:done', q);
    }
  }

  grantReward(q) {
    const r = q.reward || {};
    if (r.cash) this.cash += r.cash;
    if (r.facility) this.levels[r.facility] = Math.min(FACILITIES[r.facility].max, this.level(r.facility) + 1);
    if (r.item) this.give(r.item, 1);
    if (r.blueprint) this.give('blueprint', r.blueprint);
    if (r.ending) this.pendingEnding = r.ending;
  }

  serialize() {
    return { levels: this.levels, stash: this.stash, quests: this.quests, cash: this.cash };
  }
  deserialize(s) {
    if (s.levels) Object.assign(this.levels, s.levels);
    if (Array.isArray(s.stash)) this.stash = s.stash;
    if (s.quests) this.quests = s.quests;
    if (typeof s.cash === 'number') this.cash = s.cash;
  }
}

/** 神秘商人：只收现金，库存稀有 */
export function merchantStock(rng, intelLevel = 1) {
  const pool = [
    { id: 'recovery_syringe', price: 420 },
    { id: 'surgery_kit', price: 380 },
    { id: 'armor3', price: 900 },
    { id: 'ammo_556_purple', price: 520 },
    { id: 'blueprint', price: 1400 },
    { id: 'credential1', price: 1100 },
    { id: 'keycardRed', price: 800 },
    { id: 'spacecraftBp', price: 5000, minIntel: 3 },
  ].filter((p) => (p.minIntel ?? 1) <= intelLevel);
  return rng.shuffle(pool).slice(0, 4);
}
