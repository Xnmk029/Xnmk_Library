'use strict';
// 取证分析17：jumpToReply 实现 → list-item 与 rpid 的 DOM 映射锚点
const fs = require('fs');
const nc = fs.readFileSync(__dirname + '/new-comment.js', 'utf8');
function ctx(label, kw, back, fwd, max) {
  console.log('==== ' + label + ' ====');
  let i = -1, n = 0;
  while ((i = nc.indexOf(kw, i + 1)) >= 0 && n < (max || 3)) {
    console.log('@' + i, JSON.stringify(nc.slice(Math.max(0, i - back), i + fwd).replace(/\s+/g, ' ')));
    n++;
  }
  if (!n) console.log('(none)');
}
ctx('jumpToReply 定义', 'jumpToReply: function', 40, 420, 2);
ctx('_checkId 定义', '_checkId: function', 40, 320, 2);
ctx('getElementById', 'getElementById', 120, 160, 4);
ctx('id 属性模板', 'id=\\"', 140, 140, 6);
ctx("'id'", "'id'", 60, 80, 6);
ctx('loadPage', 'loadPage', 40, 260, 3);
ctx('_createReplyItem / root', 'root-reply', 80, 200, 2);
ctx('reply-item 类', 'reply-item', 120, 140, 4);
ctx('data-index', 'data-index', 100, 120, 2);
