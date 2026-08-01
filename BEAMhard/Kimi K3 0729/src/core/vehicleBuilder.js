// Phase 1.2/1.3 — JBeam -> web physics conversion.
// Consumes parsed JBeam parts (jbeamParser) and produces a VehicleSpec:
//   * chassis node cloud collapsed to RigidBody mass properties (mass, CoM,
//     full point-mass inertia tensor) + composite CollisionShape boxes
//   * tire node groups decoupled into independent soft-body wheel specs
//     (hub hardpoints, spring/damper rates from suspension beams, tire
//     radius/width from tire parts)
//   * engine / transmission / brake drivetrain parameters
// Coordinate mapping (strict 1:1 Cartesian): JBeam (+X left, +Y rear, +Z up)
//   -> Three.js (x=-jX, y=+jZ, z=+jY): a proper rotation, determinant +1.

import * as THREE from '../../lib/three.module.js';
import { normalizeTable, evalVarExpression } from './jbeamParser.js';

/** Convert one JBeam position to Three.js coordinates. */
export function jbeamToThree(jx, jy, jz) {
  return new THREE.Vector3(-jx, jz, jy);
}

/** Curated file set: default cup/street configuration of the Hirochi CCF. */
export const CURATED_JBEAM_FILES = [
  'vehicles/ccf/ccf.jbeam',
  'vehicles/ccf/jbeams/ccf_body.jbeam',
  'vehicles/ccf/jbeams/ccf_bonnet.jbeam',
  'vehicles/ccf/jbeams/ccf_boot.jbeam',
  'vehicles/ccf/jbeams/ccf_doors.jbeam',
  'vehicles/ccf/jbeams/ccf_bumper_F.jbeam',
  'vehicles/ccf/jbeams/ccf_bumper_R.jbeam',
  'vehicles/ccf/jbeams/ccf_fenders_F.jbeam',
  'vehicles/ccf/jbeams/ccf_glass.jbeam',
  'vehicles/ccf/jbeams/ccf_interior_lhd.jbeam',
  'vehicles/ccf/jbeams/ccf_racing_seats.jbeam',
  'vehicles/ccf/jbeams/ccf_steeringwheels_lhd.jbeam',
  'vehicles/ccf/jbeams/ccf_suspension_F.jbeam',
  'vehicles/ccf/jbeams/ccf_suspension_R.jbeam',
  'vehicles/ccf/jbeams/ccf_engines.jbeam',
  'vehicles/ccf/jbeams/ccf_enginemounts.jbeam',
  'vehicles/ccf/jbeams/ccf_exhaust.jbeam',
  'vehicles/ccf/jbeams/ccf_transmission.jbeam',
  'vehicles/ccf/jbeams/ccf_differential_R.jbeam',
  'vehicles/ccf/jbeams/ccf_brakes.jbeam',
  'vehicles/ccf/jbeams/ccf_fueltank.jbeam',
  'vehicles/ccf/jbeams/ccf_radiator.jbeam',
  'vehicles/ccf/jbeams/ccf_undertray.jbeam',
  'vehicles/ccf/jbeams/ccf_mirrors.jbeam',
  'vehicles/ccf/jbeams/ccf_headlights.jbeam',
  'vehicles/ccf/jbeams/ccf_rearlights.jbeam',
  'vehicles/ccf/jbeams/ccf_sideskirts.jbeam',
  'vehicles/common/tires/17x8_ccf/official/tires_F_17x8_sport.jbeam',
  'vehicles/common/tires/17x8_ccf/official/tires_R_17x8_sport.jbeam',
];

/** Structural parts contributing nodes to the mass cloud (multi-part files: only these are used). */
const STRUCTURAL_PARTS = [
  'ccf_body', 'ccf_bonnet', 'ccf_boot', 'ccf_doors', 'ccf_bumper_F', 'ccf_bumper_R',
  'ccf_fenders_F', 'ccf_glass', 'ccf_dashboard_lhd', 'ccf_race_seat_FL', 'ccf_race_seat_FR',
  'ccf_steer_lhd', 'ccf_suspension_F', 'ccf_suspension_R',
  'ccf_hub_5l_F', 'ccf_hub_5l_R', 'ccf_shielding_F', 'ccf_shielding_R',
  'ccf_engine_f4', 'ccf_oilpan', 'ccf_engine_internals', 'ccf_engine_vvt_f4',
  'ccf_engine_f4_ecu', 'ccf_intake_f4', 'ccf_enginemounts', 'ccf_exhaust',
  'ccf_transmission_6M', 'ccf_flywheel', 'ccf_brake_F', 'ccf_brake_R',
  'ccf_fueltank', 'ccf_ebattery', 'ccf_radiator', 'ccf_undertray',
  'ccf_mirrors', 'ccf_headlights', 'ccf_rearlights', 'ccf_sideskirts',
];

