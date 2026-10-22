'use strict';
// 取证分析16：new-comment.js 的 list-item 模板 / rpid 映射 / comment-container 挂载 / 数据请求参数
const fs = require('fs');
const nc = fs.readFileSync(__dirname + '/new-comment.js', 'utf8');
function ctx(label, kw, back, fwd, max) {
  console.log('==== ' + label + ' (' + kw + ') ====');
  let i = -1, n = 0;
  while ((i = nc.indexOf(kw, i + 1)) >= 0 && n < (max || 3)) {
    console.log('@' + i, JSON.stringify(nc.slice(Math.max(0, i - back), i + fwd).replace(/\s+/g, ' ')));
    n++;
  }
  if (!n) console.log('(none)');
}
ctx('list-item 模板', 'list-item', 120, 220, 5);
ctx('comment-container', 'comment-container', 160, 160, 3);
ctx('class:list', 'class: "list', 120, 200, 3);
ctx('attrs 里 rpid', '"rpid"', 160, 120, 6);
ctx('data-id 属性', 'data-id', 120, 140, 3);
ctx('attr id 拼接', 'id:"', 100, 120, 5);
ctx('pagination 参数', 'pagination_reply', 120, 200, 2);
ctx('mode 参数', 'mode:', 80, 120, 3);
ctx('jump 锚点', 'jumpId', 80, 140, 2);
ctx('接口 base', 'reply/main', 200, 120, 3);
ctx('接口 /reply', '"/reply', 160, 120, 4);
ctx('reply/add 邻近', '/reply/add', 260, 60, 2);
ctx('oid=', 'oid=', 160, 80, 3);
