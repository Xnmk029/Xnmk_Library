// ============================================================================
// core/jbeam-parser.js — BeamNG .jbeam structural parser (browser + Node)
// Parses the loose JSON dialect used by BeamNG (// comments, trailing commas,
// section rows with option dictionaries) into a strict structural model:
//   parts -> { nodes, beams, pressureWheels, flexbodies, variables, engine, ... }
// ============================================================================

// Strip // line comments and /* */ block comments without touching strings.
function stripComments(text) {
  let out = '';
  let i = 0, inStr = false;
  const n = text.length;
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
      while (i + 1 < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c; i++;
  }
  return out;
}

// Remove trailing commas before } or ] (invalid in strict JSON).
function stripTrailingCommas(text) {
  let out = '';
  let i = 0, inStr = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += text[i + 1]; i += 2; continue; }
      if (c === '"') inStr = false;
      i++; continue;
    }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === ',') {
      // lookahead past whitespace
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') { i++; continue; } // drop comma
    }
    out += c; i++;
  }
  return out;
}

// Quote bare "FLT_MAX"-style tokens BeamNG occasionally emits (defensive).
function sanitize(text) {
  return text
    .replace(/:\s*FLT_MAX/g, ': 3.402823466e38')
    .replace(/:\s*-FLT_MAX/g, ': -3.402823466e38')
    .replace(/:\s*nil/g, ': null');
}

// BeamNG's parser tolerates omitted commas between rows/objects/props:
//   ["a","b"]\n  {"opt":1}\n  ["c","d"]          (array rows)
//   "deformGroups":[...]\n  "nextProp":[...]     (object props)
//   }\n "nextPart": {                            (top-level parts)
// Insert the missing commas with a string-aware char scan: after a closer
// ( } or ] ), a string, or a primitive, if the next meaningful token starts a
// new value ( { [ " digit - + t f n ) where JSON would require a comma, add it.
function insertMissingCommas(text) {
  let out = '';
  const n = text.length;
  let i = 0, inStr = false;
  let prevMeaningful = ''; // category of previous token: 'close' | 'str' | 'prim' | 'other'
  while (i < n) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += text[i + 1]; i += 2; continue; }
      if (c === '"') { inStr = false; prevMeaningful = 'str'; }
      i++; continue;
    }
    if (c === '"') {
      // a string starting right after a closed value => missing comma
      if (prevMeaningful === 'close' || prevMeaningful === 'str' || prevMeaningful === 'prim') out += ',';
      inStr = true; out += c; i++; continue;
    }
    if (/\s/.test(c)) { out += c; i++; continue; }
    if (c === '}' || c === ']') { out += c; prevMeaningful = 'close'; i++; continue; }
    if (c === '{' || c === '[') {
      if (prevMeaningful === 'close' || prevMeaningful === 'prim' || prevMeaningful === 'str') out += ',';
      out += c; prevMeaningful = 'other'; i++; continue;
    }
    if (c === ',') {
      // collapse duplicate commas (",," with optional whitespace) from source typos
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j++;
      if (text[j] === ',') { i++; continue; } // drop this comma, keep the next
      out += c; prevMeaningful = 'other'; i++; continue;
    }
    if (/[\d+\-.]/.test(c)) {
      // number primitive; after a closed value => missing comma
      if (prevMeaningful === 'close' || prevMeaningful === 'str' || prevMeaningful === 'prim') out += ',';
      let j = i;
      while (j < n && /[\d+\-.eE]/.test(text[j])) j++;
      // guard: lone '-'/'+'/'.' or sign directly before ':' (not a value)
      const tok = text.slice(i, j);
      out += tok;
      if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(tok)) prevMeaningful = 'other';
      else prevMeaningful = 'prim';
      i = j; continue;
    }
    if (/[a-zA-Z_$]/.test(c)) {
      // word primitive (true/false/null) or key-ish token outside string
      let j = i;
      while (j < n && /[\w$]/.test(text[j])) j++;
      const w = text.slice(i, j);
      if (w === 'true' || w === 'false' || w === 'null') {
        if (prevMeaningful === 'close' || prevMeaningful === 'str' || prevMeaningful === 'prim') out += ',';
        out += w; prevMeaningful = 'prim';
      } else {
        out += w; prevMeaningful = 'other';
      }
      i = j; continue;
    }
    if (c === ':') { out += c; prevMeaningful = 'other'; i++; continue; }
    out += c; i++;
  }
  return out;
}

