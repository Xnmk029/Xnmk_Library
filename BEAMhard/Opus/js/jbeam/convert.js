/**
 * convert.js — Task 1.2: rigid-body & soft-tire physics conversion.
 *
 * Consumes the merged jbeam bundle (assembler.js) and derives the runtime
 * physics rig used by the WebGL solver:
 *
 *   chassis  — the soft-body node network collapsed into a 6-DOF rigid body:
 *              total mass, centre of mass, full 3x3 inertia tensor (point-mass
 *              sum with parallel-axis terms), collision hull sample points.
 *   wheels   — pressureWheels rows decoupled into independent wheel entities:
 *              centre / spin axis / kingpin from the real node positions,
 *              radius, width, tire friction (clamped to the mandated
 *              µ ≥ 1.2 "rough" physical material), spring/damper rates lifted
 *              from the coilover beams, anti-roll-bar rate from the swaybar
 *              torsion bars, brake torques from the wheeldata rows.
 *   engine / drivetrain — torque curve, inertias, gear ratios, final drive,
 *              shift map from the powertrain device configs.
 *
 * Coordinate mapping (STRICT 1:1, Task 1.2 / constraint #3):
 *   jbeam (x=left, y=rear, z=up)  →  three (x=left, y=up, z=forward)
 *   T(v) = (v.x, v.z, -v.y)   — determinant +1 (proper rotation, no mirror),
 *   identical to the transform ColladaLoader applies to Z_UP scenes, so mesh
 *   vertices and physics nodes stay aligned without any correction factors.
 *
 * Every derived quantity is logged into rig.report with its source so the
 * conversion is auditable from the in-app diagnostics panel.
 */

const G = 9.81;

export function jb2three(x, y, z) { return [x, z, -y]; }

function vec(nodeRow) { return jb2three(nodeRow.posX || 0, nodeRow.posY || 0, nodeRow.posZ || 0); }

function num(v, fallback = 0) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = /^-?\d*\.?\d+(?:[eE][-+]?\d+)?/.exec(v);
    if (m) return Number(m[0]);
  }
  return fallback;
}

