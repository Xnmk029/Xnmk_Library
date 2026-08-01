// ============================================================================
// core/vehicle-builder.js — Phase 1 conversion core.
// Consumes parsed JBeam parts (all 115 files) and produces a VehicleSpec:
//   * chassis rigid body (mass summed from node weights, inertia tensor from
//     the real node cloud)              -> RigidBody + CollisionShape composite
//   * four wheel/tire assemblies decoupled as independent soft-body
//     suspension-wheel components with high-friction materials (mu >= 1.2)
//   * powertrain (engine torque curve, gears, final drive), brakes, steering
//   * flexbody mesh bindings for the renderer (mesh name <-> node group)
// All positions are converted to Three.js coordinates with a strict 1:1
// Cartesian mapping: three = (jx, jz, jy).
// ============================================================================

import { jbeamToThree, v3, clamp } from './math.js';
import { resolveNumber } from './jbeam-parser.js';

export const CORE_SLOT_PREFERENCES = [
  // [slotType, preferred part name substring (first match wins), required]
  ['ccf_body', 'ccf_body', true],
  ['ccf_suspension_F', 'ccf_suspension_F', true],
  ['ccf_suspension_R', 'ccf_suspension_R', true],
  ['ccf_coilover_F', 'ccf_coilover_F', false],
  ['ccf_coilover_R', 'ccf_coilover_R', false],
  ['wheel_F_5', 'ccf_wheel_4a_15x8_thw_F', false],
  ['wheel_R_5', 'ccf_wheel_4a_15x8_thw_R', false],
  ['tire_F', 'tire_F_225_55_17_Sport_vanilla', false],
  ['tire_R', 'tire_R_225_55_17_Sport_vanilla', false],
  ['ccf_engine', 'ccf_engine_f4', true],
  ['ccf_transmission', 'ccf_transmission_6M', false],
  ['ccf_differential_R', '', false],
  ['ccf_brakes_F', '', false],
  ['ccf_brakes_R', '', false],
  ['ccf_fueltank', '', false],
  ['ccf_steering', '', false],
];

