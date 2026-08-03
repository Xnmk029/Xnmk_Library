#!/usr/bin/env node
/**
 * Creates the node_modules/three shim so the Node test-suite can resolve the
 * bare "three" specifier against the vendored build (browsers use the import
 * map in index.html instead). Run once before `node tests/*.mjs`.
 */
import { mkdirSync, writeFileSync, symlinkSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = join(ROOT, 'node_modules', 'three');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'package.json'), JSON.stringify({
  name: 'three', version: '0.180.0-vendored', type: 'module',
  exports: { '.': './three.module.js' },
}, null, 2));
for (const f of ['three.module.js', 'three.core.js']) {
  const target = join('..', '..', 'js', 'vendor', f);
  try { symlinkSync(target, join(dir, f)); }
  catch { writeFileSync(join(dir, f), `export * from '../../js/vendor/${f}';`); }
}
console.log('[setup_tests] node_modules/three ->', join('js', 'vendor'));
