import { RECIPES, ITEMS } from './items.js';
import { clamp } from './util.js';

// ================= 制作系统 =================
export class Crafting {
  constructor(game) { this.game = game; this.active = null; }
  canCraft(r) {
    const p = this.game.player;
    if (!r) return { ok: false, reason: '' };
    for (const ing of r.inp) {
      const have = p.countItem(ing.id) + (ing.keep ? 0 : 0);
      if (have < ing.n) return { ok: false, reason: '缺少 ' + ITEMS[ing.id].name + ' ×' + ing.n };
    }
    if (r.tools) for (const t of r.tools) if (!p.hasTool(t)) return { ok: false, reason: '需要工具：' + (t === 'nails' ? '钉子' : t === 'plank' ? '木板' : t) };
    return { ok: true };
  }
  craft(r) {
    const g = this.game, p = g.player;
    const chk = this.canCraft(r);
    if (!chk.ok) { g.toast(chk.reason, 'warn'); return; }
    if (this.active) return;
    this.active = r;
    g.ui.startCraftBar(r);
    const time = r.time * (1 - p.stats.skills.carpentry.lvl * 0.03);
    setTimeout(() => {
      if (!this.active) return;
      this.active = null;
      // 消耗
      for (const ing of r.inp) {
        if (ing.keep) continue;
        let left = ing.n;
        while (left > 0) {
          const st = p.inv.find(i => i.item.id === ing.id && i.n > 0);
          if (!st) break;
          const take = Math.min(st.n, left);
          st.n -= take; left -= take;
          if (st.n <= 0) p.inv.splice(p.inv.indexOf(st), 1);
        }
      }
      // 产出
      for (const out of r.out) {
        if (out.place) {
          // 放置篝火
          g.world.addFire({ x: p.x, z: p.z, lit: false, fuel: 0 });
          g.toast('🔥 搭建了营火', 'good');
        } else if (out.special) {
          // 修理当前武器
          const h = p.held;
          if (h && h.item.maxCond) {
            h.item.cond = clamp((h.item.cond || 0) + 35, 0, h.item.maxCond);
            g.toast('🔧 武器耐久 +35%', 'good');
          } else g.toast('没有可修理的武器', 'warn');
        } else {
          p.giveItem(out.id, out.n);
        }
      }
      if (r.xp) for (const [sk, amt] of Object.entries(r.xp)) p.stats.addXp(sk, amt);
      g.ui.refreshCraft();
      g.ui.invDirty = true;
    }, time * 1000);
  }
}
