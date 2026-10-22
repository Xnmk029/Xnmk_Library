'use strict';
// 取证抓取（B站官方 CDN 前端资源白名单）：node evidence/fetchcdn.js <name> <url>
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const [, , name, url] = process.argv;
if (!/^https?:\/\/(s1\.hdslb\.com|static\.hdslb\.com|api\.bilibili\.com|www\.bilibili\.com)\//.test(url)) {
  console.error('[blocked] 仅允许 B 站官方 CDN/API:', url); process.exit(2);
}
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36', 'Referer': 'https://www.bilibili.com/', 'Accept-Encoding': 'gzip, deflate, br' }, timeout: 30000 }, (res) => {
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