/** Collect every node row from a part (mass cloud), mapping to Three space. */
function collectNodes(part, vars, acc) {
  if (!part || !Array.isArray(part.nodes)) return;
  const { rows } = normalizeTable(part.nodes, vars);
  for (const r of rows) {
    if (typeof r.id !== 'string') continue;
    const px = Number(r.posX), py = Number(r.posY), pz = Number(r.posZ);
    if (!Number.isFinite(px + py + pz)) continue;
    const w = Number(r.nodeWeight);
    acc.push({
      id: r.id,
      p: jbeamToThree(px, py, pz),
      m: Number.isFinite(w) ? w : 25,
      groups: Array.isArray(r.group) ? r.group : (r.group ? [r.group] : []),
    });
  }
}

/** Find numeric option values for a key across several table sections of a part. */
function findOptionNumbers(part, sections, key, vars) {
  const out = [];
  if (!part) return out;
  for (const section of sections) {
    if (!Array.isArray(part[section])) continue;
    for (const row of part[section]) {
      if (row && !Array.isArray(row) && typeof row === 'object' && row[key] !== undefined) {
        const raw = row[key];
        const v = typeof raw === 'string' && raw.includes('$')
          ? evalVarExpression(raw, vars) : Number(raw);
        if (Number.isFinite(v)) out.push(v);
      }
    }
  }
  return out;
}

/** Scan a beams section for rows carrying a matching `name` option. */
function findNamedBeam(part, names, vars) {
  if (!part || !Array.isArray(part.beams)) return null;
  const { rows } = normalizeTable(part.beams, vars);
  for (const r of rows) {
    if (r.name && names.includes(r.name)) return r;
  }
  return null;
}

/** First part whose name starts with one of the prefixes. */
function findPart(parts, prefixes) {
  for (const prefix of prefixes) {
    if (parts[prefix]) return parts[prefix];
  }
  const names = Object.keys(parts);
  for (const prefix of prefixes) {
    const hit = names.find((n) => n.startsWith(prefix));
    if (hit) return parts[hit];
  }
  return null;
}

/** Extract the numeric torque curve [[rpm, Nm], ...] from an engine part. */
function extractTorqueTable(enginePart) {
  const eng = enginePart && enginePart.mainEngine;
  if (!eng || !Array.isArray(eng.torque)) return null;
  const table = [];
  for (const row of eng.torque) {
    if (Array.isArray(row) && row.length >= 2 && typeof row[0] === 'number') {
      table.push([row[0], row[1]]);
    }
  }
  return table.length >= 2 ? table : null;
}

/**
 * Build the complete VehicleSpec from parsed JBeam files.
 * @param {{parts: Object<string,Object>, variables: Map<string,number>}} parsed
 * @returns {object} VehicleSpec (plain data, JSON-serialisable)
 */