// ---------------------------------------------------------------------------
export function buildVehicleSpec(partsByFile) {
  // Flatten parts: name -> part
  const parts = {};
  const files = Object.keys(partsByFile);
  for (const f of files) {
    for (const [name, part] of Object.entries(partsByFile[f])) {
      if (!parts[name]) parts[name] = part;
    }
  }

  // Merge ALL parts belonging to the chosen configuration. For mass realism we
  // aggregate every part whose slotType is in the core list (or unslotted main).
  const chosen = chooseParts(parts);
  const diagnostics = [];

  // --- variables (defaults) across chosen parts ------------------------------
  const vars = {};
  for (const p of chosen) {
    for (const [k, v] of Object.entries(p.variables || {})) {
      if (!(k in vars) && typeof v.default === 'number') vars[k.replace(/^\$/, '')] = v.default;
    }
  }
  vars.brakestrength = vars.brakestrength ?? 1;

  // --- nodes -> mass, CoM, inertia -------------------------------------------
  let mass = 0;
  const com = v3();
  const nodeCloud = [];
  const nodeIndex = new Map();
  for (const p of chosen) {
    for (const n of p.nodes) {
      const t = jbeamToThree(n.pos[0], n.pos[1], n.pos[2]);
      nodeCloud.push({ id: `${p.name}:${n.id}`, m: n.weight, p: t, group: n.group });
      nodeIndex.set(n.id, t);
      mass += n.weight;
      com.x += t.x * n.weight; com.y += t.y * n.weight; com.z += t.z * n.weight;
    }
  }
  if (mass < 1) { mass = 1250; diagnostics.push('WARN: node mass sum failed, fallback 1250 kg'); }
  com.x /= mass; com.y /= mass; com.z /= mass;

  // Inertia tensor about CoM (point-mass approximation, box-blended below).
  let Ixx = 0, Iyy = 0, Izz = 0;
  for (const n of nodeCloud) {
    const dx = n.p.x - com.x, dy = n.p.y - com.y, dz = n.p.z - com.z;
    Ixx += n.m * (dy * dy + dz * dz);
    Iyy += n.m * (dx * dx + dz * dz);
    Izz += n.m * (dx * dx + dy * dy);
  }
  // Blend toward an equivalent solid box to counter point-mass overestimate.
  const dims = cloudDimensions(nodeCloud, com);
  const box = {
    x: (mass / 12) * (dims.y * dims.y + dims.z * dims.z),
    y: (mass / 12) * (dims.x * dims.x + dims.z * dims.z),
    z: (mass / 12) * (dims.x * dims.x + dims.y * dims.y),
  };
  const inertia = {
    x: 0.5 * Ixx + 0.5 * box.x,
    y: 0.5 * Iyy + 0.5 * box.y,
    z: 0.5 * Izz + 0.5 * box.z,
  };

  // --- wheels: hubs from wheel parts, mounts from suspension slots -----------
  const suspF = findPart(parts, 'slotType', 'ccf_suspension_F');
  const suspR = findPart(parts, 'slotType', 'ccf_suspension_R');
  const wheelF = pickPreferred(parts, 'wheel_F_5', 'thw') || findPart(parts, 'slotType', 'wheel_F_5');
  const wheelR = pickPreferred(parts, 'wheel_R_5', 'thw') || findPart(parts, 'slotType', 'wheel_R_5');
  const tireF = pickTire(parts, 'tire_F');
  const tireR = pickTire(parts, 'tire_R');

  const mountF = slotOffset(suspF, 'wheel_F_5', vars, { x: 0.245, y: -1.1994, z: 0.28525 });
  const mountR = slotOffset(suspR, 'wheel_R_5', vars, { x: 0.245, y: 1.11919, z: 0.291381 });

  const hubF = hubCenters(wheelF, 'fw');
  const hubR = hubCenters(wheelR, 'rw');

  const wheels = [
    makeWheel('FL', +1, mountF, hubF.left, tireF, true),
    makeWheel('FR', -1, mountF, hubF.right, tireF, true),
    makeWheel('RL', +1, mountR, hubR.left, tireR, false),
    makeWheel('RR', -1, mountR, hubR.right, tireR, false),
  ];

  // --- suspension spring/damper from coilover parts ---------------------------
  const coilF = findPart(parts, 'slotType', 'ccf_coilover_F');
  const coilR = findPart(parts, 'slotType', 'ccf_coilover_R');
  const springF = coilRate(coilF, 30000, 3900);
  const springR = coilRate(coilR, 33000, 3900);
  for (const w of wheels) {
    const s = w.steerable ? springF : springR;
    w.springK = s.k; w.damperC = s.c;
  }

  // --- powertrain --------------------------------------------------------------
  const enginePart = pickPreferred(parts, 'ccf_engine', 'f4') || findPart(parts, 'slotType', 'ccf_engine');
  const transPart = findPart(parts, 'slotType', 'ccf_transmission');
  const diffR = findPart(parts, 'slotType', 'ccf_differential_R');

  const engine = extractEngine(enginePart);
  const gearbox = extractGearbox(transPart, diffR, vars);

  // --- brakes ------------------------------------------------------------------
  const brakes = extractBrakes(parts, vars);

  // --- steering ------------------------------------------------------------------
  const steering = { maxLockRad: 0.62, ratio: 13.5 };

  // --- flexbody bindings (mesh -> node group) for renderer alignment -------------
  const bindings = [];
  for (const p of chosen) {
    for (const fb of p.flexbodies) {
      bindings.push({
        mesh: fb.mesh, groups: fb.groups, part: p.name,
        pos: jbeamToThree(fb.pos.x || 0, fb.pos.y || 0, fb.pos.z || 0),
        rot: fb.rot, scale: fb.scale,
      });
    }
  }

  // --- refNodes (origin markers) ------------------------------------------------
  let refNodes = null;
  const bodyPart = findPart(parts, 'slotType', 'ccf_body');
  if (bodyPart && Array.isArray(bodyPart.refNodes)) {
    refNodes = bodyPart.refNodes;
  }

  // --- body-only extents (excluding wheels/tires) for shell alignment --------
  const bodyExt = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of chosen) {
    if (/^(wheel_|tire_)/.test(p.slotType)) continue;
    for (const n of p.nodes) {
      const t = jbeamToThree(n.pos[0], n.pos[1], n.pos[2]);
      bodyExt.x0 = Math.min(bodyExt.x0, t.x - com.x); bodyExt.x1 = Math.max(bodyExt.x1, t.x - com.x);
      bodyExt.y0 = Math.min(bodyExt.y0, t.y - com.y); bodyExt.y1 = Math.max(bodyExt.y1, t.y - com.y);
      bodyExt.z0 = Math.min(bodyExt.z0, t.z - com.z); bodyExt.z1 = Math.max(bodyExt.z1, t.z - com.z);
    }
  }
  if (!Number.isFinite(bodyExt.x0)) Object.assign(bodyExt, dims.extents);

  diagnostics.push(`parts=${chosen.length} nodes=${nodeCloud.length} mass=${mass.toFixed(1)}kg`);
  diagnostics.push(`wheelbase=${(Math.abs(wheels[0].mount.z - wheels[2].mount.z)).toFixed(4)}m track=${(Math.abs(wheels[0].mount.x - wheels[1].mount.x)).toFixed(4)}m`);
  diagnostics.push(`springF=${springF.k}N/m springR=${springR.k}N/m gears=[${gearbox.gearRatios.join(',')}] final=${gearbox.finalDrive}`);

  return {
    name: 'Hirochi CCF (thw_ccf2)',
    mass, com, inertia, dims,
    bodyExtents: bodyExt,
    wheels,
    engine, gearbox, brakes, steering,
    bindings, refNodes,
    nodeCloud,
    diagnostics,
    vars,
  };
}

