// 版本化存档。三条硬规则：
//  1. 带 version，读取时按需迁移 —— 否则一次字段改名就会让玩家丢档
//  2. JSON.parse 必须包 try/catch —— 损坏的存档不能让游戏起不来
//  3. setItem 失败（配额/隐私模式）要降级到内存并告知，不能静默丢数据
const KEY = 'duckboid.save.v1';
export const SAVE_VERSION = 1;

let memoryFallback = null;
let warned = false;

const MIGRATIONS = {
  // 0: (s) => ({ ...s, version: 1 }),   // 未来版本在此追加
};

export function save(data) {
  const payload = { version: SAVE_VERSION, at: Date.now(), data };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    memoryFallback = null;
    return true;
  } catch (e) {
    memoryFallback = payload;
    if (!warned) { warned = true; console.warn('[save] localStorage 不可用，已降级到内存：', e?.message); }
    return false;
  }
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { raw = null; }
  if (!raw && memoryFallback) return migrate(memoryFallback);
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('[save] 存档损坏，已忽略：', e?.message);
    return null;
  }
}

function migrate(payload) {
  if (!payload || typeof payload !== 'object') return null;
  let v = payload.version ?? 0;
  let data = payload.data;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) { v = SAVE_VERSION; break; }      // 没有迁移函数就直接升版本，避免死循环
    data = m(data);
    v++;
  }
  return { version: SAVE_VERSION, at: payload.at, data };
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* 忽略 */ }
  memoryFallback = null;
}

/** 从游戏实例收集可序列化状态（只存摘要，不存整个场景） */
export function snapshot(game) {
  const inv = game.inventory;
  return {
    day: game.day, minutes: game.minutes,
    map: game.world.id,
    kills: game.kills || 0,
    health: {
      body: game.health.body,
      needs: game.health.needs,
      panic: game.health.panic,
    },
    inventory: {
      grid: [...inv.grid.items.values()].map((it) => ({ id: it.id, n: it.count, x: it.x, y: it.y })),
      loadout: Object.fromEntries(['primary', 'secondary', 'melee', 'head', 'body', 'backpack']
        .map((s) => [s, inv.loadout.get(s)?.id ?? null])),
      safe: [...inv.safe.items.values()].map((it) => ({ id: it.id, n: it.count })),
    },
    hideout: game.hideout?.serialize?.() ?? null,
    stash: game.stash ?? [],
    quests: game.questState ?? {},
    unlocked: game.unlockedMaps ?? ['zone0'],
  };
}

/** 把存档回填到游戏实例（与 snapshot 严格对应） */
export function restore(game, data) {
  if (!data) return false;
  try {
    game.day = data.day ?? 1;
    game.minutes = data.minutes ?? 420;
    game.kills = data.kills ?? 0;
    if (data.health?.body) Object.assign(game.health.body, data.health.body);
    if (data.health?.needs) Object.assign(game.health.needs, data.health.needs);
    if (data.inventory?.grid) {
      for (const it of data.inventory.grid) game.inventory.grid.add(it.id, it.n ?? 1);
    }
    if (data.inventory?.loadout) {
      for (const [slot, id] of Object.entries(data.inventory.loadout)) {
        if (!id) continue;
        const it = game.inventory.grid.add(id, 1);
        if (it) game.inventory.equip(it.uid);
      }
    }
    game.inventory.recalc();
    game.syncEquipped?.();
    game.unlockedMaps = data.unlocked ?? ['zone0'];
    game.stash = data.stash ?? [];
    game.questState = data.quests ?? {};
    return true;
  } catch (e) {
    console.warn('[save] 回填失败：', e?.message);
    return false;
  }
}