export function buildVehicleSpec(parsed) {
  const { parts } = parsed;
  const vars = new Map(parsed.variables);
  const spec = {
    name: 'Hirochi CCF (thw_ccf2)',
    stats: { nodeCount: 0, beamCount: 0, partsUsed: [] },
  };

  // ---- 1. Mass cloud from structural parts ----
  const nodes = [];
  for (const [partName, part] of Object.entries(parts)) {
    if (!STRUCTURAL_PARTS.includes(partName)) continue;
    const before = nodes.length;
    collectNodes(part, vars, nodes);
    if (nodes.length > before) spec.stats.partsUsed.push(partName);
    if (part && Array.isArray(part.beams)) spec.stats.beamCount += part.beams.length;
  }
  spec.stats.nodeCount = nodes.length;
  if (nodes.length < 10) throw new Error('vehicleBuilder: node cloud too small — JBeam parse failed?');

  // ---- 2. Mass / CoM / inertia tensor (point-mass cloud) ----
  let mass = 0;
  const com = new THREE.Vector3();
  for (const n of nodes) { mass += n.m; com.addScaledVector(n.p, n.m); }
  com.multiplyScalar(1 / mass);
  let ixx = 0, iyy = 0, izz = 0;
  for (const n of nodes) {
    const dx = n.p.x - com.x, dy = n.p.y - com.y, dz = n.p.z - com.z;
    ixx += n.m * (dy * dy + dz * dz);
    iyy += n.m * (dx * dx + dz * dz);
    izz += n.m * (dx * dx + dy * dy);
  }
  spec.mass = mass;
  spec.comOffset = { x: com.x, y: com.y, z: com.z };
  spec.inertia = { x: Math.max(ixx, 100), y: Math.max(iyy, 200), z: Math.max(izz, 100) };

  // ---- 3. Composite collision shape: front/mid/rear boxes from node clusters ----
  const zs = nodes.map((n) => n.p.z).sort((a, b) => a - b);
  const zA = zs[Math.floor(zs.length / 3)];
  const zB = zs[Math.floor((2 * zs.length) / 3)];
  const clusters = [[], [], []];
  for (const n of nodes) clusters[n.p.z < zA ? 0 : n.p.z < zB ? 1 : 2].push(n.p);
  spec.collisionBoxes = clusters.map((pts) => {
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of pts) { min.min(p); max.max(p); }
    const center = min.clone().add(max).multiplyScalar(0.5);
    const he = max.clone().sub(min).multiplyScalar(0.5);
    he.x = Math.max(he.x, 0.15); he.y = Math.max(he.y, 0.08); he.z = Math.max(he.z, 0.2);
    return {
      center: { x: center.x - com.x, y: center.y - com.y, z: center.z - com.z },
      halfExtents: { x: he.x, y: he.y, z: he.z },
      friction: 0.6,
    };
  });

  // ---- 4. Wheel hardpoints from suspension hub nodes (tire groups decoupled) ----
  const hubIds = { FL: 'fh1l', FR: 'fh1r', RL: 'rh1l', RR: 'rh1r' };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const suspF = findPart(parts, ['ccf_suspension_F']) || {};
  const suspR = findPart(parts, ['ccf_suspension_R']) || {};

  // Spring/damper rates from the named suspension beams (option dicts merge in),
  // scaled by the main file's beam scale factor, clamped into a drivable band.
  const springScale = 0.78;
  const springBeamF = findNamedBeam(suspF, ['spring_FL', 'spring_FR'], vars);
  const springBeamR = findNamedBeam(suspR, ['spring_RL', 'spring_RR'], vars);
  const damperBeamF = findNamedBeam(suspF, ['damper_FL', 'damper_FR'], vars);
  const damperBeamR = findNamedBeam(suspR, ['damper_RL', 'damper_RR'], vars);
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const springKF = THREE.MathUtils.clamp(num(springBeamF?.beamSpring, 30000) * springScale, 18000, 95000);
  const springKR = THREE.MathUtils.clamp(num(springBeamR?.beamSpring, 32000) * springScale, 18000, 95000);
  const dampBumpF = THREE.MathUtils.clamp(num(damperBeamF?.beamDampFast, 2300) * springScale, 800, 8000);
  const dampRebF = THREE.MathUtils.clamp(num(damperBeamF?.beamDampRebound, 7600) * springScale, 1500, 12000);
  const dampBumpR = THREE.MathUtils.clamp(num(damperBeamR?.beamDampFast, 2300) * springScale, 800, 8000);
  const dampRebR = THREE.MathUtils.clamp(num(damperBeamR?.beamDampRebound, 7600) * springScale, 1500, 12000);

  // Tire radius/width from the tire parts (max radius in part = outer tread radius).
  const tireF = findPart(parts, ['tire_F']) || {};
  const tireR = findPart(parts, ['tire_R']) || {};
  const radiiF = findOptionNumbers(tireF, ['nodes'], 'radius', vars);
  const radiiR = findOptionNumbers(tireR, ['nodes'], 'radius', vars);
  const radiusF = radiiF.length ? Math.max(...radiiF) : 0.33;
  const radiusR = radiiR.length ? Math.max(...radiiR) : 0.335;
  const widthF = findOptionNumbers(tireF, ['nodes'], 'tireWidth', vars)[0] ?? 0.215;
  const widthR = findOptionNumbers(tireR, ['nodes'], 'tireWidth', vars)[0] ?? 0.225;

  // Brake torques live in the pressureWheels section ($brakestrength * value).
  const brakesF = findPart(parts, ['ccf_brake_F']);
  const brakesR = findPart(parts, ['ccf_brake_R']);
  const brakeF = findOptionNumbers(brakesF, ['pressureWheels', 'nodes', 'beams'], 'brakeTorque', vars)[0] ?? 1900;
  const brakeR = findOptionNumbers(brakesR, ['pressureWheels', 'nodes', 'beams'], 'brakeTorque', vars)[0] ?? 800;

  spec.wheels = [];
  for (const [name, hubId] of Object.entries(hubIds)) {
    const hubNode = byId.get(hubId);
    if (!hubNode) continue;
    const front = name.startsWith('F');
    const attach = hubNode.p.clone().sub(com);
    spec.wheels.push({
      name,
      attachLocal: { x: attach.x, y: attach.y, z: attach.z },
      steerable: front,
      driven: !front, // default RWD through the rear differential
      radius: front ? radiusF : radiusR,
      width: front ? widthF : widthR,
      springK: front ? springKF : springKR,
      dampBump: front ? dampBumpF : dampBumpR,
      dampRebound: front ? dampRebF : dampRebR,
      travelUp: 0.09,
      travelDown: 0.12,
      brakeTorqueMax: front ? brakeF : brakeR,
      inertia: 1.1,
      mass: 24,
      gripScale: 1,
    });
  }
  if (spec.wheels.length !== 4) throw new Error('vehicleBuilder: expected 4 wheel hardpoints');

  // ---- 5. Engine (2.3L F4 boxer) ----
  const enginePart = findPart(parts, ['ccf_engine_f4']) || {};
  const engSec = enginePart.mainEngine || {};
  spec.engine = {
    name: enginePart.information?.name || '2.3L F4 Engine',
    cylinders: 4,
    firingOrder: [1, 3, 4, 2],
    torque: extractTorqueTable(enginePart) || [[0, 0], [1000, 170], [5500, 270], [10000, 120]],
    idleRPM: num(engSec.idleRPM, 950),
    maxRPM: num(engSec.maxRPM, 10200),
    inertia: num(engSec.inertia, 0.11),
    friction: num(engSec.friction, 11.5),
    dynamicFriction: num(engSec.dynamicFriction, 0.024),
    engineBrake: num(engSec.engineBrakeTorque, 38),
    exhaustLength: 2.1,
  };

  // ---- 6. Transmission + final drive + auto-shift schedule ----
  const transPart = findPart(parts, ['ccf_transmission_6M', 'ccf_transmission']) || {};
  let gearRatios = null;
  if (transPart.gearbox && Array.isArray(transPart.gearbox.gearRatios)) {
    gearRatios = transPart.gearbox.gearRatios
      .map((v) => (typeof v === 'number' ? v : evalVarExpression(String(v), vars)))
      .map((v) => (Number.isFinite(v) ? v : 0));
  }
  if (!gearRatios) gearRatios = [-3.21, 0, 4.01, 2.72, 2.1, 1.7, 1.3, 0.97];
  let finalDrive = 3.07;
  const diffPart = findPart(parts, ['ccf_differential_R']) || {};
  if (Array.isArray(diffPart.powertrain)) {
    for (const row of diffPart.powertrain) {
      if (Array.isArray(row) && row[0] === 'differential' && row[4] && Number.isFinite(Number(row[4].gearRatio))) {
        finalDrive = Number(row[4].gearRatio);
        break;
      }
    }
  }
  const vc = transPart.vehicleController || {};
  spec.transmission = {
    gearRatios,
    finalDrive,
    shiftTime: 0.32,
    efficiency: 0.88,
    shiftUpRPM: Array.isArray(vc.lowShiftUpRPM) ? vc.lowShiftUpRPM : [0, 0, 3400, 3000, 2700, 2700, 2700],
    shiftDownRPM: Array.isArray(vc.lowShiftDownRPM) ? vc.lowShiftDownRPM : [0, 0, 0, 1400, 1600, 1500, 1500, 1500],
    launchRPM: num(vc.clutchLaunchTargetRPM, 3000),
  };

  // ---- 7. Aerodynamics (from main file drag scaling + coupe defaults) ----
  spec.aero = { cd: 0.38, frontalArea: 2.05, clDownforce: 0.45, airDensity: 1.225 };

  spec.tirePhysicsMaterial = { friction: 1.4, rough: true, restitution: 0.05 };
  return spec;
}