// ---------------------------------------------------------------------------
function chooseParts(parts) {
  const out = [];
  const seenSlots = new Set();
  const all = Object.values(parts);
  // preferred order: main body first
  const priority = (p) => (p.slotType === 'main' ? 0 : 1);
  for (const p of all.sort((a, b) => priority(a) - priority(b))) {
    const st = p.slotType;
    if (!st) continue;
    const isCore = CORE_SLOT_PREFERENCES.some(([slot]) => slot === st) ||
      ['main', 'ccf_intbucket_lhd', 'ccf_bonnet', 'ccf_boot', 'ccf_doors', 'ccf_glass',
        'ccf_fenders_F', 'ccf_bumper_F', 'ccf_bumper_R', 'ccf_headlights', 'ccf_rearlights',
        'ccf_exhaust', 'ccf_fueltank', 'ccf_enginemounts', 'ccf_radiator', 'ccf_undertray',
        'ccf_swaybar_F', 'ccf_swaybar_R', 'ccf_hub_F', 'ccf_hub_R', 'ccf_wheeldata_F',
        'ccf_wheeldata_R', 'ccf_seats', 'ccf_interior', 'ccf_steeringwheel'].includes(st);
    if (isCore && !seenSlots.has(st)) {
      seenSlots.add(st);
      out.push(p);
    }
  }
  // always include main part
  const main = all.find((p) => p.slotType === 'main');
  if (main && !out.includes(main)) out.unshift(main);
  return out;
}

function findPart(parts, key, value) {
  return Object.values(parts).find((p) => p[key] === value) || null;
}
function pickPreferred(parts, slotType, nameSub) {
  const cands = Object.values(parts).filter((p) => p.slotType === slotType);
  return cands.find((p) => p.name.toLowerCase().includes(nameSub.toLowerCase())) || cands[0] || null;
}
function pickTire(parts, sidePrefix) {
  const cands = Object.values(parts).filter((p) => p.slotType && p.slotType.startsWith(sidePrefix) && p.pressureWheels.length);
  if (!cands.length) return null;
  return cands.find((p) => p.name.includes('Sport_vanilla')) || cands[0];
}

function slotOffset(suspPart, slotTypeName, vars, fallback) {
  if (suspPart) {
    for (const row of suspPart.slots) {
      if (Array.isArray(row) && row[0] === slotTypeName && row[3] && row[3].nodeOffset) {
        const no = row[3].nodeOffset;
        return {
          x: resolveNumber(no.x, vars, fallback.x),
          y: resolveNumber(no.y, vars, fallback.y),
          z: resolveNumber(no.z, vars, fallback.z),
        };
      }
    }
  }
  return { ...fallback };
}

