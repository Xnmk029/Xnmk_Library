// 构建脚本：esbuild 打包 → 单文件 dist/index.html
import { build } from './.tooling/node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const src = await build({
  entryPoints: [join(here, 'src', 'main.js')],
  bundle: true,
  format: 'esm',
  minify: false,
  write: false,
  target: ['es2020'],
  alias: { three: join(here, 'vendor', 'three.module.js') },
  logLevel: 'info',
});
const js = src.outputFiles[0].text;
let html = readFileSync(join(here, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
html = html.replace('<script type="module" src="./src/main.js"></script>', '<script type="module">\n' + js + '\n</script>');
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log('dist/index.html written:', Math.round(html.length / 1024) + ' KB');
