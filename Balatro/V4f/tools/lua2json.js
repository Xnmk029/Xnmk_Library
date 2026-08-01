// Minimal Lua table parser (for Balatro decompiled localization files)
// Usage: node tools/lua2json.js ref/localization_zh_CN.lua > data/i18n.json
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');

// strip comments (--) but not inside strings
let s = '';
let inStr = false, strCh = '', i = 0;
while (i < src.length) {
  const c = src[i], n = src[i + 1];
  if (inStr) {
    s += c;
    if (c === '\\') { s += src[i + 1]; i += 2; continue; }
    if (c === strCh) inStr = false;
    i++; continue;
  }
  if (c === '"' || c === "'") { inStr = true; strCh = c; s += c; i++; continue; }
  if (c === '-' && n === '-') { while (i < src.length && src[i] !== '\n') i++; s += '\n'; continue; }
  s += c; i++;
}

// find the "return" keyword start
const ri = s.indexOf('return');
s = s.slice(ri + 6);

let pos = 0;
function skipWs() { while (pos < s.length && /\s/.test(s[pos])) pos++; }
function parseValue() {
  skipWs();
  const c = s[pos];
  if (c === '{') return parseTable();
  if (c === '"' || c === "'") return parseString();
  if (c === '[') { // [expr] = value — only used as table key; but could also be array access; handle key parse separately
    pos++; skipWs();
    const v = parseValue(); skipWs(); if (s[pos] === ']') pos++;
    return v;
  }
  // number / true / false / nil
  let m = /^[0-9.eE+-]+/.exec(s.slice(pos));
  if (m) { pos += m[0].length; return parseFloat(m[0]); }
  m = /^true/.exec(s.slice(pos)); if (m) { pos += 4; return true; }
  m = /^false/.exec(s.slice(pos)); if (m) { pos += 5; return false; }
  m = /^nil/.exec(s.slice(pos)); if (m) { pos += 3; return null; }
  throw new Error('Unexpected char at ' + pos + ': ' + s.slice(pos, pos + 30));
}
function parseString() {
  const q = s[pos]; pos++;
  let out = '';
  while (pos < s.length) {
    const c = s[pos];
    if (c === '\\') {
      const e = s[pos + 1];
      if (e === 'n') out += '\n';
      else if (e === 't') out += '\t';
      else if (e === '"') out += '"';
      else if (e === "'") out += "'";
      else if (e === '\\') out += '\\';
      else out += e;
      pos += 2; continue;
    }
    if (c === q) { pos++; return out; }
    out += c; pos++;
  }
  throw new Error('Unterminated string at ' + pos);
}
function parseTable() {
  pos++; // {
  const arr = [], map = {};
  let isArr = true;
  while (true) {
    skipWs();
    if (s[pos] === '}') { pos++; break; }
    let key = null;
    skipWs();
    if (s[pos] === '[') {
      isArr = false;
      pos++; skipWs();
      const kv = parseValue(); // key
      skipWs();
      if (s[pos] === ']') pos++;
      skipWs();
      if (s[pos] === '=') pos++;
      key = String(kv);
    } else if (/^[A-Za-z_]/.test(s[pos])) {
      isArr = false;
      let m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(pos));
      key = m[0]; pos += m[0].length;
      skipWs();
      if (s[pos] === '=') pos++;
    } else {
      key = arr.length;
    }
    const v = parseValue();
    if (key === null || typeof key === 'number') {
      arr[typeof key === 'number' ? key : arr.length] = v;
    } else {
      map[key] = v;
    }
    skipWs();
    if (s[pos] === ',') { pos++; continue; }
    if (s[pos] === ';') { pos++; continue; }
    if (s[pos] === '}') { pos++; break; }
    throw new Error('Expected , or } at ' + pos + ': ' + s.slice(pos, pos + 30));
  }
  if (isArr && Object.keys(map).length === 0) return arr;
  const out = { ...map };
  for (let i = 0; i < arr.length; i++) out[i] = arr[i];
  return out;
}
const result = parseValue();
console.log(JSON.stringify(result, null, 0));
