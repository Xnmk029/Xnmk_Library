#!/usr/bin/env node
/**
 * Scans vehicles/ and emits vehicles/manifest.json — the asset index the
 * browser uses (HTTP has no directory listing). Re-run after adding assets.
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const VEH = join(ROOT, 'vehicles');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push({ path: relative(ROOT, p).replaceAll('\\', '/'), size: st.size });
  }
  return out;
}

const files = walk(VEH);
const manifest = {
  generated: new Date().toISOString(),
  root: 'vehicles/',
  jbeam: files.filter(f => f.path.endsWith('.jbeam')).map(f => f.path),
  materials: files.filter(f => f.path.endsWith('.materials.json')).map(f => f.path),
  meshes: files.filter(f => f.path.endsWith('.dae')).map(f => ({ path: f.path, size: f.size })),
  textures: files.filter(f => /\.(dds|png|jpg)$/i.test(f.path)).map(f => f.path),
  totalBytes: files.reduce((a, f) => a + f.size, 0),
  fileCount: files.length,
};
writeFileSync(join(VEH, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`[manifest] ${manifest.fileCount} files, ${(manifest.totalBytes / 1e6).toFixed(1)} MB, ` +
  `${manifest.jbeam.length} jbeam, ${manifest.meshes.length} dae, ${manifest.textures.length} textures`);
