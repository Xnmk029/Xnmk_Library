/**
 * utils/jbeam.js — tolerant BeamNG .jbeam parser
 * handles: // and /* *​/ comments, trailing commas, missing commas between elements
 */
export function parseJbeam(text) {
  const p = new TolerantParser(text);
  const v = p.parseValue();
  if (!v || typeof v !== 'object') throw new Error('invalid jbeam');
  return v;
}

class TolerantParser {
  constructor(src) {
    this.src = src;
    this.i = 0;
    this.n = src.length;
  }

  skipWs() {
    const s = this.src;
    while (this.i < this.n) {
      const c = s[this.i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v' || c === '\u00a0') { this.i++; continue; }
      if (c === '/' && s[this.i + 1] === '/') {
        while (this.i < this.n && s[this.i] !== '\n') this.i++;
        continue;
      }
      if (c === '/' && s[this.i + 1] === '*') {
        this.i += 2;
        while (this.i + 1 < this.n && !(s[this.i] === '*' && s[this.i + 1] === '/')) this.i++;
        this.i += 2;
        continue;
      }
      break;
    }
  }

  peek() {
    this.skipWs();
    return this.i < this.n ? this.src[this.i] : '';
  }

  /** parse a JSON value; lenient about structure */
  parseValue() {
    this.skipWs();
    if (this.i >= this.n) return undefined;
    const c = this.src[this.i];
    if (c === '{') return this.parseObject();
    if (c === '[') return this.parseArray();
    if (c === '"') return this.parseString();
    if (c === '-' || (c >= '0' && c <= '9')) return this.parseNumber();
    // literals / bare words (tolerate)
    const word = this.parseWord();
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null' || word === 'nil') return null;
    if (word === 'undefined') return undefined;
    return word; // bare token fallback (BeamNG '$=expr' style keys sometimes unquoted)
  }

  parseWord() {
    const s = this.src;
    let out = '';
    while (this.i < this.n) {
      const c = s[this.i];
      if (/[A-Za-z0-9_$=:+\-./@]/.test(c)) { out += c; this.i++; }
      else break;
    }
    return out;
  }

  parseString() {
    const s = this.src;
    this.i++; // skip "
    let out = '';
    while (this.i < this.n) {
      const c = s[this.i];
      if (c === '\\') {
        const e = s[this.i + 1];
        switch (e) {
          case 'n': out += '\n'; break;
          case 't': out += '\t'; break;
          case 'r': out += '\r'; break;
          case '"': out += '"'; break;
          case '\\': out += '\\'; break;
          case '/': out += '/'; break;
          case 'u': {
            const hex = s.slice(this.i + 2, this.i + 6);
            out += String.fromCharCode(parseInt(hex, 16) || 0);
            this.i += 4;
            break;
          }
          default: out += e || '';
        }
        this.i += 2;
        continue;
      }
      if (c === '"') { this.i++; return out; }
      out += c;
      this.i++;
    }
    return out;
  }

  parseNumber() {
    const s = this.src;
    const start = this.i;
    while (this.i < this.n && /[0-9eE+\-.]/.test(s[this.i])) this.i++;
    const raw = s.slice(start, this.i);
    const v = Number(raw);
    return Number.isFinite(v) ? v : 0;
  }

  parseArray() {
    const out = [];
    this.i++; // [
    for (;;) {
      const c = this.peek();
      if (c === ']') { this.i++; return out; }
      if (c === '') return out;
      const v = this.parseValue();
      if (v !== undefined) out.push(v);
      const n = this.peek();
      if (n === ',') { this.i++; continue; }
      if (n === ']') { this.i++; return out; }
      if (n === '') return out;
      // missing comma — auto continue
    }
  }

  parseObject() {
    const out = {};
    this.i++; // {
    for (;;) {
      const c = this.peek();
      if (c === '}') { this.i++; return out; }
      if (c === '') return out;
      let key;
      if (c === '"') key = this.parseString();
      else key = String(this.parseValue());
      const n = this.peek();
      if (n === ':') this.i++;
      else if (n === ',' || n === '}') { /* key with no value — skip */ }
      let val;
      const v0 = this.peek();
      if (v0 === ',' || v0 === '}') { val = null; }
      else val = this.parseValue();
      if (key !== undefined && key !== '') out[key] = val;
      const nn = this.peek();
      if (nn === ',') { this.i++; continue; }
      if (nn === '}') { this.i++; return out; }
      if (nn === '') return out;
      // missing comma — auto continue
    }
  }
}

/** Iterate "nodes" table of a part; returns [{id,x,y,z,mass,groups,opts}] */
export function parseNodes(part) {
  const rows = part.nodes;
  const out = [];
  if (!Array.isArray(rows)) return out;
  let weight = 4;
  let groups = [];
  let opts = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (typeof r === 'string' || (Array.isArray(r) && typeof r[0] === 'string' && r[0] === 'id')) continue;
    if (Array.isArray(r)) {
      const [id, x, y, z, nodeOpts] = r;
      out.push({ id, x, y, z, weight, groups: groups.slice(), opts: nodeOpts || {}, parentOpts: opts });
    } else if (typeof r === 'object' && r !== null) {
      if (r.nodeWeight !== undefined) weight = r.nodeWeight;
      if (r.group !== undefined) groups = Array.isArray(r.group) ? r.group.slice() : (r.group === '' ? [] : [r.group]);
      opts = r;
    }
  }
  return out;
}

