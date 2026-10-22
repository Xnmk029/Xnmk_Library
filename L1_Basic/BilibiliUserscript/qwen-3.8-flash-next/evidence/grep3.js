'use strict';
// 取证分析4：在 video-page.html 中定位评论组件（web component / bcx / thread-renderer）加载方式
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/video-page.html', 'utf8');
for (const kw of ['bili-comment', 'thread-renderer', 'bcx', 'comment-asset', 'reply_control', 'web-view', 'custom-elements']) {
  let i = -1; const locs = [];
  while ((i = s.indexOf(kw, i + 1)) >= 0 && locs.length < 3) locs.push(i);
  console.log('KW', kw, '=>', locs.length ? locs.join(',') : 'none');
}
const m = s.match(/.{160}bili-comment.{260}/);
if (m) console.log('CTX:\n', m[0]);
const m2 = s.match(/.{100}(comment-asset|bcx-comment|pc-comment).{200}/);
if (m2) console.log('CTX2:\n', m2[0]);
