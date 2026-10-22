/* DUCKOV Z - 静态世界渲染：预烘焙地形/伪3D墙体/屋顶/卡通鸭 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U, W = DZ.W, T = W.T;
  const RM = {};
  let doc = null;
  function mkCanvas(w, h) {
    if (typeof document === 'undefined') return { width: w, height: h, getContext: () => null };
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // ---------- 卡通鸭（角色/僵尸通用） ----------
  // o: {x,y,a,scale,body,shade,belly,zomb,crawl,helm,vest,jacketCol,packCol,walkPhase,windup,flash,roll,weapon}
  RM.drawDuck = function (ctx, o) {
    const s = o.scale || 1;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.roll) { ctx.rotate(o.roll * Math.PI * 2); }
    else ctx.rotate(o.a + Math.PI / 2);
    ctx.scale(s, s);
    const body = o.zomb ? C.PAL.zSkin : (o.body || C.PAL.duck);
    const shade = o.zomb ? C.PAL.zShade : (o.shade || C.PAL.duckShade);
    const belly = o.belly || C.PAL.duckBelly;
    // 阴影
    if (!o.noShadow && !o.crawl) {
      ctx.fillStyle = 'rgba(10,12,16,0.28)';
      ctx.beginPath(); ctx.ellipse(0, 4, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
    }
    const bob = Math.sin((o.walkPhase || 0)) * 1.6;
    if (o.windup > 0) { // 攻击前摇：红光警示（狂暴搜刮者式）
      ctx.shadowColor = 'rgba(255,60,40,0.95)'; ctx.shadowBlur = 14;
    } else if (o.flash) {
      ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 10;
    }
    if (o.crawl) {
      // 爬行者：拉长趴地
      ctx.fillStyle = body; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade;
      ctx.beginPath(); ctx.ellipse(-3, 3, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      // 头在前
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(11, -2, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      beak(ctx, 15, -2, 1);
      eyes(ctx, 11, -2, o.zomb);
      ctx.restore(); return;
    }
    // 尾羽
    ctx.fillStyle = shade; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -12 + bob); ctx.lineTo(0, -17 + bob); ctx.lineTo(4, -12 + bob);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 身体（椭圆）双色 cel
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, bob * 0.5, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    // 暗部月牙（左后侧）
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(-3.5, bob * 0.5 + 3, 8.5, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // 肚皮亮块
    ctx.fillStyle = belly;
    ctx.beginPath(); ctx.ellipse(1.5, 2 + bob * 0.5, 6, 7, -0.2, 0, Math.PI * 2); ctx.fill();
    // 背包（在后上方）
    if (o.packCol) {
      ctx.fillStyle = o.packCol; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 1.6;
      roundRect(ctx, -7, -11 + bob, 14, 10, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(-5, -8 + bob, 10, 2);
    }
    // 防弹插板（携行具）
    if (o.vest) {
      ctx.fillStyle = o.vest; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 1.6;
      RM.roundRect(ctx, -7, -3 + bob * 0.5, 14, 13, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(-4, 2 + bob * 0.5, 3.4, 5); ctx.fillRect(1, 2 + bob * 0.5, 3.4, 5);
    }
    // 翅膀小手
    const wingA = Math.sin((o.walkPhase || 0) * 2) * 2;
    ctx.fillStyle = body; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(-10.5, wingA * 0.4, 3.4, 6, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(10.5, -wingA * 0.4, 3.4, 6, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 武器（右手侧前伸）
    if (o.weapon) drawWeaponMini(ctx, o.weapon, wingA);
    // 头
    const hy = -13 + bob * 0.7;
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, hy, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.arc(-2.5, hy + 2, 6, 0.4, Math.PI * 1.4); ctx.lineTo(-2.5, hy + 2); ctx.fill();
    // 头盔
    if (o.helm === 2) { ctx.fillStyle = '#4a5240'; ctx.strokeStyle = C.PAL.outline; ctx.beginPath(); ctx.arc(0, hy - 1, 8, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(-8, hy - 1, 16, 2); }
    else if (o.helm === 1) { ctx.fillStyle = '#d9a441'; ctx.strokeStyle = C.PAL.outline; ctx.beginPath(); ctx.arc(0, hy - 1, 8, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    // 嘴
    beak(ctx, 0, hy, 0);
    // 眼睛
    eyes(ctx, 0, hy, o.zomb);
    // 夜视仪
    if (o.nv) { ctx.fillStyle = '#222a24'; ctx.strokeStyle = C.PAL.outline; roundRect(ctx, -6, hy - 9, 12, 6, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#79c26a'; ctx.fillRect(-4, hy - 8, 3, 3); ctx.fillRect(1, hy - 8, 3, 3); }
    ctx.restore();
  };
  function beak(ctx, cx, cy, small) {
    ctx.fillStyle = C.PAL.beak; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - (small ? 3 : 4.5), cy + (small ? 2 : 3));
    ctx.quadraticCurveTo(cx, cy + (small ? 8 : 11), cx + (small ? 3 : 4.5), cy + (small ? 2 : 3));
    ctx.quadraticCurveTo(cx, cy + (small ? 4 : 5.5), cx - (small ? 3 : 4.5), cy + (small ? 2 : 3));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function eyes(ctx, cx, cy, zomb) {
    ctx.fillStyle = zomb ? C.PAL.zEye : '#20242b';
    ctx.beginPath(); ctx.arc(cx - 2.6, cy - 1.6, 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2.6, cy - 1.6, 1.25, 0, Math.PI * 2); ctx.fill();
    if (zomb) { // 死鱼眼高光
      ctx.fillStyle = 'rgba(200,220,180,0.5)';
      ctx.beginPath(); ctx.arc(cx - 2.2, cy - 2, 0.5, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 2.2, cy - 2, 0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 0.5, 0, 7); ctx.fill();
    }
  }
  function drawWeaponMini(ctx, wtype, wingA) {
    ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 1.4;
    if (wtype === 'gpistol') { ctx.fillStyle = '#4a4f55'; roundRect(ctx, 8, -2 + wingA * 0.3, 8, 4, 1.5); ctx.fill(); ctx.stroke(); }
    else if (wtype === 'gshotgun' || wtype === 'grifle') { ctx.fillStyle = '#5d4a36'; roundRect(ctx, 8, -2 + wingA * 0.3, 20, 3.4, 1.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7d8288'; ctx.fillRect(22, -1.4 + wingA * 0.3, 6, 2.2); }
    else if (wtype === 'axe') { ctx.fillStyle = '#8a6a45'; ctx.fillRect(8, -6 + wingA * 0.3, 2.4, 12); ctx.fillStyle = '#a03b2e'; ctx.beginPath(); ctx.moveTo(10, -6); ctx.quadraticCurveTo(19, -5, 16, 1); ctx.lineTo(10, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (wtype === 'bat' || wtype === 'bat2') { ctx.fillStyle = '#a97e50'; roundRect(ctx, 8, -3 + wingA * 0.3, 16, 3, 1.5); ctx.fill(); ctx.stroke(); if (wtype === 'bat2') { ctx.fillStyle = '#c9ccd1'; for (let i = 0; i < 4; i++) ctx.fillRect(12 + i * 3, -4.6 + wingA * 0.3, 1.4, 1.6); } }
    else if (wtype === 'knife') { ctx.fillStyle = '#aab4bd'; ctx.beginPath(); ctx.moveTo(9, -1 + wingA * 0.3); ctx.lineTo(17, -3 + wingA * 0.3); ctx.lineTo(17, 0.4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4a3626'; ctx.fillRect(6, -1.6 + wingA * 0.3, 4, 2.6); }
    else if (wtype === 'crow') { ctx.strokeStyle = '#7a4a4a'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(8, 2 + wingA * 0.3); ctx.lineTo(18, -4 + wingA * 0.3); ctx.stroke(); }
    else if (wtype === 'wrench') { ctx.strokeStyle = '#8f969c'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(8, 2 + wingA * 0.3); ctx.lineTo(16, -3 + wingA * 0.3); ctx.stroke(); }
    else { ctx.strokeStyle = '#b08d5f'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(8, 3 + wingA * 0.3); ctx.lineTo(17, -3 + wingA * 0.3); ctx.stroke(); }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  RM.roundRect = roundRect;

  // ---------- 家具精灵 ----------
  function furn(ctx, t, x, y, S) {
    const X = x * C.TILE, Y = y * C.TILE, W32 = C.TILE;
    const O = C.PAL.outline;
    switch (t) {
      case T.LAMP: ctx.fillStyle = '#3a3f46'; ctx.fillRect(X + 13, Y + 10, 6, 20); ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2; ctx.strokeRect(X + 13, Y + 10, 6, 20); ctx.fillStyle = '#ffd88a'; ctx.beginPath(); ctx.arc(X + 16, Y + 9, 5, 0, 7); ctx.fill(); ctx.stroke(); break;
      case T.COUNTER: ctx.fillStyle = '#8d8578'; rr(ctx, X + 1, Y + 1, 30, 30, 3); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(X + 1, Y + 1, 30, 7); break;
      case T.FRIDGE: ctx.fillStyle = '#c9d3d8'; rr(ctx, X + 2, Y, 28, 31, 4); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#9fb2ba'; ctx.fillRect(X + 2, Y + 11, 28, 2); ctx.fillStyle = O; ctx.fillRect(X + 24, Y + 4, 2.4, 6); break;
      case T.CRATE: ctx.fillStyle = '#9c7a4e'; rr(ctx, X + 2, Y + 2, 28, 28, 2); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(60,40,20,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X + 3, Y + 3); ctx.lineTo(X + 29, Y + 29); ctx.moveTo(X + 29, Y + 3); ctx.lineTo(X + 3, Y + 29); ctx.stroke(); break;
      case T.SHELF: ctx.fillStyle = '#7d6a50'; rr(ctx, X + 1, Y + 1, 30, 30, 2); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#c9b48a'; for (let i = 0; i < 3; i++) ctx.fillRect(X + 4, Y + 5 + i * 9, 24, 4); break;
      case T.BED: ctx.fillStyle = '#8a5a5a'; rr(ctx, X + 2, Y, 28, 31, 4); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#e8e4d8'; rr(ctx, X + 5, Y + 2, 22, 8, 3); ctx.fill(); ctx.fillStyle = '#a06a6a'; ctx.fillRect(X + 4, Y + 12, 24, 3); break;
      case T.STOVE: ctx.fillStyle = '#5d6470'; rr(ctx, X + 2, Y + 2, 28, 28, 3); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#3a3f46'; ctx.beginPath(); ctx.arc(X + 11, Y + 11, 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(X + 21, Y + 21, 5, 0, 7); ctx.fill(); break;
      case T.SINK: ctx.fillStyle = '#8d8578'; rr(ctx, X + 1, Y + 1, 30, 30, 3); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#b8c4ca'; rr(ctx, X + 7, Y + 8, 18, 14, 3); ctx.fill(); ctx.fillStyle = O; ctx.fillRect(X + 14, Y + 2, 4, 7); break;
      case T.TOILET: ctx.fillStyle = '#dfe6ea'; ctx.beginPath(); ctx.ellipse(X + 16, Y + 18, 10, 12, 0, 0, 7); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#cfd8dd'; rr(ctx, X + 8, Y + 2, 16, 9, 3); ctx.fill(); ctx.stroke(); break;
      case T.TABLE: ctx.fillStyle = '#9c7a4e'; rr(ctx, X + 2, Y + 2, 28, 28, 4); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(60,40,20,0.4)'; ctx.strokeRect(X + 8, Y + 8, 16, 16); break;
      case T.CHAIR: ctx.fillStyle = '#8a6a45'; rr(ctx, X + 7, Y + 7, 18, 18, 4); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); break;
      case T.LOCKER: ctx.fillStyle = '#5d6470'; rr(ctx, X + 2, Y + 1, 28, 30, 2); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.moveTo(X + 16, Y + 2); ctx.lineTo(X + 16, Y + 30); ctx.stroke(); ctx.fillStyle = O; ctx.fillRect(X + 12, Y + 14, 2, 5); ctx.fillRect(X + 18, Y + 14, 2, 5); break;
      case T.BSHELF: ctx.fillStyle = '#6d5138'; rr(ctx, X + 1, Y + 1, 30, 30, 2); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#a03b2e', '#3d5a80', '#79c26a', '#c9871f'][i % 4]; ctx.fillRect(X + 4 + i * 7, Y + 5, 5, 8); ctx.fillRect(X + 4 + i * 7, Y + 17, 5, 8); } break;
      case T.MEDCAB: ctx.fillStyle = '#e8e4d8'; rr(ctx, X + 4, Y + 2, 24, 26, 3); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#ff5a49'; ctx.fillRect(X + 14, Y + 8, 4, 12); ctx.fillRect(X + 10, Y + 12, 12, 4); break;
      case T.WARDROBE: ctx.fillStyle = '#7d5f42'; rr(ctx, X + 2, Y + 1, 28, 30, 2); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(X + 16, Y + 2); ctx.lineTo(X + 16, Y + 30); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke(); break;
      case T.PUMP: ctx.fillStyle = '#a03b2e'; rr(ctx, X + 6, Y + 4, 20, 24, 4); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#e8e4d8'; ctx.fillRect(X + 9, Y + 8, 14, 8); ctx.fillStyle = O; ctx.fillRect(X + 2, Y + 10, 5, 3); break;
      case T.DUMPSTER: ctx.fillStyle = '#3d6b4f'; rr(ctx, X + 1, Y + 3, 30, 26, 3); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X + 3, Y + 6, 26, 5); break;
      case T.BARREL: ctx.fillStyle = '#a03b2e'; ctx.beginPath(); ctx.arc(X + 16, Y + 16, 12, 0, 7); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(X + 16, Y + 16, 5, 0, 7); ctx.fill(); break;
      case T.WBENCH: ctx.fillStyle = '#6d5138'; rr(ctx, X + 1, Y + 2, 30, 28, 3); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#8f969c'; ctx.fillRect(X + 6, Y + 8, 8, 4); ctx.fillRect(X + 18, Y + 14, 8, 4); break;
      case T.SANDBAG: ctx.fillStyle = '#a89a72'; ctx.beginPath(); ctx.ellipse(X + 16, Y + 16, 14, 9, 0.3, 0, 7); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke(); break;
      case T.RUBBLE: ctx.fillStyle = 'rgba(60,60,64,0.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(X + 5 + ((i * 7) % 20), Y + 6 + ((i * 11) % 18), 5, 4); break;
      case T.RUG: ctx.fillStyle = 'rgba(150,90,70,0.55)'; rr(ctx, X, Y, 32, 32, 2); ctx.fill(); break;
      case T.LINEH: ctx.fillStyle = C.PAL.roadLine; ctx.fillRect(X + 4, Y + 14, 24, 4); break;
      case T.LINEV: ctx.fillStyle = C.PAL.roadLine; ctx.fillRect(X + 14, Y + 4, 4, 24); break;
      case T.CROSS: ctx.fillStyle = 'rgba(220,220,220,0.75)'; ctx.fillRect(X + 4, Y + 6, 24, 5); ctx.fillRect(X + 4, Y + 21, 24, 5); break;
    }
  }
  function rr(ctx, x, y, w, h, r) { RM.roundRect(ctx, x, y, w, h, r); }

  // ---------- 地面预烘焙 ----------
  RM.prerender = function (S) {
    const GW = C.MW * C.TILE, GH = C.MH * C.TILE;
    const g = mkCanvas(GW, GH);
    const ctx = g.getContext('2d');
    if (!ctx) return null;
    // 地表
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      const t = S.tiles[y * C.MW + x];
      const X = x * C.TILE, Y = y * C.TILE;
      let col = null;
      switch (t) {
        case T.GRASS: col = (x * 7 + y * 13) % 5 < 2 ? C.PAL.grassA : C.PAL.grassB; break;
        case T.DIRT: col = C.PAL.dirt; break;
        case T.ROAD: col = ((x * 31 + y * 17) % 11 === 0) ? '#40434a' : C.PAL.road; break;
        case T.SIDE: col = ((x + y) % 2 === 0) ? C.PAL.sidewalk : '#6f7276'; break;
        case T.LOT: col = C.PAL.lot; break;
        case T.FWOOD: col = ((x + y) % 2 === 0) ? C.PAL.floorWood : C.PAL.floorWoodB; break;
        case T.FTILE: col = ((x + y) % 2 === 0) ? C.PAL.floorTile : C.PAL.floorTileB; break;
        case T.TURF: col = C.PAL.turf; break;
        case T.HELI: col = C.PAL.heli; break;
        case T.RUG: col = '#8d6a58'; break;
        default: col = C.PAL.floorWood;
      }
      ctx.fillStyle = col;
      ctx.fillRect(X, Y, C.TILE, C.TILE);
    }
    // 停机坪 H 标志
    {
      const e = S.evac;
      if (e) {
        const ex = e.tx * C.TILE - 4 * C.TILE / 2, ey = e.ty * C.TILE - 4 * C.TILE / 2;
        ctx.strokeStyle = 'rgba(240,240,230,0.8)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(e.tx * C.TILE, e.ty * C.TILE, 3.2 * C.TILE, 0, 7); ctx.stroke();
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(ex + 30, ey + 20); ctx.lineTo(ex + 30, ey + 108);
        ctx.moveTo(ex + 98, ey + 20); ctx.lineTo(ex + 98, ey + 108);
        ctx.moveTo(ex + 30, ey + 64); ctx.lineTo(ex + 98, ey + 64);
        ctx.stroke();
      }
    }
    // 室内灯光晕染（微弱暖色）
    for (const L of S.indoorLights) {
      const grd = ctx.createRadialGradient(L.x, L.y, 10, L.x, L.y, 110);
      grd.addColorStop(0, 'rgba(255,235,190,0.10)'); grd.addColorStop(1, 'rgba(255,235,190,0)');
      ctx.fillStyle = grd; ctx.fillRect(L.x - 110, L.y - 110, 220, 220);
    }
    // 建筑投影
    ctx.fillStyle = 'rgba(10,12,16,0.18)';
    for (const B of S.buildings) ctx.fillRect(B.x * C.TILE + 5, B.y * C.TILE + 7, B.w * C.TILE, B.h * C.TILE);
    // 墙体（挤出感）
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      const t = S.tiles[y * C.MW + x];
      if (t !== T.WEXT && t !== T.WINT && t !== T.FENCE) continue;
      const X = x * C.TILE, Y = y * C.TILE;
      const ext = t === T.WEXT;
      if (t === T.FENCE) {
        ctx.fillStyle = '#7a6a52'; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
        ctx.fillRect(X + 13, Y + 4, 6, 24); ctx.strokeRect(X + 13, Y + 4, 6, 24);
        ctx.fillRect(X + 2, Y + 9, 28, 4); ctx.strokeRect(X + 2, Y + 9, 28, 4);
        continue;
      }
      const base = ext ? C.PAL.wallExt : C.PAL.wallInt;
      ctx.fillStyle = base;
      ctx.fillRect(X, Y, C.TILE, C.TILE);
      ctx.fillStyle = ext ? C.PAL.wallTop : '#86766a';
      ctx.fillRect(X, Y, C.TILE, 9); // 顶面亮带（伪高度）
      ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
      ctx.strokeRect(X + 1, Y + 1, C.TILE - 2, C.TILE - 2);
      if (ext) { // 砖缝
        ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X, Y + 16); ctx.lineTo(X + C.TILE, Y + 16);
        ctx.moveTo(X + 16, Y + 9); ctx.lineTo(X + 16, Y + 16);
        ctx.stroke();
      }
    }
    // 门/窗底（画室内地面，动态层再画门窗本体）
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      const t = S.tiles[y * C.MW + x];
      if (t !== T.DOOR && t !== T.WIN) continue;
      const X = x * C.TILE, Y = y * C.TILE;
      ctx.fillStyle = '#7d6a58';
      ctx.fillRect(X, Y, C.TILE, C.TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(X, Y, C.TILE, 3);
    }
    // 家具与静态道具
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      const t = S.tiles[y * C.MW + x];
      if (t >= T.COUNTER || t === T.LINEH || t === T.LINEV || t === T.CROSS || t === T.RUG || t === T.RUBBLE) furn(ctx, t, x, y, S);
    }
    // 汽车
    for (const car of S.cars) drawCar(ctx, car);
    // 树干
    for (let y = 0; y < C.MH; y++) for (let x = 0; x < C.MW; x++) {
      if (S.tiles[y * C.MW + x] === T.TREE) {
        const X = x * C.TILE + 16, Y = y * C.TILE + 16;
        ctx.fillStyle = 'rgba(10,12,16,0.25)';
        ctx.beginPath(); ctx.ellipse(X + 3, Y + 5, 10, 7, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C.PAL.treeTrunk; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X, Y, 7, 0, 7); ctx.fill(); ctx.stroke();
      }
    }
    S.groundCanvas = g;
    // 屋顶画布
    S.roofCanvases = new Map();
    for (const B of S.buildings) {
      const rc = mkCanvas(B.w * C.TILE + 40, B.h * C.TILE + 40);
      const rctx = rc.getContext('2d');
      if (!rctx) continue;
      drawRoof(rctx, B);
      S.roofCanvases.set(B.id, rc);
    }
    return g;
  };
  function drawCar(ctx, car) {
    const X = car.tx * C.TILE, Y = car.ty * C.TILE, w = car.w * C.TILE, h = car.h * C.TILE;
    const horiz = w > h;
    ctx.save();
    ctx.translate(X + w / 2, Y + h / 2);
    if (!horiz) ctx.rotate(Math.PI / 2);
    const L = Math.max(w, h), S_ = Math.min(w, h);
    ctx.fillStyle = 'rgba(10,12,16,0.25)';
    ctx.beginPath(); ctx.ellipse(3, 5, L / 2, S_ / 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = car.burnt ? '#4a423c' : car.col;
    RM.roundRect(ctx, -L / 2 + 2, -S_ / 2 + 3, L - 4, S_ - 6, 9); ctx.fill();
    ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = car.burnt ? '#332e2a' : 'rgba(140,180,205,0.9)';
    RM.roundRect(ctx, -L / 2 + 12, -S_ / 2 + 6, L * 0.32, S_ - 12, 4); ctx.fill();
    RM.roundRect(ctx, L / 2 - 20, -S_ / 2 + 6, 10, S_ - 12, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    [[-L / 2 + 8, -S_ / 2], [L / 2 - 14, -S_ / 2], [-L / 2 + 8, S_ / 2 - 4], [L / 2 - 14, S_ / 2 - 4]].forEach(([wx, wy]) => ctx.fillRect(wx, wy, 7, 4));
    ctx.restore();
  }
  function drawRoof(ctx, B) {
    const w = B.w * C.TILE, h = B.h * C.TILE;
    const ox = 20, oy = 20;
    ctx.translate(ox, oy);
    ctx.fillStyle = 'rgba(10,12,16,0.22)';
    ctx.fillRect(8, 10, w, h);
    ctx.fillStyle = B.color;
    RM.roundRect(ctx, -3, -3, w + 6, h + 6, 6); ctx.fill();
    // 屋脊双向坡
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(-3, -3, w + 6, (h + 6) * 0.45);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(-3, -3 + (h + 6) * 0.62, w + 6, (h + 6) * 0.38);
    ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 3;
    RM.roundRect(ctx, -3, -3, w + 6, h + 6, 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, h / 2); ctx.lineTo(w - 4, h / 2); ctx.stroke();
    // 天窗/空调机组
    ctx.fillStyle = '#8f969c'; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
    RM.roundRect(ctx, w * 0.62, h * 0.24, 26, 18, 3); ctx.fill(); ctx.stroke();
    RM.roundRect(ctx, w * 0.2, h * 0.68, 18, 14, 3); ctx.fill(); ctx.stroke();
    // 招牌
    if (B.kind !== 'house') {
      ctx.fillStyle = 'rgba(20,22,28,0.92)';
      RM.roundRect(ctx, w / 2 - 74, h + 2, 148, 24, 5); ctx.fill();
      ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 1.5;
      RM.roundRect(ctx, w / 2 - 74, h + 2, 148, 24, 5); ctx.stroke();
      ctx.fillStyle = '#ffb454';
      ctx.font = 'bold 15px "Segoe UI","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(B.name, w / 2, h + 15);
    }
  }
  // 树冠/灌木（动态层调用，带摇摆）
  RM.drawCanopy = function (ctx, S, vx0, vy0, vx1, vy1, timeSec) {
    for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
      if (x < 0 || y < 0 || x >= C.MW || y >= C.MH) continue;
      const t = S.tiles[y * C.MW + x];
      const sway = Math.sin(timeSec * 0.8 + x * 0.7 + y * 1.3) * 2;
      if (t === T.TREE) {
        const X = x * C.TILE + 16 + sway, Y = y * C.TILE + 10;
        ctx.fillStyle = C.PAL.treeA; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X, Y, 15, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.PAL.treeB;
        ctx.beginPath(); ctx.arc(X - 6, Y + 5, 9, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath(); ctx.arc(X - 3, Y - 5, 7, 0, 7); ctx.fill();
      } else if (t === T.BUSH) {
        const X = x * C.TILE + 16 + sway * 0.5, Y = y * C.TILE + 18;
        ctx.fillStyle = '#4d6b45'; ctx.strokeStyle = C.PAL.outline; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(X, Y, 12, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5d7a54';
        ctx.beginPath(); ctx.ellipse(X - 3, Y - 3, 6, 4, 0, 0, 7); ctx.fill();
      }
    }
  };
  DZ.RM = RM;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
