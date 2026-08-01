/**
 * schema.js — JBeam table-section expansion.
 *
 * A JBeam section like "nodes" is a table:
 *   [ ["id","posX","posY","posZ"],            <- header row
 *     {"nodeWeight":5.5},                     <- sticky modifier (applies onward)
 *     ["f1rr",-0.741,-0.719,0.17],            <- data row
 *     ["f2r",-0.444,-0.36,0.17,{"group":"x"}] <- data row + inline override
 *   ]
 *
 * expandTable() returns [{...header->value, ...stickyMods, ...inlineMods, __row}]
 * Header names ending in ":" denote node references; the colon is stripped.
 * Pure module — no DOM, shared with Node tests.
 */

function cleanKey(k) {
  // "id1:" -> "id1", "[group]:" -> "group", "torqueArm:" -> "torqueArm"
  let key = String(k);
  if (key.endsWith(':')) key = key.slice(0, -1);
  if (key.startsWith('[') && key.endsWith(']')) key = key.slice(1, -1);
  return key;
}

export function expandTable(section, carry = null) {
  if (!Array.isArray(section)) return { rows: [], sticky: carry?.sticky || {}, header: carry?.header || null };
  let header = carry?.header || null;
  let sticky = carry?.sticky ? { ...carry.sticky } : {};
  const rows = [];
  const looksLikeHeader = (entry) =>
    entry.length > 0 && entry.every(v => typeof v === 'string') &&
    (header === null || cleanKey(entry[0]) === header[0]);
  for (const entry of section) {
    if (Array.isArray(entry)) {
      if (looksLikeHeader(entry)) {
        // first array row of a section is its header; when a later part's
        // section stream is threaded through (carry), repeated headers are
        // recognised and skipped, exactly like the game's section merger.
        header = entry.map(cleanKey);
        continue;
      }
      if (header === null) { header = entry.map(cleanKey); continue; }
      const row = { ...sticky };
      const ncol = Math.min(header.length, entry.length);
      for (let c = 0; c < ncol; c++) {
        const v = entry[c];
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          // inline modifier landed inside header span (short row) — merge it
          for (const k of Object.keys(v)) row[cleanKey(k)] = v[k];
        } else {
          row[header[c]] = v;
        }
      }
      // trailing entries beyond the header are inline modifier objects
      for (let c = header.length; c < entry.length; c++) {
        const v = entry[c];
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          for (const k of Object.keys(v)) row[cleanKey(k)] = v[k];
        }
      }
      rows.push(row);
    } else if (entry !== null && typeof entry === 'object') {
      // sticky modifier row: {} resets nothing; {"group":""} clears group, etc.
      sticky = { ...sticky };
      for (const k of Object.keys(entry)) sticky[cleanKey(k)] = entry[k];
    }
    // scalars in table position are ignored (rare stray values)
  }
  return { rows, sticky, header };
}

/** Convenience: expand and return only the data rows. */
export function tableRows(section) {
  return expandTable(section).rows;
}

/**
 * Resolve "$variable" and "$=expression" values against a variable map.
 * Supports the arithmetic subset BeamNG uses in practice:  + - * / ( ) numbers
 * and $identifiers, e.g. "$=-$gear_R" or "$=$spring_F*0.5".
 */
export function resolveVars(value, vars) {
  if (typeof value !== 'string') return value;
  if (value.startsWith('$=')) {
    let expr = value.slice(2);
    expr = reduceCases(expr, vars);
    expr = expr.replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, (m) => {
      const v = vars.get(m.slice(1));
      return (v === undefined || v === null) ? '0' : String(v);
    });
    if (!/^[-+*/(). 0-9eE]*$/.test(expr)) return 0;
    try {
      return evalArithmetic(expr);
    } catch { return 0; }
  }
  if (value.startsWith('$')) {
    const v = vars.get(value.slice(1));
    return v === undefined ? value : v;
  }
  return value;
}

