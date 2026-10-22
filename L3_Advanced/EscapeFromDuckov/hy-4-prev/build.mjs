// 构建：src/ (ES Module) -> dist/game.js (IIFE 经典脚本，three 内联)
// 产物可通过 file:// 直接双击 index.html 运行（经典脚本不受 ESM 的 CORS 限制）。
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEV = process.argv.includes('--dev');
const WATCH = process.argv.includes('--watch');

const options = {
  entryPoints: [join(ROOT, 'src/main.js')],
  outfile: join(ROOT, 'dist/game.js'),
  bundle: true,
  format: 'iife',
  target: ['chrome100', 'firefox100', 'safari15'],
  minify: !DEV,
  sourcemap: DEV ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
  define: { __DEV__: String(DEV) },
};

/** 把 index.html 模板落成两份：dist/index.html 与根目录 index.html（后者指向 dist/game.js） */
async function emitHtml() {
  const tpl = await readFile(join(ROOT, 'src/index.html'), 'utf8');
  const dist = tpl.replace('/*GAME_JS*/', 'game.js');
  const root = tpl.replace('/*GAME_JS*/', 'dist/game.js');
  await writeFile(join(ROOT, 'dist/index.html'), dist, 'utf8');
  await writeFile(join(ROOT, 'index.html'), root, 'utf8');
}

async function build() {
  await mkdir(join(ROOT, 'dist'), { recursive: true });
  if (WATCH) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    await emitHtml();
    console.log('[build] watching... (dist/game.js)');
    return;
  }
  const t0 = Date.now();
  const res = await esbuild.build({ ...options, metafile: true });
  await emitHtml();
  const out = res.metafile.outputs['dist/game.js'];
  console.log(`[build] dist/game.js ${(out.bytes / 1024).toFixed(0)} KB in ${Date.now() - t0} ms`);
}

if (!WATCH) await rm(join(ROOT, 'dist/game.js'), { force: true });
build().catch((e) => {
  console.error(e);
  process.exit(1);
});
