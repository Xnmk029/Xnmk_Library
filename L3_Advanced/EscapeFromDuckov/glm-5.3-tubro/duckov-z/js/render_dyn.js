/* DUCKOV Z - 动态合成：实体/光照/视野遮蔽/天气/后期 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U, W = DZ.W, T = W.T, RM = DZ.RM;
  const RD = {};
  let dark = null, darkCtx = null, glow = null, glowCtx = null;
  let rainDrops = [], fogBlobs = [], lightningT = 8;
  const dom = {};

  RD.init = function () {
    if (typeof document === 'undefined') return;
    dom.vig = document.getElementById('vig');
    dom.flash = document.getElementById('flash');
    dom.tint = document.getElementById('tint');
  };

  function ensureBuffers(w, h) {
    if (!dark || dark.width !== w || dark.height !== h) {
      dark = document.createElement('canvas'); dark.width = w; dark.height = h; darkCtx = dark.getContext('2d');
      glow = document.createElement('canvas'); glow.width = w; glow.height = h; glowCtx = glow.getContext('2d');
    }
  }

  // ---------- 主帧 ----------
  RD.frame = function (ctx, S, cam, dt, vw, vh, mouse) {
    const pl = S.player;
    if (!pl) return;
    const sc = cam.scale;
    const timeSec = performance.now() / 1000;
    // 视野多边形
    const hour = S.mins / 60;
    const wMul = S.weather.cur === 'fog' ? C.VISION.fogMul : S.weather.cur === 'rain' ? C.VISION.rainMul : S.weather.cur === 'storm' ? C.VISION.stormMul : 1;
    const indoor = roomAt(S, pl.x, pl.y);
    let visR = U.isNight(S.mins) ? C.VISION.nightR : (hour > 18.6 || hour < 6.8 ? C.VISION.dayR * 0.7 : C.VISION.dayR);
    if (indoor >= 0) visR = Math.max(visR, S.powerOn ? C.VISION.indoorLitR : C.VISION.indoorDarkR);
    visR *= wMul * (pl.crouch ? 0.9 : 1);
    if (pl.flashlight) visR = Math.max(visR, 4);
    S.visPoly = DZ.FOV.compute(S, pl.x, pl.y, Math.max(visR, 3));
    markExplored(S, pl.x, pl.y, Math.min(visR + 2, 11));
    // 天气粒子初始化
    initWeather(S, dt);

    ctx.save();
    ctx.fillStyle = '#101310';
    ctx.fillRect(0, 0, vw, vh);
    // 相机（含震屏）
    let shx = 0, shy = 0;
    if (DZ.FX.shakes > 0) { shx = (Math.random() - 0.5) * DZ.FX.shakes; shy = (Math.random() - 0.5) * DZ.FX.shakes; }
    ctx.translate(vw / 2 + shx, vh / 2 + shy);
    ctx.scale(sc, sc);
    ctx.translate(-cam.x, -cam.y);
    const view = { x0: cam.x - vw / 2 / sc - 40, y0: cam.y - vh / 2 / sc - 40, x1: cam.x + vw / 2 / sc + 40, y1: cam.y + vh / 2 / sc + 40 };

    // 焦痕
    for (const d of DZ.FX.decals) {
      ctx.fillStyle = `rgba(20,18,16,${Math.min(0.5, d.t / 10)})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
    }
    // 地面
    if (S.groundCanvas) ctx.drawImage(S.groundCanvas, 0, 0);
    // 尸体
    for (const c of S.corpses) {
      if (c.x < view.x0 || c.x > view.x1 || c.y < view.y0 || c.y > view.y1) continue;
      if (!inVis(S, c.x, c.y, pl)) continue;
      drawCorpse(ctx, c);
    }
    // 弹壳
    for (const sh of DZ.FX.shells) {
      ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.rot);
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(-3, -1.4, 6, 2.8);
      ctx.strokeStyle = 'rgba(30,30,30,0.8)'; ctx.lineWidth = 0.8; ctx.strokeRect(-3, -1.4, 6, 2.8);
      ctx.restore();
    }
    // 篝火/收集器/火焰
    for (const f of S.fires) drawFire(ctx, f, timeSec);
    for (const r of S.raincols) {
      ctx.fillStyle = '#5d6470'; RM.roundRect(ctx, r.x - 12, r.y - 14, 24, 28, 3); ctx.fill();
      ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#4a7a8f'; ctx.fillRect(r.x - 8, r.y - 10 + (1 - Math.min(1, r.water / 10)) * 20, 16, Math.min(1, r.water / 10) * 20);
    }
    // 噪音涟漪
    for (const n of S.noises) {
      const k = n.t / 0.55;
      ctx.strokeStyle = `rgba(255,220,150,${k * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (1 - k), 0, 7); ctx.stroke();
    }
    // 僵尸
    for (const z of S.zombies) {
      if (z.dead || z.x < view.x0 || z.x > view.x1 || z.y < view.y0 || z.y > view.y1) continue;
      if (!inVis(S, z.x, z.y, pl)) continue;
      RM.drawDuck(ctx, {
        x: z.x, y: z.y, a: z.a, scale: z.scale * 1.15, zomb: true, crawl: z.crawl,
        walkPhase: z.walkPhase, windup: z.windup, flash: z.flashT > 0
      });
      // 血条（受击后短暂显示）
      if (z.hp < z.max && z.flashT > -0.6) {
        ctx.fillStyle = 'rgba(20,22,26,0.75)';
        ctx.fillRect(z.x - 16, z.y - 26 * z.scale, 32, 5);
        ctx.fillStyle = C.PAL.danger;
        ctx.fillRect(z.x - 15, z.y - 25 * z.scale, 30 * Math.max(0, z.hp / z.max), 3);
      }
    }
    // 燃烧瓶抛物线
    for (const m of DZ.FX.molotovs) {
      ctx.fillStyle = '#c9871f';
      ctx.strokeStyle = C.PAL.outline;
      ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,150,50,0.5)';
      ctx.fillRect(m.x - 1, m.y - 9, 2, 5);
    }
    // 玩家
    if (!pl.dead) {
      const vestDef = pl.slots.vest ? DZ.IT.def(pl.slots.vest.id).gear : null;
      const packDef = pl.slots.pack ? DZ.IT.def(pl.slots.pack.id).gear : null;
      const helmLv = pl.slots.head ? (DZ.IT.def(pl.slots.head.id).gear.lv || 1) : 0;
      const wI = pl.slots.melee, gI = pl.slots.primary;
      let weapon = null;
      if (pl.swingT > 0 && wI) weapon = melIcon(wI.id);
      else if (gI) weapon = 'g' + DZ.IT.def(gI.id).gun;
      else if (wI) weapon = melIcon(wI.id);
      RM.drawDuck(ctx, {
        x: pl.x, y: pl.y, a: pl.a, scale: 1.15,
        walkPhase: pl.walkPhase, roll: pl.rolling > 0 ? (1 - pl.rolling / 0.28) : 0,
        helm: helmLv, vest: vestDef ? ['#5d6470', '#49523d', '#3d4348'][(vestDef.lv || 1) - 1] : null,
        packCol: packDef ? { packS: '#7a4a8f', packL: '#5d6470', milpack: '#49523d' }[pl.slots.pack.id] : null,
        nv: pl.nv, weapon
      });
      // 稳瞄激光
      if (pl.aiming && gI) {
        ctx.strokeStyle = 'rgba(255,80,60,0.35)';
        ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pl.x + Math.cos(pl.a) * 20, pl.y + Math.sin(pl.a) * 20);
        ctx.lineTo(pl.x + Math.cos(pl.a) * 300, pl.y + Math.sin(pl.a) * 300);
        ctx.stroke(); ctx.setLineDash([]);
      }
      // 抓握挣扎提示
      if (pl.grabbedBy) {
        ctx.fillStyle = '#ff5a49';
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('SPACE!', pl.x, pl.y - 34);
      }
    }
    // 曳光
    for (const t of DZ.FX.tracers) {
      const k = t.t / t.max;
      ctx.strokeStyle = t.col;
      ctx.globalAlpha = k;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 粒子
    drawParticles(ctx, timeSec);
    // 浮动文字
    ctx.font = 'bold 13px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    for (const f of DZ.FX.floaters) {
      ctx.globalAlpha = Math.min(1, f.t / f.max);
      ctx.fillStyle = f.col;
      ctx.strokeStyle = 'rgba(10,10,14,0.8)'; ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    // 树冠
    RM.drawCanopy(ctx, S, view.x0 / C.TILE | 0, view.y0 / C.TILE | 0, view.x1 / C.TILE | 0, view.y1 / C.TILE | 0, timeSec);
    // 门窗动态层
    drawDoorsWins(ctx, S, view);
    // 屋顶
    for (const B of S.buildings) {
      B.fadeTarget = insideBuilding(B, pl.x, pl.y) ? 0 : 1;
      B.fade += (B.fadeTarget - B.fade) * Math.min(1, dt * 8);
      if (B.fade < 0.03) continue;
      const rc = S.roofCanvases.get(B.id);
      if (!rc) continue;
      ctx.globalAlpha = B.fade;
      ctx.drawImage(rc, B.x * C.TILE - 20, B.y * C.TILE - 20);
      ctx.globalAlpha = 1;
    }
    // 撤离信标
    if (S.evacOpen) drawEvac(ctx, S.evac, timeSec);
    // ---- 光照 ----
    applyLighting(ctx, S, pl, cam, vw, vh, sc, timeSec);
    // ---- FoV 遮蔽 ----
    applyFovShade(ctx, S, pl, cam, vw, vh, sc);
    ctx.restore();

    // ---- 屏幕空间：天气/后期 ----
    drawWeatherScreen(ctx, S, dt, vw, vh);
    updatePostFX(S, pl, dt);
    drawCrosshair(ctx, S, mouse, vw, vh);
    // 撤离方向指示
    if (S.evacOpen) edgeArrow(ctx, pl, S.evac, vw, vh);
  };

  function roomAt(S, px, py) {
    const tx = px / C.TILE | 0, ty = py / C.TILE | 0;
    if (tx < 0 || ty < 0 || tx >= C.MW || ty >= C.MH) return -1;
    return S.room[ty * C.MW + tx];
  }
  function insideBuilding(B, px, py) {
    return px > B.x * C.TILE && px < (B.x + B.w) * C.TILE && py > B.y * C.TILE && py < (B.y + B.h) * C.TILE;
  }
  function inVis(S, x, y, pl) {
    if (U.dist(x, y, pl.x, pl.y) < C.TILE * 1.7) return true;
    return S.visPoly ? U.inPoly(x, y, S.visPoly) : true;
  }
  function melIcon(id) {
    return ({ fireaxe: 'axe', bat: 'bat', nailbat: 'bat2', kitchenknife: 'knife', crowbar: 'crow', wrench: 'wrench' })[id] || 'plank';
  }

  // 探索标记
  function markExplored(S, px, py, rTiles) {
    const tx = px / C.TILE | 0, ty = py / C.TILE | 0, r = rTiles | 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= C.MW || y >= C.MH) continue;
      S.explored[y * C.MW + x] = 1;
    }
  }

  // ---------- 门窗 ----------
  function drawDoorsWins(ctx, S, view) {
    const tx0 = Math.max(0, view.x0 / C.TILE | 0), ty0 = Math.max(0, view.y0 / C.TILE | 0);
    const tx1 = Math.min(C.MW - 1, view.x1 / C.TILE | 0), ty1 = Math.min(C.MH - 1, view.y1 / C.TILE | 0);
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const m = S.meta.get(x + ',' + y);
      if (!m) continue;
      const X = x * C.TILE, Y = y * C.TILE;
      if (m.t === 'door') {
        const horiz = W.tget(S, x, y + 1) !== T.WEXT && W.tget(S, x, y - 1) !== T.WEXT;
        const openK = m.open ? 1 : 0;
        ctx.fillStyle = '#6d5138';
        ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
        if (horiz) {
          const wLeaf = C.TILE * (1 - openK * 0.85);
          RM.roundRect(ctx, X + 1, Y + 6, wLeaf, 20, 2); ctx.fill(); ctx.stroke();
          if (m.locked) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(X + 8, Y + 16, 2.4, 0, 7); ctx.fill(); }
        } else {
          const hLeaf = C.TILE * (1 - openK * 0.85);
          RM.roundRect(ctx, X + 6, Y + 1, 20, hLeaf, 2); ctx.fill(); ctx.stroke();
          if (m.locked) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(X + 16, Y + 8, 2.4, 0, 7); ctx.fill(); }
        }
      } else if (m.t === 'win') {
        // 窗框
        const horiz = !(W.tget(S, x + 1, y) === T.WEXT || W.tget(S, x - 1, y) === T.WEXT);
        ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
        ctx.fillStyle = m.broken ? 'rgba(120,140,150,0.25)' : 'rgba(160,200,220,0.45)';
        if (horiz) { ctx.fillRect(X, Y + 8, C.TILE, 16); ctx.strokeRect(X, Y + 8, C.TILE, 16); }
        else { ctx.fillRect(X + 8, Y, 16, C.TILE); ctx.strokeRect(X + 8, Y, 16, C.TILE); }
        if (!m.broken && !horiz) { /* 玻璃高光 */ }
        if (m.curtain && !m.broken) {
          ctx.fillStyle = '#b06a8f';
          if (horiz) { ctx.fillRect(X, Y + 6, C.TILE, 20); } else { ctx.fillRect(X + 6, Y, 20, C.TILE); }
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          if (horiz) for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(X + i * 8, Y + 6); ctx.lineTo(X + i * 8, Y + 26); ctx.stroke(); }
        }
        for (let b = 0; b < (m.boards || 0); b++) {
          ctx.fillStyle = '#9c7a4e'; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 1.6;
          ctx.save(); ctx.translate(X + 16, Y + 16); ctx.rotate((b % 2 ? -1 : 1) * 0.08 + b * 0.05);
          ctx.fillRect(-17, -5 + b * 6, 34, 5); ctx.strokeRect(-17, -5 + b * 6, 34, 5);
          ctx.restore();
        }
        if (m.broken) {
          ctx.strokeStyle = 'rgba(220,235,245,0.6)'; ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(X + 6, Y + 10); ctx.lineTo(X + 14, Y + 18); ctx.lineTo(X + 9, Y + 24);
          ctx.moveTo(X + 24, Y + 12); ctx.lineTo(X + 18, Y + 19);
          ctx.stroke();
        }
      }
    }
  }

  // ---------- 火焰 ----------
  function drawFire(ctx, f, ts) {
    const big = f.big ? 1.6 : 1;
    ctx.fillStyle = 'rgba(255,140,40,0.16)';
    ctx.beginPath(); ctx.arc(f.x, f.y, 30 * big + Math.sin(ts * 7) * 3, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const ph = ts * 6 + i * 1.7;
      const fx = f.x + Math.sin(ph) * 4, fy = f.y - ((ts * 40 + i * 23) % 26) * 0.5;
      const s = (1 - (((ts * 40 + i * 23) % 26) / 26)) * 8 * big;
      ctx.fillStyle = i % 2 ? 'rgba(255,170,60,0.85)' : 'rgba(255,110,40,0.85)';
      ctx.beginPath(); ctx.arc(fx, fy, s, 0, 7); ctx.fill();
    }
    if (!f.big) {
      ctx.fillStyle = '#5d4a36';
      ctx.save(); ctx.translate(f.x, f.y + 6);
      for (let i = 0; i < 3; i++) { ctx.rotate(1.05); ctx.fillRect(-10, -2, 20, 4); }
      ctx.restore();
    }
  }
  function drawCorpse(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.a + Math.PI / 2); ctx.scale(c.scale * 1.1, c.scale * 1.1);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = C.PAL.zShade;
    ctx.strokeStyle = 'rgba(20,24,20,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.PAL.zSkin;
    ctx.beginPath(); ctx.arc(9, 2, 5.5, 0, 7); ctx.fill(); ctx.stroke();
    // 散落羽毛
    ctx.fillStyle = 'rgba(240,240,225,0.7)';
    for (let i = 0; i < 4; i++) { const a = i * 1.9 + 0.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 14, Math.sin(a) * 10, 3, 1.4, a, 0, 7); ctx.fill(); }
    ctx.restore();
    if (!c.searched) {
      ctx.strokeStyle = `rgba(255,180,84,${0.4 + Math.sin(performance.now() / 300) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - 12, c.y - 12, 24, 24);
    }
  }
  function drawEvac(ctx, e, ts) {
    const pulse = 0.55 + Math.sin(ts * 4) * 0.35;
    ctx.strokeStyle = `rgba(120,255,150,${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, 70 + Math.sin(ts * 4) * 6, 0, 7); ctx.stroke();
    ctx.fillStyle = `rgba(120,255,150,${pulse * 0.25})`;
    ctx.beginPath(); ctx.arc(e.x, e.y, 66, 0, 7); ctx.fill();
    // 烟柱
    for (let i = 0; i < 6; i++) {
      const ph = (ts * 0.5 + i / 6) % 1;
      ctx.fillStyle = `rgba(200,210,215,${(1 - ph) * 0.3})`;
      ctx.beginPath(); ctx.arc(e.x + Math.sin(ts + i) * 8, e.y - ph * 130, 8 + ph * 16, 0, 7); ctx.fill();
    }
  }
  function edgeArrow(ctx, pl, tgt, vw, vh) {
    const dx = tgt.x - pl.x, dy = tgt.y - pl.y;
    const d = Math.hypot(dx, dy);
    if (d < 260) return;
    const a = Math.atan2(dy, dx);
    const cx = vw / 2, cy = vh / 2;
    const ex = cx + Math.cos(a) * (Math.min(cx, cy) - 46);
    const ey = cy + Math.sin(a) * (Math.min(cx, cy) - 46);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = 'rgba(120,255,150,0.9)';
    ctx.strokeStyle = 'rgba(10,14,12,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------- 粒子 ----------
  function drawParticles(ctx, ts) {
    for (const p of DZ.FX.parts) {
      const k = p.t / p.max;
      switch (p.kind) {
        case 'feather':
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.fillStyle = p.col;
          ctx.strokeStyle = 'rgba(40,40,30,0.5)'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 1.7, 0, 0, 7); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.restore();
          break;
        case 'spark':
          ctx.strokeStyle = `rgba(255,210,120,${k})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke();
          break;
        case 'dust':
          ctx.fillStyle = `rgba(150,145,130,${k * 0.4})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 6 + (1 - k) * 8, 0, 7); ctx.fill();
          break;
        case 'puff':
          ctx.fillStyle = `rgba(235,230,215,${k * 0.5})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 8 + (1 - k) * 14, 0, 7); ctx.fill();
          break;
        case 'chip':
          ctx.fillStyle = `rgba(140,105,60,${Math.min(1, k * 1.4)})`;
          ctx.fillRect(p.x - 2, p.y - 1, 4, 2);
          break;
        case 'muzzle': {
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.a);
          ctx.globalAlpha = k * 0.95;
          ctx.fillStyle = '#fff3c8';
          ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2, r1 = 5, r2 = 15;
            ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
            ctx.lineTo(Math.cos(a + Math.PI / 4) * r1, Math.sin(a + Math.PI / 4) * r1);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.restore();
          break;
        }
        case 'boom': {
          const rr = 14 + (1 - k) * 52;
          const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, rr);
          g.addColorStop(0, `rgba(255,240,200,${k})`);
          g.addColorStop(0.5, `rgba(255,150,50,${k * 0.85})`);
          g.addColorStop(1, 'rgba(120,40,20,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.fill();
          break;
        }
        case 'fire':
          ctx.fillStyle = `rgba(255,${(140 + Math.random() * 80) | 0},40,${Math.min(1, k * 1.3)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 3 + k * 5, 0, 7); ctx.fill();
          break;
      }
    }
  }

  // ---------- 光照 ----------
  function applyLighting(ctx, S, pl, cam, vw, vh, sc, ts) {
    const nv = pl.nv;
    const amb = nv ? [96, 128, 104] : U.ambientAt(S.mins / 60);
    const isDarkNight = !nv && (amb[0] + amb[1] + amb[2]) < 500;
    if (!isDarkNight && !(S.weather.cur === 'storm')) { if (!nv) return; }
    ensureBuffers(vw, vh);
    const dc = darkCtx;
    dc.save();
    dc.clearRect(0, 0, vw, vh);
    dc.fillStyle = U.cssRGB(amb);
    dc.fillRect(0, 0, vw, vh);
    // 抠光都在世界坐标 → 转屏幕坐标
    const toS = (wx, wy) => [(wx - cam.x) * sc + vw / 2, (wy - cam.y) * sc + vh / 2];
    dc.globalCompositeOperation = 'destination-out';
    const punch = (wx, wy, r, soft) => {
      const [sx, sy] = toS(wx, wy);
      if (sx < -r * sc || sy < -r * sc || sx > vw + r * sc || sy > vh + r * sc) return;
      const g = dc.createRadialGradient(sx, sy, r * sc * (soft ? 0.15 : 0.4), sx, sy, r * sc);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g;
      dc.beginPath(); dc.arc(sx, sy, r * sc, 0, 7); dc.fill();
    };
    // 室内灯（有电才亮）
    if (S.powerOn) for (const L of S.indoorLights) punch(L.x, L.y, 6.2 * C.TILE, true);
    // 路灯
    if (S.powerOn) for (const L of S.lamps) punch(L.x, L.y - 20, 4.6 * C.TILE, true);
    // 篝火（闪烁）
    for (const f of S.fires) punch(f.x, f.y, (f.big ? 5.4 : 4.2) * C.TILE * (1 + Math.sin(ts * 9) * 0.07), true);
    // 枪口闪光
    for (const p of DZ.FX.parts) if (p.kind === 'muzzle') punch(p.x, p.y, 5 * C.TILE, false);
    // 手电锥光（按可见多边形裁剪）
    if (pl.flashlight && !nv) {
      const cone = C.VISION.flashCone;
      dc.save();
      if (S.visPoly) {
        dc.beginPath();
        S.visPoly.forEach(([x, y], i) => { const [sx, sy] = toS(x, y); i ? dc.lineTo(sx, sy) : dc.moveTo(sx, sy); });
        dc.closePath(); dc.clip();
      }
      const [px, py] = toS(pl.x, pl.y);
      const half = cone.half;
      const g = dc.createRadialGradient(px, py, 6, px, py, cone.r * C.TILE * sc);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g;
      dc.beginPath();
      dc.moveTo(px, py);
      dc.arc(px, py, cone.r * C.TILE * sc, pl.a - half, pl.a + half);
      dc.closePath();
      dc.fill();
      dc.restore();
    } else {
      punch(pl.x, pl.y, 3.2 * C.TILE, true); // 自身微光
    }
    dc.restore();
    // 合成乘算
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(dark, 0, 0);
    ctx.restore();
    // 加色暖光（体积感）
    const gc = glowCtx;
    gc.save();
    gc.setTransform(1, 0, 0, 1, 0, 0);
    gc.clearRect(0, 0, vw, vh);
    gc.globalCompositeOperation = 'lighter';
    const warm = (wx, wy, r, col) => {
      const [sx, sy] = toS(wx, wy);
      const g = gc.createRadialGradient(sx, sy, 2, sx, sy, r * sc);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      gc.fillStyle = g;
      gc.beginPath(); gc.arc(sx, sy, r * sc, 0, 7); gc.fill();
    };
    for (const f of S.fires) warm(f.x, f.y, 3.6 * C.TILE, 'rgba(255,140,40,0.22)');
    if (pl.flashlight && !nv) {
      const cone = C.VISION.flashCone;
      gc.save();
      if (S.visPoly) {
        gc.beginPath();
        S.visPoly.forEach(([x, y], i) => { const [sx, sy] = toS(x, y); i ? gc.lineTo(sx, sy) : gc.moveTo(sx, sy); });
        gc.closePath(); gc.clip();
      }
      const [px, py] = toS(pl.x, pl.y);
      const g = gc.createRadialGradient(px, py, 4, px, py, cone.r * C.TILE * sc);
      g.addColorStop(0, 'rgba(255,230,170,0.20)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      gc.fillStyle = g;
      gc.beginPath(); gc.moveTo(px, py); gc.arc(px, py, cone.r * C.TILE * sc, pl.a - cone.half, pl.a + cone.half); gc.closePath();
      gc.fill();
      gc.restore();
    }
    // 夜视：僵尸热源高亮（鸭科夫热成像语言）
    if (nv) {
      for (const z of S.zombies) {
        if (z.dead) continue;
        const [sx, sy] = toS(z.x, z.y);
        const g = gc.createRadialGradient(sx, sy, 2, sx, sy, 26 * z.scale * sc);
        g.addColorStop(0, 'rgba(255,90,40,0.95)');
        g.addColorStop(0.6, 'rgba(255,160,60,0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        gc.fillStyle = g;
        gc.beginPath(); gc.arc(sx, sy, 26 * z.scale * sc, 0, 7); gc.fill();
      }
      if (S.player && !S.player.dead) {
        const [sx, sy] = toS(S.player.x, S.player.y);
        const g = gc.createRadialGradient(sx, sy, 2, sx, sy, 24 * sc);
        g.addColorStop(0, 'rgba(255,220,120,0.8)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        gc.fillStyle = g;
        gc.beginPath(); gc.arc(sx, sy, 24 * sc, 0, 7); gc.fill();
      }
    }
    gc.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(glow, 0, 0);
    ctx.restore();
  }

  // ---------- FoV 遮蔽 ----------
  function applyFovShade(ctx, S, pl, cam, vw, vh, sc) {
    if (!S.visPoly) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const shade = new Path2D();
    shade.rect(0, 0, vw, vh);
    const hole = new Path2D();
    S.visPoly.forEach(([x, y], i) => {
      const sx = (x - cam.x) * sc + vw / 2, sy = (y - cam.y) * sc + vh / 2;
      i ? hole.lineTo(sx, sy) : hole.moveTo(sx, sy);
    });
    hole.closePath();
    ctx.fillStyle = 'rgba(7,9,14,0.86)';
    ctx.fill(shade, 'evenodd');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fill(hole);
    ctx.restore();
  }

  // ---------- 天气屏幕效果 ----------
  function initWeather(S, dt) {
    const want = S.weather.cur === 'storm' ? 190 : S.weather.cur === 'rain' ? 120 : 0;
    while (rainDrops.length < want) rainDrops.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() });
    if (rainDrops.length > want) rainDrops.length = want;
    if (S.weather.cur === 'fog') {
      while (fogBlobs.length < 6) fogBlobs.push({ x: Math.random(), y: Math.random(), r: 0.2 + Math.random() * 0.25, v: 0.01 + Math.random() * 0.02 });
    } else fogBlobs.length = 0;
  }
  function drawWeatherScreen(ctx, S, dt, vw, vh) {
    if (rainDrops.length) {
      const heavy = S.weather.cur === 'storm';
      ctx.strokeStyle = heavy ? 'rgba(190,215,235,0.34)' : 'rgba(180,205,228,0.26)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const d of rainDrops) {
        d.y += dt * (heavy ? 1.7 : 1.25) * d.s;
        d.x += dt * 0.09 * d.s;
        if (d.y > 1) { d.y -= 1.05; d.x = Math.random(); }
        if (d.x > 1) d.x -= 1;
        const x = d.x * vw, y = d.y * vh;
        ctx.moveTo(x, y); ctx.lineTo(x - 7 * d.s, y - 17 * d.s);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(60,90,120,0.10)';
      ctx.fillRect(0, 0, vw, vh);
    }
    for (const f of fogBlobs) {
      f.x += f.v * dt;
      if (f.x > 1.3) f.x = -0.3;
      const g = ctx.createRadialGradient(f.x * vw, f.y * vh, 10, f.x * vw, f.y * vh, f.r * vw);
      g.addColorStop(0, 'rgba(170,185,195,0.16)');
      g.addColorStop(1, 'rgba(170,185,195,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }
    // 雷电
    if (S.weather.cur === 'storm') {
      lightningT -= dt;
      if (lightningT <= 0) { lightningT = 7 + Math.random() * 15; DZ.FX.flash(); }
    }
    if (dom.flash) dom.flash.style.opacity = DZ.FX.flashT > 0 ? 0.55 : 0;
  }

  // ---------- DOM 后期（红晕/夜视滤镜） ----------
  function updatePostFX(S, pl, dt) {
    if (!dom.vig) return;
    const critHp = Math.min(...Object.values(pl.body).map(b => Math.max(0, b.hp)));
    const bleeding = Object.values(pl.body).some(b => b.bleed > 0);
    let inten = 0;
    if (bleeding) inten = Math.max(inten, 0.45);
    if (critHp < 25) inten = Math.max(inten, (25 - critHp) / 25 * 0.7);
    if (pl.panic > 50) inten = Math.max(inten, (pl.panic - 50) / 100);
    const breath = inten * (0.75 + Math.sin(performance.now() / (pl.panic > 60 ? 260 : 480)) * 0.25);
    dom.vig.style.opacity = Math.min(0.92, breath).toFixed(3);
    if (dom.tint) {
      dom.tint.style.opacity = pl.nv ? 1 : 0;
    }
  }

  // ---------- 准星 ----------
  function drawCrosshair(ctx, S, mouse, vw, vh) {
    if (!mouse || mouse.onUI) return;
    const pl = S.player;
    const x = mouse.x, y = mouse.y;
    let bloom = 8;
    const gI = pl.slots.primary;
    if (gI && !pl.reloadT) {
      const g = C.GUNS[DZ.IT.def(gI.id).gun];
      let sp = pl.aiming ? g.aimSpread : g.spread;
      sp *= Math.max(0.5, 1 - (pl.sk.aiming.lv - 1) * 0.06);
      sp *= 1 + pl.panic / 160 + (S.input.mvx ? 0.5 : 0);
      bloom = 6 + sp * 3.2;
    }
    const col = pl.grabbedBy ? C.PAL.danger : 'rgba(255,214,140,0.95)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, bloom, 0, 7);
    ctx.stroke();
    ctx.beginPath();
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
      ctx.moveTo(x + dx * (bloom + 2), y + dy * (bloom + 2));
      ctx.lineTo(x + dx * (bloom + 7), y + dy * (bloom + 7));
    });
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
  }

  // ---------- 小地图 ----------
  RD.buildMini = function (S) {
    const mc = document.createElement('canvas');
    mc.width = C.MW; mc.height = C.MH;
    const mctx = mc.getContext('2d');
    const cols = { [T.GRASS]: '#4c5943', [T.DIRT]: '#5f5643', [T.ROAD]: '#33363b', [T.SIDE]: '#565a5e', [T.LOT]: '#383b40', [T.FWOOD]: '#6d5844', [T.FTILE]: '#787d81', [T.TURF]: '#465f3f', [T.HELI]: '#5d7a54', [T.WEXT]: '#23262b', [T.WINT]: '#3a3630', [T.DOOR]: '#8d6a3f', [T.WIN]: '#6a8ea3', [T.TREE]: '#33452e', [T.BUSH]: '#3d5237', [T.CAR]: '#4f565e', [T.RUG]: '#6a4f42' };
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      mctx.fillStyle = cols[S.tiles[y * C.MW + x]] || '#444';
      mctx.fillRect(x, y, 1, 1);
    }
    S.miniCanvas = mc;
    S.exploreDirty = true;
  };
  RD.drawMinimap = function (mctx, S, size) {
    if (!S.miniCanvas) RD.buildMini(S);
    const k = size / C.MW;
    mctx.clearRect(0, 0, size, size * C.MH / C.MW);
    mctx.drawImage(S.miniCanvas, 0, 0, size, size * C.MH / C.MW);
    // 未探索遮黑
    if (S.exploreDirty !== false) {
      if (!S.exploreMark || S.exploreMark.length !== S.explored.length) S.exploreMark = S.explored.slice();
      else for (let i = 0; i < S.explored.length; i++) S.exploreMark[i] = S.exploreMark[i] || S.explored[i];
      S.exploreDirty = false;
    }
    mctx.fillStyle = 'rgba(8,9,12,0.82)';
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      if (!S.exploreMark[y * C.MW + x]) mctx.fillRect(x * k, y * k, k + 0.5, k + 0.5);
    }
    const pl = S.player;
    const P2M = (wx, wy) => [wx / C.TILE * k, wy / C.TILE * k];
    // 家
    {
      const [hx, hy] = P2M(S.home.x, S.home.y);
      mctx.fillStyle = '#ffb454';
      mctx.fillRect(hx - 2.4, hy - 2.4, 4.8, 4.8);
      mctx.strokeStyle = '#14161a'; mctx.lineWidth = 1;
      mctx.strokeRect(hx - 2.4, hy - 2.4, 4.8, 4.8);
    }
    // 撤离点
    if (S.evacOpen || true) {
      const [ex, ey] = P2M(S.evac.x, S.evac.y);
      mctx.fillStyle = S.evacOpen ? `rgba(120,255,150,${0.6 + Math.sin(performance.now() / 250) * 0.4})` : 'rgba(150,170,155,0.7)';
      mctx.beginPath(); mctx.arc(ex, ey, 3.4, 0, 7); mctx.fill();
    }
    // 听到的僵尸
    for (const z of S.zombies) {
      if (z.dead || !z.lastHeard) continue;
      if (U.dist(z.x, z.y, pl.x, pl.y) > 26 * C.TILE) continue;
      const [zx, zy] = P2M(z.x, z.y);
      mctx.fillStyle = 'rgba(255,80,64,0.85)';
      mctx.beginPath(); mctx.arc(zx, zy, 1.8, 0, 7); mctx.fill();
    }
    // 玩家箭头
    {
      const [px, py] = P2M(pl.x, pl.y);
      mctx.save();
      mctx.translate(px, py); mctx.rotate(pl.a + Math.PI / 2);
      mctx.fillStyle = '#ffd23f';
      mctx.strokeStyle = '#14161a'; mctx.lineWidth = 1;
      mctx.beginPath(); mctx.moveTo(0, -5); mctx.lineTo(3.6, 4); mctx.lineTo(-3.6, 4); mctx.closePath();
      mctx.fill(); mctx.stroke();
      mctx.restore();
    }
  };

  DZ.RD = RD;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
