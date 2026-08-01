/**
 * bundle-sim.mjs -- build sim.bundle.js, a single classic script.
 *
 * Some embedded browsers (including the Codex in-app browser) fail to load
 * ES module graphs over localhost even though the server responds fine.
 * This bundler removes the module mechanism from the critical path:
 *
 *   - every module in the sim graph becomes a factory in a tiny registry;
 *   - `import ... from 'three'` becomes a destructure of window.THREE;
 *   - three.js itself is served as a classic script wrapped from three.cjs
 *     (vendor/three/three.classic.js), so no importmap is needed at all.
 *
 * Usage:
 *   node tools/bundle-sim.mjs          # writes sim.bundle.js (+ three.classic.js)
 *   node tools/bundle-sim.mjs --check  # also runs a stub-environment boot smoke
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, normalize, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'src/main-sim.mjs';
const OUT = join(ROOT, 'sim.bundle.js');
const THREE_CJS = join(ROOT, '..', 'OPUS', 'v8drivingsim', 'node_modules', 'three', 'build', 'three.cjs');
const THREE_CLASSIC = join(ROOT, 'vendor', 'three', 'three.classic.js');

/** Turn an absolute path into a stable module id (forward slashes). */
function idOf(abs) {
  return normalize(relative(ROOT, abs)).split(sep).join('/');
}

/** Resolve a specifier from a module id to { kind: 'file'|'global', id?|abs }. */
function resolveSpec(spec, fromId) {
  if (spec === 'three') return { kind: 'global' };
  if (spec.startsWith('three/addons/')) {
    const abs = normalize(join(ROOT, 'vendor', 'three', 'addons', spec.slice('three/addons/'.length)));
    return { kind: 'file', abs };
  }
  if (spec.startsWith('.')) {
    const abs = normalize(join(ROOT, dirname(fromId), spec));
    return { kind: 'file', abs };
  }
  throw new Error(`cannot bundle bare specifier "${spec}" from ${fromId}`);
}

const IMPORT_RE = /import\s+(\* as \w+|\{[^}]*\}|[\w$]+)(?:\s*,\s*\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]\s*;?/g;

/** Collect exported names from a module's source. */
function exportNames(src) {
  const names = [];
  const reDecl = /\bexport\s+(?:async\s+)?(?:const|let|var|function|class)\s+([\w$]+)/g;
  let m;
  while ((m = reDecl.exec(src))) names.push(m[1]);
  const reList = /\bexport\s*\{([^}]*)\}\s*;?/g;
  while ((m = reList.exec(src))) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p) continue;
      names.push(p.split(/\s+as\s+/)[0].trim());
    }
  }
  return [...new Set(names)];
}

/** Transform one module into a factory body. */
function transform(src, id) {
  const names = exportNames(src);
  let out = src.replace(IMPORT_RE, (whole, bind, spec) => {
    const bindings = bind.startsWith('*')
      ? null
      : bind
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    if (spec === 'three') {
      if (bindings === null) return `const ${bind.replace(/^\*\s+as\s+/, '')} = window.THREE;`;
      return `const { ${bindings.join(', ')} } = window.THREE;`;
    }
    const target = resolveSpec(spec, id);
    if (target.kind === 'global') throw new Error(`unexpected global spec ${spec}`);
    const targetId = idOf(target.abs);
    if (bindings === null) return `const ${bind.replace(/^\*\s+as\s+/, '')} = __req("${targetId}");`;
    return `const { ${bindings.join(', ')} } = __req("${targetId}");`;
  });
  // Strip export keywords (declarations and `export { names };` blocks).
  out = out.replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|var|function|class|\{))/g, '');
  // import.meta is not available in classic scripts; resolve against the
  // document base instead (the AudioWorklet module URL).
  out = out.replace(/import\.meta\.url/g, 'document.baseURI');
  return { body: out, names };
}

/** Depth-first post-order graph traversal from the entry. */
function buildGraph() {
  const entryAbs = join(ROOT, ENTRY);
  const order = [];
  const seen = new Set();

  function visit(abs) {
    if (!existsSync(abs)) throw new Error(`missing module: ${abs}`);
    const id = idOf(abs);
    if (seen.has(id)) return;
    seen.add(id);
    const src = readFileSync(abs, 'utf8');
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[2];
      const res = resolveSpec(spec, id);
      if (res.kind === 'file') visit(res.abs);
    }
    order.push({ id, abs });
  }

  visit(entryAbs);
  return order;
}

/** Wrap three.cjs into a classic script that sets window.THREE. */
function buildThreeClassic() {
  if (!existsSync(THREE_CJS)) throw new Error(`three.cjs not found at ${THREE_CJS}`);
  const body = readFileSync(THREE_CJS, 'utf8');
  return (
    '/* three.js classic build - generated from three.cjs by tools/bundle-sim.mjs */\n' +
    '(function () {\n' +
    '  "use strict";\n' +
    '  var module = { exports: {} };\n' +
    '  var exports = module.exports;\n' +
    body +
    '\n  if (typeof window !== "undefined") window.THREE = module.exports;\n' +
    '})();\n'
  );
}

