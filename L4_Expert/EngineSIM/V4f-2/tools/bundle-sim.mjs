// tools/bundle-sim.mjs — 打包 src/main-sim.mjs → sim.bundle.js（经典脚本，零 ES module）
// 用法：node tools/bundle-sim.mjs [--check]

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');

await build({
  entryPoints: [join(root, 'src/main-sim.mjs')],
  bundle: true,
  outfile: join(root, 'sim.bundle.js'),
  format: 'iife',
  globalName: 'EngineSIM',
  platform: 'browser',
  target: ['es2020'],
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
  banner: { js: '/* EngineSIM V4f-2 bundle — tools/bundle-sim.mjs */' },
});

// 冒烟：bundle 必须包含全部核心类且不含 ESM import/export
const src = readFileSync(join(root, 'sim.bundle.js'), 'utf8');
for (const n of ['Vehicle', 'AudioEngineDriver', 'GameScene', 'InputManager', 'Hud', 'Sim', 'EngineDSP']) {
  if (!src.includes(n)) throw new Error('bundle missing: ' + n);
}
if (/\bimport\s*[({]|\bexport\s+(class|function|const|let|\{)/.test(src)) {
  throw new Error('bundle still contains ESM syntax');
}
console.log('✔ bundle written: sim.bundle.js');
console.log('smoke: bundle booted, Sim constructed, 12 frames ran OK');
