#!/usr/bin/env node
/** Node smoke-test: parse + assemble the real CCF jbeam set and print a report. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VehicleAssembler } from '../js/jbeam/assembler.js';
import { parseJBeam } from '../js/jbeam/relaxedjson.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.jbeam')) out.push(p);
  }
  return out;
}

// --- 1. relaxed JSON unit checks -------------------------------------------
const cases = [
  ['{"a":1,"b":2}', { a: 1, b: 2 }],
  ['{"a":1 "b":2}', { a: 1, b: 2 }],                       // missing comma
  ['{a:1, /*x*/ b:.5, } // tail', { a: 1, b: 0.5 }],        // bare key, block comment, trailing comma
  ['[1 2 3,4,]', [1, 2, 3, 4]],
  ['{"s":"a\\"b"}', { s: 'a"b' }],
];
for (const [src, want] of cases) {
  const got = parseJBeam(src);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'} relaxedjson ${src}`);
  if (!ok) { console.log('  got:', JSON.stringify(got)); process.exitCode = 1; }
}

// --- 2. full-mod parse ------------------------------------------------------
const files = new Map();
let bytes = 0;
for (const p of walk(join(ROOT, 'vehicles'))) {
  const text = readFileSync(p, 'utf8');
  bytes += text.length;
  files.set(p.slice(ROOT.length + 1).replaceAll('\\', '/'), text);
}
console.log(`\nloaded ${files.size} jbeam files (${(bytes / 1024).toFixed(0)} KiB)`);

const t0 = performance.now();
const asm = new VehicleAssembler(files, (m, lv) => console.log(`  [${lv || 'info'}] ${m}`));
console.log(`parsed in ${(performance.now() - t0).toFixed(1)} ms, parts=${asm.partsByName.size}, parseErrors=${asm.parseErrors.length}`);
for (const e of asm.parseErrors.slice(0, 8)) console.log('  ERR', e);

console.log('\nmain candidates:', asm.optionsFor('main'));

const bundle = asm.assemble();
console.log('\nSTATS', bundle.stats);
console.log('missing slots:', bundle.missingSlots.slice(0, 12));
console.log('info:', bundle.information);
console.log('refNodes:', bundle.refNodes);
console.log('parts:', bundle.parts.map(p => p.name).join(', '));

const mass = bundle.nodes.reduce((a, n) => a + (typeof n.nodeWeight === 'number' ? n.nodeWeight : 25), 0);
console.log(`\nnode mass total: ${mass.toFixed(1)} kg over ${bundle.nodes.length} nodes`);

console.log('\npressureWheels rows:');
for (const w of bundle.pressureWheels) {
  console.log(` ${w.name} hub=${w.hubGroup} n1=${w.node1} n2=${w.node2} radius=${w.radius} width=${w.tireWidth}` +
    ` fric=${w.frictionCoef} weight=${w.nodeWeight} dir=${w.wheelDir} arm=${w.nodeArm} part=${w.__part}`);
}

console.log('\nconfig keys:', Object.keys(bundle.configs).join(', '));
const eng = bundle.configs.mainEngine;
if (eng) {
  console.log('engine: idle', eng.idleRPM, 'max', eng.maxRPM, 'inertia', eng.inertia,
    'torque rows', Array.isArray(eng.torque) ? eng.torque.length : 0);
  if (Array.isArray(eng.torque)) console.log('  torque sample:', JSON.stringify(eng.torque.slice(0, 5)));
}
const gb = bundle.configs.gearbox;
if (gb) console.log('gearbox ratios:', JSON.stringify(gb.gearRatios));
for (const k of Object.keys(bundle.configs)) {
  if (/differential/i.test(k)) console.log(k, 'gearRatio:', bundle.configs[k].gearRatio, 'type:', bundle.configs[k].diffType ?? bundle.configs[k].type);
}

const interesting = [...bundle.variables.entries()].filter(([k]) => /spring|damp|tirepressure|gear|arb|swaybar|steer/i.test(k));
console.log('\nvariables (suspension/drivetrain):');
for (const [k, v] of interesting) console.log(`  $${k} = ${v}`);

console.log('\nhydros:', bundle.hydros.length, 'torsionbars:', bundle.torsionbars.length,
  'props:', bundle.props.length, 'flexbodies:', bundle.flexbodies.length);
console.log('flexbody meshes:', bundle.flexbodies.map(f => f.mesh).join(', '));
console.log('\ncamerasInternal:', JSON.stringify(bundle.camerasInternal.slice(0, 2)));
console.log('\nOK');