export function bundle() {
  if (!existsSync(THREE_CLASSIC)) {
    writeFileSync(THREE_CLASSIC, buildThreeClassic());
    console.log('wrote', THREE_CLASSIC);
  }

  const order = buildGraph();
  const parts = order.map(({ id, abs }) => {
    const { body, names } = transform(readFileSync(abs, 'utf8'), id);
    const exportsObj = names.length ? `\nreturn { ${names.join(', ')} };` : '';
    return `__def("${id}", function () {\n${body}${exportsObj}\n});`;
  });

  const bundle =
    '/* V4f sim bundle - generated by tools/bundle-sim.mjs. Do not edit. */\n' +
    '(function () {\n' +
    '  "use strict";\n' +
    '  var __mods = {};\n' +
    '  function __def(id, factory) { __mods[id] = factory(); }\n' +
    '  function __req(id) { return __mods[id]; }\n' +
    parts.join('\n\n') +
    '\n})();\n';
  writeFileSync(OUT, bundle);
  console.log(`wrote ${OUT} (${order.length} modules, ${(bundle.length / 1024).toFixed(0)} KB)`);
  return OUT;
}

/** Boot the bundle in a stub environment: proves the graph wiring works. */
export function smokeCheck(bundlePath = OUT) {
  const src = readFileSync(bundlePath, 'utf8');
  const stub = (name) => {
    const fn = function () {};
    try {
      Object.defineProperty(fn, 'name', { value: name, writable: true, configurable: true });
    } catch {
      /* older engines */
    }
    return new Proxy(fn, {
      get: (t, p) => {
        if (p === Symbol.toPrimitive) return () => 0;
        if (p === 'length') return 0;
        return stub(String(p));
      },
      apply: () => stub('call'),
      construct: () => stub('new ' + name),
    });
  };
  const listeners = {};
  const elements = {};
  const fakeEl = (id) => {
    if (!elements[id]) {
      elements[id] = {
        id,
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {},
        removeEventListener() {},
        querySelector: () => fakeEl(id + '-child'),
        querySelectorAll: () => [],
        appendChild() {},
        getContext: () => stub('ctx'),
        width: 0,
        height: 0,
        innerHTML: '',
        textContent: '',
        value: '',
        checked: false,
      };
    }
    return elements[id];
  };
  global.window = {
    addEventListener: (t, cb) => { (listeners[t] ||= []).push(cb); },
    removeEventListener() {},
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    focus() {},
    requestAnimationFrame: (cb) => {
      smokeRaf = cb;
      return 1;
    },
    location: { protocol: 'http:', href: 'http://localhost:8080/sim.html' },
    navigator: { getGamepads: () => [] },
  };
  global.document = {
    getElementById: fakeEl,
    querySelector: () => fakeEl('q'),
    createElement: () => fakeEl('canvas'),
    addEventListener() {},
    baseURI: 'http://localhost:8080/sim.html',
    documentElement: fakeEl('html'),
    fullscreenElement: null,
  };
  global.requestAnimationFrame = global.window.requestAnimationFrame;
  global.window.THREE = stub('THREE');
  global.THREE = global.window.THREE;
  let smokeRaf = null;
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    // eslint-disable-next-line no-eval
    (0, eval)(src);
  } catch (err) {
    // The Sim constructor catches boot errors itself; reaching the catch
    // proves factories and imports worked. Anything else is a wiring bug.
    if (String(err).includes('WebGL') || elements['boot-error']?.textContent) {
      console.warn = origWarn;
      console.error = origError;
      console.log('smoke: bundle booted, constructor error surfaced:', err.message);
      return;
    }
    throw err;
  }
  // Drive a few animation frames through the real loop to catch wiring
  // mistakes beyond construction.
  let frames = 0;
  try {
    while (smokeRaf && frames < 12) {
      const cb = smokeRaf;
      smokeRaf = null;
      cb(16.7 * (frames + 1));
      frames++;
    }
  } catch (err) {
    console.log('smoke: frame loop threw:', err.stack || err.message);
    throw err;
  }
  if (!global.window.sim) throw new Error('bundle did not expose window.sim');
  console.warn = origWarn;
  console.error = origError;
  console.log(`smoke: bundle booted, Sim constructed, ${frames} frames ran OK`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1]);
if (isMain) {
  try {
    const out = bundle();
    if (process.argv.includes('--check')) smokeCheck(out);
  } catch (err) {
    console.error('bundle failed:', err.message);
    process.exit(1);
  }
}
