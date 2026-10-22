'use strict';
// 取证抓取（文档白名单）：只抓「公开接口字段文档 / 前端结构说明」页面，绝不抓同题油猴脚本实现代码。
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const ALLOW = [
  'raw.githubusercontent.com/cps-open-source-fork/bilibili-API-collect/', // 公开 API 字段文档镜像
  'cdn.jsdelivr.net/gh/cps-open-source-fork/bilibili-API-collect/',
  'api.github.com/repos/cps-open-source-fork/bilibili-API-collect/',      // 文档仓库目录清单
  'github.com/the1812/Bilibili-Evolved/discussions/',                     // 前端结构(ShadowDOM)说明
  'deepwiki.com/eeelester/bilibili-fullscreen-sc/',                       // B站评论区 DOM 注入结构说明(文档)
  'gitea.s1f.ren/shiran/bilibili-API-collect/',                           // reply_control 字段文档提交
];
const [, , name, url] = process.argv;
if (!ALLOW.some((p) => url.startsWith('https://' + p.split('/').slice(0, 3).join('/')))) {
  console.error('[blocked] 不在文档白名单:', url); process.exit(2);
}
function get(u, depth) {
  https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36', 'Accept-Encoding': 'gzip, deflate, br' }, timeout: 25000 }, (res) => {
    if ([301, 302].includes(res.statusCode) && res.headers.location && depth < 3) { get(res.headers.location, depth + 1); return; }
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      let buf = Buffer.concat(chunks);
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      try { if (enc.includes('br')) buf = zlib.brotliDecompressSync(buf); else if (enc.includes('gzip')) buf = zlib.gunzipSync(buf); else if (enc.includes('deflate')) buf = zlib.inflateSync(buf); } catch (e) {}
      const file = path.join(__dirname, name);
      fs.writeFileSync(file, buf);
      console.log(name, res.statusCode, file, buf.length + 'B');
    });
  }).on('error', (e) => { console.error(name, 'ERR', e.message); process.exitCode = 1; });
}
get(url, 0);
