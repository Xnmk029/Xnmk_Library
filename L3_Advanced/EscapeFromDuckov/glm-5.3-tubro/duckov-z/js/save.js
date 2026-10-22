/* DUCKOV Z - 存档（localStorage，种子+差异序列化） */
(function (DZ) {
  'use strict';
  const KEY = 'dz_save_v1';
  const SAVE = {};
  SAVE.exists = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  SAVE.clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };
  SAVE.save = function (S) {
    try {
      const data = {
        seed: S.seed, prof: S.player.prof, day: S.day, mins: S.mins, totalMins: S.totalMins,
        weather: S.weather.cur, powerOn: S.powerOn, waterOn: S.waterOn,
        flags: S.flags, stats: S.stats, heat: S.heat,
        home: S.home, evacOpen: S.evacOpen, hordeActive: S.hordeActive,
        containers: [], zombies: [], corpses: [],
        fires: S.fires, raincols: S.raincols,
        bushes: S.bushes.filter(b => b.cd > 0).map(b => [b.tx, b.ty, b.cd]),
        exploredB64: b64(S.explored), player: serPlayer(S.player),
        radioLog: S.radioLog || []
      };
      for (const [k, c] of S.containers) data.containers.push([k, c.items]);
      for (const z of S.zombies) if (!z.dead) data.zombies.push({ x: z.x, y: z.y, a: z.a, type: z.type, hp: z.hp, crawl: z.crawl, dormant: z.dormant });
      for (const c of S.corpses) data.corpses.push({ x: c.x, y: c.y, a: c.a, scale: c.scale, loot: c.loot, searched: c.searched });
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { console.warn('save fail', e); return false; }
  };
  SAVE.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const S = DZ.W.gen(data.seed);
      S.day = data.day; S.mins = data.mins; S.totalMins = data.totalMins;
      S.weather.cur = data.weather; S.powerOn = data.powerOn; S.waterOn = data.waterOn;
      S.flags = data.flags || {}; S.stats = Object.assign(S.stats, data.stats);
      S.heat = data.heat || []; S.home = data.home; S.evacOpen = data.evacOpen;
      S.hordeActive = data.hordeActive || 0;
      S.radioLog = data.radioLog || [];
      S.meta = new Map(data.meta);
      for (const [k, items] of data.containers) {
        const c = S.containers.get(k);
        if (c) c.items = items;
        else S.containers.set(k, { tx: +k.split(',')[0], ty: +k.split(',')[1], tid: 19, items });
      }
      S.zombies = [];
      for (const z of data.zombies) {
        const nz = DZ.Z.spawn(S, z.x, z.y, z.crawl ? 'crawler' : z.type, z.dormant);
        nz.a = z.a; nz.hp = Math.max(6, z.hp);
      }
      S.corpses = (data.corpses || []).map((c, i) => ({ id: 'c' + i, loot: c.loot, searched: c.searched, x: c.x, y: c.y, a: c.a, scale: c.scale || 1 }));
      S.fires = data.fires || []; S.raincols = data.raincols || [];
      for (const [tx, ty, cd] of (data.bushes || [])) { const b = S.bushes.find(x => x.tx === tx && x.ty === ty); if (b) b.cd = cd; }
      unb64(S.explored, data.exploredB64);
      S.player = deserPlayer(data.player);
      S.miniCanvas = null;
      S.exploreMark = null;
      return S;
    } catch (e) { console.warn('load fail', e); return null; }
  };
  function b64(u8) {
    let s = '';
    const CH = 4096;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(u8.length, i + CH)));
    return btoa(s);
  }
  function unb64(u8, str) {
    const s = atob(str);
    for (let i = 0; i < u8.length && i < s.length; i++) u8[i] = s.charCodeAt(i);
  }
  function serPlayer(p) {
    return JSON.parse(JSON.stringify({
      x: p.x, y: p.y, a: p.a, prof: p.prof, body: p.body,
      hunger: p.hunger, thirst: p.thirst, fatigue: p.fatigue, stamina: p.stamina,
      painMaskH: p.painMaskH, betaH: p.betaH, vitH: p.vitH,
      wet: p.wet, panic: p.panic, zv: p.zv, bact: p.bact, bactDoseLeft: p.bactDoseLeft,
      inv: p.inv, slots: p.slots, sk: p.sk
    }));
  }
  function deserPlayer(d) {
    const p = d;
    p.flashlight = false; p.nv = false; p.crouch = false; p.aiming = false;
    p.rolling = 0; p.rollA = 0; p.stagger = 0; p.grabbedBy = null; p.act = null;
    p.walkPhase = 0; p.stepT = 0; p.fireT = 0; p.reloadT = 0; p.swingT = 0;
    p.overCap = 0;
    return p;
  }
  DZ.SAVE = SAVE;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
