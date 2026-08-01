// Phase 1 — BeamNG JBeam front-end parser + vehicle assembly.
// Parses raw .jbeam text (comments, missing commas) and converts node/beam
// topology into a Web physics representation. Also procedurally generates the
// pressure-wheel / soft-tire node rings described by "pressureWheels" tables.
'use strict';

const JBeam = (() => {

  // --- tolerant JSON: strip // and /* */ comments, fix missing/trailing commas ---
  function stripComments(src) {
    let out = '';
    let i = 0, n = src.length;
    let inStr = false, inLine = false, inBlock = false;
    while (i < n) {
      const ch = src[i];
      const nx = i + 1 < n ? src[i + 1] : '';
      if (inLine) {
        if (ch === '\n') { inLine = false; out += '\n'; }
        i++; continue;
      }
      if (inBlock) {
        if (ch === '*' && nx === '/') { inBlock = false; i += 2; continue; }
        i++; continue;
      }
      if (inStr) {
        out += ch;
        if (ch === '\\') { out += nx; i += 2; continue; }
        if (ch === '"') inStr = false;
        i++; continue;
      }
      if (ch === '"') { inStr = true; out += ch; i++; continue; }
      if (ch === '/' && nx === '/') { inLine = true; i += 2; continue; }
      if (ch === '/' && nx === '*') { inBlock = true; i += 2; continue; }
      out += ch; i++;
    }
    return out.replace(/,(\s*[}\]])/g, '$1');
  }

  function fixCommas(src) {
    let out = '';
    let inStr = false, depth = 0, prevSig = '', pendingWs = '';
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        out += ch;
        if (ch === '\\' && i + 1 < src.length) { out += src[i + 1]; i++; continue; }
        if (ch === '"') { inStr = false; prevSig = '"'; }
        continue;
      }
      if (/\s/.test(ch)) { pendingWs += ch; continue; }
      if (ch === ',' && prevSig === ',') { pendingWs = ''; continue; }
      const isOpen = ch === '[' || ch === '{';
      const isClose = ch === ']' || ch === '}';
      const prevNum = /[\d.eE]/.test(prevSig);
      const numDone = prevNum && !/[\d.eE+\-]/.test(ch);
      const valEnd = (prevSig === ']' || prevSig === '}' || prevSig === '"' || numDone) && ch !== ':' && ch !== ',';
      const valStart = /[\[{"\d.\-eE]/.test(ch) && ch !== ',' && ch !== ':' && !isClose;
      if (depth > 0 && valEnd && valStart) out += ',';
      out += pendingWs + ch;
      pendingWs = '';
      if (ch === '"') inStr = true;
      if (isOpen) depth++;
      else if (isClose) depth = Math.max(0, depth - 1);
      prevSig = ch;
    }
    return out + pendingWs;
  }

  function parseJBeamText(text) {
    return JSON.parse(fixCommas(stripComments(text)));
  }

  function num(v, dflt) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s === 'FLT_MAX') return Infinity;
      if (s.startsWith('$')) return dflt;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : dflt;
    }
    return dflt;
  }

  function strArr(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.map(String);
    return [String(v)];
  }

  // Parse one part's tables (nodes / beams / flexbodies / pressureWheels).
  function parsePartTables(part, partName, out, firstPass) {
    if (firstPass && part.flexbodies) {
      for (let r = 1; r < part.flexbodies.length; r++) {
        const row = part.flexbodies[r];
        if (!Array.isArray(row)) continue;
        const opts = row[3] || {};
        out.flexbodies.push({
          mesh: row[0],
          groups: strArr(row[1]),
          pos: opts.pos || null, rot: opts.rot || null, scale: opts.scale || null,
          part: partName
        });
      }
    }
    let meta = {};
    if (firstPass && part.nodes) {
      for (let r = 1; r < part.nodes.length; r++) {
        const row = part.nodes[r];
        if (!Array.isArray(row)) {
          if (row && typeof row === 'object') meta = Object.assign({}, meta, row);
          continue;
        }
        const id = String(row[0]);
        if (id === 'id') continue;
        const extra = (row[4] && typeof row[4] === 'object') ? row[4] : {};
        const m = Object.assign({}, meta, extra);
        out.nodes.push({
          id,
          x: num(row[1], 0), y: num(row[2], 0), z: num(row[3], 0),
          mass: num(m.nodeWeight, 4),
          groups: strArr(m.group),
          friction: num(m.frictionCoef, 0.8),
          collision: m.collision !== false && extra.collision !== false,
          part: partName
        });
      }
    }
    meta = {};
    if (!firstPass && part.beams) {
      for (let r = 1; r < part.beams.length; r++) {
        const row = part.beams[r];
        if (!Array.isArray(row)) {
          if (row && typeof row === 'object') meta = Object.assign({}, meta, row);
          continue;
        }
        const a = String(row[0]);
        if (a === 'id1' || a === 'id1:') continue;
        const b = String(row[1]);
        const extra = (row[2] && typeof row[2] === 'object') ? row[2] : {};
        const m = Object.assign({}, meta, extra);
        out.beams.push({
          a, b,
          k: num(m.beamSpring, 500000),
          c: num(m.beamDamp, 150),
          deform: num(m.beamDeform, 50000),
          strength: num(m.beamStrength, Infinity),
          lb: num(m.beamLongBound, 1.0),
          sb: num(m.beamShortBound, 1.0),
          pre: num(m.beamPrecompression, 1.0),
          optional: !!m.optional,
          name: m.name || '',
          part: partName
        });
      }
    }
    if (firstPass && part.pressureWheels) {
      let settings = {};
      for (let r = 1; r < part.pressureWheels.length; r++) {
        const row = part.pressureWheels[r];
        if (!Array.isArray(row)) {
          if (row && typeof row === 'object') settings = Object.assign({}, settings, row);
          continue;
        }
        const name = String(row[0]);
        if (name === 'name') continue;
        if (row.length >= 4) {
          out.pressureWheels.push({
            wheel: name, hubGroup: String(row[1] || ''), group: String(row[2] || ''),
            n1: String(row[3] || ''), n2: String(row[4] || ''),
            nodeS: row[5], nodeArm: String(row[6] || ''), dir: num(row[7], 1),
            settings: Object.assign({}, settings), part: partName
          });
        }
      }
    }
  }

  // Parse a multi-part jbeam document into a merged topology.
  function parseJBeamDocument(text) {
    const data = parseJBeamText(text);
    const out = { nodes: [], beams: [], flexbodies: [], pressureWheels: [], parts: [] };
    const nodeIdSet = new Set();
    for (const key of Object.keys(data)) {
      const part = data[key];
      if (!part || typeof part !== 'object' || key === 'information') continue;
      parsePartTables(part, key, out, true);
      out.parts.push(key);
    }
    // second pass: beams may reference nodes declared later / in other parts
    for (const key of Object.keys(data)) {
      const part = data[key];
      if (!part || typeof part !== 'object' || key === 'information') continue;
      parsePartTables(part, key, out, false);
    }
    return out;
  }

  // --- runtime vehicle assembly from converted VEHICLE_DATA ---
  function buildFromData(data) {
    const nodes = [];
    const nodeIdx = new Map();
    for (let i = 0; i < data.nodes.length; i++) {
      const n = data.nodes[i];
      nodeIdx.set(n.id, nodes.length);
      nodes.push({
        id: n.id,
        pos: [n.x, n.y, n.z],
        rest: [n.x, n.y, n.z],
        vel: [0, 0, 0],
        mass: n.m,
        invMass: n.m > 0 ? 1 / n.m : 0,
        groups: n.g || [],
        friction: n.f !== undefined ? n.f : 0.8,
        collision: !!n.col,
        rigid: !!n.r
      });
    }
      const beams = [];
      for (let bi = 0; bi < data.beams.length; bi++) {
        const b = data.beams[bi];
        // precompression ignored: the authored multi-beam preloads are not in
        // equilibrium for an explicit solver; beam stiffness still carries the
        // suspension dynamics (net initial force is then exactly zero)
        const pre = 1;
        beams.push({
          a: b[0], b: b[1],
          k: b[2], c: b[3], rest: b[4],
          deform: b[5], strength: b[6], lb: b[7], sb: b[8], pre,
        optional: !!b[10],
        idx: bi
      });
    }
    const groups = new Map();
    for (const [name, ids] of data.groups || []) groups.set(name, ids.map(id => nodeIdx.get(id)));
    return { nodes, nodeIdx, beams, groups, data };
  }

  // Procedural soft tire: rays x cols node ring + beams + hub springs.
  // Wheel coordinate: axle along X, sidewalls offset along X.
  function generateTire(wheel, tire, nodeStore, beamStore, hubSprings, axisFrame) {
    const rays = tire.rays || 24;
    const cols = tire.cols || 3;
    const R = tire.radius;
    const W = tire.width;
    const pre = tire.precompression !== undefined ? tire.precompression : 0.97;
    const start = nodeStore.length;
    const nodes = [];
    for (let c = 0; c < cols; c++) {
      const ax = (c - (cols - 1) / 2) * (W / (cols - 1 || 1));
      for (let r = 0; r < rays; r++) {
        const ang = (r / rays) * Math.PI * 2;
        const nx = Math.cos(ang) * R * pre;
        const nz = Math.sin(ang) * R * pre;
        // local rest position in wheel frame: axis X, radial in YZ plane
        const local = [ax, nx, nz];
        const p = M.quatTransform(axisFrame, local);
        M.v3add(wheel.center, p, p);
        const node = {
          id: wheel.name + '_tire_' + c + '_' + r,
          pos: p, rest: p.slice(),
          vel: [0, 0, 0],
          mass: tire.nodeMass, invMass: 1 / tire.nodeMass,
          groups: ['tire_' + wheel.name], friction: 1.25, collision: true, rigid: false,
          tire: { wheel: wheel.name, col: c, ray: r, local: local, contact: 0 }
        };
        nodes.push(node);
        nodeStore.push(node);
        hubSprings.push({
          node: node,
          wheel: wheel.name,
          local: local,
          k: tire.hubSpring || 24000,
          c: tire.hubDamp || 90,
          restLen: Math.hypot(local[1], local[2]) // radial rest length
        });
      }
    }
    const idx = (c, r) => start + c * rays + r;
    // periphery beams (same column, adjacent rays)
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rays; r++) {
        const n1 = idx(c, r), n2 = idx(c, (r + 1) % rays);
        beamStore.push({ a: n1, b: n2, k: tire.peripherySpring, c: tire.peripheryDamp, rest: chord(R * pre, R * pre), tire: true });
      }
    }
    // sidewall beams (same ray, adjacent columns)
    for (let c = 0; c + 1 < cols; c++) {
      for (let r = 0; r < rays; r++) {
        beamStore.push({ a: idx(c, r), b: idx(c + 1, r), k: tire.sideSpring, c: tire.sideDamp, rest: W / (cols - 1), tire: true });
      }
    }
    // tread reinforcements (center column cross-bracing) and periphery reinforcements
    if (cols >= 3) {
      for (let r = 0; r < rays; r++) {
        const c0 = idx(1, r), c1 = idx(1, (r + 1) % rays), c2 = idx(1, (r + 2) % rays);
        beamStore.push({ a: c0, b: c2, k: tire.treadReinfSpring, c: tire.treadReinfDamp, rest: chord(R * pre, R * pre) * 2, tire: true });
        if (cols === 3) {
          beamStore.push({ a: idx(0, r), b: idx(2, r), k: tire.sideReinfSpring, c: tire.sideReinfDamp, rest: W, tire: true });
        }
      }
    }
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rays; r++) {
        const n1 = idx(c, r), n2 = idx(c, (r + 2) % rays);
        beamStore.push({ a: n1, b: n2, k: tire.peripheryReinfSpring, c: tire.peripheryReinfDamp, rest: chord(R * pre, R * pre) * 2, tire: true });
      }
    }
    return { start, count: nodes.length };
  }

  function chord(a, b) {
    return Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(Math.PI * 2 / 24));
  }

  return {
    stripComments, fixCommas, parseJBeamText, parseJBeamDocument,
    parsePartTables, buildFromData, generateTire, num, strArr
  };
})();

if (typeof globalThis !== 'undefined') globalThis.JBeam = JBeam;
if (typeof module !== 'undefined' && module.exports) module.exports = JBeam;
