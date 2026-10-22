// ============================================================
//  renderer.js — 渲染管线（鸭科夫视觉语言）
//  卡通着色 + 深描边 + 战争迷雾 + 手电体积光锥 + 热成像 + 低血暗角 + 风暴 + 粒子
// ============================================================
import { shade, desat, celColor, rgba, OUTLINE, CHAR, ENV, TRACER, mix } from '../core/palette.js';
import { floorDef, wallDef, objDef } from '../world/tiles.js';
import { clamp } from '../core/util.js';

const OBJ_GLYPH = {
  '桌': '🟫', '椅': '🪑', '架': '📚', '柜': '🗄️', '冰箱': '🧊', '厨房': '🍳', '床': '🛏️',
  '箱': '📦', '医疗箱': '➕', '枪柜': '🔫', '书桌': '🗄️', '衣柜': '👕', '垃圾桶': '🗑️',
  '工具箱': '🧰', '保险箱': '🔒', '弹药箱': '📦', '实验柜': '🧪', '沙发': '🛋️', '托盘': '🟫',
  '实验台': '🔬', '桶': '🛢️', '配电': '⚡', '发电机': '⚙️', '工作台': '🔧', '炉灶': '🍳',
  '健身': '🏋️', '电子': '💻', '医疗': '⚕️', '储藏': '🎒', '飞船': '🚀', '部署': '🛰️',
  '防空': '🚀', '矿车': '🛒', '车': '🚗', '尸': '💀', '灌木': '🌿', '树': '🌲',
  '柜台': '🟫', '玻璃': '🔷', '集装箱': '📦', '栅栏': '🚧', '岩石': '🪨', '水': '🌊',
};
function glyph(name) {
  for (const k in OBJ_GLYPH) if (name && name.indexOf(k) >= 0) return OBJ_GLYPH[k];
  return '▦';
}

export class Renderer {
  constructor(game) { this.g = game; this.TS = 34; }

  draw() {
    const g = this.g, ctx = g.ctx, lv = g.level;
    if (!lv) return;
    const W = ctx.canvas.width, H = ctx.canvas.height, TS = this.TS, cam = g.cam;
    const ox = W / 2 - cam.x * TS, oy = H / 2 - cam.y * TS;
    this.ox = ox; this.oy = oy; this.TS_ = TS;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, W, H);

    const x0 = Math.max(0, Math.floor((0 - ox) / TS)), x1 = Math.min(lv.w - 1, Math.ceil((W - ox) / TS));
    const y0 = Math.max(0, Math.floor((0 - oy) / TS)), y1 = Math.min(lv.h - 1, Math.ceil((H - oy) / TS));

