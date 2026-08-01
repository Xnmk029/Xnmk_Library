'use strict';
const fs = require('fs');
const path = require('path');
require('../js/math.js');
require('../js/jbeam.js');
const { Vehicle } = require('../js/physics.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'data', 'vehicle_data.js'), 'utf8'));
const data = globalThis.VEHICLE_DATA;
const terrain = { waterLevel: -999, sample: () => ({ h: 0, normal: [0, 0, 1], surfaceMu: 1 }), cones: [] };

const combos = [
  ['all on', {}],
  ['beams only', { hubs: true, tireBeams: true, contact: true, bounds: true, wheels: true, powertrain: true }]
];
for (const [label, disable] of combos) {
  const v = new Vehicle(data);
  v.disable = disable;
  v.debug = true;
  // initial beam error diagnostic
  let maxErr = 0, maxErrBeam = null, errCount = 0;
  for (const b of v.beams) {
    const na = v.nodes[b.a], nb = v.nodes[b.b];
    const len = Math.hypot(nb.pos[0] - na.pos[0], nb.pos[1] - na.pos[1], nb.pos[2] - na.pos[2]);
    const err = Math.abs(len - b.rest * (b.pre || 1));
    if (err > maxErr) { maxErr = err; maxErrBeam = na.id + '-' + nb.id; }
    if (err > 0.02) errCount++;
  }
  console.log(label, 'initial max beam err:', maxErr.toFixed(4), maxErrBeam, 'err>2cm count:', errCount);
  {
    // net initial force per soft node (pre=1)
    const net = new Map();
    for (const b of v.beams) {
      const na = v.nodes[b.a], nb = v.nodes[b.b];
      if (na.rigid && nb.rigid) continue;
      const len = Math.hypot(nb.pos[0] - na.pos[0], nb.pos[1] - na.pos[1], nb.pos[2] - na.pos[2]) || 1e-6;
      const restEff = b.rest * (b.pre || 1);
      const f = b.k * (len - restEff);
      const ux = (nb.pos[0] - na.pos[0]) / len, uy = (nb.pos[1] - na.pos[1]) / len, uz = (nb.pos[2] - na.pos[2]) / len;
      if (!na.rigid) {
        const n = net.get(b.a) || [0, 0, 0];
        n[0] += f * ux; n[1] += f * uy; n[2] += f * uz;
        net.set(b.a, n);
      }
      if (!nb.rigid) {
        const n = net.get(b.b) || [0, 0, 0];
        n[0] -= f * ux; n[1] -= f * uy; n[2] -= f * uz;
        net.set(b.b, n);
      }
    }
    let worst = 0, worstId = '';
    for (const [i, f] of net) {
      const mag = Math.hypot(f[0], f[1], f[2]);
      if (mag > worst) { worst = mag; worstId = v.nodes[i].id; }
    }
    console.log(label, 'worst initial net force:', worst.toFixed(0), 'N on', worstId);
  }
  if (process.env.LIST_ERR) {
    for (const b of v.beams) {
      const na = v.nodes[b.a], nb = v.nodes[b.b];
      const len = Math.hypot(nb.pos[0] - na.pos[0], nb.pos[1] - na.pos[1], nb.pos[2] - na.pos[2]);
      const err = Math.abs(len - b.rest * (b.pre || 1));
      if (err > 0.02) console.log('  ', na.id, nb.id, 'len', len.toFixed(4), 'rest', (b.rest * (b.pre || 1)).toFixed(4), 'posA', na.pos.map(x => +x.toFixed(3)).join(','), 'posB', nb.pos.map(x => +x.toFixed(3)).join(','));
    }
  }
  let maxD = 0, bad = false, steps = 0;
  for (let i = 0; i < 120; i++) {
    steps = i + 1;
    v.step(1 / 60, terrain);
    for (const n of v.nodes) {
      const d = Math.hypot(n.pos[0], n.pos[1], n.pos[2]);
      if (!Number.isFinite(d)) { bad = true; break; }
      maxD = Math.max(maxD, d);
    }
    if (bad || maxD > 1e4) break;
  }
  console.log(label, bad ? 'NAN/INF' : '', 'maxD', maxD.toFixed(1), 'steps', steps, 'bodyZ', v.rigid.pos[2].toFixed(2));
}