/** Iterate "beams" table; returns [{a,b,spring,damp,deform,strength,opts}] */
export function parseBeams(part) {
  const rows = part.beams;
  const out = [];
  if (!Array.isArray(rows)) return out;
  let cur = {};
  for (const r of rows) {
    if (typeof r === 'string' || (Array.isArray(r) && typeof r[0] === 'string' && r[0] === 'id1:')) continue;
    if (Array.isArray(r)) {
      const [a, b, opts] = r;
      out.push({ a, b, ...cur, opts: opts || {} });
    } else if (typeof r === 'object' && r !== null) {
      cur = { ...cur, ...r };
    }
  }
  return out;
}

/** flexbodies: [[mesh, [groups], ...], ...] */
export function parseFlexbodies(part) {
  const rows = part.flexbodies;
  const out = [];
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (!Array.isArray(r) || typeof r[0] !== 'string' || r[0] === 'mesh') continue;
    if (typeof r[1] === 'string') continue;
    out.push({ mesh: r[0], groups: Array.isArray(r[1]) ? r[1] : [], transform: r[3] });
  }
  return out;
}

/** pressureWheels table (merged option objects) */
export function parsePressureWheels(part) {
  const rows = part.pressureWheels;
  const out = { hasTire: false, radius: 0.35, tireWidth: 0.22, frictionCoef: 1.0, brakeTorque: 0 };
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    Object.assign(out, r);
  }
  return out;
}

/** engine mainEngine block + gearbox + differential */
export function parseEngine(part) {
  const me = part.mainEngine;
  if (!me) return null;
  return {
    torque: (me.torque || []).filter(r => Array.isArray(r) && typeof r[0] === 'number'),
    idleRPM: me.idleRPM ?? 900,
    maxRPM: me.maxRPM ?? 8000,
    revLimiterType: me.revLimiterType || 'soft',
    inertia: me.inertia ?? 0.1,
    friction: me.friction ?? 10,
    engineBrakeTorque: me.engineBrakeTorque ?? 30,
  };
}

export function parseGearbox(part) {
  const gb = part.gearbox;
  if (!gb || !Array.isArray(gb.gearRatios)) return null;
  return { ratios: gb.gearRatios, friction: gb.friction ?? 1, torqueLossCoef: gb.torqueLossCoef ?? 0.01 };
}

export function parseDifferential(part) {
  const keys = Object.keys(part).filter(k => /differential/i.test(k));
  for (const k of keys) {
    const d = part[k];
    if (d && typeof d === 'object') {
      const gr = Number(d.gearRatio) || Number(d.finalDrive) || 0;
      if (gr) return { gearRatio: gr, diffType: d.diffType || 'open', lsdPreload: d.lsdPreload || 0, lsdLockCoef: d.lsdLockCoef || 0 };
    }
  }
  return null;
}

export function parseShocks(part) {
  const rows = part.shocks;
  const out = [];
  if (!Array.isArray(rows)) return out;
  let cur = {};
  for (const r of rows) {
    if (typeof r === 'string' || (Array.isArray(r) && typeof r[0] === 'string')) continue;
    if (Array.isArray(r)) out.push({ a: r[0], b: r[1], ...cur, opts: r[2] || {} });
    else if (r && typeof r === 'object') cur = { ...cur, ...r };
  }
  return out;
}

/** normalize a file path (resolve ../, use forward slashes) */
export function normPath(p) {
  const parts = p.replace(/\\/g, '/').split('/');
  const stack = [];
  for (const s of parts) {
    if (s === '.' || s === '') continue;
    if (s === '..') { stack.pop(); continue; }
    stack.push(s);
  }
  return stack.join('/');
}
