'use strict';
// 取证分析8：从 deepwiki 结构说明页提取 B 站评论区真实 DOM 锚点（tag 名 / data-* / shadow 形态 / 类名）
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/dw-inject.html', 'utf8');
// 去 HTML 标签转纯文本近似（保留代码块内容），再检索关键结构词
const text = s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
const clean = text.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\n/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
fs.writeFileSync(__dirname + '/dw-inject.txt', clean);
for (const kw of ['bili-comment', 'thread-renderer', 'shadowRoot', 'shadow-root', 'attachShadow', 'data-rpid', 'data-test', 'reply-item', 'comment-content', 'footer', 'IP属地', 'shadow root', 'open shadow']) {
  let i = -1, n = 0;
  while ((i = clean.toLowerCase().indexOf(kw.toLowerCase(), i + 1)) >= 0 && n < 3) {
    console.log('KW', kw, '@', i, '>>', JSON.stringify(clean.slice(Math.max(0, i - 100), i + 180)));
    n++;
  }
  if (!n) console.log('KW', kw, '=> none');
  console.log('');
}
