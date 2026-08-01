// Static consistency check: module graph (imports/exports/files) + DOM ids.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})(join(ROOT, 'js'));

let errs = 0;
const exported = {};
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const ex = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let)\s+([\w$]+)/g)) ex.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((s) => ex.add(s.trim().split(/\s+as\s+/).pop()));
  }
  exported[resolve(f)] = ex;
}
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/import\s*(?:\{([^}]*)\}|\*\s+as\s+\w+|(\w+))?\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, named, , spec] = m;
    if (spec === 'three') continue;
    const target = resolve(dirname(f), spec);
    if (!existsSync(target)) { console.log('MISSING FILE', spec, 'from', f); errs++; continue; }
    if (named && exported[target]) {
      for (const n0 of named.split(',')) {
        const n = n0.trim().split(/\s+as\s+/)[0].trim();
        if (n && !exported[target].has(n)) {
          console.log('MISSING EXPORT', n, 'from', spec, 'imported by', basename(f)); errs++;
        }
      }
    }
  }
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/getElementById\('([^']+)'\)/g)) {
    if (!ids.has(m[1])) { console.log('MISSING DOM ID', m[1], 'referenced in', basename(f)); errs++; }
  }
  for (const m of src.matchAll(/\$\('([^']+)'\)/g)) {
    if (!ids.has(m[1])) { console.log('MISSING DOM ID', m[1], 'via $() in', basename(f)); errs++; }
  }
}
for (const id of ['tach-canvas', 'speed-value', 'gear-badge', 'rpm-value', 'zone-banner', 'mode-badge',
  'diag-log', 'map-overlay', 'map-canvas', 'pedal-throttle', 'pedal-brake', 'pedal-handbrake',
  'hud-extras', 'loading', 'load-bar-fill', 'load-text', 'gl', 'poi-layer', 'hud']) {
  if (!ids.has(id)) { console.log('MISSING BASE DOM ID', id); errs++; }
}
for (const c of ['FL', 'FR', 'RL', 'RR']) for (const s of ['travel', 'load', 'val']) {
  if (!ids.has(`sus-${c}-${s}`)) { console.log('MISSING SUS ID', `sus-${c}-${s}`); errs++; }
}
console.log(errs === 0 ? `MODULE GRAPH + DOM IDS: ALL OK (${files.length} files)` : `${errs} problems found`);
process.exit(errs ? 1 : 0);
