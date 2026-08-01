// Phase 1.1 — JBeam (BeamNG) structural definition parser for the web front-end.
// Handles BeamNG's relaxed JSON dialect: // and /* */ comments, trailing commas,
// header-row tables (["id","posX",...] followed by option dicts and data rows),
// and the $variable system ($ref, $=assignment, $+additive, arithmetic expressions).
// Pure ESM, dependency-free — runs in the browser and in Node for validation.

/**
 * Strip JS-style comments from JBeam text without touching quoted strings.
 * @param {string} text raw .jbeam file text
 * @returns {string} comment-free text
 */
export function stripComments(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  let inStr = false;
  while (i < n) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += text[i + 1]; i += 2; continue; }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Remove trailing commas before } or ] (common in JBeam). */
export function stripTrailingCommas(text) {
  return text.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Repair BeamNG's "missing comma between rows" dialect: authors routinely write
 * adjacent array rows / object entries on separate lines with no comma, e.g.
 *   ["electricsBridge"]
 *   ["innocent_dynamicCabinFilter", {...}]
 * Strict JSON rejects this, so we insert a comma wherever a completed value is
 * immediately followed (after whitespace) by the start of another value or key.
 * String-aware; never touches string contents, and never fires before a ':'
 * (a string closing a key is not a completed value).
 * @param {string} text comment-free jbeam text
 * @returns {string} text with the omitted commas restored
 */
export function fixMissingCommas(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  let valueEnd = false; // last token closed a value ("]", "}", string, literal)
  const isStarter = (c) =>
    c === '[' || c === '{' || c === '"' || c === '-' ||
    (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      if (valueEnd) out += ',';
      valueEnd = false;
      out += c;
      i++;
      while (i < n) {
        const s = text[i];
        out += s;
        if (s === '\\' && i + 1 < n) { out += text[i + 1]; i += 2; continue; }
        i++;
        if (s === '"') break;
      }
      valueEnd = true; // cleared again if a ':' follows (string was a key)
      continue;
    }
    if (/\s/.test(c)) { out += c; i++; continue; }
    if (c === ',') {
      // collapse doubled / leading commas (",," or "[,") — another jbeam slip
      const prev = out.replace(/\s+$/, '').slice(-1);
      if (!valueEnd && (prev === ',' || prev === '[' || prev === '{')) { i++; continue; }
      valueEnd = false; out += c; i++; continue;
    }
    if (c === ':') { valueEnd = false; out += c; i++; continue; }
    if (c === ']' || c === '}') { valueEnd = true; out += c; i++; continue; }
    // value starters
    if (isStarter(c)) {
      if (valueEnd) out += ',';
      valueEnd = false;
      if (c === '[' || c === '{') { out += c; i++; continue; }
      // number / keyword / bare token: consume the literal
      while (i < n && /[\w$.+\-]/.test(text[i])) { out += text[i]; i++; }
      valueEnd = true;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Evaluate a $-expression such as "$=-$gear_R" or "$=$brakestrength*1900"
 * against a variable table. Supports + - * / ( ) and numeric literals.
 * @param {string} expr
 * @param {Map<string,number>} vars
 * @returns {number|null} evaluated value, or null when unresolvable
 */
export function evalVarExpression(expr, vars) {
  let s = expr.trim();
  if (s.startsWith('$=')) s = s.slice(2);
  else if (s.startsWith('$+')) return null; // additive modifiers handled by caller
  else if (s.startsWith('$')) s = s.slice(1);
  // Replace variable names (longest first so $gear_10 wins over $gear_1).
  const names = [...vars.keys()].sort((a, b) => b.length - a.length);
  for (const name of names) {
    s = s.split(name).join(`(${vars.get(name)})`);
  }
  if (/[^0-9+\-*/().\s]/.test(s)) return null; // unresolved symbols remain
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${s});`)();
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Normalize a JBeam "table" section: an array whose rows are a header row
 * (all strings), option dicts (apply to every following data row), and data rows.
 * @param {Array} rows raw section array
 * @param {Map<string,number>} [vars] variable table for $-substitution
 * @returns {{header: string[], rows: Object[]}} rows as objects keyed by header
 */
export function normalizeTable(rows, vars = new Map()) {
  if (!Array.isArray(rows)) return { header: [], rows: [] };
  let header = null;
  let options = {};
  const out = [];
  for (const row of rows) {
    if (Array.isArray(row)) {
      if (header === null && row.every((c) => typeof c === 'string')) {
        header = row; // column definition row
        continue;
      }
      if (header) {
        const obj = {};
        for (let i = 0; i < header.length; i++) {
          if (i >= row.length) continue;
          const cell = row[i];
          // JBeam data rows often carry an inline option dict as the last cell —
          // merge its keys into the row rather than filing under a column.
          if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
            for (const [k, v] of Object.entries(cell)) obj[k] = substitute(v, vars);
          } else {
            obj[header[i]] = substitute(cell, vars);
          }
        }
        out.push({ ...options, ...obj });
      }
    } else if (row && typeof row === 'object') {
      // Option dict: merged into subsequent rows; may also carry $= assignments.
      const merged = {};
      for (const [k, v] of Object.entries(row)) {
        merged[k] = substitute(v, vars);
        if (typeof v === 'string' && v.startsWith('$=')) {
          const val = evalVarExpression(v, vars);
          if (val !== null) vars.set(k, val);
        }
      }
      options = { ...options, ...merged };
    }
  }
  return { header: header || [], rows: out };
}

/** Recursively substitute $variables in strings; evaluate pure-numeric expressions. */
function substitute(value, vars) {
  if (typeof value !== 'string' || !value.includes('$')) return value;
  if (value.startsWith('$=') || /^\$[+\-*/]?=?[\w$+\-*/(). ]+$/.test(value)) {
    const v = evalVarExpression(value, vars);
    if (v !== null) return v;
  }
  return value; // leave as-is when not numeric-resolvable
}

/**
 * Extract the first complete JSON document ({...} or [...]) from text that may
 * carry trailing garbage after the root close (e.g. a stray comma at EOF, as in
 * ccf_racing_seats.jbeam). String-aware brace matching.
 * @param {string} text
 * @returns {string} the first balanced document, or the whole text if unbalanced
 */
export function extractFirstDocument(text) {
  const start = text.search(/[{[]/);
  if (start < 0) return text;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/**
 * Parse a complete .jbeam file.
 * @param {string} text file contents
 * @returns {{parts: Object<string, Object>, variables: Map<string,number>}}
 *   parts: partName -> { sectionName: rawValue }; variables discovered from the file.
 */
export function parseJBeam(text) {
  const clean = extractFirstDocument(fixMissingCommas(stripTrailingCommas(stripComments(text))));
  const doc = JSON.parse(clean);
  const variables = new Map();
  // First pass: collect variable defaults so $refs inside tables resolve.
  for (const part of Object.values(doc)) {
    if (!part || typeof part !== 'object') continue;
    if (Array.isArray(part.variables)) {
      const [header, ...rows] = part.variables;
      const nameIdx = header.indexOf('name');
      const defIdx = header.indexOf('default');
      for (const r of rows) {
        const name = String(r[nameIdx]).replace(/^\$/, '');
        const def = Number(r[defIdx]);
        if (name && Number.isFinite(def)) variables.set(name, def);
      }
    }
  }
  return { parts: doc, variables };
}

/**
 * Fetch and parse several .jbeam files, merging parts and variables.
 * @param {(url:string)=>Promise<string>} fetchText injected fetcher (browser fetch or fs)
 * @param {string[]} urls
 */
export async function parseJBeamFiles(fetchText, urls) {
  const parts = {};
  const variables = new Map();
  for (const url of urls) {
    const { parts: p, variables: v } = parseJBeam(await fetchText(url));
    Object.assign(parts, p);
    for (const [k, val] of v) if (!variables.has(k)) variables.set(k, val);
  }
  return { parts, variables };
}
