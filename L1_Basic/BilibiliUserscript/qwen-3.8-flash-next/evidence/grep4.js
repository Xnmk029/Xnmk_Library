'use strict';
// 取证分析5：contents API 的 base64 → markdown，检索归属地字段
const fs = require('fs');
const path = require('path');
const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'doc-comment-list.b64.json'), 'utf8'));
const s = Buffer.from(j.content, 'base64').toString('utf8');
fs.writeFileSync(path.join(__dirname, 'doc-comment-list.md'), s);
console.log('LEN', s.length);
for (const kw of ['属地', '"location"', 'ip_region', 'reply_control', 'estoration', 'location_reply']) {
  let i = -1, n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 4) {
    console.log('\nKW', kw, '@', i, '>>', JSON.stringify(s.slice(Math.max(0, i - 120), i + 160)));
    n++;
  }
  if (!n) console.log('\nKW', kw, '=> none');
}
