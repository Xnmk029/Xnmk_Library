// ============================================================
// hud.js — 战术 HUD（Moodle 状态列 / 部位健康 / 小地图 / 弹药 / Boss）
// ============================================================
'use strict';
const HUD = {
  moodleRects: [],

  draw(dt) {
    const ctx = G.hudCtx;
    ctx.clearRect(0, 0, G.vw, G.vh);
    if (G.state !== 'raid' || !G.player) return;
    const p = G.player;
    this._crosshair(ctx);
    this._moodles(ctx, p);
    this._vitals(ctx, p);
    this._hotbar(ctx, p);
    this._topbar(ctx);
    this._minimap(ctx);
    this._bossbar(ctx);
    this._prompts(ctx, p);
  },

  _crosshair(ctx) {
    const p = G.player;
    const w = Ent.activeWeapon(p);
    const mx = Input.mouse.x, my = Input.mouse.y;
    if (G.uiOpen) return;
    let spread = 10;
    if (w.d && w.d.cat === 'gun') {
      const gs = Ent.gunStats(p, w.it);
      spread = 8 + gs.spread * 2.2 + p.bloom * 5 + (p.panic > 40 ? p.panic / 12 : 0) + (p.moving ? 8 : 0);
      if (Input.mouse.rdown) spread *= 0.6;
    }
    ctx.strokeStyle = 'rgba(240,200,120,0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(mx, my, U.clamp(spread, 6, 60), 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 4, my); ctx.lineTo(mx + 4, my); ctx.moveTo(mx, my - 4); ctx.lineTo(mx, my + 4); ctx.stroke();
    if (G.hitMark > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${G.hitMark * 6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx - 7, my - 7); ctx.lineTo(mx - 3, my - 3);
      ctx.moveTo(mx + 7, my + 7); ctx.lineTo(mx + 3, my + 3);
      ctx.moveTo(mx - 7, my + 7); ctx.lineTo(mx - 3, my + 3);
      ctx.moveTo(mx + 7, my - 7); ctx.lineTo(mx + 3, my - 3);
      ctx.stroke();
      G.hitMark = Math.max(0, G.hitMark - 1 / 60);
    }
  },

  _moodles(ctx, p) {
    const ms = Sys.Needs.moodles(p);
    const EM = {
      hunger: '🍗', thirst: '💧', fatigue: '💤', panic: '❗', stress: '🌀', pain: '🤕', bored: '🕑',
      unhappy: '😒', sick: '🤢', bleed: '🩸', fracture: '🦴', bandaged: '🩹', wet: '💦', cold: '🤧',
      drunk: '🍺', overweight: '🫨', infected: '☣️', buff_wt: '💪', buff_pk: '💊', buff_syr: '💉'
    };
    const LVC = ['', '#7fbf5a', '#d8c84a', '#e89a3a', '#e5484d'];
    this.moodleRects = [];
    let y = G.vh / 2 - ms.length * 15;
    for (const m of ms) {
      const r = 13;
      const x = G.vw - 44;
      ctx.fillStyle = 'rgba(10,15,20,0.72)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = m.lv === 1 ? '#3b6b3b' : LVC[Math.min(4, m.lv + 1)];
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '14px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(EM[m.id] || '❓', x, y + 1);
      // 等级点
      for (let i = 0; i < m.lv; i++) {
        ctx.fillStyle = LVC[Math.min(4, m.lv + 1)];
        ctx.beginPath(); ctx.arc(x - 12 + i * 5, y + r + 3, 1.8, 0, 7); ctx.fill();
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      this.moodleRects.push({ x: x - r, y: y - r, w: r * 2, h: r * 2, m });
      y += 34;
    }
  },

  _vitals(ctx, p) {
    const x = 18, y = G.vh - 128;
    // 生命：鸭体部位图
    const hpOf = pt => U.clamp(p.parts[pt].hp / 100, 0, 1);
    const colOf = k => {
      const pt = p.parts[k];
      if (pt.bleed > 0 && !pt.bandaged && Math.sin(Render.t * 6) > 0) return '#e5484d';
      const h = hpOf(k);
      return h > 0.7 ? '#5aa860' : h > 0.4 ? '#c9b44a' : h > 0.15 ? '#d08040' : '#c04040';
    };
    const parts = [
      ['head', x + 18, y, 14, 14],
      ['torso', x + 8, y + 16, 34, 26],
      ['larm', x - 6, y + 16, 12, 22],
      ['rarm', x + 46, y + 16, 12, 22],
      ['lleg', x + 10, y + 44, 12, 26],
      ['rleg', x + 28, y + 44, 12, 26]
    ];
    ctx.fillStyle = 'rgba(10,15,20,0.66)';
    this._rr2(ctx, x - 14, y - 8, 84, 88, 8); ctx.fill();
    ctx.strokeStyle = '#2b3a46'; ctx.stroke();
    for (const [k, px, py, w, h] of parts) {
      ctx.fillStyle = colOf(k);
      ctx.fillRect(px, py, w, h);
      ctx.strokeStyle = '#10151a';
      ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
      const pt = p.parts[k];
      if (pt.bandaged) { ctx.fillStyle = '#e8e5da'; ctx.fillRect(px + 2, py + h / 2 - 1.5, w - 4, 3); }
      if (pt.fracture) { ctx.strokeStyle = '#ffdf7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 2, py + 2); ctx.lineTo(px + w - 2, py + h - 2); ctx.moveTo(px + w - 2, py + 2); ctx.lineTo(px + 2, py + h - 2); ctx.stroke(); ctx.lineWidth = 1; }
    }
    // 总生命 / 体力条
    const hp = Sys.Health.overall(p);
    const bx = x - 6, by = y + 76;
    ctx.fillStyle = '#0c1116'; ctx.fillRect(bx, by, 72, 7);
    ctx.fillStyle = hp > 50 ? '#5aa860' : hp > 25 ? '#d08040' : '#c04040';
    ctx.fillRect(bx, by, 72 * U.clamp(hp / 100, 0, 1), 7);
    ctx.strokeStyle = '#2b3a46'; ctx.strokeRect(bx + 0.5, by + 0.5, 72, 7);
    ctx.fillStyle = '#0c1116'; ctx.fillRect(bx, by + 10, 72, 5);
    ctx.fillStyle = '#4fa3e3';
    ctx.fillRect(bx, by + 10, 72 * U.clamp(p.stam / p.stamMax, 0, 1), 5);
    ctx.strokeRect(bx + 0.5, by + 10.5, 72, 5);
    // 体重
    const wt = Ent.weight(p), cap = Ent.capacity(p);
    ctx.font = '11px Consolas';
    ctx.fillStyle = wt > cap ? '#e5484d' : '#7f8f9b';
    ctx.fillText(wt.toFixed(1) + ' / ' + cap.toFixed(0) + ' kg', bx, by + 28);
    // [H] 提示
    ctx.fillStyle = '#4d6377';
    ctx.fillText('[H] 急救', bx + 42, by + 28);
  },

  _hotbar(ctx, p) {
    const cx = G.vw / 2, y = G.vh - 58;
    // 武器三槽
    const slots = [['1', 'primary', '主'], ['2', 'secondary', '副'], ['3', 'melee', '近']];
    let x = cx - 170;
    for (const [key, slot, label] of slots) {
      const it = p.equip[slot];
      const on = p.active === slot;
      ctx.fillStyle = on ? 'rgba(240,180,41,0.18)' : 'rgba(10,15,20,0.7)';
      ctx.fillRect(x, y, 52, 52);
      ctx.strokeStyle = on ? '#f0b429' : '#2b3a46';
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 52, 52);
      ctx.font = '9px Consolas'; ctx.fillStyle = on ? '#f0b429' : '#4d6377';
      ctx.fillText(key + '·' + label, x + 4, y + 11);
      if (it) {
        const d = DB.it(it.id);
        ctx.fillStyle = d.ic.c;
        if (d.cat === 'gun') { ctx.fillRect(x + 18, y + 18, 7, 22); ctx.fillRect(x + 22, y + 34, 8, 6); }
        else { ctx.save(); ctx.translate(x + 26, y + 34); ctx.rotate(-0.7); ctx.fillRect(-2, -14, 4, 24); ctx.restore(); }
        if (d.cat === 'gun') {
          const gs = Ent.gunStats(p, it);
          ctx.font = 'bold 11px Consolas'; ctx.fillStyle = '#ffd98a'; ctx.textAlign = 'right';
          ctx.fillText(it.loaded + '/' + gs.mag, x + 48, y + 48);
          ctx.textAlign = 'left';
        }
      }
      x += 60;
    }
    // 快捷 4/5
    for (let i = 0; i < 2; i++) {
      const uid = p.hotbar[i];
      const it = p.inv.find(v => v.uid === uid);
      ctx.fillStyle = 'rgba(10,15,20,0.7)';
      ctx.fillRect(x, y, 52, 52);
      ctx.strokeStyle = '#2b3a46'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 52, 52);
      ctx.font = '9px Consolas'; ctx.fillStyle = '#4d6377';
      ctx.fillText(String(4 + i), x + 4, y + 11);
      if (it) {
        const d = DB.it(it.id);
        ctx.fillStyle = d.ic.c;
        ctx.fillRect(x + 16, y + 18, 20, 16);
        ctx.strokeStyle = '#10151a'; ctx.strokeRect(x + 16.5, y + 18.5, 19, 15);
        if (it.qty > 1) { ctx.font = 'bold 10px Consolas'; ctx.fillStyle = '#fff'; ctx.fillText(it.qty, x + 38, y + 46); }
      }
      x += 60;
    }
    // 备弹
    const w = Ent.activeWeapon(p);
    if (w.d && w.d.cat === 'gun') {
      const reserve = Ent.countItem(p, w.it.ammoId || 'a_9');
      ctx.font = '11px Consolas'; ctx.fillStyle = '#7f8f9b'; ctx.textAlign = 'center';
      ctx.fillText('备弹 ' + (w.it.ammoId ? DB.it(w.it.ammoId).nm + ' ×' + reserve : '—'), cx, y + 66);
      ctx.textAlign = 'left';
    }
    // 装填条
    if (p.reloadT > 0) {
      ctx.fillStyle = '#0c1116'; ctx.fillRect(cx - 50, y - 14, 100, 6);
      ctx.fillStyle = '#f0b429';
      const d = DB.it(Ent.activeWeapon(p).it.id);
      ctx.fillRect(cx - 49, y - 13, 98 * (1 - p.reloadT / Math.max(0.6, d.reload)), 4);
      ctx.font = '10px Consolas'; ctx.fillStyle = '#ffd98a'; ctx.textAlign = 'center';
      ctx.fillText('RELOADING…', cx, y - 18);
      ctx.textAlign = 'left';
    }
  },

  _topbar(ctx) {
    const r = G.raid;
    const c = U.fmtClock(r.time);
    const left = r.limit - r.time;
    const x = G.vw - 190, y = 18;
    ctx.fillStyle = 'rgba(10,15,20,0.7)';
    this._rr2(ctx, x, y, 172, 62, 6); ctx.fill();
    ctx.strokeStyle = '#2b3a46'; ctx.stroke();
    ctx.font = 'bold 16px Consolas'; ctx.fillStyle = '#e8e2ce';
    ctx.fillText('第 ' + c.day + ' 天  ' + c.str, x + 12, y + 22);
    const W = { clear: '☀ 晴', overcast: '☁ 阴', rain: '🌧 雨', storm: '⛈ 风暴' };
    ctx.font = '12px YaHei'; ctx.fillStyle = '#7f8f9b';
    ctx.fillText(W[r.weather.type] || '', x + 12, y + 40);
    ctx.font = '11px Consolas';
    ctx.fillStyle = left < 180 ? '#e5484d' : left < 480 ? '#e8a03a' : '#7f8f9b';
    ctx.fillText(r.closed ? '撤离已关闭 ⚠' : '撤离时限剩 ' + Math.floor(left / 60) + 'h' + (left % 60) + 'm', x + 12, y + 56);
    // 击杀数
    ctx.font = '11px Consolas'; ctx.fillStyle = '#7f8f9b';
    ctx.fillText('☠ ' + G.player.kills, x + 130, y + 40);
  },

  _minimap(ctx) {
    const W = G.world;
    const mw = 148, mh = Math.round(148 * W.h / W.w);
    const x = 16, y = 16;
    const sc = mw / W.w;
    ctx.fillStyle = 'rgba(8,12,16,0.82)';
    ctx.fillRect(x - 3, y - 3, mw + 6, mh + 6);
    ctx.strokeStyle = '#2b3a46'; ctx.strokeRect(x - 2.5, y - 2.5, mw + 5, mh + 5);
    const solidC = { 7: '#6b6458', 3: '#7c6349', 4: '#8e969a', 11: '#6f7274', 12: '#4c565f' };
    for (let ty = 0; ty < W.h; ty += 1) for (let tx = 0; tx < W.w; tx += 1) {
      const i = ty * W.w + tx;
      if (!G.explored[i]) continue;
      const t = W.tiles[i];
      if (solidC[t]) ctx.fillStyle = solidC[t];
      else if (t === T.ROAD) ctx.fillStyle = '#52535a';
      else if (t === T.FOREST) ctx.fillStyle = '#48583e';
      else continue;
      ctx.fillRect(x + tx * sc, y + ty * sc, Math.ceil(sc), Math.ceil(sc));
    }
    // 撤离点
    for (const e of G.world.extracts) {
      if (!G.explored[e.ty * W.w + e.tx] && !(G.save.facilities.intel >= 1)) continue;
      const bl = 0.5 + 0.5 * Math.sin(Render.t * 3);
      ctx.fillStyle = `rgba(110,220,140,${0.5 + bl * 0.5})`;
      ctx.beginPath(); ctx.arc(x + (e.x / 32) * sc, y + (e.y / 32) * sc, 3, 0, 7); ctx.fill();
    }
    // 玩家
    const px = x + (G.player.x / 32) * sc, py = y + (G.player.y / 32) * sc;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(G.player.dir);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -3.4); ctx.lineTo(-3, 3.4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = '9px Consolas'; ctx.fillStyle = '#4d6377';
    ctx.fillText('[M] 战术地图', x + 2, y + mh + 14);
  },

  _bossbar(ctx) {
    let boss = null;
    for (const z of G.zombies) if (z.boss && z.hp > 0 && U.dist(z.x, z.y, G.player.x, G.player.y) < 520 && G.fovLit(z.x, z.y)) { boss = z; break; }
    if (!boss) return;
    const w = Math.min(420, G.vw - 260);
    const x = (G.vw - w) / 2, y = 26;
    ctx.fillStyle = 'rgba(10,12,16,0.75)';
    ctx.fillRect(x - 4, y - 4, w + 8, 26);
    ctx.strokeStyle = '#5a2b2b'; ctx.strokeRect(x - 3.5, y - 3.5, w + 7, 25);
    ctx.fillStyle = '#0c1116'; ctx.fillRect(x, y + 8, w, 10);
    const k = U.clamp(boss.hp / boss.maxHp, 0, 1);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#e5484d'); g.addColorStop(1, '#8a1e2a');
    ctx.fillStyle = g; ctx.fillRect(x, y + 8, w * k, 10);
    ctx.font = 'bold 12px YaHei'; ctx.fillStyle = '#ff8a8a'; ctx.textAlign = 'center';
    ctx.fillText('☠ ' + boss.d.nm + '  ' + Math.ceil(boss.hp) + ' / ' + boss.maxHp, G.vw / 2, y + 6);
    ctx.textAlign = 'left';
  },

  _prompts(ctx, p) {
    // 交互提示
    if (!G.uiOpen) {
      const t = Ent.interactTarget(p);
      if (t && t.kind === 'door') {
        const d = t.door;
        let txt = '[F] ';
        if (d.barricade > 0) txt += '已封死 ×' + d.barricade;
        else if (d.card) txt += '需要 ' + DB.it(d.card).nm;
        else if (d.powered && !G.world.power) txt += '电磁闸门（未通电）';
        else if (d.locked) txt += '踹开锁着的' + (d.type === 'window' ? '窗' : '门');
        else if (d.type === 'window') txt += d.open ? '关窗' : '翻越窗户';
        else txt += d.open ? '关门' : '开门';
        if (d.barricade < 3 && d.hp < 999) txt += '   [B] 钉木板加固';
        this._chip(ctx, G.vw / 2, G.vh - 100, txt);
      } else if (t && t.kind === 'ground') {
        this._chip(ctx, G.vw / 2, G.vh - 100, '[F] 拾取 ' + DB.it(t.g.it.id).nm);
      } else if (t && t.kind === 'generator') {
        this._chip(ctx, G.vw / 2, G.vh - 100, '[F] 启动备用发电机');
      }
      // 撤离进度
      if (G.extractT > 0) {
        const w = 200, x = G.vw / 2 - w / 2, y = G.vh - 140;
        ctx.fillStyle = 'rgba(10,15,20,0.8)'; ctx.fillRect(x - 6, y - 20, w + 12, 34);
        ctx.strokeStyle = '#46c07a'; ctx.strokeRect(x - 5.5, y - 19.5, w + 11, 33);
        ctx.fillStyle = '#0c1116'; ctx.fillRect(x, y - 8, w, 8);
        ctx.fillStyle = '#46c07a'; ctx.fillRect(x, y - 8, w * U.clamp(G.extractT / 6, 0, 1), 8);
        ctx.font = 'bold 11px YaHei'; ctx.fillStyle = '#8ae8a8'; ctx.textAlign = 'center';
        ctx.fillText('正在撤离…保持站位', G.vw / 2, y - 11);
        ctx.textAlign = 'left';
      }
      // 搜集提示
      const W = G.world;
      const tt = W.tiles[W.idx(Math.floor(p.x / 32), Math.floor(p.y / 32))];
      if (tt === T.GRASS || tt === T.FOREST || tt === T.PARK) {
        this._chip(ctx, G.vw / 2, G.vh - 126, '[G] 搜集（草地/林线）', true);
      }
    }
    // 行动读条标签
    if (p.action) {
      this._chip(ctx, G.vw / 2, G.vh - 74, p.action.label + ' ' + Math.round(p.action.t / p.action.dur * 100) + '%');
    }
    // 键位速查（开局 3 分钟）
    if (G.raid.time < 8) {
      ctx.font = '11px YaHei'; ctx.fillStyle = 'rgba(127,143,155,0.85)';
      const lines = ['WASD 移动 · 鼠标瞄准 · LMB 攻击 · RMB 稳定瞄准', 'Shift 冲刺 · Ctrl/C 潜行 · Space 翻滚闪避', 'F 交互 · B 封窗 · G 搜集 · R 装填 · Q 手电 · T 热成像', 'Tab 背包 · K 制作 · H 急救 · M 地图 · P 技能 · Esc 暂停'];
      lines.forEach((l, i) => ctx.fillText(l, G.vw - 300, 96 + i * 16));
    }
  },

  _chip(ctx, cx, y, txt, small) {
    ctx.font = (small ? '11px' : '12px') + ' YaHei';
    const w = ctx.measureText(txt).width + 20;
    ctx.fillStyle = 'rgba(10,15,20,0.8)';
    this._rr2(ctx, cx - w / 2, y - 14, w, 22, 4); ctx.fill();
    ctx.strokeStyle = '#3d5263'; ctx.stroke();
    ctx.fillStyle = '#e8e2ce'; ctx.textAlign = 'center';
    ctx.fillText(txt, cx, y + 1);
    ctx.textAlign = 'left';
  },
  _rr2(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // moodle 悬浮提示（mousemove 调用）
  hover(mx, my) {
    for (const r of this.moodleRects) {
      if (mx >= r.x - 10 && mx <= r.x + r.w + 10 && my >= r.y && my <= r.y + r.h + 8) {
        return r.m;
      }
    }
    return null;
  }
};
window.HUD = HUD;
