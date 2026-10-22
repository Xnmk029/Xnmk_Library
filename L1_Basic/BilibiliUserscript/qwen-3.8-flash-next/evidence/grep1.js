'use strict';
// 取证分析1：页面 HTML 中检索「属地」、前端 js 资源清单、__INITIAL_STATE__ 归属地相关字段
const fs = require('fs');
const path = require('path');
for (const f of process.argv.slice(2)) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) { console.log('====', f, 'MISSING'); continue; }
  const s = fs.readFileSync(p, 'utf8');
  console.log('====', f, s.length + 'B');
  console.log('  属地 idx:', s.indexOf('属地'), '| ip_region idx:', s.indexOf('ip_region'), '| IP_Restoration idx:', s.indexOf('IP_Restoration'), '| attachShadow idx:', s.indexOf('attachShadow'));
  const m = s.match(/src="[^"]+\.js"/g) || [];
  console.log('  js assets:', m.length);
  m.filter((x) => /comment|dyn|space|reply|opus/i.test(x)).slice(0, 15).forEach((x) => console.log('   ASSET', x.slice(5, x.length - 1)));
  const st = s.indexOf('__INITIAL_STATE__');
  console.log('  __INITIAL_STATE__ idx:', st);
  const bili = s.match(/https:\/\/[^"]+?\.js/g) || [];
  const commentAssets = bili.filter((u) => /comment/i.test(u));
  console.log('  comment-ish urls:', commentAssets.slice(0, 10));
}
