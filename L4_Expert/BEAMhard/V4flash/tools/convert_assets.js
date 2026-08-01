// Offline asset converter: BeamNG mod (jbeam/dae/dds) -> compact JS data for the WebGL app.
'use strict';
const fs = require('fs');
const path = require('path');
const { ddsToPNG } = require('./dds_png.js');

const ROOT = path.resolve(__dirname, '..');
const VEH_ROOT = path.join(ROOT, 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles');
const CCF_DIR = path.join(VEH_ROOT, 'ccf');
const OUT_DIR = path.join(ROOT, 'webgl_app', 'data');

// ---------------------------------------------------------------------------
// Tolerant JSON (strips // and /* */ comments and trailing commas)
// ---------------------------------------------------------------------------
function cleanJSON(src) {
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

// BeamNG jbeam files frequently omit commas between array elements/properties.
// Insert commas at bracket depth>0 between adjacent value tokens.
function repairCommas(src) {
  let out = '';
  let inStr = false;
  let depth = 0;
  let prevSig = '';
  let pendingWs = '';
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
    const prevIsNum = /[\d.eE]/.test(prevSig);
    const prevNumDone = prevIsNum && !/[\d.eE+\-]/.test(ch);
    const valEnd = (prevSig === ']' || prevSig === '}' || prevSig === '"' || prevNumDone) && ch !== ':' && ch !== ',';
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

function parseJbeamFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const cleaned = repairCommas(cleanJSON(raw));
  return JSON.parse(cleaned);
}

function num(v, dflt) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === 'FLT_MAX') return Infinity;
    if (s.startsWith('$')) return dflt; // unresolved variable -> default
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

// ---------------------------------------------------------------------------
// JBeam part processing
// ---------------------------------------------------------------------------
class JBeamLoader {
  constructor() {
    this.nodes = [];       // {id, x,y,z, mass, groups:[], friction, collision, part}
    this.nodeIdx = new Map();
    this.beams = [];       // {a,b,k,c,rest,deform,strength,lb,sb,pre,optional,part}
    this._pendingBeams = [];
    this.flexbodies = [];  // {mesh, groups:[], nonFlex:[], pos, rot, scale, part}
    this.pressureWheels = []; // {wheel, hubGroup, group, n1, n2, nodeArm, dir, settings, part}
    this.warnings = [];
  }

  loadPart(relPath, partName) {
    const file = path.join(CCF_DIR, relPath);
    if (!fs.existsSync(file)) { this.warnings.push('missing part: ' + relPath); return; }
    const data = parseJbeamFile(file);
    this.loadPartFromData(data, partName, relPath);
  }

  loadPartFromData(data, partName, relPath) {
    const part = data[partName];
    if (!part) { this.warnings.push('part key missing: ' + partName + ' in ' + relPath); return; }
    this.parseFlexbodies(part.flexbodies, partName);
    this.parseNodes(part.nodes, partName);
    this._pendingBeams.push({ rows: part.beams, partName });
    if (part.pressureWheels) this.parsePressureWheels(part.pressureWheels, partName);
    return part;
  }

  finalize() {
    for (const { rows, partName } of this._pendingBeams) {
      this.parseBeams(rows, partName);
    }
    this._pendingBeams = [];
  }

  parseFlexbodies(rows, part) {
    if (!rows) return;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const mesh = row[0];
      const groups = strArr(row[1]);
      const nonFlex = Array.isArray(row[2]) ? row[2] : [];
      const opts = row[3] || {};
      this.flexbodies.push({
        mesh, groups, nonFlex,
        pos: opts.pos || null, rot: opts.rot || null, scale: opts.scale || null,
        part
      });
    }
  }

  parseNodes(rows, part) {
    if (!rows) return;
    let meta = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) {
        if (row && typeof row === 'object') meta = Object.assign({}, meta, row);
        continue;
      }
      const id = String(row[0]);
      if (id === 'id') continue; // header
      const x = num(row[1], 0), y = num(row[2], 0), z = num(row[3], 0);
      const extra = (row[4] && typeof row[4] === 'object') ? row[4] : {};
      const m = Object.assign({}, meta, extra);
      const groups = strArr(m.group);
      const mass = num(m.nodeWeight, 4);
      const friction = num(m.frictionCoef, 0.8);
      const collision = m.collision !== false && extra.collision !== false;
      if (this.nodeIdx.has(id)) {
        const ex = this.nodes[this.nodeIdx.get(id)];
        // keep first definition; merge groups
        for (const g of groups) if (!ex.groups.includes(g)) ex.groups.push(g);
        continue;
      }
      this.nodeIdx.set(id, this.nodes.length);
      this.nodes.push({ id, x, y, z, mass, groups, friction, collision, part });
    }
  }

  parseBeams(rows, part) {
    if (!rows) return;
    let meta = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) {
        if (row && typeof row === 'object') meta = Object.assign({}, meta, row);
        continue;
      }
      const a = String(row[0]);
      if (a === 'id1' || a === 'id1:') continue;
      const b = String(row[1]);
      const extra = (row[2] && typeof row[2] === 'object') ? row[2] : {};
      const m = Object.assign({}, meta, extra);
      if (!this.nodeIdx.has(a) || !this.nodeIdx.has(b)) continue;
      const ia = this.nodeIdx.get(a), ib = this.nodeIdx.get(b);
      const k = num(m.beamSpring, 500000);
      const c = num(m.beamDamp, 150);
      const def = num(m.beamDeform, 50000);
      const str = num(m.beamStrength, Infinity);
      const hasBounds = m.beamLongBound !== undefined || m.beamShortBound !== undefined;
      let lbFinal = null, sbFinal = null;
      if (hasBounds) {
        const lb = num(m.beamLongBound, 1.0);
        const sb = num(m.beamShortBound, 1.0);
        // BeamNG bound ranges add to / subtract from the base bounds
        lbFinal = lb + num(m.longBoundRange, 0);
        sbFinal = sb - num(m.shortBoundRange, 0);
      }
      const pre = num(m.beamPrecompression, 1.0);
      this.beams.push({
        a: ia, b: ib, k, c, rest: 0, deform: def, strength: str,
        lb: lbFinal, sb: sbFinal, pre, optional: !!m.optional, name: m.name || '', part
      });
    }
  }

  parsePressureWheels(rows, part) {
    let settings = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) {
        if (row && typeof row === 'object') settings = Object.assign({}, settings, row);
        continue;
      }
      const name = String(row[0]);
      if (name === 'name') continue;
      if (row.length >= 4) {
        this.pressureWheels.push({
          wheel: name, hubGroup: String(row[1] || ''), group: String(row[2] || ''),
          n1: String(row[3] || ''), n2: String(row[4] || ''),
          nodeS: row[5], nodeArm: String(row[6] || ''), dir: num(row[7], 1),
          settings: Object.assign({}, settings), part
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Wheel part placement (BeamNG mirrors wheel parts laterally)
// ---------------------------------------------------------------------------
function wheelWorldPos(wheelPartNode, side, slot) {
  // slot: {baseX, baseY, baseZ}
  const sign = side === 'l' ? 1 : -1;
  return {
    x: sign * slot.baseX + wheelPartNode.x,
    y: slot.baseY + wheelPartNode.y,
    z: slot.baseZ + wheelPartNode.z
  };
}

// ---------------------------------------------------------------------------
// DAE parsing
// ---------------------------------------------------------------------------
function segs(src, startTag, endTag) {
  const out = [];
  let i = 0;
  while (true) {
    const s = src.indexOf(startTag, i);
    if (s < 0) break;
    const e = src.indexOf(endTag, s);
    if (e < 0) break;
    out.push(src.slice(s, e + endTag.length));
    i = e + endTag.length;
  }
  return out;
}

function attrVal(tag, name) {
  const m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : '';
}

function parseFloatArray(xml) {
  const m = xml.match(/<float_array[^>]*>([\s\S]*?)<\/float_array>/);
  if (!m) return null;
  const nums = m[1].trim().split(/\s+/).filter(Boolean).map(Number);
  return new Float32Array(nums);
}

function parseDAE(file) {
  const src = fs.readFileSync(file, 'utf8');
  const result = { geoms: new Map(), scenes: [], mats: new Map(), effects: new Map(), images: new Map(), upAxis: 'Z_UP' };
  const um = src.match(/<up_axis>([^<]+)<\/up_axis>/);
  if (um) result.upAxis = um[1];

  // images
  for (const sg of segs(src, '<image ', '</image>')) {
    const id = attrVal(sg, 'id');
    const m = sg.match(/<init_from>([\s\S]*?)<\/init_from>/);
    if (id && m) result.images.set(id, m[1].trim());
  }

  // materials
  for (const sg of segs(src, '<material ', '</material>')) {
    const id = attrVal(sg, 'id');
    const m = sg.match(/<instance_effect url="#([^"]+)"/);
    if (id && m) result.mats.set(id, m[1]);
  }

  // effects
  for (const sg of segs(src, '<effect ', '</effect>')) {
    const id = attrVal(sg, 'id');
    if (!id) continue;
    const tech = sg.match(/<(lambert|phong|blinn|constant)[\s\S]*?<\/\1>/);
    const t = tech ? tech[0] : '';
    const mat = { diffuse: null, emissive: null, transparent: null, shininess: 0, technique: tech ? tech[1] : 'lambert' };
    if (tech) {
      const dm = t.match(/<diffuse>\s*<color[^>]*>([\d.\-eE\s]+)<\/color>/);
      if (dm) mat.diffuse = { color: dm[1].trim().split(/\s+/).map(Number) };
      const dt = t.match(/<diffuse>\s*<texture texture="([^"]+)"/);
      if (dt) mat.diffuse = { tex: dt[1] };
      const em = t.match(/<emission>\s*<color[^>]*>([\d.\-eE\s]+)<\/color>/);
      if (em) mat.emissive = { color: em[1].trim().split(/\s+/).map(Number) };
      const et = t.match(/<emission>\s*<texture texture="([^"]+)"/);
      if (et) mat.emissive = { tex: et[1] };
      const sm = t.match(/<shininess>\s*<float[^>]*>([\d.\-eE]+)<\/float>/);
      if (sm) mat.shininess = parseFloat(sm[1]);
      const tr = t.match(/<transparency>\s*<float[^>]*>([\d.\-eE]+)<\/float>/);
      if (tr) mat.transparent = parseFloat(tr[1]);
    }
    // samplers/surfaces
    const newparams = segs(sg, '<newparam ', '</newparam>');
    const samplerToImage = new Map();
    mat.sampler = {};
    for (const np of newparams) {
      const sid = attrVal(np, 'sid');
      const surf = np.match(/<surface[^>]*>[\s\S]*?<init_from>([^<]+)<\/init_from>/);
      if (surf) samplerToImage.set(sid, surf[1]);
      const smp = np.match(/<sampler2D>[\s\S]*?<source>([^<]+)<\/source>/);
      if (smp) {
        const img = samplerToImage.get(smp[1]);
        if (img) mat.sampler[sid] = img;
      }
    }
    result.effects.set(id, mat);
  }

  // geometries
  let gi = 0;
  while (true) {
    const s = src.indexOf('<geometry id="', gi);
    if (s < 0) break;
    const e = src.indexOf('</geometry>', s);
    if (e < 0) break;
    const g = src.slice(s, e + 11);
    const id = attrVal(g, 'id');
    gi = e + 11;
    const ge = { pos: null, nrm: null, uv: null, subs: [] };
    const sources = new Map();
    let si = 0;
    while (true) {
      const ss = g.indexOf('<source id="', si);
      if (ss < 0) break;
      const se = g.indexOf('</source>', ss);
      if (se < 0) break;
      const sseg = g.slice(ss, se + 9);
      const sid = attrVal(sseg, 'id');
      const fa = parseFloatArray(sseg);
      if (fa) sources.set(sid, fa);
      si = se + 9;
    }
    // <vertices> indirection: VERTEX semantic -> POSITION source
    const vertexPos = new Map();
    for (const vs of segs(g, '<vertices ', '</vertices>')) {
      const vid = attrVal(vs, 'id');
      const vm = vs.match(/<input semantic="POSITION" source="#([^"]+)"/);
      if (vid && vm) vertexPos.set(vid, vm[1]);
    }
    const inputs = (scope) => {
      const map = {};
      const re = /<input semantic="([A-Z_]+)" source="#([^"]+)"/g;
      let m;
      while ((m = re.exec(scope))) map[m[1]] = m[2];
      if (map.VERTEX && !map.POSITION && vertexPos.has(map.VERTEX)) map.POSITION = vertexPos.get(map.VERTEX);
      return map;
    };
    for (const poly of segs(g, '<polylist ', '</polylist>')) {
      const mat = attrVal(poly, 'material');
      const inp = inputs(poly);
      const vc = poly.match(/<vcount>\s*([\s\S]*?)<\/vcount>/);
      const p = poly.match(/<p>\s*([\s\S]*?)<\/p>/);
      if (!vc || !p) continue;
      const vcounts = vc[1].trim().split(/\s+/).filter(Boolean).map(Number);
      const idx = p[1].trim().split(/\s+/).filter(Boolean).map(Number);
      const nIn = inp.POSITION ? Object.keys(inp).length : 0;
      if (!nIn) continue;
      const posSrc = sources.get(inp.POSITION);
      if (!posSrc) continue;
      const tris = [];
      let c = 0;
      for (const vn of vcounts) {
        for (let t = 1; t + 1 < vn; t++) {
          for (const k of [0, t, t + 1]) {
            tris.push(idx[c + k * nIn]);
          }
        }
        c += vn * nIn;
      }
      ge.pos = ge.pos || posSrc;
      if (inp.NORMAL) ge.nrm = ge.nrm || sources.get(inp.NORMAL);
      if (inp.TEXCOORD) ge.uv = ge.uv || sources.get(inp.TEXCOORD);
      ge.subs.push({ mat, tris: new Uint32Array(tris) });
    }
    for (const tri of segs(g, '<triangles ', '</triangles>')) {
      const mat = attrVal(tri, 'material');
      const inp = inputs(tri);
      const p = tri.match(/<p>\s*([\s\S]*?)<\/p>/);
      if (!p) continue;
      const idx = p[1].trim().split(/\s+/).filter(Boolean).map(Number);
      const nIn = inp.POSITION ? Object.keys(inp).length : 0;
      if (!nIn) continue;
      const posSrc = sources.get(inp.POSITION);
      if (!posSrc) continue;
      ge.pos = ge.pos || posSrc;
      if (inp.NORMAL) ge.nrm = ge.nrm || sources.get(inp.NORMAL);
      if (inp.TEXCOORD) ge.uv = ge.uv || sources.get(inp.TEXCOORD);
      ge.subs.push({ mat, tris: new Uint32Array(idx.filter((_, i) => i % nIn === 0)) });
    }
    if (ge.pos) result.geoms.set(id, ge);
  }

  // visual scene
  const vsi = src.indexOf('<visual_scene');
  if (vsi >= 0) {
    const vs = src.slice(vsi, src.indexOf('</visual_scene>', vsi));
    let ni = 0;
    while (true) {
      const ns = vs.indexOf('<node ', ni);
      if (ns < 0) break;
      const ne = vs.indexOf('</node>', ns);
      if (ne < 0) break;
      const node = vs.slice(ns, ne + 7);
      ni = ne + 7;
      if (node.indexOf('<instance_geometry') < 0) continue;
      const name = attrVal(node, 'name') || attrVal(node, 'id');
      const geoUrl = (node.match(/<instance_geometry url="#([^"]+)"/) || [])[1];
      if (!geoUrl) continue;
      const mm = node.match(/<matrix sid="transform">([\d.\-eE\s]+)<\/matrix>/);
      const matrix = mm ? mm[1].trim().split(/\s+/).filter(Boolean).map(Number) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const mats = [];
      const mi = node.indexOf('<bind_material>');
      if (mi >= 0) {
        const bind = node.slice(mi, node.indexOf('</bind_material>', mi) + 16);
        for (const im of segs(bind, '<instance_material ', '/>')) {
          const symbol = attrVal(im, 'symbol');
          const target = attrVal(im, 'target').replace(/^#/, '');
          mats.push({ symbol, target });
        }
      }
      result.scenes.push({ name, geoUrl, matrix, mats });
    }
  }
  return result;
}

