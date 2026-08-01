// build-data.js — 从反编译源码 + 元数据 + 官方中文本地化生成 js/data.js
// 用法: node tools/build-data.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const REF = path.join(ROOT, 'ref');
const TMP = 'C:/msys64/tmp/baldata';

const { parseLuaTable } = require('./luaparse');

// ---------- extract single-line definitions from game.lua ----------
const gameLua = fs.readFileSync(path.join(REF, 'game.lua'), 'utf8');
const lines = gameLua.split('\n');

function preprocess(src) {
  // HEX('...') and localize('...') function calls -> plain strings
  return src
    .replace(/HEX\('[^']*'\)/g, '"COLOR"')
    .replace(/localize\('[^']*'\)/g, '"LOCALIZE"')
    .replace(/localize\(\{[^}]*\}\)/g, '"LOCALIZE"')
    .replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, (m, a, b) => String(parseFloat(a) / parseFloat(b)));
}

function extractDefs(prefix) {
  const out = {};
  for (const line of lines) {
    const m = line.match(new RegExp('^\\s*(' + prefix + '_\\w+)\\s*=\\s*(\\{.*\\})\\s*,?\\s*$'));
    if (m) {
      try {
        const v = parseLuaTable(preprocess(m[2]));
        // strip fields we don't need
        delete v.unlock_condition;
        out[m[1]] = v;
      } catch (e) {
        console.log('parse fail:', m[1], e.message);
      }
    }
  }
  return out;
}

const JOKERS = extractDefs('j');
const TAROTS = extractDefs('c');
const VOUCHERS = extractDefs('v');
const BLINDS = extractDefs('bl');
const PACKS = extractDefs('p');
const ENHANCEMENTS = extractDefs('m');
const EDITIONS = extractDefs('e');
const DECKS = extractDefs('b');
const STAKES = extractDefs('stake');
const TAGS = extractDefs('tag');

// split consumables
const CONSUMABLES = {};
for (const [k, v] of Object.entries(TAROTS)) {
  CONSUMABLES[k] = v;
}

// ---------- poker hands from game.lua ----------
const handsSrc = gameLua.match(/hands = \{(?:[^}]*\})+\s*\}/s);
function extractHands() {
  const out = {};
  // the hands table is a nested key: ..., hands = { ... } (use lastIndexOf to skip the outer self.GAME.hands table)
  const i = gameLua.lastIndexOf('hands = {');
  if (i < 0) return out;
  const block = gameLua.slice(i + 'hands = {'.length);
  let depth = 1, j = 0;
  for (; j < block.length && depth > 0; j++) {
    if (block[j] === '{') depth++;
    else if (block[j] === '}') depth--;
  }
  const handsTbl = parseLuaTable(preprocess(block.slice(0, j)));
  for (const [k, v] of Object.entries(handsTbl)) {
    if (v && typeof v === 'object' && v.chips !== undefined) {
      out[k] = { chips: v.chips, mult: v.mult, l_chips: v.l_chips, l_mult: v.l_mult, order: v.order };
    }
  }
  return out;
}
const HANDS = extractHands();

// ---------- localization ----------
const i18n = JSON.parse(fs.readFileSync(path.join(ROOT, 'data_i18n_zh.json'), 'utf8'));
const desc = i18n.descriptions;
const dict = i18n.misc.dictionary;

// ---------- sprite metadata ----------
function readMeta(f) { return JSON.parse(fs.readFileSync(path.join(TMP, f), 'utf8')); }
const jokerSprites = readMeta('Jokers_jokers.json');
const tarotSprites = readMeta('Tarots_tarots.json');
const planetSprites = readMeta('Tarots_planets.json');
const spectralSprites = readMeta('Tarots_spectrals.json');
const boosterSprites = readMeta('Boosters_Boosters.json');
const voucherSprites = readMeta('Vouchers_vouchers.json');
const tagSprites = readMeta('Tags_tags.json');
const blindsMeta = readMeta('Bosses_blinds_metadata.json');
const enhancerSprites = readMeta('Decks_enhancers_metadata.json').sprites;
const stickersMeta = readMeta('Jokers_stickers_metadata.json');

function posOf(list, name) {
  const e = list.find(x => x.name === name);
  return e ? e.pos : { x: 0, y: 0 };
}

// ---------- assemble ----------
function cardEntry(key, def, locEntry, pos) {
  const e = {
    key,
    name: locEntry ? locEntry.name : def.name,
    text: locEntry ? (locEntry.text || []) : [],
    rarity: def.rarity || 1,
    cost: def.cost,
    config: def.config || {},
    pos,
  };
  if (def.set) e.set = def.set;
  return e;
}

const data = {
  HANDS,
  JOKERS: {},
  TAROTS: {},
  PLANETS: {},
  SPECTRALS: {},
  VOUCHERS: {},
  BLINDS: {},
  PACKS: {},
  ENHANCEMENTS: {},
  EDITIONS: {},
  DECKS: {},
  TAGS: {},
  DICT: dict,
  HAND_NAMES: i18n.misc.poker_hands,
  STAKES: {},
  STICKERS: stickersMeta.sprites,
};

