/**
 * assembler.js — BeamNG-style part-config resolution and section merging.
 *
 * Input:  Map<filePath, rawJBeamText> covering every .jbeam in the mod.
 * Output: a single merged "vehicle bundle": nodes, beams, flexbodies, props,
 *         pressureWheels, hydros, torsionbars, refNodes, powertrain device
 *         configs, variables and a provenance report.
 *
 * The algorithm mirrors the game's loader:
 *   1. parse every file (relaxed SJSON) -> parts keyed by part name
 *   2. index parts by slotType
 *   3. walk the slot tree from the "main" part, honouring per-slot defaults
 *      (column 2 of the "slots" table) and user overrides
 *   4. two passes: collect variables from all chosen parts, then merge all
 *      table sections with "$var" / "$=expr" resolution and "$+key" additive
 *      config semantics.
 *
 * Pure module — no DOM access; runs identically under Node for the test-suite.
 */
import { parseJBeam } from './relaxedjson.js';
import { expandTable, tableRows, resolveVars, collectVariables } from './schema.js';

const TABLE_SECTIONS = [
  'nodes', 'beams', 'triangles', 'quads', 'flexbodies', 'props',
  'pressureWheels', 'hubWheels', 'wheels', 'hydros', 'torsionbars',
  'rails', 'slidenodes', 'powertrain', 'energyStorage', 'soundscape',
];
const META_KEYS = new Set([
  'information', 'slotType', 'slots', 'slots2', 'variables', 'refNodes',
  'camerasInternal', 'cameraExternal', 'cameraChase', 'controller',
  ...TABLE_SECTIONS,
]);

