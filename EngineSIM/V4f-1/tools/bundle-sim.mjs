// 经典脚本打包器：把 src/main-sim.mjs 的整个 ESM 模块图打成单文件经典脚本。
//  - import 'three' 重写为 window.THREE 解构（本项目渲染层直接用全局 THREE）
//  - import.meta.url 重写为 document.baseURI
//  - 支持 export async function（历史上正则漏掉 async 导致 SyntaxError）
// 用法：node tools/bundle-sim.mjs [--check] [--out path]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'src', 'main-sim.mjs');
const OUT = path.join(ROOT, 'sim.bundle.js');

const importRe = /import\s*(?:(\*|\w+)\s*(?:,\s*\{([^}]*)\})?\s*from\s*|\{([^}]*)\}\s*from\s*|)\s*['"]([^'"]+)['"]\s*;?/g;
const exportNamedRe = /^export\s+(async\s+)?(class|function|const|let|var)\s+/;
const exportDefaultRe = /^export\s+default\s+(class|function|async\s+function)\s+(\w+)/;
const exportListRe = /^export\s*\{([^}]*)\}\s*;?/;

function parseImports(code) {
  const out = [];
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(code)) !== null) {
    const [, star, starNamed, named, spec] = m;
    const specifier = spec || m[4];
    if (!specifier) continue;
    out.push({ spec: specifier, star: star === '*' ? starNamed || '*' : null, named: (starNamed || named || '').split(',').map((s) => s.trim()).filter(Boolean) });
  }
  return out;
}

function stripExport(line, code) {
  let out = line;
  const dm = exportDefaultRe.exec(line);
  if (dm) {
    out = line.replace(/^export\s+default\s+/, '');
    return { code: out, defaultName: dm[2] };
  }
  const nm = exportNamedRe.exec(line);
  if (nm) {
    out = line.replace(/^export\s+/, '');
    // 取关键字后的标识符：class Sim / function f / const X
    const kw = nm[2];
    const prefix = (nm[1] || '') + kw;
    const rest = out.slice(prefix.length).trim();
    const nameMatch = /^(\w+)/.exec(rest);
    return { code: out, names: nameMatch ? [nameMatch[1]] : [] };
  }
  const lm = exportListRe.exec(line);
  if (lm) {
    const names = lm[1].split(',').map((s) => s.trim()).filter(Boolean);
    return { code: '', names };
  }
  return { code: out, names: [] };
}

function resolveSpec(fromDir, spec) {
  if (!spec.startsWith('.')) throw new Error(`不支持外部/裸导入：${spec}`);
  let p = path.resolve(fromDir, spec);
  if (!fs.existsSync(p)) {
    for (const ext of ['.mjs', '.js']) {
      if (fs.existsSync(p + ext)) { p += ext; break; }
    }
  }
  return p;
}

function loadModule(file, seen, order) {
  file = path.resolve(file);
  if (seen.has(file)) return;
  seen.add(file);
  const code = fs.readFileSync(file, 'utf8');
  const imports = parseImports(code);
  for (const imp of imports) {
    loadModule(resolveSpec(path.dirname(file), imp.spec), seen, order);
  }
  order.push(file);
}

function transformModule(file) {
  const code = fs.readFileSync(file, 'utf8');
  const imports = parseImports(code);
  const lines = code.split('\n');
  const outLines = [];
  const importBindings = [];
  const exportStmts = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if ((trimmed.startsWith('import ') || trimmed.startsWith('import{')) && trimmed.includes('from')) {
      const imp = imports.find((i) => trimmed.includes(`'${i.spec}'`) || trimmed.includes(`"${i.spec}"`));
      if (imp) {
        if (imp.star) {
          importBindings.push(`const ${imp.star} = __require(${JSON.stringify(imp.spec)});`);
        } else if (imp.named.length) {
          importBindings.push(`const { ${imp.named.join(', ')} } = __require(${JSON.stringify(imp.spec)});`);
        } else {
          importBindings.push(`const __modDefault = __require(${JSON.stringify(imp.spec)});`);
        }
        continue;
      }
    }
    if (trimmed.startsWith('export ')) {
      const r = stripExport(line, code);
      if (r.code) outLines.push(r.code);
      if (r.defaultName) exportStmts.push(`__exports.default = ${r.defaultName};`);
      if (r.names) for (const n of r.names) exportStmts.push(`__exports.${n} = ${n};`);
      continue;
    }
    outLines.push(line);
  }
  // import.meta.url → document.baseURI（bundle 后 import.meta 失效）
  let body = outLines.join('\n').replace(/import\.meta\.url/g, '(typeof document !== "undefined" ? document.baseURI : "")');
  body = body.replace(/\b__require\b/g, '__require');
  return { imports, importBindings, exportStmts, body };
}

export function bundle() {
  const seen = new Set();
  const order = [];
  loadModule(ENTRY, seen, order);
  const modules = order.map((file) => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const mod = transformModule(file);
    return { file, rel, ...mod };
  });
  const idOf = new Map(modules.map((m, i) => [m.file, i]));
  // 每个模块的“书写 spec → 目标模块 id”映射（相对导入按模块自身目录解析）
  const resolvedByModule = {};
  for (const m of modules) {
    const map = {};
    for (const imp of m.imports) {
      const target = resolveSpec(path.dirname(m.file), imp.spec);
      map[imp.spec] = idOf.get(target);
    }
    resolvedByModule[idOf.get(m.file)] = map;
  }
  const parts = [];
  parts.push(`'use strict';`);
  parts.push(`const __modules = {};`);
  parts.push(`const __resolved = ${JSON.stringify(resolvedByModule)};`);
  for (const m of modules) {
    const id = idOf.get(m.file);
    parts.push(`__modules[${id}] = { exports: {} };`);
    parts.push(`(function () {`);
    parts.push(`  const __exports = __modules[${id}].exports;`);
    parts.push(`  const __require = (spec) => { const tid = __resolved[${id}][spec]; if (tid === undefined) throw new Error('未解析模块 ' + spec); return __modules[tid].exports; };`);
    for (const b of m.importBindings) parts.push(b);
    parts.push(m.body);
    for (const e of m.exportStmts) parts.push(e);
    parts.push(`})();`);
  }
  parts.push(`const __v4fExports = __modules[${idOf.get(ENTRY)}].exports;`);
  parts.push(`if (typeof window !== 'undefined') { window.Sim = __v4fExports.Sim || __v4fExports.default; window.SimExports = __v4fExports; }`);
  parts.push(`return __v4fExports;`);
  return `(function () {\n${parts.join('\n')}\n})();`;
}

export async function smoke() {
  const code = bundle();
  const factory = new Function('return ' + code);
  const exports = factory();
  const Sim = exports.Sim || exports.default;
  if (!Sim) throw new Error('bundle 未导出 Sim');
  const sim = new Sim({ headless: true });
  await sim.init();
  sim.start(); // headless 模式同步跑 12 帧
  console.log('smoke: bundle booted, Sim constructed, 12 frames ran OK');
  return sim;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isCheck = process.argv.includes('--check');
  const outIdx = process.argv.indexOf('--out');
  const outFile = outIdx >= 0 ? path.resolve(process.argv[outIdx + 1]) : OUT;
  fs.writeFileSync(outFile, bundle());
  console.log(`bundle 写入 ${outFile}（${(fs.statSync(outFile).size / 1024).toFixed(1)} KB）`);
  if (isCheck) {
    smoke().then(() => process.exit(0)).catch((e) => { console.error('smoke 失败：', e); process.exit(1); });
  }
}

import { pathToFileURL } from 'node:url';
