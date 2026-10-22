// ============================================================
// render.js — 渲染管线（视觉语言对齐《逃离鸭科夫》分析报告）
// · 反差萌赛璐璐鸭 + 低饱和微缩废土 · 卡通描边/阶梯光影
// · 视线迷雾蒙版（盲区实体剔除）· 手电丁达尔光锥 · 热成像后处理
// · 曳光弹/枪口焰/抛壳/羽毛爆散 · 风暴屏幕扭曲 · 低血量色散噪点
// ============================================================
'use strict';
const Render = {
  cam: { x: 0, y: 0, shake: 0, ox: 0, oy: 0 },
  lightCv: null, noiseCv: null, sceneCv: null,
  t: 0,

  resize() {
    const cv = G.cv, hud = G.hudCv;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    for (const c of [cv, hud]) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'; }
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    hud.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    G.vw = innerWidth; G.vh = innerHeight;
  },

  draw(dt) {
    const ctx = G.ctx;
    this.t += dt;
    this.cam.shake = Math.max(0, this.cam.shake - dt * 14);
    const shx = (Math.random() - 0.5) * this.cam.shake * 2, shy = (Math.random() - 0.5) * this.cam.shake * 2;
    // 相机跟随（鼠标前引）
    const p = G.player;
    const tx = p.x + (Input.mouse.x - G.vw / 2) * 0.14, ty = p.y + (Input.mouse.y - G.vh / 2) * 0.14;
    this.cam.x = U.lerp(this.cam.x, tx, 1 - Math.pow(0.001, dt));
    this.cam.y = U.lerp(this.cam.y, ty, 1 - Math.pow(0.001, dt));
    this.cam.ox = this.cam.x - G.vw / 2 + shx; this.cam.oy = this.cam.y - G.vh / 2 + shy;

    ctx.fillStyle = '#0b0f13';
    ctx.fillRect(0, 0, G.vw, G.vh);
    ctx.save();
    ctx.translate(-this.cam.ox, -this.cam.oy);
    this._ground(ctx);
    this._markers(ctx);
    this._ySorted(ctx);
    this._projectiles(ctx);
    FX.update(dt, ctx);
    this._overheadTrees(ctx);
    ctx.restore();

    // 光影合成（迷雾/黑暗/手电/路灯）
    this._lighting(ctx);
    // 天气
    this._weather(ctx, dt);
    // 热成像模式
    if (p.thermalOn) this._thermal(ctx);
    // 受击后处理
    this._postFX(ctx, dt);
  },

  // ---------------- 地面 ----------------
  _ground(ctx) {
    const W = G.world, cam = this.cam;
    const x0 = Math.max(0, Math.floor(cam.ox / 32) - 1), y0 = Math.max(0, Math.floor(cam.oy / 32) - 1);
    const x1 = Math.min(W.w - 1, Math.ceil((cam.ox + G.vw) / 32) + 1), y1 = Math.min(W.h - 1, Math.ceil((cam.oy + G.vh) / 32) + 1);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = W.tiles[ty * W.w + tx], h = U.hash2(tx, ty);
        const px = tx * 32, py = ty * 32;
        switch (t) {
          case T.GRASS: ctx.fillStyle = h < 0.5 ? '#5d6e4e' : '#647751'; ctx.fillRect(px, py, 32, 32); if (h > 0.82) { ctx.fillStyle = '#6d8058'; ctx.fillRect(px + 6, py + 10, 3, 3); ctx.fillRect(px + 20, py + 22, 3, 3); } break;
          case T.PARK: ctx.fillStyle = h < 0.5 ? '#57724d' : '#5d7952'; ctx.fillRect(px, py, 32, 32); if (h > 0.86) { ctx.fillStyle = '#68855c'; ctx.beginPath(); ctx.arc(px + 16, py + 16, 4, 0, 7); ctx.fill(); } break;
          case T.FOREST: ctx.fillStyle = h < 0.5 ? '#48583e' : '#4e6042'; ctx.fillRect(px, py, 32, 32); break;
          case T.ROAD: ctx.fillStyle = h < 0.5 ? '#525358' : '#565761'; ctx.fillRect(px, py, 32, 32); if (h > 0.93) { ctx.fillStyle = '#46474c'; ctx.fillRect(px + 4, py + 8, 10, 3); } break;
          case T.SIDE: ctx.fillStyle = h < 0.5 ? '#74767a' : '#787a7e'; ctx.fillRect(px, py, 32, 32); ctx.strokeStyle = '#63656a'; ctx.strokeRect(px + 0.5, py + 0.5, 16, 16); ctx.strokeRect(px + 16.5, py + 16.5, 15, 15); break;
          case T.WOOD: ctx.fillStyle = h < 0.5 ? '#7c6349' : '#81684c'; ctx.fillRect(px, py, 32, 32); ctx.strokeStyle = '#6b553f'; ctx.beginPath(); ctx.moveTo(px, py + 10.5); ctx.lineTo(px + 32, py + 10.5); ctx.moveTo(px, py + 21.5); ctx.lineTo(px + 32, py + 21.5); ctx.stroke(); break;
          case T.TILEF: ctx.fillStyle = h < 0.5 ? '#8e969a' : '#939aa0'; ctx.fillRect(px, py, 32, 32); ctx.strokeStyle = '#7d8489'; ctx.strokeRect(px + 0.5, py + 0.5, 16, 16); ctx.strokeRect(px + 16.5, py + 0.5, 15, 16); ctx.strokeRect(px + 0.5, py + 16.5, 16, 15); ctx.strokeRect(px + 16.5, py + 16.5, 15, 15); break;
          case T.DIRT: ctx.fillStyle = h < 0.5 ? '#6e6049' : '#73684e'; ctx.fillRect(px, py, 32, 32); if (h > 0.9) { ctx.fillStyle = '#7c7057'; ctx.fillRect(px + 10, py + 14, 5, 3); } break;
          case T.RUBBLE: ctx.fillStyle = h < 0.5 ? '#63625c' : '#686761'; ctx.fillRect(px, py, 32, 32); ctx.fillStyle = '#767468'; if (h > 0.4) ctx.fillRect(px + 8 + h * 8, py + 6 + h * 6, 7, 5); if (h > 0.7) ctx.fillRect(px + 4, py + 20, 9, 5); break;
          case T.CONC: ctx.fillStyle = h < 0.5 ? '#6f7274' : '#737679'; ctx.fillRect(px, py, 32, 32); if (h > 0.9) { ctx.strokeStyle = '#63666a'; ctx.strokeRect(px + 3.5, py + 3.5, 25, 25); } break;
          case T.LAB: ctx.fillStyle = h < 0.5 ? '#4c565f' : '#4f5a64'; ctx.fillRect(px, py, 32, 32); ctx.strokeStyle = '#434d56'; ctx.strokeRect(px + 0.5, py + 0.5, 32, 32); if (h > 0.94) { ctx.fillStyle = '#e8c04a'; ctx.fillRect(px + 2, py + 14, 28, 2); } break;
          case T.WALL: break; // y-sorted
          case T.DOOR: case T.WINDOW: break;
        }
        // 道路中线
        if (t === T.ROAD) {
          const Wd = G.world;
          const nH = ty > 0 && Wd.tiles[(ty - 1) * Wd.w + tx] !== T.ROAD, sH = ty < Wd.h - 1 && Wd.tiles[(ty + 1) * Wd.w + tx] !== T.ROAD;
          const nV = tx > 0 && Wd.tiles[ty * Wd.w + tx - 1] !== T.ROAD, sV = tx < Wd.w - 1 && Wd.tiles[ty * Wd.w + tx + 1] !== T.ROAD;
          const horiz = !nH && !sH, vert = !nV && !sV;
          if (horiz && (ty * 32) % 96 < 32) { ctx.fillStyle = '#b8ad82'; ctx.fillRect(px + 4, py + 12, 14, 3); ctx.fillRect(px + 22, py + 12, 8, 3); }
          if (vert && (tx * 32) % 96 < 32) { ctx.fillStyle = '#b8ad82'; ctx.fillRect(px + 12, py + 4, 3, 14); ctx.fillRect(px + 12, py + 22, 3, 8); }
        }
      }
    }
    // 地面物件：血渍 / 掉落物
    for (const g of G.ground) {
      if (g.blood) { ctx.fillStyle = 'rgba(90,26,24,0.55)'; ctx.beginPath(); ctx.arc(g.x, g.y, 4, 0, 7); ctx.arc(g.x + 3, g.y + 2, 2.5, 0, 7); ctx.fill(); }
      else if (g.it) {
        const d = DB.it(g.it.id);
        const bob = Math.sin(this.t * 3 + g.x) * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(g.x, g.y + 6, 7, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = d.ic.c; ctx.strokeStyle = '#10151a'; ctx.lineWidth = 1.5;
        ctx.fillRect(g.x - 6, g.y - 6 + bob, 12, 12); ctx.strokeRect(g.x - 6, g.y - 6 + bob, 12, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(g.x - 4, g.y - 4 + bob, 4, 3);
      }
    }
  },

  _markers(ctx) {
    // 撤离点信标
    for (const e of G.world.extracts) {
      if (G.raid.closed) continue;
      const pul = 0.5 + 0.5 * Math.sin(this.t * 2.5);
      ctx.strokeStyle = `rgba(110,220,140,${0.5 + pul * 0.4})`;
      ctx.fillStyle = `rgba(110,220,140,${0.08 + pul * 0.06})`;
      ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(e.x, e.y, 36 + pul * 5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#8ae8a8'; ctx.font = '11px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText('▼ ' + e.nm, e.x, e.y - 42 - pul * 3);
      ctx.textAlign = 'left';
    }
    // 落雷预警圈
    for (const s of G.strikes) {
      const k = 1 - s.t / 1.4;
      ctx.strokeStyle = `rgba(160,220,255,${0.4 + k * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(160,220,255,${k * 0.18})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * k, 0, 7); ctx.fill();
    }
  },

  // ---------------- Y 排序绘制（墙/家具/尸体/实体） ----------------
  _ySorted(ctx) {
    const W = G.world, cam = this.cam;
    const x0 = Math.max(0, Math.floor(cam.ox / 32) - 2), y0 = Math.max(0, Math.floor(cam.oy / 32) - 3);
    const x1 = Math.min(W.w - 1, Math.ceil((cam.ox + G.vw) / 32) + 2), y1 = Math.min(W.h - 1, Math.ceil((cam.oy + G.vh) / 32) + 3);
    const list = [];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = ty * W.w + tx, t = W.tiles[i];
      if (t === T.WALL || t === T.DOOR || t === T.WINDOW) list.push({ y: ty * 32 + 32, k: 'tile', tx, ty, t, i });
    }
    for (const f of W.furn) {
      if (f.hp <= 0) continue;
      if (f.tx < x0 || f.tx > x1 || f.ty < y0 || f.ty > y1) continue;
      list.push({ y: f.ty * 32 + 26, k: 'furn', f });
    }
    const p = G.player;
    // 实体（迷雾剔除 + LOS）
    for (const z of G.zombies) {
      if (z.hp <= 0) continue;
      if (Math.abs(z.x - cam.x) > G.vw / 2 + 60 || Math.abs(z.y - cam.y) > G.vh / 2 + 60) continue;
      if (!G.fovLit(z.x, z.y)) continue;
      list.push({ y: z.y + 8, k: 'z', z });
    }
    list.push({ y: p.y + 10, k: 'p' });
    list.sort((a, b) => a.y - b.y);
    const near = Ent.interactTarget(p);
    for (const e of list) {
      if (e.k === 'tile') this._tileProp(ctx, e.tx, e.ty, e.t, e.i);
      else if (e.k === 'furn') this._furn(ctx, e.f, near);
      else if (e.k === 'z') this._zombie(ctx, e.z);
      else this._player(ctx);
    }
  },

  _tileProp(ctx, tx, ty, t, i) {
    const W = G.world, px = tx * 32, py = ty * 32, h = U.hash2(tx, ty);
    const d = W.doors.get(i);
    if (t === T.WALL) {
      // 2.5D：顶面 + 前立面（微缩模型感）
      ctx.fillStyle = h < 0.5 ? '#8a8276' : '#8e867a';
      ctx.fillRect(px, py - 10, 32, 30);
      ctx.fillStyle = h < 0.5 ? '#5f594e' : '#645e52';
      ctx.fillRect(px, py + 12, 32, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(px, py - 10, 32, 4);
      ctx.strokeStyle = '#3a352c'; ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 0.5, py - 10.5, 31, 30);
      if (h > 0.8) { ctx.fillStyle = '#77563d'; ctx.fillRect(px + 20, py + 2, 6, 4); }
      // 顶部阴影投影
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px, py + 30, 32, 4);
    } else if (t === T.DOOR) {
      const open = d && d.open;
      ctx.fillStyle = '#7a6248'; ctx.fillRect(px, py - 6, 32, 26);
      if (!open) {
        ctx.fillStyle = d.broken ? '#5e4c38' : '#8f7452';
        ctx.fillRect(px + 2, py - 4, 28, 24);
        ctx.strokeStyle = '#4a3b2c'; ctx.strokeRect(px + 2.5, py - 3.5, 27, 23);
        ctx.fillStyle = '#caa84a'; ctx.beginPath(); ctx.arc(px + 26, py + 9, 2, 0, 7); ctx.fill();
        if (d.card) { ctx.fillStyle = DB.it(d.card).ic.c; ctx.fillRect(px + 12, py + 2, 8, 8); }
        if (d.powered && !W.power) { ctx.fillStyle = '#e5484d'; ctx.fillRect(px + 13, py + 14, 6, 4); }
      } else {
        ctx.fillStyle = '#8f7452'; ctx.fillRect(px + 1, py - 6, 5, 26);
        ctx.strokeStyle = '#4a3b2c'; ctx.strokeRect(px + 1.5, py - 5.5, 4, 25);
      }
      this._barricade(ctx, px, py, d);
    } else if (t === T.WINDOW) {
      ctx.fillStyle = '#8a8276'; ctx.fillRect(px, py - 8, 32, 26);
      const glass = d && d.broken ? 'rgba(140,180,190,0.15)' : 'rgba(150,200,215,0.45)';
      ctx.fillStyle = glass; ctx.fillRect(px + 4, py - 4, 24, 18);
      ctx.strokeStyle = '#3a352c'; ctx.strokeRect(px + 3.5, py - 4.5, 25, 19);
      ctx.beginPath(); ctx.moveTo(px + 16, py - 4); ctx.lineTo(px + 16, py + 14); ctx.stroke();
      this._barricade(ctx, px, py, d);
    }
  },
  _barricade(ctx, px, py, d) {
    if (!d || d.barricade <= 0) return;
    for (let i = 0; i < d.barricade; i++) {
      ctx.save();
      ctx.translate(px + 16, py + 6 + i * 5);
      ctx.rotate((i % 2 ? -1 : 1) * 0.06);
      ctx.fillStyle = i % 2 ? '#9a7648' : '#8a6a40';
      ctx.fillRect(-17, -3, 34, 6);
      ctx.strokeStyle = '#4a3b2c'; ctx.strokeRect(-17, -3, 34, 6);
      ctx.restore();
    }
  },

  _furn(ctx, f, near) {
    const px = f.tx * 32, py = f.ty * 32;
    const h = U.hash2(f.tx, f.ty);
    const shadow = () => { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(px + 16, py + 26, 15, 5, 0, 0, 7); ctx.fill(); };
    const box = (c, c2, x, y, w, h2, r) => {
      ctx.fillStyle = c; ctx.strokeStyle = '#232a30'; ctx.lineWidth = 1.5;
      this._rr(ctx, x, y, w, h2, r); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; this._rr(ctx, x + 2, y + 2, w - 4, h2 * 0.32, r); ctx.fill();
      if (c2) { ctx.fillStyle = c2; this._rr(ctx, x + 2, y + h2 * 0.62, w - 4, h2 * 0.3, 2); ctx.fill(); }
    };
    switch (f.kind) {
      case 'counter': shadow(); box('#8f8a7c', '#7c786b', px + 3, py + 2, 26, 24, 3); ctx.fillStyle = '#6a665c'; ctx.fillRect(px + 6, py + 8, 8, 6); ctx.fillStyle = '#9aa2a8'; ctx.fillRect(px + 17, py + 6, 7, 5); break;
      case 'fridge': shadow(); box('#c9cdd1', '#aeb3b8', px + 5, py - 6, 22, 32, 3); ctx.fillStyle = '#8a9096'; ctx.fillRect(px + 8, py - 2, 3, 8); break;
      case 'stove': shadow(); box('#5f666c', '#4c5258', px + 4, py + 2, 24, 24, 3); ctx.fillStyle = '#22262a'; ctx.beginPath(); ctx.arc(px + 11, py + 10, 4, 0, 7); ctx.arc(px + 21, py + 18, 4, 0, 7); ctx.fill(); break;
      case 'wardrobe': shadow(); box('#7c6349', '#65503a', px + 3, py - 8, 26, 34, 2); ctx.strokeStyle = '#4a3b2c'; ctx.beginPath(); ctx.moveTo(px + 16, py - 6); ctx.lineTo(px + 16, py + 24); ctx.stroke(); break;
      case 'bed': shadow(); box('#7d8ca0', '#66748a', px + 2, py + 2, 28, 26, 4); ctx.fillStyle = '#d8dbe0'; this._rr(ctx, px + 4, py + 2, 24, 8, 3); ctx.fill(); break;
      case 'nightstand': shadow(); box('#7c6349', null, px + 7, py + 8, 18, 16, 2); break;
      case 'sofa': shadow(); box('#7a5f6e', '#634c58', px + 1, py + 4, 30, 22, 5); break;
      case 'tv': shadow(); box('#3b4148', '#2c3138', px + 6, py + 8, 20, 16, 2); ctx.fillStyle = '#5a8aa0'; ctx.fillRect(px + 9, py + 11, 14, 8); break;
      case 'shelf': shadow(); box('#8a6f52', '#6d573f', px + 2, py - 6, 28, 32, 2); ctx.fillStyle = '#5a4732'; ctx.fillRect(px + 4, py + 2, 24, 3); ctx.fillRect(px + 4, py + 12, 24, 3); ctx.fillRect(px + 4, py + 22, 24, 3); break;
      case 'crate': shadow(); box(h > .5 ? '#a8824e' : '#9c7846', null, px + 4, py + 2, 24, 24, 2); ctx.strokeStyle = '#5e4629'; ctx.beginPath(); ctx.moveTo(px + 4, py + 2); ctx.lineTo(px + 28, py + 26); ctx.moveTo(px + 28, py + 2); ctx.lineTo(px + 4, py + 26); ctx.stroke(); break;
      case 'toolbox': shadow(); box('#b04a3a', '#8a3a2e', px + 5, py + 6, 22, 18, 2); ctx.fillStyle = '#666'; ctx.fillRect(px + 10, py + 3, 12, 4); break;
      case 'desk': shadow(); box('#7a6a55', '#645640', px + 2, py + 4, 28, 22, 2); ctx.fillStyle = '#d8d3c0'; ctx.fillRect(px + 6, py + 8, 8, 5); break;
      case 'medcab': shadow(); box('#e8e9e4', '#c9cbc4', px + 5, py - 8, 22, 32, 2); ctx.fillStyle = '#e05a5a'; ctx.fillRect(px + 13, py - 2, 6, 6); break;
      case 'sink': shadow(); box('#c9cdd1', null, px + 8, py + 10, 16, 12, 4); break;
      case 'toilet': shadow(); box('#dfe2e4', '#c2c6c8', px + 9, py + 6, 14, 18, 6); break;
      case 'register': shadow(); box('#4a5058', '#383e46', px + 6, py + 6, 20, 18, 2); ctx.fillStyle = '#8ae8a8'; ctx.fillRect(px + 9, py + 9, 10, 5); break;
      case 'milcrate': shadow(); box('#5d6b4a', '#48543a', px + 3, py + 1, 26, 26, 2); ctx.fillStyle = '#e8c04a'; ctx.font = 'bold 8px Consolas'; ctx.fillText('AMMO', px + 6, py + 16); break;
      case 'labbox': shadow(); box('#c8ced2', '#a8b0b6', px + 4, py + 2, 24, 24, 2); ctx.fillStyle = '#b07ce8'; ctx.fillRect(px + 8, py + 6, 6, 6); ctx.fillStyle = '#4fa3e3'; ctx.fillRect(px + 17, py + 15, 6, 6); break;
      case 'container': shadow(); box(h > .5 ? '#5f6d5a' : '#6a5a44', null, px, py - 4, 32, 34, 1); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(px + k * 5, py - 4); ctx.lineTo(px + k * 5, py + 30); ctx.stroke(); } break;
      case 'generator': shadow(); box('#555f52', '#434c42', px + 2, py - 2, 28, 30, 3); ctx.fillStyle = G.world.power ? '#8ae8a8' : '#e5484d'; ctx.beginPath(); ctx.arc(px + 24, py + 6, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillRect(px + 6, py + 8, 12, 8); break;
      case 'pump': shadow(); box('#b03a3a', '#8a2e2e', px + 5, py + 2, 22, 26, 3); ctx.fillStyle = '#e8d0a0'; ctx.fillRect(px + 9, py + 6, 14, 8); break;
      case 'car': shadow(); box(h > .5 ? '#4a5a6a' : '#6a5a4a', '#333c46', px - 2, py - 4, 36, 34, 6); ctx.fillStyle = '#8ab0c8'; this._rr(ctx, px + 5, py + 2, 22, 10, 3); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(px + 1, py + 8, 5, 8); ctx.fillRect(px + 25, py + 8, 5, 8); break;
      case 'corpse': {
        const fade = f.fade !== undefined ? f.fade : 40;
        if (fade < 12) break;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px + 16, py + 18, 16, 7, 0.4, 0, 7); ctx.fill();
        const zc = f.zcol || '#6d7458';
        ctx.save(); ctx.translate(px + 16, py + 16); ctx.rotate(0.6 + h);
        ctx.globalAlpha = U.clamp(fade / 20, 0, 1);
        ctx.fillStyle = zc; ctx.strokeStyle = '#2a2f26'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(12, -2, 6, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7d7045'; ctx.beginPath(); ctx.moveTo(17, -2); ctx.lineTo(24, 0); ctx.lineTo(17, 2); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1;
        break;
      }
      default: shadow(); box('#8a8276', null, px + 6, py + 6, 20, 20, 3);
    }
    // 可交互高亮
    if (near && near.kind === 'container' && near.f === f) {
      const pul = 0.5 + 0.5 * Math.sin(this.t * 5);
      ctx.strokeStyle = `rgba(240,180,41,${0.55 + pul * 0.4})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 1, py - 8, 34, 38);
      ctx.fillStyle = '#f0b429'; ctx.font = '11px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText('[F] ' + (f.cont.nm || '搜索'), px + 16, py - 12);
      ctx.textAlign = 'left';
    }
    if (f.cont && f.cont.searched && f.kind !== 'corpse') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + 8, py + 20, 16, 3);
    }
  },

  // ---------------- 鸭子绘制（赛璐璐战术鸭） ----------------
  duck(ctx, o) {
    // o: {x,y,dir,size,col,walk,zombie,crawler,helmet,vest,backpack,weapon,melee,swingT,alpha,eye,boss,camo}
    const s = (o.size || 11) / 11;
    ctx.save();
    ctx.translate(o.x, o.y);
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8 * s, 12 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.rotate(o.dir + Math.PI / 2);
    const bob = o.walk ? Math.sin(o.walk * 10) * 1.2 * s : 0;
    // 脚（俯视：两只小蹼交替）
    if (!o.crawler) {
      const step = o.walk ? Math.sin(o.walk * 10) : 0;
      ctx.fillStyle = o.zombie ? '#6a5a30' : '#e8973a';
      ctx.beginPath(); ctx.ellipse(-5 * s, (-6 + step * 3) * s, 3.4 * s, 2.4 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5 * s, (-6 - step * 3) * s, 3.4 * s, 2.4 * s, 0, 0, 7); ctx.fill();
    }
    ctx.translate(0, bob);
    const R = 10 * s;
    // 尾羽
    ctx.fillStyle = o.col.body2 || '#333';
    ctx.beginPath(); ctx.moveTo(0, R * 1.15); ctx.lineTo(-4 * s, R * 1.5); ctx.lineTo(4 * s, R * 1.5); ctx.closePath(); ctx.fill();
    // 身体
    ctx.fillStyle = o.col.body; ctx.strokeStyle = '#1d231a'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.92, R * 1.05, 0, 0, 7); ctx.fill(); ctx.stroke();
    // 阶梯光影（赛璐璐亮/暗两段）
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.92, R * 1.05, 0, 0, 7); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(-R * 0.25, -R * 0.3, R * 0.62, R * 0.66, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(R * 0.4, R * 0.55, R * 0.7, R * 0.62, 0, 0, 7); ctx.fill();
    if (o.zombie) { // 脏污/破烂
      ctx.fillStyle = 'rgba(40,44,30,0.5)';
      ctx.beginPath(); ctx.arc(-R * 0.3, R * 0.2, R * 0.24, 0, 7); ctx.arc(R * 0.35, -R * 0.2, R * 0.18, 0, 7); ctx.fill();
    }
    ctx.restore();
    // 背包
    if (o.backpack) {
      ctx.fillStyle = o.backpack; ctx.strokeStyle = '#1d231a';
      this._rr(ctx, -5.5 * s, R * 0.35, 11 * s, 8 * s, 3 * s); ctx.fill(); ctx.stroke();
    }
    // 战术背心
    if (o.vest) {
      ctx.fillStyle = o.vest; ctx.strokeStyle = '#15190f';
      ctx.fillRect(-R * 0.72, -R * 0.4, R * 1.44, R * 0.75);
      ctx.strokeRect(-R * 0.72, -R * 0.4, R * 1.44, R * 0.75);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(-R * 0.5, -R * 0.15, R * 0.34, R * 0.32);
      ctx.fillRect(R * 0.16, -R * 0.15, R * 0.34, R * 0.32);
    }
    // 翅膀/手臂
    ctx.fillStyle = o.col.body2 || o.col.body;
    ctx.strokeStyle = '#1d231a';
    if (o.zombie) {
      // 僵尸：双翅前伸
      ctx.save(); ctx.rotate(0);
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(sd * R * 0.85, -R * 0.55, 3.2 * s, 6.5 * s, sd * 0.5, 0, 7); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    } else {
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(sd * R * 0.88, R * 0.1, 3 * s, 5.5 * s, sd * 0.3, 0, 7); ctx.fill(); ctx.stroke();
      }
    }
    // 武器
    if (o.weapon) {
      ctx.save();
      ctx.translate(0, -R * 0.2);
      const sw = o.swingT || 0;
      ctx.rotate(sw > 0 ? Math.sin(sw * Math.PI) * 1.3 - 0.6 : 0);
      ctx.fillStyle = o.weapon.c; ctx.strokeStyle = '#12171c'; ctx.lineWidth = 1.2;
      if (o.weapon.gun) {
        ctx.fillRect(-2.4 * s, -16 * s, 4.8 * s, 17 * s); ctx.strokeRect(-2.4 * s, -16 * s, 4.8 * s, 17 * s);
        ctx.fillRect(-1.6 * s, -8 * s, 3.2 * s, 6 * s);
        if (o.weapon.muzzle === 'sil') { ctx.fillStyle = '#2b3238'; ctx.fillRect(-2 * s, -21 * s, 4 * s, 6 * s); }
        else if (o.weapon.muzzle === 'comp') { ctx.fillStyle = '#57616b'; ctx.fillRect(-2 * s, -20 * s, 4 * s, 5 * s); }
        if (o.weapon.scope) { ctx.fillStyle = o.weapon.scope; ctx.fillRect(-2 * s, -12 * s, 4 * s, 5 * s); }
      } else {
        // 近战：棍/斧/矛
        ctx.rotate(0.5);
        ctx.fillRect(-1.6 * s, -14 * s, 3.2 * s, 18 * s);
        if (o.weapon.blade) { ctx.fillStyle = '#c8d3dc'; ctx.beginPath(); ctx.moveTo(-2.2 * s, -14 * s); ctx.lineTo(2.2 * s, -14 * s); ctx.lineTo(0, -24 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        if (o.weapon.axeHead) { ctx.fillStyle = '#b8bcbf'; ctx.fillRect(-5 * s, -16 * s, 6 * s, 6 * s); }
      }
      ctx.restore();
    }
    // 头
    const hx = 0, hy = -R * 0.95;
    ctx.fillStyle = o.col.body; ctx.strokeStyle = '#1d231a';
    ctx.beginPath(); ctx.arc(hx, hy, R * 0.62, 0, 7); ctx.fill(); ctx.stroke();
    // 鸭嘴（扁平橙色）
    ctx.fillStyle = o.col.beak || '#e8973a';
    ctx.beginPath(); ctx.moveTo(hx - 3.6 * s, hy - R * 0.5); ctx.lineTo(hx + 3.6 * s, hy - R * 0.5); ctx.lineTo(hx, hy - R * 1.05); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 眼睛
    ctx.fillStyle = '#10151a';
    if (o.zombie) {
      ctx.strokeStyle = o.eye || '#c9d24a'; ctx.lineWidth = 1.3 * s;
      for (const sd of [-1, 1]) {
        const ex = hx + sd * 2.6 * s, ey = hy - 0.5 * s;
        ctx.beginPath(); ctx.moveTo(ex - 1.5 * s, ey - 1.5 * s); ctx.lineTo(ex + 1.5 * s, ey + 1.5 * s);
        ctx.moveTo(ex + 1.5 * s, ey - 1.5 * s); ctx.lineTo(ex - 1.5 * s, ey + 1.5 * s); ctx.stroke();
      }
    } else {
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.arc(hx + sd * 2.6 * s, hy - 0.5 * s, 1.3 * s, 0, 7); ctx.fill();
      }
    }
    // 头盔
    if (o.helmet) {
      ctx.fillStyle = o.helmet; ctx.strokeStyle = '#12171c';
      ctx.beginPath(); ctx.arc(hx, hy - 0.6 * s, R * 0.68, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (o.helmetStrap) { ctx.fillStyle = o.helmet; ctx.fillRect(hx - R * 0.6, hy - 0.8 * s, R * 1.2, 2 * s); }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  },

  _player(ctx) {
    const p = G.player;
    const w = Ent.activeWeapon(p);
    let weapon = null;
    if (w.d && w.d.cat === 'gun') {
      const att = w.it.attach || {};
      weapon = {
        gun: true, c: w.d.ic.c,
        muzzle: att.muzzle ? (att.muzzle.id === 'at_sil' ? 'sil' : 'comp') : null,
        scope: att.scope ? DB.it(att.scope.id).thermal ? '#e86a3a' : '#b0453a' : null
      };
    } else if (w.d) {
      weapon = { c: w.d.ic.c, blade: !!w.d.skill && (w.d.skill === 'blade' || w.d.skill === 'spear'), axeHead: w.d.dmg >= 38, len: w.d.rng };
    }
    const flash = p.flashlightOn && p.equip.light && p.equip.light.cond > 0;
    this.duck(ctx, {
      x: p.x, y: p.y, dir: p.dir, size: p.mods.obese ? 12.5 : 11,
      col: { body: '#ffd23f', body2: '#e8a41d', beak: '#f2a13c' },
      walk: p.moving ? this.t * 1.6 : 0,
      vest: p.equip.body ? DB.it(p.equip.body.id).cls >= 2 ? '#4b573a' : '#6b5a40' : null,
      backpack: p.equip.bag ? '#5a4a34' : null,
      helmet: p.equip.head ? DB.it(p.equip.head.id).cls >= 3 ? '#4b573a' : DB.it(p.equip.head.id).cls >= 1 ? '#8a8f70' : '#37506b' : null,
      helmetStrap: !!p.equip.head,
      weapon, swingT: p.swing ? 1 - (p.swing.t / p.swing.dur) : 0,
      alpha: p.dodgeT > 0 ? 0.55 : 1
    });
    // 翻滚残影
    if (p.dodgeT > 0) {
      ctx.strokeStyle = 'rgba(124,232,216,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 7); ctx.stroke();
    }
    // 手电眩点
    if (flash) {
      const mx = p.x + Math.cos(p.dir) * 18, my = p.y + Math.sin(p.dir) * 18;
      ctx.fillStyle = 'rgba(255,240,190,0.95)';
      ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, 7); ctx.fill();
    }
    // 行动进度弧
    if (p.action) {
      const k = p.action.t / p.action.dur;
      ctx.strokeStyle = '#f0b429'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y - 26, 12, -Math.PI / 2, -Math.PI / 2 + k * U.TAU); ctx.stroke();
    }
    p.swing && (p.swing.t += 1 / 60);
    if (p.swing && p.swing.t > p.swing.dur) p.swing = null;
  },

  _zombie(ctx, z) {
    let alpha = 1;
    if (z.d.camo) {
      // 迷彩体：热成像/被攻击显形；贴身可见
      const close = U.dist(z.x, z.y, G.player.x, G.player.y) < 110;
      const thermal = G.player.thermalOn;
      alpha = thermal || z.revealed > 0 ? 0.9 : (close ? 0.22 : 0.05);
      if (thermal) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(z.x, z.y, 2, z.x, z.y, 26);
        g.addColorStop(0, 'rgba(255,140,50,0.9)'); g.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, 26, 0, 7); ctx.fill();
        ctx.restore();
        return;
      }
    }
    // 蓄力红光（Boss/攻击前摇 · 鸭科夫亮红预警）
    const telegraph = z.windup > 0 || z.chargeT > 0;
    this.duck(ctx, {
      x: z.x, y: z.y, dir: z.dir, size: z.size, col: z.d.col,
      zombie: true, crawler: z.d.crawler, walk: z.state === 'chase' ? this.t * 2.4 : this.t * 0.7,
      vest: z.d.gear || null, helmet: z.d.gear || null, helmetStrap: !!z.d.gear,
      weapon: null, alpha
    });
    if (telegraph) {
      const pul = 0.5 + 0.5 * Math.sin(this.t * 18);
      ctx.strokeStyle = `rgba(255,70,50,${0.5 + pul * 0.5})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.size + 7 + pul * 3, 0, 7); ctx.stroke();
    }
    if (z.boss) {
      // Boss 血条挂钩（HUD 绘制）
      const k = U.clamp(z.hp / z.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(z.x - 26, z.y - z.size - 18, 52, 5);
      ctx.fillStyle = '#e5484d'; ctx.fillRect(z.x - 25, z.y - z.size - 17, 50 * k, 3);
    }
    // 受击白闪
    if (z.hitT > 0) { z.hitT -= 1 / 60; ctx.fillStyle = `rgba(255,255,255,${z.hitT * 2})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.size + 2, 0, 7); ctx.fill(); }
  },

  _overheadTrees(ctx) {
    // 树冠层（半透明遮顶 → 森林纵深）
    const W = G.world, cam = this.cam;
    const x0 = Math.max(0, Math.floor(cam.ox / 32) - 1), y0 = Math.max(0, Math.floor(cam.oy / 32) - 1);
    const x1 = Math.min(W.w - 1, Math.ceil((cam.ox + G.vw) / 32) + 1), y1 = Math.min(W.h - 1, Math.ceil((cam.oy + G.vh) / 32) + 1);
    ctx.globalAlpha = 0.88;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (W.tiles[ty * W.w + tx] !== T.FOREST) continue;
      const h = U.hash2(tx, ty);
      if (h < 0.55) continue;
      const cx = tx * 32 + 16 + (h * 10 - 5), cy = ty * 32 + 14;
      ctx.fillStyle = h > 0.8 ? '#3d4f36' : '#46583e';
      ctx.beginPath(); ctx.arc(cx, cy, 15 + h * 8, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.arc(cx - 4, cy - 4, 8 + h * 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a4632'; ctx.fillRect(cx - 2.5, cy + 8, 5, 9);
    }
    ctx.globalAlpha = 1;
  },

  _projectiles(ctx) {
    for (const b of G.projectiles) {
      const tl = Math.min(26, b.traveled);
      const x0 = b.x - b.dx * tl, y0 = b.y - b.dy * tl;
      const g = ctx.createLinearGradient(x0, y0, b.x, b.y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, b.tracer);
      ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 1.6, 0, 7); ctx.fill();
    }
  },

  // ---------------- 光照合成 ----------------
  _lighting(ctx) {
    if (!this.lightCv) { this.lightCv = document.createElement('canvas'); }
    const lc = this.lightCv;
    if (lc.width !== G.cv.width || lc.height !== G.cv.height) { lc.width = G.cv.width; lc.height = G.cv.height; }
    const lctx = lc.getContext('2d');
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const amb = G.ambient;
    const dark = 1 - amb;
    if (dark <= 0.06) return;
    lctx.clearRect(0, 0, G.vw, G.vh);
    lctx.fillStyle = `rgba(7,10,18,${Math.min(0.86, dark * 0.92)})`;
    lctx.fillRect(0, 0, G.vw, G.vh);
    lctx.globalCompositeOperation = 'destination-out';
    // 视锥
    const p = G.player, cam = this.cam;
    lctx.save();
    lctx.translate(-cam.ox, -cam.oy);
    const fov = G.fov;
    if (fov) {
      lctx.beginPath();
      lctx.moveTo(p.x, p.y);
      for (const [x, y] of fov.pts) lctx.lineTo(x, y);
      lctx.closePath();
      lctx.filter = 'blur(6px)';
      lctx.fillStyle = 'rgba(255,255,255,0.92)';
      lctx.fill();
      lctx.filter = 'none';
      // 贴身全向
      const g = lctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, fov.omni);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = g;
      lctx.beginPath(); lctx.arc(p.x, p.y, fov.omni, 0, 7); lctx.fill();
    }
    // 手电光锥（丁达尔感）
    const fl = p.flashlightOn && p.equip.light && p.equip.light.cond > 0;
    if (fl) {
      const beam = DB.it(p.equip.light.id).beam * 32;
      const endX = p.x + Math.cos(p.dir) * beam, endY = p.y + Math.sin(p.dir) * beam;
      const grad = lctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, beam);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.75, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.moveTo(p.x, p.y);
      lctx.arc(p.x, p.y, beam, p.dir - 0.30, p.dir + 0.30);
      lctx.closePath();
      lctx.fill();
      void endX; void endY;
    }
    // 路灯
    for (const L of G.world.lights) {
      if (G.world.cfg.storm) continue;
      if (Math.abs(L.x - cam.x) > G.vw / 2 + L.r || Math.abs(L.y - cam.y) > G.vh / 2 + L.r) continue;
      const g = lctx.createRadialGradient(L.x, L.y, 4, L.x, L.y, L.r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = g;
      lctx.beginPath(); lctx.arc(L.x, L.y, L.r, 0, 7); lctx.fill();
    }
    // 枪口焰
    for (const pa of G.particles) {
      if (pa.kind !== 'flash') continue;
      const g = lctx.createRadialGradient(pa.x, pa.y, 0, pa.x, pa.y, pa.r || 90);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = g;
      lctx.beginPath(); lctx.arc(pa.x, pa.y, pa.r || 90, 0, 7); lctx.fill();
    }
    lctx.restore();
    lctx.globalCompositeOperation = 'source-over';
    // 屏幕空间叠加
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lc, 0, 0);
    ctx.restore();
  },

  // ---------------- 天气 ----------------
  _weather(ctx, dt) {
    const wt = G.raid.weather.type;
    if (wt === 'rain' || wt === 'storm') {
      const heavy = wt === 'storm';
      const n = heavy ? 130 : 60;
      const wind = heavy ? 260 : 120;
      if (!this._rain) this._rain = [];
      const arr = this._rain;
      while (arr.length < n) arr.push({ x: Math.random() * G.vw, y: Math.random() * G.vh, s: 0.55 + Math.random() * 0.7 });
      ctx.strokeStyle = heavy ? 'rgba(178,205,225,0.34)' : 'rgba(178,205,225,0.22)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const r of arr) {
        r.x -= wind * r.s * dt * 0.6; r.y += 900 * r.s * dt;
        if (r.y > G.vh) { r.y = -10; r.x = Math.random() * (G.vw + 300); }
        if (r.x < -10) r.x += G.vw + 30;
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - wind * 0.02 * r.s, r.y + 14 * r.s);
      }
      ctx.stroke();
      if (heavy) {
        // 屏幕挂雨痕（扭曲条带）
        ctx.fillStyle = 'rgba(160,190,215,0.05)';
        for (let i = 0; i < 5; i++) {
          const x = (i * 397 + this.t * 23 * (i % 3 + 1)) % G.vw;
          ctx.fillRect(x, 0, 2 + (i % 3), G.vh);
        }
        ctx.fillStyle = `rgba(30,40,55,${0.16 + 0.05 * Math.sin(this.t * 2)})`;
        ctx.fillRect(0, 0, G.vw, G.vh);
      }
    }
    // 雷电白闪
    if (G.lightning > 0) {
      ctx.fillStyle = `rgba(220,235,255,${G.lightning * 0.55})`;
      ctx.fillRect(0, 0, G.vw, G.vh);
      G.lightning = Math.max(0, G.lightning - dt * 2.2);
    }
  },

  // ---------------- 热成像 ----------------
  _thermal(ctx) {
    const p = G.player;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.filter = 'grayscale(1) brightness(0.55) contrast(1.2)';
    ctx.drawImage(G.cv, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(22,34,58,0.42)';
    ctx.fillRect(0, 0, G.vw, G.vh);
    ctx.restore();
    // 热源（穿烟不穿墙）
    ctx.save();
    ctx.translate(-this.cam.ox, -this.cam.oy);
    ctx.globalCompositeOperation = 'lighter';
    const heat = (x, y, r, c1, c2) => {
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    };
    for (const z of G.zombies) {
      if (z.hp <= 0) continue;
      if (Math.abs(z.x - this.cam.x) > G.vw / 2 || Math.abs(z.y - this.cam.y) > G.vh / 2) continue;
      if (!FOV.clearLine(G.world, p.x, p.y, z.x, z.y)) continue;
      heat(z.x, z.y, z.size + 10, 'rgba(255,150,40,0.85)', 'rgba(255,40,10,0)');
    }
    heat(p.x, p.y, 16, 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)');
    if (G.world.generator && !G.world.generator.on) heat(G.world.generator.x, G.world.generator.y, 14, 'rgba(120,220,255,0.4)', 'rgba(120,220,255,0)');
    ctx.restore();
    // 扫描线
    ctx.save();
    ctx.fillStyle = 'rgba(255,120,60,0.03)';
    for (let y = (this.t * 40) % 6; y < G.vh; y += 6) ctx.fillRect(0, y, G.vw, 2);
    ctx.fillStyle = 'rgba(232,106,58,0.8)'; ctx.font = 'bold 11px Consolas';
    ctx.fillText('◉ THERMAL — 热成像激活', 14, G.vh - 14);
    ctx.restore();
  },

  // ---------------- 受击后处理 ----------------
  _postFX(ctx, dt) {
    const p = G.player;
    const hp = Sys.Health.overall(p);
    // 屏幕边缘血光（DOM vignette 呼吸）
    const vig = document.getElementById('vig');
    const bleed = Object.values(p.parts).some(pt => pt.bleed > 0 && !pt.bandaged);
    let inten = hp < 40 ? (1 - hp / 40) * 0.8 : 0;
    if (bleed) inten = Math.max(inten, 0.35);
    if (p.sick.knox > 0 && p.sick.knox < 500) inten = Math.max(inten, 0.4);
    vig.style.opacity = inten * (0.75 + 0.25 * Math.sin(this.t * 3));
    // 色散 + 噪点（疼痛/低血）
    const pain = p.painT > 0 ? 0 : Sys.Health.painLevel(p);
    if (hp < 45 || pain >= 2 || p.drunkT > 0) {
      const k = Math.max(hp < 45 ? (45 - hp) / 45 : 0, pain >= 2 ? 0.3 : 0, p.drunkT > 0 ? 0.25 : 0);
      const off = 1.5 + k * 2.5;
      try {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.10 + k * 0.1;
        ctx.drawImage(G.cv, off, 0);
        ctx.drawImage(G.cv, -off, 0);
        ctx.restore();
      } catch (e) { /* 自绘安全 */ }
      if (!this.noiseCv) {
        const nc = document.createElement('canvas'); nc.width = 160; nc.height = 160;
        const nx = nc.getContext('2d');
        const img = nx.createImageData(160, 160);
        for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 26; }
        nx.putImageData(img, 0, 0);
        this.noiseCv = nc;
      }
      ctx.save();
      ctx.globalAlpha = 0.35 + k * 0.3;
      const ox = (Math.random() * 160) | 0, oy = (Math.random() * 160) | 0;
      for (let x = -ox; x < G.vw; x += 160) for (let y = -oy; y < G.vh; y += 160) ctx.drawImage(this.noiseCv, x, y);
      ctx.restore();
    }
    // 恐慌心跳缩放
    if (p.panic > 55) {
      const beat = Math.pow(Math.abs(Math.sin(this.t * 4)), 8) * 0.012 * (p.panic / 100);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(G.vw / 2, G.vh / 2);
      ctx.scale(1 + beat, 1 + beat);
      ctx.translate(-G.vw / 2, -G.vh / 2);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(G.cv, 0, 0);
      ctx.restore();
    }
    void dt;
  },

  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

