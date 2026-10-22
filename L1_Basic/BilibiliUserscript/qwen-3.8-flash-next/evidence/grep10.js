'use strict';
// 取证分析11：B站官方视频主 bundle → 评论组件资源 URL / 自定义元素名 / 归属地字段消费点
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/video-bundle.js', 'utf8');
console.log('LEN', s.length);
const kws = ['bili-comment', 'comment-thread', 'thread-renderer', 'attachShadow', 'IP属地', 'reply_control', 'web-view', 'comment-asset', 'bcx', 'x/v2/reply'];
for (const kw of kws) {
  let i = -1, n = 0;
  const locs = [];
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 6) { locs.push(i); n++; }
  console.log('KW', kw, '=>', locs.join(','));
}
// 评论组件加载 URL 候选
for (const m of s.matchAll(/["']([^"']*(?:comment|bcx)[^"']*?\.js[^"']*)["']/g)) console.log('URL', m[1].slice(0, 160));
// customElements.define 名单
for (const m of s.matchAll(/customElements\.define\(\s*["']([^"']+)["']/g)) console.log('CE', m[1]);
