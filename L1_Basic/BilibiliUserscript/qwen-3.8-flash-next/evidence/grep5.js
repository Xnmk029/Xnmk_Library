'use strict';
// 取证分析6：video-page.html 全部外链资源（script/link），找主 bundle 与评论组件加载器线索
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/video-page.html', 'utf8');
const urls = new Set();
for (const m of s.matchAll(/(?:src|href)="([^"]+\.(?:js|mjs|css)[^"]*)"/g)) urls.add(m[1]);
for (const m of s.matchAll(/https?:\/\/[^"'\\\s<>]+?\.(?:js|mjs)(?:"|')/g)) urls.add(m[0].slice(0, -1));
console.log([...urls].sort().join('\n'));
// 找内联脚本中的组件版本/地址线索
for (const kw of ['comment', 'Comment', 'web-view', 'bfe_a', 'render']) {
  let i = -1, n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 2) { console.log('KW', kw, '@', i, '>>', JSON.stringify(s.slice(i - 80, i + 120).replace(/\s+/g, ' '))); n++; }
}
