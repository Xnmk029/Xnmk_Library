// 架构守卫：依赖方向不得逆向，单文件不得过胖。
// 目的明确——防止项目长成一坨没人看得懂的浆糊（同行有写满模块却忘了入口的前车之鉴）。
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const MAX_LINES = 420;

// 层级由低到高：高层可以 import 低层，反之违规。
// data / core 是公共地基，任何层都能用，故不列入序列（index -1 → 跳过检查）。
const ORDER = ['systems/pure', 'systems', 'gfx', 'render', 'ui', 'game', 'audio', 'debug'];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function layerOf(rel) {
  const p = rel.split('\\').join('/');
  if (p.startsWith('systems/pure/')) return 'systems/pure';
  const seg = p.split('/')[0];
  return ORDER.includes(seg) ? seg : 'other';
}

const files = await walk(ROOT);
const problems = [];
const stats = { files: files.length, lines: 0 };

for (const f of files) {
  const rel = relative(ROOT, f).split('\\').join('/');
  const src = await readFile(f, 'utf8');
  const lines = src.split('\n').length;
  stats.lines += lines;
  if (lines > MAX_LINES) problems.push(`[fat] ${rel} 有 ${lines} 行（上限 ${MAX_LINES}）`);

  const from = layerOf(rel);
  for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const target = posix.normalize(posix.join(posix.dirname(rel), m[1]));
    const to = layerOf(target);
    const fi = ORDER.indexOf(from), ti = ORDER.indexOf(to);
    if (fi >= 0 && ti >= 0 && ti > fi) {
      problems.push(`[dep] ${rel} → ${target}（${from} 不应依赖更高层的 ${to}）`);
    }
  }
  // 纯逻辑层禁止触碰 three
  if (from === 'systems/pure' && /from\s+['"]three/.test(src)) {
    problems.push(`[pure] ${rel} 引入了 three，破坏了"纯逻辑可单测"约定`);
  }
}

console.log(`[check] ${stats.files} 个模块 / ${stats.lines} 行`);
if (problems.length) {
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('[check] 架构方向与文件规模 OK');
