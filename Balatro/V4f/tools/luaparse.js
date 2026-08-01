// tools/luaparse.js — 小型 Lua 表解析器（处理 Balatro 反编译数据）
function makeParser(src) {
  let s = src, pos = 0;
  function skipWs() { while (pos < s.length && /\s/.test(s[pos])) pos++; }
  function parseValue() {
    skipWs();
    const c = s[pos];
    if (c === '{') return parseTable();
    if (c === '"' || c === "'") return parseString();
    if (c === '[') { pos++; skipWs(); const v = parseValue(); skipWs(); if (s[pos] === ']') pos++; return v; }
    let m = /^[0-9.eE+-]+/.exec(s.slice(pos));
    if (m) { pos += m[0].length; return parseFloat(m[0]); }
    m = /^true/.exec(s.slice(pos)); if (m) { pos += 4; return true; }
    m = /^false/.exec(s.slice(pos)); if (m) { pos += 5; return false; }
    m = /^nil/.exec(s.slice(pos)); if (m) { pos += 3; return null; }
    throw new Error('Unexpected char at ' + pos + ': ' + s.slice(pos, pos + 40));
  }
  function parseString() {
    const q = s[pos]; pos++;
    let out = '';
    while (pos < s.length) {
      const c = s[pos];
      if (c === '\\') {
        const e = s[pos + 1];
        if (e === 'n') out += '\n'; else if (e === 't') out += '\t';
        else if (e === '"') out += '"'; else if (e === "'") out += "'";
        else if (e === '\\') out += '\\'; else out += e;
        pos += 2; continue;
      }
      if (c === q) { pos++; return out; }
      out += c; pos++;
    }
    throw new Error('Unterminated string');
  }
  function parseTable() {
    pos++;
    const arr = [], map = {};
    let isArr = true;
    while (true) {
      skipWs();
      if (s[pos] === '}') { pos++; break; }
      let key = null;
      skipWs();
      if (s[pos] === '[') {
        isArr = false; pos++; skipWs();
        const kv = parseValue(); skipWs();
        if (s[pos] === ']') pos++;
        skipWs(); if (s[pos] === '=') pos++;
        key = String(kv);
      } else if (/^[A-Za-z_][A-Za-z0-9_]*/.test(s.slice(pos))) {
        const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(pos));
        const save = pos;
        pos += m[0].length;
        skipWs();
        if (s[pos] === '=') { isArr = false; key = m[0]; pos++; }
        else { pos = save; key = arr.length; }
      } else {
        key = arr.length;
      }
      const v = parseValue();
      if (typeof key === 'number') arr[key] = v; else map[key] = v;
      skipWs();
      if (s[pos] === ',') { pos++; continue; }
      if (s[pos] === ';') { pos++; continue; }
      if (s[pos] === '}') { pos++; break; }
      throw new Error('Expected , or } at ' + pos + ': ' + s.slice(pos, pos + 40));
    }
    if (isArr && Object.keys(map).length === 0) return arr;
    return Object.assign({}, map, arr);
  }
  return { parseValue, parseTable };
}

function stripComments(src) {
  let s = '', inStr = false, strCh = '', i = 0;
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
  return s;
}

function preprocess(src) {
  return src
    .replace(/HEX\('[^']*'\)/g, '"COLOR"')
    .replace(/localize\('[^']*'\)/g, '"LOCALIZE"')
    .replace(/localize\(\{[^}]*\}\)/g, '"LOCALIZE"')
    .replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, (m, a, b) => String(parseFloat(a) / parseFloat(b)));
}

function parseLuaTable(src) {
  const cleaned = stripComments(preprocess(src)).trim();
  // 若源文本不是以 { 开头（例如 table 构造函数体），自动包一层花括号
  const wrapped = cleaned.startsWith('{') ? cleaned : '{' + cleaned + '}';
  const p = makeParser(wrapped);
  return p.parseValue();
}

module.exports = { parseLuaTable, makeParser, stripComments, preprocess };
