'use strict';
// 取证分析10：定位 hash 8244368d 出现的完整上下文（找 JS 真身 URL）
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/video-page.html', 'utf8');
let i = -1;
while ((i = s.indexOf('8244368d', i + 1)) >= 0) {
  console.log('@' + i, '>>', JSON.stringify(s.slice(Math.max(0, i - 200), i + 120).replace(/\s+/g, ' ')));
}
// 尾部 1KB（脚本常在 </body> 前）
console.log('TAIL:', JSON.stringify(s.slice(-1600).replace(/\s+/g, ' ')));