function bboxOf(ge) {
  const p = ge.pos;
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (p[i + a] < b[a]) b[a] = p[i + a];
      if (p[i + a] > b[a + 3]) b[a + 3] = p[i + a];
    }
  }
  return b;
}

// ---------------------------------------------------------------------------
// Texture index
// ---------------------------------------------------------------------------
function buildTextureIndex() {
  const idx = new Map();
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.dds$/i.test(ent.name)) {
        const stem = path.basename(ent.name, '.dds').replace(/\.(color|normal|data|ao|m|c|g|o|r|n|b|e|f|d|i|cc|pbr|intense)$/i, '');
        if (!idx.has(stem)) idx.set(stem, p);
      }
    }
  };
  walk(VEH_ROOT);
  return idx;
}

function resolveTexture(name, texIndex) {
  if (!name) return null;
  let base = name.replace(/\\/g, '/').split('/').pop();
  const candidates = [base];
  let cur = base.replace(/\.(dds|png|jpg|jpeg|tga)$/i, '');
  candidates.push(cur);
  for (let guard = 0; guard < 8; guard++) {
    const m = cur.match(/^(.*)[._]([a-z0-9]+)$/i);
    if (!m) break;
    cur = m[1];
    candidates.push(cur);
  }
  for (const cand of candidates) {
    if (texIndex.has(cand)) return texIndex.get(cand);
  }
  // fuzzy: startsWith
  for (const [k, p] of texIndex) {
    for (const cand of candidates) {
      if (cand.startsWith(k) || k.startsWith(cand)) return p;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('VEH_ROOT:', VEH_ROOT);
  const loader = new JBeamLoader();

  // Load parts (body + suspension + drivetrain + wheels + tires)
  const susF = parseJbeamFile(path.join(CCF_DIR, 'jbeams/ccf_suspension_F.jbeam'));
  const susR = parseJbeamFile(path.join(CCF_DIR, 'jbeams/ccf_suspension_R.jbeam'));
  loader.loadPart('jbeams/ccf_body.jbeam', 'ccf_body');
  loader.loadPartFromData(susF, 'ccf_suspension_F', 'ccf_suspension_F.jbeam');
  loader.loadPartFromData(susR, 'ccf_suspension_R', 'ccf_suspension_R.jbeam');
  loader.loadPartFromData(susF, 'ccf_coilover_F', 'ccf_suspension_F.jbeam');
  loader.loadPartFromData(susR, 'ccf_coilover_R', 'ccf_suspension_R.jbeam');
  loader.loadPartFromData(susF, 'ccf_wheeldata_F', 'ccf_suspension_F.jbeam');
  loader.loadPartFromData(susF, 'ccf_hub_5l_F', 'ccf_suspension_F.jbeam');
  loader.loadPartFromData(susR, 'ccf_hub_5l_R', 'ccf_suspension_R.jbeam');
  // Exterior panels / lights / drivetrain visuals (rigid chassis parts)
  for (const [rel, key] of [
    ['jbeams/ccf_bonnet.jbeam', 'ccf_bonnet'],
    ['jbeams/ccf_boot.jbeam', 'ccf_boot'],
    ['jbeams/ccf_bumper_F.jbeam', 'ccf_bumper_F'],
    ['jbeams/ccf_bumper_R.jbeam', 'ccf_bumper_R'],
    ['jbeams/ccf_doors.jbeam', 'ccf_door_L'],
    ['jbeams/ccf_doors.jbeam', 'ccf_door_R'],
    ['jbeams/ccf_fenders_F.jbeam', 'ccf_wing_L'],
    ['jbeams/ccf_fenders_F.jbeam', 'ccf_wing_R'],
    ['jbeams/ccf_mirrors.jbeam', 'ccf_mirror_L'],
    ['jbeams/ccf_mirrors.jbeam', 'ccf_mirror_R'],
    ['jbeams/ccf_sideskirts.jbeam', 'ccf_sideskirt_L'],
    ['jbeams/ccf_sideskirts.jbeam', 'ccf_sideskirt_R'],
    ['jbeams/ccf_headlights.jbeam', 'ccf_headlight_L'],
    ['jbeams/ccf_headlights.jbeam', 'ccf_headlight_R'],
    ['jbeams/ccf_rearlights.jbeam', 'ccf_rearlight_L'],
    ['jbeams/ccf_rearlights.jbeam', 'ccf_rearlight_R'],
    ['jbeams/ccf_undertray.jbeam', 'ccf_undertray'],
    ['jbeams/ccf_radiator.jbeam', 'ccf_radiator'],
    ['jbeams/ccf_engbaycrap.jbeam', 'ccf_engbaycrap'],
    ['jbeams/ccf_fueltank.jbeam', 'ccf_fueltank'],
    ['jbeams/ccf_exhaust.jbeam', 'ccf_exhaust'],
    ['jbeams/ccf_intbucket_lhd.jbeam', 'ccf_intbucket_bare_lhd']
  ]) {
    loader.loadPart(rel, key);
  }
  loader.loadPart('jbeams/ccf_engines.jbeam', 'ccf_engine_f4');
  loader.loadPart('jbeams/ccf_transmission.jbeam', 'ccf_transmission_6M');
  loader.loadPart('jbeams/ccf_differential_R.jbeam', 'ccf_differential_R_LSD');
  const glassData = parseJbeamFile(path.join(CCF_DIR, 'jbeams/ccf_glass.jbeam'));
  const glassKey = Object.keys(glassData).find(k => k !== 'information') || '';
  console.log('glass part key:', glassKey);
  loader.loadPartFromData(glassData, glassKey, 'ccf_glass.jbeam');
  const wheelF = parseJbeamFile(path.join(CCF_DIR, '../common/wheels/ccf_wheel_1_thw/ccf_wheels_thw_F_5.jbeam'));
  const wheelR = parseJbeamFile(path.join(CCF_DIR, '../common/wheels/ccf_wheel_1_thw/ccf_wheels_thw_R_5.jbeam'));
  const wfKey = Object.keys(wheelF).find(k => k !== 'information') || '';
  const wrKey = Object.keys(wheelR).find(k => k !== 'information') || '';
  console.log('wheel part keys:', wfKey, '|', wrKey);
  loader.loadPartFromData(wheelF, wfKey, 'ccf_wheels_thw_F_5.jbeam');
  loader.loadPartFromData(wheelR, wrKey, 'ccf_wheels_thw_R_5.jbeam');
  const tireF = parseJbeamFile(path.join(CCF_DIR, '../common/tires/17x8_ccf/official/tires_F_17x8_standard.jbeam'));
  const tireR = parseJbeamFile(path.join(CCF_DIR, '../common/tires/17x8_ccf/official/tires_R_17x8_standard.jbeam'));
  const tfKey = Object.keys(tireF).find(k => k !== 'information') || '';
  const trKey = Object.keys(tireR).find(k => k !== 'information') || '';
  loader.loadPartFromData(tireF, tfKey, 'tires_F_17x8_standard.jbeam');
  loader.loadPartFromData(tireR, trKey, 'tires_R_17x8_standard.jbeam');
  loader.finalize();

  console.log('warnings:', loader.warnings.slice(0, 10));
  console.log('nodes:', loader.nodes.length, 'beams:', loader.beams.length, 'flexbodies:', loader.flexbodies.length, 'pressureWheels:', loader.pressureWheels.length);

  // Body bbox to verify axis convention
  const bodyNodes = loader.nodes.filter(n => n.groups.includes('ccf_body'));
  const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const n of bodyNodes) {
    for (const [a, v] of [[0, n.x], [1, n.y], [2, n.z]]) {
      bb[a] = Math.min(bb[a], v); bb[a + 3] = Math.max(bb[a + 3], v);
    }
  }
  console.log('ccf_body node count:', bodyNodes.length, 'bbox:', bb.map(v => +v.toFixed(3)));

  // Chassis rigid ids: body + engine + transmission + differential + glass(visual only)
  const rigidIds = new Set();
  for (const n of loader.nodes) {
    if (n.part === 'ccf_body' || n.part === 'ccf_engine_f4' || n.part === 'ccf_transmission_6M' ||
        n.part === 'ccf_differential_R_LSD' || n.part === 'ccf_bonnet' || n.part === 'ccf_boot' ||
        n.part === 'ccf_bumper_F' || n.part === 'ccf_bumper_R' || n.part === 'ccf_door_L' ||
        n.part === 'ccf_door_R' || n.part === 'ccf_wing_L' || n.part === 'ccf_wing_R' ||
        n.part === 'ccf_mirror_L' || n.part === 'ccf_mirror_R' || n.part === 'ccf_sideskirt_L' ||
        n.part === 'ccf_sideskirt_R' || n.part === 'ccf_headlight_L' || n.part === 'ccf_headlight_R' ||
        n.part === 'ccf_rearlight_L' || n.part === 'ccf_rearlight_R' || n.part === 'ccf_undertray' ||
        n.part === 'ccf_radiator' || n.part === 'ccf_engbaycrap' || n.part === 'ccf_fueltank' ||
        n.part === 'ccf_exhaust' || n.part === 'ccf_intbucket_bare_lhd' ||
        n.part === 'ccf_coilover_F' || n.part === 'ccf_coilover_R') {
      rigidIds.add(n.id);
    }
  }
  console.log('rigid nodes:', rigidIds.size);

  // Wheel carrier nodes: groups wheelhub_*
  const wheelSlots = {
    FL: { baseX: 0.245, baseY: -1.1994, baseZ: 0.28525 },
    FR: { baseX: 0.245, baseY: -1.1994, baseZ: 0.28525 },
    RL: { baseX: 0.245, baseY: 1.11919, baseZ: 0.291381 },
    RR: { baseX: 0.245, baseY: 1.11919, baseZ: 0.291381 }
  };
  const wheelDefs = [];
  for (const wname of ['FL', 'FR', 'RL', 'RR']) {
    const side = wname[1] === 'L' ? 'l' : 'r';
    const slot = wheelSlots[wname];
    // carrier nodes: wheelhub_<WNAME> group
    const carrier = loader.nodes.filter(n => n.groups.includes('wheelhub_' + wname));
    const world = carrier.map(n => {
      const w = wheelWorldPos(n, side, slot);
      return { id: n.id, x: w.x, y: w.y, z: w.z, mass: n.mass + 8 };
    });
    wheelDefs.push({
      name: wname, carrier, world,
      front: wname[0] === 'F', drive: wname[0] === 'R',
      radius: 0.33, width: 0.195, center: null, dir: wname[1] === 'L' ? -1 : 1
    });
  }
  console.log('wheel carriers:', wheelDefs.map(w => w.name + ':' + w.carrier.map(c => c.id).join(',')));

  // Node world positions: default = as-authored; wheel part nodes placed via slot
  const nodeData = [];
  const nodeIndex = new Map();
  for (const n of loader.nodes) {
    let wx = n.x, wy = n.y, wz = n.z;
    let mass = n.mass;
    let col = n.collision ? 1 : 0;
    if (n.part.startsWith('ccf_wheel_')) {
      // wheel part: local coords; determine side from id suffix
      const m = n.id.match(/^(.*?)([lr])$/);
      const side = m ? m[2] : 'l';
      const wname = n.id.endsWith('l') ? (n.id.includes('ll') ? 'FL' : 'FL') : (n.id.includes('rr') ? 'FR' : 'FR');
      // wheels placed at front slot (this part is front); rear uses R part
      const isR = n.part.endsWith('_R');
      const slot = isR ? wheelSlots.RL : wheelSlots.FL;
      const w = wheelWorldPos(n, side, slot);
      wx = w.x; wy = w.y; wz = w.z;
      mass = n.mass + 8; // rim / hub weight
      col = 0; // ground contact handled analytically via the wheel body
    }
    nodeIndex.set(n.id, nodeData.length);
    nodeData.push({
      id: n.id, x: wx, y: wy, z: wz,
      m: mass, g: n.groups.map(g => g), f: n.friction, col,
      rigid: rigidIds.has(n.id) ? 1 : 0, part: n.part
    });
  }

  // Beams with rest lengths computed from placed positions
  const beamData = [];
  for (const b of loader.beams) {
    const na = nodeData[nodeIndex.get(loader.nodes[b.a].id)];
    const nb = nodeData[nodeIndex.get(loader.nodes[b.b].id)];
    const dx = nb.x - na.x, dy = nb.y - na.y, dz = nb.z - na.z;
    const rest = Math.sqrt(dx * dx + dy * dy + dz * dz);
    beamData.push([
      nodeIndex.get(na.id), nodeIndex.get(nb.id),
      isFinite(b.k) ? b.k : 1e9, b.c, rest,
      b.deform, isFinite(b.strength) ? b.strength : 1e12,
      b.lb, b.sb, b.pre, b.optional ? 1 : 0
    ]);
  }
  console.log('beams emitted:', beamData.length);

  // named beams (suspension springs/dampers etc.) for telemetry
  const beamNameMap = new Map();
  for (let i = 0; i < loader.beams.length; i++) {
    if (loader.beams[i].name) {
      if (!beamNameMap.has(loader.beams[i].name)) beamNameMap.set(loader.beams[i].name, []);
      beamNameMap.get(loader.beams[i].name).push(i);
    }
  }
  const beamNames = [...beamNameMap.entries()];
  console.log('named beams:', beamNames.length);

  // Groups index
  const groups = new Map();
  for (const n of nodeData) {
    for (const g of n.g) {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(n.id);
    }
  }

  // Engine + gearbox
  const eng = parseJbeamFile(path.join(CCF_DIR, 'jbeams/ccf_engines.jbeam'))['ccf_engine_f4'];
  const engine = {
    torque: (eng.mainEngine.torque || []).filter(r => Array.isArray(r) && r.length >= 2).map(r => [r[0], r[1]]),
    idleRPM: num(eng.mainEngine.idleRPM, 950),
    maxRPM: num(eng.mainEngine.maxRPM, 10200),
    inertia: num(eng.mainEngine.inertia, 0.11),
    friction: num(eng.mainEngine.friction, 11.5),
    engineBrakeTorque: num(eng.mainEngine.engineBrakeTorque, 38),
    cylinders: 4
  };
  const gb = parseJbeamFile(path.join(CCF_DIR, 'jbeams/ccf_transmission.jbeam'))['ccf_transmission_6M'];
  const gearbox = { ratios: gb.gearbox.gearRatios || [-3.21, 0, 4.01, 2.72, 2.1, 1.7, 1.3, 0.97] };
  const diff = { finalDrive: 3.07, type: 'lsd', preload: 70 };

  // ---- DAE meshes ----
  const daeFiles = [
    path.join(CCF_DIR, 'ccfremodel.dae'),
    path.join(CCF_DIR, 'ccfoffroadster.dae'),
    path.join(CCF_DIR, 'ccfcup.dae'),
    path.join(VEH_ROOT, 'common/wheels/ccf_wheel_1_thw/ccf_wheels_thw.dae'),
    path.join(VEH_ROOT, 'common/tires/ccftires.dae'),
    path.join(VEH_ROOT, 'common/wheels/ccf_wheels_lj/ccf_wheels_lj_rework.dae'),
    path.join(VEH_ROOT, 'common/wheels/ccf_wheels_fsw/ccf_wheels_fsw.dae')
  ].filter(f => fs.existsSync(f));
  console.log('DAE files:', daeFiles.map(f => path.basename(f)));

  const sceneByName = new Map();
  const geomById = new Map();
  const effectMats = new Map(); // matId -> effect id
  const matData = new Map();    // matId -> {diffuse, emissive, transparent, shininess, technique}
  for (const f of daeFiles) {
    const dae = parseDAE(f);
    for (const [id, ge] of dae.geoms) if (!geomById.has(id)) geomById.set(id, ge);
    for (const sc of dae.scenes) if (!sceneByName.has(sc.name)) sceneByName.set(sc.name, sc);
    for (const [id, eff] of dae.mats) if (!effectMats.has(id)) effectMats.set(id, eff);
    for (const [id, m] of dae.effects) if (!matData.has(id)) matData.set(id, m);
  }
  console.log('geometries:', geomById.size, 'scene nodes:', sceneByName.size, 'materials:', matData.size);

  // Resolve material -> effect data
  function resolveMat(matId) {
    const effId = effectMats.get(matId);
    if (!effId) return null;
    return matData.get(effId) || null;
  }

  // Flexbody mesh resolution
  const meshOut = [];
  const usedMats = new Set();
  const usedTexNames = new Map(); // texture name -> file
  const texIndex = buildTextureIndex();
  const seen = new Set();
  for (const fb of loader.flexbodies) {
    let sc = sceneByName.get(fb.mesh);
    if (!sc && (fb.mesh.startsWith('tire_') || fb.mesh.startsWith('wheel_'))) {
      // fuzzy longest-prefix match (e.g. tire_01a_17x8_26 -> tire_01a_17x8_24_sport_thw)
      let best = null, bestLen = 0;
      for (const [name, s] of sceneByName) {
        let l = 0;
        const n = Math.min(name.length, fb.mesh.length);
        while (l < n && name[l] === fb.mesh[l]) l++;
        if (l > bestLen && l >= 8) { bestLen = l; best = s; }
      }
      sc = best;
    }
    if (!sc) { loader.warnings.push('scene node not found: ' + fb.mesh); continue; }
    const ge = geomById.get(sc.geoUrl);
    if (!ge) { loader.warnings.push('geometry not found: ' + sc.geoUrl + ' for ' + fb.mesh); continue; }
    const key = fb.mesh + '|' + fb.part;
    if (seen.has(key)) continue;
    seen.add(key);
    const mats = [];
    for (const sub of ge.subs) {
      const matId = (sc.mats.find(m => m.symbol === sub.mat) || {}).target || '';
      if (matId) usedMats.add(matId);
      mats.push({ symbol: sub.mat, matId });
    }
    meshOut.push({
      name: fb.mesh, part: fb.part, geo: sc.geoUrl, matrix: sc.matrix, mats,
      groups: fb.groups, pos: fb.pos, rot: fb.rot, scale: fb.scale
    });
  }
  console.log('meshes resolved:', meshOut.length, 'of flexbodies:', loader.flexbodies.length);
  console.log('missing scene nodes:', loader.warnings.filter(w => w.includes('scene node')).slice(0, 30));

  if (process.env.DEBUG_MESHES) {
    for (const m of meshOut) {
      const info = m.mats.map(s => {
        const r = resolveMat(s.matId);
        const tex = r && r.diffuse && r.diffuse.tex ? (r.sampler ? r.sampler[r.diffuse.tex] : null) : null;
        return s.matId + (tex ? '[' + tex + ']' : '');
      });
      console.log('mesh', m.name, m.geo, info.join(', '));
    }
  }

  // Collect textures from used materials
  for (const matId of usedMats) {
    const m = resolveMat(matId);
    if (!m) continue;
    for (const key of ['diffuse', 'emissive']) {
      const d = m[key];
      if (d && d.tex) {
        const img = m.sampler ? m.sampler[d.tex] : null;
        const f = resolveTexture(img || d.tex, texIndex);
        if (f) usedTexNames.set(img || d.tex, f);
      }
    }
  }
  console.log('used textures:', usedTexNames.size, [...usedTexNames.keys()].slice(0, 40));

  // Geometry emission (only used geos)
  const geosOut = {};
  for (const mesh of meshOut) {
    const ge = geomById.get(mesh.geo);
    if (!geosOut[mesh.geo]) {
      const b = bboxOf(ge);
      geosOut[mesh.geo] = {
        pos: Buffer.from(ge.pos.buffer, ge.pos.byteOffset, ge.pos.byteLength).toString('base64'),
        nrm: ge.nrm ? Buffer.from(ge.nrm.buffer, ge.nrm.byteOffset, ge.nrm.byteLength).toString('base64') : null,
        uv: ge.uv ? Buffer.from(ge.uv.buffer, ge.uv.byteOffset, ge.uv.byteLength).toString('base64') : null,
        idx: (() => {
          const total = ge.subs.reduce((s, x) => s + x.tris.length, 0);
          const out = new Uint32Array(total);
          let o = 0;
          for (const s of ge.subs) { out.set(s.tris, o); o += s.tris.length; }
          return Buffer.from(out.buffer).toString('base64');
        })(),
        bbox: b.map(v => +v.toFixed(4))
      };
    }
  }
  console.log('geometries emitted:', Object.keys(geosOut).length);
  if (geosOut[meshOut[0] && meshOut[0].geo]) console.log('first mesh bbox:', geosOut[meshOut[0].geo].bbox);

  // Textures -> PNG base64
  const texOut = {};
  let texBytes = 0;
  for (const [name, file] of usedTexNames) {
    try {
      const buf = fs.readFileSync(file);
      const maxDim = /main|body|glass|wheel|tire|interior|lights/.test(name) ? 512 : 384;
      const r = ddsToPNG(buf, maxDim);
      texOut[name] = { w: r.width, h: r.height, url: 'data:image/png;base64,' + r.png.toString('base64') };
      texBytes += r.png.length;
    } catch (e) {
      loader.warnings.push('texture fail ' + name + ': ' + e.message);
    }
  }
  console.log('textures emitted:', Object.keys(texOut).length, 'png bytes:', (texBytes / 1048576).toFixed(2) + 'MB');
  console.log('last warnings:', loader.warnings.slice(-12));

  // Materials output
  const matsOut = {};
  for (const matId of usedMats) {
    const m = resolveMat(matId);
    const o = { diffuse: [0.7, 0.7, 0.7, 1], emissive: null, transparent: null, shininess: 0 };
    if (m) {
      if (m.diffuse && m.diffuse.color) {
        const c = m.diffuse.color;
        o.diffuse = [c[0], c[1], c[2], c.length > 3 ? c[3] : 1];
      }
      if (m.diffuse && m.diffuse.tex) {
        const img = (m.sampler && m.sampler[m.diffuse.tex]) || m.diffuse.tex;
        o.tex = img;
        o.diffuse = [1, 1, 1, 1];
        if (usedTexNames.has(img)) o.texFile = img;
      }
      if (m.emissive && m.emissive.color) {
        const c = m.emissive.color;
        o.emissive = [c[0], c[1], c[2]];
      }
      if (m.emissive && m.emissive.tex) {
        const d = usedTexNames.get(m.emissive.tex);
        if (d) o.emissiveTex = m.emissive.tex;
        else o.emissive = [0.9, 0.9, 0.9];
      }
      o.transparent = m.transparent;
      o.shininess = m.shininess;
      o.technique = m.technique;
    }
    matsOut[matId] = o;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const vehicleOut = {
    name: 'Hirochi CCF (thw_ccf2 reset)',
    coord: 'X lateral(+left) Y longitudinal(+rear) Z up',
    nodes: nodeData.map(n => ({ id: n.id, x: +n.x.toFixed(6), y: +n.y.toFixed(6), z: +n.z.toFixed(6), m: n.m, g: n.g, f: n.f, col: n.col, r: n.rigid })),
    beams: beamData,
    beamNames,
    groups: [...groups.entries()].map(([k, v]) => [k, v]),
    flexbodies: meshOut.map(m => ({
      name: m.name, part: m.part, geo: m.geo, groups: m.groups,
      pos: m.pos, rot: m.rot, scale: m.scale, mats: m.mats
    })),
    wheels: wheelDefs.map(w => ({
      name: w.name, front: w.front, drive: w.drive,
      carrier: w.carrier.map(c => c.id),
      center: [+(w.world.reduce((s, p) => s + p.x, 0) / w.world.length).toFixed(6),
        +(w.world.reduce((s, p) => s + p.y, 0) / w.world.length).toFixed(6),
        +(w.world.reduce((s, p) => s + p.z, 0) / w.world.length).toFixed(6)],
      radius: w.radius, width: w.width, dir: w.dir
    })),
    tire: {
      radius: 0.33, width: 0.195, rays: 24, cols: 3,
      nodeMass: 0.16,
      peripherySpring: 36000, peripheryDamp: 90,
      sideSpring: 9000, sideDamp: 60,
      treadReinfSpring: 90000, treadReinfDamp: 130,
      peripheryReinfSpring: 72000, peripheryReinfDamp: 70,
      sideReinfSpring: 16000, sideReinfDamp: 240,
      hubSpring: 60000, hubDamp: 160, precompression: 0.96
    },
    engine, gearbox, diff,
    brakes: { torque: 3200, handbrake: 2600, bias: 0.62 }
  };

  const meshDataOut = {
    geos: geosOut,
    mats: matsOut,
    meshes: meshOut.map(m => ({ name: m.name, part: m.part, geo: m.geo, mats: m.mats, matrix: m.matrix }))
  };

  fs.writeFileSync(path.join(OUT_DIR, 'vehicle_data.js'),
    '// Auto-generated by tools/convert_assets.js — do not edit.\nglobalThis.VEHICLE_DATA = ' +
    JSON.stringify(vehicleOut) + ';\n');
  fs.writeFileSync(path.join(OUT_DIR, 'meshes_data.js'),
    '// Auto-generated by tools/convert_assets.js — do not edit.\nglobalThis.MESH_DATA = ' +
    JSON.stringify(meshDataOut) + ';\n');
  fs.writeFileSync(path.join(OUT_DIR, 'textures_data.js'),
    '// Auto-generated by tools/convert_assets.js — do not edit.\nglobalThis.TEXTURE_DATA = ' +
    JSON.stringify(texOut) + ';\n');

  console.log('Written:',
    fs.statSync(path.join(OUT_DIR, 'vehicle_data.js')).size / 1048576,
    fs.statSync(path.join(OUT_DIR, 'meshes_data.js')).size / 1048576,
    fs.statSync(path.join(OUT_DIR, 'textures_data.js')).size / 1048576, 'MB');
  console.log('warnings:', loader.warnings.length);
}

if (require.main === module) main();
module.exports = { parseJbeamFile, cleanJSON, repairCommas, JBeamLoader, parseDAE, ROOT, VEH_ROOT, CCF_DIR };
