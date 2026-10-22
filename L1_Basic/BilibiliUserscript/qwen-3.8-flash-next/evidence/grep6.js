'use strict';
// 取证分析7：在 reply-main.json 与 doc-comment-list.md 中对比 reply_control 差异（匿名 vs 文档登录态）
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(__dirname + '/reply-main.json', 'utf8'));
const rs = (d.data.replies || []).concat((d.data.top_replies) || []);
console.log('replies:', rs.length);
rs.slice(0, 6).forEach((r) => {
  console.log(' rpid=' + r.rpid_str, 'mid=' + r.mid, 'rc_keys=' + Object.keys(r.reply_control || {}).join('/'));
});
const sub = (rs[0].replies || [])[0];
console.log('sub[0] rc_keys:', sub ? Object.keys(sub.reply_control || {}).join('/') : null);
console.log('member keys:', Object.keys(rs[0].member || {}).join('/'));
console.log('cursor keys:', Object.keys(d.data.cursor || {}).join('/'));
console.log('upper keys:', Object.keys(d.data.upper || {}).join('/'));
