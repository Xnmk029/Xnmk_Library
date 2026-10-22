'use strict';
// 取证分析9：视频页主 bundle 线索 / 评论组件（web-view）动态加载入口
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/video-page.html', 'utf8');
const out = new Set();
for (const m of s.matchAll(/["']([^"']*jinkela\/video[^"']*)["']/g)) out.add(m[1]);
for (const m of s.matchAll(/["']([^"']*comment[^"']*\.js[^"']*)["']/gi)) out.add(m[1]);
for (const m of s.matchAll(/["']([^"']*web-view[^"']*)["']/gi)) out.add(m[1]);
for (const m of s.matchAll(/["'](https?:[^"']*?\.js[^"']*)["']/g)) out.add(m[1]);
console.log([...out].slice(0, 60).join('\n'));
for (const kw of ['bcx', 'commentVersion', 'web-view', 'renderJs', 'loader', 'module']) {
  const i = s.indexOf(kw);
  console.log('IDX', kw, '=>', i, i >= 0 ? JSON.stringify(s.slice(i - 60, i + 160).replace(/\s+/g, ' ')) : '');
}
