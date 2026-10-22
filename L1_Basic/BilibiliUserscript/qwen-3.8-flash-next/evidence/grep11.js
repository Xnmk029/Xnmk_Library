'use strict';
// 取证分析12：评论组件 bundle → 自定义元素注册名 / shadowRoot 形态 / data-* 锚点 / location 消费点 / 接口 URL
const fs = require('fs');
const path = require('path');
for (const f of ['new-comment.js']) {
  const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
  console.log('========', f, s.length + 'B');
  for (const kw of ['attachShadow', 'customElements.define', 'shadowRoot', 'reply_control', 'IP属地', 'location', '.location', 'wbi/main', 'x/v2/reply']) {
    let i = -1, n = 0, locs = [];
    while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 8) { locs.push(i); n++; }
    console.log(' KW', kw, '=>', locs.length ? locs.slice(0, 8).join(',') : 'none');
  }
  console.log(' --- customElements.define names:');
  const names = new Set();
  for (const m of s.matchAll(/customElements\.define\(\s*["'`]?([a-z][-\w]*)/g)) names.add(m[1]);
  console.log('  ', [...names].join(' | ') || '(none)');
  console.log(' --- data-* 属性(前40个):');
  const dataAttrs = new Set();
  for (const m of s.matchAll(/setAttribute\(["']([^"']+)["']/g)) if (/^data-/.test(m[1])) dataAttrs.add(m[1]);
  for (const m of s.matchAll(/["']((?:data-[a-z-]+(?:\.[a-z-]+)?)?)["']/g)) if (m[1].length > 5 && m[1].split('.').every(p => /^data-[a-z-]+$/.test(p))) dataAttrs.add(m[1]);
  console.log('  ', [...dataAttrs].slice(0, 40).join(' | ') || '(none)');
  console.log(' --- reply_control 消费点上下文:');
  let idx = -1, cnt = 0;
  while ((idx = s.indexOf('reply_control', idx + 1)) >= 0 && cnt < 5) {
    console.log('   @' + idx, JSON.stringify(s.slice(Math.max(0, idx - 80), idx + 140).replace(/\s+/g, ' ')));
    cnt++;
  }
  console.log(' --- IP属地 渲染点:');
  idx = -1; cnt = 0;
  while ((idx = s.indexOf('IP属地', idx + 1)) >= 0 && cnt < 4) {
    console.log('   @' + idx, JSON.stringify(s.slice(Math.max(0, idx - 160), idx + 120).replace(/\s+/g, ' ')));
    cnt++;
  }
  console.log(' --- 接口 URL:');
  const urls = new Set();
  for (const m of s.matchAll(/["'](https?:\/\/api\.bilibili\.com[^"']+)["']/g)) urls.add(m[1]);
  for (const m of s.matchAll(/["']((?:\/\/api\.bilibili\.com)?\/x\/v2\/reply[^"']*)["']/g)) urls.add(m[1]);
  for (const m of s.matchAll(/["'](\/x\/space\/wbi\/acc\/info[^"']*)["']/g)) urls.add(m[1]);
  console.log([...urls].slice(0, 25).join('\n  '));
  console.log('');
}
