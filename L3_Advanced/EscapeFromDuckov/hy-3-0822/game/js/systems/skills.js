// ============================================================
//  skills.js — 技能与经验（僵毁式：行动中成长）
// ============================================================
export const SKILL_IDS = [
  'cooking', 'carpentry', 'mechanics', 'doctor',
  'fitness', 'aiming', 'reload', 'sneak',
  'scavenging', 'electric',
];
export const SKILL_NAME = {
  cooking: '烹饪', carpentry: '木工', mechanics: '机械',
  doctor: '医疗', fitness: '体能', aiming: '瞄准',
  reload: '换弹', sneak: '潜行', scavenging: '搜刮', electric: '电工',
};

export class Skills {
  constructor() {
    this.xp = {}; this.lvl = {};
    for (const s of SKILL_IDS) { this.xp[s] = 0; this.lvl[s] = 0; }
  }
  need(id) { return Math.round(50 * Math.pow(1.16, this.lvl[id])); }
  add(id, amount) {
    if (!this.lvl[id] && this.lvl[id] !== 0) return;
    this.xp[id] += amount;
    let leveled = 0;
    while (this.xp[id] >= this.need(id)) {
      this.xp[id] -= this.need(id);
      this.lvl[id]++; leveled++;
    }
    return leveled;
  }
  level(id) { return this.lvl[id] | 0; }
  // 用于 body.update 的技能查询
  get(id) { return this.lvl[id] | 0; }
  toJSON() { return { xp: { ...this.xp }, lvl: { ...this.lvl } }; }
  load(o) { if (!o) return; for (const s of SKILL_IDS) { this.xp[s] = o.xp?.[s] || 0; this.lvl[s] = o.lvl?.[s] || 0; } }
}
