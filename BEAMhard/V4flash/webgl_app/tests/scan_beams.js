'use strict';
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '..', 'data', 'vehicle_data.js'), 'utf8'));
const data = globalThis.VEHICLE_DATA;
let bad = [];
data.beams.forEach((b, i) => {
  const k = b[2], c = b[3], rest = b[4];
  if (!Number.isFinite(k) || !Number.isFinite(c) || !Number.isFinite(rest) || k > 1e8 || rest < 1e-4) {
    bad.push({ i, a: data.nodes[b[0]].id, bnode: data.nodes[b[1]].id, k, c, rest });
  }
});
console.log('bad beams:', bad.length);
console.log(bad.slice(0, 20));
// zero rest pairs
let zero = [];
data.beams.forEach((b, i) => { if (b[4] < 1e-4) zero.push({ i, a: data.nodes[b[0]].id, b: data.nodes[b[1]].id, rest: b[4] }); });
console.log('zero rest:', zero.length, zero.slice(0, 10));
// node duplicate positions?
const pos = new Map();
data.nodes.forEach((n, i) => {
  const key = n.x.toFixed(4) + ',' + n.y.toFixed(4) + ',' + n.z.toFixed(4);
  if (!pos.has(key)) pos.set(key, []);
  pos.get(key).push(n.id);
});
const dups = [...pos.entries()].filter(([k, v]) => v.length > 1);
console.log('duplicate-position nodes:', dups.length, dups.slice(0, 5).map(([k, v]) => v.join(',')));
for (const target of ['fsf2r', 'f16r']) {
  const ti = data.nodes.findIndex(n => n.id === target);
  console.log('=== beams touching', target, 'idx', ti, '===');
  data.beams.forEach((b, i) => {
    if (b[0] === ti || b[1] === ti) {
      console.log(i, data.nodes[b[0]].id, data.nodes[b[1]].id, 'k', b[2], 'c', b[3], 'rest', b[4].toFixed(4), 'lb', b[7], 'sb', b[8], 'pre', b[9]);
    }
  });
}