export function parseJBeamJSON(text) {
  const cleaned = stripTrailingCommas(insertMissingCommas(sanitize(stripTrailingCommas(stripComments(text)))));
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Some mods carry an unbalanced trailing brace: fall back to the first
    // balanced root object (string-aware brace counting).
    const balanced = extractBalancedRoot(cleaned);
    if (balanced) return JSON.parse(balanced);
    throw e;
  }
}

// Return the substring spanning the first balanced {...} root object, or null.
function extractBalancedRoot(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section rows come as: header row (array of column-name strings), option
// dicts {..} that apply to following rows, and data rows [v0, v1, .., {opts}].
// A data row of pure strings (e.g. beams ["fw1r","fw1rr"]) must NOT be taken
// for a header: headers carry at least one "name:" style column or start with
// a well-known column name.
// ---------------------------------------------------------------------------
const KNOWN_HEADER_FIRST = new Set(['id', 'mesh', 'func', 'type', 'name', 'mode', 'posX', 'id1:']);
function isHeaderRow(row) {
  if (!Array.isArray(row) || row.length === 0) return false;
  if (!row.every((c) => typeof c === 'string')) return false;
  if (row.some((c) => c.endsWith(':'))) return true;
  return KNOWN_HEADER_FIRST.has(row[0]);
}

function num(v, fallback = 0) {
  const f = parseFloat(v);
  return Number.isFinite(f) ? f : fallback;
}

// ---------------------------------------------------------------------------
// Parse one .jbeam file into structured parts.
// ---------------------------------------------------------------------------
export function parseJBeamFile(text, fileName = '') {
  const raw = parseJBeamJSON(text);
  const parts = {};
  for (const [partName, body] of Object.entries(raw)) {
    if (!body || typeof body !== 'object') continue;
    const part = {
      name: partName,
      file: fileName,
      slotType: body.slotType || '',
      information: body.information || {},
      slots: Array.isArray(body.slots) ? body.slots : [],
      variables: parseVariables(body.variables),
      raw,
      nodes: [],
      beams: [],
      triangles: [],
      pressureWheels: [],
      flexbodies: [],
      rails: [],
      refNodes: body.refNodes || null,
      mainEngine: body.mainEngine || null,
      powertrain: Array.isArray(body.powertrain) ? body.powertrain : null,
      camber: body.camberBrackets || null,
      glowMap: body.glowMap || null,
      props: Array.isArray(body.props) ? body.props : [],
      sounds: body.soundConfig || null,
      extras: {},
    };

    // ---- nodes ----
    if (Array.isArray(body.nodes)) {
      let cur = {};
      for (const row of body.nodes) {
        if (Array.isArray(row)) {
          if (isHeaderRow(row)) { cur = {}; continue; }
          const lastEl = row[row.length - 1];
          const hasInline = !!(lastEl && typeof lastEl === 'object' && !Array.isArray(lastEl));
          const inline = hasInline ? lastEl : {};
          const vals = hasInline ? row.slice(0, -1) : row;
          if (vals.length < 4) continue;
          const o = { ...cur, ...inline };
          part.nodes.push({
            id: String(vals[0]),
            pos: [num(vals[1]), num(vals[2]), num(vals[3])], // JBeam x,y,z
            weight: num(o.nodeWeight, 25),
            friction: num(o.frictionCoef, 0.5),
            group: Array.isArray(o.group) ? o.group.join('|') : (o.group || ''),
            collision: o.collision !== false,
            selfCollision: o.selfCollision === true,
            material: o.nodeMaterial || '',
            hubGroup: o.hubGroup || '',
          });
        } else if (row && typeof row === 'object') {
          cur = { ...cur, ...row };
        }
      }
    }

    // ---- beams ----
    if (Array.isArray(body.beams)) {
      let cur = {};
      for (const row of body.beams) {
        if (Array.isArray(row)) {
          if (isHeaderRow(row)) { cur = {}; continue; }
          const lastEl = row[row.length - 1];
          const hasInline = !!(lastEl && typeof lastEl === 'object' && !Array.isArray(lastEl));
          const inline = hasInline ? lastEl : {};
          const vals = hasInline ? row.slice(0, -1) : row;
          if (vals.length < 2) continue;
          const o = { ...cur, ...inline };
          part.beams.push({
            id1: String(vals[0]),
            id2: String(vals[1]),
            spring: num(o.beamSpring, 0),
            damp: num(o.beamDamp, 0),
            deform: num(o.beamDeform, 0),
            strength: num(o.beamStrength, 0),
            precompression: num(o.beamPrecompression, 1),
            type: o.beamType || '|NORMAL',
            name: o.name || '',
            breakGroup: o.breakGroup || '',
            optional: o.optional === true,
          });
        } else if (row && typeof row === 'object') {
          cur = { ...cur, ...row };
        }
      }
    }

    // ---- pressureWheels (tire definitions) ----
    if (Array.isArray(body.pressureWheels)) {
      let cur = {};
      for (const row of body.pressureWheels) {
        if (Array.isArray(row)) {
          if (isHeaderRow(row)) { cur = {}; continue; }
          const o = { ...cur };
          const vals = row.filter((c) => typeof c === 'string' || typeof c === 'number');
          part.pressureWheels.push({
            name: vals[0] || partName,
            hubGroup: vals[1] || '', group: vals[2] || '',
            node1: vals[3] || '', node2: vals[4] || '',
            nodeS: vals[5] || '', nodeArm: vals[6] || '',
            wheelDir: num(vals[7], 1),
            radius: num(o.radius, 0.33),
            tireWidth: num(o.tireWidth, 0.2),
            hubRadius: num(o.hubRadius, 0.2),
            hubWidth: num(o.hubWidth, 0.18),
            numRays: num(o.numRays, 15),
            hasTire: o.hasTire !== false,
            frictionCoef: num(o.frictionCoef, 1.0),
            slidingFrictionCoef: num(o.slidingFrictionCoef, 1.0),
            noLoadCoef: num(o.noLoadCoef, 1.4),
            fullLoadCoef: num(o.fullLoadCoef, 0.5),
            loadSensitivitySlope: num(o.loadSensitivitySlope, 0.00018),
            softnessCoef: num(o.softnessCoef, 0.7),
            treadCoef: num(o.treadCoef, 0.7),
            stribeckExponent: num(o.stribeckExponent, 1.5),
            treadSpring: num(o.wheelTreadBeamSpring, 100000),
            treadDamp: num(o.wheelTreadBeamDamp, 60),
            sideSpring: num(o.wheelSideBeamSpring, 20000),
            sideDamp: num(o.wheelSideBeamDamp, 25),
            peripherySpring: num(o.wheelPeripheryBeamSpring, 60000),
            peripheryDamp: num(o.wheelPeripheryBeamDamp, 35),
            reinfSpring: num(o.wheelReinfBeamSpring, 30000),
            reinfDamp: num(o.wheelReinfBeamDamp, 175),
            pressurePSI: num(o.pressurePSI, 30),
            dragCoef: num(o.dragCoef, 5),
            nodeWeight: num(o.nodeWeight, 0.15),
          });
        } else if (row && typeof row === 'object') {
          cur = { ...cur, ...row };
        }
      }
    }

    // ---- flexbodies (mesh <-> node-group bindings) ----
    if (Array.isArray(body.flexbodies)) {
      let cur = {};
      for (const row of body.flexbodies) {
        if (Array.isArray(row)) {
          if (isHeaderRow(row)) { cur = {}; continue; }
          const mesh = row[0];
          const groups = Array.isArray(row[1]) ? row[1] : [];
          const extra = row[3] && typeof row[3] === 'object' ? row[3] : {};
          part.flexbodies.push({
            mesh: String(mesh), groups,
            pos: extra.pos || { x: 0, y: 0, z: 0 },
            rot: extra.rot || { x: 0, y: 0, z: 0 },
            scale: extra.scale || { x: 1, y: 1, z: 1 },
            ...cur,
          });
        } else if (row && typeof row === 'object') {
          cur = { ...cur, ...row };
        }
      }
    }

    parts[partName] = part;
  }
  return parts;
}

// variables section -> { $name: {default, min, max, ...} }
function parseVariables(vars) {
  const out = {};
  if (!Array.isArray(vars)) return out;
  for (const row of vars) {
    if (!Array.isArray(row) || row.length < 5) continue;
    if (row[0] === 'name') continue;
    const name = String(row[0]);
    out[name] = { type: row[1], unit: row[2], category: row[3], default: row[4], min: row[5], max: row[6] };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mini expression evaluator for BeamNG "$=..." Lua-ish value expressions.
// Supports: numbers, $vars, + - * / % ( ), comparisons, and/or/not, case(...).
// ---------------------------------------------------------------------------
export function evalExpr(expr, vars = {}) {
  if (typeof expr === 'number') return expr;
  if (typeof expr !== 'string') return NaN;
  let s = expr.trim();
  if (s.startsWith('$=')) s = s.slice(2);
  else if (/^\$[\w]+$/.test(s)) {
    const v = vars[s.slice(1)];
    return typeof v === 'number' ? v : NaN;
  }
  // tokenise
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < s.length && /[\d.eE+-]/.test(s[j]) && !(j > i && /[+-]/.test(s[j]) && !/[eE]/.test(s[j - 1]))) j++;
      tokens.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j; continue;
    }
    if (c === '$') {
      let j = i + 1;
      while (j < s.length && /[\w]/.test(s[j])) j++;
      tokens.push({ t: 'var', v: s.slice(i + 1, j) });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[\w]/.test(s[j])) j++;
      tokens.push({ t: 'word', v: s.slice(i, j) });
      i = j; continue;
    }
    if ('+-*/%(),'.includes(c)) { tokens.push({ t: c }); i++; continue; }
    if (c === '=' && s[i + 1] === '=') { tokens.push({ t: 'op', v: '==' }); i += 2; continue; }
    if (c === '~' && s[i + 1] === '=') { tokens.push({ t: 'op', v: '!=' }); i += 2; continue; }
    if (c === '!' && s[i + 1] === '=') { tokens.push({ t: 'op', v: '!=' }); i += 2; continue; }
    if ('<>'.includes(c)) {
      if (s[i + 1] === '=') { tokens.push({ t: 'op', v: c + '=' }); i += 2; } else { tokens.push({ t: 'op', v: c }); i++; }
      continue;
    }
    i++; // skip unknown char
  }
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];

  function parseOr() {
    let l = parseAnd();
    while (peek() && ((peek().t === 'word' && peek().v === 'or'))) { next(); const r = parseAnd(); l = truthy(l) ? l : r; }
    return l;
  }
  function parseAnd() {
    let l = parseCmp();
    while (peek() && ((peek().t === 'word' && peek().v === 'and'))) { next(); const r = parseCmp(); l = truthy(l) ? r : l; }
    return l;
  }
  function parseCmp() {
    let l = parseAdd();
    while (peek() && peek().t === 'op') {
      const op = next().v; const r = parseAdd();
      switch (op) {
        case '==': l = (l === r) ? 1 : 0; break;
        case '!=': l = (l !== r) ? 1 : 0; break;
        case '<': l = l < r ? 1 : 0; break;
        case '>': l = l > r ? 1 : 0; break;
        case '<=': l = l <= r ? 1 : 0; break;
        case '>=': l = l >= r ? 1 : 0; break;
      }
    }
    return l;
  }
  function parseAdd() {
    let l = parseMul();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = next().t; const r = parseMul();
      l = op === '+' ? l + r : l - r;
    }
    return l;
  }
  function parseMul() {
    let l = parseUnary();
    while (peek() && (peek().t === '*' || peek().t === '/' || peek().t === '%')) {
      const op = next().t; const r = parseUnary();
      l = op === '*' ? l * r : op === '/' ? l / r : l % r;
    }
    return l;
  }
  function parseUnary() {
    if (peek() && peek().t === '-') { next(); return -parseUnary(); }
    if (peek() && peek().t === '+') { next(); return parseUnary(); }
    if (peek() && peek().t === 'word' && peek().v === 'not') { next(); return truthy(parseUnary()) ? 0 : 1; }
    return parsePrim();
  }
  function parsePrim() {
    const tk = next();
    if (!tk) return NaN;
    if (tk.t === 'num') return tk.v;
    if (tk.t === 'var') {
      const v = vars[tk.v];
      return typeof v === 'number' ? v : undefined;
    }
    if (tk.t === 'word') {
      if (tk.v === 'nil') return undefined;
      if (tk.v === 'true') return 1;
      if (tk.v === 'false') return 0;
      // 'case(...)' is resolved by a textual rewrite pass before token parsing,
      // so encountering it here means malformed input.
      return undefined;
    }
    if (tk.t === '(') {
      const v = parseOr();
      if (peek() && peek().t === ')') next();
      return v;
    }
    return NaN;
  }
  const truthy = (v) => v !== undefined && v !== null && v !== 0 && v === v;

  // case() needs a dedicated pre-pass because of nested commas: handle by
  // rewriting "case(c,a,b)" patterns iteratively with the tokenizer intact.
  // Simplest robust route: evaluate directly when no 'case' present.
  if (!/\bcase\s*\(/.test(s)) {
    const v = parseOr();
    return typeof v === 'number' ? v : NaN;
  }
  // With case(): iterative textual rewrite using innermost call resolution.
  let guard = 0;
  while (/\bcase\s*\(/.test(s) && guard++ < 16) {
    s = resolveInnermostCase(s, vars);
  }
  // after rewrites, evaluate plain arithmetic
  const toks2 = s;
  try {
    const v = evalExpr('$=' + toks2, vars); // recurse without case
    return v;
  } catch { return NaN; }
}

function resolveInnermostCase(s, vars) {
  const start = s.search(/\bcase\s*\(/);
  if (start < 0) return s;
  let i = s.indexOf('(', start);
  let depth = 0, j = i;
  for (; j < s.length; j++) {
    if (s[j] === '(') depth++;
    else if (s[j] === ')') { depth--; if (depth === 0) break; }
  }
  const inner = s.slice(i + 1, j);
  // split top-level commas
  const args = [];
  let d = 0, last = 0;
  for (let k = 0; k <= inner.length; k++) {
    if (k === inner.length || (inner[k] === ',' && d === 0)) {
      args.push(inner.slice(last, k).trim()); last = k + 1;
    } else if (inner[k] === '(') d++;
    else if (inner[k] === ')') d--;
  }
  let result = '';
  for (let k = 0; k + 1 < args.length; k += 2) {
    const cond = evalExpr(args[k], vars);
    if (cond !== 0 && cond === cond && cond !== undefined && !Number.isNaN(cond)) { result = args[k + 1]; break; }
  }
  if (result === '' && args.length % 2 === 1) result = args[args.length - 1];
  if (result === '') result = '0';
  return s.slice(0, start) + '(' + result + ')' + s.slice(j + 1);
}

// Resolve a possibly-expression numeric value with variables map of defaults.
export function resolveNumber(v, vars, fallback = NaN) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const r = evalExpr(v, vars);
    return Number.isFinite(r) ? r : fallback;
  }
  return fallback;
}
