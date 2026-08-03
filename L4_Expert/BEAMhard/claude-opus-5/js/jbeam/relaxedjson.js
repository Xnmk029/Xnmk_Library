/**
 * relaxedjson.js — tolerant SJSON parser for BeamNG .jbeam documents.
 *
 * The JBeam dialect is JSON with:
 *   - // line comments and block comments
 *   - optional commas between array items and object pairs (whitespace-implied)
 *   - trailing commas
 *   - unquoted bare keys (rare, but seen in the wild)
 *   - lenient numbers (.5, 5., 1e3, -0)
 *
 * Pure ES module, DOM-free — shared verbatim between the browser runtime and
 * the Node test-suite. Single forward scan, recursive descent, line-tracked
 * error reporting.
 */

export class JBeamSyntaxError extends Error {
  constructor(message, line, col, file) {
    super(`${file ? file + ':' : ''}${line}:${col} ${message}`);
    this.name = 'JBeamSyntaxError';
    this.line = line;
    this.col = col;
    this.file = file;
  }
}

export function parseJBeam(text, fileName = '<jbeam>') {
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const n = text.length;

  const err = (msg) => { throw new JBeamSyntaxError(msg, line, i - lineStart + 1, fileName); };

  function skipWS() {
    for (;;) {
      while (i < n) {
        const c = text.charCodeAt(i);
        if (c === 10) { line++; i++; lineStart = i; }
        else if (c === 32 || c === 9 || c === 13 || c === 44 /* stray commas are whitespace */) i++;
        else break;
      }
      if (i + 1 < n && text.charCodeAt(i) === 47) {
        const c2 = text.charCodeAt(i + 1);
        if (c2 === 47) {            // line comment
          i += 2;
          while (i < n && text.charCodeAt(i) !== 10) i++;
          continue;
        }
        if (c2 === 42) {            // block comment
          i += 2;
          while (i + 1 < n && !(text.charCodeAt(i) === 42 && text.charCodeAt(i + 1) === 47)) {
            if (text.charCodeAt(i) === 10) { line++; lineStart = i + 1; }
            i++;
          }
          if (i + 1 >= n) err('unterminated block comment');
          i += 2;
          continue;
        }
      }
      break;
    }
  }

  function parseString() {
    // assumes text[i] === '"'
    i++;
    let start = i;
    let out = '';
    for (;;) {
      if (i >= n) err('unterminated string');
      const c = text.charCodeAt(i);
      if (c === 34) { out += text.slice(start, i); i++; return out; }
      if (c === 92) { // backslash
        out += text.slice(start, i);
        i++;
        const e = text[i];
        if (e === 'n') out += '\n';
        else if (e === 't') out += '\t';
        else if (e === 'r') out += '\r';
        else if (e === 'b') out += '\b';
        else if (e === 'f') out += '\f';
        else if (e === 'u') { out += String.fromCharCode(parseInt(text.slice(i + 1, i + 5), 16)); i += 4; }
        else out += e; // \" \\ \/ and anything else literal
        i++;
        start = i;
      } else {
        if (c === 10) { line++; lineStart = i + 1; } // tolerate raw newline in string
        i++;
      }
    }
  }

  function parseBareWord() {
    const start = i;
    while (i < n) {
      const c = text.charCodeAt(i);
      // stop at whitespace or structural chars
      if (c <= 32 || c === 44 || c === 58 || c === 93 || c === 125 || c === 91 || c === 123 || c === 34 || c === 47) break;
      i++;
    }
    if (i === start) err('unexpected character "' + text[i] + '"');
    return text.slice(start, i);
  }

  function parseValue() {
    skipWS();
    if (i >= n) err('unexpected end of input');
    const c = text.charCodeAt(i);
    if (c === 123) return parseObject();
    if (c === 91) return parseArray();
    if (c === 34) return parseString();
    // number / literal / bare word
    const word = parseBareWord();
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    const num = Number(word);
    if (!Number.isNaN(num)) return num;
    return word; // tolerate bare-word strings
  }

  function parseObject() {
    i++; // {
    const obj = {};
    for (;;) {
      skipWS();
      if (i >= n) err('unterminated object');
      if (text.charCodeAt(i) === 125) { i++; return obj; }
      let key;
      if (text.charCodeAt(i) === 34) key = parseString();
      else key = parseBareWord();
      skipWS();
      if (text.charCodeAt(i) === 58) i++;
      else err(`expected ":" after key "${key}"`);
      obj[key] = parseValue();
    }
  }

  function parseArray() {
    i++; // [
    const arr = [];
    for (;;) {
      skipWS();
      if (i >= n) err('unterminated array');
      if (text.charCodeAt(i) === 93) { i++; return arr; }
      arr.push(parseValue());
    }
  }

  skipWS();
  const root = parseValue();
  skipWS();
  // trailing garbage is tolerated (some mods append stray braces); parse stops at root.
  return root;
}

export default parseJBeam;
