'use strict';
// 取证分析13：attachShadow 模式 / 新版组件元素名 / footer 结构 / 归属地文本渲染模板
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/new-comment.js', 'utf8');
console.log('LEN', s.length);
const modes = new Set();
for (const m of s.matchAll(/attachShadow\(\s*\{[^}]*mode\s*:\s*["'](\w+)["']/g)) modes.add(m[1]);
console.log('shadow modes:', [...modes].join(',') || '(none)');
const t = new Set();
for (const m of s.matchAll(/customElements\.define\(\s*["']([^"']+)["']/g)) t.add(m[1]);
console.log('CE names:', [...t].join(' | ') || '(none)');
for (const kw of ['IP属地', 'reply_control', 'location', 'data-rpid', 'footer', 'thread-renderer', 'shadowRoot', 'wbi/main', 'x/v2/reply', 'ip_region', 'locationText', '属地']) {
  let i = -1, n = 0, locs = [];
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 6) { locs.push(i); n++; }
  console.log('KW', kw, '=>', locs.length ? locs.slice(0, 6).join(',') : 'none');
}
let idx = s.indexOf('IP属地');
if (idx >= 0) console.log('CTX 属地>>', JSON.stringify(s.slice(Math.max(0, idx - 260), idx + 160)));
idx = s.indexOf('data-rpid');
if (idx >= 0) console.log('CTX data-rpid>>', JSON.stringify(s.slice(Math.max(0, idx - 160), idx + 160)));
idx = s.indexOf('wbi/main');
if (idx >= 0) console.log('CTX wbi/main>>', JSON.stringify(s.slice(Math.max(0, idx - 200), idx + 220)));
