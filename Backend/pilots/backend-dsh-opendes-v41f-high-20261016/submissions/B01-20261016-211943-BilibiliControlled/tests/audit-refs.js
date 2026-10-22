'use strict';
/*
 * 静态审计：检查脚本中是否存在「被引用但未声明」的标识符。
 * 这正是静默 catch 最容易掩盖的一类缺陷（例如误删常量后留下悬空引用），
 * 因此必须独立于运行时回放进行校验。
 * 该文件仅用于验证，不属于交付物。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* 默认审计交付脚本；可用命令行参数指向变异体，用于自检该审计是否有效 */
const TARGET = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'answer.user.js');
const raw = fs.readFileSync(TARGET, 'utf8');
console.log('# auditing: ' + TARGET);

/* ---------- 1. 去掉元数据注释、注释、字符串与正则字面量 ---------- */
function strip(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let prevSignificant = '';
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {                     /* 行注释 */
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && c2 === '*') {                     /* 块注释 */
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {         /* 字符串 / 模板串 */
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          /* 模板插值：保留内部代码，粗略处理 */
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            if (depth > 0) out += src[i];
            i++;
          }
          continue;
        }
        i++;
      }
      out += ' ';
      prevSignificant = quote;
      continue;
    }
    if (c === '/' && prevSignificant !== '' && !/[\w$)\]}]/.test(prevSignificant)) {
      /* 正则字面量（依据前一有效字符判断） */
      i++;
      let inClass = false;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { i++; break; }
        else if (src[i] === '\n') break;
        i++;
      }
      while (i < n && /[a-z]/.test(src[i])) i++;
      out += ' ';
      prevSignificant = '/';
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  return out;
}

const code = strip(raw);
let m;

/* ---------- 2. 收集声明：var/let/const/function/参数/catch ---------- */
const declared = new Set();

/* 逐条扫描 var/let/const 语句：从关键字起，按括号深度找到语句结尾，
 * 再按顶层逗号切分，取每个声明符的标识符。 */
function collectVarDeclarations(src) {
  const kwRe = /\b(?:var|let|const)\s+/g;
  let hit;
  while ((hit = kwRe.exec(src)) !== null) {
    let i = hit.index + hit[0].length;
    const n = src.length;
    let depth = 0;
    const names = [];
    let current = '';
    const pushCurrent = () => {
      const name = /^\s*([A-Za-z_$][\w$]*)/.exec(current);
      if (name) names.push(name[1]);
      current = '';
    };
    while (i < n) {
      const ch = src[i];
      if (ch === '(' || ch === '[' || ch === '{') { depth++; current += ch; i++; continue; }
      if (ch === ')' || ch === ']' || ch === '}') { depth--; current += ch; i++; continue; }
      if (ch === ';' && depth <= 0) break;
      if (ch === ',' && depth <= 0) { pushCurrent(); i++; continue; }
      if (ch === '\n' && depth <= 0 && /[;}]/.test((current + ' ').trim().slice(-1) || '')) { /* 继续 */ }
      current += ch;
      i++;
    }
    pushCurrent();
    names.forEach((name) => declared.add(name));
  }
}
collectVarDeclarations(code);

const fnRe = /\bfunction\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
while ((m = fnRe.exec(code)) !== null) {
  if (m[1]) declared.add(m[1]);
  if (m[2]) {
    m[2].split(',').forEach((p) => {
      const name = /^\s*([A-Za-z_$][\w$]*)/.exec(p);
      if (name) declared.add(name[1]);
    });
  }
}
const catchRe = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g;
while ((m = catchRe.exec(code)) !== null) declared.add(m[1]);
const arrowRe = /\(([^)]*)\)\s*=>/g;
while ((m = arrowRe.exec(code)) !== null) {
  m[1].split(',').forEach((p) => {
    const name = /^\s*([A-Za-z_$][\w$]*)/.exec(p);
    if (name) declared.add(name[1]);
  });
}
const arrow1Re = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g;
while ((m = arrow1Re.exec(code)) !== null) declared.add(m[1]);

/* ---------- 3. 收集所有被引用的标识符 ---------- */
/* 剔除成员访问、对象键、属性名、标签、关键字 */
const usage = code
  .replace(/\?\.\s*[A-Za-z_$][\w$]*/g, ' ')          /* 可选链成员 */
  .replace(/\.[A-Za-z_$][\w$]*/g, ' ')                /* 点号成员 */
  .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1$3') /* 对象字面量键 */
  .replace(/\[\s*(['"])[^\]]*?\1\s*\]/g, ' ')          /* 字符串下标 */
  .replace(/\b(case|default|break|continue|new|delete|typeof|instanceof|in|of|void|do|else|return|throw|try|catch|finally|if|for|while|switch|function|var|let|const|null|true|false|undefined|this|super|class|extends|yield|await|async)\b/g, ' ');

const builtins = new Set([
  'window', 'document', 'globalThis', 'Object', 'Array', 'Map', 'Set', 'WeakSet', 'WeakMap',
  'Math', 'JSON', 'String', 'Number', 'Boolean', 'RegExp', 'Date', 'Promise', 'Error', 'Symbol',
  'Proxy', 'Reflect', 'Response', 'Request', 'Headers', 'Element', 'HTMLElement', 'Node',
  'ShadowRoot', 'MutationObserver', 'CustomEvent', 'Event', 'PopStateEvent', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'fetch',
  'isFinite', 'isNaN', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'ArrayBuffer', 'Uint8Array', 'escape', 'unescape', 'arguments', 'eval', 'Function'
]);

const findings = [];
const identRe = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)/g;
while ((m = identRe.exec(usage)) !== null) {
  const name = m[1];
  if (!declared.has(name) && !builtins.has(name)) findings.push(name);
}

/* 去重并给出出现次数 */
const counts = new Map();
findings.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
const report = Array.from(counts.entries())
  .map(([name, count]) => ({ name, occurrences: count }))
  .sort((a, b) => b.occurrences - a.occurrences);

console.log(JSON.stringify({
  declaredIdentifiers: declared.size,
  unboundIdentifiers: report
}, null, 2));

const ok = report.length === 0;
console.log('\n==== ' + (ok ? 'ALL IDENTIFIERS RESOLVE' : 'UNBOUND IDENTIFIERS PRESENT') + ' ====');
process.exit(ok ? 0 : 1);
