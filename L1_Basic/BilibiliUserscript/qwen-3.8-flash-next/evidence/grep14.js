'use strict';
// 取证分析15：shadow mode / data-rpid 模板上下文 / Vue 版条目类名与挂载点 / 主列表接口
const fs = require('fs');
const bc = fs.readFileSync(__dirname + '/bili-comments.js', 'utf8');
const nc = fs.readFileSync(__dirname + '/new-comment.js', 'utf8');
function all(re, s, n) { const o = []; let m; while ((m = re.exec(s)) && o.length < n) o.push(m[0].replace(/\s+/g, ' ').slice(0, 140)); return o; }
console.log('== bili-comments.js attachShadow modes:');
console.log(all(/attachShadow\(\s*\{[^}]{0,40}/g, bc, 10).join('\n'));
console.log('\n== bili-comments.js data-rpid 上下文:');
let i = -1, n = 0;
while ((i = bc.indexOf('data-rpid', i + 1)) >= 0 && n < 4) { console.log('@' + i, JSON.stringify(bc.slice(Math.max(0, i - 130), i + 120).replace(/\s+/g, ' '))); n++; }
console.log('\n== bili-comments.js bili-comments-webview 定义上下文:');
i = bc.indexOf('bili-comments-webview');
console.log(JSON.stringify(bc.slice(Math.max(0, i - 260), i + 60)));
console.log('\n== new-comment.js 类名候选:');
for (const kw of ['list-item', 'root-reply', 'reply-content', 'user-info', 'name', 'comment-list', 'lazy-content', 'info-content']) {
  let j = nc.indexOf(kw); console.log(' ', kw, '=>', j, j >= 0 ? JSON.stringify(nc.slice(Math.max(0, j - 60), j + 90).replace(/\s+/g, ' ')) : '');
}
console.log('\n== new-comment.js 挂载/容器:');
for (const kw of ['"comment"', '#comment', 'container', 'appendChild', 'mount', 'webvue', 'web-view']) {
  let j = nc.indexOf(kw); console.log(' ', kw, '=>', j, j >= 0 ? JSON.stringify(nc.slice(Math.max(0, j - 70), j + 110).replace(/\s+/g, ' ')) : '');
}
console.log('\n== new-comment.js reply 列表接口:');
console.log(all(/["']\/x\/v2\/reply[a-z/_]*["']/gi, nc, 25).join(' | '));
console.log(all(/x\/v2\/reply\/(main|wbi|list)/g, nc, 10).join(' | '));