for (const [k, v] of Object.entries(JOKERS)) {
  data.JOKERS[k] = cardEntry(k, v, desc.Joker && desc.Joker[k], posOf(jokerSprites, v.name.toLowerCase().replace(/[^a-z0-9]/g, '')) || posOf(jokerSprites, k.replace('j_', '')));
}
for (const [k, v] of Object.entries(CONSUMABLES)) {
  if (v.set === 'Tarot') data.TAROTS[k] = cardEntry(k, v, desc.Tarot && desc.Tarot[k], posOf(tarotSprites, k.replace('c_', '')));
  else if (v.set === 'Planet') data.PLANETS[k] = cardEntry(k, v, desc.Planet && desc.Planet[k], posOf(planetSprites, k.replace('c_', '')));
  else if (v.set === 'Spectral') data.SPECTRALS[k] = cardEntry(k, v, desc.Spectral && desc.Spectral[k], posOf(spectralSprites, k.replace('c_', '')));
}
for (const [k, v] of Object.entries(VOUCHERS)) {
  data.VOUCHERS[k] = cardEntry(k, v, desc.Voucher && desc.Voucher[k], posOf(voucherSprites, k.replace('v_', '')));
}
for (const [k, v] of Object.entries(BLINDS)) {
  data.BLINDS[k] = {
    key: k,
    name: (desc.Blind && desc.Blind[k] && desc.Blind[k].name) || v.name,
    text: (desc.Blind && desc.Blind[k] && desc.Blind[k].text) || [],
    mult: v.mult || 1,
    dollars: v.dollars || 0,
    boss: v.boss || null,
    debuff: v.debuff || {},
    pos: v.pos,
    order: v.order,
  };
}
for (const [k, v] of Object.entries(PACKS)) {
  data.PACKS[k] = {
    key: k,
    name: (desc.Booster && desc.Booster[k] && desc.Booster[k].name) || v.name,
    kind: v.kind,
    cost: v.cost,
    weight: v.weight || 1,
    extra: v.config && v.config.extra,
    choose: v.config && v.config.choose,
    pos: posOf(boosterSprites, v.name.toLowerCase().replace(/[^a-z0-9]/g, '')),
  };
}
for (const [k, v] of Object.entries(ENHANCEMENTS)) {
  data.ENHANCEMENTS[k] = {
    key: k,
    name: (desc.Enhanced && desc.Enhanced[k] && desc.Enhanced[k].name) || v.label || v.name,
    config: v.config || {},
    pos: enhancerSprites[k] ? enhancerSprites[k].pos : v.pos,
  };
}
for (const [k, v] of Object.entries(EDITIONS)) {
  data.EDITIONS[k] = { key: k, name: (desc.Edition && desc.Edition[k] && desc.Edition[k].name) || v.name, config: v.config || {} };
}
for (const [k, v] of Object.entries(DECKS)) {
  data.DECKS[k] = {
    key: k,
    name: (desc.Back && desc.Back[k] && desc.Back[k].name) || v.name,
    text: (desc.Back && desc.Back[k] && desc.Back[k].text) || [],
    config: v.config || {},
    pos: v.pos,
  };
}
for (const [k, v] of Object.entries(TAGS)) {
  data.TAGS[k] = {
    key: k,
    name: v.name,
    min_ante: v.min_ante,
    config: v.config || {},
    pos: posOf(tagSprites, k.replace('tag_', '')),
  };
}
for (const [k, v] of Object.entries(STAKES)) {
  data.STAKES[k] = { key: k, name: v.name, stake_level: v.stake_level, pos: v.pos };
}

// blind sprite positions: map game.lua pos -> metadata pos by name
for (const k of Object.keys(data.BLINDS)) {
  const b = data.BLINDS[k];
  // metadata uses sprite names; game.lua pos already matches sheet coordinates
  // (bl_small -> SmallBlind etc.)
}

// ---------- output ----------
const out = `// 自动生成: node tools/build-data.js （数据来源: Balatro 反编译源码 + 官方中文本地化）
window.BD = ${JSON.stringify(data)};
`;
fs.writeFileSync(path.join(ROOT, 'js', 'data.js'), out);
console.log('data.js written:', (out.length / 1024).toFixed(0), 'KB');
console.log('jokers:', Object.keys(data.JOKERS).length, 'tarots:', Object.keys(data.TAROTS).length,
  'planets:', Object.keys(data.PLANETS).length, 'spectrals:', Object.keys(data.SPECTRALS).length);
console.log('vouchers:', Object.keys(data.VOUCHERS).length, 'blinds:', Object.keys(data.BLINDS).length,
  'packs:', Object.keys(data.PACKS).length, 'tags:', Object.keys(data.TAGS).length,
  'decks:', Object.keys(data.DECKS).length, 'enh:', Object.keys(data.ENHANCEMENTS).length);
console.log('hands:', JSON.stringify(data.HANDS));
