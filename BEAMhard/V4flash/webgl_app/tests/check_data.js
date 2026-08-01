'use strict';
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '..', 'data', 'vehicle_data.js'), 'utf8'));
const data = globalThis.VEHICLE_DATA;
for (const pair of [['h3rr', 'f14rr'], ['t3rr', 'hyd1r'], ['fw2l', 'fx2l']]) {
  const ia = data.nodes.findIndex(n => n.id === pair[0]);
  const ib = data.nodes.findIndex(n => n.id === pair[1]);
  console.log(pair[0], ia, data.nodes[ia]);
  console.log(pair[1], ib, data.nodes[ib]);
  const dist = Math.hypot(data.nodes[ib].x - data.nodes[ia].x, data.nodes[ib].y - data.nodes[ia].y, data.nodes[ib].z - data.nodes[ia].z);
  console.log('distance from node data:', dist.toFixed(4));
  const beams = data.beams.filter(b => (b[0] === ia && b[1] === ib) || (b[0] === ib && b[1] === ia));
  console.log('beams:', beams.map(b => 'rest=' + b[4].toFixed(4) + ' k=' + b[2]));
}
// duplicate ids?
const seen = new Map();
let dups = 0;
for (const n of data.nodes) {
  if (seen.has(n.id)) { dups++; if (dups < 8) console.log('DUP', n.id, seen.get(n.id), 'vs', data.nodes.indexOf(n)); }
  else seen.set(n.id, data.nodes.indexOf(n));
}
console.log('duplicate node ids:', dups);

require('../js/math.js');
require('../js/jbeam.js');
const { Vehicle } = require('../js/physics.js');
const v = new Vehicle(data);
for (const pair of [['t3rr', 'hyd1r'], ['h3rr', 'f14rr']]) {
  const ia = v.nodes.findIndex(n => n.id === pair[0]);
  const ib = v.nodes.findIndex(n => n.id === pair[1]);
  const matches = [];
  v.beams.forEach((b, i) => {
    if ((b.a === ia && b.b === ib) || (b.a === ib && b.b === ia)) matches.push({ i, rest: b.rest, k: b.k, c: b.c });
  });
console.log('physics beams', pair.join('-'), matches);
}
const pres = new Map();
for (const b of data.beams) {
  const p = b[9];
  pres.set(p, (pres.get(p) || 0) + 1);
}
console.log('precompression distribution:', [...pres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + 'x' + v).join(', '));
// find the t3rr-hyd1r data beam pre
{
  const ia = data.nodes.findIndex(n => n.id === 't3rr');
  const ib = data.nodes.findIndex(n => n.id === 'hyd1r');
  const b = data.beams.find(x => (x[0] === ia && x[1] === ib) || (x[0] === ib && x[1] === ia));
console.log('t3rr-hyd1r data beam full:', b);
for (const pair of [['fh5l', 'fx3l'], ['fw2l', 'fx2l'], ['h4', 'f13r']]) {
  const ia = data.nodes.findIndex(n => n.id === pair[0]);
  const ib = data.nodes.findIndex(n => n.id === pair[1]);
  const d = Math.hypot(data.nodes[ib].x - data.nodes[ia].x, data.nodes[ib].y - data.nodes[ia].y, data.nodes[ib].z - data.nodes[ia].z);
  const bs = data.beams.filter(x => (x[0] === ia && x[1] === ib) || (x[0] === ib && x[1] === ia));
  console.log(pair.join('-'), 'dataDist', d.toFixed(4), 'beams', bs.map(x => 'rest=' + x[4].toFixed(4) + ' pre=' + x[9] + ' k=' + x[2]).join(' | '));
}
}
