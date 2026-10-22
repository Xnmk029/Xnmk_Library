'use strict';
// 取证分析2：打印文件头部片段，判定页面真伪（风控页/正常页），并列出所有外链脚本
const fs = require('fs');
const path = require('path');
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
  console.log('====', f, '====');
  console.log(s.slice(0, 900).replace(/\s+/g, ' '));
  console.log('--- title:', (s.match(/<title>([^<]*)<\/title>/) || [])[1]);
  console.log('--- scripts:', (s.match(/<script[^>]*src="([^"]+)"/g) || []).join('\n  ').slice(0, 1500));
  console.log('');
}