// ==================== 粒子 FX ====================
const FX = {
  update(dt, ctx) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const pa = G.particles[i];
      pa.t += dt;
      if (pa.t >= pa.life) { G.particles.splice(i, 1); continue; }
      const k = pa.t / pa.life;
      pa.x += pa.vx * dt; pa.y += pa.vy * dt;
      pa.vy += (pa.grav || 0) * dt;
      pa.rot = (pa.rot || 0) + (pa.vr || 0) * dt;
      switch (pa.kind) {
        case 'feather':
          pa.vx *= 0.96; pa.vy = pa.vy * 0.96 + 14 * dt * 0.5;
          pa.x += Math.sin(pa.t * 6 + pa.seed) * 12 * dt;
          ctx.save(); ctx.translate(pa.x, pa.y); ctx.rotate(pa.rot);
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = pa.c;
          ctx.beginPath(); ctx.ellipse(0, 0, 5, 1.8, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.5; ctx.stroke();
          ctx.restore(); ctx.globalAlpha = 1;
          break;
        case 'spark':
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = pa.c;
          ctx.fillRect(pa.x - 1.5, pa.y - 1.5, 3, 3);
          ctx.globalAlpha = 1;
          break;
        case 'debris':
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = pa.c;
          ctx.fillRect(pa.x - 2, pa.y - 2, 4, 3);
          ctx.globalAlpha = 1;
          break;
        case 'shell':
          ctx.save(); ctx.translate(pa.x, pa.y); ctx.rotate(pa.rot);
          ctx.fillStyle = '#c9a83a';
          ctx.fillRect(-2.5, -1.2, 5, 2.4);
          ctx.restore();
          break;
        case 'flash': {
          const a = 1 - k;
          ctx.save();
          ctx.translate(pa.x, pa.y); ctx.rotate(pa.a);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.fillStyle = pa.c;
          ctx.beginPath();
          for (let s = 0; s < 4; s++) {
            ctx.rotate(Math.PI / 2);
            ctx.moveTo(0, 0); ctx.lineTo(26, -3); ctx.lineTo(34, 0); ctx.lineTo(26, 3);
          }
          ctx.fill();
          ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
          ctx.restore(); ctx.globalAlpha = 1;
          break;
        }
        case 'text':
          ctx.globalAlpha = 1 - k * k;
          ctx.fillStyle = pa.c;
          ctx.font = 'bold 12px Consolas';
          ctx.textAlign = 'center';
          ctx.fillText(pa.txt, pa.x, pa.y - k * 26);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
          break;
        case 'ring':
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.strokeStyle = pa.c;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(pa.x, pa.y, (pa.r || 40) * (1 - k * 0.4), 0, 7); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        case 'tracer':
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = pa.c; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pa.x2, pa.y2); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
      }
    }
    if (G.particles.length > 420) G.particles.splice(0, G.particles.length - 420);
  },
  feather(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = U.rf(0, U.TAU), sp = U.rf(30, 130);
      G.particles.push({ kind: 'feather', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, rot: U.rf(0, 7), vr: U.rf(-6, 6), t: 0, life: U.rf(0.7, 1.4), c: U.chance(0.6) ? '#ffe98a' : '#fff6d8', seed: U.rf(0, 7) });
    }
  },
  debris(x, y, c) {
    for (let i = 0; i < 5; i++) {
      const a = U.rf(0, U.TAU);
      G.particles.push({ kind: 'debris', x, y, vx: Math.cos(a) * U.rf(20, 90), vy: Math.sin(a) * U.rf(20, 90), t: 0, life: U.rf(0.25, 0.5), c: c || '#8d99a6' });
    }
  },
  flash(x, y, a, c) {
    G.particles.push({ kind: 'flash', x, y, a, c: c || '#ffd98a', t: 0, life: 0.06, r: 110 });
  },
  shell(x, y, dir) {
    const a = dir + Math.PI / 2 + U.rf(-0.4, 0.4);
    G.particles.push({ kind: 'shell', x, y, vx: Math.cos(a) * U.rf(50, 110), vy: Math.sin(a) * U.rf(50, 110), rot: dir, vr: U.rf(-14, 14), t: 0, life: 1.1, grav: 160 });
  },
  tracer(x0, y0, x1, y1, c) {
    G.particles.push({ kind: 'tracer', x: x0, y: y0, x2: x1, y2: y1, c, t: 0, life: 0.09 });
  },
  text(x, y, txt, c) {
    G.particles.push({ kind: 'text', x, y, txt: String(txt), c: c || '#fff', t: 0, life: 0.85 });
  },
  ring(x, y, r, c, dur) {
    G.particles.push({ kind: 'ring', x, y, r, c, t: 0, life: dur || 0.8 });
  },
  shake(a) { Render.cam.shake = Math.min(14, Render.cam.shake + a); }
};
window.Render = Render; window.FX = FX;
