'use strict';
const path = require('path');
const { parseDAE } = require('./convert_assets.js');
const f = path.join(__dirname, '..', 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles', 'ccf', 'ccfremodel.dae');
const t0 = Date.now();
const dae = parseDAE(f);
console.log('parse ms:', Date.now() - t0);
console.log('geoms:', dae.geoms.size, 'scenes:', dae.scenes.length);
const fs = require('fs');
const src = fs.readFileSync(f, 'utf8');
const s0 = src.indexOf('<geometry id="');
console.log('first geometry at', s0);
const e0 = src.indexOf('</geometry>', s0);
console.log(src.slice(s0, Math.min(s0 + 1200, e0)));
for (const [id, ge] of dae.geoms) {
  console.log(id, ge.pos ? ge.pos.length / 3 : 'no-pos', ge.subs.length);
  if (ge.pos) break;
}
const names = ['ccf_body', 'ccf_bodylabels', 'ccf_glass', 'tire_01a_17x8_26', 'ccf_wheel_4a_15x8_thw'];
for (const n of names) {
  const sc = dae.scenes.find(s => s.name === n);
  console.log('scene', n, sc ? sc.geoUrl : 'MISSING');
}
const fs2 = require('fs');
const files = [
  path.join(__dirname, '..', 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles', 'common', 'wheels', 'ccf_wheel_1_thw', 'ccf_wheels_thw.dae'),
  path.join(__dirname, '..', 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles', 'common', 'tires', 'ccftires.dae'),
  path.join(__dirname, '..', 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles', 'ccf', 'ccfoffroadster.dae')
];
for (const f2 of files) {
  const d2 = parseDAE(f2);
console.log('==', path.basename(f2), 'geoms', d2.geoms.size, 'scenes', d2.scenes.length);
  for (const n of names) {
    const sc = d2.scenes.find(s => s.name === n);
    if (sc) console.log('  scene', n, '->', sc.geoUrl);
  }
  console.log('  sample scene names:', d2.scenes.slice(0, 12).map(s => s.name).join(', '));
}
console.log('== all ccf_body-ish scenes in remodel:');
for (const sc of dae.scenes) {
  if (sc.name.toLowerCase().includes('ccf_body') || sc.name === 'Plane_011') {
    const ge = dae.geoms.get(sc.geoUrl);
    console.log(sc.name, '->', sc.geoUrl, ge ? ge.pos.length / 3 + 'v' : '?');
  }
}