// Hub centres from wheel-part hub nodes (JBeam coords -> Three), side split by x sign.
function hubCenters(wheelPart, prefix) {
  const res = { left: null, right: null };
  if (wheelPart) {
    const groups = { left: [], right: [] };
    for (const n of wheelPart.nodes) {
      if (!n.id.startsWith(prefix)) continue;
      const t = jbeamToThree(n.pos[0], n.pos[1], n.pos[2]);
      (n.pos[0] >= 0 ? groups.left : groups.right).push(t);
    }
    const avg = (arr) => arr.length ? {
      x: arr.reduce((s, p) => s + p.x, 0) / arr.length,
      y: arr.reduce((s, p) => s + p.y, 0) / arr.length,
      z: arr.reduce((s, p) => s + p.z, 0) / arr.length,
    } : null;
    res.left = avg(groups.left);
    res.right = avg(groups.right);
  }
  return res;
}

function makeWheel(id, side, mount, hub, tirePart, steerable) {
  // side: +1 left (+x), -1 right
  const hubLocalX = hub ? Math.abs(hub.x) : 0.465;
  const mountJ = { x: side * (hubLocalX + mount.x), y: mount.y, z: mount.z };
  const t = jbeamToThree(mountJ.x, mountJ.y, mountJ.z);

  const pw = tirePart && tirePart.pressureWheels.length ? tirePart.pressureWheels[0] : null;
  const radius = pw ? pw.radius : 0.335;
  const width = pw ? pw.tireWidth : 0.2;
  // Task directive: tire physical material friction >= 1.2 (rough).
  const muBase = pw ? Math.max(1.2, pw.frictionCoef * pw.noLoadCoef) : 1.4;

  return {
    id, side, steerable,
    mount: t,                        // Three-space hub/mount position (chassis frame)
    radius, width,
    hubRadius: pw ? pw.hubRadius : radius * 0.6,
    // soft-body tire carcass parameters (from tread/periphery beam network)
    carcassK: pw ? (pw.treadSpring * 2.0) : 220000,   // N/m vertical carcass stiffness
    carcassC: pw ? (pw.treadDamp * 40) : 2600,        // N.s/m
    sideK: pw ? pw.sideSpring * 12 : 240000,          // lateral carcass stiffness
    muBase,
    muLoadSlope: pw ? pw.loadSensitivitySlope : 0.00018,
    muFullLoad: pw ? Math.max(1.2, pw.fullLoadCoef + 0.7) : 1.2,
    rough: true,
    inertia: 1.1,                    // wheel+tire rotational inertia kg.m^2
    springK: 33000, damperC: 3900,   // overwritten by coilover extraction
    travel: { bump: 0.13, rebound: 0.11 },
    restLength: 0.24,                // strut rest length (mount->hub)
  };
}

function coilRate(coilPart, kDef, cDef) {
  if (!coilPart) return { k: kDef, c: cDef };
  let k = 0, c = 0;
  for (const b of coilPart.beams) {
    if (b.spring > 0 && b.spring < 500000) k = Math.max(k, b.spring);
    if (b.damp > 500 && b.damp < 20000) c = Math.max(c, b.damp);
  }
  return { k: k || kDef, c: c || cDef };
}

function extractEngine(enginePart) {
  const e = enginePart && enginePart.mainEngine ? enginePart.mainEngine : null;
  const torqueTable = [];
  if (e && Array.isArray(e.torque)) {
    for (const row of e.torque) {
      if (Array.isArray(row) && row.length >= 2 && typeof row[0] === 'number') {
        torqueTable.push([row[0], row[1]]);
      }
    }
  }
  if (!torqueTable.length) {
    torqueTable.push([0, 0], [950, 170], [3000, 226], [5500, 272], [7500, 216], [10200, 90]);
  }
  return {
    torqueTable,
    idleRPM: e ? (e.idleRPM ?? 950) : 950,
    maxRPM: e ? (e.maxRPM ?? 10200) : 10200,
    limiterRPM: 7500,
    inertia: e ? (e.inertia ?? 0.11) : 0.11,
    friction: e ? (e.friction ?? 11.5) : 11.5,
    dynamicFriction: e ? (e.dynamicFriction ?? 0.024) : 0.024,
    engineBrakeTorque: e ? (e.engineBrakeTorque ?? 38) : 38,
    acoustics: {
      cylinders: 4, configuration: 'flat-4', firingOrder: [1, 3, 2, 4],
      exhaustManifoldLength: 0.85, strokesPerCycle: 4,
    },
  };
}