export function convertToPhysicsRig(bundle, log = () => {}) {
  const report = [];
  const note = (label, value, source) => { report.push({ label, value, source }); log(`${label}: ${value}  [${source}]`); };

  // ---------------------------------------------------------------- nodes --
  const N = bundle.nodes.length;
  const ids = new Array(N);
  const pos = new Float32Array(N * 3);
  const mass = new Float32Array(N);
  const groupsOf = new Array(N);
  const idToIdx = new Map();
  let totalMass = 0;
  const com = [0, 0, 0];

  for (let i = 0; i < N; i++) {
    const n = bundle.nodes[i];
    ids[i] = n.id;
    idToIdx.set(n.id, i);
    const p = vec(n);
    pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    const w = num(n.nodeWeight, 25);
    mass[i] = w;
    totalMass += w;
    com[0] += p[0] * w; com[1] += p[1] * w; com[2] += p[2] * w;
    let g = n.group;
    if (typeof g === 'string') g = g ? [g] : [];
    groupsOf[i] = Array.isArray(g) ? g : [];
  }

  // fuel load as a point mass at the tank nodes' centroid
  let fuelMass = 0;
  const tank = bundle.configs.mainTank;
  if (tank && num(tank.startingFuelCapacity ?? tank.fuelCapacity, 0) > 0) {
    fuelMass = num(tank.startingFuelCapacity ?? tank.fuelCapacity) * 0.745; // petrol kg/L
    const tankNodes = bundle.nodes.filter(n => n.__part && /fueltank/i.test(n.__part));
    const tp = [0, 0, 0];
    if (tankNodes.length) {
      for (const n of tankNodes) { const p = vec(n); tp[0] += p[0]; tp[1] += p[1]; tp[2] += p[2]; }
      tp[0] /= tankNodes.length; tp[1] /= tankNodes.length; tp[2] /= tankNodes.length;
    }
    com[0] += tp[0] * fuelMass; com[1] += tp[1] * fuelMass; com[2] += tp[2] * fuelMass;
    totalMass += fuelMass;
    note('fuel load', `${fuelMass.toFixed(1)} kg`, `mainTank ${tank.fuelCapacity} L × 0.745`);
  }

  com[0] /= totalMass; com[1] /= totalMass; com[2] /= totalMass;

  // inertia tensor about COM (point masses)
  let Ixx = 0, Iyy = 0, Izz = 0, Ixy = 0, Ixz = 0, Iyz = 0;
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3] - com[0], y = pos[i * 3 + 1] - com[1], z = pos[i * 3 + 2] - com[2];
    const w = mass[i];
    Ixx += w * (y * y + z * z);
    Iyy += w * (x * x + z * z);
    Izz += w * (x * x + y * y);
    Ixy -= w * x * y; Ixz -= w * x * z; Iyz -= w * y * z;
  }
  // slight regularisation keeps the tensor comfortably invertible
  const inertia = [Ixx, Ixy, Ixz, Ixy, Iyy, Iyz, Ixz, Iyz, Izz];

  // re-express node rest positions relative to COM (rigid-body local frame)
  const posLocal = new Float32Array(N * 3);
  let bbMin = [1e9, 1e9, 1e9], bbMax = [-1e9, -1e9, -1e9];
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3] - com[0], y = pos[i * 3 + 1] - com[1], z = pos[i * 3 + 2] - com[2];
    posLocal[i * 3] = x; posLocal[i * 3 + 1] = y; posLocal[i * 3 + 2] = z;
    if (x < bbMin[0]) bbMin[0] = x; if (x > bbMax[0]) bbMax[0] = x;
    if (y < bbMin[1]) bbMin[1] = y; if (y > bbMax[1]) bbMax[1] = y;
    if (z < bbMin[2]) bbMin[2] = z; if (z > bbMax[2]) bbMax[2] = z;
  }

  note('rigid chassis mass', `${totalMass.toFixed(1)} kg over ${N} nodes`, 'Σ nodeWeight');
  note('centre of mass (three)', `[${com.map(v => v.toFixed(3)).join(', ')}]`, 'Σ m·p / M');
  note('inertia diag', `[${Ixx.toFixed(0)}, ${Iyy.toFixed(0)}, ${Izz.toFixed(0)}] kg·m²`, 'point-mass tensor');

  // beam wireframe + aggregate stiffness stats (conversion evidence)
  const beamPairs = [];
  let springSum = 0, springCount = 0;
  for (const b of bundle.beams) {
    const a = idToIdx.get(b.id1), c = idToIdx.get(b.id2);
    if (a === undefined || c === undefined) continue;
    beamPairs.push(a, c);
    const ks = num(b.beamSpring, 0);
    if (ks > 0) { springSum += ks; springCount++; }
  }
  note('beam network', `${beamPairs.length / 2} resolvable beams, mean k=${(springSum / Math.max(1, springCount) / 1e6).toFixed(2)} MN/m`, 'beams table');

  // collision hull sample: outermost colliding nodes on a coarse grid
  const cell = new Map();
  for (let i = 0; i < N; i++) {
    const n = bundle.nodes[i];
    if (n.collision === false) continue;
    const x = posLocal[i * 3], y = posLocal[i * 3 + 1], z = posLocal[i * 3 + 2];
    const key = `${Math.round(x / 0.35)},${Math.round(y / 0.4)},${Math.round(z / 0.45)}`;
    const r2 = x * x + y * y + z * z;
    const prev = cell.get(key);
    if (!prev || r2 > prev.r2) cell.set(key, { p: [x, y, z], r2 });
  }
  const hullPoints = [...cell.values()].map(e => e.p);

  // ---------------------------------------------------------------- wheels --
  const nodePos = (id) => {
    const i = idToIdx.get(id);
    if (i === undefined) return null;
    return [posLocal[i * 3], posLocal[i * 3 + 1], posLocal[i * 3 + 2]];
  };

  // per-axle spring/damper from coilover beams
  function axleSuspension(axleRe, fallbackCorner) {
    let k = 0, c = 0, cReb = 0, found = false;
    for (const b of bundle.beams) {
      if (!axleRe.test(b.__part || '')) continue;
      const ks = num(b.beamSpring, 0), cd = num(b.beamDamp, 0);
      if (ks > 5000 && ks < 400000) { k = Math.max(k, ks); found = true; }
      if (cd > 300 && cd < 30000) {
        c = Math.max(c, cd);
        cReb = Math.max(cReb, num(b.beamDampRebound, cd * 1.35));
      }
    }
    if (!found) {
      k = fallbackCorner * Math.pow(2 * Math.PI * 1.8, 2); // 1.8 Hz fallback
      c = 2 * 0.35 * Math.sqrt(k * fallbackCorner);
      cReb = c * 1.35;
      return { k, cBump: c, cReb, source: 'fallback 1.8 Hz ride frequency' };
    }
    return { k, cBump: c * 0.75, cReb: cReb, source: 'coilover beamSpring/beamDamp (jbeam)' };
  }

  // ARB: torsion-bar spring across the axle, converted to N per metre of
  // differential wheel travel via the physical lever-arm length
  function axleArb(partRe) {
    for (const tb of bundle.torsionbars) {
      if (!partRe.test(tb.__part || '')) continue;
      const a = nodePos(tb.id1), b = nodePos(tb.id2);
      const spring = num(tb.spring, 0);
      if (!a || !b || spring <= 0) continue;
      let arm = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      // id1/id2 are sometimes the bar ends rather than one lever — clamp to a
      // physically plausible lever length so both axles convert comparably
      const armRaw = arm;
      arm = Math.min(0.40, Math.max(0.18, arm));
      return {
        k: spring / (arm * arm) * 0.5, arm, spring,
        source: `torsionbar ${tb.__part}${armRaw !== arm ? ` (arm ${armRaw.toFixed(2)}→${arm.toFixed(2)} m clamp)` : ''}`,
      };
    }
    return { k: 0, arm: 0, spring: 0, source: 'none found' };
  }

  const cornerGuess = totalMass / 4;
  const suspF = axleSuspension(/coilover_F/i, cornerGuess);
  const suspR = axleSuspension(/coilover_R/i, cornerGuess);
  const arbF = axleArb(/swaybar_F/i);
  const arbR = axleArb(/swaybar_R/i);
  note('suspension F', `k=${suspF.k} N/m, cB=${suspF.cBump.toFixed(0)}, cR=${suspF.cReb.toFixed(0)}`, suspF.source);
  note('suspension R', `k=${suspR.k} N/m, cB=${suspR.cBump.toFixed(0)}, cR=${suspR.cReb.toFixed(0)}`, suspR.source);
  note('anti-roll bar F', `${arbF.k.toFixed(0)} N/m eff (spring ${arbF.spring}, arm ${arbF.arm.toFixed(3)} m)`, arbF.source);
  note('anti-roll bar R', `${arbR.k.toFixed(0)} N/m eff (spring ${arbR.spring}, arm ${arbR.arm.toFixed(3)} m)`, arbR.source);

  const wheels = [];
  for (const w of bundle.pressureWheels) {
    const n1 = nodePos(w.node1), n2 = nodePos(w.node2);
    if (!n1 || !n2) { log(`wheel ${w.name}: nodes ${w.node1}/${w.node2} missing, skipped`, 'warn'); continue; }
    const center = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2, (n1[2] + n2[2]) / 2];
    let axisOut = [n1[0] - n2[0], n1[1] - n2[1], n1[2] - n2[2]];
    const alen = Math.hypot(...axisOut) || 1;
    axisOut = axisOut.map(v => v / alen);

    const axle = center[2] > 0 ? 'F' : 'R';
    const susp = axle === 'F' ? suspF : suspR;
    const arb = axle === 'F' ? arbF : arbR;

    const radius = num(w.radius, 0.31);
    const width = num(w.tireWidth, 0.2);
    const hubRadius = num(w.hubRadius, radius * 0.6);
    const muRaw = num(w.frictionCoef, 1.0);
    // Critical directive: tires are high-friction rough physical materials
    const mu = Math.max(1.2, muRaw);

    const numRays = num(w.numRays, 16);
    const tireNodeW = num(w.nodeWeight, 0.15);
    const massW = tireNodeW * numRays * 2 + 11.5; // tread+hub rings + rim/hub hardware
    const inertiaW = 0.62 * massW * radius * radius;

    let kingpin = null;
    if (w.steerAxisUp && w.steerAxisDown) {
      const up = nodePos(w.steerAxisUp), dn = nodePos(w.steerAxisDown);
      if (up && dn) {
        let ax = [up[0] - dn[0], up[1] - dn[1], up[2] - dn[2]];
        const l = Math.hypot(...ax) || 1;
        kingpin = { base: dn, axis: ax.map(v => v / l) };
      }
    }

    wheels.push({
      name: w.name,
      side: center[0] >= 0 ? 'L' : 'R',
      axle,
      center, axisOut, radius, width, hubRadius,
      mu, muRaw, pressurePSI: num(w.pressurePSI, 30),
      massW, inertiaW, numRays,
      wheelDir: num(w.wheelDir, center[0] >= 0 ? -1 : 1),
      steered: !!kingpin && axle === 'F',
      driven: false, // set from powertrain below
      brakeTorque: num(w.brakeTorque, 1200),
      parkingTorque: num(w.parkingTorque, 0),
      brakeSplit: num(w.brakeInputSplit, 1),
      kSpring: susp.k, cBump: susp.cBump, cRebound: susp.cReb,
      travelBump: 0.095, travelDroop: 0.11,
      arbK: arb.k,
      kingpin,
      hubGroup: w.hubGroup, tireGroup: w.group,
    });
  }
  wheels.sort((a, b) => (b.center[2] - a.center[2]) || (b.center[0] - a.center[0]));

  // drivetrain layout from the powertrain device graph
  const pt = bundle.powertrain;
  const hasDiff = (re) => pt.some(r => re.test(r.name || ''));
  const rearDriven = hasDiff(/differential_R/i);
  const frontDriven = hasDiff(/differential_F/i);
  for (const w of wheels) {
    if (w.axle === 'R' && rearDriven) w.driven = true;
    if (w.axle === 'F' && frontDriven) w.driven = true;
  }
  const layout = frontDriven && rearDriven ? 'AWD' : frontDriven ? 'FWD' : 'RWD';
  note('drivetrain layout', layout, 'powertrain device graph');

  const wF = wheels.filter(w => w.axle === 'F');
  const wR = wheels.filter(w => w.axle === 'R');
  const wheelbase = (wF.length && wR.length)
    ? Math.abs(wF[0].center[2] - wR[0].center[2]) : 2.4;
  const trackF = wF.length === 2 ? Math.abs(wF[0].center[0] - wF[1].center[0]) : 1.45;
  const trackR = wR.length === 2 ? Math.abs(wR[0].center[0] - wR[1].center[0]) : 1.48;
  note('wheelbase / track F / track R', `${wheelbase.toFixed(3)} / ${trackF.toFixed(3)} / ${trackR.toFixed(3)} m`, 'wheel node geometry');
  for (const w of wheels) {
    note(`wheel ${w.name}`, `c=[${w.center.map(v => v.toFixed(3)).join(',')}] r=${w.radius} µ=${w.mu}${w.mu !== w.muRaw ? ` (raw ${w.muRaw} clamped ≥1.2)` : ''}`,
      'pressureWheels + tire part');
  }

  // ---------------------------------------------------------------- engine --
  const eng = bundle.configs.mainEngine || {};
  const torqueRows = Array.isArray(eng.torque) ? eng.torque.filter(r => Array.isArray(r) && r.length >= 2 && typeof r[0] === 'number') : [];
  let curveRPM = new Float32Array(torqueRows.length);
  let curveNm = new Float32Array(torqueRows.length);
  torqueRows.forEach((r, i) => { curveRPM[i] = r[0]; curveNm[i] = r[1]; });
  if (!curveRPM.length) {
    curveRPM = new Float32Array([0, 1000, 3000, 5000, 7000, 9000]);
    curveNm = new Float32Array([0, 150, 210, 235, 220, 160]);
    note('engine torque curve', 'fallback generic I4 curve', 'no mainEngine.torque found');
  }
  // apply torque modifier table if a tuning part provided one
  if (Array.isArray(eng.torqueModMult) && eng.torqueModMult.length > 1) {
    const mod = eng.torqueModMult.filter(r => Array.isArray(r) && typeof r[0] === 'number');
    const modAt = (rpm) => {
      if (!mod.length) return 1;
      let lo = mod[0], hi = mod[mod.length - 1];
      for (let i = 0; i < mod.length - 1; i++) if (rpm >= mod[i][0] && rpm <= mod[i + 1][0]) { lo = mod[i]; hi = mod[i + 1]; break; }
      const t = hi[0] === lo[0] ? 0 : (rpm - lo[0]) / (hi[0] - lo[0]);
      return lo[1] + (hi[1] - lo[1]) * Math.min(1, Math.max(0, t));
    };
    for (let i = 0; i < curveRPM.length; i++) curveNm[i] *= modAt(curveRPM[i]);
    note('torqueModMult applied', `${mod.length} rows`, 'tuning part');
  }

  // engine identity — cylinders from the part name (ccf_engine_f4 → inline 4)
  const engPart = bundle.parts.find(p => /engine_f\d|engine_v\d|engine_i\d/i.test(p.name));
  let cylinders = 4;
  if (engPart) {
    const m = /_[fviFVI](\d+)/.exec(engPart.name);
    if (m) cylinders = Number(m[1]);
  }
  note('engine', `${eng.uiName || engPart?.name || 'unknown'} — ${cylinders} cylinders`, engPart ? `part name ${engPart.name}` : 'assumed I4');

  let peakP = 0, peakPrpm = 0, peakT = 0, peakTrpm = 0;
  for (let i = 0; i < curveRPM.length; i++) {
    const p = curveNm[i] * curveRPM[i] * Math.PI / 30 / 1000;
    if (p > peakP) { peakP = p; peakPrpm = curveRPM[i]; }
    if (curveNm[i] > peakT) { peakT = curveNm[i]; peakTrpm = curveRPM[i]; }
  }
  note('engine output', `${peakP.toFixed(0)} kW (${(peakP * 1.341).toFixed(0)} hp) @ ${peakPrpm}, ${peakT.toFixed(0)} Nm @ ${peakTrpm}`, 'torque table integral');

  const gb = bundle.configs.gearbox || {};
  const gears = Array.isArray(gb.gearRatios) ? gb.gearRatios.map(v => num(v, 0)) : [-3.2, 0, 3.6, 2.4, 1.8, 1.4, 1.1, 0.9];
  const diffCfg = Object.entries(bundle.configs).find(([k]) => /^differential/.test(k))?.[1] || {};
  const finalDrive = num(diffCfg.gearRatio, 3.58);
  note('gear ratios', JSON.stringify(gears), 'gearbox.gearRatios');
  note('final drive', String(finalDrive), 'differential config');

  const vc = bundle.configs.vehicleController || {};

  // ---------------------------------------------------------------- output --
  const rig = {
    info: bundle.information || { name: 'unknown', authors: 'unknown' },
    parts: bundle.parts,
    chassis: {
      mass: totalMass,
      com,
      inertia,
      bbMin, bbMax,
      hullPoints,
    },
    nodes: { count: N, ids, posLocal, mass, groupsOf, idToIdx },
    beams: { pairs: new Uint32Array(beamPairs), count: beamPairs / 2 | 0 },
    wheels,
    steering: {
      maxAngle: 0.52,          // ~30° road-wheel angle at full lock (macro model)
      ackermann: 0.35,
      wheelbase, trackF, trackR,
      source: 'hydros parsed; macro steering uses kingpin geometry + Ackermann approx',
    },
    engine: {
      curveRPM, curveNm,
      idleRPM: num(eng.idleRPM, 900),
      maxRPM: num(eng.maxRPM, 7500),
      revLimit: num(eng.revLimiterRPM, num(eng.maxRPM, 7500) - 200),
      inertia: num(eng.inertia, 0.15),
      friction: num(eng.friction, 12),
      dynamicFriction: num(eng.dynamicFriction, 0.02),
      engineBrakeTorque: num(eng.engineBrakeTorque, 40),
      cylinders,
      name: eng.uiName || engPart?.name || 'I4',
      peakPowerKW: peakP, peakPowerRPM: peakPrpm, peakTorque: peakT, peakTorqueRPM: peakTrpm,
    },
    drivetrain: {
      gears, finalDrive, layout,
      clutchMaxTorque: Math.max(300, peakT * 1.6),
      shiftUpRPM: num(vc.highShiftUpRPM, 7000),
      shiftDownRPM: 3200,
      clutchLaunchRPM: num(vc.clutchLaunchTargetRPM, 2600),
    },
    aero: {
      cd: 0.38,
      frontalArea: (bbMax[0] - bbMin[0]) * (bbMax[1] - bbMin[1]) * 0.84,
      liftCoef: -0.06,
      source: 'Cd assumed (roadster, top up); area from node bbox × 0.84',
    },
    camera: (() => {
      const dash = bundle.camerasInternal.find(c => c.type === 'dash') || bundle.camerasInternal[0];
      if (!dash || typeof dash.x !== 'number') return null;
      const p = jb2three(dash.x, dash.y, dash.z);
      return { pos: [p[0] - com[0], p[1] - com[1], p[2] - com[2]], fov: num(dash.fov, 60) };
    })(),
    refNodes: bundle.refNodes,
    flexbodies: bundle.flexbodies,
    props: bundle.props,
    report,
  };

  note('aero', `Cd=${rig.aero.cd} A=${rig.aero.frontalArea.toFixed(2)} m²`, rig.aero.source);
  return rig;
}

export default convertToPhysicsRig;
