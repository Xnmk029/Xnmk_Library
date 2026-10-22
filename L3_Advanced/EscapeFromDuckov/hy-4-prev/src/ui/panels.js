// 覆盖层面板：背包 / 容器搜刮 / 武器改装（含全息预览）。
// 只读改游戏状态，不持有逻辑；所有改动都走 systems/* 的公开方法。
import { ITEMS, ITEM_CAT, itemDef } from '../data/items.js';
import { MEDICAL } from '../data/medical.js';
import { WEAPONS, ATTACHMENTS, SLOT_NAMES } from '../data/weapons.js';
import { weaponStats } from '../systems/pure/statPipeline.js';
import { PART_LABEL } from '../systems/health.js';
import { HoloPreview } from './holo.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Panels {
  constructor(game) {
    this.game = game;
    this.overlay = $('overlay');
    this.host = $('overlayHost');
    this.open = null;
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.open) { e.stopPropagation(); this.close(); }
    }, true);
  }

  close() {
    this.open = null;
    this.holo?.dispose();          // 释放第二个 GL 上下文，别让它在后台空转
    this.holo = null;
    this.overlay.classList.remove('on');
    this.host.innerHTML = '';
  }

  _win(title, bodyHtml, footHtml = '') {
    this.overlay.classList.add('on');
    this.host.innerHTML = `<div class="win" style="width:min(920px,94vw)">
      <h3>${esc(title)} <span class="x">×</span></h3>
      <div class="body">${bodyHtml}</div>
      ${footHtml ? `<div class="foot">${footHtml}</div>` : ''}
    </div>`;
    this.host.querySelector('.x').onclick = () => this.close();
  }

  // ---------------- 背包 ----------------
  showInventory() {
    this.open = 'inventory';
    const g = this.game;
    const inv = g.inventory;
    const grid = inv.grid;
    const cell = 46;
    const items = [...grid.items.values()].map((it) => {
      const def = itemDef(it.id) || {};
      return `<div class="invItem" data-uid="${it.uid}" draggable="true"
        style="left:${it.x * cell}px;top:${it.y * cell}px;width:${it.w * cell - 4}px;height:${it.h * cell - 4}px"
        title="${esc(def.name || it.id)}">
        <b>${esc((def.name || it.id).slice(0, 4))}</b>
        ${it.count > 1 ? `<i>${it.count}</i>` : ''}
      </div>`;
    }).join('');

    const equipRow = ['primary', 'secondary', 'melee', 'head', 'body', 'backpack'].map((s) => {
      const it = inv.loadout.get(s);
      const def = it ? itemDef(it.id) : null;
      return `<div class="eqSlot" data-slot="${s}">
        <span class="lbl">${{ primary: '主武器', secondary: '副武器', melee: '近战', head: '头部', body: '护甲', backpack: '背包' }[s]}</span>
        <span class="val">${def ? esc(def.name) : '空'}</span>
      </div>`;
    }).join('');

    const medRow = Object.keys(MEDICAL).filter((k) => inv.grid.countOf(k) > 0)
      .map((k) => `<button class="btn" data-use="${k}">${MEDICAL[k].icon} ${esc(MEDICAL[k].name)} ×${inv.grid.countOf(k)}</button>`).join('')
      || '<span style="color:var(--dim)">没有医疗物资</span>';

    this._win('背包 / 装备', `
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div>
          <div class="invGrid" id="invGrid" style="position:relative;width:${grid.w * cell}px;height:${grid.h * cell}px;
               background:repeating-linear-gradient(90deg,#1b232c 0 45px,#141a21 45px 46px),
                          repeating-linear-gradient(0deg,#1b232c 0 45px,#141a21 45px 46px);
               border:1px solid var(--line);border-radius:3px">
            ${items}
          </div>
          <div style="margin-top:8px;color:var(--dim)">负重 ${inv.weight.toFixed(1)} / ${inv.capacity} kg　·　${(inv.loadRatio * 100).toFixed(0)}%</div>
        </div>
        <div style="flex:1;min-width:230px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${equipRow}</div>
          <h4 style="margin:14px 0 6px;color:var(--dim);font-size:11px;letter-spacing:.1em">保险箱（死亡不掉落）</h4>
          <div class="safeGrid" style="display:grid;grid-template-columns:repeat(2,46px);gap:3px">
            ${[0, 1, 2, 3].map(() => '<div style="height:44px;border:1px solid var(--line);border-radius:2px;background:#141a21"></div>').join('')}
          </div>
          <h4 style="margin:14px 0 6px;color:var(--dim);font-size:11px;letter-spacing:.1em">快速医疗</h4>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${medRow}</div>
        </div>
      </div>`, '');

    this.host.querySelectorAll('.invItem').forEach((el) => {
      el.onclick = () => this.showItemMenu(+el.dataset.uid);
    });
    this.host.querySelectorAll('.eqSlot').forEach((el) => {
      el.onclick = () => {
        const s = el.dataset.slot;
        if (inv.loadout.get(s)) { inv.unequip(s); this.showInventory(); }
      };
    });
    this.host.querySelectorAll('[data-use]').forEach((el) => {
      el.onclick = () => {
        const uid = [...inv.grid.items.values()].find((it) => it.id === el.dataset.use)?.uid;
        if (uid == null) return;
        const r = this.game.useItemById(uid);
        this.game.toast?.(r.msg || r.reason || '', r.ok ? 'good' : 'bad');
        this.showInventory();
      };
    });
  }

  showItemMenu(uid) {
    const inv = this.game.inventory;
    const it = inv.grid.items.get(uid);
    if (!it) return;
    const def = itemDef(it.id) || {};
    const isEquip = WEAPONS[it.id] || def.cat === 'armor' || def.cat === 'backpack';
    this._win(def.name || it.id, `
      <p style="color:var(--dim);margin-bottom:10px">${esc(def.desc || ITEM_CAT[def.cat] || '')}</p>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:11px">
        <span class="k">分类</span><b>${ITEM_CAT[def.cat] || '—'}</b>
        <span class="k">单重</span><b>${def.weight ?? '?'} kg</b>
        <span class="k">价值</span><b>${def.value ?? '?'} 现金</b>
        <span class="k">占格</span><b>${(def.grid || [1, 1]).join('×')}</b>
        ${def.armorLevel ? `<span class="k">护甲等级</span><b>${def.armorLevel}</b>` : ''}
        ${def.capacity ? `<span class="k">容量</span><b>${def.capacity} kg</b>` : ''}
      </div>`,
      `${isEquip ? '<button class="btn primary" id="mEquip">装备</button>' : ''}
       <button class="btn" id="mUse">使用</button>
       <button class="btn" id="mMod">${WEAPONS[it.id] ? '改装' : '关闭'}</button>`);
    $('mEquip')?.addEventListener('click', () => { inv.equip(uid); this.showInventory(); });
    $('mUse')?.addEventListener('click', () => {
      const r = this.game.useItemById(uid);
      this.game.toast?.(r.msg || r.reason || '', r.ok ? 'good' : 'bad');
      this.close();
    });
    const mod = $('mMod');
    if (mod) mod.onclick = () => (WEAPONS[it.id] ? this.showModding(uid) : this.close());
  }

  // ---------------- 武器改装 ----------------
  showModding(uid) {
    this.open = 'modding';
    const g = this.game;
    const inv = g.inventory;
    const it = inv.grid.items.get(uid);
    if (!it || !WEAPONS[it.id]) return;
    const def = WEAPONS[it.id];
    const w = g.weaponInstance(uid);
    const base = weaponStats({ id: it.id, mods: {} }, {});
    const cur = weaponStats(w, { skills: g.skills || {} });

    const slotRow = def.slots.map((slot) => {
      const owned = Object.values(ATTACHMENTS).filter((a) => a.slot === slot && inv.grid.countOf(a.id) > 0);
      const locked = Object.values(ATTACHMENTS).filter((a) => a.slot === slot && inv.grid.countOf(a.id) <= 0);
      const curId = w.mods[slot];
      const opt = (a, have) => `<button class="btn ${curId === a.id ? 'on' : ''} ${have ? '' : 'holo'}"
        data-slot="${slot}" data-att="${a.id}" data-have="${have ? 1 : 0}"
        style="opacity:${have ? 1 : 0.62}">${esc(a.name)}${have ? '' : '（未拥有）'}</button>`;
      return `<div style="margin-bottom:10px">
        <div style="color:var(--dim);font-size:11px;margin-bottom:4px">${SLOT_NAMES[slot] || slot}</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          <button class="btn ${curId ? '' : 'on'}" data-slot="${slot}" data-att="">无</button>
          ${owned.map((a) => opt(a, true)).join('')}
          ${locked.map((a) => opt(a, false)).join('')}
        </div></div>`;
    }).join('');

    const cmp = (label, k, fmt = (v) => (+v).toFixed(1), biggerBetter = true) => {
      const b = base[k] ?? 0, c = cur[k] ?? 0;
      const d = c - b;
      const good = biggerBetter ? d > 0.001 : d < -0.001;
      const color = Math.abs(d) < 0.001 ? 'var(--dim)' : good ? 'var(--ok)' : 'var(--blood)';
      return `<div><span class="k">${label}</span><b style="color:${color}">${fmt(c)}${Math.abs(d) > 0.001 ? ` (${d > 0 ? '+' : ''}${fmt(d)})` : ''}</b></div>`;
    };

    this._win(`改装 — ${def.name}`, `
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px">${slotRow || '<span style="color:var(--dim)">该武器没有改装槽</span>'}</div>
        <div style="min-width:230px">
          <div id="holoSlot" style="width:168px;height:168px;margin:0 auto 10px;border:1px solid var(--line);border-radius:3px;background:#0a1016"></div>
          <div style="text-align:center;color:var(--dim);font-size:10px">蓝＝已有　橙＝尚未拥有（全息预览）</div>
          <h4 style="color:var(--hot);font-size:11px;letter-spacing:.1em;margin-bottom:6px">属性（括号内为配件带来的变化）</h4>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11px">
            ${cmp('伤害', 'damage')}
            ${cmp('射速', 'rpm', (v) => Math.round(v))}
            ${cmp('后坐力', 'recoil', (v) => (+v).toFixed(1), false)}
            ${cmp('人机工效', 'ergonomics', (v) => Math.round(v))}
            ${cmp('噪音', 'noise', (v) => Math.round(v), false)}
            ${cmp('有效射程', 'range', (v) => (+v).toFixed(1))}
            ${cmp('散布', 'spread', (v) => (+v).toFixed(2), false)}
            ${cmp('开镜时间', 'aimTime', (v) => (+v).toFixed(2), false)}
            ${cmp('弹匣', 'magSize', (v) => Math.round(v))}
            ${cmp('重量', 'weight', (v) => (+v).toFixed(2), false)}
          </div>
          <div style="margin-top:12px;color:var(--dim);font-size:11px">
            合成顺序：基础值 → 配件加值 → 配件乘值 → 弹药 → 技能 → Moodle → 环境 → 特质 → 钳制
          </div>
        </div>
      </div>`, '');

    // ---- 全息预览 ----
    this.holo?.dispose();
    this.holo = new HoloPreview(168);
    $('holoSlot').appendChild(this.holo.element);
    this.holo.set(it.id, w.mods);
    this.holo.start();

    const applyHolo = (slot, att) => this.holo.set(it.id, w.mods, slot, att);
    this.host.querySelectorAll('[data-slot]').forEach((el) => {
      const slot = el.dataset.slot, att = el.dataset.att;
      const owned = el.dataset.have === '1' || !att;
      // 悬停即预览（含未拥有配件），点击才真正装上
      el.onmouseenter = () => applyHolo(slot, owned ? null : att);
      el.onmouseleave = () => applyHolo(null, null);
      el.onclick = () => {
        if (att && inv.grid.countOf(att) <= 0) {
          g.toast?.('尚未拥有该配件 — 全息预览仅供查看', 'bad');
          return;
        }
        if (w.mods[slot] && w.mods[slot] !== att) inv.grid.add(w.mods[slot], 1);
        if (att) {
          const src = [...inv.grid.items.values()].find((i) => i.id === att);
          if (src) inv.grid.remove(src.uid, 1);
          w.mods[slot] = att;
        } else delete w.mods[slot];
        inv.recalc();
        this.showModding(uid);
      };
    });
  }

  // ---------------- 容器搜刮 ----------------
  showContainer(container) {
    this.open = 'container';
    const g = this.game;
    const rows = container.loot.length
      ? container.loot.map((l, i) => {
        const def = itemDef(l.id) || {};
        return `<div class="lootRow" data-i="${i}">
          <span>${esc(def.name || l.id)}</span>
          <span style="color:var(--dim)">${(def.weight ?? 0.1) * l.count}kg</span>
          <b>×${l.count}</b></div>`;
      }).join('')
      : '<div style="color:var(--dim);padding:12px 0">空的。</div>';

    this._win(container.name || '容器', `<div class="lootList">${rows}</div>`,
      `<span style="margin-right:auto;color:var(--dim);align-self:center">负重 ${g.inventory.weight.toFixed(1)}/${g.inventory.capacity}kg</span>
       <button class="btn" id="lootAll">全部拿取</button>
       <button class="btn primary" id="lootClose">关闭</button>`);

    const take = (i) => {
      const l = container.loot[i];
      if (!l) return;
      if (!g.inventory.grid.add(l.id, l.count)) { g.toast?.('背包放不下了', 'bad'); return; }
      container.loot.splice(i, 1);
      g.inventory.recalc();
      this.showContainer(container);
    };
    this.host.querySelectorAll('.lootRow').forEach((el) => { el.onclick = () => take(+el.dataset.i); });
    $('lootAll').onclick = () => {
      for (let i = container.loot.length - 1; i >= 0; i--) {
        const l = container.loot[i];
        if (g.inventory.grid.add(l.id, l.count)) container.loot.splice(i, 1);
      }
      g.inventory.recalc();
      this.close();
    };
    $('lootClose').onclick = () => this.close();
  }

  // ---------------- 身体状况 ----------------
  showHealth() {
    this.open = 'health';
    const h = this.game.health;
    const rows = Object.entries(h.body.parts).map(([k, p]) => {
      const inj = p.injuries.map((i) => `${i.name}${i.bandaged ? (i.dirty ? '（脏绷带）' : '（已包扎）') : ''}${i.stitches ? '（已缝合）' : ''}${i.splinted ? '（已固定）' : ''}${i.infected ? '（感染）' : ''}`).join('、');
      return `<div><span class="k">${PART_LABEL[k]}</span><b>${Math.round((p.hp / p.max) * 100)}%</b>
        <span style="color:var(--dim);grid-column:1/-1;font-size:10px">${inj || '—'}</span></div>`;
    }).join('');
    const s = h.summary;
    this._win('身体状况', `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;font-size:11px">
        <div><span class="k">总生命</span><b>${Math.round(h.totalPct * 100)}%</b></div>
        <div><span class="k">血量</span><b>${Math.round(h.body.blood)} ml</b></div>
        <div><span class="k">体温</span><b>${h.body.temp.toFixed(1)}℃</b></div>
        <div><span class="k">出血速率</span><b>${s.bleedRate.toFixed(2)}/h</b></div>
        <div><span class="k">未固定骨折</span><b>${s.fractures}</b></div>
        <div><span class="k">伤口感染</span><b>${h.body.infected ? '是' : '否'}</b></div>
        <div><span class="k">克诺克斯</span><b>${h.body.knox > 0 ? `${Math.round(h.body.knox * 100)}%（无解）` : '无'}</b></div>
        <div><span class="k">疼痛</span><b>${Math.round(h.body.pain * 100)}</b></div>
        <div><span class="k">恐慌</span><b>${Math.round(h.panic)}</b></div>
      </div>
      <h4 style="margin:14px 0 6px;color:var(--dim);font-size:11px;letter-spacing:.1em">部位明细</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;font-size:11px">${rows}</div>`, '');
  }
}