function extractGearbox(transPart, diffPart, vars) {
  let gearRatios = [-3.21, 0, 4.01, 2.72, 2.1, 1.7, 1.3, 0.97];
  if (transPart) {
    // search raw JSON for gearRatios arrays
    const raw = transPart.raw[transPart.name];
    const found = findGearRatios(raw, vars);
    if (found) gearRatios = found;
  }
  let finalDrive = 3.07;
  if (diffPart) {
    const raw = diffPart.raw[diffPart.name];
    const g = findGearRatioValue(raw, vars);
    if (g) finalDrive = g;
  }
  return { gearRatios, finalDrive, drivenAxle: 'RWD', reverseRatio: gearRatios[0] };
}

function findGearRatios(obj, vars, depth = 0) {
  if (!obj || depth > 6) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = findGearRatios(item, vars, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === 'object') {
    if (Array.isArray(obj.gearRatios) && obj.gearRatios.length >= 6) {
      const ratios = obj.gearRatios.map((v) => resolveNumber(v, vars, NaN));
      if (ratios.every((v) => Number.isFinite(v))) return ratios;
    }
    for (const v of Object.values(obj)) {
      const r = findGearRatios(v, vars, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function findGearRatioValue(obj, vars, depth = 0) {
  if (!obj || depth > 6) return null;
  if (Array.isArray(obj)) {
    // powertrain row: ["differential", "differential_R", "driveshaft", 1, {gearRatio: 3.07, ...}]
    for (const item of obj) {
      if (Array.isArray(item) && item[0] === 'differential') {
        const opts = item[4];
        if (opts && opts.gearRatio !== undefined) {
          const g = resolveNumber(opts.gearRatio, vars, NaN);
          if (Number.isFinite(g) && g > 1 && g < 14) return g;
        }
      }
      const r = findGearRatioValue(item, vars, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      const r = findGearRatioValue(v, vars, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function extractBrakes(parts, vars) {
  let front = 1900, rear = 800;
  const candF = Object.values(parts).find((p) => /brake/i.test(p.slotType || '') && /F/.test(p.slotType));
  const candR = Object.values(parts).find((p) => /brake/i.test(p.slotType || '') && /R/.test(p.slotType));
  const grab = (part) => {
    if (!part) return null;
    const raw = part.raw[part.name];
    let best = null;
    const walk = (o, d = 0) => {
      if (!o || d > 5) return;
      if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
      if (typeof o === 'object') {
        if (o.brakeTorque !== undefined) {
          const t = resolveNumber(o.brakeTorque, vars, NaN);
          if (Number.isFinite(t)) best = Math.max(best ?? 0, t);
        }
        Object.values(o).forEach((x) => walk(x, d + 1));
      }
    };
    walk(raw);
    return best;
  };
  const f = grab(candF), r = grab(candR);
  if (f) front = f;
  if (r) rear = r;
  return { frontTorque: front, rearTorque: rear, handbrakeTorque: rear * 2.2 };
}

function cloudDimensions(cloud, com) {
  let mx = 1, my = 1, mz = 1;
  const ext = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const n of cloud) {
    mx = Math.max(mx, Math.abs(n.p.x - com.x) * 2);
    my = Math.max(my, Math.abs(n.p.y - com.y) * 2);
    mz = Math.max(mz, Math.abs(n.p.z - com.z) * 2);
    ext.x0 = Math.min(ext.x0, n.p.x - com.x); ext.x1 = Math.max(ext.x1, n.p.x - com.x);
    ext.y0 = Math.min(ext.y0, n.p.y - com.y); ext.y1 = Math.max(ext.y1, n.p.y - com.y);
    ext.z0 = Math.min(ext.z0, n.p.z - com.z); ext.z1 = Math.max(ext.z1, n.p.z - com.z);
  }
  return { x: mx, y: my, z: mz, extents: ext };
}
