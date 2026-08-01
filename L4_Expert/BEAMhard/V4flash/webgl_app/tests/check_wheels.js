'use strict';
const fs = require('fs');
const path = require('path');
require('../js/math.js');
require('../js/jbeam.js');
const { Vehicle } = require('../js/physics.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'data', 'vehicle_data.js'), 'utf8'));
const terrain = { waterLevel: -999, sample: () => ({ h: 0, normal: [0, 0, 1], surfaceMu: 1 }), cones: [] };
const v = new Vehicle(globalThis.VEHICLE_DATA);
for (let i = 0; i < 60 * 4; i++) v.step(1 / 60, terrain);
for (const w of v.wheels) {
  console.log(w.name, 'axle', w.axleWorld.map(x => +x.toFixed(3)).join(','), 'fwd', v.wheelForward(w).map(x => +x.toFixed(3)).join(','), 'center', w.center.map(x => +x.toFixed(2)).join(','));
}
// drive 6 s
for (let i = 0; i < 360; i++) {
  v.inputs.throttle = 1; v.inputs.brake = 0; v.inputs.steer = 0;
  v.step(1 / 60, terrain);
  if (i % 60 === 0) {
    console.log('t', (i / 60).toFixed(0), 'pos', v.rigid.pos.map(x => +x.toFixed(1)).join(','), 'vel', v.rigid.vel.map(x => +x.toFixed(1)).join(','), 'rpm', v.engine.rpm.toFixed(0), 'gear', v.engine.gear - 1, 'angVel', v.wheels.map(w => w.angVel.toFixed(0)).join('/'));
  }
}
console.log('after drive: pos', v.rigid.pos.map(x => +x.toFixed(2)).join(','), 'vel', v.rigid.vel.map(x => +x.toFixed(2)).join(','));
for (const w of v.wheels) console.log(w.name, 'angVel', w.angVel.toFixed(1), 'contactN', w.contactN, 'Fn', (w.Fn || 0).toFixed(0));
