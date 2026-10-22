'use strict';
// 取证分析14：new-comment.js 属地渲染点逐字上下文（区分注释代码与活跃代码）
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/new-comment.js', 'utf8');
function around(label, i, back, fwd) {
  console.log('==== ' + label + ' @' + i + ' ====');
  console.log(JSON.stringify(s.slice(Math.max(0, i - back), i + fwd)));
}
around('属地#1', 283560, 320, 320);
around('属地#2', 307518, 320, 320);
around('rc@283504', 283504, 200, 260);
around('rc@304358', 304358, 200, 260);
around('rc@305271', 305271, 200, 260);
around('footer@185135', 185135, 200, 200);
around('x/v2/reply@72681', 72681, 160, 200);
around('shadowRoot@113809', 113809, 200, 200);
