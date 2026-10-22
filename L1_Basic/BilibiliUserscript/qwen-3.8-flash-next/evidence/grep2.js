'use strict';
// 取证分析3：视频页 HTML → 提取所有 script src；截出 __INITIAL_STATE__ 字面量并检索归属地相关键
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, 'video-page.html'), 'utf8');
const srcs = [...s.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
console.log('SCRIPTS:'); srcs.forEach((x) => console.log(' ', x));
const i = s.indexOf('__INITIAL_STATE__');
const chunk = s.slice(i, i + 60000);
fs.writeFileSync(path.join(__dirname, 'video-initial-state.snippet.txt'), chunk.slice(0, 60000));
for (const kw of ['属地', 'ip_region', 'IP_Restoration', 'ip_restore', '"location"', 'wbi', 'aid', 'bvid']) {
  console.log('KW', kw, '=>', chunk.indexOf(kw));
}
// 找 up 主卡片数据键名，证明 initial state 只有 up 主信息没有归属地
const m = JSON.stringify;
console.log('UP section snippet:', chunk.slice(chunk.indexOf('"up"') >= 0 ? chunk.indexOf('"up"') : 0, 300).replace(/\s+/g, ' ').slice(0, 300));