    // ---- 地面 / 墙 / 物体 ----
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const idx = lv.i(x, y), sx = ox + x * TS, sy = oy + y * TS;
      const seen = lv.seen[idx], vis = lv.vis[idx];
      if (!seen) continue;
      const L = lv.light[idx];
      const band = vis ? celColor('#ffffff', clamp(L, 0, 1)) : '#7a828c';
      // 地面
      const f = lv.floor[idx];
      if (f) {
        const fd = floorDef(f);
        let col = vis ? celColor(fd.col, clamp(L + 0.15, 0, 1)) : shade(fd.col, 0.42);
        ctx.fillStyle = col; ctx.fillRect(sx, sy, TS + 1, TS + 1);
        if (fd.chec) { ctx.fillStyle = rgba(fd.col, 0.5); for (let c = 0; c < 3; c++) ctx.fillRect(sx + ((c * 11) % TS), sy + ((c * 17) % TS), 2, 2); }
      }
      // 血迹
      if (lv.blood[idx] > 0.5 && vis) { ctx.fillStyle = rgba(ENV.blood, clamp(lv.blood[idx] / 6, 0.1, 0.7)); ctx.fillRect(sx, sy, TS, TS); }
      // 墙
      const w = lv.wall[idx];
      if (w) {
        const wd = wallDef(w);
        const wc = vis ? celColor(wd.col, clamp(L + 0.1, 0, 1)) : shade(wd.col, 0.4);
        ctx.fillStyle = wc; ctx.fillRect(sx + 1, sy + 1, TS - 2, TS - 2);
        // 顶部高光（赛璐璐）
        ctx.fillStyle = shade(wc, 1.25); ctx.fillRect(sx + 1, sy + 1, TS - 2, 4);
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.strokeRect(sx + 1.5, sy + 1.5, TS - 3, TS - 3);
      }
      // 门
      const dr = lv.doorMap.get(idx);
      if (dr) this.drawDoor(ctx, sx, sy, TS, dr);
      const wn = lv.winMap.get(idx);
      if (wn) this.drawWindow(ctx, sx, sy, TS, wn);
      // 物体
      const o = lv.obj[idx];
      if (o && vis) this.drawObj(ctx, sx, sy, TS, o, x, y);
      // 战争迷雾（seen 但不可见）
      if (seen && !vis) { ctx.fillStyle = 'rgba(5,7,11,0.55)'; ctx.fillRect(sx, sy, TS + 1, TS + 1); }
    }

    // ---- 标记 / 撤离点 ----
    for (const m of lv.markers) if (lv.seen[lv.i(m.x, m.y)]) this.drawMarker(ctx, ox + m.x * TS, oy + m.y * TS, TS, m, g);
    for (const ex of lv.extractions) this.drawExtract(ctx, ox + ex.x * TS, oy + ex.y * TS, TS, ex, g);

    // ---- 地面物品 ----
    for (const [idx, items] of lv.ground) {
      if (!items || !items.length) continue;
      if (!lv.vis[idx]) continue;
      const x = idx % lv.w, y = (idx / lv.w) | 0;
      const sx = ox + x * TS + TS / 2, sy = oy + y * TS + TS / 2;
      ctx.fillStyle = rgba(CHAR.duckYellow, 0.9);
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('•', sx, sy - 6);
    }

    // ---- 实体（按 y 排序）----
    const draws = [];
    for (const e of g.enemies) if (!e.dead || g.time - e.deathT < 1.4) draws.push({ y: e.y, fn: () => this.drawEnemy(ctx, e, ox, oy, TS, g) });
    draws.push({ y: g.player.y, fn: () => this.drawPlayer(ctx, g.player, ox, oy, TS, g) });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.fn();

    // ---- 抛射物 ----
    this.drawProjectiles(ctx, g, ox, oy, TS);
    // ---- 粒子 ----
    this.drawParticles(ctx, g, ox, oy, TS);

    // ---- 手电体积光锥 ----
    if (g.player.light && g.night) this.drawFlashlight(ctx, g, ox, oy, TS, W, H);

    // ---- 热成像 ----
    if (g.player.thermal) this.drawThermal(ctx, g, W, H);

    // ---- 风暴 ----
    if (lv.weather === 'storm') this.drawStorm(ctx, g, W, H);
  }

  drawDoor(ctx, sx, sy, TS, dr) {
    const vert = dr.vert;
    ctx.save();
    if (dr.open) {
      ctx.strokeStyle = shade(ENV.woodFloor, 1.2); ctx.lineWidth = 3;
      ctx.beginPath();
      if (vert) { ctx.moveTo(sx + TS / 2, sy + 4); ctx.lineTo(sx + TS / 2, sy + TS - 4); }
      else { ctx.moveTo(sx + 4, sy + TS / 2); ctx.lineTo(sx + TS - 4, sy + TS / 2); }
      ctx.stroke();
    } else {
      ctx.fillStyle = dr.locked ? shade(ENV.rust, 0.9) : ENV.woodFloor;
      if (vert) ctx.fillRect(sx + TS / 2 - 4, sy + 2, 8, TS - 4);
      else ctx.fillRect(sx + 2, sy + TS / 2 - 4, TS - 4, 8);
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.strokeRect(sx + 2, sy + 2, TS - 4, TS - 4);
      if (dr.barricade > 0) { ctx.fillStyle = rgba(ENV.crate, 0.9); ctx.fillRect(sx + 4, sy + 4, TS - 8, TS - 8); }
    }
    ctx.restore();
  }
  drawWindow(ctx, sx, sy, TS, wn) {
    ctx.fillStyle = wn.broken ? rgba(ENV.glass, 0.15) : rgba(ENV.glass, 0.5);
    ctx.fillRect(sx + 3, sy + 3, TS - 6, TS - 6);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.strokeRect(sx + 3, sy + 3, TS - 6, TS - 6);
  }
  drawObj(ctx, sx, sy, TS, o, x, y) {
    const lv = this.g.level;
    const od = objDef(o);
    // 底色块
    ctx.fillStyle = shade(od.col, 1.0);
    this.roundRect(ctx, sx + 4, sy + 4, TS - 8, TS - 8, 4); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.stroke();
    // 字形
    ctx.font = `${TS * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph(od.name), sx + TS / 2, sy + TS / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    // 可搜刮提示
    const c = lv.contMap.get(lv.i(x, y));
    if (c && !c.searched) { ctx.fillStyle = CHAR.duckYellow; ctx.font = 'bold 12px sans-serif'; ctx.fillText('?', sx + TS - 8, sy + 10); }
  }

  drawMarker(ctx, sx, sy, TS, m, g) {
    const col = m.kind === 'boss' ? '#ff5a4a' : m.kind === 'card' ? '#7de3ff' : m.kind === 'power' ? '#ffd24a' : m.kind === 'poi' ? '#c77dff' : '#7fb7c9';
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 3);
    ctx.fillStyle = rgba(col, 0.18 + pulse * 0.2);
    ctx.beginPath(); ctx.arc(sx + TS / 2, sy + TS / 2, TS * 0.7, 0, 6.28); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx + TS / 2, sy + TS / 2, TS * 0.5, 0, 6.28); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(m.label, sx + TS / 2, sy - 4);
    ctx.restore();
  }
  drawExtract(ctx, sx, sy, TS, ex, g) {
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 2.5);
    ctx.save();
    ctx.strokeStyle = rgba('#7dffb0', 0.5 + pulse * 0.5); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx + TS / 2, sy + TS / 2, TS * (ex.r || 2) * 0.6, 0, 6.28); ctx.stroke();
    ctx.fillStyle = '#bfffe0'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('撤离', sx + TS / 2, sy - 6);
    ctx.restore();
  }

  // ---------------- 角色（卡通鸭） ----------------
  drawPlayer(ctx, P, ox, oy, TS, g) {
    let body = CHAR.duckYellow;
    if (P.body.dead) body = desat(body, 0.4);
    else if (P.body.stats.sickness > 50) body = mix(body, CHAR.duckSick, P.body.stats.sickness / 100);
    const colors = {
      body, belly: CHAR.duckWhite, beak: CHAR.beak,
      helm: P.eq.helm ? '#8a8f96' : null,
      vest: P.eq.vest ? '#4d5340' : null, outline: OUTLINE,
    };
    const sx = ox + P.x * TS, sy = oy + P.y * TS;
    this.drawDuck(ctx, sx, sy, TS * 0.46, P.facing, colors, { rolling: P.rolling, bleeding: P.body.bleeding() > 0, dead: P.body.dead, thermal: P.thermal });
    if (P.sneaking) { ctx.strokeStyle = rgba('#7fb7c9', 0.5); ctx.beginPath(); ctx.ellipse(sx, sy + TS * 0.4, TS * 0.5, TS * 0.25, 0, 0, 6.28); ctx.stroke(); }
  }
  eqId(it) { return it ? it.id : 0; }

  drawEnemy(ctx, e, ox, oy, TS, g) {
    if (e.dead) {
      const a = clamp(1 - (g.time - e.deathT) / 1.4, 0, 1);
      const sx = ox + e.x * TS, sy = oy + e.y * TS;
      this.drawDuck(ctx, sx, sy, TS * 0.46 * e.size, e.facing + 1.57, { body: desat(e.def.body, 0.5), belly: '#888', beak: CHAR.beakDark, outline: OUTLINE }, { dead: true, alpha: a });
      return;
    }
    // 隐身：仅在热成像/极近时可见
    if (e.invisible && !g.player.thermal && dist(g.player.x, g.player.y, e.x, e.y) > 2.6) {
      return;
    }
    const sx = ox + e.x * TS, sy = oy + e.y * TS;
    let body = e.def.body;
    if (g.player.thermal) body = mix('#ff6a2a', '#ffd24a', clamp(e.hp / e.maxhp, 0, 1));
    else if (e.invisible) body = rgba(e.def.body, 0.28);
    const colors = {
      body, belly: shade(body, 1.1), beak: CHAR.beakDark,
      helm: e.def.gear && e.def.gear.helm ? e.def.gear.helm : null,
      vest: e.def.gear && e.def.gear.vest ? e.def.gear.vest : null, outline: OUTLINE,
    };
    const opts = { bleeding: e.bleed > 0, burning: e.burning > 0, charging: e.charging, tell: e.tellT > 0 || e.slamT > 0, boss: e.def.boss, thermal: g.player.thermal, alpha: e.invisible ? 0.5 : 1 };
    this.drawDuck(ctx, sx, sy, TS * 0.46 * e.size, e.facing, colors, opts);
    // 血条
    if (e.hp < e.maxhp && !g.player.thermal) {
      const w = TS * 0.7, hp = clamp(e.hp / e.maxhp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - w / 2, sy - TS * 0.55, w, 4);
      ctx.fillStyle = e.def.boss ? '#ff5a4a' : '#ff8a5a'; ctx.fillRect(sx - w / 2, sy - TS * 0.55, w * hp, 4);
    }
  }

  drawDuck(ctx, sx, sy, s, facing, c, o) {
    ctx.save();
    ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    ctx.translate(sx, sy); ctx.rotate(facing);
    if (o.dead) ctx.globalAlpha *= 0.6;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, s * 0.55, s * 1.1, s * 0.5, 0, 0, 6.28); ctx.fill();
    const body = c.body;
    ctx.lineWidth = Math.max(2, s * 0.13); ctx.strokeStyle = c.outline;
    // 身体
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, s * 1.0, s * 0.78, 0, 0, 6.28); ctx.fill(); ctx.stroke();
    // 下部暗面（赛璐璐）
    ctx.fillStyle = shade(body, 0.6); ctx.beginPath(); ctx.ellipse(0, s * 0.28, s * 0.92, s * 0.5, 0, 0, 3.14); ctx.fill();
    // 尾
    ctx.fillStyle = shade(body, 0.85);
    ctx.beginPath(); ctx.moveTo(-s * 0.9, 0); ctx.lineTo(-s * 1.35, -s * 0.32); ctx.lineTo(-s * 1.35, s * 0.32); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 翅膀
    if (c.vest) { ctx.fillStyle = c.vest; ctx.fillRect(-s * 0.65, -s * 0.55, s * 0.9, s * 1.1); ctx.strokeRect(-s * 0.65, -s * 0.55, s * 0.9, s * 1.1); }
    ctx.fillStyle = shade(body, 0.7); ctx.beginPath(); ctx.ellipse(-s * 0.1, 0, s * 0.5, s * 0.42, 0, 0, 6.28); ctx.fill(); ctx.stroke();
    // 头
    const hc = o.thermal ? body : (c.belly || shade(body, 1.1));
    ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(s * 0.8, 0, s * 0.55, 0, 6.28); ctx.fill(); ctx.stroke();
    if (c.helm) { ctx.fillStyle = c.helm; ctx.beginPath(); ctx.arc(s * 0.8, -s * 0.05, s * 0.58, Math.PI, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
    // 喙
    ctx.fillStyle = c.beak || CHAR.beak; ctx.beginPath(); ctx.moveTo(s * 1.2, -s * 0.18); ctx.lineTo(s * 1.7, 0); ctx.lineTo(s * 1.2, s * 0.18); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 眼
    ctx.fillStyle = '#14151c'; ctx.beginPath(); ctx.arc(s * 0.95, -s * 0.2, s * 0.1, 0, 6.28); ctx.fill();
    // 状态
    if (o.bleeding) { ctx.fillStyle = '#c0202a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-s * 0.3 + i * s * 0.3, s * 0.3, 2, 0, 6.28); ctx.fill(); } }
    if (o.burning) { ctx.fillStyle = rgba('#ff8c1a', 0.7 + 0.3 * Math.sin(performance.now() / 60)); ctx.beginPath(); ctx.arc(0, -s * 0.4, s * 0.5, 0, 6.28); ctx.fill(); }
    if (o.tell) { ctx.strokeStyle = rgba('#ff3a3a', 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, s * 1.4, 0, 6.28); ctx.stroke(); }
    ctx.restore();
  }

  drawFlashlight(ctx, g, ox, oy, TS, W, H) {
    const P = g.player; const px = ox + P.x * TS, py = oy + P.y * TS;
    const len = TS * 16, half = 0.6, a = P.facing;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(px, py, 0, px, py, len);
    grad.addColorStop(0, 'rgba(255,238,200,0.40)');
    grad.addColorStop(0.5, 'rgba(255,238,200,0.12)');
    grad.addColorStop(1, 'rgba(255,238,200,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, len, a - half, a + half); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  drawThermal(ctx, g, W, H) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(10,40,20,0.4)'; ctx.fillRect(0, 0, W, H);
    for (const e of g.enemies) {
      if (e.dead) continue;
      const sx = this.ox + e.x * this.TS_, sy = this.oy + e.y * this.TS_;
      const r = this.TS_ * 0.5 * e.size;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2);
      grad.addColorStop(0, 'rgba(255,180,60,0.9)'); grad.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sx, sy, r * 2, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }
  drawStorm(ctx, g, W, H) {
    ctx.save(); ctx.strokeStyle = 'rgba(150,180,210,0.22)'; ctx.lineWidth = 1;
    const t = g.time * 500;
    const wind = Math.sin(g.time * 0.5) * 3;
    for (let i = 0; i < 140; i++) {
      const rx = (i * 137 + t + wind * i * 0.1) % W;
      const ry = (i * 89 + t * 1.7) % H;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4 + wind, ry + 14); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,30,45,0.10)'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawProjectiles(ctx, g, ox, oy, TS) {
    for (const p of g.projectiles) {
      const sx = ox + p.x * TS, sy = oy + p.y * TS;
      if (p.kind === 'throw') {
        ctx.fillStyle = p.fire ? '#ff8c1a' : '#3a4a30';
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, 6.28); ctx.fill();
      } else {
        const tx = ox + (p.x - p.vx * 0.03) * TS, ty = oy + (p.y - p.vy * 0.03) * TS;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.tracer; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 2, 0, 6.28); ctx.fill();
        ctx.restore();
      }
    }
  }
  drawParticles(ctx, g, ox, oy, TS) {
    for (const p of g.particles) {
      const sx = ox + p.x * TS, sy = oy + p.y * TS;
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'muzzle') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
        g2.addColorStop(0, rgba('#fff3c0', a)); g2.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, 6.28); ctx.fill(); ctx.restore();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = rgba('#ffcf5a', a); ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      } else if (p.kind === 'blood') {
        ctx.fillStyle = rgba(ENV.blood, a); ctx.beginPath(); ctx.arc(sx, sy, 3 * a + 1, 0, 6.28); ctx.fill();
      } else if (p.kind === 'feather') {
        ctx.fillStyle = rgba('#eef0e6', a); ctx.font = '12px sans-serif'; ctx.fillText('❂', sx, sy);
      } else if (p.kind === 'boom' || p.kind === 'shock' || p.kind === 'tell') {
        const col = p.kind === 'tell' ? '#ff3a3a' : p.kind === 'shock' ? '#ffd24a' : '#ff8c1a';
        ctx.strokeStyle = rgba(col, a); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, (p.r || 2) * TS * (1 - a) + 4, 0, 6.28); ctx.stroke();
      }
    }
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------------- 小地图 ----------------
  drawMinimap(mm, g) {
    const ctx = mm.getContext('2d'), lv = g.level; if (!lv) return;
    const W = mm.width, H = mm.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0a0d14'; ctx.fillRect(0, 0, W, H);
    const s = Math.min(W / lv.w, H / lv.h);
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      const idx = lv.i(x, y); if (!lv.seen[idx]) continue;
      const f = lv.floor[idx];
      if (f) { ctx.fillStyle = lv.vis[idx] ? '#3a4350' : '#222831'; ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5); }
      if (lv.wall[idx]) { ctx.fillStyle = '#6a727c'; ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5); }
    }
    for (const m of lv.markers) { if (!lv.seen[lv.i(m.x, m.y)]) continue; ctx.fillStyle = m.kind === 'boss' ? '#ff5a4a' : '#7de3ff'; ctx.fillRect(m.x * s - 1, m.y * s - 1, 3, 3); }
    for (const ex of lv.extractions) { ctx.fillStyle = '#7dffb0'; ctx.fillRect(ex.x * s - 1, ex.y * s - 1, 3, 3); }
    for (const e of g.enemies) { if (e.dead) continue; if (e.invisible && !g.player.thermal) continue; ctx.fillStyle = e.faction === 'zed' ? '#a8c86a' : e.def.boss ? '#ff5a4a' : '#ffb347'; ctx.fillRect(e.x * s - 1, e.y * s - 1, 2.5, 2.5); }
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(g.player.x * s - 1.5, g.player.y * s - 1.5, 3, 3);
  }
}

// 本地距离
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