/**
 * Reduce BeamNG case(cond, a, b) constructs to their chosen branch.
 * Handles "== nil"/"!= nil" existence checks and numeric comparisons.
 */
function reduceCases(expr, vars) {
  for (let guard = 0; guard < 8; guard++) {
    const idx = expr.indexOf('case(');
    if (idx < 0) return expr;
    // find matching close paren
    let depth = 0, end = -1;
    const args = [];
    let argStart = idx + 5;
    for (let i = idx + 5; i < expr.length; i++) {
      const ch = expr[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        if (depth === 0) { args.push(expr.slice(argStart, i)); end = i; break; }
        depth--;
      } else if (ch === ',' && depth === 0) {
        args.push(expr.slice(argStart, i));
        argStart = i + 1;
      }
    }
    if (end < 0 || args.length < 3) return expr.replace(/case\(/g, '(0*(').concat('');
    const cond = evalCondition(args[0].trim(), vars);
    const branch = (cond ? args[1] : args[2]).trim();
    expr = expr.slice(0, idx) + '(' + branch + ')' + expr.slice(end + 1);
  }
  return expr;
}

function evalCondition(cond, vars) {
  const sub = (s) => {
    s = s.trim();
    if (s === 'nil') return undefined;
    if (s.startsWith('$')) return vars.get(s.slice(1));
    const n = Number(s);
    return Number.isNaN(n) ? s : n;
  };
  const ops = ['==', '!=', '<=', '>=', '<', '>'];
  for (const op of ops) {
    const at = cond.indexOf(op);
    if (at >= 0) {
      const a = sub(cond.slice(0, at));
      const b = sub(cond.slice(at + op.length));
      switch (op) {
        case '==': return a === b || (a === undefined && b === undefined);
        case '!=': return a !== b;
        case '<': return Number(a) < Number(b);
        case '>': return Number(a) > Number(b);
        case '<=': return Number(a) <= Number(b);
        case '>=': return Number(a) >= Number(b);
      }
    }
  }
  const v = sub(cond);
  return v !== undefined && v !== 0 && v !== false;
}

/** Tiny shunting-yard-free arithmetic evaluator (recursive descent, safe). */
export function evalArithmetic(expr) {
  let p = 0;
  const s = expr;
  function ws() { while (p < s.length && s[p] === ' ') p++; }
  function primary() {
    ws();
    if (s[p] === '(') { p++; const v = addsub(); ws(); if (s[p] === ')') p++; return v; }
    if (s[p] === '-') { p++; return -primary(); }
    if (s[p] === '+') { p++; return primary(); }
    const m = /^[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/.exec(s.slice(p));
    if (!m) throw new Error('bad expr at ' + p);
    p += m[0].length;
    return Number(m[0]);
  }
  function muldiv() {
    let v = primary();
    for (;;) {
      ws();
      if (s[p] === '*') { p++; v *= primary(); }
      else if (s[p] === '/') { p++; v /= primary(); }
      else return v;
    }
  }
  function addsub() {
    let v = muldiv();
    for (;;) {
      ws();
      if (s[p] === '+') { p++; v += muldiv(); }
      else if (s[p] === '-') { p++; v -= muldiv(); }
      else return v;
    }
  }
  const out = addsub();
  return Number.isFinite(out) ? out : 0;
}

/**
 * Collect a part's "variables" section into a Map(name -> default value).
 * Rows: ["name","type","unit","category", default, min, max, "title", ...]
 */
export function collectVariables(part, into = new Map()) {
  const section = part.variables;
  if (!Array.isArray(section)) return into;
  for (const row of tableRows(section)) {
    const name = row.name;
    if (typeof name !== 'string') continue;
    const key = name.startsWith('$') ? name.slice(1) : name;
    let def = row.default;
    if (def === undefined) def = row.defaultValue;
    if (typeof def === 'string') def = resolveVars(def, into);
    into.set(key, def);
  }
  return into;
}

export default { expandTable, tableRows, resolveVars, collectVariables, evalArithmetic };