export class VehicleAssembler {
  /**
   * @param {Map<string,string>} files  path -> raw jbeam text
   * @param {(msg:string, level?:string)=>void} log
   */
  constructor(files, log = () => {}) {
    this.log = log;
    this.partsByName = new Map();
    this.partsBySlotType = new Map();
    this.parseErrors = [];

    for (const [path, text] of files) {
      let doc;
      try {
        doc = parseJBeam(text, path);
      } catch (e) {
        this.parseErrors.push(String(e.message));
        this.log(`parse error ${e.message}`, 'warn');
        continue;
      }
      if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) continue;
      for (const partName of Object.keys(doc)) {
        const part = doc[partName];
        if (!part || typeof part !== 'object' || Array.isArray(part)) continue;
        if (this.partsByName.has(partName)) {
          this.log(`duplicate part "${partName}" (${path}) ignored`, 'warn');
          continue;
        }
        part.__name = partName;
        part.__file = path;
        this.partsByName.set(partName, part);
        const st = part.slotType;
        const slotTypes = Array.isArray(st) ? st : (st ? [st] : []);
        for (const t of slotTypes) {
          if (!this.partsBySlotType.has(t)) this.partsBySlotType.set(t, []);
          this.partsBySlotType.get(t).push(partName);
        }
      }
    }
  }

  /** All part names offered for a slot type. */
  optionsFor(slotType) { return this.partsBySlotType.get(slotType) || []; }

  findMainPart(preferName = null) {
    const mains = this.optionsFor('main');
    if (preferName && this.partsByName.has(preferName)) return preferName;
    if (mains.length === 0) return null;
    // prefer the plain vehicle over cup/traffic/offroad variants
    const ranked = [...mains].sort((a, b) => a.length - b.length);
    return ranked[0];
  }

  /** Best replacement when a slot's default part name doesn't exist:
   *  rank by longest common prefix with the requested name, then brevity. */
  bestOption(slotType, wanted) {
    const opts = this.optionsFor(slotType);
    if (!opts.length) return null;
    const lcp = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
    return [...opts].sort((a, b) => (lcp(b, wanted) - lcp(a, wanted)) || (a.length - b.length))[0];
  }

  /** Extract [{type, default, options}] from a part's slots table (v1 or v2). */
  slotDeclsOf(part) {
    const decls = [];
    if (Array.isArray(part.slots)) {
      for (const row of tableRows(part.slots)) {
        if (typeof row.type === 'string' && row.type.length) {
          decls.push({ type: row.type, def: row.default ?? '', opts: row });
        }
      }
    }
    if (Array.isArray(part.slots2)) {
      for (const row of tableRows(part.slots2)) {
        const t = row.name || row.allowTypes && row.allowTypes[0];
        if (typeof t === 'string' && t.length) {
          decls.push({ type: t, def: row.default ?? '', opts: row });
        }
      }
    }
    return decls;
  }

  /**
   * Resolve the active part list.
   * @param {string|null} rootName
   * @param {Object<string,string|null>} overrides  slotType -> partName ('' / null skips slot)
   */
  resolveConfig(rootName = null, overrides = {}) {
    const root = this.findMainPart(rootName);
    if (!root) throw new Error('no part with slotType "main" found');
    const chosen = [];            // [{name, part, slotType, nodeOffset}]
    const seenParts = new Set();
    const missing = [];
    this._visitVars = new Map();  // variables become visible as the tree unfolds

    const visit = (partName, slotType, nodeOffset) => {
      const part = this.partsByName.get(partName);
      if (!part) { missing.push(`${slotType}:${partName}`); return; }
      if (seenParts.has(partName)) return;
      seenParts.add(partName);
      chosen.push({ name: partName, part, slotType, nodeOffset });
      collectVariables(part, this._visitVars);
      for (const decl of this.slotDeclsOf(part)) {
        let pick = Object.prototype.hasOwnProperty.call(overrides, decl.type)
          ? overrides[decl.type]
          : decl.def;
        if (!pick) continue; // intentionally empty slot
        if (!this.partsByName.has(pick)) {
          // fall back to the closest-named provider of the slot type
          const alt = this.bestOption(decl.type, pick);
          if (alt) {
            this.log(`slot ${decl.type}: default "${pick}" missing, using "${alt}"`, 'warn');
            pick = alt;
          } else { missing.push(`${decl.type}:${pick}`); continue; }
        }
        const off = decl.opts && decl.opts.nodeOffset ? decl.opts.nodeOffset : null;
        let childOffset = nodeOffset;
        if (off) {
          // offsets may be "$=case(...)" expressions — resolve against the
          // variables gathered so far along this branch
          const num = (v) => {
            const r = resolveVars(v, this._visitVars || new Map());
            return typeof r === 'number' && Number.isFinite(r) ? r : 0;
          };
          childOffset = {
            x: (nodeOffset?.x || 0) + num(off.x ?? 0),
            y: (nodeOffset?.y || 0) + num(off.y ?? 0),
            z: (nodeOffset?.z || 0) + num(off.z ?? 0),
          };
        }
        visit(pick, decl.type, childOffset);
      }
    };
    visit(root, 'main', null);
    return { root, chosen, missing };
  }

  /** Merge all chosen parts into one vehicle bundle. */
  assemble(rootName = null, overrides = {}) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const { root, chosen, missing } = this.resolveConfig(rootName, overrides);

    // -- pass 1: variables ---------------------------------------------------
    const vars = new Map();
    for (const c of chosen) collectVariables(c.part, vars);
    // second sweep so "$=" defaults referencing other vars settle
    for (const c of chosen) collectVariables(c.part, vars);

    const rv = (v) => resolveVars(v, vars);
    const resolveRow = (row) => {
      for (const k of Object.keys(row)) {
        const v = row[k];
        if (typeof v === 'string' && v.startsWith('$')) row[k] = rv(v);
      }
      return row;
    };

    const bundle = {
      rootPart: root,
      parts: chosen.map(c => ({ name: c.name, slotType: c.slotType, file: c.part.__file })),
      missingSlots: missing,
      parseErrors: this.parseErrors,
      variables: vars,
      nodes: [], beams: [], triangles: [], flexbodies: [], props: [],
      pressureWheels: [], hydros: [], torsionbars: [], powertrain: [],
      refNodes: null, camerasInternal: [],
      configs: {},        // mainEngine, gearbox, differential_*, etc.
      information: null,
      nodeIndex: new Map(),
    };

    // per-section modifier state threaded across parts in slot order — this is
    // how tire parts contribute {radius, frictionCoef, ...} modifiers that
    // apply to pressureWheels rows declared by the wheeldata parts.
    const sectionCarry = new Map();

    for (const c of chosen) {
      const part = c.part;
      if (!bundle.information && part.information) bundle.information = part.information;

      for (const section of TABLE_SECTIONS) {
        if (!Array.isArray(part[section])) continue;
        const carry = sectionCarry.get(section) || null;
        const { rows, sticky, header } = expandTable(part[section], carry);
        sectionCarry.set(section, { sticky, header });
        for (const raw of rows) {
          const row = resolveRow(raw);
          row.__part = c.name;
          if (section === 'nodes') {
            if (c.nodeOffset) {
              // BeamNG nodeOffset semantics: x is applied mirror-aware so one
              // offset widens both sides symmetrically; y/z are plain adds.
              const px = typeof row.posX === 'number' ? row.posX : 0;
              row.posX = px + Math.sign(px) * (c.nodeOffset.x || 0);
              row.posY = (typeof row.posY === 'number' ? row.posY : 0) + (c.nodeOffset.y || 0);
              row.posZ = (typeof row.posZ === 'number' ? row.posZ : 0) + (c.nodeOffset.z || 0);
            }
            if (bundle.nodeIndex.has(row.id)) continue; // first definition wins
            bundle.nodeIndex.set(row.id, row);
            bundle.nodes.push(row);
          } else if (section === 'hubWheels' || section === 'wheels') {
            bundle.pressureWheels.push(row); // treat legacy wheel tables alike
          } else if (bundle[section]) {
            bundle[section].push(row);
          }
        }
      }

      if (part.refNodes && !bundle.refNodes) {
        const rows = tableRows(part.refNodes);
        if (rows.length) bundle.refNodes = rows[0];
      }
      if (Array.isArray(part.camerasInternal)) {
        bundle.camerasInternal.push(...tableRows(part.camerasInternal));
      }

      // device / config objects: any non-table object key we don't treat as meta
      for (const key of Object.keys(part)) {
        if (META_KEYS.has(key) || key.startsWith('__')) continue;
        const val = part[key];
        if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
        const dst = bundle.configs[key] || (bundle.configs[key] = {});
        for (const [k, vRaw] of Object.entries(val)) {
          const kk = k.endsWith(':') ? k.slice(0, -1) : k;
          const v = typeof vRaw === 'string' ? rv(vRaw) : vRaw;
          if (kk.startsWith('$+')) {
            const base = kk.slice(2);
            if (typeof dst[base] === 'number' && typeof v === 'number') dst[base] += v;
            else if (dst[base] === undefined && typeof v === 'number') dst[base] = v;
          } else if (Array.isArray(v) && Array.isArray(dst[kk]) === false && dst[kk] !== undefined) {
            dst[kk] = v; // later parts (tuning) replace
          } else {
            dst[kk] = v;
          }
        }
      }
    }

    // resolve any residual "$var" strings inside configs (e.g. gearRatios)
    for (const cfg of Object.values(bundle.configs)) {
      for (const [k, v] of Object.entries(cfg)) {
        if (typeof v === 'string' && v.startsWith('$')) cfg[k] = rv(v);
        else if (Array.isArray(v)) cfg[k] = v.map(x => (typeof x === 'string' && x.startsWith('$')) ? rv(x) : x);
      }
    }

    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    bundle.stats = {
      parts: chosen.length,
      nodes: bundle.nodes.length,
      beams: bundle.beams.length,
      triangles: bundle.triangles.length,
      flexbodies: bundle.flexbodies.length,
      wheels: bundle.pressureWheels.length,
      assembleMs: +(t1 - t0).toFixed(1),
    };
    this.log(`assembled "${root}": ${bundle.stats.parts} parts, ${bundle.stats.nodes} nodes, ` +
      `${bundle.stats.beams} beams, ${bundle.stats.wheels} wheel defs in ${bundle.stats.assembleMs} ms`);
    return bundle;
  }
}

export default VehicleAssembler;
